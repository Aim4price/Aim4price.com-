# Shared enquiry pilot

## The flow

1. In the asset register, select assets and open the business directory.
2. Select a listed business, or expand **Business not listed?** to search Google or enter a name.
3. Prepare the enquiry. Enter an email, a confirmed WhatsApp number with its country code, or both. Google does not supply enquiry emails, and ordinary telephone numbers are not assumed to support WhatsApp.
4. Write the request, select photos/reports, and optionally enable invoice/quote submissions. Reports require the recipient's email so access can be matched to a verified account.
5. Create and preview the link. Use Email or WhatsApp to send it from your own app. Creating a link does not send a message automatically.
6. The recipient can see the shared cards and request without an account. Reports remain restricted. If enabled, they can upload one invoice or quote (PDF/JPG/PNG/WEBP, maximum 12 MB) at a time, up to ten documents per enquiry.
7. Under previously shared leads, the owner selects **Review documents**. Download, accept or reject each document. Sender details are self-reported. Accepting a document does not change asset details or create a cost.
8. A recipient can optionally accept a free directory listing from the shared page. This records acceptance for admin review; it does not publish a business or unlock reports.

The link can be reopened until the owner disables it or a selected asset is deleted/transferred. Disabling it also blocks further uploads and recipient report access. Previously received documents remain available to the original owner for review. Hiding a business from the directory does not disable existing enquiry links; legacy request expiry still applies.

## Existing accounts

The existing internal partner lead flow is preserved. New shared enquiries addressed to a verified account email also appear under **Shared asset enquiries** on the website and dealer Leads pages, using the same enquiry URL. Email/WhatsApp delivery in this flow remains an explicit action in the owner's app. No automatic outbound message is sent merely by generating or previewing a link.

Existing approved guest report entitlements are honoured. New paid guest signup is not promoted on the shared page; billing and payment collection are outside this pilot.

## A small manual test

Use one dummy asset without real customer documents, one owner account, and an inbox/WhatsApp number you control. Do not contact a real company for this test.

- Create an enquiry with photos and a dummy PDF report. Enable submissions. Preview it.
- Open the link in a private browser window. Check the card/request are visible and the report cannot be opened.
- Send a dummy quote from that private window. It should say the document was sent for review, and should not expose a list of other submissions.
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
