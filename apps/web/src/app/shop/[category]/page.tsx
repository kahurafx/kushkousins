import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ProductCard } from "@/components/product-card";
import { ShopFilterBar } from "@/components/shop-filters";
import { SPECIAL_SLUGS, ShopSearchParams } from "@/lib/shop-params";
import { toShowcaseItem } from "@/lib/showcase";
import { publicCaller } from "@/lib/trpc-server";

type Props = { params: Promise<{ category: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { category } = await params;
  const title = SPECIAL_SLUGS[category as keyof typeof SPECIAL_SLUGS] ?? category.replace(/-/g, " ");
  return { title: `${title} · kushkousins` };
}

export default async function ShopPage({ params, searchParams }: Props) {
  const { category } = await params;
  const filters = ShopSearchParams.parse(await searchParams);
  const trpc = publicCaller();
  const facets = await trpc.product.facets();

  const special = category in SPECIAL_SLUGS;
  const cat = special ? undefined : facets.categories.find((c) => c.slug === category);
  if (!special && !cat) notFound();

  const mode = category === "new" ? "NEW" : category === "upcycled" ? "UPCYCLED" : filters.type === "new" ? "NEW" : filters.type === "upcycled" ? "UPCYCLED" : undefined;
  const products = await trpc.product.list({
    mode,
    categorySlug: cat?.slug,
    q: filters.q,
    sizes: filters.size,
    colors: filters.color,
    minPriceCents: filters.min !== undefined ? filters.min * 100 : undefined,
    maxPriceCents: filters.max !== undefined ? filters.max * 100 : undefined,
    sort: filters.sort,
  });
  const title = cat?.name ?? SPECIAL_SLUGS[category as keyof typeof SPECIAL_SLUGS];

  return (
    <main className="mx-auto w-full max-w-7xl flex-1 px-4 pb-24 pt-10 md:px-8">
      <h1 className="text-display-lg">{title}</h1>
      {filters.q && <p className="mt-2 text-body-sm">Results for “{filters.q}”</p>}

      <ShopFilterBar
        category={category}
        categories={facets.categories.map(({ slug, name }) => ({ slug, name }))}
        sizes={facets.sizes}
        colors={facets.colors}
        showType={category !== "new" && category !== "upcycled"}
        filters={filters}
        count={products.length}
      />

      {products.length === 0 ? (
        <p className="py-24 text-center text-body">Nothing matches those filters yet.</p>
      ) : (
        <ul className="mt-8 grid grid-cols-2 gap-x-4 gap-y-12 sm:gap-x-6 md:grid-cols-3 lg:grid-cols-4">
          {products.map((p) => (
            <li key={p.id}>
              <ProductCard item={toShowcaseItem(p)} />
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
