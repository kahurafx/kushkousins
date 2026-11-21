// Placeholder garments + Hanging Line geometry. Platform-neutral: web renders <path>, mobile react-native-svg.

export const silhouetteViewBox = "0 0 200 260";

// Garment hangs from (100, 0): the hanger's bar sits at y ≈ 18.
export const silhouettes = {
  tee: "M60 20 L40 25 L5 62 L26 86 L46 72 L46 240 L154 240 L154 72 L174 86 L195 62 L160 25 L140 20 Q100 46 60 20 Z",
  hoodie: "M66 20 Q100 -6 134 20 L166 30 L195 205 L171 210 L151 92 L151 242 L49 242 L49 92 L29 210 L5 205 L34 30 Z",
  jacket: "M60 18 L100 42 L140 18 L170 28 L195 212 L172 216 L152 96 L152 236 L48 236 L48 96 L28 216 L5 212 L30 28 Z",
  coat: "M62 15 L100 42 L138 15 L168 25 L195 202 L175 207 L156 102 L172 256 L28 256 L44 102 L25 207 L5 202 L32 25 Z",
  trousers: "M44 16 L156 16 L166 252 L116 252 L100 92 L84 252 L34 252 Z",
  vest: "M60 18 Q100 52 140 18 L150 22 L150 62 Q160 76 160 92 L160 232 L40 232 L40 92 Q40 76 50 62 L50 22 Z",
} as const;
export type Silhouette = keyof typeof silhouettes;

// Hanger wire, drawn *behind* the garment so only the hook shows above the neckline.
// Use hangerViewBox when drawing it: the hook rises to y = -24 (where the rail passes).
export const hangerViewBox = "0 -24 200 284";
export const hangerPath = "M100 24 L100 -12 Q100 -22 108 -22 Q116 -22 116 -14 M100 24 L46 34 L154 34 Z";

const rules: [RegExp, Silhouette][] = [
  [/trouser|pant|jean/, "trousers"],
  [/vest/, "vest"],
  [/hoodie|sweat/, "hoodie"],
  [/\btee\b|t-shirt/, "tee"],
  [/trench|overcoat|parka/, "coat"],
];

/** shortcut: guesses shape from the name; add a `silhouette` column if admins need control (Phase 4). */
export const silhouetteFor = (name: string): Silhouette =>
  rules.find(([re]) => re.test(name.toLowerCase()))?.[1] ?? "jacket";

const swatches: Record<string, string> = {
  forest: "#1C2B21",
  stone: "#E8E6E1",
  cream: "#F2EADB",
  ivory: "#F3EEE2",
  sand: "#D8C7A6",
  khaki: "#B9A77E",
  espresso: "#38251A",
  charcoal: "#3A3A3A",
  black: "#161616",
  olive: "#5B5F3A",
  green: "#2F5D3A",
  indigo: "#2E3A5C",
  "red check": "#9E2B25",
  multi: "#C9572B",
};

/** Fill colour for a variant colour name; unknown names fall back to stone. */
export const swatch = (color: string) => swatches[color.trim().toLowerCase()] ?? swatches.stone!;

// The Hanging Line: hovered garment scales forward from its hook (no lift: the hook stays on the rail);
// neighbours part outward.
export const hangingLine = {
  activeScale: 1.08,
  parting: [24, 10, 4], // px for neighbours at distance 1, 2, 3
} as const;

/** Horizontal offset (px) for garment `index` when `active` is hovered/selected. */
export const partingOffset = (index: number, active: number | null) => {
  if (active === null || index === active) return 0;
  const d = index - active;
  return Math.sign(d) * (hangingLine.parting[Math.abs(d) - 1] ?? 0);
};

/** Touch Hanging Line: which garment is centred for a scroll offset (snap interval = slot width). */
export const snapIndex = (offset: number, interval: number, count: number) =>
  count <= 0 || interval <= 0 ? 0 : Math.min(count - 1, Math.max(0, Math.round(offset / interval)));
