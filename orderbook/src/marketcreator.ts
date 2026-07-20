import { zeroAddress } from "viem";
import { marketFactoryAbi } from "@robinmarkets/shared";
import type { Config } from "./config.js";
import type { MarketsRegistry } from "./markets.js";
import { getUnderlyingPrice } from "./prices.js";
import { CATALOG, closeTimeFor, roundThreshold, type Cadence } from "./catalog.js";

const SECTOR_ID = { STOCKS: 0, RWA: 1 } as const;

/**
 * Identity of a market within a period, so re-running the creator is idempotent.
 * PRICE markets collapse to one per underlying per period (the threshold moves with
 * the live price, so the question text alone isn't stable).
 */
function dedupeKey(underlying: string, base: string, closeTime: number): string {
  return `${underlying}|${base}|${closeTime}`;
}

/** Recover a stable "base" from a stored question. */
function baseOf(question: string): string {
  if (/^Will .+ close above \$[\d,.]+ (on|by) /.test(question)) return "PRICE";
  return question.replace(/ \(by [^)]+\)$/, "");
}

export interface CreatedMarket {
  underlying: string;
  cadence: Cadence;
  kind: string;
  question?: string;
  txHash?: string;
  skipped?: string;
}

/**
 * Create the catalog's markets for the given cadences. PRICE markets get a
 * threshold derived from the live price (near-the-money); EVENT markets are
 * created without a feed and settled manually later.
 */
export async function createMarkets(
  config: Config,
  markets: MarketsRegistry,
  cadences: Cadence[]
): Promise<CreatedMarket[]> {
  if (!config.walletClient || !config.operator) {
    throw new Error("no operator wallet configured");
  }

  const results: CreatedMarket[] = [];
  const existing = new Set(
    markets.all().map((m) => dedupeKey(m.underlying, baseOf(m.question), m.closeTime))
  );

  for (const t of CATALOG.filter((c) => cadences.includes(c.cadence))) {
    const closeTime = closeTimeFor(t.cadence);
    const resolveTime = closeTime + 3600; // resolvable an hour after close
    const key = dedupeKey(t.underlying, t.kind === "PRICE" ? "PRICE" : t.question!, closeTime);
    if (existing.has(key)) {
      results.push({ underlying: t.underlying, cadence: t.cadence, kind: t.kind, skipped: "already exists for this period" });
      continue;
    }
    const byDate = new Date(closeTime * 1000).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });

    let question: string;
    let threshold = 0n;

    if (t.kind === "PRICE") {
      const price = await getUnderlyingPrice(t.underlying);
      if (price == null) {
        results.push({ underlying: t.underlying, cadence: t.cadence, kind: t.kind, skipped: "no live price" });
        continue;
      }
      const thr = roundThreshold(price * (1 + (t.thresholdPct ?? 0)));
      threshold = BigInt(Math.round(thr * 1e8));
      const when = t.cadence === "DAILY" ? `on ${byDate}` : `by ${byDate}`;
      question = `Will ${t.underlying} close above $${thr.toLocaleString()} ${when}?`;
    } else {
      question = `${t.question} (by ${byDate})`;
    }

    try {
      const hash = await config.walletClient.writeContract({
        account: config.operator,
        chain: config.chain,
        address: config.addresses.marketFactory,
        abi: marketFactoryAbi,
        functionName: "createMarket",
        args: [
          {
            sector: SECTOR_ID[t.sector],
            underlying: t.underlying,
            question,
            collateral: config.addresses.collateral,
            closeTime: BigInt(closeTime),
            resolveTime: BigInt(resolveTime),
            feed: zeroAddress,
            threshold,
            greaterIsYes: true,
          },
        ],
      });
      await config.publicClient.waitForTransactionReceipt({ hash });
      existing.add(key);
      results.push({ underlying: t.underlying, cadence: t.cadence, kind: t.kind, question, txHash: hash });
      console.log(`[markets] created ${t.cadence} ${t.kind} — ${question}`);
    } catch (e) {
      results.push({
        underlying: t.underlying,
        cadence: t.cadence,
        kind: t.kind,
        question,
        skipped: (e as Error).message.split("\n")[0],
      });
    }
  }

  await markets.refresh();
  return results;
}

/**
 * Keep the catalog stocked automatically. Runs on an interval; because close times
 * snap to fixed period boundaries and creation is deduped, this only actually
 * creates markets when a new day/week/month begins. Returns a stop function.
 */
export function startMarketCreatorLoop(
  config: Config,
  markets: MarketsRegistry,
  intervalMs = 6 * 60 * 60 * 1000
): () => void {
  const tick = async () => {
    try {
      const created = await createMarkets(config, markets, ["DAILY", "WEEKLY", "MONTHLY"]);
      const made = created.filter((c) => c.txHash);
      if (made.length) console.log(`[markets] auto-created ${made.length} market(s)`);
    } catch (e) {
      console.error("[markets] auto-create failed:", (e as Error).message);
    }
  };
  const timer = setInterval(tick, intervalMs);
  void tick();
  return () => clearInterval(timer);
}
