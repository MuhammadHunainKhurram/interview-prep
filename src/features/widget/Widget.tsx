import { useCallback, useEffect, useRef, useState } from 'react';
import type { ProblemLocation } from '@/core/catalog/url';
import {
  LIMITS_RECORDS,
  OUTCOME_LABELS,
  OUTCOMES,
  timerElapsedMs,
  type Outcome,
} from '@/core/model/records';
import { errorMessage, send } from '@/shared/messaging/client';
import type { ToolbarPosition } from '@/core/model/records';
import { AppError, type WidgetState } from '@/shared/messaging/contract';
import { Badge, Button, DifficultyBadge, OutcomeBadge, OutcomeIcon } from '@/shared/ui/components';
import { formatClock, formatDuration, relativeDay } from '@/shared/ui/format';
import { onStorageChange, useNow, useTheme } from '@/shared/ui/hooks';
import { PatternPicker } from '@/shared/ui/PatternPicker';
import {
  IconChevronDown,
  IconChevronUp,
  IconGrip,
  IconPause,
  IconPlay,
  IconReset,
  IconX,
} from '@/shared/ui/icons';
import { cx } from '@/shared/ui/tones';

const UNDO_MS = 5000;
const Z_TOP = 2147483647;
const DEFAULT_POSITION: ToolbarPosition = { right: 16, top: 72 };
const EDGE = 8;
const PANEL_WIDTH = 320;
const KEY_STEP = 16;

/** Keeps the toolbar fully on screen. */
function clampPosition(
  p: ToolbarPosition,
  size: { w: number; h: number },
  viewport: { w: number; h: number },
): ToolbarPosition {
  const maxRight = Math.max(EDGE, viewport.w - size.w - EDGE);
  const maxTop = Math.max(EDGE, viewport.h - size.h - EDGE);
  return {
    right: Math.round(Math.min(Math.max(p.right, EDGE), maxRight)),
    top: Math.round(Math.min(Math.max(p.top, EDGE), maxTop)),
  };
}

function useViewport() {
  const [vp, setVp] = useState(() => ({ w: window.innerWidth, h: window.innerHeight }));
  useEffect(() => {
    const onResize = () => setVp({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  return vp;
}

interface Saved {
  id: string;
  outcome: Outcome;
}

interface StalePrompt {
  id: string;
  outcome: Outcome;
  elapsedSec: number;
}

const SQUARE_TONE: Record<Outcome, string> = {
  easy: 'bg-blue border-blue-shade',
  solved: 'bg-green border-green-shade',
  hints: 'bg-yellow border-yellow-shade',
  failed: 'bg-red border-red-shade',
};

/**
 * On-page tracker. Two pieces:
 * - top right: the four outcome buttons, always visible, plus a toggle for details
 *   (patterns, notes, history)
 * - bottom left: the timer
 */
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
  /** Keeps the details panel open when navigating between problems. */
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
  const [saved, setSaved] = useState<Saved | null>(null);
  const [stale, setStale] = useState<StalePrompt | null>(null);
  const firstOutcomeRef = useRef<HTMLButtonElement>(null);
  const groupRef = useRef<HTMLDivElement>(null);
  const toolbarRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ x: number; y: number; from: ToolbarPosition; moved: boolean } | null>(
    null,
  );
  /** Position while dragging or after a move, before storage catches up. */
  const [dragPos, setDragPos] = useState<ToolbarPosition | null>(null);
  const [toolbarSize, setToolbarSize] = useState({ w: 236, h: 50 });
  const viewport = useViewport();
  const problemId = state?.problem.id;
  const patterns = edited ?? state?.defaultPatterns ?? [];
  const setPatterns = setEdited;

  // Keyboard shortcut from the background focuses the outcome buttons.
  useEffect(() => {
    if (openSignal > 0) requestAnimationFrame(() => firstOutcomeRef.current?.focus());
  }, [openSignal]);
  useEffect(() => onOpenChange(open), [open, onOpenChange]);

  useTheme(state?.theme, state?.accent, host);

  useEffect(() => {
    const el = toolbarRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setToolbarSize({ w: el.offsetWidth, h: el.offsetHeight }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Close the details panel on a click anywhere outside the toolbar and panel.
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      const group = groupRef.current;
      if (group && !e.composedPath().includes(group)) setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown, true);
    return () => document.removeEventListener('pointerdown', onPointerDown, true);
  }, [open]);

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
    setSaved(null);
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

  const running = timer?.status === 'running';

  const position = clampPosition(
    dragPos ?? state?.toolbarPosition ?? DEFAULT_POSITION,
    toolbarSize,
    viewport,
  );
  // Open the panel upward when the toolbar sits in the lower half of the screen,
  // and align it to the toolbar's left edge when there's no room to the left.
  const openUp = position.top + toolbarSize.h / 2 > viewport.h / 2;
  const toolbarRightX = viewport.w - position.right;
  const alignLeft = toolbarRightX - PANEL_WIDTH < EDGE;
  const panelMaxHeight = Math.max(
    160,
    openUp ? position.top - 24 : viewport.h - position.top - toolbarSize.h - 24,
  );

  function savePosition(p: ToolbarPosition | null) {
    void send('widget/position', { position: p }).catch((e: unknown) => setError(errorMessage(e)));
  }

  function moveTo(p: ToolbarPosition) {
    const next = clampPosition(p, toolbarSize, viewport);
    setDragPos(next);
    return next;
  }

  return (
    <div className="ip-root">
      {/* Top right: outcomes */}
      <div
        ref={groupRef}
        className={cx(
          'fixed flex gap-2',
          openUp ? 'flex-col-reverse' : 'flex-col',
          alignLeft ? 'items-start' : 'items-end',
        )}
        style={{
          zIndex: Z_TOP,
          right: alignLeft ? undefined : position.right,
          left: alignLeft ? toolbarRightX - toolbarSize.w : undefined,
          ...(openUp
            ? { bottom: viewport.h - position.top - toolbarSize.h }
            : { top: position.top }),
        }}
        onKeyDown={(e) => e.key === 'Escape' && setOpen(false)}
      >
        <div
          ref={toolbarRef}
          role="toolbar"
          aria-label="How did it go?"
          className="flex items-center gap-1.5 rounded-2xl border border-border bg-surface p-1.5 text-text shadow-[0_8px_24px_rgb(0_0_0/0.18)]"
        >
          <button
            type="button"
            aria-label="Move toolbar"
            title="Drag to move. Double-click to put it back."
            className="flex h-9 w-5 cursor-grab touch-none items-center justify-center rounded-lg text-faint hover:bg-surface-2 hover:text-muted active:cursor-grabbing"
            onPointerDown={(e) => {
              e.preventDefault();
              e.currentTarget.setPointerCapture(e.pointerId);
              dragRef.current = { x: e.clientX, y: e.clientY, from: position, moved: false };
            }}
            onPointerMove={(e) => {
              const d = dragRef.current;
              if (!d) return;
              const dx = e.clientX - d.x;
              const dy = e.clientY - d.y;
              if (!d.moved && Math.hypot(dx, dy) < 3) return;
              d.moved = true;
              moveTo({ right: d.from.right - dx, top: d.from.top + dy });
            }}
            onPointerUp={(e) => {
              const d = dragRef.current;
              dragRef.current = null;
              if (!d?.moved) return;
              savePosition(
                clampPosition(
                  { right: d.from.right - (e.clientX - d.x), top: d.from.top + (e.clientY - d.y) },
                  toolbarSize,
                  viewport,
                ),
              );
            }}
            onPointerCancel={() => (dragRef.current = null)}
            onDoubleClick={() => {
              setDragPos(DEFAULT_POSITION);
              savePosition(null);
            }}
            onKeyDown={(e) => {
              const delta: Record<string, [number, number]> = {
                ArrowLeft: [KEY_STEP, 0],
                ArrowRight: [-KEY_STEP, 0],
                ArrowUp: [0, -KEY_STEP],
                ArrowDown: [0, KEY_STEP],
              };
              const step = delta[e.key];
              if (!step) return;
              e.preventDefault();
              savePosition(
                moveTo({ right: position.right + step[0], top: position.top + step[1] }),
              );
            }}
          >
            <IconGrip size={16} />
          </button>
          {OUTCOMES.map((o, i) => (
            <button
              key={o}
              ref={i === 0 ? firstOutcomeRef : undefined}
              type="button"
              title={OUTCOME_LABELS[o]}
              aria-label={OUTCOME_LABELS[o]}
              disabled={saving || !state}
              onClick={() => void record(o)}
              className={cx(
                'flex size-9 items-center justify-center rounded-xl border-2 border-b-4 text-on-color transition-[transform,filter] duration-75',
                'hover:brightness-105 active:translate-y-[2px] active:border-b-2 disabled:opacity-50',
                SQUARE_TONE[o],
              )}
            >
              <OutcomeIcon outcome={o} size={18} />
            </button>
          ))}
          <span aria-hidden="true" className="mx-0.5 h-6 w-px bg-border" />
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-label={open ? 'Hide details' : 'Show details'}
            title={open ? 'Hide details' : 'Pattern, notes and history'}
            className="relative flex size-9 items-center justify-center rounded-xl text-muted hover:bg-surface-2 hover:text-text"
          >
            {open ? <IconChevronUp size={18} /> : <IconChevronDown size={18} />}
            {state?.doneToday && (
              <span
                title="Done today"
                className="absolute right-1 top-1 size-2 rounded-full bg-green"
              />
            )}
          </button>
        </div>

        {saved && (
          <div
            role="status"
            className="flex items-center gap-3 rounded-xl border border-border bg-surface px-3 py-2 text-sm font-bold text-text shadow-lg"
          >
            <span className="flex items-center gap-2">
              Saved <OutcomeBadge outcome={saved.outcome} />
            </span>
            <button
              type="button"
              onClick={() => void undo()}
              className="font-extrabold text-accent-text hover:underline"
            >
              Undo
            </button>
          </div>
        )}

        {stale && (
          <div
            role="alertdialog"
            aria-label="Long timer"
            className="w-[320px] rounded-xl border border-yellow bg-surface p-3 text-sm text-text shadow-lg"
          >
            <p className="font-bold">
              The timer ran for {formatDuration(stale.elapsedSec)}. Keep that time?
            </p>
            <div className="mt-2 flex gap-2">
              <Button
                size="sm"
                tone="accent"
                onClick={() => void record(stale.outcome, stale.id, 'keep')}
              >
                Keep time
              </Button>
              <Button size="sm" onClick={() => void record(stale.outcome, stale.id, 'discard')}>
                Save without time
              </Button>
            </div>
          </div>
        )}

        {error && (
          <p
            role="alert"
            className="w-[320px] rounded-xl border border-red bg-surface p-2.5 text-sm font-semibold text-text shadow-lg"
          >
            {error}
          </p>
        )}

        {open && (
          <div
            role="region"
            aria-label="Problem details"
            style={{ maxHeight: panelMaxHeight }}
            className="flex w-[320px] flex-col gap-4 overflow-y-auto rounded-2xl border border-border bg-surface p-4 text-text shadow-[0_8px_24px_rgb(0_0_0/0.18)]"
          >
            {!state && !error && <p className="text-muted">Loading…</p>}
            {state && (
              <>
                <header className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h2 className="truncate text-base font-extrabold" title={state.problem.title}>
                      {state.problem.title}
                    </h2>
                    <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1">
                      <DifficultyBadge difficulty={state.problem.difficulty} />
                      {state.planRole === 'review' && <Badge tone="accent">Review today</Badge>}
                      {state.planRole === 'new' && <Badge>New today</Badge>}
                      {state.doneToday && <Badge tone="green">Done today</Badge>}
                      {state.problem.unlisted && <Badge>Unlisted</Badge>}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    aria-label="Close details"
                    className="rounded-lg p-1 text-muted hover:bg-surface-2"
                  >
                    <IconX size={16} />
                  </button>
                </header>

                <section aria-label="Pattern">
                  <p className="mb-1.5 text-[13px] font-bold text-muted">Pattern</p>
                  <PatternPicker
                    value={patterns}
                    onChange={setPatterns}
                    max={LIMITS_RECORDS.maxPatterns}
                  />
                </section>

                <section aria-label="Notes">
                  <label
                    htmlFor="ip-notes"
                    className="mb-1.5 block text-[13px] font-bold text-muted"
                  >
                    Notes
                  </label>
                  <textarea
                    id="ip-notes"
                    value={notes}
                    maxLength={LIMITS_RECORDS.notesMaxLength}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={3}
                    placeholder="Key idea, edge cases, complexity"
                    className="w-full resize-y rounded-xl border border-border-strong bg-surface-2 p-2 text-sm text-text placeholder:text-faint"
                  />
                  {notes.length > LIMITS_RECORDS.notesMaxLength - 500 && (
                    <p className="text-right text-xs text-muted">
                      {notes.length}/{LIMITS_RECORDS.notesMaxLength}
                    </p>
                  )}
                  <p className="mt-1 text-xs text-muted">
                    Pattern and notes are saved with the outcome you pick above.
                  </p>
                </section>

                {state.status && (
                  <dl className="grid grid-cols-3 gap-2 border-t border-border pt-3 text-xs">
                    <div>
                      <dt className="text-muted">Last solved</dt>
                      <dd className="mt-0.5 font-bold">
                        {state.status.lastSolvedAt
                          ? relativeDay(state.status.lastSolvedAt.slice(0, 10), state.today)
                          : 'Not yet'}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-muted">Attempts</dt>
                      <dd className="mt-0.5 font-bold tabular-nums">{state.status.attemptCount}</dd>
                    </div>
                    <div>
                      <dt className="text-muted">Next review</dt>
                      <dd className="mt-0.5 font-bold">
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
              </>
            )}
          </div>
        )}
      </div>

      {/* Bottom left: timer */}
      {state && (
        <div
          role="region"
          aria-label="Timer"
          className="fixed bottom-4 left-4 flex items-center gap-2 rounded-2xl border border-border bg-surface p-1.5 pl-3.5 text-text shadow-[0_8px_24px_rgb(0_0_0/0.18)]"
          style={{ zIndex: Z_TOP }}
        >
          <span
            aria-hidden="true"
            className={cx('size-2 rounded-full', running ? 'animate-pulse bg-accent' : 'bg-faint')}
          />
          <span className="min-w-[3.5rem] text-lg font-extrabold tabular-nums">
            {formatClock(elapsedSec)}
          </span>
          {running ? (
            <Button size="sm" onClick={() => void timerAction('timer/pause')}>
              <IconPause size={14} /> Pause
            </Button>
          ) : (
            <Button size="sm" tone="accent" onClick={() => void timerAction('timer/start')}>
              <IconPlay size={14} /> {timer ? 'Resume' : 'Start'}
            </Button>
          )}
          <Button
            size="sm"
            onClick={() => void timerAction('timer/reset')}
            disabled={!timer}
            aria-label="Reset timer"
            title="Reset timer"
            square
          >
            <IconReset size={14} />
          </Button>
        </div>
      )}
    </div>
  );
}
