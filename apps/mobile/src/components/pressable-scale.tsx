import { cssInterop } from "nativewind";
import { Pressable, type PressableProps } from "react-native";
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withSpring } from "react-native-reanimated";
import { pressScale } from "@repo/ui";
import { springSnappy } from "@/lib/motion";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);
// NativeWind maps className only on core components; opt the animated one in explicitly.
cssInterop(AnimatedPressable, { className: "style" });

/** Responds on press-in (not release), interruptible spring back. */
export function PressableScale({ style, onPressIn, onPressOut, ...props }: PressableProps & { className?: string }) {
  const scale = useSharedValue(1);
  const reduce = useReducedMotion();
  const animated = useAnimatedStyle(() => ({ transform: [{ scale: scale.get() }] }));
  return (
    <AnimatedPressable
      {...props}
      style={[animated, style as never]}
      onPressIn={(e) => {
        if (!reduce) scale.set(withSpring(pressScale, springSnappy)); // .set(): React Compiler-safe
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        scale.set(withSpring(1, springSnappy));
        onPressOut?.(e);
      }}
    />
  );
}
