import { createContext, useContext } from 'react';
import type { Condition, Effect, EventCard, Mission, Outcome } from '../data/types';
import { AGENCIES, type Agency, type AgencyKind } from '../engine/game';
import { fmt, tk, useLang } from '../i18n';

/** Colours and names shared by the forecast, the branch map and the results. */
export const OUTCOME_COLOR: Record<Outcome, string> = {
  fullSuccess: '#4caf50',
  partialSuccess: '#9ccc65',
  objectiveMissed: '#ffb300',
  lostInOps: '#ff7043',
  orbitFailure: '#ef5350',
  launchFailure: '#c62828',
  noLaunch: '#78909c',
};

/** Outcome name, using the mission's own wording where it has one. */
export function useOutcomeName(mission: Mission) {
  const { t, L } = useLang();
  return (o: Outcome) => { const x = mission.outcomeLabels?.[o]; return x ? L(x) : tk(t, `outcome_${o}`); };
}

/** Readable name of a cause key from a run ('solar-flare', 'fail:cdh', 'blocked:overBudget', ...). */
export function useCauseName(mission: Mission) {
  const { t, L } = useLang();
  return (c: string) => {
    const card = mission.events.find((e) => e.id === c);
    if (card) return L(card.name);
    if (c.startsWith('fail:')) return tk(t, `cause_fail_${c.slice(5)}`);
    if (c.startsWith('warn:')) return tk(t, `cause_warn_${c.slice(5)}`);
    if (c.startsWith('blocked:')) { const k = `cause_blocked_${c.slice(8)}`; return tk(t, k) === k ? t.cause_blocked : tk(t, k); }
    // Launch and early failures use the mission's own wording when it has one (e.g. "landing failure").
    const own = c === 'launchFailure' ? mission.outcomeLabels?.launchFailure : c === 'earlyFailure' ? mission.outcomeLabels?.orbitFailure : undefined;
    if (own) return L(own);
    return tk(t, `cause_${c}`);
  };
}

/** One colour and a short mark per agency, used wherever agencies are compared (never colour alone). */
export const AGENCY_COLOR: Record<'player' | 'cautious' | 'balanced' | 'bold', string> = {
  player: '#7fd1ff',
  cautious: '#2ec4b6',
  balanced: '#a78bfa',
  bold: '#f472b6',
};

/** Result marks that do not rely on colour: protected or used = ✓, partly = △, hit or missed = ✕. */
export const RESULT_MARK: Record<string, string> = { protected: '✓', ready: '✓', partial: '△', hit: '✕', missed: '✕' };

/** Plain-language text for a card's conditions and effects, naming the options that meet a condition. */
export function useCardText(mission: Mission) {
  const { t, L } = useLang();
  const outcomeName = useOutcomeName(mission);
  const quote = (names: string[]) => names.map((n) => fmt(t.quoted, { x: n })).join(t.cond_nameSep);
  const cond = (c: Condition): string => {
    switch (c.kind) {
      case 'hasTag': return fmt(t.cond_pick, { names: quote(mission.options.filter((o) => o.tags?.includes(c.tag)).map((o) => L(o.name))) });
      case 'setting': return fmt(t.cond_pick, { names: quote(mission.options.filter((o) => o.kind === 'choice' && (o.settings?.[c.key]?.value ?? -Infinity) >= c.atLeast).map((o) => L(o.name))) });
      case 'margin': return fmt(t.cond_margin, { res: tk(t, `res_${c.resource}`), n: Math.round(c.atLeast * 100) });
      case 'settingAtMost': return fmt(t.cond_pick, { names: quote(mission.options.filter((o) => o.kind === 'choice' && o.settings?.[c.key] !== undefined && o.settings[c.key]!.value <= c.atMost).map((o) => L(o.name))) });
      case 'reserveAtLeast': return fmt(t.cond_reserve, { k: `${c.kUSD.toLocaleString()} ${t.unit_kUSD}` });
      case 'all': return c.of.map(cond).join(t.cond_and);
      case 'any': return c.of.map(cond).join(t.cond_or);
    }
  };
  const effect = (e: Effect): string | null => {
    switch (e.kind) {
      case 'scienceFactor': return fmt(e.factor < 1 ? t.eff_scienceDown : t.eff_scienceUp, { n: Math.round(Math.abs(1 - e.factor) * 100) });
      case 'durationFactor': return fmt(t.eff_duration, { n: Math.round((1 - e.factor) * 100) });
      case 'failChance': return fmt(t.eff_fail, { what: tk(t, `cause_fail_${e.subsystem}`), n: Math.round(e.add * 100) });
      case 'delayDays': return fmt(t.eff_delay, { n: e.days });
      case 'resource': return fmt(t.eff_budget, { k: `${Math.abs(e.delta).toLocaleString()} ${t.unit_kUSD}` });
      case 'missionLost': return fmt(t.eff_lost, { outcome: outcomeName(e.outcome) });
      case 'bonus': return null;
    }
  };
  const effects = (es: Effect[] | undefined) => (es ?? []).map(effect).filter((x): x is string => !!x);
  /** What a card did to one design, as one short line. */
  const resultLine = (card: EventCard, result: string): string => {
    if (result === 'protected') return card.protectedIf ? cond(card.protectedIf) : '';
    if (result === 'partial') return effects(card.partial).join(t.listSep);
    if (result === 'hit') return effects(card.unprotected).join(t.listSep);
    if (result === 'ready') return effects(card.benefit).join(t.listSep);
    return card.readyIf ? fmt(t.res_needed, { x: cond(card.readyIf) }) : '';
  };
  return { cond, effect, effects, resultLine };
}

/** The seats of a game played together; null when playing solo (names then come from the dictionary). */
export const SeatContext = createContext<Agency[] | null>(null);

/** Short mark from a name: its first character, upper case for letters (two letters could read as the AI tag, e.g. "Al"). */
const markOf = (name: string) => {
  const c = [...name.trim()];
  if (!c.length) return '?';
  return c[0]!.toUpperCase();
};

/** Marks for the human seats; a mark that would repeat gets the seat number added. */
export function seatMarks(agencies: Agency[]): Partial<Record<AgencyKind, string>> {
  const out: Partial<Record<AgencyKind, string>> = {};
  const humans = agencies.filter((a) => a.control === 'human');
  for (const a of humans) out[a.id] = markOf(a.name ?? '');
  const base = { ...out };
  for (const a of humans) if (humans.some((b) => b !== a && base[b.id] === base[a.id])) out[a.id] = `${base[a.id]}${AGENCIES.indexOf(a.id) + 1}`;
  return out;
}

/**
 * Names in one place. Solo: the dictionary names (Your agency, Cautious agency…). Together: a human seat's own
 * name, an AI seat's style name with an "AI" tag.
 */
export function useAgencyName() {
  const { t } = useLang();
  const seats = useContext(SeatContext);
  const marks = seats ? seatMarks(seats) : {};
  const seat = (id: AgencyKind) => seats?.find((a) => a.id === id);
  return {
    name: (id: AgencyKind) => { const a = seat(id); return a?.control === 'human' ? a.name ?? fmt(t.defaultPlayerName, { n: AGENCIES.indexOf(id) + 1 }) : tk(t, `agency_${id}`); },
    short: (id: AgencyKind) => { const a = seat(id); return a?.control === 'human' ? marks[id] ?? '?' : tk(t, `agencyShort_${id}`); },
    isAi: (id: AgencyKind) => seat(id)?.control === 'ai',
    /** Playing together (names everywhere, no "you"). */
    multi: !!seats,
    /** A name inside a sentence: a human's name, or "Balanced (AI)" for an AI seat. */
    inText: (id: AgencyKind) => { const a = seat(id); return a?.control === 'human' ? a.name ?? fmt(t.defaultPlayerName, { n: AGENCIES.indexOf(id) + 1 }) : seats ? tk(t, `aiName_${id}`) : tk(t, `agency_${id}`); },
    /** "A and B", "A, B and C" (Japanese 「A、B、C」), with half-width spaces around names in Japanese. */
    list: (ids: AgencyKind[], name: (id: AgencyKind) => string) => {
      const n = ids.map(name);
      return n.length <= 2 ? n.join(t.andSep) : `${n.slice(0, -1).join(t.commaSep)}${t.andLastSep}${n[n.length - 1]}`;
    },
    /** Japanese: a name in a sentence gets half-width spaces around it, but not next to punctuation. */
    spaced: (name: string) => (t.nameSpace ? ` ${name} ` : name),
    tidy: (text: string) => (t.nameSpace ? text.replace(/ +/g, ' ').replace(/ ?([、。：「」（）]) ?/g, '$1').trim() : text),
  };
}

/** The options that can satisfy a condition (directly or as one side of all/any), for naming the picks behind a result. */
export function conditionOptions(m: Mission, c: Condition): string[] {
  switch (c.kind) {
    case 'hasTag': return m.options.filter((o) => o.tags?.includes(c.tag)).map((o) => o.id);
    case 'setting': return m.options.filter((o) => o.kind === 'choice' && (o.settings?.[c.key]?.value ?? -Infinity) >= c.atLeast).map((o) => o.id);
    case 'settingAtMost': return m.options.filter((o) => o.kind === 'choice' && o.settings?.[c.key] !== undefined && o.settings[c.key]!.value <= c.atMost).map((o) => o.id);
    case 'all': case 'any': return c.of.flatMap((x) => conditionOptions(m, x));
    default: return [];
  }
}
