# Shared enquiry pilot

## The flow

1. In the asset register, select assets and open the business directory.
2. Select a listed business. To invite an unlisted business, choose **Business not listed?**, then WhatsApp, Email or Copy link. The business confirms its own details on the free listing acceptance page; this does not share assets or publish a listing.
3. Prepare the enquiry. Enter an email, a confirmed WhatsApp number with its country code, or both. Google does not supply enquiry emails, and ordinary telephone numbers are not assumed to support WhatsApp.
4. Write the request, select photos/reports, and optionally enable invoice/quote submissions. Reports require the recipient's email so access can be matched to a verified account.
5. Create and preview the link. Use Email or WhatsApp to send it from your own app. Creating a link does not send a message automatically.
6. Email-addressed invitations open a guest email-code screen. The matching verified recipient can open the enquiry and selected reports without creating a full account. Guest replies use their own email. Full accounts are still required for document submissions and proposed asset changes. Untargeted links retain sender approval. If enabled, they can upload one invoice or quote (PDF/JPG/PNG/WEBP, maximum 12 MB) at a time, up to ten documents per enquiry.
7. Under previously shared leads, the owner selects **Review documents**. Download, accept or reject each document. Sender details are self-reported. Accepting a document does not change asset details or create a cost.
8. A recipient can optionally accept a free directory listing from the shared page. This records acceptance for admin review; it does not publish a business or unlock reports.

The link can be reopened until the owner disables it or a selected asset is deleted/transferred. Disabling it also blocks further uploads and recipient report access. Previously received documents remain available to the original owner for review. Hiding a business from the directory does not disable existing enquiry links; legacy request expiry still applies.

## Existing accounts

The existing internal partner lead flow is preserved. New shared enquiries addressed to a verified account email also appear under **Shared asset enquiries** on the website and dealer Leads pages, using the same enquiry URL. Email/WhatsApp delivery in this flow remains an explicit action in the owner's app. No automatic outbound message is sent merely by generating or previewing a link.

## Guest credits and signup

Guests see a clear notice: no personal Aim4price inbox, saved history or backup service. The sender’s records are unaffected. Minimal email verification and usage records are kept to enforce access; they are not a guest history service.

`AIM4PRICE_GUEST_ENQUIRY_CREDITS` sets the total number of distinct enquiries a verified guest email may open. Leave it unset while the product allowance remains `x`: usage is recorded but no numerical cap is enforced. Set a nonnegative integer to enable the limit (zero requires signup for new enquiries). Reopening an already-counted enquiry does not consume another credit; revocation and suspension still take precedence. Usage survives enquiry removal to prevent allowance resets. Invalid configuration fails closed.

A per-email row lock serialises credit decisions. A matching email never bypasses an explicit recipient user ID, owner revocation, asset transfer, or account suspension. Guest report access does not permit account-only changes/uploads.

Business signup now offers guest access or a full account. Invitation context is preserved through email verification and Login. Registered Business access keeps its existing verification requirements in this change. The planned immediate 14-day trial, trial welcome page and subscription billing are separate work and are not advertised as active here. No invoice is issued and no payment is taken by the guest flow.

Migration: `118-guest-enquiry-credits.sql` (also included in the lazy schema initializer). Requires the existing guest schema. A real delivery check with a controlled inbox is still needed after deployment; development checks use intercepted email.

## A small manual test

Use one dummy asset without real customer documents, one owner account, and an inbox/WhatsApp number you control. Do not contact a real company for this test.

- Create an enquiry with photos and a dummy PDF report. Enable submissions. Preview it.
- Open an email-addressed link in a private window. Verify the invited email using the code, then check the shared cards and selected reports. A different email must not gain access.
- Guest actions must offer account creation for uploads/updates. Sign in to an approved full account to send a dummy quote; it should be sent for review and not expose other submissions.
- Back in the owner's window, review the document and accept it. Confirm no costs or asset fields changed.
- Open the link signed in with the matching verified recipient account. Check report access and its entry on the Leads page. A different account must remain locked out of the reports.
- Submit the optional directory acceptance. Check the admin acceptance list; manually prepare and publish the listing, then hide it. The enquiry should still open.
- Disable the enquiry as its owner. Reload the private window: the asset page, report download and uploads must be unavailable.
- Create a second enquiry with only a confirmed WhatsApp number and no report. Email should be disabled, WhatsApp enabled, and its message should contain the correct link.

## Developer verification

- `npm run typecheck`
- `node --test tests/guest-leads.test.cjs tests/business-network.test.mjs tests/asset-share-links.test.cjs tests/public-invoice-drop.test.mjs`
- `node scripts/verify-guest-leads.cjs`

The browser check uses local component fixtures and intercepted APIs at desktop and mobile widths. Database and API tests use isolated PostgreSQL-compatible storage and mocked sessions. They do not send live messages, call Google, or change production records. A staging pass with real sign-in, configured Google search and the owner's own email/WhatsApp apps is still needed before broad rollout.

Migration: `113-shared-enquiry-documents.sql`. The existing lazy schema initializer also creates the document table. No new environment variables are required.
