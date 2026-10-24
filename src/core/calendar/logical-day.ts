import { z } from 'zod';

/**
 * A "logical day" is a calendar date (YYYY-MM-DD) where the day starts at the
 * rollover hour instead of midnight. With a 2 AM rollover, 1:30 AM on the 5th still
 * belongs to the 4th.
 *
 * Day arithmetic runs in UTC on the date string itself, so daylight saving
 * transitions can never skip or repeat a day.
 */
export type LogicalDay = string;

export const LogicalDaySchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((s) => fromUtc(parseUtc(s)) === s, 'Invalid calendar date');

export interface Clock {
  now(): Date;
}

export const systemClock: Clock = { now: () => new Date() };

const pad = (n: number, w = 2) => String(n).padStart(w, '0');

function parseUtc(day: LogicalDay): Date {
  const [y, m, d] = day.split('-').map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, d));
}

function fromUtc(date: Date): LogicalDay {
  return `${pad(date.getUTCFullYear(), 4)}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
}

/** The logical day that a local-time instant belongs to. */
export function toLogicalDay(instant: Date, rolloverHour: number): LogicalDay {
  const day = `${pad(instant.getFullYear(), 4)}-${pad(instant.getMonth() + 1)}-${pad(instant.getDate())}`;
  return instant.getHours() < rolloverHour ? addDays(day, -1) : day;
}

export function addDays(day: LogicalDay, n: number): LogicalDay {
  const d = parseUtc(day);
  d.setUTCDate(d.getUTCDate() + n);
  return fromUtc(d);
}

/** Whole days from `a` to `b` (positive when b is later). */
export function diffDays(a: LogicalDay, b: LogicalDay): number {
  return Math.round((parseUtc(b).getTime() - parseUtc(a).getTime()) / 86_400_000);
}

/** 0 = Sunday … 6 = Saturday. */
export function weekday(day: LogicalDay): number {
  return parseUtc(day).getUTCDay();
}

/** "YYYY-MM" */
export function monthKey(day: LogicalDay): string {
  return day.slice(0, 7);
}

export function daysInMonth(day: LogicalDay): number {
  const d = parseUtc(day);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
}

/** Inclusive range of days from `from` to `to`. Empty when from > to. */
export function dayRange(from: LogicalDay, to: LogicalDay): LogicalDay[] {
  const out: LogicalDay[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) out.push(d);
  return out;
}

/** Local instant at which a logical day starts (its rollover moment). */
export function startOfLogicalDay(day: LogicalDay, rolloverHour: number): Date {
  const [y, m, d] = day.split('-').map(Number) as [number, number, number];
  return new Date(y, m - 1, d, rolloverHour, 0, 0, 0);
}

export const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;
