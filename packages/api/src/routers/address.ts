import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { and, db, desc, eq, schema } from "@repo/db";
import { AddressSchema } from "@repo/types";
import type { Tx } from "../stock";
import { protectedProcedure, router } from "../trpc";

const { addresses } = schema;
const Id = z.object({ id: z.string().uuid() });
const clearDefaults = (tx: Tx, userId: string) =>
  tx.update(addresses).set({ isDefault: false }).where(and(eq(addresses.userId, userId), eq(addresses.isDefault, true)));

export const addressRouter = router({
  list: protectedProcedure.query(({ ctx }) =>
    db.query.addresses.findMany({
      where: eq(addresses.userId, ctx.session.user.id),
      orderBy: [desc(addresses.isDefault), desc(addresses.createdAt)],
    }),
  ),

  create: protectedProcedure
    .input(AddressSchema.extend({ isDefault: z.boolean().default(false) }))
    .mutation(({ ctx, input }) =>
      db.transaction(async (tx) => {
        const userId = ctx.session.user.id;
        const isFirst = !(await tx.query.addresses.findFirst({ where: eq(addresses.userId, userId) }));
        const isDefault = input.isDefault || isFirst;
        if (isDefault) await clearDefaults(tx, userId);
        const [row] = await tx.insert(addresses).values({ ...input, userId, isDefault }).returning();
        return row!;
      }),
    ),

  update: protectedProcedure.input(AddressSchema.extend(Id.shape)).mutation(async ({ ctx, input }) => {
    const { id, ...values } = input;
    const [row] = await db
      .update(addresses)
      .set(values)
      .where(and(eq(addresses.id, id), eq(addresses.userId, ctx.session.user.id)))
      .returning();
    if (!row) throw new TRPCError({ code: "NOT_FOUND" });
    return row;
  }),

  setDefault: protectedProcedure.input(Id).mutation(({ ctx, input }) =>
    db.transaction(async (tx) => {
      await clearDefaults(tx, ctx.session.user.id);
      const [row] = await tx
        .update(addresses)
        .set({ isDefault: true })
        .where(and(eq(addresses.id, input.id), eq(addresses.userId, ctx.session.user.id)))
        .returning();
      if (!row) throw new TRPCError({ code: "NOT_FOUND" }); // rolls back the cleared defaults
      return row;
    }),
  ),

  /** Removing the default promotes the newest remaining address, so checkout always has one. */
  remove: protectedProcedure.input(Id).mutation(({ ctx, input }) =>
    db.transaction(async (tx) => {
      const userId = ctx.session.user.id;
      const [row] = await tx
        .delete(addresses)
        .where(and(eq(addresses.id, input.id), eq(addresses.userId, userId)))
        .returning({ id: addresses.id, isDefault: addresses.isDefault });
      if (!row) throw new TRPCError({ code: "NOT_FOUND" });
      if (row.isDefault) {
        const next = await tx.query.addresses.findFirst({ where: eq(addresses.userId, userId), orderBy: [desc(addresses.createdAt)] });
        if (next) await tx.update(addresses).set({ isDefault: true }).where(eq(addresses.id, next.id));
      }
      return { id: row.id };
    }),
  ),
});
