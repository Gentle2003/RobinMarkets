"use client";

import { use } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { PRICE_SCALE } from "@robinmarkets/shared";
import { useMarket, useBook } from "@/lib/hooks";
import { midPrice } from "@/lib/price";
import { priceToPct, sectorLabel, timeUntil } from "@/lib/format";
import { assetEmoji, fakeChange, fakeVolume, formatVolume, sparkline } from "@/lib/derived";
import { ProbabilityBar } from "@/components/ProbabilityBar";
import { OrderBook } from "@/components/OrderBook";
import { TradePanel } from "@/components/TradePanel";
import { MarketTabs } from "@/components/market/MarketTabs";
import { ActivityFeed } from "@/components/ActivityFeed";
import { AnimatedNumber } from "@/components/AnimatedNumber";
import { Sparkline } from "@/components/Sparkline";
import { FavoriteButton } from "@/components/FavoriteButton";

export default function MarketPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data: market, isLoading, isError } = useMarket(id);
  const { data: yesBook } = useBook(market?.yesPositionId);
  const yes = midPrice(yesBook);
  const yesPct = Number((yes * 10000n) / PRICE_SCALE) / 100;

  if (isLoading) return <div className="card shimmer h-64" />;
  if (isError || !market)
    return (
      <div className="card p-6 text-sm text-muted">
        Market not found.{" "}
        <Link href="/" className="text-lime">
          Back to markets
        </Link>
      </div>
    );

  const change = fakeChange(market.id);
  const up = change >= 0;
  const spark = sparkline(market.id, yesPct / 100, 48);

  return (
    <div className="flex flex-col gap-6">
      <Link href="/" className="text-sm text-muted transition-colors hover:text-white">
        ← All markets
      </Link>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="card flex flex-col gap-5 p-6"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="grid h-11 w-11 place-items-center rounded-xl bg-surface-2 text-xl">
              {assetEmoji(market.underlying)}
            </span>
            <div>
              <div className="flex items-center gap-2 font-semibold">
                {market.underlying}
                <span className="pill bg-lime/10 text-lime">{sectorLabel(market.sector)}</span>
              </div>
              <div className="text-xs text-muted">
                Vol {formatVolume(fakeVolume(market.id))} · closes in {timeUntil(market.closeTime)}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className={`text-sm font-semibold ${up ? "text-yes" : "text-no"}`}>
              {up ? "▲" : "▼"} {Math.abs(change).toFixed(1)}%
            </span>
            <FavoriteButton marketId={market.id} size={22} className="h-9 w-9 hover:bg-surface-2" />
          </div>
        </div>

        <h1 className="text-xl font-bold leading-snug">{market.question}</h1>

        <div className="flex items-end gap-4">
          <div className="shrink-0">
            <div className="flex items-baseline gap-1">
              <AnimatedNumber
                value={yesPct}
                format={(n) => n.toFixed(0)}
                className="text-5xl font-bold tabular text-yes"
              />
              <span className="text-2xl font-bold text-yes">%</span>
            </div>
            <div className="text-xs uppercase tracking-wide text-muted">Yes probability</div>
          </div>
          <div className="min-w-0 flex-1">
            <Sparkline data={spark} up={up} width={640} height={90} fluid />
          </div>
        </div>

        <ProbabilityBar price={yes} />
      </motion.div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_340px]">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.4 }}
          className="flex flex-col gap-3"
        >
          <h2 className="text-sm font-semibold text-muted">Order book · Yes</h2>
          <OrderBook snapshot={yesBook} />
          <h2 className="mt-3 text-sm font-semibold text-muted">Activity</h2>
          <ActivityFeed marketId={market.id} />
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15, duration: 0.4 }}
          className="flex flex-col gap-3"
        >
          <h2 className="text-sm font-semibold text-muted">Trade</h2>
          <TradePanel market={market} />
        </motion.div>
      </div>

      <MarketTabs market={market} />
    </div>
  );
}
