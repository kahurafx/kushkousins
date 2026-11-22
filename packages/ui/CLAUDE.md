# packages/ui: design system

Read [DESIGN.md](DESIGN.md). It is the visual and motion spec.

- `src/tokens.ts` is the **single source of truth** (colours, fonts, type scale, chamfer, springs, space, z). `src/theme.css` mirrors it for Tailwind v4, so update both together. `tokens.test.ts` fails on colour drift.
- `src/chamfer.ts`: `chamferClipPath` (web) and `chamferPath` (mobile SVG). `src/format.ts`: `formatKES(cents)`.
- `src/garments.ts` holds the placeholder garment SVG paths (`silhouettes`, `hangerPath` and their viewBoxes), `silhouetteFor(name)`, `swatch(colorName)`, and the Hanging Line geometry and motion (`hangingLine`, `partingOffset`, `swingImpulse`). Web and mobile both render these.
- Must stay platform-neutral: plain data and functions only, with no React, DOM or RN imports. Components live in the apps (`apps/web/src/components`, later `apps/mobile/src/components`).
- Tests: `pnpm --filter @repo/ui test` (Node's built-in runner; test files import with `.ts` extensions, `index.ts` doesn't).
- Tangerine is a fill colour. Text on tangerine is forest. See the contrast rules in DESIGN.md.
