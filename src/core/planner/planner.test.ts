import { describe, expect, it } from 'vitest';
import type { Attempt } from '../model/records';
import { buildProgress } from '../progress/progress';
import { fsrsScheduler } from '../srs/fsrs-scheduler';
import { attempt, history } from '../testing/factories';
import { buildDayPlan, evaluateDay, type PlanInput } from './planner';

const settings = { dailyGoal: 3, minReviewsPerDay: 1, reviewCap: 5 };
const listOrder = ['p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7', 'p8'];

function plan(today: string, attempts: Attempt[], patch: Partial<PlanInput> = {}) {
  return buildDayPlan({
    today,
    isRest: false,
    settings,
    progress: buildProgress(attempts, fsrsScheduler, { maxIntervalDays: 365 }),
    todaysAttempts: attempts.filter((a) => a.logicalDay === today),
    listOrder,
    ...patch,
  });
}

const ids = (p: ReturnType<typeof plan>) => p.items.map((i) => `${i.kind}:${i.problemId}`);

describe('buildDayPlan', () => {
  it('uses every slot for new problems before anything has been solved', () => {
    expect(ids(plan('2026-01-01', []))).toEqual(['new:p1', 'new:p2', 'new:p3']);
  });

  it('includes due reviews and fills the rest with new problems in list order', () => {
    // p1 failed yesterday, so it's due today.
    const attempts = [attempt('p1', '2026-01-01', 'failed')];
    expect(ids(plan('2026-01-02', attempts))).toEqual(['review:p1', 'new:p2', 'new:p3']);
  });

  it('pulls a review in early when nothing is due but something is close', () => {
    // A "hints" solve comes back in 2 days, so nothing is due on day 2.
    const attempts = [attempt('p1', '2026-01-01', 'hints')];
    const card = buildProgress(attempts, fsrsScheduler, { maxIntervalDays: 365 }).get('p1')!.card;
    expect(card.dueDay).toBe('2026-01-03');
    expect(ids(plan('2026-01-02', attempts))).toEqual(['review:p1', 'new:p2', 'new:p3']);
    expect(plan('2026-01-02', attempts).items[0]?.early).toBe(true);
  });

  it('does not pull reviews early when the minimum is zero', () => {
    const attempts = [attempt('p1', '2026-01-01', 'hints')];
    const p = plan('2026-01-02', attempts, { settings: { ...settings, minReviewsPerDay: 0 } });
    expect(ids(p)).toEqual(['new:p2', 'new:p3', 'new:p4']);
  });

  it('falls back to new problems when no review is close', () => {
    const attempts = [attempt('p1', '2026-01-01', 'easy')];
    expect(ids(plan('2026-01-02', attempts))).toEqual(['new:p2', 'new:p3', 'new:p4']);
  });

  it('caps reviews and defers the rest', () => {
    const attempts = listOrder.map((id) => attempt(id, '2026-01-01', 'failed'));
    const p = plan('2026-01-10', attempts, { settings: { ...settings, reviewCap: 2 } });
    expect(p.items.filter((i) => i.kind === 'review')).toHaveLength(2);
    expect(p.deferredReviews).toBe(6);
    // Two reviews + one new to reach the goal of 3... but every list problem is attempted.
    expect(p.items.filter((i) => i.kind === 'new')).toHaveLength(0);
  });

  it('puts the most overdue reviews first', () => {
    const attempts = [
      attempt('p2', '2026-01-05', 'failed'),
      attempt('p1', '2026-01-01', 'failed'),
    ];
    expect(ids(plan('2026-01-10', attempts)).slice(0, 2)).toEqual(['review:p1', 'review:p2']);
  });

  it('stays stable as items are completed during the day', () => {
    const before = [attempt('p1', '2026-01-01', 'failed')];
    const morning = plan('2026-01-02', before);
    const after = [
      ...before,
      attempt('p1', '2026-01-02', 'solved', { isReview: true }),
      attempt('p2', '2026-01-02', 'solved'),
    ];
    const evening = plan('2026-01-02', after);
    expect(ids(evening)).toEqual(ids(morning));
    expect(evening.items.map((i) => i.outcome)).toEqual(['solved', 'solved', null]);
  });

  it('keeps off-plan problems done today and still offers the remaining slots', () => {
    const attempts = [attempt('p5', '2026-01-01', 'solved')];
    expect(ids(plan('2026-01-01', attempts))).toEqual(['new:p5', 'new:p1', 'new:p2']);
  });

  it('returns an empty plan on rest days', () => {
    const p = plan('2026-01-01', [], { isRest: true });
    expect(p.isRest).toBe(true);
    expect(p.items).toEqual([]);
  });
});

describe('evaluateDay', () => {
  const rule = { goal: 2, minReviews: 1, plannedReviewCount: 1 };

  it('counts distinct problems with any outcome, including failures', () => {
    const day = [
      attempt('a', '2026-01-01', 'failed', { isReview: true }),
      attempt('b', '2026-01-01', 'solved'),
    ];
    expect(evaluateDay(day, rule)).toEqual({ problemsDone: 2, reviewsDone: 1, goalMet: true });
  });

  it('does not count the same problem twice', () => {
    const day = [
      attempt('a', '2026-01-01', 'failed', { isReview: true }),
      attempt('a', '2026-01-01', 'solved', { isReview: true }),
    ];
    expect(evaluateDay(day, rule).goalMet).toBe(false);
  });

  it('requires the planned review', () => {
    const day = [attempt('a', '2026-01-01'), attempt('b', '2026-01-01')];
    expect(evaluateDay(day, rule).goalMet).toBe(false);
    expect(evaluateDay(day, { ...rule, plannedReviewCount: 0 }).goalMet).toBe(true);
  });

  it('accepts reviews done on either site', () => {
    const day = history('a', [['2026-01-01', 'solved']]).map((a) => ({
      ...a,
      site: 'leetcode' as const,
      isReview: true,
    }));
    day.push(attempt('b', '2026-01-01'));
    expect(evaluateDay(day, rule).goalMet).toBe(true);
  });
});
