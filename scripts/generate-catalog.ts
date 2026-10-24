/**
 * Generates src/core/catalog/data/catalog.json from NeetCode's public problem data.
 *
 * NeetCode ships its problem list inside its JavaScript bundle. We download the bundle
 * and parse it with acorn, extracting ONLY plain literal values (strings, numbers,
 * booleans, arrays, objects). The downloaded code is never executed.
 *
 * Usage: npm run catalog
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as acorn from 'acorn';
import { CatalogSchema, type Catalog, type CatalogProblem } from '../src/core/catalog/schema';

const ORIGIN = 'https://neetcode.io';
const OUT = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../src/core/catalog/data/catalog.json',
);

type Node = acorn.Node & Record<string, unknown>;
type Literal = string | number | boolean | null | Literal[] | { [k: string]: Literal };

class NotLiteral extends Error {}

/** Converts an AST node to a value, refusing anything that isn't a pure literal. */
function toLiteral(node: Node): Literal {
  switch (node.type) {
    case 'Literal':
      return node.value as string | number | boolean | null;
    case 'UnaryExpression': {
      const arg = node.argument as Node;
      // Minifiers write true/false as !0 / !1.
      if (node.operator === '!' && arg.type === 'Literal') return !arg.value;
      if (node.operator === '-' && arg.type === 'Literal' && typeof arg.value === 'number')
        return -arg.value;
      throw new NotLiteral();
    }
    case 'ArrayExpression':
      return (node.elements as Node[]).map(toLiteral);
    case 'ObjectExpression':
      return Object.fromEntries(
        (node.properties as Node[]).map((p) => {
          if (p.type !== 'Property' || p.computed) throw new NotLiteral();
          const key = p.key as Node;
          const name = key.type === 'Identifier' ? (key.name as string) : String(key.value);
          return [name, toLiteral(p.value as Node)];
        }),
      );
    case 'TemplateLiteral': {
      const quasis = node.quasis as { value: { cooked: string } }[];
      if ((node.expressions as Node[]).length > 0 || !quasis[0]) throw new NotLiteral();
      return quasis[0].value.cooked;
    }
    default:
      throw new NotLiteral();
  }
}

function walk(node: unknown, visit: (n: Node) => void): void {
  if (!node || typeof node !== 'object') return;
  const n = node as Node;
  if (typeof n.type === 'string') visit(n);
  for (const key of Object.keys(n)) {
    const child = n[key];
    if (Array.isArray(child)) child.forEach((c) => walk(c, visit));
    else if (child && typeof child === 'object') walk(child, visit);
  }
}

interface RawProblem {
  problem: string;
  pattern: string;
  link: string;
  ncLink?: string;
  difficulty: string;
  pro?: boolean;
  blind75?: boolean;
  neetcode150?: boolean;
  neetcode250?: boolean;
}

function isRawProblem(v: Literal): v is Literal & RawProblem {
  return (
    typeof v === 'object' &&
    v !== null &&
    !Array.isArray(v) &&
    typeof v.problem === 'string' &&
    typeof v.pattern === 'string' &&
    typeof v.link === 'string' &&
    typeof v.difficulty === 'string'
  );
}

const stripSlash = (s: string) => s.replace(/^\/+|\/+$/g, '');

async function fetchText(url: string): Promise<string> {
  const res = await fetch(url, { headers: { 'user-agent': 'interview-prep-catalog-generator' } });
  if (!res.ok) throw new Error(`GET ${url} failed: ${res.status}`);
  return res.text();
}

async function main() {
  const html = await fetchText(`${ORIGIN}/practice`);
  const bundle = /src="(main\.[a-f0-9]+\.js)"/.exec(html)?.[1];
  if (!bundle) throw new Error('Could not find the main bundle on the practice page.');
  const js = await fetchText(`${ORIGIN}/${bundle}`);

  const ast = acorn.parse(js, { ecmaVersion: 'latest', sourceType: 'script' });
  const problemArrays: RawProblem[][] = [];
  let sections: string[] | undefined;

  walk(ast, (n) => {
    if (n.type !== 'ArrayExpression') return;
    const elements = n.elements as Node[];
    if (elements.length < 10) return;
    let value: Literal;
    try {
      value = toLiteral(n);
    } catch {
      return;
    }
    if (!Array.isArray(value)) return;
    if (value.every(isRawProblem)) problemArrays.push(value as RawProblem[]);
    else if (
      !sections &&
      value[0] === 'Arrays & Hashing' &&
      value.every((v) => typeof v === 'string')
    )
      sections = value as string[];
  });

  const raw = problemArrays.sort((a, b) => b.length - a.length)[0];
  if (!raw) throw new Error('Could not find the problem list in the bundle.');
  if (!sections) throw new Error('Could not find the roadmap section order in the bundle.');

  const missing = [...new Set(raw.map((p) => p.pattern))].filter((s) => !sections!.includes(s));
  if (missing.length) throw new Error(`Sections missing from order: ${missing.join(', ')}`);

  // Stable sort: by roadmap section, keeping NeetCode's order within each section.
  const sectionIndex = new Map(sections.map((s, i) => [s, i]));
  const ordered = raw
    .map((p, i) => ({ p, i }))
    .sort((a, b) => sectionIndex.get(a.p.pattern)! - sectionIndex.get(b.p.pattern)! || a.i - b.i)
    .map(({ p }) => p);

  const counters = { blind75: 0, neetcode150: 0, neetcode250: 0, neetcodeAll: 0 };
  const problems: CatalogProblem[] = ordered.map((p) => {
    const lists: CatalogProblem['lists'] = { neetcodeAll: counters.neetcodeAll++ };
    if (p.blind75) lists.blind75 = counters.blind75++;
    if (p.neetcode150) lists.neetcode150 = counters.neetcode150++;
    if (p.neetcode250) lists.neetcode250 = counters.neetcode250++;
    const lcSlug = stripSlash(p.link);
    return {
      id: lcSlug,
      title: p.problem.trim(),
      difficulty: p.difficulty as CatalogProblem['difficulty'],
      section: p.pattern,
      lcSlug,
      ncSlug: p.ncLink ? stripSlash(p.ncLink) : null,
      neetcodePro: p.pro === true,
      lists,
    };
  });

  const catalog: Catalog = CatalogSchema.parse({
    generatedAt: new Date().toISOString(),
    source: `${ORIGIN}/${bundle}`,
    sections,
    problems,
  });

  await mkdir(dirname(OUT), { recursive: true });
  await writeFile(OUT, JSON.stringify(catalog) + '\n');
  console.log(
    `Wrote ${problems.length} problems ` +
      `(Blind 75: ${counters.blind75}, NC150: ${counters.neetcode150}, NC250: ${counters.neetcode250}) to ${OUT}`,
  );
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
