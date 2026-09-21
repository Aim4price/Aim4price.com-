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

- Choose an account, create a draft, enter billing details and an explicit payment due date. Add manual lines or selected completed Work Tracker sessions at an agreed hourly rate.
- Saving reserves selected work so it cannot appear on two invoices. Drafts can be edited or deleted. Changing a reserved work charge requires deleting and recreating the draft.
- Preview, then **Issue & email**. This assigns a unique invoice number, freezes issuer/customer/charge details and the canonical HTML, and queues the PDF email in the same transaction. Repeating the issue request does not create another invoice/email.
- Record only verified receipts. Partial payments are supported. Repeating the same payment request is safe; amounts above the outstanding balance are rejected. Payment entries are audited and do not activate account access.
- Unpaid issued invoices can be voided with a reason. Voiding retains history, releases work reservations and prevents queued sending. Already-sent messages cannot be withdrawn; contact the customer about the correction. Paid invoices cannot be voided. Payment reversal, credit notes and refunds are not implemented in v1.

Monthly/annual plans store a next billing **review** date. There is no automatic renewal charge, pro-rata adjustment, automatic debit, payment gateway, reminder schedule or suspension rule in this version. Renewal invoices are prepared manually. Schedule changes for existing subscriptions need a later dedicated workflow.

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
