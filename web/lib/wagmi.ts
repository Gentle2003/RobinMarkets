import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { http } from "wagmi";
import {
  anvilLocal,
  robinhoodChainMainnet,
  robinhoodChainTestnet,
} from "@robinmarkets/shared";

const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID ?? "robinmarkets-dev";

export const wagmiConfig = getDefaultConfig({
  appName: "RobinMarkets",
  projectId,
  chains: [robinhoodChainTestnet, robinhoodChainMainnet, anvilLocal],
  transports: {
    [robinhoodChainTestnet.id]: http(),
    [robinhoodChainMainnet.id]: http(),
    [anvilLocal.id]: http(),
  },
  ssr: true,
});
