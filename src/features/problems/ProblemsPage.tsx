import { useMemo, useState } from 'react';
import { LIST_IDS, LIST_LABELS, type ListId } from '@/core/catalog/schema';
import type { ProblemWithStatus } from '@/shared/messaging/contract';
import { Card, EmptyState, ErrorNote, ProgressBar, Spinner } from '@/shared/ui/components';
import { cx } from '@/shared/ui/tones';
import { useRequest } from '@/shared/ui/hooks';
import { ProblemRow } from './ProblemRow';

type Tab = ListId | 'unlisted';
type Filter = 'all' | 'todo' | 'solved' | 'struggled';

const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'todo', label: 'Not started' },
  { id: 'solved', label: 'Solved' },
  { id: 'struggled', label: 'Struggled last time' },
];

function matches(p: ProblemWithStatus, query: string, filter: Filter): boolean {
  if (query && !p.title.toLowerCase().includes(query)) return false;
  switch (filter) {
    case 'all':
      return true;
    case 'todo':
      return !p.status;
    case 'solved':
      return !!p.status?.everSolved;
    case 'struggled':
      return p.status?.lastOutcome === 'hints' || p.status?.lastOutcome === 'failed';
  }
}

export function ProblemsPage() {
  const settings = useRequest('settings/get', {});
  const [tab, setTab] = useState<Tab | null>(null);
  const active: Tab = tab ?? settings.data?.activeList ?? 'neetcode150';
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');

  return (
    <div className="flex flex-col gap-4">
      <div role="tablist" aria-label="Problem lists" className="flex flex-wrap gap-2">
        {[...LIST_IDS, 'unlisted' as const].map((t) => (
          <button
            key={t}
            role="tab"
            type="button"
            aria-selected={active === t}
            onClick={() => setTab(t)}
            className={cx(
              'rounded-xl border-2 border-b-4 px-3 py-1.5 text-sm font-extrabold',
              active === t
                ? 'border-accent bg-accent-soft text-accent-text'
                : 'border-border bg-surface text-muted hover:text-text',
            )}
          >
            {t === 'unlisted' ? 'Unlisted' : LIST_LABELS[t]}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search problems"
          aria-label="Search problems"
          maxLength={100}
          className="min-w-48 flex-1 rounded-xl border-2 border-border bg-surface px-3 py-2 font-semibold placeholder:text-faint"
        />
        <select
          aria-label="Filter"
          value={filter}
          onChange={(e) => setFilter(e.target.value as Filter)}
          className="rounded-xl border-2 border-border bg-surface px-3 py-2 font-bold"
        >
          {FILTERS.map((f) => (
            <option key={f.id} value={f.id}>
              {f.label}
            </option>
          ))}
        </select>
      </div>

      {active === 'unlisted' ? (
        <UnlistedList query={query.trim().toLowerCase()} filter={filter} />
      ) : (
        <ListView listId={active} query={query.trim().toLowerCase()} filter={filter} />
      )}
    </div>
  );
}

function ListView({ listId, query, filter }: { listId: ListId; query: string; filter: Filter }) {
  const { data, error, reload } = useRequest('problems/get', { listId });
  const sections = useMemo(
    () =>
      data?.sections
        .map((s) => ({ ...s, visible: s.problems.filter((p) => matches(p, query, filter)) }))
        .filter((s) => s.visible.length > 0) ?? [],
    [data, query, filter],
  );

  if (error) return <ErrorNote message={error} onRetry={reload} />;
  if (!data) return <Spinner />;

  return (
    <>
      <Card>
        <div className="mb-2 flex justify-between text-sm font-bold">
          <span>{LIST_LABELS[listId]}</span>
          <span className="text-muted">
            {data.progress.solved} solved · {data.progress.attempted} attempted ·{' '}
            {data.progress.total} total
          </span>
        </div>
        <ProgressBar
          value={data.progress.solved}
          max={data.progress.total}
          label={`${LIST_LABELS[listId]} progress`}
        />
      </Card>
      {sections.length === 0 && <EmptyState title="No problems match." />}
      {sections.map((s) => {
        const solved = s.problems.filter((p) => p.status?.everSolved).length;
        return (
          <Card key={s.section} as="article">
            <details open={!!query || filter !== 'all' || solved < s.problems.length}>
              <summary className="flex cursor-pointer list-none items-center gap-4">
                <h2 className="flex-1 text-base font-extrabold">{s.section}</h2>
                <span className="text-sm font-bold text-muted">
                  {solved}/{s.problems.length}
                </span>
                <span className="w-32">
                  <ProgressBar
                    size="sm"
                    value={solved}
                    max={s.problems.length}
                    label={`${s.section} progress`}
                  />
                </span>
              </summary>
              <ul className="mt-3">
                {s.visible.map((p) => (
                  <ProblemRow key={p.id} problem={p} today={data.today} />
                ))}
              </ul>
            </details>
          </Card>
        );
      })}
    </>
  );
}

function UnlistedList({ query, filter }: { query: string; filter: Filter }) {
  const { data, error, reload } = useRequest('unlisted/get', {});
  const today = useRequest('today/get', {});
  if (error) return <ErrorNote message={error} onRetry={reload} />;
  if (!data || !today.data) return <Spinner />;
  const visible = data.filter((p) => matches(p, query, filter));
  if (!data.length)
    return (
      <EmptyState title="No unlisted problems yet.">
        Problems you solve on LeetCode or NeetCode that aren't in any NeetCode list show up here.
      </EmptyState>
    );
  return (
    <Card>
      <ul>
        {visible.map((p) => (
          <ProblemRow key={p.id} problem={p} today={today.data!.today} />
        ))}
      </ul>
    </Card>
  );
}
