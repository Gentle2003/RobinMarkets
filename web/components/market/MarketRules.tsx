"use client";

import { chainsById, type Market } from "@robinmarkets/shared";
import { useOrderbookConfig } from "@/lib/hooks";
import { shortHash } from "@/lib/format";

const ZERO = "0x0000000000000000000000000000000000000000";

const STATUS_LABEL: Record<Market["status"], string> = {
  OPEN: "Open for trading",
  PAUSED: "Paused",
  RESOLVING: "Resolving",
  RESOLVED: "Resolved",
};

function fmtDate(unix: number): string {
  return new Date(unix * 1000).toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function MarketRules({ market }: { market: Market }) {
  const { data: cfg } = useOrderbookConfig();
  const chain = cfg ? chainsById[cfg.chainId as keyof typeof chainsById] : undefined;
  const explorer = chain?.blockExplorers?.default.url;
  const feed = market.priceFeed && market.priceFeed !== ZERO ? market.priceFeed : undefined;

  return (
    <div className="flex flex-col gap-5 text-sm">
      <div>
        <h3 className="mb-1.5 font-semibold text-white">Resolution</h3>
        <p className="leading-relaxed text-muted">
          This market resolves <span className="font-medium text-yes">Yes</span> if the following is
          true at resolution, otherwise <span className="font-medium text-no">No</span>:{" "}
          <span className="text-white/90">“{market.question}”</span> Each winning share redeems for{" "}
          <span className="text-white">1 WETH</span>; losing shares expire worthless.
        </p>
      </div>

      {market.description && <p className="leading-relaxed text-muted">{market.description}</p>}

      <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Row label="Trading closes" value={fmtDate(market.closeTime)} />
        <Row label="Resolves after" value={fmtDate(market.resolveTime)} />
        <Row label="Collateral" value="WETH (wrapped Robinhood ETH)" />
        <Row
          label="Resolution source"
          value={feed ? "Chainlink price feed" : "Admin / oracle"}
          sub={feed ? shortHash(feed) : undefined}
          href={feed && explorer ? `${explorer}/address/${feed}` : undefined}
        />
        <Row label="Condition ID" value={shortHash(market.id)} mono />
        <Row label="Status" value={STATUS_LABEL[market.status]} />
      </dl>

      <div className="rounded-xl border border-border bg-surface-2/50 p-3 text-xs leading-relaxed text-muted">
        Prices are the market’s implied probability — e.g. a Yes price of 62¢ ≈ a 62% chance.
        Orders are signed off-chain and settle on-chain through the CTF Exchange. This is
        experimental testnet software and not investment advice.
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  sub,
  href,
  mono,
}: {
  label: string;
  value: string;
  sub?: string;
  href?: string;
  mono?: boolean;
}) {
  return (
    <div className="flex flex-col gap-0.5 rounded-lg border border-border bg-surface-2/40 px-3 py-2">
      <span className="text-[11px] uppercase tracking-wide text-muted">{label}</span>
      {href ? (
        <a
          href={href}
          target="_blank"
          rel="noreferrer"
          className={`text-white transition-colors hover:text-lime ${mono ? "font-mono text-xs" : ""}`}
        >
          {value}
          {sub && <span className="ml-1 font-mono text-xs text-muted">{sub}</span>}
        </a>
      ) : (
        <span className={`text-white ${mono ? "font-mono text-xs" : ""}`}>
          {value}
          {sub && <span className="ml-1 font-mono text-xs text-muted">{sub}</span>}
        </span>
      )}
    </div>
  );
}
