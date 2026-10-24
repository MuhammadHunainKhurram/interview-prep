import { z } from 'zod';
import { LogicalDaySchema } from '../calendar/logical-day';
import { DifficultySchema } from '../catalog/schema';
import { SiteSchema } from './settings';

/**
 * Persisted records. Every record has a stable id and timestamps so a future
 * remote backend (e.g. Supabase) can sync them with last-write-wins.
 */

export const OUTCOMES = ['easy', 'solved', 'hints', 'failed'] as const;
export const OutcomeSchema = z.enum(OUTCOMES);
export type Outcome = z.infer<typeof OutcomeSchema>;

export const OUTCOME_LABELS: Record<Outcome, string> = {
  easy: 'Solved easily',
  solved: 'Solved',
  hints: 'Needed hints',
  failed: "Didn't solve",
};

/** Outcomes that count as having solved the problem (for progress). */
export const SOLVED_OUTCOMES: ReadonlySet<Outcome> = new Set(['easy', 'solved', 'hints']);

export const LIMITS_RECORDS = {
  notesMaxLength: 5000,
  maxPatterns: 5,
  maxDurationSec: 24 * 60 * 60,
  /** Timers running longer than this ask before their time is saved. */
  staleTimerSec: 6 * 60 * 60,
} as const;

/** Problem id: a LeetCode slug, or `nc:<slug>` for NeetCode-only unlisted problems. */
export const ProblemIdSchema = z
  .string()
  .regex(/^(nc:)?[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Invalid problem id')
  .max(120);
export type ProblemId = z.infer<typeof ProblemIdSchema>;

const Timestamps = {
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
};

export const AttemptSchema = z.object({
  id: z.uuid(),
  problemId: ProblemIdSchema,
  site: SiteSchema,
  outcome: OutcomeSchema,
  patterns: z.array(z.string().min(1).max(40)).max(LIMITS_RECORDS.maxPatterns),
  notes: z.string().max(LIMITS_RECORDS.notesMaxLength),
  /** Null when the timer was not used. */
  durationSec: z.number().int().min(0).max(LIMITS_RECORDS.maxDurationSec).nullable(),
  /** Computed once at save time from completedAt + rollover hour. Never recomputed. */
  logicalDay: LogicalDaySchema,
  /** True when the problem had been attempted before this attempt. */
  isReview: z.boolean(),
  completedAt: z.iso.datetime(),
  ...Timestamps,
});
export type Attempt = z.infer<typeof AttemptSchema>;

export const RestDaySchema = z.object({
  logicalDay: LogicalDaySchema,
  kind: z.literal('adhoc'),
  ...Timestamps,
});
export type RestDay = z.infer<typeof RestDaySchema>;

/** Frozen per-day facts, so changing settings never rewrites history. */
export const DaySnapshotSchema = z.object({
  logicalDay: LogicalDaySchema,
  goal: z.number().int().min(1),
  minReviews: z.number().int().min(0),
  plannedReviewCount: z.number().int().min(0),
  isRest: z.boolean(),
  ...Timestamps,
});
export type DaySnapshot = z.infer<typeof DaySnapshotSchema>;

export const TimerSchema = z.object({
  problemId: ProblemIdSchema,
  status: z.enum(['running', 'paused']),
  /** ISO time the current running segment began (null while paused). */
  startedAt: z.iso.datetime().nullable(),
  /** Time accumulated by previous segments. */
  accumulatedMs: z.number().int().min(0),
  updatedAt: z.iso.datetime(),
});
export type Timer = z.infer<typeof TimerSchema>;

export const UnlistedProblemSchema = z.object({
  id: ProblemIdSchema,
  title: z.string().min(1).max(200),
  site: SiteSchema,
  slug: z.string().min(1).max(120),
  difficulty: DifficultySchema.nullable(),
  ...Timestamps,
});
export type UnlistedProblem = z.infer<typeof UnlistedProblemSchema>;

/** Where the on-page toolbar sits, as distances from the viewport's right and top edges. */
export const ToolbarPositionSchema = z.object({
  right: z.number().int().min(0).max(10_000),
  top: z.number().int().min(0).max(10_000),
});
export type ToolbarPosition = z.infer<typeof ToolbarPositionSchema>;

/** Per-device UI preferences. Not part of backups. */
export const UiPrefsSchema = z.object({
  toolbarPosition: ToolbarPositionSchema.nullable(),
});
export type UiPrefs = z.infer<typeof UiPrefsSchema>;

export const DEFAULT_UI_PREFS: UiPrefs = { toolbarPosition: null };

export function timerElapsedMs(timer: Timer, now: Date): number {
  const running = timer.startedAt ? Math.max(0, now.getTime() - Date.parse(timer.startedAt)) : 0;
  return timer.accumulatedMs + running;
}
