"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogoBadge } from "./Logo";
import { HowItWorksButton } from "./HowItWorks";
import { TokenCa } from "./TokenCa";
import { WalletControls } from "./WalletControls";

export function Header() {
  const pathname = usePathname();
  const nav = [
    { href: "/", label: "Markets" },
    { href: "/portfolio", label: "Portfolio" },
  ];

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-canvas/80 backdrop-blur">
      <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-4 py-3">
        <div className="flex items-center gap-8">
          <div className="flex flex-col gap-1">
            <Link href="/" className="flex items-center gap-2">
              <LogoBadge className="h-8 w-8" />
              <span className="text-lg font-bold tracking-tight">
                Robin<span className="text-lime">Markets</span>
              </span>
            </Link>
            <TokenCa />
          </div>
          <nav className="hidden gap-1 sm:flex">
            {nav.map((n) => {
              const active = n.href === "/" ? pathname === "/" : pathname.startsWith(n.href);
              return (
                <Link
                  key={n.href}
                  href={n.href}
                  className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
                    active ? "bg-surface-2 text-white" : "text-muted hover:text-white"
                  }`}
                >
                  {n.label}
                </Link>
              );
            })}
            <HowItWorksButton />
          </nav>
        </div>
        <div className="flex items-center gap-2">
          <WalletControls />
        </div>
      </div>
    </header>
  );
}
