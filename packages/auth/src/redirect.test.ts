import { test } from "node:test";
import assert from "node:assert/strict";
import { safeNextPath } from "./redirect.ts";

test("safeNextPath keeps same-origin paths", () => {
  assert.equal(safeNextPath("/checkout"), "/checkout");
  assert.equal(safeNextPath("/shop/all?q=coat#top"), "/shop/all?q=coat#top");
});

test("safeNextPath rejects open redirects", () => {
  for (const bad of ["//evil.com", "/\\evil.com", "https://evil.com", "javascript:alert(1)", "evil.com", "", null, undefined, 42, "/" + "a".repeat(600)]) {
    assert.equal(safeNextPath(bad), "/account", String(bad));
  }
  assert.equal(safeNextPath("/\t/evil.com"), "/account"); // URL parser strips tabs → //evil.com
});
