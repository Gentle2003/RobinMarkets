import type { Comment } from "@robinmarkets/shared";

const MAX_PER_MARKET = 200;

/** In-memory comment store, newest first per market. */
export class CommentStore {
  private byMarket = new Map<string, Comment[]>();

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
    return comment;
  }

  recent(marketId: string, limit = 100): Comment[] {
    return (this.byMarket.get(marketId) ?? []).slice(0, limit);
  }
}
