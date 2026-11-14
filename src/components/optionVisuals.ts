import type { DecisionSlot, Option, Sourced } from '../data/types';
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
