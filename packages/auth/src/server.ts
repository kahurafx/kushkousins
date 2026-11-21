import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { admin } from "better-auth/plugins";
import { expo } from "@better-auth/expo";
import { db, schema } from "@repo/db";
import { ac, roles } from "./permissions";

export const auth = betterAuth({
  database: drizzleAdapter(db, { provider: "pg", schema }),
  emailAndPassword: { enabled: true, minPasswordLength: 8 },
  // "kushkousins" must match the `scheme` in apps/mobile/app.json. The expo() plugin adds "exp://"
  // (Expo Go) in development only, so production doesn't trust it.
  trustedOrigins: ["kushkousins://"],
  plugins: [
    admin({ ac, roles, defaultRole: "CUSTOMER", adminRoles: ["ADMIN"] }),
    expo(),
    nextCookies(), // must be last
  ],
});

export type Auth = typeof auth;
export type Session = typeof auth.$Infer.Session;
export { isAdmin } from "./permissions";
