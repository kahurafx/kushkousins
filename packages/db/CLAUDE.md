# packages/db: Postgres + Drizzle ORM

This is the brief's "database" package. It exports `db` (node-postgres pool, cached on `globalThis` in dev), `schema`, and re-exports `drizzle-orm` helpers (`eq`, `and`, `sql`, …).

## Layout
- `src/schema/auth.ts` holds the Better Auth tables, **generated, not hand-edited**: run `pnpm auth:generate` after changing Better Auth plugins, then `db:generate`. The admin plugin adds `user.role` (string, may be comma-separated, so it is not an enum), `banned`, `ban_reason`, `ban_expires` and `session.impersonated_by`.
- `src/schema/shop.ts` holds the commerce tables. Its enums are built from `@repo/types` tuples (`inventoryMode`, `productStatus`, `orderStatus`).
- `src/seed.ts` is an idempotent sample catalogue (upserts by slug and SKU, in one transaction): `pnpm db:seed`. **Dev only**: it resets stock, prices, discounts and curation for the seeded products, so never run it after real orders or Phase 4 admin edits.
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
  - Curation: `hanging_line_position` / `fan_favorite_position` (null = not shown, lower = first), and `featured` (★ editor's pick, managed from admin curation; migration `0001`).
- **product_variants**: the **only place stock lives**. NEW has a size × colour matrix. UPCYCLED has exactly one variant with stock 1, which still has a size and colour so filters work. `stock >= 0` CHECK.
- **orders**: `subtotal/shipping/total_cents`, `shipping_address` jsonb snapshot, `mpesa_receipt_number` (unique; set from the attempt that paid it), `paid_at`. `user_id` is **`onDelete: restrict`** on purpose, to keep order history. Better Auth admin `removeUser` therefore fails for customers with orders; ban them instead.
- **payments**: one row per STK Push (`checkout_request_id` unique, `amount_cents`, `status` pending|succeeded|failed, `result_code/desc`, `receipt` unique, `applied` = this payment marked the order paid, `queried_at` throttle, `refunded_at`). `succeeded && !applied && refunded_at is null` = refund due.
- **order_items**: references `variant_id`/`product_id` (set null on delete) and **snapshots** name, size, colour and unit price.
- **addresses** (Kenyan: county, phone) and **wishlist_items** (PK `user_id + product_id`).

## Rules
- Money is integer cents with `currency` defaulting to `KES`.
- **Stock changes are atomic.** Inside one `db.transaction`, run `UPDATE product_variants SET stock = stock - n WHERE id = … AND stock >= n RETURNING …` and treat 0 rows as out of stock. Never read-then-write. Variants are updated **in id order** to avoid deadlocks between concurrent orders.
- **Reservation model**: `order.create` decrements stock (reservation) and creates a `pending_payment` order. `order.cancel` and a user's next order release it (`releasePendingOrders` in `packages/api/src/stock.ts`). Payment marks UPCYCLED products `sold` + `sold_at`; until then a 0-stock active product is "Reserved". Never mark sold on reservation.
- Run `pnpm --filter @repo/db check-types` after schema edits.
