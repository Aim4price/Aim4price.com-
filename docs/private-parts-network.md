# Dealer parts lists

Parts lives in dealer accounts at `/parts` and `/dealer/parts`. Named cards use Share / Open / Manage. Owners can create separate Landini, John Deere or second-hand lists; these are names, not compatibility claims. Open navigates to a dedicated page at `/parts/[listId]` or `/dealer/parts/[listId]` with a searchable table and Back to Parts navigation. Legacy `?list=` links redirect to the dedicated page; website login preserves that destination. CSV replacement changes only the selected list. Aim4price never reserves, deducts or manages master stock.

## Sharing and receiving

- **Inside Aim4price:** the owner enters the recipient email. A private invitation appears in that account’s Parts and Leads inbox. The signed-in account owner accepts it; the sender’s explicit share grants view/enquiry access. No email is sent automatically.
- **Share a link:** email-bound, seven-day invitation. Existing sign-in/signup flow is reused. The recipient verifies the emailed PIN and the owner approves them through Manage → Sharing & access. Reopening an accepted link checks account access and opens the list without demanding another login from an already signed-in user.
- Accepted shares remain alongside owned lists on Parts (labelled Shared parts list) and in the Parts section of Leads. Pending/suspended accounts see access status, not the parts table. Revocation is checked on every API request.
- New lists are owned by one dealership. Recipients cannot replace its CSV, reshare it, change permissions or rename/delete it. They can create and share their own independent lists.
- Existing legacy groups and their contributions are retained, including legacy role permissions. The UI no longer asks users to create a network. No live data migration or deletion is performed.

## Management and enquiries

Manage allows rename, CSV replacement, visibility, sharing history, access suspension/restoration and confirmed deletion. Deletion archives the list, blocks reads and invitations, and retains audit/enquiry records. Existing dealership staff roles still govern access: Owner/Parts can upload their dealership’s lists, Sales can view/enquire, Technician cannot enter Parts. Staff cannot create lists or manage dealership shares. Individual staff logins remain under Account.

Enquire beside another dealer’s part opens a prefilled message. Sending creates a Parts enquiry in the recipient’s Leads and Parts inbox, with part number, list name, message, sender email and date. The recipient can reply by email and mark it handled. Repeated sends within one minute are rejected. Enquiries are separate from asset leads and do not manufacture an asset or alter stock. Direct call/email/WhatsApp and the website client cost ledger link remain available.

## CSV and privacy

CSV supports comma, semicolon or tab separators, column mapping, 20,000 rows / 2 MB, VAT basis and dealership contact details. Leading zeros are preserved when present in the source. Preview shows added, updated and removed counts; a revision guard prevents stale replacement. Invalid, empty and duplicate snapshots fail before any replacement. Zero quantities are hidden from shared searches. Tables scroll horizontally on small screens.

Private responses are no-store and excluded from indexing. Parts data is not added to Marketplace, Discovery or AI sources. Aim4price platform administrators cannot enter dealer Parts. Runtime schema changes are additive and idempotent in `lib/parts-network-schema.ts`. Email PINs require existing `RESEND_API_KEY` and verified sender configuration. PINs expire in ten minutes, allow five attempts and five sends, with a one-minute resend cooldown. Invitation replay cannot restore suspended membership.

## Validation

- `npm run typecheck`
- `node --test tests/parts-network.test.cjs tests/signup-wizard-flow.test.mjs tests/separate-app-sessions.test.mjs`
- `node scripts/verify-parts-network.cjs`

PGlite tests exercise actual SQL for isolated replacement, permissions, direct/link invitations, suspension, enquiry ownership and archive behavior. Browser checks use real React/CSS with synthetic APIs for cards, tables, both sharing methods, enquiry creation, CSV review/import, access cancellation, dark mode and phone overflow. Live email delivery and production database behavior still need a pilot smoke check after manual merge/deployment. No real invitations or enquiries are sent by the tests.
