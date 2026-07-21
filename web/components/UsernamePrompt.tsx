"use client";

import { useState } from "react";
import { useAccount, useSignMessage } from "wagmi";
import { useQueryClient } from "@tanstack/react-query";
import { useProfile } from "@/lib/hooks";
import { postProfile } from "@/lib/orderbook";

/**
 * Shown once, right after a wallet connects without a username. The user signs a
 * message to claim a handle (proving wallet ownership); it's stored server-side.
 */
export function UsernamePrompt() {
  const { address, isConnected } = useAccount();
  const { data: username, isLoading } = useProfile(address);
  const { signMessageAsync } = useSignMessage();
  const qc = useQueryClient();

  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [dismissed, setDismissed] = useState(false);

  const open = isConnected && !isLoading && username === null && !dismissed;
  if (!open) return null;

  async function claim() {
    if (!address) return;
    const clean = name.trim();
    if (!/^[a-zA-Z0-9_]{3,24}$/.test(clean)) {
      setError("3–24 characters: letters, numbers, underscore");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const signature = await signMessageAsync({
        message: `Set my RobinMarkets username to: ${clean}`,
      });
      await postProfile({ address, username: clean, signature });
      qc.setQueryData(["profile", address], clean);
    } catch (e) {
      setError((e as Error).message.split("\n")[0]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4 backdrop-blur-sm">
      <div className="card w-full max-w-sm p-6">
        <h2 className="text-lg font-bold">Choose a username</h2>
        <p className="mt-1 text-sm text-muted">
          Pick a handle for RobinMarkets. You&apos;ll sign a message to confirm — no gas, no fee.
        </p>
        <div className="mt-4 flex items-center rounded-xl border border-border bg-surface-2 px-3">
          <span className="text-muted">@</span>
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && claim()}
            placeholder="satoshi"
            maxLength={24}
            className="w-full bg-transparent px-2 py-2.5 text-sm outline-none"
          />
        </div>
        {error && <p className="mt-2 text-xs text-no">{error}</p>}
        <div className="mt-5 flex gap-2">
          <button className="btn-ghost flex-1" disabled={busy} onClick={() => setDismissed(true)}>
            Skip
          </button>
          <button className="btn-lime flex-1" disabled={busy || !name.trim()} onClick={claim}>
            {busy ? "Confirming…" : "Claim"}
          </button>
        </div>
      </div>
    </div>
  );
}
