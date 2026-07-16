// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { ConditionalTokens } from "../tokens/ConditionalTokens.sol";
import { IAggregatorV3 } from "./IAggregatorV3.sol";

/**
 * @title Resolver
 * @notice The oracle of record for every RobinMarkets question. It resolves a
 *         binary question in one of two ways:
 *           1. Chainlink feed: after `resolveTime`, compare the feed's latest
 *              answer to `threshold` (YES if `greaterIsYes` matches the compare).
 *           2. Admin override: the owner reports an outcome directly (for markets
 *              without a suitable feed, or to correct a disputed feed result).
 * @dev Since {ConditionalTokens.reportPayouts} keys the condition off msg.sender,
 *      THIS contract's address is the oracle used when preparing conditions.
 */
contract Resolver is Ownable {
    ConditionalTokens public immutable ctf;

    struct Question {
        bool exists;
        bool resolved;
        IAggregatorV3 feed; // address(0) == admin-resolved only
        int256 threshold; // in the feed's own decimals
        bool greaterIsYes; // YES when answer > threshold (else YES when answer < threshold)
        uint64 resolveTime; // earliest unix time a feed resolution is allowed
    }

    /// @dev questionId => configuration.
    mapping(bytes32 => Question) public questions;
    /// @dev addresses allowed to register questions (the MarketFactory).
    mapping(address => bool) public registrars;

    event RegistrarSet(address indexed who, bool allowed);
    event QuestionRegistered(bytes32 indexed questionId, address feed, int256 threshold, bool greaterIsYes, uint64 resolveTime);
    event QuestionResolved(bytes32 indexed questionId, bool yes, int256 observed);

    error NotRegistrar();
    error UnknownQuestion();
    error AlreadyResolved();
    error TooEarly();
    error NoFeed();

    constructor(ConditionalTokens _ctf) Ownable(msg.sender) {
        ctf = _ctf;
    }

    function setRegistrar(address who, bool allowed) external onlyOwner {
        registrars[who] = allowed;
        emit RegistrarSet(who, allowed);
    }

    function registerQuestion(
        bytes32 questionId,
        address feed,
        int256 threshold,
        bool greaterIsYes,
        uint64 resolveTime
    ) external {
        if (!registrars[msg.sender] && msg.sender != owner()) revert NotRegistrar();
        require(!questions[questionId].exists, "already registered");
        questions[questionId] = Question({
            exists: true,
            resolved: false,
            feed: IAggregatorV3(feed),
            threshold: threshold,
            greaterIsYes: greaterIsYes,
            resolveTime: resolveTime
        });
        emit QuestionRegistered(questionId, feed, threshold, greaterIsYes, resolveTime);
    }

    /// @notice Permissionlessly resolve a feed-backed question once its time has passed.
    function resolveByFeed(bytes32 questionId) external {
        Question storage q = questions[questionId];
        if (!q.exists) revert UnknownQuestion();
        if (q.resolved) revert AlreadyResolved();
        if (address(q.feed) == address(0)) revert NoFeed();
        if (block.timestamp < q.resolveTime) revert TooEarly();

        (, int256 answer,,,) = q.feed.latestRoundData();
        bool aboveThreshold = answer > q.threshold;
        bool yes = q.greaterIsYes ? aboveThreshold : !aboveThreshold;
        _report(questionId, q, yes, answer);
    }

    /// @notice Owner resolves a question manually (admin markets or dispute correction).
    function adminResolve(bytes32 questionId, bool yes) external onlyOwner {
        Question storage q = questions[questionId];
        if (!q.exists) revert UnknownQuestion();
        if (q.resolved) revert AlreadyResolved();
        _report(questionId, q, yes, 0);
    }

    function _report(bytes32 questionId, Question storage q, bool yes, int256 observed) internal {
        q.resolved = true;
        // payouts = [NO, YES]
        uint256[2] memory payouts = yes ? [uint256(0), uint256(1)] : [uint256(1), uint256(0)];
        ctf.reportPayouts(questionId, payouts);
        emit QuestionResolved(questionId, yes, observed);
    }
}
