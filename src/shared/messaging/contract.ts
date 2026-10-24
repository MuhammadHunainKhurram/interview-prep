import { z } from 'zod';
import { LogicalDaySchema, type LogicalDay } from '@/core/calendar/logical-day';
import type { RestDayError } from '@/core/calendar/rest-days';
import { ListIdSchema, type Difficulty, type ListId } from '@/core/catalog/schema';
import type { DayResult, PlanItem } from '@/core/planner/planner';
import {
  LIMITS_RECORDS,
  OutcomeSchema,
  ProblemIdSchema,
  ToolbarPositionSchema,
  type ToolbarPosition,
  type Attempt,
  type Outcome,
  type RestDay,
  type Timer,
} from '@/core/model/records';
import { SiteSchema, type Settings } from '@/core/model/settings';
import type { DifficultyTime, Forecast, ListProgress, WeakSection } from '@/core/stats/stats';
import type { DayInfo, StreakSummary } from '@/core/streak/streak';
import type { QuarantineEntry } from '@/data/repositories';

/* ---------- Request schemas (validated in the background before handling) ---------- */

const Empty = z.object({}).strict();
const ProblemRef = z.object({ problemId: ProblemIdSchema }).strict();
const Patterns = z.array(z.string().trim().min(1).max(40)).max(LIMITS_RECORDS.maxPatterns);
const Notes = z.string().max(LIMITS_RECORDS.notesMaxLength);

export const RequestSchemas = {
  'widget/state': z
    .object({
      site: SiteSchema,
      slug: z.string().min(1).max(120),
      title: z.string().max(300).optional(),
    })
    .strict(),
  'widget/position': z.object({ position: ToolbarPositionSchema.nullable() }).strict(),
  'timer/start': ProblemRef,
  'timer/pause': ProblemRef,
  'timer/reset': ProblemRef,
  'attempt/record': z
    .object({
      id: z.uuid(),
      problemId: ProblemIdSchema,
      site: SiteSchema,
      outcome: OutcomeSchema,
      patterns: Patterns,
      notes: Notes,
      title: z.string().max(300).optional(),
      /** Answer to a stale-timer prompt. */
      timeChoice: z.enum(['keep', 'discard']).optional(),
    })
    .strict(),
  'attempt/undo': z.object({ id: z.uuid() }).strict(),
  'attempt/update': z
    .object({
      id: z.uuid(),
      outcome: OutcomeSchema.optional(),
      patterns: Patterns.optional(),
      notes: Notes.optional(),
      durationSec: z.number().int().min(0).max(LIMITS_RECORDS.maxDurationSec).nullable().optional(),
    })
    .strict(),
  'attempt/delete': z.object({ id: z.uuid() }).strict(),
  'today/get': Empty,
  'overview/get': Empty,
  'problems/get': z.object({ listId: ListIdSchema }).strict(),
  'unlisted/get': Empty,
  'reviews/get': Empty,
  'history/get': z
    .object({
      problemId: ProblemIdSchema.optional(),
      limit: z.number().int().min(1).max(500).default(100),
      offset: z.number().int().min(0).default(0),
    })
    .strict(),
  'stats/get': Empty,
  'settings/get': Empty,
  /** Validated by the handler so field errors can be returned. */
  'settings/save': z.object({ settings: z.unknown() }).strict(),
  'restDays/get': Empty,
  'restDays/add': z.object({ day: LogicalDaySchema }).strict(),
  'restDays/remove': z.object({ day: LogicalDaySchema }).strict(),
  'backup/export': Empty,
  'backup/preview': z.object({ text: z.string() }).strict(),
  'backup/import': z.object({ text: z.string() }).strict(),
  'backup/safetyCopy': Empty,
  'data/reset': z.object({ confirm: z.literal('DELETE') }).strict(),
  'integrity/get': Empty,
  'integrity/clear': Empty,
  'dashboard/open': z
    .object({
      route: z
        .string()
        .regex(/^[a-z/-]*$/)
        .max(40)
        .optional(),
    })
    .strict(),
} as const;

export type RequestType = keyof typeof RequestSchemas;
export type RequestPayload<K extends RequestType> = z.input<(typeof RequestSchemas)[K]>;
export type ParsedRequest<K extends RequestType> = z.output<(typeof RequestSchemas)[K]>;

/* ---------- Views returned to the UI ---------- */

export interface ProblemView {
  id: string;
  title: string;
  difficulty: Difficulty | null;
  section: string | null;
  lists: ListId[];
  urls: { neetcode: string | null; leetcode: string | null };
  unlisted: boolean;
  neetcodePro: boolean;
}

export interface ProblemStatus {
  attemptCount: number;
  everSolved: boolean;
  lastOutcome: Outcome;
  lastAttemptAt: string;
  lastSolvedAt: string | null;
  nextReviewDay: LogicalDay;
  intervalDays: number;
}

export interface ProblemWithStatus extends ProblemView {
  status: ProblemStatus | null;
}

export type AttemptView = Attempt & { problemTitle: string };

export interface WidgetState {
  today: LogicalDay;
  problem: ProblemView;
  status: ProblemStatus | null;
  timer: Timer | null;
  history: AttemptView[];
  planRole: 'review' | 'new' | null;
  doneToday: boolean;
  defaultPatterns: string[];
  preferredSite: Settings['preferredSite'];
  theme: Settings['theme'];
  toolbarPosition: ToolbarPosition | null;
}

export interface TodayView {
  today: LogicalDay;
  isRest: boolean;
  goal: number;
  minReviews: number;
  items: (PlanItem & { problem: ProblemView })[];
  result: DayResult;
  streak: StreakSummary;
  deferredReviews: number;
  activeList: ListId;
  preferredSite: Settings['preferredSite'];
}

export interface OverviewView {
  today: TodayView;
  heatmap: DayInfo[];
  activeList: ListProgress;
  lists: { listId: ListId; total: number; solved: number }[];
  upcoming: { day: LogicalDay; count: number }[];
  integrityIssues: number;
}

export interface ProblemsView {
  progress: ListProgress;
  sections: { section: string; problems: ProblemWithStatus[] }[];
  today: LogicalDay;
  preferredSite: Settings['preferredSite'];
}

export interface ReviewsView {
  today: LogicalDay;
  due: (ProblemWithStatus & { overdueDays: number })[];
  upcoming: { day: LogicalDay; problems: ProblemWithStatus[] }[];
  preferredSite: Settings['preferredSite'];
}

export interface HistoryView {
  total: number;
  attempts: AttemptView[];
}

export interface StatsView {
  totals: { attempts: number; problems: number; solved: number; timedSec: number };
  outcomes: Record<Outcome, number>;
  averageTimes: DifficultyTime[];
  weakSections: WeakSection[];
  forecast: Forecast;
  streak: StreakSummary;
  lists: ListProgress[];
  activeList: ListId;
}

export interface RestDaysView {
  today: LogicalDay;
  restWeekdays: number[];
  budgetPerMonth: number;
  entries: RestDay[];
  usedByMonth: Record<string, number>;
}

export interface BackupPreview {
  exportedAt: string;
  attempts: number;
  problems: number;
  restDays: number;
}

export interface ResponseMap {
  'widget/state': WidgetState;
  'widget/position': null;
  'timer/start': Timer;
  'timer/pause': Timer;
  'timer/reset': null;
  'attempt/record': { attempt: Attempt };
  'attempt/undo': { timer: Timer | null };
  'attempt/update': { attempt: Attempt };
  'attempt/delete': null;
  'today/get': TodayView;
  'overview/get': OverviewView;
  'problems/get': ProblemsView;
  'unlisted/get': ProblemWithStatus[];
  'reviews/get': ReviewsView;
  'history/get': HistoryView;
  'stats/get': StatsView;
  'settings/get': Settings;
  'settings/save': Settings;
  'restDays/get': RestDaysView;
  'restDays/add': RestDaysView;
  'restDays/remove': RestDaysView;
  'backup/export': { filename: string; text: string };
  'backup/preview': BackupPreview;
  'backup/import': BackupPreview;
  'backup/safetyCopy': { filename: string; text: string } | null;
  'data/reset': null;
  'integrity/get': { entries: QuarantineEntry[] };
  'integrity/clear': null;
  'dashboard/open': null;
}

/* ---------- Envelope and errors ---------- */

export type ErrorCode =
  'validation' | 'not-found' | 'stale-timer' | 'rest-day' | 'conflict' | 'backup' | 'internal';

export interface ErrorPayload {
  code: ErrorCode;
  message: string;
  /** Field → message, for forms. */
  fields?: Record<string, string>;
  elapsedSec?: number;
  restDayError?: RestDayError;
}

export class AppError extends Error {
  constructor(
    readonly code: ErrorCode,
    message: string,
    readonly extra: Omit<ErrorPayload, 'code' | 'message'> = {},
  ) {
    super(message);
  }

  toPayload(): ErrorPayload {
    return { code: this.code, message: this.message, ...this.extra };
  }
}

export interface RequestEnvelope<K extends RequestType = RequestType> {
  channel: 'interview-prep';
  type: K;
  payload: RequestPayload<K>;
}

export type ResponseEnvelope<K extends RequestType = RequestType> =
  { ok: true; data: ResponseMap[K] } | { ok: false; error: ErrorPayload };

/** Messages the background sends to a content script. */
export type TabMessage = { channel: 'interview-prep'; type: 'widget/open' };
