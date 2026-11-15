export const Colors = {
  light: {
    text: "#11181C",
    textSecondary: "#60646C",
    background: "#FFFFFF",
    backgroundElement: "#F0F0F3",
    tint: "#1F7AE0",
    onTint: "#FFFFFF",
    danger: "#D93025",
    success: "#1E8E3E",
    doneRow: "#E6F4EA",
  },
  dark: {
    text: "#ECEDEE",
    textSecondary: "#B0B4BA",
    background: "#000000",
    backgroundElement: "#212225",
    tint: "#4FA3F7",
    onTint: "#000000",
    danger: "#FF6B5E",
    success: "#34A853",
    doneRow: "#0F2A17",
  },
} as const;

export type ColorScheme = keyof typeof Colors;
export type ThemeColor = keyof (typeof Colors)["light"];

export const Spacing = {
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
} as const;
