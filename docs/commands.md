# CLI reference

`npm run cropping -- <command> [name] --field=value [--json]`

Names match exactly, then by unique partial name or id prefix. An ambiguous name stops and lists the candidates. Every command accepts `--json`. Dates are `YYYY-MM-DD` and default to today. Times are `HH:MM`, the farm's local clock.

## Reads

| Command | What it shows |
|---|---|
| `attention` | Everything needing a decision, by priority |
| `farms` | Properties, country, region, spray plan review |
| `fields` | Fields, areas, soil, sensitive neighbours |
| `crops` | Crops by season with last spray and last scouted |
| `crop <name>` | One crop: sprays, recommendations, scouting, notes |
| `spray-diary` | Every application with weather, clear dates and record lag |
| `recommendations` | Recommendations with quantity needed against stock |
| `inventory` | The shed: stock, committed, available, expiry, label intervals |
| `reentry` | Fields closed to re-entry now |
| `scouting` | Open scouting issues |
| `rainfall` | Rain by farm over 7, 30 and 365 days |
| `harvest-check` | Harvest readiness against withholding periods |
| `harvests` | Harvest loads |
| `margins` | Recorded inputs, yield, revenue and margin per hectare |
| `tasks` | The work list |
| `compliance` | Findings against docs/compliance.md |
| `weekly-review` | attention, recommendations and harvest-check together |

## Writes

| Command | Required | Optional |
|---|---|---|
| `add farm` | `--name --country=AU\|NZ` | `--region --owner` |
| `add field` | `--farm --name --area` | `--soil --sensitive` |
| `add product` | `--name --kind --unit=L\|kg --stock`; chemicals also `--whp --label` | `--cost --max-rate --rei --group --expiry` |
| `add crop` | `--field --season --crop` | `--variety --target --price --name` |
| `sow <crop>` | | `--date --variety --harvest` |
| `recommend <crop>` | `--product --rate --due --by` | `--reason` |
| `cancel-rec <id>` | `--reason --by` | |
| `spray <crop>` | `--product --rate`; chemicals also `--start --finish --operator --equipment --target --wind --wind-dir` | `--area --date --temp --water --rec` |
| `scout <crop>` | `--issue --severity=low\|medium\|high --by` | `--note --date` |
| `resolve <observation id>` | `--note` | |
| `harvest <crop>` | `--tonnes --reference` | `--moisture --destination --date --final=no` |
| `rain <farm>` | `--mm` | `--date` |
| `stock-in <product>` | `--qty` | `--expiry` |
| `task-add` | `--farm --name --due --owner` | |
| `task-done <id>` | | |
| `log <crop>` | `--note --by` | |

## Gates

- `spray` refuses: a harvested or failed crop, a future date, expired product, a rate above the recorded label maximum, more product than the shed holds, an area bigger than the field, a chemical with no withholding period or label reference, and a chemical record without start, finish, operator, equipment, target and wind. Stock comes off in the same transaction. A linked recommendation is marked applied.
- `harvest` refuses while any withholding period is running or unknown.
- `recommend` refuses a rate above the recorded label maximum.

## Other

| Command | What it does |
|---|---|
| `import agworld --farm --fields --crops --applications --harvests [--dry-run]` | CSV import in one transaction. See docs/replace-agworld.md |
| `export [--file]` | Every register to one JSON file |
| `draft-spray-record <crop>` | HTML spray record to drafts/ |
| `draft-recommendation <crop>` | HTML recommendation sheet to drafts/ |
| `draft-audit <farm>` | HTML audit pack to drafts/ |
