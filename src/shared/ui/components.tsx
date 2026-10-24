import type { ComponentProps, ReactNode } from 'react';
import type { Difficulty } from '@/core/catalog/schema';
import { OUTCOME_LABELS, type Outcome } from '@/core/model/records';
import { IconBulb, IconCheck, IconCheckDouble, IconX } from './icons';
import { cx, DIFFICULTY_TONE, OUTCOME_TONE, type Tone } from './tones';

const TONE_BUTTON: Record<Tone, string> = {
  green: 'bg-green text-on-color border-green-shade',
  blue: 'bg-blue text-on-color border-blue-shade',
  yellow: 'bg-yellow text-on-color border-yellow-shade',
  red: 'bg-red text-on-color border-red-shade',
  neutral: 'bg-surface text-text border-border',
};

type ButtonProps = ComponentProps<'button'> & {
  tone?: Tone;
  size?: 'sm' | 'md' | 'lg';
  block?: boolean;
  /** Uppercase label (default). Turn off for longer labels. */
  caps?: boolean;
};

/** Chunky button with a bottom "ledge" that presses down when clicked. */
export function Button({
  tone = 'neutral',
  size = 'md',
  block,
  caps = true,
  className,
  type = 'button',
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cx(
        'inline-flex select-none items-center justify-center gap-2 rounded-xl border-2 border-b-4 font-extrabold transition-[transform,filter] duration-75',
        caps && 'uppercase tracking-wide',
        'hover:brightness-105 active:translate-y-[2px] active:border-b-2 disabled:cursor-not-allowed disabled:opacity-50 disabled:active:translate-y-0 disabled:active:border-b-4',
        size === 'sm' && 'px-3 py-1.5 text-xs',
        size === 'md' && 'px-4 py-2.5 text-sm',
        size === 'lg' && 'px-5 py-3 text-base',
        block && 'w-full',
        TONE_BUTTON[tone],
        className,
      )}
      {...props}
    />
  );
}

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
    <As className={cx('rounded-2xl border-2 border-border bg-surface p-5', className)}>
      {children}
    </As>
  );
}

export function CardTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-4 flex items-center justify-between gap-3">
      <h2 className="text-lg font-extrabold">{children}</h2>
      {action}
    </div>
  );
}

const TONE_BAR: Record<Tone, string> = {
  green: 'bg-green',
  blue: 'bg-blue',
  yellow: 'bg-yellow',
  red: 'bg-red',
  neutral: 'bg-faint',
};

export function ProgressBar({
  value,
  max,
  tone = 'green',
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
        size === 'md' ? 'h-4' : 'h-2.5',
      )}
    >
      <div
        className={cx('h-full rounded-full transition-[width] duration-500', TONE_BAR[tone])}
        style={{ width: `${pct}%`, minWidth: value > 0 ? '0.5rem' : 0 }}
      />
    </div>
  );
}

const TONE_BADGE: Record<Tone, string> = {
  green: 'bg-green-soft text-text border-green',
  blue: 'bg-blue-soft text-text border-blue',
  yellow: 'bg-yellow-soft text-text border-yellow',
  red: 'bg-red-soft text-text border-red',
  neutral: 'bg-surface-2 text-muted border-border',
};

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
        'inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-lg border px-2 py-0.5 text-xs font-bold',
        TONE_BADGE[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

export function DifficultyBadge({ difficulty }: { difficulty: Difficulty | null }) {
  if (!difficulty) return null;
  return <Badge tone={DIFFICULTY_TONE[difficulty]}>{difficulty}</Badge>;
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
      <span className="size-6 animate-spin rounded-full border-4 border-surface-2 border-t-blue" />
      <span className="sr-only">{label}</span>
    </div>
  );
}

export function ErrorNote({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div
      role="alert"
      className="flex items-center justify-between gap-3 rounded-xl border-2 border-red bg-red-soft px-4 py-3 text-sm font-semibold"
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
    <div className="rounded-2xl border-2 border-dashed border-border px-6 py-10 text-center">
      <p className="text-base font-extrabold">{title}</p>
      {children && <div className="mt-2 text-sm text-muted">{children}</div>}
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
    <div className="rounded-2xl border-2 border-border bg-surface p-4">
      <p className="text-xs font-bold uppercase tracking-wide text-muted">{label}</p>
      <p className="mt-1 text-2xl font-extrabold">{value}</p>
      {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
    </div>
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
