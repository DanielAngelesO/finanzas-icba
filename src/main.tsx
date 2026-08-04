import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { loadAppConfig } from "./config/google-sheets";
import { App } from "./presentation/app";
import "./styles.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App config={loadAppConfig()} />
  </StrictMode>,
);
