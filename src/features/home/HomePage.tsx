import { LIST_IDS, LIST_LABELS, type ListId } from '@/core/catalog/schema';
import { errorMessage, send } from '@/shared/messaging/client';
import { Card, CardTitle, ErrorNote, ProgressBar, Spinner, StatTile } from '@/shared/ui/components';
import { formatDay, plural } from '@/shared/ui/format';
import { useRequest } from '@/shared/ui/hooks';
import { IconFlame } from '@/shared/ui/icons';
import { Heatmap } from '@/features/streak-heatmap/Heatmap';
import { TodayList, TodaySummary } from '@/features/today/TodayList';
import { useState } from 'react';

export function HomePage() {
  const { data, error, reload } = useRequest('overview/get', {});
  const settings = useRequest('settings/get', {});
  const [listError, setListError] = useState<string | null>(null);

  if (error) return <ErrorNote message={error} onRetry={reload} />;
  if (!data) return <Spinner />;

  const switchList = async (listId: ListId) => {
    if (!settings.data) return;
    setListError(null);
    try {
      await send('settings/save', { settings: { ...settings.data, activeList: listId } });
    } catch (e) {
      setListError(errorMessage(e));
    }
  };

  const { today } = data;
  const upcomingTotal = data.upcoming.reduce((s, u) => s + u.count, 0);

  return (
    <div className="flex flex-col gap-6">
      {data.integrityIssues > 0 && (
        <ErrorNote
          message={`${plural(data.integrityIssues, 'saved record')} couldn't be read and were set aside. Review them in Settings → Data.`}
        />
      )}

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <Card>
          <CardTitle
            action={<span className="text-sm font-bold text-muted">{formatDay(today.today)}</span>}
          >
            Today's plan
          </CardTitle>
          {!today.isRest && (
            <div className="mb-3">
              <ProgressBar
                value={today.result.problemsDone}
                max={today.goal}
                label="Today's goal"
              />
            </div>
          )}
          <TodaySummary today={today} />
          {today.items.length > 0 && (
            <div className="mt-4">
              <TodayList today={today} />
            </div>
          )}
        </Card>

        <div className="grid grid-cols-2 content-start gap-4">
          <StatTile
            label="Current streak"
            value={
              <span className="flex items-center gap-2">
                <IconFlame
                  size={26}
                  className={today.streak.todayMet ? 'text-orange' : 'text-faint'}
                />
                {today.streak.current}
              </span>
            }
            hint={
              today.streak.todayMet
                ? 'Today counts!'
                : today.isRest
                  ? 'Rest day'
                  : 'Hit your goal to extend it'
            }
          />
          <StatTile
            label="Longest streak"
            value={today.streak.longest}
            hint={plural(today.streak.longest, 'day')}
          />
          <StatTile
            label="Reviews this week"
            value={upcomingTotal}
            hint={
              data.upcoming.find((u) => u.count > 0)
                ? `Next: ${formatDay(data.upcoming.find((u) => u.count > 0)!.day)}`
                : 'Nothing scheduled'
            }
          />
          <StatTile
            label={LIST_LABELS[data.activeList.listId]}
            value={`${Math.round((data.activeList.solved / data.activeList.total) * 100)}%`}
            hint={`${data.activeList.solved} of ${data.activeList.total} solved`}
          />
        </div>
      </div>

      <Card>
        <CardTitle>Streak</CardTitle>
        <Heatmap days={data.heatmap} />
      </Card>

      <Card>
        <CardTitle
          action={
            <label className="flex items-center gap-2 text-sm font-bold text-muted">
              Working on
              <select
                value={data.activeList.listId}
                onChange={(e) => void switchList(e.target.value as ListId)}
                className="rounded-xl border-2 border-border bg-surface px-2 py-1 font-bold text-text"
              >
                {LIST_IDS.map((l) => (
                  <option key={l} value={l}>
                    {LIST_LABELS[l]}
                  </option>
                ))}
              </select>
            </label>
          }
        >
          Roadmap
        </CardTitle>
        {listError && <ErrorNote message={listError} />}
        <div className="grid gap-x-8 gap-y-3 sm:grid-cols-2">
          {data.activeList.sections.map((s) => (
            <div key={s.section}>
              <div className="mb-1 flex justify-between text-sm">
                <span className="font-bold">{s.section}</span>
                <span className="text-muted">
                  {s.solved}/{s.total}
                </span>
              </div>
              <ProgressBar
                size="sm"
                value={s.solved}
                max={s.total}
                label={`${s.section} progress`}
              />
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
