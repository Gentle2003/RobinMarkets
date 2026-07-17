import { parseEther } from "viem";
import {
  ctfExchangeAbi,
  EIP712_DOMAIN_NAME,
  EIP712_DOMAIN_VERSION,
  erc20Abi,
  ORDER_EIP712_TYPES,
  PRICE_SCALE,
} from "@robinmarkets/shared";
import type { Config } from "./config.js";
import type { MarketsRegistry } from "./markets.js";
import { targetCents } from "./seed.js";

/**
 * A minimal "house" market maker. The operator posts REAL, signed, matchable buy
 * orders on both outcomes of a few markets, so a user buying either side mints a
 * full set against the operator and the trade settles on-chain (real positions).
 *
 * Testnet-sized: liquidity is only as deep as the operator's ETH. Tune with
 * MM_MARKETS (how many markets) and MM_SPEND_ETH (ETH per resting order).
 */
export async function startMarketMaker(config: Config, markets: MarketsRegistry): Promise<void> {
  if (!config.walletClient || !config.operator) {
    console.log("[mm] no operator wallet configured — market maker disabled");
    return;
  }

  const op = config.operator.address;
  const { publicClient, walletClient, addresses, chain } = config;
  const spend = parseEther(process.env.MM_SPEND_ETH ?? "0.001");
  const nMarkets = Math.min(Number(process.env.MM_MARKETS ?? 2), markets.all().length);
  const mmMarkets = markets.all().slice(0, nMarkets);
  const budget = spend * BigInt(mmMarkets.length * 2);

  try {
    // 1. Wrap enough native ETH → WETH to back the orders.
    const wethBal = (await publicClient.readContract({
      address: addresses.collateral,
      abi: erc20Abi,
      functionName: "balanceOf",
      args: [op],
    })) as bigint;
    if (wethBal < budget) {
      const hash = await walletClient.writeContract({
        account: config.operator,
        chain,
        address: addresses.collateral,
        abi: erc20Abi,
        functionName: "deposit",
        value: budget - wethBal,
      });
      await publicClient.waitForTransactionReceipt({ hash });
      console.log(`[mm] wrapped ${Number(budget - wethBal) / 1e18} ETH → WETH`);
    }

    // 2. Approve the exchange to spend the operator's WETH.
    const allowance = (await publicClient.readContract({
      address: addresses.collateral,
      abi: erc20Abi,
      functionName: "allowance",
      args: [op, addresses.ctfExchange],
    })) as bigint;
    if (allowance < budget) {
      const hash = await walletClient.writeContract({
        account: config.operator,
        chain,
        address: addresses.collateral,
        abi: erc20Abi,
        functionName: "approve",
        args: [addresses.ctfExchange, 2n ** 255n],
      });
      await publicClient.waitForTransactionReceipt({ hash });
      console.log("[mm] approved WETH for exchange");
    }

    // 3. Post signed two-sided buy orders so users can mint against us.
    const nonce = (await publicClient.readContract({
      address: addresses.ctfExchange,
      abi: ctfExchangeAbi,
      functionName: "nonces",
      args: [op],
    })) as bigint;

    const url = `http://127.0.0.1:${config.port}/orders`;
    let posted = 0;
    for (const m of mmMarkets) {
      const yesCents = targetCents(m.id);
      const legs = [
        { tokenId: m.yesPositionId, cents: Math.max(2, yesCents - 2), label: "YES" },
        { tokenId: m.noPositionId, cents: Math.max(2, 100 - yesCents - 2), label: "NO" },
      ];
      for (const leg of legs) {
        const order = await signBuyOrder(config, leg.tokenId, leg.cents, spend, nonce);
        const res = await fetch(url, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(order),
        });
        if (res.ok) posted++;
        else console.log(`[mm] ${m.underlying} ${leg.label} rejected: ${await res.text()}`);
      }
    }
    console.log(`[mm] posted ${posted} real orders across ${mmMarkets.length} markets (budget ${Number(budget) / 1e18} ETH)`);
  } catch (e) {
    console.error("[mm] error:", (e as Error).message);
  }
}

async function signBuyOrder(
  config: Config,
  tokenId: string,
  cents: number,
  spend: bigint,
  nonce: bigint
) {
  const price = (BigInt(cents) * PRICE_SCALE) / 100n;
  const makerAmount = spend; // BUY: give collateral
  const takerAmount = (spend * PRICE_SCALE) / price; // shares wanted
  const salt = BigInt(Math.floor(Math.random() * 1e15));
  const maker = config.operator!.address;

  const signature = await config.walletClient!.signTypedData({
    account: config.operator!,
    domain: {
      name: EIP712_DOMAIN_NAME,
      version: EIP712_DOMAIN_VERSION,
      chainId: config.chainId,
      verifyingContract: config.addresses.ctfExchange,
    },
    types: ORDER_EIP712_TYPES,
    primaryType: "Order",
    message: {
      salt,
      maker,
      signer: maker,
      tokenId: BigInt(tokenId),
      makerAmount,
      takerAmount,
      expiration: 0n,
      nonce,
      side: 0,
    },
  });

  return {
    salt: salt.toString(),
    maker,
    signer: maker,
    tokenId,
    makerAmount: makerAmount.toString(),
    takerAmount: takerAmount.toString(),
    side: "BUY",
    price: price.toString(),
    expiry: 0,
    nonce: nonce.toString(),
    signature,
  };
}
