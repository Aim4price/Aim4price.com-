import { maintenanceIdentity, validateMaintenanceWork, type MaintenanceIdentity, type MaintenanceWorkSnapshot } from './maintenance-catalogue';
import { getDb } from './db';
import { getAssetRegisterItemById, listAssetRegisterItems, type AssetRegisterItem } from './asset-register-db';
import { listAssetRegisters } from './asset-registers';
import { resolveAssetUsage } from './asset-usage';
import { ensureFieldManagerTables, listFieldManagers } from './field-manager';
import { isDatabaseSchemaReady } from './database-schema-readiness';
import {
  listCompletedMaintenanceScanEventsForAssets,
  type AssetMaintenanceStatus as ScanMaintenanceStatus,
} from './scan-assets';
import type { PoolClient } from 'pg';

export type AssetMaintenanceType = 'service' | 'checkup';
export type AssetMaintenanceTriggerType = 'date' | 'usage';
export type AssetMaintenanceStatus = 'upcoming' | 'done' | 'cancelled';
export type AssetMaintenanceUsageMetric = 'hours' | 'km' | 'percentage';
export type AssetMaintenanceComputedStatus = 'upcoming' | 'due_soon' | 'due' | 'overdue' | 'done' | 'cancelled';
export type AssetMaintenanceDateIntervalUnit = 'days' | 'weeks' | 'months';
export type AssetMaintenanceUsageIntervalUnit = 'hours' | 'km' | 'percentage';
export type AssetMaintenanceIntervalUnit = AssetMaintenanceDateIntervalUnit | AssetMaintenanceUsageIntervalUnit;

export type AssetMaintenanceAssetOption = {
  id: string;
  title: string;
  kind: string;
  categoryLabel: string;
  maintenanceIdentity?: MaintenanceIdentity;
  yearModel: number | null;
  usageReading: number | null;
  usageMetric: AssetMaintenanceUsageMetric;
  condition: string;
  value: number;
  selectedMethod: string;
  serialNumber?: string;
  meta: string;
};

export type AssetMaintenanceFieldManagerOption = {
  id: string;
  displayName: string;
  username: string;
  isActive: boolean;
};

export type AssetMaintenanceRecord = {
  id: string;
  userId: string;
  assetId: string;
  assetTitle: string;
  assetKind: string;
  assetCategoryLabel: string;
  maintenanceIdentity?: MaintenanceIdentity;
  assetYearModel: number | null;
  assetUsageReading: number | null;
  assetUsageMetric: AssetMaintenanceUsageMetric;
  assetCondition: string;
  assetValue: number;
  assetMeta: string;
  maintenanceType: AssetMaintenanceType;
  triggerType: AssetMaintenanceTriggerType;
  status: AssetMaintenanceStatus;
  computedStatus: AssetMaintenanceComputedStatus;
  computedStatusLabel: string;
  title: string;
  notes: string;
  assignedFieldManagerId: string | null;
  assignedName: string;
  dueDate: string | null;
  dueUsage: number | null;
  usageMetric: AssetMaintenanceUsageMetric | null;
  currentUsage: number | null;
  remainingUsage: number | null;
  daysUntilDue: number | null;
  alertBeforeValue: number | null;
  alertBeforeUnit: AssetMaintenanceIntervalUnit | null;
  recurringEnabled: boolean;
  recurringIntervalValue: number | null;
  recurringIntervalUnit: AssetMaintenanceIntervalUnit | null;
  generatedFromMaintenanceId: string | null;
  sourceScanEventId: string | null;
  completedAtIso: string | null;
  completedUsage: number | null;
  completedNotes: string;
  maintenanceWork?: MaintenanceWorkSnapshot[] | null;
  completedBy: string;
  sourcePhotoUrls: string[];
  sourceLatitude: number | null;
  sourceLongitude: number | null;
  sourceLocationText: string;
  alertNotedAtIso: string | null;
  createdAtIso: string;
  updatedAtIso: string;
};

export type AssetMaintenanceSummary = {
  totalCount: number;
  openCount: number;
  doneCount: number;
  dueSoonCount: number;
  dueCount: number;
  overdueCount: number;
};

export type AssetMaintenanceListFilters = {
  assetId?: string | null;
  type?: AssetMaintenanceType | 'all' | null;
  status?: 'all' | 'upcoming' | 'done' | null;
  assignedTo?: string | null;
};

export type AssetMaintenanceDataOptions = {
  includeCompletedScanHistory?: boolean;
  completedScanHistoryAssetIds?: string[];
};

export type AssetMaintenanceListResult = {
  assets: AssetMaintenanceAssetOption[];
  fieldManagers: AssetMaintenanceFieldManagerOption[];
  records: AssetMaintenanceRecord[];
  summary: AssetMaintenanceSummary;
};

export type AssetMaintenanceDraftInput = {
  assetId?: unknown;
  maintenanceType?: unknown;
  triggerType?: unknown;
  status?: unknown;
  title?: unknown;
  notes?: unknown;
  assignedFieldManagerId?: unknown;
  assignedName?: unknown;
  dueDate?: unknown;
  dueUsage?: unknown;
  usageMetric?: unknown;
  alertBeforeValue?: unknown;
  alertBeforeUnit?: unknown;
  recurringEnabled?: unknown;
  recurringIntervalValue?: unknown;
  recurringIntervalUnit?: unknown;
};

export type AssetMaintenanceCompleteInput = {
  completedAt?: unknown;
  completedUsage?: unknown;
  completedNotes?: unknown;
  maintenanceWork?: unknown;
  completedBy?: unknown;
  sourceScanEventId?: unknown;
};

export type AssetMaintenanceStandaloneCompletionInput = AssetMaintenanceCompleteInput & {
  assetId?: unknown;
  maintenanceType?: unknown;
};

export type AssetMaintenanceCompletionGuard = {
  assetId?: string | null;
  assignedFieldManagerId?: string | null;
  maintenanceType?: AssetMaintenanceType | null;
  allowUnknownDetails?: boolean;
};

export type AssetMaintenanceCompletionOptions = {
  allowUnknownDetails?: boolean;
};

export type AssetMaintenanceProcedureKind = 'checked' | 'serviced' | 'repaired';

export type AssetMaintenanceAlert = {
  id: string;
  assetRegisterItemId: string;
  maintenanceType: AssetMaintenanceType;
  triggerType: AssetMaintenanceTriggerType;
  computedStatus: AssetMaintenanceComputedStatus;
  computedStatusLabel: string;
  heading: string;
  body: string;
  dueDate: string | null;
  dueUsage: number | null;
  currentUsage: number | null;
  usageMetric: AssetMaintenanceUsageMetric | null;
  alertBeforeValue: number | null;
  alertBeforeUnit: AssetMaintenanceIntervalUnit | null;
  updatedAtIso: string;
  createdAtIso: string;
};

type MaintenanceRow = {
  id: string;
  user_id: string;
  asset_register_item_id: string;
  maintenance_type: string | null;
  trigger_type: string | null;
  status: string | null;
  title: string | null;
  notes: string | null;
  assigned_field_manager_id: string | null;
  assigned_name: string | null;
  due_date: string | Date | null;
  due_usage: string | number | null;
  usage_metric: string | null;
  alert_before_value: string | number | null;
  alert_before_unit: string | null;
  recurring_enabled: boolean | null;
  recurring_interval_value: string | number | null;
  recurring_interval_unit: string | null;
  generated_from_maintenance_id: string | null;
  source_scan_event_id: string | null;
  completed_at: string | Date | null;
  completed_usage: string | number | null;
  completed_notes: string | null;
  maintenance_work?: MaintenanceWorkSnapshot[] | null;
  completed_by: string | null;
  source_captured_at?: string | Date | null;
  source_photo_urls?: unknown;
  source_latitude?: string | number | null;
  source_longitude?: string | number | null;
  source_location_text?: string | null;
  alert_noted_at: string | Date | null;
  created_at: string | Date | null;
  updated_at: string | Date | null;
  asset_serial_number?: string | null;
  asset_title: string | null;
  asset_kind: string | null;
  asset_category_label: string | null;
  asset_year_model: string | number | null;
  asset_hours: string | number | null;
  asset_life_worked_percent: string | number | null;
  asset_condition: string | null;
  asset_value: string | number | null;
  asset_selected_value: string | number | null;
  asset_selected_method: string | null;
  asset_specs_json: unknown;
  asset_maintenance_specs_json?: unknown;
  asset_family_id?: number | string | null;
  asset_family_key?: string | null;
  asset_sector_id?: number | string | null;
  field_manager_display_name?: string | null;
};

type MaintenanceOwnerRow = MaintenanceRow & {
  asset_owner_user_id?: string | null;
};

type MaintenanceQueryClient = Pick<PoolClient, 'query'>;

type AssetForAlert = {
  id: string;
  title?: string;
  kind?: string;
  hours?: number | null;
  lifeWorkedPercent?: number | null;
  specsJson?: Record<string, unknown>;
};

let assetMaintenanceTablesPromise: Promise<void> | null = null;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function asText(value: unknown): string {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

export function isAssetMaintenanceRecordId(value: unknown): boolean {
  return UUID_PATTERN.test(String(value ?? '').trim());
}

export function assetMaintenanceProcedureKindFromNote(value: unknown): AssetMaintenanceProcedureKind | null {
  const note = String(value ?? '').replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();
  if (!note) return null;

  const lines = note
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
  const firstLine = (lines[0] ?? '').toLowerCase();
  const compactNote = lines.join(' ').toLowerCase();

  if (/^repaired(?:\b|$)/.test(firstLine) || compactNote.includes('repair details:')) {
    return 'repaired';
  }

  if (
    /^serviced(?:\b|$)/.test(firstLine)
    || compactNote.includes('work done:')
    || compactNote.includes('service items:')
    || compactNote.includes('serviced items:')
  ) {
    return 'serviced';
  }

  if (/^checked(?:\b|$)/.test(firstLine) || compactNote.includes('checked items:')) {
    return 'checked';
  }

  return null;
}

export function assetMaintenanceProcedureMatchesType(
  maintenanceType: AssetMaintenanceType,
  procedureKind: AssetMaintenanceProcedureKind | null,
): boolean {
  return maintenanceType === 'checkup'
    ? procedureKind === 'checked'
    : procedureKind === 'serviced' || procedureKind === 'repaired';
}

export function unknownMaintenanceCompletionNote(
  maintenanceType: AssetMaintenanceType,
): string {
  return maintenanceType === 'checkup'
    ? 'Check-up done, no additional information available.'
    : 'Service done, no additional information available.';
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

  const normalized = raw
    .replace(/%/g, '')
    .replace(/hours?|hrs?/gi, '')
    .replace(/kilomet(er|re)s?|kms?/gi, '')
    .replace(/,/g, '.')
    .replace(/[^0-9.-]/g, '');

  if (!normalized || !/[0-9]/.test(normalized)) return null;

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? Math.round(parsed * 100) / 100 : null;
}

function nonNegativeNumber(value: unknown): number | null {
  const parsed = asNumber(value);
  return parsed === null ? null : Math.max(0, parsed);
}

function positiveNumber(value: unknown): number | null {
  const parsed = asNumber(value);
  return parsed === null || parsed <= 0 ? null : parsed;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asStringArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(asText).filter(Boolean);
  if (typeof value !== 'string' || !value.trim()) return [];
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? parsed.map(asText).filter(Boolean) : [];
  } catch {
    return [];
  }
}

function toIsoString(value: unknown): string {
  if (value instanceof Date && Number.isFinite(value.getTime())) return value.toISOString();
  if (typeof value === 'string' && value.trim()) {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? '' : parsed.toISOString();
  }
  return '';
}

function toNullableIsoString(value: unknown): string | null {
  if (value === null || typeof value === 'undefined' || value === '') return null;
  return toIsoString(value) || null;
}

function toDateOnly(value: unknown): string | null {
  if (value instanceof Date && Number.isFinite(value.getTime())) return value.toISOString().slice(0, 10);

  const text = asText(value);
  if (!text) return null;

  const iso = text.match(/^(\d{4})-(\d{2})-(\d{2})/)?.[0];
  if (iso) return iso;

  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString().slice(0, 10);
}

function completionDateOnly(value: unknown): string | null {
  const text = asText(value);
  if (!text) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    const parsedDateOnly = new Date(`${text}T00:00:00Z`);
    return Number.isNaN(parsedDateOnly.getTime()) || parsedDateOnly.toISOString().slice(0, 10) !== text ? null : text;
  }

  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) return null;
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Johannesburg',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(parsed);
  const valueByType = new Map(parts.map((part) => [part.type, part.value]));
  return `${valueByType.get('year')}-${valueByType.get('month')}-${valueByType.get('day')}`;
}

function normalizeMaintenanceType(value: unknown): AssetMaintenanceType {
  return asText(value).toLowerCase() === 'checkup' ? 'checkup' : 'service';
}

function normalizeTriggerType(value: unknown): AssetMaintenanceTriggerType {
  return asText(value).toLowerCase() === 'usage' ? 'usage' : 'date';
}

function normalizeStatus(value: unknown): AssetMaintenanceStatus {
  const normalized = asText(value).toLowerCase();
  if (normalized === 'done') return 'done';
  if (normalized === 'cancelled' || normalized === 'canceled') return 'cancelled';
  return 'upcoming';
}

function normalizeUsageMetric(value: unknown, fallback: AssetMaintenanceUsageMetric = 'hours'): AssetMaintenanceUsageMetric {
  const normalized = asText(value).toLowerCase().replace(/[\s_-]+/g, '');

  if (normalized === 'km' || normalized === 'kms' || normalized === 'kilometres' || normalized === 'kilometers' || normalized === 'kilometre' || normalized === 'kilometer') {
    return 'km';
  }

  if (normalized === 'percentage' || normalized === 'percent' || normalized === '%' || normalized === 'lifepercent' || normalized === 'lifeworkedpercent') {
    return 'percentage';
  }

  if (normalized === 'hours' || normalized === 'hour' || normalized === 'hrs' || normalized === 'hr') {
    return 'hours';
  }

  return fallback;
}

function normalizeIntervalUnit(value: unknown, fallback: AssetMaintenanceIntervalUnit): AssetMaintenanceIntervalUnit {
  const normalized = asText(value).toLowerCase().replace(/[\s_-]+/g, '');

  if (normalized === 'day' || normalized === 'days') return 'days';
  if (normalized === 'week' || normalized === 'weeks') return 'weeks';
  if (normalized === 'month' || normalized === 'months') return 'months';
  if (normalized === 'km' || normalized === 'kms' || normalized === 'kilometres' || normalized === 'kilometers') return 'km';
  if (normalized === 'percentage' || normalized === 'percent' || normalized === '%') return 'percentage';
  if (normalized === 'hour' || normalized === 'hours' || normalized === 'hr' || normalized === 'hrs') return 'hours';

  return fallback;
}

function normalizeBoolean(value: unknown): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  const normalized = asText(value).toLowerCase();
  return normalized === 'true' || normalized === '1' || normalized === 'yes' || normalized === 'on';
}

function conditionLabel(value: unknown): string {
  const normalized = asText(value).toLowerCase();
  if (!normalized) return '';

  return (
    {
      excellent: 'Excellent',
      good: 'Good',
      fair: 'Fair',
      used: 'Used',
      serious: 'Requires attention',
    }[normalized] ??
    normalized
      .replace(/[_-]+/g, ' ')
      .replace(/\s+/g, ' ')
      .split(' ')
      .map((part) => (part ? `${part[0].toUpperCase()}${part.slice(1)}` : ''))
      .join(' ')
  );
}

function numberFromSpecs(specs: Record<string, unknown>, keys: string[]): number | null {
  for (const key of keys) {
    const parsed = asNumber(specs[key]);
    if (parsed !== null) return parsed;
  }
  return null;
}

function usageMetricFromSpecs(specs: Record<string, unknown>, fallback: AssetMaintenanceUsageMetric): AssetMaintenanceUsageMetric {
  return normalizeUsageMetric(
    specs.usageMetric ??
      specs.usage_metric ??
      specs.usageUnit ??
      specs.usage_unit ??
      specs.usageMetricType ??
      specs.usage_metric_type ??
      specs.usage_basis ??
      specs.usageBasis,
    fallback,
  );
}

function assetUsageMetric(asset: AssetRegisterItem | AssetForAlert | { kind?: string; specsJson?: Record<string, unknown>; lifeWorkedPercent?: number | null; hours?: number | null }): AssetMaintenanceUsageMetric {
  const metric = resolveAssetUsage(asset).metric;
  return metric === 'not_applicable' ? (asset.kind === 'vehicle' ? 'km' : 'hours') : metric;
}

function assetUsageReading(asset: AssetRegisterItem | AssetForAlert | { kind?: string; specsJson?: Record<string, unknown>; lifeWorkedPercent?: number | null; hours?: number | null }, metric: AssetMaintenanceUsageMetric): number | null {
  const specs = isRecord(asset.specsJson) ? asset.specsJson : {};
  const resolved = resolveAssetUsage(asset);

  if (resolved.metric === metric) return resolved.value;

  if (metric === 'percentage') {
    return asNumber(asset.lifeWorkedPercent) ?? numberFromSpecs(specs, [
      'lifeWorkedPercent',
      'life_worked_percent',
      'workedPercent',
      'worked_percent',
      'percentWorked',
      'percent_worked',
      'lifetimeWorkedPercent',
      'lifetime_worked_percent',
      'lifetimeUsedPercent',
      'lifetime_used_percent',
    ]);
  }

  const reading = asNumber(asset.hours) ?? numberFromSpecs(specs, ['usageAmount', 'usage_amount', 'hours', 'engine_hours', 'km', 'kilometres', 'kilometers']);
  return reading !== null && reading > 0 ? reading : null;
}

function formatUsage(value: number | null | undefined, metric: AssetMaintenanceUsageMetric): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '';

  if (metric === 'percentage') {
    return `${value.toLocaleString('en-ZA', { maximumFractionDigits: 1 })}%`;
  }

  const unit = metric === 'km' ? 'km' : 'hours';
  return `${Math.round(value).toLocaleString('en-ZA')} ${unit}`;
}

function formatAssetUsage(value: number | null | undefined, metric: AssetMaintenanceUsageMetric): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '';
  if (metric !== 'percentage' && value <= 0) return '';
  return formatUsage(value, metric);
}

function formatDateLabel(value: string | null | undefined): string {
  if (!value) return '';
  const parsed = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return value;

  return new Intl.DateTimeFormat('en-ZA', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(parsed);
}

function assetYearLabel(asset: Pick<AssetMaintenanceAssetOption, 'categoryLabel'>): string {
  const category = asText(asset.categoryLabel).toLowerCase();
  return category.includes('property') || category.includes('building') ? 'Year Built' : 'Year Model';
}

function buildAssetMeta(asset: Pick<AssetMaintenanceAssetOption, 'title' | 'categoryLabel' | 'yearModel' | 'usageReading' | 'usageMetric' | 'condition'>): string {
  const usageLabel = formatAssetUsage(asset.usageReading, asset.usageMetric);
  const details = [
    typeof asset.yearModel === 'number' && Number.isFinite(asset.yearModel) && asset.yearModel > 0 ? `${assetYearLabel(asset)}: ${asset.yearModel}` : '',
    usageLabel ? `Usage: ${usageLabel}` : '',
    asset.condition ? `Condition: ${asset.condition}` : '',
    asset.categoryLabel || '',
  ].filter(Boolean);

  return details.length ? details.join(' • ') : asset.title;
}

function mapAssetOption(asset: AssetRegisterItem): AssetMaintenanceAssetOption {
  const usageMetric = assetUsageMetric(asset);
  const usageReading = assetUsageReading(asset, usageMetric);
  const categoryLabel = asText(asset.equipmentFamilyLabel) || asText(asset.kind) || 'Asset';
  const value = Math.round(Number(asset.selectedValueExVat || asset.value || 0));
  const condition = conditionLabel(asset.condition);
  const option: AssetMaintenanceAssetOption = {
    id: asset.id,
    title: asText(asset.title) || 'Saved asset',
    kind: asText(asset.kind) || 'asset',
    categoryLabel,
    maintenanceIdentity: maintenanceIdentity(asset),
    yearModel: asNumber(asset.yearModel),
    usageReading,
    usageMetric,
    condition,
    value,
    selectedMethod: asText(asset.selectedMethod) || 'aim4price',
    serialNumber: asText(asset.serialNumber),
    meta: '',
  };

  return {
    ...option,
    meta: buildAssetMeta(option),
  };
}

function assetOptionFromMaintenanceRow(row: MaintenanceRow): AssetMaintenanceAssetOption {
  const specs = isRecord(row.asset_specs_json) ? row.asset_specs_json : {};
  const kind = asText(row.asset_kind) || 'asset';
  const explicitMetric = normalizeUsageMetric(row.usage_metric, usageMetricFromSpecs(specs, kind === 'vehicle' ? 'km' : 'hours'));
  const assetMetric = row.usage_metric ? explicitMetric : assetUsageMetric({
    id: asText(row.asset_register_item_id),
    kind,
    hours: asNumber(row.asset_hours),
    lifeWorkedPercent: asNumber(row.asset_life_worked_percent),
    specsJson: specs,
  });
  const usageReading = assetUsageReading(
    {
      id: asText(row.asset_register_item_id),
      kind,
      hours: asNumber(row.asset_hours),
      lifeWorkedPercent: asNumber(row.asset_life_worked_percent),
      specsJson: specs,
    },
    assetMetric,
  );
  const option: AssetMaintenanceAssetOption = {
    id: asText(row.asset_register_item_id),
    title: asText(row.asset_title) || 'Saved asset',
    kind,
    maintenanceIdentity: maintenanceIdentity({ equipmentFamilyId: asNumber(row.asset_family_id), equipmentFamilyKey: row.asset_family_key, sectorId: asNumber(row.asset_sector_id), specsJson: isRecord(row.asset_maintenance_specs_json) ? row.asset_maintenance_specs_json : specs, equipmentFamilyLabel: row.asset_category_label }),
    categoryLabel: asText(row.asset_category_label) || kind || 'Asset',
    yearModel: asNumber(row.asset_year_model),
    usageReading,
    usageMetric: assetMetric,
    condition: conditionLabel(row.asset_condition),
    value: Math.round(asNumber(row.asset_selected_value) ?? asNumber(row.asset_value) ?? 0),
    selectedMethod: asText(row.asset_selected_method) || 'aim4price',
    serialNumber: asText(row.asset_serial_number),
    meta: '',
  };

  return { ...option, meta: buildAssetMeta(option) };
}

function statusLabel(status: AssetMaintenanceComputedStatus): string {
  if (status === 'done') return 'Done';
  if (status === 'cancelled') return 'Cancelled';
  if (status === 'overdue') return 'Overdue';
  if (status === 'due') return 'Due';
  if (status === 'due_soon') return 'Due soon';
  return 'Upcoming';
}

function todayJohannesburgDateOnly(): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Johannesburg',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const valueByType = new Map(parts.map((part) => [part.type, part.value]));
  return `${valueByType.get('year')}-${valueByType.get('month')}-${valueByType.get('day')}`;
}

function daysBetweenDateOnly(left: string, right: string): number {
  const leftDate = new Date(`${left}T00:00:00Z`);
  const rightDate = new Date(`${right}T00:00:00Z`);
  return Math.round((leftDate.getTime() - rightDate.getTime()) / 86_400_000);
}

function defaultAlertBefore(metricOrUnit: AssetMaintenanceUsageMetric | 'date'): { value: number; unit: AssetMaintenanceIntervalUnit } {
  if (metricOrUnit === 'date') return { value: 7, unit: 'days' };
  if (metricOrUnit === 'km') return { value: 1000, unit: 'km' };
  if (metricOrUnit === 'percentage') return { value: 5, unit: 'percentage' };
  return { value: 20, unit: 'hours' };
}

function computeRecordStatus(input: {
  status: AssetMaintenanceStatus;
  triggerType: AssetMaintenanceTriggerType;
  dueDate: string | null;
  dueUsage: number | null;
  currentUsage: number | null;
  alertBeforeValue: number | null;
  alertBeforeUnit: AssetMaintenanceIntervalUnit | null;
  usageMetric: AssetMaintenanceUsageMetric | null;
}): { computedStatus: AssetMaintenanceComputedStatus; daysUntilDue: number | null; remainingUsage: number | null } {
  if (input.status === 'done') return { computedStatus: 'done', daysUntilDue: null, remainingUsage: null };
  if (input.status === 'cancelled') return { computedStatus: 'cancelled', daysUntilDue: null, remainingUsage: null };

  if (input.triggerType === 'date') {
    if (!input.dueDate) return { computedStatus: 'upcoming', daysUntilDue: null, remainingUsage: null };
    const daysUntilDue = daysBetweenDateOnly(input.dueDate, todayJohannesburgDateOnly());
    const alertValue = input.alertBeforeValue ?? defaultAlertBefore('date').value;

    if (daysUntilDue < 0) return { computedStatus: 'overdue', daysUntilDue, remainingUsage: null };
    if (daysUntilDue === 0) return { computedStatus: 'due', daysUntilDue, remainingUsage: null };
    if (daysUntilDue <= alertValue) return { computedStatus: 'due_soon', daysUntilDue, remainingUsage: null };

    return { computedStatus: 'upcoming', daysUntilDue, remainingUsage: null };
  }

  if (typeof input.dueUsage !== 'number' || !Number.isFinite(input.dueUsage) || typeof input.currentUsage !== 'number' || !Number.isFinite(input.currentUsage)) {
    return { computedStatus: 'upcoming', daysUntilDue: null, remainingUsage: null };
  }

  const remainingUsage = Math.round((input.dueUsage - input.currentUsage) * 100) / 100;
  const alertValue = input.alertBeforeValue ?? defaultAlertBefore(input.usageMetric ?? 'hours').value;

  if (remainingUsage < 0) return { computedStatus: 'overdue', daysUntilDue: null, remainingUsage };
  if (remainingUsage === 0) return { computedStatus: 'due', daysUntilDue: null, remainingUsage };
  if (remainingUsage <= alertValue) return { computedStatus: 'due_soon', daysUntilDue: null, remainingUsage };

  return { computedStatus: 'upcoming', daysUntilDue: null, remainingUsage };
}

function mapMaintenanceRow(row: MaintenanceRow): AssetMaintenanceRecord {
  const asset = assetOptionFromMaintenanceRow(row);
  const maintenanceType = normalizeMaintenanceType(row.maintenance_type);
  const triggerType = normalizeTriggerType(row.trigger_type);
  const status = normalizeStatus(row.status);
  const dueDate = toDateOnly(row.due_date);
  const dueUsage = asNumber(row.due_usage);
  const usageMetric = triggerType === 'usage' ? normalizeUsageMetric(row.usage_metric, asset.usageMetric) : null;
  const currentUsage = triggerType === 'usage' ? asset.usageReading : null;
  const alertBeforeValue = asNumber(row.alert_before_value);
  const alertBeforeUnit = row.alert_before_unit ? normalizeIntervalUnit(row.alert_before_unit, triggerType === 'date' ? 'days' : usageMetric ?? 'hours') : null;
  const statusInfo = computeRecordStatus({
    status,
    triggerType,
    dueDate,
    dueUsage,
    currentUsage,
    alertBeforeValue,
    alertBeforeUnit,
    usageMetric,
  });

  return {
    id: asText(row.id),
    userId: asText(row.user_id),
    assetId: asset.id,
    assetTitle: asset.title,
    assetKind: asset.kind,
    assetCategoryLabel: asset.categoryLabel,
    maintenanceIdentity: asset.maintenanceIdentity,
    assetYearModel: asset.yearModel,
    assetUsageReading: asset.usageReading,
    assetUsageMetric: asset.usageMetric,
    assetCondition: asset.condition,
    assetValue: asset.value,
    assetMeta: asset.meta,
    maintenanceType,
    triggerType,
    status,
    computedStatus: statusInfo.computedStatus,
    computedStatusLabel: statusLabel(statusInfo.computedStatus),
    title: asText(row.title),
    notes: asLongText(row.notes),
    assignedFieldManagerId: asText(row.assigned_field_manager_id) || null,
    assignedName: asText(row.assigned_name) || asText(row.field_manager_display_name),
    dueDate,
    dueUsage,
    usageMetric,
    currentUsage,
    remainingUsage: statusInfo.remainingUsage,
    daysUntilDue: statusInfo.daysUntilDue,
    alertBeforeValue,
    alertBeforeUnit,
    recurringEnabled: Boolean(row.recurring_enabled),
    recurringIntervalValue: asNumber(row.recurring_interval_value),
    recurringIntervalUnit: row.recurring_interval_unit ? normalizeIntervalUnit(row.recurring_interval_unit, triggerType === 'date' ? 'months' : usageMetric ?? 'hours') : null,
    generatedFromMaintenanceId: asText(row.generated_from_maintenance_id) || null,
    sourceScanEventId: asText(row.source_scan_event_id) || null,
    completedAtIso: toNullableIsoString(row.source_captured_at) ?? toNullableIsoString(row.completed_at),
    completedUsage: asNumber(row.completed_usage),
    completedNotes: asLongText(row.completed_notes),
    maintenanceWork: row.maintenance_work || null,
    completedBy: asText(row.completed_by),
    sourcePhotoUrls: asStringArray(row.source_photo_urls),
    sourceLatitude: asNumber(row.source_latitude),
    sourceLongitude: asNumber(row.source_longitude),
    sourceLocationText: asText(row.source_location_text),
    alertNotedAtIso: toNullableIsoString(row.alert_noted_at),
    createdAtIso: toIsoString(row.created_at),
    updatedAtIso: toIsoString(row.updated_at ?? row.created_at),
  };
}

function sortMaintenanceRecords(records: AssetMaintenanceRecord[]): AssetMaintenanceRecord[] {
  return [...records].sort((left, right) => {
    const leftOpen = left.status === 'upcoming';
    const rightOpen = right.status === 'upcoming';

    if (leftOpen !== rightOpen) return leftOpen ? -1 : 1;

    if (leftOpen && rightOpen) {
      const urgency = (record: AssetMaintenanceRecord) => {
        if (record.computedStatus === 'overdue') return 0;
        if (record.computedStatus === 'due') return 1;
        return 2;
      };
      const urgencyDiff = urgency(left) - urgency(right);
      if (urgencyDiff !== 0) return urgencyDiff;

      if (left.triggerType === 'date' && right.triggerType === 'date') {
        const leftDate = left.dueDate ? new Date(`${left.dueDate}T00:00:00Z`).getTime() : Number.POSITIVE_INFINITY;
        const rightDate = right.dueDate ? new Date(`${right.dueDate}T00:00:00Z`).getTime() : Number.POSITIVE_INFINITY;
        if (leftDate !== rightDate) return leftDate - rightDate;
      }

      if (left.triggerType === 'usage' && right.triggerType === 'usage') {
        const leftRemaining = typeof left.remainingUsage === 'number' ? left.remainingUsage : Number.POSITIVE_INFINITY;
        const rightRemaining = typeof right.remainingUsage === 'number' ? right.remainingUsage : Number.POSITIVE_INFINITY;
        if (leftRemaining !== rightRemaining) return leftRemaining - rightRemaining;
      }

      if (left.triggerType !== right.triggerType) return left.triggerType === 'date' ? -1 : 1;

      const updatedDiff = new Date(right.updatedAtIso).getTime() - new Date(left.updatedAtIso).getTime();
      if (updatedDiff !== 0) return updatedDiff;
      return right.id.localeCompare(left.id);
    }

    const leftDoneTime = new Date(left.completedAtIso ?? left.updatedAtIso).getTime();
    const rightDoneTime = new Date(right.completedAtIso ?? right.updatedAtIso).getTime();
    if (leftDoneTime !== rightDoneTime) return rightDoneTime - leftDoneTime;

    return right.id.localeCompare(left.id);
  });
}

async function ensureAssetMaintenanceTablesOnce(): Promise<void> {
  const db = getDb();
  const schemaReady = await isDatabaseSchemaReady(() => db.query(`
    select
      id,
      user_id,
      asset_register_item_id,
      maintenance_type,
      trigger_type,
      status,
      title,
      notes,
      assigned_field_manager_id,
      assigned_name,
      due_date,
      due_usage,
      usage_metric,
      alert_before_value,
      alert_before_unit,
      recurring_enabled,
      recurring_interval_value,
      recurring_interval_unit,
      generated_from_maintenance_id,
      source_scan_event_id,
      completed_at,
      completed_usage,
      completed_notes,
      maintenance_work,
      completed_by,
      alert_noted_at,
      created_at,
      updated_at
    from public.asset_maintenance_records
    where false
  `));

  if (schemaReady) {
    return;
  }

  await ensureFieldManagerTables();
  await db.query(`create extension if not exists pgcrypto`);

  await db.query(`
    create table if not exists public.asset_maintenance_records (
      id uuid primary key default gen_random_uuid(),
      user_id text not null,
      asset_register_item_id uuid not null references public.asset_register_items(id) on delete cascade,
      maintenance_type text not null default 'service',
      trigger_type text not null,
      status text not null default 'upcoming',
      title text,
      notes text,
      assigned_field_manager_id uuid null references public.field_managers(id) on delete set null,
      assigned_name text,
      due_date date,
      due_usage numeric(14,2),
      usage_metric text,
      alert_before_value numeric(14,2),
      alert_before_unit text,
      recurring_enabled boolean not null default false,
      recurring_interval_value numeric(14,2),
      recurring_interval_unit text,
      generated_from_maintenance_id uuid,
      source_scan_event_id uuid,
      completed_at timestamptz,
      completed_usage numeric(14,2),
      completed_notes text,
      maintenance_work jsonb,
      completed_by text,
      alert_noted_at timestamptz,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    )
  `);

  await db.query(`alter table public.asset_maintenance_records add column if not exists title text`);
  await db.query(`alter table public.asset_maintenance_records add column if not exists assigned_name text`);
  await db.query(`alter table public.asset_maintenance_records add column if not exists completed_notes text`);
  await db.query(`alter table public.asset_maintenance_records add column if not exists maintenance_work jsonb`);
  await db.query(`alter table public.asset_maintenance_records add column if not exists completed_by text`);
  await db.query(`alter table public.asset_maintenance_records add column if not exists alert_noted_at timestamptz`);
  await db.query(`alter table public.asset_maintenance_records add column if not exists generated_from_maintenance_id uuid`);
  await db.query(`alter table public.asset_maintenance_records add column if not exists source_scan_event_id uuid`);

  await db.query(`create index if not exists asset_maintenance_records_user_id_idx on public.asset_maintenance_records (user_id)`);
  await db.query(`create index if not exists asset_maintenance_records_asset_register_item_id_idx on public.asset_maintenance_records (asset_register_item_id)`);
  await db.query(`create index if not exists asset_maintenance_records_status_idx on public.asset_maintenance_records (status)`);
  await db.query(`create index if not exists asset_maintenance_records_due_date_idx on public.asset_maintenance_records (due_date)`);
  await db.query(`create index if not exists asset_maintenance_records_due_usage_idx on public.asset_maintenance_records (due_usage)`);
  await db.query(`create index if not exists asset_maintenance_records_assigned_field_manager_id_idx on public.asset_maintenance_records (assigned_field_manager_id)`);
  await db.query(`create index if not exists asset_maintenance_records_created_at_idx on public.asset_maintenance_records (created_at)`);
  await db.query(`
    create unique index if not exists asset_maintenance_records_generated_from_active_idx
    on public.asset_maintenance_records (generated_from_maintenance_id)
    where generated_from_maintenance_id is not null and status <> 'cancelled'
  `);
  await db.query(`
    create unique index if not exists asset_maintenance_records_source_scan_event_idx
    on public.asset_maintenance_records (source_scan_event_id)
    where source_scan_event_id is not null
  `);
}

export async function ensureAssetMaintenanceTables(): Promise<void> {
  if (!assetMaintenanceTablesPromise) {
    assetMaintenanceTablesPromise = ensureAssetMaintenanceTablesOnce().catch((error) => {
      assetMaintenanceTablesPromise = null;
      throw error;
    });
  }

  return assetMaintenanceTablesPromise;
}

export async function listAssetMaintenanceAssets(userId: string): Promise<AssetMaintenanceAssetOption[]> {
  try {
    const registers = await listAssetRegisters(userId);
    const assetGroups = await Promise.all(
      registers.map(async (register) => {
        try {
          return await listAssetRegisterItems(userId, register.id);
        } catch (error) {
          if (error instanceof Error && error.message === 'ASSET_REGISTER_NOT_FOUND') return [];
          throw error;
        }
      }),
    );

    const assetOptionsById = new Map<string, AssetMaintenanceAssetOption>();

    for (const asset of assetGroups.flat()) {
      if (!assetOptionsById.has(asset.id)) {
        assetOptionsById.set(asset.id, mapAssetOption(asset));
      }
    }

    return Array.from(assetOptionsById.values()).sort((left, right) => left.title.localeCompare(right.title));
  } catch (error) {
    if (error instanceof Error && error.message === 'ASSET_REGISTER_NOT_FOUND') return [];
    throw error;
  }
}

export async function listAssetMaintenanceFieldManagers(userId: string): Promise<AssetMaintenanceFieldManagerOption[]> {
  try {
    const managers = await listFieldManagers(userId);
    return managers
      .map((manager) => ({
        id: manager.id,
        displayName: manager.displayName || manager.username || 'Field Manager',
        username: manager.username,
        isActive: manager.isActive,
      }))
      .sort((left, right) => Number(right.isActive) - Number(left.isActive) || left.displayName.localeCompare(right.displayName));
  } catch {
    return [];
  }
}

function buildMaintenanceFilterClause(filters: AssetMaintenanceListFilters, values: unknown[]): string {
  const clauses = [`m.user_id = $1`, `coalesce(m.status, 'upcoming') <> 'cancelled'`];

  if (filters.assetId) {
    values.push(filters.assetId);
    clauses.push(`m.asset_register_item_id = $${values.length}::uuid`);
  }

  if (filters.type && filters.type !== 'all') {
    values.push(filters.type);
    clauses.push(`lower(coalesce(m.maintenance_type, 'service')) = $${values.length}`);
  }

  if (filters.status && filters.status !== 'all') {
    values.push(filters.status === 'done' ? 'done' : 'upcoming');
    clauses.push(`lower(coalesce(m.status, 'upcoming')) = $${values.length}`);
  }

  if (filters.assignedTo) {
    if (filters.assignedTo === 'unassigned') {
      clauses.push(`m.assigned_field_manager_id is null and nullif(trim(coalesce(m.assigned_name, '')), '') is null`);
    } else if (filters.assignedTo !== 'all') {
      values.push(filters.assignedTo);
      clauses.push(`m.assigned_field_manager_id = $${values.length}::uuid`);
    }
  }

  return clauses.join(' and ');
}

function maintenanceSelectSql(whereClause: string): string {
  return `
    select
      m.*,
      ef.id as asset_family_id,
      ef.family_key as asset_family_key,
      coalesce(to_jsonb(ai)->>'sector_id', ef.sector_id::text) as asset_sector_id,
      coalesce(
        nullif(to_jsonb(ai)->>'title', ''),
        nullif(to_jsonb(ai)->>'asset_name', ''),
        nullif(to_jsonb(ai)->>'model_name', ''),
        nullif(to_jsonb(ai)->>'typed_model_name', ''),
        'Saved asset'
      ) as asset_title,
      to_jsonb(ai)->>'serial_number' as asset_serial_number,
      coalesce(nullif(to_jsonb(ai)->>'kind', ''), nullif(to_jsonb(ai)->>'asset_type', ''), 'asset') as asset_kind,
      coalesce(nullif(ef.family_label, ''), nullif(to_jsonb(ai)->>'kind', ''), 'Asset') as asset_category_label,
      nullif(coalesce(to_jsonb(ai)->>'year_model', to_jsonb(ai)->>'year'), '') as asset_year_model,
      nullif(coalesce(to_jsonb(ai)->>'hours', to_jsonb(ai)->>'engine_hours'), '') as asset_hours,
      nullif(coalesce(to_jsonb(ai)->>'life_worked_percent', to_jsonb(ai)->'specs_json'->>'life_worked_percent', to_jsonb(ai)->'specs_json'->>'lifeWorkedPercent'), '') as asset_life_worked_percent,
      nullif(to_jsonb(ai)->>'condition', '') as asset_condition,
      nullif(
        coalesce(
          to_jsonb(ai)->>'value',
          to_jsonb(ai)->>'selected_value_ex_vat',
          to_jsonb(ai)->>'selected_value',
          to_jsonb(ai)->>'saved_value_ex_vat',
          to_jsonb(ai)->>'aim4price_value_ex_vat',
          to_jsonb(ai)->>'aim4price_value',
          to_jsonb(ai)->>'market_mid_ex_vat',
          to_jsonb(ai)->>'market_value_ex_vat',
          to_jsonb(ai)->>'market_value',
          to_jsonb(ai)->>'valuation_amount',
          to_jsonb(ai)->>'manual_value'
        ),
        ''
      ) as asset_value,
      nullif(
        coalesce(
          to_jsonb(ai)->>'selected_value_ex_vat',
          to_jsonb(ai)->>'selected_value',
          to_jsonb(ai)->>'saved_value_ex_vat',
          to_jsonb(ai)->>'value',
          to_jsonb(ai)->>'aim4price_value_ex_vat',
          to_jsonb(ai)->>'aim4price_value',
          to_jsonb(ai)->>'market_mid_ex_vat',
          to_jsonb(ai)->>'market_value_ex_vat',
          to_jsonb(ai)->>'market_value',
          to_jsonb(ai)->>'valuation_amount',
          to_jsonb(ai)->>'manual_value'
        ),
        ''
      ) as asset_selected_value,
      nullif(coalesce(to_jsonb(ai)->>'selected_method', to_jsonb(ai)->>'method', to_jsonb(ai)->>'valuation_method'), '') as asset_selected_method,
      coalesce(to_jsonb(vr)->'specs_json', '{}'::jsonb) || coalesce(to_jsonb(ai)->'specs_json', '{}'::jsonb) as asset_maintenance_specs_json,
      coalesce(to_jsonb(ai)->'specs_json', '{}'::jsonb) as asset_specs_json,
      fm.display_name as field_manager_display_name,
      coalesce(to_jsonb(se)->'photo_urls', '[]'::jsonb) as source_photo_urls,
      nullif(to_jsonb(se)->>'latitude', '')::double precision as source_latitude,
      nullif(to_jsonb(se)->>'longitude', '')::double precision as source_longitude,
      coalesce(to_jsonb(se)->>'location_text', '') as source_location_text,
      se.created_at as source_captured_at,
      ai.user_id::text as asset_owner_user_id
    from public.asset_maintenance_records m
    join public.asset_register_items ai
      on ai.id = m.asset_register_item_id
     and ai.user_id = m.user_id
    left join public.valuation_runs vr
      on vr.id::text = nullif(to_jsonb(ai)->>'valuation_run_id', '')
    left join public.equipment_models em
      on em.id::text = nullif(to_jsonb(ai)->>'equipment_model_id', '')
    left join public.equipment_families ef
      on ef.id::text = coalesce(
        nullif(to_jsonb(ai)->>'equipment_family_id', ''),
        nullif(to_jsonb(vr)->>'equipment_family_id', ''),
        nullif(to_jsonb(em)->>'equipment_family_id', '')
      )
    left join public.field_managers fm
      on fm.id = m.assigned_field_manager_id
    left join public.asset_scan_events se
      on se.id = m.source_scan_event_id
    ${whereClause}
  `;
}

export async function listAssetMaintenanceRecords(userId: string, filters: AssetMaintenanceListFilters = {}): Promise<AssetMaintenanceRecord[]> {
  await ensureAssetMaintenanceTables();

  const values: unknown[] = [userId];
  const filterClause = buildMaintenanceFilterClause(filters, values);
  const result = await getDb().query<MaintenanceRow>(
    `
      ${maintenanceSelectSql(`where ${filterClause}`)}
      order by m.created_at desc, m.id desc
    `,
    values,
  );

  return sortMaintenanceRecords(result.rows.map(mapMaintenanceRow));
}

export function calculateAssetMaintenanceSummary(records: AssetMaintenanceRecord[]): AssetMaintenanceSummary {
  return {
    totalCount: records.length,
    openCount: records.filter((record) => record.status === 'upcoming').length,
    doneCount: records.filter((record) => record.status === 'done').length,
    dueSoonCount: records.filter((record) => record.computedStatus === 'due_soon').length,
    dueCount: records.filter((record) => record.computedStatus === 'due').length,
    overdueCount: records.filter((record) => record.computedStatus === 'overdue').length,
  };
}

function maintenanceHistoryDateOnly(value: string | null | undefined): string {
  const parsed = value ? new Date(value) : null;
  return parsed && Number.isFinite(parsed.getTime()) ? parsed.toISOString().slice(0, 10) : '';
}

function normalizedMaintenanceHistoryText(value: unknown): string {
  return asText(value).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function scanHistoryMatchesPersistedRecord(
  event: ScanMaintenanceStatus,
  record: AssetMaintenanceRecord,
): boolean {
  if (record.sourceScanEventId && record.sourceScanEventId === event.id) return true;
  if (record.status !== 'done' || record.assetId !== event.assetRegisterItemId) return false;

  const eventType: AssetMaintenanceType = event.kind === 'checked' ? 'checkup' : 'service';
  if (record.maintenanceType !== eventType) return false;

  const eventDate = maintenanceHistoryDateOnly(event.createdAtIso);
  const recordDate = maintenanceHistoryDateOnly(record.completedAtIso || record.updatedAtIso);
  if (!eventDate || eventDate !== recordDate) return false;

  const eventText = normalizedMaintenanceHistoryText(event.sourceNote || event.summary || event.note);
  const recordText = normalizedMaintenanceHistoryText(record.completedNotes || record.notes);
  const sameDetails = Boolean(
    eventText
    && recordText
    && (eventText.includes(recordText) || recordText.includes(eventText)),
  );
  const eventOperator = normalizedMaintenanceHistoryText(event.operatorName);
  const recordOperator = normalizedMaintenanceHistoryText(record.completedBy || record.assignedName);
  const sameOperator = Boolean(eventOperator && recordOperator && eventOperator === recordOperator);

  return sameDetails || sameOperator;
}

function completedScanHistoryRecord(
  userId: string,
  event: ScanMaintenanceStatus,
  asset: AssetMaintenanceAssetOption,
): AssetMaintenanceRecord {
  const maintenanceType: AssetMaintenanceType = event.kind === 'checked' ? 'checkup' : 'service';
  const title = event.kind === 'checked' ? 'Check-up' : event.kind === 'repaired' ? 'Repair' : 'Service';

  return {
    id: `scan-history:${event.id}`,
    userId,
    assetId: asset.id,
    assetTitle: asset.title,
    assetKind: asset.kind,
    assetCategoryLabel: asset.categoryLabel,
    maintenanceIdentity: asset.maintenanceIdentity,
    assetYearModel: asset.yearModel,
    assetUsageReading: asset.usageReading,
    assetUsageMetric: asset.usageMetric,
    assetCondition: asset.condition,
    assetValue: asset.value,
    assetMeta: asset.meta,
    maintenanceType,
    triggerType: 'date',
    status: 'done',
    computedStatus: 'done',
    computedStatusLabel: 'Done',
    title,
    notes: '',
    assignedFieldManagerId: null,
    assignedName: event.operatorName,
    dueDate: null,
    dueUsage: null,
    usageMetric: null,
    currentUsage: null,
    remainingUsage: null,
    daysUntilDue: null,
    alertBeforeValue: null,
    alertBeforeUnit: null,
    recurringEnabled: false,
    recurringIntervalValue: null,
    recurringIntervalUnit: null,
    generatedFromMaintenanceId: null,
    sourceScanEventId: event.id,
    completedAtIso: event.createdAtIso,
    completedUsage: event.usageReading,
    completedNotes: event.sourceNote || event.summary || event.note,
    maintenanceWork: event.maintenanceWork || null,
    completedBy: event.operatorName,
    sourcePhotoUrls: event.photoUrls,
    sourceLatitude: event.latitude,
    sourceLongitude: event.longitude,
    sourceLocationText: event.locationText,
    alertNotedAtIso: event.notedAtIso,
    createdAtIso: event.createdAtIso,
    updatedAtIso: event.createdAtIso,
  };
}

function mergeCompletedScanHistory(
  userId: string,
  assets: AssetMaintenanceAssetOption[],
  records: AssetMaintenanceRecord[],
  events: ScanMaintenanceStatus[],
  filters: AssetMaintenanceListFilters,
): AssetMaintenanceRecord[] {
  if (filters.status === 'upcoming') return records;
  if (filters.assignedTo && filters.assignedTo !== 'all') return records;

  const assetsById = new Map(assets.map((asset) => [asset.id, asset]));
  const merged = [...records];

  for (const event of events) {
    const asset = assetsById.get(event.assetRegisterItemId);
    if (!asset) continue;
    if (filters.assetId && asset.id !== filters.assetId) continue;

    const eventType: AssetMaintenanceType = event.kind === 'checked' ? 'checkup' : 'service';
    if (filters.type && filters.type !== 'all' && filters.type !== eventType) continue;
    if (merged.some((record) => scanHistoryMatchesPersistedRecord(event, record))) continue;

    merged.push(completedScanHistoryRecord(userId, event, asset));
  }

  return sortMaintenanceRecords(merged);
}

export async function listAssetMaintenanceData(
  userId: string,
  filters: AssetMaintenanceListFilters = {},
  options: AssetMaintenanceDataOptions = {},
): Promise<AssetMaintenanceListResult> {
  const [assets, fieldManagers, persistedRecords] = await Promise.all([
    listAssetMaintenanceAssets(userId),
    listAssetMaintenanceFieldManagers(userId),
    listAssetMaintenanceRecords(userId, filters),
  ]);

  const permittedAssetIds = new Set(assets.map((asset) => asset.id));
  const requestedHistoryAssetIds = options.completedScanHistoryAssetIds
    ?? (filters.assetId ? [filters.assetId] : assets.map((asset) => asset.id));
  const relevantAssetIds = Array.from(
    new Set(requestedHistoryAssetIds.filter((assetId) => permittedAssetIds.has(assetId))),
  );
  let completedScanHistory: ScanMaintenanceStatus[] = [];

  if (options.includeCompletedScanHistory && filters.status !== 'upcoming') {
    try {
      completedScanHistory = await listCompletedMaintenanceScanEventsForAssets(relevantAssetIds);
    } catch (error) {
      // Historical scan rows pre-date the maintenance table and can vary across
      // deployed schemas. They enrich reports, but must never block the current
      // maintenance report from opening.
      console.warn(
        'Aim4price completed maintenance scan history could not be loaded.',
        error instanceof Error ? error.message : error,
      );
    }
  }

  const records = options.includeCompletedScanHistory
    ? mergeCompletedScanHistory(userId, assets, persistedRecords, completedScanHistory, filters)
    : persistedRecords;

  return {
    assets,
    fieldManagers,
    records,
    summary: calculateAssetMaintenanceSummary(records),
  };
}

async function getAssetMaintenanceRecordByIdWithClient(
  client: MaintenanceQueryClient,
  userId: string,
  maintenanceId: string,
  lockRecord = false,
): Promise<AssetMaintenanceRecord | null> {
  if (!isAssetMaintenanceRecordId(maintenanceId)) {
    return null;
  }

  const result = await client.query<MaintenanceRow>(
    `
      ${maintenanceSelectSql(`where m.user_id = $1 and m.id = $2::uuid`)}
      limit 1
      ${lockRecord ? 'for update of m' : ''}
    `,
    [userId, maintenanceId],
  );

  return result.rows[0] ? mapMaintenanceRow(result.rows[0]) : null;
}

export async function getAssetMaintenanceRecordById(userId: string, maintenanceId: string): Promise<AssetMaintenanceRecord | null> {
  await ensureAssetMaintenanceTables();
  return getAssetMaintenanceRecordByIdWithClient(getDb(), userId, maintenanceId);
}

async function getAssetMaintenanceRecordBySourceScanEventIdWithClient(
  client: MaintenanceQueryClient,
  userId: string,
  sourceScanEventId: string,
): Promise<AssetMaintenanceRecord | null> {
  if (!isAssetMaintenanceRecordId(sourceScanEventId)) return null;

  const result = await client.query<MaintenanceRow>(
    `
      ${maintenanceSelectSql(`where m.user_id = $1 and m.source_scan_event_id = $2::uuid`)}
      limit 1
    `,
    [userId, sourceScanEventId],
  );

  return result.rows[0] ? mapMaintenanceRow(result.rows[0]) : null;
}

export async function getAssetMaintenanceRecordBySourceScanEventId(
  userId: string,
  sourceScanEventId: string,
): Promise<AssetMaintenanceRecord | null> {
  await ensureAssetMaintenanceTables();
  return getAssetMaintenanceRecordBySourceScanEventIdWithClient(
    getDb(),
    userId,
    asText(sourceScanEventId),
  );
}

export async function getAssignedFieldManagerMaintenanceRecord(input: {
  ownerUserId: string;
  managerId: string;
  assetId: string;
  maintenanceId: string;
  allowDone?: boolean;
}): Promise<AssetMaintenanceRecord | null> {
  const ownerUserId = asText(input.ownerUserId);
  const managerId = asText(input.managerId);
  const assetId = asText(input.assetId);
  const maintenanceId = asText(input.maintenanceId);

  if (
    !ownerUserId
    || !isAssetMaintenanceRecordId(managerId)
    || !isAssetMaintenanceRecordId(assetId)
    || !isAssetMaintenanceRecordId(maintenanceId)
  ) {
    return null;
  }

  const record = await getAssetMaintenanceRecordById(ownerUserId, maintenanceId);

  if (
    !record
    || record.userId !== ownerUserId
    || record.assetId !== assetId
    || record.assignedFieldManagerId !== managerId
    || record.status === 'cancelled'
    || (!input.allowDone && record.status !== 'upcoming')
  ) {
    return null;
  }

  return record;
}

async function verifyAssetBelongsToUser(userId: string, assetId: string): Promise<AssetRegisterItem> {
  const asset = await getAssetRegisterItemById(userId, assetId);

  if (!asset) {
    throw new Error('ASSET_NOT_FOUND');
  }

  return asset;
}

export async function recordStandaloneAssetMaintenanceCompletion(
  userId: string,
  input: AssetMaintenanceStandaloneCompletionInput,
  options: AssetMaintenanceCompletionOptions = {},
): Promise<AssetMaintenanceRecord> {
  await ensureAssetMaintenanceTables();

  const assetId = asText(input.assetId);
  const sourceScanEventId = asText(input.sourceScanEventId);
  if (!assetId) throw new Error('ASSET_NOT_FOUND');
  if (!isAssetMaintenanceRecordId(sourceScanEventId)) {
    throw new Error('MAINTENANCE_SOURCE_EVENT_REQUIRED');
  }

  const asset = await verifyAssetBelongsToUser(userId, assetId);
  const maintenanceType = normalizeMaintenanceType(input.maintenanceType);
  const maintenanceWork = validateMaintenanceWork(input.maintenanceWork);
  const completedNotes = asLongText(input.completedNotes);
  const completedBy = asText(input.completedBy);
  const procedureKind = assetMaintenanceProcedureKindFromNote(completedNotes);

  if (
    !options.allowUnknownDetails
    && !assetMaintenanceProcedureMatchesType(maintenanceType, procedureKind)
  ) {
    throw new Error('COMPLETION_DETAILS_REQUIRED');
  }
  if (!completedBy) throw new Error('COMPLETION_PERFORMER_REQUIRED');
  if (
    !options.allowUnknownDetails
    && maintenanceType === 'service'
    && (!/^Company:\s*\S/im.test(completedNotes) || !/^Mechanic:\s*\S/im.test(completedNotes))
  ) {
    throw new Error('COMPLETION_SERVICE_PROVIDER_REQUIRED');
  }

  const requestedCompletedAt = asText(input.completedAt);
  const parsedCompletedAt = requestedCompletedAt ? new Date(requestedCompletedAt) : new Date();
  if (Number.isNaN(parsedCompletedAt.getTime())) {
    throw new Error('COMPLETION_DATE_INVALID');
  }
  const completedAtIso = parsedCompletedAt.toISOString();
  const usageMetric = assetUsageMetric(asset);
  const completedUsage = nonNegativeNumber(input.completedUsage);
  const triggerType: AssetMaintenanceTriggerType =
    completedUsage === null ? 'date' : 'usage';
  const title = procedureKind === 'repaired'
    ? 'Repair'
    : maintenanceType === 'checkup'
      ? 'Check-up'
      : 'Service';

  const client = await getDb().connect();

  try {
    await client.query('begin');

    const existing = await getAssetMaintenanceRecordBySourceScanEventIdWithClient(
      client,
      userId,
      sourceScanEventId,
    );
    if (existing) {
      await client.query('commit');
      return existing;
    }

    const result = await client.query<{ id: string }>(
      `
        insert into public.asset_maintenance_records (
          user_id,
          asset_register_item_id,
          maintenance_type,
          trigger_type,
          status,
          title,
          due_date,
          due_usage,
          usage_metric,
          recurring_enabled,
          source_scan_event_id,
          completed_at,
          completed_usage,
          completed_notes,
          maintenance_work,
          completed_by,
          alert_noted_at,
          created_at,
          updated_at
        )
        values (
          $1,
          $2::uuid,
          $3,
          $4,
          'done',
          $5,
          $6::date,
          $7,
          $8,
          false,
          $9::uuid,
          $10::timestamptz,
          $7,
          $11,
          $13::jsonb,
          $12,
          now(),
          $10::timestamptz,
          now()
        )
        on conflict do nothing
        returning id::text as id
      `,
      [
        userId,
        assetId,
        maintenanceType,
        triggerType,
        title,
        triggerType === 'date' ? completedAtIso.slice(0, 10) : null,
        completedUsage,
        triggerType === 'usage' ? usageMetric : null,
        sourceScanEventId,
        completedAtIso,
        completedNotes,
        completedBy,
        JSON.stringify(maintenanceWork),
      ],
    );

    const record = result.rows[0]?.id
      ? await getAssetMaintenanceRecordByIdWithClient(
          client,
          userId,
          result.rows[0].id,
        )
      : await getAssetMaintenanceRecordBySourceScanEventIdWithClient(
          client,
          userId,
          sourceScanEventId,
        );

    if (!record || record.status !== 'done') {
      throw new Error('MAINTENANCE_NOT_FOUND');
    }

    await client.query('commit');
    return record;
  } catch (error) {
    await client.query('rollback');
    throw error;
  } finally {
    client.release();
  }
}

async function resolveAssignedManager(userId: string, managerIdInput: unknown, assignedNameInput: unknown): Promise<{ id: string | null; name: string }> {
  const managerId = asText(managerIdInput);

  if (!managerId || managerId === 'all' || managerId === 'unassigned') {
    return { id: null, name: asText(assignedNameInput) };
  }

  const managers = await listAssetMaintenanceFieldManagers(userId);
  const manager = managers.find((entry) => entry.id === managerId);

  if (!manager) {
    throw new Error('FIELD_MANAGER_NOT_FOUND');
  }

  return { id: manager.id, name: manager.displayName };
}

function normalizeDraftForSave(userId: string, input: AssetMaintenanceDraftInput, asset: AssetRegisterItem, existing?: AssetMaintenanceRecord) {
  const triggerType = normalizeTriggerType(input.triggerType ?? existing?.triggerType ?? 'date');
  const maintenanceType = normalizeMaintenanceType(input.maintenanceType ?? existing?.maintenanceType ?? 'service');
  const assetMetric = assetUsageMetric(asset);
  const usageMetric = triggerType === 'usage' ? normalizeUsageMetric(input.usageMetric ?? existing?.usageMetric ?? assetMetric, assetMetric) : null;
  const dueDate = triggerType === 'date' ? toDateOnly(input.dueDate ?? existing?.dueDate) : null;
  const dueUsage = triggerType === 'usage' ? nonNegativeNumber(input.dueUsage ?? existing?.dueUsage) : null;
  const defaultAlert = defaultAlertBefore(triggerType === 'date' ? 'date' : usageMetric ?? assetMetric);
  const alertBeforeValue = nonNegativeNumber(input.alertBeforeValue ?? existing?.alertBeforeValue ?? defaultAlert.value);
  const alertBeforeUnit = normalizeIntervalUnit(input.alertBeforeUnit ?? existing?.alertBeforeUnit ?? defaultAlert.unit, defaultAlert.unit);
  const recurringEnabled = normalizeBoolean(input.recurringEnabled ?? existing?.recurringEnabled ?? false);
  const recurringFallbackUnit = triggerType === 'date' ? 'months' : usageMetric ?? assetMetric;
  const recurringIntervalValue = recurringEnabled ? positiveNumber(input.recurringIntervalValue ?? existing?.recurringIntervalValue) : null;
  const recurringIntervalUnit = recurringEnabled ? normalizeIntervalUnit(input.recurringIntervalUnit ?? existing?.recurringIntervalUnit ?? recurringFallbackUnit, recurringFallbackUnit) : null;

  if (triggerType === 'date' && !dueDate) {
    throw new Error('DUE_DATE_REQUIRED');
  }

  if (triggerType === 'usage' && dueUsage === null) {
    throw new Error('DUE_USAGE_REQUIRED');
  }

  if (recurringEnabled && recurringIntervalValue === null) {
    throw new Error('RECURRING_INTERVAL_REQUIRED');
  }

  return {
    userId,
    assetId: asset.id,
    maintenanceType,
    triggerType,
    title: asText(input.title ?? existing?.title).slice(0, 180),
    notes: asLongText(input.notes ?? existing?.notes),
    dueDate,
    dueUsage,
    usageMetric,
    alertBeforeValue,
    alertBeforeUnit,
    recurringEnabled,
    recurringIntervalValue,
    recurringIntervalUnit,
  };
}

export async function createAssetMaintenanceRecord(userId: string, input: AssetMaintenanceDraftInput): Promise<AssetMaintenanceRecord> {
  await ensureAssetMaintenanceTables();

  const assetId = asText(input.assetId);
  if (!assetId) throw new Error('ASSET_NOT_FOUND');

  const asset = await verifyAssetBelongsToUser(userId, assetId);
  const assigned = await resolveAssignedManager(userId, input.assignedFieldManagerId, input.assignedName);
  const draft = normalizeDraftForSave(userId, input, asset);
  const db = getDb();
  const result = await db.query<{ id: string }>(
    `
      insert into public.asset_maintenance_records (
        user_id,
        asset_register_item_id,
        maintenance_type,
        trigger_type,
        status,
        title,
        notes,
        assigned_field_manager_id,
        assigned_name,
        due_date,
        due_usage,
        usage_metric,
        alert_before_value,
        alert_before_unit,
        recurring_enabled,
        recurring_interval_value,
        recurring_interval_unit,
        created_at,
        updated_at
      )
      values (
        $1,
        $2::uuid,
        $3,
        $4,
        'upcoming',
        $5,
        $6,
        $7::uuid,
        $8,
        $9::date,
        $10,
        $11,
        $12,
        $13,
        $14,
        $15,
        $16,
        now(),
        now()
      )
      returning id::text as id
    `,
    [
      userId,
      draft.assetId,
      draft.maintenanceType,
      draft.triggerType,
      draft.title,
      draft.notes,
      assigned.id,
      assigned.name,
      draft.dueDate,
      draft.dueUsage,
      draft.usageMetric,
      draft.alertBeforeValue,
      draft.alertBeforeUnit,
      draft.recurringEnabled,
      draft.recurringIntervalValue,
      draft.recurringIntervalUnit,
    ],
  );

  const created = await getAssetMaintenanceRecordById(userId, result.rows[0]?.id ?? '');
  if (!created) throw new Error('MAINTENANCE_NOT_FOUND');
  return created;
}

export async function updateAssetMaintenanceRecord(userId: string, maintenanceId: string, input: AssetMaintenanceDraftInput): Promise<AssetMaintenanceRecord> {
  await ensureAssetMaintenanceTables();

  const existing = await getAssetMaintenanceRecordById(userId, maintenanceId);
  if (!existing || existing.status === 'cancelled') throw new Error('MAINTENANCE_NOT_FOUND');

  const assetId = asText(input.assetId) || existing.assetId;
  const asset = await verifyAssetBelongsToUser(userId, assetId);
  const assigned = await resolveAssignedManager(userId, input.assignedFieldManagerId ?? existing.assignedFieldManagerId, input.assignedName ?? existing.assignedName);
  const draft = normalizeDraftForSave(userId, { ...input, assetId }, asset, existing);
  const db = getDb();

  await db.query(
    `
      update public.asset_maintenance_records
      set
        asset_register_item_id = $3::uuid,
        maintenance_type = $4,
        trigger_type = $5,
        title = $6,
        notes = $7,
        assigned_field_manager_id = $8::uuid,
        assigned_name = $9,
        due_date = $10::date,
        due_usage = $11,
        usage_metric = $12,
        alert_before_value = $13,
        alert_before_unit = $14,
        recurring_enabled = $15,
        recurring_interval_value = $16,
        recurring_interval_unit = $17,
        alert_noted_at = null,
        updated_at = now()
      where user_id = $1
        and id = $2::uuid
    `,
    [
      userId,
      maintenanceId,
      draft.assetId,
      draft.maintenanceType,
      draft.triggerType,
      draft.title,
      draft.notes,
      assigned.id,
      assigned.name,
      draft.dueDate,
      draft.dueUsage,
      draft.usageMetric,
      draft.alertBeforeValue,
      draft.alertBeforeUnit,
      draft.recurringEnabled,
      draft.recurringIntervalValue,
      draft.recurringIntervalUnit,
    ],
  );

  const updated = await getAssetMaintenanceRecordById(userId, maintenanceId);
  if (!updated) throw new Error('MAINTENANCE_NOT_FOUND');
  return updated;
}

export async function cancelAssetMaintenanceRecord(userId: string, maintenanceId: string): Promise<AssetMaintenanceRecord> {
  await ensureAssetMaintenanceTables();

  const existing = await getAssetMaintenanceRecordById(userId, maintenanceId);
  if (!existing || existing.status === 'cancelled') throw new Error('MAINTENANCE_NOT_FOUND');

  await getDb().query(
    `
      update public.asset_maintenance_records
      set status = 'cancelled', updated_at = now()
      where user_id = $1
        and id = $2::uuid
        and coalesce(status, 'upcoming') <> 'cancelled'
    `,
    [userId, maintenanceId],
  );

  return { ...existing, status: 'cancelled', computedStatus: 'cancelled', computedStatusLabel: 'Cancelled', updatedAtIso: new Date().toISOString() };
}

function addDateInterval(dateIso: string, value: number, unit: AssetMaintenanceIntervalUnit | null): string {
  const date = new Date(`${dateIso.slice(0, 10)}T00:00:00Z`);
  const interval = Math.max(1, Math.round(value));

  if (unit === 'weeks') date.setUTCDate(date.getUTCDate() + interval * 7);
  else if (unit === 'months') {
    // Keep month-end schedules at the end of the target month instead of
    // allowing JavaScript's date overflow (for example, 31 Jan -> 3 Mar).
    const originalDay = date.getUTCDate();
    date.setUTCDate(1);
    date.setUTCMonth(date.getUTCMonth() + interval);
    const lastDayOfTargetMonth = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate();
    date.setUTCDate(Math.min(originalDay, lastDayOfTargetMonth));
  }
  else date.setUTCDate(date.getUTCDate() + interval);

  return date.toISOString().slice(0, 10);
}

async function getActiveRecurringChild(
  client: MaintenanceQueryClient,
  userId: string,
  maintenanceId: string,
): Promise<AssetMaintenanceRecord | null> {
  const result = await client.query<{ id: string }>(
    `
      select id::text as id
      from public.asset_maintenance_records
      where user_id = $1
        and generated_from_maintenance_id = $2::uuid
        and status <> 'cancelled'
      order by created_at desc, id desc
      limit 1
    `,
    [userId, maintenanceId],
  );

  const childId = result.rows[0]?.id;
  return childId ? getAssetMaintenanceRecordByIdWithClient(client, userId, childId) : null;
}

async function createNextRecurringRecord(
  client: MaintenanceQueryClient,
  userId: string,
  completedRecord: AssetMaintenanceRecord,
): Promise<AssetMaintenanceRecord | null> {
  if (!completedRecord.recurringEnabled || !completedRecord.recurringIntervalValue || !completedRecord.recurringIntervalUnit) {
    return null;
  }

  const existingChild = await getActiveRecurringChild(client, userId, completedRecord.id);
  if (existingChild) return existingChild;

  let nextDueDate: string | null = null;
  let nextDueUsage: number | null = null;

  if (completedRecord.triggerType === 'date') {
    const completedDate = (completedRecord.completedAtIso ?? new Date().toISOString()).slice(0, 10);
    const baseDate = completedRecord.dueDate && completedRecord.dueDate > completedDate
      ? completedRecord.dueDate
      : completedDate;
    nextDueDate = addDateInterval(baseDate, completedRecord.recurringIntervalValue, completedRecord.recurringIntervalUnit);
  } else {
    // Recurring usage is measured from when the work was actually completed.
    // If an owner services early at 2 500 hours on a 250-hour interval, the
    // replacement is due at 2 750 hours rather than the old schedule plus 250.
    const baseUsage = completedRecord.completedUsage
      ?? completedRecord.currentUsage
      ?? completedRecord.dueUsage
      ?? 0;
    nextDueUsage = Math.round((baseUsage + completedRecord.recurringIntervalValue) * 100) / 100;
  }

  const result = await client.query<{ id: string }>(
    `
      insert into public.asset_maintenance_records (
        user_id,
        asset_register_item_id,
        maintenance_type,
        trigger_type,
        status,
        title,
        notes,
        assigned_field_manager_id,
        assigned_name,
        due_date,
        due_usage,
        usage_metric,
        alert_before_value,
        alert_before_unit,
        recurring_enabled,
        recurring_interval_value,
        recurring_interval_unit,
        generated_from_maintenance_id,
        created_at,
        updated_at
      )
      select
        $1,
        $2::uuid,
        $3,
        $4,
        'upcoming',
        $5,
        $6,
        $7::uuid,
        $8,
        $9::date,
        $10,
        $11,
        $12,
        $13,
        $14,
        $15,
        $16,
        $17::uuid,
        now(),
        now()
      where exists (
        select 1
        from public.asset_maintenance_records
        where user_id = $1
          and id = $17::uuid
          and status = 'done'
      )
      on conflict do nothing
      returning id::text as id
    `,
    [
      userId,
      completedRecord.assetId,
      completedRecord.maintenanceType,
      completedRecord.triggerType,
      completedRecord.title,
      completedRecord.notes,
      completedRecord.assignedFieldManagerId,
      completedRecord.assignedName,
      nextDueDate,
      nextDueUsage,
      completedRecord.usageMetric,
      completedRecord.alertBeforeValue,
      completedRecord.alertBeforeUnit,
      completedRecord.recurringEnabled,
      completedRecord.recurringIntervalValue,
      completedRecord.recurringIntervalUnit,
      completedRecord.id,
    ],
  );

  const createdId = result.rows[0]?.id;
  return createdId
    ? getAssetMaintenanceRecordByIdWithClient(client, userId, createdId)
    : getActiveRecurringChild(client, userId, completedRecord.id);
}

export async function completeAssetMaintenanceRecord(
  userId: string,
  maintenanceId: string,
  input: AssetMaintenanceCompleteInput = {},
  guard: AssetMaintenanceCompletionGuard = {},
): Promise<{ completed: AssetMaintenanceRecord; nextRecord: AssetMaintenanceRecord | null }> {
  await ensureAssetMaintenanceTables();
  const client = await getDb().connect();

  try {
    await client.query('begin');

    const existing = await getAssetMaintenanceRecordByIdWithClient(
      client,
      userId,
      maintenanceId,
      true,
    );
    if (!existing || existing.status === 'cancelled') throw new Error('MAINTENANCE_NOT_FOUND');

    const guardedAssetId = asText(guard.assetId) || null;
    const guardedManagerId = asText(guard.assignedFieldManagerId) || null;
    const guardedMaintenanceType = guard.maintenanceType ?? null;

    if (
      (guardedAssetId && existing.assetId !== guardedAssetId)
      || (guardedManagerId && existing.assignedFieldManagerId !== guardedManagerId)
      || (guardedMaintenanceType && existing.maintenanceType !== guardedMaintenanceType)
    ) {
      throw new Error('MAINTENANCE_NOT_FOUND');
    }

    let completed = existing;

    if (existing.status !== 'done') {
      // Completion is intentionally independent of whether the saved reading has
      // reached the due target. Owners may service an asset early.
      const sourceScanEventId = asText(input.sourceScanEventId);
      const completedUsage = existing.triggerType === 'usage'
        ? nonNegativeNumber(input.completedUsage) ?? (sourceScanEventId ? null : existing.currentUsage)
        : nonNegativeNumber(input.completedUsage);
      if (
        completedUsage !== null
        && existing.currentUsage !== null
        && completedUsage < existing.currentUsage
      ) {
        throw new Error('COMPLETION_USAGE_LOWER_THAN_CURRENT');
      }

      const maintenanceWork = validateMaintenanceWork(input.maintenanceWork);
      const completedNotes = asLongText(input.completedNotes);
      const completedBy = asText(input.completedBy);
      if (sourceScanEventId && !isAssetMaintenanceRecordId(sourceScanEventId)) {
        throw new Error('MAINTENANCE_SOURCE_EVENT_REQUIRED');
      }
      const procedureKind = assetMaintenanceProcedureKindFromNote(completedNotes);
      if (
        !guard.allowUnknownDetails
        && !assetMaintenanceProcedureMatchesType(existing.maintenanceType, procedureKind)
      ) {
        throw new Error('COMPLETION_DETAILS_REQUIRED');
      }
      if (!completedBy) throw new Error('COMPLETION_PERFORMER_REQUIRED');
      if (
        !guard.allowUnknownDetails
        && existing.maintenanceType === 'service'
        && (!/^Company:\s*\S/im.test(completedNotes) || !/^Mechanic:\s*\S/im.test(completedNotes))
      ) {
        throw new Error('COMPLETION_SERVICE_PROVIDER_REQUIRED');
      }

      const requestedCompletedAt = asText(input.completedAt);
      const completedDate = requestedCompletedAt ? completionDateOnly(requestedCompletedAt) : null;
      if (requestedCompletedAt && !completedDate) throw new Error('COMPLETION_DATE_INVALID');
      if (completedDate && completedDate > todayJohannesburgDateOnly()) {
        throw new Error('COMPLETION_DATE_IN_FUTURE');
      }
      const completedAtIso = completedDate
        ? /^\d{4}-\d{2}-\d{2}$/.test(requestedCompletedAt)
          ? `${completedDate}T12:00:00+02:00`
          : new Date(requestedCompletedAt).toISOString()
        : new Date().toISOString();

      await client.query(
        `
          update public.asset_maintenance_records
          set
            status = 'done',
            completed_at = $3::timestamptz,
            completed_usage = $4,
            completed_notes = $5,
            maintenance_work = $8::jsonb,
            completed_by = $6,
            source_scan_event_id = coalesce($7::uuid, source_scan_event_id),
            alert_noted_at = now(),
            updated_at = now()
          where user_id = $1
            and id = $2::uuid
            and lower(trim(coalesce(status, 'upcoming'))) not in ('done', 'cancelled', 'canceled')
        `,
        [
          userId,
          maintenanceId,
          completedAtIso,
          completedUsage,
          completedNotes,
          completedBy,
          sourceScanEventId || null,
          JSON.stringify(maintenanceWork),
        ],
      );

      const updated = await getAssetMaintenanceRecordByIdWithClient(client, userId, maintenanceId);
      if (!updated || updated.status !== 'done') throw new Error('MAINTENANCE_NOT_FOUND');
      completed = updated;
    }

    const nextRecord = await createNextRecurringRecord(client, userId, completed);
    await client.query('commit');
    return { completed, nextRecord };
  } catch (error) {
    await client.query('rollback');
    throw error;
  } finally {
    client.release();
  }
}

export async function reopenAssetMaintenanceRecord(userId: string, maintenanceId: string): Promise<AssetMaintenanceRecord> {
  await ensureAssetMaintenanceTables();

  const db = getDb();
  const client = await db.connect();

  try {
    await client.query('begin');

    const recordResult = await client.query<{ status: string }>(
      `
        select coalesce(status, 'upcoming') as status
        from public.asset_maintenance_records
        where user_id = $1
          and id = $2::uuid
          and coalesce(status, 'upcoming') <> 'cancelled'
        for update
      `,
      [userId, maintenanceId],
    );
    const status = normalizeStatus(recordResult.rows[0]?.status);

    if (!recordResult.rows[0]) throw new Error('MAINTENANCE_NOT_FOUND');

    if (status === 'done') {
      const childResult = await client.query<{ id: string; status: string }>(
        `
          select id::text as id, coalesce(status, 'upcoming') as status
          from public.asset_maintenance_records
          where user_id = $1
            and generated_from_maintenance_id = $2::uuid
            and status <> 'cancelled'
          order by created_at desc, id desc
          limit 1
          for update
        `,
        [userId, maintenanceId],
      );
      const child = childResult.rows[0];

      if (child && normalizeStatus(child.status) === 'done') {
        throw new Error('RECURRING_FOLLOWUP_ALREADY_COMPLETED');
      }

      if (child) {
        await client.query(
          `
            update public.asset_maintenance_records
            set status = 'cancelled', updated_at = now()
            where user_id = $1
              and id = $2::uuid
              and coalesce(status, 'upcoming') = 'upcoming'
          `,
          [userId, child.id],
        );
      }

      await client.query(
        `
          update public.asset_maintenance_records
          set
            status = 'upcoming',
            completed_at = null,
            completed_usage = null,
            completed_notes = null,
            maintenance_work = null,
            completed_by = null,
            alert_noted_at = null,
            updated_at = now()
          where user_id = $1
            and id = $2::uuid
            and status = 'done'
        `,
        [userId, maintenanceId],
      );
    }

    await client.query('commit');
  } catch (error) {
    await client.query('rollback');
    throw error;
  } finally {
    client.release();
  }

  const reopened = await getAssetMaintenanceRecordById(userId, maintenanceId);
  if (!reopened || reopened.status !== 'upcoming') throw new Error('MAINTENANCE_NOT_FOUND');
  return reopened;
}

export async function markAssetMaintenanceAlertNoted(userId: string, maintenanceId: string): Promise<AssetMaintenanceRecord> {
  await ensureAssetMaintenanceTables();

  await getDb().query(
    `
      update public.asset_maintenance_records
      set alert_noted_at = now(), updated_at = now()
      where user_id = $1
        and id = $2::uuid
        and coalesce(status, 'upcoming') = 'upcoming'
    `,
    [userId, maintenanceId],
  );

  const record = await getAssetMaintenanceRecordById(userId, maintenanceId);
  if (!record) throw new Error('MAINTENANCE_NOT_FOUND');
  return record;
}

function alertPriority(alert: AssetMaintenanceAlert): number {
  if (alert.computedStatus === 'overdue') return 0;
  if (alert.computedStatus === 'due') return 1;
  if (alert.computedStatus === 'due_soon') return 2;
  return 3;
}

export function buildAlertBody(record: AssetMaintenanceRecord): string {
  const typeLabel = record.maintenanceType === 'checkup' ? 'Checkup' : 'Service';
  const metric = record.usageMetric ?? record.assetUsageMetric;

  if (record.triggerType === 'date') {
    if (!record.dueDate) return `${typeLabel} is upcoming.`;
    if (record.computedStatus === 'overdue' && typeof record.daysUntilDue === 'number') {
      const days = Math.abs(record.daysUntilDue);
      return `${typeLabel} overdue by ${days.toLocaleString('en-ZA')} day${days === 1 ? '' : 's'}.`;
    }
    return `${typeLabel} due on ${formatDateLabel(record.dueDate)}.`;
  }

  if (record.computedStatus === 'overdue' && typeof record.remainingUsage === 'number') {
    const overdue = Math.abs(record.remainingUsage);
    return `${typeLabel} overdue by ${formatUsage(overdue, metric)}.`;
  }

  const due = formatUsage(record.dueUsage, metric) || '-';
  const current = formatUsage(record.currentUsage, metric) || '-';
  return `${typeLabel} due at ${due}. Current reading: ${current}.`;
}

export async function attachUpcomingMaintenanceAlertsToAssets<T extends AssetForAlert>(
  ownerUserId: string,
  assets: T[],
): Promise<Array<T & { maintenanceAlert: AssetMaintenanceAlert | null }>> {
  if (!assets.length) return [];

  await ensureAssetMaintenanceTables();

  const assetIds = assets.map((asset) => asText(asset.id)).filter(Boolean);
  if (!assetIds.length) return assets.map((asset) => ({ ...asset, maintenanceAlert: null }));

  const result = await getDb().query<MaintenanceRow>(
    `
      ${maintenanceSelectSql(`where m.user_id = $1 and m.asset_register_item_id = any($2::uuid[]) and coalesce(m.status, 'upcoming') = 'upcoming' and m.alert_noted_at is null`)}
      order by m.created_at desc, m.id desc
    `,
    [ownerUserId, assetIds],
  );

  const records = result.rows.map(mapMaintenanceRow).filter((record) => {
    if (record.status !== 'upcoming') return false;
    return record.computedStatus === 'overdue' || record.computedStatus === 'due' || record.computedStatus === 'due_soon';
  });

  const alertsByAssetId = new Map<string, AssetMaintenanceAlert>();

  records.forEach((record) => {
    const alert: AssetMaintenanceAlert = {
      id: record.id,
      assetRegisterItemId: record.assetId,
      maintenanceType: record.maintenanceType,
      triggerType: record.triggerType,
      computedStatus: record.computedStatus,
      computedStatusLabel: record.computedStatusLabel,
      heading: 'Maintenance upcoming',
      body: buildAlertBody(record),
      dueDate: record.dueDate,
      dueUsage: record.dueUsage,
      currentUsage: record.currentUsage,
      usageMetric: record.usageMetric,
      alertBeforeValue: record.alertBeforeValue,
      alertBeforeUnit: record.alertBeforeUnit,
      updatedAtIso: record.updatedAtIso,
      createdAtIso: record.createdAtIso,
    };

    const current = alertsByAssetId.get(record.assetId);
    if (!current || alertPriority(alert) < alertPriority(current)) {
      alertsByAssetId.set(record.assetId, alert);
      return;
    }

    if (alertPriority(alert) === alertPriority(current)) {
      const currentRecord = records.find((entry) => entry.id === current.id);
      if (!currentRecord) {
        alertsByAssetId.set(record.assetId, alert);
        return;
      }

      if (record.triggerType === 'date' && currentRecord.triggerType === 'date') {
        const currentDate = currentRecord.dueDate ? new Date(`${currentRecord.dueDate}T00:00:00Z`).getTime() : Number.POSITIVE_INFINITY;
        const nextDate = record.dueDate ? new Date(`${record.dueDate}T00:00:00Z`).getTime() : Number.POSITIVE_INFINITY;
        if (nextDate < currentDate) alertsByAssetId.set(record.assetId, alert);
        return;
      }

      const currentRemaining = typeof currentRecord.remainingUsage === 'number' ? currentRecord.remainingUsage : Number.POSITIVE_INFINITY;
      const nextRemaining = typeof record.remainingUsage === 'number' ? record.remainingUsage : Number.POSITIVE_INFINITY;
      if (nextRemaining < currentRemaining) alertsByAssetId.set(record.assetId, alert);
    }
  });

  return assets.map((asset) => ({
    ...asset,
    maintenanceAlert: alertsByAssetId.get(asset.id) ?? null,
  }));
}
