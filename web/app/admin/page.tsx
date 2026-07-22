"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { adminAirdrop, getAdminUsers, type AdminUser } from "@/lib/orderbook";
import { fmtEth, shortHash } from "@/lib/format";

function timeAgo(ts: number): string {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
}

/** Mask a username for privacy mode: Gentle → G***le. */
function maskName(name: string): string {
  if (name.length <= 2) return "•".repeat(name.length);
  return `${name[0]}***${name.slice(-2)}`;
}

export default function AdminPage() {
  const [secret, setSecret] = useState("");
  const [entered, setEntered] = useState(false);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const [privacy, setPrivacy] = useState(false);
  const [target, setTarget] = useState<AdminUser | null>(null);

  useEffect(() => {
    const saved = sessionStorage.getItem("rm-admin-secret");
    if (saved) {
      setSecret(saved);
      setEntered(true);
    }
  }, []);

  async function load(key = secret) {
    setLoading(true);
    setError("");
    try {
      const { users } = await getAdminUsers(key);
      setUsers(users);
      sessionStorage.setItem("rm-admin-secret", key);
      setEntered(true);
    } catch (e) {
      setError((e as Error).message);
      setEntered(false);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (entered) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entered]);

  async function allocate(amountEth: string, noteText: string) {
    if (!target) return;
    const label = target.username ? `@${target.username}` : shortHash(target.address);
    setNote(`Allocating ${amountEth} ETH to ${label}…`);
    setTarget(null);
    try {
      await adminAirdrop(secret, { to: target.address, amountEth, note: noteText || undefined });
      setNote(`✓ Allocated ${amountEth} ETH — ${label} can now claim it from their dashboard.`);
      load();
    } catch (e) {
      setNote(`Airdrop failed: ${(e as Error).message}`);
    }
  }

  const totals = useMemo(
    () => ({
      traders: users.length,
      named: users.filter((u) => u.username).length,
      volume: users.reduce((s, u) => s + u.volume, 0),
      trades: users.reduce((s, u) => s + u.trades, 0),
    }),
    [users]
  );

  if (!entered) {
    return (
      <div className="mx-auto mt-16 max-w-sm">
        <div className="card p-6">
          <h1 className="text-lg font-bold">Admin access</h1>
          <p className="mt-1 text-sm text-muted">Enter the admin key (ADMIN_SECRET).</p>
          <input
            type="password"
            value={secret}
            onChange={(e) => setSecret(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && load()}
            placeholder="admin key"
            className="mt-4 w-full rounded-xl border border-border bg-surface-2 px-3 py-2.5 text-sm outline-none focus:border-lime-dim"
          />
          {error && <p className="mt-2 text-xs text-no">{error}</p>}
          <button className="btn-lime mt-4 w-full" disabled={loading || !secret} onClick={() => load()}>
            {loading ? "Checking…" : "Unlock"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="relative overflow-hidden rounded-3xl border border-border bg-gradient-to-br from-surface to-canvas p-6">
        <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-lime/10 blur-3xl" />
        <div className="relative flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">Admin console</h1>
            <p className="text-xs text-muted">Traders, volume &amp; claimable airdrops</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPrivacy((p) => !p)}
              className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                privacy ? "border-lime/40 bg-lime/10 text-lime" : "border-border text-muted hover:text-white"
              }`}
              title="Mask usernames"
            >
              <EyeIcon off={privacy} /> {privacy ? "Names hidden" : "Names shown"}
            </button>
            <button className="btn-ghost text-xs" onClick={() => load()} disabled={loading}>
              {loading ? "Refreshing…" : "Refresh"}
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat i={0} label="Total users" value={totals.traders.toString()} />
        <Stat i={1} label="Usernames" value={totals.named.toString()} />
        <Stat i={2} label="Total volume" value={`$${Math.round(totals.volume).toLocaleString()}`} highlight />
        <Stat i={3} label="Total trades" value={totals.trades.toString()} />
      </div>

      {note && (
        <div className="rounded-xl border border-lime/20 bg-lime/5 px-4 py-2.5 text-xs text-white/80">{note}</div>
      )}

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted">
                <th className="px-4 py-3">User</th>
                <th className="px-4 py-3">Address</th>
                <th className="px-4 py-3 text-center">Positions</th>
                <th className="px-4 py-3 text-right">ETH</th>
                <th className="px-4 py-3 text-right">WETH</th>
                <th className="px-4 py-3 text-right">Volume</th>
                <th className="px-4 py-3 text-right">Trades</th>
                <th className="px-4 py-3 text-right">Seen</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {users.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-muted">
                    No traders yet.
                  </td>
                </tr>
              )}
              {users.map((u, i) => (
                <motion.tr
                  key={u.address}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: i * 0.03 }}
                  className="border-b border-border/60 last:border-0 hover:bg-surface-2/40"
                >
                  <td className="px-4 py-3 font-medium">
                    {u.username ? (
                      <span className={privacy ? "text-muted" : ""}>
                        @{privacy ? maskName(u.username) : u.username}
                      </span>
                    ) : (
                      <span className="text-muted">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-muted">{shortHash(u.address)}</td>
                  <td className="px-4 py-3 text-center">
                    <span className="inline-flex items-center gap-1.5 text-xs">
                      <span className="pill bg-lime/10 text-lime">{u.openPositions} open</span>
                      <span className="pill bg-surface-2 text-muted">{u.closedPositions} closed</span>
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right tabular">{fmtEth(u.ethBalance, 4)}</td>
                  <td className="px-4 py-3 text-right tabular">{fmtEth(u.wethBalance, 4)}</td>
                  <td className="px-4 py-3 text-right tabular">${Math.round(u.volume).toLocaleString()}</td>
                  <td className="px-4 py-3 text-right tabular">{u.trades}</td>
                  <td className="px-4 py-3 text-right text-muted">{timeAgo(u.lastSeen)}</td>
                  <td className="px-4 py-3 text-right">
                    <button
                      className="rounded-lg bg-lime px-2.5 py-1 text-xs font-semibold text-black transition-colors hover:bg-lime-bright"
                      onClick={() => setTarget(u)}
                    >
                      Airdrop
                    </button>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-[11px] text-muted">
        Airdrops are allocated as <span className="text-white/70">claimable rewards</span> — the ETH
        leaves the operator wallet only when the user claims from their dashboard. Positions are read
        live on-chain.
      </p>

      {target && (
        <AirdropModal user={target} privacy={privacy} onClose={() => setTarget(null)} onSubmit={allocate} />
      )}
    </div>
  );
}

function AirdropModal({
  user,
  privacy,
  onClose,
  onSubmit,
}: {
  user: AdminUser;
  privacy: boolean;
  onClose: () => void;
  onSubmit: (amountEth: string, note: string) => void;
}) {
  const [amount, setAmount] = useState("0.01");
  const [note, setNote] = useState("");
  const label = user.username
    ? `@${privacy ? maskName(user.username) : user.username}`
    : shortHash(user.address);
  const valid = Number(amount) > 0;

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4 backdrop-blur-sm" onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm overflow-hidden rounded-2xl border border-lime/30 bg-surface p-6 shadow-[0_20px_80px_-20px_rgba(195,245,60,0.35)]"
      >
        <h2 className="text-lg font-bold">
          Airdrop to <span className="text-lime">{label}</span>
        </h2>
        <p className="mt-1 text-xs text-muted">
          Allocates a claimable reward. Any amount of real ETH — sent when they claim.
        </p>

        <label className="mt-4 block text-xs font-medium text-muted">Amount (ETH)</label>
        <input
          autoFocus
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          inputMode="decimal"
          className="mt-1 w-full rounded-xl border border-border bg-surface-2 px-3 py-2.5 text-sm outline-none focus:border-lime-dim"
        />
        <div className="mt-2 flex gap-1.5">
          {["0.01", "0.05", "0.1", "0.5"].map((a) => (
            <button
              key={a}
              onClick={() => setAmount(a)}
              className="rounded-lg bg-surface-2 px-2 py-1 text-xs text-muted transition-colors hover:text-lime"
            >
              {a}
            </button>
          ))}
        </div>

        <label className="mt-4 block text-xs font-medium text-muted">Note (optional)</label>
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="e.g. Early supporter bonus"
          className="mt-1 w-full rounded-xl border border-border bg-surface-2 px-3 py-2.5 text-sm outline-none focus:border-lime-dim"
        />

        <div className="mt-6 flex gap-2">
          <button className="btn-ghost flex-1" onClick={onClose}>
            Cancel
          </button>
          <button className="btn-lime flex-1" disabled={!valid} onClick={() => onSubmit(amount, note)}>
            Allocate {valid ? `${amount} ETH` : ""}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

function Stat({ label, value, i, highlight }: { label: string; value: string; i: number; highlight?: boolean }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: i * 0.05 }}
      className={`card px-4 py-3 ${highlight ? "border-lime/40 bg-lime/5" : ""}`}
    >
      <div className={`text-xl font-bold tabular ${highlight ? "text-lime" : ""}`}>{value}</div>
      <div className="text-[11px] uppercase tracking-wide text-muted">{label}</div>
    </motion.div>
  );
}

function EyeIcon({ off }: { off: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.8">
      {off ? (
        <>
          <path d="M3 3l18 18" strokeLinecap="round" />
          <path d="M10.6 5.1A9 9 0 0121 12a9 9 0 01-1.6 2.6M6.6 6.6A9 9 0 003 12a9 9 0 0011.4 5.4" strokeLinecap="round" />
        </>
      ) : (
        <>
          <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx="12" cy="12" r="2.5" />
        </>
      )}
    </svg>
  );
}
