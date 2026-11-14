import * as THREE from 'three';
import firesDoc from '../../data/firms-cells-2024.json';
import { angleBetween, footprintAngle, latLonToVec, orbitPos, RE_KM, type Vec3 } from './orbit';
import { createStage, disposeGeometry } from './stage';

/**
 * The flight over Earth: the agencies' launches and their year in orbit, in one view. Drawn from the engine's
 * final runs (what launched, what failed, when a spacecraft stopped); which fire dots light up, and in whose
 * colour, is only a picture of each design's camera and plan, not the count the engine gives.
 */
export interface FlightSat {
  color: string;
  altKm: number;
  incDeg: number;
  /** Seconds after the scene starts when this rocket lifts off. */
  launchAt: number;
  /** ok: in orbit and talking; dark: in orbit, never heard from; fail: lost on the way up; stay: never launched. */
  kind: 'ok' | 'dark' | 'fail' | 'stay';
  /** Share of the operating time after which it stops (1 = kept going). */
  stopAt: number;
  duty: number;
  camera: { dayOnly: boolean; share: number } | null;
  stations: { lat: number; lon: number }[];
}

export interface FlightModel {
  sats: FlightSat[];
  /** Seconds after the start when the year in orbit begins, and how long it takes on screen. */
  opsAt: number;
  opsSeconds: number;
  fires: boolean;
}

export interface FlightScene {
  set(m: FlightModel): void;
  /** Jump to the end: everything in its final place, every fire each design would light. */
  finish(): void;
  dispose(): void;
}

const SUN = new THREE.Vector3(0.55, 0.3, 0.78).normalize();
const radiusOf = (altKm: number) => 1 + (altKm / RE_KM) * 2;
const NODE = 0.8;
const ORBIT_SECONDS = 1.3;
const EARTH_TURN_SECONDS = 3.2;
// Where the rockets rise from: a point on the globe facing the viewer, a little below and left of centre.
const PAD = new THREE.Vector3(-0.35, -0.3, 0.89).normalize().multiplyScalar(1.01);

export function createFlightScene(host: HTMLElement, opts: { reduceMotion: boolean; textureUrl?: string }): FlightScene {
  const st = createStage(host, { reduceMotion: opts.reduceMotion, dist: 4.6, tilt: 0.44 });
  const { scene, pivot } = st;
  scene.add(new THREE.AmbientLight(0x8090b8, 0.85));
  const sunLight = new THREE.DirectionalLight(0xffffff, 1.7);
  sunLight.position.copy(SUN).multiplyScalar(10);
  scene.add(sunLight);

  {
    const pts: number[] = [];
    let seed = 7;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let k = 0; k < 900; k++) { const v = new THREE.Vector3(rnd() - 0.5, rnd() - 0.5, rnd() - 0.5).normalize().multiplyScalar(30); pts.push(v.x, v.y, v.z); }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    scene.add(new THREE.Points(g, new THREE.PointsMaterial({ color: 0x9aa8c6, size: 0.05, transparent: true, opacity: 0.7 })));
  }

  const earth = new THREE.Group();
  pivot.add(earth);
  const earthMat = new THREE.MeshPhongMaterial({ color: 0x1d3f74, shininess: 8 });
  earth.add(new THREE.Mesh(new THREE.SphereGeometry(1, 48, 32), earthMat));
  pivot.add(new THREE.Mesh(new THREE.SphereGeometry(1.035, 48, 32), new THREE.MeshBasicMaterial({ color: 0x4f8fe0, transparent: true, opacity: 0.16, side: THREE.BackSide, depthWrite: false })));
  if (opts.textureUrl) {
    new THREE.TextureLoader().load(opts.textureUrl, (tex) => {
      tex.colorSpace = THREE.SRGBColorSpace;
      earthMat.map = tex; earthMat.color.set(0xffffff); earthMat.needsUpdate = true;
    }, undefined, () => {});
  }

  // Fire cells: dull until a camera passes; then the colour of the first agency whose camera saw them.
  const cells = (firesDoc as unknown as { cells: [number, number, number, number][] }).cells;
  const dirs = cells.map(([lat, lon]) => latLonToVec(lat + 0.5, lon + 0.5));
  const owner = new Int8Array(cells.length).fill(-1);
  const colors = new Float32Array(cells.length * 3);
  const fireGeo = new THREE.BufferGeometry();
  fireGeo.setAttribute('position', new THREE.Float32BufferAttribute(dirs.flatMap((v) => v.map((x) => x * 1.008)), 3));
  fireGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  const firePoints = new THREE.Points(fireGeo, new THREE.PointsMaterial({ size: 0.026, vertexColors: true, transparent: true, opacity: 0.95, depthWrite: false }));
  earth.add(firePoints);
  const UNSEEN: Vec3 = [0.36, 0.14, 0.05];
  let satColors: THREE.Color[] = [];
  const paint = (k: number) => {
    const o = owner[k]!;
    const c = o >= 0 ? satColors[o]! : null;
    colors[k * 3] = c ? c.r : UNSEEN[0]; colors[k * 3 + 1] = c ? c.g : UNSEEN[1]; colors[k * 3 + 2] = c ? c.b : UNSEEN[2];
  };
  let dirty = false;
  const COS_REACH = Math.cos(0.14);

  // Shared materials; geometry is rebuilt by set().
  const ringMat = new THREE.LineBasicMaterial({ color: 0xbfd6ff, transparent: true, opacity: 0.35 });
  const stationMat = new THREE.MeshBasicMaterial({ color: 0xffb74d });
  const grey = new THREE.MeshBasicMaterial({ color: 0x5a6478 });
  const failMat = new THREE.MeshBasicMaterial({ color: 0xef5350 });
  let parts: THREE.Object3D[] = [];
  let mats: THREE.Material[] = [];

  type Live = {
    s: FlightSat; body: THREE.Group; bodyMat: THREE.MeshBasicMaterial; trail: THREE.Line; link: THREE.Line;
    r: number; inc: number; offset: number; stations: Vec3[]; lam: number; u: number; x?: THREE.Mesh; greyed?: boolean;
  };
  let live: Live[] = [];
  let model: FlightModel | null = null;
  let clock = 0;

  const line = (color: THREE.ColorRepresentation, opacity = 0.9) => {
    const m = new THREE.LineBasicMaterial({ color, transparent: true, opacity });
    mats.push(m);
    const l = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]), m);
    l.frustumCulled = false;
    return l;
  };
  const setLine = (l: THREE.Line, a: THREE.Vector3, b: THREE.Vector3) => {
    const p = l.geometry.attributes.position as THREE.BufferAttribute;
    p.setXYZ(0, a.x, a.y, a.z); p.setXYZ(1, b.x, b.y, b.z); p.needsUpdate = true;
  };

  const set = (m: FlightModel) => {
    disposeGeometry(parts); parts = [];
    for (const x of mats) x.dispose();
    mats = [];
    model = m; clock = 0;
    owner.fill(-1);
    satColors = m.sats.map((s) => new THREE.Color(s.color));
    firePoints.visible = m.fires;
    for (let k = 0; k < cells.length; k++) paint(k);
    (fireGeo.attributes.color as THREE.BufferAttribute).needsUpdate = true;
    // One faint ring per distinct orbit; the agencies on the same orbit are spaced along it.
    const rings = new Map<string, number>();
    for (const s of m.sats) {
      if (s.kind === 'stay') continue;
      const key = `${s.altKm}/${s.incDeg}`;
      if (rings.has(key)) continue;
      rings.set(key, 0);
      const r = radiusOf(s.altKm), inc = (s.incDeg * Math.PI) / 180;
      const pts = Array.from({ length: 129 }, (_, k) => new THREE.Vector3(...orbitPos(r, (k / 128) * Math.PI * 2, inc, NODE)));
      const ring = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), ringMat);
      pivot.add(ring); parts.push(ring);
    }
    const seenStation = new Set<string>();
    for (const s of m.sats) for (const p of s.stations) {
      const key = `${p.lat},${p.lon}`;
      if (seenStation.has(key)) continue;
      seenStation.add(key);
      const dot = new THREE.Mesh(new THREE.SphereGeometry(0.028, 10, 8), stationMat);
      dot.position.set(...(latLonToVec(p.lat, p.lon).map((x) => x * 1.006) as Vec3));
      earth.add(dot); parts.push(dot);
    }
    const sameOrbit = new Map<string, number>();
    live = m.sats.map((s) => {
      const key = `${s.altKm}/${s.incDeg}`;
      const nth = sameOrbit.get(key) ?? 0;
      sameOrbit.set(key, nth + 1);
      const bodyMat = new THREE.MeshBasicMaterial({ color: s.kind === 'dark' ? 0x5a6478 : s.color });
      mats.push(bodyMat);
      const body = new THREE.Group();
      body.add(new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.09, 0.13), bodyMat));
      for (const sg of [-1, 1]) { const w = new THREE.Mesh(new THREE.PlaneGeometry(0.18, 0.075), bodyMat); w.position.x = sg * 0.135; body.add(w); }
      body.visible = false;
      pivot.add(body); parts.push(body);
      const trail = line(s.color, 0.95);
      trail.visible = false;
      pivot.add(trail); parts.push(trail);
      const link = line(s.color, 0.8);
      link.visible = false;
      pivot.add(link); parts.push(link);
      return {
        s, body, bodyMat, trail, link, r: radiusOf(s.altKm), inc: (s.incDeg * Math.PI) / 180, offset: nth * 0.45,
        stations: s.stations.map((p) => latLonToVec(p.lat, p.lon)), lam: footprintAngle(s.altKm), u: 0,
      };
    });
  };

  const opsStopAt = (l: Live) => model!.opsAt + model!.opsSeconds * l.s.stopAt;

  const step = (dt: number) => {
    if (!model) return;
    clock += dt;
    earth.rotation.y = (clock / EARTH_TURN_SECONDS) * Math.PI * 2;
    const sunLocal = SUN.clone().applyQuaternion(earth.getWorldQuaternion(new THREE.Quaternion()).invert());
    const inOps = clock >= model.opsAt;
    live.forEach((l, i) => {
      const s = l.s;
      if (s.kind === 'stay' || clock < s.launchAt) return;
      const flying = clock - s.launchAt;
      // Only a spacecraft that failed stops; the others keep circling after the year is over.
      const stopped = inOps && l.s.stopAt < 0.999 && clock > opsStopAt(l);
      // Moves along its orbit until it stops; a dark spacecraft drifts on but never answers.
      if (!stopped || s.kind === 'dark') l.u = l.offset + (clock / ORBIT_SECONDS) * Math.PI * 2;
      const pos = new THREE.Vector3(...orbitPos(l.r, l.u, l.inc, NODE));
      // The ascent: a line from the pad that reaches the orbit (or breaks off halfway on a failure).
      const climb = Math.min(1, flying / 1);
      if (s.kind === 'fail') {
        const end = PAD.clone().lerp(pos.clone().normalize().multiplyScalar(l.r), Math.min(climb, 0.5));
        setLine(l.trail, PAD, end);
        l.trail.visible = true;
        if (climb >= 0.5 && !l.x) {
          l.x = new THREE.Mesh(new THREE.SphereGeometry(0.045, 10, 8), failMat);
          l.x.position.copy(end);
          pivot.add(l.x); parts.push(l.x);
        }
        return;
      }
      if (climb < 1) { setLine(l.trail, PAD, PAD.clone().lerp(pos, climb)); l.trail.visible = true; return; }
      l.trail.visible = false;
      l.body.visible = true;
      l.body.position.copy(pos);
      l.body.lookAt(0, 0, 0);
      if (stopped && s.kind === 'ok' && !l.greyed) { l.greyed = true; l.body.traverse((o) => { if ((o as THREE.Mesh).isMesh) (o as THREE.Mesh).material = grey; }); }
      if (s.kind !== 'ok' || stopped) { l.link.visible = false; return; }
      const local = earth.worldToLocal(pivot.localToWorld(pos.clone()));
      const sub: Vec3 = [local.x, local.y, local.z];
      const st = l.stations.findIndex((p) => angleBetween(p, sub) < l.lam);
      if (st >= 0) {
        const w = pivot.worldToLocal(earth.localToWorld(new THREE.Vector3(...l.stations[st]!).multiplyScalar(1.006)));
        setLine(l.link, pos, w); l.link.visible = true;
      } else l.link.visible = false;
      // Fires under the camera take this agency's colour, while the plan observes, by the camera's rules.
      if (!inOps || clock > model!.opsAt + model!.opsSeconds || !model!.fires || !s.camera) return;
      const observing = (((l.u - l.offset) / (Math.PI * 2)) % 1) < s.duty;
      if (!observing) return;
      const len = Math.hypot(...sub) || 1;
      const sx = sub[0] / len, sy = sub[1] / len, sz = sub[2] / len;
      for (let k = 0; k < dirs.length; k++) {
        if (owner[k]! >= 0) continue;
        const f = dirs[k]!;
        if (f[0] * sx + f[1] * sy + f[2] * sz < COS_REACH) continue;
        const day = f[0] * sunLocal.x + f[1] * sunLocal.y + f[2] * sunLocal.z > 0;
        const level = day ? cells[k]![2] : cells[k]![3];
        if (!level || (s.camera.dayOnly && !day)) continue;
        if ((((k * 2654435761) >>> 0) % 1000) / 1000 >= s.camera.share) continue;
        owner[k] = i; paint(k); dirty = true;
      }
    });
    if (dirty) { (fireGeo.attributes.color as THREE.BufferAttribute).needsUpdate = true; dirty = false; }
  };
  st.onStep((dt) => step(dt));

  return {
    set: (m) => { set(m); if (opts.reduceMotion) { for (let k = 0; k < 400; k++) step(0.05); } st.draw(0); },
    finish: () => {
      if (!model) return;
      const end = model.opsAt + model.opsSeconds + 0.5;
      while (clock < end) step(0.05);
      st.draw(0);
    },
    dispose: () => {
      disposeGeometry(parts);
      for (const x of [...mats, ringMat, stationMat, grey, failMat]) x.dispose();
      st.dispose();
    },
  };
}
