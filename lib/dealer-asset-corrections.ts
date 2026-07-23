import type { PoolClient } from 'pg';
import { getAssetRegisterItemById } from './asset-register-db';
import { getDb } from './db';

export type DealerAssetCorrectionSource = 'lead' | 'maintenance';
export type DealerAssetCorrectionField = 'serialNumber' | 'replacementPriceExVat';
export type DealerAssetCorrectionStatus = 'pending' | 'accepted' | 'rejected' | 'superseded';

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
  serialNumberChanged: boolean;
  replacementPriceChanged: boolean;
  status: DealerAssetCorrectionStatus;
  createdAtIso: string;
  updatedAtIso: string;
  resolvedAtIso: string | null;
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
  serial_number_changed: boolean | null;
  replacement_price_changed: boolean | null;
  status: string;
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

function asText(value: unknown): string {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function asNumber(value: unknown): number | null {
  if (value === null || typeof value === 'undefined' || value === '') return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
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

function normalizeSource(value: unknown): DealerAssetCorrectionSource | null {
  const source = asText(value).toLowerCase();
  return source === 'lead' || source === 'maintenance' ? source : null;
}

function normalizeStatus(value: unknown): DealerAssetCorrectionStatus {
  const status = asText(value).toLowerCase();
  if (status === 'accepted' || status === 'rejected' || status === 'superseded') return status;
  return 'pending';
}

function mapCorrection(row: DealerAssetCorrectionRow): DealerAssetCorrectionRequest {
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
    serialNumberChanged: Boolean(row.serial_number_changed),
    replacementPriceChanged: Boolean(row.replacement_price_changed),
    status: normalizeStatus(row.status),
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
      correction.serial_number_changed,
      correction.replacement_price_changed,
      correction.status,
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
      serial_number_changed boolean not null default false,
      replacement_price_changed boolean not null default false,
      status text not null default 'pending' check (status in ('pending', 'accepted', 'rejected', 'superseded')),
      resolved_by_user_id text,
      resolved_at timestamptz,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now(),
      check (serial_number_changed or replacement_price_changed)
    )
  `);
  await db.query(`
    update public.dealer_asset_correction_requests
    set status = 'superseded',
        resolved_at = coalesce(resolved_at, now()),
        updated_at = now()
    where status = 'pending'
      and serial_number_changed = true
      and replacement_price_changed = true
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
    do $$
    begin
      if not exists (
        select 1
        from pg_constraint
        where conname = 'dealer_asset_correction_single_field_check'
          and conrelid = 'public.dealer_asset_correction_requests'::regclass
      ) then
        alter table public.dealer_asset_correction_requests
          add constraint dealer_asset_correction_single_field_check
          check (serial_number_changed <> replacement_price_changed) not valid;
      end if;
    end;
    $$;
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
}): Promise<CorrectionAccessRow | null> {
  const db = getDb();

  if (input.sourceType === 'lead') {
    const result = await db.query<CorrectionAccessRow>(
      `
        select owner_user_id, asset_register_item_id::text
        from public.asset_leads
        where id = $1::uuid and partner_user_id = $2
        limit 1
      `,
      [input.sourceId, input.dealerUserId],
    );
    return result.rows[0] ?? null;
  }

  const result = await db.query<CorrectionAccessRow>(
    `
      select owner_user_id, asset_register_item_id::text
      from public.dealer_maintenance_access
      where id = $1::uuid and dealer_user_id = $2 and is_active = true
      limit 1
    `,
    [input.sourceId, input.dealerUserId],
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

  if (input.field === 'serialNumber' && !serialNumber) {
    throw new Error('SERIAL_NUMBER_REQUIRED');
  }
  if (
    input.field === 'replacementPriceExVat'
    && (replacementPriceExVat === null || replacementPriceExVat <= 0 || replacementPriceExVat > 999_999_999_999)
  ) {
    throw new Error('REPLACEMENT_PRICE_INVALID');
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
          : 'CORRECTION_REPLACEMENT_PENDING',
      );
    }

    const proposedSerialNumber = input.field === 'serialNumber'
      ? serialNumber
      : null;
    const proposedReplacementPriceExVat = input.field === 'replacementPriceExVat'
      ? roundedReplacementPrice
      : null;
    const serialNumberChanged = Boolean(proposedSerialNumber && proposedSerialNumber !== asset.serialNumber);
    const replacementPriceChanged = proposedReplacementPriceExVat !== null
      && proposedReplacementPriceExVat !== asset.replacementPriceExVat;

    if (!serialNumberChanged && !replacementPriceChanged) {
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
          serial_number_changed,
          replacement_price_changed,
          status,
          created_at,
          updated_at
        )
        values ($1, $2, $3::uuid, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, 'pending', now(), now())
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
        serialNumberChanged,
        replacementPriceChanged,
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
    pushValueAssignment(replacementBasisColumn, 'dealer_accepted');

    if (specsColumn) {
      const specsMeta = assetColumns.get(specsColumn);
      values.push(JSON.stringify({
        ...replacementPatch,
        replacementPriceBasis: 'dealer_accepted',
        replacement_price_basis: 'dealer_accepted',
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

async function applyAcceptedCorrectionToLeadSnapshots(input: {
  client: PoolClient;
  current: DealerAssetCorrectionRequest;
  ownerUserId: string;
  replacementPatch: Record<string, number>;
  leadColumns: Map<string, TableColumnRow>;
}): Promise<void> {
  const {
    client,
    current,
    ownerUserId,
    replacementPatch,
    leadColumns,
  } = input;
  const ownerColumn = firstAvailableColumn(leadColumns, ['owner_user_id']);
  const assetColumn = firstAvailableColumn(leadColumns, ['asset_register_item_id']);
  const snapshotColumn = firstAvailableColumn(leadColumns, ['asset_snapshot_json']);
  if (!ownerColumn || !assetColumn || !snapshotColumn) return;

  const rootSnapshotPatch: Record<string, unknown> = {
    updatedAtIso: new Date().toISOString(),
  };
  if (current.serialNumberChanged && current.proposedSerialNumber) {
    rootSnapshotPatch.serialNumber = current.proposedSerialNumber;
  }
  Object.assign(rootSnapshotPatch, replacementPatch);

  const snapshotMeta = leadColumns.get(snapshotColumn);
  const snapshotIdentifier = quotedIdentifier(snapshotColumn);
  const ownerIdentifier = quotedIdentifier(ownerColumn);
  const assetIdentifier = quotedIdentifier(assetColumn);
  const isJsonColumn = snapshotMeta?.data_type === 'json' || snapshotMeta?.udt_name === 'json';

  if (Object.keys(replacementPatch).length) {
    const mergedSnapshot = `jsonb_set(
      coalesce(${snapshotIdentifier}${isJsonColumn ? '::jsonb' : ''}, '{}'::jsonb) || $3::jsonb,
      '{specsJson}',
      coalesce(${snapshotIdentifier}${isJsonColumn ? '::jsonb' : ''}->'specsJson', '{}'::jsonb) || $4::jsonb,
      true
    )`;
    await client.query(
      `
        update public.asset_leads
        set ${snapshotIdentifier} = ${isJsonColumn ? `(${mergedSnapshot})::json` : mergedSnapshot}
        where ${ownerIdentifier} = $1 and ${assetIdentifier} = $2::uuid
      `,
      [ownerUserId, current.assetId, JSON.stringify(rootSnapshotPatch), JSON.stringify(replacementPatch)],
    );
    return;
  }

  const mergedSnapshot = `coalesce(${snapshotIdentifier}${isJsonColumn ? '::jsonb' : ''}, '{}'::jsonb) || $3::jsonb`;
  await client.query(
    `
      update public.asset_leads
      set ${snapshotIdentifier} = ${isJsonColumn ? `(${mergedSnapshot})::json` : mergedSnapshot}
      where ${ownerIdentifier} = $1 and ${assetIdentifier} = $2::uuid
    `,
    [ownerUserId, current.assetId, JSON.stringify(rootSnapshotPatch)],
  );
}

export async function resolveDealerAssetCorrection(input: {
  ownerUserId: string;
  correctionId: string;
  decision: 'accept' | 'reject';
  resolvedByUserId: string;
}): Promise<DealerAssetCorrectionRequest> {
  await ensureDealerAssetCorrectionTables();
  const db = getDb();
  const client = await db.connect();

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

    if (input.decision === 'accept') {
      const { assetColumns, leadColumns } = await loadCorrectionTableColumns(client);
      const replacementPatch = await applyAcceptedCorrectionToAsset({
        client,
        current,
        ownerUserId: input.ownerUserId,
        assetColumns,
      });
      await applyAcceptedCorrectionToLeadSnapshots({
        client,
        current,
        ownerUserId: input.ownerUserId,
        replacementPatch,
        leadColumns,
      });
    }

    await client.query(
      `
        update public.dealer_asset_correction_requests
        set status = $2,
            resolved_by_user_id = $3,
            resolved_at = now(),
            updated_at = now()
        where id = $1::uuid
      `,
      [current.id, input.decision === 'accept' ? 'accepted' : 'rejected', input.resolvedByUserId],
    );

    const resolvedResult = await client.query<DealerAssetCorrectionRow>(
      `${correctionSelectSql('where correction.id = $1::uuid')} limit 1`,
      [current.id],
    );
    await client.query('commit');
    if (!resolvedResult.rows[0]) throw new Error('CORRECTION_NOT_FOUND');
    return mapCorrection(resolvedResult.rows[0]);
  } catch (error) {
    await client.query('rollback').catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
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

  next.dealerCorrectionPending = true;
  next.dealerCorrectionUpdatedAtIso = correction.updatedAtIso;
  return next;
}
