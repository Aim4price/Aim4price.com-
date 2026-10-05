# Maintenance reminders and value review

Maintenance scheduling remains immediate when the sender has enabled the scheduling permission. No scheduling-approval email is sent.

## Enable delivery

1. Deploy this branch. Tables are created through the existing lazy schema pattern.
2. Set a strong random `MAINTENANCE_REMINDER_SECRET` on the application server and the identical GitHub Actions repository secret.
3. Confirm the server's existing `RESEND_API_KEY`, `AIM4PRICE_EMAIL_FROM`, and site-origin settings. Optionally set repository variable `AIM4PRICE_SITE_URL` (default https://www.aim4price.com).
4. Run **Maintenance reminder delivery** manually once, then let the hourly schedule run. No production email is sent by local tests.

Each upcoming schedule gets one almost-due and one due email per recipient. Overdue belongs to the due stage; polling does not send repeated daily emails. The owner and the original scheduler receive separate emails unless they are the same account. Hours/km thresholds use recorded usage, not estimated usage. Existing date/usage alert-before settings determine the almost-due stage.

The scheduler identity/source is saved transactionally for newly created external schedules. Recurring schedules inherit that identity. Older schedules whose creator was never recorded still notify the owner; they do not guess a dealer recipient. Completion/cancellation stops reminders. Revoked or no-longer-permitted recipients are excluded; links check current authorization again. Existing schedules are evaluated on first activation, so already-due schedules can generate a first reminder.

Delivery attempts use persistent per-record/recipient/stage keys and Resend idempotency. Failed attempts retry after 15 minutes, up to 10 attempts and within 23 hours of the first attempt. After that, inspect `maintenance_reminder_deliveries.error` and the workflow failure; do not blindly reset an uncertain delivery outside the provider's idempotency window. `sent_at` means provider acceptance, not proven inbox delivery. Sharing usage records email attempts/acceptances/failures.

Value email and notification links identify the exact suggestion. The owner signs in and approves/declines using the existing value dialog. Addressed links show the saved decision, person and date. Database decision locking remains authoritative if another tab acted first. Manual-value permissions are unchanged.

## Manual check

- Schedule a near-due service from a dealer lead or signed-in shared link; verify it appears immediately in the owner's maintenance.
- Run the job; check owner and scheduler email, their notification links, asset identity and scheduler attribution. Repeat the job: no duplicate email.
- Open a reminder as the scheduler, use Complete service, and save the normal service form. Open both old links: Already completed.
- Test cancellation and revoked share access. Neither should offer completion or send a later reminder to the revoked recipient.
- Suggest an Aim4price current value, open notification/email links in two tabs, approve in one, then revisit the other: Already approved, without another decision.
