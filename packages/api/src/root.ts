import type { inferRouterInputs, inferRouterOutputs } from "@trpc/server";
import { adminRouter } from "./routers/admin";
import { productRouter } from "./routers/product";
import { router } from "./trpc";

export const appRouter = router({
  product: productRouter,
  admin: adminRouter,
});

export type AppRouter = typeof appRouter;
export type RouterInputs = inferRouterInputs<AppRouter>;
export type RouterOutputs = inferRouterOutputs<AppRouter>;
