import { addDays, dayRange, type LogicalDay } from '../calendar/logical-day';
import { isRestDay, nextActiveDay, type RestContext } from '../calendar/rest-days';
import type { ProblemCatalog } from '../catalog/catalog';
import type { Difficulty, ListId } from '../catalog/schema';
import { OUTCOMES, SOLVED_OUTCOMES, type Attempt, type Outcome } from '../model/records';
import type { ProblemProgress } from '../progress/progress';

export interface SectionProgress {
  section: string;
  total: number;
  solved: number;
  attempted: number;
}

export interface ListProgress {
  listId: ListId;
  total: number;
  /** Solved at least once (easily, normally or with hints). */
  solved: number;
  /** Attempted but never solved. */
  attempted: number;
  sections: SectionProgress[];
}

export function listProgress(
  catalog: ProblemCatalog,
  listId: ListId,
  progress: ReadonlyMap<string, ProblemProgress>,
): ListProgress {
  const sections = new Map<string, SectionProgress>();
  let solved = 0;
  let attempted = 0;
  for (const p of catalog.list(listId)) {
    let s = sections.get(p.section);
    if (!s)
      sections.set(p.section, (s = { section: p.section, total: 0, solved: 0, attempted: 0 }));
    s.total++;
    const pr = progress.get(p.id);
    if (pr?.everSolved) {
      s.solved++;
      solved++;
    } else if (pr) {
      s.attempted++;
      attempted++;
    }
  }
  const ordered = catalog.sections
    .map((name) => sections.get(name))
    .filter((s): s is SectionProgress => !!s);
  return { listId, total: catalog.list(listId).length, solved, attempted, sections: ordered };
}

export interface WeakSection {
  section: string;
  reviews: number;
  /** Share of reviews that needed hints or weren't solved. */
  struggleRate: number;
}

const MIN_REVIEWS_FOR_WEAKNESS = 3;

export function weakSections(catalog: ProblemCatalog, attempts: readonly Attempt[]): WeakSection[] {
  const stats = new Map<string, { reviews: number; struggles: number }>();
  for (const a of attempts) {
    if (!a.isReview) continue;
    const section = catalog.get(a.problemId)?.section;
    if (!section) continue;
    const s = stats.get(section) ?? { reviews: 0, struggles: 0 };
    s.reviews++;
    if (a.outcome === 'hints' || a.outcome === 'failed') s.struggles++;
    stats.set(section, s);
  }
  return [...stats]
    .filter(([, s]) => s.reviews >= MIN_REVIEWS_FOR_WEAKNESS)
    .map(([section, s]) => ({ section, reviews: s.reviews, struggleRate: s.struggles / s.reviews }))
    .sort((a, b) => b.struggleRate - a.struggleRate || b.reviews - a.reviews);
}

export function outcomeCounts(attempts: readonly Attempt[]): Record<Outcome, number> {
  const counts = Object.fromEntries(OUTCOMES.map((o) => [o, 0])) as Record<Outcome, number>;
  for (const a of attempts) counts[a.outcome]++;
  return counts;
}

export interface DifficultyTime {
  difficulty: Difficulty;
  averageSec: number | null;
  samples: number;
}

export function averageSolveTime(
  catalog: ProblemCatalog,
  attempts: readonly Attempt[],
): DifficultyTime[] {
  const buckets: Record<Difficulty, number[]> = { Easy: [], Medium: [], Hard: [] };
  for (const a of attempts) {
    if (a.durationSec === null || !SOLVED_OUTCOMES.has(a.outcome)) continue;
    const d = catalog.get(a.problemId)?.difficulty;
    if (d) buckets[d].push(a.durationSec);
  }
  return (Object.keys(buckets) as Difficulty[]).map((difficulty) => {
    const xs = buckets[difficulty];
    return {
      difficulty,
      samples: xs.length,
      averageSec: xs.length ? Math.round(xs.reduce((s, x) => s + x, 0) / xs.length) : null,
    };
  });
}

export interface Forecast {
  remaining: number;
  /** New problems per active day over the lookback window. */
  newPerActiveDay: number;
  finishDay: LogicalDay | null;
}

const FORECAST_LOOKBACK_DAYS = 14;

/** Estimates when the active list will be finished at the recent pace. */
export function forecastFinish(input: {
  today: LogicalDay;
  list: ListProgress;
  attempts: readonly Attempt[];
  catalog: ProblemCatalog;
  rest: RestContext;
}): Forecast {
  const remaining = input.list.total - input.list.solved;
  const from = addDays(input.today, -(FORECAST_LOOKBACK_DAYS - 1));
  const window = dayRange(from, input.today);
  const activeDays = window.filter((d) => !isRestDay(d, input.rest)).length;
  const firstSolves = new Set(
    input.attempts
      .filter(
        (a) =>
          !a.isReview &&
          a.logicalDay >= from &&
          input.catalog.inList(a.problemId, input.list.listId),
      )
      .map((a) => a.problemId),
  ).size;
  const rate = activeDays > 0 ? firstSolves / activeDays : 0;
  if (remaining === 0) return { remaining, newPerActiveDay: rate, finishDay: input.today };
  if (rate === 0) return { remaining, newPerActiveDay: 0, finishDay: null };

  let daysNeeded = Math.ceil(remaining / rate);
  let day = input.today;
  while (daysNeeded > 0) {
    day = nextActiveDay(addDays(day, 1), input.rest);
    daysNeeded--;
  }
  return { remaining, newPerActiveDay: rate, finishDay: day };
}

/** Number of reviews landing on each of the next `days` days (after moving off rest days). */
export function upcomingReviews(
  today: LogicalDay,
  progress: ReadonlyMap<string, ProblemProgress>,
  rest: RestContext,
  days: number,
): { day: LogicalDay; count: number }[] {
  const end = addDays(today, days - 1);
  const counts = new Map(dayRange(today, end).map((d) => [d, 0]));
  for (const p of progress.values()) {
    const due = p.card.dueDay < today ? today : nextActiveDay(p.card.dueDay, rest);
    if (counts.has(due)) counts.set(due, counts.get(due)! + 1);
  }
  return [...counts].map(([day, count]) => ({ day, count }));
}
