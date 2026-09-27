---
description: Add a farm, field, product or crop that is missing.
---

Pick the record type and run one of:

- `npm run cropping -- add farm --name="..." --country=AU|NZ --region=... --owner=...`
- `npm run cropping -- add field --farm="..." --name="..." --area=<ha> --soil="..." --sensitive="..."`
- `npm run cropping -- add product --name="..." --kind=herbicide|fungicide|insecticide|fertiliser|seed|adjuvant --unit=L|kg --stock=<qty> --cost=<per unit> --max-rate=<label max per ha> --whp=<days> --rei=<hours> --group=<mode of action> --label="<label reference>" --expiry=YYYY-MM-DD`
- `npm run cropping -- add crop --field="..." --season=2026 --crop=wheat --variety="..." --target=<t/ha> --price=<per t>`

Chemicals need the withholding period and label reference from the actual label. Never guess them. Ask.
