# Specialist workspace retirement

Aim4price supports Owner, Dealer, Business and Middleman accounts. Middleman remains a Dealer subtype with its existing app and permissions.

This change removes the internal assistance network and the dedicated Insurance, Finance/Accounting and Licensing workspaces. Ordinary businesses can still offer these services through the Business Network. Owner asset finance, insurance and licence information, Dealer client registers, normal sharing, capture services and existing records remain available through their normal permissions.

## Deployment

Apply `database/migrations/120-retire-specialist-workspaces.sql` after migration 119, before deploying this application revision. The migration is transactional and repeatable. It:

- Records the original account roles in `retired_specialist_accounts`.
- Converts ordinary specialist users to Business with the matching service category, retaining their approval/suspension status. Business verification requirements still apply.
- Suspends internal assistance users, disables directory/discovery participation, and deletes their existing website sessions. This includes the four named email accounts and the synthetic Dealer assistance account (`dealers@aim4price.com`).
- Disables assistance locations/accounts, specialist billing plans and affected billing agreements. Existing invoices are unchanged.

The application also rejects internal assistance sign-in, filters their sessions, rejects new specialist signup, removes specialist routes and rejects old accountant workspace parameters with HTTP 410.

No users, assets, documents, invoices or historical shares are deleted. Historical tables, original migrations and the code needed to read or clean up historical records remain intentionally. Old specialist pages return 404; ordinary Business users use `/business` and its normal verification flow.

## Validation

Run `npm run typecheck`, `npm run test:workspace-retirement`, the Business network validation tests and billing validation tests. The retirement suite executes migrations 119 and 120 in PostgreSQL-compatible PGlite, checks repeated execution, and verifies preserved core roles, history, disabled billing and revoked sessions. It also tests retired sign-in/signup and old share URL rejection.

This pull request does not execute the migration against production or deploy the application.
