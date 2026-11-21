import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { and, db, desc, eq, ilike, isNull, or, schema, sql } from "@repo/db";
import { canTransition, KenyanPhoneSchema, MpesaReceiptSchema, OrderStatusSchema } from "@repo/types";
import { assertNoLivePrompt, markPaid, releasePendingOrders, rethrowUnique } from "../../stock";
import { adminProcedure, router } from "../../trpc";

const { orders, user, orderItems, payments } = schema;
/** M-Pesa took the money but it didn't pay the order (reservation released first, or a second payment). */
const needsRefund = and(eq(payments.status, "succeeded"), eq(payments.applied, false), isNull(payments.refundedAt));

export const adminOrdersRouter = router({
  list: adminProcedure
    .input(z.object({ status: OrderStatusSchema.optional(), q: z.string().trim().max(80).optional(), limit: z.number().int().min(1).max(100).default(50), offset: z.number().int().min(0).default(0) }))
    .query(({ input }) => {
      // Refs are shown as #1E3BB00E: accept the # and either case.
      const q = input.q?.replace(/^#/, "").replace(/[\\%_]/g, (c) => `\\${c}`);
      return db
        .select({
          id: orders.id,
          status: orders.status,
          totalCents: orders.totalCents,
          createdAt: orders.createdAt,
          paidAt: orders.paidAt,
          mpesaReceiptNumber: orders.mpesaReceiptNumber,
          customerName: user.name,
          customerEmail: user.email,
          itemCount: sql<number>`(select coalesce(sum(${orderItems.quantity}), 0)::int from ${orderItems} where ${orderItems.orderId} = ${orders.id})`,
        })
        .from(orders)
        .innerJoin(user, eq(user.id, orders.userId))
        .where(
          and(
            input.status ? eq(orders.status, input.status) : undefined,
            q ? or(ilike(user.email, `%${q}%`), ilike(user.name, `%${q}%`), ilike(sql`${orders.id}::text`, `${q.toLowerCase()}%`), ilike(orders.mpesaReceiptNumber, `%${q}%`)) : undefined,
          ),
        )
        .orderBy(desc(orders.createdAt))
        .limit(input.limit)
        .offset(input.offset);
    }),

  byId: adminProcedure.input(z.object({ id: z.string().uuid() })).query(async ({ input }) => {
    const order = await db.query.orders.findFirst({
      where: eq(orders.id, input.id),
      with: { items: true, user: { columns: { id: true, name: true, email: true } }, payments: { orderBy: [desc(payments.createdAt)] } },
    });
    if (!order) throw new TRPCError({ code: "NOT_FOUND" });
    return order;
  }),

  /** Move along the pipeline. `from` is the status the admin saw: stale screens get CONFLICT, not a silent overwrite. */
  setStatus: adminProcedure
    .input(z.object({ id: z.string().uuid(), from: OrderStatusSchema, to: OrderStatusSchema }))
    .mutation(({ input }) => {
      if (!canTransition(input.from, input.to)) throw new TRPCError({ code: "BAD_REQUEST", message: `Can't move an order from ${input.from} to ${input.to}.` });
      if (input.to === "paid") throw new TRPCError({ code: "BAD_REQUEST", message: "Use “Mark paid” with an M-Pesa receipt." });
      return db.transaction(async (tx) => {
        if (input.to === "cancelled") {
          await assertNoLivePrompt(tx, [input.id]);
          await releasePendingOrders(tx, [input.id]); // conditional on pending_payment inside
        } else {
          await tx.update(orders).set({ status: input.to }).where(and(eq(orders.id, input.id), eq(orders.status, input.from)));
        }
        const [now] = await tx.select({ status: orders.status }).from(orders).where(eq(orders.id, input.id));
        if (!now) throw new TRPCError({ code: "NOT_FOUND" });
        if (now.status !== input.to) throw new TRPCError({ code: "CONFLICT", message: `This order changed to “${now.status}” meanwhile. Refresh and try again.` });
        return { id: input.id, status: now.status };
      });
    }),

  /** Manual M-Pesa: a till/paybill payment made outside the STK flow. */
  markPaid: adminProcedure
    .input(z.object({ id: z.string().uuid(), receipt: MpesaReceiptSchema, phone: KenyanPhoneSchema.optional() }))
    .mutation(({ input }) =>
      db
        .transaction(async (tx) => {
          const { id, status, alreadyPaid } = await markPaid(tx, input.id, { receipt: input.receipt, phone: input.phone });
          if (alreadyPaid) throw new TRPCError({ code: "CONFLICT", message: "This order is already paid." });
          return { id, status };
        })
        .catch((e) => rethrowUnique(e, { mpesa_receipt_number: "That M-Pesa receipt is already recorded on another order." })),
    ),

  /** Payments M-Pesa completed that couldn't pay their order. Refund them in the M-Pesa portal, then mark them here. */
  refunds: adminProcedure.query(() =>
    db
      .select({
        id: payments.id,
        orderId: payments.orderId,
        orderStatus: orders.status,
        amountCents: payments.amountCents,
        phone: payments.phone,
        receipt: payments.receipt,
        createdAt: payments.createdAt,
        customerName: user.name,
      })
      .from(payments)
      .innerJoin(orders, eq(orders.id, payments.orderId))
      .innerJoin(user, eq(user.id, orders.userId))
      .where(needsRefund)
      .orderBy(desc(payments.createdAt)),
  ),

  markRefunded: adminProcedure.input(z.object({ paymentId: z.string().uuid() })).mutation(async ({ input }) => {
    const [done] = await db
      .update(payments)
      .set({ refundedAt: new Date() })
      .where(and(eq(payments.id, input.paymentId), needsRefund))
      .returning({ id: payments.id });
    if (!done) throw new TRPCError({ code: "CONFLICT", message: "This payment doesn't need a refund (already handled?)." });
    return done;
  }),
});
