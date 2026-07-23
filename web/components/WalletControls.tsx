"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useAccount, useChainId, useSwitchChain } from "wagmi";
import { useAccountModal, useConnectModal } from "@rainbow-me/rainbowkit";
import { robinhoodChainTestnet } from "@robinmarkets/shared";
import { useProfile } from "@/lib/hooks";
import { shortHash } from "@/lib/format";

const TESTNET = robinhoodChainTestnet.id;

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={`h-3 w-3 transition-transform ${open ? "rotate-180" : ""}`}
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
    >
      <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/**
 * Compact wallet bar: a small network selector (Robinhood Chain Testnet, plus
 * Mainnet shown as "Soon") and a profile chip showing the @username that opens
 * the wallet details. Replaces the three wide RainbowKit pills.
 */
export function WalletControls() {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { switchChain } = useSwitchChain();
  const { openConnectModal } = useConnectModal();
  const { openAccountModal } = useAccountModal();
  const { data: username } = useProfile(address);
  const [netOpen, setNetOpen] = useState(false);

  if (!isConnected) {
    return (
      <button onClick={() => openConnectModal?.()} className="btn-lime px-4 py-2 text-sm">
        Connect Wallet
      </button>
    );
  }

  const onTestnet = chainId === TESTNET;
  const label = username ? `@${username}` : shortHash(address ?? "");
  const initial = username ? username[0].toUpperCase() : address ? address[2].toUpperCase() : "?";

  return (
    <div className="flex items-center gap-2">
      {/* Network selector */}
      <div className="relative">
        <button
          onClick={() => setNetOpen((o) => !o)}
          className={`inline-flex items-center gap-1.5 rounded-xl border px-2.5 py-2 text-xs font-semibold transition-colors ${
            onTestnet
              ? "border-border bg-surface-2 text-white hover:border-lime-dim"
              : "border-no/40 bg-no/10 text-no"
          }`}
        >
          <span className={`h-1.5 w-1.5 rounded-full ${onTestnet ? "bg-lime" : "bg-no"}`} />
          <span className="hidden sm:inline">{onTestnet ? "Testnet" : "Wrong network"}</span>
          <Chevron open={netOpen} />
        </button>

        <AnimatePresence>
          {netOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setNetOpen(false)} />
              <motion.div
                initial={{ opacity: 0, y: -6, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -6, scale: 0.98 }}
                transition={{ duration: 0.15 }}
                className="absolute right-0 z-50 mt-2 w-60 overflow-hidden rounded-xl border border-border bg-surface p-1 shadow-[0_20px_60px_-20px_rgba(0,0,0,0.8)]"
              >
                <div className="px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wide text-muted">
                  Network
                </div>
                <button
                  onClick={() => {
                    if (!onTestnet) switchChain({ chainId: TESTNET });
                    setNetOpen(false);
                  }}
                  className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm transition-colors hover:bg-surface-2"
                >
                  <span className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-lime" />
                    Robinhood Chain Testnet
                  </span>
                  {onTestnet && <span className="text-xs font-bold text-lime">✓</span>}
                </button>
                <div className="flex w-full cursor-not-allowed items-center justify-between rounded-lg px-3 py-2 text-sm text-muted">
                  <span className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-muted/40" />
                    Robinhood Chain Mainnet
                  </span>
                  <span className="rounded-full bg-surface-2 px-2 py-0.5 text-[10px] font-semibold text-muted">
                    Soon
                  </span>
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </div>

      {/* Profile chip → wallet details (address, balance, disconnect) */}
      <button
        onClick={() => openAccountModal?.()}
        className="inline-flex items-center gap-2 rounded-xl border border-border bg-surface-2 py-1.5 pl-1.5 pr-2.5 text-sm font-semibold transition-colors hover:border-lime-dim"
        title="View wallet"
      >
        <span className="grid h-6 w-6 place-items-center rounded-lg bg-gradient-to-br from-lime to-lime-bright text-[11px] font-bold text-black">
          {initial}
        </span>
        <span className="max-w-[130px] truncate text-white">{label}</span>
      </button>
    </div>
  );
}
