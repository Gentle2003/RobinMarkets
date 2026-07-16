// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { ERC1155Holder } from "@openzeppelin/contracts/token/ERC1155/utils/ERC1155Holder.sol";
import { EIP712 } from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import { SignatureChecker } from "@openzeppelin/contracts/utils/cryptography/SignatureChecker.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";

import { Order, Side, hashOrderStruct } from "./Order.sol";
import { ConditionalTokens } from "../tokens/ConditionalTokens.sol";

/**
 * @title CTFExchange
 * @notice On-chain settlement layer for RobinMarkets' central limit order book.
 *         Users sign EIP-712 limit orders off-chain; a matching service pairs
 *         crossing orders and calls {matchOrders} to settle them atomically.
 *
 *         Three settlement geometries are supported for a binary market:
 *          - NORMAL: a BUY and a SELL of the SAME outcome token (a direct swap).
 *          - MINT:   two BUYs of COMPLEMENTARY tokens (YES + NO) whose prices sum
 *                    to >= 1 collateral; their collateral is split into a full set.
 *          - MERGE:  two SELLs of COMPLEMENTARY tokens whose asks sum to <= 1;
 *                    the set is merged back into collateral and paid out.
 *
 * @dev Prices are collateral wei per share, scaled to 1e18 (== 1.0 collateral).
 *      NOT audited — do not use with real funds.
 */
contract CTFExchange is EIP712, Ownable, ReentrancyGuard, ERC1155Holder {
    using SafeERC20 for IERC20;

    uint256 internal constant ONE = 1e18;

    ConditionalTokens public immutable ctf;

    struct TokenInfo {
        bool registered;
        uint256 complement; // positionId of the opposite outcome
        bytes32 conditionId;
        IERC20 collateral;
    }

    /// @dev outcome tokenId => registration info.
    mapping(uint256 => TokenInfo) public tokens;
    /// @dev orderHash => amount of makerAmount already filled (in maker "making" units).
    mapping(bytes32 => uint256) public filled;
    /// @dev orderHash => cancelled.
    mapping(bytes32 => bool) public cancelled;
    /// @dev maker => current nonce; orders must carry the maker's live nonce.
    mapping(address => uint256) public nonces;
    /// @dev addresses permitted to register markets (the MarketFactory).
    mapping(address => bool) public registrars;

    event TokenRegistered(uint256 indexed tokenId, uint256 indexed complement, bytes32 indexed conditionId);
    event OrderCancelled(bytes32 indexed orderHash, address indexed maker);
    event NonceIncremented(address indexed maker, uint256 newNonce);
    event RegistrarSet(address indexed who, bool allowed);
    event OrderFilled(
        bytes32 indexed orderHash,
        address indexed maker,
        uint256 tokenId,
        uint256 makerAmountFilled,
        uint256 takerAmountFilled
    );
    event OrdersMatched(bytes32 indexed takerHash, bytes32 indexed makerHash, uint8 matchType, uint256 fillShares);

    error NotRegistrar();
    error TokenNotRegistered();
    error OrderExpired();
    error OrderCancelledErr();
    error BadNonce();
    error BadSignature();
    error NotCrossing();
    error IncompatibleOrders();
    error ZeroFill();
    error Overfill();

    constructor(ConditionalTokens _ctf) EIP712("RobinMarkets CTF Exchange", "1") Ownable(msg.sender) {
        ctf = _ctf;
    }

    // ─── Admin / registration ────────────────────────────────────────────────

    function setRegistrar(address who, bool allowed) external onlyOwner {
        registrars[who] = allowed;
        emit RegistrarSet(who, allowed);
    }

    modifier onlyRegistrar() {
        if (!registrars[msg.sender] && msg.sender != owner()) revert NotRegistrar();
        _;
    }

    /// @notice Register a YES/NO outcome token pair for a market so it can be traded.
    function registerToken(uint256 tokenId, uint256 complement, bytes32 conditionId, IERC20 collateral)
        external
        onlyRegistrar
    {
        _registerOne(tokenId, complement, conditionId, collateral);
        _registerOne(complement, tokenId, conditionId, collateral);
        // Allow the CTF to pull this collateral from the exchange when minting sets.
        collateral.forceApprove(address(ctf), type(uint256).max);
    }

    function _registerOne(uint256 tokenId, uint256 complement, bytes32 conditionId, IERC20 collateral) internal {
        if (tokens[tokenId].registered) return;
        tokens[tokenId] = TokenInfo(true, complement, conditionId, collateral);
        emit TokenRegistered(tokenId, complement, conditionId);
    }

    // ─── Order lifecycle ─────────────────────────────────────────────────────

    function hashOrder(Order calldata o) public view returns (bytes32) {
        return _hashTypedDataV4(hashOrderStruct(o));
    }

    /// @notice Cancel a single order the caller made.
    function cancelOrder(Order calldata o) external {
        require(msg.sender == o.maker, "not maker");
        cancelled[hashOrder(o)] = true;
        emit OrderCancelled(hashOrder(o), o.maker);
    }

    /// @notice Invalidate every outstanding order of the caller in one shot.
    function incrementNonce() external {
        uint256 n = ++nonces[msg.sender];
        emit NonceIncremented(msg.sender, n);
    }

    /// @notice Remaining fillable makerAmount for an order (0 if dead).
    function remaining(Order calldata o) external view returns (uint256) {
        bytes32 h = hashOrder(o);
        if (cancelled[h] || o.nonce != nonces[o.maker]) return 0;
        if (o.expiration != 0 && block.timestamp > o.expiration) return 0;
        uint256 f = filled[h];
        return f >= o.makerAmount ? 0 : o.makerAmount - f;
    }

    // ─── Matching / settlement ───────────────────────────────────────────────

    /**
     * @notice Settle a taker order against one maker order.
     * @param taker      the incoming order.
     * @param maker      the resting order to match against.
     * @param fillShares number of outcome shares to trade in this fill.
     * @dev Permissionless: anyone may settle two crossing, validly-signed orders.
     *      Execution always respects both makers' limit prices.
     */
    function matchOrders(Order calldata taker, Order calldata maker, uint256 fillShares)
        external
        nonReentrant
    {
        if (fillShares == 0) revert ZeroFill();
        bytes32 takerHash = _validate(taker);
        bytes32 makerHash = _validate(maker);

        if (taker.side != maker.side && taker.tokenId == maker.tokenId) {
            _settleNormal(taker, takerHash, maker, makerHash, fillShares);
        } else if (taker.side == Side.BUY && maker.side == Side.BUY && _areComplements(taker.tokenId, maker.tokenId)) {
            _settleMint(taker, takerHash, maker, makerHash, fillShares);
        } else if (taker.side == Side.SELL && maker.side == Side.SELL && _areComplements(taker.tokenId, maker.tokenId)) {
            _settleMerge(taker, takerHash, maker, makerHash, fillShares);
        } else {
            revert IncompatibleOrders();
        }
    }

    /// @dev BUY + SELL of the same token: buyer pays collateral to seller at the resting (maker) price.
    function _settleNormal(
        Order calldata taker,
        bytes32 takerHash,
        Order calldata maker,
        bytes32 makerHash,
        uint256 f
    ) internal {
        (Order calldata buy, bytes32 buyHash, Order calldata sell, bytes32 sellHash) =
            taker.side == Side.BUY ? (taker, takerHash, maker, makerHash) : (maker, makerHash, taker, takerHash);

        uint256 buyPrice = _price(buy); // collateral per share (1e18)
        uint256 sellPrice = _price(sell);
        if (buyPrice < sellPrice) revert NotCrossing();

        // Execute at the resting maker's price.
        uint256 execPrice = maker.side == Side.SELL ? sellPrice : buyPrice;

        // Cap by both sides' remaining share capacity.
        f = _min(f, _sharesRemaining(buy, buyHash));
        f = _min(f, _sharesRemaining(sell, sellHash));
        if (f == 0) revert ZeroFill();

        uint256 collateralAmt = (f * execPrice) / ONE;
        IERC20 collateral = tokens[sell.tokenId].collateral;

        // Buyer pays collateral -> seller; seller delivers shares -> buyer.
        collateral.safeTransferFrom(buy.maker, sell.maker, collateralAmt);
        ctf.safeTransferFrom(sell.maker, buy.maker, sell.tokenId, f, "");

        _consumeBuy(buy, buyHash, collateralAmt, f);
        _consumeSell(sell, sellHash, f, collateralAmt);
        emit OrdersMatched(takerHash, makerHash, 0, f);
    }

    /// @dev Two BUYs of complementary tokens: split fresh collateral into a full set.
    function _settleMint(
        Order calldata taker,
        bytes32 takerHash,
        Order calldata maker,
        bytes32 makerHash,
        uint256 f
    ) internal {
        uint256 pTaker = _price(taker);
        uint256 pMaker = _price(maker);
        if (pTaker + pMaker < ONE) revert NotCrossing();

        f = _min(f, _sharesRemaining(taker, takerHash));
        f = _min(f, _sharesRemaining(maker, makerHash));
        if (f == 0) revert ZeroFill();

        // Taker pays its limit price; maker covers the rest of the full-set cost.
        uint256 takerPay = (f * pTaker) / ONE;
        uint256 setCost = f; // 1 collateral funds 1 full YES+NO set
        uint256 makerPay = setCost > takerPay ? setCost - takerPay : 0;

        TokenInfo memory info = tokens[taker.tokenId];
        IERC20 collateral = info.collateral;

        collateral.safeTransferFrom(taker.maker, address(this), takerPay);
        collateral.safeTransferFrom(maker.maker, address(this), makerPay);

        ctf.splitPosition(collateral, info.conditionId, f);
        // Each buyer receives the outcome they bid on.
        ctf.safeTransferFrom(address(this), taker.maker, taker.tokenId, f, "");
        ctf.safeTransferFrom(address(this), maker.maker, maker.tokenId, f, "");

        _consumeBuy(taker, takerHash, takerPay, f);
        _consumeBuy(maker, makerHash, makerPay, f);
        emit OrdersMatched(takerHash, makerHash, 1, f);
    }

    /// @dev Two SELLs of complementary tokens: merge a full set back into collateral.
    function _settleMerge(
        Order calldata taker,
        bytes32 takerHash,
        Order calldata maker,
        bytes32 makerHash,
        uint256 f
    ) internal {
        uint256 pTaker = _price(taker);
        uint256 pMaker = _price(maker);
        if (pTaker + pMaker > ONE) revert NotCrossing();

        f = _min(f, _sharesRemaining(taker, takerHash));
        f = _min(f, _sharesRemaining(maker, makerHash));
        if (f == 0) revert ZeroFill();

        TokenInfo memory info = tokens[taker.tokenId];
        IERC20 collateral = info.collateral;

        // Pull both outcome legs in, merge into collateral held by the exchange.
        ctf.safeTransferFrom(taker.maker, address(this), taker.tokenId, f, "");
        ctf.safeTransferFrom(maker.maker, address(this), maker.tokenId, f, "");
        ctf.mergePositions(collateral, info.conditionId, f);

        // Taker gets its ask; maker gets the remainder of the merged collateral.
        uint256 takerGet = (f * pTaker) / ONE;
        uint256 makerGet = f > takerGet ? f - takerGet : 0;
        collateral.safeTransfer(taker.maker, takerGet);
        collateral.safeTransfer(maker.maker, makerGet);

        _consumeSell(taker, takerHash, f, takerGet);
        _consumeSell(maker, makerHash, f, makerGet);
        emit OrdersMatched(takerHash, makerHash, 2, f);
    }

    // ─── Validation & accounting helpers ─────────────────────────────────────

    function _validate(Order calldata o) internal view returns (bytes32 h) {
        if (!tokens[o.tokenId].registered) revert TokenNotRegistered();
        h = hashOrder(o);
        if (cancelled[h]) revert OrderCancelledErr();
        if (o.expiration != 0 && block.timestamp > o.expiration) revert OrderExpired();
        if (o.nonce != nonces[o.maker]) revert BadNonce();
        if (!SignatureChecker.isValidSignatureNow(o.signer, h, o.signature)) revert BadSignature();
        // For EOAs the signer must be the maker; smart wallets validate via 1271 on `signer`.
        require(o.signer == o.maker || o.signer.code.length > 0, "signer/maker mismatch");
    }

    /// @dev Price in collateral wei per share (1e18 == 1.0), regardless of side.
    function _price(Order calldata o) internal pure returns (uint256) {
        return o.side == Side.BUY
            ? (o.makerAmount * ONE) / o.takerAmount // collateral / shares
            : (o.takerAmount * ONE) / o.makerAmount; // collateral / shares
    }

    /// @dev Remaining unfilled shares for an order, derived from its making units.
    function _sharesRemaining(Order calldata o, bytes32 h) internal view returns (uint256) {
        uint256 f = filled[h];
        if (o.side == Side.BUY) {
            // making unit = collateral; total shares = takerAmount.
            if (f >= o.makerAmount) return 0;
            uint256 remCollateral = o.makerAmount - f;
            return (remCollateral * o.takerAmount) / o.makerAmount;
        } else {
            // making unit = shares; total shares = makerAmount.
            return f >= o.makerAmount ? 0 : o.makerAmount - f;
        }
    }

    function _consumeBuy(Order calldata o, bytes32 h, uint256 collateralSpent, uint256 shares) internal {
        uint256 nf = filled[h] + collateralSpent;
        if (nf > o.makerAmount) revert Overfill();
        filled[h] = nf;
        emit OrderFilled(h, o.maker, o.tokenId, collateralSpent, shares);
    }

    function _consumeSell(Order calldata o, bytes32 h, uint256 shares, uint256 collateralGot) internal {
        uint256 nf = filled[h] + shares;
        if (nf > o.makerAmount) revert Overfill();
        filled[h] = nf;
        emit OrderFilled(h, o.maker, o.tokenId, shares, collateralGot);
    }

    function _areComplements(uint256 a, uint256 b) internal view returns (bool) {
        return tokens[a].registered && tokens[a].complement == b;
    }

    function _min(uint256 a, uint256 b) internal pure returns (uint256) {
        return a < b ? a : b;
    }
}
