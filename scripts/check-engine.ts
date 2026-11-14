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
  check(canLaunch(d), `${m.id}: standard design can launch`);
  const a = runForecast(m, {}, 42, 1, 50);
  const b = runForecast(m, {}, 42, 1, 50);
  check(JSON.stringify(a) === JSON.stringify(b), `${m.id}: same seed gives the same forecast`);
  const drawn = new Set(m.events.filter((e) => e.phase === 5).map((e) => e.id));
  const real1 = simulate(m, d, new Rng(42, 'failures:player'), { drawn });
  runForecast(m, {}, 42, 1, 100);
  const real2 = simulate(m, d, new Rng(42, 'failures:player'), { drawn });
  check(JSON.stringify(real1) === JSON.stringify(real2), `${m.id}: forecasting does not change the real game`);
  console.log(`     standard design: success ${Math.round(a.successShare * 100)}%, median score ${a.score.p50}`);
}
if (failed) process.exit(1);
