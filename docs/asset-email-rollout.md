# Asset email delivery

The production pilot remains restricted to kallageldenhuys@gmail.com. No environment variables or recipient rollout are changed by this PR.

## Rules

- A maintenance occurrence sends once per recipient when the existing schedule computation first reports due soon, due or overdue. No new message for edits or stage changes. A new recurring record can send once again.
- Existing pilot delivery attempts conservatively count as already notified, including ambiguous failed attempts, to avoid duplicate emails during migration.
- Owner and active dealer/business tracking accounts qualify. Reminder access requires schedule or maintenance-report permission; problem events require logged-problem permission; completion events require maintenance-report permission. Having a public share link alone never subscribes someone.
- Problem creation, resolution and maintenance completion are detected from committed canonical history transitions, not ordinary edits. The actor is excluded where an authenticated actor is recorded. Owner scan/resolution and dealer completion paths now record that actor; anonymous field/scan actions cannot be mapped to a recipient account and notify the owner and tracking parties.
- Problem emails include the note, reporter/time, first attached photo when available, and a signed-in problem page. Current permissions are checked on opening. Completion links open the existing maintenance detail page.
- Maintenance and problem preferences are per recipient, per category, per asset or account. “All asset updates” for an asset blocks both categories. Existing maintenance opt-outs and tokens remain valid. GET does not change preferences; POST requires explicit same-origin confirmation. Opt-outs do not change saved work.
- Active asset, recipient identity, permissions, category preferences and current record status are checked again immediately before delivery.
- Atomic database claims deduplicate simultaneous polls. Persisted email payloads are reused for retries with the same provider key. Retry cooldown is 15 minutes, at most ten attempts, and retries stop after 23 hours to avoid provider key expiry duplicates. Unresolved attempts retain an error for operator review rather than silently resending later.

## Pilot and launch

The one-minute pilot uses MAINTENANCE_REMINDER_TEST_MODE=true and a valid MAINTENANCE_REMINDER_TEST_SINCE. All final recipient addresses must exactly match the pilot mailbox; other users' messages are never redirected there. The pilot keeps its pagination cursor between ticks.

Broad rollout requires MAINTENANCE_REMINDER_ENABLED=true, test mode off and an explicit MAINTENANCE_REMINDER_ROLLOUT_SINCE timestamp. Missing or invalid timestamps fail closed. MAINTENANCE_REMINDER_OWNER_IDS can restrict owner accounts. No broad rollout is enabled by this code.

Upcoming records must be newly created or updated since that cutoff. Activity events start no earlier than the persisted first initialization of activity-v1 and the configured cutoff; no historical backfill. New activity is processed for 23 hours. Production cron should call the existing batch endpoint and follow its next cursor; the rapid timer remains pilot-only.

A user who logs/resolves their own problem should not expect a self-email. To test the pilot notification, use another authorized actor on an asset whose owner is the pilot mailbox. Verify problem and completion links, opt-outs, revoked sharing, recurring occurrences and that due/overdue transitions do not resend before enabling other recipients.

Weekly summaries are intentionally deferred.
