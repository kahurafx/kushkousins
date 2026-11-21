import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { and, asc, db, eq, inArray, isNotNull, ne, schema } from "@repo/db";
import type { Tx } from "../../stock";
import { adminProcedure, router } from "../../trpc";

const { products } = schema;
const Ids = z.array(z.string().uuid()).max(24).refine((a) => new Set(a).size === a.length, "Duplicate product");

async function assertListable(tx: Tx, ids: string[]) {
  if (!ids.length) return;
  const found = await tx.select({ id: products.id }).from(products).where(and(inArray(products.id, ids), ne(products.status, "archived")));
  if (found.length !== ids.length) throw new TRPCError({ code: "BAD_REQUEST", message: "Some products no longer exist or are archived." });
}

export const adminCurationRouter = router({
  get: adminProcedure.query(async () => {
    const all = await db.query.products.findMany({
      where: ne(products.status, "archived"),
      columns: { id: true, name: true, slug: true, mode: true, status: true, priceCents: true, discountPercent: true, featured: true, hangingLinePosition: true, fanFavoritePosition: true, images: true },
      with: { variants: { columns: { color: true, stock: true }, limit: 1 } },
      orderBy: [asc(products.name)],
    });
    const byPos = (k: "hangingLinePosition" | "fanFavoritePosition") =>
      all.filter((p) => p[k] !== null).sort((a, b) => a[k]! - b[k]!);
    return { products: all, hangingLine: byPos("hangingLinePosition").map((p) => p.id), fanFavorites: byPos("fanFavoritePosition").map((p) => p.id) };
  }),

  /** Ordered ids become positions 1..n; everything else leaves the rack, in one transaction. */
  setHangingLine: adminProcedure.input(z.object({ ids: Ids })).mutation(({ input }) =>
    db.transaction(async (tx) => {
      await assertListable(tx, input.ids);
      await tx.update(products).set({ hangingLinePosition: null }).where(isNotNull(products.hangingLinePosition));
      for (const [i, id] of input.ids.entries()) await tx.update(products).set({ hangingLinePosition: i + 1 }).where(eq(products.id, id));
      return { count: input.ids.length };
    }),
  ),

  /**
   * Ordered favourites with their discount (stored on the product, so it applies site-wide) and the
   * editor's-pick star. Products leaving the list keep their discount; the star is managed here only.
   */
  setFanFavorites: adminProcedure
    .input(
      z.object({
        items: z
          .array(z.object({ id: z.string().uuid(), discountPercent: z.number().int().min(0).max(90).nullable(), featured: z.boolean() }))
          .max(24)
          .refine((a) => new Set(a.map((i) => i.id)).size === a.length, "Duplicate product"),
      }),
    )
    .mutation(({ input }) =>
      db.transaction(async (tx) => {
        await assertListable(tx, input.items.map((i) => i.id));
        await tx.update(products).set({ fanFavoritePosition: null, featured: false }).where(isNotNull(products.fanFavoritePosition));
        await tx.update(products).set({ featured: false }).where(eq(products.featured, true));
        for (const [i, item] of input.items.entries()) {
          await tx
            .update(products)
            .set({ fanFavoritePosition: i + 1, discountPercent: item.discountPercent || null, featured: item.featured })
            .where(eq(products.id, item.id));
        }
        return { count: input.items.length };
      }),
    ),
});
