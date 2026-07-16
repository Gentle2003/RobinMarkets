"use client";

import { use } from "react";
import Link from "next/link";
import { useMarket, useBook } from "@/lib/hooks";
import { midPrice } from "@/lib/price";
import { priceToPct, sectorLabel, timeUntil } from "@/lib/format";
import { ProbabilityBar } from "@/components/ProbabilityBar";
import { OrderBook } from "@/components/OrderBook";
import { TradePanel } from "@/components/TradePanel";

export default function MarketPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data: market, isLoading, isError } = useMarket(id);
  const { data: yesBook } = useBook(market?.yesPositionId);
  const yes = midPrice(yesBook);

  if (isLoading) return <div className="card h-64 animate-pulse" />;
  if (isError || !market)
    return (
      <div className="card p-6 text-sm text-muted">
        Market not found.{" "}
        <Link href="/" className="text-lime">
          Back to markets
        </Link>
      </div>
    );

  return (
    <div className="flex flex-col gap-6">
      <Link href="/" className="text-sm text-muted hover:text-white">
        ← All markets
      </Link>

      <div className="card flex flex-col gap-5 p-6">
        <div className="flex items-center justify-between">
          <span className="pill bg-surface-2 text-lime">{sectorLabel(market.sector)}</span>
          <span className="pill bg-surface-2 text-muted">
            {market.underlying} · closes in {timeUntil(market.closeTime)}
          </span>
        </div>
        <h1 className="text-xl font-bold leading-snug">{market.question}</h1>
        <div className="flex items-end gap-6">
          <div>
            <div className="text-4xl font-bold tabular text-yes">{priceToPct(yes)}</div>
            <div className="text-xs uppercase tracking-wide text-muted">Yes probability</div>
          </div>
          <div className="flex-1 pb-2">
            <ProbabilityBar price={yes} />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_340px]">
        <div className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold text-muted">Order book · Yes</h2>
          <OrderBook snapshot={yesBook} />
        </div>
        <div className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold text-muted">Trade</h2>
          <TradePanel market={market} />
        </div>
      </div>
    </div>
  );
}
