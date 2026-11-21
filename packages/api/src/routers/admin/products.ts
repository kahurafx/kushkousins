import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { and, asc, db, desc, eq, ilike, inArray, ne, or, schema } from "@repo/db";
import { AdminProductCreateSchema, AdminProductUpdateSchema, InventoryModeSchema, ProductStatusSchema } from "@repo/types";
import { rethrowUnique, type Tx } from "../../stock";
import { adminProcedure, router } from "../../trpc";

const { products, productVariants, orders, orderItems, categories } = schema;
const uniqueMessages = {
  products_slug: "Another product already uses that URL slug.",
  product_variants_sku: "That size + colour already exists (its SKU is taken). Use a different combination or edit the existing row.",
};

/** Full slug + size + colour: unlike short codes, can't collide across products. */
const skuFor = (slug: string, size: string, color: string) =>
  `${slug}-${size}-${color}`.toUpperCase().replace(/[^A-Z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 120);

/** Variant ids currently held by an unpaid order. */
async function reservedVariantIds(tx: Tx, variantIds: string[]) {
  if (!variantIds.length) return new Set<string>();
  const rows = await tx
    .select({ id: orderItems.variantId })
    .from(orderItems)
    .innerJoin(orders, eq(orders.id, orderItems.orderId))
    .where(and(eq(orders.status, "pending_payment"), inArray(orderItems.variantId, variantIds)));
  return new Set(rows.flatMap((r) => (r.id ? [r.id] : [])));
}

const productValues = (i: { name: string; slug: string; description: string | null; priceCents: number; discountPercent: number | null; categoryId: string | null; images: string[] }) => ({
  name: i.name,
  slug: i.slug,
  description: i.description || null,
  priceCents: i.priceCents,
  discountPercent: i.discountPercent || null,
  categoryId: i.categoryId,
  images: i.images,
});

export const adminProductsRouter = router({
  list: adminProcedure
    .input(
      z.object({
        q: z.string().trim().max(80).optional(),
        mode: InventoryModeSchema.optional(),
        status: ProductStatusSchema.optional(),
      }),
    )
    .query(({ input }) =>
      db.query.products.findMany({
        where: and(
          input.q ? or(ilike(products.name, `%${input.q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`), ilike(products.slug, `%${input.q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`)) : undefined,
          input.mode ? eq(products.mode, input.mode) : undefined,
          input.status ? eq(products.status, input.status) : undefined,
        ),
        with: { variants: { orderBy: [asc(productVariants.size)] }, category: true },
        orderBy: [desc(products.updatedAt)],
      }),
    ),

  byId: adminProcedure.input(z.object({ id: z.string().uuid() })).query(async ({ input }) => {
    const product = await db.query.products.findFirst({ where: eq(products.id, input.id), with: { variants: true } });
    if (!product) throw new TRPCError({ code: "NOT_FOUND" });
    const reserved = await reservedVariantIds(db as unknown as Tx, product.variants.map((v) => v.id));
    return { ...product, reservedVariantIds: [...reserved] };
  }),

  categories: adminProcedure.query(() => db.select().from(categories).orderBy(asc(categories.name))),

  create: adminProcedure.input(AdminProductCreateSchema).mutation(({ input }) =>
    db
      .transaction(async (tx) => {
        const [product] = await tx
          .insert(products)
          .values({
            ...productValues(input),
            mode: input.mode,
            originalMaterial: input.mode === "UPCYCLED" ? input.originalMaterial : null,
            artisanNotes: input.mode === "UPCYCLED" ? input.artisanNotes : null,
          })
          .returning({ id: products.id, slug: products.slug });
        const variants =
          input.mode === "NEW"
            ? input.variants.map((v) => ({ ...v, sku: skuFor(input.slug, v.size, v.color) }))
            : [{ size: input.size, color: input.color, stock: 1, sku: skuFor(input.slug, input.size, input.color) }];
        await tx.insert(productVariants).values(variants.map((v) => ({ ...v, productId: product!.id })));
        return product!;
      })
      .catch((e) => rethrowUnique(e, uniqueMessages)),
  ),

  update: adminProcedure.input(AdminProductUpdateSchema).mutation(({ input }) =>
    db
      .transaction(async (tx) => {
        const [current] = await tx.select().from(products).where(eq(products.id, input.id)).for("update");
        if (!current) throw new TRPCError({ code: "NOT_FOUND" });
        if (current.mode !== input.mode) throw new TRPCError({ code: "BAD_REQUEST", message: "Inventory mode can't change after creation." });

        await tx
          .update(products)
          .set({
            ...productValues(input),
            originalMaterial: input.mode === "UPCYCLED" ? input.originalMaterial : null,
            artisanNotes: input.mode === "UPCYCLED" ? input.artisanNotes : null,
          })
          .where(eq(products.id, input.id));

        const existing = await tx.select().from(productVariants).where(eq(productVariants.productId, input.id));

        if (input.mode === "UPCYCLED") {
          // The single variant keeps its id and stock; only its labels change.
          const [only] = existing;
          if (only) await tx.update(productVariants).set({ size: input.size, color: input.color }).where(eq(productVariants.id, only.id));
          return { id: input.id };
        }

        const keep = new Set(input.variants.flatMap((v) => (v.id ? [v.id] : [])));
        const foreign = [...keep].filter((id) => !existing.some((e) => e.id === id));
        if (foreign.length) throw new TRPCError({ code: "BAD_REQUEST", message: "A variant doesn't belong to this product." });

        // Removing: refuse while an unpaid order holds it (carts and reservations reference the id).
        const removed = existing.filter((e) => !keep.has(e.id));
        const held = await reservedVariantIds(tx, removed.map((r) => r.id));
        if (held.size) {
          const v = removed.find((r) => held.has(r.id))!;
          throw new TRPCError({ code: "CONFLICT", message: `${v.size} / ${v.color} is reserved by an unpaid order. Set its stock to 0 instead.` });
        }
        if (removed.length) await tx.delete(productVariants).where(inArray(productVariants.id, removed.map((r) => r.id)));

        for (const v of [...input.variants].sort((a, b) => (a.id ?? "").localeCompare(b.id ?? ""))) {
          if (!v.id) {
            await tx.insert(productVariants).values({ productId: input.id, size: v.size, color: v.color, stock: v.stock, sku: skuFor(input.slug, v.size, v.color) });
            continue;
          }
          const before = existing.find((e) => e.id === v.id)!;
          const labelsChanged = before.size !== v.size || before.color !== v.color;
          const stockChanged = v.expectedStock !== undefined && v.stock !== v.expectedStock;
          if (!labelsChanged && !stockChanged) continue;
          // Compare-and-set: only overwrite stock if nobody reserved/released since the editor loaded it.
          const [row] = await tx
            .update(productVariants)
            .set({ size: v.size, color: v.color, ...(stockChanged ? { stock: v.stock } : {}) })
            .where(and(eq(productVariants.id, v.id), stockChanged ? eq(productVariants.stock, v.expectedStock!) : undefined))
            .returning({ id: productVariants.id });
          if (!row) {
            throw new TRPCError({ code: "CONFLICT", message: `Stock for ${v.size} / ${v.color} changed while you were editing (an order came in). Reload and try again.` });
          }
        }
        return { id: input.id };
      })
      .catch((e) => rethrowUnique(e, uniqueMessages)),
  ),

  /**
   * active | archived for any product; sold ↔ active for UPCYCLED (sets stock 0/1 in the same tx).
   * "Mark available" is refused while an unpaid order holds the piece.
   */
  setStatus: adminProcedure
    .input(z.object({ id: z.string().uuid(), status: ProductStatusSchema }))
    .mutation(({ input }) =>
      db.transaction(async (tx) => {
        const [p] = await tx.select().from(products).where(eq(products.id, input.id)).for("update");
        if (!p) throw new TRPCError({ code: "NOT_FOUND" });
        if (p.status === input.status) return { id: p.id, status: p.status };
        if (input.status === "sold" && p.mode !== "UPCYCLED") throw new TRPCError({ code: "BAD_REQUEST", message: "Only 1-of-1 pieces can be marked sold." });

        const variants = await tx.select().from(productVariants).where(eq(productVariants.productId, p.id));
        if (p.mode === "UPCYCLED" && input.status === "active" && p.status === "sold") {
          if ((await reservedVariantIds(tx, variants.map((v) => v.id))).size) {
            throw new TRPCError({ code: "CONFLICT", message: "This piece is reserved by an unpaid order; it can't be made available again." });
          }
          await tx.update(productVariants).set({ stock: 1 }).where(eq(productVariants.productId, p.id));
        }
        if (input.status === "sold") await tx.update(productVariants).set({ stock: 0 }).where(eq(productVariants.productId, p.id));

        const [row] = await tx
          .update(products)
          .set({ status: input.status, soldAt: input.status === "sold" ? new Date() : input.status === "active" ? null : p.soldAt })
          .where(and(eq(products.id, p.id), ne(products.status, input.status)))
          .returning({ id: products.id, status: products.status });
        return row!;
      }),
    ),
});
