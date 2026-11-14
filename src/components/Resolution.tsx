import { useCallback, useEffect, useMemo, useState } from 'react';
import { play, stopAll } from '../audio/sfx';
import type { EventCard } from '../data/types';
import { completePicks } from '../engine/design';
import { agencyDesign, agencyForecast, type AgencyKind, type Game } from '../engine/game';
import { fmt, tk, useLang } from '../i18n';
import { AutoFit } from './AutoFit';
import { Flight, FLIGHT_SECONDS } from './Flight';
import { AGENCY_COLOR, RESULT_MARK, useAgencyName, useCardText } from './labels';
import type { AgencyKind as Seat } from '../engine/game';

const RESULT_CLASS: Record<string, string> = { protected: 'good', ready: 'good', partial: 'warn', hit: 'bad', missed: 'warn' };

/** Agency name with its colour dot and short mark, so agencies never differ by colour alone. */
export function AgencyLabel({ id }: { id: AgencyKind }) {
  const { t } = useLang();
  const n = useAgencyName();
  return (
    <span className="agency-label">
      <span className="agency-dot" style={{ background: AGENCY_COLOR[id] }}>{n.short(id)}</span>
      {n.name(id)}
      {n.isAi(id) && <span className="ai-tag">{t.aiTag}</span>}
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
  const names = useAgencyName();
  const slots = m.slots.filter((s) => s.phase === phase);
  // Playing together: who met a split card how, in words with names; and secondary objectives several chose.
  const nameList = (ids: Seat[]) => names.list(ids, (id) => names.spaced(names.inText(id)));
  const splitText = (id: string) => {
    if (!report) return '';
    const groups = new Map<string, Seat[]>();
    for (const a of game.agencies) { const r = report.results[a.id][id]; if (r) groups.set(r, [...(groups.get(r) ?? []), a.id]); }
    return names.tidy([...groups].map(([r, ids]) => fmt(tk(t, `split_${r}`), { names: nameList(ids) })).join(' '));
  };
  const shared = names.multi && phase === 1 ? m.secondary.filter((o) => o.chosenBy).map((o) => {
    const ids = game.agencies.filter((a) => Object.values(a.picks).flat().some((pid) => byId.get(pid)?.tags?.includes(o.chosenBy!))).map((a) => a.id);
    return ids.length >= 2 ? names.tidy(fmt(t.sharedSecondary, { names: nameList(ids), goal: L(o.name) })) : '';
  }).filter(Boolean) : [];
  const cards = report?.cards ?? [];
  // A card every agency met the same way is shown as one line and takes less time; a split result gets
  // its four boxes, one after another, and more time.
  const sameResult = (id: string) => {
    const rs = report ? game.agencies.map((a) => report.results[a.id][id]) : [];
    return rs.length > 0 && rs.every((x) => x && x === rs[0]) ? rs[0]! : null;
  };
  const timing = cards.reduce<{ starts: number[]; end: number }>((acc, id) => {
    acc.starts.push(acc.end);
    acc.end += sameResult(id) ? 1.1 : 0.9 + game.agencies.length * 0.4;
    return acc;
  }, { starts: [], end: 1.2 });
  const eventsEnd = cards.length ? timing.end : 1.8;
  const [done, setDone] = useState(false);
  // After the last phase the cards give way to the flight scene (its own page, so nothing scrolls).
  const [flightOn, setFlightOn] = useState(false);
  // In the last phase the cards stay until the player moves on to the flight (no automatic step: they can read).
  const [cardsEnded, setCardsEnded] = useState(false);

  // Standing: each agency's forecast median now (not shown after the last phase).
  const standing = useMemo(() => (game.final ? [] : game.agencies.map((a) => ({ id: a.id, score: agencyForecast(game, a, a.picks, 60, 'standing').score.p50 })).sort((x, y) => y.score - x.score)), [game]);

  useEffect(() => {
    if (!report) return;
    const sound = (r: string) => (r === 'protected' || r === 'ready' ? 'markGood' : r === 'partial' ? 'markPartial' : 'markBad');
    cards.forEach((id, k) => {
      const start = timing.starts[k]!;
      play(/storm|flare/.test(id) ? 'storm' : 'cardFlip', start);
      const same = sameResult(id);
      if (same) { play(sound(same), start + 0.7); return; }
      game.agencies.forEach((a, i) => {
        const r = report.results[a.id][id];
        if (r) play(sound(r), start + 0.8 + i * 0.4);
      });
    });
    const id = window.setTimeout(() => (game.final ? setCardsEnded(true) : setDone(true)), eventsEnd * 1000 + 400);
    return () => { clearTimeout(id); stopAll(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!flightOn || !game.final) return;
    const f = game.final;
    if (game.agencies.some((a) => f[a.id].outcome !== 'noLaunch')) play('launch', 0.6);
    if (game.agencies.some((a) => f[a.id].outcome === 'launchFailure')) play('launchFail', 2);
    play(game.agencies.some((a) => f[a.id].outcome === 'orbitFailure') ? 'noContact' : 'contact', 3);
    for (let k = 0; k < 12; k++) play('tick', 4.3 + k * 0.42);
    const id = window.setTimeout(() => setDone(true), FLIGHT_SECONDS * 1000 + 400);
    return () => { clearTimeout(id); stopAll(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flightOn]);

  const advance = useCallback(() => {
    stopAll();
    if (game.final && !flightOn) { if (!cardsEnded) setCardsEnded(true); else setFlightOn(true); }
    else if (!done) setDone(true);
    else onClose();
  }, [done, flightOn, cardsEnded, game.final, onClose]);
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape' || e.key === 'Enter') { e.preventDefault(); advance(); } };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [advance]);

  if (!report) return null;
  const possible = m.events.filter((e) => e.phase === phase && e.probability.value > 0);
  const title = flightOn ? t.flightTitle : fmt(t.resolutionTitle, { n: phase, name: tk(t, `phase${phase}`) });

  return (
    <div className={`modal resolution ${done || (cardsEnded && !flightOn) ? 'instant' : ''}`} role="dialog" aria-label={title}>
      <div className="modal-body res-body">
        <div className="modal-head">
          <h2>{title}</h2>
          {game.final && !flightOn ? (
            <button type="button" className={cardsEnded ? 'primary' : 'secondary'} onClick={advance}>
              {cardsEnded ? `${t.watchFlight} ▶` : `${t.skip} ▸▸`}
            </button>
          ) : (
            <button type="button" className={done ? 'primary' : 'secondary'} onClick={advance}>
              {!done ? `${t.skip} ▸▸` : game.final ? `${t.seeResults} ▶` : `${t.next} ▶`}
            </button>
          )}
        </div>

        {flightOn && game.final ? <Flight game={game} start={0} instant={done} /> : <AutoFit className="res-fit" min={0.72}>
        <div className="res-grid">
          {game.agencies.map((a, i) => {
            const d = agencyDesign(game, a);
            const used = Math.round((d.gauges.budget.used / Math.max(m.budgetKUSD.value, 1)) * 100);
            const picks = slots.flatMap((s) => (a.picks[s.id] ?? []).map((id) => ({ id, slot: s.id, changed: !(standard[s.id] ?? []).includes(id) })));
            // With an event to show, unchanged picks give way to it (only enough to say what stayed).
            const changed = picks.filter((p) => p.changed), same = picks.filter((p) => !p.changed).slice(0, cards.length ? Math.max(0, 2 - changed.length) : 3);
            return (
              <div key={a.id} className={`res-col appear ${a.id === 'player' && game.mode !== 'multi' ? 'me' : ''} ${cards.length === 0 ? 'roomy' : ''}`} style={{ animationDelay: `${i * 0.2}s`, borderTopColor: AGENCY_COLOR[a.id] }}>
                <AgencyLabel id={a.id} />
                <ul className="res-picks">
                  {changed.map((p) => <li key={`${p.slot}-${p.id}`} className="changed" title={t.changedFromStandard}>{L(byId.get(p.id)!.name)}</li>)}
                  {same.map((p) => <li key={`${p.slot}-${p.id}`}>{L(byId.get(p.id)!.name)}</li>)}
                </ul>
                <div className="res-budget"><span style={{ width: `${Math.min(100, used)}%` }} /></div>
                <div className="note small">{fmt(t.rivalBudget, { n: used })}</div>
              </div>
            );
          })}
        </div>
        {shared.map((x) => <p key={x} className="res-shared appear">{x}</p>)}

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
          const start = timing.starts[k]!;
          const same = sameResult(id);
          return (
            <div key={id} className={`res-card ${same ? 'same' : 'split'}`}>
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
              {same ? (
                <p className={`res-same stamp ${RESULT_CLASS[same]}`} style={{ animationDelay: `${start + 0.7}s` }}>
                  <b>{RESULT_MARK[same]} {fmt(tk(t, `allSame_${same}`), { n: game.agencies.length })}</b>{t.colonSep}{text.resultLine(card, same)}
                </p>
              ) : <>
              <div className="res-split">
              <p className="res-split-note stamp" style={{ animationDelay: `${start + 0.6}s` }}>{names.multi ? splitText(id) : t.resultsSplit}</p>
              <div className="res-grid">
                {game.agencies.map((a, i) => {
                  const r = report.results[a.id][id];
                  return (
                    <div key={a.id} className={`res-mark stamp ${r ? RESULT_CLASS[r] : ''}`} style={{ animationDelay: `${start + 0.8 + i * 0.4}s` }}>
                      <AgencyLabel id={a.id} />
                      {r ? <><b>{RESULT_MARK[r]} {tk(t, `result_${r}`)}</b><span className="small">{text.resultLine(card, r)}</span></> : '—'}
                    </div>
                  );
                })}
              </div>
              </div>
              </>}
            </div>
          );
        })}

        {!game.final && (
          <div className="res-standing appear" style={{ animationDelay: `${eventsEnd}s` }}>
            <span className="note">{t.standingTitle}</span>
            {standing.map((s, i) => <span key={s.id} className="res-rank"><b>{i + 1}</b> <AgencyLabel id={s.id} /> {Math.round(s.score * 10) / 10}</span>)}
          </div>
        )}
        </AutoFit>}
      </div>
    </div>
  );
}
