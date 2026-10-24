import type { Site } from '../model/settings';
import type { Catalog, CatalogProblem, ListId } from './schema';

/** Read-only, indexed view over the bundled problem catalog. */
export class ProblemCatalog {
  private readonly byId = new Map<string, CatalogProblem>();
  private readonly byNcSlug = new Map<string, CatalogProblem>();
  private readonly listCache = new Map<ListId, CatalogProblem[]>();

  constructor(private readonly data: Catalog) {
    for (const p of data.problems) {
      this.byId.set(p.id, p);
      if (p.ncSlug) this.byNcSlug.set(p.ncSlug, p);
    }
  }

  get sections(): readonly string[] {
    return this.data.sections;
  }

  get size(): number {
    return this.data.problems.length;
  }

  get(id: string): CatalogProblem | undefined {
    return this.byId.get(id);
  }

  /** Resolves a problem from the slug in a site's URL. */
  resolve(site: Site, slug: string): CatalogProblem | undefined {
    if (site === 'neetcode') return this.byNcSlug.get(slug) ?? this.byId.get(slug);
    return this.byId.get(slug);
  }

  /** Problems in a list, in roadmap order. */
  list(listId: ListId): readonly CatalogProblem[] {
    let cached = this.listCache.get(listId);
    if (!cached) {
      cached = this.data.problems
        .filter((p) => p.lists[listId] !== undefined)
        .sort((a, b) => a.lists[listId]! - b.lists[listId]!);
      this.listCache.set(listId, cached);
    }
    return cached;
  }

  inList(problemId: string, listId: ListId): boolean {
    return this.byId.get(problemId)?.lists[listId] !== undefined;
  }
}

export function problemUrl(p: CatalogProblem, preferred: Site): string {
  if (preferred === 'neetcode' && p.ncSlug) return `https://neetcode.io/problems/${p.ncSlug}`;
  return `https://leetcode.com/problems/${p.lcSlug}/`;
}

export function siteUrls(p: CatalogProblem): { neetcode: string | null; leetcode: string } {
  return {
    neetcode: p.ncSlug ? `https://neetcode.io/problems/${p.ncSlug}` : null,
    leetcode: `https://leetcode.com/problems/${p.lcSlug}/`,
  };
}
