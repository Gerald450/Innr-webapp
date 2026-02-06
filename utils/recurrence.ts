/**
 * Recurrence utilities: expand a recurring event into occurrence dates for the calendar.
 * A recurring event is stored as one event (parent); attending it adds all occurrence dates.
 */

export type RecurrenceEvent = {
  id: string;
  starts_at: string;
  ends_at?: string | null;
  is_recurring?: boolean;
  recurrence_pattern?: "daily" | "weekly" | "biweekly" | "monthly" | "yearly" | null;
  recurrence_interval?: number;
  recurrence_end_date?: string | null;
  recurrence_days_of_week?: number[] | null;
  recurrence_day_of_month?: number | null;
};

export type Occurrence = {
  dateKey: string;
  starts_at: string;
  ends_at: string | null;
};

function toDateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function timeOnly(iso: string): { hours: number; minutes: number; seconds: number } {
  const d = new Date(iso);
  return { hours: d.getHours(), minutes: d.getMinutes(), seconds: d.getSeconds() };
}

function setTime(d: Date, t: { hours: number; minutes: number; seconds: number }): Date {
  const out = new Date(d);
  out.setHours(t.hours, t.minutes, t.seconds, 0);
  return out;
}

/**
 * Expand a single (non-recurring) event to one occurrence.
 */
function singleOccurrence(event: RecurrenceEvent, rangeStart: Date, rangeEnd: Date): Occurrence[] {
  const start = new Date(event.starts_at);
  if (start < rangeStart || start > rangeEnd) return [];
  const startTime = timeOnly(event.starts_at);
  const endTime = event.ends_at ? timeOnly(event.ends_at) : null;
  const starts_at = setTime(new Date(start.getFullYear(), start.getMonth(), start.getDate()), startTime).toISOString();
  const ends_at = endTime
    ? setTime(new Date(start.getFullYear(), start.getMonth(), start.getDate()), endTime).toISOString()
    : null;
  return [{ dateKey: toDateKey(start), starts_at, ends_at }];
}

/**
 * Expand a recurring event into occurrence dates within [rangeStart, rangeEnd].
 * Used by the calendar so attending one recurring event shows all dates.
 */
export function getRecurrenceOccurrences(
  event: RecurrenceEvent,
  rangeStart: Date,
  rangeEnd: Date
): Occurrence[] {
  if (!event.is_recurring || !event.recurrence_pattern) {
    return singleOccurrence(event, rangeStart, rangeEnd);
  }

  const pattern = event.recurrence_pattern;
  const interval = Math.max(1, event.recurrence_interval ?? 1);
  const recurrenceEnd = event.recurrence_end_date ? new Date(event.recurrence_end_date) : null;
  const startBase = new Date(event.starts_at);
  const startTime = timeOnly(event.starts_at);
  const endTime = event.ends_at ? timeOnly(event.ends_at) : null;
  const effectiveEnd = recurrenceEnd && recurrenceEnd < rangeEnd ? recurrenceEnd : rangeEnd;
  const occurrences: Occurrence[] = [];
  const seen = new Set<string>();

  const add = (d: Date) => {
    if (d < rangeStart || d > effectiveEnd) return;
    const dateKey = toDateKey(d);
    if (seen.has(dateKey)) return;
    seen.add(dateKey);
    const starts_at = setTime(new Date(d), startTime).toISOString();
    const ends_at = endTime ? setTime(new Date(d), endTime).toISOString() : null;
    occurrences.push({ dateKey, starts_at, ends_at });
  };

  const daysOfWeek = event.recurrence_days_of_week && event.recurrence_days_of_week.length > 0
    ? event.recurrence_days_of_week
    : [startBase.getDay()];
  const dayOfMonth = event.recurrence_day_of_month ?? startBase.getDate();

  if (pattern === "daily") {
    const d = new Date(startBase);
    d.setHours(0, 0, 0, 0);
    if (d < rangeStart) {
      const daysToAdd = Math.ceil((rangeStart.getTime() - d.getTime()) / (24 * 60 * 60 * 1000));
      const aligned = Math.ceil(daysToAdd / interval) * interval;
      d.setDate(d.getDate() + aligned);
    }
    while (d <= effectiveEnd) {
      if (d >= rangeStart) add(new Date(d));
      d.setDate(d.getDate() + interval);
    }
    return occurrences.sort((a, b) => a.starts_at.localeCompare(b.starts_at));
  }

  if (pattern === "weekly" || pattern === "biweekly") {
    const weekMs = 7 * 24 * 60 * 60 * 1000;
    const stepWeeks = pattern === "biweekly" ? 2 * interval : interval;
    let d = new Date(startBase);
    d.setHours(0, 0, 0, 0);
    const startWeek = new Date(d);
    while (d <= effectiveEnd) {
      const weekDiff = Math.round((d.getTime() - startWeek.getTime()) / weekMs);
      if (weekDiff % stepWeeks === 0 && daysOfWeek.includes(d.getDay())) {
        add(new Date(d));
      }
      d.setDate(d.getDate() + 1);
    }
    return occurrences.sort((a, b) => a.starts_at.localeCompare(b.starts_at));
  }

  if (pattern === "monthly") {
    let y = startBase.getFullYear();
    let m = startBase.getMonth();
    const lastDay = (y: number, m: number) => new Date(y, m + 1, 0).getDate();
    while (true) {
      const day = dayOfMonth === -1 ? lastDay(y, m) : Math.min(dayOfMonth, lastDay(y, m));
      const d = new Date(y, m, day);
      if (d > effectiveEnd) break;
      if (d >= rangeStart) {
        const monthDiff = (d.getFullYear() - startBase.getFullYear()) * 12 + (d.getMonth() - startBase.getMonth());
        if (monthDiff % interval === 0) add(d);
      }
      m += 1;
      if (m > 11) {
        m = 0;
        y += 1;
      }
    }
    return occurrences.sort((a, b) => a.starts_at.localeCompare(b.starts_at));
  }

  if (pattern === "yearly") {
    let y = startBase.getFullYear();
    while (true) {
      const d = new Date(y, startBase.getMonth(), Math.min(startBase.getDate(), new Date(y, startBase.getMonth() + 1, 0).getDate()));
      if (d > effectiveEnd) break;
      if (d >= rangeStart) {
        const yearDiff = d.getFullYear() - startBase.getFullYear();
        if (yearDiff % interval === 0) add(d);
      }
      y += interval;
    }
    return occurrences.sort((a, b) => a.starts_at.localeCompare(b.starts_at));
  }

  return singleOccurrence(event, rangeStart, rangeEnd);
}
