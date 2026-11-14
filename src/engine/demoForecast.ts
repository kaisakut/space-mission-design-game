import { Rng } from './rng';
import type { RunPath } from './branchTree';

/**
 * Placeholder model used only to exercise the forecast screen until the real mission model exists.
 * Each run carries a "mission health" from 1.0; every phase it may take a hit. Phase 4 is the launch,
 * where a small chance of loss ends the run. The numbers are illustrative, not from any source.
 */
export const DEMO_PHASES = 5;
export const DEMO_STATES = ['nominal', 'atRisk', 'critical', 'lost'] as const;
export const DEMO_FINALS = ['success', 'partial', 'failure'] as const;

export function demoForecast(seed: number, runs: number, margin: number): RunPath[] {
  const out: RunPath[] = [];
  for (let i = 1; i <= runs; i++) {
    // One generator per run, derived from the seed and run number: run i is the same whatever the run count.
    const rng = new Rng(seed, `forecast:${i}`);
    let health = 1;
    let lost = false;
    const states: string[] = [];
    for (let p = 1; p <= DEMO_PHASES; p++) {
      if (!lost) {
        if (rng.chance(0.35 - 0.25 * margin)) health -= rng.range(0.1, 0.4);
        if (p === 4 && rng.chance(0.06)) lost = true;
      }
      states.push(lost ? 'lost' : health > 0.75 ? 'nominal' : health > 0.45 ? 'atRisk' : 'critical');
    }
    const final = lost || health <= 0.3 ? 'failure' : health > 0.6 ? 'success' : 'partial';
    out.push({ id: i, states, final });
  }
  return out;
}
