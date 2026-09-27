---
description: Write the agronomist's recommendation against a crop.
---

Run `npm run cropping -- recommend "<crop>" --product="..." --rate=<per ha> --due=YYYY-MM-DD --by="<agronomist>" --reason="..."`. A rate above the recorded label maximum is refused. Then show /recommendations so the operator sees whether the shed can cover it. To cancel: `npm run cropping -- cancel-rec <id> --reason="..." --by=<name>`.
