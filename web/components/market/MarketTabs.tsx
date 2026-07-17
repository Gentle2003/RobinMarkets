"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import type { Market } from "@robinmarkets/shared";
import { MarketRules } from "./MarketRules";
import { MarketPositions } from "./MarketPositions";
import { MarketHolders } from "./MarketHolders";
import { MarketComments } from "./MarketComments";

const TABS = ["Rules", "Positions", "Top Holders", "Comments"] as const;
type Tab = (typeof TABS)[number];

export function MarketTabs({ market }: { market: Market }) {
  const [tab, setTab] = useState<Tab>("Rules");

  return (
    <div className="card p-4 sm:p-5">
      <div className="mb-4 flex gap-1 overflow-x-auto border-b border-border">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`relative whitespace-nowrap px-3 py-2 text-sm font-medium transition-colors ${
              tab === t ? "text-white" : "text-muted hover:text-white"
            }`}
          >
            {t}
            {tab === t && (
              <motion.span
                layoutId="market-tab-underline"
                className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-lime"
              />
            )}
          </button>
        ))}
      </div>

      <motion.div
        key={tab}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
      >
        {tab === "Rules" && <MarketRules market={market} />}
        {tab === "Positions" && <MarketPositions market={market} />}
        {tab === "Top Holders" && <MarketHolders market={market} />}
        {tab === "Comments" && <MarketComments market={market} />}
      </motion.div>
    </div>
  );
}
