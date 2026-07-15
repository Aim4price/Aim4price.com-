-- Broker-owned insurance review workspaces created from immutable shared-register snapshots.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.insurance_workspaces (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_lead_id uuid NOT NULL UNIQUE REFERENCES public.asset_leads(id) ON DELETE CASCADE,
  owner_user_id text NOT NULL,
  broker_user_id text NOT NULL,
  client_profile text NOT NULL DEFAULT 'unclassified'
    CHECK (client_profile IN ('unclassified', 'domestic', 'commercial', 'agricultural', 'transport', 'construction', 'industrial', 'other')),
  review_status text NOT NULL DEFAULT 'not_started'
    CHECK (review_status IN ('not_started', 'in_progress', 'completed')),
  snapshot_generated_at timestamptz,
  snapshot_reference text NOT NULL,
  snapshot_hash text NOT NULL,
  client_name text NOT NULL,
  client_meta text,
  client_logo_url text,
  owner_message text,
  asset_count integer NOT NULL DEFAULT 0 CHECK (asset_count >= 0),
  total_register_value numeric(16,2) NOT NULL DEFAULT 0,
  total_replacement_value numeric(16,2) NOT NULL DEFAULT 0,
  last_reviewed_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_insurance_workspaces_broker_status
  ON public.insurance_workspaces(broker_user_id, review_status, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_insurance_workspaces_owner
  ON public.insurance_workspaces(owner_user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.insurance_workspace_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.insurance_workspaces(id) ON DELETE CASCADE,
  source_asset_key text NOT NULL,
  source_asset_id text,
  sort_order integer NOT NULL DEFAULT 0,
  title text NOT NULL,
  asset_kind_snapshot text,
  category_key text NOT NULL DEFAULT 'other',
  location_text text,
  register_value numeric(16,2) NOT NULL DEFAULT 0,
  replacement_value numeric(16,2) NOT NULL DEFAULT 0,
  main_photo_url text,
  snapshot_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  snapshot_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, source_asset_key)
);

CREATE INDEX IF NOT EXISTS idx_insurance_workspace_assets_workspace_order
  ON public.insurance_workspace_assets(workspace_id, sort_order, title);
CREATE INDEX IF NOT EXISTS idx_insurance_workspace_assets_category
  ON public.insurance_workspace_assets(workspace_id, category_key);

CREATE TABLE IF NOT EXISTS public.insurance_asset_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_asset_id uuid NOT NULL UNIQUE REFERENCES public.insurance_workspace_assets(id) ON DELETE CASCADE,
  category_key text NOT NULL DEFAULT 'other',
  current_insurance_status text NOT NULL DEFAULT 'unknown'
    CHECK (current_insurance_status IN ('insured', 'not_insured', 'unknown', 'not_applicable', 'covered_elsewhere')),
  insurer_name text,
  policy_number text,
  policy_section_key text,
  policy_section_label text,
  schedule_description text,
  renewal_date date,
  cover_basis text,
  sum_insured numeric(16,2),
  vat_basis text CHECK (vat_basis IS NULL OR vat_basis IN ('inclusive', 'exclusive', 'unknown')),
  excess_text text,
  scheduling_treatment text CHECK (scheduling_treatment IS NULL OR scheduling_treatment IN ('individual', 'grouped', 'blanket', 'not_applicable')),
  special_conditions text,
  recommendation_status text NOT NULL DEFAULT 'review'
    CHECK (recommendation_status IN ('review', 'include', 'exclude', 'information_required', 'not_applicable')),
  recommendation_reason_key text,
  recommendation_note text,
  information_required_note text,
  review_status text NOT NULL DEFAULT 'not_started'
    CHECK (review_status IN ('not_started', 'in_progress', 'completed')),
  reviewed_by_user_id text,
  reviewed_at timestamptz,
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_insurance_asset_reviews_status
  ON public.insurance_asset_reviews(review_status, updated_at DESC);

CREATE TABLE IF NOT EXISTS public.insurance_asset_option_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_review_id uuid NOT NULL REFERENCES public.insurance_asset_reviews(id) ON DELETE CASCADE,
  option_key text NOT NULL,
  option_label_snapshot text NOT NULL,
  option_status text NOT NULL DEFAULT 'unknown'
    CHECK (option_status IN ('included', 'excluded', 'unknown', 'not_applicable')),
  exclusion_reason_key text,
  note text,
  amount_value numeric(16,2),
  text_value text,
  updated_by_user_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (asset_review_id, option_key)
);

CREATE TABLE IF NOT EXISTS public.insurance_general_cover_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.insurance_workspaces(id) ON DELETE CASCADE,
  cover_key text NOT NULL,
  cover_label_snapshot text NOT NULL,
  cover_status text NOT NULL DEFAULT 'unknown'
    CHECK (cover_status IN ('included', 'excluded', 'unknown', 'not_applicable')),
  insurer_name text,
  policy_number text,
  policy_section_label text,
  limit_amount numeric(16,2),
  exclusion_reason_key text,
  recommendation_status text NOT NULL DEFAULT 'review'
    CHECK (recommendation_status IN ('review', 'include', 'exclude', 'information_required', 'not_applicable')),
  recommendation_note text,
  notes text,
  reviewed_by_user_id text,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, cover_key)
);

CREATE TABLE IF NOT EXISTS public.insurance_review_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.insurance_workspaces(id) ON DELETE CASCADE,
  actor_user_id text NOT NULL,
  entity_type text NOT NULL,
  entity_id text,
  action text NOT NULL,
  before_json jsonb,
  after_json jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_insurance_review_events_workspace
  ON public.insurance_review_events(workspace_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.insurance_report_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.insurance_workspaces(id) ON DELETE CASCADE,
  report_type text NOT NULL CHECK (report_type IN ('summary', 'detailed')),
  revision integer NOT NULL CHECK (revision > 0),
  report_reference text NOT NULL,
  filename text NOT NULL,
  payload_json jsonb NOT NULL,
  generated_by_user_id text NOT NULL,
  generated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, report_type, revision)
);

CREATE INDEX IF NOT EXISTS idx_insurance_report_snapshots_workspace
  ON public.insurance_report_snapshots(workspace_id, generated_at DESC);
