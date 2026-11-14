import * as THREE from 'three';

/** What every mission scene offers to the mission view. */
export interface MissionScene<M> {
  set(model: M, ghost: M | null): void;
  setFast(on: boolean): void;
  dispose(): void;
  /** Meter 0–1 and whether it is in the red, for the HTML overlay. */
  onMeter(cb: (level: number, over: boolean) => void): void;
}

/**
 * The shared plumbing of a scene: renderer, camera on a pivot the player can turn and zoom, resize,
 * about 30 frames a second (every frame while fast-forwarding), and nothing drawn while off screen.
 */
export function createStage(host: HTMLElement, opts: { reduceMotion: boolean; dist: number; tilt: number; fov?: number }) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
  host.appendChild(renderer.domElement);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(opts.fov ?? 35, 1, 0.1, 200);
  const pivot = new THREE.Group();
  pivot.rotation.set(opts.tilt, 0, 0);
  scene.add(pivot);
  let dist = opts.dist;
  let fast = false;
  let step: (dt: number, fast: boolean) => void = () => {};

  const draw = (dt: number) => {
    step(dt, fast);
    camera.position.set(0, 0, dist);
    camera.lookAt(0, 0, 0);
    renderer.render(scene, camera);
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
    draw(0);
  };
  const ro = new ResizeObserver(resize);
  ro.observe(host);

  let drag: { x: number; y: number } | null = null;
  const el = renderer.domElement;
  el.style.touchAction = 'none';
  el.addEventListener('pointerdown', (e) => { drag = { x: e.clientX, y: e.clientY }; el.setPointerCapture(e.pointerId); });
  el.addEventListener('pointermove', (e) => { if (!drag) return; pivot.rotation.y += (e.clientX - drag.x) * 0.008; pivot.rotation.x = Math.max(-1.4, Math.min(1.4, pivot.rotation.x + (e.clientY - drag.y) * 0.008)); drag = { x: e.clientX, y: e.clientY }; draw(0); });
  el.addEventListener('pointerup', () => { drag = null; });
  el.addEventListener('wheel', (e) => { e.preventDefault(); dist = Math.max(opts.dist * 0.45, Math.min(opts.dist * 1.6, dist * (e.deltaY > 0 ? 1.08 : 0.93))); draw(0); }, { passive: false });

  let visible = true;
  const io = new IntersectionObserver((es) => { visible = es.some((x) => x.isIntersecting); });
  io.observe(host);

  let raf = 0, last = performance.now();
  const loop = (now: number) => {
    const dt = Math.min(0.1, (now - last) / 1000);
    if (visible && !document.hidden && !opts.reduceMotion && (fast || dt >= 1 / 32)) { last = now; draw(dt); }
    raf = requestAnimationFrame(loop);
  };
  raf = requestAnimationFrame(loop);

  return {
    scene, pivot, camera,
    onStep: (f: (dt: number, fast: boolean) => void) => { step = f; resize(); },
    draw,
    setFast: (on: boolean) => { fast = on; if (opts.reduceMotion && on) { for (let k = 0; k < 200; k++) step(0.05, true); draw(0); } },
    dispose: () => { cancelAnimationFrame(raf); ro.disconnect(); io.disconnect(); renderer.dispose(); renderer.forceContextLoss(); el.remove(); },
  };
}

/** Dispose the geometry of objects removed from the scene (materials are shared and kept). */
export function disposeGeometry(objs: THREE.Object3D[]) {
  for (const p of objs) { p.parent?.remove(p); p.traverse((o) => { (o as THREE.Mesh).geometry?.dispose?.(); const sp = o as THREE.Sprite; if (sp.isSprite) { sp.material.map?.dispose(); sp.material.dispose(); } }); }
}

/** A canvas texture drawn once by a function (planet bands, a cratered disc). */
export function paintedTexture(w: number, h: number, paint: (ctx: CanvasRenderingContext2D) => void) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  paint(c.getContext('2d')!);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** A small text label that always faces the viewer. */
export function textSprite(text: string, color = '#ffe2a8', scale = 1): THREE.Sprite {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 64;
  const ctx = c.getContext('2d')!;
  ctx.font = '600 34px system-ui, sans-serif';
  ctx.fillStyle = color;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.shadowColor = '#000'; ctx.shadowBlur = 6;
  const short = text.replace(/\s*[（(].*$/, '');
  ctx.fillText(short.length > 26 ? `${short.slice(0, 25)}…` : short, 256, 32, 500);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
  s.scale.set(2.4 * scale, 0.3 * scale, 1);
  return s;
}

/** Small deterministic random numbers for the painted textures. */
export function seeded(seed: number) {
  let s = seed;
  return () => ((s = (s * 16807) % 2147483647) / 2147483647);
}
