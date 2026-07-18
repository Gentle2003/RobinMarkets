"use client";

import { useState } from "react";
import { useAccount, usePublicClient, useReadContract, useWriteContract } from "wagmi";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useQueryClient } from "@tanstack/react-query";
import { conditionalTokensAbi, Outcome, PRICE_SCALE, type Market } from "@robinmarkets/shared";
import { useBook, useOrderbookConfig } from "@/lib/hooks";
import { midPrice } from "@/lib/price";
import { fmtEth, fmtShares, priceToCents } from "@/lib/format";

export function MarketPositions({ market }: { market: Market }) {
  const { data: cfg } = useOrderbookConfig();
  const { address, isConnected } = useAccount();
  const publicClient = usePublicClient();
  const { writeContractAsync } = useWriteContract();
  const qc = useQueryClient();
  const ctf = cfg?.addresses.conditionalTokens;

  const [redeeming, setRedeeming] = useState(false);
  const [status, setStatus] = useState("");

  const { data: yesBook } = useBook(market.yesPositionId);
  const yesMid = midPrice(yesBook);
  const noMid = PRICE_SCALE - yesMid;

  const { data: yesRaw = 0n, refetch: refetchYes } = useReadContract({
    address: ctf,
    abi: conditionalTokensAbi,
    functionName: "balanceOf",
    args: address ? [address, BigInt(market.yesPositionId)] : undefined,
    query: { enabled: !!address && !!ctf, refetchInterval: 5000 },
  });
  const { data: noRaw = 0n, refetch: refetchNo } = useReadContract({
    address: ctf,
    abi: conditionalTokensAbi,
    functionName: "balanceOf",
    args: address ? [address, BigInt(market.noPositionId)] : undefined,
    query: { enabled: !!address && !!ctf, refetchInterval: 5000 },
  });

  const resolved = market.status === "RESOLVED";
  const yesWon = market.resolvedOutcome === Outcome.YES;

  async function redeem() {
    if (!ctf || !cfg || !publicClient) return;
    setRedeeming(true);
    setStatus("Redeeming…");
    try {
      const hash = await writeContractAsync({
        address: ctf,
        abi: conditionalTokensAbi,
        functionName: "redeemPositions",
        args: [cfg.addresses.collateral, market.id as `0x${string}`],
      });
      await publicClient.waitForTransactionReceipt({ hash });
      setStatus("Redeemed ✓");
      refetchYes();
      refetchNo();
      qc.invalidateQueries();
    } catch (e) {
      setStatus((e as Error).message.split("\n")[0]);
    } finally {
      setRedeeming(false);
    }
  }

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

  const yesValue = resolved ? (yesWon ? yes : 0n) : (yes * yesMid) / PRICE_SCALE;
  const noValue = resolved ? (yesWon ? 0n : no) : (no * noMid) / PRICE_SCALE;
  const redeemable = yesValue + noValue;

  return (
    <div className="flex flex-col gap-3">
      {resolved && (
        <div
          className={`rounded-xl border px-4 py-3 text-sm ${
            yesWon ? "border-yes/40 bg-yes/10 text-yes" : "border-no/40 bg-no/10 text-no"
          }`}
        >
          Market resolved — <b>{yesWon ? "YES" : "NO"}</b> won. Winning shares redeem for 1 ETH each.
        </div>
      )}

      {yes > 0n && (
        <PositionRow outcome="YES" shares={yes} price={yesMid} value={yesValue} resolved={resolved} won={yesWon} />
      )}
      {no > 0n && (
        <PositionRow outcome="NO" shares={no} price={noMid} value={noValue} resolved={resolved} won={!yesWon} />
      )}

      <div className="flex items-center justify-between border-t border-border pt-3 text-sm">
        <span className="text-muted">{resolved ? "Redeemable" : "Est. total value"}</span>
        <span className="font-semibold tabular">{fmtEth(redeemable)} ETH</span>
      </div>

      {resolved && redeemable > 0n && (
        <button className="btn-lime" disabled={redeeming} onClick={redeem}>
          {redeeming ? "Redeeming…" : `Redeem ${fmtEth(redeemable, 5)} ETH`}
        </button>
      )}
      {status && <p className="text-center text-xs text-muted">{status}</p>}

      {!resolved && (
        <p className="text-[11px] text-muted">
          Balances are read live from the ConditionalTokens contract. Value is marked at the current
          order-book mid price.
        </p>
      )}
    </div>
  );
}

function PositionRow({
  outcome,
  shares,
  price,
  value,
  resolved,
  won,
}: {
  outcome: "YES" | "NO";
  shares: bigint;
  price: bigint;
  value: bigint;
  resolved: boolean;
  won: boolean;
}) {
  const yes = outcome === "YES";
  return (
    <div className="flex items-center justify-between rounded-xl border border-border bg-surface-2/40 px-4 py-3">
      <div className="flex items-center gap-3">
        <span className={`pill ${yes ? "bg-yes/10 text-yes" : "bg-no/10 text-no"}`}>{outcome}</span>
        <div>
          <div className="text-sm font-semibold tabular">{fmtShares(shares)} shares</div>
          <div className="text-xs text-muted">
            {resolved ? (won ? "winning" : "worthless") : `@ ${priceToCents(price)}`}
          </div>
        </div>
      </div>
      <div className="text-right">
        <div className="text-sm font-semibold tabular">{fmtEth(value)} ETH</div>
        <div className="text-[11px] text-muted">{resolved ? "redeemable" : "market value"}</div>
      </div>
    </div>
  );
}
