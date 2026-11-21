# packages/db: Postgres + Drizzle ORM

This is the brief's "database" package. It exports `db` (node-postgres pool, cached on `globalThis` in dev), `schema`, and re-exports `drizzle-orm` helpers.

## Layout
- `src/schema/auth.ts` holds the Better Auth tables (`user`, `session`, `account`, `verification`). **Regenerate them, don't hand-edit them**, with `pnpm auth:generate` after changing Better Auth plugins (e.g. the admin plugin adds `user.role`, `banned`, `session.impersonatedBy`). Then run `db:generate`.
- `src/schema/shop.ts` holds the hand-written commerce tables. Enums come from `@repo/types` (`orderStatus`) so the API and DB never drift.
- `drizzle/` holds the generated SQL migrations. Commit them and never edit applied ones.
- `drizzle.config.ts` reads `DATABASE_URL` from `packages/db/.env` (see `.env.example`).

## Workflow
```bash
pnpm db:generate   # after any schema edit
pnpm db:migrate
pnpm db:studio
```

## Domain rules
- Money is integer cents (`price_cents`, `total_cents`, `unit_price_cents`) with `currency` defaulting to `KES`.
- **Inventory modes**:
  - `NEW`: size/colour variant rows, each with its own multi-unit stock.
  - `UPCYCLED`: a single unit (stock = 1) with `original_material` and `artisan_notes`, marked sold on payment.
- **Stock changes are atomic.** Inside one `db.transaction`, use a conditional update (`UPDATE … SET stock = stock - n WHERE id = … AND stock >= n`) and treat 0 affected rows as out of stock. Never read-then-write.
- `order_items.unit_price_cents` snapshots the price at purchase.
- Order status target pipeline: `pending_payment → paid → processing → shipped → delivered` (+ `cancelled`). Phase 1 updates the current enum in `@repo/types` to match.
- Run `pnpm --filter @repo/db check-types` after schema edits.
