import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { http } from "wagmi";
import {
  anvilLocal,
  robinhoodChainMainnet,
  robinhoodChainTestnet,
} from "@robinmarkets/shared";

const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID ?? "robinmarkets-dev";

// Anvil is a local dev chain — never show it to real users. Opt in for local
// testing with NEXT_PUBLIC_ENABLE_ANVIL=true; production shows only Robinhood Chain.
const chains =
  process.env.NEXT_PUBLIC_ENABLE_ANVIL === "true"
    ? ([robinhoodChainTestnet, robinhoodChainMainnet, anvilLocal] as const)
    : ([robinhoodChainTestnet, robinhoodChainMainnet] as const);

export const wagmiConfig = getDefaultConfig({
  appName: "RobinMarkets",
  projectId,
  chains,
  transports: {
    [robinhoodChainTestnet.id]: http(),
    [robinhoodChainMainnet.id]: http(),
    [anvilLocal.id]: http(),
  },
  ssr: true,
});
