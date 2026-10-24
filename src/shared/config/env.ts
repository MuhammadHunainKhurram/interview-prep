import { z } from 'zod';

/**
 * Build-time configuration from .env (see .env.example). Values are bundled into
 * the extension, so they must never be secrets.
 */
const EnvSchema = z
  .object({
    WXT_STORAGE_BACKEND: z.enum(['local', 'supabase']).default('local'),
    WXT_SUPABASE_URL: z.union([z.url({ protocol: /^https$/ }), z.literal('')]).optional(),
    WXT_SUPABASE_ANON_KEY: z.string().optional(),
  })
  .superRefine((env, ctx) => {
    if (env.WXT_STORAGE_BACKEND === 'supabase') {
      if (!env.WXT_SUPABASE_URL)
        ctx.addIssue({
          code: 'custom',
          path: ['WXT_SUPABASE_URL'],
          message: 'Required for the supabase backend',
        });
      if (!env.WXT_SUPABASE_ANON_KEY)
        ctx.addIssue({
          code: 'custom',
          path: ['WXT_SUPABASE_ANON_KEY'],
          message: 'Required for the supabase backend',
        });
    }
  });

export type AppConfig = z.infer<typeof EnvSchema>;

export function loadConfig(env: Record<string, unknown> = import.meta.env): AppConfig {
  const parsed = EnvSchema.safeParse(env);
  if (!parsed.success) {
    const details = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
    throw new Error(`Invalid environment configuration: ${details}`);
  }
  return parsed.data;
}
