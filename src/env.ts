import { z } from "zod";

const schema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT: z.coerce.number().int().positive().default(4000),

  // Neon connection string, e.g. postgresql://user:pass@ep-xxx.ap-southeast-1.aws.neon.tech/masstech?sslmode=require
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  DB_POOL_MAX: z.coerce.number().int().min(1).max(50).default(10),

  // Long random string (e.g. `openssl rand -base64 48`)
  JWT_SECRET: z.string().min(32, "JWT_SECRET must be at least 32 characters"),
  JWT_EXPIRES_IN: z.string().default("7d"),

  // First admin is created automatically on boot when the admins table is empty
  ADMIN_EMAIL: z.email().optional(),
  ADMIN_PASSWORD: z.string().min(10).optional(),

  // Comma-separated list of browser origins allowed to call the API directly
  CORS_ORIGINS: z.string().default("https://masstech.mn,https://www.masstech.mn,http://localhost:3000"),

  CLOUDINARY_CLOUD_NAME: z.string().optional(),
  CLOUDINARY_API_KEY: z.string().optional(),
  CLOUDINARY_API_SECRET: z.string().optional(),
  CLOUDINARY_FOLDER: z.string().default("masstech"),

  // Optional e-mail notification for new contact messages (https://resend.com)
  RESEND_API_KEY: z.string().optional(),
  CONTACT_TO_EMAIL: z.string().default("info@masstech.mn"),
  CONTACT_FROM_EMAIL: z.string().default("Mass Tech Website <onboarding@resend.dev>"),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  console.error("❌ Invalid environment variables:");
  for (const issue of parsed.error.issues) console.error(`  - ${issue.path.join(".")}: ${issue.message}`);
  process.exit(1);
}

export const env = parsed.data;
export const isProd = env.NODE_ENV === "production";
export const cloudinaryEnabled = Boolean(
  env.CLOUDINARY_CLOUD_NAME && env.CLOUDINARY_API_KEY && env.CLOUDINARY_API_SECRET,
);
