import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

const packageMetadata: unknown = JSON.parse(
  readFileSync(new URL("./package.json", import.meta.url), "utf8"),
);

const getPackageVersion = () => {
  if (
    typeof packageMetadata === "object" &&
    packageMetadata !== null &&
    "version" in packageMetadata &&
    typeof packageMetadata.version === "string"
  ) {
    return packageMetadata.version;
  }
  throw new Error("No se encontró una versión válida en package.json.");
};

const readGitOutput = (arguments_: string[]) => {
  try {
    return execFileSync("git", arguments_, { encoding: "utf8" }).trim() || null;
  } catch {
    return null;
  }
};

const configuredCommit = [
  process.env.VITE_APP_COMMIT_SHA,
  process.env.VERCEL_GIT_COMMIT_SHA,
  process.env.CF_PAGES_COMMIT_SHA,
  process.env.GITHUB_SHA,
].find((commit): commit is string => typeof commit === "string" && commit.length > 0);
const localCommit = readGitOutput(["rev-parse", "--short=7", "HEAD"]);
const localChanges = readGitOutput(["status", "--porcelain", "--", ".", ":(exclude)workspace"]);
const buildCommit = configuredCommit
  ? configuredCommit.slice(0, 7)
  : localCommit
    ? `${localCommit}${localChanges ? "-dirty" : ""}`
    : "local";

export default defineConfig(({ command, mode }) => {
  if (command === "build" && mode === "review") {
    throw new Error(
      "El modo de revisión local solo puede ejecutarse con Vite dev; no se permite generar un build.",
    );
  }

  return {
    plugins: [react(), tailwindcss()],
    define: {
      "import.meta.env.VITE_APP_VERSION": JSON.stringify(getPackageVersion()),
      "import.meta.env.VITE_APP_COMMIT": JSON.stringify(buildCommit),
    },
    server: {
      host: mode === "review" ? "127.0.0.1" : true,
      port: 5173,
    },
  };
});
