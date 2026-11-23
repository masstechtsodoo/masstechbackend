import { Router } from "express";
import rateLimit from "express-rate-limit";
import { and, asc, desc, eq } from "drizzle-orm";
import { db } from "../db/client.js";
import { CATEGORIES, GROUPS, messages, products, projects, type Product, type Project } from "../db/schema.js";
import { notFound } from "../lib/http.js";
import { notifyNewMessage } from "../lib/mailer.js";
import { contactInput, listQuery } from "../lib/validation.js";

export const publicRouter = Router();

// Short CDN/browser caching for public reads; the website also caches with ISR.
publicRouter.use((req, res, next) => {
  if (req.method === "GET") res.set("Cache-Control", "public, max-age=60, stale-while-revalidate=300");
  next();
});

export const toPublicProduct = (p: Product) => ({
  id: p.id,
  slug: p.slug,
  category: p.category,
  group: p.group,
  name: p.name,
  overview: p.overview,
  features: p.features,
  image: p.image,
  sortOrder: p.sortOrder,
  updatedAt: p.updatedAt,
});

export const toPublicProject = (p: Project) => ({
  id: p.id,
  slug: p.slug,
  title: p.title,
  client: p.client,
  body: p.body,
  startDate: p.startDate,
  endDate: p.endDate,
  cover: p.cover,
  images: p.images,
  updatedAt: p.updatedAt,
});

publicRouter.get("/meta", (_req, res) => {
  res.json({ categories: CATEGORIES, groups: GROUPS });
});

publicRouter.get("/products", async (req, res) => {
  const q = listQuery.pick({ category: true, group: true }).parse(req.query);
  const rows = await db
    .select()
    .from(products)
    .where(
      and(
        eq(products.published, true),
        q.category ? eq(products.category, q.category) : undefined,
        q.group ? eq(products.group, q.group) : undefined,
      ),
    )
    .orderBy(asc(products.sortOrder), asc(products.id));
  res.json({ items: rows.map(toPublicProduct) });
});

publicRouter.get("/products/:slug", async (req, res) => {
  const [row] = await db
    .select()
    .from(products)
    .where(and(eq(products.slug, req.params.slug), eq(products.published, true)))
    .limit(1);
  if (!row) throw notFound("product");
  res.json(toPublicProduct(row));
});

publicRouter.get("/projects", async (_req, res) => {
  const rows = await db
    .select()
    .from(projects)
    .where(eq(projects.published, true))
    .orderBy(desc(projects.startDate), desc(projects.id));
  res.json({ items: rows.map(toPublicProject) });
});

publicRouter.get("/projects/:slug", async (req, res) => {
  const [row] = await db
    .select()
    .from(projects)
    .where(and(eq(projects.slug, req.params.slug), eq(projects.published, true)))
    .limit(1);
  if (!row) throw notFound("project");
  res.json(toPublicProject(row));
});

const contactLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 5,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { error: "too_many_requests" },
});

publicRouter.post("/contact", contactLimiter, async (req, res) => {
  const input = contactInput.parse(req.body);
  // Honeypot: pretend success for bots
  if (input.website) {
    res.status(201).json({ ok: true });
    return;
  }
  // The website forwards the visitor's IP in X-Forwarded-For / X-Client-IP
  const ip = (req.get("x-client-ip") || req.ip || "").slice(0, 64) || null;
  const [saved] = await db
    .insert(messages)
    .values({
      name: input.name,
      phone: input.phone,
      email: input.email,
      organization: input.organization || null,
      product: input.product || null,
      message: input.message,
      locale: input.locale ?? null,
      ip,
      userAgent: (req.get("x-client-ua") || req.get("user-agent") || "").slice(0, 300) || null,
    })
    .returning();
  // Do not make the visitor wait for the e-mail
  void notifyNewMessage(saved);
  res.status(201).json({ ok: true, id: saved.id });
});
