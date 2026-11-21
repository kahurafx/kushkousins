import type { RouterOutputs } from "@repo/api";
import { salePriceCents } from "@repo/types";
import { silhouetteFor, type Silhouette } from "@repo/ui";

type ProductWithVariants = RouterOutputs["product"]["hangingLine"][number];

/** The slim, serialisable shape client components receive (never whole DB rows). */
export type ShowcaseItem = {
  id: string;
  slug: string;
  name: string;
  mode: "NEW" | "UPCYCLED";
  sold: boolean;
  priceCents: number;
  salePriceCents: number;
  discountPercent: number | null;
  color: string;
  silhouette: Silhouette;
  image: string | null;
};

export const toShowcaseItem = (p: ProductWithVariants): ShowcaseItem => ({
  id: p.id,
  slug: p.slug,
  name: p.name,
  mode: p.mode,
  sold: p.status === "sold",
  priceCents: p.priceCents,
  salePriceCents: salePriceCents(p),
  discountPercent: p.discountPercent,
  color: p.variants[0]?.color ?? "Stone",
  silhouette: silhouetteFor(p.name),
  image: p.images[0] ?? null,
});
