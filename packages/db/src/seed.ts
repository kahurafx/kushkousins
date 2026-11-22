// Idempotent: upserts by slug/sku, safe to run repeatedly. Usage: pnpm db:seed
import "dotenv/config"; // must be first: ./index builds the Pool on import
import { eq, sql } from "drizzle-orm";
import { db, schema } from "./index";

const { categories, products, productVariants } = schema;

type Seed = {
  slug: string;
  name: string;
  description: string;
  mode: "NEW" | "UPCYCLED";
  category: "streetwear" | "formal" | "outerwear";
  priceKes: number;
  sizes: string[];
  colors: string[];
  stock?: number; // per NEW variant
  discountPercent?: number;
  hangingLine?: number;
  fanFavorite?: number;
  featured?: boolean;
  originalMaterial?: string;
  artisanNotes?: string;
  sold?: boolean;
  image: string;
  /** Extra colour-specific photos (colour name -> URL). `image` is shown for the first colour. */
  colorImages?: Record<string, string>;
};

/**
 * Unsplash photo (Unsplash License), cut out by its imgix CDN (bg-remove → transparent WebP).
 * `rect` crops the source to the garment with the hanger hook at the top edge; `pad` (output px at
 * w=800, so change both together) adds transparency to the narrower side so the hook lands at
 * top-centre: the Hanging Line hangs every image from that point. Measured from each cut-out's alpha.
 */
const photo = (id: string, rect: string, pad = "") =>
  `https://images.unsplash.com/photo-${id}?rect=${rect}&w=800&bg-remove=true&fm=webp&q=80${pad && `&${pad}&bg=00000000`}`;

const catalog: Seed[] = [
  // ---- NEW (variant matrix, multi-unit stock)
  { slug: "kousin-heavyweight-hoodie", name: "Kousin Heavyweight Hoodie", mode: "NEW", category: "streetwear", priceKes: 6500, sizes: ["S", "M", "L", "XL"], colors: ["Stone", "Forest"], stock: 12, discountPercent: 20, fanFavorite: 1, featured: true,
    image: photo("1620799140188-3b2a02fd9a77", "1942,796,1877,3196"),
    description: "480gsm brushed cotton fleece with a boxy drop shoulder and tonal embroidered wordmark." },
  { slug: "nairobi-boxy-tee", name: "Nairobi Boxy Tee", mode: "NEW", category: "streetwear", priceKes: 2500, sizes: ["S", "M", "L", "XL"], colors: ["Cream", "Espresso"], stock: 25, fanFavorite: 2, hangingLine: 3,
    image: photo("1778671394516-8270eac13c42", "765,20,1485,1850", "pad-left=10"),
    // Demo of colour-linked photos: the CDN darkens the same cut-out for the Espresso colourway.
    colorImages: { Espresso: `${photo("1778671394516-8270eac13c42", "765,20,1485,1850", "pad-left=10")}&exp=-60` },
    description: "Heavy jersey tee cut wide and cropped, garment-dyed for a lived-in hand." },
  { slug: "tailored-linen-blazer", name: "Tailored Linen Blazer", mode: "NEW", category: "formal", priceKes: 14500, sizes: ["S", "M", "L"], colors: ["Sand"], stock: 5, hangingLine: 1,
    image: photo("1761499101317-e32c4ed50b2f", "569,1209,1331,1774", "pad-right=25"),
    description: "Unstructured single-breasted blazer in washed Kenyan-woven linen, half-lined in cupro." },
  { slug: "pleated-wide-trousers", name: "Pleated Wide Trousers", mode: "NEW", category: "formal", priceKes: 8500, sizes: ["S", "M", "L"], colors: ["Indigo"], stock: 8, discountPercent: 15, fanFavorite: 4, hangingLine: 4,
    image: photo("1754555009601-498e9873197e", "470,586,954,1958", "pad-right=158"),
    description: "Rigid indigo denim cut with a high rise and a long, straight leg." },
  { slug: "waxed-field-jacket", name: "Waxed Field Jacket", mode: "NEW", category: "outerwear", priceKes: 18000, sizes: ["M", "L", "XL"], colors: ["Navy"], stock: 4,
    image: photo("1624548140129-74786c5f1279", "223,907,3572,4333"),
    description: "Waxed cotton shell with a shearling collar, slant pockets and ribbed cuffs." },
  { slug: "cargo-utility-pants", name: "Cargo Utility Pants", mode: "NEW", category: "streetwear", priceKes: 7200, sizes: ["S", "M", "L", "XL"], colors: ["Black", "Khaki"], stock: 10,
    image: photo("1718252540617-6ecda2b56b57", "0,412,2910,2230"),
    description: "Ripstop cargos with articulated knees and adjustable cuffs." },

  // ---- UPCYCLED (1-of-1, single variant, stock 1)
  { slug: "kitenge-patchwork-bomber", name: "Kitenge Patchwork Bomber", mode: "UPCYCLED", category: "outerwear", priceKes: 16500, sizes: ["M"], colors: ["Multi"], fanFavorite: 3,
    image: photo("1649937408746-4d2f603f91c8", "229,295,3555,3292"),
    description: "A bomber pieced from eleven kitenge offcuts around a reclaimed satin lining.",
    originalMaterial: "Vintage kitenge offcuts, reclaimed satin lining",
    artisanNotes: "Panels hand-matched over two weeks at our Gikomba studio; no two prints repeat." },
  { slug: "reworked-denim-chore-coat", name: "Reworked Denim Chore Coat", mode: "UPCYCLED", category: "outerwear", priceKes: 12000, sizes: ["L"], colors: ["Indigo"],
    // Cropped below the hanger: the photo's hook is a display-arm clamp, so it stays off the rail.
    image: photo("1611312449408-fcece27cdbb7", "48,830,2031,1932"),
    description: "Three pairs of mitumba denim rebuilt into a boxy chore coat with sashiko mending.",
    originalMaterial: "Three pairs of second-hand Levi's 501s",
    artisanNotes: "Original fades and repairs kept visible; hand sashiko stitching on the cuffs." },
  { slug: "shuka-check-overshirt", name: "Shuka Check Overshirt", mode: "UPCYCLED", category: "streetwear", priceKes: 7800, sizes: ["M"], colors: ["Grey Check"], discountPercent: 10, fanFavorite: 5,
    // Cropped below the photo's rail stub (beside the hook), so it stays off the Hanging Line.
    image: photo("1611312449412-6cefac5dc3e4", "307,540,1895,2481", "pad-left=152"),
    description: "A heavyweight overshirt cut from a well-loved shuka blanket.",
    originalMaterial: "Pre-loved Maasai shuka (acrylic-wool blend)",
    artisanNotes: "Selvedge edge used as the placket; horn buttons from a Kariakor supplier." },
  { slug: "deconstructed-trench", name: "Deconstructed Trench", mode: "UPCYCLED", category: "outerwear", priceKes: 22000, sizes: ["M"], colors: ["Blue"], hangingLine: 2,
    image: photo("1778171698295-02cc66aeefb5", "4455,2173,1890,2500", "pad-left=105"),
    description: "A 1980s mac taken apart and re-cut with a raw hem and exposed seam tape.",
    originalMaterial: "1980s cotton gabardine mac",
    artisanNotes: "Storm flap reworked into a detachable collar." },
  { slug: "silk-scarf-shirt", name: "Silk Scarf Shirt", mode: "UPCYCLED", category: "formal", priceKes: 9600, sizes: ["M"], colors: ["Ivory"],
    image: photo("1621773881532-fe65715b5137", "711,2110,2006,2650"),
    description: "A camp-collar shirt assembled from four vintage silk scarves.",
    originalMaterial: "Four vintage silk twill scarves",
    artisanNotes: "French seams throughout; scarf borders frame the front panels." },
  { slug: "rework-varsity-vest", name: "Rework Varsity Vest", mode: "UPCYCLED", category: "streetwear", priceKes: 5400, sizes: ["S"], colors: ["Green"], sold: true,
    image: photo("1776864045728-c5f12a12c390", "3547,957,1505,1820"),
    description: "A cropped vest from a cut-down varsity jacket body.",
    originalMaterial: "Wool body of a 1990s varsity jacket",
    artisanNotes: "Chenille patch re-applied on the back." },
];

const categorySeed = [
  { slug: "streetwear", name: "Streetwear" },
  { slug: "formal", name: "Formal" },
  { slug: "outerwear", name: "Outerwear" },
];

const code = (slug: string) => slug.split("-").map((w) => w[0]!.toUpperCase()).join("");
// Seed SKUs are short codes; admin-created SKUs use the full slug (see packages/api) so they can't collide.
const sku = (slug: string, size: string, color: string) =>
  `${code(slug)}-${size}-${color.replace(/\s+/g, "").toUpperCase()}`;

async function main() {
  await db.transaction(async (tx) => {
    const cats = await tx
      .insert(categories)
      .values(categorySeed)
      .onConflictDoUpdate({ target: categories.slug, set: { name: sql`excluded.name` } })
      .returning();
    const catId = Object.fromEntries(cats.map((c) => [c.slug, c.id]));

    for (const s of catalog) {
      if (s.mode === "UPCYCLED" && (s.sizes.length !== 1 || s.colors.length !== 1)) {
        throw new Error(`${s.slug}: UPCYCLED pieces have exactly one variant`);
      }
      const values = {
        slug: s.slug,
        name: s.name,
        description: s.description,
        mode: s.mode,
        status: s.sold ? ("sold" as const) : ("active" as const),
        priceCents: s.priceKes * 100,
        discountPercent: s.discountPercent ?? null,
        categoryId: catId[s.category]!,
        originalMaterial: s.originalMaterial ?? null,
        artisanNotes: s.artisanNotes ?? null,
        hangingLinePosition: s.hangingLine ?? null,
        fanFavoritePosition: s.fanFavorite ?? null,
        featured: s.featured ?? false,
        images: s.colorImages
          ? [
              { url: s.image, color: s.colors[0]!, label: "Front" },
              ...Object.entries(s.colorImages).map(([color, url]) => ({ url, color, label: "Front" })),
            ]
          : [{ url: s.image, color: null, label: null }],
        soldAt: s.sold ? new Date("2026-11-01T10:00:00Z") : null,
      };
      const [product] = await tx
        .insert(products)
        .values(values)
        .onConflictDoUpdate({ target: products.slug, set: values })
        .returning({ id: products.id });

      const stock = s.mode === "UPCYCLED" ? (s.sold ? 0 : 1) : (s.stock ?? 0);
      const variants = s.sizes.flatMap((size) =>
        s.colors.map((color) => ({ productId: product!.id, sku: sku(s.slug, size, color), size, color, stock })),
      );
      // A recoloured product renames its old variant in place (same size) instead of adding a new one:
      // order items and reservations keep pointing at it, and an UPCYCLED piece keeps exactly one variant.
      const existing = await tx.select().from(productVariants).where(eq(productVariants.productId, product!.id));
      const wanted = new Set(variants.map((v) => v.sku));
      const stale = existing.filter((e) => !wanted.has(e.sku));
      for (const v of variants) {
        if (existing.some((e) => e.sku === v.sku)) continue;
        const i = stale.findIndex((e) => e.size === v.size);
        if (i < 0) continue;
        const [old] = stale.splice(i, 1);
        await tx.update(productVariants).set({ sku: v.sku, color: v.color }).where(eq(productVariants.id, old!.id));
      }
      await tx
        .insert(productVariants)
        .values(variants)
        .onConflictDoUpdate({
          target: productVariants.sku,
          set: { size: sql`excluded.size`, color: sql`excluded.color`, stock: sql`excluded.stock` },
        });
    }
  });

  const [counts] = await db.execute<{ products: number; variants: number; categories: number }>(sql`
    select (select count(*) from products)::int as products,
           (select count(*) from product_variants)::int as variants,
           (select count(*) from categories)::int as categories`).then((r) => r.rows);
  console.log("Seeded:", counts);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => db.$client.end());
