"use client";

import { useShallow } from "zustand/react/shallow";
import { useCalendarStore } from "@/store/use-calendar-store";

export function useTheme() {
  return useCalendarStore(
    useShallow((store) => ({
      mode: store.theme,
      accent: store.accent,
      soundEnabled: store.soundEnabled,
      setTheme: store.setTheme,
      setAccent: store.setAccent,
      setSoundEnabled: store.setSoundEnabled,
    }))
  );
}
