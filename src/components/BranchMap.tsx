import { useEffect, useRef } from 'react';
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
  /** Why a branch split off: a short title and a detail line. Without it, the label shows status and run count. */
  reasonOf?: (n: BranchNode) => { title: string; detail: string } | null;
  /** Figure only, for the small preview; the full view adds the legend and the table of reasons. */
  compact?: boolean;
  /** Changes when a new forecast is run: one dot per run then flows along its branch to its outcome. */
  flowKey?: number;
  /** Final outcome key of a run (run ids start at 1), for the colour a dot takes at the end. */
  finalOf?: (id: number) => string;
}

type Pt = [number, number];
const FLOW_MS = 1200;

/** One dot per run, moving along its branch and stacking up at its outcome; drawn once per new forecast. */
function FlowDots({ paths }: { paths: { pts: Pt[]; from: string; to: string }[] }) {
  const g = useRef<SVGGElement>(null);
  useEffect(() => {
    const dots = Array.from(g.current?.children ?? []) as SVGCircleElement[];
    const lens = paths.map((p) => p.pts.slice(1).reduce((a, q, i) => a + Math.hypot(q[0] - p.pts[i]![0], q[1] - p.pts[i]![1]), 0));
    const at = (p: Pt[], len: number, k: number): Pt => {
      let d = k * len;
      for (let i = 1; i < p.length; i++) {
        const s = Math.hypot(p[i]![0] - p[i - 1]![0], p[i]![1] - p[i - 1]![1]);
        if (d <= s || i === p.length - 1) { const u = s ? Math.min(1, d / s) : 1; return [p[i - 1]![0] + (p[i]![0] - p[i - 1]![0]) * u, p[i - 1]![1] + (p[i]![1] - p[i - 1]![1]) * u]; }
        d -= s;
      }
      return p[p.length - 1]!;
    };
    const start = performance.now();
    let raf = 0;
    const step = (now: number) => {
      const el = now - start;
      dots.forEach((c, i) => {
        // Staggered starts, so the dots read as a stream rather than one blob.
        const k = Math.max(0, Math.min(1, (el - (i % 25) * 12) / (FLOW_MS - 300)));
        const [x, y] = at(paths[i]!.pts, lens[i]!, 1 - (1 - k) ** 2);
        c.setAttribute('cx', String(x));
        c.setAttribute('cy', String(y));
        c.setAttribute('fill', k >= 1 ? paths[i]!.to : paths[i]!.from);
        c.setAttribute('opacity', el > FLOW_MS + 500 ? String(Math.max(0, 1 - (el - FLOW_MS - 500) / 400)) : '0.95');
      });
      if (el < FLOW_MS + 900) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [paths]);
  return <g ref={g} pointerEvents="none">{paths.map((p, i) => <circle key={i} r={2.6} cx={p.pts[0]![0]} cy={p.pts[0]![1]} fill={p.from} />)}</g>;
}

const BG_SPLIT = 'rgba(255, 183, 77, 0.06)';
const SPLIT = '#ffb74d';
const TEXT = '#e8ecf4';
const MUTED = '#8c9ab8';

export function BranchMap({ tree, phases, colorOf, nameOf, phaseName, finalOrder = [], reasonOf, compact = false, flowKey, finalOf }: BranchMapProps) {
  const { t } = useLang();

  const T = phases;
  const total = tree.runs.length || 1;
  // The compact map is drawn on a narrower canvas so its text stays readable in a side column.
  const W = compact ? 480 : 1200, LEFT = compact ? 44 : 74, FINAL = compact ? 190 : 200, TOP = compact ? 26 : 46, LANE = compact ? 56 : 84;
  // A split on the outcome alone sits between the last phase and the outcome boxes: keep room for it, or
  // on the narrow map its curve starts left of where the last phase's branch ends and the line folds back.
  const splitsOnOutcome = (n: BranchNode): boolean => (n.children.length > 0 && n.split > T) || n.children.some(splitsOnOutcome);
  const cols = T + (splitsOnOutcome(tree) ? 1 : 0);
  const colW = (W - LEFT - FINAL - 16) / cols;
  const xc = (p: number) => LEFT + (Math.min(p, T + 1) - 0.5) * colW;
  // Half the gap a split's curve spans; never more than a column allows, so lines never run backwards.
  const G = Math.min(26, colW * 0.4);
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

  // Each run's way through the map, for the flowing dots: along its branches, then into a stack at its outcome.
  const flowPaths = useRef<{ key: number; paths: { pts: Pt[]; from: string; to: string }[] } | null>(null);
  const reduce = typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  if (flowKey && !reduce && finalOf && flowPaths.current?.key !== flowKey) {
    const stack = new Map<BranchNode, number>();
    const paths: { pts: Pt[]; from: string; to: string }[] = [];
    for (const id of tree.runs) {
      const jitter = ((id * 37) % 11) - 5;
      const pts: Pt[] = [[LEFT - 8, ys.get(tree)! + jitter * 0.6]];
      let n = tree;
      while (n.children.length) {
        const y = ys.get(n)!;
        pts.push([xc(n.split) - G, y + jitter * 0.6]);
        const ch = n.children.find((c) => c.runs.includes(id))!;
        pts.push([xc(n.split) + G, ys.get(ch)! + jitter * 0.6]);
        n = ch;
      }
      const k = stack.get(n) ?? 0;
      stack.set(n, k + 1);
      pts.push([W - FINAL - 8 - (k % 8) * 6, ys.get(n)! + (Math.floor(k / 8) % 3 - 1) * 6]);
      paths.push({ pts, from: '#cfe6ff', to: colorOf(finalOf(id)) });
    }
    flowPaths.current = { key: flowKey, paths };
  }

  const figure = () => (
    <svg viewBox={`0 0 ${W} ${H}`} className="br-svg" role="img" aria-label={t.branchMapTitle}>
      {Array.from({ length: T }, (_, i) => i + 1).map((p) => (
        <g key={p}>
          {splits.has(p) && <rect x={xc(p) - colW / 2 + 2} y={TOP - 8} width={colW - 4} height={H - TOP + 4} fill={BG_SPLIT} rx={6} />}
          <text x={xc(p)} y={18} textAnchor="middle" fontSize="13" fontWeight={600} fill={TEXT}>{compact ? `${p}${splits.has(p) ? ' ◆' : ''}` : phaseName(p)}</text>
          {splits.has(p) && !compact && <text x={xc(p)} y={34} textAnchor="middle" fontSize="11" fill={SPLIT}>◆ {t.branchSplitsHere}</text>}
        </g>
      ))}
      <text x={W - FINAL / 2} y={18} textAnchor="middle" fontSize="13" fontWeight={600} fill={TEXT}>{t.branchOutcome}</text>
      {nodes.map((n, i) => {
        const y = ys.get(n)!;
        const c = colorOf(main(n));
        const x0 = n === tree ? LEFT - 8 : xc(n.from) + G;
        const x1 = n.children.length ? xc(n.split) - G : W - FINAL;
        return (
          <g key={i}>
            <line x1={x0} x2={x1} y1={y} y2={y} stroke={c} strokeWidth={sw(n)} strokeLinecap="round" strokeOpacity={n.children.length ? 0.55 : 0.9}>
              <title>{fmt(t.branchRuns, { n: n.runs.length })}</title>
            </line>
            {n.children.map((ch, j) => {
              const cy = ys.get(ch)!;
              const a = xc(n.split) - G, b = xc(n.split) + G;
              return <path key={j} d={`M${a},${y} C${(a + b) / 2},${y} ${(a + b) / 2},${cy} ${b},${cy}`} fill="none" stroke={colorOf(main(ch))} strokeWidth={sw(ch)} strokeOpacity={0.75} />;
            })}
            {n.children.length > 0 && <circle cx={xc(n.split) - G} cy={y} r={7} fill="#0b1020" stroke={SPLIT} strokeWidth={3} />}
            {n !== tree && n.from <= T && !compact && (() => {
              const r = reasonOf?.(n);
              const base = `${nameOf(n.label)} · ${fmt(t.branchRuns, { n: n.runs.length })}`;
              const x = xc(n.from) + 30;
              const room = (n.children.length ? xc(n.split) - 30 : W - FINAL - 8) - x;
              if (!r) return <text x={x} y={y - sw(n) / 2 - 6} fontSize="11" fill={MUTED}>{fit(base, room, 11)}</text>;
              const title = fit(r.title, room, 11.5);
              if (compact) return <g><title>{`${r.title}\n${r.detail}`}</title><text x={x} y={y - sw(n) / 2 - 6} fontSize="12" fill={TEXT}>{title}</text></g>;
              return (
                <g>
                  <title>{`${r.title}\n${r.detail}`}</title>
                  <text x={x} y={y - sw(n) / 2 - 18} fontSize="11.5" fill={TEXT}>{title}</text>
                  <text x={x} y={y - sw(n) / 2 - 5} fontSize="10" fill={MUTED}>{fit(`${r.detail} · ${base}`, room, 10)}</text>
                </g>
              );
            })()}
          </g>
        );
      })}
      <g>
        <rect x={6} y={ys.get(tree)! - 20} width={LEFT - 18} height={40} rx={6} fill="#141b30" stroke="#23304d" />
        <text x={6 + (LEFT - 18) / 2} y={ys.get(tree)! - 4} textAnchor="middle" fontSize="11" fontWeight={600} fill={TEXT}>{t.branchStart}</text>
        <text x={6 + (LEFT - 18) / 2} y={ys.get(tree)! + 11} textAnchor="middle" fontSize="11" fill={MUTED}>{fmt(t.branchRuns, { n: tree.runs.length })}</text>
      </g>
      {flowPaths.current && flowKey === flowPaths.current.key && <FlowDots key={flowKey} paths={flowPaths.current.paths} />}
      {leaves.map((n, i) => {
        const y = ys.get(n)!;
        return (
          <foreignObject key={i} x={W - FINAL + 4} y={y - LANE / 2 + 8} width={FINAL - 8} height={LANE - 16}>
            <div className="br-final" style={{ borderLeftColor: colorOf(main(n)) }} title={n.from > T ? reasonOf?.(n)?.detail : undefined}>
              <div className="br-title">{leafName(n)}</div>
              <div className="br-count"><b>{fmt(t.branchRuns, { n: n.runs.length })}</b> ({pct(n.runs.length)}%)</div>
              {n.from > T && reasonOf?.(n) && <div className="br-why">{reasonOf(n)!.title}</div>}
            </div>
          </foreignObject>
        );
      })}
    </svg>
  );

  if (compact) return <div className="branchmap compact">{figure()}</div>;
  return (
    <div className="branchmap">
      {figure()}
      <p className="note">{t.branchLegend}</p>
      {reasonOf && (
        <table className="br-table">
          <thead><tr><th>{t.branchWhere}</th><th>{t.branchTo}</th><th>{t.branchWhy}</th></tr></thead>
          <tbody>
            {nodes.filter((x) => x.children.length).sort((a, b) => a.split - b.split).flatMap((x) => x.children.map((ch, j) => {
              const r = reasonOf(ch);
              return (
                <tr key={`${x.split}-${x.runs[0]}-${j}`}>
                  {j === 0 && <td rowSpan={x.children.length}>{x.split > T ? t.branchOutcome : phaseName(x.split)}</td>}
                  <td><span className="swatch" style={{ background: colorOf(main(ch)) }} />{nameOf(ch.label)} <small>{fmt(t.branchRuns, { n: ch.runs.length })}</small></td>
                  <td>{r ? <>{r.title} <small>{r.detail}</small></> : '—'}</td>
                </tr>
              );
            }))}
          </tbody>
        </table>
      )}
    </div>
  );
}

/** Shorten a label to fit a width in pixels (wide characters such as Japanese count about one font size each). */
function fit(text: string, px: number, fontSize: number): string {
  let w = 0;
  for (let i = 0; i < text.length; i++) {
    w += text.charCodeAt(i) > 0x2e80 ? fontSize : fontSize * 0.58;
    if (w > px) return `${text.slice(0, Math.max(1, i - 1))}…`;
  }
  return text;
}
