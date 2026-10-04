import { globSync, readFileSync } from 'node:fs';
import path from 'node:path';

const [dir] = process.argv.slice(2);
const detected = new Set(['Killed', 'Timeout']);
const undetected = new Set(['Survived', 'NoCoverage']);
const reports = globSync('*/mutation.json', { cwd: dir });
if (reports.length === 0) {
  console.error(`No mutation reports in ${dir}`);
  process.exit(1);
}

let failed = false;
for (const report of reports.sort()) {
  const { files } = JSON.parse(readFileSync(path.join(dir, report), 'utf8'));
  const mutants = Object.values(files).flatMap((file) => file.mutants);
  const killed = mutants.filter((mutant) => detected.has(mutant.status)).length;
  const missed = mutants.filter((mutant) => undetected.has(mutant.status)).length;
  const score = killed + missed === 0 ? 100 : (100 * killed) / (killed + missed);
  console.log(`${path.dirname(report)}: ${score.toFixed(2)}% (${killed} detected, ${missed} undetected)`);
  if (missed > 0) failed = true;
}
process.exit(failed ? 1 : 0);
