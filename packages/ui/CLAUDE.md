# packages/ui: design system

Read [DESIGN.md](DESIGN.md). It is the visual and motion spec.

- `src/tokens.ts` is the **single source of truth** (colours, fonts, type scale, chamfer, springs, space, z). `src/theme.css` mirrors it for Tailwind v4, so update both together. `tokens.test.ts` fails on colour drift.
- `src/chamfer.ts`: `chamferClipPath` (web) and `chamferPath` (mobile SVG). `src/format.ts`: `formatKES(cents)`.
- Must stay platform-neutral: no React, DOM or RN imports in the token files. Shared components added in Phase 2 should keep web-only code under `src/web/` and RN code under `src/native/`.
- Tests: `pnpm --filter @repo/ui test` (Node's built-in runner; test files import with `.ts` extensions, `index.ts` doesn't).
- Tangerine is a fill colour. Text on tangerine is forest. See the contrast rules in DESIGN.md.
