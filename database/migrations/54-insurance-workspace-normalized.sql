-- Insurance Workspace. Additive and idempotent: previous workspace tables remain available for compatibility.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TABLE public.insurance_workspaces
  ADD COLUMN IF NOT EXISTS client_segments text[] NOT NULL DEFAULT ARRAY[]::text[],
  ADD COLUMN IF NOT EXISTS profile_schema_version integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS catalogue_version text NOT NULL DEFAULT 'za-non-life-2026.07.1',
  ADD COLUMN IF NOT EXISTS workspace_version integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS migration_profile_migrated_at timestamptz;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'insurance_workspaces_client_segments_check'
  ) THEN
    ALTER TABLE public.insurance_workspaces
      ADD CONSTRAINT insurance_workspaces_client_segments_check
      CHECK (client_segments <@ ARRAY['domestic', 'commercial']::text[]);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.insurance_industry_profile_definitions (
  key text PRIMARY KEY,
  label text NOT NULL,
  catalogue_version text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.insurance_industry_profile_definitions (key, label, catalogue_version, sort_order)
VALUES
  ('agriculture_farming', 'Agriculture and farming', 'za-non-life-2026.07.1', 10),
  ('transport_logistics', 'Transport and logistics', 'za-non-life-2026.07.1', 20),
  ('construction_engineering', 'Construction and engineering', 'za-non-life-2026.07.1', 30),
  ('industrial_manufacturing', 'Industrial and manufacturing', 'za-non-life-2026.07.1', 40),
  ('mining_utilities', 'Mining and utilities', 'za-non-life-2026.07.1', 50),
  ('retail_wholesale', 'Retail and wholesale', 'za-non-life-2026.07.1', 60),
  ('hospitality_tourism_leisure_events', 'Hospitality, tourism, leisure and events', 'za-non-life-2026.07.1', 70),
  ('professional_services', 'Professional services', 'za-non-life-2026.07.1', 80),
  ('real_estate_sectional_title', 'Real estate, body corporate and sectional title', 'za-non-life-2026.07.1', 90),
  ('healthcare', 'Healthcare', 'za-non-life-2026.07.1', 100),
  ('motor_trade', 'Motor trade', 'za-non-life-2026.07.1', 110),
  ('marine_operations', 'Marine operations', 'za-non-life-2026.07.1', 120),
  ('aviation', 'Aviation', 'za-non-life-2026.07.1', 130),
  ('rail', 'Rail', 'za-non-life-2026.07.1', 140),
  ('renewable_energy', 'Renewable energy', 'za-non-life-2026.07.1', 150),
  ('other_specialist_referral', 'Other / specialist referral', 'za-non-life-2026.07.1', 160)
ON CONFLICT (key) DO UPDATE SET
  label = excluded.label,
  catalogue_version = excluded.catalogue_version,
  sort_order = excluded.sort_order,
  active = true,
  updated_at = now();

CREATE TABLE IF NOT EXISTS public.insurance_workspace_industries (
  workspace_id uuid NOT NULL REFERENCES public.insurance_workspaces(id) ON DELETE CASCADE,
  industry_key text NOT NULL REFERENCES public.insurance_industry_profile_definitions(key),
  source_type text NOT NULL DEFAULT 'broker_recorded'
    CHECK (source_type IN ('owner_provided', 'broker_recorded', 'policy_schedule', 'wording', 'insurer_confirmed', 'migrated_existing', 'system_suggestion')),
  source_reference text,
  human_confirmed_by text,
  human_confirmed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (workspace_id, industry_key)
);

CREATE TABLE IF NOT EXISTS public.insurance_snapshot_revisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.insurance_workspaces(id) ON DELETE CASCADE,
  revision integer NOT NULL CHECK (revision > 0),
  source_share_id uuid NOT NULL REFERENCES public.asset_leads(id) ON DELETE RESTRICT,
  source_snapshot_hash text NOT NULL,
  source_generated_at timestamptz,
  imported_at timestamptz NOT NULL DEFAULT now(),
  imported_by_user_id text,
  owner_authorisation_reference text NOT NULL,
  asset_count integer NOT NULL DEFAULT 0 CHECK (asset_count >= 0),
  snapshot_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, revision),
  UNIQUE (workspace_id, source_snapshot_hash)
);

CREATE TABLE IF NOT EXISTS public.insurance_snapshot_diffs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.insurance_workspaces(id) ON DELETE CASCADE,
  from_revision_id uuid REFERENCES public.insurance_snapshot_revisions(id) ON DELETE CASCADE,
  to_revision_id uuid NOT NULL REFERENCES public.insurance_snapshot_revisions(id) ON DELETE CASCADE,
  source_asset_key text NOT NULL,
  change_type text NOT NULL CHECK (change_type IN ('added', 'removed', 'materially_changed')),
  before_hash text,
  after_hash text,
  changed_fields jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (to_revision_id, source_asset_key, change_type)
);

CREATE TABLE IF NOT EXISTS public.insurance_snapshot_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.insurance_workspaces(id) ON DELETE CASCADE,
  snapshot_revision_id uuid NOT NULL REFERENCES public.insurance_snapshot_revisions(id) ON DELETE CASCADE,
  source_asset_key text NOT NULL,
  title text NOT NULL,
  snapshot_hash text NOT NULL,
  snapshot_json jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (snapshot_revision_id, source_asset_key)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_insurance_workspace_assets_workspace_id_id
  ON public.insurance_workspace_assets(workspace_id, id);

CREATE TABLE IF NOT EXISTS public.insurance_parties (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.insurance_workspaces(id) ON DELETE CASCADE,
  party_type text NOT NULL DEFAULT 'organisation' CHECK (party_type IN ('person', 'organisation', 'trust', 'estate', 'other')),
  display_name text NOT NULL,
  registration_or_id_reference text,
  contact_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  source_type text NOT NULL DEFAULT 'broker_recorded',
  source_reference text,
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  created_by_user_id text,
  updated_by_user_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, id)
);

CREATE TABLE IF NOT EXISTS public.insurance_party_roles (
  workspace_id uuid NOT NULL REFERENCES public.insurance_workspaces(id) ON DELETE CASCADE,
  party_id uuid NOT NULL,
  role_key text NOT NULL CHECK (role_key IN ('insured', 'owner', 'financier_mortgagee', 'beneficiary', 'operator', 'custodian', 'principal', 'contractor')),
  role_context text,
  effective_from date,
  effective_to date,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (workspace_id, party_id, role_key),
  FOREIGN KEY (workspace_id, party_id) REFERENCES public.insurance_parties(workspace_id, id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS public.insurance_locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.insurance_workspaces(id) ON DELETE CASCADE,
  label text NOT NULL,
  address_text text,
  latitude numeric(10,7),
  longitude numeric(10,7),
  occupancy_use text,
  is_unknown boolean NOT NULL DEFAULT false,
  source_type text NOT NULL DEFAULT 'broker_recorded',
  source_reference text,
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  created_by_user_id text,
  updated_by_user_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, id)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_insurance_one_unknown_location
  ON public.insurance_locations(workspace_id) WHERE is_unknown;

CREATE TABLE IF NOT EXISTS public.insurance_risk_objects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.insurance_workspaces(id) ON DELETE CASCADE,
  workspace_asset_id uuid,
  object_type text NOT NULL,
  object_label text NOT NULL,
  use_description text,
  location_id uuid,
  classification_status text NOT NULL DEFAULT 'unconfirmed' CHECK (classification_status IN ('unconfirmed', 'human_confirmed', 'dismissed')),
  source_type text NOT NULL DEFAULT 'system_suggestion',
  source_reference text,
  confidence text CHECK (confidence IS NULL OR confidence IN ('low', 'medium', 'high')),
  extraction_method text NOT NULL DEFAULT 'deterministic_rule' CHECK (extraction_method IN ('manual', 'imported', 'deterministic_rule')),
  human_confirmed_by text,
  human_confirmed_at timestamptz,
  unresolved_question text,
  migration_source_key text,
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, id),
  UNIQUE (workspace_id, migration_source_key),
  FOREIGN KEY (workspace_id, workspace_asset_id) REFERENCES public.insurance_workspace_assets(workspace_id, id) ON DELETE CASCADE,
  FOREIGN KEY (workspace_id, location_id) REFERENCES public.insurance_locations(workspace_id, id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS public.insurance_exposures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.insurance_workspaces(id) ON DELETE CASCADE,
  exposure_type text NOT NULL,
  label text NOT NULL,
  description text,
  exposure_status text NOT NULL DEFAULT 'discovered'
    CHECK (exposure_status IN ('discovered', 'confirmed', 'dismissed_with_reason', 'information_required')),
  dismissal_reason text,
  source_type text NOT NULL DEFAULT 'broker_recorded',
  source_reference text,
  confidence text CHECK (confidence IS NULL OR confidence IN ('low', 'medium', 'high')),
  extraction_method text NOT NULL DEFAULT 'manual' CHECK (extraction_method IN ('manual', 'imported', 'deterministic_rule')),
  human_confirmed_by text,
  human_confirmed_at timestamptz,
  unresolved_question text,
  migration_source_key text,
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  created_by_user_id text,
  updated_by_user_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, id),
  UNIQUE (workspace_id, migration_source_key)
);

CREATE TABLE IF NOT EXISTS public.insurance_exposure_assets (
  workspace_id uuid NOT NULL REFERENCES public.insurance_workspaces(id) ON DELETE CASCADE,
  exposure_id uuid NOT NULL,
  workspace_asset_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (workspace_id, exposure_id, workspace_asset_id),
  FOREIGN KEY (workspace_id, exposure_id) REFERENCES public.insurance_exposures(workspace_id, id) ON DELETE CASCADE,
  FOREIGN KEY (workspace_id, workspace_asset_id) REFERENCES public.insurance_workspace_assets(workspace_id, id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS public.insurance_exposure_locations (
  workspace_id uuid NOT NULL REFERENCES public.insurance_workspaces(id) ON DELETE CASCADE,
  exposure_id uuid NOT NULL,
  location_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (workspace_id, exposure_id, location_id),
  FOREIGN KEY (workspace_id, exposure_id) REFERENCES public.insurance_exposures(workspace_id, id) ON DELETE CASCADE,
  FOREIGN KEY (workspace_id, location_id) REFERENCES public.insurance_locations(workspace_id, id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS public.insurance_exposure_parties (
  workspace_id uuid NOT NULL REFERENCES public.insurance_workspaces(id) ON DELETE CASCADE,
  exposure_id uuid NOT NULL,
  party_id uuid NOT NULL,
  relationship text,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (workspace_id, exposure_id, party_id),
  FOREIGN KEY (workspace_id, exposure_id) REFERENCES public.insurance_exposures(workspace_id, id) ON DELETE CASCADE,
  FOREIGN KEY (workspace_id, party_id) REFERENCES public.insurance_parties(workspace_id, id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS public.insurance_policies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.insurance_workspaces(id) ON DELETE CASCADE,
  insurer_name text,
  product_name text,
  policy_number text,
  policy_status text NOT NULL DEFAULT 'unknown' CHECK (policy_status IN ('unknown', 'current', 'expired', 'cancelled', 'draft')),
  inception_date date,
  effective_from date,
  effective_to date,
  renewal_date date,
  source_type text NOT NULL DEFAULT 'broker_recorded',
  source_reference text,
  evidence_status text NOT NULL DEFAULT 'not_supplied' CHECK (evidence_status IN ('not_supplied', 'referenced', 'verified')),
  human_confirmed_by text,
  human_confirmed_at timestamptz,
  unresolved_question text,
  migration_group_key text,
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  created_by_user_id text,
  updated_by_user_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, id),
  UNIQUE (workspace_id, migration_group_key)
);

CREATE TABLE IF NOT EXISTS public.insurance_policy_sections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.insurance_workspaces(id) ON DELETE CASCADE,
  policy_id uuid NOT NULL,
  canonical_cover_key text,
  actual_section_label text NOT NULL,
  section_number_reference text,
  wording_edition_reference text,
  section_status text NOT NULL DEFAULT 'unknown' CHECK (section_status IN ('unknown', 'current', 'excluded', 'not_taken', 'expired')),
  effective_from date,
  effective_to date,
  source_type text NOT NULL DEFAULT 'broker_recorded',
  source_reference text,
  human_confirmed_by text,
  human_confirmed_at timestamptz,
  unresolved_question text,
  migration_group_key text,
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  created_by_user_id text,
  updated_by_user_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, id),
  UNIQUE (workspace_id, migration_group_key),
  FOREIGN KEY (workspace_id, policy_id) REFERENCES public.insurance_policies(workspace_id, id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS public.insurance_schedule_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.insurance_workspaces(id) ON DELETE CASCADE,
  section_id uuid NOT NULL,
  item_reference text,
  item_label text NOT NULL,
  item_description text,
  treatment text NOT NULL DEFAULT 'unscheduled' CHECK (treatment IN ('individual', 'grouped', 'blanket', 'unscheduled')),
  effective_from date,
  effective_to date,
  source_type text NOT NULL DEFAULT 'broker_recorded',
  source_reference text,
  human_confirmed_by text,
  human_confirmed_at timestamptz,
  unresolved_question text,
  migration_source_key text,
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  created_by_user_id text,
  updated_by_user_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, id),
  UNIQUE (workspace_id, migration_source_key),
  FOREIGN KEY (workspace_id, section_id) REFERENCES public.insurance_policy_sections(workspace_id, id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS public.insurance_schedule_item_assets (
  workspace_id uuid NOT NULL REFERENCES public.insurance_workspaces(id) ON DELETE CASCADE,
  schedule_item_id uuid NOT NULL,
  workspace_asset_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (workspace_id, schedule_item_id, workspace_asset_id),
  FOREIGN KEY (workspace_id, schedule_item_id) REFERENCES public.insurance_schedule_items(workspace_id, id) ON DELETE CASCADE,
  FOREIGN KEY (workspace_id, workspace_asset_id) REFERENCES public.insurance_workspace_assets(workspace_id, id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS public.insurance_schedule_item_exposures (
  workspace_id uuid NOT NULL REFERENCES public.insurance_workspaces(id) ON DELETE CASCADE,
  schedule_item_id uuid NOT NULL,
  exposure_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (workspace_id, schedule_item_id, exposure_id),
  FOREIGN KEY (workspace_id, schedule_item_id) REFERENCES public.insurance_schedule_items(workspace_id, id) ON DELETE CASCADE,
  FOREIGN KEY (workspace_id, exposure_id) REFERENCES public.insurance_exposures(workspace_id, id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS public.insurance_schedule_item_locations (
  workspace_id uuid NOT NULL REFERENCES public.insurance_workspaces(id) ON DELETE CASCADE,
  schedule_item_id uuid NOT NULL,
  location_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (workspace_id, schedule_item_id, location_id),
  FOREIGN KEY (workspace_id, schedule_item_id) REFERENCES public.insurance_schedule_items(workspace_id, id) ON DELETE CASCADE,
  FOREIGN KEY (workspace_id, location_id) REFERENCES public.insurance_locations(workspace_id, id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS public.insurance_schedule_item_parties (
  workspace_id uuid NOT NULL REFERENCES public.insurance_workspaces(id) ON DELETE CASCADE,
  schedule_item_id uuid NOT NULL,
  party_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (workspace_id, schedule_item_id, party_id),
  FOREIGN KEY (workspace_id, schedule_item_id) REFERENCES public.insurance_schedule_items(workspace_id, id) ON DELETE CASCADE,
  FOREIGN KEY (workspace_id, party_id) REFERENCES public.insurance_parties(workspace_id, id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS public.insurance_cover_assessments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.insurance_workspaces(id) ON DELETE CASCADE,
  canonical_cover_key text,
  cover_label_snapshot text NOT NULL,
  catalogue_version text NOT NULL DEFAULT 'za-non-life-2026.07.1',
  exposure_status text NOT NULL DEFAULT 'discovered'
    CHECK (exposure_status IN ('discovered', 'confirmed', 'dismissed_with_reason', 'information_required')),
  current_cover_position text NOT NULL DEFAULT 'unknown'
    CHECK (current_cover_position IN ('unknown', 'not_recorded', 'confirmed_included', 'confirmed_excluded', 'not_applicable', 'covered_elsewhere')),
  placement_stage text NOT NULL DEFAULT 'not_assessed'
    CHECK (placement_stage IN ('not_assessed', 'area_to_consider', 'information_required', 'quote_requested', 'quoted', 'broker_recommended', 'client_accepted', 'client_declined', 'insurer_declined', 'not_taken', 'not_applicable')),
  system_suggestion_rule_id text,
  system_suggestion_rationale text,
  broker_rationale text,
  dismissal_reason text,
  source_type text NOT NULL DEFAULT 'broker_recorded',
  source_reference text,
  confidence text CHECK (confidence IS NULL OR confidence IN ('low', 'medium', 'high')),
  extraction_method text NOT NULL DEFAULT 'manual' CHECK (extraction_method IN ('manual', 'imported', 'deterministic_rule')),
  human_confirmed_by text,
  human_confirmed_at timestamptz,
  unresolved_question text,
  migration_source_key text,
  migration_payload_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  created_by_user_id text,
  updated_by_user_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, id),
  UNIQUE (workspace_id, migration_source_key)
);

CREATE INDEX IF NOT EXISTS idx_insurance_assessments_workspace_cover
  ON public.insurance_cover_assessments(workspace_id, canonical_cover_key, placement_stage);

CREATE TABLE IF NOT EXISTS public.insurance_assessment_assets (
  workspace_id uuid NOT NULL REFERENCES public.insurance_workspaces(id) ON DELETE CASCADE,
  assessment_id uuid NOT NULL,
  workspace_asset_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (workspace_id, assessment_id, workspace_asset_id),
  FOREIGN KEY (workspace_id, assessment_id) REFERENCES public.insurance_cover_assessments(workspace_id, id) ON DELETE CASCADE,
  FOREIGN KEY (workspace_id, workspace_asset_id) REFERENCES public.insurance_workspace_assets(workspace_id, id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS public.insurance_assessment_exposures (
  workspace_id uuid NOT NULL REFERENCES public.insurance_workspaces(id) ON DELETE CASCADE,
  assessment_id uuid NOT NULL,
  exposure_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (workspace_id, assessment_id, exposure_id),
  FOREIGN KEY (workspace_id, assessment_id) REFERENCES public.insurance_cover_assessments(workspace_id, id) ON DELETE CASCADE,
  FOREIGN KEY (workspace_id, exposure_id) REFERENCES public.insurance_exposures(workspace_id, id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS public.insurance_assessment_locations (
  workspace_id uuid NOT NULL REFERENCES public.insurance_workspaces(id) ON DELETE CASCADE,
  assessment_id uuid NOT NULL,
  location_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (workspace_id, assessment_id, location_id),
  FOREIGN KEY (workspace_id, assessment_id) REFERENCES public.insurance_cover_assessments(workspace_id, id) ON DELETE CASCADE,
  FOREIGN KEY (workspace_id, location_id) REFERENCES public.insurance_locations(workspace_id, id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS public.insurance_assessment_parties (
  workspace_id uuid NOT NULL REFERENCES public.insurance_workspaces(id) ON DELETE CASCADE,
  assessment_id uuid NOT NULL,
  party_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (workspace_id, assessment_id, party_id),
  FOREIGN KEY (workspace_id, assessment_id) REFERENCES public.insurance_cover_assessments(workspace_id, id) ON DELETE CASCADE,
  FOREIGN KEY (workspace_id, party_id) REFERENCES public.insurance_parties(workspace_id, id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS public.insurance_assessment_sections (
  workspace_id uuid NOT NULL REFERENCES public.insurance_workspaces(id) ON DELETE CASCADE,
  assessment_id uuid NOT NULL,
  section_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (workspace_id, assessment_id, section_id),
  FOREIGN KEY (workspace_id, assessment_id) REFERENCES public.insurance_cover_assessments(workspace_id, id) ON DELETE CASCADE,
  FOREIGN KEY (workspace_id, section_id) REFERENCES public.insurance_policy_sections(workspace_id, id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS public.insurance_assessment_schedule_items (
  workspace_id uuid NOT NULL REFERENCES public.insurance_workspaces(id) ON DELETE CASCADE,
  assessment_id uuid NOT NULL,
  schedule_item_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (workspace_id, assessment_id, schedule_item_id),
  FOREIGN KEY (workspace_id, assessment_id) REFERENCES public.insurance_cover_assessments(workspace_id, id) ON DELETE CASCADE,
  FOREIGN KEY (workspace_id, schedule_item_id) REFERENCES public.insurance_schedule_items(workspace_id, id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS public.insurance_cover_components (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.insurance_workspaces(id) ON DELETE CASCADE,
  assessment_id uuid NOT NULL,
  component_type text NOT NULL CHECK (component_type IN ('core_cover', 'extension', 'optional_benefit', 'exclusion', 'condition', 'warranty', 'endorsement')),
  component_key text,
  label text NOT NULL,
  selection_status text NOT NULL DEFAULT 'unknown'
    CHECK (selection_status IN ('unknown', 'not_recorded', 'confirmed_included', 'confirmed_excluded', 'not_applicable', 'covered_elsewhere')),
  territory text,
  effective_from date,
  effective_to date,
  conditions_notes text,
  source_type text NOT NULL DEFAULT 'broker_recorded',
  source_reference text,
  confidence text CHECK (confidence IS NULL OR confidence IN ('low', 'medium', 'high')),
  extraction_method text NOT NULL DEFAULT 'manual' CHECK (extraction_method IN ('manual', 'imported', 'deterministic_rule')),
  human_confirmed_by text,
  human_confirmed_at timestamptz,
  unresolved_question text,
  migration_source_key text,
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  created_by_user_id text,
  updated_by_user_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, id),
  UNIQUE (workspace_id, migration_source_key),
  FOREIGN KEY (workspace_id, assessment_id) REFERENCES public.insurance_cover_assessments(workspace_id, id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS public.insurance_financial_terms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.insurance_workspaces(id) ON DELETE CASCADE,
  assessment_id uuid,
  component_id uuid,
  schedule_item_id uuid,
  term_type text NOT NULL
    CHECK (term_type IN ('value', 'sum_insured', 'any_one_item_limit', 'any_one_event_limit', 'any_one_location_limit', 'any_one_conveyance_limit', 'any_one_claim_limit', 'annual_aggregate', 'first_loss_limit', 'catastrophe_limit', 'sublimit', 'basic_excess', 'additional_excess', 'percentage_excess', 'time_excess', 'coinsurance', 'average_indicator')),
  amount numeric(20,4),
  percentage numeric(9,6),
  time_value numeric(12,4),
  time_unit text CHECK (time_unit IS NULL OR time_unit IN ('hours', 'days')),
  currency char(3) NOT NULL DEFAULT 'ZAR',
  valuation_basis text,
  limit_type text,
  vat_basis text CHECK (vat_basis IS NULL OR vat_basis IN ('inclusive', 'exclusive', 'unknown', 'not_applicable')),
  valuation_date date,
  effective_from date,
  effective_to date,
  source_type text NOT NULL DEFAULT 'broker_recorded',
  source_reference text,
  confidence text CHECK (confidence IS NULL OR confidence IN ('low', 'medium', 'high')),
  extraction_method text NOT NULL DEFAULT 'manual' CHECK (extraction_method IN ('manual', 'imported', 'deterministic_rule')),
  human_confirmed_by text,
  human_confirmed_at timestamptz,
  unresolved_question text,
  migration_source_key text,
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  created_by_user_id text,
  updated_by_user_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, id),
  UNIQUE (workspace_id, migration_source_key),
  CHECK (amount IS NULL OR amount >= 0),
  CHECK (percentage IS NULL OR percentage >= 0),
  CHECK (time_value IS NULL OR time_value >= 0),
  CHECK (num_nonnulls(assessment_id, component_id, schedule_item_id) >= 1),
  FOREIGN KEY (workspace_id, assessment_id) REFERENCES public.insurance_cover_assessments(workspace_id, id) ON DELETE CASCADE,
  FOREIGN KEY (workspace_id, component_id) REFERENCES public.insurance_cover_components(workspace_id, id) ON DELETE CASCADE,
  FOREIGN KEY (workspace_id, schedule_item_id) REFERENCES public.insurance_schedule_items(workspace_id, id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS public.insurance_evidence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.insurance_workspaces(id) ON DELETE CASCADE,
  evidence_type text NOT NULL CHECK (evidence_type IN ('shared_photo', 'shared_document', 'policy_schedule', 'wording', 'endorsement', 'valuation', 'certificate', 'correspondence', 'other_reference')),
  label text NOT NULL,
  existing_shared_reference text,
  source_reference text,
  notes text,
  created_by_user_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, id)
);

CREATE TABLE IF NOT EXISTS public.insurance_evidence_links (
  workspace_id uuid NOT NULL REFERENCES public.insurance_workspaces(id) ON DELETE CASCADE,
  evidence_id uuid NOT NULL,
  entity_type text NOT NULL CHECK (entity_type IN ('party', 'location', 'risk_object', 'exposure', 'policy', 'section', 'schedule_item', 'assessment', 'component', 'financial_term', 'information_request')),
  entity_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (workspace_id, evidence_id, entity_type, entity_id),
  FOREIGN KEY (workspace_id, evidence_id) REFERENCES public.insurance_evidence(workspace_id, id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS public.insurance_information_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.insurance_workspaces(id) ON DELETE CASCADE,
  question text NOT NULL,
  reason text NOT NULL,
  related_entity_type text,
  related_entity_id uuid,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'sent_to_client', 'answered', 'resolved', 'not_applicable')),
  response text,
  source_type text NOT NULL DEFAULT 'broker_recorded',
  source_reference text,
  requested_by_user_id text NOT NULL,
  requested_at timestamptz NOT NULL DEFAULT now(),
  resolved_by_user_id text,
  resolved_at timestamptz,
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, id)
);

CREATE TABLE IF NOT EXISTS public.insurance_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.insurance_workspaces(id) ON DELETE CASCADE,
  note_type text NOT NULL CHECK (note_type IN ('private_broker', 'client_information_request', 'insurer_underwriter', 'report_visible')),
  related_entity_type text,
  related_entity_id uuid,
  body text NOT NULL,
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  created_by_user_id text NOT NULL,
  updated_by_user_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, id)
);

CREATE TABLE IF NOT EXISTS public.insurance_classification_suggestions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.insurance_workspaces(id) ON DELETE CASCADE,
  workspace_asset_id uuid,
  exposure_id uuid,
  suggested_risk_object_type text,
  suggested_cover_key text,
  rule_id text NOT NULL,
  rule_version text NOT NULL,
  rationale text NOT NULL,
  confidence text NOT NULL CHECK (confidence IN ('low', 'medium', 'high')),
  missing_questions jsonb NOT NULL DEFAULT '[]'::jsonb,
  input_hash text NOT NULL,
  generated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, workspace_asset_id, exposure_id, rule_id, suggested_cover_key, input_hash),
  FOREIGN KEY (workspace_id, workspace_asset_id) REFERENCES public.insurance_workspace_assets(workspace_id, id) ON DELETE CASCADE,
  FOREIGN KEY (workspace_id, exposure_id) REFERENCES public.insurance_exposures(workspace_id, id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS public.insurance_suggestion_decisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.insurance_workspaces(id) ON DELETE CASCADE,
  suggestion_id uuid NOT NULL REFERENCES public.insurance_classification_suggestions(id) ON DELETE CASCADE,
  decision text NOT NULL CHECK (decision IN ('accepted_for_assessment', 'dismissed_with_reason', 'information_required')),
  rationale text NOT NULL,
  decided_by_user_id text NOT NULL,
  decided_at timestamptz NOT NULL DEFAULT now(),
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  UNIQUE (workspace_id, suggestion_id)
);

ALTER TABLE public.insurance_report_snapshots
  ADD COLUMN IF NOT EXISTS payload_schema_version integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS source_snapshot_revision_id uuid REFERENCES public.insurance_snapshot_revisions(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS catalogue_version text;

-- Existing profile migration: segment and industry remain independent dimensions.
UPDATE public.insurance_workspaces
SET client_segments = CASE client_profile
    WHEN 'domestic' THEN ARRAY['domestic']::text[]
    WHEN 'unclassified' THEN ARRAY[]::text[]
    ELSE ARRAY['commercial']::text[]
  END,
  migration_profile_migrated_at = COALESCE(migration_profile_migrated_at, now())
WHERE migration_profile_migrated_at IS NULL;

INSERT INTO public.insurance_workspace_industries
  (workspace_id, industry_key, source_type, source_reference)
SELECT w.id,
  CASE w.client_profile
    WHEN 'agricultural' THEN 'agriculture_farming'
    WHEN 'transport' THEN 'transport_logistics'
    WHEN 'construction' THEN 'construction_engineering'
    WHEN 'industrial' THEN 'industrial_manufacturing'
    WHEN 'other' THEN 'other_specialist_referral'
  END,
  'migrated_existing',
  'insurance_workspaces.client_profile'
FROM public.insurance_workspaces w
WHERE w.client_profile IN ('agricultural', 'transport', 'construction', 'industrial', 'other')
ON CONFLICT (workspace_id, industry_key) DO NOTHING;

-- Preserve the original authorised share as immutable revision 1.
INSERT INTO public.insurance_snapshot_revisions
  (workspace_id, revision, source_share_id, source_snapshot_hash, source_generated_at,
   imported_at, imported_by_user_id, owner_authorisation_reference, asset_count, snapshot_json)
SELECT w.id, 1, w.source_lead_id, w.snapshot_hash, w.snapshot_generated_at,
       w.created_at, w.broker_user_id, 'existing-source-share:' || w.source_lead_id::text,
       w.asset_count,
       jsonb_build_object(
         'snapshotReference', w.snapshot_reference,
         'clientName', w.client_name,
         'assetCount', w.asset_count,
         'totalRegisterValue', w.total_register_value,
         'totalReplacementValue', w.total_replacement_value
       )
FROM public.insurance_workspaces w
ON CONFLICT (workspace_id, source_snapshot_hash) DO NOTHING;

INSERT INTO public.insurance_snapshot_assets
  (workspace_id, snapshot_revision_id, source_asset_key, title, snapshot_hash, snapshot_json)
SELECT a.workspace_id, r.id, a.source_asset_key, a.title, a.snapshot_hash, a.snapshot_json
FROM public.insurance_workspace_assets a
JOIN public.insurance_snapshot_revisions r
  ON r.workspace_id = a.workspace_id AND r.revision = 1
ON CONFLICT (snapshot_revision_id, source_asset_key) DO NOTHING;

-- Every workspace has an explicit unknown location; no repeated free-text assumption is required.
INSERT INTO public.insurance_locations
  (workspace_id, label, is_unknown, source_type, source_reference)
SELECT w.id, 'Unknown / not supplied', true, 'migrated_existing', 'current migration default'
FROM public.insurance_workspaces w
ON CONFLICT (workspace_id) WHERE is_unknown DO NOTHING;

-- Preserve each immutable source asset as a current risk object and physical-asset exposure.
INSERT INTO public.insurance_risk_objects
  (workspace_id, workspace_asset_id, object_type, object_label, use_description, location_id,
   classification_status, source_type, source_reference, extraction_method, migration_source_key)
SELECT a.workspace_id, a.id, COALESCE(NULLIF(a.category_key, ''), 'unclassified_physical_asset'), a.title,
       a.asset_kind_snapshot, l.id, 'unconfirmed', 'migrated_existing',
       'insurance_workspace_assets:' || a.id::text, 'imported', 'workspace-asset:' || a.id::text
FROM public.insurance_workspace_assets a
JOIN public.insurance_locations l ON l.workspace_id = a.workspace_id AND l.is_unknown
ON CONFLICT (workspace_id, migration_source_key) DO NOTHING;

INSERT INTO public.insurance_exposures
  (workspace_id, exposure_type, label, description, exposure_status, source_type,
   source_reference, extraction_method, migration_source_key)
SELECT a.workspace_id, 'physical_asset', a.title, a.asset_kind_snapshot, 'discovered',
       'migrated_existing', 'insurance_workspace_assets:' || a.id::text,
       'imported', 'workspace-asset:' || a.id::text
FROM public.insurance_workspace_assets a
ON CONFLICT (workspace_id, migration_source_key) DO NOTHING;

INSERT INTO public.insurance_exposure_assets (workspace_id, exposure_id, workspace_asset_id)
SELECT e.workspace_id, e.id, a.id
FROM public.insurance_exposures e
JOIN public.insurance_workspace_assets a
  ON a.workspace_id = e.workspace_id AND e.migration_source_key = 'workspace-asset:' || a.id::text
ON CONFLICT DO NOTHING;

-- Group repeated existing policy facts only when insurer or policy number was actually supplied.
INSERT INTO public.insurance_policies
  (workspace_id, insurer_name, policy_number, policy_status, renewal_date, source_type,
   source_reference, human_confirmed_by, human_confirmed_at, migration_group_key)
SELECT DISTINCT a.workspace_id, NULLIF(trim(r.insurer_name), ''), NULLIF(trim(r.policy_number), ''),
       'unknown', r.renewal_date, 'migrated_existing', 'insurance_asset_reviews',
       r.reviewed_by_user_id, r.reviewed_at,
       md5(a.workspace_id::text || '|' || lower(COALESCE(NULLIF(trim(r.insurer_name), ''), '')) || '|' || lower(COALESCE(NULLIF(trim(r.policy_number), ''), '')))
FROM public.insurance_asset_reviews r
JOIN public.insurance_workspace_assets a ON a.id = r.workspace_asset_id
WHERE NULLIF(trim(r.insurer_name), '') IS NOT NULL OR NULLIF(trim(r.policy_number), '') IS NOT NULL
ON CONFLICT (workspace_id, migration_group_key) DO NOTHING;

INSERT INTO public.insurance_policy_sections
  (workspace_id, policy_id, canonical_cover_key, actual_section_label, section_status,
   source_type, source_reference, human_confirmed_by, human_confirmed_at, migration_group_key)
SELECT DISTINCT a.workspace_id, p.id, NULLIF(trim(r.policy_section_key), ''),
       COALESCE(NULLIF(trim(r.policy_section_label), ''), NULLIF(trim(r.policy_section_key), ''), 'Section not recorded'),
       'unknown', 'migrated_existing', 'insurance_asset_reviews', r.reviewed_by_user_id, r.reviewed_at,
       md5(p.id::text || '|' || lower(COALESCE(NULLIF(trim(r.policy_section_label), ''), NULLIF(trim(r.policy_section_key), ''), 'section-not-recorded')))
FROM public.insurance_asset_reviews r
JOIN public.insurance_workspace_assets a ON a.id = r.workspace_asset_id
JOIN public.insurance_policies p
  ON p.workspace_id = a.workspace_id
 AND p.migration_group_key = md5(a.workspace_id::text || '|' || lower(COALESCE(NULLIF(trim(r.insurer_name), ''), '')) || '|' || lower(COALESCE(NULLIF(trim(r.policy_number), ''), '')))
ON CONFLICT (workspace_id, migration_group_key) DO NOTHING;

INSERT INTO public.insurance_schedule_items
  (workspace_id, section_id, item_label, item_description, treatment, source_type,
   source_reference, human_confirmed_by, human_confirmed_at, migration_source_key)
SELECT a.workspace_id, s.id, a.title, r.schedule_description,
       CASE r.scheduling_treatment
         WHEN 'individual' THEN 'individual'
         WHEN 'grouped' THEN 'grouped'
         WHEN 'blanket' THEN 'blanket'
         ELSE 'unscheduled'
       END,
       'migrated_existing', 'insurance_asset_reviews:' || r.id::text,
       r.reviewed_by_user_id, r.reviewed_at, 'asset-review:' || r.id::text
FROM public.insurance_asset_reviews r
JOIN public.insurance_workspace_assets a ON a.id = r.workspace_asset_id
JOIN public.insurance_policies p
  ON p.workspace_id = a.workspace_id
 AND p.migration_group_key = md5(a.workspace_id::text || '|' || lower(COALESCE(NULLIF(trim(r.insurer_name), ''), '')) || '|' || lower(COALESCE(NULLIF(trim(r.policy_number), ''), '')))
JOIN public.insurance_policy_sections s
  ON s.workspace_id = a.workspace_id
 AND s.policy_id = p.id
 AND s.migration_group_key = md5(p.id::text || '|' || lower(COALESCE(NULLIF(trim(r.policy_section_label), ''), NULLIF(trim(r.policy_section_key), ''), 'section-not-recorded')))
ON CONFLICT (workspace_id, migration_source_key) DO NOTHING;

INSERT INTO public.insurance_schedule_item_assets (workspace_id, schedule_item_id, workspace_asset_id)
SELECT a.workspace_id, si.id, a.id
FROM public.insurance_asset_reviews r
JOIN public.insurance_workspace_assets a ON a.id = r.workspace_asset_id
JOIN public.insurance_schedule_items si
  ON si.workspace_id = a.workspace_id AND si.migration_source_key = 'asset-review:' || r.id::text
ON CONFLICT DO NOTHING;

-- Asset-level existing decisions are preserved as migrated assessments without fabricating a canonical cover.
INSERT INTO public.insurance_cover_assessments
  (workspace_id, canonical_cover_key, cover_label_snapshot, exposure_status, current_cover_position,
   placement_stage, broker_rationale, source_type, source_reference, extraction_method,
   human_confirmed_by, human_confirmed_at, migration_source_key, migration_payload_json)
SELECT a.workspace_id, NULL, 'Migrated asset review: ' || a.title,
       CASE WHEN r.information_required_note IS NOT NULL THEN 'information_required' ELSE 'discovered' END,
       CASE
         WHEN r.current_insurance_status = 'insured' AND r.reviewed_by_user_id IS NOT NULL THEN 'confirmed_included'
         WHEN r.current_insurance_status = 'not_insured' AND r.reviewed_by_user_id IS NOT NULL THEN 'confirmed_excluded'
         WHEN r.current_insurance_status = 'not_applicable' THEN 'not_applicable'
         WHEN r.current_insurance_status = 'covered_elsewhere' THEN 'covered_elsewhere'
         WHEN r.current_insurance_status = 'not_insured' THEN 'not_recorded'
         ELSE 'unknown'
       END,
       CASE
         WHEN r.recommendation_status = 'include' AND r.reviewed_by_user_id IS NOT NULL THEN 'broker_recommended'
         WHEN r.recommendation_status = 'information_required' THEN 'information_required'
         WHEN r.recommendation_status = 'not_applicable' THEN 'not_applicable'
         WHEN r.recommendation_status = 'exclude' THEN 'not_taken'
         ELSE 'not_assessed'
       END,
       r.recommendation_note,
       'migrated_existing', 'insurance_asset_reviews:' || r.id::text, 'imported',
       r.reviewed_by_user_id, r.reviewed_at, 'asset-review:' || r.id::text,
       to_jsonb(r)
FROM public.insurance_asset_reviews r
JOIN public.insurance_workspace_assets a ON a.id = r.workspace_asset_id
ON CONFLICT (workspace_id, migration_source_key) DO NOTHING;

INSERT INTO public.insurance_assessment_assets (workspace_id, assessment_id, workspace_asset_id)
SELECT a.workspace_id, ca.id, a.id
FROM public.insurance_asset_reviews r
JOIN public.insurance_workspace_assets a ON a.id = r.workspace_asset_id
JOIN public.insurance_cover_assessments ca
  ON ca.workspace_id = a.workspace_id AND ca.migration_source_key = 'asset-review:' || r.id::text
ON CONFLICT DO NOTHING;

INSERT INTO public.insurance_assessment_schedule_items (workspace_id, assessment_id, schedule_item_id)
SELECT ca.workspace_id, ca.id, si.id
FROM public.insurance_cover_assessments ca
JOIN public.insurance_schedule_items si
  ON si.workspace_id = ca.workspace_id
 AND replace(si.migration_source_key, 'asset-review:', '') = replace(ca.migration_source_key, 'asset-review:', '')
WHERE ca.migration_source_key LIKE 'asset-review:%'
ON CONFLICT DO NOTHING;

INSERT INTO public.insurance_cover_components
  (workspace_id, assessment_id, component_type, component_key, label, selection_status,
   conditions_notes, source_type, source_reference, extraction_method, human_confirmed_by,
   human_confirmed_at, migration_source_key)
SELECT a.workspace_id, ca.id, 'optional_benefit', o.option_key, o.option_label_snapshot,
       CASE o.option_status
         WHEN 'included' THEN CASE WHEN o.updated_by_user_id IS NOT NULL THEN 'confirmed_included' ELSE 'unknown' END
         WHEN 'excluded' THEN CASE WHEN o.updated_by_user_id IS NOT NULL THEN 'confirmed_excluded' ELSE 'unknown' END
         WHEN 'not_applicable' THEN 'not_applicable'
         ELSE 'unknown'
       END,
       concat_ws(E'\n', NULLIF(o.note, ''), CASE WHEN o.exclusion_reason_key IS NOT NULL THEN 'Migrated reason: ' || o.exclusion_reason_key END),
       'migrated_existing', 'insurance_asset_option_reviews:' || o.id::text, 'imported',
       o.updated_by_user_id, o.updated_at, 'asset-option:' || o.id::text
FROM public.insurance_asset_option_reviews o
JOIN public.insurance_asset_reviews r ON r.id = o.asset_review_id
JOIN public.insurance_workspace_assets a ON a.id = r.workspace_asset_id
JOIN public.insurance_cover_assessments ca
  ON ca.workspace_id = a.workspace_id AND ca.migration_source_key = 'asset-review:' || r.id::text
ON CONFLICT (workspace_id, migration_source_key) DO NOTHING;

INSERT INTO public.insurance_financial_terms
  (workspace_id, assessment_id, schedule_item_id, term_type, amount, currency, valuation_basis,
   vat_basis, source_type, source_reference, extraction_method, human_confirmed_by,
   human_confirmed_at, migration_source_key)
SELECT a.workspace_id, ca.id, si.id, 'sum_insured', r.sum_insured, 'ZAR', r.cover_basis,
       COALESCE(r.vat_basis, 'unknown'), 'migrated_existing',
       'insurance_asset_reviews.sum_insured:' || r.id::text, 'imported',
       r.reviewed_by_user_id, r.reviewed_at, 'asset-review-sum-insured:' || r.id::text
FROM public.insurance_asset_reviews r
JOIN public.insurance_workspace_assets a ON a.id = r.workspace_asset_id
JOIN public.insurance_cover_assessments ca
  ON ca.workspace_id = a.workspace_id AND ca.migration_source_key = 'asset-review:' || r.id::text
LEFT JOIN public.insurance_schedule_items si
  ON si.workspace_id = a.workspace_id AND si.migration_source_key = 'asset-review:' || r.id::text
WHERE r.sum_insured IS NOT NULL
ON CONFLICT (workspace_id, migration_source_key) DO NOTHING;

-- Preserve existing general-cover decisions as canonical current assessments where a safe mapping exists.
INSERT INTO public.insurance_cover_assessments
  (workspace_id, canonical_cover_key, cover_label_snapshot, exposure_status, current_cover_position,
   placement_stage, broker_rationale, source_type, source_reference, extraction_method,
   human_confirmed_by, human_confirmed_at, migration_source_key, migration_payload_json)
SELECT g.workspace_id,
       CASE g.cover_key
         WHEN 'public_liability' THEN 'public_liability'
         WHEN 'employers_liability' THEN 'employers_liability'
         WHEN 'business_interruption' THEN 'business_interruption'
         WHEN 'money' THEN 'money'
         WHEN 'fidelity' THEN 'fidelity_commercial_crime'
         WHEN 'goods_in_transit' THEN 'goods_in_transit'
         WHEN 'personal_liability' THEN 'personal_liability_extended'
         WHEN 'personal_accident' THEN 'personal_accident'
         ELSE NULL
       END,
       g.cover_label_snapshot, 'discovered',
       CASE g.cover_status
         WHEN 'included' THEN CASE WHEN g.reviewed_by_user_id IS NOT NULL THEN 'confirmed_included' ELSE 'unknown' END
         WHEN 'excluded' THEN CASE WHEN g.reviewed_by_user_id IS NOT NULL THEN 'confirmed_excluded' ELSE 'unknown' END
         WHEN 'not_applicable' THEN 'not_applicable'
         ELSE 'unknown'
       END,
       CASE g.recommendation_status
         WHEN 'include' THEN CASE WHEN g.reviewed_by_user_id IS NOT NULL THEN 'broker_recommended' ELSE 'not_assessed' END
         WHEN 'information_required' THEN 'information_required'
         WHEN 'not_applicable' THEN 'not_applicable'
         WHEN 'exclude' THEN 'not_taken'
         ELSE 'not_assessed'
       END,
       concat_ws(E'\n', NULLIF(g.recommendation_note, ''), NULLIF(g.notes, '')),
       'migrated_existing', 'insurance_general_cover_reviews:' || g.id::text, 'imported',
       g.reviewed_by_user_id, g.reviewed_at, 'general-cover:' || g.id::text, to_jsonb(g)
FROM public.insurance_general_cover_reviews g
ON CONFLICT (workspace_id, migration_source_key) DO NOTHING;

INSERT INTO public.insurance_financial_terms
  (workspace_id, assessment_id, term_type, amount, currency, source_type, source_reference,
   extraction_method, human_confirmed_by, human_confirmed_at, migration_source_key)
SELECT g.workspace_id, ca.id, 'any_one_event_limit', g.limit_amount, 'ZAR',
       'migrated_existing', 'insurance_general_cover_reviews.limit_amount:' || g.id::text,
       'imported', g.reviewed_by_user_id, g.reviewed_at, 'general-cover-limit:' || g.id::text
FROM public.insurance_general_cover_reviews g
JOIN public.insurance_cover_assessments ca
  ON ca.workspace_id = g.workspace_id AND ca.migration_source_key = 'general-cover:' || g.id::text
WHERE g.limit_amount IS NOT NULL
ON CONFLICT (workspace_id, migration_source_key) DO NOTHING;

-- Existing report payloads remain unchanged and are explicitly marked as previous schema.
UPDATE public.insurance_report_snapshots
SET catalogue_version = COALESCE(catalogue_version, 'existing-unversioned')
WHERE catalogue_version IS NULL;

-- Report snapshots are append-only. Workspace/share deletion may still cascade intentionally.
CREATE OR REPLACE FUNCTION public.prevent_insurance_report_snapshot_update()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'insurance report snapshots are immutable';
END $$;

DROP TRIGGER IF EXISTS trg_prevent_insurance_report_snapshot_update ON public.insurance_report_snapshots;
CREATE TRIGGER trg_prevent_insurance_report_snapshot_update
BEFORE UPDATE ON public.insurance_report_snapshots
FOR EACH ROW EXECUTE FUNCTION public.prevent_insurance_report_snapshot_update();

CREATE INDEX IF NOT EXISTS idx_insurance_locations_workspace ON public.insurance_locations(workspace_id, is_unknown, label);
CREATE INDEX IF NOT EXISTS idx_insurance_exposures_workspace ON public.insurance_exposures(workspace_id, exposure_status, exposure_type);
CREATE INDEX IF NOT EXISTS idx_insurance_policies_workspace ON public.insurance_policies(workspace_id, policy_status, effective_to);
CREATE INDEX IF NOT EXISTS idx_insurance_sections_workspace ON public.insurance_policy_sections(workspace_id, policy_id, section_status);
CREATE INDEX IF NOT EXISTS idx_insurance_schedule_items_workspace ON public.insurance_schedule_items(workspace_id, section_id, treatment);
CREATE INDEX IF NOT EXISTS idx_insurance_information_requests_workspace ON public.insurance_information_requests(workspace_id, status, requested_at DESC);
CREATE INDEX IF NOT EXISTS idx_insurance_notes_workspace ON public.insurance_notes(workspace_id, note_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_insurance_suggestions_workspace ON public.insurance_classification_suggestions(workspace_id, workspace_asset_id, generated_at DESC);
CREATE INDEX IF NOT EXISTS idx_insurance_snapshot_assets_revision ON public.insurance_snapshot_assets(snapshot_revision_id, source_asset_key);
