# Aim4price invoicing v1

Admin → Billing is the central invoice workspace. Accounts and Work Tracker link directly into the selected customer's billing workspace. Customers, including accounts awaiting activation, can open `/billing` to see issued invoices, balances and PDF downloads.

## Setup before enabling signup invoices

1. Deploy migration `110-aim4price-billing.sql`, or let the runtime apply the same idempotent schema under a database advisory lock. Existing accounts are not back-billed. No prices are seeded.
2. Configure `RESEND_API_KEY`, a verified sender in `AIM4PRICE_BILLING_EMAIL_FROM` (falls back to `AIM4PRICE_EMAIL_FROM`, then `Aim4price <billing@aim4price.com>`), and the correct public site origin using the existing email configuration.
3. In Billing → Signup invoice settings, set the description, agreed rand price, interval and days to pay for each relevant account type. Publish the plan when ready. An unpublished/missing plan leaves signup without an automatic charge. Free Middleman accounts remain excluded.
4. Check a synthetic account's signup, PDF download and email in the deployed environment before rollout. Local verification uses synthetic data and a mocked Resend API; no real email has been sent during development.

The server validates the accepted plan version and price; submitted prices cannot override it. Signup queues the accepted quote durably after account creation. A production Node worker prepares invoices and sends queued email every 30 seconds. Failed preparation retries after five minutes and Admin shows the pending/failing count. `AIM4PRICE_BILLING_DISABLED=1` pauses the worker; it does not disable signup quote collection or Admin issuing.

This follows the existing long-running Railway/Next.js instrumentation model. A deployment that suspends the Node process needs an external scheduled worker invoking `processSignupInvoices` and `dispatchBillingMail`; this version does not supply that scheduler.

## Invoice workflow

- Choose an account, create a draft, enter billing details and an explicit payment due date. Business name and customer/PO reference are optional and appear on the PDF. Account business/address details prefill missing saved billing details; **Use account details** explicitly replaces an override. A new manual invoice starts with a blank customer reference. The payment reference remains the invoice number. Add manual lines or selected completed Work Tracker sessions at an agreed hourly rate.
- Saving reserves selected work so it cannot appear on two invoices. Drafts can be edited or deleted. Changing a reserved work charge requires deleting and recreating the draft.
- **Save & preview** opens the saved draft in a focused preview dialog. Review it, then choose **Issue & email** inside that dialog. Issued invoices open through **View invoice** in both Admin and customer Billing; PDF download becomes available after the preview loads. Draft PDF downloads retain draft wording and are rendered fresh from the latest saved details. **Issue & download PDF** assigns the final invoice number and freezes the invoice without queuing an email; **Issue & email** also queues delivery. Issued PDFs have no draft wording. Failed previews show a retry action.
- Issuing an invoice assigns a unique invoice number, freezes issuer/customer/charge details and the canonical HTML, and queues the PDF email in the same transaction. Repeating the issue request does not create another invoice/email.
- Record only verified receipts. Partial payments are supported. Repeating the same payment request is safe; amounts above the outstanding balance are rejected. Payment entries are audited and do not activate account access.
- Unpaid issued invoices can be voided with a reason. Voiding retains history, releases work reservations and prevents queued sending. Already-sent messages cannot be withdrawn; contact the customer about the correction. Paid invoices cannot be voided. Payment reversal, credit notes and refunds are not implemented in v1.

Signup plans still store a next billing **review** date and do not automatically enable recurring billing. Admin now has two explicit paths:

- **Manual billing:** create, preview, issue/email and record payment for individual invoices. Manual charges are additional to an enabled recurring agreement; check for overlapping charges.
- **Automatic billing:** choose an account and save customer details, recurring line items, monthly/yearly frequency, first/next invoice date and days to pay. Save paused while pricing is undecided. Enabling requires explicit confirmation of customer agreement and displays the amount, recipient and start date. Public plan changes do not change account agreements.

Apply migration `114-billing-agreements.sql` to existing databases (runtime schema creation also includes these idempotent tables). Existing accounts are not enrolled. The existing production Node worker checks approved agreements every 30 seconds, issues each due invoice and queues its email in one transaction. Account/date generation keys and row locks prevent duplicate scheduled invoices. Dates use the agreed calendar day with month-end clamping, retaining January 31 and leap-day anchors. Work Tracker charges remain manual.

Pause stops future generation, not already-issued invoices or queued mail. Pauses and agreement edits are audited with the actor and a snapshot. A stale editor must refresh after a worker run or another edit. Changes affect future invoices only. If an entire additional billing period has elapsed, the worker pauses the agreement for review instead of back-billing. Generation errors are visible on the agreement and automatic-billing account list; the worker retries. The list shows up to 200 agreements; any account remains selectable through the account picker.

`AIM4PRICE_RECURRING_BILLING_DISABLED=1` pauses recurring generation only; manual email processing and signup processing continue. `AIM4PRICE_BILLING_DISABLED=1` pauses the entire worker. A continuously running production Node process is required. Email delivery still requires the sender/Resend setup above. Validate concurrent worker runs against deployed PostgreSQL before enabling customer agreements; local PGlite tests do not implement real row/advisory locks.

Automatic billing means scheduled invoices, not automatic collection of funds. Payment recording and account access remain manual. Payment-provider integration, reminders, automatic suspension, pro-rata adjustments, refunds and credit notes are not part of this foundation. Existing signup settings remain separate under Advanced settings; avoid enabling a same-period recurring charge on top of a signup invoice.

## Invoice design and supplied details

The invoice uses Aim4price's shared report theme, bundled Montserrat fonts and logo: green headings, split customer/total summary, line table, totals and payment panels on white A4 pages. It uses the canonical HTML-to-PDF renderer, with no substitute template. Long invoices repeat table headings and carry page numbers.

- No VAT applicable; amounts and balances are ZAR.
- Address: 14 Saffraan Ave, Denneoord, George, 6529.
- Contact/reply-to: Aim4price@gmail.com.
- Bank: ABSA. Account number: 4113 0591 64.
- Payment reference: the invoice number. No unconfirmed account-holder name or branch code is invented.

Issued documents are immutable snapshots of the original charge. Payment updates appear in Billing; they do not rewrite the emailed PDF. The first generated PDF is retained and reused for subsequent downloads and emails. Deleting an account retains invoices/payment/audit snapshots with a null account link, removes its billing profile and signup job, and prevents further email sending. Finance-record retention is separate from account access.

## Email status and recovery

**Accepted by email provider** means Resend returned an email ID, not proof of delivery. Delivery/bounce webhooks are not included. **Queued**, **sending**, **retry** and **needs review** remain distinct. Invoice History exposes attempts, provider reference and the latest error.

Each mail job freezes the exact JSON request bytes before sending and uses a stable idempotency key. Transient failures retry every five minutes, up to five attempts. Ambiguous attempts older than 23 hours stop for review rather than risking a duplicate after Resend's 24-hour idempotency window. Check Resend before explicitly resending an invoice marked needs review. A confirmed resend is a new mail job and may deliver another copy.

Reference: [Resend send-email API](https://resend.com/docs/api-reference/emails/send-email) and [idempotency keys](https://resend.com/docs/dashboard/emails/idempotency-keys).

## Validation

`node --test tests/billing*.test.mjs` exercises the actual PostgreSQL schema and billing queries in PGlite, monetary/date validation, draft edits, work reservations, ownership, invoice/payment idempotency, signup quote validation, API authorization/origin checks, retry payload stability and expired retry review. PGlite stubs advisory locks; production concurrent-lock behavior still needs deployed PostgreSQL verification.

`node scripts/verify-billing-report.cjs` renders synthetic one-page and three-page invoices. `node scripts/verify-admin-review.cjs` covers Admin rendering/navigation plus the billing draft composer at desktop and phone widths. Evidence is uploaded by the billing CI workflow. No production authentication, database or live Resend delivery is exercised by these fixtures.


## Billing suspensions and customer presentation

Admin Billing offers **Suspend account** on issued invoices with an outstanding balance. A customer-visible reason and explicit confirmation are required. Already suspended accounts offer **Update suspension** so an admin can link the correct invoice and replace the reason. The server checks the invoice version and current account status, rejects admin/self suspension, locks the invoice and account, and writes the access change and invoice audit event in one transaction.

The suspended customer sees the reason, current invoice balance, original issued document and PDF download directly on `/pending-payment`. Invoice requests still require a session and invoice ownership. Voided linked invoices show their void status and a support prompt. Billing remains available while access is suspended. Existing access enforcement and background ingestion rules are unchanged. Recording a payment does not reactivate the account: restore access in Admin Accounts after review. Any status change there clears the billing suspension context so it cannot appear on a later unrelated suspension.

Migration `116-billing-suspension.sql` adds the reason and linked invoice ID to `account_profiles`. The account profile schema initializer applies these idempotent additions too. Existing suspensions without a linked invoice retain their generic message until updated from Billing.

The account invoice modal and Billing page share styled invoice cards. New email jobs use a table-based, inline-styled invoice email with a current balance, due date, bank details, payment reference and signed-in billing link. Already frozen mail payloads retain their original content for safe idempotent retries. The PDF attachment remains the immutable issued document.

`node scripts/verify-billing-experience.cjs` checks the customer cards, directly displayed suspension invoice and email at phone and desktop widths. The suspension tests exercise atomic rollback, protected accounts, stale versions/status, audit history, ownership and clearing context on restoration. No live accounts are suspended and no test emails are sent by these fixtures.


## Invoice list, notifications and permanent deletion

The account invoice modal opens every invoice expanded, with individual toggles, Expand all / Collapse all, and a styled scrollbar on the right. Pages remain limited to 50 invoices; pagination reaches older invoices.

Issued invoices now feed the existing account notification bell with a stable invoice event ID and a link to Billing. This covers manual, signup and recurring invoices, including previously issued invoices. Drafts and voids do not create current invoice alerts. Read/archive state follows the existing inbox rules. Billing alerts are private to the account holder, not delegated Owner App users. This change adds inbox notifications; it does not add a new phone push category.

**Hard delete** is available in Admin invoice actions for draft, issued, paid and void invoices. Admin must provide a reason, type the exact invoice number (or DELETE for a draft), and tick an irreversible-deletion confirmation. Server checks reject stale invoice versions and invoices with an email currently sending. One transaction deletes the invoice/PDF, payment records, work reservations, email queue/payloads and invoice history; linked suspension context and notification snapshots are removed too. Account access remains unchanged. Deletion does not refund payments or recall delivered emails.

A minimal deletion receipt retains only the invoice ID/number, generation key, actor, reason and timestamp. Numbers are not reused. Signup and recurring generation respect these receipts so a deleted period does not regenerate. Migration 117 creates the receipt table; the billing schema initializer also applies it. Synthetic tests verify rollback, paid-invoice deletion, stale versions, sending-mail protection, invoice ownership in notifications, and signup/recurring replay prevention.
