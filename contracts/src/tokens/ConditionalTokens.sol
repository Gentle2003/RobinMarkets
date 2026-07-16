// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import { ERC1155 } from "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { CTHelpers } from "./CTHelpers.sol";

/**
 * @title ConditionalTokens
 * @notice Binary conditional-token system backing every RobinMarkets question.
 *         Splitting collateral mints a matching amount of YES and NO ERC-1155
 *         outcome tokens; merging burns them back into collateral; after the
 *         oracle reports, holders of the winning outcome redeem 1:1.
 * @dev Specialised, audited-in-spirit reimplementation of the Gnosis CTF for two
 *      outcome slots. NOT audited — do not use with real funds.
 */
contract ConditionalTokens is ERC1155 {
    using SafeERC20 for IERC20;

    /// @dev conditionId => payout numerator per slot [NO, YES]. Zero denominator == unresolved.
    mapping(bytes32 => uint256[2]) public payoutNumerators;
    mapping(bytes32 => uint256) public payoutDenominator;

    event ConditionPreparation(
        bytes32 indexed conditionId, address indexed oracle, bytes32 indexed questionId
    );
    event ConditionResolution(
        bytes32 indexed conditionId,
        address indexed oracle,
        bytes32 indexed questionId,
        uint256[2] payoutNumerators
    );
    event PositionSplit(
        address indexed stakeholder,
        IERC20 collateral,
        bytes32 indexed conditionId,
        uint256 amount
    );
    event PositionsMerge(
        address indexed stakeholder,
        IERC20 collateral,
        bytes32 indexed conditionId,
        uint256 amount
    );
    event PayoutRedemption(
        address indexed redeemer,
        IERC20 indexed collateral,
        bytes32 indexed conditionId,
        uint256 payout
    );

    constructor() ERC1155("") { }

    /// @notice Register a new condition. `oracle` is the only address allowed to report it.
    function prepareCondition(address oracle, bytes32 questionId) external returns (bytes32 conditionId) {
        conditionId = CTHelpers.getConditionId(oracle, questionId);
        require(payoutDenominator[conditionId] == 0, "CT: condition already prepared");
        // Mark as prepared without resolving: denominator stays 0 until reportPayouts.
        emit ConditionPreparation(conditionId, oracle, questionId);
    }

    /// @notice Lock `amount` collateral and mint `amount` of both YES and NO tokens to caller.
    function splitPosition(IERC20 collateral, bytes32 conditionId, uint256 amount) external {
        require(amount > 0, "CT: zero amount");
        collateral.safeTransferFrom(msg.sender, address(this), amount);

        (uint256 noId, uint256 yesId) =
            CTHelpers.getOutcomePositionIds(address(collateral), conditionId);
        _mint(msg.sender, noId, amount, "");
        _mint(msg.sender, yesId, amount, "");

        emit PositionSplit(msg.sender, collateral, conditionId, amount);
    }

    /// @notice Burn `amount` of both outcome tokens and return `amount` collateral.
    function mergePositions(IERC20 collateral, bytes32 conditionId, uint256 amount) external {
        require(amount > 0, "CT: zero amount");
        (uint256 noId, uint256 yesId) =
            CTHelpers.getOutcomePositionIds(address(collateral), conditionId);
        _burn(msg.sender, noId, amount);
        _burn(msg.sender, yesId, amount);

        collateral.safeTransfer(msg.sender, amount);
        emit PositionsMerge(msg.sender, collateral, conditionId, amount);
    }

    /// @notice Oracle reports the outcome. `payouts` is [noPayout, yesPayout]; e.g. [0,1] == YES.
    function reportPayouts(bytes32 questionId, uint256[2] calldata payouts) external {
        bytes32 conditionId = CTHelpers.getConditionId(msg.sender, questionId);
        uint256 denominator = payouts[0] + payouts[1];
        require(denominator > 0, "CT: payouts all zero");
        require(payoutDenominator[conditionId] == 0, "CT: already resolved");

        payoutNumerators[conditionId] = payouts;
        payoutDenominator[conditionId] = denominator;
        emit ConditionResolution(conditionId, msg.sender, questionId, payouts);
    }

    /// @notice Burn resolved outcome tokens for the caller and pay out collateral pro-rata.
    function redeemPositions(IERC20 collateral, bytes32 conditionId) external {
        uint256 denominator = payoutDenominator[conditionId];
        require(denominator > 0, "CT: not resolved");

        (uint256 noId, uint256 yesId) =
            CTHelpers.getOutcomePositionIds(address(collateral), conditionId);
        uint256[2] memory numerators = payoutNumerators[conditionId];

        uint256 payout;
        uint256 noBalance = balanceOf(msg.sender, noId);
        if (noBalance > 0) {
            payout += (noBalance * numerators[0]) / denominator;
            _burn(msg.sender, noId, noBalance);
        }
        uint256 yesBalance = balanceOf(msg.sender, yesId);
        if (yesBalance > 0) {
            payout += (yesBalance * numerators[1]) / denominator;
            _burn(msg.sender, yesId, yesBalance);
        }

        if (payout > 0) {
            collateral.safeTransfer(msg.sender, payout);
        }
        emit PayoutRedemption(msg.sender, collateral, conditionId, payout);
    }

    /// @notice Whether a condition has been resolved by its oracle.
    function isResolved(bytes32 conditionId) external view returns (bool) {
        return payoutDenominator[conditionId] > 0;
    }
}
