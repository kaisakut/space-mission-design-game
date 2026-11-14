import { useEffect, useMemo, useRef, useState } from 'react';
import type { Option } from '../data/types';
import { agencyDesign, type Agency, type Game } from '../engine/game';
import { firstFailure } from '../engine/simulate';
import { fmt, useLang } from '../i18n';
import type { FlightScene } from '../view/flightCommon';
import type { FlightModel } from '../view/flightScene';
import type { JupiterFlightModel } from '../view/flightJupiter';
import type { MoonFlightModel } from '../view/flightMoon';
import { CountUp } from './ForecastPanel';
import { AGENCY_COLOR, RESULT_MARK, useCauseName, useOutcomeName } from './labels';
import { EARTH_TEXTURE, earthModel, viewModel, webglOk } from './MissionView';
import { AgencyLabel, CardIcon } from './Resolution';

/** Seconds of the operating year on screen. */
const OPS = 5;
/** Seconds the flight scene takes, so the resolution scene knows when it has finished. */
export const FLIGHT_SECONDS = 1 + 4 * 0.5 + 1 + OPS + 0.5;

/** A display month for a card, fixed by the game's seed (the engine does not give event times). */
const displayAt = (seed: number, id: string) => {
  let h = seed >>> 0;
  for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 2654435761) >>> 0;
  return 0.08 + ((h % 1000) / 1000) * 0.84;
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
              {kind === 'stay' && <span className="pad-sign appear" style={d(delay)}>{t.flightNotLaunched}{r.causes[0] ? `: ${causeName(r.causes[0])}` : ''}</span>}
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
  const { t, L, lang } = useLang();
  const m = game.mission;
  const final = game.final!;
  const causeName = useCauseName(m);
  const outcomeName = useOutcomeName(m);
  const order = [...game.agencies].sort((a, b) => (final[a.id].launchDay ?? 1e9) - (final[b.id].launchDay ?? 1e9));
  const opsAt = start + 1 + order.length * 0.5 + 1;
  const report5 = game.reports.find((r) => r.phase === 5);
  // In the order they happen on the timeline.
  const ops5 = [...(report5?.cards ?? [])].sort((x, y) => displayAt(game.seed, x) - displayAt(game.seed, y));
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
  const gapReason = (a: Agency): string | null => {
    const r = final[a.id];
    if (best <= 0 || !flewOf(r.outcome) || r.delivered >= best * 0.7) return null;
    const top = game.agencies.find((x) => final[x.id].delivered === best)!;
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
    const firstFail = [...r.failures].sort((x, y) => x.at - y.at)[0];
    // A spacecraft that stopped already says why on its status line.
    if (!stoppedEarly(a)) cands.push({ k: ratio(r.opsFraction, final[top.id].opsFraction), text: fmt(t.gap_ops, { n: Math.round(r.opsFraction * 100), cause: firstFail ? causeName(`fail:${firstFail.sub}`) : causeName(r.causes[0] ?? '') }) });
    const explained = cands.reduce((p, c) => p * Math.min(1, c.k), 1);
    const left = ratio(r.delivered, best) / Math.max(explained, 1e-9);
    const hits = game.reports.flatMap((rep) => rep.cards.filter((id) => ['hit', 'partial'].includes(rep.results[a.id][id] ?? '') && !['hit', 'partial'].includes(rep.results[top.id][id] ?? '')));
    if (hits.length) cands.push({ k: left, text: fmt(t.gap_events, { list: hits.map((id) => L(m.events.find((e) => e.id === id)!.name)).join(t.listSep) }) });
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
        return { ...base(a, i), tag: a.id === 'player' ? t.flightYou : undefined, altKm: e?.altKm ?? 500, incDeg: e?.incDeg ?? 98, duty: e?.duty ?? 0.5, camera: e?.camera ?? null, stations: e?.stations ?? [] };
      }),
    } };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game]);

  const status = (a: Agency): { text: string; bad: boolean } | null => {
    const r = final[a.id];
    if (r.outcome === 'noLaunch') return { text: `${t.flightNotLaunched}${r.causes[0] ? `${t.colonSep}${causeName(r.causes[0])}` : ''}`, bad: true };
    if (r.outcome === 'launchFailure') return { text: `✕ ${outcomeName(r.outcome)}`, bad: true };
    if (r.outcome === 'orbitFailure') return { text: `✕ ${m.outcomeLabels?.orbitFailure ? outcomeName(r.outcome) : t.flightNoSignal}`, bad: true };
    const firstFail = [...r.failures].sort((x, y) => x.at - y.at)[0];
    // Lost after the goal was already met: not a red cross, the result still stands.
    const ff = firstFailure(r, m.opsDays.value);
    if (ff?.goalMet) return { text: ff.fatal ? fmt(t.goalThenLost, { n: ff.day }) : fmt(t.goalThenFail, { n: ff.day, cause: causeName(`fail:${ff.sub}`) }), bad: false };
    if (r.opsFraction < 0.999 && (firstFail || r.outcome === 'lostInOps')) return { text: `✕ ${firstFail ? causeName(`fail:${firstFail.sub}`) : causeName(r.causes[0] ?? '')}`, bad: true };
    return null;
  };

  return (
    <section className={`flight ${instant ? 'instant' : ''} ${flightModel ? 'with-view' : ''}`}>
      <div className="flight-left">
        {flightModel ? <FlightView model={flightModel} instant={instant} /> : null}
        {(!flightModel || !webglOk()) && <LaunchPads order={order} game={game} start={start} />}
      </div>

      <div className="flight-right">
        {game.agencies.map((a) => {
          const r = final[a.id];
          const flew = flewOf(r.outcome);
          const share = best > 0 ? r.delivered / best : 0;
          const st = status(a);
          const why = gapReason(a);
          const launchedAt = start + 0.6 + order.indexOf(a) * 0.5;
          return (
            <div key={a.id} className={`fl-row ${a.id === 'player' ? 'me' : ''}`}>
              <div className="fl-head">
                <AgencyLabel id={a.id} />
                <b className="fl-count">{flew ? <CountUp value={r.delivered} ms={OPS * 1000 * Math.max(0.05, r.opsFraction)} delayMs={opsAt * 1000} instant={instant} /> : '—'}</b>
              </div>
              <span className="fl-track">
                {flew && share > 0 && <span className="fl-bar" style={{ width: `${Math.max(1.5, share * 100)}%`, background: AGENCY_COLOR[a.id], animationDelay: `${opsAt}s`, animationDuration: `${OPS * Math.max(0.05, r.opsFraction) + 0.01}s` }} />}
              </span>
              <div className="fl-foot">
                {st ? <span className={`fl-status appear ${st.bad ? 'bad' : ''}`} style={d(flew ? opsAt + OPS * r.opsFraction : launchedAt + 1)}>{st.text}</span> : <span />}
                {!st?.text.includes(outcomeName(r.outcome)) && <span className="fl-outcome appear" style={d(opsAt + OPS + 0.2)}>{outcomeName(r.outcome)}</span>}
              </div>
              {why && <div className="fl-why appear" style={d(opsAt + OPS + 0.2)}>{why}</div>}
            </div>
          );
        })}
        {ops5.length > 0 && (
          <ul className="fl-events">
            {ops5.map((id) => {
              const card = m.events.find((e) => e.id === id)!;
              const at = displayAt(game.seed, id);
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
        <div className="fa-track">
          <span className="fa-head" style={{ animationDelay: `${opsAt}s`, animationDuration: `${OPS}s` }} />
          {(() => {
            // Each mark carries the card's name; marks close together are put on two levels so names do not overlap.
            let lastAt = -1, lastLv = 1;
            return [...ops5].map((id) => ({ id, at: displayAt(game.seed, id) })).sort((x, y) => x.at - y.at).map(({ id, at }) => {
              const card = m.events.find((e) => e.id === id)!;
              const lv = at - lastAt < 0.16 && lastLv === 0 ? 1 : 0;
              lastAt = at; lastLv = lv;
              return (
                <span key={id} className={`fa-event appear ${lv ? 'up' : ''}`} style={{ left: `${at * 100}%`, ...d(opsAt + at * OPS) }}>
                  <CardIcon card={card} /><span className="fa-name">{L(card.name)}</span>
                </span>
              );
            });
          })()}
        </div>
        <div className="fa-ticks">{ticks.map((x, i) => <span key={i}>{x}</span>)}</div>
        <p className="note small">
          {fmt(t.flightCounted, { unit: L(m.rules.scienceUnit).replace(/^件の/, '') })}
          {view?.fires ? ` · ${t.firesSource}` : ''}
          {usesDonki ? ` · ${t.stormSource}` : ''}
        </p>
      </div>
    </section>
  );
}
