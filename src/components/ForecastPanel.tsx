import { useState } from 'react';
import type { Mission, Outcome } from '../data/types';
import { branchReasons, type Forecast } from '../engine/forecast';
import type { BranchNode } from '../engine/branchTree';
import { OUTCOMES } from '../engine/simulate';
import { fmt, tk, useLang } from '../i18n';
import { BranchMap } from './BranchMap';

export const OUTCOME_COLOR: Record<Outcome, string> = {
  fullSuccess: '#4caf50',
  partialSuccess: '#9ccc65',
  objectiveMissed: '#ffb300',
  lostInOps: '#ff7043',
  orbitFailure: '#ef5350',
  launchFailure: '#c62828',
  noLaunch: '#78909c',
};

const RUN_CHOICES = [20, 50, 100];

/** Readable name of a cause key from a run ('solar-flare', 'fail:cdh', 'blocked:overBudget', ...). */
export function useCauseName(mission: Mission) {
  const { t, L } = useLang();
  return (c: string) => {
    const card = mission.events.find((e) => e.id === c);
    if (card) return L(card.name);
    if (c.startsWith('fail:')) return tk(t, `cause_fail_${c.slice(5)}`);
    if (c.startsWith('warn:')) return tk(t, `cause_warn_${c.slice(5)}`);
    if (c.startsWith('blocked:')) { const k = `cause_blocked_${c.slice(8)}`; return tk(t, k) === k ? t.cause_blocked : tk(t, k); }
    return tk(t, `cause_${c}`);
  };
}

/**
 * Forecast: run the current design to the end many times and show where it tends to end up.
 * `run` returns null when no forecast is left this turn; `left` is shown next to the button.
 */
export function ForecastPanel({ mission, designKey, run, left }: {
  mission: Mission; designKey: string; run: (runs: number) => Forecast | null; left: number | null;
}) {
  const { t, L } = useLang();
  const [runs, setRuns] = useState(50);
  const [result, setResult] = useState<{ f: Forecast; picks: string } | null>(null);
  const key = designKey;
  const stale = result !== null && result.picks !== key;

  const causeName = useCauseName(mission);
  const happening = (key: string) => {
    const [id, result] = key.split(':');
    const card = mission.events.find((e) => e.id === id);
    if (card && result) return fmt(tk(t, `reason_${result}`), { name: L(card.name) });
    return causeName(key);
  };
  const reasons = result?.f.tree ? branchReasons(result.f.tree, result.f.runs) : new Map();
  const reasonOf = (n: BranchNode) => {
    const r = reasons.get(n);
    if (!r) return null;
    const what = happening(r.key);
    return {
      title: r.present ? what : fmt(r.shareIn === 0 ? t.reason_absent : t.reason_less, { x: what }),
      detail: fmt(t.reason_share, { a: Math.round(r.shareIn * 100), b: Math.round(r.shareOut * 100) }),
    };
  };
  const nameOf = (k: string) => (OUTCOMES as string[]).includes(k) ? tk(t, `outcome_${k}`) : tk(t, `state_${k}`);

  return (
    <section className="panel forecast">
      <h2>{t.forecastTitle}</h2>
      <p className="note">{t.forecastNote}</p>
      <div className="controls">
        <label>{t.runsLabel}
          <select value={runs} onChange={(e) => setRuns(Number(e.target.value))}>
            {RUN_CHOICES.map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </label>
        <button type="button" className="primary" disabled={left === 0} onClick={() => { const f = run(runs); if (f) setResult({ f, picks: key }); }}>
          {fmt(t.runForecast, { n: runs })}
        </button>
        {left !== null && <span className="note">{left > 0 ? fmt(t.forecastLeft, { n: left }) : t.forecastNoneLeft}</span>}
        {stale && <span className="warn">{t.forecastStale}</span>}
      </div>
      {result && (
        <>
          <div className="summary">
            <div className="big"><span>{t.successChance}</span><b>{Math.round(result.f.successShare * 100)}%</b></div>
            <div className="big"><span>{t.scoreRange}</span><b>{result.f.score.p50}</b><small>{fmt(t.scoreRangeNote, { lo: result.f.score.p10, hi: result.f.score.p90 })}</small></div>
            <div className="causes">
              <span>{t.topCauses}</span>
              {result.f.topCauses.length === 0 ? <p className="ok">{t.noCauses}</p> : (
                <ol>{result.f.topCauses.map(([c, share]) => <li key={c}>{causeName(c)} <small>{fmt(t.causeShare, { n: Math.round(share * 100) })}</small></li>)}</ol>
              )}
            </div>
          </div>
          {result.f.tree && (
            <BranchMap
              tree={result.f.tree}
              phases={5}
              colorOf={(k) => OUTCOME_COLOR[k as Outcome] ?? '#9aa5b1'}
              nameOf={nameOf}
              phaseName={(p) => fmt(t.phaseTab, { n: p, name: tk(t, `phase${p}`) })}
              finalOrder={[...OUTCOMES]}
              reasonOf={reasonOf}
            />
          )}
        </>
      )}
    </section>
  );
}
