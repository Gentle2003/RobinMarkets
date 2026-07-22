"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { formatEther } from "viem";
import {
  useAccount,
  useBalance,
  usePublicClient,
  useReadContracts,
  useSignMessage,
  useWriteContract,
} from "wagmi";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { conditionalTokensAbi, erc20Abi, type Market } from "@robinmarkets/shared";
import { useQueryClient } from "@tanstack/react-query";
import { useMarkets, useOrderbookConfig, useRewards, useUserStats } from "@/lib/hooks";
import { claimReward, type Reward } from "@/lib/orderbook";
import { fmtEth, sectorLabel, shortHash } from "@/lib/format";
import { formatVolume } from "@/lib/derived";
import { AssetIcon } from "@/components/AssetIcon";

const fade = {
  hidden: { opacity: 0, y: 16 },
  show: (i = 0) => ({ opacity: 1, y: 0, transition: { duration: 0.35, delay: i * 0.05 } }),
};

export default function PortfolioPage() {
  const { address, isConnected } = useAccount();
  const { data: cfg } = useOrderbookConfig();
  const { data: markets = [] } = useMarkets();
  const { data: stats } = useUserStats(address);
  const { data: rewardsData } = useRewards(address);
  const { data: nativeBal } = useBalance({ address });

  const ctf = cfg?.addresses.conditionalTokens;
  const weth = cfg?.addresses.collateral;

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
      <div className="relative overflow-hidden rounded-3xl border border-lime/20 bg-gradient-to-br from-surface to-canvas p-12">
        <div className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-lime/10 blur-3xl" />
        <div className="relative flex flex-col items-center gap-5 text-center">
          <div className="grid h-14 w-14 place-items-center rounded-2xl bg-lime/15 text-lime">
            <WalletIcon />
          </div>
          <div>
            <h1 className="text-xl font-bold">Your dashboard</h1>
            <p className="mt-1 text-sm text-muted">
              Connect your wallet to see your balance, positions and claimable rewards.
            </p>
          </div>
          <ConnectButton />
        </div>
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

  const open = positions.filter((p) => !p.resolved);
  const closed = positions.filter((p) => p.resolved);
  const rewards = rewardsData?.rewards ?? [];
  const claimable = rewards.filter((r) => r.status === "CLAIMABLE");
  const claimableEth = Number(formatEther(BigInt(rewardsData?.claimableWei ?? "0")));
  const nativeEth = nativeBal ? Number(formatEther(nativeBal.value)) : 0;

  return (
    <div className="flex flex-col gap-8">
      {/* Wallet hero */}
      <motion.div
        variants={fade}
        initial="hidden"
        animate="show"
        className="relative overflow-hidden rounded-3xl border border-border bg-gradient-to-br from-surface to-canvas p-6 sm:p-8"
      >
        <div className="pointer-events-none absolute -right-20 -top-20 h-72 w-72 rounded-full bg-lime/10 blur-3xl" />
        <div className="relative flex flex-wrap items-end justify-between gap-6">
          <div>
            <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-lime/50" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-lime" />
              </span>
              {stats?.username ? `@${stats.username}` : shortHash(address ?? "")}
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-4xl font-bold tabular sm:text-5xl">{fmtEth(wethBal)}</span>
              <span className="text-lg font-semibold text-muted">ETH</span>
            </div>
            <div className="mt-1 text-xs text-muted">
              Tradeable balance · {nativeEth.toFixed(4)} ETH native for gas
            </div>
          </div>
          <ConnectButton showBalance={false} accountStatus="address" chainStatus="none" />
        </div>
      </motion.div>

      {/* Stat tiles */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile i={0} label="Bet volume" value={stats ? formatVolume(stats.volume) : "$0"} />
        <StatTile i={1} label="Trades" value={String(stats?.trades ?? 0)} />
        <StatTile i={2} label="Open positions" value={String(open.length)} />
        <StatTile
          i={3}
          label="Claimable"
          value={`${claimableEth.toFixed(4)} ETH`}
          highlight={claimableEth > 0}
        />
      </div>

      {/* Claimable rewards */}
      {claimable.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="flex items-center gap-2 text-sm font-bold text-lime">
            <GiftIcon /> Claimable rewards
          </h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {claimable.map((r, i) => (
              <RewardCard key={r.id} reward={r} index={i} address={address!} />
            ))}
          </div>
        </section>
      )}

      {/* Positions */}
      <PositionSection
        title="Open positions"
        empty="No open positions yet — buy Yes or No shares on a market to get started."
        positions={open}
        ctf={ctf}
        collateral={weth}
      />
      <PositionSection
        title="Closed & resolved"
        empty="Nothing resolved yet. Settled markets you hold will appear here to redeem."
        positions={closed}
        ctf={ctf}
        collateral={weth}
        resolvedSection
      />

      {/* Claimed history */}
      {rewards.some((r) => r.status === "CLAIMED") && (
        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-semibold text-muted">Reward history</h2>
          <div className="card divide-y divide-border">
            {rewards
              .filter((r) => r.status === "CLAIMED")
              .map((r) => (
                <div key={r.id} className="flex items-center justify-between px-4 py-3 text-sm">
                  <span className="text-muted">{r.note || "Airdrop reward"}</span>
                  <span className="flex items-center gap-2">
                    <span className="tabular font-semibold">{fmtEth(BigInt(r.amountWei), 4)} ETH</span>
                    <span className="pill bg-yes/10 text-yes">Claimed</span>
                  </span>
                </div>
              ))}
          </div>
        </section>
      )}
    </div>
  );
}

function StatTile({
  label,
  value,
  i,
  highlight,
}: {
  label: string;
  value: string;
  i: number;
  highlight?: boolean;
}) {
  return (
    <motion.div
      custom={i}
      variants={fade}
      initial="hidden"
      animate="show"
      className={`card p-4 ${highlight ? "border-lime/40 bg-lime/5" : ""}`}
    >
      <div className="text-[11px] uppercase tracking-wide text-muted">{label}</div>
      <div className={`mt-1.5 text-xl font-bold tabular ${highlight ? "text-lime" : ""}`}>{value}</div>
    </motion.div>
  );
}

function RewardCard({ reward, index, address }: { reward: Reward; index: number; address: string }) {
  const { signMessageAsync } = useSignMessage();
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  async function claim() {
    setBusy(true);
    setError("");
    try {
      const signature = await signMessageAsync({ message: `Claim RobinMarkets reward ${reward.id}` });
      await claimReward({ address, rewardId: reward.id, signature });
      setDone(true);
      qc.invalidateQueries({ queryKey: ["rewards", address] });
    } catch (e) {
      setError((e as Error).message.split("\n")[0]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <motion.div
      custom={index}
      variants={fade}
      initial="hidden"
      animate="show"
      className="relative overflow-hidden rounded-2xl border border-lime/30 bg-lime/[0.07] p-4"
    >
      <div className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full bg-lime/10 blur-2xl" />
      <div className="relative flex items-center justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl font-bold tabular text-lime">{fmtEth(BigInt(reward.amountWei), 4)}</span>
            <span className="text-sm font-semibold text-lime/80">ETH</span>
          </div>
          <div className="truncate text-xs text-muted">{reward.note || "Airdrop reward"}</div>
        </div>
        <button
          onClick={claim}
          disabled={busy || done}
          className="btn-lime shrink-0 disabled:opacity-60"
        >
          {done ? "Claimed ✓" : busy ? "Claiming…" : "Claim"}
        </button>
      </div>
      {error && <div className="relative mt-2 text-xs text-no">{error}</div>}
    </motion.div>
  );
}

function PositionSection({
  title,
  empty,
  positions,
  ctf,
  collateral,
  resolvedSection,
}: {
  title: string;
  empty: string;
  positions: { market: Market; yes: bigint; no: bigint; resolved: boolean }[];
  ctf?: `0x${string}`;
  collateral?: `0x${string}`;
  resolvedSection?: boolean;
}) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="flex items-center gap-2 text-sm font-bold">
        {title}
        <span className="pill bg-surface-2 text-xs text-muted">{positions.length}</span>
      </h2>
      {positions.length === 0 ? (
        <div className="card p-6 text-sm text-muted">{empty}</div>
      ) : (
        <div className="flex flex-col gap-3">
          {positions.map((p, i) => (
            <PositionRow key={p.market.id} {...p} index={i} ctf={ctf} collateral={collateral} redeemable={resolvedSection} />
          ))}
        </div>
      )}
    </section>
  );
}

function PositionRow({
  market,
  yes,
  no,
  index,
  ctf,
  collateral,
  redeemable,
}: {
  market: Market;
  yes: bigint;
  no: bigint;
  index: number;
  ctf?: `0x${string}`;
  collateral?: `0x${string}`;
  redeemable?: boolean;
}) {
  const { writeContractAsync, isPending } = useWriteContract();
  const publicClient = usePublicClient();
  const qc = useQueryClient();

  async function redeem() {
    if (!ctf || !collateral) return;
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
    <motion.div
      custom={index}
      variants={fade}
      initial="hidden"
      animate="show"
      className="card glow-hover flex items-center justify-between gap-4 p-4"
    >
      <div className="flex min-w-0 items-center gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-xl bg-surface-2">
          <AssetIcon underlying={market.underlying} size={22} />
        </span>
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold">{market.question}</div>
          <div className="text-xs text-muted">
            {market.underlying} · {sectorLabel(market.sector)}
          </div>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-4">
        <div className="text-right">
          <div className="text-[11px] uppercase tracking-wide text-muted">Yes / No</div>
          <div className="tabular text-sm">
            <span className="font-semibold text-yes">{fmtEth(yes, 1)}</span>
            <span className="text-muted"> / </span>
            <span className="font-semibold text-no">{fmtEth(no, 1)}</span>
          </div>
        </div>
        {redeemable ? (
          <button className="btn-lime" disabled={isPending} onClick={redeem}>
            {isPending ? "Redeeming…" : "Redeem"}
          </button>
        ) : (
          <span className="pill bg-lime/10 text-lime">Open</span>
        )}
      </div>
    </motion.div>
  );
}

function WalletIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M3 7a2 2 0 012-2h12a2 2 0 012 2v1H5a2 2 0 00-2 2m0-3v10a2 2 0 002 2h14a2 2 0 002-2v-6a2 2 0 00-2-2H7" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="17" cy="14" r="1.2" fill="currentColor" stroke="none" />
    </svg>
  );
}

function GiftIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="3" y="8" width="18" height="4" rx="1" />
      <path d="M12 8v13M5 12v7a1 1 0 001 1h12a1 1 0 001-1v-7" strokeLinecap="round" />
      <path d="M12 8S10.5 3 8 3 5 6 8 8m4 0s1.5-5 4-5 3 3 0 5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
