/**
 * End-to-end smoke test: signs real EIP-712 orders, posts them to a running order
 * book service, and asserts the matched fill settled on-chain (token balances move).
 *
 * Assumes: Anvil on :8545, contracts deployed (deployments/31337.json), and the
 * order book running on :4000 with a live operator key.
 *
 *   tsx orderbook/scripts/smoke.ts
 */
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  createPublicClient,
  createWalletClient,
  http,
  parseEther,
  type Address,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import {
  EIP712_DOMAIN_NAME,
  EIP712_DOMAIN_VERSION,
  ORDER_EIP712_TYPES,
  anvilLocal,
  conditionalTokensAbi,
  erc20Abi,
  marketFactoryAbi,
} from "@robinmarkets/shared";

const __dirname = dirname(fileURLToPath(import.meta.url));
const API = process.env.ORDERBOOK_URL ?? "http://127.0.0.1:4000";
const RPC = "http://127.0.0.1:8545";
const ONE = 10n ** 18n;

// Anvil deterministic accounts.
const ALICE_PK = "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d";
const BOB_PK = "0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a";

const deployments = JSON.parse(
  readFileSync(resolve(__dirname, "../../contracts/deployments/31337.json"), "utf8")
) as Record<string, Address>;

const pub = createPublicClient({ chain: anvilLocal, transport: http(RPC) });

async function main() {
  const alice = privateKeyToAccount(ALICE_PK);
  const bob = privateKeyToAccount(BOB_PK);
  const exchange = deployments.ctfExchange;
  const weth = deployments.collateral;
  const ctf = deployments.conditionalTokens;

  // Discover the first market's YES/NO token ids.
  const ids = (await pub.readContract({
    address: deployments.marketFactory,
    abi: marketFactoryAbi,
    functionName: "allMarketIds",
  })) as readonly `0x${string}`[];
  const market = (await pub.readContract({
    address: deployments.marketFactory,
    abi: marketFactoryAbi,
    functionName: "getMarket",
    args: [ids[0]],
  })) as any;
  const yesId: bigint = market.yesTokenId;
  const noId: bigint = market.noTokenId;
  console.log(`market ${ids[0].slice(0, 10)} — ${market.underlying}: ${market.question}`);

  // Fund + approve both buyers.
  for (const acct of [alice, bob]) {
    const wallet = createWalletClient({ account: acct, chain: anvilLocal, transport: http(RPC) });
    await wallet.writeContract({ address: weth, abi: erc20Abi, functionName: "deposit", value: parseEther("100") });
    const h = await wallet.writeContract({
      address: weth,
      abi: erc20Abi,
      functionName: "approve",
      args: [exchange, 2n ** 255n],
    });
    await pub.waitForTransactionReceipt({ hash: h });
  }

  const domain = {
    name: EIP712_DOMAIN_NAME,
    version: EIP712_DOMAIN_VERSION,
    chainId: anvilLocal.id,
    verifyingContract: exchange,
  } as const;

  async function buildBuy(acct: typeof alice, tokenId: bigint, priceE18: bigint, shares: bigint) {
    const wallet = createWalletClient({ account: acct, chain: anvilLocal, transport: http(RPC) });
    const makerAmount = (shares * priceE18) / ONE; // collateral in
    const message = {
      salt: BigInt(Math.floor(Math.random() * 1e15)),
      maker: acct.address,
      signer: acct.address,
      tokenId,
      makerAmount,
      takerAmount: shares,
      expiration: 0n,
      nonce: 0n,
      side: 0, // BUY
    };
    const signature = await wallet.signTypedData({
      domain,
      types: ORDER_EIP712_TYPES,
      primaryType: "Order",
      message,
    });
    return {
      salt: message.salt.toString(),
      maker: acct.address,
      signer: acct.address,
      tokenId: tokenId.toString(),
      makerAmount: makerAmount.toString(),
      takerAmount: shares.toString(),
      side: "BUY",
      price: priceE18.toString(),
      expiry: 0,
      nonce: "0",
      signature,
    };
  }

  async function post(order: unknown) {
    const res = await fetch(`${API}/orders`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(order),
    });
    const body = await res.json();
    if (!res.ok) throw new Error(`POST /orders ${res.status}: ${JSON.stringify(body)}`);
    return body;
  }

  // Alice BUYs YES @ 0.60, Bob BUYs NO @ 0.50 → sum 1.10 ≥ 1 → MINT match.
  const aliceOrder = await buildBuy(alice, yesId, (ONE * 60n) / 100n, 100n * ONE);
  const bobOrder = await buildBuy(bob, noId, (ONE * 50n) / 100n, 100n * ONE);

  const r1 = await post(aliceOrder);
  console.log(`alice order: ${r1.status}, ${r1.trades.length} trades (should rest)`);
  const r2 = await post(bobOrder);
  console.log(`bob order:   ${r2.status}, ${r2.trades.length} trades (should MINT)`);

  // Verify the fill settled on-chain.
  const aliceYes = (await pub.readContract({
    address: ctf, abi: conditionalTokensAbi, functionName: "balanceOf", args: [alice.address, yesId],
  })) as bigint;
  const bobNo = (await pub.readContract({
    address: ctf, abi: conditionalTokensAbi, functionName: "balanceOf", args: [bob.address, noId],
  })) as bigint;

  console.log(`\non-chain balances after settlement:`);
  console.log(`  alice YES = ${aliceYes / ONE}  (expect 100)`);
  console.log(`  bob   NO  = ${bobNo / ONE}  (expect 100)`);

  const ok = aliceYes === 100n * ONE && bobNo === 100n * ONE && r2.trades[0]?.matchType === "MINT";
  console.log(ok ? "\n✅ SMOKE TEST PASSED — order matched and settled on-chain" : "\n❌ SMOKE TEST FAILED");
  process.exit(ok ? 0 : 1);
}

main().catch((e) => {
  console.error("smoke test error:", e);
  process.exit(1);
});
