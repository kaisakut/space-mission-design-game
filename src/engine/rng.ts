/**
 * Seeded random numbers. The game never calls Math.random: the same seed always gives the same game,
 * which keeps forecasts reproducible and lets every agency face exactly the same random events.
 *
 * Each purpose draws from its own stream, so changing how often one purpose draws
 * (for example running more forecast runs) does not shift the numbers another purpose sees.
 *
 * Generator: xoshiro128** seeded through splitmix32; stream names are hashed with FNV-1a.
 * Ported from the author's own earlier simulator (TACTICA DSS, engine/rng.ts).
 */

export const RNG_STREAMS = ['events', 'failures', 'forecast', 'ai', 'misc'] as const;
export type RngStream = (typeof RNG_STREAMS)[number];

/** String to 32-bit unsigned integer (FNV-1a). */
export function hash32(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

function splitmix32(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x9e3779b9) >>> 0;
    let z = s;
    z = Math.imul(z ^ (z >>> 16), 0x85ebca6b);
    z = Math.imul(z ^ (z >>> 13), 0xc2b2ae35);
    return (z ^ (z >>> 16)) >>> 0;
  };
}

function rotl(x: number, k: number): number {
  return ((x << k) | (x >>> (32 - k))) >>> 0;
}

/** xoshiro128** */
export class Rng {
  private s: Uint32Array;

  constructor(seed: number, stream = '') {
    const sm = splitmix32((seed >>> 0) ^ hash32(stream));
    this.s = new Uint32Array([sm(), sm(), sm(), sm()]);
    if (this.s.every((v) => v === 0)) this.s[0] = 1;
  }

  /** 32-bit unsigned integer. */
  nextU32(): number {
    const s = this.s;
    const s0 = s[0]!, s1 = s[1]!, s2 = s[2]!, s3 = s[3]!;
    const result = Math.imul(rotl(Math.imul(s1, 5), 7), 9) >>> 0;
    const t = (s1 << 9) >>> 0;
    s[2] = s2 ^ s0;
    s[3] = s3 ^ s1;
    s[1] = s1 ^ s[2]!;
    s[0] = s0 ^ s[3]!;
    s[2] = s[2]! ^ t;
    s[3] = rotl(s[3]!, 11);
    return result;
  }

  /** [0, 1) */
  float(): number {
    return this.nextU32() / 4294967296;
  }

  /** Integer in [0, n). */
  int(n: number): number {
    return Math.floor(this.float() * n);
  }

  /** true with probability p. */
  chance(p: number): boolean {
    return this.float() < p;
  }

  /** [min, max) */
  range(min: number, max: number): number {
    return min + (max - min) * this.float();
  }

  /** Normal distribution (Box-Muller), for spreading part performance around its nominal value. */
  normal(mean = 0, sd = 1): number {
    const u = 1 - this.float();
    const v = this.float();
    return mean + sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }

  /** Save and restore the state (for snapshots and replaying a decision). */
  getState(): number[] {
    return Array.from(this.s);
  }
  setState(state: number[]): void {
    this.s = new Uint32Array(state);
  }
}

/** One stream per purpose. */
export class RngSet {
  readonly streams: Record<RngStream, Rng>;
  constructor(readonly seed: number) {
    this.streams = Object.fromEntries(RNG_STREAMS.map((n) => [n, new Rng(seed, n)])) as Record<RngStream, Rng>;
  }
  get(stream: RngStream): Rng {
    return this.streams[stream];
  }
  getState(): Record<RngStream, number[]> {
    return Object.fromEntries(RNG_STREAMS.map((n) => [n, this.streams[n].getState()])) as Record<RngStream, number[]>;
  }
}
