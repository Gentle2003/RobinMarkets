import { loadConfig } from "./config.js";
import { buildServer } from "./server.js";
import { startMarketMaker } from "./marketmaker.js";
import { startResolverLoop } from "./resolver.js";
import { startMarketCreatorLoop } from "./marketcreator.js";

async function main() {
  const config = loadConfig();
  const { app, markets, book } = await buildServer(config);

  await app.listen({ port: config.port, host: "0.0.0.0" });
  app.log.info(
    `RobinMarkets order book on :${config.port} — chain ${config.chainId}` +
      (config.dryRun ? " (dry-run settlement)" : ` (operator ${config.operator?.address})`)
  );

  // Opt-in house liquidity so real trades can fill on-chain. Runs on an interval,
  // continuously topping up any quote a taker has consumed.
  if (process.env.RUN_MARKET_MAKER === "true") {
    await startMarketMaker(config, markets, book);
  }

  // Auto-resolve markets on real data once their resolveTime passes.
  if (!config.dryRun && process.env.RUN_RESOLVER !== "false") {
    startResolverLoop(config, markets);
  }

  // Opt-in: keep daily/weekly/monthly markets stocked automatically (costs gas).
  if (process.env.RUN_MARKET_CREATOR === "true") {
    startMarketCreatorLoop(config, markets);
  }
}

main().catch((err) => {
  console.error("fatal:", err);
  process.exit(1);
});
