import type { Condition, DecisionSlot, EventCard, Option, Sourced } from '../data/types';
import type { IconName } from './icons';

/** The icon an option shows: its own, or one from its kind. */
export function optionIcon(o: Option): IconName {
  if (o.icon) return o.icon;
  switch (o.kind) {
    case 'orbit': return 'orbit';
    case 'launch': return 'rocket';
    case 'choice': return 'dot';
    case 'part':
      return ({ payload: 'eye', power: 'panel', comms: 'antenna', protection: 'shield', thermal: 'thermo' } as Record<string, IconName>)[o.subsystem] ?? 'box';
  }
}

const num = (v: unknown): number => {
  if (typeof v === 'number') return v;
  if (typeof v === 'object' && v !== null && 'value' in v) { const x = (v as Sourced<unknown>).value; return typeof x === 'number' ? x : 0; }
  return 0;
};

/** The value a slot's level marks rank options by (see DecisionSlot.level). */
export function levelValue(o: Option, by: string, solar = 1): number {
  return by.split('+').reduce((sum, term) => {
    if (term === 'tags') return sum + (o.tags?.length ?? 0);
    if (term === 'costed') return sum + (num(o.cost) > 0 ? 1 : 0);
    if (term.startsWith('settings.')) return sum + num(('settings' in o ? o.settings : undefined)?.[term.slice(9)]);
    // Solar output as at the chosen orbit, the same figure the card shows.
    return sum + num((o as unknown as Record<string, unknown>)[term]) * (term === 'generatesW' ? solar : 1);
  }, 0);
}

/**
 * Level of each option in a slot: distinct non-zero values ranked 1, 2, 3…; zero stays 0.
 * `max` is the number of distinct non-zero values. `share` is the raw value (for the arc style).
 */
export function levels(slot: DecisionSlot, peers: Option[], solar?: number): Map<string, { n: number; max: number; share: number }> {
  const out = new Map<string, { n: number; max: number; share: number }>();
  if (!slot.level) return out;
  const by = slot.level.by;
  const vals = peers.map((o) => levelValue(o, by, solar));
  const distinct = [...new Set(vals.filter((v) => v > 0))].sort((a, b) => a - b);
  peers.forEach((o, i) => out.set(o.id, { n: vals[i]! > 0 ? distinct.indexOf(vals[i]!) + 1 : 0, max: distinct.length, share: vals[i]! }));
  return out;
}

/** A number of an option for comparison, with the direction that is good for the player. */
type Measure = { key: string; good: 'high' | 'low'; of: (o: Option) => number };
const MEASURES: Measure[] = [
  { key: 'downlink', good: 'high', of: (o) => num((o as { downlinkMBPerMin?: unknown }).downlinkMBPerMin) },
  { key: 'generates', good: 'high', of: (o) => num((o as { generatesW?: unknown }).generatesW) + num((o as { rtgW?: unknown }).rtgW) },
  { key: 'contact', good: 'high', of: (o) => num((o as { contactMinPerDay?: unknown }).contactMinPerDay) },
  { key: 'reliability', good: 'high', of: (o) => num((o as { reliability?: unknown }).reliability) },
  { key: 'detect', good: 'high', of: (o) => (o.kind === 'part' && o.observes ? num(o.detectShare) || 1 : 0) },
  { key: 'cost', good: 'low', of: (o) => num(o.cost) },
  { key: 'mass', good: 'low', of: (o) => num((o as { massKg?: unknown }).massKg) },
  { key: 'power', good: 'low', of: (o) => num((o as { powerW?: unknown }).powerW) },
  { key: 'days', good: 'low', of: (o) => num((o as { leadDays?: unknown }).leadDays) },
];

/**
 * In plain words, what picking this option does compared with the others in its box: where it is the best
 * (strengths), where it is the most expensive or heaviest (costs), and which event cards it guards against
 * on its own. Built from the data only, so it holds for every mission.
 */
export function plainEffect(o: Option, peers: Option[], events: EventCard[]): { strengths: string[]; costs: string[]; guards: { id: string; full: boolean }[] } {
  const strengths: string[] = [], costs: string[] = [];
  if (peers.length > 1) for (const m of MEASURES) {
    const vals = peers.map(m.of);
    const v = m.of(o);
    const hi = Math.max(...vals), lo = Math.min(...vals);
    if (hi === lo) continue;
    const count = (x: number) => vals.filter((y) => y === x).length;
    if (m.good === 'high' && v === hi && v > 0 && count(v) === 1) strengths.push(m.key);
    if (m.good === 'low' && v === hi && v > 0 && count(v) === 1) costs.push(m.key);
    if (m.good === 'low' && v === lo && count(v) === 1 && hi > 0) strengths.push(`${m.key}Low`);
  }
  // Event cards this option alone makes harmless (or partly harmless): tags and settings in their conditions.
  const meets = (c: Condition): boolean => {
    switch (c.kind) {
      case 'hasTag': return !!o.tags?.includes(c.tag);
      case 'setting': return 'settings' in o && num(o.settings?.[c.key]) >= c.atLeast && o.settings?.[c.key] !== undefined;
      case 'settingAtMost': return 'settings' in o && o.settings?.[c.key] !== undefined && num(o.settings?.[c.key]) <= c.atMost;
      case 'any': return c.of.some(meets);
      default: return false;
    }
  };
  const guards: { id: string; full: boolean }[] = [];
  for (const e of events) {
    if (e.protectedIf && meets(e.protectedIf)) guards.push({ id: e.id, full: true });
    else if (e.partialIf && meets(e.partialIf)) guards.push({ id: e.id, full: false });
  }
  return { strengths, costs, guards };
}
