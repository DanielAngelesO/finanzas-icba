import { appBuildLabel } from "../../config/build-info";

interface AppVersionProps {
  className?: string;
}

export function AppVersion({ className }: AppVersionProps) {
  return <p className={className}>Versión {appBuildLabel}</p>;
}
