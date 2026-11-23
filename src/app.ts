import express from "express";
import cors from "cors";
import helmet from "helmet";
import { sql } from "drizzle-orm";
import { db } from "./db/client.js";
import { env } from "./env.js";
import { errorHandler, notFoundHandler } from "./lib/http.js";
import { adminRouter } from "./routes/admin.js";
import { authRouter } from "./routes/auth.js";
import { publicRouter } from "./routes/public.js";

export function createApp() {
  const app = express();
  app.disable("x-powered-by");
  // Render puts one proxy in front of the service – needed for correct client IPs in rate limiting
  app.set("trust proxy", 1);

  app.use(helmet());
  const origins = env.CORS_ORIGINS.split(",").map((s) => s.trim()).filter(Boolean);
  app.use(
    cors({
      origin: (origin, cb) => cb(null, !origin || origins.includes(origin)),
      methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
      allowedHeaders: ["Content-Type", "Authorization"],
      maxAge: 86400,
    }),
  );
  app.use(express.json({ limit: "1mb" }));

  app.get("/", (_req, res) => {
    res.json({ name: "masstech-api", status: "ok" });
  });

  app.get("/health", async (_req, res) => {
    try {
      await db.execute(sql`select 1`);
      res.json({ ok: true });
    } catch {
      res.status(503).json({ ok: false });
    }
  });

  app.use("/v1", publicRouter);
  app.use("/v1/auth", authRouter);
  app.use("/v1/admin", adminRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
