"use client";

import { useMemo } from "react";
import { useAccount, usePublicClient, useReadContracts, useWriteContract } from "wagmi";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { conditionalTokensAbi, erc20Abi, type Market } from "@robinmarkets/shared";
import { useQueryClient } from "@tanstack/react-query";
import { useMarkets, useOrderbookConfig } from "@/lib/hooks";
import { fmtEth, sectorLabel } from "@/lib/format";

export default function PortfolioPage() {
  const { address, isConnected } = useAccount();
  const { data: cfg } = useOrderbookConfig();
  const { data: markets = [] } = useMarkets();
  const ctf = cfg?.addresses.conditionalTokens;
  const weth = cfg?.addresses.collateral;

  // Build a flat list of reads: WETH balance, then per market [yes, no, denominator].
  const contracts = useMemo(() => {
    if (!address || !ctf || !weth) return [];
    const list: any[] = [
      { address: weth, abi: erc20Abi, functionName: "balanceOf", args: [address] },
    ];
    for (const m of markets) {
      list.push({ address: ctf, abi: conditionalTokensAbi, functionName: "balanceOf", args: [address, BigInt(m.yesPositionId)] });
      list.push({ address: ctf, abi: conditionalTokensAbi, functionName: "balanceOf", args: [address, BigInt(m.noPositionId)] });
      list.push({ address: ctf, abi: conditionalTokensAbi, functionName: "payoutDenominator", args: [m.id] });
    }
    return list;
  }, [address, ctf, weth, markets]);

  const { data: reads } = useReadContracts({
    contracts,
    query: { enabled: contracts.length > 0, refetchInterval: 8000 },
  });

  if (!isConnected) {
    return (
      <div className="card flex flex-col items-center gap-4 p-10">
        <p className="text-sm text-muted">Connect your wallet to view positions.</p>
        <ConnectButton />
      </div>
    );
  }

  const wethBal = (reads?.[0]?.result as bigint) ?? 0n;
  const positions = markets
    .map((m, i) => {
      const base = 1 + i * 3;
      return {
        market: m,
        yes: (reads?.[base]?.result as bigint) ?? 0n,
        no: (reads?.[base + 1]?.result as bigint) ?? 0n,
        resolved: ((reads?.[base + 2]?.result as bigint) ?? 0n) > 0n,
      };
    })
    .filter((p) => p.yes > 0n || p.no > 0n);

  return (
    <div className="flex flex-col gap-6">
      <div className="card flex items-center justify-between p-5">
        <div>
          <div className="text-xs uppercase tracking-wide text-muted">WETH balance</div>
          <div className="text-2xl font-bold tabular">{fmtEth(wethBal)} WETH</div>
        </div>
      </div>

      <h1 className="text-lg font-bold">Your positions</h1>
      {positions.length === 0 ? (
        <div className="card p-6 text-sm text-muted">
          No positions yet. Buy Yes or No shares on a market to get started.
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {positions.map((p) => (
            <PositionRow key={p.market.id} {...p} ctf={ctf!} collateral={weth!} />
          ))}
        </div>
      )}
    </div>
  );
}

function PositionRow({
  market,
  yes,
  no,
  resolved,
  ctf,
  collateral,
}: {
  market: Market;
  yes: bigint;
  no: bigint;
  resolved: boolean;
  ctf: `0x${string}`;
  collateral: `0x${string}`;
}) {
  const { writeContractAsync, isPending } = useWriteContract();
  const publicClient = usePublicClient();
  const qc = useQueryClient();

  async function redeem() {
    const hash = await writeContractAsync({
      address: ctf,
      abi: conditionalTokensAbi,
      functionName: "redeemPositions",
      args: [collateral, market.id as `0x${string}`],
    });
    await publicClient?.waitForTransactionReceipt({ hash });
    qc.invalidateQueries();
  }

  return (
    <div className="card flex items-center justify-between gap-4 p-4">
      <div className="min-w-0">
        <div className="truncate text-sm font-semibold">{market.question}</div>
        <div className="text-xs text-muted">
          {market.underlying} · {sectorLabel(market.sector)}
        </div>
      </div>
      <div className="flex items-center gap-4">
        <div className="text-right">
          <div className="text-xs text-muted">Yes / No</div>
          <div className="tabular text-sm">
            <span className="text-yes">{fmtEth(yes, 1)}</span>
            {" / "}
            <span className="text-no">{fmtEth(no, 1)}</span>
          </div>
        </div>
        {resolved ? (
          <button className="btn-lime" disabled={isPending} onClick={redeem}>
            {isPending ? "Redeeming…" : "Redeem"}
          </button>
        ) : (
          <span className="pill bg-surface-2 text-muted">Open</span>
        )}
      </div>
    </div>
  );
}
