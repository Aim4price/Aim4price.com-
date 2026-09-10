# Phone notifications — first version

Owner, Dealer and Middleman installed web apps have Account → Notifications. The main website Account links to the corresponding app; it never borrows the website login. Each app login has independent category preferences and each phone has its own on/off registration. The normal inbox is not muted by turning off phone alerts.

## Delivery

Uses standards-based Web Push (web-push), the current database and the existing long-running Next.js server. No external notification subscription, Firebase account, scheduled service or per-message provider fee is needed. Normal hosting resources still apply.

The Next.js Node instrumentation hook checks enabled devices every minute in production. A PostgreSQL advisory lock prevents overlapping instances from sending the same batch. Twenty devices are checked per tick, oldest first, up to three alerts per device per tick. This intentionally modest first-version throughput is not an immediate-delivery SLA. Date and usage status are calculated from existing application data. Usage must have been recorded. Set AIM4PRICE_PUSH_DISABLED=1 to stop the sender.

Database tables and a stable VAPID key pair are created automatically using the project's existing schema-readiness approach. Private keys stay server-side in app_push_keys. Back up this table with the database; replacing the key requires re-enabling notifications on devices. The application database role needs CREATE TABLE permission for the first start. No keys or push endpoints should be logged.

Current categories: maintenance, license renewals, enquiries and leads, approvals, assigned work. Only categories accessible to the app login are shown. Licence wording and timing reuse the existing one-calendar-month warning, due and overdue states (not a new 30/7-day schedule). The same status is sent once per device; completed/noted reminders stop. New transactional events before phone registration are not replayed. A transient provider failure is retried; 404/410 removes the subscription. A rare crash after provider acceptance but before recording delivery can repeat a push; the notification tag replaces the same alert on supported phones.

## Access and devices

Before every batch, recheck active account, app subtype, active staff/user, session version, role and selected assets. The service worker checks active membership and an unguessable HttpOnly device capability again before displaying private text. A limited delivery endpoint returns only flags and preferences, never inbox text. Logout removes that browser's registration; re-enabling replaces a previous account binding. Delivery can continue after the normal app session expires, for the 30-day device registration. Tapping an alert still requires the normal app login. If the device cannot reach Aim4price, private alert text is not shown; the inbox remains available after sign-in. Live user and membership revocation also stops delivery.

Only known browser push-service HTTPS hosts are accepted. Settings writes require same-origin requests. Endpoint keys are validated, test sends are limited to once every 30 seconds, and each app login may register ten devices. A device is an unguessable server UUID held in an HttpOnly cookie. The VAPID public key alone is sent to the client.

## Release checks

Run npm run test:phone-notifications, npm run test:notifications and npm run typecheck. Verify an installed iPhone (iOS 16.4+) and Android device: enable, test, close the app, trigger a new event, tap it, disable, sign out, switch accounts, revoke staff access. Confirm each app opens its own page and no old account text appears. Check database DDL and production instrumentation startup in staging before rollout.

Real-device push delivery cannot be certified by a mocked browser test. Quiet hours, routine activity alerts, native-store apps and Field Manager notifications are outside this first version.
