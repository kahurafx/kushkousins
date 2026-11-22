// DB-backed: runs only with TEST_DATABASE_URL (a disposable dev DB). Default `pnpm test` stays DB-free.
import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

const url = process.env.TEST_DATABASE_URL;
const skip = !url && "set TEST_DATABASE_URL to run DB tests";
if (url) process.env.DATABASE_URL = url;

const tag = randomUUID().slice(0, 8);
const address = { recipientName: "T", phone: "0712345678", line1: "1 Rd", city: "Nairobi", county: "Nairobi" };
const ids = { admin: `t-${tag}-admin`, c1: `t-${tag}-c1`, c2: `t-${tag}-c2`, c3: `t-${tag}-c3`, c4: `t-${tag}-c4` };

type Db = typeof import("@repo/db");
let m: { db: Db["db"]; schema: Db["schema"]; eq: Db["eq"]; inArray: Db["inArray"]; like: Db["like"]; sql: Db["sql"]; appRouter: typeof import("./root").appRouter };
const as = (userId: string, role = "CUSTOMER") => m.appRouter.createCaller({ session: { user: { id: userId, role }, session: {} } as never });
const admin = () => as(ids.admin, "ADMIN");
const stock = async (variantId: string) =>
  (await m.db.select().from(m.schema.productVariants).where(m.eq(m.schema.productVariants.id, variantId)))[0]!.stock;
const status = async (orderId: string) => (await m.db.select().from(m.schema.orders).where(m.eq(m.schema.orders.id, orderId)))[0]!.status;
const place = (userId: string, variantId: string, quantity = 1) => as(userId).order.create({ items: [{ variantId, quantity }], shippingAddress: address });

let newProduct: { id: string; variantId: string };
let ooak: { id: string; variantId: string };

before(async () => {
  if (skip) return;
  const d = await import("@repo/db");
  m = { db: d.db, schema: d.schema, eq: d.eq, inArray: d.inArray, like: d.like, sql: d.sql, appRouter: (await import("./root")).appRouter };
  await m.db.insert(m.schema.user).values(Object.values(ids).map((id) => ({ id, name: id, email: `${id}@example.test`, role: id.endsWith("admin") ? "ADMIN" : "CUSTOMER" })));
  const base = { description: null, discountPercent: null, categoryId: null, images: [] };
  const n = await admin().admin.products.create({ ...base, mode: "NEW", name: "T New", slug: `t-${tag}-new`, priceCents: 300000, variants: [{ size: "M", color: "Black", stock: 5 }, { size: "L", color: "Black", stock: 2 }] });
  const u = await admin().admin.products.create({ ...base, mode: "UPCYCLED", name: "T 1of1", slug: `t-${tag}-ooak`, priceCents: 900000, size: "M", color: "Multi", originalMaterial: "Old kanga", artisanNotes: "Hand pieced" });
  const vid = async (productId: string, size = "M") =>
    (await m.db.select().from(m.schema.productVariants).where(m.eq(m.schema.productVariants.productId, productId))).find((v) => v.size === size)!.id;
  newProduct = { id: n.id, variantId: await vid(n.id) };
  ooak = { id: u.id, variantId: await vid(u.id) };
});

after(async () => {
  if (skip) return;
  const { orders, user, products } = m.schema;
  await m.db.delete(orders).where(m.inArray(orders.userId, Object.values(ids)));
  await m.db.delete(user).where(m.inArray(user.id, Object.values(ids)));
  await m.db.delete(products).where(m.like(products.slug, `t-${tag}-%`));
  await m.db.$client.end();
});

test("admin routes are admin-only", { skip }, async () => {
  await assert.rejects(as(ids.c1).admin.orders.list({}), { code: "FORBIDDEN" });
  await assert.rejects(as(ids.c1).admin.products.setStatus({ id: newProduct.id, status: "archived" }), { code: "FORBIDDEN" });
});

test("SKUs use the full slug; duplicate slug is a friendly CONFLICT", { skip }, async () => {
  const [v] = await m.db.select().from(m.schema.productVariants).where(m.eq(m.schema.productVariants.id, newProduct.variantId));
  assert.equal(v!.sku, `T-${tag.toUpperCase()}-NEW-M-BLACK`);
  await assert.rejects(
    admin().admin.products.create({ mode: "NEW", name: "Dup", slug: `t-${tag}-new`, description: null, priceCents: 100, discountPercent: null, categoryId: null, images: [], variants: [{ size: "S", color: "X", stock: 1 }] }),
    { code: "CONFLICT", message: /slug/ },
  );
});

test("stock edits are compare-and-set: a reservation made mid-edit is never overwritten", { skip }, async () => {
  const loaded = await admin().admin.products.byId({ id: newProduct.id });
  const vm = loaded.variants.find((v) => v.id === newProduct.variantId)!;
  await place(ids.c1, newProduct.variantId, 2); // shopper reserves while the form is open: 5 → 3
  const save = (expectedStock: number, stockValue: number) =>
    admin().admin.products.update({
      id: newProduct.id, mode: "NEW", name: "T New", slug: `t-${tag}-new`, description: null, priceCents: 300000, discountPercent: null, categoryId: null, images: [],
      variants: loaded.variants.map((v) => ({ id: v.id, size: v.size, color: v.color, stock: v.id === vm.id ? stockValue : v.stock, expectedStock: v.id === vm.id ? expectedStock : v.stock })),
    });
  await assert.rejects(save(vm.stock, 8), { code: "CONFLICT", message: /changed while you were editing/ });
  assert.equal(await stock(newProduct.variantId), 3);
  await save(3, 8);
  assert.equal(await stock(newProduct.variantId), 8);
});

test("a variant held by an unpaid order can't be deleted", { skip }, async () => {
  const p = await admin().admin.products.byId({ id: newProduct.id });
  await assert.rejects(
    admin().admin.products.update({
      id: newProduct.id, mode: "NEW", name: "T New", slug: `t-${tag}-new`, description: null, priceCents: 300000, discountPercent: null, categoryId: null, images: [],
      variants: p.variants.filter((v) => v.id !== newProduct.variantId).map((v) => ({ id: v.id, size: v.size, color: v.color, stock: v.stock, expectedStock: v.stock })),
    }),
    { code: "CONFLICT", message: /reserved/ },
  );
});

test("order pipeline: illegal and stale moves refused; manual M-Pesa payment; full fulfilment", { skip }, async () => {
  const order = (await m.db.select().from(m.schema.orders).where(m.eq(m.schema.orders.userId, ids.c1)))[0]!;
  const a = admin().admin.orders;
  await assert.rejects(a.setStatus({ id: order.id, from: "pending_payment", to: "shipped" }), { code: "BAD_REQUEST" });
  await assert.rejects(a.setStatus({ id: order.id, from: "paid", to: "processing" }), { code: "CONFLICT" }); // stale screen
  await assert.rejects(a.markPaid({ id: order.id, receipt: "short" }), { code: "BAD_REQUEST" });
  await a.markPaid({ id: order.id, receipt: "qk4xyz12ab" });
  assert.equal(await status(order.id), "paid");
  await assert.rejects(a.markPaid({ id: order.id, receipt: "QK4XYZ12AC" }), { code: "CONFLICT", message: /already paid/ });
  await assert.rejects(a.setStatus({ id: order.id, from: "paid", to: "cancelled" }), { code: "BAD_REQUEST" }); // refunds out of scope

  const other = await place(ids.c2, newProduct.variantId, 1);
  await assert.rejects(a.markPaid({ id: other.id, receipt: "QK4XYZ12AB" }), { code: "CONFLICT", message: /receipt is already recorded/ });

  for (const [from, to] of [["paid", "processing"], ["processing", "shipped"], ["shipped", "delivered"]] as const) {
    await a.setStatus({ id: order.id, from, to });
  }
  assert.equal(await status(order.id), "delivered");
  const listed = await a.list({ q: "QK4XYZ12AB" });
  assert.deepEqual(listed.map((o) => o.id), [order.id]);
  const byRef = await a.list({ q: `#${order.id.slice(0, 8).toUpperCase()}` }); // as shown in the UI
  assert.deepEqual(byRef.map((o) => o.id), [order.id]);

  // Cancel releases stock; paying a cancelled order is refused with a clear message.
  const before = await stock(newProduct.variantId);
  await a.setStatus({ id: other.id, from: "pending_payment", to: "cancelled" });
  assert.equal(await stock(newProduct.variantId), before + 1);
  await assert.rejects(a.markPaid({ id: other.id, receipt: "QK4XYZ12AD" }), { code: "CONFLICT", message: /released/ });
});

test("1-of-1: can't be made available while reserved; sold/available toggles stock", { skip }, async () => {
  const p = admin().admin.products;
  await place(ids.c3, ooak.variantId); // reserved: stock 0
  await p.setStatus({ id: ooak.id, status: "sold" });
  await assert.rejects(p.setStatus({ id: ooak.id, status: "active" }), { code: "CONFLICT", message: /reserved/ });
  const [held] = await m.db.select().from(m.schema.orders).where(m.eq(m.schema.orders.userId, ids.c3));
  await as(ids.c3).order.cancel({ orderId: held!.id });
  await p.setStatus({ id: ooak.id, status: "active" });
  assert.equal(await stock(ooak.variantId), 1);
  await assert.rejects(p.setStatus({ id: newProduct.id, status: "sold" }), { code: "BAD_REQUEST" });
});

test("stale release frees old reservations and leaves fresh ones", { skip }, async () => {
  const old = await place(ids.c3, newProduct.variantId, 1);
  const fresh = await place(ids.c4, newProduct.variantId, 1);
  const before = await stock(newProduct.variantId);
  await m.db.update(m.schema.orders).set({ createdAt: m.sql`now() - interval '3 hours'` }).where(m.eq(m.schema.orders.id, old.id));
  // Another test file's order.create may lazily release it first; either way it ends released exactly once.
  await admin().admin.releaseStale({ olderThanMinutes: 60 });
  // SKIP LOCKED: if a concurrent sweep holds the row, it is the one committing the release.
  for (let i = 0; i < 20 && (await status(old.id)) !== "cancelled"; i++) await new Promise((r) => setTimeout(r, 50));
  assert.equal(await status(old.id), "cancelled");
  assert.equal(await status(fresh.id), "pending_payment");
  assert.equal(await stock(newProduct.variantId), before + 1);
});

test("curation refuses archived products and orders the rack", { skip }, async () => {
  const c = admin().admin.curation;
  const snapshot = await c.get();
  try {
    await admin().admin.products.setStatus({ id: newProduct.id, status: "archived" });
    await assert.rejects(c.setHangingLine({ ids: [newProduct.id] }), { code: "BAD_REQUEST" });
    await admin().admin.products.setStatus({ id: newProduct.id, status: "active" });
    await c.setHangingLine({ ids: [ooak.id, newProduct.id] });
    const now = await c.get();
    assert.deepEqual(now.hangingLine, [ooak.id, newProduct.id]);
  } finally {
    await c.setHangingLine({ ids: snapshot.hangingLine }); // restore the dev catalogue
  }
});
