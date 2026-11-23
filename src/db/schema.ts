import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  date,
  index,
  integer,
  jsonb,
  pgTable,
  serial,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

export type L10n = { en: string; mn: string };
export type L10nLines = { en: string[]; mn: string[] };
export type ImageRef = { url: string; publicId?: string | null; width?: number | null; height?: number | null };

export const CATEGORIES = ["radiation", "medical", "energy"] as const;
export const GROUPS = ["baggage-parcel", "personnel-screening", "explosives-narcotics", "radiation-dosimetry"] as const;
export const MESSAGE_STATUSES = ["new", "read", "archived"] as const;

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
};

export const products = pgTable(
  "products",
  {
    id: serial("id").primaryKey(),
    slug: text("slug").notNull().unique(),
    category: text("category", { enum: CATEGORIES }).notNull(),
    group: text("group_slug", { enum: GROUPS }),
    name: jsonb("name").$type<L10n>().notNull(),
    overview: jsonb("overview").$type<L10nLines>().notNull().default({ en: [], mn: [] }),
    features: jsonb("features").$type<L10nLines>().notNull().default({ en: [], mn: [] }),
    image: jsonb("image").$type<ImageRef | null>(),
    sortOrder: integer("sort_order").notNull().default(0),
    published: boolean("published").notNull().default(true),
    ...timestamps,
  },
  (t) => [
    index("products_category_idx").on(t.category),
    check("products_category_chk", sql`${t.category} in ('radiation','medical','energy')`),
  ],
);

export const projects = pgTable(
  "projects",
  {
    id: serial("id").primaryKey(),
    slug: text("slug").notNull().unique(),
    title: jsonb("title").$type<L10n>().notNull(),
    client: jsonb("client").$type<L10n>().notNull(),
    body: jsonb("body").$type<L10nLines>().notNull().default({ en: [], mn: [] }),
    startDate: date("start_date", { mode: "string" }).notNull(),
    endDate: date("end_date", { mode: "string" }),
    cover: jsonb("cover").$type<ImageRef | null>(),
    images: jsonb("images").$type<ImageRef[]>().notNull().default([]),
    published: boolean("published").notNull().default(true),
    ...timestamps,
  },
  (t) => [index("projects_start_idx").on(t.startDate)],
);

export const messages = pgTable(
  "messages",
  {
    id: serial("id").primaryKey(),
    name: text("name").notNull(),
    phone: text("phone").notNull(),
    email: text("email").notNull(),
    organization: text("organization"),
    product: text("product"),
    message: text("message").notNull(),
    locale: text("locale"),
    status: text("status", { enum: MESSAGE_STATUSES }).notNull().default("new"),
    ip: text("ip"),
    userAgent: text("user_agent"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("messages_status_idx").on(t.status, t.createdAt),
    check("messages_status_chk", sql`${t.status} in ('new','read','archived')`),
  ],
);

export const admins = pgTable("admins", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  name: text("name"),
  passwordHash: text("password_hash").notNull(),
  lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Product = typeof products.$inferSelect;
export type Project = typeof projects.$inferSelect;
export type Message = typeof messages.$inferSelect;
export type Admin = typeof admins.$inferSelect;
