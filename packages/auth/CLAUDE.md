# packages/auth: Better Auth

- `src/server.ts` is the `auth` instance (drizzle adapter on `@repo/db`, email/password, `expo()` plugin, `nextCookies()`). **`nextCookies()` must stay last** in `plugins`. Server only, mounted by `apps/web/src/app/api/auth/[...all]/route.ts`.
- `src/client.ts` is the **web** React client. The mobile app builds its own client in `apps/mobile/src/lib/auth-client.ts` with `@better-auth/expo/client`.
- `trustedOrigins` must include the mobile scheme `kushkousins://` (from `apps/mobile/app.json`).
- **RBAC (Phase 1):** roles are `CUSTOMER` (default) and `ADMIN`, via Better Auth's `admin` plugin on the server and `adminClient` on the clients. After adding a plugin, run `pnpm auth:generate`, then `pnpm db:generate && pnpm db:migrate`.
- Always check authorization on the server (`auth.api.getSession({ headers })` plus a role check). A client-side check is only UX.
- Env: `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `DATABASE_URL`. Document them in `.env.example` and never read `.env*`.
- Use the `docs` subagent (Better Auth `llms.txt`) before you touch plugin APIs, because they change between minors.
