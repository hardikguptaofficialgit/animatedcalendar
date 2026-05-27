"use client";

import { useMemo } from "react";
import { useShallow } from "zustand/react/shallow";
import { mockEvents } from "@/data/mock-events";
import { monthImageMap } from "@/data/month-images";
import {
  compareDates,
  enumerateDates,
  getMonthLabel,
  getMonthMatrix,
  getWeekdayLabels,
  isDateWithinRange,
  isToday,
  monthContainsDate,
  parseMonthKey,
  toIsoDate,
} from "@/lib/date";
import { useCalendarStore } from "@/store/use-calendar-store";

export function useCalendar() {
  const state = useCalendarStore(
    useShallow((store) => ({
      visibleMonth: store.visibleMonth,
      focusedDate: store.focusedDate,
      selectedDate: store.selectedDate,
      draftRangeStart: store.draftRangeStart,
      hoverDate: store.hoverDate,
      ranges: store.ranges,
      multiRangeEnabled: store.multiRangeEnabled,
      viewMode: store.viewMode,
      navigationMode: store.navigationMode,
      soundEnabled: store.soundEnabled,
      notes: store.notes,
      monthImages: store.monthImages,
      setVisibleMonth: store.setVisibleMonth,
      shiftMonth: store.shiftMonth,
      setFocusedDate: store.setFocusedDate,
      setSelectedDate: store.setSelectedDate,
      startRange: store.startRange,
      completeRange: store.completeRange,
      updateHoverDate: store.updateHoverDate,
      clearSelection: store.clearSelection,
      removeRange: store.removeRange,
      openContextMenu: store.openContextMenu,
      closeContextMenu: store.closeContextMenu,
      contextMenu: store.contextMenu,
      setViewMode: store.setViewMode,
      setNavigationMode: store.setNavigationMode,
      setMultiRangeEnabled: store.setMultiRangeEnabled,
      setSoundEnabled: store.setSoundEnabled,
      setNotesPanelOpen: store.setNotesPanelOpen,
      setNotesFilter: store.setNotesFilter,
      notesPanelOpen: store.notesPanelOpen,
      undo: store.undo,
      redo: store.redo,
    }))
  );

  const monthDate = parseMonthKey(state.visibleMonth);
  const image = state.monthImages[state.visibleMonth] ?? monthImageMap[monthDate.getUTCMonth()].src;

  const weekdayLabels = useMemo(() => getWeekdayLabels(), []);
  const weeks = useMemo(
    () => getMonthMatrix(state.visibleMonth, state.focusedDate, state.viewMode),
    [state.focusedDate, state.viewMode, state.visibleMonth]
  );

  const hoverRange = useMemo(() => {
    if (!state.draftRangeStart || !state.hoverDate) {
      return null;
    }
    return compareDates(state.draftRangeStart, state.hoverDate) <= 0
      ? { start: state.draftRangeStart, end: state.hoverDate }
      : { start: state.hoverDate, end: state.draftRangeStart };
  }, [state.draftRangeStart, state.hoverDate]);

  const eventsByDate = useMemo(
    () =>
      mockEvents.reduce<Record<string, typeof mockEvents>>((accumulator, event) => {
        accumulator[event.date] = [...(accumulator[event.date] ?? []), event];
        return accumulator;
      }, {}),
    []
  );

  const notesByDate = useMemo(
    () =>
      state.notes.reduce<Record<string, number>>((accumulator, note) => {
        if (note.scope === "day" && note.date) {
          accumulator[note.date] = (accumulator[note.date] ?? 0) + 1;
        }
        if (note.scope === "range" && note.rangeId) {
          const range = state.ranges.find((item) => item.id === note.rangeId);
          if (range) {
            enumerateDates(range.start, range.end).forEach((date) => {
              accumulator[date] = (accumulator[date] ?? 0) + 1;
            });
          }
        }
        return accumulator;
      }, {}),
    [state.notes, state.ranges]
  );

  const metadataByDate = useMemo(() => {
    return weeks.flat().reduce<Record<string, {
      inMonth: boolean;
      today: boolean;
      selected: boolean;
      rangeStart: boolean;
      rangeEnd: boolean;
      inConfirmedRange: boolean;
      noteCount: number;
    }>>((accumulator, day) => {
      const isoDate = toIsoDate(day);
      const inConfirmedRange = state.ranges.some((range) => isDateWithinRange(isoDate, range));
      const rangeStart = state.ranges.some((range) => range.start === isoDate);
      const rangeEnd = state.ranges.some((range) => range.end === isoDate);

      accumulator[isoDate] = {
        inMonth: monthContainsDate(state.visibleMonth, isoDate),
        today: isToday(isoDate),
        selected: state.selectedDate === isoDate,
        rangeStart,
        rangeEnd,
        inConfirmedRange,
        noteCount: notesByDate[isoDate] ?? 0,
      };

      return accumulator;
    }, {});
  }, [notesByDate, state.ranges, state.selectedDate, state.visibleMonth, weeks]);

  return {
    ...state,
    image,
    monthLabel: getMonthLabel(state.visibleMonth),
    weekdayLabels,
    weeks,
    eventsByDate,
    metadataByDate,
    hoverRange,
    monthDate,
  };
}
