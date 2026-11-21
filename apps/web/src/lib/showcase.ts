import type { RouterOutputs } from "@repo/api";
import { salePriceCents } from "@repo/types";
import { silhouetteFor, type Silhouette } from "@repo/ui";

type ProductWithVariants = RouterOutputs["product"]["hangingLine"][number];

/**
 * sold     – paid 1-of-1 (product.status = sold)
 * reserved – active but no stock left (held by an unpaid order, or a NEW item sold out)
 */
export type Availability = "in_stock" | "reserved" | "sold";

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

export const availabilityOf = (p: { status: string; variants: { stock: number }[] }): Availability =>
  p.status === "sold" ? "sold" : p.variants.some((v) => v.stock > 0) ? "in_stock" : "reserved";

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

export const availabilityLabel = (item: Pick<ShowcaseItem, "availability" | "mode">) =>
  item.availability === "sold" ? "Sold" : item.availability === "reserved" ? (item.mode === "UPCYCLED" ? "Reserved" : "Sold out") : null;
