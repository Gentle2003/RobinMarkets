"use client";

import type { OrderBookSnapshot, OrderBookLevel } from "@robinmarkets/shared";
import { fmtShares, priceToCents } from "@/lib/format";

function maxSize(levels: OrderBookLevel[]): number {
  return levels.reduce((m, l) => Math.max(m, Number(l.size)), 1);
}

function Row({ level, side, max }: { level: OrderBookLevel; side: "bid" | "ask"; max: number }) {
  const pct = (Number(level.size) / max) * 100;
  const color = side === "bid" ? "bg-yes/10" : "bg-no/10";
  const text = side === "bid" ? "text-yes" : "text-no";
  return (
    <div className="relative flex items-center justify-between px-3 py-1 text-xs tabular">
      <div className={`absolute inset-y-0 right-0 ${color}`} style={{ width: `${pct}%` }} />
      <span className={`relative font-medium ${text}`}>{priceToCents(level.price)}</span>
      <span className="relative text-muted">{fmtShares(level.size)}</span>
    </div>
  );
}

export function OrderBook({ snapshot }: { snapshot?: OrderBookSnapshot }) {
  const bids = snapshot?.bids ?? [];
  const asks = snapshot?.asks ?? [];
  const max = maxSize([...bids, ...asks]);

  return (
    <div className="card overflow-hidden">
      <div className="flex items-center justify-between border-b border-border px-3 py-2 text-xs font-semibold text-muted">
        <span>Price (Yes)</span>
        <span>Shares</span>
      </div>
      <div className="flex flex-col-reverse">
        {asks.slice(0, 6).map((l, i) => (
          <Row key={`a${i}`} level={l} side="ask" max={max} />
        ))}
      </div>
      <div className="border-y border-border px-3 py-1.5 text-center text-[11px] uppercase tracking-wide text-muted">
        spread
      </div>
      <div className="flex flex-col">
        {bids.slice(0, 6).map((l, i) => (
          <Row key={`b${i}`} level={l} side="bid" max={max} />
        ))}
      </div>
      {bids.length === 0 && asks.length === 0 && (
        <div className="px-3 py-6 text-center text-xs text-muted">No resting orders yet.</div>
      )}
    </div>
  );
}
