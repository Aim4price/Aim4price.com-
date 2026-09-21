# Business directory and sharing

The asset-sharing directory shows real Aim4price accounts and accepted directory listings. Managed Aim4price service-area records remain available for historical leads but are excluded from directory results. Need help opens the existing outside-sharing screen addressed to Aim4price.

Selecting a business opens its profile. Send message keeps account recipients in the existing lead and permissions flow. Directory-only recipients open AssetExternalShare with the selected asset/umbrella scope and business contact details. This also applies to the owner app. No server email is sent by this handoff. With attachments, the existing device share sheet still requires the owner to select the destination app and recipient.

## Google setup

- Set `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` for the browser Maps JavaScript API and Places API (New). Restrict this key to the production/preview site referrers and required APIs. Rebuild after setting it.
- The existing invitation/admin Google lookup uses the server-only `GOOGLE_PLACES_API_KEY` with Places API (New). Enable billing and restrict the key to the required API.
- Businesses link their Google place in the invitation or admin editor. The directory retrieves current profile name, address, category, website and photo for display. Only the place ID/link and independently confirmed business details are saved; retrieved Google profile content is not persisted.
- Without the browser key, the existing OpenStreetMap directory remains available with business-confirmed profiles. Google retrieval failures leave those confirmed details usable.

## Acceptance

Manual additions are saved as drafts awaiting acceptance. Admins can explicitly send an invitation from Business Directory. The invitation explains a free listing versus an account, asks the business to confirm its own details and records acceptance. Existing active rows without `accepted_at` are hidden from the directory and shown as awaiting acceptance in admin; invite them before publishing. No acceptance is fabricated or backfilled.

No database migration is required. Existing request history and invitation delivery are retained. No invitations or production data changes are performed by deploying the code alone.

## Verification

Run `npm run typecheck`, `npm run test:business-network`, `npm run test:assistance-network`, and `node --experimental-strip-types --test tests/asset-external-share.test.mjs tests/external-file-share.test.mjs`.

`node scripts/verify-directory-sharing.cjs` uses local account/business fixtures and browser interception, with no real messages. It checks the directory/profile and outside-share handoff at desktop and phone widths. Live Google credentials, real device share targets and attachment delivery require deployment/device verification.
