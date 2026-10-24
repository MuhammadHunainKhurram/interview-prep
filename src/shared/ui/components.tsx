import type { ComponentProps, ReactNode } from 'react';
import type { Difficulty } from '@/core/catalog/schema';
import { OUTCOME_LABELS, type Outcome } from '@/core/model/records';
import { IconBulb, IconCheck, IconCheckDouble, IconX } from './icons';
import { cx, OUTCOME_TONE, type Tone } from './tones';

const TONE_BUTTON: Record<Tone, string> = {
  accent: 'bg-accent text-on-color border-accent-shade',
  green: 'bg-green text-on-color border-green-shade',
  blue: 'bg-blue text-on-color border-blue-shade',
  yellow: 'bg-yellow text-on-color border-yellow-shade',
  red: 'bg-red text-on-color border-red-shade',
  neutral: 'bg-surface text-text border-border-strong',
};

type ButtonProps = ComponentProps<'button'> & {
  tone?: Tone;
  size?: 'sm' | 'md' | 'lg';
  block?: boolean;
  /** Icon-only button: square, no horizontal padding. */
  square?: boolean;
};

/**
 * Chunky button with a bottom ledge that presses down when clicked. This is the one
 * place the playful style lives; containers around it stay flat and quiet.
 */
export function Button({
  tone = 'neutral',
  size = 'md',
  block,
  square,
  className,
  type = 'button',
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cx(
        'inline-flex select-none items-center justify-center gap-2 rounded-xl border-2 border-b-4 font-extrabold transition-[transform,filter] duration-75',
        'hover:brightness-105 active:translate-y-[2px] active:border-b-2 disabled:cursor-not-allowed disabled:opacity-50 disabled:active:translate-y-0 disabled:active:border-b-4',
        size === 'sm' && (square ? 'size-8' : 'h-8 px-3 text-[13px]'),
        size === 'md' && (square ? 'size-10' : 'h-10 px-4 text-sm'),
        size === 'lg' && (square ? 'size-12' : 'h-12 px-5 text-[15px]'),
        block && 'w-full',
        TONE_BUTTON[tone],
        className,
      )}
      {...props}
    />
  );
}

/** A flat container. Use for groups that need separating, not for every block. */
export function Card({
  className,
  children,
  as: As = 'section',
}: {
  className?: string;
  children: ReactNode;
  as?: 'section' | 'div' | 'article';
}) {
  return (
    <As className={cx('rounded-2xl border border-border bg-surface p-5', className)}>{children}</As>
  );
}

export function SectionTitle({
  children,
  action,
  hint,
}: {
  children: ReactNode;
  action?: ReactNode;
  hint?: ReactNode;
}) {
  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
      <div className="min-w-0">
        <h2 className="text-[17px] font-extrabold leading-tight text-balance">{children}</h2>
        {hint && <p className="mt-0.5 text-[13px] text-muted">{hint}</p>}
      </div>
      {action}
    </div>
  );
}

/** Kept for existing call sites. */
export const CardTitle = SectionTitle;

const TONE_BAR: Record<Tone, string> = {
  accent: 'bg-accent',
  green: 'bg-green',
  blue: 'bg-blue',
  yellow: 'bg-yellow',
  red: 'bg-red',
  neutral: 'bg-faint',
};

export function ProgressBar({
  value,
  max,
  tone = 'accent',
  label,
  size = 'md',
}: {
  value: number;
  max: number;
  tone?: Tone;
  label: string;
  size?: 'sm' | 'md';
}) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={value}
      className={cx(
        'w-full overflow-hidden rounded-full bg-surface-2',
        size === 'md' ? 'h-3' : 'h-2',
      )}
    >
      <div
        className={cx('h-full rounded-full transition-[width] duration-500', TONE_BAR[tone])}
        style={{ width: `${pct}%`, minWidth: value > 0 ? '0.5rem' : 0 }}
      />
    </div>
  );
}

const TONE_CHIP: Record<Tone, string> = {
  accent: 'bg-accent-soft text-accent-text',
  green: 'bg-green-soft text-text',
  blue: 'bg-blue-soft text-text',
  yellow: 'bg-yellow-soft text-text',
  red: 'bg-red-soft text-text',
  neutral: 'bg-surface-2 text-muted',
};

/** Small status chip. Text always carries the meaning; color only reinforces it. */
export function Badge({
  tone = 'neutral',
  children,
  className,
}: {
  tone?: Tone;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cx(
        'inline-flex h-5 shrink-0 items-center gap-1 whitespace-nowrap rounded-md px-1.5 text-xs font-bold',
        TONE_CHIP[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

const DIFFICULTY_DOT: Record<Difficulty, string> = {
  Easy: 'bg-green',
  Medium: 'bg-yellow',
  Hard: 'bg-red',
};

/** Difficulty as a colored dot and text: readable without the color. */
export function DifficultyBadge({ difficulty }: { difficulty: Difficulty | null }) {
  if (!difficulty) return null;
  return (
    <span className="inline-flex shrink-0 items-center gap-1.5 text-xs font-bold text-muted">
      <span aria-hidden="true" className={cx('size-2 rounded-full', DIFFICULTY_DOT[difficulty])} />
      {difficulty}
    </span>
  );
}

export function OutcomeIcon({ outcome, size = 16 }: { outcome: Outcome; size?: number }) {
  switch (outcome) {
    case 'easy':
      return <IconCheckDouble size={size} />;
    case 'solved':
      return <IconCheck size={size} />;
    case 'hints':
      return <IconBulb size={size} />;
    case 'failed':
      return <IconX size={size} />;
  }
}

/** Outcome with color, icon and text, so it never relies on color alone. */
export function OutcomeBadge({ outcome }: { outcome: Outcome }) {
  return (
    <Badge tone={OUTCOME_TONE[outcome]}>
      <OutcomeIcon outcome={outcome} size={12} />
      {OUTCOME_LABELS[outcome]}
    </Badge>
  );
}

export function Spinner({ label = 'Loading' }: { label?: string }) {
  return (
    <div role="status" className="flex items-center justify-center p-8 text-muted">
      <span className="size-6 animate-spin rounded-full border-4 border-surface-2 border-t-accent" />
      <span className="sr-only">{label}</span>
    </div>
  );
}

export function ErrorNote({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div
      role="alert"
      className="flex items-center justify-between gap-3 rounded-xl border border-red bg-red-soft px-4 py-3 text-sm font-semibold"
    >
      <span>{message}</span>
      {onRetry && (
        <Button size="sm" onClick={onRetry}>
          Retry
        </Button>
      )}
    </div>
  );
}

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-border-strong px-6 py-10 text-center">
      <p className="text-[15px] font-extrabold">{title}</p>
      {children && <div className="mx-auto mt-1.5 max-w-md text-sm text-muted">{children}</div>}
    </div>
  );
}

export function StatTile({
  label,
  value,
  hint,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-border bg-surface p-4">
      <p className="text-[13px] font-bold text-muted">{label}</p>
      <p className="mt-1 text-[26px] font-extrabold leading-tight tabular-nums">{value}</p>
      {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
    </div>
  );
}

/** The app mark: a rounded accent square with a check, matching the toolbar icon. */
export function LogoMark({ size = 28 }: { size?: number }) {
  return (
    <span
      aria-hidden="true"
      className="inline-flex shrink-0 items-center justify-center rounded-[30%] border-b-[3px] border-accent-shade bg-accent text-on-color"
      style={{ width: size, height: size }}
    >
      <IconCheck size={Math.round(size * 0.6)} strokeWidth={3} />
    </span>
  );
}

export function ExternalLink({
  href,
  children,
  className,
}: {
  href: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className={className}>
      {children}
    </a>
  );
}
