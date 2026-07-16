import {
  hashTypedData,
  verifyTypedData,
  type Address,
  type Hex,
} from "viem";
import {
  EIP712_DOMAIN_NAME,
  EIP712_DOMAIN_VERSION,
  ORDER_EIP712_TYPES,
  PRICE_SCALE,
  type SignedOrder,
  type Side,
} from "@robinmarkets/shared";

export function sideToUint(side: Side): number {
  return side === "BUY" ? 0 : 1;
}

/** The EIP-712 message form the contract signs/verifies (numeric side). */
function toMessage(o: SignedOrder) {
  return {
    salt: BigInt(o.salt),
    maker: o.maker,
    signer: o.signer,
    tokenId: BigInt(o.tokenId),
    makerAmount: BigInt(o.makerAmount),
    takerAmount: BigInt(o.takerAmount),
    expiration: BigInt(o.expiry),
    nonce: BigInt(o.nonce),
    side: sideToUint(o.side),
  };
}

export function domain(chainId: number, verifyingContract: Address) {
  return {
    name: EIP712_DOMAIN_NAME,
    version: EIP712_DOMAIN_VERSION,
    chainId,
    verifyingContract,
  } as const;
}

/** EIP-712 digest — matches CTFExchange.hashOrder on-chain. */
export function orderHash(o: SignedOrder, chainId: number, exchange: Address): Hex {
  return hashTypedData({
    domain: domain(chainId, exchange),
    types: ORDER_EIP712_TYPES,
    primaryType: "Order",
    message: toMessage(o),
  });
}

export async function verifyOrderSignature(
  o: SignedOrder,
  chainId: number,
  exchange: Address
): Promise<boolean> {
  try {
    return await verifyTypedData({
      address: o.signer,
      domain: domain(chainId, exchange),
      types: ORDER_EIP712_TYPES,
      primaryType: "Order",
      message: toMessage(o),
      signature: o.signature,
    });
  } catch {
    return false;
  }
}

/** Limit price in collateral wei per share (1e18 == 1.0), regardless of side. */
export function orderPrice(o: SignedOrder): bigint {
  const maker = BigInt(o.makerAmount);
  const taker = BigInt(o.takerAmount);
  return o.side === "BUY"
    ? (maker * PRICE_SCALE) / taker // collateral / shares
    : (taker * PRICE_SCALE) / maker;
}

/** Total shares an order is good for. */
export function orderShares(o: SignedOrder): bigint {
  return o.side === "BUY" ? BigInt(o.takerAmount) : BigInt(o.makerAmount);
}

export interface BookOrder {
  order: SignedOrder;
  hash: Hex;
  tokenId: bigint;
  side: Side;
  price: bigint;
  totalShares: bigint;
  remainingShares: bigint;
  createdAt: number;
  /** Display-only demo liquidity — shown in snapshots but never matched/settled. */
  synthetic?: boolean;
}

export function toBookOrder(o: SignedOrder, hash: Hex): BookOrder {
  const shares = orderShares(o);
  return {
    order: o,
    hash,
    tokenId: BigInt(o.tokenId),
    side: o.side,
    price: orderPrice(o),
    totalShares: shares,
    remainingShares: shares,
    createdAt: Date.now(),
  };
}
