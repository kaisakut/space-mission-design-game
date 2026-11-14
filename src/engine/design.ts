import type { Choice, LaunchVehicle, Mission, Option, Orbit, Part, Resource } from '../data/types';

/** The player's picks: slot id → option ids (one for single-choice slots). */
export type Picks = Record<string, string[]>;

/** One gauge: how much is used out of how much is available. */
export interface Gauge {
  resource: Resource;
  used: number;
  available: number;
  /** (available − used) / available; negative when over the limit. */
  margin: number;
  unit: string;
  /** Going over is a warning, not a blocker (schedule: a later launch window still exists). */
  softLimit?: boolean;
}

export type IssueLevel = 'blocker' | 'warning';

/** A problem with the design. Text is built in the UI from `code` and `values`, so it can be translated. */
export interface Issue {
  level: IssueLevel;
  code: string;
  resource?: Resource;
  values: Record<string, string | number>;
}

export interface DesignState {
  picks: Picks;
  orbit: Orbit | null;
  launch: LaunchVehicle | null;
  /** Parts and choices currently picked, in slot order. */
  options: Option[];
  settings: Record<string, number>;
  tags: Set<string>;
  gauges: Record<Resource, Gauge>;
  /** Day the satellite is ready to ship, and the launch window it makes. */
  readyDay: number;
  launchDay: number | null;
  missedWindows: number;
  /** Money kept aside for surprises, kUSD. */
  reserveKUSD: number;
  issues: Issue[];
}

/** Below this margin a gauge is shown as a warning. */
export const LOW_MARGIN = 0.1;

const MIN_PER_DAY = 1440;

/** Picks for slots the player has not decided yet: each slot's standard choice. */
export function defaultPicks(m: Mission): Picks {
  const p: Picks = {};
  for (const s of m.slots) p[s.id] = [s.default ?? s.options[0]!];
  return p;
}

/** Fill undecided slots with defaults. */
export function completePicks(m: Mission, picks: Picks): Picks {
  return { ...defaultPicks(m), ...picks };
}

const num = (v: { value: number } | undefined) => v?.value ?? 0;

/**
 * Computes the five gauges and the design issues.
 *
 * Rules (all visible to the player through the gauge tooltips):
 * - Mass: bus + parts, against the launch capacity to the chosen orbit (or the satellite limit if lower).
 * - Power (orbit average): bus + instruments × observation share + radios × share of the day in contact,
 *   against what the solar panels make on average (× the destination's sunlight factor).
 * - Budget: bus + options + launch, against the budget minus the reserve.
 * - Downlink: data the instruments make per day (scaled by the observation plan), against what the radios
 *   can send in the day's ground contact.
 * - Schedule: development days + option lead times, against the first launch window.
 */
export function evaluate(m: Mission, rawPicks: Picks): DesignState {
  const picks = completePicks(m, rawPicks);
  const byId = new Map(m.options.map((o) => [o.id, o]));
  const options: Option[] = [];
  for (const s of m.slots) for (const id of picks[s.id] ?? []) { const o = byId.get(id); if (o) options.push(o); }

  const orbit = (options.find((o) => o.kind === 'orbit') as Orbit | undefined) ?? null;
  const launch = (options.find((o) => o.kind === 'launch') as LaunchVehicle | undefined) ?? null;
  const parts = options.filter((o): o is Part => o.kind === 'part');
  const choices = options.filter((o): o is Choice => o.kind === 'choice');
  const settings: Record<string, number> = {};
  for (const c of choices) for (const [k, v] of Object.entries(c.settings ?? {})) settings[k] = v.value;
  const tags = new Set(options.flatMap((o) => o.tags ?? []));
  const issues: Issue[] = [];

  // Mass
  const massUsed = num(m.bus.massKg) + parts.reduce((a, p) => a + num(p.massKg), 0);
  const launchCap = launch && orbit ? launch.capacityKg[orbit.id]?.value : undefined;
  const massAvail = Math.min(num(m.bus.maxMassKg), launchCap ?? num(m.bus.maxMassKg));
  if (launch && orbit && launchCap === undefined) issues.push({ level: 'blocker', code: 'launchWrongOrbit', values: { launch: launch.id, orbit: orbit.id } });

  // Power (orbit average)
  const duty = settings.dutyCycle ?? 0.5;
  const contactShare = orbit ? num(orbit.contactMinPerDay) / MIN_PER_DAY : 0;
  let powerUsed = num(m.bus.powerW);
  let powerGen = 0;
  const solar = orbit?.solarFactor?.value ?? 1;
  for (const p of parts) {
    powerGen += num(p.generatesW) * solar;
    if (p.subsystem === 'payload') powerUsed += num(p.powerW) * duty;
    else if (p.subsystem === 'comms') powerUsed += num(p.powerW) * contactShare;
    else powerUsed += num(p.powerW);
  }

  // Budget
  const budget = num(m.budgetKUSD);
  const reserveKUSD = budget * (settings.reserveShare ?? 0);
  const spent = num(m.bus.cost) + options.reduce((a, o) => a + num(o.cost), 0);

  // Downlink (per day)
  // All instruments and radios count, so missions can carry several.
  const instruments = parts.filter((p) => p.subsystem === 'payload');
  const radios = parts.filter((p) => p.subsystem === 'comms');
  const dataPerDay = instruments.reduce((a, p) => a + num(p.dataMBPerDay), 0) * (duty / 0.5);
  const sendPerDay = orbit ? radios.reduce((a, p) => a + num(p.downlinkMBPerMin), 0) * num(orbit.contactMinPerDay) : 0;

  // Schedule
  let readyDay = num(m.bus.devDays);
  for (const o of options) if (o.kind !== 'launch') readyDay += num(o.leadDays);
  const windows = launch ? [...launch.windowsDay.value].sort((a, b) => a - b) : [];
  const launchDay = windows.find((w) => w >= readyDay) ?? null;
  const missedWindows = windows.filter((w) => w < readyDay).length;
  const firstWindow = windows[0] ?? readyDay;

  const g = (resource: Resource, used: number, available: number, unit: string): Gauge => ({
    resource, used, available, unit, margin: available > 0 ? (available - used) / available : used > 0 ? -1 : 0,
  });
  const gauges: Record<Resource, Gauge> = {
    mass: g('mass', massUsed, massAvail, 'kg'),
    power: g('power', powerUsed, powerGen, 'W'),
    budget: g('budget', spent, budget - reserveKUSD, 'kUSD'),
    downlink: g('downlink', dataPerDay, sendPerDay, 'MB/day'),
    schedule: { ...g('schedule', readyDay, firstWindow, 'days'), softLimit: launchDay !== null },
  };

  // Issues: blockers stop the launch, warnings make events more dangerous.
  if (gauges.mass.margin < 0) issues.push({ level: 'blocker', code: 'overMass', resource: 'mass', values: { over: round(massUsed - massAvail, 2) } });
  if (gauges.power.margin < 0) issues.push({ level: 'blocker', code: 'powerShort', resource: 'power', values: { short: round(powerUsed - powerGen, 1) } });
  if (gauges.budget.margin < 0) {
    const overAll = spent > budget;
    issues.push({ level: 'blocker', code: overAll ? 'overBudget' : 'eatsReserve', resource: 'budget', values: { over: Math.round(spent - (overAll ? budget : budget - reserveKUSD)) } });
  }
  if (launch && launchDay === null) issues.push({ level: 'blocker', code: 'noWindow', resource: 'schedule', values: { ready: readyDay, last: windows[windows.length - 1] ?? 0 } });
  else if (missedWindows > 0) issues.push({ level: 'warning', code: 'missedWindow', resource: 'schedule', values: { ready: readyDay, window: launchDay ?? 0 } });
  if (gauges.downlink.margin < 0) issues.push({ level: 'warning', code: 'downlinkShort', resource: 'downlink', values: { share: Math.round((sendPerDay / Math.max(dataPerDay, 1e-9)) * 100) } });
  for (const r of ['mass', 'power', 'budget', 'downlink'] as const) {
    const x = gauges[r];
    if (x.margin >= 0 && x.margin < LOW_MARGIN) issues.push({ level: 'warning', code: 'lowMargin', resource: r, values: { margin: Math.round(x.margin * 100) } });
  }

  return { picks, orbit, launch, options, settings, tags, gauges, readyDay, launchDay, missedWindows, reserveKUSD, issues };
}

/** True when nothing stops the launch. */
export const canLaunch = (d: DesignState) => !d.issues.some((i) => i.level === 'blocker');

const round = (x: number, digits: number) => Math.round(x * 10 ** digits) / 10 ** digits;
