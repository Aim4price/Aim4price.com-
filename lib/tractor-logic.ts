import type { ConditionKey, MarketplaceListing, TractorCatalogRow } from './tractor-data';
import type { AdvancedAssumptionsInput, NormalizedAdvancedAssumptions } from './valuation/shared';

export type GpsType = 'full-autosteer' | 'guidance-only';

export type RunValuationInput = {
  modelId: string;
  year: number;
  hours: number;
  condition: ConditionKey;
  frontPto?: boolean;
  frontLoader?: boolean;
  gpsEnabled?: boolean;
  gpsType?: GpsType | null;
  gpsYear?: number | string | null;
  userReplacementPriceExVat?: number | null;
  advancedAssumptions?: AdvancedAssumptionsInput | null;
};

export type Result = {
  model: TractorCatalogRow;
  aim4priceValueExVat: number | null;
  marketLow: number | null;
  marketHigh: number | null;
  marketMid: number | null;
  marketCount: number;
  marketSources: MarketplaceListing[];
  coverageBand: 'green' | 'amber' | 'red';
  previewValueExVat: number | null;
  previewLabel: 'Aim4price Value';
  baseAim4priceValueExVat: number | null;
  baseMarketLow: number | null;
  baseMarketHigh: number | null;
  baseMarketMid: number | null;
  extrasValueExVat: number;
  frontPtoValueExVat: number;
  frontLoaderValueExVat: number;
  gpsValueExVat: number;
  replacementPriceBasis: 'aim4price' | 'user';
  replacementPriceUsedExVat: number | null;
  userReplacementPriceExVat: number | null;
  maxLifetimeHours: number | null;
  advancedAssumptions: NormalizedAdvancedAssumptions | null;
  salvagePercent: number;
  salvageValueExVat: number;
  isSalvageEstimate: boolean;
};

export const conditionLabel = (key: ConditionKey): string =>
  ({
    excellent: 'Excellent',
    good: 'Good',
    fair: 'Fair',
    used: 'Used',
    serious: 'Requires Attention',
  })[key];

export function money(value: number | null): string {
  if (value === null || !Number.isFinite(value)) {
    return 'N/A';
  }

  return new Intl.NumberFormat('en-ZA', {
    style: 'currency',
    currency: 'ZAR',
    maximumFractionDigits: 0,
  }).format(value);
}

export function range(low: number | null, high: number | null): string {
  if (low === null || high === null) {
    return 'N/A';
  }

  return `${money(low)} - ${money(high)}`;
}
