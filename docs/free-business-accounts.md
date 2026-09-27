# Free Business accounts: first section

Business contributors use the existing email/password login, with account_type `business` and subtype `contributor`. Signup is available at `/business/join`, linked from the existing authentication page. There is no signup invoice, billing plan lookup, or subscription requirement. Existing paid accounts keep their role; this flow does not convert them.

The dedicated `/business` workspace contains received enquiries and business details. Free contributors fail the shared active/paid API gate even though their own account status is active. Asset-register role checks continue to admit only owner/dealer accounts. Normal protected pages route Business users back to their workspace.

## Setup and pilot

1. Deploy migration `114-free-business-accounts.sql` after the existing account schema. The runtime applies the same role extension and lazily creates review tables if necessary. No existing users are converted.
2. Keep the existing authentication secret, database and Resend configuration. Configure the public auth/site origin and a verified email sender. No new secrets or prices are needed.
3. Create a test Business account at `/business/join` using an inbox you control. Use the Verify email button inside the workspace and open the verification link. This uses Better Auth's expiring verification link; passwords remain in the existing auth system.
4. Save the business name, contact number and optional website/listing and supporting explanation. For businesses without an online presence, Admin performs the manual checks outside the site and records the outcome.
5. Open Admin → Business Directory → Manage → Business verification. Check **Business verified**, record the verification basis, and save. Unverified emails and suspended accounts cannot be approved. Decisions are audited. Verification is tied to the email approved by Admin; a changed email needs a fresh approval.
6. From **Business not listed?**, choose permissions, select reports and their timelines, accept the disclaimer, and create the link. The sender does not enter a business name or email. After signing in and being verified, the recipient requests access through Manage. The owner opens **Previous invitations → Review enquiry → Manage → Recipient access** and approves the intended account. Each invitation is assigned to one account; forwarded links cannot unlock protected actions. Older email-targeted invitations continue to match the original invited email. The Business workspace shows up to 50 current enquiries after verification. Its Open enquiry link opens the existing shared page. Selected reports require the matching verified identity and Admin approval. Revoked links and assets deleted/transferred by the owner disappear.
7. Test the same link with a different Business account, remove verification, and suspend the pilot account in normal Admin account management. Confirm protected access stops. Updating business details clears approval; submitting unchanged details preserves it.

Local verification uses PGlite and mocked sessions, plus Chromium component fixtures. A deployed pilot must confirm actual signup, login/logout, email delivery and verification, account restrictions and owner-to-recipient report access. No production users, records or emails were changed during development.

## Next sections

The permission picker, verified signup handover, owner-reviewed document contributions and owner-approved field updates are implemented. Reports open the same asset or umbrella chooser used by outside sharing: valuation, maintenance, fuel, depreciation, ownership costs and maps. Its existing PDF/Excel and timeline steps are preserved. For a selection that is not a complete umbrella, choose the individual asset before adding its reports; a partial umbrella cannot export unselected members. Reports are frozen when the invitation is created. Limits remain 8 MB per report and 30 MB total. Fuel/depreciation are unavailable for property assets; adjust the selection if a report cannot be generated.

Deploy `115-external-share-permissions.sql`, `116-external-share-access-requests.sql` and `117-shared-report-formats.sql` after the existing share schema (runtime initialization is also idempotent). No new credentials are required. Test one approved recipient and a second account with the forwarded link, including report download, document review and link revocation. Access requests are visible in Previous invitations and the owner’s Manage panel; email notifications and usage counters remain future work.

Business membership for multiple staff, automatic Google lookup in this signup, evidence-file uploads, automatic billing and usage thresholds are not part of this first section. A person currently signs in with their email and password; there is no separate username field. Existing directory lookup remains available in the sharing flow.
