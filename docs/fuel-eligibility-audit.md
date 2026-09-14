# Fuel eligibility audit — 14 September 2026

Scope: repository catalogue definitions and save/read paths. This is not a live production database audit or a model-by-model engine inventory.

## Findings

- The 713 Basic families in `lib/basic-usage-profiles.ts` belong to a separate catalogue. `lib/basic-catalogue.ts` exposes them with ID 0 and `isPropelled: false`; they do not have a public equipment-family foreign key. Changing Manage to read only that foreign key would not fix Basic assets.
- The saved `specsJson.basic_catalogue.familyKey` (or flat `family_key` with a Basic release marker) identifies existing Basic assets without a backfill.
- The legacy Motor seed in migration 28 marks trailers as propelled. Eligibility now explicitly excludes that family unless fuel evidence identifies an independent engine. This does not change valuation or usage metadata.
- Hours measure usage, not fuel use: electric forklifts, CNC machines, drones and warehouse machines can use hours. Stationary generators and small petrol breakers can consume fuel without being self-propelled.

## Implemented rules

1. An explicit `accepts_fuel` / `acceptsFuel: false` excludes an asset.
2. A recognised electric, battery, solar, PTO, manual or pneumatic power source excludes it, including when it is stored as a vehicle.
3. Explicit fuel acceptance or a recognised combustion fuel type includes it. Hybrids remain eligible.
4. Basic assets use the exact family defaults in `lib/basic-fuel-families.ts`: 205 fuel-capable families. These are eligibility defaults, not proof that every model in the family burns fuel. A recorded electric variant overrides the default.
5. Other Basic families require explicit fuel evidence. This includes non-powered implements, electric machinery and ambiguous families such as golf carts, fixed fire pumps and portable concrete mixers. A refrigerated trailer with its own engine can qualify explicitly; fuel tankers do not qualify merely because they carry fuel.
6. Legacy trailers and generic warehouse equipment require explicit fuel evidence. Other legacy assets retain the propulsion/kind/family fallback, with explicit opt-outs respected.

Manage and Fuel Ledger use the same function. All four Fuel Ledger asset queries supply the legacy family key. Basic valuation's propulsion flag is deliberately left alone because it also influences depreciation.

## Limits

Families can contain fuel, electric and PTO variants. The code cannot infer an unrecorded engine from a free-text model name. Mixed families excluded by default need a saved fuel type or acceptance flag. This change does not add a new user-facing power-source editor, alter stored family data, or certify individual assets. Legacy broad compressor/pump families still depend on their saved power source and existing family flag.

Manufacturer examples confirming why family/propulsion alone is insufficient:

- [JLG scissor lift range](https://www.jlg.com/en/equipment/scissor-lifts): electric and engine-powered ranges.
- [Wacker Neuson electric rammers](https://www.wackerneuson.com/us/products/vibratory-rammers/electric-rammers): battery machines alongside gasoline counterparts.

## Verification

Behaviour tests cover saved Basic identities, engine-powered generators, petrol breakers, PTO implements, electric machines, ordinary and independently powered trailers, hybrid vehicles, explicit opt-outs, unknown families and shared consumer wiring. All allowlisted keys must exist in the Basic catalogue.
