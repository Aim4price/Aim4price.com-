# Basic usage and useful-life profiles

Basic now accepts a relevant meter reading for each suitable family, with percentage worked when the reading is unknown. Every one of the 713 families in `basic_ballpark_20260907_v1` has an explicit profile in `lib/basic-usage-profiles.ts`.

| Sector | Hours | Kilometres | Percentage worked | Total |
|---|---:|---:|---:|---:|
| Agricultural | 18 | 0 | 122 | 140 |
| Construction | 79 | 0 | 75 | 154 |
| Industrial | 176 | 0 | 99 | 275 |
| Motor | 14 | 77 | 53 | 144 |
| Total | 287 | 77 | 349 | 713 |

## What the lifetime means

These are rounded **economic useful-life planning defaults**, not measured South African fleet averages, warranties, maintenance intervals or mandatory retirement limits. They assume ordinary use and maintenance of the complete asset. A battery replacement, engine rebuild or other component replacement is not automatically the end of the whole asset's life.

The data distinguishes `existing` Aim4price category assumptions, `planning` proposals, the `toyota` manufacturer benchmark and `ashrae_context` reference evidence. Most rows have low confidence and should be refined with dealer or fleet evidence. The application calls them a useful-life guide, not an established average.

| Example family | Primary input | Default useful life | Basis |
|---|---|---:|---|
| Compact Tractor | Hours | 8,000 hours | Existing tractor assumption |
| Orchard & Vineyard Tractor | Hours | 10,000 hours | Existing tractor assumption |
| Small Field Tractor | Hours | 12,000 hours | Existing tractor assumption |
| Big Field Tractor | Hours | 14,000 hours | Existing tractor assumption |
| Combine harvesters | Engine hours | 8,000 hours | Existing harvester category assumption |
| Mounted / Trailed Boom Sprayer | Percentage | 15 years, reference only | Planning proposal |
| Mini Excavator | Hours | 8,000 hours | Planning proposal |
| Electric Counterbalance Forklift | Hours | 10,000 hours | Toyota economic-life benchmark |
| CNC Machining Centre | Recorded operating hours | 40,000 hours | Planning proposal |
| Sedan / Fastback | Kilometres | 300,000 km | Existing passenger-car assumption |
| Utility Quad | Recorded operating hours | 3,000 hours | Planning proposal |
| Heavy Flatdeck Trailer | Percentage | 25 years, reference only | Planning proposal |

## Input and calculation rules

- Metered families accept recorded hours or kilometres, including zero. They also offer the existing percentage-worked input when the reading is unknown.
- Reading divided by the profile lifetime supplies usage in the existing shared depreciation calculation. Age, condition, popularity and salvage treatment continue to apply; value is not simply replacement price multiplied by remaining percentage.
- Readings above the planning lifetime are allowed. Worked percentage is capped at 100% and the existing salvage treatment still applies.
- Percentage families have a reference lifetime in **years**. It is shown as context; it does not convert asset age into percentage worked or alter the existing age calculation.
- Mounted implements and attachments do not inherit tractor or host-machine hours. Trailers do not inherit towing-vehicle mileage. Balers, hoists and printing machines do not convert bales, cycles or impressions into hours.
- Combine profiles use engine hours, not separator hours. Industrial profiles use actual recorded equipment runtime, not an invented annual-hours multiplier. Road work trucks use chassis kilometres as a Basic proxy; crane profiles use operating hours. Use percentage if the relevant reading is unavailable or does not represent the asset's use.
- Where a Basic profile uses hours in Motor, the input, result, saved valuation and future projection keep hours rather than automatically changing to kilometres.
- Existing percentage-based Basic estimates remain on their saved percentage basis. Switching a new estimate explicitly to a reading clears stale percentage markers. Saved reading-based estimates retain their reading basis even though the result also contains a derived worked percentage.

## Evidence and limitations

Reviewed on 7 September 2026:

1. **Aim4price's existing assumptions:** `tractorLifetimeHours` in `lib/valuation/shared.ts` and the category fallbacks in `lib/generic-valuation.ts`. These provide continuity for tractors, harvesters, loaders, telehandlers, compressors, generators and road vehicles. Mapping a new family to a category assumption is a proposal, not approval of a legacy database-family link.
2. **Toyota Material Handling:** [What Is the Economic Life of a Forklift?](https://www.toyotaforklift.com/resource-library/blog/toyota-solutions/what-is-the-economic-life-of-a-forklift) discusses approximately 10,000 operating hours as an average economic replacement point, with earlier replacement possible in some applications. Applied as a category benchmark to standard forklift families; container reach stackers have a separate provisional assumption.
3. **ASHRAE:** [Economic Analyses and Life-Cycle Costs](https://xp20.ashrae.org/SupplementalFiles/PHVAC9/Economic_Analyses_and_LCC.pdf) provides service-life survey context for chillers, cooling towers and boilers and explains limitations of older samples. The rounded year defaults here are planning interpretations, not claims that the survey represents every industrial installation.
4. **EPA:** [Median Life, Annual Activity, and Load Factor Values for Nonroad Engine Emissions Modeling, NR005d](https://nepis.epa.gov/Exe/ZyPURL.cgi?Dockey=P10081RV.TXT) uses modelling concepts including full-load hours. Those figures have not been copied into ordinary meter lifetimes or treated as whole-asset retirement ages.

The remaining specialist defaults are explicitly provisional engineering planning choices. They have not been independently established as average lifetimes for all 713 families. Before increasing confidence, collect the asset configuration, meter basis, duty cycle, maintenance/rebuild history and representative fleet economic replacement evidence. Review high-value and high-throughput families first.

## Release and rollout

The immutable profile version is `basic_usage_20260907_v1`. The server selects profiles by exact sector and family key, rejects unknown families/versions, and saves the version and profile with each new valuation. Caller-supplied lifetime snapshots cannot replace the server default. The existing authorised Advanced-assumptions override remains available where the application already permits it.

This is an application change; **no SQL script, re-import or new Railway variable is required**. It uses the existing Basic release gate. It does not update `public.equipment_families`, Advanced price bands or existing valuation records.

After merging and deploying the PR, check a compact tractor, sedan, utility quad and mounted boom sprayer. Confirm the units and guide, then try the unknown-reading percentage option and save/revalue a reading-based example. A future revision should add a new version and retain the old version for saved estimates rather than editing these released defaults in place.

Automated validation covers catalogue membership, unit consistency, zero and over-life readings, invalid inputs, server-owned lifetimes, percentage fallback, saved legacy compatibility and Basic projection routing. The existing shared valuation regression tests remain in place.
