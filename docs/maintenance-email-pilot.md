# Owner maintenance email pilot

Scope: only the account whose email is `kallageldenhuys@gmail.com`. Other users' maintenance is never redirected to this address.

## Activation

Deploy this change with these service variables:

- `MAINTENANCE_REMINDER_TEST_MODE=true`
- `MAINTENANCE_REMINDER_TEST_SINCE=<ISO timestamp at pilot setup>`
- Keep `MAINTENANCE_REMINDER_ENABLED=false` (the broad batch rollout stays disabled).

The Node instrumentation worker checks once every 60 seconds, independent of browser activity. Invalid or missing cutoff disables the pilot. Only maintenance created or updated since the cutoff is considered. Existing untouched records are excluded. Railway must keep the application running for background polling.

## Behaviour to test

1. Create upcoming maintenance inside its reminder threshold, or already due. Expect one email on the next poll, plus email-provider delivery time.
2. Create another eligible record: it gets its own email. In this pilot, there is no daily digest or 07:00 wait.
3. Re-save the same record without changing its stage: no duplicate. One delivery is allowed per record for due-soon and another for due/overdue. Due and overdue share a delivery key. Weekly repeat notifications are not enabled in this pilot.
4. Complete or cancel a record before the next poll: no email. Removed, inactive or transferred-away assets are excluded. A recurring occurrence gets its own record and delivery keys.
5. Follow **Stop reminders for this asset** and confirm. All maintenance emails for that asset stop; other assets remain eligible.
6. Follow **Stop all maintenance emails for this account** and confirm. All maintenance emails for the account stop. Asset opt-in cannot override account opt-out.
7. Revisit either preference link to turn emails back on. Already-delivered stages are not resent; use a new eligible record to test delivery again.

Preferences do not alter schedules or other email categories. GET requests only display confirmation: email scanners cannot unsubscribe users simply by visiting a link. Random 256-bit tokens authorize only the preference represented by that link. The page has no third-party assets or analytics and uses no-referrer and no-store headers.

The message uses the reset-email brand header, font stack, colours and button treatment. It includes asset, work, due point, recorded usage, repeat interval, optional assignment/scheduler/serial, direct maintenance link and both preference links. It uses saved usage, not estimated usage.

## Operations

Set `MAINTENANCE_REMINDER_TEST_MODE=false` and redeploy to stop polling. Do not enable the broad rollout as part of this test. Successful deliveries are recorded in `maintenance_reminder_deliveries`; provider failures are retried after 15 minutes, at most 10 attempts within 23 hours, with the same provider idempotency key. Logs contain aggregate sent/failed counts and do not include preference tokens.

## Validation

Run `node --test tests/owner-maintenance-email.test.mjs tests/maintenance-reminders.test.cjs tests/maintenance-email-pilot.test.cjs tests/maintenance-reminder-runtime.test.cjs` using the repository dependencies and Node with TypeScript stripping support.
