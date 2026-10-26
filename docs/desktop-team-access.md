# Desktop users and access

New emails receive a separate owner-managed desktop login, active immediately. Passwords use salted scrypt hashes; session cookies contain random tokens whose SHA-256 hashes are stored server-side. Passwords are never emailed or returned to the client. Owners share the business-specific `/team?business=…` sign-in link and initial credentials. They can reset these desktop passwords; resets and revocation invalidate existing sessions.

If the email already belongs to a personal Aim4price account, its account ID is bound to a pending invitation and the supplied password is discarded. The person receives an invitation and signs in with their existing password. No personal account credential is created or replaced. Separate desktop sessions work only in the team APIs and never become owner/personal sessions. Multiple businesses can issue isolated logins for the same email using their own sign-in links.

Legacy pending invitations without a bound personal account should be edited by the owner to assign a password or bind an existing account. The old verified-account acceptance fallback remains for legacy invitations only; newly bound existing accounts need no email verification.

Account → Desktop users is available to active Owner and Dealer desktop accounts without a separate email-verification step. The owner enters a name, exact email address and initial password, selects permissions and asset scope, and may set an expiry (the UI uses end-of-day South Africa time). Invitations use the existing email delivery service; delivery failure leaves a reviewable saved invitation and a copyable `/team` link. The shared business sign-in link alone never grants access.

Staff use their owner-created desktop login or their existing personal account. Existing-account invitations are bound to that account ID at creation, and both the ID and email must continue to match. Owner-created logins are bound only to their business grant. Staff do not need a paid desktop plan. The business granting access must retain an active desktop account. The team workspace never replaces the authenticated user with the business owner's identity.

## Permissions and scope

Asset details are readable within scope. All additional permissions default off, including values in every template. Owners can grant editing of title/brand/model/year/condition, increasing usage, maintenance viewing/completion, document upload, photos, values and CSV export separately. Completion implies maintenance viewing. Neither maintenance permission permits changing schedules, deleting records or stopping future repeats. Service completion still requires the company and mechanic. Viewing photos and uploading photos are separate permissions.

Scopes are all current/future business assets, selected registers (including future assets in those registers), or individual assets. Selected registers and individual assets form a union. Asset ownership and current register membership are rechecked by the server. Grant scope does not confer access to another account if an asset is transferred.

Owners use the app-style Add user / Manage users launcher; there is no separate owner-facing workspace button. Invited users on other accounts can reopen My desktop access from Account. Signed-in owners use their existing session; there is no extra verification gate.

The dedicated desktop workspace is `/team`. Other desktop pages/APIs continue to operate on the employee's own account. They cannot acquire the business owner's Account, billing, finance, sharing, sale, deletion, transfer, cost ledger or access-management powers through this grant. These features intentionally have no team permission switch in this implementation.

## Hidden values and files

Team responses are explicit projections; owner records, arbitrary specification JSON, private notes, document URLs, financial balances, totals and history snapshots are not serialized. Current/replacement/insured values are emitted only with `viewValues`. CSV uses this same projection and independently checks export permission. CSV cells escape spreadsheet-formula prefixes.

Documents require explicit document IDs approved by the owner, and every linked asset must remain in scope. Recycled documents are unavailable. Download routes reauthorize each request and return attachment bytes, without reusable owner download links. Newly uploaded documents go into the existing document vault for owner review; they do not automatically become visible to colleagues. Document access is intentionally independent of structured value visibility: an approved invoice, photograph or maintenance note may contain prices. The owner UI makes this explicit. No automated redaction of user-authored files or text is claimed.

Photos use the existing internal upload store through authenticated team endpoints. Unsupported legacy external photo URLs are not fetched or redirected, to avoid exposing unguarded URLs or introducing server-side URL fetching. Uploads reuse existing type/size validation and idempotent request IDs.

## Revocation, concurrency and audit

Grant status, identity, expiry and owner account eligibility are checked on every team API request. Updates re-lock the grant and asset inside the operation's transaction. The lock rejects changed grant versions, revocation and assets moved out of scope. Owner edits require a version, preventing silent overwrite of another permission edit. Existing-account re-invitations require acceptance again. Reactivated managed logins require a fresh password sign-in.

The browser refreshes permissions on focus and every 30 seconds; it clears sensitive workspace data when hidden and when access fails. Responses use private/no-store headers. Data already viewed, photographed or downloaded cannot be recalled.

A separate owner-only activity log attributes invitations, acceptance, permission changes, revocation, asset edits, completions, exports and uploads to the real actor. Existing asset-history triggers also receive the actor identity for team writes. Deleting an employee login clears its membership binding without deleting the business audit trail. Stored mutation audit details list field names, not financial before/after snapshots. The owner UI displays the latest 100 team events.

## Storage and verification

`lib/team-access-schema.ts` installs the grant, audit, login and session tables lazily, matching migrations `143-desktop-team-access.sql` and `144-owner-managed-desktop-logins.sql`. No existing role/session tables are changed. Rollback can disable the two entry links and team routes; existing account sessions are unaffected.

Run:

- `npm run typecheck`
- `node --test tests/team-access.test.cjs`
- `node scripts/verify-team-access.cjs` (optional `CANVAS_BROWSER_PATH`)

The tests use synthetic users, a temporary PostgreSQL-compatible database and mocked network responses. They do not invite real people, modify production assets or send emails. Browser screenshots are written under `.next/team-access-validation`. CI runs the same checks.
