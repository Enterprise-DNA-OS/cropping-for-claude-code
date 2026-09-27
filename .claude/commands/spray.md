---
description: Record a completed spray or spread, straight from the operator.
---

Ask for anything missing, then run:

`npm run cropping -- spray "<crop>" --product="..." --rate=<per ha> --area=<ha, default whole field> --date=YYYY-MM-DD --start=HH:MM --finish=HH:MM --operator=<name> --equipment="..." --target="..." --wind=<km/h> --wind-dir=<N|NE|...> --temp=<C> --water=<L/ha> --rec=<recommendation id>`

Chemical sprays need start, finish, operator, equipment, target, wind speed and direction: the CLI refuses without them. It also refuses expired product, a rate above the recorded label maximum, not enough stock, or an area bigger than the field. Stock comes off the shed in the same step. If the result carries a warning that harvest is now inside the withholding period, say so first. Record within 48 hours of the job.
