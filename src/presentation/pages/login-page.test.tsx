import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes, type InitialEntry } from "react-router-dom";
import { afterEach, describe, expect, it } from "vitest";
import { AuthContext, type AuthContextValue } from "../auth/auth-context";
import { ThemeProvider } from "../theme/theme-provider";
import { LoginPage } from "./login-page";

const restoringUser: AuthContextValue = {
  state: { status: "restoring" },
  signIn: () => {},
  retryPreparation: () => {},
  signOut: () => {},
};

const authenticatedUser: AuthContextValue = {
  state: { status: "authenticated", email: "liderazgo@icba.pe", name: "Liderazgo ICBA" },
  signIn: () => {},
  retryPreparation: () => {},
  signOut: () => {},
};

const renderLoginPage = (auth: AuthContextValue, initialEntry: InitialEntry = "/ingresar") =>
  render(
    <ThemeProvider>
      <AuthContext.Provider value={auth}>
        <MemoryRouter initialEntries={[initialEntry ?? "/ingresar"]}>
          <Routes>
            <Route path="/ingresar" element={<LoginPage />} />
            <Route path="/movimientos" element={<main>Movimientos</main>} />
            <Route path="/" element={<main>Inicio</main>} />
          </Routes>
        </MemoryRouter>
      </AuthContext.Provider>
    </ThemeProvider>,
  );

afterEach(cleanup);

describe("LoginPage", () => {
  it("informa la restauración de sesión y muestra la versión del build", () => {
    renderLoginPage(restoringUser);

    expect(screen.getByRole("button", { name: "Restaurando sesión…" })).toBeDisabled();
    expect(screen.getByText(/^Versión v\d+\.\d+\.\d+ · /)).toBeInTheDocument();
  });

  it("lleva una sesión autenticada a Inicio cuando no hay ruta de origen", () => {
    renderLoginPage(authenticatedUser);

    expect(screen.getByText("Inicio")).toBeInTheDocument();
  });

  it("devuelve una sesión autenticada a la ruta de origen recordada", () => {
    renderLoginPage(authenticatedUser, {
      pathname: "/ingresar",
      state: { from: { pathname: "/movimientos", search: "?period=202608" } },
    });

    expect(screen.getByText("Movimientos")).toBeInTheDocument();
  });
});
