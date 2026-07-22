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

function NewsCard({ n, market, index }: { n: NewsItem; market?: Market; index: number }) {
  return (
    <div className="flex w-[260px] shrink-0 snap-start flex-col gap-2 rounded-xl border border-border bg-surface/60 p-3 transition-colors hover:border-lime-dim">
      <div className="flex items-center gap-1.5 text-[11px] text-muted">
        <span className="grid h-4 w-4 place-items-center rounded bg-lime/15 text-[10px] font-bold text-lime">
          {index + 1}
        </span>
        <span className="font-semibold text-white/80">{n.ticker}</span>
        {n.publisher && <span className="truncate">· {n.publisher}</span>}
        {n.timestamp > 0 && <span className="ml-auto shrink-0">{timeAgo(n.timestamp)}</span>}
      </div>

      {/* Headline opens the actual news article. */}
      <a
        href={n.url}
        target="_blank"
        rel="noreferrer"
        className="line-clamp-3 text-[13px] font-medium leading-snug text-white/90 hover:text-white hover:underline"
      >
        {n.title}
      </a>

      {/* Trade button jumps to the related market. */}
      {market && (
        <Link
          href={`/market/${market.id}`}
          className="mt-auto inline-flex w-fit items-center gap-1 rounded-full bg-lime/15 px-2.5 py-1 text-[11px] font-semibold text-lime ring-1 ring-lime/30 transition-colors hover:bg-lime/25"
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
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="card p-4"
    >
      <div className="mb-3 flex items-center gap-2">
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-lime/60" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-lime" />
        </span>
        <h3 className="text-sm font-bold text-white">Breaking News</h3>
        <span className="text-[11px] font-medium text-muted">Stocks · RWA</span>
        <span className="ml-auto hidden text-[11px] text-muted sm:inline">scroll for more →</span>
      </div>

      {isLoading && <p className="py-6 text-center text-xs text-muted">Loading headlines…</p>}
      {!isLoading && (!news || news.length === 0) && (
        <p className="py-6 text-center text-xs text-muted">No headlines right now.</p>
      )}

      {news && news.length > 0 && (
        <div className="flex snap-x gap-3 overflow-x-auto pb-1 [scrollbar-width:thin]">
          {news.slice(0, 16).map((n, i) => (
            <NewsCard key={n.id} n={n} market={marketForTicker(markets, n.ticker)} index={i} />
          ))}
        </div>
      )}
    </motion.section>
  );
}
