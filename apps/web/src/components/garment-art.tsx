import { colors, hangerPath, hangerViewBox, silhouettes, silhouetteViewBox, swatch } from "@repo/ui";
import type { ShowcaseItem } from "@/lib/showcase";

/** Product art. shortcut: SVG silhouette placeholder until real cut-out photos exist (item.image). */
export function GarmentArt({ item, hanger = false, className }: { item: ShowcaseItem; hanger?: boolean; className?: string }) {
  if (item.image) {
    // eslint-disable-next-line @next/next/no-img-element -- swap to next/image + remotePatterns once image hosting is chosen
    return <img src={item.image} alt="" aria-hidden className={className} />;
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
