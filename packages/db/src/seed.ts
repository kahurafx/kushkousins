// Idempotent: upserts by slug/sku, safe to run repeatedly. Usage: pnpm db:seed
import "dotenv/config"; // must be first: ./index builds the Pool on import
import { sql } from "drizzle-orm";
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
  originalMaterial?: string;
  artisanNotes?: string;
  sold?: boolean;
};

const catalog: Seed[] = [
  // ---- NEW (variant matrix, multi-unit stock)
  { slug: "kousin-heavyweight-hoodie", name: "Kousin Heavyweight Hoodie", mode: "NEW", category: "streetwear", priceKes: 6500, sizes: ["S", "M", "L", "XL"], colors: ["Forest", "Stone"], stock: 12, discountPercent: 20, fanFavorite: 1,
    description: "480gsm brushed cotton fleece with a boxy drop shoulder and tonal embroidered wordmark." },
  { slug: "nairobi-boxy-tee", name: "Nairobi Boxy Tee", mode: "NEW", category: "streetwear", priceKes: 2500, sizes: ["S", "M", "L", "XL"], colors: ["Cream", "Espresso"], stock: 25, fanFavorite: 2,
    description: "Heavy jersey tee cut wide and cropped, garment-dyed for a lived-in hand." },
  { slug: "tailored-linen-blazer", name: "Tailored Linen Blazer", mode: "NEW", category: "formal", priceKes: 14500, sizes: ["S", "M", "L"], colors: ["Sand"], stock: 5, hangingLine: 2,
    description: "Unstructured single-breasted blazer in washed Kenyan-woven linen, half-lined in cupro." },
  { slug: "pleated-wide-trousers", name: "Pleated Wide Trousers", mode: "NEW", category: "formal", priceKes: 8500, sizes: ["S", "M", "L"], colors: ["Charcoal"], stock: 8, discountPercent: 15, fanFavorite: 4,
    description: "Double-pleated wool-blend trousers with a high rise and a long, fluid leg." },
  { slug: "waxed-field-jacket", name: "Waxed Field Jacket", mode: "NEW", category: "outerwear", priceKes: 18000, sizes: ["M", "L", "XL"], colors: ["Olive"], stock: 4, hangingLine: 4,
    description: "Waxed cotton canvas with a corduroy collar, bellows pockets and brass hardware." },
  { slug: "cargo-utility-pants", name: "Cargo Utility Pants", mode: "NEW", category: "streetwear", priceKes: 7200, sizes: ["S", "M", "L", "XL"], colors: ["Black", "Khaki"], stock: 10,
    description: "Ripstop cargos with articulated knees and adjustable cuffs." },

  // ---- UPCYCLED (1-of-1, single variant, stock 1)
  { slug: "kitenge-patchwork-bomber", name: "Kitenge Patchwork Bomber", mode: "UPCYCLED", category: "outerwear", priceKes: 16500, sizes: ["M"], colors: ["Multi"], hangingLine: 1, fanFavorite: 3,
    description: "A bomber pieced from eleven kitenge offcuts around a reclaimed satin lining.",
    originalMaterial: "Vintage kitenge offcuts, reclaimed satin lining",
    artisanNotes: "Panels hand-matched over two weeks at our Gikomba studio; no two prints repeat." },
  { slug: "reworked-denim-chore-coat", name: "Reworked Denim Chore Coat", mode: "UPCYCLED", category: "outerwear", priceKes: 12000, sizes: ["L"], colors: ["Indigo"], hangingLine: 3,
    description: "Three pairs of mitumba denim rebuilt into a boxy chore coat with sashiko mending.",
    originalMaterial: "Three pairs of second-hand Levi's 501s",
    artisanNotes: "Original fades and repairs kept visible; hand sashiko stitching on the cuffs." },
  { slug: "shuka-check-overshirt", name: "Shuka Check Overshirt", mode: "UPCYCLED", category: "streetwear", priceKes: 7800, sizes: ["M"], colors: ["Red Check"], discountPercent: 10, hangingLine: 5, fanFavorite: 5,
    description: "A heavyweight overshirt cut from a well-loved shuka blanket.",
    originalMaterial: "Pre-loved Maasai shuka (acrylic-wool blend)",
    artisanNotes: "Selvedge edge used as the placket; horn buttons from a Kariakor supplier." },
  { slug: "deconstructed-trench", name: "Deconstructed Trench", mode: "UPCYCLED", category: "outerwear", priceKes: 22000, sizes: ["M"], colors: ["Khaki"], hangingLine: 6,
    description: "A 1980s trench taken apart and re-cut with a raw hem and exposed seam tape.",
    originalMaterial: "1980s cotton gabardine trench coat",
    artisanNotes: "Storm flap reworked into a detachable collar." },
  { slug: "silk-scarf-shirt", name: "Silk Scarf Shirt", mode: "UPCYCLED", category: "formal", priceKes: 9600, sizes: ["M"], colors: ["Ivory"], hangingLine: 7,
    description: "A camp-collar shirt assembled from four vintage silk scarves.",
    originalMaterial: "Four vintage silk twill scarves",
    artisanNotes: "French seams throughout; scarf borders frame the front panels." },
  { slug: "rework-varsity-vest", name: "Rework Varsity Vest", mode: "UPCYCLED", category: "streetwear", priceKes: 5400, sizes: ["S"], colors: ["Green"], sold: true,
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
