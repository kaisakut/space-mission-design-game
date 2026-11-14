import { useState } from 'react';
import type { Mission, Outcome } from '../data/types';
import { branchReasons, type Forecast } from '../engine/forecast';
import type { BranchNode } from '../engine/branchTree';
import { OUTCOMES } from '../engine/simulate';
import { fmt, tk, useLang } from '../i18n';
import { BranchMap } from './BranchMap';
import { OUTCOME_COLOR, useCauseName, useOutcomeName } from './labels';
import { Term } from './Glossary';
import { Modal } from './Modal';

/** Runs per forecast: enough for stable percentages, and still instant in the browser. */
const RUNS = 100;

/**
 * Forecast: run the current design to the end many times and show where it tends to end up.
 * `run` returns null when no forecast is left this turn; `left` is shown next to the button.
 */
export function ForecastPanel({ mission, designKey, run, left }: {
  mission: Mission; designKey: string; run: (runs: number) => Forecast | null; left: number | null;
}) {
  const { t, L } = useLang();
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
  const outcomeName = useOutcomeName(mission);
  const nameOf = (k: string) => (OUTCOMES as string[]).includes(k) ? outcomeName(k as Outcome) : tk(t, `state_${k}`);

  const [full, setFull] = useState(false);
  const map = (compact: boolean) => result?.f.tree && (
    <BranchMap
      tree={result.f.tree}
      phases={5}
      colorOf={(k) => OUTCOME_COLOR[k as Outcome] ?? '#9aa5b1'}
      nameOf={nameOf}
      phaseName={(p) => fmt(t.phaseTab, { n: p, name: tk(t, `phase${p}`) })}
      finalOrder={[...OUTCOMES]}
      reasonOf={reasonOf}
      compact={compact}
    />
  );
  const summary = result && (
    <div className="summary">
      <div className="big"><span>{t.successChance}</span><b>{Math.round(result.f.successShare * 100)}%</b></div>
      <div className="big"><span><Term k="median">{t.scoreRange}</Term></span><b>{result.f.score.p50}</b><small><Term k="percentile">{fmt(t.scoreRangeNote, { lo: result.f.score.p10, hi: result.f.score.p90 })}</Term></small></div>
      <div className="causes">
        <span>{t.topCauses}</span>
        {result.f.topCauses.length === 0 ? <p className="ok">{t.noCauses}</p> : (
          <ol>{result.f.topCauses.slice(0, 3).map(([c, share]) => <li key={c}>{causeName(c)} <small>{fmt(t.causeShare, { n: Math.round(share * 100) })}</small></li>)}</ol>
        )}
      </div>
    </div>
  );

  return (
    <section className="card forecast">
      <div className="card-head">
        <h2><Term k="forecast">{t.forecastTitle}</Term></h2>
        <button type="button" className="primary" disabled={left === 0} title={t.forecastNote} onClick={() => { const f = run(RUNS); if (f) setResult({ f, picks: key }); }}>
          {fmt(t.runForecast, { n: RUNS })}
        </button>
      </div>
      <div className="card-sub">
        {left !== null && <span className="note">{left > 0 ? fmt(t.forecastLeft, { n: left }) : t.forecastNoneLeft}</span>}
        {stale && <span className="warn">{t.forecastStale}</span>}
      </div>
      {!result && <p className="note">{t.forecastEmpty}</p>}
      {summary}
      {result?.f.tree && (
        <button type="button" className="map-preview" title={t.openFull} onClick={() => setFull(true)}>
          {map(true)}
          <span className="expand">⤢ {t.openFull}</span>
        </button>
      )}
      {full && result && (
        <Modal title={t.forecastTitle} wide onClose={() => setFull(false)}>
          {stale && <p className="warn">{t.forecastStale}</p>}
          {summary}
          {map(false)}
        </Modal>
      )}
    </section>
  );
}
