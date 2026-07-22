"use client";

import { useSyncExternalStore } from "react";

/**
 * Client-side watchlist. Favorited market ids live in localStorage so they work
 * instantly without a wallet or sign-in, and sync across tabs. A new Set is
 * created on each change so useSyncExternalStore re-renders subscribers.
 */
const KEY = "rm-favorites";
const EMPTY: ReadonlySet<string> = new Set();
const listeners = new Set<() => void>();

let favs: ReadonlySet<string> = load();

function load(): ReadonlySet<string> {
  if (typeof window === "undefined") return EMPTY;
  try {
    return new Set(JSON.parse(localStorage.getItem(KEY) ?? "[]"));
  } catch {
    return EMPTY;
  }
}

function commit(next: Set<string>): void {
  favs = next;
  try {
    localStorage.setItem(KEY, JSON.stringify([...next]));
  } catch {
    /* ignore quota/private-mode errors */
  }
  listeners.forEach((l) => l());
}

export function toggleFavorite(id: string): void {
  const next = new Set(favs);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  commit(next);
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY) {
      favs = load();
      cb();
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("storage", onStorage);
  };
}

/** Reactive watchlist. Returns the set of favorited market ids + helpers. */
export function useFavorites() {
  const favorites = useSyncExternalStore(
    subscribe,
    () => favs,
    () => EMPTY
  );
  return {
    favorites,
    isFavorite: (id: string) => favorites.has(id),
    toggle: toggleFavorite,
    count: favorites.size,
  };
}
