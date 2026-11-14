import { SOURCE_BY_ID } from '../data/sources';
import type { EventCard } from '../data/types';
import type { EventResult } from '../engine/events';
import { evaluate } from '../engine/design';
import { play, stopAll } from '../audio/sfx';
import { resolveEvent } from '../engine/events';
import { agencyDesign, type AgencyKind, type Game } from '../engine/game';
import { Rng } from '../engine/rng';
import { firstFailure, simulate } from '../engine/simulate';
import { fmt, tk, useLang } from '../i18n';
import { useEffect, useMemo, useState } from 'react';
import { OUTCOME_COLOR, RESULT_MARK, useAgencyName, useCardText, useCauseName, useOutcomeName } from './labels';
import { Modal } from './Modal';
import { AgencyLabel, Resolution } from './Resolution';

const RESULT_CLASS: Record<EventResult, string> = { protected: 'good', ready: 'good', partial: 'warn', hit: 'bad', missed: 'warn' };

/** What happened after each confirmed phase: the shared cards, how each agency fared, and what the rivals chose. */
export function TurnReports({ game, heading = true, viewer = 'player' }: { game: Game; heading?: boolean; viewer?: AgencyKind }) {
  const { t, L } = useLang();
  const agencyName = useAgencyName();
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
                    return res ? <span key={a.id} className={`badge ${RESULT_CLASS[res]}`}>{agencyName.name(a.id)}: {tk(t, `result_${res}`)}</span> : null;
                  })}
                </div>
              </div>
            );
          })}
          <ul className="rivals">
            {game.agencies.filter((a) => a.id !== viewer).map((a) => {
              const chosen = m.slots.filter((s) => s.phase === r.phase).flatMap((s) => (a.picks[s.id] ?? []).map((id) => byId.get(id))).filter(Boolean).map((o) => L(o!.name));
              const d = agencyDesign(game, a);
              const used = Math.round((d.gauges.budget.used / Math.max(m.budgetKUSD.value, 1)) * 100);
              return <li key={a.id}><b>{agencyName.name(a.id)}</b>: {chosen.join('、') || '—'} <span className="note">{fmt(t.budgetUsed, { n: used })}</span></li>;
            })}
          </ul>
        </div>
      ))}
    </section>
  );
}

type Part = 'primary' | 'secondary' | 'science' | 'budget' | 'schedule';
const PARTS: Part[] = ['primary', 'secondary', 'science', 'budget', 'schedule'];
const BAD = new Set(['hit', 'partial', 'missed']);

/** Final standings and the post-game analysis: why the ranking came out as it did, on the same events. */
export function FinalResults({ game, onRestart, onReplaySame, onAllTurns }: { game: Game; onRestart: () => void; onReplaySame: () => void; onAllTurns: () => void }) {
  const { t, L } = useLang();
  const m = game.mission;
  const final = game.final!;
  const text = useCardText(m);
  const order = [...game.agencies].sort((a, b) => final[b.id].score.total - final[a.id].score.total);
  const agencyName = useAgencyName();
  const name = (id: AgencyKind) => agencyName.name(id);
  // Inside a sentence the player is "you", not "Your agency".
  const nameIn = (id: AgencyKind, start = false) => (id === 'player' ? (start ? t.youStart : t.youIn) : name(id));
  const lessonFor = (card: EventCard, id: AgencyKind) => {
    const raw = L(card.lesson);
    if (id !== 'player') return fmt(raw, { agency: name(id) });
    return raw.replace(/^\{agency\}/, t.youStart).replace(/\{agency\}[’']s/g, t.yourIn).replace(/\{agency\}/g, t.youIn);
  };
  // "A and B"; three or more: "A, B and C" (Japanese: 「A、B、C」).
  const names = (ids: AgencyKind[], start = true) => {
    const n = ids.map((id, i) => nameIn(id, start && i === 0));
    return n.length <= 2 ? n.join(t.andSep) : `${n.slice(0, -1).join(t.commaSep)}${t.andLastSep}${n[n.length - 1]}`;
  };
  const causeName = useCauseName(m);
  const outcomeName = useOutcomeName(m);
  const rank = order.findIndex((a) => a.id === 'player') + 1;
  const ord = (n: number) => tk(t, `ord${n}`);
  const step = 0.5;
  const rankAt = order.length * step + 0.2;
  useEffect(() => {
    order.forEach((_, i) => play('barRise', (order.length - 1 - i) * step));
    play(rank === 1 ? 'rankFirst' : 'rank', rankAt);
    return () => stopAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const designs = useMemo(() => new Map(game.agencies.map((a) => [a.id, agencyDesign(game, a)])), [game]);
  const budget = Math.max(m.budgetKUSD.value, 1);

  /** The value behind each score part, shown next to a gap. */
  const detail = (id: AgencyKind | 'standard', k: Part, r = id === 'standard' ? null : final[id], d = id === 'standard' ? null : designs.get(id)!): string => {
    if (!r || !d) return '';
    switch (k) {
      case 'primary': return outcomeName(r.outcome);
      case 'secondary': return m.secondary.filter((o) => o.chosenBy && d.tags.has(o.chosenBy)).map((o) => L(o.name)).join(t.listSep) || t.whyNone;
      case 'science': return `${r.delivered.toLocaleString()} ${L(m.rules.scienceUnit)}`;
      case 'budget': return fmt(t.whyBudgetUsed, { n: Math.round((d.totalSpentKUSD / budget) * 100) });
      case 'schedule': {
        const windows = d.launch ? [...d.launch.windowsDay.value].sort((x, y) => x - y) : [];
        const w = r.launchDay === null ? -1 : windows.indexOf(r.launchDay);
        return w < 0 ? t.whyNoLaunch : fmt(t.whyWindow, { n: w + 1 });
      }
    }
  };
  const gaps = (a: AgencyKind, b: AgencyKind) => PARTS.map((k) => ({ k, x: final[a].score[k] - final[b].score[k] })).filter((g) => Math.abs(g.x) >= 0.05).sort((p, q) => Math.abs(q.x) - Math.abs(p.x)).slice(0, 3);
  const sign = (x: number) => `${x > 0 ? '+' : x < 0 ? '−' : '±'}${Math.abs(Math.round(x * 10) / 10)}`;

  // What the rival compared with picked differently, the options most related to the biggest gap first.
  const differently = (rival: AgencyKind, gapParts: Part[]) => {
    const me = game.agencies.find((a) => a.id === 'player')!, other = game.agencies.find((a) => a.id === rival)!;
    const byId = new Map(m.options.map((o) => [o.id, o]));
    const rows = m.slots.flatMap((s) => (other.picks[s.id] ?? []).filter((id) => !(me.picks[s.id] ?? []).includes(id)).map((id) => {
      const o = byId.get(id)!;
      const mine = (me.picks[s.id] ?? []).map((x) => byId.get(x)!).filter(Boolean);
      const costGap = Math.abs(o.cost.value - mine.reduce((a, x) => a + x.cost.value, 0));
      const related = (k: Part) =>
        k === 'science' || k === 'primary' ? s.role === 'science' || s.role === 'powerComms' || o.kind === 'orbit'
        : k === 'secondary' ? !!o.tags?.some((x) => x.startsWith('goal:'))
        : k === 'schedule' ? !!o.leadDays || /window|launch/.test(s.id)
        : costGap > 0;
      const rel = gapParts.findIndex(related);
      return { o, rel: rel < 0 ? 9 : rel, costGap };
    }));
    return rows.sort((p, q) => p.rel - q.rel || q.costGap - p.costGap).slice(0, 2).map((r) => L(r.o.name));
  };

  // The auto-plan flown through the same cards and the same failure draws as the player.
  const standard = useMemo(() => {
    const d = evaluate(m, {});
    const all = new Set(game.reports.flatMap((r) => r.cards));
    const results = new Map<string, EventResult>();
    for (const id of all) results.set(id, resolveEvent(m.events.find((e) => e.id === id)!, d).result);
    return { d, r: simulate(m, d, new Rng(game.seed, 'failures:player'), { drawn: all, results }), results };
  }, [game, m]);

  // Cards that hit some agencies but not others: where the decisions made the difference.
  const flew = (a: AgencyKind, phase: number) => phase < 5 || !['noLaunch', 'launchFailure', 'orbitFailure'].includes(final[a].outcome);
  const diffs = game.reports.flatMap((r) => r.cards.map((id) => ({ r, card: m.events.find((e) => e.id === id)! }))).filter(({ r, card }) => {
    const res = game.agencies.filter((a) => flew(a.id, r.phase)).map((a) => r.results[a.id][card.id]);
    const bad = res.filter((x) => BAD.has(x ?? '')).length;
    return bad > 0 && bad < res.length;
  });

  /** How much a card really cost an agency: the effect itself, or, for a raised failure risk, whether a part then failed. */
  const harm = (card: EventCard, a: AgencyKind, res: EventResult) => {
    const es = (res === 'partial' ? card.partial : card.unprotected) ?? [];
    const subs = es.filter((e) => e.kind === 'failChance').map((e) => (e as { subsystem: string }).subsystem);
    if (es.length > 0 && subs.length === es.length) {
      const f = final[a].failures.find((x) => subs.includes(x.sub));
      const ff = f ? firstFailure(final[a], m.opsDays.value) : null;
      return f && ff ? `${fmt(t.failedLost, { n: ff.day })}${ff.goalMet ? t.afterGoal : t.beforeGoal}` : t.riskRoseNoFailure;
    }
    return text.resultLine(card, res);
  };

  const leader = order[0]!.id === 'player' ? order[1]!.id : order[0]!.id;
  const why = gaps('player', leader);
  const me = final.player;
  const std = standard.r;
  const stdGaps = PARTS.map((k) => ({ k, x: me.score[k] - std.score[k] })).filter((g) => Math.abs(g.x) >= 0.05).sort((p, q) => Math.abs(q.x) - Math.abs(p.x)).slice(0, 2);
  const stdDiff = Math.round((me.score.total - std.score.total) * 10) / 10;
  // Cards that the auto-plan took but the player avoided, where only a failure risk rose and nothing failed.
  const stdLucky = game.reports.flatMap((r) => r.cards).map((id) => m.events.find((e) => e.id === id)!).filter((card) => {
    const sr = standard.results.get(card.id), mr = game.reports.find((r) => r.cards.includes(card.id))!.results.player[card.id];
    if (!sr || !BAD.has(sr) || (mr && BAD.has(mr))) return false;
    const es = (sr === 'partial' ? card.partial : card.unprotected) ?? [];
    const subs = es.filter((e) => e.kind === 'failChance').map((e) => (e as { subsystem: string }).subsystem);
    return es.length > 0 && subs.length === es.length && !std.failures.some((f) => subs.includes(f.sub));
  });
  const extraK = Math.round(designs.get('player')!.totalSpentKUSD - standard.d.totalSpentKUSD);
  const stdReason = [
    extraK > 0 && me.score.budget < std.score.budget ? fmt(t.stdCostMore, { k: extraK.toLocaleString(), x: sign(me.score.budget - std.score.budget) }) : '',
    stdLucky.length ? fmt(t.stdLucky, { cards: stdLucky.map((c) => L(c.name)).join(t.listSep) }) : '',
  ].filter(Boolean).join(' ');

  const d = (sec: number) => ({ animationDelay: `${sec}s` });
  return (
    <section className="panel final">
      <div className="card-head">
        <h2>{t.finalTitle}</h2>
        <span className="final-tags">
          {game.practice && <span className="tag-practice">{t.tagPractice}</span>}
          <span className="tag-setting">{game.hints ? t.tagHintsOn : t.tagHintsOff}</span>
        </span>
        <b className="final-rank appear" style={d(rankAt)}>{fmt(t.resultsRank, { n: ord(rank) })}</b>
      </div>
      {game.mode !== 'multi' && game.hintsUsed.player > 0 && <p className="note small final-hints">{fmt(t.hintsUsed, { n: game.hintsUsed.player })}</p>}
      <div className="final-bars">
        {order.map((a, i) => {
          const r = final[a.id];
          const at = (order.length - 1 - i) * step;
          return (
            <div key={a.id} className={`fb-row appear ${a.id === 'player' ? 'me' : ''}`} style={d(at)}>
              <span className="fb-rank">{i + 1}</span>
              <span className="fb-name"><AgencyLabel id={a.id} /></span>
              <span className="fb-bar grow" style={d(at)} title={fmt(t.breakdownLine, { p: r.score.primary, s: r.score.secondary, sc: Math.round(r.score.science * 10) / 10, b: Math.round(r.score.budget * 10) / 10, d: r.score.schedule })}>
                {PARTS.map((k) => <span key={k} className={`fb-part fb-${k}`} style={{ width: `${r.score[k]}%` }} />)}
              </span>
              <b className="fb-total">{r.score.total}</b>
              <span className="fb-outcome">
                <span className="swatch" style={{ background: OUTCOME_COLOR[r.outcome] }} />{outcomeName(r.outcome)}
                {r.outcome !== 'fullSuccess' && r.causes[0] && causeName(r.causes[0]) !== outcomeName(r.outcome) && <span className="note small"> · {causeName(r.causes[0])}</span>}
                {(() => { const ff = firstFailure(r, m.opsDays.value); return ff?.goalMet && ff.fatal ? <span className="note small"> · {fmt(t.lostOnDay, { n: ff.day })}</span> : null; })()}
                <span className="note small"> · {r.delivered.toLocaleString()} {L(m.rules.scienceUnit)}</span>
              </span>
            </div>
          );
        })}
        <div className="fb-legend">{PARTS.map((k) => <span key={k}><span className={`fb-part fb-${k}`} />{tk(t, `part_${k}`)}</span>)}</div>
      </div>

      <div className="why-row appear" style={d(rankAt + 0.4)}>
        <div className="why-box">
          <h3>{rank === 1 ? t.whyWon : fmt(t.whyRank, { n: ord(rank) })}</h3>
          {!['fullSuccess', 'partialSuccess'].includes(me.outcome) && me.causes[0] && <p className="why-cause">✕ {outcomeName(me.outcome)}: {causeName(me.causes[0])}</p>}
          <p><b>{fmt(rank === 1 ? t.leadOverSecond : t.gapToFirst, { x: sign(me.score.total - final[leader].score.total) })}</b> <span className="note small">({name(leader)})</span></p>
          <table className="why-table"><tbody>
            {why.map((g) => (
              <tr key={g.k}>
                <th><span className={`fb-part fb-${g.k}`} />{tk(t, `part_${g.k}`)}</th>
                <td className={g.x < 0 ? 'bad' : 'good'}>{sign(g.x)}</td>
                <td className="note small">{fmt(t.whyVs, { a: detail('player', g.k), b: detail(leader, g.k) })}</td>
              </tr>
            ))}
          </tbody></table>
          {(() => { const list = differently(leader, why.filter((g) => (rank === 1 ? g.x > 0 : g.x < 0)).map((g) => g.k)); return list.length > 0 && <p className="small"><span className="note">{fmt(t.didDifferently, { agency: name(leader) })}</span> {list.join(' · ')}</p>; })()}
        </div>
        <div className="why-box">
          <h3>{t.vsAutoPlan}</h3>
          <p>{fmt(t.standardWouldScore, { s: std.score.total })} → <b>{name('player')} {me.score.total}</b> <span className={stdDiff < 0 ? 'bad' : 'good'}>({sign(stdDiff)})</span></p>
          <table className="why-table"><tbody>
            {stdGaps.map((g) => (
              <tr key={g.k}>
                <th><span className={`fb-part fb-${g.k}`} />{tk(t, `part_${g.k}`)}</th>
                <td className={g.x < 0 ? 'bad' : 'good'}>{sign(g.x)}</td>
                <td className="note small">{fmt(t.whyVs, { a: detail('player', g.k), b: detail('standard', g.k, std, standard.d) })}</td>
              </tr>
            ))}
          </tbody></table>
          {stdGaps.length === 0 && <p className="note small">{t.vsAutoSame}</p>}
          {stdReason && <p className="small">{stdReason}</p>}
        </div>
      </div>

      <div className="appear" style={d(rankAt + 0.8)}>
        <h3>{t.lessonsTitle}</h3>
        {diffs.length === 0 ? <p className="note">{t.noLessons}</p> : (
          <div className="lesson-boxes">
            {diffs.map(({ r, card }) => {
              const who = game.agencies.filter((a) => flew(a.id, r.phase)).map((a) => a.id);
              const good = who.filter((a) => !BAD.has(r.results[a][card.id] ?? ''));
              const bad = who.filter((a) => BAD.has(r.results[a][card.id] ?? ''));
              const why1 = (a: AgencyKind) => text.resultLine(card, r.results[a][card.id]!) || '—';
              const summary = good.length === 1
                ? good[0] === 'player' ? fmt(t.onlyYouProtected, { why: why1('player') }) : fmt(t.onlyOneProtected, { agency: name(good[0]!), why: why1(good[0]!) })
                : bad.length === 1 ? `${bad[0] === 'player' ? t.onlyYouHit : fmt(t.onlyOneHit, { agency: name(bad[0]!) })} ${lessonFor(card, bad[0]!)}`
                : fmt(t.splitResult, { good: names(good), bad: names(bad, false) });
              // The harm, grouped so the same line is not repeated for each agency.
              const harms = new Map<string, AgencyKind[]>();
              for (const a of bad) { const h = harm(card, a, r.results[a][card.id]!); harms.set(h, [...(harms.get(h) ?? []), a]); }
              return (
                <div key={card.id} className="lesson-box">
                  <b>{L(card.name)}</b> <span className="note small">{fmt(t.phaseTab, { n: r.phase, name: tk(t, `phase${r.phase}`) })}</span>
                  <div className="lesson-marks">
                    {game.agencies.map((a) => {
                      const x = r.results[a.id][card.id];
                      return <span key={a.id} className={`badge ${x ? RESULT_CLASS[x] : ''}`}><AgencyLabel id={a.id} /> {x ? RESULT_MARK[x] : '—'}</span>;
                    })}
                  </div>
                  <div className="small">{summary}</div>
                  {[...harms].map(([h, ids]) => h && <div key={h} className="note small">→ {names(ids)}: {h}</div>)}
                </div>
              );
            })}
          </div>
        )}
      </div>
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
      {/* The standings appear only after the flight scene, so the ending is not given away. */}
      {!flight && <FinalResults game={game} onRestart={onRestart} onReplaySame={onReplaySame} onAllTurns={() => setOpen(true)} />}
      {flight && <Resolution game={game} phase={5} onClose={() => setFlight(false)} />}
      {open && <Modal title={t.reportsTitle} wide onClose={() => setOpen(false)}><TurnReports game={game} heading={false} /></Modal>}
    </div>
  );
}
