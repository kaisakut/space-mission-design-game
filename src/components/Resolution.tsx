import { useEffect, useMemo } from 'react';
import { play, stopAll } from '../audio/sfx';
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

/**
 * Shown over the game right after a phase is confirmed: what each agency chose, the shared cards
 * turning over, how each agency fared, and the standing so far. After the last phase it adds the flight.
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

  // Standing: each agency's forecast median now (or the real score once the mission has flown).
  const standing = useMemo(() => game.agencies.map((a) => ({
    id: a.id,
    score: game.final ? game.final[a.id].score.total : agencyForecast(game, a, a.picks, 60, 'standing').score.p50,
  })).sort((x, y) => y.score - x.score), [game]);

  useEffect(() => {
    if (!report) return;
    report.cards.forEach((id, k) => {
      play(/storm|flare/.test(id) ? 'storm' : 'cardFlip', 0.7 + k * 0.9);
      game.agencies.forEach((a, i) => {
        const r = report.results[a.id][id];
        if (r) play(r === 'protected' || r === 'ready' ? 'markGood' : r === 'partial' ? 'markPartial' : 'markBad', 1.2 + k * 0.9 + i * 0.25);
      });
    });
    if (game.final) {
      const flown = game.agencies.filter((a) => !['noLaunch'].includes(game.final![a.id].outcome));
      if (flown.length) play('launch', 0.3);
      if (game.agencies.some((a) => game.final![a.id].outcome === 'launchFailure')) play('launchFail', 1.5);
      play(game.agencies.some((a) => game.final![a.id].outcome === 'orbitFailure') ? 'noContact' : 'contact', 1.8);
    }
    return () => stopAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  return (
    <div className="modal resolution" role="dialog" aria-label={fmt(t.resolutionTitle, { n: phase, name: tk(t, `phase${phase}`) })}>
      <div className="modal-body wide">
        <div className="modal-head">
          <h2>{fmt(t.resolutionTitle, { n: phase, name: tk(t, `phase${phase}`) })}</h2>
          <button type="button" className="primary" onClick={onClose}>{t.next} ▶</button>
        </div>

        <div className="res-grid">
          {game.agencies.map((a, i) => {
            const d = agencyDesign(game, a);
            const used = Math.round((d.gauges.budget.used / Math.max(m.budgetKUSD.value, 1)) * 100);
            return (
              <div key={a.id} className="res-col appear" style={{ animationDelay: `${i * 0.15}s`, borderTopColor: AGENCY_COLOR[a.id] }}>
                <AgencyLabel id={a.id} />
                <ul className="res-picks">
                  {slots.flatMap((s) => (a.picks[s.id] ?? []).map((id) => {
                    const changed = !(standard[s.id] ?? []).includes(id);
                    return <li key={`${s.id}-${id}`} className={changed ? 'changed' : ''} title={changed ? t.changedFromStandard : undefined}>{L(byId.get(id)!.name)}</li>;
                  }))}
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

        {report.cards.length === 0 ? (
          <div className="res-none appear" style={{ animationDelay: '0.7s' }}>
            <p><b>{t.nothingThisTime}</b></p>
            {possible.length > 0 && <p className="note">{fmt(t.couldHaveBeen, { list: possible.map((e) => `${L(e.name)} ${Math.round(e.probability.value * 100)}%`).join(t.listSep) })}</p>}
          </div>
        ) : report.cards.map((id, k) => {
          const card = m.events.find((e) => e.id === id)!;
          return (
            <div key={id} className="res-card">
              <div className="res-event flip" style={{ animationDelay: `${0.7 + k * 0.9}s` }}>
                <b>{card.readyIf ? '＋ ' : '− '}{L(card.name)}</b>
                <span>{L(card.story)}</span>
                {card.probability.value > 0 && <span className="note small">{Math.round(card.probability.value * 100)}%</span>}
                {card.realCase && <span className="real-case"><span className="real-tag">{t.realCase}</span> {card.realCase.year ? `${card.realCase.year} · ` : ''}{L(card.realCase.who)}</span>}
              </div>
              <div className="res-grid">
                {game.agencies.map((a, i) => {
                  const r = report.results[a.id][id];
                  return (
                    <div key={a.id} className={`res-mark appear ${r ? RESULT_CLASS[r] : ''}`} style={{ animationDelay: `${1.2 + k * 0.9 + i * 0.25}s` }}>
                      {r ? <><b>{RESULT_MARK[r]} {tk(t, `result_${r}`)}</b><span className="small">{text.resultLine(card, r)}</span></> : '—'}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}

        {!game.final && (
          <div className="res-standing">
            <span className="note">{t.standingTitle}</span>
            {standing.map((s, i) => <span key={s.id} className="res-rank"><b>{i + 1}</b> <AgencyLabel id={s.id} /> {Math.round(s.score * 10) / 10}</span>)}
          </div>
        )}
      </div>
    </div>
  );
}
