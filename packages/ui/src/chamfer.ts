/** CSS clip-path clipping the top-left and bottom-right corners by `size` px. */
export const chamferClipPath = (size: number) =>
  `polygon(${size}px 0, 100% 0, 100% calc(100% - ${size}px), calc(100% - ${size}px) 100%, 0 100%, 0 ${size}px)`;

/** Same shape as an SVG path `d` for a w×h box (mobile masks via react-native-svg). */
export const chamferPath = (w: number, h: number, size: number) =>
  `M${size} 0H${w}V${h - size}L${w - size} ${h}H0V${size}Z`;
