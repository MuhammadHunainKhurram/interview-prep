import type { Difficulty } from '@/core/catalog/schema';
import type { Outcome } from '@/core/model/records';

export function cx(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(' ');
}

export type Tone = 'green' | 'blue' | 'yellow' | 'red' | 'neutral';

export const DIFFICULTY_TONE: Record<Difficulty, Tone> = {
  Easy: 'green',
  Medium: 'yellow',
  Hard: 'red',
};

export const OUTCOME_TONE: Record<Outcome, Tone> = {
  easy: 'blue',
  solved: 'green',
  hints: 'yellow',
  failed: 'red',
};
