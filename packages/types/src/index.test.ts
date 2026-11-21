import { test } from "node:test";
import assert from "node:assert/strict";
import { salePriceCents } from "./index.ts";

test("salePriceCents applies discount and rounds to the cent", () => {
  assert.equal(salePriceCents({ priceCents: 450000, discountPercent: null }), 450000);
  assert.equal(salePriceCents({ priceCents: 450000, discountPercent: 20 }), 360000);
  assert.equal(salePriceCents({ priceCents: 99999, discountPercent: 15 }), 84999);
});
