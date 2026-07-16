"use client";

import { useMemo, useState } from "react";
import { useMarkets } from "@/lib/hooks";
import { MarketCard } from "@/components/MarketCard";
import { SectorTabs, type SectorFilter } from "@/components/SectorTabs";

export default function HomePage() {
  const { data: markets, isLoading, isError } = useMarkets();
  const [sector, setSector] = useState<SectorFilter>("ALL");

  const filtered = useMemo(
    () => (markets ?? []).filter((m) => sector === "ALL" || m.sector === sector),
    [markets, sector]
  );

  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-3">
        <h1 className="text-2xl font-bold tracking-tight">
          Predict <span className="text-lime">Stocks</span> &amp;{" "}
          <span className="text-lime">Real-World Assets</span>
        </h1>
        <p className="max-w-2xl text-sm text-muted">
          Trade binary outcomes on tokenized equities and RWAs. Orders are signed off-chain and
          settle on Robinhood Chain.
        </p>
      </section>

      <SectorTabs value={sector} onChange={setSector} />

      {isLoading && <SkeletonGrid />}
      {isError && (
        <div className="card p-6 text-sm text-muted">
          Couldn&apos;t reach the order book service. Is it running on{" "}
          <code className="text-white">:4000</code>?
        </div>
      )}
      {!isLoading && !isError && filtered.length === 0 && (
        <div className="card p-6 text-sm text-muted">No markets in this sector yet.</div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {filtered.map((m) => (
          <MarketCard key={m.id} market={m} />
        ))}
      </div>
    </div>
  );
}

function SkeletonGrid() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="card h-44 animate-pulse p-5" />
      ))}
    </div>
  );
}
