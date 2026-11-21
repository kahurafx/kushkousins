import { Image } from "expo-image";
import Svg, { Path } from "react-native-svg";
import { colors, hangerPath, hangerViewBox, silhouettes, silhouetteViewBox, swatch } from "@repo/ui";
import type { ShowcaseItem } from "@/lib/showcase";

type Props = { item: Pick<ShowcaseItem, "silhouette" | "color"> & { image?: string | null }; hanger?: boolean; width: number };

/**
 * Product art: the cut-out photo (transparent, hook at top-centre) when the product has one, else an
 * SVG silhouette. Both fill the same box, so layouts don't shift once photos load.
 */
export function GarmentArt({ item, hanger = false, width }: Props) {
  const [, , vw, vh] = (hanger ? hangerViewBox : silhouetteViewBox).split(" ").map(Number);
  const height = (width * vh!) / vw!;
  if (item.image) {
    return (
      <Image
        source={item.image}
        accessible={false}
        contentFit="contain"
        // On the rail the hook must touch the top edge; elsewhere the garment sits centred.
        contentPosition={hanger ? "top" : "center"}
        transition={200}
        style={{ width, height }}
      />
    );
  }
  return (
    <Svg width={width} height={height} viewBox={hanger ? hangerViewBox : silhouetteViewBox} accessible={false}>
      {hanger && <Path d={hangerPath} fill="none" stroke={colors.forest} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />}
      <Path d={silhouettes[item.silhouette]} fill={swatch(item.color)} stroke={colors.forest} strokeOpacity={0.35} strokeWidth={1} strokeLinejoin="round" />
    </Svg>
  );
}
