"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Outcome, type ActivityEntry } from "@robinmarkets/shared";
import { useActivity } from "@/lib/hooks";
import { fmtShares, priceToCents } from "@/lib/format";

function timeAgo(ts: number): string {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  return `${Math.floor(m / 60)}h`;
}

function Row({ e, showMarket }: { e: ActivityEntry; showMarket?: boolean }) {
  const isYes = e.outcome === Outcome.YES;
  const buy = e.side === "BUY";
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: -8, backgroundColor: "rgba(195,245,60,0.08)" }}
      animate={{ opacity: 1, y: 0, backgroundColor: "rgba(0,0,0,0)" }}
      transition={{ duration: 0.4 }}
      className="flex items-center justify-between gap-3 px-3 py-2 text-xs"
    >
      <div className="flex items-center gap-2">
        <span className={`pill ${buy ? "bg-yes/10 text-yes" : "bg-no/10 text-no"}`}>
          {buy ? "Buy" : "Sell"}
        </span>
        <span className={`font-semibold ${isYes ? "text-yes" : "text-no"}`}>
          {isYes ? "Yes" : "No"}
        </span>
        {showMarket && <span className="font-medium text-white/80">{e.underlying}</span>}
      </div>
      <div className="flex items-center gap-3 tabular text-muted">
        <span className="text-white/80">{priceToCents(e.price)}</span>
        <span>{fmtShares(e.shares)} sh</span>
        <span className="hidden font-mono sm:inline">{e.trader}</span>
        <span className="w-8 text-right">{timeAgo(e.timestamp)}</span>
      </div>
    </motion.div>
  );
}

export function ActivityFeed({ marketId, showMarket = false }: { marketId?: string; showMarket?: boolean }) {
  const { data: entries = [], isLoading } = useActivity(marketId, 30);

  return (
    <div className="card overflow-hidden">
      <div className="flex items-center justify-between border-b border-border px-3 py-2">
        <span className="text-xs font-semibold text-muted">Recent activity</span>
        <span className="flex items-center gap-1.5 text-[11px] text-muted">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-yes" /> live
        </span>
      </div>
      <div className="max-h-[420px] divide-y divide-border/60 overflow-y-auto">
        {isLoading && <div className="px-3 py-6 text-center text-xs text-muted">Loading…</div>}
        {!isLoading && entries.length === 0 && (
          <div className="px-3 py-6 text-center text-xs text-muted">No trades yet.</div>
        )}
        <AnimatePresence initial={false}>
          {entries.map((e) => (
            <Row key={e.id} e={e} showMarket={showMarket} />
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
