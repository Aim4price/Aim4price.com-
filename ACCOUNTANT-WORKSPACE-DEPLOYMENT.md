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
- asset finance/accounting updates and document uploads in the accountant Manage modal still require the owner's **Allow direct updates** permission.

## Verification

Run:

```sh
npm ci
npm run typecheck
npm run test:accountant-workspace
npm run build
```

Use an owner and accountant test account to verify a full-register Finance share in both asset Manage read-only and **Allow direct updates** modes. Confirm that Fuel and Cost Ledger entries remain scoped to the shared register, removing access never changes owner data, and a disposed asset remains in the Additions & Disposals report while leaving active totals.

Also confirm the accountant's normal Home, Get Estimate, My Leads, Account, Partner Directory and notifications outside the shared workspace, then open the lead and verify the three-tab header and leave-to-My-Leads modal.
