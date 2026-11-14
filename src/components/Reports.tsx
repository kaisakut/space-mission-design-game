import type { EventResult } from '../engine/events';
import { agencyDesign, type AgencyKind, type Game } from '../engine/game';
import { fmt, tk, useLang } from '../i18n';
import { useState } from 'react';
import { OUTCOME_COLOR, useCauseName, useOutcomeName } from './labels';
import { Modal } from './Modal';

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
                <div><b>{L(card.name)}</b> <span className="note">{L(card.story)}</span></div>
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
export function FinalResults({ game, onRestart, extra }: { game: Game; onRestart: () => void; extra?: React.ReactNode }) {
  const { t, L } = useLang();
  const m = game.mission;
  const final = game.final!;
  const order = [...game.agencies].sort((a, b) => final[b.id].score.total - final[a.id].score.total);
  const name = (id: AgencyKind) => tk(t, `agency_${id}`);
  const causeName = useCauseName(m);
  const outcomeName = useOutcomeName(m);

  // Lessons: cards that hit some agencies but not others.
  const lessons: string[] = [];
  for (const r of game.reports) for (const id of r.cards) {
    const card = m.events.find((e) => e.id === id)!;
    // Agencies whose satellite never reached operations did not really face the operations cards.
    const flew = (a: AgencyKind) => r.phase < 5 || !['noLaunch', 'launchFailure', 'orbitFailure'].includes(final[a].outcome);
    const res = game.agencies.filter((a) => flew(a.id)).map((a) => [a.id, r.results[a.id][id]] as const);
    const bad = res.filter(([, x]) => x === 'hit' || x === 'partial' || x === 'missed').map(([a]) => a);
    if (bad.length > 0 && bad.length < res.length) for (const a of bad) lessons.push(fmt(L(card.lesson), { agency: name(a) }));
  }

  return (
    <section className="panel final">
      <h2>{t.finalTitle}</h2>
      <table className="br-table">
        <thead><tr><th>{t.rank}</th><th>{t.agency}</th><th>{t.outcome}</th><th>{t.total}</th><th>{t.breakdown}</th><th>{t.delivered}</th></tr></thead>
        <tbody>
          {order.map((a, i) => {
            const r = final[a.id];
            const s = r.score;
            return (
              <tr key={a.id} className={a.id === 'player' ? 'me' : ''}>
                <td>{i + 1}</td>
                <td>{name(a.id)}</td>
                <td>
                  <span className="swatch" style={{ background: OUTCOME_COLOR[r.outcome] }} />{outcomeName(r.outcome)}
                  {r.outcome !== 'fullSuccess' && r.causes[0] && causeName(r.causes[0]) !== outcomeName(r.outcome) && <div className="note small">{causeName(r.causes[0])}</div>}
                </td>
                <td><b>{s.total}</b></td>
                <td className="note">{fmt(t.breakdownLine, { p: s.primary, s: s.secondary, sc: Math.round(s.science * 10) / 10, b: Math.round(s.budget * 10) / 10, d: s.schedule })}</td>
                <td>{r.delivered.toLocaleString()} {L(m.rules.scienceUnit)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <h3>{t.lessonsTitle}</h3>
      {lessons.length ? <ul>{lessons.map((x, i) => <li key={i}>{x}</li>)}</ul> : <p className="note">{t.noLessons}</p>}
      <div className="mission-actions">
        <button type="button" className="primary" onClick={onRestart}>{t.playAgain}</button>
        {extra}
      </div>
    </section>
  );
}

/** The last turn in a few lines, for the side of the game screen; the full history opens in a dialog. */
export function LatestReport({ game, open, onOpen, onClose }: { game: Game; open: boolean; onOpen: () => void; onClose: () => void }) {
  const { t, L } = useLang();
  const m = game.mission;
  const r = game.reports[game.reports.length - 1];
  return (
    <section className="card latest">
      <div className="card-head">
        <h2>{r ? `${t.latestReport}: ${fmt(t.phaseTab, { n: r.phase, name: tk(t, `phase${r.phase}`) })}` : t.reportsTitle}</h2>
        {r && <button type="button" className="secondary" onClick={onOpen}>⤢ {t.showAllReports}</button>}
      </div>
      {!r && <p className="note">{t.noReportYet}</p>}
      {r && r.cards.length === 0 && <p className="note">{t.nothingHappened}</p>}
      {r?.cards.map((id) => {
        const card = m.events.find((e) => e.id === id)!;
        return (
          <div key={id} className="latest-row" title={L(card.story)}>
            <b>{L(card.name)}</b>
            <span className="badges">
              {game.agencies.map((a) => {
                const res = r.results[a.id][id];
                return res ? <span key={a.id} className={`badge ${RESULT_CLASS[res]}`}>{tk(t, `agency_${a.id}`)}</span> : null;
              })}
            </span>
          </div>
        );
      })}
      {r && (
        <div className="latest-rivals">
          <span className="field">{t.rivalsTitle}</span>{' '}
          {game.agencies.filter((a) => a.id !== 'player').map((a) => {
            const used = Math.round((agencyDesign(game, a).gauges.budget.used / Math.max(m.budgetKUSD.value, 1)) * 100);
            return <span key={a.id} className="note">{tk(t, `agency_${a.id}`)} {fmt(t.budgetUsed, { n: used })} </span>;
          })}
        </div>
      )}
      {open && <Modal title={t.reportsTitle} wide onClose={onClose}><TurnReports game={game} heading={false} /></Modal>}
    </section>
  );
}

/** Final screen: the standings on one screen, with the turn-by-turn history behind a button. */
export function FinalScreen({ game, onRestart }: { game: Game; onRestart: () => void }) {
  const { t } = useLang();
  const [open, setOpen] = useState(false);
  return (
    <div className="final-screen">
      <FinalResults game={game} onRestart={onRestart} extra={<button type="button" className="secondary" onClick={() => setOpen(true)}>⤢ {t.showAllReports}</button>} />
      {open && <Modal title={t.reportsTitle} wide onClose={() => setOpen(false)}><TurnReports game={game} heading={false} /></Modal>}
    </div>
  );
}
