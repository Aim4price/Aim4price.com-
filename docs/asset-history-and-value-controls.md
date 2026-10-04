# Asset history and value controls

## Behaviour

- Owner, Leads and shared-link history use the same dialog, with category filtering and stable pagination.
- Asset details, values, cost records, fuel slips/storage movements, budgets, maintenance, problems, photos and document links are audited at the database write. Rolled-back writes leave no audit entry. Deleting an underlying record retains its audit.
- Existing shared activity remains available. Previously unrecorded changes cannot be reconstructed. New audit capture begins when migration 131 (or the runtime schema initializer) installs the triggers.
- Recipients see only history permitted by the current sharing grants. Financial contributions are restricted to their own recorded writes. They cannot restore owner history.
- Owners can restore prior title, brand, model, year, condition and notes, with confirmation and a check for newer changes. The canonical detail writer preserves valuation-staleness rules. Restoration records a new event and its source history ID.
- Financial records use their existing management screens: edit/remove costs, void fuel slips, and edit budgets. History links open the matching cost/slip/budget when it still exists. Documents and maintenance link back to the asset. This avoids bypassing totals, stock balances, completion and recurrence rules.
- Deleted files cannot be recreated from an audit entry; the audit retains metadata. Earlier write paths without a supplied actor identity display “Not recorded” and “Account or system”, rather than inventing a person. Shared contributions, value decisions and restorations record the authenticated actor explicitly.

## Value rules

| Action | Manual asset | Aim4price-valued asset |
| --- | --- | --- |
| Permitted recipient changes current value | Confirmed immediate update, logged once | Suggestion; no live change until owner approval |
| Permitted recipient changes replacement price | Confirmed immediate update; current value stays unchanged | Suggestion; owner chooses keep/recalculate current value |
| Owner current-value override | Updates manual value | Sets an approved starting value on the existing depreciation curve |
| Restore previous current value | Confirm restoration from value history | Return to a preview of today's Aim4price calculation |
| Restore replacement price | Review old price, then confirm | Review old price and its effect on current value, then confirm |

Neither a suggestion nor a notification changes the live valuation. Approving an Aim4price starting value preserves automatic depreciation. Returning to Aim4price removes the approved anchor, not the audit trail or the saved replacement price.

Current and replacement suggestions notify the owner through Resend after saving. A mail failure does not undo or hide the suggestion. Review screens expose failed delivery and a retry button; claims are throttled for 15 minutes and reuse the provider idempotency key. Review always requires sign-in and owner/admin permissions. Admin pending counts include both kinds of suggestion.

## Manual acceptance checks

Use a test owner, a permitted business/dealer and a shared link. Use test assets and a test email inbox.

1. On a manual asset, enable current-value and replacement-price access. Through Leads and the link, change each value. Confirm that current value changes immediately only when chosen, replacement-price edits keep current value, and the owner sees the same live data.
2. Repeat on an Aim4price-valued asset. Confirm both suggestions leave live values unchanged. Open the owner email, review the contributor and reason, then approve or decline. For replacement price, preview both the keep and recalculate options.
3. Override current value, then preview Return to Aim4price. Confirm only after checking the new amount. Revalue again and check that depreciation follows the appropriate baseline without repeating past depreciation.
4. On a manual asset, open value History and restore a previous value. Review a previous replacement price separately. Verify both actions add history.
5. Change title/year/condition and restore the details from History. Make a later conflicting edit in another tab; restoring the older entry must then be rejected.
6. Add/edit/remove a cost, save/void a fuel slip, edit a budget, complete maintenance, log/resolve a problem, and add/remove a photo/document. Check categories and before/after information. Use Open record to make corrections and confirm costs, fuel balances and budgets reflect the canonical records.
7. Revoke a link or remove an individual grant while a form is open. Saving must fail. Check that recipient history does not expose withheld paperwork, location, other contributors' costs, or owner-only restore controls.
8. Retry a successful manual-value save. It must not duplicate the change or usage charge. Simulate email delivery failure: the suggestion must remain reviewable, and retry must not change its value/status.

## Deployment and verification

Migrations 131 and 132 add the audit triggers and replacement-notification delivery records. Equivalent runtime initialization supports the repository's existing lazy-schema pattern. Apply migrations before enabling production traffic when using managed migrations.

Automated coverage includes PGlite transactions, rollback, append-only records, owner isolation, recipient field redaction, pagination ties, canonical restoration, manual/approved value rules, replacement confirmation, email claims, and browser interactions for manual edits, approval, previews and restoration. The business-network workflow includes the new history suite.
