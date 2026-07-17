"use client";

import { useAccount, useReadContract } from "wagmi";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { conditionalTokensAbi, PRICE_SCALE, type Market } from "@robinmarkets/shared";
import { useBook, useOrderbookConfig } from "@/lib/hooks";
import { midPrice } from "@/lib/price";
import { fmtEth, fmtShares, priceToCents } from "@/lib/format";

export function MarketPositions({ market }: { market: Market }) {
  const { data: cfg } = useOrderbookConfig();
  const { address, isConnected } = useAccount();
  const ctf = cfg?.addresses.conditionalTokens;

  const { data: yesBook } = useBook(market.yesPositionId);
  const yesMid = midPrice(yesBook);
  const noMid = PRICE_SCALE - yesMid;

  const { data: yesRaw = 0n } = useReadContract({
    address: ctf,
    abi: conditionalTokensAbi,
    functionName: "balanceOf",
    args: address ? [address, BigInt(market.yesPositionId)] : undefined,
    query: { enabled: !!address && !!ctf, refetchInterval: 5000 },
  });
  const { data: noRaw = 0n } = useReadContract({
    address: ctf,
    abi: conditionalTokensAbi,
    functionName: "balanceOf",
    args: address ? [address, BigInt(market.noPositionId)] : undefined,
    query: { enabled: !!address && !!ctf, refetchInterval: 5000 },
  });

  if (!isConnected) {
    return (
      <div className="flex flex-col items-center gap-3 py-8 text-sm text-muted">
        <p>Connect your wallet to see your positions.</p>
        <ConnectButton />
      </div>
    );
  }

  const yes = yesRaw as bigint;
  const no = noRaw as bigint;
  if (yes === 0n && no === 0n) {
    return (
      <p className="py-8 text-center text-sm text-muted">
        You don’t hold any shares in this market yet.
      </p>
    );
  }

  const yesValue = (yes * yesMid) / PRICE_SCALE;
  const noValue = (no * noMid) / PRICE_SCALE;

  return (
    <div className="flex flex-col gap-3">
      {yes > 0n && <PositionRow outcome="YES" shares={yes} price={yesMid} value={yesValue} />}
      {no > 0n && <PositionRow outcome="NO" shares={no} price={noMid} value={noValue} />}
      <div className="flex items-center justify-between border-t border-border pt-3 text-sm">
        <span className="text-muted">Est. total value</span>
        <span className="font-semibold tabular">{fmtEth(yesValue + noValue)} ETH</span>
      </div>
      <p className="text-[11px] text-muted">
        Balances are read live from the ConditionalTokens contract. Value is marked at the current
        order-book mid price.
      </p>
    </div>
  );
}

function PositionRow({
  outcome,
  shares,
  price,
  value,
}: {
  outcome: "YES" | "NO";
  shares: bigint;
  price: bigint;
  value: bigint;
}) {
  const yes = outcome === "YES";
  return (
    <div className="flex items-center justify-between rounded-xl border border-border bg-surface-2/40 px-4 py-3">
      <div className="flex items-center gap-3">
        <span className={`pill ${yes ? "bg-yes/10 text-yes" : "bg-no/10 text-no"}`}>{outcome}</span>
        <div>
          <div className="text-sm font-semibold tabular">{fmtShares(shares)} shares</div>
          <div className="text-xs text-muted">@ {priceToCents(price)}</div>
        </div>
      </div>
      <div className="text-right">
        <div className="text-sm font-semibold tabular">{fmtEth(value)} ETH</div>
        <div className="text-[11px] text-muted">market value</div>
      </div>
    </div>
  );
}
