# Private dealer parts network

Parts is available on the website at `/parts` and in the Dealer App at `/dealer/parts`. The Parts page is visible in dealer navigation, subject to staff role permissions. Stocklists remain private until network approval. The same server membership checks protect searches, contacts, uploads and member management. These tables are separate from assets, Discovery, Marketplace and AI query sources.

## First network

1. Sign in as the dealership account owner and open Parts (`/parts`) from the dealer navigation. Aim4price administrator accounts have no Parts access.
2. Create a named private network. Its creator becomes that network’s first administrator. Invite other dealerships by their exact email addresses and share their links privately. Creating a network grants no access to other networks.
3. The dealer signs up through the existing Dealer signup/password flow, or signs in using their existing website account. Invitation signup defaults directory participation to off. Existing account activation and billing rules still apply.
4. On `/parts/join`, request the email PIN and verify it. `RESEND_API_KEY` and the existing verified email sender must be configured; this feature fails closed when email is unavailable. No PIN is returned by the API or logged.
5. In Parts → Members, the dealer network administrator verifies the dealership independently and approves its membership.

No real network, member, email or stock data is seeded by this change. No invitation is sent by deployment. Network tables are created idempotently on first use, using the same database role as existing runtime schema setup. The schema is in `lib/parts-network-schema.ts`.

## Access

- Network administrator: manage memberships and invitation links, search and upload their own dealership's list.
- Contributor: search and upload their own dealership's list.
- Viewer: search and contact only.
- Existing dealer staff permissions also apply: Owner/Manager and Parts staff can contribute; Sales staff can search; Technician staff cannot enter Parts. Staff never administer network membership or accept dealership invitations.
- The actual dealership account owner manages individual staff logins in Account → Manage Dealer App staff (`/account/dealer-app`). Existing roles, password resets and session invalidation are reused.
- Suspending membership immediately blocks new network requests and hides that dealership's listings. It does not remove their account or client records. At least one active network administrator must remain.
- Invitations expire in seven days, can be revoked and are bound to one email. PINs expire after ten minutes, have five total verification attempts and at most five sends per invitation with a one-minute cooldown. Fresh invitations cannot reactivate existing suspended memberships.

## CSV snapshots

The upload accepts comma, semicolon or tab-delimited CSV, headings and a maximum of 20,000 rows / 2 MB. Map part number, quantity and unit price. Descriptions are not required. Confirm the dealership contact details and whether prices include VAT. Leading zeros are preserved when present in the CSV; scientific notation already produced by spreadsheet exports cannot be reconstructed.

Preview lists added, updated and removed counts. Confirmation replaces only that dealer's list in the selected network, in one transaction. A revision guard rejects stale previews. Empty/malformed files and duplicate part numbers are rejected before replacement. Zero quantities are allowed but hidden from network searches. Dealers can hide their own list without deleting it. Search is literal, case-insensitive, exact matches first, with 50 rows per page. Search results always remain a table, including on phones (horizontal table scrolling).

Aim4price does not reserve or deduct stock. Existing stock software remains the master. Website users can open the existing Client Costs flow from a contact dialog; it continues to enforce client-asset permissions. No transaction is inferred from opening a contact or a cost ledger. Cross-brand compatibility and used-parts listings are outside this version.

## Validation

- `npm run typecheck`
- `node --test tests/parts-network.test.cjs tests/signup-wizard-flow.test.mjs tests/separate-app-sessions.test.mjs`
- `node scripts/verify-parts-network.cjs`

The integration tests exercise PostgreSQL semantics through PGlite. Browser tests use actual React/CSS components and intercepted synthetic network responses; they cover table results, contact, CSV confirmation, membership cancellation, phone overflow and dark styling. Actual email delivery and production database permissions require a deployment smoke check with consenting pilot accounts. Live data is never used by these tests.
