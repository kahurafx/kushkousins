import type { Config } from "tailwindcss";
import { colors, type as typeScale } from "@repo/ui";

// React Native can't synthesise weights for custom fonts: every weight is its own family.
// Keep these names in sync with the fonts loaded in src/app/_layout.tsx.
export const fontFamily = {
  display: ["CormorantGaramond_400Regular"],
  "display-medium": ["CormorantGaramond_500Medium"],
  "display-italic": ["CormorantGaramond_400Regular_Italic"],
  sans: ["Inter_400Regular"],
  "sans-medium": ["Inter_500Medium"],
  "sans-semibold": ["Inter_600SemiBold"],
};

// Type scale from @repo/ui, in px (NativeWind's rem is not 16px). Tracking em → px per size.
const px = (rem: number) => rem * 16;
const fontSize = Object.fromEntries(
  Object.entries(typeScale).map(([name, t]) => [
    name,
    [`${px(t.size)}px`, { lineHeight: `${Math.round(px(t.size) * t.lineHeight)}px`, letterSpacing: `${(t.tracking * px(t.size)).toFixed(2)}px` }] as [string, { lineHeight: string; letterSpacing: string }],
  ]),
);

export default {
  content: ["./src/**/*.{ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: { extend: { colors: { ...colors }, fontFamily, fontSize } },
  plugins: [],
} satisfies Config;
