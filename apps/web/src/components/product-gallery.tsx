"use client";

import { createContext, useContext, useState } from "react";
import { imagesForColor, type ProductImage } from "@repo/types";
import type { ShowcaseItem } from "@/lib/showcase";
import { GarmentArt } from "./garment-art";

// The gallery and the buy box are siblings on the page, so the chosen colour lives above both.
const ColorContext = createContext<{ color: string | undefined; setColor: (c: string) => void } | null>(null);

export function SelectedColorProvider({ initial, children }: { initial: string | undefined; children: React.ReactNode }) {
  const [color, setColor] = useState(initial);
  return <ColorContext.Provider value={{ color, setColor }}>{children}</ColorContext.Provider>;
}

export function useSelectedColor() {
  const ctx = useContext(ColorContext);
  if (!ctx) throw new Error("useSelectedColor needs <SelectedColorProvider>");
  return ctx;
}

/** Stacked editorial panels for the selected colour's photos (or a tinted placeholder when there are none). */
export function ProductGallery({ images, item, status }: { images: ProductImage[]; item: ShowcaseItem; status: string | null }) {
  const { color } = useSelectedColor();
  const shown = imagesForColor(images, color);
  return (
    <section aria-label="Gallery" className="space-y-4">
      {(shown.length ? shown : [null]).map((img, i) => (
        <figure key={img?.url ?? "placeholder"} className="relative m-0 aspect-[4/5] bg-stone chamfer-lg">
          <GarmentArt
            item={{ ...item, image: img?.url ?? null, color: color ?? item.color }}
            className="absolute inset-x-[16%] top-[10%] bottom-[8%] h-auto w-[68%]"
          />
          {i === 0 && status && <span className="absolute left-10 top-6 bg-forest px-2 py-1 text-label uppercase text-canvas">{status}</span>}
          {img?.label && <figcaption className="absolute bottom-4 left-10 text-label uppercase opacity-70">{img.label}</figcaption>}
        </figure>
      ))}
    </section>
  );
}
