/**
 * Breaking-news feed: pulls real financial headlines from Yahoo Finance (keyless)
 * for the tickers we run markets on, so each headline can be linked to a related
 * prediction. Cached ~10 minutes to stay well within rate limits.
 */
export interface NewsItem {
  id: string;
  ticker: string;
  title: string;
  publisher: string;
  url: string;
  timestamp: number;
}

// Equity/ETF tickers carry rich, frequent news; these map cleanly to our markets.
const NEWS_TICKERS = ["AAPL", "NVDA", "TSLA", "MSFT", "META", "AMZN", "GOOGL", "COIN", "SPY"];

let cache: { items: NewsItem[]; ts: number } = { items: [], ts: 0 };

async function fetchTickerNews(ticker: string): Promise<NewsItem[]> {
  try {
    const url = `https://query1.finance.yahoo.com/v1/finance/search?q=${ticker}&newsCount=4&quotesCount=0`;
    const r = await fetch(url, {
      headers: { "user-agent": "Mozilla/5.0 (RobinMarkets news)" },
      signal: AbortSignal.timeout(7000),
    });
    const j = (await r.json()) as {
      news?: Array<{ uuid?: string; title?: string; publisher?: string; link?: string; providerPublishTime?: number }>;
    };
    return (j.news ?? [])
      .filter((n) => n.title && n.link)
      .map((n) => ({
        id: n.uuid ?? `${ticker}-${n.link}`,
        ticker,
        title: n.title!,
        publisher: n.publisher ?? "",
        url: n.link!,
        timestamp: (n.providerPublishTime ?? 0) * 1000,
      }));
  } catch {
    return [];
  }
}

/** Aggregated, de-duplicated, newest-first headlines across all tracked tickers. */
export async function getNews(limit = 24): Promise<NewsItem[]> {
  if (cache.items.length && Date.now() - cache.ts < 10 * 60 * 1000) {
    return cache.items.slice(0, limit);
  }
  const batches = await Promise.all(NEWS_TICKERS.map(fetchTickerNews));
  const seen = new Set<string>();
  const items = batches
    .flat()
    .filter((n) => {
      const key = n.title.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => b.timestamp - a.timestamp);
  if (items.length) cache = { items, ts: Date.now() };
  return (cache.items.length ? cache.items : items).slice(0, limit);
}
