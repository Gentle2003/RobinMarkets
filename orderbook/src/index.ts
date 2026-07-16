import { loadConfig } from "./config.js";
import { buildServer } from "./server.js";

async function main() {
  const config = loadConfig();
  const { app } = await buildServer(config);

  await app.listen({ port: config.port, host: "0.0.0.0" });
  app.log.info(
    `RobinMarkets order book on :${config.port} — chain ${config.chainId}` +
      (config.dryRun ? " (dry-run settlement)" : ` (operator ${config.operator?.address})`)
  );
}

main().catch((err) => {
  console.error("fatal:", err);
  process.exit(1);
});
