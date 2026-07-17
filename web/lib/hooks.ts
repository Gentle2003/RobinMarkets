"use client";

import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { ActivityEntry, Comment } from "@robinmarkets/shared";
import {
  getActivity,
  getBook,
  getComments,
  getConfig,
  getMarket,
  getMarkets,
  getStats,
  subscribe,
} from "./orderbook";

export function useOrderbookConfig() {
  return useQuery({ queryKey: ["config"], queryFn: getConfig, staleTime: Infinity });
}

export function useMarkets() {
  return useQuery({ queryKey: ["markets"], queryFn: getMarkets, refetchInterval: 15_000 });
}

/** Live protocol stats — polled frequently so volume/trades visibly tick up. */
export function useStats() {
  return useQuery({ queryKey: ["stats"], queryFn: getStats, refetchInterval: 4_000 });
}

export function useMarket(id: string) {
  return useQuery({ queryKey: ["market", id], queryFn: () => getMarket(id), enabled: !!id });
}

export function useBook(tokenId: string | undefined) {
  return useQuery({
    queryKey: ["book", tokenId],
    queryFn: () => getBook(tokenId!),
    enabled: !!tokenId,
    refetchInterval: 4_000,
  });
}

/** Market comments, seeded from REST and kept live via the order book's WS feed. */
export function useComments(marketId: string | undefined) {
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: ["comments", marketId],
    queryFn: () => getComments(marketId!),
    enabled: !!marketId,
  });

  useEffect(() => {
    if (!marketId) return;
    return subscribe((msg) => {
      if (msg?.type !== "comment" || !msg.comment) return;
      const c = msg.comment as Comment;
      if (c.marketId !== marketId) return;
      qc.setQueryData<Comment[]>(["comments", marketId], (prev) => [c, ...(prev ?? [])]);
    });
  }, [qc, marketId]);

  return query;
}

/** Recent trades, seeded from REST and kept live via the order book's WS feed. */
export function useActivity(marketId?: string, limit = 40) {
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: ["activity", marketId ?? "all"],
    queryFn: () => getActivity(marketId, limit),
    refetchInterval: 20_000,
  });

  useEffect(() => {
    return subscribe((msg) => {
      if (msg?.type !== "activity" || !msg.entry) return;
      const entry = msg.entry as ActivityEntry;
      if (marketId && entry.marketId !== marketId) return;
      qc.setQueryData<ActivityEntry[]>(["activity", marketId ?? "all"], (prev) =>
        [entry, ...(prev ?? [])].slice(0, limit)
      );
    });
  }, [qc, marketId, limit]);

  return query;
}
