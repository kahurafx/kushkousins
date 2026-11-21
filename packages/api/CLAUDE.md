# packages/api: tRPC v11 (shared by web + mobile)

All app data flows through this router. It is mounted by `apps/web/src/app/api/trpc/[trpc]/route.ts` (fetch adapter) and called by mobile over HTTP.

## Layout
- `src/trpc.ts`: `initTRPC` with **superjson** and a zod error formatter. Procedures:
  - `publicProcedure`.
  - `protectedProcedure`: `UNAUTHORIZED` without a session.
  - `adminProcedure`: `FORBIDDEN` unless `isAdmin(user)`.
  - Imports only the `Session` **type** from auth, so it is testable without a DB.
- `src/context.ts`: `createTRPCContext({ headers })` returns `{ session }` via `auth.api.getSession`.
- `src/routers/*.ts` holds one router per domain, merged in `src/root.ts`. Routers import `db` from `@repo/db` directly.
  - `product.list` (mode, category, q, sizes, colors, price range on **sale price**, sort) `| facets | bySlug | hangingLine | fanFavorites`: public.
  - `cart.validate`: public. Server prices and availability for a client bag; counts the caller's own pending reservation as available to them.
  - `order.create | cancel | pay | paymentStatus | byId | mine`: protected, own orders only. `create` lazily expires stale reservations, then releases the caller's pending order and reserves in one id-ordered pass. `pay` sends the STK Push (or mock-pays with `MOCK_PAYMENTS=true`); `paymentStatus` is polled and reconciles via STK Query.
  - `address.list | create | update | setDefault | remove` and `wishlist.ids | list | toggle`: protected.
  - `admin.*` (all `adminProcedure`, in `routers/admin/`):
    - `admin.overview` and `admin.releaseStale`.
    - `admin.products.list | byId | categories | create | update | setStatus`.
    - `admin.curation.get | setHangingLine | setFanFavorites`.
    - `admin.orders.list | byId | setStatus | markPaid | refunds | markRefunded`.
- `src/stock.ts`:
  - `cancelPending(tx, ids)` → held stock per variant, `restock(tx, held)`; `releasePendingOrders` = both. Only still-pending orders.
  - `assertNoLivePrompt(tx, ids)`: CONFLICT while an STK prompt (< `PROMPT_WINDOW_MS`) may still be answered. Call it before any release.
  - `markPaid(tx, id, {receipt, phone})`: conditional, idempotent on paid, refuses cancelled, marks 1-of-1s sold.
  - `releaseStaleReservations(tx, cutoff, { onlyUnattempted })`: `SKIP LOCKED`; clock restarts at each attempt; skips live prompts.
- `src/mpesa.ts`: Daraja client (token cache, `stkPush`, `stkQuery`, Nairobi timestamp). `mpesaConfig()` is null unless every `MPESA_*` var is set.
- `src/payments.ts`: `startPayment`, `applyStkResult` (idempotent, never throws for business reasons), `handleStkCallback`, `reconcile`, `paymentStatus`, `sweepReservations` (reconcile, then release). `handleStkCallback` and `sweepReservations` are exported for the web route handlers.
  - `rethrowUnique(e, map)`: Postgres 23505 → friendly CONFLICT.
- Admin-created SKUs are `SLUG-SIZE-COLOUR` (full slug, can't collide). Seed SKUs are short codes.
- `src/index.ts` is **server-only** (`appRouter`, `createTRPCContext`, types `AppRouter`, `RouterInputs`, `RouterOutputs`).

## Rules
- Every procedure that takes input uses `.input(...)` built from `@repo/types` schemas, the single API contract.
- Pick the narrowest procedure: admin writes use `adminProcedure`, and customer data uses `protectedProcedure` and filters by `ctx.session.user.id`.
- Listings exclude `status = 'archived'` but **include `sold`**, so the UI can show SOLD.
- Stock-changing mutations run in one `db.transaction` with conditional updates (see `packages/db/CLAUDE.md`).
- Tests: `pnpm --filter @repo/api test` (`tsx --test`). Test middleware with `createCallerFactory` and fake contexts. `order.db.test.ts` (double-purchase race, reservation release, pay gate) and `admin.db.test.ts` (RBAC, transitions, manual payment, compare-and-set stock, reserved 1-of-1 guard, stale release, curation) run only with `TEST_DATABASE_URL` set to a disposable dev DB. `payments.db.test.ts` (STK flow with fetch stubbed: success, failure codes, mismatch, late/duplicate callbacks, query reconciliation, expiry, refunds). Note: the sweeps release *any* stale pending order in that DB, and test files run in parallel, so assert outcomes, not who released.
- Sale-price SQL (`salePriceSql` in `routers/product.ts`) must stay identical to `salePriceCents()` in `@repo/types`.
- Keep **one** copy of `@trpc/server` in the lockfile (align `@types/node` ranges across packages). Two copies break `instanceof TRPCError`.
- Not tRPC: `/api/auth/*` (Better Auth) the M-Pesa callback and the cron sweep (plain route handlers in `apps/web/src/app/api`).

## Client wiring (web done in Phase 3; mobile in Phase 5)
- Clients import **types only**: `import type { AppRouter } from "@repo/api"`.
- Web: `@trpc/client` + `@trpc/tanstack-react-query` + `@tanstack/react-query`. Use `httpBatchLink({ url: "/api/trpc", transformer: superjson })`; in v11 the transformer goes on the link. For Server Components, use `appRouter.createCaller(await createTRPCContext({ headers: await headers() }))`.
- Mobile: the same link, with `url: `${EXPO_PUBLIC_API_URL}/api/trpc`` and `headers: () => ({ cookie: authClient.getCookie() })` from `src/lib/auth-client.ts`.
- GET calls encode input as `?input=` + `encodeURIComponent(JSON.stringify({ json: input }))` (superjson envelope). Remember this when debugging with curl.
