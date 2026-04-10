import { useEffect, useRef } from "react";
import { Animated, StyleSheet, Text, View } from "react-native";
import { useThemePrefs } from "@/store/theme";

interface SuccessToastProps {
  visible: boolean;
  message: string;
  subtitle?: string;
  durationMs?: number;
  onHidden?: () => void;
}

export function SuccessToast({
  visible,
  message,
  subtitle,
  durationMs = 1400,
  onHidden,
}: SuccessToastProps) {
  const { colors } = useThemePrefs();
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(-10)).current;

  useEffect(() => {
    if (!visible) return;

    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 180,
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration: 180,
        useNativeDriver: true,
      }),
    ]).start();

    const timer = setTimeout(() => {
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 0,
          duration: 180,
          useNativeDriver: true,
        }),
        Animated.timing(translateY, {
          toValue: -8,
          duration: 180,
          useNativeDriver: true,
        }),
      ]).start(() => onHidden?.());
    }, durationMs);

    return () => {
      clearTimeout(timer);
    };
  }, [visible, durationMs, onHidden, opacity, translateY]);

  if (!visible) return null;

  return (
    <View pointerEvents="none" style={styles.host}>
      <Animated.View
        style={[
          styles.toast,
          {
            backgroundColor: colors.toneSuccessBg,
            borderColor: colors.success,
            shadowColor: colors.shadow,
            opacity,
            transform: [{ translateY }],
          },
        ]}
      >
        <Text style={[styles.message, { color: colors.toneSuccessText }]}>{message}</Text>
        {subtitle ? <Text style={[styles.subtitle, { color: colors.toneSuccessText }]}>{subtitle}</Text> : null}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  host: {
    position: "absolute",
    top: 12,
    left: 16,
    right: 16,
    zIndex: 30,
  },
  toast: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 4,
  },
  message: {
    fontSize: 14,
    fontWeight: "700",
  },
  subtitle: {
    fontSize: 12,
    marginTop: 2,
    opacity: 0.92,
  },
});
