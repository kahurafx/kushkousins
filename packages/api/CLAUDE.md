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
  - `order.create | cancel | mockPay | byId | mine`: protected, own orders only. `create` reserves stock atomically; `mockPay` is gated by `MOCK_PAYMENTS`.
  - `address.list | create | update | setDefault | remove` and `wishlist.ids | list | toggle`: protected.
  - `admin.overview`: admin.
- `src/stock.ts`: `releasePendingOrders(tx, ids)` (restores stock, cancels the orders).
- `src/index.ts` is **server-only** (`appRouter`, `createTRPCContext`, types `AppRouter`, `RouterInputs`, `RouterOutputs`).

## Rules
- Every procedure that takes input uses `.input(...)` built from `@repo/types` schemas, the single API contract.
- Pick the narrowest procedure: admin writes use `adminProcedure`, and customer data uses `protectedProcedure` and filters by `ctx.session.user.id`.
- Listings exclude `status = 'archived'` but **include `sold`**, so the UI can show SOLD.
- Stock-changing mutations run in one `db.transaction` with conditional updates (see `packages/db/CLAUDE.md`).
- Tests: `pnpm --filter @repo/api test` (`tsx --test`). Test middleware with `createCallerFactory` and fake contexts. `order.db.test.ts` (double-purchase race, reservation release, mockPay gate) runs only with `TEST_DATABASE_URL` set to a disposable dev DB.
- Sale-price SQL (`salePriceSql` in `routers/product.ts`) must stay identical to `salePriceCents()` in `@repo/types`.
- Keep **one** copy of `@trpc/server` in the lockfile (align `@types/node` ranges across packages). Two copies break `instanceof TRPCError`.
- Not tRPC: `/api/auth/*` (Better Auth) and the Phase 6 M-Pesa callback (a plain route handler).

## Client wiring (web done in Phase 3; mobile in Phase 5)
- Clients import **types only**: `import type { AppRouter } from "@repo/api"`.
- Web: `@trpc/client` + `@trpc/tanstack-react-query` + `@tanstack/react-query`. Use `httpBatchLink({ url: "/api/trpc", transformer: superjson })`; in v11 the transformer goes on the link. For Server Components, use `appRouter.createCaller(await createTRPCContext({ headers: await headers() }))`.
- Mobile: the same link, with `url: `${EXPO_PUBLIC_API_URL}/api/trpc`` and `headers: () => ({ cookie: authClient.getCookie() })` from `src/lib/auth-client.ts`.
- GET calls encode input as `?input=` + `encodeURIComponent(JSON.stringify({ json: input }))` (superjson envelope). Remember this when debugging with curl.
