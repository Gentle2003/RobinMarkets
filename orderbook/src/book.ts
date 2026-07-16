import { PRICE_SCALE, type OrderBookSnapshot, type OrderBookLevel } from "@robinmarkets/shared";
import type { BookOrder } from "./order.js";
import type { MarketsRegistry } from "./markets.js";

export type MatchType = "NORMAL" | "MINT" | "MERGE";

export interface Trade {
  taker: string; // taker order hash
  maker: string; // maker order hash
  tokenId: string;
  matchType: MatchType;
  fillShares: string;
  price: string; // taker-perceived execution price (1e18)
  timestamp: number;
}

/** A resting counterparty found for an incoming order. */
interface Counterparty {
  maker: BookOrder;
  matchType: MatchType;
}

/** Settlement callback — returns true if the fill settled on-chain (or in dry-run). */
export type SettleFn = (
  taker: BookOrder,
  maker: BookOrder,
  fillShares: bigint,
  matchType: MatchType
) => Promise<boolean>;

interface Level {
  buys: BookOrder[]; // resting bids for this token
  sells: BookOrder[]; // resting asks for this token
}

/**
 * In-memory central limit order book with a matching engine that understands the
 * three binary-market geometries: direct swaps (NORMAL), complementary mint, and
 * complementary merge. Fills are settled on-chain via the injected {@link SettleFn}
 * before the book state is mutated, so a failed settlement never corrupts the book.
 */
export class OrderBook {
  private levels = new Map<string, Level>(); // tokenId => resting orders
  private byHash = new Map<string, BookOrder>();

  constructor(private markets: MarketsRegistry) {}

  private level(tokenId: string): Level {
    let l = this.levels.get(tokenId);
    if (!l) {
      l = { buys: [], sells: [] };
      this.levels.set(tokenId, l);
    }
    return l;
  }

  has(hash: string): boolean {
    return this.byHash.has(hash);
  }

  /** Insert a taker order, match it against the book, and rest the remainder. */
  async submit(taker: BookOrder, settle: SettleFn): Promise<Trade[]> {
    const trades: Trade[] = [];

    while (taker.remainingShares > 0n) {
      const cp = this.findCounterparty(taker);
      if (!cp) break;

      const fill = taker.remainingShares < cp.maker.remainingShares
        ? taker.remainingShares
        : cp.maker.remainingShares;

      const ok = await settle(taker, cp.maker, fill, cp.matchType);
      if (!ok) break;

      taker.remainingShares -= fill;
      cp.maker.remainingShares -= fill;
      if (cp.maker.remainingShares === 0n) this.remove(cp.maker.hash);

      trades.push({
        taker: taker.hash,
        maker: cp.maker.hash,
        tokenId: taker.tokenId.toString(),
        matchType: cp.matchType,
        fillShares: fill.toString(),
        price: taker.price.toString(),
        timestamp: Date.now(),
      });
    }

    if (taker.remainingShares > 0n) this.rest(taker);
    return trades;
  }

  /** Best crossing counterparty for `taker`, preferring direct (NORMAL) fills. */
  private findCounterparty(taker: BookOrder): Counterparty | null {
    const info = this.markets.token(taker.tokenId.toString());
    const own = this.level(taker.tokenId.toString());

    if (taker.side === "BUY") {
      // NORMAL: cheapest ask that we can lift.
      const ask = own.sells
        .filter((o) => o.remainingShares > 0n && o.price <= taker.price)
        .sort((a, b) => cmp(a.price, b.price) || a.createdAt - b.createdAt)[0];
      if (ask) return { maker: ask, matchType: "NORMAL" };

      // MINT: complementary bid such that the two bids fund a full set.
      if (info) {
        const comp = this.level(info.complement);
        const bid = comp.buys
          .filter((o) => o.remainingShares > 0n && o.price + taker.price >= PRICE_SCALE)
          .sort((a, b) => cmp(b.price, a.price) || a.createdAt - b.createdAt)[0];
        if (bid) return { maker: bid, matchType: "MINT" };
      }
    } else {
      // NORMAL: highest bid that meets our ask.
      const bid = own.buys
        .filter((o) => o.remainingShares > 0n && o.price >= taker.price)
        .sort((a, b) => cmp(b.price, a.price) || a.createdAt - b.createdAt)[0];
      if (bid) return { maker: bid, matchType: "NORMAL" };

      // MERGE: complementary ask such that the two asks fit inside a full set.
      if (info) {
        const comp = this.level(info.complement);
        const ask = comp.sells
          .filter((o) => o.remainingShares > 0n && o.price + taker.price <= PRICE_SCALE)
          .sort((a, b) => cmp(a.price, b.price) || a.createdAt - b.createdAt)[0];
        if (ask) return { maker: ask, matchType: "MERGE" };
      }
    }
    return null;
  }

  private rest(o: BookOrder): void {
    const l = this.level(o.tokenId.toString());
    (o.side === "BUY" ? l.buys : l.sells).push(o);
    this.byHash.set(o.hash, o);
  }

  remove(hash: string): boolean {
    const o = this.byHash.get(hash);
    if (!o) return false;
    const l = this.level(o.tokenId.toString());
    const arr = o.side === "BUY" ? l.buys : l.sells;
    const i = arr.findIndex((x) => x.hash === hash);
    if (i >= 0) arr.splice(i, 1);
    this.byHash.delete(hash);
    return true;
  }

  get(hash: string): BookOrder | undefined {
    return this.byHash.get(hash);
  }

  /** Aggregated depth for a single token's direct (NORMAL) book. */
  snapshot(tokenId: string): OrderBookSnapshot {
    const l = this.level(tokenId);
    return {
      marketId: this.markets.token(tokenId)?.marketId ?? "",
      tokenId,
      bids: aggregate(l.buys, "desc"),
      asks: aggregate(l.sells, "asc"),
      updatedAt: Date.now(),
    };
  }
}

function cmp(a: bigint, b: bigint): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

function aggregate(orders: BookOrder[], dir: "asc" | "desc"): OrderBookLevel[] {
  const byPrice = new Map<string, bigint>();
  for (const o of orders) {
    if (o.remainingShares <= 0n) continue;
    const key = o.price.toString();
    byPrice.set(key, (byPrice.get(key) ?? 0n) + o.remainingShares);
  }
  const levels = [...byPrice.entries()].map(([price, size]) => ({ price, size: size.toString() }));
  levels.sort((a, b) =>
    dir === "asc" ? cmp(BigInt(a.price), BigInt(b.price)) : cmp(BigInt(b.price), BigInt(a.price))
  );
  return levels;
}
