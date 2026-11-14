import { useCallback, useEffect, useMemo, useState } from 'react';
import { play, stopAll } from '../audio/sfx';
import type { EventCard } from '../data/types';
import { completePicks } from '../engine/design';
import { agencyDesign, agencyForecast, type AgencyKind, type Game } from '../engine/game';
import { fmt, tk, useLang } from '../i18n';
import { AGENCY_COLOR, RESULT_MARK, useCardText, useOutcomeName } from './labels';

const RESULT_CLASS: Record<string, string> = { protected: 'good', ready: 'good', partial: 'warn', hit: 'bad', missed: 'warn' };

/** Agency name with its colour dot and short mark, so agencies never differ by colour alone. */
export function AgencyLabel({ id }: { id: AgencyKind }) {
  const { t } = useLang();
  return (
    <span className="agency-label">
      <span className="agency-dot" style={{ background: AGENCY_COLOR[id] }}>{tk(t, `agencyShort_${id}`)}</span>
      {tk(t, `agency_${id}`)}
    </span>
  );
}

/** A line icon for a card, chosen by the kind of its first effect (or "opportunity" for good cards). */
export function CardIcon({ card }: { card: EventCard }) {
  const kind = card.readyIf ? 'good' : card.unprotected[0]?.kind ?? 'failChance';
  const s = { fill: 'none', stroke: 'currentColor', strokeWidth: 3, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  return (
    <svg viewBox="0 0 48 48" className="card-icon" aria-hidden="true">
      {kind === 'good' && <path {...s} d="M24 6l5 11 12 1-9 8 3 12-11-7-11 7 3-12-9-8 12-1z" />}
      {kind === 'resource' && <><circle {...s} cx="24" cy="24" r="16" /><path {...s} d="M29 17c-2-2-9-3-10 1-1 5 11 3 10 9-1 4-8 3-11 1M24 12v24" /></>}
      {kind === 'delayDays' && <><circle {...s} cx="24" cy="26" r="15" /><path {...s} d="M24 17v10l7 4M19 6h10" /></>}
      {kind === 'failChance' && <><path {...s} d="M24 7l18 32H6z" /><path {...s} d="M24 19v10M24 34v1" /></>}
      {(kind === 'scienceFactor' || kind === 'durationFactor') && <><path {...s} d="M4 24c6-9 13-13 20-13s14 4 20 13c-6 9-13 13-20 13S10 33 4 24z" /><circle {...s} cx="24" cy="24" r="6" /><path {...s} d="M8 40L40 8" /></>}
      {kind === 'missionLost' && <><circle {...s} cx="24" cy="24" r="17" /><path {...s} d="M16 16l16 16M32 16L16 32" /></>}
    </svg>
  );
}

/**
 * Full-screen scene right after a phase is confirmed: what each agency chose, the shared cards turning over,
 * how each agency fared, and the standing so far. After the last phase it shows the flight instead of the
 * standing, so the results screen is where the ranking first appears.
 * Skip shows the final state at once; Skip again, Next, Enter or Esc closes it.
 */
export function Resolution({ game, phase, onClose }: { game: Game; phase: number; onClose: () => void }) {
  const { t, L } = useLang();
  const m = game.mission;
  const report = game.reports.find((r) => r.phase === phase);
  const byId = new Map(m.options.map((o) => [o.id, o]));
  const standard = completePicks(m, {});
  const text = useCardText(m);
  const outcomeName = useOutcomeName(m);
  const slots = m.slots.filter((s) => s.phase === phase);
  const cards = report?.cards ?? [];
  const total = cards.length ? 1.2 + cards.length * 1.4 : 1.8;
  const [done, setDone] = useState(false);

  // Standing: each agency's forecast median now (not shown after the last phase).
  const standing = useMemo(() => (game.final ? [] : game.agencies.map((a) => ({ id: a.id, score: agencyForecast(game, a, a.picks, 60, 'standing').score.p50 })).sort((x, y) => y.score - x.score)), [game]);

  useEffect(() => {
    if (!report) return;
    cards.forEach((id, k) => {
      const start = 1.2 + k * 1.4;
      play(/storm|flare/.test(id) ? 'storm' : 'cardFlip', start);
      game.agencies.forEach((a, i) => {
        const r = report.results[a.id][id];
        if (r) play(r === 'protected' || r === 'ready' ? 'markGood' : r === 'partial' ? 'markPartial' : 'markBad', start + 0.7 + i * 0.3);
      });
    });
    if (game.final) {
      if (game.agencies.some((a) => game.final![a.id].outcome !== 'noLaunch')) play('launch', 0.3);
      if (game.agencies.some((a) => game.final![a.id].outcome === 'launchFailure')) play('launchFail', 1.5);
      play(game.agencies.some((a) => game.final![a.id].outcome === 'orbitFailure') ? 'noContact' : 'contact', 1.8);
    }
    const id = window.setTimeout(() => setDone(true), total * 1000 + 400);
    return () => { clearTimeout(id); stopAll(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const advance = useCallback(() => { if (!done) { stopAll(); setDone(true); } else onClose(); }, [done, onClose]);
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape' || e.key === 'Enter') { e.preventDefault(); advance(); } };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [advance]);

  if (!report) return null;
  const possible = m.events.filter((e) => e.phase === phase && e.probability.value > 0);
  const flight = (id: AgencyKind) => {
    const o = game.final?.[id].outcome;
    if (!o) return null;
    const launch = o === 'noLaunch' ? ['bad', t.flightNotLaunched] : o === 'launchFailure' ? ['bad', t.flightFailed] : ['good', t.flightOk];
    const contact = o === 'noLaunch' || o === 'launchFailure' ? ['none', '—'] : o === 'orbitFailure' ? ['bad', t.flightNoSignal] : ['good', t.flightOk];
    const ops = ['noLaunch', 'launchFailure', 'orbitFailure'].includes(o) ? ['none', '—'] : o === 'lostInOps' ? ['bad', t.flightLost] : ['good', t.flightDone];
    return [[t.flight_launch, ...launch], [t.flight_contact, ...contact], [t.flight_ops, ...ops]] as [string, string, string][];
  };
  const title = fmt(t.resolutionTitle, { n: phase, name: tk(t, `phase${phase}`) });

  return (
    <div className={`modal resolution ${done ? 'instant' : ''}`} role="dialog" aria-label={title}>
      <div className="modal-body res-body">
        <div className="modal-head">
          <h2>{title}</h2>
          <button type="button" className={done ? 'primary' : 'secondary'} onClick={advance}>
            {!done ? `${t.skip} ▸▸` : game.final ? `${t.seeResults} ▶` : `${t.next} ▶`}
          </button>
        </div>

        <div className="res-grid">
          {game.agencies.map((a, i) => {
            const d = agencyDesign(game, a);
            const used = Math.round((d.gauges.budget.used / Math.max(m.budgetKUSD.value, 1)) * 100);
            const picks = slots.flatMap((s) => (a.picks[s.id] ?? []).map((id) => ({ id, slot: s.id, changed: !(standard[s.id] ?? []).includes(id) })));
            const changed = picks.filter((p) => p.changed), same = picks.filter((p) => !p.changed).slice(0, 3);
            return (
              <div key={a.id} className={`res-col appear ${a.id === 'player' ? 'me' : ''} ${cards.length === 0 ? 'roomy' : ''}`} style={{ animationDelay: `${i * 0.2}s`, borderTopColor: AGENCY_COLOR[a.id] }}>
                <AgencyLabel id={a.id} />
                <ul className="res-picks">
                  {changed.map((p) => <li key={`${p.slot}-${p.id}`} className="changed" title={t.changedFromStandard}>{L(byId.get(p.id)!.name)}</li>)}
                  {same.map((p) => <li key={`${p.slot}-${p.id}`}>{L(byId.get(p.id)!.name)}</li>)}
                </ul>
                <div className="res-budget"><span style={{ width: `${Math.min(100, used)}%` }} /></div>
                <div className="note small">{fmt(t.rivalBudget, { n: used })}</div>
                {flight(a.id) && (
                  <dl className="res-flight">
                    {flight(a.id)!.map(([k, cls, v]) => <div key={k}><dt>{k}</dt><dd className={cls}>{v}</dd></div>)}
                    <div><dt>{t.outcome}</dt><dd>{outcomeName(game.final![a.id].outcome)}</dd></div>
                  </dl>
                )}
              </div>
            );
          })}
        </div>

        {cards.length === 0 ? (
          <div className="res-none">
            <div className="res-flipcard idle"><div className="face back" /></div>
            <div className="appear" style={{ animationDelay: '1.4s' }}>
              <p><b>{t.nothingThisTime}</b></p>
              {possible.length > 0 && <p className="note">{fmt(t.couldHaveBeen, { list: possible.map((e) => `${L(e.name)} ${Math.round(e.probability.value * 100)}%`).join(t.listSep) })}</p>}
            </div>
          </div>
        ) : cards.map((id, k) => {
          const card = m.events.find((e) => e.id === id)!;
          const start = 1.2 + k * 1.4;
          return (
            <div key={id} className="res-card">
              <div className={`res-flipcard ${card.readyIf ? 'good' : 'bad'}`} style={{ animationDelay: `${start}s` }}>
                <div className="face front">
                  <CardIcon card={card} />
                  <b>{L(card.name)}</b>
                  <span className="res-story">{L(card.story)}</span>
                  {card.probability.value > 0 && <span className="note small">{fmt(t.cardChance, { n: Math.round(card.probability.value * 100) })}</span>}
                  {card.realCase && <span className="real-case small"><span className="real-tag">{t.realCase}</span> {card.realCase.year ? `${card.realCase.year} · ` : ''}{L(card.realCase.who)}</span>}
                </div>
                <div className="face back" />
              </div>
              <div className="res-grid">
                {game.agencies.map((a, i) => {
                  const r = report.results[a.id][id];
                  return (
                    <div key={a.id} className={`res-mark stamp ${r ? RESULT_CLASS[r] : ''}`} style={{ animationDelay: `${start + 0.7 + i * 0.3}s` }}>
                      {r ? <><b>{RESULT_MARK[r]} {tk(t, `result_${r}`)}</b><span className="small">{text.resultLine(card, r)}</span></> : '—'}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}

        {!game.final && (
          <div className="res-standing appear" style={{ animationDelay: `${total}s` }}>
            <span className="note">{t.standingTitle}</span>
            {standing.map((s, i) => <span key={s.id} className="res-rank"><b>{i + 1}</b> <AgencyLabel id={s.id} /> {Math.round(s.score * 10) / 10}</span>)}
          </div>
        )}
      </div>
    </div>
  );
}
