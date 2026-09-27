// `import agworld`: bring fields, crops, application history and harvests across from CSV exports.
// Headers are matched case-insensitively against the aliases below. The whole batch runs in one
// transaction: any bad row rolls everything back. Identical rows replay without duplicates.
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { parse } from 'csv-parse/sync';

const ALIASES = {
  field: ['Field', 'Field Name', 'Paddock', 'Paddock Name', 'Block'],
  area: ['Area (ha)', 'Area', 'Hectares', 'Field Area (ha)', 'Size (ha)'],
  season: ['Season', 'Season Name', 'Year'],
  crop: ['Crop', 'Crop Type', 'Commodity'],
  variety: ['Variety', 'Cultivar'],
  sown: ['Sowing Date', 'Sown Date', 'Planting Date', 'Seeding Date'],
  date: ['Date', 'Activity Date', 'Application Date', 'Completed Date', 'Harvest Date'],
  product: ['Product', 'Product Name', 'Input'],
  kind: ['Product Type', 'Type', 'Category'],
  rate: ['Rate', 'Rate per ha', 'Rate/ha', 'Application Rate'],
  applied_area: ['Applied Area (ha)', 'Area Applied', 'Area (ha)', 'Area'],
  operator: ['Operator', 'Applicator', 'Applied By', 'User'],
  equipment: ['Equipment', 'Machine', 'Rig'],
  target: ['Target', 'Pest', 'Reason'],
  start: ['Start Time', 'Start'],
  finish: ['Finish Time', 'End Time', 'Finish'],
  wind: ['Wind Speed (km/h)', 'Wind Speed'],
  wind_dir: ['Wind Direction'],
  temp: ['Temperature (C)', 'Temperature'],
  water: ['Water Rate (L/ha)', 'Water Rate'],
  whp: ['WHP (days)', 'WHP', 'Withholding Period'],
  cost: ['Cost', 'Total Cost'],
  tonnes: ['Yield (t)', 'Tonnes', 'Total Yield (t)', 'Quantity (t)'],
  moisture: ['Moisture (%)', 'Moisture'],
  reference: ['Load', 'Reference', 'Ticket', 'Docket'],
};
const KINDS = { herbicide: 'herbicide', fungicide: 'fungicide', insecticide: 'insecticide', fertiliser: 'fertiliser', fertilizer: 'fertiliser', nutrition: 'fertiliser', seed: 'seed', adjuvant: 'adjuvant' };

const get = (r, k) => {
  for (const a of ALIASES[k] || [k]) {
    const key = Object.keys(r).find((x) => x.trim().toLowerCase() === a.toLowerCase());
    if (key && String(r[key]).trim()) return String(r[key]).trim();
  }
  return '';
};
const req = (r, k) => { const v = get(r, k); if (!v) throw Error(`missing ${k} (accepted headers: ${(ALIASES[k] || [k]).join(', ')})`); return v; };
const num = (v, label, { min = 0 } = {}) => {
  if (!/^-?\d+(\.\d+)?$/.test(v)) throw Error(`${label}: plain number required, got "${v}"`);
  const n = Number(v);
  if (n < min) throw Error(`${label} must be >= ${min}`);
  return n;
};
const opt = (v, label) => (v === '' ? null : num(v, label));
export function date(v) {
  let s = v;
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(v);
  if (m) s = `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s) || new Date(`${s}T00:00:00Z`).toISOString().slice(0, 10) !== s) throw Error(`invalid date "${v}": use YYYY-MM-DD or DD/MM/YYYY`);
  return s;
}
const time = (v) => { if (!v) return null; if (!/^([01]?\d|2[0-3]):[0-5]\d$/.test(v)) throw Error(`invalid time "${v}": use HH:MM`); return v.padStart(5, '0'); };
async function insert(db, t, r) {
  const cols = Object.keys(r);
  return (await db.query(`insert into ${t} (${cols.join(',')}) values (${cols.map((_, i) => '$' + (i + 1)).join(',')}) returning *`, Object.values(r)))[0];
}
async function one(db, sql, params, what) {
  const rows = await db.query(sql, params);
  if (rows.length !== 1) throw Error(`${rows.length ? 'more than one' : 'no'} ${what}`);
  return rows[0];
}

export async function importAgworld(db, f) {
  const kinds = ['fields', 'crops', 'applications', 'harvests'];
  for (const k of Object.keys(f)) if (![...kinds, 'farm', 'dry-run', 'json'].includes(k)) throw Error(`Unknown import option --${k}`);
  if (!kinds.some((k) => f[k])) throw Error('Provide at least one of --fields, --crops, --applications, --harvests');
  const farm = await one(db, 'select * from farms where lower(name) = lower($1)', [String(f.farm || '')], `farm named "${f.farm || ''}" (use --farm=<exact farm name>)`);
  const report = { dry_run: !!f['dry-run'], imported: 0, skipped: 0, by_kind: {} };
  await db.exec('BEGIN');
  try {
    for (const kind of kinds) {
      if (!f[kind]) continue;
      const rows = parse(fs.readFileSync(f[kind], 'utf8'), {
        bom: true, skip_empty_lines: true, trim: true,
        columns: (headers) => { const h = headers.map((x) => x.trim()); if (new Set(h.map((x) => x.toLowerCase())).size !== h.length) throw Error('Duplicate CSV headers'); return h; },
      });
      if (!rows.length) throw Error(`${kind}: no rows`);
      report.by_kind[kind] = 0;
      for (let i = 0; i < rows.length; i++) {
        const r = rows[i];
        const hash = createHash('sha256').update(JSON.stringify([farm.id, kind, Object.entries(r).sort()])).digest('hex');
        if ((await db.query('select 1 from import_rows where hash = $1', [hash])).length) { report.skipped++; continue; }
        try {
          if (kind === 'fields') {
            await insert(db, 'fields', { farm_id: farm.id, name: req(r, 'field'), area_ha: num(req(r, 'area'), 'area', { min: 0.001 }), soil: get(r, 'Soil') });
          } else {
            const field = await one(db, 'select * from fields where lower(name) = lower($1) and farm_id = $2', [req(r, 'field'), farm.id], `field "${get(r, 'field')}" on ${farm.name}`);
            const season = req(r, 'season');
            if (kind === 'crops') {
              const crop = req(r, 'crop').toLowerCase(), sown = get(r, 'sown');
              await insert(db, 'crops', { field_id: field.id, season, crop, variety: get(r, 'variety'), name: `${field.name} ${crop[0].toUpperCase() + crop.slice(1)} ${season}`,
                status: sown ? 'sown' : 'planned', sown_on: sown ? date(sown) : null });
            } else {
              const cropName = get(r, 'crop');
              const crop = await one(db, 'select * from crops where field_id = $1 and season = $2 and ($3 = \'\' or lower(crop) = lower($3))', [field.id, season, cropName], `crop on ${field.name} in season ${season}`);
              if (kind === 'applications') {
                const product = req(r, 'product');
                const p = (await db.query('select * from products where lower(name) = lower($1)', [product]))[0];
                const kindText = get(r, 'kind').toLowerCase();
                const pkind = p ? p.kind : KINDS[kindText];
                if (!pkind) throw Error(`product "${product}" is not in the shed and its Product Type "${kindText}" is not one of ${Object.keys(KINDS).join(', ')}`);
                const rate = num(req(r, 'rate'), 'rate', { min: 0.0001 });
                const area = get(r, 'applied_area') ? num(get(r, 'applied_area'), 'area', { min: 0.001 }) : Number(field.area_ha);
                const whp = get(r, 'whp') ? num(get(r, 'whp'), 'WHP') : p ? p.whp_days : null;
                await insert(db, 'applications', { crop_id: crop.id, product_id: p ? p.id : null, product: p ? p.name : product, kind: pkind, applied_on: date(req(r, 'date')),
                  start_time: time(get(r, 'start')), finish_time: time(get(r, 'finish')), rate_per_ha: rate, area_ha: area, total_qty: Math.round(rate * area * 1000) / 1000,
                  water_l_ha: opt(get(r, 'water'), 'water rate'), operator: get(r, 'operator'), equipment: get(r, 'equipment'), target: get(r, 'target'),
                  wind_kmh: opt(get(r, 'wind'), 'wind speed'), wind_dir: get(r, 'wind_dir').toUpperCase(), temp_c: get(r, 'temp') ? Number(get(r, 'temp')) : null,
                  whp_days: whp, rei_hours: p ? p.rei_hours : null, label_ref: p ? p.label_ref : get(r, 'Label Reference'), cost: get(r, 'cost') ? num(get(r, 'cost'), 'cost') : 0, source_ref: hash });
              } else {
                await insert(db, 'harvests', { crop_id: crop.id, harvested_on: date(req(r, 'date')), tonnes: num(req(r, 'tonnes'), 'tonnes', { min: 0.001 }),
                  moisture_pct: opt(get(r, 'moisture'), 'moisture'), destination: get(r, 'Destination'), reference: get(r, 'reference') || `IMPORT-${hash.slice(0, 10)}` });
                await db.query("update crops set status = 'harvested' where id = $1", [crop.id]);
              }
            }
          }
          await db.query('insert into import_rows (hash, kind, source_file, row_number) values ($1, $2, $3, $4)', [hash, kind, String(f[kind]).split(/[\\/]/).pop(), i + 2]);
          report.imported++;
          report.by_kind[kind]++;
        } catch (e) {
          throw Error(`${kind} row ${i + 2}: ${e.message}`);
        }
      }
    }
    await db.exec(f['dry-run'] ? 'ROLLBACK' : 'COMMIT');
    return report;
  } catch (e) {
    await db.exec('ROLLBACK');
    throw e;
  }
}
