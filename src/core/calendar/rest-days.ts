import type { DaySnapshot, RestDay } from '../model/records';
import type { Settings } from '../model/settings';
import { addDays, diffDays, monthKey, weekday, type LogicalDay } from './logical-day';

/** How far ahead an extra rest day can be planned. */
export const MAX_REST_DAYS_AHEAD = 90;

export interface RestContext {
  restWeekdays: readonly number[];
  adHoc: ReadonlySet<LogicalDay>;
  /** Frozen facts for past days. They win over current settings. */
  snapshots: ReadonlyMap<LogicalDay, DaySnapshot>;
  today: LogicalDay;
}

export function isWeeklyRestDay(day: LogicalDay, restWeekdays: readonly number[]): boolean {
  return restWeekdays.includes(weekday(day));
}

export function isRestDay(day: LogicalDay, ctx: RestContext): boolean {
  if (day < ctx.today) {
    const snap = ctx.snapshots.get(day);
    if (snap) return snap.isRest;
  }
  return ctx.adHoc.has(day) || isWeeklyRestDay(day, ctx.restWeekdays);
}

/** First day on or after `day` that isn't a rest day. */
export function nextActiveDay(day: LogicalDay, ctx: RestContext): LogicalDay {
  let d = day;
  // Settings guarantee at least one active weekday, and extra rest days are capped
  // per month, so this always ends. The bound is a safety net only.
  for (let i = 0; i < 400 && isRestDay(d, ctx); i++) d = addDays(d, 1);
  return d;
}

export type RestDayError =
  | 'out-of-range'
  | 'already-rest'
  | 'weekly-rest-day'
  | 'has-attempts'
  | 'budget-exceeded';

export const REST_DAY_ERROR_MESSAGES: Record<RestDayError, string> = {
  'out-of-range': `Rest days can be set for yesterday, today, or up to ${MAX_REST_DAYS_AHEAD} days ahead.`,
  'already-rest': 'That day is already a rest day.',
  'weekly-rest-day': 'That day is already one of your weekly rest days.',
  'has-attempts': "You've already practiced on that day, so it can't be a rest day.",
  'budget-exceeded': "You've used all your extra rest days for that month.",
};

/** Checks whether an extra (ad-hoc) rest day can be added. Returns null when allowed. */
export function validateAdHocRestDay(
  day: LogicalDay,
  input: {
    today: LogicalDay;
    settings: Pick<Settings, 'restWeekdays' | 'adHocRestBudgetPerMonth'>;
    existing: readonly RestDay[];
    daysWithAttempts: ReadonlySet<LogicalDay>;
    snapshots: ReadonlyMap<LogicalDay, DaySnapshot>;
  },
): RestDayError | null {
  const offset = diffDays(input.today, day);
  if (offset < -1 || offset > MAX_REST_DAYS_AHEAD) return 'out-of-range';
  if (input.existing.some((r) => r.logicalDay === day)) return 'already-rest';

  const pastSnapshot = day < input.today ? input.snapshots.get(day) : undefined;
  if (pastSnapshot?.isRest) return 'already-rest';
  if (!pastSnapshot && isWeeklyRestDay(day, input.settings.restWeekdays)) return 'weekly-rest-day';

  if (input.daysWithAttempts.has(day)) return 'has-attempts';

  const usedInMonth = input.existing.filter((r) => monthKey(r.logicalDay) === monthKey(day)).length;
  if (usedInMonth >= input.settings.adHocRestBudgetPerMonth) return 'budget-exceeded';
  return null;
}

/** Extra rest days can be removed for yesterday onwards; older history is frozen. */
export function canRemoveAdHocRestDay(day: LogicalDay, today: LogicalDay): boolean {
  return diffDays(today, day) >= -1;
}
