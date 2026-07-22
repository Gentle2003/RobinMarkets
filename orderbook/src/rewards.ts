import { getSql } from "./db.js";

/**
 * Claimable airdrop rewards. An admin allocates an ETH amount to a wallet; it
 * sits as CLAIMABLE until the owner claims it from their dashboard, at which
 * point the operator sends the ETH on-chain and it flips to CLAIMED.
 *
 * In-memory cache for fast reads, write-through + load-on-boot to Postgres when
 * a database is configured (otherwise purely in-memory, like the other stores).
 */
export type RewardStatus = "CLAIMABLE" | "CLAIMED";

export interface Reward {
  id: string;
  address: string; // recipient wallet (original casing)
  username?: string; // snapshot at allocation time, for display
  amountWei: string; // ETH amount, in wei
  note?: string;
  status: RewardStatus;
  allocatedAt: number;
  claimedAt?: number;
  txHash?: string;
}

export class RewardStore {
  private rewards = new Map<string, Reward>(); // id -> reward
  private claiming = new Set<string>(); // ids with an in-flight claim (anti double-spend)

  async init(): Promise<void> {
    const sql = getSql();
    if (!sql) return;
    const rows = await sql<
      {
        id: string;
        address: string;
        username: string | null;
        amount_wei: string;
        note: string | null;
        status: string;
        allocated_at: string;
        claimed_at: string | null;
        tx_hash: string | null;
      }[]
    >`SELECT * FROM rewards`;
    for (const r of rows) {
      this.rewards.set(r.id, {
        id: r.id,
        address: r.address,
        username: r.username ?? undefined,
        amountWei: r.amount_wei,
        note: r.note ?? undefined,
        status: r.status === "CLAIMED" ? "CLAIMED" : "CLAIMABLE",
        allocatedAt: Number(r.allocated_at),
        claimedAt: r.claimed_at ? Number(r.claimed_at) : undefined,
        txHash: r.tx_hash ?? undefined,
      });
    }
  }

  private persist(r: Reward): void {
    const sql = getSql();
    if (!sql) return;
    sql`
      INSERT INTO rewards (id, address, username, amount_wei, note, status, allocated_at, claimed_at, tx_hash)
      VALUES (${r.id}, ${r.address}, ${r.username ?? null}, ${r.amountWei}, ${r.note ?? null},
              ${r.status}, ${r.allocatedAt}, ${r.claimedAt ?? null}, ${r.txHash ?? null})
      ON CONFLICT (id) DO UPDATE SET
        status = EXCLUDED.status, claimed_at = EXCLUDED.claimed_at, tx_hash = EXCLUDED.tx_hash
    `.catch((e) => console.error("[db] reward persist:", (e as Error).message));
  }

  /** Admin allocates a new claimable reward. */
  allocate(address: string, amountWei: string, username?: string, note?: string): Reward {
    const r: Reward = {
      id: `rw_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
      address,
      username,
      amountWei,
      note,
      status: "CLAIMABLE",
      allocatedAt: Date.now(),
    };
    this.rewards.set(r.id, r);
    this.persist(r);
    return r;
  }

  get(id: string): Reward | undefined {
    return this.rewards.get(id);
  }

  /** All rewards for a wallet, newest first. */
  forAddress(address: string): Reward[] {
    const lc = address.toLowerCase();
    return [...this.rewards.values()]
      .filter((r) => r.address.toLowerCase() === lc)
      .sort((a, b) => b.allocatedAt - a.allocatedAt);
  }

  /** Total still-claimable wei for a wallet. */
  claimableWei(address: string): bigint {
    return this.forAddress(address)
      .filter((r) => r.status === "CLAIMABLE")
      .reduce((sum, r) => sum + BigInt(r.amountWei), 0n);
  }

  all(): Reward[] {
    return [...this.rewards.values()].sort((a, b) => b.allocatedAt - a.allocatedAt);
  }

  /** Try to reserve a reward for claiming; false if already claimed or in-flight. */
  beginClaim(id: string, address: string): Reward | null {
    const r = this.rewards.get(id);
    if (!r) return null;
    if (r.status !== "CLAIMABLE") return null;
    if (r.address.toLowerCase() !== address.toLowerCase()) return null;
    if (this.claiming.has(id)) return null;
    this.claiming.add(id);
    return r;
  }

  finishClaim(id: string, txHash: string): void {
    const r = this.rewards.get(id);
    this.claiming.delete(id);
    if (!r) return;
    r.status = "CLAIMED";
    r.claimedAt = Date.now();
    r.txHash = txHash;
    this.persist(r);
  }

  /** Release a reservation after a failed claim so it can be retried. */
  abortClaim(id: string): void {
    this.claiming.delete(id);
  }
}
