import { diffDays, type LogicalDay } from '@/core/calendar/logical-day';

const dayFormat = new Intl.DateTimeFormat(undefined, {
  weekday: 'short',
  month: 'short',
  day: 'numeric',
});
const longDayFormat = new Intl.DateTimeFormat(undefined, {
  month: 'long',
  day: 'numeric',
  year: 'numeric',
});
const dateTimeFormat = new Intl.DateTimeFormat(undefined, {
  month: 'short',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
});

function dayToDate(day: LogicalDay): Date {
  const [y, m, d] = day.split('-').map(Number) as [number, number, number];
  return new Date(y, m - 1, d);
}

export function formatDay(day: LogicalDay): string {
  return dayFormat.format(dayToDate(day));
}

export function formatLongDay(day: LogicalDay): string {
  return longDayFormat.format(dayToDate(day));
}

/** "Today", "Tomorrow", "in 5 days", "Yesterday", "3 days ago", or a date further out. */
export function relativeDay(day: LogicalDay, today: LogicalDay): string {
  const n = diffDays(today, day);
  if (n === 0) return 'Today';
  if (n === 1) return 'Tomorrow';
  if (n === -1) return 'Yesterday';
  if (n > 1 && n <= 30) return `in ${n} days`;
  if (n < -1 && n >= -30) return `${-n} days ago`;
  return formatDay(day);
}

export function formatDateTime(iso: string): string {
  return dateTimeFormat.format(new Date(iso));
}

/** 75 → "1:15", 3725 → "1:02:05" */
export function formatClock(totalSec: number): string {
  const s = Math.max(0, Math.floor(totalSec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = String(s % 60).padStart(2, '0');
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${sec}` : `${m}:${sec}`;
}

/** 75 → "1m 15s", 3725 → "1h 2m" */
export function formatDuration(totalSec: number | null): string {
  if (totalSec === null) return 'Not timed';
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return s && m < 10 ? `${m}m ${s}s` : `${m}m`;
  return `${s}s`;
}

export function plural(n: number, word: string, pluralWord = `${word}s`): string {
  return `${n} ${n === 1 ? word : pluralWord}`;
}
