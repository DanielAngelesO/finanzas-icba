import { act, cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ThemeSelector } from "../components/theme-selector";
import { ThemeProvider } from "./theme-provider";
import { useTheme } from "./use-theme";
import { themeStorageKey, type ResolvedTheme } from "./theme-types";

let systemTheme: ResolvedTheme = "light";
let systemThemeListeners = new Set<(event: MediaQueryListEvent) => void>();

const updateSystemTheme = (theme: ResolvedTheme) => {
  systemTheme = theme;
  const event = { matches: theme === "dark" } as MediaQueryListEvent;
  systemThemeListeners.forEach((listener) => listener(event));
};

const installMatchMedia = () => {
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: () =>
      ({
        get matches() {
          return systemTheme === "dark";
        },
        media: "(prefers-color-scheme: dark)",
        onchange: null,
        addEventListener: (_type: string, listener: (event: MediaQueryListEvent) => void) => {
          systemThemeListeners.add(listener);
        },
        removeEventListener: (_type: string, listener: (event: MediaQueryListEvent) => void) => {
          systemThemeListeners.delete(listener);
        },
        addListener: (listener: (event: MediaQueryListEvent) => void) => {
          systemThemeListeners.add(listener);
        },
        removeListener: (listener: (event: MediaQueryListEvent) => void) => {
          systemThemeListeners.delete(listener);
        },
        dispatchEvent: () => true,
      }) as MediaQueryList,
  });
};

function ThemeProbe() {
  const { preference, resolvedTheme } = useTheme();
  return <output>{`${preference}:${resolvedTheme}`}</output>;
}

const renderTheme = () =>
  render(
    <ThemeProvider>
      <ThemeProbe />
      <ThemeSelector />
    </ThemeProvider>,
  );

beforeEach(() => {
  systemTheme = "light";
  systemThemeListeners = new Set();
  installMatchMedia();
  window.localStorage.clear();
  delete document.documentElement.dataset.theme;
  document.documentElement.style.colorScheme = "";
});

afterEach(cleanup);

describe("tema de apariencia", () => {
  it("usa la preferencia del sistema y reacciona a sus cambios", () => {
    renderTheme();

    expect(screen.getByRole("status")).toHaveTextContent("system:light");
    expect(document.documentElement).toHaveAttribute("data-theme", "light");

    act(() => updateSystemTheme("dark"));

    expect(screen.getByRole("status")).toHaveTextContent("system:dark");
    expect(document.documentElement).toHaveAttribute("data-theme", "dark");
  });

  it("prioriza una elección guardada sobre el sistema", () => {
    window.localStorage.setItem(themeStorageKey, "dark");
    renderTheme();

    expect(screen.getByRole("status")).toHaveTextContent("dark:dark");
    act(() => updateSystemTheme("light"));
    expect(screen.getByRole("status")).toHaveTextContent("dark:dark");
  });

  it("descarta preferencias inválidas y vuelve a Sistema", () => {
    window.localStorage.setItem(themeStorageKey, "neon");
    systemTheme = "dark";
    renderTheme();

    expect(screen.getByRole("status")).toHaveTextContent("system:dark");
  });

  it("permite elegir el tema por teclado y guarda la preferencia", async () => {
    const user = userEvent.setup();
    renderTheme();

    await user.tab();
    expect(screen.getByRole("button", { name: "Usar tema sistema" })).toHaveFocus();
    await user.tab();
    await user.keyboard(" ");

    expect(screen.getByRole("status")).toHaveTextContent("light:light");
    expect(window.localStorage).toHaveProperty("getItem");
    expect(window.localStorage.getItem(themeStorageKey)).toBe("light");
    expect(screen.getByRole("button", { name: "Usar tema claro" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });
});
