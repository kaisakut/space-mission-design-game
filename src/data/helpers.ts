import type { Sourced, Text } from './types';

/** Text in both languages. */
export const tx = (en: string, ja: string): Text => ({ en, ja });

/** Temporary value; must be replaced with a sourced one before submission. */
export const ph = <T = number>(value: T): Sourced<T> => ({ value, basis: 'placeholder' });

/** Game-balance rule (not a real-world value). */
export const rule = <T = number>(value: T, note?: Text): Sourced<T> => ({ value, basis: 'rule', ...(note ? { note } : {}) });

/** Value taken from NASA data or documents. */
export const nasa = <T = number>(value: T, sources: string[], note?: Text): Sourced<T> => ({ value, basis: 'nasa', sources, ...(note ? { note } : {}) });

/** Value taken from another public source. */
export const pub = <T = number>(value: T, sources: string[], note?: Text): Sourced<T> => ({ value, basis: 'public', sources, ...(note ? { note } : {}) });

/** Value derived from sources by a stated calculation or rounding. */
export const est = <T = number>(value: T, sources: string[], note: Text): Sourced<T> => ({ value, basis: 'estimate', sources, note });
