import { useEffect, useMemo, useRef, useState } from 'react';
import type { Mission } from '../data/types';
import { defaultPicks, evaluate, type DesignState } from '../engine/design';
import { fmt, tk, useLang } from '../i18n';
import type { EarthModel } from '../view/earthScene';
import type { JupiterModel } from '../view/jupiterScene';
import type { LunarModel } from '../view/lunarScene';
import type { MissionScene } from '../view/stage';
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

type ViewModel = (EarthModel & { kind?: undefined }) | JupiterModel | LunarModel;

/** The drawing model for any mission: read only from the design state and the mission's view settings. */
export function viewModel(m: Mission, d: DesignState, name?: (o: { name: { en: string; ja: string } }) => string): ViewModel | null {
  const v = m.view;
  if (!v || !d.orbit) return null;
  const parts = d.options.filter((o) => o.kind === 'part');
  const link = parts.filter((o) => o.kind === 'part' && o.subsystem === 'comms').reduce((a, o) => a + (o.kind === 'part' ? o.downlinkMBPerMin?.value ?? 0 : 0), 0);
  const payload = parts.filter((o) => o.kind === 'part' && o.subsystem === 'payload');
  if (v.kind === 'jupiterSystem') {
    const gen = parts.reduce((a, o) => a + (o.kind === 'part' ? o.generatesW?.value ?? 0 : 0), 0);
    return {
      kind: 'jupiter',
      path: v.paths[d.orbit.id] ?? 'flybys',
      shield: d.tags.has('vault-thick') ? 2 : d.tags.has('vault') ? 1 : 0,
      instruments: payload.length,
      // Wing size from the arrays' output, relative to the largest option (about 700 W near Jupiter).
      wing: Math.min(1.6, gen / 450),
      rtg: parts.some((o) => o.kind === 'part' && (o.rtgW?.value ?? 0) > 0),
      linkMBPerMin: link,
      duty: d.settings.dutyCycle ?? 0.5,
    };
  }
  if (v.kind === 'lunarPole') {
    return {
      kind: 'moon',
      site: v.sites[d.orbit.id] ?? { x: 0, y: 0, sun: 0.5, earth: 0.5 },
      siteName: name?.(d.orbit),
      crater: v.crater,
      instruments: payload.length,
      drill: payload.some((o) => /drill/i.test(o.id) || o.id === 'inst-trident'),
      powerMargin: Math.max(0, Math.min(1, d.gauges.power.margin)),
      nightSurvival: d.tags.has('nightSurvival'),
      linkMBPerMin: link,
      duty: d.settings.dutyCycle ?? 0.5,
    };
  }
  return earthModel(m, d);
}

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

/** three.js and each scene load only when the view is shown, so the first screen stays light. */
const loadScene = (model: ViewModel, host: HTMLElement, dist?: number): Promise<MissionScene<ViewModel>> =>
  model.kind === 'jupiter' ? import('../view/jupiterScene').then((x) => x.createJupiterScene(host, { reduceMotion: reduceMotion() }) as MissionScene<ViewModel>)
  : model.kind === 'moon' ? import('../view/lunarScene').then((x) => x.createLunarScene(host, { reduceMotion: reduceMotion() }) as MissionScene<ViewModel>)
  : import('../view/earthScene').then((x) => x.createEarthScene(host, { reduceMotion: reduceMotion(), textureUrl: EARTH_TEXTURE, dist }) as unknown as MissionScene<ViewModel>);

function Scene({ model, ghost, fast, onMeter, dist }: { model: ViewModel; ghost: ViewModel | null; fast: boolean; onMeter: (l: number, o: boolean) => void; dist?: number }) {
  const host = useRef<HTMLDivElement>(null);
  const scene = useRef<MissionScene<ViewModel> | null>(null);
  const [failed, setFailed] = useState(() => !webglOk());
  const latest = useRef({ model, ghost });
  latest.current = { model, ghost };
  useEffect(() => {
    if (failed || !host.current) return;
    let alive = true;
    loadScene(latest.current.model, host.current, dist).then((sc) => {
      if (!alive) { sc.dispose(); return; }
      scene.current = sc;
      sc.onMeter(onMeter);
      sc.set(latest.current.model, latest.current.ghost);
    }).catch(() => setFailed(true));
    return () => { alive = false; scene.current?.dispose(); scene.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [failed]);
  useEffect(() => { scene.current?.set(model, ghost); }, [model, ghost]);
  useEffect(() => { scene.current?.setFast(fast); }, [fast]);
  if (failed) return <StaticView model={model} />;
  return <div ref={host} className="mv-canvas" />;
}

/** Fallback without WebGL: the same composition as a still drawing; only the path or the site follows the design. */
function StaticView({ model }: { model: ViewModel }) {
  const { t } = useLang();
  const note = <text x="0" y="-68" textAnchor="middle" fontSize="8" fill="#8c9ab8">{t.viewUnavailable}</text>;
  if (model.kind === 'jupiter') {
    const path = model.path === 'flybys' ? <ellipse cx="-38" rx="70" ry="22" fill="none" stroke="#9fd8ff" strokeWidth="1.5" />
      : <circle r={model.path === 'europaOrbit' ? 33 : 52} fill="none" stroke="#9fd8ff" strokeWidth="1.5" />;
    return (
      <svg viewBox="-110 -80 220 160" className="mv-canvas" role="img" aria-label={t.viewUnavailable}>
        <ellipse rx="45" ry="16" fill="#c58cff" opacity="0.25" />
        <circle r="12" fill="#c9a27a" stroke="#8a6a4a" />
        <circle r="33" fill="none" stroke="#5a6b8f" strokeDasharray="2 2" />
        <circle r="52" fill="none" stroke="#5a6b8f" strokeDasharray="2 2" />
        {path}
        {note}
      </svg>
    );
  }
  if (model.kind === 'moon') {
    return (
      <svg viewBox="-110 -80 220 160" className="mv-canvas" role="img" aria-label={t.viewUnavailable}>
        <circle r="60" fill="#66625b" stroke="#8a867c" />
        <circle cx={model.crater.x * 60} cy={model.crater.y * 60} r={model.crater.r * 60} fill="#111316" stroke="#9a968c" />
        <circle cx={model.site.x * 60} cy={model.site.y * 60} r="5" fill="#e8ecf4" stroke="#ffb74d" strokeWidth="2" />
        {note}
      </svg>
    );
  }
  const r = 60 * (1 + (model.altKm / 6378) * 3);
  return (
    <svg viewBox="-110 -80 220 160" className="mv-canvas" role="img" aria-label={t.viewUnavailable}>
      <circle r="60" fill="#1d3f74" stroke="#3a5a8e" />
      <ellipse rx={r} ry={r * Math.cos((model.incDeg * Math.PI) / 180) * 0.6 + 6} fill="none" stroke="#9fd8ff" strokeWidth="1.5" transform={`rotate(${90 - model.incDeg / 2})`} />
      {note}
    </svg>
  );
}

/** Title screen: the wildfire mission's auto-plan spacecraft circling the Earth, no controls. */
export function TitleGlobe({ mission }: { mission: Mission }) {
  const model = useMemo(() => earthModel(mission, evaluate(mission, defaultPicks(mission))), [mission]);
  if (!model) return null;
  return <div className="title-globe" aria-hidden="true"><Scene model={model} ghost={null} fast={false} onMeter={() => {}} dist={3.9} /></div>;
}

/** The mission view: the destination and the spacecraft, redrawn as the design changes. */
export function MissionView({ mission, state, ghost }: { mission: Mission; state: DesignState; ghost: DesignState | null }) {
  const { t, L } = useLang();
  const model = useMemo(() => viewModel(mission, state, (o) => L(o.name)), [mission, state, L]);
  const ghostModel = useMemo(() => (ghost ? viewModel(mission, ghost, (o) => L(o.name)) : null), [mission, ghost, L]);
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
        {/* Engine values for what the picture shows. */}
        {model.kind === 'jupiter' ? <>
          <div>{tk(t, `viewPath_${model.path}`)}</div>
          <div>{tk(t, `viewShield_${model.shield}`)}</div>
        </> : model.kind === 'moon' ? <>
          <div>{fmt(t.viewSun, { n: Math.round(model.site.sun * 100) })}</div>
          <div>{model.nightSurvival ? t.viewNightOk : t.viewNightNo}</div>
        </> : <>
          <div>{fmt(t.viewContact, { n: Math.round(state.contactMin) })}</div>
          <div>{fmt(t.viewCoverage, { a: coverageLat(model.incDeg).toFixed(1) })}</div>
          {model.fires && <div className="mv-src">{t.firesSourceShort}</div>}
        </>}
        {model.kind && <div className="mv-dim">{fmt(t.viewDataLine, { a: Math.round(state.gauges.downlink.used).toLocaleString(), b: Math.round(state.gauges.downlink.available).toLocaleString() })}</div>}
      </div>
      {model.kind === 'moon' && <div className="mv-place">{t.viewPlaceMoon}</div>}
      {model.kind === 'jupiter' && <div className="mv-place">{t.viewPlaceJupiter}</div>}
      {!model.kind && model.fires && (
        <div className="mv-legend" aria-hidden="true">
          <span><i style={{ background: '#a8632d' }} />{t.viewLegendFire}</span>
          <span><i style={{ background: '#ff9a2a' }} />{t.viewLegendSeen}</span>
        </div>
      )}
      <div className={`mv-meter ${meter.o ? 'over' : ''} ${model.kind ? `m-${model.kind}` : ''}`} title={model.kind === 'jupiter' ? t.viewDose : model.kind === 'moon' ? t.viewBattery : t.viewData}><span style={{ height: `${Math.round(meter.l * 100)}%` }} /></div>
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
