#!/usr/bin/env node
// npm test: a disposable embedded database, migrate, seed, every command, the gates, the import, the
// documents and the views. Prints PASS or throws.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cropping-smoke-'));
process.env.DATABASE_URL = '';
process.env.DATA_DIR = path.join(tmp, 'db');
const { getDb, REPO_ROOT } = await import('./lib/db.mjs');
const { migrate } = await import('./migrate.mjs');
const { execute, READS, COMMANDS } = await import('./cropping.mjs');

let db, checks = 0;
const covered = new Set();
const run = async (cmd, ...args) => { covered.add(cmd); checks++; return execute(db, [cmd, ...args.map(String)]); };
const rejects = async (cmd, args, pattern) => { await assert.rejects(() => run(cmd, ...args), pattern); };
const scalar = async (sql, params = []) => Object.values((await db.query(sql, params))[0])[0];
const stock = async (name) => Number(await scalar('select stock from products where name = $1', [name]));
const cli = (args, status = 0) => {
  const r = spawnSync(process.execPath, ['scripts/cropping.mjs', ...args], { cwd: REPO_ROOT, env: process.env, encoding: 'utf8' });
  assert.equal(r.status, status, r.stderr); checks++; return r;
};

try {
  db = await getDb();
  assert.equal((await migrate(db)).ran.length, 1);
  assert.equal((await migrate(db)).ran.length, 0);
  const seed = fs.readFileSync(path.join(REPO_ROOT, 'supabase/seed.sql'), 'utf8');
  await db.exec(seed); await db.exec(seed);
  assert.equal(Number(await scalar('select count(*) from crops')), 5);
  const today = await scalar('select current_date::text');
  const date = (n) => new Date(Date.parse(`${today}T00:00:00Z`) + n * 86400000).toISOString().slice(0, 10);

  // Every read has something to say on the demo farm.
  for (const cmd of Object.keys(READS)) assert.ok((await run(cmd)).length, `${cmd} has demo records`);
  const decision = async (crop) => (await run('harvest-check')).find((x) => x.crop === crop).decision;
  assert.equal(await decision('Creek Block Canola 2026'), 'WHP HOLD');
  assert.equal(await decision('Home Paddock Wheat 2026'), 'READY FOR REVIEW');
  assert.equal(await decision('Top Hill Barley 2026'), 'NO HARVEST DATE');
  const recs = await run('recommendations');
  assert.equal(recs.find((r) => r.crop === 'Home Paddock Wheat 2026').decision, 'STOCK SHORT');
  assert.equal(recs.find((r) => r.reason.startsWith('Late weed')).decision, 'OVERDUE');
  const rules = new Set((await run('compliance')).map((x) => x.rule));
  for (const r of ['SPRAY-RECORD', 'SPRAY-48H', 'SPRAY-LABEL', 'SPRAY-RATE', 'HARVEST-WHP', 'SPRAY-PLAN', 'INVENTORY-EXPIRED']) assert.ok(rules.has(r), `demo shows ${r}`);
  assert.equal((await run('reentry')).length, 1);
  assert.equal(Number((await run('margins')).find((x) => x.crop === 'Back Flat Chickpeas 2025').recorded_margin), 90 * 700 - 384 - 600);

  // Names: exact, partial, id, ambiguous, missing.
  assert.equal((await run('crop', 'home paddock')).crop.name, 'Home Paddock Wheat 2026');
  assert.equal((await run('crop', '40000000-0000-0000-0000-000000000002')).crop.name, 'Creek Block Canola 2026');
  await rejects('crop', ['Barley'], /Ambiguous.*\n.*Barley.*\n.*Barley/s);
  await rejects('crop', ['Sorghum'], /No match/);
  const weekly = await run('weekly-review');
  assert.ok(weekly.attention.length && weekly.recommendations.length && weekly.harvest.length);
  assert.ok((await run('help')).commands.includes('spray'));

  // Spray gates. A refused spray leaves the shed untouched.
  const knock = await stock('Demo Knockdown 540');
  const good = ['--product=Demo Knockdown 540', '--rate=1.2', '--start=06:00', '--finish=08:00', '--operator=Chris', '--equipment=Boomspray 1', '--target=Weeds', '--wind=8', '--wind-dir=sw'];
  await rejects('spray', ['Creek Block', ...good.map((a) => a.replace('Demo Knockdown 540', 'Expired Demo Herbicide C'))], /expired/);
  await rejects('spray', ['Creek Block', ...good.map((a) => a.replace('1.2', '3.5'))], /above the recorded label maximum/);
  await rejects('spray', ['Creek Block', ...good.filter((a) => !a.startsWith('--wind'))], /--wind/);
  await rejects('spray', ['Creek Block', ...good, '--area=500'], /larger than Creek Block/);
  await rejects('spray', ['Creek Block', ...good, `--date=${date(1)}`], /future/);
  await rejects('spray', ['Creek Block', ...good, '--start=09:00'], /before --start/);
  await rejects('spray', ['Back Flat', ...good], /harvested/);
  await rejects('spray', ['Top Hill', ...good, '--rec=64000000'], /not open for this crop/);
  assert.equal(await stock('Demo Knockdown 540'), knock);
  const sprayed = await run('spray', 'Creek Block', ...good, '--rec=64000000');
  assert.equal(Number(sprayed.total_qty), 102);
  assert.equal(await stock('Demo Knockdown 540'), knock - 102);
  assert.equal(await scalar("select status from recommendations where id::text like '64000000%'"), 'applied');
  assert.equal(Number((await run('spray-diary')).find((x) => x.product === 'Demo Knockdown 540' && x.applied_on === today).record_lag_hours) <= 48, true);

  // Stock short until the delivery lands, then the spray pushes harvest inside the withholding period.
  await rejects('spray', ['Home Paddock', '--product=Demo Fungicide A', '--rate=0.4', '--start=06:00', '--finish=09:00', '--operator=Chris', '--equipment=Boomspray 1', '--target=Stripe rust', '--wind=10', '--wind-dir=W'], /Insufficient stock/);
  await run('stock-in', 'Demo Fungicide A', '--qty=60', `--expiry=${date(500)}`);
  const late = await run('spray', 'Home Paddock', '--product=Demo Fungicide A', '--rate=0.4', '--start=06:00', '--finish=09:00', '--operator=Chris', '--equipment=Boomspray 1', '--target=Stripe rust', '--wind=10', '--wind-dir=W', '--rec=61000000');
  assert.match(late.warning, /inside the withholding period/);
  assert.equal(await decision('Home Paddock Wheat 2026'), 'WHP HOLD');

  // A late record is found by the 48 hour rule.
  await run('spray', 'Creek Block', ...good.map((a) => a.replace('1.2', '0.5')), `--date=${date(-3)}`);
  assert.ok((await run('compliance')).some((x) => x.rule === 'SPRAY-48H' && x.record.includes(date(-3))));

  // Harvest gates and the boundary day: harvest is allowed on the day the withholding period clears.
  await rejects('harvest', ['Creek Block', '--tonnes=150', '--reference=L1'], /WHP HOLD until/);
  await run('add', 'farm', '--name=Test Farm', '--country=nz', '--region=Canterbury');
  await run('add', 'field', '--farm=Test Farm', '--name=Test Field', '--area=10');
  await rejects('add', ['product', '--name=No Label', '--kind=herbicide', '--unit=L', '--stock=10'], /--whp and --label/);
  await run('add', 'product', '--name=Test Spray', '--kind=fungicide', '--unit=L', '--stock=10', '--cost=10', '--max-rate=1', '--whp=5', '--rei=12', '--label=Test label', `--expiry=${date(100)}`);
  await run('add', 'crop', '--field=Test Field', '--season=2026', '--crop=oats', '--target=4', '--price=300');
  await rejects('spray', ['Test Field Oats', '--product=Urea 46', '--rate=50', '--date=2026-02-30'], /valid YYYY-MM-DD/);
  await run('sow', 'Test Field Oats', `--date=${date(-30)}`, '--variety=Demo Oat', `--harvest=${date(-2)}`);
  await rejects('sow', ['Test Field Oats'], /not planned/);
  await run('spray', 'Test Field Oats', '--product=Urea 46', '--rate=50', `--date=${date(-20)}`);
  await run('spray', 'Test Field Oats', '--product=Test Spray', '--rate=0.5', `--date=${date(-7)}`, '--start=07:00', '--finish=07:30', '--operator=Jo', '--equipment=Quad', '--target=Rust', '--wind=5', '--wind-dir=N');
  await rejects('harvest', ['Test Field Oats', '--tonnes=40', '--reference=T1', `--date=${date(-3)}`], /WHP HOLD until/);
  const h = await run('harvest', 'Test Field Oats', '--tonnes=40', '--moisture=12', '--reference=T1', `--date=${date(-2)}`);
  assert.equal(Number(h.tonnes), 40);
  assert.ok(!(await run('compliance')).some((x) => x.rule === 'HARVEST-WHP' && x.record.startsWith('Test Field Oats')));
  const m = (await run('margins')).find((x) => x.crop === 'Test Field Oats 2026');
  assert.equal(Number(m.recorded_margin), 40 * 300 - 50 * 10 * 0.9 - 5 * 10);

  // Recommendations, scouting, rain, tasks, notes.
  await rejects('recommend', ['Top Hill', '--product=Demo Insecticide B', '--rate=0.5', `--due=${date(3)}`, '--by=Alex'], /label maximum/);
  const rec = await run('recommend', 'Top Hill', '--product=Demo Insecticide B', '--rate=0.2', `--due=${date(3)}`, '--by=Alex', '--reason=Aphids over threshold');
  await run('cancel-rec', rec.id.slice(0, 8), '--reason=Beneficials took over', '--by=Alex');
  await rejects('cancel-rec', [rec.id.slice(0, 8), '--reason=again', '--by=Alex'], /cancelled/);
  const obs = await run('scout', 'Top Hill', '--issue=Aphids', '--severity=medium', '--by=Alex');
  assert.ok(!(await run('attention')).some((x) => x.kind === 'unscouted' && x.record === 'Top Hill Barley 2026'));
  await rejects('scout', ['Top Hill', '--issue=x', '--severity=extreme', '--by=Alex'], /check constraint/);
  await run('resolve', obs.id.slice(0, 8), '--note=Beneficials present');
  await run('rain', 'Kowhai', '--mm=6'); await run('rain', 'Kowhai', '--mm=8');
  assert.equal(Number((await run('rainfall')).find((x) => x.farm === 'Kowhai Flats Demo').last_7_days_mm), 8);
  const task = await run('task-add', '--farm=Yarrabee', '--name=Check nozzles', `--due=${today}`, '--owner=Chris');
  await run('task-done', task.id.slice(0, 8));
  await run('log', 'Top Hill', '--note=Harvest date to be set after moisture test', '--by=Chris');
  assert.equal((await run('crop', 'Top Hill')).notes.length, 2, 'the cancelled recommendation and the log');

  // Drafts write to drafts/ and say DRAFT.
  for (const [cmd, args] of [['draft-spray-record', ['Creek Block']], ['draft-recommendation', ['Top Hill']], ['draft-audit', ['Yarrabee']]]) {
    const d = await run(cmd, ...args);
    const html = fs.readFileSync(d.file, 'utf8');
    assert.match(html, /DRAFT/); assert.match(html, /Yarrabee Demo/);
    fs.unlinkSync(d.file);
  }
  await rejects('draft-recommendation', ['Back Flat'], /No open recommendations/);

  // Import: dry run writes nothing, the real run lands, a replay skips, a bad row rolls the batch back.
  const files = {
    fields: 'Field Name,Area (ha),Soil\nImport Paddock,30,Loam\n',
    crops: `Field,Season,Crop,Variety,Sowing Date\nImport Paddock,2026,Wheat,Demo,${date(-90).split('-').reverse().join('/')}\n`,
    applications: `Field,Season,Date,Product,Product Type,Rate,Operator,Equipment,Target,Start Time,Finish Time,Wind Speed (km/h),Wind Direction,Cost\nImport Paddock,2026,${date(-40)},Mystery Spray,Herbicide,1.1,Jo,Rig,Ryegrass,7:00,8:30,9,SE,120\nImport Paddock,2026,${date(-30)},Demo Knockdown 540,,1.0,Jo,Rig,Weeds,07:00,08:00,6,S,195\n`,
    harvests: `Field,Season,Harvest Date,Tonnes,Moisture,Load\nImport Paddock,2025,${date(-300)},10,11,OLD-1\n`,
  };
  const flags = ['agworld', '--farm=Yarrabee Demo'];
  for (const [k, v] of Object.entries(files)) { if (k === 'harvests') continue; const file = path.join(tmp, `${k}.csv`); fs.writeFileSync(file, v); flags.push(`--${k}=${file}`); }
  assert.equal((await run('import', ...flags, '--dry-run')).imported, 4);
  assert.equal(Number(await scalar('select count(*) from import_rows')), 0);
  assert.equal((await run('import', ...flags)).imported, 4);
  assert.equal((await run('import', ...flags)).skipped, 4);
  assert.equal(await decision('Import Paddock Wheat 2026'), 'NO HARVEST DATE');
  const imported = (await run('crop', 'Import Paddock')).crop;
  assert.equal(imported.unknown_hold, true, 'an unknown product brings no withholding period, so the crop holds');
  await rejects('harvest', ['Import Paddock', '--tonnes=5', '--reference=X'], /HOLD UNKNOWN/);
  const hv = path.join(tmp, 'harvests.csv'); fs.writeFileSync(hv, files.harvests);
  await rejects('import', ['agworld', '--farm=Yarrabee Demo', `--harvests=${hv}`], /harvests row 2: no crop on Import Paddock in season 2025/);
  const bad = path.join(tmp, 'bad.csv');
  fs.writeFileSync(bad, 'Field,Area\nRollback Paddock,10\nBroken Paddock,ten\n');
  await rejects('import', ['agworld', '--farm=Yarrabee Demo', `--fields=${bad}`], /fields row 3/);
  assert.equal((await db.query("select 1 from fields where name = 'Rollback Paddock'")).length, 0);
  fs.writeFileSync(bad, 'Field,Area\n"Broken,10\n');
  await rejects('import', ['agworld', '--farm=Yarrabee Demo', `--fields=${bad}`], /Quote/);
  await rejects('import', ['agworld', '--farm=Nowhere', `--fields=${bad}`], /no farm named/);

  // The shipped example exports import cleanly.
  await run('add', 'farm', '--name=Fixture Farm', '--country=AU', '--region=NSW');
  const fx = (k) => `--${k}=${path.join(REPO_ROOT, 'fixtures', 'agworld', `${k}.csv`)}`;
  assert.deepEqual((await run('import', 'agworld', '--farm=Fixture Farm', fx('fields'), fx('crops'), fx('applications'), fx('harvests'))).by_kind, { fields: 2, crops: 3, applications: 2, harvests: 1 });

  const exported = await run('export', `--file=${path.join(tmp, 'backup.json')}`);
  const backup = JSON.parse(fs.readFileSync(exported.file, 'utf8'));
  assert.equal(Object.keys(backup.tables).length, 12);
  assert.ok(backup.tables.applications.length >= 10);

  await db.close(); db = null;
  const rendered = [];
  for (const script of ['view.mjs', 'docs.mjs']) {
    const r = spawnSync(process.execPath, [`scripts/${script}`], { cwd: REPO_ROOT, env: process.env, encoding: 'utf8' });
    assert.equal(r.status, 0, r.stderr);
    for (const line of r.stdout.split('\n')) { const mm = /^(?:view|doc): (.+)$/.exec(line); if (mm) rendered.push(path.join(REPO_ROOT, mm[1])); }
  }
  assert.ok(rendered.length >= 8, `rendered ${rendered.length}`);
  for (const file of rendered) { assert.match(fs.readFileSync(file, 'utf8'), /Yarrabee Demo/); fs.unlinkSync(file); }
  assert.ok(JSON.parse(cli(['crops', '--json']).stdout).length >= 7);
  const human = cli(['harvest-check']).stdout;
  assert.match(human, /WHP HOLD/); assert.doesNotMatch(human, /GMT/);
  assert.match(cli(['crop', 'Barley'], 1).stderr, /Ambiguous/);
  assert.match(cli(['does-not-exist'], 1).stderr, /Unknown command/);

  const missing = COMMANDS.filter((c) => !covered.has(c));
  assert.deepEqual(missing, []);
  console.log(`PASS: ${checks} checks; ${COMMANDS.length} CLI commands exercised; spray and harvest gates, stock rollback, 48 hour rule, withholding boundary, CSV dry run and replay, documents and views verified.`);
} finally {
  if (db) await db.close();
  fs.rmSync(tmp, { recursive: true, force: true });
}
