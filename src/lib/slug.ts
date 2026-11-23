import { and, eq, like, ne, or } from "drizzle-orm";
import type { PgColumn, PgTable } from "drizzle-orm/pg-core";
import { db } from "../db/client.js";

export function slugify(input: string, maxWords = 7) {
  return input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ™®]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .split("-")
    .slice(0, maxWords)
    .join("-") || "item";
}

/** Returns `base`, or `base-2`, `base-3`… so the slug is unique in the table. */
export async function uniqueSlug(table: PgTable & { slug: PgColumn; id: PgColumn }, base: string, excludeId?: number) {
  const rows = await db
    .select({ slug: table.slug })
    .from(table)
    .where(
      and(
        or(eq(table.slug, base), like(table.slug, `${base}-%`)),
        excludeId ? ne(table.id, excludeId) : undefined,
      ),
    );
  const taken = new Set(rows.map((r) => r.slug as string));
  if (!taken.has(base)) return base;
  let n = 2;
  while (taken.has(`${base}-${n}`)) n++;
  return `${base}-${n}`;
}
