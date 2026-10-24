import { useMemo, useState } from 'react';
import { WEEKDAY_LABELS } from '@/core/calendar/logical-day';
import { LIST_IDS, LIST_LABELS } from '@/core/catalog/schema';
import { LIMITS, SettingsSchema, type Settings } from '@/core/model/settings';
import { errorMessage, send } from '@/shared/messaging/client';
import { AppError } from '@/shared/messaging/contract';
import { Button, Card, CardTitle, ErrorNote, Spinner } from '@/shared/ui/components';
import { cx } from '@/shared/ui/tones';
import { useRequest } from '@/shared/ui/hooks';
import { DataSection } from './DataSection';
import { RestDaysSection } from './RestDaysSection';

/** Form values: numbers are kept as typed text until validation. */
type Draft = Omit<
  Settings,
  'dailyGoal' | 'minReviewsPerDay' | 'reviewCap' | 'adHocRestBudgetPerMonth' | 'maxIntervalDays'
> & {
  dailyGoal: string;
  minReviewsPerDay: string;
  reviewCap: string;
  adHocRestBudgetPerMonth: string;
  maxIntervalDays: string;
};

const NUMBER_FIELDS = [
  'dailyGoal',
  'minReviewsPerDay',
  'reviewCap',
  'adHocRestBudgetPerMonth',
  'maxIntervalDays',
] as const;

function toDraft(s: Settings): Draft {
  return {
    ...s,
    dailyGoal: String(s.dailyGoal),
    minReviewsPerDay: String(s.minReviewsPerDay),
    reviewCap: String(s.reviewCap),
    adHocRestBudgetPerMonth: String(s.adHocRestBudgetPerMonth),
    maxIntervalDays: String(s.maxIntervalDays),
  };
}

/** Empty or non-numeric text becomes NaN, which the schema reports as "must be a number". */
function fromDraft(d: Draft): Record<string, unknown> {
  const out: Record<string, unknown> = { ...d };
  for (const f of NUMBER_FIELDS) out[f] = d[f].trim() === '' ? Number.NaN : Number(d[f]);
  return out;
}

function hourLabel(h: number) {
  return h === 0 ? '12 AM (midnight)' : `${h} AM`;
}

export function SettingsPage() {
  const { data, error, reload } = useRequest('settings/get', {});
  /** Null until edited: the saved settings are shown. */
  const [edits, setDraft] = useState<Draft | null>(null);
  const draft = edits ?? (data ? toDraft(data) : null);
  const [serverErrors, setServerErrors] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [saveError, setSaveError] = useState<string | null>(null);

  const validation = useMemo(
    () => (draft ? SettingsSchema.safeParse(fromDraft(draft)) : null),
    [draft],
  );
  const fieldErrors = useMemo(() => {
    const errs: Record<string, string> = { ...serverErrors };
    if (validation && !validation.success)
      for (const i of validation.error.issues) errs[String(i.path[0] ?? 'form')] ??= i.message;
    return errs;
  }, [validation, serverErrors]);

  if (error) return <ErrorNote message={error} onRetry={reload} />;
  if (!data || !draft || !validation) return <Spinner />;

  const dirty = JSON.stringify(fromDraft(draft)) !== JSON.stringify(fromDraft(toDraft(data)));
  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => {
    setDraft({ ...draft, [key]: value });
    setServerErrors({});
    setStatus('idle');
  };

  const save = async () => {
    if (!validation.success) return;
    setStatus('saving');
    setSaveError(null);
    try {
      const saved = await send('settings/save', { settings: validation.data });
      setDraft(toDraft(saved));
      setStatus('saved');
    } catch (e) {
      if (e instanceof AppError && e.extra.fields) setServerErrors(e.extra.fields);
      setSaveError(errorMessage(e));
      setStatus('error');
    }
  };

  return (
    <div className="flex flex-col gap-6 pb-24">
      <Card>
        <CardTitle>Daily plan</CardTitle>
        <div className="grid gap-4 sm:grid-cols-3">
          <NumberField
            label="Daily goal"
            hint={`Problems per day (${LIMITS.dailyGoal.min}–${LIMITS.dailyGoal.max})`}
            value={draft.dailyGoal}
            min={LIMITS.dailyGoal.min}
            max={LIMITS.dailyGoal.max}
            error={fieldErrors.dailyGoal}
            onChange={(v) => set('dailyGoal', v)}
          />
          <NumberField
            label="Minimum reviews"
            hint="Problems you've done before, per day"
            value={draft.minReviewsPerDay}
            min={0}
            max={Number(draft.dailyGoal) || LIMITS.dailyGoal.max}
            error={fieldErrors.minReviewsPerDay}
            onChange={(v) => set('minReviewsPerDay', v)}
          />
          <NumberField
            label="Review cap"
            hint={`Most reviews per day (up to ${LIMITS.reviewCap.max})`}
            value={draft.reviewCap}
            min={1}
            max={LIMITS.reviewCap.max}
            error={fieldErrors.reviewCap}
            onChange={(v) => set('reviewCap', v)}
          />
        </div>
      </Card>

      <Card>
        <CardTitle>Lists</CardTitle>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-bold">Working on</span>
            <select
              value={draft.activeList}
              onChange={(e) => set('activeList', e.target.value as Settings['activeList'])}
              className="rounded-xl border-2 border-border bg-surface-2 px-3 py-2 font-bold"
            >
              {LIST_IDS.map((l) => (
                <option key={l} value={l}>
                  {LIST_LABELS[l]}
                </option>
              ))}
            </select>
            <span className="text-xs text-muted">
              New problems come from this list. Progress on other lists is kept.
            </span>
          </label>
          <fieldset className="flex flex-col gap-1.5">
            <legend className="mb-1.5 text-sm font-bold">Open problems on</legend>
            <div className="flex gap-2">
              {(['neetcode', 'leetcode'] as const).map((site) => (
                <Choice
                  key={site}
                  checked={draft.preferredSite === site}
                  onChange={() => set('preferredSite', site)}
                  name="site"
                >
                  {site === 'neetcode' ? 'NeetCode' : 'LeetCode'}
                </Choice>
              ))}
            </div>
            <span className="text-xs text-muted">
              Solving on either site counts. This only picks which link to open.
            </span>
          </fieldset>
        </div>
      </Card>

      <Card>
        <CardTitle>Rest days</CardTitle>
        <fieldset>
          <legend className="mb-1.5 text-sm font-bold">Every week</legend>
          <div className="flex flex-wrap gap-2">
            {WEEKDAY_LABELS.map((label, day) => {
              const on = draft.restWeekdays.includes(day);
              const wouldBlockAll =
                !on && draft.restWeekdays.length >= LIMITS.restWeekdays.maxCount;
              return (
                <button
                  key={label}
                  type="button"
                  aria-pressed={on}
                  disabled={wouldBlockAll}
                  title={wouldBlockAll ? 'Keep at least one practice day each week' : undefined}
                  onClick={() =>
                    set(
                      'restWeekdays',
                      on
                        ? draft.restWeekdays.filter((d) => d !== day)
                        : [...draft.restWeekdays, day].sort(),
                    )
                  }
                  className={cx(
                    'w-14 rounded-xl border-2 border-b-4 py-2 text-sm font-extrabold disabled:cursor-not-allowed disabled:opacity-40',
                    on
                      ? 'border-accent bg-accent-soft text-accent-text'
                      : 'border-border bg-surface text-muted',
                  )}
                >
                  {label}
                </button>
              );
            })}
          </div>
          {fieldErrors.restWeekdays && <FieldError message={fieldErrors.restWeekdays} />}
          <p className="mt-2 text-xs text-muted">
            Weekly rest days don't break your streak, and reviews never land on them.
          </p>
        </fieldset>
        <div className="mt-4 max-w-xs">
          <NumberField
            label="Extra rest days per month"
            hint={`For busy days (0–${LIMITS.adHocRestBudgetPerMonth.max})`}
            value={draft.adHocRestBudgetPerMonth}
            min={LIMITS.adHocRestBudgetPerMonth.min}
            max={LIMITS.adHocRestBudgetPerMonth.max}
            error={fieldErrors.adHocRestBudgetPerMonth}
            onChange={(v) => set('adHocRestBudgetPerMonth', v)}
          />
        </div>
        <p className="mt-2 text-xs text-muted">
          Save your settings before planning extra rest days with a new limit.
        </p>
        <RestDaysSection />
      </Card>

      <Card>
        <CardTitle>Schedule</CardTitle>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-bold">New day starts at</span>
            <select
              value={draft.rolloverHour}
              onChange={(e) => set('rolloverHour', Number(e.target.value))}
              className="rounded-xl border-2 border-border bg-surface-2 px-3 py-2 font-bold"
            >
              {Array.from({ length: LIMITS.rolloverHour.max + 1 }, (_, h) => (
                <option key={h} value={h}>
                  {hourLabel(h)}
                </option>
              ))}
            </select>
            <span className="text-xs text-muted">
              Problems solved before this time count for the previous day.
            </span>
          </label>
          <NumberField
            label="Longest gap between reviews"
            hint={`In days (${LIMITS.maxIntervalDays.min}–${LIMITS.maxIntervalDays.max})`}
            value={draft.maxIntervalDays}
            min={LIMITS.maxIntervalDays.min}
            max={LIMITS.maxIntervalDays.max}
            error={fieldErrors.maxIntervalDays}
            onChange={(v) => set('maxIntervalDays', v)}
          />
        </div>
      </Card>

      <Card>
        <CardTitle>Reminder & appearance</CardTitle>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <label className="flex items-center gap-2 text-sm font-bold">
              <input
                type="checkbox"
                checked={draft.reminder.enabled}
                onChange={(e) => set('reminder', { ...draft.reminder, enabled: e.target.checked })}
                className="size-4"
              />
              Daily reminder if today's goal isn't met
            </label>
            <input
              type="time"
              aria-label="Reminder time"
              value={draft.reminder.time}
              disabled={!draft.reminder.enabled}
              onChange={(e) => set('reminder', { ...draft.reminder, time: e.target.value })}
              className="w-36 rounded-xl border-2 border-border bg-surface-2 px-3 py-2 font-bold disabled:opacity-50"
            />
            {fieldErrors.reminder && <FieldError message={fieldErrors.reminder} />}
          </div>
          <fieldset>
            <legend className="mb-1.5 text-sm font-bold">Theme</legend>
            <div className="flex gap-2">
              {(['dark', 'light', 'system'] as const).map((t) => (
                <Choice
                  key={t}
                  checked={draft.theme === t}
                  onChange={() => set('theme', t)}
                  name="theme"
                >
                  {t[0]!.toUpperCase() + t.slice(1)}
                </Choice>
              ))}
            </div>
          </fieldset>
        </div>
        <p className="mt-4 text-sm text-muted">
          Keyboard shortcut:{' '}
          <kbd className="rounded-md border-2 border-border px-1.5 font-bold">Alt+Shift+S</kbd>{' '}
          opens the tracker on a problem page. Change it at chrome://extensions/shortcuts.
        </p>
      </Card>

      <DataSection />

      <div className="fixed inset-x-0 bottom-0 border-t-2 border-border bg-surface/95 px-6 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-end gap-3">
          {saveError && <span className="text-sm font-bold text-red">{saveError}</span>}
          {!validation.success && (
            <span className="text-sm font-bold text-red">Fix the highlighted fields to save.</span>
          )}
          {status === 'saved' && !dirty && (
            <span className="text-sm font-bold text-green">Saved</span>
          )}
          <Button onClick={() => setDraft(null)} disabled={!dirty || status === 'saving'}>
            Discard
          </Button>
          <Button
            tone="accent"
            onClick={() => void save()}
            disabled={!dirty || !validation.success || status === 'saving'}
          >
            Save changes
          </Button>
        </div>
      </div>
    </div>
  );
}

function FieldError({ message }: { message: string }) {
  return <span className="mt-1 block text-xs font-bold text-red">{message}</span>;
}

function NumberField(props: {
  label: string;
  hint: string;
  value: string;
  min: number;
  max: number;
  error: string | undefined;
  onChange: (v: string) => void;
}) {
  const id = `f-${props.label.replace(/\W+/g, '-').toLowerCase()}`;
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-bold">
        {props.label}
      </label>
      <input
        id={id}
        type="number"
        inputMode="numeric"
        step={1}
        min={props.min}
        max={props.max}
        value={props.value}
        aria-invalid={!!props.error}
        aria-describedby={`${id}-hint`}
        onChange={(e) => props.onChange(e.target.value)}
        className={cx(
          'rounded-xl border-2 bg-surface-2 px-3 py-2 font-bold',
          props.error ? 'border-red' : 'border-border',
        )}
      />
      <span id={`${id}-hint`} className="text-xs text-muted">
        {props.hint}
      </span>
      {props.error && <FieldError message={props.error} />}
    </div>
  );
}

function Choice({
  checked,
  onChange,
  name,
  children,
}: {
  checked: boolean;
  onChange: () => void;
  name: string;
  children: React.ReactNode;
}) {
  return (
    <label
      className={cx(
        'cursor-pointer rounded-xl border-2 border-b-4 px-3 py-1.5 text-sm font-extrabold',
        checked ? 'border-accent bg-accent-soft text-accent-text' : 'border-border text-muted',
      )}
    >
      <input type="radio" name={name} checked={checked} onChange={onChange} className="sr-only" />
      {children}
    </label>
  );
}
