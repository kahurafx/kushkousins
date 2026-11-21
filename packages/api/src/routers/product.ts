import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { and, asc, db, desc, eq, isNotNull, ne, schema } from "@repo/db";
import { InventoryModeSchema } from "@repo/types";
import { publicProcedure, router } from "../trpc";

const { products, categories } = schema;

export const productRouter = router({
  // Sold 1-of-1s stay listed (DESIGN.md: visible SOLD state); archived never shows.
  list: publicProcedure
    .input(
      z.object({
        mode: InventoryModeSchema.optional(),
        categorySlug: z.string().optional(),
        limit: z.number().int().min(1).max(100).default(24),
        offset: z.number().int().min(0).default(0),
      }),
    )
    .query(async ({ input }) => {
      const category = input.categorySlug
        ? await db.query.categories.findFirst({ where: eq(categories.slug, input.categorySlug) })
        : undefined;
      if (input.categorySlug && !category) return [];
      return db.query.products.findMany({
        where: and(
          ne(products.status, "archived"),
          input.mode ? eq(products.mode, input.mode) : undefined,
          category ? eq(products.categoryId, category.id) : undefined,
        ),
        with: { variants: true, category: true },
        orderBy: [desc(products.createdAt)],
        limit: input.limit,
        offset: input.offset,
      });
    }),

  bySlug: publicProcedure.input(z.object({ slug: z.string() })).query(async ({ input }) => {
    const product = await db.query.products.findFirst({
      where: and(eq(products.slug, input.slug), ne(products.status, "archived")),
      with: { variants: true, category: true },
    });
    if (!product) throw new TRPCError({ code: "NOT_FOUND" });
    return product;
  }),

  hangingLine: publicProcedure.query(() =>
    db.query.products.findMany({
      where: and(ne(products.status, "archived"), isNotNull(products.hangingLinePosition)),
      with: { variants: true },
      orderBy: [asc(products.hangingLinePosition)],
    }),
  ),

  fanFavorites: publicProcedure.query(() =>
    db.query.products.findMany({
      where: and(ne(products.status, "archived"), isNotNull(products.fanFavoritePosition)),
      with: { variants: true, category: true },
      orderBy: [asc(products.fanFavoritePosition)],
    }),
  ),
});
