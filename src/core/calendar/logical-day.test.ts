import { describe, expect, it } from 'vitest';
import {
  addDays,
  dayRange,
  daysInMonth,
  diffDays,
  LogicalDaySchema,
  toLogicalDay,
  weekday,
} from './logical-day';

describe('toLogicalDay', () => {
  it('keeps times before the rollover hour on the previous day', () => {
    expect(toLogicalDay(new Date(2026, 9, 5, 1, 59), 2)).toBe('2026-10-04');
    expect(toLogicalDay(new Date(2026, 9, 5, 2, 0), 2)).toBe('2026-10-05');
  });

  it('treats a midnight rollover like a normal calendar day', () => {
    expect(toLogicalDay(new Date(2026, 9, 5, 0, 0), 0)).toBe('2026-10-05');
  });

  it('crosses month and year boundaries', () => {
    expect(toLogicalDay(new Date(2027, 0, 1, 1, 0), 2)).toBe('2026-12-31');
    expect(toLogicalDay(new Date(2026, 2, 1, 1, 0), 2)).toBe('2026-02-28');
  });
});

describe('day arithmetic', () => {
  it('adds days across daylight saving changes without skipping', () => {
    // US DST ends 2026-11-01 and starts 2027-03-14.
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01');
    expect(addDays('2026-11-01', 1)).toBe('2026-11-02');
    expect(addDays('2027-03-13', 2)).toBe('2027-03-15');
  });

  it('handles leap years', () => {
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
    expect(addDays('2027-02-28', 1)).toBe('2027-03-01');
    expect(daysInMonth('2028-02-10')).toBe(29);
    expect(daysInMonth('2027-02-10')).toBe(28);
    expect(daysInMonth('2026-04-01')).toBe(30);
    expect(daysInMonth('2026-12-01')).toBe(31);
  });

  it('computes differences and ranges', () => {
    expect(diffDays('2026-10-01', '2026-10-24')).toBe(23);
    expect(diffDays('2026-10-24', '2026-10-01')).toBe(-23);
    expect(dayRange('2026-10-30', '2026-11-02')).toEqual([
      '2026-10-30',
      '2026-10-31',
      '2026-11-01',
      '2026-11-02',
    ]);
    expect(dayRange('2026-11-02', '2026-11-01')).toEqual([]);
  });

  it('knows the weekday', () => {
    expect(weekday('2026-10-24')).toBe(6); // Saturday
    expect(weekday('2026-10-25')).toBe(0); // Sunday
  });
});

describe('LogicalDaySchema', () => {
  it('rejects impossible dates', () => {
    expect(LogicalDaySchema.safeParse('2026-02-30').success).toBe(false);
    expect(LogicalDaySchema.safeParse('2026-13-01').success).toBe(false);
    expect(LogicalDaySchema.safeParse('26-1-1').success).toBe(false);
    expect(LogicalDaySchema.safeParse('2028-02-29').success).toBe(true);
  });
});
