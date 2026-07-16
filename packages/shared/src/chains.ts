import { defineChain } from "viem";

/**
 * Robinhood Chain — an Arbitrum L2 (full EVM) with ETH as the native gas token.
 * Params confirmed from https://docs.robinhood.com/chain/connecting/ (July 2026).
 *
 * Alchemy RPCs (https://robinhood-{mainnet,testnet}.g.alchemy.com/v2/{KEY}) are
 * preferred for production; the public RPCs below are rate-limited but need no key.
 */

const ALCHEMY_KEY = process.env.ALCHEMY_API_KEY ?? "";

export const robinhoodChainMainnet = defineChain({
  id: 4663,
  name: "Robinhood Chain",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: {
    default: {
      http: ["https://rpc.mainnet.chain.robinhood.com"],
      webSocket: ["wss://feed.mainnet.chain.robinhood.com"],
    },
    alchemy: {
      http: [`https://robinhood-mainnet.g.alchemy.com/v2/${ALCHEMY_KEY}`],
      webSocket: [`wss://robinhood-mainnet.g.alchemy.com/v2/${ALCHEMY_KEY}`],
    },
  },
  blockExplorers: {
    default: {
      name: "Blockscout",
      url: "https://robinhoodchain.blockscout.com",
    },
  },
  testnet: false,
});

export const robinhoodChainTestnet = defineChain({
  id: 46630,
  name: "Robinhood Chain Testnet",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: {
    default: {
      http: ["https://rpc.testnet.chain.robinhood.com"],
      webSocket: ["wss://feed.testnet.chain.robinhood.com"],
    },
    alchemy: {
      http: [`https://robinhood-testnet.g.alchemy.com/v2/${ALCHEMY_KEY}`],
      webSocket: [`wss://robinhood-testnet.g.alchemy.com/v2/${ALCHEMY_KEY}`],
    },
  },
  blockExplorers: {
    default: {
      name: "Blockscout",
      url: "https://explorer.testnet.chain.robinhood.com",
    },
  },
  testnet: true,
});

/** Local Foundry Anvil node for development. */
export const anvilLocal = defineChain({
  id: 31337,
  name: "Anvil (local)",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: {
    default: { http: ["http://127.0.0.1:8545"] },
  },
  testnet: true,
});

export const RH_TESTNET_FAUCET = "https://faucet.testnet.chain.robinhood.com";

export const chainsById = {
  [robinhoodChainMainnet.id]: robinhoodChainMainnet,
  [robinhoodChainTestnet.id]: robinhoodChainTestnet,
  [anvilLocal.id]: anvilLocal,
} as const;

export type SupportedChainId = keyof typeof chainsById;
