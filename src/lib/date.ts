import { DateRange } from "@/types/calendar";

const dateFormatter = new Intl.DateTimeFormat("en-CA", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  timeZone: "UTC",
});

export function toIsoDate(date: Date): string {
  return dateFormatter.format(date);
}

export function parseIsoDate(isoDate: string): Date {
  return new Date(`${isoDate}T00:00:00.000Z`);
}

export function getMonthKey(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(
    2,
    "0"
  )}`;
}

export function parseMonthKey(monthKey: string): Date {
  const [year, month] = monthKey.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, 1));
}

export function addMonths(monthKey: string, amount: number): string {
  const date = parseMonthKey(monthKey);
  date.setUTCMonth(date.getUTCMonth() + amount);
  return getMonthKey(date);
}

export function addDays(date: string, amount: number): string {
  const value = parseIsoDate(date);
  value.setUTCDate(value.getUTCDate() + amount);
  return toIsoDate(value);
}

export function startOfWeek(date: Date, weekStartsOn = 1): Date {
  const result = new Date(date);
  const day = result.getUTCDay();
  const diff = (day - weekStartsOn + 7) % 7;
  result.setUTCDate(result.getUTCDate() - diff);
  return result;
}

export function endOfWeek(date: Date, weekStartsOn = 1): Date {
  const result = startOfWeek(date, weekStartsOn);
  result.setUTCDate(result.getUTCDate() + 6);
  return result;
}

export function getCalendarDays(monthKey: string, weekStartsOn = 1): Date[] {
  const monthDate = parseMonthKey(monthKey);
  const start = startOfWeek(monthDate, weekStartsOn);
  const end = endOfWeek(
    new Date(Date.UTC(monthDate.getUTCFullYear(), monthDate.getUTCMonth() + 1, 0)),
    weekStartsOn
  );

  const days: Date[] = [];
  const cursor = new Date(start);

  while (cursor <= end) {
    days.push(new Date(cursor));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return days;
}

export function getWeekDays(anchorDate: string, weekStartsOn = 1): Date[] {
  const start = startOfWeek(parseIsoDate(anchorDate), weekStartsOn);
  return Array.from({ length: 7 }, (_, index) => {
    const day = new Date(start);
    day.setUTCDate(day.getUTCDate() + index);
    return day;
  });
}

export function isSameDay(a: string | null, b: string | null): boolean {
  return Boolean(a && b && a === b);
}

export function isToday(date: string): boolean {
  return date === toIsoDate(new Date());
}

export function compareDates(a: string, b: string): number {
  return parseIsoDate(a).getTime() - parseIsoDate(b).getTime();
}

export function normalizeRange(start: string, end: string): Pick<DateRange, "start" | "end"> {
  return compareDates(start, end) <= 0 ? { start, end } : { start: end, end: start };
}

export function isDateWithinRange(date: string, range: Pick<DateRange, "start" | "end">): boolean {
  return compareDates(date, range.start) >= 0 && compareDates(date, range.end) <= 0;
}

export function enumerateDates(start: string, end: string): string[] {
  const range = normalizeRange(start, end);
  const dates: string[] = [];
  let cursor = range.start;

  while (compareDates(cursor, range.end) <= 0) {
    dates.push(cursor);
    cursor = addDays(cursor, 1);
  }

  return dates;
}

export function daysBetween(start: string, end: string): number {
  return enumerateDates(start, end).length;
}

export function getMonthLabel(monthKey: string, locale = "en-US"): string {
  return new Intl.DateTimeFormat(locale, {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(parseMonthKey(monthKey));
}

export function getWeekdayLabels(locale = "en-US", weekStartsOn = 1): string[] {
  const base = startOfWeek(new Date(Date.UTC(2024, 0, 1)), weekStartsOn);
  return Array.from({ length: 7 }, (_, index) =>
    new Intl.DateTimeFormat(locale, {
      weekday: "short",
      timeZone: "UTC",
    }).format(new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), base.getUTCDate() + index)))
  );
}

export function getMonthMatrix(monthKey: string, anchorDate: string, viewMode: "month" | "week") {
  if (viewMode === "week") {
    return [getWeekDays(anchorDate)];
  }

  const days = getCalendarDays(monthKey);
  const weeks: Date[][] = [];
  for (let index = 0; index < days.length; index += 7) {
    weeks.push(days.slice(index, index + 7));
  }
  return weeks;
}

export function monthContainsDate(monthKey: string, isoDate: string): boolean {
  return isoDate.startsWith(monthKey);
}
