import type { Picks } from './design';
import { agencyForecast, pendingChanges, type Agency, type Game } from './game';

/**
 * Rule-based rival agencies. They use the same forecast as the player and the same options, so the AI
 * works for any mission without mission-specific rules:
 * - cautious: maximises the score a bad run still gets (10th percentile), and values a high success chance;
 * - balanced: maximises the typical score (median);
 * - bold: maximises the score of a good run (90th percentile).
 * For each slot of the current phase, in order, it tries every option and keeps the best one
 * (for instrument slots that take several, it keeps adding the most useful one while that helps).
 * It does not reopen earlier decisions.
 */
const AI_RUNS = 100;

export function aiPicks(g: Game, a: Agency): Picks {
  const m = g.mission;
  const picks: Picks = { ...a.picks };
  for (const s of m.slots.filter((x) => x.phase === g.phase)) {
    const utility = (ids: string[]) => {
      const trial = { ...picks, [s.id]: ids };
      const pend = pendingChanges(g, a, trial);
      // Every option of a slot is judged on the same random stream, so the comparison is fair.
      const f = agencyForecast(g, a, trial, AI_RUNS, `ai:${a.id}:${s.id}`, pend);
      return a.id === 'cautious' ? f.score.p10 + 30 * f.successShare : a.id === 'balanced' ? f.score.p50 + 10 * f.successShare : f.score.p90 + 5 * f.successShare;
    };
    // First the best single option; then, in a multi-choice slot of instruments (no "none" option),
    // keep adding the option that helps most while it helps and the slot allows more.
    let best: { ids: string[]; u: number } | null = null;
    for (const id of s.options) { const u = utility([id]); if (!best || u > best.u + 1e-9) best = { ids: [id], u }; }
    if (s.multi && !s.multi.noneFirst) {
      while (best!.ids.length < s.multi.max) {
        let step: { ids: string[]; u: number } | null = null;
        for (const id of s.options.filter((x) => !best!.ids.includes(x))) {
          const ids = [...best!.ids, id];
          const u = utility(ids);
          if (u > best!.u + 0.5 && (!step || u > step.u)) step = { ids, u };
        }
        if (!step) break;
        best = step;
      }
    }
    picks[s.id] = best!.ids;
  }
  return picks;
}
