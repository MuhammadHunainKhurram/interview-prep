import { describe, expect, it } from 'vitest';
import { getCatalog } from '../catalog';
import { buildProgress } from '../progress/progress';
import { fsrsScheduler } from '../srs/fsrs-scheduler';
import { attempt, restContext } from '../testing/factories';
import {
  averageSolveTime,
  forecastFinish,
  listProgress,
  outcomeCounts,
  weakSections,
} from './stats';

const catalog = getCatalog();
const nc150 = catalog.list('neetcode150');
const id = (i: number) => nc150[i]!.id;

describe('stats', () => {
  it('counts solved vs attempted-but-unsolved per list and section', () => {
    const attempts = [
      attempt(id(0), '2026-01-01', 'solved'),
      attempt(id(1), '2026-01-01', 'failed'),
      attempt(id(2), '2026-01-01', 'hints'),
    ];
    const lp = listProgress(
      catalog,
      'neetcode150',
      buildProgress(attempts, fsrsScheduler, { maxIntervalDays: 365 }),
    );
    expect(lp).toMatchObject({ total: 150, solved: 2, attempted: 1 });
    expect(lp.sections[0]).toMatchObject({ section: 'Arrays & Hashing', solved: 2, attempted: 1 });
  });

  it('counts outcomes', () => {
    const counts = outcomeCounts([
      attempt('a', '2026-01-01', 'easy'),
      attempt('b', '2026-01-01', 'easy'),
    ]);
    expect(counts).toEqual({ easy: 2, solved: 0, hints: 0, failed: 0 });
  });

  it('averages timed solves by difficulty, ignoring untimed and failed attempts', () => {
    const easy = nc150.find((p) => p.difficulty === 'Easy')!.id;
    const times = averageSolveTime(catalog, [
      attempt(easy, '2026-01-01', 'solved', { durationSec: 600 }),
      attempt(easy, '2026-01-02', 'solved', { durationSec: 300 }),
      attempt(easy, '2026-01-03', 'failed', { durationSec: 3000 }),
      attempt(easy, '2026-01-04', 'solved', { durationSec: null }),
    ]);
    expect(times.find((t) => t.difficulty === 'Easy')).toEqual({
      difficulty: 'Easy',
      averageSec: 450,
      samples: 2,
    });
  });

  it('finds sections where reviews keep going badly', () => {
    const review = (i: number, o: 'failed' | 'solved') =>
      attempt(id(i), '2026-01-02', o, { isReview: true });
    const weak = weakSections(catalog, [
      review(0, 'failed'),
      review(1, 'failed'),
      review(2, 'solved'),
    ]);
    expect(weak[0]).toMatchObject({ section: 'Arrays & Hashing', reviews: 3 });
    expect(weak[0]!.struggleRate).toBeCloseTo(2 / 3);
  });

  it('forecasts a finish date from the recent pace', () => {
    const today = '2026-01-14';
    const attempts = Array.from({ length: 14 }, (_, i) =>
      attempt(id(i), `2026-01-${String(i + 1).padStart(2, '0')}`),
    );
    const list = listProgress(
      catalog,
      'neetcode150',
      buildProgress(attempts, fsrsScheduler, { maxIntervalDays: 365 }),
    );
    const f = forecastFinish({ today, list, attempts, catalog, rest: restContext(today) });
    expect(f.remaining).toBe(136);
    expect(f.newPerActiveDay).toBe(1);
    expect(f.finishDay).toBe('2026-05-30'); // 136 days after Jan 14
  });

  it('has no forecast without recent progress', () => {
    const today = '2026-01-14';
    const list = listProgress(catalog, 'neetcode150', new Map());
    expect(
      forecastFinish({ today, list, attempts: [], catalog, rest: restContext(today) }).finishDay,
    ).toBeNull();
  });
});
