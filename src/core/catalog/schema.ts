import { z } from 'zod';

export const LIST_IDS = ['blind75', 'neetcode150', 'neetcode250', 'neetcodeAll'] as const;
export const ListIdSchema = z.enum(LIST_IDS);
export type ListId = z.infer<typeof ListIdSchema>;

export const LIST_LABELS: Record<ListId, string> = {
  blind75: 'Blind 75',
  neetcode150: 'NeetCode 150',
  neetcode250: 'NeetCode 250',
  neetcodeAll: 'NeetCode All',
};

export const DifficultySchema = z.enum(['Easy', 'Medium', 'Hard']);
export type Difficulty = z.infer<typeof DifficultySchema>;

const SlugSchema = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
const OrderSchema = z.number().int().nonnegative();

export const CatalogProblemSchema = z.object({
  /** Canonical id: the LeetCode slug. */
  id: SlugSchema,
  title: z.string().min(1).max(200),
  difficulty: DifficultySchema,
  section: z.string().min(1),
  lcSlug: SlugSchema,
  /** Null when the problem has no page on neetcode.io. */
  ncSlug: SlugSchema.nullable(),
  /** Requires NeetCode Pro to open on neetcode.io. */
  neetcodePro: z.boolean(),
  /** Position of the problem in each list it belongs to (roadmap order). */
  lists: z.object({
    blind75: OrderSchema.optional(),
    neetcode150: OrderSchema.optional(),
    neetcode250: OrderSchema.optional(),
    neetcodeAll: OrderSchema,
  }),
});
export type CatalogProblem = z.infer<typeof CatalogProblemSchema>;

export const CatalogSchema = z
  .object({
    generatedAt: z.iso.datetime(),
    source: z.url(),
    sections: z.array(z.string().min(1)).min(1),
    problems: z.array(CatalogProblemSchema).min(1),
  })
  .superRefine((c, ctx) => {
    const seen = { id: new Set<string>(), nc: new Set<string>() };
    for (const p of c.problems) {
      if (seen.id.has(p.id)) ctx.addIssue({ code: 'custom', message: `Duplicate id ${p.id}` });
      seen.id.add(p.id);
      if (p.ncSlug) {
        if (seen.nc.has(p.ncSlug))
          ctx.addIssue({ code: 'custom', message: `Duplicate ncSlug ${p.ncSlug}` });
        seen.nc.add(p.ncSlug);
      }
      if (!c.sections.includes(p.section))
        ctx.addIssue({ code: 'custom', message: `Unknown section ${p.section}` });
    }
  });
export type Catalog = z.infer<typeof CatalogSchema>;
