import { z } from "zod";
import { and, count, db, desc, eq, inArray, isNull, lte, schema, sql } from "@repo/db";
import { revenueStatuses } from "@repo/types";
import { releaseStaleReservations } from "../../stock";
import { adminProcedure, router } from "../../trpc";
import { adminCurationRouter } from "./curation";
import { adminOrdersRouter } from "./orders";
import { adminProductsRouter } from "./products";

const { products, productVariants, orders, payments, user } = schema;
const isRevenue = inArray(orders.status, [...revenueStatuses]);

export const adminRouter = router({
  products: adminProductsRouter,
  curation: adminCurationRouter,
  orders: adminOrdersRouter,

  overview: adminProcedure.query(async () => {
    const [[money], byStatus, [cust], [prod], lowStock, daily, recent, [refunds]] = await Promise.all([
      db
        .select({
          revenueCents: sql<number>`coalesce(sum(${orders.totalCents}) filter (where ${isRevenue}), 0)::int`,
          revenue30Cents: sql<number>`coalesce(sum(${orders.totalCents}) filter (where ${isRevenue} and ${orders.paidAt} >= (now() at time zone 'UTC') - interval '30 days'), 0)::int`,
          paidOrders: sql<number>`(count(*) filter (where ${isRevenue}))::int`,
        })
        .from(orders),
      db.select({ status: orders.status, n: count() }).from(orders).groupBy(orders.status),
      db.select({ n: count() }).from(user).where(eq(user.role, "CUSTOMER")),
      db.select({ active: sql<number>`(count(*) filter (where ${products.status} = 'active'))::int`, sold: sql<number>`(count(*) filter (where ${products.status} = 'sold'))::int` }).from(products),
      db
        .select({ productId: products.id, name: products.name, size: productVariants.size, color: productVariants.color, stock: productVariants.stock })
        .from(productVariants)
        .innerJoin(products, eq(products.id, productVariants.productId))
        .where(and(eq(products.mode, "NEW"), eq(products.status, "active"), lte(productVariants.stock, 2)))
        .orderBy(productVariants.stock)
        .limit(8),
      // Revenue per day for the last 30 days, zero-filled, on Nairobi calendar days.
      // Timestamps are stored as UTC (drizzle writes toISOString; the DB runs in UTC), so convert explicitly.
      db.execute<{ day: string; cents: number }>(sql`
        select to_char(d.day, 'YYYY-MM-DD') as day,
               coalesce(sum(o.total_cents), 0)::int as cents
        from generate_series((now() at time zone 'Africa/Nairobi')::date - 29, (now() at time zone 'Africa/Nairobi')::date, interval '1 day') as d(day)
        left join orders o
          on (o.paid_at at time zone 'UTC' at time zone 'Africa/Nairobi')::date = d.day::date
         and o.status in ('paid', 'processing', 'shipped', 'delivered')
        group by d.day order by d.day`),
      db
        .select({ id: orders.id, status: orders.status, totalCents: orders.totalCents, createdAt: orders.createdAt, customer: user.name })
        .from(orders)
        .innerJoin(user, eq(user.id, orders.userId))
        .orderBy(desc(orders.createdAt))
        .limit(6),
      db
        .select({ n: count() })
        .from(payments)
        .where(and(eq(payments.status, "succeeded"), eq(payments.applied, false), isNull(payments.refundedAt))),
    ]);
    return {
      ...money!,
      customers: cust!.n,
      activeProducts: prod!.active,
      soldPieces: prod!.sold,
      byStatus: Object.fromEntries(byStatus.map((s) => [s.status, s.n])) as Record<string, number>,
      lowStock,
      daily: daily.rows,
      recent,
      refundsDue: refunds!.n,
    };
  }),

  /** Release unpaid reservations older than N minutes now (they also expire on their own; see sweepReservations). */
  releaseStale: adminProcedure
    .input(z.object({ olderThanMinutes: z.number().int().min(5).max(60 * 24 * 14) }))
    .mutation(({ input }) =>
      db.transaction(async (tx) => ({ released: await releaseStaleReservations(tx, new Date(Date.now() - input.olderThanMinutes * 60_000)) })),
    ),
});
