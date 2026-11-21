import { colors, hangerPath, hangerViewBox, silhouettes, silhouetteViewBox, swatch } from "@repo/ui";
import type { ShowcaseItem } from "@/lib/showcase";

/**
 * Product art: the cut-out photo (transparent, hook at top-centre) when the product has one,
 * else an SVG silhouette placeholder.
 */
export function GarmentArt({
  item,
  hanger = false,
  className,
}: {
  item: Pick<ShowcaseItem, "silhouette" | "color" | "image">;
  hanger?: boolean;
  className?: string;
}) {
  if (item.image) {
    // eslint-disable-next-line @next/next/no-img-element -- the image CDN already resizes and cuts out; swap to next/image once hosting is our own
    const img = (c?: string) => <img src={item.image!} alt="" aria-hidden draggable={false} decoding="async" className={c} />;
    // On the rail the photo keeps its natural height so the hook stays pinned to the top edge.
    if (hanger) return img(className);
    // Elsewhere callers size a box with insets; a bare <img> would ignore them and overflow.
    return <span aria-hidden className={`block ${className ?? ""}`}>{img("h-full w-full object-contain")}</span>;
  }
  return (
    <svg viewBox={hanger ? hangerViewBox : silhouetteViewBox} aria-hidden className={className}>
      {hanger && (
        <path d={hangerPath} fill="none" stroke={colors.forest} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
      )}
      <path
        d={silhouettes[item.silhouette]}
        fill={swatch(item.color)}
        stroke={colors.forest}
        strokeOpacity={0.35}
        strokeWidth={1}
        strokeLinejoin="round"
      />
    </svg>
  );
}
