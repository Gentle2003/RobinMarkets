import { PRICE_SCALE, type Market } from "@robinmarkets/shared";
import type { OrderBook } from "./book.js";

const ONE = 10n ** 18n;

function priceFromCents(cents: number): bigint {
  return (BigInt(cents) * PRICE_SCALE) / 100n;
}

/** Deterministic pseudo-random in [0,1) from a string + salt. */
function rand(seed: string, salt: number): number {
  let h = 2166136261 ^ salt;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  }
  return ((h >>> 0) % 100000) / 100000;
}

/** A deterministic target YES probability (in cents, 12–88) for a market. */
export function targetCents(marketId: string): number {
  return 12 + Math.floor(rand(marketId, 7) * 76);
}

/**
 * Populate the book with display-only liquidity so markets show varied prices and
 * realistic depth in the demo. These orders are never matched or settled on-chain.
 */
export function seedSyntheticBook(book: OrderBook, markets: Market[]): void {
  for (const m of markets) {
    const yesCents = targetCents(m.id);
    seedToken(book, m.yesPositionId, yesCents, m.id, "yes");
    seedToken(book, m.noPositionId, 100 - yesCents, m.id, "no");
  }
}

function seedToken(book: OrderBook, tokenId: string, centerCents: number, seed: string, tag: string): void {
  for (let i = 1; i <= 4; i++) {
    const bid = centerCents - i;
    const ask = centerCents + i;
    if (bid >= 1) {
      const size = BigInt(Math.floor(300 + rand(seed + tag + "b", i) * 4000)) * ONE;
      book.addSynthetic(tokenId, "BUY", priceFromCents(bid), size);
    }
    if (ask <= 99) {
      const size = BigInt(Math.floor(300 + rand(seed + tag + "a", i) * 4000)) * ONE;
      book.addSynthetic(tokenId, "SELL", priceFromCents(ask), size);
    }
  }
}
