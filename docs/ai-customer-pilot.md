# Dealer and Business AI connection pilot

This extends the existing customer MCP resource (`/api/ai/mcp`) and OAuth clients.
The registry audience remains `owner` for compatibility; the signed-in account type
selects the customer tools. Admin credentials, scope and endpoint remain separate.
No plugin ZIP or client credentials are sent to customers.

## Permission map

| Principal | Tools and scope |
| --- | --- |
| Owner desktop | Existing Owner tools, scoped to the authenticated user ID; no new data categories. |
| Dealer desktop account holder | Own and managed-client registers under that user ID; active dealer maintenance access; addressed shared enquiries; accessible parts listings. |
| Business workspace owner | Addressed enquiries and the selected asset sections in those enquiries. Requires verified email, active owner membership and no linked legacy suspension. |
| Staff, delegated/app sessions, Business members, Middlemen | Not enabled by this pilot. Never substitute a manager's token. |
| Admin | Existing separate admin tools and 24-hour grants, unchanged. |

Dealer/Business access requires BOTH the account-type switch and an explicit user-ID
allowlist entry. This remains true in `owners` mode, so broad Owner availability can
continue without automatically admitting every Dealer or Business.

For external enquiries, the authenticated verified email must match the recipient;
if a recipient user ID is stored, that must match too. Only non-revoked,
non-umbrella, explicitly addressed shares are included. Every selected asset must
still belong to the sharing owner. No stored snapshot is used after a transfer.
Untargeted public/WhatsApp links and umbrella shares are intentionally excluded.
The tool description and consent explain that this is a subset of the website inbox.

For dealer maintenance access, both `is_active` and `revoked_at` are checked, with
an asset/owner join. Maintenance requires `can_view_maintenance_reports`, problems
require `can_view_logged_problems`, and costs require `can_view_cost_of_ownership`.
External shares use the corresponding explicit boolean permissions. Broad report
access, the ability to submit costs, or a maintenance assignment does not grant
cost visibility. Each read forces one authorised asset ID into existing Owner
read functions; account-wide queries and arbitrary owner overrides are rejected.

Basic shared asset responses use an explicit field allowlist. External valuation
hiding is respected. Maintenance-only access does not return valuations. Neither
path returns attachments, photos, private notes, account contact details, precise
locations or bearer share tokens. Enquiry IDs are non-bearer hashes resolved only
inside the current recipient's authorised set.

Parts queries require active viewer membership and an unarchived network. Other
suppliers must be visible and active with positive listed quantities. List-mode
networks expose only the creator's rows. Preserve exact part numbers, upload dates
and each supplier's VAT basis. A listing is not proof of live inventory.

## Consent, sessions and revocation

- Real website sessions only; no support impersonation, app or delegated sessions.
- Consent proofs, authorization codes and grants are bound to account type. A type
  change requires reconnecting, rather than reusing the previous approval.
- Account eligibility is checked at consent, code exchange, refresh and every MCP
  request, then again within the read-only data snapshot.
- Sharing and membership checks run on every retrieval. There is no cached access
  list. Changes apply to subsequent requests; an in-flight database snapshot can
  finish with the permissions it observed when it started.
- Customer access tokens last one hour with rotating refresh tokens. Connections
  persist until revoked or eligibility changes. Old fixed-expiry grants retain
  their original expiry. Data already supplied to an AI cannot be recalled.
- Partner tool calls write only security audit metadata (actor, connection,
  provider, allowlisted tool name and outcome). No prompts, returned records,
  arguments, tokens or private notes are logged. Existing 90-day cleanup applies.

## Calculations and missing data

Owner calculations are reused for explicitly permitted single-asset costs and
maintenance. Costs are accepted ledger amounts, not payment balances or profit.
Maintenance due status uses saved date/usage readings; unknown readings remain
unknown. Acknowledgement is not proof of repair. Shares do not imply tasks.

Lists return full matching record counts and bounded pagination, not monetary
page sums. Missing optional stores return `available: false`; missing columns or
other query errors fail instead of reporting zero. All reads execute in a
read-only repeatable-read transaction with a statement timeout. User-authored
record text is data, never executable instructions.

## Deploy and pilot

1. Run `node scripts/migrate-ai-connections.mjs` as the existing pre-deploy step.
   It now includes the repeatable migration `157-ai-customer-account-scope.sql`.
   It changes authentication metadata only, not asset data or sharing permissions.
2. Deploy the reviewed branch. Default configuration stays Owner-only.
3. Use established verified Dealer and Business account holders. A Business must
   already have an active workspace from normal website onboarding. AI requests
   never initialise application schema or create memberships.
4. Set `AIM4PRICE_AI_ACCOUNT_TYPES=owner,dealer,business` and add the pilot account
   IDs to `AIM4PRICE_AI_ALLOWED_USER_IDS`, preserving existing IDs. Keep the
   existing `AIM4PRICE_AI_ACCESS_MODE`; in `owners` mode, Owners remain broadly
   available while partners still require the allowlist.
5. Connect each pilot account through a configured provider. Confirm the consent
   categories and tool list match its account type. Compare selected results with
   that user's website records, including missing data and pagination.
6. Revoke a share, turn off cost permission, transfer a test asset, suspend a
   Business membership and disconnect the AI. Confirm subsequent retrieval fails
   in each case. Use synthetic/test records rather than unrelated customer data.
7. Review audit failures and provider compatibility before adding further IDs.

Rollback partner access by restoring `AIM4PRICE_AI_ACCOUNT_TYPES=owner` or removing
partner IDs. Existing partner tokens and refreshes then fail eligibility checks.
Do not roll back by granting wider permissions or issuing manager tokens to staff.

## Validation and remaining work

`npm run test:ai-connection` exercises real PostgreSQL semantics with PGlite plus
an MCP SDK client. It covers cross-account access, permission reduction,
revocation, wrong recipient identity, ownership mismatch, business suspension,
removed membership, scope changes, parts visibility, pagination, unavailable
stores, read-only enforcement and existing Owner/Admin flows.

`npm run typecheck`, publication/package tests and `node scripts/verify-ai-connections.cjs`
cover compilation and the existing responsive connection/consent UI, including
Dealer and Business consent at desktop/mobile widths.

Production OAuth/provider sign-in remains a separate pilot acceptance check.
This change does not enable staff connections, shared attachments, umbrella/public
link discovery, workflow assignments, dealer-authored pending invoices, writes,
or insurer/finance/licensing-specific datasets. These require their own scoped
read tools and acceptance tests; the pilot must not claim to support them.
