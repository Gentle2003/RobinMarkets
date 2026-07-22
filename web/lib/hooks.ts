"use client";

import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { ActivityEntry, Comment } from "@robinmarkets/shared";
import {
  getActivity,
  getBook,
  getComments,
  getConfig,
  getEthPrice,
  getMarket,
  getMarkets,
  getNews,
  getProfile,
  getRewards,
  getStats,
  getUserStats,
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

/** ETH/USD price for $-denominated trade inputs (cached, refreshed each minute). */
export function useEthPrice() {
  return useQuery({ queryKey: ["ethPrice"], queryFn: getEthPrice, refetchInterval: 60_000 });
}

/** Breaking-news headlines, refreshed every few minutes. */
export function useNews() {
  return useQuery({ queryKey: ["news"], queryFn: getNews, refetchInterval: 5 * 60_000 });
}

/** A wallet's public trading stats (volume, trade count). */
export function useUserStats(address: string | undefined) {
  return useQuery({
    queryKey: ["userStats", address],
    queryFn: () => getUserStats(address!),
    enabled: !!address,
    refetchInterval: 15_000,
  });
}

/** A wallet's claimable + claimed airdrop rewards. */
export function useRewards(address: string | undefined) {
  return useQuery({
    queryKey: ["rewards", address],
    queryFn: () => getRewards(address!),
    enabled: !!address,
    refetchInterval: 20_000,
  });
}

/** A wallet's claimed username (null if none set). */
export function useProfile(address: string | undefined) {
  return useQuery({
    queryKey: ["profile", address],
    queryFn: () =>
      getProfile(address!)
        .then((p) => p.username)
        .catch(() => null),
    enabled: !!address,
    staleTime: 60_000,
  });
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
