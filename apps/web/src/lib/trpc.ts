import { createTRPCContext } from "@trpc/tanstack-react-query";
import type { AppRouter } from "@repo/api"; // type-only: never bundle the server router

export const { TRPCProvider, useTRPC } = createTRPCContext<AppRouter>();
