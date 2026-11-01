/** Pure policy used only by the read-only Admin annual review. */
export type AnnualReviewAsset = {
  id: string; revision: string; title: string; currentValue: number; replacementPrice: number | null;
  eligible: boolean; reason: string | null; saleability: boolean; extrasNote: string;
};
export type AnnualReviewResult = {
  id: string; currentValue: number; proposedValue: number | null;
  replacementPrice: number | null; error: string | null; warning?: string;
};
export function reviewYear(value: unknown): number {
  const year = Number(value);
  if (!Number.isInteger(year) || year < 2000 || year > 2100) throw new Error('Choose a year from 2000 to 2100.');
  return year;
}
export function priceExVat(value: number, includesVat: boolean): number {
  if (!Number.isFinite(value) || value <= 0 || value > 1e12) throw new Error('Enter a replacement price greater than zero.');
  return Math.round((includesVat ? value / 1.15 : value) * 100) / 100;
}
export function percentagePrice(value: number, percent: number): number {
  if (!Number.isFinite(percent) || percent <= -100 || percent > 1000) throw new Error('Enter a percentage greater than -100 and no more than 1000.');
  return priceExVat(value * (1 + percent / 100), false);
}
export function valuationYear(value: unknown): number | null {
  if (!value) return null;
  const date = new Date(String(value));
  if (!Number.isFinite(date.getTime())) return null;
  return Number(new Intl.DateTimeFormat('en', { year: 'numeric', timeZone: 'Africa/Johannesburg' }).format(date));
}
export function annualExclusion(input: {
  manual: boolean; yearModel: number | null; unknownYear: boolean;
  fixedAge: boolean; lastValuedAt: unknown; year: number;
}): string | null {
  if (input.manual) return 'Manual valuation — kept unchanged.';
  if (!input.yearModel || input.unknownYear) return 'No known year model — age depreciation does not apply.';
  if (input.fixedAge) return 'Fixed age depreciation override — kept unchanged.';
  if (input.yearModel > input.year) return 'Year model is later than the preview year.';
  const lastYear = valuationYear(input.lastValuedAt);
  if (lastYear === null) return 'Valuation date unavailable — review the saved estimate first.';
  if (lastYear >= input.year) return `Already valued for ${lastYear} — no annual update needed.`;
  return null;
}
