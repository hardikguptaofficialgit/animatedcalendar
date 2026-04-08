"use client";

import { Plus, ScanSearch, WandSparkles } from "lucide-react";
import { useCalendarStore } from "@/store/use-calendar-store";
import { clamp } from "@/lib/utils";

export function ContextMenu() {
  const contextMenu = useCalendarStore((state) => state.contextMenu);
  const closeContextMenu = useCalendarStore((state) => state.closeContextMenu);
  const startRange = useCalendarStore((state) => state.startRange);
  const setNotesFilter = useCalendarStore((state) => state.setNotesFilter);
  const setSelectedDate = useCalendarStore((state) => state.setSelectedDate);
  const setFocusedDate = useCalendarStore((state) => state.setFocusedDate);
  const setNotesPanelOpen = useCalendarStore((state) => state.setNotesPanelOpen);

  if (!contextMenu.open || !contextMenu.date) {
    return null;
  }

  const activeDate = contextMenu.date;
  const menuWidth = 224;
  const viewportWidth = typeof window === "undefined" ? contextMenu.x : window.innerWidth;
  const viewportHeight = typeof window === "undefined" ? contextMenu.y : window.innerHeight;
  const left = clamp(contextMenu.x, 12, Math.max(12, viewportWidth - menuWidth - 12));
  const top = clamp(contextMenu.y, 12, Math.max(12, viewportHeight - 180));

  return (
    <>
      <button type="button" aria-hidden className="fixed inset-0 z-30 cursor-default" onClick={closeContextMenu} />
      <div
        className="fixed z-40 min-w-56 rounded-[1.25rem] border border-line bg-card p-2 shadow-divider"
        style={{ left, top }}
        role="menu"
      >
        <button
          type="button"
          className="flex w-full items-center gap-2 rounded-2xl px-3 py-3 text-sm transition hover:bg-paper"
          onClick={() => {
            setSelectedDate(activeDate);
            setFocusedDate(activeDate);
            setNotesFilter("day", { date: activeDate });
            setNotesPanelOpen(true);
            closeContextMenu();
          }}
        >
          <Plus size={14} />
          Add day note
        </button>
        <button
          type="button"
          className="flex w-full items-center gap-2 rounded-2xl px-3 py-3 text-sm transition hover:bg-paper"
          onClick={() => {
            setNotesPanelOpen(true);
            startRange(activeDate);
            closeContextMenu();
          }}
        >
          <ScanSearch size={14} />
          Select range start
        </button>
        <button
          type="button"
          className="flex w-full items-center gap-2 rounded-2xl px-3 py-3 text-sm transition hover:bg-paper"
          onClick={() => {
            setSelectedDate(activeDate);
            setFocusedDate(activeDate);
            closeContextMenu();
          }}
        >
          <WandSparkles size={14} />
          Focus this date
        </button>
      </div>
    </>
  );
}
