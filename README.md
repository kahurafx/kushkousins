# Kush Kousins

Turborepo (pnpm) monorepo.

| Path | What |
|---|---|
| `apps/web` | Next.js 16 (App Router, Tailwind 4); hosts `/api/auth/*` (Better Auth) and `/api/trpc/*` (tRPC) |
| `apps/mobile` | Expo 58 / React Native (expo-router), auth via `@better-auth/expo` |
| `packages/api` | tRPC v11 router shared by web and mobile (public / protected / admin procedures) |
| `packages/db` | Drizzle ORM + Postgres schema (auth + shop tables), migrations in `drizzle/` |
| `packages/auth` | Better Auth server config (`/server`) and web client (`/client`) |
| `packages/types` | Shared zod schemas and TS types |
| `packages/ui` | Design tokens, chamfer geometry, springs, `formatKES` (see DESIGN.md) |
| `packages/typescript-config` | Shared tsconfig |

## Setup
```bash
pnpm install
docker compose up -d                         # Postgres on :54329
cp apps/web/.env.example apps/web/.env.local  # uncomment MOCK_PAYMENTS=true to test checkout locally
cp .env.example packages/db/.env
cp apps/mobile/.env.example apps/mobile/.env # use your LAN IP for a physical device
pnpm db:migrate
pnpm db:seed                                 # sample New + Upcycled catalogue (KES)
pnpm dev
# sign up at the app, then:
pnpm promote-admin you@example.com           # grant ADMIN
```

## Notes
- Schema change: edit `packages/db/src/schema`, then `pnpm db:generate && pnpm db:migrate`.
- After adding Better Auth plugins, regenerate auth tables with `pnpm auth:generate`.
- The mobile URL scheme `kushkousins` (app.json) must match `trustedOrigins` in `packages/auth/src/server.ts`.
