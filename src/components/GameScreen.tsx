import { useEffect, useMemo, useRef, useState } from 'react';
import type { Mission, Resource } from '../data/types';
import { RESOURCES } from '../data/types';
import { aiPicks } from '../engine/ai';
import { completePicks, type Issue, type Picks } from '../engine/design';
import type { Forecast } from '../engine/forecast';
import { agencyDesign, agencyForecast, changeCost, confirmPhase, newGame, pendingChanges, PHASE_COUNT, type AgencyKind, type Game } from '../engine/game';
import { fmt, tk, useLang } from '../i18n';
import { play } from '../audio/sfx';
import { LOW_MARGIN } from '../engine/design';
import { AutoFit } from './AutoFit';
import { ForecastPanel, RUNS } from './ForecastPanel';
import { Gauges } from './Gauges';
import { MissionView } from './MissionView';
import { useCauseName } from './labels';
import { Modal } from './Modal';
import { OptionCard, type Diff } from './OptionCard';
import { FinalScreen, TurnReports } from './Reports';
import { AgencyLabel, Resolution } from './Resolution';
import { Tutorial } from './Tutorial';

const PHASES = [1, 2, 3, 4, 5] as const;
const newSeed = () => Math.floor(Math.random() * 1e9);
const fmtDelta = (x: number) => (Math.abs(x) >= 100 ? Math.round(x).toLocaleString() : Math.abs(x) >= 10 ? x.toFixed(0) : x.toFixed(1));

/**
 * The game: one turn per phase. Choose, forecast (once, or freely in practice mode), confirm, then see
 * what happened to all four agencies. The page never scrolls: a bar on top, three columns, a rival strip.
 */
export function GameScreen({ mission, tutorial = false }: { mission: Mission; tutorial?: boolean }) {
  const { t, L } = useLang();
  const [game, setGame] = useState<Game>(() => newGame(mission, newSeed()));
  const [tab, setTab] = useState(1);
  const [draft, setDraft] = useState<Picks>({});
  const [guide, setGuide] = useState(tutorial);
  const [mine, setMine] = useState<{ f: Forecast; key: string; phase: number } | null>(null);
  const [resolved, setResolved] = useState<number | null>(null);
  const [askConfirm, setAskConfirm] = useState(false);
  const [allTurns, setAllTurns] = useState(false);
  const [flashSlot, setFlashSlot] = useState<string | null>(null);
  const [hover, setHover] = useState<{ slot: string; id: string } | null>(null);
  const player = game.agencies.find((a) => a.id === 'player')!;
  const working = { ...player.picks, ...draft };
  const pending = useMemo(() => pendingChanges(game, player, working), [game, player, working]);
  const state = useMemo(() => agencyDesign(game, player, working, pending), [game, player, working, pending]);
  const optionById = useMemo(() => new Map(mission.options.map((o) => [o.id, o])), [mission]);
  const standard = useMemo(() => completePicks(mission, {}), [mission]);
  const causeName = useCauseName(mission);
  const over = game.phase > PHASE_COUNT;

  // The free baseline: the confirmed design, standard choices for the rest. Its own random stream.
  const baseline = useMemo(() => agencyForecast(game, player, player.picks, RUNS, 'baseline'),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [game.phase, game.agencies]);
  const designKey = JSON.stringify([working, game.phase]);
  const myForecast = mine && mine.phase === game.phase ? mine : null;
  const stale = !!myForecast && myForecast.key !== designKey;
  const forecastsLeft = game.practice ? null : Math.max(0, 1 - game.forecastsUsed);
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
        const next = without.includes(optionId) ? without.filter((x) => x !== optionId) : [...without, optionId].slice(-multi.max);
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
  };

  const runForecast = () => {
    if (!canForecast) return;
    // Same random stream as the baseline, so the difference shows the design change, not noise.
    const f = agencyForecast(game, player, working, RUNS, 'baseline', pending);
    setGame({ ...game, forecastsUsed: game.forecastsUsed + 1 });
    setMine({ f, key: designKey, phase: game.phase });
    play('forecastRun');
    const d = f.successShare - baseline.successShare;
    if (Math.abs(d) >= 0.02) play(d > 0 ? 'forecastUp' : 'forecastDown', 1.2);
  };
  const doConfirm = () => {
    const picks = {} as Record<AgencyKind, Picks>;
    for (const a of game.agencies) picks[a.id] = a.id === 'player' ? working : aiPicks(game, a);
    const phase = game.phase;
    play('confirm');
    const g = confirmPhase(game, picks);
    setGame(g);
    setDraft({});
    setMine(null);
    setAskConfirm(false);
    setTab(Math.min(g.phase, PHASE_COUNT));
    if (g.phase <= PHASE_COUNT) setResolved(phase);
  };
  const confirm = () => (game.forecastsUsed === 0 && !myForecast ? setAskConfirm(true) : doConfirm());
  const restart = (seed = newSeed()) => { setGame(newGame(mission, seed, game.practice)); setDraft({}); setMine(null); setTab(1); };

  const issueText = (i: Issue) => {
    const values: Record<string, string | number> = { ...i.values, res: i.resource ? tk(t, `res_${i.resource}`) : '' };
    for (const k of ['launch', 'orbit'] as const) { const o = optionById.get(String(values[k] ?? '')); if (o) values[k] = L(o.name); }
    return fmt(tk(t, `issue_${i.code}`), values);
  };
  const blockers = state.issues.filter((i) => i.level === 'blocker');
  const warnings = state.issues.filter((i) => i.level === 'warning');

  // Weak points: the most common causes in the forecast shown, with a jump to a decision that protects against them.
  const shown = myForecast?.f ?? baseline;
  const fixSlot = (cause: string) => {
    const card = mission.events.find((e) => e.id === cause);
    const cond = card?.protectedIf ?? card?.partialIf ?? card?.readyIf;
    if (!cond) return null;
    const tags: string[] = [], keys: string[] = [];
    const walk = (c: typeof cond): void => { if (c.kind === 'hasTag') tags.push(c.tag); else if (c.kind === 'setting') keys.push(c.key); else if (c.kind === 'all' || c.kind === 'any') c.of.forEach(walk); };
    walk(cond);
    return mission.slots.find((s) => s.phase <= game.phase && s.options.some((id) => {
      const o = optionById.get(id)!;
      return o.tags?.some((x) => tags.includes(x)) || (o.kind === 'choice' && Object.keys(o.settings ?? {}).some((k) => keys.includes(k)));
    })) ?? null;
  };
  const jump = (slotId: string, phase: number) => {
    setTab(phase);
    setFlashSlot(slotId);
    setTimeout(() => setFlashSlot(null), 1200);
  };

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

  if (over && game.final) {
    return <AutoFit className="final-wrap" min={0.8}><FinalScreen game={game} onRestart={() => restart()} onReplaySame={() => restart(game.seed)} /></AutoFit>;
  }

  const forecastFirst = canForecast && (!myForecast || stale);
  const step = !myForecast || stale ? 2 : 3;
  const forecastBtn = <button type="button" data-tour="forecastBtn" className={forecastFirst ? 'primary' : 'secondary'} disabled={!canForecast} onClick={runForecast}>{fmt(t.runForecast, { n: RUNS })}</button>;
  const confirmBtn = <button type="button" className={forecastFirst ? 'secondary' : 'primary'} onClick={confirm}>{game.phase < PHASE_COUNT ? fmt(t.confirmPhaseN, { n: game.phase }) : t.confirmLast}</button>;
  const lastReport = game.reports[game.reports.length - 1];

  return (
    <div className="game">
      <div className="turnbar">
        <div className="turn-title" title={L(mission.summary)}>
          <b>{L(mission.name)}</b>
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
        <label className="practice" title={t.practiceMode}>
          <input type="checkbox" checked={game.practice} onChange={(e) => setGame({ ...game, practice: e.target.checked })} />
          {t.practiceShort}
        </label>
        <div className="turn-actions" data-tour="confirm">{forecastBtn}{confirmBtn}</div>
      </div>
      <div className="game-body">
        <div className={`col col-left ${mission.view ? 'with-view' : ''}`}>
        {mission.view && <div className="mv-wrap" data-tour="view"><MissionView mission={mission} state={state} ghost={ghost} /></div>}
        <AutoFit className="left-rest" data-tour="gauges" min={0.8}>
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
            {shown.topCauses.length === 0 ? <p className="ok small">{t.noCauses}</p> : (
              <ul>
                {shown.topCauses.slice(0, 3).map(([c, share]) => {
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
          </div>
        </AutoFit>
        </div>
        <AutoFit className="col col-center" data-tour="options" min={0.7}>
          {tab < game.phase && <p className="note">{t.pastPhaseNote}</p>}
          <div className={`slots ${(() => {
            // Four or more boxes: three narrow columns; without a wide box, flowed as columns so short boxes stack.
            const here = mission.slots.filter((s) => s.phase === tab);
            return here.length <= 3 ? 'roomy' : here.some((s) => s.options.length > 4 || (s.multi && s.options.length > 2)) ? 'dense' : 'dense cols';
          })()}`}>
            {mission.slots.filter((s) => s.phase === tab).map((s) => {
              const locked = changeCost(mission, player, s.id, ['__probe__'], game.phase).locked;
              return (
                <fieldset key={s.id} className={`slot ${s.options.length > 4 ? 'wide' : s.multi && s.options.length > 2 ? 'multi' : ''} ${flashSlot === s.id ? 'flash' : ''}`}>
                  <legend>{L(s.label)}</legend>
                  <p className="note">{L(s.help)}{s.multi ? ` ${fmt(t.pickUpTo, { n: s.multi.max })}` : ''}</p>
                  {locked && <p className="warn small">{t.lockedAfterLaunch}</p>}
                  <div className="opts">
                    {s.options.map((id) => {
                      const o = optionById.get(id)!;
                      const selected = (state.picks[s.id] ?? []).includes(id);
                      const wrongOrbit = o.kind === 'launch' && state.orbit !== null && !o.capacityKg[state.orbit.id];
                      const c = selected ? null : changeCost(mission, player, s.id, [id], game.phase);
                      const pv = selected || wrongOrbit || locked ? null : preview(s.id, id, s.multi);
                      return (
                        <OptionCard
                          key={id}
                          option={o} selected={selected} disabled={wrongOrbit || locked}
                          type={s.multi ? 'checkbox' : 'radio'} name={s.id} orbitId={state.orbit?.id ?? null} solar={state.orbit?.solarFactor?.value}
                          standard={(standard[s.id] ?? []).includes(id)}
                          diffs={pv?.diffs} blocks={pv?.blocks}
                          reason={wrongOrbit ? t.cannotReachOrbit : undefined}
                          hint={c && c.kUSD > 0 && !locked ? fmt(t.changeCostHint, { k: c.kUSD.toLocaleString(), d: c.days }) : undefined}
                          onPick={() => pick(s.id, id, s.multi)}
                          onHover={(on) => setHover(on ? { slot: s.id, id } : null)}
                        />
                      );
                    })}
                  </div>
                </fieldset>
              );
            })}
          </div>
        </AutoFit>
        <AutoFit className="col col-right" data-tour="forecast" min={0.8}>
          <ForecastPanel mission={mission} baseline={baseline} mine={myForecast?.f ?? null} stale={stale} left={forecastsLeft} />
        </AutoFit>
      </div>
      <button type="button" className="rival-strip" onClick={() => setAllTurns(true)} disabled={!game.reports.length} title={t.showAllReports}>
        <span className="note">{t.rivalsTitle}</span>
        {game.agencies.filter((a) => a.id !== 'player').map((a) => {
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
        <Modal title={t.noForecastTitle} onClose={() => setAskConfirm(false)}>
          <p>{t.noForecastBody}</p>
          <div className="mission-actions">
            <button type="button" className="primary" disabled={!canForecast} onClick={() => { setAskConfirm(false); runForecast(); }}>{fmt(t.runForecast, { n: RUNS })}</button>
            <button type="button" className="secondary" onClick={doConfirm}>{t.confirmAnyway}</button>
          </div>
        </Modal>
      )}
      {resolved !== null && <Resolution game={game} phase={resolved} onClose={() => setResolved(null)} />}
      {allTurns && <Modal title={t.reportsTitle} wide onClose={() => setAllTurns(false)}><TurnReports game={game} heading={false} /></Modal>}
      {guide && <Tutorial mission={mission} autoShare={baseline.successShare} onClose={() => setGuide(false)} />}
    </div>
  );
}
