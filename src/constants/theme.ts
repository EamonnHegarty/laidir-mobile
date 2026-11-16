// "Glas" (Irish for green): Láidir's palette. The base is a neutral grey so every accent sits on it
// cleanly; the accent (green by default) carries the brand and "set done". Light, dark or the
// phone's setting is chosen in Settings.
export const Colors = {
  light: {
    text: "#121417",
    textSecondary: "#545B64",
    /** Placeholders and hints in fields: lighter than secondary text but still readable. */
    placeholder: "#6B727C",
    background: "#F3F4F6",
    backgroundElement: "#FFFFFF",
    /** Inputs, unticked boxes and other inactive controls on a card. */
    control: "#E6E8EC",
    border: "#D9DCE1",
    // Darker green in light mode so white text on it and green text on the page both pass contrast.
    tint: "#167A43",
    onTint: "#FFFFFF",
    danger: "#C62828",
    success: "#167A43",
    doneRow: "#D7F0E0",
  },
  dark: {
    text: "#ECEDEF",
    textSecondary: "#A6ABB3",
    placeholder: "#8A9099",
    background: "#111214",
    backgroundElement: "#1C1D21",
    control: "#2B2D33",
    border: "#30333A",
    tint: "#3DDC84",
    onTint: "#08130D",
    danger: "#FF6B5E",
    success: "#3DDC84",
    doneRow: "#173A27",
  },
} as const;

export type ColorScheme = keyof typeof Colors;
export type ThemeColor = keyof (typeof Colors)["light"];

/** Light, dark, or follow the phone (Settings → Appearance; device-only). */
export const APPEARANCES = ["system", "light", "dark"] as const;
export type Appearance = (typeof APPEARANCES)[number];
export const DEFAULT_APPEARANCE: Appearance = "system";
export function isAppearance(value: unknown): value is Appearance {
  return typeof value === "string" && (APPEARANCES as readonly string[]).includes(value);
}

/** Brand colours used outside React (app icon, splash, notifications). */
export const Brand = {
  green: "#3DDC84",
  iconBackground: "#0E1A14",
  splashBackground: "#111214",
} as const;

export const Spacing = {
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
} as const;

/**
 * Accent colours the user can pick in Settings (device-only). Each replaces the green roles of the
 * palette (tint, onTint, success, doneRow) in light and dark; backgrounds and text stay the same.
 * Light-mode tints are dark enough for white text on them and for text on the page.
 */
export const Accents = {
  glas: {
    name: "Glas",
    description: "Green",
    light: { tint: "#167A43", onTint: "#FFFFFF", doneRow: "#D7F0E0" },
    dark: { tint: "#3DDC84", onTint: "#08130D", doneRow: "#173A27" },
  },
  farraige: {
    name: "Farraige",
    description: "Sea blue",
    light: { tint: "#1565C0", onTint: "#FFFFFF", doneRow: "#D6E8FA" },
    dark: { tint: "#4FB3FF", onTint: "#06121C", doneRow: "#12304A" },
  },
  omra: {
    name: "Ómra",
    description: "Amber",
    light: { tint: "#A65F00", onTint: "#FFFFFF", doneRow: "#FBE9CC" },
    dark: { tint: "#FFB547", onTint: "#1C1204", doneRow: "#43300F" },
  },
  corcra: {
    name: "Corcra",
    description: "Purple",
    light: { tint: "#6A3FC8", onTint: "#FFFFFF", doneRow: "#E7DDFB" },
    dark: { tint: "#B794FF", onTint: "#150B26", doneRow: "#2E2350" },
  },
  ros: {
    name: "Rós",
    description: "Pink",
    light: { tint: "#B8326A", onTint: "#FFFFFF", doneRow: "#F9DCE7" },
    dark: { tint: "#FF7AA8", onTint: "#22070F", doneRow: "#4A1A2C" },
  },
} as const;

export type AccentName = keyof typeof Accents;
export const ACCENT_NAMES = Object.keys(Accents) as AccentName[];
export const DEFAULT_ACCENT: AccentName = "glas";

export function isAccentName(value: unknown): value is AccentName {
  return typeof value === "string" && value in Accents;
}

/** The full palette for a colour scheme with an accent applied. */
export function paletteFor(scheme: ColorScheme, accent: AccentName) {
  const a = Accents[accent][scheme];
  return { ...Colors[scheme], tint: a.tint, onTint: a.onTint, success: a.tint, doneRow: a.doneRow };
}
