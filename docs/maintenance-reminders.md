# Maintenance reminders and value review

Maintenance scheduling remains immediate when the sender has enabled the scheduling permission. No scheduling-approval email is sent.

## Production email delivery

Railway runs the server-owned asset email worker from `lib/maintenance-reminder-runtime.ts`. The former hourly GitHub Actions maintenance delivery workflow has been removed: do not restore it or configure a second scheduler. No GitHub Actions reminder secret is needed for the server worker.

See [Asset email rollout](asset-email-rollout.md) for the current configuration, eligibility, cutoff, retry and monitoring rules. Maintenance reminders send once per schedule occurrence and eligible recipient, not again as the same service moves from almost due to overdue. Owners and authorized tracking recipients are evaluated independently, including their own email preferences. Usage reminders use recorded hours/km, never estimated usage.

Use `/admin/asset-emails` to inspect worker health and unfinished deliveries. Provider acceptance does not prove inbox delivery. Do not reset uncertain attempts outside the provider idempotency window. Removing assets, completing/cancelling work or revoking access suppresses ineligible sends; email links check current authorization again.

## Value review

Value email and notification links identify the exact suggestion. The owner signs in and approves/declines using the existing value dialog. Addressed links show the saved decision, person and date. Database decision locking remains authoritative if another tab acted first. Manual-value permissions are unchanged.

## Manual checks

- Schedule a near-due service after the rollout cutoff; verify eligible owner and tracking recipient emails, links, asset identity and scheduler attribution.
- Let the server check again: the same occurrence must not send twice.
- Complete the service using the normal flow; old reminder links must show its current status.
- Verify cancellation, asset removal, revoked tracking access and independent opt-outs suppress the relevant sends.
- Suggest an Aim4price current value, approve in one tab, then revisit in another: Already approved, without another decision.

Tests mock the database/provider; live inbox rendering must be checked separately. To pause all asset emails, set both `MAINTENANCE_REMINDER_ENABLED=false` and `MAINTENANCE_REMINDER_TEST_MODE=false`. Preserve the rollout cutoff and delivery history when resuming.
