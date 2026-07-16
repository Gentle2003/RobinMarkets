/**
 * Deterministic, display-only metadata derived from a market id. Gives the demo
 * varied volumes, 24h moves, and sparkline history without a real indexer.
 */

const EMOJI: Record<string, string> = {
  AAPL: "🍎",
  NVDA: "🎮",
  TSLA: "🚗",
  GOOGL: "🔍",
  MSFT: "🪟",
  AMZN: "📦",
  META: "📘",
  COIN: "🪙",
  SPY: "📈",
  "US-TBILL": "🏦",
  GOLD: "🥇",
  SILVER: "🥈",
  WTI: "🛢️",
  REIT: "🏢",
  HOUSING: "🏠",
};

export function assetEmoji(underlying: string): string {
  return EMOJI[underlying] ?? "📊";
}

function hash(seed: string, salt: number): number {
  let h = 2166136261 ^ salt;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  return (h >>> 0) / 0xffffffff;
}

/** Pseudo 24h volume in whole dollars, ~$8k–$2.4M. */
export function fakeVolume(id: string): number {
  const v = hash(id, 3);
  return Math.round((8000 + v * v * 2_400_000) / 100) * 100;
}

export function formatVolume(v: number): string {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(2)}M`;
  if (v >= 1_000) return `$${(v / 1_000).toFixed(1)}K`;
  return `$${v}`;
}

/** Pseudo 24h change in the YES probability, in percentage points (−9…+9). */
export function fakeChange(id: string): number {
  return Math.round((hash(id, 11) - 0.5) * 180) / 10;
}

/**
 * A sparkline of YES-probability history (values in [0,1]) that random-walks and
 * lands on `end`. Deterministic per id.
 */
export function sparkline(id: string, end: number, n = 24): number[] {
  const pts: number[] = [];
  let v = Math.min(0.9, Math.max(0.1, end + (hash(id, 1) - 0.5) * 0.3));
  for (let i = 0; i < n; i++) {
    const step = (hash(id, i + 20) - 0.5) * 0.08;
    v = Math.min(0.95, Math.max(0.05, v + step));
    pts.push(v);
  }
  pts[pts.length - 1] = end; // land exactly on the current value
  return pts;
}
