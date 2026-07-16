import type { Address } from "viem";
import {
  EIP712_DOMAIN_NAME,
  EIP712_DOMAIN_VERSION,
  ORDER_EIP712_TYPES,
  PRICE_SCALE,
  type SignedOrder,
  type Side,
} from "@robinmarkets/shared";

export interface BuildOrderParams {
  maker: Address;
  chainId: number;
  exchange: Address;
  tokenId: string;
  side: Side;
  /** price in collateral wei per share (1e18 == 1.0) */
  price: bigint;
  /** number of shares (18-decimal wei) */
  shares: bigint;
  nonce: bigint;
  /** unix seconds; 0 == no expiry */
  expiry?: number;
  signTypedDataAsync: (args: any) => Promise<`0x${string}`>;
}

/** Build, sign, and return a SignedOrder ready to POST to the order book. */
export async function createSignedOrder(p: BuildOrderParams): Promise<SignedOrder> {
  const makerAmount = p.side === "BUY" ? (p.shares * p.price) / PRICE_SCALE : p.shares;
  const takerAmount = p.side === "BUY" ? p.shares : (p.shares * p.price) / PRICE_SCALE;
  const salt = BigInt(Math.floor(Math.random() * 1e15));
  const expiry = p.expiry ?? 0;

  const message = {
    salt,
    maker: p.maker,
    signer: p.maker,
    tokenId: BigInt(p.tokenId),
    makerAmount,
    takerAmount,
    expiration: BigInt(expiry),
    nonce: p.nonce,
    side: p.side === "BUY" ? 0 : 1,
  };

  const signature = await p.signTypedDataAsync({
    domain: {
      name: EIP712_DOMAIN_NAME,
      version: EIP712_DOMAIN_VERSION,
      chainId: p.chainId,
      verifyingContract: p.exchange,
    },
    types: ORDER_EIP712_TYPES,
    primaryType: "Order",
    message,
  });

  return {
    salt: salt.toString(),
    maker: p.maker,
    signer: p.maker,
    tokenId: p.tokenId,
    makerAmount: makerAmount.toString(),
    takerAmount: takerAmount.toString(),
    side: p.side,
    price: p.price.toString(),
    expiry,
    nonce: p.nonce.toString(),
    signature,
  };
}

/** Convert a UI price in cents (e.g. 62 == $0.62) to 1e18-scaled price. */
export function centsToPrice(cents: number): bigint {
  return (BigInt(Math.round(cents * 100)) * PRICE_SCALE) / 10000n;
}
