# Insurance Workspace

The Insurance Workspace is one broker-owned, evidence-led review of an immutable owner-authorised asset snapshot.

## Canonical application surface

- `lib/insurance-workspace-types.ts` — workspace data model and commands.
- `lib/insurance-workspaces.ts` — workspace creation, reads, commands, portfolio and audit persistence.
- `lib/insurance-validation.ts` — strict command validation.
- `app/api/insurance-workspaces/[workspaceId]/route.ts` — the single workspace read/write endpoint.
- `app/shared-registers/[shareId]/insurance-workspace-panels.tsx` — normalized review panels.
- `database/migrations/54-insurance-workspace-normalized.sql` — normalized schema and safe migration of existing records.

## Data rules

- Owner snapshot facts remain immutable and separately revisioned.
- Replacement value, owner-provided insured value and recorded policy sum insured are separate facts.
- Current cover is never inferred from an asset value or a deterministic suggestion.
- Policies, sections, schedule items, parties, locations, exposures and assessments use normalized many-to-many links.
- All human edits use optimistic concurrency and write audit events.
- Private broker notes are excluded from report payloads.

The catalogue contains 66 South African non-life cover definitions. Deterministic rules only identify areas to consider; a broker must explicitly accept, dismiss or request information before a suggestion affects an assessment.
