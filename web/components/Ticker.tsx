"use client";

import { assetEmoji, tickerItems, type TickerItem } from "@/lib/derived";

function Item({ t }: { t: TickerItem }) {
  const up = t.changePct >= 0;
  const price = t.isRate ? `${t.price.toFixed(2)}%` : `$${t.price.toFixed(2)}`;
  return (
    <span className="inline-flex items-center gap-2 px-5 tabular">
      <span className="text-sm">{assetEmoji(t.symbol)}</span>
      <span className="text-sm font-semibold text-white">{t.symbol}</span>
      <span className="text-sm text-muted">{price}</span>
      <span className={`text-xs font-medium ${up ? "text-yes" : "text-no"}`}>
        {up ? "▲" : "▼"} {Math.abs(t.changePct).toFixed(1)}%
      </span>
    </span>
  );
}

/** Continuous horizontal price tape. Duplicates the row for a seamless loop. */
export function Ticker() {
  const items = tickerItems();
  const row = [...items, ...items]; // doubled: animation translates by -50%

  return (
    <div className="marquee-pause relative overflow-hidden border-y border-border bg-surface/60 py-2 backdrop-blur">
      <div className="animate-marquee flex w-max whitespace-nowrap">
        {row.map((t, i) => (
          <Item key={`${t.symbol}-${i}`} t={t} />
        ))}
      </div>
      {/* edge fades */}
      <div className="pointer-events-none absolute inset-y-0 left-0 w-16 bg-gradient-to-r from-canvas to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 right-0 w-16 bg-gradient-to-l from-canvas to-transparent" />
    </div>
  );
}
