/**
 * Imports the current website content (seed-data/*.json) into the database.
 * Safe to run more than once: existing slugs are skipped.
 *   npm run seed
 */
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { count } from "drizzle-orm";
import { db, pool, runMigrations } from "../src/db/client.js";
import { products, projects, type L10n, type L10nLines } from "../src/db/schema.js";

type SeedProduct = {
  slug: string;
  category: "radiation" | "medical" | "energy";
  group: "baggage-parcel" | "personnel-screening" | "explosives-narcotics" | "radiation-dosimetry" | null;
  name: L10n;
  overview: L10nLines;
  features: L10nLines;
};
type SeedProject = {
  slug: string;
  start: string;
  end: string;
  title: L10n;
  client: L10n;
  body: L10nLines;
  images: string[];
  cover: string | null;
  coverWidth: number;
};

const dir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "seed-data");

async function main() {
  await runMigrations();
  const productData = JSON.parse(await readFile(path.join(dir, "products.json"), "utf8")) as { products: SeedProduct[] };
  const projectData = JSON.parse(await readFile(path.join(dir, "projects.json"), "utf8")) as SeedProject[];

  const p = await db
    .insert(products)
    .values(
      productData.products.map((x, i) => ({
        slug: x.slug,
        category: x.category,
        group: x.group,
        name: x.name,
        overview: x.overview,
        features: x.features,
        sortOrder: (i + 1) * 10,
      })),
    )
    .onConflictDoNothing({ target: products.slug })
    .returning({ id: products.id });

  const j = await db
    .insert(projects)
    .values(
      projectData.map((x) => ({
        slug: x.slug,
        title: x.title,
        client: x.client,
        body: x.body,
        startDate: x.start,
        endDate: x.end,
        // Project photos are served by the website (/images/projects/...) until re-uploaded to Cloudinary
        cover: x.cover ? { url: x.cover, width: x.coverWidth || null } : null,
        images: x.images.map((url) => ({ url })),
      })),
    )
    .onConflictDoNothing({ target: projects.slug })
    .returning({ id: projects.id });

  const [[pc], [jc]] = await Promise.all([
    db.select({ n: count() }).from(products),
    db.select({ n: count() }).from(projects),
  ]);
  console.log(`Inserted ${p.length} products, ${j.length} projects. Totals: ${pc.n} products, ${jc.n} projects.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
