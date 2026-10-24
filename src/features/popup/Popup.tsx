import { LIST_LABELS } from '@/core/catalog/schema';
import { send } from '@/shared/messaging/client';
import { Button, ErrorNote, LogoMark, ProgressBar, Spinner } from '@/shared/ui/components';
import { useRequest, useTheme } from '@/shared/ui/hooks';
import { IconFlame } from '@/shared/ui/icons';
import { cx } from '@/shared/ui/tones';
import { TodayList, TodaySummary } from '@/features/today/TodayList';

export function Popup() {
  const overview = useRequest('overview/get', {});
  const settings = useRequest('settings/get', {});
  useTheme(settings.data?.theme);

  const open = (route?: string) => {
    void send('dashboard/open', route ? { route } : {}).then(() => window.close());
  };

  const data = overview.data;

  return (
    <main className="flex w-[360px] flex-col gap-4 bg-bg p-4">
      <header className="flex items-center justify-between">
        <h1 className="flex items-center gap-2 text-[15px] font-extrabold">
          <LogoMark size={24} />
          Today
        </h1>
        {data && (
          <span
            className={cx(
              'flex items-center gap-1 rounded-xl px-2 py-1 text-[15px] font-extrabold tabular-nums',
              data.today.streak.todayMet ? 'bg-orange/15 text-orange' : 'bg-surface-2 text-muted',
            )}
            title={`${data.today.streak.current}-day streak`}
          >
            <IconFlame size={16} />
            {data.today.streak.current}
            <span className="sr-only">day streak</span>
          </span>
        )}
      </header>

      {overview.error && <ErrorNote message={overview.error} onRetry={overview.reload} />}
      {!data && !overview.error && <Spinner />}

      {data && (
        <>
          <div className="flex flex-col gap-2">
            {!data.today.isRest && (
              <div className="flex items-center gap-3">
                <div className="flex-1">
                  <ProgressBar
                    value={data.today.result.problemsDone}
                    max={data.today.goal}
                    tone={data.today.result.goalMet ? 'green' : 'accent'}
                    label="Today's goal"
                  />
                </div>
                <span className="text-sm font-extrabold tabular-nums">
                  {data.today.result.problemsDone}/{data.today.goal}
                </span>
              </div>
            )}
            <TodaySummary today={data.today} />
          </div>
          {data.today.items.length > 0 && <TodayList today={data.today} compact />}

          <div className="flex flex-col gap-2 border-t border-border pt-3">
            <div className="flex items-baseline justify-between text-sm">
              <span className="font-bold text-muted">{LIST_LABELS[data.activeList.listId]}</span>
              <span className="font-extrabold tabular-nums">
                {data.activeList.solved}
                <span className="font-semibold text-muted"> / {data.activeList.total}</span>
              </span>
            </div>
            <ProgressBar
              size="sm"
              value={data.activeList.solved}
              max={data.activeList.total}
              label={`${LIST_LABELS[data.activeList.listId]} progress`}
            />
          </div>

          {data.integrityIssues > 0 && (
            <ErrorNote message="Some saved data couldn't be read. Open Settings in the dashboard to review it." />
          )}
        </>
      )}

      <Button tone="accent" block onClick={() => open()}>
        Open dashboard
      </Button>
    </main>
  );
}
