import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import type { EventCard, Mission, Option } from '../data/types';
import { agencyDesign, type Agency, type Game } from '../engine/game';
import { firstFailure, outcomeCause } from '../engine/simulate';
import { fmt, useLang } from '../i18n';
import type { FlightScene } from '../view/flightCommon';
import type { FlightModel } from '../view/flightScene';
import type { JupiterFlightModel } from '../view/flightJupiter';
import type { MoonFlightModel } from '../view/flightMoon';
import { CountUp } from './ForecastPanel';
import { AGENCY_COLOR, RESULT_MARK, useAgencyName, useCauseName, useOutcomeName } from './labels';
import { EARTH_TEXTURE, earthModel, viewModel, webglOk } from './MissionView';
import { AgencyLabel, CardIcon } from './Resolution';

/** Seconds of the operating year on screen. */
const OPS = 5;
/** Seconds the flight scene takes, so the resolution scene knows when it has finished. */
export const FLIGHT_SECONDS = 1 + 4 * 0.5 + 1 + OPS + 0.5;

/** A display month for a card, fixed by the game's seed (the engine does not give event times). */
/**
 * Where on the operations timeline (0–1) an event is shown. Cards that happen at the start of operations (landing,
 * arrival, the cruise) sit at the very beginning, a little apart when there are several; the rest are spread by a
 * fixed hash of the seed and the card, after that first stretch.
 */
const displayAt = (m: Mission, seed: number, id: string, cards: string[]) => {
  const atStart = (c: string) => m.events.find((e) => e.id === c)?.opsAt === 'start';
  if (atStart(id)) return 0.02 + cards.filter(atStart).indexOf(id) * 0.02;
  let h = seed >>> 0;
  for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 2654435761) >>> 0;
  return 0.15 + ((h % 1000) / 1000) * 0.77;
};

const reduceMotion = () => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

type AnyFlight = { kind: 'earth'; m: FlightModel } | { kind: 'moon'; m: MoonFlightModel } | { kind: 'jupiter'; m: JupiterFlightModel };

/** three.js and each flight scene load only when the flight is shown. */
const loadFlight = (f: AnyFlight, host: HTMLElement): Promise<FlightScene<unknown>> => {
  const rm = reduceMotion();
  if (f.kind === 'moon') return import('../view/flightMoon').then((x) => x.createMoonFlight(host, { reduceMotion: rm }) as FlightScene<unknown>);
  if (f.kind === 'jupiter') return import('../view/flightJupiter').then((x) => x.createJupiterFlight(host, { reduceMotion: rm }) as FlightScene<unknown>);
  return import('../view/flightScene').then((x) => x.createFlightScene(host, { reduceMotion: rm, textureUrl: EARTH_TEXTURE }) as FlightScene<unknown>);
};

/** The 3D flight (Earth, Moon or Jupiter). Falls back to nothing when WebGL is unavailable. */
function FlightView({ model, instant }: { model: AnyFlight; instant: boolean }) {
  const host = useRef<HTMLDivElement>(null);
  const scene = useRef<FlightScene<unknown> | null>(null);
  const [failed, setFailed] = useState(() => !webglOk());
  useEffect(() => {
    if (failed || !host.current) return;
    let alive = true;
    loadFlight(model, host.current).then((sc) => {
      if (!alive) { sc.dispose(); return; }
      scene.current = sc;
      sc.set(model.m);
      if (instant) sc.finish();
    }).catch(() => setFailed(true));
    return () => { alive = false; scene.current?.dispose(); scene.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [failed]);
  useEffect(() => { if (instant) scene.current?.finish(); }, [instant]);
  if (failed) return null;
  return <div ref={host} className="flight-canvas" aria-hidden="true" />;
}

/** The 2D launch pads, for missions without a 3D flight scene (and when WebGL is missing). */
function LaunchPads({ order, game, start }: { order: Agency[]; game: Game; start: number }) {
  const { t } = useLang();
  const final = game.final!;
  const causeName = useCauseName(game.mission);
  const d = (s: number) => ({ animationDelay: `${s}s` });
  return (
    <div className="launch-pads">
      {order.map((a, i) => {
        const r = final[a.id];
        const kind = r.outcome === 'noLaunch' ? 'stay' : r.outcome === 'launchFailure' ? 'fail' : 'ok';
        const delay = start + 0.6 + i * 0.5;
        return (
          <div key={a.id} className="pad">
            <div className="pad-sky">
              <div className="pad-orbit" />
              <div className={`rocket ${kind}`} style={{ ...d(delay), color: AGENCY_COLOR[a.id] }}>
                <svg viewBox="0 0 20 40" aria-hidden="true"><path d="M10 2c5 6 6 14 6 22l3 7h-6l-1 5h-4l-1-5H1l3-7c0-8 1-16 6-22z" fill="currentColor" /></svg>
              </div>
              {kind === 'fail' && <span className="pad-x appear" style={d(delay + 0.7)}>✕</span>}
              {kind === 'ok' && <span className={`pad-contact appear ${r.outcome === 'orbitFailure' ? 'dark' : ''}`} style={{ ...d(delay + 1.1), borderColor: AGENCY_COLOR[a.id] }} title={r.outcome === 'orbitFailure' ? t.flightNoSignal : t.flight_contact} />}
              {kind === 'stay' && <span className="pad-sign appear" style={d(delay)}>{t.flightNotLaunched}{outcomeCause(game.mission, r) ? `: ${causeName(outcomeCause(game.mission, r)!)}` : ''}</span>}
            </div>
            <AgencyLabel id={a.id} />
          </div>
        );
      })}
    </div>
  );
}

/**
 * After the last phase: the launches (in launch order) and the operating year in one large view, each agency's
 * delivered count as a bar against the best, a one-line reason where one fell far behind, and the year's
 * cards on a timeline. Every number comes from the engine's final runs; the view and the cards' months are
 * display only.
 */
export function Flight({ game, start, instant }: { game: Game; start: number; instant: boolean }) {
  // The event list shows whole rows only: its height is cut to the last row that fits (the rest scrolls).
  const evList = useRef<HTMLUListElement>(null);
  useLayoutEffect(() => {
    const el = evList.current, box = el?.parentElement;
    if (!el || !box) return;
    const fit = () => {
      el.style.maxHeight = '';
      const room = el.clientHeight;
      if (el.scrollHeight <= room + 1) return;
      const rows = [...el.children] as HTMLElement[];
      let h = 0;
      for (const r of rows) { const bottom = r.offsetTop - el.offsetTop + r.offsetHeight; if (bottom <= room) h = bottom; else break; }
      if (h > 0) el.style.maxHeight = `${h + 1}px`;
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(box);
    return () => ro.disconnect();
  });
  const { t, L, lang } = useLang();
  const names = useAgencyName();
  const m = game.mission;
  const final = game.final!;
  const causeName = useCauseName(m);
  const outcomeName = useOutcomeName(m);
  const order = [...game.agencies].sort((a, b) => (final[a.id].launchDay ?? 1e9) - (final[b.id].launchDay ?? 1e9));
  const opsAt = start + 1 + order.length * 0.5 + 1;
  const report5 = game.reports.find((r) => r.phase === 5);
  // In the order they happen on the timeline.
  const cards5 = report5?.cards ?? [];
  const at5 = (id: string) => displayAt(m, game.seed, id, cards5);
  const ops5 = [...cards5].sort((x, y) => at5(x) - at5(y));
  const usesDonki = m.events.some((e) => e.probability.sources?.includes('nasa-donki'));
  const years = m.opsDays.value / 365;
  // Month names in the game's language, not the browser's.
  const locale = lang === 'ja' ? 'ja-JP' : 'en-US';
  const ticks = years > 0.9 && years < 1.1
    ? Array.from({ length: 12 }, (_, i) => new Date(2000, i, 1).toLocaleString(locale, { month: 'short' }))
    : Array.from({ length: 5 }, (_, i) => fmt(t.flightDay, { n: Math.round((m.opsDays.value * i) / 4) }));
  const d = (s: number) => ({ animationDelay: `${s}s` });
  const flewOf = (o: string) => !['noLaunch', 'launchFailure', 'orbitFailure'].includes(o);
  const best = Math.max(0, ...game.agencies.map((a) => final[a.id].delivered));
  const designs = useMemo(() => new Map(game.agencies.map((a) => [a.id, agencyDesign(game, a)])), [game]);

  const stoppedEarly = (a: Agency) => { const r = final[a.id]; return r.opsFraction < 0.999 && (r.failures.length > 0 || r.outcome === 'lostInOps'); };
  /** Why an agency delivered far less than the best: the largest of its design's shortfalls. */
  // The reason under a row, chosen the same way for everyone. A craft that was lost: the event that raised the
  // chance of its failure, if any (its status line already names the failure). A craft that kept going: the
  // events that cut its results first, then what it carried or planned differently from the best one.
  const gapReason = (a: Agency): string | null => {
    const r = final[a.id];
    // Lost to a hidden fault: say what it was and what lowers it (the outcome's name alone does not).
    if (outcomeCause(m, r) === 'earlyFailure') { const ts = m.slots.find((s) => s.id === 'testing'); return fmt(t.hiddenFault, { item: ts ? L(ts.label) : '' }); }
    if (best <= 0 || !flewOf(r.outcome)) return null;
    const top = game.agencies.find((x) => final[x.id].delivered === best)!;
    const hurt = (id: string, who: Agency) => { const x = game.reports.find((rep) => rep.cards.includes(id))?.results[who.id][id]; return x === 'hit' || x === 'partial'; };
    if (stoppedEarly(a)) {
      // The failure named on the row above (the same as the results screen), and the events that made it likelier.
      const cause = outcomeCause(m, r);
      const firstFail = cause?.startsWith('fail:') ? { sub: cause.slice(5) } : null;
      if (!firstFail) return null;
      const raised = game.reports.flatMap((rep) => rep.cards).filter((id) => hurt(id, a) && m.events.find((e) => e.id === id)!.unprotected.concat(m.events.find((e) => e.id === id)!.partial ?? []).some((e) => e.kind === 'failChance' && e.subsystem === firstFail.sub));
      return raised.length ? fmt(t.gap_raisedBy, { list: raised.map((id) => L(m.events.find((e) => e.id === id)!.name)).join(t.listSep) }) : null;
    }
    if (r.delivered >= best * 0.7) return null;
    const hits = game.reports.flatMap((rep) => rep.cards).filter((id) => hurt(id, a) && !hurt(id, top));
    if (hits.length) return fmt(t.gap_events, { list: hits.map((id) => L(m.events.find((e) => e.id === id)!.name)).join(t.listSep) });
    const da = designs.get(a.id)!, dt = designs.get(top.id)!;
    const duty = (x: typeof da) => x.settings.dutyCycle ?? 0.5;
    const payloads = (x: typeof da) => x.options.filter((o): o is Extract<Option, { kind: 'part' }> => o.kind === 'part' && o.subsystem === 'payload' && !!o.observes);
    const sight = (x: typeof da) => payloads(x).reduce((s, p) => s + (x.orbit?.science[p.observes!]?.value ?? 0) * (p.detectShare?.value ?? 1), 0);
    const sent = (x: typeof da) => (x.gauges.downlink.used > 0 ? Math.min(1, x.gauges.downlink.available / x.gauges.downlink.used) : 1);
    const ratio = (x: number, y: number) => (y > 0 ? x / y : 1);
    const cands: { k: number; text: string }[] = [];
    cands.push({ k: ratio(duty(da), duty(dt)), text: fmt(t.gap_duty, { n: Math.round(duty(da) * 100) }) });
    // Instruments: name only what differs from the best agency's set.
    const mine = payloads(da).filter((p) => !payloads(dt).some((q) => q.id === p.id)).map((p) => L(p.name));
    const theirs = payloads(dt).filter((p) => !payloads(da).some((q) => q.id === p.id)).map((p) => L(p.name));
    const sightText = theirs.length && mine.length ? fmt(t.gap_sightSwap, { mine: mine.join(t.listSep), theirs: theirs.join(t.listSep) })
      : theirs.length ? fmt(t.gap_sightMissing, { theirs: theirs.join(t.listSep) })
      : da.orbit && da.orbit.id !== dt.orbit?.id ? fmt(t.gap_orbit, { name: L(da.orbit.name) }) : null;
    if (sightText) cands.push({ k: ratio(sight(da), sight(dt)), text: sightText });
    cands.push({ k: ratio(sent(da), sent(dt)), text: fmt(t.gap_sent, { n: Math.round(sent(da) * 100) }) });
    const pick = cands.filter((c) => c.k < 0.9).sort((x, y) => x.k - y.k)[0];
    return pick?.text ?? null;
  };

  const view = m.view?.kind === 'earthOrbit' ? m.view : null;
  const flightModel = useMemo<AnyFlight | null>(() => {
    if (!m.view) return null;
    // What every scene shares for one agency: colour, launch time, how its run went.
    const base = (a: Agency, i: number) => {
      const r = final[a.id];
      return {
        tag: names.multi ? (a.control === 'human' ? names.short(a.id) : undefined) : a.id === 'player' ? t.flightYou : undefined,
        color: AGENCY_COLOR[a.id], launchAt: start + 0.6 + i * 0.5, stopAt: r.opsFraction,
        kind: (r.outcome === 'noLaunch' ? 'stay' : r.outcome === 'launchFailure' ? 'fail' : r.outcome === 'orbitFailure' ? 'dark' : 'ok') as 'ok' | 'dark' | 'fail' | 'stay',
      };
    };
    const v = m.view;
    if (v.kind === 'lunarPole') {
      return { kind: 'moon', m: { crater: v.crater, opsAt, opsSeconds: OPS, craft: order.map((a, i) => {
        const vm = viewModel(m, designs.get(a.id)!);
        return { ...base(a, i), duty: vm && vm.kind === 'moon' ? vm.duty : 0.5, site: vm && vm.kind === 'moon' ? vm.site : { x: 0, y: 0 } };
      }) } };
    }
    if (v.kind === 'jupiterSystem') {
      return { kind: 'jupiter', m: { opsAt, opsSeconds: OPS, craft: order.map((a, i) => {
        const vm = viewModel(m, designs.get(a.id)!);
        return { ...base(a, i), duty: vm && vm.kind === 'jupiter' ? vm.duty : 0.5, path: vm && vm.kind === 'jupiter' ? vm.path : 'flybys', shield: vm && vm.kind === 'jupiter' ? vm.shield : 1 };
      }) } };
    }
    return { kind: 'earth', m: {
      opsAt, opsSeconds: OPS, fires: !!v.fires,
      sats: order.map((a, i) => {
        const e = earthModel(m, designs.get(a.id)!);
        return { ...base(a, i), altKm: e?.altKm ?? 500, incDeg: e?.incDeg ?? 98, duty: e?.duty ?? 0.5, camera: e?.camera ?? null, stations: e?.stations ?? [] };
      }),
    } };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game]);

  const status = (a: Agency): { text: string; bad: boolean } | null => {
    const r = final[a.id];
    // The reason is the same one the results screen gives (outcomeCause).
    const cause = outcomeCause(m, r);
    if (r.outcome === 'noLaunch') return { text: `${t.flightNotLaunched}${cause ? `${t.colonSep}${causeName(cause)}` : ''}`, bad: true };
    if (r.outcome === 'launchFailure') return { text: `✕ ${outcomeName(r.outcome)}`, bad: true };
    if (r.outcome === 'orbitFailure') return { text: `✕ ${m.outcomeLabels?.orbitFailure ? outcomeName(r.outcome) : t.flightNoSignal}`, bad: true };
    const firstFail = [...r.failures].sort((x, y) => x.at - y.at)[0];
    // Lost after the goal was already met: not a red cross, the result still stands.
    const ff = firstFailure(r, m.opsDays.value);
    if (ff?.goalMet) return { text: ff.fatal ? fmt(t.goalThenLost, { n: ff.day }) : fmt(t.goalThenFail, { n: ff.day, cause: causeName(`fail:${ff.sub}`) }), bad: false };
    if (r.opsFraction < 0.999 && (firstFail || r.outcome === 'lostInOps') && cause) return { text: `✕ ${causeName(cause)}`, bad: true };
    // A partial result names the same reason as the results screen (a warning or the event that cut it most).
    if (r.outcome !== 'fullSuccess' && flewOf(r.outcome) && cause) return { text: causeName(cause), bad: false };
    return null;
  };

  return (
    <section className={`flight ${instant ? 'instant' : ''} ${flightModel ? 'with-view' : ''}`}>
      <div className="flight-left">
        {flightModel ? <FlightView model={flightModel} instant={instant} /> : null}
        {(!flightModel || !webglOk()) && <LaunchPads order={order} game={game} start={start} />}
      </div>

      {/* The count column fits the longest number (e.g. "128,012"); the bars give way, never the digits. */}
      <div className="flight-right" style={{ ['--cnt' as string]: `${Math.max(2, ...game.agencies.map((x) => Math.round(final[x.id].delivered).toLocaleString().length))}ch` }}>
        {game.agencies.map((a) => {
          const r = final[a.id];
          const flew = flewOf(r.outcome);
          const share = best > 0 ? r.delivered / best : 0;
          const st = status(a);
          const why = gapReason(a);
          const launchedAt = start + 0.6 + order.indexOf(a) * 0.5;
          return (
            <div key={a.id} className={`fl-row ${a.id === 'player' && !names.multi ? 'me' : ''}`}>
              {/* Name, bar and count on one line, so the event list below keeps room. A craft that never flew has no bar. */}
              <div className="fl-head">
                <AgencyLabel id={a.id} />
                {(flew || !st) ? <span className="fl-track">
                  {flew && share > 0 && <span className="fl-bar" style={{ width: `${Math.max(1.5, share * 100)}%`, background: AGENCY_COLOR[a.id], animationDelay: `${opsAt}s`, animationDuration: `${OPS * Math.max(0.05, r.opsFraction) + 0.01}s` }} />}
                </span> : <span className="fl-gap" />}
                <b className="fl-count">{flew ? <CountUp value={r.delivered} ms={OPS * 1000 * Math.max(0.05, r.opsFraction)} delayMs={opsAt * 1000} instant={instant} /> : '—'}</b>
              </div>
              <div className="fl-foot">
                {st ? <span className={`fl-status appear ${st.bad ? 'bad' : ''}`} style={d(flew ? opsAt + OPS * r.opsFraction : launchedAt + 1)}>{st.text}</span> : <span />}
                {!st?.text.includes(outcomeName(r.outcome)) && <span className="fl-outcome appear" style={d(opsAt + OPS + 0.2)}>{outcomeName(r.outcome)}</span>}
              </div>
              {why && <div className="fl-why appear" style={d(opsAt + OPS + 0.2)}>{why}</div>}
            </div>
          );
        })}
        {ops5.length > 0 && (
          <ul className="fl-events" ref={evList}>
            {ops5.map((id) => {
              const card = m.events.find((e) => e.id === id)!;
              const at = at5(id);
              const month = years > 0.9 && years < 1.1 ? ticks[Math.min(11, Math.floor(at * 12))] : fmt(t.flightDay, { n: Math.round(at * m.opsDays.value) });
              return (
                <li key={id} className="appear" style={d(opsAt + at * OPS)}>
                  <span className="fl-ev-name"><span className="note">{month}</span> <CardIcon card={card} />{L(card.name)}</span>
                  <span className="fl-ev-marks">
                    {game.agencies.map((a) => {
                      const x = report5?.results[a.id][id];
                      return x ? <span key={a.id} className={`fl-ev-mark r-${x}`}><span className="agency-dot" style={{ background: AGENCY_COLOR[a.id] }} />{RESULT_MARK[x]}</span> : null;
                    })}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="flight-axis">
        <div className="fa-track" data-levels="1">
          <span className="fa-head" style={{ animationDelay: `${opsAt}s`, animationDuration: `${OPS}s` }} />
          <TimelineMarks marks={[...ops5].map((id) => ({ id, at: at5(id), card: m.events.find((e) => e.id === id)! })).sort((x, y) => x.at - y.at)}
            delay={(at) => d(opsAt + at * OPS)} name={(c) => L(c.name)} />
        </div>
        <div className="fa-ticks">{ticks.map((x, i) => <span key={i}>{x}</span>)}</div>
        <p className="note small">
          {fmt(t.flightCounted, { unit: L(m.rules.scienceUnit).replace(/^件の/, '') })}
          {view?.fires ? ` · ${t.firesSource} · ${t.earthCredit}` : ''}
          {usesDonki ? ` · ${t.stormSource}` : ''}
        </p>
      </div>
    </section>
  );
}

/**
 * The cards' marks on the timeline, earliest first. A name that would overlap the one before goes up a level
 * (three at most); one that overlaps on every level keeps only its icon (the list on the right names it).
 * Widths are measured once the marks are on screen.
 */
function TimelineMarks({ marks, delay, name }: { marks: { id: string; at: number; card: EventCard }[]; delay: (at: number) => CSSProperties; name: (c: EventCard) => string }) {
  const box = useRef<HTMLSpanElement>(null);
  const [place, setPlace] = useState<Record<string, { lv: number; dx: number }>>({});
  useLayoutEffect(() => {
    const track = box.current?.parentElement;
    if (!track) return;
    const W = track.clientWidth;
    const ends = [-Infinity, -Infinity, -Infinity];
    const out: Record<string, { lv: number; dx: number }> = {};
    for (const mk of marks) {
      const el = track.querySelector<HTMLElement>(`[data-mark="${mk.id}"]`);
      const w = el ? el.getBoundingClientRect().width : 0;
      // A name that would run past either end of the track moves inward; the icon stays at its time.
      const x = mk.at * W, dx = x - w / 2 < 0 ? w / 2 - x : x + w / 2 > W ? W - x - w / 2 : 0;
      const left = x + dx - w / 2, right = x + dx + w / 2;
      const lv = ends.findIndex((e) => left > e + 6);
      if (lv >= 0) { out[mk.id] = { lv, dx }; ends[lv] = right; } else out[mk.id] = { lv: -1, dx };
    }
    if (JSON.stringify(out) !== JSON.stringify(place)) setPlace(out);
    const top = Math.max(0, ...Object.values(out).map((o) => o.lv));
    track.dataset.levels = String(top + 1);
  });
  return (
    <span ref={box} className="fa-marks">
      {marks.map(({ id, at, card }) => {
        const lv = place[id]?.lv ?? 0, dx = place[id]?.dx ?? 0;
        return (
          <span key={id} data-mark={id} className={`fa-event appear lv${Math.max(0, lv)} ${lv < 0 ? 'icon-only' : ''}`} style={{ left: `${at * 100}%`, ...delay(at) }} title={name(card)}>
            <CardIcon card={card} /><span className="fa-name" aria-hidden={lv < 0} style={dx ? { transform: `translateX(${Math.round(dx)}px)` } : undefined}>{name(card)}</span>
          </span>
        );
      })}
    </span>
  );
}
