import type { LogicalDay } from '../calendar/logical-day';
import type { Attempt, Outcome } from '../model/records';

/**
 * Review state of one problem, derived entirely from its attempt history.
 *
 * Cards are never stored. They are recomputed by replaying attempts, so editing,
 * deleting or undoing an attempt is always reflected correctly, and syncing only
 * ever needs to move attempts.
 */
export interface ReviewCard {
  problemId: string;
  reps: number;
  lapses: number;
  stability: number;
  difficulty: number;
  lastReviewDay: LogicalDay;
  lastOutcome: Outcome;
  /** Days between the last review and the next one. */
  intervalDays: number;
  /** Next review day, before moving it off rest days. */
  dueDay: LogicalDay;
}

export interface SchedulerOptions {
  maxIntervalDays: number;
}

/** Swappable spaced-repetition algorithm. */
export interface Scheduler {
  /** Replays one problem's attempts (any order). Returns null when there are none. */
  replay(attempts: readonly Attempt[], options: SchedulerOptions): ReviewCard | null;
}

/**
 * Only the first attempt on a problem per logical day affects scheduling. Re-solving
 * something you just looked up shouldn't inflate its interval.
 */
export function schedulingAttempts(attempts: readonly Attempt[]): Attempt[] {
  const sorted = [...attempts].sort((a, b) => a.completedAt.localeCompare(b.completedAt));
  const seen = new Set<LogicalDay>();
  return sorted.filter((a) => {
    if (seen.has(a.logicalDay)) return false;
    seen.add(a.logicalDay);
    return true;
  });
}
