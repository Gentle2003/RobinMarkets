import Fastify, { type FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import websocket from "@fastify/websocket";
import { PRICE_SCALE, ctfExchangeAbi, type SignedOrder } from "@robinmarkets/shared";
import type { Config } from "./config.js";
import { MarketsRegistry } from "./markets.js";
import { OrderBook } from "./book.js";
import { Hub } from "./hub.js";
import { Outcome } from "@robinmarkets/shared";
import { createSettleFn } from "./settlement.js";
import { orderHash, orderPrice, toBookOrder, verifyOrderSignature } from "./order.js";
import { seedSyntheticBook } from "./seed.js";
import { ActivityLog, startSyntheticActivity } from "./feed.js";
import { CommentStore } from "./social.js";
import { resolveMarket } from "./resolver.js";
import { createMarkets } from "./marketcreator.js";
import type { Cadence } from "./catalog.js";
import { getNews } from "./news.js";

const REQUIRED_FIELDS: (keyof SignedOrder)[] = [
  "salt", "maker", "signer", "tokenId", "makerAmount", "takerAmount", "expiry", "nonce", "side", "signature",
];

export interface Server {
  app: FastifyInstance;
  markets: MarketsRegistry;
  book: OrderBook;
}

export async function buildServer(config: Config): Promise<Server> {
  const app = Fastify({ logger: { level: process.env.LOG_LEVEL ?? "info" } });
  await app.register(cors, { origin: true });
  await app.register(websocket);

  const markets = new MarketsRegistry(config);
  await markets.refresh();
  const book = new OrderBook(markets);
  const hub = new Hub();
  const settle = createSettleFn(config);

  const activity = new ActivityLog();

  // Demo liquidity + live activity so the UI feels alive (disable with SEED_BOOK=false).
  if (process.env.SEED_BOOK !== "false") {
    seedSyntheticBook(book, markets.all());
    startSyntheticActivity(activity, markets, hub);
  }

  function publishBook(tokenId: string) {
    hub.broadcast({ type: "book", snapshot: serialize(book.snapshot(tokenId)) });
  }

  app.get("/health", async () => ({
    ok: true,
    chainId: config.chainId,
    dryRun: config.dryRun,
    markets: markets.all().length,
  }));

  // Lets the web app discover contract addresses without env juggling in dev.
  app.get("/config", async () => ({
    chainId: config.chainId,
    addresses: config.addresses,
  }));

  // ETH/USD price for the $-denominated trade UI, cached ~60s with a fallback.
  let ethPrice = { usd: 0, ts: 0 };
  async function getEthUsd(): Promise<number> {
    const now = Date.now();
    if (ethPrice.usd > 0 && now - ethPrice.ts < 60_000) return ethPrice.usd;
    try {
      const r = await fetch(
        "https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd",
        { signal: AbortSignal.timeout(5000) }
      );
      const j = (await r.json()) as { ethereum?: { usd?: number } };
      const usd = Number(j?.ethereum?.usd);
      if (usd > 0) {
        ethPrice = { usd, ts: now };
        return usd;
      }
    } catch {
      /* fall through to cached/fallback */
    }
    return ethPrice.usd > 0 ? ethPrice.usd : 3000;
  }
  app.get("/eth-price", async () => ({ ethUsd: await getEthUsd(), updatedAt: Date.now() }));

  app.get<{ Querystring: { limit?: string } }>("/news", async (req) =>
    getNews(Math.min(Number(req.query.limit ?? 24), 40))
  );

  // Admin: create the catalog's markets for the given cadences.
  app.post<{ Body: { cadences?: Cadence[] } }>("/admin/create-markets", async (req, reply) => {
    const secret = process.env.ADMIN_SECRET;
    if (!secret || req.headers["x-admin-secret"] !== secret) {
      return reply.code(401).send({ error: "unauthorized" });
    }
    const cadences = req.body?.cadences?.length
      ? req.body.cadences
      : (["DAILY", "WEEKLY", "MONTHLY"] as Cadence[]);
    try {
      const created = await createMarkets(config, markets, cadences);
      return { created };
    } catch (e) {
      return reply.code(500).send({ error: (e as Error).message });
    }
  });

  // Admin: force-resolve a market now on real data (for demo / manual override).
  app.post<{ Body: { marketId?: string } }>("/admin/resolve", async (req, reply) => {
    const secret = process.env.ADMIN_SECRET;
    if (!secret || req.headers["x-admin-secret"] !== secret) {
      return reply.code(401).send({ error: "unauthorized" });
    }
    if (!req.body?.marketId) return reply.code(400).send({ error: "marketId required" });
    const result = await resolveMarket(config, markets, req.body.marketId);
    if (result.ok) hub.broadcast({ type: "resolved", marketId: req.body.marketId, outcome: result.outcome });
    return reply.code(result.ok ? 200 : 400).send(result);
  });

  // Live protocol stats — volume/trades tick up from the activity stream.
  const VOLUME_BASE = 12_400_000;
  app.get("/stats", async () => {
    const s = activity.stats();
    return {
      markets: markets.all().length,
      volume24h: VOLUME_BASE + Math.round(s.notional),
      trades24h: s.trades,
      updatedAt: Date.now(),
    };
  });

  app.get("/markets", async () => markets.all());

  app.get<{ Params: { id: string } }>("/markets/:id", async (req, reply) => {
    const m = markets.get(req.params.id);
    if (!m) return reply.code(404).send({ error: "market not found" });
    return m;
  });

  app.post("/markets/refresh", async () => {
    await markets.refresh();
    return { ok: true, markets: markets.all().length };
  });

  app.get<{ Params: { tokenId: string } }>("/book/:tokenId", async (req, reply) => {
    if (!markets.knownToken(req.params.tokenId)) {
      return reply.code(404).send({ error: "unknown token" });
    }
    return serialize(book.snapshot(req.params.tokenId));
  });

  app.get<{ Querystring: { marketId?: string; limit?: string } }>("/activity", async (req) => {
    const limit = Math.min(Number(req.query.limit ?? 40), 100);
    return activity.recent(req.query.marketId, limit);
  });

  const comments = new CommentStore();

  app.get<{ Querystring: { marketId?: string } }>("/comments", async (req, reply) => {
    if (!req.query.marketId) return reply.code(400).send({ error: "marketId required" });
    return comments.recent(req.query.marketId);
  });

  app.post<{ Body: { marketId?: string; author?: string; text?: string } }>(
    "/comments",
    async (req, reply) => {
      const { marketId, author, text } = req.body ?? {};
      if (!marketId || !markets.get(marketId)) return reply.code(404).send({ error: "unknown market" });
      if (!author || !/^0x[a-fA-F0-9]{40}$/.test(author)) {
        return reply.code(400).send({ error: "valid author address required" });
      }
      const clean = (text ?? "").trim();
      if (!clean) return reply.code(400).send({ error: "empty comment" });

      const comment = comments.add(marketId, author, clean);
      hub.broadcast({ type: "comment", comment });
      return comment;
    }
  );

  app.post<{ Body: SignedOrder }>("/orders", async (req, reply) => {
    const o = req.body;
    for (const f of REQUIRED_FIELDS) {
      if (o?.[f] === undefined || o?.[f] === null) {
        return reply.code(400).send({ error: `missing field: ${f}` });
      }
    }
    if (o.side !== "BUY" && o.side !== "SELL") {
      return reply.code(400).send({ error: "side must be BUY or SELL" });
    }
    if (!markets.knownToken(o.tokenId)) {
      return reply.code(400).send({ error: "unknown market token" });
    }
    const price = orderPrice(o);
    if (price <= 0n || price >= PRICE_SCALE) {
      return reply.code(400).send({ error: "price must be strictly between 0 and 1" });
    }
    if (o.expiry !== 0 && o.expiry * 1000 < Date.now()) {
      return reply.code(400).send({ error: "order expired" });
    }

    const validSig = await verifyOrderSignature(o, config.chainId, config.addresses.ctfExchange);
    if (!validSig) return reply.code(401).send({ error: "invalid signature" });

    // Reject stale orders whose maker has bumped their nonce on-chain.
    const liveNonce = (await config.publicClient.readContract({
      address: config.addresses.ctfExchange,
      abi: ctfExchangeAbi,
      functionName: "nonces",
      args: [o.maker],
    })) as bigint;
    if (BigInt(o.nonce) !== liveNonce) {
      return reply.code(400).send({ error: `stale nonce (expected ${liveNonce})` });
    }

    const hash = orderHash(o, config.chainId, config.addresses.ctfExchange);
    if (book.has(hash)) return reply.code(409).send({ error: "order already known", hash });

    const taker = toBookOrder(o, hash);
    const trades = await book.submit(taker, settle);

    // Record real fills into the activity feed.
    for (const t of trades) {
      const info = markets.token(t.tokenId);
      const mkt = info && markets.get(info.marketId);
      if (!info || !mkt) continue;
      const entry = {
        id: `${Date.now()}-${t.maker.slice(2, 8)}`,
        marketId: info.marketId,
        underlying: mkt.underlying,
        outcome: info.isYes ? Outcome.YES : Outcome.NO,
        side: o.side,
        price: t.price,
        shares: t.fillShares,
        trader: `${o.maker.slice(0, 6)}…${o.maker.slice(-4)}`,
        timestamp: t.timestamp,
      };
      activity.push(entry);
      hub.broadcast({ type: "activity", entry });
    }

    if (trades.length) hub.broadcast({ type: "trades", trades });
    publishBook(o.tokenId);
    const info = markets.token(o.tokenId);
    if (info) publishBook(info.complement);

    return {
      hash,
      status: taker.remainingShares === 0n ? "FILLED" : trades.length ? "PARTIAL" : "OPEN",
      trades,
      remainingShares: taker.remainingShares.toString(),
    };
  });

  app.delete<{ Params: { hash: string } }>("/orders/:hash", async (req) => {
    const removed = book.remove(req.params.hash);
    return { ok: removed };
  });

  app.get("/ws", { websocket: true }, (socket) => {
    hub.add(socket as any);
    socket.send(JSON.stringify({ type: "hello", markets: markets.all().length }));
  });

  return { app, markets, book };
}

/** JSON-safe view of a snapshot (bigint strings are already strings in our types). */
function serialize<T>(v: T): T {
  return v;
}
