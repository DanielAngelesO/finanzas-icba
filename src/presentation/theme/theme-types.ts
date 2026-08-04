export type ThemePreference = "system" | "light" | "dark";
export type ResolvedTheme = Exclude<ThemePreference, "system">;

export const themeStorageKey = "finanzas-icba.theme";

export interface ThemeContextValue {
  preference: ThemePreference;
  resolvedTheme: ResolvedTheme;
  setPreference: (preference: ThemePreference) => void;
}

const isThemePreference = (value: string | null): value is ThemePreference =>
  value === "system" || value === "light" || value === "dark";

export const getSystemTheme = (): ResolvedTheme =>
  typeof window !== "undefined" &&
  typeof window.matchMedia === "function" &&
  window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";

export const resolveTheme = (preference: ThemePreference): ResolvedTheme =>
  preference === "system" ? getSystemTheme() : preference;

export const readThemePreference = (): ThemePreference => {
  if (typeof window === "undefined") return "system";
  try {
    const storedPreference = window.localStorage.getItem(themeStorageKey);
    return isThemePreference(storedPreference) ? storedPreference : "system";
  } catch {
    return "system";
  }
};
