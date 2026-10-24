import type { Site } from '../model/settings';

export interface ProblemLocation {
  site: Site;
  slug: string;
}

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/**
 * Extracts the problem slug from a LeetCode or NeetCode URL. Returns null for
 * anything that isn't a problem page (contests, discussions, the problem list…).
 */
export function parseProblemUrl(href: string): ProblemLocation | null {
  let url: URL;
  try {
    url = new URL(href);
  } catch {
    return null;
  }
  if (url.protocol !== 'https:') return null;

  const host = url.hostname.replace(/^www\./, '');
  const site: Site | null =
    host === 'leetcode.com' ? 'leetcode' : host === 'neetcode.io' ? 'neetcode' : null;
  if (!site) return null;

  const [first, slug] = url.pathname.split('/').filter(Boolean);
  if (first !== 'problems' || !slug) return null;
  const normalized = slug.toLowerCase();
  if (!SLUG.test(normalized) || normalized.length > 100) return null;
  return { site, slug: normalized };
}
