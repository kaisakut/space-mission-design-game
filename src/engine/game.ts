import type { Effect, Mission, Option } from '../data/types';
import { completePicks, evaluate, type Adjustments, type DesignState, type Picks } from './design';
import { resolveEvent, type EventResult } from './events';
import { runForecast, type Forecast } from './forecast';
import { Rng } from './rng';
import { simulate, type RunResult } from './simulate';

export type AgencyKind = 'player' | 'cautious' | 'balanced' | 'bold';
export const AGENCIES: AgencyKind[] = ['player', 'cautious', 'balanced', 'bold'];
export const PHASE_COUNT = 5;

export interface Agency {
  id: AgencyKind;
  picks: Picks;
  /** Phase in which each slot was last confirmed. */
  decidedIn: Record<string, number>;
  /** Paid for changing earlier decisions. */
  changeKUSD: number;
  changeDays: number;
  /** How each card that hit the game so far turned out for this agency. */
  results: Map<string, EventResult>;
}

export interface TurnReport {
  phase: number;
  /** Cards drawn this phase (the same for every agency). */
  cards: string[];
  /** Agency → card → result. */
  results: Record<AgencyKind, Record<string, EventResult>>;
}

export interface Game {
  mission: Mission;
  seed: number;
  /** Current phase, 1–5; 6 when the game is over. */
  phase: number;
  agencies: Agency[];
  /** Cards drawn in each finished phase. */
  drawn: Map<number, Set<string>>;
  reports: TurnReport[];
  /** Forecasts used in the current phase. */
  forecastsUsed: number;
  practice: boolean;
  /** Whether the hint button is offered (chosen before the game; never changes the draws). */
  hints: boolean;
  hintsUsed: number;
  final: Record<AgencyKind, RunResult> | null;
}

/** Turns of each agency that confirmed slots: what the player does and what the AI does go through the same rules. */
export function newGame(m: Mission, seed: number, practice = false, hints = true): Game {
  const agency = (id: AgencyKind): Agency => ({ id, picks: {}, decidedIn: {}, changeKUSD: 0, changeDays: 0, results: new Map() });
  return { mission: m, seed, phase: 1, agencies: AGENCIES.map(agency), drawn: new Map(), reports: [], forecastsUsed: 0, practice, hints, hintsUsed: 0, final: null };
}

/** Cards for a phase, drawn once from the game's own stream so every agency faces the same ones. */
export function drawPhase(m: Mission, seed: number, phase: number): Set<string> {
  const rng = new Rng(seed, `events:${phase}`);
  const out = new Set<string>();
  for (const c of m.events) if (c.phase === phase && !c.unprotected.some((e) => e.kind === 'missionLost' && e.outcome === 'launchFailure') && rng.chance(c.probability.value)) out.add(c.id);
  return out;
}

const optionById = (m: Mission) => new Map(m.options.map((o) => [o.id, o]));

/** What changing a slot decided in an earlier phase costs now. Same-phase changes are free. */
export function changeCost(m: Mission, a: Agency, slotId: string, newIds: string[], phase: number): { kUSD: number; days: number; locked: boolean } {
  const decided = a.decidedIn[slotId];
  const slot = m.slots.find((s) => s.id === slotId)!;
  if (decided === undefined || decided >= phase) return { kUSD: 0, days: 0, locked: false };
  if (slot.changeKind === 'hardware' && phase >= 5) return { kUSD: 0, days: 0, locked: true };
  const old = a.picks[slotId] ?? [];
  if (old.length === newIds.length && old.every((x) => newIds.includes(x))) return { kUSD: 0, days: 0, locked: false };
  const ago = phase - decided;
  const f = m.rules.changeFactors.value[Math.min(ago, m.rules.changeFactors.value.length) - 1] ?? 1;
  const byId = optionById(m);
  const cost = (ids: string[]) => ids.reduce((s, id) => s + (byId.get(id)?.cost.value ?? 0), 0);
  return {
    kUSD: Math.round(Math.max(cost(old), cost(newIds), m.rules.changeMinKUSD.value) * f),
    days: m.rules.changeDelayDaysPerPhase.value * ago,
    locked: false,
  };
}

/** Effects of the cards that already hit this agency (budget cuts, delays), for the gauges. */
function eventAdjustments(m: Mission, a: Agency): { budgetDelta: number; days: number } {
  let budgetDelta = 0, days = 0;
  for (const [id, r] of a.results) {
    const card = m.events.find((e) => e.id === id);
    if (!card) continue;
    const effects: Effect[] = r === 'hit' ? card.unprotected : r === 'partial' ? card.partial ?? [] : [];
    for (const e of effects) {
      if (e.kind === 'resource' && e.resource === 'budget') budgetDelta += e.delta;
      if (e.kind === 'delayDays') days += e.days;
    }
  }
  return { budgetDelta, days };
}

/** The design as the agency sees it now: change costs plus what events have done so far. */
export function agencyDesign(g: Game, a: Agency, picks: Picks = a.picks, pending = { kUSD: 0, days: 0 }): DesignState {
  const ev = eventAdjustments(g.mission, a);
  return evaluate(g.mission, picks, { extraKUSD: a.changeKUSD + pending.kUSD, extraDays: a.changeDays + pending.days + ev.days, budgetDelta: ev.budgetDelta });
}

/** Forecast for an agency: past cards are fixed, later ones are drawn in each run. */
export function agencyForecast(g: Game, a: Agency, picks: Picks, runs: number, stream?: string, pending = { kUSD: 0, days: 0 }, seed = g.seed): Forecast {
  const adj: Adjustments = { extraKUSD: a.changeKUSD + pending.kUSD, extraDays: a.changeDays + pending.days };
  return runForecast(g.mission, picks, seed, g.phase, runs, { adj, sim: { knownPhases: g.drawn, results: a.results }, stream });
}

/** Total change cost of moving from the agency's confirmed picks to `picks`. */
export function pendingChanges(g: Game, a: Agency, picks: Picks): { kUSD: number; days: number; locked: string[] } {
  let kUSD = 0, days = 0;
  const locked: string[] = [];
  for (const s of g.mission.slots) {
    if (!picks[s.id]) continue;
    const c = changeCost(g.mission, a, s.id, picks[s.id]!, g.phase);
    if (c.locked && JSON.stringify(picks[s.id]) !== JSON.stringify(a.picks[s.id])) locked.push(s.id);
    kUSD += c.kUSD; days = Math.max(days, c.days);
  }
  return { kUSD, days, locked };
}

/**
 * Confirms the current phase for every agency: records the picks (paying for changes), draws the
 * phase's cards once, resolves them against each agency's design, and moves to the next phase.
 * After phase 5 the final runs are flown on each agency's own failure stream.
 */
export function confirmPhase(g: Game, picksByAgency: Record<AgencyKind, Picks>): Game {
  const m = g.mission;
  const phase = g.phase;
  const agencies = g.agencies.map((a) => {
    const next = { ...a, picks: { ...a.picks }, decidedIn: { ...a.decidedIn }, results: new Map(a.results) };
    const wanted = picksByAgency[a.id] ?? {};
    const pend = pendingChanges(g, a, wanted);
    next.changeKUSD += pend.kUSD;
    next.changeDays += pend.days;
    const standard = completePicks(m, { ...a.picks, ...wanted });
    for (const s of m.slots) {
      if (s.phase > phase || pend.locked.includes(s.id)) continue;
      const pick = wanted[s.id] ?? a.picks[s.id] ?? standard[s.id]!;
      const changed = JSON.stringify(pick) !== JSON.stringify(a.picks[s.id]);
      next.picks[s.id] = pick;
      if (changed || next.decidedIn[s.id] === undefined) next.decidedIn[s.id] = phase;
    }
    return next;
  });

  const cards = drawPhase(m, g.seed, phase);
  const drawn = new Map(g.drawn).set(phase, cards);
  const report: TurnReport = { phase, cards: [...cards], results: Object.fromEntries(AGENCIES.map((id) => [id, {}])) as TurnReport['results'] };
  for (const a of agencies) {
    const d = agencyDesign({ ...g, agencies }, a);
    for (const id of cards) {
      const r = resolveEvent(m.events.find((e) => e.id === id)!, d).result;
      a.results.set(id, r);
      report.results[a.id][id] = r;
    }
  }

  const next: Game = { ...g, agencies, drawn, reports: [...g.reports, report], phase: phase + 1, forecastsUsed: 0 };
  if (next.phase > PHASE_COUNT) {
    const all = new Set([...drawn.values()].flatMap((s) => [...s]));
    const final = {} as Record<AgencyKind, RunResult>;
    for (const a of agencies) {
      const d = evaluate(m, a.picks, { extraKUSD: a.changeKUSD, extraDays: a.changeDays });
      final[a.id] = simulate(m, d, new Rng(g.seed, `failures:${a.id}`), { drawn: all, results: a.results });
    }
    shareSecondaryPoints(m, agencies, final);
    next.final = final;
  }
  return next;
}

/** Agencies chasing the same secondary objective split its points. */
function shareSecondaryPoints(m: Mission, agencies: Agency[], final: Record<AgencyKind, RunResult>) {
  const tagsOf = (a: Agency) => new Set(completeOptions(m, a.picks).flatMap((o) => o.tags ?? []));
  const chasers = new Map<string, number>();
  for (const o of m.secondary) if (o.chosenBy) chasers.set(o.id, agencies.filter((a) => tagsOf(a).has(o.chosenBy!)).length);
  for (const a of agencies) {
    const r = final[a.id];
    const tags = tagsOf(a);
    let shared = 0;
    for (const o of m.secondary) {
      if (!o.chosenBy || !tags.has(o.chosenBy)) continue;
      const n = Math.max(1, chasers.get(o.id) ?? 1);
      // simulate() gave full points for objectives met; scale them by the number of agencies chasing them.
      shared += (o.points.value / n);
    }
    if (r.score.secondary > 0) {
      const full = m.secondary.reduce((s, o) => s + (o.chosenBy && tags.has(o.chosenBy) ? o.points.value : 0), 0);
      r.score.secondary = Math.round((r.score.secondary * (shared / Math.max(full, 1e-9))) * 10) / 10;
      r.score.total = Math.round((r.score.primary + r.score.secondary + r.score.science + r.score.budget + r.score.schedule) * 10) / 10;
    }
  }
}

const completeOptions = (m: Mission, picks: Picks): Option[] => {
  const byId = optionById(m);
  const p = completePicks(m, picks);
  return Object.values(p).flat().map((id) => byId.get(id)).filter((o): o is Option => !!o);
};
