"use client";

import { motion } from "framer-motion";
import { priceToPct } from "@/lib/format";
import { PRICE_SCALE } from "@robinmarkets/shared";

/** Animated horizontal YES/NO split bar. `price` is the YES price (1e18). */
export function ProbabilityBar({ price, showLabels = true }: { price: bigint; showLabels?: boolean }) {
  const yesPct = Number((price * 10000n) / PRICE_SCALE) / 100;
  return (
    <div>
      {showLabels && (
        <div className="mb-1.5 flex items-center justify-between text-xs font-semibold">
          <span className="text-yes">Yes {priceToPct(price)}</span>
          <span className="text-no">No {priceToPct(PRICE_SCALE - price)}</span>
        </div>
      )}
      <div className="flex h-2 overflow-hidden rounded-full bg-surface-2">
        <motion.div
          className="h-full rounded-l-full bg-yes"
          initial={{ width: 0 }}
          animate={{ width: `${yesPct}%` }}
          transition={{ duration: 0.7, ease: "easeOut" }}
        />
        <div className="h-full flex-1 bg-no/70" />
      </div>
    </div>
  );
}
