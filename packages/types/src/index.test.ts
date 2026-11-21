import { test } from "node:test";
import assert from "node:assert/strict";
import { salePriceCents } from "./index.ts";

test("salePriceCents applies discount and rounds to whole shillings", () => {
  assert.equal(salePriceCents({ priceCents: 450000, discountPercent: null }), 450000);
  assert.equal(salePriceCents({ priceCents: 450000, discountPercent: 20 }), 360000);
  assert.equal(salePriceCents({ priceCents: 99999, discountPercent: 15 }), 85000);
});

import { KenyanPhoneSchema, shippingCents, toMsisdn } from "./index.ts";

test("KenyanPhoneSchema accepts local and international forms", () => {
  for (const ok of ["0712345678", "0712 345 678", "+254712345678", "254112345678", "0112345678"]) {
    assert.ok(KenyanPhoneSchema.safeParse(ok).success, ok);
  }
  for (const bad of ["712345678", "0812345678", "+255712345678", "07123456789", ""]) {
    assert.ok(!KenyanPhoneSchema.safeParse(bad).success, bad);
  }
});

test("toMsisdn normalises to 2547XXXXXXXX", () => {
  assert.equal(toMsisdn("0712 345 678"), "254712345678");
  assert.equal(toMsisdn("+254712345678"), "254712345678");
  assert.equal(toMsisdn("254112345678"), "254112345678");
});

test("shippingCents: flat fee, free from KES 10,000, none for empty bag", () => {
  assert.equal(shippingCents(0), 0);
  assert.equal(shippingCents(250000), 40000);
  assert.equal(shippingCents(999999), 40000);
  assert.equal(shippingCents(1000000), 0);
});

import { compareSizes } from "./index.ts";

test("compareSizes orders garment sizes, unknowns last", () => {
  assert.deepEqual(["L", "XS", "M", "One", "XL", "S", "32", "28"].sort(compareSizes), ["XS", "S", "M", "L", "XL", "28", "32", "One"]);
});

import { AdminProductCreateSchema, canTransition, MpesaReceiptSchema, orderTransitions, slugify, AdminProductUpdateSchema } from "./index.ts";

test("order transitions: forward pipeline only, finals are final", () => {
  const ok: [string, string][] = [["pending_payment", "paid"], ["pending_payment", "cancelled"], ["paid", "processing"], ["processing", "shipped"], ["shipped", "delivered"]];
  for (const [from, to] of ok) assert.ok(canTransition(from as never, to as never), `${from}→${to}`);
  const bad: [string, string][] = [["paid", "cancelled"], ["pending_payment", "shipped"], ["shipped", "processing"], ["delivered", "cancelled"], ["cancelled", "paid"], ["paid", "paid"]];
  for (const [from, to] of bad) assert.ok(!canTransition(from as never, to as never), `${from}→${to}`);
  assert.deepEqual(orderTransitions.delivered, []);
  assert.deepEqual(orderTransitions.cancelled, []);
});

test("slugify and receipt validation", () => {
  assert.equal(slugify("  Café Kitenge — Bomber!! "), "cafe-kitenge-bomber");
  assert.equal(MpesaReceiptSchema.parse(" qk4xyz12ab "), "QK4XYZ12AB");
  assert.ok(!MpesaReceiptSchema.safeParse("QK4XYZ12A").success);
});

test("admin product update rejects http images and bad slugs", () => {
  const base = { id: "00000000-0000-4000-8000-000000000000", mode: "UPCYCLED", name: "Test", description: null, priceCents: 100, discountPercent: null, categoryId: null, size: "M", color: "Red", originalMaterial: "Old coat", artisanNotes: "Hand stitched" };
  assert.ok(AdminProductUpdateSchema.safeParse({ ...base, slug: "ok-slug", images: ["https://x.test/a.jpg"] }).success);
  assert.ok(!AdminProductUpdateSchema.safeParse({ ...base, slug: "ok-slug", images: ["http://x.test/a.jpg"] }).success);
  assert.ok(!AdminProductUpdateSchema.safeParse({ ...base, slug: "Bad Slug", images: [] }).success);
});

test("admin product schemas reject duplicate size + colour rows (trimmed, any case)", () => {
  const base = { mode: "NEW", name: "Tee", slug: "tee", description: null, priceCents: 100, discountPercent: null, categoryId: null, images: [] };
  assert.ok(AdminProductCreateSchema.safeParse({ ...base, variants: [{ size: "M", color: "Black", stock: 1 }, { size: "L", color: "Black", stock: 1 }] }).success);
  assert.ok(!AdminProductCreateSchema.safeParse({ ...base, variants: [{ size: "M", color: "Black", stock: 1 }, { size: " m ", color: "black", stock: 2 }] }).success);
  assert.ok(!AdminProductUpdateSchema.safeParse({ ...base, id: "00000000-0000-4000-8000-000000000000", variants: [{ size: "M", color: "Black", stock: 1 }, { size: "M", color: "BLACK", stock: 1 }] }).success);
});

import { parseStkCallback, StkCallbackSchema } from "./index.ts";

test("parseStkCallback reads success metadata and tolerates failures without it", () => {
  const ok = StkCallbackSchema.parse({
    Body: { stkCallback: { MerchantRequestID: "m", CheckoutRequestID: "ws_CO_1", ResultCode: 0, ResultDesc: "ok",
      CallbackMetadata: { Item: [{ Name: "Amount", Value: 5400 }, { Name: "MpesaReceiptNumber", Value: "QK4XYZ12AB" }, { Name: "Balance" }, { Name: "PhoneNumber", Value: 254712345678 }] } } },
  });
  assert.deepEqual(parseStkCallback(ok), { checkoutRequestId: "ws_CO_1", resultCode: 0, resultDesc: "ok", amountKes: 5400, receipt: "QK4XYZ12AB", phone: "254712345678" });
  const cancelled = StkCallbackSchema.parse({ Body: { stkCallback: { MerchantRequestID: "m", CheckoutRequestID: "ws_CO_2", ResultCode: "1032", ResultDesc: "Request cancelled by user" } } });
  assert.equal(parseStkCallback(cancelled).resultCode, 1032);
  assert.equal(parseStkCallback(cancelled).amountKes, undefined);
});
