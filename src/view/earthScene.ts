import * as THREE from 'three';
import firesDoc from '../../data/firms-cells-2024.json';
import { angleBetween, coverageLat, footprintAngle, latLonToVec, orbitPos, periodSec, RE_KM, vecToLatLon, type Vec3 } from './orbit';

/** What the Earth scene draws: built from the design state, never from slot ids. */
export interface EarthModel {
  altKm: number;
  incDeg: number;
  stations: { lat: number; lon: number }[];
  /** Sum of radio rates (MB/min): the link line's thickness. */
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

const SUN = new THREE.Vector3(1, 0.25, 0.45).normalize();
// Altitude is drawn larger than life (×3) so 410, 500 and 600 km look different.
const radiusOf = (altKm: number) => 1 + (altKm / RE_KM) * 3;
const NODE = 0.6;
const ORBIT_SECONDS = 8;

/** Equirectangular canvas where the observed swath is painted during fast-forward. */
function coverageCanvas() {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 256;
  return c;
}

function graticule(): THREE.LineSegments {
  const pts: number[] = [];
  const push = (a: Vec3, b: Vec3) => pts.push(...a.map((v) => v * 1.001), ...b.map((v) => v * 1.001));
  for (let lat = -60; lat <= 60; lat += 30) for (let lon = -180; lon < 180; lon += 6) push(latLonToVec(lat, lon), latLonToVec(lat, lon + 6));
  for (let lon = -180; lon < 180; lon += 30) for (let lat = -84; lat < 84; lat += 6) push(latLonToVec(lat, lon), latLonToVec(lat + 6, lon));
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
  return new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: 0x3a5a8e, transparent: true, opacity: 0.55 }));
}

function circleOnSphere(center: Vec3, angle: number, radius: number, color: number, opacity: number): THREE.LineLoop {
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
  return new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color, transparent: true, opacity }));
}

function ringLine(m: EarthModel, opacity: number, dashed: boolean): THREE.Line {
  const r = radiusOf(m.altKm), inc = (m.incDeg * Math.PI) / 180;
  const pts: number[] = [], colors: number[] = [];
  for (let k = 0; k <= 180; k++) {
    const p = orbitPos(r, (k / 180) * Math.PI * 2, inc, NODE);
    pts.push(...p);
    // In Earth's shadow: behind the planet as seen from the Sun.
    const v = new THREE.Vector3(...p);
    const along = v.dot(SUN);
    const shadow = along < 0 && v.clone().sub(SUN.clone().multiplyScalar(along)).length() < 1;
    const c = shadow ? new THREE.Color(0x3b4660) : new THREE.Color(0x9fd8ff);
    colors.push(c.r, c.g, c.b);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  const mat = dashed
    ? new THREE.LineDashedMaterial({ vertexColors: true, transparent: true, opacity, dashSize: 0.04, gapSize: 0.03 })
    : new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity });
  const line = new THREE.Line(g, mat);
  if (dashed) line.computeLineDistances();
  return line;
}

function satellite(m: EarthModel): THREE.Group {
  const g = new THREE.Group();
  g.add(new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.035, 0.055), new THREE.MeshStandardMaterial({ color: 0xe8ecf4, metalness: 0.3, roughness: 0.5 })));
  if (m.wings) for (const s of [-1, 1]) {
    const w = new THREE.Mesh(new THREE.PlaneGeometry(0.07, 0.03), new THREE.MeshStandardMaterial({ color: 0x2f6fde, side: THREE.DoubleSide, metalness: 0.4, roughness: 0.4 }));
    w.position.x = s * 0.055;
    g.add(w);
  }
  for (let k = 0; k < m.rings; k++) {
    const t = new THREE.Mesh(new THREE.TorusGeometry(0.055 + k * 0.018, 0.004, 6, 32), new THREE.MeshBasicMaterial({ color: 0xffb74d }));
    t.rotation.x = Math.PI / 2;
    g.add(t);
  }
  const cone = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.18, 16, 1, true), new THREE.MeshBasicMaterial({ color: 0xffd27f, transparent: true, opacity: 0.18, side: THREE.DoubleSide }));
  cone.name = 'cone';
  g.add(cone);
  return g;
}

export function createEarthScene(host: HTMLElement, opts: { reduceMotion: boolean; textureUrl?: string }): EarthScene {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  // Capped at 1.5: a small view does not need a full Retina buffer, and the GPU work drops by almost half.
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
  host.appendChild(renderer.domElement);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
  const pivot = new THREE.Group();
  scene.add(pivot);
  pivot.rotation.set(0.45, -0.7, 0);
  let dist = 5.6;

  scene.add(new THREE.AmbientLight(0x6070a0, 0.55));
  const sunLight = new THREE.DirectionalLight(0xffffff, 1.6);
  sunLight.position.copy(SUN).multiplyScalar(10);
  scene.add(sunLight);

  // Faint fixed stars.
  {
    const pts: number[] = [];
    let seed = 7;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let k = 0; k < 400; k++) { const v = new THREE.Vector3(rnd() - 0.5, rnd() - 0.5, rnd() - 0.5).normalize().multiplyScalar(30); pts.push(v.x, v.y, v.z); }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    scene.add(new THREE.Points(g, new THREE.PointsMaterial({ color: 0x8c9ab8, size: 0.06, transparent: true, opacity: 0.6 })));
  }

  // Earth: NASA Blue Marble when the texture is available, otherwise a lit sphere with a graticule.
  const earth = new THREE.Group();
  pivot.add(earth);
  const earthMat = new THREE.MeshPhongMaterial({ color: 0x1d3f74, shininess: 8 });
  earth.add(new THREE.Mesh(new THREE.SphereGeometry(1, 48, 32), earthMat));
  const grid = graticule();
  earth.add(grid);
  if (opts.textureUrl) {
    new THREE.TextureLoader().load(opts.textureUrl, (tex) => {
      tex.colorSpace = THREE.SRGBColorSpace;
      earthMat.map = tex; earthMat.color.set(0xffffff); earthMat.needsUpdate = true;
      (grid.material as THREE.LineBasicMaterial).opacity = 0.18;
    }, undefined, () => { /* no texture: keep the graticule */ });
  }
  const cov = coverageCanvas();
  const covCtx = cov.getContext('2d')!;
  const covTex = new THREE.CanvasTexture(cov);
  earth.add(new THREE.Mesh(new THREE.SphereGeometry(1.004, 48, 32), new THREE.MeshBasicMaterial({ map: covTex, transparent: true, depthWrite: false })));

  // Real 2024 fires (NASA FIRMS), one dot per 1-degree cell; dots light up when the camera passes over them.
  const cells = (firesDoc as unknown as { cells: [number, number, number, number][] }).cells;
  const fireDirs = cells.map(([lat, lon]) => latLonToVec(lat + 0.5, lon + 0.5));
  const lit = new Float32Array(cells.length);
  const fireColors = new Float32Array(cells.length * 3);
  const fireGeo = new THREE.BufferGeometry();
  fireGeo.setAttribute('position', new THREE.Float32BufferAttribute(fireDirs.flatMap((v) => v.map((x) => x * 1.008)), 3));
  fireGeo.setAttribute('color', new THREE.BufferAttribute(fireColors, 3));
  const firePoints = new THREE.Points(fireGeo, new THREE.PointsMaterial({ size: 0.011, vertexColors: true, transparent: true, opacity: 0.9, depthWrite: false }));
  firePoints.visible = false;
  earth.add(firePoints);
  const fireLevel = cells.map((c) => (Math.max(c[2], c[3]) / 9) ** 3);
  const paintFire = (k: number) => {
    const lv = fireLevel[k]!, l = lit[k]!;
    fireColors[k * 3] = 0.015 + 0.2 * lv + 0.8 * l;
    fireColors[k * 3 + 1] = 0.006 + 0.02 * lv + 0.6 * l;
    fireColors[k * 3 + 2] = 0.01 + 0.15 * l;
  };
  for (let k = 0; k < cells.length; k++) paintFire(k);
  // Only the dots that are lit (a few dozen at a time) are updated each frame.
  const active = new Set<number>();
  const COS_REACH = Math.cos(0.07);

  let model: EarthModel | null = null;
  let parts: THREE.Object3D[] = [];
  let stationDirs: Vec3[] = [];
  let sat: THREE.Group | null = null;
  const link = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 1, 8, 1, true), new THREE.MeshBasicMaterial({ color: 0x7fd1ff, transparent: true, opacity: 0.85 }));
  link.visible = false;
  pivot.add(link);

  const clear = () => { for (const p of parts) { p.parent?.remove(p); p.traverse((o) => { const x = o as THREE.Mesh; x.geometry?.dispose?.(); const mt = x.material as THREE.Material | THREE.Material[] | undefined; if (Array.isArray(mt)) mt.forEach((y) => y.dispose()); else mt?.dispose?.(); }); } parts = []; };

  let fast = false;
  let t = 0;
  let meterLevel = 0;
  let meterCb: ((l: number, o: boolean) => void) | null = null;

  const set = (m: EarthModel, ghost: EarthModel | null) => {
    const orbitChanged = !model || model.altKm !== m.altKm || model.incDeg !== m.incDeg;
    model = m;
    clear();
    const ring = ringLine(m, 0.9, false);
    pivot.add(ring); parts.push(ring);
    if (ghost && (ghost.altKm !== m.altKm || ghost.incDeg !== m.incDeg)) { const gr = ringLine(ghost, 0.45, true); pivot.add(gr); parts.push(gr); }
    stationDirs = m.stations.map((s) => latLonToVec(s.lat, s.lon));
    const addStations = (list: { lat: number; lon: number }[], alt: number, opacity: number) => {
      for (const s of list) {
        const v = latLonToVec(s.lat, s.lon);
        const dot = new THREE.Mesh(new THREE.SphereGeometry(0.022, 10, 8), new THREE.MeshBasicMaterial({ color: 0xffb74d, transparent: true, opacity }));
        dot.position.set(...(v.map((x) => x * 1.006) as Vec3));
        earth.add(dot); parts.push(dot);
        const c = circleOnSphere(v, footprintAngle(alt), 1.006, 0xffb74d, 0.6 * opacity);
        earth.add(c); parts.push(c);
      }
    };
    addStations(m.stations, m.altKm, 1);
    if (ghost) {
      const extra = ghost.stations.filter((g) => !m.stations.some((s) => s.lat === g.lat && s.lon === g.lon));
      addStations(extra, ghost.altKm, 0.4);
    }
    firePoints.visible = m.fires;
    sat = satellite(m);
    pivot.add(sat); parts.push(sat);
    if (orbitChanged) { covCtx.clearRect(0, 0, cov.width, cov.height); covTex.needsUpdate = true; }
  };

  let lastW = 0, lastH = 0;
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
  const ro = new ResizeObserver(resize);
  ro.observe(host);
  resize();

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
      const cone = sat.getObjectByName('cone')!;
      cone.visible = observing;
      cone.position.set(0, 0, 0.1);
      cone.rotation.set(-Math.PI / 2, 0, 0);
      // The point under the satellite, in Earth's own frame.
      const local = earth.worldToLocal(pivot.localToWorld(new THREE.Vector3(...p)));
      const sub: Vec3 = [local.x, local.y, local.z];
      if (fast && observing) {
        const [lat, lon] = vecToLatLon(sub);
        covCtx.fillStyle = 'rgba(255, 210, 127, 0.18)';
        covCtx.beginPath();
        covCtx.arc(((lon + 180) / 360) * cov.width, ((90 - lat) / 180) * cov.height, 5, 0, Math.PI * 2);
        covCtx.fill();
        covTex.needsUpdate = true;
      }
      // Fires under the camera light up: day side only for daytime cameras, a share set by the camera.
      if (model.fires) {
        const changed = active.size > 0;
        for (const k of active) { lit[k] = Math.max(0, lit[k]! - dt * 0.6); paintFire(k); if (!lit[k]) active.delete(k); }
        if (observing && model.camera) {
          const sunLocal = SUN.clone().applyQuaternion(earth.getWorldQuaternion(new THREE.Quaternion()).invert());
          const sl = Math.hypot(...sub) || 1;
          const sx = sub[0] / sl, sy = sub[1] / sl, sz = sub[2] / sl;
          for (let k = 0; k < fireDirs.length; k++) {
            const f = fireDirs[k]!;
            if (f[0] * sx + f[1] * sy + f[2] * sz < COS_REACH) continue;
            const day = f[0] * sunLocal.x + f[1] * sunLocal.y + f[2] * sunLocal.z > 0;
            const level = day ? cells[k]![2] : cells[k]![3];
            if (!level || (model.camera.dayOnly && !day)) continue;
            if (((k * 2654435761) % 1000) / 1000 < model.camera.share) { lit[k] = 1; paintFire(k); active.add(k); }
          }
        }
        if (changed || active.size) (fireGeo.attributes.color as THREE.BufferAttribute).needsUpdate = true;
      }
      // Link to a station in view; thickness follows the radio rate.
      const lam = footprintAngle(model.altKm);
      const inView = stationDirs.findIndex((s) => angleBetween(s, sub) < lam);
      if (inView >= 0) {
        const sw = pivot.worldToLocal(earth.localToWorld(new THREE.Vector3(...stationDirs[inView]!).multiplyScalar(1.006)));
        const sp = new THREE.Vector3(...p);
        const mid = sw.clone().add(sp).multiplyScalar(0.5);
        link.position.copy(mid);
        link.scale.set(0.002 + 0.0035 * Math.log10(1 + model.linkMBPerMin * 10), sw.distanceTo(sp), 0.002 + 0.0035 * Math.log10(1 + model.linkMBPerMin * 10));
        link.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), sp.clone().sub(sw).normalize());
        link.visible = true;
      } else link.visible = false;
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

  return {
    set: (m, g) => { set(m, g); frame(0); },
    setFast: (on) => { fast = on; if (opts.reduceMotion && on) { for (let k = 0; k < 400; k++) frame(0.05); } },
    onMeter: (cb) => { meterCb = cb; },
    dispose: () => { cancelAnimationFrame(raf); ro.disconnect(); io.disconnect(); clear(); renderer.dispose(); el.remove(); },
  };
}

export { coverageLat };
