import { getDb } from './db';
import {
  combineDepreciationUmbrellaAnnualSummaries,
  combineDepreciationUmbrellaLogSummaries,
} from './depreciation-umbrella-summary';
import { reportYearInTimeZone, sortReportEntriesChronologically } from './report-chronology';

export type AssetDepreciationLogEntry = {
  id: string;
  userId: string;
  registerId: string | null;
  assetRegisterItemId: string;
  valuationRunId: number | null;
  capturedAtIso: string;
  eventType: string;
  eventSource: string;
  assetTitle: string;
  assetKind: string;
  sectorId: number | null;
  equipmentFamilyId: number | null;
  equipmentFamilyKey: string;
  equipmentFamilyLabel: string;
  brandName: string;
  modelName: string;
  yearModel: number | null;
  usageAmount: number | null;
  usageMetric: string;
  lifeWorkedPercent: number | null;
  lifeRemainingPercent: number | null;
  condition: string;
  replacementPriceExVat: number | null;
  previousValueExVat: number | null;
  newValueExVat: number;
  differenceValueExVat: number | null;
  differencePercent: number | null;
  selectedMethod: string;
  depreciationMethodUsed: string;
  metadataJson: Record<string, unknown>;
  createdAtIso: string;

  // Compatibility aliases for existing report/export code and the existing database column names.
  estimatedValueExVat: number;
  previousEstimatedValueExVat: number | null;
  depreciationSincePreviousExVat: number | null;
  depreciationSincePreviousPercent: number | null;
};

export type AssetDepreciationSnapshot = AssetDepreciationLogEntry;

export type DepreciationLogSummary = {
  openingLogValueExVat: number | null;
  openingTimelineValueExVat: number | null;
  currentValueExVat: number | null;
  totalDifferenceExVat: number | null;
  totalMarketDepreciationExVat: number | null;
  totalMovementPercent: number | null;
  firstLogEntryDateIso: string | null;
  firstSnapshotDateIso: string | null;
  latestLogEntryDateIso: string | null;
  latestSnapshotDateIso: string | null;
  logEntryCount: number;
  snapshotCount: number;
  latestUsageAmount: number | null;
  latestUsageMetric: string;
  latestCondition: string;
  replacementPriceUsedExVat: number | null;
};

export type DepreciationTimelineSummary = DepreciationLogSummary;

export type DepreciationAnnualSummary = {
  year: number;
  openingValueExVat: number | null;
  closingValueExVat: number | null;
  yearlyDifferenceExVat: number | null;
  yearlyDepreciationExVat: number | null;
  yearlyMovementPercent: number | null;
  logEntryCount: number;
  snapshotCount: number;
  latestUsageAmount: number | null;
  latestUsageMetric: string;
  latestCondition: string;
};

export type DepreciationLogAssetInput = {
  id?: string;
  userId?: string;
  registerId?: string | null;
  valuationRunId?: number | null;
  title?: string | null;
  kind?: string | null;
  sectorId?: number | null;
  equipmentFamilyId?: number | null;
  equipmentFamilyKey?: string | null;
  equipmentFamilyLabel?: string | null;
  brandName?: string | null;
  modelName?: string | null;
  typedModelName?: string | null;
  yearModel?: number | null;
  hours?: number | null;
  usageAmount?: number | null;
  usageMetric?: string | null;
  lifeWorkedPercent?: number | null;
  lifeRemainingPercent?: number | null;
  condition?: string | null;
  replacementPriceExVat?: number | null;
  replacementPriceUsedExVat?: number | null;
  userReplacementPriceExVat?: number | null;
  value?: number | null;
  selectedValueExVat?: number | null;
  selectedMethod?: string | null;
  depreciationMethodUsed?: string | null;
  specsJson?: Record<string, unknown> | null;
};

type CaptureAssetDepreciationLogEntryInput = {
  asset: DepreciationLogAssetInput;
  previousAsset?: DepreciationLogAssetInput | null;
  eventType: string;
  eventSource?: string | null;
  capturedAt?: string | Date | null;
  metadata?: Record<string, unknown>;
};

type AssetSnapshotSourceRow = {
  id: string | number;
  user_id: string | null;
  register_id: string | null;
  valuation_run_id: string | number | null;
  title: string | null;
  kind: string | null;
  sector_id: string | number | null;
  equipment_family_id: string | number | null;
  equipment_family_key: string | null;
  equipment_family_label: string | null;
  brand_name: string | null;
  model_name: string | null;
  typed_model_name: string | null;
  year_model: string | number | null;
  hours: string | number | null;
  life_worked_percent: string | number | null;
  life_remaining_percent: string | number | null;
  condition: string | null;
  replacement_price_used_ex_vat: string | number | null;
  user_replacement_price_ex_vat: string | number | null;
  value: string | number | null;
  selected_value_ex_vat: string | number | null;
  selected_method: string | null;
  depreciation_method_used: string | null;
  specs_json: unknown;
};

type AssetDepreciationSnapshotRow = {
  id: string | number;
  user_id: string | null;
  register_id: string | null;
  asset_register_item_id: string | number | null;
  valuation_run_id: string | number | null;
  captured_at: string | Date | null;
  event_type: string | null;
  event_source: string | null;
  asset_title: string | null;
  asset_kind: string | null;
  sector_id: string | number | null;
  equipment_family_id: string | number | null;
  equipment_family_key: string | null;
  equipment_family_label: string | null;
  brand_name: string | null;
  model_name: string | null;
  year_model: string | number | null;
  usage_amount: string | number | null;
  usage_metric: string | null;
  life_worked_percent: string | number | null;
  life_remaining_percent: string | number | null;
  condition: string | null;
  replacement_price_ex_vat: string | number | null;
  estimated_value_ex_vat: string | number | null;
  selected_method: string | null;
  depreciation_method_used: string | null;
  previous_estimated_value_ex_vat: string | number | null;
  depreciation_since_previous_ex_vat: string | number | null;
  depreciation_since_previous_percent: string | number | null;
  metadata_json: unknown;
  created_at: string | Date | null;
};

type DepreciationLogValues = ReturnType<typeof buildLogValues>;

function asText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function asNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const parsed = Number(trimmed.replace(/[^0-9.-]+/g, ''));
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function asIdText(value: unknown): string {
  return String(value ?? '').trim();
}

function asRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }

  if (typeof value === 'string' && value.trim()) {
    try {
      const parsed = JSON.parse(value) as unknown;
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      return {};
    }
  }

  return {};
}

function toIsoString(value: unknown): string {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? '' : value.toISOString();
  if (typeof value === 'string' && value.trim()) {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? '' : parsed.toISOString();
  }
  return '';
}

function nullableIsoString(value: unknown): string | null {
  if (!value) return null;
  return toIsoString(value) || null;
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

function normalizeMoney(value: unknown): number | null {
  const parsed = asNumber(value);
  if (parsed === null || !Number.isFinite(parsed) || parsed <= 0) return null;
  return roundMoney(parsed);
}

function normalizeSavedValue(value: unknown): number | null {
  const parsed = asNumber(value);
  if (parsed === null || !Number.isFinite(parsed) || parsed < 0) return null;
  return roundMoney(parsed);
}

function normalizePercent(value: unknown): number | null {
  const parsed = asNumber(value);
  if (parsed === null || !Number.isFinite(parsed)) return null;
  return Math.max(0, Math.min(100, Math.round(parsed * 100) / 100));
}

function readNumberFromSpecs(specs: Record<string, unknown>, keys: string[]): number | null {
  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(specs, key)) {
      const parsed = asNumber(specs[key]);
      if (parsed !== null) return parsed;
    }
  }
  return null;
}

function readReplacementPriceFromSpecs(specs: Record<string, unknown>): number | null {
  return normalizeMoney(
    specs.replacementPriceExVat ??
      specs.replacement_price_ex_vat ??
      specs.replacementPrice ??
      specs.replacement_price ??
      specs.replacementPriceUsedExVat ??
      specs.replacement_price_used_ex_vat ??
      specs.userReplacementPriceExVat ??
      specs.user_replacement_price_ex_vat ??
      specs.officialReplacementPriceExVat ??
      specs.official_replacement_price_ex_vat,
  );
}

function readUsageMetric(asset: DepreciationLogAssetInput, specs: Record<string, unknown>): string {
  const raw = String(
    asset.usageMetric ??
      specs.usageMetric ??
      specs.usage_metric ??
      specs.usageUnit ??
      specs.usage_unit ??
      specs.usageMetricType ??
      specs.usage_metric_type ??
      '',
  )
    .trim()
    .toLowerCase();

  if (raw === 'km' || raw === 'kms' || raw === 'kilometres' || raw === 'kilometers') return 'km';
  if (raw === 'percent' || raw === 'percentage' || raw === 'percentage_depreciation' || raw === 'percent_used' || raw === 'wear_class') return 'percent';
  if (String(asset.kind ?? '').trim().toLowerCase() === 'vehicle') return 'km';
  return 'hours';
}

function readUsageAmount(asset: DepreciationLogAssetInput, specs: Record<string, unknown>): number | null {
  return asNumber(asset.usageAmount) ?? asNumber(asset.hours) ?? readNumberFromSpecs(specs, ['usageAmount', 'usage_amount', 'hours', 'engine_hours', 'km', 'kilometres', 'kilometers']);
}

function readLifeWorkedPercent(asset: DepreciationLogAssetInput, specs: Record<string, unknown>): number | null {
  return (
    normalizePercent(asset.lifeWorkedPercent) ??
    normalizePercent(specs.lifeWorkedPercent) ??
    normalizePercent(specs.life_worked_percent) ??
    normalizePercent(specs.worked_percent) ??
    normalizePercent(specs.percent_worked) ??
    normalizePercent(specs.lifetime_worked_percent) ??
    normalizePercent(specs.lifetime_used_percent)
  );
}

function buildLogValues(asset: DepreciationLogAssetInput) {
  const specs = asRecord(asset.specsJson);
  const newValueExVat = normalizeSavedValue(asset.selectedValueExVat) ?? normalizeSavedValue(asset.value);
  const replacementPriceExVat =
    normalizeMoney(asset.replacementPriceExVat) ??
    normalizeMoney(asset.replacementPriceUsedExVat) ??
    normalizeMoney(asset.userReplacementPriceExVat) ??
    readReplacementPriceFromSpecs(specs);
  const lifeWorkedPercent = readLifeWorkedPercent(asset, specs);
  const lifeRemainingPercent =
    normalizePercent(asset.lifeRemainingPercent) ??
    (lifeWorkedPercent === null ? null : Math.max(0, Math.round((100 - lifeWorkedPercent) * 100) / 100));
  const modelName = asText(asset.modelName) || asText(asset.typedModelName);

  return {
    userId: asText(asset.userId),
    registerId: asText(asset.registerId) || null,
    assetRegisterItemId: asIdText(asset.id),
    valuationRunId: asNumber(asset.valuationRunId),
    assetTitle: asText(asset.title) || 'Asset',
    assetKind: asText(asset.kind),
    sectorId: asNumber(asset.sectorId),
    equipmentFamilyId: asNumber(asset.equipmentFamilyId),
    equipmentFamilyKey: asText(asset.equipmentFamilyKey),
    equipmentFamilyLabel: asText(asset.equipmentFamilyLabel),
    brandName: asText(asset.brandName),
    modelName,
    yearModel: asNumber(asset.yearModel),
    usageAmount: readUsageAmount(asset, specs),
    usageMetric: readUsageMetric(asset, specs),
    lifeWorkedPercent,
    lifeRemainingPercent,
    condition: asText(asset.condition),
    replacementPriceExVat,
    newValueExVat,
    selectedMethod: asText(asset.selectedMethod),
    depreciationMethodUsed: asText(asset.depreciationMethodUsed),
  };
}

function rowToSourceAsset(row: AssetSnapshotSourceRow): DepreciationLogAssetInput {
  return {
    id: asIdText(row.id),
    userId: asText(row.user_id),
    registerId: asText(row.register_id) || null,
    valuationRunId: asNumber(row.valuation_run_id),
    title: asText(row.title),
    kind: asText(row.kind),
    sectorId: asNumber(row.sector_id),
    equipmentFamilyId: asNumber(row.equipment_family_id),
    equipmentFamilyKey: asText(row.equipment_family_key),
    equipmentFamilyLabel: asText(row.equipment_family_label),
    brandName: asText(row.brand_name),
    modelName: asText(row.model_name),
    typedModelName: asText(row.typed_model_name),
    yearModel: asNumber(row.year_model),
    hours: asNumber(row.hours),
    lifeWorkedPercent: asNumber(row.life_worked_percent),
    lifeRemainingPercent: asNumber(row.life_remaining_percent),
    condition: asText(row.condition),
    replacementPriceUsedExVat: asNumber(row.replacement_price_used_ex_vat),
    userReplacementPriceExVat: asNumber(row.user_replacement_price_ex_vat),
    value: asNumber(row.value),
    selectedValueExVat: asNumber(row.selected_value_ex_vat),
    selectedMethod: asText(row.selected_method),
    depreciationMethodUsed: asText(row.depreciation_method_used),
    specsJson: asRecord(row.specs_json),
  };
}

function normalizeStoredDifference(value: unknown, metadata: Record<string, unknown>): number | null {
  const raw = asNumber(value);
  if (raw === null) return null;

  const formula = asText(metadata.differenceFormula).toLowerCase();
  if (formula === 'previous_minus_new') return roundMoney(-raw);
  if (formula === 'new_minus_previous') return roundMoney(raw);

  // Rows captured by the old timeline helper stored previous - new. The log/report now displays new - previous.
  if (asText(metadata.capturedBy).toLowerCase() === 'asset-depreciation-timeline') {
    return roundMoney(-raw);
  }

  return roundMoney(raw);
}

function normalizeStoredDifferencePercent(value: unknown, metadata: Record<string, unknown>): number | null {
  const raw = asNumber(value);
  if (raw === null) return null;

  const formula = asText(metadata.differenceFormula).toLowerCase();
  if (formula === 'previous_minus_new') return Math.round(-raw * 10000) / 10000;
  if (formula === 'new_minus_previous') return Math.round(raw * 10000) / 10000;

  if (asText(metadata.capturedBy).toLowerCase() === 'asset-depreciation-timeline') {
    return Math.round(-raw * 10000) / 10000;
  }

  return Math.round(raw * 10000) / 10000;
}

function mapSnapshotRow(row: AssetDepreciationSnapshotRow): AssetDepreciationLogEntry {
  const metadataJson = asRecord(row.metadata_json);
  const newValueExVat = normalizeSavedValue(row.estimated_value_ex_vat) ?? 0;
  const previousValueExVat = normalizeSavedValue(row.previous_estimated_value_ex_vat);
  const differenceValueExVat = normalizeStoredDifference(row.depreciation_since_previous_ex_vat, metadataJson);
  const differencePercent = normalizeStoredDifferencePercent(row.depreciation_since_previous_percent, metadataJson);

  return {
    id: asIdText(row.id),
    userId: asText(row.user_id),
    registerId: asText(row.register_id) || null,
    assetRegisterItemId: asIdText(row.asset_register_item_id),
    valuationRunId: asNumber(row.valuation_run_id),
    capturedAtIso: toIsoString(row.captured_at),
    eventType: asText(row.event_type),
    eventSource: asText(row.event_source),
    assetTitle: asText(row.asset_title),
    assetKind: asText(row.asset_kind),
    sectorId: asNumber(row.sector_id),
    equipmentFamilyId: asNumber(row.equipment_family_id),
    equipmentFamilyKey: asText(row.equipment_family_key),
    equipmentFamilyLabel: asText(row.equipment_family_label),
    brandName: asText(row.brand_name),
    modelName: asText(row.model_name),
    yearModel: asNumber(row.year_model),
    usageAmount: asNumber(row.usage_amount),
    usageMetric: asText(row.usage_metric),
    lifeWorkedPercent: asNumber(row.life_worked_percent),
    lifeRemainingPercent: asNumber(row.life_remaining_percent),
    condition: asText(row.condition),
    replacementPriceExVat: asNumber(row.replacement_price_ex_vat),
    previousValueExVat,
    newValueExVat,
    differenceValueExVat,
    differencePercent,
    selectedMethod: asText(row.selected_method),
    depreciationMethodUsed: asText(row.depreciation_method_used),
    metadataJson,
    createdAtIso: toIsoString(row.created_at),
    estimatedValueExVat: newValueExVat,
    previousEstimatedValueExVat: previousValueExVat,
    depreciationSincePreviousExVat: differenceValueExVat,
    depreciationSincePreviousPercent: differencePercent,
  };
}

function numbersMatch(left: number | null, right: number | null): boolean {
  if (left === null && right === null) return true;
  if (left === null || right === null) return false;
  return Math.abs(left - right) < 0.01;
}

function textMatches(left: string | null | undefined, right: string | null | undefined): boolean {
  return String(left ?? '').trim() === String(right ?? '').trim();
}

function pushNumberChange(reasons: string[], label: string, previous: number | null, next: number | null): void {
  if (!numbersMatch(previous, next)) reasons.push(`${label} changed`);
}

function pushTextChange(reasons: string[], label: string, previous: string | null | undefined, next: string | null | undefined): void {
  if (!textMatches(previous, next)) reasons.push(`${label} changed`);
}

function buildDepreciationRelevantChangeReasons(previous: DepreciationLogValues, next: DepreciationLogValues): string[] {
  const reasons: string[] = [];

  pushNumberChange(reasons, 'saved value', previous.newValueExVat, next.newValueExVat);
  pushNumberChange(reasons, 'replacement price', previous.replacementPriceExVat, next.replacementPriceExVat);
  pushNumberChange(reasons, 'year', previous.yearModel, next.yearModel);
  pushNumberChange(reasons, 'usage', previous.usageAmount, next.usageAmount);
  pushTextChange(reasons, 'usage metric', previous.usageMetric, next.usageMetric);
  pushNumberChange(reasons, 'life worked', previous.lifeWorkedPercent, next.lifeWorkedPercent);
  pushTextChange(reasons, 'condition', previous.condition, next.condition);
  pushNumberChange(reasons, 'valuation run', previous.valuationRunId, next.valuationRunId);
  pushTextChange(reasons, 'selected valuation method', previous.selectedMethod, next.selectedMethod);
  pushTextChange(reasons, 'depreciation method', previous.depreciationMethodUsed, next.depreciationMethodUsed);
  pushTextChange(reasons, 'brand', previous.brandName, next.brandName);
  pushTextChange(reasons, 'model', previous.modelName, next.modelName);
  pushNumberChange(reasons, 'equipment family', previous.equipmentFamilyId, next.equipmentFamilyId);

  return Array.from(new Set(reasons));
}

function isOpeningLogEvent(eventType: string): boolean {
  const normalized = eventType.trim().toLowerCase();
  return normalized === 'manual_asset_created' || normalized === 'valuation_asset_saved' || normalized === 'opening_value';
}

const VALID_DEPRECIATION_LOG_EVENT_TYPES = new Set([
  'backfill_current_asset_state',
  'manual_asset_created',
  'manual_asset_updated',
  'valuation_asset_saved',
  'automatic_revaluation_saved',
  'qr_scan_update',
  'asset_update_log_entry',
  'opening_value',
]);

function isDepreciationLogEntry(entry: AssetDepreciationLogEntry): boolean {
  const eventType = entry.eventType.trim().toLowerCase();
  if (VALID_DEPRECIATION_LOG_EVENT_TYPES.has(eventType)) return true;

  return entry.metadataJson.updateLog === true || asText(entry.metadataJson.capturedBy).toLowerCase() === 'asset-depreciation-log';
}

async function assetAlreadyHasDepreciationLogEntry(userId: string, assetRegisterItemId: string): Promise<boolean> {
  const db = getDb();
  const result = await db.query<{ exists: number }>(
    `
      select 1 as exists
      from public.asset_depreciation_snapshots
      where user_id = $1
        and asset_register_item_id = $2::uuid
      limit 1
    `,
    [userId, assetRegisterItemId],
  );

  return result.rows.length > 0;
}

export async function captureAssetDepreciationLogEntry(input: CaptureAssetDepreciationLogEntryInput): Promise<AssetDepreciationLogEntry | null> {
  try {
    const nextValues = buildLogValues(input.asset);

    if (!nextValues.userId || !nextValues.assetRegisterItemId || nextValues.newValueExVat === null) {
      return null;
    }

    const eventType = asText(input.eventType) || 'asset_update_log_entry';
    const previousValues = input.previousAsset ? buildLogValues(input.previousAsset) : null;
    const depreciationRelevantReasons = previousValues
      ? buildDepreciationRelevantChangeReasons(previousValues, nextValues)
      : ['opening value'];

    if (!previousValues) {
      if (!isOpeningLogEvent(eventType)) {
        return null;
      }

      if (await assetAlreadyHasDepreciationLogEntry(nextValues.userId, nextValues.assetRegisterItemId)) {
        return null;
      }
    } else if (depreciationRelevantReasons.length === 0) {
      return null;
    }

    const previousValue = previousValues?.newValueExVat ?? null;
    const differenceValue = previousValue === null ? null : roundMoney(nextValues.newValueExVat - previousValue);
    const differencePercent = previousValue && previousValue > 0 && differenceValue !== null
      ? Math.round((differenceValue / previousValue) * 10000) / 100
      : null;
    const metadata = {
      ...(input.metadata ?? {}),
      capturedBy: 'asset-depreciation-log',
      updateLog: true,
      logVersion: 2,
      differenceFormula: 'new_minus_previous',
      previousValueExVat: previousValue,
      newValueExVat: nextValues.newValueExVat,
      differenceValueExVat: differenceValue,
      differencePercent,
      depreciationRelevantReasons,
      logEventReasons: depreciationRelevantReasons,
    };

    const db = getDb();
    const inserted = await db.query<AssetDepreciationSnapshotRow>(
      `
        insert into public.asset_depreciation_snapshots (
          user_id,
          register_id,
          asset_register_item_id,
          valuation_run_id,
          captured_at,
          event_type,
          event_source,
          asset_title,
          asset_kind,
          sector_id,
          equipment_family_id,
          equipment_family_key,
          equipment_family_label,
          brand_name,
          model_name,
          year_model,
          usage_amount,
          usage_metric,
          life_worked_percent,
          life_remaining_percent,
          condition,
          replacement_price_ex_vat,
          estimated_value_ex_vat,
          selected_method,
          depreciation_method_used,
          previous_estimated_value_ex_vat,
          depreciation_since_previous_ex_vat,
          depreciation_since_previous_percent,
          metadata_json
        )
        values (
          $1,
          $2::uuid,
          $3::uuid,
          $4::bigint,
          coalesce($5::timestamptz, now()),
          $6,
          $7,
          $8,
          $9,
          $10::bigint,
          $11::bigint,
          $12,
          $13,
          $14,
          $15,
          $16::integer,
          $17::numeric,
          $18,
          $19::numeric,
          $20::numeric,
          $21,
          $22::numeric,
          $23::numeric,
          $24,
          $25,
          $26::numeric,
          $27::numeric,
          $28::numeric,
          $29::jsonb
        )
        returning *
      `,
      [
        nextValues.userId,
        nextValues.registerId,
        nextValues.assetRegisterItemId,
        nextValues.valuationRunId,
        nullableIsoString(input.capturedAt),
        eventType,
        asText(input.eventSource),
        nextValues.assetTitle,
        nextValues.assetKind,
        nextValues.sectorId,
        nextValues.equipmentFamilyId,
        nextValues.equipmentFamilyKey,
        nextValues.equipmentFamilyLabel,
        nextValues.brandName,
        nextValues.modelName,
        nextValues.yearModel,
        nextValues.usageAmount,
        nextValues.usageMetric,
        nextValues.lifeWorkedPercent,
        nextValues.lifeRemainingPercent,
        nextValues.condition,
        nextValues.replacementPriceExVat,
        nextValues.newValueExVat,
        nextValues.selectedMethod,
        nextValues.depreciationMethodUsed,
        previousValue,
        differenceValue,
        differencePercent,
        JSON.stringify(metadata),
      ],
    );

    return inserted.rows[0] ? mapSnapshotRow(inserted.rows[0]) : null;
  } catch (error) {
    console.error('asset depreciation log capture failed', error);
    return null;
  }
}

export async function captureAssetDepreciationLogEntryForAssetId(input: {
  userId: string;
  assetId: string;
  previousAsset?: DepreciationLogAssetInput | null;
  eventType: string;
  eventSource?: string | null;
  capturedAt?: string | Date | null;
  metadata?: Record<string, unknown>;
}): Promise<AssetDepreciationLogEntry | null> {
  try {
    const db = getDb();
    const result = await db.query<AssetSnapshotSourceRow>(
      `
        select
          a.id,
          to_jsonb(a)->>'user_id' as user_id,
          to_jsonb(a)->>'register_id' as register_id,
          to_jsonb(a)->>'valuation_run_id' as valuation_run_id,
          to_jsonb(a)->>'title' as title,
          to_jsonb(a)->>'kind' as kind,
          to_jsonb(a)->>'sector_id' as sector_id,
          coalesce(to_jsonb(a)->>'equipment_family_id', to_jsonb(vr)->>'equipment_family_id') as equipment_family_id,
          coalesce(to_jsonb(ef)->>'family_key', '') as equipment_family_key,
          coalesce(to_jsonb(ef)->>'family_label', '') as equipment_family_label,
          to_jsonb(a)->>'brand_name' as brand_name,
          to_jsonb(a)->>'model_name' as model_name,
          to_jsonb(a)->>'typed_model_name' as typed_model_name,
          to_jsonb(a)->>'year_model' as year_model,
          to_jsonb(a)->>'hours' as hours,
          to_jsonb(a)->>'life_worked_percent' as life_worked_percent,
          to_jsonb(a)->>'life_remaining_percent' as life_remaining_percent,
          to_jsonb(a)->>'condition' as condition,
          to_jsonb(a)->>'replacement_price_used_ex_vat' as replacement_price_used_ex_vat,
          to_jsonb(a)->>'user_replacement_price_ex_vat' as user_replacement_price_ex_vat,
          coalesce(
            to_jsonb(a)->>'value',
            to_jsonb(a)->>'selected_value_ex_vat',
            to_jsonb(a)->>'selected_value',
            to_jsonb(a)->>'saved_value_ex_vat',
            to_jsonb(a)->>'aim4price_value_ex_vat',
            to_jsonb(a)->>'aim4price_value'
          ) as value,
          coalesce(
            to_jsonb(a)->>'selected_value_ex_vat',
            to_jsonb(a)->>'value',
            to_jsonb(a)->>'selected_value',
            to_jsonb(a)->>'saved_value_ex_vat',
            to_jsonb(a)->>'aim4price_value_ex_vat',
            to_jsonb(a)->>'aim4price_value',
            to_jsonb(vr)->>'selected_value_ex_vat',
            to_jsonb(vr)->>'valuation_mid_ex_vat',
            to_jsonb(vr)->>'aim4price_value_ex_vat',
            to_jsonb(vr)->>'aim4price_value'
          ) as selected_value_ex_vat,
          to_jsonb(a)->>'selected_method' as selected_method,
          to_jsonb(a)->>'depreciation_method_used' as depreciation_method_used,
          case
            when jsonb_typeof(to_jsonb(a)->'specs_json') = 'object' then to_jsonb(a)->'specs_json'
            else '{}'::jsonb
          end as specs_json
        from public.asset_register_items a
        left join public.valuation_runs vr
          on vr.id::text = to_jsonb(a)->>'valuation_run_id'
        left join public.equipment_families ef
          on ef.id::text = coalesce(to_jsonb(a)->>'equipment_family_id', to_jsonb(vr)->>'equipment_family_id')
        where to_jsonb(a)->>'user_id' = $1
          and a.id = $2::uuid
        limit 1
      `,
      [input.userId, input.assetId],
    );

    const row = result.rows[0];
    if (!row) return null;

    return captureAssetDepreciationLogEntry({
      asset: rowToSourceAsset(row),
      previousAsset: input.previousAsset,
      eventType: input.eventType,
      eventSource: input.eventSource,
      capturedAt: input.capturedAt,
      metadata: input.metadata,
    });
  } catch (error) {
    console.error('asset depreciation log lookup failed', error);
    return null;
  }
}

export async function listAssetDepreciationLogEntriesForAsset(input: {
  userId: string;
  assetId: string;
  fromIso?: string | null;
  toIso?: string | null;
}): Promise<AssetDepreciationLogEntry[]> {
  const db = getDb();
  const filters: string[] = ['user_id = $1', 'asset_register_item_id = $2::uuid'];
  const values: unknown[] = [input.userId, input.assetId];

  if (input.fromIso) {
    values.push(input.fromIso);
    filters.push(`captured_at >= $${values.length}::timestamptz`);
  }

  if (input.toIso) {
    values.push(input.toIso);
    filters.push(`captured_at < $${values.length}::timestamptz`);
  }

  const result = await db.query<AssetDepreciationSnapshotRow>(
    `
      select *
      from public.asset_depreciation_snapshots
      where ${filters.join('\n        and ')}
      order by captured_at asc, created_at asc, id asc
    `,
    values,
  );

  return result.rows.map(mapSnapshotRow).filter(isDepreciationLogEntry);
}

export function buildDepreciationLogSummary(
  entries: AssetDepreciationLogEntry[],
  fallbackAsset?: Pick<DepreciationLogAssetInput, 'value' | 'selectedValueExVat' | 'hours' | 'usageMetric' | 'lifeWorkedPercent' | 'condition' | 'replacementPriceExVat' | 'specsJson'>,
): DepreciationLogSummary {
  const orderedEntries = sortReportEntriesChronologically(entries);
  const first = orderedEntries[0] ?? null;
  const latest = orderedEntries[orderedEntries.length - 1] ?? null;
  const fallbackSpecs = asRecord(fallbackAsset?.specsJson);
  const fallbackValue = normalizeSavedValue(fallbackAsset?.selectedValueExVat) ?? normalizeSavedValue(fallbackAsset?.value);
  const openingValue = first?.previousValueExVat ?? first?.newValueExVat ?? fallbackValue;
  const currentValue = latest?.newValueExVat ?? fallbackValue;
  const totalDifference = openingValue !== null && currentValue !== null ? roundMoney(currentValue - openingValue) : null;
  const totalMovementPercent = openingValue && openingValue > 0 && totalDifference !== null
    ? Math.round((totalDifference / openingValue) * 10000) / 100
    : null;
  const fallbackUsageMetric = fallbackAsset ? readUsageMetric(fallbackAsset, fallbackSpecs) : '';

  return {
    openingLogValueExVat: openingValue,
    openingTimelineValueExVat: openingValue,
    currentValueExVat: currentValue,
    totalDifferenceExVat: totalDifference,
    totalMarketDepreciationExVat: totalDifference,
    totalMovementPercent,
    firstLogEntryDateIso: first?.capturedAtIso ?? null,
    firstSnapshotDateIso: first?.capturedAtIso ?? null,
    latestLogEntryDateIso: latest?.capturedAtIso ?? null,
    latestSnapshotDateIso: latest?.capturedAtIso ?? null,
    logEntryCount: orderedEntries.length,
    snapshotCount: orderedEntries.length,
    latestUsageAmount: latest?.usageAmount ?? asNumber(fallbackAsset?.hours),
    latestUsageMetric: latest?.usageMetric || fallbackUsageMetric,
    latestCondition: latest?.condition || asText(fallbackAsset?.condition),
    replacementPriceUsedExVat: latest?.replacementPriceExVat ?? normalizeMoney(fallbackAsset?.replacementPriceExVat) ?? readReplacementPriceFromSpecs(fallbackSpecs),
  };
}

export function buildDepreciationUmbrellaLogSummary(
  entries: AssetDepreciationLogEntry[],
  fallbackAssets: DepreciationLogAssetInput[],
): DepreciationLogSummary {
  const summaries = fallbackAssets.map((asset) => {
    const assetId = asIdText(asset.id);
    return buildDepreciationLogSummary(
      entries.filter((entry) => entry.assetRegisterItemId === assetId),
      asset,
    );
  });
  return combineDepreciationUmbrellaLogSummaries(summaries, entries);
}

export function buildDepreciationAnnualSummary(entries: AssetDepreciationLogEntry[]): DepreciationAnnualSummary[] {
  const grouped = new Map<number, AssetDepreciationLogEntry[]>();

  entries.forEach((entry) => {
    const year = reportYearInTimeZone(entry.capturedAtIso);
    if (year === null) return;
    const group = grouped.get(year) ?? [];
    group.push(entry);
    grouped.set(year, group);
  });

  return Array.from(grouped.entries())
    .sort(([leftYear], [rightYear]) => leftYear - rightYear)
    .map(([year, yearEntries]) => {
      const ordered = sortReportEntriesChronologically(yearEntries);
      const first = ordered[0] ?? null;
      const latest = ordered[ordered.length - 1] ?? null;
      const openingValue = first?.previousValueExVat ?? first?.newValueExVat ?? null;
      const closingValue = latest?.newValueExVat ?? null;
      const yearlyDifference = openingValue !== null && closingValue !== null ? roundMoney(closingValue - openingValue) : null;
      const movementPercent = openingValue && openingValue > 0 && yearlyDifference !== null
        ? Math.round((yearlyDifference / openingValue) * 10000) / 100
        : null;

      return {
        year,
        openingValueExVat: openingValue,
        closingValueExVat: closingValue,
        yearlyDifferenceExVat: yearlyDifference,
        yearlyDepreciationExVat: yearlyDifference,
        yearlyMovementPercent: movementPercent,
        logEntryCount: ordered.length,
        snapshotCount: ordered.length,
        latestUsageAmount: latest?.usageAmount ?? null,
        latestUsageMetric: latest?.usageMetric ?? '',
        latestCondition: latest?.condition ?? '',
      };
    });
}

export function buildDepreciationUmbrellaAnnualSummary(
  entries: AssetDepreciationLogEntry[],
): DepreciationAnnualSummary[] {
  const entriesByAsset = new Map<string, AssetDepreciationLogEntry[]>();
  entries.forEach((entry) => {
    const assetEntries = entriesByAsset.get(entry.assetRegisterItemId) ?? [];
    assetEntries.push(entry);
    entriesByAsset.set(entry.assetRegisterItemId, assetEntries);
  });

  const annualSummaries = Array.from(entriesByAsset.values())
    .flatMap((assetEntries) => buildDepreciationAnnualSummary(assetEntries));

  return combineDepreciationUmbrellaAnnualSummaries(annualSummaries, entries);
}

// Compatibility exports for existing imports. The table name remains unchanged for production safety.
export const captureAssetDepreciationSnapshot = captureAssetDepreciationLogEntry;
export const captureAssetDepreciationSnapshotForAssetId = captureAssetDepreciationLogEntryForAssetId;
export const listAssetDepreciationSnapshotsForAsset = listAssetDepreciationLogEntriesForAsset;
export const buildDepreciationTimelineSummary = buildDepreciationLogSummary;
