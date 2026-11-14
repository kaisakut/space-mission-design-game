import type { Effect, EventCard, Mission, ObjectiveRule, Outcome, Part, Subsystem } from '../data/types';
import { canLaunch, type DesignState } from './design';
import { resolveEvent, type EventResult } from './events';
import type { Rng } from './rng';

/** Status of a run at the end of each phase, shown as the lines of the branch map. */
export type RunStatus = 'nominal' | 'atRisk' | 'critical' | 'lost';
export const RUN_STATUSES: RunStatus[] = ['nominal', 'atRisk', 'critical', 'lost'];
export const OUTCOMES: Outcome[] = ['fullSuccess', 'partialSuccess', 'objectiveMissed', 'lostInOps', 'orbitFailure', 'launchFailure', 'noLaunch'];

export interface Score {
  primary: number;
  secondary: number;
  science: number;
  budget: number;
  schedule: number;
  total: number;
}

/** What happened to an event card in this run. */
export interface RunEvent { id: string; phase: number; result: EventResult }

export interface RunResult {
  states: RunStatus[];
  outcome: Outcome;
  score: Score;
  /** Observations delivered to the ground, in the mission's science unit. */
  delivered: number;
  /** Why the run went wrong, most important first: event ids, or 'launchFailure', 'earlyFailure', 'fail:<subsystem>', 'blocked:<issue>'. */
  causes: string[];
  events: RunEvent[];
  launchDay: number | null;
}

export interface SimulateOptions {
  /** Event ids drawn for the real game: every agency gets the same cards. Omit to draw them in this run. */
  drawn?: Set<string>;
}

const FATAL: Subsystem[] = ['cdh', 'power', 'comms'];

/**
 * Flies one design through all five phases.
 *
 * Draw order is fixed (events of each phase, then launch, early failure, part failures), so the same
 * random generator state always gives the same run.
 */
export function simulate(m: Mission, d: DesignState, rng: Rng, opts: SimulateOptions = {}): RunResult {
  const budget = m.budgetKUSD.value;
  let budgetAvail = budget;
  let readyDay = d.readyDay;
  const failAdd: Partial<Record<Subsystem, number>> = {};
  let scienceFactor = 1;
  let durationFactor = 1;
  let lost: Outcome | null = null;
  let hits = 0;
  const causes: string[] = [];
  const events: RunEvent[] = [];
  const states: RunStatus[] = [];
  const designWarn = d.issues.some((i) => i.level === 'warning');
  const designBlock = !canLaunch(d);

  const apply = (e: Effect) => {
    switch (e.kind) {
      case 'missionLost': lost = e.outcome; break;
      case 'resource': if (e.resource === 'budget') budgetAvail += e.delta; break;
      case 'delayDays': readyDay += e.days; break;
      case 'failChance': failAdd[e.subsystem] = (failAdd[e.subsystem] ?? 0) + e.add; break;
      case 'scienceFactor': scienceFactor *= e.factor; break;
      case 'durationFactor': durationFactor *= e.factor; break;
      case 'bonus': break;
    }
  };
  const playEvents = (phase: number) => {
    for (const card of m.events.filter((c) => c.phase === phase)) {
      if (isLaunchCard(card)) continue;
      const drawn = opts.drawn ? opts.drawn.has(card.id) : rng.chance(card.probability.value);
      if (!drawn) continue;
      const r = resolveEvent(card, d);
      events.push({ id: card.id, phase, result: r.result });
      if (r.result === 'hit' || r.result === 'partial') { hits++; causes.push(card.id); }
      r.effects.forEach(apply);
    }
  };
  const status = (): RunStatus => (lost ? 'lost' : designBlock || hits >= 2 ? 'critical' : hits > 0 || designWarn ? 'atRisk' : 'nominal');

  // Phases 1–3: concept, spacecraft, launch preparations.
  for (const phase of [1, 2, 3]) { playEvents(phase); states.push(status()); }

  // Phase 4: test and launch.
  playEvents(4);
  const windows = d.launch ? [...d.launch.windowsDay.value].sort((a, b) => a - b) : [];
  const launchDay = windows.find((w) => w >= readyDay) ?? null;
  const spent = d.gauges.budget.used;
  if (!lost) {
    const blocker = d.issues.find((i) => i.level === 'blocker');
    if (blocker) { lost = 'noLaunch'; causes.unshift(`blocked:${blocker.code}`); }
    else if (spent > budgetAvail) { lost = 'noLaunch'; causes.unshift('blocked:overBudget'); }
    else if (launchDay === null) { lost = 'noLaunch'; causes.unshift('blocked:noWindow'); }
  }
  if (!lost && d.launch && !rng.chance(d.launch.reliability.value)) { lost = 'launchFailure'; causes.unshift('launchFailure'); }
  if (!lost) {
    const depth = Math.max(1, Math.min(3, d.settings.testDepth ?? 1));
    if (rng.chance(m.rules.earlyFailureByTestDepth.value[depth - 1] ?? 0)) { lost = 'orbitFailure'; causes.unshift('earlyFailure'); }
  }
  states.push(status());

  // Phase 5: operations.
  let opsFraction = 0;
  let fatalAt = 1;
  let instrumentShare = 1;
  if (!lost) {
    playEvents(5);
    const parts = d.options.filter((o): o is Part => o.kind === 'part');
    const failures: { sub: Subsystem; at: number }[] = [];
    const tryFail = (sub: Subsystem, p: number) => { if (p > 0 && rng.chance(Math.min(p, 1))) failures.push({ sub, at: rng.float() }); };
    tryFail('cdh', m.bus.failPerYear.value + (failAdd.cdh ?? 0));
    for (const p of parts) if (p.failPerYear) tryFail(p.subsystem, p.failPerYear.value + (failAdd[p.subsystem] ?? 0));
    for (const [sub, add] of Object.entries(failAdd) as [Subsystem, number][]) {
      if (sub !== 'cdh' && !parts.some((p) => p.subsystem === sub && p.failPerYear)) tryFail(sub, add);
    }
    for (const f of failures) {
      if (FATAL.includes(f.sub)) fatalAt = Math.min(fatalAt, f.at);
      else if (f.sub === 'payload') instrumentShare = Math.min(instrumentShare, f.at);
    }
    for (const f of failures.sort((a, b) => a.at - b.at)) causes.push(`fail:${f.sub}`);
    opsFraction = Math.min(fatalAt, instrumentShare) * Math.min(durationFactor, 1);
  }

  // Science delivered.
  let delivered = 0;
  let value = 0;
  if (!lost && d.orbit) {
    const duty = d.settings.dutyCycle ?? 0.5;
    const g = d.gauges.downlink;
    const sentShare = g.used > 0 ? Math.min(1, g.available / g.used) : 1;
    for (const p of d.options) {
      if (p.kind !== 'part' || p.subsystem !== 'payload' || !p.observes) continue;
      const n = (d.orbit.science[p.observes]?.value ?? 0) * duty * sentShare * opsFraction * scienceFactor;
      delivered += n;
      value += n * (p.scienceWeight?.value ?? 1);
    }
  }
  const survived = !lost && fatalAt >= 1 && durationFactor >= 1;
  if (!lost && fatalAt < 1) lost = 'lostInOps';
  if (lost === 'lostInOps' && !causes.some((c) => c.startsWith('fail:'))) causes.push('fail:cdh');

  // Objectives and score.
  const reachedOps = lost === null || lost === 'lostInOps';
  const judge = (r: ObjectiveRule): number => {
    switch (r.kind) {
      case 'science': return delivered >= r.atLeast ? 1 : r.partialAtLeast !== undefined && delivered >= r.partialAtLeast ? 0.5 : 0;
      case 'hasTag': return reachedOps && d.tags.has(r.tag) && delivered > 0 ? 1 : 0;
      case 'survive': return survived ? 1 : 0;
      case 'margin': return reachedOps && d.gauges[r.resource].margin >= r.atLeast ? 1 : 0;
      case 'all': return Math.min(...r.of.map(judge));
    }
  };
  const primaryMet = judge(m.primary.rule);
  // When the objective is missed, the design's own weak points are causes too (e.g. a radio too slow for the data).
  if (primaryMet < 1 && reachedOps) for (const i of d.issues) if (i.level === 'warning' && i.code !== 'lowMargin') causes.unshift(`warn:${i.code}`);
  let outcome: Outcome;
  if (lost && lost !== 'lostInOps') outcome = lost;
  else if (primaryMet === 1) outcome = 'fullSuccess';
  else if (lost === 'lostInOps') outcome = 'lostInOps';
  else outcome = primaryMet > 0 ? 'partialSuccess' : 'objectiveMissed';

  const rb = m.rubric;
  const secondary = Math.min(rb.secondary.value, m.secondary.reduce((a, o) => a + (o.chosenBy && d.tags.has(o.chosenBy) ? o.points.value * judge(o.rule) : 0), 0));
  const ratio = spent / Math.max(budgetAvail, 1);
  const missed = launchDay === null ? Infinity : windows.indexOf(launchDay);
  const score: Score = {
    primary: rb.primary.value * primaryMet,
    secondary,
    science: rb.science.value * Math.min(1, value / m.rules.scienceFullScore.value),
    budget: outcome === 'noLaunch' && causes[0] === 'blocked:overBudget' ? 0 : rb.budget.value * clamp((1.1 - ratio) / 0.2, 0, 1),
    schedule: missed === 0 ? rb.schedule.value : missed === 1 ? rb.schedule.value / 2 : 0,
    total: 0,
  };
  score.total = round1(score.primary + score.secondary + score.science + score.budget + score.schedule);

  // Phase 5 status.
  // A spacecraft lost late in operations that already met the primary objective still counts as a success.
  const endedEarly = outcome === 'lostInOps' || outcome === 'noLaunch' || outcome === 'launchFailure' || outcome === 'orbitFailure';
  states.push(endedEarly ? 'lost' : primaryMet === 0 ? 'critical' : hits > 0 || fatalAt < 1 || primaryMet < 1 ? 'atRisk' : 'nominal');
  return { states, outcome, score, delivered: Math.round(delivered), causes, events, launchDay };
}

/** The launch failure card is decided by the rocket's reliability, not drawn like other cards. */
const isLaunchCard = (c: EventCard) => c.unprotected.some((e) => e.kind === 'missionLost' && e.outcome === 'launchFailure');
const clamp = (x: number, a: number, b: number) => Math.max(a, Math.min(b, x));
const round1 = (x: number) => Math.round(x * 10) / 10;
