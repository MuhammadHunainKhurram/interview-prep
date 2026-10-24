/**
 * Patterns you can tag an attempt with. The NeetCode roadmap sections come first
 * (a problem's own section is pre-selected), followed by finer-grained techniques.
 */
export const ROADMAP_PATTERNS = [
  'Arrays & Hashing',
  'Two Pointers',
  'Sliding Window',
  'Binary Search',
  'Linked List',
  'Stack',
  'Trees',
  'Tries',
  'Backtracking',
  'Heap / Priority Queue',
  'Graphs',
  'Advanced Graphs',
  '1-D Dynamic Programming',
  '2-D Dynamic Programming',
  'Greedy',
  'Intervals',
  'Bit Manipulation',
  'Math & Geometry',
] as const;

export const TECHNIQUE_PATTERNS = [
  'Prefix Sum',
  'Monotonic Stack',
  'Fast & Slow Pointers',
  'BFS',
  'DFS',
  'Topological Sort',
  'Union Find',
  'Dijkstra',
  'Two Heaps',
  'Top K Elements',
  'Bucket Sort',
  'Sorting',
  'Counting',
  'Matrix',
  'Memoization',
  'Simulation',
  'Design',
] as const;

export const ALL_PATTERNS: readonly string[] = [...ROADMAP_PATTERNS, ...TECHNIQUE_PATTERNS];

export function isKnownPattern(p: string): boolean {
  return ALL_PATTERNS.includes(p);
}
