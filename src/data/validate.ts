import { SOURCE_BY_ID } from './sources';
import type { Condition, Effect, Mission, Sourced } from './types';

export interface DataIssue {
  level: 'error' | 'placeholder';
  where: string;
  message: string;
}

const isSourced = (v: unknown): v is Sourced<unknown> =>
  typeof v === 'object' && v !== null && 'value' in v && 'basis' in v;

/**
 * Checks a mission's data:
 * - every sourced value either is a game rule / placeholder, or cites at least one known source;
 * - every 'estimate' says how it was derived;
 * - every text has both languages;
 * - ids are unique and every slot refers to existing options;
 * - conditions and settings refer to tags and settings that some option provides.
 * Placeholders are reported separately so the remaining work is visible.
 */
export function validateMission(m: Mission): DataIssue[] {
  const issues: DataIssue[] = [];
  const err = (where: string, message: string) => issues.push({ level: 'error', where, message });

  const walk = (v: unknown, where: string): void => {
    if (Array.isArray(v)) { v.forEach((x, i) => walk(x, `${where}[${i}]`)); return; }
    if (typeof v !== 'object' || v === null) return;
    if (isSourced(v)) {
      if (v.basis === 'placeholder') issues.push({ level: 'placeholder', where, message: `placeholder value ${JSON.stringify(v.value)}` });
      else if (v.basis !== 'rule') {
        if (!v.sources?.length) err(where, `basis '${v.basis}' needs at least one source`);
        for (const s of v.sources ?? []) if (!SOURCE_BY_ID.has(s)) err(where, `unknown source id '${s}'`);
        if (v.basis === 'estimate' && !v.note) err(where, 'an estimate needs a note saying how it was derived');
      }
      if (v.note) walk(v.note, `${where}.note`);
      return;
    }
    const o = v as Record<string, unknown>;
    if ('en' in o && 'ja' in o && Object.keys(o).length === 2) {
      if (typeof o.en !== 'string' || !o.en.trim()) err(where, 'missing English text');
      if (typeof o.ja !== 'string' || !o.ja.trim()) err(where, 'missing Japanese text');
      return;
    }
    for (const [k, x] of Object.entries(o)) walk(x, `${where}.${k}`);
  };
  walk(m, m.id);

  const dup = (ids: string[], what: string) => {
    const seen = new Set<string>();
    for (const id of ids) { if (seen.has(id)) err(m.id, `duplicate ${what} id '${id}'`); seen.add(id); }
  };
  dup(m.options.map((o) => o.id), 'option');
  dup(m.slots.map((s) => s.id), 'slot');
  dup(m.events.map((e) => e.id), 'event');

  const optionIds = new Set(m.options.map((o) => o.id));
  const used = new Set<string>();
  for (const s of m.slots) {
    if (!s.options.length) err(`${m.id}.slots.${s.id}`, 'no options');
    for (const d of s.default === undefined ? [] : Array.isArray(s.default) ? s.default : [s.default]) if (!s.options.includes(d)) err(`${m.id}.slots.${s.id}`, `default '${d}' is not one of the options`);
    for (const id of s.options) { if (!optionIds.has(id)) err(`${m.id}.slots.${s.id}`, `unknown option '${id}'`); used.add(id); }
    if (s.multi && (s.multi.min < 0 || s.multi.max < s.multi.min || s.multi.max > s.options.length)) err(`${m.id}.slots.${s.id}`, 'bad multi range');
  }
  for (const o of m.options) if (!used.has(o.id)) err(`${m.id}.options.${o.id}`, 'option is not used by any slot');

  const orbits = new Set(m.options.filter((o) => o.kind === 'orbit').map((o) => o.id));
  for (const o of m.options) if (o.kind === 'launch') for (const k of Object.keys(o.capacityKg)) if (!orbits.has(k)) err(`${m.id}.options.${o.id}`, `capacity for unknown orbit '${k}'`);

  const tags = new Set(m.options.flatMap((o) => o.tags ?? []));
  const settings = new Set(m.options.flatMap((o) => (o.kind === 'choice' ? Object.keys(o.settings ?? {}) : [])));
  const checkCond = (c: Condition | undefined, where: string): void => {
    if (!c) return;
    if (c.kind === 'hasTag' && !tags.has(c.tag)) err(where, `no option gives tag '${c.tag}'`);
    if (c.kind === 'setting' && !settings.has(c.key)) err(where, `no option sets '${c.key}'`);
    if (c.kind === 'all' || c.kind === 'any') c.of.forEach((x) => checkCond(x, where));
  };
  const checkEffects = (es: Effect[] | undefined, where: string) => {
    for (const e of es ?? []) if ((e.kind === 'scienceFactor' || e.kind === 'durationFactor') && e.factor < 0) err(where, 'negative factor');
  };
  for (const e of m.events) {
    const w = `${m.id}.events.${e.id}`;
    checkCond(e.protectedIf, w); checkCond(e.partialIf, w); checkCond(e.readyIf, w);
    checkEffects(e.unprotected, w); checkEffects(e.partial, w); checkEffects(e.benefit, w);
    if (e.partial && !e.partialIf) err(w, 'partial effects without partialIf');
    if (e.benefit && !e.readyIf) err(w, 'benefit without readyIf');
    const p = e.probability.value;
    if (p < 0 || p > 1) err(w, 'probability must be between 0 and 1');
  }

  const orbitList = m.options.filter((o) => o.kind === 'orbit');
  for (const o of m.options) {
    if (o.kind !== 'part' || o.subsystem !== 'payload') continue;
    if (!o.observes) err(`${m.id}.options.${o.id}`, 'instrument has no observation mode (observes)');
    else for (const orb of orbitList) if (orb.kind === 'orbit' && !orb.science[o.observes]) err(`${m.id}.options.${orb.id}`, `no science opportunities for mode '${o.observes}'`);
  }
  const checkRule = (r: import('./types').ObjectiveRule, where: string): void => {
    if (r.kind === 'hasTag' && !tags.has(r.tag)) err(where, `no option gives tag '${r.tag}'`);
    if (r.kind === 'all') r.of.forEach((x) => checkRule(x, where));
  };
  for (const ob of [m.primary, ...m.secondary]) {
    checkRule(ob.rule, `${m.id}.objectives.${ob.id}`);
    if (ob.chosenBy && !tags.has(ob.chosenBy)) err(`${m.id}.objectives.${ob.id}`, `no option gives tag '${ob.chosenBy}'`);
  }
  if (m.rules.earlyFailureByTestDepth.value.length < 3) err(`${m.id}.rules`, 'earlyFailureByTestDepth needs 3 values');

  const r = m.rubric;
  const total = r.primary.value + r.secondary.value + r.science.value + r.budget.value + r.schedule.value;
  if (total !== 100) err(`${m.id}.rubric`, `rubric adds up to ${total}, expected 100`);
  if (m.primary.points.value !== r.primary.value) err(`${m.id}.primary`, 'primary points differ from the rubric');
  return issues;
}
