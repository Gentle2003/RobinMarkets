import type { Address, Hex } from "viem";
import {
  conditionalTokensAbi,
  marketFactoryAbi,
  Outcome,
  type Market,
  type MarketSector,
} from "@robinmarkets/shared";
import type { Config } from "./config.js";
import { isPriceable } from "./prices.js";

const SECTORS: MarketSector[] = ["STOCKS", "RWA"];

export interface TokenInfo {
  tokenId: string;
  complement: string;
  conditionId: string;
  collateral: Address;
  marketId: string; // == conditionId
  isYes: boolean;
}

/** In-memory view of on-chain markets, refreshable as new markets are created. */
export class MarketsRegistry {
  private markets = new Map<string, Market>();
  private tokenInfo = new Map<string, TokenInfo>();

  constructor(private config: Config) {}

  async refresh(): Promise<void> {
    const { publicClient, addresses } = this.config;
    const allIds = (await publicClient.readContract({
      address: addresses.marketFactory,
      abi: marketFactoryAbi,
      functionName: "allMarketIds",
    })) as readonly Hex[];

    // Markets are append-only on-chain and can never be deleted, so the list only
    // grows. Load just the most recent slice to keep RPC load flat over time;
    // older (long-settled) markets stay on-chain and remain redeemable directly.
    const maxLoad = Number(process.env.MAX_MARKETS_LOADED ?? 250);
    const ids = allIds.length > maxLoad ? allIds.slice(-maxLoad) : allIds;

    const raw = await Promise.all(
      ids.map((id) =>
        publicClient.readContract({
          address: addresses.marketFactory,
          abi: marketFactoryAbi,
          functionName: "getMarket",
          args: [id],
        })
      )
    );

    // Read resolution status for every condition (denominator > 0 == resolved).
    const denominators = (await Promise.all(
      (raw as any[]).map((m) =>
        publicClient.readContract({
          address: addresses.conditionalTokens,
          abi: conditionalTokensAbi,
          functionName: "payoutDenominator",
          args: [m.conditionId],
        })
      )
    )) as bigint[];

    this.markets.clear();
    this.tokenInfo.clear();
    for (let i = 0; i < (raw as any[]).length; i++) {
      const m = (raw as any[])[i];
      const resolved = denominators[i] > 0n;
      let resolvedOutcome: Outcome | undefined;
      if (resolved) {
        const yesNum = (await publicClient.readContract({
          address: addresses.conditionalTokens,
          abi: conditionalTokensAbi,
          functionName: "payoutNumerators",
          args: [m.conditionId, 1n],
        })) as bigint;
        resolvedOutcome = yesNum > 0n ? Outcome.YES : Outcome.NO;
      }
      const market: Market = {
        id: m.conditionId,
        questionId: m.questionId,
        sector: SECTORS[Number(m.sector)] ?? "STOCKS",
        underlying: m.underlying,
        question: m.question,
        description: "",
        status: resolved ? "RESOLVED" : "OPEN",
        resolvedOutcome,
        yesPositionId: m.yesTokenId.toString(),
        noPositionId: m.noTokenId.toString(),
        closeTime: Number(m.closeTime),
        resolveTime: Number(m.resolveTime),
        autoResolvable: isPriceable(m.underlying),
        createdAt: 0,
      };
      this.markets.set(market.id, market);

      const yesId = m.yesTokenId.toString();
      const noId = m.noTokenId.toString();
      this.tokenInfo.set(yesId, {
        tokenId: yesId,
        complement: noId,
        conditionId: m.conditionId,
        collateral: m.collateral,
        marketId: m.conditionId,
        isYes: true,
      });
      this.tokenInfo.set(noId, {
        tokenId: noId,
        complement: yesId,
        conditionId: m.conditionId,
        collateral: m.collateral,
        marketId: m.conditionId,
        isYes: false,
      });
    }
  }

  all(): Market[] {
    return [...this.markets.values()];
  }

  get(conditionId: string): Market | undefined {
    return this.markets.get(conditionId);
  }

  /** Mark a market resolved in-memory (called by the resolver after reporting). */
  setResolved(conditionId: string, outcome: Outcome): void {
    const m = this.markets.get(conditionId);
    if (m) {
      m.status = "RESOLVED";
      m.resolvedOutcome = outcome;
    }
  }

  token(tokenId: string): TokenInfo | undefined {
    return this.tokenInfo.get(tokenId);
  }

  knownToken(tokenId: string): boolean {
    return this.tokenInfo.has(tokenId);
  }
}
