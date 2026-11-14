import { SOURCE_BY_ID } from '../data/sources';
import type { EventResult } from '../engine/events';
import { evaluate } from '../engine/design';
import { resolveEvent } from '../engine/events';
import { agencyDesign, type AgencyKind, type Game } from '../engine/game';
import { Rng } from '../engine/rng';
import { simulate } from '../engine/simulate';
import { fmt, tk, useLang } from '../i18n';
import { useMemo, useState } from 'react';
import { OUTCOME_COLOR, RESULT_MARK, useCauseName, useOutcomeName } from './labels';
import { Modal } from './Modal';
import { AgencyLabel, Resolution } from './Resolution';

const RESULT_CLASS: Record<EventResult, string> = { protected: 'good', ready: 'good', partial: 'warn', hit: 'bad', missed: 'warn' };

/** What happened after each confirmed phase: the shared cards, how each agency fared, and what the rivals chose. */
export function TurnReports({ game, heading = true }: { game: Game; heading?: boolean }) {
  const { t, L } = useLang();
  const m = game.mission;
  const byId = new Map(m.options.map((o) => [o.id, o]));
  if (!game.reports.length) return null;
  return (
    <section className={heading ? 'panel reports' : 'reports'}>
      {heading && <h2>{t.reportsTitle}</h2>}
      {[...game.reports].reverse().map((r) => (
        <div key={r.phase} className="report">
          <h3>{fmt(t.phaseTab, { n: r.phase, name: tk(t, `phase${r.phase}`) })}</h3>
          {r.cards.length === 0 && <p className="note">{t.nothingHappened}</p>}
          {r.cards.map((id) => {
            const card = m.events.find((e) => e.id === id)!;
            return (
              <div key={id} className="card-row">
                <div>
                  <b>{L(card.name)}</b> <span className="note">{L(card.story)}</span>
                  {card.realCase && (
                    <div className="real-case">
                      <span className="real-tag">{t.realCase}</span> {L(card.realCase.text)}
                      {card.realCase.sources.map((id) => { const src = SOURCE_BY_ID.get(id); return src ? <a key={id} href={src.url} target="_blank" rel="noreferrer" className="src">{src.publisher}</a> : null; })}
                    </div>
                  )}
                </div>
                <div className="badges">
                  {game.agencies.map((a) => {
                    const res = r.results[a.id][id];
                    return res ? <span key={a.id} className={`badge ${RESULT_CLASS[res]}`}>{tk(t, `agency_${a.id}`)}: {tk(t, `result_${res}`)}</span> : null;
                  })}
                </div>
              </div>
            );
          })}
          <ul className="rivals">
            {game.agencies.filter((a) => a.id !== 'player').map((a) => {
              const chosen = m.slots.filter((s) => s.phase === r.phase).flatMap((s) => (a.picks[s.id] ?? []).map((id) => byId.get(id))).filter(Boolean).map((o) => L(o!.name));
              const d = agencyDesign(game, a);
              const used = Math.round((d.gauges.budget.used / Math.max(m.budgetKUSD.value, 1)) * 100);
              return <li key={a.id}><b>{tk(t, `agency_${a.id}`)}</b>: {chosen.join('、') || '—'} <span className="note">{fmt(t.budgetUsed, { n: used })}</span></li>;
            })}
          </ul>
        </div>
      ))}
    </section>
  );
}

/** Final standings and the post-game analysis: which decisions made the difference on the same events. */
export function FinalResults({ game, onRestart, onReplaySame, onAllTurns }: { game: Game; onRestart: () => void; onReplaySame: () => void; onAllTurns: () => void }) {
  const { t, L } = useLang();
  const m = game.mission;
  const final = game.final!;
  const order = [...game.agencies].sort((a, b) => final[b.id].score.total - final[a.id].score.total);
  const name = (id: AgencyKind) => tk(t, `agency_${id}`);
  const causeName = useCauseName(m);
  const outcomeName = useOutcomeName(m);
  const rank = order.findIndex((a) => a.id === 'player') + 1;
  const parts = ['primary', 'secondary', 'science', 'budget', 'schedule'] as const;

  // The standard design flown through the same cards and the same failure draws as the player.
  const standardScore = useMemo(() => {
    const d = evaluate(m, {});
    const all = new Set(game.reports.flatMap((r) => r.cards));
    const results = new Map<string, EventResult>();
    for (const id of all) results.set(id, resolveEvent(m.events.find((e) => e.id === id)!, d).result);
    return simulate(m, d, new Rng(game.seed, 'failures:player'), { drawn: all, results }).score.total;
  }, [game, m]);

  // Cards that hit some agencies but not others: where the decisions made the difference.
  const flew = (a: AgencyKind, phase: number) => phase < 5 || !['noLaunch', 'launchFailure', 'orbitFailure'].includes(final[a].outcome);
  const diffs = game.reports.flatMap((r) => r.cards.map((id) => ({ r, card: m.events.find((e) => e.id === id)! }))).filter(({ r, card }) => {
    const res = game.agencies.filter((a) => flew(a.id, r.phase)).map((a) => r.results[a.id][card.id]);
    const bad = res.filter((x) => x === 'hit' || x === 'partial' || x === 'missed').length;
    return bad > 0 && bad < res.length;
  });

  return (
    <section className="panel final">
      <div className="card-head">
        <h2>{t.finalTitle}</h2>
        <b className="final-rank">{fmt(t.resultsRank, { n: rank })}</b>
      </div>
      <div className="final-bars">
        {order.map((a, i) => {
          const r = final[a.id];
          return (
            <div key={a.id} className={`fb-row appear ${a.id === 'player' ? 'me' : ''}`} style={{ animationDelay: `${(order.length - 1 - i) * 0.4}s` }}>
              <span className="fb-rank">{i + 1}</span>
              <span className="fb-name"><AgencyLabel id={a.id} /></span>
              <span className="fb-bar" title={fmt(t.breakdownLine, { p: r.score.primary, s: r.score.secondary, sc: Math.round(r.score.science * 10) / 10, b: Math.round(r.score.budget * 10) / 10, d: r.score.schedule })}>
                {parts.map((k) => <span key={k} className={`fb-part fb-${k}`} style={{ width: `${r.score[k]}%` }} />)}
              </span>
              <b className="fb-total">{r.score.total}</b>
              <span className="fb-outcome">
                <span className="swatch" style={{ background: OUTCOME_COLOR[r.outcome] }} />{outcomeName(r.outcome)}
                {r.outcome !== 'fullSuccess' && r.causes[0] && causeName(r.causes[0]) !== outcomeName(r.outcome) && <span className="note small"> · {causeName(r.causes[0])}</span>}
                <span className="note small"> · {r.delivered.toLocaleString()} {L(m.rules.scienceUnit)}</span>
              </span>
            </div>
          );
        })}
        <div className="fb-legend">{parts.map((k) => <span key={k}><span className={`fb-part fb-${k}`} />{tk(t, `part_${k}`)}</span>)}</div>
        <p className="note">{fmt(t.standardWouldScore, { s: standardScore })} → {name('player')} {final.player.score.total}</p>
      </div>

      <h3>{t.lessonsTitle}</h3>
      {diffs.length === 0 ? <p className="note">{t.noLessons}</p> : (
        <div className="lesson-boxes">
          {diffs.map(({ r, card }) => (
            <div key={card.id} className="lesson-box">
              <b>{L(card.name)}</b> <span className="note small">{fmt(t.phaseTab, { n: r.phase, name: tk(t, `phase${r.phase}`) })}</span>
              <div className="lesson-marks">
                {game.agencies.map((a) => {
                  const x = r.results[a.id][card.id];
                  return <span key={a.id} className={`badge ${x ? RESULT_CLASS[x] : ''}`}><AgencyLabel id={a.id} /> {x ? RESULT_MARK[x] : '—'}</span>;
                })}
              </div>
              {game.agencies.filter((a) => flew(a.id, r.phase) && ['hit', 'partial', 'missed'].includes(r.results[a.id][card.id] ?? '')).map((a) => (
                <div key={a.id} className="note small">→ {fmt(L(card.lesson), { agency: name(a.id) })}</div>
              ))}
            </div>
          ))}
        </div>
      )}
      <div className="mission-actions">
        <button type="button" className="primary" onClick={onRestart}>{t.playAgain}</button>
        <button type="button" className="secondary" onClick={onReplaySame}>{t.samePlayAgain}</button>
        <button type="button" className="secondary" onClick={onAllTurns}>⤢ {t.showAllReports}</button>
      </div>
    </section>
  );
}

/** Final screen: the flight of the last phase first, then the standings; the history behind a button. */
export function FinalScreen({ game, onRestart, onReplaySame }: { game: Game; onRestart: () => void; onReplaySame: () => void }) {
  const { t } = useLang();
  const [open, setOpen] = useState(false);
  const [flight, setFlight] = useState(true);
  return (
    <div className="final-screen">
      <FinalResults game={game} onRestart={onRestart} onReplaySame={onReplaySame} onAllTurns={() => setOpen(true)} />
      {flight && <Resolution game={game} phase={5} onClose={() => setFlight(false)} />}
      {open && <Modal title={t.reportsTitle} wide onClose={() => setOpen(false)}><TurnReports game={game} heading={false} /></Modal>}
    </div>
  );
}
