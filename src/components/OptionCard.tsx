import { useState } from 'react';
import { SOURCE_BY_ID } from '../data/sources';
import type { Option, Sourced } from '../data/types';
import { fmt, tk, useLang } from '../i18n';

type Stat = { key: string; text: string };

const n = (v: Sourced | undefined) => v?.value ?? 0;

/** The 2–3 numbers worth seeing at a glance for each kind of option. Everything else is under "Details". */
function headline(o: Option, t: ReturnType<typeof useLang>['t'], orbitId: string | null, solar?: number): Stat[] {
  const cost = { key: 'stat_cost', text: `${n(o.cost).toLocaleString()} ${t.unit_kUSD}` };
  const days = o.leadDays ? [{ key: 'stat_days', text: `+${n(o.leadDays)} ${t.unit_days}` }] : [];
  switch (o.kind) {
    case 'part':
      if (o.subsystem === 'payload') return [{ key: 'stat_mass', text: `${n(o.massKg)} kg` }, { key: 'stat_power', text: `${n(o.powerW)} W` }, cost];
      if (o.subsystem === 'power') return [{ key: 'stat_generates', text: `${(n(o.generatesW) * (solar ?? 1) + n(o.rtgW)).toLocaleString(undefined, { maximumFractionDigits: 0 })} W` }, { key: 'stat_mass', text: `${n(o.massKg)} kg` }, cost];
      if (o.subsystem === 'comms') return [{ key: 'stat_downlink', text: fmt(t.val_MBmin, { n: n(o.downlinkMBPerMin) }) }, { key: 'stat_power', text: `${n(o.powerW)} W` }, cost];
      return [{ key: 'stat_mass', text: `${n(o.massKg)} kg` }, cost];
    case 'orbit':
      return [
        ...(o.altitudeKm ? [{ key: 'stat_altitude', text: `${n(o.altitudeKm)} km` }] : []),
        ...(o.solarFactor ? [{ key: 'stat_sunlight', text: `×${n(o.solarFactor)}` }] : []),
        { key: 'stat_contact', text: fmt(t.val_minPerDay, { n: n(o.contactMinPerDay) }) },
      ];
    case 'launch': {
      const cap = orbitId && o.capacityKg[orbitId] ? `${o.capacityKg[orbitId]!.value} kg` : '—';
      return [cost, { key: 'stat_capacity', text: cap }, { key: 'stat_windows', text: o.windowsDay.value.map((d) => fmt(t.val_day, { n: d })).join(', ') }];
    }
    case 'choice':
      return n(o.cost) > 0 ? [cost, ...days] : days;
  }
}

const FIELD_LABEL: Record<string, string> = {
  cost: 'stat_cost', massKg: 'stat_mass', powerW: 'stat_power', generatesW: 'stat_generates', dataMBPerDay: 'stat_data',
  downlinkMBPerMin: 'stat_downlink', contactMinPerDay: 'stat_contact', altitudeKm: 'stat_altitude', inclinationDeg: 'stat_inclination',
  leadDays: 'stat_days', reliability: 'stat_reliability', windowsDay: 'stat_windows', capacityKg: 'stat_capacity', deltaVms: 'stat_deltaV',
  failPerYear: 'stat_failPerYear', rtgW: 'stat_rtg', solarFactor: 'stat_sunlight', contactHighLatMinPerDay: 'stat_contact', scienceWeight: 'stat_science', science: 'stat_opportunities', settings: 'stat_setting', storageMB: 'stat_storage',
};

/** Every sourced value of an option, for the details panel. */
function sourcedFields(o: Option): [string, Sourced<unknown>][] {
  const out: [string, Sourced<unknown>][] = [];
  const isSourced = (v: unknown): v is Sourced<unknown> => typeof v === 'object' && v !== null && 'basis' in v && 'value' in v;
  for (const [k, v] of Object.entries(o)) {
    if (isSourced(v)) out.push([k, v]);
    else if (k === 'capacityKg' || k === 'settings' || k === 'science') for (const [k2, v2] of Object.entries(v as Record<string, unknown>)) if (isSourced(v2)) out.push([`${k}.${k2}`, v2]);
  }
  return out;
}

export function OptionCard({ option, selected, disabled, type, name, orbitId, solar, onPick }: {
  option: Option; selected: boolean; disabled?: boolean; type: 'radio' | 'checkbox'; name: string; orbitId: string | null; solar?: number; onPick: () => void;
}) {
  const { t, L } = useLang();
  const [open, setOpen] = useState(false);
  const stats = headline(option, t, orbitId, solar);
  return (
    <div className={`opt ${selected ? 'on' : ''} ${disabled ? 'off' : ''}`}>
      <label className="opt-main">
        <input type={type} name={name} checked={selected} disabled={disabled} onChange={onPick} />
        <span className="opt-name">{L(option.name)}</span>
      </label>
      <p className="opt-desc">{L(option.description)}</p>
      {stats.length > 0 && (
        <dl className="opt-stats">
          {stats.map((s) => (
            <div key={s.key}><dt>{tk(t, s.key)}</dt><dd>{s.text}</dd></div>
          ))}
        </dl>
      )}
      <button type="button" className="link-btn" onClick={() => setOpen(!open)}>{open ? t.hideDetails : t.details}</button>
      {open && (
        <ul className="opt-details">
          {sourcedFields(option).map(([k, v]) => (
            <li key={k}>
              <span className="field">{tk(t, FIELD_LABEL[k.split('.')[0]!] ?? k)}{k.includes('.') ? ` (${k.split('.')[1]})` : ''}</span>: <b>{Array.isArray(v.value) ? v.value.join(', ') : String(v.value)}</b>{' '}
              <span className={`basis basis-${v.basis}`}>{tk(t, `basis_${v.basis}`)}</span>
              {v.sources?.map((id) => {
                const s = SOURCE_BY_ID.get(id);
                return s ? <a key={id} href={s.url} target="_blank" rel="noreferrer" className="src">{s.publisher}</a> : null;
              })}
              {v.note && <div className="note">{L(v.note)}</div>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
