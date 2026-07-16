"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import type { Market } from "@robinmarkets/shared";
import { PRICE_SCALE } from "@robinmarkets/shared";
import { useBook } from "@/lib/hooks";
import { midPrice } from "@/lib/price";
import { priceToPct, sectorLabel, timeUntil } from "@/lib/format";
import { assetEmoji, fakeChange, fakeVolume, formatVolume, sparkline, subCategory } from "@/lib/derived";
import { AnimatedNumber } from "./AnimatedNumber";
import { Sparkline } from "./Sparkline";

export function MarketCard({ market }: { market: Market }) {
  const { data: book } = useBook(market.yesPositionId);
  const yes = midPrice(book);
  const yesPct = Number((yes * 10000n) / PRICE_SCALE) / 100;

  const change = fakeChange(market.id);
  const up = change >= 0;
  const volume = fakeVolume(market.id);
  const spark = sparkline(market.id, yesPct / 100);

  return (
    <motion.div
      whileHover={{ y: -4 }}
      transition={{ type: "spring", stiffness: 300, damping: 22 }}
    >
      <Link
        href={`/market/${market.id}`}
        className="card glow-hover flex h-full flex-col gap-4 p-5"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-surface-2 text-lg">
              {assetEmoji(market.underlying)}
            </span>
            <div>
              <div className="flex items-center gap-2 text-sm font-semibold">
                {market.underlying}
                <span
                  className={`text-[11px] font-medium ${up ? "text-yes" : "text-no"}`}
                >
                  {up ? "▲" : "▼"} {Math.abs(change).toFixed(1)}%
                </span>
              </div>
              <div className="text-xs text-muted">
                {sectorLabel(market.sector)} · {subCategory(market.underlying)}
              </div>
            </div>
          </div>
          <span className="pill bg-surface-2 text-muted">{timeUntil(market.closeTime)}</span>
        </div>

        <p className="line-clamp-2 min-h-[2.5rem] text-[15px] font-medium leading-snug text-white/90">
          {market.question}
        </p>

        <div className="flex items-end justify-between gap-3">
          <div>
            <div className="flex items-baseline gap-1">
              <AnimatedNumber
                value={yesPct}
                format={(n) => n.toFixed(0)}
                className="text-3xl font-bold tabular text-yes"
              />
              <span className="text-lg font-bold text-yes">%</span>
            </div>
            <div className="text-[11px] uppercase tracking-wide text-muted">Yes chance</div>
          </div>
          <div className="opacity-90">
            <Sparkline data={spark} up={up} width={110} height={38} />
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-border pt-3 text-xs text-muted">
          <span>Vol {formatVolume(volume)}</span>
          <div className="flex gap-1.5">
            <span className="pill bg-yes/10 text-yes">Yes {priceToPct(yes)}</span>
            <span className="pill bg-no/10 text-no">No {priceToPct(PRICE_SCALE - yes)}</span>
          </div>
        </div>
      </Link>
    </motion.div>
  );
}
