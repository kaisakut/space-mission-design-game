import type { Mission, Outcome } from '../data/types';
import { buildBranchTree, type BranchNode } from './branchTree';
import { evaluate, type Picks } from './design';
import { Rng } from './rng';
import { OUTCOMES, RUN_STATUSES, simulate, type RunResult } from './simulate';

export interface Forecast {
  runs: RunResult[];
  tree: BranchNode | null;
  /** Share of runs that ended in full or partial success. */
  successShare: number;
  outcomeCounts: Record<Outcome, number>;
  /** Total score: 10th percentile, median, 90th percentile. */
  score: { p10: number; p50: number; p90: number };
  /** The causes seen most often in runs that did not fully succeed: [cause, share of all runs]. */
  topCauses: [string, number][];
}

/** Forecast streams never share numbers with the real game: each run has its own generator. */
export const forecastRng = (seed: number, turn: number, run: number) => new Rng(seed, `forecast:${turn}:${run}`);

/**
 * Runs the current design to the end `runs` times. Undecided slots use their standard choice.
 * The real game draws from other streams, so forecasting never changes what will actually happen.
 */
export function runForecast(m: Mission, picks: Picks, seed: number, turn: number, runs: number): Forecast {
  const d = evaluate(m, picks);
  const results: RunResult[] = [];
  for (let i = 1; i <= runs; i++) results.push(simulate(m, d, forecastRng(seed, turn, i)));

  const tree = buildBranchTree(
    results.map((r, i) => ({ id: i + 1, states: r.states, final: r.outcome })),
    5,
    { order: (label) => { const s = (RUN_STATUSES as string[]).indexOf(label); return s >= 0 ? s : (OUTCOMES as string[]).indexOf(label); } },
  );
  const outcomeCounts = Object.fromEntries(OUTCOMES.map((o) => [o, 0])) as Record<Outcome, number>;
  for (const r of results) outcomeCounts[r.outcome]++;
  const totals = results.map((r) => r.score.total).sort((a, b) => a - b);
  const pct = (p: number) => totals[Math.min(totals.length - 1, Math.max(0, Math.round((totals.length - 1) * p)))] ?? 0;

  const causeCount = new Map<string, number>();
  for (const r of results) {
    if (r.outcome === 'fullSuccess') continue;
    for (const c of new Set(r.causes)) causeCount.set(c, (causeCount.get(c) ?? 0) + 1);
  }
  const topCauses = [...causeCount.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([c, n]) => [c, n / runs] as [string, number]);

  return {
    runs: results,
    tree,
    successShare: (outcomeCounts.fullSuccess + outcomeCounts.partialSuccess) / runs,
    outcomeCounts,
    score: { p10: pct(0.1), p50: pct(0.5), p90: pct(0.9) },
    topCauses,
  };
}

/** Why a branch split off: the happening whose share differs most between this branch and its siblings. */
export interface BranchReason {
  /** A phaseLog entry. */
  key: string;
  /** True when the branch is marked by this happening; false when by its absence. */
  present: boolean;
  shareIn: number;
  shareOut: number;
}

/**
 * For every branch that splits off, finds the happening in the split phase that best tells it apart from
 * its sibling branches (largest difference in the share of runs where it happened).
 * Splits after phase 5 (on the outcome alone) are explained by phase 5 happenings.
 */
export function branchReasons(tree: BranchNode, runs: RunResult[], phases = 5): Map<BranchNode, BranchReason> {
  const out = new Map<BranchNode, BranchReason>();
  const walk = (n: BranchNode) => {
    if (n.children.length) {
      const p = Math.min(n.split, phases) - 1;
      const logOf = (id: number) => new Set(runs[id - 1]?.phaseLog[p] ?? []);
      const keys = new Set(n.runs.flatMap((id) => [...logOf(id)]));
      for (const ch of n.children) {
        const others = n.runs.filter((id) => !ch.runs.includes(id));
        // Prefer something that happened in this branch (unless an absence differs by much more); on ties prefer
        // failures, then damage, then missed chances, then successful protection.
        let best: (BranchReason & { rank: number }) | null = null;
        for (const key of keys) {
          const shareIn = ch.runs.filter((id) => logOf(id).has(key)).length / ch.runs.length;
          const shareOut = others.length ? others.filter((id) => logOf(id).has(key)).length / others.length : 0;
          if (shareIn === shareOut) continue;
          const present = shareIn > shareOut;
          const rank = Math.abs(shareIn - shareOut) + (present ? 0.25 : 0) + priority(key) * 0.01;
          if (!best || rank > best.rank) best = { key, present, shareIn, shareOut, rank };
        }
        if (best) out.set(ch, { key: best.key, present: best.present, shareIn: best.shareIn, shareOut: best.shareOut });
      }
    }
    n.children.forEach(walk);
  };
  walk(tree);
  return out;
}

const priority = (key: string) => {
  if (key.startsWith('fail:') || key === 'launchFailure' || key === 'earlyFailure' || key.startsWith('blocked:')) return 4;
  if (key.endsWith(':hit') || key.endsWith(':partial')) return 3;
  if (key.endsWith(':missed')) return 2;
  return 1;
};
