-- Migration 81: fail-closed upload reference tracking.
--
-- This migration deliberately keeps every upload in PostgreSQL mode. It does
-- not contact an object bucket, move bytes, delete bytes, or release migration
-- holds. A later, separately reviewed rollout may release those holds only
-- after public.asset_upload_reference_ledger_ready() reports true.

BEGIN;

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '5min';

-- Migration 80 must be present before a reference ledger can protect its
-- object purge queue. Fail rather than silently installing a partial guard.
DO $preflight$
DECLARE
  upload_id_type text;
BEGIN
  IF to_regclass('public.asset_register_uploads') IS NULL THEN
    RAISE EXCEPTION 'migration 81 requires public.asset_register_uploads';
  END IF;

  SELECT a.atttypid::regtype::text
    INTO upload_id_type
  FROM pg_catalog.pg_attribute AS a
  WHERE a.attrelid = 'public.asset_register_uploads'::regclass
    AND a.attname = 'id'
    AND a.attnum > 0
    AND NOT a.attisdropped;

  IF upload_id_type IS DISTINCT FROM 'text' THEN
    RAISE EXCEPTION
      'migration 81 requires public.asset_register_uploads.id to be text (found %)',
      COALESCE(upload_id_type, '<missing>');
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_constraint AS c
    WHERE c.conrelid = 'public.asset_register_uploads'::regclass
      AND c.contype IN ('p', 'u')
      AND c.conkey = ARRAY[
        (
          SELECT a.attnum
          FROM pg_catalog.pg_attribute AS a
          WHERE a.attrelid = 'public.asset_register_uploads'::regclass
            AND a.attname = 'id'
            AND a.attnum > 0
            AND NOT a.attisdropped
        )
      ]::smallint[]
  ) THEN
    RAISE EXCEPTION
      'migration 81 requires a single-column unique or primary-key constraint on asset_register_uploads.id';
  END IF;

  IF to_regclass('public.asset_upload_object_purge_queue') IS NULL
     OR NOT EXISTS (
       SELECT 1
       FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name = 'asset_register_uploads'
         AND column_name = 'storage_state'
     )
     OR NOT EXISTS (
       SELECT 1
       FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name = 'asset_register_uploads'
         AND column_name = 'object_key'
     )
     OR NOT EXISTS (
       SELECT 1
       FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name = 'asset_register_uploads'
         AND column_name = 'deleted_at'
     )
     OR NOT EXISTS (
       SELECT 1
       FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name = 'asset_register_uploads'
         AND column_name = 'purge_after'
     ) THEN
    RAISE EXCEPTION
      'migration 81 requires migration 80 (storage metadata and object purge queue)';
  END IF;
END
$preflight$;

-- Prevent uploads from appearing between the initial hold population and the
-- installation of the new-upload trigger. Reads remain available. A busy
-- table makes the migration fail after lock_timeout instead of waiting.
LOCK TABLE public.asset_register_uploads IN SHARE ROW EXCLUSIVE MODE;

CREATE TABLE IF NOT EXISTS public.asset_upload_references (
  upload_id text NOT NULL,
  source_schema text NOT NULL,
  source_table text NOT NULL,
  source_key text NOT NULL,
  reference_kind text NOT NULL DEFAULT 'source',
  expires_at timestamptz,
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT asset_upload_references_pkey
    PRIMARY KEY (source_schema, source_table, source_key, upload_id),
  CONSTRAINT asset_upload_references_upload_fk
    FOREIGN KEY (upload_id)
    REFERENCES public.asset_register_uploads(id)
    ON DELETE NO ACTION
    DEFERRABLE INITIALLY DEFERRED,
  CONSTRAINT asset_upload_references_kind_check
    CHECK (reference_kind IN ('source', 'pending', 'migration_hold', 'legacy_orphan_hold')),
  CONSTRAINT asset_upload_references_expiry_check
    CHECK (
      (reference_kind IN ('source', 'migration_hold') AND expires_at IS NULL)
      OR
      (reference_kind IN ('pending', 'legacy_orphan_hold') AND expires_at IS NOT NULL)
    )
);

-- IF NOT EXISTS makes a normal rerun harmless; the validation block below
-- refuses an incompatible table that merely happens to use this name.
CREATE INDEX IF NOT EXISTS asset_upload_references_upload_idx
  ON public.asset_upload_references (upload_id);

CREATE INDEX IF NOT EXISTS asset_upload_references_expiry_idx
  ON public.asset_upload_references (expires_at)
  WHERE expires_at IS NOT NULL;

DO $validate_ledger$
DECLARE
  invalid_column text;
  kind_definition text;
  expiry_definition text;
BEGIN
  SELECT expected.column_name
    INTO invalid_column
  FROM (
    VALUES
      ('upload_id', 'text', 'NO'),
      ('source_schema', 'text', 'NO'),
      ('source_table', 'text', 'NO'),
      ('source_key', 'text', 'NO'),
      ('reference_kind', 'text', 'NO'),
      ('expires_at', 'timestamp with time zone', 'YES'),
      ('first_seen_at', 'timestamp with time zone', 'NO'),
      ('last_seen_at', 'timestamp with time zone', 'NO')
  ) AS expected(column_name, data_type, is_nullable)
  LEFT JOIN information_schema.columns AS actual
    ON actual.table_schema = 'public'
   AND actual.table_name = 'asset_upload_references'
   AND actual.column_name = expected.column_name
  WHERE actual.column_name IS NULL
     OR actual.data_type <> expected.data_type
     OR actual.is_nullable <> expected.is_nullable
  LIMIT 1;

  IF invalid_column IS NOT NULL THEN
    RAISE EXCEPTION
      'public.asset_upload_references has an incompatible or missing column: %',
      invalid_column;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_constraint AS c
    WHERE c.conrelid = 'public.asset_upload_references'::regclass
      AND c.contype = 'p'
      AND c.conkey = ARRAY[
        (SELECT attnum FROM pg_catalog.pg_attribute WHERE attrelid = c.conrelid AND attname = 'source_schema'),
        (SELECT attnum FROM pg_catalog.pg_attribute WHERE attrelid = c.conrelid AND attname = 'source_table'),
        (SELECT attnum FROM pg_catalog.pg_attribute WHERE attrelid = c.conrelid AND attname = 'source_key'),
        (SELECT attnum FROM pg_catalog.pg_attribute WHERE attrelid = c.conrelid AND attname = 'upload_id')
      ]::smallint[]
  ) THEN
    RAISE EXCEPTION 'asset_upload_references requires its expected composite primary key';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_constraint AS c
    WHERE c.conrelid = 'public.asset_upload_references'::regclass
      AND c.confrelid = 'public.asset_register_uploads'::regclass
      AND c.contype = 'f'
      AND c.condeferrable
      AND c.condeferred
      AND c.confdeltype = 'a'
      AND c.conkey = ARRAY[
        (SELECT attnum FROM pg_catalog.pg_attribute WHERE attrelid = c.conrelid AND attname = 'upload_id')
      ]::smallint[]
      AND c.confkey = ARRAY[
        (SELECT attnum FROM pg_catalog.pg_attribute WHERE attrelid = c.confrelid AND attname = 'id')
      ]::smallint[]
  ) THEN
    RAISE EXCEPTION
      'asset_upload_references.upload_id requires a deferred NO ACTION foreign key';
  END IF;

  SELECT pg_catalog.pg_get_expr(c.conbin, c.conrelid)
    INTO kind_definition
  FROM pg_catalog.pg_constraint AS c
  WHERE c.conrelid = 'public.asset_upload_references'::regclass
    AND c.conname = 'asset_upload_references_kind_check'
    AND c.contype = 'c'
    AND c.convalidated;

  IF kind_definition IS NULL
     OR position('source' IN kind_definition) = 0
     OR position('pending' IN kind_definition) = 0
     OR position('migration_hold' IN kind_definition) = 0
     OR position('legacy_orphan_hold' IN kind_definition) = 0 THEN
    RAISE EXCEPTION 'asset_upload_references has an incompatible kind constraint';
  END IF;

  SELECT pg_catalog.pg_get_expr(c.conbin, c.conrelid)
    INTO expiry_definition
  FROM pg_catalog.pg_constraint AS c
  WHERE c.conrelid = 'public.asset_upload_references'::regclass
    AND c.conname = 'asset_upload_references_expiry_check'
    AND c.contype = 'c'
    AND c.convalidated;

  IF expiry_definition IS NULL
     OR position('reference_kind' IN expiry_definition) = 0
     OR position('expires_at' IN expiry_definition) = 0
     OR position('migration_hold' IN expiry_definition) = 0
     OR position('legacy_orphan_hold' IN expiry_definition) = 0 THEN
    RAISE EXCEPTION 'asset_upload_references has an incompatible expiry constraint';
  END IF;
END
$validate_ledger$;

CREATE TABLE IF NOT EXISTS public.asset_upload_reference_sources (
  source_schema text NOT NULL,
  source_table text NOT NULL,
  key_column text NOT NULL,
  required boolean NOT NULL DEFAULT true,
  trigger_installed_at timestamptz,
  backfilled_at timestamptz,
  verified_at timestamptz,
  CONSTRAINT asset_upload_reference_sources_pkey
    PRIMARY KEY (source_schema, source_table)
);

CREATE TABLE IF NOT EXISTS public.asset_upload_reference_rollout (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
  holds_initialized_at timestamptz,
  backfill_completed_at timestamptz,
  holds_released_at timestamptz
);

INSERT INTO public.asset_upload_reference_rollout (singleton)
VALUES (true)
ON CONFLICT (singleton) DO NOTHING;

DO $validate_control_tables$
DECLARE
  invalid_column text;
BEGIN
  SELECT expected.table_name || '.' || expected.column_name
    INTO invalid_column
  FROM (
    VALUES
      ('asset_upload_reference_sources', 'source_schema', 'text', 'NO'),
      ('asset_upload_reference_sources', 'source_table', 'text', 'NO'),
      ('asset_upload_reference_sources', 'key_column', 'text', 'NO'),
      ('asset_upload_reference_sources', 'required', 'boolean', 'NO'),
      ('asset_upload_reference_sources', 'trigger_installed_at', 'timestamp with time zone', 'YES'),
      ('asset_upload_reference_sources', 'backfilled_at', 'timestamp with time zone', 'YES'),
      ('asset_upload_reference_sources', 'verified_at', 'timestamp with time zone', 'YES'),
      ('asset_upload_reference_rollout', 'singleton', 'boolean', 'NO'),
      ('asset_upload_reference_rollout', 'holds_initialized_at', 'timestamp with time zone', 'YES'),
      ('asset_upload_reference_rollout', 'backfill_completed_at', 'timestamp with time zone', 'YES'),
      ('asset_upload_reference_rollout', 'holds_released_at', 'timestamp with time zone', 'YES')
  ) AS expected(table_name, column_name, data_type, is_nullable)
  LEFT JOIN information_schema.columns AS actual
    ON actual.table_schema = 'public'
   AND actual.table_name = expected.table_name
   AND actual.column_name = expected.column_name
  WHERE actual.column_name IS NULL
     OR actual.data_type <> expected.data_type
     OR actual.is_nullable <> expected.is_nullable
  LIMIT 1;

  IF invalid_column IS NOT NULL THEN
    RAISE EXCEPTION
      'upload reference control table has an incompatible or missing column: %',
      invalid_column;
  END IF;

  IF (SELECT count(*) FROM public.asset_upload_reference_rollout) <> 1
     OR EXISTS (
       SELECT 1
       FROM public.asset_upload_reference_rollout
       WHERE NOT singleton
          OR (holds_released_at IS NOT NULL AND holds_initialized_at IS NULL)
          OR (backfill_completed_at IS NOT NULL AND holds_initialized_at IS NULL)
     ) THEN
    RAISE EXCEPTION 'asset_upload_reference_rollout is not a valid singleton state';
  END IF;
END
$validate_control_tables$;

-- Keep the upload ID after its PostgreSQL metadata row is deleted. Migration
-- 80 originally queued only object_key, which is insufficient for a final raw
-- reference check immediately before deleting the Bucket object.
ALTER TABLE public.asset_upload_object_purge_queue
  ADD COLUMN IF NOT EXISTS upload_id text;

CREATE INDEX IF NOT EXISTS asset_upload_object_purge_queue_upload_idx
  ON public.asset_upload_object_purge_queue (upload_id)
  WHERE purged_at IS NULL;

DO $validate_queue_upload_id$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'asset_upload_object_purge_queue'
      AND column_name = 'upload_id'
      AND data_type = 'text'
  ) THEN
    RAISE EXCEPTION
      'asset_upload_object_purge_queue.upload_id is missing or has an incompatible type';
  END IF;
END
$validate_queue_upload_id$;

-- A current metadata row proves that an old queue entry for the same object is
-- stale. Preserve its ID for diagnostics and cancel it before any worker runs.
UPDATE public.asset_upload_object_purge_queue AS purge_queue
SET upload_id = uploads.id,
    cancelled_at = COALESCE(purge_queue.cancelled_at, now()),
    last_error = 'Cancelled because matching upload metadata still exists'
FROM public.asset_register_uploads AS uploads
WHERE uploads.object_key IS NOT NULL
  AND purge_queue.object_key = uploads.object_key
  AND purge_queue.purged_at IS NULL;

-- Legacy queue entries whose deleted metadata can no longer supply an ID are
-- held for manual review. Null IDs must never be treated as purge permission.
UPDATE public.asset_upload_object_purge_queue
SET cancelled_at = COALESCE(cancelled_at, now()),
    last_error = 'Cancelled because legacy queue entry has no upload ID'
WHERE upload_id IS NULL
  AND purged_at IS NULL;

CREATE OR REPLACE FUNCTION public.queue_deleted_asset_upload_object()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $queue_deleted_object$
BEGIN
  IF OLD.object_key IS NOT NULL THEN
    INSERT INTO public.asset_upload_object_purge_queue (object_key, upload_id, purge_after)
    VALUES (
      OLD.object_key,
      OLD.id,
      GREATEST(
        now(),
        COALESCE(OLD.purge_after, now() + interval '30 days')
      )
    )
    ON CONFLICT (object_key) DO UPDATE
    SET upload_id = EXCLUDED.upload_id,
        requested_at = now(),
        purge_after = EXCLUDED.purge_after,
        attempt_count = 0,
        last_error = NULL,
        cancelled_at = NULL,
        purged_at = NULL;
  END IF;

  RETURN OLD;
END
$queue_deleted_object$;

DROP TRIGGER IF EXISTS queue_deleted_asset_upload_object_trigger
  ON public.asset_register_uploads;

CREATE TRIGGER queue_deleted_asset_upload_object_trigger
AFTER DELETE ON public.asset_register_uploads
FOR EACH ROW
EXECUTE FUNCTION public.queue_deleted_asset_upload_object();

-- The registry is explicit so adding a new source table becomes a visible,
-- reviewable schema change. Optional sources do not block readiness when the
-- table is absent; if they exist, they are protected and must pass readiness.
INSERT INTO public.asset_upload_reference_sources (
  source_schema,
  source_table,
  key_column,
  required
)
VALUES
  ('public', 'account_profiles', 'user_id', true),
  ('public', 'ad_brand_kits', 'id', false),
  ('public', 'asset_accountant_documents', 'id', true),
  ('public', 'asset_invoice_documents', 'id', true),
  ('public', 'asset_invoices', 'id', false),
  ('public', 'asset_leads', 'id', true),
  ('public', 'asset_lifecycle_events', 'id', true),
  ('public', 'asset_register_items', 'id', true),
  ('public', 'asset_registers', 'id', true),
  ('public', 'asset_scan_events', 'id', true),
  ('public', 'fuel_slips', 'id', true),
  ('public', 'fuel_storage_events', 'id', true),
  ('public', 'fuel_ledger_audit_events', 'id', false),
  ('public', 'marketplace_listings', 'id', true),
  ('public', 'insurance_evidence', 'id', false),
  ('public', 'insurance_report_snapshots', 'id', false),
  ('public', 'insurance_review_events', 'id', false),
  ('public', 'insurance_snapshot_assets', 'id', false),
  ('public', 'insurance_snapshot_revisions', 'id', false),
  ('public', 'insurance_workspace_assets', 'id', false),
  ('public', 'insurance_workspaces', 'id', false),
  ('public', 'access_audit_events', 'id', false)
ON CONFLICT (source_schema, source_table) DO UPDATE
SET key_column = EXCLUDED.key_column,
    required = EXCLUDED.required;

-- Extract candidate IDs from the upload API URL and from snake_case/camelCase
-- structured ID fields. It intentionally does not treat arbitrary text equal
-- to an upload ID as a reference, avoiding unrelated-value false positives.
CREATE OR REPLACE FUNCTION public.asset_upload_candidate_ids_from_payload(payload jsonb)
RETURNS TABLE(upload_id text)
LANGUAGE sql
IMMUTABLE
SET search_path = pg_catalog, public
AS $extract$
  WITH candidates(candidate_id) AS (
    SELECT route_parts[1]
    FROM regexp_matches(
      COALESCE(payload::text, ''),
      '/api/asset-register/uploads/([0-9A-Za-z_-]{20,128})',
      'g'
    ) AS route_match(route_parts)

    UNION

    SELECT structured_parts[1]
    FROM regexp_matches(
      COALESCE(payload::text, ''),
      '"[^"]*upload_?id"[[:space:]]*:[[:space:]]*"([0-9A-Za-z_-]{20,128})"',
      'gi'
    ) AS structured_match(structured_parts)
  )
  SELECT DISTINCT candidates.candidate_id
  FROM candidates
$extract$;

-- Validate both extractor contracts inside the migration: URL extraction is
-- unchanged, while any normal JSON key ending upload_id or UploadId is found
-- case-insensitively. A longer suffix after "id" must not be accepted.
DO $validate_extractor_contract$
DECLARE
  extracted_ids text[];
BEGIN
  SELECT array_agg(found.upload_id ORDER BY found.upload_id)
    INTO extracted_ids
  FROM public.asset_upload_candidate_ids_from_payload(
    jsonb_build_object(
      'url', '/api/asset-register/uploads/11111111-1111-1111-1111-111111111111',
      'upload_id', '22222222-2222-2222-2222-222222222222',
      'invoice_upload_id', '33333333-3333-3333-3333-333333333333',
      'invoiceUploadId', '44444444-4444-4444-4444-444444444444',
      'upload_id_extra', '55555555-5555-5555-5555-555555555555'
    )
  ) AS found;

  IF extracted_ids IS DISTINCT FROM ARRAY[
    '11111111-1111-1111-1111-111111111111',
    '22222222-2222-2222-2222-222222222222',
    '33333333-3333-3333-3333-333333333333',
    '44444444-4444-4444-4444-444444444444'
  ]::text[] THEN
    RAISE EXCEPTION 'asset upload candidate extractor contract validation failed';
  END IF;
END
$validate_extractor_contract$;

-- Trigger/backfill writes can reference only uploads whose metadata exists.
-- The candidate extractor above remains unfiltered for final raw-source scans
-- after metadata deletion.
CREATE OR REPLACE FUNCTION public.asset_upload_ids_from_payload(payload jsonb)
RETURNS TABLE(upload_id text)
LANGUAGE sql
STABLE
SET search_path = pg_catalog, public
AS $existing_extract$
  SELECT DISTINCT uploads.id
  FROM public.asset_upload_candidate_ids_from_payload(payload) AS candidates
  JOIN public.asset_register_uploads AS uploads
    ON uploads.id = candidates.upload_id
$existing_extract$;

-- Registered tables use the normalized ledger plus row triggers. This bounded
-- catalog fallback protects soft deletion when a future/unregistered public
-- table starts storing an internal upload URL or upload ID before its registry
-- migration is added. Only text-like, JSON, text-array-like, and explicitly
-- named upload-ID columns are serialized; bytea and unrelated wide values are
-- never scanned. Any catalog, permission, DDL-race, or scan error returns true.
CREATE OR REPLACE FUNCTION public.asset_upload_has_unregistered_catalog_reference(
  target_upload_id text
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $catalog_reference$
DECLARE
  table_record record;
  column_record record;
  scannable_expression text;
  scannable_chunk text;
  scannable_chunk_count integer;
  known_id_expression text;
  known_id_chunk text;
  known_id_chunk_count integer;
  payload_expression text;
  found_reference boolean;
  current_role_bypasses_rls boolean;
BEGIN
  IF NULLIF(target_upload_id, '') IS NULL THEN
    RETURN true;
  END IF;

  SELECT roles.rolsuper OR roles.rolbypassrls
    INTO current_role_bypasses_rls
  FROM pg_catalog.pg_roles AS roles
  WHERE roles.rolname = current_user;

  IF current_role_bypasses_rls IS NULL THEN
    RETURN true;
  END IF;

  FOR table_record IN
    SELECT
      namespace.nspname AS source_schema,
      relation.relname AS source_table,
      relation.oid AS source_relation,
      relation.relowner AS owner_role,
      relation.relrowsecurity AS row_security_enabled,
      relation.relforcerowsecurity AS force_row_security
    FROM pg_catalog.pg_class AS relation
    JOIN pg_catalog.pg_namespace AS namespace
      ON namespace.oid = relation.relnamespace
    WHERE namespace.nspname = 'public'
      AND relation.relkind IN ('r', 'p')
      AND NOT relation.relispartition
      AND relation.relname NOT IN (
        'asset_register_uploads',
        'asset_upload_references',
        'asset_upload_reference_sources',
        'asset_upload_reference_rollout',
        'asset_upload_object_purge_queue'
      )
      AND NOT EXISTS (
        SELECT 1
        FROM public.asset_upload_reference_sources AS registered
        WHERE registered.source_schema = namespace.nspname
          AND registered.source_table = relation.relname
      )
    ORDER BY namespace.nspname, relation.relname
  LOOP
    -- A partial RLS view can never prove that the upload is unreferenced.
    -- Superusers/BYPASSRLS roles see all rows; an effective table owner also
    -- sees all rows unless FORCE ROW LEVEL SECURITY is enabled.
    IF table_record.row_security_enabled
       AND NOT current_role_bypasses_rls
       AND (
         table_record.force_row_security
         OR NOT pg_catalog.pg_has_role(current_user, table_record.owner_role, 'USAGE')
       ) THEN
      RETURN true;
    END IF;

    scannable_expression := NULL;
    scannable_chunk := NULL;
    scannable_chunk_count := 0;
    known_id_expression := NULL;
    known_id_chunk := NULL;
    known_id_chunk_count := 0;

    FOR column_record IN
      WITH typed_columns AS (
        SELECT
          attribute.attname AS column_name,
          attribute.attnum AS column_position,
          attribute.atttypid AS column_type,
          column_type.typname AS column_type_name,
          column_type.typtype AS column_type_kind,
          column_type.typbasetype AS domain_base_type,
          domain_base_type.typname AS domain_base_type_name,
          domain_base_type.typelem AS domain_array_element_type,
          domain_array_element_type.typname AS domain_array_element_type_name,
          domain_array_element_type.typtype AS domain_array_element_type_kind,
          domain_array_domain_base_type.typname AS domain_array_domain_base_type_name,
          column_type.typelem AS array_element_type,
          element_type.typname AS array_element_type_name,
          element_type.typtype AS array_element_type_kind,
          array_domain_base_type.typname AS array_domain_base_type_name
        FROM pg_catalog.pg_attribute AS attribute
        JOIN pg_catalog.pg_type AS column_type
          ON column_type.oid = attribute.atttypid
        LEFT JOIN pg_catalog.pg_type AS domain_base_type
          ON domain_base_type.oid = column_type.typbasetype
        LEFT JOIN pg_catalog.pg_type AS domain_array_element_type
          ON domain_array_element_type.oid = domain_base_type.typelem
        LEFT JOIN pg_catalog.pg_type AS domain_array_domain_base_type
          ON domain_array_domain_base_type.oid = domain_array_element_type.typbasetype
        LEFT JOIN pg_catalog.pg_type AS element_type
          ON element_type.oid = column_type.typelem
        LEFT JOIN pg_catalog.pg_type AS array_domain_base_type
          ON array_domain_base_type.oid = element_type.typbasetype
        WHERE attribute.attrelid = table_record.source_relation
          AND attribute.attnum > 0
          AND NOT attribute.attisdropped
      ), classified_columns AS (
        SELECT
          typed_columns.*,
          (
            column_type IN (
              'text'::regtype,
              'varchar'::regtype,
              'bpchar'::regtype,
              'json'::regtype,
              'jsonb'::regtype
            )
            OR column_type_name = 'citext'
            OR (
              column_type_kind = 'd'
              AND domain_base_type IN (
                'text'::regtype,
                'varchar'::regtype,
                'bpchar'::regtype,
                'json'::regtype,
                'jsonb'::regtype
              )
            )
            OR domain_base_type_name = 'citext'
            OR (
              column_type_kind = 'd'
              AND (
                domain_array_element_type IN (
                  'text'::regtype,
                  'varchar'::regtype,
                  'bpchar'::regtype,
                  'json'::regtype,
                  'jsonb'::regtype
                )
                OR domain_array_element_type_name = 'citext'
                OR (
                  domain_array_element_type_kind = 'd'
                  AND domain_array_domain_base_type_name IN (
                    'text', 'varchar', 'bpchar', 'json', 'jsonb', 'citext'
                  )
                )
              )
            )
            OR array_element_type IN (
              'text'::regtype,
              'varchar'::regtype,
              'bpchar'::regtype,
              'json'::regtype,
              'jsonb'::regtype
            )
            OR array_element_type_name = 'citext'
            OR (
              array_element_type_kind = 'd'
              AND array_domain_base_type_name IN (
                'text', 'varchar', 'bpchar', 'json', 'jsonb', 'citext'
              )
            )
          ) AS scannable,
          (
            lower(column_name) ~ 'upload_?id$'
            AND (
              column_type IN (
                'text'::regtype,
                'varchar'::regtype,
                'bpchar'::regtype,
                'uuid'::regtype
              )
              OR column_type_name = 'citext'
              OR (
                column_type_kind = 'd'
                AND domain_base_type IN (
                  'text'::regtype,
                  'varchar'::regtype,
                  'bpchar'::regtype,
                  'uuid'::regtype
                )
              )
              OR domain_base_type_name = 'citext'
            )
          ) AS known_upload_id
        FROM typed_columns
      )
      SELECT column_name, scannable, known_upload_id
      FROM classified_columns
      WHERE scannable OR known_upload_id
      ORDER BY column_position
    LOOP
      IF column_record.scannable THEN
        IF scannable_chunk_count = 32 THEN
          scannable_chunk := scannable_chunk || ')';
          scannable_expression := CASE
            WHEN scannable_expression IS NULL THEN scannable_chunk
            ELSE scannable_expression || ' || ' || scannable_chunk
          END;
          scannable_chunk := NULL;
          scannable_chunk_count := 0;
        END IF;

        scannable_chunk := COALESCE(scannable_chunk || ', ', 'jsonb_build_object(')
          || pg_catalog.format(
               '%L, source_row.%I',
               column_record.column_name,
               column_record.column_name
             );
        scannable_chunk_count := scannable_chunk_count + 1;
      END IF;

      IF column_record.known_upload_id THEN
        IF known_id_chunk_count = 32 THEN
          known_id_chunk := known_id_chunk || ')';
          known_id_expression := CASE
            WHEN known_id_expression IS NULL THEN known_id_chunk
            ELSE known_id_expression || ' || ' || known_id_chunk
          END;
          known_id_chunk := NULL;
          known_id_chunk_count := 0;
        END IF;

        known_id_chunk := COALESCE(known_id_chunk || ', ', 'jsonb_build_array(')
          || pg_catalog.format(
               'jsonb_build_object(''upload_id'', source_row.%I::text)',
               column_record.column_name
             );
        known_id_chunk_count := known_id_chunk_count + 1;
      END IF;
    END LOOP;

    IF scannable_chunk IS NOT NULL THEN
      scannable_chunk := scannable_chunk || ')';
      scannable_expression := CASE
        WHEN scannable_expression IS NULL THEN scannable_chunk
        ELSE scannable_expression || ' || ' || scannable_chunk
      END;
    END IF;

    IF known_id_chunk IS NOT NULL THEN
      known_id_chunk := known_id_chunk || ')';
      known_id_expression := CASE
        WHEN known_id_expression IS NULL THEN known_id_chunk
        ELSE known_id_expression || ' || ' || known_id_chunk
      END;
    END IF;

    IF scannable_expression IS NULL AND known_id_expression IS NULL THEN
      CONTINUE;
    END IF;

    payload_expression := pg_catalog.format(
      'jsonb_build_object('
      '''scannableColumns'', (%s), '
      '''knownUploadIds'', (%s)'
      ')',
      COALESCE(scannable_expression, '''{}''::jsonb'),
      COALESCE(known_id_expression, '''[]''::jsonb')
    );

    EXECUTE pg_catalog.format(
      'SELECT EXISTS ('
      'SELECT 1 '
      'FROM %I.%I AS source_row '
      'CROSS JOIN LATERAL public.asset_upload_candidate_ids_from_payload(%s) AS found '
      'WHERE found.upload_id = $1'
      ')',
      table_record.source_schema,
      table_record.source_table,
      payload_expression
    )
    INTO found_reference
    USING target_upload_id;

    IF found_reference THEN
      RETURN true;
    END IF;
  END LOOP;

  RETURN false;
EXCEPTION
  WHEN OTHERS THEN
    RETURN true;
END
$catalog_reference$;

CREATE OR REPLACE FUNCTION public.sync_asset_upload_references()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $sync$
DECLARE
  old_source_key text;
  new_source_key text;
BEGIN
  IF TG_NARGS <> 1 OR NULLIF(TG_ARGV[0], '') IS NULL THEN
    RAISE EXCEPTION 'upload reference trigger requires one key-column argument';
  END IF;

  IF TG_OP <> 'INSERT' THEN
    old_source_key := NULLIF(to_jsonb(OLD) ->> TG_ARGV[0], '');
    IF old_source_key IS NULL THEN
      RAISE EXCEPTION
        'cannot synchronize upload references: %.% old row has no %',
        TG_TABLE_SCHEMA,
        TG_TABLE_NAME,
        TG_ARGV[0];
    END IF;

    DELETE FROM public.asset_upload_references
    WHERE source_schema = TG_TABLE_SCHEMA
      AND source_table = TG_TABLE_NAME
      AND source_key = old_source_key
      AND reference_kind = 'source';
  END IF;

  IF TG_OP <> 'DELETE' THEN
    new_source_key := NULLIF(to_jsonb(NEW) ->> TG_ARGV[0], '');
    IF new_source_key IS NULL THEN
      RAISE EXCEPTION
        'cannot synchronize upload references: %.% new row has no %',
        TG_TABLE_SCHEMA,
        TG_TABLE_NAME,
        TG_ARGV[0];
    END IF;

    INSERT INTO public.asset_upload_references (
      upload_id,
      source_schema,
      source_table,
      source_key,
      reference_kind,
      expires_at,
      first_seen_at,
      last_seen_at
    )
    SELECT
      found.upload_id,
      TG_TABLE_SCHEMA,
      TG_TABLE_NAME,
      new_source_key,
      'source',
      NULL,
      now(),
      now()
    FROM public.asset_upload_ids_from_payload(to_jsonb(NEW)) AS found
    ON CONFLICT ON CONSTRAINT asset_upload_references_pkey DO UPDATE
    SET reference_kind = 'source',
        expires_at = NULL,
        last_seen_at = EXCLUDED.last_seen_at;

    -- A durable source reference supersedes the upload's short pending hold.
    DELETE FROM public.asset_upload_references AS pending
    WHERE pending.reference_kind = 'pending'
      AND pending.upload_id IN (
        SELECT found.upload_id
        FROM public.asset_upload_ids_from_payload(to_jsonb(NEW)) AS found
      );

    -- A newly durable source revives an upload that a concurrent/background
    -- cleanup may have marked, and cancels an uncompleted object purge entry.
    UPDATE public.asset_register_uploads AS uploads
    SET deleted_at = NULL,
        purge_after = NULL
    WHERE uploads.id IN (
        SELECT found.upload_id
        FROM public.asset_upload_ids_from_payload(to_jsonb(NEW)) AS found
      )
      AND (uploads.deleted_at IS NOT NULL OR uploads.purge_after IS NOT NULL);

    UPDATE public.asset_upload_object_purge_queue AS purge_queue
    SET cancelled_at = now(),
        last_error = 'Cancelled because the upload acquired a durable reference'
    WHERE purge_queue.upload_id IN (
        SELECT found.upload_id
        FROM public.asset_upload_candidate_ids_from_payload(to_jsonb(NEW)) AS found
      )
      AND purge_queue.purged_at IS NULL
      AND purge_queue.cancelled_at IS NULL;
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END
$sync$;

CREATE OR REPLACE FUNCTION public.create_asset_upload_pending_reference()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $pending$
BEGIN
  INSERT INTO public.asset_upload_references (
    upload_id,
    source_schema,
    source_table,
    source_key,
    reference_kind,
    expires_at,
    first_seen_at,
    last_seen_at
  )
  VALUES (
    NEW.id,
    'system',
    'pending_upload',
    NEW.id,
    'pending',
    now() + interval '24 hours',
    now(),
    now()
  )
  ON CONFLICT ON CONSTRAINT asset_upload_references_pkey DO UPDATE
  SET reference_kind = 'pending',
      expires_at = GREATEST(
        public.asset_upload_references.expires_at,
        EXCLUDED.expires_at
      ),
      last_seen_at = EXCLUDED.last_seen_at;

  RETURN NEW;
END
$pending$;

DROP TRIGGER IF EXISTS asset_upload_pending_reference_trigger
  ON public.asset_register_uploads;

CREATE TRIGGER asset_upload_pending_reference_trigger
AFTER INSERT ON public.asset_register_uploads
FOR EACH ROW
EXECUTE FUNCTION public.create_asset_upload_pending_reference();

-- Insert non-expiring migration holds exactly once. If a later reviewed
-- rollout releases them, rerunning this migration must not recreate them.
DO $migration_holds$
DECLARE
  initialized_at timestamptz;
BEGIN
  SELECT holds_initialized_at
    INTO initialized_at
  FROM public.asset_upload_reference_rollout
  WHERE singleton
  FOR UPDATE;

  IF initialized_at IS NULL THEN
    INSERT INTO public.asset_upload_references (
      upload_id,
      source_schema,
      source_table,
      source_key,
      reference_kind,
      expires_at,
      first_seen_at,
      last_seen_at
    )
    SELECT
      uploads.id,
      'system',
      'migration_81',
      uploads.id,
      'migration_hold',
      NULL,
      now(),
      now()
    FROM public.asset_register_uploads AS uploads
    ON CONFLICT ON CONSTRAINT asset_upload_references_pkey DO UPDATE
    SET reference_kind = 'migration_hold',
        expires_at = NULL,
        last_seen_at = EXCLUDED.last_seen_at;

    UPDATE public.asset_upload_reference_rollout
    SET holds_initialized_at = now(),
        holds_released_at = NULL
    WHERE singleton
      AND holds_initialized_at IS NULL;
  END IF;
END
$migration_holds$;

-- Install one generic trigger on each source table and rebuild that table's
-- source rows while writes are locked. Deleting stale source rows before the
-- backfill makes reruns converge to the current source data.
DO $install_source_guards$
DECLARE
  source_record record;
  source_relation regclass;
  missing_key boolean;
BEGIN
  FOR source_record IN
    SELECT source_schema, source_table, key_column
    FROM public.asset_upload_reference_sources
    ORDER BY source_schema, source_table
  LOOP
    source_relation := to_regclass(
      pg_catalog.format('%I.%I', source_record.source_schema, source_record.source_table)
    );

    IF source_relation IS NULL THEN
      UPDATE public.asset_upload_reference_sources
      SET trigger_installed_at = NULL,
          backfilled_at = NULL,
          verified_at = NULL
      WHERE source_schema = source_record.source_schema
        AND source_table = source_record.source_table;
      CONTINUE;
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM pg_catalog.pg_attribute AS a
      WHERE a.attrelid = source_relation
        AND a.attname = source_record.key_column
        AND a.attnum > 0
        AND NOT a.attisdropped
    ) THEN
      RAISE EXCEPTION
        'registered upload source %.% is missing key column %',
        source_record.source_schema,
        source_record.source_table,
        source_record.key_column;
    END IF;

    EXECUTE pg_catalog.format(
      'SELECT EXISTS (SELECT 1 FROM %I.%I AS source_row WHERE NULLIF(to_jsonb(source_row) ->> %L, '''') IS NULL)',
      source_record.source_schema,
      source_record.source_table,
      source_record.key_column
    ) INTO missing_key;

    IF missing_key THEN
      RAISE EXCEPTION
        'registered upload source %.% contains a null or blank key in column %',
        source_record.source_schema,
        source_record.source_table,
        source_record.key_column;
    END IF;

    EXECUTE pg_catalog.format(
      'LOCK TABLE %I.%I IN SHARE ROW EXCLUSIVE MODE',
      source_record.source_schema,
      source_record.source_table
    );

    EXECUTE pg_catalog.format(
      'DROP TRIGGER IF EXISTS asset_upload_reference_sync_trigger ON %I.%I',
      source_record.source_schema,
      source_record.source_table
    );

    EXECUTE pg_catalog.format(
      'CREATE TRIGGER asset_upload_reference_sync_trigger '
      'AFTER INSERT OR UPDATE OR DELETE ON %I.%I '
      'FOR EACH ROW EXECUTE FUNCTION public.sync_asset_upload_references(%L)',
      source_record.source_schema,
      source_record.source_table,
      source_record.key_column
    );

    DELETE FROM public.asset_upload_references
    WHERE source_schema = source_record.source_schema
      AND source_table = source_record.source_table
      AND reference_kind = 'source';

    EXECUTE pg_catalog.format(
      'INSERT INTO public.asset_upload_references '
      '(upload_id, source_schema, source_table, source_key, reference_kind, expires_at, first_seen_at, last_seen_at) '
      'SELECT found.upload_id, %L, %L, to_jsonb(source_row) ->> %L, ''source'', NULL, now(), now() '
      'FROM %I.%I AS source_row '
      'CROSS JOIN LATERAL public.asset_upload_ids_from_payload(to_jsonb(source_row)) AS found '
      'ON CONFLICT ON CONSTRAINT asset_upload_references_pkey DO UPDATE '
      'SET reference_kind = ''source'', expires_at = NULL, last_seen_at = EXCLUDED.last_seen_at',
      source_record.source_schema,
      source_record.source_table,
      source_record.key_column,
      source_record.source_schema,
      source_record.source_table
    );

    UPDATE public.asset_upload_reference_sources
    SET trigger_installed_at = now(),
        backfilled_at = now(),
        verified_at = now()
    WHERE source_schema = source_record.source_schema
      AND source_table = source_record.source_table;
  END LOOP;
END
$install_source_guards$;

-- Apply the same cancellation rule to references discovered by the initial
-- backfill (the row triggers only see subsequent writes).
UPDATE public.asset_register_uploads AS uploads
SET deleted_at = NULL,
    purge_after = NULL
FROM public.asset_upload_references AS references
WHERE references.upload_id = uploads.id
  AND references.reference_kind = 'source'
  AND (uploads.deleted_at IS NOT NULL OR uploads.purge_after IS NOT NULL);

UPDATE public.asset_upload_object_purge_queue AS purge_queue
SET cancelled_at = now(),
    last_error = 'Cancelled because the upload has a durable backfilled reference'
FROM public.asset_register_uploads AS uploads
JOIN public.asset_upload_references AS references
  ON references.upload_id = uploads.id
 AND references.reference_kind = 'source'
WHERE uploads.object_key IS NOT NULL
  AND purge_queue.object_key = uploads.object_key
  AND purge_queue.purged_at IS NULL
  AND purge_queue.cancelled_at IS NULL;

CREATE OR REPLACE FUNCTION public.asset_upload_reference_ledger_ready()
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $ready$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.asset_upload_reference_rollout
    WHERE singleton
      AND holds_initialized_at IS NOT NULL
  ) THEN
    RETURN false;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_constraint AS c
    WHERE c.conrelid = 'public.asset_upload_references'::regclass
      AND c.confrelid = 'public.asset_register_uploads'::regclass
      AND c.contype = 'f'
      AND c.condeferrable
      AND c.condeferred
      AND c.confdeltype = 'a'
  ) THEN
    RETURN false;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_trigger AS t
    WHERE t.tgrelid = 'public.asset_register_uploads'::regclass
      AND t.tgname = 'asset_upload_pending_reference_trigger'
      AND t.tgfoid = 'public.create_asset_upload_pending_reference()'::regprocedure
      AND t.tgnargs = 0
      AND NOT t.tgisinternal
      AND t.tgenabled <> 'D'
  ) THEN
    RETURN false;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_trigger AS t
    WHERE t.tgrelid = 'public.asset_register_uploads'::regclass
      AND t.tgname = 'queue_deleted_asset_upload_object_trigger'
      AND t.tgfoid = 'public.queue_deleted_asset_upload_object()'::regprocedure
      AND t.tgnargs = 0
      AND NOT t.tgisinternal
      AND t.tgenabled <> 'D'
  ) THEN
    RETURN false;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'asset_upload_object_purge_queue'
      AND column_name = 'upload_id'
      AND data_type = 'text'
  ) THEN
    RETURN false;
  END IF;

  IF to_regprocedure('public.asset_upload_candidate_ids_from_payload(jsonb)') IS NULL
     OR to_regprocedure('public.asset_upload_ids_from_payload(jsonb)') IS NULL
     OR to_regprocedure('public.asset_upload_has_unregistered_catalog_reference(text)') IS NULL
     OR to_regprocedure('public.asset_upload_has_live_reference(text)') IS NULL
     OR to_regprocedure('public.asset_upload_prepare_for_deletion(text)') IS NULL THEN
    RETURN false;
  END IF;

  IF EXISTS (
    WITH expected(source_schema, source_table, key_column, required) AS (
      VALUES
        ('public', 'account_profiles', 'user_id', true),
        ('public', 'ad_brand_kits', 'id', false),
        ('public', 'asset_accountant_documents', 'id', true),
        ('public', 'asset_invoice_documents', 'id', true),
        ('public', 'asset_invoices', 'id', false),
        ('public', 'asset_leads', 'id', true),
        ('public', 'asset_lifecycle_events', 'id', true),
        ('public', 'asset_register_items', 'id', true),
        ('public', 'asset_registers', 'id', true),
        ('public', 'asset_scan_events', 'id', true),
        ('public', 'fuel_slips', 'id', true),
        ('public', 'fuel_storage_events', 'id', true),
        ('public', 'fuel_ledger_audit_events', 'id', false),
        ('public', 'marketplace_listings', 'id', true),
        ('public', 'insurance_evidence', 'id', false),
        ('public', 'insurance_report_snapshots', 'id', false),
        ('public', 'insurance_review_events', 'id', false),
        ('public', 'insurance_snapshot_assets', 'id', false),
        ('public', 'insurance_snapshot_revisions', 'id', false),
        ('public', 'insurance_workspace_assets', 'id', false),
        ('public', 'insurance_workspaces', 'id', false),
        ('public', 'access_audit_events', 'id', false)
    )
    SELECT 1
    FROM expected
    LEFT JOIN public.asset_upload_reference_sources AS sources
      ON sources.source_schema = expected.source_schema
     AND sources.source_table = expected.source_table
    WHERE sources.source_schema IS NULL
       OR sources.key_column <> expected.key_column
       OR sources.required <> expected.required
  ) THEN
    RETURN false;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.asset_upload_reference_sources AS sources
    WHERE
      (
        sources.required
        AND to_regclass(
          pg_catalog.format('%I.%I', sources.source_schema, sources.source_table)
        ) IS NULL
      )
      OR
      (
        to_regclass(
          pg_catalog.format('%I.%I', sources.source_schema, sources.source_table)
        ) IS NOT NULL
        AND (
          sources.trigger_installed_at IS NULL
          OR sources.backfilled_at IS NULL
          OR sources.verified_at IS NULL
          OR NOT EXISTS (
            SELECT 1
            FROM pg_catalog.pg_trigger AS t
            WHERE t.tgrelid = to_regclass(
                    pg_catalog.format('%I.%I', sources.source_schema, sources.source_table)
                  )
              AND t.tgname = 'asset_upload_reference_sync_trigger'
              AND t.tgfoid = 'public.sync_asset_upload_references()'::regprocedure
              AND t.tgnargs = 1
              AND t.tgargs =
                    pg_catalog.convert_to(sources.key_column, 'UTF8')
                    || pg_catalog.decode('00', 'hex')
              AND NOT t.tgisinternal
              AND t.tgenabled <> 'D'
          )
        )
      )
  ) THEN
    RETURN false;
  END IF;

  RETURN true;
EXCEPTION
  WHEN OTHERS THEN
    -- Readiness is a safety gate, so catalog or permission errors are not ready.
    RETURN false;
END
$ready$;

-- This is the authoritative purge guard. It intentionally returns true when
-- readiness is false or a raw-source scan fails. Even after migration holds are
-- released, it checks the ledger, registered raw rows, and the bounded
-- unregistered-table catalog fallback before authorizing deletion.
CREATE OR REPLACE FUNCTION public.asset_upload_has_live_reference(target_upload_id text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $live_reference$
DECLARE
  source_record record;
  found_in_source boolean;
BEGIN
  IF NULLIF(target_upload_id, '') IS NULL THEN
    RETURN true;
  END IF;

  IF NOT public.asset_upload_reference_ledger_ready() THEN
    RETURN true;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.asset_upload_references AS references
    WHERE references.upload_id = target_upload_id
      AND (
        references.expires_at IS NULL
        OR references.expires_at > now()
      )
  ) THEN
    RETURN true;
  END IF;

  FOR source_record IN
    SELECT source_schema, source_table
    FROM public.asset_upload_reference_sources
    WHERE to_regclass(
            pg_catalog.format('%I.%I', source_schema, source_table)
          ) IS NOT NULL
    ORDER BY source_schema, source_table
  LOOP
    EXECUTE pg_catalog.format(
      'SELECT EXISTS ('
      'SELECT 1 FROM %I.%I AS source_row '
      'CROSS JOIN LATERAL public.asset_upload_candidate_ids_from_payload(to_jsonb(source_row)) AS found '
      'WHERE found.upload_id = $1'
      ')',
      source_record.source_schema,
      source_record.source_table
    )
    INTO found_in_source
    USING target_upload_id;

    IF found_in_source THEN
      RETURN true;
    END IF;
  END LOOP;

  IF public.asset_upload_has_unregistered_catalog_reference(target_upload_id) THEN
    RETURN true;
  END IF;

  RETURN false;
EXCEPTION
  WHEN OTHERS THEN
    -- Failure to prove "unreferenced" means referenced.
    RETURN true;
END
$live_reference$;

-- Expired temporary rows still participate in the physical foreign key. A
-- deletion worker calls this inside the same transaction immediately before
-- deleting metadata. It removes only expired temporary rows and only after the
-- ledger plus raw catalog prove that no live reference remains.
CREATE OR REPLACE FUNCTION public.asset_upload_prepare_for_deletion(
  target_upload_id text
)
RETURNS boolean
LANGUAGE plpgsql
VOLATILE
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $prepare_for_deletion$
BEGIN
  IF NULLIF(target_upload_id, '') IS NULL
     OR public.asset_upload_has_live_reference(target_upload_id) THEN
    RETURN false;
  END IF;

  DELETE FROM public.asset_upload_references
  WHERE upload_id = target_upload_id
    AND reference_kind IN ('pending', 'legacy_orphan_hold')
    AND expires_at <= now();

  -- A source row/trigger racing this function either adds a deferred FK row or
  -- locks/revives the upload, so the caller's subsequent DELETE still fails.
  RETURN NOT public.asset_upload_has_live_reference(target_upload_id);
EXCEPTION
  WHEN OTHERS THEN
    RETURN false;
END
$prepare_for_deletion$;

-- Refreshing a pending hold is safe and idempotent. Cancellation is permitted
-- only when a durable source reference already exists; otherwise it fails
-- closed and leaves the temporary protection in place.
CREATE OR REPLACE FUNCTION public.asset_upload_refresh_pending_reference(
  target_upload_id text,
  hold_for interval DEFAULT interval '24 hours'
)
RETURNS boolean
LANGUAGE plpgsql
VOLATILE
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $refresh_pending$
BEGIN
  IF NULLIF(target_upload_id, '') IS NULL OR hold_for <= interval '0 seconds' THEN
    RETURN false;
  END IF;

  INSERT INTO public.asset_upload_references (
    upload_id,
    source_schema,
    source_table,
    source_key,
    reference_kind,
    expires_at,
    first_seen_at,
    last_seen_at
  )
  SELECT
    uploads.id,
    'system',
    'pending_upload',
    uploads.id,
    'pending',
    now() + hold_for,
    now(),
    now()
  FROM public.asset_register_uploads AS uploads
  WHERE uploads.id = target_upload_id
  ON CONFLICT ON CONSTRAINT asset_upload_references_pkey DO UPDATE
  SET reference_kind = 'pending',
      expires_at = GREATEST(
        public.asset_upload_references.expires_at,
        EXCLUDED.expires_at
      ),
      last_seen_at = EXCLUDED.last_seen_at;

  RETURN FOUND;
END
$refresh_pending$;

CREATE OR REPLACE FUNCTION public.asset_upload_cancel_pending_reference(
  target_upload_id text
)
RETURNS boolean
LANGUAGE plpgsql
VOLATILE
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $cancel_pending$
BEGIN
  IF NULLIF(target_upload_id, '') IS NULL THEN
    RETURN false;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.asset_upload_references AS references
    WHERE references.upload_id = target_upload_id
      AND references.reference_kind = 'source'
      AND references.expires_at IS NULL
  ) THEN
    RETURN false;
  END IF;

  DELETE FROM public.asset_upload_references
  WHERE upload_id = target_upload_id
    AND source_schema = 'system'
    AND source_table = 'pending_upload'
    AND source_key = target_upload_id
    AND reference_kind = 'pending';

  RETURN FOUND;
END
$cancel_pending$;

UPDATE public.asset_upload_reference_rollout
SET backfill_completed_at = COALESCE(backfill_completed_at, now())
WHERE singleton
  AND public.asset_upload_reference_ledger_ready();

COMMENT ON TABLE public.asset_upload_references IS
  'Normalized, fail-closed references and rollout holds for asset upload deletion safety.';

COMMENT ON FUNCTION public.asset_upload_has_live_reference(text) IS
  'Returns true unless both ledger and registered raw sources prove the upload is unreferenced.';

COMMIT;
