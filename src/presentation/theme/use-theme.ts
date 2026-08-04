import { useContext } from "react";
import { ThemeContext } from "./theme-context";
import type { ThemeContextValue } from "./theme-types";

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("useTheme debe usarse dentro de ThemeProvider.");
  return context;
}
