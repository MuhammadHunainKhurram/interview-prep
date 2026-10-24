import { useState } from 'react';
import { OUTCOMES } from '@/core/model/records';
import { ACCENT_IDS, type Accent, type Settings, type Theme } from '@/core/model/settings';
import { errorMessage, send } from '@/shared/messaging/client';
import { ErrorNote, OutcomeIcon, SectionTitle, Spinner } from '@/shared/ui/components';
import { resolveTheme, useRequest } from '@/shared/ui/hooks';
import { IconCheck, IconMoon } from '@/shared/ui/icons';
import { PALETTES } from '@/shared/ui/palettes';
import { cx } from '@/shared/ui/tones';

const MODES: { id: Theme; label: string; hint: string }[] = [
  { id: 'dark', label: 'Dark', hint: 'Easy on the eyes at night' },
  { id: 'light', label: 'Light', hint: 'Bright and crisp' },
  { id: 'system', label: 'System', hint: 'Follows your computer' },
];

const OUTCOME_FILL: Record<(typeof OUTCOMES)[number], string> = {
  easy: 'bg-blue border-blue-shade',
  solved: 'bg-green border-green-shade',
  hints: 'bg-yellow border-yellow-shade',
  failed: 'bg-red border-red-shade',
};

export function ThemesPage() {
  const { data, error, reload } = useRequest('settings/get', {});
  const [saveError, setSaveError] = useState<string | null>(null);
  /** Shown as selected right away, before storage confirms. */
  const [pending, setPending] = useState<Partial<Pick<Settings, 'theme' | 'accent'>>>({});

  if (error) return <ErrorNote message={error} onRetry={reload} />;
  if (!data) return <Spinner />;

  const theme = pending.theme ?? data.theme;
  const accent = pending.accent ?? data.accent;
  const mode = resolveTheme(theme);

  const save = async (patch: Partial<Pick<Settings, 'theme' | 'accent'>>) => {
    setPending((p) => ({ ...p, ...patch }));
    setSaveError(null);
    try {
      await send('settings/save', { settings: { ...data, ...pending, ...patch } });
    } catch (e) {
      setSaveError(errorMessage(e));
      setPending({});
    }
  };

  return (
    <div className="flex flex-col gap-10">
      {saveError && <ErrorNote message={saveError} />}

      <section>
        <SectionTitle hint="Applies to the dashboard, the popup and the tracker on problem pages.">
          Mode
        </SectionTitle>
        <div role="radiogroup" aria-label="Mode" className="grid gap-3 sm:grid-cols-3">
          {MODES.map((m) => {
            const selected = theme === m.id;
            return (
              <button
                key={m.id}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => void save({ theme: m.id })}
                className={cx(
                  'flex items-center gap-3 rounded-2xl border-2 bg-surface p-3 text-left transition-colors',
                  selected ? 'border-accent' : 'border-border hover:border-border-strong',
                )}
              >
                <ModeSwatch mode={m.id} />
                <span className="min-w-0 flex-1">
                  <span className="block text-[15px] font-extrabold">{m.label}</span>
                  <span className="block text-[13px] text-muted">{m.hint}</span>
                </span>
                {selected && <SelectedMark />}
              </button>
            );
          })}
        </div>
      </section>

      <section>
        <SectionTitle hint="Your accent color for buttons, progress and the practice grid. The four outcome colors stay the same in every theme.">
          Color
        </SectionTitle>
        <div
          role="radiogroup"
          aria-label="Color"
          className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
        >
          {ACCENT_IDS.map((id) => (
            <AccentCard
              key={id}
              id={id}
              mode={mode}
              selected={accent === id}
              onSelect={() => void save({ accent: id })}
            />
          ))}
        </div>
      </section>
    </div>
  );
}

function SelectedMark() {
  return (
    <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-accent text-on-color">
      <IconCheck size={14} strokeWidth={3} />
    </span>
  );
}

function ModeSwatch({ mode }: { mode: Theme }) {
  const light = 'bg-[#f6f7f9] border-[#e3e6ea]';
  const dark = 'bg-[#131f24] border-[#2c3c44]';
  return (
    <span
      aria-hidden="true"
      className="relative flex size-11 shrink-0 overflow-hidden rounded-xl border border-border"
    >
      {mode === 'system' ? (
        <>
          <span className={cx('h-full w-1/2', light)} />
          <span className={cx('h-full w-1/2', dark)} />
        </>
      ) : (
        <span
          className={cx(
            'flex h-full w-full items-center justify-center',
            mode === 'dark' ? `${dark} text-[#eef3f6]` : `${light} text-[#2b3137]`,
          )}
        >
          {mode === 'dark' ? <IconMoon size={18} /> : <SunGlyph />}
        </span>
      )}
    </span>
  );
}

function SunGlyph() {
  return (
    <svg
      width={18}
      height={18}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.4}
      strokeLinecap="round"
    >
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </svg>
  );
}

/** A small working preview of the theme: a button, a progress bar and the practice grid. */
function AccentCard({
  id,
  mode,
  selected,
  onSelect,
}: {
  id: Accent;
  mode: 'light' | 'dark';
  selected: boolean;
  onSelect: () => void;
}) {
  const palette = PALETTES[id];
  const p = palette[mode];
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      aria-label={palette.name}
      onClick={onSelect}
      className={cx(
        'group flex flex-col rounded-2xl border-2 bg-surface text-left transition-colors',
        selected ? 'border-accent' : 'border-border hover:border-border-strong',
      )}
    >
      <span aria-hidden="true" className="flex flex-col gap-3 rounded-t-[14px] bg-surface-2 p-4">
        <span className="flex items-center justify-between gap-3">
          <span
            className="inline-flex h-8 items-center rounded-xl border-2 border-b-4 px-3 text-[13px] font-extrabold text-on-color"
            style={{ background: p.accent, borderColor: p.shade }}
          >
            Start
          </span>
          <span className="flex gap-1">
            {OUTCOMES.map((o) => (
              <span
                key={o}
                className={cx(
                  'flex size-6 items-center justify-center rounded-md border border-b-2 text-on-color',
                  OUTCOME_FILL[o],
                )}
              >
                <OutcomeIcon outcome={o} size={12} />
              </span>
            ))}
          </span>
        </span>
        <span className="h-2 w-full overflow-hidden rounded-full bg-surface">
          <span className="block h-full w-3/5 rounded-full" style={{ background: p.accent }} />
        </span>
        <span className="flex gap-1">
          {[0, 1, 2, 3, 4, 2, 3, 1, 4, 3, 0, 2].map((level, i) => (
            <span
              key={i}
              className={cx('size-3 rounded-[3px]', level === 0 && 'bg-heat-0')}
              style={level > 0 ? { background: p.heat[level - 1] } : undefined}
            />
          ))}
        </span>
      </span>
      <span className="flex items-start gap-3 p-4">
        <span className="min-w-0 flex-1">
          <span className="block text-[15px] font-extrabold">{palette.name}</span>
          <span className="mt-0.5 block text-[13px] text-muted">{palette.description}</span>
        </span>
        {selected && <SelectedMark />}
      </span>
    </button>
  );
}
