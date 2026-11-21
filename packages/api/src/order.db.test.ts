// DB-backed: runs only with TEST_DATABASE_URL (a disposable dev DB). Default `pnpm test` stays DB-free.
import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

const url = process.env.TEST_DATABASE_URL;
const skip = !url && "set TEST_DATABASE_URL to run DB tests";
if (url) process.env.DATABASE_URL = url; // must precede the @repo/db import below

const address = { recipientName: "Test", phone: "0712345678", line1: "1 Test Rd", city: "Nairobi", county: "Nairobi" };
const tag = randomUUID().slice(0, 8);

// Loaded lazily so the module (and its Pool) only exists when the test runs.
let mod: {
  db: typeof import("@repo/db").db;
  schema: typeof import("@repo/db").schema;
  eq: typeof import("@repo/db").eq;
  inArray: typeof import("@repo/db").inArray;
  appRouter: typeof import("./root").appRouter;
};
const users = [`t-${tag}-a`, `t-${tag}-b`];
let oneOfOneVariant = "";
let newVariant = "";
const productIds: string[] = [];

const caller = (userId: string) =>
  mod.appRouter.createCaller({ session: { user: { id: userId, role: "CUSTOMER" }, session: {} } as never });
const stockOf = async (variantId: string) =>
  (await mod.db.select().from(mod.schema.productVariants).where(mod.eq(mod.schema.productVariants.id, variantId)))[0]!.stock;

before(async () => {
  if (skip) return;
  const dbm = await import("@repo/db");
  mod = { db: dbm.db, schema: dbm.schema, eq: dbm.eq, inArray: dbm.inArray, appRouter: (await import("./root")).appRouter };
  const { user, products, productVariants } = mod.schema;
  await mod.db.insert(user).values(users.map((id) => ({ id, name: id, email: `${id}@example.test`, role: "CUSTOMER" })));
  const [a, b] = await mod.db
    .insert(products)
    .values([
      { slug: `t-${tag}-ooak`, name: "Test 1-of-1", mode: "UPCYCLED", priceCents: 500000 },
      { slug: `t-${tag}-new`, name: "Test New", mode: "NEW", priceCents: 200000, discountPercent: 15 },
    ])
    .returning({ id: products.id });
  productIds.push(a!.id, b!.id);
  const [v1, v2] = await mod.db
    .insert(productVariants)
    .values([
      { productId: a!.id, sku: `T-${tag}-OOAK`, size: "M", color: "Multi", stock: 1 },
      { productId: b!.id, sku: `T-${tag}-NEW`, size: "M", color: "Black", stock: 5 },
    ])
    .returning({ id: productVariants.id });
  oneOfOneVariant = v1!.id;
  newVariant = v2!.id;
});

after(async () => {
  if (skip) return;
  const { orders, user, products } = mod.schema;
  await mod.db.delete(orders).where(mod.inArray(orders.userId, users));
  await mod.db.delete(user).where(mod.inArray(user.id, users));
  await mod.db.delete(products).where(mod.inArray(products.id, productIds));
  await mod.db.$client.end();
});

test("two buyers racing for a 1-of-1: exactly one wins", { skip }, async () => {
  const results = await Promise.allSettled(
    users.map((u) => caller(u).order.create({ items: [{ variantId: oneOfOneVariant, quantity: 1 }], shippingAddress: address })),
  );
  const ok = results.filter((r) => r.status === "fulfilled");
  const failed = results.filter((r): r is PromiseRejectedResult => r.status === "rejected");
  assert.equal(ok.length, 1);
  assert.equal(failed.length, 1);
  assert.equal(failed[0]!.reason.code, "CONFLICT");
  assert.equal(await stockOf(oneOfOneVariant), 0);
});

test("prices come from the server, and a new order releases the user's previous reservation", { skip }, async () => {
  const b = caller(users[1]!);
  const first = await b.order.create({ items: [{ variantId: newVariant, quantity: 1 }, { variantId: newVariant, quantity: 1 }], shippingAddress: address });
  assert.equal(await stockOf(newVariant), 3); // duplicate lines merged: 2 reserved
  assert.equal(first.totalCents, 2 * 170000 + 40000); // 15% off KES 2,000 ×2 + KES 400 shipping
  await b.order.create({ items: [{ variantId: newVariant, quantity: 1 }], shippingAddress: address });
  assert.equal(await stockOf(newVariant), 4); // first released (+2), second reserved (−1)
  const old = await mod.db.select().from(mod.schema.orders).where(mod.eq(mod.schema.orders.id, first.id));
  assert.equal(old[0]!.status, "cancelled");
});

test("pay fails closed without M-Pesa config; MOCK_PAYMENTS=true marks the 1-of-1 sold", { skip }, async () => {
  const { orders, products } = mod.schema;
  // The user still holding the 1-of-1 (KES 5,000 + shipping) reservation.
  const winner = (await mod.db.select().from(orders).where(mod.inArray(orders.userId, users))).find((o) => o.status === "pending_payment" && o.totalCents === 500000 + 40000);
  const pay = () => caller(winner!.userId).order.pay({ orderId: winner!.id, phone: "0712 345 678" });
  delete process.env.MOCK_PAYMENTS;
  delete process.env.MPESA_CONSUMER_KEY;
  await assert.rejects(pay(), { code: "PRECONDITION_FAILED" });
  process.env.MOCK_PAYMENTS = "true";
  try {
    const target = winner!;
    const paid = await caller(winner!.userId).order.pay({ orderId: target.id, phone: "0712 345 678" });
    assert.equal(paid.status, "paid");
    assert.equal((await caller(winner!.userId).order.pay({ orderId: target.id, phone: "0712345678" })).status, "paid"); // idempotent
    const [p] = await mod.db.select().from(products).where(mod.eq(products.id, productIds[0]!));
    assert.equal(p!.status, "sold");
    await assert.rejects(caller(users.find((u) => u !== winner!.userId)!).order.pay({ orderId: target.id, phone: "0712345678" }), { code: "NOT_FOUND" });
  } finally {
    delete process.env.MOCK_PAYMENTS;
  }
});
