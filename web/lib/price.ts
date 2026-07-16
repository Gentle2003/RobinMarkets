import { PRICE_SCALE, type OrderBookSnapshot } from "@robinmarkets/shared";

/** Mid price (1e18) from a book snapshot; falls back to 0.50 when empty/one-sided. */
export function midPrice(snapshot?: OrderBookSnapshot): bigint {
  const half = PRICE_SCALE / 2n;
  if (!snapshot) return half;
  const bid = snapshot.bids[0]?.price ? BigInt(snapshot.bids[0].price) : undefined;
  const ask = snapshot.asks[0]?.price ? BigInt(snapshot.asks[0].price) : undefined;
  if (bid !== undefined && ask !== undefined) return (bid + ask) / 2n;
  if (snapshot.lastPrice) return BigInt(snapshot.lastPrice);
  return bid ?? ask ?? half;
}
