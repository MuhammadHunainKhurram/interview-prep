import { useEffect, useRef, useState } from 'react';
import { ALL_PATTERNS } from '@/core/model/patterns';
import { LIMITS_RECORDS, OUTCOME_LABELS, OUTCOMES, type Outcome } from '@/core/model/records';
import { errorMessage, send } from '@/shared/messaging/client';
import type { AttemptView } from '@/shared/messaging/contract';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorNote,
  OutcomeBadge,
  Spinner,
} from '@/shared/ui/components';
import { formatDateTime, formatDuration } from '@/shared/ui/format';
import { useRequest } from '@/shared/ui/hooks';
import { IconEdit, IconTrash } from '@/shared/ui/icons';

const PAGE = 50;

export function HistoryPage() {
  const [limit, setLimit] = useState(PAGE);
  const { data, error, reload } = useRequest('history/get', { limit, offset: 0 });
  const [editing, setEditing] = useState<AttemptView | null>(null);
  const [deleting, setDeleting] = useState<AttemptView | null>(null);

  if (error) return <ErrorNote message={error} onRetry={reload} />;
  if (!data) return <Spinner />;
  if (data.total === 0)
    return (
      <EmptyState title="No attempts yet.">
        Open a problem on NeetCode or LeetCode and use the tracker in the top-right corner.
      </EmptyState>
    );

  return (
    <Card>
      <ul>
        {data.attempts.map((a) => (
          <li
            key={a.id}
            className="flex flex-wrap items-start gap-3 border-b-2 border-border py-3 last:border-b-0"
          >
            <div className="min-w-0 flex-1">
              <p className="font-bold">{a.problemTitle}</p>
              <p className="mt-1 flex flex-wrap items-center gap-1 text-xs text-muted">
                <OutcomeBadge outcome={a.outcome} />
                <Badge>{a.isReview ? 'Review' : 'First attempt'}</Badge>
                <span>{formatDateTime(a.completedAt)}</span>
                <span>· {formatDuration(a.durationSec)}</span>
                <span>· {a.site === 'neetcode' ? 'NeetCode' : 'LeetCode'}</span>
                {a.outcome === 'failed' && <span>· Attempted, not solved</span>}
              </p>
              {a.patterns.length > 0 && (
                <p className="mt-1 text-xs font-semibold">{a.patterns.join(' · ')}</p>
              )}
              {a.notes && (
                <p className="mt-1 whitespace-pre-wrap break-words text-sm text-muted">{a.notes}</p>
              )}
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={() => setEditing(a)}
                aria-label={`Edit attempt on ${a.problemTitle}`}
              >
                <IconEdit size={14} />
              </Button>
              <Button
                size="sm"
                onClick={() => setDeleting(a)}
                aria-label={`Delete attempt on ${a.problemTitle}`}
              >
                <IconTrash size={14} />
              </Button>
            </div>
          </li>
        ))}
      </ul>
      {data.total > data.attempts.length && (
        <div className="mt-4 text-center">
          <Button onClick={() => setLimit((l) => Math.min(500, l + PAGE))} disabled={limit >= 500}>
            Show more ({data.total - data.attempts.length} left)
          </Button>
        </div>
      )}
      {editing && <EditDialog attempt={editing} onClose={() => setEditing(null)} />}
      {deleting && <DeleteDialog attempt={deleting} onClose={() => setDeleting(null)} />}
    </Card>
  );
}

function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    ref.current?.showModal();
  }, []);
  return (
    <dialog
      ref={ref}
      onClose={onClose}
      aria-label={title}
      className="m-auto w-[min(520px,calc(100vw-32px))] rounded-2xl border-2 border-border bg-surface p-5 text-text backdrop:bg-black/60"
    >
      <h2 className="mb-4 text-lg font-extrabold">{title}</h2>
      {children}
    </dialog>
  );
}

function EditDialog({ attempt, onClose }: { attempt: AttemptView; onClose: () => void }) {
  const [outcome, setOutcome] = useState<Outcome>(attempt.outcome);
  const [patterns, setPatterns] = useState(attempt.patterns);
  const [notes, setNotes] = useState(attempt.notes);
  const [minutes, setMinutes] = useState(
    attempt.durationSec === null ? '' : String(Math.round(attempt.durationSec / 60)),
  );
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const minutesNum = minutes.trim() === '' ? null : Number(minutes);
  const maxMinutes = LIMITS_RECORDS.maxDurationSec / 60;
  const minutesError =
    minutesNum !== null &&
    (!Number.isInteger(minutesNum) || minutesNum < 0 || minutesNum > maxMinutes)
      ? `Enter whole minutes between 0 and ${maxMinutes}, or leave empty for "not timed".`
      : null;

  const save = async () => {
    setSaving(true);
    try {
      await send('attempt/update', {
        id: attempt.id,
        outcome,
        patterns,
        notes,
        durationSec: minutesNum === null ? null : minutesNum * 60,
      });
      onClose();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title={`Edit attempt · ${attempt.problemTitle}`} onClose={onClose}>
      <div className="flex flex-col gap-4">
        <fieldset>
          <legend className="mb-1.5 text-xs font-bold uppercase tracking-wide text-muted">
            Outcome
          </legend>
          <div className="grid grid-cols-2 gap-2">
            {OUTCOMES.map((o) => (
              <label
                key={o}
                className="flex cursor-pointer items-center gap-2 rounded-xl border-2 border-border p-2 text-sm font-bold has-[:checked]:border-blue has-[:checked]:bg-blue-soft"
              >
                <input
                  type="radio"
                  name="outcome"
                  checked={outcome === o}
                  onChange={() => setOutcome(o)}
                />
                {OUTCOME_LABELS[o]}
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset>
          <legend className="mb-1.5 text-xs font-bold uppercase tracking-wide text-muted">
            Patterns (up to {LIMITS_RECORDS.maxPatterns})
          </legend>
          <select
            multiple
            value={patterns}
            onChange={(e) =>
              setPatterns(
                [...e.target.selectedOptions]
                  .map((o) => o.value)
                  .slice(0, LIMITS_RECORDS.maxPatterns),
              )
            }
            className="h-32 w-full rounded-xl border-2 border-border bg-surface-2 p-1 text-sm"
          >
            {[...new Set([...patterns, ...ALL_PATTERNS])].map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </fieldset>

        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-bold uppercase tracking-wide text-muted">
            Time (minutes)
          </span>
          <input
            inputMode="numeric"
            value={minutes}
            onChange={(e) => setMinutes(e.target.value)}
            aria-invalid={!!minutesError}
            className="rounded-xl border-2 border-border bg-surface-2 px-3 py-2"
          />
          {minutesError && <span className="text-xs font-bold text-red">{minutesError}</span>}
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-bold uppercase tracking-wide text-muted">Notes</span>
          <textarea
            value={notes}
            maxLength={LIMITS_RECORDS.notesMaxLength}
            onChange={(e) => setNotes(e.target.value)}
            rows={4}
            className="rounded-xl border-2 border-border bg-surface-2 p-2"
          />
        </label>

        {error && <ErrorNote message={error} />}
        <div className="flex justify-end gap-2">
          <Button onClick={onClose}>Cancel</Button>
          <Button tone="green" onClick={() => void save()} disabled={saving || !!minutesError}>
            Save
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function DeleteDialog({ attempt, onClose }: { attempt: AttemptView; onClose: () => void }) {
  const [error, setError] = useState<string | null>(null);
  const remove = async () => {
    try {
      await send('attempt/delete', { id: attempt.id });
      onClose();
    } catch (e) {
      setError(errorMessage(e));
    }
  };
  return (
    <Modal title="Delete this attempt?" onClose={onClose}>
      <p className="text-sm text-muted">
        {attempt.problemTitle} · {formatDateTime(attempt.completedAt)}. Its review schedule and your
        streak are recalculated without it. This can't be undone.
      </p>
      {error && <ErrorNote message={error} />}
      <div className="mt-4 flex justify-end gap-2">
        <Button onClick={onClose}>Cancel</Button>
        <Button tone="red" onClick={() => void remove()}>
          Delete
        </Button>
      </div>
    </Modal>
  );
}
