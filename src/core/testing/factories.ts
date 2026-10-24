import type { RestContext } from '../calendar/rest-days';
import type { Attempt, Outcome } from '../model/records';

let seq = 0;

/** Builds a valid attempt at noon local time on `day`. Test-only helper. */
export function attempt(
  problemId: string,
  day: string,
  outcome: Outcome = 'solved',
  overrides: Partial<Attempt> = {},
): Attempt {
  const [y, m, d] = day.split('-').map(Number) as [number, number, number];
  const at = new Date(y, m - 1, d, 12, 0, seq++ % 60).toISOString();
  const n = String(seq).padStart(12, '0');
  return {
    id: `00000000-0000-4000-8000-${n}`,
    problemId,
    site: 'neetcode',
    outcome,
    patterns: [],
    notes: '',
    durationSec: null,
    logicalDay: day,
    isReview: false,
    completedAt: at,
    createdAt: at,
    updatedAt: at,
    ...overrides,
  };
}

/** Builds a problem's history where only the first attempt is not a review. */
export function history(problemId: string, entries: [string, Outcome][]): Attempt[] {
  return entries.map(([day, outcome], i) => attempt(problemId, day, outcome, { isReview: i > 0 }));
}

export function restContext(today: string, overrides: Partial<RestContext> = {}): RestContext {
  return { restWeekdays: [], adHoc: new Set(), snapshots: new Map(), today, ...overrides };
}
