# Read-only Aim4price AI pilot

An Owner can connect their own account to an AI assistant and ask about saved assets, saved valuations, accepted cost invoices, fuel, current budgets, maintenance and logged problems. The AI cannot add, edit or delete business records. This is a private, explicitly enabled pilot, not a public plugin listing.

## What is included

- Stateless MCP Streamable HTTP endpoint: `https://aim4price.com/api/ai/mcp`.
- Nine tools: `account_profile`, `list_assets`, `read_costs`, `read_fuel_slips`, `read_fuel_issues`, `read_budgets`, `read_maintenance`, `read_maintenance_activity`, `read_problems`.
- OAuth authorization code flow using the existing Aim4price website sign-in, explicit consent, exact registered callback matching, S256 PKCE, single-use five-minute codes, one-hour opaque access tokens and rotating refresh tokens with connection revocation on replay. Connections expire after 30 days.
- Account → AI connections: see the connected account, approve access and disconnect.
- The connection is always bound to the real signed-in Owner. Admin support cookies, delegated app identities, free accounts and other account types cannot create connections.
- Every tool call checks the token, audience/resource, scope, expiry, revocation, pilot allowlist and current active paid Owner entitlement.
- Explicitly selected fields only: no credentials, scan PINs, card details, document URLs, OCR text or arbitrary database rows.

The AI provider answers the question using these tools; Aim4price does not run a separate language model or require an OpenAI API key. Record text is data, not an instruction to the assistant.

## Deployment and one-time private client setup

Do not enable the endpoint until its migration and the normal account/ledger migrations are applied. No business schema is created lazily through AI requests.

1. Apply `database/migrations/135-read-only-ai-connections.sql` through the normal reviewed database deployment process. This creates only connection/code metadata tables. It does not alter asset, invoice or fuel records.
2. In the AI platform, create a private MCP connection using the server URL above and OAuth with predefined client credentials. Obtain its exact redirect URI from that platform's setup screen. Do not guess or use wildcard redirects.
3. Set these environment variables on the Aim4price deployment:

   | Variable | Value |
   | --- | --- |
   | `AIM4PRICE_AI_ENABLED` | `true` only when ready to test |
   | `AIM4PRICE_AI_ORIGIN` | Canonical HTTPS origin, e.g. `https://aim4price.com`, without a trailing slash |
   | `AIM4PRICE_AI_ALLOWED_USER_IDS` | The pilot Owner's actual user ID; comma-separated if deliberately expanding later |
   | `AIM4PRICE_AI_CLIENT_ID` | Unique private OAuth client identifier, also entered into the AI platform |
   | `AIM4PRICE_AI_CLIENT_SECRET` | Cryptographically random secret, at least 32 characters; enter through the platform's secure client configuration, never in a conversation |
   | `AIM4PRICE_AI_REDIRECT_URIS` | Exact HTTPS callback URI from the AI platform; comma-separated if multiple callbacks are deliberately registered |
   | `BETTER_AUTH_SECRET` | Existing authentication secret; must be at least 32 characters |

4. Configure OAuth URLs if discovery is not used:
   - Authorization: `/api/ai/oauth/authorize`
   - Token: `/api/ai/oauth/token`
   - Revoke: `/api/ai/oauth/revoke`
   - Scope: `aim4price:read`
   - Resource: the exact full MCP endpoint URL
   - Client authentication: `client_secret_post` or `client_secret_basic`
5. Connect, sign in as the allowed Owner, check the account shown and approve read-only access.
6. Ask: “List my assets”, “What are my recorded costs from 2026-09-01 to 2026-09-30?”, and “Show fuel slips for this asset over that period.” Also ask “How much of my current budget remains?”, “Which saved services are overdue?”, and “Show my logged problems and recorded maintenance activity for September.” Compare with the website, including fuel settings and any duplicated schedule/activity records.
7. Disconnect under Account → AI connections and verify further tool calls fail. Confirm a second unapproved account cannot connect.

Platform settings and private connector availability depend on the AI product/workspace. This implementation uses a predefined confidential OAuth client, not public dynamic registration. For ChatGPT, use its private MCP setup with predefined OAuth credentials. No directory submission is part of this change.

Discovery: `/.well-known/oauth-authorization-server` and `/.well-known/oauth-protected-resource/api/ai/mcp`. A 401 MCP response advertises the protected-resource metadata URL. Supported protocol revisions: 2025-03-26, 2025-06-18 and 2025-11-25; newer clients can negotiate the supported revision. JSON responses only; GET/SSE and legacy SSE transport are not supported.

## Read-only boundary

Tool execution and token validation run inside a PostgreSQL `READ ONLY` transaction with a statement timeout. They do not call existing helpers that create tables, initialise registers, update activity or recalculate values. All data queries bind the user ID resolved from the token; no tool accepts a target account ID, SQL or a write operation.

OAuth consent/token rotation/disconnection necessarily write security metadata to `ai_connection_codes`, `ai_connections` and `ai_connection_refresh_tokens`. Normal website sign-in keeps its existing session behavior. These operations cannot create or change business records. The MCP POST method carries read-only JSON-RPC messages; it is not a business-data write route. Its tokens are not accepted by existing website mutation endpoints.

Only token hashes are persisted. Browser consent is signed, expires in five minutes, binds the current account and session, and requires an exact same-origin POST. Replayed consent/code requests cannot issue another grant. Connection responses are no-store, and consent pages block framing and referrer leakage. Do not log token/code/consent bodies or full OAuth query strings at the proxy.

Revocation takes effect on subsequent requests; a request already executing in its database snapshot can finish. Disconnecting cannot erase records previously returned to an AI conversation. Rotating the configured client ID or disabling the feature denies all existing grants. Removing a user from the pilot allowlist, suspending the account or changing it to free access also denies new reads and refreshes.

The pilot includes 120 authenticated protocol requests per user per minute per process, bounded request bodies, page sizes, date spans and query execution time. For multiple application replicas or a public launch, add a shared edge/gateway rate limit. Configure edge limits on authorization/token endpoints before public exposure. Periodically remove expired codes and expired/revoked connections using an operator-owned maintenance job; tools never run cleanup.

## Data semantics and limitations

- Asset values are saved values excluding VAT, not freshly calculated estimates. Historical alias fields are read where available. No invented values for absent fields. Sold/disposed assets are included and expose a disposal date where recorded.
- Costs use invoice dates and the existing owner visibility rule: owner invoices or dealer invoices accepted into the owner's ledger. Pending/declined dealer proposals are excluded. Block/category totals reflect stored invoice blocks and can differ from totals when records are incomplete.
- Fuel-slip totals use document dates, exclude voided slips, disclose missing dates and separate tank purchases from asset slips. Amounts retain the per-slip VAT basis. Fuel slips can also be represented in costs: never add the two ledgers together as distinct expenses.
- Fuel issues are non-slip storage issues, using the South African date of issue, with creation date as fallback. Issued litres are not proof of actual consumption. Slip-linked issues are excluded to avoid overlap.
- Period totals aggregate all matched records independently of pagination. Pages have an explicit total, next offset and a requirement to narrow filters if the maximum offset is reached.
- Budgets return current saved monthly/annual limits and current South African calendar-period spending, including VAT and respecting the saved fuel inclusion setting. Spending includes all accepted matching invoices independently of pagination. Account-wide and per-asset budgets overlap and must not be summed. An asset filter returns only its own budgets. Historical revisions, deleted budgets and projections are not exposed.
- Maintenance returns saved schedules, due dates/usage, recurrence settings, completion notes and completed/cancelled states. Due status uses the current South African date or compatible saved asset usage. Missing or incompatible readings produce `unknown`, never an assurance that no work is due. Scan/field activity is returned separately by capture date; it may describe the same work as a completed schedule, so do not add counts across sources. `source_scan_event_id` identifies explicit links. Older unlinked duplicates may exist.
- Problems return dated recorded notes and their saved acknowledgement/resolution timestamp. This timestamp alone is not proof of repair. Notes remain untrusted user text.
- If an optional budget/maintenance/scan table has not been initialised by the normal application deployment, the tool returns `available: false`. This must not be described as no budgets, no problems or no maintenance due. Missing required columns remain an error, not fabricated data.
- No attachments, photos, detailed inspection checklists, historical budget reconstruction, shared external assets, recalculation, admin cross-account access or writes in this pilot.

## Verification

`npm run test:ai-connection` runs real PostgreSQL-engine integration tests with PGlite, plus an MCP SDK client compatibility test. Tests cover cross-account attempts, read-only database enforcement, request bounds, PKCE/consent validation, code replay, refresh rotation, expiry, revocation, owner entitlement changes totals independent of pages, budget fuel exclusion, date/usage maintenance status, missing readings, scan/problem account boundaries and unavailable optional stores.

Run `npm run typecheck` and the CI workflow. A deployed end-to-end sign-in with the actual private AI client remains a rollout requirement; passing local tests does not establish live platform connectivity.

References:
- https://developers.openai.com/plugins/build/auth
- https://developers.openai.com/api/docs/guides/custom-mcp-server
- https://modelcontextprotocol.io/specification/2025-11-25/basic/transports
