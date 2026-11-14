import { useState } from 'react';
import type { Resource } from '../data/types';
import { RESOURCES } from '../data/types';
import { LOW_MARGIN, type Gauge } from '../engine/design';
import { fmt, tk, useLang } from '../i18n';
import { Modal } from './Modal';

const UNIT_KEY: Record<string, string> = { kg: 'unit_kg', W: 'unit_W', kUSD: 'unit_kUSD', 'MB/day': 'unit_MBday', days: 'unit_days' };

export const gaugeColor = (margin: number, soft = false) => (margin < 0 ? (soft ? 'var(--warn)' : 'var(--bad)') : margin < LOW_MARGIN ? 'var(--warn)' : 'var(--good)');

const fmtNum = (x: number) => (Math.abs(x) >= 100 ? Math.round(x).toLocaleString() : Math.abs(x) >= 10 ? x.toFixed(1) : x.toFixed(2));

/** The five resource gauges: one row each, same look, used / available and the margin. */
export function Gauges({ gauges, flash = [] }: { gauges: Record<Resource, Gauge>; flash?: Resource[] }) {
  const { t } = useLang();
  const [help, setHelp] = useState<Resource | null>(null);
  return (
    <div className="gauges" aria-label={t.gaugesTitle}>
      {RESOURCES.map((r) => {
        const g = gauges[r];
        const share = g.available > 0 ? Math.min(g.used / g.available, 1.5) : g.used > 0 ? 1.5 : 0;
        const color = gaugeColor(g.margin, g.softLimit);
        const unit = tk(t, UNIT_KEY[g.unit] ?? g.unit);
        return (
          <div key={r} className={`gauge ${flash.includes(r) ? 'flash' : ''}`}>
            <div className="gauge-head">
              <span className="gauge-name">{tk(t, `res_${r}`)} <button type="button" className="info-btn" aria-label={t.gaugeInfo} title={t.gaugeInfo} onClick={() => setHelp(r)}>i</button></span>
              <span className="gauge-val">{fmtNum(g.used)} / {fmtNum(g.available)} {unit}</span>
            </div>
            <div className="gauge-bar">
              <div className="gauge-fill" style={{ width: `${(Math.min(share, 1) * 100).toFixed(1)}%`, background: color }} />
              {share > 1 && <div className="gauge-over" style={{ width: `${((share - 1) / 0.5) * 33}%` }} />}
            </div>
            <div className="gauge-margin" style={{ color }}>
              {g.margin < 0 ? fmt(t.over, { n: Math.round(-g.margin * 100) }) : fmt(t.margin, { n: Math.round(g.margin * 100) })}
            </div>
          </div>
        );
      })}
      {help && <Modal title={tk(t, `res_${help}`)} onClose={() => setHelp(null)}><p>{tk(t, `resHelp_${help}`)}</p></Modal>}
    </div>
  );
}
