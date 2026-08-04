import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { loadAppConfig } from "./config/google-sheets";
import { App } from "./presentation/app";
import { ThemeProvider } from "./presentation/theme/theme-provider";
import "./styles.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ThemeProvider>
      <App config={loadAppConfig()} />
    </ThemeProvider>
  </StrictMode>,
);
