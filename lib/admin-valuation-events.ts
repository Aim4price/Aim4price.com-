import { recordAdminUsageEventSafely } from './admin-usage-events';
import type { GenericValuationInput, GenericValuationResult } from './generic-valuation';
import type { Result, RunValuationInput } from './tractor-logic';

type RecordCompletedValuationInput = {
  userId: string | null;
  eventSource: 'generic-valuations' | 'tractor-valuations';
  valuationMode: 'generic' | 'tractor';
  input: Record<string, unknown>;
  output: Record<string, unknown>;
};

async function recordCompletedValuationSafely(
  event: RecordCompletedValuationInput,
): Promise<void> {
  await recordAdminUsageEventSafely({
    userId: event.userId,
    eventType: 'free_estimate_completed',
    eventSource: event.eventSource,
    metadata: {
      captureVersion: 2,
      captureScope: 'complete-estimate-flow',
      valuationMode: event.valuationMode,
      input: event.input,
      output: event.output,
    },
  });
}

export async function recordTractorValuationForAdminSafely(input: {
  userId: string | null;
  valuationInput: RunValuationInput;
  result: Result;
}): Promise<void> {
  const valuation = input.valuationInput;
  const result = input.result;

  await recordCompletedValuationSafely({
    userId: input.userId,
    eventSource: 'tractor-valuations',
    valuationMode: 'tractor',
    input: {
      ...valuation,
      modelId: valuation.modelId,
      brandName: result.model.brandName,
      modelName: result.model.modelName,
      tractorType: result.model.tractorType,
      driveType: result.model.drive,
      cabType: result.model.cab,
      powerKw: result.model.powerKw,
      year: valuation.year,
      displayYearModel: valuation.yearModelUnknown ? null : valuation.year,
      yearModelUnknown: Boolean(valuation.yearModelUnknown),
      usageMode:
        valuation.usageMode ??
        (valuation.lifeWorkedPercent !== null && typeof valuation.lifeWorkedPercent !== 'undefined'
          ? 'percent'
          : 'hours'),
      hours: valuation.hours,
      lifeWorkedPercent: valuation.lifeWorkedPercent ?? null,
      condition: valuation.condition,
      frontPto: valuation.frontPto,
      frontLoader: valuation.frontLoader,
      frontLoaderYear: valuation.frontLoaderYear ?? null,
      gpsEnabled: valuation.gpsEnabled,
      gpsType: valuation.gpsType ?? null,
      gpsYear: valuation.gpsYear ?? null,
      frontPtoReplacementPriceExVat: valuation.frontPtoReplacementPriceExVat ?? null,
      frontLoaderReplacementPriceExVat: valuation.frontLoaderReplacementPriceExVat ?? null,
      gpsReplacementPriceExVat: valuation.gpsReplacementPriceExVat ?? null,
      otherExtraName: valuation.otherExtraName ?? null,
      otherExtraReplacementPriceExVat:
        valuation.otherExtraReplacementPriceExVat ?? valuation.otherExtraValueExVat ?? null,
      userReplacementPriceExVat: valuation.userReplacementPriceExVat ?? null,
      advancedAssumptions: result.advancedAssumptions,
    },
    output: {
      ...result,
      sectorKey: 'agricultural',
      sectorLabel: 'Agricultural',
      familyKey: 'tractors',
      familyLabel: 'Tractors',
      brandName: result.model.brandName,
      modelName: result.model.modelName,
      selectedMethod: 'aim4price',
      selectedValueExVat: result.aim4priceValueExVat,
      aim4priceValueExVat: result.aim4priceValueExVat,
      valuationLowExVat: result.marketLow,
      valuationMidExVat: result.marketMid ?? result.aim4priceValueExVat,
      valuationHighExVat: result.marketHigh,
      replacementPriceUsedExVat: result.replacementPriceUsedExVat,
      totalReplacementPriceUsedExVat: result.totalReplacementPriceUsedExVat,
      replacementPriceBasis: result.replacementPriceBasis,
      extrasValueExVat: result.extrasValueExVat,
      frontPtoValueExVat: result.frontPtoValueExVat,
      frontLoaderValueExVat: result.frontLoaderValueExVat,
      gpsValueExVat: result.gpsValueExVat,
      otherExtraValueExVat: result.otherExtraValueExVat,
      coverageBand: result.coverageBand,
      maxLifetimeHours: result.maxLifetimeHours,
      salvagePercent: result.salvagePercent,
      salvageValueExVat: result.salvageValueExVat,
      isSalvageEstimate: result.isSalvageEstimate,
    },
  });
}

export async function recordGenericValuationForAdminSafely(input: {
  userId: string | null;
  valuationInput: GenericValuationInput;
  result: GenericValuationResult;
}): Promise<void> {
  const valuation = input.valuationInput;
  const result = input.result;
  const specs = valuation.specsJson ?? result.specsJson;
  const enteredBrandName = String(
    specs.unlisted_brand_name ?? specs.typed_brand_name ?? result.brand.name,
  ).trim() || result.brand.name;
  const usageMode =
    result.depreciationMethodUsed === 'percentage_depreciation' ||
    (result.usageAmount === null && result.lifeWorkedPercent !== null)
      ? 'percent'
      : result.family.usageMetricType === 'km'
        ? 'km'
        : 'hours';

  await recordCompletedValuationSafely({
    userId: input.userId,
    eventSource: 'generic-valuations',
    valuationMode: 'generic',
    input: {
      ...valuation,
      sectorKey: valuation.sectorKey,
      familyKey: valuation.familyKey,
      brandSlug: valuation.brandSlug,
      brandName: enteredBrandName,
      equipmentModelId: valuation.equipmentModelId ?? null,
      typedModelName: valuation.typedModelName ?? null,
      modelName: result.typedModelName,
      catalogModeUsed: result.catalogModeUsed,
      saveModelCandidate: Boolean(valuation.saveModelCandidate),
      specsJson: specs,
      year: valuation.year,
      displayYearModel: valuation.yearModelUnknown ? null : valuation.year,
      yearModelUnknown: Boolean(result.yearModelUnknown),
      usageMode,
      usageAmount: result.usageAmount,
      lifeWorkedPercent: result.lifeWorkedPercent,
      condition: result.condition,
      userReplacementPriceExVat: result.userReplacementPriceExVat,
      userReplacementPriceYear: result.userReplacementPriceYear,
      advancedAssumptions: result.advancedAssumptions,
    },
    output: {
      ...result,
      sectorKey: result.sector.key,
      sectorLabel: result.sector.label,
      familyKey: result.family.key,
      familyLabel: result.family.label,
      usageMetricType: result.family.usageMetricType,
      brandName: enteredBrandName,
      modelName: result.typedModelName,
      selectedMethod: 'aim4price',
      selectedValueExVat: result.aim4priceValueExVat,
      aim4priceValueExVat: result.aim4priceValueExVat,
      genericEstimateExVat: result.genericEstimateExVat,
      valuationLowExVat: result.valuationLowExVat,
      valuationMidExVat: result.valuationMidExVat,
      valuationHighExVat: result.valuationHighExVat,
      replacementPriceMinExVat: result.replacementPriceMinExVat,
      replacementPriceMaxExVat: result.replacementPriceMaxExVat,
      replacementPriceUsedExVat: result.replacementPriceUsedExVat,
      replacementPriceBasis: result.replacementPriceBasis,
      depreciationMethodUsed: result.depreciationMethodUsed,
      lifeWorkedPercent: result.lifeWorkedPercent,
      lifeRemainingPercent: result.lifeRemainingPercent,
      estimatedHours: result.estimatedHours,
      maxLifetimeHours: result.maxLifetimeHours,
      confidenceScore: result.confidenceScore,
      confidenceLabel: result.confidenceLabel,
      notes: result.notes,
    },
  });
}
