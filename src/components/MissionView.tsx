import { useEffect, useMemo, useRef, useState } from 'react';
import type { Mission } from '../data/types';
import { defaultPicks, evaluate, type DesignState } from '../engine/design';
import { fmt, useLang } from '../i18n';
import type { EarthModel, EarthScene } from '../view/earthScene';
import { coverageLat } from '../view/orbit';
import { Modal } from './Modal';

const reduceMotion = () => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
// Checked once per page: each check opens a WebGL context, and browsers allow only about 16 at a time.
let webglChecked: boolean | null = null;
const webglOk = () => {
  if (webglChecked !== null) return webglChecked;
  try {
    const c = document.createElement('canvas');
    const gl = c.getContext('webgl2') || c.getContext('webgl');
    webglChecked = !!gl;
    (gl as WebGLRenderingContext | null)?.getExtension('WEBGL_lose_context')?.loseContext();
  } catch { webglChecked = false; }
  return webglChecked;
};
/** NASA Blue Marble (Visible Earth). The view works without it: a lit sphere with a graticule. */
const EARTH_TEXTURE = `${import.meta.env.BASE_URL}textures/earth_day_2048.jpg`;

/** The drawing model from a design state: what the picture shows, read only from the state and the mission's view settings. */
export function earthModel(m: Mission, d: DesignState): EarthModel | null {
  if (m.view?.kind !== 'earthOrbit' || !d.orbit) return null;
  const v = m.view;
  const stations = [v.stations.own];
  if (d.settings.highLatStation) stations.push(v.stations.highLat);
  if ((d.settings.networkFactor ?? 1) > 1) stations.push(...v.stations.network);
  const radios = d.options.filter((o) => o.kind === 'part' && o.subsystem === 'comms');
  return {
    altKm: d.orbit.altitudeKm?.value ?? 500,
    incDeg: d.orbit.inclinationDeg?.value ?? 98,
    stations,
    linkMBPerMin: radios.reduce((a, o) => a + (o.kind === 'part' ? o.downlinkMBPerMin?.value ?? 0 : 0), 0),
    dataPerDay: d.gauges.downlink.used,
    sendPerDay: d.gauges.downlink.available,
    overflow: d.gauges.downlink.margin < 0,
    wings: d.options.some((o) => v.wings.includes(o.id)),
    rings: d.tags.has('spareWheel') ? 2 : d.tags.has('radHard') ? 1 : 0,
    duty: d.settings.dutyCycle ?? 0.5,
    camera: (() => {
      const cam = d.options.find((o) => o.kind === 'part' && o.subsystem === 'payload' && o.observes);
      return cam && cam.kind === 'part' ? { dayOnly: cam.observes !== 'dayNight', share: cam.detectShare?.value ?? 1 } : null;
    })(),
    fires: !!v.fires,
  };
}

function Scene({ model, ghost, fast, onMeter }: { model: EarthModel; ghost: EarthModel | null; fast: boolean; onMeter: (l: number, o: boolean) => void }) {
  const host = useRef<HTMLDivElement>(null);
  const scene = useRef<EarthScene | null>(null);
  const [failed, setFailed] = useState(() => !webglOk());
  const latest = useRef({ model, ghost });
  latest.current = { model, ghost };
  useEffect(() => {
    if (failed || !host.current) return;
    let alive = true;
    // three.js loads only when the view is shown, so the first screen stays light.
    import('../view/earthScene').then(({ createEarthScene }) => {
      if (!alive || !host.current) return;
      try {
        scene.current = createEarthScene(host.current, { reduceMotion: reduceMotion(), textureUrl: EARTH_TEXTURE });
        scene.current.onMeter(onMeter);
        scene.current.set(latest.current.model, latest.current.ghost);
      } catch { setFailed(true); }
    }).catch(() => setFailed(true));
    return () => { alive = false; scene.current?.dispose(); scene.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [failed]);
  useEffect(() => { scene.current?.set(model, ghost); }, [model, ghost]);
  useEffect(() => { scene.current?.setFast(fast); }, [fast]);
  if (failed) return <StaticEarth model={model} />;
  return <div ref={host} className="mv-canvas" />;
}

/** Fallback without WebGL: the same composition as a still drawing. */
function StaticEarth({ model }: { model: EarthModel }) {
  const { t } = useLang();
  const r = 60 * (1 + (model.altKm / 6378) * 3);
  return (
    <svg viewBox="-110 -80 220 160" className="mv-canvas" role="img" aria-label={t.viewUnavailable}>
      <circle r="60" fill="#1d3f74" stroke="#3a5a8e" />
      <ellipse rx={r} ry={r * Math.cos((model.incDeg * Math.PI) / 180) * 0.6 + 6} fill="none" stroke="#9fd8ff" strokeWidth="1.5" transform={`rotate(${90 - model.incDeg / 2})`} />
      <text x="0" y="75" textAnchor="middle" fontSize="8" fill="#8c9ab8">{t.viewUnavailable}</text>
    </svg>
  );
}

/** Title screen: the wildfire mission's auto-plan spacecraft circling the Earth, no controls. */
export function TitleGlobe({ mission }: { mission: Mission }) {
  const model = useMemo(() => earthModel(mission, evaluate(mission, defaultPicks(mission))), [mission]);
  if (!model) return null;
  return <div className="title-globe" aria-hidden="true"><Scene model={model} ghost={null} fast={false} onMeter={() => {}} /></div>;
}

/** The mission view: the destination and the spacecraft, redrawn as the design changes. */
export function MissionView({ mission, state, ghost }: { mission: Mission; state: DesignState; ghost: DesignState | null }) {
  const { t } = useLang();
  const model = useMemo(() => earthModel(mission, state), [mission, state]);
  const ghostModel = useMemo(() => (ghost ? earthModel(mission, ghost) : null), [mission, ghost]);
  const [fast, setFast] = useState(false);
  const [big, setBig] = useState(false);
  const [meter, setMeter] = useState<{ l: number; o: boolean }>({ l: 0, o: false });
  const lastMeter = useRef(0);
  const onMeter = (l: number, o: boolean) => {
    const now = performance.now();
    if (now - lastMeter.current < 200) return;
    lastMeter.current = now;
    // Only re-render the overlay when the level moved visibly.
    setMeter((m) => (Math.abs(m.l - l) < 0.02 && m.o === o ? m : { l, o }));
  };
  if (!model) return null;
  const view = (size: 'small' | 'big') => (
    <div className={`mission-view ${size}`}>
      <Scene model={model} ghost={ghostModel} fast={fast} onMeter={onMeter} />
      <div className="mv-info">
        <div>{fmt(t.viewContact, { n: Math.round(state.contactMin) })}</div>
        <div>{fmt(t.viewCoverage, { a: coverageLat(model.incDeg).toFixed(1) })}</div>
        {model.fires && <div className="mv-src">{t.firesSourceShort}</div>}
      </div>
      <div className={`mv-meter ${meter.o ? 'over' : ''}`} title={t.viewData}><span style={{ height: `${Math.round(meter.l * 100)}%` }} /></div>
      <div className="mv-buttons">
        <button type="button" className="secondary" aria-pressed={fast} onClick={() => setFast(!fast)}>{fast ? `❚❚ ${t.viewPause}` : `▶▶ ${t.viewPlay}`}</button>
        {size === 'small' && <button type="button" className="secondary" aria-label={t.viewExpand} title={t.viewExpand} onClick={() => setBig(true)}>⤢</button>}
      </div>
    </div>
  );
  return (
    <>
      {!big && view('small')}
      {big && <Modal title={t.viewTitle} wide onClose={() => setBig(false)}>{view('big')}<p className="note small">{t.viewIllustration}</p></Modal>}
    </>
  );
}
