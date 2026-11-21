import "server-only";
import { headers } from "next/headers";
import { appRouter, createTRPCContext } from "@repo/api";

/** Public procedures only: no session lookup. */
export const publicCaller = () => appRouter.createCaller({ session: null });

/** Caller bound to the current request's Better Auth session. */
export const sessionCaller = async () => appRouter.createCaller(await createTRPCContext({ headers: await headers() }));
