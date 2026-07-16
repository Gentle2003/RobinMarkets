// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import { IAggregatorV3 } from "../resolution/IAggregatorV3.sol";

/// @notice Settable Chainlink-style price feed for tests and testnet resolution demos.
contract MockAggregator is IAggregatorV3 {
    uint8 public immutable override decimals;
    string public override description;
    int256 private _answer;
    uint80 private _round;

    constructor(uint8 decimals_, int256 initialAnswer, string memory desc) {
        decimals = decimals_;
        _answer = initialAnswer;
        description = desc;
        _round = 1;
    }

    function setAnswer(int256 answer) external {
        _answer = answer;
        _round++;
    }

    function latestRoundData()
        external
        view
        override
        returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound)
    {
        return (_round, _answer, block.timestamp, block.timestamp, _round);
    }
}
