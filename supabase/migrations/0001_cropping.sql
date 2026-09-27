-- Crop and agronomy records. No extensions: PostgreSQL 13+ and embedded PGlite run the same file.
-- Times are the farm's local clock (timestamp without time zone). Set the machine and the database
-- session to the farm's timezone before real use.
create function touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

create table farms (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  country text not null default 'AU' check (country in ('AU','NZ')),
  region text not null default '',
  owner text not null default '',
  spray_plan_review date,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create trigger farms_updated before update on farms for each row execute function touch_updated_at();

create table fields (
  id uuid primary key default gen_random_uuid(),
  farm_id uuid not null references farms,
  name text not null unique,
  area_ha numeric not null check (area_ha > 0),
  soil text not null default '',
  sensitive_note text not null default '',
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create trigger fields_updated before update on fields for each row execute function touch_updated_at();

-- Chemicals, fertiliser and seed in the shed. whp_days is the harvest withholding period on the label,
-- rei_hours the re-entry interval, max_rate_per_ha the highest label rate for the use you record.
create table products (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  kind text not null check (kind in ('herbicide','fungicide','insecticide','fertiliser','seed','adjuvant')),
  unit text not null check (unit in ('L','kg')),
  stock numeric not null default 0 check (stock >= 0),
  cost_per_unit numeric not null default 0 check (cost_per_unit >= 0),
  max_rate_per_ha numeric check (max_rate_per_ha > 0),
  whp_days integer check (whp_days >= 0),
  rei_hours integer check (rei_hours >= 0),
  mode_group text not null default '',
  label_ref text not null default '',
  expiry date,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create trigger products_updated before update on products for each row execute function touch_updated_at();

-- One crop is one field in one season.
create table crops (
  id uuid primary key default gen_random_uuid(),
  field_id uuid not null references fields,
  name text not null unique,
  season text not null,
  crop text not null,
  variety text not null default '',
  status text not null default 'planned' check (status in ('planned','sown','harvested','failed')),
  sown_on date,
  harvest_planned date,
  target_t_ha numeric check (target_t_ha >= 0),
  price_per_t numeric not null default 0 check (price_per_t >= 0),
  unique (field_id, season, crop),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create trigger crops_updated before update on crops for each row execute function touch_updated_at();

create table applications (
  id uuid primary key default gen_random_uuid(),
  crop_id uuid not null references crops,
  product_id uuid references products,
  product text not null,
  kind text not null,
  applied_on date not null,
  start_time time,
  finish_time time,
  rate_per_ha numeric not null check (rate_per_ha > 0),
  area_ha numeric not null check (area_ha > 0),
  total_qty numeric not null check (total_qty > 0),
  water_l_ha numeric check (water_l_ha >= 0),
  operator text not null default '',
  equipment text not null default '',
  target text not null default '',
  wind_kmh numeric check (wind_kmh >= 0),
  wind_dir text not null default '',
  temp_c numeric,
  whp_days integer check (whp_days >= 0),
  rei_hours integer check (rei_hours >= 0),
  label_ref text not null default '',
  cost numeric not null default 0 check (cost >= 0),
  recommendation_id uuid,
  recorded_at timestamp,
  source_ref text unique,
  check (finish_time is null or start_time is null or finish_time >= start_time),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create trigger applications_updated before update on applications for each row execute function touch_updated_at();

-- The agronomist's recommendation: what should go on, at what rate, by when.
create table recommendations (
  id uuid primary key default gen_random_uuid(),
  crop_id uuid not null references crops,
  product_id uuid not null references products,
  rate_per_ha numeric not null check (rate_per_ha > 0),
  due date not null,
  recommended_by text not null,
  reason text not null default '',
  status text not null default 'open' check (status in ('open','applied','cancelled')),
  application_id uuid references applications,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create trigger recommendations_updated before update on recommendations for each row execute function touch_updated_at();
alter table applications add constraint applications_recommendation_fk foreign key (recommendation_id) references recommendations;

create table observations (
  id uuid primary key default gen_random_uuid(),
  crop_id uuid not null references crops,
  observed_on date not null,
  observer text not null,
  issue text not null,
  severity text not null check (severity in ('low','medium','high')),
  note text not null default '',
  resolved boolean not null default false,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create trigger observations_updated before update on observations for each row execute function touch_updated_at();

create table harvests (
  id uuid primary key default gen_random_uuid(),
  crop_id uuid not null references crops,
  harvested_on date not null,
  tonnes numeric not null check (tonnes > 0),
  moisture_pct numeric check (moisture_pct >= 0 and moisture_pct <= 100),
  destination text not null default '',
  reference text not null,
  unique (crop_id, reference),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create trigger harvests_updated before update on harvests for each row execute function touch_updated_at();

create table rainfall (
  id uuid primary key default gen_random_uuid(),
  farm_id uuid not null references farms,
  fell_on date not null,
  mm numeric not null check (mm >= 0),
  unique (farm_id, fell_on),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create trigger rainfall_updated before update on rainfall for each row execute function touch_updated_at();

create table farm_tasks (
  id uuid primary key default gen_random_uuid(),
  farm_id uuid not null references farms,
  name text not null,
  due date not null,
  owner text not null,
  status text not null default 'open' check (status in ('open','done')),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create trigger farm_tasks_updated before update on farm_tasks for each row execute function touch_updated_at();

create table notes (
  id uuid primary key default gen_random_uuid(),
  crop_id uuid not null references crops,
  body text not null,
  author text not null,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create trigger notes_updated before update on notes for each row execute function touch_updated_at();

create table import_rows (
  hash text primary key,
  kind text not null,
  source_file text not null,
  row_number integer not null,
  created_at timestamptz not null default now()
);

create index applications_crop_date on applications (crop_id, applied_on);
create index recommendations_crop_due on recommendations (crop_id, due);
create index observations_crop_date on observations (crop_id, observed_on);

-- The spray diary: every application with the dates it clears.
create view application_register as
select a.id, c.name crop, fl.name field, fm.name farm, a.kind, a.product, a.applied_on,
  to_char(a.start_time, 'HH24:MI') start_time, to_char(a.finish_time, 'HH24:MI') finish_time,
  a.rate_per_ha, a.area_ha, a.total_qty, coalesce(p.unit, '') unit, a.water_l_ha, a.target, a.operator, a.equipment,
  a.wind_kmh, a.wind_dir, a.temp_c, a.whp_days, a.applied_on + a.whp_days harvest_clear,
  to_char(a.applied_on + coalesce(a.finish_time, time '23:59') + make_interval(hours => a.rei_hours), 'YYYY-MM-DD HH24:MI') reentry_clear,
  round(extract(epoch from a.recorded_at - (a.applied_on + coalesce(a.finish_time, time '23:59'))) / 3600, 1) record_lag_hours,
  a.label_ref, a.cost
from applications a join crops c on c.id = a.crop_id join fields fl on fl.id = c.field_id join farms fm on fm.id = fl.farm_id
left join products p on p.id = a.product_id;

create view crop_board as
select c.id, c.name, fl.name field, fm.name farm, fl.area_ha, c.season, c.crop, c.variety, c.status, c.sown_on, c.harvest_planned,
  (select max(applied_on) from applications a where a.crop_id = c.id) last_application,
  (select max(applied_on + whp_days) from applications a where a.crop_id = c.id) harvest_clear,
  exists (select 1 from applications a where a.crop_id = c.id and a.kind in ('herbicide','fungicide','insecticide') and (a.whp_days is null or a.label_ref = '')) unknown_hold,
  (select max(observed_on) from observations o where o.crop_id = c.id) last_scouted,
  coalesce((select sum(cost) from applications a where a.crop_id = c.id), 0) input_cost,
  coalesce((select sum(tonnes) from harvests h where h.crop_id = c.id), 0) tonnes,
  c.target_t_ha, c.price_per_t
from crops c join fields fl on fl.id = c.field_id join farms fm on fm.id = fl.farm_id;

create view margin_board as
select name crop, field, season, area_ha, status, input_cost, round(input_cost / area_ha, 2) input_cost_per_ha,
  tonnes, round(tonnes / area_ha, 2) yield_t_ha, target_t_ha,
  round(tonnes * price_per_t, 2) revenue, round(tonnes * price_per_t - input_cost, 2) recorded_margin,
  round((tonnes * price_per_t - input_cost) / area_ha, 2) recorded_margin_per_ha
from crop_board;

create view harvest_readiness as
select id, name crop, field, crop crop_type, harvest_planned, harvest_clear, unknown_hold,
  case when status = 'harvested' then 'HARVESTED'
    when status <> 'sown' then 'NOT SOWN'
    when harvest_planned is null then 'NO HARVEST DATE'
    when unknown_hold then 'HOLD UNKNOWN'
    when harvest_clear is not null and harvest_planned < harvest_clear then 'WHP HOLD'
    else 'READY FOR REVIEW' end decision
from crop_board;

create view recommendation_board as
select r.id, c.name crop, fl.name field, p.name product, r.rate_per_ha, p.unit, round(r.rate_per_ha * fl.area_ha, 2) qty_needed, p.stock,
  r.due, r.recommended_by, r.reason, r.status,
  case when r.status <> 'open' then upper(r.status)
    when p.expiry < current_date then 'PRODUCT EXPIRED'
    when p.max_rate_per_ha is not null and r.rate_per_ha > p.max_rate_per_ha then 'ABOVE LABEL RATE'
    when r.rate_per_ha * fl.area_ha > p.stock then 'STOCK SHORT'
    when r.due < current_date then 'OVERDUE'
    when r.due <= current_date + 7 then 'DUE THIS WEEK'
    else 'OPEN' end decision
from recommendations r join crops c on c.id = r.crop_id join fields fl on fl.id = c.field_id join products p on p.id = r.product_id;

create view inventory_board as
select p.id, p.name, p.kind, p.unit, p.stock,
  coalesce((select sum(r.rate_per_ha * fl.area_ha) from recommendations r join crops c on c.id = r.crop_id join fields fl on fl.id = c.field_id
    where r.product_id = p.id and r.status = 'open'), 0) committed,
  p.stock - coalesce((select sum(r.rate_per_ha * fl.area_ha) from recommendations r join crops c on c.id = r.crop_id join fields fl on fl.id = c.field_id
    where r.product_id = p.id and r.status = 'open'), 0) available,
  p.expiry, p.whp_days, p.rei_hours, p.mode_group, p.label_ref,
  case when p.expiry < current_date and p.stock > 0 then 'EXPIRED'
    when p.stock < coalesce((select sum(r.rate_per_ha * fl.area_ha) from recommendations r join crops c on c.id = r.crop_id join fields fl on fl.id = c.field_id
      where r.product_id = p.id and r.status = 'open'), 0) then 'SHORT FOR OPEN RECOMMENDATIONS'
    else 'OK' end decision
from products p;

create view reentry_board as
select crop, field, product, applied_on, finish_time, rei_hours_label, reentry_clear from (
  select r.crop, r.field, r.product, r.applied_on, r.finish_time, a.rei_hours rei_hours_label, r.reentry_clear,
    a.applied_on + coalesce(a.finish_time, time '23:59') + make_interval(hours => a.rei_hours) clear_at
  from application_register r join applications a on a.id = r.id where a.rei_hours is not null) x
where clear_at > localtimestamp;

create view scouting_board as
select o.id, c.name crop, fl.name field, o.observed_on, o.observer, o.issue, o.severity, o.note, o.resolved,
  current_date - o.observed_on days_open
from observations o join crops c on c.id = o.crop_id join fields fl on fl.id = c.field_id;

create view rainfall_board as
select f.name farm,
  coalesce((select sum(mm) from rainfall r where r.farm_id = f.id and r.fell_on > current_date - 7), 0) last_7_days_mm,
  coalesce((select sum(mm) from rainfall r where r.farm_id = f.id and r.fell_on > current_date - 30), 0) last_30_days_mm,
  coalesce((select sum(mm) from rainfall r where r.farm_id = f.id and r.fell_on > current_date - 365), 0) last_365_days_mm,
  (select max(fell_on) from rainfall r where r.farm_id = f.id) last_recorded
from farms f;

-- Each rule cites docs/compliance.md. Chemical kinds are the sprays a record-keeping rule covers.
create view compliance_findings as
select 'SPRAY-RECORD' rule, crop || ' / ' || product || ' / ' || applied_on record,
  'Spray record missing ' || concat_ws(', ',
    case when operator = '' then 'operator' end, case when equipment = '' then 'equipment' end,
    case when target = '' then 'target' end, case when start_time is null or finish_time is null then 'start and finish time' end,
    case when wind_kmh is null or wind_dir = '' then 'wind speed and direction' end) issue,
  'docs/compliance.md#spray-record' source
from application_register
where kind in ('herbicide','fungicide','insecticide')
  and (operator = '' or equipment = '' or target = '' or start_time is null or finish_time is null or wind_kmh is null or wind_dir = '')
union all
select 'SPRAY-48H', crop || ' / ' || product || ' / ' || applied_on, 'Recorded ' || record_lag_hours || ' hours after the job finished', 'docs/compliance.md#spray-48h'
from application_register where kind in ('herbicide','fungicide','insecticide') and record_lag_hours > 48
union all
select 'SPRAY-LABEL', crop || ' / ' || product || ' / ' || applied_on, 'Withholding period or label reference missing', 'docs/compliance.md#spray-label'
from application_register where kind in ('herbicide','fungicide','insecticide') and (whp_days is null or label_ref = '')
union all
select 'SPRAY-RATE', r.crop || ' / ' || r.product || ' / ' || r.applied_on, 'Rate ' || r.rate_per_ha || ' above recorded label maximum ' || p.max_rate_per_ha, 'docs/compliance.md#spray-rate'
from application_register r join applications a on a.id = r.id join products p on p.id = a.product_id
where p.max_rate_per_ha is not null and r.rate_per_ha > p.max_rate_per_ha
union all
select 'HARVEST-WHP', c.name || ' / ' || h.reference, 'Harvested ' || h.harvested_on || ' before the withholding period cleared', 'docs/compliance.md#harvest-whp'
from harvests h join crops c on c.id = h.crop_id
where exists (select 1 from applications a where a.crop_id = h.crop_id and a.applied_on <= h.harvested_on and a.applied_on + a.whp_days > h.harvested_on)
union all
select 'SPRAY-PLAN', name, 'Annual property spray plan review missing or over one year old', 'docs/compliance.md#spray-plan'
from farms where country = 'NZ' and (spray_plan_review is null or spray_plan_review < current_date - 365)
union all
select 'INVENTORY-EXPIRED', name, 'Expired product still in stock', 'docs/compliance.md#inventory-expired'
from products where expiry < current_date and stock > 0;

create view attention_board as
select 1 priority, 'harvest' kind, crop record, decision issue from harvest_readiness where decision in ('WHP HOLD','HOLD UNKNOWN','NO HARVEST DATE')
union all select 1, 'recommendation', crop || ' / ' || product, decision from recommendation_board where decision in ('OVERDUE','STOCK SHORT','PRODUCT EXPIRED','ABOVE LABEL RATE')
union all select 2, 'compliance', record, issue from compliance_findings
union all select 2, 'scouting', crop, severity || ': ' || issue || ', open ' || days_open || ' days' from scouting_board where not resolved and severity in ('high','medium') and days_open > 3
union all select 3, 'task', name, 'Overdue: ' || owner from farm_tasks where status = 'open' and due < current_date
union all select 3, 'unscouted', name, 'Sown crop not scouted in 14 days' from crop_board where status = 'sown' and (last_scouted is null or last_scouted < current_date - 14)
union all select 4, 'rainfall', farm, 'No rainfall recorded in 7 days' from rainfall_board where last_recorded is null or last_recorded < current_date - 7;
