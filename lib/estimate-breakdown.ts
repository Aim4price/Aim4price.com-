import type { GenericValuationResult } from './generic-valuation';
import type { Result, RunValuationInput } from './tractor-logic';
import { dealerConditionBreakdownNotes } from './valuation/dealer-assessment';
import { calculateEngineHoursValue, tractorLifetimeHours, getValuationConditionFactorOverride } from './valuation/shared';

export type BreakdownRow = { label: string; percent: number | null; change: number; value: number };
export type EstimateBreakdown = { title: string; notes: string[]; rows: BreakdownRow[]; total: number };

function calculationRows(start: number, age: number | null, usage: number | null, depreciation: number,
  condition: number, popularity: number, marketability: number, final: number, salvage: boolean): BreakdownRow[] {
  let value = start;
  const rows: BreakdownRow[] = [{ label: 'Starting replacement price', percent: null, change: 0, value }];
  const apply = (label: string, factor: number) => {
    const before = value;
    value *= factor;
    rows.push({ label, percent: (factor - 1) * 100, change: value - before, value });
  };
  apply(age !== null && usage !== null ? 'Age / usage depreciation (averaged)' : 'Depreciation', 1 - depreciation / 100);
  apply('Condition', condition);
  if (popularity !== 1) apply('Popularity (after limits)', popularity);
  if (marketability !== 1) apply('Older-car marketability', marketability);
  rows.push({ label: salvage ? 'Salvage floor and rounding' : 'Rounding', percent: null, change: final - value, value: final });
  return rows;
}

export function genericEstimateBreakdown(result: GenericValuationResult): EstimateBreakdown | null {
  const c = result.selectedCalculation;
  if (!c || c.replacementPriceExVat == null || c.aim4priceValueExVat == null || c.averageDepPct == null) return null;
  const condition = getValuationConditionFactorOverride(result.condition, result.advancedAssumptions
    ? { ...result.advancedAssumptions, popularityStars: null } : null);
  const combined = getValuationConditionFactorOverride(result.condition, result.advancedAssumptions);
  return {
    title: [result.brand.name, result.typedModelName || result.family.label].join(' '),
    notes: [
      `Age depreciation: ${c.ageDepPct == null ? 'not applied' : `${c.ageDepPct}%`}. Usage depreciation: ${c.usageDepPct == null ? 'not applied' : `${c.usageDepPct}%`}.`,
      c.ageDepPct != null && c.usageDepPct != null
        ? `Applied depreciation: round((${c.ageDepPct}% + ${c.usageDepPct}%) / 2) = ${c.averageDepPct}%.`
        : `Applied depreciation: ${c.averageDepPct}%.`,
      ...(c.maxLifetimeHours ? [`Expected lifetime: ${c.maxLifetimeHours.toLocaleString('en-ZA')}; usage used: ${c.estimatedHours?.toLocaleString('en-ZA') ?? 'percentage basis'}.`] : []),
      ...(result.advancedAssumptions?.dealerAssessment ? dealerConditionBreakdownNotes(result.advancedAssumptions.dealerAssessment) : []),
      ...(c.isSalvageEstimate ? [`Salvage floor: ${c.salvagePercent}% of the starting replacement price.`] : []),
    ],
    rows: calculationRows(c.replacementPriceExVat, c.ageDepPct, c.usageDepPct, c.averageDepPct,
      condition, combined / condition, c.marketabilityFactor, c.aim4priceValueExVat, c.isSalvageEstimate),
    total: c.aim4priceValueExVat,
  };
}

export function tractorEstimateBreakdown(result: Result, input: RunValuationInput): EstimateBreakdown {
  const condition = getValuationConditionFactorOverride(input.condition, result.advancedAssumptions
    ? { ...result.advancedAssumptions, popularityStars: null } : null);
  const combined = getValuationConditionFactorOverride(input.condition, result.advancedAssumptions);
  const start = (result.replacementPriceUsedExVat ?? 0) + (result.otherExtraReplacementPriceExVat ?? 0);
  const c = calculateEngineHoursValue({ replacementPriceExVat: start, yearModel: Math.round(input.year),
    hours: Math.max(0, Number(input.hours) || 0), condition: input.condition,
    maxLifetimeHours: result.maxLifetimeHours ?? tractorLifetimeHours(result.model.tractorType, result.model.powerKw),
    conditionFactorOverride: combined });
  const rows = calculationRows(start, c.ageDepPct, c.usageDepPct, c.averageDepPct, condition, combined / condition, 1, c.finalValueExVat, c.isSalvageEstimate);
  let total = c.finalValueExVat;
  const notes = [
    `Age depreciation: ${c.ageDepPct}%. Usage depreciation: ${c.usageDepPct}%.`,
    `Applied depreciation: round((${c.ageDepPct}% + ${c.usageDepPct}%) / 2) = ${c.averageDepPct}%.`,
    `Expected lifetime: ${result.maxLifetimeHours} hours; usage used: ${c.hoursUsed} hours.`,
  ];
  if (result.advancedAssumptions?.dealerAssessment) notes.push(...dealerConditionBreakdownNotes(result.advancedAssumptions.dealerAssessment));
  if (c.isSalvageEstimate) notes.push(`Salvage floor: ${c.salvagePercent}% of the starting replacement price.`);
  if (result.otherExtraReplacementPriceExVat) notes.push('Starting price includes the named other extra, depreciated with the asset.');
  for (const [label, replacement, current] of [
    ['Front PTO', result.frontPtoReplacementPriceExVat, result.frontPtoValueExVat],
    ['Front loader', result.frontLoaderReplacementPriceExVat, result.frontLoaderValueExVat],
    ['GPS', result.gpsReplacementPriceExVat, result.gpsValueExVat],
  ] as const) {
    if (!replacement) continue;
    total += current;
    rows.push({ label: `${label} added (current value)`, percent: null, change: current, value: total });
    notes.push(`${label}: R ${replacement.toFixed(2)} replacement x ${(current / replacement * 100).toFixed(4)}% retained = R ${current.toFixed(2)}.`);
  }
  if (result.frontPtoReplacementPriceExVat) notes.push('PTO uses the same age, usage and condition rules, with its own salvage floor.');
  if (result.frontLoaderReplacementPriceExVat || result.gpsReplacementPriceExVat) notes.push('Loader / GPS: 10% depreciation per year since installation, then the salvage floor.');
  return { title: `${result.model.brandName} ${result.model.modelName}`, notes, rows, total: result.aim4priceValueExVat ?? total };
}
