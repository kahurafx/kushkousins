@AGENTS.md

# apps/mobile: native app (Expo 58 + Expo Router)

A native translation of the storefront, not a webview. Read [../../packages/ui/DESIGN.md](../../packages/ui/DESIGN.md) first. Tokens, chamfer geometry, garment silhouettes, `snapIndex` and `formatKES` come from `@repo/ui`; domain rules (`availabilityOf`, `salePriceCents`, `compareSizes`, schemas) from `@repo/types`.

## Structure
- `src/app/_layout.tsx`: fonts (splash held until loaded), `ApiProvider`, gesture root, Stack.
- `src/app/(tabs)/`: **Home** (`index`: touch Hanging Line + Fan Favorites), **Shop** (chips + staggered grid), **Upcycled**, **Bag** (`cart.validate`), **Profile** (sign in, orders, sign out).
- Stack screens: `product/[slug]`, `checkout` (sign-in → address → reserve via `order.create` → `order.mockPay`), `auth` (modal; `router.back()` returns to the caller).
- `src/lib/`:
  - `trpc.tsx`: `httpBatchLink` to `${EXPO_PUBLIC_API_URL}/api/trpc`, superjson. `headers()` is a **function** that sends `cookie: await authClient.getCookie()` on every request, with `credentials: "omit"`.
  - `auth-client.ts`: Better Auth Expo client, SecureStore, scheme `kushkousins`.
  - `cart.ts`: AsyncStorage bag, `{variantId, quantity}` only.
  - `showcase.ts`, `motion.ts` (`@repo/ui` springs → Reanimated `withSpring`), `config.ts`.
- `src/components/`:
  - `hanging-line` (native snap scroll + Reanimated scale + haptic on centre change).
  - `product-card` / `chamfer` (SVG chamfer backdrop), `staggered-grid`, `pressable-scale` (press-in feedback), `garment-art`, `price`, `listing`, `screen`.

## Styling
- **NativeWind 4.2.7 + Tailwind 3** (not v5 RC). The theme is generated in `tailwind.config.ts` from `@repo/ui` tokens. Font sizes are in px, because NativeWind's rem isn't 16px.
- **One font family per weight.** RN can't synthesise weights for custom fonts. Use `font-display`, `font-display-medium`, `font-display-italic`, `font-sans`, `font-sans-medium` and `font-sans-semibold`, never `font-medium` on a custom font. Names must match `useFonts` in `_layout.tsx`.
- `react-native-css-interop` is a **direct** dependency (pnpm isolation: NativeWind's Babel transform imports it). Keep its version equal to the one NativeWind depends on.
- Animated components need `cssInterop(Component, { className: "style" })` for `className` to apply (see `pressable-scale.tsx`).

## Rules
- Install with `pnpm exec expo install <pkg>` so versions match the SDK.
- **TypeScript stays on the workspace's ^5.9** (`expo.install.exclude: ["typescript"]`). SDK 58 wants ~6.0, but a different TS version gave pnpm a second copy of `expo`/`expo-constants`/`expo-asset` (they peer on typescript via `@better-auth/expo` in packages/auth), which breaks native builds.
- Import `AppRouter` with `import type` only. Never import `@repo/db`, `@repo/auth/server` or `@repo/auth/client` (the web client).
- Worklets → JS: `scheduleOnRN` from `react-native-worklets` (Reanimated 4). Fire haptics only on meaningful changes (snap, add to bag, payment), never per frame.
- Respect `useReducedMotion()` (Reanimated): no scale animations.
- `EXPO_PUBLIC_API_URL` differs per target; see `.env.example`. The web target of this app isn't supported (use apps/web).

## Before calling a task done
```bash
pnpm --filter @repo/mobile check-types
pnpm --filter @repo/mobile lint
pnpm dlx expo-doctor@latest                       # from apps/mobile; must be 20/20
pnpm exec expo export --platform android --output-dir /tmp/kk-android   # bundles without a device
pnpm exec expo export --platform ios --output-dir /tmp/kk-ios
```
Then grep the `.hbc` bundles for `drizzle-orm|pg-protocol|better-auth/next-js|packages/db`, which must be absent.

## Not on mobile yet
Wishlist, address book management (addresses are created at checkout), admin.
