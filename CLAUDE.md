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

## Architecture (Turborepo + pnpm)
| Path | Package | What |
|---|---|---|
| `apps/web` | `@repo/web` | Next.js 16 App Router, Tailwind 4, Framer Motion: storefront and `/admin` portal. Hosts the Better Auth API. |
| `apps/mobile` | `@repo/mobile` | Expo 58 + Expo Router, NativeWind, Reanimated: native iOS and Android app. |
| `packages/db` | `@repo/db` | Postgres + Drizzle ORM schema, client and migrations (the brief's "database" package). |
| `packages/auth` | `@repo/auth` | Better Auth: email/password, RBAC `CUSTOMER` \| `ADMIN`, Expo plugin. |
| `packages/types` | `@repo/types` | Shared zod schemas and TS types (the API contract). |
| `packages/ui` | `@repo/ui` | Design tokens, type scale, chamfer geometry, springs, `formatKES`. |
| `packages/typescript-config` | | Shared tsconfig base. |

Internal packages are **source-only TypeScript** (`exports` point at `src/*.ts`). Web compiles them via `transpilePackages` in `apps/web/next.config.ts`; Metro compiles them for mobile. Add a new package to that list.

## Conventions
- **Money is stored as integer cents** (`priceCents`, `totalCents`) and displayed with `formatKES` from `@repo/ui`.
- Inventory has two modes: **NEW** (size/colour variants, multi-unit stock) and **UPCYCLED** (stock = 1, auto-marked sold on paid checkout). Stock changes must be atomic in a single DB transaction.
- Order pipeline: `Pending Payment → Paid → Processing → Shipped → Delivered` (plus `Cancelled`).
- Validate every request body at the API boundary with `@repo/types` zod schemas.

## Commands
```bash
pnpm dev                 # all apps
pnpm build | pnpm check-types | pnpm lint | pnpm test
docker compose up -d     # Postgres 17 on :5432
pnpm db:generate         # drizzle migration from schema changes
pnpm db:migrate
pnpm db:studio
pnpm auth:generate       # regenerate Better Auth tables after adding plugins
```

## Phases (status)
0. ✅ Scaffold the monorepo, Claude setup and design tokens (`packages/ui`).
1. ⏳ Drizzle schema (variants, upcycled fields, curation, addresses, wishlist), seed script (New + Upcycled products in KES), Better Auth email/password + admin RBAC.
2. Design system components: chamfered card and the interactive **Hanging Line** (web).
3. Web storefront: PLP `/shop/[category]`, PDP `/product/[slug]`, cart drawer, `/checkout` (mock payment), `/account`.
4. Admin dashboard: inventory CRUD (NEW/UPCYCLED), landing curation (Hanging Line order, Fan Favorites discounts), orders and revenue.
5. Mobile app: shared types, API and auth; touch Hanging Line; 2-column staggered grid; tabs Home/Shop/Upcycled/Bag/Profile.
6. M-Pesa Daraja STK Push, callback webhook (verify `CheckoutRequestID`, store `MpesaReceiptNumber`, mark Paid, atomic stock decrement / mark sold).
