"use client";

import { useState } from "react";
import { parseEther } from "viem";
import {
  useAccount,
  useChainId,
  usePublicClient,
  useReadContract,
  useSignTypedData,
  useSwitchChain,
  useWriteContract,
} from "wagmi";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import {
  conditionalTokensAbi,
  ctfExchangeAbi,
  erc20Abi,
  PRICE_SCALE,
  type Market,
  type Side,
} from "@robinmarkets/shared";
import { useQueryClient } from "@tanstack/react-query";
import { useOrderbookConfig } from "@/lib/hooks";
import { centsToPrice, createSignedOrder } from "@/lib/orders";
import { postOrder } from "@/lib/orderbook";
import { fmtEth } from "@/lib/format";

type Outcome = "YES" | "NO";

export function TradePanel({ market }: { market: Market }) {
  const { data: cfg } = useOrderbookConfig();
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const publicClient = usePublicClient();
  const { signTypedDataAsync } = useSignTypedData();
  const { writeContractAsync } = useWriteContract();
  const { switchChain } = useSwitchChain();
  const qc = useQueryClient();

  const [outcome, setOutcome] = useState<Outcome>("YES");
  const [side, setSide] = useState<Side>("BUY");
  const [cents, setCents] = useState(50);
  const [shares, setShares] = useState("100");
  const [status, setStatus] = useState<string>("");
  const [busy, setBusy] = useState(false);

  const exchange = cfg?.addresses.ctfExchange;
  const weth = cfg?.addresses.collateral;
  const ctf = cfg?.addresses.conditionalTokens;
  const tokenId = outcome === "YES" ? market.yesPositionId : market.noPositionId;

  const price = centsToPrice(cents);
  const sharesWei = safeParseEther(shares);
  const cost = (sharesWei * price) / PRICE_SCALE;
  const wrongChain = isConnected && cfg && chainId !== cfg.chainId;

  const { data: wethAllowance = 0n } = useReadContract({
    address: weth,
    abi: erc20Abi,
    functionName: "allowance",
    args: address && exchange ? [address, exchange] : undefined,
    query: { enabled: !!address && !!exchange, refetchInterval: 5000 },
  });
  const { data: wethBalance = 0n } = useReadContract({
    address: weth,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: !!address, refetchInterval: 5000 },
  });
  const { data: ctApproved = false } = useReadContract({
    address: ctf,
    abi: conditionalTokensAbi,
    functionName: "isApprovedForAll",
    args: address && exchange ? [address, exchange] : undefined,
    query: { enabled: !!address && !!exchange, refetchInterval: 5000 },
  });
  const { data: outcomeBalance = 0n } = useReadContract({
    address: ctf,
    abi: conditionalTokensAbi,
    functionName: "balanceOf",
    args: address ? [address, BigInt(tokenId)] : undefined,
    query: { enabled: !!address, refetchInterval: 5000 },
  });

  const needsWethApproval = side === "BUY" && (wethAllowance as bigint) < cost;
  const needsWeth = side === "BUY" && (wethBalance as bigint) < cost;
  const needsCtApproval = side === "SELL" && !ctApproved;
  const notEnoughShares = side === "SELL" && (outcomeBalance as bigint) < sharesWei;

  async function tx(run: () => Promise<`0x${string}`>, label: string) {
    setBusy(true);
    setStatus(label);
    try {
      const hash = await run();
      await publicClient?.waitForTransactionReceipt({ hash });
      setStatus(`${label} ✓`);
    } catch (e) {
      setStatus((e as Error).message.split("\n")[0]);
    } finally {
      setBusy(false);
    }
  }

  const wrapEth = () =>
    tx(
      () =>
        writeContractAsync({
          address: weth!,
          abi: erc20Abi,
          functionName: "deposit",
          value: cost > 0n ? cost : parseEther("1"),
        }),
      "Wrapping ETH"
    );

  const approveWeth = () =>
    tx(
      () =>
        writeContractAsync({
          address: weth!,
          abi: erc20Abi,
          functionName: "approve",
          args: [exchange!, 2n ** 255n],
        }),
      "Approving WETH"
    );

  const approveCt = () =>
    tx(
      () =>
        writeContractAsync({
          address: ctf!,
          abi: conditionalTokensAbi,
          functionName: "setApprovalForAll",
          args: [exchange!, true],
        }),
      "Enabling sell"
    );

  async function submit() {
    if (!address || !exchange || !cfg || !publicClient) return;
    setBusy(true);
    setStatus("Signing order…");
    try {
      const nonce = (await publicClient.readContract({
        address: exchange,
        abi: ctfExchangeAbi,
        functionName: "nonces",
        args: [address],
      })) as bigint;

      const order = await createSignedOrder({
        maker: address,
        chainId: cfg.chainId,
        exchange,
        tokenId,
        side,
        price,
        shares: sharesWei,
        nonce,
        signTypedDataAsync,
      });

      setStatus("Submitting…");
      const res = await postOrder(order);
      setStatus(
        res.status === "OPEN"
          ? "Order resting on the book"
          : `${res.status}: ${res.trades.length} trade(s) settled`
      );
      qc.invalidateQueries({ queryKey: ["book"] });
    } catch (e) {
      setStatus((e as Error).message.split("\n")[0]);
    } finally {
      setBusy(false);
    }
  }

  const canSubmit =
    isConnected && !wrongChain && !busy && sharesWei > 0n && cents >= 1 && cents <= 99 &&
    !needsWethApproval && !needsWeth && !needsCtApproval && !notEnoughShares;

  return (
    <div className="card flex flex-col gap-4 p-4">
      {/* Buy / Sell */}
      <div className="grid grid-cols-2 gap-1 rounded-xl bg-surface-2 p-1">
        {(["BUY", "SELL"] as Side[]).map((s) => (
          <button
            key={s}
            onClick={() => setSide(s)}
            className={`rounded-lg py-2 text-sm font-semibold ${
              side === s ? "bg-lime text-black" : "text-muted hover:text-white"
            }`}
          >
            {s === "BUY" ? "Buy" : "Sell"}
          </button>
        ))}
      </div>

      {/* Outcome */}
      <div className="grid grid-cols-2 gap-2">
        {(["YES", "NO"] as Outcome[]).map((o) => (
          <button
            key={o}
            onClick={() => setOutcome(o)}
            className={`rounded-xl border py-2.5 text-sm font-bold ${
              outcome === o
                ? o === "YES"
                  ? "border-yes bg-yes/10 text-yes"
                  : "border-no bg-no/10 text-no"
                : "border-border text-muted hover:text-white"
            }`}
          >
            {o}
          </button>
        ))}
      </div>

      {/* Inputs */}
      <Field label="Limit price (¢)">
        <input
          type="number"
          min={1}
          max={99}
          value={cents}
          onChange={(e) => setCents(Number(e.target.value))}
          className="w-full bg-transparent text-right text-lg font-semibold tabular outline-none"
        />
      </Field>
      <Field label="Shares">
        <input
          type="number"
          min={0}
          value={shares}
          onChange={(e) => setShares(e.target.value)}
          className="w-full bg-transparent text-right text-lg font-semibold tabular outline-none"
        />
      </Field>

      <div className="flex items-center justify-between rounded-xl bg-surface-2 px-3 py-2.5 text-sm">
        <span className="text-muted">{side === "BUY" ? "Cost" : "You receive"}</span>
        <span className="font-semibold tabular">{fmtEth(cost)} WETH</span>
      </div>

      {/* Actions */}
      {!isConnected ? (
        <ConnectButton />
      ) : wrongChain ? (
        <button className="btn-ghost" onClick={() => switchChain({ chainId: cfg!.chainId })}>
          Switch to chain {cfg!.chainId}
        </button>
      ) : (
        <div className="flex flex-col gap-2">
          {needsWeth && (
            <button className="btn-ghost" disabled={busy} onClick={wrapEth}>
              Wrap ETH → WETH
            </button>
          )}
          {needsWethApproval && !needsWeth && (
            <button className="btn-ghost" disabled={busy} onClick={approveWeth}>
              Approve WETH
            </button>
          )}
          {needsCtApproval && (
            <button className="btn-ghost" disabled={busy} onClick={approveCt}>
              Enable selling
            </button>
          )}
          {notEnoughShares && (
            <p className="text-center text-xs text-no">
              You hold {fmtEth(outcomeBalance as bigint, 2)} {outcome} shares.
            </p>
          )}
          <button className="btn-lime" disabled={!canSubmit} onClick={submit}>
            {side === "BUY" ? "Buy" : "Sell"} {outcome}
          </button>
        </div>
      )}

      {status && <p className="text-center text-xs text-muted">{status}</p>}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex items-center justify-between gap-3 rounded-xl border border-border px-3 py-2">
      <span className="text-xs text-muted">{label}</span>
      {children}
    </label>
  );
}

function safeParseEther(v: string): bigint {
  try {
    return parseEther(v || "0");
  } catch {
    return 0n;
  }
}
