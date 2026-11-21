import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { and, asc, db, desc, eq, gte, inArray, schema, sql } from "@repo/db";
import { CreateOrderSchema, KenyanPhoneSchema, RESERVATION_MINUTES, salePriceCents, shippingCents } from "@repo/types";
import { paymentStatus, startPayment } from "../payments";
import { assertNoLivePrompt, cancelPending, releasePendingOrders, releaseStaleReservations } from "../stock";
import { protectedProcedure, router } from "../trpc";

const { orders, orderItems, products, productVariants } = schema;

export const orderRouter = router({
  /**
   * Reserve stock and create a pending order, atomically. Stock is decremented here (not at payment)
   * so a 1-of-1 can never be sold twice. Any earlier pending order of this user is released in the
   * same pass, so one account holds at most one reservation.
   */
  create: protectedProcedure.input(CreateOrderSchema).mutation(async ({ ctx, input }) => {
    const userId = ctx.session.user.id;
    const qty = new Map<string, number>();
    for (const { variantId, quantity } of input.items) qty.set(variantId, (qty.get(variantId) ?? 0) + quantity);

    // Lazy expiry, so correctness never depends on the cron running. Its own short transaction.
    await db.transaction((tx) => releaseStaleReservations(tx, new Date(Date.now() - RESERVATION_MINUTES * 60_000), { onlyUnattempted: true }));

    return db.transaction(async (tx) => {
      const pending = await tx
        .select({ id: orders.id })
        .from(orders)
        .where(and(eq(orders.userId, userId), eq(orders.status, "pending_payment")))
        .for("update");
      await assertNoLivePrompt(tx, pending.map((p) => p.id));
      const released = await cancelPending(tx, pending.map((p) => p.id));

      const rows = await tx
        .select({ variant: productVariants, product: products })
        .from(productVariants)
        .innerJoin(products, eq(products.id, productVariants.productId))
        .where(inArray(productVariants.id, [...qty.keys()]));
      const byId = new Map(rows.map((r) => [r.variant.id, r]));

      let subtotalCents = 0;
      const lines = [];
      // One pass over every touched variant in id order (release + reserve together): a fixed lock order, no deadlocks.
      for (const variantId of [...new Set([...qty.keys(), ...released.keys()])].sort()) {
        const back = released.get(variantId) ?? 0;
        const quantity = qty.get(variantId);
        if (!quantity) {
          await tx.update(productVariants).set({ stock: sql`${productVariants.stock} + ${back}` }).where(eq(productVariants.id, variantId));
          continue;
        }
        const row = byId.get(variantId);
        if (!row || row.product.status !== "active") {
          throw new TRPCError({ code: "CONFLICT", message: `${row?.product.name ?? "An item"} is no longer available.` });
        }
        const reserved = await tx
          .update(productVariants)
          .set({ stock: sql`${productVariants.stock} + ${back - quantity}` })
          .where(and(eq(productVariants.id, variantId), gte(productVariants.stock, quantity - back)))
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
      await assertNoLivePrompt(tx, [input.orderId]);
      await releasePendingOrders(tx, [input.orderId]);
      return { ok: true };
    }),
  ),

  /**
   * Send the M-Pesa PIN prompt (STK Push). The result arrives by callback; poll `paymentStatus`.
   * With MOCK_PAYMENTS=true (dev only, never in production builds) the order is marked paid at once.
   */
  pay: protectedProcedure
    .input(z.object({ orderId: z.string().uuid(), phone: KenyanPhoneSchema }))
    .mutation(({ ctx, input }) => startPayment(ctx.session.user.id, input.orderId, input.phone)),

  paymentStatus: protectedProcedure
    .input(z.object({ orderId: z.string().uuid() }))
    .query(({ ctx, input }) => paymentStatus(ctx.session.user.id, input.orderId)),

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
