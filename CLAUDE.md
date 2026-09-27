# Cropping for Claude Code: operating instructions

This file is the brain. Claude Code reads it at the start of every session. It says who this is for, how work gets done, and the one right way to do each recurring job.

## Who this is for

- **Business:** Yarrabee Demo, a fictional NSW grain farm, and Kowhai Flats Demo in Canterbury. Replace with the real farm, state or region, owner and agronomist before loading real records.
- **Operator:** Chris, owner and spray operator. Alex is the agronomist.
- **What matters most:** a spray diary that would stand up to an EPA check, nothing harvested inside a withholding period, and recommendations that actually go on in time.

Fill this in once. A worker with context knows. A worker without it guesses.

## How to work

1. **Take a brief, not a script.** The operator describes the outcome. You run the right command and present the answer.
2. **Read before you write.** Before drafting anything about a record, read its full history first.
3. **Plain language.** Short sentences. No filler. Numbers in tables.
4. **Silent success, loud problems.** No play-by-play. Say what broke and what you did about it.
5. **Stop at the line.** Anything that sends, deletes, or faces a customer waits for a yes in this session.

## Routing table: one right way for each recurring job

| When the operator asks for... | Use this |
|---|---|
| The morning round | `/attention` |
| The property book | `/farms` |
| The field list | `/fields` |
| This season's crops | `/crops` |
| One crop before a decision | `/crop` |
| The spray diary | `/spray-diary` |
| The agronomist's recommendations against the shed | `/recommendations` |
| The chemical shed | `/inventory` |
| Fields closed to re-entry | `/reentry` |
| Open scouting issues | `/scouting` |
| The rain gauge | `/rainfall` |
| Before booking the header | `/harvest-check` |
| The harvest book | `/harvests` |
| Recorded gross margin by crop | `/margins` |
| The work list | `/tasks` |
| The audit preparation round | `/compliance` |
| Add a farm, field, product or crop | `/add` |
| Record a crop in the ground | `/sow` |
| Write a recommendation | `/recommend` |
| Record a completed spray or spread | `/spray` |
| Record what was found walking a crop | `/scout` |
| Record a harvest load | `/harvest` |
| Record a rain reading | `/rain` |
| Add a delivery to the shed | `/shed-delivery` |
| Record a farm decision | `/log` |
| Monday farm review | `/weekly-review` |
| Draft the spray application record | `/draft-spray-record` |
| Draft the recommendation sheet | `/draft-recommendation` |
| Draft the audit pack | `/draft-audit` |
| Bring the Agworld records across | `/import` |
| Make the records fit this farm | `/customise` |
| Add a read-only view | `/new-view` |
| Back up every record | `/export` |

If an ask fits nothing here, run the CLI directly (`npm run cropping -- help`) and then propose a new command for it.

## Hard rules

- Never invent a rate, withholding period, re-entry interval or label reference. Missing means missing: ask for the label.
- Never work around a refused spray or harvest. Say what blocked it and what record would fix it.
- A record check is not label advice or proof of compliance. docs/compliance.md holds the rules and their sources.
- Record sprays within 48 hours of the job. Imports start with no recorded time.
- Export before /customise. Add migrations, never rewrite an applied one. Run npm test after any code or schema change.

- Never send email or messages from here. Draft to `drafts/`, a person sends.
- Never delete records without an explicit yes in this session. Prefer marking closed or archived.
- Never invent a record. If a name is ambiguous, list the candidates and ask.
- The database is the source of truth. If the answer is not in it, say so.

## Where things live

- `scripts/` the CLI. `scripts/lib/db.mjs` picks `DATABASE_URL` (Postgres, Supabase) or the embedded database in `.data/`.
- `supabase/migrations/` the schema, plain SQL. `npm run migrate` applies it.
- `.claude/commands/` the slash commands. Add one every time the same ask comes twice.
- `docs/` the thesis and the guide for moving off Agworld.

Built by Enterprise DNA. Installed and run for you as part of Omni: https://enterprisedna.co/omni/instead-of/agworld
