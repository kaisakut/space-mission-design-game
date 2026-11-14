import { useEffect, useState } from 'react';
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
export const RUNS = 100;

const reduceMotion = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/** A number that counts up to its value (0.6 s), or appears at once when the player prefers less motion. */
export function CountUp({ value, suffix = '' }: { value: number; suffix?: string }) {
  const [shown, setShown] = useState(value);
  useEffect(() => {
    if (reduceMotion()) { setShown(value); return; }
    const start = performance.now();
    let raf = 0;
    const step = (now: number) => {
      const k = Math.min(1, (now - start) / 600);
      setShown(Math.round(value * (1 - (1 - k) ** 3)));
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value]);
  return <>{shown}{suffix}</>;
}

/** Success chance as a ring. */
function Ring({ share, label, faint = false }: { share: number; label: string; faint?: boolean }) {
  const r = 26, c = 2 * Math.PI * r;
  const color = faint ? '#6b7891' : share >= 0.7 ? 'var(--good)' : share >= 0.4 ? 'var(--warn)' : 'var(--bad)';
  return (
    <div className={`ring ${faint ? 'faint' : ''}`}>
      <svg viewBox="0 0 64 64" aria-hidden="true">
        <circle cx="32" cy="32" r={r} fill="none" stroke="#1b2540" strokeWidth="7" />
        <circle cx="32" cy="32" r={r} fill="none" stroke={color} strokeWidth="7" strokeDasharray={`${c * share} ${c}`} transform="rotate(-90 32 32)" strokeLinecap="round" />
      </svg>
      <b><CountUp value={Math.round(share * 100)} suffix="%" /></b>
      <span>{label}</span>
    </div>
  );
}

/** Score spread as one bar from the 10th to the 90th percentile, with the median as a dot. */
function ScoreBar({ rows }: { rows: { label: string; s: Forecast['score']; faint?: boolean }[] }) {
  const x = (v: number) => 8 + (v / 100) * 284;
  return (
    <svg viewBox={`0 0 300 ${14 + rows.length * 22}`} className="scorebar" role="img">
      {[0, 25, 50, 75, 100].map((v) => <g key={v}><line x1={x(v)} x2={x(v)} y1={4} y2={8 + rows.length * 22} stroke="#23304d" /><text x={x(v)} y={14 + rows.length * 22} fontSize="9" fill="#8c9ab8" textAnchor="middle">{v}</text></g>)}
      {rows.map((r, i) => {
        const y = 14 + i * 22;
        const col = r.faint ? '#6b7891' : '#7fd1ff';
        return (
          <g key={i}>
            <title>{`${r.label}: ${r.s.p10} – ${r.s.p50} – ${r.s.p90}`}</title>
            <line x1={x(r.s.p10)} x2={x(r.s.p90)} y1={y} y2={y} stroke={col} strokeWidth={r.faint ? 5 : 7} strokeLinecap="round" opacity={r.faint ? 0.6 : 0.9} />
            <circle cx={x(r.s.p50)} cy={y} r={r.faint ? 4 : 5.5} fill="#0b1020" stroke={col} strokeWidth="2.5" />
            <text x={x(r.s.p10) - 4} y={y + 3.5} fontSize="9" fill="#b8c3da" textAnchor="end">{r.s.p10}</text>
            <text x={x(r.s.p90) + 4} y={y + 3.5} fontSize="9" fill="#b8c3da">{r.s.p90}</text>
          </g>
        );
      })}
    </svg>
  );
}

/**
 * Forecast column: the free baseline (confirmed design plus standard choices) and, once run, the player's
 * own forecast beside it. The branch map is readable here; clicking it opens the full map and its reasons.
 */
export function ForecastPanel({ mission, baseline, mine, stale, left }: {
  mission: Mission; baseline: Forecast; mine: Forecast | null; stale: boolean; left: number | null;
}) {
  const { t, L } = useLang();
  const [full, setFull] = useState(false);
  const shown = mine ?? baseline;
  const causeName = useCauseName(mission);
  const outcomeName = useOutcomeName(mission);

  const happening = (key: string, present: boolean) => {
    const [id, result] = key.split(':');
    const card = mission.events.find((e) => e.id === id);
    if (card && result) return fmt(tk(t, present ? `reason_${result}` : `reason_not_${result}`), { name: L(card.name) });
    return causeName(key);
  };
  const reasons = shown.tree ? branchReasons(shown.tree, shown.runs) : new Map();
  const reasonOf = (n: BranchNode) => {
    const r = reasons.get(n);
    if (!r) return null;
    return {
      title: r.present || r.shareIn === 0 ? happening(r.key, r.present) : fmt(t.reason_less, { x: happening(r.key, true) }),
      detail: fmt(t.reason_share, { a: Math.round(r.shareIn * 100), b: Math.round(r.shareOut * 100) }),
    };
  };
  const nameOf = (k: string) => (OUTCOMES as string[]).includes(k) ? outcomeName(k as Outcome) : tk(t, `state_${k}`);
  const map = (compact: boolean) => shown.tree && (
    <BranchMap
      tree={shown.tree}
      phases={5}
      colorOf={(k) => OUTCOME_COLOR[k as Outcome] ?? '#9aa5b1'}
      nameOf={nameOf}
      phaseName={(p) => fmt(t.phaseTab, { n: p, name: tk(t, `phase${p}`) })}
      finalOrder={[...OUTCOMES]}
      reasonOf={reasonOf}
      compact={compact}
    />
  );
  const baseShare = new Map(baseline.topCauses);
  const delta = mine ? Math.round((mine.successShare - baseline.successShare) * 100) : 0;
  const summary = (
    <>
      <div className="rings">
        <Ring share={baseline.successShare} label={t.baselineLabel} faint={!!mine} />
        {mine && <><span className="ring-arrow">→</span><Ring share={mine.successShare} label={t.yourDesign} /><b className={`ring-delta ${delta > 0 ? 'ok' : delta < 0 ? 'bad' : ''}`}>{delta > 0 ? '+' : ''}{fmt(t.deltaPts, { d: delta })}</b></>}
      </div>
      <div className="fc-sub"><Term k="percentile">{t.scoreBar}</Term></div>
      <ScoreBar rows={[{ label: t.baselineLabel, s: baseline.score, faint: !!mine }, ...(mine ? [{ label: t.yourDesign, s: mine.score }] : [])]} />
      <div className="fc-sub">{t.topCauses}</div>
      {shown.topCauses.length === 0 ? <p className="ok small">{t.noCauses}</p> : (
        <ul className="causes-bars">
          {shown.topCauses.slice(0, 3).map(([c, share]) => {
            const before = baseShare.get(c) ?? 0;
            return (
              <li key={c}>
                <span className="cb-name">{causeName(c)}</span>
                <span className="cb-bar"><span style={{ width: `${Math.min(100, share * 200)}%` }} /></span>
                <span className="cb-val">{Math.round(share * 100)}%{mine && share < before - 0.02 ? <span className="ok"> ↓</span> : mine && share > before + 0.02 ? <span className="bad"> ↑</span> : null}</span>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );

  return (
    <section className="card forecast">
      <div className="card-head">
        <h2><Term k="forecast">{t.forecastTitle}</Term></h2>
        {left !== null && <span className="note small">{left > 0 ? fmt(t.forecastLeft, { n: left }) : t.forecastNoneLeft}</span>}
      </div>
      <p className="note small" title={t.forecastNote}>{mine ? (stale ? <span className="warn">{t.forecastStale}</span> : t.forecastNote) : t.baselineNote}</p>
      <div className={stale ? 'is-stale' : ''}>{summary}</div>
      {shown.tree && (
        <button type="button" className="map-preview" title={t.openFull} onClick={() => setFull(true)}>
          {map(true)}
          <span className="expand">⤢ {t.openFull}</span>
        </button>
      )}
      {full && (
        <Modal title={t.forecastTitle} wide onClose={() => setFull(false)}>
          {stale && <p className="warn">{t.forecastStale}</p>}
          <div className="modal-summary">{summary}</div>
          {map(false)}
        </Modal>
      )}
    </section>
  );
}
