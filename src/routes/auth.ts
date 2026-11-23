import { Router } from "express";
import rateLimit from "express-rate-limit";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db } from "../db/client.js";
import { admins } from "../db/schema.js";
import { findAdminByEmail, hashPassword, requireAdmin, signToken, verifyPassword } from "../lib/auth.js";
import { HttpError } from "../lib/http.js";
import { changePasswordInput, loginInput } from "../lib/validation.js";

export const authRouter = Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { error: "too_many_requests" },
});

// Compared against when the e-mail does not exist, so timing does not reveal valid accounts
const DUMMY_HASH = bcrypt.hashSync("timing-safe-dummy-password", 12);

authRouter.post("/login", loginLimiter, async (req, res) => {
  const { email, password } = loginInput.parse(req.body);
  const admin = await findAdminByEmail(email);
  const ok = await verifyPassword(password, admin?.passwordHash ?? DUMMY_HASH);
  if (!admin || !ok) throw new HttpError(401, "invalid_credentials", "Invalid email or password");
  await db.update(admins).set({ lastLoginAt: new Date() }).where(eq(admins.id, admin.id));
  res.json({
    token: signToken({ sub: admin.id, email: admin.email }),
    admin: { id: admin.id, email: admin.email, name: admin.name },
  });
});

authRouter.get("/me", requireAdmin, async (req, res) => {
  const [admin] = await db
    .select({ id: admins.id, email: admins.email, name: admins.name, lastLoginAt: admins.lastLoginAt })
    .from(admins)
    .where(eq(admins.id, req.admin!.sub))
    .limit(1);
  if (!admin) throw new HttpError(401, "unauthorized");
  res.json(admin);
});

authRouter.post("/password", requireAdmin, async (req, res) => {
  const { currentPassword, newPassword } = changePasswordInput.parse(req.body);
  const [admin] = await db.select().from(admins).where(eq(admins.id, req.admin!.sub)).limit(1);
  if (!admin || !(await verifyPassword(currentPassword, admin.passwordHash))) {
    throw new HttpError(400, "wrong_password", "Current password is incorrect");
  }
  await db.update(admins).set({ passwordHash: await hashPassword(newPassword) }).where(eq(admins.id, admin.id));
  res.json({ ok: true });
});
