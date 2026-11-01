# Maintenance reminders and value review

Maintenance scheduling remains immediate when the sender has enabled the scheduling permission. No scheduling-approval email is sent.

## Enable delivery

1. Deploy this branch. Tables are created through the existing lazy schema pattern.
2. Keep `MAINTENANCE_REMINDER_ENABLED` unset while deploying (delivery defaults off). Set `MAINTENANCE_REMINDER_OWNER_IDS` on Railway to the comma-separated account IDs you want to test. Empty means all owners when enabled; never leave it empty for the first test.
3. Set a strong random `MAINTENANCE_REMINDER_SECRET` on the application server and the identical GitHub Actions repository secret.
4. Confirm the server's existing `RESEND_API_KEY`, `AIM4PRICE_EMAIL_FROM`, and site-origin settings. Optionally set repository variable `AIM4PRICE_SITE_URL` (default https://www.aim4price.com).
5. Set `MAINTENANCE_REMINDER_ENABLED=true` on Railway only after the owner filter is configured. Run **Maintenance reminder delivery** manually once, then let the hourly schedule run. No production email is sent by local tests.

Each upcoming schedule gets one almost-due and one due email per recipient. Overdue belongs to the due stage; polling does not send repeated daily emails. Only the owner receives email in this rollout. The original scheduler is shown for context but is not emailed. Existing in-app scheduler notifications and access checks remain unchanged. Hours/km thresholds use recorded usage, not estimated usage. Existing date/usage alert-before settings determine the almost-due stage.

The scheduler identity/source is saved transactionally for newly created external schedules. Recurring schedules inherit that identity. Older schedules whose creator was never recorded still notify the owner; they do not guess a dealer recipient. Completion/cancellation stops reminders. Email links check current authorization again. Existing schedules are evaluated on first activation, so already-due schedules can generate a first reminder.

Delivery attempts use persistent per-record/recipient/stage keys and Resend idempotency. Failed attempts retry after 15 minutes, up to 10 attempts and within 23 hours of the first attempt. After that, inspect `maintenance_reminder_deliveries.error` and the workflow failure; do not blindly reset an uncertain delivery outside the provider's idempotency window. `sent_at` means provider acceptance, not proven inbox delivery. Sharing usage records email attempts/acceptances/failures.

Value email and notification links identify the exact suggestion. The owner signs in and approves/declines using the existing value dialog. Addressed links show the saved decision, person and date. Database decision locking remains authoritative if another tab acted first. Manual-value permissions are unchanged.

## Manual check

- Schedule a near-due service from a dealer lead or signed-in shared link; verify it appears immediately in the owner's maintenance.
- Run the job; check the owner's email and link, asset identity and scheduler attribution. Confirm the scheduler receives no email. Repeat the job: no duplicate email.
- Open a reminder as the scheduler, use Complete service, and save the normal service form. Open both old links: Already completed.
- Test cancellation: no later owner reminder should be sent. Separately verify revoked shared access cannot open or complete work through old links.
- Suggest an Aim4price current value, open notification/email links in two tabs, approve in one, then revisit the other: Already approved, without another decision.

## Owner rollout scope

This first version keeps one email per schedule/stage; grouped summaries and weekly overdue follow-ups are not implemented yet. Hours/km are based on recorded usage, never a guessed annual usage rate. Overdue has a distinct email heading but retains the existing due-stage delivery key.

Run focused tests with Node 22.6+ (Node 24 recommended): `node --test tests/owner-maintenance-email.test.mjs`. These use a mocked database/provider; live delivery and mailbox rendering must still be checked. To pause emails, set `MAINTENANCE_REMINDER_ENABLED=false`. Re-enabling preserves existing delivery history.
