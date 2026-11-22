import { test } from "node:test";
import assert from "node:assert/strict";
import { partingOffset, silhouetteFor, silhouettes, snapIndex, swatch, swingImpulse } from "./garments.ts";

test("swingImpulse pushes the hem the way the hand moves, scaled by speed and clamped", () => {
  assert.equal(swingImpulse(10, 100, 500), -20, "moving right: hem swings right (negative rotate)");
  assert.equal(swingImpulse(10, 100, -500), 20, "moving left wins over entering on the left half");
  assert.equal(swingImpulse(10, 100, 0), -10, "still hand: away from the entry side, gentle nudge");
  assert.equal(swingImpulse(190, 100, 100), 10, "slow hand: entry side decides");
  assert.equal(swingImpulse(10, 100, 1e6), -40, "a flick never spins it");
});

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

test("snapIndex rounds to the nearest slot and clamps to the rack", () => {
  assert.equal(snapIndex(0, 200, 7), 0);
  assert.equal(snapIndex(99, 200, 7), 0);
  assert.equal(snapIndex(101, 200, 7), 1);
  assert.equal(snapIndex(-80, 200, 7), 0); // iOS bounce past the start
  assert.equal(snapIndex(5000, 200, 7), 6); // bounce past the end
  assert.equal(snapIndex(300, 0, 7), 0);
  assert.equal(snapIndex(300, 200, 0), 0);
});
