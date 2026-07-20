import { zeroAddress } from "viem";
import { marketFactoryAbi } from "@robinmarkets/shared";
import type { Config } from "./config.js";
import type { MarketsRegistry } from "./markets.js";
import { getUnderlyingPrice } from "./prices.js";
import { CADENCE_SECONDS, CATALOG, roundThreshold, type Cadence } from "./catalog.js";

const SECTOR_ID = { STOCKS: 0, RWA: 1 } as const;

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
  const now = Math.floor(Date.now() / 1000);
  const existing = new Set(markets.all().map((m) => m.question));

  for (const t of CATALOG.filter((c) => cadences.includes(c.cadence))) {
    const closeTime = now + CADENCE_SECONDS[t.cadence];
    const resolveTime = closeTime + 3600; // resolvable an hour after close
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

    if (existing.has(question)) {
      results.push({ underlying: t.underlying, cadence: t.cadence, kind: t.kind, question, skipped: "already exists" });
      continue;
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
      existing.add(question);
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
