import { getAccountProfile } from './account-profile';
import { listAssetGroups } from './asset-groups';
import { projectAssetGroupsToAssets, type AssetGroup } from './asset-groups-shared';
import {
  getAssetRegisterItemById,
  listAssetRegisterItems,
  updateAssetRegisterItemFlag,
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
import { ensureAssetRegisterTables, getAssetRegisterForUser, listAssetRegisters, type AssetRegisterSummary } from './asset-registers';
import { getDb } from './db';
import { listFuelLedger, type FuelLedgerData } from './fuel-ledger';
import { listMyInvoicesData, type MyInvoiceListResult } from './my-invoices';
import { ensurePartnerAccessTables, type AssetPartnerNote } from './partner-access';

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
  originalAccountingCost: number | null;
  accumulatedDepreciation: number | null;
  sourceAccountingSystem: string;
  accountantNote: string;
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
  original_accounting_cost: string | number | null;
  accumulated_depreciation: string | number | null;
  source_accounting_system: string | null;
  accountant_note: string | null;
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
    originalAccountingCost: row.original_accounting_cost === null ? null : numberValue(row.original_accounting_cost),
    accumulatedDepreciation: row.accumulated_depreciation === null ? null : numberValue(row.accumulated_depreciation),
    sourceAccountingSystem: text(row.source_accounting_system),
    accountantNote: text(row.accountant_note),
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
    alter table public.asset_accounting_values
      add column if not exists original_accounting_cost numeric(14,2),
      add column if not exists accumulated_depreciation numeric(14,2),
      add column if not exists source_accounting_system text,
      add column if not exists accountant_note text
  `);
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

export async function getAccountantRegisterAccess(input: {
  accountantUserId: string;
  shareId: string;
  ledger?: 'fuel' | 'cost';
  requireWrite?: boolean;
}): Promise<AccountantRegisterAccess> {
  const access = await loadAccess(input.accountantUserId, input.shareId);

  if (input.ledger === 'fuel' && !access.includeFuelLedger) {
    throw new Error('ACCOUNTANT_FUEL_NOT_SHARED');
  }

  if (input.ledger === 'cost' && !access.includeCostLedger) {
    throw new Error('ACCOUNTANT_COST_NOT_SHARED');
  }

  if (input.requireWrite && !access.allowDirectUpdates) {
    throw new Error('ACCOUNTANT_READ_ONLY');
  }

  return access;
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

export async function getAccountantRegisterData(
  accountantUserId: string,
  shareId: string,
  options: { registerId?: string | null; combined?: boolean } = {},
): Promise<{
  access: AccountantRegisterAccess;
  profile: Awaited<ReturnType<typeof getAccountProfile>>;
  register: AssetRegisterSummary;
  registers: AssetRegisterSummary[];
  items: AccountantAsset[];
  groups: AssetGroup[];
}> {
  const access = await loadAccess(accountantUserId, shareId);
  const [profile, registers] = await Promise.all([
    getAccountProfile({ id: access.ownerUserId }),
    listAssetRegisters(access.ownerUserId),
  ]);
  const requestedRegisterId = String(options.registerId ?? '').trim() || access.registerId;
  const selectedRegister = registers.find((entry) => entry.id === requestedRegisterId) ?? null;
  if (!selectedRegister) throw new Error('ACCOUNTANT_REGISTER_NOT_FOUND');
  const items = options.combined
    ? (await Promise.all(registers.map((entry) => listAssetRegisterItems(access.ownerUserId, entry.id)))).flat()
    : await listAssetRegisterItems(access.ownerUserId, selectedRegister.id);
  const groups = projectAssetGroupsToAssets(
    options.combined
      ? await listAssetGroups(access.ownerUserId)
      : await listAssetGroups(access.ownerUserId, selectedRegister.id),
    items,
  );
  const register: AssetRegisterSummary = options.combined
    ? {
        id: '__combined_asset_registers__',
        userId: access.ownerUserId,
        businessName: 'Combined Asset Registers',
        email: '',
        phone: '',
        addressLine1: 'All asset registers on this account',
        logoUrls: [],
        showLogosOnRegister: false,
        isPrimary: false,
        isSelected: false,
        assetCount: registers.reduce((sum, entry) => sum + entry.assetCount, 0),
        totalValue: registers.reduce((sum, entry) => sum + entry.totalValue, 0),
        totalReplacementPrice: registers.reduce((sum, entry) => sum + entry.totalReplacementPrice, 0),
        unnotedAlertCount: registers.reduce((sum, entry) => sum + entry.unnotedAlertCount, 0),
        createdAtIso: registers[0]?.createdAtIso ?? new Date().toISOString(),
        updatedAtIso: registers[0]?.updatedAtIso ?? new Date().toISOString(),
      }
    : selectedRegister;
  if (!register) throw new Error('ACCOUNTANT_REGISTER_NOT_FOUND');

  const values = items.length
    ? await getDb().query<AccountingValueRow>(
        `select id::text, asset_register_item_id::text, carrying_value, as_at_date::text,
                original_accounting_cost, accumulated_depreciation, source_accounting_system, accountant_note,
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
    profile,
    register,
    registers,
    groups,
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
  const register = asset?.registerId ? await getAssetRegisterForUser(access.ownerUserId, asset.registerId) : null;
  if (!asset || !register) throw new Error('ACCOUNTANT_ASSET_NOT_FOUND');
  return { access, asset };
}

function optionalNumber(value: unknown): number | null {
  if (value === null || typeof value === 'undefined' || text(value) === '') return null;
  const parsed = Number(String(value).replace(/[^0-9.-]+/g, ''));
  return Number.isFinite(parsed) && parsed >= 0 ? Math.round(parsed * 100) / 100 : null;
}

function financeSpecs(body: Record<string, unknown>): Record<string, unknown> {
  const status = ['yes', 'paid', 'no', 'unknown', 'not_applicable'].includes(text(body.financeStatus)) ? text(body.financeStatus) : 'unknown';
  const hasFinanceHistory = status === 'yes' || status === 'paid';
  const values: Record<string, unknown> = {
    financeStatus: status, finance_status: status,
    financeType: hasFinanceHistory ? text(body.financeType) || null : null, finance_type: hasFinanceHistory ? text(body.financeType) || null : null,
    financierName: hasFinanceHistory ? text(body.financierName) || null : null, financier_name: hasFinanceHistory ? text(body.financierName) || null : null,
    financeBoughtWhen: text(body.financeBoughtWhen) || null, finance_bought_when: text(body.financeBoughtWhen) || null,
    financeBoughtForExVat: optionalNumber(body.financeBoughtForExVat), finance_bought_for_ex_vat: optionalNumber(body.financeBoughtForExVat),
    financeCurrentOutstandingExVat: status === 'yes' ? optionalNumber(body.outstandingBalance) : null, finance_current_outstanding_ex_vat: status === 'yes' ? optionalNumber(body.outstandingBalance) : null,
    financeOriginalAmountExVat: hasFinanceHistory ? optionalNumber(body.originalAmount) : null, finance_original_amount_ex_vat: hasFinanceHistory ? optionalNumber(body.originalAmount) : null,
    financeMonthlyPaymentExVat: hasFinanceHistory ? optionalNumber(body.instalment) : null, finance_monthly_payment_ex_vat: hasFinanceHistory ? optionalNumber(body.instalment) : null,
    financeBalloonPaymentExVat: hasFinanceHistory ? optionalNumber(body.balloon) : null, finance_balloon_payment_ex_vat: hasFinanceHistory ? optionalNumber(body.balloon) : null,
    financeSettlementAmountExVat: hasFinanceHistory ? optionalNumber(body.settlementAmount) : null, finance_settlement_amount_ex_vat: hasFinanceHistory ? optionalNumber(body.settlementAmount) : null,
    financeSettlementDate: hasFinanceHistory ? text(body.settlementDate) || null : null, finance_settlement_date: hasFinanceHistory ? text(body.settlementDate) || null : null,
    financeStartDate: hasFinanceHistory ? text(body.startDate) || null : null, finance_start_date: hasFinanceHistory ? text(body.startDate) || null : null,
    financeEndDate: hasFinanceHistory ? text(body.endDate) || null : null, finance_end_date: hasFinanceHistory ? text(body.endDate) || null : null,
    financeLatestBalanceDate: hasFinanceHistory ? text(body.latestBalanceDate) || null : null, finance_latest_balance_date: hasFinanceHistory ? text(body.latestBalanceDate) || null : null,
    financeReferenceNumber: hasFinanceHistory ? text(body.referenceNumber) || null : null, finance_reference_number: hasFinanceHistory ? text(body.referenceNumber) || null : null,
    financeSourceReference: hasFinanceHistory ? text(body.sourceReference) || null : null, finance_source_reference: hasFinanceHistory ? text(body.sourceReference) || null : null,
    financeSecurityDescription: hasFinanceHistory ? text(body.securityDescription) || null : null, finance_security_description: hasFinanceHistory ? text(body.securityDescription) || null : null,
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
    financeNote: ['yes', 'paid'].includes(status) ? text(input.body.financeNote) || null : null,
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
    `select id::text, asset_register_item_id::text, carrying_value, as_at_date::text,
            original_accounting_cost, accumulated_depreciation, source_accounting_system, accountant_note, source_reference,
            updated_by_user_id, updated_by_name, updated_by_organisation, updated_at::text
     from public.asset_accounting_values where owner_user_id = $1 and asset_register_item_id = $2::uuid limit 1`,
    [ownerUserId, assetId],
  );
  return result.rows[0] ? mapAccountingValue(result.rows[0]) : null;
}

export async function saveAccountantCarryingValue(input: {
  accountantUserId: string; shareId: string; assetId: string;
  carryingValue: unknown; asAtDate: unknown; sourceReference: unknown;
  originalAccountingCost?: unknown; accumulatedDepreciation?: unknown;
  sourceAccountingSystem?: unknown; accountantNote?: unknown;
}): Promise<AccountingValueReference> {
  const { access, asset } = await authorisedAsset(input.accountantUserId, input.shareId, input.assetId, true);
  const carryingValue = optionalNumber(input.carryingValue);
  if (carryingValue === null) throw new Error('ACCOUNTING_VALUE_REQUIRED');
  const actor = await getAccountProfile({ id: input.accountantUserId });
  const previous = await getAccountingValue(access.ownerUserId, asset.id);
  const result = await getDb().query<AccountingValueRow>(
    `insert into public.asset_accounting_values
       (owner_user_id, asset_register_item_id, carrying_value, as_at_date, original_accounting_cost,
        accumulated_depreciation, source_accounting_system, accountant_note, source_reference,
        updated_by_user_id, updated_by_name, updated_by_organisation, created_at, updated_at)
     values ($1, $2::uuid, $3, $4::date, $5, $6, $7, $8, $9, $10, $11, $12, now(), now())
     on conflict (owner_user_id, asset_register_item_id) do update
       set carrying_value = excluded.carrying_value, as_at_date = excluded.as_at_date,
           original_accounting_cost = excluded.original_accounting_cost,
           accumulated_depreciation = excluded.accumulated_depreciation,
           source_accounting_system = excluded.source_accounting_system,
           accountant_note = excluded.accountant_note,
           source_reference = excluded.source_reference, updated_by_user_id = excluded.updated_by_user_id,
           updated_by_name = excluded.updated_by_name, updated_by_organisation = excluded.updated_by_organisation,
           updated_at = now()
     returning id::text, asset_register_item_id::text, carrying_value, as_at_date::text,
               original_accounting_cost, accumulated_depreciation, source_accounting_system, accountant_note, source_reference,
               updated_by_user_id, updated_by_name, updated_by_organisation, updated_at::text`,
    [access.ownerUserId, asset.id, carryingValue, dateOnly(input.asAtDate),
      optionalNumber(input.originalAccountingCost), optionalNumber(input.accumulatedDepreciation),
      text(input.sourceAccountingSystem) || null, text(input.accountantNote) || null,
      text(input.sourceReference) || null, input.accountantUserId,
      actor.displayName || actor.name, actor.businessName],
  );
  const saved = mapAccountingValue(result.rows[0]);
  await getDb().query(
    `insert into public.asset_accounting_value_snapshots
       (owner_user_id, asset_register_item_id, original_accounting_cost, accounting_book_value,
        book_value_date, accumulated_depreciation, source_accounting_system, source_reference,
        accountant_note, recorded_by_user_id, recorded_by_name, recorded_by_organisation, created_at)
     values ($1, $2::uuid, $3, $4, $5::date, $6, $7, $8, $9, $10, $11, $12, now())`,
    [access.ownerUserId, asset.id, saved.originalAccountingCost, saved.carryingValue, saved.asAtDate,
      saved.accumulatedDepreciation, saved.sourceAccountingSystem || null, saved.sourceReference || null,
      saved.accountantNote || null, input.accountantUserId, saved.updatedByName || null,
      saved.updatedByOrganisation || null],
  );
  await writeAudit(access, input.accountantUserId, 'accountant_carrying_value_updated', 'asset_register_item', asset.id, {
    accountantName: saved.updatedByName,
    accountantOrganisation: saved.updatedByOrganisation,
    assetId: asset.id,
    assetTitle: asset.title,
    changedField: 'accountingBookValue',
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
  const upload = await createAssetRegisterUpload({
    userId: access.ownerUserId,
    file: input.file,
    category: 'accountant-document',
  });
  const document: AssetRegisterDocument = {
    id: upload.id, url: upload.url, fileName: upload.fileName, contentType: upload.contentType,
    byteSize: upload.byteSize, uploadedAtIso: new Date().toISOString(),
    category: 'accounting',
    documentType: 'accountant_upload',
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

export async function updateAccountantAssetFlag(input: {
  accountantUserId: string;
  shareId: string;
  assetId: string;
  isFlagged: boolean;
}): Promise<AccountantAsset> {
  const { access, asset } = await authorisedAsset(input.accountantUserId, input.shareId, input.assetId);
  const updated = await updateAssetRegisterItemFlag(access.ownerUserId, {
    assetId: asset.id,
    isFlagged: input.isFlagged,
  });

  await writeAudit(access, input.accountantUserId, input.isFlagged ? 'accountant_asset_flagged' : 'accountant_asset_unflagged', 'asset_register_item', asset.id, {
    assetTitle: asset.title,
    previousValue: !input.isFlagged,
    newValue: input.isFlagged,
    source: 'accountant_workspace',
  });

  return {
    ...updated,
    accountingValue: await getAccountingValue(access.ownerUserId, asset.id),
  };
}

export async function createAccountantAssetNote(input: {
  accountantUserId: string;
  shareId: string;
  assetId: string;
  noteText: unknown;
}): Promise<AssetPartnerNote> {
  const noteText = text(input.noteText);
  if (!noteText) throw new Error('ACCOUNTANT_NOTE_REQUIRED');

  const { access, asset } = await authorisedAsset(input.accountantUserId, input.shareId, input.assetId);
  const actor = await getAccountProfile({ id: input.accountantUserId });
  const result = await getDb().query<{
    id: string;
    created_at: string;
    updated_at: string;
  }>(
    `insert into public.asset_partner_notes
       (owner_user_id, partner_user_id, asset_register_item_id, note_text, status, created_at, updated_at)
     values ($1, $2, $3::uuid, $4, 'open', now(), now())
     returning id::text, created_at::text, updated_at::text`,
    [access.ownerUserId, input.accountantUserId, asset.id, noteText],
  );
  const created = result.rows[0];
  if (!created) throw new Error('ACCOUNTANT_NOTE_NOT_CREATED');

  const note: AssetPartnerNote = {
    id: created.id,
    ownerUserId: access.ownerUserId,
    partnerUserId: input.accountantUserId,
    assetRegisterItemId: asset.id,
    noteText,
    status: 'open',
    partnerType: 'finance',
    partnerName: actor.displayName || actor.name || access.accountantName,
    partnerBusinessName: actor.businessName || access.accountantOrganisation,
    attachment: null,
    createdAtIso: created.created_at || new Date().toISOString(),
    notedAtIso: null,
    updatedAtIso: created.updated_at || created.created_at || new Date().toISOString(),
  };

  await writeAudit(access, input.accountantUserId, 'accountant_asset_note_left', 'asset_partner_note', note.id, {
    assetId: asset.id,
    assetTitle: asset.title,
    noteLength: noteText.length,
  });

  return note;
}

export async function moveAccountantAssetBetweenRegisters(input: {
  accountantUserId: string;
  sourceShareId: string;
  targetShareId: string;
  assetId: string;
}): Promise<{ item: AccountantAsset; sourceAccess: AccountantRegisterAccess; targetAccess: AccountantRegisterAccess }> {
  const [sourceAccess, targetAccess] = await Promise.all([
    loadAccess(input.accountantUserId, input.sourceShareId),
    loadAccess(input.accountantUserId, input.targetShareId),
  ]);

  if (sourceAccess.ownerUserId !== targetAccess.ownerUserId) {
    throw new Error('ACCOUNTANT_MOVE_DIFFERENT_OWNER');
  }

  if (sourceAccess.registerId === targetAccess.registerId) {
    throw new Error('ACCOUNTANT_MOVE_SAME_REGISTER');
  }

  const asset = await getAssetRegisterItemById(sourceAccess.ownerUserId, input.assetId);
  if (!asset || asset.registerId !== sourceAccess.registerId) {
    throw new Error('ACCOUNTANT_ASSET_NOT_FOUND');
  }

  const result = await getDb().query<{
    anchored_lead_count: number | string;
    replacement_exists: boolean;
    moved_count: number | string;
  }>(
    `with replacement as (
       select ai.id
       from public.asset_register_items ai
       where ai.user_id = $1 and ai.register_id = $3::uuid and ai.id <> $2::uuid
         and coalesce(ai.lifecycle_state, 'active') = 'active'
       order by ai.created_at asc, ai.id asc
       limit 1
     ), full_register_leads as (
       select l.id
       from public.asset_leads l
       where l.owner_user_id = $1 and l.asset_register_item_id = $2::uuid
         and coalesce(l.included_sections_json ->> 'source', '') = 'full_asset_register'
     ), reassigned_leads as (
       update public.asset_leads l
       set asset_register_item_id = (select id from replacement), updated_at = now()
       where l.id in (select id from full_register_leads)
         and exists (select 1 from replacement)
       returning l.id
     ), moved as (
       update public.asset_register_items ai
       set register_id = $4::uuid, updated_at = now()
       where ai.user_id = $1 and ai.id = $2::uuid and ai.register_id = $3::uuid
         and (
           not exists (select 1 from full_register_leads)
           or exists (select 1 from replacement)
         )
       returning ai.id
     )
     select
       (select count(*)::int from full_register_leads) as anchored_lead_count,
       exists (select 1 from replacement) as replacement_exists,
       (select count(*)::int from moved) as moved_count`,
    [sourceAccess.ownerUserId, asset.id, sourceAccess.registerId, targetAccess.registerId],
  );

  const outcome = result.rows[0];
  const anchoredLeadCount = Number(outcome?.anchored_lead_count ?? 0);
  const movedCount = Number(outcome?.moved_count ?? 0);

  if (!movedCount) {
    if (anchoredLeadCount > 0 && !outcome?.replacement_exists) {
      throw new Error('ACCOUNTANT_MOVE_LAST_SHARED_ASSET');
    }
    throw new Error('ACCOUNTANT_MOVE_FAILED');
  }

  const moved = await getAssetRegisterItemById(sourceAccess.ownerUserId, asset.id);
  if (!moved || moved.registerId !== targetAccess.registerId) {
    throw new Error('ACCOUNTANT_MOVE_FAILED');
  }

  await writeAudit(sourceAccess, input.accountantUserId, 'accountant_asset_moved', 'asset_register_item', asset.id, {
    assetTitle: asset.title,
    sourceRegisterId: sourceAccess.registerId,
    sourceRegisterName: sourceAccess.registerName,
    targetRegisterId: targetAccess.registerId,
    targetRegisterName: targetAccess.registerName,
  });

  return {
    item: {
      ...moved,
      accountingValue: await getAccountingValue(sourceAccess.ownerUserId, asset.id),
    },
    sourceAccess,
    targetAccess,
  };
}

export async function moveAccountantAssetToRegister(input: {
  accountantUserId: string;
  shareId: string;
  assetId: string;
  targetRegisterId: string;
}): Promise<{ item: AccountantAsset; access: AccountantRegisterAccess }> {
  const access = await loadAccess(input.accountantUserId, input.shareId);
  const asset = await getAssetRegisterItemById(access.ownerUserId, input.assetId);
  const targetRegister = await getAssetRegisterForUser(access.ownerUserId, input.targetRegisterId);

  if (!asset) throw new Error('ACCOUNTANT_ASSET_NOT_FOUND');
  if (!targetRegister) throw new Error('ACCOUNTANT_REGISTER_NOT_FOUND');
  if (asset.registerId === targetRegister.id) throw new Error('ACCOUNTANT_MOVE_SAME_REGISTER');

  const sourceRegister = asset.registerId
    ? await getAssetRegisterForUser(access.ownerUserId, asset.registerId)
    : null;
  if (!sourceRegister) throw new Error('ACCOUNTANT_ASSET_NOT_FOUND');

  const result = await getDb().query<{ id: string }>(
    `update public.asset_register_items
     set register_id = $4::uuid, updated_at = now()
     where user_id = $1 and id = $2::uuid and register_id = $3::uuid
     returning id::text`,
    [access.ownerUserId, asset.id, sourceRegister.id, targetRegister.id],
  );

  if (!result.rows[0]) throw new Error('ACCOUNTANT_MOVE_FAILED');

  const moved = await getAssetRegisterItemById(access.ownerUserId, asset.id);
  if (!moved || moved.registerId !== targetRegister.id) throw new Error('ACCOUNTANT_MOVE_FAILED');

  await writeAudit(access, input.accountantUserId, 'accountant_asset_moved', 'asset_register_item', asset.id, {
    assetTitle: asset.title,
    sourceRegisterId: sourceRegister.id,
    sourceRegisterName: sourceRegister.businessName,
    targetRegisterId: targetRegister.id,
    targetRegisterName: targetRegister.businessName,
  });

  return {
    item: { ...moved, accountingValue: await getAccountingValue(access.ownerUserId, moved.id) },
    access,
  };
}

export async function getAccountantLedger(input: {
  accountantUserId: string; shareId: string; kind: 'fuel' | 'cost'; registerId?: string | null;
}): Promise<{ access: AccountantRegisterAccess; fuel?: FuelLedgerData; cost?: MyInvoiceListResult }> {
  const access = await loadAccess(input.accountantUserId, input.shareId);
  const requestedRegisterId = String(input.registerId ?? '').trim() || access.registerId;
  const register = await getAssetRegisterForUser(access.ownerUserId, requestedRegisterId);
  if (!register) throw new Error('ACCOUNTANT_REGISTER_NOT_FOUND');
  const assets = await listAssetRegisterItems(access.ownerUserId, register.id);
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
  if (code === 'ACCOUNTING_VALUE_REQUIRED') return { status: 400, message: 'Enter a valid Accounting Book Value.' };
  if (code === 'ACCOUNTANT_FINANCE_AGREEMENT_NOT_FOUND') return { status: 404, message: 'The selected Finance Agreement could not be found for this client.' };
  if (code === 'ACCOUNTANT_FINANCE_AGREEMENT_NOT_SAVED') return { status: 409, message: 'The Finance Agreement could not be saved.' };
  if (code === 'DISPOSAL_REASON_REQUIRED') return { status: 400, message: 'Choose a valid disposal or incorrect-record reason.' };
  if (code === 'ACCOUNTANT_NOTE_REQUIRED') return { status: 400, message: 'Write a note before saving.' };
  if (code.includes('DOCUMENT')) return { status: 400, message: 'The document could not be saved. Check its type, size and the asset document limit.' };
  if (code === 'ACCOUNTANT_MOVE_DIFFERENT_OWNER') return { status: 403, message: 'Assets can only be moved between shared registers belonging to the same owner.' };
  if (code === 'ACCOUNTANT_MOVE_SAME_REGISTER') return { status: 400, message: 'Choose a different target Asset Register.' };
  if (code === 'ACCOUNTANT_MOVE_LAST_SHARED_ASSET') return { status: 409, message: 'This is the last asset keeping the shared register connected. Add or retain another asset in the source register before moving it.' };
  if (code === 'ACCOUNTANT_MOVE_FAILED') return { status: 409, message: 'The asset could not be moved between the selected registers.' };
  return { status: 500, message: 'The Accountant Workspace request could not be completed.' };
}
