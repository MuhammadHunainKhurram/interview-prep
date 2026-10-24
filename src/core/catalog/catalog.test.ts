import { describe, expect, it } from 'vitest';
import { getCatalog, problemUrl } from './index';
import { parseProblemUrl } from './url';

const catalog = getCatalog();

describe('bundled catalog', () => {
  it('has the expected list sizes', () => {
    expect(catalog.list('blind75')).toHaveLength(75);
    expect(catalog.list('neetcode150')).toHaveLength(150);
    expect(catalog.list('neetcode250')).toHaveLength(250);
    expect(catalog.list('neetcodeAll').length).toBe(catalog.size);
  });

  it('orders NeetCode 150 by roadmap section, then NeetCode order', () => {
    const list = catalog.list('neetcode150');
    expect(list[0]?.title).toBe('Contains Duplicate');
    expect(list[0]?.section).toBe('Arrays & Hashing');
    const sectionOrder = [...new Set(list.map((p) => p.section))];
    expect(sectionOrder).toEqual(catalog.sections.filter((s) => sectionOrder.includes(s)));
  });

  it('maps NeetCode slugs to the same problem as LeetCode slugs', () => {
    const viaNc = catalog.resolve('neetcode', 'duplicate-integer');
    const viaLc = catalog.resolve('leetcode', 'contains-duplicate');
    expect(viaNc).toBeDefined();
    expect(viaNc).toBe(viaLc);
  });

  it('builds URLs for the preferred site with a LeetCode fallback', () => {
    const p = catalog.resolve('leetcode', 'contains-duplicate')!;
    expect(problemUrl(p, 'neetcode')).toBe('https://neetcode.io/problems/duplicate-integer');
    expect(problemUrl(p, 'leetcode')).toBe('https://leetcode.com/problems/contains-duplicate/');
  });

  it('NeetCode 150 is a subset of NeetCode 250', () => {
    for (const p of catalog.list('neetcode150')) expect(p.lists.neetcode250).toBeDefined();
  });
});

describe('parseProblemUrl', () => {
  it.each([
    ['https://leetcode.com/problems/two-sum/', { site: 'leetcode', slug: 'two-sum' }],
    [
      'https://leetcode.com/problems/two-sum/description/?envType=x',
      { site: 'leetcode', slug: 'two-sum' },
    ],
    ['https://www.leetcode.com/problems/Two-Sum', { site: 'leetcode', slug: 'two-sum' }],
    [
      'https://neetcode.io/problems/duplicate-integer',
      { site: 'neetcode', slug: 'duplicate-integer' },
    ],
    [
      'https://neetcode.io/problems/duplicate-integer/question?list=neetcode150',
      { site: 'neetcode', slug: 'duplicate-integer' },
    ],
  ])('parses %s', (href, expected) => {
    expect(parseProblemUrl(href)).toEqual(expected);
  });

  it.each([
    'https://leetcode.com/problemset/',
    'https://leetcode.com/contest/weekly-contest-400/',
    'https://neetcode.io/practice',
    'https://neetcode.io/problems/',
    'http://leetcode.com/problems/two-sum/',
    'https://evil.com/problems/two-sum',
    'https://leetcode.com.evil.com/problems/two-sum',
    'https://leetcode.com/problems/<script>/',
    'not a url',
  ])('ignores %s', (href) => {
    expect(parseProblemUrl(href)).toBeNull();
  });
});
