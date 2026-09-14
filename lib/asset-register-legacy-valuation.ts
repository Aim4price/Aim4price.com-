/** Read compatibility only: never changes the saved value or creates a valuation. */
export function normalizeSavedValuationMethod(value: unknown): 'aim4price' | 'manual' {
  const method = String(value ?? '').trim().toLowerCase();
  // These were the three selectable methods in the original valuation/register flow.
  return ['aim4price', 'market', 'department'].includes(method) ? 'aim4price' : 'manual';
}

function record(value: unknown): Record<string, unknown> {
  if (typeof value === 'string') {
    try { return record(JSON.parse(value)); } catch { return {}; }
  }
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}
function present(value: unknown): boolean {
  return value !== null && value !== undefined && value !== '';
}
function first(...values: unknown[]): unknown { return values.find(present); }

/** Only fill missing fields from the exact, owner-scoped linked valuation. */
export function hydrateLegacyValuationRow<T extends object>(source: T): T {
  const row = source as Record<string, unknown>;
  const run = record(row.legacy_valuation_run);
  if (!run.id || String(run.id) !== String(row.valuation_run_id) || !row.user_id || String(run.user_id) !== String(row.user_id)) return source;
  // Explicit manual values remain manual even if an old estimate is still attached.
  if (String(row.selected_method ?? '').trim().toLowerCase() === 'manual') return source;
  const payload = record(run.valuation_payload ?? run.payload);
  const input = record(payload.input);
  const output = record(payload.output);
  const model = record(output.model);
  const specs = { ...record(input.specsJson), ...record(run.specs_json), ...record(row.specs_json) };
  const advanced = { ...record(output.advancedAssumptions), ...record(input.advancedAssumptions) };
  const result: Record<string, unknown> = { ...row, specs_json: specs };
  const fill = (key: string, ...values: unknown[]) => {
    if (!present(result[key])) {
      const value = first(...values);
      if (present(value)) result[key] = value;
    }
  };
  fill('selected_method', run.selected_method);
  fill('equipment_model_id', run.equipment_model_id);
  fill('sector_id', run.sector_id);
  fill('depreciation_method_used', run.depreciation_method_used, output.depreciationMethodUsed);
  fill('power_kw', specs.powerKw, specs.power_kw, run.power_kw, model.powerKw);
  fill('tractor_type', specs.tractorType, specs.tractor_type, run.tractor_type, model.tractorType);
  fill('drive_type', run.drive_type, model.drive);
  fill('cab_type', run.cab_type, model.cab);
  // An explicitly unknown year must not silently become an old known year.
  if (specs.yearModelUnknown !== true && specs.year_model_unknown !== true && input.yearModelUnknown !== true) {
    fill('year_model', specs.yearModel, specs.year_model, run.year_model, input.year, input.yearModel);
  }
  fill('hours', specs.usageAmount, specs.usage_amount, specs.hours, run.hours, input.usageAmount, input.hours);
  fill('condition', specs.condition, run.condition, input.condition);
  fill('life_worked_percent', specs.lifeWorkedPercent, specs.life_worked_percent, run.life_worked_percent, input.lifeWorkedPercent, output.lifeWorkedPercent);
  fill('max_lifetime_hours', specs.maxLifetimeUsage, specs.max_lifetime_usage, run.max_lifetime_hours, advanced.maxLifetimeUsage, output.maxLifetimeUsage, output.maxLifetimeHours);
  fill('replacement_price_used_ex_vat', row.user_replacement_price_ex_vat, specs.replacementPriceExVat, specs.replacement_price_ex_vat, specs.replacementPriceUsedExVat, specs.replacement_price_used_ex_vat, specs.userReplacementPriceExVat, specs.user_replacement_price_ex_vat,
    run.replacement_price_used_ex_vat, run.user_replacement_price_ex_vat, input.userReplacementPriceExVat,
    output.replacementPriceUsedExVat, output.replacementPriceExVat, run.catalog_replacement_price_ex_vat, model.aim4priceReplacementExVat);
  if (!present(specs.usageMetricType) && !present(specs.usage_metric_type)) {
    specs.usageMetricType = first(input.usageMetric, output.usageMetric, row.family_usage_metric_type);
  }
  return result as T;
}

type RecoveryAsset = {
  selectedMethod: string; valuationRunId: number | null; kind: string;
  brandName: string; modelName: string; yearModel: number | null; hours: number | null;
  condition: string; equipmentModelId?: number | null; equipmentFamilyKey?: string;
  specsJson?: Record<string, unknown>; maxLifetimeHours?: number | null;
  replacementPriceExVat?: number | null; lifeWorkedPercent?: number | null; equipmentFamilyId?: number | null;
};
export function legacyValuationRecoveryReason(asset: RecoveryAsset): string | null {
  if (normalizeSavedValuationMethod(asset.selectedMethod) === 'manual') return 'Save an Aim4price estimate to replace the manual value.';
  if (asset.valuationRunId) return null;
  const specs = asset.specsJson ?? {};
  if (!asset.condition) return 'Add the asset condition to calculate a Basic estimate.';
  if (!(Number(asset.replacementPriceExVat) > 0)) return 'Add a replacement price to calculate a Basic estimate.';
  const percent = specs.basic_usage_basis === 'percent' || (asset.hours == null && asset.lifeWorkedPercent != null);
  if (percent) {
    if (asset.lifeWorkedPercent == null || asset.lifeWorkedPercent < 0 || asset.lifeWorkedPercent > 100) return 'Add the lifetime worked percentage.';
  } else {
    if (asset.hours == null || asset.hours < 0) return 'Add the current usage to calculate a Basic estimate.';
  }
  if (!asset.equipmentFamilyKey && !specs.familyKey && !specs.family_key && asset.kind !== 'tractor') {
    return 'Add the equipment family to calculate a Basic estimate.';
  }
  return null;
}

export function isLegacyHourProjectionAsset(asset: Pick<RecoveryAsset, 'kind' | 'equipmentFamilyKey' | 'specsJson' | 'maxLifetimeHours'>): boolean {
  const specs = asset.specsJson ?? {};
  const metric = String(specs.usageMetricType ?? specs.usage_metric_type ?? specs.usageMetric ?? '').toLowerCase();
  return asset.kind !== 'tractor' && asset.equipmentFamilyKey !== 'tractors' &&
    !specs.basic_catalogue_release && ['hours', 'hour', 'hrs'].includes(metric) &&
    typeof asset.maxLifetimeHours === 'number' && asset.maxLifetimeHours > 0;
}
