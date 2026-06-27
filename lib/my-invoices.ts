import type { PoolClient } from 'pg';
import { getDb } from './db';
import { getAssetRegisterItemById, listAssetRegisterItems, type AssetRegisterItem } from './asset-register-db';
import { buildAssetRegisterUploadUrl, getLegacyAssetRegisterUploadResponse } from './asset-register-uploads';

export type MyInvoiceSource = 'manual' | 'automatic';
export type MyInvoiceUsageMetric = 'none' | 'hours' | 'km';
export type MyInvoiceBlockType = 'maintenance' | 'parts' | 'repair' | 'other';
export type MyInvoiceExtractionStatus = 'not_extracted' | 'extracted' | 'failed' | 'skipped';

export type MyInvoiceAssetOption = {
  id: string;
  title: string;
  kind: string;
  categoryLabel: string;
  yearModel: number | null;
  usageReading: number | null;
  usageMetric: 'hours' | 'km';
  condition: string;
  value: number;
  selectedMethod: string;
  meta: string;
};

export type MyInvoiceDocument = {
  id: string;
  userId: string;
  assetId: string;
  uploadId: string;
  uploadUrl: string;
  fileName: string;
  contentType: string;
  byteSize: number;
  source: MyInvoiceSource;
  rawExtractedText: string;
  extractionStatus: MyInvoiceExtractionStatus;
  extractionWarnings: string[];
  createdAtIso: string;
};

export type MyInvoiceBlock = {
  id: string;
  invoiceId: string;
  blockType: MyInvoiceBlockType;
  description: string;
  amountExVat: number | null;
  vatAmount: number | null;
  totalIncVat: number | null;
  sortOrder: number;
  createdAtIso: string;
};

export type MyInvoiceRecord = {
  id: string;
  userId: string;
  assetId: string;
  assetTitle: string;
  assetKind: string;
  assetCategoryLabel: string;
  assetYearModel: number | null;
  assetUsageReading: number | null;
  assetUsageMetric: 'hours' | 'km';
  assetCondition: string;
  assetValue: number;
  invoiceDocumentId: string | null;
  document: MyInvoiceDocument | null;
  supplierName: string;
  invoiceNumber: string;
  invoiceDate: string | null;
  subtotalExVat: number | null;
  vatAmount: number | null;
  totalIncVat: number;
  usageReading: number | null;
  usageMetric: MyInvoiceUsageMetric;
  source: MyInvoiceSource;
  notes: string;
  maintenanceWorkDone: string;
  partsSupplied: string;
  repairWorkDone: string;
  otherWorkDone: string;
  blocks: MyInvoiceBlock[];
  createdAtIso: string;
  updatedAtIso: string;
};

export type MyInvoiceSummary = {
  totalSpent: number;
  maintenanceSpend: number;
  partsSpend: number;
  repairSpend: number;
  otherSpend: number;
  vatTotal: number;
  invoiceCount: number;
};

export type MyInvoiceListFilters = {
  assetId?: string | null;
  year?: number | null;
  month?: number | null;
};

export type MyInvoiceListResult = {
  assets: MyInvoiceAssetOption[];
  invoices: MyInvoiceRecord[];
  summary: MyInvoiceSummary;
  duplicateWarnings?: string[];
};

export type MyInvoiceDraftInput = {
  assetId?: unknown;
  invoiceDocumentId?: unknown;
  supplierName?: unknown;
  invoiceNumber?: unknown;
  invoiceDate?: unknown;
  subtotalExVat?: unknown;
  vatAmount?: unknown;
  totalIncVat?: unknown;
  usageReading?: unknown;
  usageMetric?: unknown;
  source?: unknown;
  maintenanceWorkDone?: unknown;
  partsSupplied?: unknown;
  repairWorkDone?: unknown;
  notes?: unknown;
};

type MyInvoiceDocumentRow = {
  id: string;
  user_id: string;
  asset_register_item_id: string;
  upload_id: string | null;
  upload_url: string | null;
  file_name: string | null;
  content_type: string | null;
  byte_size: string | number | null;
  source: string | null;
  raw_extracted_text: string | null;
  extraction_status: string | null;
  extraction_warnings: unknown;
  created_at: string | Date | null;
};

type MyInvoiceRow = {
  id: string;
  user_id: string;
  asset_register_item_id: string;
  invoice_document_id: string | null;
  supplier_name: string | null;
  invoice_number: string | null;
  invoice_date: string | Date | null;
  subtotal_ex_vat: string | number | null;
  vat_amount: string | number | null;
  total_inc_vat: string | number | null;
  usage_reading: string | number | null;
  usage_metric: string | null;
  source: string | null;
  notes: string | null;
  created_at: string | Date | null;
  updated_at: string | Date | null;
  asset_title: string | null;
  asset_kind: string | null;
  asset_category_label: string | null;
  asset_year_model: string | number | null;
  asset_hours: string | number | null;
  asset_condition: string | null;
  asset_value: string | number | null;
  asset_selected_value: string | number | null;
  asset_selected_method: string | null;
  asset_specs_json: unknown;
};

type MyInvoiceBlockRow = {
  id: string;
  invoice_id: string;
  block_type: string | null;
  description: string | null;
  amount_ex_vat: string | number | null;
  vat_amount: string | number | null;
  total_inc_vat: string | number | null;
  sort_order: string | number | null;
  created_at: string | Date | null;
};

type DuplicateRow = {
  id: string;
};

let myInvoiceTablesPromise: Promise<void> | null = null;

function asText(value: unknown): string {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function asLongText(value: unknown, maxLength = 5000): string {
  return String(value ?? '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .trim()
    .slice(0, maxLength);
}

function asNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.round(value * 100) / 100;
  }

  const raw = String(value ?? '').trim();
  if (!raw) return null;

  let text = raw
    .replace(/zar/gi, '')
    .replace(/rand/gi, '')
    .replace(/r/gi, '')
    .replace(/\u00a0/g, ' ')
    .replace(/[^0-9, .-]/g, '')
    .replace(/\s+/g, '');

  if (!/[0-9]/.test(text)) return null;

  if (text.includes(',') && text.includes('.')) {
    const lastComma = text.lastIndexOf(',');
    const lastDot = text.lastIndexOf('.');
    text = lastComma > lastDot ? text.replace(/\./g, '').replace(',', '.') : text.replace(/,/g, '');
  } else if (text.includes(',') && !text.includes('.')) {
    const parts = text.split(',');
    const last = parts[parts.length - 1] ?? '';
    text = last.length === 2 ? `${parts.slice(0, -1).join('')}.${last}` : text.replace(/,/g, '');
  } else {
    const parts = text.split('.');
    if (parts.length > 2) {
      const last = parts.pop() ?? '';
      text = `${parts.join('')}.${last}`;
    }
  }

  const parsed = Number(text);
  return Number.isFinite(parsed) ? Math.round(parsed * 100) / 100 : null;
}

function nonNegativeNumber(value: unknown): number | null {
  const parsed = asNumber(value);
  return parsed === null ? null : Math.max(0, parsed);
}

function normalizeMoney(value: unknown): number | null {
  const parsed = nonNegativeNumber(value);
  return parsed === null ? null : Math.round(parsed * 100) / 100;
}

function normalizeUsageMetric(value: unknown): MyInvoiceUsageMetric {
  const normalized = asText(value).toLowerCase();

  if (normalized === 'hours' || normalized === 'hour' || normalized === 'hrs') return 'hours';
  if (normalized === 'km' || normalized === 'kms' || normalized === 'kilometres' || normalized === 'kilometers') return 'km';
  return 'none';
}

function normalizeSource(value: unknown): MyInvoiceSource {
  return asText(value).toLowerCase() === 'automatic' ? 'automatic' : 'manual';
}

function normalizeBlockType(value: unknown): MyInvoiceBlockType {
  const normalized = asText(value).toLowerCase();
  if (normalized === 'maintenance' || normalized === 'parts' || normalized === 'repair') return normalized;
  return 'other';
}

function normalizeExtractionStatus(value: unknown): MyInvoiceExtractionStatus {
  const normalized = asText(value).toLowerCase();
  if (normalized === 'extracted' || normalized === 'failed' || normalized === 'skipped') return normalized;
  return 'not_extracted';
}

function toIsoString(value: unknown): string {
  if (value instanceof Date && Number.isFinite(value.getTime())) {
    return value.toISOString();
  }

  if (typeof value === 'string' && value.trim()) {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? value : parsed.toISOString();
  }

  return new Date().toISOString();
}

function toDateOnly(value: unknown): string | null {
  if (value instanceof Date && Number.isFinite(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }

  const text = asText(value);
  if (!text) return null;

  const iso = text.match(/^(\d{4})-(\d{2})-(\d{2})/)?.[0];
  if (iso) return iso;

  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString().slice(0, 10);
}

function normalizeInvoiceDateForDb(value: unknown): string | null {
  const dateOnly = toDateOnly(value);
  return dateOnly && /^\d{4}-\d{2}-\d{2}$/.test(dateOnly) ? dateOnly : null;
}

function normalizeWarnings(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((entry) => asText(entry)).filter(Boolean).slice(0, 12);
  }

  if (typeof value === 'string' && value.trim()) {
    try {
      const parsed = JSON.parse(value) as unknown;
      if (Array.isArray(parsed)) {
        return parsed.map((entry) => asText(entry)).filter(Boolean).slice(0, 12);
      }
    } catch {
      return [asText(value)];
    }
  }

  return [];
}

function assetUsageMetric(asset: AssetRegisterItem): 'hours' | 'km' {
  const specs = asset.specsJson && typeof asset.specsJson === 'object' ? asset.specsJson : {};
  const metric = asText(
    specs.usageMetric ?? specs.usage_metric ?? specs.usageUnit ?? specs.usage_unit ?? specs.usageMetricType ?? specs.usage_metric_type,
  ).toLowerCase();

  if (asset.kind === 'vehicle' || metric === 'km' || metric === 'kms' || metric === 'kilometres' || metric === 'kilometers') {
    return 'km';
  }

  return 'hours';
}

function assetCategoryLabel(asset: AssetRegisterItem): string {
  if (asset.kind === 'tractor') return 'Tractor';
  if (asset.kind === 'vehicle') return 'Vehicle';
  if (asset.kind === 'property') return 'Property';
  if (asset.kind === 'tools') return 'Tools';
  return asset.equipmentFamilyLabel || 'Asset';
}

function assetConditionLabel(value: string): string {
  const normalized = asText(value).toLowerCase();
  if (normalized === 'excellent') return 'Excellent';
  if (normalized === 'good') return 'Good';
  if (normalized === 'fair') return 'Fair';
  if (normalized === 'used') return 'Used';
  if (normalized === 'serious') return 'Requires attention';
  return asText(value);
}

function buildAssetMeta(asset: AssetRegisterItem): string {
  const parts: string[] = [];

  if (asset.yearModel) parts.push(`Year Model: ${asset.yearModel}`);
  if (typeof asset.hours === 'number' && Number.isFinite(asset.hours)) {
    parts.push(`Usage: ${asset.hours.toLocaleString('en-ZA')} ${assetUsageMetric(asset)}`);
  }

  const condition = assetConditionLabel(asset.condition);
  if (condition) parts.push(`Condition: ${condition}`);

  return parts.join(' • ') || assetCategoryLabel(asset);
}

function mapAssetOption(asset: AssetRegisterItem): MyInvoiceAssetOption {
  const usageMetric = assetUsageMetric(asset);
  const categoryLabel = assetCategoryLabel(asset);

  return {
    id: asset.id,
    title: asset.title || asset.modelName || asset.typedModelName || 'Saved asset',
    kind: asset.kind,
    categoryLabel,
    yearModel: asset.yearModel,
    usageReading: asset.hours,
    usageMetric,
    condition: assetConditionLabel(asset.condition),
    value: Math.round(asset.selectedValueExVat || asset.value || 0),
    selectedMethod: asset.selectedMethod,
    meta: buildAssetMeta(asset),
  };
}

function normalizeAssetSpecs(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function assetUsageMetricFromRow(row: MyInvoiceRow): 'hours' | 'km' {
  const specs = normalizeAssetSpecs(row.asset_specs_json);
  const metric = asText(specs.usageMetric ?? specs.usage_metric ?? specs.usageUnit ?? specs.usage_unit).toLowerCase();

  if (asText(row.asset_kind).toLowerCase() === 'vehicle' || metric === 'km' || metric === 'kms') return 'km';
  return 'hours';
}

function assetCategoryLabelFromRow(row: MyInvoiceRow): string {
  const kind = asText(row.asset_kind).toLowerCase();
  if (kind === 'tractor') return 'Tractor';
  if (kind === 'vehicle') return 'Vehicle';
  if (kind === 'property') return 'Property';
  if (kind === 'tools') return 'Tools';
  return asText(row.asset_category_label) || 'Asset';
}

function mapDocumentRow(row: MyInvoiceDocumentRow | null | undefined): MyInvoiceDocument | null {
  if (!row?.id) return null;

  const uploadId = asText(row.upload_id) || asText(row.upload_url).split('/').pop() || '';

  return {
    id: String(row.id),
    userId: asText(row.user_id),
    assetId: asText(row.asset_register_item_id),
    uploadId,
    uploadUrl: asText(row.upload_url) || buildAssetRegisterUploadUrl(uploadId),
    fileName: asText(row.file_name),
    contentType: asText(row.content_type) || 'application/octet-stream',
    byteSize: Math.max(0, Math.round(Number(row.byte_size) || 0)),
    source: normalizeSource(row.source),
    rawExtractedText: asLongText(row.raw_extracted_text, 12000),
    extractionStatus: normalizeExtractionStatus(row.extraction_status),
    extractionWarnings: normalizeWarnings(row.extraction_warnings),
    createdAtIso: toIsoString(row.created_at),
  };
}

function mapBlockRow(row: MyInvoiceBlockRow): MyInvoiceBlock {
  return {
    id: String(row.id),
    invoiceId: String(row.invoice_id),
    blockType: normalizeBlockType(row.block_type),
    description: asLongText(row.description, 5000),
    amountExVat: asNumber(row.amount_ex_vat),
    vatAmount: asNumber(row.vat_amount),
    totalIncVat: asNumber(row.total_inc_vat),
    sortOrder: Math.round(Number(row.sort_order) || 0),
    createdAtIso: toIsoString(row.created_at),
  };
}

function mapInvoiceRow(row: MyInvoiceRow, document: MyInvoiceDocument | null, blocks: MyInvoiceBlock[]): MyInvoiceRecord {
  const blockDescription = (blockType: MyInvoiceBlockType): string =>
    blocks.find((block) => block.blockType === blockType)?.description ?? '';
  const assetUsageMetric = assetUsageMetricFromRow(row);
  const assetValue = Math.round(asNumber(row.asset_selected_value) ?? asNumber(row.asset_value) ?? 0);

  return {
    id: String(row.id),
    userId: asText(row.user_id),
    assetId: asText(row.asset_register_item_id),
    assetTitle: asText(row.asset_title) || 'Saved asset',
    assetKind: asText(row.asset_kind) || 'asset',
    assetCategoryLabel: assetCategoryLabelFromRow(row),
    assetYearModel: asNumber(row.asset_year_model),
    assetUsageReading: asNumber(row.asset_hours),
    assetUsageMetric,
    assetCondition: assetConditionLabel(asText(row.asset_condition)),
    assetValue,
    invoiceDocumentId: asText(row.invoice_document_id) || null,
    document,
    supplierName: asText(row.supplier_name),
    invoiceNumber: asText(row.invoice_number),
    invoiceDate: toDateOnly(row.invoice_date),
    subtotalExVat: asNumber(row.subtotal_ex_vat),
    vatAmount: asNumber(row.vat_amount),
    totalIncVat: Math.max(0, asNumber(row.total_inc_vat) ?? 0),
    usageReading: asNumber(row.usage_reading),
    usageMetric: normalizeUsageMetric(row.usage_metric),
    source: normalizeSource(row.source),
    notes: asLongText(row.notes, 5000),
    maintenanceWorkDone: blockDescription('maintenance'),
    partsSupplied: blockDescription('parts'),
    repairWorkDone: blockDescription('repair'),
    otherWorkDone: blockDescription('other'),
    blocks,
    createdAtIso: toIsoString(row.created_at),
    updatedAtIso: toIsoString(row.updated_at ?? row.created_at),
  };
}

async function ensureMyInvoiceTablesOnce(): Promise<void> {
  const db = getDb();

  await db.query(`create extension if not exists pgcrypto`);

  await db.query(`
    create table if not exists public.asset_invoice_documents (
      id uuid primary key default gen_random_uuid(),
      user_id text not null,
      asset_register_item_id uuid not null references public.asset_register_items(id) on delete cascade,
      upload_id text,
      upload_url text,
      file_name text,
      content_type text,
      byte_size integer,
      source text not null default 'manual',
      raw_extracted_text text,
      extraction_status text not null default 'not_extracted',
      extraction_warnings jsonb not null default '[]'::jsonb,
      created_at timestamptz not null default now()
    )
  `);

  await db.query(`
    create table if not exists public.asset_invoices (
      id uuid primary key default gen_random_uuid(),
      user_id text not null,
      asset_register_item_id uuid not null references public.asset_register_items(id) on delete cascade,
      invoice_document_id uuid references public.asset_invoice_documents(id) on delete set null,
      supplier_name text,
      invoice_number text,
      invoice_date date,
      subtotal_ex_vat numeric(14,2),
      vat_amount numeric(14,2),
      total_inc_vat numeric(14,2) not null default 0,
      usage_reading numeric(14,2),
      usage_metric text,
      source text not null default 'manual',
      notes text,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    )
  `);

  await db.query(`
    create table if not exists public.asset_invoice_blocks (
      id uuid primary key default gen_random_uuid(),
      invoice_id uuid not null references public.asset_invoices(id) on delete cascade,
      block_type text not null,
      description text,
      amount_ex_vat numeric(14,2),
      vat_amount numeric(14,2),
      total_inc_vat numeric(14,2),
      sort_order integer not null default 0,
      created_at timestamptz not null default now()
    )
  `);

  await db.query(`create index if not exists asset_invoice_documents_user_id_idx on public.asset_invoice_documents (user_id)`);
  await db.query(`create index if not exists asset_invoice_documents_asset_register_item_id_idx on public.asset_invoice_documents (asset_register_item_id)`);
  await db.query(`create index if not exists asset_invoices_user_id_idx on public.asset_invoices (user_id)`);
  await db.query(`create index if not exists asset_invoices_asset_register_item_id_idx on public.asset_invoices (asset_register_item_id)`);
  await db.query(`create index if not exists asset_invoices_invoice_date_idx on public.asset_invoices (invoice_date)`);
  await db.query(`create index if not exists asset_invoices_invoice_number_idx on public.asset_invoices (invoice_number)`);
  await db.query(`create index if not exists asset_invoices_supplier_name_idx on public.asset_invoices (supplier_name)`);
  await db.query(`create index if not exists asset_invoice_blocks_invoice_id_idx on public.asset_invoice_blocks (invoice_id)`);
}

export async function ensureMyInvoiceTables(): Promise<void> {
  if (!myInvoiceTablesPromise) {
    myInvoiceTablesPromise = ensureMyInvoiceTablesOnce().catch((error) => {
      myInvoiceTablesPromise = null;
      throw error;
    });
  }

  return myInvoiceTablesPromise;
}

export async function listMyInvoiceAssets(userId: string): Promise<MyInvoiceAssetOption[]> {
  try {
    const assets = await listAssetRegisterItems(userId);
    return assets.map(mapAssetOption);
  } catch (error) {
    if (error instanceof Error && error.message === 'ASSET_REGISTER_NOT_FOUND') return [];
    throw error;
  }
}

function buildInvoiceFilterClause(filters: MyInvoiceListFilters, values: unknown[]): string {
  const clauses = ['i.user_id = $1'];

  if (filters.assetId) {
    values.push(filters.assetId);
    clauses.push(`i.asset_register_item_id = $${values.length}::uuid`);
  }

  if (filters.year) {
    values.push(filters.year);
    clauses.push(`extract(year from i.invoice_date)::integer = $${values.length}`);
  }

  if (filters.month) {
    values.push(filters.month);
    clauses.push(`extract(month from i.invoice_date)::integer = $${values.length}`);
  }

  return clauses.join(' and ');
}

async function readInvoiceDocuments(userId: string, documentIds: string[]): Promise<Map<string, MyInvoiceDocument>> {
  if (!documentIds.length) return new Map();

  const result = await getDb().query<MyInvoiceDocumentRow>(
    `
      select *
      from public.asset_invoice_documents
      where user_id = $1
        and id = any($2::uuid[])
    `,
    [userId, documentIds],
  );

  return new Map(
    result.rows
      .map((row) => mapDocumentRow(row))
      .filter((document): document is MyInvoiceDocument => Boolean(document))
      .map((document) => [document.id, document]),
  );
}

async function readInvoiceBlocks(invoiceIds: string[]): Promise<Map<string, MyInvoiceBlock[]>> {
  if (!invoiceIds.length) return new Map();

  const result = await getDb().query<MyInvoiceBlockRow>(
    `
      select *
      from public.asset_invoice_blocks
      where invoice_id = any($1::uuid[])
      order by sort_order asc, created_at asc, id asc
    `,
    [invoiceIds],
  );

  const byInvoice = new Map<string, MyInvoiceBlock[]>();

  for (const row of result.rows) {
    const block = mapBlockRow(row);
    const blocks = byInvoice.get(block.invoiceId) ?? [];
    blocks.push(block);
    byInvoice.set(block.invoiceId, blocks);
  }

  return byInvoice;
}

export async function listMyInvoices(userId: string, filters: MyInvoiceListFilters = {}): Promise<MyInvoiceRecord[]> {
  await ensureMyInvoiceTables();

  const values: unknown[] = [userId];
  const filterClause = buildInvoiceFilterClause(filters, values);
  const result = await getDb().query<MyInvoiceRow>(
    `
      select
        i.*,
        ai.title as asset_title,
        ai.kind as asset_kind,
        ai.equipment_family_label as asset_category_label,
        ai.year_model as asset_year_model,
        ai.hours as asset_hours,
        ai.condition as asset_condition,
        ai.value as asset_value,
        ai.selected_value_ex_vat as asset_selected_value,
        ai.selected_method as asset_selected_method,
        ai.specs_json as asset_specs_json
      from public.asset_invoices i
      join public.asset_register_items ai
        on ai.id = i.asset_register_item_id
       and ai.user_id = i.user_id
      where ${filterClause}
      order by i.invoice_date desc nulls last, i.created_at desc, i.id desc
    `,
    values,
  );

  const invoiceIds = result.rows.map((row) => String(row.id));
  const documentIds = result.rows.map((row) => asText(row.invoice_document_id)).filter(Boolean);
  const [documents, blocks] = await Promise.all([
    readInvoiceDocuments(userId, documentIds),
    readInvoiceBlocks(invoiceIds),
  ]);

  return result.rows.map((row) => {
    const documentId = asText(row.invoice_document_id);
    return mapInvoiceRow(row, documentId ? documents.get(documentId) ?? null : null, blocks.get(String(row.id)) ?? []);
  });
}

export function calculateMyInvoiceSummary(invoices: MyInvoiceRecord[]): MyInvoiceSummary {
  const summary: MyInvoiceSummary = {
    totalSpent: 0,
    maintenanceSpend: 0,
    partsSpend: 0,
    repairSpend: 0,
    otherSpend: 0,
    vatTotal: 0,
    invoiceCount: invoices.length,
  };

  for (const invoice of invoices) {
    summary.totalSpent += invoice.totalIncVat;
    summary.vatTotal += invoice.vatAmount ?? 0;

    for (const block of invoice.blocks) {
      const amount = block.totalIncVat ?? 0;
      if (block.blockType === 'maintenance') summary.maintenanceSpend += amount;
      else if (block.blockType === 'parts') summary.partsSpend += amount;
      else if (block.blockType === 'repair') summary.repairSpend += amount;
      else summary.otherSpend += amount;
    }
  }

  return {
    totalSpent: Math.round(summary.totalSpent * 100) / 100,
    maintenanceSpend: Math.round(summary.maintenanceSpend * 100) / 100,
    partsSpend: Math.round(summary.partsSpend * 100) / 100,
    repairSpend: Math.round(summary.repairSpend * 100) / 100,
    otherSpend: Math.round(summary.otherSpend * 100) / 100,
    vatTotal: Math.round(summary.vatTotal * 100) / 100,
    invoiceCount: summary.invoiceCount,
  };
}

export async function listMyInvoicesData(userId: string, filters: MyInvoiceListFilters = {}): Promise<MyInvoiceListResult> {
  const [assets, invoices] = await Promise.all([
    listMyInvoiceAssets(userId),
    listMyInvoices(userId, filters),
  ]);

  return {
    assets,
    invoices,
    summary: calculateMyInvoiceSummary(invoices),
  };
}

export async function getMyInvoiceById(userId: string, invoiceId: string): Promise<MyInvoiceRecord | null> {
  const invoices = await listMyInvoices(userId, {});
  return invoices.find((invoice) => invoice.id === invoiceId) ?? null;
}

async function verifyAssetBelongsToUser(userId: string, assetId: string): Promise<AssetRegisterItem> {
  const asset = await getAssetRegisterItemById(userId, assetId);

  if (!asset) {
    throw new Error('ASSET_NOT_FOUND');
  }

  return asset;
}

function normalizeInvoiceDraft(input: MyInvoiceDraftInput, requireAsset = true) {
  const assetId = asText(input.assetId);
  if (requireAsset && !assetId) {
    throw new Error('Choose an asset before saving the invoice.');
  }

  const source = normalizeSource(input.source);
  const supplierName = asText(input.supplierName).slice(0, 180);
  const invoiceNumber = asText(input.invoiceNumber).slice(0, 120);
  const invoiceDate = normalizeInvoiceDateForDb(input.invoiceDate);
  let subtotalExVat = normalizeMoney(input.subtotalExVat);
  let vatAmount = normalizeMoney(input.vatAmount);
  let totalIncVat = normalizeMoney(input.totalIncVat);

  if (vatAmount === null && subtotalExVat !== null && totalIncVat !== null) {
    vatAmount = Math.max(0, Math.round((totalIncVat - subtotalExVat) * 100) / 100);
  }

  if (subtotalExVat === null && vatAmount !== null && totalIncVat !== null) {
    subtotalExVat = Math.max(0, Math.round((totalIncVat - vatAmount) * 100) / 100);
  }

  if (totalIncVat === null && subtotalExVat !== null && vatAmount !== null) {
    totalIncVat = Math.max(0, Math.round((subtotalExVat + vatAmount) * 100) / 100);
  }

  totalIncVat = totalIncVat ?? 0;
  const usageMetric = normalizeUsageMetric(input.usageMetric);
  const usageReading = usageMetric === 'none' ? null : nonNegativeNumber(input.usageReading);

  return {
    assetId,
    invoiceDocumentId: asText(input.invoiceDocumentId) || null,
    supplierName,
    invoiceNumber,
    invoiceDate,
    subtotalExVat,
    vatAmount,
    totalIncVat,
    usageReading,
    usageMetric,
    source,
    notes: asLongText(input.notes),
    maintenanceWorkDone: asLongText(input.maintenanceWorkDone),
    partsSupplied: asLongText(input.partsSupplied),
    repairWorkDone: asLongText(input.repairWorkDone),
  };
}

function splitAmount(total: number | null, count: number, index: number): number | null {
  if (total === null || count <= 0) return null;

  const roundedTotal = Math.round(total * 100);
  const base = Math.floor(roundedTotal / count);
  const remainder = roundedTotal - base * count;
  const cents = base + (index < remainder ? 1 : 0);
  return Math.round(cents) / 100;
}

function buildBlocksFromDraft(draft: ReturnType<typeof normalizeInvoiceDraft>): Array<{
  blockType: MyInvoiceBlockType;
  description: string;
  amountExVat: number | null;
  vatAmount: number | null;
  totalIncVat: number | null;
}> {
  const active = [
    { blockType: 'maintenance' as const, description: draft.maintenanceWorkDone },
    { blockType: 'parts' as const, description: draft.partsSupplied },
    { blockType: 'repair' as const, description: draft.repairWorkDone },
  ].filter((block) => block.description.trim());

  const blocks = active.length ? active : [{ blockType: 'other' as const, description: draft.notes || 'Invoice cost' }];

  return blocks.map((block, index) => ({
    blockType: block.blockType,
    description: block.description,
    amountExVat: splitAmount(draft.subtotalExVat, blocks.length, index),
    vatAmount: splitAmount(draft.vatAmount, blocks.length, index),
    totalIncVat: splitAmount(draft.totalIncVat, blocks.length, index),
  }));
}

async function verifyInvoiceDocument(input: {
  userId: string;
  assetId: string;
  invoiceDocumentId: string | null;
}): Promise<void> {
  if (!input.invoiceDocumentId) return;

  const result = await getDb().query(
    `
      select id
      from public.asset_invoice_documents
      where id = $1::uuid
        and user_id = $2
        and asset_register_item_id = $3::uuid
      limit 1
    `,
    [input.invoiceDocumentId, input.userId, input.assetId],
  );

  if (!result.rows[0]) {
    throw new Error('INVOICE_DOCUMENT_NOT_FOUND');
  }
}

async function replaceInvoiceBlocks(
  client: PoolClient,
  invoiceId: string,
  blocks: ReturnType<typeof buildBlocksFromDraft>,
): Promise<void> {
  await client.query(`delete from public.asset_invoice_blocks where invoice_id = $1::uuid`, [invoiceId]);

  for (let index = 0; index < blocks.length; index += 1) {
    const block = blocks[index];
    await client.query(
      `
        insert into public.asset_invoice_blocks (
          invoice_id,
          block_type,
          description,
          amount_ex_vat,
          vat_amount,
          total_inc_vat,
          sort_order
        ) values ($1::uuid, $2, $3, $4, $5, $6, $7)
      `,
      [
        invoiceId,
        block.blockType,
        block.description,
        block.amountExVat,
        block.vatAmount,
        block.totalIncVat,
        index,
      ],
    );
  }
}

export async function findDuplicateInvoiceWarnings(
  userId: string,
  draftInput: MyInvoiceDraftInput,
  excludeInvoiceId?: string | null,
): Promise<string[]> {
  await ensureMyInvoiceTables();

  const draft = normalizeInvoiceDraft(draftInput);

  if (!draft.supplierName || !draft.invoiceNumber || !draft.invoiceDate || draft.totalIncVat <= 0) {
    return [];
  }

  const values: unknown[] = [
    userId,
    draft.assetId,
    draft.supplierName.toLowerCase(),
    draft.invoiceNumber.toLowerCase(),
    draft.invoiceDate,
    draft.totalIncVat,
  ];
  let excludeClause = '';

  if (excludeInvoiceId) {
    values.push(excludeInvoiceId);
    excludeClause = `and id <> $${values.length}::uuid`;
  }

  const result = await getDb().query<DuplicateRow>(
    `
      select id
      from public.asset_invoices
      where user_id = $1
        and asset_register_item_id = $2::uuid
        and lower(coalesce(supplier_name, '')) = $3
        and lower(coalesce(invoice_number, '')) = $4
        and invoice_date = $5::date
        and round(coalesce(total_inc_vat, 0)::numeric, 2) = round($6::numeric, 2)
        ${excludeClause}
      limit 3
    `,
    values,
  );

  return result.rows.length
    ? ['Possible duplicate: an invoice with the same asset, supplier, invoice number, date and total already exists.']
    : [];
}

export async function createInvoiceDocumentRecord(input: {
  userId: string;
  assetId: string;
  uploadId?: string | null;
  uploadUrl?: string | null;
  fileName?: string | null;
  contentType?: string | null;
  byteSize?: number | null;
  source?: MyInvoiceSource;
}): Promise<MyInvoiceDocument> {
  await ensureMyInvoiceTables();
  await verifyAssetBelongsToUser(input.userId, input.assetId);

  const uploadId = asText(input.uploadId);
  const uploadUrl = asText(input.uploadUrl) || buildAssetRegisterUploadUrl(uploadId);
  const result = await getDb().query<MyInvoiceDocumentRow>(
    `
      insert into public.asset_invoice_documents (
        user_id,
        asset_register_item_id,
        upload_id,
        upload_url,
        file_name,
        content_type,
        byte_size,
        source
      ) values ($1, $2::uuid, $3, $4, $5, $6, $7, $8)
      returning *
    `,
    [
      input.userId,
      input.assetId,
      uploadId || null,
      uploadUrl || null,
      asText(input.fileName) || 'invoice-upload',
      asText(input.contentType) || 'application/octet-stream',
      Math.max(0, Math.round(Number(input.byteSize) || 0)),
      input.source ?? 'manual',
    ],
  );

  const document = mapDocumentRow(result.rows[0]);
  if (!document) throw new Error('INVOICE_DOCUMENT_CREATE_FAILED');
  return document;
}

export async function getInvoiceDocument(userId: string, documentId: string): Promise<MyInvoiceDocument | null> {
  await ensureMyInvoiceTables();

  const result = await getDb().query<MyInvoiceDocumentRow>(
    `
      select *
      from public.asset_invoice_documents
      where id = $1::uuid
        and user_id = $2
      limit 1
    `,
    [documentId, userId],
  );

  return mapDocumentRow(result.rows[0]);
}

export async function getInvoiceDocumentUpload(input: {
  userId: string;
  documentId: string;
}): Promise<{ document: MyInvoiceDocument; data: Buffer; contentType: string; fileName: string } | null> {
  const document = await getInvoiceDocument(input.userId, input.documentId);
  if (!document) return null;

  const upload = await getLegacyAssetRegisterUploadResponse(document.uploadId || document.uploadUrl);
  if (!upload) return null;

  return {
    document,
    data: upload.data,
    contentType: upload.mimeType || document.contentType,
    fileName: upload.fileName || document.fileName,
  };
}

export async function updateInvoiceDocumentExtraction(input: {
  userId: string;
  documentId: string;
  rawText: string;
  status: MyInvoiceExtractionStatus;
  warnings: string[];
}): Promise<MyInvoiceDocument | null> {
  await ensureMyInvoiceTables();

  const result = await getDb().query<MyInvoiceDocumentRow>(
    `
      update public.asset_invoice_documents
      set
        raw_extracted_text = $3,
        extraction_status = $4,
        extraction_warnings = $5::jsonb
      where id = $1::uuid
        and user_id = $2
      returning *
    `,
    [
      input.documentId,
      input.userId,
      asLongText(input.rawText, 12000),
      input.status,
      JSON.stringify(input.warnings.slice(0, 12)),
    ],
  );

  return mapDocumentRow(result.rows[0]);
}

export async function createMyInvoice(userId: string, input: MyInvoiceDraftInput): Promise<{
  invoice: MyInvoiceRecord | null;
  duplicateWarnings: string[];
}> {
  await ensureMyInvoiceTables();

  const draft = normalizeInvoiceDraft(input);
  await verifyAssetBelongsToUser(userId, draft.assetId);
  await verifyInvoiceDocument({ userId, assetId: draft.assetId, invoiceDocumentId: draft.invoiceDocumentId });
  const duplicateWarnings = await findDuplicateInvoiceWarnings(userId, input);
  const blocks = buildBlocksFromDraft(draft);
  const client = await getDb().connect();

  try {
    await client.query('begin');
    const result = await client.query<{ id: string }>(
      `
        insert into public.asset_invoices (
          user_id,
          asset_register_item_id,
          invoice_document_id,
          supplier_name,
          invoice_number,
          invoice_date,
          subtotal_ex_vat,
          vat_amount,
          total_inc_vat,
          usage_reading,
          usage_metric,
          source,
          notes
        ) values ($1, $2::uuid, $3::uuid, $4, $5, $6::date, $7, $8, $9, $10, $11, $12, $13)
        returning id
      `,
      [
        userId,
        draft.assetId,
        draft.invoiceDocumentId,
        draft.supplierName || null,
        draft.invoiceNumber || null,
        draft.invoiceDate,
        draft.subtotalExVat,
        draft.vatAmount,
        draft.totalIncVat,
        draft.usageReading,
        draft.usageMetric,
        draft.source,
        draft.notes || null,
      ],
    );

    const invoiceId = result.rows[0]?.id;
    if (!invoiceId) throw new Error('INVOICE_CREATE_FAILED');

    await replaceInvoiceBlocks(client, invoiceId, blocks);
    await client.query('commit');

    return {
      invoice: await getMyInvoiceById(userId, invoiceId),
      duplicateWarnings,
    };
  } catch (error) {
    await client.query('rollback').catch(() => null);
    throw error;
  } finally {
    client.release();
  }
}

export async function updateMyInvoice(userId: string, invoiceId: string, input: MyInvoiceDraftInput): Promise<{
  invoice: MyInvoiceRecord | null;
  duplicateWarnings: string[];
}> {
  await ensureMyInvoiceTables();

  const existing = await getMyInvoiceById(userId, invoiceId);
  if (!existing) {
    throw new Error('INVOICE_NOT_FOUND');
  }

  const draft = normalizeInvoiceDraft({ ...input, assetId: input.assetId ?? existing.assetId });
  await verifyAssetBelongsToUser(userId, draft.assetId);
  await verifyInvoiceDocument({ userId, assetId: draft.assetId, invoiceDocumentId: draft.invoiceDocumentId });
  const duplicateWarnings = await findDuplicateInvoiceWarnings(userId, { ...input, assetId: draft.assetId }, invoiceId);
  const blocks = buildBlocksFromDraft(draft);
  const client = await getDb().connect();

  try {
    await client.query('begin');
    const result = await client.query<{ id: string }>(
      `
        update public.asset_invoices
        set
          asset_register_item_id = $3::uuid,
          invoice_document_id = $4::uuid,
          supplier_name = $5,
          invoice_number = $6,
          invoice_date = $7::date,
          subtotal_ex_vat = $8,
          vat_amount = $9,
          total_inc_vat = $10,
          usage_reading = $11,
          usage_metric = $12,
          source = $13,
          notes = $14,
          updated_at = now()
        where id = $1::uuid
          and user_id = $2
        returning id
      `,
      [
        invoiceId,
        userId,
        draft.assetId,
        draft.invoiceDocumentId,
        draft.supplierName || null,
        draft.invoiceNumber || null,
        draft.invoiceDate,
        draft.subtotalExVat,
        draft.vatAmount,
        draft.totalIncVat,
        draft.usageReading,
        draft.usageMetric,
        draft.source,
        draft.notes || null,
      ],
    );

    if (!result.rows[0]) throw new Error('INVOICE_NOT_FOUND');

    await replaceInvoiceBlocks(client, invoiceId, blocks);
    await client.query('commit');

    return {
      invoice: await getMyInvoiceById(userId, invoiceId),
      duplicateWarnings,
    };
  } catch (error) {
    await client.query('rollback').catch(() => null);
    throw error;
  } finally {
    client.release();
  }
}

export async function deleteMyInvoice(userId: string, invoiceId: string): Promise<boolean> {
  await ensureMyInvoiceTables();

  const result = await getDb().query(
    `
      delete from public.asset_invoices
      where id = $1::uuid
        and user_id = $2
    `,
    [invoiceId, userId],
  );

  return (result.rowCount ?? 0) > 0;
}
