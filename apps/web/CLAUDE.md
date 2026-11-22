@AGENTS.md

# apps/web: storefront + admin (Next.js 16 App Router)

Read [../../packages/ui/DESIGN.md](../../packages/ui/DESIGN.md) before building UI. Colours, fonts, type steps and chamfers come from `@repo/ui` through `src/app/globals.css` (`@import "@repo/ui/theme.css"`). Use the Tailwind classes `bg-canvas`, `text-forest`, `font-display`, `text-display-lg`, `text-label` and `chamfer-md`; never raw hex values.

## Layout
- `src/app/layout.tsx` loads Cormorant Garamond and Inter with `next/font` (`--font-cormorant`, `--font-inter`).
- `src/app/api/auth/[...all]/route.ts` is the Better Auth handler and `src/app/api/trpc/[trpc]/route.ts` is the tRPC handler (`@repo/api`). Both also serve the mobile app.
- Storefront routes:
  - `/`: Hanging Line, Fan Favorites, Lookbook.
  - `/shop/[category]`: `all`, `new`, `upcycled` or a category slug; unknown slugs 404. URL filters are parsed by `src/lib/shop-params.ts`.
  - `/product/[slug]` and `/about`.
  - `/checkout` (server-guarded) → `/checkout/confirmation/[orderId]`.
  - `/account/sign-in` and `/account/sign-up` (validated `?next=` via `safeNextPath`).
  - `/account`, `/account/wishlist`, `/account/addresses`: the `(member)` group; each page calls `requireSession(path)`.
- tRPC: `src/components/providers.tsx` (QueryClient + `httpBatchLink` + superjson), `src/lib/trpc.ts` (`useTRPC`), `src/lib/trpc-server.ts` (`publicCaller()` and `sessionCaller()`, server-only). `src/lib/session.ts` provides `getSession` and `requireSession`.
- Bag: `src/lib/cart.ts` stores `{variantId, quantity}` only (useSyncExternalStore + guarded localStorage + cross-tab sync) plus `bagDrawer`. Prices and stock always come from `cart.validate`.
- Admin: `src/app/admin/**`: `/admin` (overview), `/admin/inventory` (+ `/new`, `/[id]`), `/admin/curation`, `/admin/orders` (+ `/[id]`). **Every admin page calls `requireAdmin(path)`** (`src/lib/session.ts`), the layout too: layouts and pages render in parallel, so a layout-only guard isn't enough. Signed out → sign-in; non-admin → 404. It uses `isAdmin()` (multi-role safe), never `role === "ADMIN"`. The layout sets `robots: noindex`. Admin components live in `src/components/admin/`.
- The product editor is remounted with `key={product.updatedAt}` after each save, so its compare-and-set stock baseline is fresh.

## Components
- `src/components/product-card.tsx`: the chamfered card. The chamfer clips only the backdrop layer so the focus ring is never clipped, the link is stretched over the card, and the quick-add button is a sibling (never inside the `<a>`). Shows pills (discount, UPCYCLED, SOLD), an optional star and a disabled button when sold.
- `src/components/hanging-line.tsx`: the hero rack.
  - Slots keep a fixed layout box; only inner layers move. The swing rotates a `pointer-events-none` image layer, never the `<li>` or button, so a swinging hem can't steal hover.
  - Hover is mouse-only and closes only when the pointer leaves the whole rack. A click selects (never toggles). Focus opens the hang-tag (no swing); Escape, an outside click, or blurring the rack closes it.
  - Reduced motion: no swing or parting; dimming and the tag fade stay.
- `src/components/garment-art.tsx`: `images[0]` if present, else an SVG silhouette tinted with `swatch(color)`. Real images will need `images.remotePatterns` and `next/image`.
- `src/lib/showcase.ts`: `toShowcaseItem()` maps tRPC rows to the slim props shape that client components receive.
- `/` (`src/app/page.tsx`) calls `await connection()` and then `appRouter.createCaller({ session: null })`, so `next build` never touches the database.

- Also: `site-header`, `bag-drawer` (focus trap, Escape, scroll lock, focus return), `shop-filters`, `buy-box` (sticky / pinned phone bar), `checkout-flow`, `address-form` (validates with `AddressSchema`), `address-book`, `wishlist-button`, `fan-favorites`, `lookbook`, `auth-form`.

## UI spec
- **Header:** sticky and translucent. Left links: `NEW ARRIVALS`, `UPCYCLED`, `COLLECTIONS`, `ABOUT US` (`text-label uppercase`). Centre: the serif **kushkousins** wordmark. Right: Search, Account, Wishlist and a Bag icon with a live count.
- **Hanging Line:** garments on wire hangers along a thin rail. Hover swings the garment on its hook (`hangingLine.swing`, kicked by `swingImpulse`), parts and dims its neighbours, and fades in a hang-tag (category · availability, price) linking to the PDP. Full motion spec is in DESIGN.md.
- **Fan Favorites:** chamfered cards, filter pills (`All`, `Upcycled`, `Streetwear`, `Formal`, `Outerwear`), strikethrough discount pricing, and `Previous`/`Next` with progress.
- **PDP:** gallery, a size selector **or** a "1-of-1 Unique Piece" badge with provenance and materials, and a sticky add-to-bag bar.
- **Cart drawer:** slides from the right and **revalidates stock on the server** before checkout. 1-of-1 items must not double-sell.

## Rules
- Use Server Components by default and add `"use client"` only for interaction (motion, drawer, forms).
- Use `motion` / Framer Motion springs with `spring.default` from `@repo/ui`; use `spring.flick` only after momentum. The one underdamped exception is the Hanging Line swing (`hangingLine.swing`): a hanger physically rocks. Respect `useReducedMotion()`.
- **Data goes through tRPC** (`@repo/api`). Client Components use `@trpc/tanstack-react-query` hooks (wired in Phase 3; see `packages/api/CLAUDE.md`), and Server Components use `appRouter.createCaller(...)`. Do not add Server Actions or ad-hoc route handlers for app data. The only exceptions are `/api/auth/*`, `/api/payments/callback/[secret]` (M-Pesa; the path must not contain "mpesa", which Daraja is reported to reject) and `/api/cron/release-reservations`.
- Never import `@repo/db`, `@repo/auth/server` or a value from `@repo/api` into client components (use `import type { AppRouter }` only).
- Env vars are documented in `.env.example` (never read `.env.local`).
- Before you call a task done, run `pnpm --filter @repo/web check-types` and `pnpm exec next build`.
