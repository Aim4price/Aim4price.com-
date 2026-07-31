import { getAccountProfile } from './account-profile';
import {
  getAssetRegisterItemById,
  listAssetRegisterItems,
  updateAssetRegisterItemMedia,
  updateAssetRegisterItemStatusDetails,
  type AssetRegisterDocument,
  type AssetRegisterItem,
} from './asset-register-db';
import {
  MAX_ASSET_REGISTER_DOCUMENTS,
  MAX_ASSET_REGISTER_DOCUMENT_UPLOAD_BYTES,
  createAssetRegisterUpload,
  isAllowedAssetRegisterDocument,
} from './asset-register-uploads';
import { ensureAssetRegisterTables, getAssetRegisterForUser, type AssetRegisterSummary } from './asset-registers';
import { getDb } from './db';
import { listFuelLedger, type FuelLedgerData } from './fuel-ledger';
import { listMyInvoicesData, type MyInvoiceListResult } from './my-invoices';
import { ensurePartnerAccessTables } from './partner-access';

export type AccountantRegisterAccess = {
  shareId: string;
  ownerUserId: string;
  accountantUserId: string;
  accountantName: string;
  accountantOrganisation: string;
  ownerName: string;
  ownerBusinessName: string;
  registerId: string;
  registerName: string;
  assetCount: number;
  totalValue: number;
  dateSharedIso: string;
  lastUpdatedIso: string;
  lastViewedAtIso: string | null;
  accessStatus: 'active' | 'removed' | 'revoked';
  allowDirectUpdates: boolean;
  includeFuelLedger: boolean;
  includeCostLedger: boolean;
};

export type AccountingValueReference = {
  id: string;
  assetId: string;
  carryingValue: number;
  asAtDate: string;
  sourceReference: string;
  updatedByUserId: string;
  updatedByName: string;
  updatedByOrganisation: string;
  updatedAtIso: string;
};

export type AccountantAsset = AssetRegisterItem & {
  accountingValue: AccountingValueReference | null;
};

type AccessRow = {
  share_id: string;
  owner_user_id: string;
  partner_user_id: string;
  register_id: string;
  register_name: string | null;
  owner_display_name: string | null;
  owner_business_name: string | null;
  accountant_display_name: string | null;
  accountant_business_name: string | null;
  account_type: string | null;
  account_subtype: string | null;
  asset_count: string | number | null;
  total_value: string | number | null;
  created_at: string | null;
  updated_at: string | null;
  register_updated_at: string | null;
  last_viewed_at: string | null;
  access_status: string | null;
  allow_direct_updates: boolean | null;
  include_fuel_ledger: boolean | null;
  include_cost_ledger: boolean | null;
};

type AccountingValueRow = {
  id: string;
  asset_register_item_id: string;
  carrying_value: string | number;
  as_at_date: string;
  source_reference: string | null;
  updated_by_user_id: string;
  updated_by_name: string | null;
  updated_by_organisation: string | null;
  updated_at: string;
};

let accountantWorkspaceSchemaPromise: Promise<void> | null = null;

function text(value: unknown): string {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function numberValue(value: unknown): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? Math.round(parsed * 100) / 100 : 0;
}

function booleanValue(value: unknown): boolean {
  if (typeof value === 'boolean') return value;
  return ['1', 'true', 'yes', 'on', 'enabled'].includes(text(value).toLowerCase());
}

function dateOnly(value: unknown, fallback = new Date()): string {
  const raw = text(value);
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  return fallback.toISOString().slice(0, 10);
}

function accessStatus(value: unknown): 'active' | 'removed' | 'revoked' {
  const normalized = text(value).toLowerCase();
  return normalized === 'removed' || normalized === 'revoked' ? normalized : 'active';
}

function mapAccess(row: AccessRow): AccountantRegisterAccess {
  return {
    shareId: row.share_id,
    ownerUserId: row.owner_user_id,
    accountantUserId: row.partner_user_id,
    accountantName: text(row.accountant_display_name) || 'Accountant',
    accountantOrganisation: text(row.accountant_business_name) || text(row.accountant_display_name) || 'Accountant',
    ownerName: text(row.owner_display_name) || text(row.owner_business_name) || 'Aim4price owner',
    ownerBusinessName: text(row.owner_business_name) || text(row.owner_display_name) || 'Aim4price owner',
    registerId: row.register_id,
    registerName: text(row.register_name) || 'Asset Register',
    assetCount: Math.max(0, Math.round(numberValue(row.asset_count))),
    totalValue: Math.round(numberValue(row.total_value)),
    dateSharedIso: row.created_at || new Date().toISOString(),
    lastUpdatedIso: row.register_updated_at || row.updated_at || row.created_at || new Date().toISOString(),
    lastViewedAtIso: row.last_viewed_at,
    accessStatus: accessStatus(row.access_status),
    allowDirectUpdates: Boolean(row.allow_direct_updates),
    includeFuelLedger: Boolean(row.include_fuel_ledger),
    includeCostLedger: Boolean(row.include_cost_ledger),
  };
}

function mapAccountingValue(row: AccountingValueRow): AccountingValueReference {
  return {
    id: row.id,
    assetId: row.asset_register_item_id,
    carryingValue: numberValue(row.carrying_value),
    asAtDate: dateOnly(row.as_at_date),
    sourceReference: text(row.source_reference),
    updatedByUserId: row.updated_by_user_id,
    updatedByName: text(row.updated_by_name),
    updatedByOrganisation: text(row.updated_by_organisation),
    updatedAtIso: row.updated_at || new Date().toISOString(),
  };
}

async function ensureAccountantWorkspaceSchemaOnce(): Promise<void> {
  await Promise.all([ensurePartnerAccessTables(), ensureAssetRegisterTables()]);
  const db = getDb();

  await db.query(`
    alter table public.asset_leads
      add column if not exists access_status text not null default 'active',
      add column if not exists access_removed_at timestamptz,
      add column if not exists allow_direct_updates boolean not null default false,
      add column if not exists include_fuel_ledger boolean not null default false,
      add column if not exists include_cost_ledger boolean not null default false
  `);
  await db.query(`
    alter table public.asset_register_items
      add column if not exists lifecycle_state text not null default 'active'
  `);
  await db.query(`
    create table if not exists public.asset_accounting_values (
      id uuid primary key default gen_random_uuid(), owner_user_id text not null,
      asset_register_item_id uuid not null references public.asset_register_items(id) on delete cascade,
      carrying_value numeric(14,2) not null, as_at_date date not null, source_reference text,
      updated_by_user_id text not null, updated_by_name text, updated_by_organisation text,
      created_at timestamptz not null default now(), updated_at timestamptz not null default now()
    )
  `);
  await db.query(`create unique index if not exists idx_asset_accounting_values_current on public.asset_accounting_values(owner_user_id, asset_register_item_id)`);
  await db.query(`
    create table if not exists public.asset_accountant_documents (
      id uuid primary key default gen_random_uuid(), owner_user_id text not null,
      accountant_user_id text not null, accountant_organisation text,
      asset_register_item_id uuid not null references public.asset_register_items(id) on delete cascade,
      access_lead_id uuid not null references public.asset_leads(id) on delete restrict,
      upload_id text not null, upload_url text not null, file_name text not null,
      content_type text, byte_size integer, created_at timestamptz not null default now()
    )
  `);
}

export async function ensureAccountantWorkspaceSchema(): Promise<void> {
  if (!accountantWorkspaceSchemaPromise) {
    accountantWorkspaceSchemaPromise = ensureAccountantWorkspaceSchemaOnce().catch((error) => {
      accountantWorkspaceSchemaPromise = null;
      throw error;
    });
  }
  return accountantWorkspaceSchemaPromise;
}

const ACCESS_SELECT = `
  select
    l.id::text as share_id, l.owner_user_id, l.partner_user_id,
    ar.id::text as register_id, ar.business_name as register_name,
    owner.display_name as owner_display_name, owner.business_name as owner_business_name,
    accountant.display_name as accountant_display_name, accountant.business_name as accountant_business_name,
    accountant.account_type, accountant.account_subtype,
    coalesce(stats.asset_count, 0)::int as asset_count,
    coalesce(stats.total_value, 0)::numeric as total_value,
    l.created_at::text, l.updated_at::text, ar.updated_at::text as register_updated_at,
    l.viewed_at::text as last_viewed_at, l.access_status, l.allow_direct_updates,
    l.include_fuel_ledger, l.include_cost_ledger
  from public.asset_leads l
  inner join public.account_profiles accountant on accountant.user_id = l.partner_user_id
  left join public.account_profiles owner on owner.user_id = l.owner_user_id
  inner join public.asset_register_items anchor
    on anchor.id = l.asset_register_item_id and anchor.user_id = l.owner_user_id
  inner join public.asset_registers ar
    on ar.id = anchor.register_id and ar.user_id = l.owner_user_id
  left join lateral (
    select count(*)::int as asset_count,
      coalesce(sum(coalesce(ai.value, ai.selected_value_ex_vat, 0)), 0)::numeric as total_value
    from public.asset_register_items ai
    where ai.user_id = l.owner_user_id and ai.register_id = ar.id
      and coalesce(ai.lifecycle_state, 'active') = 'active'
  ) stats on true
`;

async function loadAccess(accountantUserId: string, shareId: string, includeRemoved = false): Promise<AccountantRegisterAccess> {
  await ensureAccountantWorkspaceSchema();
  const result = await getDb().query<AccessRow>(
    `${ACCESS_SELECT}
     where l.id = $1::uuid and l.partner_user_id = $2 and l.lead_type = 'finance'
       and coalesce(l.included_sections_json ->> 'source', '') = 'full_asset_register'
       ${includeRemoved ? '' : "and l.access_status = 'active' and l.access_removed_at is null"}
     limit 1`,
    [shareId, accountantUserId],
  );
  const row = result.rows[0];
  if (!row) throw new Error('ACCOUNTANT_REGISTER_NOT_FOUND');
  if (text(row.account_type).toLowerCase() !== 'finance' || text(row.account_subtype).toLowerCase() !== 'accountant') {
    throw new Error('ACCOUNTANT_ACCESS_REQUIRED');
  }
  return mapAccess(row);
}

export async function listAccountantRegisters(accountantUserId: string): Promise<AccountantRegisterAccess[]> {
  await ensureAccountantWorkspaceSchema();
  const result = await getDb().query<AccessRow>(
    `${ACCESS_SELECT}
     where l.partner_user_id = $1 and l.lead_type = 'finance'
       and accountant.account_type = 'finance' and accountant.account_subtype = 'accountant'
       and coalesce(l.included_sections_json ->> 'source', '') = 'full_asset_register'
       and l.access_status = 'active' and l.access_removed_at is null
     order by coalesce(ar.updated_at, l.updated_at, l.created_at) desc`,
    [accountantUserId],
  );
  return result.rows.map(mapAccess);
}

export async function getAccountantRegisterData(accountantUserId: string, shareId: string): Promise<{
  access: AccountantRegisterAccess;
  register: AssetRegisterSummary;
  registers: AssetRegisterSummary[];
  items: AccountantAsset[];
}> {
  const access = await loadAccess(accountantUserId, shareId);
  const [register, items] = await Promise.all([
    getAssetRegisterForUser(access.ownerUserId, access.registerId),
    listAssetRegisterItems(access.ownerUserId, access.registerId),
  ]);
  if (!register) throw new Error('ACCOUNTANT_REGISTER_NOT_FOUND');

  const values = items.length
    ? await getDb().query<AccountingValueRow>(
        `select id::text, asset_register_item_id::text, carrying_value, as_at_date::text,
                source_reference, updated_by_user_id, updated_by_name, updated_by_organisation, updated_at::text
         from public.asset_accounting_values
         where owner_user_id = $1 and asset_register_item_id = any($2::uuid[])`,
        [access.ownerUserId, items.map((item) => item.id)],
      )
    : { rows: [] as AccountingValueRow[] };
  const byAsset = new Map(values.rows.map((row) => [row.asset_register_item_id, mapAccountingValue(row)]));

  await getDb().query(
    `update public.asset_leads set viewed_at = coalesce(viewed_at, now()), status = case when status = 'sent' then 'viewed' else status end,
       updated_at = greatest(updated_at, now()) where id = $1::uuid and partner_user_id = $2`,
    [shareId, accountantUserId],
  );

  return {
    access,
    register,
    registers: [register],
    items: items.map((item) => ({ ...item, accountingValue: byAsset.get(item.id) ?? null })),
  };
}

export async function removeAccountantRegisterAccess(accountantUserId: string, shareId: string): Promise<void> {
  const access = await loadAccess(accountantUserId, shareId);
  await getDb().query(
    `update public.asset_leads
     set access_status = 'removed', access_removed_at = now(), status = 'closed', closed_at = coalesce(closed_at, now()), updated_at = now()
     where id = $1::uuid and partner_user_id = $2`,
    [shareId, accountantUserId],
  );
  await writeAudit(access, accountantUserId, 'accountant_register_access_removed', 'asset_lead', shareId, {
    registerId: access.registerId,
    registerName: access.registerName,
  });
}

export async function syncAccountantShareSettingsFromLead(leadId: string, includedSections: Record<string, unknown>): Promise<void> {
  if (text(includedSections.source) !== 'full_asset_register') return;
  await ensureAccountantWorkspaceSchema();
  await getDb().query(
    `update public.asset_leads
     set access_status = 'active', access_removed_at = null,
         allow_direct_updates = $2, include_fuel_ledger = $3, include_cost_ledger = $4,
         updated_at = now()
     where id = $1::uuid and lead_type = 'finance'`,
    [leadId, booleanValue(includedSections.allowDirectUpdates), booleanValue(includedSections.includeFuelLedger), booleanValue(includedSections.includeCostLedger)],
  );
}

async function authorisedAsset(accountantUserId: string, shareId: string, assetId: string, requireWrite = false) {
  const access = await loadAccess(accountantUserId, shareId);
  if (requireWrite && !access.allowDirectUpdates) throw new Error('ACCOUNTANT_READ_ONLY');
  const asset = await getAssetRegisterItemById(access.ownerUserId, assetId);
  if (!asset || asset.registerId !== access.registerId) throw new Error('ACCOUNTANT_ASSET_NOT_FOUND');
  return { access, asset };
}

function optionalNumber(value: unknown): number | null {
  if (value === null || typeof value === 'undefined' || text(value) === '') return null;
  const parsed = Number(String(value).replace(/[^0-9.-]+/g, ''));
  return Number.isFinite(parsed) && parsed >= 0 ? Math.round(parsed * 100) / 100 : null;
}

function financeSpecs(body: Record<string, unknown>): Record<string, unknown> {
  const status = ['yes', 'no', 'unknown', 'not_applicable'].includes(text(body.financeStatus)) ? text(body.financeStatus) : 'unknown';
  const values: Record<string, unknown> = {
    financeStatus: status, finance_status: status,
    financeType: text(body.financeType) || null, finance_type: text(body.financeType) || null,
    financierName: text(body.financierName) || null, financier_name: text(body.financierName) || null,
    financeCurrentOutstandingExVat: optionalNumber(body.outstandingBalance), finance_current_outstanding_ex_vat: optionalNumber(body.outstandingBalance),
    financeOriginalAmountExVat: optionalNumber(body.originalAmount), finance_original_amount_ex_vat: optionalNumber(body.originalAmount),
    financeMonthlyPaymentExVat: optionalNumber(body.instalment), finance_monthly_payment_ex_vat: optionalNumber(body.instalment),
    financeBalloonPaymentExVat: optionalNumber(body.balloon), finance_balloon_payment_ex_vat: optionalNumber(body.balloon),
    financeSettlementAmountExVat: optionalNumber(body.settlementAmount), finance_settlement_amount_ex_vat: optionalNumber(body.settlementAmount),
    financeSettlementDate: text(body.settlementDate) || null, finance_settlement_date: text(body.settlementDate) || null,
    financeStartDate: text(body.startDate) || null, finance_start_date: text(body.startDate) || null,
    financeEndDate: text(body.endDate) || null, finance_end_date: text(body.endDate) || null,
    financeLatestBalanceDate: text(body.latestBalanceDate) || null, finance_latest_balance_date: text(body.latestBalanceDate) || null,
    financeReferenceNumber: text(body.referenceNumber) || null, finance_reference_number: text(body.referenceNumber) || null,
    financeSourceReference: text(body.sourceReference) || null, finance_source_reference: text(body.sourceReference) || null,
    financeSecurityDescription: text(body.securityDescription) || null, finance_security_description: text(body.securityDescription) || null,
  };
  return values;
}

export async function updateAccountantFinance(input: {
  accountantUserId: string;
  shareId: string;
  assetId: string;
  body: Record<string, unknown>;
}): Promise<AccountantAsset> {
  const { access, asset } = await authorisedAsset(input.accountantUserId, input.shareId, input.assetId, true);
  const actor = await getAccountProfile({ id: input.accountantUserId });
  const specs = financeSpecs(input.body);
  const status = text(specs.financeStatus);
  const before: Record<string, unknown> = { isFinanced: asset.isFinanced, financeNote: asset.financeNote, ...asset.specsJson };
  const updated = await updateAssetRegisterItemStatusDetails(access.ownerUserId, {
    assetId: asset.id,
    isFinanced: status === 'yes',
    financeNote: text(input.body.financeNote) || null,
    specsJson: specs,
  });
  const after: Record<string, unknown> = { isFinanced: updated.isFinanced, financeNote: updated.financeNote, ...specs };
  const changedFields = Object.keys(after).filter((key) => JSON.stringify(before[key]) !== JSON.stringify(after[key]));

  for (const field of changedFields) {
    await writeAudit(access, input.accountantUserId, 'accountant_direct_finance_update', 'asset_register_item', asset.id, {
      accountantName: actor.displayName || actor.name,
      accountantOrganisation: actor.businessName,
      assetTitle: asset.title,
      changedField: field,
      previousValue: before[field] ?? null,
      newValue: after[field] ?? null,
      source: text(input.body.sourceReference) || null,
    });
  }
  return { ...updated, accountingValue: await getAccountingValue(access.ownerUserId, asset.id) };
}

async function getAccountingValue(ownerUserId: string, assetId: string): Promise<AccountingValueReference | null> {
  const result = await getDb().query<AccountingValueRow>(
    `select id::text, asset_register_item_id::text, carrying_value, as_at_date::text, source_reference,
            updated_by_user_id, updated_by_name, updated_by_organisation, updated_at::text
     from public.asset_accounting_values where owner_user_id = $1 and asset_register_item_id = $2::uuid limit 1`,
    [ownerUserId, assetId],
  );
  return result.rows[0] ? mapAccountingValue(result.rows[0]) : null;
}

export async function saveAccountantCarryingValue(input: {
  accountantUserId: string; shareId: string; assetId: string;
  carryingValue: unknown; asAtDate: unknown; sourceReference: unknown;
}): Promise<AccountingValueReference> {
  const { access, asset } = await authorisedAsset(input.accountantUserId, input.shareId, input.assetId, true);
  const carryingValue = optionalNumber(input.carryingValue);
  if (carryingValue === null) throw new Error('ACCOUNTING_VALUE_REQUIRED');
  const actor = await getAccountProfile({ id: input.accountantUserId });
  const previous = await getAccountingValue(access.ownerUserId, asset.id);
  const result = await getDb().query<AccountingValueRow>(
    `insert into public.asset_accounting_values
       (owner_user_id, asset_register_item_id, carrying_value, as_at_date, source_reference,
        updated_by_user_id, updated_by_name, updated_by_organisation, created_at, updated_at)
     values ($1, $2::uuid, $3, $4::date, $5, $6, $7, $8, now(), now())
     on conflict (owner_user_id, asset_register_item_id) do update
       set carrying_value = excluded.carrying_value, as_at_date = excluded.as_at_date,
           source_reference = excluded.source_reference, updated_by_user_id = excluded.updated_by_user_id,
           updated_by_name = excluded.updated_by_name, updated_by_organisation = excluded.updated_by_organisation,
           updated_at = now()
     returning id::text, asset_register_item_id::text, carrying_value, as_at_date::text, source_reference,
               updated_by_user_id, updated_by_name, updated_by_organisation, updated_at::text`,
    [access.ownerUserId, asset.id, carryingValue, dateOnly(input.asAtDate), text(input.sourceReference) || null,
      input.accountantUserId, actor.displayName || actor.name, actor.businessName],
  );
  const saved = mapAccountingValue(result.rows[0]);
  await writeAudit(access, input.accountantUserId, 'accountant_carrying_value_updated', 'asset_register_item', asset.id, {
    accountantName: saved.updatedByName,
    accountantOrganisation: saved.updatedByOrganisation,
    assetId: asset.id,
    assetTitle: asset.title,
    changedField: 'accountingCarryingValue',
    previousValue: previous?.carryingValue ?? null,
    newValue: saved.carryingValue,
    asAtDate: saved.asAtDate,
    source: saved.sourceReference || null,
  });
  return saved;
}

export async function uploadAccountantDocument(input: {
  accountantUserId: string; shareId: string; assetId: string; file: File;
}): Promise<AccountantAsset> {
  const { access, asset } = await authorisedAsset(input.accountantUserId, input.shareId, input.assetId, true);
  if (!isAllowedAssetRegisterDocument(input.file)) throw new Error('ACCOUNTANT_DOCUMENT_TYPE_INVALID');
  if (!input.file.size || input.file.size > MAX_ASSET_REGISTER_DOCUMENT_UPLOAD_BYTES) throw new Error('ACCOUNTANT_DOCUMENT_SIZE_INVALID');
  if (asset.documents.length >= MAX_ASSET_REGISTER_DOCUMENTS) throw new Error('ACCOUNTANT_DOCUMENT_LIMIT');
  const actor = await getAccountProfile({ id: input.accountantUserId });
  const upload = await createAssetRegisterUpload({ userId: access.ownerUserId, file: input.file });
  const document: AssetRegisterDocument = {
    id: upload.id, url: upload.url, fileName: upload.fileName, contentType: upload.contentType,
    byteSize: upload.byteSize, uploadedAtIso: new Date().toISOString(),
  };
  const updated = await updateAssetRegisterItemMedia(access.ownerUserId, {
    assetId: asset.id,
    photos: asset.photos,
    documents: [...asset.documents, document].slice(0, MAX_ASSET_REGISTER_DOCUMENTS),
  });
  await getDb().query(
    `insert into public.asset_accountant_documents
       (owner_user_id, accountant_user_id, accountant_organisation, asset_register_item_id, access_lead_id,
        upload_id, upload_url, file_name, content_type, byte_size)
     values ($1, $2, $3, $4::uuid, $5::uuid, $6, $7, $8, $9, $10)`,
    [access.ownerUserId, input.accountantUserId, actor.businessName, asset.id, access.shareId,
      upload.id, upload.url, upload.fileName, upload.contentType, upload.byteSize],
  );
  await writeAudit(access, input.accountantUserId, 'accountant_document_uploaded', 'asset_register_item', asset.id, {
    accountantName: actor.displayName || actor.name,
    accountantOrganisation: actor.businessName,
    assetTitle: asset.title,
    changedField: 'documents', previousValue: asset.documents.length, newValue: updated.documents.length,
    source: upload.fileName,
  });
  return { ...updated, accountingValue: await getAccountingValue(access.ownerUserId, asset.id) };
}

export async function getAccountantLedger(input: {
  accountantUserId: string; shareId: string; kind: 'fuel' | 'cost';
}): Promise<{ access: AccountantRegisterAccess; fuel?: FuelLedgerData; cost?: MyInvoiceListResult }> {
  const access = await loadAccess(input.accountantUserId, input.shareId);
  const assets = await listAssetRegisterItems(access.ownerUserId, access.registerId);
  const assetIds = new Set(assets.map((asset) => asset.id));
  if (input.kind === 'fuel') {
    if (!access.includeFuelLedger) throw new Error('ACCOUNTANT_FUEL_NOT_SHARED');
    const ledger = await listFuelLedger(access.ownerUserId);
    return {
      access,
      fuel: {
        ...ledger,
        assets: ledger.assets.filter((asset) => assetIds.has(asset.id)),
        recentEvents: ledger.recentEvents.filter((event) => !event.assetId || assetIds.has(event.assetId)),
        recentFuelSlips: ledger.recentFuelSlips.filter((slip) => !slip.assetId || assetIds.has(slip.assetId)),
      },
    };
  }
  if (!access.includeCostLedger) throw new Error('ACCOUNTANT_COST_NOT_SHARED');
  const ledger = await listMyInvoicesData(access.ownerUserId, {});
  return {
    access,
    cost: {
      ...ledger,
      assets: ledger.assets.filter((asset) => assetIds.has(asset.id)),
      invoices: ledger.invoices.filter((invoice) => assetIds.has(invoice.assetId)),
      summary: ledger.invoices.filter((invoice) => assetIds.has(invoice.assetId)).reduce(
        (summary, invoice) => ({
          ...summary,
          totalSpent: summary.totalSpent + invoice.totalIncVat,
          vatTotal: summary.vatTotal + (invoice.vatAmount ?? 0),
          invoiceCount: summary.invoiceCount + 1,
          maintenanceSpend: summary.maintenanceSpend + (invoice.blocks.find((block) => block.blockType === 'maintenance')?.totalIncVat ?? 0),
          partsSpend: summary.partsSpend + (invoice.blocks.find((block) => block.blockType === 'parts')?.totalIncVat ?? 0),
          repairSpend: summary.repairSpend + (invoice.blocks.find((block) => block.blockType === 'repair')?.totalIncVat ?? 0),
          otherSpend: summary.otherSpend + (invoice.blocks.find((block) => block.blockType === 'other')?.totalIncVat ?? 0),
        }),
        { totalSpent: 0, maintenanceSpend: 0, partsSpend: 0, repairSpend: 0, otherSpend: 0, vatTotal: 0, invoiceCount: 0 },
      ),
    },
  };
}

async function writeAudit(
  access: AccountantRegisterAccess,
  actorUserId: string,
  eventType: string,
  entityType: string,
  entityId: string,
  metadata: Record<string, unknown>,
): Promise<void> {
  await getDb().query(
    `insert into public.access_audit_events
       (owner_user_id, actor_user_id, event_type, entity_type, entity_id, metadata_json, created_at)
     values ($1, $2, $3, $4, $5, $6::jsonb, now())`,
    [access.ownerUserId, actorUserId, eventType, entityType, entityId, JSON.stringify({
      registerId: access.registerId,
      accountantOrganisation: access.accountantOrganisation,
      ...metadata,
    })],
  );
}

export function accountantWorkspaceError(error: unknown): { status: number; message: string } {
  const code = error instanceof Error ? error.message : '';
  if (code === 'ACCOUNTANT_ACCESS_REQUIRED') return { status: 403, message: 'This workspace is only available to accountant accounts.' };
  if (code === 'ACCOUNTANT_READ_ONLY') return { status: 403, message: 'The owner has not enabled Allow direct updates for this register.' };
  if (code.includes('NOT_SHARED')) return { status: 403, message: 'The owner has not shared this ledger.' };
  if (code.includes('NOT_FOUND')) return { status: 404, message: 'This shared Asset Register is unavailable or access has ended.' };
  if (code === 'ACCOUNTING_VALUE_REQUIRED') return { status: 400, message: 'Enter a valid accounting carrying value.' };
  if (code.includes('DOCUMENT')) return { status: 400, message: 'The document could not be saved. Check its type, size and the asset document limit.' };
  return { status: 500, message: 'The Accountant Workspace request could not be completed.' };
}
