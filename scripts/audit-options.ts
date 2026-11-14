/**
 * npm run audit:options
 * For every option of every mission, compares a design with it against the same design with the auto-plan's
 * choice for that box, over many random launchable designs (not only the auto-plan). Reports:
 * - how often a design with the option can launch at all,
 * - the average change in success and score, split into the score parts,
 * so options that never matter, or that always fail, stand out.
 */
import { MISSIONS } from '../src/data/missions';
import type { Mission } from '../src/data/types';
import { canLaunch, completePicks, evaluate, type Picks } from '../src/engine/design';
import { runForecast } from '../src/engine/forecast';

const DESIGNS = Number(process.argv[2] ?? 40), RUNS = 60;
const PARTS = ['primary', 'secondary', 'science', 'budget', 'schedule'] as const;

const rnd = (() => { let s = 12345; return () => ((s = (s * 16807) % 2147483647) / 2147483647); })();
const randomPicks = (m: Mission): Picks => {
  const p: Picks = {};
  for (const s of m.slots) {
    if (s.multi) {
      const pool = s.multi.noneFirst ? s.options.slice(1) : s.options;
      const n = Math.max(s.multi.min, Math.floor(rnd() * (s.multi.max + 1)));
      const pick = [...pool].sort(() => rnd() - 0.5).slice(0, n);
      p[s.id] = pick.length ? pick : s.multi.noneFirst ? [s.options[0]!] : [pool[0]!];
    } else p[s.id] = [s.options[Math.floor(rnd() * s.options.length)]!];
  }
  return p;
};
const measure = (m: Mission, picks: Picks) => {
  const f = runForecast(m, picks, 777, 1, RUNS, { stream: 'audit' });
  const parts = Object.fromEntries(PARTS.map((k) => [k, f.runs.reduce((a, r) => a + r.score[k], 0) / f.runs.length])) as Record<(typeof PARTS)[number], number>;
  return { s: f.successShare * 100, sc: f.runs.reduce((a, r) => a + r.score.total, 0) / f.runs.length, parts };
};

for (const m of MISSIONS) {
  const std = completePicks(m, {});
  // Random launchable designs to swap options into.
  const bases: Picks[] = [];
  for (let k = 0; bases.length < DESIGNS && k < DESIGNS * 60; k++) { const p = randomPicks(m); if (canLaunch(evaluate(m, p))) bases.push(p); }
  console.log(`\n## ${m.id} (${bases.length} random launchable designs)`);
  console.log('slot | option | launchable % | success % with it | Δsuccess | Δscore | Δprimary Δsecondary Δscience Δbudget Δschedule');
  for (const slot of m.slots) {
    if (slot.id === 'secondary') continue;
    const def = std[slot.id] ?? [];
    for (const id of slot.options) {
      if (!slot.multi && def.includes(id)) continue;
      let launch = 0, n = 0, ds = 0, dsc = 0, abs = 0;
      const dp = Object.fromEntries(PARTS.map((k) => [k, 0])) as Record<(typeof PARTS)[number], number>;
      for (const b of bases) {
        const withIt: Picks = { ...b, [slot.id]: slot.multi ? (b[slot.id]!.includes(id) ? b[slot.id]! : [...b[slot.id]!, id].slice(-slot.multi.max)) : [id] };
        const without: Picks = { ...b, [slot.id]: slot.multi ? (b[slot.id]!.filter((x) => x !== id).length ? b[slot.id]!.filter((x) => x !== id) : def) : def };
        const okWith = canLaunch(evaluate(m, withIt)), okWithout = canLaunch(evaluate(m, without));
        if (okWith) launch++;
        if (!okWith || !okWithout) continue;
        const a = measure(m, withIt), z = measure(m, without);
        ds += a.s - z.s; dsc += a.sc - z.sc; abs += a.s; n++;
        for (const k of PARTS) dp[k] += a.parts[k] - z.parts[k];
      }
      const f = (x: number) => (n ? (x / n >= 0 ? '+' : '') + (x / n).toFixed(1) : '—');
      console.log(`${slot.id} | ${id}${def.includes(id) ? ' (auto)' : ''} | ${Math.round((launch / bases.length) * 100)} | ${n ? Math.round(abs / n) : '—'} | ${f(ds)} | ${f(dsc)} | ${PARTS.map((k) => f(dp[k])).join(' ')}`);
    }
  }
}
