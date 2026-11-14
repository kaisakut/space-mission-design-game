import { useMemo, useState } from 'react';
import type { Mission } from '../data/types';
import { evaluate, type Issue, type Picks } from '../engine/design';
import { fmt, tk, useLang } from '../i18n';
import { Gauges } from './Gauges';
import { OptionCard } from './OptionCard';

const PHASES = [1, 2, 3, 4, 5] as const;

/** Trial design screen: pick options phase by phase and watch the gauges and the problem list. */
export function DesignScreen({ mission }: { mission: Mission }) {
  const { t, L } = useLang();
  const [phase, setPhase] = useState<number>(1);
  const [picks, setPicks] = useState<Picks>({});
  const state = useMemo(() => evaluate(mission, picks), [mission, picks]);
  const optionById = useMemo(() => new Map(mission.options.map((o) => [o.id, o])), [mission]);

  const pick = (slotId: string, optionId: string, multi?: { min: number; max: number }) => {
    setPicks((p) => {
      const cur = state.picks[slotId] ?? [];
      if (!multi) {
        const next = { ...p, [slotId]: [optionId] };
        // Changing the orbit: keep the launch valid by switching to one that reaches the new orbit.
        const chosen = optionById.get(optionId);
        if (chosen?.kind === 'orbit') {
          const launchSlot = mission.slots.find((x) => x.options.some((id) => optionById.get(id)?.kind === 'launch'));
          const curLaunch = launchSlot ? optionById.get((state.picks[launchSlot.id] ?? [])[0] ?? '') : undefined;
          if (launchSlot && curLaunch?.kind === 'launch' && !curLaunch.capacityKg[optionId]) {
            const ok = launchSlot.options.find((id) => { const l = optionById.get(id); return l?.kind === 'launch' && !!l.capacityKg[optionId]; });
            if (ok) next[launchSlot.id] = [ok];
          }
        }
        return next;
      }
      // In a multi-choice slot the first option means "none" and clears the others.
      const slot = mission.slots.find((s) => s.id === slotId)!;
      const none = slot.options[0]!;
      if (optionId === none) return { ...p, [slotId]: [none] };
      const without = cur.filter((x) => x !== none);
      const next = without.includes(optionId) ? without.filter((x) => x !== optionId) : [...without, optionId].slice(-multi.max);
      return { ...p, [slotId]: next.length ? next : [none] };
    });
  };

  const issueText = (i: Issue) => {
    const values = { ...i.values };
    for (const k of ['launch', 'orbit'] as const) { const o = optionById.get(String(values[k] ?? '')); if (o) values[k] = L(o.name); }
    return fmt(tk(t, `issue_${i.code}`), values);
  };
  const blockers = state.issues.filter((i) => i.level === 'blocker');
  const warnings = state.issues.filter((i) => i.level === 'warning');

  return (
    <section className="design">
      <div className="design-side">
        <h2>{L(mission.name)}</h2>
        <p className="note">{L(mission.summary)}</p>
        <Gauges gauges={state.gauges} />
        <div className="issues">
          {!blockers.length && !warnings.length && <p className="ok">{t.noIssues}</p>}
          {blockers.length > 0 && <><h3 className="bad">{t.blockers}</h3><ul>{blockers.map((i, k) => <li key={k}>{issueText(i)}</li>)}</ul></>}
          {warnings.length > 0 && <><h3 className="warn">{t.warnings}</h3><ul>{warnings.map((i, k) => <li key={k}>{issueText(i)}</li>)}</ul></>}
        </div>
      </div>
      <div className="design-main">
        <h2>{t.designTitle}</h2>
        <p className="note">{t.designNote}</p>
        <div className="tabs" role="tablist">
          {PHASES.map((p) => (
            <button key={p} type="button" role="tab" aria-selected={phase === p} className={phase === p ? 'on' : ''} onClick={() => setPhase(p)}>
              {fmt(t.phaseTab, { n: p, name: tk(t, `phase${p}`) })}
            </button>
          ))}
        </div>
        {mission.slots.filter((s) => s.phase === phase).map((s) => (
          <fieldset key={s.id} className="slot">
            <legend>{L(s.label)}</legend>
            <p className="note">{L(s.help)}{s.multi ? ` ${fmt(t.pickUpTo, { n: s.multi.max })}` : ''}</p>
            <div className="opts">
              {s.options.map((id) => {
                const o = optionById.get(id)!;
                const selected = (state.picks[s.id] ?? []).includes(id);
                const wrongOrbit = o.kind === 'launch' && state.orbit !== null && !o.capacityKg[state.orbit.id];
                return (
                  <OptionCard
                    key={id} option={o} selected={selected} disabled={wrongOrbit}
                    type={s.multi ? 'checkbox' : 'radio'} name={s.id} orbitId={state.orbit?.id ?? null}
                    onPick={() => pick(s.id, id, s.multi)}
                  />
                );
              })}
            </div>
          </fieldset>
        ))}
      </div>
    </section>
  );
}
