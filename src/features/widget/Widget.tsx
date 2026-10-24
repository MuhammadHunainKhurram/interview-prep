import { useCallback, useEffect, useRef, useState } from 'react';
import type { ProblemLocation } from '@/core/catalog/url';
import { ALL_PATTERNS } from '@/core/model/patterns';
import {
  LIMITS_RECORDS,
  OUTCOME_LABELS,
  OUTCOMES,
  timerElapsedMs,
  type Outcome,
} from '@/core/model/records';
import { errorMessage, send } from '@/shared/messaging/client';
import { AppError, type WidgetState } from '@/shared/messaging/contract';
import { Badge, Button, DifficultyBadge, OutcomeBadge, OutcomeIcon } from '@/shared/ui/components';
import { cx, OUTCOME_TONE } from '@/shared/ui/tones';
import { formatClock, formatDuration, plural, relativeDay } from '@/shared/ui/format';
import { onStorageChange, useNow, useTheme } from '@/shared/ui/hooks';
import { IconChevronDown, IconPause, IconPlay, IconReset, IconX } from '@/shared/ui/icons';

const UNDO_MS = 5000;

interface Saved {
  id: string;
  outcome: Outcome;
}

interface StalePrompt {
  id: string;
  outcome: Outcome;
  elapsedSec: number;
}

export function Widget({
  location,
  openSignal,
  host,
  defaultOpen,
  onOpenChange,
}: {
  location: ProblemLocation;
  openSignal: number;
  host: HTMLElement;
  /** Keeps the panel open when navigating between problems. */
  defaultOpen: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const [state, setState] = useState<WidgetState>();
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  /** Null until edited: the problem's default patterns are used. */
  const [edited, setEdited] = useState<string[] | null>(null);
  const [notes, setNotes] = useState('');
  const [showNotes, setShowNotes] = useState(false);
  const [saved, setSaved] = useState<Saved | null>(null);
  const [stale, setStale] = useState<StalePrompt | null>(null);
  const firstOutcomeRef = useRef<HTMLButtonElement>(null);
  const problemId = state?.problem.id;
  const patterns = edited ?? state?.defaultPatterns ?? [];
  const setPatterns = setEdited;

  // Keyboard shortcut from the background: open (adjusting state during render).
  const [seenSignal, setSeenSignal] = useState(openSignal);
  if (openSignal !== seenSignal) {
    setSeenSignal(openSignal);
    setOpen(true);
  }
  useEffect(() => {
    if (openSignal > 0) requestAnimationFrame(() => firstOutcomeRef.current?.focus());
  }, [openSignal]);
  useEffect(() => onOpenChange(open), [open, onOpenChange]);

  useTheme(state?.theme, host);

  const load = useCallback(() => {
    send('widget/state', {
      site: location.site,
      slug: location.slug,
      title: document.title.slice(0, 300),
    })
      .then((s) => {
        setState(s);
        setError(null);
      })
      .catch((e: unknown) => setError(errorMessage(e)));
  }, [location.site, location.slug]);

  useEffect(() => {
    load();
    return onStorageChange(load);
  }, [load]);

  useEffect(() => {
    if (!saved) return;
    const t = setTimeout(() => setSaved(null), UNDO_MS);
    return () => clearTimeout(t);
  }, [saved]);

  const timer = state?.timer ?? null;
  const now = useNow(1000, timer?.status === 'running');
  const elapsedSec = timer ? Math.floor(timerElapsedMs(timer, now) / 1000) : 0;

  async function run<T>(fn: () => Promise<T>): Promise<T | undefined> {
    setError(null);
    try {
      return await fn();
    } catch (e) {
      setError(errorMessage(e));
      return undefined;
    }
  }

  async function timerAction(kind: 'timer/start' | 'timer/pause' | 'timer/reset') {
    if (!problemId) return;
    await run(() => send(kind, { problemId }));
    load();
  }

  async function record(
    outcome: Outcome,
    id: string = crypto.randomUUID(),
    timeChoice?: 'keep' | 'discard',
  ) {
    if (!state || saving) return;
    setSaving(true);
    setError(null);
    try {
      await send('attempt/record', {
        id,
        problemId: state.problem.id,
        site: location.site,
        outcome,
        patterns,
        notes,
        title: document.title.slice(0, 300),
        ...(timeChoice && { timeChoice }),
      });
      setStale(null);
      setSaved({ id, outcome });
      setNotes('');
      setShowNotes(false);
      setEdited(null);
      load();
    } catch (e) {
      if (e instanceof AppError && e.code === 'stale-timer' && e.extra.elapsedSec !== undefined)
        setStale({ id, outcome, elapsedSec: e.extra.elapsedSec });
      else setError(errorMessage(e));
    } finally {
      setSaving(false);
    }
  }

  async function undo() {
    if (!saved) return;
    const id = saved.id;
    setSaved(null);
    await run(() => send('attempt/undo', { id }));
    load();
  }

  const pillLabel = timer
    ? formatClock(elapsedSec)
    : state?.doneToday
      ? 'Done today'
      : state?.planRole === 'review'
        ? 'Review'
        : state?.planRole === 'new'
          ? 'New'
          : 'Track';

  return (
    <div className="ip-root">
      <div
        className="fixed right-4 top-[72px] flex flex-col items-end gap-2"
        style={{ zIndex: 2147483647 }}
        onKeyDown={(e) => e.key === 'Escape' && setOpen(false)}
      >
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          aria-label={`Interview Prep: ${pillLabel}`}
          className="flex items-center gap-2 rounded-full border-2 border-b-4 border-border bg-surface px-3 py-1.5 text-sm font-extrabold text-text shadow-lg active:translate-y-[2px] active:border-b-2"
        >
          <span
            aria-hidden="true"
            className={cx(
              'size-2.5 rounded-full',
              timer?.status === 'running'
                ? 'animate-pulse bg-blue'
                : state?.doneToday
                  ? 'bg-green'
                  : state?.planRole
                    ? 'bg-yellow'
                    : 'bg-faint',
            )}
          />
          <span className="tabular-nums">{pillLabel}</span>
          <IconChevronDown size={14} className={cx('transition-transform', open && 'rotate-180')} />
        </button>

        {open && (
          <div
            role="dialog"
            aria-label="Track this problem"
            className="flex max-h-[calc(100vh-130px)] w-[320px] flex-col gap-4 overflow-y-auto rounded-2xl border-2 border-border bg-surface p-4 text-text shadow-2xl"
          >
            {!state && !error && <p className="text-muted">Loading…</p>}
            {state && (
              <>
                <header className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h2 className="truncate text-base font-extrabold" title={state.problem.title}>
                      {state.problem.title}
                    </h2>
                    <div className="mt-1 flex flex-wrap gap-1">
                      <DifficultyBadge difficulty={state.problem.difficulty} />
                      {state.planRole === 'review' && <Badge tone="blue">Review today</Badge>}
                      {state.planRole === 'new' && <Badge tone="green">New today</Badge>}
                      {state.doneToday && <Badge tone="green">Done today</Badge>}
                      {state.problem.unlisted && <Badge>Unlisted</Badge>}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    aria-label="Close"
                    className="rounded-lg p-1 text-muted hover:bg-surface-2"
                  >
                    <IconX size={16} />
                  </button>
                </header>

                <section
                  aria-label="Timer"
                  className="flex items-center justify-between rounded-xl bg-surface-2 px-3 py-2"
                >
                  <span className="text-2xl font-extrabold tabular-nums" aria-live="off">
                    {formatClock(elapsedSec)}
                  </span>
                  <div className="flex gap-2">
                    {timer?.status === 'running' ? (
                      <Button size="sm" onClick={() => void timerAction('timer/pause')}>
                        <IconPause size={14} /> Pause
                      </Button>
                    ) : (
                      <Button size="sm" tone="blue" onClick={() => void timerAction('timer/start')}>
                        <IconPlay size={14} /> {timer ? 'Resume' : 'Start'}
                      </Button>
                    )}
                    <Button
                      size="sm"
                      onClick={() => void timerAction('timer/reset')}
                      disabled={!timer}
                      aria-label="Reset timer"
                    >
                      <IconReset size={14} />
                    </Button>
                  </div>
                </section>

                <section aria-label="Patterns">
                  <p className="mb-1.5 text-xs font-bold uppercase tracking-wide text-muted">
                    Pattern
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {patterns.map((p) => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => setPatterns(patterns.filter((x) => x !== p))}
                        className="flex items-center gap-1 rounded-lg border border-blue bg-blue-soft px-2 py-0.5 text-xs font-bold"
                        aria-label={`Remove ${p}`}
                      >
                        {p} <IconX size={10} />
                      </button>
                    ))}
                    {patterns.length < LIMITS_RECORDS.maxPatterns && (
                      <select
                        aria-label="Add a pattern"
                        value=""
                        onChange={(e) =>
                          e.target.value && setPatterns([...patterns, e.target.value])
                        }
                        className="rounded-lg border border-border bg-surface px-1.5 py-0.5 text-xs font-bold text-muted"
                      >
                        <option value="">+ Add</option>
                        {ALL_PATTERNS.filter((p) => !patterns.includes(p)).map((p) => (
                          <option key={p} value={p}>
                            {p}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                </section>

                <section aria-label="Notes">
                  {showNotes ? (
                    <>
                      <label
                        htmlFor="ip-notes"
                        className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-muted"
                      >
                        Notes
                      </label>
                      <textarea
                        id="ip-notes"
                        value={notes}
                        maxLength={LIMITS_RECORDS.notesMaxLength}
                        onChange={(e) => setNotes(e.target.value)}
                        rows={3}
                        placeholder="Key idea, edge cases, complexity…"
                        className="w-full resize-y rounded-xl border-2 border-border bg-surface-2 p-2 text-sm text-text placeholder:text-faint"
                      />
                      {notes.length > LIMITS_RECORDS.notesMaxLength - 500 && (
                        <p className="text-right text-xs text-muted">
                          {notes.length}/{LIMITS_RECORDS.notesMaxLength}
                        </p>
                      )}
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setShowNotes(true)}
                      className="text-xs font-bold text-blue hover:underline"
                    >
                      + Add notes
                    </button>
                  )}
                </section>

                {stale ? (
                  <section
                    role="alertdialog"
                    aria-label="Long timer"
                    className="rounded-xl border-2 border-yellow bg-yellow-soft p-3 text-sm"
                  >
                    <p className="font-bold">
                      The timer ran for {formatDuration(stale.elapsedSec)}. Keep that time?
                    </p>
                    <div className="mt-2 flex gap-2">
                      <Button
                        size="sm"
                        tone="blue"
                        onClick={() => void record(stale.outcome, stale.id, 'keep')}
                      >
                        Keep
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => void record(stale.outcome, stale.id, 'discard')}
                      >
                        Don't save time
                      </Button>
                    </div>
                  </section>
                ) : (
                  <section aria-label="How did it go?">
                    <p className="mb-1.5 text-xs font-bold uppercase tracking-wide text-muted">
                      How did it go?
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      {OUTCOMES.map((o, i) => (
                        <Button
                          key={o}
                          ref={i === 0 ? firstOutcomeRef : undefined}
                          tone={OUTCOME_TONE[o]}
                          size="sm"
                          disabled={saving}
                          onClick={() => void record(o)}
                          caps={false}
                        >
                          <OutcomeIcon outcome={o} size={14} />
                          {OUTCOME_LABELS[o]}
                        </Button>
                      ))}
                    </div>
                  </section>
                )}

                {saved && (
                  <div
                    role="status"
                    className="flex items-center justify-between gap-2 rounded-xl bg-surface-2 px-3 py-2 text-sm"
                  >
                    <span className="flex items-center gap-2 font-bold">
                      Saved <OutcomeBadge outcome={saved.outcome} />
                    </span>
                    <button
                      type="button"
                      onClick={() => void undo()}
                      className="font-extrabold text-blue hover:underline"
                    >
                      Undo
                    </button>
                  </div>
                )}

                {state.status && (
                  <dl className="grid grid-cols-3 gap-2 border-t-2 border-border pt-3 text-xs">
                    <div>
                      <dt className="text-muted">Last solved</dt>
                      <dd className="font-bold">
                        {state.status.lastSolvedAt
                          ? relativeDay(state.status.lastSolvedAt.slice(0, 10), state.today)
                          : 'Not yet'}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-muted">Attempts</dt>
                      <dd className="font-bold">{state.status.attemptCount}</dd>
                    </div>
                    <div>
                      <dt className="text-muted">Next review</dt>
                      <dd className="font-bold">
                        {relativeDay(state.status.nextReviewDay, state.today)}
                      </dd>
                    </div>
                  </dl>
                )}

                {state.history.some((a) => a.notes) && (
                  <details className="text-xs">
                    <summary className="cursor-pointer font-bold text-muted">Past notes</summary>
                    <ul className="mt-2 flex flex-col gap-2">
                      {state.history
                        .filter((a) => a.notes)
                        .map((a) => (
                          <li key={a.id} className="rounded-lg bg-surface-2 p-2">
                            <p className="mb-1 text-muted">
                              {relativeDay(a.logicalDay, state.today)} · {OUTCOME_LABELS[a.outcome]}
                              {a.patterns.length > 0 && ` · ${a.patterns.join(', ')}`}
                            </p>
                            <p className="whitespace-pre-wrap break-words">{a.notes}</p>
                          </li>
                        ))}
                    </ul>
                  </details>
                )}

                {state.history.length > 0 && (
                  <p className="text-xs text-muted">
                    {plural(state.history.length, 'recent attempt')} · open the dashboard for full
                    history
                  </p>
                )}
              </>
            )}
            {error && (
              <p
                role="alert"
                className="rounded-xl border-2 border-red bg-red-soft p-2 text-sm font-semibold"
              >
                {error}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
