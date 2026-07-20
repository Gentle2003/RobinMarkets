/**
 * Catalog of market templates used by the auto-creator.
 *
 *  - PRICE markets resolve automatically: at resolveTime the resolver fetches the
 *    underlying's live price and compares it to the threshold.
 *  - EVENT markets are news-driven (earnings, launches, policy). They have no price
 *    feed, so they must be settled manually via POST /admin/resolve.
 */
export type Cadence = "DAILY" | "WEEKLY" | "MONTHLY";
export type MarketKind = "PRICE" | "EVENT";

export interface MarketTemplate {
  sector: "STOCKS" | "RWA";
  kind: MarketKind;
  /** Ticker for PRICE markets; a label (e.g. "SPACEX") for EVENT markets. */
  underlying: string;
  cadence: Cadence;
  /** PRICE only: threshold = live price × (1 + thresholdPct). */
  thresholdPct?: number;
  /** EVENT only: the question text (a deadline is appended at creation). */
  question?: string;
}

export const CATALOG: MarketTemplate[] = [
  // ── Daily price markets (near-the-money, ~coin-flip) ──────────────────────
  { sector: "STOCKS", kind: "PRICE", underlying: "AAPL", cadence: "DAILY", thresholdPct: 0.005 },
  { sector: "STOCKS", kind: "PRICE", underlying: "NVDA", cadence: "DAILY", thresholdPct: 0.005 },
  { sector: "STOCKS", kind: "PRICE", underlying: "TSLA", cadence: "DAILY", thresholdPct: 0.01 },
  { sector: "STOCKS", kind: "PRICE", underlying: "SPY", cadence: "DAILY", thresholdPct: 0.003 },

  // ── Weekly price markets ──────────────────────────────────────────────────
  { sector: "STOCKS", kind: "PRICE", underlying: "MSFT", cadence: "WEEKLY", thresholdPct: 0.015 },
  { sector: "RWA", kind: "PRICE", underlying: "GOLD", cadence: "WEEKLY", thresholdPct: 0.01 },
  { sector: "RWA", kind: "PRICE", underlying: "WTI", cadence: "WEEKLY", thresholdPct: 0.02 },

  // ── Monthly price markets ─────────────────────────────────────────────────
  { sector: "STOCKS", kind: "PRICE", underlying: "META", cadence: "MONTHLY", thresholdPct: 0.03 },
  { sector: "RWA", kind: "PRICE", underlying: "SILVER", cadence: "MONTHLY", thresholdPct: 0.04 },

  // ── Weekly event markets (news-driven, manually settled) ──────────────────
  {
    sector: "STOCKS",
    kind: "EVENT",
    underlying: "SP500",
    cadence: "WEEKLY",
    question: "Will an S&P 500 company announce a stock split this week?",
  },
  {
    sector: "RWA",
    kind: "EVENT",
    underlying: "TOKENIZED-TSY",
    cadence: "WEEKLY",
    question: "Will tokenized US Treasury products post net inflows this week?",
  },

  // ── Monthly event markets — incl. SpaceX (tokenized private-market RWA) ───
  {
    sector: "RWA",
    kind: "EVENT",
    underlying: "SPACEX",
    cadence: "MONTHLY",
    question: "Will SpaceX complete a successful Starship flight this month?",
  },
  {
    sector: "RWA",
    kind: "EVENT",
    underlying: "SPACEX",
    cadence: "MONTHLY",
    question: "Will SpaceX be reported at a valuation above $400B this month?",
  },
  {
    sector: "STOCKS",
    kind: "EVENT",
    underlying: "NVDA",
    cadence: "MONTHLY",
    question: "Will Nvidia beat consensus EPS at its next earnings report?",
  },
  {
    sector: "RWA",
    kind: "EVENT",
    underlying: "FED",
    cadence: "MONTHLY",
    question: "Will the Fed cut interest rates at its next policy meeting?",
  },
];

/** Trading window (seconds) for each cadence. */
export const CADENCE_SECONDS: Record<Cadence, number> = {
  DAILY: 24 * 60 * 60,
  WEEKLY: 7 * 24 * 60 * 60,
  MONTHLY: 30 * 24 * 60 * 60,
};

/**
 * Deterministic close time (unix seconds) for a cadence — the next daily/weekly/
 * monthly boundary at 20:00 UTC. Because it snaps to a fixed boundary rather than
 * "now + 24h", re-running the creator during the same period is idempotent.
 */
export function closeTimeFor(cadence: Cadence, nowMs = Date.now()): number {
  const d = new Date(nowMs);
  const at20 = (y: number, m: number, day: number) => Date.UTC(y, m, day, 20, 0, 0);

  if (cadence === "DAILY") {
    let t = at20(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
    if (t <= nowMs) t = at20(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1);
    return Math.floor(t / 1000);
  }

  if (cadence === "WEEKLY") {
    // next Friday (UTC day 5)
    const base = new Date(at20(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
    let add = (5 - base.getUTCDay() + 7) % 7;
    if (add === 0 && base.getTime() <= nowMs) add = 7;
    return Math.floor(at20(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + add) / 1000);
  }

  // MONTHLY: last calendar day of the month
  let t = at20(d.getUTCFullYear(), d.getUTCMonth() + 1, 0);
  if (t <= nowMs) t = at20(d.getUTCFullYear(), d.getUTCMonth() + 2, 0);
  return Math.floor(t / 1000);
}

/** Round a threshold to a human-friendly increment for the given magnitude. */
export function roundThreshold(price: number): number {
  if (price >= 1000) return Math.round(price / 25) * 25;
  if (price >= 100) return Math.round(price / 5) * 5;
  if (price >= 10) return Math.round(price);
  return Math.round(price * 10) / 10;
}
