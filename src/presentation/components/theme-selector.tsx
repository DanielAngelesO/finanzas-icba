import type { ComponentType } from "react";
import { useTheme } from "../theme/use-theme";
import type { ThemePreference } from "../theme/theme-types";

function SystemIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6">
      <rect x="3" y="3.5" width="14" height="10" rx="1.5" />
      <path d="M7.5 16.5h5M10 13.5v3" />
    </svg>
  );
}

function SunIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6">
      <circle cx="10" cy="10" r="3.25" />
      <path d="M10 1.75v2M10 16.25v2M18.25 10h-2M3.75 10h-2M15.83 4.17l-1.42 1.42M5.59 14.41l-1.42 1.42M15.83 15.83l-1.42-1.42M5.59 5.59 4.17 4.17" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6">
      <path d="M16.9 12.53A7.25 7.25 0 0 1 7.47 3.1 7.25 7.25 0 1 0 16.9 12.53Z" />
    </svg>
  );
}

const options: ReadonlyArray<{
  value: ThemePreference;
  label: string;
  Icon: ComponentType;
}> = [
  { value: "system", label: "Sistema", Icon: SystemIcon },
  { value: "light", label: "Claro", Icon: SunIcon },
  { value: "dark", label: "Oscuro", Icon: MoonIcon },
];

export function ThemeSelector({ variant = "full" }: { variant?: "full" | "compact" }) {
  const { preference, setPreference } = useTheme();

  return (
    <div
      className={variant === "compact" ? "theme-selector theme-selector-compact" : "theme-selector"}
      role="group"
      aria-label="Tema de apariencia"
    >
      {options.map(({ value, label, Icon }) => {
        const selected = preference === value;
        return (
          <button
            aria-label={`Usar tema ${label.toLocaleLowerCase("es-PE")}`}
            aria-pressed={selected}
            className={
              selected
                ? "theme-selector-option theme-selector-option-active"
                : "theme-selector-option"
            }
            key={value}
            onClick={() => setPreference(value)}
            title={label}
            type="button"
          >
            <Icon />
            <span className={variant === "compact" ? "sr-only" : undefined}>{label}</span>
          </button>
        );
      })}
    </div>
  );
}
