# Phase 1: permanent free sharing accounts

External enquiry recipients now create a normal Aim4price email/password account. The free Business workspace lists sender-authorised enquiries and provides verification, account details and a Desktop upgrade entry. Existing owner/dealer identities and asset/client register ownership remain unchanged.

## Access boundaries

- Email verification and sender authorisation permit reading enquiry details and enabled reports.
- Administrator business verification plus each sender permission are still required for document submissions and proposed corrections. Owner approval of changes remains unchanged.
- Free Business users cannot open full Desktop pages, including Leads; full-account API sessions still reject them unless an endpoint explicitly opts into approved Business contributions.
- Legacy WhatsApp-only enquiries require an owner-approved account binding before opening; a forwarded link is not proof of identity.
- Recipient email/account binding, revocation, suspension and asset ownership checks remain in force. Anonymous enquiry requests return an account gate without asset data in client props.
- Legacy guest cookies can prefill signup email but no longer authorise enquiries or reports. POST `/api/guest-access` returns 410; old guest URLs forward to signup.
- Signup, verification, login, password reset and account switching retain validated enquiry return paths. Password fields support password managers.
- Account and shared-enquiry routes retain the canonical desktop canvas, automatic scaling, zoom controls and phone landscape entry.

## Business identity and migration

Apply `database/migrations/122-business-workspaces.sql` before release. Runtime schema setup is idempotent as a compatibility fallback. Workspaces and owner memberships are created lazily for existing Business accounts and during new Business signup. There is no asset ownership backfill.

A user initially belongs to one workspace. Multiple distinct users and verified emails can belong to a workspace, providing the foundation for future team invitations; there is no team-management UI in this phase. Revoked memberships are never automatically reactivated. Verified email claims cannot be stolen by another workspace.

Legacy guest records stay intact. Verified email claims associate their distinct opened-enquiry history and suspension with the workspace, including after the login email changes. This is migration groundwork, not the new credit ledger. The UI does not promise a numeric credit allowance or charge for opens yet.

## Validation and release

Run:

```sh
node --test --test-concurrency=1 tests/business-workspaces.test.cjs tests/business-accounts.test.cjs tests/basic-business-access.test.cjs tests/external-share-permissions.test.cjs tests/guest-leads.test.cjs tests/guest-enquiry-credits.test.cjs tests/shared-account-page.test.cjs
node scripts/verify-free-business-access.cjs
npx tsc --noEmit --incremental false
```

The browser check uses temporary local fixtures, intercepted APIs and desktop/phone viewports. Database tests use PGlite. No production signup or email is sent. After deploying, verify actual email delivery and the complete verification/reset callback flow with a pilot recipient before wider rollout. Apply the migration first; no new secrets are required.

Later phases still cover live asset link data, revised sharing choices, maintenance email sharing, directory replacement, credit consumption/anti-replay tracking and subscription enforcement. Legacy basic snapshot links without enquiry metadata keep their existing behaviour until the live-link phase. The credit panel is a placeholder; this phase must not be presented as completed credit enforcement.
