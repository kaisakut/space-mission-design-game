import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { Mission, Resource } from '../data/types';
import { RESOURCES } from '../data/types';
import { aiPicks } from '../engine/ai';
import { completePicks, type Issue, type Picks } from '../engine/design';
import { FORECAST_SEED, liveCauses, type Forecast } from '../engine/forecast';
import { agencyDesign, agencyForecast, changeCost, confirmPhase, newGame, pendingChanges, PHASE_COUNT, type AgencyKind, type Game } from '../engine/game';
import { fmt, tk, useLang } from '../i18n';
import { play } from '../audio/sfx';
import { LOW_MARGIN } from '../engine/design';
import { AutoFit } from './AutoFit';
import { ForecastPanel, NoCauses, RUNS } from './ForecastPanel';
import { Gauges } from './Gauges';
import { MissionView } from './MissionView';
import { AGENCY_COLOR, SeatContext, useCardText, useCauseName } from './labels';
import { Modal } from './Modal';
import { OptionCard, type Diff } from './OptionCard';
import { Briefing } from './Briefing';
import { Icon } from './icons';
import { FinalScreen, TurnReports } from './Reports';
import { AgencyLabel, Resolution } from './Resolution';
import { Tutorial } from './Tutorial';
import { GatherScreen, HandoverScreen, OrderScreen } from './TurnScreens';
import type { PlaySettings } from './TitleScreen';

const PHASES = [1, 2, 3, 4, 5] as const;
const newSeed = () => Math.floor(Math.random() * 1e9);
const fmtDelta = (x: number) => (Math.abs(x) >= 100 ? Math.round(x).toLocaleString() : Math.abs(x) >= 10 ? x.toFixed(0) : x.toFixed(1));

/**
 * The game: one turn per phase. Choose, forecast (once, or freely in practice mode), confirm, then see
 * what happened to all four agencies. The page never scrolls: a bar on top, three columns, a rival strip.
 */
export function GameScreen({ mission, settings, onOver }: { mission: Mission; settings: PlaySettings; onOver?: (over: boolean) => void }) {
  const tutorial = settings.tutorial;
  const { t, L } = useLang();
  const [game, setGame] = useState<Game>(() => newGame(mission, newSeed(), settings.practice, settings.hints, settings.seats));
  // Playing together: each phase shows the order, then each human's turn behind a hand-over screen, then a
  // gather screen; the picks wait here until everyone has decided. Solo play never leaves 'turn'.
  const multi = game.mode === 'multi';
  const [stage, setStage] = useState<'order' | 'handover' | 'turn' | 'gather'>(() => (game.mode === 'multi' ? 'order' : 'turn'));
  const [turnIndex, setTurnIndex] = useState(0);
  const [handed, setHanded] = useState<Partial<Record<AgencyKind, Picks>>>({});
  const [gathered, setGathered] = useState<{ g: Game; phase: number } | null>(null);
  const viewerId: AgencyKind = multi ? game.order[turnIndex] ?? 'player' : 'player';
  const [tab, setTab] = useState(1);
  const [draft, setDraft] = useState<Picks>({});
  const [guide, setGuide] = useState(tutorial);
  // The mission briefing opens first; the guide (if on) starts after it.
  const [brief, setBrief] = useState(true);
  const [mine, setMine] = useState<{ f: Forecast; key: string; phase: number } | null>(null);
  const [resolved, setResolved] = useState<number | null>(null);
  const [askConfirm, setAskConfirm] = useState(false);
  const [allTurns, setAllTurns] = useState(false);
  const [flashSlot, setFlashSlot] = useState<string | null>(null);
  // The open item of the middle column, the items the player has opened, and closed lines to flash briefly.
  const firstSlot = (p: number) => mission.slots.find((x) => x.phase === p)?.id ?? null;
  const [openSlot, setOpenSlot] = useState<string | null>(() => firstSlot(1));
  const [seen, setSeen] = useState<Set<string>>(() => new Set([firstSlot(1) ?? '']));
  const [rowFlash, setRowFlash] = useState<Set<string>>(new Set());
  const openNext = useRef<string | null>(null);
  const [hover, setHover] = useState<{ slot: string; id: string } | null>(null);
  // The hint button: the single change in this phase expected to help most, lit until the design changes.
  const [hinted, setHinted] = useState<{ slot: string; id: string; text: string; key: string } | { none: true; key: string } | null>(null);
  const [hintBusy, setHintBusy] = useState(false);
  // The agency at the screen: seat 1 when playing solo, the human whose turn it is when playing together.
  const player = game.agencies.find((a) => a.id === viewerId)!;
  const working = { ...player.picks, ...draft };
  const pending = useMemo(() => pendingChanges(game, player, working), [game, player, working]);
  const state = useMemo(() => agencyDesign(game, player, working, pending), [game, player, working, pending]);
  const optionById = useMemo(() => new Map(mission.options.map((o) => [o.id, o])), [mission]);
  const standard = useMemo(() => completePicks(mission, {}), [mission]);
  const causeName = useCauseName(mission);
  const over = game.phase > PHASE_COUNT;
  // The header's "back" asks first only while a game is in progress (not on the results screen).
  useEffect(() => { onOver?.(over); }, [over, onOver]);

  // The free baseline: the confirmed design, standard choices for the rest. Its own random stream.
  // The player's forecasts share one seed and stream: an unchanged design gives exactly the baseline's numbers.
  const baseline = useMemo(() => agencyForecast(game, player, player.picks, RUNS, 'baseline', undefined, FORECAST_SEED),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [game.phase, game.agencies, player.id]);
  // Cards that already hit the player: they are history now, not weak points with a chance.
  const cardText = useCardText(mission);
  const past = useMemo(() => game.reports.flatMap((r) => r.cards.map((id) => ({ id, result: r.results[player.id][id] }))).filter((x) => x.result === 'hit' || x.result === 'partial'), [game.reports, player.id]);
  const pastIds = useMemo(() => new Set(past.map((x) => x.id)), [past]);
  const pastLines = past.map((x) => { const card = mission.events.find((e) => e.id === x.id)!; const eff = cardText.resultLine(card, x.result!); return `${L(card.name)}${eff ? ` (${eff})` : ''}`; });
  // The baseline before the last confirmation, and what happened since, for the line under the ring.
  const prevBase = useRef<Partial<Record<AgencyKind, number>>>({});
  const prevPicks = useRef<Partial<Record<AgencyKind, Picks>>>({});
  const designKey = JSON.stringify([working, game.phase]);
  // A new phase opens its first item; a past phase shows every item closed, as a list of what was picked.
  useEffect(() => {
    const want = openNext.current; openNext.current = null;
    if (want) return;
    if (tab === game.phase) { const f = firstSlot(tab); setOpenSlot(f); if (f) setSeen((x) => new Set(x).add(f)); }
    else setOpenSlot(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, game.phase]);
  // If the open item does not fit, its cards first show only two comparison bars (the rest are under "i");
  // only then does the item scroll. Text is never shrunk.
  const [tight, setTight] = useState(false);
  useLayoutEffect(() => {
    const el = document.querySelector<HTMLElement>('.slot.open .opts');
    if (!el) return;
    if (!tight && el.scrollHeight > el.clientHeight + 2) setTight(true);
  });
  useEffect(() => { setTight(false); }, [openSlot, tab]);
  useEffect(() => {
    const again = () => setTight(false);
    window.addEventListener('resize', again);
    return () => window.removeEventListener('resize', again);
  }, []);
  // When a pick changes another item (or what blocks the launch), its closed line flashes briefly.
  const lastPicks = useRef<{ picks: Picks; open: string | null } | null>(null);
  useEffect(() => {
    const prev = lastPicks.current;
    lastPicks.current = { picks: state.picks, open: openSlot };
    if (!prev) return;
    const moved = mission.slots.filter((sl) => sl.phase === tab && sl.id !== openSlot && (prev.picks[sl.id] ?? []).join('|') !== (state.picks[sl.id] ?? []).join('|')).map((sl) => sl.id);
    if (!moved.length) return;
    setRowFlash(new Set(moved));
    const id = window.setTimeout(() => setRowFlash(new Set()), 1200);
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [designKey]);
  const myForecast = mine && mine.phase === game.phase ? mine : null;
  const stale = !!myForecast && myForecast.key !== designKey;
  const forecastsLeft = game.practice ? null : Math.max(0, 1 - game.forecastsUsed[player.id]);
  const canForecast = forecastsLeft === null || forecastsLeft > 0;

  // Gauges that just changed glow for a moment.
  const prevGauges = useRef(state.gauges);
  const [flash, setFlash] = useState<Resource[]>([]);
  useEffect(() => {
    const changed = RESOURCES.filter((r) => Math.abs(prevGauges.current[r].used - state.gauges[r].used) > 1e-9 || Math.abs(prevGauges.current[r].available - state.gauges[r].available) > 1e-9);
    prevGauges.current = state.gauges;
    if (!changed.length) return;
    setFlash(changed);
    const id = setTimeout(() => setFlash([]), 450);
    return () => clearTimeout(id);
  }, [state.gauges]);


  const nextDraft = (slotId: string, optionId: string, multi?: { min: number; max: number; noneFirst?: boolean }): Picks => {
    const slot = mission.slots.find((s) => s.id === slotId)!;
    const cur = state.picks[slotId] ?? [];
    let ids: string[];
    if (!multi) ids = [optionId];
    else {
      // With noneFirst, the first option means "none" and clears the others.
      const none = multi.noneFirst ? slot.options[0]! : null;
      if (optionId === none) ids = [none];
      else {
        const without = cur.filter((x) => x !== none);
        // At the limit, another pick does nothing (the card is shown as unavailable); one has to be cleared first.
        const next = without.includes(optionId) ? without.filter((x) => x !== optionId) : without.length >= multi.max ? without : [...without, optionId];
        ids = next.length >= Math.max(multi.min, 1) ? next : none ? [none] : cur;
      }
    }
    const next: Picks = { ...draft, [slotId]: ids };
    // Changing the orbit: keep the launch valid by switching to one that reaches the new orbit.
    const chosen = optionById.get(optionId);
    if (chosen?.kind === 'orbit') {
      const launchSlot = mission.slots.find((x) => x.options.some((id) => optionById.get(id)?.kind === 'launch'));
      const curLaunch = launchSlot ? optionById.get((state.picks[launchSlot.id] ?? [])[0] ?? '') : undefined;
      if (launchSlot && launchSlot.phase <= game.phase && curLaunch?.kind === 'launch' && !curLaunch.capacityKg[optionId]) {
        const ok = launchSlot.options.find((id) => { const l = optionById.get(id); return l?.kind === 'launch' && !!l.capacityKg[optionId]; });
        if (ok) next[launchSlot.id] = [ok];
      }
    }
    return next;
  };
  const pick = (slotId: string, optionId: string, multi?: { min: number; max: number; noneFirst?: boolean }) => {
    const next = nextDraft(slotId, optionId, multi);
    // Sound: a click, or a warning when a margin turns yellow or red, or a double buzz when the launch is now blocked.
    const d = agencyDesign(game, player, { ...player.picks, ...next }, pending);
    const blocked = (x: typeof d) => x.issues.some((i) => i.level === 'blocker');
    const tight = (x: typeof d) => RESOURCES.filter((r) => x.gauges[r].margin < LOW_MARGIN).length;
    play(blocked(d) && !blocked(state) ? 'block' : tight(d) > tight(state) ? 'warn' : 'select');
    setDraft(next);
    setHinted(null);
  };

  const runForecast = () => {
    if (!canForecast) return;
    // Same random stream as the baseline, so the difference shows the design change, not noise.
    const f = agencyForecast(game, player, working, RUNS, 'baseline', pending, FORECAST_SEED);
    setGame({ ...game, forecastsUsed: { ...game.forecastsUsed, [player.id]: game.forecastsUsed[player.id] + 1 } });
    setMine({ f, key: designKey, phase: game.phase });
    play('forecastRun');
    const d = f.successShare - baseline.successShare;
    if (Math.abs(d) >= 0.02) play(d > 0 ? 'forecastUp' : 'forecastDown', 1.2);
  };
  const doConfirm = () => {
    if (multi) { passOn(); return; }
    // Confirming a phase ends the guide (it never carries over into the next phase).
    setGuide(false);
    const picks = {} as Record<AgencyKind, Picks>;
    for (const a of game.agencies) picks[a.id] = a.id === 'player' ? working : aiPicks(game, a);
    const phase = game.phase;
    prevBase.current = { ...prevBase.current, [player.id]: baseline.successShare };
    prevPicks.current = { ...prevPicks.current, [player.id]: player.picks };
    play('confirm');
    const g = confirmPhase(game, picks);
    setGame(g);
    setDraft({});
    setMine(null);
    setAskConfirm(false);
    setTab(Math.min(g.phase, PHASE_COUNT));
    if (g.phase <= PHASE_COUNT) setResolved(phase);
  };
  // Playing together. A turn starts clean: nothing of the previous person's work is left on screen.
  const beginTurn = () => {
    const f = firstSlot(game.phase);
    setDraft({}); setMine(null); setHinted(null); setHover(null); setFlashSlot(null); setAskConfirm(false); setAllTurns(false);
    openNext.current = null;
    setTab(game.phase); setOpenSlot(f); setSeen(new Set([f ?? '']));
    setStage('turn');
    play('ui');
  };
  // "Lock in": the picks wait (the engine sees nothing yet); the next person, or the gather screen.
  const passOn = () => {
    prevBase.current = { ...prevBase.current, [player.id]: baseline.successShare };
    prevPicks.current = { ...prevPicks.current, [player.id]: player.picks };
    const all = { ...handed, [player.id]: working };
    setHanded(all);
    setAskConfirm(false);
    play('confirm');
    if (turnIndex + 1 < game.order.length) { setTurnIndex(turnIndex + 1); setStage('handover'); return; }
    // Everyone has decided: the AI seats decide now, from the state at the start of the phase, then all at once.
    setStage('gather');
    setGathered(null);
    window.setTimeout(() => {
      const picks = {} as Record<AgencyKind, Picks>;
      for (const a of game.agencies) picks[a.id] = a.control === 'human' ? all[a.id] ?? {} : aiPicks(game, a);
      setGathered({ g: confirmPhase(game, picks), phase: game.phase });
    }, 30);
  };
  const showGathered = () => {
    if (!gathered) return;
    const { g, phase } = gathered;
    setGame(g); setHanded({}); setGathered(null); setTurnIndex(0); setDraft({}); setMine(null);
    setTab(Math.min(g.phase, PHASE_COUNT));
    if (g.phase <= PHASE_COUNT) setResolved(phase);
    play('ui');
  };
  // Try every other option of this phase's boxes once with the same forecast, and light the one that does
  // most for the expected score (success counts too). Runs in the next tick so the button can show it is working.
  const showHint = () => {
    setHintBusy(true);
    setGame((g) => ({ ...g, hintsUsed: { ...g.hintsUsed, [player.id]: g.hintsUsed[player.id] + 1 } }));
    setTimeout(() => {
      // The same runs and stream as the forecast panel, so the hint's numbers match a forecast of the same design.
      const runs = RUNS;
      const value = (f: Forecast) => f.score.p50 + 20 * f.successShare;
      const now = agencyForecast(game, player, working, runs, 'baseline', pending, FORECAST_SEED);
      let best: { slot: string; id: string; f: Forecast } | null = null;
      for (const s of mission.slots.filter((x) => x.phase === game.phase)) {
        if (changeCost(mission, player, s.id, ['__probe__'], game.phase).locked) continue;
        for (const id of s.options) {
          if ((state.picks[s.id] ?? []).includes(id)) continue;
          const alt = { ...player.picks, ...nextDraft(s.id, id, s.multi) };
          const altPending = pendingChanges(game, player, alt);
          const d = agencyDesign(game, player, alt, altPending);
          if (d.issues.some((i) => i.level === 'blocker')) continue;
          const f = agencyForecast(game, player, alt, runs, 'baseline', altPending, FORECAST_SEED);
          if (!best || value(f) > value(best.f)) best = { slot: s.id, id, f };
        }
      }
      if (best && value(best.f) > value(now) + 0.5) {
        const pct = (x: number) => Math.round(x * 100);
        setHinted({ slot: best.slot, id: best.id, key: designKey, text: fmt(t.hintText, { a: pct(now.successShare), b: pct(best.f.successShare), s: now.score.p50, s2: best.f.score.p50 }) });
        openItem(best.slot, game.phase);
        setFlashSlot(best.slot);
        setTimeout(() => setFlashSlot(null), 1200);
      } else setHinted({ none: true, key: designKey });
      setHintBusy(false);
      play('select');
    }, 30);
  };
  // Items of this phase never opened: named before confirming (it does not stop the player).
  const unseen = mission.slots.filter((sl) => sl.phase === game.phase && !seen.has(sl.id) && mission.slots.filter((x) => x.phase === game.phase).length > 1);
  const confirm = () => ((game.forecastsUsed[player.id] === 0 && !myForecast) || unseen.length ? setAskConfirm(true) : doConfirm());
  const restart = (seed = newSeed()) => {
    const g = { ...newGame(mission, seed, game.practice, game.hints, settings.seats), ...(seed === game.seed ? { sameEvents: true } : {}) };
    setGame(g); setDraft({}); setMine(null); setTab(1);
    setStage(g.mode === 'multi' ? 'order' : 'turn'); setTurnIndex(0); setHanded({}); setGathered(null);
  };

  const issueText = (i: Issue) => {
    const values: Record<string, string | number> = { ...i.values, res: i.resource ? tk(t, `res_${i.resource}`) : '' };
    for (const k of ['launch', 'orbit'] as const) { const o = optionById.get(String(values[k] ?? '')); if (o) values[k] = L(o.name); }
    return fmt(tk(t, `issue_${i.code}`), values);
  };
  const blockers = state.issues.filter((i) => i.level === 'blocker');
  // A gauge with little margin is listed whatever it is. The schedule's low margin is shown here only: the engine
  // does not count it as a warning (that would change the runs; it belongs to the data and balance work).
  const sched = state.gauges.schedule;
  const schedLow: Issue[] = sched.margin >= 0 && sched.margin < LOW_MARGIN && !state.issues.some((i) => i.resource === 'schedule')
    ? [{ level: 'warning', code: 'lowMargin', resource: 'schedule', values: { margin: Math.round(sched.margin * 100) } }] : [];
  const warnings = [...state.issues.filter((i) => i.level === 'warning'), ...schedLow];

  // Weak points: the most common causes in the forecast shown, with a jump to a decision that protects against them.
  const shown = myForecast?.f ?? baseline;
  const fixSlot = (cause: string) => {
    const card = mission.events.find((e) => e.id === cause);
    const cond = card?.protectedIf ?? card?.partialIf ?? card?.readyIf;
    if (!cond) return null;
    const tags: string[] = [], keys: string[] = [];
    const walk = (c: typeof cond): void => { if (c.kind === 'hasTag') tags.push(c.tag); else if (c.kind === 'setting' || c.kind === 'settingAtMost') keys.push(c.key); else if (c.kind === 'all' || c.kind === 'any') c.of.forEach(walk); };
    walk(cond);
    return mission.slots.find((s) => s.phase <= game.phase && s.options.some((id) => {
      const o = optionById.get(id)!;
      return o.tags?.some((x) => tags.includes(x)) || (o.kind === 'choice' && Object.keys(o.settings ?? {}).some((k) => keys.includes(k)));
    })) ?? null;
  };
  // Open one item (and close the others). From another phase, it opens once that phase is shown.
  const openItem = (slotId: string, phase = tab) => {
    if (phase !== tab) { openNext.current = slotId; setTab(phase); }
    setOpenSlot(slotId);
    setSeen((x) => (x.has(slotId) ? x : new Set(x).add(slotId)));
    play('ui');
  };
  const jump = (slotId: string, phase: number) => {
    openItem(slotId, phase);
    setFlashSlot(slotId);
    setTimeout(() => setFlashSlot(null), 1200);
  };
  // Items that guard against a weak point shown on the left, and items behind a launch blocker.
  // The weak points on the left, the "helps a weak point" marks in the middle and on the options: one list.
  const weak = liveCauses(shown, pastIds);
  const weakCards = new Set(weak.map(([c]) => c));
  const weakSlots = new Set(weak.map(([c]) => fixSlot(c)?.id).filter((x): x is string => !!x));
  const blockSlots = new Set(blockers.flatMap((i) => ['launch', 'orbit'].map((k) => String(i.values[k] ?? '')))
    .flatMap((id) => mission.slots.filter((sl) => sl.options.includes(id)).map((sl) => sl.id)));

  // What changes if this option is picked instead: gauge differences and anything that would stop the launch.
  const preview = (slotId: string, optionId: string, multi?: { min: number; max: number; noneFirst?: boolean }): { diffs: Diff[]; blocks?: string } => {
    const alt = { ...player.picks, ...nextDraft(slotId, optionId, multi) };
    const d = agencyDesign(game, player, alt, pending);
    const diffs: Diff[] = [];
    const add = (res: Resource, used: boolean, label: string, unit: string) => {
      const g0 = state.gauges[res], g1 = d.gauges[res];
      const x = used ? g1.used - g0.used : g1.available - g0.available;
      if (fmtDelta(Math.abs(x)).replace(/[0.,]/g, '') === '') return;
      const good = used ? x < 0 : x > 0;
      diffs.push({ text: `${label} ${x > 0 ? '+' : '−'}${fmtDelta(Math.abs(x))}${unit}`, good });
    };
    add('mass', true, t.res_mass, ' kg'); add('power', false, t.diff_powerGen, ' W'); add('power', true, t.diff_powerUse, ' W');
    add('budget', true, t.res_budget, ` ${t.unit_kUSD}`); add('downlink', false, t.diff_canSend, ` ${t.unit_MBday}`); add('downlink', true, t.diff_data, ` ${t.unit_MBday}`);
    const now = new Set(state.issues.filter((i) => i.level === 'blocker').map((i) => i.code));
    const fresh = d.issues.filter((i) => i.level === 'blocker' && !now.has(i.code));
    return { diffs, blocks: fresh.length ? fmt(t.pickBlocks, { x: fresh.map(issueText).join(t.listSep) }) : undefined };
  };

  // The design if the option under the pointer were picked: the mission view draws it faintly.
  const hoverSlot = hover ? mission.slots.find((s) => s.id === hover.slot) : undefined;
  const ghost = useMemo(() => (hover && hoverSlot ? agencyDesign(game, player, { ...player.picks, ...nextDraft(hover.slot, hover.id, hoverSlot.multi) }, pending) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [hover, game, draft]);

  const lastReport = game.reports[game.reports.length - 1];
  // Playing together, from phase 2: each agency's forecast rank (as in the last results scene) beside the order.
  const forecastRanks = useMemo(() => {
    if (!multi || game.phase < 2 || game.final) return null;
    const st = game.agencies.map((a) => ({ id: a.id, score: agencyForecast(game, a, a.picks, 60, 'standing').score.p50 })).sort((x, y) => y.score - x.score);
    // Equal scores (to one decimal) share a place: 1, 2, 2, 4.
    return Object.fromEntries(st.map((x) => [x.id, 1 + st.filter((y) => Math.round(y.score * 10) > Math.round(x.score * 10)).length])) as Record<AgencyKind, number>;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game.phase, game.agencies]);
  // Names for labels: the seats when playing together (solo keeps the dictionary names).
  const seats = multi ? game.agencies : null;
  const agencyName = (id: AgencyKind) => { const a = game.agencies.find((x) => x.id === id); return multi && a?.control === 'human' ? a.name ?? fmt(t.defaultPlayerName, { n: game.agencies.indexOf(a) + 1 }) : tk(t, `agency_${id}`); };
  // Why the baseline moved since the last confirmation. Only reasons that point the way it moved are named:
  // your own changes (measured on the same runs), cards that hit (down) or were avoided (up), risks that did not come.
  const wasNote = useMemo(() => {
    const was = prevBase.current[player.id] ?? null;
    if (was === null || !lastReport || Math.round(was * 100) === Math.round(baseline.successShare * 100)) return null;
    const up = baseline.successShare > was;
    const why: string[] = [];
    // What the player changed from the auto-plan in the last phase always comes first; then the events.
    const changed = mission.slots.filter((s) => s.phase === lastReport.phase)
      .flatMap((s) => (player.picks[s.id] ?? []).filter((id) => !(standard[s.id] ?? []).includes(id)))
      .map((id) => L(optionById.get(id)!.name));
    if (changed.length) why.push(fmt(t.wasYouChose, { list: changed.join(t.listSep) }));
    const res = lastReport.cards.map((id) => ({ id, r: lastReport.results.player[id]! }));
    const fit = res.filter(({ r }) => (up ? r === 'protected' || r === 'ready' : r === 'hit' || r === 'partial' || r === 'missed'));
    why.push(...fit.map(({ id, r }) => fmt(tk(t, `was_${r}`), { name: L(mission.events.find((e) => e.id === id)!.name) })));
    // "Nothing happened" only when nothing was changed and no event came.
    if (up && !res.some(({ r }) => r === 'hit' || r === 'partial') ) { if (!why.length && !res.length) why.push(t.wasNoCards); }
    else if (up && why.length === 0) why.push(t.wasAvoided);
    return why.length ? fmt(t.wasBaseline, { n: Math.round(was * 100), why: why.join(t.listSep) }) : fmt(t.wasOnly, { n: Math.round(was * 100) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [baseline]);

  if (over && game.final) {
    return <SeatContext.Provider value={seats}><div className="final-wrap"><FinalScreen game={game} onRestart={() => restart()} onReplaySame={() => restart(game.seed)} /></div></SeatContext.Provider>;
  }

  const forecastFirst = canForecast && (!myForecast || stale);
  const step = !myForecast || stale ? 2 : 3;
  const forecastBtn = <button type="button" data-tour="forecastBtn" className={forecastFirst ? 'primary' : 'secondary'} disabled={!canForecast} onClick={runForecast}>{fmt(t.runForecast, { n: RUNS })}</button>;
  const lockLabel = multi ? (turnIndex + 1 < game.order.length ? t.passOn : t.passLast) : game.phase < PHASE_COUNT ? fmt(t.confirmPhaseN, { n: game.phase }) : t.confirmLast;
  const confirmBtn = <button type="button" className={forecastFirst ? 'secondary' : 'primary'} onClick={confirm}>{lockLabel}</button>;

  // Playing together: the order, hand-over and gather screens, and the shared scenes, cover everything else.
  if (multi && (stage !== 'turn' || resolved !== null)) {
    return (
      <SeatContext.Provider value={seats}>
        <div className="game">
          {resolved !== null
            ? <Resolution game={game} phase={resolved} onClose={() => { setResolved(null); setStage('order'); setTurnIndex(0); }} />
            : stage === 'order' ? <OrderScreen phase={game.phase} order={game.order} ranks={forecastRanks} ais={game.agencies.filter((a) => a.control === 'ai').map((a) => a.id)} ready={!brief} onGo={() => { setTurnIndex(0); setStage('handover'); }} />
              : stage === 'handover' ? <HandoverScreen id={viewerId} i={turnIndex + 1} n={game.order.length} onStart={beginTurn} />
                : <GatherScreen ready={!!gathered} onGo={showGathered} />}
          {brief && <Briefing mission={mission} game={game} onClose={() => setBrief(false)} />}
        </div>
      </SeatContext.Provider>
    );
  }

  const name = <button type="button" className="link-btn turn-name" title={t.briefOpen} onClick={() => setBrief(true)}><b>{L(mission.name)}</b> <span className="info-btn" aria-hidden>i</span></button>;
  return (
    <SeatContext.Provider value={seats}>
    <div className={`game ${multi ? 'turn-multi' : ''}`} style={multi ? { ['--seat' as string]: AGENCY_COLOR[player.id] } : undefined}>
      <div className="turnbar">
        <div className="turn-title" title={L(mission.summary)}>
          {/* A replay with the same events says so beside the mission name. */}
          {game.sameEvents ? <span className="turn-name-row">{name}<span className="tag-setting">{t.tagSameEvents}</span></span> : name}
          {game.practice && <span className="tag-practice">{t.tagPractice}</span>}
          {multi && <span className="turn-of"><span className="seat-dot" style={{ background: AGENCY_COLOR[player.id] }} aria-hidden />{fmt(t.turnOf, { name: agencyName(player.id) })}<span className="note small turn-pos">{fmt(t.turnPosition, { i: turnIndex + 1, n: game.order.length })}</span></span>}
          <span className="note">{fmt(t.turnTitle, { n: game.phase, total: PHASE_COUNT, name: tk(t, `phase${game.phase}`) })}</span>
        </div>
        <ol className="progress" role="tablist">
          {PHASES.map((p) => (
            <li key={p} className={`${p < game.phase ? 'done' : ''} ${p === game.phase ? 'now' : ''} ${p === tab ? 'viewing' : ''}`}>
              <button type="button" role="tab" aria-selected={tab === p} disabled={p > game.phase} onClick={() => setTab(p)}>
                <span className="pg-dot">{p < game.phase ? '✓' : p}</span>
                <span className="pg-name">{tk(t, `phase${p}`)}</span>
              </button>
            </li>
          ))}
        </ol>
        <ol className="steps" aria-label={t.turnHelp}>
          {[t.stepChoose, t.stepForecast, t.stepConfirm].map((x, i) => <li key={x} className={i + 1 === step ? 'now' : i + 1 < step ? 'done' : ''}>{['①', '②', '③'][i]} {x}</li>)}
        </ol>
        <div className="turn-actions" data-tour="confirm">
          {!over && game.hints && <button type="button" className="secondary hint-btn" onClick={showHint} disabled={hintBusy} title={t.hintHelp}>💡 {hintBusy ? t.hintBusy : t.hintButton}</button>}
          {hinted && 'none' in hinted && hinted.key === designKey && <span className="hint-none">{t.hintNone}</span>}
          {forecastBtn}{confirmBtn}
        </div>
      </div>
      <div className="game-body">
        <div className={`col col-left ${mission.view ? 'with-view' : ''}`}>
        {mission.view && <div className="mv-wrap" data-tour="view"><MissionView mission={mission} state={state} ghost={ghost} /></div>}
        <AutoFit className="left-rest" data-tour="gauges" min={0.75}>
          <Gauges gauges={state.gauges} flash={flash} />
          {pending.kUSD > 0 && <p className="warn small">{fmt(t.pendingChange, { k: pending.kUSD.toLocaleString(), d: pending.days })}</p>}
          {player.changeKUSD > 0 && <p className="note small">{fmt(t.paidChanges, { k: player.changeKUSD.toLocaleString() })}</p>}
          <div className="issues">
            {blockers.length > 0 && <><h3 className="bad">{t.blockers}</h3><ul>{blockers.map((i, k) => <li key={k}>{issueText(i)}</li>)}</ul></>}
            {warnings.length > 0 && <><h3 className="warn">{t.warnings}</h3><ul>{warnings.map((i, k) => <li key={k}>{issueText(i)}</li>)}</ul></>}
            {!blockers.length && !warnings.length && <p className="ok">{t.noIssues}</p>}
          </div>
          <div className="weak" data-tour="weak">
            <h3>{t.weakPoints}</h3>
            {weak.length === 0 ? <NoCauses mission={mission} f={shown} /> : (
              <ul>
                {weak.map(([c, share]) => {
                  const s = fixSlot(c);
                  // Against the baseline: more often, less often, or new with this design.
                  const before = baseline.topCauses.find(([k]) => k === c)?.[1];
                  const mark = !myForecast ? null : before === undefined ? <span className="bad small"> {t.causeNew}</span> : share > before + 0.02 ? <span className="bad"> ↑</span> : share < before - 0.02 ? <span className="ok"> ↓</span> : null;
                  return (
                    <li key={c}>
                      {s ? <button type="button" className="link-btn" title={t.weakJump} onClick={() => jump(s.id, s.phase)}>{causeName(c)} → {L(s.label)}</button> : causeName(c)}
                      <span className="note"> {Math.round(share * 100)}%</span>{mark}
                    </li>
                  );
                })}
              </ul>
            )}
            {pastLines.length > 0 && <div className="note small already"><b>{t.alreadyHappened}</b> {pastLines.join(t.listSep)}</div>}
          </div>
        </AutoFit>
        </div>
        <div className="col col-center accordion" data-tour="options">
          {tab < game.phase && <p className="note">{t.pastPhaseNote}</p>}
          {(() => {
            // One item open at a time, using the column; the others fold to one line each (no text shrinking).
            const here = mission.slots.filter((s) => s.phase === tab);
            const single = here.length === 1;
            return here.map((s, idx) => {
              const locked = changeCost(mission, player, s.id, ['__probe__'], game.phase).locked;
              const picks = state.picks[s.id] ?? [];
              const changed = picks.join('|') !== (standard[s.id] ?? []).join('|');
              const isOpen = single || openSlot === s.id;
              const weakHere = weakSlots.has(s.id);
              const blocked = blockSlots.has(s.id);
              if (!isOpen) {
                const names = picks.map((id) => L(optionById.get(id)!.name));
                const shownNames = names.length > 2 ? `${names.slice(0, 2).join(t.commaSep)}${fmt(t.andMore, { n: names.length - 2 })}` : names.join(t.commaSep);
                const looked = seen.has(s.id) || tab < game.phase;
                return (
                  <button key={s.id} type="button" aria-expanded={false} data-tour="folded"
                    className={`item-row ${blocked ? 'blocked' : ''} ${rowFlash.has(s.id) || flashSlot === s.id ? 'flash' : ''}`}
                    onClick={() => openItem(s.id)}>
                    <span className="ir-mark" aria-hidden>{weakHere ? '⚠' : looked ? '✓' : ''}</span>
                    {s.icon && <Icon name={s.icon} size="1.15em" className="ir-ico" />}
                    <span className="ir-label">{L(s.label)}</span>
                    <span className="ir-pick">{shownNames}</span>
                    {weakHere && <span className="ir-weak">{t.itemHelpsWeak}</span>}
                    <span className={`ir-tag ${changed ? 'changed' : ''}`}>{changed ? t.itemChanged : t.itemAuto}</span>
                  </button>
                );
              }
              const n = s.options.length;
              // Up to three options: one full-width card each (two columns inside). More: two columns at most; five or
              // more scroll inside the item, so names and descriptions keep two lines each.
              const wideCards = n <= 3;
              const cols = wideCards ? 1 : 2;
              const next = here[idx + 1];
              // A multiple choice at its limit: the other cards are unavailable until one is cleared.
              const chosen = (state.picks[s.id] ?? []).filter((x) => !(s.multi?.noneFirst && x === s.options[0]));
              const full = !!s.multi && chosen.length >= s.multi.max;
              return (
                <fieldset key={s.id} className={`slot open ${tight && n < 5 ? 'tight' : ''} ${n >= 5 ? 'many' : ''} ${flashSlot === s.id ? 'flash' : ''}`} style={{ ['--cols' as string]: cols }}>
                  <legend>
                    <span className="lg-row">
                      {s.icon && <Icon name={s.icon} size="1.15em" className="lg-ico" />}
                      <span className="lg-text">{L(s.ask ?? s.label)}</span>
                      <span className="lg-line" aria-hidden="true" />
                      {!single && <span className="item-of note">{fmt(t.itemOf, { n: idx + 1, total: here.length })}</span>}
                    </span>
                  </legend>
                  <p className="note">{L(s.help)}{s.multi ? ` ${fmt(t.pickUpTo, { n: s.multi.max })}` : ''}{full && <span className="warn small pick-full"> {fmt(t.pickFull, { n: s.multi!.max })}</span>}</p>
                  {locked && <p className="warn small">{t.lockedAfterLaunch}</p>}
                  <div className="opts">
                    {s.options.map((id) => {
                      const o = optionById.get(id)!;
                      const selected = (state.picks[s.id] ?? []).includes(id);
                      const isNone = !!s.multi?.noneFirst && id === s.options[0];
                      const wrongOrbit = o.kind === 'launch' && state.orbit !== null && !o.capacityKg[state.orbit.id];
                      const c = selected ? null : changeCost(mission, player, s.id, [id], game.phase);
                      const pv = selected || wrongOrbit || locked ? null : preview(s.id, id, s.multi);
                      return (
                        <OptionCard
                          key={id}
                          option={o} selected={selected} disabled={wrongOrbit || locked || (full && !selected && !isNone)}
                          type={s.multi ? 'checkbox' : 'radio'} name={s.id} orbitId={state.orbit?.id ?? null} solar={state.orbit?.solarFactor?.value}
                          standard={(standard[s.id] ?? []).includes(id)}
                          slot={s} peers={s.options.map((x) => optionById.get(x)!)} view={mission.view}
                          diffs={pv?.diffs} blocks={pv?.blocks}
                          reason={wrongOrbit ? t.cannotReachOrbit : undefined}
                          hint={c && c.kUSD > 0 && !locked ? fmt(t.changeCostHint, { k: c.kUSD.toLocaleString(), d: c.days }) : undefined}
                          events={mission.events}
                          weak={weakCards}
                          wide={wideCards}
                          hinted={!!hinted && 'slot' in hinted && hinted.key === designKey && hinted.slot === s.id && hinted.id === id}
                          hintText={hinted && 'slot' in hinted ? hinted.text : undefined}
                          onPick={() => pick(s.id, id, s.multi)}
                          onHover={(on) => setHover(on ? { slot: s.id, id } : null)}
                        />
                      );
                    })}
                  </div>
                  {tab === game.phase && !over && (
                    <div className="item-next">
                      {next
                        ? <button type="button" className="secondary" data-tour="nextItem" onClick={() => openItem(next.id)}>{t.nextItem} ▶</button>
                        : canForecast
                          ? <button type="button" className="primary" onClick={runForecast}>{fmt(t.runForecast, { n: RUNS })} ▶</button>
                          : <button type="button" className="primary" onClick={confirm}>{lockLabel}</button>}
                    </div>
                  )}
                </fieldset>
              );
            });
          })()}
        </div>
        <AutoFit className="col col-right" data-tour="forecast" min={0.8}>
          <ForecastPanel mission={mission} baseline={baseline} mine={myForecast?.f ?? null} stale={stale} left={forecastsLeft} pastIds={pastIds}
            wasNote={wasNote} />
        </AutoFit>
      </div>
      <button type="button" className="rival-strip" onClick={() => setAllTurns(true)} disabled={!game.reports.length} title={t.showAllReports}>
        <span className="note">{t.rivalsTitle}</span>
        {game.agencies.filter((a) => a.id !== player.id).map((a) => {
          const used = Math.round((agencyDesign(game, a).gauges.budget.used / Math.max(mission.budgetKUSD.value, 1)) * 100);
          const recent = lastReport ? mission.slots.filter((s) => s.phase === lastReport.phase).flatMap((s) => (a.picks[s.id] ?? []).filter((id) => !(standard[s.id] ?? []).includes(id))) : [];
          return (
            <span key={a.id} className="rival">
              <AgencyLabel id={a.id} />
              <span className="rival-bar"><span style={{ width: `${Math.min(100, used)}%` }} /></span>
              <span className="note small">{fmt(t.rivalBudget, { n: used })}{recent[0] ? ` · ${L(optionById.get(recent[0])!.name)}` : ''}</span>
            </span>
          );
        })}
        {game.reports.length > 0 && <span className="note small rival-more">⤢ {t.showAllReports}</span>}
      </button>
      {askConfirm && (
        <Modal title={game.forecastsUsed[player.id] === 0 && !myForecast ? t.noForecastTitle : t.confirmCheckTitle} onClose={() => setAskConfirm(false)}>
          {game.forecastsUsed[player.id] === 0 && !myForecast && <p>{t.noForecastBody}</p>}
          {unseen.length > 0 && <p>{fmt(t.notSeenYet, { list: unseen.map((sl) => L(sl.label)).join(t.commaSep) })}</p>}
          <div className="mission-actions">
            {canForecast && (!myForecast || stale) && <button type="button" className="primary" onClick={() => { setAskConfirm(false); runForecast(); }}>{fmt(t.runForecast, { n: RUNS })}</button>}
            <button type="button" className="secondary" onClick={doConfirm}>{t.confirmAnyway}</button>
          </div>
        </Modal>
      )}
      {resolved !== null && <Resolution game={game} phase={resolved} onClose={() => setResolved(null)} />}
      {allTurns && <Modal title={t.reportsTitle} wide onClose={() => setAllTurns(false)}><TurnReports game={game} heading={false} viewer={player.id} /></Modal>}
      {brief && <Briefing mission={mission} game={game} onClose={() => setBrief(false)} />}
      {guide && !brief && !multi && <Tutorial mission={mission} onClose={() => setGuide(false)} />}
    </div>
    </SeatContext.Provider>
  );
}
