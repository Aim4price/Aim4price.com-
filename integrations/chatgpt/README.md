# Aim4price public ChatGPT integration

This folder prepares a public **Owner-only** integration. It does not publish it,
create production credentials, or certify a successful live connection. The existing
private and admin clients remain separate. No API model calls are introduced.

## Package

Run from the repository root, using the public client identifier registered in
Aim4price (never a secret):

```sh
python3 scripts/package-chatgpt.py --client-id aim4price-chatgpt-public
```

The proposed ID above must be registered before connecting. The ZIP is written to
`.next/chatgpt/aim4price.zip`. It contains only `plugin.json`, `mcp.json` and the
existing Aim4price logo. `--origin` must match `AIM4PRICE_AI_ORIGIN` exactly,
including `www` if present. The scope and resource are Owner-only. The OAuth
client secret is entered in the OpenAI portal, never packaged or shown to users.
Review cases in the manifest are expected behaviours, not executed test evidence.
South Africa is the initial publication country; adjust only for intended markets.

## Complete the publisher setup

1. Use the verified Aim4price publisher identity and the intended OpenAI project.
   The operator needs app-management write access. Upload the generated ZIP in
   the OpenAI plugin submission portal as a remote MCP integration.
2. Obtain the exact OAuth callback URL from that connection setup. Register a
   dedicated Owner client through `AIM4PRICE_AI_CLIENTS_JSON`, preserving existing
   entries. Use ID `aim4price-chatgpt-public`, name `ChatGPT`, audience `owner`,
   the exact callback, origin `https://chatgpt.com`, and secretEnv
   `AIM4PRICE_AI_CHATGPT_PUBLIC_SECRET`. Generate a unique >=32-character secret
   and enter it securely on both sides. Do not reuse the admin secret or weaken
   callback validation. Do not publish credentials in this document.
3. Complete the portal's actual domain-verification challenge. Do not invent its
   path or token. Use the canonical resource `https://www.aim4price.com/api/ai/mcp`
   (or the exact configured origin). Choose provided OAuth client authentication
   with `client_secret_basic`, scope `aim4price:read`, and authorization-code PKCE.
4. Prepare a dedicated review Owner account with synthetic assets, costs, monthly
   budgets, fuel issues and due maintenance. Keep it eligible for the pilot while
   testing. Supply reviewer credentials only through the portal. Never authorise
   the reviewer to a real customer or farm account. Record actual expected totals
   and a demo recording using that account, if required by the portal.
5. Authenticate, scan tools, and run the cases below. Resolve portal findings and
   confirm the privacy/support URLs and publisher identity before submission.
6. Submit for review. Publish only after approval. Public review, domain verification,
   identity verification and approval cannot be established by this repository.
7. After publication, set `AIM4PRICE_CHATGPT_LISTING_URL` to the actual HTTPS listing
   on `chatgpt.com/apps/<id>` or `chatgpt.com/plugins/<id>`. Never guess the URL.
   The UI validates it and offers the listing handover only when it is configured
   and the ChatGPT provider is registered. Invalid or absent values retain private
   connection guidance. Setting the URL alone does not change account eligibility.
8. For a customer rollout, confirm `AIM4PRICE_AI_ACCESS_MODE=owners` and the shared
   limiter, deployment migrations and data-access restrictions described in
   `docs/ai-provider-admin-rollout.md`. Then test a second eligible Owner account.

## Required evidence before calling the integration ready

- Sign in and consent show the intended Owner; terms acknowledgement is required.
- Tool scan lists only Owner read tools, with readOnly=true, destructive=false,
  idempotent=true and openWorld=false. These read an account-bound database;
  they do not write records or search external services. No admin tool is included.
- Run every positive and negative manifest case; record actual outputs separately.
- Compare full-period totals against the website, including VAT and umbrella rules.
- Test pagination, missing data, empty records and unsupported attachments.
- A second Owner can read only their own records; foreign IDs disclose nothing.
- Refresh works beyond the initial access token; reconnect works after expiry.
- Disconnect denies subsequent reads and refreshes. Previously shared chat content
  is not deleted by revocation.
- Existing private and admin integrations still work independently.

## Customer flow

Published: choose ChatGPT, open the real Aim4price listing, connect/sign in/approve,
then select Aim4price in a conversation. No server URL or shared secret is needed.
Before publication: clearly identify private setup and direct users to an already
configured connection or Aim4price support. The homepage is not a connect link.
The existing Check connection action checks approved grants, not a live MCP query.

## Sources checked 2026-11-01

- https://developers.openai.com/plugins/build/plugins
- https://developers.openai.com/plugins/deploy/submission
- https://developers.openai.com/plugins/deploy/app-review
