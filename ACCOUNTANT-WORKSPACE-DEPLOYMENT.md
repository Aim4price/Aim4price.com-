# Accountant Workspace deployment

## Database

Run these migrations in order after the existing Aim4price migrations. Both are additive and safe to run more than once:

1. `database/migrations/65-accountant-workspace-and-asset-lifecycle.sql`
2. `database/migrations/66-accounting-collaboration-foundation.sql`

The migration adds:

- revocable live-access and owner permission flags to existing Finance leads;
- active/disposed lifecycle state and retained acquisition/disposal events;
- dated accountant-supplied Accounting Book Value snapshots;
- client-level Finance Agreements, agreement snapshots and explicit asset-link roles;
- recurring commitments kept separately from incurred Cost Ledger expenses;
- review-item foundations for missing, stale and inconsistent financial information;
- accountant-uploaded document attribution.

No accounting depreciation engine, journals, SARS schedule or general-ledger tables are introduced.

## Application

Deploy the changed files together, then restart the Next.js service. Accountant pages activate only when the existing account profile has `account_type = 'finance'` and `account_subtype = 'accountant'`. Financier and bank accounts remain on the existing Finance lead flow.

The accountant's own Aim4price account keeps the standard partner experience:

- **Home**, **Get Estimate** and **My Leads** use the existing shared Aim4price pages;
- **Manage → Account** opens the existing Account page, including editable account/business details and the Partner Directory;
- header notifications remain available.

A restricted workspace begins only when the accountant opens a shared full-register lead from **My Leads**. In that workspace:

- the existing owner-facing Asset Register, Fuel Ledger and Cost Ledger components and styles are reused;
- the header contains only **Asset Register**, **Fuel Ledger** and **Cost Ledger**;
- notifications are hidden;
- **Manage** opens a leave confirmation and returns the accountant to **My Leads** without signing out;
- Fuel and Cost Ledgers reuse the Owner layouts, controls and PDF/XLSX exports, with accountant changes scoped to the shared register;
- asset finance/accounting updates, lifecycle actions and document uploads in the accountant Manage modal still require the owner's **Allow direct updates** permission;
- **Dispose asset** keeps genuine disposal history, while **Delete incorrect asset** archives only mistake/import/test records that have no linked financial records or files;
- Finance Agreement amounts remain exactly as supplied by the financier and are not automatically VAT-converted or allocated across linked assets;
- recurring commitments are future commitments only; each actual invoice or payment must still be recorded separately as an incurred cost.

## Verification

Run:

```sh
npm ci
npm run typecheck
npm run test:accountant-workspace
npm run build
```

Use an owner and accountant test account to verify a full-register Finance share in both asset Manage read-only and **Allow direct updates** modes. Confirm that Fuel and Cost Ledger entries remain scoped to the shared register, removing access never changes owner data, and a disposed asset remains in retained lifecycle history while leaving active totals. Also verify multi-asset Finance Agreement links, dated Accounting Book Value snapshots, recurring commitments, and dependency-blocked incorrect-record deletion.

Also confirm the accountant's normal Home, Get Estimate, My Leads, Account, Partner Directory and notifications outside the shared workspace, then open the lead and verify the three-tab header and leave-to-My-Leads modal.
