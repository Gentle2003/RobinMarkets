import type { Address } from "viem";
import type { Config } from "./config.js";
import type { MarketsRegistry } from "./markets.js";
import type { UserStore } from "./users.js";

/**
 * Real per-market "top holders": the biggest YES and NO position holders on
 * RobinMarkets. Reconstructs current outcome-token balances by scanning the
 * ConditionalTokens ERC-1155 Transfer logs (no separate indexer needed), ranks
 * them, and caches per market. Addresses are decorated with usernames when known.
 */
const ZERO = "0x0000000000000000000000000000000000000000";
const TOP_N = 8;
const TTL_MS = 3 * 60 * 1000;

export interface Holder {
  address: string;
  username?: string;
  shares: string; // ERC-1155 balance (18-dec), as a string
}
export interface MarketHolders {
  yes: Holder[];
  no: Holder[];
  updatedAt: number;
}

const transferSingle = {
  type: "event",
  name: "TransferSingle",
  inputs: [
    { name: "operator", type: "address", indexed: true },
    { name: "from", type: "address", indexed: true },
    { name: "to", type: "address", indexed: true },
    { name: "id", type: "uint256", indexed: false },
    { name: "value", type: "uint256", indexed: false },
  ],
} as const;
const transferBatch = {
  type: "event",
  name: "TransferBatch",
  inputs: [
    { name: "operator", type: "address", indexed: true },
    { name: "from", type: "address", indexed: true },
    { name: "to", type: "address", indexed: true },
    { name: "ids", type: "uint256[]", indexed: false },
    { name: "values", type: "uint256[]", indexed: false },
  ],
} as const;

export class HolderIndex {
  private cache = new Map<string, MarketHolders>();

  constructor(
    private config: Config,
    private markets: MarketsRegistry,
    private users: UserStore
  ) {}

  async forMarket(marketId: string): Promise<MarketHolders | null> {
    const m = this.markets.get(marketId);
    if (!m) return null;
    const cached = this.cache.get(marketId);
    if (cached && Date.now() - cached.updatedAt < TTL_MS) return cached;

    const result = await this.scan(m.yesPositionId, m.noPositionId);
    this.cache.set(marketId, result);
    return result;
  }

  private async scan(yesId: string, noId: string): Promise<MarketHolders> {
    const { publicClient, addresses } = this.config;
    const yes = BigInt(yesId);
    const no = BigInt(noId);
    const balY = new Map<string, bigint>();
    const balN = new Map<string, bigint>();

    const apply = (id: bigint, from: string, to: string, value: bigint) => {
      const map = id === yes ? balY : id === no ? balN : null;
      if (!map) return;
      if (from.toLowerCase() !== ZERO) map.set(from, (map.get(from) ?? 0n) - value);
      if (to.toLowerCase() !== ZERO) map.set(to, (map.get(to) ?? 0n) + value);
    };

    const fromBlock = BigInt(process.env.HOLDERS_FROM_BLOCK ?? "0");
    const latest = await publicClient.getBlockNumber();
    const logs: any[] = [];
    // Adaptive range split so we respect each RPC's getLogs block-range cap.
    const collect = async (from: bigint, to: bigint): Promise<void> => {
      try {
        const chunk = await publicClient.getLogs({
          address: addresses.conditionalTokens as Address,
          events: [transferSingle, transferBatch] as any,
          fromBlock: from,
          toBlock: to,
        });
        logs.push(...chunk);
      } catch (e) {
        if (to - from <= 1n) return; // give up on a 1-block range
        const mid = from + (to - from) / 2n;
        await collect(from, mid);
        await collect(mid + 1n, to);
      }
    };
    await collect(fromBlock, latest);

    for (const log of logs) {
      const a = log.args ?? {};
      if (log.eventName === "TransferSingle") {
        apply(a.id as bigint, a.from as string, a.to as string, a.value as bigint);
      } else if (log.eventName === "TransferBatch") {
        const ids = (a.ids ?? []) as bigint[];
        const vals = (a.values ?? []) as bigint[];
        for (let i = 0; i < ids.length; i++) apply(ids[i], a.from as string, a.to as string, vals[i]);
      }
    }

    return { yes: this.rank(balY), no: this.rank(balN), updatedAt: Date.now() };
  }

  private rank(map: Map<string, bigint>): Holder[] {
    return [...map.entries()]
      .filter(([, v]) => v > 0n)
      .sort((a, b) => (b[1] > a[1] ? 1 : b[1] < a[1] ? -1 : 0))
      .slice(0, TOP_N)
      .map(([address, shares]) => ({
        address,
        username: this.users.get(address)?.username,
        shares: shares.toString(),
      }));
  }
}
