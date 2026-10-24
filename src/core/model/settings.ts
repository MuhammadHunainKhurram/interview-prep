import { z } from 'zod';
import { ListIdSchema } from '../catalog/schema';

/**
 * Limits for every user-editable setting. They live in the schema (not only in the
 * form) so they apply equally to the Settings page, imported backups and messages.
 */
export const LIMITS = {
  dailyGoal: { min: 1, max: 20 },
  minReviewsPerDay: { min: 0 },
  reviewCap: { max: 50 },
  restWeekdays: { maxCount: 6 },
  adHocRestBudgetPerMonth: { min: 0, max: 8 },
  maxIntervalDays: { min: 30, max: 3650 },
  rolloverHour: { min: 0, max: 6 },
} as const;

const int = (label: string) =>
  z.number({ error: `${label} must be a number` }).int(`${label} must be a whole number`);

export const SiteSchema = z.enum(['neetcode', 'leetcode']);
export type Site = z.infer<typeof SiteSchema>;

export const ThemeSchema = z.enum(['dark', 'light', 'system']);
export type Theme = z.infer<typeof ThemeSchema>;

export const SettingsSchema = z
  .object({
    activeList: ListIdSchema,
    preferredSite: SiteSchema,
    dailyGoal: int('Daily goal')
      .min(LIMITS.dailyGoal.min, `Daily goal must be at least ${LIMITS.dailyGoal.min}`)
      .max(LIMITS.dailyGoal.max, `Daily goal can be at most ${LIMITS.dailyGoal.max}`),
    minReviewsPerDay: int('Minimum reviews').min(0, 'Minimum reviews cannot be negative'),
    reviewCap: int('Review cap').max(
      LIMITS.reviewCap.max,
      `Review cap can be at most ${LIMITS.reviewCap.max}`,
    ),
    restWeekdays: z
      .array(int('Weekday').min(0).max(6))
      .max(LIMITS.restWeekdays.maxCount, 'Keep at least one non-rest day each week')
      .refine((d) => new Set(d).size === d.length, 'Weekdays must be unique'),
    adHocRestBudgetPerMonth: int('Extra rest days')
      .min(LIMITS.adHocRestBudgetPerMonth.min, 'Extra rest days cannot be negative')
      .max(
        LIMITS.adHocRestBudgetPerMonth.max,
        `Extra rest days can be at most ${LIMITS.adHocRestBudgetPerMonth.max} per month`,
      ),
    maxIntervalDays: int('Max review interval')
      .min(LIMITS.maxIntervalDays.min, `Max review interval must be at least ${LIMITS.maxIntervalDays.min} days`)
      .max(LIMITS.maxIntervalDays.max, `Max review interval can be at most ${LIMITS.maxIntervalDays.max} days`),
    rolloverHour: int('Day rollover hour')
      .min(LIMITS.rolloverHour.min, 'Rollover hour must be between 12 AM and 6 AM')
      .max(LIMITS.rolloverHour.max, 'Rollover hour must be between 12 AM and 6 AM'),
    reminder: z.object({
      enabled: z.boolean(),
      time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Reminder time must be HH:MM'),
    }),
    theme: ThemeSchema,
  })
  .superRefine((s, ctx) => {
    if (s.minReviewsPerDay > s.dailyGoal)
      ctx.addIssue({
        code: 'custom',
        path: ['minReviewsPerDay'],
        message: 'Minimum reviews cannot be more than the daily goal',
      });
    if (s.reviewCap < Math.max(1, s.minReviewsPerDay))
      ctx.addIssue({
        code: 'custom',
        path: ['reviewCap'],
        message: 'Review cap must be at least 1 and at least the minimum reviews',
      });
  });
export type Settings = z.infer<typeof SettingsSchema>;

export const DEFAULT_SETTINGS: Settings = {
  activeList: 'neetcode150',
  preferredSite: 'neetcode',
  dailyGoal: 3,
  minReviewsPerDay: 1,
  reviewCap: 5,
  restWeekdays: [],
  adHocRestBudgetPerMonth: 4,
  maxIntervalDays: 365,
  rolloverHour: 2,
  reminder: { enabled: false, time: '19:00' },
  theme: 'dark',
};
