import { formatUnits } from "viem";
import { PRICE_SCALE } from "@robinmarkets/shared";

/** Price (collateral wei per share, 1e18) → probability percent string. */
export function priceToPct(price: bigint | string): string {
  const p = typeof price === "string" ? BigInt(price) : price;
  const pct = Number((p * 10000n) / PRICE_SCALE) / 100;
  return `${pct.toFixed(1)}%`;
}

/** Price (1e18) → cents string like "$0.62". */
export function priceToCents(price: bigint | string): string {
  const p = typeof price === "string" ? BigInt(price) : price;
  const cents = Number((p * 100n) / PRICE_SCALE) / 100;
  return `$${cents.toFixed(2)}`;
}

export function fmtEth(wei: bigint | string, digits = 3): string {
  const w = typeof wei === "string" ? BigInt(wei) : wei;
  return Number(formatUnits(w, 18)).toFixed(digits);
}

export function fmtShares(wei: bigint | string): string {
  const w = typeof wei === "string" ? BigInt(wei) : wei;
  return Number(formatUnits(w, 18)).toLocaleString(undefined, { maximumFractionDigits: 2 });
}

/**
 * Share amount with magnitude-aware precision, so a tiny position reads as
 * "0.0011" rather than "0.0", while large ones stay compact (1.5k / 2.3M).
 */
export function formatShares(wei: bigint | string): string {
  const w = typeof wei === "string" ? BigInt(wei) : wei;
  const n = Number(formatUnits(w, 18));
  if (n === 0) return "0";
  if (n < 0.001) return "<0.001";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  const s = n >= 1 ? n.toFixed(2) : n.toPrecision(2);
  return s.includes(".") ? s.replace(/\.?0+$/, "") : s;
}

export function shortHash(h: string): string {
  return `${h.slice(0, 6)}…${h.slice(-4)}`;
}

export function sectorLabel(sector: string): string {
  return sector === "RWA" ? "Real-World Assets" : "Stocks";
}

export function timeUntil(unixSeconds: number): string {
  const ms = unixSeconds * 1000 - Date.now();
  if (ms <= 0) return "closed";
  const days = Math.floor(ms / 86400000);
  if (days > 0) return `${days}d`;
  const hours = Math.floor(ms / 3600000);
  return hours > 0 ? `${hours}h` : "<1h";
}
