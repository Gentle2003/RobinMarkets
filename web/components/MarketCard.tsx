"use client";

import Link from "next/link";
import type { Market } from "@robinmarkets/shared";
import { useBook } from "@/lib/hooks";
import { midPrice } from "@/lib/price";
import { priceToPct, sectorLabel, timeUntil } from "@/lib/format";
import { ProbabilityBar } from "./ProbabilityBar";

export function MarketCard({ market }: { market: Market }) {
  const { data: book } = useBook(market.yesPositionId);
  const yes = midPrice(book);

  return (
    <Link
      href={`/market/${market.id}`}
      className="card group flex flex-col gap-4 p-5 transition-colors hover:border-lime-dim"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="grid h-9 w-9 place-items-center rounded-lg bg-surface-2 text-sm font-bold text-lime">
            {market.underlying.slice(0, 3)}
          </span>
          <div>
            <div className="text-sm font-semibold">{market.underlying}</div>
            <div className="text-xs text-muted">{sectorLabel(market.sector)}</div>
          </div>
        </div>
        <span className="pill bg-surface-2 text-muted">{timeUntil(market.closeTime)} left</span>
      </div>

      <p className="min-h-[2.5rem] text-[15px] font-medium leading-snug text-white/90">
        {market.question}
      </p>

      <div className="mt-auto flex items-end justify-between gap-4">
        <div className="flex-1">
          <ProbabilityBar price={yes} />
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold tabular text-yes">{priceToPct(yes)}</div>
          <div className="text-[11px] uppercase tracking-wide text-muted">Yes</div>
        </div>
      </div>
    </Link>
  );
}
