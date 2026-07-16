import Fastify, { type FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import websocket from "@fastify/websocket";
import { PRICE_SCALE, ctfExchangeAbi, type SignedOrder } from "@robinmarkets/shared";
import type { Config } from "./config.js";
import { MarketsRegistry } from "./markets.js";
import { OrderBook } from "./book.js";
import { Hub } from "./hub.js";
import { createSettleFn } from "./settlement.js";
import { orderHash, orderPrice, toBookOrder, verifyOrderSignature } from "./order.js";

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
