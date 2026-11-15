import { Pressable, StyleSheet, Text, useColorScheme, View } from "react-native";

import { Icon } from "@/components/icon";
import { ACCENT_NAMES, type AccentName, Accents } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";

/** A swatch per accent colour; the chosen one is ringed and ticked. */
export function AccentPicker({
  value,
  onChange,
}: {
  value: AccentName;
  onChange: (accent: AccentName) => void;
}) {
  const theme = useTheme();
  const scheme = useColorScheme() === "dark" ? "dark" : "light";
  return (
    <View style={styles.grid} accessibilityRole="radiogroup">
      {ACCENT_NAMES.map((name) => {
        const accent = Accents[name];
        const colours = accent[scheme];
        const selected = name === value;
        return (
          <Pressable
            key={name}
            onPress={() => onChange(name)}
            accessibilityRole="radio"
            accessibilityState={{ checked: selected }}
            accessibilityLabel={`${accent.name}, ${accent.description}`}
            style={({ pressed }) => [
              styles.option,
              {
                backgroundColor: theme.backgroundElement,
                borderColor: selected ? colours.tint : "transparent",
              },
              pressed && { opacity: 0.7 },
            ]}
          >
            <View style={[styles.swatch, { backgroundColor: colours.tint }]}>
              {selected ? <Icon name="check" size={18} color={colours.onTint} /> : null}
            </View>
            <Text style={[styles.name, { color: theme.text }]} numberOfLines={1}>
              {accent.name}
            </Text>
            <Text style={[styles.description, { color: theme.textSecondary }]} numberOfLines={1}>
              {accent.description}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  option: {
    width: "31%",
    flexGrow: 1,
    alignItems: "center",
    gap: 4,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 2,
  },
  swatch: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  name: { fontSize: 14, fontWeight: 600 },
  description: { fontSize: 12 },
});
