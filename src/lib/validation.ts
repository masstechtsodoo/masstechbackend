import { z } from "zod";
import { CATEGORIES, GROUPS, MESSAGE_STATUSES } from "../db/schema.js";

const text = (max: number) => z.string().trim().max(max);

export const l10n = z.object({ en: text(300).min(1), mn: text(300).min(1) });

/** Arrays of paragraphs / bullet lines; blank lines are dropped */
const lineList = z.array(text(4000)).max(300).transform((a) => a.filter(Boolean));
export const l10nLines = z.object({ en: lineList, mn: lineList });

// Cloudinary https URL, or a site-relative path for images bundled with the website
const imageUrl = z
  .string()
  .trim()
  .max(1000)
  .refine((v) => v.startsWith("https://") || v.startsWith("/"), "must be an https URL or a /path");

export const imageRef = z.object({
  url: imageUrl,
  publicId: z.string().max(300).nullish(),
  width: z.number().int().positive().nullish(),
  height: z.number().int().positive().nullish(),
});

const slug = z
  .string()
  .trim()
  .toLowerCase()
  .max(120)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "lowercase letters, numbers and dashes only");

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "YYYY-MM-DD");

export const productInput = z
  .object({
    slug: slug.optional(),
    category: z.enum(CATEGORIES),
    group: z.enum(GROUPS).nullish(),
    name: l10n,
    overview: l10nLines.default({ en: [], mn: [] }),
    features: l10nLines.default({ en: [], mn: [] }),
    image: imageRef.nullish(),
    sortOrder: z.number().int().min(0).max(100000).default(0),
    published: z.boolean().default(true),
  })
  .transform((p) => ({ ...p, group: p.category === "radiation" ? (p.group ?? null) : null }));

export const projectInput = z
  .object({
    slug: slug.optional(),
    title: l10n,
    client: z.object({ en: text(300), mn: text(300) }),
    body: l10nLines.default({ en: [], mn: [] }),
    startDate: isoDate,
    endDate: isoDate.nullish(),
    cover: imageRef.nullish(),
    images: z.array(imageRef).max(60).default([]),
    published: z.boolean().default(true),
  })
  .refine((p) => !p.endDate || p.endDate >= p.startDate, { path: ["endDate"], message: "must be after startDate" });

export const contactInput = z.object({
  name: text(120).min(1),
  phone: text(40).min(4),
  email: z.email().max(160),
  organization: text(160).optional().default(""),
  message: text(5000).min(1),
  product: text(200).optional().default(""),
  locale: z.enum(["mn", "en"]).optional(),
  website: z.string().optional(), // honeypot
});

export const loginInput = z.object({ email: z.email(), password: z.string().min(1).max(200) });

export const changePasswordInput = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(10, "at least 10 characters").max(200),
});

export const messageStatusInput = z.object({ status: z.enum(MESSAGE_STATUSES) });

export const listQuery = z.object({
  q: z.string().trim().max(100).optional(),
  category: z.enum(CATEGORIES).optional(),
  group: z.enum(GROUPS).optional(),
  status: z.enum(MESSAGE_STATUSES).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});
