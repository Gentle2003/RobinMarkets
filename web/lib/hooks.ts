"use client";

import { useQuery } from "@tanstack/react-query";
import { getBook, getConfig, getMarket, getMarkets } from "./orderbook";

export function useOrderbookConfig() {
  return useQuery({ queryKey: ["config"], queryFn: getConfig, staleTime: Infinity });
}

export function useMarkets() {
  return useQuery({ queryKey: ["markets"], queryFn: getMarkets, refetchInterval: 15_000 });
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
