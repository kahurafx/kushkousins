import Link from "next/link";
import type { RouterOutputs } from "@repo/api";
import { toShowcaseItem } from "@/lib/showcase";
import { GarmentArt } from "./garment-art";

type Product = RouterOutputs["product"]["list"][number];

// Asymmetric 12-col layout: tile spans + backdrop alternate so the grid never reads as uniform.
// `stack` tiles put the garment above the story; the rest sit side by side (from md up).
const layout = [
  { span: "md:col-span-7 md:row-span-2", tone: "bg-espresso text-canvas", stack: true },
  { span: "md:col-span-5", tone: "bg-stone", stack: false },
  { span: "md:col-span-5", tone: "bg-forest text-canvas", stack: false },
  { span: "md:col-span-12", tone: "bg-stone", stack: false },
];

/** Editorial Lookbook: full-bleed asymmetric grid of upcycled provenance stories. */
export function Lookbook({ products }: { products: Product[] }) {
  const stories = products.filter((p) => p.artisanNotes).slice(0, layout.length);
  if (!stories.length) return null;
  return (
    <section aria-labelledby="lookbook" className="w-full pb-24">
      <div className="mx-auto max-w-7xl px-4 md:px-8">
        <p className="text-label uppercase opacity-60">Editorial Lookbook</p>
        <h2 id="lookbook" className="mt-2 max-w-3xl text-display-lg">Made once, by hand, from something that already lived a life.</h2>
      </div>
      <ul className="mt-12 grid gap-2 md:grid-cols-12">
        {stories.map((p, i) => {
          const l = layout[i]!;
          const item = toShowcaseItem(p);
          return (
            <li
              key={p.id}
              className={`group relative grid ${l.stack ? "grid-rows-[1fr_auto]" : "md:grid-cols-2"} ${l.span} ${l.tone} ${i === 0 ? "chamfer-lg" : ""}`}
            >
              <div className={`relative min-h-64 ${l.stack ? "md:min-h-[28rem]" : "md:min-h-72"} ${!l.stack && i % 2 ? "md:order-2" : ""}`}>
                <GarmentArt
                  item={item}
                  className="absolute inset-x-[18%] top-[10%] bottom-[6%] mx-auto h-[84%] w-auto transition-transform duration-700 ease-[var(--ease-spring)] group-hover:scale-[1.03] motion-reduce:transition-none"
                />
              </div>
              <div className={`flex flex-col justify-end p-6 md:p-10 ${!l.stack && i % 2 ? "md:order-1" : ""}`}>
                <p className="text-label uppercase opacity-80">{p.originalMaterial}</p>
                <p className="mt-3 max-w-md font-display text-display-sm italic">“{p.artisanNotes}”</p>
                <Link href={`/product/${p.slug}`} className="mt-4 self-start border-b border-current pb-0.5 text-label uppercase after:absolute after:inset-0">
                  {p.name}
                </Link>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
