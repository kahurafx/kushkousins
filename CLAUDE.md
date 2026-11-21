# kushkousins

Act as a Principal Full-Stack Engineer and Senior UI/UX Designer. We are building a luxury-editorial e-commerce ecosystem for **kushkousins**, a fashion brand that sells **New** and **One-of-a-Kind Upcycled** clothing. The look is Gucci-style editorial minimalism (large serif type, ample whitespace, tactile interactions) combined with geometric, chamfered-corner product cards. Currency is **KES**.

The full product brief is [docs/BRIEF.md](docs/BRIEF.md). **Read it before starting any phase**, because it is the complete feature spec. The design system lives in [packages/ui/DESIGN.md](packages/ui/DESIGN.md). Read it before any UI work.

## Rules
- **Consult the advisor before locking a plan, after the same error occurs twice, and before calling a task done.**
- Work **phase by phase** (see below). Stop for approval after each phase.
- **Never read `.env` files** (`.env`, `.env.local`, `.env.*.local`, and so on). Only `.env.example` files may be read. When you add an env var, document it in the matching `.env.example`, which tells the user what to set.
- Git: you may `git add` and `git commit`. **Never `git push` without asking.** Never commit `.env*` files other than `.env.example`.
- Delegate lookups to the read-only Haiku subagents:
  - `search`: maps the repo and finds where things live.
  - `grep`: lists every call site before you change a symbol.
  - `docs`: fetches version-matched API docs. Never trust memory for Next 16, Expo 58, Better Auth, Drizzle, NativeWind or Daraja.
- Keep changes minimal: no abstraction, option or dependency nobody asked for. New non-trivial logic gets a small test.
- No hardcoded colours, fonts or springs in apps. Import them from `@repo/ui`.
- Keep **one TypeScript version (^5.9) across the workspace**. A second version makes pnpm duplicate peer-dependent packages (`@trpc/server`, `expo`), which breaks `instanceof TRPCError` and native builds.

## Architecture (Turborepo + pnpm)
| Path | Package | What |
|---|---|---|
| `apps/web` | `@repo/web` | Next.js 16 App Router, Tailwind 4, Framer Motion: storefront and `/admin` portal. Hosts `/api/auth/*` (Better Auth) and `/api/trpc/*` (tRPC). |
| `apps/mobile` | `@repo/mobile` | Expo 58 + Expo Router, NativeWind, Reanimated: native iOS and Android app. |
| `packages/api` | `@repo/api` | **tRPC v11 router shared by web and mobile**: context (Better Auth session), `public`/`protected`/`admin` procedures. |
| `packages/db` | `@repo/db` | Postgres + Drizzle ORM schema, client and migrations (the brief's "database" package). |
| `packages/auth` | `@repo/auth` | Better Auth: email/password, RBAC `CUSTOMER` \| `ADMIN`, Expo plugin. |
| `packages/types` | `@repo/types` | Shared zod schemas and TS types (the API contract). |
| `packages/ui` | `@repo/ui` | Design tokens, type scale, chamfer geometry, springs, `formatKES`. |
| `packages/typescript-config` | | Shared tsconfig base. |

Internal packages are **source-only TypeScript** (`exports` point at `src/*.ts`). Web compiles them via `transpilePackages` in `apps/web/next.config.ts`; Metro compiles them for mobile. Add a new package to that list.

## Conventions
- **Money is stored as integer cents** (`priceCents`, `totalCents`) and displayed with `formatKES` from `@repo/ui`.
- **All app data goes through tRPC** (`packages/api`), with `.input()` built from `@repo/types` zod schemas, so web and mobile share one API. There are only two non-tRPC endpoints: `/api/auth/*` (Better Auth) the M-Pesa callback `/api/payments/callback/[secret]` (Safaricom POSTs raw JSON), and the cron sweep `/api/cron/release-reservations` (Bearer `CRON_SECRET`).
- Clients use `import type { AppRouter } from "@repo/api"` only. A value import would bundle `db`/`pg` into the browser or app.
- **Authorization is enforced in tRPC procedures** (`adminProcedure`, `protectedProcedure`), never only in the UI.
- Inventory has two modes: **NEW** (size/colour variants, multi-unit stock) and **UPCYCLED** (one variant, stock 1). **Stock lives only on `product_variants`** and changes atomically in one DB transaction.
- **Stock is reserved when the order is created** (`order.create`), not at payment, so a 1-of-1 can never be sold twice. Each account holds at most one pending reservation (a new order releases the old one). UPCYCLED products become `sold` only when the order is **paid**; while merely reserved they show as "Reserved".
- **Payments** (`packages/api/src/payments.ts`, `mpesa.ts`): `order.pay` sends a Daraja STK Push; the result arrives at the callback, and the checkout polls `order.paymentStatus`, which asks Safaricom (STK Query, throttled) if the callback is late. Every attempt is a `payments` row keyed by `CheckoutRequestID`, so retries and late callbacks still find their order. The callback is idempotent, always answers 200, and pays only when the amount matches exactly (Daraja doesn't sign callbacks; the secret URL path is the auth).
- Money is **whole shillings**: `salePriceCents` rounds to KES, admin prices must be multiples of 100.
- A reservation lasts `RESERVATION_MINUTES` (20) from creation or the latest attempt. Orders with a pending attempt younger than 2 minutes (`PROMPT_WINDOW_MS`) are never released or cancelled: the customer may still enter their PIN. A success that can't pay its order (released first, or a second payment) is kept and shown to admins as **Refund due**; never drop it.
- `MOCK_PAYMENTS=true` (dev only, ignored when `NODE_ENV=production`) makes `order.pay` mark the order paid at once. Without it and without Daraja config, `order.pay` fails closed (PRECONDITION_FAILED).
- **Order status moves** only follow `orderTransitions` in `@repo/types`: pending_payment → paid | cancelled, paid → processing → shipped → delivered. Every write is conditional on the expected current status (`WHERE status = from`), so stale screens get CONFLICT. Cancelling a paid order (a refund) is not supported yet.
- **Admin stock edits never overwrite blindly.** NEW variant stock is compare-and-set against the value the editor loaded. UPCYCLED pieces have no stock field: sold/available are status actions, and "available" is refused while an unpaid order holds the piece. Variants are updated in place by id and never deleted while reserved.
- Payment always goes through `markPaid()` (`packages/api/src/stock.ts`), used by the M-Pesa callback/query, mock payments and admin manual payment.
- Order pipeline: `pending_payment → paid → processing → shipped → delivered` (plus `cancelled`).

## Commands
```bash
pnpm dev                 # all apps
pnpm build | pnpm check-types | pnpm lint | pnpm test
TEST_DATABASE_URL=postgres://postgres:postgres@localhost:54329/kushkousins pnpm --filter @repo/api test  # + DB race tests
docker compose up -d     # Postgres 17 on :54329
pnpm db:generate         # drizzle migration from schema changes
pnpm db:migrate
pnpm db:studio
pnpm db:seed             # idempotent sample catalogue (New + Upcycled, KES)
pnpm promote-admin <email>  # make an existing (signed-up) user ADMIN
pnpm auth:generate       # regenerate Better Auth tables after adding plugins
```

## Phases (status)
0. ✅ Scaffold the monorepo, Claude setup and design tokens (`packages/ui`).
1. ✅ Drizzle schema (variants, upcycled fields, curation, addresses, wishlist, M-Pesa columns), idempotent seed, Better Auth email/password + admin RBAC, tRPC (`packages/api`) mounted at `/api/trpc`.
2. ✅ Chamfered `ProductCard` and the interactive **Hanging Line** (web) with SVG placeholder garments; `/` renders them from seeded data.
3. ✅ Web storefront: tRPC client, header (nav, search, wishlist, live bag count), Fan Favorites controls, Lookbook, `/about`, PLP `/shop/[category]` (filters/sort/search), PDP `/product/[slug]`, bag drawer, `/checkout` (reserve → mock M-Pesa), `/account` (orders, wishlist, addresses).
4. ✅ Admin dashboard (`/admin`, `requireAdmin`): overview (KPIs, 30-day revenue chart, low stock, stale-reservation release), inventory (NEW variant rows with compare-and-set stock, UPCYCLED piece + provenance, status actions), curation (drag/keyboard reorder of the Hanging Line, Fan Favorites discount + ★ featured), orders (status pipeline, manual M-Pesa receipt, cancel).
5. ✅ Mobile app (Expo 58, NativeWind 4): tabs Home/Shop/Upcycled/Bag/Profile, touch Hanging Line (native snap + Reanimated + haptics), chamfered 2-column staggered grid, PDP, Bag, checkout (reserve → mock pay), Better Auth Expo + tRPC with cookie header. Bundled for iOS/Android; not yet run on a device.
6. ✅ M-Pesa Daraja STK Push (`order.pay` + polling `order.paymentStatus`), callback route, STK Query reconciliation, `payments` attempts table, reservation expiry (lazy at `order.create` + cron sweep), admin Refunds due. Release + reserve in `order.create` is one id-ordered pass. Tested with Daraja stubbed; never run against the live sandbox. Production still needs a scheduler calling the sweep.
