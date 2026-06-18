// lib/tractor-data.ts
// Postgres-first shared types and lightweight constants.
//
// Important:
// - This file no longer holds prototype tractor seed data.
// - Live machinery must come from Postgres.
// - We keep the exported types and a few compatibility helpers so the rest of the
//   codebase can be migrated step-by-step without breaking TypeScript imports.

export type TractorType = 'field' | 'orchard';
export type DriveType = '2wd' | '4wd' | 'tracks';
export type CabType = 'cab' | 'open-station';
export type ConditionKey = 'excellent' | 'good' | 'fair' | 'used' | 'serious';

export type BrandRow = {
  name: string;
  slug: string;
};

export type ConditionOption = {
  key: ConditionKey;
  label: string;
  factor: number;
  multiplier: number;
  adjustment: number;
};

export type TractorCatalogRow = {
  id: string;
  title: string;
  name: string;
  brandName: string;
  brandSlug: string;
  modelName: string;
  tractorType: TractorType;
  drive: DriveType;
  cab: CabType;
  powerKw: number;
  powerHp: number;
  horsepowerHp: number;
  yearStart: number;
  yearEnd: number;
  startYear: number;
  endYear: number;
  aim4priceReplacementExVat: number;
  replacementPriceExVat: number;
  imageSrc: string;
};

export type MarketplaceListing = {
  id: string;
  modelId: string;
  title: string;
  brandName: string;
  brandSlug: string;
  modelName: string;
  tractorType: TractorType;
  drive: DriveType;
  cab: CabType;
  powerKw: number;
  powerHp: number;
  horsepowerHp: number;
  yearModel: number;
  year: number;
  hours: number;
  province: string;
  area: string;
  location: string;
  sourceName: string;
  sourceUrl?: string;
  dateAdvertised: string;
  advertisedPriceExVat: number;
  priceExVat: number;
  askingPriceExVat: number;
  price: number;
  imageSrc: string;
};

export type EquipmentTypeOption = {
  key: 'tractor' | 'combine' | 'baler' | 'sprayer';
  label: string;
  imageSrc: string;
  active: boolean;
};

export type CalculatedValuation = {
  selectedModel: TractorCatalogRow;
  selectedCondition: ConditionOption;
  comparableListings: MarketplaceListing[];
  selectedComparable: MarketplaceListing | null;
  aim4priceValueExVat: number;
  marketRangeLowExVat: number;
  marketRangeHighExVat: number;
  marketAverageExVat: number;
  selectedValueExVat: number;
  confidence: 'high' | 'medium' | 'low';
};

const DEFAULT_IMAGE = '/brand/Tractor.png';

export const conditionOptions: ConditionOption[] = [
  { key: 'excellent', label: 'Excellent', factor: 1.08, multiplier: 1.08, adjustment: 1.08 },
  { key: 'good', label: 'Good', factor: 1, multiplier: 1, adjustment: 1 },
  { key: 'fair', label: 'Fair', factor: 0.93, multiplier: 0.93, adjustment: 0.93 },
  { key: 'used', label: 'Used', factor: 0.86, multiplier: 0.86, adjustment: 0.86 },
  { key: 'serious', label: 'Serious Wear', factor: 0.76, multiplier: 0.76, adjustment: 0.76 },
];

export const equipmentTypeOptions: EquipmentTypeOption[] = [
  { key: 'tractor', label: 'Tractor', imageSrc: '/brand/Tractor.png', active: true },
  { key: 'combine', label: 'Combine', imageSrc: '/brand/Valuations.png', active: false },
  { key: 'baler', label: 'Baler', imageSrc: '/brand/Valuations.png', active: false },
  { key: 'sprayer', label: 'Sprayer', imageSrc: '/brand/Valuations.png', active: false },
];

export const brands: BrandRow[] = [];
export const tractors: TractorCatalogRow[] = [];
export const listings: MarketplaceListing[] = [];

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/\./g, '')
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function titleCase(value: string): string {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ');
}

export function getBrandBySlug(slug: string): BrandRow | undefined {
  return brands.find((brand) => brand.slug === slug);
}

export function getModelsByBrand(input: {
  brandSlug: string;
  tractorType?: TractorType;
  drive?: DriveType;
  cab?: CabType;
}): TractorCatalogRow[] {
  return tractors.filter((tractor) => {
    if (tractor.brandSlug !== input.brandSlug) return false;
    if (input.tractorType && tractor.tractorType !== input.tractorType) return false;
    if (input.drive && tractor.drive !== input.drive) return false;
    if (input.cab && tractor.cab !== input.cab) return false;
    return true;
  });
}

export function getModelById(id: string): TractorCatalogRow | undefined {
  return tractors.find((tractor) => tractor.id === id);
}

export function getConditionByKey(key: ConditionKey): ConditionOption {
  return conditionOptions.find((option) => option.key === key) ?? conditionOptions[1] ?? conditionOptions[0];
}

export function getComparableListings(input: {
  modelId: string;
  yearModel: number;
  hours: number;
  yearTolerance?: number;
  hourTolerance?: number;
}): MarketplaceListing[] {
  const yearTolerance = input.yearTolerance ?? 2;
  const hourTolerance = input.hourTolerance ?? 1000;

  const exact = listings.filter(
    (listing) =>
      listing.modelId === input.modelId &&
      Math.abs(listing.yearModel - input.yearModel) <= yearTolerance &&
      Math.abs(listing.hours - input.hours) <= hourTolerance,
  );

  if (exact.length) {
    return [...exact].sort((a, b) => a.askingPriceExVat - b.askingPriceExVat);
  }

  return listings
    .filter((listing) => listing.modelId === input.modelId)
    .sort((a, b) => a.askingPriceExVat - b.askingPriceExVat);
}

export function calculateValuation(input: {
  modelId: string;
  yearModel: number;
  hours: number;
  conditionKey: ConditionKey;
}): CalculatedValuation {
  const selectedModel = getModelById(input.modelId);

  if (!selectedModel) {
    throw new Error(`Model not found: ${input.modelId}`);
  }

  const selectedCondition = getConditionByKey(input.conditionKey);
  const comparableListings: MarketplaceListing[] = [];
  const selectedComparable = null;

  const age = Math.max(0, new Date().getFullYear() - input.yearModel);
  const ageFactor = Math.max(0.5, 1 - age * 0.055);
  const usageAdjustment = Math.max(0.7, 1 - Math.max(0, input.hours - 2500) * 0.000025);

  const aim4priceValueExVat = Math.round(
    selectedModel.replacementPriceExVat * ageFactor * usageAdjustment * selectedCondition.factor,
  );

  const marketRangeLowExVat = aim4priceValueExVat;
  const marketRangeHighExVat = aim4priceValueExVat;
  const marketAverageExVat = aim4priceValueExVat;

  const selectedValueExVat = aim4priceValueExVat;

  const confidence: 'high' | 'medium' | 'low' = aim4priceValueExVat > 0 ? 'medium' : 'low';

  return {
    selectedModel,
    selectedCondition,
    comparableListings,
    selectedComparable,
    aim4priceValueExVat,
    marketRangeLowExVat,
    marketRangeHighExVat,
    marketAverageExVat,
    selectedValueExVat,
    confidence,
  };
}

export function buildCatalogTitle(brandName: string, modelName: string): string {
  return `${brandName} ${modelName}`.trim();
}

export function buildBrandSlug(brandName: string): string {
  return slugify(brandName);
}

export function buildCatalogRow(input: {
  id: string;
  brandName: string;
  modelName: string;
  tractorType: TractorType;
  drive: DriveType;
  cab: CabType;
  powerKw: number;
  yearStart: number;
  yearEnd: number;
  replacementPriceExVat: number;
  imageSrc?: string;
}): TractorCatalogRow {
  const powerHp = Math.round(input.powerKw * 1.341);
  const title = buildCatalogTitle(input.brandName, input.modelName);
  const imageSrc = String(input.imageSrc ?? '').trim() || DEFAULT_IMAGE;

  return {
    id: input.id,
    title,
    name: title,
    brandName: input.brandName,
    brandSlug: buildBrandSlug(input.brandName),
    modelName: input.modelName,
    tractorType: input.tractorType,
    drive: input.drive,
    cab: input.cab,
    powerKw: input.powerKw,
    powerHp,
    horsepowerHp: powerHp,
    yearStart: input.yearStart,
    yearEnd: input.yearEnd,
    startYear: input.yearStart,
    endYear: input.yearEnd,
    aim4priceReplacementExVat: input.replacementPriceExVat,
    replacementPriceExVat: input.replacementPriceExVat,
    imageSrc,
  };
}

export function buildMarketplaceLocation(province: string, area: string): string {
  const cleanProvince = province.trim();
  const cleanArea = area.trim();

  if (cleanArea && cleanProvince) {
    return `${titleCase(cleanArea)}, ${titleCase(cleanProvince)}`;
  }

  return titleCase(cleanArea || cleanProvince);
}
