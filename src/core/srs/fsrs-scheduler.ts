import { createEmptyCard, fsrs, Rating, type Card, type Grade } from 'ts-fsrs';
import { addDays } from '../calendar/logical-day';
import type { Outcome } from '../model/records';
import { schedulingAttempts, type ReviewCard, type Scheduler } from './scheduler';

export const OUTCOME_RATING: Record<Outcome, Grade> = {
  easy: Rating.Easy,
  solved: Rating.Good,
  hints: Rating.Hard,
  failed: Rating.Again,
};

/** Spaced repetition using FSRS. Reviews are whole-day re-solves, so short-term steps are off. */
export const fsrsScheduler: Scheduler = {
  replay(attempts, { maxIntervalDays }) {
    const ordered = schedulingAttempts(attempts);
    const last = ordered.at(-1);
    if (!last) return null;

    const f = fsrs({
      request_retention: 0.9,
      maximum_interval: maxIntervalDays,
      enable_fuzz: false,
      enable_short_term: false,
    });

    let card: Card = createEmptyCard(new Date(ordered[0]!.completedAt));
    for (const a of ordered) {
      card = f.next(card, new Date(a.completedAt), OUTCOME_RATING[a.outcome]).card;
    }

    // A problem you couldn't solve should be re-solved the next day, whatever FSRS's
    // post-lapse estimate says. Its stability still drops, so later gaps stay short.
    const intervalDays =
      last.outcome === 'failed'
        ? 1
        : Math.min(maxIntervalDays, Math.max(1, Math.round(card.scheduled_days)));
    const result: ReviewCard = {
      problemId: last.problemId,
      reps: card.reps,
      lapses: card.lapses,
      stability: card.stability,
      difficulty: card.difficulty,
      lastReviewDay: last.logicalDay,
      lastOutcome: last.outcome,
      intervalDays,
      dueDay: addDays(last.logicalDay, intervalDays),
    };
    return result;
  },
};
