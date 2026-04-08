export type ThemeMode = "light" | "dark";
export type ViewMode = "month" | "week";
export type NavigationMode = "flip" | "buttons";
export type AccentColor = "teal" | "brick" | "amber" | "slate";
export type Category = "holiday" | "meeting" | "milestone" | "personal";
export type NoteScope = "month" | "range" | "day";

export interface DateRange {
  id: string;
  start: string;
  end: string;
  noteIds: string[];
}

export interface NoteRecord {
  id: string;
  scope: NoteScope;
  title: string;
  content: string;
  monthKey: string;
  date?: string;
  rangeId?: string;
  createdAt: number;
  updatedAt: number;
}

export interface CalendarEvent {
  id: string;
  date: string;
  title: string;
  category: Category;
}

export interface MonthImage {
  src: string;
  alt: string;
  credit: string;
}

export interface ContextMenuState {
  open: boolean;
  date: string | null;
  x: number;
  y: number;
}

export interface JumpTarget {
  month: number;
  year: number;
}

export interface HistoryState {
  notes: NoteRecord[];
  ranges: DateRange[];
  monthImages: Record<string, string>;
}

export interface CalendarState {
  visibleMonth: string;
  selectedDate: string | null;
  focusedDate: string;
  draftRangeStart: string | null;
  hoverDate: string | null;
  ranges: DateRange[];
  multiRangeEnabled: boolean;
  viewMode: ViewMode;
  navigationMode: NavigationMode;
  theme: ThemeMode;
  accent: AccentColor;
  soundEnabled: boolean;
  notesPanelOpen: boolean;
  notesFilter: "all" | "day" | "range" | "month";
  filterDate: string | null;
  filterRangeId: string | null;
  notes: NoteRecord[];
  monthImages: Record<string, string>;
  contextMenu: ContextMenuState;
  historyPast: HistoryState[];
  historyFuture: HistoryState[];
}

export interface CalendarActions {
  setVisibleMonth: (month: string) => void;
  shiftMonth: (amount: number) => void;
  setFocusedDate: (date: string) => void;
  setSelectedDate: (date: string | null) => void;
  setTheme: (theme: ThemeMode) => void;
  setAccent: (accent: AccentColor) => void;
  setSoundEnabled: (enabled: boolean) => void;
  setViewMode: (mode: ViewMode) => void;
  setNavigationMode: (mode: NavigationMode) => void;
  setMultiRangeEnabled: (enabled: boolean) => void;
  setNotesPanelOpen: (open: boolean) => void;
  startRange: (date: string) => void;
  updateHoverDate: (date: string | null) => void;
  completeRange: (date: string) => void;
  clearSelection: () => void;
  removeRange: (rangeId: string) => void;
  setNotesFilter: (
    filter: CalendarState["notesFilter"],
    options?: { date?: string | null; rangeId?: string | null }
  ) => void;
  addNote: (
    note: Omit<NoteRecord, "id" | "createdAt" | "updatedAt">
  ) => NoteRecord;
  updateNote: (noteId: string, updates: Partial<NoteRecord>) => void;
  deleteNote: (noteId: string) => void;
  setMonthImage: (monthKey: string, src: string) => void;
  importState: (payload: Partial<HistoryState> & Partial<CalendarState>) => void;
  exportPlainText: () => string;
  openContextMenu: (date: string, x: number, y: number) => void;
  closeContextMenu: () => void;
  undo: () => void;
  redo: () => void;
}
