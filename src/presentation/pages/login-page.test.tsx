import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
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

afterEach(cleanup);

describe("LoginPage", () => {
  it("informa la restauración de sesión y muestra la versión del build", () => {
    render(
      <ThemeProvider>
        <AuthContext.Provider value={restoringUser}>
          <MemoryRouter>
            <LoginPage />
          </MemoryRouter>
        </AuthContext.Provider>
      </ThemeProvider>,
    );

    expect(screen.getByRole("button", { name: "Restaurando sesión…" })).toBeDisabled();
    expect(screen.getByText(/^Versión v\d+\.\d+\.\d+ · /)).toBeInTheDocument();
  });
});
