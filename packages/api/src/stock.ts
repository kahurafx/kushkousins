import { TRPCError } from "@trpc/server";
import { and, db, eq, inArray, lt, schema, sql, type AnyColumn, type SQL } from "@repo/db";

const { orders, orderItems, payments, productVariants, products } = schema;
export type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/** How long an STK prompt can still be answered. Orders with a younger pending attempt are never released. */
export const PROMPT_WINDOW_MS = 2 * 60_000;

/** Pending attempts younger than PROMPT_WINDOW_MS: the customer may still enter their PIN. */
const livePrompt = (orderId: SQL | AnyColumn) =>
  sql`exists (select 1 from ${payments} where ${payments.orderId} = ${orderId} and ${payments.status} = 'pending' and ${payments.createdAt} > now() - make_interval(secs => ${PROMPT_WINDOW_MS / 1000}))`;

/** Refuse to release orders whose M-Pesa prompt may still be answered: the money would arrive for stock we gave away. */
export async function assertNoLivePrompt(tx: Tx, orderIds: string[]) {
  if (orderIds.length === 0) return;
  const [live] = await tx.select({ id: orders.id }).from(orders).where(and(inArray(orders.id, orderIds), livePrompt(orders.id))).limit(1);
  if (live) {
    throw new TRPCError({ code: "CONFLICT", message: "An M-Pesa prompt for this order is still open on your phone. Finish or dismiss it, then try again in a minute." });
  }
}

/** Mark still-pending orders cancelled and return the stock they held, per variant. Restore it with `restock`. */
export async function cancelPending(tx: Tx, orderIds: string[]) {
  const held = new Map<string, number>();
  if (orderIds.length === 0) return held;
  // Only orders that are still pending: never restock a paid/cancelled order twice.
  const cancelled = await tx
    .update(orders)
    .set({ status: "cancelled" })
    .where(and(inArray(orders.id, orderIds), eq(orders.status, "pending_payment")))
    .returning({ id: orders.id });
  if (cancelled.length === 0) return held;
  const items = await tx
    .select({ variantId: orderItems.variantId, quantity: orderItems.quantity })
    .from(orderItems)
    .where(inArray(orderItems.orderId, cancelled.map((o) => o.id)));
  for (const { variantId, quantity } of items) {
    if (variantId) held.set(variantId, (held.get(variantId) ?? 0) + quantity); // null: variant deleted since
  }
  return held;
}

/** Add stock back, in variant id order (the lock order every writer uses, so no deadlocks). */
export async function restock(tx: Tx, held: Map<string, number>) {
  for (const variantId of [...held.keys()].sort()) {
    await tx
      .update(productVariants)
      .set({ stock: sql`${productVariants.stock} + ${held.get(variantId)!}` })
      .where(eq(productVariants.id, variantId));
  }
}

/** Cancel pending orders and return their reserved stock. */
export async function releasePendingOrders(tx: Tx, orderIds: string[]) {
  await restock(tx, await cancelPending(tx, orderIds));
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

/**
 * Release unpaid reservations older than the cutoff, measured from creation and from the latest payment
 * attempt (a retry restarts the clock). SKIP LOCKED: never waits on an order being paid right now.
 */
export async function releaseStaleReservations(tx: Tx, olderThan: Date, opts: { onlyUnattempted?: boolean } = {}) {
  const stale = await tx
    .select({ id: orders.id })
    .from(orders)
    .where(
      and(
        eq(orders.status, "pending_payment"),
        lt(orders.createdAt, olderThan),
        sql`not exists (select 1 from ${payments} where ${payments.orderId} = ${orders.id} and ${payments.createdAt} >= ${olderThan})`,
        sql`not ${livePrompt(orders.id)}`,
        // Without an STK Query first, an unanswered attempt might be a paid one with a lost callback.
        opts.onlyUnattempted ? sql`not exists (select 1 from ${payments} where ${payments.orderId} = ${orders.id} and ${payments.status} = 'pending')` : undefined,
      ),
    )
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
