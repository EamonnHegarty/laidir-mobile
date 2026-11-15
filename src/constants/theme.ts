// "Glas" (Irish for green): Láidir's palette. Green carries both the brand and "set done", and
// stays readable across a gym. Light and dark follow the phone's setting.
export const Colors = {
  light: {
    text: "#0F1A14",
    textSecondary: "#56655C",
    background: "#F7FAF8",
    backgroundElement: "#E6EEE9",
    border: "#D2DDD6",
    // Darker green in light mode so white text on it and green text on the page both pass contrast.
    tint: "#167A43",
    onTint: "#FFFFFF",
    danger: "#C62828",
    success: "#167A43",
    doneRow: "#D7F0E0",
  },
  dark: {
    text: "#E8EFEA",
    textSecondary: "#9AA59F",
    background: "#0B0F0D",
    backgroundElement: "#16201B",
    border: "#24302A",
    tint: "#3DDC84",
    onTint: "#08130D",
    danger: "#FF6B5E",
    success: "#3DDC84",
    doneRow: "#173A27",
  },
} as const;

export type ColorScheme = keyof typeof Colors;
export type ThemeColor = keyof (typeof Colors)["light"];

/** Brand colours used outside React (app icon, splash, notifications). */
export const Brand = {
  green: "#3DDC84",
  iconBackground: "#0E1A14",
  splashBackground: "#0B0F0D",
} as const;

export const Spacing = {
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
} as const;
