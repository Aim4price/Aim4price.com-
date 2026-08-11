import { getDb } from './db';
import { fetchEquipmentLinkForModelSelection } from './equipment-catalog';
import { runServerValuation } from './server-valuation';
import type { Result, RunValuationInput } from './tractor-logic';
import { getGenericSelectedMethodValue, type GenericSelectedMethod, type GenericValuationResult } from './generic-valuation';

export type MethodKey = 'aim4price';

export type SaveValuationRunInput = RunValuationInput & {
  yearModelUnknown?: boolean | null;
  selectedMethod: MethodKey;
  selectedValueOverrideExVat?: number | null;
  valuationVersion?: string | null;
  userId?: string | null;
};

export type SaveValuationRunResult = {
  runId: number;
  createdAtIso: string;
  selectedValueExVat: number;
  result: Result;
};

type CatalogLinkRow = {
  modelId: number;
  brandId: number | null;
  sectorId: number | null;
  equipmentFamilyId: number | null;
  equipmentModelId: number | null;
};

type InsertedValuationRunRow = {
  id: string | number;
  created_at: string;
};

function roundMoney(value: number): number {
  return Math.round(value);
}

function roundMoneyOrNull(value: unknown): number | null {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Math.round(numeric) : null;
}

function toNumberOrNull(value: unknown): number | null {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function toIntegerOrNull(value: unknown): number | null {
  const numeric = Number(value);
  return Number.isInteger(numeric) ? numeric : null;
}

function toPositiveIntegerOrNull(value: unknown): number | null {
  const numeric = toIntegerOrNull(value);
  return numeric !== null && numeric > 0 ? numeric : null;
}

function getGenericEquipmentModelId(result: GenericValuationResult): number | null {
  return (
    toPositiveIntegerOrNull(result.specsJson.catalog_model_id) ??
    toPositiveIntegerOrNull(result.specsJson.equipment_model_id) ??
    toPositiveIntegerOrNull(result.specsJson.equipmentModelId) ??
    null
  );
}

function getPersistableReplacementPriceBandId(result: GenericValuationResult): number | null {
  const band = result.replacementPriceBand;

  if (!band) {
    return null;
  }

  if (String(band.bandKey ?? '').startsWith('motor_pricing_matrix_')) {
    return null;
  }

  return toPositiveIntegerOrNull(band.id);
}

function parseGpsYear(value: number | string | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  const parsed = Number(typeof value === 'string' ? value.trim() : value);
  if (!Number.isInteger(parsed) || parsed < 1950 || parsed > new Date().getFullYear() + 1) return null;
  return parsed;
}

export function getSelectedMethodValue(result: Result, _method: MethodKey): number | null {
  return result.aim4priceValueExVat;
}

function getMarketListingIds(_result: Result): number[] {
  return [];
}

async function fetchCatalogLink(modelId: string): Promise<CatalogLinkRow | null> {
  const genericLink = await fetchEquipmentLinkForModelSelection(modelId);
  if (!genericLink?.equipmentModelId) {
    return null;
  }

  return {
    modelId: genericLink.equipmentModelId,
    brandId: genericLink.brandId,
    sectorId: genericLink.sectorId,
    equipmentFamilyId: genericLink.equipmentFamilyId,
    equipmentModelId: genericLink.equipmentModelId,
  };
}

function buildValuationPayload(input: SaveValuationRunInput, result: Result, selectedValueExVat: number) {
  return {
    input: {
      modelId: String(input.modelId),
      year: Math.round(input.year),
      displayYearModel: input.yearModelUnknown ? null : Math.round(input.year),
      yearModelUnknown: Boolean(input.yearModelUnknown),
      year_model_unknown: Boolean(input.yearModelUnknown),
      usageMode: 'hours',
      usage_mode: 'hours',
      hours: Math.max(0, Number(input.hours) || 0),
      condition: input.condition,
      frontPto: Boolean(input.frontPto),
      frontLoader: Boolean(input.frontLoader),
      gpsEnabled: Boolean(input.gpsEnabled),
      gpsType: input.gpsType ?? null,
      gpsYear: parseGpsYear(input.gpsYear),
      userReplacementPriceExVat: input.userReplacementPriceExVat ?? null,
      advancedAssumptions: result.advancedAssumptions,
    },
    output: {
      coverageBand: result.coverageBand,
      previewLabel: result.previewLabel,
      previewValueExVat: result.previewValueExVat,
      aim4priceValueExVat: result.aim4priceValueExVat,
      marketLowExVat: result.marketLow,
      marketMidExVat: result.marketMid,
      marketHighExVat: result.marketHigh,
      extrasValueExVat: result.extrasValueExVat,
      frontPtoValueExVat: result.frontPtoValueExVat,
      frontLoaderValueExVat: result.frontLoaderValueExVat,
      gpsValueExVat: result.gpsValueExVat,
      marketCount: result.marketCount,
      marketListingIds: getMarketListingIds(result),
      replacementPriceBasis: result.replacementPriceBasis,
      replacementPriceUsedExVat: result.replacementPriceUsedExVat,
      userReplacementPriceExVat: result.userReplacementPriceExVat,
      maxLifetimeHours: result.maxLifetimeHours,
      advancedAssumptions: result.advancedAssumptions,
      salvagePercent: result.salvagePercent,
      salvageValueExVat: result.salvageValueExVat,
      isSalvageEstimate: result.isSalvageEstimate,
      selectedMethod: 'aim4price',
      selectedValueExVat,
    },
  };
}

export async function saveValuationRunFromResult(
  input: SaveValuationRunInput,
  result: Result,
): Promise<SaveValuationRunResult> {
  const selectedMethod: MethodKey = 'aim4price';
  const selectedMethodValueExVat = getSelectedMethodValue(result, selectedMethod);
  const selectedValueExVat = roundMoneyOrNull(input.selectedValueOverrideExVat) ?? selectedMethodValueExVat;
  if (selectedValueExVat === null) throw new Error('SELECTED_METHOD_NOT_AVAILABLE');

  const catalogLink = await fetchCatalogLink(String(result.model.id));
  if (!catalogLink) throw new Error('MODEL_NOT_FOUND');

  const db = getDb();
  const marketListingIds = getMarketListingIds(result);
  const valuationVersion = String(input.valuationVersion ?? 'v1').trim() || 'v1';
  const gpsEnabled = Boolean(input.gpsEnabled);
  const gpsType = gpsEnabled ? input.gpsType ?? null : null;
  const gpsYear = gpsEnabled ? parseGpsYear(input.gpsYear) : null;
  const valuationPayload = buildValuationPayload(input, result, roundMoney(selectedValueExVat));
  const savedYearModel = input.yearModelUnknown ? null : Math.round(input.year);

  const inserted = await db.query<InsertedValuationRunRow>(
    `
      insert into valuation_runs (
        user_id, model_id, brand_id, sector_id, equipment_family_id, equipment_model_id,
        equipment_type, brand_slug, brand_name, model_name, tractor_type, drive_type, cab_type,
        power_kw, year_model, hours, condition, front_pto, front_loader, gps_enabled, gps_type,
        gps_year, catalog_replacement_price_ex_vat, extras_value_ex_vat, aim4price_value_ex_vat,
        market_low_ex_vat, market_mid_ex_vat, market_high_ex_vat, market_count, market_listing_ids,
        selected_method, selected_value_ex_vat, valuation_version, valuation_payload, created_at, updated_at
      )
      values (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
        $11, $12, $13, $14, $15, $16, $17, $18, $19, $20,
        $21, $22, $23, $24, $25, $26, $27, $28, $29, $30,
        $31, $32, $33, $34::jsonb, now(), now()
      )
      returning id, created_at
    `,
    [
      input.userId ?? null,
      catalogLink.modelId,
      catalogLink.brandId,
      catalogLink.sectorId,
      catalogLink.equipmentFamilyId,
      catalogLink.equipmentModelId,
      'tractor',
      result.model.brandSlug,
      result.model.brandName,
      result.model.modelName,
      result.model.tractorType,
      result.model.drive,
      result.model.cab,
      result.model.powerKw,
      savedYearModel,
      Math.max(0, Number(input.hours) || 0),
      input.condition,
      Boolean(input.frontPto),
      Boolean(input.frontLoader),
      gpsEnabled,
      gpsType,
      gpsYear,
      toNumberOrNull(result.model.aim4priceReplacementExVat),
      roundMoney(result.extrasValueExVat),
      result.aim4priceValueExVat,
      result.marketLow,
      result.marketMid,
      result.marketHigh,
      result.marketCount,
      marketListingIds,
      selectedMethod,
      roundMoney(selectedValueExVat),
      valuationVersion,
      JSON.stringify(valuationPayload),
    ],
  );

  const row = inserted.rows[0];
  if (!row) throw new Error('SAVE_FAILED');

  return {
    runId: Number(row.id),
    createdAtIso: row.created_at,
    selectedValueExVat: roundMoney(selectedValueExVat),
    result,
  };
}

export async function saveValuationRun(input: SaveValuationRunInput): Promise<SaveValuationRunResult> {
  const result = await runServerValuation(input);
  return saveValuationRunFromResult(input, result);
}

export async function deleteValuationRunById(userId: string, runId: number): Promise<void> {
  const db = getDb();
  await db.query(`delete from valuation_runs where id = $1 and user_id = $2`, [runId, userId]);
}

export type SaveGenericValuationRunInput = {
  userId?: string | null;
  result: GenericValuationResult;
  selectedMethod: GenericSelectedMethod;
  selectedValueOverrideExVat?: number | null;
  valuationVersion?: string | null;
};

export type SaveGenericValuationRunResult = {
  runId: number;
  createdAtIso: string;
  selectedValueExVat: number;
  result: GenericValuationResult;
};

function getGenericMarketListingIds(_result: GenericValuationResult): number[] {
  return [];
}

function getGenericUsageMode(result: GenericValuationResult): 'percent' | 'hours' | 'km' {
  if (
    result.depreciationMethodUsed === 'percentage_depreciation' ||
    (result.usageAmount === null && result.lifeWorkedPercent !== null)
  ) {
    return 'percent';
  }

  return result.sector.key === 'motor' || result.family.usageMetricType === 'km' ? 'km' : 'hours';
}

export async function saveGenericValuationRunFromResult(
  input: SaveGenericValuationRunInput,
): Promise<SaveGenericValuationRunResult> {
  const selectedMethod: GenericSelectedMethod = 'aim4price';
  const selectedMethodValueExVat = getGenericSelectedMethodValue(input.result, selectedMethod);
  const selectedValueExVat = roundMoneyOrNull(input.selectedValueOverrideExVat) ?? selectedMethodValueExVat;
  if (selectedValueExVat === null) throw new Error('SELECTED_METHOD_NOT_AVAILABLE');

  const db = getDb();
  const result = input.result;
  const marketListingIds = getGenericMarketListingIds(result);
  const valuationVersion = String(input.valuationVersion ?? 'generic-v1').trim() || 'generic-v1';
  const selectedValue = roundMoney(selectedValueExVat);
  const equipmentModelId = getGenericEquipmentModelId(result);
  const replacementPriceBandId = getPersistableReplacementPriceBandId(result);
  const yearModelUnknown = Boolean(result.yearModelUnknown ?? result.specsJson.year_model_unknown);
  const savedYearModel = yearModelUnknown ? null : result.year;
  const usageMode = getGenericUsageMode(result);

  const valuationPayload = {
    input: {
      sectorKey: result.sector.key,
      familyKey: result.family.key,
      brandSlug: result.brand.slug,
      typedModelName: result.typedModelName,
      normalizedTypedModelName: result.normalizedTypedModelName,
      specsJson: result.specsJson,
      year: result.year,
      yearModel: savedYearModel,
      year_model: savedYearModel,
      displayYearModel: savedYearModel,
      display_year_model: savedYearModel,
      usageMode,
      usage_mode: usageMode,
      usageAmount: result.usageAmount,
      usage_amount: result.usageAmount,
      lifeWorkedPercent: result.lifeWorkedPercent,
      life_worked_percent: result.lifeWorkedPercent,
      yearModelUnknown,
      year_model_unknown: yearModelUnknown,
      condition: result.condition,
      userReplacementPriceExVat: result.userReplacementPriceExVat,
      userReplacementPriceYear: result.userReplacementPriceYear,
      advancedAssumptions: result.advancedAssumptions,
    },
    output: result,
    selectedMethod,
    selectedReplacementPriceBasis: result.replacementPriceBasis,
    selectedDepreciationMethod: result.depreciationMethodUsed,
    selected_depreciation_method: result.depreciationMethodUsed,
    selectedUsageMode: usageMode,
    selected_usage_mode: usageMode,
    selectedLifeWorkedPercent: result.lifeWorkedPercent,
    selected_life_worked_percent: result.lifeWorkedPercent,
    selectedEstimatedHours: result.estimatedHours,
    selectedValueExVat: selectedValue,
  };

  const inserted = await db.query<InsertedValuationRunRow>(
    `
      insert into valuation_runs (
        user_id, model_id, brand_id, sector_id, equipment_family_id, equipment_model_id,
        equipment_type, brand_slug, brand_name, model_name, tractor_type, drive_type, cab_type,
        power_kw, year_model, hours, condition, front_pto, front_loader, gps_enabled, gps_type,
        gps_year, catalog_replacement_price_ex_vat, extras_value_ex_vat, aim4price_value_ex_vat,
        market_low_ex_vat, market_mid_ex_vat, market_high_ex_vat, market_count, market_listing_ids,
        selected_method, selected_value_ex_vat, valuation_version, valuation_payload,
        catalog_mode_used, typed_model_name, normalized_typed_model_name, specs_json,
        replacement_price_band_id, replacement_price_min_ex_vat, replacement_price_max_ex_vat,
        replacement_price_used_ex_vat, user_replacement_price_ex_vat, user_replacement_price_year,
        market_match_strategy, market_average_ex_vat, market_average_count,
        valuation_low_ex_vat, valuation_mid_ex_vat, valuation_high_ex_vat,
        confidence_score, confidence_label, created_at, updated_at
      )
      values (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
        $11, $12, $13, $14, $15, $16, $17, $18, $19, $20,
        $21, $22, $23, $24, $25, $26, $27, $28, $29, $30,
        $31, $32, $33, $34::jsonb, $35, $36, $37, $38::jsonb,
        $39, $40, $41, $42, $43, $44, $45, $46, $47,
        $48, $49, $50, $51, $52, now(), now()
      )
      returning id, created_at
    `,
    [
      input.userId ?? null,
      null,
      result.brand.id,
      result.sector.id,
      result.family.id,
      equipmentModelId,
      result.family.key,
      result.brand.slug,
      result.brand.name,
      result.typedModelName || 'Specs-based valuation',
      null,
      null,
      null,
      null,
      savedYearModel,
      result.usageAmount ?? null,
      result.condition,
      false,
      false,
      false,
      null,
      null,
      result.replacementPriceUsedExVat,
      0,
      result.aim4priceValueExVat,
      null,
      null,
      null,
      0,
      marketListingIds,
      selectedMethod,
      selectedValue,
      valuationVersion,
      JSON.stringify(valuationPayload),
      result.catalogModeUsed,
      result.typedModelName,
      result.normalizedTypedModelName,
      JSON.stringify(result.specsJson),
      replacementPriceBandId,
      result.replacementPriceMinExVat,
      result.replacementPriceMaxExVat,
      result.replacementPriceUsedExVat,
      result.userReplacementPriceExVat,
      result.userReplacementPriceYear,
      'none',
      null,
      0,
      result.valuationLowExVat,
      result.valuationMidExVat,
      result.valuationHighExVat,
      result.confidenceScore,
      result.confidenceLabel,
    ],
  );

  const row = inserted.rows[0];
  if (!row) throw new Error('SAVE_FAILED');

  return {
    runId: Number(row.id),
    createdAtIso: row.created_at,
    selectedValueExVat: selectedValue,
    result,
  };
}
