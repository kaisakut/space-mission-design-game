/**
 * Branch tree for the forecast screen.
 *
 * Every forecast run starts from the same point. Each run records one status per phase
 * (for example "on track" / "at risk") and a final outcome. Runs that share the same path stay
 * on one line; the tree splits at the first phase where their statuses differ, and once more at the
 * end if they reach different outcomes.
 *
 * When there are more than maxLeaves endings, the latest split whose branches no longer split
 * is folded first (ties: the smaller split first). Early splits are kept, and a folded ending lists
 * how many runs reached each outcome.
 *
 * Ported and generalised from the author's own earlier simulator (TACTICA DSS, analysis/landing.ts).
 */

export interface RunPath {
  /** Run number, 1-based. */
  id: number;
  /** One status per phase, length = phases. */
  states: string[];
  /** Final outcome key. */
  final: string;
}

export interface BranchNode {
  /** Runs on this branch. */
  runs: number[];
  /** Phase where this branch begins (1 for the root). */
  from: number;
  /** Phase where this branch splits; phases + 1 means it splits on the final outcome or not at all. */
  split: number;
  /** Status (or outcome, when from = phases + 1) shared by this branch. Empty for the root. */
  label: string;
  /** Distinct final outcomes reached by runs on this branch, most common first. */
  finals: string[];
  /** Number of runs on this branch that reached each final outcome. */
  finalCounts: Record<string, number>;
  children: BranchNode[];
}

export const MAX_LEAVES = 7;

export interface BranchTreeOptions {
  maxLeaves?: number;
  /** Order of sibling branches (smaller first). Ties: more runs first. */
  order?: (label: string) => number;
}

export function buildBranchTree(paths: RunPath[], phases: number, opts: BranchTreeOptions = {}): BranchNode | null {
  if (!paths.length) return null;
  const maxLeaves = opts.maxLeaves ?? MAX_LEAVES;
  const order = opts.order ?? (() => 0);
  const byId = new Map(paths.map((p) => [p.id, p]));
  for (const p of paths) if (p.states.length < phases) throw new Error(`run ${p.id} has ${p.states.length} states, expected ${phases}`);
  const sig = (id: number, t: number) => (t <= phases ? byId.get(id)!.states[t - 1]! : byId.get(id)!.final);

  const build = (runs: number[], from: number, label: string, check: number): BranchNode => {
    const finalCounts: Record<string, number> = {};
    for (const id of runs) { const f = byId.get(id)!.final; finalCounts[f] = (finalCounts[f] ?? 0) + 1; }
    const finals = Object.keys(finalCounts).sort((a, b) => finalCounts[b]! - finalCounts[a]!);
    const node: BranchNode = { runs, from, split: phases + 1, label, finals, finalCounts, children: [] };
    for (let t = check; t <= phases + 1; t++) {
      const parts = new Map<string, number[]>();
      for (const id of runs) {
        const k = sig(id, t);
        parts.set(k, [...(parts.get(k) ?? []), id]);
      }
      if (parts.size > 1) {
        node.split = t;
        node.children = [...parts.entries()]
          .sort((a, b) => order(a[0]) - order(b[0]) || b[1].length - a[1].length)
          .map(([lab, rs]) => build(rs, t, lab, t + 1));
        return node;
      }
    }
    return node;
  };

  const tree = build(paths.map((p) => p.id).sort((a, b) => a - b), 1, '', 1);
  while (countLeaves(tree) > maxLeaves) {
    const foldable: BranchNode[] = [];
    const walk = (n: BranchNode) => {
      if (n.children.length && n.children.every((c) => !c.children.length)) foldable.push(n);
      n.children.forEach(walk);
    };
    walk(tree);
    const x = foldable.sort((a, b) => b.split - a.split || a.runs.length - b.runs.length)[0]!;
    x.children = [];
    x.split = phases + 1;
  }
  return tree;
}

export function countLeaves(n: BranchNode): number {
  return n.children.length ? n.children.reduce((a, c) => a + countLeaves(c), 0) : 1;
}

export function leavesOf(n: BranchNode): BranchNode[] {
  return n.children.length ? n.children.flatMap(leavesOf) : [n];
}
