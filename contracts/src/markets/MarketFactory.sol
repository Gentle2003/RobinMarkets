// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { ConditionalTokens } from "../tokens/ConditionalTokens.sol";
import { CTHelpers } from "../tokens/CTHelpers.sol";
import { CTFExchange } from "../exchange/CTFExchange.sol";
import { Resolver } from "../resolution/Resolver.sol";

/// @notice RobinMarkets is scoped to two sectors only.
enum Sector {
    STOCKS,
    RWA
}

/**
 * @title MarketFactory
 * @notice Creates binary Stock/RWA prediction markets. Each market prepares a
 *         condition on the ConditionalTokens contract (oracle = Resolver),
 *         registers its YES/NO token pair with the CTFExchange for trading, and
 *         configures the Resolver's settlement rule.
 */
contract MarketFactory is Ownable {
    ConditionalTokens public immutable ctf;
    CTFExchange public immutable exchange;
    Resolver public immutable resolver;

    struct Market {
        bytes32 questionId;
        bytes32 conditionId;
        Sector sector;
        string underlying; // e.g. "AAPL", "US-TBILL"
        string question; // human-readable market question
        IERC20 collateral;
        uint256 yesTokenId;
        uint256 noTokenId;
        uint64 closeTime; // trading halts
        uint64 resolveTime; // resolution allowed
        bool exists;
    }

    /// @dev conditionId => market.
    mapping(bytes32 => Market) public markets;
    bytes32[] public marketIds;
    uint256 public marketCount;

    event MarketCreated(
        bytes32 indexed conditionId,
        bytes32 indexed questionId,
        Sector sector,
        string underlying,
        string question,
        address collateral,
        uint256 yesTokenId,
        uint256 noTokenId,
        uint64 closeTime,
        uint64 resolveTime
    );

    constructor(ConditionalTokens _ctf, CTFExchange _exchange, Resolver _resolver) Ownable(msg.sender) {
        ctf = _ctf;
        exchange = _exchange;
        resolver = _resolver;
    }

    struct CreateParams {
        Sector sector;
        string underlying;
        string question;
        IERC20 collateral;
        uint64 closeTime;
        uint64 resolveTime;
        // resolution config (feed == address(0) => admin-resolved)
        address feed;
        int256 threshold;
        bool greaterIsYes;
    }

    function createMarket(CreateParams calldata p) external onlyOwner returns (bytes32 conditionId, uint256 yesId, uint256 noId) {
        bytes32 questionId = keccak256(
            abi.encode(p.underlying, p.question, p.closeTime, p.resolveTime, marketCount)
        );

        conditionId = ctf.prepareCondition(address(resolver), questionId);
        (noId, yesId) = CTHelpers.getOutcomePositionIds(address(p.collateral), conditionId);

        exchange.registerToken(yesId, noId, conditionId, p.collateral);
        resolver.registerQuestion(questionId, p.feed, p.threshold, p.greaterIsYes, p.resolveTime);

        markets[conditionId] = Market({
            questionId: questionId,
            conditionId: conditionId,
            sector: p.sector,
            underlying: p.underlying,
            question: p.question,
            collateral: p.collateral,
            yesTokenId: yesId,
            noTokenId: noId,
            closeTime: p.closeTime,
            resolveTime: p.resolveTime,
            exists: true
        });
        marketIds.push(conditionId);
        marketCount++;

        emit MarketCreated(
            conditionId,
            questionId,
            p.sector,
            p.underlying,
            p.question,
            address(p.collateral),
            yesId,
            noId,
            p.closeTime,
            p.resolveTime
        );
    }

    function getMarket(bytes32 conditionId) external view returns (Market memory) {
        return markets[conditionId];
    }

    function allMarketIds() external view returns (bytes32[] memory) {
        return marketIds;
    }
}
