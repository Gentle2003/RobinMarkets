"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import type { Market, NewsItem } from "@robinmarkets/shared";
import { useMarkets, useNews } from "@/lib/hooks";

function timeAgo(ts: number): string {
  if (!ts) return "";
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 3600) return `${Math.max(1, Math.floor(s / 60))}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
}

/** Find the soonest-closing open market for a ticker, to trade the related view. */
function marketForTicker(markets: Market[] | undefined, ticker: string): Market | undefined {
  return (markets ?? [])
    .filter((m) => m.underlying === ticker && m.status !== "RESOLVED")
    .sort((a, b) => a.closeTime - b.closeTime)[0];
}

function Item({ n, market, index }: { n: NewsItem; market?: Market; index: number }) {
  return (
    <div className="border-b border-black/10 last:border-0">
      {/* Headline opens the actual news article. */}
      <a href={n.url} target="_blank" rel="noreferrer" className="group flex gap-2.5 pt-2.5">
        <span className="mt-0.5 w-5 shrink-0 text-center text-[13px] font-bold tabular-nums text-black/40">
          {index + 1}
        </span>
        <div className="min-w-0">
          <p className="line-clamp-2 text-[13px] font-medium leading-snug text-black/90 group-hover:text-black group-hover:underline">
            {n.title}
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-black/50">
            <span className="font-semibold text-black/70">{n.ticker}</span>
            {n.publisher && <span>· {n.publisher}</span>}
            {n.timestamp > 0 && <span>· {timeAgo(n.timestamp)}</span>}
          </div>
        </div>
      </a>
      {/* Trade button jumps to the related market. */}
      {market && (
        <Link
          href={`/market/${market.id}`}
          className="mb-2.5 ml-[30px] mt-1.5 inline-flex items-center gap-1 rounded-full bg-black/10 px-2.5 py-1 text-[11px] font-semibold text-black/80 transition-colors hover:bg-black/20 hover:text-black"
        >
          Trade {market.underlying} →
        </Link>
      )}
    </div>
  );
}

export function BreakingNews() {
  const { data: news, isLoading } = useNews();
  const { data: markets } = useMarkets();

  return (
    <motion.aside
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="overflow-hidden rounded-2xl bg-gradient-to-b from-lime to-lime-bright text-black shadow-[0_8px_40px_-12px_rgba(195,245,60,0.4)]"
    >
      <div className="flex items-center justify-between px-4 pt-4">
        <h3 className="flex items-center gap-2 text-sm font-bold">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-black/50" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-black" />
          </span>
          Breaking News
        </h3>
        <span className="text-[11px] font-medium text-black/60">Stocks · RWA</span>
      </div>
      <div className="mt-2 max-h-[560px] overflow-y-auto px-4 pb-3">
        {isLoading && <p className="py-6 text-center text-xs text-black/50">Loading headlines…</p>}
        {!isLoading && (!news || news.length === 0) && (
          <p className="py-6 text-center text-xs text-black/50">No headlines right now.</p>
        )}
        {(news ?? []).slice(0, 14).map((n, i) => (
          <Item key={n.id} n={n} market={marketForTicker(markets, n.ticker)} index={i} />
        ))}
      </div>
    </motion.aside>
  );
}
