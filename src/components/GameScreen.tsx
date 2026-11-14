import { useMemo, useState } from 'react';
import type { Mission } from '../data/types';
import { aiPicks } from '../engine/ai';
import type { Issue, Picks } from '../engine/design';
import { agencyDesign, agencyForecast, changeCost, confirmPhase, newGame, pendingChanges, PHASE_COUNT, type AgencyKind, type Game } from '../engine/game';
import { fmt, tk, useLang } from '../i18n';
import { ForecastPanel } from './ForecastPanel';
import { Gauges } from './Gauges';
import { OptionCard } from './OptionCard';
import { AutoFit } from './AutoFit';
import { FinalScreen, LatestReport } from './Reports';
import { Tutorial } from './Tutorial';

const PHASES = [1, 2, 3, 4, 5] as const;
const newSeed = () => Math.floor(Math.random() * 1e9);

/** The game: one turn per phase. Decide, forecast once (or freely in practice mode), confirm, see what happened. */
export function GameScreen({ mission, tutorial = false }: { mission: Mission; tutorial?: boolean }) {
  const { t, L } = useLang();
  const [game, setGame] = useState<Game>(() => newGame(mission, newSeed()));
  const [tab, setTab] = useState(1);
  const [draft, setDraft] = useState<Picks>({});
  const [guide, setGuide] = useState(tutorial);
  const [reportOpen, setReportOpen] = useState(false);
  const player = game.agencies.find((a) => a.id === 'player')!;
  const working = { ...player.picks, ...draft };
  const pending = useMemo(() => pendingChanges(game, player, working), [game, player, working]);
  const state = useMemo(() => agencyDesign(game, player, working, pending), [game, player, working, pending]);
  const optionById = useMemo(() => new Map(mission.options.map((o) => [o.id, o])), [mission]);
  const over = game.phase > PHASE_COUNT;

  const pick = (slotId: string, optionId: string, multi?: { min: number; max: number; noneFirst?: boolean }) => {
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
    setDraft(next);
  };

  const confirm = () => {
    const picks = {} as Record<AgencyKind, Picks>;
    for (const a of game.agencies) picks[a.id] = a.id === 'player' ? working : aiPicks(game, a);
    const g = confirmPhase(game, picks);
    setGame(g);
    setDraft({});
    setTab(Math.min(g.phase, PHASE_COUNT));
    setReportOpen(g.phase <= PHASE_COUNT);
  };
  const restart = () => { setGame(newGame(mission, newSeed(), game.practice)); setDraft({}); setTab(1); };

  const issueText = (i: Issue) => {
    const values: Record<string, string | number> = { ...i.values, res: i.resource ? tk(t, `res_${i.resource}`) : '' };
    for (const k of ['launch', 'orbit'] as const) { const o = optionById.get(String(values[k] ?? '')); if (o) values[k] = L(o.name); }
    return fmt(tk(t, `issue_${i.code}`), values);
  };
  const blockers = state.issues.filter((i) => i.level === 'blocker');
  const warnings = state.issues.filter((i) => i.level === 'warning');
  const forecastsLeft = game.practice ? null : Math.max(0, 1 - game.forecastsUsed);

  if (over && game.final) {
    return <AutoFit className="final-wrap"><FinalScreen game={game} onRestart={restart} /></AutoFit>;
  }

  return (
    <div className="game">
      <div className="turnbar">
        <div className="turn-title" title={L(mission.summary)}>
          <b>{L(mission.name)}</b>
          <span className="note">{fmt(t.turnTitle, { n: game.phase, total: PHASE_COUNT, name: tk(t, `phase${game.phase}`) })}</span>
        </div>
        <div className="tabs" role="tablist" title={t.turnHelp}>
          {PHASES.map((p) => (
            <button key={p} type="button" role="tab" aria-selected={tab === p} disabled={p > game.phase} className={tab === p ? 'on' : ''} onClick={() => setTab(p)}>
              {fmt(t.phaseTab, { n: p, name: tk(t, `phase${p}`) })}{p < game.phase ? ' ✓' : ''}
            </button>
          ))}
        </div>
        <label className="practice">
          <input type="checkbox" checked={game.practice} onChange={(e) => setGame({ ...game, practice: e.target.checked })} />
          {t.practiceMode}
        </label>
        <button type="button" className="primary" data-tour="confirm" onClick={confirm}>{game.phase < PHASE_COUNT ? t.confirmPhase : t.confirmLast}</button>
      </div>
      <div className="game-body">
        <AutoFit className="col col-left" data-tour="gauges">
          <p className="note">{L(mission.summary)}</p>
          <Gauges gauges={state.gauges} />
          {pending.kUSD > 0 && <p className="warn small">{fmt(t.pendingChange, { k: pending.kUSD.toLocaleString(), d: pending.days })}</p>}
          {player.changeKUSD > 0 && <p className="note small">{fmt(t.paidChanges, { k: player.changeKUSD.toLocaleString() })}</p>}
          <div className="issues">
            {!blockers.length && !warnings.length && <p className="ok">{t.noIssues}</p>}
            {blockers.length > 0 && <><h3 className="bad">{t.blockers}</h3><ul>{blockers.map((i, k) => <li key={k}>{issueText(i)}</li>)}</ul></>}
            {warnings.length > 0 && <><h3 className="warn">{t.warnings}</h3><ul>{warnings.map((i, k) => <li key={k}>{issueText(i)}</li>)}</ul></>}
          </div>
        </AutoFit>
        <AutoFit className="col col-center" data-tour="options">
          {tab < game.phase && <p className="note">{t.pastPhaseNote}</p>}
          <div className="slots">
            {mission.slots.filter((s) => s.phase === tab).map((s) => {
              const locked = changeCost(mission, player, s.id, ['__probe__'], game.phase).locked;
              return (
                <fieldset key={s.id} className={`slot ${s.options.length > 4 ? 'wide' : ''}`}>
                  <legend>{L(s.label)}</legend>
                  <p className="note">{L(s.help)}{s.multi ? ` ${fmt(t.pickUpTo, { n: s.multi.max })}` : ''}</p>
                  {locked && <p className="warn small">{t.lockedAfterLaunch}</p>}
                  <div className="opts">
                    {s.options.map((id) => {
                      const o = optionById.get(id)!;
                      const selected = (state.picks[s.id] ?? []).includes(id);
                      const wrongOrbit = o.kind === 'launch' && state.orbit !== null && !o.capacityKg[state.orbit.id];
                      const c = selected ? null : changeCost(mission, player, s.id, [id], game.phase);
                      return (
                        <OptionCard
                          key={id}
                          option={o} selected={selected} disabled={wrongOrbit || locked}
                          type={s.multi ? 'checkbox' : 'radio'} name={s.id} orbitId={state.orbit?.id ?? null} solar={state.orbit?.solarFactor?.value}
                          hint={c && c.kUSD > 0 && !locked ? fmt(t.changeCostHint, { k: c.kUSD.toLocaleString(), d: c.days }) : undefined}
                          onPick={() => pick(s.id, id, s.multi)}
                        />
                      );
                    })}
                  </div>
                </fieldset>
              );
            })}
          </div>
        </AutoFit>
        <div className="col col-right">
          <AutoFit className="pane" data-tour="forecast">
            <ForecastPanel
              mission={mission}
              designKey={JSON.stringify([working, game.phase])}
              left={forecastsLeft}
              run={(runs) => {
                if (!game.practice && game.forecastsUsed >= 1) return null;
                const f = agencyForecast(game, player, working, runs, undefined, pending);
                setGame({ ...game, forecastsUsed: game.forecastsUsed + 1 });
                return f;
              }}
            />
          </AutoFit>
          <AutoFit className="pane">
            <LatestReport game={game} open={reportOpen} onOpen={() => setReportOpen(true)} onClose={() => setReportOpen(false)} />
          </AutoFit>
        </div>
      </div>
      {guide && <Tutorial summary={mission.summary} onClose={() => setGuide(false)} />}
    </div>
  );
}
