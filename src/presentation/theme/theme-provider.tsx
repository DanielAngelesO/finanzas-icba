import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { ThemeContext } from "./theme-context";
import {
  getSystemTheme,
  readThemePreference,
  themeStorageKey,
  type ResolvedTheme,
  type ThemeContextValue,
  type ThemePreference,
} from "./theme-types";

const applyTheme = (theme: ResolvedTheme) => {
  const root = document.documentElement;
  root.dataset.theme = theme;
  root.style.colorScheme = theme;
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute("content", theme === "dark" ? "#0A0E1A" : "#F6F8F7");
};

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [preference, setPreference] = useState<ThemePreference>(readThemePreference);
  const [systemTheme, setSystemTheme] = useState<ResolvedTheme>(getSystemTheme);
  const resolvedTheme = preference === "system" ? systemTheme : preference;

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const updateSystemTheme = () => setSystemTheme(mediaQuery.matches ? "dark" : "light");
    updateSystemTheme();
    mediaQuery.addEventListener("change", updateSystemTheme);
    return () => mediaQuery.removeEventListener("change", updateSystemTheme);
  }, []);

  useEffect(() => {
    applyTheme(resolvedTheme);
  }, [resolvedTheme]);

  const setThemePreference = useCallback((nextPreference: ThemePreference) => {
    setPreference(nextPreference);
    try {
      window.localStorage.setItem(themeStorageKey, nextPreference);
    } catch {
      // La interfaz sigue funcionando cuando el almacenamiento está deshabilitado.
    }
  }, []);

  const value = useMemo<ThemeContextValue>(
    () => ({ preference, resolvedTheme, setPreference: setThemePreference }),
    [preference, resolvedTheme, setThemePreference],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
