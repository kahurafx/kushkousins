# Kush Kousins

Turborepo (pnpm) monorepo.

| Path | What |
|---|---|
| `apps/web` | Next.js 16 (App Router, Tailwind 4); hosts the Better Auth route at `/api/auth/*` |
| `apps/mobile` | Expo 58 / React Native (expo-router), auth via `@better-auth/expo` |
| `packages/db` | Drizzle ORM + Postgres schema (auth + shop tables), migrations in `drizzle/` |
| `packages/auth` | Better Auth server config (`/server`) and web client (`/client`) |
| `packages/types` | Shared zod schemas and TS types |
| `packages/typescript-config` | Shared tsconfig |

## Setup
```bash
pnpm install
docker compose up -d                         # Postgres on :5432
cp .env.example apps/web/.env.local          # add NEXT_PUBLIC_APP_URL=http://localhost:3000
cp .env.example packages/db/.env
cp apps/mobile/.env.example apps/mobile/.env # use your LAN IP for a physical device
pnpm --filter @repo/db db:migrate
pnpm dev
```

## Notes
- Schema change: edit `packages/db/src/schema`, then `pnpm db:generate && pnpm db:migrate`.
- After adding Better Auth plugins, regenerate auth tables with `pnpm auth:generate`.
- The mobile URL scheme `kushkousins` (app.json) must match `trustedOrigins` in `packages/auth/src/server.ts`.
