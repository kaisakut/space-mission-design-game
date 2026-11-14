import { useEffect, useState } from 'react';
import { leavesOf, type BranchNode } from '../engine/branchTree';
import { fmt, useLang } from '../i18n';

/**
 * Forecast branch map: phases run left to right, runs split where their status first differs,
 * and the right edge shows where they ended up. Line thickness = share of runs, colour = outcome
 * (a branch that has not split yet takes the colour of its most common outcome).
 *
 * Ported and adapted from the author's own earlier simulator (TACTICA DSS, AnalysisPage BranchMap).
 */
export interface BranchMapProps {
  tree: BranchNode;
  phases: number;
  /** Colour of a final outcome key. */
  colorOf: (finalKey: string) => string;
  /** Display name of a phase status or a final outcome key. */
  nameOf: (key: string) => string;
  /** Display name of phase t (1-based). */
  phaseName: (t: number) => string;
  /** Outcomes shown last (for example failures), in this order. */
  finalOrder?: string[];
}

const BG_SPLIT = 'rgba(255, 183, 77, 0.06)';
const SPLIT = '#ffb74d';
const TEXT = '#e8ecf4';
const MUTED = '#8c9ab8';

export function BranchMap({ tree, phases, colorOf, nameOf, phaseName, finalOrder = [] }: BranchMapProps) {
  const { t } = useLang();
  const [zoom, setZoom] = useState(false);
  useEffect(() => {
    if (!zoom) return;
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') setZoom(false); };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [zoom]);

  const T = phases;
  const total = tree.runs.length || 1;
  const W = 1000, LEFT = 74, FINAL = 210, TOP = 46, LANE = 78;
  const colW = (W - LEFT - FINAL - 16) / T;
  const xc = (p: number) => (p > T ? W - FINAL - 26 : LEFT + (p - 0.5) * colW);
  const leaves = leavesOf(tree);
  const ys = new Map<BranchNode, number>();
  const place = (n: BranchNode): number => {
    const y = n.children.length
      ? n.children.map(place).reduce((a, b) => a + b, 0) / n.children.length
      : TOP + leaves.indexOf(n) * LANE + LANE / 2;
    ys.set(n, y);
    return y;
  };
  place(tree);
  const H = Math.max(TOP + leaves.length * LANE + 10, TOP + 100);

  const main = (n: BranchNode) => n.finals[0]!;
  const sw = (n: BranchNode) => 4 + 20 * (n.runs.length / total);
  const nodes: BranchNode[] = [];
  const splits = new Set<number>();
  const collect = (n: BranchNode) => { nodes.push(n); if (n.children.length && n.split <= T) splits.add(n.split); n.children.forEach(collect); };
  collect(tree);
  const pct = (k: number) => Math.round((k / total) * 100);
  const leafName = (n: BranchNode) => {
    if (n.finals.length <= 1) return nameOf(n.finals[0] ?? '');
    const sorted = [...n.finals].sort((a, b) => {
      const ia = finalOrder.indexOf(a), ib = finalOrder.indexOf(b);
      return ia - ib || n.finalCounts[b]! - n.finalCounts[a]!;
    });
    return sorted.map((k) => `${nameOf(k)} ${n.finalCounts[k]}`).join(' / ');
  };

  const figure = (big: boolean) => (
    <svg viewBox={`0 0 ${W} ${H}`} style={big ? { width: Math.max(W * 1.35, 1300) } : { width: '100%' }} role="img" aria-label={t.branchMapTitle}>
      {Array.from({ length: T }, (_, i) => i + 1).map((p) => (
        <g key={p}>
          {splits.has(p) && <rect x={xc(p) - colW / 2 + 2} y={TOP - 8} width={colW - 4} height={H - TOP + 4} fill={BG_SPLIT} rx={6} />}
          <text x={xc(p)} y={18} textAnchor="middle" fontSize="13" fontWeight={600} fill={TEXT}>{phaseName(p)}</text>
          {splits.has(p) && <text x={xc(p)} y={34} textAnchor="middle" fontSize="11" fill={SPLIT}>◆ {t.branchSplitsHere}</text>}
        </g>
      ))}
      <text x={W - FINAL / 2} y={18} textAnchor="middle" fontSize="13" fontWeight={600} fill={TEXT}>{t.branchOutcome}</text>
      {nodes.map((n, i) => {
        const y = ys.get(n)!;
        const c = colorOf(main(n));
        const x0 = n === tree ? LEFT - 8 : xc(n.from) + 26;
        const x1 = n.children.length ? xc(n.split) - 26 : W - FINAL;
        return (
          <g key={i}>
            <line x1={x0} x2={x1} y1={y} y2={y} stroke={c} strokeWidth={sw(n)} strokeLinecap="round" strokeOpacity={n.children.length ? 0.55 : 0.9}>
              <title>{fmt(t.branchRuns, { n: n.runs.length })}</title>
            </line>
            {n.children.map((ch, j) => {
              const cy = ys.get(ch)!;
              const a = xc(n.split) - 26, b = xc(n.split) + 26;
              return <path key={j} d={`M${a},${y} C${(a + b) / 2},${y} ${(a + b) / 2},${cy} ${b},${cy}`} fill="none" stroke={colorOf(main(ch))} strokeWidth={sw(ch)} strokeOpacity={0.75} />;
            })}
            {n.children.length > 0 && <circle cx={xc(n.split) - 26} cy={y} r={7} fill="#0b1020" stroke={SPLIT} strokeWidth={3} />}
            {n !== tree && n.from <= T && (
              <text x={xc(n.from) + 30} y={y - sw(n) / 2 - 6} fontSize="11" fill={MUTED}>
                {nameOf(n.label)} · {fmt(t.branchRuns, { n: n.runs.length })}
              </text>
            )}
          </g>
        );
      })}
      <g>
        <rect x={6} y={ys.get(tree)! - 20} width={LEFT - 18} height={40} rx={6} fill="#141b30" stroke="#23304d" />
        <text x={6 + (LEFT - 18) / 2} y={ys.get(tree)! - 4} textAnchor="middle" fontSize="11" fontWeight={600} fill={TEXT}>{t.branchStart}</text>
        <text x={6 + (LEFT - 18) / 2} y={ys.get(tree)! + 11} textAnchor="middle" fontSize="11" fill={MUTED}>{fmt(t.branchRuns, { n: tree.runs.length })}</text>
      </g>
      {leaves.map((n, i) => {
        const y = ys.get(n)!;
        return (
          <foreignObject key={i} x={W - FINAL + 4} y={y - LANE / 2 + 8} width={FINAL - 8} height={LANE - 16}>
            <div className="br-final" style={{ borderLeftColor: colorOf(main(n)) }}>
              <div className="br-title">{leafName(n)}</div>
              <div className="br-count"><b>{fmt(t.branchRuns, { n: n.runs.length })}</b> ({pct(n.runs.length)}%)</div>
            </div>
          </foreignObject>
        );
      })}
    </svg>
  );

  return (
    <div className="branchmap">
      <div className="br-figure" onClick={() => setZoom(true)} title={t.branchZoom}>
        {figure(false)}
      </div>
      {zoom && (
        <div className="br-overlay" onClick={() => setZoom(false)}>
          <div className="br-overlay-bar">
            <b>{t.branchMapTitle}</b>
            <button type="button" onClick={() => setZoom(false)}>{t.close}</button>
          </div>
          <div className="br-overlay-body" onClick={(e) => e.stopPropagation()}>{figure(true)}</div>
        </div>
      )}
      <p className="note">{t.branchLegend}</p>
    </div>
  );
}
