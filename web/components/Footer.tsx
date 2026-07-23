"use client";

import Link from "next/link";
import { chainsById } from "@robinmarkets/shared";
import { useOrderbookConfig } from "@/lib/hooks";
import { LogoBadge } from "./Logo";
import { shortHash } from "@/lib/format";

function Social({ href, label, children }: { href: string; label: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      aria-label={label}
      className="grid h-9 w-9 place-items-center rounded-lg border border-border text-muted transition-colors hover:border-lime-dim hover:text-lime"
    >
      {children}
    </a>
  );
}

function ContractRow({ label, address, explorer }: { label: string; address?: string; explorer?: string }) {
  if (!address) return null;
  const inner = (
    <span className="font-mono text-xs text-white/80 transition-colors group-hover:text-lime">
      {shortHash(address)}
    </span>
  );
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-xs text-muted">{label}</span>
      {explorer ? (
        <a href={`${explorer}/address/${address}`} target="_blank" rel="noreferrer" className="group">
          {inner}
        </a>
      ) : (
        inner
      )}
    </div>
  );
}

export function Footer() {
  const { data: cfg } = useOrderbookConfig();
  const chain = cfg ? chainsById[cfg.chainId as keyof typeof chainsById] : undefined;
  const explorer = chain?.blockExplorers?.default.url;
  const a = cfg?.addresses;

  return (
    <footer className="relative mt-20 border-t border-border bg-surface/40 backdrop-blur">
      <div className="mx-auto grid w-full max-w-5xl grid-cols-1 gap-10 px-4 py-12 sm:grid-cols-2 lg:grid-cols-4">
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-2">
            <LogoBadge className="h-9 w-9" />
            <span className="text-lg font-bold tracking-tight">
              Robin<span className="text-lime">Markets</span>
            </span>
          </div>
          <p className="text-sm text-muted">
            A prediction market for tokenized Stocks &amp; Real-World Assets, settled on Robinhood
            Chain.
          </p>
          <div className="flex gap-2">
            <Social href="https://x.com" label="X / Twitter">
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
                <path d="M18.9 2H22l-7.4 8.5L23 22h-6.8l-5.3-6.9L4.8 22H1.7l7.9-9L1 2h7l4.8 6.3L18.9 2Zm-2.4 18h1.9L7.6 4H5.6l10.9 16Z" />
              </svg>
            </Social>
            <Social href="https://medium.com/@robinmarkets.app" label="Medium">
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
                <path d="M13.54 12a6.8 6.8 0 0 1-6.77 6.82A6.8 6.8 0 0 1 0 12a6.8 6.8 0 0 1 6.77-6.82A6.8 6.8 0 0 1 13.54 12zM20.96 12c0 3.54-1.51 6.42-3.38 6.42s-3.39-2.88-3.39-6.42 1.52-6.42 3.39-6.42 3.38 2.88 3.38 6.42M24 12c0 3.17-.53 5.75-1.19 5.75s-1.19-2.58-1.19-5.75.53-5.75 1.19-5.75S24 8.83 24 12z" />
              </svg>
            </Social>
            <Social href="mailto:rms@robinmarkets.app" label="Email rms@robinmarkets.app">
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
                <rect x="3" y="5" width="18" height="14" rx="2" />
                <path d="M3 7l9 6 9-6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </Social>
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">Product</h3>
          <Link href="/" className="text-sm text-white/80 hover:text-lime">Markets</Link>
          <Link href="/portfolio" className="text-sm text-white/80 hover:text-lime">Portfolio</Link>
          <a href="https://docs.robinhood.com/chain/" target="_blank" rel="noreferrer" className="text-sm text-white/80 hover:text-lime">Robinhood Chain</a>
        </div>

        <div className="flex flex-col gap-3 lg:col-span-2">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">
            Contracts {chain ? `· ${chain.name}` : ""}
          </h3>
          <div className="card flex flex-col gap-2 p-4">
            <ContractRow label="Exchange" address={a?.ctfExchange} explorer={explorer} />
            <ContractRow label="Conditional Tokens" address={a?.conditionalTokens} explorer={explorer} />
            <ContractRow label="Market Factory" address={a?.marketFactory} explorer={explorer} />
            <ContractRow label="Resolver" address={a?.resolver} explorer={explorer} />
            <ContractRow label="Collateral (Wrapped ETH)" address={a?.collateral} explorer={explorer} />
            {!a && <span className="text-xs text-muted">Connecting to order book…</span>}
          </div>
        </div>
      </div>

      <div className="border-t border-border">
        <div className="mx-auto w-full max-w-5xl px-4 py-6">
          <p className="text-[11px] leading-relaxed text-muted">
            <span className="font-semibold text-white/70">Disclaimer.</span> RobinMarkets is
            experimental, unaudited software provided “as is” for demonstration on Robinhood Chain
            test networks. Nothing here is financial, investment, legal, or tax advice, an offer, or
            a solicitation. Prediction markets and tokenized real-world assets carry risk, including
            total loss of funds, and may be restricted in your jurisdiction. Do not trade with funds
            you cannot afford to lose. You are solely responsible for compliance with applicable laws.
          </p>
          <p className="mt-3 text-[11px] text-muted">
            © {new Date().getFullYear()} RobinMarkets · Not affiliated with Robinhood Markets, Inc.
          </p>
        </div>
      </div>
    </footer>
  );
}
