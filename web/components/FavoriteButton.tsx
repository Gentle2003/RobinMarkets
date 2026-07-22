"use client";

import { useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
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
  const [flash, setFlash] = useState<null | "added" | "removed">(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  return (
    <span className="relative inline-grid">
      <button
        type="button"
        aria-label={active ? "Remove from watchlist" : "Add to watchlist"}
        aria-pressed={active}
        onClick={(e) => {
          // Cards are links — don't navigate when starring.
          e.preventDefault();
          e.stopPropagation();
          toggle(marketId);
          setFlash(active ? "removed" : "added");
          clearTimeout(timer.current);
          timer.current = setTimeout(() => setFlash(null), 1600);
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

      <AnimatePresence>
        {flash && (
          <motion.span
            initial={{ opacity: 0, y: -4, scale: 0.92 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.92 }}
            transition={{ duration: 0.15 }}
            role="status"
            className="pointer-events-none absolute right-0 top-full z-30 mt-1.5 whitespace-nowrap rounded-md bg-black/90 px-2 py-1 text-[11px] font-semibold shadow-lg ring-1 ring-white/10 backdrop-blur"
          >
            {flash === "added" ? (
              <span className="text-lime">★ Added to watchlist</span>
            ) : (
              <span className="text-muted">Removed from watchlist</span>
            )}
          </motion.span>
        )}
      </AnimatePresence>
    </span>
  );
}
