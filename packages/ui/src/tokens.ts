// Single source of truth for the kushkousins design system.
// Web consumes these via theme.css (Tailwind v4 @theme); mobile imports this file directly.

export const colors = {
  canvas: "#F7F5F0", // Warm Alabaster: primary background
  forest: "#1C2B21", // Deep Forest Green: primary text + dark surfaces
  espresso: "#38251A", // Rich Espresso: secondary accent / earth tone
  tangerine: "#EE7218", // Burnt Tangerine: editorial badges, highlights (never small text on canvas)
  stone: "#E8E6E1", // Soft Stone: product card backdrop
} as const;
export type ColorToken = keyof typeof colors;

export const fonts = {
  display: "Cormorant Garamond", // editorial serif: headings, wordmark, garment names
  sans: "Inter", // UI, body, pricing (use tabular-nums for prices)
} as const;

// Tracking and leading are size-specific: large text tightens, small caps labels open up.
export const type = {
  "display-xl": { size: 5, lineHeight: 0.95, tracking: -0.03, weight: 400, font: "display" },
  "display-lg": { size: 3.5, lineHeight: 1.0, tracking: -0.025, weight: 400, font: "display" },
  "display-md": { size: 2.25, lineHeight: 1.1, tracking: -0.02, weight: 500, font: "display" },
  "display-sm": { size: 1.5, lineHeight: 1.2, tracking: -0.01, weight: 500, font: "display" },
  body: { size: 1, lineHeight: 1.5, tracking: 0, weight: 400, font: "sans" },
  "body-sm": { size: 0.875, lineHeight: 1.5, tracking: 0.005, weight: 400, font: "sans" },
  price: { size: 0.9375, lineHeight: 1.3, tracking: 0, weight: 500, font: "sans" },
  label: { size: 0.75, lineHeight: 1.2, tracking: 0.08, weight: 500, font: "sans" }, // uppercase nav + pills
} as const; // size in rem, tracking in em
export type TypeToken = keyof typeof type;

// Asymmetric chamfer: top-left and bottom-right corners clipped (px).
export const chamfer = { sm: 12, md: 20, lg: 32 } as const;

// Springs. bounce 0 = critically damped (default everywhere);
// bounce > 0 only after a momentum gesture (flick/throw/drag release).
// Web (motion/framer-motion): { type: "spring", ...spring.default }
// Mobile (Reanimated withSpring): { duration: visualDuration * 1000, dampingRatio: 1 - bounce }
export const spring = {
  default: { bounce: 0, visualDuration: 0.4 },
  snappy: { bounce: 0, visualDuration: 0.3 },
  flick: { bounce: 0.2, visualDuration: 0.4 },
} as const;

export const pressScale = 0.97; // scale applied on pointer-down, not on release

export const space = { 1: 0.25, 2: 0.5, 3: 0.75, 4: 1, 6: 1.5, 8: 2, 12: 3, 16: 4, 24: 6, 32: 8 } as const; // rem

export const z = { base: 0, card: 10, sticky: 40, drawer: 50, modal: 60, toast: 70 } as const;
