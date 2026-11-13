# AI connection preflight and live acceptance

## Automated checks

Run `npm run test:ai-connection`, `npm run typecheck`, and `node scripts/verify-ai-connections.cjs`.

The database-backed tests exercise OAuth issuance, account-type binding, token rotation and reuse detection, expiry, long-lived customer approval, provider separation, account suspension, disconnect, Owner isolation, Dealer section permissions, Business membership, revoked shares, changed asset ownership and pagination. Admin grants remain separate and expire after 24 hours.

Additional preflight regressions cover disconnect using an older refresh token, one-year Dealer/Business renewal, malformed access IDs, incomplete cost totals, undated invoice exclusions and incomplete budget spending. Cost summaries disclose missing amounts/VAT instead of treating them as evidence of zero costs. Budget status becomes incomplete when a dated invoice has no amount.

The management screen reports **Access approved**. This confirms an active grant, not that a provider successfully read data. Check connection reloads approval records; it is not an end-to-end provider probe. Separate grants are shown separately and can be disconnected independently; reconnecting does not silently revoke another installed client.

## Provider setup requirements

The configured provider registry and exact registered callbacks remain authoritative. Copying the MCP URL alone does not register an OAuth client. Do not paste credentials into chat. Self-service instructions now disclose this prerequisite and flag providers that are not enabled. The supplied setup shortcuts are navigation aids, not evidence that a provider supports the required flow on every plan.

## Live acceptance before general release

For each enabled provider, use a consenting test account of each supported type:

1. Open the setup shortcut, install/configure the connector, sign in, review the correct account and approve. Also cancel once and verify no grant is issued.
2. Ask the assistant to identify the connected account. Compare an asset and a dated report with the website. Check currency, VAT basis, date range, pagination and missing values.
3. Attempt another account's asset ID and an unshared section. No private records should be returned.
4. Remove a share or section permission; repeat the request and verify denial. Suspend a test account/workspace and verify reads and renewal stop.
5. Let the one-hour access token expire, then ask another question. The provider must renew automatically without another approval. Simulated database tests do not prove the provider's renewal implementation.
6. Disconnect and repeat a read and renewal. Both must fail. Reconnect and confirm the correct account and grant are shown.
7. Verify the flow on desktop and mobile, including missing connector options, verification failures and disabled providers.

Record provider, account type, deployed commit, date and pass/fail evidence. Do not mark ChatGPT, Claude or Gemini fully verified from a successful server test alone. Live provider installation, callback registration, plan availability and real answer quality remain pending until this exercise is completed.

No new database migration is required for these preflight changes. Existing AI migrations remain prerequisites.
