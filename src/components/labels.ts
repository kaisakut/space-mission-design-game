import type { Mission, Outcome } from '../data/types';
import { tk, useLang } from '../i18n';

/** Colours and names shared by the forecast, the branch map and the results. */
export const OUTCOME_COLOR: Record<Outcome, string> = {
  fullSuccess: '#4caf50',
  partialSuccess: '#9ccc65',
  objectiveMissed: '#ffb300',
  lostInOps: '#ff7043',
  orbitFailure: '#ef5350',
  launchFailure: '#c62828',
  noLaunch: '#78909c',
};

/** Outcome name, using the mission's own wording where it has one. */
export function useOutcomeName(mission: Mission) {
  const { t, L } = useLang();
  return (o: Outcome) => { const x = mission.outcomeLabels?.[o]; return x ? L(x) : tk(t, `outcome_${o}`); };
}

/** Readable name of a cause key from a run ('solar-flare', 'fail:cdh', 'blocked:overBudget', ...). */
export function useCauseName(mission: Mission) {
  const { t, L } = useLang();
  return (c: string) => {
    const card = mission.events.find((e) => e.id === c);
    if (card) return L(card.name);
    if (c.startsWith('fail:')) return tk(t, `cause_fail_${c.slice(5)}`);
    if (c.startsWith('warn:')) return tk(t, `cause_warn_${c.slice(5)}`);
    if (c.startsWith('blocked:')) { const k = `cause_blocked_${c.slice(8)}`; return tk(t, k) === k ? t.cause_blocked : tk(t, k); }
    // Launch and early failures use the mission's own wording when it has one (e.g. "landing failure").
    const own = c === 'launchFailure' ? mission.outcomeLabels?.launchFailure : c === 'earlyFailure' ? mission.outcomeLabels?.orbitFailure : undefined;
    if (own) return L(own);
    return tk(t, `cause_${c}`);
  };
}
