#!/usr/bin/env node
// The one CLI. Every slash command in .claude/commands runs one of these.
//   npm run cropping -- <command> [name] --field=value [--json]
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { getDb, REPO_ROOT } from './lib/db.mjs';
import { table } from './lib/format.mjs';
import { page, table as htmlTable, writeOut } from './lib/render.mjs';
import { TABLES } from './lib/tables.mjs';
import { importAgworld } from './lib/import.mjs';

const CHEMICAL = ['herbicide', 'fungicide', 'insecticide'];

export const READS = {
  farms: 'select name, country, region, owner, spray_plan_review from farms order by name',
  fields: 'select fl.name, fm.name farm, fl.area_ha, fl.soil, fl.sensitive_note from fields fl join farms fm on fm.id = fl.farm_id order by fm.name, fl.name',
  crops: 'select name, field, season, crop, variety, status, sown_on, harvest_planned, last_application, last_scouted from crop_board order by season desc, name',
  'spray-diary': 'select crop, product, kind, applied_on, start_time, finish_time, rate_per_ha, area_ha, total_qty, unit, operator, equipment, target, wind_kmh, wind_dir, harvest_clear, record_lag_hours from application_register order by applied_on desc, crop',
  recommendations: 'select id, crop, product, rate_per_ha, unit, qty_needed, stock, due, recommended_by, reason, decision from recommendation_board order by (status = \'open\') desc, due',
  inventory: 'select name, kind, unit, stock, committed, available, expiry, whp_days, rei_hours, mode_group, decision from inventory_board order by kind, name',
  reentry: 'select * from reentry_board order by reentry_clear',
  scouting: 'select id, crop, observed_on, observer, issue, severity, note, days_open from scouting_board where not resolved order by severity = \'high\' desc, observed_on',
  rainfall: 'select * from rainfall_board order by farm',
  'harvest-check': 'select crop, field, crop_type, harvest_planned, harvest_clear, unknown_hold, decision from harvest_readiness order by harvest_planned nulls last, crop',
  harvests: 'select c.name crop, h.harvested_on, h.tonnes, h.moisture_pct, h.destination, h.reference from harvests h join crops c on c.id = h.crop_id order by h.harvested_on desc',
  margins: 'select * from margin_board order by season desc, crop',
  tasks: 'select t.id, t.name, f.name farm, t.due, t.owner, t.status from farm_tasks t join farms f on f.id = t.farm_id order by t.status, t.due',
  compliance: 'select * from compliance_findings order by rule, record',
  attention: 'select * from attention_board order by priority, kind, record',
};
export const MUTATIONS = ['add', 'sow', 'recommend', 'cancel-rec', 'spray', 'scout', 'resolve', 'harvest', 'rain', 'stock-in', 'task-add', 'task-done', 'log'];
export const COMMANDS = [...Object.keys(READS), 'crop', 'weekly-review', ...MUTATIONS, 'import', 'export', 'draft-spray-record', 'draft-recommendation', 'draft-audit', 'help'];

export function argsOf(args) {
  const flags = {}, pos = [];
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (!a.startsWith('--')) { pos.push(a); continue; }
    const eq = a.indexOf('=');
    if (eq >= 0) flags[a.slice(2, eq)] = a.slice(eq + 1);
    else if (['json', 'dry-run', 'help'].includes(a.slice(2))) flags[a.slice(2)] = true;
    else flags[a.slice(2)] = args[i + 1] && !args[i + 1].startsWith('--') ? args[++i] : true;
  }
  return { flags, pos };
}

const need = (f, k) => { if (typeof f[k] !== 'string' || !f[k].trim()) throw Error(`Required --${k}=...`); return f[k].trim(); };
const number = (f, k, { min = 0, integer = false, optional = false } = {}) => {
  if (optional && f[k] === undefined) return null;
  const n = Number(need(f, k));
  if (!Number.isFinite(n) || n < min || (integer && !Number.isInteger(n))) throw Error(`--${k} must be ${integer ? 'an integer' : 'a number'} >= ${min}`);
  return n;
};
const day = (v) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v) || new Date(`${v}T00:00:00Z`).toISOString().slice(0, 10) !== v) throw Error('Date must be a valid YYYY-MM-DD');
  return v;
};
const clock = (v, k) => { if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(v)) throw Error(`--${k} must be HH:MM`); return v; };
const iso = (v) => (v instanceof Date ? v.toISOString().slice(0, 10) : v == null ? null : String(v).slice(0, 10));
const today = async (db) => (await db.query('select current_date::text d'))[0].d;
const dated = async (db, f) => (f.date ? day(need(f, 'date')) : today(db));

export async function resolve(db, t, q) {
  if (!TABLES.includes(t)) throw Error('Unknown register');
  if (!q || typeof q !== 'string') throw Error(`Supply a name or id for ${t}`);
  const exact = await db.query(`select * from ${t} where lower(name) = lower($1) or id::text = $1`, [q]);
  const found = exact.length ? exact : await db.query(`select * from ${t} where position(lower($1) in lower(name)) > 0 or starts_with(id::text, $1) order by name`, [q]);
  if (found.length !== 1) throw Error(`${found.length ? 'Ambiguous' : 'No match'} ${t}: ${q}${found.length ? '\n' + found.map((r) => `${r.id}  ${r.name}`).join('\n') : ''}`);
  return found[0];
}
async function byId(db, t, q) {
  if (!q || q.length < 4) throw Error(`Supply at least the first 4 characters of the ${t} id`);
  const rows = await db.query(`select * from ${t} where starts_with(id::text, $1)`, [q]);
  if (rows.length !== 1) throw Error(`${rows.length ? 'Ambiguous' : 'No match'} ${t} id: ${q}`);
  return rows[0];
}
async function insert(db, t, values) {
  const cols = Object.keys(values);
  return (await db.query(`insert into ${t} (${cols.join(',')}) values (${cols.map((_, i) => '$' + (i + 1)).join(',')}) returning *`, Object.values(values)))[0];
}
const fieldOf = async (db, crop) => (await db.query('select * from fields where id = $1', [crop.field_id]))[0];

async function draft(db, cmd, q) {
  let title, name, sections, subtitle = 'DRAFT. Working record for the operator to check. Not a legal or certified document.';
  if (cmd === 'draft-spray-record') {
    const c = await resolve(db, 'crops', q); name = c.name; title = 'Spray application record';
    sections = [
      { title: c.name, html: htmlTable(await db.query('select b.field, b.farm, b.season, b.variety, b.sown_on, h.harvest_planned, h.harvest_clear, h.decision from harvest_readiness h join crop_board b on b.id = h.id where h.id = $1', [c.id])) },
      { title: 'Applications', html: htmlTable(await db.query('select applied_on, start_time, finish_time, product, rate_per_ha, area_ha, total_qty, unit, water_l_ha, target, operator, equipment, wind_kmh, wind_dir, temp_c, harvest_clear, reentry_clear, label_ref from application_register where id in (select id from applications where crop_id = $1) order by applied_on', [c.id])) },
    ];
  } else if (cmd === 'draft-recommendation') {
    const c = await resolve(db, 'crops', q); name = c.name; title = 'Agronomy recommendation';
    const recs = await db.query("select product, rate_per_ha, unit, qty_needed, due, recommended_by, reason, decision from recommendation_board where crop = $1 and status = 'open' order by due", [c.name]);
    if (!recs.length) throw Error(`No open recommendations for ${c.name}`);
    sections = [
      { title: `${c.name} (${(await fieldOf(db, c)).area_ha} ha)`, html: htmlTable(recs) },
      { title: 'Label checks before mixing', note: 'Confirm rate, withholding period, re-entry interval and buffer zones on the actual label.', html: htmlTable(await db.query("select distinct p.name, p.mode_group, p.whp_days, p.rei_hours, p.max_rate_per_ha, p.label_ref from recommendations r join products p on p.id = r.product_id where r.crop_id = $1 and r.status = 'open'", [c.id])) },
      { title: 'Open scouting notes', html: htmlTable(await db.query('select observed_on, observer, issue, severity, note from scouting_board where crop = $1 and not resolved', [c.name])) },
    ];
  } else if (cmd === 'draft-audit') {
    const farm = await resolve(db, 'farms', q); name = farm.name; title = 'Spray and harvest audit pack';
    sections = [
      { title: 'Findings', html: htmlTable(await db.query('select * from compliance_findings order by rule')) },
      { title: 'Spray diary', html: htmlTable(await db.query('select crop, product, applied_on, start_time, finish_time, rate_per_ha, area_ha, operator, equipment, wind_kmh, wind_dir, harvest_clear, record_lag_hours from application_register where farm = $1 order by applied_on', [farm.name])) },
      { title: 'Harvests', html: htmlTable(await db.query('select c.name crop, h.harvested_on, h.tonnes, h.destination, h.reference from harvests h join crops c on c.id = h.crop_id join fields f on f.id = c.field_id where f.farm_id = $1', [farm.id])) },
    ];
  } else throw Error(`Unknown command ${cmd}`);
  const file = writeOut('drafts', `${cmd}-${name.replace(/[^a-z0-9]+/gi, '-')}-${Date.now()}`, page({ title, subtitle, sections }));
  return { file, draft: true };
}

export async function execute(db, args) {
  const { flags: f, pos } = argsOf(args);
  const [cmd = 'help', q] = pos;
  if (cmd === 'help' || f.help) return { commands: COMMANDS, usage: 'npm run cropping -- <command> [name] --field=value [--json]', details: 'See docs/commands.md for required fields. Drafts write to drafts/ and never send.' };
  if (READS[cmd]) return db.query(READS[cmd]);
  if (cmd === 'crop') {
    const c = await resolve(db, 'crops', q);
    return {
      crop: (await db.query('select * from crop_board where id = $1', [c.id]))[0],
      applications: await db.query('select applied_on, product, rate_per_ha, total_qty, unit, operator, harvest_clear from application_register where id in (select id from applications where crop_id = $1) order by applied_on', [c.id]),
      recommendations: await db.query('select product, rate_per_ha, due, decision from recommendation_board where crop = $1 order by due', [c.name]),
      scouting: await db.query('select observed_on, issue, severity, resolved from scouting_board where crop = $1 order by observed_on', [c.name]),
      notes: await db.query('select body, author, created_at from notes where crop_id = $1 order by created_at', [c.id]),
    };
  }
  if (cmd === 'weekly-review') return { attention: await db.query(READS.attention), recommendations: await db.query(READS.recommendations), harvest: await db.query(READS['harvest-check']) };
  if (cmd === 'import') { if (q !== 'agworld') throw Error('Use: import agworld --farm=<farm> --fields=<csv> ...'); return importAgworld(db, f); }
  if (cmd === 'export') {
    const out = { format: 'cropping-v1', exported_at: new Date().toISOString(), tables: {} };
    await db.exec('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
    try {
      for (const t of TABLES) out.tables[t] = await db.query(`select * from ${t} order by ${t === 'import_rows' ? 'hash' : 'id'}`);
      await db.exec('COMMIT');
    } catch (e) { await db.exec('ROLLBACK'); throw e; }
    const file = path.resolve(f.file || path.join(REPO_ROOT, 'exports', `cropping-${Date.now()}.json`));
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify(out, null, 2));
    return { file, tables: TABLES.length, rows: Object.values(out.tables).reduce((n, a) => n + a.length, 0) };
  }
  if (cmd.startsWith('draft-')) return draft(db, cmd, q);
  if (!MUTATIONS.includes(cmd)) throw Error(`Unknown command ${cmd}. Run help.`);

  await db.exec('BEGIN');
  try {
    let result;
    const now = await today(db);
    if (cmd === 'add') {
      if (q === 'farm') result = await insert(db, 'farms', { name: need(f, 'name'), country: need(f, 'country').toUpperCase(), region: f.region || '', owner: f.owner || '' });
      else if (q === 'field') {
        const farm = await resolve(db, 'farms', need(f, 'farm'));
        result = await insert(db, 'fields', { farm_id: farm.id, name: need(f, 'name'), area_ha: number(f, 'area', { min: 0.01 }), soil: f.soil || '', sensitive_note: f.sensitive || '' });
      } else if (q === 'product') {
        const kind = need(f, 'kind').toLowerCase();
        if (CHEMICAL.includes(kind) && (f.whp === undefined || !f.label)) throw Error('Chemical products need --whp and --label from the actual label');
        result = await insert(db, 'products', { name: need(f, 'name'), kind, unit: need(f, 'unit'), stock: number(f, 'stock'), cost_per_unit: number(f, 'cost', { optional: true }) ?? 0,
          max_rate_per_ha: number(f, 'max-rate', { min: 0.0001, optional: true }), whp_days: number(f, 'whp', { integer: true, optional: true }), rei_hours: number(f, 'rei', { integer: true, optional: true }),
          mode_group: f.group || '', label_ref: f.label || '', expiry: f.expiry ? day(need(f, 'expiry')) : null });
      } else if (q === 'crop') {
        const field = await resolve(db, 'fields', need(f, 'field'));
        const season = need(f, 'season'), crop = need(f, 'crop').toLowerCase();
        result = await insert(db, 'crops', { field_id: field.id, name: f.name || `${field.name} ${crop[0].toUpperCase() + crop.slice(1)} ${season}`, season, crop, variety: f.variety || '',
          target_t_ha: number(f, 'target', { optional: true }), price_per_t: number(f, 'price', { optional: true }) ?? 0 });
      } else throw Error('add supports farm, field, product, crop');
    } else if (cmd === 'sow') {
      const c = await resolve(db, 'crops', q);
      if (c.status !== 'planned') throw Error(`${c.name} is ${c.status}, not planned`);
      const date = await dated(db, f);
      if (date > now) throw Error('Sowing date cannot be in the future');
      result = (await db.query("update crops set status = 'sown', sown_on = $1, variety = coalesce(nullif($2, ''), variety), harvest_planned = coalesce($3::date, harvest_planned) where id = $4 returning *",
        [date, f.variety || '', f.harvest ? day(f.harvest) : null, c.id]))[0];
    } else if (cmd === 'recommend') {
      const c = await resolve(db, 'crops', q), p = await resolve(db, 'products', need(f, 'product'));
      const rate = number(f, 'rate', { min: 0.0001 });
      if (p.max_rate_per_ha !== null && rate > Number(p.max_rate_per_ha)) throw Error(`Rate ${rate} is above the recorded label maximum ${p.max_rate_per_ha} for ${p.name}`);
      result = await insert(db, 'recommendations', { crop_id: c.id, product_id: p.id, rate_per_ha: rate, due: day(need(f, 'due')), recommended_by: need(f, 'by'), reason: f.reason || '' });
    } else if (cmd === 'cancel-rec') {
      const r = await byId(db, 'recommendations', q);
      if (r.status !== 'open') throw Error(`Recommendation is ${r.status}`);
      result = (await db.query("update recommendations set status = 'cancelled' where id = $1 returning *", [r.id]))[0];
      await insert(db, 'notes', { crop_id: r.crop_id, body: `Recommendation cancelled: ${need(f, 'reason')}`, author: need(f, 'by') });
    } else if (cmd === 'spray') {
      const c = await resolve(db, 'crops', q);
      if (['harvested', 'failed'].includes(c.status)) throw Error(`${c.name} is ${c.status}`);
      const p0 = await resolve(db, 'products', need(f, 'product'));
      const p = (await db.query('select * from products where id = $1 for update', [p0.id]))[0];
      const date = await dated(db, f);
      if (date > now) throw Error('Completed applications cannot be future dated');
      if (p.expiry && iso(p.expiry) < date) throw Error(`Product expired on ${iso(p.expiry)}`);
      const field = await fieldOf(db, c), rate = number(f, 'rate', { min: 0.0001 });
      const area = f.area === undefined ? Number(field.area_ha) : number(f, 'area', { min: 0.01 });
      if (area > Number(field.area_ha)) throw Error(`Area ${area} ha is larger than ${field.name} (${field.area_ha} ha)`);
      if (p.max_rate_per_ha !== null && rate > Number(p.max_rate_per_ha)) throw Error(`Rate ${rate} is above the recorded label maximum ${p.max_rate_per_ha} for ${p.name}`);
      const qty = Math.round(rate * area * 1000) / 1000;
      if (qty > Number(p.stock)) throw Error(`Insufficient stock: need ${qty} ${p.unit}, have ${p.stock}`);
      const chemical = CHEMICAL.includes(p.kind);
      if (chemical && (p.whp_days === null || !p.label_ref)) throw Error(`${p.name} has no withholding period or label reference recorded. Add them before spraying.`);
      const row = { crop_id: c.id, product_id: p.id, product: p.name, kind: p.kind, applied_on: date, rate_per_ha: rate, area_ha: area, total_qty: qty,
        water_l_ha: number(f, 'water', { optional: true }), whp_days: p.whp_days, rei_hours: p.rei_hours, label_ref: p.label_ref, cost: Math.round(qty * Number(p.cost_per_unit) * 100) / 100 };
      if (chemical) Object.assign(row, { start_time: clock(need(f, 'start'), 'start'), finish_time: clock(need(f, 'finish'), 'finish'), operator: need(f, 'operator'), equipment: need(f, 'equipment'),
        target: need(f, 'target'), wind_kmh: number(f, 'wind'), wind_dir: need(f, 'wind-dir').toUpperCase(), temp_c: f.temp === undefined ? null : Number(f.temp) });
      else Object.assign(row, { operator: f.operator || '', equipment: f.equipment || '', target: f.target || '', start_time: f.start ? clock(f.start, 'start') : null, finish_time: f.finish ? clock(f.finish, 'finish') : null });
      if (row.finish_time && row.start_time && row.finish_time < row.start_time) throw Error('--finish is before --start');
      let rec = null;
      if (f.rec) {
        rec = await byId(db, 'recommendations', need(f, 'rec'));
        if (rec.status !== 'open' || rec.crop_id !== c.id || rec.product_id !== p.id) throw Error('That recommendation is not open for this crop and product');
        row.recommendation_id = rec.id;
      }
      result = await insert(db, 'applications', { ...row, recorded_at: (await db.query('select localtimestamp::text t'))[0].t });
      await db.query('update products set stock = stock - $1 where id = $2', [qty, p.id]);
      if (rec) await db.query("update recommendations set status = 'applied', application_id = $1 where id = $2", [result.id, rec.id]);
      if (c.status === 'sown' && c.harvest_planned && p.whp_days !== null) {
        const clear = (await db.query('select ($1::date + $2::int)::text d', [date, p.whp_days]))[0].d;
        if (clear > iso(c.harvest_planned)) result.warning = `Harvest planned ${iso(c.harvest_planned)} is now inside the withholding period (clears ${clear})`;
      }
    } else if (cmd === 'scout') {
      const c = await resolve(db, 'crops', q), date = await dated(db, f);
      if (date > now) throw Error('Observations cannot be future dated');
      const severity = need(f, 'severity').toLowerCase();
      result = await insert(db, 'observations', { crop_id: c.id, observed_on: date, observer: need(f, 'by'), issue: need(f, 'issue'), severity, note: f.note || '' });
    } else if (cmd === 'resolve') {
      const o = await byId(db, 'observations', q);
      result = (await db.query('update observations set resolved = true, note = note || $1 where id = $2 returning *', [` | Resolved: ${need(f, 'note')}`, o.id]))[0];
    } else if (cmd === 'harvest') {
      const c = await resolve(db, 'crops', q), date = await dated(db, f);
      if (date > now) throw Error('Harvest records cannot be future dated');
      if (!['sown', 'harvested'].includes(c.status)) throw Error(`${c.name} is ${c.status}`);
      const b = (await db.query('select harvest_clear::text, unknown_hold from crop_board where id = $1', [c.id]))[0];
      if (b.unknown_hold) throw Error('Harvest blocked: HOLD UNKNOWN. A chemical application has no withholding period or label reference.');
      if (b.harvest_clear && date < b.harvest_clear) throw Error(`Harvest blocked: WHP HOLD until ${b.harvest_clear}`);
      result = await insert(db, 'harvests', { crop_id: c.id, harvested_on: date, tonnes: number(f, 'tonnes', { min: 0.001 }), moisture_pct: number(f, 'moisture', { optional: true }), destination: f.destination || '', reference: need(f, 'reference') });
      if (f.final !== 'no') await db.query("update crops set status = 'harvested' where id = $1", [c.id]);
    } else if (cmd === 'rain') {
      const farm = await resolve(db, 'farms', q), date = await dated(db, f);
      if (date > now) throw Error('Rainfall cannot be future dated');
      result = (await db.query('insert into rainfall (farm_id, fell_on, mm) values ($1, $2, $3) on conflict (farm_id, fell_on) do update set mm = excluded.mm returning *', [farm.id, date, number(f, 'mm')]))[0];
    } else if (cmd === 'stock-in') {
      const p = await resolve(db, 'products', q);
      result = (await db.query('update products set stock = stock + $1, expiry = coalesce($2::date, expiry) where id = $3 returning *', [number(f, 'qty', { min: 0.001 }), f.expiry ? day(f.expiry) : null, p.id]))[0];
    } else if (cmd === 'task-add') {
      const farm = await resolve(db, 'farms', need(f, 'farm'));
      result = await insert(db, 'farm_tasks', { farm_id: farm.id, name: need(f, 'name'), due: day(need(f, 'due')), owner: need(f, 'owner') });
    } else if (cmd === 'task-done') {
      const t = await byId(db, 'farm_tasks', q);
      result = (await db.query("update farm_tasks set status = 'done' where id = $1 returning *", [t.id]))[0];
    } else if (cmd === 'log') {
      const c = await resolve(db, 'crops', q);
      result = await insert(db, 'notes', { crop_id: c.id, body: need(f, 'note'), author: need(f, 'by') });
    }
    await db.exec('COMMIT');
    return result;
  } catch (e) {
    await db.exec('ROLLBACK');
    throw e;
  }
}

function print(value) {
  if (Array.isArray(value)) {
    const cols = value.length ? Object.keys(value[0]).filter((k) => !['created_at', 'updated_at'].includes(k) && !(k === 'id' && !['recommendations', 'scouting', 'tasks'].includes(print.cmd))) : [];
    console.log(table(value, cols.map((k) => ({ key: k, label: k.replaceAll('_', ' '), format: (v) => (k === 'id' ? String(v).slice(0, 8) : v instanceof Date ? v.toISOString().slice(0, 10) : v) }))));
    return;
  }
  for (const [k, v] of Object.entries(value || {})) {
    if (Array.isArray(v) || (v && typeof v === 'object' && !(v instanceof Date))) { console.log(`\n${k}`); print(Array.isArray(v) ? v : [v]); }
    else console.log(`${k}: ${v instanceof Date ? v.toISOString() : v ?? ''}`);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const args = process.argv.slice(2);
  const { flags, pos } = argsOf(args);
  print.cmd = pos[0];
  let db;
  try {
    db = await getDb();
    const result = await execute(db, args);
    if (flags.json) console.log(JSON.stringify(result, null, 2));
    else print(result);
  } catch (e) {
    if (flags.json) console.error(JSON.stringify({ error: e.message }));
    else console.error(e.message);
    process.exitCode = 1;
  } finally {
    if (db) await db.close();
  }
}
