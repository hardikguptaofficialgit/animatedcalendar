"use client";

import { useMemo } from "react";
import { useShallow } from "zustand/react/shallow";
import { useCalendarStore } from "@/store/use-calendar-store";

export function useNotes() {
  const state = useCalendarStore(
    useShallow((store) => ({
      notes: store.notes,
      notesFilter: store.notesFilter,
      filterDate: store.filterDate,
      filterRangeId: store.filterRangeId,
      visibleMonth: store.visibleMonth,
      ranges: store.ranges,
      addNote: store.addNote,
      updateNote: store.updateNote,
      deleteNote: store.deleteNote,
      setNotesFilter: store.setNotesFilter,
      exportPlainText: store.exportPlainText,
      importState: store.importState,
      notesPanelOpen: store.notesPanelOpen,
      setNotesPanelOpen: store.setNotesPanelOpen,
    }))
  );

  const filteredNotes = useMemo(() => {
    switch (state.notesFilter) {
      case "day":
        return state.notes.filter((note) => note.date === state.filterDate);
      case "range":
        return state.notes.filter((note) => note.rangeId === state.filterRangeId);
      case "month":
        return state.notes.filter((note) => note.monthKey === state.visibleMonth);
      default:
        return state.notes;
    }
  }, [state.filterDate, state.filterRangeId, state.notes, state.notesFilter, state.visibleMonth]);

  const currentRange = useMemo(
    () => state.ranges.find((range) => range.id === state.filterRangeId) ?? null,
    [state.filterRangeId, state.ranges]
  );

  return {
    ...state,
    filteredNotes,
    currentRange,
  };
}
