import { connection } from "next/server";
import { HangingLine } from "@/components/hanging-line";
import { ProductCard } from "@/components/product-card";
import { toShowcaseItem } from "@/lib/showcase";
import { publicCaller } from "@/lib/trpc-server";

export default async function Home() {
  await connection(); // render per request; keeps `next build` from needing a database
  const trpc = publicCaller();
  const [line, favourites] = await Promise.all([trpc.product.hangingLine(), trpc.product.fanFavorites()]);

  return (
    <main className="flex flex-1 flex-col">
      {/* shortcut: wordmark only; the full sticky header (nav, search, bag count) lands in Phase 3 */}
      <h1 className="pt-10 text-center font-display text-display-md">kushkousins</h1>

      <div className="mt-10 min-w-0">
        <HangingLine items={line.map(toShowcaseItem)} />
      </div>

      {/* shortcut: plain row of cards; filter pills + Previous/Next controls land in Phase 3 */}
      <section aria-labelledby="fan-favorites" className="mx-auto w-full max-w-7xl px-6 pb-24 md:px-16">
        <h2 id="fan-favorites" className="text-display-lg">Fan Favorites</h2>
        <ul className="mt-10 grid grid-cols-2 gap-x-6 gap-y-12 md:grid-cols-3 lg:grid-cols-5">
          {favourites.map((p) => (
            <li key={p.id}>
              {/* shortcut: "featured" = top favourite until a curation flag exists (Phase 4) */}
              <ProductCard item={toShowcaseItem(p)} featured={p.fanFavoritePosition === 1} />
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
