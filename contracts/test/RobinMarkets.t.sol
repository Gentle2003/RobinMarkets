// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import { Test } from "forge-std/Test.sol";
import { ConditionalTokens } from "../src/tokens/ConditionalTokens.sol";
import { CTFExchange } from "../src/exchange/CTFExchange.sol";
import { Resolver } from "../src/resolution/Resolver.sol";
import { MarketFactory, Sector } from "../src/markets/MarketFactory.sol";
import { MockStockToken } from "../src/mocks/MockStockToken.sol";
import { MockAggregator } from "../src/mocks/MockAggregator.sol";
import { Order, Side } from "../src/exchange/Order.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract RobinMarketsTest is Test {
    ConditionalTokens ctf;
    CTFExchange exchange;
    Resolver resolver;
    MarketFactory factory;
    MockStockToken collateral; // stands in for wrapped Robinhood ETH

    uint256 constant ONE = 1e18;
    uint256 constant SHARES = 100e18;

    // actors
    uint256 pkAlice = 0xA11CE;
    uint256 pkBob = 0xB0B;
    address alice = vm.addr(0xA11CE);
    address bob = vm.addr(0xB0B);

    // current market
    bytes32 conditionId;
    bytes32 questionId;
    uint256 yesId;
    uint256 noId;

    function setUp() public {
        ctf = new ConditionalTokens();
        exchange = new CTFExchange(ctf);
        resolver = new Resolver(ctf);
        factory = new MarketFactory(ctf, exchange, resolver);

        exchange.setRegistrar(address(factory), true);
        resolver.setRegistrar(address(factory), true);

        collateral = new MockStockToken("Wrapped ETH", "WETH", 18);

        _createAdminMarket();
        _fund(alice);
        _fund(bob);
    }

    // ─── helpers ─────────────────────────────────────────────────────────────

    function _createAdminMarket() internal {
        MarketFactory.CreateParams memory p = MarketFactory.CreateParams({
            sector: Sector.STOCKS,
            underlying: "AAPL",
            question: "Will AAPL close above $250 on 2026-12-31?",
            collateral: IERC20(address(collateral)),
            closeTime: uint64(block.timestamp + 30 days),
            resolveTime: uint64(block.timestamp + 31 days),
            feed: address(0),
            threshold: 0,
            greaterIsYes: true
        });
        (conditionId, yesId, noId) = factory.createMarket(p);
        questionId = factory.getMarket(conditionId).questionId;
    }

    function _fund(address who) internal {
        collateral.mint(who, 1_000e18);
        vm.startPrank(who);
        collateral.approve(address(ctf), type(uint256).max);
        collateral.approve(address(exchange), type(uint256).max);
        ctf.setApprovalForAll(address(exchange), true);
        vm.stopPrank();
    }

    /// @dev Split `amount` collateral into a YES+NO set for `who`.
    function _split(address who, uint256 amount) internal {
        vm.prank(who);
        ctf.splitPosition(IERC20(address(collateral)), conditionId, amount);
    }

    function _buyOrder(uint256 pk, uint256 tokenId, uint256 price, uint256 shares)
        internal
        view
        returns (Order memory o)
    {
        o = Order({
            salt: uint256(keccak256(abi.encode(pk, tokenId, price, shares, "buy"))),
            maker: vm.addr(pk),
            signer: vm.addr(pk),
            tokenId: tokenId,
            makerAmount: (shares * price) / ONE, // collateral in
            takerAmount: shares, // shares out
            expiration: 0,
            nonce: 0,
            side: Side.BUY,
            signature: ""
        });
        o.signature = _sign(pk, o);
    }

    function _sellOrder(uint256 pk, uint256 tokenId, uint256 price, uint256 shares)
        internal
        view
        returns (Order memory o)
    {
        o = Order({
            salt: uint256(keccak256(abi.encode(pk, tokenId, price, shares, "sell"))),
            maker: vm.addr(pk),
            signer: vm.addr(pk),
            tokenId: tokenId,
            makerAmount: shares, // shares in
            takerAmount: (shares * price) / ONE, // collateral out
            expiration: 0,
            nonce: 0,
            side: Side.SELL,
            signature: ""
        });
        o.signature = _sign(pk, o);
    }

    function _sign(uint256 pk, Order memory o) internal view returns (bytes memory) {
        bytes32 digest = exchange.hashOrder(o);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(pk, digest);
        return abi.encodePacked(r, s, v);
    }

    // ─── ConditionalTokens core ──────────────────────────────────────────────

    function test_SplitAndMerge() public {
        _split(alice, 100e18);
        assertEq(ctf.balanceOf(alice, yesId), 100e18, "yes minted");
        assertEq(ctf.balanceOf(alice, noId), 100e18, "no minted");

        uint256 balBefore = collateral.balanceOf(alice);
        vm.prank(alice);
        ctf.mergePositions(IERC20(address(collateral)), conditionId, 40e18);
        assertEq(ctf.balanceOf(alice, yesId), 60e18, "yes after merge");
        assertEq(collateral.balanceOf(alice), balBefore + 40e18, "collateral returned");
    }

    // ─── NORMAL match: BUY vs SELL of same token ─────────────────────────────

    function test_NormalMatch() public {
        // Bob mints a set and sells YES @ 0.60; Alice buys YES @ 0.60.
        _split(bob, SHARES);
        Order memory sell = _sellOrder(pkBob, yesId, 0.60e18, SHARES);
        Order memory buy = _buyOrder(pkAlice, yesId, 0.60e18, SHARES);

        uint256 bobColBefore = collateral.balanceOf(bob);
        uint256 aliceColBefore = collateral.balanceOf(alice);

        // taker = Alice's buy, maker = Bob's resting sell.
        exchange.matchOrders(buy, sell, SHARES);

        assertEq(ctf.balanceOf(alice, yesId), SHARES, "alice got YES");
        assertEq(ctf.balanceOf(bob, yesId), 0, "bob sold all YES");
        assertEq(collateral.balanceOf(bob), bobColBefore + 60e18, "bob paid 60");
        assertEq(collateral.balanceOf(alice), aliceColBefore - 60e18, "alice paid 60");
    }

    function test_NormalMatch_ExecutesAtRestingPrice() public {
        // Bob rests a SELL @ 0.50; Alice crosses with a BUY willing to pay 0.70.
        _split(bob, SHARES);
        Order memory sell = _sellOrder(pkBob, yesId, 0.50e18, SHARES);
        Order memory buy = _buyOrder(pkAlice, yesId, 0.70e18, SHARES);

        uint256 aliceColBefore = collateral.balanceOf(alice);
        exchange.matchOrders(buy, sell, SHARES);

        // Alice pays the resting 0.50, not her 0.70 limit.
        assertEq(collateral.balanceOf(alice), aliceColBefore - 50e18, "alice paid resting price");
        assertEq(ctf.balanceOf(alice, yesId), SHARES, "alice got shares");
    }

    // ─── MINT match: two complementary BUYs fund a full set ──────────────────

    function test_MintMatch() public {
        Order memory buyYes = _buyOrder(pkAlice, yesId, 0.60e18, SHARES);
        Order memory buyNo = _buyOrder(pkBob, noId, 0.50e18, SHARES); // 0.60 + 0.50 >= 1

        uint256 aliceBefore = collateral.balanceOf(alice);
        uint256 bobBefore = collateral.balanceOf(bob);

        exchange.matchOrders(buyYes, buyNo, SHARES);

        assertEq(ctf.balanceOf(alice, yesId), SHARES, "alice got YES");
        assertEq(ctf.balanceOf(bob, noId), SHARES, "bob got NO");
        assertEq(collateral.balanceOf(alice), aliceBefore - 60e18, "alice paid her 0.60 limit");
        // full set costs 100; alice paid 60, bob covers 40 (within his 0.50 limit).
        assertEq(collateral.balanceOf(bob), bobBefore - 40e18, "bob paid remainder");
    }

    // ─── MERGE match: two complementary SELLs redeem a full set ──────────────

    function test_MergeMatch() public {
        _split(alice, SHARES); // Alice holds YES to sell
        _split(bob, SHARES); // Bob holds NO to sell

        Order memory sellYes = _sellOrder(pkAlice, yesId, 0.60e18, SHARES);
        Order memory sellNo = _sellOrder(pkBob, noId, 0.30e18, SHARES); // 0.60 + 0.30 <= 1

        uint256 aliceBefore = collateral.balanceOf(alice);
        uint256 bobBefore = collateral.balanceOf(bob);

        exchange.matchOrders(sellYes, sellNo, SHARES);

        assertEq(ctf.balanceOf(alice, yesId), 0, "alice sold YES");
        assertEq(ctf.balanceOf(bob, noId), 0, "bob sold NO");
        assertEq(collateral.balanceOf(alice), aliceBefore + 60e18, "alice got her 0.60 ask");
        assertEq(collateral.balanceOf(bob), bobBefore + 40e18, "bob got remainder (>= 0.30 ask)");
    }

    // ─── Order lifecycle guards ──────────────────────────────────────────────

    function test_RevertWhen_NotCrossing() public {
        _split(bob, SHARES);
        Order memory sell = _sellOrder(pkBob, yesId, 0.70e18, SHARES);
        Order memory buy = _buyOrder(pkAlice, yesId, 0.60e18, SHARES); // below ask
        vm.expectRevert(CTFExchange.NotCrossing.selector);
        exchange.matchOrders(buy, sell, SHARES);
    }

    function test_RevertWhen_Cancelled() public {
        _split(bob, SHARES);
        Order memory sell = _sellOrder(pkBob, yesId, 0.60e18, SHARES);
        Order memory buy = _buyOrder(pkAlice, yesId, 0.60e18, SHARES);
        vm.prank(bob);
        exchange.cancelOrder(sell);
        vm.expectRevert(CTFExchange.OrderCancelledErr.selector);
        exchange.matchOrders(buy, sell, SHARES);
    }

    function test_IncrementNonceInvalidatesOrders() public {
        _split(bob, SHARES);
        Order memory sell = _sellOrder(pkBob, yesId, 0.60e18, SHARES);
        Order memory buy = _buyOrder(pkAlice, yesId, 0.60e18, SHARES);
        vm.prank(bob);
        exchange.incrementNonce();
        vm.expectRevert(CTFExchange.BadNonce.selector);
        exchange.matchOrders(buy, sell, SHARES);
    }

    // ─── Resolution + redemption ─────────────────────────────────────────────

    function test_AdminResolveThenRedeem() public {
        // Alice ends up holding YES; market resolves YES; she redeems 1:1.
        _split(alice, SHARES); // Alice holds 100 YES + 100 NO
        // Resolve YES via admin (owner == this test contract).
        resolver.adminResolve(questionId, true);

        uint256 before = collateral.balanceOf(alice);
        vm.prank(alice);
        ctf.redeemPositions(IERC20(address(collateral)), conditionId);
        // Alice held 100 YES + 100 NO; YES pays 100, NO pays 0.
        assertEq(collateral.balanceOf(alice), before + 100e18, "redeemed YES 1:1");
        assertEq(ctf.balanceOf(alice, yesId), 0, "YES burned");
        assertEq(ctf.balanceOf(alice, noId), 0, "NO burned");
    }

    function test_FeedResolution() public {
        // New market resolved by a Chainlink-style feed.
        MockAggregator feed = new MockAggregator(8, 0, "AAPL/USD");
        MarketFactory.CreateParams memory p = MarketFactory.CreateParams({
            sector: Sector.STOCKS,
            underlying: "AAPL",
            question: "AAPL > $250?",
            collateral: IERC20(address(collateral)),
            closeTime: uint64(block.timestamp + 1 days),
            resolveTime: uint64(block.timestamp + 2 days),
            feed: address(feed),
            threshold: int256(250e8), // $250 at 8 decimals
            greaterIsYes: true
        });
        (bytes32 cid, uint256 yes2,) = factory.createMarket(p);
        bytes32 qid = factory.getMarket(cid).questionId;

        // Give Alice YES shares in this market.
        vm.prank(alice);
        ctf.splitPosition(IERC20(address(collateral)), cid, SHARES);

        feed.setAnswer(int256(260e8)); // $260 > $250 => YES
        vm.warp(block.timestamp + 3 days);
        resolver.resolveByFeed(qid);

        uint256 before = collateral.balanceOf(alice);
        vm.prank(alice);
        ctf.redeemPositions(IERC20(address(collateral)), cid);
        assertEq(collateral.balanceOf(alice), before + 100e18, "YES paid out from feed resolution");
        assertGt(yes2, 0);
    }

    function test_RevertWhen_FeedResolveTooEarly() public {
        MockAggregator feed = new MockAggregator(8, int256(260e8), "AAPL/USD");
        MarketFactory.CreateParams memory p = MarketFactory.CreateParams({
            sector: Sector.RWA,
            underlying: "US-TBILL",
            question: "yield > 4%?",
            collateral: IERC20(address(collateral)),
            closeTime: uint64(block.timestamp + 1 days),
            resolveTime: uint64(block.timestamp + 2 days),
            feed: address(feed),
            threshold: int256(4e8),
            greaterIsYes: true
        });
        (bytes32 cid,,) = factory.createMarket(p);
        bytes32 qid = factory.getMarket(cid).questionId;
        vm.expectRevert(Resolver.TooEarly.selector);
        resolver.resolveByFeed(qid);
    }
}
