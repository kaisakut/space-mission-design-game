import type { Game } from '../engine/game';
import { fmt, useLang } from '../i18n';
import { CountUp } from './ForecastPanel';
import { AGENCY_COLOR, useCauseName, useOutcomeName } from './labels';
import { AgencyLabel, CardIcon } from './Resolution';

/** Seconds the flight scene takes, so the resolution scene knows when it has finished. */
export const FLIGHT_SECONDS = 1 + 4 * 0.5 + 1 + 5.5;

/** A display month for a card, fixed by the game's seed (the engine does not give event times). */
const displayAt = (seed: number, id: string) => {
  let h = seed >>> 0;
  for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 2654435761) >>> 0;
  return 0.08 + ((h % 1000) / 1000) * 0.84;
};

/**
 * After the last phase: the four launches (in launch order), first contact, then the mission's operating
 * time as bars that grow and stop where a spacecraft was lost, with the delivered count counting up.
 * Everything shown comes from the engine's final runs; only the months of the cards are display values.
 */
export function Flight({ game, start, instant }: { game: Game; start: number; instant: boolean }) {
  const { t, L } = useLang();
  const m = game.mission;
  const final = game.final!;
  const causeName = useCauseName(m);
  const outcomeName = useOutcomeName(m);
  const order = [...game.agencies].sort((a, b) => (final[a.id].launchDay ?? 1e9) - (final[b.id].launchDay ?? 1e9));
  const opsAt = start + 1 + order.length * 0.5 + 1;
  const ops5 = game.reports.find((r) => r.phase === 5)?.cards ?? [];
  const usesDonki = m.events.some((e) => e.probability.sources?.includes('nasa-donki'));
  const years = m.opsDays.value / 365;
  const ticks = years > 0.9 && years < 1.1
    ? Array.from({ length: 12 }, (_, i) => new Date(2000, i, 1).toLocaleString(undefined, { month: 'short' }))
    : Array.from({ length: 5 }, (_, i) => fmt(t.flightDay, { n: Math.round((m.opsDays.value * i) / 4) }));
  const d = (s: number) => ({ animationDelay: `${s}s` });

  return (
    <section className={`flight ${instant ? 'instant' : ''}`}>
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

      <div className="ops appear" style={d(opsAt - 0.3)}>
        <div className="ops-axis">{ticks.map((x, i) => <span key={i}>{x}</span>)}</div>
        <div className="ops-events">
          {ops5.map((id, k) => {
            const card = m.events.find((e) => e.id === id)!;
            // Display month only: spread in order, nudged by the seed, alternating two lanes.
            const at = (k + 0.5) / ops5.length + (displayAt(game.seed, id) - 0.5) * (0.6 / ops5.length);
            return <span key={id} className={`ops-event appear lane${k % 2}`} style={{ left: `${at * 100}%`, ...d(opsAt + at * 5) }} title={L(card.story)}><CardIcon card={card} />{L(card.name)}</span>;
          })}
        </div>
        {game.agencies.map((a) => {
          const r = final[a.id];
          const flew = !['noLaunch', 'launchFailure', 'orbitFailure'].includes(r.outcome);
          const share = flew ? Math.max(0.02, r.opsFraction) : 0;
          // A bar that stops early because a part failed gets a cross, even when enough data was already home.
          const firstFail = [...r.failures].sort((x, y) => x.at - y.at)[0];
          const stopped = flew && r.opsFraction < 0.999 && (firstFail || r.outcome === 'lostInOps');
          const lostCause = firstFail ? `fail:${firstFail.sub}` : r.causes[0];
          return (
            <div key={a.id} className="ops-row">
              <span className="ops-name"><AgencyLabel id={a.id} /></span>
              <span className="ops-track">
                <span className="ops-bar" style={{ width: `${share * 100}%`, background: AGENCY_COLOR[a.id], animationDelay: `${opsAt}s`, animationDuration: `${5 * share + 0.01}s` }} />
                {stopped && <span className="ops-lost appear" style={{ left: `${share * 100}%`, ...d(opsAt + 5 * share) }}>✕ {lostCause ? causeName(lostCause) : ''}</span>}
                {!flew && <span className="note small ops-none">—</span>}
              </span>
              <b className="ops-count"><CountUp value={r.delivered} ms={5000} delayMs={opsAt * 1000} instant={instant} /></b>
              <span className="ops-outcome appear" style={d(opsAt + 5.2)}>{outcomeName(r.outcome)}</span>
            </div>
          );
        })}
        <p className="note small">
          {fmt(t.flightCounted, { unit: L(m.rules.scienceUnit).replace(/^件の/, '') })}
          {(m.view?.kind === 'earthOrbit' && m.view.fires) ? ` · ${t.firesSource}` : ''}
          {usesDonki ? ` · ${t.stormSource}` : ''}
        </p>
      </div>
    </section>
  );
}
