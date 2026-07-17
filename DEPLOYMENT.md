# Deploying RobinMarkets

Two services, two hosts:

| Service | Host | Domain |
| --- | --- | --- |
| Web app (Next.js) | **Vercel** | `yourdomain.com` |
| Order book (Fastify + WS + settlement operator) | **Railway** | `api.yourdomain.com` |

Contracts are already live on **Robinhood Chain testnet (46630)** — see `contracts/deployments/46630.json`.

> Deploy **Railway first** (the web app needs its URL), then Vercel.

---

## Part A — Order book on Railway

1. **New Project → Deploy from GitHub repo** → pick `Gentle2003/RobinMarkets`.
   Railway reads `railway.json` at the repo root (installs the pnpm workspace and
   starts the order book via `tsx`). Leave **Root Directory** empty (repo root).
2. **Variables** → add:

   | Key | Value |
   | --- | --- |
   | `CHAIN_ID` | `46630` |
   | `SEED_BOOK` | `true` |
   | `OPERATOR_PRIVATE_KEY` | *(paste from your local `contracts/.env` — the throwaway testnet key; mark it secret)* |
   | `COLLATERAL_ADDRESS` | `0x305e372A1fc6Da47db2E4F2095f3F32FD2E4f5cB` |
   | `CONDITIONAL_TOKENS_ADDRESS` | `0xB0E013662510CD84977dCc6F19c6d3EdA547E1a7` |
   | `CTF_EXCHANGE_ADDRESS` | `0xb82d2498EFAb9bA5e412b2c7f2Aebb9542f6EC21` |
   | `RESOLVER_ADDRESS` | `0x446AC9ADfe95ae4004F6635F7E5d305C0403AC44` |
   | `MARKET_FACTORY_ADDRESS` | `0xa0179860D57631B41BF4CA2B1842a4580321616e` |

   (Addresses are also read from `deployments/46630.json`; setting them here makes
   the service self-contained. Optionally add `RPC_URL` with an Alchemy testnet
   endpoint to avoid the public RPC's rate limits.)
3. **Settings → Networking → Generate Domain**. Note the URL, e.g.
   `https://robinmarkets-orderbook-production.up.railway.app`.
   Verify: opening `<that-url>/health` returns `{"ok":true,"chainId":46630,...}`.
4. *(Optional)* **Custom Domain → `api.yourdomain.com`** → add the CNAME Railway shows.

---

## Part B — Web app on Vercel

1. **Add New… → Project → Import** `Gentle2003/RobinMarkets`.
2. **Root Directory → `web`.** Framework preset auto-detects **Next.js**.
   (Install/build use pnpm automatically via the repo's `packageManager` field.)
3. **Environment Variables**:

   | Key | Value |
   | --- | --- |
   | `NEXT_PUBLIC_ORDERBOOK_URL` | the Railway URL from A3 (or `https://api.yourdomain.com`) |
   | `NEXT_PUBLIC_CHAIN_ID` | `46630` |
   | `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` | a project id from https://cloud.reown.com (free; needed for wallet connect) |

4. **Deploy.** Then **Settings → Domains → add `yourdomain.com`** (and `www`).

---

## Part C — DNS (at your domain registrar)

Vercel and Railway each show the exact records; typically:

| Host | Type | Name | Value |
| --- | --- | --- | --- |
| Web apex | `A` | `@` | `76.76.21.21` (Vercel) |
| Web www | `CNAME` | `www` | `cname.vercel-dns.com` |
| Order book | `CNAME` | `api` | *(the target Railway shows)* |

If you use `api.yourdomain.com`, set `NEXT_PUBLIC_ORDERBOOK_URL=https://api.yourdomain.com`
in Vercel and redeploy.

---

## Part D — Verify

- `https://api.yourdomain.com/health` → `{"ok":true,"chainId":46630,"markets":15}`
- `https://yourdomain.com` loads; footer shows **Robinhood Chain Testnet** addresses
  linking to the testnet explorer; live stats tick; connecting a wallet on chain
  `46630` lets you trade.

## Notes

- The order book keeps orders/activity **in memory** — a redeploy resets them
  (fine for the demo; add a database later for persistence).
- CORS is already open (`@fastify/cors`), so the split origin works out of the box.
- Keep a little testnet ETH on the operator address
  (`0x214bf38BCdD62faeD40238dc5C343934036E9769`) so it can settle real matches.
