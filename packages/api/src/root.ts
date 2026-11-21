import type { inferRouterInputs, inferRouterOutputs } from "@trpc/server";
import { adminRouter } from "./routers/admin";
import { cartRouter } from "./routers/cart";
import { orderRouter } from "./routers/order";
import { productRouter } from "./routers/product";
import { router } from "./trpc";

export const appRouter = router({
  product: productRouter,
  cart: cartRouter,
  order: orderRouter,
  admin: adminRouter,
});

export type AppRouter = typeof appRouter;
export type RouterInputs = inferRouterInputs<AppRouter>;
export type RouterOutputs = inferRouterOutputs<AppRouter>;
