import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { and, asc, db, desc, eq, exists, ilike, inArray, isNotNull, ne, schema, sql } from "@repo/db";
import { compareSizes, InventoryModeSchema, SimilarProductsInputSchema } from "@repo/types";
import { publicProcedure, router } from "../trpc";

const { products, categories, productVariants } = schema;

// Must equal salePriceCents() in @repo/types: whole shillings, half rounds up (numeric round, positives only).
const salePriceSql = sql<number>`(round(${products.priceCents} * (100 - coalesce(${products.discountPercent}, 0)) / 10000.0) * 100)::int`;

export const ProductListInput = z.object({
  mode: InventoryModeSchema.optional(),
  categorySlug: z.string().optional(),
  q: z.string().trim().max(80).optional(),
  sizes: z.array(z.string().max(20)).max(20).optional(),
  colors: z.array(z.string().max(40)).max(20).optional(),
  minPriceCents: z.number().int().nonnegative().optional(),
  maxPriceCents: z.number().int().nonnegative().optional(),
  sort: z.enum(["newest", "price_asc", "price_desc"]).default("newest"),
  limit: z.number().int().min(1).max(100).default(48),
  offset: z.number().int().min(0).default(0),
});

const listed = ne(products.status, "archived"); // Sold 1-of-1s stay listed (DESIGN.md: visible SOLD state).

export const productRouter = router({
  list: publicProcedure.input(ProductListInput).query(async ({ input }) => {
    const category = input.categorySlug
      ? await db.query.categories.findFirst({ where: eq(categories.slug, input.categorySlug) })
      : undefined;
    if (input.categorySlug && !category) return [];

    const variantMatch = (col: typeof productVariants.size | typeof productVariants.color, values?: string[]) =>
      values?.length
        ? exists(
            db
              .select({ one: sql`1` })
              .from(productVariants)
              .where(and(eq(productVariants.productId, products.id), inArray(col, values))),
          )
        : undefined;

    const escapeLike = (s: string) => s.replace(/[\\%_]/g, (c) => `\\${c}`);
    return db.query.products.findMany({
      where: and(
        listed,
        input.mode ? eq(products.mode, input.mode) : undefined,
        category ? eq(products.categoryId, category.id) : undefined,
        input.q ? ilike(products.name, `%${escapeLike(input.q)}%`) : undefined,
        variantMatch(productVariants.size, input.sizes),
        variantMatch(productVariants.color, input.colors),
        input.minPriceCents !== undefined ? sql`${salePriceSql} >= ${input.minPriceCents}` : undefined,
        input.maxPriceCents !== undefined ? sql`${salePriceSql} <= ${input.maxPriceCents}` : undefined,
      ),
      with: { variants: true, category: true },
      orderBy:
        input.sort === "price_asc"
          ? [asc(salePriceSql), asc(products.name)]
          : input.sort === "price_desc"
            ? [desc(salePriceSql), asc(products.name)]
            : [desc(products.createdAt), asc(products.name)],
      limit: input.limit,
      offset: input.offset,
    });
  }),

  /** Filter options: every size/colour on a listed product, plus categories and the sale-price range. */
  facets: publicProcedure.query(async () => {
    const [variants, cats, [range]] = await Promise.all([
      db
        .selectDistinct({ size: productVariants.size, color: productVariants.color })
        .from(productVariants)
        .innerJoin(products, eq(products.id, productVariants.productId))
        .where(listed),
      db.select().from(categories).orderBy(asc(categories.name)),
      db
        .select({ min: sql<number>`coalesce(min(${salePriceSql}), 0)::int`, max: sql<number>`coalesce(max(${salePriceSql}), 0)::int` })
        .from(products)
        .where(listed),
    ]);
    return {
      sizes: [...new Set(variants.map((v) => v.size))].sort(compareSizes),
      colors: [...new Set(variants.map((v) => v.color))].sort(),
      categories: cats,
      priceRange: range!,
    };
  }),

  bySlug: publicProcedure.input(z.object({ slug: z.string().max(200) })).query(async ({ input }) => {
    const product = await db.query.products.findFirst({
      where: and(eq(products.slug, input.slug), listed),
      with: { variants: { orderBy: [asc(productVariants.size), asc(productVariants.color)] }, category: true },
    });
    if (!product) throw new TRPCError({ code: "NOT_FOUND" });
    return product;
  }),

  /**
   * "Similar products" rail: same category first, then same mode, then nearest sale price.
   * Unlike listings it leaves out sold pieces: a sold 1-of-1 is a dead end in a recommendation.
   */
  similar: publicProcedure.input(SimilarProductsInputSchema).query(async ({ input }) => {
    const target = await db.query.products.findFirst({ where: and(eq(products.id, input.productId), listed) });
    if (!target) return []; // A missing rail must never fail the page.
    const targetPrice = Math.round((target.priceCents * (100 - (target.discountPercent ?? 0))) / 10000) * 100;
    return db.query.products.findMany({
      where: and(listed, ne(products.status, "sold"), ne(products.id, target.id)),
      with: { variants: true, category: true },
      orderBy: [
        // coalesce: `=` is NULL for uncategorised rows, and DESC would sort NULLs first.
        ...(target.categoryId ? [desc(sql`coalesce(${products.categoryId} = ${target.categoryId}, false)`)] : []),
        desc(sql`(${products.mode} = ${target.mode})`),
        asc(sql`abs(${salePriceSql} - ${targetPrice})`),
        asc(products.name),
      ],
      limit: input.limit,
    });
  }),

  hangingLine: publicProcedure.query(() =>
    db.query.products.findMany({
      where: and(listed, isNotNull(products.hangingLinePosition)),
      with: { variants: true, category: true },
      orderBy: [asc(products.hangingLinePosition)],
    }),
  ),

  fanFavorites: publicProcedure.query(() =>
    db.query.products.findMany({
      where: and(listed, isNotNull(products.fanFavoritePosition)),
      with: { variants: true, category: true },
      orderBy: [asc(products.fanFavoritePosition)],
    }),
  ),
});
