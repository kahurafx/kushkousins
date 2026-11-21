import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createTRPCClient, httpBatchLink } from "@trpc/client";
import { createTRPCContext } from "@trpc/tanstack-react-query";
import { useState } from "react";
import superjson from "superjson";
import type { AppRouter } from "@repo/api"; // type-only: the server router must never reach the bundle
import { authClient } from "./auth-client";
import { API_URL } from "./config";

export const { TRPCProvider, useTRPC } = createTRPCContext<AppRouter>();

export function ApiProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient({ defaultOptions: { queries: { staleTime: 30_000, retry: 1 } } }));
  const [trpcClient] = useState(() =>
    createTRPCClient<AppRouter>({
      links: [
        httpBatchLink({
          url: `${API_URL}/api/trpc`,
          transformer: superjson,
          // A function, so every request sends the *current* session cookie (not the one at startup).
          async headers() {
            const cookie = await authClient.getCookie();
            return cookie ? { cookie } : {};
          },
          // React Native's fetch would add its own cookie jar; Better Auth Expo expects omit.
          fetch: (url, options) => fetch(url, { ...(options as RequestInit), credentials: "omit" }),
        }),
      ],
    }),
  );
  return (
    <QueryClientProvider client={queryClient}>
      <TRPCProvider trpcClient={trpcClient} queryClient={queryClient}>
        {children}
      </TRPCProvider>
    </QueryClientProvider>
  );
}
