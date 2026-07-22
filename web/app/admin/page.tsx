"use client";

import { useEffect, useMemo, useState } from "react";
import { adminAirdrop, getAdminUsers, type AdminUser } from "@/lib/orderbook";
import { fmtEth, shortHash } from "@/lib/format";

function timeAgo(ts: number): string {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
}

export default function AdminPage() {
  const [secret, setSecret] = useState("");
  const [entered, setEntered] = useState(false);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");

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

  async function airdrop(to: string) {
    const amount = prompt(`Airdrop testnet ETH to ${shortHash(to)} — amount (≤ 0.05):`, "0.005");
    if (!amount) return;
    setNote(`Airdropping ${amount} ETH…`);
    try {
      await adminAirdrop(secret, { to, amountEth: amount });
      setNote(`Allocated ${amount} ETH ✓ — claimable by ${shortHash(to)}`);
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
            className="mt-4 w-full rounded-xl border border-border bg-surface-2 px-3 py-2.5 text-sm outline-none"
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
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Admin</h1>
        <button className="btn-ghost text-xs" onClick={() => load()} disabled={loading}>
          {loading ? "Refreshing…" : "Refresh"}
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Traders" value={totals.traders.toString()} />
        <Stat label="Usernames" value={totals.named.toString()} />
        <Stat label="Total volume" value={`$${Math.round(totals.volume).toLocaleString()}`} />
        <Stat label="Total trades" value={totals.trades.toString()} />
      </div>

      {note && <p className="text-xs text-muted">{note}</p>}

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted">
                <th className="px-4 py-3">User</th>
                <th className="px-4 py-3">Address</th>
                <th className="px-4 py-3 text-right">ETH</th>
                <th className="px-4 py-3 text-right">WETH</th>
                <th className="px-4 py-3 text-right">Volume</th>
                <th className="px-4 py-3 text-right">Trades</th>
                <th className="px-4 py-3 text-right">Last seen</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {users.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-muted">
                    No traders yet.
                  </td>
                </tr>
              )}
              {users.map((u) => (
                <tr key={u.address} className="border-b border-border/60 last:border-0">
                  <td className="px-4 py-3 font-medium">
                    {u.username ? `@${u.username}` : <span className="text-muted">—</span>}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-muted">{shortHash(u.address)}</td>
                  <td className="px-4 py-3 text-right tabular">{fmtEth(u.ethBalance, 4)}</td>
                  <td className="px-4 py-3 text-right tabular">{fmtEth(u.wethBalance, 4)}</td>
                  <td className="px-4 py-3 text-right tabular">${Math.round(u.volume).toLocaleString()}</td>
                  <td className="px-4 py-3 text-right tabular">{u.trades}</td>
                  <td className="px-4 py-3 text-right text-muted">{timeAgo(u.lastSeen)}</td>
                  <td className="px-4 py-3 text-right">
                    <button
                      className="rounded-lg bg-lime px-2.5 py-1 text-xs font-semibold text-black hover:bg-lime-bright"
                      onClick={() => airdrop(u.address)}
                    >
                      Airdrop
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-[11px] text-muted">
        Traders are tracked in memory and reset on a service redeploy — add a database to persist
        this. Airdrops send testnet ETH from the operator wallet.
      </p>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="card px-4 py-3">
      <div className="text-xl font-bold tabular">{value}</div>
      <div className="text-[11px] uppercase tracking-wide text-muted">{label}</div>
    </div>
  );
}
