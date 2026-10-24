import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { ROADMAP_PATTERNS, TECHNIQUE_PATTERNS } from '@/core/model/patterns';
import { IconX } from './icons';
import { cx } from './tones';

const GROUPS = [
  { label: 'Roadmap topics', items: ROADMAP_PATTERNS as readonly string[] },
  { label: 'Techniques', items: TECHNIQUE_PATTERNS as readonly string[] },
];

/**
 * Selected patterns as removable chips, plus a compact searchable popover for
 * adding more. The list scrolls inside a short box instead of filling the screen.
 */
export function PatternPicker({
  value,
  onChange,
  max,
}: {
  value: readonly string[];
  onChange: (next: string[]) => void;
  max: number;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listId = useId();
  /**
   * The popover is positioned against the viewport so a scrolling container (the
   * tracker panel, a dialog) can't clip it. It opens upward when there's more room.
   */
  const [place, setPlace] = useState<{
    left: number;
    top?: number;
    bottom?: number;
    listMax: number;
  } | null>(null);

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    return GROUPS.map((g) => ({
      label: g.label,
      items: g.items.filter((p) => !value.includes(p) && (!q || p.toLowerCase().includes(q))),
    })).filter((g) => g.items.length > 0);
  }, [query, value]);
  const flat = useMemo(() => groups.flatMap((g) => g.items), [groups]);
  const activeIndex = Math.min(active, Math.max(0, flat.length - 1));

  useEffect(() => {
    if (!open) return;
    inputRef.current?.focus();
    const onPointerDown = (e: PointerEvent) => {
      const root = rootRef.current;
      if (root && !e.composedPath().includes(root)) close();
    };
    // Scrolling the page or the panel would leave the popover floating in the wrong
    // place, so close it. Scrolling inside the list itself is fine.
    const onScroll = (e: Event) => {
      const root = rootRef.current;
      if (root && !e.composedPath().includes(root)) close();
    };
    document.addEventListener('pointerdown', onPointerDown, true);
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', close);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true);
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', close);
    };
  }, [open]);

  useEffect(() => {
    listRef.current
      ?.querySelector<HTMLElement>(`[data-index="${activeIndex}"]`)
      ?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex, open]);

  function openPicker() {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const GAP = 6;
    const EDGE = 8;
    const SEARCH = 56;
    const below = window.innerHeight - rect.bottom - GAP - EDGE;
    const above = rect.top - GAP - EDGE;
    const openDown = below >= 220 || below >= above;
    const room = (openDown ? below : above) - SEARCH;
    setPlace({
      left: Math.max(EDGE, Math.min(rect.left, window.innerWidth - 256 - EDGE)),
      ...(openDown ? { top: rect.bottom + GAP } : { bottom: window.innerHeight - rect.top + GAP }),
      listMax: Math.max(120, Math.min(240, room)),
    });
    setOpen(true);
  }

  function close() {
    setOpen(false);
    setQuery('');
    setActive(0);
  }

  function add(p: string) {
    onChange([...value, p]);
    close();
  }

  const full = value.length >= max;

  return (
    <div ref={rootRef} className="relative">
      <div className="flex flex-wrap items-center gap-1.5">
        {value.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => onChange(value.filter((x) => x !== p))}
            className="flex h-7 items-center gap-1 rounded-lg bg-accent-soft px-2 text-xs font-bold text-accent-text hover:brightness-95"
            aria-label={`Remove ${p}`}
          >
            {p} <IconX size={10} />
          </button>
        ))}
        {!full && (
          <button
            type="button"
            aria-haspopup="listbox"
            aria-expanded={open}
            ref={triggerRef}
            onClick={() => (open ? close() : openPicker())}
            className="flex h-7 items-center gap-1 rounded-lg border border-dashed border-border-strong px-2 text-xs font-bold text-muted hover:border-faint hover:text-text"
          >
            + Add pattern
          </button>
        )}
        {full && <span className="text-xs text-muted">Up to {max} patterns</span>}
      </div>

      {open && place && (
        <div
          style={{ left: place.left, top: place.top, bottom: place.bottom }}
          className="fixed z-10 w-64 overflow-hidden rounded-xl border border-border bg-surface text-text shadow-[0_8px_24px_rgb(0_0_0/0.22)]"
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              e.stopPropagation();
              close();
            }
          }}
        >
          <div className="border-b border-border p-2">
            <input
              ref={inputRef}
              role="combobox"
              aria-expanded="true"
              aria-controls={listId}
              aria-activedescendant={flat.length ? `${listId}-${activeIndex}` : undefined}
              aria-label="Search patterns"
              placeholder="Search patterns"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setActive(0);
              }}
              onKeyDown={(e) => {
                if (e.key === 'ArrowDown') {
                  e.preventDefault();
                  setActive((i) => Math.min(i + 1, flat.length - 1));
                } else if (e.key === 'ArrowUp') {
                  e.preventDefault();
                  setActive((i) => Math.max(i - 1, 0));
                } else if (e.key === 'Enter') {
                  e.preventDefault();
                  const p = flat[activeIndex];
                  if (p) add(p);
                }
              }}
              className="h-8 w-full rounded-lg bg-surface-2 px-2.5 text-sm placeholder:text-faint"
            />
          </div>
          <div
            ref={listRef}
            id={listId}
            role="listbox"
            aria-label="Patterns"
            style={{ maxHeight: place.listMax }}
            className="overflow-y-auto p-1"
          >
            {flat.length === 0 && (
              <p className="px-2.5 py-3 text-sm text-muted">No matching patterns</p>
            )}
            {groups.map((g) => (
              <div key={g.label} role="group" aria-label={g.label}>
                <p className="px-2.5 pb-1 pt-2 text-[11px] font-bold uppercase tracking-wider text-faint">
                  {g.label}
                </p>
                {g.items.map((p) => {
                  const index = flat.indexOf(p);
                  return (
                    <div
                      key={p}
                      id={`${listId}-${index}`}
                      data-index={index}
                      role="option"
                      aria-selected={index === activeIndex}
                      onPointerEnter={() => setActive(index)}
                      onClick={() => add(p)}
                      className={cx(
                        'cursor-pointer rounded-lg px-2.5 py-1.5 text-sm font-semibold',
                        index === activeIndex ? 'bg-accent-soft text-accent-text' : 'text-text',
                      )}
                    >
                      {p}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
