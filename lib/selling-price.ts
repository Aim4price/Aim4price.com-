import { saleabilityBasis, type SaleabilityAsset, type SavedSaleability } from './asset-saleability';

/** Dealer offers and auction estimates are not normal advertised-sale benchmarks. */
export function realisticSellingAssessment(asset: SaleabilityAsset, saved: SavedSaleability | null | undefined) {
  if (!saved || !['direct', 'consignment'].includes(saved.answers?.sellingRoute ?? '')
    || !Number.isFinite(saved.priceExVat) || saved.priceExVat <= 0
    || !Number.isFinite(Date.parse(saved.assessedAt))) return null;
  return { priceExVat: saved.priceExVat, assessedAt: saved.assessedAt, needsReview: saved.basis !== saleabilityBasis(asset) };
}

/** Reports retain the saved asset-card value, including older assessments without a selling route. */
export function reportSellingAssessment(asset: SaleabilityAsset, saved: SavedSaleability | null | undefined) {
  if (!saved || !Number.isFinite(saved.priceExVat) || saved.priceExVat <= 0
    || !Number.isFinite(Date.parse(saved.assessedAt))) return null;
  return { priceExVat: saved.priceExVat, assessedAt: saved.assessedAt, needsReview: saved.basis !== saleabilityBasis(asset) };
}

export type SellingBenchmark = { realisticSellingPriceExVat?: number | null; sellingPriceNeedsReview?: boolean; aim4priceValueExVat?: number | null };
export function sellingPriceComparison(input: SellingBenchmark & { askingPriceExVat: number }) {
  if (input.sellingPriceNeedsReview) return null;
  const realistic = Number(input.realisticSellingPriceExVat);
  const ideal = Number(input.aim4priceValueExVat);
  const basis = realistic > 0 && Number.isFinite(realistic) ? 'realistic' : 'ideal';
  const value = basis === 'realistic' ? realistic : ideal;
  if (!Number.isFinite(value) || value <= 0 || !Number.isFinite(input.askingPriceExVat) || input.askingPriceExVat <= 0) return null;
  const percent = Math.round(((input.askingPriceExVat - value) / value) * 100_000_000) / 1_000_000;
  const rounded = Math.round(Math.abs(percent));
  const difference = rounded === 0 ? `At ${basis} selling price` : `${rounded}% ${percent < 0 ? 'below' : 'above'} ${basis} selling price`;
  return { basis, percent, difference, label: basis === 'ideal' ? 'Ideal price comparison' : percent < -5 ? 'Good value' : percent <= 5 ? 'Fair value' : 'Above estimate' };
}
