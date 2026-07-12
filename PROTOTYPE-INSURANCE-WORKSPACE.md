# Insurance Workspace Prototype

This prototype introduces a broker and underwriter workflow without changing the owner's asset records.

## What is included

- `Shared Registers` navigation for insurance accounts.
- A list of full-register insurance shares already received through `My Leads`.
- A read-only register workspace with Overview, Review assets and Report tabs.
- Separate basic asset groups and policy-section classifications.
- Suggested classifications that require a broker decision before being used.
- Bulk policy-section assignment.
- Include, exclude, information-required and needs-review decisions.
- Shared or private broker notes.
- Proposed schedule item and sum-insured fields.
- Non-asset covers such as Business Interruption and Liability.
- Policy-section totals and a printable underwriting preview.
- A browser-persisted prototype snapshot that never overwrites owner data.
- A demonstration register when the insurance account has no real shared registers yet.
- Four-state insurance reporting: Yes, No, Not sure and Not applicable are no longer collapsed into a boolean in full-register lead reports.

## How to test

1. Sign in with an account whose account type is `insurance`.
2. Open `Shared Registers` in the main navigation.
3. If no full register has been shared with that account, choose `Open prototype`.
4. Review individual assets or select several assets and apply a policy section in bulk.
5. Add a note or information request.
6. Open `Report` to inspect the policy-section summary and print preview.

## Prototype limitations

- Broker classifications are stored in browser local storage for this first prototype.
- Existing full-register shares are once-off snapshots, not live owner-register access.
- `Freeze snapshot` records a local prototype timestamp; it does not yet create an immutable database version.
- Policy records, schedule items, access grants, audit events and collaborative notes still need dedicated database tables and APIs for the production version.
- Suggested classifications are simple rules intended to demonstrate the review flow, not insurance advice.

## Recommended production follow-up

The next version should persist an organisation-scoped insurance review, its asset classifications and its audit trail. It should then add permissioned live register access with immutable submission snapshots for underwriting.
