# Annual Asset Review: Admin preview only

## Review this delivery

Open **Admin → Preview annual review** (`/admin/annual-review`). The defaults are
`kallageldenhuys@gmail.com` and **1 January 2027**. Loading the preview reads the
selected owner's existing active assets across all registers. Both the page and
API require the existing Aim4price Admin access check.

The flow offers one account-wide percentage adjustment, with no asset picker or
individual replacement-price inputs:

1. A New Year welcome.
2. Yes/No to updating replacement prices; No closes without calculating or saving.
3. A percentage slider, starting at the suggested 3% allowance (not a measured
   inflation rate), adjustable from -10% to +20% in 0.5-point increments.
4. Aggregate current/proposed replacement prices and asset values, including the
   monetary changes. Totals cover successfully calculated eligible assets only;
   incomplete/failed previews cannot proceed to confirmation.
5. A separate confirmation. **Confirm preview** changes only the in-memory UI to
   **Preview complete**; there is still no saving endpoint.

Every screen says **Preview — no changes saved**. Close/Escape cancels outstanding
requests. Resume retains in-memory results; retry requests only missing/failed
assets. Changing the percentage clears old results and confirmation. Leaving or
reloading clears the preview. Individual changes belong in the Asset Register.

- No cron, annual prompt, write endpoint, history record, notification, saleability
  update, or annual completion marker is introduced.
- No test user is impersonated. The final Asset Register link opens the signed-in
  Admin's normal register, not the selected owner's account.
- The preview reads existing schema directly; it does not create registers or run
  the usual register/schema initialisation helpers.
- The simulation year is an explicit calculation argument. It never changes the
  process clock, environment, database timestamps, or defaults for live callers.
  Passing the simulation context into a saving recalculation is rejected.
- Recalculation uses current valuation rules and saved inputs. Usage and condition
  are retained. Replacement prices change only in the preview after the Admin chooses a percentage; usage is never projected.
- Manual valuations, unknown age, fixed age overrides, missing valuation dates,
  and assets already valued in/after the simulated year are excluded with a reason.
  Dates use the South African calendar boundary. No old value is repeatedly
  multiplied by an annual percentage.
- Basic extras are separated only when base + extras equals the saved total and
  the item prices agree. The calculator receives the new base plus saved extras
  once. Tractor extras retain their own saved prices and installation years.
  Ambiguous legacy extras are excluded rather than guessed.
- All totals exclude VAT and cover eligible assets only. Replacement totals are
  explicitly asset-only; saved extras remain separate and unchanged. Asset-value
  totals include each valuation engine’s treatment of those extras.
- The same chosen percentage applies to every eligible asset’s base replacement
  price. Values are recalculated for the simulated year using the current rules,
  so age depreciation can offset a replacement-price increase. The percentage
  is never applied directly to the old asset value.
- Failed calculations remain visible and can be retried without repeating successful
  ones. Asset revision checks reject results from an asset changed since loading.
- Saleability warnings refer to existing saved assessments; none are marked stale.

## Validation

`node --test tests/annual-review-preview.test.cjs` checks the actual Basic/tractor
calculation pipeline, explicit year isolation, following-year behaviour, preserved
extras, VAT/percent inputs, date exclusions, owner scoping, Admin rejection, stale
snapshots and calculation failures. Database doubles reject every non-SELECT query.
Saving functions throw if the preview ever reaches them.

`node scripts/verify-annual-review.cjs` renders the real client against isolated
fixture APIs on desktop, tablet and mobile. It exercises the No path, the default 3% slider, zero/negative adjustments,
aggregate totals, failed-only retries, Close/Escape/Resume, confirmation without
network writes, the following year and a large register. It checks modal geometry and produces screenshots under
`.next/annual-review-validation`. It never signs in to production or uses real
owner data.

The real owner-data preview must still be reviewed after this PR is merged and
deployed. Local fixture validation is not a claim that the owner's live asset data
or production deployment has been verified.

## Gate before implementing production saving

This PR intentionally does not implement saving. After the visual/data preview is
reviewed, prepare an isolated test database with copied, appropriately protected
asset data. Test transactionally saved valuation runs, asset updates and history;
year-based idempotency and concurrent recalculations; per-asset retry checkpoints;
partial failures and recovery; extras/VAT round trips; Saleability invalidation;
closing and resuming background work; and the next year's review. Production writes
must remain unavailable until those tests and the preview have been reviewed.
