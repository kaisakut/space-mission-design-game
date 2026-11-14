/**
 * Short sound effects synthesised with the Web Audio API (oscillators and noise; no audio files).
 * Dry, low, control-room style; no music. One master volume. Sounds start after the first user gesture.
 */
export type Sfx =
  | 'select' | 'warn' | 'block' | 'forecastRun' | 'forecastUp' | 'forecastDown' | 'confirm' | 'cardFlip'
  | 'markGood' | 'markPartial' | 'markBad' | 'launch' | 'launchFail' | 'contact' | 'noContact' | 'tick'
  | 'storm' | 'barRise' | 'rank' | 'rankFirst' | 'ui';

const KEY = 'uiSound';
const MASTER = 0.18;
let enabled = (() => { try { return localStorage.getItem(KEY) !== 'off'; } catch { return true; } })();
let ctx: AudioContext | null = null;
let master: GainNode | null = null;
const live = new Set<AudioScheduledSourceNode>();
const lastPlayed = new Map<Sfx, number>();

export const soundEnabled = () => enabled;
export function setSoundEnabled(on: boolean) {
  enabled = on;
  try { localStorage.setItem(KEY, on ? 'on' : 'off'); } catch { /* storage unavailable */ }
  if (!on) stopAll();
}

function audio(): { c: AudioContext; out: GainNode } | null {
  if (!enabled || typeof window === 'undefined') return null;
  try {
    if (!ctx) {
      const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = MASTER;
      master.connect(ctx.destination);
    }
    if (ctx.state === 'suspended') void ctx.resume();
    return { c: ctx, out: master! };
  } catch { return null; }
}

function track<T extends AudioScheduledSourceNode>(n: T): T {
  live.add(n);
  n.onended = () => live.delete(n);
  return n;
}

/** A tone with a quick attack and an exponential decay. */
function tone(freq: number, start: number, dur: number, opts: { type?: OscillatorType; gain?: number; to?: number } = {}) {
  const a = audio(); if (!a) return;
  const { c, out } = a;
  const t0 = c.currentTime + start;
  const o = track(c.createOscillator());
  const g = c.createGain();
  o.type = opts.type ?? 'sine';
  o.frequency.setValueAtTime(freq, t0);
  if (opts.to) o.frequency.exponentialRampToValueAtTime(opts.to, t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(opts.gain ?? 0.6, t0 + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g).connect(out);
  o.start(t0); o.stop(t0 + dur + 0.02);
}

/** Filtered noise: swish, rumble, static. */
function noise(start: number, dur: number, opts: { freq?: number; q?: number; gain?: number; rise?: boolean; type?: BiquadFilterType } = {}) {
  const a = audio(); if (!a) return;
  const { c, out } = a;
  const t0 = c.currentTime + start;
  const len = Math.max(1, Math.floor(c.sampleRate * dur));
  const buf = c.createBuffer(1, len, c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  const s = track(c.createBufferSource());
  s.buffer = buf;
  const f = c.createBiquadFilter();
  f.type = opts.type ?? 'bandpass';
  f.frequency.value = opts.freq ?? 1200;
  f.Q.value = opts.q ?? 1;
  const g = c.createGain();
  const peak = opts.gain ?? 0.5;
  g.gain.setValueAtTime(opts.rise ? 0.0001 : peak, t0);
  if (opts.rise) g.gain.exponentialRampToValueAtTime(peak, t0 + dur * 0.7);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  s.connect(f).connect(g).connect(out);
  s.start(t0); s.stop(t0 + dur + 0.02);
}

/** Small pitch steps for sounds that repeat in a row (for example four result marks). */
let step = 0;
const nudge = () => 1 + ((step++ % 4) * 0.06);

const SOUNDS: Record<Sfx, () => void> = {
  select: () => tone(660, 0, 0.05, { type: 'triangle', gain: 0.35 }),
  ui: () => tone(520, 0, 0.03, { type: 'triangle', gain: 0.18 }),
  warn: () => tone(220, 0, 0.15, { type: 'triangle', gain: 0.5 }),
  block: () => { tone(150, 0, 0.1, { type: 'square', gain: 0.25 }); tone(150, 0.13, 0.1, { type: 'square', gain: 0.25 }); },
  forecastRun: () => { for (let k = 0; k < 24; k++) tone(300 + k * 28, k * 0.048, 0.04, { type: 'triangle', gain: 0.12 }); },
  forecastUp: () => { tone(523, 0, 0.4, { gain: 0.3 }); tone(659, 0.02, 0.38, { gain: 0.25 }); tone(784, 0.04, 0.36, { gain: 0.22 }); },
  forecastDown: () => tone(196, 0, 0.4, { type: 'triangle', gain: 0.4 }),
  confirm: () => { tone(1200, 0, 0.03, { type: 'square', gain: 0.15 }); tone(110, 0.02, 0.3, { gain: 0.5 }); },
  cardFlip: () => noise(0, 0.2, { freq: 2500, q: 0.8, gain: 0.35 }),
  markGood: () => tone(988 * nudge(), 0, 0.15, { gain: 0.35 }),
  markPartial: () => tone(587 * nudge(), 0, 0.15, { type: 'triangle', gain: 0.35 }),
  markBad: () => tone(165 * nudge(), 0, 0.18, { type: 'sawtooth', gain: 0.18 }),
  launch: () => { noise(0, 1.2, { freq: 120, q: 0.6, gain: 0.7, rise: true, type: 'lowpass' }); tone(55, 0, 1.2, { gain: 0.3, to: 40 }); },
  launchFail: () => noise(0, 0.5, { freq: 160, q: 0.6, gain: 0.6, type: 'lowpass' }),
  contact: () => { tone(1320, 0, 0.08, { gain: 0.25 }); tone(1320, 0.18, 0.08, { gain: 0.25 }); noise(0, 0.6, { freq: 3000, q: 0.5, gain: 0.04 }); },
  noContact: () => noise(0, 0.6, { freq: 3000, q: 0.5, gain: 0.12 }),
  tick: () => tone(1800, 0, 0.03, { type: 'square', gain: 0.05 }),
  storm: () => noise(0, 0.8, { freq: 900, q: 0.4, gain: 0.35, rise: true }),
  barRise: () => tone(330 * nudge(), 0, 0.5, { type: 'triangle', gain: 0.18, to: 660 * nudge() }),
  rank: () => tone(440, 0, 0.25, { gain: 0.3 }),
  rankFirst: () => { tone(523, 0, 0.6, { gain: 0.25 }); tone(659, 0.08, 0.52, { gain: 0.22 }); tone(784, 0.16, 0.44, { gain: 0.2 }); },
};

/** Plays a sound by name. The same sound is not restarted within 60 ms, so fast clicks do not pile up. */
export function play(name: Sfx, delaySec = 0) {
  if (!enabled) return;
  const fire = () => {
    const now = performance.now();
    if (now - (lastPlayed.get(name) ?? -1e9) < 60) return;
    lastPlayed.set(name, now);
    SOUNDS[name]();
  };
  if (delaySec > 0) { const id = window.setTimeout(fire, delaySec * 1000); timers.add(id); } else fire();
}

const timers = new Set<number>();
/** Stops every sound now playing or scheduled (used when a scene is skipped or sound is turned off). */
export function stopAll() {
  for (const id of timers) clearTimeout(id);
  timers.clear();
  for (const n of live) { try { n.stop(); } catch { /* already stopped */ } }
  live.clear();
}
