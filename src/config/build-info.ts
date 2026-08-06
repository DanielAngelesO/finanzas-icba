const version = import.meta.env.VITE_APP_VERSION ?? "0.0.0";
const commit = import.meta.env.VITE_APP_COMMIT ?? "local";

export const appBuildLabel = `v${version} · ${commit}`;
