// Fails when a mirrored module has drifted from its source in the mobile repo.
//
// The duplication is sanctioned — CLAUDE.md forbids importing the RN repo as a
// build dependency and Vercel builds this repo alone — but UNCHECKED
// duplication of a recurrence expander or a targets schema is how two products
// quietly start disagreeing about what a user's data means. This makes drift
// loud instead of silent.
//
// Skips when the mobile repo is not on disk, so CI and Vercel stay green. It is
// a developer guard, not a build gate.
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const web = resolve(here, '..');
const app = resolve(web, '../horsepowr');

const MIRROR = [
  ['src/types/calendar.ts', 'src/types/calendar.ts'],
  ['src/utils/civilDate.ts', 'src/services/time/civilDate.ts'],
  ['src/utils/timezone.ts', 'src/services/time/timezone.ts'],
  ['src/schemas/trainingTargets.ts', 'src/services/calendar/trainingTargets.ts'],
  ['src/services/calendar/recurrenceService.ts', 'src/services/calendar/recurrenceService.ts'],
  ['src/services/calendar/occurrenceQuery.ts', 'src/services/calendar/occurrenceQuery.ts'],
  ['src/services/calendar/agendaGrouping.ts', 'src/services/calendar/agendaGrouping.ts'],
  ['src/components/loading/pulseGeometry.ts', 'src/components/brand/pulseGeometry.ts'],
];

if (!existsSync(app)) {
  console.log('check:mirror - mobile repo not present, skipping.');
  process.exit(0);
}

/** Strip the provenance header and undo the import rewrites. */
function normalise(text) {
  return text
    .replace(/^\/\*\*[\s\S]*?\*\/\n\n/, '')
    .replaceAll('@/services/calendar/trainingTargets', '@/schemas/trainingTargets')
    .replaceAll('@/services/time/civilDate', '@/utils/civilDate')
    .replaceAll('@/services/time/timezone', '@/utils/timezone')
    .replaceAll('@/services/hrZone', '@/utils/hrZone')
    .replaceAll("import { log } from '@/lib/log';", "import { getLogger } from '@/services/logger';")
    .replaceAll('log.', 'getLogger().')
    .trim();
}

let drifted = 0;
for (const [source, mirror] of MIRROR) {
  const a = readFileSync(resolve(app, source), 'utf8').trim();
  const b = normalise(readFileSync(resolve(web, mirror), 'utf8'));
  if (a !== b) {
    drifted += 1;
    console.error(`DRIFT  ${mirror} differs from horsepowr/${source}`);
  }
}

if (drifted > 0) {
  console.error(`\n${drifted} mirrored file(s) drifted. Re-mirror from the mobile repo.`);
  process.exit(1);
}
console.log(`check:mirror - ${MIRROR.length} files in sync.`);
