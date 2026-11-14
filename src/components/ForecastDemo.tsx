import { useMemo, useState } from 'react';
import { BranchMap } from './BranchMap';
import { buildBranchTree } from '../engine/branchTree';
import { DEMO_FINALS, DEMO_PHASES, DEMO_STATES, demoForecast } from '../engine/demoForecast';
import { fmt, tk, useLang } from '../i18n';

const FINAL_COLOR: Record<string, string> = { success: '#4caf50', partial: '#ffb300', failure: '#ef5350' };
const order = (label: string) => {
  const i = (DEMO_STATES as readonly string[]).indexOf(label);
  return i >= 0 ? i : (DEMO_FINALS as readonly string[]).indexOf(label);
};

/** Temporary screen that runs the placeholder model and shows its branch map. */
export function ForecastDemo() {
  const { t } = useLang();
  const [runs, setRuns] = useState(50);
  const [seed, setSeed] = useState(2026);
  const [margin, setMargin] = useState(0.5);
  const [params, setParams] = useState({ runs, seed, margin });
  const tree = useMemo(
    () => buildBranchTree(demoForecast(params.seed, params.runs, params.margin), DEMO_PHASES, { order }),
    [params],
  );
  const nameOf = (k: string) => tk(t, (DEMO_STATES as readonly string[]).includes(k) ? `state_${k}` : `final_${k}`);

  return (
    <section className="panel">
      <h2>{t.demoTitle}</h2>
      <p className="note">{t.demoNote}</p>
      <div className="controls">
        <label>{t.demoRuns}
          <input type="number" min={20} max={100} value={runs} onChange={(e) => setRuns(Math.max(20, Math.min(100, Number(e.target.value) || 20)))} />
        </label>
        <label>{t.demoSeed}
          <input type="number" value={seed} onChange={(e) => setSeed(Number(e.target.value) || 0)} />
        </label>
        <label>{t.demoMargin} {margin.toFixed(2)}
          <input type="range" min={0} max={1} step={0.05} value={margin} onChange={(e) => setMargin(Number(e.target.value))} />
        </label>
        <button type="button" className="primary" onClick={() => setParams({ runs, seed, margin })}>{t.demoRun}</button>
      </div>
      {tree && (
        <BranchMap
          tree={tree}
          phases={DEMO_PHASES}
          colorOf={(k) => FINAL_COLOR[k] ?? '#9aa5b1'}
          nameOf={nameOf}
          phaseName={(p) => fmt(t.phaseN, { n: p })}
          finalOrder={[...DEMO_FINALS]}
        />
      )}
    </section>
  );
}
