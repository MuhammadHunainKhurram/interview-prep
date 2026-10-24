import { addDays, type LogicalDay } from '../calendar/logical-day';
import type { Attempt, Outcome } from '../model/records';
import type { Settings } from '../model/settings';
import type { ProblemProgress } from '../progress/progress';

/** Cards due within this many days may be pulled in early to satisfy the review minimum. */
export const EARLY_REVIEW_WINDOW_DAYS = 3;

export type PlanItemKind = 'review' | 'new';

export interface PlanItem {
  problemId: string;
  kind: PlanItemKind;
  /** Pulled in before its due day so the day includes a review. */
  early: boolean;
  /** Outcome of today's first attempt, when done. */
  outcome: Outcome | null;
}

export interface DayPlan {
  logicalDay: LogicalDay;
  isRest: boolean;
  goal: number;
  minReviews: number;
  items: PlanItem[];
  /** Reviews due today that didn't fit under the review cap. They roll forward. */
  deferredReviews: number;
}

export interface PlanInput {
  today: LogicalDay;
  isRest: boolean;
  settings: Pick<Settings, 'dailyGoal' | 'minReviewsPerDay' | 'reviewCap'>;
  progress: ReadonlyMap<string, ProblemProgress>;
  todaysAttempts: readonly Attempt[];
  /** Problem ids of the active list, in roadmap order. */
  listOrder: readonly string[];
}

function firstAttemptsToday(attempts: readonly Attempt[]): Attempt[] {
  const seen = new Set<string>();
  return [...attempts]
    .sort((a, b) => a.completedAt.localeCompare(b.completedAt))
    .filter((a) => (seen.has(a.problemId) ? false : (seen.add(a.problemId), true)));
}

/**
 * Builds the plan for a day. It's deterministic, and stable as the day goes on:
 * anything already done today stays in the plan, and only the remaining slots are
 * filled from the review queue and the list.
 *
 * 1. Reviews: everything due, most overdue first, up to the review cap.
 * 2. If that's below the review minimum, pull in cards due within the next few days.
 * 3. Fill the rest of the daily goal with the next unattempted problems from the list.
 *    With nothing to review yet, every slot becomes a new problem.
 */
export function buildDayPlan(input: PlanInput): DayPlan {
  const { today, settings, progress } = input;
  const base = {
    logicalDay: today,
    goal: settings.dailyGoal,
    minReviews: settings.minReviewsPerDay,
  };
  if (input.isRest) return { ...base, isRest: true, items: [], deferredReviews: 0 };

  const done = firstAttemptsToday(input.todaysAttempts);
  const doneIds = new Set(done.map((a) => a.problemId));
  const item = (a: Attempt): PlanItem => ({
    problemId: a.problemId,
    kind: a.isReview ? 'review' : 'new',
    early: false,
    outcome: a.outcome,
  });

  const reviews: PlanItem[] = done.filter((a) => a.isReview).map(item);
  const pending = [...progress.values()].filter((p) => !doneIds.has(p.problemId));
  const byUrgency = (a: ProblemProgress, b: ProblemProgress) =>
    a.card.dueDay.localeCompare(b.card.dueDay) ||
    a.card.stability - b.card.stability ||
    a.problemId.localeCompare(b.problemId);

  const due = pending.filter((p) => p.card.dueDay <= today).sort(byUrgency);
  const reviewRoom = Math.max(0, settings.reviewCap - reviews.length);
  for (const p of due.slice(0, reviewRoom))
    reviews.push({ problemId: p.problemId, kind: 'review', early: false, outcome: null });
  const deferredReviews = Math.max(0, due.length - reviewRoom);

  if (reviews.length < settings.minReviewsPerDay) {
    const horizon = addDays(today, EARLY_REVIEW_WINDOW_DAYS);
    const soon = pending
      .filter((p) => p.card.dueDay > today && p.card.dueDay <= horizon)
      .sort(byUrgency)
      .slice(0, settings.minReviewsPerDay - reviews.length);
    for (const p of soon)
      reviews.push({ problemId: p.problemId, kind: 'review', early: true, outcome: null });
  }

  const fresh: PlanItem[] = done.filter((a) => !a.isReview).map(item);
  const newRoom = Math.max(0, settings.dailyGoal - reviews.length - fresh.length);
  if (newRoom > 0) {
    for (const id of input.listOrder) {
      if (fresh.length >= settings.dailyGoal - reviews.length) break;
      if (progress.has(id) || doneIds.has(id)) continue;
      fresh.push({ problemId: id, kind: 'new', early: false, outcome: null });
    }
  }

  return { ...base, isRest: false, items: [...reviews, ...fresh], deferredReviews };
}

export interface DayResult {
  /** Distinct problems attempted (any outcome). */
  problemsDone: number;
  reviewsDone: number;
  goalMet: boolean;
}

/**
 * A day's goal is met when enough distinct problems were attempted (any outcome,
 * either site), including the required reviews when reviews were planned.
 */
export function evaluateDay(
  attempts: readonly Attempt[],
  rule: { goal: number; minReviews: number; plannedReviewCount: number },
): DayResult {
  const first = firstAttemptsToday(attempts);
  const reviewsDone = first.filter((a) => a.isReview).length;
  const requiredReviews = Math.min(rule.minReviews, rule.plannedReviewCount);
  return {
    problemsDone: first.length,
    reviewsDone,
    goalMet: first.length >= rule.goal && reviewsDone >= requiredReviews,
  };
}

export function plannedReviewCount(plan: DayPlan): number {
  return plan.items.filter((i) => i.kind === 'review').length;
}
