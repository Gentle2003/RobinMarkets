import type { Comment } from "@robinmarkets/shared";
import { getSql } from "./db.js";

const MAX_PER_MARKET = 200;

/**
 * Comment store — in-memory cache with write-through + load-on-boot to Postgres
 * when a database is configured (otherwise purely in-memory).
 */
export class CommentStore {
  private byMarket = new Map<string, Comment[]>();

  /** Load recent comments into the cache on startup. */
  async init(): Promise<void> {
    const sql = getSql();
    if (!sql) return;
    const rows = await sql<
      { id: string; market_id: string; author: string; body: string; ts: string }[]
    >`SELECT * FROM comments ORDER BY ts ASC`;
    for (const r of rows) {
      const c: Comment = {
        id: r.id,
        marketId: r.market_id,
        author: r.author,
        text: r.body,
        timestamp: Number(r.ts),
      };
      const list = this.byMarket.get(c.marketId) ?? [];
      list.unshift(c); // ascending load → newest ends up first
      if (list.length > MAX_PER_MARKET) list.length = MAX_PER_MARKET;
      this.byMarket.set(c.marketId, list);
    }
  }

  add(marketId: string, author: string, text: string): Comment {
    const comment: Comment = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      marketId,
      author,
      text: text.slice(0, 500),
      timestamp: Date.now(),
    };
    const list = this.byMarket.get(marketId) ?? [];
    list.unshift(comment);
    if (list.length > MAX_PER_MARKET) list.length = MAX_PER_MARKET;
    this.byMarket.set(marketId, list);

    const sql = getSql();
    if (sql) {
      sql`
        INSERT INTO comments (id, market_id, author, body, ts)
        VALUES (${comment.id}, ${marketId}, ${author}, ${comment.text}, ${comment.timestamp})
      `.catch((e) => console.error("[db] comment persist:", (e as Error).message));
    }
    return comment;
  }

  recent(marketId: string, limit = 100): Comment[] {
    return (this.byMarket.get(marketId) ?? []).slice(0, limit);
  }
}
