# packages/auth: Better Auth

- `src/server.ts` is the `auth` instance: drizzle adapter on `@repo/db`, email/password (min 8), `admin()`, `expo()`, `nextCookies()`.
  - **`nextCookies()` must stay last** in `plugins`.
  - It is server only, mounted by `apps/web/src/app/api/auth/[...all]/route.ts`, and read by tRPC's `createTRPCContext`.
- `src/permissions.ts` holds `ac`, `roles` (`CUSTOMER`, `ADMIN`) and `isAdmin(user)`. It is shared by `admin({ ac, roles })` on the server and `adminClient({ ac, roles })` on the clients, so keep them in sync through this file.
- `src/client.ts` is the **web** React client (with `adminClient`). The mobile app builds its own client in `apps/mobile/src/lib/auth-client.ts`; add `adminClient({ ac, roles })` there only if mobile needs admin calls.
- **RBAC:**
  - `defaultRole: "CUSTOMER"`, `adminRoles: ["ADMIN"]`.
  - `role` has `input: false`, so sign-up can't set it (verified: it returns 400).
  - Make the first admin with `pnpm promote-admin <email>` after signing up.
  - Enforce in tRPC `adminProcedure` / server code, never only on the client.
- `trustedOrigins` is `["kushkousins://"]` (the mobile scheme in `apps/mobile/app.json`). **Don't add `exp://` by hand**: the `expo()` plugin adds it in development only (Expo Go), so production doesn't trust it. Native requests send `expo-origin`, which the plugin copies into `origin`.
- After adding a plugin: `pnpm auth:generate` (CLI `auth@1.7.27`, devDependency), then `pnpm db:generate && pnpm db:migrate`.
- Env: `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `DATABASE_URL`. Document them in `.env.example` and never read `.env*`.
- Use the `docs` subagent (Better Auth `llms.txt`) before you touch plugin APIs, because they change between minors.
