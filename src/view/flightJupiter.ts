import * as THREE from 'three';
import { GREY, movingLine, opsProgress, travel, type FlightCraft, type FlightScene } from './flightCommon';
import { ellipsePoints, flybyPos, jupiterTexture } from './jupiterScene';
import { createStage, disposeGeometry, seeded } from './stage';

/**
 * The flight at Jupiter: the four spacecraft cross from the inner solar system and arrive on their chosen
 * route (flybys, Europa orbit or Ganymede orbit). Each close, observed pass leaves a dot in the agency's
 * colour beside the moon it studies, so the routes and plans can be compared. Counts come from the engine.
 */
export interface JupiterFlightModel {
  craft: (FlightCraft & { path: 'flybys' | 'europaOrbit' | 'ganymede'; shield: number })[];
  opsAt: number;
  opsSeconds: number;
}

const EUROPA_R = 3.0, GANYMEDE_R = 4.7;
const PERIOD = 1.4; // seconds per flyby loop (and per Europa orbit) during the flight
const FROM = new THREE.Vector3(-12, 2.2, 6);

export function createJupiterFlight(host: HTMLElement, opts: { reduceMotion: boolean }): FlightScene<JupiterFlightModel> {
  const st = createStage(host, { reduceMotion: opts.reduceMotion, dist: 17, tilt: 0.5 });
  const { scene, pivot } = st;
  scene.add(new THREE.AmbientLight(0x8090b0, 0.55));
  const sun = new THREE.DirectionalLight(0xffffff, 1.4);
  sun.position.set(-10, 2, 4);
  scene.add(sun);
  {
    const rnd = seeded(5), pts: number[] = [];
    for (let k = 0; k < 300; k++) { const v = new THREE.Vector3(rnd() - 0.5, rnd() - 0.5, rnd() - 0.5).normalize().multiplyScalar(60); pts.push(v.x, v.y, v.z); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    scene.add(new THREE.Points(g, new THREE.PointsMaterial({ color: 0x8c9ab8, size: 0.12, transparent: true, opacity: 0.6 })));
  }
  const fixed: THREE.Material[] = [];
  const keep = <T extends THREE.Material>(m: T) => { fixed.push(m); return m; };
  const jupMat = keep(new THREE.MeshPhongMaterial({ map: jupiterTexture(), shininess: 4 }));
  pivot.add(new THREE.Mesh(new THREE.SphereGeometry(1, 40, 24), jupMat));
  [[2.9, 0.55, 0.14], [2.95, 0.95, 0.07], [3.05, 1.4, 0.035]].forEach(([r, tube, o]) => {
    const t = new THREE.Mesh(new THREE.TorusGeometry(r!, tube!, 16, 64), keep(new THREE.MeshBasicMaterial({ color: 0xc58cff, transparent: true, opacity: o!, depthWrite: false, blending: THREE.AdditiveBlending })));
    t.rotation.x = Math.PI / 2;
    pivot.add(t);
  });
  const orbitMat = keep(new THREE.LineBasicMaterial({ color: 0x5a6b8f, transparent: true, opacity: 0.7 }));
  for (const r of [EUROPA_R, GANYMEDE_R]) pivot.add(new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(ellipsePoints(r, r, 96)), orbitMat));
  const europa = new THREE.Mesh(new THREE.SphereGeometry(0.22, 20, 12), keep(new THREE.MeshPhongMaterial({ color: 0xd8cbb0 })));
  const ganymede = new THREE.Mesh(new THREE.SphereGeometry(0.28, 20, 12), keep(new THREE.MeshPhongMaterial({ color: 0x9c8f7c })));
  pivot.add(europa, ganymede);
  // The Sun and the inner solar system the spacecraft come from.
  const sunDot = new THREE.Mesh(new THREE.SphereGeometry(0.3, 12, 8), keep(new THREE.MeshBasicMaterial({ color: 0xfff2c0 })));
  sunDot.position.copy(FROM);
  pivot.add(sunDot);

  const greyMat = keep(new THREE.MeshBasicMaterial({ color: GREY }));
  const failMat = keep(new THREE.MeshBasicMaterial({ color: 0xef5350 }));
  let parts: THREE.Object3D[] = [];
  let mats: THREE.Material[] = [];
  type Live = {
    c: JupiterFlightModel['craft'][number]; nth: number; body: THREE.Group; bodyMat: THREE.MeshBasicMaterial; trip: ReturnType<typeof movingLine>; fail: THREE.Mesh;
    marks: THREE.Points; markCount: number; passes: number; greyed: boolean; pathLine: THREE.Line;
  };
  let live: Live[] = [];
  let model: JupiterFlightModel | null = null;
  let clock = 0;
  const MARKS = 48;

  const moonOf = (l: Live) => (l.c.path === 'ganymede' ? ganymede : europa);
  const posOf = (l: Live, t: number) => {
    const off = l.nth * 0.23;
    if (l.c.path === 'flybys') return flybyPos(((t / PERIOD) + off) % 1, 2.85, 7.6).applyAxisAngle(new THREE.Vector3(0, 1, 0), l.nth * 0.35);
    const a = t * 4 + off * 6;
    const r = l.c.path === 'ganymede' ? 0.55 + l.nth * 0.08 : 0.42 + l.nth * 0.08;
    return moonOf(l).position.clone().add(new THREE.Vector3(r * Math.cos(a), 0.12 * Math.sin(a), r * Math.sin(a)));
  };

  const set = (m: JupiterFlightModel) => {
    disposeGeometry(parts); parts = [];
    for (const x of mats) x.dispose();
    mats = [];
    model = m; clock = 0;
    const sameRoute = new Map<string, number>();
    live = m.craft.map((c, idx) => {
      const nth = sameRoute.get(c.path) ?? 0;
      sameRoute.set(c.path, nth + 1);
      const color = new THREE.Color(c.color);
      const bodyMat = new THREE.MeshBasicMaterial({ color: c.kind === 'dark' ? GREY : color });
      const shellMat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.35, wireframe: true });
      const markMat = new THREE.PointsMaterial({ color, size: 0.16, transparent: true, opacity: 0.95, depthWrite: false });
      const lineMat = new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.35 });
      mats.push(bodyMat, shellMat, markMat, lineMat);
      const body = new THREE.Group();
      body.add(new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.2, 0.28), bodyMat));
      for (const s of [-1, 1]) { const w = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.14), bodyMat); w.position.x = s * 0.36; w.rotation.x = Math.PI / 2; body.add(w); }
      // The vault, as in the mission view: a larger, denser shell when thicker.
      body.add(new THREE.Mesh(new THREE.IcosahedronGeometry(0.24 + 0.06 * c.shield, c.shield + 1), shellMat));
      body.visible = false;
      pivot.add(body); parts.push(body);
      const pts = c.path === 'flybys' ? ellipsePoints(2.85, 7.6).map((p) => p.applyAxisAngle(new THREE.Vector3(0, 1, 0), nth * 0.35)) : [];
      const pathLine = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts.length ? pts : [new THREE.Vector3(), new THREE.Vector3()]), lineMat);
      pathLine.visible = false;
      pivot.add(pathLine); parts.push(pathLine);
      const trip = movingLine(c.color);
      mats.push(trip.mat);
      pivot.add(trip.line); parts.push(trip.line);
      const fail = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8), failMat);
      fail.visible = false;
      pivot.add(fail); parts.push(fail);
      // Close observed passes: dots on a small ring of the agency's own beside the moon it studies.
      const rnd = seeded(31 + nth * 13 + c.path.length);
      const mp: number[] = [];
      for (let k = 0; k < MARKS; k++) { const a = rnd() * Math.PI * 2, r = 0.42 + 0.14 * idx + rnd() * 0.1; mp.push(Math.cos(a) * r, (rnd() - 0.5) * 0.15, Math.sin(a) * r); }
      const mg = new THREE.BufferGeometry(); mg.setAttribute('position', new THREE.Float32BufferAttribute(mp, 3)); mg.setDrawRange(0, 0);
      const marks = new THREE.Points(mg, markMat);
      pivot.add(marks); parts.push(marks);
      return { c, nth, body, bodyMat, trip, fail, marks, markCount: 0, passes: 0, greyed: false, pathLine };
    });
  };

  const step = (dt: number) => {
    if (!model) return;
    clock += dt;
    const eAng = (clock / PERIOD) * Math.PI * 2;
    europa.position.set(EUROPA_R * Math.cos(eAng), 0, EUROPA_R * Math.sin(eAng));
    const gAng = (clock / (PERIOD * 2)) * Math.PI * 2 + 2;
    ganymede.position.set(GANYMEDE_R * Math.cos(gAng), 0, GANYMEDE_R * Math.sin(gAng));
    for (const l of live) {
      const stopped = l.c.stopAt < 0.999 && clock > model.opsAt + model.opsSeconds * l.c.stopAt;
      const tFrozen = stopped ? model.opsAt + model.opsSeconds * l.c.stopAt : clock;
      const target = posOf(l, tFrozen);
      if (!travel(l.c, clock, FROM, target, l.trip, l.fail)) continue;
      l.body.visible = true;
      l.pathLine.visible = l.c.path === 'flybys';
      l.body.position.copy(target);
      l.body.lookAt(0, 0, 0);
      if (stopped && !l.greyed) { l.greyed = true; l.body.traverse((o) => { const me = o as THREE.Mesh; if (me.isMesh && me.material === l.bodyMat) me.material = greyMat; }); }
      // Marks sit beside the moon and travel with it.
      l.marks.position.copy(moonOf(l).position);
      if (l.c.kind !== 'ok') continue;
      const prog = opsProgress(clock, model.opsAt, model.opsSeconds, l.c);
      const n = Math.floor(prog * MARKS * Math.min(1, 0.25 + l.c.duty) * (l.c.path === 'ganymede' ? 0.6 : 1));
      if (n !== l.markCount) { l.markCount = n; l.marks.geometry.setDrawRange(0, n); }
    }
  };
  st.onStep((dt) => step(dt));

  return {
    set: (m) => { set(m); if (opts.reduceMotion) { const end = m.opsAt + m.opsSeconds + 0.5; while (clock < end) step(0.05); } st.draw(0); },
    finish: () => { if (!model) return; const end = model.opsAt + model.opsSeconds + 0.5; while (clock < end) step(0.05); st.draw(0); },
    dispose: () => { disposeGeometry(parts); for (const x of [...mats, ...fixed]) x.dispose(); jupMat.map?.dispose(); st.dispose(); },
  };
}
