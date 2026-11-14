import * as THREE from 'three';
import firesDoc from '../../data/firms-cells-2024.json';
import { angleBetween, coverageLat, footprintAngle, latLonToVec, orbitPos, periodSec, RE_KM, vecToLatLon, type Vec3 } from './orbit';

/** What the Earth scene draws: built from the design state, never from slot ids. */
export interface EarthModel {
  altKm: number;
  incDeg: number;
  stations: { lat: number; lon: number }[];
  /** Sum of radio rates (MB/min): the link line's thickness and the antenna's size. */
  linkMBPerMin: number;
  dataPerDay: number;
  sendPerDay: number;
  /** The downlink gauge is over: the on-board data meter overflows. */
  overflow: boolean;
  wings: boolean;
  /** 0 none, 1 radiation-tolerant, 2 with a spare wheel. */
  rings: number;
  /** Share of each orbit the camera observes. */
  duty: number;
  /** The camera, for lighting the fire dots: daytime only or day and night, and the share it detects. */
  camera: { dayOnly: boolean; share: number } | null;
  /** Draw the real fires. */
  fires: boolean;
}

export interface EarthScene {
  set(model: EarthModel, ghost: EarthModel | null): void;
  setFast(on: boolean): void;
  dispose(): void;
  /** Data meter 0–1 and whether it overflows, for the HTML overlay. */
  onMeter(cb: (level: number, overflow: boolean) => void): void;
}

// The Sun lights the side facing the viewer and a little to the right, so the day side fills most of the view.
const SUN = new THREE.Vector3(0.55, 0.3, 0.78).normalize();
// Altitude is drawn larger than life (×2) so 410, 500 and 600 km look different without floating far off.
const radiusOf = (altKm: number) => 1 + (altKm / RE_KM) * 2;
// Line of nodes about 45° from the view, so a polar orbit shows as an ellipse and its tilt can be compared.
const NODE = 0.8;
const ORBIT_SECONDS = 8;

function graticule(): THREE.LineSegments {
  const pts: number[] = [];
  const push = (a: Vec3, b: Vec3) => pts.push(...a.map((v) => v * 1.001), ...b.map((v) => v * 1.001));
  for (let lat = -60; lat <= 60; lat += 30) for (let lon = -180; lon < 180; lon += 6) push(latLonToVec(lat, lon), latLonToVec(lat, lon + 6));
  for (let lon = -180; lon < 180; lon += 30) for (let lat = -84; lat < 84; lat += 6) push(latLonToVec(lat, lon), latLonToVec(lat + 6, lon));
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
  return new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: 0x3a5a8e, transparent: true, opacity: 0.55 }));
}

/**
 * Materials are made once per scene and shared: a new material means a new shader program, and compiling
 * programs on every design change made the view stall (and on weak GPUs, blank out).
 */
function makeMaterials() {
  const ghost = (color: number) => new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.35, depthWrite: false });
  return {
    ring: new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.95 }),
    ghostRing: new THREE.LineDashedMaterial({ vertexColors: true, transparent: true, opacity: 0.5, dashSize: 0.04, gapSize: 0.03 }),
    latLine: new THREE.LineBasicMaterial({ color: 0x7fd1ff, transparent: true, opacity: 0.55 }),
    station: new THREE.MeshBasicMaterial({ color: 0xffb74d }),
    ghostStation: ghost(0xffb74d),
    footprint: new THREE.LineBasicMaterial({ color: 0xffc46b, transparent: true, opacity: 0.9 }),
    ghostFootprint: new THREE.LineBasicMaterial({ color: 0xffb74d, transparent: true, opacity: 0.3 }),
    body: new THREE.MeshStandardMaterial({ color: 0xe8ecf4, metalness: 0.3, roughness: 0.5 }),
    bodyPanels: new THREE.MeshStandardMaterial({ color: 0x3f6fd0, metalness: 0.4, roughness: 0.4 }),
    wing: new THREE.MeshStandardMaterial({ color: 0x2f6fde, side: THREE.DoubleSide, metalness: 0.4, roughness: 0.4 }),
    ghostWing: ghost(0x7fb0ff),
    dish: new THREE.MeshStandardMaterial({ color: 0xdfe6f3, side: THREE.DoubleSide, metalness: 0.2, roughness: 0.6 }),
    shield: new THREE.MeshBasicMaterial({ color: 0xffb74d }),
    ghostShield: ghost(0xffb74d),
    cone: new THREE.MeshBasicMaterial({ color: 0xffd27f, transparent: true, opacity: 0.16, side: THREE.DoubleSide, depthWrite: false }),
    link: new THREE.MeshBasicMaterial({ color: 0x7fd1ff, transparent: true, opacity: 0.85 }),
    packets: new THREE.PointsMaterial({ color: 0xe8f6ff, size: 0.035, transparent: true, opacity: 0.95, depthWrite: false }),
    atmosphere: new THREE.MeshBasicMaterial({ color: 0x4f8fe0, transparent: true, opacity: 0.16, side: THREE.BackSide, depthWrite: false }),
  };
}
type Mats = ReturnType<typeof makeMaterials>;

function circleOnSphere(center: Vec3, angle: number, radius: number, mat: THREE.LineBasicMaterial): THREE.LineLoop {
  const c = new THREE.Vector3(...center).normalize();
  const a = new THREE.Vector3(0, 1, 0).cross(c);
  if (a.lengthSq() < 1e-6) a.set(1, 0, 0);
  a.normalize();
  const b = c.clone().cross(a);
  const pts: THREE.Vector3[] = [];
  for (let k = 0; k < 64; k++) {
    const t = (k / 64) * Math.PI * 2;
    pts.push(c.clone().multiplyScalar(Math.cos(angle)).add(a.clone().multiplyScalar(Math.sin(angle) * Math.cos(t))).add(b.clone().multiplyScalar(Math.sin(angle) * Math.sin(t))).multiplyScalar(radius));
  }
  return new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(pts), mat);
}

/** A latitude circle on the globe (the edge of what the orbit can see). */
function latitudeCircle(latDeg: number, mat: THREE.LineBasicMaterial): THREE.LineLoop {
  const pts: THREE.Vector3[] = [];
  for (let k = 0; k < 96; k++) pts.push(new THREE.Vector3(...latLonToVec(latDeg, -180 + (k / 96) * 360)).multiplyScalar(1.004));
  return new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(pts), mat);
}

/** A small text label that always faces the viewer. */
function label(text: string, color = '#bfe6ff'): THREE.Sprite {
  const c = document.createElement('canvas');
  c.width = 128; c.height = 40;
  const ctx = c.getContext('2d')!;
  ctx.font = '600 24px system-ui, sans-serif';
  ctx.fillStyle = color;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.shadowColor = '#000'; ctx.shadowBlur = 4;
  ctx.fillText(text, 64, 20);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
  s.scale.set(0.32, 0.1, 1);
  return s;
}

function ringLine(m: EarthModel, mats: Mats, dashed: boolean): THREE.Line {
  const r = radiusOf(m.altKm), inc = (m.incDeg * Math.PI) / 180;
  // Higher orbits are drawn a brighter blue, so the three altitudes also differ by colour.
  const lit = new THREE.Color().setHSL(0.56, 0.9, 0.55 + Math.min(0.25, (m.altKm - 400) / 800));
  const pts: number[] = [], colors: number[] = [];
  for (let k = 0; k <= 180; k++) {
    const p = orbitPos(r, (k / 180) * Math.PI * 2, inc, NODE);
    pts.push(...p);
    // In Earth's shadow: behind the planet as seen from the Sun.
    const v = new THREE.Vector3(...p);
    const along = v.dot(SUN);
    const shadow = along < 0 && v.clone().sub(SUN.clone().multiplyScalar(along)).length() < 1;
    const c = shadow ? new THREE.Color(0x3b4660) : lit;
    colors.push(c.r, c.g, c.b);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  const line = new THREE.Line(g, dashed ? mats.ghostRing : mats.ring);
  if (dashed) line.computeLineDistances();
  return line;
}

/** The spacecraft, its shape showing the design: panels, antenna size and protection. Ghost parts show a hovered change. */
function satellite(m: EarthModel, ghost: EarthModel | null, mats: Mats): THREE.Group {
  const g = new THREE.Group();
  g.add(new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.08), m.wings ? mats.body : mats.bodyPanels));
  const wings = (mat: THREE.Material) => { for (const s of [-1, 1]) { const w = new THREE.Mesh(new THREE.PlaneGeometry(0.11, 0.045), mat); w.position.x = s * 0.085; g.add(w); } };
  if (m.wings) wings(mats.wing);
  else if (ghost?.wings) wings(mats.ghostWing);
  // Antenna dish on the side facing away from Earth: larger with a faster radio.
  const dishR = 0.014 + 0.008 * Math.log10(1 + m.linkMBPerMin);
  const dish = new THREE.Mesh(new THREE.CircleGeometry(dishR, 16), mats.dish);
  dish.position.set(0, 0.04, -0.03);
  dish.rotation.x = -Math.PI / 3;
  g.add(dish);
  const rings = (n: number, from: number, mat: THREE.Material) => {
    for (let k = from; k < n; k++) {
      const t = new THREE.Mesh(new THREE.TorusGeometry(0.075 + k * 0.022, 0.005, 6, 32), mat);
      t.rotation.x = Math.PI / 2;
      g.add(t);
    }
  };
  rings(m.rings, 0, mats.shield);
  if (ghost && ghost.rings > m.rings) rings(ghost.rings, m.rings, mats.ghostShield);
  return g;
}

export function createEarthScene(host: HTMLElement, opts: { reduceMotion: boolean; textureUrl?: string; dist?: number }): EarthScene {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  // Capped at 1.5: a small view does not need a full Retina buffer, and the GPU work drops by almost half.
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
  host.appendChild(renderer.domElement);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
  const pivot = new THREE.Group();
  scene.add(pivot);
  // Seen from about 25° above the equator; only Earth turns on its own, the view moves only when dragged.
  pivot.rotation.set(0.44, 0, 0);
  // Camera distance; the title screen comes closer so the globe fills its half of the hero.
  let dist = opts.dist ?? 5.2;

  // A brighter ambient light keeps the night side's land faintly visible instead of black.
  scene.add(new THREE.AmbientLight(0x8090b8, 0.85));
  const sunLight = new THREE.DirectionalLight(0xffffff, 1.7);
  sunLight.position.copy(SUN).multiplyScalar(10);
  scene.add(sunLight);
  const mats = makeMaterials();

  // Fixed stars.
  {
    const pts: number[] = [];
    let seed = 7;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let k = 0; k < 900; k++) { const v = new THREE.Vector3(rnd() - 0.5, rnd() - 0.5, rnd() - 0.5).normalize().multiplyScalar(30); pts.push(v.x, v.y, v.z); }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    scene.add(new THREE.Points(g, new THREE.PointsMaterial({ color: 0x9aa8c6, size: 0.05, transparent: true, opacity: 0.7 })));
  }

  // Earth: NASA Blue Marble when the texture is available, otherwise a lit sphere with a graticule; a thin blue rim of air.
  const earth = new THREE.Group();
  pivot.add(earth);
  const earthMat = new THREE.MeshPhongMaterial({ color: 0x1d3f74, shininess: 8 });
  earth.add(new THREE.Mesh(new THREE.SphereGeometry(1, 48, 32), earthMat));
  pivot.add(new THREE.Mesh(new THREE.SphereGeometry(1.035, 48, 32), mats.atmosphere));
  const grid = graticule();
  earth.add(grid);
  if (opts.textureUrl) {
    new THREE.TextureLoader().load(opts.textureUrl, (tex) => {
      tex.colorSpace = THREE.SRGBColorSpace;
      earthMat.map = tex; earthMat.color.set(0xffffff); earthMat.needsUpdate = true;
      (grid.material as THREE.LineBasicMaterial).opacity = 0.15;
    }, undefined, () => { /* no texture: keep the graticule */ });
  }
  // The swath the camera has covered, painted in light blue while fast-forwarding.
  const cov = document.createElement('canvas');
  cov.width = 512; cov.height = 256;
  const covCtx = cov.getContext('2d')!;
  const covTex = new THREE.CanvasTexture(cov);
  earth.add(new THREE.Mesh(new THREE.SphereGeometry(1.003, 48, 32), new THREE.MeshBasicMaterial({ map: covTex, transparent: true, depthWrite: false })));

  // Real 2024 fires (NASA FIRMS), one dot per 1-degree cell: dull orange until seen, a yellow flash when the
  // camera passes, then bright orange; on the night side a daytime camera cannot see them (dim blue).
  const cells = (firesDoc as unknown as { cells: [number, number, number, number][] }).cells;
  const fireDirs = cells.map(([lat, lon]) => latLonToVec(lat + 0.5, lon + 0.5));
  const lit = new Float32Array(cells.length);
  const seen = new Uint8Array(cells.length);
  const fireColors = new Float32Array(cells.length * 3);
  const fireGeo = new THREE.BufferGeometry();
  fireGeo.setAttribute('position', new THREE.Float32BufferAttribute(fireDirs.flatMap((v) => v.map((x) => x * 1.008)), 3));
  fireGeo.setAttribute('color', new THREE.BufferAttribute(fireColors, 3));
  const firePoints = new THREE.Points(fireGeo, new THREE.PointsMaterial({ size: 0.024, vertexColors: true, transparent: true, opacity: 0.95, depthWrite: false }));
  firePoints.visible = false;
  earth.add(firePoints);
  const isDay = new Uint8Array(cells.length);
  const UNSEEN: Vec3 = [0.42, 0.16, 0.04], DARK: Vec3 = [0.03, 0.05, 0.13], SEEN: Vec3 = [1, 0.42, 0.05], FLASH: Vec3 = [1, 0.95, 0.35];
  const paintFire = (k: number) => {
    const l = lit[k]!;
    const base = seen[k] ? SEEN : (model?.camera?.dayOnly ?? true) && !isDay[k] ? DARK : UNSEEN;
    for (let c = 0; c < 3; c++) fireColors[k * 3 + c] = base[c]! + (FLASH[c]! - base[c]!) * l;
  };
  const sunLocalNow = () => SUN.clone().applyQuaternion(earth.getWorldQuaternion(new THREE.Quaternion()).invert());
  // Day and night move as Earth turns: every dot is repainted twice a second, the flashing ones every frame.
  const repaintAll = () => {
    const s = sunLocalNow();
    for (let k = 0; k < fireDirs.length; k++) { const f = fireDirs[k]!; isDay[k] = f[0] * s.x + f[1] * s.y + f[2] * s.z > 0 ? 1 : 0; paintFire(k); }
    (fireGeo.attributes.color as THREE.BufferAttribute).needsUpdate = true;
  };
  const active = new Set<number>();
  const COS_REACH = Math.cos(0.07);
  let sinceRepaint = 1;

  let model: EarthModel | null = null;
  let lastKey = '';
  let seenKey = '';
  let parts: THREE.Object3D[] = [];
  let stationDirs: Vec3[] = [];
  let sat: THREE.Group | null = null;
  const cone = new THREE.Mesh(new THREE.ConeGeometry(1, 1, 24, 1, true).translate(0, -0.5, 0), mats.cone);
  pivot.add(cone);
  const link = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 1, 8, 1, true), mats.link);
  link.visible = false;
  pivot.add(link);
  // Data packets flowing down the link while a station is in view.
  const PACKETS = 6;
  const packetGeo = new THREE.BufferGeometry();
  packetGeo.setAttribute('position', new THREE.Float32BufferAttribute(new Array(PACKETS * 3).fill(0), 3));
  const packets = new THREE.Points(packetGeo, mats.packets);
  packets.visible = false;
  pivot.add(packets);

  // Geometry only: the materials are shared and live as long as the scene.
  const clear = () => { for (const p of parts) { p.parent?.remove(p); p.traverse((o) => { (o as THREE.Mesh).geometry?.dispose?.(); const sp = o as THREE.Sprite; if (sp.isSprite) { sp.material.map?.dispose(); sp.material.dispose(); } }); } parts = []; };

  let fast = false;
  let t = 0;
  let meterLevel = 0;
  let meterCb: ((l: number, o: boolean) => void) | null = null;

  const set = (m: EarthModel, ghost: EarthModel | null) => {
    // Most picks (objectives, budget split...) change nothing that is drawn: then there is nothing to rebuild.
    const key = JSON.stringify([m, ghost]);
    if (key === lastKey) return;
    lastKey = key;
    // A new orbit or camera starts a fresh picture of what was seen.
    const sk = JSON.stringify([m.altKm, m.incDeg, m.camera]);
    const fresh = sk !== seenKey;
    seenKey = sk;
    model = m;
    clear();
    const ring = ringLine(m, mats, false);
    pivot.add(ring); parts.push(ring);
    if (ghost && (ghost.altKm !== m.altKm || ghost.incDeg !== m.incDeg)) { const gr = ringLine(ghost, mats, true); pivot.add(gr); parts.push(gr); }
    // The edge of what the orbit can see: thin circles at ± the highest latitude, with the number.
    const edge = coverageLat(m.incDeg);
    for (const sgn of [1, -1]) {
      const c = latitudeCircle(sgn * edge, mats.latLine);
      earth.add(c); parts.push(c);
    }
    const tag = label(`${edge.toFixed(1)}°N`);
    tag.position.set(...(latLonToVec(edge, -70).map((x) => x * 1.12) as Vec3));
    earth.add(tag); parts.push(tag);
    stationDirs = m.stations.map((s) => latLonToVec(s.lat, s.lon));
    const addStations = (list: { lat: number; lon: number }[], alt: number, faint: boolean) => {
      for (const s of list) {
        const v = latLonToVec(s.lat, s.lon);
        const dot = new THREE.Mesh(new THREE.SphereGeometry(0.03, 12, 8), faint ? mats.ghostStation : mats.station);
        dot.position.set(...(v.map((x) => x * 1.006) as Vec3));
        earth.add(dot); parts.push(dot);
        const c = circleOnSphere(v, footprintAngle(alt), 1.006, faint ? mats.ghostFootprint : mats.footprint);
        earth.add(c); parts.push(c);
      }
    };
    addStations(m.stations, m.altKm, false);
    if (ghost) {
      const extra = ghost.stations.filter((g) => !m.stations.some((s) => s.lat === g.lat && s.lon === g.lon));
      addStations(extra, ghost.altKm, true);
    }
    firePoints.visible = m.fires;
    if (fresh) { seen.fill(0); lit.fill(0); active.clear(); covCtx.clearRect(0, 0, cov.width, cov.height); covTex.needsUpdate = true; }
    repaintAll();
    sat = satellite(m, ghost, mats);
    sat.scale.setScalar(1.5);
    pivot.add(sat); parts.push(sat);
  };

  const resize = () => {
    const w = host.clientWidth, h = host.clientHeight;
    if (!w || !h || (w === lastW && h === lastH)) return;
    lastW = w; lastH = h;
    renderer.setSize(w, h, false);
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    // Resizing clears the canvas: draw at once, or the view blinks until the next frame.
    if (model) frame(0);
  };
  let lastW = 0, lastH = 0;
  const ro = new ResizeObserver(resize);
  ro.observe(host);

  // Dragging turns the view; the wheel zooms. Nothing else.
  let drag: { x: number; y: number } | null = null;
  const el = renderer.domElement;
  el.style.touchAction = 'none';
  el.addEventListener('pointerdown', (e) => { drag = { x: e.clientX, y: e.clientY }; el.setPointerCapture(e.pointerId); });
  el.addEventListener('pointermove', (e) => { if (!drag) return; pivot.rotation.y += (e.clientX - drag.x) * 0.008; pivot.rotation.x = Math.max(-1.2, Math.min(1.2, pivot.rotation.x + (e.clientY - drag.y) * 0.008)); drag = { x: e.clientX, y: e.clientY }; frame(0); });
  el.addEventListener('pointerup', () => { drag = null; });
  el.addEventListener('wheel', (e) => { e.preventDefault(); dist = Math.max(2.4, Math.min(8, dist * (e.deltaY > 0 ? 1.08 : 0.93))); frame(0); }, { passive: false });

  // Visible only: stop drawing when the view is off screen or the tab is hidden.
  let visible = true;
  const io = new IntersectionObserver((es) => { visible = es.some((x) => x.isIntersecting); });
  io.observe(host);

  const frame = (dt: number) => {
    if (model && sat) {
      const speed = fast ? 14 : 1;
      t += dt * speed;
      const r = radiusOf(model.altKm), inc = (model.incDeg * Math.PI) / 180;
      const u = (t / ORBIT_SECONDS) * Math.PI * 2;
      const p = orbitPos(r, u, inc, NODE);
      // Earth turns once per real day: as many orbits as fit in a day at this altitude.
      const orbitsPerDay = 86400 / periodSec(model.altKm);
      earth.rotation.y = (t / (ORBIT_SECONDS * orbitsPerDay)) * Math.PI * 2;
      sat.position.set(...p);
      sat.lookAt(0, 0, 0);
      const observing = ((u / (Math.PI * 2)) % 1) < model.duty;
      // The field of view reaches down to the ground; it is hidden where the plan does not observe.
      cone.visible = observing && !!model.camera;
      cone.position.set(...p);
      cone.lookAt(0, 0, 0);
      cone.rotateX(-Math.PI / 2);
      const h = r - 1;
      cone.scale.set(h * 0.32, h, h * 0.32);
      // The point under the satellite, in Earth's own frame.
      const local = earth.worldToLocal(pivot.localToWorld(new THREE.Vector3(...p)));
      const sub: Vec3 = [local.x, local.y, local.z];
      if (fast && observing) {
        const [lat, lon] = vecToLatLon(sub);
        covCtx.fillStyle = 'rgba(127, 209, 255, 0.3)';
        covCtx.beginPath();
        covCtx.arc(((lon + 180) / 360) * cov.width, ((90 - lat) / 180) * cov.height, 6, 0, Math.PI * 2);
        covCtx.fill();
        covTex.needsUpdate = true;
      }
      // Fires under the camera light up: day side only for daytime cameras, a share set by the camera.
      if (model.fires) {
        sinceRepaint += dt;
        const changed = active.size > 0;
        for (const k of active) { lit[k] = Math.max(0, lit[k]! - dt * speed * 0.6); paintFire(k); if (!lit[k]) active.delete(k); }
        if (observing && model.camera) {
          const s = sunLocalNow();
          const sl = Math.hypot(...sub) || 1;
          const sx = sub[0] / sl, sy = sub[1] / sl, sz = sub[2] / sl;
          for (let k = 0; k < fireDirs.length; k++) {
            const f = fireDirs[k]!;
            if (f[0] * sx + f[1] * sy + f[2] * sz < COS_REACH) continue;
            const day = f[0] * s.x + f[1] * s.y + f[2] * s.z > 0;
            const level = day ? cells[k]![2] : cells[k]![3];
            if (!level || (model.camera.dayOnly && !day)) continue;
            if (((k * 2654435761) % 1000) / 1000 < model.camera.share && !active.has(k)) { lit[k] = 1; seen[k] = 1; paintFire(k); active.add(k); }
          }
        }
        if (sinceRepaint > 0.5) { sinceRepaint = 0; repaintAll(); }
        else if (changed || active.size) (fireGeo.attributes.color as THREE.BufferAttribute).needsUpdate = true;
      }
      // Link to a station in view; thickness follows the radio rate; packets flow down it.
      const lam = footprintAngle(model.altKm);
      const inView = stationDirs.findIndex((s) => angleBetween(s, sub) < lam);
      if (inView >= 0) {
        const sw = pivot.worldToLocal(earth.localToWorld(new THREE.Vector3(...stationDirs[inView]!).multiplyScalar(1.006)));
        const sp = new THREE.Vector3(...p);
        link.position.copy(sw.clone().add(sp).multiplyScalar(0.5));
        const w = 0.003 + 0.004 * Math.log10(1 + model.linkMBPerMin * 10);
        link.scale.set(w, sw.distanceTo(sp), w);
        link.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), sp.clone().sub(sw).normalize());
        link.visible = true;
        const arr = packetGeo.attributes.position as THREE.BufferAttribute;
        for (let k = 0; k < PACKETS; k++) {
          const f = ((t * 0.9 + k / PACKETS) % 1);
          const q = sp.clone().lerp(sw, f);
          arr.setXYZ(k, q.x, q.y, q.z);
        }
        arr.needsUpdate = true;
        packets.visible = true;
      } else { link.visible = false; packets.visible = false; }
      // On-board data: fills all the time, drains while linked. Full = about sixteen hours of data.
      const simSec = (dt * speed * periodSec(model.altKm)) / ORBIT_SECONDS;
      const cap = Math.max(model.dataPerDay / 1.5, 1e-6);
      meterLevel += (model.dataPerDay / 86400) * simSec;
      if (inView >= 0) meterLevel -= (model.linkMBPerMin / 60) * simSec;
      meterLevel = Math.max(0, Math.min(cap, meterLevel));
      // Red only when the engine says the downlink cannot keep up, so the picture never contradicts the gauge.
      meterCb?.(meterLevel / cap, model.overflow);
    }
    camera.position.set(0, 0, dist);
    camera.lookAt(0, 0, 0);
    renderer.render(scene, camera);
  };

  // About 30 frames a second is plenty for a slow orbit and halves the work; fast-forward draws every frame.
  let raf = 0, last = performance.now();
  const loop = (now: number) => {
    const dt = Math.min(0.1, (now - last) / 1000);
    if (visible && !document.hidden && !opts.reduceMotion && (fast || dt >= 1 / 32)) { last = now; frame(dt); }
    raf = requestAnimationFrame(loop);
  };
  raf = requestAnimationFrame(loop);
  resize();

  return {
    set: (m, g) => { set(m, g); frame(0); },
    setFast: (on) => { fast = on; if (opts.reduceMotion && on) { for (let k = 0; k < 400; k++) frame(0.05); } },
    onMeter: (cb) => { meterCb = cb; },
    dispose: () => { cancelAnimationFrame(raf); ro.disconnect(); io.disconnect(); clear(); Object.values(mats).forEach((x) => x.dispose()); renderer.dispose(); renderer.forceContextLoss(); el.remove(); },
  };
}

export { coverageLat };
