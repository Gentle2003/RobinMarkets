"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

// Set NEXT_PUBLIC_TOKEN_CA once the $RMS token launches to reveal a copyable address.
const TOKEN_CA = process.env.NEXT_PUBLIC_TOKEN_CA ?? "";

/** Token contract-address pill shown directly beneath the RobinMarkets wordmark. */
export function TokenCa() {
  const [copied, setCopied] = useState(false);

  const body = !TOKEN_CA ? (
    <span
      className="inline-flex items-center gap-1.5 rounded-md border border-border/70 bg-surface-2/50 px-2 py-1 text-[10px] font-medium text-muted"
      title="Token contract address — revealed at launch"
    >
      <span className="relative flex h-1.5 w-1.5">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-lime/50" />
        <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-lime/70" />
      </span>
      <span className="font-semibold text-white/60">$RMS CA</span>
      <span>soon</span>
    </span>
  ) : (
    <button
      type="button"
      onClick={() => {
        navigator.clipboard?.writeText(TOKEN_CA).catch(() => {});
        setCopied(true);
        setTimeout(() => setCopied(false), 1400);
      }}
      title={`Copy $RMS contract · ${TOKEN_CA}`}
      className="group inline-flex items-center gap-1.5 rounded-md border border-lime/30 bg-lime/10 px-2 py-1 text-[10px] font-semibold text-lime transition-colors hover:bg-lime/20"
    >
      <span className="font-bold">$RMS</span>
      <span className="font-mono text-white/80 group-hover:text-lime">
        {TOKEN_CA.slice(0, 6)}…{TOKEN_CA.slice(-4)}
      </span>
      <AnimatePresence mode="wait" initial={false}>
        {copied ? (
          <motion.svg
            key="check"
            initial={{ scale: 0.6, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ opacity: 0 }}
            viewBox="0 0 24 24"
            className="h-3 w-3"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
          >
            <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
          </motion.svg>
        ) : (
          <motion.svg
            key="copy"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            viewBox="0 0 24 24"
            className="h-3 w-3 opacity-70"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
          >
            <rect x="9" y="9" width="11" height="11" rx="2" />
            <path d="M5 15V5a2 2 0 012-2h10" />
          </motion.svg>
        )}
      </AnimatePresence>
    </button>
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.15, duration: 0.35 }}
      className="ml-10 flex items-center"
    >
      {body}
    </motion.div>
  );
}
