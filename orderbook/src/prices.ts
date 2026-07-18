/**
 * Real-world price source for resolution. Fetches the live price of a market's
 * underlying from Yahoo Finance (keyless). Stocks/ETFs map to their ticker;
 * commodities/rates/RWA map to the closest public proxy.
 */
const YAHOO_SYMBOL: Record<string, string> = {
  // Stocks & ETFs
  AAPL: "AAPL",
  NVDA: "NVDA",
  TSLA: "TSLA",
  GOOGL: "GOOGL",
  MSFT: "MSFT",
  AMZN: "AMZN",
  META: "META",
  COIN: "COIN",
  SPY: "SPY",
  // RWA / commodities / rates (public proxies)
  GOLD: "GC=F", // gold futures
  SILVER: "SI=F", // silver futures
  WTI: "CL=F", // WTI crude futures
  "US-TBILL": "^IRX", // 13-week T-bill yield (proxy for 1Y)
  REIT: "VNQ", // Vanguard Real Estate ETF
  HOUSING: "ITB", // US home construction ETF
};

/** Current price (in the underlying's native unit — $ for equities, % for rates). */
export async function getUnderlyingPrice(underlying: string): Promise<number | null> {
  const symbol = YAHOO_SYMBOL[underlying];
  if (!symbol) return null;
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}`;
    const r = await fetch(url, {
      headers: { "user-agent": "Mozilla/5.0 (RobinMarkets resolver)" },
      signal: AbortSignal.timeout(8000),
    });
    const j = (await r.json()) as {
      chart?: { result?: Array<{ meta?: { regularMarketPrice?: number } }> };
    };
    const price = j?.chart?.result?.[0]?.meta?.regularMarketPrice;
    return typeof price === "number" && price > 0 ? price : null;
  } catch {
    return null;
  }
}
