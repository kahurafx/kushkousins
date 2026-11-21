import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { and, asc, db, desc, eq, gte, inArray, schema, sql } from "@repo/db";
import { CreateOrderSchema, KenyanPhoneSchema, salePriceCents, shippingCents } from "@repo/types";
import { releasePendingOrders } from "../stock";
import { protectedProcedure, router } from "../trpc";

const { orders, orderItems, products, productVariants } = schema;

export const orderRouter = router({
  /**
   * Reserve stock and create a pending order, atomically. Stock is decremented here (not at payment)
   * so a 1-of-1 can never be sold twice. Any earlier pending order of this user is released first,
   * so one account holds at most one reservation.
   * shortcut: pending orders never expire on their own; add expiry with the Daraja STK timeout (Phase 6).
   * shortcut: release and reserve lock variants in two passes; two shoppers swapping the same items at the same
   *   instant can deadlock. Postgres aborts one (a 500, never an oversell). Merge into one id-ordered pass in Phase 6.
   */
  create: protectedProcedure.input(CreateOrderSchema).mutation(async ({ ctx, input }) => {
    const userId = ctx.session.user.id;
    const qty = new Map<string, number>();
    for (const { variantId, quantity } of input.items) qty.set(variantId, (qty.get(variantId) ?? 0) + quantity);
    const variantIds = [...qty.keys()].sort(); // fixed lock order prevents deadlocks between concurrent orders

    return db.transaction(async (tx) => {
      const pending = await tx
        .select({ id: orders.id })
        .from(orders)
        .where(and(eq(orders.userId, userId), eq(orders.status, "pending_payment")))
        .for("update");
      await releasePendingOrders(tx, pending.map((p) => p.id));

      const rows = await tx
        .select({ variant: productVariants, product: products })
        .from(productVariants)
        .innerJoin(products, eq(products.id, productVariants.productId))
        .where(inArray(productVariants.id, variantIds));
      const byId = new Map(rows.map((r) => [r.variant.id, r]));

      let subtotalCents = 0;
      const lines = [];
      for (const variantId of variantIds) {
        const row = byId.get(variantId);
        if (!row || row.product.status !== "active") {
          throw new TRPCError({ code: "CONFLICT", message: `${row?.product.name ?? "An item"} is no longer available.` });
        }
        const quantity = qty.get(variantId)!;
        const reserved = await tx
          .update(productVariants)
          .set({ stock: sql`${productVariants.stock} - ${quantity}` })
          .where(and(eq(productVariants.id, variantId), gte(productVariants.stock, quantity)))
          .returning({ id: productVariants.id });
        if (reserved.length === 0) {
          throw new TRPCError({
            code: "CONFLICT",
            message: `${row.product.name} (${row.variant.size}) is no longer available in that quantity.`,
          });
        }
        const unitPriceCents = salePriceCents(row.product);
        subtotalCents += unitPriceCents * quantity;
        lines.push({
          variantId,
          productId: row.product.id,
          productName: row.product.name,
          size: row.variant.size,
          color: row.variant.color,
          quantity,
          unitPriceCents,
        });
      }

      const shipping = shippingCents(subtotalCents);
      const [order] = await tx
        .insert(orders)
        .values({
          userId,
          subtotalCents,
          shippingCents: shipping,
          totalCents: subtotalCents + shipping,
          shippingAddress: input.shippingAddress,
        })
        .returning({ id: orders.id, totalCents: orders.totalCents });
      await tx.insert(orderItems).values(lines.map((l) => ({ ...l, orderId: order!.id })));
      return order!;
    });
  }),

  /** Cancel your own unpaid order and release its stock. */
  cancel: protectedProcedure.input(z.object({ orderId: z.string().uuid() })).mutation(({ ctx, input }) =>
    db.transaction(async (tx) => {
      const [order] = await tx
        .select({ status: orders.status })
        .from(orders)
        .where(and(eq(orders.id, input.orderId), eq(orders.userId, ctx.session.user.id)))
        .for("update");
      if (!order) throw new TRPCError({ code: "NOT_FOUND" });
      if (order.status !== "pending_payment") throw new TRPCError({ code: "CONFLICT", message: "Only unpaid orders can be cancelled." });
      await releasePendingOrders(tx, [input.orderId]);
      return { ok: true };
    }),
  ),

  /**
   * DEV-ONLY stand-in for M-Pesa until Phase 6. Fails closed unless MOCK_PAYMENTS=true,
   * because in production this would hand out free goods.
   */
  mockPay: protectedProcedure
    .input(z.object({ orderId: z.string().uuid(), phone: KenyanPhoneSchema }))
    .mutation(async ({ ctx, input }) => {
      if (process.env.MOCK_PAYMENTS !== "true") throw new TRPCError({ code: "FORBIDDEN", message: "Mock payments are disabled." });
      return db.transaction(async (tx) => {
        const [order] = await tx
          .select({ id: orders.id, status: orders.status })
          .from(orders)
          .where(and(eq(orders.id, input.orderId), eq(orders.userId, ctx.session.user.id)))
          .for("update");
        if (!order) throw new TRPCError({ code: "NOT_FOUND" });
        if (order.status === "paid") return { id: order.id, status: order.status }; // idempotent
        if (order.status !== "pending_payment") throw new TRPCError({ code: "CONFLICT", message: "Order is not awaiting payment." });

        const [paid] = await tx
          .update(orders)
          .set({ status: "paid", paidAt: new Date(), mpesaPhone: input.phone })
          .where(eq(orders.id, order.id))
          .returning({ id: orders.id, status: orders.status });

        // 1-of-1s become SOLD only once paid (while merely reserved they show as unavailable).
        const items = await tx.select({ productId: orderItems.productId }).from(orderItems).where(eq(orderItems.orderId, order.id));
        const productIds = items.flatMap((i) => (i.productId ? [i.productId] : []));
        if (productIds.length) {
          await tx
            .update(products)
            .set({ status: "sold", soldAt: new Date() })
            .where(and(inArray(products.id, productIds), eq(products.mode, "UPCYCLED")));
        }
        return paid!;
      });
    }),

  byId: protectedProcedure.input(z.object({ orderId: z.string().uuid() })).query(async ({ ctx, input }) => {
    const order = await db.query.orders.findFirst({
      where: and(eq(orders.id, input.orderId), eq(orders.userId, ctx.session.user.id)),
      with: { items: { orderBy: [asc(orderItems.productName)] } },
    });
    if (!order) throw new TRPCError({ code: "NOT_FOUND" });
    return order;
  }),

  mine: protectedProcedure.query(({ ctx }) =>
    db.query.orders.findMany({
      where: eq(orders.userId, ctx.session.user.id),
      with: { items: true },
      orderBy: [desc(orders.createdAt)],
    }),
  ),
});
