"use client";

import { useFavorites } from "@/lib/favorites";

/** A star toggle to add/remove a market from the watchlist. */
export function FavoriteButton({
  marketId,
  className = "",
  size = 18,
}: {
  marketId: string;
  className?: string;
  size?: number;
}) {
  const { isFavorite, toggle } = useFavorites();
  const active = isFavorite(marketId);

  return (
    <button
      type="button"
      aria-label={active ? "Remove from watchlist" : "Add to watchlist"}
      aria-pressed={active}
      onClick={(e) => {
        // Cards are links — don't navigate when starring.
        e.preventDefault();
        e.stopPropagation();
        toggle(marketId);
      }}
      className={`grid place-items-center rounded-lg transition-colors ${
        active ? "text-lime" : "text-muted hover:text-white"
      } ${className}`}
    >
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill={active ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      >
        <path d="M12 2.5l2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 18.9 6.1 21.5l1.2-6.5L2.5 9.4l6.6-.9z" />
      </svg>
    </button>
  );
}
