import { StyleSheet, Text } from "react-native";
import Animated, { type SharedValue, useAnimatedStyle } from "react-native-reanimated";

import { Spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";

import { Icon } from "./icon";

/**
 * The red "Delete" panel behind a swipe-to-delete row. It sits under the row all the time, so it
 * stays fully transparent until the row actually moves; otherwise its edge shows around the row's
 * rounded corners. Pass ReanimatedSwipeable's `translation` from `renderRightActions`.
 */
export function SwipeDeleteAction({ translation }: { translation: SharedValue<number> }) {
  const theme = useTheme();
  const visible = useAnimatedStyle(() => ({ opacity: translation.value < -1 ? 1 : 0 }));
  return (
    <Animated.View style={[styles.action, { backgroundColor: theme.danger }, visible]}>
      <Icon name="delete" size={20} color={theme.onTint} />
      <Text style={[styles.text, { color: theme.onTint }]}>Delete</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  action: {
    width: 88,
    marginLeft: Spacing.one,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
  },
  text: { fontSize: 12, fontWeight: 600 },
});
