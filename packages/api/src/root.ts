import type { inferRouterInputs, inferRouterOutputs } from "@trpc/server";
import { addressRouter } from "./routers/address";
import { adminRouter } from "./routers/admin";
import { cartRouter } from "./routers/cart";
import { orderRouter } from "./routers/order";
import { productRouter } from "./routers/product";
import { wishlistRouter } from "./routers/wishlist";
import { router } from "./trpc";

export const appRouter = router({
  product: productRouter,
  cart: cartRouter,
  order: orderRouter,
  address: addressRouter,
  wishlist: wishlistRouter,
  admin: adminRouter,
});

export type AppRouter = typeof appRouter;
export type RouterInputs = inferRouterInputs<AppRouter>;
export type RouterOutputs = inferRouterOutputs<AppRouter>;
