import * as THREE from 'three';
import { GREY, movingLine, opsProgress, travel, type FlightCraft, type FlightScene } from './flightCommon';
import { poleTexture } from './lunarScene';
import { createStage, disposeGeometry, seeded } from './stage';

/**
 * The flight at the Moon's south pole: each agency's lander comes down on its landing site, and its rover
 * drives a loop that grows with the operating time, leaving the ice it found as dots in the agency's colour.
 * The counts come from the engine; the length of a drive and the dots only picture each design's plan.
 */
export interface MoonFlightModel {
  crater: { x: number; y: number; r: number };
  craft: (FlightCraft & { site: { x: number; y: number } })[];
  opsAt: number;
  opsSeconds: number;
}

const R = 4;
const DAY = 3.2;

export function createMoonFlight(host: HTMLElement, opts: { reduceMotion: boolean }): FlightScene<MoonFlightModel> {
  const st = createStage(host, { reduceMotion: opts.reduceMotion, dist: 11.5, tilt: 0.85 });
  const { scene, pivot } = st;
  scene.add(new THREE.AmbientLight(0x8090b0, 0.85));
  const sun = new THREE.DirectionalLight(0xffffff, 1.4);
  scene.add(sun);
  {
    const rnd = seeded(3), pts: number[] = [];
    for (let k = 0; k < 300; k++) { const v = new THREE.Vector3(rnd() - 0.5, rnd() - 0.5, rnd() - 0.5).normalize().multiplyScalar(40); pts.push(v.x, v.y, v.z); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    scene.add(new THREE.Points(g, new THREE.PointsMaterial({ color: 0x8c9ab8, size: 0.08, transparent: true, opacity: 0.6 })));
  }
  const discMat = new THREE.MeshPhongMaterial({ color: 0xffffff, shininess: 2 });
  const disc = new THREE.Mesh(new THREE.CircleGeometry(R, 64), discMat);
  disc.rotation.x = -Math.PI / 2;
  pivot.add(disc);
  const shadeMat = new THREE.MeshBasicMaterial({ color: 0x05060a, transparent: true, opacity: 0.5, depthWrite: false });
  const shade = new THREE.Mesh(new THREE.CircleGeometry(R * 1.001, 48, 0, Math.PI), shadeMat);
  shade.rotation.x = -Math.PI / 2;
  shade.position.y = 0.01;
  const shadePivot = new THREE.Group();
  shadePivot.add(shade);
  pivot.add(shadePivot);
  const onDisc = (x: number, y: number, h = 0) => new THREE.Vector3(x * R, h, y * R);

  const landerMat = new THREE.MeshStandardMaterial({ color: 0xc9ced8, metalness: 0.3, roughness: 0.6 });
  const greyMat = new THREE.MeshBasicMaterial({ color: GREY });
  const failMat = new THREE.MeshBasicMaterial({ color: 0xef5350 });
  let parts: THREE.Object3D[] = [];
  let mats: THREE.Material[] = [];
  type Live = {
    c: MoonFlightModel['craft'][number]; site: THREE.Vector3; track: THREE.Vector3[]; trackLine: THREE.Line; rover: THREE.Mesh;
    lander: THREE.Group; descent: ReturnType<typeof movingLine>; fail: THREE.Mesh; ice: THREE.Points; iceCount: number; greyed: boolean;
  };
  let live: Live[] = [];
  let model: MoonFlightModel | null = null;
  let clock = 0;
  const ICE = 40;

  const set = (m: MoonFlightModel) => {
    disposeGeometry(parts); parts = [];
    for (const x of mats) x.dispose();
    mats = [];
    model = m; clock = 0;
    discMat.map?.dispose(); discMat.map = poleTexture(m.crater); discMat.needsUpdate = true;
    const perSite = new Map<string, number>();
    live = m.craft.map((c) => {
      const key = `${c.site.x},${c.site.y}`;
      const nth = perSite.get(key) ?? 0;
      perSite.set(key, nth + 1);
      // Agencies at the same site land a little apart, so every rover can be seen.
      const ang = nth * (Math.PI / 2) + 0.4;
      const site = onDisc(c.site.x, c.site.y).add(new THREE.Vector3(Math.cos(ang), 0, Math.sin(ang)).multiplyScalar(nth ? 0.45 : 0));
      const color = new THREE.Color(c.color);
      const lineMat = new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.95 });
      const roverMat = new THREE.MeshStandardMaterial({ color, metalness: 0.2, roughness: 0.5 });
      const iceMat = new THREE.PointsMaterial({ color, size: 0.2, transparent: true, opacity: 0.95, depthWrite: false });
      const tagMat = new THREE.MeshBasicMaterial({ color });
      mats.push(lineMat, roverMat, iceMat, tagMat);
      // The drive: a loop towards the cold crater, longer with a busier plan.
      const toCrater = new THREE.Vector3(m.crater.x * R - site.x, 0, m.crater.y * R - site.z).normalize().applyAxisAngle(new THREE.Vector3(0, 1, 0), (nth - 1) * 0.5);
      const len = 0.5 + 2.2 * c.duty;
      const track = Array.from({ length: 80 }, (_, k) => {
        const a = (k / 79) * Math.PI * 2;
        return site.clone().add(toCrater.clone().multiplyScalar(Math.sin(a / 2) * len)).add(new THREE.Vector3(-toCrater.z, 0, toCrater.x).multiplyScalar(Math.sin(a) * len * 0.35)).setY(0.05);
      });
      const trackLine = new THREE.Line(new THREE.BufferGeometry().setFromPoints(track), lineMat);
      trackLine.geometry.setDrawRange(0, 0);
      pivot.add(trackLine); parts.push(trackLine);
      const lander = new THREE.Group();
      const body = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.26, 0.24, 8), landerMat);
      body.position.y = 0.2;
      lander.add(body);
      for (let k = 0; k < 4; k++) { const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.3, 4), landerMat); const a = k * Math.PI / 2; leg.position.set(Math.cos(a) * 0.25, 0.1, Math.sin(a) * 0.25); leg.rotation.z = Math.cos(a) * 0.5; leg.rotation.x = -Math.sin(a) * 0.5; lander.add(leg); }
      // A ring in the agency's colour, so each lander is clearly theirs.
      const tag = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.025, 6, 24), tagMat);
      tag.rotation.x = Math.PI / 2; tag.position.y = 0.34;
      lander.add(tag);
      lander.position.copy(site);
      lander.visible = false;
      pivot.add(lander); parts.push(lander);
      const rover = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.12, 0.2), c.kind === 'dark' ? greyMat : roverMat);
      rover.visible = false;
      pivot.add(rover); parts.push(rover);
      const descent = movingLine(c.color);
      mats.push(descent.mat);
      pivot.add(descent.line); parts.push(descent.line);
      const fail = new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 8), failMat);
      fail.visible = false;
      pivot.add(fail); parts.push(fail);
      // Ice found along the drive: dots placed near the track, shown as the rover gets there.
      const rnd = seeded(17 + nth * 7 + Math.round(c.site.x * 100));
      const icePts: number[] = [];
      for (let k = 0; k < ICE; k++) { const p = track[Math.floor((k / ICE) * 79)]!; icePts.push(p.x + (rnd() - 0.5) * 0.35, 0.07, p.z + (rnd() - 0.5) * 0.35); }
      const ig = new THREE.BufferGeometry(); ig.setAttribute('position', new THREE.Float32BufferAttribute(icePts, 3)); ig.setDrawRange(0, 0);
      const ice = new THREE.Points(ig, iceMat);
      pivot.add(ice); parts.push(ice);
      return { c, site, track, trackLine, rover, lander, descent, fail, ice, iceCount: 0, greyed: false };
    });
  };

  const step = (dt: number) => {
    if (!model) return;
    clock += dt;
    const sa = (clock / DAY) * Math.PI * 2;
    sun.position.copy(new THREE.Vector3(Math.cos(sa), 0.15, Math.sin(sa)).applyEuler(pivot.rotation).multiplyScalar(20));
    shadePivot.rotation.y = -sa - Math.PI / 2;
    for (const l of live) {
      const above = l.site.clone().setY(4.5);
      if (!travel(l.c, clock, above, l.site.clone().setY(0.3), l.descent, l.fail)) continue;
      l.lander.visible = true;
      l.rover.visible = true;
      const prog = l.c.kind === 'ok' ? opsProgress(clock, model.opsAt, model.opsSeconds, l.c) : 0;
      const n = Math.max(1, Math.round(prog * (l.track.length - 1)));
      l.trackLine.geometry.setDrawRange(0, l.c.kind === 'ok' ? n + 1 : 0);
      const p = l.c.kind === 'ok' ? l.track[n]! : l.site.clone().add(new THREE.Vector3(0.35, 0.05, 0));
      l.rover.position.copy(p).setY(0.1);
      // Ice: as many dots as the share of the drive done, scaled by how much of the time the plan observes.
      const ice = Math.floor(prog * ICE * Math.min(1, 0.35 + l.c.duty));
      if (ice !== l.iceCount) { l.iceCount = ice; l.ice.geometry.setDrawRange(0, ice); }
      if (l.c.kind === 'ok' && l.c.stopAt < 0.999 && clock > model.opsAt + model.opsSeconds * l.c.stopAt && !l.greyed) { l.greyed = true; l.rover.material = greyMat; }
    }
  };
  st.onStep((dt) => step(dt));

  return {
    set: (m) => { set(m); if (opts.reduceMotion) { const end = m.opsAt + m.opsSeconds + 0.5; while (clock < end) step(0.05); } st.draw(0); },
    finish: () => { if (!model) return; const end = model.opsAt + model.opsSeconds + 0.5; while (clock < end) step(0.05); st.draw(0); },
    dispose: () => { disposeGeometry(parts); for (const x of [...mats, discMat, shadeMat, landerMat, greyMat, failMat]) x.dispose(); discMat.map?.dispose(); st.dispose(); },
  };
}
