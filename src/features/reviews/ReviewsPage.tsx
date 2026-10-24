import { Badge, Card, CardTitle, EmptyState, ErrorNote, Spinner } from '@/shared/ui/components';
import { formatDay, plural, relativeDay } from '@/shared/ui/format';
import { useRequest } from '@/shared/ui/hooks';
import { ProblemRow } from '@/features/problems/ProblemRow';

export function ReviewsPage() {
  const { data, error, reload } = useRequest('reviews/get', {});
  if (error) return <ErrorNote message={error} onRetry={reload} />;
  if (!data) return <Spinner />;

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardTitle
          action={
            <span className="text-sm font-bold text-muted">
              {plural(data.due.length, 'problem')}
            </span>
          }
        >
          Due now
        </CardTitle>
        {data.due.length === 0 ? (
          <EmptyState title="Nothing due right now.">
            Solved problems come back here when it's time to re-solve them.
          </EmptyState>
        ) : (
          <>
            <p className="mb-2 text-sm text-muted">
              Your daily plan takes the most overdue first, up to your review cap. The rest roll
              over.
            </p>
            <ul>
              {data.due.map((p) => (
                <ProblemRow
                  key={p.id}
                  problem={p}
                  today={data.today}
                  extra={
                    p.overdueDays > 0 ? (
                      <Badge tone="red">{plural(p.overdueDays, 'day')} overdue</Badge>
                    ) : undefined
                  }
                />
              ))}
            </ul>
          </>
        )}
      </Card>

      <Card>
        <CardTitle>Next two weeks</CardTitle>
        {data.upcoming.length === 0 ? (
          <EmptyState title="No reviews scheduled in the next two weeks." />
        ) : (
          <div className="flex flex-col gap-5">
            {data.upcoming.map((u) => (
              <section key={u.day}>
                <h3 className="text-sm font-extrabold">
                  {relativeDay(u.day, data.today)}{' '}
                  <span className="font-semibold text-muted">· {formatDay(u.day)}</span>
                </h3>
                <ul>
                  {u.problems.map((p) => (
                    <ProblemRow key={p.id} problem={p} today={data.today} />
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
