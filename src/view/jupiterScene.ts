import * as THREE from 'three';
import { createStage, disposeGeometry, paintedTexture, seeded, type MissionScene } from './stage';

/**
 * Jupiter system, drawn for explanation and not to scale: Jupiter, its radiation belts as glowing rings,
 * the orbits of Europa and Ganymede, and the spacecraft's path. Built from the design state only.
 */
export interface JupiterModel {
  kind: 'jupiter';
  path: 'flybys' | 'europaOrbit' | 'ganymede';
  /** 0 thin vault, 1 standard, 2 thick with spot shields. */
  shield: number;
  /** Science instruments on board: lines reach out to Europa during a close pass. */
  instruments: number;
  /** Solar array size, relative (0 = none). */
  wing: number;
  /** Carries radioisotope generators. */
  rtg: boolean;
  /** Sum of radio rates (MB/min): the thickness of the line towards Earth. */
  linkMBPerMin: number;
  /** Share of close passes that are observed. */
  duty: number;
}

const EUROPA_R = 3.0, GANYMEDE_R = 4.7;
const PERIOD = 9; // seconds per flyby loop at normal speed
// Radiation strength by distance from Jupiter: strongest in the belts around Europa's orbit.
const belt = (r: number) => Math.exp(-(((r - 2.8) / 1.1) ** 2));
const SHIELD_RATE = [1.7, 1, 0.55];

export function jupiterTexture() {
  const rnd = seeded(11);
  return paintedTexture(512, 256, (ctx) => {
    // Strong light zones and dark belts, so it reads as Jupiter (and not as Saturn).
    const bands = ['#f2e6cf', '#9a6a44', '#efe2c8', '#8a5a38', '#e8d8bb', '#a87650', '#f0e4cc', '#7f5233', '#eadcc2'];
    let y = 0;
    while (y < 256) {
      const h = 10 + rnd() * 26;
      ctx.fillStyle = bands[Math.floor(rnd() * bands.length)]!;
      ctx.fillRect(0, y, 512, h + 1);
      y += h;
    }
    ctx.globalAlpha = 0.25;
    for (let k = 0; k < 160; k++) { ctx.fillStyle = rnd() > 0.5 ? '#fff6e0' : '#7a5236'; ctx.fillRect(rnd() * 512, rnd() * 256, 20 + rnd() * 60, 2); }
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#b5583a';
    ctx.beginPath(); ctx.ellipse(330, 165, 38, 17, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#e9b89a'; ctx.lineWidth = 3; ctx.stroke();
  });
}

export function ellipsePoints(peri: number, apo: number, n = 160): THREE.Vector3[] {
  const a = (peri + apo) / 2, e = (apo - peri) / (apo + peri);
  const pts: THREE.Vector3[] = [];
  for (let k = 0; k <= n; k++) {
    const nu = (k / n) * Math.PI * 2;
    const r = (a * (1 - e * e)) / (1 + e * Math.cos(nu));
    pts.push(new THREE.Vector3(r * Math.cos(nu), 0, r * Math.sin(nu)));
  }
  return pts;
}

/** Position on the flyby ellipse at time phase 0–1, moving faster near Jupiter (Kepler's equation). */
export function flybyPos(phase: number, peri: number, apo: number): THREE.Vector3 {
  const a = (peri + apo) / 2, e = (apo - peri) / (apo + peri);
  const M = phase * Math.PI * 2;
  let E = M;
  for (let k = 0; k < 6; k++) E = E - (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E));
  const x = a * (Math.cos(E) - e), z = a * Math.sqrt(1 - e * e) * Math.sin(E);
  return new THREE.Vector3(x, 0, z);
}

export function createJupiterScene(host: HTMLElement, opts: { reduceMotion: boolean }): MissionScene<JupiterModel> {
  const st = createStage(host, { reduceMotion: opts.reduceMotion, dist: 19, tilt: 0.38 });
  const { scene, pivot } = st;
  scene.add(new THREE.AmbientLight(0x8090b0, 0.5));
  const sun = new THREE.DirectionalLight(0xffffff, 1.4);
  sun.position.set(-10, 2, 4);
  scene.add(sun);

  const mats = {
    jupiter: new THREE.MeshPhongMaterial({ map: jupiterTexture(), shininess: 4 }),
    belt: [0.16, 0.08, 0.04].map((o) => new THREE.MeshBasicMaterial({ color: 0xc58cff, transparent: true, opacity: o, depthWrite: false, blending: THREE.AdditiveBlending })),
    moonOrbit: new THREE.LineBasicMaterial({ color: 0x5a6b8f, transparent: true, opacity: 0.7 }),
    europa: new THREE.MeshPhongMaterial({ color: 0xd8cbb0 }),
    ganymede: new THREE.MeshPhongMaterial({ color: 0x9c8f7c }),
    path: new THREE.LineBasicMaterial({ color: 0x9fd8ff, transparent: true, opacity: 0.85 }),
    ghostPath: new THREE.LineDashedMaterial({ color: 0x9fd8ff, transparent: true, opacity: 0.4, dashSize: 0.25, gapSize: 0.2 }),
    body: new THREE.MeshStandardMaterial({ color: 0xe8ecf4, metalness: 0.3, roughness: 0.5 }),
    wing: new THREE.MeshStandardMaterial({ color: 0x2f6fde, side: THREE.DoubleSide, metalness: 0.4, roughness: 0.4 }),
    rtg: new THREE.MeshBasicMaterial({ color: 0xff8a3d }),
    shell: new THREE.MeshBasicMaterial({ color: 0xffb74d, transparent: true, opacity: 0.35, wireframe: true }),
    beam: new THREE.LineBasicMaterial({ color: 0xffd27f, transparent: true, opacity: 0.9 }),
    link: new THREE.MeshBasicMaterial({ color: 0x7fd1ff, transparent: true, opacity: 0.6 }),
    sunDot: new THREE.MeshBasicMaterial({ color: 0xfff2c0 }),
    stars: new THREE.PointsMaterial({ color: 0x8c9ab8, size: 0.12, transparent: true, opacity: 0.6 }),
  };

  {
    const rnd = seeded(5), pts: number[] = [];
    for (let k = 0; k < 300; k++) { const v = new THREE.Vector3(rnd() - 0.5, rnd() - 0.5, rnd() - 0.5).normalize().multiplyScalar(60); pts.push(v.x, v.y, v.z); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    scene.add(new THREE.Points(g, mats.stars));
  }

  pivot.add(new THREE.Mesh(new THREE.SphereGeometry(1, 40, 24), mats.jupiter));
  // Belts: three nested, thick glowing doughnuts, brightest on the inside (not flat rings, so not Saturn).
  [[2.9, 0.55], [2.95, 0.95], [3.05, 1.4]].forEach(([r, tube], k) => {
    const t = new THREE.Mesh(new THREE.TorusGeometry(r!, tube!, 16, 64), mats.belt[k]!);
    t.rotation.x = Math.PI / 2;
    pivot.add(t);
  });
  for (const r of [EUROPA_R, GANYMEDE_R]) pivot.add(new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(ellipsePoints(r, r, 96)), mats.moonOrbit));
  const europa = new THREE.Mesh(new THREE.SphereGeometry(0.2, 20, 12), mats.europa);
  const ganymede = new THREE.Mesh(new THREE.SphereGeometry(0.26, 20, 12), mats.ganymede);
  pivot.add(europa, ganymede);
  // The Sun is far and small: a dot at the edge of the view.
  const sunDot = new THREE.Mesh(new THREE.SphereGeometry(0.18, 12, 8), mats.sunDot);
  sunDot.position.set(-11, 1.5, 4);
  pivot.add(sunDot);
  const EARTH_DIR = new THREE.Vector3(-11, 1.3, 4.6).normalize();

  let model: JupiterModel | null = null;
  let parts: THREE.Object3D[] = [];
  let craft: THREE.Group | null = null;
  let beams: THREE.LineSegments | null = null;
  const link = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 1, 6, 1, true), mats.link);
  pivot.add(link);
  let lastKey = '';
  let t = 0, dose = 0;
  let meterCb: ((l: number, o: boolean) => void) | null = null;

  const pathLine = (m: JupiterModel, ghost: boolean) => {
    const pts = m.path === 'flybys' ? ellipsePoints(2.85, 7.6) : m.path === 'europaOrbit' ? ellipsePoints(EUROPA_R, EUROPA_R, 96) : ellipsePoints(GANYMEDE_R, GANYMEDE_R, 96);
    const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), ghost ? mats.ghostPath : mats.path);
    if (ghost) line.computeLineDistances();
    line.position.y = ghost ? 0.03 : 0;
    return line;
  };

  const set = (m: JupiterModel, ghost: JupiterModel | null) => {
    const key = JSON.stringify([m, ghost]);
    if (key === lastKey) return;
    lastKey = key;
    model = m;
    disposeGeometry(parts);
    parts = [];
    const p = pathLine(m, false);
    pivot.add(p); parts.push(p);
    if (ghost && ghost.path !== m.path) { const g = pathLine(ghost, true); pivot.add(g); parts.push(g); }
    craft = new THREE.Group();
    craft.add(new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.16, 0.22), mats.body));
    if (m.wing > 0) for (const s of [-1, 1]) {
      const w = new THREE.Mesh(new THREE.PlaneGeometry(0.5 * m.wing, 0.14), mats.wing);
      w.position.x = s * (0.1 + 0.25 * m.wing);
      w.rotation.x = Math.PI / 2;
      craft.add(w);
    }
    if (m.rtg) for (const s of [-1, 1]) { const r = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.18, 8), mats.rtg); r.position.set(0, -0.05, s * 0.18); r.rotation.x = Math.PI / 2; craft.add(r); }
    // The vault: a shell around the spacecraft, larger and denser when thicker.
    const shell = new THREE.Mesh(new THREE.IcosahedronGeometry(0.2 + 0.05 * m.shield, m.shield + 1), mats.shell);
    craft.add(shell);
    pivot.add(craft); parts.push(craft);
    const bg = new THREE.BufferGeometry();
    bg.setAttribute('position', new THREE.Float32BufferAttribute(new Array(Math.max(1, m.instruments) * 6).fill(0), 3));
    beams = new THREE.LineSegments(bg, mats.beam);
    pivot.add(beams); parts.push(beams);
    if (ghost && ghost.shield !== m.shield) dose *= SHIELD_RATE[ghost.shield]! / SHIELD_RATE[m.shield]!;
    st.draw(0);
  };

  st.onStep((dt, fast) => {
    if (!model || !craft || !beams) return;
    t += dt * (fast ? 6 : 1);
    const phase = (t / PERIOD) % 1;
    // Europa goes round once per flyby loop, so it is at the ellipse's closest point each time the spacecraft is.
    const eAng = (t / PERIOD) * Math.PI * 2;
    europa.position.set(EUROPA_R * Math.cos(eAng), 0, EUROPA_R * Math.sin(eAng));
    const gAng = (t / (PERIOD * 2)) * Math.PI * 2 + 2;
    ganymede.position.set(GANYMEDE_R * Math.cos(gAng), 0, GANYMEDE_R * Math.sin(gAng));
    let pos: THREE.Vector3;
    let target = europa.position;
    if (model.path === 'flybys') {
      pos = flybyPos(phase, 2.85, 7.6);
    } else if (model.path === 'europaOrbit') {
      const a = t * 2.4;
      pos = europa.position.clone().add(new THREE.Vector3(0.42 * Math.cos(a), 0.1 * Math.sin(a), 0.42 * Math.sin(a)));
    } else {
      const a = t * 2;
      pos = ganymede.position.clone().add(new THREE.Vector3(0.5 * Math.cos(a), 0.1 * Math.sin(a), 0.5 * Math.sin(a)));
      target = ganymede.position;
    }
    craft.position.copy(pos);
    craft.lookAt(0, 0, 0);
    // Instruments point at the moon during a close, observed pass.
    const near = pos.distanceTo(target) < (model.path === 'flybys' ? 1.2 : 0.9);
    const observing = near && ((model.path === 'flybys' ? Math.floor(t / PERIOD) : Math.floor(t / 1.5)) * 0.618) % 1 < model.duty;
    const arr = beams.geometry.attributes.position as THREE.BufferAttribute;
    for (let k = 0; k < model.instruments; k++) {
      const off = (k - (model.instruments - 1) / 2) * 0.06;
      arr.setXYZ(k * 2, pos.x, pos.y + off, pos.z);
      arr.setXYZ(k * 2 + 1, target.x, target.y + off * 2, target.z);
    }
    arr.needsUpdate = true;
    beams.visible = observing;
    // Link towards Earth: thicker with a faster radio.
    const far = pos.clone().add(EARTH_DIR.clone().multiplyScalar(4));
    link.position.copy(pos.clone().add(far).multiplyScalar(0.5));
    const w = 0.012 + 0.012 * Math.log10(1 + model.linkMBPerMin);
    link.scale.set(w, 4, w);
    link.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), EARTH_DIR);
    // Radiation meter: fills inside the belts, slower behind a thicker vault, and eases off outside them.
    const rate = belt(pos.length()) * SHIELD_RATE[model.shield]!;
    const sdt = dt * (fast ? 6 : 1);
    dose += (rate * 0.5 - dose * 0.35) * sdt;
    dose = Math.max(0, Math.min(1, dose));
    meterCb?.(dose, dose > 0.75);
  });

  return {
    set,
    setFast: st.setFast,
    onMeter: (cb) => { meterCb = cb; },
    dispose: () => { st.dispose(); disposeGeometry(parts); Object.values(mats).flat().forEach((x) => { (x as THREE.Material).dispose(); }); mats.jupiter.map?.dispose(); },
  };
}
