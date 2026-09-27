-- Fictional NSW grain farm and a small Canterbury block. Product names, rates, withholding periods and
-- re-entry intervals are demonstration values, not label guidance. Safe to run twice.
insert into farms (id, name, country, region, owner, spray_plan_review) values
('10000000-0000-0000-0000-000000000001', 'Yarrabee Demo', 'AU', 'NSW', 'Chris', null),
('10000000-0000-0000-0000-000000000002', 'Kowhai Flats Demo', 'NZ', 'Canterbury', 'Chris', null)
on conflict do nothing;

insert into fields (id, farm_id, name, area_ha, soil, sensitive_note) values
('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'Home Paddock', 120, 'Red loam', 'House and garden on the east boundary'),
('20000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', 'Creek Block', 85, 'Grey clay', 'Creek on the south side'),
('20000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000001', 'Top Hill', 150, 'Sandy loam', ''),
('20000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000001', 'Back Flat', 60, 'Black soil', ''),
('20000000-0000-0000-0000-000000000005', '10000000-0000-0000-0000-000000000002', 'Terrace One', 40, 'Silt loam', 'Neighbour vineyard to the north')
on conflict do nothing;

insert into products (id, name, kind, unit, stock, cost_per_unit, max_rate_per_ha, whp_days, rei_hours, mode_group, label_ref, expiry) values
('30000000-0000-0000-0000-000000000001', 'Demo Knockdown 540', 'herbicide', 'L', 400, 6.5, 3, 7, 12, '9', 'DEMO ONLY: replace with actual label', current_date + 400),
('30000000-0000-0000-0000-000000000002', 'Demo Fungicide A', 'fungicide', 'L', 20, 48, 0.5, 28, 24, '3', 'DEMO ONLY: replace with actual label', current_date + 300),
('30000000-0000-0000-0000-000000000003', 'Demo Insecticide B', 'insecticide', 'L', 30, 32, 0.25, 14, 48, '3A', 'DEMO ONLY: replace with actual label', current_date + 200),
('30000000-0000-0000-0000-000000000004', 'Urea 46', 'fertiliser', 'kg', 15000, 0.9, null, null, null, '', '', null),
('30000000-0000-0000-0000-000000000005', 'Expired Demo Herbicide C', 'herbicide', 'L', 15, 22, 2, 21, 12, '2', 'DEMO ONLY', current_date - 10)
on conflict do nothing;

insert into crops (id, field_id, name, season, crop, variety, status, sown_on, harvest_planned, target_t_ha, price_per_t) values
('40000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'Home Paddock Wheat 2026', '2026', 'wheat', 'Demo Wheat', 'sown', current_date - 120, current_date + 20, 3.5, 360),
('40000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000002', 'Creek Block Canola 2026', '2026', 'canola', 'Demo Canola', 'sown', current_date - 130, current_date + 10, 1.8, 720),
('40000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000003', 'Top Hill Barley 2026', '2026', 'barley', 'Demo Barley', 'sown', current_date - 110, null, 3.2, 300),
('40000000-0000-0000-0000-000000000004', '20000000-0000-0000-0000-000000000004', 'Back Flat Chickpeas 2025', '2025', 'chickpeas', 'Demo Chickpea', 'harvested', current_date - 260, current_date - 40, 1.6, 700),
('40000000-0000-0000-0000-000000000005', '20000000-0000-0000-0000-000000000005', 'Terrace One Barley 2026', '2026', 'barley', 'Demo Barley', 'planned', null, null, 7, 420)
on conflict do nothing;

insert into applications (id, crop_id, product_id, product, kind, applied_on, start_time, finish_time, rate_per_ha, area_ha, total_qty, water_l_ha,
  operator, equipment, target, wind_kmh, wind_dir, temp_c, whp_days, rei_hours, label_ref, cost, recorded_at, source_ref) values
('50000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 'Demo Knockdown 540', 'herbicide',
  current_date - 125, '06:30', '10:15', 1.5, 120, 180, 80, 'Chris', 'Boomspray 1', 'Summer weeds before sowing', 9, 'SW', 14, 7, 12, 'DEMO ONLY', 1170, current_date - 125 + time '11:30', null),
('50000000-0000-0000-0000-000000000002', '40000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000004', 'Urea 46', 'fertiliser',
  current_date - 60, '08:00', '12:00', 100, 120, 12000, null, 'Chris', 'Spreader', 'Top dress', null, '', null, null, null, '', 10800, current_date - 60 + time '13:00', null),
('50000000-0000-0000-0000-000000000003', '40000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000002', 'Demo Fungicide A', 'fungicide',
  current_date - 5, '07:00', '09:40', 0.4, 85, 34, 100, 'Sam', 'Boomspray 1', 'Blackleg and sclerotinia', 11, 'NW', 16, 28, 24, 'DEMO ONLY', 1632, current_date - 5 + time '10:30', null),
('50000000-0000-0000-0000-000000000004', '40000000-0000-0000-0000-000000000003', '30000000-0000-0000-0000-000000000003', 'Demo Insecticide B', 'insecticide',
  current_date, '06:00', '08:30', 0.3, 150, 45, 70, 'Sam', 'Boomspray 1', 'Aphids', null, '', 12, 14, 48, 'DEMO ONLY', 1440, current_date + time '09:00', null),
('50000000-0000-0000-0000-000000000005', '40000000-0000-0000-0000-000000000004', '30000000-0000-0000-0000-000000000003', 'Demo Insecticide B', 'insecticide',
  current_date - 50, '15:00', '17:30', 0.2, 60, 12, 80, 'Contractor', 'Contract rig', 'Helicoverpa', 14, 'E', 24, 14, 48, 'DEMO ONLY', 384, current_date - 46 + time '09:00', null),
('50000000-0000-0000-0000-000000000006', '40000000-0000-0000-0000-000000000004', null, 'Historic herbicide', 'herbicide',
  current_date - 150, null, null, 1, 60, 60, null, '', '', '', null, '', null, null, null, '', 600, null, 'demo-historic-1')
on conflict do nothing;

insert into recommendations (id, crop_id, product_id, rate_per_ha, due, recommended_by, reason, status, application_id) values
('61000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000002', 0.4, current_date - 3, 'Alex (agronomist)', 'Stripe rust found at flag leaf', 'open', null),
('62000000-0000-0000-0000-000000000002', '40000000-0000-0000-0000-000000000003', '30000000-0000-0000-0000-000000000004', 80, current_date + 4, 'Alex (agronomist)', 'Nitrogen top-up after rain', 'open', null),
('63000000-0000-0000-0000-000000000003', '40000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000002', 0.4, current_date - 6, 'Alex (agronomist)', 'Flowering fungicide', 'applied', '50000000-0000-0000-0000-000000000003'),
('64000000-0000-0000-0000-000000000004', '40000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000001', 1.2, current_date - 2, 'Alex (agronomist)', 'Late weed flush along the creek line', 'open', null)
on conflict do nothing;

insert into observations (id, crop_id, observed_on, observer, issue, severity, note, resolved) values
('71000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000002', current_date - 6, 'Alex', 'Aphids on flowering canola', 'medium', 'Edges of the creek side, below threshold in the middle', false),
('72000000-0000-0000-0000-000000000002', '40000000-0000-0000-0000-000000000001', current_date - 5, 'Alex', 'Stripe rust on flag leaf', 'high', 'Northern third of the paddock', false),
('73000000-0000-0000-0000-000000000003', '40000000-0000-0000-0000-000000000001', current_date - 30, 'Chris', 'Patchy emergence near the gate', 'low', 'Resown by hand', true)
on conflict do nothing;

insert into harvests (id, crop_id, harvested_on, tonnes, moisture_pct, destination, reference) values
('80000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000004', current_date - 40, 90, 12.5, 'Demo Grain Receival', 'LOAD-001')
on conflict do nothing;

insert into rainfall (id, farm_id, fell_on, mm) values
('90000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', current_date - 2, 12),
('90000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', current_date - 9, 4),
('90000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000001', current_date - 20, 25)
on conflict do nothing;

insert into farm_tasks (id, farm_id, name, due, owner, status) values
('a1000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'Calibrate Boomspray 1', current_date - 3, 'Chris', 'open'),
('a2000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', 'Book the header contractor', current_date + 5, 'Chris', 'open')
on conflict do nothing;

insert into notes (id, crop_id, body, author) values
('b0000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000001', 'Sown into good moisture after 25 mm', 'Chris')
on conflict do nothing;
