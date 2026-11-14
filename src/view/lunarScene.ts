import * as THREE from 'three';
import { createStage, disposeGeometry, paintedTexture, seeded, textSprite, type MissionScene } from './stage';

/**
 * The Moon's south pole as a cratered disc seen from above at a slant, drawn for explanation: the Sun circles
 * low on the horizon and the shadow turns with it, Earth rises and sets at the edge, and the rover works at
 * its landing site. Built from the design state only; whether the rover survives is the engine's call.
 */
export interface LunarModel {
  kind: 'moon';
  site: { x: number; y: number; sun: number; earth: number };
  /** The landing site's name, shown beside its marker. */
  siteName?: string;
  crater: { x: number; y: number; r: number };
  /** Science instruments on board (small marks on the rover); the drill makes it stop and dig. */
  instruments: number;
  drill: boolean;
  /** Power margin 0–1: a bigger margin drains the battery more slowly in shadow. */
  powerMargin: number;
  /** Keeps warm through the night (radioisotope heaters). */
  nightSurvival: boolean;
  /** Sum of radio rates (MB/min): the thickness of the line to Earth. */
  linkMBPerMin: number;
  /** Share of the time spent driving and drilling: the length of the drive. */
  duty: number;
}

const R = 4; // disc radius
const DAY = 12; // seconds per lunar day at normal speed

function poleTexture(crater: LunarModel['crater']) {
  const rnd = seeded(23);
  return paintedTexture(512, 512, (ctx) => {
    const g = ctx.createRadialGradient(256, 256, 20, 256, 256, 256);
    g.addColorStop(0, '#b3aea2'); g.addColorStop(1, '#8f8a7f');
    ctx.fillStyle = g; ctx.fillRect(0, 0, 512, 512);
    for (let k = 0; k < 150; k++) {
      const x = rnd() * 512, y = rnd() * 512, r = 2 + rnd() ** 4 * 30;
      ctx.fillStyle = 'rgba(30, 28, 26, 0.35)';
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = 'rgba(200, 196, 186, 0.35)'; ctx.lineWidth = Math.max(1, r * 0.15);
      ctx.beginPath(); ctx.arc(x - r * 0.1, y - r * 0.1, r, Math.PI * 0.9, Math.PI * 1.9); ctx.stroke();
    }
    // The permanently shadowed crater: always dark.
    const cx = 256 + crater.x * 256, cy = 256 + crater.y * 256, cr = crater.r * 256;
    ctx.fillStyle = '#111316'; ctx.beginPath(); ctx.arc(cx, cy, cr, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#9a968c'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(cx, cy, cr, 0, Math.PI * 2); ctx.stroke();
  });
}

export function createLunarScene(host: HTMLElement, opts: { reduceMotion: boolean }): MissionScene<LunarModel> {
  const st = createStage(host, { reduceMotion: opts.reduceMotion, dist: 13.5, tilt: 0.85 });
  const { scene, pivot } = st;
  scene.add(new THREE.AmbientLight(0x8090b0, 0.75));
  const sun = new THREE.DirectionalLight(0xffffff, 1.5);
  scene.add(sun);

  const mats = {
    disc: new THREE.MeshPhongMaterial({ color: 0xffffff, shininess: 2 }),
    shade: new THREE.MeshBasicMaterial({ color: 0x05060a, transparent: true, opacity: 0.6, depthWrite: false }),
    rover: new THREE.MeshStandardMaterial({ color: 0xe8ecf4, metalness: 0.2, roughness: 0.6 }),
    roverDark: new THREE.MeshStandardMaterial({ color: 0x3a4152, metalness: 0.2, roughness: 0.6 }),
    mark: new THREE.MeshBasicMaterial({ color: 0xffd27f }),
    ghost: new THREE.MeshBasicMaterial({ color: 0xffb74d, transparent: true, opacity: 0.45 }),
    ring: new THREE.LineBasicMaterial({ color: 0xffb74d }),
    track: new THREE.LineBasicMaterial({ color: 0x9fd8ff, transparent: true, opacity: 0.8 }),
    earth: new THREE.MeshPhongMaterial({ color: 0x3f7fd8, emissive: 0x10264a }),
    earthDown: new THREE.MeshPhongMaterial({ color: 0x24354f, emissive: 0x05080f }),
    sunDot: new THREE.MeshBasicMaterial({ color: 0xfff2c0 }),
    link: new THREE.MeshBasicMaterial({ color: 0x7fd1ff, transparent: true, opacity: 0.7 }),
    stars: new THREE.PointsMaterial({ color: 0x8c9ab8, size: 0.08, transparent: true, opacity: 0.6 }),
  };
  {
    const rnd = seeded(3), pts: number[] = [];
    for (let k = 0; k < 300; k++) { const v = new THREE.Vector3(rnd() - 0.5, rnd() - 0.5, rnd() - 0.5).normalize().multiplyScalar(40); pts.push(v.x, v.y, v.z); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    scene.add(new THREE.Points(g, mats.stars));
  }

  // The disc lies in the XZ plane: map x → x, y → z.
  const onDisc = (x: number, y: number, h = 0) => new THREE.Vector3(x * R, h, y * R);
  const disc = new THREE.Mesh(new THREE.CircleGeometry(R, 64), mats.disc);
  disc.rotation.x = -Math.PI / 2;
  pivot.add(disc);
  // The night side: half the disc in shadow, turning with the Sun.
  const shade = new THREE.Mesh(new THREE.CircleGeometry(R * 1.001, 48, 0, Math.PI), mats.shade);
  shade.rotation.x = -Math.PI / 2;
  shade.position.y = 0.01;
  const shadePivot = new THREE.Group();
  shadePivot.add(shade);
  pivot.add(shadePivot);
  const sunDot = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 8), mats.sunDot);
  const earth = new THREE.Mesh(new THREE.SphereGeometry(0.3, 16, 12), mats.earth);
  pivot.add(sunDot, earth);
  const link = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 1, 6, 1, true), mats.link);
  pivot.add(link);

  let model: LunarModel | null = null;
  let parts: THREE.Object3D[] = [];
  let rover: THREE.Group | null = null;
  let track: THREE.Vector3[] = [];
  let texKey = '';
  let lastKey = '';
  let t = 0, battery = 1;
  let meterCb: ((l: number, o: boolean) => void) | null = null;

  const set = (m: LunarModel, ghost: LunarModel | null) => {
    const key = JSON.stringify([m, ghost]);
    if (key === lastKey) return;
    lastKey = key;
    model = m;
    const tk = JSON.stringify(m.crater);
    if (tk !== texKey) { mats.disc.map?.dispose(); mats.disc.map = poleTexture(m.crater); mats.disc.needsUpdate = true; texKey = tk; }
    disposeGeometry(parts);
    parts = [];
    const site = onDisc(m.site.x, m.site.y);
    const ring = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(Array.from({ length: 40 }, (_, k) => site.clone().add(new THREE.Vector3(0.35 * Math.cos((k / 40) * Math.PI * 2), 0.02, 0.35 * Math.sin((k / 40) * Math.PI * 2))))), mats.ring);
    pivot.add(ring); parts.push(ring);
    // A tall marker and the site's name, so the landing site stands out.
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.6, 6), mats.mark);
    pole.position.copy(site).setY(0.3);
    pivot.add(pole); parts.push(pole);
    if (m.siteName) { const tag = textSprite(m.siteName); tag.position.copy(site).setY(0.85); pivot.add(tag); parts.push(tag); }
    if (ghost && (ghost.site.x !== m.site.x || ghost.site.y !== m.site.y)) {
      const g = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.05, 16), mats.ghost);
      g.position.copy(onDisc(ghost.site.x, ghost.site.y, 0.03));
      pivot.add(g); parts.push(g);
    }
    // The drive: a loop from the landing site, longer with a busier plan; towards the cold crater when it is near.
    const toCrater = new THREE.Vector3(m.crater.x - m.site.x, 0, m.crater.y - m.site.y).normalize();
    const len = 0.4 + 1.6 * m.duty;
    track = Array.from({ length: 60 }, (_, k) => {
      const u = k / 59;
      const a = u * Math.PI * 2;
      return site.clone().add(toCrater.clone().multiplyScalar(Math.sin(a / 2) * len)).add(new THREE.Vector3(-toCrater.z, 0, toCrater.x).multiplyScalar(Math.sin(a) * len * 0.35)).setY(0.04);
    });
    const tl = new THREE.Line(new THREE.BufferGeometry().setFromPoints(track), mats.track);
    pivot.add(tl); parts.push(tl);
    rover = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.12, 0.2), mats.rover);
    body.name = 'body';
    body.position.y = 0.1;
    rover.add(body);
    for (let k = 0; k < m.instruments; k++) { const d = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 6), mats.mark); d.position.set(-0.09 + k * 0.06, 0.2, 0); rover.add(d); }
    if (m.drill) { const dr = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.22, 6), mats.mark); dr.name = 'drill'; dr.position.set(0.16, 0.05, 0); rover.add(dr); }
    pivot.add(rover); parts.push(rover);
    st.draw(0);
  };

  st.onStep((dt, fast) => {
    if (!model || !rover) return;
    const sdt = dt * (fast ? 5 : 1);
    t += sdt;
    // The Sun circles just above the horizon; its far side of the disc is in shadow.
    const sa = (t / DAY) * Math.PI * 2;
    const sunDir = new THREE.Vector3(Math.cos(sa), 0.09, Math.sin(sa)).normalize();
    sun.position.copy(sunDir.clone().applyEuler(pivot.rotation).multiplyScalar(20));
    sunDot.position.copy(new THREE.Vector3(Math.cos(sa) * (R + 1.2), 0.5, Math.sin(sa) * (R + 1.2)));
    shadePivot.rotation.y = -sa - Math.PI / 2;
    // Each site is lit for its own share of the day: high ridges longer, the crater rim least.
    const dayPhase = ((t / DAY) % 1 + 1) % 1;
    const lit = dayPhase < model.site.sun;
    // Earth rocks above and below the horizon (libration); it is in view for the site's share of the time.
    const ea = (t / (DAY * 1.3)) * Math.PI * 2;
    const earthUp = Math.sin(ea) > Math.cos(Math.PI * model.site.earth);
    earth.position.set(-(R + 0.5), earthUp ? 0.7 : -0.4, -1.2);
    // Below the horizon Earth stays as a dim marker at the edge: its direction is always shown.
    earth.material = earthUp ? mats.earth : mats.earthDown;
    // Rover along its drive; it stops to dig when it carries the drill.
    const k = (t * (0.3 + model.duty)) % track.length;
    const p = track[Math.floor(k)]!;
    rover.position.copy(p);
    const drill = rover.getObjectByName('drill');
    if (drill) drill.position.y = 0.05 - 0.05 * Math.max(0, Math.sin(t * 4));
    // Battery: charges in sunlight, drains in shadow; heaters keep the night from draining it to nothing.
    const drain = 0.12 * (1.4 - model.powerMargin) * (model.nightSurvival ? 0.45 : 1);
    battery += (lit ? 0.25 : -drain) * sdt * 0.5;
    battery = Math.max(model.nightSurvival ? 0.2 : 0, Math.min(1, battery));
    (rover.getObjectByName('body') as THREE.Mesh).material = battery <= 0.02 ? mats.roverDark : mats.rover;
    // Link to Earth only while Earth is above the horizon.
    if (earthUp) {
      const a = p.clone().setY(0.25), b = earth.position.clone();
      link.position.copy(a.clone().add(b).multiplyScalar(0.5));
      const w = 0.01 + 0.012 * Math.log10(1 + model.linkMBPerMin * 10);
      link.scale.set(w, a.distanceTo(b), w);
      link.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
    }
    link.visible = earthUp;
    meterCb?.(battery, battery < 0.15);
  });

  return {
    set,
    setFast: st.setFast,
    onMeter: (cb) => { meterCb = cb; },
    dispose: () => { st.dispose(); disposeGeometry(parts); mats.disc.map?.dispose(); Object.values(mats).forEach((x) => x.dispose()); },
  };
}
