import { addDays, dayRange, type LogicalDay } from '../calendar/logical-day';
import { isRestDay, type RestContext } from '../calendar/rest-days';
import type { Attempt, DaySnapshot } from '../model/records';
import type { Settings } from '../model/settings';
import { evaluateDay } from '../planner/planner';

export type DayStatus = 'goal-met' | 'partial' | 'missed' | 'rest' | 'today' | 'future';

export interface DayInfo {
  day: LogicalDay;
  status: DayStatus;
  problemsDone: number;
  goal: number;
}

export interface StreakInput {
  today: LogicalDay;
  /** First day with any history. Nothing before it counts as missed. */
  firstDay: LogicalDay | null;
  attemptsByDay: ReadonlyMap<LogicalDay, readonly Attempt[]>;
  snapshots: ReadonlyMap<LogicalDay, DaySnapshot>;
  rest: RestContext;
  settings: Pick<Settings, 'dailyGoal' | 'minReviewsPerDay'>;
}

export function dayInfo(day: LogicalDay, input: StreakInput): DayInfo {
  const attempts = input.attemptsByDay.get(day) ?? [];
  const snap = input.snapshots.get(day);
  const rule = {
    goal: snap?.goal ?? input.settings.dailyGoal,
    minReviews: snap?.minReviews ?? input.settings.minReviewsPerDay,
    // Without a snapshot we don't know what was planned, so only the count matters.
    plannedReviewCount: snap?.plannedReviewCount ?? 0,
  };
  const result = evaluateDay(attempts, rule);
  const base = { day, problemsDone: result.problemsDone, goal: rule.goal };

  if (day > input.today) return { ...base, status: isRestDay(day, input.rest) ? 'rest' : 'future' };
  if (isRestDay(day, input.rest)) return { ...base, status: 'rest' };
  if (result.goalMet) return { ...base, status: 'goal-met' };
  if (day === input.today) return { ...base, status: 'today' };
  if (input.firstDay === null || day < input.firstDay) return { ...base, status: 'missed' };
  return { ...base, status: result.problemsDone > 0 ? 'partial' : 'missed' };
}

export interface StreakSummary {
  current: number;
  longest: number;
  todayMet: boolean;
}

/**
 * Streak = consecutive days with the goal met. Rest days are skipped: they neither
 * break nor extend it. Today only counts once met, and can't break the streak until
 * it's over.
 */
export function computeStreak(input: StreakInput): StreakSummary {
  const todayMet = dayInfo(input.today, input).status === 'goal-met';
  if (!input.firstDay) return { current: 0, longest: 0, todayMet };

  let longest = 0;
  let run = 0;
  for (const day of dayRange(input.firstDay, input.today)) {
    const status = dayInfo(day, input).status;
    if (status === 'goal-met') longest = Math.max(longest, ++run);
    else if (status === 'rest' || status === 'today') continue;
    else run = 0;
  }

  let current = 0;
  for (let day = input.today; day >= input.firstDay; day = addDays(day, -1)) {
    const status = dayInfo(day, input).status;
    if (status === 'goal-met') current++;
    else if (status === 'rest' || status === 'today') continue;
    else break;
  }
  return { current, longest, todayMet };
}

/** Day cells for a heatmap ending today. */
export function heatmap(input: StreakInput, weeks: number): DayInfo[] {
  const from = addDays(input.today, -(weeks * 7 - 1));
  return dayRange(from, input.today).map((d) => dayInfo(d, input));
}
