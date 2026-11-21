// DB-backed: runs only with TEST_DATABASE_URL. Daraja is stubbed at fetch; no network.
import { after, before, beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

const url = process.env.TEST_DATABASE_URL;
const skip = !url && "set TEST_DATABASE_URL to run DB tests";
if (url) process.env.DATABASE_URL = url;
Object.assign(process.env, {
  MPESA_CONSUMER_KEY: "key",
  MPESA_CONSUMER_SECRET: "secret",
  MPESA_SHORTCODE: "174379",
  MPESA_PASSKEY: "pass",
  MPESA_CALLBACK_URL: "https://shop.example",
  MPESA_CALLBACK_SECRET: "s3cret",
});
delete process.env.MOCK_PAYMENTS;

const tag = randomUUID().slice(0, 8);
const address = { recipientName: "T", phone: "0712345678", line1: "1 Rd", city: "Nairobi", county: "Nairobi" };
const uid = (n: string) => `t-${tag}-${n}`;
const users = ["a", "b", "c", "d", "e", "f", "g", "admin"].map(uid);

type Db = typeof import("@repo/db");
let m: { db: Db["db"]; schema: Db["schema"]; eq: Db["eq"]; inArray: Db["inArray"]; like: Db["like"]; sql: Db["sql"]; appRouter: typeof import("./root").appRouter; payments: typeof import("./payments") };
const as = (userId: string, role = "CUSTOMER") => m.appRouter.createCaller({ session: { user: { id: userId, role }, session: {} } as never });

// Daraja stub: each push gets a new CheckoutRequestID; queries answer from `queryAnswer`.
let pushes = 0;
let queryAnswer: object = { errorCode: "500.001.1001", errorMessage: "The transaction is being processed" };
let lastCheckout = "";
let ooakVariant = "";
let newVariant = "";

const callback = (checkoutRequestId: string, resultCode: number, extra: { amount?: number; receipt?: string } = {}) =>
  m.payments.handleStkCallback({
    Body: {
      stkCallback: {
        MerchantRequestID: "m",
        CheckoutRequestID: checkoutRequestId,
        ResultCode: resultCode,
        ResultDesc: resultCode === 0 ? "The service request is processed successfully." : "Request cancelled by user",
        ...(resultCode === 0 && {
          CallbackMetadata: { Item: [{ Name: "Amount", Value: extra.amount ?? 1400 }, { Name: "MpesaReceiptNumber", Value: extra.receipt ?? `R${tag}`.toUpperCase().slice(0, 10) }, { Name: "PhoneNumber", Value: 254712345678 }] },
        }),
      },
    },
  });
const orderStatus = async (id: string) => (await m.db.select().from(m.schema.orders).where(m.eq(m.schema.orders.id, id)))[0]!;
const attemptsOf = (orderId: string) => m.db.select().from(m.schema.payments).where(m.eq(m.schema.payments.orderId, orderId)).orderBy(m.schema.payments.createdAt);
/** Move an order's and its attempts' clocks back, as if time passed. */
const age = async (orderId: string, minutes: number) => {
  const ago = m.sql`now() - make_interval(mins => ${minutes})`;
  await m.db.update(m.schema.payments).set({ createdAt: ago }).where(m.eq(m.schema.payments.orderId, orderId));
  await m.db.update(m.schema.orders).set({ createdAt: ago }).where(m.eq(m.schema.orders.id, orderId));
};
const placeNew = (user: string) => as(user).order.create({ items: [{ variantId: newVariant, quantity: 1 }], shippingAddress: address });

before(async () => {
  if (skip) return;
  const d = await import("@repo/db");
  m = { db: d.db, schema: d.schema, eq: d.eq, inArray: d.inArray, like: d.like, sql: d.sql, appRouter: (await import("./root")).appRouter, payments: await import("./payments") };
  await m.db.insert(m.schema.user).values(users.map((id) => ({ id, name: id, email: `${id}@example.test`, role: id.endsWith("admin") ? "ADMIN" : "CUSTOMER" })));
  const [ooak, nw] = await m.db
    .insert(m.schema.products)
    .values([
      { slug: `t-${tag}-ooak`, name: "T 1of1", mode: "UPCYCLED", priceCents: 100000 },
      { slug: `t-${tag}-new`, name: "T New", mode: "NEW", priceCents: 100000 },
    ])
    .returning({ id: m.schema.products.id });
  const [v1, v2] = await m.db
    .insert(m.schema.productVariants)
    .values([
      { productId: ooak!.id, sku: `T-${tag}-OOAK`, size: "M", color: "Multi", stock: 1 },
      { productId: nw!.id, sku: `T-${tag}-NEW`, size: "M", color: "Black", stock: 50 },
    ])
    .returning({ id: m.schema.productVariants.id });
  ooakVariant = v1!.id;
  newVariant = v2!.id;
});

const realFetch = globalThis.fetch;
beforeEach(() => {
  if (skip) return;
  queryAnswer = { errorCode: "500.001.1001", errorMessage: "The transaction is being processed" };
  globalThis.fetch = (async (u: string) => {
    if (u.includes("/oauth/")) return new Response(JSON.stringify({ access_token: "tok", expires_in: 3599 }));
    if (u.includes("/stkpushquery/")) return new Response(JSON.stringify(queryAnswer));
    lastCheckout = `ws_CO_${tag}_${++pushes}`;
    return new Response(JSON.stringify({ ResponseCode: "0", CheckoutRequestID: lastCheckout }));
  }) as typeof fetch;
});

after(async () => {
  globalThis.fetch = realFetch;
  if (skip) return;
  const { orders, user, products } = m.schema;
  await m.db.delete(orders).where(m.inArray(orders.userId, users));
  await m.db.delete(user).where(m.inArray(user.id, users));
  await m.db.delete(products).where(m.like(products.slug, `t-${tag}-%`));
  await m.db.$client.end();
});

test("success: one live prompt, cancel/re-order blocked while it's open, callback pays and marks the 1-of-1 sold", { skip }, async () => {
  const a = as(uid("a"));
  const order = await a.order.create({ items: [{ variantId: ooakVariant, quantity: 1 }], shippingAddress: address });
  assert.equal(order.totalCents, 140000); // KES 1,000 + KES 400 shipping
  assert.equal((await a.order.pay({ orderId: order.id, phone: "0712 345 678" })).status, "pending_payment");
  const checkout = lastCheckout;
  await assert.rejects(a.order.pay({ orderId: order.id, phone: "0712345678" }), { code: "CONFLICT", message: /already on your phone/ });
  await assert.rejects(a.order.cancel({ orderId: order.id }), { code: "CONFLICT", message: /still open/ });
  await assert.rejects(placeNew(uid("a")), { code: "CONFLICT", message: /still open/ });
  assert.equal(pushes > 0 && (await attemptsOf(order.id)).length, 1);

  assert.equal((await callback(checkout, 0)).outcome, "paid");
  assert.equal((await callback(checkout, 0)).outcome, "duplicate"); // Safaricom retry
  const o = await orderStatus(order.id);
  assert.equal(o.status, "paid");
  assert.equal(o.mpesaReceiptNumber, `R${tag}`.toUpperCase().slice(0, 10));
  assert.equal(o.mpesaPhone, "254712345678");
  const [p] = await m.db.select().from(m.schema.products).where(m.like(m.schema.products.slug, `t-${tag}-ooak`));
  assert.equal(p!.status, "sold");
  assert.deepEqual((await a.order.paymentStatus({ orderId: order.id })).payment?.status, "succeeded");
});

test("failure codes leave the order payable; retry works; unknown IDs are ignored", { skip }, async () => {
  const b = as(uid("b"));
  const order = await placeNew(uid("b"));
  for (const code of [1032, 1037, 2001]) {
    await b.order.pay({ orderId: order.id, phone: "0712345678" });
    assert.equal((await callback(lastCheckout, code)).outcome, "failed");
    const s = await b.order.paymentStatus({ orderId: order.id });
    assert.equal(s.status, "pending_payment");
    assert.equal(s.payment?.resultCode, code);
  }
  assert.equal((await attemptsOf(order.id)).length, 3);
  assert.equal((await callback("ws_CO_nope", 0)).outcome, "unknown");
  assert.equal((await m.payments.handleStkCallback({ hello: "world" })).outcome, "invalid");
});

test("amount mismatch never pays the order", { skip }, async () => {
  const c = as(uid("c"));
  const order = await placeNew(uid("c"));
  await c.order.pay({ orderId: order.id, phone: "0712345678" });
  assert.equal((await callback(lastCheckout, 0, { amount: 1, receipt: "QMISMATCH1" })).outcome, "mismatch");
  assert.equal((await orderStatus(order.id)).status, "pending_payment");
});

test("late success for an earlier attempt pays the order; a second success is flagged for refund", { skip }, async () => {
  const d = as(uid("d"));
  const order = await placeNew(uid("d"));
  await d.order.pay({ orderId: order.id, phone: "0712345678" });
  const first = lastCheckout;
  await age(order.id, 3); // the first prompt expired on the phone without a callback
  await d.order.pay({ orderId: order.id, phone: "0712345678" }); // query says still processing → past the window, new prompt
  const second = lastCheckout;
  assert.notEqual(first, second);
  assert.equal((await callback(first, 0, { receipt: "QLATE00001" })).outcome, "paid");
  assert.equal((await callback(second, 0, { receipt: "QLATE00002" })).outcome, "needs_refund");
  assert.equal((await orderStatus(order.id)).mpesaReceiptNumber, "QLATE00001");
  const refunds = await as(uid("admin"), "ADMIN").admin.orders.refunds();
  assert.ok(refunds.some((r) => r.receipt === "QLATE00002" && r.orderStatus === "paid"));
});

test("lost callback: STK Query settles it, and the late callback fills in the receipt", { skip }, async () => {
  const e = as(uid("e"));
  const order = await placeNew(uid("e"));
  await e.order.pay({ orderId: order.id, phone: "0712345678" });
  const checkout = lastCheckout;
  assert.equal((await e.order.paymentStatus({ orderId: order.id })).status, "pending_payment"); // too soon to query
  await m.db.update(m.schema.payments).set({ createdAt: m.sql`now() - interval '30 seconds'` }).where(m.eq(m.schema.payments.orderId, order.id));
  queryAnswer = { ResponseCode: "0", ResultCode: "0", ResultDesc: "The service request is processed successfully." };
  assert.equal((await e.order.paymentStatus({ orderId: order.id })).status, "paid");
  assert.equal((await orderStatus(order.id)).mpesaReceiptNumber, null);
  assert.equal((await callback(checkout, 0, { receipt: "QQUERY0001" })).outcome, "duplicate");
  assert.equal((await orderStatus(order.id)).mpesaReceiptNumber, "QQUERY0001");
});

test("expiry: sweep releases only expired, settled reservations; money after release is flagged, then refunded", { skip }, async () => {
  const f = as(uid("f"));
  const admin = as(uid("admin"), "ADMIN");
  const fresh = await placeNew(uid("g"));
  const order = await placeNew(uid("f"));
  await f.order.pay({ orderId: order.id, phone: "0712345678" });
  const checkout = lastCheckout;
  await age(order.id, 30);

  const stockBefore = (await m.db.select().from(m.schema.productVariants).where(m.eq(m.schema.productVariants.id, newVariant)))[0]!.stock;
  // Lazy sweep (at order.create) won't touch it: an unanswered attempt might be a paid one.
  await placeNew(uid("g"));
  assert.equal((await orderStatus(order.id)).status, "pending_payment");
  // The scheduled sweep asks Safaricom first (still processing per the stub), then releases it.
  const { released } = await m.payments.sweepReservations();
  assert.ok(released >= 1);
  assert.equal((await orderStatus(order.id)).status, "cancelled");
  assert.equal((await orderStatus(fresh.id)).status, "cancelled"); // g's first order: replaced by g's second, not by the sweep
  assert.equal((await m.db.select().from(m.schema.productVariants).where(m.eq(m.schema.productVariants.id, newVariant)))[0]!.stock, stockBefore + 1 - 0);

  assert.equal((await callback(checkout, 0, { receipt: "QAFTER0001" })).outcome, "needs_refund");
  assert.equal((await orderStatus(order.id)).status, "cancelled");
  const due = (await admin.admin.orders.refunds()).find((r) => r.receipt === "QAFTER0001")!;
  assert.equal(due.orderStatus, "cancelled");
  assert.ok((await admin.admin.overview()).refundsDue >= 1);
  await admin.admin.orders.markRefunded({ paymentId: due.id });
  assert.equal((await admin.admin.orders.refunds()).some((r) => r.id === due.id), false);
  await assert.rejects(admin.admin.orders.markRefunded({ paymentId: due.id }), { code: "CONFLICT" });
  await assert.rejects(f.admin.orders.refunds(), { code: "FORBIDDEN" });
});
