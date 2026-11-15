import { type AndroidSymbol, SymbolView } from "expo-symbols";
import type { ColorValue, StyleProp, ViewStyle } from "react-native";

import { useTheme } from "@/hooks/use-theme";

export type IconName = AndroidSymbol;

/**
 * A Material Symbol (outlined). Android draws it from a bundled font, so it needs no native code
 * beyond expo-symbols. Decorative by default: give the surrounding control the spoken label.
 */
export function Icon({
  name,
  size = 20,
  color,
  style,
}: {
  name: IconName;
  size?: number;
  color?: ColorValue;
  style?: StyleProp<ViewStyle>;
}) {
  const theme = useTheme();
  return (
    <SymbolView
      name={{ android: name, web: name }}
      size={size}
      tintColor={color ?? theme.textSecondary}
      style={[{ width: size, height: size }, style]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    />
  );
}
