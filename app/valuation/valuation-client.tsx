'use client';

import { useEffect, useMemo, useRef, useState, type ChangeEvent, type CSSProperties, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import AppHeader from '../../components/AppHeader';
import styles from './page.module.css';
import {
  conditionOptions,
  type BrandRow,
  type CabType,
  type ConditionKey,
  type DriveType,
  type TractorCatalogRow,
  type TractorType,
} from '../../lib/tractor-data';
import {
  SECTOR_LABELS,
  getUsageDisplayUnit,
  getUsageFieldLabel,
  getUsageSentenceLabel,
  getUsageShortUnit,
  getUnknownUsageButtonLabel,
  getKnownUsageButtonLabel,
  type CatalogMode,
  type SectorKey,
  type UsageMetricType,
} from '../../lib/equipment-types';
import { conditionLabel, money, type Result } from '../../lib/tractor-logic';
import {
  getGuestValuationCount,
  incrementGuestValuationCount,
} from '../../lib/guest-valuation-limit';

type Step = 1 | 2 | 3 | 4 | 5;
type MethodKey = 'aim4price';
type FlowMode = 'exact_model' | 'generic_specs' | '';
type FinalSaveIntent = 'asset-register' | 'marketplace';
type GpsType = 'full-autosteer' | 'guidance-only';
type ReplacementPriceBasis = 'aim4price' | 'user';
type DepreciationMethodUsed = 'full_depreciation' | 'semi_depreciation' | 'percentage_depreciation';
type DetailsModal = 'year' | 'usage' | null;
type UsageModalMode = 'hours' | 'percent';

type EquipmentFamilyRecord = {
  id: number;
  sectorId: number;
  sectorKey: SectorKey;
  sectorLabel: string;
  familyKey: string;
  familyLabel: string;
  isPropelled: boolean;
  usageMetricType: UsageMetricType;
  valuationMode: string;
  catalogMode: CatalogMode;
  sortOrder: number;
  isActive: boolean;
};

type SpecOption = {
  id: number;
  specQuestionId: number;
  optionValue: string;
  optionLabel: string;
  sortOrder: number;
};

type SpecQuestion = {
  id: number;
  sectorId: number;
  sectorKey: SectorKey;
  familyId: number;
  familyKey: string;
  specKey: string;
  label: string;
  inputType: 'number' | 'select' | 'boolean' | 'text' | 'money';
  unit: string | null;
  isRequired: boolean;
  affectsValue: boolean;
  useForMarketMatching: boolean;
  sortOrder: number;
  helpText: string | null;
  options: SpecOption[];
};

type GenericCatalogModel = {
  id: number;
  sectorId: number;
  sectorKey: SectorKey;
  familyId: number;
  familyKey: string;
  familyLabel: string;
  usageMetricType: UsageMetricType;
  valuationMode: string;
  catalogMode: CatalogMode;
  isPropelled: boolean;
  brandId: number | null;
  brandSlug: string;
  brandName: string;
  legacyTractorCatalogId: number | null;
  modelName: string;
  variantName: string | null;
  normalizedModelName: string;
  displayName: string;
  yearStart: number | null;
  yearEnd: number | null;
  powerKw: number | null;
  tractorType: string | null;
  driveType: string | null;
  cabType: string | null;
  workingWidthM: number | null;
  rowsCount: number | null;
  tankCapacityL: number | null;
  aim4priceReplacementPriceExVat: number | null;
  replacementPriceYear: number | null;
  isGenericFallback: boolean;
  specsJson: Record<string, unknown>;
  isActive: boolean;
};

type GenericModelSelectionMode = 'catalog' | 'manual' | '';

type GenericValuationCalculation = {
  replacementPriceBasis: ReplacementPriceBasis;
  replacementPriceExVat: number | null;
  depreciationMethodUsed: DepreciationMethodUsed;
  depreciationBaseValueExVat: number | null;
  aim4priceValueExVat: number | null;
  valuationLowExVat: number | null;
  valuationMidExVat: number | null;
  valuationHighExVat: number | null;
  marketWeight: number;
  lifeWorkedPercent: number | null;
  lifeRemainingPercent: number | null;
  estimatedHours: number | null;
  maxLifetimeHours: number | null;
  ageDepPct: number | null;
  usageDepPct: number | null;
  averageDepPct: number | null;
};

type MarketMatch = {
  id: number;
  title: string;
  brandName: string;
  modelName: string;
  advertisedPriceExVat: number;
  yearModel: number | null;
  usageAmount: number | null;
  condition: string | null;
  sourceName: string;
  sourceUrl: string;
  dateAdvertised: string | null;
  matchReason: string;
};

type GenericValuationResult = {
  catalogModeUsed: CatalogMode;
  sector: { id: number; key: SectorKey; label: string };
  family: {
    id: number;
    key: string;
    label: string;
    usageMetricType: UsageMetricType;
    valuationMode: string;
    isPropelled: boolean;
    catalogMode: CatalogMode;
  };
  brand: { id: number; slug: string; name: string };
  typedModelName: string | null;
  normalizedTypedModelName: string | null;
  specsJson: Record<string, unknown>;
  year: number;
  usageAmount: number | null;
  condition: ConditionKey;
  replacementPriceBand: { id: number; bandLabel: string } | null;
  replacementPriceMinExVat: number | null;
  replacementPriceMaxExVat: number | null;
  replacementPriceUsedExVat: number | null;
  userReplacementPriceExVat: number | null;
  userReplacementPriceYear: number | null;
  replacementPriceBasis: ReplacementPriceBasis;
  depreciationMethodUsed: DepreciationMethodUsed;
  lifeWorkedPercent: number | null;
  lifeRemainingPercent: number | null;
  estimatedHours: number | null;
  maxLifetimeHours: number | null;
  aim4priceReplacementCalculation: GenericValuationCalculation | null;
  userReplacementCalculation: GenericValuationCalculation | null;
  selectedCalculation: GenericValuationCalculation | null;
  genericEstimateExVat: number | null;
  aim4priceValueExVat: number | null;
  marketAverageExVat: number | null;
  marketAverageCount: number;
  marketMatchStrategy: 'exact_model' | 'typed_model' | 'brand_specs' | 'family_specs' | 'none';
  marketSources: MarketMatch[];
  valuationLowExVat: number | null;
  valuationMidExVat: number | null;
  valuationHighExVat: number | null;
  confidenceScore: number;
  confidenceLabel: 'High' | 'Medium' | 'Low';
  notes: string[];
};

type ValuationResultState =
  | { kind: 'tractor'; result: Result }
  | { kind: 'generic'; result: GenericValuationResult };

type FamiliesApiResponse = {
  ok: boolean;
  families?: EquipmentFamilyRecord[];
  error?: string;
};

type BrandsApiResponse = {
  ok: boolean;
  brands?: BrandRow[];
  error?: string;
};

type SpecQuestionsApiResponse = {
  ok: boolean;
  questions?: SpecQuestion[];
  error?: string;
};

type TractorModelsApiResponse = {
  ok: boolean;
  models?: TractorCatalogRow[];
  error?: string;
};

type EquipmentModelsApiResponse = {
  ok: boolean;
  count?: number;
  models?: GenericCatalogModel[];
  error?: string;
};

type TractorValuationApiResponse = {
  ok: boolean;
  result?: Result;
  error?: string;
};

type GenericValuationApiResponse = {
  ok: boolean;
  result?: GenericValuationResult;
  error?: string;
};

type SaveValuationRunApiResponse = {
  ok: boolean;
  runId?: number;
  assetId?: string;
  selectedValueExVat?: number;
  error?: string;
};

type AccountProfile = Partial<{
  userId: string;
  name: string;
  displayName: string;
  email: string;
  businessName: string;
  phone: string;
  accountType: string;
  province: string;
  townCity: string;
  marketplaceSellerName: string;
  marketplacePhone: string;
  marketplaceEmail: string;
  marketplaceLocation: string;
}>;

type AccountProfileApiResponse = {
  ok: boolean;
  profile?: AccountProfile;
  error?: string;
};

type MarketplacePendingPhoto = {
  id: string;
  file: File;
  previewUrl: string;
};

type MarketplacePublishDraft = {
  askingPriceExVat: string;
  marketplaceNotes: string;
  sellerName: string;
  sellerCompany: string;
  sellerPhone: string;
  sellerEmail: string;
  province: string;
  area: string;
};

type MarketplaceUploadApiResponse = {
  ok: boolean;
  uploads?: Array<{ url?: string; href?: string; path?: string }>;
  error?: string;
};

type MarketplaceApiResponse = {
  ok: boolean;
  assetId?: string;
  marketplaceStatus?: string;
  listing?: {
    id?: string | number | null;
    sourceAssetId?: string | number | null;
  } | null;
  error?: string;
};

type ValuationPdfKeyValue = {
  label: string;
  value: string;
};

type ValuationPdfPayload = {
  generatedAt: string;
  machineTitle: string;
  sectorLabel: string;
  familyLabel: string;
  brandName: string;
  valuationPath: string;
  selectedMethodLabel: string;
  selectedValueExVat: number | null;
  aim4priceValueExVat: number | null;
  confidenceText: string;
  confidenceNote: string;
  yearSummary: string;
  usageSummary: string;
  conditionSummary: string;
  replacementPriceExVat: number | null;
  replacementBasisText: string;
  notes: string[];
  assetDetailRows: ValuationPdfKeyValue[];
  clientRows: ValuationPdfKeyValue[];
  recordRows: ValuationPdfKeyValue[];
};

const CURRENT_YEAR = new Date().getFullYear();
const MAX_MARKETPLACE_PHOTOS = 12;
const MARKETPLACE_INTRO_DISMISSED_KEY = 'aim4price-marketplace-intro-dismissed';

const WIZARD_STEPS: Array<{ step: Step; label: string }> = [
  { step: 1, label: 'Equipment' },
  { step: 2, label: 'Brand' },
  { step: 3, label: 'Path' },
  { step: 4, label: 'Specs' },
  { step: 5, label: 'Value' },
];

const SECTOR_OPTIONS: Array<{ key: SectorKey; label: string; available: boolean; videoSrc: string }> = [
  { key: 'agricultural', label: SECTOR_LABELS.agricultural, available: true, videoSrc: '/brand/valuation/Agriculture.mp4' },
  { key: 'construction', label: SECTOR_LABELS.construction, available: true, videoSrc: '/brand/valuation/Construction.mp4' },
  { key: 'industrial', label: SECTOR_LABELS.industrial, available: true, videoSrc: '/brand/valuation/Industrial.mp4' },
  { key: 'motor', label: SECTOR_LABELS.motor, available: true, videoSrc: '/brand/valuation/Motor.mp4' },
];

const TRACTOR_TYPE_OPTIONS: Array<{ value: TractorType; label: string }> = [
  { value: 'field', label: 'Field' },
  { value: 'orchard', label: 'Orchard' },
];

const DRIVE_OPTIONS: Array<{ value: DriveType; label: string }> = [
  { value: '2wd', label: '2WD' },
  { value: '4wd', label: '4WD' },
  { value: 'tracks', label: 'Tracks' },
];

const CAB_OPTIONS: Array<{ value: CabType; label: string }> = [
  { value: 'cab', label: 'Cab' },
  { value: 'open-station', label: 'Open station' },
];

const GPS_TYPE_OPTIONS: Array<{ value: GpsType; label: string }> = [
  { value: 'guidance-only', label: 'Guidance only' },
  { value: 'full-autosteer', label: 'Full autosteer' },
];

type DropdownOption = { value: string; label: string };

function sentenceCase(value: string): string {
  return value ? value.charAt(0).toUpperCase() + value.slice(1) : value;
}

function getAssetTypeLabel(sectorKey?: SectorKey | null): string {
  return sectorKey === 'motor' ? 'vehicle type' : 'equipment type';
}

function getAssetItemLabel(sectorKey?: SectorKey | null): string {
  return sectorKey === 'motor' ? 'vehicle' : 'equipment';
}

function getAssetNounLabel(sectorKey?: SectorKey | null): string {
  return sectorKey === 'motor' ? 'vehicle' : 'equipment';
}

function getAssetNounTitle(sectorKey?: SectorKey | null): string {
  return sentenceCase(getAssetNounLabel(sectorKey));
}

function getSpecsLabel(sectorKey?: SectorKey | null): string {
  return sectorKey === 'motor' ? 'vehicle specs' : 'equipment specs';
}

function getSpecsTitle(sectorKey?: SectorKey | null): string {
  return sentenceCase(getSpecsLabel(sectorKey));
}

function getGenericEstimatePathCopy(sectorKey?: SectorKey | null): string {
  return `Aim4price uses the brand, catalogue model, condition, usage and ${getSpecsLabel(sectorKey)} for this estimate path.`;
}

function getGpsTypeLabel(value: GpsType): string {
  return GPS_TYPE_OPTIONS.find((option) => option.value === value)?.label ?? 'Guidance only';
}

function playSectorPreview(card: HTMLButtonElement) {
  const video = card.querySelector('video');
  if (!video) return;
  video.currentTime = 0;
  void video.play().catch(() => undefined);
}

function resetSectorPreview(card: HTMLButtonElement) {
  const video = card.querySelector('video');
  if (!video) return;
  video.pause();
  video.currentTime = 0;
}

function nextStep(step: Step): Step {
  return step === 1 ? 2 : step === 2 ? 3 : step === 3 ? 4 : 5;
}

function previousStep(step: Step): Step {
  return step === 5 ? 4 : step === 4 ? 3 : step === 3 ? 2 : 1;
}

function normalizeText(value: unknown): string {
  return String(value ?? '').trim();
}

function parseFlexibleNumber(value: unknown): number | null {
  const text = normalizeText(value).replace(/\s/g, '').replace(',', '.');
  if (!text) return null;
  const numeric = Number(text);
  return Number.isFinite(numeric) ? numeric : null;
}

function parseMoneyInput(value: unknown): number | null {
  const numeric = Number(String(value ?? '').replace(/[^0-9.-]/g, ''));
  return Number.isFinite(numeric) && numeric > 0 ? numeric : null;
}

function formatMoneyInput(value: unknown): string {
  const numeric = parseMoneyInput(value);
  return numeric === null ? '' : Math.round(numeric).toLocaleString('en-ZA');
}

function normalizeAccountType(value: unknown): string {
  return String(value ?? '').trim().toLowerCase() || 'public';
}

function createMarketplacePhotoId(): string {
  return `marketplace-photo-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function pdfFileSlug(value: string): string {
  const parts = String(value ?? '').match(/[A-Za-z0-9]+/g) ?? [];
  return parts.join('-') || 'Estimate';
}

function toNumberOrNull(value: unknown): number | null {
  const numeric = parseFlexibleNumber(value);
  return numeric !== null && numeric > 0 ? numeric : null;
}

function toPercentOrNull(value: unknown): number | null {
  const numeric = parseFlexibleNumber(value);
  if (numeric === null) return null;
  return Math.max(0, Math.min(100, Math.round(numeric)));
}

function searchIncludes(value: string, query: string): boolean {
  const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (!terms.length) return true;
  const haystack = value.toLowerCase();
  return terms.every((term) => haystack.includes(term));
}

function formatCatalogModeLabel(mode: CatalogMode): string {
  if (mode === 'hybrid') return 'Exact model + specs';
  if (mode === 'exact_model') return 'Exact model data';
  return 'Specs pathway';
}

function formatUsageMetricLabel(metric: UsageMetricType, sectorKey?: SectorKey | null): string {
  const unit = getUsageDisplayUnit(sectorKey, metric);
  if (unit === 'km') return 'Kilometres';
  if (unit === 'percent') return 'Worked percentage';
  return 'Hours';
}

function formatPercent(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return 'N/A';
  return `${Math.round(value)}%`;
}

function formatWholeNumber(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return 'N/A';
  return Math.round(value).toLocaleString('en-ZA');
}

function formatListingYear(value: number | null | undefined): string | null {
  if (value === null || value === undefined || !Number.isFinite(value) || value < 1950) return null;
  return String(Math.round(value));
}

function formatListingUsageAmount(
  value: number | null | undefined,
  sectorKey?: SectorKey | string | null,
  usageMetricType?: UsageMetricType | string | null,
): string | null {
  if (value === null || value === undefined || !Number.isFinite(value) || value <= 0) return null;
  return `${formatWholeNumber(value)} ${getUsageShortUnit(sectorKey, usageMetricType)}`;
}

function formatListingHours(value: number | null | undefined): string | null {
  return formatListingUsageAmount(value, 'agricultural', 'hours');
}

function tractorLifetimeHoursFromModel(model: TractorCatalogRow | null): number {
  if (!model) return 12_000;
  if (model.tractorType === 'orchard') return 10_000;
  if (model.powerKw <= 25) return 8_000;
  if (model.powerKw <= 75) return 12_000;
  return 14_000;
}

function estimateHoursFromWorkedPercent(model: TractorCatalogRow | null, workedPercent: number | null): number | null {
  if (workedPercent === null) return null;
  return Math.round(tractorLifetimeHoursFromModel(model) * (workedPercent / 100));
}

function depreciationMethodLabel(method: DepreciationMethodUsed | null | undefined): string {
  if (method === 'full_depreciation') return 'Full depreciation';
  if (method === 'semi_depreciation') return 'Semi depreciation';
  if (method === 'percentage_depreciation') return 'Percentage depreciation';
  return 'Depreciation';
}

function displayMarketStrategy(_strategy: GenericValuationResult['marketMatchStrategy']): string {
  return 'Aim4price inputs';
}

function getTractorTypeLabel(value: TractorType | ''): string {
  return TRACTOR_TYPE_OPTIONS.find((option) => option.value === value)?.label ?? 'Choose type';
}

function getDriveLabel(value: DriveType | ''): string {
  return DRIVE_OPTIONS.find((option) => option.value === value)?.label ?? 'Choose drive';
}

function getCabLabel(value: CabType | ''): string {
  return CAB_OPTIONS.find((option) => option.value === value)?.label ?? 'Choose cab';
}

function formatTractorModelLabel(model: TractorCatalogRow | null): string {
  if (!model) return 'Select model...';
  return `${model.brandName} ${model.modelName}`;
}

function formatTractorModelDetail(model: TractorCatalogRow): string {
  return `${model.powerKw} kW • ${model.yearStart}-${model.yearEnd}`;
}

function normalizeGenericSpecsRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function formatGenericModelLabel(model: GenericCatalogModel | null): string {
  if (!model) return 'Select model...';

  const brandName = normalizeText(model.brandName);
  const displayName = normalizeText(model.displayName);
  const modelName = normalizeText(model.modelName);
  const baseName = displayName || modelName;

  if (!baseName) return brandName || 'Unnamed model';
  if (!brandName) return baseName;
  if (baseName.toLowerCase().includes(brandName.toLowerCase())) return baseName;
  return `${brandName} ${baseName}`.trim();
}

function getGenericModelSubmitName(model: GenericCatalogModel | null): string {
  if (!model) return '';
  return normalizeText(model.modelName) || normalizeText(model.displayName);
}

function formatModelYearRange(start: number | null, end: number | null): string | null {
  if (start && end) return start === end ? String(start) : `${start}-${end}`;
  if (start) return `${start}+`;
  if (end) return `up to ${end}`;
  return null;
}

function firstSpecText(specsJson: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const value = specsJson[key];
    const text = normalizeText(value);
    if (text) return text;
  }

  return null;
}

function formatGenericModelDetail(model: GenericCatalogModel): string {
  const specsJson = normalizeGenericSpecsRecord(model.specsJson);
  const parts = [
    normalizeText(model.variantName) || null,
    formatModelYearRange(model.yearStart, model.yearEnd),
    model.powerKw && model.powerKw > 0 ? `${model.powerKw} kW` : null,
    firstSpecText(specsJson, ['body_type', 'vehicle_type', 'type', 'transmission', 'fuel_type', 'drivetrain', 'drive_type']),
  ].filter((part): part is string => Boolean(part));

  const uniqueParts = parts.filter((part, index) => parts.findIndex((candidate) => candidate.toLowerCase() === part.toLowerCase()) === index);
  return uniqueParts.length ? uniqueParts.join(' • ') : `${model.familyLabel || 'Catalogue'} model`;
}

function getModelSpecAnswerValue(question: SpecQuestion, rawValue: unknown): string {
  if (rawValue === null || typeof rawValue === 'undefined') return '';

  if (question.inputType === 'boolean') {
    if (typeof rawValue === 'boolean') return rawValue ? 'true' : 'false';
    const normalized = normalizeText(rawValue).toLowerCase();
    if (['true', '1', 'yes', 'y'].includes(normalized)) return 'true';
    if (['false', '0', 'no', 'n'].includes(normalized)) return 'false';
    return '';
  }

  if (question.inputType === 'number' || question.inputType === 'money') {
    const numberValue = parseFlexibleNumber(rawValue);
    return numberValue === null ? '' : String(numberValue);
  }

  const textValue = normalizeText(rawValue);
  if (!textValue) return '';

  if (question.inputType === 'select' && question.options.length) {
    const normalizedText = textValue.toLowerCase();
    const matchingOption = question.options.find(
      (option) => option.optionValue.toLowerCase() === normalizedText || option.optionLabel.toLowerCase() === normalizedText,
    );
    return matchingOption?.optionValue ?? '';
  }

  return textValue;
}

function getTractorValue(result: Result, _method: MethodKey): number | null {
  return result.aim4priceValueExVat;
}

function getGenericCalculation(result: GenericValuationResult, basis: ReplacementPriceBasis): GenericValuationCalculation | null {
  if (basis === 'user') return result.userReplacementCalculation ?? result.selectedCalculation ?? result.aim4priceReplacementCalculation;
  return result.aim4priceReplacementCalculation ?? result.selectedCalculation;
}

function getGenericValue(result: GenericValuationResult, _method: MethodKey, basis: ReplacementPriceBasis): number | null {
  const calculation = getGenericCalculation(result, basis);
  return calculation?.valuationMidExVat ?? result.valuationMidExVat ?? result.aim4priceValueExVat;
}

function getHeadlineValue(state: ValuationResultState | null, selectedMethod: MethodKey, replacementBasis: ReplacementPriceBasis): number | null {
  if (!state) return null;
  return state.kind === 'tractor' ? getTractorValue(state.result, selectedMethod) : getGenericValue(state.result, selectedMethod, replacementBasis);
}

function getResultValueSizeClass(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return '';

  const digitCount = String(Math.abs(Math.round(value))).length;
  if (digitCount >= 8) return styles.resultValueLineTight;
  if (digitCount >= 7) return styles.resultValueLineCompact;
  return '';
}

type ConfidenceContext = {
  selectedMethod: MethodKey;
  yearKnown: boolean;
  hoursKnown: boolean;
  workedPercentKnown: boolean;
  usageSentenceLabel: string;
  marketUsageToleranceLabel: string;
};

function confidenceFromCoverageBand(band: Result['coverageBand']): 'High' | 'Medium' | 'Low' {
  if (band === 'green') return 'High';
  if (band === 'amber') return 'Medium';
  return 'Low';
}

function getConfidenceLabel(state: ValuationResultState | null, context: ConfidenceContext): string {
  if (!state) return 'Confidence: Low';

  if (state.kind === 'generic') {
    return `Confidence: ${state.result.confidenceLabel}`;
  }


  const hasReplacementPrice = Number.isFinite(state.result.model.aim4priceReplacementExVat) && state.result.model.aim4priceReplacementExVat > 0;

  if (hasReplacementPrice && context.yearKnown && context.hoursKnown) {
    return 'Confidence: High';
  }

  if (hasReplacementPrice && context.yearKnown && context.workedPercentKnown) {
    return 'Confidence: Medium';
  }

  if (hasReplacementPrice) {
    return 'Confidence: Medium';
  }

  return 'Confidence: Low';
}

function getConfidenceClass(state: ValuationResultState | null, context: ConfidenceContext): string {
  if (!state) return styles.confidenceLow;
  const label = getConfidenceLabel(state, context).toLowerCase();
  if (label.includes('high')) return styles.confidenceHigh;
  if (label.includes('medium')) return styles.confidenceMedium;
  return styles.confidenceLow;
}

function getConfidenceNote(state: ValuationResultState | null, context: ConfidenceContext): string {
  if (!state) return 'Run an estimate to calculate confidence.';

  if (state.kind === 'generic') {
    return 'Aim4price confidence uses the replacement-price band, captured specs, age, usage and condition.';
  }


  if (context.hoursKnown) {
    return `Exact model, manufacturing year, ${context.usageSentenceLabel} and condition were captured.`;
  }

  if (context.workedPercentKnown) {
    return 'Exact model was captured, but usage was estimated from worked percentage.';
  }

  return `Exact model was captured, but confidence improves when real ${context.usageSentenceLabel} are supplied.`;
}

function buildSpecPayload(specQuestions: SpecQuestion[], specAnswers: Record<string, string>): Record<string, unknown> {
  const output: Record<string, unknown> = {};

  for (const question of specQuestions) {
    const raw = specAnswers[question.specKey];
    if (raw === undefined || raw === '') continue;

    if (question.inputType === 'number' || question.inputType === 'money') {
      const numberValue = parseFlexibleNumber(raw);
      if (numberValue !== null) output[question.specKey] = numberValue;
      continue;
    }

    if (question.inputType === 'boolean') {
      output[question.specKey] = raw === 'true';
      continue;
    }

    output[question.specKey] = raw;
  }

  return output;
}

function isSpecQuestionAnswered(question: SpecQuestion, value: string | undefined): boolean {
  const cleaned = normalizeText(value);
  if (!cleaned) return false;
  if (question.inputType === 'number' || question.inputType === 'money') return parseFlexibleNumber(cleaned) !== null;
  return true;
}

function getSpecQuestionAnswerLabel(question: SpecQuestion, value: string | undefined): string {
  const cleaned = normalizeText(value);
  if (!cleaned) return 'Not answered';

  if (question.inputType === 'select') {
    return question.options.find((option) => option.optionValue === cleaned)?.optionLabel ?? cleaned;
  }

  if (question.inputType === 'boolean') {
    return cleaned === 'true' ? 'Yes' : cleaned === 'false' ? 'No' : cleaned;
  }

  if ((question.inputType === 'number' || question.inputType === 'money') && question.unit) {
    return cleaned + ' ' + question.unit;
  }

  return cleaned;
}

function formatPdfReportDate(value: Date): string {
  return value.toLocaleDateString('en-ZA', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
  });
}

function normalizePdfValue(value: unknown): string {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function isPresentPdfValue(value: unknown): boolean {
  const cleaned = normalizePdfValue(value);
  return Boolean(cleaned) && !/^(-|n\/a|null|undefined)$/i.test(cleaned);
}

function compactPdfRows(rows: Array<{ label: string; value: unknown }>): ValuationPdfKeyValue[] {
  return rows
    .map((row) => ({ label: normalizePdfValue(row.label), value: normalizePdfValue(row.value) }))
    .filter((row) => row.label && isPresentPdfValue(row.value));
}

function moneyExVat(value: number | null): string {
  return value === null ? '' : `${money(value)} excl. VAT`;
}

function selectedValueTypeLabel(_method: MethodKey): string {
  return 'Aim4price Value';
}

function normalizeReportEmail(value: unknown): string {
  const cleaned = normalizePdfValue(value);
  return cleaned && cleaned.includes('@') ? cleaned : '';
}

export default function ValuationClient() {
  const router = useRouter();
  const [step, setStep] = useState<Step>(1);
  const [selectedSector, setSelectedSector] = useState<SectorKey | null>(null);
  const [families, setFamilies] = useState<EquipmentFamilyRecord[]>([]);
  const [familiesLoading, setFamiliesLoading] = useState(false);
  const [familySearch, setFamilySearch] = useState('');
  const [equipmentDropdownOpen, setEquipmentDropdownOpen] = useState(false);
  const [familyKey, setFamilyKey] = useState('');
  const [brands, setBrands] = useState<BrandRow[]>([]);
  const [brandsLoading, setBrandsLoading] = useState(false);
  const [brandSearch, setBrandSearch] = useState('');
  const [brandDropdownOpen, setBrandDropdownOpen] = useState(false);
  const [brandSlug, setBrandSlug] = useState('');
  const [flowMode, setFlowMode] = useState<FlowMode>('');
  const [tractorType, setTractorType] = useState<TractorType | ''>('');
  const [drive, setDrive] = useState<DriveType | ''>('');
  const [cab, setCab] = useState<CabType | ''>('');
  const [tractorModels, setTractorModels] = useState<TractorCatalogRow[]>([]);
  const [modelsLoading, setModelsLoading] = useState(false);
  const [modelQuery, setModelQuery] = useState('');
  const [modelDropdownOpen, setModelDropdownOpen] = useState(false);
  const [modelId, setModelId] = useState('');
  const [genericCatalogModels, setGenericCatalogModels] = useState<GenericCatalogModel[]>([]);
  const [genericModelsLoading, setGenericModelsLoading] = useState(false);
  const [genericModelQuery, setGenericModelQuery] = useState('');
  const [genericModelDropdownOpen, setGenericModelDropdownOpen] = useState(false);
  const [genericModelId, setGenericModelId] = useState('');
  const [genericModelMode, setGenericModelMode] = useState<GenericModelSelectionMode>('');
  const [specQuestions, setSpecQuestions] = useState<SpecQuestion[]>([]);
  const [specAnswers, setSpecAnswers] = useState<Record<string, string>>({});
  const [openSpecDropdownKey, setOpenSpecDropdownKey] = useState<string | null>(null);
  const [typedModelName, setTypedModelName] = useState('');
  const [year, setYear] = useState(String(CURRENT_YEAR));
  const [usageAmount, setUsageAmount] = useState('');
  const [condition, setCondition] = useState<ConditionKey>('good');
  const [frontPto, setFrontPto] = useState(false);
  const [frontLoader, setFrontLoader] = useState(false);
  const [gpsEnabled, setGpsEnabled] = useState(false);
  const [gpsType, setGpsType] = useState<GpsType>('guidance-only');
  const [gpsTypeDropdownOpen, setGpsTypeDropdownOpen] = useState(false);
  const [gpsYear, setGpsYear] = useState('');
  const [userReplacementPrice, setUserReplacementPrice] = useState('');
  const [replacementPriceBasis, setReplacementPriceBasis] = useState<ReplacementPriceBasis>('aim4price');
  const [yearModelUnknown, setYearModelUnknown] = useState(false);
  const [lifeWorkedPercent, setLifeWorkedPercent] = useState('');
  const [yearStepComplete, setYearStepComplete] = useState(false);
  const [usageStepComplete, setUsageStepComplete] = useState(false);
  const [conditionStepComplete, setConditionStepComplete] = useState(false);
  const [activeDetailsModal, setActiveDetailsModal] = useState<DetailsModal>(null);
  const [usageModalMode, setUsageModalMode] = useState<UsageModalMode>('hours');
  const [resultState, setResultState] = useState<ValuationResultState | null>(null);
  const [selectedMethod, setSelectedMethod] = useState<MethodKey>('aim4price');
  const [message, setMessage] = useState('');
  const [valuationLoading, setValuationLoading] = useState(false);
  const [replacementRecalculateLoading, setReplacementRecalculateLoading] = useState(false);
  const [saveLoading, setSaveLoading] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfError, setPdfError] = useState('');
  const [finalSaveIntent, setFinalSaveIntent] = useState<FinalSaveIntent | null>(null);
  const [finalSaveError, setFinalSaveError] = useState('');
  const [savedMarketplaceAssetId, setSavedMarketplaceAssetId] = useState<string | null>(null);
  const [isSignedIn, setIsSignedIn] = useState(false);
  const [guestValuationCount, setGuestValuationCount] = useState(0);
  const [marketplaceMode, setMarketplaceMode] = useState(false);
  const [accountType, setAccountType] = useState('public');
  const [accountProfile, setAccountProfile] = useState<AccountProfile | null>(null);
  const [marketplaceDraft, setMarketplaceDraft] = useState<MarketplacePublishDraft | null>(null);
  const [marketplaceIntroOpen, setMarketplaceIntroOpen] = useState(false);
  const [marketplacePhotoFiles, setMarketplacePhotoFiles] = useState<MarketplacePendingPhoto[]>([]);
  const [marketplacePublishError, setMarketplacePublishError] = useState('');
  const [isPublishingMarketplace, setIsPublishingMarketplace] = useState(false);
  const [replacementPanelOpen, setReplacementPanelOpen] = useState(false);
  const marketplacePhotoInputRef = useRef<HTMLInputElement | null>(null);
  const genericModelPrefilledSpecKeysRef = useRef<Set<string>>(new Set());
  const [shouldAutoPlaySectorVideos, setShouldAutoPlaySectorVideos] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return undefined;

    const mediaQuery = window.matchMedia('(hover: none), (pointer: coarse), (max-width: 720px)');
    const updateAutoPlayState = () => setShouldAutoPlaySectorVideos(mediaQuery.matches);

    updateAutoPlayState();

    if (typeof mediaQuery.addEventListener === 'function') {
      mediaQuery.addEventListener('change', updateAutoPlayState);
      return () => mediaQuery.removeEventListener('change', updateAutoPlayState);
    }

    mediaQuery.addListener(updateAutoPlayState);
    return () => mediaQuery.removeListener(updateAutoPlayState);
  }, []);

  const selectedFamily = useMemo(
    () => families.find((family) => family.familyKey === familyKey) ?? null,
    [families, familyKey],
  );
  const selectedBrand = useMemo(() => brands.find((brand) => brand.slug === brandSlug) ?? null, [brands, brandSlug]);
  const selectedModel = useMemo(
    () => tractorModels.find((model) => model.id === modelId) ?? null,
    [tractorModels, modelId],
  );
  const selectedGenericModel = useMemo(
    () => genericCatalogModels.find((model) => String(model.id) === genericModelId) ?? null,
    [genericCatalogModels, genericModelId],
  );
  const genericModelRequired = selectedSector === 'motor' && flowMode === 'generic_specs';
  const submittedGenericModelName = genericModelMode === 'catalog'
    ? getGenericModelSubmitName(selectedGenericModel)
    : normalizeText(typedModelName);
  const shouldSaveGenericModelCandidate = genericModelMode === 'manual' && Boolean(normalizeText(typedModelName));
  const selectedUsageDisplayUnit = getUsageDisplayUnit(selectedSector, selectedFamily?.usageMetricType);
  const selectedUsageFieldLabel = getUsageFieldLabel(selectedSector, selectedFamily?.usageMetricType);
  const selectedUsageSentenceLabel = getUsageSentenceLabel(selectedSector, selectedFamily?.usageMetricType);
  const selectedUsageShortUnit = getUsageShortUnit(selectedSector, selectedFamily?.usageMetricType);
  const selectedMarketUsageToleranceLabel = selectedUsageDisplayUnit === 'km' ? '50,000 km' : '1,000 hours';
  const filteredFamilies = useMemo(() => {
    const query = familySearch.trim().toLowerCase();
    const matches = families.filter((family) =>
      searchIncludes(`${family.familyLabel} ${family.familyKey} ${family.sectorLabel}`, familySearch),
    );

    if (!query) return matches;

    function scoreFamily(family: EquipmentFamilyRecord): number {
      const label = family.familyLabel.toLowerCase();
      const key = family.familyKey.replace(/_/g, ' ').toLowerCase();

      if (label === query || key === query) return 0;
      if (label.startsWith(query)) return 1;
      if (key.startsWith(query)) return 2;
      if (label.includes(query)) return 3;
      if (key.includes(query)) return 4;
      return 5;
    }

    return [...matches].sort((a, b) => scoreFamily(a) - scoreFamily(b) || a.sortOrder - b.sortOrder || a.familyLabel.localeCompare(b.familyLabel));
  }, [families, familySearch]);
  const filteredBrands = useMemo(() => {
    const query = brandSearch.trim().toLowerCase();
    const matches = brands.filter((brand) => searchIncludes(`${brand.name} ${brand.slug}`, brandSearch));

    if (!query) return matches;

    function scoreBrand(brand: BrandRow): number {
      const name = brand.name.toLowerCase();
      const slug = brand.slug.replace(/-/g, ' ').toLowerCase();

      if (name === query || slug === query) return 0;
      if (name.startsWith(query)) return 1;
      if (slug.startsWith(query)) return 2;
      if (name.includes(query)) return 3;
      if (slug.includes(query)) return 4;
      return 5;
    }

    return [...matches].sort((a, b) => scoreBrand(a) - scoreBrand(b) || a.name.localeCompare(b.name));
  }, [brands, brandSearch]);

  const exactTractorAvailable = selectedFamily?.familyKey === 'tractors' && selectedFamily.catalogMode === 'hybrid';
  const tractorSetupComplete = Boolean(tractorType && drive && cab);
  const filteredModels = useMemo(() => {
    const query = modelQuery.trim().toLowerCase();
    const matches = tractorModels.filter((model) =>
      searchIncludes(`${model.brandName} ${model.modelName} ${model.powerKw} ${model.yearStart} ${model.yearEnd}`, modelQuery),
    );

    if (!query) return matches;

    function scoreModel(model: TractorCatalogRow): number {
      const modelName = model.modelName.toLowerCase();
      const fullName = `${model.brandName} ${model.modelName}`.toLowerCase();

      if (modelName === query || fullName === query) return 0;
      if (modelName.startsWith(query)) return 1;
      if (fullName.startsWith(query)) return 2;
      if (modelName.includes(query)) return 3;
      if (fullName.includes(query)) return 4;
      return 5;
    }

    return [...matches].sort((a, b) => scoreModel(a) - scoreModel(b) || a.modelName.localeCompare(b.modelName));
  }, [modelQuery, tractorModels]);
  const filteredGenericModels = useMemo(() => {
    const query = genericModelQuery.trim().toLowerCase();
    const matches = genericCatalogModels.filter((model) => {
      const specsJson = normalizeGenericSpecsRecord(model.specsJson);
      const searchableSpecs = Object.values(specsJson)
        .map((value) => normalizeText(value))
        .filter(Boolean)
        .join(' ');

      return searchIncludes(
        `${formatGenericModelLabel(model)} ${model.brandName} ${model.displayName} ${model.modelName} ${model.variantName ?? ''} ${searchableSpecs}`,
        genericModelQuery,
      );
    });

    if (!query) return matches;

    function scoreGenericModel(model: GenericCatalogModel): number {
      const label = formatGenericModelLabel(model).toLowerCase();
      const modelName = model.modelName.toLowerCase();
      const displayName = model.displayName.toLowerCase();

      if (modelName === query || displayName === query || label === query) return 0;
      if (modelName.startsWith(query)) return 1;
      if (displayName.startsWith(query)) return 2;
      if (label.startsWith(query)) return 3;
      if (modelName.includes(query)) return 4;
      if (displayName.includes(query) || label.includes(query)) return 5;
      return 6;
    }

    return [...matches].sort((a, b) => scoreGenericModel(a) - scoreGenericModel(b) || formatGenericModelLabel(a).localeCompare(formatGenericModelLabel(b)));
  }, [genericCatalogModels, genericModelQuery]);

  const yearNumber = Number(year);
  const usageNumber = toNumberOrNull(usageAmount);
  const lifeWorkedPercentNumber = toPercentOrNull(lifeWorkedPercent);
  const specsJson = useMemo(() => buildSpecPayload(specQuestions, specAnswers), [specQuestions, specAnswers]);
  const enrichedSpecsJson = useMemo(
    () => ({
      ...(flowMode === 'generic_specs' && selectedGenericModel ? normalizeGenericSpecsRecord(selectedGenericModel.specsJson) : {}),
      ...specsJson,
      ...(lifeWorkedPercentNumber !== null ? { life_worked_percent: lifeWorkedPercentNumber } : {}),
      ...(yearModelUnknown ? { year_model_unknown: true } : {}),
    }),
    [flowMode, selectedGenericModel, specsJson, lifeWorkedPercentNumber, yearModelUnknown],
  );
  const headlineValue = getHeadlineValue(resultState, selectedMethod, replacementPriceBasis);
  const normalizedSignedInAccountType = normalizeAccountType(accountType);
  const isDealerAccount = normalizedSignedInAccountType === 'dealer';
  const canUseMarketplacePublishFlow = isSignedIn && (normalizedSignedInAccountType === 'owner' || normalizedSignedInAccountType === 'dealer');
  const canSaveToAssetRegister = isSignedIn && normalizedSignedInAccountType === 'owner';
  useEffect(() => {
    const target = document.getElementById('valuation-wizard-card');
    target?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [step]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const searchParams = new URLSearchParams(window.location.search);
    const nextMarketplaceMode = searchParams.get('marketplace') === '1' || searchParams.get('marketplaceListing') === '1';
    setMarketplaceMode(nextMarketplaceMode);

    if (!nextMarketplaceMode) {
      setMarketplaceIntroOpen(false);
      return;
    }

    try {
      setMarketplaceIntroOpen(window.localStorage.getItem(MARKETPLACE_INTRO_DISMISSED_KEY) !== '1');
    } catch {
      setMarketplaceIntroOpen(true);
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    async function loadAccessState() {
      try {
        const response = await fetch('/api/me', { credentials: 'include', cache: 'no-store' });
        const data = (await response.json()) as {
          ok: boolean;
          signedIn: boolean;
          user?: { accountType?: string | null } | null;
        };
        if (!mounted) return;

        const signedIn = Boolean(data?.signedIn);
        setIsSignedIn(signedIn);
        setAccountType(signedIn ? normalizeAccountType(data.user?.accountType ?? 'owner') : 'public');

        if (signedIn) {
          try {
            const profileResponse = await fetch('/api/account-profile', { credentials: 'include', cache: 'no-store' });
            const profileData = (await profileResponse.json()) as AccountProfileApiResponse;
            if (mounted && profileResponse.ok && profileData.ok) {
              setAccountProfile(profileData.profile ?? null);
              setAccountType(normalizeAccountType(profileData.profile?.accountType ?? data.user?.accountType ?? 'owner'));
            }
          } catch {
            if (mounted) setAccountProfile(null);
          }
        } else {
          setAccountProfile(null);
        }
      } catch {
        if (!mounted) return;
        setIsSignedIn(false);
        setAccountType('public');
        setAccountProfile(null);
      } finally {
        if (mounted) {
          setGuestValuationCount(getGuestValuationCount());
        }
      }
    }

    void loadAccessState();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    let ignore = false;

    setFamilies([]);
    setFamilyKey('');
    setFamilySearch('');
    setEquipmentDropdownOpen(false);
    setBrandSearch('');
    setBrandDropdownOpen(false);
    setBrands([]);
    setBrandSlug('');
    setTypedModelName('');
    setModelQuery('');
    setModelDropdownOpen(false);
    setModelId('');
    setTractorType('');
    setDrive('');
    setCab('');
    setTractorModels([]);
    setGenericCatalogModels([]);
    setGenericModelsLoading(false);
    clearGenericModelSelection({ clearManual: true, clearPrefilledSpecs: true });
    setSpecQuestions([]);
    setSpecAnswers({});
    setOpenSpecDropdownKey(null);
    setGpsTypeDropdownOpen(false);
    genericModelPrefilledSpecKeysRef.current = new Set();
    setYear(String(CURRENT_YEAR));
    setYearModelUnknown(false);
    setUsageAmount('');
    setLifeWorkedPercent('');
    setUserReplacementPrice('');
    setCondition('good');
    setYearStepComplete(false);
    setUsageStepComplete(false);
    setConditionStepComplete(false);
    setActiveDetailsModal(null);
    setUsageModalMode('hours');
    setResultState(null);
    setSelectedMethod('aim4price');
    setReplacementPriceBasis('aim4price');
    setFinalSaveIntent(null);
    setFinalSaveError('');
    setSavedMarketplaceAssetId(null);

    if (!selectedSector) {
      setFamiliesLoading(false);
      return () => {
        ignore = true;
      };
    }

    const sectorForRequest = selectedSector;
    setFamiliesLoading(true);

    async function loadFamilies() {
      try {
        const params = new URLSearchParams({ sectorKey: sectorForRequest, includeInactive: 'true' });
        const response = await fetch(`/api/equipment-families?${params.toString()}`, { cache: 'no-store' });
        const data = (await response.json()) as FamiliesApiResponse;
        if (!response.ok || !data.ok || !Array.isArray(data.families)) throw new Error(data.error ?? 'Failed to load families.');
        if (ignore) return;
        setFamilies(data.families);
      } catch (error) {
        console.error(error);
        if (!ignore) setMessage(error instanceof Error ? error.message : 'Failed to load families.');
      } finally {
        if (!ignore) setFamiliesLoading(false);
      }
    }

    void loadFamilies();
    return () => {
      ignore = true;
    };
  }, [selectedSector]);

  useEffect(() => {
    if (!selectedFamily || !selectedSector) return;

    const sectorForRequest = selectedSector;
    const familyForRequest = selectedFamily;
    const familyKeyForRequest = familyForRequest.familyKey;
    const nextFlowMode: FlowMode = familyKeyForRequest === 'tractors' && familyForRequest.catalogMode === 'hybrid' ? '' : 'generic_specs';

    setResultState(null);
    setSelectedMethod('aim4price');
    setReplacementPriceBasis('aim4price');
    setFinalSaveIntent(null);
    setFinalSaveError('');
    setSavedMarketplaceAssetId(null);
    setBrandSearch('');
    setBrandDropdownOpen(false);
    setBrandSlug('');
    setBrands([]);
    setModelQuery('');
    setModelDropdownOpen(false);
    setModelId('');
    setTractorType('');
    setDrive('');
    setCab('');
    setTractorModels([]);
    setGenericCatalogModels([]);
    setGenericModelsLoading(false);
    clearGenericModelSelection({ clearManual: true, clearPrefilledSpecs: true });
    setTypedModelName('');
    setYear(String(CURRENT_YEAR));
    setUsageAmount('');
    setLifeWorkedPercent('');
    setUserReplacementPrice('');
    setYearModelUnknown(false);
    setYearStepComplete(false);
    setUsageStepComplete(false);
    setConditionStepComplete(false);
    setCondition('good');
    setActiveDetailsModal(null);
    setUsageModalMode('hours');
    setFlowMode(nextFlowMode);

    let ignore = false;
    setBrandsLoading(true);

    async function loadBrands() {
      try {
        const params = new URLSearchParams({
          sectorKey: sectorForRequest,
          familyKey: familyKeyForRequest,
          includeInactive: 'true',
        });
        const response = await fetch(`/api/brands?${params.toString()}`, { cache: 'no-store' });
        const data = (await response.json()) as BrandsApiResponse;
        if (!response.ok || !data.ok || !Array.isArray(data.brands)) throw new Error(data.error ?? 'Failed to load brands.');
        if (ignore) return;
        setBrands(data.brands);
      } catch (error) {
        console.error(error);
        if (!ignore) setMessage(error instanceof Error ? error.message : 'Failed to load brands.');
      } finally {
        if (!ignore) setBrandsLoading(false);
      }
    }

    void loadBrands();
    return () => {
      ignore = true;
    };
  }, [selectedFamily, selectedSector]);

  useEffect(() => {
    let ignore = false;

    setSpecQuestions([]);
    setSpecAnswers({});

    if (!selectedFamily || !selectedSector || flowMode !== 'generic_specs') {
      return () => {
        ignore = true;
      };
    }

    const sectorForRequest = selectedSector;
    const familyKeyForRequest = selectedFamily.familyKey;

    async function loadSpecQuestions() {
      try {
        const params = new URLSearchParams({
          sectorKey: sectorForRequest,
          familyKey: familyKeyForRequest,
          includeInactive: 'true',
        });
        const response = await fetch(`/api/equipment-family-spec-questions?${params.toString()}`, { cache: 'no-store' });
        const data = (await response.json()) as SpecQuestionsApiResponse;
        if (!response.ok || !data.ok || !Array.isArray(data.questions)) throw new Error(data.error ?? 'Failed to load questions.');
        if (!ignore) setSpecQuestions(data.questions);
      } catch (error) {
        console.error(error);
        if (!ignore) setSpecQuestions([]);
      }
    }

    void loadSpecQuestions();
    return () => {
      ignore = true;
    };
  }, [selectedFamily, selectedSector, flowMode]);

  useEffect(() => {
    if (!brandSlug || flowMode !== 'exact_model' || !tractorType || !drive || !cab) {
      setTractorModels([]);
      setModelId('');
      setModelDropdownOpen(false);
      setModelsLoading(false);
      return;
    }

    const tractorTypeForRequest = tractorType;
    const driveForRequest = drive;
    const cabForRequest = cab;

    let ignore = false;
    setModelsLoading(true);
    setTractorModels([]);
    setModelId('');
    setModelDropdownOpen(false);

    async function loadModels() {
      try {
        const params = new URLSearchParams({
          brandSlug,
          tractorType: tractorTypeForRequest,
          drive: driveForRequest,
          cab: cabForRequest,
        });
        const response = await fetch(`/api/tractor-models?${params.toString()}`, { cache: 'no-store' });
        const data = (await response.json()) as TractorModelsApiResponse;
        if (!response.ok || !data.ok || !Array.isArray(data.models)) throw new Error(data.error ?? 'Failed to load models.');
        if (ignore) return;
        setTractorModels(data.models);
      } catch (error) {
        console.error(error);
        if (!ignore) setTractorModels([]);
      } finally {
        if (!ignore) setModelsLoading(false);
      }
    }

    void loadModels();
    return () => {
      ignore = true;
    };
  }, [brandSlug, flowMode, tractorType, drive, cab]);

  useEffect(() => {
    if (!selectedSector || !selectedFamily || !brandSlug || flowMode !== 'generic_specs') {
      setGenericCatalogModels([]);
      setGenericModelsLoading(false);
      clearGenericModelSelection({ clearManual: true, clearPrefilledSpecs: true });
      return;
    }

    const sectorForRequest = selectedSector;
    const familyKeyForRequest = selectedFamily.familyKey;
    const brandSlugForRequest = brandSlug;

    let ignore = false;
    setGenericModelsLoading(true);
    setGenericCatalogModels([]);
    clearGenericModelSelection({ clearManual: true, clearPrefilledSpecs: true });

    async function loadGenericCatalogModels() {
      try {
        const params = new URLSearchParams({
          sectorKey: sectorForRequest,
          familyKey: familyKeyForRequest,
          brandSlug: brandSlugForRequest,
          limit: '500',
        });
        const response = await fetch(`/api/equipment-models?${params.toString()}`, { cache: 'no-store' });
        const data = (await response.json()) as EquipmentModelsApiResponse;
        if (!response.ok || !data.ok || !Array.isArray(data.models)) throw new Error(data.error ?? 'Failed to load catalogue models.');
        if (!ignore) setGenericCatalogModels(data.models);
      } catch (error) {
        console.error(error);
        if (!ignore) setGenericCatalogModels([]);
      } finally {
        if (!ignore) setGenericModelsLoading(false);
      }
    }

    void loadGenericCatalogModels();
    return () => {
      ignore = true;
    };
  }, [selectedSector, selectedFamily, brandSlug, flowMode]);

  useEffect(() => {
    if (flowMode !== 'generic_specs' || genericModelMode !== 'catalog' || !selectedGenericModel) return;
    applyGenericModelSpecDefaults(selectedGenericModel);
  }, [flowMode, genericModelMode, selectedGenericModel, specQuestions]);

  function resetResult() {
    setResultState(null);
    setSelectedMethod('aim4price');
    setReplacementPriceBasis('aim4price');
    setReplacementPanelOpen(false);
    setFinalSaveIntent(null);
    setFinalSaveError('');
    setPdfError('');
    setSavedMarketplaceAssetId(null);
  }

  function removeGenericModelPrefilledAnswers() {
    const prefilledKeys = genericModelPrefilledSpecKeysRef.current;
    if (!prefilledKeys.size) return;

    setSpecAnswers((current) => {
      let changed = false;
      const next = { ...current };

      for (const key of prefilledKeys) {
        if (Object.prototype.hasOwnProperty.call(next, key)) {
          delete next[key];
          changed = true;
        }
      }

      return changed ? next : current;
    });
    genericModelPrefilledSpecKeysRef.current = new Set();
  }

  function clearGenericModelSelection(options: { clearManual?: boolean; clearPrefilledSpecs?: boolean } = {}) {
    setGenericModelId('');
    setGenericModelQuery('');
    setGenericModelDropdownOpen(false);
    setGenericModelMode('');
    if (options.clearManual) setTypedModelName('');
    if (options.clearPrefilledSpecs) removeGenericModelPrefilledAnswers();
  }

  function applyGenericModelSpecDefaults(model: GenericCatalogModel) {
    const modelSpecs = normalizeGenericSpecsRecord(model.specsJson);

    setSpecAnswers((current) => {
      const next = { ...current };
      let changed = false;

      for (const key of genericModelPrefilledSpecKeysRef.current) {
        if (Object.prototype.hasOwnProperty.call(next, key)) {
          delete next[key];
          changed = true;
        }
      }

      const nextPrefilledKeys = new Set<string>();

      if (!Object.keys(modelSpecs).length || !specQuestions.length) {
        genericModelPrefilledSpecKeysRef.current = nextPrefilledKeys;
        return changed ? next : current;
      }

      for (const question of specQuestions) {
        if (normalizeText(next[question.specKey])) continue;
        const answerValue = getModelSpecAnswerValue(question, modelSpecs[question.specKey]);
        if (!answerValue) continue;

        next[question.specKey] = answerValue;
        nextPrefilledKeys.add(question.specKey);
        changed = true;
      }

      genericModelPrefilledSpecKeysRef.current = nextPrefilledKeys;
      return changed ? next : current;
    });
  }

  function validateGenericModelSelection(): string | null {
    if (flowMode !== 'generic_specs') return null;

    const manualModelName = normalizeText(typedModelName);

    if (genericModelRequired && !selectedGenericModel && !manualModelName) {
      return 'Choose a model or select Model not listed and enter the model name.';
    }

    if (genericModelMode === 'manual' && !manualModelName) return 'Enter the model name.';

    return null;
  }

  function resetDetailsFlow() {
    setYear(String(CURRENT_YEAR));
    setYearModelUnknown(false);
    setUsageAmount('');
    setLifeWorkedPercent('');
    setUserReplacementPrice('');
    setCondition('good');
    setSpecAnswers({});
    setOpenSpecDropdownKey(null);
    setGpsTypeDropdownOpen(false);
    genericModelPrefilledSpecKeysRef.current = new Set();
    clearGenericModelSelection({ clearManual: true });
    setYearStepComplete(false);
    setUsageStepComplete(false);
    setConditionStepComplete(false);
    setActiveDetailsModal(null);
    setUsageModalMode('hours');
    resetResult();
  }

  function setSpecAnswer(key: string, value: string) {
    genericModelPrefilledSpecKeysRef.current.delete(key);
    setSpecAnswers((current) => ({ ...current, [key]: value }));
    resetResult();
  }

  function validateDetails(): string | null {
    if (!selectedFamily) return `Choose an ${getAssetTypeLabel(selectedSector)} first.`;
    if (!selectedBrand) return 'Choose a brand first.';

    const genericPath = flowMode === 'generic_specs';
    const selfPropelled = selectedFamily?.isPropelled || selectedFamily?.usageMetricType === 'hours' || selectedFamily?.usageMetricType === 'km';
    const showHoursInput = !genericPath || selfPropelled;

    if (!yearStepComplete) return `Choose the ${getAssetNounLabel(selectedSector)} manufacturing year or mark it as unknown.`;

    if (!yearModelUnknown) {
      if (!Number.isInteger(yearNumber) || yearNumber < 1950 || yearNumber > CURRENT_YEAR) {
        return `Enter a valid ${getAssetNounLabel(selectedSector)} manufacturing year or mark the year as unknown.`;
      }
    }

    if (!usageStepComplete) {
      return showHoursInput ? `Enter the ${selectedUsageFieldLabel.toLowerCase()} or estimate how much it has worked.` : `Estimate how much the ${getAssetNounLabel(selectedSector)} has worked.`;
    }

    if (showHoursInput && !usageNumber && lifeWorkedPercentNumber === null) {
      return `Enter ${selectedUsageFieldLabel.toLowerCase()} or estimate how much the ${getAssetNounLabel(selectedSector)} has worked.`;
    }

    if (!showHoursInput && lifeWorkedPercentNumber === null) {
      return `Estimate how much the ${getAssetNounLabel(selectedSector)} has worked as a percentage.`;
    }

    if (!conditionStepComplete || !condition) return 'Choose the condition.';
    if (flowMode === 'exact_model' && !tractorSetupComplete) return 'Complete the type, drive and cab setup first.';
    if (flowMode === 'exact_model' && !selectedModel) return `Choose the exact model or use ${getSpecsLabel(selectedSector)}.`;

    if (flowMode === 'generic_specs') {
      const genericModelMessage = validateGenericModelSelection();
      if (genericModelMessage) return genericModelMessage;

      for (const question of specQuestions) {
        if (question.isRequired && !isSpecQuestionAnswered(question, specAnswers[question.specKey])) {
          return `Answer: ${question.label}.`;
        }
      }
    }

    return null;
  }


  async function calculateGenericWithReplacementPrice(priceExVat: number, setError: (message: string) => void = setMessage) {
    if (!selectedSector || !selectedFamily || !selectedBrand) {
      setError('Choose a sector, family and brand first.');
      return;
    }

    const validationMessage = validateDetails();
    if (validationMessage) {
      setError(validationMessage);
      return;
    }

    setReplacementRecalculateLoading(true);
    setMessage('');
    setError('');

    try {
      const response = await fetch('/api/generic-valuations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sectorKey: selectedSector,
          familyKey: selectedFamily.familyKey,
          brandSlug: selectedBrand.slug,
          typedModelName: submittedGenericModelName,
          saveModelCandidate: shouldSaveGenericModelCandidate,
          specsJson: enrichedSpecsJson,
          year: yearModelUnknown ? CURRENT_YEAR : yearNumber,
          yearModelUnknown,
          usageAmount: usageNumber,
          lifeWorkedPercent: lifeWorkedPercentNumber,
          condition,
          userReplacementPriceExVat: priceExVat,
          userReplacementPriceYear: CURRENT_YEAR,
        }),
      });
      const data = (await response.json()) as GenericValuationApiResponse;
      if (!response.ok || !data.ok || !data.result) throw new Error(data.error ?? 'Failed to recalculate with user replacement price.');
      setResultState({ kind: 'generic', result: data.result });
      setReplacementPriceBasis('user');
      setSelectedMethod('aim4price');
      setSavedMarketplaceAssetId(null);
      setReplacementPanelOpen(!finalSaveIntent);
    } catch (error) {
      console.error(error);
      setError(error instanceof Error ? error.message : 'Failed to recalculate with user replacement price.');
    } finally {
      setReplacementRecalculateLoading(false);
    }
  }

  async function calculateTractorWithReplacementPrice(priceExVat: number | null, setError: (message: string) => void = setMessage) {
    if (!selectedModel) {
      setError('Choose an exact tractor model first.');
      return;
    }

    const validationMessage = validateDetails();
    if (validationMessage) {
      setError(validationMessage);
      return;
    }

    setReplacementRecalculateLoading(true);
    setMessage('');
    setError('');

    try {
      const response = await fetch('/api/tractor-valuations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          modelId: selectedModel.id,
          year: yearModelUnknown ? CURRENT_YEAR : yearNumber,
          hours: usageNumber ?? estimateHoursFromWorkedPercent(selectedModel, lifeWorkedPercentNumber) ?? 0,
          condition,
          frontPto,
          frontLoader,
          gpsEnabled,
          gpsType,
          gpsYear,
          userReplacementPriceExVat: priceExVat,
        }),
      });
      const data = (await response.json()) as TractorValuationApiResponse;
      if (!response.ok || !data.ok || !data.result) throw new Error(data.error ?? 'Failed to recalculate tractor estimate.');
      setResultState({ kind: 'tractor', result: data.result });
      setReplacementPriceBasis(priceExVat ? 'user' : 'aim4price');
      setSelectedMethod('aim4price');
      setSavedMarketplaceAssetId(null);
      setReplacementPanelOpen(!finalSaveIntent);
    } catch (error) {
      console.error(error);
      setError(error instanceof Error ? error.message : 'Failed to recalculate tractor estimate.');
    } finally {
      setReplacementRecalculateLoading(false);
    }
  }

  async function calculateValuation() {
    if (!selectedSector) {
      setMessage('Choose a sector first.');
      return;
    }

    const validationMessage = validateDetails();
    if (validationMessage) {
      setMessage(validationMessage);
      return;
    }

    if (!isSignedIn && guestValuationCount >= 3) {
      setMessage('You have used your 3 free estimates. Please create an account or log in to continue.');
      router.push('/auth#signup');
      return;
    }

    setMessage('');
    setValuationLoading(true);
    setFinalSaveIntent(null);
    setFinalSaveError('');
    setSavedMarketplaceAssetId(null);

    try {
      if (flowMode === 'exact_model' && selectedModel) {
        const response = await fetch('/api/tractor-valuations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            modelId: selectedModel.id,
            year: yearModelUnknown ? CURRENT_YEAR : yearNumber,
            hours: usageNumber ?? estimateHoursFromWorkedPercent(selectedModel, lifeWorkedPercentNumber) ?? 0,
            condition,
            frontPto,
            frontLoader,
            gpsEnabled,
            gpsType,
            gpsYear,
            userReplacementPriceExVat: null,
          }),
        });
        const data = (await response.json()) as TractorValuationApiResponse;
        if (!response.ok || !data.ok || !data.result) throw new Error(data.error ?? 'Failed to calculate tractor estimate.');
        setResultState({ kind: 'tractor', result: data.result });
        setReplacementPriceBasis(data.result.replacementPriceBasis ?? 'aim4price');
        setSelectedMethod('aim4price');
        setReplacementPanelOpen(false);
      } else if (selectedFamily && selectedBrand) {
        const response = await fetch('/api/generic-valuations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sectorKey: selectedSector,
            familyKey: selectedFamily.familyKey,
            brandSlug: selectedBrand.slug,
            typedModelName: submittedGenericModelName,
            saveModelCandidate: shouldSaveGenericModelCandidate,
            specsJson: enrichedSpecsJson,
            year: yearModelUnknown ? CURRENT_YEAR : yearNumber,
            yearModelUnknown,
            usageAmount: usageNumber,
            lifeWorkedPercent: lifeWorkedPercentNumber,
            condition,
            userReplacementPriceExVat: null,
            userReplacementPriceYear: null,
          }),
        });
        const data = (await response.json()) as GenericValuationApiResponse;
        if (!response.ok || !data.ok || !data.result) throw new Error(data.error ?? 'Failed to calculate generic estimate.');
        setResultState({ kind: 'generic', result: data.result });
        setReplacementPriceBasis(data.result.replacementPriceBasis ?? 'aim4price');
        setSelectedMethod('aim4price');
        setReplacementPanelOpen(false);
      }

      if (!isSignedIn) {
        setGuestValuationCount(incrementGuestValuationCount());
      }
      setStep(5);
    } catch (error) {
      console.error(error);
      setMessage(error instanceof Error ? error.message : 'Failed to calculate estimate.');
    } finally {
      setValuationLoading(false);
    }
  }

  function buildValuationSavePayload(options: { saveForMarketplace?: boolean; photos?: string[] } = {}): Record<string, unknown> {
    if (!resultState) {
      throw new Error('Run an estimate before saving.');
    }

    const marketplaceFields = options.saveForMarketplace
      ? {
          saveForMarketplace: true,
          photos: options.photos ?? [],
        }
      : {};

    if (resultState.kind === 'tractor') {
      const replacementPriceForSave = resultState.result.userReplacementPriceExVat ?? null;

      return {
        modelId: resultState.result.model.id,
        year: yearModelUnknown ? CURRENT_YEAR : yearNumber,
        hours: usageNumber ?? estimateHoursFromWorkedPercent(selectedModel, lifeWorkedPercentNumber) ?? 0,
        condition,
        frontPto,
        frontLoader,
        gpsEnabled,
        gpsType,
        gpsYear,
        userReplacementPriceExVat: replacementPriceForSave,
        selectedMethod: 'aim4price',
        valuationVersion: 'v1',
        ...marketplaceFields,
      };
    }

    const replacementPriceForSave = resultState.result.userReplacementPriceExVat ?? null;
    const replacementPriceYearForSave = replacementPriceForSave ? resultState.result.userReplacementPriceYear ?? CURRENT_YEAR : null;

    return {
      catalogModeUsed: 'generic_specs',
      sectorKey: resultState.result.sector.key,
      familyKey: resultState.result.family.key,
      brandSlug: resultState.result.brand.slug,
      typedModelName: resultState.result.typedModelName,
      specsJson: resultState.result.specsJson,
      year: resultState.result.year,
      yearModelUnknown,
      usageAmount: resultState.result.usageAmount,
      lifeWorkedPercent: resultState.result.lifeWorkedPercent,
      condition: resultState.result.condition,
      userReplacementPriceExVat: replacementPriceForSave,
      userReplacementPriceYear: replacementPriceYearForSave,
      selectedMethod: 'aim4price',
      valuationVersion: 'generic-v1',
      ...marketplaceFields,
    };
  }

  function getCurrentResultReplacementPriceExVat(): number | null {
    if (!resultState) return null;

    if (resultState.kind === 'tractor') {
      return (
        resultState.result.replacementPriceUsedExVat ??
        resultState.result.userReplacementPriceExVat ??
        resultState.result.model.aim4priceReplacementExVat ??
        null
      );
    }

    const calculation = getGenericCalculation(resultState.result, replacementPriceBasis);
    return calculation?.replacementPriceExVat ?? resultState.result.replacementPriceUsedExVat ?? null;
  }

  function ensureReplacementPriceBeforeFinalSave(setError: (message: string) => void): boolean {
    const replacementPrice = getCurrentResultReplacementPriceExVat();

    if (replacementPrice !== null && Number.isFinite(replacementPrice) && replacementPrice > 0) {
      return true;
    }

    if (!finalSaveIntent) {
      setReplacementPanelOpen(true);
    }
    setError('A replacement price is required before this asset can be saved. Enter the replacement price, click Update and recalculate, then continue.');
    return false;
  }

  function buildMarketplaceEstimateTitle(): string {
    if (!resultState) return 'Aim4price marketplace listing';

    if (resultState.kind === 'tractor') {
      const model = resultState.result.model;
      const titleUsage = usageNumber ?? estimateHoursFromWorkedPercent(selectedModel, lifeWorkedPercentNumber);
      return [
        model.brandName,
        model.modelName,
        yearModelUnknown ? null : String(yearNumber),
        titleUsage ? `${formatWholeNumber(titleUsage)} hours` : null,
        conditionLabel(condition),
      ]
        .filter(Boolean)
        .join(' • ');
    }

    const result = resultState.result;
    const usageLabel =
      result.usageAmount !== null
        ? `${formatWholeNumber(result.usageAmount)} ${getUsageShortUnit(result.sector.key, result.family.usageMetricType)}`
        : result.lifeWorkedPercent !== null
          ? `${formatPercent(result.lifeWorkedPercent)} worked`
          : null;

    return [
      result.brand.name,
      result.typedModelName || result.family.label,
      result.year,
      usageLabel,
      conditionLabel(result.condition),
    ]
      .filter(Boolean)
      .join(' • ');
  }

  function buildValuationPdfPayload(): ValuationPdfPayload | null {
    if (!resultState || headlineValue === null) return null;

    const isGeneric = resultState.kind === 'generic';
    const genericResult = isGeneric ? resultState.result : null;
    const tractorResult = resultState.kind === 'tractor' ? resultState.result : null;
    const exactModel = tractorResult?.model ?? selectedModel;
    const genericSelectedCalculation = genericResult ? getGenericCalculation(genericResult, replacementPriceBasis) : null;
    const aimValue = isGeneric
      ? genericSelectedCalculation?.valuationMidExVat ?? null
      : tractorResult?.aim4priceValueExVat ?? null;
    const confidenceContext: ConfidenceContext = {
      selectedMethod,
      yearKnown: !yearModelUnknown,
      hoursKnown: usageNumber !== null,
      workedPercentKnown: lifeWorkedPercentNumber !== null && usageNumber === null,
      usageSentenceLabel: selectedUsageSentenceLabel,
      marketUsageToleranceLabel: selectedMarketUsageToleranceLabel,
    };
    const confidenceText = getConfidenceLabel(resultState, confidenceContext);
    const confidenceNote = getConfidenceNote(resultState, confidenceContext);
    const genericModelNameForResult = genericResult?.typedModelName || getGenericModelSubmitName(selectedGenericModel) || normalizeText(typedModelName);
    const machineTitle = isGeneric
      ? `${genericResult?.brand.name ?? selectedBrand?.name ?? ''} ${genericModelNameForResult || genericResult?.family.label || selectedFamily?.familyLabel || ''}`.trim()
      : `${exactModel?.brandName ?? selectedBrand?.name ?? ''} ${exactModel?.modelName ?? ''}`.trim();
    const resultCondition: ConditionKey = isGeneric ? genericResult?.condition ?? condition : condition;
    const resultYear = isGeneric ? genericResult?.year ?? yearNumber : yearModelUnknown ? CURRENT_YEAR : yearNumber;
    const yearSummary = yearModelUnknown ? 'Unknown' : String(resultYear);
    const resultUsageShortUnit = isGeneric && genericResult
      ? getUsageShortUnit(genericResult.sector.key, genericResult.family.usageMetricType)
      : 'hours';
    const usageSummary = isGeneric && genericSelectedCalculation
      ? `${formatPercent(genericSelectedCalculation.lifeWorkedPercent)} worked${genericSelectedCalculation.estimatedHours ? ` • ${genericSelectedCalculation.estimatedHours.toLocaleString('en-ZA')} estimated ${resultUsageShortUnit}` : ''}`
      : usageNumber
        ? `${usageNumber.toLocaleString('en-ZA')} ${resultUsageShortUnit}`
        : lifeWorkedPercentNumber !== null
          ? `${formatPercent(lifeWorkedPercentNumber)} worked`
          : 'Usage captured';
    const tractorReplacementBasisText = tractorResult?.userReplacementPriceExVat && replacementPriceBasis === 'user'
      ? `Current basis: your replacement price of ${money(tractorResult.userReplacementPriceExVat)}`
      : `Current basis: saved replacement price of ${money(tractorResult?.replacementPriceUsedExVat ?? exactModel?.aim4priceReplacementExVat ?? null)}`;
    const genericReplacementBasisText = genericResult?.userReplacementCalculation && replacementPriceBasis === 'user'
      ? `Current basis: your replacement price of ${money(genericResult.userReplacementCalculation.replacementPriceExVat)}`
      : `Current basis: saved replacement estimate of ${money(genericResult?.aim4priceReplacementCalculation?.replacementPriceExVat ?? null)}`;
    const replacementBasisText = isGeneric ? genericReplacementBasisText : tractorReplacementBasisText;
    const sectorLabel = isGeneric
      ? genericResult?.sector.label ?? (selectedSector ? SECTOR_LABELS[selectedSector] : 'N/A')
      : 'Agricultural';
    const familyLabel = isGeneric ? genericResult?.family.label ?? selectedFamily?.familyLabel ?? 'N/A' : 'Tractors';
    const brandName = isGeneric ? genericResult?.brand.name ?? selectedBrand?.name ?? 'N/A' : exactModel?.brandName ?? selectedBrand?.name ?? 'N/A';
    const modelName = isGeneric ? genericModelNameForResult : exactModel?.modelName ?? '';
    const valuationPath = flowMode === 'exact_model' ? 'Exact model' : flowMode === 'generic_specs' ? getSpecsTitle(selectedSector) : formatCatalogModeLabel(selectedFamily?.catalogMode ?? 'generic_specs');
    const selectedMethodLabel = selectedValueTypeLabel(selectedMethod);
    const generatedAt = new Date();
    const replacementPriceExVat = getCurrentResultReplacementPriceExVat();

    function genericSpecDisplayValue(matchers: string[]): string {
      if (!genericResult) return '';
      const question = specQuestions.find((item) => {
        const haystack = `${item.specKey} ${item.label}`.toLowerCase();
        return matchers.some((matcher) => haystack.includes(matcher.toLowerCase()));
      });
      if (!question) return '';
      const rawAnswer = specAnswers[question.specKey];
      const rawFromResult = genericResult.specsJson[question.specKey];
      const value = rawAnswer !== undefined && rawAnswer !== '' ? rawAnswer : rawFromResult !== undefined ? String(rawFromResult) : '';
      const displayValue = getSpecQuestionAnswerLabel(question, value);
      return displayValue === 'Not answered' ? '' : displayValue;
    }

    const powerValue = isGeneric
      ? genericSpecDisplayValue(['power', 'power_kw', 'kw', 'horsepower', 'hp'])
      : exactModel ? `${exactModel.powerKw} kW` : '';
    const typeValue = isGeneric
      ? genericSpecDisplayValue(['type', 'machine type', 'body type', 'vehicle type'])
      : exactModel ? getTractorTypeLabel(exactModel.tractorType) : '';
    const driveValue = isGeneric
      ? genericSpecDisplayValue(['drive', 'drivetrain'])
      : exactModel ? getDriveLabel(exactModel.drive) : '';
    const cabValue = isGeneric
      ? genericSpecDisplayValue(['cab', 'station', 'rops'])
      : exactModel ? getCabLabel(exactModel.cab) : '';

    const assetDetailRows = compactPdfRows([
      { label: 'Category', value: familyLabel },
      { label: 'Brand', value: brandName },
      { label: 'Model', value: modelName },
      { label: 'Power', value: powerValue },
      { label: 'Type', value: typeValue },
      { label: 'Drive', value: driveValue },
      { label: 'Cab', value: cabValue },
      { label: 'Year', value: yearSummary },
      { label: 'Usage', value: usageSummary },
      { label: 'Condition', value: conditionLabel(resultCondition) },
      { label: 'Replacement Price', value: moneyExVat(replacementPriceExVat) },
      { label: 'Estimate Path', value: valuationPath },
      { label: 'Estimate Source / Selected Value Type', value: selectedMethodLabel },
    ]);

    const signedInBusinessName = accountProfile?.businessName || accountProfile?.displayName || accountProfile?.name;
    const signedInPhone = accountProfile?.marketplacePhone || accountProfile?.phone;
    const signedInEmail = normalizeReportEmail(accountProfile?.marketplaceEmail) || normalizeReportEmail(accountProfile?.email);
    const signedInLocation = accountProfile?.marketplaceLocation || [accountProfile?.townCity, accountProfile?.province].filter(Boolean).join(', ');
    const clientRows = isSignedIn
      ? compactPdfRows([
          { label: 'Business Name', value: signedInBusinessName },
          { label: 'Contact Details', value: signedInPhone },
          { label: 'Business Email', value: signedInEmail },
          { label: 'Location / Address', value: signedInLocation },
        ])
      : compactPdfRows([
          { label: 'Business Name', value: 'Aim4price' },
          { label: 'Contact Details', value: '0625721650' },
          { label: 'Business Email', value: 'aim4price@gmail.com' },
        ]);

    const safeClientRows = clientRows.length
      ? clientRows
      : compactPdfRows([
          { label: 'Business Name', value: 'Aim4price' },
          { label: 'Contact Details', value: '0625721650' },
          { label: 'Business Email', value: 'aim4price@gmail.com' },
        ]);

    const recordRows = compactPdfRows([
      { label: 'Selected Value', value: selectedMethodLabel },
      { label: 'Confidence', value: confidenceText.replace(/^Confidence:\s*/i, '') },
      { label: 'Generated', value: formatPdfReportDate(generatedAt) },
    ]);

    return {
      generatedAt: generatedAt.toISOString(),
      machineTitle: machineTitle || 'Aim4price estimate',
      sectorLabel,
      familyLabel,
      brandName,
      valuationPath,
      selectedMethodLabel,
      selectedValueExVat: headlineValue,
      aim4priceValueExVat: aimValue,
      confidenceText,
      confidenceNote,
      yearSummary,
      usageSummary,
      conditionSummary: conditionLabel(resultCondition),
      replacementPriceExVat,
      replacementBasisText,
      notes: [
        'Values exclude VAT unless stated otherwise.',
        'This is an indicative Aim4price estimate, not a certified appraisal or inspection report.',
        'Values are indicative Aim4price estimates based on replacement price, saved asset information, age, usage, condition and available asset inputs. This is not a certified appraisal, inspection report or guarantee of selling price.',
      ],
      assetDetailRows,
      clientRows: safeClientRows,
      recordRows,
    };
  }

  async function downloadValuationPdf() {
    if (!resultState) {
      setPdfError('Run an estimate before downloading the PDF report.');
      return;
    }

    const payload = buildValuationPdfPayload();
    if (!payload) {
      setPdfError('The estimate report could not be prepared.');
      return;
    }

    setPdfLoading(true);
    setPdfError('');

    try {
      const targetName = `aim4price-estimate-report-${pdfFileSlug(payload.machineTitle)}-${Date.now()}`;
      const reportWindow = window.open('', targetName);

      if (!reportWindow) {
        throw new Error('The PDF report window was blocked. Allow pop-ups for Aim4price, then try again.');
      }

      reportWindow.document.write('<!doctype html><title>Preparing Aim4price report...</title><body style="font-family: Arial, sans-serif; padding: 24px; color: #111827;">Preparing Aim4price estimate report...</body>');
      reportWindow.document.close();

      const form = document.createElement('form');
      form.method = 'POST';
      form.action = '/api/valuation/report';
      form.target = targetName;
      form.style.display = 'none';

      const payloadInput = document.createElement('input');
      payloadInput.type = 'hidden';
      payloadInput.name = 'payload';
      payloadInput.value = JSON.stringify(payload);
      form.appendChild(payloadInput);

      document.body.appendChild(form);
      form.submit();
      window.setTimeout(() => form.remove(), 0);
    } catch (error) {
      console.error(error);
      setPdfError(error instanceof Error ? error.message : 'Failed to create the estimate PDF report.');
    } finally {
      window.setTimeout(() => setPdfLoading(false), 700);
    }
  }

  function buildDefaultMarketplaceDraft(): MarketplacePublishDraft {
    const selectedValue = headlineValue ?? 0;
    const title = buildMarketplaceEstimateTitle();
    const sellerName =
      (isSignedIn
        ? accountProfile?.marketplaceSellerName || accountProfile?.displayName || accountProfile?.name || accountProfile?.businessName
        : '') || '';
    const sellerCompany = (isSignedIn ? accountProfile?.businessName : '') || '';
    const sellerPhone = (isSignedIn ? accountProfile?.marketplacePhone || accountProfile?.phone : '') || '';
    const sellerEmail = (isSignedIn ? accountProfile?.marketplaceEmail : '') || '';
    const area = (isSignedIn ? accountProfile?.marketplaceLocation || accountProfile?.townCity : '') || '';

    return {
      askingPriceExVat: selectedValue > 0 ? formatMoneyInput(selectedValue) : '',
      marketplaceNotes: `${title} listed from a current Aim4price estimate.`,
      sellerName,
      sellerCompany,
      sellerPhone,
      sellerEmail,
      province: accountProfile?.province || '',
      area,
    };
  }

  function hasPendingReplacementPriceInput(): boolean {
    const typedReplacementPrice = parseMoneyInput(userReplacementPrice);
    if (typedReplacementPrice === null) return false;

    const currentReplacementPrice = getCurrentResultReplacementPriceExVat();
    if (currentReplacementPrice === null) return true;

    return Math.round(typedReplacementPrice) !== Math.round(currentReplacementPrice);
  }

  function openFinalSaveModal(intent: FinalSaveIntent) {
    if (!resultState) {
      setMessage('Run an estimate before saving.');
      return;
    }

    if (!isSignedIn) {
      setMessage('Create an account or sign in to save this estimate to your Asset Register or send it to Marketplace.');
      return;
    }

    if (intent === 'asset-register' && !canSaveToAssetRegister) {
      setMessage('Only owner accounts can save estimates to the Asset Register.');
      return;
    }

    if (intent === 'marketplace' && !canUseMarketplacePublishFlow) {
      setMessage('Marketplace listings are only available for owner, dealer and auctioneer accounts.');
      return;
    }

    if (headlineValue === null) {
      setMessage('Choose an available estimate value first.');
      return;
    }

    const currentReplacementPrice = getCurrentResultReplacementPriceExVat();

    setMessage('');
    setFinalSaveError('');
    setFinalSaveIntent(intent);
    setReplacementPanelOpen(false);

    if (!userReplacementPrice.trim() && currentReplacementPrice !== null && Number.isFinite(currentReplacementPrice) && currentReplacementPrice > 0) {
      setUserReplacementPrice(String(Math.round(currentReplacementPrice)));
    }
  }

  function closeFinalSaveModal() {
    if (saveLoading || replacementRecalculateLoading) return;
    setFinalSaveIntent(null);
    setFinalSaveError('');
  }

  async function recalculateFinalReplacementPrice() {
    const nextReplacementPrice = parseMoneyInput(userReplacementPrice);

    if (!resultState) {
      setFinalSaveError('Run an estimate before updating the replacement price.');
      return;
    }

    if (nextReplacementPrice === null) {
      setFinalSaveError('Enter a valid replacement price excluding VAT.');
      return;
    }

    setFinalSaveError('');

    if (resultState.kind === 'generic') {
      await calculateGenericWithReplacementPrice(Math.round(nextReplacementPrice), setFinalSaveError);
    } else {
      await calculateTractorWithReplacementPrice(Math.round(nextReplacementPrice), setFinalSaveError);
    }
  }

  async function saveCurrentValuationToRegister(options: {
    saveForMarketplace?: boolean;
    photos?: string[];
    redirectToAssetRegister?: boolean;
    setError?: (message: string) => void;
  } = {}): Promise<SaveValuationRunApiResponse | null> {
    const setError = options.setError ?? setMessage;

    if (!resultState) {
      setError('Run an estimate before saving.');
      return null;
    }

    if (!isSignedIn) {
      setError('Create an account or sign in to save this estimate to your Asset Register or send it to Marketplace.');
      return null;
    }

    if (options.saveForMarketplace) {
      if (!canUseMarketplacePublishFlow) {
        setError('Marketplace listings are only available for owner, dealer and auctioneer accounts.');
        return null;
      }
    } else if (!canSaveToAssetRegister) {
      setError('Only owner accounts can save estimates to the Asset Register.');
      return null;
    }

    const selectedValue = getHeadlineValue(resultState, selectedMethod, replacementPriceBasis);
    if (selectedValue === null) {
      setError('Choose an available estimate value first.');
      return null;
    }

    if (hasPendingReplacementPriceInput()) {
      setError('You changed the replacement price input. Click Update and recalculate before saving or listing this asset.');
      return null;
    }

    if (!ensureReplacementPriceBeforeFinalSave(setError)) {
      return null;
    }

    setSaveLoading(true);
    setMessage('');
    setError('');

    try {
      const response = await fetch('/api/valuation-runs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(
          buildValuationSavePayload({
            saveForMarketplace: options.saveForMarketplace,
            photos: options.photos,
          }),
        ),
      });
      const data = (await response.json()) as SaveValuationRunApiResponse;

      if (!response.ok || !data.ok) {
        throw new Error(data.error ?? 'Failed to save estimate.');
      }

      if (options.redirectToAssetRegister) {
        router.push('/asset-register');
      }

      return data;
    } catch (error) {
      console.error(error);
      setError(error instanceof Error ? error.message : 'Failed to save estimate.');
      return null;
    } finally {
      setSaveLoading(false);
    }
  }

  async function confirmFinalSaveAction() {
    if (!finalSaveIntent) return;

    const isMarketplaceSave = finalSaveIntent === 'marketplace';
    const saved = await saveCurrentValuationToRegister({
      saveForMarketplace: isMarketplaceSave,
      redirectToAssetRegister: !isMarketplaceSave,
      setError: setFinalSaveError,
    });

    if (!saved) return;

    if (isMarketplaceSave) {
      if (!saved.assetId) {
        setFinalSaveError('The estimate saved, but no asset id was returned for the marketplace listing.');
        return;
      }

      setSavedMarketplaceAssetId(saved.assetId);
      setFinalSaveIntent(null);
      setFinalSaveError('');
      setMarketplacePublishError('');
      setMarketplaceDraft(buildDefaultMarketplaceDraft());
    }
  }

  function openMarketplacePublishModal() {
    openFinalSaveModal('marketplace');
  }

  function closeMarketplaceIntroModal() {
    setMarketplaceIntroOpen(false);
    if (typeof window !== 'undefined') {
      try {
        window.localStorage.setItem(MARKETPLACE_INTRO_DISMISSED_KEY, '1');
      } catch {
        // Ignore storage errors; the modal still closes for the current page view.
      }
    }
  }

  function goToAccountCreationFromMarketplaceIntro() {
    closeMarketplaceIntroModal();
    router.push('/auth#signup');
  }

  function clearMarketplacePhotoFiles(files = marketplacePhotoFiles) {
    for (const photo of files) {
      URL.revokeObjectURL(photo.previewUrl);
    }
    setMarketplacePhotoFiles([]);
    if (marketplacePhotoInputRef.current) marketplacePhotoInputRef.current.value = '';
  }

  function closeMarketplacePublishModal() {
    if (isPublishingMarketplace) return;
    clearMarketplacePhotoFiles();
    setMarketplaceDraft(null);
    setMarketplacePublishError('');
  }

  function handleMarketplaceDraftChange(
    event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>,
  ) {
    const { name, value } = event.target;
    setMarketplaceDraft((current) => (current ? { ...current, [name]: value } : current));
  }

  function handleMarketplacePriceChange(event: ChangeEvent<HTMLInputElement>) {
    const next = formatMoneyInput(event.target.value);
    setMarketplaceDraft((current) => (current ? { ...current, askingPriceExVat: next } : current));
  }

  function handleMarketplacePhotoChange(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []).filter((file) => file.type.startsWith('image/'));
    if (!files.length) return;

    const availableSlots = Math.max(0, MAX_MARKETPLACE_PHOTOS - marketplacePhotoFiles.length);
    if (!availableSlots) {
      setMarketplacePublishError(`You can upload a maximum of ${MAX_MARKETPLACE_PHOTOS} photos.`);
      if (marketplacePhotoInputRef.current) marketplacePhotoInputRef.current.value = '';
      return;
    }

    const selectedFiles = files.slice(0, availableSlots);
    if (files.length > availableSlots) {
      setMarketplacePublishError(`Only ${availableSlots} more photo${availableSlots === 1 ? '' : 's'} can be added.`);
    } else {
      setMarketplacePublishError('');
    }

    setMarketplacePhotoFiles((current) => [
      ...current,
      ...selectedFiles.map((file) => ({
        id: createMarketplacePhotoId(),
        file,
        previewUrl: URL.createObjectURL(file),
      })),
    ]);

    if (marketplacePhotoInputRef.current) marketplacePhotoInputRef.current.value = '';
  }

  function removeMarketplacePhoto(photoId: string) {
    setMarketplacePhotoFiles((current) => {
      const removed = current.find((photo) => photo.id === photoId);
      if (removed) URL.revokeObjectURL(removed.previewUrl);
      return current.filter((photo) => photo.id !== photoId);
    });
  }

  async function uploadMarketplacePhotos(): Promise<string[]> {
    if (!marketplacePhotoFiles.length) return [];

    const formData = new FormData();
    formData.append('uploadType', 'photo');
    for (const photo of marketplacePhotoFiles) {
      formData.append('files', photo.file);
    }

    const response = await fetch('/api/asset-register/uploads', {
      method: 'POST',
      body: formData,
      credentials: 'include',
    });
    const data = (await response.json()) as MarketplaceUploadApiResponse;

    if (!response.ok || !data.ok) {
      throw new Error(data.error ?? 'Failed to upload marketplace photos.');
    }

    return (data.uploads ?? [])
      .map((upload) => String(upload.url ?? upload.href ?? upload.path ?? '').trim())
      .filter(Boolean);
  }

  async function publishEstimateToMarketplace(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!resultState || !marketplaceDraft) {
      setMarketplacePublishError('Run an estimate before sending to marketplace.');
      return;
    }

    const selectedValue = getHeadlineValue(resultState, selectedMethod, replacementPriceBasis);
    if (selectedValue === null) {
      setMarketplacePublishError('Choose an available value before sending to marketplace.');
      return;
    }

    const askingPriceExVat = Math.round(parseMoneyInput(marketplaceDraft.askingPriceExVat) ?? 0);
    if (askingPriceExVat <= 0) {
      setMarketplacePublishError('Enter a valid asking price excluding VAT.');
      return;
    }

    if (!marketplaceDraft.sellerName.trim() || !marketplaceDraft.sellerPhone.trim()) {
      setMarketplacePublishError('Seller name and phone are required.');
      return;
    }

    if (!isSignedIn) {
      setMarketplacePublishError('Create an account before publishing this marketplace listing.');
      router.push('/auth#signup');
      return;
    }

    if (normalizedSignedInAccountType !== 'owner' && normalizedSignedInAccountType !== 'dealer') {
      setMarketplacePublishError('Marketplace listings are only available for owner, dealer and auctioneer accounts.');
      return;
    }

    if (hasPendingReplacementPriceInput()) {
      setMarketplacePublishError('You changed the replacement price input. Click Update and recalculate before publishing this listing.');
      return;
    }

    if (!ensureReplacementPriceBeforeFinalSave(setMarketplacePublishError)) {
      return;
    }

    setIsPublishingMarketplace(true);
    setMarketplacePublishError('');

    try {
      const photoUrls = await uploadMarketplacePhotos();
      let assetId = savedMarketplaceAssetId;

      if (!assetId) {
        const saved = await saveCurrentValuationToRegister({
          saveForMarketplace: true,
          photos: photoUrls,
          setError: setMarketplacePublishError,
        });

        if (!saved?.assetId) {
          throw new Error('Failed to prepare this marketplace asset.');
        }

        assetId = saved.assetId;
        setSavedMarketplaceAssetId(saved.assetId);
      }

      const publishResponse = await fetch('/api/marketplace', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          assetId,
          askingPriceExVat,
          marketplaceNotes: marketplaceDraft.marketplaceNotes,
          sellerPhone: marketplaceDraft.sellerPhone,
          sellerName: marketplaceDraft.sellerName,
          sellerCompany: marketplaceDraft.sellerCompany,
          sellerEmail: marketplaceDraft.sellerEmail,
          province: marketplaceDraft.province,
          area: marketplaceDraft.area,
          photos: photoUrls,
        }),
      });
      const published = (await publishResponse.json()) as MarketplaceApiResponse;

      if (!publishResponse.ok || !published.ok) {
        throw new Error(published.error ?? 'Failed to publish this marketplace listing.');
      }

      const listingReference = published.listing?.id ?? published.listing?.sourceAssetId ?? published.assetId ?? assetId;
      clearMarketplacePhotoFiles();
      setMarketplaceDraft(null);
      setSavedMarketplaceAssetId(null);
      router.push(`/marketplace?listing=${encodeURIComponent(String(listingReference))}`);
    } catch (error) {
      console.error(error);
      setMarketplacePublishError(error instanceof Error ? error.message : 'Failed to publish this marketplace listing.');
    } finally {
      setIsPublishingMarketplace(false);
    }
  }

  function saveToAssetRegister() {
    openFinalSaveModal('asset-register');
  }

  function saveAndSendToMarketplace() {
    openFinalSaveModal('marketplace');
  }

  function handleNext() {
    setMessage('');
    if (step === 1 && !selectedFamily) {
      setMessage(`Choose an ${getAssetTypeLabel(selectedSector)} first.`);
      return;
    }
    if (step === 2 && !selectedBrand) {
      setMessage('Choose a brand first.');
      return;
    }
    if (step === 3) {
      if (exactTractorAvailable && !flowMode) {
        setMessage('Choose an estimate path first.');
        return;
      }
      if (flowMode === 'exact_model' && !tractorSetupComplete) {
        setMessage('Complete the type, drive and cab setup first.');
        return;
      }
      if (flowMode === 'exact_model' && !selectedModel) {
        setMessage(`Choose an exact model or continue using ${getSpecsLabel(selectedSector)}.`);
        return;
      }
      if (flowMode === 'generic_specs') {
        const genericModelMessage = validateGenericModelSelection();
        if (genericModelMessage) {
          setMessage(genericModelMessage);
          return;
        }
      }
    }
    if (step === 4) {
      void calculateValuation();
      return;
    }
    setStep(nextStep(step));
  }

  function resetToSectorSelection() {
    setStep(1);
    setSelectedSector(null);
    setFamilies([]);
    setFamilyKey('');
    setFamilySearch('');
    setEquipmentDropdownOpen(false);
    setBrands([]);
    setBrandSlug('');
    setBrandSearch('');
    setBrandDropdownOpen(false);
    setTypedModelName('');
    setModelQuery('');
    setModelDropdownOpen(false);
    setModelId('');
    setTractorType('');
    setDrive('');
    setCab('');
    setTractorModels([]);
    setGenericCatalogModels([]);
    setGenericModelsLoading(false);
    clearGenericModelSelection({ clearManual: true, clearPrefilledSpecs: true });
    setSpecQuestions([]);
    setSpecAnswers({});
    setOpenSpecDropdownKey(null);
    setGpsTypeDropdownOpen(false);
    genericModelPrefilledSpecKeysRef.current = new Set();
    setUsageAmount('');
    setLifeWorkedPercent('');
    setUserReplacementPrice('');
    setYearModelUnknown(false);
    setMessage('');
    resetResult();
  }

  function handleSectorSelect(sectorKey: SectorKey) {
    const sector = SECTOR_OPTIONS.find((option) => option.key === sectorKey);
    if (!sector?.available) {
      setMessage(`${SECTOR_LABELS[sectorKey]} is coming soon.`);
      return;
    }

    setMessage('');
    setSelectedSector(sectorKey);
    resetResult();
  }

  function handleFamilySelection(nextFamilyKey: string) {
    if (!nextFamilyKey) return;

    setFamilyKey(nextFamilyKey);
    setFamilySearch('');
    setEquipmentDropdownOpen(false);
    setTypedModelName('');
    setModelQuery('');
    setModelDropdownOpen(false);
    setModelId('');
    setTractorType('');
    setDrive('');
    setCab('');
    setTractorModels([]);
    setGenericCatalogModels([]);
    setGenericModelsLoading(false);
    clearGenericModelSelection({ clearManual: true, clearPrefilledSpecs: true });
    setBrandSearch('');
    setBrandDropdownOpen(false);
    setBrandSlug('');
    resetResult();
    setStep(2);
  }

  function handleBrandSelection(nextBrandSlug: string) {
    if (!nextBrandSlug) return;

    setBrandSlug(nextBrandSlug);
    setBrandSearch('');
    setBrandDropdownOpen(false);
    setTypedModelName('');
    setModelQuery('');
    setModelDropdownOpen(false);
    setModelId('');
    setTractorType('');
    setDrive('');
    setCab('');
    setTractorModels([]);
    setGenericCatalogModels([]);
    setGenericModelsLoading(false);
    clearGenericModelSelection({ clearManual: true, clearPrefilledSpecs: true });
    resetResult();
    setStep(3);
  }

  function resetExactModelSelection() {
    setModelQuery('');
    setModelDropdownOpen(false);
    setModelId('');
    setTractorModels([]);
    resetResult();
  }

  function handleTractorTypeSelection(value: TractorType) {
    setTractorType(value);
    setDrive('');
    setCab('');
    resetExactModelSelection();
  }

  function handleDriveSelection(value: DriveType) {
    setDrive(value);
    setCab('');
    resetExactModelSelection();
  }

  function handleCabSelection(value: CabType) {
    setCab(value);
    resetExactModelSelection();
  }

  function handleModelSelection(nextModelId: string) {
    if (!nextModelId) return;
    setModelId(nextModelId);
    setModelQuery('');
    setModelDropdownOpen(false);
    setMessage('');
    resetResult();
    setStep(4);
  }

  function handleGenericModelSelection(nextModelId: number) {
    const matchingModel = genericCatalogModels.find((model) => model.id === nextModelId);
    if (!matchingModel) return;

    setGenericModelId(String(matchingModel.id));
    setGenericModelMode('catalog');
    setGenericModelQuery('');
    setGenericModelDropdownOpen(false);
    setTypedModelName('');
    setMessage('');
    applyGenericModelSpecDefaults(matchingModel);
    resetResult();
  }

  function handleGenericModelNotListed() {
    setGenericModelId('');
    setGenericModelMode('manual');
    setGenericModelQuery('');
    setGenericModelDropdownOpen(false);
    removeGenericModelPrefilledAnswers();
    setMessage('');
    resetResult();
  }

  function handleBack() {
    setMessage('');
    if (step === 1) {
      if (selectedSector) {
        resetToSectorSelection();
        return;
      }

      router.push('/');
      return;
    }
    setStep(previousStep(step));
  }

  function renderMachineStep() {
    if (!selectedSector) {
      return (
        <div className={styles.sectorStart}>
          <div className={styles.sectorIntro}>
            <h2 className={styles.stepTitle}>Choose sector</h2>
            <p className={styles.stepText}>Pick the sector first. Hover over a card to preview that sector.</p>
          </div>

          <div className={styles.sectorLargeGrid}>
            {SECTOR_OPTIONS.map((sector) => {
              const isAvailable = sector.available;
              return (
                <button
                  key={sector.key}
                  type="button"
                  className={`${styles.sectorBigCard} ${isAvailable ? styles.sectorBigCardLive : styles.sectorBigCardSoon}`}
                  onClick={() => handleSectorSelect(sector.key)}
                  onMouseEnter={(event) => {
                    if (!shouldAutoPlaySectorVideos) playSectorPreview(event.currentTarget);
                  }}
                  onMouseLeave={(event) => {
                    if (!shouldAutoPlaySectorVideos) resetSectorPreview(event.currentTarget);
                  }}
                  onFocus={(event) => {
                    if (!shouldAutoPlaySectorVideos) playSectorPreview(event.currentTarget);
                  }}
                  onBlur={(event) => {
                    if (!shouldAutoPlaySectorVideos) resetSectorPreview(event.currentTarget);
                  }}
                  aria-label={isAvailable ? `Choose ${sector.label}` : `${sector.label} coming soon`}
                >
                  <video
                    className={`${styles.sectorVideo} ${shouldAutoPlaySectorVideos ? styles.sectorVideoMobileActive : ''}`}
                    muted
                    loop
                    playsInline
                    autoPlay={shouldAutoPlaySectorVideos}
                    preload="auto"
                    poster=""
                  >
                    <source src={sector.videoSrc} type="video/mp4" />
                  </video>

                  <span className={styles.sectorVideoOverlay} />

                  <span className={styles.sectorBigCardContent}>
                    <span className={styles.sectorCardTopRow}>
                      <span className={isAvailable ? styles.liveBadge : styles.soonBadge}>
                        {isAvailable ? 'Live now' : 'Coming soon'}
                      </span>
                    </span>

                    <span className={styles.sectorLabelWrap}>
                      <strong className={styles.sectorLabel}>{sector.label}</strong>
                      {isAvailable ? <span className={styles.sectorCardHint}>Open estimate flow</span> : null}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      );
    }

    return (
      <div className={styles.equipmentStage}>
        <div className={`${styles.equipmentStageTop} ${styles.equipmentStageTopSolo}`}>
          <span className={styles.selectedSummaryPill}>{SECTOR_LABELS[selectedSector]}</span>
        </div>

        <div className={styles.equipmentStageIntro}>
          <h2 className={styles.stepTitle}>Choose {getAssetTypeLabel(selectedSector)}</h2>
          <p className={styles.stepText}>Search or choose the {getAssetTypeLabel(selectedSector)}. Selecting one moves to the brand step automatically.</p>
        </div>

        <div className={`${styles.currentCard} ${styles.equipmentPickerCard}`}>
          <div className={styles.equipmentPickerHead}>
            <div>
              <span className={styles.fieldLabel}>Search {getAssetTypeLabel(selectedSector)}</span>
              <p className={styles.equipmentPickerHint}>Type a normal word, then pick the matching {getAssetItemLabel(selectedSector)} from the dropdown.</p>
            </div>
            <span className={styles.equipmentCountPill}>{familiesLoading ? 'Loading' : `${filteredFamilies.length} found`}</span>
          </div>

          <label className={`${styles.field} ${styles.searchPanel}`}>
            <input
              className={styles.searchInput}
              value={familySearch}
              onChange={(event) => {
                setFamilySearch(event.target.value);
                setEquipmentDropdownOpen(true);
              }}
              onFocus={() => setEquipmentDropdownOpen(true)}
              placeholder={selectedSector === 'motor' ? 'e.g. bakkie, SUV, sedan' : 'e.g. baler, tractor, spreader'}
              autoComplete="off"
            />
          </label>

          <div className={styles.equipmentDropdownWrap}>
            <button
              type="button"
              className={`${styles.equipmentDropdownTrigger} ${equipmentDropdownOpen ? styles.equipmentDropdownTriggerOpen : ''}`}
              onClick={() => setEquipmentDropdownOpen((value) => !value)}
              disabled={familiesLoading || !filteredFamilies.length}
              aria-expanded={equipmentDropdownOpen}
            >
              <span>{selectedFamily ? selectedFamily.familyLabel : familiesLoading ? `Loading ${getAssetTypeLabel(selectedSector)}s...` : `Select ${getAssetTypeLabel(selectedSector)}...`}</span>
              <span className={styles.equipmentDropdownChevron} aria-hidden="true">
                <svg viewBox="0 0 20 20" focusable="false">
                  <path d="M5.5 7.5 10 12l4.5-4.5" />
                </svg>
              </span>
            </button>

            {equipmentDropdownOpen ? (
              <div className={styles.equipmentDropdownMenu}>
                {filteredFamilies.length ? (
                  filteredFamilies.map((family) => (
                    <button
                      key={family.familyKey}
                      type="button"
                      className={`${styles.equipmentDropdownOption} ${familyKey === family.familyKey ? styles.equipmentDropdownOptionActive : ''}`}
                      onClick={() => handleFamilySelection(family.familyKey)}
                    >
                      <span>{family.familyLabel}</span>
                    </button>
                  ))
                ) : (
                  <div className={styles.equipmentDropdownEmpty}>No matching {getAssetTypeLabel(selectedSector)} found.</div>
                )}
              </div>
            ) : null}
          </div>

          {familiesLoading ? <p className={styles.fieldHint}>Loading {getAssetTypeLabel(selectedSector)}s...</p> : null}

          {!filteredFamilies.length && !familiesLoading ? (
            <p className={styles.message}>No matching {getAssetTypeLabel(selectedSector)} found. Clear the search or import it into the {selectedSector === 'motor' ? 'vehicle catalogue' : 'equipment catalogue'}.</p>
          ) : null}
        </div>
      </div>
    );
  }

  function renderBrandStep() {
    return (
      <div className={styles.equipmentStage}>
        <div className={`${styles.equipmentStageTop} ${styles.equipmentStageTopSolo}`}>
          {selectedFamily ? <span className={styles.selectedSummaryPill}>{selectedFamily.familyLabel}</span> : null}
        </div>

        <div className={styles.equipmentStageIntro}>
          <h2 className={styles.stepTitle}>Choose brand</h2>
          <p className={styles.stepText}>Search or choose the brand. Selecting one moves to the next step automatically.</p>
        </div>

        <div className={`${styles.currentCard} ${styles.equipmentPickerCard}`}>
          <div className={styles.equipmentPickerHead}>
            <div>
              <span className={styles.fieldLabel}>Search brand</span>
              <p className={styles.equipmentPickerHint}>Type the brand name, then pick the matching brand from the dropdown.</p>
            </div>
            <span className={styles.equipmentCountPill}>{brandsLoading ? 'Loading' : `${filteredBrands.length} found`}</span>
          </div>

          <label className={`${styles.field} ${styles.searchPanel}`}>
            <input
              className={styles.searchInput}
              value={brandSearch}
              onChange={(event) => {
                setBrandSearch(event.target.value);
                setBrandDropdownOpen(true);
              }}
              onFocus={() => setBrandDropdownOpen(true)}
              placeholder={selectedSector === 'motor' ? 'e.g. Toyota, Ford, Isuzu' : 'e.g. Claas, John Deere, New Holland'}
              autoComplete="off"
            />
          </label>

          <div className={styles.equipmentDropdownWrap}>
            <button
              type="button"
              className={`${styles.equipmentDropdownTrigger} ${brandDropdownOpen ? styles.equipmentDropdownTriggerOpen : ''}`}
              onClick={() => setBrandDropdownOpen((value) => !value)}
              disabled={brandsLoading || !filteredBrands.length}
              aria-expanded={brandDropdownOpen}
            >
              <span>{selectedBrand ? selectedBrand.name : brandsLoading ? 'Loading brands...' : 'Select brand...'}</span>
              <span className={styles.equipmentDropdownChevron} aria-hidden="true">
                <svg viewBox="0 0 20 20" focusable="false">
                  <path d="M5.5 7.5 10 12l4.5-4.5" />
                </svg>
              </span>
            </button>

            {brandDropdownOpen ? (
              <div className={styles.equipmentDropdownMenu}>
                {filteredBrands.length ? (
                  filteredBrands.map((brand) => (
                    <button
                      key={brand.slug}
                      type="button"
                      className={`${styles.equipmentDropdownOption} ${brandSlug === brand.slug ? styles.equipmentDropdownOptionActive : ''}`}
                      onClick={() => handleBrandSelection(brand.slug)}
                    >
                      <span>{brand.name}</span>
                    </button>
                  ))
                ) : (
                  <div className={styles.equipmentDropdownEmpty}>No matching brand found.</div>
                )}
              </div>
            ) : null}
          </div>

          {brandsLoading ? <p className={styles.fieldHint}>Loading brands...</p> : null}

          {!brands.length && !brandsLoading ? (
            <p className={styles.message}>No brands are linked to this {getAssetTypeLabel(selectedSector)} yet. Add brands for this {getAssetTypeLabel(selectedSector)} before running estimates.</p>
          ) : null}
          {brands.length > 0 && !filteredBrands.length && !brandsLoading ? (
            <p className={styles.message}>No matching brand. Clear the search or choose another {getAssetTypeLabel(selectedSector)}.</p>
          ) : null}
        </div>
      </div>
    );
  }

  function renderPathStep() {
    if (!exactTractorAvailable) {
      return (
        <div>
          <h2 className={styles.stepTitle}>{getSpecsTitle(selectedSector)} path</h2>
          <p className={styles.stepText}>
            {getGenericEstimatePathCopy(selectedSector)}
          </p>
          {renderGenericModelPicker()}
        </div>
      );
    }

    return (
      <div>
        <h2 className={styles.stepTitle}>Choose estimate path</h2>
        <p className={styles.stepText}>Choose one path first. Aim4price only shows the matching setup after you select it.</p>

        <div className={`${styles.choiceGrid} ${styles.pathChoiceGrid} ${styles.pathChoiceDeck}`}>
          <button
            type="button"
            className={`${styles.choiceCard} ${styles.pathChoiceCard} ${flowMode === 'exact_model' ? styles.choiceCardActive : ''}`}
            onClick={() => {
              setFlowMode('exact_model');
              setTypedModelName('');
              setTractorType('');
              setDrive('');
              setCab('');
              resetExactModelSelection();
              resetDetailsFlow();
            }}
          >
            <span className={styles.pathChoiceCardEyebrow}>Recommended</span>
            <strong>Use exact model</strong>
            <span className={styles.choiceCardNote}>Best when you know the model and want the clearest estimate path.</span>
          </button>

          <button
            type="button"
            className={`${styles.choiceCard} ${styles.pathChoiceCard} ${flowMode === 'generic_specs' ? styles.choiceCardActive : ''}`}
            onClick={() => {
              setFlowMode('generic_specs');
              setTractorType('');
              setDrive('');
              setCab('');
              resetExactModelSelection();
              resetDetailsFlow();
            }}
          >
            <span className={styles.pathChoiceCardEyebrow}>Flexible</span>
            <strong>Use {getSpecsLabel(selectedSector)}</strong>
            <span className={styles.choiceCardNote}>Use this when exact model data is not available or you are unsure of the exact model.</span>
          </button>
        </div>

        {!flowMode ? <div className={styles.pathSelectionPlaceholder}>Select one of the two paths above to continue.</div> : null}
        {flowMode === 'exact_model' ? renderTractorModelPicker() : null}
        {flowMode === 'generic_specs' ? renderGenericModelPicker() : null}
      </div>
    );
  }

  function renderTractorModelPicker() {
    return (
      <div className={`${styles.currentCard} ${styles.tractorSetupCard}`} style={{ marginTop: '1rem' }}>
        <div className={styles.currentCardHead}>
          <div>
            <h3 className={styles.currentTitle}>Find the tractor model</h3>
            <p className={styles.currentHint}>Choose the basic setup first. The model list appears after type, drive and cab are selected.</p>
          </div>
        </div>

        <div className={styles.tractorSetupProgress}>
          <div className={styles.inlineSetupGroup}>
            <div className={styles.inlineSetupHeader}>
              <span className={styles.fieldLabel}>Type</span>
              <strong>{tractorType ? getTractorTypeLabel(tractorType) : 'Choose first'}</strong>
            </div>
            <div className={styles.inlineOptionRow}>
              {TRACTOR_TYPE_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className={`${styles.inlineOptionButton} ${tractorType === option.value ? styles.inlineOptionButtonActive : ''}`}
                  onClick={() => handleTractorTypeSelection(option.value)}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          {tractorType ? (
            <div className={styles.inlineSetupGroup}>
              <div className={styles.inlineSetupHeader}>
                <span className={styles.fieldLabel}>Drive</span>
                <strong>{drive ? getDriveLabel(drive) : 'Choose drive'}</strong>
              </div>
              <div className={styles.inlineOptionRow}>
                {DRIVE_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    className={`${styles.inlineOptionButton} ${drive === option.value ? styles.inlineOptionButtonActive : ''}`}
                    onClick={() => handleDriveSelection(option.value)}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {tractorType && drive ? (
            <div className={styles.inlineSetupGroup}>
              <div className={styles.inlineSetupHeader}>
                <span className={styles.fieldLabel}>Cab</span>
                <strong>{cab ? getCabLabel(cab) : 'Choose cab'}</strong>
              </div>
              <div className={styles.inlineOptionRow}>
                {CAB_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    className={`${styles.inlineOptionButton} ${cab === option.value ? styles.inlineOptionButtonActive : ''}`}
                    onClick={() => handleCabSelection(option.value)}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {tractorSetupComplete ? (
            <div className={`${styles.inlineSetupGroup} ${styles.modelSetupGroup}`}>
              <div className={styles.inlineSetupHeader}>
                <span className={styles.fieldLabel}>Model</span>
                <strong>{selectedModel ? formatTractorModelLabel(selectedModel) : 'Choose model'}</strong>
              </div>

              <label className={`${styles.field} ${styles.searchPanel}`}>
                <span className={styles.fieldLabel}>Search model</span>
                <input
                  className={styles.searchInput}
                  value={modelQuery}
                  onChange={(event) => {
                    setModelQuery(event.target.value);
                    setModelDropdownOpen(true);
                  }}
                  onFocus={() => setModelDropdownOpen(true)}
                  placeholder="e.g. 6155M, 7610, 7810"
                  autoComplete="off"
                />
              </label>

              <div className={styles.equipmentDropdownWrap}>
                <button
                  type="button"
                  className={`${styles.equipmentDropdownTrigger} ${modelDropdownOpen || modelQuery ? styles.equipmentDropdownTriggerOpen : ''}`}
                  onClick={() => setModelDropdownOpen((value) => !value)}
                  disabled={modelsLoading || !tractorModels.length}
                >
                  <span>{formatTractorModelLabel(selectedModel)}</span>
                  <span className={styles.equipmentDropdownChevron} aria-hidden="true">
                    <svg viewBox="0 0 20 20" focusable="false">
                      <path d="M5.5 7.5 10 12l4.5-4.5" />
                    </svg>
                  </span>
                </button>

                {modelDropdownOpen || modelQuery ? (
                  <div className={styles.equipmentDropdownMenu}>
                    {filteredModels.length ? (
                      filteredModels.map((model) => (
                        <button
                          key={model.id}
                          type="button"
                          className={`${styles.equipmentDropdownOption} ${modelId === model.id ? styles.equipmentDropdownOptionActive : ''}`}
                          onClick={() => handleModelSelection(model.id)}
                        >
                          <span className={styles.modelOptionText}>{model.brandName} {model.modelName}</span>
                          <span className={styles.modelOptionMeta}>{formatTractorModelDetail(model)}</span>
                        </button>
                      ))
                    ) : (
                      <div className={styles.equipmentDropdownEmpty}>No matching model found.</div>
                    )}
                  </div>
                ) : null}
              </div>

              {modelsLoading ? <p className={styles.fieldHint}>Loading exact models...</p> : null}
              {!tractorModels.length && !modelsLoading ? <p className={styles.message}>No exact models found for this setup. Use {getSpecsLabel(selectedSector)} instead.</p> : null}
              {tractorModels.length > 0 && !filteredModels.length && !modelsLoading ? <p className={styles.message}>No matching model. Clear the search or choose another setup.</p> : null}
            </div>
          ) : null}
        </div>
      </div>
    );
  }

  function renderGenericModelPicker() {
    const selectedModelLabel = selectedGenericModel
      ? formatGenericModelLabel(selectedGenericModel)
      : genericModelMode === 'manual'
        ? 'Model not listed'
        : 'Choose model';
    const modelPickerTitle = genericModelRequired ? 'Choose the model' : 'Choose a catalogue model';
    const modelPickerHint = genericModelRequired
      ? 'Select the closest model from the catalogue. If the model is missing, choose Model not listed and enter it manually.'
      : 'Select the closest catalogue model to improve matching, or use Model not listed when the catalogue does not have it yet.';

    return (
      <div className={`${styles.currentCard} ${styles.tractorSetupCard}`} style={{ marginTop: '1rem' }}>
        <div className={styles.currentCardHead}>
          <div>
            <h3 className={styles.currentTitle}>{modelPickerTitle}</h3>
            <p className={styles.currentHint}>{modelPickerHint}</p>
          </div>
          <span className={styles.equipmentCountPill}>{genericModelsLoading ? 'Loading' : `${genericCatalogModels.length} models`}</span>
        </div>

        <div className={styles.tractorSetupProgress}>
          <div className={`${styles.inlineSetupGroup} ${styles.modelSetupGroup}`}>
            <div className={styles.inlineSetupHeader}>
              <span className={styles.fieldLabel}>Model</span>
              <strong>{selectedModelLabel}</strong>
            </div>

            <label className={`${styles.field} ${styles.searchPanel}`}>
              <span className={styles.fieldLabel}>Search catalogue models</span>
              <input
                className={styles.searchInput}
                value={genericModelQuery}
                onChange={(event) => {
                  setGenericModelQuery(event.target.value);
                  setGenericModelDropdownOpen(true);
                }}
                onFocus={() => setGenericModelDropdownOpen(true)}
                placeholder={selectedSector === 'motor' ? 'e.g. Hilux, Ranger, D-Max' : 'Search model name'}
                autoComplete="off"
              />
            </label>

            <div className={styles.equipmentDropdownWrap}>
              <button
                type="button"
                className={`${styles.equipmentDropdownTrigger} ${genericModelDropdownOpen || genericModelQuery ? styles.equipmentDropdownTriggerOpen : ''}`}
                onClick={() => setGenericModelDropdownOpen((value) => !value)}
                disabled={genericModelsLoading}
                aria-expanded={genericModelDropdownOpen}
              >
                <span>
                  {selectedGenericModel
                    ? formatGenericModelLabel(selectedGenericModel)
                    : genericModelsLoading
                      ? 'Loading catalogue models...'
                      : 'Select the closest model from the catalogue'}
                </span>
                <span className={styles.equipmentDropdownChevron} aria-hidden="true">
                  <svg viewBox="0 0 20 20" focusable="false">
                    <path d="M5.5 7.5 10 12l4.5-4.5" />
                  </svg>
                </span>
              </button>

              {genericModelDropdownOpen || genericModelQuery ? (
                <div className={styles.equipmentDropdownMenu}>
                  {filteredGenericModels.length ? (
                    filteredGenericModels.map((model) => (
                      <button
                        key={model.id}
                        type="button"
                        className={`${styles.equipmentDropdownOption} ${genericModelId === String(model.id) ? styles.equipmentDropdownOptionActive : ''}`}
                        onClick={() => handleGenericModelSelection(model.id)}
                      >
                        <span className={styles.modelOptionText}>{formatGenericModelLabel(model)}</span>
                        {selectedSector === 'motor' ? null : <span className={styles.modelOptionMeta}>{formatGenericModelDetail(model)}</span>}
                      </button>
                    ))
                  ) : (
                    <div className={styles.equipmentDropdownEmpty}>No matching catalogue model found.</div>
                  )}
                </div>
              ) : null}
            </div>

            <div className={styles.inlineOptionRow}>
              <button
                type="button"
                className={`${styles.inlineOptionButton} ${genericModelMode === 'manual' ? styles.inlineOptionButtonActive : ''}`}
                onClick={handleGenericModelNotListed}
              >
                Model not listed
              </button>
            </div>

            {genericModelsLoading ? <p className={styles.fieldHint}>Loading catalogue models...</p> : null}
            {!genericCatalogModels.length && !genericModelsLoading ? (
              <p className={styles.message}>No catalogue models found for this brand and {getAssetTypeLabel(selectedSector)}. Choose Model not listed and enter the model name.</p>
            ) : null}
            {genericCatalogModels.length > 0 && !filteredGenericModels.length && !genericModelsLoading ? (
              <p className={styles.message}>No matching catalogue model. Clear the search or choose Model not listed.</p>
            ) : null}

            {genericModelMode === 'manual' ? (
              <label className={styles.field}>
                <span className={styles.fieldLabel}>Enter model name</span>
                <input
                  value={typedModelName}
                  onChange={(event) => {
                    setTypedModelName(event.target.value);
                    resetResult();
                  }}
                  placeholder={selectedSector === 'motor' ? 'e.g. Hilux 2.4 GD-6' : 'Enter model name'}
                  required
                  autoComplete="off"
                />
                <span className={styles.fieldHint}>This will be saved as a model candidate for catalogue review.</span>
              </label>
            ) : null}
          </div>
        </div>
      </div>
    );
  }

  function renderCustomDropdownField(args: {
    dropdownKey: string;
    label: string;
    value: string;
    placeholder: string;
    options: DropdownOption[];
    onChange: (value: string) => void;
    helpText?: string | null;
  }) {
    const selectedOption = args.options.find((option) => option.value === args.value);
    const open = openSpecDropdownKey === args.dropdownKey;

    return (
      <div key={args.dropdownKey} className={styles.field}>
        <span className={styles.fieldLabel}>{args.label}</span>
        <div className={`${styles.equipmentDropdownWrap} ${styles.specDropdownWrap}`}>
          <button
            type="button"
            className={`${styles.equipmentDropdownTrigger} ${styles.specDropdownTrigger} ${open ? styles.equipmentDropdownTriggerOpen : ''}`}
            onClick={() => setOpenSpecDropdownKey((current) => current === args.dropdownKey ? null : args.dropdownKey)}
            aria-expanded={open}
          >
            <span>{selectedOption?.label ?? args.placeholder}</span>
            <span className={styles.equipmentDropdownChevron} aria-hidden="true">
              <svg viewBox="0 0 20 20" focusable="false">
                <path d="M5.5 7.5 10 12l4.5-4.5" />
              </svg>
            </span>
          </button>

          {open ? (
            <div className={`${styles.equipmentDropdownMenu} ${styles.specDropdownMenu}`}>
              <button
                type="button"
                className={`${styles.equipmentDropdownOption} ${styles.specDropdownOption} ${!args.value ? styles.equipmentDropdownOptionActive : ''}`}
                onClick={() => {
                  args.onChange('');
                  setOpenSpecDropdownKey(null);
                }}
              >
                <span>{args.placeholder}</span>
              </button>
              {args.options.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className={`${styles.equipmentDropdownOption} ${styles.specDropdownOption} ${args.value === option.value ? styles.equipmentDropdownOptionActive : ''}`}
                  onClick={() => {
                    args.onChange(option.value);
                    setOpenSpecDropdownKey(null);
                  }}
                >
                  <span>{option.label}</span>
                </button>
              ))}
            </div>
          ) : null}
        </div>
        {args.helpText ? <span className={styles.fieldHint}>{args.helpText}</span> : null}
      </div>
    );
  }

  function renderSpecInput(question: SpecQuestion) {
    const value = specAnswers[question.specKey] ?? '';
    const label = `${question.label}${question.unit ? ` (${question.unit})` : ''}${question.isRequired ? ' *' : ''}`;

    if (question.inputType === 'select') {
      return renderCustomDropdownField({
        dropdownKey: `spec-${question.specKey}`,
        label,
        value,
        placeholder: 'Choose...',
        options: question.options.map((option) => ({ value: option.optionValue, label: option.optionLabel })),
        onChange: (nextValue) => setSpecAnswer(question.specKey, nextValue),
        helpText: question.helpText,
      });
    }

    if (question.inputType === 'boolean') {
      return renderCustomDropdownField({
        dropdownKey: `spec-${question.specKey}`,
        label,
        value,
        placeholder: 'Choose...',
        options: [
          { value: 'true', label: 'Yes' },
          { value: 'false', label: 'No' },
        ],
        onChange: (nextValue) => setSpecAnswer(question.specKey, nextValue),
        helpText: question.helpText,
      });
    }

    return (
      <label key={question.specKey} className={styles.field}>
        <span className={styles.fieldLabel}>{label}</span>
        <input
          type="text"
          inputMode={question.inputType === 'number' || question.inputType === 'money' ? 'decimal' : undefined}
          value={value}
          onChange={(event: ChangeEvent<HTMLInputElement>) => setSpecAnswer(question.specKey, event.target.value)}
          placeholder={question.helpText ?? question.label}
        />
        {question.helpText ? <span className={styles.fieldHint}>{question.helpText}</span> : null}
      </label>
    );
  }

  function getYearAnswerLabel(): string {
    if (!yearStepComplete) return 'Not answered';
    if (yearModelUnknown) return 'I do not know the year';
    return year;
  }

  function getUsageAnswerLabel(showHoursInput: boolean): string {
    if (!usageStepComplete) return 'Not answered';
    const usage = toNumberOrNull(usageAmount);
    if (showHoursInput && usage !== null) return `${usage.toLocaleString('en-ZA')} ${selectedUsageShortUnit}`;
    const workedPercent = toPercentOrNull(lifeWorkedPercent);
    if (workedPercent !== null) return `${workedPercent}% worked`;
    return 'Not answered';
  }

  function openUsageModal(showHoursInput: boolean) {
    setUsageModalMode(showHoursInput ? 'hours' : 'percent');
    setActiveDetailsModal('usage');
    setMessage('');
  }

  function saveYearFromInput() {
    const parsedYear = Number(year);
    if (!Number.isInteger(parsedYear) || parsedYear < 1950 || parsedYear > CURRENT_YEAR) {
      setMessage(`Choose a year between 1950 and ${CURRENT_YEAR}.`);
      return;
    }

    setYear(String(parsedYear));
    setYearModelUnknown(false);
    setYearStepComplete(true);
    setActiveDetailsModal(null);
    setMessage('');
    resetResult();
  }

  function saveUnknownYear() {
    setYear(String(CURRENT_YEAR));
    setYearModelUnknown(true);
    setYearStepComplete(true);
    setActiveDetailsModal(null);
    setMessage('');
    resetResult();
  }

  function saveUsageAnswer(showHoursInput: boolean) {
    if (usageModalMode === 'hours' && showHoursInput) {
      const hours = toNumberOrNull(usageAmount);
      if (hours === null) {
        setMessage(`Enter the ${selectedUsageFieldLabel.toLowerCase()}, or choose that you do not know it.`);
        return;
      }

      setUsageAmount(String(Math.round(hours)));
      setLifeWorkedPercent('');
      setUsageStepComplete(true);
      setActiveDetailsModal(null);
      setMessage('');
      resetResult();
      return;
    }

    const workedPercent = toPercentOrNull(lifeWorkedPercent) ?? 50;

    setLifeWorkedPercent(String(workedPercent));
    setUsageAmount('');
    setUsageStepComplete(true);
    setActiveDetailsModal(null);
    setMessage('');
    resetResult();
  }

  function renderYearModal() {
    const parsedYear = Number(year);
    const sliderYear = !yearModelUnknown && Number.isInteger(parsedYear) && parsedYear >= 1950 && parsedYear <= CURRENT_YEAR
      ? parsedYear
      : CURRENT_YEAR;
    const machineAge = Math.max(0, CURRENT_YEAR - sliderYear);
    const yearSliderProgress = ((sliderYear - 1950) / Math.max(1, CURRENT_YEAR - 1950)) * 100;
    const yearSliderStyle = { '--year-progress': `${yearSliderProgress}%` } as CSSProperties;

    return (
      <div className={styles.detailsModalOverlay} role="dialog" aria-modal="true" aria-label={`Choose ${getAssetNounLabel(selectedSector)} manufacturing year`}>
        <button type="button" className={styles.detailsModalBackdrop} aria-label="Close" onClick={() => setActiveDetailsModal(null)} />
        <div className={`${styles.detailsModal} ${styles.yearDetailsModal}`}>
          <div className={styles.detailsModalHeader}>
            <div>
              <span className={styles.currentEyebrow}>Step 1</span>
              <h3 className={styles.detailsModalTitle}>{getAssetNounTitle(selectedSector)} manufacturing year</h3>
              <p className={styles.detailsModalText}>Slide to the year, fine-tune it if needed, then continue.</p>
            </div>
            <button type="button" className={styles.saveModalClose} onClick={() => setActiveDetailsModal(null)} aria-label="Close">
              ×
            </button>
          </div>

          <div className={styles.yearSliderPanel}>
            <div className={styles.yearSliderReadout}>
              <span>Selected year</span>
              <strong>{sliderYear}</strong>
              <small>{machineAge === 0 ? 'Current model year' : `${machineAge} year${machineAge === 1 ? '' : 's'} old`}</small>
            </div>

            <label className={styles.yearSliderControl}>
              <span className={styles.fieldLabel}>Slide to year</span>
              <input
                className={styles.yearRangeInput}
                style={yearSliderStyle}
                type="range"
                min="1950"
                max={CURRENT_YEAR}
                step="1"
                value={sliderYear}
                onChange={(event) => {
                  setYear(event.target.value);
                  setYearModelUnknown(false);
                  setMessage('');
                }}
              />
              <span className={styles.yearSliderMeta}>
                <span>1950</span>
                <span>{CURRENT_YEAR}</span>
              </span>
            </label>

            <div className={styles.yearFineTuneRow}>
              <button
                type="button"
                className={styles.yearFineTuneButton}
                onClick={() => {
                  setYear(String(Math.max(1950, sliderYear - 1)));
                  setYearModelUnknown(false);
                  setMessage('');
                }}
              >
                − 1 year
              </button>
              <button
                type="button"
                className={styles.yearFineTuneButton}
                onClick={() => {
                  setYear(String(Math.min(CURRENT_YEAR, sliderYear + 1)));
                  setYearModelUnknown(false);
                  setMessage('');
                }}
              >
                + 1 year
              </button>
            </div>
          </div>

          <div className={styles.yearSecondaryControls}>
            <label className={`${styles.field} ${styles.modalInputField} ${styles.manualYearField}`}>
              <span className={styles.fieldLabel}>Or type the year</span>
              <input
                type="text"
                inputMode="numeric"
                value={yearModelUnknown ? '' : year}
                onChange={(event) => {
                  setYear(event.target.value);
                  setYearModelUnknown(false);
                  setMessage('');
                }}
                placeholder={`e.g. ${CURRENT_YEAR}`}
              />
            </label>

            <button type="button" className={`${styles.unknownAnswerButton} ${styles.unknownDangerButton}`} onClick={saveUnknownYear}>
              I do not know the year
            </button>
          </div>

          {message ? <p className={styles.modalMessage}>{message}</p> : null}

          <div className={styles.detailsModalActions}>
            <button type="button" className={styles.secondaryButton} onClick={() => setActiveDetailsModal(null)}>
              Cancel
            </button>
            <button type="button" className={styles.primaryButton} onClick={saveYearFromInput}>
              Use this year
            </button>
          </div>
        </div>
      </div>
    );
  }

  function renderUsageModal(showHoursInput: boolean) {
    const percentageValue = toPercentOrNull(lifeWorkedPercent) ?? 50;

    return (
      <div className={styles.detailsModalOverlay} role="dialog" aria-modal="true" aria-label={`Enter ${getAssetNounLabel(selectedSector)} usage`}>
        <button type="button" className={styles.detailsModalBackdrop} aria-label="Close" onClick={() => setActiveDetailsModal(null)} />
        <div className={styles.detailsModal}>
          <div className={styles.detailsModalHeader}>
            <div>
              <span className={styles.currentEyebrow}>Step 2</span>
              <h3 className={styles.detailsModalTitle}>{usageModalMode === 'hours' && showHoursInput ? selectedUsageFieldLabel : 'Worked percentage'}</h3>
              <p className={styles.detailsModalText}>
                {usageModalMode === 'hours' && showHoursInput
                  ? selectedUsageDisplayUnit === 'km' ? 'Enter the odometer kilometres if they are available.' : 'Enter the engine or equipment hours if they are available.'
                  : `Estimate how much of the ${getAssetNounLabel(selectedSector)}'s working life has already been used.`}
              </p>
            </div>
            <button type="button" className={styles.saveModalClose} onClick={() => setActiveDetailsModal(null)} aria-label="Close">
              ×
            </button>
          </div>

          {usageModalMode === 'hours' && showHoursInput ? (
            <>
              <label className={`${styles.field} ${styles.modalInputField}`}>
                <span className={styles.fieldLabel}>Enter {selectedUsageFieldLabel.toLowerCase()}</span>
                <input
                  type="text"
                  inputMode="numeric"
                  value={usageAmount}
                  onChange={(event) => setUsageAmount(event.target.value)}
                  placeholder={selectedUsageDisplayUnit === 'km' ? 'e.g. 196000' : 'e.g. 3500'}
                />
              </label>

              <button
                type="button"
                className={`${styles.unknownAnswerButton} ${styles.unknownDangerButton}`}
                onClick={() => {
                  setUsageAmount('');
                  setUsageModalMode('percent');
                }}
              >
                {getUnknownUsageButtonLabel(selectedSector, selectedFamily?.usageMetricType)}
              </button>
            </>
          ) : (
            <>
              <label className={`${styles.field} ${styles.modalInputField}`}>
                <span className={styles.fieldLabel}>Worked percentage</span>
                <input
                  type="text"
                  inputMode="decimal"
                  value={lifeWorkedPercent}
                  onChange={(event) => setLifeWorkedPercent(event.target.value)}
                  placeholder="e.g. 50"
                />
              </label>

              <input
                className={styles.percentSlider}
                type="range"
                min="0"
                max="100"
                value={percentageValue}
                onChange={(event) => setLifeWorkedPercent(event.target.value)}
              />
              <div className={styles.percentScale}>
                <span>0% almost new</span>
                <strong>{percentageValue}%</strong>
                <span>100% fully used</span>
              </div>

              {showHoursInput ? (
                <button type="button" className={styles.unknownAnswerButton} onClick={() => setUsageModalMode('hours')}>
                  {getKnownUsageButtonLabel(selectedSector, selectedFamily?.usageMetricType)}
                </button>
              ) : null}
            </>
          )}

          {message ? <p className={styles.modalMessage}>{message}</p> : null}

          <div className={styles.detailsModalActions}>
            <button type="button" className={styles.secondaryButton} onClick={() => setActiveDetailsModal(null)}>
              Cancel
            </button>
            <button type="button" className={styles.primaryButton} onClick={() => saveUsageAnswer(showHoursInput)}>
              Save answer
            </button>
          </div>
        </div>
      </div>
    );
  }

  function renderSpecQuestionsProgress() {
    if (!conditionStepComplete) return null;

    if (!specQuestions.length) {
      return (
        <div className={`${styles.currentCard} ${styles.specProgressCard}`}>
          <h3 className={styles.currentTitle}>Answer a few simple questions</h3>
          <p className={styles.message}>No family-specific questions imported yet. Aim4price will use year, condition, worked percentage, brand and replacement bands if available.</p>
        </div>
      );
    }

    const visibleQuestions: SpecQuestion[] = [];
    for (const question of specQuestions) {
      visibleQuestions.push(question);
      if (question.isRequired && !isSpecQuestionAnswered(question, specAnswers[question.specKey])) break;
    }

    const requiredAnswered = specQuestions.every((question) => !question.isRequired || isSpecQuestionAnswered(question, specAnswers[question.specKey]));

    return (
      <div className={`${styles.currentCard} ${styles.specProgressCard}`}>
        <div className={styles.currentCardHead}>
          <div>
            <span className={styles.currentEyebrow}>Step 4</span>
            <h3 className={styles.currentTitle}>Answer a few simple questions</h3>
            <p className={styles.currentHint}>Answer each question in order. The next question appears underneath once the required answer is captured.</p>
          </div>
          <span className={styles.selectedSummaryPill}>{visibleQuestions.length} of {specQuestions.length}</span>
        </div>

        <div className={styles.progressiveQuestionStack}>
          {visibleQuestions.map((question, index) => {
            const answered = isSpecQuestionAnswered(question, specAnswers[question.specKey]);
            return (
              <div key={question.specKey} className={`${styles.progressiveQuestionCard} ${answered ? styles.progressiveQuestionCardDone : ''}`}>
                <div className={styles.progressiveQuestionHeader}>
                  <span className={`${styles.specStepNumber} ${answered ? styles.specStepNumberDone : ''}`}>{answered ? '✓' : index + 1}</span>
                  <div className={styles.progressiveQuestionTitleWrap}>
                    <strong>{question.label}{question.isRequired ? ' *' : ''}</strong>
                    <span>{answered ? getSpecQuestionAnswerLabel(question, specAnswers[question.specKey]) : question.helpText ?? 'Choose the closest available answer.'}</span>
                  </div>
                </div>
                {renderSpecInput(question)}
              </div>
            );
          })}
        </div>

        {requiredAnswered ? <p className={styles.completionHint}>Required questions completed. You can now get the estimate.</p> : null}
      </div>
    );
  }

  function renderDetailsStep() {
    const genericPath = flowMode === 'generic_specs';
    const selfPropelled = selectedFamily?.isPropelled || selectedFamily?.usageMetricType === 'hours' || selectedFamily?.usageMetricType === 'km';
    const showHoursInput = !genericPath || selfPropelled;
    const usageTitle = showHoursInput ? selectedUsageFieldLabel : 'Worked percentage';

    return (
      <div>
        <h2 className={styles.stepTitle}>{genericPath ? getSpecsTitle(selectedSector) : 'Tractor details'}</h2>
        <p className={styles.stepText}>Answer one step at a time. Aim4price only reveals the next question after the current one is saved.</p>

        <div className={styles.specFlowStack}>
          <button
            type="button"
            className={`${styles.specStepCard} ${styles.specStepCardHero} ${yearStepComplete ? styles.specStepCardComplete : styles.specStepCardActive}`}
            onClick={() => {
              setActiveDetailsModal('year');
              setMessage('');
            }}
          >
            <span className={`${styles.specStepNumber} ${yearStepComplete ? styles.specStepNumberDone : ''}`}>{yearStepComplete ? '✓' : 1}</span>
            <span className={styles.specStepContent}>
              <strong>{getAssetNounTitle(selectedSector)} manufacturing year</strong>
              <small>{yearStepComplete ? getYearAnswerLabel() : 'Choose the manufacturing year to start.'}</small>
            </span>
            <span className={styles.specStepAction}>{yearStepComplete ? 'Edit' : 'Choose year'}</span>
          </button>

          {yearStepComplete ? (
            <button
              type="button"
              className={`${styles.specStepCard} ${usageStepComplete ? styles.specStepCardComplete : styles.specStepCardActive}`}
              onClick={() => openUsageModal(showHoursInput)}
            >
              <span className={`${styles.specStepNumber} ${usageStepComplete ? styles.specStepNumberDone : ''}`}>{usageStepComplete ? '✓' : 2}</span>
              <span className={styles.specStepContent}>
                <strong>{usageTitle}</strong>
                <small>{usageStepComplete ? getUsageAnswerLabel(showHoursInput) : `Add ${usageTitle.toLowerCase()} to continue.`}</small>
              </span>
              <span className={styles.specStepAction}>{usageStepComplete ? 'Edit' : 'Add details'}</span>
            </button>
          ) : null}

          {usageStepComplete ? (
            <div className={`${styles.currentCard} ${styles.conditionStepCard}`}>
              <div className={styles.currentCardHead}>
                <div>
                  <span className={styles.currentEyebrow}>Step 3</span>
                  <h3 className={styles.currentTitle}>Condition</h3>
                  <p className={styles.currentHint}>Choose the closest current condition.</p>
                </div>
                {conditionStepComplete ? <span className={styles.selectedSummaryPill}>{conditionLabel(condition)}</span> : <span className={styles.selectedSummaryPill}>Choose one</span>}
              </div>

              <div className={styles.conditionButtonGrid}>
                {conditionOptions.map((option) => (
                  <button
                    key={option.key}
                    type="button"
                    className={`${styles.conditionChoiceButton} ${conditionStepComplete && condition === option.key ? styles.conditionChoiceButtonActive : ''}`}
                    onClick={() => {
                      setCondition(option.key);
                      setConditionStepComplete(true);
                      resetResult();
                    }}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
          ) : null}
          {conditionStepComplete && genericPath ? renderSpecQuestionsProgress() : null}
        </div>

        {!genericPath && conditionStepComplete ? (
          <div className={styles.currentCard} style={{ marginTop: '1rem' }}>
            <h3 className={styles.currentTitle}>Tractor extras</h3>
            <div className={styles.choiceGrid}>
              <button type="button" className={`${styles.choiceCard} ${frontPto ? styles.choiceCardActive : ''}`} onClick={() => setFrontPto((value) => !value)}>
                <strong>Front PTO</strong>
                <span className={styles.choiceCardNote}>Front hitch / PTO fitted</span>
              </button>
              <button type="button" className={`${styles.choiceCard} ${frontLoader ? styles.choiceCardActive : ''}`} onClick={() => setFrontLoader((value) => !value)}>
                <strong>Front Loader</strong>
                <span className={styles.choiceCardNote}>Loader fitted</span>
              </button>
              <button type="button" className={`${styles.choiceCard} ${gpsEnabled ? styles.choiceCardActive : ''}`} onClick={() => setGpsEnabled((value) => !value)}>
                <strong>GPS</strong>
                <span className={styles.choiceCardNote}>Guidance or autosteer</span>
              </button>
            </div>
            {gpsEnabled ? (
              <div className={styles.inputGrid} style={{ marginTop: '1rem' }}>
                <div className={styles.field}>
                  <span className={styles.fieldLabel}>GPS type</span>
                  <div className={`${styles.equipmentDropdownWrap} ${styles.specDropdownWrap}`}>
                    <button
                      type="button"
                      className={`${styles.equipmentDropdownTrigger} ${styles.specDropdownTrigger} ${gpsTypeDropdownOpen ? styles.equipmentDropdownTriggerOpen : ''}`}
                      onClick={() => setGpsTypeDropdownOpen((open) => !open)}
                      aria-expanded={gpsTypeDropdownOpen}
                    >
                      <span>{getGpsTypeLabel(gpsType)}</span>
                      <span className={styles.equipmentDropdownChevron} aria-hidden="true">
                        <svg viewBox="0 0 20 20" focusable="false">
                          <path d="M5.5 7.5 10 12l4.5-4.5" />
                        </svg>
                      </span>
                    </button>
                    {gpsTypeDropdownOpen ? (
                      <div className={`${styles.equipmentDropdownMenu} ${styles.specDropdownMenu}`}>
                        {GPS_TYPE_OPTIONS.map((option) => (
                          <button
                            key={option.value}
                            type="button"
                            className={`${styles.equipmentDropdownOption} ${styles.specDropdownOption} ${gpsType === option.value ? styles.equipmentDropdownOptionActive : ''}`}
                            onClick={() => {
                              setGpsType(option.value);
                              setGpsTypeDropdownOpen(false);
                            }}
                          >
                            <span>{option.label}</span>
                          </button>
                        ))}
                      </div>
                    ) : null}
                  </div>
                </div>
                <label className={styles.field}>
                  <span className={styles.fieldLabel}>GPS year</span>
                  <input value={gpsYear} onChange={(event) => setGpsYear(event.target.value)} placeholder="Optional" />
                </label>
              </div>
            ) : null}
          </div>
        ) : null}

        {activeDetailsModal === 'year' ? renderYearModal() : null}
        {activeDetailsModal === 'usage' ? renderUsageModal(showHoursInput) : null}
      </div>
    );
  }

  function renderResultStep() {
    if (!resultState) {
      return (
        <div>
          <h2 className={styles.stepTitle}>No estimate yet</h2>
          <p className={styles.stepText}>Go back and calculate an estimate first.</p>
        </div>
      );
    }

    const isGeneric = resultState.kind === 'generic';
    const genericResult = isGeneric ? resultState.result : null;
    const tractorResult = resultState.kind === 'tractor' ? resultState.result : null;
    const genericSelectedCalculation = genericResult ? getGenericCalculation(genericResult, replacementPriceBasis) : null;
    const aimValue = isGeneric
      ? genericSelectedCalculation?.valuationMidExVat ?? null
      : tractorResult?.aim4priceValueExVat ?? null;
    const userPriceInput = parseMoneyInput(userReplacementPrice);
    const confidenceContext: ConfidenceContext = {
      selectedMethod,
      yearKnown: !yearModelUnknown,
      hoursKnown: usageNumber !== null,
      workedPercentKnown: lifeWorkedPercentNumber !== null && usageNumber === null,
      usageSentenceLabel: selectedUsageSentenceLabel,
      marketUsageToleranceLabel: selectedMarketUsageToleranceLabel,
    };
    const confidenceText = getConfidenceLabel(resultState, confidenceContext);
    const confidenceNote = getConfidenceNote(resultState, confidenceContext);
    const resultHeroTone = confidenceText.toLowerCase().includes('high')
      ? styles.resultHeroHigh
      : confidenceText.toLowerCase().includes('medium')
        ? styles.resultHeroMedium
        : styles.resultHeroLow;
    const genericModelNameForResult = genericResult?.typedModelName || getGenericModelSubmitName(selectedGenericModel) || normalizeText(typedModelName);
    const machineTitle = isGeneric
      ? `${genericResult?.family.label ?? getAssetNounTitle(selectedSector)} • ${genericResult?.brand.name ?? 'Brand'}${genericModelNameForResult ? ` • ${genericModelNameForResult}` : ''}`
      : `${tractorResult?.model.brandName ?? ''} ${tractorResult?.model.modelName ?? ''}`.trim();
    const resultCondition = isGeneric ? genericResult?.condition ?? condition : condition;
    const resultYear = isGeneric ? genericResult?.year ?? yearNumber : yearModelUnknown ? CURRENT_YEAR : yearNumber;
    const yearSummary = yearModelUnknown ? 'Unknown' : String(resultYear);
    const resultUsageShortUnit = isGeneric && genericResult
      ? getUsageShortUnit(genericResult.sector.key, genericResult.family.usageMetricType)
      : 'hours';
    const usageSummary = isGeneric && genericSelectedCalculation
      ? `${formatPercent(genericSelectedCalculation.lifeWorkedPercent)} worked${genericSelectedCalculation.estimatedHours ? ` • ${genericSelectedCalculation.estimatedHours.toLocaleString('en-ZA')} estimated ${resultUsageShortUnit}` : ''}`
      : usageNumber
        ? `${usageNumber.toLocaleString('en-ZA')} ${resultUsageShortUnit}`
        : lifeWorkedPercentNumber !== null
          ? `${formatPercent(lifeWorkedPercentNumber)} worked`
          : 'Usage captured';
    const tractorReplacementBasisText = tractorResult?.userReplacementPriceExVat && replacementPriceBasis === 'user'
      ? `Current basis: your replacement price of ${money(tractorResult.userReplacementPriceExVat)}`
      : `Current basis: saved replacement price of ${money(tractorResult?.replacementPriceUsedExVat ?? tractorResult?.model.aim4priceReplacementExVat ?? null)}`;
    const genericReplacementBasisText = genericResult?.userReplacementCalculation && replacementPriceBasis === 'user'
      ? `Current basis: your replacement price of ${money(genericResult.userReplacementCalculation.replacementPriceExVat)}`
      : `Current basis: saved replacement estimate of ${money(genericResult?.aim4priceReplacementCalculation?.replacementPriceExVat ?? null)}`;
    const replacementBasisText = isGeneric ? genericReplacementBasisText : tractorReplacementBasisText;
    const resultValueSizeClass = getResultValueSizeClass(headlineValue);
    return (
      <div className={styles.resultsLayout}>
        <div className={styles.resultsMain}>
          <section className={`${styles.resultHero} ${resultHeroTone}`}>
            <div className={styles.resultHeroTopline}>
              <span className={styles.resultKicker}>Aim4price estimate</span>
              <span className={`${styles.resultConfidenceBadge} ${getConfidenceClass(resultState, confidenceContext)}`}>{confidenceText}</span>
            </div>
            <div className={`${styles.resultValueLine} ${resultValueSizeClass}`}>
              <strong className={styles.resultValue}>{money(headlineValue)}</strong>
              {headlineValue !== null ? <span className={styles.resultVatLabel}>+ VAT</span> : null}
            </div>
            <p className={styles.resultMachineTitle}>{machineTitle}</p>
            <p className={styles.resultConfidenceNote}>{confidenceNote}</p>
            <div className={styles.resultFactsGrid}>
              <div className={styles.resultFactCard}>
                <span>Year model</span>
                <strong>{yearSummary}</strong>
              </div>
              <div className={styles.resultFactCard}>
                <span>Usage</span>
                <strong>{usageSummary}</strong>
              </div>
              <div className={styles.resultFactCard}>
                <span>Condition</span>
                <strong>{conditionLabel(resultCondition)}</strong>
              </div>
            </div>
          </section>

          {(isGeneric && genericResult) || tractorResult ? (
            <section className={styles.resultAccordion}>
              <button
                type="button"
                className={styles.resultAccordionToggle}
                onClick={() => setReplacementPanelOpen((open) => !open)}
                aria-expanded={replacementPanelOpen}
              >
                <span className={styles.resultAccordionTitleGroup}>
                  <strong>Replacement price check</strong>
                  <small>{replacementBasisText}</small>
                </span>
                <span className={styles.resultAccordionAction}>{replacementPanelOpen ? 'Hide' : 'Check / adjust'}</span>
              </button>

              {replacementPanelOpen ? (
                <div className={styles.resultAccordionBody}>
                  <p className={styles.resultAccordionCopy}>
                    Aim4price uses the saved replacement price immediately. Only change it here if you want to update the replacement price and recalculate before saving the asset.
                  </p>

                  {isGeneric && genericResult ? (
                    <div className={styles.replacementOptionGrid}>
                      <button
                        type="button"
                        className={`${styles.replacementOptionCard} ${replacementPriceBasis === 'aim4price' ? styles.replacementOptionCardActive : ''}`}
                        onClick={() => {
                          setReplacementPriceBasis('aim4price');
                          setSelectedMethod('aim4price');
                        }}
                      >
                        <span>Saved price basis</span>
                        <strong>{money(genericResult.aim4priceReplacementCalculation?.valuationMidExVat ?? null)}</strong>
                        <small>New price used: {money(genericResult.aim4priceReplacementCalculation?.replacementPriceExVat ?? null)}</small>
                      </button>

                      <button
                        type="button"
                        className={`${styles.replacementOptionCard} ${replacementPriceBasis === 'user' ? styles.replacementOptionCardActive : ''}`}
                        onClick={() => {
                          if (genericResult.userReplacementCalculation) {
                            setReplacementPriceBasis('user');
                            setSelectedMethod('aim4price');
                          }
                        }}
                        disabled={!genericResult.userReplacementCalculation}
                      >
                        <span>Updated price basis</span>
                        <strong>{money(genericResult.userReplacementCalculation?.valuationMidExVat ?? null)}</strong>
                        <small>New price used: {money(genericResult.userReplacementCalculation?.replacementPriceExVat ?? null)}</small>
                      </button>
                    </div>
                  ) : tractorResult ? (
                    <div className={styles.replacementOptionGrid}>
                      <button
                        type="button"
                        className={`${styles.replacementOptionCard} ${replacementPriceBasis === 'aim4price' ? styles.replacementOptionCardActive : ''}`}
                        onClick={() => {
                          setUserReplacementPrice('');
                          void calculateTractorWithReplacementPrice(null);
                        }}
                      >
                        <span>Saved price basis</span>
                        <strong>{money(replacementPriceBasis === 'aim4price' ? tractorResult.aim4priceValueExVat : null)}</strong>
                        <small>New price used: {money(tractorResult.model.aim4priceReplacementExVat)}</small>
                      </button>

                      <button
                        type="button"
                        className={`${styles.replacementOptionCard} ${replacementPriceBasis === 'user' ? styles.replacementOptionCardActive : ''}`}
                        onClick={() => {
                          if (tractorResult.userReplacementPriceExVat) {
                            setSelectedMethod('aim4price');
                            setReplacementPriceBasis('user');
                          }
                        }}
                        disabled={!tractorResult.userReplacementPriceExVat}
                      >
                        <span>Updated price basis</span>
                        <strong>{money(replacementPriceBasis === 'user' ? tractorResult.aim4priceValueExVat : null)}</strong>
                        <small>New price used: {money(tractorResult.userReplacementPriceExVat ?? null)}</small>
                      </button>
                    </div>
                  ) : null}

                  <div className={styles.replacementInputPanel}>
                    <label className={styles.field}>
                      <span className={styles.fieldLabel}>Updated replacement price excl. VAT</span>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={userReplacementPrice}
                        onChange={(event) => setUserReplacementPrice(event.target.value)}
                        placeholder="Optional, ex VAT"
                      />
                    </label>
                    <button
                      type="button"
                      className={styles.assetButton}
                      disabled={!userPriceInput || replacementRecalculateLoading}
                      onClick={() => {
                        if (!userPriceInput) return;
                        if (isGeneric) {
                          void calculateGenericWithReplacementPrice(userPriceInput);
                        } else {
                          void calculateTractorWithReplacementPrice(userPriceInput);
                        }
                      }}
                    >
                      {replacementRecalculateLoading ? 'Recalculating...' : 'Update and recalculate'}
                    </button>
                  </div>
                </div>
              ) : null}
            </section>
          ) : null}
        </div>

        <aside className={styles.resultsSide}>
          <section className={styles.resultFinalActions} aria-label="Estimate actions">
            <div className={styles.resultFinalActionsCopy}>
              <span>Estimate actions</span>
              <h3>Next steps</h3>
              <p>Download the estimate PDF, send the asset to Marketplace, or save it to your Asset Register.</p>
            </div>

            <div className={styles.resultFinalActionsButtons}>
              <button
                type="button"
                className={styles.resultPdfActionButton}
                onClick={downloadValuationPdf}
                disabled={pdfLoading || !resultState || headlineValue === null}
              >
                {pdfLoading ? 'Preparing PDF...' : 'Download PDF'}
              </button>
              {isSignedIn ? (
                <>
                  <button
                    type="button"
                    className={styles.resultAlternateActionButton}
                    onClick={saveAndSendToMarketplace}
                    disabled={saveLoading || isPublishingMarketplace || replacementRecalculateLoading || !canUseMarketplacePublishFlow || headlineValue === null}
                  >
                    {saveLoading && finalSaveIntent === 'marketplace' ? 'Saving...' : isPublishingMarketplace ? 'Sending...' : 'Send to Marketplace'}
                  </button>
                  <button
                    type="button"
                    className={styles.resultPrimaryActionButton}
                    onClick={saveToAssetRegister}
                    disabled={saveLoading || isPublishingMarketplace || replacementRecalculateLoading || !canSaveToAssetRegister || headlineValue === null}
                  >
                    {saveLoading && finalSaveIntent === 'asset-register' ? 'Saving...' : 'Save to Asset Register'}
                  </button>
                </>
              ) : (
                <div className={styles.resultSignedOutNotice}>
                  <p>Sign in to save this estimate to your Asset Register or send it to Marketplace.</p>
                </div>
              )}
            </div>

            {pdfError ? <p className={styles.resultActionError}>{pdfError}</p> : null}
          </section>
        </aside>
      </div>
    );
  }

  function renderStepBody() {
    if (step === 1) return renderMachineStep();
    if (step === 2) return renderBrandStep();
    if (step === 3) return renderPathStep();
    if (step === 4) return renderDetailsStep();
    return renderResultStep();
  }

  const finalSaveReplacementPrice = getCurrentResultReplacementPriceExVat();
  const finalSaveInputPrice = parseMoneyInput(userReplacementPrice);
  const finalSaveHasPendingReplacementPrice = hasPendingReplacementPriceInput();
  const finalSaveCanConfirm =
    finalSaveReplacementPrice !== null &&
    Number.isFinite(finalSaveReplacementPrice) &&
    finalSaveReplacementPrice > 0 &&
    !finalSaveHasPendingReplacementPrice;
  const finalSaveTitle = finalSaveIntent === 'marketplace' ? 'Send to Marketplace' : 'Save to Asset Register';
  const finalSaveCta = finalSaveIntent === 'marketplace' ? 'Save and continue to Marketplace' : 'Confirm and save';
  const isSectorIntroStep = step === 1 && !selectedSector;

  return (
    <main className={styles.page}>
      <AppHeader active="valuation" />
      <div className={styles.container}>
        <section className={`${styles.wizardShell} ${isSectorIntroStep ? styles.sectorWizardShell : ''}`}>
          <div id="valuation-wizard-card" className={`${styles.wizardCard} ${isSectorIntroStep ? styles.sectorWizardCard : ''}`}>
            {step > 1 ? (
              <div className={styles.wizardHeader}>
                <div className={styles.stepper}>
                  {WIZARD_STEPS.map((item) => {
                    const active = item.step === step;
                    const complete = item.step < step;
                    return (
                      <div key={item.step} className={`${styles.stepperItem} ${active ? styles.stepperItemActive : ''} ${complete ? styles.stepperItemComplete : ''}`}>
                        <span className={`${styles.stepperBullet} ${active ? styles.stepperBulletActive : ''} ${complete ? styles.stepperBulletComplete : ''}`}>
                          {complete ? '✓' : item.step}
                        </span>
                        <span className={`${styles.stepperLabel} ${active ? styles.stepperLabelActive : ''} ${complete ? styles.stepperLabelComplete : ''}`}>{item.step === 1 ? getAssetNounTitle(selectedSector) : item.label}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : null}

            <div className={`${styles.stepContent} ${isSectorIntroStep ? styles.sectorStepContent : ''}`}>
              {renderStepBody()}
              {message ? <div className={styles.message}>{message}</div> : null}
            </div>

            <div className={`${styles.wizardFooter} ${step === 1 ? styles.wizardFooterSingle : ''}`}>
              <button type="button" className={styles.secondaryButton} onClick={handleBack} disabled={valuationLoading || saveLoading}>
                Back
              </button>
              {step === 1 ? null : step === 5 ? (
                <button
                  type="button"
                  className={styles.secondaryButton}
                  onClick={resetToSectorSelection}
                  disabled={saveLoading || isPublishingMarketplace || replacementRecalculateLoading}
                >
                  New estimate
                </button>
              ) : (
                <button
                  type="button"
                  className={styles.primaryButton}
                  onClick={handleNext}
                  disabled={valuationLoading || (step === 2 && (brandsLoading || !selectedBrand))}
                >
                  {valuationLoading ? 'Calculating...' : step === 4 ? 'Get Estimate' : 'Continue'}
                </button>
              )}
            </div>
          </div>
        </section>
      </div>

      {finalSaveIntent ? (
        <div className={styles.finalSaveOverlay} onClick={closeFinalSaveModal}>
          <section
            className={styles.finalSaveModal}
            role="dialog"
            aria-modal="true"
            aria-labelledby="final-save-title"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              className={styles.finalSaveClose}
              onClick={closeFinalSaveModal}
              aria-label="Close final save step"
              disabled={saveLoading || replacementRecalculateLoading}
            >
              ×
            </button>

            <div className={styles.finalSaveHeader}>
              <span>Final save step</span>
              <h2 id="final-save-title">{finalSaveTitle}</h2>
              <p>
                The saved/model replacement price is used by default. Change it only if it needs to become the official saved replacement price.
              </p>
            </div>

            <div className={styles.finalSaveSummaryGrid}>
              <div className={styles.finalSaveSummaryCard}>
                <span>Current value excl. VAT</span>
                <strong>{money(headlineValue)}</strong>
              </div>
              <div className={styles.finalSaveSummaryCard}>
                <span>Replacement price excl. VAT</span>
                <strong>{money(finalSaveReplacementPrice)}</strong>
              </div>
            </div>

            <div className={styles.finalReplacementPanel}>
              <label className={styles.finalReplacementField}>
                <span>Confirm or update replacement price excl. VAT</span>
                <div className={styles.finalReplacementCurrencyInput}>
                  <span>R</span>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={userReplacementPrice}
                    onChange={(event) => setUserReplacementPrice(event.target.value)}
                    placeholder={finalSaveReplacementPrice ? String(Math.round(finalSaveReplacementPrice)) : 'Enter replacement price'}
                  />
                </div>
              </label>
              <button
                type="button"
                className={styles.finalReplacementRecalculateButton}
                onClick={recalculateFinalReplacementPrice}
                disabled={!finalSaveInputPrice || replacementRecalculateLoading || saveLoading}
              >
                {replacementRecalculateLoading ? 'Recalculating...' : 'Update and recalculate'}
              </button>
            </div>

            {finalSaveHasPendingReplacementPrice ? (
              <p className={styles.finalSaveWarning}>
                You changed the replacement price input. Click Update and recalculate before saving or listing this asset.
              </p>
            ) : null}

            {finalSaveError ? <p className={styles.finalSaveError}>{finalSaveError}</p> : null}

            <div className={styles.finalSaveActions}>
              <button
                type="button"
                className={styles.secondaryButton}
                onClick={closeFinalSaveModal}
                disabled={saveLoading || replacementRecalculateLoading}
              >
                Close
              </button>
              <button
                type="button"
                className={styles.primaryButton}
                onClick={confirmFinalSaveAction}
                disabled={saveLoading || replacementRecalculateLoading || !finalSaveCanConfirm}
              >
                {saveLoading ? 'Saving...' : finalSaveCta}
              </button>
            </div>
          </section>
        </div>
      ) : null}

      {marketplaceMode && marketplaceIntroOpen ? (
        <div className={styles.marketplaceIntroOverlay} onClick={closeMarketplaceIntroModal}>
          <section
            className={styles.marketplaceIntroModal}
            role="dialog"
            aria-modal="true"
            aria-labelledby="marketplace-intro-title"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              className={styles.marketplaceIntroClose}
              onClick={closeMarketplaceIntroModal}
              aria-label="Close marketplace listing path note"
            >
              ×
            </button>
            <span className={styles.marketplaceIntroKicker}>Marketplace listing path</span>
            <h2 id="marketplace-intro-title">Get an Aim4price value before the listing goes live.</h2>
            <p>
              The marketplace only accepts listings that start with an Aim4price estimate. Run the estimate first, then use
              Send to Marketplace on the result screen to confirm the asking price, photos and seller details.
            </p>
            <div className={styles.marketplaceIntroNote}>
              {!isSignedIn ? (
                <>
                  <strong>Account required before publishing.</strong>
                  <span>
                    Guests can run {Math.max(0, 3 - Math.min(guestValuationCount, 3))} more estimate{3 - Math.min(guestValuationCount, 3) === 1 ? '' : 's'}, but marketplace listings can only be published from an account.
                  </span>
                </>
              ) : isDealerAccount ? (
                <>
                  <strong>Dealer and auctioneer account.</strong>
                  <span>Publish marketplace listings through Get Estimate after the value has been calculated.</span>
                </>
              ) : (
                <>
                  <strong>Owner account.</strong>
                  <span>You can publish from this estimate path or from assets already saved in the Asset Register.</span>
                </>
              )}
            </div>
            <div className={styles.marketplaceIntroActions}>
              <button type="button" className={styles.secondaryButton} onClick={closeMarketplaceIntroModal}>
                Close
              </button>
              {!isSignedIn ? (
                <button type="button" className={styles.primaryButton} onClick={goToAccountCreationFromMarketplaceIntro}>
                  Create account
                </button>
              ) : null}
            </div>
          </section>
        </div>
      ) : null}

      {marketplaceDraft ? (
        <div className={styles.marketplacePublishOverlay} onClick={closeMarketplacePublishModal}>
          <form
            className={styles.marketplacePublishModal}
            onSubmit={publishEstimateToMarketplace}
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              className={styles.marketplacePublishClose}
              onClick={closeMarketplacePublishModal}
              aria-label="Close marketplace modal"
              disabled={isPublishingMarketplace}
            >
              ×
            </button>

            <div className={styles.marketplacePublishHeader}>
              <span>Send to marketplace</span>
              <h2>Confirm the marketplace listing.</h2>
              <p>Check the title, asking price, photos and seller details before it goes live.</p>
            </div>

            <div className={styles.marketplaceSummaryGrid}>
              <div className={styles.marketplaceTitlePreview}>
                <span>Listing title</span>
                <strong>{buildMarketplaceEstimateTitle()}</strong>
                <small>Year model, usage and condition are included in the marketplace title.</small>
              </div>
              <div className={styles.marketplaceEstimateValueCard}>
                <span>Estimate Value</span>
                <strong>{headlineValue !== null ? money(headlineValue) : 'N/A'}</strong>
                <small>Excl. VAT</small>
              </div>
            </div>

            <div className={styles.marketplacePublishGrid}>
              <section className={styles.marketplacePublishPanel}>
                <label className={styles.marketplaceField}>
                  <span>Asking price excl. VAT</span>
                  <div className={styles.marketplaceCurrencyInput}>
                    <small>R</small>
                    <input
                      name="askingPriceExVat"
                      inputMode="numeric"
                      value={marketplaceDraft.askingPriceExVat}
                      onChange={handleMarketplacePriceChange}
                      placeholder="0"
                    />
                  </div>
                </label>

                <div className={styles.marketplacePhotoPanel}>
                  <div>
                    <span>Photos</span>
                    <p>Upload the listing photos directly here. JPG, PNG and WEBP are supported.</p>
                  </div>
                  <input
                    ref={marketplacePhotoInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    multiple
                    hidden
                    onChange={handleMarketplacePhotoChange}
                  />
                  <button type="button" className={styles.marketplacePhotoButton} onClick={() => marketplacePhotoInputRef.current?.click()}>
                    Upload photos
                  </button>

                  {marketplacePhotoFiles.length ? (
                    <div className={styles.marketplacePhotoGrid}>
                      {marketplacePhotoFiles.map((photo) => (
                        <div key={photo.id} className={styles.marketplacePhotoThumb}>
                          <img src={photo.previewUrl} alt="Marketplace upload preview" />
                          <button type="button" onClick={() => removeMarketplacePhoto(photo.id)} aria-label="Remove photo">
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className={styles.marketplaceEmptyPhotos}>No photos uploaded yet.</div>
                  )}
                </div>
              </section>

              <section className={styles.marketplacePublishPanel}>
                <div className={styles.marketplaceSellerHeader}>
                  <h3>Edit seller details</h3>
                  <p>Shown to signed-in marketplace users.</p>
                </div>

                <div className={styles.marketplaceSellerGrid}>
                  <label className={`${styles.marketplaceField} ${styles.marketplaceWideField}`}>
                    <span>Business name</span>
                    <input name="sellerCompany" value={marketplaceDraft.sellerCompany} onChange={handleMarketplaceDraftChange} />
                  </label>
                  <label className={styles.marketplaceField}>
                    <span>Contact name</span>
                    <input name="sellerName" value={marketplaceDraft.sellerName} onChange={handleMarketplaceDraftChange} required />
                  </label>
                  <label className={styles.marketplaceField}>
                    <span>Phone</span>
                    <input name="sellerPhone" value={marketplaceDraft.sellerPhone} onChange={handleMarketplaceDraftChange} required />
                  </label>
                  <label className={`${styles.marketplaceField} ${styles.marketplaceWideField}`}>
                    <span>Business email</span>
                    <input type="email" name="sellerEmail" value={marketplaceDraft.sellerEmail} onChange={handleMarketplaceDraftChange} />
                  </label>
                  <label className={styles.marketplaceField}>
                    <span>Province</span>
                    <input name="province" value={marketplaceDraft.province} onChange={handleMarketplaceDraftChange} />
                  </label>
                  <label className={styles.marketplaceField}>
                    <span>Area</span>
                    <input name="area" value={marketplaceDraft.area} onChange={handleMarketplaceDraftChange} />
                  </label>
                  <label className={`${styles.marketplaceField} ${styles.marketplaceWideField}`}>
                    <span>Notes</span>
                    <textarea name="marketplaceNotes" value={marketplaceDraft.marketplaceNotes} onChange={handleMarketplaceDraftChange} rows={4} />
                  </label>
                </div>
              </section>
            </div>

            {!isSignedIn ? (
              <div className={styles.marketplaceGuestWarning}>
                <strong>Account required before publishing.</strong>
                <p>
                  Guests can run 3 estimates and make 3 marketplace upload attempts. This attempt will take you to account
                  creation so the listing can be tied to your seller profile.
                </p>
              </div>
            ) : null}

            {marketplacePublishError ? <p className={styles.marketplacePublishError}>{marketplacePublishError}</p> : null}

            <div className={styles.marketplacePublishActions}>
              <button type="button" className={styles.secondaryButton} onClick={closeMarketplacePublishModal} disabled={isPublishingMarketplace}>
                Close
              </button>
              <button type="submit" className={styles.primaryButton} disabled={isPublishingMarketplace}>
                {isPublishingMarketplace ? 'Publishing...' : isSignedIn ? 'Confirm and publish' : 'Create account to publish'}
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </main>
  );
}
