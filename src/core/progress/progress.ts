import type { LogicalDay } from '../calendar/logical-day';
import { SOLVED_OUTCOMES, type Attempt } from '../model/records';
import type { Scheduler, ReviewCard, SchedulerOptions } from '../srs/scheduler';

/** Everything known about one problem, derived from its attempts. */
export interface ProblemProgress {
  problemId: string;
  attempts: Attempt[];
  attemptCount: number;
  everSolved: boolean;
  lastAttempt: Attempt;
  lastSolvedAt: string | null;
  card: ReviewCard;
}

export function groupAttempts(attempts: readonly Attempt[]): Map<string, Attempt[]> {
  const map = new Map<string, Attempt[]>();
  for (const a of attempts) {
    const list = map.get(a.problemId);
    if (list) list.push(a);
    else map.set(a.problemId, [a]);
  }
  for (const list of map.values()) list.sort((a, b) => a.completedAt.localeCompare(b.completedAt));
  return map;
}

export function buildProgress(
  attempts: readonly Attempt[],
  scheduler: Scheduler,
  options: SchedulerOptions,
): Map<string, ProblemProgress> {
  const out = new Map<string, ProblemProgress>();
  for (const [problemId, list] of groupAttempts(attempts)) {
    const card = scheduler.replay(list, options);
    const last = list.at(-1);
    if (!card || !last) continue;
    const solved = list.filter((a) => SOLVED_OUTCOMES.has(a.outcome));
    out.set(problemId, {
      problemId,
      attempts: list,
      attemptCount: list.length,
      everSolved: solved.length > 0,
      lastAttempt: last,
      lastSolvedAt: solved.at(-1)?.completedAt ?? null,
      card,
    });
  }
  return out;
}

export function attemptsByDay(attempts: readonly Attempt[]): Map<LogicalDay, Attempt[]> {
  const map = new Map<LogicalDay, Attempt[]>();
  for (const a of attempts) {
    const list = map.get(a.logicalDay);
    if (list) list.push(a);
    else map.set(a.logicalDay, [a]);
  }
  return map;
}
