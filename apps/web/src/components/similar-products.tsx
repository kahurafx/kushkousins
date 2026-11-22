import { ProductCard } from "@/components/product-card";
import { toShowcaseItem } from "@/lib/showcase";
import { publicCaller } from "@/lib/trpc-server";

export async function SimilarProducts({ productId }: { productId: string }) {
  // A failed rail must never take the product page down with it.
  const similar = await publicCaller().product.similar({ productId }).catch(() => []);
  if (!similar.length) return null;

  return (
    <section aria-labelledby="similar-heading" className="mt-24">
      <h2 id="similar-heading" className="text-display-md">You may also like</h2>
      <ul className="mt-8 grid grid-cols-2 gap-x-4 gap-y-12 sm:gap-x-6 md:grid-cols-3 lg:grid-cols-4">
        {similar.map((p) => (
          <li key={p.id}>
            <ProductCard item={toShowcaseItem(p)} />
          </li>
        ))}
      </ul>
    </section>
  );
}
