import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  createPublicClient,
  createWalletClient,
  http,
  type Account,
  type Address,
  type Chain,
  type PublicClient,
  type WalletClient,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { chainsById, type SupportedChainId } from "@robinmarkets/shared";

const __dirname = dirname(fileURLToPath(import.meta.url));

export interface Addresses {
  collateral: Address;
  conditionalTokens: Address;
  ctfExchange: Address;
  resolver: Address;
  marketFactory: Address;
}

export interface Config {
  chain: Chain;
  chainId: number;
  port: number;
  publicClient: PublicClient;
  /** Present only when OPERATOR_PRIVATE_KEY is configured. */
  walletClient?: WalletClient;
  operator?: Account;
  addresses: Addresses;
  /** When true, matched trades are logged but not submitted on-chain. */
  dryRun: boolean;
}

function loadAddresses(chainId: number): Addresses {
  // Prefer explicit env, else fall back to the Foundry deployment artifact.
  const env = process.env;
  if (env.CTF_EXCHANGE_ADDRESS && env.MARKET_FACTORY_ADDRESS) {
    return {
      collateral: env.COLLATERAL_ADDRESS as Address,
      conditionalTokens: env.CONDITIONAL_TOKENS_ADDRESS as Address,
      ctfExchange: env.CTF_EXCHANGE_ADDRESS as Address,
      resolver: env.RESOLVER_ADDRESS as Address,
      marketFactory: env.MARKET_FACTORY_ADDRESS as Address,
    };
  }
  const path = resolve(__dirname, `../../contracts/deployments/${chainId}.json`);
  try {
    const json = JSON.parse(readFileSync(path, "utf8"));
    return json as Addresses;
  } catch {
    throw new Error(
      `No contract addresses found. Set CTF_EXCHANGE_ADDRESS/MARKET_FACTORY_ADDRESS ` +
        `env vars or deploy contracts to chain ${chainId} (writes ${path}).`
    );
  }
}

export function loadConfig(): Config {
  const chainId = Number(process.env.CHAIN_ID ?? 31337) as SupportedChainId;
  const chain = chainsById[chainId];
  if (!chain) throw new Error(`Unsupported CHAIN_ID: ${chainId}`);

  const rpcUrl = process.env.RPC_URL ?? chain.rpcUrls.default.http[0];
  const publicClient = createPublicClient({ chain, transport: http(rpcUrl) }) as PublicClient;

  let walletClient: WalletClient | undefined;
  let operator: Account | undefined;
  const opKey = process.env.OPERATOR_PRIVATE_KEY;
  if (opKey && opKey.length > 3) {
    operator = privateKeyToAccount(opKey as `0x${string}`);
    walletClient = createWalletClient({ account: operator, chain, transport: http(rpcUrl) });
  }

  return {
    chain,
    chainId,
    port: Number(process.env.ORDERBOOK_PORT ?? 4000),
    publicClient,
    walletClient,
    operator,
    addresses: loadAddresses(chainId),
    dryRun: !walletClient || process.env.DRY_RUN === "true",
  };
}
