# Family maintenance checklists

The September 2026 seed covers all 713 Basic and 134 Advanced families in the owner's database exports. There are 144 reusable starting checklists. These are work-recording suggestions, not manufacturer service schedules, certification checks or a claim that every component is fitted to every model.

## Using the catalogue

Open **Admin → Maintenance checklists** (`/admin/maintenance-catalogue`). Search by family or sector and filter Basic / Advanced. Editing a shared checklist changes future choices for every assigned family. Use **Create separate checklist for this family** before making a family-only change. Checklist items have stable IDs, component names, check wording, service wording and optional help text. Repair choices use the component name.

Export creates a JSON catalogue containing `version`, `profiles` and `families`. Import loads and validates a replacement for review; **Save changes** applies it. Imports must keep seed family coverage, unique IDs/labels and valid profile references. Keep component IDs stable when changing wording. A competing admin save produces a conflict instead of overwriting newer changes. Reload deliberately discards the unsaved draft. The export format is JSON, not the valuation CSV format.

The family resolver reads `specs_json.basic_catalogue.familyKey` and `basic_catalogue_release`, with support for legacy `basic_family_key`. Basic identity takes priority over a legacy Advanced foreign key. Advanced matching uses the saved family ID or an unambiguous sector/key. Missing family information uses General equipment; asset titles and usage readings do not guess the family. Maintenance queries can recover family metadata from the valuation run without changing the existing usage/valuation logic.

## Desktop, apps and offline

Desktop and Dealer App completions use `DesktopServiceModal`; Owner/Field Manager/QR maintenance uses `ScanClient`. Both read the shared catalogue and retain the existing selectable-button flow. Unlisted work remains available through notes; repairs retain their fault/fix description and can also select affected components. Catalogue refresh does not replace choices after the user starts selecting work.

The online catalogue endpoint returns equipment definitions only, with no accounts, assets, prices or admin identity. If it cannot be fetched, the bundled seed remains usable. Field Manager offline preparation downloads the current resolved checklist with each authorised asset into the existing encrypted vault. Older saved copies still accept written notes; refresh online to obtain checklists. Shell v3 upgrades the screen without deleting encrypted work. Queued mutations retain their original snapshots and event IDs through retries.

`maintenance_work` is nullable JSONB on `asset_maintenance_records` and `asset_scan_events`. It stores an array of procedure snapshots: catalogue version, source/release/sector/family, profile key, item IDs, saved labels and actions. Free text stays in the existing notes fields. Old clients may omit the snapshots. Editing the catalogue never rewrites history. Scheduled completion, standalone completion and scan retries retain the original snapshot. New recurring tasks start without completed work; reopening clears completion fields along with the snapshot, following the existing reopen behavior.

## Deployment and validation

Migration `104-family-maintenance-catalogue.sql` is additive. Runtime schema checks also create the catalogue table and add the nullable columns using the existing application pattern. No manual catalogue import or change to Basic/Advanced valuation tables is required. Runtime database access must retain the DDL privileges already required by existing schema initialisation. No production migration was executed during development.

Run:

```sh
npm run typecheck
node --test tests/maintenance-catalogue.test.cjs tests/desktop-service-modal.test.mjs tests/manual-maintenance-completion.test.mjs tests/maintenance-schedule-linking.test.mjs tests/maintenance-flow-guard.test.mjs tests/field-manager-offline.test.cjs
node scripts/verify-maintenance-catalogue.cjs
node scripts/verify-field-manager-offline.cjs
```

The tests cover all family assignments, nested Basic identities, tractor attachments, mounted/trailed sprayers, electric equipment, invalid imports, admin permissions, stale versions, PostgreSQL-compatible persistence, recurring records and retry preservation. Browser fixtures use real UI components with synthetic API responses. PGlite persistence tests skip only PostgreSQL's advisory-lock primitive; production uses that lock to serialise catalogue saves. Live customer accounts and production database behavior still need a deployment smoke test.

At upstream commit `0e2376ad56aa85d092f288699be24b480f12834e`, three assertions in `tests/dealer-maintenance-tracker.security.test.mjs` fail against existing UI wording/markup on both main and this branch. They concern collapsed sections, history modal markup and report wording, not the new family resolver.

## Relevance review

A second review refined 55 assignments, including tree shakers, disc harrows, rollers, powered rotary tillage, mulch layers, transplanters, potato planters, bale equipment, diagnostic scanners, vehicle lifts, dock levellers, scaffolding, air receivers, dust extractors, carts, line markers and refrigerated transport. Basic and Advanced equivalents share specialist profiles where appropriate. Mounted checklist duplicates were removed. These remain family-level starting choices; model-specific equipment and mixed-power families require the operator to select only fitted components. Admin can create a separate family checklist.

Tree-shaker component wording was checked against [Monchiero’s VL08 description](https://www.monchiero.com/en/self-propelled-fruit-harvesters/vl08-shaker/), including the shaking head, pads, arm and hydraulic system. No manufacturer intervals are inferred.
