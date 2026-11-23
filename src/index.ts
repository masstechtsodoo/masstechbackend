import { env } from "./env.js";
import { pool, runMigrations } from "./db/client.js";
import { bootstrapAdmin } from "./lib/auth.js";
import { createApp } from "./app.js";

async function main() {
  await runMigrations();
  console.log("✅ Database migrations applied");
  await bootstrapAdmin();

  const server = createApp().listen(env.PORT, () => {
    console.log(`🚀 masstech-api listening on :${env.PORT} (${env.NODE_ENV})`);
  });

  const shutdown = (signal: string) => {
    console.log(`${signal} received, shutting down`);
    server.close(() => pool.end().finally(() => process.exit(0)));
    setTimeout(() => process.exit(1), 10_000).unref();
  };
  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}

main().catch((err) => {
  console.error("Failed to start", err);
  process.exit(1);
});
