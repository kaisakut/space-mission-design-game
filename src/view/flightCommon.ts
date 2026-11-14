import * as THREE from 'three';

/** What every flight scene draws for one agency, from the engine's final run. */
export interface FlightCraft {
  color: string;
  /** Seconds after the scene starts when it lifts off. */
  launchAt: number;
  /** ok: arrived and working; dark: arrived but never worked; fail: lost on the way; stay: never launched. */
  kind: 'ok' | 'dark' | 'fail' | 'stay';
  /** Share of the operating time after which it stops (1 = kept going). */
  stopAt: number;
  /** Share of the time spent observing (driving, observing passes). */
  duty: number;
  /** A small name tag over the craft: "You" alone, each player's mark together. */
  tag?: string;
}

/** The common shape of the three flight scenes. */
export interface FlightScene<M> {
  set(m: M): void;
  /** Jump to the end: everything in its final place. */
  finish(): void;
  dispose(): void;
}

export const GREY = 0x5a6478;

/** A two-point line whose ends are moved every frame (the ascent, a link). */
export function movingLine(color: THREE.ColorRepresentation, opacity = 0.95) {
  const mat = new THREE.LineBasicMaterial({ color, transparent: true, opacity });
  const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]), mat);
  line.frustumCulled = false;
  line.visible = false;
  return {
    line, mat,
    set(a: THREE.Vector3, b: THREE.Vector3) {
      const p = line.geometry.attributes.position as THREE.BufferAttribute;
      p.setXYZ(0, a.x, a.y, a.z); p.setXYZ(1, b.x, b.y, b.z); p.needsUpdate = true;
      line.visible = true;
    },
  };
}

/**
 * The trip there, shared by the scenes: a line from `from` that reaches `to` after one second, or breaks off
 * halfway with a red mark on a failure. Returns true once the craft has arrived (never for a failure).
 */
export function travel(c: FlightCraft, clock: number, from: THREE.Vector3, to: THREE.Vector3, line: ReturnType<typeof movingLine>, failMark: THREE.Object3D): boolean {
  if (c.kind === 'stay' || clock < c.launchAt) { line.line.visible = false; return false; }
  const k = Math.min(1, clock - c.launchAt);
  if (c.kind === 'fail') {
    const end = from.clone().lerp(to, Math.min(k, 0.5));
    line.set(from, end);
    if (k >= 0.5) { failMark.position.copy(end); failMark.visible = true; }
    return false;
  }
  if (k < 1) { line.set(from, from.clone().lerp(to, k)); return false; }
  line.line.visible = false;
  return true;
}

/** How far into the operating time the scene is (0–1), held where a craft stopped. */
export const opsProgress = (clock: number, opsAt: number, opsSeconds: number, c: FlightCraft) =>
  Math.max(0, Math.min(c.stopAt < 0.999 ? c.stopAt : 1, (clock - opsAt) / opsSeconds));

/** A small text tag drawn on a canvas, always facing the viewer. */
export function labelSprite(text: string, color: string, size = 0.13): THREE.Sprite {
  const c = document.createElement('canvas');
  const ctx = c.getContext('2d')!;
  const font = '600 40px system-ui, sans-serif';
  ctx.font = font;
  const w = Math.ceil(ctx.measureText(text).width) + 28;
  c.width = w; c.height = 60;
  ctx.font = font;
  ctx.fillStyle = 'rgba(8, 12, 24, 0.8)';
  ctx.strokeStyle = color; ctx.lineWidth = 4;
  ctx.beginPath(); ctx.roundRect(2, 2, w - 4, 56, 12); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#ffffff'; ctx.textBaseline = 'middle'; ctx.fillText(text, 14, 32);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true }));
  sp.scale.set((size * w) / 60, size, 1);
  sp.renderOrder = 5;
  return sp;
}
