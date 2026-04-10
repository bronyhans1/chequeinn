import type { PressableStateCallbackType, StyleProp, ViewStyle } from "react-native";

/** Subtle default press opacity for primary surfaces. */
export function pressOpacity(pressed: boolean, opacity = 0.88): ViewStyle {
  return { opacity: pressed ? opacity : 1 };
}

/** For Pressable `style` prop: `style={s => [base, pressStyle(s)]}`. */
export function pressStyle(
  state: PressableStateCallbackType,
  options?: { opacity?: number; scale?: number }
): StyleProp<ViewStyle> {
  const { opacity = 0.88, scale } = options ?? {};
  if (scale != null && state.pressed) {
    return { opacity, transform: [{ scale }] };
  }
  return { opacity: state.pressed ? opacity : 1 };
}
