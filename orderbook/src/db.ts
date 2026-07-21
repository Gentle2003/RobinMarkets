import postgres, { type Sql } from "postgres";

/**
 * Optional Postgres persistence. When DATABASE_URL is set the service persists
 * durable data (usernames/traders, comments); otherwise everything stays
 * in-memory so local dev and no-DB deploys keep working. If the DB can't be
 * reached at startup, we log and fall back to in-memory rather than crash.
 */
let sql: Sql | null = null;

function connect(): Sql | null {
  const url = process.env.DATABASE_URL;
  if (!url) return null;
  // Only Postgres is supported. Ignore stale/other schemes (e.g. a leftover
  // sqlite: placeholder) so they can't crash startup — just run in-memory.
  if (!/^postgres(ql)?:\/\//i.test(url)) {
    console.warn(
      `[db] DATABASE_URL is not a postgres:// URL ("${url.split(":")[0]}:…") — ` +
        `ignoring and running in-memory. Set a Postgres connection string to persist.`
    );
    return null;
  }
  // Internal Railway/localhost connections don't use TLS; external ones do.
  const noSsl = /\.railway\.internal|localhost|127\.0\.0\.1/.test(url) && !/sslmode=require/.test(url);
  return postgres(url, {
    ssl: noSsl ? undefined : "require",
    connect_timeout: 10,
    idle_timeout: 30,
    onnotice: () => {},
  });
}

export function getSql(): Sql | null {
  return sql;
}

/** Connect (if configured) and create tables. Falls back to in-memory on error. */
export async function initDb(): Promise<boolean> {
  const client = connect();
  if (!client) {
    console.log("[db] no DATABASE_URL — running in-memory");
    return false;
  }
  try {
    await client`
      CREATE TABLE IF NOT EXISTS users (
        address    text PRIMARY KEY,
        username   text UNIQUE,
        first_seen bigint NOT NULL,
        last_seen  bigint NOT NULL,
        trades     integer NOT NULL DEFAULT 0,
        volume     double precision NOT NULL DEFAULT 0
      )`;
    await client`
      CREATE TABLE IF NOT EXISTS comments (
        id        text PRIMARY KEY,
        market_id text NOT NULL,
        author    text NOT NULL,
        body      text NOT NULL,
        ts        bigint NOT NULL
      )`;
    await client`CREATE INDEX IF NOT EXISTS comments_market_idx ON comments (market_id, ts DESC)`;
    sql = client;
    console.log("[db] connected — persistence enabled");
    return true;
  } catch (e) {
    console.error("[db] init failed, running in-memory:", (e as Error).message);
    try {
      await client.end({ timeout: 5 });
    } catch {
      /* ignore */
    }
    sql = null;
    return false;
  }
}
