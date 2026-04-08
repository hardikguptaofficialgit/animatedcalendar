"use client";

import { useMemo } from "react";
import { useShallow } from "zustand/react/shallow";
import { daysBetween } from "@/lib/date";
import { useCalendarStore } from "@/store/use-calendar-store";

export function useDateRange() {
  const state = useCalendarStore(
    useShallow((store) => ({
      ranges: store.ranges,
      draftRangeStart: store.draftRangeStart,
      hoverDate: store.hoverDate,
      multiRangeEnabled: store.multiRangeEnabled,
      setMultiRangeEnabled: store.setMultiRangeEnabled,
      startRange: store.startRange,
      completeRange: store.completeRange,
      updateHoverDate: store.updateHoverDate,
      clearSelection: store.clearSelection,
      removeRange: store.removeRange,
    }))
  );

  const hoverPreviewLength = useMemo(() => {
    if (!state.draftRangeStart || !state.hoverDate) {
      return 0;
    }
    return daysBetween(state.draftRangeStart, state.hoverDate);
  }, [state.draftRangeStart, state.hoverDate]);

  return {
    ...state,
    hoverPreviewLength,
  };
}
