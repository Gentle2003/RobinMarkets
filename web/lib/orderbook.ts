import type { Address } from "viem";
import type { ActivityEntry, Market, OrderBookSnapshot, SignedOrder } from "@robinmarkets/shared";

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
export const getMarkets = () => get<Market[]>("/markets");
export const getMarket = (id: string) => get<Market>(`/markets/${id}`);
export const getBook = (tokenId: string) => get<OrderBookSnapshot>(`/book/${tokenId}`);
export const getActivity = (marketId?: string, limit = 40) =>
  get<ActivityEntry[]>(`/activity?limit=${limit}${marketId ? `&marketId=${marketId}` : ""}`);

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
