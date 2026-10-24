import { beforeEach, describe, expect, it } from 'vitest';
import { getCatalog } from '@/core/catalog';
import { DEFAULT_SETTINGS } from '@/core/model/settings';
import { fsrsScheduler } from '@/core/srs/fsrs-scheduler';
import { MemoryDriver } from '@/data/driver';
import { KEYS, LocalRepositories } from '@/data/local-repositories';
import { AppError, RequestSchemas, type ParsedRequest } from '@/shared/messaging/contract';
import { createHandlers, dispatch } from './router';
import { TrackerService, cleanTitle } from './tracker-service';

class FakeClock {
  constructor(public t: Date) {}
  now = () => new Date(this.t);
  set(y: number, mo: number, d: number, h = 12, mi = 0) {
    this.t = new Date(y, mo - 1, d, h, mi);
  }
  advance(ms: number) {
    this.t = new Date(this.t.getTime() + ms);
  }
}

let uuidSeq = 0;
const uuid = () => `00000000-0000-4000-8000-${String(++uuidSeq).padStart(12, '0')}`;

const catalog = getCatalog();
const nc150 = catalog.list('neetcode150');
const CONTAINS_DUPLICATE = 'contains-duplicate';

let clock: FakeClock;
let driver: MemoryDriver;
let repos: LocalRepositories;
let service: TrackerService;

function record(
  problemId: string,
  outcome: ParsedRequest<'attempt/record'>['outcome'] = 'solved',
  extra: Partial<ParsedRequest<'attempt/record'>> = {},
) {
  return service.recordAttempt({
    id: uuid(),
    problemId,
    site: 'neetcode',
    outcome,
    patterns: [],
    notes: '',
    ...extra,
  });
}

beforeEach(() => {
  clock = new FakeClock(new Date(2026, 0, 5, 12)); // Monday
  driver = new MemoryDriver();
  repos = new LocalRepositories(driver, clock.now);
  service = new TrackerService(repos, catalog, fsrsScheduler, clock);
});

describe('widget state', () => {
  it('resolves a NeetCode slug to the catalog problem', async () => {
    const s = await service.widgetState({ site: 'neetcode', slug: 'duplicate-integer' });
    expect(s.problem).toMatchObject({
      id: CONTAINS_DUPLICATE,
      title: 'Contains Duplicate',
      unlisted: false,
    });
    expect(s.planRole).toBe('new');
    expect(s.defaultPatterns).toEqual(['Arrays & Hashing']);
  });

  it('treats unknown problems as unlisted', async () => {
    const s = await service.widgetState({
      site: 'leetcode',
      slug: 'some-new-problem',
      title: 'Some New Problem - LeetCode',
    });
    expect(s.problem).toMatchObject({
      id: 'some-new-problem',
      title: 'Some New Problem',
      unlisted: true,
    });
  });
});

describe('recording attempts', () => {
  it('records the timer duration and stops the timer', async () => {
    await service.timerStart({ problemId: CONTAINS_DUPLICATE });
    clock.advance(5 * 60_000);
    const { attempt } = await record(CONTAINS_DUPLICATE, 'easy');
    expect(attempt.durationSec).toBe(300);
    expect(attempt.isReview).toBe(false);
    expect(await repos.timers.get(CONTAINS_DUPLICATE)).toBeUndefined();
  });

  it('records "not timed" when the timer was never started', async () => {
    const { attempt } = await record(CONTAINS_DUPLICATE);
    expect(attempt.durationSec).toBeNull();
  });

  it('counts paused time only', async () => {
    await service.timerStart({ problemId: CONTAINS_DUPLICATE });
    clock.advance(60_000);
    await service.timerPause({ problemId: CONTAINS_DUPLICATE });
    clock.advance(60 * 60_000);
    await service.timerStart({ problemId: CONTAINS_DUPLICATE });
    clock.advance(30_000);
    expect((await record(CONTAINS_DUPLICATE)).attempt.durationSec).toBe(90);
  });

  it('is idempotent for the same request id (double clicks)', async () => {
    const id = uuid();
    const req = {
      id,
      problemId: CONTAINS_DUPLICATE,
      site: 'neetcode' as const,
      outcome: 'solved' as const,
      patterns: [],
      notes: '',
    };
    await Promise.all([service.recordAttempt(req), service.recordAttempt(req)]);
    expect(await repos.attempts.all()).toHaveLength(1);
  });

  it('asks before saving a timer that ran for hours', async () => {
    await service.timerStart({ problemId: CONTAINS_DUPLICATE });
    clock.advance(7 * 3600_000);
    await expect(record(CONTAINS_DUPLICATE)).rejects.toMatchObject({
      code: 'stale-timer',
      extra: { elapsedSec: 7 * 3600 },
    });
    const kept = await record(CONTAINS_DUPLICATE, 'solved', { timeChoice: 'discard' });
    expect(kept.attempt.durationSec).toBeNull();
  });

  it('marks later attempts as reviews and schedules them', async () => {
    await record(CONTAINS_DUPLICATE, 'failed');
    clock.set(2026, 1, 6);
    const today = await service.today();
    expect(today.items[0]).toMatchObject({ problemId: CONTAINS_DUPLICATE, kind: 'review' });
    const { attempt } = await record(CONTAINS_DUPLICATE, 'solved');
    expect(attempt.isReview).toBe(true);
  });

  it('assigns attempts before 2 AM to the previous day', async () => {
    clock.set(2026, 1, 6, 1, 30);
    expect((await record(CONTAINS_DUPLICATE)).attempt.logicalDay).toBe('2026-01-05');
  });

  it('creates an unlisted problem with a cleaned-up title', async () => {
    await record('nc:custom-problem', 'solved', { title: 'Custom Problem | NeetCode' });
    expect((await repos.unlisted.get('nc:custom-problem'))?.title).toBe('Custom Problem');
  });

  it('dedupes patterns and strips control characters from notes', async () => {
    const { attempt } = await record(CONTAINS_DUPLICATE, 'solved', {
      patterns: ['Arrays & Hashing', 'Arrays & Hashing', 'Sorting'],
      notes: 'use a set\u0000  ',
    });
    expect(attempt.patterns).toEqual(['Arrays & Hashing', 'Sorting']);
    expect(attempt.notes).toBe('use a set');
  });
});

describe('undo', () => {
  it('removes the attempt and restores the timer', async () => {
    await service.timerStart({ problemId: CONTAINS_DUPLICATE });
    clock.advance(120_000);
    const { attempt } = await record(CONTAINS_DUPLICATE);
    const { timer } = await service.undoAttempt({ id: attempt.id });
    expect(timer).toMatchObject({ status: 'paused', accumulatedMs: 120_000 });
    expect(await repos.attempts.all()).toHaveLength(0);
  });

  it('refuses to undo old attempts', async () => {
    const { attempt } = await record(CONTAINS_DUPLICATE);
    clock.advance(10 * 60_000);
    await expect(service.undoAttempt({ id: attempt.id })).rejects.toMatchObject({
      code: 'conflict',
    });
  });
});

describe('today and streaks', () => {
  it('plans the first problems of the active list on day one', async () => {
    const t = await service.today();
    expect(t.items.map((i) => i.problemId)).toEqual(nc150.slice(0, 3).map((p) => p.id));
    expect(t.result.goalMet).toBe(false);
  });

  it('meets the goal and starts a streak', async () => {
    for (const p of nc150.slice(0, 3)) await record(p.id);
    const t = await service.today();
    expect(t.result.goalMet).toBe(true);
    expect(t.streak.current).toBe(1);
  });

  it('counts a failed attempt toward the goal', async () => {
    await record(nc150[0]!.id, 'failed');
    await record(nc150[1]!.id, 'solved');
    await record(nc150[2]!.id, 'failed');
    expect((await service.today()).result.goalMet).toBe(true);
  });

  it("doesn't rewrite past days when the goal changes", async () => {
    for (const p of nc150.slice(0, 3)) await record(p.id);
    clock.set(2026, 1, 6);
    await service.saveSettings({ settings: { ...DEFAULT_SETTINGS, dailyGoal: 10 } });
    const t = await service.today();
    expect(t.goal).toBe(10);
    expect(t.streak.current).toBe(1); // Jan 5 still met its goal of 3
  });

  it('a rest day yesterday keeps the streak alive', async () => {
    for (const p of nc150.slice(0, 3)) await record(p.id);
    clock.set(2026, 1, 7);
    expect((await service.today()).streak.current).toBe(0); // Jan 6 missed
    await service.addRestDay({ day: '2026-01-06' });
    expect((await service.today()).streak.current).toBe(1);
  });

  it('gives an empty plan on weekly rest days', async () => {
    await service.saveSettings({ settings: { ...DEFAULT_SETTINGS, restWeekdays: [1] } }); // Mondays
    const t = await service.today();
    expect(t.isRest).toBe(true);
    expect(t.items).toEqual([]);
  });
});

describe('rest days', () => {
  it('enforces the monthly budget', async () => {
    await service.saveSettings({ settings: { ...DEFAULT_SETTINGS, adHocRestBudgetPerMonth: 1 } });
    await service.addRestDay({ day: '2026-01-10' });
    await expect(service.addRestDay({ day: '2026-01-11' })).rejects.toMatchObject({
      code: 'rest-day',
      extra: { restDayError: 'budget-exceeded' },
    });
  });

  it('rejects a rest day on a day with practice', async () => {
    await record(CONTAINS_DUPLICATE);
    await expect(service.addRestDay({ day: '2026-01-05' })).rejects.toMatchObject({
      code: 'rest-day',
    });
  });
});

describe('settings', () => {
  it('returns field errors for invalid values', async () => {
    const err = await service
      .saveSettings({
        settings: { ...DEFAULT_SETTINGS, adHocRestBudgetPerMonth: 60, dailyGoal: 0 },
      })
      .catch((e: AppError) => e);
    expect(err).toBeInstanceOf(AppError);
    expect((err as AppError).extra.fields).toMatchObject({
      adHocRestBudgetPerMonth: 'Extra rest days can be at most 8 per month',
      dailyGoal: 'Daily goal must be at least 1',
    });
    expect(await service.getSettings()).toEqual(DEFAULT_SETTINGS);
  });
});

describe('backup', () => {
  it('round-trips through export and import, keeping a safety copy', async () => {
    await record(CONTAINS_DUPLICATE);
    const { text } = await service.exportBackup();
    await service.resetAll();
    expect(await repos.attempts.all()).toHaveLength(0);
    expect(await service.safetyCopy()).not.toBeNull();

    const preview = await service.previewBackup({ text });
    expect(preview).toMatchObject({ attempts: 1, problems: 1 });
    await service.importBackup({ text });
    expect(await repos.attempts.all()).toHaveLength(1);
  });

  it.each([
    ['not json', "That file isn't valid JSON."],
    ['{"hello":1}', "That file isn't an Interview Prep backup."],
  ])('rejects %s', async (text, message) => {
    await expect(service.previewBackup({ text })).rejects.toMatchObject({
      code: 'backup',
      message,
    });
  });

  it('rejects backups from a newer version', async () => {
    const text = JSON.stringify({
      format: 'interview-prep-backup',
      schemaVersion: 99,
      exportedAt: new Date().toISOString(),
      data: {},
    });
    await expect(service.previewBackup({ text })).rejects.toMatchObject({ code: 'backup' });
  });

  it('rejects backups with invalid settings', async () => {
    const { text } = await service.exportBackup();
    const tampered = JSON.parse(text);
    tampered.data.settings.adHocRestBudgetPerMonth = 60;
    await expect(service.importBackup({ text: JSON.stringify(tampered) })).rejects.toMatchObject({
      code: 'backup',
    });
  });
});

describe('data integrity', () => {
  it('quarantines invalid records instead of deleting them', async () => {
    await record(CONTAINS_DUPLICATE);
    const { attempts } = await driver.get([KEYS.attempts]);
    await driver.setRaw(KEYS.attempts, {
      ...(attempts as object),
      broken: { id: 'broken', outcome: 'maybe' },
    });
    expect(await repos.attempts.all()).toHaveLength(1);
    const { entries } = await service.integrity();
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({ collection: 'attempts', raw: { id: 'broken' } });
  });

  it('falls back to default settings if stored settings are corrupt', async () => {
    await repos.settings.get(); // initialize meta
    await driver.setRaw(KEYS.settings, { dailyGoal: 'lots' });
    expect(await service.getSettings()).toEqual(DEFAULT_SETTINGS);
    expect((await service.integrity()).entries[0]).toMatchObject({ collection: 'settings' });
  });
});

describe('router', () => {
  const deps = () => ({
    service,
    openDashboard: async () => undefined,
    onSettingsChanged: async () => undefined,
    onDataChanged: async () => undefined,
  });

  it('rejects messages from other extensions', async () => {
    const res = await dispatch(
      createHandlers(deps()),
      { channel: 'interview-prep', type: 'today/get', payload: {} },
      { id: 'evil' },
      'me',
    );
    expect(res).toMatchObject({ ok: false, error: { code: 'validation' } });
  });

  it('rejects unknown and malformed requests', async () => {
    const h = createHandlers(deps());
    expect(
      await dispatch(
        h,
        { channel: 'interview-prep', type: 'toString', payload: {} },
        { id: 'me' },
        'me',
      ),
    ).toMatchObject({ ok: false });
    expect(
      await dispatch(
        h,
        { channel: 'interview-prep', type: 'attempt/record', payload: { id: 'x' } },
        { id: 'me' },
        'me',
      ),
    ).toMatchObject({ ok: false, error: { code: 'validation' } });
    expect(
      await dispatch(
        h,
        { channel: 'interview-prep', type: 'today/get', payload: { extra: 1 } },
        { id: 'me' },
        'me',
      ),
    ).toMatchObject({ ok: false });
  });

  it('dispatches valid requests', async () => {
    const res = await dispatch(
      createHandlers(deps()),
      { channel: 'interview-prep', type: 'today/get', payload: {} },
      { id: 'me' },
      'me',
    );
    expect(res.ok).toBe(true);
  });

  it('has a schema for every handler', () => {
    expect(Object.keys(createHandlers(deps())).sort()).toEqual(Object.keys(RequestSchemas).sort());
  });
});

describe('cleanTitle', () => {
  it.each([
    ['Two Sum - LeetCode', 'two-sum', 'Two Sum'],
    ['  Valid\n Anagram | NeetCode  ', 'valid-anagram', 'Valid Anagram'],
    ['', 'group-anagrams', 'Group Anagrams'],
    [undefined, 'top-k', 'Top K'],
  ])('%j → %s', (raw, slug, expected) => {
    expect(cleanTitle(raw, slug)).toBe(expected);
  });
});
