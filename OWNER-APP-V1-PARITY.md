# Aim4price Owner v1 parity checklist

## Existing patterns reused

- Dealer App: secure salted-password users, session-version revocation, isolated signed cookie, account-managed usernames, install choice, standalone detection, PWA manifest/service worker, compact valuation, and compact marketplace.
- Field Manager: white mobile layout, touch navigation, loading/error/retry states, 7/30-day overview, attention sections, open-asset actions, and persistent dismissals.
- Owner-specific: active-owner authorization, all registers in one asset search, full owner asset editing, existing owner notifications, owner marketplace permissions, and owner-scoped access checks on every read and mutation.

## Single-asset parity matrix

| Desktop owner capability | Owner App v1 |
| --- | --- |
| Create, view, move and delete asset | Included |
| Name, kind, make, model, year, serial/VIN/chassis, internal reference | Included |
| Hours, kilometres, percentage worked, condition and notes | Included |
| Aim4price value and replacement price | Included |
| Finance status and detailed finance fields | Included |
| Insurance status, value, insurer, policy, renewal and notes | Included |
| Licence status, registration, renewal and notes | Included |
| Manual location, coordinates, last scan and asset flag | Included |
| Photos and documents: upload, view and remove | Included |
| Marketplace: publish, edit and remove | Included |
| Maintenance: view, add, complete, cancel and reopen | Included |
| Recorded costs: view, add and delete | Included |

The mobile editor calls the existing asset, upload, marketplace, maintenance, cost, valuation, notification and register business logic. It does not introduce a second asset model.
