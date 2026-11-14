import type { Condition, Effect, EventCard } from '../data/types';
import type { DesignState } from './design';

/** How an event card turned out for one agency's design. */
export type EventResult = 'protected' | 'partial' | 'hit' | 'ready' | 'missed';

export interface ResolvedEvent {
  card: EventCard;
  result: EventResult;
  effects: Effect[];
}

/** Does the design meet a condition? */
export function meets(c: Condition | undefined, d: DesignState): boolean {
  if (!c) return false;
  switch (c.kind) {
    case 'hasTag': return d.tags.has(c.tag);
    case 'margin': return d.gauges[c.resource].margin >= c.atLeast;
    case 'reserveAtLeast': return d.reserveKUSD >= c.kUSD;
    case 'setting': return (d.settings[c.key] ?? 0) >= c.atLeast;
    case 'all': return c.of.every((x) => meets(x, d));
    case 'any': return c.of.some((x) => meets(x, d));
  }
}

/**
 * Applies a drawn card to a design. Every agency gets the same card; what happens depends on its design.
 * Bad events: protected → nothing, partly protected → `partial`, otherwise `unprotected`.
 * Good events (opportunities): ready → `benefit`, otherwise nothing.
 */
export function resolveEvent(card: EventCard, d: DesignState): ResolvedEvent {
  if (card.readyIf) {
    return meets(card.readyIf, d)
      ? { card, result: 'ready', effects: card.benefit ?? [] }
      : { card, result: 'missed', effects: [] };
  }
  if (meets(card.protectedIf, d)) return { card, result: 'protected', effects: [] };
  if (card.partialIf && meets(card.partialIf, d)) return { card, result: 'partial', effects: card.partial ?? [] };
  return { card, result: 'hit', effects: card.unprotected };
}
