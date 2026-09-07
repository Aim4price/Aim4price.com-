# Basic catalogue integration

Basic Estimate can read the separately imported `aim4price_basic` catalogue.
The default deployment continues using the existing catalogue. This change does
not import data, activate the release, grant database permissions or change Advanced.

## Behavior

- Basic selects the new families, searchable by family and group.
- Brand stays typed, and model stays optional. The existing active `unknown`
  brand record supplies the database brand ID; typed identity stays in specs.
- Entry, Standard and Quality each cover one third of `maximum - minimum`.
  The original minimum and full maximum are retained. Prices are ZAR excluding
  VAT internally; the existing VAT toggle converts the displayed range and input.
- Manual replacement prices may be outside the guide. Catalogue prices are broad
  ballpark guidance, not model-specific quotes.
- All new families initially use the existing percentage-of-life-worked engine,
  with year and condition. The user supplies the percentage. No numeric useful
  lifetimes are inferred from research prose or candidate legacy mappings.
- Candidate legacy mappings are not promoted. Basic family IDs and price bands
  never become public catalogue foreign keys. Existing nullable links remain null.
- The server re-reads and snapshots the release, family, range and pricing date in
  saved specs. The selected replacement price and existing saved valuation payload
  preserve recalculation inputs. The Asset Register reads the Basic family label
  from this snapshot when there is no public family link.

## Deployment steps

1. Review the draft PR and its checks. Use a preview deployment first.
2. Ensure the application database role can SELECT the imported release, families,
   groups and price_bands in `aim4price_basic`. The importer did not add grants.
3. In the preview environment set:
   `AIM4PRICE_BASIC_CATALOGUE_RELEASE=basic_ballpark_20260907_v1`.
4. Check one family in each sector. Check mounted and trailed sprayers separately,
   Entry/Standard/Quality bounds, including/excluding VAT, optional model, an
   outside-range manual price, saving, reopening and updating life worked.
5. Check an existing Advanced valuation and an existing saved asset.
6. After preview approval, deploy the reviewed code and set the same environment
   variable in production. The database release remains `draft`; this environment
   variable explicitly selects it for the Basic application.

Removing the variable restores the old family-selection flow. Saved Basic records
remain readable, but recalculating them requires their catalogue release to be
enabled; keep the imported schema and data. Do not rerun the import to activate it.

## Validation

`node --experimental-strip-types --test tests/basic-catalogue.test.mjs tests/basic-estimate-flow.test.mjs`

The catalogue tests run the real reader, calculator and valuation save function
against a strict query double. They verify range thirds, release gates, server
snapshots, all sectors, missing inputs, zero life worked, outside-range replacement,
optional models and null public family foreign keys. They do not connect to Railway.
The PR workflow also runs shared valuation regressions, the full repository type
check and production bundle compilation. Live saving/reopening remains a preview
deployment check because PR CI has no application database credentials.
