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
 * @notice Deploys the RobinMarkets protocol and seeds a broad set of demo Stock
 *         and RWA markets. Writes deployed addresses to deployments/<chainId>.json.
 *
 *   forge script script/Deploy.s.sol --rpc-url anvil --broadcast
 *   forge script script/Deploy.s.sol --rpc-url rh_testnet --broadcast
 */
contract Deploy is Script {
    MarketFactory factory;
    IERC20 weth;

    function run() external {
        uint256 pk = vm.envUint("DEPLOYER_PRIVATE_KEY");
        vm.startBroadcast(pk);

        WrappedETH _weth = new WrappedETH();
        weth = IERC20(address(_weth));
        ConditionalTokens ctf = new ConditionalTokens();
        CTFExchange exchange = new CTFExchange(ctf);
        Resolver resolver = new Resolver(ctf);
        factory = new MarketFactory(ctf, exchange, resolver);

        exchange.setRegistrar(address(factory), true);
        resolver.setRegistrar(address(factory), true);

        // ── Stocks ────────────────────────────────────────────────────────────
        _seed(Sector.STOCKS, "AAPL", "Will Apple close above $250 by 2026-12-31?", 8, 240e8, 250e8);
        _seed(Sector.STOCKS, "NVDA", "Will Nvidia close above $200 by 2026-12-31?", 8, 182e8, 200e8);
        _seed(Sector.STOCKS, "TSLA", "Will Tesla close above $400 by 2026-12-31?", 8, 355e8, 400e8);
        _seed(Sector.STOCKS, "GOOGL", "Will Alphabet close above $220 by 2026-12-31?", 8, 205e8, 220e8);
        _seed(Sector.STOCKS, "MSFT", "Will Microsoft close above $520 by 2026-12-31?", 8, 498e8, 520e8);
        _seed(Sector.STOCKS, "AMZN", "Will Amazon close above $260 by 2026-12-31?", 8, 238e8, 260e8);
        _seed(Sector.STOCKS, "META", "Will Meta close above $800 by 2026-12-31?", 8, 742e8, 800e8);
        _seed(Sector.STOCKS, "COIN", "Will Coinbase close above $400 by 2026-12-31?", 8, 312e8, 400e8);
        _seed(Sector.STOCKS, "SPY", "Will the S&P 500 ETF (SPY) close above $700 by 2026-12-31?", 8, 662e8, 700e8);

        // ── Real-World Assets ──────────────────────────────────────────────────
        _seed(Sector.RWA, "US-TBILL", "Will the 1Y T-bill yield exceed 4.5% by 2026-12-31?", 8, 43e7, 45e7);
        _seed(Sector.RWA, "GOLD", "Will gold close above $3,000/oz by 2026-12-31?", 8, 2870e8, 3000e8);
        _seed(Sector.RWA, "SILVER", "Will silver close above $40/oz by 2026-12-31?", 8, 36e8, 40e8);
        _seed(Sector.RWA, "WTI", "Will WTI crude close above $80/bbl by 2026-12-31?", 8, 72e8, 80e8);
        _seed(Sector.RWA, "REIT", "Will the US REIT index gain 10% by 2026-12-31?", 8, 104e8, 110e8);
        _seed(Sector.RWA, "HOUSING", "Will the Case-Shiller Home Price Index rise 5% by 2026-12-31?", 8, 322e8, 330e8);

        vm.stopBroadcast();

        _writeDeployment(_weth, ctf, exchange, resolver, factory);

        console2.log("WrappedETH        ", address(_weth));
        console2.log("ConditionalTokens ", address(ctf));
        console2.log("CTFExchange       ", address(exchange));
        console2.log("Resolver          ", address(resolver));
        console2.log("MarketFactory     ", address(factory));
        console2.log("Markets seeded    ", factory.marketCount());
    }

    function _seed(
        Sector sector,
        string memory underlying,
        string memory question,
        uint8 decimals,
        int256 initialAnswer,
        int256 threshold
    ) internal {
        MockAggregator feed = new MockAggregator(decimals, initialAnswer, underlying);
        factory.createMarket(
            MarketFactory.CreateParams({
                sector: sector,
                underlying: underlying,
                question: question,
                collateral: weth,
                closeTime: uint64(block.timestamp + 180 days),
                resolveTime: uint64(block.timestamp + 181 days),
                feed: address(feed),
                threshold: threshold,
                greaterIsYes: true
            })
        );
    }

    function _writeDeployment(
        WrappedETH _weth,
        ConditionalTokens ctf,
        CTFExchange exchange,
        Resolver resolver,
        MarketFactory _factory
    ) internal {
        string memory obj = "deployment";
        vm.serializeAddress(obj, "collateral", address(_weth));
        vm.serializeAddress(obj, "conditionalTokens", address(ctf));
        vm.serializeAddress(obj, "ctfExchange", address(exchange));
        vm.serializeAddress(obj, "resolver", address(resolver));
        string memory json = vm.serializeAddress(obj, "marketFactory", address(_factory));
        string memory path = string.concat("deployments/", vm.toString(block.chainid), ".json");
        vm.writeJson(json, path);
    }
}
