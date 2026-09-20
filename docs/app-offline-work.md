# Offline work across the four mobile apps

Open the top-left Settings gear on an app's home screen and choose **Offline work**. While online, choose a PIN of at least eight digits and prepare the saved copy. Each app has its own encrypted device store and public offline shell. Owner and Field Manager copies contain only assets allowed for that login. Dealer copies respect the staff role; Middleman cannot access Dealer maintenance or leads.

## Available work

| App | Saved reading | Offline capture |
| --- | --- | --- |
| Owner | Accessible active assets, maintenance tasks, checklists and fuel tanks | Notes/problems, services, checks, repairs, maintenance photos, tank issues/refills/dipstick notes and petrol-station slips with an optional photo |
| Field Manager | Assigned active assets, permitted tanks and assigned/unassigned tasks | The same operational actions, gated by the manager's work/fuel/refill permissions |
| Dealer | Permitted tracked assets and tasks, showroom listings and leads | Completion of a saved maintenance task and private follow-up notes |
| Middleman | Own showroom listings | Private follow-up notes |

Private follow-up notes sync to the original login's notebook, visible inside Offline work. They do not send messages, publish listings or change lead status. Showroom prices and availability are labelled as saved information. Estimates, discovery searches, publishing, document/report generation and new maintenance scheduling require an online connection.

The Owner and Field Manager fuel picker excludes inactive assets, assets that cannot consume fuel, and Fuel Ledger exclusions. Current asset permissions, exclusions, readings and tank balances are rechecked by the existing server entry logic when syncing. A downloaded copy cannot know about a later exclusion until reconnection; a rejected entry stays on the phone for review. Offline capture never treats a saved tank balance as an authoritative current balance.

## Saving, retrying and reviewing

- “Saved on this phone” means the encrypted IndexedDB transaction committed. It does not mean the server accepted the update.
- Sync runs on reconnect, unlock, periodically while the workspace is visible, or with **Sync now**. Leave the workspace open and unlocked until the pending count reaches zero. It does not run as a closed-app background service.
- Work is processed in order. A rejection blocks later updates. Review and refresh the saved copy, then edit the rejected update, retry it, or deliberately remove it. An unconfirmed write must be retried before it can be edited, because it may already have reached the server.
- Stable event IDs prevent duplicate scan/fuel movements. Fuel slips carry an atomic event ID in their transaction. Dealer maintenance uses a receipt written in the completion transaction and refuses to claim a task completed by someone else as its own successful sync.
- Uploaded photo results are checkpointed and reused on retry. A lost upload response may leave an unused upload, but does not duplicate the final maintenance/fuel event.
- Slips accepted as incomplete remain in the online Fuel Ledger for review; the workspace explicitly reports that distinction.
- A copy supports up to 100 queued updates and 80 MB of unencrypted data before encryption. Maintenance permits four photos, each up to 5 MB; a fuel slip permits one photo up to 5 MB. Device quota can be lower. Failed local saves retain the form and do not report success.

## Isolation and compatibility

The worker caches only an explicit list of public HTML, JS, CSS and font files. It never caches authenticated HTML, API responses or arbitrary images. A PIN-derived AES-GCM key protects the snapshot, queued payloads and photos; the PIN/key is not persisted. Idle locking and one-unlocked-tab locking remain in place. Sign-in/out broadcasts lock other offline workspaces in the same app. Server requests require the current matching app realm, original account/actor, trusted origin and current permissions.

The existing Field Manager encrypted database and identity format are retained. Pending `field-offline:` event IDs are sent unchanged to avoid duplication after an upgrade. The old public modules and APIs remain for already-open older clients.

The older lost-signal queue used by already-open scan screens remains separate from the PIN workspace. New app entries are actor-bound, replay is serialized, and an error stops newer entries. Old app entries created before actor binding cannot safely be attributed automatically: they are retained, never silently replayed as a different login, and a visible banner requests account verification. Do not clear browser data containing such entries. Public QR entries retain their existing PIN authorization flow.

## Schema and rollout

`database/migrations/109-app-offline-work.sql` adds the private notebook, completion receipts and fuel-slip event ID/index. The write paths also lazily ensure these additions, matching the repository's existing schema setup. No existing records or encrypted copies are deleted. Browser clearing/eviction can still remove device-only work; keep the pending queue synced when a connection is available.

Shell changes must update the cache version in both `public/app-offline/worker.js` and `config.mjs`. Installation caches the complete public shell before reporting readiness. The versioned Field Manager shell is replaced without deleting its encrypted database.

## Verification

- `npm run typecheck`
- `npm run test:offline`
- Existing fuel, maintenance, owner-operation and app-account/session tests
- `node scripts/verify-field-manager-offline.cjs`
- `node scripts/verify-app-offline.cjs`

The browser harnesses use real Chromium storage, crypto, service workers, geolocation and disconnected navigation with fake account APIs. They cover all four apps, cold reopen, PIN unlock, preserved Field Manager work, wrong-account protection, storage failure, photo retry, fuel choices, corrected rejected updates, and mobile overflow. They do not write production data or certify physical Android/iOS behavior.
