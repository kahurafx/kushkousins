import { useState } from "react";
import { ScrollView, Text, useWindowDimensions, View } from "react-native";
import { imagesForColor, type ProductImage } from "@repo/types";
import { chamfer, colors } from "@repo/ui";
import { ChamferBackdrop } from "./chamfer";
import { GarmentArt } from "./garment-art";
import type { ShowcaseItem } from "@/lib/showcase";

type Props = { images: ProductImage[]; item: ShowcaseItem; color: string | undefined; status: string | null };

/** Swipeable photos for the selected colour (a tinted placeholder when there are none). */
export function ProductGallery(props: Props) {
  // Keyed by colour: a new colour is a new set of photos, so remount to start at its first one.
  return <Strip key={props.color ?? ""} {...props} />;
}

function Strip({ images, item, color, status }: Props) {
  const { width } = useWindowDimensions();
  const [page, setPage] = useState(0);
  const shown = imagesForColor(images, color);
  const pages = shown.length ? shown : [null];
  return (
    <View>
      <ScrollView
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={(e) => setPage(Math.round(e.nativeEvent.contentOffset.x / width))}
      >
        {pages.map((img, i) => (
          <View key={img?.url ?? "placeholder"} style={{ width }} className="px-4">
            <ChamferBackdrop size={chamfer.lg} fill={colors.stone} className="items-center justify-center" style={{ height: width * 1.15 }}>
              <GarmentArt item={{ ...item, image: img?.url ?? null, color: color ?? item.color }} width={width * 0.6} />
              {i === 0 && status && <Text className="absolute left-8 top-4 bg-forest px-2 py-1 font-sans-medium text-label uppercase text-canvas">{status}</Text>}
              {img?.label && <Text className="absolute bottom-4 left-8 font-sans-medium text-label uppercase text-forest/70">{img.label}</Text>}
            </ChamferBackdrop>
          </View>
        ))}
      </ScrollView>
      {pages.length > 1 && (
        <Text accessibilityLabel={`Photo ${page + 1} of ${pages.length}`} className="mt-3 text-center font-sans-medium text-label uppercase text-forest/60">
          {page + 1} / {pages.length}
        </Text>
      )}
    </View>
  );
}
