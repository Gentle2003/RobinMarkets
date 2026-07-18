import { Outcome, resolverAbi } from "@robinmarkets/shared";
import type { Config } from "./config.js";
import type { MarketsRegistry } from "./markets.js";
import { getUnderlyingPrice } from "./prices.js";

export interface ResolveResult {
  ok: boolean;
  outcome?: "YES" | "NO";
  price?: number;
  threshold?: number;
  txHash?: string;
  reason?: string;
}

/**
 * Resolve one market on real data: read its threshold/direction from the Resolver
 * contract, fetch the underlying's live price, decide YES/NO, and report it
 * on-chain via adminResolve (the operator is the Resolver's owner).
 */
export async function resolveMarket(
  config: Config,
  markets: MarketsRegistry,
  marketId: string
): Promise<ResolveResult> {
  if (!config.walletClient || !config.operator) return { ok: false, reason: "no operator wallet" };
  const m = markets.get(marketId);
  if (!m || !m.questionId) return { ok: false, reason: "unknown market" };
  if (m.status === "RESOLVED") return { ok: false, reason: "already resolved" };

  const q = (await config.publicClient.readContract({
    address: config.addresses.resolver,
    abi: resolverAbi,
    functionName: "questions",
    args: [m.questionId as `0x${string}`],
  })) as readonly [boolean, boolean, string, bigint, boolean, bigint];
  const threshold = Number(q[3]) / 1e8; // feeds use 8 decimals
  const greaterIsYes = q[4];

  const price = await getUnderlyingPrice(m.underlying);
  if (price == null) return { ok: false, reason: `no live price for ${m.underlying}` };

  const above = price > threshold;
  const yes = greaterIsYes ? above : !above;

  const hash = await config.walletClient.writeContract({
    account: config.operator,
    chain: config.chain,
    address: config.addresses.resolver,
    abi: resolverAbi,
    functionName: "adminResolve",
    args: [m.questionId as `0x${string}`, yes],
  });
  await config.publicClient.waitForTransactionReceipt({ hash });
  markets.setResolved(marketId, yes ? Outcome.YES : Outcome.NO);

  return { ok: true, outcome: yes ? "YES" : "NO", price, threshold, txHash: hash };
}

/**
 * Periodically auto-resolve any market whose resolveTime has passed, using real
 * prices. Returns a stop function. Safe to always run (only touches due markets).
 */
export function startResolverLoop(
  config: Config,
  markets: MarketsRegistry,
  intervalMs = 300_000
): () => void {
  const tick = async () => {
    const now = Math.floor(Date.now() / 1000);
    for (const m of markets.all()) {
      if (m.status !== "RESOLVED" && now >= m.resolveTime) {
        try {
          const r = await resolveMarket(config, markets, m.id);
          if (r.ok) {
            console.log(`[resolve] ${m.underlying} → ${r.outcome} (price ${r.price} vs ${r.threshold})`);
          }
        } catch (e) {
          console.error(`[resolve] ${m.underlying} failed:`, (e as Error).message);
        }
      }
    }
  };
  const timer = setInterval(tick, intervalMs);
  void tick();
  return () => clearInterval(timer);
}
