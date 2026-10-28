// End-to-end: Polar export file -> web import -> stored session -> charts.
// Runs a real Chromium against `next dev` on :3100 and a local Supabase.
import { chromium } from 'playwright';
import { execSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
const BASE = 'http://127.0.0.1:3100';
const OUT = process.env.E2E_OUT ?? './e2e-out';
const FILES = process.env.E2E_FILES ?? `${OUT}/files`;
const DB = 'postgresql://postgres:postgres@127.0.0.1:54322/postgres';
const sql = (q) => execSync(`psql -At "${DB}" -c "${q.replace(/"/g, '\\"')}"`).toString().trim();
const results = [];
const check = (name, ok, detail = '') => { results.push({ name, ok, detail }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`); };

async function login(page, email) {
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
  await page.fill('#email', email);
  await page.fill('#password', 'E2e-local-only-1');
  await page.click('button[type=submit]');
  try {
    await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 60000 });
  } catch {
    await page.screenshot({ path: `${OUT}/shots/login-failed.png` });
    throw new Error(`login failed for ${email}: ${await page.locator('body').innerText()}`);
  }
}

async function importFile(page, file, { horse = 'Luna', expectPreview = true } = {}) {
  await page.goto(`${BASE}/sessions/import`, { waitUntil: 'networkidle' });
  await page.setInputFiles('#import-file', file);
  if (!expectPreview) {
    // Next's route announcer also has role="alert"; take the one with text.
    const alert = page.getByRole('alert').filter({ hasText: /\S/ });
    await alert.waitFor({ timeout: 60000 });
    return { alert: await alert.innerText() };
  }
  await page.getByText('Check before importing').waitFor({ timeout: 60000 });
  const previewText = await page.locator('dl').innerText();
  await page.selectOption('#import-horse', { label: horse });
  await page.selectOption('#import-type', 'cross_country');
  await page.fill('#import-location', 'Eventing Breda');
  await page.getByRole('button', { name: 'Import session' }).click();
  await page.getByRole('status').filter({ hasText: /imported|completed/i }).waitFor({ timeout: 120000 });
  const status = await page.getByRole('status').filter({ hasText: /imported|completed/i }).innerText();
  const href = await page.getByRole('link', { name: 'Open session' }).getAttribute('href');
  return { previewText, status, sessionId: href?.split('/').pop() };
}

(async () => {
  mkdirSync(`${OUT}/shots`, { recursive: true });
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ timezoneId: 'Europe/Amsterdam', locale: 'en-GB', viewport: { width: 1400, height: 1000 } });
  const page = await ctx.newPage();
  const consoleErrors = [];
  // Map tiles come from tile.openstreetmap.org, which this sandbox's network
  // policy blocks; those errors are the environment, not the app.
  page.on('console', (m) => {
    if (m.type() === 'error' && !/openstreetmap|ERR_TUNNEL_CONNECTION_FAILED|status of 41[35]|status of 422/.test(m.text())) consoleErrors.push(m.text());
  });

  // 1. Trainer signs in and imports the Polar TCX of a competition day.
  await login(page, 'trainer.a@e2e.local');
  await page.goto(`${BASE}/sessions`, { waitUntil: 'networkidle' });
  check('trainer sees "Import file" on /sessions', await page.getByRole('link', { name: 'Import file' }).isVisible());

  const tcx = await importFile(page, `${FILES}/polar-competition-2026-10-25.tcx`);
  await page.screenshot({ path: `${OUT}/shots/01-tcx-imported.png`, fullPage: true });
  check('TCX import created a session', /Session imported/.test(tcx.status), tcx.status);
  console.log('   preview:', tcx.previewText.replace(/\n/g, ' | '));
  const counts = sql(`select count(*) filter (where hr_bpm is not null and lat is null) || '/' || count(*) filter (where lat is not null and hr_bpm is null) || '/' || count(*) filter (where hr_bpm is not null and lat is not null) from measurements where session_id='${tcx.sessionId}'`);
  check('HR and GPS stored as SEPARATE rows (hr/gps/mixed)', counts === '4455/4500/0', counts);
  const srow = sql(`select started_at at time zone 'UTC', ended_at at time zone 'UTC', training_type, location_name, synced from sessions where id='${tcx.sessionId}'`);
  check('session row: UTC start/end, annotations', srow.startsWith('2026-10-25 09:30:00|2026-10-25 10:44:59|cross_country|Eventing Breda|t'), srow);

  // 2. The session page renders the imported ride like a recorded one.
  await page.goto(`${BASE}/sessions/${tcx.sessionId}`);
  await page.getByText('Session charts').waitFor({ timeout: 60000 });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${OUT}/shots/02-session-page.png`, fullPage: true });
  const body = await page.locator('main').innerText();
  check('session page shows charts and route', (await page.locator('svg[aria-label*="over time"]').count()) >= 2);
  check('KNOWN BUG: session page shows the ride in the reader zone (10:30 CET)', /10:30/.test(body), body.split('\n').slice(0, 6).join(' / '));

  // 3. Same file again -> "Already imported", nothing written twice.
  const before = sql(`select count(*) from measurements`);
  const again = await importFile(page, `${FILES}/polar-competition-2026-10-25.tcx`);
  const after = sql(`select count(*) from measurements`);
  check('re-import says "Already imported"', /Already imported/.test(again.status), again.status);
  check('re-import wrote no rows and no second session', before === after && again.sessionId === tcx.sessionId && sql(`select count(*) from sessions where horse_id='00000000-0000-0000-0000-00000000a001'`) === '1', `${before} -> ${after}`);

  // 4. FIT from a Mexico ride: RR intervals and time zone.
  const fit = await importFile(page, `${FILES}/polar-mexico-2026-10-26.fit`);
  check('FIT import created a session', /Session imported/.test(fit.status), fit.status);
  console.log('   preview:', fit.previewText.replace(/\n/g, ' | '));
  const rr = sql(`select count(*) from measurements where session_id='${fit.sessionId}' and rr_ms is not null`);
  check('FIT RR intervals stored on HR rows', Number(rr) > 3000, `${rr} HR rows carry rr_ms`);
  const fstart = sql(`select started_at at time zone 'America/Mexico_City' from sessions where id='${fit.sessionId}'`);
  check('FIT start is 09:00 in Mexico City', fstart.startsWith('2026-10-26 09:00:00'), fstart);
  await page.goto(`${BASE}/sessions/${fit.sessionId}`);
  await page.getByText('Session charts').waitFor({ timeout: 60000 });
  await page.screenshot({ path: `${OUT}/shots/03-fit-session.png`, fullPage: true });
  check('HRV panel has data for the FIT ride', !/no beat-to-beat|No RR/i.test(await page.locator('main').innerText()));

  // 5. Hostile files are refused with copy, nothing written.
  const n0 = sql('select count(*) from sessions');
  const ren = await importFile(page, `${FILES}/renamed.fit`, { expectPreview: false });
  check('renamed file (.fit with TCX inside) refused', /do not match its type/.test(ren.alert), ren.alert);
  const xxe = await importFile(page, `${FILES}/xxe.tcx`, { expectPreview: false });
  check('XXE file refused', /not accepted for safety reasons/.test(xxe.alert), xxe.alert);
  check('refusals wrote nothing', sql('select count(*) from sessions') === n0);

  // 6. Owner (read-only) has no import action and the API refuses them.
  const owner = await (await browser.newContext()).newPage();
  await login(owner, 'owner.a@e2e.local');
  await owner.goto(`${BASE}/sessions`);
  check('owner sees no "Import file"', (await owner.getByRole('link', { name: 'Import file' }).count()) === 0);
  await owner.goto(`${BASE}/sessions/import`);
  check('owner gets the read-only notice on /sessions/import', await owner.getByText('Only trainers can import').isVisible());
  const ownerApi = await owner.evaluate(async () => {
    const f = new FormData(); f.set('file', new Blob(['x']), 'a.tcx'); f.set('fileName', 'a.tcx');
    const r = await fetch('/api/import/preview', { method: 'POST', body: f }); return r.status;
  });
  check('owner POST /api/import/preview -> 403', ownerApi === 403, String(ownerApi));

  // 7. Trainer of another stable cannot see the imported ride.
  const other = await (await browser.newContext()).newPage();
  await login(other, 'trainer.b@e2e.local');
  const resp = await other.goto(`${BASE}/sessions/${tcx.sessionId}`);
  const otherBody = await other.locator('body').innerText();
  check('other stable sees a not-found page, no ride data', /not found|could not/i.test(otherBody) && !/Luna|Eventing Breda|bpm/.test(otherBody), `HTTP ${resp.status()} (streamed not-found renders as 200)`);

  // 8. Agenda smoke with the trainer: create an item on the horse agenda, see it.
  await page.goto(`${BASE}/horses/00000000-0000-0000-0000-00000000a001/agenda?view=week&date=2026-10-28`);
  await page.getByRole('button', { name: 'New item' }).click();
  const horseValue = await page.locator('select').filter({ hasText: 'Luna' }).first().inputValue();
  check('new item on horse agenda pre-selects the horse', horseValue === '00000000-0000-0000-0000-00000000a001', horseValue);
  await page.screenshot({ path: `${OUT}/shots/04-agenda-new-item.png`, fullPage: true });

  check('no browser console errors', consoleErrors.length === 0, consoleErrors.slice(0, 3).join(' || '));
  await browser.close();
  const failed = results.filter((r) => !r.ok).length;
  console.log(`\n${results.length - failed}/${results.length} checks passed`);
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
