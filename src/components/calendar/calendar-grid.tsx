"use client";

import { memo } from "react";
import { CalendarEvent } from "@/types/calendar";
import { toIsoDate } from "@/lib/date";
import { cn } from "@/lib/utils";

interface CalendarGridProps {
  weekdayLabels: string[];
  weeks: Date[][];
  metadataByDate: Record<
    string,
    {
      inMonth: boolean;
      today: boolean;
      selected?: boolean;
      rangeStart?: boolean;
      rangeEnd?: boolean;
      inConfirmedRange?: boolean;
      inHoverRange?: boolean;
      noteCount: number;
    }
  >;
  eventsByDate?: Record<string, CalendarEvent[]>;
  interactive?: boolean;
  onPointerStart?: (date: string) => void;
  onPointerEnter?: (date: string) => void;
  onSelectDate?: (date: string, options?: { rangeModifier: boolean }) => void;
  onFocusDate?: (date: string) => void;
  onContextDate?: (date: string, point: { x: number; y: number }) => void;
  ariaLabel: string;
}

const categoryColorMap: Record<CalendarEvent["category"], string> = {
  holiday: "bg-rose-500",
  meeting: "bg-accent",
  milestone: "bg-amber-500",
  personal: "bg-emerald-500",
};

export function CalendarGrid({
  weekdayLabels,
  weeks,
  metadataByDate,
  eventsByDate = {},
  interactive = false,
  onPointerStart,
  onPointerEnter,
  onSelectDate,
  onFocusDate,
  onContextDate,
  ariaLabel,
}: CalendarGridProps) {
  return (
    <div
      role="grid"
      aria-label={ariaLabel}
      data-calendar-interactive={interactive ? "true" : undefined}
      className="bg-transparent touch-none select-none"
    >
      <div className="mb-1 grid grid-cols-7 border-b border-line/50 pb-1 sm:pb-1.5">
        {weekdayLabels.map((label) => (
          <div
            key={label}
            className="text-center text-[9px] font-bold uppercase tracking-[0.04em] text-ink/60 sm:text-[10px] sm:tracking-[0.08em]"
            role="columnheader"
          >
            {label}
          </div>
        ))}
      </div>

      <div className="grid">
        {weeks.map((week, weekIndex) => (
          <div key={weekIndex} className="grid grid-cols-7">
            {week.map((day) => {
              const isoDate = toIsoDate(day);
              const metadata = metadataByDate[isoDate];
              const events = eventsByDate[isoDate] ?? [];

              return (
                <CalendarCell
                  key={isoDate}
                  isoDate={isoDate}
                  dayNumber={day.getUTCDate()}
                  metadata={metadata}
                  events={events}
                  interactive={interactive}
                  onPointerStart={onPointerStart}
                  onPointerEnter={onPointerEnter}
                  onSelectDate={onSelectDate}
                  onFocusDate={onFocusDate}
                  onContextDate={onContextDate}
                />
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

interface CalendarCellProps {
  isoDate: string;
  dayNumber: number;
  metadata: {
    inMonth: boolean;
    today: boolean;
    selected?: boolean;
    rangeStart?: boolean;
    rangeEnd?: boolean;
    inConfirmedRange?: boolean;
    inHoverRange?: boolean;
    noteCount: number;
  };
  events: CalendarEvent[];
  interactive: boolean;
  onPointerStart?: (date: string) => void;
  onPointerEnter?: (date: string) => void;
  onSelectDate?: (date: string, options?: { rangeModifier: boolean }) => void;
  onFocusDate?: (date: string) => void;
  onContextDate?: (date: string, point: { x: number; y: number }) => void;
}

const CalendarCell = memo(function CalendarCell({
  isoDate,
  dayNumber,
  metadata,
  events,
  interactive,
  onPointerStart,
  onPointerEnter,
  onSelectDate,
  onFocusDate,
  onContextDate,
}: CalendarCellProps) {
  const isRangeStart = interactive && Boolean(metadata.rangeStart);
  const isRangeEnd = interactive && Boolean(metadata.rangeEnd);
  const isRangeMiddle =
    interactive &&
    Boolean(metadata.inConfirmedRange || metadata.inHoverRange) &&
    !isRangeStart &&
    !isRangeEnd;
	  const isSelected = interactive && Boolean(metadata.selected || isRangeStart || isRangeEnd);
	  const hasEvents = events.length > 0;
	  const hasNote = metadata.noteCount > 0;
	  const holidayEvent = events.find((event) => event.category === "holiday");
	  const holidayTitle = holidayEvent?.title;
	
	  return (
	    <button
      type="button"
      data-calendar-interactive={interactive ? "true" : undefined}
      disabled={!interactive || !metadata.inMonth}
      onPointerDown={() => onPointerStart?.(isoDate)}
      onPointerEnter={() => onPointerEnter?.(isoDate)}
      onClick={(event) =>
        onSelectDate?.(isoDate, {
          rangeModifier: event.ctrlKey || event.metaKey,
        })
      }
      onFocus={() => onFocusDate?.(isoDate)}
	      onContextMenu={(event) => {
	        if (!interactive) {
	          return;
	        }
	        event.preventDefault();
	        onContextDate?.(isoDate, { x: event.clientX, y: event.clientY });
	      }}
	      title={holidayTitle}
	      aria-label={interactive ? `Select ${isoDate}` : isoDate}
	      aria-pressed={isSelected || isRangeMiddle}
      className={cn(
        "group relative flex h-9 w-full flex-col items-center justify-center focus:outline-none sm:h-10",
        metadata.inMonth
          ? interactive
            ? "cursor-pointer"
            : "cursor-default"
          : "pointer-events-none cursor-default opacity-25"
      )}
    >
      {(isRangeMiddle || isRangeStart || isRangeEnd) && (
        <div
          className={cn(
            "absolute inset-y-1 bg-accent/12",
            isRangeMiddle ? "inset-x-0" : "",
            isRangeStart && !isRangeEnd ? "left-1/2 right-0" : "",
            isRangeEnd && !isRangeStart ? "left-0 right-1/2" : "",
            isRangeStart && isRangeEnd ? "hidden" : ""
          )}
        />
      )}

      <span
        className={cn(
          "relative z-10 flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-medium tabular-nums transition-all duration-100 sm:h-7 sm:w-7 sm:text-[12px]",
          isSelected ? "bg-accent font-semibold text-white shadow-sm" : "",
          !isSelected && metadata.today ? "bg-accent/15 font-semibold text-accent" : "",
          !isSelected && !metadata.today ? "text-ink/90" : "",
          interactive && !isSelected && !isRangeMiddle ? "group-hover:bg-line/60" : ""
        )}
      >
        {dayNumber}
      </span>

	      <div className="relative z-10 mt-0.5 flex h-1.5 items-center justify-center gap-0.5">
	        {hasEvents &&
	          events.slice(0, 3).map((event) => (
	            <span key={event.id} className={cn("h-1 w-1 rounded-full", categoryColorMap[event.category])} />
	          ))}
	        {hasNote && !hasEvents && <span className="h-1 w-1 rounded-full bg-accent/60" />}
	      </div>

	      {holidayTitle && (
	        <div className="pointer-events-none absolute left-1/2 top-0 z-20 -translate-x-1/2 -translate-y-[calc(100%+6px)] whitespace-nowrap rounded-md border border-white/10 bg-[#111312]/95 px-2 py-1 text-[10px] font-semibold text-white opacity-0 shadow-sm transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100 dark:border-white/10 dark:bg-[#f4f0e7]/95 dark:text-[#111312]">
	          {holidayTitle}
	        </div>
	      )}
	    </button>
	  );
	});
