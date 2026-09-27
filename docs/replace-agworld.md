# Moving off Agworld

Agworld keeps your fields, seasons, activities and yields. Its reporting pages say you can export reports and share them with advisers; the help centre describes CSV and Excel exports for reports. What your account can export depends on your plan and permissions. Check with Agworld if a report you need is missing.

## 1. Export

Export four reports to CSV (or save Excel as CSV):

1. **Fields**: field name and area in hectares.
2. **Crops by season**: field, season, crop, variety, sowing date.
3. **Activities / applications**: field, season, date, product, product type, rate per hectare, and whatever operator, equipment, target, times, weather and withholding columns your spray record report carries.
4. **Harvest / yield**: field, season, harvest date, tonnes, moisture, load or docket.

Keep the original files. They are your evidence of what Agworld held on the day you left.

## 2. Check the headers

The importer matches these headers without caring about case. Rename a column in the CSV if yours is called something else, or ask Claude Code to add your header to `scripts/lib/import.mjs`.

| Record | Accepted headers |
|---|---|
| Field | Field, Field Name, Paddock, Paddock Name, Block |
| Area | Area (ha), Area, Hectares, Field Area (ha), Size (ha) |
| Season | Season, Season Name, Year |
| Crop | Crop, Crop Type, Commodity |
| Variety | Variety, Cultivar |
| Sowing date | Sowing Date, Sown Date, Planting Date, Seeding Date |
| Date | Date, Activity Date, Application Date, Completed Date, Harvest Date |
| Product | Product, Product Name, Input |
| Product type | Product Type, Type, Category (herbicide, fungicide, insecticide, fertiliser, seed, adjuvant) |
| Rate | Rate, Rate per ha, Rate/ha, Application Rate |
| Applied area | Applied Area (ha), Area Applied, Area (ha), Area (defaults to the whole field) |
| Operator, equipment, target | Operator / Applicator / Applied By / User, Equipment / Machine / Rig, Target / Pest / Reason |
| Times | Start Time, Finish Time / End Time (HH:MM) |
| Weather | Wind Speed (km/h), Wind Direction, Temperature (C), Water Rate (L/ha) |
| Withholding | WHP (days), WHP, Withholding Period |
| Harvest | Yield (t) / Tonnes / Total Yield (t) / Quantity (t), Moisture (%), Load / Reference / Ticket / Docket |

Dates can be `YYYY-MM-DD` or `DD/MM/YYYY`. Examples in `fixtures/agworld/`.

## 3. Load your chemical shed first

Add each product you still hold with `/add` (kind, unit, stock, label maximum rate, withholding period, re-entry interval, label reference, expiry). An imported spray of a product that is in the shed takes its withholding period and label reference from the product. A product that is not in the shed comes across with only what the CSV says, and a chemical with no withholding period holds harvest on that crop until someone fills it in. That is deliberate.

## 4. Dry run, then import

```bash
npm run cropping -- add farm --name="Your Farm" --country=AU --region=NSW
npm run cropping -- import agworld --farm="Your Farm" \
  --fields=fields.csv --crops=crops.csv --applications=applications.csv --harvests=harvests.csv --dry-run
```

A dry run checks every row and writes nothing. Any bad row stops the whole batch and names the file, row and the header it wanted. Fix and run again. When the dry run is clean, run the same command without `--dry-run`. Running it twice skips rows already imported.

## 5. Reconcile

Run `/crops`, `/spray-diary` and `/compliance`. Compare field areas, crop counts and total product used per season against the Agworld reports. Run both systems side by side for a spray round before cancelling.

## What does not carry over

- Maps, field boundaries, NDVI imagery and machinery or weather station feeds. The free version has no map.
- Agronomist and contractor sharing inside Agworld. Here, everyone works from the same database with their own access.
- Imported sprays carry no time they were recorded, so the 48 hour check does not apply to history.
- Planning templates, budgets and work orders. Open recommendations can be re-entered with `/recommend`.
- Attachments and photos.
