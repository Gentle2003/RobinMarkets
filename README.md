# RobinMarkets

A CLOB (central-limit-order-book) prediction market for **Stocks & RWA outcomes**,
settled in wrapped Robinhood ETH, built on **[Robinhood Chain](https://docs.robinhood.com/chain/)**.

Think Polymarket, scoped to two sectors: tokenized equities and real-world assets.
Users trade binary (YES / NO) outcome shares via off-chain signed limit orders that
settle on-chain — the same hybrid model Polymarket uses.

## Architecture

```
web/ (Next.js + wagmi/viem/RainbowKit)
  browse markets · sign EIP-712 orders · order-book UI · portfolio · redeem
        │ REST/WS                         │ on-chain reads/writes
orderbook/ (Node/TS)                contracts/ (Foundry / Solidity)
  store & match signed orders  ─────▶  ConditionalTokens (ERC-1155)
  operator settles fills             CTFExchange (EIP-712 settlement)
                                     MarketFactory · Resolver (Chainlink)
                                     WETH collateral + mock stock tokens
packages/shared — chain config, domain types, ABIs
```

**Trade lifecycle:** a user signs an EIP-712 limit order off-chain (gasless) → the
order book service stores and matches it → the operator submits matched orders to
the `CTFExchange`, which atomically settles them against Conditional Tokens.

## Network

| | Mainnet | Testnet |
|---|---|---|
| Chain ID | 4663 | 46630 |
| Public RPC | `https://rpc.mainnet.chain.robinhood.com` | `https://rpc.testnet.chain.robinhood.com` |
| Explorer | robinhoodchain.blockscout.com | explorer.testnet.chain.robinhood.com |
| Faucet | — | faucet.testnet.chain.robinhood.com |

Robinhood Chain is an Arbitrum L2 with full EVM support and ETH as the native gas
token. Tokenized stocks are standard ERC-20s (18 decimals); Chainlink price feeds
are available on-chain for market resolution.

## Packages

| Path | What it is |
|---|---|
| `contracts/` | Foundry (Solidity) — CTF, CLOB exchange, factory, resolver |
| `orderbook/` | Node/TS off-chain order book + matching + settlement operator |
| `web/` | Next.js trading app |
| `packages/shared` | Shared chain config, domain types, ABIs |

## Getting started

```bash
pnpm install
cp .env.example .env        # fill in keys as needed

# local dev loop
pnpm chain                  # terminal 1 — Anvil local node
pnpm contracts:test         # run contract tests
pnpm dev:orderbook          # terminal 2 — order book service
pnpm dev:web                # terminal 3 — web app
```

## Status

Early build. See the phased plan in the repo tasks. Nothing here is audited —
**do not use with real funds.**
