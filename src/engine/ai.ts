import type { Picks } from './design';
import { agencyForecast, pendingChanges, type Agency, type Game } from './game';

/**
 * Rule-based rival agencies. They use the same forecast as the player and the same options, so the AI
 * works for any mission without mission-specific rules:
 * - cautious: maximises the score a bad run still gets (10th percentile), and values a high success chance;
 * - bold: maximises the score of a good run (90th percentile).
 * For each slot of the current phase, in order, it tries every option and keeps the best one.
 * It does not reopen earlier decisions.
 */
const AI_RUNS = 40;

export function aiPicks(g: Game, a: Agency): Picks {
  const m = g.mission;
  const picks: Picks = { ...a.picks };
  for (const s of m.slots.filter((x) => x.phase === g.phase)) {
    // A multi-choice slot is tried as "none" or one option at a time, to keep the AI simple.
    const candidates = s.options.map((id) => [id]);
    let best: { ids: string[]; u: number } | null = null;
    for (const ids of candidates) {
      const trial = { ...picks, [s.id]: ids };
      const pend = pendingChanges(g, a, trial);
      const f = agencyForecast(g, a, trial, AI_RUNS, `ai:${a.id}:${s.id}:${ids.join('+')}`, pend);
      const u = a.id === 'cautious' ? f.score.p10 + 30 * f.successShare : f.score.p90 + 5 * f.successShare;
      if (!best || u > best.u + 1e-9) best = { ids, u };
    }
    picks[s.id] = best!.ids;
  }
  return picks;
}
