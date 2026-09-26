# External business sharing

The “Business not listed?” action now opens **Choose what to share** before creating a link. Permissions apply to every selected asset, including umbrella members.

- Asset details are a public read-only snapshot. Photos are optional.
- Reports: attach up to six selected PDFs (8 MB per file, 30 MB total). These are snapshots, not live access to the owner's report library.
- Update serial number / replacement price: submit a proposal to the existing Asset Register approval queue. The owner must accept it; replacement-price acceptance uses the established revaluation workflow.
- Invoices & quotes: verified recipients upload documents for owner review. Accepting a document does not create a cost entry.

Protected actions require the recipient email. This is also required when the link will be sent through WhatsApp. A forwarded link gives no additional rights: the signed-in email must match the invitation, the email must be verified, and a free Business account must have Admin's Business verified approval. Existing active full accounts can use their verified identity. Anonymous visitors and old guest-only sessions cannot upload or open protected reports.

A Business account remains free. There is no subscription check for the approved basic role. Signup, sign-in and email verification preserve the enquiry return path. These changes do not send invitations automatically: the sender chooses WhatsApp, email or copy link.

## Test the flow

1. As an owner, share a saved asset or umbrella inside Aim4price and select **Business not listed?**.
2. Enable reports, serial, replacement price and invoices. Continue, enter a separate test recipient email, attach a PDF, accept the disclaimer and create the link.
3. Open the link in a private browser. Open an asset, then Manage. Selected buttons should appear; clicking one should offer free signup/sign-in without allowing a write.
4. Create the recipient's free Business account. Verify its email and complete its business details. Before Admin approval, protected actions must remain locked.
5. In Admin → Business verification, tick **Business verified**, add the review note and save. Return to the enquiry and check access again.
6. Open the PDF, submit a document and propose a serial or replacement-price update. Review the proposal on the owner's Asset Register. Verify the asset is unchanged before acceptance. One update per asset can await approval at a time.
7. Reopen **Business not listed? → Previous invitations → Review enquiry** to review received documents. Test Disable, a different recipient account, and an unselected permission; none should grant access.

Migration: `115-external-share-permissions.sql` records upload actors and extends the existing correction source constraint. The relevant runtime schema setup also applies these changes when needed. Existing documents remain owner-readable; new uploads require verified recipient access, including on older links.

Later work: generating chosen report types directly within this modal, automatic invitation/reminder emails, usage-based billing rules and multi-user business permissions. Current reports are explicitly attached PDFs; current invoices are review documents, not automatic ledger entries.
