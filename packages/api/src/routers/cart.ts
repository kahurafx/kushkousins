import { z } from "zod";
import { and, db, eq, inArray, schema, sql } from "@repo/db";
import { CartItemSchema, salePriceCents, shippingCents } from "@repo/types";
import { publicProcedure, router } from "../trpc";

const { products, productVariants, orders, orderItems } = schema;

export const cartRouter = router({
  /** Current price + availability for a client-side cart. Never trust prices sent by the client. */
  validate: publicProcedure
    .input(z.object({ items: z.array(CartItemSchema).max(50) }))
    .query(async ({ ctx, input }) => {
      const ids = [...new Set(input.items.map((i) => i.variantId))];
      if (ids.length === 0) return { lines: [], subtotalCents: 0, shippingCents: 0, totalCents: 0 };

      const rows = await db
        .select({ variant: productVariants, product: products })
        .from(productVariants)
        .innerJoin(products, eq(products.id, productVariants.productId))
        .where(inArray(productVariants.id, ids));

      // Stock the caller already holds in their own pending order counts as available to them.
      const held = new Map<string, number>();
      if (ctx.session) {
        const mine = await db
          .select({ variantId: orderItems.variantId, quantity: sql<number>`sum(${orderItems.quantity})::int` })
          .from(orderItems)
          .innerJoin(orders, eq(orders.id, orderItems.orderId))
          .where(and(eq(orders.userId, ctx.session.user.id), eq(orders.status, "pending_payment")))
          .groupBy(orderItems.variantId);
        for (const m of mine) if (m.variantId) held.set(m.variantId, m.quantity);
      }

      const byId = new Map(rows.map((r) => [r.variant.id, r]));
      const lines = input.items.map(({ variantId, quantity }) => {
        const row = byId.get(variantId);
        if (!row) return { variantId, requested: quantity, quantity: 0, available: 0, status: "missing" as const, item: null };
        const { variant, product } = row;
        const available = product.status === "active" ? variant.stock + (held.get(variantId) ?? 0) : 0;
        return {
          variantId,
          requested: quantity,
          quantity: Math.min(quantity, available),
          available,
          status: product.status === "sold" ? ("sold" as const) : available === 0 ? ("unavailable" as const) : available < quantity ? ("limited" as const) : ("ok" as const),
          item: {
            productId: product.id,
            slug: product.slug,
            name: product.name,
            mode: product.mode,
            size: variant.size,
            color: variant.color,
            image: product.images[0] ?? null,
            priceCents: product.priceCents,
            discountPercent: product.discountPercent,
            salePriceCents: salePriceCents(product),
          },
        };
      });
      const subtotalCents = lines.reduce((sum, l) => sum + (l.item ? l.item.salePriceCents * l.quantity : 0), 0);
      const shipping = shippingCents(subtotalCents);
      return { lines, subtotalCents, shippingCents: shipping, totalCents: subtotalCents + shipping };
    }),
});
