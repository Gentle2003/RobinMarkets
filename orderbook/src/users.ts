/**
 * In-memory registry of traders. Every wallet that places an order is tracked;
 * a wallet can also claim a username (signature-verified). Volume/first-seen etc.
 * power the admin panel. (In-memory — resets on redeploy; a DB is the next step.)
 */
export interface UserRecord {
  address: string;
  username?: string;
  firstSeen: number;
  lastSeen: number;
  trades: number;
  /** cumulative traded notional in display dollars */
  volume: number;
}

export class UserStore {
  private users = new Map<string, UserRecord>();
  private names = new Set<string>();

  private upsert(address: string): UserRecord {
    const key = address.toLowerCase();
    let u = this.users.get(key);
    if (!u) {
      u = { address, firstSeen: Date.now(), lastSeen: Date.now(), trades: 0, volume: 0 };
      this.users.set(key, u);
    }
    return u;
  }

  /** Claim a username for an address. Returns false if the name is taken. */
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
    return true;
  }

  /** Record a trade against a wallet (grows volume/trade count). */
  recordTrade(address: string, notional: number): void {
    const u = this.upsert(address);
    u.trades += 1;
    u.volume += notional;
    u.lastSeen = Date.now();
  }

  get(address: string): UserRecord | undefined {
    return this.users.get(address.toLowerCase());
  }

  all(): UserRecord[] {
    return [...this.users.values()].sort((a, b) => b.lastSeen - a.lastSeen);
  }
}
