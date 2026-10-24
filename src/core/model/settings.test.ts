import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, SettingsSchema, type Settings } from './settings';

const parse = (patch: Partial<Record<keyof Settings, unknown>>) =>
  SettingsSchema.safeParse({ ...DEFAULT_SETTINGS, ...patch });

const firstError = (patch: Partial<Record<keyof Settings, unknown>>) => {
  const r = parse(patch);
  return r.success ? null : r.error.issues[0]?.message;
};

describe('SettingsSchema', () => {
  it('accepts the defaults', () => {
    expect(parse({}).success).toBe(true);
  });

  it.each([
    [{ dailyGoal: 0 }, 'Daily goal must be at least 1'],
    [{ dailyGoal: 21 }, 'Daily goal can be at most 20'],
    [{ dailyGoal: 2.5 }, 'Daily goal must be a whole number'],
    [{ dailyGoal: '3' }, 'Daily goal must be a number'],
    [{ dailyGoal: Number.NaN }, 'Daily goal must be a number'],
    [{ minReviewsPerDay: -1 }, 'Minimum reviews cannot be negative'],
    [{ minReviewsPerDay: 4 }, 'Minimum reviews cannot be more than the daily goal'],
    [{ reviewCap: 0 }, 'Review cap must be at least 1 and at least the minimum reviews'],
    [{ reviewCap: 51 }, 'Review cap can be at most 50'],
    [{ adHocRestBudgetPerMonth: 60 }, 'Extra rest days can be at most 8 per month'],
    [{ adHocRestBudgetPerMonth: -1 }, 'Extra rest days cannot be negative'],
    [{ restWeekdays: [0, 1, 2, 3, 4, 5, 6] }, 'Keep at least one non-rest day each week'],
    [{ restWeekdays: [1, 1] }, 'Weekdays must be unique'],
    [{ maxIntervalDays: 10 }, 'Max review interval must be at least 30 days'],
    [{ rolloverHour: 12 }, 'Rollover hour must be between 12 AM and 6 AM'],
    [{ reminder: { enabled: true, time: '25:00' } }, 'Reminder time must be HH:MM'],
  ])('rejects %j', (patch, message) => {
    expect(firstError(patch)).toBe(message);
  });

  it('accepts boundary values', () => {
    expect(parse({ dailyGoal: 20, minReviewsPerDay: 20, reviewCap: 50 }).success).toBe(true);
    expect(parse({ dailyGoal: 1, minReviewsPerDay: 0, reviewCap: 1 }).success).toBe(true);
    expect(parse({ restWeekdays: [0, 1, 2, 3, 4, 5] }).success).toBe(true);
    expect(parse({ adHocRestBudgetPerMonth: 8 }).success).toBe(true);
  });

  it('rejects unknown lists and themes', () => {
    expect(parse({ activeList: 'grind169' }).success).toBe(false);
    expect(parse({ theme: 'neon' }).success).toBe(false);
  });
});
