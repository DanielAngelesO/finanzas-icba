import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { loadAppConfig } from "../config/google-sheets";
import { App } from "./app";
import { ThemeProvider } from "./theme/theme-provider";

afterEach(() => {
  cleanup();
  window.history.replaceState({}, "", "/");
  vi.unstubAllGlobals();
});

describe("modo de revisión local", () => {
  beforeEach(() => {
    window.history.replaceState({}, "", "/control/fuente");
  });

  it("arranca autenticado, muestra la fuente en memoria y no consulta Google", async () => {
    const fetchMock = vi.fn<typeof fetch>();
    vi.stubGlobal("fetch", fetchMock);

    const config = loadAppConfig({ MODE: "review", DEV: true });
    render(
      <ThemeProvider>
        <App config={config} />
      </ThemeProvider>,
    );

    expect(await screen.findByRole("heading", { name: "Fuente de datos" })).toBeInTheDocument();
    expect(screen.getByTestId("review-mode-banner")).toHaveTextContent(
      "Modo revisión local · datos sintéticos · Google Sheets no se consulta",
    );
    expect(screen.getByText("Revisión local")).toBeInTheDocument();
    expect((await screen.findAllByText("Memoria")).length).toBeGreaterThanOrEqual(2);
    expect(screen.queryByText("Cerrar sesión")).not.toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(
      document.querySelector('script[src="https://accounts.google.com/gsi/client"]'),
    ).not.toBeInTheDocument();
  });

  it("mantiene la pantalla sin configurar fuera del modo review", () => {
    render(
      <ThemeProvider>
        <App config={{ kind: "unconfigured", errors: ["Falta configurar Google Sheets."] }} />
      </ThemeProvider>,
    );

    expect(
      screen.getByRole("heading", { name: "Falta configurar Google Sheets" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Falta configurar Google Sheets.")).toBeInTheDocument();
  });
});
