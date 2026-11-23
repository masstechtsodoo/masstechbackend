import bcrypt from "bcryptjs";
import jwt, { type SignOptions } from "jsonwebtoken";
import type { RequestHandler } from "express";
import { count, eq } from "drizzle-orm";
import { db } from "../db/client.js";
import { admins } from "../db/schema.js";
import { env } from "../env.js";
import { HttpError } from "./http.js";

export type AdminClaims = { sub: number; email: string };

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      admin?: AdminClaims;
    }
  }
}

export const hashPassword = (pw: string) => bcrypt.hash(pw, 12);
export const verifyPassword = (pw: string, hash: string) => bcrypt.compare(pw, hash);

export function signToken(claims: AdminClaims) {
  return jwt.sign({ email: claims.email }, env.JWT_SECRET, {
    subject: String(claims.sub),
    expiresIn: env.JWT_EXPIRES_IN as SignOptions["expiresIn"],
    issuer: "masstech-api",
  });
}

export const requireAdmin: RequestHandler = (req, _res, next) => {
  const header = req.headers.authorization ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) throw new HttpError(401, "unauthorized");
  try {
    const payload = jwt.verify(token, env.JWT_SECRET, { issuer: "masstech-api" }) as jwt.JwtPayload;
    req.admin = { sub: Number(payload.sub), email: String(payload.email) };
    next();
  } catch {
    throw new HttpError(401, "invalid_token");
  }
};

/** Creates the first admin from ADMIN_EMAIL / ADMIN_PASSWORD when the table is empty. */
export async function bootstrapAdmin() {
  const [{ value }] = await db.select({ value: count() }).from(admins);
  if (value > 0) return;
  if (!env.ADMIN_EMAIL || !env.ADMIN_PASSWORD) {
    console.warn("⚠️  No admin exists. Set ADMIN_EMAIL and ADMIN_PASSWORD to create one on boot.");
    return;
  }
  await db
    .insert(admins)
    .values({ email: env.ADMIN_EMAIL.toLowerCase(), name: "Admin", passwordHash: await hashPassword(env.ADMIN_PASSWORD) })
    .onConflictDoNothing();
  console.log(`👤 Created admin ${env.ADMIN_EMAIL}`);
}

export async function findAdminByEmail(email: string) {
  const [row] = await db.select().from(admins).where(eq(admins.email, email.toLowerCase())).limit(1);
  return row;
}
