import { parseEther, type Hex } from "viem";
import {
  ctfExchangeAbi,
  EIP712_DOMAIN_NAME,
  EIP712_DOMAIN_VERSION,
  erc20Abi,
  ORDER_EIP712_TYPES,
  PRICE_SCALE,
} from "@robinmarkets/shared";
import type { Config } from "./config.js";
import type { MarketsRegistry } from "./markets.js";
import type { OrderBook } from "./book.js";
import { targetCents } from "./seed.js";

/**
 * A continuously-requoting "house" market maker. The operator posts REAL, signed,
 * matchable buy orders on both outcomes of every active market, so a user buying
 * either side mints a full set against the operator (and a user selling lifts the
 * operator's bid) — all settled on-chain with real positions.
 *
 * Unlike a one-shot seed, this runs on an interval and continuously TOPS UP any
 * quote that a taker has consumed, so liquidity is (almost) always present and
 * client orders fill immediately instead of only until the first trade.
 *
 * Tunable via env:
 *   MM_SPEND_ETH   collateral backing each individual quote        (default 0.02)
 *   MM_MARKETS     how many markets to quote, newest first         (default: all active)
 *   MM_LEVELS      price-ladder depth per side, so big orders walk  (default 1)
 *   MM_SPREAD_CENTS half-spread from fair for the top level         (default 2)
 *   MM_STEP_CENTS  cents between ladder levels                      (default 2)
 *   MM_INTERVAL_MS requote cadence                                  (default 20000)
 *   MM_MAX_ETH     hard cap on total WETH the maker will commit     (default: wrap-as-needed)
 *
 * Capital is the real limit: every live quote reserves up to its collateral, and
 * the maker never commits more than the operator's WETH (payouts stay fully
 * collateralized). On a thin testnet wallet it simply quotes fewer markets.
 */

interface LiveQuote {
  hash: Hex;
  tokenId: string;
  cents: number;
}

// Leave a little native ETH unwrapped for gas on wraps/approvals/settlement.
const GAS_RESERVE = parseEther("0.003");

export async function startMarketMaker(
  config: Config,
  markets: MarketsRegistry,
  book: OrderBook
): Promise<void> {
  if (!config.walletClient || !config.operator) {
    console.log("[mm] no operator wallet configured — market maker disabled");
    return;
  }

  const spend = parseEther(process.env.MM_SPEND_ETH ?? "0.02");
  const marketCap = process.env.MM_MARKETS ? Number(process.env.MM_MARKETS) : Infinity;
  const levels = Math.max(1, Number(process.env.MM_LEVELS ?? 1));
  const spreadCents = Math.max(0, Number(process.env.MM_SPREAD_CENTS ?? 2));
  const stepCents = Math.max(1, Number(process.env.MM_STEP_CENTS ?? 2));
  const intervalMs = Math.max(5_000, Number(process.env.MM_INTERVAL_MS ?? 20_000));
  const maxEth = process.env.MM_MAX_ETH ? parseEther(process.env.MM_MAX_ETH) : undefined;

  const op = config.operator.address;
  const { publicClient, walletClient, addresses, chain } = config;
  const baseUrl = `http://127.0.0.1:${config.port}`;

  // key `${tokenId}:${level}` → the live order we posted for that slot.
  const quotes = new Map<string, LiveQuote>();
  let approved = false;
  let running = false;

  /** Collateral a still-resting buy order could yet consume, in WETH wei. */
  function remainingCollateral(hash: Hex): bigint {
    const o = book.get(hash);
    if (!o) return 0n;
    return (o.remainingShares * o.price) / PRICE_SCALE;
  }

  /** Buy-price (cents) for a given side/level, laddering away from fair. */
  function priceCents(yesFair: number, isYes: boolean, level: number): number {
    const fair = isYes ? yesFair : 100 - yesFair;
    return fair - spreadCents - level * stepCents;
  }

  async function ensureApproval(): Promise<void> {
    if (approved) return;
    const allowance = (await publicClient.readContract({
      address: addresses.collateral,
      abi: erc20Abi,
      functionName: "allowance",
      args: [op, addresses.ctfExchange],
    })) as bigint;
    if (allowance < 2n ** 200n) {
      const hash = await walletClient!.writeContract({
        account: config.operator!,
        chain,
        address: addresses.collateral,
        abi: erc20Abi,
        functionName: "approve",
        args: [addresses.ctfExchange, 2n ** 255n],
      });
      await publicClient.waitForTransactionReceipt({ hash });
      console.log("[mm] approved WETH for exchange");
    }
    approved = true;
  }

  /** Wrap native ETH → WETH so there's collateral to back new quotes. */
  async function topUpWeth(target: bigint): Promise<bigint> {
    let weth = (await publicClient.readContract({
      address: addresses.collateral,
      abi: erc20Abi,
      functionName: "balanceOf",
      args: [op],
    })) as bigint;
    if (weth >= target) return weth;

    const native = await publicClient.getBalance({ address: op });
    const spendable = native > GAS_RESERVE ? native - GAS_RESERVE : 0n;
    const wrap = min(target - weth, spendable);
    if (wrap <= 0n) return weth;

    const hash = await walletClient!.writeContract({
      account: config.operator!,
      chain,
      address: addresses.collateral,
      abi: erc20Abi,
      functionName: "deposit",
      value: wrap,
    });
    await publicClient.waitForTransactionReceipt({ hash });
    weth += wrap;
    console.log(`[mm] wrapped ${fmt(wrap)} ETH → WETH (balance ${fmt(weth)})`);
    return weth;
  }

  async function postOrder(tokenId: string, cents: number, nonce: bigint): Promise<Hex | null> {
    const order = await signBuyOrder(config, tokenId, cents, spend, nonce);
    const res = await fetch(`${baseUrl}/orders`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(order),
    });
    if (!res.ok) {
      console.log(`[mm] order rejected (${cents}c): ${await res.text()}`);
      return null;
    }
    const body = (await res.json()) as { hash: Hex };
    return body.hash;
  }

  async function cancelOrder(hash: Hex): Promise<void> {
    await fetch(`${baseUrl}/orders/${hash}`, { method: "DELETE" }).catch(() => {});
  }

  async function requote(): Promise<void> {
    if (running) return;
    running = true;
    try {
      await ensureApproval();

      // Active markets only, newest first, capped by MM_MARKETS.
      const active = markets
        .all()
        .filter((m) => m.status !== "RESOLVED")
        .reverse();
      const targets = Number.isFinite(marketCap) ? active.slice(0, marketCap) : active;

      // Desired quote slots: both sides × ladder levels, priced off fair.
      const desired = new Map<string, { tokenId: string; cents: number }>();
      for (const m of targets) {
        const yesFair = targetCents(m.id);
        for (let lvl = 0; lvl < levels; lvl++) {
          for (const [tokenId, isYes] of [
            [m.yesPositionId, true],
            [m.noPositionId, false],
          ] as const) {
            const cents = priceCents(yesFair, isYes, lvl);
            if (cents >= 2 && cents <= 98) desired.set(`${tokenId}:${lvl}`, { tokenId, cents });
          }
        }
      }

      // Drop quotes whose market resolved or fell out of the target set.
      for (const [key, q] of quotes) {
        if (!desired.has(key)) {
          if (book.get(q.hash)) await cancelOrder(q.hash);
          quotes.delete(key);
        }
      }

      // Working budget: enough to back every desired slot, capped by MM_MAX_ETH.
      const want = spend * BigInt(desired.size);
      const wethBalance = await topUpWeth(maxEth ? min(want, maxEth) : want);

      // Committed = collateral still reservable by our live quotes.
      let committed = 0n;
      for (const [key, q] of quotes) {
        const rem = remainingCollateral(q.hash);
        if (rem === 0n) quotes.delete(key);
        else committed += rem;
      }

      const nonce = (await publicClient.readContract({
        address: addresses.ctfExchange,
        abi: ctfExchangeAbi,
        functionName: "nonces",
        args: [op],
      })) as bigint;

      let posted = 0;
      let refreshed = 0;
      for (const [key, slot] of desired) {
        if (maxEth && committed >= maxEth) break;
        const existing = quotes.get(key);
        const rem = existing ? remainingCollateral(existing.hash) : 0n;
        // Healthy if ≥60% of a full quote's collateral is still resting.
        if (existing && rem * 5n >= spend * 3n) continue;

        // Reclaim a depleted quote's (small) reservation before re-posting full.
        if (existing) {
          if (book.get(existing.hash)) await cancelOrder(existing.hash);
          quotes.delete(key);
          committed -= rem;
          refreshed++;
        }

        if (wethBalance - committed < spend) continue; // out of capital this tick
        const hash = await postOrder(slot.tokenId, slot.cents, nonce);
        if (hash) {
          quotes.set(key, { hash, tokenId: slot.tokenId, cents: slot.cents });
          committed += spend;
          posted++;
        }
      }

      if (posted || refreshed) {
        console.log(
          `[mm] ${quotes.size} live quotes across ${targets.length} markets ` +
            `(+${posted} posted, ${refreshed} refreshed, ~${fmt(committed)} ETH committed)`
        );
      }
    } catch (e) {
      console.error("[mm] requote error:", (e as Error).message);
    } finally {
      running = false;
    }
  }

  console.log(
    `[mm] market maker starting — ${fmt(spend)} ETH/quote, ${levels} level(s), ` +
      `every ${intervalMs / 1000}s` +
      (Number.isFinite(marketCap) ? `, ≤${marketCap} markets` : ", all markets") +
      (maxEth ? `, ≤${fmt(maxEth)} ETH total` : "")
  );
  await requote(); // seed immediately, then keep topping up
  setInterval(requote, intervalMs);
}

async function signBuyOrder(
  config: Config,
  tokenId: string,
  cents: number,
  spend: bigint,
  nonce: bigint
) {
  const price = (BigInt(cents) * PRICE_SCALE) / 100n;
  const makerAmount = spend; // BUY: give collateral
  const takerAmount = (spend * PRICE_SCALE) / price; // shares wanted
  const salt = BigInt(Math.floor(Math.random() * 1e15));
  const maker = config.operator!.address;

  const signature = await config.walletClient!.signTypedData({
    account: config.operator!,
    domain: {
      name: EIP712_DOMAIN_NAME,
      version: EIP712_DOMAIN_VERSION,
      chainId: config.chainId,
      verifyingContract: config.addresses.ctfExchange,
    },
    types: ORDER_EIP712_TYPES,
    primaryType: "Order",
    message: {
      salt,
      maker,
      signer: maker,
      tokenId: BigInt(tokenId),
      makerAmount,
      takerAmount,
      expiration: 0n,
      nonce,
      side: 0,
    },
  });

  return {
    salt: salt.toString(),
    maker,
    signer: maker,
    tokenId,
    makerAmount: makerAmount.toString(),
    takerAmount: takerAmount.toString(),
    side: "BUY",
    price: price.toString(),
    expiry: 0,
    nonce: nonce.toString(),
    signature,
  };
}

function min(a: bigint, b: bigint): bigint {
  return a < b ? a : b;
}

function fmt(wei: bigint): string {
  return (Number(wei) / 1e18).toFixed(4);
}
