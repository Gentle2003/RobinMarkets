import { Outcome, PRICE_SCALE, type ActivityEntry, type Market } from "@robinmarkets/shared";
import type { MarketsRegistry } from "./markets.js";
import type { Hub } from "./hub.js";
import { targetCents } from "./seed.js";

const MAX = 300;

/** Rolling in-memory log of recent trades for the activity feed. */
export class ActivityLog {
  private entries: ActivityEntry[] = [];

  push(entry: ActivityEntry): void {
    this.entries.unshift(entry);
    if (this.entries.length > MAX) this.entries.length = MAX;
  }

  recent(marketId: string | undefined, limit: number): ActivityEntry[] {
    const list = marketId ? this.entries.filter((e) => e.marketId === marketId) : this.entries;
    return list.slice(0, limit);
  }
}

function randTrader(): string {
  const hex = () => Math.floor(Math.random() * 16).toString(16);
  const s = Array.from({ length: 40 }, hex).join("");
  return `0x${s.slice(0, 4)}…${s.slice(-4)}`;
}

/** Build one plausible synthetic trade near a market's current YES probability. */
function synthTrade(m: Market): ActivityEntry {
  const yesCents = targetCents(m.id);
  const outcome = Math.random() < 0.5 ? Outcome.YES : Outcome.NO;
  const baseCents = outcome === Outcome.YES ? yesCents : 100 - yesCents;
  const jitter = Math.floor((Math.random() - 0.5) * 4);
  const cents = Math.min(99, Math.max(1, baseCents + jitter));
  const shares = BigInt(Math.floor(20 + Math.random() * 1500)) * 10n ** 18n;
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    marketId: m.id,
    underlying: m.underlying,
    outcome,
    side: Math.random() < 0.55 ? "BUY" : "SELL",
    price: ((BigInt(cents) * PRICE_SCALE) / 100n).toString(),
    shares: shares.toString(),
    trader: randTrader(),
    synthetic: true,
    timestamp: Date.now(),
  };
}

/**
 * Periodically emit synthetic trades so the activity feed feels live in the demo.
 * Returns a stop function. Disable with SEED_BOOK=false.
 */
export function startSyntheticActivity(
  log: ActivityLog,
  markets: MarketsRegistry,
  hub: Hub,
  intervalMs = 3500
): () => void {
  // Backfill a little history so the feed isn't empty on first load.
  const all = markets.all();
  for (let i = 0; i < Math.min(24, all.length * 2); i++) {
    const m = all[Math.floor(Math.random() * all.length)];
    if (m) {
      const e = synthTrade(m);
      e.timestamp = Date.now() - i * 45_000;
      log.push(e);
    }
  }

  const timer = setInterval(() => {
    const list = markets.all();
    if (list.length === 0) return;
    const m = list[Math.floor(Math.random() * list.length)];
    const e = synthTrade(m);
    log.push(e);
    hub.broadcast({ type: "activity", entry: e });
  }, intervalMs);

  return () => clearInterval(timer);
}
