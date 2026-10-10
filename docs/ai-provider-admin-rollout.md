# AI providers and private admin reporting

## What this release does

- Preserves the existing ChatGPT client and existing Owner grants.
- Supports additional predefined confidential OAuth clients with independent secrets, exact callbacks and browser origins. No public dynamic registration or wildcard redirects.
- `AIM4PRICE_AI_ACCESS_MODE=owners` allows active direct Owner desktop accounts to opt in; unset/`pilot` retains the explicit pilot allowlist. Dealer, Business, Middleman, free, suspended, delegated and app identities remain ineligible. Account eligibility is checked on every read and refresh.
- Adds `/admin/ai-connect` and a separate `/api/ai/admin/mcp` resource, `aim4price:admin:read` scope and client credentials. Admin grants cannot call Owner tools and Owner grants cannot call admin tools.
- Admin access requires the actual website session and a database-confirmed, email-verified canonical Aim4price administrator. A suspended profile is denied. This release does not add MFA to the existing website login. Keep the provider connection private to the administrator; add enforced MFA before expanding admin access to staff.
- Two admin tools: `admin_asset_summary` and `admin_list_assets`. Both allow account, brand, kind, condition, text and lifecycle filters. Summary breakdowns can group by account, brand, kind, condition or lifecycle. Active assets are the default.
- Admin reports cover saved **register records**, not globally deduplicated physical machines. Values are ZAR excluding VAT using the same value precedence, per-record rounding and umbrella exclusions as Owner MCP totals. Missing/invalid values are disclosed and contribute zero. Totals cover all matching records regardless of page size. Admin costs, fuel, maintenance, documents and writes are not exposed by these two tools.
- Admin output excludes contact information, credentials, raw specs, photos, document URLs and precise locations. No SQL or arbitrary table query tool is available.

## Deploy

Run `node scripts/migrate-ai-connections.mjs` as the Railway pre-deploy command. It applies only migrations 135 and 137 under an advisory lock and transaction, records completion, and fails deployment on error. It preserves existing grants and all business records. Migration 137 expands the allowed **read-only** scopes and adds security audit/rate metadata. Cleanup during deployment removes expired security metadata and audit entries older than 90 days.

Configure:

| Variable | Purpose |
| --- | --- |
| `AIM4PRICE_AI_ACCESS_MODE=owners` | Product access for eligible Owner accounts; use `pilot` to roll back entitlement expansion. |
| `AIM4PRICE_AI_SHARED_LIMITS=true` | Required for wider rollout: PostgreSQL-backed limits shared by all application replicas. |
| `AIM4PRICE_AI_ADMIN_ENABLED=true` | Separate admin feature gate; disabling it immediately blocks subsequent admin requests/refreshes. |
| `AIM4PRICE_AI_ADMIN_CLIENT_ID` | Distinct private client, e.g. `aim4price-chatgpt-admin`. |
| `AIM4PRICE_AI_ADMIN_CLIENT_SECRET` | New cryptographically random secret of at least 32 characters; never reuse the Owner secret. |
| `AIM4PRICE_AI_ADMIN_REDIRECT_URIS` | Exact callback supplied by the admin's AI platform. |
| `AIM4PRICE_AI_CLIENTS_JSON` | Optional additional provider registrations, shown below. |

Existing `AIM4PRICE_AI_ENABLED`, origin, signing secret and legacy Owner ChatGPT variables stay in place. Keep the pilot IDs for rollback. Do not put secrets in source, browser props, manifests, chat messages or logs.

## Add another provider

1. Obtain its exact OAuth callback from its private/custom MCP setup.
2. Generate a unique secret and place it in a dedicated Railway variable, for example `AIM4PRICE_AI_CLAUDE_SECRET`.
3. Add an entry to `AIM4PRICE_AI_CLIENTS_JSON` (replace the placeholder callback with the exact issued callback):

```json
[
  {
    "id": "aim4price-claude-owner",
    "name": "Claude",
    "audience": "owner",
    "secretEnv": "AIM4PRICE_AI_CLAUDE_SECRET",
    "redirectUris": ["https://REPLACE-WITH-EXACT-PROVIDER-CALLBACK"],
    "origins": ["https://claude.ai"],
    "launchUrl": "https://claude.ai/"
  }
]
```

Use `audience: "admin"` only for a separate private admin registration with its own ID and secret. A registration cannot span audiences. Server-to-server requests need no Origin; browser Origins must match that specific registered provider. Changing/removing a client blocks its subsequent reads and refreshes.

OAuth endpoints (canonical origin from Railway):
- Authorization: `/api/ai/oauth/authorize`
- Token: `/api/ai/oauth/token`
- Revoke: `/api/ai/oauth/revoke`
- Customer resource: `/api/ai/mcp`, scope `aim4price:read`
- Admin resource: `/api/ai/admin/mcp`, scope `aim4price:admin:read`

Use authorization code + S256 PKCE with `client_secret_post` or `client_secret_basic`. The provider holds its secret; ordinary customers use Aim4price sign-in and consent. The client ID and exact resource must accompany the flow. Token refreshes retain their original client/resource/scope.

The UI lists only configured providers, opens their launch URL and explains their custom connection setup. Configuration does not establish live compatibility or create a public directory listing. Test the actual provider before announcing availability. No new provider account or listing is provisioned by this code.

## Safety and operational limits

- Business reads execute in PostgreSQL READ ONLY transactions with an 8-second statement timeout. Only OAuth, rate-limit and audit metadata are written. Existing website mutation routes do not accept these tokens.
- One-hour access tokens; rotating refresh tokens; 30-day Owner connections and **24-hour admin connections**. Replayed refresh tokens revoke the connection. Current role, client and account eligibility are rechecked. Disconnect blocks subsequent requests; an already running snapshot may complete.
- Admin tool calls log actor, connection, provider, approved tool name, outcome and time. No raw filters, tokens, returned records or prompts are logged. A failed audit write prevents an answer being returned. Disallowed tool names are normalised before logging.
- With shared limits enabled: 120 protocol requests/minute per Owner, 60 per admin, 6,000 MCP requests/minute service-wide and 1,200/minute per OAuth endpoint. Per-process burst protection remains as a fallback. Shared rate buckets have fixed service names or hashes of authenticated user IDs, never arbitrary caller text or untrusted forwarded IPs. Deploy cleanup bounds old identities; consider scheduled cleanup if deployments become infrequent.
- Current database reads use the application pool plus enforced read-only transactions. A dedicated least-privilege reporting database credential/replica is additional defence to provision separately; this release does not claim database credential isolation.
- Revocation cannot erase information already returned to a provider. Review the provider's retention settings and disclose cross-account sharing on admin consent.

## Verification and rollout

`npm run test:ai-connection` covers existing Owner tools, actual PostgreSQL read-only enforcement, SDK protocol compatibility, multiple providers, code/token isolation, admin eligibility, role removal, both audience boundaries, revoked/rotated tokens, shared limits, metadata migration repeatability, full totals and pagination, umbrella exclusions, sensitive-field exclusions and audit failure.

Also run `npm run typecheck` and `npm run build`, and the affected CI checks. After deployment verify discovery, unauthenticated 401 responses and consent sign-in routing. A real provider login, approval, question and disconnect are still required to prove end-to-end connectivity. Never manufacture a production user token to simulate consent.

Suggested admin test questions:
- How many active asset records exist across accounts, and what is their total saved value?
- Break down active assets by account and show missing valuations.
- Show all active New Holland tractors with their account labels and recorded usage.

Compare results against the relevant registers; do not count the same physical machine as unique simply because it appears in two account registers.
