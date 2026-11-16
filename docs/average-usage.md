# Average usage

Owners opt in per asset, only from Advanced settings → Average usage. Hours and kilometres are supported; percentage and not-applicable assets do not display the tile and are rejected by the API. Desktop team users cannot enable it for their owner. No assets are enabled by migration or deployment.

Setup requires an actual reading/date, usage per working day and selected weekdays. The optional calculator divides the actual total reading by elapsed selected working days since an editable in-service date; an older model year supplies January 1 as an explicit approximation. The user must accept the suggestion. Engine hours cannot exceed 24 per working day.

The register stores clearly labelled estimated usage while keeping the last confirmed reading in the existing automatic-usage configuration/history. Calculation is baseline + daily rate × completed South African working days, recomputed rather than incremented. A server worker checks batches each minute and catches up after downtime. Asset locks serialize estimates with real meter updates; retries do not add duplicate usage.

Actual fuel, scan, manual/shared and current service-completion readings reset the baseline, including identical numeric readings. A real reading below the estimate is valid provided it is not below the previous confirmed reading; owners can explicitly correct earlier mistakes from Advanced settings. Historical entries retain their non-updating behaviour. Unrelated edits and valuation refreshes must not turn estimated usage into a confirmed meter reading.

Existing Update usage permissions govern dealer/business corrections, with existing authorization checks under transaction locks. Existing maintenance permissions govern service tracking and completion. Shared asset facts retain the Estimated label. No new permission grants are created.

GPS and average estimation share one configuration with mutually exclusive modes. Enabling average usage replaces GPS accumulation but does not disconnect tracking. Pause average usage before switching back to GPS estimation. Ownership changes disable automatic accumulation. Unsupported or changed metrics stop accumulation.

Maintenance records retain confirmed currentUsage for completion; estimatedUsage is separate. Average-based status, email and reminder screens identify the estimate and show an estimated service date where available. Forecasts reuse the existing authorized reminder worker and per-occurrence deduplication, not a second mail scheduler. Paused estimates do not forecast a future service date.

Schema: migration 159 and the runtime tracking schema agree. The worker is independent of email enablement and installs schema before operating. Validation: tests/average-usage.test.mjs, existing tracking/maintenance/fuel/sharing tests, TypeScript, and component browser checks at desktop and mobile widths.
