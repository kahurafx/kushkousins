# packages/db: Postgres + Drizzle ORM

This is the brief's "database" package. It exports `db` (node-postgres pool, cached on `globalThis` in dev), `schema`, and re-exports `drizzle-orm` helpers (`eq`, `and`, `sql`, …).

## Layout
- `src/schema/auth.ts` holds the Better Auth tables, **generated, not hand-edited**: run `pnpm auth:generate` after changing Better Auth plugins, then `db:generate`. The admin plugin adds `user.role` (string, may be comma-separated, so it is not an enum), `banned`, `ban_reason`, `ban_expires` and `session.impersonated_by`.
- `src/schema/shop.ts` holds the commerce tables. Its enums are built from `@repo/types` tuples (`inventoryMode`, `productStatus`, `orderStatus`).
- `src/seed.ts` is an idempotent sample catalogue (upserts by slug and SKU, in one transaction): `pnpm db:seed`.
- `src/promote-admin.ts` sets `role = 'ADMIN'` for an existing user: `pnpm promote-admin <email>`.
- `drizzle/` holds the generated SQL migrations. Commit them and never edit applied ones.
- `drizzle.config.ts` reads `DATABASE_URL` from `packages/db/.env` (see `.env.example`). Postgres runs via `docker compose` on **:54329**.

## Workflow
```bash
pnpm db:generate   # after any schema edit
pnpm db:migrate
pnpm db:seed
pnpm db:studio
```

## Domain model
- **products**:
  - `mode` NEW | UPCYCLED; `status` active | archived | sold.
  - `price_cents`, `discount_percent` (0–90, CHECK). Sale price is `salePriceCents()` from `@repo/types`, used everywhere.
  - `images text[]`; `original_material` and `artisan_notes` for UPCYCLED.
  - Curation: `hanging_line_position` / `fan_favorite_position` (null = not shown, lower = first).
- **product_variants**: the **only place stock lives**. NEW has a size × colour matrix. UPCYCLED has exactly one variant with stock 1, which still has a size and colour so filters work. `stock >= 0` CHECK.
- **orders**: `subtotal/shipping/total_cents`, `shipping_address` jsonb snapshot, `mpesa_checkout_request_id` / `mpesa_receipt_number` (unique, for Phase 6 webhook dedupe), `paid_at`. `user_id` is **`onDelete: restrict`** on purpose, to keep order history. Better Auth admin `removeUser` therefore fails for customers with orders; ban them instead.
- **order_items**: references `variant_id`/`product_id` (set null on delete) and **snapshots** name, size, colour and unit price.
- **addresses** (Kenyan: county, phone) and **wishlist_items** (PK `user_id + product_id`).

## Rules
- Money is integer cents with `currency` defaulting to `KES`.
- **Stock changes are atomic.** Inside one `db.transaction`, run `UPDATE product_variants SET stock = stock - n WHERE id = … AND stock >= n RETURNING …` and treat 0 rows as out of stock. Never read-then-write. When an UPCYCLED variant reaches 0, set `products.status = 'sold'` and `sold_at` in the same transaction.
- Run `pnpm --filter @repo/db check-types` after schema edits.
