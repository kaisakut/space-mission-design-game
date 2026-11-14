/**
 * npm run check:engine
 * Checks the rules the game depends on:
 * - the standard design of every mission can launch;
 * - the same seed gives the same forecast;
 * - forecasting never changes the real game (forecast and real runs use separate random streams).
 */
import { MISSIONS } from '../src/data/missions';
import { canLaunch, evaluate } from '../src/engine/design';
import { runForecast } from '../src/engine/forecast';
import { Rng } from '../src/engine/rng';
import { simulate } from '../src/engine/simulate';

let failed = 0;
const check = (ok: boolean, what: string) => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}`); if (!ok) failed++; };

for (const m of MISSIONS) {
  const d = evaluate(m, {});
  check(canLaunch(d), `${m.id}: auto-plan can launch`);
  const a = runForecast(m, {}, 42, 1, 50);
  const b = runForecast(m, {}, 42, 1, 50);
  check(JSON.stringify(a) === JSON.stringify(b), `${m.id}: same seed gives the same forecast`);
  const drawn = new Set(m.events.filter((e) => e.phase === 5).map((e) => e.id));
  const real1 = simulate(m, d, new Rng(42, 'failures:player'), { drawn });
  runForecast(m, {}, 42, 1, 100);
  const real2 = simulate(m, d, new Rng(42, 'failures:player'), { drawn });
  check(JSON.stringify(real1) === JSON.stringify(real2), `${m.id}: forecasting does not change the real game`);
  console.log(`     auto-plan: success ${Math.round(a.successShare * 100)}%, median score ${a.score.p50}`);
}
if (failed) process.exit(1);

// A whole game with the AI: every agency ends with a result, and the same seed gives the same game.
import { aiPicks } from '../src/engine/ai';
import { confirmPhase, newGame, type AgencyKind } from '../src/engine/game';
import type { Picks } from '../src/engine/design';
const play = (seed: number, mission = MISSIONS[0]!) => {
  let g = newGame(mission, seed);
  while (g.phase <= 5) {
    const picks = {} as Record<AgencyKind, Picks>;
    for (const a of g.agencies) picks[a.id] = a.id === 'player' ? {} : aiPicks(g, a);
    g = confirmPhase(g, picks);
  }
  return g;
};
for (const mission of MISSIONS) {
const g1 = play(9, mission), g2 = play(9, mission);
check(!!g1.final && Object.keys(g1.final).length === 4, `${mission.id}: a full game ends with results for all four agencies`);
check(JSON.stringify(g1.final) === JSON.stringify(g2.final), `${mission.id}: the same seed gives the same game`);
const sameCards = g1.reports.every((r) => Object.values(r.results).every((x) => Object.keys(x).length === r.cards.length));
check(sameCards, `${mission.id}: every agency faces the same cards each phase`);
console.log('     final:', g1.agencies.map((a) => `${a.id} ${g1.final![a.id].score.total} (${g1.final![a.id].outcome})`).join(', '));
}
if (failed) process.exit(1);

// One change at a time: how each option moves the standard design, and options or cards that hardly matter.
// Prints warnings only (they are judgement calls, not failures). `--table` prints every row.
import { completePicks } from '../src/engine/design';
import { meets } from '../src/engine/events';
const showTable = process.argv.includes('--table');
const SEEDS = 8, N = 100;
/**
 * Safer choices that cost score on purpose: the price is named in the option's own text, so the player
 * weighs safety against points. Reported as notes, not warnings (see notes/設計_データ整合性の修正.md, C1).
 */
const INTENDED_TRADEOFFS: Record<string, string> = {
  'lunar-ice-rover:lthermal-rhu': 'the safety review adds 120 days and 20,000 k$, which can cost the first lander flight',
  'jupiter-icy-moon:jwindow-second': 'the later window halves the schedule points in exchange for time to absorb delays',
};

const measure = (m: (typeof MISSIONS)[number], picks: Picks) => {
  let s = 0, sc = 0;
  for (let seed = 1; seed <= SEEDS; seed++) { const f = runForecast(m, picks, seed, 1, N); s += f.successShare; sc += f.runs.reduce((a, r) => a + r.score.total, 0) / N; }
  return { s: (s / SEEDS) * 100, sc: sc / SEEDS };
};
for (const m of MISSIONS) {
  const std = completePicks(m, {});
  const base = measure(m, {});
  const warn: string[] = [];
  for (const slot of m.slots) {
    for (const id of slot.options) {
      if ((std[slot.id] ?? []).includes(id)) continue;
      const picks = { [slot.id]: slot.multi && !slot.multi.noneFirst ? [...(std[slot.id] ?? []), id].slice(-slot.multi.max) : [id] };
      if (!canLaunch(evaluate(m, picks))) { if (showTable) console.log(`     ${m.id} ${slot.id}=${id}: cannot launch from the standard design`); continue; }
      const r = measure(m, picks);
      const ds = r.s - base.s, dsc = r.sc - base.sc;
      if (showTable) console.log(`     ${m.id} ${slot.id}=${id}: success ${ds >= 0 ? '+' : ''}${ds.toFixed(1)}, score ${dsc >= 0 ? '+' : ''}${dsc.toFixed(1)}`);
      if (slot.id !== 'secondary' && Math.abs(dsc) < 0.1) warn.push(`${slot.id}=${id} hardly changes the score (${dsc.toFixed(2)})`);
      if (ds >= 2 && dsc < 0) {
        // A safer choice that costs some score is a fair trade-off (the price of the extra success), so it is only noted.
        // The real balance problem, an option that is never the best in any design, is checked by `npm run audit:options`.
        const why = INTENDED_TRADEOFFS[`${m.id}:${id}`];
        console.log(`note ${m.id}: ${slot.id}=${id} raises success by ${ds.toFixed(1)} and lowers the score by ${(-dsc).toFixed(1)}${why ? ` (${why})` : ''}`);
      }
    }
  }
  // Cards that leave almost every launchable design unharmed teach nothing.
  const rng = new Rng(7, 'random-designs');
  const designs = [];
  for (let i = 0; i < 1000 && designs.length < 400; i++) {
    const picks: Picks = {};
    for (const s of m.slots) {
      const opts = s.multi && s.multi.noneFirst ? [s.options[0]!] : s.options;
      picks[s.id] = s.multi && !s.multi.noneFirst ? opts.filter(() => rng.chance(0.4)).slice(0, s.multi.max) : [opts[Math.floor(rng.float() * opts.length)]!];
      if (!picks[s.id]!.length) picks[s.id] = [opts[0]!];
    }
    const d = evaluate(m, picks);
    if (canLaunch(d)) designs.push(d);
  }
  for (const card of m.events) {
    const c = card.protectedIf ?? card.readyIf;
    if (!c || !designs.length) continue;
    const share = designs.filter((d) => meets(c, d)).length / designs.length;
    if (share >= 0.8) warn.push(`card ${card.id} leaves ${Math.round(share * 100)}% of random launchable designs unharmed`);
  }
  console.log(`     ${m.id}: one-change check, ${warn.length} warning(s)`);
  for (const w of warn) console.log(`  warn ${w}`);
}
