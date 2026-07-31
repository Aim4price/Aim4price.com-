import { getDb } from './db';
import type { MyInvoiceRecord } from './my-invoices';

export type AccountingSoftware = 'sage_business_cloud' | 'generic_csv';
export type AccountingEffect = 'Increase' | 'Decrease';

export type AccountingSupplier = {
  id: string;
  name: string;
  aliases: string[];
};

export type CostLedgerAccountingSettings = {
  configured: boolean;
  software: AccountingSoftware;
  defaultEffect: AccountingEffect;
  standardVatLabel: string;
  noVatLabel: string;
  defaultAffectingAccount: string;
  fuelAffectingAccount: string;
  affectingAccounts: string[];
  suppliers: AccountingSupplier[];
  updatedAtIso: string | null;
};

export type AccountingExportIssueField =
  | 'invoice_date'
  | 'supplier'
  | 'vat'
  | 'affecting_account';

export type AccountingExportIssue = {
  invoiceId: string;
  invoiceNumber: string;
  assetTitle: string;
  supplierName: string;
  field: AccountingExportIssueField;
  message: string;
};

export type AccountingExportResult = {
  software: AccountingSoftware;
  softwareLabel: string;
  csv: string;
  recordCount: number;
  issues: AccountingExportIssue[];
};

type AccountingSettingsRow = {
  software: string | null;
  default_effect: string | null;
  standard_vat_label: string | null;
  no_vat_label: string | null;
  default_affecting_account: string | null;
  fuel_affecting_account: string | null;
  affecting_accounts: unknown;
  suppliers: unknown;
  updated_at: string | Date | null;
};

type AccountingRow = {
  date: string;
  effect: AccountingEffect;
  supplier: string;
  reference: string;
  description: string;
  vatLabel: string;
  exclVat: number;
  vat: number;
  inclVat: number;
  affectingAccount: string;
};

export const ACCOUNTING_SOFTWARE_OPTIONS: Array<{
  value: AccountingSoftware;
  label: string;
  description: string;
}> = [
  {
    value: 'sage_business_cloud',
    label: 'Sage Business Cloud Accounting',
    description: 'Supplier Adjustments Quick Entry Grid CSV.',
  },
  {
    value: 'generic_csv',
    label: 'Generic accounting CSV',
    description: 'A clean accounting file for systems with manual column mapping.',
  },
];

const DEFAULT_AFFECTING_ACCOUNT = 'Repairs and maintenance – tractors';

export const DEFAULT_COST_LEDGER_ACCOUNTING_SETTINGS: CostLedgerAccountingSettings = {
  configured: false,
  software: 'sage_business_cloud',
  defaultEffect: 'Increase',
  standardVatLabel: 'Standard Rate 15%',
  noVatLabel: 'No VAT',
  defaultAffectingAccount: DEFAULT_AFFECTING_ACCOUNT,
  fuelAffectingAccount: '',
  affectingAccounts: [DEFAULT_AFFECTING_ACCOUNT],
  suppliers: [],
  updatedAtIso: null,
};

let accountingSettingsTablePromise: Promise<void> | null = null;

function asText(value: unknown): string {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function limitedText(value: unknown, maxLength: number): string {
  return asText(value).slice(0, maxLength);
}

function asObject(value: unknown): Record<string, unknown> | null {
  if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }

  if (typeof value === 'string' && value.trim()) {
    try {
      const parsed = JSON.parse(value) as unknown;
      return typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)
        ? parsed as Record<string, unknown>
        : null;
    } catch {
      return null;
    }
  }

  return null;
}

function asArray(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;

  if (typeof value === 'string' && value.trim()) {
    try {
      const parsed = JSON.parse(value) as unknown;
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  return [];
}

function normalizeSoftware(value: unknown): AccountingSoftware {
  return value === 'generic_csv' ? 'generic_csv' : 'sage_business_cloud';
}

function normalizeEffect(value: unknown): AccountingEffect {
  return String(value ?? '').trim().toLowerCase() === 'decrease' ? 'Decrease' : 'Increase';
}

function uniqueTexts(values: unknown[], maxItems: number, maxLength: number): string[] {
  const result: string[] = [];
  const seen = new Set<string>();

  for (const value of values) {
    const text = limitedText(value, maxLength);
    const key = text.toLocaleLowerCase('en-ZA');
    if (!text || seen.has(key)) continue;
    seen.add(key);
    result.push(text);
    if (result.length >= maxItems) break;
  }

  return result;
}

function supplierId(value: unknown, name: string, index: number): string {
  const supplied = String(value ?? '').trim().replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 80);
  if (supplied) return supplied;

  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);

  return `supplier-${index + 1}-${slug || 'saved'}`;
}

function normalizeSuppliers(value: unknown): AccountingSupplier[] {
  const result: AccountingSupplier[] = [];
  const usedIds = new Set<string>();

  for (const [index, raw] of asArray(value).slice(0, 100).entries()) {
    const item = asObject(raw);
    if (!item) continue;

    const name = limitedText(item.name, 180);
    if (!name) continue;

    let id = supplierId(item.id, name, index);
    let suffix = 2;
    while (usedIds.has(id)) {
      id = `${supplierId(item.id, name, index)}-${suffix}`;
      suffix += 1;
    }
    usedIds.add(id);

    const aliases = uniqueTexts(asArray(item.aliases), 30, 180)
      .filter((alias) => alias.toLocaleLowerCase('en-ZA') !== name.toLocaleLowerCase('en-ZA'));

    result.push({ id, name, aliases });
  }

  return result;
}

function normalizeSupplierKey(value: unknown): string {
  return String(value ?? '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/\b(?:proprietary|pty|limited|ltd|incorporated|inc|close\s+corporation|cc)\b/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function validateSupplierAliases(suppliers: AccountingSupplier[]): void {
  const owners = new Map<string, string>();

  for (const supplier of suppliers) {
    for (const candidate of [supplier.name, ...supplier.aliases]) {
      const key = normalizeSupplierKey(candidate);
      if (!key) continue;

      const existing = owners.get(key);
      if (existing && existing !== supplier.id) {
        const other = suppliers.find((entry) => entry.id === existing)?.name || 'another supplier';
        throw new Error(`"${candidate}" matches both ${other} and ${supplier.name}. Give each supplier unique aliases.`);
      }
      owners.set(key, supplier.id);
    }
  }
}

function normalizeSettingsInput(
  value: unknown,
  configured: boolean,
  updatedAtIso: string | null = null,
): CostLedgerAccountingSettings {
  const item = asObject(value) ?? {};
  const software = normalizeSoftware(item.software);
  const defaultEffect = normalizeEffect(item.defaultEffect);
  const standardVatLabel = limitedText(item.standardVatLabel, 80) || DEFAULT_COST_LEDGER_ACCOUNTING_SETTINGS.standardVatLabel;
  const noVatLabel = limitedText(item.noVatLabel, 80) || DEFAULT_COST_LEDGER_ACCOUNTING_SETTINGS.noVatLabel;
  const defaultAffectingAccount = limitedText(item.defaultAffectingAccount, 180);
  const fuelAffectingAccount = limitedText(item.fuelAffectingAccount, 180);
  const affectingAccounts = uniqueTexts(asArray(item.affectingAccounts), 60, 180);

  for (const selected of [defaultAffectingAccount, fuelAffectingAccount]) {
    if (selected && !affectingAccounts.some((entry) => entry.toLocaleLowerCase('en-ZA') === selected.toLocaleLowerCase('en-ZA'))) {
      affectingAccounts.push(selected);
    }
  }

  const suppliers = normalizeSuppliers(item.suppliers);
  validateSupplierAliases(suppliers);

  return {
    configured,
    software,
    defaultEffect,
    standardVatLabel,
    noVatLabel,
    defaultAffectingAccount,
    fuelAffectingAccount,
    affectingAccounts,
    suppliers,
    updatedAtIso,
  };
}

function toIso(value: string | Date | null): string | null {
  if (!value) return null;
  const parsed = value instanceof Date ? value : new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function mapSettingsRow(row: AccountingSettingsRow | null | undefined): CostLedgerAccountingSettings {
  if (!row) return { ...DEFAULT_COST_LEDGER_ACCOUNTING_SETTINGS };

  return normalizeSettingsInput(
    {
      software: row.software,
      defaultEffect: row.default_effect,
      standardVatLabel: row.standard_vat_label,
      noVatLabel: row.no_vat_label,
      defaultAffectingAccount: row.default_affecting_account,
      fuelAffectingAccount: row.fuel_affecting_account,
      affectingAccounts: row.affecting_accounts,
      suppliers: row.suppliers,
    },
    true,
    toIso(row.updated_at),
  );
}

async function ensureAccountingSettingsTableOnce(): Promise<void> {
  await getDb().query(`
    create table if not exists public.cost_ledger_accounting_settings (
      user_id text primary key references public."user"(id) on delete cascade,
      software text not null default 'sage_business_cloud',
      default_effect text not null default 'Increase',
      standard_vat_label text not null default 'Standard Rate 15%',
      no_vat_label text not null default 'No VAT',
      default_affecting_account text,
      fuel_affecting_account text,
      affecting_accounts jsonb not null default '[]'::jsonb,
      suppliers jsonb not null default '[]'::jsonb,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    )
  `);
}

export async function ensureCostLedgerAccountingSettingsTable(): Promise<void> {
  if (!accountingSettingsTablePromise) {
    accountingSettingsTablePromise = ensureAccountingSettingsTableOnce().catch((error) => {
      accountingSettingsTablePromise = null;
      throw error;
    });
  }

  await accountingSettingsTablePromise;
}

export async function getCostLedgerAccountingSettings(
  userId: string,
): Promise<CostLedgerAccountingSettings> {
  await ensureCostLedgerAccountingSettingsTable();

  const result = await getDb().query<AccountingSettingsRow>(
    `
      select
        software,
        default_effect,
        standard_vat_label,
        no_vat_label,
        default_affecting_account,
        fuel_affecting_account,
        affecting_accounts,
        suppliers,
        updated_at
      from public.cost_ledger_accounting_settings
      where user_id = $1
      limit 1
    `,
    [userId],
  );

  return mapSettingsRow(result.rows[0]);
}

export async function saveCostLedgerAccountingSettings(
  userId: string,
  input: unknown,
): Promise<CostLedgerAccountingSettings> {
  await ensureCostLedgerAccountingSettingsTable();
  const settings = normalizeSettingsInput(input, true);

  if (!settings.standardVatLabel || !settings.noVatLabel) {
    throw new Error('Add both the standard VAT and no-VAT output values.');
  }
  if (!settings.defaultAffectingAccount) {
    throw new Error('Choose a default affecting account.');
  }
  if (!settings.suppliers.length) {
    throw new Error('Add at least one saved supplier before saving Accounting CSV Settings.');
  }

  const result = await getDb().query<AccountingSettingsRow>(
    `
      insert into public.cost_ledger_accounting_settings (
        user_id,
        software,
        default_effect,
        standard_vat_label,
        no_vat_label,
        default_affecting_account,
        fuel_affecting_account,
        affecting_accounts,
        suppliers,
        updated_at
      ) values ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9::jsonb, now())
      on conflict (user_id) do update set
        software = excluded.software,
        default_effect = excluded.default_effect,
        standard_vat_label = excluded.standard_vat_label,
        no_vat_label = excluded.no_vat_label,
        default_affecting_account = excluded.default_affecting_account,
        fuel_affecting_account = excluded.fuel_affecting_account,
        affecting_accounts = excluded.affecting_accounts,
        suppliers = excluded.suppliers,
        updated_at = now()
      returning
        software,
        default_effect,
        standard_vat_label,
        no_vat_label,
        default_affecting_account,
        fuel_affecting_account,
        affecting_accounts,
        suppliers,
        updated_at
    `,
    [
      userId,
      settings.software,
      settings.defaultEffect,
      settings.standardVatLabel,
      settings.noVatLabel,
      settings.defaultAffectingAccount || null,
      settings.fuelAffectingAccount || null,
      JSON.stringify(settings.affectingAccounts),
      JSON.stringify(settings.suppliers),
    ],
  );

  return mapSettingsRow(result.rows[0]);
}

export function accountingSoftwareLabel(software: AccountingSoftware): string {
  return ACCOUNTING_SOFTWARE_OPTIONS.find((entry) => entry.value === software)?.label
    ?? 'Accounting CSV';
}

function resolveSupplier(
  rawSupplierName: string,
  suppliers: AccountingSupplier[],
): AccountingSupplier | null {
  const key = normalizeSupplierKey(rawSupplierName);
  if (!key) return null;

  return suppliers.find((supplier) =>
    [supplier.name, ...supplier.aliases].some((candidate) => normalizeSupplierKey(candidate) === key),
  ) ?? null;
}

function money(value: number | null | undefined): number {
  return Math.round((typeof value === 'number' && Number.isFinite(value) ? value : 0) * 100) / 100;
}

function accountingDescription(invoice: MyInvoiceRecord): string {
  const details = [
    invoice.maintenanceWorkDone ? `Maintenance: ${asText(invoice.maintenanceWorkDone)}` : '',
    invoice.partsSupplied ? `Parts: ${asText(invoice.partsSupplied)}` : '',
    invoice.repairWorkDone ? `Repairs: ${asText(invoice.repairWorkDone)}` : '',
    invoice.otherWorkDone ? `Other: ${asText(invoice.otherWorkDone)}` : '',
    invoice.notes ? `Notes: ${asText(invoice.notes)}` : '',
  ].filter(Boolean);
  const asset = asText(invoice.assetTitle) || 'Saved asset';

  return details.length ? `${asset} — ${details.join('; ')}` : `${asset} — Asset cost`;
}

function accountingDate(value: string, software: AccountingSoftware): string {
  if (software === 'generic_csv') return value;
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : value;
}

function validInvoiceDate(value: string): boolean {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return false;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));

  return date.getUTCFullYear() === year
    && date.getUTCMonth() === month - 1
    && date.getUTCDate() === day;
}

function issueFor(
  invoice: MyInvoiceRecord,
  field: AccountingExportIssueField,
  message: string,
): AccountingExportIssue {
  return {
    invoiceId: invoice.id,
    invoiceNumber: invoice.invoiceNumber,
    assetTitle: invoice.assetTitle,
    supplierName: invoice.supplierName,
    field,
    message,
  };
}

function resolveAccountingRow(
  invoice: MyInvoiceRecord,
  settings: CostLedgerAccountingSettings,
  software: AccountingSoftware,
): { row: AccountingRow | null; issues: AccountingExportIssue[] } {
  const issues: AccountingExportIssue[] = [];
  const invoiceDate = asText(invoice.invoiceDate);
  if (!validInvoiceDate(invoiceDate)) {
    issues.push(issueFor(invoice, 'invoice_date', 'Add a valid invoice date.'));
  }

  const supplier = resolveSupplier(invoice.supplierName, settings.suppliers);
  if (!supplier) {
    issues.push(issueFor(
      invoice,
      'supplier',
      invoice.supplierName
        ? `Create a saved supplier or alias for "${invoice.supplierName}".`
        : 'Add the supplier name, then map it to a saved supplier.',
    ));
  }

  const vat = money(invoice.vatAmount);
  const exclVat = money(invoice.subtotalExVat ?? Math.max(0, invoice.totalIncVat - vat));
  const inclVat = money(invoice.totalIncVat);
  let vatLabel = settings.noVatLabel;

  if (Math.abs(money(exclVat + vat) - inclVat) > 0.05) {
    issues.push(issueFor(
      invoice,
      'vat',
      'Excl. VAT plus VAT does not equal the invoice total. Confirm the amounts before export.',
    ));
  }

  if (vat > 0) {
    const rate = exclVat > 0 ? Math.round((vat / exclVat) * 10000) / 100 : 0;
    if (rate < 14.5 || rate > 15.5) {
      issues.push(issueFor(
        invoice,
        'vat',
        `The calculated VAT rate is ${rate.toLocaleString('en-ZA', { maximumFractionDigits: 2 })}%. Confirm the amounts before export.`,
      ));
    }
    vatLabel = settings.standardVatLabel;
  }

  if (!vatLabel) {
    issues.push(issueFor(invoice, 'vat', 'Configure the VAT output value for this cost.'));
  }

  const affectingAccount = invoice.source === 'fuel_slip'
    ? settings.fuelAffectingAccount || settings.defaultAffectingAccount
    : settings.defaultAffectingAccount;

  if (!affectingAccount) {
    issues.push(issueFor(
      invoice,
      'affecting_account',
      invoice.source === 'fuel_slip'
        ? 'Configure a fuel affecting account or exclude fuel costs.'
        : 'Configure a default affecting account.',
    ));
  }

  if (issues.length) return { row: null, issues };

  return {
    row: {
      date: accountingDate(invoiceDate, software),
      effect: settings.defaultEffect,
      supplier: supplier?.name ?? '',
      reference: invoice.invoiceNumber || `AIM-${invoice.id.slice(0, 8).toUpperCase()}`,
      description: accountingDescription(invoice),
      vatLabel,
      exclVat,
      vat,
      inclVat,
      affectingAccount,
    },
    issues,
  };
}

function csvCell(value: string | number): string {
  let text = String(value ?? '');
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

function rowsForSoftware(
  software: AccountingSoftware,
  rows: AccountingRow[],
): Array<Array<string | number>> {
  const sageHeaders = [
    'Date',
    'Effect',
    'Supplier',
    'Reference',
    'Description',
    'VAT %',
    'Excl. VAT',
    'VAT',
    'Incl. VAT',
    'by Affecting Acc.',
  ];
  const genericHeaders = [
    'Date',
    'Effect',
    'Supplier',
    'Reference',
    'Description',
    'VAT Type',
    'Excl. VAT',
    'VAT',
    'Incl. VAT',
    'Affecting Account',
  ];

  return [
    software === 'sage_business_cloud' ? sageHeaders : genericHeaders,
    ...rows.map((row) => [
      row.date,
      row.effect,
      row.supplier,
      row.reference,
      row.description,
      row.vatLabel,
      row.exclVat,
      row.vat,
      row.inclVat,
      row.affectingAccount,
    ]),
  ];
}

export function buildCostLedgerAccountingCsv(
  invoices: MyInvoiceRecord[],
  settings: CostLedgerAccountingSettings,
  softwareOverride?: unknown,
): AccountingExportResult {
  const software = softwareOverride
    ? normalizeSoftware(softwareOverride)
    : settings.software;
  const resolved = invoices.map((invoice) => resolveAccountingRow(invoice, settings, software));
  const issues = resolved.flatMap((entry) => entry.issues);
  const rows = resolved
    .map((entry) => entry.row)
    .filter((row): row is AccountingRow => Boolean(row));

  if (!invoices.length) {
    issues.push({
      invoiceId: '',
      invoiceNumber: '',
      assetTitle: '',
      supplierName: '',
      field: 'supplier',
      message: 'No cost records match the selected export period.',
    });
  }

  const csvRows = rowsForSoftware(software, rows);

  return {
    software,
    softwareLabel: accountingSoftwareLabel(software),
    csv: `\uFEFF${csvRows.map((row) => row.map(csvCell).join(',')).join('\r\n')}\r\n`,
    recordCount: rows.length,
    issues,
  };
}
