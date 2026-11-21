import { auth } from "@repo/auth/server";
import type { Context } from "./trpc";

/** Works for web (cookie) and mobile (cookie header from @better-auth/expo). */
export const createTRPCContext = async ({ headers }: { headers: Headers }): Promise<Context> => ({
  session: await auth.api.getSession({ headers }),
});
