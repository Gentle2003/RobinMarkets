"use client";

import type { MarketSector } from "@robinmarkets/shared";

export type SectorFilter = "ALL" | MarketSector;

const TABS: { key: SectorFilter; label: string }[] = [
  { key: "ALL", label: "All" },
  { key: "STOCKS", label: "Stocks" },
  { key: "RWA", label: "Real-World Assets" },
];

export function SectorTabs({
  value,
  onChange,
}: {
  value: SectorFilter;
  onChange: (v: SectorFilter) => void;
}) {
  return (
    <div className="flex gap-1 rounded-xl border border-border bg-surface p-1">
      {TABS.map((t) => (
        <button
          key={t.key}
          onClick={() => onChange(t.key)}
          className={`rounded-lg px-3.5 py-1.5 text-sm font-medium transition-colors ${
            value === t.key ? "bg-lime text-black" : "text-muted hover:text-white"
          }`}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}
