"use client";

import type { Market } from "@robinmarkets/shared";
import { simulatedHolders } from "@/lib/derived";

export function MarketHolders({ market }: { market: Market }) {
  const holders = simulatedHolders(market.id);

  return (
    <div className="flex flex-col gap-3">
      <div className="rounded-lg border border-[#e5c07b]/30 bg-[#e5c07b]/10 px-3 py-2 text-[11px] text-[#e5c07b]">
        Simulated leaderboard — real top holders require an on-chain indexer (coming soon).
      </div>
      <div className="flex flex-col divide-y divide-border/60">
        {holders.map((h, i) => (
          <div key={i} className="flex items-center justify-between py-2.5 text-sm">
            <div className="flex items-center gap-3">
              <span className="w-5 text-right text-xs text-muted tabular">{i + 1}</span>
              <span className="font-mono text-xs text-white/80">{h.trader}</span>
              <span
                className={`pill ${h.outcome === "YES" ? "bg-yes/10 text-yes" : "bg-no/10 text-no"}`}
              >
                {h.outcome}
              </span>
            </div>
            <span className="tabular text-muted">{h.shares.toLocaleString()} sh</span>
          </div>
        ))}
      </div>
    </div>
  );
}
