import { adminClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";
import { ac, roles } from "./permissions";

/** Web client. The mobile app builds its own client with @better-auth/expo/client. */
export const authClient = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
  plugins: [adminClient({ ac, roles })],
});
export const { signIn, signUp, signOut, useSession } = authClient;
