# Accountant Workspace deployment

## Database

Run `database/migrations/65-accountant-workspace-and-asset-lifecycle.sql` after the existing Aim4price migrations. It is additive and safe to run more than once.

The migration adds:

- revocable live-access and owner permission flags to existing Finance leads;
- active/disposed lifecycle state and retained acquisition/disposal events;
- a simple accountant-supplied carrying-value reference;
- accountant-uploaded document attribution.

No accounting depreciation engine, journals, SARS schedule or general-ledger tables are introduced.

## Application

Deploy the changed files together, then restart the Next.js service. Accountant pages activate only when the existing account profile has `account_type = 'finance'` and `account_subtype = 'accountant'`. Financier and bank accounts remain on the existing Finance lead flow.

## Verification

Run:

```sh
npm ci
npm run typecheck
npm run test:accountant-workspace
npm run build
```

Use an owner and accountant test account to verify a full-register Finance share in both read-only and **Allow direct updates** modes. Confirm that removing access never changes owner data, and that a disposed asset remains in the Additions & Disposals report while leaving active totals.
