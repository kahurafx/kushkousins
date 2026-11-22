// DB-backed: runs only with TEST_DATABASE_URL (a disposable dev DB). Default `pnpm test` stays DB-free.
import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

const url = process.env.TEST_DATABASE_URL;
const skip = !url && "set TEST_DATABASE_URL to run DB tests";
if (url) process.env.DATABASE_URL = url;

const tag = randomUUID().slice(0, 8);

type Db = typeof import("@repo/db");
let m: { db: Db["db"]; schema: Db["schema"]; eq: Db["eq"]; like: Db["like"]; appRouter: typeof import("./root").appRouter };
const ids: Record<string, string> = {};
let categoryId: string;

before(async () => {
  if (skip) return;
  const d = await import("@repo/db");
  m = { db: d.db, schema: d.schema, eq: d.eq, like: d.like, appRouter: (await import("./root")).appRouter };
  const { categories, products } = m.schema;
  const [cat] = await m.db.insert(categories).values({ slug: `t-${tag}-cat`, name: `T ${tag}` }).returning();
  categoryId = cat!.id;
  const row = (key: string, o: Partial<typeof products.$inferInsert>) => ({ slug: `t-${tag}-${key}`, name: `T ${key}`, mode: "NEW" as const, priceCents: 300000, images: [] as string[], ...o });
  const rows = await m.db
    .insert(products)
    .values([
      row("target", { categoryId }),
      row("same-cat-far", { categoryId, priceCents: 900000 }),
      row("same-cat-near", { categoryId, priceCents: 310000 }),
      row("other-cat-exact", { categoryId: null, priceCents: 300000 }),
      row("same-cat-sold", { categoryId, status: "sold" }),
      row("same-cat-archived", { categoryId, status: "archived" }),
    ])
    .returning();
  for (const r of rows) ids[r.slug.replace(`t-${tag}-`, "")] = r.id;
});

after(async () => {
  if (skip) return;
  await m.db.delete(m.schema.products).where(m.like(m.schema.products.slug, `t-${tag}-%`));
  await m.db.delete(m.schema.categories).where(m.eq(m.schema.categories.id, categoryId));
  await m.db.$client.end();
});

test("similar: same category first, then nearest price; never self, sold or archived", { skip }, async () => {
  const out = await m.appRouter.createCaller({ session: null }).product.similar({ productId: ids.target!, limit: 12 });
  // Other tests' fixtures may share the DB: assert only the relative order of ours.
  const mine = out.map((p) => p.id).filter((id) => Object.values(ids).includes(id));
  assert.deepEqual(mine, [ids["same-cat-near"], ids["same-cat-far"], ids["other-cat-exact"]]);
});

test("similar: unknown product gives an empty rail, not an error", { skip }, async () => {
  const out = await m.appRouter.createCaller({ session: null }).product.similar({ productId: randomUUID() });
  assert.deepEqual(out, []);
});
