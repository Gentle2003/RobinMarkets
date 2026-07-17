"use client";

import { useState } from "react";
import { useAccount } from "wagmi";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useQueryClient } from "@tanstack/react-query";
import type { Comment, Market } from "@robinmarkets/shared";
import { useComments } from "@/lib/hooks";
import { postComment } from "@/lib/orderbook";

function timeAgo(ts: number): string {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function short(addr: string): string {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

export function MarketComments({ market }: { market: Market }) {
  const { address, isConnected } = useAccount();
  const { data: comments = [], isLoading } = useComments(market.id);
  const qc = useQueryClient();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function send() {
    if (!address || !text.trim()) return;
    setBusy(true);
    setError("");
    try {
      const created = await postComment({ marketId: market.id, author: address, text: text.trim() });
      // Optimistically prepend (WS will also deliver it; dedupe by id).
      qc.setQueryData<Comment[]>(["comments", market.id], (prev) => {
        const list = prev ?? [];
        return list.some((c) => c.id === created.id) ? list : [created, ...list];
      });
      setText("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {isConnected ? (
        <div className="flex flex-col gap-2">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={500}
            rows={2}
            placeholder="Share your take…"
            className="w-full resize-none rounded-xl border border-border bg-surface-2/60 px-3 py-2 text-sm outline-none transition-colors focus:border-lime-dim"
          />
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-muted">Posting as {short(address!)}</span>
            <button className="btn-lime px-4 py-1.5 text-sm" disabled={busy || !text.trim()} onClick={send}>
              {busy ? "Posting…" : "Post"}
            </button>
          </div>
          {error && <span className="text-xs text-no">{error}</span>}
        </div>
      ) : (
        <div className="flex items-center justify-between rounded-xl border border-border bg-surface-2/40 px-4 py-3">
          <span className="text-sm text-muted">Connect your wallet to comment.</span>
          <ConnectButton />
        </div>
      )}

      <div className="flex flex-col divide-y divide-border/60">
        {isLoading && <p className="py-6 text-center text-xs text-muted">Loading…</p>}
        {!isLoading && comments.length === 0 && (
          <p className="py-6 text-center text-sm text-muted">No comments yet — be the first.</p>
        )}
        {comments.map((c) => (
          <div key={c.id} className="flex flex-col gap-1 py-3">
            <div className="flex items-center gap-2 text-xs">
              <span className="font-mono text-white/80">{short(c.author)}</span>
              <span className="text-muted">· {timeAgo(c.timestamp)}</span>
            </div>
            <p className="whitespace-pre-wrap break-words text-sm text-white/90">{c.text}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
