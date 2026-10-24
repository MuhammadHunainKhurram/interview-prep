import { problemHref } from '@/shared/ui/links';
import type { TodayView } from '@/shared/messaging/contract';
import { Badge, DifficultyBadge, OutcomeBadge } from '@/shared/ui/components';
import { cx } from '@/shared/ui/tones';
import { IconCheck, IconExternal } from '@/shared/ui/icons';

/** Today's planned problems, each linking to the preferred site. */
export function TodayList({ today, compact }: { today: TodayView; compact?: boolean }) {
  return (
    <ol className="flex flex-col gap-2">
      {today.items.map((item) => {
        const href = problemHref(item.problem.urls, today.preferredSite);
        const done = item.outcome !== null;
        return (
          <li key={item.problemId}>
            <a
              href={href ?? undefined}
              target="_blank"
              rel="noopener noreferrer"
              className={cx(
                'group flex items-center gap-3 rounded-xl border-2 border-border px-3 py-2.5 transition-colors hover:bg-surface-2',
                done && 'opacity-80',
              )}
            >
              <span
                aria-hidden="true"
                className={cx(
                  'flex size-7 shrink-0 items-center justify-center rounded-full border-2',
                  done ? 'border-green bg-green text-on-color' : 'border-border text-transparent',
                )}
              >
                <IconCheck size={14} />
              </span>
              <span className="min-w-0 flex-1">
                <span
                  className={cx('block truncate font-bold', done && 'line-through decoration-2')}
                >
                  {item.problem.title}
                </span>
                <span className="mt-0.5 flex flex-wrap items-center gap-1">
                  {item.kind === 'review' ? (
                    <Badge tone="blue">{item.early ? 'Early review' : 'Review'}</Badge>
                  ) : (
                    <Badge tone="green">New</Badge>
                  )}
                  {!compact && <DifficultyBadge difficulty={item.problem.difficulty} />}
                  {item.outcome && <OutcomeBadge outcome={item.outcome} />}
                </span>
              </span>
              <IconExternal size={16} className="shrink-0 text-faint group-hover:text-muted" />
              <span className="sr-only">{done ? '(done)' : ''} opens in a new tab</span>
            </a>
          </li>
        );
      })}
    </ol>
  );
}

export function TodaySummary({ today }: { today: TodayView }) {
  const { problemsDone } = today.result;
  if (today.isRest)
    return <p className="text-sm text-muted">Rest day. Your streak is safe, so enjoy the break.</p>;
  if (today.result.goalMet)
    return (
      <p className="text-sm font-bold text-text">
        Goal met: {problemsDone} of {today.goal} done. Anything else is a bonus.
      </p>
    );
  const reviewsLeft = Math.max(
    0,
    Math.min(today.minReviews, today.items.filter((i) => i.kind === 'review').length) -
      today.result.reviewsDone,
  );
  return (
    <p className="text-sm text-muted">
      <span className="font-bold text-text">
        {problemsDone} of {today.goal} done.
      </span>
      {reviewsLeft > 0 && ` Includes at least ${reviewsLeft} review.`}
      {today.deferredReviews > 0 &&
        ` ${today.deferredReviews} more reviews are waiting and will roll over.`}
    </p>
  );
}
