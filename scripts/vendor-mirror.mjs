// Re-vendors mirrored modules from the mobile repo (the inverse of
// check-mirror's normalise step), stamping the source commit.
//
//   node scripts/vendor-mirror.mjs            # every file in the mirror list
//   node scripts/vendor-mirror.mjs <mirror>…  # only these web paths
//
// The copy is deliberate (CLAUDE.md: no build dependency on the RN repo);
// this script exists so re-mirroring is one reproducible command instead of
// a hand edit that check:mirror then has to catch.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';
import { MIRROR } from './mirror-list.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const web = resolve(here, '..');
const app = resolve(web, '../horsepowr');
if (!existsSync(app)) {
  console.error('vendor-mirror: mobile repo not found next to this one.');
  process.exit(1);
}

const commit = execSync('git rev-parse --short HEAD', { cwd: app }).toString().trim();
const only = new Set(process.argv.slice(2));

function toWeb(text) {
  return text
    .replaceAll('@/schemas/trainingTargets', '@/services/calendar/trainingTargets')
    .replaceAll('@/utils/civilDate', '@/services/time/civilDate')
    .replaceAll('@/utils/timezone', '@/services/time/timezone')
    .replaceAll('@/utils/hrZone', '@/services/hrZone')
    .replaceAll("import { getLogger } from '@/services/logger';", "import { log } from '@/lib/log';")
    .replaceAll('getLogger().', 'log.');
}

function header(source) {
  return `/**
 * MIRRORED FROM THE MOBILE REPO — do not edit here.
 * Vendored from the mobile repo, commit ${commit}, do not edit here.
 *
 * Source: horsepowr/${source}
 *
 * CLAUDE.md forbids importing the RN repo as a build dependency, and Vercel
 * builds this repo alone, so shared domain logic is copied rather than linked.
 * The copy is deliberate and checked: \`npm run check:mirror\` fails when this
 * file and its source have drifted, so the duplication is visible instead of
 * silent. Fix a bug in the mobile repo and re-run the mirror; never patch here.
 *
 * These modules are PURE on purpose — that is what makes them safe to mirror.
 * Anything touching Supabase, storage or React stays on its own side.
 */

`;
}

let written = 0;
for (const [source, mirror] of MIRROR) {
  if (only.size > 0 && !only.has(mirror)) continue;
  const text = readFileSync(resolve(app, source), 'utf8').trim();
  writeFileSync(resolve(web, mirror), `${header(source)}${toWeb(text)}\n`);
  written += 1;
}
console.log(`vendor-mirror: ${written} file(s) written from mobile commit ${commit}.`);
