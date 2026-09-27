---
description: Bring fields, crops, spray history and harvests across from Agworld exports.
---

Read docs/replace-agworld.md. Always dry run first:

`npm run cropping -- import agworld --farm="<farm>" --fields=<csv> --crops=<csv> --applications=<csv> --harvests=<csv> --dry-run`

If a row fails, the error names the file, row and missing header: rename the header or fix the row, then dry run again. Only then run without `--dry-run`. Replaying the same files skips rows already imported. Afterwards run /compliance: imported sprays from products not in the shed carry no withholding period and hold harvest until someone adds it.
