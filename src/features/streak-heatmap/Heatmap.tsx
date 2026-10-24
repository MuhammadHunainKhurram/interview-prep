import { useState } from 'react';
import { weekday } from '@/core/calendar/logical-day';
import type { DayInfo } from '@/core/streak/streak';
import { cx } from '@/shared/ui/tones';
import { formatDay, plural } from '@/shared/ui/format';

type Level = 0 | 1 | 2 | 3 | 4 | 'rest' | 'future';

/** Shade by how much of the day's goal was done; goal met is level 2+. */
function level(d: DayInfo): Level {
  if (d.status === 'future') return 'future';
  if (d.status === 'rest') return 'rest';
  if (d.problemsDone === 0) return 0;
  if (d.status !== 'goal-met') return 1;
  if (d.problemsDone >= d.goal * 2) return 4;
  if (d.problemsDone >= Math.ceil(d.goal * 1.5)) return 3;
  return 2;
}

const LEVEL_CLASS: Record<Level, string> = {
  0: 'bg-heat-0',
  1: 'bg-heat-1',
  2: 'bg-heat-2',
  3: 'bg-heat-3',
  4: 'bg-heat-4',
  rest: 'bg-surface-2 ip-hatch',
  future: 'bg-transparent',
};

const STATUS_TEXT: Record<DayInfo['status'], string> = {
  'goal-met': 'Goal met',
  partial: 'Goal not met',
  missed: 'No practice',
  rest: 'Rest day',
  today: 'Today, in progress',
  future: 'Upcoming',
};

function describe(d: DayInfo): string {
  if (d.status === 'rest')
    return `${formatDay(d.day)} · Rest day${d.problemsDone ? ` · ${plural(d.problemsDone, 'problem')}` : ''}`;
  return `${formatDay(d.day)} · ${d.problemsDone}/${d.goal} problems · ${STATUS_TEXT[d.status]}`;
}

const monthFormat = new Intl.DateTimeFormat(undefined, { month: 'short' });

/** GitHub-style grid: one column per week (Sunday first), one cell per day. */
export function Heatmap({ days }: { days: DayInfo[] }) {
  const [hover, setHover] = useState<DayInfo | null>(null);
  const first = days[0];
  if (!first) return null;

  // Pad the first week so columns line up by weekday.
  const pad = weekday(first.day);
  const cells: (DayInfo | null)[] = [...Array<null>(pad).fill(null), ...days];
  const weeks: (DayInfo | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));

  const goalDays = days.filter((d) => d.status === 'goal-met').length;
  const last = days.at(-1)!;

  return (
    <div>
      <div className="overflow-x-auto pb-1">
        <div
          role="img"
          aria-label={`Practice over the last ${weeks.length} weeks: goal met on ${goalDays} days.`}
          className="inline-flex flex-col gap-1"
          onMouseLeave={() => setHover(null)}
        >
          <div className="flex gap-[3px] pl-0 text-[10px] font-bold text-muted" aria-hidden="true">
            {weeks.map((w, i) => {
              const firstOfMonth =
                w.find((d) => d && d.day.endsWith('-01')) ??
                (i === 0 ? w.find(Boolean) : undefined);
              return (
                <span key={i} className="w-3 overflow-visible whitespace-nowrap">
                  {firstOfMonth ? monthFormat.format(new Date(`${firstOfMonth.day}T12:00:00`)) : ''}
                </span>
              );
            })}
          </div>
          <div className="flex gap-[3px]">
            {weeks.map((week, wi) => (
              <div key={wi} className="flex flex-col gap-[3px]">
                {Array.from({ length: 7 }, (_, di) => {
                  const d = week[di];
                  if (!d) return <span key={di} className="size-3" />;
                  return (
                    <span
                      key={d.day}
                      title={describe(d)}
                      onMouseEnter={() => setHover(d)}
                      className={cx(
                        'size-3 rounded-[3px]',
                        LEVEL_CLASS[level(d)],
                        d.day === last.day && 'ring-2 ring-blue ring-offset-1 ring-offset-surface',
                      )}
                    />
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-xs text-muted">
        <span aria-live="polite" className="min-h-4 font-semibold text-text">
          {hover ? describe(hover) : describe(last)}
        </span>
        <span className="flex items-center gap-1" aria-hidden="true">
          Less
          {([0, 1, 2, 3, 4] as const).map((l) => (
            <span key={l} className={cx('size-3 rounded-[3px]', LEVEL_CLASS[l])} />
          ))}
          More
          <span className={cx('ml-2 size-3 rounded-[3px]', LEVEL_CLASS.rest)} /> Rest
        </span>
      </div>
    </div>
  );
}
