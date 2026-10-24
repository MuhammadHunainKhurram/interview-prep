import { describe, expect, it } from 'vitest';
import type { RestDay } from '../model/records';
import { restContext } from '../testing/factories';
import { canRemoveAdHocRestDay, nextActiveDay, validateAdHocRestDay } from './rest-days';

const ts = '2026-01-01T00:00:00.000Z';
const rest = (logicalDay: string): RestDay => ({
  logicalDay,
  kind: 'adhoc',
  createdAt: ts,
  updatedAt: ts,
});

const base = {
  today: '2026-02-10',
  settings: { restWeekdays: [0], adHocRestBudgetPerMonth: 2 },
  existing: [] as RestDay[],
  daysWithAttempts: new Set<string>(),
  snapshots: new Map(),
};

describe('validateAdHocRestDay', () => {
  it('allows yesterday, today and future days within range', () => {
    expect(validateAdHocRestDay('2026-02-09', base)).toBeNull();
    expect(validateAdHocRestDay('2026-02-10', base)).toBeNull();
    expect(validateAdHocRestDay('2026-05-11', base)).toBeNull(); // 90 days ahead
  });

  it('rejects days too far in the past or future', () => {
    expect(validateAdHocRestDay('2026-02-08', base)).toBe('out-of-range');
    expect(validateAdHocRestDay('2026-05-12', base)).toBe('out-of-range');
  });

  it('rejects weekly rest days and duplicates', () => {
    expect(validateAdHocRestDay('2026-02-15', base)).toBe('weekly-rest-day'); // Sunday
    expect(validateAdHocRestDay('2026-02-11', { ...base, existing: [rest('2026-02-11')] })).toBe(
      'already-rest',
    );
  });

  it('rejects days that already have practice', () => {
    expect(
      validateAdHocRestDay('2026-02-09', { ...base, daysWithAttempts: new Set(['2026-02-09']) }),
    ).toBe('has-attempts');
  });

  it('enforces the budget per calendar month', () => {
    const existing = [rest('2026-02-11'), rest('2026-02-12')];
    expect(validateAdHocRestDay('2026-02-13', { ...base, existing })).toBe('budget-exceeded');
    // March has its own budget.
    expect(validateAdHocRestDay('2026-03-02', { ...base, existing })).toBeNull();
  });

  it('allows no extra rest days with a zero budget', () => {
    const settings = { ...base.settings, adHocRestBudgetPerMonth: 0 };
    expect(validateAdHocRestDay('2026-02-11', { ...base, settings })).toBe('budget-exceeded');
  });
});

describe('canRemoveAdHocRestDay', () => {
  it('only allows removing yesterday onwards', () => {
    expect(canRemoveAdHocRestDay('2026-02-09', '2026-02-10')).toBe(true);
    expect(canRemoveAdHocRestDay('2026-02-08', '2026-02-10')).toBe(false);
  });
});

describe('nextActiveDay', () => {
  it('skips weekly and extra rest days', () => {
    const ctx = restContext('2026-02-10', {
      restWeekdays: [6, 0],
      adHoc: new Set(['2026-02-16']),
    });
    // Sat 14 → Sun 15 → Mon 16 (extra) → Tue 17
    expect(nextActiveDay('2026-02-14', ctx)).toBe('2026-02-17');
    expect(nextActiveDay('2026-02-12', ctx)).toBe('2026-02-12');
  });
});
