# Desktop users and access

New emails receive a separate owner-managed desktop login, active immediately. Passwords use salted scrypt hashes; session cookies contain random tokens whose SHA-256 hashes are stored server-side. Passwords are never emailed or returned to the client. Owners share the business-specific `/team?business=…` sign-in link and initial credentials. They can reset these desktop passwords; resets and revocation invalidate existing sessions.

If the email already belongs to a personal Aim4price account, its account ID is bound to a pending invitation and the supplied password is discarded. The person receives an invitation and signs in with their existing password. No personal account credential is created or replaced. Separate desktop sessions work only in the team APIs and never become owner/personal sessions. Multiple businesses can issue isolated logins for the same email using their own sign-in links.

Legacy pending invitations without a bound personal account should be edited by the owner to assign a password or bind an existing account. The old verified-account acceptance fallback remains for legacy invitations only; newly bound existing accounts need no email verification.

Account → Desktop users is available to eligible active Owner, Dealer and Business desktop account holders without a separate email-verification step. The owner enters a name, exact email address and initial password, selects permissions and asset scope, and may set an expiry (the UI uses end-of-day South Africa time). Invitations use the existing email delivery service; delivery failure leaves a reviewable saved invitation and a copyable `/team` link. The shared business sign-in link alone never grants access.

Staff use their owner-created desktop login or their existing personal account. Existing-account invitations are bound to that account ID at creation, and both the ID and email must continue to match. Owner-created logins are bound only to their business grant. Staff do not need a paid desktop plan. The business granting access must retain an active desktop account. The team workspace never replaces the authenticated user with the business owner's identity.

## Permissions and scope

Asset details are readable within scope. Additional permissions default off for new grants. Starting templates enable their named actions; Manager includes financial visibility. Owners can grant editing of title/brand/model/year/condition, increasing usage, maintenance viewing/completion, document upload, photos, values and CSV export separately. Completion implies maintenance viewing. Neither maintenance permission permits changing schedules, deleting records or stopping future repeats. Service completion still requires the company and mechanic. Viewing photos and uploading photos are separate permissions.

Scopes are all current/future business assets, selected registers (including future assets in those registers), or individual assets. Selected registers and individual assets form a union. Asset ownership and current register membership are rechecked by the server. Grant scope does not confer access to another account if an asset is transferred.

Owners use the app-style Add user / Manage users launcher; there is no separate owner-facing workspace button. Invited users on other accounts can reopen My desktop access from Account. Signed-in owners use their existing session; there is no extra verification gate.

The dedicated desktop workspace is `/team`. Other desktop pages/APIs continue to operate on the employee's own account. They cannot acquire the account holder's billing, account administration, asset sharing, sale, asset deletion, transfer or access-management powers through a grant. Fuel, costs, budgets, maps and reports have explicit team permissions and retain their server-side scope checks.

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

## My access

`/team/access` is the read-only access summary for both managed desktop logins and personal accounts receiving access. Management account pages omit this staff-only shortcut. Eligible Owner, Dealer and Middleman account holders visiting this page directly return to Account; their invited workspaces remain accessible at `/team`. Business and other recipient account pages retain the shortcut. A managed desktop session visiting `/account` is redirected here; a personal session continues to show its own Account page. Managed workspace pages omit the personal-account navigation.

The summary shows one compact card per granted business, with its status, asset-scope summary and value visibility. Open workspace is the primary action. View permissions expands read-only scope details, granted actions, approved-document count and expiry in South Africa time; only one card is expanded at a time. Pending invitations offer Review invitation, and unavailable workspaces have no opening action. The same presentation serves every eligible recipient account type and managed desktop login. It refreshes on focus and every 30 seconds, clears on hidden/error, and links active eligible grants directly to their workspace. The workspace APIs still authorize every request; a query-string membership ID never grants access. Password resets remain with the main account holder for managed logins.

## Dealer and Business desktop users

Dealer and Business desktop account holders use the same Add user, Manage users, login/password, permission groups, asset picker, document controls and save/revoke flow as Owners. Business issuance requires an active desktop subscription and an active, unsuspended business workspace owner membership. Free accounts and secondary business members cannot issue grants. This does not change subscriptions or upgrade account types. Existing Middleman asset grants remain supported without adding client features.

Dealer templates are View only, Sales, Technician, Parts desk and Manager. Business templates are View only, Staff and Manager. All non-manager templates keep asset values, client values and financial permissions off. Templates are editable starting points, not authorization roles. Manager enables the displayed actions only: it does not grant billing, user administration, marketplace publishing, asset sharing, asset deletion or account ownership.

Own Asset access covers only assets owned by the granting account and uses the existing report, fuel, costs, maintenance, map and document enforcement. Dealer and Business users may have no owned assets selected so a client-only login is possible. The Owner selection requirement is unchanged.

Client work is a separate, explicit selection of enquiries or addressed shared-asset collections. Newly received work is never automatically added; an existing selected umbrella continues to follow its sender-controlled live membership. Own all-assets scope does not include client assets. Existing grants receive no client permission or client selection during migration 155.

The client workspace supports selected enquiry summaries, safe asset previews, optional shared values, optional supplied contacts, and explicitly permitted enquiry status changes (viewed, accepted, quoted, declined). A shared-asset collection is read-only. These switches do not delegate client record editing, parts management, maintenance completion, client documents/reports, free-text replies, forwarding or deletion. The account holder continues to use the existing client tools for those actions. Business-owned asset reports retain the same Owner report generation and explicit export permissions.

Client APIs recheck staff identity, grant version/status/expiry, issuer eligibility, assignment, recipient identity, sender status, current asset ownership and share revocation. Business client access also retains the original business-read eligibility check. Public/untargeted links cannot be delegated by knowing a token. Raw snapshots, private text, URLs and share tokens are never returned; shared collection IDs are hashes. Values are shown only when both staff permissions and the original share permit them. Original messages and files are omitted because they may include hidden prices or private links. Status writes lock the grant, enquiry and asset, record the real employee in the team audit, and never assume the owner's identity.

Validation: `node --test tests/team-access.test.cjs tests/team-account-access.test.cjs tests/team-workspace-permissions.test.cjs`, `npm run typecheck`, and `node scripts/verify-team-access.cjs`. The browser fixture covers Owner, Dealer and Business editors at desktop and narrow widths, independent client selection, save payloads and client-work clearing after revocation.
