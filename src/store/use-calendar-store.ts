"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  AccentColor,
  CalendarActions,
  CalendarState,
  DateRange,
  HistoryState,
  NoteRecord,
} from "@/types/calendar";
import {
  addMonths,
  compareDates,
  daysBetween,
  getMonthKey,
  normalizeRange,
  toIsoDate,
} from "@/lib/date";
import { createId } from "@/lib/utils";
import { accentValues, applyThemeTokens, isAccentColor, isThemeMode } from "@/lib/theme";

const today = toIsoDate(new Date());
const currentMonth = getMonthKey(new Date());

function snapshot(state: CalendarState): HistoryState {
  return {
    notes: state.notes,
    ranges: state.ranges,
    monthImages: state.monthImages,
  };
}

function dedupe<T>(values: T[]): T[] {
  return Array.from(new Set(values));
}

function isIsoDate(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function isMonthKey(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}$/.test(value);
}

function isViewMode(value: unknown): value is CalendarState["viewMode"] {
  return value === "month" || value === "week";
}

function isNotesFilter(value: unknown): value is CalendarState["notesFilter"] {
  return value === "all" || value === "day" || value === "range" || value === "month";
}

function sanitizeImportedState(
  payload: Partial<HistoryState> & Partial<CalendarState>,
  fallback: Pick<
    CalendarState,
    | "notes"
    | "ranges"
    | "monthImages"
    | "visibleMonth"
    | "selectedDate"
    | "focusedDate"
    | "theme"
    | "accent"
    | "soundEnabled"
    | "viewMode"
    | "multiRangeEnabled"
    | "notesFilter"
    | "filterDate"
    | "filterRangeId"
  >
): Pick<
  CalendarState,
  | "notes"
  | "ranges"
  | "monthImages"
  | "visibleMonth"
  | "selectedDate"
  | "focusedDate"
  | "theme"
  | "accent"
  | "soundEnabled"
  | "viewMode"
  | "multiRangeEnabled"
  | "notesFilter"
  | "filterDate"
  | "filterRangeId"
  | "notesPanelOpen"
> {
  const importedRanges = Array.isArray(payload.ranges)
    ? payload.ranges
        .filter(
          (range): range is DateRange =>
            Boolean(range) &&
            typeof range.id === "string" &&
            isIsoDate(range.start) &&
            isIsoDate(range.end)
        )
        .map((range) => ({
          ...range,
          noteIds: Array.isArray(range.noteIds) ? dedupe(range.noteIds.filter((noteId): noteId is string => typeof noteId === "string")) : [],
        }))
    : fallback.ranges;

  const rangeIds = new Set(importedRanges.map((range) => range.id));

  const importedNotes = Array.isArray(payload.notes)
    ? payload.notes.filter((note): note is NoteRecord => {
        if (!note || typeof note.id !== "string" || typeof note.title !== "string" || typeof note.content !== "string") {
          return false;
        }

        if (note.scope === "day") {
          return isMonthKey(note.monthKey) && isIsoDate(note.date);
        }

        if (note.scope === "range") {
          return isMonthKey(note.monthKey) && typeof note.rangeId === "string" && rangeIds.has(note.rangeId);
        }

        return note.scope === "month" && isMonthKey(note.monthKey);
      })
    : fallback.notes;

  const normalizedRanges = importedRanges.map((range) => ({
    ...range,
    noteIds:
      range.noteIds.length > 0
        ? dedupe(range.noteIds.filter((noteId) => importedNotes.some((note) => note.id === noteId)))
        : dedupe(importedNotes.filter((note) => note.rangeId === range.id).map((note) => note.id)),
  }));

  const nextTheme = isThemeMode(payload.theme) ? payload.theme : fallback.theme;
  const nextAccent = isAccentColor(payload.accent) ? payload.accent : fallback.accent;
  const nextSelectedDate = isIsoDate(payload.selectedDate) ? payload.selectedDate : fallback.selectedDate;
  const nextFocusedDate = isIsoDate(payload.focusedDate)
    ? payload.focusedDate
    : nextSelectedDate ?? fallback.focusedDate ?? today;
  const nextVisibleMonth = isMonthKey(payload.visibleMonth)
    ? payload.visibleMonth
    : isIsoDate(nextFocusedDate)
      ? nextFocusedDate.slice(0, 7)
      : fallback.visibleMonth;
  const nextMonthImages =
    payload.monthImages && typeof payload.monthImages === "object"
      ? Object.fromEntries(
          Object.entries(payload.monthImages).filter(
            ([key, value]) => isMonthKey(key) && typeof value === "string" && value.length > 0
          )
        )
      : fallback.monthImages;
  const nextFilterRangeId =
    typeof payload.filterRangeId === "string" && normalizedRanges.some((range) => range.id === payload.filterRangeId)
      ? payload.filterRangeId
      : null;
  const requestedFilterDate = isIsoDate(payload.filterDate) ? payload.filterDate : nextFocusedDate;
  const requestedFilter = isNotesFilter(payload.notesFilter) ? payload.notesFilter : fallback.notesFilter;
  const nextNotesFilter =
    requestedFilter === "range"
      ? nextFilterRangeId
        ? "range"
        : "all"
      : requestedFilter === "day"
        ? requestedFilterDate
          ? "day"
          : "all"
        : requestedFilter === "month"
          ? "month"
          : "all";

  return {
    notes: importedNotes,
    ranges: normalizedRanges,
    monthImages: nextMonthImages,
    visibleMonth: nextVisibleMonth,
    selectedDate: nextSelectedDate,
    focusedDate: nextFocusedDate,
    theme: nextTheme,
    accent: nextAccent,
    soundEnabled: typeof payload.soundEnabled === "boolean" ? payload.soundEnabled : fallback.soundEnabled,
    viewMode: isViewMode(payload.viewMode) ? payload.viewMode : fallback.viewMode,
    multiRangeEnabled:
      typeof payload.multiRangeEnabled === "boolean" ? payload.multiRangeEnabled : fallback.multiRangeEnabled,
    notesFilter: nextNotesFilter,
    filterDate: requestedFilterDate,
    filterRangeId: nextFilterRangeId,
    notesPanelOpen: false,
  };
}

type CalendarStore = CalendarState & CalendarActions;
type StoreSetter = (updater: (state: CalendarStore) => Partial<CalendarStore>) => void;

function withHistory(setter: StoreSetter, updater: (state: CalendarStore) => Partial<CalendarStore>) {
  setter((state) => ({
    ...updater(state),
    historyPast: [...state.historyPast, snapshot(state)].slice(-30),
    historyFuture: [],
  }));
}

const initialState: CalendarState = {
  visibleMonth: currentMonth,
  selectedDate: today,
  focusedDate: today,
  draftRangeStart: null,
  hoverDate: null,
  ranges: [],
  multiRangeEnabled: false,
  viewMode: "month",
  theme: "light",
  accent: "teal",
  soundEnabled: true,
  notesPanelOpen: false,
  notesFilter: "all",
  filterDate: today,
  filterRangeId: null,
  notes: [],
  monthImages: {},
  contextMenu: { open: false, date: null, x: 0, y: 0 },
  historyPast: [],
  historyFuture: [],
};

export const useCalendarStore = create<CalendarStore>()(
  persist(
    (set, get) => ({
      ...initialState,
      setVisibleMonth: (month) =>
        set((state) => ({
          visibleMonth: month,
          notesFilter: state.notesFilter === "month" ? "month" : state.notesFilter,
        })),
      shiftMonth: (amount) => set((state) => ({ visibleMonth: addMonths(state.visibleMonth, amount) })),
      setFocusedDate: (date) =>
        set({
          focusedDate: date,
          filterDate: date,
          visibleMonth: getMonthKey(new Date(`${date}T00:00:00.000Z`)),
        }),
      setSelectedDate: (date) => set({ selectedDate: date, filterDate: date }),
      setTheme: (theme) => set({ theme }),
      setAccent: (accent) => {
        applyThemeTokens(get().theme, accent);
        set({ accent });
      },
      setSoundEnabled: (enabled) => set({ soundEnabled: enabled }),
      setViewMode: (mode) => set({ viewMode: mode }),
      setMultiRangeEnabled: (enabled) => set({ multiRangeEnabled: enabled }),
      setNotesPanelOpen: (open) => set({ notesPanelOpen: open }),
      startRange: (date) =>
        set({
          selectedDate: date,
          focusedDate: date,
          draftRangeStart: date,
          hoverDate: date,
          notesFilter: "day",
          filterDate: date,
        }),
      updateHoverDate: (date) => set({ hoverDate: date }),
      completeRange: (date) => {
        const state = get();
        if (!state.draftRangeStart) {
          return;
        }

        const normalized = normalizeRange(state.draftRangeStart, date);
        const nextRange: DateRange = {
          id: createId("range"),
          ...normalized,
          noteIds: [],
        };

        withHistory(set, (current) => ({
          ranges: current.multiRangeEnabled ? [...current.ranges, nextRange] : [nextRange],
          draftRangeStart: null,
          hoverDate: null,
          selectedDate: normalized.end,
          focusedDate: normalized.end,
          notesFilter: "range",
          filterRangeId: nextRange.id,
          filterDate: normalized.end,
        }));
      },
      clearSelection: () =>
        set({
          selectedDate: null,
          draftRangeStart: null,
          hoverDate: null,
          filterRangeId: null,
          notesFilter: "all",
        }),
      removeRange: (rangeId) =>
        withHistory(set, (state) => ({
          ranges: state.ranges.filter((range) => range.id !== rangeId),
          notes: state.notes.filter((note) => note.rangeId !== rangeId),
          filterRangeId: state.filterRangeId === rangeId ? null : state.filterRangeId,
          notesFilter: state.filterRangeId === rangeId ? "all" : state.notesFilter,
        })),
      setNotesFilter: (filter, options) =>
        set({
          notesFilter: filter,
          filterDate: options?.date ?? get().filterDate,
          filterRangeId: options?.rangeId ?? get().filterRangeId,
        }),
      addNote: (noteInput) => {
        const note: NoteRecord = {
          ...noteInput,
          id: createId("note"),
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };

        withHistory(set, (state) => ({
          notes: [...state.notes, note],
          ranges: state.ranges.map((range) =>
            range.id === note.rangeId
              ? { ...range, noteIds: dedupe([...range.noteIds, note.id]) }
              : range
          ),
        }));

        return note;
      },
      updateNote: (noteId, updates) =>
        withHistory(set, (state) => {
          const existingNote = state.notes.find((note) => note.id === noteId);
          if (!existingNote) {
            return {};
          }

          const nextNote = { ...existingNote, ...updates, updatedAt: Date.now() };

          return {
            notes: state.notes.map((note) => (note.id === noteId ? nextNote : note)),
            ranges: state.ranges.map((range) => {
              const withoutNote = range.noteIds.filter((id) => id !== noteId);
              if (range.id === nextNote.rangeId) {
                return { ...range, noteIds: dedupe([...withoutNote, noteId]) };
              }
              return { ...range, noteIds: withoutNote };
            }),
          };
        }),
      deleteNote: (noteId) =>
        withHistory(set, (state) => ({
          notes: state.notes.filter((note) => note.id !== noteId),
          ranges: state.ranges.map((range) => ({
            ...range,
            noteIds: range.noteIds.filter((id) => id !== noteId),
          })),
        })),
      setMonthImage: (monthKey, src) =>
        withHistory(set, (state) => ({
          monthImages: {
            ...state.monthImages,
            [monthKey]: src,
          },
        })),
      importState: (payload) =>
        withHistory(set, (state) => {
          const sanitized = sanitizeImportedState(payload, state);
          applyThemeTokens(sanitized.theme, sanitized.accent);
          return sanitized;
        }),
      exportPlainText: () => {
        const state = get();
        return state.notes
          .map((note) => {
            const activeRange = note.rangeId ? state.ranges.find((range) => range.id === note.rangeId) : null;
            const scopeLabel =
              note.scope === "day"
                ? `Day ${note.date}`
                : note.scope === "range"
                  ? `Range ${activeRange ? `${activeRange.start} to ${activeRange.end}` : note.rangeId}`
                  : `Month ${note.monthKey}`;
            return `${note.title}\n${scopeLabel}\n${note.content}\n`;
          })
          .join("\n");
      },
      openContextMenu: (date, x, y) =>
        set({
          contextMenu: { open: true, date, x, y },
        }),
      closeContextMenu: () =>
        set({
          contextMenu: { open: false, date: null, x: 0, y: 0 },
        }),
      undo: () => {
        const state = get();
        const previous = state.historyPast.at(-1);
        if (!previous) {
          return;
        }
        set({
          ...previous,
          historyPast: state.historyPast.slice(0, -1),
          historyFuture: [snapshot(state), ...state.historyFuture].slice(0, 30),
        });
      },
      redo: () => {
        const state = get();
        const future = state.historyFuture[0];
        if (!future) {
          return;
        }
        set({
          ...future,
          historyPast: [...state.historyPast, snapshot(state)].slice(-30),
          historyFuture: state.historyFuture.slice(1),
        });
      },
    }),
    {
      name: "editorial-wall-calendar",
      partialize: (state) => ({
        visibleMonth: state.visibleMonth,
        selectedDate: state.selectedDate,
        focusedDate: state.focusedDate,
        ranges: state.ranges,
        multiRangeEnabled: state.multiRangeEnabled,
        viewMode: state.viewMode,
        theme: state.theme,
        accent: state.accent,
        soundEnabled: state.soundEnabled,
        notesFilter: state.notesFilter,
        filterDate: state.filterDate,
        filterRangeId: state.filterRangeId,
        notes: state.notes,
        monthImages: state.monthImages,
      }),
      onRehydrateStorage: () => (state) => {
        if (!state) {
          return;
        }
        const sanitized = sanitizeImportedState(state, { ...initialState, ...state });
        Object.assign(state, sanitized);
        applyThemeTokens(state.theme, state.accent);
      },
    }
  )
);

export const calendarSelectors = {
  rangeLength: (range: DateRange) => daysBetween(range.start, range.end),
  sortedRanges: (ranges: DateRange[]) => [...ranges].sort((a, b) => compareDates(a.start, b.start)),
};
