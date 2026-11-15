import { createContext, use } from "react";
import { useColorScheme } from "react-native";

import { type AccentName, DEFAULT_ACCENT, paletteFor } from "@/constants/theme";

/** The accent chosen in Settings. Without a provider (tests), the default green. */
export const AccentContext = createContext<AccentName>(DEFAULT_ACCENT);

export function useTheme() {
  return paletteFor(useColorScheme() === "dark" ? "dark" : "light", use(AccentContext));
}
