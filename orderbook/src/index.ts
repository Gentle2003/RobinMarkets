import { loadConfig } from "./config.js";
import { buildServer } from "./server.js";
import { startMarketMaker } from "./marketmaker.js";

async function main() {
  const config = loadConfig();
  const { app, markets } = await buildServer(config);

  await app.listen({ port: config.port, host: "0.0.0.0" });
  app.log.info(
    `RobinMarkets order book on :${config.port} — chain ${config.chainId}` +
      (config.dryRun ? " (dry-run settlement)" : ` (operator ${config.operator?.address})`)
  );

  // Opt-in house liquidity so real trades can fill on-chain.
  if (process.env.RUN_MARKET_MAKER === "true") {
    await startMarketMaker(config, markets);
  }
}

main().catch((err) => {
  console.error("fatal:", err);
  process.exit(1);
});
