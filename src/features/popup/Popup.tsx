import { LIST_LABELS } from '@/core/catalog/schema';
import { send } from '@/shared/messaging/client';
import { Button, ErrorNote, ProgressBar, Spinner } from '@/shared/ui/components';
import { useRequest, useTheme } from '@/shared/ui/hooks';
import { IconFlame } from '@/shared/ui/icons';
import { TodayList, TodaySummary } from '@/features/today/TodayList';

export function Popup() {
  const overview = useRequest('overview/get', {});
  const settings = useRequest('settings/get', {});
  useTheme(settings.data?.theme);

  const open = (route?: string) => {
    void send('dashboard/open', route ? { route } : {}).then(() => window.close());
  };

  return (
    <main className="flex w-[360px] flex-col gap-4 p-4">
      <header className="flex items-center justify-between">
        <h1 className="text-xl font-extrabold">Today</h1>
        {overview.data && (
          <span
            className="flex items-center gap-1 text-lg font-extrabold"
            title={`Current streak: ${overview.data.today.streak.current} days`}
          >
            <IconFlame
              size={22}
              className={overview.data.today.streak.todayMet ? 'text-orange' : 'text-faint'}
            />
            {overview.data.today.streak.current}
            <span className="sr-only">day streak</span>
          </span>
        )}
      </header>

      {overview.error && <ErrorNote message={overview.error} onRetry={overview.reload} />}
      {!overview.data && !overview.error && <Spinner />}

      {overview.data && (
        <>
          {!overview.data.today.isRest && (
            <ProgressBar
              value={overview.data.today.result.problemsDone}
              max={overview.data.today.goal}
              label="Today's goal"
            />
          )}
          <TodaySummary today={overview.data.today} />
          {overview.data.today.items.length > 0 && (
            <TodayList today={overview.data.today} compact />
          )}

          <section className="rounded-2xl border-2 border-border p-3">
            <div className="mb-2 flex items-baseline justify-between text-sm">
              <span className="font-extrabold">{LIST_LABELS[overview.data.activeList.listId]}</span>
              <span className="text-muted">
                {overview.data.activeList.solved} / {overview.data.activeList.total}
              </span>
            </div>
            <ProgressBar
              size="sm"
              tone="blue"
              value={overview.data.activeList.solved}
              max={overview.data.activeList.total}
              label={`${LIST_LABELS[overview.data.activeList.listId]} progress`}
            />
          </section>

          {overview.data.integrityIssues > 0 && (
            <ErrorNote message="Some saved data couldn't be read. Open Settings → Data to review it." />
          )}
        </>
      )}

      <Button tone="green" block onClick={() => open()}>
        Open dashboard
      </Button>
    </main>
  );
}
