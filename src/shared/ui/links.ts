import type { Site } from '@/core/model/settings';

/** Link for a problem on the preferred site, falling back to the other one. */
export function problemHref(
  urls: { neetcode: string | null; leetcode: string | null },
  preferred: Site,
): string | null {
  return preferred === 'neetcode'
    ? (urls.neetcode ?? urls.leetcode)
    : (urls.leetcode ?? urls.neetcode);
}
