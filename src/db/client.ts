import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { env } from "../env.js";
import * as schema from "./schema.js";

const needsSsl = /sslmode=require|neon\.tech/.test(env.DATABASE_URL);

export const pool = new pg.Pool({
  connectionString: env.DATABASE_URL.replace(/[?&]sslmode=[^&]+/, "").replace(/\?$/, ""),
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
  await migrate(db, { migrationsFolder });
}
