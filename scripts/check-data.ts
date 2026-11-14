/**
 * npm run check:data
 * Validates every mission. Exits with code 1 on errors; placeholders are listed but do not fail
 * (until submission, when `npm run check:data -- --strict` must pass).
 */
import { MISSIONS } from '../src/data/missions';
import { validateMission } from '../src/data/validate';

const strict = process.argv.includes('--strict');
let errors = 0;
let placeholders = 0;
for (const m of MISSIONS) {
  const issues = validateMission(m);
  const e = issues.filter((i) => i.level === 'error');
  const p = issues.filter((i) => i.level === 'placeholder');
  errors += e.length;
  placeholders += p.length;
  console.log(`${m.id}: ${e.length} error(s), ${p.length} placeholder value(s)`);
  for (const i of e) console.log(`  ERROR ${i.where}: ${i.message}`);
  if (process.argv.includes('--list')) for (const i of p) console.log(`  todo  ${i.where}: ${i.message}`);
}
if (errors || (strict && placeholders)) process.exit(1);
