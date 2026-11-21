import { test } from "node:test";
import assert from "node:assert/strict";
import { partingOffset, silhouetteFor, silhouettes, swatch } from "./garments.ts";

test("partingOffset pushes neighbours away, fading with distance", () => {
  assert.deepEqual([0, 1, 2, 3, 4, 5, 6].map((i) => partingOffset(i, 3)), [-4, -10, -24, 0, 24, 10, 4]);
  assert.equal(partingOffset(9, 3), 0);
  assert.equal(partingOffset(2, null), 0);
});

test("silhouetteFor maps seeded names", () => {
  const cases: [string, keyof typeof silhouettes][] = [
    ["Kousin Heavyweight Hoodie", "hoodie"],
    ["Nairobi Boxy Tee", "tee"],
    ["Pleated Wide Trousers", "trousers"],
    ["Cargo Utility Pants", "trousers"],
    ["Deconstructed Trench", "coat"],
    ["Reworked Denim Chore Coat", "jacket"],
    ["Rework Varsity Vest", "vest"],
    ["Silk Scarf Shirt", "jacket"],
  ];
  for (const [name, want] of cases) assert.equal(silhouetteFor(name), want, name);
});

test("swatch is case-insensitive with a stone fallback", () => {
  assert.equal(swatch("Forest"), "#1C2B21");
  assert.equal(swatch(" red check "), "#9E2B25");
  assert.equal(swatch("Unobtainium"), "#E8E6E1");
});
