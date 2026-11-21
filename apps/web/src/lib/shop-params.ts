import { z } from "zod";

const list = z
  .union([z.string(), z.array(z.string())])
  .transform((v) => (Array.isArray(v) ? v : v.split(",")).map((s) => s.trim()).filter(Boolean).slice(0, 20))
  .optional()
  .catch(undefined);
const kes = z.coerce.number().int().nonnegative().max(10_000_000).optional().catch(undefined);

/** URL → filter state. Bad or hostile input falls back to defaults instead of erroring. */
export const ShopSearchParams = z.object({
  q: z.string().trim().max(80).optional().catch(undefined),
  type: z.enum(["new", "upcycled"]).optional().catch(undefined),
  size: list,
  color: list,
  min: kes, // whole KES in the URL; converted to cents for the API
  max: kes,
  sort: z.enum(["newest", "price_asc", "price_desc"]).optional().catch(undefined),
});
export type ShopFilters = z.infer<typeof ShopSearchParams>;

export const SPECIAL_SLUGS = { all: "Collections", new: "New Arrivals", upcycled: "Upcycled" } as const;
