"use client";

import { ChangeEvent, FormEvent, useEffect, useRef, useState } from "react";
import { FileJson, FileText, Import, PencilLine, Plus, Trash2, X } from "lucide-react";
import { useNotes } from "@/hooks/use-notes";
import { useTheme } from "@/hooks/use-theme";
import { useCalendarSound } from "@/hooks/use-calendar-sound";
import { useCalendarStore } from "@/store/use-calendar-store";
import { cn } from "@/lib/utils";

const MAX_TITLE = 50;
const MAX_CONTENT = 240;

export function NotesPanel({
  className,
  onClose,
}: {
  className?: string;
  onClose?: () => void;
}) {
  const notes = useNotes();
  const theme = useTheme();
  const sound = useCalendarSound(theme.soundEnabled);
  const visibleMonth = useCalendarStore((state) => state.visibleMonth);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const scrollRegionRef = useRef<HTMLDivElement | null>(null);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const editingNote = editingId ? notes.notes.find((note) => note.id === editingId) ?? null : null;

  useEffect(() => {
    if (editingId && !editingNote) {
      setEditingId(null);
      setTitle("");
      setContent("");
    }
  }, [editingId, editingNote]);

  const activeTarget = editingNote
    ? {
        scope: editingNote.scope,
        monthKey: editingNote.monthKey,
        date: editingNote.date,
        rangeId: editingNote.rangeId,
        label:
          editingNote.scope === "day"
            ? `Day note for ${editingNote.date}`
            : editingNote.scope === "range"
              ? `Range note for ${editingNote.rangeId}`
              : `Monthly note for ${editingNote.monthKey}`,
      }
    : notes.notesFilter === "day" && notes.filterDate
      ? {
          scope: "day" as const,
          monthKey: visibleMonth,
          date: notes.filterDate,
          rangeId: undefined,
          label: `Day note for ${notes.filterDate}`,
        }
      : notes.notesFilter === "range" && notes.filterRangeId
        ? {
            scope: "range" as const,
            monthKey: visibleMonth,
            date: undefined,
            rangeId: notes.filterRangeId,
            label: `Range note for ${notes.currentRange?.start ?? notes.filterRangeId} to ${notes.currentRange?.end ?? notes.filterRangeId}`,
          }
        : {
            scope: "month" as const,
            monthKey: visibleMonth,
            date: undefined,
            rangeId: undefined,
            label: `Monthly note for ${visibleMonth}`,
          };

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!title.trim() || !content.trim()) {
      return;
    }

    const payload = {
      title: title.trim(),
      content: content.trim(),
      scope: activeTarget.scope,
      monthKey: activeTarget.monthKey,
      date: activeTarget.date,
      rangeId: activeTarget.rangeId,
    };

    if (editingId) {
      notes.updateNote(editingId, payload);
    } else {
      notes.addNote(payload);
    }

    setEditingId(null);
    setTitle("");
    setContent("");
    setImportError(null);
    void sound.playConfirm();
  };

  const exportJson = () => {
    const blob = new Blob(
      [
        JSON.stringify(
          {
            notes: notes.notes,
            ranges: notes.ranges,
            monthImages: useCalendarStore.getState().monthImages,
          },
          null,
          2
        ),
      ],
      { type: "application/json" }
    );
    downloadBlob(blob, "calendar-notes.json");
  };

  const exportText = () => {
    const blob = new Blob([notes.exportPlainText()], { type: "text/plain" });
    downloadBlob(blob, "calendar-notes.txt");
  };

  const importNotes = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }
    try {
      const payload = JSON.parse(await file.text());
      if (!payload || typeof payload !== "object") {
        throw new Error("Invalid payload");
      }
      notes.importState(payload);
      setImportError(null);
      void sound.playConfirm();
    } catch {
      setImportError("Could not import that file. Please use a valid calendar notes JSON export.");
    } finally {
      event.target.value = "";
    }
  };

  return (
    <aside className={cn("flex flex-col overflow-hidden bg-card", className)}>
      <header className="z-10 flex-none border-b border-line bg-card/95 px-6 py-5 backdrop-blur-sm">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.3em] text-muted">Workspace</p>
            <h2 className="mt-1 font-serif text-3xl font-medium">Notes</h2>
          </div>
          <div className="mt-1 flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="rounded-full border border-line bg-paper/50 p-2.5 transition-all hover:border-accent hover:text-accent active:scale-95"
              aria-label="Import notes"
            >
              <Import size={16} strokeWidth={2.5} />
            </button>
            {onClose && (
              <button
                type="button"
                onClick={onClose}
                className="rounded-full border border-line bg-paper/50 p-2.5 transition-all hover:border-accent hover:text-accent active:scale-95"
                aria-label="Close notes"
              >
                <X size={16} strokeWidth={2.5} />
              </button>
            )}
            <input ref={inputRef} type="file" accept="application/json" className="hidden" onChange={importNotes} />
          </div>
        </div>
      </header>

      <div ref={scrollRegionRef} className="calendar-scrollbar flex-1 space-y-10 overflow-y-auto px-6 py-6">
        <section>
          <form onSubmit={submit} className="space-y-4">
            <div className="rounded-xl border border-line bg-paper/40 px-4 py-3">
              <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-muted">Note target</p>
              <p className="mt-1 text-sm text-ink">{activeTarget.label}</p>
            </div>

            <div>
              <input
                value={title}
                onChange={(event) => setTitle(event.target.value.slice(0, MAX_TITLE))}
                placeholder="Note title"
                className="w-full rounded-xl border border-line bg-card px-4 py-3.5 text-sm outline-none transition-colors focus:border-accent"
              />
              <p className="mt-1.5 px-1 text-[11px] font-medium text-muted">{title.length}/{MAX_TITLE}</p>
            </div>

            <div>
              <textarea
                value={content}
                onChange={(event) => setContent(event.target.value.slice(0, MAX_CONTENT))}
                placeholder="Write something worth remembering..."
                rows={4}
                className="calendar-scrollbar w-full resize-none rounded-xl border border-line bg-card px-4 py-3.5 text-sm outline-none transition-colors focus:border-accent"
              />
              <p className="mt-1.5 px-1 text-[11px] font-medium text-muted">{content.length}/{MAX_CONTENT}</p>
            </div>

            <button
              type="submit"
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-accent py-3.5 text-sm font-bold text-white shadow-sm transition-all hover:opacity-90 active:scale-[0.98]"
            >
              <Plus size={16} strokeWidth={2.5} />
              {editingId ? "Update Note" : "Save Note"}
            </button>

            {editingId && (
              <button
                type="button"
                onClick={() => {
                  setEditingId(null);
                  setTitle("");
                  setContent("");
                }}
                className="flex w-full items-center justify-center rounded-xl border border-line bg-paper/40 py-3 text-sm font-semibold text-ink transition-all hover:border-accent hover:text-accent active:scale-[0.98]"
              >
                Cancel Editing
              </button>
            )}

            <p className="px-1 text-[10px] font-bold uppercase tracking-[0.2em] text-muted/80">{`Targeting: ${activeTarget.label}`}</p>
            {importError && <p className="px-1 text-sm font-medium text-rose-600">{importError}</p>}
          </form>
        </section>

        <section>
          <div className="mb-4">
            <h3 className="font-serif text-2xl text-ink">Journal</h3>
          </div>

          <div className="mb-4 flex flex-wrap gap-2">
            {[
              ["all", "All"],
              ["day", "By Day"],
              ["range", "By Range"],
              ["month", "By Month"],
            ].map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => notes.setNotesFilter(value as typeof notes.notesFilter)}
                disabled={(value === "day" && !notes.filterDate) || (value === "range" && !notes.filterRangeId)}
                className={cn(
                  "rounded-full border px-3.5 py-1.5 text-[11px] font-bold uppercase tracking-[0.1em] transition-all disabled:cursor-not-allowed disabled:opacity-40",
                  notes.notesFilter === value
                    ? "border-accent bg-accent-soft text-accent"
                    : "border-line bg-card text-muted hover:border-accent hover:text-accent"
                )}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="space-y-3">
            {notes.filteredNotes.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-line bg-paper/30 p-8 text-center text-sm font-medium text-muted">
                No notes match this filter.
              </div>
            ) : (
              notes.filteredNotes.map((note) => (
                <article
                  key={note.id}
                  className="group rounded-[1.25rem] border border-line bg-card p-5 shadow-sm transition-all hover:border-accent/50 hover:shadow-md"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-accent">{note.scope}</p>
                      <h4 className="mt-1 font-serif text-[1.35rem] leading-tight text-ink">{note.title}</h4>
                    </div>
                    <div className="flex items-center gap-1.5 opacity-100 transition-opacity group-hover:opacity-100 sm:opacity-0">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingId(note.id);
                          setTitle(note.title);
                          setContent(note.content);
                          scrollRegionRef.current?.scrollTo({ top: 0, behavior: "smooth" });
                        }}
                        className="rounded-full bg-paper/80 p-2 text-muted transition-colors hover:bg-accent/10 hover:text-accent"
                        aria-label="Edit note"
                      >
                        <PencilLine size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          notes.deleteNote(note.id);
                          void sound.playDateTap();
                        }}
                        className="rounded-full bg-paper/80 p-2 text-muted transition-colors hover:bg-rose-100 hover:text-rose-600"
                        aria-label="Delete note"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                  <p className="mt-3 text-[13px] leading-relaxed text-muted/90">{note.content}</p>
                  <p className="mt-4 text-[10px] font-bold uppercase tracking-[0.2em] text-muted">
                    {note.scope === "month"
                      ? note.monthKey
                      : note.scope === "range"
                        ? `${notes.ranges.find((range) => range.id === note.rangeId)?.start ?? note.rangeId ?? ""} - ${
                            notes.ranges.find((range) => range.id === note.rangeId)?.end ?? ""
                          }`
                        : note.date ?? ""}
                  </p>
                </article>
              ))
            )}
          </div>
        </section>

        <section className="border-t border-line pt-4">
          <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.2em] text-muted">Data Management</p>
          <div className="flex flex-wrap gap-2.5">
            <button
              type="button"
              onClick={exportJson}
              className="inline-flex items-center gap-2 rounded-lg border border-line bg-paper/50 px-3.5 py-2 text-[13px] font-medium transition-all hover:border-accent hover:text-accent active:scale-95"
            >
              <FileJson size={14} />
              Export JSON
            </button>
            <button
              type="button"
              onClick={exportText}
              className="inline-flex items-center gap-2 rounded-lg border border-line bg-paper/50 px-3.5 py-2 text-[13px] font-medium transition-all hover:border-accent hover:text-accent active:scale-95"
            >
              <FileText size={14} />
              Export Text
            </button>
          </div>
        </section>
      </div>
    </aside>
  );
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.style.display = "none";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 200);
}
