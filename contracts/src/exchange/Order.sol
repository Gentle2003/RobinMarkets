// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

/// @dev Binary side of an order against a single outcome token.
enum Side {
    BUY, // maker gives collateral, wants `tokenId` outcome shares
    SELL // maker gives `tokenId` outcome shares, wants collateral

}

/**
 * @notice An off-chain signed limit order. `makerAmount` is what the maker gives,
 *         `takerAmount` is what they want in return, so the limit price is:
 *           BUY:  makerAmount (collateral) / takerAmount (shares)
 *           SELL: takerAmount (collateral) / makerAmount (shares)
 * @dev Signed as EIP-712 typed data by `signer` (equal to `maker` for EOAs;
 *      may differ for EIP-1271 smart-contract wallets).
 */
struct Order {
    uint256 salt;
    address maker;
    address signer;
    uint256 tokenId;
    uint256 makerAmount;
    uint256 takerAmount;
    uint256 expiration; // unix seconds; 0 == no expiry
    uint256 nonce;
    Side side;
    bytes signature;
}

bytes32 constant ORDER_TYPEHASH = keccak256(
    "Order(uint256 salt,address maker,address signer,uint256 tokenId,uint256 makerAmount,uint256 takerAmount,uint256 expiration,uint256 nonce,uint8 side)"
);

function hashOrderStruct(Order memory o) pure returns (bytes32) {
    return keccak256(
        abi.encode(
            ORDER_TYPEHASH,
            o.salt,
            o.maker,
            o.signer,
            o.tokenId,
            o.makerAmount,
            o.takerAmount,
            o.expiration,
            o.nonce,
            uint8(o.side)
        )
    );
}
