import { useState } from "react";
import { View, type ViewProps } from "react-native";
import Svg, { Path } from "react-native-svg";
import { chamferPath } from "@repo/ui";

/** Chamfered backdrop (top-left + bottom-right clipped) drawn as an SVG path sized to the box. */
export function ChamferBackdrop({ size, fill, className, children, ...rest }: ViewProps & { size: number; fill: string; className?: string }) {
  const [box, setBox] = useState({ w: 0, h: 0 });
  return (
    <View className={className} {...rest} onLayout={(e) => setBox({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}>
      {box.w > 0 && (
        <Svg width={box.w} height={box.h} style={{ position: "absolute" }} accessible={false}>
          <Path d={chamferPath(box.w, box.h, size)} fill={fill} />
        </Svg>
      )}
      {children}
    </View>
  );
}
