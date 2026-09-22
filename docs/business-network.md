# Business directory and guest leads

## Add a business yourself

1. Open **Admin → Manage → Business Directory → Add business manually**.
2. Enter the business name, email, contact information, headings/services and location. A Google Maps link or optional Google lookup can link its profile.
3. Save the draft. Select **Approve and publish** when you want it in the directory. No invitation or account is required.
4. Use **Hide listing** to remove it. Editing a hidden listing does not publish it again.

Publishing is an explicit admin decision, recorded in the admin audit table. A business cannot publish itself through an old management link.

## Let a business accept first

Copy `/business-network/accept` from the Acceptance link panel. Send it yourself through your own email or WhatsApp.

The form asks for business name, contact name, email, optional phone and consent. It records the acceptance; it does not publish, charge, send an invitation or create a full account. Duplicate submissions cannot overwrite an earlier acceptance.

In the admin directory, expand **Business acceptances**, choose **Prepare listing**, complete the listing, save and then **Approve and publish**. Refresh acceptances after someone submits. Submitted email addresses are not verified by this form: check their details before publication.

## Send an outside lead

1. As an owner, select saved assets and share outside Aim4price or choose an external directory business.
2. Select **Lead page · protected reports** (the default for an external business).
3. Choose photos and use **Add report** to select the PDFs you want to share.
4. Enter the recipient email, request and reply details. You can turn the reply buttons off.
5. Choose **Create lead link**, preview it, then choose email or WhatsApp. Your own email/WhatsApp app opens; you send the message yourself.

The basic asset snapshot, included photos and request are visible to anyone with the link. **Manage · shared reports** lists only the PDFs you selected. PDF files stay on Aim4price; this mode does not attach them to email/WhatsApp.

Each request has its own recipient-specific link. Links do not expire automatically, but the owner can disable them under **Previously shared leads**. Deleting or transferring any included asset also makes the page unavailable. These are saved snapshots: create a new lead to share updated information. Previously downloaded copies cannot be recalled.

**Message & attachments** remains available for ordinary outside sharing. Internal Aim4price businesses keep their existing lead flow.

## What the recipient sees

- Without signing in: asset card, request, included photos and owner-enabled reply options.
- **Manage → Sign up / sign in with email**: limited guest registration using an emailed six-digit code. No full Aim4price workspace is created.
- After verification: reports remain locked until guest access is active.
- With matching verified email and active guest access: selected reports open. An eligible active full Aim4price account with that verified email also has access.
- Wrong email, suspended/expired access, disabled link or removed ownership: report access is refused on the server, even if the download URL is known.

The receiving business pays. There is no automated checkout in this release.

## Activate paid access manually

1. Have the business confirm its email on its lead page.
2. Open the admin directory and refresh **Guest report access**.
3. After receiving payment, choose the expiry date, enter a payment reference/note and select **Activate paid access**.
4. Ask the business to select **Check access again** on its lead page.
5. **Suspend access** blocks subsequent report downloads immediately. Access also ends at the selected expiry (end of that date in UTC).

Activation applies to reports shared with that business email; it does not open other recipients' leads. All changes are audited with the admin identity, expiry and note.

## Google profiles

Existing profile enrichment and account badges are retained. `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` supports selected-profile details in the browser; `GOOGLE_PLACES_API_KEY` supports optional server lookup. Google-returned profile content and attribution remain transient; listing records retain the Place ID/Maps link and independently entered business details. This release does not add Google OAuth, permanent profile imports or Google-account verification.

## Setup and verification

- Migration `112-directory-guest-leads.sql` follows migrations 102/103/111. The server also applies the idempotent schema on first use.
- Existing `RESEND_API_KEY` and sender configuration are required **only for guest sign-in codes** in this new flow. Lead messages and the acceptance link are sent manually. No actual emails are sent by these tests.
- Reports: up to six PDFs per lead, 8 MB each, 30 MB total. Private PDF bytes are stored with the lead in PostgreSQL and served only after authorization. Photos reference existing saved media.
- Guest sessions use a hashed random token in the database and a Secure/HttpOnly cookie in production, valid for 30 days. Codes expire after ten minutes, can be used once, and have per-email/IP rate limits. Every report request rechecks entitlement.
- Legacy invitation/request endpoints remain for existing links and history; acceptance no longer auto-publishes a listing.

Automated checks:

```sh
npm run typecheck
node --test tests/guest-leads.test.cjs tests/business-network.test.mjs tests/asset-share-links.test.cjs
node scripts/verify-guest-leads.cjs
```

Browser checks use local fixtures and intercepted APIs. They cover mobile/desktop acceptance, lead creation/revocation, draft preservation, guest sign-in states and admin activation. PostgreSQL-backed tests cover ownership, report isolation, code expiry/reuse, access suspension and admin authorization.

## Simple deployment smoke test

Use one test asset and a mailbox you control:

1. Submit the acceptance form. Check it appears in admin but not the directory.
2. Prepare/save/publish the business. Check it appears; hide it and confirm it disappears.
3. Share the test asset with a PDF to that mailbox. Send the link using your own email.
4. Open in a private browser. Confirm the card/request display and the report is locked.
5. Request a real sign-in code, verify, and confirm the report is still locked.
6. Activate access as admin, refresh the lead and open the PDF.
7. Suspend access and try the same report URL again: it must refuse access.
8. Reactivate, then disable the lead as owner: the card and reports must become unavailable.

A live smoke test is still needed to verify deployment database permissions, outbound code delivery and the configured Google keys. Local fixtures do not prove those external services work.
