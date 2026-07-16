"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { useMarkets } from "@/lib/hooks";
import { MarketCard } from "@/components/MarketCard";
import { SectorTabs, type SectorFilter } from "@/components/SectorTabs";
import { AnimatedNumber } from "@/components/AnimatedNumber";
import { Ticker } from "@/components/Ticker";
import { ActivityFeed } from "@/components/ActivityFeed";
import { fakeVolume, formatVolume, subCategory, SUBCATEGORIES } from "@/lib/derived";

export default function HomePage() {
  const { data: markets, isLoading, isError } = useMarkets();
  const [sector, setSector] = useState<SectorFilter>("ALL");
  const [subCat, setSubCat] = useState<string>("All");
  const [query, setQuery] = useState("");

  const subCats = sector === "STOCKS" || sector === "RWA" ? SUBCATEGORIES[sector] : [];

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (markets ?? []).filter(
      (m) =>
        (sector === "ALL" || m.sector === sector) &&
        (subCat === "All" || subCategory(m.underlying) === subCat) &&
        (q === "" ||
          m.underlying.toLowerCase().includes(q) ||
          m.question.toLowerCase().includes(q))
    );
  }, [markets, sector, subCat, query]);

  const totalVolume = useMemo(
    () => (markets ?? []).reduce((sum, m) => sum + fakeVolume(m.id), 0),
    [markets]
  );

  function pickSector(s: SectorFilter) {
    setSector(s);
    setSubCat("All");
  }

  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-4 pt-4">
        <motion.h1
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-3xl font-bold tracking-tight sm:text-4xl"
        >
          Predict{" "}
          <span className="animate-gradient bg-gradient-to-r from-lime via-yes to-lime bg-clip-text text-transparent">
            Stocks
          </span>{" "}
          &amp;{" "}
          <span className="animate-gradient bg-gradient-to-r from-lime via-yes to-lime bg-clip-text text-transparent">
            Real-World Assets
          </span>
        </motion.h1>
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.15, duration: 0.5 }}
          className="max-w-2xl text-sm text-muted"
        >
          Trade binary outcomes on tokenized equities and RWAs. Orders are signed off-chain and
          settle on Robinhood Chain.
        </motion.p>

        <div className="grid grid-cols-3 gap-3 sm:max-w-md">
          <Stat label="Markets" value={markets?.length ?? 0} format={(n) => n.toFixed(0)} />
          <Stat label="24h Volume" value={totalVolume} format={(n) => formatVolume(n)} />
          <Stat label="Sectors" value={2} format={(n) => n.toFixed(0)} />
        </div>
      </section>

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
        className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
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

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold text-muted">Live market activity</h2>
        <ActivityFeed showMarket />
      </section>
    </div>
  );
}

function Stat({
  label,
  value,
  format,
}: {
  label: string;
  value: number;
  format: (n: number) => string;
}) {
  return (
    <div className="card px-4 py-3">
      <AnimatedNumber value={value} format={format} className="text-xl font-bold tabular text-white" />
      <div className="text-[11px] uppercase tracking-wide text-muted">{label}</div>
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
