<h1 align="center">Cropping for Claude Code</h1>

<p align="center">
  <strong>The open-source crop and agronomy records system that is just a database and Claude Code.</strong>
</p>

<p align="center">
  Created by <a href="https://www.enterprisedna.co"><strong>Enterprise DNA</strong></a>. Free and open source. Works with Claude Code, Codex, OpenCode or Cursor.
</p>

<!-- three-doors -->
<table align="center">
  <tr>
    <td align="center"><strong>Do it yourself</strong><br/>Clone it, run it, own it. Free, MIT.<br/><a href="#quick-start">Quick start</a></td>
    <td align="center"><strong>We customise it</strong><br/>Your fields, your rules, your Agworld data brought across.<br/><a href="https://enterprisedna.co/omni/book/?offer=replace-software&utm_source=github&utm_medium=readme&utm_campaign=agworld">Book a call</a></td>
    <td align="center"><strong>We run it for you</strong><br/>Installed, connected and operated inside Omni. Setup fee, then a retainer.<br/><a href="https://enterprisedna.co/omni/instead-of/agworld?utm_source=github&utm_medium=readme&utm_campaign=agworld">How it works</a></td>
  </tr>
</table>

<p align="center">
  <a href="#what-is-this">What is this</a> &bull;
  <a href="#why-no-front-end">Why no front end</a> &bull;
  <a href="#quick-start">Quick start</a> &bull;
  <a href="#the-commands">Commands</a> &bull;
  <a href="#instead-of-agworld">Instead of Agworld</a> &bull;
  <a href="#want-it-installed-and-run-for-you">Installed for you</a> &bull;
  <a href="#license">License</a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Node-20+-339933?style=flat-square" alt="Node 20+" />
  <img src="https://img.shields.io/badge/PostgreSQL-any-336791?style=flat-square" alt="PostgreSQL" />
  <img src="https://img.shields.io/badge/PGlite-embedded-3ecf8e?style=flat-square" alt="PGlite" />
  <img src="https://img.shields.io/badge/License-MIT-yellow?style=flat-square" alt="MIT License" />
</p>

---

## What is this

Cropping for Claude Code is a farm office record system for Australian and New Zealand grain and broadacre growers and the agronomists who work with them. It holds fields, crops by season, the agronomist's recommendations, the spray diary, the chemical shed, scouting notes, rainfall and harvest loads, in a database you own. There is no web front end: you open the folder in [Claude Code](https://claude.com/claude-code) (or Codex, OpenCode, Cursor through `AGENTS.md`) and ask in plain words. The demo farms are fictional.

Agworld lists Grower Basic at $1795 a year, Grower Plus at $3195 and Grower Pro at $3995, with Enterprise on request, on its Australian pricing page checked 27 September 2026. The page does not state the currency or GST. Source: [Agworld pricing](https://www.agworld.com/au/pricing/). See [the research notes](docs/research.md).

The free version has no licence fee. Agent subscriptions, hosting and your own time remain separate. It does not replace Agworld's maps, phone app, imagery or machinery connections. [The scope is explicit](docs/why-no-front-end.md). Want those built around your farm, or a different stack? That is what Enterprise DNA does: [book a call](https://enterprisedna.co/omni/book/?offer=replace-software&utm_source=github&utm_medium=readme&utm_campaign=agworld).

## Why no front end

- The front end was only ever there because the database was hard to talk to. That is no longer true.
- Your records sit in plain Postgres tables you own. Any tool can read them.
- No per-operation subscription. Read [docs/why-no-front-end.md](docs/why-no-front-end.md) for what a screen gives that this does not.

## Quick start

```bash
git clone https://github.com/Enterprise-DNA-OS/cropping-for-claude-code.git
cd cropping-for-claude-code
npm install
npm run demo
npm test
npm run view
npm run docs
```

Node 20 or newer. No database server, account or credentials. The demo creates Yarrabee, a fictional NSW grain farm with four fields, and a small Canterbury block: a canola crop inside a withholding period, a fungicide recommendation the shed cannot cover, a spray record missing its wind reading, a field closed to re-entry and a harvest load taken too early. Open the folder in Claude Code and run `/attention` first, then `/harvest-check` and `/recommendations`.

For a real farm, use a fresh `DATA_DIR` or set `DATABASE_URL` in `.env` to your own Postgres or Supabase, run `npm run migrate`, add the farm and import its exports. Set the machine and database timezone to the farm's timezone. Never load the demo seed into a real database.

## The commands

| Command | Weekly job |
|---|---|
| `/attention` | The morning round |
| `/farms` | The property book |
| `/fields` | The field list |
| `/crops` | This season's crops |
| `/crop` | One crop before a decision |
| `/spray-diary` | The spray diary |
| `/recommendations` | The agronomist's recommendations against the shed |
| `/inventory` | The chemical shed |
| `/reentry` | Fields closed to re-entry |
| `/scouting` | Open scouting issues |
| `/rainfall` | The rain gauge |
| `/harvest-check` | Before booking the header |
| `/harvests` | The harvest book |
| `/margins` | Recorded gross margin by crop |
| `/tasks` | The work list |
| `/compliance` | The audit preparation round |
| `/add` | Add a farm, field, product or crop |
| `/sow` | Record a crop in the ground |
| `/recommend` | Write a recommendation |
| `/spray` | Record a completed spray or spread |
| `/scout` | Record what was found walking a crop |
| `/harvest` | Record a harvest load |
| `/rain` | Record a rain reading |
| `/shed-delivery` | Add a delivery to the shed |
| `/log` | Record a farm decision |
| `/weekly-review` | Monday farm review |
| `/draft-spray-record` | Draft the spray application record |
| `/draft-recommendation` | Draft the recommendation sheet |
| `/draft-audit` | Draft the audit pack |
| `/import` | Bring the Agworld records across |
| `/customise` | Make the records fit this farm |
| `/new-view` | Add a read-only view |
| `/export` | Back up every record |

The CLI ships 36 commands. See [docs/commands.md](docs/commands.md). Human-readable tables by default, `--json` on every command, unique partial names or ids work, and an ambiguous name stops with a list.

## Rules that protect the spray diary

- A chemical spray is refused without start and finish time, operator, equipment, target, and wind speed and direction: the fields NSW requires on a pesticide record.
- A spray is refused for expired product, a rate above the recorded label maximum, more product than the shed holds, or an area bigger than the field. Stock comes off the shed in the same transaction.
- A spray that pushes a planned harvest inside its withholding period says so straight away.
- A harvest load is refused while any withholding period is running, or unknown because a spray has no withholding period recorded.
- Imports check the whole batch and roll it back on any bad row. Replaying the same files adds nothing.

Unknown is not clear. Demonstration products carry made-up rates and intervals. Always confirm with the actual label. Read [docs/compliance.md](docs/compliance.md) for each rule and its source, and which checks are farm policy.

## Ten questions to ask across your crop records

Each is answered today by the command named. Agworld has its own reports and filters; no claim is made that it cannot answer any particular one.

1. Which crops cannot be harvested on their planned date because a withholding period is still running? `harvest-check`
2. Which spray records were written more than 48 hours after the job finished? `compliance`
3. Which of the agronomist's recommendations can the shed not cover right now? `recommendations`
4. Which fields are closed to re-entry right now, and until when? `reentry`
5. Which chemical sprays are missing wind, operator, equipment or times? `compliance`
6. What was recommended, is past due and has not gone on? `recommendations`
7. Which sown crops has nobody walked in the last 14 days? `attention`
8. Which harvest loads came off before a withholding period had cleared? `compliance`
9. What is the recorded margin per hectare for each crop at the price we entered? `margins`
10. Which products in the shed are expired, or short for open recommendations? `inventory`

## Documents and views in your brand

Edit `brand.json` for the business name, logo and colours. `npm run docs` renders spray application records, recommendation sheets and farm audit packs as HTML in `docs-out/`. They are working records, not certified documents. Draft commands write only to `drafts/`.

`npm run view` renders the week (decisions, recommendations, re-entry), harvest readiness and recorded margins into `views/`. Open them or print to PDF. `/new-view` adds another.

## Your first hour: ten things to ask for

1. Put our farm, state or region and owner in the property book.
2. Replace the demo fields with our field names and hectares, and note the sensitive neighbours.
3. Load our chemical shed with stock, label rates, withholding periods and re-entry intervals.
4. Import our Agworld fields, crops and spray history, then show me every gap.
5. Put our logo and colours on the spray record.
6. Add a boom height and nozzle type to every spray record.
7. Change the scouting reminder from 14 days to 7 during spring.
8. Add a buyer residue check to harvest readiness for our export barley.
9. Add a view of recommendations by agronomist with how many were applied on time.
10. Draft Monday's priorities from the decision list, recommendations and harvest check.

`/customise` writes a new migration, applies it, updates the commands and tests the change.

## Instead of Agworld

[The switch guide](docs/replace-agworld.md) covers what to export from Agworld, the accepted headers, loading the shed first, the dry run, and what does not carry over (maps, imagery, machinery feeds, attachments). Bring fields, crops, spray history and harvest loads across in one command after a dry run, then reconcile before cancelling.

## Tests

`npm test` uses a disposable embedded database. It exercises all 36 CLI commands and asserts the spray gates, stock rollback on a refused spray, the 48 hour rule, the withholding boundary day, harvest refusals, recommendation linking, CSV dry run, replay and rollback, the shipped example exports, name ambiguity, drafts, documents and branded views. CI runs it on Linux and Windows.

## Architecture

```
cropping-for-claude-code/
  CLAUDE.md                 how the operator wants this run (routing table + house rules)
  AGENTS.md                 the same, for Codex / OpenCode / Cursor / Gemini CLI
  .claude/commands/         the slash commands
  scripts/                  the CLI the commands drive
  scripts/lib/db.mjs        one adapter: DATABASE_URL (pg) or embedded PGlite
  supabase/migrations/      plain SQL schema
  supabase/seed.sql         demo data
  docs/                     compliance sources, the switch guide, research, the CLI reference
  fixtures/agworld/         example exports the importer accepts
  views.json documents.json the read-only views and the paperwork
```

## Built for coding agents

The database, CLI and command recipes work with Claude Code, Codex, OpenCode or Cursor. Ask your coding agent for a new command and have it implement and test the change against the same records.

## Contributing

Issues and pull requests are welcome. Keep the shape: plain SQL, a small CLI, a slash command per recurring job, no front end.

## Want it installed and run for you?

Enterprise DNA installs Cropping for Claude Code for your business, migrates your Agworld data, connects it to the rest of your tools, and runs it for you as part of **Omni**, our managed Command Center. One setup fee, then a monthly retainer.

- Book a call: [enterprisedna.co/omni/book](https://enterprisedna.co/omni/book/?offer=replace-software&utm_source=github&utm_medium=readme&utm_campaign=agworld)
- Read more: [enterprisedna.co/omni/instead-of/agworld](https://enterprisedna.co/omni/instead-of/agworld?utm_source=github&utm_medium=readme&utm_campaign=agworld)

## License

MIT. Copyright (c) 2026 Enterprise DNA. Agworld is named for comparison. This project is independent and not affiliated with Agworld or Semios.
