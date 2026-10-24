import { useMemo, useState } from 'react';
import { LIST_IDS, LIST_LABELS, type ListId } from '@/core/catalog/schema';
import type { ProblemWithStatus } from '@/shared/messaging/contract';
import {
  Button,
  Card,
  EmptyState,
  ErrorNote,
  ProgressBar,
  Select,
  Spinner,
} from '@/shared/ui/components';
import { IconChevronDown, IconChevronRight } from '@/shared/ui/icons';
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
        <Select
          aria-label="Filter"
          value={filter}
          onChange={(e) => setFilter(e.target.value as Filter)}
          id="problems-filter"
        >
          {FILTERS.map((f) => (
            <option key={f.id} value={f.id}>
              {f.label}
            </option>
          ))}
        </Select>
      </div>

      {active === 'unlisted' ? (
        <UnlistedList query={query.trim().toLowerCase()} filter={filter} />
      ) : (
        <ListView listId={active} query={query.trim().toLowerCase()} filter={filter} />
      )}
    </div>
  );
}

/** Collapsed sections per list, remembered in this browser. */
function useCollapsedSections(listId: ListId): [Set<string>, (next: Set<string>) => void] {
  const key = `interview-prep:collapsed:${listId}`;
  const read = (): Set<string> => {
    try {
      const raw = localStorage.getItem(key);
      const parsed: unknown = raw ? JSON.parse(raw) : [];
      return new Set(Array.isArray(parsed) ? parsed.filter((x) => typeof x === 'string') : []);
    } catch {
      return new Set();
    }
  };
  const [state, setState] = useState<{ key: string; value: Set<string> }>(() => ({
    key,
    value: read(),
  }));
  // Switching lists: load that list's saved state (adjusting state during render).
  if (state.key !== key) setState({ key, value: read() });
  const set = (next: Set<string>) => {
    setState({ key, value: next });
    try {
      localStorage.setItem(key, JSON.stringify([...next]));
    } catch {
      // Storage can be unavailable; collapsing still works for this visit.
    }
  };
  return [state.key === key ? state.value : read(), set];
}

function ListView({ listId, query, filter }: { listId: ListId; query: string; filter: Filter }) {
  const { data, error, reload } = useRequest('problems/get', { listId });
  const [collapsed, setCollapsed] = useCollapsedSections(listId);
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
      {sections.length > 0 && (
        <div className="-mb-2 flex justify-end gap-2">
          <Button
            size="sm"
            onClick={() => setCollapsed(new Set(data.sections.map((x) => x.section)))}
          >
            Collapse all
          </Button>
          <Button size="sm" onClick={() => setCollapsed(new Set())}>
            Expand all
          </Button>
        </div>
      )}
      {sections.map((s) => {
        const solved = s.problems.filter((p) => p.status?.everSolved).length;
        const searching = !!query || filter !== 'all';
        const expanded = searching || !collapsed.has(s.section);
        const bodyId = `section-${s.section.replace(/\W+/g, '-').toLowerCase()}`;
        return (
          <Card key={s.section} as="article" flush>
            <h2>
              <button
                type="button"
                aria-expanded={expanded}
                aria-controls={bodyId}
                disabled={searching}
                onClick={() => {
                  const next = new Set(collapsed);
                  if (next.has(s.section)) next.delete(s.section);
                  else next.add(s.section);
                  setCollapsed(next);
                }}
                className="flex w-full items-center gap-4 rounded-2xl px-5 py-4 text-left hover:bg-surface-2/60 disabled:cursor-default disabled:hover:bg-transparent"
              >
                {expanded ? (
                  <IconChevronDown size={18} className="shrink-0 text-muted" />
                ) : (
                  <IconChevronRight size={18} className="shrink-0 text-muted" />
                )}
                <span className="flex-1 text-base font-extrabold">{s.section}</span>
                <span className="text-sm font-bold tabular-nums text-muted">
                  {solved}/{s.problems.length}
                </span>
                <span className="hidden w-32 sm:block">
                  <ProgressBar
                    size="sm"
                    tone={solved === s.problems.length ? 'green' : 'accent'}
                    value={solved}
                    max={s.problems.length}
                    label={`${s.section} progress`}
                  />
                </span>
              </button>
            </h2>
            {expanded && (
              <ul id={bodyId} className="px-5 pb-3">
                {s.visible.map((p) => (
                  <ProblemRow key={p.id} problem={p} today={data.today} />
                ))}
              </ul>
            )}
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
