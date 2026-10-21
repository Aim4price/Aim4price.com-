# Automatic tracked usage

Owners can opt in from Update usage or the connected tracking phone panel. It is off by default. Enter the actual current meter reading to establish a baseline from now. Hours use observed moving seconds; kilometres use accepted GPS distance. Neither is a certified engine meter or odometer. Fuel logging is optional.

The register and map label estimated usage. Confirming an actual reading clears the estimate and begins a new baseline. Pause retains the current reading; enabling again requires a current meter reading. Unavailable/percentage usage is not eligible. Provider integration is not part of this change.

Tracking ingestion locks the asset before the device. UTC half-hour rollups recompute affected buckets, using neighbouring context and capture timestamps. Retries replace rollups rather than increment totals. Poor fixes, stationary intervals, session/device boundaries and gaps are excluded by the existing route calculations. Device pairing/revocation limits prevent overlap from replacement phones. Soft-deleted routes still support accumulated usage. No Android app update is required.

Database trigger reconciliation covers meter changes from existing flows. Explicit current fuel/scan/shared meter submissions also reconcile identical numeric readings. Historical fuel/scan entries retain their existing non-updating behaviour. Owner changes disable the old owner's configuration. The usage status checks that the selected metric still matches; an upload disables a mismatched configuration.

Valuation recalculation preserves a tracked fractional meter unless an explicit reading override is supplied. Existing valuation scheduling remains responsible for refreshing current values. Previous valuation reports are not rewritten.

The runtime installs the same schema as migration 141. New installations should run migrations normally. Existing tracking installations install it on first tracking access. Settings changes and confirmations are retained in asset_tracking_usage_events; current rollups are in asset_tracking_usage_buckets. Account/asset authorization and same-origin protection use the existing tracking guard.

Validation: node --experimental-strip-types --test tests/asset-tracking*.test.mjs; npm run typecheck. Database tests cover default-off, hours/km, duplicate and late uploads, gaps, corrections, pause, soft deletion, phone replacement, ownership, unsupported metrics and midnight boundaries.
