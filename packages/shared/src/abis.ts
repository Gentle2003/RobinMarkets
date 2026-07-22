/**
 * Minimal ABI fragments for the RobinMarkets contracts — only the functions and
 * events the order book service and web app actually use. Kept hand-written (not
 * generated from artifacts) so the TS packages don't depend on a Foundry build.
 */

/** The EIP-712 Order tuple, shared by several exchange functions. */
export const orderTupleComponents = [
  { name: "salt", type: "uint256" },
  { name: "maker", type: "address" },
  { name: "signer", type: "address" },
  { name: "tokenId", type: "uint256" },
  { name: "makerAmount", type: "uint256" },
  { name: "takerAmount", type: "uint256" },
  { name: "expiration", type: "uint256" },
  { name: "nonce", type: "uint256" },
  { name: "side", type: "uint8" },
  { name: "signature", type: "bytes" },
] as const;

export const ctfExchangeAbi = [
  {
    type: "function",
    name: "matchOrders",
    stateMutability: "nonpayable",
    inputs: [
      { name: "taker", type: "tuple", components: orderTupleComponents },
      { name: "maker", type: "tuple", components: orderTupleComponents },
      { name: "fillShares", type: "uint256" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "hashOrder",
    stateMutability: "view",
    inputs: [{ name: "o", type: "tuple", components: orderTupleComponents }],
    outputs: [{ name: "", type: "bytes32" }],
  },
  {
    type: "function",
    name: "filled",
    stateMutability: "view",
    inputs: [{ name: "", type: "bytes32" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "nonces",
    stateMutability: "view",
    inputs: [{ name: "", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "cancelOrder",
    stateMutability: "nonpayable",
    inputs: [{ name: "o", type: "tuple", components: orderTupleComponents }],
    outputs: [],
  },
  {
    type: "function",
    name: "incrementNonce",
    stateMutability: "nonpayable",
    inputs: [],
    outputs: [],
  },
  {
    type: "event",
    name: "OrdersMatched",
    inputs: [
      { name: "takerHash", type: "bytes32", indexed: true },
      { name: "makerHash", type: "bytes32", indexed: true },
      { name: "matchType", type: "uint8", indexed: false },
      { name: "fillShares", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "OrderFilled",
    inputs: [
      { name: "orderHash", type: "bytes32", indexed: true },
      { name: "maker", type: "address", indexed: true },
      { name: "tokenId", type: "uint256", indexed: false },
      { name: "makerAmountFilled", type: "uint256", indexed: false },
      { name: "takerAmountFilled", type: "uint256", indexed: false },
    ],
  },
] as const;

export const marketFactoryAbi = [
  {
    type: "function",
    name: "createMarket",
    stateMutability: "nonpayable",
    inputs: [
      {
        name: "p",
        type: "tuple",
        components: [
          { name: "sector", type: "uint8" },
          { name: "underlying", type: "string" },
          { name: "question", type: "string" },
          { name: "collateral", type: "address" },
          { name: "closeTime", type: "uint64" },
          { name: "resolveTime", type: "uint64" },
          { name: "feed", type: "address" },
          { name: "threshold", type: "int256" },
          { name: "greaterIsYes", type: "bool" },
        ],
      },
    ],
    outputs: [
      { name: "conditionId", type: "bytes32" },
      { name: "yesId", type: "uint256" },
      { name: "noId", type: "uint256" },
    ],
  },
  {
    type: "function",
    name: "allMarketIds",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "bytes32[]" }],
  },
  {
    type: "function",
    name: "marketCount",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "getMarket",
    stateMutability: "view",
    inputs: [{ name: "conditionId", type: "bytes32" }],
    outputs: [
      {
        name: "",
        type: "tuple",
        components: [
          { name: "questionId", type: "bytes32" },
          { name: "conditionId", type: "bytes32" },
          { name: "sector", type: "uint8" },
          { name: "underlying", type: "string" },
          { name: "question", type: "string" },
          { name: "collateral", type: "address" },
          { name: "yesTokenId", type: "uint256" },
          { name: "noTokenId", type: "uint256" },
          { name: "closeTime", type: "uint64" },
          { name: "resolveTime", type: "uint64" },
          { name: "exists", type: "bool" },
        ],
      },
    ],
  },
  {
    type: "event",
    name: "MarketCreated",
    inputs: [
      { name: "conditionId", type: "bytes32", indexed: true },
      { name: "questionId", type: "bytes32", indexed: true },
      { name: "sector", type: "uint8", indexed: false },
      { name: "underlying", type: "string", indexed: false },
      { name: "question", type: "string", indexed: false },
      { name: "collateral", type: "address", indexed: false },
      { name: "yesTokenId", type: "uint256", indexed: false },
      { name: "noTokenId", type: "uint256", indexed: false },
      { name: "closeTime", type: "uint64", indexed: false },
      { name: "resolveTime", type: "uint64", indexed: false },
    ],
  },
] as const;

export const conditionalTokensAbi = [
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [
      { name: "account", type: "address" },
      { name: "id", type: "uint256" },
    ],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "balanceOfBatch",
    stateMutability: "view",
    inputs: [
      { name: "accounts", type: "address[]" },
      { name: "ids", type: "uint256[]" },
    ],
    outputs: [{ name: "", type: "uint256[]" }],
  },
  {
    type: "function",
    name: "splitPosition",
    stateMutability: "nonpayable",
    inputs: [
      { name: "collateral", type: "address" },
      { name: "conditionId", type: "bytes32" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "mergePositions",
    stateMutability: "nonpayable",
    inputs: [
      { name: "collateral", type: "address" },
      { name: "conditionId", type: "bytes32" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "redeemPositions",
    stateMutability: "nonpayable",
    inputs: [
      { name: "collateral", type: "address" },
      { name: "conditionId", type: "bytes32" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "setApprovalForAll",
    stateMutability: "nonpayable",
    inputs: [
      { name: "operator", type: "address" },
      { name: "approved", type: "bool" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "isApprovedForAll",
    stateMutability: "view",
    inputs: [
      { name: "account", type: "address" },
      { name: "operator", type: "address" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    type: "function",
    name: "payoutDenominator",
    stateMutability: "view",
    inputs: [{ name: "", type: "bytes32" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "payoutNumerators",
    stateMutability: "view",
    inputs: [
      { name: "", type: "bytes32" },
      { name: "", type: "uint256" },
    ],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;

export const resolverAbi = [
  {
    type: "function",
    name: "adminResolve",
    stateMutability: "nonpayable",
    inputs: [
      { name: "questionId", type: "bytes32" },
      { name: "yes", type: "bool" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "resolveByFeed",
    stateMutability: "nonpayable",
    inputs: [{ name: "questionId", type: "bytes32" }],
    outputs: [],
  },
  {
    type: "function",
    name: "questions",
    stateMutability: "view",
    inputs: [{ name: "", type: "bytes32" }],
    outputs: [
      { name: "exists", type: "bool" },
      { name: "resolved", type: "bool" },
      { name: "feed", type: "address" },
      { name: "threshold", type: "int256" },
      { name: "greaterIsYes", type: "bool" },
      { name: "resolveTime", type: "uint64" },
    ],
  },
] as const;

export const erc20Abi = [
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "allowance",
    stateMutability: "view",
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "approve",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    type: "function",
    name: "decimals",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint8" }],
  },
  {
    type: "function",
    name: "deposit",
    stateMutability: "payable",
    inputs: [],
    outputs: [],
  },
] as const;

/** EIP-712 typed-data definition for signing/verifying orders. */
export const ORDER_EIP712_TYPES = {
  Order: [
    { name: "salt", type: "uint256" },
    { name: "maker", type: "address" },
    { name: "signer", type: "address" },
    { name: "tokenId", type: "uint256" },
    { name: "makerAmount", type: "uint256" },
    { name: "takerAmount", type: "uint256" },
    { name: "expiration", type: "uint256" },
    { name: "nonce", type: "uint256" },
    { name: "side", type: "uint8" },
  ],
} as const;

export const EIP712_DOMAIN_NAME = "RobinMarkets CTF Exchange";
export const EIP712_DOMAIN_VERSION = "1";
