import type { PoolClient } from 'pg';
import {
  getAssetRegisterItemById,
  type AssetRegisterItem,
} from './asset-register-db';
import { revalueAssetRegisterItem } from './asset-register-revaluation';
import { isDatabaseSchemaReady } from './database-schema-readiness';
import { getDb } from './db';

export type DealerAssetCorrectionSource = 'lead' | 'maintenance';
export type DealerAssetCorrectionField = 'serialNumber' | 'replacementPriceExVat' | 'licenseRenewalDate';
export type DealerAssetCorrectionStatus = 'pending' | 'accepted' | 'rejected' | 'superseded';
export type DealerAssetCorrectionRevaluationStatus = 'not_required' | 'pending' | 'succeeded' | 'failed';
export type DealerAssetCorrectionResolutionOutcome =
  | 'accepted_revalued'
  | 'accepted_revaluation_failed'
  | 'accepted_revaluation_pending'
  | 'accepted_no_revaluation'
  | 'rejected';

export type DealerAssetCorrectionRequest = {
  id: string;
  ownerUserId: string;
  dealerUserId: string;
  assetId: string;
  assetTitle: string;
  sourceType: DealerAssetCorrectionSource;
  sourceId: string;
  dealerName: string;
  actorName: string;
  currentSerialNumber: string;
  proposedSerialNumber: string | null;
  currentReplacementPriceExVat: number | null;
  proposedReplacementPriceExVat: number | null;
  currentLicenseRenewalDate: string;
  proposedLicenseRenewalDate: string | null;
  serialNumberChanged: boolean;
  replacementPriceChanged: boolean;
  licenseRenewalDateChanged: boolean;
  status: DealerAssetCorrectionStatus;
  revaluationStatus: DealerAssetCorrectionRevaluationStatus;
  revaluationAttemptCount: number;
  revaluationLastAttemptedAtIso: string | null;
  revaluationCompletedAtIso: string | null;
  revaluationRunId: number | null;
  revaluationPreviousRunId: number | null;
  revaluationPreviousValueExVat: number | null;
  revaluationNewValueExVat: number | null;
  revaluationFailureCode: string;
  revaluationFailureMessage: string;
  revaluationRetryable: boolean;
  createdAtIso: string;
  updatedAtIso: string;
  resolvedAtIso: string | null;
};

export type DealerAssetCorrectionResolution = {
  correction: DealerAssetCorrectionRequest;
  outcome: DealerAssetCorrectionResolutionOutcome;
  message: string;
  asset: AssetRegisterItem | null;
};

type DealerAssetCorrectionRow = {
  id: string;
  owner_user_id: string;
  dealer_user_id: string;
  asset_register_item_id: string;
  asset_title: string | null;
  source_type: string;
  source_id: string;
  dealer_name: string | null;
  actor_name: string | null;
  current_serial_number: string | null;
  proposed_serial_number: string | null;
  current_replacement_price_ex_vat: string | number | null;
  proposed_replacement_price_ex_vat: string | number | null;
  current_license_renewal_date: string | Date | null;
  proposed_license_renewal_date: string | Date | null;
  serial_number_changed: boolean | null;
  replacement_price_changed: boolean | null;
  license_renewal_date_changed: boolean | null;
  status: string;
  revaluation_status: string | null;
  revaluation_attempt_count: string | number | null;
  revaluation_last_attempted_at: string | Date | null;
  revaluation_completed_at: string | Date | null;
  revaluation_run_id: string | number | null;
  revaluation_previous_run_id: string | number | null;
  revaluation_previous_value_ex_vat: string | number | null;
  revaluation_new_value_ex_vat: string | number | null;
  revaluation_failure_code: string | null;
  revaluation_failure_message: string | null;
  created_at: string | Date | null;
  updated_at: string | Date | null;
  resolved_at: string | Date | null;
};

type CorrectionAccessRow = {
  owner_user_id: string;
  asset_register_item_id: string;
};

type TableColumnRow = {
  table_name: string;
  column_name: string;
  data_type: string;
  udt_name: string;
};

let dealerAssetCorrectionTablesPromise: Promise<void> | null = null;
const REVALUATION_STALE_AFTER_MS = 15 * 60 * 1000;

function asText(value: unknown): string {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function asRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

function asNumber(value: unknown): number | null {
  if (value === null || typeof value === 'undefined' || value === '') return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function asInteger(value: unknown): number | null {
  const numeric = asNumber(value);
  return numeric === null ? null : Math.round(numeric);
}

function iso(value: string | Date | null | undefined): string {
  if (!value) return new Date().toISOString();
  const parsed = value instanceof Date ? value : new Date(value);
  return Number.isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString();
}

function nullableIso(value: string | Date | null | undefined): string | null {
  if (!value) return null;
  const parsed = value instanceof Date ? value : new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function dateOnly(value: unknown): string {
  if (!value) return '';
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? '' : value.toISOString().slice(0, 10);
  const text = asText(value);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return '';
  const parsed = new Date(`${text}T00:00:00.000Z`);
  return Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== text ? '' : text;
}

function assetLicenseRenewalDate(asset: AssetRegisterItem): string {
  const specs = asset.specsJson ?? {};
  return dateOnly(
    specs.licenseRenewalDate
    ?? specs.license_renewal_date
    ?? specs.licenceRenewalDate
    ?? specs.licence_renewal_date,
  );
}

function normalizeSource(value: unknown): DealerAssetCorrectionSource | null {
  const source = asText(value).toLowerCase();
  return source === 'lead' || source === 'maintenance' ? source : null;
}

function normalizeStatus(value: unknown): DealerAssetCorrectionStatus {
  const status = asText(value).toLowerCase();
  if (status === 'accepted' || status === 'rejected' || status === 'superseded') return status;
  return 'pending';
}

function normalizeRevaluationStatus(value: unknown): DealerAssetCorrectionRevaluationStatus {
  const status = asText(value).toLowerCase();
  if (status === 'pending' || status === 'succeeded' || status === 'failed') return status;
  return 'not_required';
}

function isStaleRevaluationAttempt(lastAttemptedAtIso: string | null): boolean {
  if (!lastAttemptedAtIso) return true;
  const attemptedAt = Date.parse(lastAttemptedAtIso);
  return !Number.isFinite(attemptedAt) || Date.now() - attemptedAt >= REVALUATION_STALE_AFTER_MS;
}

function mapCorrection(row: DealerAssetCorrectionRow): DealerAssetCorrectionRequest {
  const status = normalizeStatus(row.status);
  const revaluationStatus = normalizeRevaluationStatus(row.revaluation_status);
  const revaluationLastAttemptedAtIso = nullableIso(row.revaluation_last_attempted_at);
  return {
    id: row.id,
    ownerUserId: row.owner_user_id,
    dealerUserId: row.dealer_user_id,
    assetId: row.asset_register_item_id,
    assetTitle: asText(row.asset_title) || 'Asset register item',
    sourceType: normalizeSource(row.source_type) ?? 'lead',
    sourceId: row.source_id,
    dealerName: asText(row.dealer_name) || 'Dealer',
    actorName: asText(row.actor_name) || asText(row.dealer_name) || 'Dealer',
    currentSerialNumber: asText(row.current_serial_number),
    proposedSerialNumber: row.proposed_serial_number === null ? null : asText(row.proposed_serial_number),
    currentReplacementPriceExVat: asNumber(row.current_replacement_price_ex_vat),
    proposedReplacementPriceExVat: asNumber(row.proposed_replacement_price_ex_vat),
    currentLicenseRenewalDate: dateOnly(row.current_license_renewal_date),
    proposedLicenseRenewalDate: row.proposed_license_renewal_date === null ? null : dateOnly(row.proposed_license_renewal_date),
    serialNumberChanged: Boolean(row.serial_number_changed),
    replacementPriceChanged: Boolean(row.replacement_price_changed),
    licenseRenewalDateChanged: Boolean(row.license_renewal_date_changed),
    status,
    revaluationStatus,
    revaluationAttemptCount: Math.max(0, asInteger(row.revaluation_attempt_count) ?? 0),
    revaluationLastAttemptedAtIso,
    revaluationCompletedAtIso: nullableIso(row.revaluation_completed_at),
    revaluationRunId: asInteger(row.revaluation_run_id),
    revaluationPreviousRunId: asInteger(row.revaluation_previous_run_id),
    revaluationPreviousValueExVat: asNumber(row.revaluation_previous_value_ex_vat),
    revaluationNewValueExVat: asNumber(row.revaluation_new_value_ex_vat),
    revaluationFailureCode: asText(row.revaluation_failure_code),
    revaluationFailureMessage: asText(row.revaluation_failure_message),
    revaluationRetryable:
      status === 'accepted'
      && Boolean(row.replacement_price_changed)
      && (
        revaluationStatus === 'failed'
        || (revaluationStatus === 'pending' && isStaleRevaluationAttempt(revaluationLastAttemptedAtIso))
      ),
    createdAtIso: iso(row.created_at),
    updatedAtIso: iso(row.updated_at ?? row.created_at),
    resolvedAtIso: nullableIso(row.resolved_at),
  };
}

function correctionSelectSql(whereClause: string): string {
  return `
    select
      correction.id::text,
      correction.owner_user_id,
      correction.dealer_user_id,
      correction.asset_register_item_id::text,
      asset.title as asset_title,
      correction.source_type,
      correction.source_id,
      correction.dealer_name,
      correction.actor_name,
      correction.current_serial_number,
      correction.proposed_serial_number,
      correction.current_replacement_price_ex_vat,
      correction.proposed_replacement_price_ex_vat,
      correction.current_license_renewal_date,
      correction.proposed_license_renewal_date,
      correction.serial_number_changed,
      correction.replacement_price_changed,
      correction.license_renewal_date_changed,
      correction.status,
      correction.revaluation_status,
      correction.revaluation_attempt_count,
      correction.revaluation_last_attempted_at,
      correction.revaluation_completed_at,
      correction.revaluation_run_id,
      correction.revaluation_previous_run_id,
      correction.revaluation_previous_value_ex_vat,
      correction.revaluation_new_value_ex_vat,
      correction.revaluation_failure_code,
      correction.revaluation_failure_message,
      correction.created_at,
      correction.updated_at,
      correction.resolved_at
    from public.dealer_asset_correction_requests correction
    left join public.asset_register_items asset on asset.id = correction.asset_register_item_id
    ${whereClause}
  `;
}

async function ensureDealerAssetCorrectionTablesOnce(): Promise<void> {
  const db = getDb();
  const schemaReady = await isDatabaseSchemaReady(() => db.query(`
    select
      id,
      owner_user_id,
      dealer_user_id,
      asset_register_item_id,
      source_type,
      source_id,
      serial_number_changed,
      replacement_price_changed,
      license_renewal_date_changed,
      current_license_renewal_date,
      proposed_license_renewal_date,
      status,
      revaluation_status,
      revaluation_attempt_count,
      revaluation_last_attempted_at,
      revaluation_completed_at,
      revaluation_run_id,
      revaluation_previous_run_id,
      revaluation_previous_value_ex_vat,
      revaluation_new_value_ex_vat,
      revaluation_failure_code,
      revaluation_failure_message,
      created_at,
      updated_at
    from public.dealer_asset_correction_requests
    where false
  `));

  if (schemaReady) {
    return;
  }

  await db.query('create extension if not exists pgcrypto');
  await db.query(`
    create table if not exists public.dealer_asset_correction_requests (
      id uuid primary key default gen_random_uuid(),
      owner_user_id text not null,
      dealer_user_id text not null,
      asset_register_item_id uuid not null references public.asset_register_items(id) on delete cascade,
      source_type text not null check (source_type in ('lead', 'maintenance')),
      source_id text not null,
      dealer_name text not null,
      actor_name text not null,
      current_serial_number text,
      proposed_serial_number text,
      current_replacement_price_ex_vat numeric(14, 2),
      proposed_replacement_price_ex_vat numeric(14, 2),
      current_license_renewal_date date,
      proposed_license_renewal_date date,
      serial_number_changed boolean not null default false,
      replacement_price_changed boolean not null default false,
      license_renewal_date_changed boolean not null default false,
      status text not null default 'pending' check (status in ('pending', 'accepted', 'rejected', 'superseded')),
      resolved_by_user_id text,
      resolved_at timestamptz,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now(),
      check ((serial_number_changed::int + replacement_price_changed::int + license_renewal_date_changed::int) = 1)
    )
  `);
  await db.query(`
    alter table public.dealer_asset_correction_requests
      add column if not exists current_license_renewal_date date,
      add column if not exists proposed_license_renewal_date date,
      add column if not exists license_renewal_date_changed boolean not null default false,
      add column if not exists revaluation_status text not null default 'not_required',
      add column if not exists revaluation_attempt_count integer not null default 0,
      add column if not exists revaluation_last_attempted_at timestamptz,
      add column if not exists revaluation_completed_at timestamptz,
      add column if not exists revaluation_run_id bigint,
      add column if not exists revaluation_previous_run_id bigint,
      add column if not exists revaluation_previous_value_ex_vat numeric(14, 2),
      add column if not exists revaluation_new_value_ex_vat numeric(14, 2),
      add column if not exists revaluation_failure_code text,
      add column if not exists revaluation_failure_message text
  `);
  await db.query(`
    update public.dealer_asset_correction_requests
    set
      revaluation_status = coalesce(nullif(revaluation_status, ''), 'not_required'),
      revaluation_attempt_count = greatest(coalesce(revaluation_attempt_count, 0), 0)
    where revaluation_status is null
       or revaluation_status = ''
       or revaluation_attempt_count is null
       or revaluation_attempt_count < 0
  `);
  await db.query(`
    do $$
    begin
      if not exists (
        select 1
        from pg_constraint
        where conname = 'dealer_asset_correction_revaluation_status_check'
          and conrelid = 'public.dealer_asset_correction_requests'::regclass
      ) then
        alter table public.dealer_asset_correction_requests
          add constraint dealer_asset_correction_revaluation_status_check
          check (revaluation_status in ('not_required', 'pending', 'succeeded', 'failed')) not valid;
      end if;

      if not exists (
        select 1
        from pg_constraint
        where conname = 'dealer_asset_correction_revaluation_attempt_count_check'
          and conrelid = 'public.dealer_asset_correction_requests'::regclass
      ) then
        alter table public.dealer_asset_correction_requests
          add constraint dealer_asset_correction_revaluation_attempt_count_check
          check (revaluation_attempt_count >= 0) not valid;
      end if;
    end;
    $$;
  `);
  await db.query(`
    update public.dealer_asset_correction_requests
    set status = 'superseded',
        resolved_at = coalesce(resolved_at, now()),
        updated_at = now()
    where status = 'pending'
      and (serial_number_changed::int + replacement_price_changed::int + license_renewal_date_changed::int) > 1
  `);
  await db.query(`
    with ranked_pending as (
      select
        id,
        row_number() over (
          partition by owner_user_id, asset_register_item_id
          order by updated_at desc, id desc
        ) as pending_rank
      from public.dealer_asset_correction_requests
      where status = 'pending'
    )
    update public.dealer_asset_correction_requests correction
    set status = 'superseded',
        resolved_at = coalesce(correction.resolved_at, now()),
        updated_at = now()
    from ranked_pending
    where correction.id = ranked_pending.id
      and ranked_pending.pending_rank > 1
  `);
  await db.query(`
    alter table public.dealer_asset_correction_requests
      drop constraint if exists dealer_asset_correction_requests_check,
      drop constraint if exists dealer_asset_correction_single_field_check;
    alter table public.dealer_asset_correction_requests
      add constraint dealer_asset_correction_single_field_check
      check ((serial_number_changed::int + replacement_price_changed::int + license_renewal_date_changed::int) = 1) not valid;
  `);
  await db.query(`
    create unique index if not exists dealer_asset_correction_asset_pending_unique_idx
      on public.dealer_asset_correction_requests (owner_user_id, asset_register_item_id)
      where status = 'pending'
  `);
  await db.query(`
    create index if not exists dealer_asset_correction_owner_pending_idx
      on public.dealer_asset_correction_requests (owner_user_id, status, updated_at desc)
  `);
  await db.query(`
    create index if not exists dealer_asset_correction_dealer_pending_idx
      on public.dealer_asset_correction_requests (dealer_user_id, status, updated_at desc)
  `);
  await db.query(`
    create index if not exists dealer_asset_correction_owner_revaluation_idx
      on public.dealer_asset_correction_requests (
        owner_user_id,
        revaluation_status,
        revaluation_last_attempted_at desc
      )
      where status = 'accepted' and replacement_price_changed = true
  `);
}

export async function ensureDealerAssetCorrectionTables(): Promise<void> {
  if (!dealerAssetCorrectionTablesPromise) {
    dealerAssetCorrectionTablesPromise = ensureDealerAssetCorrectionTablesOnce().catch((error) => {
      dealerAssetCorrectionTablesPromise = null;
      throw error;
    });
  }
  await dealerAssetCorrectionTablesPromise;
}

async function resolveDealerAccess(input: {
  dealerUserId: string;
  sourceType: DealerAssetCorrectionSource;
  sourceId: string;
  field: DealerAssetCorrectionField;
}): Promise<CorrectionAccessRow | null> {
  const db = getDb();

  if (input.sourceType === 'lead') {
    const result = await db.query<CorrectionAccessRow>(
      `
        select owner_user_id, asset_register_item_id::text
        from public.asset_leads
        where id = $1::uuid
          and partner_user_id = $2
          and ($3 <> 'licenseRenewalDate' or lead_type = 'license_renewal')
        limit 1
      `,
      [input.sourceId, input.dealerUserId, input.field],
    );
    return result.rows[0] ?? null;
  }

  const result = await db.query<CorrectionAccessRow>(
    `
      select owner_user_id, asset_register_item_id::text
      from public.dealer_maintenance_access
      where id = $1::uuid
        and dealer_user_id = $2
        and is_active = true
        and (
          ($3 = 'serialNumber' and can_update_serial = true)
          or ($3 = 'replacementPriceExVat' and can_update_replacement_price = true)
        )
      limit 1
    `,
    [input.sourceId, input.dealerUserId, input.field],
  );
  return result.rows[0] ?? null;
}

export async function createOrUpdateDealerAssetCorrection(input: {
  dealerUserId: string;
  dealerName: string;
  actorName: string;
  sourceType: DealerAssetCorrectionSource;
  sourceId: string;
  field: DealerAssetCorrectionField;
  value: unknown;
}): Promise<DealerAssetCorrectionRequest> {
  await ensureDealerAssetCorrectionTables();
  const sourceId = asText(input.sourceId);
  if (!sourceId) throw new Error('CORRECTION_SOURCE_REQUIRED');

  const access = await resolveDealerAccess({
    dealerUserId: input.dealerUserId,
    sourceType: input.sourceType,
    sourceId,
    field: input.field,
  });
  if (!access) throw new Error('CORRECTION_FORBIDDEN');

  const asset = await getAssetRegisterItemById(access.owner_user_id, access.asset_register_item_id);
  if (!asset) throw new Error('ASSET_NOT_FOUND');

  const serialNumber = input.field === 'serialNumber'
    ? asText(input.value).slice(0, 200)
    : null;
  const replacementPriceExVat = input.field === 'replacementPriceExVat'
    ? asNumber(input.value)
    : null;
  const licenseRenewalDate = input.field === 'licenseRenewalDate'
    ? dateOnly(input.value)
    : null;

  if (input.field === 'serialNumber' && !serialNumber) {
    throw new Error('SERIAL_NUMBER_REQUIRED');
  }
  if (
    input.field === 'replacementPriceExVat'
    && (replacementPriceExVat === null || replacementPriceExVat <= 0 || replacementPriceExVat > 999_999_999_999)
  ) {
    throw new Error('REPLACEMENT_PRICE_INVALID');
  }
  if (input.field === 'licenseRenewalDate' && !licenseRenewalDate) {
    throw new Error('LICENSE_RENEWAL_DATE_INVALID');
  }

  const roundedReplacementPrice = replacementPriceExVat === null
    ? null
    : Math.round(replacementPriceExVat * 100) / 100;
  const db = getDb();
  const client = await db.connect();

  try {
    await client.query('begin');
    await client.query(
      `
        select id
        from public.asset_register_items
        where id = $1::uuid and user_id = $2
        for update
      `,
      [asset.id, access.owner_user_id],
    );
    const existingResult = await client.query<DealerAssetCorrectionRow>(
      `${correctionSelectSql(`
        where correction.owner_user_id = $1
          and correction.asset_register_item_id = $2::uuid
          and correction.status = 'pending'
      `)} for update of correction`,
      [access.owner_user_id, asset.id],
    );
    const existing = existingResult.rows[0] ? mapCorrection(existingResult.rows[0]) : null;
    if (existing) {
      throw new Error(
        existing.serialNumberChanged
          ? 'CORRECTION_SERIAL_PENDING'
          : existing.replacementPriceChanged
            ? 'CORRECTION_REPLACEMENT_PENDING'
            : 'CORRECTION_LICENSE_RENEWAL_PENDING',
      );
    }

    const proposedSerialNumber = input.field === 'serialNumber'
      ? serialNumber
      : null;
    const proposedReplacementPriceExVat = input.field === 'replacementPriceExVat'
      ? roundedReplacementPrice
      : null;
    const proposedLicenseRenewalDate = input.field === 'licenseRenewalDate'
      ? licenseRenewalDate
      : null;
    const serialNumberChanged = Boolean(proposedSerialNumber && proposedSerialNumber !== asset.serialNumber);
    const replacementPriceChanged = proposedReplacementPriceExVat !== null
      && proposedReplacementPriceExVat !== asset.replacementPriceExVat;
    const currentLicenseRenewalDate = assetLicenseRenewalDate(asset);
    const licenseRenewalDateChanged = Boolean(
      proposedLicenseRenewalDate && proposedLicenseRenewalDate !== currentLicenseRenewalDate,
    );

    if (!serialNumberChanged && !replacementPriceChanged && !licenseRenewalDateChanged) {
      throw new Error('CORRECTION_NO_CHANGES');
    }

    const dealerName = asText(input.dealerName).slice(0, 160) || 'Dealer';
    const actorName = asText(input.actorName).slice(0, 160) || dealerName;
    const inserted = await client.query<{ id: string }>(
      `
        insert into public.dealer_asset_correction_requests (
          owner_user_id,
          dealer_user_id,
          asset_register_item_id,
          source_type,
          source_id,
          dealer_name,
          actor_name,
          current_serial_number,
          proposed_serial_number,
          current_replacement_price_ex_vat,
          proposed_replacement_price_ex_vat,
          current_license_renewal_date,
          proposed_license_renewal_date,
          serial_number_changed,
          replacement_price_changed,
          license_renewal_date_changed,
          status,
          created_at,
          updated_at
        )
        values ($1, $2, $3::uuid, $4, $5, $6, $7, $8, $9, $10, $11, $12::date, $13::date, $14, $15, $16, 'pending', now(), now())
        returning id::text
      `,
      [
        access.owner_user_id,
        input.dealerUserId,
        asset.id,
        input.sourceType,
        sourceId,
        dealerName,
        actorName,
        serialNumberChanged ? asset.serialNumber || null : null,
        serialNumberChanged ? proposedSerialNumber : null,
        replacementPriceChanged ? asset.replacementPriceExVat : null,
        replacementPriceChanged ? proposedReplacementPriceExVat : null,
        licenseRenewalDateChanged ? currentLicenseRenewalDate || null : null,
        licenseRenewalDateChanged ? proposedLicenseRenewalDate : null,
        serialNumberChanged,
        replacementPriceChanged,
        licenseRenewalDateChanged,
      ],
    );
    const correctionId = inserted.rows[0]?.id ?? '';

    const loaded = await client.query<DealerAssetCorrectionRow>(
      `${correctionSelectSql('where correction.id = $1::uuid')} limit 1`,
      [correctionId],
    );
    await client.query('commit');
    if (!loaded.rows[0]) throw new Error('CORRECTION_NOT_CREATED');
    return mapCorrection(loaded.rows[0]);
  } catch (error) {
    await client.query('rollback').catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export async function listPendingDealerAssetCorrections(
  dealerUserId: string,
  assetIds?: string[],
): Promise<DealerAssetCorrectionRequest[]> {
  await ensureDealerAssetCorrectionTables();
  const normalizedAssetIds = Array.from(new Set((assetIds ?? []).map(asText).filter(Boolean)));
  const assetFilter = normalizedAssetIds.length ? 'and correction.asset_register_item_id = any($2::uuid[])' : '';
  const values: unknown[] = normalizedAssetIds.length ? [dealerUserId, normalizedAssetIds] : [dealerUserId];
  const result = await getDb().query<DealerAssetCorrectionRow>(
    `
      ${correctionSelectSql(`
        where correction.dealer_user_id = $1
          and correction.status = 'pending'
          ${assetFilter}
      `)}
      order by correction.updated_at desc, correction.id desc
    `,
    values,
  );
  return result.rows.map(mapCorrection);
}

export async function listPendingOwnerAssetCorrections(
  ownerUserId: string,
  assetIds?: string[],
): Promise<DealerAssetCorrectionRequest[]> {
  await ensureDealerAssetCorrectionTables();
  const normalizedAssetIds = Array.from(new Set((assetIds ?? []).map(asText).filter(Boolean)));
  const assetFilter = normalizedAssetIds.length ? 'and correction.asset_register_item_id = any($2::uuid[])' : '';
  const values: unknown[] = normalizedAssetIds.length ? [ownerUserId, normalizedAssetIds] : [ownerUserId];
  const result = await getDb().query<DealerAssetCorrectionRow>(
    `
      ${correctionSelectSql(`
        where correction.owner_user_id = $1
          and correction.status = 'pending'
          ${assetFilter}
      `)}
      order by correction.updated_at desc, correction.id desc
    `,
    values,
  );
  return result.rows.map(mapCorrection);
}

export async function listOwnerAssetCorrectionAlerts(
  ownerUserId: string,
  assetIds?: string[],
): Promise<DealerAssetCorrectionRequest[]> {
  await ensureDealerAssetCorrectionTables();
  const normalizedAssetIds = Array.from(new Set((assetIds ?? []).map(asText).filter(Boolean)));
  const assetFilter = normalizedAssetIds.length ? 'and correction.asset_register_item_id = any($2::uuid[])' : '';
  const values: unknown[] = normalizedAssetIds.length ? [ownerUserId, normalizedAssetIds] : [ownerUserId];
  const result = await getDb().query<DealerAssetCorrectionRow>(
    `
      ${correctionSelectSql(`
        where correction.owner_user_id = $1
          and (
            correction.status = 'pending'
            or (
              correction.status = 'accepted'
              and correction.replacement_price_changed = true
              and correction.revaluation_status in ('pending', 'failed')
            )
          )
          ${assetFilter}
      `)}
      order by correction.updated_at desc, correction.id desc
    `,
    values,
  );
  return result.rows.map(mapCorrection);
}

function replacementSnapshotPatch(value: number): Record<string, number> {
  return {
    replacementPriceExVat: value,
    replacement_price_ex_vat: value,
    replacementPriceUsedExVat: value,
    replacement_price_used_ex_vat: value,
    userReplacementPriceExVat: value,
    user_replacement_price_ex_vat: value,
    officialReplacementPriceExVat: value,
    official_replacement_price_ex_vat: value,
    replacementPrice: value,
    replacement_price: value,
  };
}

function firstAvailableColumn(columns: Map<string, TableColumnRow>, candidates: string[]): string | null {
  for (const candidate of candidates) {
    if (columns.has(candidate)) return candidate;
  }
  return null;
}

function quotedIdentifier(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

async function loadCorrectionTableColumns(
  client: PoolClient,
): Promise<{
  assetColumns: Map<string, TableColumnRow>;
  leadColumns: Map<string, TableColumnRow>;
}> {
  const result = await client.query<TableColumnRow>(
    `
      select table_name, column_name, data_type, udt_name
      from information_schema.columns
      where table_schema = 'public'
        and table_name = any($1::text[])
    `,
    [['asset_register_items', 'asset_leads']],
  );

  const assetColumns = new Map<string, TableColumnRow>();
  const leadColumns = new Map<string, TableColumnRow>();
  for (const row of result.rows) {
    if (row.table_name === 'asset_register_items') assetColumns.set(row.column_name, row);
    if (row.table_name === 'asset_leads') leadColumns.set(row.column_name, row);
  }

  return { assetColumns, leadColumns };
}

async function applyAcceptedCorrectionToAsset(input: {
  client: PoolClient;
  current: DealerAssetCorrectionRequest;
  ownerUserId: string;
  assetColumns: Map<string, TableColumnRow>;
}): Promise<Record<string, number>> {
  const { client, current, ownerUserId, assetColumns } = input;
  const userIdColumn = firstAvailableColumn(assetColumns, ['user_id']);
  const idColumn = firstAvailableColumn(assetColumns, ['id']);
  if (!userIdColumn || !idColumn) throw new Error('ASSET_UPDATE_UNSUPPORTED');

  const assignments: string[] = [];
  const values: unknown[] = [];
  const assignedColumns = new Set<string>();
  const pushValueAssignment = (column: string | null, value: unknown, cast = '') => {
    if (!column || assignedColumns.has(column)) return;
    values.push(value);
    assignments.push(`${quotedIdentifier(column)} = $${values.length}${cast}`);
    assignedColumns.add(column);
  };

  if (current.serialNumberChanged && current.proposedSerialNumber) {
    const serialColumn = firstAvailableColumn(assetColumns, ['serial_number', 'serial', 'vin']);
    if (!serialColumn) throw new Error('ASSET_UPDATE_UNSUPPORTED');
    pushValueAssignment(serialColumn, current.proposedSerialNumber);
  }

  let replacementPatch: Record<string, number> = {};
  if (current.replacementPriceChanged && current.proposedReplacementPriceExVat !== null) {
    const replacement = current.proposedReplacementPriceExVat;
    replacementPatch = replacementSnapshotPatch(replacement);

    const replacementColumn = firstAvailableColumn(assetColumns, [
      'replacement_price_used_ex_vat',
      'replacement_price_ex_vat',
      'official_replacement_price_ex_vat',
    ]);
    const userReplacementColumn = firstAvailableColumn(assetColumns, ['user_replacement_price_ex_vat']);
    const replacementBasisColumn = firstAvailableColumn(assetColumns, ['replacement_price_basis']);
    const specsColumn = firstAvailableColumn(assetColumns, ['specs_json']);

    pushValueAssignment(replacementColumn, replacement);
    pushValueAssignment(userReplacementColumn, replacement);
    // Keep this aligned with the established Asset Register write path. Some
    // deployed databases validate this field against the existing basis values.
    pushValueAssignment(replacementBasisColumn, 'user');

    if (specsColumn) {
      const specsMeta = assetColumns.get(specsColumn);
      values.push(JSON.stringify({
        ...replacementPatch,
        replacementPriceBasis: 'user',
        replacement_price_basis: 'user',
      }));
      const placeholder = `$${values.length}::jsonb`;
      if (specsMeta?.data_type === 'json' || specsMeta?.udt_name === 'json') {
        assignments.push(
          `${quotedIdentifier(specsColumn)} = (coalesce(${quotedIdentifier(specsColumn)}, '{}'::json)::jsonb || ${placeholder})::json`,
        );
      } else {
        assignments.push(
          `${quotedIdentifier(specsColumn)} = coalesce(${quotedIdentifier(specsColumn)}, '{}'::jsonb) || ${placeholder}`,
        );
      }
      assignedColumns.add(specsColumn);
    }

    if (!replacementColumn && !userReplacementColumn && !specsColumn) {
      throw new Error('ASSET_UPDATE_UNSUPPORTED');
    }
  }

  if (current.licenseRenewalDateChanged && current.proposedLicenseRenewalDate) {
    const specsColumn = firstAvailableColumn(assetColumns, ['specs_json']);
    if (!specsColumn) throw new Error('ASSET_UPDATE_UNSUPPORTED');
    const specsMeta = assetColumns.get(specsColumn);
    values.push(JSON.stringify({
      licenseRenewalDate: current.proposedLicenseRenewalDate,
      license_renewal_date: current.proposedLicenseRenewalDate,
      licenceRenewalDate: current.proposedLicenseRenewalDate,
      licence_renewal_date: current.proposedLicenseRenewalDate,
      licenseStatus: 'yes',
      license_status: 'yes',
    }));
    const placeholder = `$${values.length}::jsonb`;
    if (specsMeta?.data_type === 'json' || specsMeta?.udt_name === 'json') {
      assignments.push(
        `${quotedIdentifier(specsColumn)} = (coalesce(${quotedIdentifier(specsColumn)}, '{}'::json)::jsonb || ${placeholder})::json`,
      );
    } else {
      assignments.push(
        `${quotedIdentifier(specsColumn)} = coalesce(${quotedIdentifier(specsColumn)}, '{}'::jsonb) || ${placeholder}`,
      );
    }
    assignedColumns.add(specsColumn);
    pushValueAssignment(firstAvailableColumn(assetColumns, ['is_licensed']), true);
  }

  const updatedAtColumn = firstAvailableColumn(assetColumns, ['updated_at', 'modified_at', 'updatedon']);
  if (updatedAtColumn && !assignedColumns.has(updatedAtColumn)) {
    assignments.push(`${quotedIdentifier(updatedAtColumn)} = now()`);
  }
  if (!assignments.length) throw new Error('ASSET_UPDATE_UNSUPPORTED');

  values.push(current.assetId, ownerUserId);
  const updatedAsset = await client.query(
    `
      update public.asset_register_items
      set ${assignments.join(', ')}
      where ${quotedIdentifier(idColumn)} = $${values.length - 1}::uuid
        and ${quotedIdentifier(userIdColumn)} = $${values.length}
    `,
    values,
  );
  if (!updatedAsset.rowCount) throw new Error('ASSET_NOT_FOUND');

  return replacementPatch;
}

type AssetValuationState = {
  valueExVat: number | null;
  valuationRunId: number | null;
};

type LeadSnapshotRow = {
  id: string;
  asset_snapshot_json: unknown;
  included_sections_json: unknown;
};

function assetValuationStateSelect(
  assetColumns: Map<string, TableColumnRow>,
): { valueColumn: string | null; runColumn: string | null } {
  return {
    valueColumn: firstAvailableColumn(assetColumns, [
      'selected_value_ex_vat',
      'value',
      'selected_value',
      'saved_value_ex_vat',
      'aim4price_value_ex_vat',
    ]),
    runColumn: firstAvailableColumn(assetColumns, ['valuation_run_id', 'run_id']),
  };
}

async function lockAndReadAssetValuationState(input: {
  client: PoolClient;
  current: DealerAssetCorrectionRequest;
  ownerUserId: string;
  assetColumns: Map<string, TableColumnRow>;
}): Promise<AssetValuationState> {
  const idColumn = firstAvailableColumn(input.assetColumns, ['id']);
  const userIdColumn = firstAvailableColumn(input.assetColumns, ['user_id']);
  if (!idColumn || !userIdColumn) throw new Error('ASSET_UPDATE_UNSUPPORTED');
  const { valueColumn, runColumn } = assetValuationStateSelect(input.assetColumns);
  const result = await input.client.query<{
    value_ex_vat: string | number | null;
    valuation_run_id: string | number | null;
  }>(
    `
      select
        ${valueColumn ? `${quotedIdentifier(valueColumn)}::numeric` : 'null::numeric'} as value_ex_vat,
        ${runColumn ? `${quotedIdentifier(runColumn)}::bigint` : 'null::bigint'} as valuation_run_id
      from public.asset_register_items
      where ${quotedIdentifier(idColumn)} = $1::uuid
        and ${quotedIdentifier(userIdColumn)} = $2
      for update
    `,
    [input.current.assetId, input.ownerUserId],
  );
  if (!result.rows[0]) throw new Error('ASSET_NOT_FOUND');
  return {
    valueExVat: asNumber(result.rows[0].value_ex_vat),
    valuationRunId: asInteger(result.rows[0].valuation_run_id),
  };
}

function actualAssetSnapshotPatch(asset: AssetRegisterItem): {
  root: Record<string, unknown>;
  specs: Record<string, unknown>;
} {
  const replacementPatch = asset.replacementPriceExVat !== null
    ? replacementSnapshotPatch(asset.replacementPriceExVat)
    : {};
  const replacementBasis = asText(
    asset.specsJson.replacementPriceBasis ?? asset.specsJson.replacement_price_basis,
  ) || (asset.replacementPriceExVat !== null ? 'user' : '');
  const specs = {
    ...asset.specsJson,
    ...replacementPatch,
    ...(replacementBasis
      ? {
          replacementPriceBasis: replacementBasis,
          replacement_price_basis: replacementBasis,
        }
      : {}),
  };

  return {
    root: {
      id: asset.id,
      title: asset.title,
      kind: asset.kind,
      value: asset.value,
      selectedValueExVat: asset.selectedValueExVat,
      ...replacementPatch,
      ...(replacementBasis
        ? {
            replacementPriceBasis: replacementBasis,
            replacement_price_basis: replacementBasis,
          }
        : {}),
      valuationRunId: asset.valuationRunId,
      valuation_run_id: asset.valuationRunId,
      selectedMethod: asset.selectedMethod,
      brandName: asset.brandName,
      modelName: asset.modelName,
      typedModelName: asset.typedModelName,
      equipmentFamilyKey: asset.equipmentFamilyKey,
      equipmentFamilyLabel: asset.equipmentFamilyLabel,
      yearModel: asset.yearModel,
      hours: asset.hours,
      condition: asset.condition,
      depreciationMethodUsed: asset.depreciationMethodUsed,
      lifeWorkedPercent: asset.lifeWorkedPercent,
      lifeRemainingPercent: asset.lifeRemainingPercent,
      estimatedHours: asset.estimatedHours,
      maxLifetimeHours: asset.maxLifetimeHours,
      aim4priceValueExVat: asset.aim4priceValueExVat,
      marketMidExVat: asset.marketMidExVat,
      serialNumber: asset.serialNumber,
      updatedAtIso: asset.updatedAtIso,
      dealerCorrectionPending: false,
    },
    specs,
  };
}

function applyActualAssetToSnapshot(
  snapshotValue: unknown,
  asset: AssetRegisterItem,
): Record<string, unknown> {
  const snapshot = asRecord(snapshotValue);
  const patch = actualAssetSnapshotPatch(asset);
  const next: Record<string, unknown> = {
    ...snapshot,
    ...patch.root,
    specsJson: {
      ...asRecord(snapshot.specsJson),
      ...patch.specs,
    },
  };
  const registerSnapshot = asRecord(snapshot.registerSnapshot);
  if (Array.isArray(registerSnapshot.assets)) {
    next.registerSnapshot = {
      ...registerSnapshot,
      assets: registerSnapshot.assets.map((entry) => {
        const record = asRecord(entry);
        return asText(record.id) === asset.id
          ? {
              ...record,
              ...patch.root,
              specsJson: {
                ...asRecord(record.specsJson),
                ...patch.specs,
              },
            }
          : entry;
      }),
    };
  }
  return next;
}

async function syncDealerLeadSnapshotsWithAsset(
  ownerUserId: string,
  assetId: string,
): Promise<AssetRegisterItem | null> {
  const asset = await getAssetRegisterItemById(ownerUserId, assetId);
  if (!asset) return null;
  const db = getDb();
  const result = await db.query<LeadSnapshotRow>(
    `
      select id::text, asset_snapshot_json, included_sections_json
      from public.asset_leads
      where owner_user_id = $1 and asset_register_item_id = $2::uuid
    `,
    [ownerUserId, assetId],
  );

  for (const row of result.rows) {
    const includedSections = asRecord(row.included_sections_json);
    const includedRegisterSnapshot = asRecord(includedSections.registerSnapshot);
    const nextIncludedSections = Array.isArray(includedRegisterSnapshot.assets)
      ? {
          ...includedSections,
          registerSnapshot: {
            ...includedRegisterSnapshot,
            assets: includedRegisterSnapshot.assets.map((entry) => {
              const record = asRecord(entry);
              if (asText(record.id) !== asset.id) return entry;
              const patch = actualAssetSnapshotPatch(asset);
              return {
                ...record,
                ...patch.root,
                specsJson: {
                  ...asRecord(record.specsJson),
                  ...patch.specs,
                },
              };
            }),
          },
        }
      : includedSections;

    await db.query(
      `
        update public.asset_leads
        set asset_snapshot_json = $2::jsonb,
            included_sections_json = $3::jsonb,
            updated_at = now()
        where id = $1::uuid
      `,
      [
        row.id,
        JSON.stringify(applyActualAssetToSnapshot(row.asset_snapshot_json, asset)),
        JSON.stringify(nextIncludedSections),
      ],
    );
  }
  return asset;
}

function safeRevaluationFailure(error: unknown): { code: string; message: string } {
  const rawMessage = error instanceof Error ? error.message : '';
  const normalized = rawMessage.toLowerCase();

  if (rawMessage === 'ASSET_NOT_REVALUEABLE') {
    return {
      code: 'manual_or_unvalued_asset',
      message: 'This is a manual asset or it does not yet have an Aim4price valuation to recalculate.',
    };
  }
  if (rawMessage === 'VALUATION_RUN_NOT_FOUND') {
    return {
      code: 'missing_original_valuation',
      message: 'The original Aim4price valuation run could not be found.',
    };
  }
  if (
    normalized.includes('model link')
    || normalized.includes('brand link')
    || normalized.includes('equipment-family link')
    || normalized.includes('sector link')
  ) {
    return {
      code: 'missing_linked_model',
      message: 'This asset is missing a linked model or catalogue record needed for recalculation.',
    };
  }
  if (
    rawMessage === 'SELECTED_METHOD_NOT_AVAILABLE'
    || rawMessage === 'REPLACEMENT_PRICE_REQUIRED'
    || normalized.includes('missing its condition')
    || normalized.includes('missing its year')
    || normalized.includes('no valuation method')
  ) {
    return {
      code: 'insufficient_saved_valuation',
      message: 'There is not enough saved valuation information to recalculate this asset automatically.',
    };
  }
  return {
    code: 'temporary_revaluation_failure',
    message: 'Aim4price could not complete the automatic recalculation. Please try again.',
  };
}

function resolutionMessage(outcome: DealerAssetCorrectionResolutionOutcome): string {
  if (outcome === 'accepted_revalued') {
    return 'Dealer replacement price accepted. Aim4price recalculated the asset and saved the latest estimate.';
  }
  if (outcome === 'accepted_revaluation_failed') {
    return 'Replacement price accepted and saved. Aim4price could not recalculate this asset automatically.';
  }
  if (outcome === 'accepted_revaluation_pending') {
    return 'Replacement price accepted and saved. Aim4price recalculation is still pending.';
  }
  if (outcome === 'accepted_no_revaluation') {
    return 'Asset update accepted and saved. No valuation recalculation was required.';
  }
  return 'Asset update declined.';
}

async function loadOwnerCorrection(
  ownerUserId: string,
  correctionId: string,
): Promise<DealerAssetCorrectionRequest | null> {
  const result = await getDb().query<DealerAssetCorrectionRow>(
    `${correctionSelectSql(`
      where correction.id = $1::uuid
        and correction.owner_user_id = $2
    `)} limit 1`,
    [correctionId, ownerUserId],
  );
  return result.rows[0] ? mapCorrection(result.rows[0]) : null;
}

async function claimRevaluationAttempt(input: {
  ownerUserId: string;
  correctionId: string;
}): Promise<{
  action: 'run' | 'pending' | 'succeeded';
  correction: DealerAssetCorrectionRequest;
  asset: AssetRegisterItem | null;
}> {
  const currentAssetCorrection = await loadOwnerCorrection(input.ownerUserId, input.correctionId);
  if (!currentAssetCorrection) throw new Error('CORRECTION_NOT_FOUND');
  const currentAsset = await getAssetRegisterItemById(
    input.ownerUserId,
    currentAssetCorrection.assetId,
  );

  const db = getDb();
  const client = await db.connect();
  try {
    await client.query('begin');
    const result = await client.query<DealerAssetCorrectionRow>(
      `${correctionSelectSql(`
        where correction.id = $1::uuid
          and correction.owner_user_id = $2
      `)} for update of correction`,
      [input.correctionId, input.ownerUserId],
    );
    const correction = result.rows[0] ? mapCorrection(result.rows[0]) : null;
    if (!correction) throw new Error('CORRECTION_NOT_FOUND');
    if (correction.status !== 'accepted') throw new Error('CORRECTION_NOT_ACCEPTED');
    if (!correction.replacementPriceChanged || correction.proposedReplacementPriceExVat === null) {
      throw new Error('CORRECTION_REVALUATION_NOT_REQUIRED');
    }
    if (correction.revaluationStatus === 'succeeded') {
      await client.query('commit');
      return { action: 'succeeded', correction, asset: currentAsset };
    }
    if (
      correction.revaluationStatus === 'pending'
      && !isStaleRevaluationAttempt(correction.revaluationLastAttemptedAtIso)
    ) {
      await client.query('commit');
      return { action: 'pending', correction, asset: currentAsset };
    }

    const recoveredAfterInterruptedAttempt = Boolean(
      currentAsset
      && currentAsset.valuationRunId
      && currentAsset.valuationRunId !== correction.revaluationPreviousRunId
      && currentAsset.replacementPriceExVat === correction.proposedReplacementPriceExVat,
    );
    if (recoveredAfterInterruptedAttempt && currentAsset) {
      await client.query(
        `
          update public.dealer_asset_correction_requests
          set revaluation_status = 'succeeded',
              revaluation_completed_at = now(),
              revaluation_run_id = $3,
              revaluation_new_value_ex_vat = $4,
              revaluation_failure_code = null,
              revaluation_failure_message = null,
              updated_at = now()
          where id = $1::uuid and owner_user_id = $2
        `,
        [correction.id, input.ownerUserId, currentAsset.valuationRunId, currentAsset.value],
      );
      const recovered = await client.query<DealerAssetCorrectionRow>(
        `${correctionSelectSql('where correction.id = $1::uuid')} limit 1`,
        [correction.id],
      );
      await client.query('commit');
      return {
        action: 'succeeded',
        correction: recovered.rows[0] ? mapCorrection(recovered.rows[0]) : correction,
        asset: currentAsset,
      };
    }

    await client.query(
      `
        update public.dealer_asset_correction_requests
        set revaluation_status = 'pending',
            revaluation_attempt_count = revaluation_attempt_count + 1,
            revaluation_last_attempted_at = now(),
            revaluation_completed_at = null,
            revaluation_failure_code = null,
            revaluation_failure_message = null,
            updated_at = now()
        where id = $1::uuid and owner_user_id = $2
      `,
      [correction.id, input.ownerUserId],
    );
    const claimed = await client.query<DealerAssetCorrectionRow>(
      `${correctionSelectSql('where correction.id = $1::uuid')} limit 1`,
      [correction.id],
    );
    await client.query('commit');
    if (!claimed.rows[0]) throw new Error('CORRECTION_NOT_FOUND');
    return { action: 'run', correction: mapCorrection(claimed.rows[0]), asset: currentAsset };
  } catch (error) {
    await client.query('rollback').catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

async function attemptDealerAssetCorrectionRevaluation(input: {
  ownerUserId: string;
  correctionId: string;
}): Promise<DealerAssetCorrectionResolution> {
  const claimed = await claimRevaluationAttempt(input);
  if (claimed.action === 'succeeded') {
    if (claimed.asset) {
      await syncDealerLeadSnapshotsWithAsset(
        input.ownerUserId,
        claimed.correction.assetId,
      ).catch((error) => {
        console.error('Recovered dealer correction revaluation, but failed to refresh dealer lead snapshots.', error);
      });
    }
    return {
      correction: claimed.correction,
      outcome: 'accepted_revalued',
      message: resolutionMessage('accepted_revalued'),
      asset: claimed.asset,
    };
  }
  if (claimed.action === 'pending') {
    return {
      correction: claimed.correction,
      outcome: 'accepted_revaluation_pending',
      message: resolutionMessage('accepted_revaluation_pending'),
      asset: claimed.asset,
    };
  }

  try {
    const result = await revalueAssetRegisterItem({
      userId: input.ownerUserId,
      assetId: claimed.correction.assetId,
      replacementPriceExVat: claimed.correction.proposedReplacementPriceExVat,
      saveReplacementPrice: true,
      previewOnly: false,
    });
    await getDb().query(
      `
        update public.dealer_asset_correction_requests
        set revaluation_status = 'succeeded',
            revaluation_completed_at = now(),
            revaluation_run_id = $3,
            revaluation_previous_value_ex_vat = coalesce(revaluation_previous_value_ex_vat, $4),
            revaluation_new_value_ex_vat = $5,
            revaluation_failure_code = null,
            revaluation_failure_message = null,
            updated_at = now()
        where id = $1::uuid
          and owner_user_id = $2
          and revaluation_status = 'pending'
      `,
      [
        claimed.correction.id,
        input.ownerUserId,
        result.valuationRunId,
        result.oldValueExVat,
        result.newValueExVat,
      ],
    );
    let asset = result.item;
    try {
      asset = (await syncDealerLeadSnapshotsWithAsset(
        input.ownerUserId,
        claimed.correction.assetId,
      )) ?? result.item;
    } catch (error) {
      console.error('Revalued accepted dealer correction, but failed to refresh dealer lead snapshots.', error);
    }
    const correction = (await loadOwnerCorrection(input.ownerUserId, claimed.correction.id))
      ?? claimed.correction;
    return {
      correction,
      outcome: correction.revaluationStatus === 'succeeded'
        ? 'accepted_revalued'
        : 'accepted_revaluation_pending',
      message: resolutionMessage(
        correction.revaluationStatus === 'succeeded'
          ? 'accepted_revalued'
          : 'accepted_revaluation_pending',
      ),
      asset,
    };
  } catch (error) {
    const failure = safeRevaluationFailure(error);
    try {
      await getDb().query(
        `
          update public.dealer_asset_correction_requests
          set revaluation_status = 'failed',
              revaluation_completed_at = null,
              revaluation_failure_code = $3,
              revaluation_failure_message = $4,
              updated_at = now()
          where id = $1::uuid
            and owner_user_id = $2
            and revaluation_status = 'pending'
        `,
        [claimed.correction.id, input.ownerUserId, failure.code, failure.message],
      );
    } catch (stateError) {
      console.error('Automatic dealer correction revaluation failed and its failure state could not be finalized.', stateError);
    }
    const correction = (await loadOwnerCorrection(input.ownerUserId, claimed.correction.id))
      ?? claimed.correction;
    const asset = await getAssetRegisterItemById(
      input.ownerUserId,
      claimed.correction.assetId,
    ).catch(() => null);
    return {
      correction,
      outcome: correction.revaluationStatus === 'failed'
        ? 'accepted_revaluation_failed'
        : 'accepted_revaluation_pending',
      message: resolutionMessage(
        correction.revaluationStatus === 'failed'
          ? 'accepted_revaluation_failed'
          : 'accepted_revaluation_pending',
      ),
      asset,
    };
  }
}

export async function resolveDealerAssetCorrection(input: {
  ownerUserId: string;
  correctionId: string;
  decision: 'accept' | 'reject';
  resolvedByUserId: string;
}): Promise<DealerAssetCorrectionResolution> {
  await ensureDealerAssetCorrectionTables();
  const db = getDb();
  const client = await db.connect();
  let resolvedCorrection: DealerAssetCorrectionRequest | null = null;

  try {
    await client.query('begin');
    const currentResult = await client.query<DealerAssetCorrectionRow>(
      `${correctionSelectSql(`
        where correction.id = $1::uuid
          and correction.owner_user_id = $2
      `)} for update of correction`,
      [input.correctionId, input.ownerUserId],
    );
    const current = currentResult.rows[0] ? mapCorrection(currentResult.rows[0]) : null;
    if (!current) throw new Error('CORRECTION_NOT_FOUND');
    if (current.status !== 'pending') throw new Error('CORRECTION_ALREADY_RESOLVED');

    let previousValuationState: AssetValuationState = {
      valueExVat: null,
      valuationRunId: null,
    };
    if (input.decision === 'accept') {
      const { assetColumns } = await loadCorrectionTableColumns(client);
      previousValuationState = await lockAndReadAssetValuationState({
        client,
        current,
        ownerUserId: input.ownerUserId,
        assetColumns,
      });
      await applyAcceptedCorrectionToAsset({
        client,
        current,
        ownerUserId: input.ownerUserId,
        assetColumns,
      });
    }

    const needsRevaluation =
      input.decision === 'accept'
      && current.replacementPriceChanged
      && current.proposedReplacementPriceExVat !== null;
    await client.query(
      `
        update public.dealer_asset_correction_requests
        set status = $2,
            resolved_by_user_id = $3,
            resolved_at = now(),
            revaluation_status = $4,
            revaluation_attempt_count = 0,
            revaluation_last_attempted_at = null,
            revaluation_completed_at = null,
            revaluation_run_id = null,
            revaluation_previous_run_id = $5,
            revaluation_previous_value_ex_vat = $6,
            revaluation_new_value_ex_vat = null,
            revaluation_failure_code = null,
            revaluation_failure_message = null,
            updated_at = now()
        where id = $1::uuid
      `,
      [
        current.id,
        input.decision === 'accept' ? 'accepted' : 'rejected',
        input.resolvedByUserId,
        needsRevaluation ? 'pending' : 'not_required',
        needsRevaluation ? previousValuationState.valuationRunId : null,
        needsRevaluation ? previousValuationState.valueExVat : null,
      ],
    );

    const resolvedResult = await client.query<DealerAssetCorrectionRow>(
      `${correctionSelectSql('where correction.id = $1::uuid')} limit 1`,
      [current.id],
    );
    if (!resolvedResult.rows[0]) throw new Error('CORRECTION_NOT_FOUND');
    resolvedCorrection = mapCorrection(resolvedResult.rows[0]);
    await client.query('commit');
  } catch (error) {
    await client.query('rollback').catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }

  if (!resolvedCorrection) throw new Error('CORRECTION_NOT_FOUND');
  if (input.decision === 'reject') {
    return {
      correction: resolvedCorrection,
      outcome: 'rejected',
      message: resolutionMessage('rejected'),
      asset: await getAssetRegisterItemById(input.ownerUserId, resolvedCorrection.assetId),
    };
  }

  let acceptedAsset: AssetRegisterItem | null = null;
  try {
    acceptedAsset = await syncDealerLeadSnapshotsWithAsset(
      input.ownerUserId,
      resolvedCorrection.assetId,
    );
  } catch (error) {
    console.error('Accepted dealer correction, but failed to refresh dealer lead snapshots.', error);
  }

  if (!resolvedCorrection.replacementPriceChanged) {
    return {
      correction: resolvedCorrection,
      outcome: 'accepted_no_revaluation',
      message: resolutionMessage('accepted_no_revaluation'),
      asset: acceptedAsset ?? await getAssetRegisterItemById(input.ownerUserId, resolvedCorrection.assetId),
    };
  }

  try {
    return await attemptDealerAssetCorrectionRevaluation({
      ownerUserId: input.ownerUserId,
      correctionId: resolvedCorrection.id,
    });
  } catch (error) {
    const failure = safeRevaluationFailure(error);
    console.error('Accepted dealer correction, but automatic revaluation could not be started.', error);
    try {
      await getDb().query(
        `
          update public.dealer_asset_correction_requests
          set revaluation_status = 'failed',
              revaluation_completed_at = null,
              revaluation_failure_code = $3,
              revaluation_failure_message = $4,
              updated_at = now()
          where id = $1::uuid
            and owner_user_id = $2
            and revaluation_status = 'pending'
        `,
        [resolvedCorrection.id, input.ownerUserId, failure.code, failure.message],
      );
    } catch (stateError) {
      console.error('Automatic dealer correction revaluation could not start and its failure state could not be finalized.', stateError);
    }

    const latestCorrection = await loadOwnerCorrection(
      input.ownerUserId,
      resolvedCorrection.id,
    ).catch(() => null) ?? resolvedCorrection;
    const outcome: DealerAssetCorrectionResolutionOutcome =
      latestCorrection.revaluationStatus === 'failed'
        ? 'accepted_revaluation_failed'
        : 'accepted_revaluation_pending';
    const asset = acceptedAsset ?? await getAssetRegisterItemById(
      input.ownerUserId,
      resolvedCorrection.assetId,
    ).catch(() => null);
    return {
      correction: latestCorrection,
      outcome,
      message: resolutionMessage(outcome),
      asset,
    };
  }
}

export async function retryDealerAssetCorrectionRevaluation(input: {
  ownerUserId: string;
  correctionId: string;
}): Promise<DealerAssetCorrectionResolution> {
  await ensureDealerAssetCorrectionTables();
  return attemptDealerAssetCorrectionRevaluation(input);
}

export function applyDealerCorrectionToSnapshot(
  snapshot: Record<string, unknown>,
  correction: DealerAssetCorrectionRequest,
): Record<string, unknown> {
  const next = { ...snapshot };

  if (correction.serialNumberChanged && correction.proposedSerialNumber) {
    next.serialNumber = correction.proposedSerialNumber;
  }

  if (correction.replacementPriceChanged && correction.proposedReplacementPriceExVat !== null) {
    const replacementPatch = replacementSnapshotPatch(correction.proposedReplacementPriceExVat);
    Object.assign(next, replacementPatch);
    const specs = next.specsJson && typeof next.specsJson === 'object' && !Array.isArray(next.specsJson)
      ? next.specsJson as Record<string, unknown>
      : {};
    next.specsJson = { ...specs, ...replacementPatch };
  }

  if (correction.licenseRenewalDateChanged && correction.proposedLicenseRenewalDate) {
    const specs = next.specsJson && typeof next.specsJson === 'object' && !Array.isArray(next.specsJson)
      ? next.specsJson as Record<string, unknown>
      : {};
    const renewalPatch = {
      licenseRenewalDate: correction.proposedLicenseRenewalDate,
      license_renewal_date: correction.proposedLicenseRenewalDate,
      licenceRenewalDate: correction.proposedLicenseRenewalDate,
      licence_renewal_date: correction.proposedLicenseRenewalDate,
    };
    Object.assign(next, renewalPatch);
    next.specsJson = { ...specs, ...renewalPatch };
  }

  next.dealerCorrectionPending = true;
  next.dealerCorrectionUpdatedAtIso = correction.updatedAtIso;
  return next;
}
