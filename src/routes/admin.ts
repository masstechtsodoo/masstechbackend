import { Router } from "express";
import { and, asc, count, desc, eq, ilike, or, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "../db/client.js";
import { messages, products, projects } from "../db/schema.js";
import { requireAdmin } from "../lib/auth.js";
import { destroyImages, removedImages, signUpload, UPLOAD_FOLDERS } from "../lib/cloudinary.js";
import { HttpError, notFound, parseId } from "../lib/http.js";
import { slugify, uniqueSlug } from "../lib/slug.js";
import { listQuery, messageStatusInput, productInput, projectInput } from "../lib/validation.js";
import { cloudinaryEnabled, env } from "../env.js";

export const adminRouter = Router();
adminRouter.use(requireAdmin);
adminRouter.use((_req, res, next) => {
  res.set("Cache-Control", "no-store");
  next();
});

/* ---------------------------------------------------------------- stats */

adminRouter.get("/stats", async (_req, res) => {
  const [[p], [j], msgRows] = await Promise.all([
    db.select({ total: count() }).from(products),
    db.select({ total: count() }).from(projects),
    db.select({ status: messages.status, total: count() }).from(messages).groupBy(messages.status),
  ]);
  const byStatus = Object.fromEntries(msgRows.map((r) => [r.status, r.total]));
  res.json({
    products: p.total,
    projects: j.total,
    messages: { new: byStatus.new ?? 0, read: byStatus.read ?? 0, archived: byStatus.archived ?? 0 },
    cloudinary: cloudinaryEnabled,
  });
});

/* ------------------------------------------------------------- products */

adminRouter.get("/products", async (req, res) => {
  const q = listQuery.parse(req.query);
  const term = q.q ? `%${q.q}%` : null;
  const rows = await db
    .select()
    .from(products)
    .where(
      and(
        q.category ? eq(products.category, q.category) : undefined,
        term
          ? or(
              ilike(products.slug, term),
              sql`${products.name}->>'en' ilike ${term}`,
              sql`${products.name}->>'mn' ilike ${term}`,
            )
          : undefined,
      ),
    )
    .orderBy(asc(products.sortOrder), asc(products.id));
  res.json({ items: rows });
});

adminRouter.get("/products/:id", async (req, res) => {
  const [row] = await db.select().from(products).where(eq(products.id, parseId(req.params.id))).limit(1);
  if (!row) throw notFound("product");
  res.json(row);
});

adminRouter.post("/products", async (req, res) => {
  const input = productInput.parse(req.body);
  const slug = await uniqueSlug(products, input.slug || slugify(input.name.en.replace(/^NUCTECH\s+/i, ""), 6));
  const [row] = await db.insert(products).values({ ...input, slug, image: input.image ?? null }).returning();
  res.status(201).json(row);
});

adminRouter.put("/products/:id", async (req, res) => {
  const id = parseId(req.params.id);
  const input = productInput.parse(req.body);
  const [before] = await db.select().from(products).where(eq(products.id, id)).limit(1);
  if (!before) throw notFound("product");
  const slug = input.slug ? await uniqueSlug(products, input.slug, id) : before.slug;
  const [row] = await db
    .update(products)
    .set({ ...input, slug, image: input.image ?? null })
    .where(eq(products.id, id))
    .returning();
  void destroyImages(removedImages([before.image], [row.image]));
  res.json(row);
});

adminRouter.delete("/products/:id", async (req, res) => {
  const [row] = await db.delete(products).where(eq(products.id, parseId(req.params.id))).returning();
  if (!row) throw notFound("product");
  void destroyImages([row.image?.publicId]);
  res.json({ ok: true, slug: row.slug });
});

/* ------------------------------------------------------------- projects */

adminRouter.get("/projects", async (req, res) => {
  const q = listQuery.parse(req.query);
  const term = q.q ? `%${q.q}%` : null;
  const rows = await db
    .select()
    .from(projects)
    .where(
      term
        ? or(
            ilike(projects.slug, term),
            sql`${projects.title}->>'en' ilike ${term}`,
            sql`${projects.title}->>'mn' ilike ${term}`,
          )
        : undefined,
    )
    .orderBy(desc(projects.startDate), desc(projects.id));
  res.json({ items: rows });
});

adminRouter.get("/projects/:id", async (req, res) => {
  const [row] = await db.select().from(projects).where(eq(projects.id, parseId(req.params.id))).limit(1);
  if (!row) throw notFound("project");
  res.json(row);
});

adminRouter.post("/projects", async (req, res) => {
  const input = projectInput.parse(req.body);
  const slug = await uniqueSlug(projects, input.slug || slugify(input.title.en));
  const [row] = await db
    .insert(projects)
    .values({ ...input, slug, endDate: input.endDate ?? null, cover: input.cover ?? null })
    .returning();
  res.status(201).json(row);
});

adminRouter.put("/projects/:id", async (req, res) => {
  const id = parseId(req.params.id);
  const input = projectInput.parse(req.body);
  const [before] = await db.select().from(projects).where(eq(projects.id, id)).limit(1);
  if (!before) throw notFound("project");
  const slug = input.slug ? await uniqueSlug(projects, input.slug, id) : before.slug;
  const [row] = await db
    .update(projects)
    .set({ ...input, slug, endDate: input.endDate ?? null, cover: input.cover ?? null })
    .where(eq(projects.id, id))
    .returning();
  void destroyImages(removedImages([before.cover, ...before.images], [row.cover, ...row.images]));
  res.json(row);
});

adminRouter.delete("/projects/:id", async (req, res) => {
  const [row] = await db.delete(projects).where(eq(projects.id, parseId(req.params.id))).returning();
  if (!row) throw notFound("project");
  void destroyImages([row.cover?.publicId, ...row.images.map((i) => i.publicId)]);
  res.json({ ok: true, slug: row.slug });
});

/* ------------------------------------------------------------- messages */

adminRouter.get("/messages", async (req, res) => {
  const q = listQuery.parse(req.query);
  const where = q.status ? eq(messages.status, q.status) : undefined;
  const [items, [{ total }]] = await Promise.all([
    db.select().from(messages).where(where).orderBy(desc(messages.createdAt)).limit(q.limit).offset(q.offset),
    db.select({ total: count() }).from(messages).where(where),
  ]);
  res.json({ items, total, limit: q.limit, offset: q.offset });
});

adminRouter.patch("/messages/:id", async (req, res) => {
  const { status } = messageStatusInput.parse(req.body);
  const [row] = await db.update(messages).set({ status }).where(eq(messages.id, parseId(req.params.id))).returning();
  if (!row) throw notFound("message");
  res.json(row);
});

adminRouter.delete("/messages/:id", async (req, res) => {
  const [row] = await db.delete(messages).where(eq(messages.id, parseId(req.params.id))).returning();
  if (!row) throw notFound("message");
  res.json({ ok: true });
});

/* -------------------------------------------------------------- uploads */

adminRouter.post("/uploads/sign", (req, res) => {
  const { folder } = z.object({ folder: z.enum(UPLOAD_FOLDERS) }).parse(req.body);
  res.json(signUpload(folder));
});

/** Removes an uploaded image that was never saved (e.g. the editor was cancelled). */
adminRouter.post("/uploads/destroy", async (req, res) => {
  const { publicId } = z.object({ publicId: z.string().min(1).max(300) }).parse(req.body);
  if (!publicId.startsWith(`${env.CLOUDINARY_FOLDER}/`)) throw new HttpError(400, "invalid_public_id");
  await destroyImages([publicId]);
  res.json({ ok: true });
});
