import { recordAdminUsageEventSafely } from './admin-usage-events';
import type { GenericValuationResult } from './generic-valuation';
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
      modelId: valuation.modelId,
      year: valuation.year,
      usageMode: 'hours',
      hours: valuation.hours,
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
      sectorKey: 'agricultural',
      sectorLabel: 'Agricultural',
      familyKey: 'tractors',
      familyLabel: 'Tractors',
      brandName: result.model.brandName,
      modelName: result.model.modelName,
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
  result: GenericValuationResult;
}): Promise<void> {
  const result = input.result;
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
      sectorKey: result.sector.key,
      familyKey: result.family.key,
      brandSlug: result.brand.slug,
      typedModelName: result.typedModelName,
      specsJson: result.specsJson,
      year: result.year,
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
      sectorKey: result.sector.key,
      sectorLabel: result.sector.label,
      familyKey: result.family.key,
      familyLabel: result.family.label,
      usageMetricType: result.family.usageMetricType,
      brandName: result.brand.name,
      modelName: result.typedModelName,
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
