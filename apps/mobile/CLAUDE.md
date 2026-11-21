@AGENTS.md

# apps/mobile: native app (Expo 58 + Expo Router)

A native translation of the storefront, not a webview. Read [../../packages/ui/DESIGN.md](../../packages/ui/DESIGN.md) first. Import tokens (`colors`, `type`, `spring`, `chamfer`, `chamferPath`, `formatKES`) from `@repo/ui`.

## Structure
- Routes live in `src/app/`. The tab bar is **Home, Shop, Upcycled, Bag, Profile**.
- `src/lib/auth-client.ts` is the Better Auth client (`@better-auth/expo/client`, tokens in `expo-secure-store`, scheme `kushkousins`). The scheme must match `app.json` → `scheme` and `trustedOrigins` in `packages/auth/src/server.ts`.
- The API base URL is `EXPO_PUBLIC_API_URL` (the Next.js server). On a physical device, use the machine's LAN IP. See `.env.example`.
- The template files in `src/components` and `src/hooks` are placeholders; replace them in Phase 5.
- **Known pre-existing `check-types` failures** (from the Expo template, not regressions): `animated-icon.web.tsx` (CSS module import), `app-tabs.web.tsx` (ref type), and `constants/theme.ts` (`@/global.css` import). They go away when the template files are replaced in Phase 5.
- `@repo/ui` is not yet a dependency here. Add `"@repo/ui": "workspace:*"` when Phase 5 starts.

## UI spec
- **Hanging Line:** a horizontal gesture carousel (Gesture Handler + Reanimated). It tracks 1:1, projects momentum, snaps to centre, hands off velocity to `spring.flick`, scales up the centred garment and reveals its card, with an `expo-haptics` light impact on snap. It rubber-bands at the ends.
- **Grid:** 2-column staggered grid of chamfered cards. The chamfer is an SVG mask from `chamferPath`, because RN has no `clip-path`. Quick-add bag button bottom-right.
- **Styling:** NativeWind (to be set up in Phase 5; map its theme to `@repo/ui` tokens) and Reanimated for motion. Respect `useReducedMotion()` from Reanimated.

## Rules
- Install with `pnpm exec expo install <pkg>`, never a plain `pnpm add`, so versions match the SDK.
- Mobile talks to the web app's API only. It never imports `@repo/db` or `@repo/auth/server`.
- Before you call a task done, run `pnpm --filter @repo/mobile check-types` and `pnpm exec expo lint`.
