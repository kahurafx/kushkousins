import Svg, { Path } from "react-native-svg";
import { colors, hangerPath, hangerViewBox, silhouettes, silhouetteViewBox, swatch } from "@repo/ui";
import type { ShowcaseItem } from "@/lib/showcase";

type Props = { item: Pick<ShowcaseItem, "silhouette" | "color">; hanger?: boolean; width: number };

/** shortcut: SVG silhouette placeholder; real photos need expo-image inside an SVG ClipPath. */
export function GarmentArt({ item, hanger = false, width }: Props) {
  const [, , vw, vh] = (hanger ? hangerViewBox : silhouetteViewBox).split(" ").map(Number);
  return (
    <Svg width={width} height={(width * vh!) / vw!} viewBox={hanger ? hangerViewBox : silhouetteViewBox} accessible={false}>
      {hanger && <Path d={hangerPath} fill="none" stroke={colors.forest} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />}
      <Path d={silhouettes[item.silhouette]} fill={swatch(item.color)} stroke={colors.forest} strokeOpacity={0.35} strokeWidth={1} strokeLinejoin="round" />
    </Svg>
  );
}
