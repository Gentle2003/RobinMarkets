// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import { Script } from "forge-std/Script.sol";
import { console2 } from "forge-std/console2.sol";
import { ConditionalTokens } from "../src/tokens/ConditionalTokens.sol";
import { CTFExchange } from "../src/exchange/CTFExchange.sol";
import { Resolver } from "../src/resolution/Resolver.sol";
import { MarketFactory, Sector } from "../src/markets/MarketFactory.sol";
import { WrappedETH } from "../src/collateral/WrappedETH.sol";
import { MockAggregator } from "../src/mocks/MockAggregator.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @notice Deploys the RobinMarkets protocol and seeds a few demo Stock/RWA
 *         markets. Writes deployed addresses to deployments/<chainId>.json.
 *
 *   forge script script/Deploy.s.sol --rpc-url anvil --broadcast
 *   forge script script/Deploy.s.sol --rpc-url rh_testnet --broadcast
 */
contract Deploy is Script {
    function run() external {
        uint256 pk = vm.envUint("DEPLOYER_PRIVATE_KEY");
        vm.startBroadcast(pk);

        WrappedETH weth = new WrappedETH();
        ConditionalTokens ctf = new ConditionalTokens();
        CTFExchange exchange = new CTFExchange(ctf);
        Resolver resolver = new Resolver(ctf);
        MarketFactory factory = new MarketFactory(ctf, exchange, resolver);

        exchange.setRegistrar(address(factory), true);
        resolver.setRegistrar(address(factory), true);

        // Demo Chainlink-style feeds (replace with real feed addresses on mainnet).
        MockAggregator aapl = new MockAggregator(8, int256(240e8), "AAPL/USD");
        MockAggregator tbill = new MockAggregator(8, int256(43e7), "US1Y/YIELD");

        _seedMarket(
            factory,
            Sector.STOCKS,
            "AAPL",
            "Will AAPL close above $250 by 2026-12-31?",
            IERC20(address(weth)),
            address(aapl),
            int256(250e8),
            true
        );
        _seedMarket(
            factory,
            Sector.RWA,
            "US-TBILL",
            "Will the 1Y T-bill yield exceed 4.5% by 2026-12-31?",
            IERC20(address(weth)),
            address(tbill),
            int256(45e7),
            true
        );

        vm.stopBroadcast();

        _writeDeployment(weth, ctf, exchange, resolver, factory);

        console2.log("WrappedETH        ", address(weth));
        console2.log("ConditionalTokens ", address(ctf));
        console2.log("CTFExchange       ", address(exchange));
        console2.log("Resolver          ", address(resolver));
        console2.log("MarketFactory     ", address(factory));
    }

    function _seedMarket(
        MarketFactory factory,
        Sector sector,
        string memory underlying,
        string memory question,
        IERC20 collateral,
        address feed,
        int256 threshold,
        bool greaterIsYes
    ) internal {
        factory.createMarket(
            MarketFactory.CreateParams({
                sector: sector,
                underlying: underlying,
                question: question,
                collateral: collateral,
                closeTime: uint64(block.timestamp + 180 days),
                resolveTime: uint64(block.timestamp + 181 days),
                feed: feed,
                threshold: threshold,
                greaterIsYes: greaterIsYes
            })
        );
    }

    function _writeDeployment(
        WrappedETH weth,
        ConditionalTokens ctf,
        CTFExchange exchange,
        Resolver resolver,
        MarketFactory factory
    ) internal {
        string memory obj = "deployment";
        vm.serializeAddress(obj, "collateral", address(weth));
        vm.serializeAddress(obj, "conditionalTokens", address(ctf));
        vm.serializeAddress(obj, "ctfExchange", address(exchange));
        vm.serializeAddress(obj, "resolver", address(resolver));
        string memory json = vm.serializeAddress(obj, "marketFactory", address(factory));
        string memory path = string.concat("deployments/", vm.toString(block.chainid), ".json");
        vm.writeJson(json, path);
    }
}
