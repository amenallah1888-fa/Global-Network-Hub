import colors from "@/constants/colors";
import { useTheme } from "@/context/ThemeContext";

/**
 * Returns the design tokens for the current color scheme.
 *
 * The returned object contains all color tokens for the active palette
 * plus scheme-independent values like `radius`.
 *
 * The active scheme is driven by `ThemeContext` (system / light / dark),
 * which persists the user's choice and resolves "system" against the
 * device's appearance setting. Falls back to the light palette when no
 * dark key is defined in constants/colors.ts.
 */
export function useColors() {
  const { resolvedScheme } = useTheme();
  const palette = resolvedScheme === "dark" ? colors.dark : colors.light;
  return { ...palette, radius: colors.radius };
}
