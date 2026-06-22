import { getDb } from './db';

export type AssetDepreciationSnapshot = {
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
  estimatedValueExVat: number;
  selectedMethod: string;
  depreciationMethodUsed: string;
  previousEstimatedValueExVat: number | null;
  depreciationSincePreviousExVat: number | null;
  depreciationSincePreviousPercent: number | null;
  metadataJson: Record<string, unknown>;
  createdAtIso: string;
};

export type DepreciationTimelineSummary = {
  openingTimelineValueExVat: number | null;
  currentValueExVat: number | null;
  totalMarketDepreciationExVat: number | null;
  totalMovementPercent: number | null;
  firstSnapshotDateIso: string | null;
  latestSnapshotDateIso: string | null;
  snapshotCount: number;
  latestUsageAmount: number | null;
  latestUsageMetric: string;
  latestCondition: string;
  replacementPriceUsedExVat: number | null;
};

export type DepreciationAnnualSummary = {
  year: number;
  openingValueExVat: number | null;
  closingValueExVat: number | null;
  yearlyDepreciationExVat: number | null;
  yearlyMovementPercent: number | null;
  snapshotCount: number;
  latestUsageAmount: number | null;
  latestUsageMetric: string;
  latestCondition: string;
};

type DepreciationSnapshotAssetInput = {
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

type CaptureAssetDepreciationSnapshotInput = {
  asset: DepreciationSnapshotAssetInput;
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
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'string' && value.trim()) {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? value.trim() : parsed.toISOString();
  }
  return new Date().toISOString();
}

function nullableIsoString(value: unknown): string | null {
  if (!value) return null;
  return toIsoString(value);
}

function normalizeMoney(value: unknown): number | null {
  const parsed = asNumber(value);
  if (parsed === null || !Number.isFinite(parsed) || parsed <= 0) return null;
  return Math.round(parsed * 100) / 100;
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

function readUsageMetric(asset: DepreciationSnapshotAssetInput, specs: Record<string, unknown>): string {
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
  if (raw === 'percent' || raw === 'percentage' || raw === 'percent_used' || raw === 'wear_class') return 'percent';
  if (String(asset.kind ?? '').trim().toLowerCase() === 'vehicle') return 'km';
  return 'hours';
}

function readUsageAmount(asset: DepreciationSnapshotAssetInput, specs: Record<string, unknown>): number | null {
  return asNumber(asset.usageAmount) ?? asNumber(asset.hours) ?? readNumberFromSpecs(specs, ['usageAmount', 'usage_amount', 'hours', 'engine_hours', 'km', 'kilometres', 'kilometers']);
}

function readLifeWorkedPercent(asset: DepreciationSnapshotAssetInput, specs: Record<string, unknown>): number | null {
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

function buildSnapshotValues(asset: DepreciationSnapshotAssetInput) {
  const specs = asRecord(asset.specsJson);
  const estimatedValueExVat = normalizeMoney(asset.selectedValueExVat) ?? normalizeMoney(asset.value);
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
    estimatedValueExVat,
    selectedMethod: asText(asset.selectedMethod),
    depreciationMethodUsed: asText(asset.depreciationMethodUsed),
  };
}

function rowToSourceAsset(row: AssetSnapshotSourceRow): DepreciationSnapshotAssetInput {
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

function mapSnapshotRow(row: AssetDepreciationSnapshotRow): AssetDepreciationSnapshot {
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
    estimatedValueExVat: Math.round((asNumber(row.estimated_value_ex_vat) ?? 0) * 100) / 100,
    selectedMethod: asText(row.selected_method),
    depreciationMethodUsed: asText(row.depreciation_method_used),
    previousEstimatedValueExVat: asNumber(row.previous_estimated_value_ex_vat),
    depreciationSincePreviousExVat: asNumber(row.depreciation_since_previous_ex_vat),
    depreciationSincePreviousPercent: asNumber(row.depreciation_since_previous_percent),
    metadataJson: asRecord(row.metadata_json),
    createdAtIso: toIsoString(row.created_at),
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

const BASELINE_TIMELINE_EVENT_TYPES = new Set([
  'backfill_current_asset_state',
  'manual_asset_created',
  'valuation_asset_saved',
]);

const SAVED_REVALUATION_TIMELINE_EVENT_TYPES = new Set([
  'automatic_revaluation_saved',
]);

const VALUATION_RELEVANT_UPDATE_EVENT_TYPES = new Set([
  'manual_asset_updated',
  'qr_scan_update',
]);

const DEPRECIATION_REASON_MARKERS = [
  'usage',
  'hour',
  'km',
  'kilometre',
  'kilometer',
  'life worked',
  'percent',
  'condition',
  'year',
  'age',
  'staged depreciation',
  'value unchanged',
];

function collectReasonText(value: unknown, reasons: string[]): void {
  if (Array.isArray(value)) {
    value.forEach((item) => collectReasonText(item, reasons));
    return;
  }

  if (typeof value === 'string' && value.trim()) {
    reasons.push(value.trim());
  }
}

function readTimelineReasonText(metadata: Record<string, unknown>): string[] {
  const reasons: string[] = [];

  collectReasonText(metadata.valuationRelevantReasons, reasons);
  collectReasonText(metadata.timelineEventReasons, reasons);
  collectReasonText(metadata.valuationStaleReasons, reasons);
  collectReasonText(metadata.depreciationReasons, reasons);
  collectReasonText(metadata.depreciationReason, reasons);
  collectReasonText(metadata.reason, reasons);

  return reasons;
}

function hasDepreciationReason(metadata: Record<string, unknown>): boolean {
  return readTimelineReasonText(metadata).some((reason) => {
    const normalized = reason.toLowerCase();
    return DEPRECIATION_REASON_MARKERS.some((marker) => normalized.includes(marker));
  });
}

function isDepreciationTimelineEntry(snapshot: AssetDepreciationSnapshot): boolean {
  const eventType = snapshot.eventType.trim().toLowerCase();

  if (BASELINE_TIMELINE_EVENT_TYPES.has(eventType) || SAVED_REVALUATION_TIMELINE_EVENT_TYPES.has(eventType)) {
    return true;
  }

  if (!VALUATION_RELEVANT_UPDATE_EVENT_TYPES.has(eventType)) {
    return false;
  }

  return snapshot.metadataJson.valuationNeedsUpdate === true || hasDepreciationReason(snapshot.metadataJson);
}

function isDuplicateSnapshot(latest: AssetDepreciationSnapshot | null, next: ReturnType<typeof buildSnapshotValues>): boolean {
  if (!latest) return false;

  return (
    numbersMatch(latest.estimatedValueExVat, next.estimatedValueExVat) &&
    numbersMatch(latest.yearModel, next.yearModel) &&
    numbersMatch(latest.usageAmount, next.usageAmount) &&
    textMatches(latest.usageMetric, next.usageMetric) &&
    numbersMatch(latest.lifeWorkedPercent, next.lifeWorkedPercent) &&
    textMatches(latest.condition, next.condition) &&
    numbersMatch(latest.replacementPriceExVat, next.replacementPriceExVat) &&
    numbersMatch(latest.valuationRunId, next.valuationRunId)
  );
}

export async function captureAssetDepreciationSnapshot(input: CaptureAssetDepreciationSnapshotInput): Promise<AssetDepreciationSnapshot | null> {
  try {
    const values = buildSnapshotValues(input.asset);

    if (!values.userId || !values.assetRegisterItemId || values.estimatedValueExVat === null || values.estimatedValueExVat <= 0) {
      return null;
    }

    const db = getDb();
    const latestResult = await db.query<AssetDepreciationSnapshotRow>(
      `
        select *
        from public.asset_depreciation_snapshots
        where user_id = $1
          and asset_register_item_id = $2::uuid
        order by captured_at desc, created_at desc, id desc
        limit 1
      `,
      [values.userId, values.assetRegisterItemId],
    );
    const latestSnapshot = latestResult.rows[0] ? mapSnapshotRow(latestResult.rows[0]) : null;

    if (isDuplicateSnapshot(latestSnapshot, values)) {
      return null;
    }

    const previousValue = latestSnapshot?.estimatedValueExVat ?? null;
    const depreciationSincePrevious = previousValue === null ? null : Math.round((previousValue - values.estimatedValueExVat) * 100) / 100;
    const depreciationSincePreviousPercent = previousValue && previousValue > 0 && depreciationSincePrevious !== null
      ? Math.round((depreciationSincePrevious / previousValue) * 10000) / 100
      : null;
    const metadata = {
      ...(input.metadata ?? {}),
      capturedBy: 'asset-depreciation-timeline',
    };

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
        values.userId,
        values.registerId,
        values.assetRegisterItemId,
        values.valuationRunId,
        nullableIsoString(input.capturedAt),
        asText(input.eventType) || 'asset_snapshot',
        asText(input.eventSource),
        values.assetTitle,
        values.assetKind,
        values.sectorId,
        values.equipmentFamilyId,
        values.equipmentFamilyKey,
        values.equipmentFamilyLabel,
        values.brandName,
        values.modelName,
        values.yearModel,
        values.usageAmount,
        values.usageMetric,
        values.lifeWorkedPercent,
        values.lifeRemainingPercent,
        values.condition,
        values.replacementPriceExVat,
        values.estimatedValueExVat,
        values.selectedMethod,
        values.depreciationMethodUsed,
        previousValue,
        depreciationSincePrevious,
        depreciationSincePreviousPercent,
        JSON.stringify(metadata),
      ],
    );

    return inserted.rows[0] ? mapSnapshotRow(inserted.rows[0]) : null;
  } catch (error) {
    console.error('asset depreciation snapshot capture failed', error);
    return null;
  }
}

export async function captureAssetDepreciationSnapshotForAssetId(input: {
  userId: string;
  assetId: string;
  eventType: string;
  eventSource?: string | null;
  capturedAt?: string | Date | null;
  metadata?: Record<string, unknown>;
}): Promise<AssetDepreciationSnapshot | null> {
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

    return captureAssetDepreciationSnapshot({
      asset: rowToSourceAsset(row),
      eventType: input.eventType,
      eventSource: input.eventSource,
      capturedAt: input.capturedAt,
      metadata: input.metadata,
    });
  } catch (error) {
    console.error('asset depreciation snapshot lookup failed', error);
    return null;
  }
}

export async function listAssetDepreciationSnapshotsForAsset(input: {
  userId: string;
  assetId: string;
  fromIso?: string | null;
  toIso?: string | null;
}): Promise<AssetDepreciationSnapshot[]> {
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

  return result.rows.map(mapSnapshotRow).filter(isDepreciationTimelineEntry);
}

export function buildDepreciationTimelineSummary(
  snapshots: AssetDepreciationSnapshot[],
  fallbackAsset?: Pick<DepreciationSnapshotAssetInput, 'value' | 'selectedValueExVat' | 'hours' | 'usageMetric' | 'lifeWorkedPercent' | 'condition' | 'replacementPriceExVat' | 'specsJson'>,
): DepreciationTimelineSummary {
  const first = snapshots[0] ?? null;
  const latest = snapshots[snapshots.length - 1] ?? null;
  const fallbackSpecs = asRecord(fallbackAsset?.specsJson);
  const fallbackValue = normalizeMoney(fallbackAsset?.selectedValueExVat) ?? normalizeMoney(fallbackAsset?.value);
  const openingValue = first?.estimatedValueExVat ?? fallbackValue;
  const currentValue = latest?.estimatedValueExVat ?? fallbackValue;
  const totalDepreciation = openingValue !== null && currentValue !== null ? Math.round((openingValue - currentValue) * 100) / 100 : null;
  const totalMovementPercent = openingValue && openingValue > 0 && totalDepreciation !== null
    ? Math.round((totalDepreciation / openingValue) * 10000) / 100
    : null;
  const fallbackUsageMetric = fallbackAsset ? readUsageMetric(fallbackAsset, fallbackSpecs) : '';

  return {
    openingTimelineValueExVat: openingValue,
    currentValueExVat: currentValue,
    totalMarketDepreciationExVat: totalDepreciation,
    totalMovementPercent,
    firstSnapshotDateIso: first?.capturedAtIso ?? null,
    latestSnapshotDateIso: latest?.capturedAtIso ?? null,
    snapshotCount: snapshots.length,
    latestUsageAmount: latest?.usageAmount ?? asNumber(fallbackAsset?.hours),
    latestUsageMetric: latest?.usageMetric || fallbackUsageMetric,
    latestCondition: latest?.condition || asText(fallbackAsset?.condition),
    replacementPriceUsedExVat: latest?.replacementPriceExVat ?? normalizeMoney(fallbackAsset?.replacementPriceExVat) ?? readReplacementPriceFromSpecs(fallbackSpecs),
  };
}

export function buildDepreciationAnnualSummary(snapshots: AssetDepreciationSnapshot[]): DepreciationAnnualSummary[] {
  const grouped = new Map<number, AssetDepreciationSnapshot[]>();

  snapshots.forEach((snapshot) => {
    const parsed = new Date(snapshot.capturedAtIso);
    if (Number.isNaN(parsed.getTime())) return;
    const year = parsed.getFullYear();
    const group = grouped.get(year) ?? [];
    group.push(snapshot);
    grouped.set(year, group);
  });

  return Array.from(grouped.entries())
    .sort(([leftYear], [rightYear]) => leftYear - rightYear)
    .map(([year, yearSnapshots]) => {
      const ordered = yearSnapshots.slice().sort((left, right) => new Date(left.capturedAtIso).getTime() - new Date(right.capturedAtIso).getTime());
      const first = ordered[0] ?? null;
      const latest = ordered[ordered.length - 1] ?? null;
      const openingValue = first?.estimatedValueExVat ?? null;
      const closingValue = latest?.estimatedValueExVat ?? null;
      const depreciation = openingValue !== null && closingValue !== null ? Math.round((openingValue - closingValue) * 100) / 100 : null;
      const movementPercent = openingValue && openingValue > 0 && depreciation !== null
        ? Math.round((depreciation / openingValue) * 10000) / 100
        : null;

      return {
        year,
        openingValueExVat: openingValue,
        closingValueExVat: closingValue,
        yearlyDepreciationExVat: depreciation,
        yearlyMovementPercent: movementPercent,
        snapshotCount: ordered.length,
        latestUsageAmount: latest?.usageAmount ?? null,
        latestUsageMetric: latest?.usageMetric ?? '',
        latestCondition: latest?.condition ?? '',
      };
    });
}
