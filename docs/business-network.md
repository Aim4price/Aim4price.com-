# Business network

Owners and admin can invite a business with its name and email from the share directory (or the admin page). For owner invitations, acceptance through the emailed, 30-day management link publishes the business for all owners. No account, password or subscription is created.

Businesses confirm their contact details, headings, services and location. They can select several headings and services, add their own labels, set a service radius or nationwide coverage, and pause/reactivate their listing through an emailed management link. A paused listing disappears immediately and its old viewing links remain revoked if reactivated. Changing the verified delivery email currently requires Aim4price support.

The dealer directory combines existing subscribed dealers and accepted outside businesses. Existing dealer Leads and report permissions are retained. Matching subscriber email addresses suppress duplicate outside listings. QR dealer tracking retains its registered-dealer directory; outside businesses use the owner's email-share flow.

## Sharing

The existing owner share flow chooses one business at a time; umbrellas retain multiple-recipient selection and can include multiple member assets. External multi-asset requests validate the actual owner's umbrella membership on the server.

The owner sees the actual server-built read-only projection before sending. The email contains the message, asset identification and selected valuation summary, sender contact details and optional additional contact. A 30-day link opens the frozen asset/photo view. Resend's Reply-To is the owner's saved email, falling back to their account email. Replies are not ingested into Aim4price.

The projection deliberately excludes reports, documents, raw specifications, ledgers, scan history, live records and update permissions. Subscription links do not confer asset access: the owner must still share any additional information. Enquiry history in the directory allows owners to revoke their viewing links; this cannot recall details already delivered in an email.

Management and request links use different random tokens, stored only as SHA-256 hashes. The token is passed in the URL fragment, cleared from the address bar after opening, and sent to APIs in an Authorization header. The page does not persist it in browser storage. Reopen the original email link after refreshing the page. Requests/photos use private no-store responses. Photos are limited to snapshot entries, never arbitrary requested upload IDs.

Invitation and request rate limits use shared database counters. A stable request key per preview and recipient prevents repeated clicks from sending duplicate emails. Failed sends remain marked failed; a fresh review creates a new request attempt. Nothing shows successful delivery when Resend is unconfigured or rejects the send. No real invitation emails are sent by automated tests.

## Google connection

`GOOGLE_PLACES_API_KEY` enables server-side Google Places Text Search (New). Enable Places API (New) and billing in the Google Cloud project, restrict the key to that API, and store it only on the server. Lookup results have Google Maps attribution and are not persisted. Businesses link the selected Place ID / Maps link and independently provide their listing details. A manual Google Maps link works without an API key.

The proposed permanent one-time Google Places data import is intentionally not implemented: Google's Places policies restrict storing business content and showing it on non-Google maps. The existing directory uses Leaflet/OpenStreetMap. A future owner-authorised Business Profile integration would need separate Google approval, OAuth and a policy review. Do not describe the current connection as Google account verification, a permanent import or automatic synchronisation.

## Setup and validation

- Migration: `database/migrations/102-business-network.sql`. The idempotent runtime initializer follows the application's existing lazy-schema convention.
- Email: existing `RESEND_API_KEY` and Aim4price sender settings. A missing key blocks sends in every environment.
- Optional: `GOOGLE_PLACES_API_KEY` for lookup; manual joining remains functional without it.
- `npm run test:business-network` executes PostgreSQL-backed tests using PGlite, without a production database.
- `node scripts/verify-business-network.cjs` starts a temporary local Next server, mocks APIs, and checks mobile/desktop joining and read-only rendering. It also supports `BUSINESS_TEST_URL` for an already-running server.
- `npm run typecheck` and existing assistance/umbrella regression tests cover integration.

Before production rollout, exercise one invitation and one asset email using an explicitly selected test business mailbox. This development run does not send real email or modify the production database.


## Direct Admin listings

Admin → Manage → Business Directory → Add business manually creates an active listing immediately, without an invitation or business acceptance step. Admin can add a Google Maps link or use the optional Google lookup, and enter the business contact email, headings, services and location. Lookup stores only the Place ID and Maps link; it does not connect a Google login or synchronise profile content.

Admin can edit, publish and hide existing listings. Existing delivery emails remain fixed. Hiding also revokes existing enquiry viewing links. Direct Admin actions are recorded in `business_network_admin_actions` (migration 103, also initialised at runtime); `accepted_at` is reserved for actual business acceptance. Creating a manual listing sends no email and creates no account or management token. The business can request its own management link through the existing email flow later.
