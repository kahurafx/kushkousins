import { test } from "node:test";
import assert from "node:assert/strict";
import { salePriceCents } from "./index.ts";

test("salePriceCents applies discount and rounds to the cent", () => {
  assert.equal(salePriceCents({ priceCents: 450000, discountPercent: null }), 450000);
  assert.equal(salePriceCents({ priceCents: 450000, discountPercent: 20 }), 360000);
  assert.equal(salePriceCents({ priceCents: 99999, discountPercent: 15 }), 84999);
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
