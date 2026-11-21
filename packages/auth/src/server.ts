import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { expo } from "@better-auth/expo";
import { db, schema } from "@repo/db";

export const auth = betterAuth({
  database: drizzleAdapter(db, { provider: "pg", schema }),
  emailAndPassword: { enabled: true },
  // "kushkousins" must match the `scheme` in apps/mobile/app.json
  trustedOrigins: ["kushkousins://", "exp://"],
  // nextCookies must be last
  plugins: [expo(), nextCookies()],
});

export type Auth = typeof auth;
