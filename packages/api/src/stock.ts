import { TRPCError } from "@trpc/server";
import { and, asc, db, eq, inArray, lt, schema, sql } from "@repo/db";

const { orders, orderItems, productVariants, products } = schema;
export type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/** Cancel pending orders and return their reserved stock. Variants updated in id order (no deadlocks). */
export async function releasePendingOrders(tx: Tx, orderIds: string[]) {
  if (orderIds.length === 0) return;
  // Only orders that are still pending: never restock a paid/cancelled order twice.
  const cancelled = await tx
    .update(orders)
    .set({ status: "cancelled" })
    .where(and(inArray(orders.id, orderIds), eq(orders.status, "pending_payment")))
    .returning({ id: orders.id });
  if (cancelled.length === 0) return;
  const held = await tx
    .select({ variantId: orderItems.variantId, quantity: orderItems.quantity })
    .from(orderItems)
    .where(inArray(orderItems.orderId, cancelled.map((o) => o.id)))
    .orderBy(asc(orderItems.variantId));
  for (const { variantId, quantity } of held) {
    if (!variantId) continue; // variant deleted since; nothing to restore
    await tx
      .update(productVariants)
      .set({ stock: sql`${productVariants.stock} + ${quantity}` })
      .where(eq(productVariants.id, variantId));
  }
}

/**
 * pending_payment → paid, conditionally (safe against admins, shoppers and the M-Pesa callback racing).
 * Idempotent on an already-paid order; refuses cancelled ones. Marks UPCYCLED pieces sold.
 */
export async function markPaid(tx: Tx, orderId: string, payment: { receipt?: string; phone?: string }) {
  const [paid] = await tx
    .update(orders)
    .set({ status: "paid", paidAt: new Date(), mpesaReceiptNumber: payment.receipt, mpesaPhone: payment.phone })
    .where(and(eq(orders.id, orderId), eq(orders.status, "pending_payment")))
    .returning({ id: orders.id, status: orders.status });

  if (!paid) {
    const [current] = await tx.select({ id: orders.id, status: orders.status }).from(orders).where(eq(orders.id, orderId));
    if (!current) throw new TRPCError({ code: "NOT_FOUND" });
    if (current.status !== "pending_payment" && current.status !== "cancelled") return { ...current, alreadyPaid: true };
    throw new TRPCError({
      code: "CONFLICT",
      message: "This order's reservation was released, so it can't be paid. Please return to your bag and order again.",
    });
  }

  const items = await tx.select({ productId: orderItems.productId }).from(orderItems).where(eq(orderItems.orderId, orderId));
  const productIds = items.flatMap((i) => (i.productId ? [i.productId] : []));
  if (productIds.length) {
    await tx
      .update(products)
      .set({ status: "sold", soldAt: new Date() })
      .where(and(inArray(products.id, productIds), eq(products.mode, "UPCYCLED")));
  }
  return { ...paid, alreadyPaid: false };
}

/** Release unpaid reservations older than the cutoff. SKIP LOCKED: never waits on an order being paid right now. */
export async function releaseStaleReservations(tx: Tx, olderThan: Date) {
  const stale = await tx
    .select({ id: orders.id })
    .from(orders)
    .where(and(eq(orders.status, "pending_payment"), lt(orders.createdAt, olderThan)))
    .for("update", { skipLocked: true });
  await releasePendingOrders(tx, stale.map((o) => o.id));
  return stale.length;
}

/** Map Postgres unique violations (23505) to a friendly CONFLICT; rethrow anything else. */
export function rethrowUnique(e: unknown, messages: Record<string, string>): never {
  const pg = (e as { cause?: { code?: string; constraint?: string } })?.cause ?? (e as { code?: string; constraint?: string });
  if (pg?.code === "23505") {
    const key = Object.keys(messages).find((k) => pg.constraint?.includes(k));
    throw new TRPCError({ code: "CONFLICT", message: key ? messages[key]! : "That value is already in use.", cause: e });
  }
  throw e;
}
