import { ctfExchangeAbi, type SignedOrder } from "@robinmarkets/shared";
import type { Config } from "./config.js";
import type { SettleFn } from "./book.js";
import { sideToUint, type BookOrder } from "./order.js";

/** Convert a SignedOrder into the on-chain Order tuple (numeric side, bigint fields). */
export function orderToTuple(o: SignedOrder) {
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
    signature: o.signature,
  };
}

/**
 * Build the settlement function used by the matching engine. When an operator key
 * is configured it submits {CTFExchange.matchOrders} and waits for the receipt;
 * otherwise it runs in dry-run mode (logs the intended fill, reports success) so
 * the book can be exercised without a funded operator.
 */
export function createSettleFn(config: Config): SettleFn {
  return async (taker: BookOrder, maker: BookOrder, fillShares: bigint, matchType) => {
    if (config.dryRun || !config.walletClient || !config.operator) {
      console.log(
        `[settle:dry-run] ${matchType} ${fillShares} shares  taker=${taker.hash.slice(0, 10)} maker=${maker.hash.slice(0, 10)}`
      );
      return true;
    }
    try {
      const hash = await config.walletClient.writeContract({
        address: config.addresses.ctfExchange,
        abi: ctfExchangeAbi,
        functionName: "matchOrders",
        args: [orderToTuple(taker.order), orderToTuple(maker.order), fillShares],
        account: config.operator,
        chain: config.chain,
      });
      const receipt = await config.publicClient.waitForTransactionReceipt({ hash });
      if (receipt.status !== "success") {
        console.error(`[settle] tx reverted: ${hash}`);
        return false;
      }
      console.log(`[settle] ${matchType} ${fillShares} shares settled in ${hash}`);
      return true;
    } catch (err) {
      console.error(`[settle] failed:`, (err as Error).message);
      return false;
    }
  };
}
