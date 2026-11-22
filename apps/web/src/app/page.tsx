import { connection } from "next/server";
import { FanFavorites } from "@/components/fan-favorites";
import { HangingLine } from "@/components/hanging-line";
import { Lookbook } from "@/components/lookbook";
import { toShowcaseItem } from "@/lib/showcase";
import { publicCaller } from "@/lib/trpc-server";

export default async function Home() {
  await connection(); // render per request; keeps `next build` from needing a database
  const trpc = publicCaller();
  const [line, favourites, upcycled] = await Promise.all([
    trpc.product.hangingLine(),
    trpc.product.fanFavorites(),
    trpc.product.list({ mode: "UPCYCLED", limit: 8 }),
  ]);

  return (
    <main className="flex flex-1 flex-col">
      <h1 className="sr-only">kushkousins: new and one-of-a-kind upcycled clothing</h1>
      <div className="mt-6 min-w-0">
        <HangingLine items={line.map((p) => ({ ...toShowcaseItem(p), category: p.category?.name ?? null }))} />
      </div>
      <FanFavorites entries={favourites.map((p) => ({ item: toShowcaseItem(p), category: p.category?.slug ?? null }))} />
      <Lookbook products={upcycled.filter((p) => p.status !== "sold")} />
    </main>
  );
}
