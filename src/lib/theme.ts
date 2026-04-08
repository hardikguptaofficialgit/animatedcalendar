import { AccentColor, ThemeMode } from "@/types/calendar";

export const accentValues: Record<AccentColor, { accent: string; soft: string; contrast: string }> = {
  teal: { accent: "#0F766E", soft: "#DCECE9", contrast: "#F5F3EE" },
  brick: { accent: "#9A4B3B", soft: "#EEDFD8", contrast: "#F8F3F0" },
  amber: { accent: "#A4662C", soft: "#F0E2CF", contrast: "#FBF3E7" },
  slate: { accent: "#46556B", soft: "#D9E1E9", contrast: "#F4F6F8" },
};

export function isAccentColor(value: unknown): value is AccentColor {
  return typeof value === "string" && value in accentValues;
}

export function isThemeMode(value: unknown): value is ThemeMode {
  return value === "light" || value === "dark";
}

export function applyThemeTokens(theme: ThemeMode, accent: AccentColor) {
  if (typeof document === "undefined") {
    return;
  }

  const tokens = accentValues[accent];
  document.documentElement.classList.toggle("dark", theme === "dark");
  document.documentElement.style.setProperty("--accent", tokens.accent);
  document.documentElement.style.setProperty("--accent-soft", tokens.soft);
  document.documentElement.style.setProperty("--accent-contrast", tokens.contrast);
}
