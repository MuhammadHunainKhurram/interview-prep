import { describe, expect, it } from 'vitest';
import { addDays } from '../calendar/logical-day';
import { attempt, history } from '../testing/factories';
import { fsrsScheduler } from './fsrs-scheduler';
import { schedulingAttempts } from './scheduler';

const opts = { maxIntervalDays: 365 };

/** Simulates reviewing on each due day with the same outcome; returns intervals. */
function simulate(
  outcome: 'easy' | 'solved' | 'hints',
  reviews: number,
  options = { maxIntervalDays: 3650 },
): number[] {
  let day = '2026-01-01';
  const attempts = [attempt('two-sum', day, outcome)];
  const intervals: number[] = [];
  for (let i = 0; i < reviews; i++) {
    const card = fsrsScheduler.replay(attempts, options)!;
    intervals.push(card.intervalDays);
    day = card.dueDay;
    attempts.push(attempt('two-sum', day, outcome, { isReview: true }));
  }
  return intervals;
}

describe('fsrsScheduler', () => {
  it('returns null without attempts', () => {
    expect(fsrsScheduler.replay([], opts)).toBeNull();
  });

  it('schedules longer gaps the more often a problem is solved', () => {
    const intervals = simulate('solved', 5);
    for (let i = 1; i < intervals.length; i++)
      expect(intervals[i]!).toBeGreaterThan(intervals[i - 1]!);
  });

  it('orders gaps easy > solved > hints after the first attempt', () => {
    const first = (o: 'easy' | 'solved' | 'hints' | 'failed') =>
      fsrsScheduler.replay([attempt('a', '2026-01-01', o)], opts)!.intervalDays;
    expect(first('easy')).toBeGreaterThan(first('solved'));
    expect(first('solved')).toBeGreaterThan(first('hints'));
    expect(first('hints')).toBeGreaterThanOrEqual(first('failed'));
    expect(first('failed')).toBe(1);
  });

  it('brings a failed review back the next day', () => {
    const attempts = history('a', [
      ['2026-01-01', 'solved'],
      ['2026-01-05', 'solved'],
      ['2026-01-20', 'failed'],
    ]);
    const card = fsrsScheduler.replay(attempts, opts)!;
    expect(card.dueDay).toBe('2026-01-21');
    expect(card.lapses).toBe(1);
  });

  it('never exceeds the max interval', () => {
    const intervals = simulate('easy', 12, opts);
    expect(Math.max(...intervals)).toBeLessThanOrEqual(365);
    const capped = fsrsScheduler.replay(
      Array.from({ length: 10 }, (_, i) =>
        attempt('a', addDays('2026-01-01', i * 40), 'easy', { isReview: i > 0 }),
      ),
      { maxIntervalDays: 30 },
    )!;
    expect(capped.intervalDays).toBeLessThanOrEqual(30);
  });

  it('only lets the first attempt per day affect scheduling', () => {
    const first = attempt('a', '2026-01-01', 'failed');
    const again = attempt('a', '2026-01-01', 'easy', { isReview: true });
    expect(schedulingAttempts([again, first]).map((a) => a.id)).toEqual([first.id]);
    expect(fsrsScheduler.replay([first, again], opts)!.intervalDays).toBe(1);
  });
});
