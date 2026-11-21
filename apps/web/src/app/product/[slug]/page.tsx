import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";
import { TRPCError } from "@trpc/server";
import { BuyBox } from "@/components/buy-box";
import { GarmentArt } from "@/components/garment-art";
import { Price } from "@/components/price";
import { availabilityLabel, toShowcaseItem } from "@/lib/showcase";
import { publicCaller } from "@/lib/trpc-server";

type Props = { params: Promise<{ slug: string }> };

// Deduped between generateMetadata and the page within one request.
const getProduct = cache(async (slug: string) => {
  try {
    return await publicCaller().product.bySlug({ slug });
  } catch (e) {
    if (e instanceof TRPCError && e.code === "NOT_FOUND") notFound();
    throw e;
  }
});

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const p = await getProduct((await params).slug);
  return { title: `${p.name} · kushkousins`, description: p.description ?? undefined };
}

export default async function ProductPage({ params }: Props) {
  const product = await getProduct((await params).slug);
  const item = toShowcaseItem(product);
  const status = availabilityLabel(item);
  const unique = product.mode === "UPCYCLED";

  return (
    <main className="mx-auto w-full max-w-7xl flex-1 px-4 pb-32 pt-6 md:px-8 lg:pb-24">
      <nav aria-label="Breadcrumb" className="text-label uppercase opacity-70">
        <ol className="flex flex-wrap gap-2">
          <li>
            <Link href="/shop/all" className="hover:underline">Shop</Link> <span aria-hidden>/</span>
          </li>
          {product.category && (
            <li>
              <Link href={`/shop/${product.category.slug}`} className="hover:underline">{product.category.name}</Link> <span aria-hidden>/</span>
            </li>
          )}
          <li aria-current="page">{product.name}</li>
        </ol>
      </nav>

      <div className="mt-6 grid gap-10 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:gap-16">
        {/* Gallery. shortcut: one placeholder panel until real photography lands; images[] renders as a stack. */}
        <section aria-label="Gallery" className="space-y-4">
          {(product.images.length ? product.images : [null]).map((src, i) => (
            <div key={src ?? i} className="relative aspect-[4/5] bg-stone chamfer-lg">
              <GarmentArt item={{ ...item, image: src }} className="absolute inset-x-[16%] top-[10%] bottom-[8%] h-auto w-[68%]" />
              {i === 0 && status && (
                <span className="absolute left-10 top-6 bg-forest px-2 py-1 text-label uppercase text-canvas">{status}</span>
              )}
            </div>
          ))}
        </section>

        <section aria-labelledby="product-name" className="lg:sticky lg:top-28 lg:self-start">
          {unique ? (
            <p className="inline-block bg-tangerine px-2 py-1 text-label uppercase text-forest">1-of-1 Unique Piece</p>
          ) : (
            <p className="text-label uppercase opacity-70">New</p>
          )}
          <h1 id="product-name" className="mt-4 text-display-md">{product.name}</h1>
          <Price item={item} className="mt-3 text-body" />
          {product.discountPercent ? <p className="mt-1 text-body-sm text-espresso">{product.discountPercent}% off</p> : null}
          {product.description && <p className="mt-6 max-w-prose text-body">{product.description}</p>}

          {unique && (product.originalMaterial || product.artisanNotes) && (
            <div className="mt-8 bg-espresso p-6 text-canvas chamfer-sm">
              <h2 className="text-label uppercase">Provenance</h2>
              {product.originalMaterial && (
                <p className="mt-3 text-body-sm">
                  <span className="opacity-70">Made from </span>
                  {product.originalMaterial}
                </p>
              )}
              {product.artisanNotes && <p className="mt-3 font-display text-display-sm italic">“{product.artisanNotes}”</p>}
            </div>
          )}

          <BuyBox item={item} />
        </section>
      </div>
    </main>
  );
}
