import type { Address, Hex } from "viem";
import { marketFactoryAbi, type Market, type MarketSector } from "@robinmarkets/shared";
import type { Config } from "./config.js";

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
    const ids = (await publicClient.readContract({
      address: addresses.marketFactory,
      abi: marketFactoryAbi,
      functionName: "allMarketIds",
    })) as readonly Hex[];

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

    this.markets.clear();
    this.tokenInfo.clear();
    for (const m of raw as any[]) {
      const market: Market = {
        id: m.conditionId,
        sector: SECTORS[Number(m.sector)] ?? "STOCKS",
        underlying: m.underlying,
        question: m.question,
        description: "",
        status: "OPEN",
        yesPositionId: m.yesTokenId.toString(),
        noPositionId: m.noTokenId.toString(),
        closeTime: Number(m.closeTime),
        resolveTime: Number(m.resolveTime),
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

  token(tokenId: string): TokenInfo | undefined {
    return this.tokenInfo.get(tokenId);
  }

  knownToken(tokenId: string): boolean {
    return this.tokenInfo.has(tokenId);
  }
}
