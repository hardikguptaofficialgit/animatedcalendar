"use client";

import { ReactNode, useEffect } from "react";
import { useTheme } from "@/hooks/use-theme";
import { applyThemeTokens } from "@/lib/theme";

export function AppProviders({ children }: { children: ReactNode }) {
  const theme = useTheme();

  useEffect(() => {
    applyThemeTokens(theme.mode, theme.accent);
  }, [theme.accent, theme.mode]);

  return children;
}
