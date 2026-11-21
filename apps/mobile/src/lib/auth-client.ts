import { expoClient } from "@better-auth/expo/client";
import { createAuthClient } from "better-auth/react";
import * as SecureStore from "expo-secure-store";
import { API_URL } from "./config";

// Mobile's own client: never import @repo/auth/client (that's the web one).
export const authClient = createAuthClient({
  baseURL: API_URL,
  plugins: [expoClient({ scheme: "kushkousins", storagePrefix: "kushkousins", storage: SecureStore })],
});
export const { useSession } = authClient;
