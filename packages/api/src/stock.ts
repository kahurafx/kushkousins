import { and, asc, db, eq, inArray, schema, sql } from "@repo/db";

const { orders, orderItems, productVariants } = schema;
export type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/** Cancel pending orders and return their reserved stock. Variants updated in id order (no deadlocks). */
export async function releasePendingOrders(tx: Tx, orderIds: string[]) {
  if (orderIds.length === 0) return;
  const held = await tx
    .select({ variantId: orderItems.variantId, quantity: orderItems.quantity })
    .from(orderItems)
    .where(inArray(orderItems.orderId, orderIds))
    .orderBy(asc(orderItems.variantId));
  for (const { variantId, quantity } of held) {
    if (!variantId) continue; // variant deleted since; nothing to restore
    await tx
      .update(productVariants)
      .set({ stock: sql`${productVariants.stock} + ${quantity}` })
      .where(eq(productVariants.id, variantId));
  }
  await tx
    .update(orders)
    .set({ status: "cancelled" })
    .where(and(inArray(orders.id, orderIds), eq(orders.status, "pending_payment")));
}
