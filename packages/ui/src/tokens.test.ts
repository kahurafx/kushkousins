import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { colors } from "./tokens.ts";
import { chamferClipPath, chamferPath } from "./chamfer.ts";
import { formatKES } from "./format.ts";

const luminance = (hex: string) => {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
};
const contrast = (a: string, b: string) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi! + 0.05) / (lo! + 0.05);
};

test("theme.css mirrors every color token", () => {
  const css = readFileSync(new URL("./theme.css", import.meta.url), "utf8").toLowerCase();
  for (const [name, hex] of Object.entries(colors)) {
    assert.ok(css.includes(`--color-${name}: ${hex.toLowerCase()};`), `theme.css missing --color-${name}`);
  }
});

test("text pairings meet WCAG AA (4.5:1)", () => {
  assert.ok(contrast(colors.forest, colors.canvas) >= 4.5);
  assert.ok(contrast(colors.forest, colors.stone) >= 4.5);
  assert.ok(contrast(colors.espresso, colors.canvas) >= 4.5);
  assert.ok(contrast(colors.canvas, colors.forest) >= 4.5);
  assert.ok(contrast(colors.forest, colors.tangerine) >= 4.5, "badge text: forest on tangerine");
});

test("tangerine is not a text color on light surfaces", () => {
  // Documented in DESIGN.md: tangerine fills badges; it never carries small text on canvas/stone.
  assert.ok(contrast(colors.tangerine, colors.canvas) < 4.5);
});

test("chamfer shapes", () => {
  assert.equal(chamferClipPath(20), "polygon(20px 0, 100% 0, 100% calc(100% - 20px), calc(100% - 20px) 100%, 0 100%, 0 20px)");
  assert.equal(chamferPath(100, 200, 20), "M20 0H100V180L80 200H0V20Z");
});

test("formatKES renders whole shillings from cents", () => {
  const s = formatKES(450000);
  assert.match(s, /4,500/);
  assert.match(s, /Ksh|KES/);
});
