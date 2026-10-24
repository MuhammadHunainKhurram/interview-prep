import type { TodayView } from '@/shared/messaging/contract';
import { Badge, DifficultyBadge, OutcomeBadge } from '@/shared/ui/components';
import { plural } from '@/shared/ui/format';
import { IconCheck, IconExternal } from '@/shared/ui/icons';
import { problemHref } from '@/shared/ui/links';
import { cx } from '@/shared/ui/tones';

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
              className="group flex items-center gap-3 rounded-xl border border-border bg-surface px-3 py-2.5 transition-colors hover:border-border-strong hover:bg-surface-2"
            >
              <span
                aria-hidden="true"
                className={cx(
                  'flex size-6 shrink-0 items-center justify-center rounded-full border-2',
                  done ? 'border-green bg-green text-on-color' : 'border-border-strong',
                )}
              >
                {done && <IconCheck size={13} strokeWidth={3} />}
              </span>
              <span className="min-w-0 flex-1">
                <span className={cx('block truncate text-[15px] font-bold', done && 'text-muted')}>
                  {item.problem.title}
                </span>
                <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
                  {item.kind === 'review' ? (
                    <Badge tone="accent">{item.early ? 'Early review' : 'Review'}</Badge>
                  ) : (
                    <Badge>New</Badge>
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
    return (
      <p className="text-sm text-muted">Rest day. Your streak is safe, so take the day off.</p>
    );
  if (today.result.goalMet)
    return (
      <p className="text-sm text-muted">
        <span className="font-bold text-text">Goal met.</span> Anything else today is a bonus.
      </p>
    );
  const reviewsLeft = Math.max(
    0,
    Math.min(today.minReviews, today.items.filter((i) => i.kind === 'review').length) -
      today.result.reviewsDone,
  );
  const left = Math.max(0, today.goal - problemsDone);
  return (
    <p className="text-sm text-muted">
      <span className="font-bold text-text">{plural(left, 'problem')} to go.</span>
      {reviewsLeft > 0 && ` At least ${plural(reviewsLeft, 'review')} included.`}
      {today.deferredReviews > 0 &&
        ` ${plural(today.deferredReviews, 'more review')} will roll over to tomorrow.`}
    </p>
  );
}
