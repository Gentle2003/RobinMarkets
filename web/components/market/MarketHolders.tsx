"use client";

import { motion } from "framer-motion";
import type { Market } from "@robinmarkets/shared";
import { useHolders } from "@/lib/hooks";
import type { Holder } from "@/lib/orderbook";
import { shortHash } from "@/lib/format";

function shares(wei: string): string {
  const n = Number(BigInt(wei) / 10n ** 15n) / 1000;
  return n >= 1000 ? `${(n / 1000).toFixed(1)}k` : n.toFixed(n < 10 ? 1 : 0);
}

function Column({ title, side, holders }: { title: string; side: "YES" | "NO"; holders: Holder[] }) {
  const yes = side === "YES";
  return (
    <div className="flex flex-1 flex-col gap-2">
      <div className={`text-xs font-bold ${yes ? "text-yes" : "text-no"}`}>{title}</div>
      {holders.length === 0 ? (
        <div className="rounded-lg border border-border/60 px-3 py-4 text-center text-xs text-muted">
          No holders yet
        </div>
      ) : (
        <div className="flex flex-col divide-y divide-border/50">
          {holders.map((h, i) => (
            <motion.div
              key={h.address}
              initial={{ opacity: 0, x: yes ? -8 : 8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.04 }}
              className="flex items-center justify-between gap-2 py-2 text-sm"
            >
              <div className="flex min-w-0 items-center gap-2">
                <span className="w-4 shrink-0 text-right text-[11px] tabular text-muted">{i + 1}</span>
                <span className="truncate text-xs">
                  {h.username ? (
                    <span className="font-semibold text-white/90">@{h.username}</span>
                  ) : (
                    <span className="font-mono text-white/70">{shortHash(h.address)}</span>
                  )}
                </span>
              </div>
              <span className={`shrink-0 tabular text-xs font-semibold ${yes ? "text-yes" : "text-no"}`}>
                {shares(h.shares)}
              </span>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}

export function MarketHolders({ market }: { market: Market }) {
  const { data, isLoading, isError } = useHolders(market.id);

  if (isLoading) {
    return <div className="py-6 text-center text-xs text-muted">Reading holders on-chain…</div>;
  }
  if (isError || !data) {
    return <div className="py-6 text-center text-xs text-muted">Couldn&apos;t load holders.</div>;
  }

  const empty = data.yes.length === 0 && data.no.length === 0;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between text-[11px] text-muted">
        <span>Largest position holders · live on-chain</span>
        <span className="pill bg-surface-2">Top {Math.max(data.yes.length, data.no.length)}</span>
      </div>
      {empty ? (
        <div className="rounded-lg border border-border/60 px-3 py-6 text-center text-xs text-muted">
          No positions held yet — be the first to take a side.
        </div>
      ) : (
        <div className="flex flex-col gap-5 sm:flex-row sm:gap-8">
          <Column title="Top YES holders" side="YES" holders={data.yes} />
          <div className="hidden w-px self-stretch bg-border/60 sm:block" />
          <Column title="Top NO holders" side="NO" holders={data.no} />
        </div>
      )}
    </div>
  );
}
