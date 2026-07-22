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
  SPACEX: "🚀",
  FED: "🏛️",
  SP500: "📊",
  "TOKENIZED-TSY": "📜",
};

export function assetEmoji(underlying: string): string {
  return EMOJI[underlying] ?? "📊";
}

// Company/entity domains → real logos (via a favicon service). Assets without a
// clean brand logo (commodities, rates, indices) fall back to the emoji.
const ASSET_DOMAIN: Record<string, string> = {
  AAPL: "apple.com",
  NVDA: "nvidia.com",
  TSLA: "tesla.com",
  GOOGL: "google.com",
  MSFT: "microsoft.com",
  AMZN: "amazon.com",
  META: "meta.com",
  COIN: "coinbase.com",
  SPY: "ssga.com",
  SPACEX: "spacex.com",
  SP500: "spglobal.com",
  FED: "federalreserve.gov",
};

export function assetDomain(underlying: string): string | undefined {
  return ASSET_DOMAIN[underlying];
}

/** Company-logo URL for an underlying, or undefined if it has no brand logo. */
export function assetLogo(underlying: string): string | undefined {
  const domain = ASSET_DOMAIN[underlying];
  return domain ? `https://icons.duckduckgo.com/ip3/${domain}.ico` : undefined;
}

function hash(seed: string, salt: number): number {
  let h = 2166136261 ^ salt;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  return (h >>> 0) / 0xffffffff;
}

// ── Sub-categories ──────────────────────────────────────────────────────────

const SUBCATEGORY: Record<string, string> = {
  AAPL: "Tech",
  NVDA: "Tech",
  GOOGL: "Tech",
  MSFT: "Tech",
  META: "Tech",
  TSLA: "Consumer",
  AMZN: "Consumer",
  COIN: "Finance",
  SPY: "Index",
  GOLD: "Metals",
  SILVER: "Metals",
  "US-TBILL": "Rates",
  WTI: "Energy",
  REIT: "Real Estate",
  HOUSING: "Real Estate",
  SPACEX: "Private Markets",
  FED: "Rates",
  SP500: "Index",
  "TOKENIZED-TSY": "Rates",
};

export const SUBCATEGORIES: Record<"STOCKS" | "RWA", string[]> = {
  STOCKS: ["Tech", "Consumer", "Finance", "Index"],
  RWA: ["Metals", "Rates", "Energy", "Real Estate", "Private Markets"],
};

export function subCategory(underlying: string): string {
  return SUBCATEGORY[underlying] ?? "Other";
}

// ── Ticker prices (display-only) ────────────────────────────────────────────

const BASE_PRICE: Record<string, number> = {
  AAPL: 241.3,
  NVDA: 182.5,
  TSLA: 355.2,
  GOOGL: 205.1,
  MSFT: 498.4,
  AMZN: 238.9,
  META: 742.1,
  COIN: 312.6,
  SPY: 662.3,
  GOLD: 2870.0,
  SILVER: 36.2,
  "US-TBILL": 4.3,
  WTI: 72.4,
  REIT: 104.2,
  HOUSING: 322.1,
};

// ── Simulated holders (until an indexer exists) ─────────────────────────────

export interface SimHolder {
  trader: string;
  outcome: "YES" | "NO";
  shares: number;
}

function fakeAddr(seed: string, i: number): string {
  const h1 = Math.floor(hash(seed, i * 2 + 1) * 0xffff)
    .toString(16)
    .padStart(4, "0");
  const h2 = Math.floor(hash(seed, i * 2 + 2) * 0xffff)
    .toString(16)
    .padStart(4, "0");
  return `0x${h1}…${h2}`;
}

/** Deterministic, display-only top-holders leaderboard for a market. */
export function simulatedHolders(marketId: string, perSide = 4): SimHolder[] {
  const out: SimHolder[] = [];
  for (let i = 0; i < perSide; i++) {
    out.push({
      trader: fakeAddr(marketId + "y", i),
      outcome: "YES",
      shares: Math.floor(500 + hash(marketId + "y", i) * hash(marketId + "y2", i) * 60000),
    });
    out.push({
      trader: fakeAddr(marketId + "n", i),
      outcome: "NO",
      shares: Math.floor(500 + hash(marketId + "n", i) * hash(marketId + "n2", i) * 60000),
    });
  }
  return out.sort((a, b) => b.shares - a.shares);
}

// ── Timeframe (derived from how soon a market closes) ───────────────────────

export type Timeframe = "DAILY" | "WEEKLY" | "MONTHLY" | "LONG";

export const TIMEFRAME_LABEL: Record<Timeframe, string> = {
  DAILY: "Daily",
  WEEKLY: "Weekly",
  MONTHLY: "Monthly",
  LONG: "Long-dated",
};

/** Bucket a market by how soon it closes. */
export function timeframeOf(closeTime: number, nowSecs = Date.now() / 1000): Timeframe {
  const secs = closeTime - nowSecs;
  if (secs <= 2 * 86400) return "DAILY";
  if (secs <= 10 * 86400) return "WEEKLY";
  if (secs <= 45 * 86400) return "MONTHLY";
  return "LONG";
}

export interface TickerItem {
  symbol: string;
  price: number;
  changePct: number;
  isRate: boolean;
}

/** Deterministic ticker rows for the scrolling price tape. */
export function tickerItems(): TickerItem[] {
  return Object.entries(BASE_PRICE).map(([symbol, price]) => ({
    symbol,
    price,
    changePct: Math.round((hash(symbol, 5) - 0.45) * 120) / 10,
    isRate: symbol === "US-TBILL",
  }));
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
