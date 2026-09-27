---
description: Check the spray and harvest records against the rules in docs/compliance.md and report what is missing, late or inside a withholding period, with the rule cited.
---

1. Run `npm run cropping -- compliance --json`. Each finding carries its rule and the section of `docs/compliance.md` that sources it.
2. Report as a table: rule, count, the worst example, the source. Order: HARVEST-WHP, SPRAY-RATE, SPRAY-48H, SPRAY-RECORD, SPRAY-LABEL, SPRAY-PLAN, INVENTORY-EXPIRED.
3. For each finding, say the fix the operator can approve: the field to fill on the spray record, the label to look up, the delivery to dispose of, the plan to review.
4. If a rule in `docs/compliance.md` does not match the operator's state or region, say so and stop. Do not guess at law. The operator confirms the rule, then you update the doc and the check together through /customise.

Nothing here is legal or label advice. The doc records the rules the operator has told the system to enforce, with sources.
