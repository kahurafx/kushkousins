import type { RouterOutputs } from "@repo/api";
import { availabilityOf, salePriceCents, type Availability } from "@repo/types";
import { silhouetteFor, type Silhouette } from "@repo/ui";

type Row = RouterOutputs["product"]["hangingLine"][number];

/** Same slim shape as the web app's ShowcaseItem. */
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

export const toShowcaseItem = (p: Row): ShowcaseItem => ({
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
