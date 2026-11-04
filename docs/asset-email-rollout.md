# Asset email delivery

Production delivery supports all eligible accounts. Pilot mode remains available as a restricted test switch.

## Rules

- A maintenance occurrence sends once per recipient when the existing schedule computation first reports due soon, due or overdue. No new message for edits or stage changes. A new recurring record can send once again.
- Existing pilot delivery attempts conservatively count as already notified, including ambiguous failed attempts, to avoid duplicate emails during migration.
- Owner and active dealer/business tracking accounts qualify. Reminder access requires schedule or maintenance-report permission; problem events require logged-problem permission; completion events require maintenance-report permission. Having a public share link alone never subscribes someone.
- Problem creation, resolution and maintenance completion are detected from committed canonical history transitions, not ordinary edits. The main owner mailbox receives problem reports and resolutions even when the owner or an owner-linked app recorded the action, subject to opt-outs and rollout restrictions. Other recipients are excluded when they are the authenticated actor. Maintenance-completion self-emails remain excluded. Owner scan/resolution and dealer completion paths now record that actor; anonymous field/scan actions cannot be mapped to a recipient account and notify the owner and tracking parties.
- Problem emails include the note, reporter/time, first attached photo when available, and a signed-in problem page. Current permissions are checked on opening. Completion links open the existing maintenance detail page.
- Maintenance and problem preferences are per recipient, per category, per asset or account. “All asset updates” for an asset blocks both categories. Existing maintenance opt-outs and tokens remain valid. GET does not change preferences; POST requires explicit same-origin confirmation. Opt-outs do not change saved work.
- Active asset, recipient identity, permissions, category preferences and current record status are checked again immediately before delivery.
- Atomic database claims deduplicate simultaneous polls. Persisted email payloads are reused for retries with the same provider key. Retry cooldown is 15 minutes, at most ten attempts, and retries stop after 23 hours to avoid provider key expiry duplicates. Unresolved attempts retain an error for operator review rather than silently resending later.

## Pilot and launch

The one-minute pilot uses MAINTENANCE_REMINDER_TEST_MODE=true and a valid MAINTENANCE_REMINDER_TEST_SINCE. All final recipient addresses must exactly match the pilot mailbox; other users' messages are never redirected there. The pilot keeps its pagination cursor between ticks.

Broad rollout requires MAINTENANCE_REMINDER_ENABLED=true, test mode off and an explicit MAINTENANCE_REMINDER_ROLLOUT_SINCE timestamp. Missing or invalid timestamps fail closed. MAINTENANCE_REMINDER_OWNER_IDS can restrict owner accounts. No broad rollout is enabled by this code.

Upcoming records must be newly created or updated since that cutoff. Activity events start no earlier than the persisted first initialization of activity-v1 and the configured cutoff; no historical backfill. Unattempted activity remains eligible after outages; events are checked in rotating batches of 200. Already-attempted deliveries keep the 23-hour retry safety limit. The production server runs the sender every minute without a logged-in user. Problem and completion events run all day; maintenance reminders run from 07:00 SAST. Owner pagination continues between ticks. No external cron is required on the always-running Railway service.

The main owner should receive a problem email when logging or resolving their own problem, including through an owner-linked app. To test the pilot notification, report a new problem on an asset owned by the pilot mailbox; confirm one email arrives and repeated polls do not resend it. Verify problem and completion links, opt-outs, revoked sharing, recurring occurrences and that due/overdue transitions do not resend before enabling other recipients.

Weekly summaries are intentionally deferred.


## Operations

The admin-only /admin/asset-emails page shows worker heartbeat, provider-accepted totals, unfinished deliveries and event-processing errors. A heartbeat older than five minutes needs attention. Provider acceptance is not proof of inbox delivery. Exhausted attempts require checking the provider record before any manual resend; the page deliberately does not bypass duplicate protection.

Launch: deploy this revision first, then set MAINTENANCE_REMINDER_TEST_MODE=false, MAINTENANCE_REMINDER_ENABLED=true, MAINTENANCE_REMINDER_ROLLOUT_SINCE to the explicit launch timestamp, and MAINTENANCE_REMINDER_OWNER_IDS to empty. Verify Railway SUCCESS and production worker logs. Roll back sending by setting both enabled and test mode false. Keep the cutoff unchanged across redeploys. Existing schedules predating the cutoff become eligible only after being updated; no blanket historical email backfill.
