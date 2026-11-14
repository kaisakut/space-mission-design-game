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
