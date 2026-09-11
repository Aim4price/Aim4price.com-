# Field Manager offline work

One account can have a saved offline copy in a browser at a time. Sync its queue and remove that copy before preparing another account.

Open **Offline work** from Field Manager while connected, choose an offline PIN (at least eight digits), and prepare the saved copy. This downloads the current accessible assets and upcoming maintenance assigned to that manager or unassigned on those assets. The public offline screens are installed before preparation reports success.

Without signal, Field Manager navigation falls back to the offline screen. Enter the PIN to view saved assets and tasks, record maintenance or notes/problems, capture current hours/km within maintenance, add up to four JPG/PNG/WEBP photos (5 MB each), and capture GPS at the asset. Save commits the encrypted update to the phone before showing success.

While offline work is open and unlocked, it syncs on reconnect, on unlock, every minute when pending work exists, or through Sync now. Keep it open until the pending count reaches zero. It is not an OS background-sync service: a closed or locked app does not retain the encryption key. Update saved copy refreshes assets and tasks; successful queue draining also refreshes them. Financial changes, scheduling new maintenance and fuel capture use the normal online flows.

## Privacy and correctness

- IndexedDB contains only a salt, random IV, version and AES-GCM ciphertext. PBKDF2-SHA256 derives a non-extractable key from the PIN (310,000 iterations). The PIN/key are never persisted. Cached snapshots and unsent photos share that encrypted vault.
- The worker caches an explicit list of public shell files only. It never persists authenticated HTML, APIs, documents or arbitrary images. Cache deletion is limited to its own versioned shell cache.
- One unlocked offline workspace at a time is enforced using Web Locks. Inactivity locks it after ten minutes. Sign-in/out in another Field Manager tab broadcasts a lock. The local PIN is separate from server login; offline revocations cannot be observed until reconnection.
- Each sync/upload must pass active Field Manager authentication, configured-origin validation and the original owner+manager identity. Existing scan handlers then recheck permissions/asset access and perform normal usage and maintenance validation. No client-supplied owner is used to select a database account.
- Queue items use a stable client event ID. Photo upload URLs are checkpointed individually; confirmed work is removed only after a successful server response (and maintenance completion confirmation when applicable). An interrupted upload response may leave an unused server upload; retries do not create duplicate maintenance/usage events through the existing event ID guard.
- Rejected readings, revoked access and other validation failures remain visible. Later queued updates cannot skip them. Retry after reviewing the online record/permissions, or deliberately remove a saved update with confirmation. Removing a local update does not undo any server-side work already received.
- Storage failures surface as unsaved errors. IndexedDB eviction or user-cleared browser data can still remove an offline copy. Persistent storage is requested, but browser approval varies. Forgotten PINs cannot be recovered; no unlock bypass is provided. The offline copy cannot be removed through the UI until queued work has been synced or explicitly removed.

## Validation and updates

Run `node --test tests/field-manager-offline.test.cjs` and `node scripts/verify-field-manager-offline.cjs`. The browser harness uses fake authenticated APIs and real Chromium storage/crypto/service-worker behaviour, including disconnected reload, account switching and retry after an unconfirmed write. It does not access production data. TypeScript and app isolation checks remain required.

When changing public offline shell files, bump `SHELL_CACHE` in `public/field-manager-sw.js` and the matching preparation readiness check in `offline.mjs`, so an installed worker updates the complete shell atomically. Keep schema migrations explicit before changing the encrypted vault structure.

### Offline work appearance and entry point

Open the gear at the top left of Field Manager home, then choose **Offline work**. It is no longer a main launcher card. The offline shell uses the app’s Montserrat font, green palette, patterned background and rounded controls. The font is bundled under the SIL Open Font License and cached alongside the public shell, so styling does not require Google Fonts or a live connection. Shell v2 replaces the old public shell cache without deleting the encrypted device copy.
