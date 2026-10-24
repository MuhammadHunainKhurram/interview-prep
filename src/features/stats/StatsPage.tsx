import { LIST_LABELS } from '@/core/catalog/schema';
import { OUTCOME_LABELS, OUTCOMES } from '@/core/model/records';
import {
  Card,
  CardTitle,
  DifficultyBadge,
  EmptyState,
  ErrorNote,
  OutcomeIcon,
  ProgressBar,
  Spinner,
  StatTile,
} from '@/shared/ui/components';
import { OUTCOME_TONE } from '@/shared/ui/tones';
import { formatDuration, formatLongDay, plural } from '@/shared/ui/format';
import { useRequest } from '@/shared/ui/hooks';

export function StatsPage() {
  const { data, error, reload } = useRequest('stats/get', {});
  if (error) return <ErrorNote message={error} onRetry={reload} />;
  if (!data) return <Spinner />;
  if (data.totals.attempts === 0)
    return <EmptyState title="No stats yet.">Solve a few problems and come back.</EmptyState>;

  const totalOutcomes = OUTCOMES.reduce((s, o) => s + data.outcomes[o], 0);
  const { forecast } = data;

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatTile
          label="Problems solved"
          value={data.totals.solved}
          hint={`${data.totals.problems} attempted`}
        />
        <StatTile label="Attempts" value={data.totals.attempts} />
        <StatTile
          label="Time practiced"
          value={formatDuration(data.totals.timedSec)}
          hint="Timed attempts only"
        />
        <StatTile
          label="Longest streak"
          value={data.streak.longest}
          hint={`Current: ${plural(data.streak.current, 'day')}`}
        />
      </div>

      <Card>
        <CardTitle>Finish forecast · {LIST_LABELS[data.activeList]}</CardTitle>
        {forecast.remaining === 0 ? (
          <p className="font-bold">You've solved every problem in this list.</p>
        ) : forecast.finishDay ? (
          <p>
            At your recent pace of{' '}
            <strong>{forecast.newPerActiveDay.toFixed(1)} new problems per active day</strong>,
            you'll finish the remaining <strong>{forecast.remaining}</strong> around{' '}
            <strong>{formatLongDay(forecast.finishDay)}</strong>.
          </p>
        ) : (
          <p className="text-muted">
            Solve some new problems this week to get a forecast. {forecast.remaining} to go.
          </p>
        )}
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardTitle>How attempts went</CardTitle>
          <ul className="flex flex-col gap-3">
            {OUTCOMES.map((o) => (
              <li key={o}>
                <div className="mb-1 flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2 font-bold">
                    <OutcomeIcon outcome={o} size={14} />
                    {OUTCOME_LABELS[o]}
                  </span>
                  <span className="text-muted">
                    {data.outcomes[o]} ·{' '}
                    {totalOutcomes ? Math.round((data.outcomes[o] / totalOutcomes) * 100) : 0}%
                  </span>
                </div>
                <ProgressBar
                  size="sm"
                  tone={OUTCOME_TONE[o]}
                  value={data.outcomes[o]}
                  max={totalOutcomes}
                  label={OUTCOME_LABELS[o]}
                />
              </li>
            ))}
          </ul>
        </Card>

        <Card>
          <CardTitle>Average solve time</CardTitle>
          <div className="grid grid-cols-3 gap-3">
            {data.averageTimes.map((t) => (
              <div key={t.difficulty} className="rounded-xl bg-surface-2 p-3">
                <DifficultyBadge difficulty={t.difficulty} />
                <p className="mt-1 text-xl font-extrabold">
                  {t.averageSec === null ? '—' : formatDuration(t.averageSec)}
                </p>
                <p className="text-xs text-muted">{plural(t.samples, 'solve')}</p>
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs text-muted">
            Counts timed attempts that were solved (easily, normally or with hints).
          </p>
        </Card>
      </div>

      <Card>
        <CardTitle>Topics to work on</CardTitle>
        {data.weakSections.length === 0 ? (
          <p className="text-sm text-muted">
            Once a topic has at least 3 reviews, the ones where you needed hints or didn't solve
            show up here.
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {data.weakSections.slice(0, 8).map((w) => (
              <li key={w.section}>
                <div className="mb-1 flex justify-between text-sm">
                  <span className="font-bold">{w.section}</span>
                  <span className="text-muted">
                    struggled in {Math.round(w.struggleRate * 100)}% of{' '}
                    {plural(w.reviews, 'review')}
                  </span>
                </div>
                <ProgressBar
                  size="sm"
                  tone="red"
                  value={Math.round(w.struggleRate * 100)}
                  max={100}
                  label={`${w.section} struggle rate`}
                />
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <CardTitle>All lists</CardTitle>
        <ul className="grid gap-4 sm:grid-cols-2">
          {data.lists.map((l) => (
            <li key={l.listId}>
              <div className="mb-1 flex justify-between text-sm">
                <span className="font-bold">{LIST_LABELS[l.listId]}</span>
                <span className="text-muted">
                  {l.solved}/{l.total}
                </span>
              </div>
              <ProgressBar
                size="sm"
                tone="accent"
                value={l.solved}
                max={l.total}
                label={`${LIST_LABELS[l.listId]} progress`}
              />
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
