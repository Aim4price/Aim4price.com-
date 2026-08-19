# Aim4price

Aim4price is a South African asset intelligence and lifecycle platform for machinery, equipment and vehicles.

It helps asset owners, dealers, financiers and insurance professionals value, save, manage, share and market assets through one connected record. The platform is built around a simple idea: an asset should not become a disconnected spreadsheet row after it is valued. Its identity, value, documents, location, usage, maintenance, fuel, costs and approved partner activity should remain connected throughout its working life.

> Aim4price currently supports estimate flows across Agricultural, Construction, Industrial and Motor assets. It is no longer a tractors-only frontend.

## The asset ecosystem

```mermaid
flowchart TD
    A["Estimate an asset"] --> B["Save one asset record"]
    B --> C["Manage value, documents and operations"]
    C --> D["Share controlled access with trusted partners"]
    D --> E["Discover, finance, insure, maintain or market"]
    E --> B
```

The Asset Register is the centre of this ecosystem. Valuation creates the starting point; lifecycle activity makes the record more useful over time; permissioned collaboration allows the right partner to act without giving them unrestricted access to owner data.

## What is in the platform today

| Area | Current capability |
| --- | --- |
| Estimates | Guided estimate flows for Agricultural, Construction, Industrial and Motor assets; catalogue, replacement-price and generic-specification paths; age, usage and condition inputs; confidence ranges; VAT views; downloadable reports. |
| Asset Registers | Multiple registers per owner; manual or estimate-based assets; machinery, vehicles, property, tools and stock; values, replacement prices, photos, documents, finance, insurance, licensing, location and status details. |
| Asset history | Revaluation, depreciation snapshots, future-value projections, usage changes, location events and asset-level audit history. |
| QR and field capture | Asset and fuel-storage QR codes, PIN-protected scan access, usage and location updates, photos, fuel activity, notes and problems. |
| Maintenance | Date- or usage-based schedules, assigned Field Managers, completion history, issue tracking, reminders, reports and owner-approved dealer schedule proposals. |
| Fuel Tracking System | Fuel storage units, stock movements, refills, asset issues, dipstick notes, balance reconciliation, late-entry evidence, fuel slips and PDF/Excel reporting. |
| Cost Ledger | Manual cost entry or invoice/photo upload, local text extraction from supported digital PDFs, review before save, maintenance/parts/repair detail, duplicate warnings and PDF/Excel/accounting exports. |
| Discovery | Owner opt-in asset discovery, privacy-safe asset cards, contact requests, owner approval, temporary denial and time-limited approved access. |
| Marketplace | Owner/dealer listings, asset-linked photos and seller details, four-sector browsing, search and filters, distance options, price-position indicators and shareable listing pages. |
| Partner and lead workflows | Role-aware partner profiles, asset leads, notes, attachments, status management and owner-controlled sharing. |
| Insurance Workspace | Broker-owned reviews from immutable owner-authorised snapshots, structured policies and schedules, exposures, evidence, cover assessments, audit history and controlled reports. |
| Administration | Manual account activation, user management, usage reporting, asset-name CSV tools and QR-label generation. |

## User experiences

Aim4price serves different users from the same underlying asset data:

- **Asset owners** use the main web workspace to estimate assets, manage registers, track costs, maintenance, fuel, locations, documents and marketplace activity.
- **Owner App users** receive a compact installable experience for authorised day-to-day access to an owner's assets, actions, notifications, Discovery and Marketplace.
- **Dealers and dealer staff** use lead, cost, Discovery, Marketplace and maintenance-tracking tools. Dealer changes that affect the owner's official record remain subject to owner access and approval rules.
- **Field Managers** use a mobile-first installable workspace for assigned assets, maintenance, fuel storage and operational updates.
- **Finance partners** receive role-specific lead and asset collaboration tools.
- **Insurance professionals** can work from owner-authorised shared-register snapshots in a structured insurance review workspace.
- **Aim4price administrators** manage access, users, usage and selected data-quality operations.

The Owner App, Dealer App and Field Manager interfaces use separate signed sessions and include installable PWA manifests and service workers.

## Product principles

- **One asset, one evolving record.** Features add context to the same asset instead of creating separate copies.
- **Owner control first.** Discovery participation, partner access, dealer corrections, dealer schedules and dealer-submitted costs use explicit access or decision flows.
- **Estimates remain explainable.** Replacement price, age, usage, condition, selected method and confidence information are kept visible.
- **Operational history matters.** Maintenance, fuel, cost, location and scan activity are part of the long-term asset record.
- **Privacy before exposure.** Discovery limits private information until the owner approves a request.
- **Partners see only what they need.** Dealer, Field Manager, finance and insurance workflows are scoped to their role and the relevant asset/share.
- **Human decisions stay human.** Insurance rules identify areas to consider; they do not silently declare cover or replace broker judgement.
- **South African context is the default.** Currency, VAT handling, provinces, terminology, equipment sectors and insurance structures are designed for South African users.

## Technology

- [Next.js 14](https://nextjs.org/) App Router
- React 18 and TypeScript
- PostgreSQL through `pg`
- [Better Auth](https://www.better-auth.com/) email/password authentication
- Local Tesseract.js OCR for supported fuel-slip images
- Local PDF text parsing and in-app PDF/Excel report generation
- Resend-compatible password-reset email delivery
- Railway-oriented deployment

The application currently stores uploaded asset files in PostgreSQL-backed upload records. The database migrations are the source of truth for the deployed schema.

## Repository structure

```text
app/
  api/                 Server route handlers
  valuation/           Four-sector estimate workflow
  asset-register*/     Owner asset records and multi-register management
  maintenance/         Owner maintenance workspace
  fuel/                Fuel tracking and fuel-slip management
  my-invoices/         Cost Ledger
  asset-discovery/     Permissioned Discovery workflow
  marketplace/         Marketplace entry and browsing
  leads/               Partner lead management
  shared-registers/    Shared-register and Insurance Workspace UI
  owner-app/           Compact Owner App
  dealer/              Compact Dealer App
  field-manager/       Mobile Field Manager workspace
  admin/               Aim4price administration

components/            Shared UI and partner workflow components
lib/                   Domain logic, database access, auth and reporting
database/migrations/   Ordered PostgreSQL migrations
database/one_off/      Explicit, manually reviewed maintenance scripts
database/templates/    Data-import templates and retired-template notes
scripts/               Verification and build helpers
tests/                 Security and workflow regression tests
public/                Brand, PWA and marketing assets
```

## Local development

### Requirements

- Node.js 20 recommended
- npm
- PostgreSQL

### Install

```bash
npm ci
```

### Configure

Create `.env.local` and provide a PostgreSQL connection in one of these forms:

```env
# Option 1: Railway/PostgreSQL component variables
PGHOST=
PGPORT=
PGUSER=
PGPASSWORD=
PGDATABASE=

# Option 2: one connection string
# DATABASE_URL=postgresql://user:password@host:5432/database
```

Add the application and authentication values:

```env
BETTER_AUTH_URL=http://localhost:3000
NEXT_PUBLIC_SITE_URL=http://localhost:3000
BETTER_AUTH_TRUSTED_ORIGINS=http://localhost:3000
BETTER_AUTH_SECRET=replace-with-a-long-random-secret
```

Optional runtime values:

```env
# Used when generating absolute QR links.
NEXT_PUBLIC_APP_URL=http://localhost:3000
APP_URL=http://localhost:3000

# Password-reset email delivery.
RESEND_API_KEY=
AIM4PRICE_RESET_EMAIL_FROM=Aim4price <reset@aim4price.com>
AIM4PRICE_RESET_EMAIL_REPLY_TO=aim4price@gmail.com

# Optional dedicated cookie secrets. BETTER_AUTH_SECRET is the shared fallback.
OWNER_APP_SECRET=
DEALER_APP_SECRET=
SCAN_COOKIE_SECRET=
FIELD_MANAGER_COOKIE_SECRET=
FUEL_SCAN_COOKIE_SECRET=

# Optional value used by the admin storage dashboard.
AIM4PRICE_STORAGE_LIMIT_BYTES=

# Safe default. Do not change until the private Bucket rollout is approved.
AIM4PRICE_UPLOAD_STORAGE_MODE=postgres

# Keep unset. Exact acknowledgement required before any Bucket write is allowed.
AIM4PRICE_ALLOW_BUCKET_WRITES=

# Required only for the separately approved new-upload Bucket-only mode.
AIM4PRICE_ALLOW_BUCKET_ONLY=

# Private Railway Bucket references. Keep these server-side.
AIM4PRICE_BUCKET_NAME=
AIM4PRICE_BUCKET_ENDPOINT=
AIM4PRICE_BUCKET_REGION=auto
AIM4PRICE_BUCKET_ACCESS_KEY_ID=
AIM4PRICE_BUCKET_SECRET_ACCESS_KEY=
```

Never commit real secrets or production database credentials.

### Prepare the database

`database/schema.sql` is a direction note, not the live Railway schema. Apply the files in `database/migrations/` in numeric order.

The migration set is incremental, and the early files assume that the original Aim4price catalogue tables already exist. This repository does not currently contain a complete one-command bootstrap for a blank PostgreSQL database.

For an existing Aim4price database, back it up and apply only migrations that have not already been applied. For a new environment, first restore or create the required base schema, then apply the ordered migrations. The repository does not currently include an automatic migration runner, so migration state must be controlled as part of deployment.

### Run

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Validation

```bash
npm run typecheck
node --test tests/*.test.mjs
npm run verify:insurance
npm run build
```

The production build loads server route modules and therefore needs valid database environment variables, even when the TypeScript compilation itself succeeds.

Available package commands:

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the local Next.js development server. |
| `npm run typecheck` | Run TypeScript validation without emitting files. |
| `npm run test:asset-discovery` | Run the Discovery security regression suite. |
| `npm run verify:insurance` | Validate the insurance catalogue, rules and workspace guardrails. |
| `npm run build` | Create the production Next.js build. |
| `npm start` | Start the production server on Railway's `PORT` or port `3000`. |

## Railway deployment

1. Create or select the Railway project and PostgreSQL service.
2. Connect the GitHub repository to the application service.
3. Expose the PostgreSQL variables to the application service, or set `DATABASE_URL`.
4. Set the production authentication, site URL, trusted-origin and email variables.
5. Back up the database and apply outstanding migrations in numeric order.
6. Deploy with:

   ```text
   Build command: npm run build
   Start command: npm start
   ```

7. Test sign-in, account access, asset uploads, QR links, password reset and role-specific workspaces after deployment.

No custom Dockerfile is required by the current project.

The guarded upload-storage rollout is documented in
[`docs/railway-bucket-rollout.md`](docs/railway-bucket-rollout.md). The
code defaults to PostgreSQL. Migration 81 adds a separate metadata-only catalog
for new Bucket uploads without moving existing files; no object storage is
contacted unless all documented non-default activation gates are configured.

## Data and workflow guardrails

- Server routes recheck account role, ownership and share/access state instead of relying only on hidden UI controls.
- Discovery list results do not expose private owner fields or asset photos before the relevant approval/access rule is satisfied.
- Dealer cost records preserve dealership/staff provenance and use owner decisions for Cost Ledger storage and permanent deletion.
- Dealer maintenance access is asset-specific and permission-based; proposed schedules only become official after owner approval.
- Insurance reports are generated from saved snapshots, and private broker notes are excluded from report payloads.
- Fuel-slip OCR masks card-like numbers before extracted text is retained.
- Account and workspace deletion is handled through explicit domain cleanup logic.

These controls support the product model but do not replace normal production security review, database backups, monitoring or legal compliance work.

## Direction of travel

Aim4price is developing from an estimate tool into the operating layer around an asset.

The next stage of that direction is to:

- deepen model and replacement-price coverage across all four sectors;
- make the Asset Register the dependable source record used by owners and authorised partners;
- build richer lifecycle evidence from valuation, QR, location, maintenance, fuel, cost and document history;
- expand permissioned owner-to-dealer, finance and insurance workflows without weakening owner control;
- use stronger asset history to improve future value confidence, reporting and commercial decisions;
- move large upload payloads to scalable object storage while preserving stable asset/document references;
- continue replacing temporary catalogue bridges with normalized equipment data and repeatable import/verification workflows;
- grow automated regression coverage as the ecosystem expands.

The intended outcome is a connected South African asset ecosystem: value an asset, keep its record current, involve the right people at the right time, and carry its verified history into finance, insurance, servicing and sale.

## Important product note

Aim4price outputs are estimates based on available catalogue data and user-provided information. They are not certified valuations, offers to purchase, lending decisions, insurance advice or guarantees of market value.
