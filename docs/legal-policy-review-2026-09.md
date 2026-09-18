# September 2026 legal and privacy refresh

Status: **draft for owner and South African legal review; do not publish as a compliance certification.**

## What this change does

The existing legal-page layout and routes remain. The pages now describe the individual operator, no VAT on Aim4price's own fees, the broader asset lifecycle, assisted document capture, partner permissions, public sharing, first-party activity history, offline copies, retention, incidents and controlled use of data for improvement. Signup links now open both documents without losing form progress, and distinguish agreement to terms from acknowledgment of a privacy notice. Admins are no longer redirected away from these legal pages.

The identity is taken from the existing Contact Us page: **Kuyler Chris Geldenhuys**, `aim4price@gmail.com`, `+27 62 572 1650`. The owner explicitly confirmed that there is no registered company and no VAT registration. Confirm the individual is the actual contracting operator before publication. No registration number, physical address, Information Officer registration, provider contract or security certification has been invented.

No proposed R99/R199/R399 prices, 40/60 entitlement, active-asset limits, grace periods or retainer expiry rules have been made live through these pages. Those still require an accepted commercial offer and implementation. VAT displays for customer assets and third-party invoices remain separate from the operator's own fees.

## Data improvement boundary

- Necessary, proportionate, lawful identifiable review for service administration, troubleshooting and compatible improvement remains disclosed.
- Reusable benchmarks and model development should use genuinely de-identified or aggregated information. Simply removing an account ID is insufficient: serial numbers, location, rare assets, free text and small cohorts can identify people or businesses.
- No ownership grab over uploaded records; no licence for selling private documents or sending them to a third party for its own general-purpose AI training.
- Existing data is not retrospectively cleared for a new use by publishing this notice. Record the lawful basis, purpose compatibility, impact assessment and any separate consent before a new use starts.
- This PR creates no analytics export, training pipeline or third-party AI integration, and makes no assertion that stored operational records are already anonymised.

## Release blockers and operational decisions

1. **Operator address:** obtain the physical/business address and address for legal service appropriate to this individual operator. Add the confirmed information to the operator section in both policies, and the order/contract disclosures where applicable. The repository's Contact Us page has a name, email and phone but no physical address. An email-only contact is not a substitute for the responsible-party address disclosure. Do not infer an address from asset records or unrelated customer documents.
2. **Information Officer and PAIA:** confirm the responsible Information Officer, registration and appropriate PAIA manual/access process. Being unincorporated does not itself remove privacy obligations. Do not publish a claim that registration or the manual exists until verified.
3. **Provider and transfer register:** verify the actual production database, object-storage and backup locations, email/push providers, onward transfers, support access and written processing/security terms. Document the transfer ground and safeguards; publish relevant destination information. The repository cannot prove the live region, backup cycle, encryption configuration or contract status.
4. **Retention schedule and cleanup:** assign and document justified periods for live records, inactive accounts, capture submissions, usage/estimate events, view history, retainer work/billing records, security records and backups. Confirm the purge workers are actually scheduled and monitored. `docs/railway-bucket-rollout.md` describes a minimum 30-day recovery delay and explicitly says scheduling is not automatic. Do not advertise a universal 30-day deletion guarantee.
5. **Notice and acceptance evidence:** the current signup checkbox is a client-side gate. This PR improves its wording and links, but does not add server-side versioned acceptance or backfill historical consent. Implement server-side recording of the terms version, privacy notice version, acceptance time, actor and authority across signup/invitations before relying on that evidence. Existing customers need appropriate notice of material changes; extra processing that requires consent needs a separate choice. Public Invoice Drop already has a server-checked submission acknowledgement; that does not establish consent for unrelated marketing or training.
6. **Privacy-request and incident operations:** assign a monitored contact, proportionate identity checks, a response log, applicable response deadlines, deletion/backup reconciliation and an incident escalation/notification process. Exercise the workflow with a test account and restore test. Do not treat a policy paragraph as proof of implementation.
7. **Analytics governance:** document necessity, notice, lawful basis, retention, access restriction and handling of objections for first-party account and guest tracking. Do not label persistent guest hashes as anonymous. Any consent-dependent tracking needs an actual consent gate, not merely this notice.
8. **Legal and commercial review:** have a South African practitioner check identity/address disclosures, consumer applicability, online-order disclosures, cancellation/cooling-off rights, any prepaid-hour expiry and specific partner agreements against the actual offer. The draft preserves mandatory rights and does not use an arbitrary liability cap or blanket no-refund clause. Update the policy date on release if publication is delayed materially.

## Code findings and boundaries

| Evidence | Finding / action |
| --- | --- |
| `lib/admin-usage-events.ts`, `lib/admin-valuation-events.ts` | Account-linked event metadata can contain complete estimate inputs and results, including free text. The policy discloses identifiable administrator review; it does not call this data anonymous. |
| `lib/marketplace-views.ts`, `lib/discovery-views.ts`, migrations 93/94 | Views retain account identifiers; administration can resolve viewer profile/email. Marketplace guests use a browser identifier hash. |
| `lib/account-deletion.ts` | This PR adds transactional deletion of account-linked usage events and Marketplace/Discovery view rows as viewer or owner/seller. These text identifiers have no auth-user cascade. Whole usage events are removed, rather than leaving potentially identifying JSON behind. No production records are changed by preparing this PR. |
| `tests/account-deletion-analytics.test.mjs` | Executes the actual deletion entry point against PGlite to check target removal, unrelated/guest preservation, older schemas, retries and rollback. |
| `database/migrations/83-admin-work-tracker.sql` | Work-session snapshots contain customer name/email and notes; decide lawful billing retention and deletion/restriction handling. Not silently deleted as part of this policy task. |
| `lib/account-deletion.ts`, `lib/auth.ts` | Not a full deletion audit. Review historical deleted users, identifiers in other users' metadata, guest events, external providers and backups. The new hook does not retroactively clean previously deleted accounts. |
| `lib/upload-object-storage.ts`, `lib/capture-quarantine-storage.ts` | Database and private object-storage paths coexist; signed URLs and cleanup queues exist. Configuration and worker execution must be checked operationally. |
| `ASSISTED-CAPTURE-ROLLOUT.md`, `app/my-invoices/my-invoices-client.tsx` | Staff-reviewed capture and 24-hour messaging are already present. Terms do not silently redefine 24 hours as business hours or erase that service promise. |
| `docs/field-manager-offline.md` | Encrypted local Field Manager copy and unsynchronised work; access revocation cannot recall a disconnected copy. Other exported files do not inherit the vault protection. |
| `lib/external-file-share.ts`, `lib/asset-external-share.ts` | External file sharing may deliver a copy, not just a revocable link. |
| `app/drop-invoice/invoice-drop-client.tsx`, `app/api/public/invoice-drop/route.ts` | Public contributors must confirm authority to submit to Aim4price for the owner. Preserve this narrow purpose. |

## Sources consulted, 18 September 2026

- [POPIA consolidated text hosted by the Department of Justice](https://www.justice.gov.za/legislation/acts/2013-004.pdf): sections 11, 14-15, 18-24, 26-35, 55, 69-72. Check the official current law and regulations during legal sign-off.
- [Information Regulator: POPIA guidance, Information Officers, forms and direct marketing resources](https://inforegulator.org.za/popia/).
- [Information Regulator: complaints](https://inforegulator.org.za/complaints/).
- [Department of Trade, Industry and Competition: Consumer Protection Act guide](https://www.thedtic.gov.za/wp-content/uploads/Consumer_Protection_Act.pdf), including fixed-term cancellation and fair contract terms. This is a guide, not a substitute for the Act.
- [SARS: Value-Added Tax](https://www.sars.gov.za/types-of-tax/value-added-tax/). No claim about a registration threshold is needed for these pages; the no-VAT status comes from the owner's instruction.

Attempts to retrieve the full ECTA text through the public web source were unsuccessful. Online-order disclosures and any ECTA-specific cooling-off exceptions therefore remain an explicit legal verification item; the draft does not invent a cooling-off period or exception.

## Validation completed

- `npm run typecheck` passed.
- 20 targeted tests passed: new transactional analytics deletion tests, existing insurance deletion, capture cleanup and signup flow tests.
- Both legal article components were rendered locally with their shared CSS (header replaced with a preview stub). Contents anchors were checked for missing/duplicate targets; desktop screenshots were inspected. This is not a signed-in production/browser audit.
- The longer contents list is scrollable within the viewport, preserving access to its final links on shorter screens.
- `git diff --check` passed. No live database, storage, billing or customer account was modified.
