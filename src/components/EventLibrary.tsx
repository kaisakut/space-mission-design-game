import { useMemo, useState } from 'react';
import { MISSIONS } from '../data/missions';
import { SOURCE_BY_ID } from '../data/sources';
import type { Condition, Effect, EventCard, Mission } from '../data/types';
import { fmt, tk, useLang } from '../i18n';
import { AutoFit } from './AutoFit';
import { useOutcomeName } from './labels';

type Entry = { mission: Mission; card: EventCard };

/**
 * A browsable list of every event card: the list on the left, the selected card on the right.
 * Shows when a card can happen, what protects against it and, where there is one, the real case behind it.
 */
export function EventLibrary() {
  const { t, L } = useLang();
  const [missionId, setMissionId] = useState<string>('all');
  const [realOnly, setRealOnly] = useState(false);
  const all = useMemo<Entry[]>(() => MISSIONS.flatMap((mission) => [...mission.events].sort((a, b) => a.phase - b.phase).map((card) => ({ mission, card }))), []);
  const shown = all.filter((e) => (missionId === 'all' || e.mission.id === missionId) && (!realOnly || e.card.realCase));
  const [sel, setSel] = useState<Entry | null>(all.find((e) => e.card.realCase) ?? all[0] ?? null);
  const current = sel && shown.includes(sel) ? sel : shown[0] ?? null;

  return (
    <div className="library">
      <div className="turnbar">
        <div className="turn-title"><b>{t.libraryTitle}</b><span className="note">{t.libraryNote}</span></div>
        <div className="tabs" role="tablist">
          {[{ id: 'all', name: t.libraryAll }, ...MISSIONS.map((m) => ({ id: m.id, name: L(m.name) }))].map((x) => (
            <button key={x.id} type="button" role="tab" aria-selected={missionId === x.id} className={missionId === x.id ? 'on' : ''} onClick={() => setMissionId(x.id)}>{x.name}</button>
          ))}
        </div>
        <label className="practice">
          <input type="checkbox" checked={realOnly} onChange={(e) => setRealOnly(e.target.checked)} />
          {t.libraryRealOnly}
        </label>
      </div>
      <div className="library-body">
        <AutoFit className={`col lib-list ${missionId === 'all' ? 'multi' : ''}`} min={0.75}>
          <p className="note small">{fmt(t.libCount, { n: shown.length })}</p>
          <div className="lib-groups">
          {MISSIONS.filter((m) => shown.some((e) => e.mission === m)).map((m) => (
            <div key={m.id}>
              {missionId === 'all' && <h3 className="lib-group">{L(m.name)}</h3>}
              <ul>
                {shown.filter((e) => e.mission === m).map((e) => (
                  <li key={e.card.id}>
                    <button type="button" className={`lib-item ${current === e ? 'on' : ''}`} onClick={() => setSel(e)}>
                      <span className="lib-phase">{e.card.phase}</span>
                      <span className={`lib-kind ${e.card.readyIf ? 'good' : 'bad'}`} aria-hidden="true">{e.card.readyIf ? '＋' : '−'}</span>
                      <span className="lib-name">{L(e.card.name)}</span>
                      {e.card.realCase && (
                        <span className="real-tag" title={L(e.card.realCase.who)}>
                          {missionId === 'all' && e.card.realCase.year ? e.card.realCase.year : `${e.card.realCase.year ? `${e.card.realCase.year} · ` : ''}${L(e.card.realCase.who)}`}
                        </span>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
          </div>
        </AutoFit>
        <AutoFit className="col lib-detail" min={0.7}>
          {current ? <CardDetail entry={current} /> : <p className="note">{t.libraryPick}</p>}
        </AutoFit>
      </div>
    </div>
  );
}

function CardDetail({ entry: { mission, card } }: { entry: Entry }) {
  const { t, L } = useLang();
  const outcomeName = useOutcomeName(mission);
  const good = !!card.readyIf;
  const p = card.probability;

  // Plain-language versions of the card's conditions and effects, naming the options that meet them.
  const quote = (names: string[]) => names.map((n) => fmt(t.quoted, { x: n })).join(t.cond_nameSep);
  const cond = (c: Condition): string => {
    switch (c.kind) {
      case 'hasTag': return fmt(t.cond_pick, { names: quote(mission.options.filter((o) => o.tags?.includes(c.tag)).map((o) => L(o.name))) });
      case 'setting': return fmt(t.cond_pick, { names: quote(mission.options.filter((o) => o.kind === 'choice' && (o.settings?.[c.key]?.value ?? -Infinity) >= c.atLeast).map((o) => L(o.name))) });
      case 'settingAtMost': return fmt(t.cond_pick, { names: quote(mission.options.filter((o) => o.kind === 'choice' && o.settings?.[c.key] !== undefined && o.settings[c.key]!.value <= c.atMost).map((o) => L(o.name))) });
      case 'margin': return fmt(t.cond_margin, { res: tk(t, `res_${c.resource}`), n: Math.round(c.atLeast * 100) });
      case 'reserveAtLeast': return fmt(t.cond_reserve, { k: `${c.kUSD.toLocaleString()} ${t.unit_kUSD}` });
      case 'all': return c.of.map(cond).join(t.cond_and);
      case 'any': return c.of.map(cond).join(t.cond_or);
    }
  };
  const effect = (e: Effect): string | null => {
    switch (e.kind) {
      case 'scienceFactor': return fmt(e.factor < 1 ? t.eff_scienceDown : t.eff_scienceUp, { n: Math.round(Math.abs(1 - e.factor) * 100) });
      case 'durationFactor': return fmt(t.eff_duration, { n: Math.round((1 - e.factor) * 100) });
      case 'failChance': return fmt(t.eff_fail, { what: tk(t, `cause_fail_${e.subsystem}`), n: Math.round(e.add * 100) });
      case 'delayDays': return fmt(t.eff_delay, { n: e.days });
      case 'resource': return fmt(t.eff_budget, { k: `${Math.abs(e.delta).toLocaleString()} ${t.unit_kUSD}` });
      case 'missionLost': return fmt(t.eff_lost, { outcome: outcomeName(e.outcome) });
      case 'bonus': return null;
    }
  };
  const effects = (es: Effect[] | undefined) => {
    const lines = (es ?? []).map(effect).filter((x): x is string => !!x);
    return lines.length ? <ul>{lines.map((x, i) => <li key={i}>{x}</li>)}</ul> : <p>{t.libNoEffect}</p>;
  };

  return (
    <article className="lib-card">
      <p className="note">{L(mission.name)} · {fmt(t.phaseTab, { n: card.phase, name: tk(t, `phase${card.phase}`) })} · <span className={good ? 'ok' : 'bad'}>{good ? t.libKindGood : t.libKindBad}</span></p>
      <h2>{L(card.name)}</h2>
      <p className="lib-story">{L(card.story)}</p>

      <dl className="lib-facts">
        <dt>{t.libChance}</dt>
        <dd>
          {p.value > 0 && <b>{Math.round(p.value * 100)}% </b>}
          <span className={`basis basis-${p.basis}`}>{tk(t, `basis_${p.basis}`)}</span>
          {p.note && <div className="note">{L(p.note)}</div>}
        </dd>
        {good ? (
          <>
            <dt>{t.libReady}</dt><dd>{cond(card.readyIf!)}</dd>
            <dt>{t.libBenefit}</dt><dd>{effects(card.benefit)}</dd>
          </>
        ) : (
          <>
            {card.protectedIf && <><dt>{t.libProtected}</dt><dd>{cond(card.protectedIf)}</dd></>}
            {card.partialIf && <><dt>{t.libPartial}</dt><dd>{cond(card.partialIf)}{effects(card.partial)}</dd></>}
            <dt>{t.libUnprotected}</dt><dd>{effects(card.unprotected)}</dd>
          </>
        )}
        <dt>{t.libLesson}</dt><dd className="note">{((x) => x.charAt(0).toUpperCase() + x.slice(1))(fmt(L(card.lesson), { agency: t.libAgency }))}</dd>
      </dl>

      {card.realCase && (
        <section className="lib-real">
          <h3><span className="real-tag">{t.realCase}</span> {card.realCase.year ? `${card.realCase.year} · ` : ''}{L(card.realCase.who)}</h3>
          <p>{L(card.realCase.text)}</p>
          <ul className="lib-sources">
            {card.realCase.sources.map((id) => {
              const s = SOURCE_BY_ID.get(id);
              return s ? <li key={id}><a href={s.url} target="_blank" rel="noreferrer">{s.title}</a> <span className="note">— {s.publisher}</span>{s.nasa && <span className="basis basis-nasa">NASA</span>}</li> : null;
            })}
          </ul>
        </section>
      )}
    </article>
  );
}
