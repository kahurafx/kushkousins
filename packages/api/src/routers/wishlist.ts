import { z } from "zod";
import { and, db, desc, eq, ne, schema } from "@repo/db";
import { protectedProcedure, router } from "../trpc";

const { wishlistItems, products } = schema;

export const wishlistRouter = router({
  ids: protectedProcedure.query(async ({ ctx }) =>
    (await db.select({ id: wishlistItems.productId }).from(wishlistItems).where(eq(wishlistItems.userId, ctx.session.user.id))).map((r) => r.id),
  ),

  list: protectedProcedure.query(async ({ ctx }) => {
    const rows = await db.query.wishlistItems.findMany({
      where: eq(wishlistItems.userId, ctx.session.user.id),
      with: { product: { with: { variants: true } } },
      orderBy: [desc(wishlistItems.createdAt)],
    });
    return rows.map((r) => r.product).filter((p) => p.status !== "archived");
  }),

  /** Adds if absent, removes if present. Returns the new state. */
  toggle: protectedProcedure.input(z.object({ productId: z.string().uuid() })).mutation(async ({ ctx, input }) => {
    const userId = ctx.session.user.id;
    const exists = await db.query.products.findFirst({ where: and(eq(products.id, input.productId), ne(products.status, "archived")), columns: { id: true } });
    const removed = await db
      .delete(wishlistItems)
      .where(and(eq(wishlistItems.userId, userId), eq(wishlistItems.productId, input.productId)))
      .returning({ id: wishlistItems.productId });
    if (removed.length || !exists) return { saved: false };
    await db.insert(wishlistItems).values({ userId, productId: input.productId }).onConflictDoNothing();
    return { saved: true };
  }),
});
