"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { useMarkets } from "@/lib/hooks";
import { MarketCard } from "@/components/MarketCard";
import { SectorTabs, type SectorFilter } from "@/components/SectorTabs";
import { Ticker } from "@/components/Ticker";
import { ActivityFeed } from "@/components/ActivityFeed";
import { Hero } from "@/components/Hero";
import {
  subCategory,
  SUBCATEGORIES,
  timeframeOf,
  TIMEFRAME_LABEL,
  type Timeframe,
} from "@/lib/derived";

const TIMEFRAMES: (Timeframe | "ALL")[] = ["ALL", "DAILY", "WEEKLY", "MONTHLY", "LONG"];

export default function HomePage() {
  const { data: markets, isLoading, isError } = useMarkets();
  const [sector, setSector] = useState<SectorFilter>("ALL");
  const [subCat, setSubCat] = useState<string>("All");
  const [timeframe, setTimeframe] = useState<Timeframe | "ALL">("ALL");
  const [showResolved, setShowResolved] = useState(false);
  const [query, setQuery] = useState("");

  const subCats = sector === "STOCKS" || sector === "RWA" ? SUBCATEGORIES[sector] : [];

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = (markets ?? []).filter((m) => {
      const resolved = m.status === "RESOLVED";
      if (showResolved !== resolved) return false;
      if (!(sector === "ALL" || m.sector === sector)) return false;
      if (!(subCat === "All" || subCategory(m.underlying) === subCat)) return false;
      if (timeframe !== "ALL" && !resolved && timeframeOf(m.closeTime) !== timeframe) return false;
      if (q && !(m.underlying.toLowerCase().includes(q) || m.question.toLowerCase().includes(q)))
        return false;
      return true;
    });
    // Open markets: soonest close first. Resolved: most recent first.
    return list.sort((a, b) =>
      showResolved ? b.closeTime - a.closeTime : a.closeTime - b.closeTime
    );
  }, [markets, sector, subCat, query, timeframe, showResolved]);

  const resolvedCount = useMemo(
    () => (markets ?? []).filter((m) => m.status === "RESOLVED").length,
    [markets]
  );

  function pickSector(s: SectorFilter) {
    setSector(s);
    setSubCat("All");
  }

  return (
    <div className="flex flex-col gap-8">
      <Hero />

      <Ticker />

      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <SectorTabs value={sector} onChange={pickSector} />
          <div className="relative">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted">
              ⌕
            </span>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search markets…"
              className="w-full rounded-xl border border-border bg-surface py-2 pl-8 pr-3 text-sm outline-none transition-colors focus:border-lime-dim sm:w-64"
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {TIMEFRAMES.map((t) => (
            <button
              key={t}
              onClick={() => setTimeframe(t)}
              disabled={showResolved}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors disabled:opacity-40 ${
                timeframe === t && !showResolved
                  ? "bg-lime/15 text-lime ring-1 ring-lime/40"
                  : "bg-surface-2 text-muted hover:text-white"
              }`}
            >
              {t === "ALL" ? "All timeframes" : TIMEFRAME_LABEL[t as Timeframe]}
            </button>
          ))}
          <span className="mx-1 h-4 w-px bg-border" />
          <button
            onClick={() => setShowResolved((v) => !v)}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              showResolved
                ? "bg-lime/15 text-lime ring-1 ring-lime/40"
                : "bg-surface-2 text-muted hover:text-white"
            }`}
          >
            Resolved{resolvedCount > 0 ? ` (${resolvedCount})` : ""}
          </button>
        </div>

        {subCats.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {["All", ...subCats].map((c) => (
              <button
                key={c}
                onClick={() => setSubCat(c)}
                className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                  subCat === c
                    ? "bg-lime/15 text-lime ring-1 ring-lime/40"
                    : "bg-surface-2 text-muted hover:text-white"
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        )}
      </div>

      {isLoading && <SkeletonGrid />}
      {isError && (
        <div className="card p-6 text-sm text-muted">
          Couldn&apos;t reach the order book service. Is it running on{" "}
          <code className="text-white">:4000</code>?
        </div>
      )}
      {!isLoading && !isError && filtered.length === 0 && (
        <div className="card p-8 text-center text-sm text-muted">No markets match your filters.</div>
      )}

      <motion.div
        id="markets"
        className="grid grid-cols-1 gap-4 scroll-mt-20 sm:grid-cols-2 lg:grid-cols-3"
        initial="hidden"
        animate="show"
        variants={{ show: { transition: { staggerChildren: 0.05 } } }}
      >
        {filtered.map((m) => (
          <motion.div
            key={m.id}
            variants={{
              hidden: { opacity: 0, y: 16 },
              show: { opacity: 1, y: 0, transition: { duration: 0.35 } },
            }}
          >
            <MarketCard market={m} />
          </motion.div>
        ))}
      </motion.div>

      <section id="activity" className="flex scroll-mt-20 flex-col gap-3">
        <h2 className="text-sm font-semibold text-muted">Live market activity</h2>
        <ActivityFeed showMarket />
      </section>
    </div>
  );
}

function SkeletonGrid() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="card shimmer h-52 p-5" />
      ))}
    </div>
  );
}
