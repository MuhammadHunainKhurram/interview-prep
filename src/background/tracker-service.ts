import {
  addDays,
  dayRange,
  diffDays,
  monthKey,
  toLogicalDay,
  type Clock,
  type LogicalDay,
} from '@/core/calendar/logical-day';
import {
  canRemoveAdHocRestDay,
  isRestDay,
  isWeeklyRestDay,
  nextActiveDay,
  REST_DAY_ERROR_MESSAGES,
  validateAdHocRestDay,
  type RestContext,
} from '@/core/calendar/rest-days';
import { siteUrls, type ProblemCatalog } from '@/core/catalog/catalog';
import { LIST_IDS } from '@/core/catalog/schema';
import { ROADMAP_PATTERNS } from '@/core/model/patterns';
import {
  LIMITS_RECORDS,
  timerElapsedMs,
  type Attempt,
  type DaySnapshot,
  type RestDay,
  type Timer,
  type UnlistedProblem,
} from '@/core/model/records';
import { SettingsSchema, type Settings, type Site } from '@/core/model/settings';
import {
  buildDayPlan,
  evaluateDay,
  plannedReviewCount,
  type DayPlan,
} from '@/core/planner/planner';
import { attemptsByDay, buildProgress, type ProblemProgress } from '@/core/progress/progress';
import type { Scheduler } from '@/core/srs/scheduler';
import {
  averageSolveTime,
  forecastFinish,
  listProgress,
  outcomeCounts,
  upcomingReviews,
  weakSections,
} from '@/core/stats/stats';
import { computeStreak, heatmap, type StreakInput } from '@/core/streak/streak';
import { BackupError, createBackup, parseBackup, type Backup } from '@/data/backup';
import type { Repositories } from '@/data/repositories';
import {
  AppError,
  type AttemptView,
  type BackupPreview,
  type ParsedRequest,
  type ProblemStatus,
  type ProblemView,
  type ProblemWithStatus,
  type RestDaysView,
  type TodayView,
} from '@/shared/messaging/contract';

/** Undo is meant for accidental clicks; older attempts are deleted from History instead. */
export const UNDO_WINDOW_MS = 2 * 60 * 1000;
export const HEATMAP_WEEKS = 53;

interface Context {
  now: Date;
  today: LogicalDay;
  settings: Settings;
  attempts: Attempt[];
  restDays: RestDay[];
  snapshots: Map<LogicalDay, DaySnapshot>;
  unlisted: Map<string, UnlistedProblem>;
  progress: Map<string, ProblemProgress>;
  rest: RestContext;
}

/** Strips site suffixes and control characters from a page title. */
export function cleanTitle(raw: string | undefined, fallbackSlug: string): string {
  const cleaned = (raw ?? '')
    // eslint-disable-next-line no-control-regex -- stripping control characters is the point
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s*[-|–]\s*(LeetCode|NeetCode).*$/i, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 200);
  if (cleaned && !/^(leet|neet)code$/i.test(cleaned)) return cleaned;
  return fallbackSlug
    .split('-')
    .map((w) => (w ? w[0]!.toUpperCase() + w.slice(1) : w))
    .join(' ');
}

export class TrackerService {
  private queue: Promise<unknown> = Promise.resolve();

  constructor(
    private readonly repos: Repositories,
    private readonly catalog: ProblemCatalog,
    private readonly scheduler: Scheduler,
    private readonly clock: Clock,
  ) {}

  /** Serializes every operation so concurrent messages can't interleave writes. */
  exclusive<T>(fn: () => Promise<T>): Promise<T> {
    const run = this.queue.then(fn, fn);
    this.queue = run.catch(() => undefined);
    return run;
  }

  /* ---------------- context ---------------- */

  private async load(): Promise<Context> {
    const now = this.clock.now();
    const settings = await this.repos.settings.get();
    const [attempts, restDays, snapshots, unlisted] = await Promise.all([
      this.repos.attempts.all(),
      this.repos.restDays.all(),
      this.repos.snapshots.all(),
      this.repos.unlisted.all(),
    ]);
    const today = toLogicalDay(now, settings.rolloverHour);
    const snapshotMap = new Map(snapshots.map((s) => [s.logicalDay, s]));
    return {
      now,
      today,
      settings,
      attempts,
      restDays,
      snapshots: snapshotMap,
      unlisted: new Map(unlisted.map((u) => [u.id, u])),
      progress: buildProgress(attempts, this.scheduler, {
        maxIntervalDays: settings.maxIntervalDays,
      }),
      rest: {
        restWeekdays: settings.restWeekdays,
        adHoc: new Set(restDays.map((r) => r.logicalDay)),
        snapshots: snapshotMap,
        today,
      },
    };
  }

  private plan(ctx: Context): DayPlan {
    return buildDayPlan({
      today: ctx.today,
      isRest: isRestDay(ctx.today, ctx.rest),
      settings: ctx.settings,
      progress: ctx.progress,
      todaysAttempts: ctx.attempts.filter((a) => a.logicalDay === ctx.today),
      listOrder: this.catalog.list(ctx.settings.activeList).map((p) => p.id),
    });
  }

  /**
   * Freezes the facts of past days and records today's. Days the extension never saw
   * (browser closed) are backfilled with the settings in effect, which haven't changed
   * since: every settings change runs this first.
   */
  private async syncSnapshots(ctx: Context): Promise<void> {
    const meta = await this.repos.meta();
    const installDay = toLogicalDay(new Date(meta.installedAt), ctx.settings.rolloverHour);
    const known = [...ctx.snapshots.keys()].sort();
    const start = known.length ? addDays(known.at(-1)!, 1) : installDay;
    const stamp = ctx.now.toISOString();

    for (const day of dayRange(start, addDays(ctx.today, -1)).slice(-400)) {
      const snap: DaySnapshot = {
        logicalDay: day,
        goal: ctx.settings.dailyGoal,
        minReviews: ctx.settings.minReviewsPerDay,
        plannedReviewCount: 0,
        isRest: ctx.rest.adHoc.has(day) || isWeeklyRestDay(day, ctx.settings.restWeekdays),
        createdAt: stamp,
        updatedAt: stamp,
      };
      await this.repos.snapshots.put(snap);
      ctx.snapshots.set(day, snap);
    }

    const plan = this.plan(ctx);
    const existing = ctx.snapshots.get(ctx.today);
    const next: DaySnapshot = {
      logicalDay: ctx.today,
      goal: plan.goal,
      minReviews: plan.minReviews,
      plannedReviewCount: plannedReviewCount(plan),
      isRest: plan.isRest,
      createdAt: existing?.createdAt ?? stamp,
      updatedAt: stamp,
    };
    if (
      !existing ||
      existing.goal !== next.goal ||
      existing.minReviews !== next.minReviews ||
      existing.plannedReviewCount !== next.plannedReviewCount ||
      existing.isRest !== next.isRest
    ) {
      await this.repos.snapshots.put(next);
      ctx.snapshots.set(ctx.today, next);
    }
  }

  private streakInput(ctx: Context): StreakInput {
    const days = ctx.attempts.map((a) => a.logicalDay).sort();
    return {
      today: ctx.today,
      firstDay: days[0] ?? null,
      attemptsByDay: attemptsByDay(ctx.attempts),
      snapshots: ctx.snapshots,
      rest: ctx.rest,
      settings: ctx.settings,
    };
  }

  /* ---------------- views ---------------- */

  private problemView(ctx: Context, id: string): ProblemView {
    const p = this.catalog.get(id);
    if (p) {
      return {
        id,
        title: p.title,
        difficulty: p.difficulty,
        section: p.section,
        lists: LIST_IDS.filter((l) => p.lists[l] !== undefined),
        urls: siteUrls(p),
        unlisted: false,
        neetcodePro: p.neetcodePro,
      };
    }
    const u = ctx.unlisted.get(id);
    const slug = id.replace(/^nc:/, '');
    const site: Site = u?.site ?? (id.startsWith('nc:') ? 'neetcode' : 'leetcode');
    return {
      id,
      title: u?.title ?? cleanTitle(undefined, slug),
      difficulty: u?.difficulty ?? null,
      section: null,
      lists: [],
      urls: {
        neetcode: site === 'neetcode' ? `https://neetcode.io/problems/${slug}` : null,
        leetcode: site === 'leetcode' ? `https://leetcode.com/problems/${slug}/` : null,
      },
      unlisted: true,
      neetcodePro: false,
    };
  }

  private status(ctx: Context, id: string): ProblemStatus | null {
    const p = ctx.progress.get(id);
    if (!p) return null;
    return {
      attemptCount: p.attemptCount,
      everSolved: p.everSolved,
      lastOutcome: p.lastAttempt.outcome,
      lastAttemptAt: p.lastAttempt.completedAt,
      lastSolvedAt: p.lastSolvedAt,
      nextReviewDay: nextActiveDay(p.card.dueDay, ctx.rest),
      intervalDays: p.card.intervalDays,
    };
  }

  private withStatus(ctx: Context, id: string): ProblemWithStatus {
    return { ...this.problemView(ctx, id), status: this.status(ctx, id) };
  }

  private attemptView(ctx: Context, a: Attempt): AttemptView {
    return { ...a, problemTitle: this.problemView(ctx, a.problemId).title };
  }

  private todayView(ctx: Context): TodayView {
    const plan = this.plan(ctx);
    const snap = ctx.snapshots.get(ctx.today);
    return {
      today: ctx.today,
      isRest: plan.isRest,
      goal: plan.goal,
      minReviews: plan.minReviews,
      items: plan.items.map((i) => ({ ...i, problem: this.problemView(ctx, i.problemId) })),
      result: evaluateDay(
        ctx.attempts.filter((a) => a.logicalDay === ctx.today),
        {
          goal: plan.goal,
          minReviews: plan.minReviews,
          plannedReviewCount: snap?.plannedReviewCount ?? plannedReviewCount(plan),
        },
      ),
      streak: computeStreak(this.streakInput(ctx)),
      deferredReviews: plan.deferredReviews,
      activeList: ctx.settings.activeList,
      preferredSite: ctx.settings.preferredSite,
    };
  }

  /* ---------------- problem resolution ---------------- */

  /** Canonical id for a problem page. Unknown problems become unlisted. */
  resolveId(site: Site, slug: string): string {
    const p = this.catalog.resolve(site, slug);
    if (p) return p.id;
    return site === 'leetcode' ? slug : `nc:${slug}`;
  }

  /* ---------------- handlers ---------------- */

  widgetState(req: ParsedRequest<'widget/state'>) {
    return this.exclusive(async () => {
      const ctx = await this.load();
      const id = this.resolveId(req.site, req.slug);
      const view = this.problemView(ctx, id);
      if (view.unlisted && !ctx.unlisted.has(id)) view.title = cleanTitle(req.title, req.slug);
      const plan = this.plan(ctx);
      const item = plan.items.find((i) => i.problemId === id);
      const history = (ctx.progress.get(id)?.attempts ?? []).slice(-10).reverse();
      const section = this.catalog.get(id)?.section;
      const lastPatterns = history[0]?.patterns;
      return {
        today: ctx.today,
        problem: view,
        status: this.status(ctx, id),
        timer: (await this.repos.timers.get(id)) ?? null,
        history: history.map((a) => this.attemptView(ctx, a)),
        planRole: item?.kind ?? null,
        doneToday: ctx.attempts.some((a) => a.problemId === id && a.logicalDay === ctx.today),
        defaultPatterns:
          lastPatterns && lastPatterns.length
            ? lastPatterns
            : section && (ROADMAP_PATTERNS as readonly string[]).includes(section)
              ? [section]
              : [],
        preferredSite: ctx.settings.preferredSite,
        theme: ctx.settings.theme,
        toolbarPosition: (await this.repos.uiPrefs.get()).toolbarPosition,
      };
    });
  }

  setToolbarPosition({ position }: ParsedRequest<'widget/position'>) {
    return this.exclusive(async () => {
      await this.repos.uiPrefs.save({
        ...(await this.repos.uiPrefs.get()),
        toolbarPosition: position,
      });
      return null;
    });
  }

  timerStart({ problemId }: ParsedRequest<'timer/start'>) {
    return this.exclusive(async () => {
      const now = this.clock.now();
      const existing = await this.repos.timers.get(problemId);
      if (existing?.status === 'running') return existing;
      const timer: Timer = {
        problemId,
        status: 'running',
        startedAt: now.toISOString(),
        accumulatedMs: existing?.accumulatedMs ?? 0,
        updatedAt: now.toISOString(),
      };
      await this.repos.timers.put(timer);
      return timer;
    });
  }

  timerPause({ problemId }: ParsedRequest<'timer/pause'>) {
    return this.exclusive(async () => {
      const now = this.clock.now();
      const existing = await this.repos.timers.get(problemId);
      if (!existing) throw new AppError('not-found', 'The timer is not running.');
      if (existing.status === 'paused') return existing;
      const timer: Timer = {
        ...existing,
        status: 'paused',
        startedAt: null,
        accumulatedMs: Math.min(
          timerElapsedMs(existing, now),
          LIMITS_RECORDS.maxDurationSec * 1000,
        ),
        updatedAt: now.toISOString(),
      };
      await this.repos.timers.put(timer);
      return timer;
    });
  }

  timerReset({ problemId }: ParsedRequest<'timer/reset'>) {
    return this.exclusive(async () => {
      await this.repos.timers.remove(problemId);
      return null;
    });
  }

  recordAttempt(req: ParsedRequest<'attempt/record'>) {
    return this.exclusive(async () => {
      // Idempotent: a retried or double-sent request returns the original attempt.
      const existing = await this.repos.attempts.get(req.id);
      if (existing) return { attempt: existing };

      const ctx = await this.load();
      const inCatalog = this.catalog.get(req.problemId);
      if (!inCatalog && !ctx.unlisted.has(req.problemId)) {
        const slug = req.problemId.replace(/^nc:/, '');
        const site: Site = req.problemId.startsWith('nc:') ? 'neetcode' : 'leetcode';
        const stamp = ctx.now.toISOString();
        const record: UnlistedProblem = {
          id: req.problemId,
          title: cleanTitle(req.title, slug),
          site,
          slug,
          difficulty: null,
          createdAt: stamp,
          updatedAt: stamp,
        };
        await this.repos.unlisted.put(record);
        ctx.unlisted.set(record.id, record);
      }

      const timer = await this.repos.timers.get(req.problemId);
      let durationSec: number | null = timer
        ? Math.round(timerElapsedMs(timer, ctx.now) / 1000)
        : null;
      if (durationSec !== null && durationSec > LIMITS_RECORDS.staleTimerSec && !req.timeChoice)
        throw new AppError('stale-timer', 'The timer has been running for a long time.', {
          elapsedSec: durationSec,
        });
      if (req.timeChoice === 'discard') durationSec = null;
      if (durationSec !== null) durationSec = Math.min(durationSec, LIMITS_RECORDS.maxDurationSec);

      const stamp = ctx.now.toISOString();
      const attempt: Attempt = {
        id: req.id,
        problemId: req.problemId,
        site: req.site,
        outcome: req.outcome,
        patterns: [...new Set(req.patterns.map((p) => p.trim()).filter(Boolean))],
        // eslint-disable-next-line no-control-regex -- strip control chars except tab/newline
        notes: req.notes.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '').trimEnd(),
        durationSec,
        logicalDay: ctx.today,
        isReview: ctx.progress.has(req.problemId),
        completedAt: stamp,
        createdAt: stamp,
        updatedAt: stamp,
      };
      await this.repos.attempts.put(attempt);
      await this.repos.timers.remove(req.problemId);
      await this.syncSnapshots(await this.load());
      return { attempt };
    });
  }

  undoAttempt({ id }: ParsedRequest<'attempt/undo'>) {
    return this.exclusive(async () => {
      const attempt = await this.repos.attempts.get(id);
      if (!attempt) throw new AppError('not-found', 'That attempt no longer exists.');
      const now = this.clock.now();
      if (now.getTime() - Date.parse(attempt.createdAt) > UNDO_WINDOW_MS)
        throw new AppError('conflict', 'Too late to undo. You can delete it from History instead.');
      await this.repos.attempts.remove(id);
      let timer: Timer | null = null;
      if (attempt.durationSec !== null) {
        timer = {
          problemId: attempt.problemId,
          status: 'paused',
          startedAt: null,
          accumulatedMs: attempt.durationSec * 1000,
          updatedAt: now.toISOString(),
        };
        await this.repos.timers.put(timer);
      }
      await this.syncSnapshots(await this.load());
      return { timer };
    });
  }

  updateAttempt(req: ParsedRequest<'attempt/update'>) {
    return this.exclusive(async () => {
      const attempt = await this.repos.attempts.get(req.id);
      if (!attempt) throw new AppError('not-found', 'That attempt no longer exists.');
      const updated: Attempt = {
        ...attempt,
        ...(req.outcome !== undefined && { outcome: req.outcome }),
        ...(req.patterns !== undefined && { patterns: [...new Set(req.patterns)] }),
        ...(req.notes !== undefined && { notes: req.notes.trimEnd() }),
        ...(req.durationSec !== undefined && { durationSec: req.durationSec }),
        updatedAt: this.clock.now().toISOString(),
      };
      await this.repos.attempts.put(updated);
      await this.syncSnapshots(await this.load());
      return { attempt: updated };
    });
  }

  deleteAttempt({ id }: ParsedRequest<'attempt/delete'>) {
    return this.exclusive(async () => {
      await this.repos.attempts.remove(id);
      await this.syncSnapshots(await this.load());
      return null;
    });
  }

  today() {
    return this.exclusive(async () => {
      const ctx = await this.load();
      await this.syncSnapshots(ctx);
      return this.todayView(ctx);
    });
  }

  overview() {
    return this.exclusive(async () => {
      const ctx = await this.load();
      await this.syncSnapshots(ctx);
      return {
        today: this.todayView(ctx),
        heatmap: heatmap(this.streakInput(ctx), HEATMAP_WEEKS),
        activeList: listProgress(this.catalog, ctx.settings.activeList, ctx.progress),
        lists: LIST_IDS.map((listId) => {
          const lp = listProgress(this.catalog, listId, ctx.progress);
          return { listId, total: lp.total, solved: lp.solved };
        }),
        upcoming: upcomingReviews(ctx.today, ctx.progress, ctx.rest, 7),
        integrityIssues: (await this.repos.quarantine.list()).length,
      };
    });
  }

  problems({ listId }: ParsedRequest<'problems/get'>) {
    return this.exclusive(async () => {
      const ctx = await this.load();
      const sections = new Map<string, ProblemWithStatus[]>();
      for (const p of this.catalog.list(listId)) {
        const list = sections.get(p.section) ?? [];
        list.push(this.withStatus(ctx, p.id));
        sections.set(p.section, list);
      }
      return {
        progress: listProgress(this.catalog, listId, ctx.progress),
        sections: [...sections].map(([section, problems]) => ({ section, problems })),
        today: ctx.today,
        preferredSite: ctx.settings.preferredSite,
      };
    });
  }

  unlistedProblems() {
    return this.exclusive(async () => {
      const ctx = await this.load();
      return [...ctx.unlisted.keys()]
        .map((id) => this.withStatus(ctx, id))
        .sort((a, b) =>
          (b.status?.lastAttemptAt ?? '').localeCompare(a.status?.lastAttemptAt ?? ''),
        );
    });
  }

  reviews() {
    return this.exclusive(async () => {
      const ctx = await this.load();
      const due = [...ctx.progress.values()]
        .filter((p) => p.card.dueDay <= ctx.today)
        .sort((a, b) => a.card.dueDay.localeCompare(b.card.dueDay))
        .map((p) => ({
          ...this.withStatus(ctx, p.problemId),
          overdueDays: diffDays(p.card.dueDay, ctx.today),
        }));
      const byDay = new Map<LogicalDay, ProblemWithStatus[]>();
      for (const p of ctx.progress.values()) {
        if (p.card.dueDay <= ctx.today) continue;
        const day = nextActiveDay(p.card.dueDay, ctx.rest);
        if (diffDays(ctx.today, day) > 14) continue;
        byDay.set(day, [...(byDay.get(day) ?? []), this.withStatus(ctx, p.problemId)]);
      }
      return {
        today: ctx.today,
        due,
        upcoming: [...byDay]
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([day, problems]) => ({ day, problems })),
        preferredSite: ctx.settings.preferredSite,
      };
    });
  }

  history(req: ParsedRequest<'history/get'>) {
    return this.exclusive(async () => {
      const ctx = await this.load();
      const filtered = ctx.attempts
        .filter((a) => !req.problemId || a.problemId === req.problemId)
        .sort((a, b) => b.completedAt.localeCompare(a.completedAt));
      return {
        total: filtered.length,
        attempts: filtered
          .slice(req.offset, req.offset + req.limit)
          .map((a) => this.attemptView(ctx, a)),
      };
    });
  }

  stats() {
    return this.exclusive(async () => {
      const ctx = await this.load();
      const lists = LIST_IDS.map((l) => listProgress(this.catalog, l, ctx.progress));
      const active = lists.find((l) => l.listId === ctx.settings.activeList)!;
      return {
        totals: {
          attempts: ctx.attempts.length,
          problems: ctx.progress.size,
          solved: [...ctx.progress.values()].filter((p) => p.everSolved).length,
          timedSec: ctx.attempts.reduce((s, a) => s + (a.durationSec ?? 0), 0),
        },
        outcomes: outcomeCounts(ctx.attempts),
        averageTimes: averageSolveTime(this.catalog, ctx.attempts),
        weakSections: weakSections(this.catalog, ctx.attempts),
        forecast: forecastFinish({
          today: ctx.today,
          list: active,
          attempts: ctx.attempts,
          catalog: this.catalog,
          rest: ctx.rest,
        }),
        streak: computeStreak(this.streakInput(ctx)),
        lists,
        activeList: ctx.settings.activeList,
      };
    });
  }

  getSettings() {
    return this.exclusive(() => this.repos.settings.get());
  }

  saveSettings({ settings }: ParsedRequest<'settings/save'>) {
    return this.exclusive(async () => {
      const parsed = SettingsSchema.safeParse(settings);
      if (!parsed.success) {
        const fields: Record<string, string> = {};
        for (const issue of parsed.error.issues)
          fields[String(issue.path[0] ?? 'form')] ??= issue.message;
        throw new AppError('validation', 'Some settings are invalid.', { fields });
      }
      // Freeze past days under the old settings before applying the new ones.
      await this.syncSnapshots(await this.load());
      await this.repos.settings.save(parsed.data);
      await this.syncSnapshots(await this.load());
      return parsed.data;
    });
  }

  private restDaysView(ctx: Context): RestDaysView {
    const usedByMonth: Record<string, number> = {};
    for (const r of ctx.restDays)
      usedByMonth[monthKey(r.logicalDay)] = (usedByMonth[monthKey(r.logicalDay)] ?? 0) + 1;
    return {
      today: ctx.today,
      restWeekdays: ctx.settings.restWeekdays,
      budgetPerMonth: ctx.settings.adHocRestBudgetPerMonth,
      entries: ctx.restDays
        .filter((r) => r.logicalDay >= addDays(ctx.today, -60))
        .sort((a, b) => a.logicalDay.localeCompare(b.logicalDay)),
      usedByMonth,
    };
  }

  restDays() {
    return this.exclusive(async () => this.restDaysView(await this.load()));
  }

  addRestDay({ day }: ParsedRequest<'restDays/add'>) {
    return this.exclusive(async () => {
      const ctx = await this.load();
      await this.syncSnapshots(ctx);
      const error = validateAdHocRestDay(day, {
        today: ctx.today,
        settings: ctx.settings,
        existing: ctx.restDays,
        daysWithAttempts: new Set(ctx.attempts.map((a) => a.logicalDay)),
        snapshots: ctx.snapshots,
      });
      if (error)
        throw new AppError('rest-day', REST_DAY_ERROR_MESSAGES[error], { restDayError: error });
      const stamp = ctx.now.toISOString();
      await this.repos.restDays.put({
        logicalDay: day,
        kind: 'adhoc',
        createdAt: stamp,
        updatedAt: stamp,
      });
      const past = day < ctx.today ? ctx.snapshots.get(day) : undefined;
      if (past) await this.repos.snapshots.put({ ...past, isRest: true, updatedAt: stamp });
      const next = await this.load();
      await this.syncSnapshots(next);
      return this.restDaysView(next);
    });
  }

  removeRestDay({ day }: ParsedRequest<'restDays/remove'>) {
    return this.exclusive(async () => {
      const ctx = await this.load();
      if (!canRemoveAdHocRestDay(day, ctx.today))
        throw new AppError('rest-day', 'Rest days older than yesterday are part of your history.');
      if (!ctx.restDays.some((r) => r.logicalDay === day))
        throw new AppError('not-found', "That day isn't an extra rest day.");
      await this.repos.restDays.remove(day);
      const past = day < ctx.today ? ctx.snapshots.get(day) : undefined;
      if (past)
        await this.repos.snapshots.put({
          ...past,
          isRest: false,
          updatedAt: ctx.now.toISOString(),
        });
      const next = await this.load();
      await this.syncSnapshots(next);
      return this.restDaysView(next);
    });
  }

  /* ---------------- backup & data ---------------- */

  private backupFile(backup: Backup, prefix: string) {
    const date = backup.exportedAt.slice(0, 10);
    return { filename: `${prefix}-${date}.json`, text: JSON.stringify(backup, null, 2) };
  }

  exportBackup() {
    return this.exclusive(async () =>
      this.backupFile(
        createBackup(await this.repos.exportData(), this.clock.now()),
        'interview-prep-backup',
      ),
    );
  }

  private parse(text: string): Backup {
    try {
      return parseBackup(text);
    } catch (e) {
      if (e instanceof BackupError) throw new AppError('backup', e.message);
      throw e;
    }
  }

  private preview(b: Backup): BackupPreview {
    return {
      exportedAt: b.exportedAt,
      attempts: b.data.attempts.length,
      problems: new Set(b.data.attempts.map((a) => a.problemId)).size,
      restDays: b.data.restDays.length,
    };
  }

  previewBackup({ text }: ParsedRequest<'backup/preview'>) {
    return this.exclusive(async () => this.preview(this.parse(text)));
  }

  importBackup({ text }: ParsedRequest<'backup/import'>) {
    return this.exclusive(async () => {
      const backup = this.parse(text);
      await this.repos.saveSafetyCopy('Before import');
      await this.repos.replaceData(backup.data);
      return this.preview(backup);
    });
  }

  safetyCopy() {
    return this.exclusive(async () => {
      const copy = await this.repos.getSafetyCopy();
      if (!copy) return null;
      return this.backupFile(
        createBackup(copy.data, new Date(copy.savedAt)),
        'interview-prep-safety-copy',
      );
    });
  }

  resetAll() {
    return this.exclusive(async () => {
      await this.repos.saveSafetyCopy('Before reset');
      await this.repos.wipe();
      return null;
    });
  }

  integrity() {
    return this.exclusive(async () => ({ entries: await this.repos.quarantine.list() }));
  }

  clearIntegrity() {
    return this.exclusive(async () => {
      await this.repos.quarantine.clear();
      return null;
    });
  }

  /* ---------------- background jobs ---------------- */

  housekeeping() {
    return this.exclusive(async () => {
      await this.syncSnapshots(await this.load());
    });
  }

  /** What the daily reminder should say, or null when there's nothing to remind about. */
  reminder() {
    return this.exclusive(async () => {
      const ctx = await this.load();
      const view = this.todayView(ctx);
      if (view.isRest || view.result.goalMet) return null;
      const remaining = Math.max(1, view.goal - view.result.problemsDone);
      return { remaining, streak: view.streak.current };
    });
  }

  async reminderSettings() {
    return (await this.repos.settings.get()).reminder;
  }
}
