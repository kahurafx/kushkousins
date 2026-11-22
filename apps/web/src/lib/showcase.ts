import type { RouterOutputs } from "@repo/api";
import { availabilityOf, salePriceCents, type Availability } from "@repo/types";
import { silhouetteFor, type Silhouette } from "@repo/ui";

// Category is optional extra data (only some queries join it); the showcase shape never needs it.
type ProductWithVariants = Omit<RouterOutputs["product"]["hangingLine"][number], "category">;

export type { Availability } from "@repo/types";
export { availabilityLabel, availabilityOf } from "@repo/types";

/** The slim, serialisable shape client components receive (never whole DB rows). */
export type ShowcaseItem = {
  id: string;
  slug: string;
  name: string;
  mode: "NEW" | "UPCYCLED";
  availability: Availability;
  priceCents: number;
  salePriceCents: number;
  discountPercent: number | null;
  color: string;
  silhouette: Silhouette;
  image: string | null;
  featured: boolean;
  variants: { id: string; size: string; color: string; stock: number }[];
};

export const toShowcaseItem = (p: ProductWithVariants): ShowcaseItem => ({
  id: p.id,
  slug: p.slug,
  name: p.name,
  mode: p.mode,
  availability: availabilityOf(p),
  priceCents: p.priceCents,
  salePriceCents: salePriceCents(p),
  discountPercent: p.discountPercent,
  color: p.variants[0]?.color ?? "Stone",
  silhouette: silhouetteFor(p.name),
  image: p.images[0] ?? null,
  featured: p.featured,
  variants: p.variants.map(({ id, size, color, stock }) => ({ id, size, color, stock })),
});
