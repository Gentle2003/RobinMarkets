import type { Address } from "viem";
import type {
  ActivityEntry,
  Comment,
  Market,
  NewsItem,
  OrderBookSnapshot,
  SignedOrder,
} from "@robinmarkets/shared";

export const ORDERBOOK_URL =
  process.env.NEXT_PUBLIC_ORDERBOOK_URL ?? "http://localhost:4000";

export interface OrderbookConfig {
  chainId: number;
  addresses: {
    collateral: Address;
    conditionalTokens: Address;
    ctfExchange: Address;
    resolver: Address;
    marketFactory: Address;
  };
}

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${ORDERBOOK_URL}${path}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`GET ${path} failed: ${res.status}`);
  return res.json() as Promise<T>;
}

export interface Stats {
  markets: number;
  volume24h: number;
  trades24h: number;
  updatedAt: number;
}

export const getConfig = () => get<OrderbookConfig>("/config");
export const getStats = () => get<Stats>("/stats");
export const getEthPrice = () => get<{ ethUsd: number; updatedAt: number }>("/eth-price");
export const getNews = () => get<NewsItem[]>("/news");

export const getProfile = (address: string) =>
  get<{ address: string; username: string }>(`/profile/${address}`);

export async function postProfile(input: { address: string; username: string; signature: string }) {
  const res = await fetch(`${ORDERBOOK_URL}/profile`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? "failed");
  return res.json() as Promise<{ address: string; username: string }>;
}

export interface AdminUser {
  address: string;
  username?: string;
  firstSeen: number;
  lastSeen: number;
  trades: number;
  volume: number;
  ethBalance: string;
  wethBalance: string;
}

export async function getAdminUsers(secret: string) {
  const res = await fetch(`${ORDERBOOK_URL}/admin/users`, { headers: { "x-admin-secret": secret } });
  if (!res.ok) throw new Error(res.status === 401 ? "wrong admin key" : "failed");
  return res.json() as Promise<{ users: AdminUser[]; count: number }>;
}

export async function adminAirdrop(
  secret: string,
  input: { to?: string; username?: string; amountEth: string; note?: string }
) {
  const res = await fetch(`${ORDERBOOK_URL}/admin/airdrop`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-admin-secret": secret },
    body: JSON.stringify(input),
  });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(j.error ?? "airdrop failed");
  return j as { ok: boolean; reward: Reward };
}

export interface UserStats {
  address: string;
  username: string | null;
  trades: number;
  volume: number;
  firstSeen: number;
  lastSeen: number;
}

export const getUserStats = (address: string) => get<UserStats>(`/users/${address}`);

export interface Reward {
  id: string;
  address: string;
  username?: string;
  amountWei: string;
  note?: string;
  status: "CLAIMABLE" | "CLAIMED";
  allocatedAt: number;
  claimedAt?: number;
  txHash?: string;
}

export const getRewards = (address: string) =>
  get<{ rewards: Reward[]; claimableWei: string; count: number }>(`/rewards/${address}`);

export async function claimReward(input: { address: string; rewardId: string; signature: string }) {
  const res = await fetch(`${ORDERBOOK_URL}/rewards/claim`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(j.error ?? "claim failed");
  return j as { ok: boolean; txHash: string; amountWei: string };
}
export const getMarkets = () => get<Market[]>("/markets");
export const getMarket = (id: string) => get<Market>(`/markets/${id}`);
export const getBook = (tokenId: string) => get<OrderBookSnapshot>(`/book/${tokenId}`);
export const getActivity = (marketId?: string, limit = 40) =>
  get<ActivityEntry[]>(`/activity?limit=${limit}${marketId ? `&marketId=${marketId}` : ""}`);

export const getComments = (marketId: string) =>
  get<Comment[]>(`/comments?marketId=${marketId}`);

export async function postComment(input: { marketId: string; author: string; text: string }) {
  const res = await fetch(`${ORDERBOOK_URL}/comments`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? "comment failed");
  return res.json() as Promise<Comment>;
}

export interface PostOrderResult {
  hash: string;
  status: "FILLED" | "PARTIAL" | "OPEN";
  trades: { matchType: string; fillShares: string; price: string }[];
  remainingShares: string;
}

export async function postOrder(order: SignedOrder): Promise<PostOrderResult> {
  const res = await fetch(`${ORDERBOOK_URL}/orders`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(order),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(body.error ?? `order rejected (${res.status})`);
  return body as PostOrderResult;
}

/** Subscribe to live book/trade updates. Returns a cleanup function. */
export function subscribe(onMessage: (msg: any) => void): () => void {
  const url = ORDERBOOK_URL.replace(/^http/, "ws") + "/ws";
  let ws: WebSocket | null = null;
  try {
    ws = new WebSocket(url);
    ws.onmessage = (e) => {
      try {
        onMessage(JSON.parse(e.data));
      } catch {
        /* ignore */
      }
    };
  } catch {
    /* ws unavailable */
  }
  return () => ws?.close();
}
