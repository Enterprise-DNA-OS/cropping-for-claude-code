# Compliance checks

The `/compliance` command and `npm run cropping -- compliance` run these checks against the records. Each rule names its source. Where a rule is a farm policy rather than law, it says so. Rules differ by Australian state and New Zealand region: confirm the ones that apply to your property before relying on them, and change a check through `/customise`.

Nothing here is legal or label advice. The product label always governs the application.

## spray-record

**Rule.** Anyone using pesticides for work in NSW must record who applied it, what was applied, how, when and where it was applied, what it was applied to, how much was applied, and an estimate of wind speed and direction when applied outdoors with spray equipment.

**Source.** NSW EPA, Compulsory record keeping, under Part 4 of the Pesticides Regulation 2017: https://www.epa.nsw.gov.au/Your-environment/Pesticides/compulsory-record-keeping and Service NSW, Keep a record of pesticide use: https://www.service.nsw.gov.au/transaction/keep-a-record-of-pesticide-use (checked 27 September 2026). Other states set their own requirements. In New Zealand, Growsafe sets out spray record keeping under NZS 8409: https://www.growsafe.co.nz/Growsafe/Growsafe/Rsrc/Record-keeping.aspx.

**Check.** A herbicide, fungicide or insecticide application missing the operator, equipment, target, start and finish time, or wind speed and direction. The `spray` command refuses a chemical application without these fields, so findings come from imports and older records.

## spray-48h

**Rule.** In NSW the record must be made as soon as possible and no later than 48 hours after the pesticide is used, and kept for at least 3 years.

**Source.** NSW EPA, Compulsory record keeping (above), checked 27 September 2026.

**Check.** The time the record was entered is more than 48 hours after the job's finish time. Imported records carry no entry time and are not checked. The database never deletes records, which covers the 3 year keeping period.

## spray-label

**Rule.** Withholding periods must be met before harvest. A spray with no recorded withholding period or label reference cannot be checked.

**Source.** Farm policy. The withholding period is set on the product label registered with the APVMA (Australia) or ACVM (New Zealand). Growsafe lists showing withholding periods and maximum residue limits are met as a reason to keep records: https://www.growsafe.co.nz/Growsafe/Growsafe/Rsrc/Record-keeping.aspx.

**Check.** A chemical application with no withholding period or no label reference. The crop shows HOLD UNKNOWN and `harvest` refuses it until the record is fixed.

## spray-rate

**Rule.** Apply at or below the label rate for the use.

**Source.** Farm policy against the maximum rate you record from the label (`max_rate_per_ha` on the product). Off-label use rules differ by state.

**Check.** An application above the recorded label maximum. The `spray` and `recommend` commands refuse it, so findings come from imports and older records.

## harvest-whp

**Rule.** Do not harvest before the withholding period has run.

**Source.** The product label (see spray-label). This system treats harvest as allowed on the day the application date plus the withholding days is reached.

**Check.** A harvest load dated before an application's withholding period cleared. The `harvest` command refuses such a load.

## spray-plan

**Rule.** In New Zealand, NZS 8409:2021 Management of agrichemicals describes an annual property spray plan (section 5.2.5.1 and Appendix G2), and several regional plans require one.

**Source.** Standards New Zealand: https://www.standards.govt.nz/news-and-updates/spray-the-right-way-with-nzs-84092021-management-of-agrichemicals and Growsafe on NZS 8409: https://www.growsafe.co.nz/Growsafe/Growsafe/AboutUs/NZS8409.aspx. Check your regional council plan for what applies to you.

**Check.** An NZ farm with no spray plan review date, or one more than a year old. Record the date with `/customise` or a direct update to `farms.spray_plan_review`.

## inventory-expired

**Rule.** Do not apply expired product.

**Source.** Farm policy. The `spray` command refuses expired product.

**Check.** A product past its expiry date with stock still in the shed.
