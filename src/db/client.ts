import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { env } from "../env.js";
import * as schema from "./schema.js";

/**
 * Neon connection strings look like
 *   postgresql://user:pass@ep-xxx-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require
 * SSL is configured explicitly below, so the ssl-related query params are removed with a real URL parser
 * (string slicing here once broke the database name, e.g. "neondb&channel_binding=require").
 */
function parseDatabaseUrl(raw: string) {
  const url = new URL(raw.trim());
  const sslmode = url.searchParams.get("sslmode");
  const needsSsl =
    (sslmode !== null && sslmode !== "disable") || url.hostname.endsWith(".neon.tech") || url.hostname.endsWith(".render.com");
  for (const key of ["sslmode", "channel_binding", "sslrootcert", "sslcert", "sslkey"]) url.searchParams.delete(key);
  return { connectionString: url.toString(), needsSsl, database: decodeURIComponent(url.pathname.slice(1)) };
}

const { connectionString, needsSsl, database } = parseDatabaseUrl(env.DATABASE_URL);

export const pool = new pg.Pool({
  connectionString,
  ssl: needsSsl ? { rejectUnauthorized: true } : undefined,
  max: env.DB_POOL_MAX,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 10_000,
});

pool.on("error", (err) => console.error("Postgres pool error", err));

export const db = drizzle(pool, { schema });

const here = path.dirname(fileURLToPath(import.meta.url));
// src/db → ../../drizzle  (also works from dist/db)
export const migrationsFolder = path.resolve(here, "..", "..", "drizzle");

export async function runMigrations() {
  console.log(`🔌 Connecting to database "${database}"${needsSsl ? " (SSL)" : ""}`);
  await migrate(db, { migrationsFolder });
}