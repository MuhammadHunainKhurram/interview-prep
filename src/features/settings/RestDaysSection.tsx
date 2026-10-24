import { useState } from 'react';
import { addDays, monthKey } from '@/core/calendar/logical-day';
import { canRemoveAdHocRestDay, MAX_REST_DAYS_AHEAD } from '@/core/calendar/rest-days';
import { errorMessage, send } from '@/shared/messaging/client';
import { Button, ErrorNote, Spinner } from '@/shared/ui/components';
import { formatDay, relativeDay } from '@/shared/ui/format';
import { useRequest } from '@/shared/ui/hooks';
import { IconTrash } from '@/shared/ui/icons';

export function RestDaysSection() {
  const { data, error, reload } = useRequest('restDays/get', {});
  const [day, setDay] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (error) return <ErrorNote message={error} onRetry={reload} />;
  if (!data) return <Spinner />;

  const min = addDays(data.today, -1);
  const max = addDays(data.today, MAX_REST_DAYS_AHEAD);
  const thisMonth = monthKey(data.today);
  const used = data.usedByMonth[thisMonth] ?? 0;

  const act = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setActionError(null);
    try {
      await fn();
      setDay('');
    } catch (e) {
      setActionError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const upcoming = data.entries.filter((e) => e.logicalDay >= min);

  return (
    <div className="mt-6 border-t-2 border-border pt-4">
      <h3 className="text-sm font-bold">Extra rest days</h3>
      <p className="mt-1 text-xs text-muted">
        Used {used} of {data.budgetPerMonth} this month. You can mark yesterday (if you didn't
        practice), today, or up to {MAX_REST_DAYS_AHEAD} days ahead.
      </p>
      <form
        className="mt-3 flex flex-wrap items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (day) void act(() => send('restDays/add', { day }));
        }}
      >
        <input
          type="date"
          aria-label="Rest day"
          value={day}
          min={min}
          max={max}
          onChange={(e) => setDay(e.target.value)}
          className="rounded-xl border-2 border-border bg-surface-2 px-3 py-2 font-bold"
        />
        <Button type="submit" tone="blue" size="sm" disabled={!day || busy}>
          Add rest day
        </Button>
      </form>
      {actionError && (
        <div className="mt-2">
          <ErrorNote message={actionError} />
        </div>
      )}
      {upcoming.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-2">
          {upcoming.map((r) => (
            <li
              key={r.logicalDay}
              className="flex items-center gap-2 rounded-xl border-2 border-border px-3 py-1.5 text-sm font-bold"
            >
              {formatDay(r.logicalDay)}{' '}
              <span className="font-semibold text-muted">
                ({relativeDay(r.logicalDay, data.today)})
              </span>
              {canRemoveAdHocRestDay(r.logicalDay, data.today) && (
                <button
                  type="button"
                  aria-label={`Remove rest day ${formatDay(r.logicalDay)}`}
                  onClick={() => void act(() => send('restDays/remove', { day: r.logicalDay }))}
                  disabled={busy}
                  className="text-muted hover:text-red"
                >
                  <IconTrash size={14} />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
