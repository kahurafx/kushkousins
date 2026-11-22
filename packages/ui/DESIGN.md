# kushkousins Design System

Luxury-editorial minimalism (Gucci-inspired). Large serif type, generous whitespace, tactile motion, plus one geometric signature: the chamfered product card. The store sells **New** pieces and **One-of-a-Kind Upcycled** pieces. Prices are in **KES**.

Source of truth: [`src/tokens.ts`](src/tokens.ts). Web gets the tokens through [`src/theme.css`](src/theme.css) (Tailwind v4). Mobile imports `tokens.ts` directly. `pnpm --filter @repo/ui test` fails if the two drift apart.

## Palette

| Token | Hex | Role |
|---|---|---|
| `canvas` | `#F7F5F0` | Page background (warm alabaster) |
| `forest` | `#1C2B21` | Primary text and dark surfaces (footer, drawers, primary buttons) |
| `espresso` | `#38251A` | Secondary accent: provenance stories, upcycled editorial blocks |
| `tangerine` | `#EE7218` | Editorial badges, discount pills, featured star, live bag count |
| `stone` | `#E8E6E1` | Product card backdrop |

**Contrast rules** (checked in `tokens.test.ts`):
- forest on canvas 13.6:1, forest on stone 11.9:1, espresso on canvas 13.3:1. Any size is fine.
- **Tangerine is a fill, not a text colour, on light surfaces** (2.7:1 on canvas). Pills use **forest text on tangerine** (5.0:1). Tangerine text is fine only on forest (5.0:1).
- Discounted prices: show the old price as `line-through` in forest at 60% opacity next to the current price in full forest. Never mark a discount with colour alone.

## Typography

- **Display**: *Cormorant Garamond*, via `font-display` and the `h1`–`h4` defaults. Use it for the wordmark, headings and garment names.
- **UI, body and prices**: *Inter*, via `font-sans`. Prices use `tabular-nums`.

Tracking and leading are set per size. Large text tightens; small uppercase labels open up.

| Token | Size | Leading | Tracking | Use |
|---|---|---|---|---|
| `display-xl` | 5rem | 0.95 | −0.03em | Hero headline |
| `display-lg` | 3.5rem | 1.0 | −0.025em | Section titles |
| `display-md` | 2.25rem | 1.1 | −0.02em | PDP product name |
| `display-sm` | 1.5rem | 1.2 | −0.01em | Card titles, drawer headings |
| `body` | 1rem | 1.5 | 0 | Copy |
| `body-sm` | 0.875rem | 1.5 | 0.005em | Secondary copy |
| `price` | 0.9375rem | 1.3 | 0 | Prices (medium weight) |
| `label` | 0.75rem | 1.2 | +0.08em | UPPERCASE nav, pills, filter chips |

Spacing is in `rem` so layouts scale with the user's text size.

## Signature card (chamfer)

```
 ╱‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾│   top-left corner clipped
│ [-20%] [UPCYCLED]  ★ │   pills top-left; optional editorial star top-right
│                      │
│      garment         │   bg-stone, image object-contain
│                      │
│ Name (display-sm)   ◯│   circular quick-add bag button, bottom-right
│ KES 12,500           ╱   bottom-right corner clipped
 ‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾
```

- Web: the `chamfer-sm`, `chamfer-md` and `chamfer-lg` utilities, or `chamferClipPath(size)` for dynamic sizes.
- Mobile: `chamferPath(w, h, size)` as an SVG mask (react-native-svg), because RN has no `clip-path`.
- Sizes: `sm 12px` for thumbnails and chips, `md 20px` for grid cards, `lg 32px` for hero and lookbook tiles.
- The quick-add button sits *inside* the clipped area and clears the chamfer by at least `chamfer` px.
- 1-of-1 pieces show an `UPCYCLED` pill and, once sold, a `SOLD` state (stone overlay, button disabled). Never hide a sold item silently.

## Motion

Motion makes the interface feel physical and must never get in the way.

1. **Respond on press, not on release.** Buttons scale to `pressScale` (0.97) on pointer-down or touch-down.
2. **Springs, not keyframes, for anything a user touches.** Use `spring.default` (critically damped, no overshoot) everywhere. Use `spring.flick` (slight bounce) only after a momentum gesture: a swipe, throw or drag release.
   - Web (`motion` / Framer Motion): `transition={{ type: "spring", ...spring.default }}`
   - Mobile (Reanimated): `withSpring(v, { duration: s.visualDuration * 1000, dampingRatio: 1 - s.bounce })`
3. **Interruptible.** Every animation can be grabbed or reversed mid-flight and always starts from the live on-screen value. Input is never locked during a transition.
4. **Spatial consistency.** Things leave the way they came. The bag drawer slides in from the right and dismisses to the right. Popovers scale from their trigger (`transform-origin` at the trigger).
5. **Animate only `transform` and `opacity`.**

### The Hanging Line (hero)
- **Web (hover/click):** the hovered garment swings on its hanger hook, the pivot that stays on the rail, like a hanger brushed by a hand. The hem swings the way the hand is moving (the entry side decides when the hand is slow); a faster hand pushes harder (`swingImpulse`, clamped to `hangingLine.swingVelocity`). The swing runs on `hangingLine.swing`, a deliberately underdamped spring (ζ ≈ 0.25, period ≈ 0.9s, a few visible rocks), the one exception to the no-overshoot rule because a hanger physically oscillates. A second kick adds to the live velocity, so it never restarts. Only the image layer rotates: the hit boxes stay still, so a swinging hem can't steal hover from its neighbour. Neighbours part outward (`partingOffset`: ±1 → 24px, ±2 → 10px, ±3 → 4px, `spring.default`) and dim to `hangingLine.dimOpacity` (`spring.snappy`) to isolate the focus. A small chamfered hang-tag (category · availability, price) fades in under the hem just after the swing starts and links to the product. Keyboard focus and tap give the same dimming and tag, but focus never swings (tabbing along the rack shouldn't rock it) and a tap only nudges gently. No idle motion: a garment that has settled stays still.
- **Mobile (touch):** a horizontal carousel that tracks the finger 1:1 and keeps the grab offset. On release, project momentum (`current + (v/1000)·0.998/(1−0.998)`), snap to the garment nearest the projected point, and hand the release velocity to `spring.flick`. The centred garment scales up and reveals its card. A light haptic fires on each snap, on the same frame as the visual. Resist past the ends with a rubber band instead of a hard stop.

### Chrome and materials
- **Sticky header:** a translucent canvas layer (`bg-canvas/80` plus `backdrop-blur`) that content scrolls under. Use a soft fade at the scroll edge instead of a 1px border.
- **Drawers and modals** sit over a forest scrim at about 40%. Never stack a translucent surface on another translucent surface.

### Feedback
Haptics and sound only mark moments that matter: carousel snap, add-to-bag and payment success. They are not used on every tap.

## Accessibility
- `prefers-reduced-motion`: replace springs, parting and parallax with short opacity cross-fades. Keep the feedback; remove the movement. `theme.css` sets a global CSS fallback, and Motion components should read `useReducedMotion()`.
- `prefers-reduced-transparency`: the header becomes solid canvas with no blur.
- Hover-only interactions (the Hanging Line) must also work with keyboard focus and tap.
- Never use colour alone to carry meaning (sale, sold or stock state). Always pair it with a label.
