/** Keep the entered asset price separate from extras; totals are always ex VAT. */
export function splitReplacementTotal(totalExVat: number, extraExVat: number) {
  if (!Number.isFinite(totalExVat) || !Number.isFinite(extraExVat) || extraExVat < 0 || totalExVat <= extraExVat) {
    throw new Error('The total replacement price must be greater than the selected extras. Update extras in Specs if needed.');
  }
  return {
    basic_asset_replacement_price_ex_vat: totalExVat - extraExVat,
    basic_extra_replacement_price_ex_vat: extraExVat,
    basic_total_replacement_price_ex_vat: totalExVat,
  };
}

/** Preserve cents when converting an entered VAT-inclusive price for calculation/save. */
export function normalizeEstimateReplacementPrice(value: unknown): number | null {
  if (value == null) return null;
  const numeric = Number(String(value).replace(/[^0-9.-]/g, ''));
  if (!Number.isFinite(numeric) || numeric <= 0) return null;
  const rounded = Math.round(numeric * 100) / 100;
  return Number.isFinite(rounded) && rounded > 0 ? rounded : null;
}
