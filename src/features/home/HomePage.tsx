import { useState } from 'react';
import { LIST_IDS, LIST_LABELS, type ListId } from '@/core/catalog/schema';
import { errorMessage, send } from '@/shared/messaging/client';
import {
  Card,
  ErrorNote,
  ProgressBar,
  SectionTitle,
  Select,
  Spinner,
} from '@/shared/ui/components';
import { formatDay, formatLongDay, plural } from '@/shared/ui/format';
import { useRequest } from '@/shared/ui/hooks';
import { IconCheck, IconFlame } from '@/shared/ui/icons';
import { cx } from '@/shared/ui/tones';
import { Heatmap } from '@/features/streak-heatmap/Heatmap';
import { TodayList, TodaySummary } from '@/features/today/TodayList';

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
  const nextReview = data.upcoming.find((u) => u.count > 0);
  const list = data.activeList;

  return (
    <div className="flex flex-col gap-10">
      {data.integrityIssues > 0 && (
        <ErrorNote
          message={`${plural(data.integrityIssues, 'saved record')} couldn't be read and were set aside. Review them in Settings, under Your data.`}
        />
      )}

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <Card className="p-6 shadow-[0_1px_0_var(--color-border)]">
          <SectionTitle hint={formatLongDay(today.today)}>Today's plan</SectionTitle>
          {!today.isRest && (
            <div className="mb-2 flex items-center gap-3">
              <div className="flex-1">
                <ProgressBar
                  value={today.result.problemsDone}
                  max={today.goal}
                  tone={today.result.goalMet ? 'green' : 'accent'}
                  label="Today's goal"
                />
              </div>
              <span className="text-sm font-extrabold tabular-nums">
                {today.result.problemsDone}/{today.goal}
              </span>
            </div>
          )}
          <TodaySummary today={today} />
          {today.items.length > 0 && (
            <div className="mt-5">
              <TodayList today={today} />
            </div>
          )}
        </Card>

        <Card className="p-6">
          <div className="flex items-center gap-4">
            <span
              aria-hidden="true"
              className={cx(
                'flex size-14 shrink-0 items-center justify-center rounded-2xl',
                today.streak.todayMet ? 'bg-orange/15 text-orange' : 'bg-surface-2 text-faint',
              )}
            >
              <IconFlame size={30} />
            </span>
            <div>
              <p className="text-[34px] font-extrabold leading-none tabular-nums">
                {today.streak.current}
              </p>
              <p className="mt-1 text-sm font-bold text-muted">
                day streak
                {today.streak.todayMet ? ', today counts' : today.isRest ? ', rest day' : ''}
              </p>
            </div>
          </div>

          <dl className="mt-6 divide-y divide-border border-t border-border text-sm">
            <div className="flex items-center justify-between py-3">
              <dt className="text-muted">Longest streak</dt>
              <dd className="font-extrabold tabular-nums">{plural(today.streak.longest, 'day')}</dd>
            </div>
            <div className="flex items-center justify-between py-3">
              <dt className="text-muted">Reviews in the next 7 days</dt>
              <dd className="font-extrabold tabular-nums">
                {upcomingTotal}
                {nextReview && (
                  <span className="ml-1.5 font-semibold text-muted">
                    · next {formatDay(nextReview.day)}
                  </span>
                )}
              </dd>
            </div>
            <div className="py-3">
              <div className="mb-2 flex items-center justify-between">
                <dt className="text-muted">{LIST_LABELS[list.listId]}</dt>
                <dd className="font-extrabold tabular-nums">
                  {list.solved}
                  <span className="font-semibold text-muted"> / {list.total}</span>
                </dd>
              </div>
              <ProgressBar
                size="sm"
                value={list.solved}
                max={list.total}
                label={`${LIST_LABELS[list.listId]} progress`}
              />
            </div>
          </dl>
        </Card>
      </div>

      <section>
        <SectionTitle hint="Each square is a day. Darker means more problems done.">
          Practice history
        </SectionTitle>
        <Card>
          <Heatmap days={data.heatmap} />
        </Card>
      </section>

      <section>
        <SectionTitle
          hint="Your progress through each topic, in roadmap order"
          action={
            <label className="flex items-center gap-3 text-sm font-bold text-muted">
              List
              <Select
                id="home-active-list"
                value={list.listId}
                onChange={(e) => void switchList(e.target.value as ListId)}
                wrapperClassName="min-w-44"
              >
                {LIST_IDS.map((l) => (
                  <option key={l} value={l}>
                    {LIST_LABELS[l]}
                  </option>
                ))}
              </Select>
            </label>
          }
        >
          Roadmap
        </SectionTitle>
        {listError && <ErrorNote message={listError} />}
        <ul className="grid gap-x-10 gap-y-4 sm:grid-cols-2">
          {list.sections.map((s) => {
            const complete = s.total > 0 && s.solved === s.total;
            return (
              <li key={s.section}>
                <div className="mb-1.5 flex items-center justify-between gap-2 text-sm">
                  <span className="flex items-center gap-1.5 font-bold">
                    {s.section}
                    {complete && (
                      <IconCheck
                        size={14}
                        strokeWidth={3}
                        className="text-green"
                        aria-label="complete"
                      />
                    )}
                  </span>
                  <span className="tabular-nums text-muted">
                    {s.solved}/{s.total}
                  </span>
                </div>
                <ProgressBar
                  size="sm"
                  tone={complete ? 'green' : 'accent'}
                  value={s.solved}
                  max={s.total}
                  label={`${s.section} progress`}
                />
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
