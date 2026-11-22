// DB-backed: runs only with TEST_DATABASE_URL (a disposable dev DB). Default `pnpm test` stays DB-free.
import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

const url = process.env.TEST_DATABASE_URL;
const skip = !url && "set TEST_DATABASE_URL to run DB tests";
if (url) process.env.DATABASE_URL = url;

const tag = randomUUID().slice(0, 8);
const adminId = `t-${tag}-img-admin`;
const photo = (name: string, color: string | null = null) => ({ url: `https://img.test/${tag}/${name}.webp`, color, label: null });

type Db = typeof import("@repo/db");
let m: { db: Db["db"]; schema: Db["schema"]; eq: Db["eq"]; like: Db["like"]; appRouter: typeof import("./root").appRouter };
const admin = () => m.appRouter.createCaller({ session: { user: { id: adminId, role: "ADMIN" }, session: {} } as never });
const base = { description: null, discountPercent: null, categoryId: null, priceCents: 300000 };
const variants = [{ size: "M", color: "Black", stock: 3 }, { size: "M", color: "White", stock: 3 }];

before(async () => {
  if (skip) return;
  const d = await import("@repo/db");
  m = { db: d.db, schema: d.schema, eq: d.eq, like: d.like, appRouter: (await import("./root")).appRouter };
  await m.db.insert(m.schema.user).values({ id: adminId, name: adminId, email: `${adminId}@example.test`, role: "ADMIN" });
});

after(async () => {
  if (skip) return;
  await m.db.delete(m.schema.products).where(m.like(m.schema.products.slug, `t-${tag}-img-%`));
  await m.db.delete(m.schema.user).where(m.eq(m.schema.user.id, adminId));
  await m.db.$client.end();
});

test("colour-tagged photos: tags are matched to variant colours (canonical spelling); unknown colours are refused", { skip }, async () => {
  const create = (images: ReturnType<typeof photo>[], slug: string) =>
    admin().admin.products.create({ ...base, mode: "NEW", name: "T Tee", slug: `t-${tag}-img-${slug}`, images, variants });

  await assert.rejects(create([photo("red", "Red")], "bad"), { code: "BAD_REQUEST", message: /Red/ });

  const { id } = await create([photo("any"), photo("black", " black")], "ok");
  const saved = await admin().admin.products.byId({ id });
  assert.deepEqual(saved.images.map((i) => i.color), [null, "Black"]);

  // Renaming a colour away from under its photos is refused, not silently orphaned.
  await assert.rejects(
    admin().admin.products.update({
      ...base, id, mode: "NEW", name: "T Tee", slug: `t-${tag}-img-ok`, images: saved.images,
      variants: saved.variants.map((v) => ({ id: v.id, size: v.size, color: v.color === "Black" ? "Charcoal" : v.color, stock: v.stock, expectedStock: v.stock })),
    }),
    { code: "BAD_REQUEST", message: /Black/ },
  );
});

test("1-of-1 pieces can't tag photos by colour", { skip }, async () => {
  await assert.rejects(
    admin().admin.products.create({
      ...base, mode: "UPCYCLED", name: "T Coat", slug: `t-${tag}-img-ooak`, images: [photo("a", "Multi")],
      size: "M", color: "Multi", originalMaterial: "Old kanga", artisanNotes: "Hand pieced",
    }),
    { code: "BAD_REQUEST", message: /single colour/ },
  );
});

test("bag line shows the photo of the colour in the bag", { skip }, async () => {
  const { id } = await admin().admin.products.create({
    ...base, mode: "NEW", name: "T Bag Tee", slug: `t-${tag}-img-bag`, images: [photo("white", "White"), photo("black", "Black")], variants,
  });
  const p = await admin().admin.products.byId({ id });
  const black = p.variants.find((v) => v.color === "Black")!;
  const res = await m.appRouter.createCaller({ session: null }).cart.validate({ items: [{ variantId: black.id, quantity: 1 }] });
  assert.equal(res.lines[0]!.item?.image, photo("black").url);
});
