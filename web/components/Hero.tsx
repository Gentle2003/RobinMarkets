"use client";

import { motion } from "framer-motion";
import { useMarkets, useStats } from "@/lib/hooks";
import { AnimatedNumber } from "./AnimatedNumber";
import { formatVolume } from "@/lib/derived";
import { smoothScrollToId } from "@/lib/scroll";
import { LogoArrow } from "./Logo";

function LiveDot() {
  return (
    <span className="relative flex h-2 w-2">
      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-yes opacity-70" />
      <span className="relative inline-flex h-2 w-2 rounded-full bg-yes" />
    </span>
  );
}

function StatTile({
  label,
  children,
  live,
}: {
  label: string;
  children: React.ReactNode;
  live?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1 rounded-xl border border-border bg-surface-2/60 px-4 py-3 backdrop-blur">
      <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-muted">
        {live && <LiveDot />}
        {label}
      </div>
      <div className="text-xl font-bold tabular text-white sm:text-2xl">{children}</div>
    </div>
  );
}

export function Hero() {
  const { data: markets } = useMarkets();
  const { data: stats } = useStats();

  const volume = stats?.volume24h ?? 0;
  const trades = stats?.trades24h ?? 0;
  const marketCount = stats?.markets ?? markets?.length ?? 0;

  return (
    <section className="relative overflow-hidden rounded-3xl border border-border p-6 sm:p-10">
      {/* layered brand glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background:
            "radial-gradient(80% 120% at 0% 0%, rgba(195,245,60,0.14), transparent 55%), radial-gradient(70% 120% at 100% 20%, rgba(0,209,121,0.10), transparent 55%)",
        }}
      />

      <div className="mb-5 flex items-center justify-between gap-3">
        <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted">
          On-chain prediction market
        </span>
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.15 }}
          className="inline-flex items-center gap-2 rounded-full border border-lime/30 bg-lime/10 px-3 py-1 text-xs font-medium text-lime"
        >
          <LiveDot />
          Live on Robinhood Chain · Testnet
        </motion.div>
      </div>

      <motion.h1
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="max-w-3xl text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-6xl"
      >
        <span className="animate-gradient bg-gradient-to-r from-lime via-yes to-lime bg-clip-text text-transparent">
          Predict
        </span>{" "}
        the future of{" "}
        <span className="animate-gradient bg-gradient-to-r from-yes via-lime to-yes bg-clip-text text-transparent">
          Stocks
        </span>{" "}
        &amp; <span className="whitespace-nowrap">Real-World Assets</span>
      </motion.h1>

      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.15, duration: 0.5 }}
        className="mt-4 max-w-xl text-sm text-muted sm:text-base"
      >
        Buy and sell binary “Yes / No” shares on where tokenized equities and RWAs are headed.
        Orders are signed off-chain and settle on-chain — no custody, no middleman.
      </motion.p>

      <div className="mt-8 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        {/* vertical CTA stack */}
        <div className="flex flex-col gap-3 lg:w-56 lg:shrink-0">
          <a
            href="#markets"
            onClick={(e) => {
              e.preventDefault();
              smoothScrollToId("markets");
            }}
            className="btn-lime w-full gap-2 py-3 text-base"
          >
            Explore Markets
            <LogoArrow className="h-5 w-5" />
          </a>
          <a
            href="#activity"
            onClick={(e) => {
              e.preventDefault();
              smoothScrollToId("activity");
            }}
            className="btn-lime-soft w-full py-3"
          >
            View Live Activity
          </a>
        </div>

        {/* stats grid */}
        <div className="grid flex-1 grid-cols-2 gap-3 sm:grid-cols-4">
          <StatTile label="Markets">
            <AnimatedNumber value={marketCount} format={(n) => n.toFixed(0)} />
          </StatTile>
          <StatTile label="24h Volume" live>
            <AnimatedNumber value={volume} format={(n) => formatVolume(n)} />
          </StatTile>
          <StatTile label="24h Trades" live>
            <AnimatedNumber value={trades} format={(n) => Math.round(n).toLocaleString()} />
          </StatTile>
          <StatTile label="Sectors">2</StatTile>
        </div>
      </div>
    </section>
  );
}
