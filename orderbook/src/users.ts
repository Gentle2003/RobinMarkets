import { getSql } from "./db.js";

/**
 * Registry of traders. Every wallet that places an order is tracked; a wallet can
 * also claim a username (signature-verified). Kept in an in-memory cache for fast
 * synchronous reads, with write-through + load-on-boot to Postgres when a database
 * is configured (otherwise purely in-memory).
 */
export interface UserRecord {
  address: string;
  username?: string;
  firstSeen: number;
  lastSeen: number;
  trades: number;
  volume: number;
}

export class UserStore {
  private users = new Map<string, UserRecord>();
  private names = new Set<string>();

  /** Load persisted users into the cache on startup. */
  async init(): Promise<void> {
    const sql = getSql();
    if (!sql) return;
    const rows = await sql<
      { address: string; username: string | null; first_seen: string; last_seen: string; trades: number; volume: number }[]
    >`SELECT * FROM users`;
    for (const r of rows) {
      const u: UserRecord = {
        address: r.address,
        username: r.username ?? undefined,
        firstSeen: Number(r.first_seen),
        lastSeen: Number(r.last_seen),
        trades: r.trades,
        volume: r.volume,
      };
      this.users.set(r.address.toLowerCase(), u);
      if (u.username) this.names.add(u.username.toLowerCase());
    }
  }

  private persist(u: UserRecord): void {
    const sql = getSql();
    if (!sql) return;
    sql`
      INSERT INTO users (address, username, first_seen, last_seen, trades, volume)
      VALUES (${u.address}, ${u.username ?? null}, ${u.firstSeen}, ${u.lastSeen}, ${u.trades}, ${u.volume})
      ON CONFLICT (address) DO UPDATE SET
        username = EXCLUDED.username, last_seen = EXCLUDED.last_seen,
        trades = EXCLUDED.trades, volume = EXCLUDED.volume
    `.catch((e) => console.error("[db] user persist:", (e as Error).message));
  }

  private upsert(address: string): UserRecord {
    const key = address.toLowerCase();
    let u = this.users.get(key);
    if (!u) {
      u = { address, firstSeen: Date.now(), lastSeen: Date.now(), trades: 0, volume: 0 };
      this.users.set(key, u);
    }
    return u;
  }

  setUsername(address: string, username: string): boolean {
    const clean = username.trim().slice(0, 24);
    const lc = clean.toLowerCase();
    const u = this.upsert(address);
    if (u.username?.toLowerCase() === lc) return true;
    if (this.names.has(lc)) return false;
    if (u.username) this.names.delete(u.username.toLowerCase());
    u.username = clean;
    u.lastSeen = Date.now();
    this.names.add(lc);
    this.persist(u);
    return true;
  }

  recordTrade(address: string, notional: number): void {
    const u = this.upsert(address);
    u.trades += 1;
    u.volume += notional;
    u.lastSeen = Date.now();
    this.persist(u);
  }

  get(address: string): UserRecord | undefined {
    return this.users.get(address.toLowerCase());
  }

  all(): UserRecord[] {
    return [...this.users.values()].sort((a, b) => b.lastSeen - a.lastSeen);
  }
}
