import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import { ZodError, z } from "zod";
import { isAdmin } from "@repo/auth/permissions";
import type { Session } from "@repo/auth/server";

export type Context = { session: Session | null };

const t = initTRPC.context<Context>().create({
  transformer: superjson,
  errorFormatter: ({ shape, error }) => ({
    ...shape,
    data: { ...shape.data, zodError: error.cause instanceof ZodError ? z.flattenError(error.cause) : null },
  }),
});

export const router = t.router;
export const createCallerFactory = t.createCallerFactory;

export const publicProcedure = t.procedure;

export const protectedProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.session) throw new TRPCError({ code: "UNAUTHORIZED" });
  return next({ ctx: { session: ctx.session } });
});

export const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (!isAdmin(ctx.session.user)) throw new TRPCError({ code: "FORBIDDEN" });
  return next();
});
