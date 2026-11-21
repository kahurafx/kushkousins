import type { WithSpringConfig } from "react-native-reanimated";
import { spring } from "@repo/ui";

/** @repo/ui springs → Reanimated (DESIGN.md: duration = visualDuration, dampingRatio = 1 − bounce). */
export const rnSpring = (s: { bounce: number; visualDuration: number }): WithSpringConfig => ({
  duration: s.visualDuration * 1000,
  dampingRatio: 1 - s.bounce,
});
export const springDefault = rnSpring(spring.default);
export const springSnappy = rnSpring(spring.snappy);
