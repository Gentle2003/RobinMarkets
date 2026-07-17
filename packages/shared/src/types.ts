/**
 * Domain types shared across the web app and the order book service.
 *
 * RobinMarkets only lists outcomes in two sectors — see {@link MarketSector}.
 * Every market is binary (YES / NO) and settled in WETH collateral.
 */

/** RobinMarkets is intentionally scoped to these two sectors only. */
export type MarketSector = "STOCKS" | "RWA";

export type MarketStatus = "OPEN" | "PAUSED" | "RESOLVING" | "RESOLVED";

/** Binary outcome. YES = condition resolves true. */
export enum Outcome {
  NO = 0,
  YES = 1,
}

export type Side = "BUY" | "SELL";

export interface Market {
  /** keccak256 conditionId from the ConditionalTokens contract. */
  id: string;
  sector: MarketSector;
  /** Underlying ticker/asset, e.g. "AAPL", "NVDA", "US-TBILL". */
  underlying: string;
  question: string;
  description: string;
  status: MarketStatus;
  /** ERC-1155 positionIds for each outcome token. */
  yesPositionId: string;
  noPositionId: string;
  /** unix seconds */
  closeTime: number;
  resolveTime: number;
  /** Resolved outcome, once status === "RESOLVED". */
  resolvedOutcome?: Outcome;
  /** Chainlink feed used for automated resolution, if any. */
  priceFeed?: `0x${string}`;
  createdAt: number;
}

/**
 * An EIP-712 signed limit order, matching the CTFExchange `Order` struct.
 * Prices/amounts are integers scaled to the collateral's 18 decimals; price is
 * expressed in collateral per outcome share (0 < price < 1e18).
 */
export interface SignedOrder {
  salt: string;
  maker: `0x${string}`;
  /** Signer of the EIP-712 order; equals `maker` for EOAs, may differ for 1271 wallets. */
  signer: `0x${string}`;
  /** The outcome tokenId (positionId) being traded. */
  tokenId: string;
  /** collateral wei the maker pays (BUY) or shares offered (SELL) */
  makerAmount: string;
  takerAmount: string;
  side: Side;
  /** limit price in collateral wei per share (1e18 == 1.0) */
  price: string;
  expiry: number;
  nonce: string;
  signature: `0x${string}`;
}

export interface OrderBookLevel {
  price: string;
  size: string;
}

export interface OrderBookSnapshot {
  marketId: string;
  tokenId: string;
  bids: OrderBookLevel[];
  asks: OrderBookLevel[];
  /** last trade price in collateral wei per share */
  lastPrice?: string;
  updatedAt: number;
}

/** A recent trade shown in the market activity feed (Polymarket-style). */
export interface ActivityEntry {
  id: string;
  marketId: string;
  underlying: string;
  outcome: Outcome;
  side: Side;
  /** execution price in collateral wei per share (1e18 == 1.0) */
  price: string;
  /** shares traded (18-decimal wei) */
  shares: string;
  /** short trader label, e.g. "0x1234…abcd" */
  trader: string;
  /** true for demo-generated activity */
  synthetic?: boolean;
  timestamp: number;
}

/** A user comment on a market. */
export interface Comment {
  id: string;
  marketId: string;
  /** commenter wallet address (checkssummed or lowercase) */
  author: string;
  text: string;
  timestamp: number;
}

/** A top holder of a market outcome (for the holders leaderboard). */
export interface Holder {
  trader: string;
  outcome: Outcome;
  /** shares held, 18-decimal wei */
  shares: string;
  /** true when this is demo/simulated data (no indexer yet) */
  simulated?: boolean;
}

export const SECTORS: readonly MarketSector[] = ["STOCKS", "RWA"] as const;

/** Collateral is WETH (wrapped Robinhood ETH) — the CTF requires an ERC-20. */
export const COLLATERAL_DECIMALS = 18;
export const PRICE_SCALE = 10n ** 18n; // 1e18 == probability 1.0
