import { useState } from 'react';
import { SOURCE_BY_ID } from '../data/sources';
import type { DecisionSlot, MissionViewConfig, Option, Sourced } from '../data/types';
import { fmt, tk, useLang } from '../i18n';
import { Modal } from './Modal';
import { Icon } from './icons';
import { MiniDiagram, hasDiagram } from './MiniDiagram';
import { levels, optionIcon } from './optionVisuals';

/** One headline number. `num` is set when it can be compared across a slot's options (drawn as a bar). */
type Stat = { key: string; text: string; num?: number };

const n = (v: Sourced | undefined) => v?.value ?? 0;

/** The 2–3 numbers worth seeing at a glance for each kind of option. Everything else is under "Details". */
function headline(o: Option, t: ReturnType<typeof useLang>['t'], orbitId: string | null, solar?: number): Stat[] {
  const cost = { key: 'stat_cost', text: `${n(o.cost).toLocaleString()} ${t.unit_kUSD}`, num: n(o.cost) };
  const days = o.leadDays ? [{ key: 'stat_days', text: `+${n(o.leadDays)} ${t.unit_days}`, num: n(o.leadDays) }] : [];
  switch (o.kind) {
    case 'part':
      if (o.subsystem === 'payload') return [{ key: 'stat_mass', text: `${n(o.massKg)} kg`, num: n(o.massKg) }, { key: 'stat_power', text: `${n(o.powerW)} W`, num: n(o.powerW) }, cost];
      if (o.subsystem === 'power') {
        const w = n(o.generatesW) * (solar ?? 1) + n(o.rtgW);
        return [{ key: 'stat_generates', text: `${w.toLocaleString(undefined, { maximumFractionDigits: 0 })} W`, num: w }, { key: 'stat_mass', text: `${n(o.massKg)} kg`, num: n(o.massKg) }, cost];
      }
      if (o.subsystem === 'comms') return [{ key: 'stat_downlink', text: fmt(t.val_MBmin, { n: n(o.downlinkMBPerMin) }), num: n(o.downlinkMBPerMin) }, { key: 'stat_power', text: `${n(o.powerW)} W`, num: n(o.powerW) }, cost];
      return [{ key: 'stat_mass', text: `${n(o.massKg)} kg`, num: n(o.massKg) }, cost];
    case 'orbit':
      return [
        ...(o.altitudeKm ? [{ key: 'stat_altitude', text: `${n(o.altitudeKm)} km`, num: n(o.altitudeKm) }] : []),
        ...(o.solarFactor ? [{ key: 'stat_sunlight', text: `×${n(o.solarFactor)}` }] : []),
        { key: 'stat_contact', text: fmt(t.val_minPerDay, { n: n(o.contactMinPerDay) }), num: n(o.contactMinPerDay) },
      ];
    case 'launch': {
      const c = orbitId ? o.capacityKg[orbitId]?.value : undefined;
      return [cost, { key: 'stat_capacity', text: c !== undefined ? `${c} kg` : '—', num: c ?? 0 }, { key: 'stat_windows', text: o.windowsDay.value.map((d) => fmt(t.val_day, { n: d })).join(', ') }];
    }
    case 'choice':
      return n(o.cost) > 0 ? [cost, ...days] : days;
  }
}

const FIELD_LABEL: Record<string, string> = {
  cost: 'stat_cost', massKg: 'stat_mass', powerW: 'stat_power', generatesW: 'stat_generates', dataMBPerDay: 'stat_data',
  downlinkMBPerMin: 'stat_downlink', contactMinPerDay: 'stat_contact', altitudeKm: 'stat_altitude', inclinationDeg: 'stat_inclination',
  leadDays: 'stat_days', reliability: 'stat_reliability', windowsDay: 'stat_windows', capacityKg: 'stat_capacity', deltaVms: 'stat_deltaV',
  failPerYear: 'stat_failPerYear', detectShare: 'stat_detect', rtgW: 'stat_rtg', solarFactor: 'stat_sunlight', contactHighLatMinPerDay: 'stat_contact', addsMassKg: 'stat_addsMass', scienceWeight: 'stat_science', science: 'stat_opportunities', settings: 'stat_setting', storageMB: 'stat_storage',
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

/** One difference from the current choice: text and whether it makes things better or worse. */
export type Diff = { text: string; good: boolean };

/** Small filled/empty dots: n of max. */
function Dots({ n, max, label }: { n: number; max: number; label: string }) {
  return (
    <span className="lv-dots" role="img" aria-label={label}>
      {Array.from({ length: max }, (_, i) => <i key={i} className={i < n ? 'f' : ''} />)}
    </span>
  );
}

/** A circle's arc for a share between 0 and 1 (14px). */
function Arc({ share, label }: { share: number; label: string }) {
  const s = Math.max(0, Math.min(0.999, share));
  const a = s * Math.PI * 2;
  const x = 7 + 5.5 * Math.sin(a), y = 7 - 5.5 * Math.cos(a);
  return (
    <svg className="lv-arc" width="1.35em" height="1.35em" viewBox="0 0 14 14" role="img" aria-label={label}>
      <circle cx={7} cy={7} r={5.5} fill="none" stroke="currentColor" strokeOpacity={0.3} strokeWidth={1.5} />
      <path d={`M7 1.5A5.5 5.5 0 ${s > 0.5 ? 1 : 0} 1 ${x.toFixed(2)} ${y.toFixed(2)}`} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" />
    </svg>
  );
}

export function OptionCard({ option, selected, disabled, type, name, orbitId, solar, hint, standard, diffs, reason, blocks, onPick, onHover, slot, peers, view, compact }: {
  option: Option; selected: boolean; disabled?: boolean; type: 'radio' | 'checkbox'; name: string; orbitId: string | null; solar?: number;
  hint?: string; standard?: boolean; diffs?: Diff[]; reason?: string; blocks?: string; onPick: () => void; onHover?: (on: boolean) => void;
  /** The slot and its options, for the level marks and the comparison bars. */
  slot?: DecisionSlot; peers?: Option[]; view?: MissionViewConfig;
  /** Leave out the description line (it stays under "i"), for phases with many boxes. */
  compact?: boolean;
}) {
  const { t, L } = useLang();
  const [open, setOpen] = useState(false);
  const stats = headline(option, t, orbitId, solar);
  // Largest value of each comparable number across the slot; rows that are 0 everywhere are dropped.
  const peerMax = new Map<string, number>();
  for (const p of peers ?? [option]) for (const s of headline(p, t, orbitId, solar)) if (s.num !== undefined) peerMax.set(s.key, Math.max(peerMax.get(s.key) ?? 0, s.num));
  const rows = stats.filter((s) => s.num === undefined || (peerMax.get(s.key) ?? 0) > 0);
  const lv = slot && peers ? levels(slot, peers, solar).get(option.id) : undefined;
  const levelLabel = lv && slot?.level ? fmt(t.levelOf, { label: L(slot.level.label), n: lv.n, max: lv.max }) : '';
  const cam = option.kind === 'part' && (option.observes === 'day' || option.observes === 'dayNight') ? option : null;
  const detect = cam?.detectShare?.value;
  return (
    <div className={`opt ${selected ? 'on' : ''} ${disabled ? 'off' : ''}`}
      onMouseEnter={() => onHover?.(true)} onMouseLeave={() => onHover?.(false)} onFocus={() => onHover?.(true)} onBlur={() => onHover?.(false)}>
      <div className="opt-row">
        <label className="opt-main">
          <input type={type} name={name} checked={selected} disabled={disabled} onChange={onPick} />
          {hasDiagram(option, view) ? <span className="opt-ico diag"><MiniDiagram option={option} view={view} size="2.85em" /></span>
            : <Icon name={optionIcon(option)} size="1.6em" className="opt-ico" />}
          <span className="opt-name">{L(option.name)}</span>
        </label>
        {standard && <span className="std-mark" title={t.standardMark}>{t.standardMark}</span>}
        <button type="button" className="info-btn" aria-label={t.details} title={t.details} onClick={() => setOpen(true)}>i</button>
      </div>
      {(lv && lv.max > 0 && slot?.level) && (
        <div className="opt-level">
          {slot.level.style === 'arc' ? <Arc share={lv.share} label={levelLabel} /> : <Dots n={lv.n} max={lv.max} label={levelLabel} />}
          <span aria-hidden>{L(slot.level.label)}</span>
        </div>
      )}
      {cam && (
        <div className="opt-level">
          <span className="lv-time" role="img" aria-label={cam.observes === 'dayNight' ? t.observesDayNight : t.observesDay}>
            <Icon name="sun" size="1.15em" />{cam.observes === 'dayNight' && <Icon name="moon" size="1.15em" />}
          </span>
          <span aria-hidden>{cam.observes === 'dayNight' ? t.observesDayNight : t.observesDay}</span>
          {detect !== undefined && detect < 1 && <Dots n={Math.max(1, Math.round(detect * 3))} max={3} label={fmt(t.detectOf, { n: Math.max(1, Math.round(detect * 3)), max: 3 })} />}
        </div>
      )}
      {!compact && <div className="opt-line">{L(option.description)}</div>}
      {rows.length > 0 && (
        <div className="opt-bars">
          {rows.map((s) => {
            const max = peerMax.get(s.key) ?? 0;
            const zero = s.num !== undefined && s.num === 0;
            return (
              <div key={s.key} className="bar-row">
                <span className="field">{tk(t, s.key)}</span>
                {s.num !== undefined ? <span className="bar" aria-hidden>{s.num > 0 && <i style={{ width: `${Math.max(4, (s.num / max) * 100)}%` }} />}</span> : <span />}
                <span className="bar-val">{zero ? '—' : s.text}</span>
              </div>
            );
          })}
        </div>
      )}
      {diffs && diffs.length > 0 && <div className="opt-diff">{diffs.map((d, i) => <span key={i} className={d.good ? 'ok' : 'warn'}>{d.text}</span>)}</div>}
      {reason && <div className="opt-why">{reason}</div>}
      {blocks && <div className="opt-block">{blocks}</div>}
      {hint && <div className="change-cost">{hint}</div>}
      {open && (
        <Modal title={L(option.name)} onClose={() => setOpen(false)}>
          <p className="opt-desc">{L(option.description)}</p>
          <ul className="opt-details">
            {sourcedFields(option).map(([k, v]) => (
              <li key={k}>
                <span className="field">{tk(t, FIELD_LABEL[k.split('.')[0]!] ?? k)}{k.includes('.') ? ` (${k.split('.')[1]})` : ''}</span>: <b>{Array.isArray(v.value) ? v.value.join(', ') : String(v.value)}</b>{' '}
                <span className={`basis basis-${v.basis}`}>{tk(t, `basis_${v.basis}`)}</span>
                {v.sources?.map((id) => {
                  const src = SOURCE_BY_ID.get(id);
                  return src ? <a key={id} href={src.url} target="_blank" rel="noreferrer" className="src">{src.publisher}</a> : null;
                })}
                {v.note && <div className="note">{L(v.note)}</div>}
              </li>
            ))}
          </ul>
        </Modal>
      )}
    </div>
  );
}
