// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

/**
 * @title CTHelpers
 * @notice Pure id-derivation helpers for the binary Conditional Tokens system.
 *         Mirrors the Gnosis Conditional Tokens Framework semantics but is
 *         specialised to exactly two outcome slots (NO = slot 0, YES = slot 1).
 *
 *  conditionId  = keccak256(oracle, questionId, 2)
 *  collectionId = keccak256(conditionId, indexSet)   // indexSet is a 2-bit mask
 *  positionId   = uint256(keccak256(collateral, collectionId))
 */
library CTHelpers {
    uint256 internal constant OUTCOME_SLOT_COUNT = 2;

    /// @dev indexSet for the NO slot (bit 0).
    uint256 internal constant INDEX_SET_NO = 1;
    /// @dev indexSet for the YES slot (bit 1).
    uint256 internal constant INDEX_SET_YES = 2;

    function getConditionId(address oracle, bytes32 questionId) internal pure returns (bytes32) {
        return keccak256(abi.encodePacked(oracle, questionId, OUTCOME_SLOT_COUNT));
    }

    function getCollectionId(bytes32 conditionId, uint256 indexSet) internal pure returns (bytes32) {
        return keccak256(abi.encodePacked(conditionId, indexSet));
    }

    function getPositionId(address collateral, bytes32 collectionId) internal pure returns (uint256) {
        return uint256(keccak256(abi.encodePacked(collateral, collectionId)));
    }

    /// @notice Convenience: the (noPositionId, yesPositionId) pair for a condition.
    function getOutcomePositionIds(address collateral, bytes32 conditionId)
        internal
        pure
        returns (uint256 noPositionId, uint256 yesPositionId)
    {
        noPositionId =
            getPositionId(collateral, getCollectionId(conditionId, INDEX_SET_NO));
        yesPositionId =
            getPositionId(collateral, getCollectionId(conditionId, INDEX_SET_YES));
    }
}
