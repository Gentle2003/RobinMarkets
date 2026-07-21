"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { LogoArrow } from "./Logo";
import { smoothScrollToId } from "@/lib/scroll";

interface Step {
  icon: string;
  title: string;
  body: string;
  visual: React.ReactNode;
}

/** A mini market-card mock for step 1. */
function MarketMock() {
  return (
    <div className="w-full max-w-[260px] rounded-2xl border border-white/10 bg-black/30 p-4 text-left">
      <div className="flex items-center gap-2 text-sm font-semibold">🍎 AAPL <span className="pill bg-yes/10 text-yes">Daily</span></div>
      <p className="mt-2 text-sm text-white/90">Will AAPL close above $335 today?</p>
      <div className="mt-3 flex items-baseline gap-1">
        <span className="text-3xl font-bold text-yes">61</span>
        <span className="font-bold text-yes">%</span>
        <span className="ml-1 text-xs text-muted">yes chance</span>
      </div>
    </div>
  );
}

/** A Yes/No buy mock for step 2. */
function BuyMock() {
  return (
    <div className="w-full max-w-[260px] rounded-2xl border border-white/10 bg-black/30 p-4 text-left">
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-xl border border-yes bg-yes/10 py-2 text-center text-sm font-bold text-yes">YES</div>
        <div className="rounded-xl border border-border py-2 text-center text-sm font-bold text-muted">NO</div>
      </div>
      <div className="mt-3 flex items-center justify-between rounded-xl border border-border px-3 py-2 text-sm">
        <span className="text-muted">Amount</span>
        <span className="font-semibold">$50</span>
      </div>
      <div className="mt-2 flex items-center justify-between text-xs">
        <span className="text-muted">Payout if Yes</span>
        <span className="font-semibold text-yes">$82.00</span>
      </div>
    </div>
  );
}

/** A win / redeem mock for step 3. */
function WinMock() {
  return (
    <div className="w-full max-w-[260px] rounded-2xl border border-lime/40 bg-black/30 p-4 text-center">
      <div className="text-4xl">🏆</div>
      <p className="mt-2 text-sm font-semibold text-yes">Resolved YES — you were right</p>
      <div className="mt-3 rounded-xl bg-black/20 py-2 text-sm font-bold text-white">Redeem 0.0445 ETH</div>
    </div>
  );
}

const STEPS: Step[] = [
  {
    icon: "🎯",
    title: "Pick a prediction",
    body: "Choose a Stock or RWA market — new ones open daily, weekly and monthly. From “Will AAPL close above $335 today?” to SpaceX and the Fed.",
    visual: <MarketMock />,
  },
  {
    icon: "💵",
    title: "Buy Yes or No",
    body: "Enter a dollar amount and pick a side. The price is the market’s odds — a 61¢ Yes means a 61% chance. Each winning share pays out $1.",
    visual: <BuyMock />,
  },
  {
    icon: "🏆",
    title: "Win & redeem",
    body: "When the market resolves on real price data, redeem your winnings in Robinhood ETH. Non-custodial, gasless orders, settled on-chain.",
    visual: <WinMock />,
  },
];

export function HowItWorksButton({ className = "" }: { className?: string }) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const s = STEPS[step];
  const last = step === STEPS.length - 1;

  function close() {
    setOpen(false);
    setStep(0);
  }

  const modal = (
    <AnimatePresence>
      {open && (
          <motion.div
            className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={close}
          >
            <motion.div
              className="w-full max-w-lg overflow-hidden rounded-2xl border border-lime/30 bg-lime/10 shadow-[0_20px_80px_-20px_rgba(195,245,60,0.35)] backdrop-blur-2xl"
              initial={{ scale: 0.94, y: 12 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.94, y: 12 }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* header + progress */}
              <div className="flex items-center justify-between px-6 pt-5">
                <h2 className="text-base font-bold">
                  How <span className="text-lime">RobinMarkets</span> works
                </h2>
                <button onClick={close} className="text-muted hover:text-white">
                  ✕
                </button>
              </div>
              <div className="mt-4 flex gap-1.5 px-6">
                {STEPS.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setStep(i)}
                    className={`h-1.5 flex-1 rounded-full transition-colors ${
                      i <= step ? "bg-lime" : "bg-black/25"
                    }`}
                  />
                ))}
              </div>

              {/* animated step */}
              <div className="min-h-[320px] px-6 py-6">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={step}
                    initial={{ opacity: 0, x: 24 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -24 }}
                    transition={{ duration: 0.28 }}
                    className="flex flex-col items-center gap-5 text-center"
                  >
                    <div className="grid place-items-center">{s.visual}</div>
                    <div>
                      <div className="flex items-center justify-center gap-2 text-lg font-bold">
                        <span className="grid h-7 w-7 place-items-center rounded-full bg-lime text-sm text-black">
                          {step + 1}
                        </span>
                        {s.icon} {s.title}
                      </div>
                      <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-muted">{s.body}</p>
                    </div>
                  </motion.div>
                </AnimatePresence>
              </div>

              {/* footer nav */}
              <div className="flex items-center justify-between gap-3 border-t border-lime/20 px-6 py-4">
                <button
                  className="btn-ghost text-sm disabled:opacity-30"
                  onClick={() => setStep((v) => Math.max(0, v - 1))}
                  disabled={step === 0}
                >
                  Back
                </button>
                {last ? (
                  <button
                    className="btn-lime gap-2"
                    onClick={() => {
                      close();
                      smoothScrollToId("markets");
                    }}
                  >
                    Start predicting
                    <LogoArrow className="h-5 w-5" />
                  </button>
                ) : (
                  <button className="btn-lime" onClick={() => setStep((v) => v + 1)}>
                    Next
                  </button>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
  );

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={`rounded-lg px-3 py-1.5 text-sm font-medium text-muted transition-colors hover:text-white ${className}`}
      >
        How it works
      </button>
      {mounted && createPortal(modal, document.body)}
    </>
  );
}
