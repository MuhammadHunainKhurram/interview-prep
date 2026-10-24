import type { LogicalDay } from '@/core/calendar/logical-day';
import type { ProblemWithStatus } from '@/shared/messaging/contract';
import { Badge, DifficultyBadge, ExternalLink, OutcomeBadge } from '@/shared/ui/components';
import { relativeDay } from '@/shared/ui/format';
import { IconExternal } from '@/shared/ui/icons';

/** One problem with its status and links to both sites. */
export function ProblemRow({
  problem,
  today,
  extra,
}: {
  problem: ProblemWithStatus;
  today: LogicalDay;
  extra?: React.ReactNode;
}) {
  const s = problem.status;
  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b-2 border-border px-1 py-2.5 last:border-b-0">
      <span className="min-w-0 flex-1">
        <span className="block truncate font-bold">{problem.title}</span>
        <span className="mt-0.5 flex flex-wrap items-center gap-1 text-xs text-muted">
          <DifficultyBadge difficulty={problem.difficulty} />
          {s ? <OutcomeBadge outcome={s.lastOutcome} /> : <Badge>Not started</Badge>}
          {problem.neetcodePro && <Badge>NeetCode Pro</Badge>}
          {s?.lastSolvedAt && (
            <span>Solved {relativeDay(s.lastSolvedAt.slice(0, 10), today).toLowerCase()}</span>
          )}
          {s && <span>· Review {relativeDay(s.nextReviewDay, today).toLowerCase()}</span>}
          {extra}
        </span>
      </span>
      <span className="flex shrink-0 gap-2 text-xs font-extrabold">
        {problem.urls.neetcode && (
          <ExternalLink
            href={problem.urls.neetcode}
            className="flex items-center gap-1 rounded-lg border-2 border-border px-2 py-1 hover:bg-surface-2"
          >
            NeetCode <IconExternal size={12} />
          </ExternalLink>
        )}
        {problem.urls.leetcode && (
          <ExternalLink
            href={problem.urls.leetcode}
            className="flex items-center gap-1 rounded-lg border-2 border-border px-2 py-1 hover:bg-surface-2"
          >
            LeetCode <IconExternal size={12} />
          </ExternalLink>
        )}
      </span>
    </li>
  );
}
