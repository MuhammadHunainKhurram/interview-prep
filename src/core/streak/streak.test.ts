import { describe, expect, it } from 'vitest';
import type { DaySnapshot } from '../model/records';
import { attemptsByDay } from '../progress/progress';
import { attempt, restContext } from '../testing/factories';
import { computeStreak, dayInfo, heatmap, type StreakInput } from './streak';

const goal1 = { dailyGoal: 1, minReviewsPerDay: 0 };

function input(
  today: string,
  activeDays: string[],
  patch: Partial<StreakInput> = {},
): StreakInput {
  const attempts = activeDays.map((d, i) => attempt(`p${i}`, d));
  return {
    today,
    firstDay: activeDays.slice().sort()[0] ?? null,
    attemptsByDay: attemptsByDay(attempts),
    snapshots: new Map(),
    rest: restContext(today),
    settings: goal1,
    ...patch,
  };
}

describe('computeStreak', () => {
  it('is zero with no history', () => {
    expect(computeStreak(input('2026-01-10', []))).toEqual({ current: 0, longest: 0, todayMet: false });
  });

  it('counts consecutive goal days', () => {
    const s = computeStreak(input('2026-01-03', ['2026-01-01', '2026-01-02', '2026-01-03']));
    expect(s).toEqual({ current: 3, longest: 3, todayMet: true });
  });

  it("doesn't break the streak while today is still in progress", () => {
    const s = computeStreak(input('2026-01-03', ['2026-01-01', '2026-01-02']));
    expect(s.current).toBe(2);
    expect(s.todayMet).toBe(false);
  });

  it('breaks on a missed day', () => {
    const s = computeStreak(input('2026-01-04', ['2026-01-01', '2026-01-02', '2026-01-04']));
    expect(s.current).toBe(1);
    expect(s.longest).toBe(2);
  });

  it('skips rest days without breaking or extending the streak', () => {
    const base = input('2026-01-04', ['2026-01-01', '2026-01-02', '2026-01-04']);
    const s = computeStreak({
      ...base,
      rest: restContext('2026-01-04', { adHoc: new Set(['2026-01-03']) }),
    });
    expect(s.current).toBe(3);
  });

  it('treats weekly rest days as rest', () => {
    // 2026-01-03 is a Saturday.
    const base = input('2026-01-04', ['2026-01-02', '2026-01-04']);
    const s = computeStreak({ ...base, rest: restContext('2026-01-04', { restWeekdays: [6] }) });
    expect(s.current).toBe(2);
  });

  it('judges past days by their snapshot, not current settings', () => {
    const snap: DaySnapshot = {
      logicalDay: '2026-01-01',
      goal: 1,
      minReviews: 0,
      plannedReviewCount: 0,
      isRest: false,
      createdAt: '2026-01-01T10:00:00.000Z',
      updatedAt: '2026-01-01T10:00:00.000Z',
    };
    const base = input('2026-01-02', ['2026-01-01', '2026-01-02'], {
      settings: { dailyGoal: 5, minReviewsPerDay: 0 },
      snapshots: new Map([[snap.logicalDay, snap]]),
    });
    // Jan 1 met its goal of 1. Today needs 5 under the new settings.
    expect(dayInfo('2026-01-01', base).status).toBe('goal-met');
    expect(dayInfo('2026-01-02', base).status).toBe('today');
    expect(computeStreak(base).current).toBe(1);
  });

  it('marks partial days', () => {
    const base = input('2026-01-03', ['2026-01-01'], {
      settings: { dailyGoal: 2, minReviewsPerDay: 0 },
    });
    expect(dayInfo('2026-01-01', base).status).toBe('partial');
    expect(dayInfo('2026-01-02', base).status).toBe('missed');
  });

  it('builds a heatmap of the right size ending today', () => {
    const cells = heatmap(input('2026-01-03', ['2026-01-03']), 52);
    expect(cells).toHaveLength(364);
    expect(cells.at(-1)).toMatchObject({ day: '2026-01-03', status: 'goal-met' });
  });
});
