import { count, db, eq, schema, sql } from "@repo/db";
import { adminProcedure, router } from "../trpc";

const { products, orders, user } = schema;

// Phase 4 grows this into inventory/curation/orders; for now it proves RBAC end to end.
export const adminRouter = router({
  overview: adminProcedure.query(async () => {
    const [[p], [o], [u]] = await Promise.all([
      db.select({ total: count() }).from(products),
      db
        .select({
          total: count(),
          revenueCents: sql<number>`coalesce(sum(${orders.totalCents}) filter (where ${orders.paidAt} is not null), 0)::int`,
        })
        .from(orders),
      db.select({ total: count() }).from(user).where(eq(user.role, "CUSTOMER")),
    ]);
    return { products: p!.total, orders: o!.total, revenueCents: o!.revenueCents, customers: u!.total };
  }),
});
