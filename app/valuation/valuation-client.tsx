'use client';

import { useEffect, useMemo, useRef, useState, type ChangeEvent, type CSSProperties, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import AppHeader from '../../components/AppHeader';
import SaleabilityModal from '../../components/SaleabilityModal';
import styles from './page.module.css';
import dealerStyles from '../dealer/dealer.module.css';
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
  ADVANCED_CONDITION_FACTOR_MAX_PERCENT,
  ADVANCED_CONDITION_FACTOR_MIN_PERCENT,
  ADVANCED_LIFETIME_HOURS_MAX,
  ADVANCED_LIFETIME_HOURS_MIN,
  ADVANCED_LIFETIME_KM_MAX,
  ADVANCED_LIFETIME_KM_MIN,
  CONDITION_FACTORS,
  type NormalizedAdvancedAssumptions,
} from '../../lib/valuation/shared';
import type {
  DealerAssessmentInput,
  NormalizedDealerAssessment,
} from '../../lib/valuation/dealer-assessment';
import {
  getGuestValuationCount,
  incrementGuestValuationCount,
} from '../../lib/guest-valuation-limit';
import type { AdBrandKit } from '../../lib/ad-studio';
import type { MarketplaceListing } from '../../lib/marketplace';
import {
  createMarketplaceAdJpeg,
  downloadMarketplaceAd,
  marketplaceAdFilename,
} from '../../lib/marketplace-ad-renderer';
import {
  calculateGeneralSaleability,
  type GeneralSaleabilityInput,
} from '../../lib/saleability';

type Step = 1 | 2 | 3 | 4 | 5;
type MethodKey = 'aim4price';
type FlowMode = 'exact_model' | 'generic_specs' | '';
type FinalSaveIntent = 'asset-register' | 'marketplace';
type GpsType = 'full-autosteer' | 'guidance-only';
type ReplacementPriceBasis = 'aim4price' | 'user';
type VatDisplayMode = 'excl' | 'incl';
type DepreciationMethodUsed = 'full_depreciation' | 'semi_depreciation' | 'percentage_depreciation';
type DetailsModal = 'year' | 'usage' | null;
type UsageModalMode = 'hours' | 'percent';

type AdvancedAssumptionsRequest = {
  maxLifetimeUsage?: number | null;
  conditionFactorPercent?: number | null;
  dealerAssessment?: DealerAssessmentInput;
  popularityStars?: number | null;
};

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
  aim4ModelKey: string | null;
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

type GenericModelSelectionMode = 'catalog' | 'manual' | 'unknown' | '';

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
  advancedAssumptions: NormalizedAdvancedAssumptions | null;
  ageDepPct: number | null;
  usageDepPct: number | null;
  averageDepPct: number | null;
  marketabilityFactor: number;
  marketabilityReductionPercent: number;
  salvagePercent: number | null;
  salvageValueExVat: number | null;
  isSalvageEstimate: boolean;
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
  yearModelUnknown?: boolean | null;
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
  advancedAssumptions: NormalizedAdvancedAssumptions | null;
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


type MotorTypeOption = {
  value: string;
  label: string;
  specs?: Record<string, string>;
};

type MotorCanonicalModelResult = {
  id: string;
  modelKey: string;
  representativeModelId: number;
  sectorKey: SectorKey;
  familyKey: string;
  familyLabel: string;
  brandId: number;
  brandSlug: string;
  brandName: string;
  modelName: string;
  displayLabel: string;
  typeOptions: MotorTypeOption[];
  defaultTypeValue: string | null;
  specsJson: Record<string, unknown>;
};

type MotorModelSearchApiResponse = {
  ok: boolean;
  count?: number;
  models?: MotorCanonicalModelResult[];
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

type ConversionSourceAsset = {
  id: string;
  title: string;
  selectedMethod?: string | null;
  valuationRunId?: number | null;
  kind?: string | null;
  brandName?: string | null;
  modelName?: string | null;
  typedModelName?: string | null;
  yearModel?: number | null;
  hours?: number | null;
  lifeWorkedPercent?: number | null;
  condition?: ConditionKey | null;
  replacementPriceExVat?: number | null;
  value?: number | null;
  specsJson?: Record<string, unknown> | null;
};

type AssetRegisterListApiResponse = {
  ok: boolean;
  items?: ConversionSourceAsset[];
  assets?: ConversionSourceAsset[];
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
  accountStatus: 'pending_payment' | 'active' | 'suspended' | string;
  accountStatusLabel: string;
  province: string;
  townCity: string;
  marketplaceSellerName: string;
  marketplacePhone: string;
  marketplaceEmail: string;
  marketplaceLocation: string;
  logoUrl: string;
  websiteUrl: string;
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
  brandKitId: string;
  showDealRating: boolean;
  askingPriceExVat: string;
  marketplaceNotes: string;
  sellerName: string;
  sellerCompany: string;
  sellerPhone: string;
  sellerEmail: string;
  province: string;
  area: string;
};

type AdBrandKitsApiResponse = {
  ok: boolean;
  kits?: AdBrandKit[];
  selectedBrandKitId?: string | null;
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
  listing?: MarketplaceListing | null;
  error?: string;
};

type PublishedAdvertDownload = {
  listing: MarketplaceListing;
  listingReference: string;
  status: 'downloaded' | 'failed';
  message: string;
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
  saleabilityRows: ValuationPdfKeyValue[];
};

const CURRENT_YEAR = new Date().getFullYear();
const VAT_RATE = 0.15;
const UNKNOWN_BRAND_SLUG = 'unknown';
const UNKNOWN_BRAND_NAME = 'Brand not listed';
const UNLISTED_BRAND_NAME_SPEC_KEY = 'unlisted_brand_name';
const TYPED_BRAND_NAME_SPEC_KEY = 'typed_brand_name';
const UNKNOWN_BRAND_OPTION: BrandRow = { name: UNKNOWN_BRAND_NAME, slug: UNKNOWN_BRAND_SLUG };
const MAX_MARKETPLACE_PHOTOS = 12;
const MARKETPLACE_INTRO_DISMISSED_KEY = 'aim4price-marketplace-intro-dismissed';

const WIZARD_STEPS: Array<{ step: Step; label: string }> = [
  { step: 1, label: 'Equipment' },
  { step: 2, label: 'Brand' },
  { step: 3, label: 'Path' },
  { step: 4, label: 'Specs' },
  { step: 5, label: 'Value' },
];


function getWizardStepLabel(step: Step, sectorKey: SectorKey | null): string {
  if (sectorKey === 'motor') {
    if (step === 1) return 'Sector';
    if (step === 2) return 'Model';
    if (step === 3) return 'Type';
    if (step === 4) return 'Options';
    return 'Value';
  }

  if (step === 1) return getAssetNounTitle(sectorKey);
  return WIZARD_STEPS.find((item) => item.step === step)?.label ?? String(step);
}

const SECTOR_OPTIONS: Array<{ key: SectorKey; label: string; available: boolean; videoSrc: string }> = [
  { key: 'agricultural', label: SECTOR_LABELS.agricultural, available: true, videoSrc: '/brand/valuation/Agriculture.mp4' },
  { key: 'construction', label: SECTOR_LABELS.construction, available: true, videoSrc: '/brand/valuation/Construction.mp4' },
  { key: 'industrial', label: SECTOR_LABELS.industrial, available: true, videoSrc: '/brand/valuation/Industrial.mp4' },
  { key: 'motor', label: SECTOR_LABELS.motor, available: true, videoSrc: '/brand/valuation/Motor.mp4' },
];

type ValuationSearchPlaceholderKey = 'family' | 'brand' | 'model' | 'manualModel';

const VALUATION_SEARCH_PLACEHOLDERS: Record<SectorKey, Record<ValuationSearchPlaceholderKey, string>> = {
  agricultural: {
    family: 'e.g. tractor, baler, spreader',
    brand: 'e.g. John Deere, New Holland, Case IH',
    model: 'e.g. 6155M, 7610, 7810',
    manualModel: 'e.g. 6155M',
  },
  industrial: {
    family: 'e.g. forklift, compressor, generator',
    brand: 'e.g. Toyota, Hyster, Atlas Copco',
    model: 'e.g. 8FG25, H2.5FT, XAS 186',
    manualModel: 'e.g. 8FG25',
  },
  construction: {
    family: 'e.g. excavator, TLB, wheel loader',
    brand: 'e.g. CAT, JCB, Komatsu',
    model: 'e.g. 3CX, 320D, WA380',
    manualModel: 'e.g. 3CX',
  },
  motor: {
    family: 'e.g. bakkie, SUV, sedan',
    brand: 'e.g. Toyota, Ford, Isuzu',
    model: 'e.g. Toyota Hilux, Hilux, Ford Ranger, Yamaha MT-07',
    manualModel: 'e.g. Toyota Hilux',
  },
};

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
  { value: 'open-station', label: 'Open' },
];

const GPS_TYPE_OPTIONS: Array<{ value: GpsType; label: string }> = [
  { value: 'guidance-only', label: 'Guidance only' },
  { value: 'full-autosteer', label: 'Full autosteer' },
];

const DEALER_MECHANICAL_OPTIONS = [
  { value: 'excellent', label: 'Excellent' },
  { value: 'good', label: 'Good' },
  { value: 'average', label: 'Average' },
  { value: 'below_average', label: 'Below average' },
  { value: 'poor', label: 'Poor' },
] as const;

const DEALER_BODY_OPTIONS = [
  { value: 'excellent', label: 'Excellent' },
  { value: 'good', label: 'Good' },
  { value: 'average', label: 'Average' },
  { value: 'poor', label: 'Poor' },
  { value: 'damaged', label: 'Damaged' },
] as const;

const DEALER_TYRE_OPTIONS = [
  { value: '75_100', label: '75-100%' },
  { value: '50_75', label: '50-75%' },
  { value: '25_50', label: '25-50%' },
  { value: 'below_25', label: 'Below 25%' },
  { value: 'replacement_required', label: 'Replacement required' },
] as const;

const DEALER_SERVICE_OPTIONS = [
  { value: 'complete_verified', label: 'Complete and verified' },
  { value: 'partial', label: 'Partial' },
  { value: 'owner_recorded', label: 'Owner-recorded' },
  { value: 'none', label: 'None' },
  { value: 'unknown', label: 'Unknown' },
] as const;

const DEALER_WORK_OPTIONS = [
  { value: 'ready', label: 'Ready to use' },
  { value: 'minor', label: 'Minor' },
  { value: 'moderate', label: 'Moderate' },
  { value: 'significant', label: 'Significant' },
  { value: 'major', label: 'Major repairs' },
] as const;

type DropdownOption = { value: string; label: string };

type MotorSubtypeOption = {
  value: string;
  label: string;
  searchAliases?: string[];
  specs?: Record<string, string>;
};

type MotorSubtypeConfig = {
  specKey: string;
  title: string;
  fieldLabel: string;
  helpText: string;
  options: MotorSubtypeOption[];
};

const MOTOR_SUBTYPE_CONFIG: Record<string, MotorSubtypeConfig> = {
  bakkies_ldvs: {
    specKey: 'cab_type',
    title: 'Choose bakkie type',
    fieldLabel: 'Bakkie type',
    helpText: 'First choose the bakkie body/cab type. Then choose the brand.',
    options: [
      { value: 'single_cab', label: 'Single cab', searchAliases: ['Single Cab', 'Single cabs', 'single cab'], specs: { body_type: 'single_cab' } },
      { value: 'extended_cab', label: 'Extended cab', searchAliases: ['Extended cabs', 'extra_cab', 'extra cab'], specs: { body_type: 'extended_cab' } },
      { value: 'kingcab', label: 'Kingcab', searchAliases: ['Kingcabs', 'king cab'], specs: { body_type: 'kingcab' } },
      { value: 'supercab', label: 'Supercab', searchAliases: ['Supercab', 'super cab'], specs: { body_type: 'supercab' } },
      { value: 'double_cab', label: 'Double cab', searchAliases: ['Double cabs', 'crew cab'], specs: { body_type: 'double_cab' } },
    ],
  },
  cars_suvs: {
    specKey: 'body_type',
    title: 'Choose car type',
    fieldLabel: 'Car type',
    helpText: 'Choose the vehicle body type before selecting the brand.',
    options: [
      { value: 'cabriolet', label: 'Cabriolet', searchAliases: ['Cabriolets', 'convertible'], specs: { vehicle_segment: 'performance' } },
      { value: 'coupe', label: 'Coupé', searchAliases: ['Coupe', 'Coupé', 'coupes'], specs: { vehicle_segment: 'performance' } },
      { value: 'fastback', label: 'Fastback', searchAliases: ['Fastbacks'], specs: { vehicle_segment: 'sedan' } },
      { value: 'hatchback', label: 'Hatchback', searchAliases: ['Hatchbacks', 'hatch', 'entry_hatch', 'compact_hatch'], specs: { vehicle_segment: 'compact_hatch' } },
      { value: 'mpv', label: 'MPV', searchAliases: ['MPV', 'multi purpose vehicle'], specs: { vehicle_segment: 'mpv' } },
      { value: 'sedan', label: 'Sedan', searchAliases: ['Sedans'], specs: { vehicle_segment: 'sedan' } },
      { value: 'sportback', label: 'Sportback', searchAliases: ['Sportback'], specs: { vehicle_segment: 'performance' } },
      { value: 'station_wagon', label: 'Station wagon', searchAliases: ['Station wagon', 'Station wagons', 'estate'], specs: { vehicle_segment: 'sedan' } },
      { value: 'suv', label: 'SUV', searchAliases: ['SUV', 'SUVs', 'crossover', 'compact_suv', 'midsize_suv', 'large_suv', 'luxury_suv'], specs: { vehicle_segment: 'compact_suv' } },
    ],
  },
  light_commercial_vehicles: {
    specKey: 'body_type',
    title: 'Choose light commercial type',
    fieldLabel: 'Light commercial type',
    helpText: 'Choose the closest van, minibus or light commercial body type before selecting the brand.',
    options: [
      { value: 'lcv', label: 'LCV', searchAliases: ['LCV', 'pickup_commercial'] },
      { value: 'panel_van', label: 'Panel van', searchAliases: ['Panel vans', 'panel van', 'van'] },
      { value: 'crew_bus', label: 'Crew bus', searchAliases: ['Crew buses', 'crew bus'] },
      { value: 'minibus', label: 'Minibus', searchAliases: ['Minibus', 'minibus_taxi'] },
      { value: 'mpv', label: 'MPV', searchAliases: ['MPV'] },
    ],
  },
  buses: {
    specKey: 'bus_type',
    title: 'Choose bus type',
    fieldLabel: 'Bus type',
    helpText: 'Choose the closest bus class before selecting the brand.',
    options: [
      { value: 'minibus_taxi', label: 'Minibus taxi', searchAliases: ['Minibus', 'minibus', 'minibus_taxi'] },
      { value: 'panel_van_bus', label: 'Van-based bus', searchAliases: ['Crew buses', 'crew_bus', 'panel_van_bus'] },
      { value: 'midi_bus', label: 'Midi bus', searchAliases: ['midi_bus'] },
      { value: 'commuter_bus', label: 'Commuter bus', searchAliases: ['commuter_bus'] },
      { value: 'coach', label: 'Coach', searchAliases: ['coach'] },
      { value: 'city_bus', label: 'City bus', searchAliases: ['city_bus'] },
    ],
  },
  trucks: {
    specKey: 'truck_type',
    title: 'Choose truck type',
    fieldLabel: 'Truck type',
    helpText: 'Choose the main truck application before selecting the brand.',
    options: [
      { value: 'truck_tractor', label: 'Truck tractor', searchAliases: ['tractor', 'horse'] },
      { value: 'rigid_truck', label: 'Rigid truck', searchAliases: ['rigid'] },
      { value: 'tipper', label: 'Tipper', searchAliases: ['tipper_body', 'tipper'] },
      { value: 'dropside', label: 'Dropside', searchAliases: ['dropside_body', 'dropside'] },
      { value: 'tanker', label: 'Tanker', searchAliases: ['tanker_body', 'tanker'] },
      { value: 'refrigerated', label: 'Refrigerated', searchAliases: ['refrigerated_body', 'fridge'] },
      { value: 'crane_truck', label: 'Crane truck', searchAliases: ['crane'] },
      { value: 'concrete_mixer', label: 'Concrete mixer', searchAliases: ['mixer'] },
      { value: 'refuse_truck', label: 'Refuse truck', searchAliases: ['refuse'] },
      { value: 'rollback', label: 'Rollback', searchAliases: ['rollback'] },
    ],
  },
  trailers: {
    specKey: 'trailer_type',
    title: 'Choose trailer type',
    fieldLabel: 'Trailer type',
    helpText: 'Choose the trailer body/application before selecting the brand.',
    options: [
      { value: 'flatdeck', label: 'Flatdeck', searchAliases: ['flatdeck', 'flatbed'] },
      { value: 'tautliner', label: 'Tautliner', searchAliases: ['tautliner'] },
      { value: 'side_tipper', label: 'Side tipper', searchAliases: ['side tipper'] },
      { value: 'lowbed', label: 'Lowbed', searchAliases: ['lowbed'] },
      { value: 'tanker', label: 'Tanker', searchAliases: ['tanker'] },
      { value: 'skeletal', label: 'Skeletal', searchAliases: ['skeletal', 'skel'] },
      { value: 'refrigerated', label: 'Refrigerated', searchAliases: ['refrigerated', 'fridge'] },
      { value: 'livestock', label: 'Livestock', searchAliases: ['livestock'] },
      { value: 'dolly', label: 'Dolly', searchAliases: ['dolly'] },
    ],
  },
  motorcycles: {
    specKey: 'motorcycle_type',
    title: 'Choose motorcycle type',
    fieldLabel: 'Motorcycle type',
    helpText: 'Choose the motorcycle type before selecting the brand.',
    options: [
      { value: 'commuter', label: 'Commuter' },
      { value: 'adventure', label: 'Adventure' },
      { value: 'touring', label: 'Touring' },
      { value: 'sport', label: 'Sport' },
      { value: 'cruiser', label: 'Cruiser' },
      { value: 'off_road', label: 'Off-road' },
      { value: 'scooter', label: 'Scooter' },
    ],
  },
  quadbikes: {
    specKey: 'quadbike_type',
    title: 'Choose quadbike type',
    fieldLabel: 'Quadbike type',
    helpText: 'Choose the quadbike type before selecting the brand.',
    options: [
      { value: 'utility', label: 'Utility' },
      { value: 'sport', label: 'Sport' },
      { value: 'youth', label: 'Youth' },
      { value: 'electric', label: 'Electric' },
    ],
  },
  side_by_sides: {
    specKey: 'side_by_side_type',
    title: 'Choose side-by-side type',
    fieldLabel: 'Side-by-side type',
    helpText: 'Choose the side-by-side type before selecting the brand.',
    options: [
      { value: 'utility', label: 'Utility' },
      { value: 'recreation', label: 'Recreation' },
      { value: 'sport', label: 'Sport' },
      { value: 'crew', label: 'Crew cab' },
      { value: 'electric', label: 'Electric' },
    ],
  },
};

const MOTOR_VAT_INCLUDED_DEFAULT_FAMILIES = new Set([
  'cars_suvs',
  'bakkies_ldvs',
  'light_commercial_vehicles',
  'motorcycles',
  'quadbikes',
  'side_by_sides',
]);

const MOTOR_VAT_EXCLUDED_DEFAULT_FAMILIES = new Set(['trucks', 'trailers', 'buses']);

function sentenceCase(value: string): string {
  return value ? value.charAt(0).toUpperCase() + value.slice(1) : value;
}

function isMotorSector(sectorKey?: SectorKey | null): boolean {
  return sectorKey === 'motor';
}

function getCatalogImportLabel(sectorKey?: SectorKey | null): string {
  return isMotorSector(sectorKey) ? 'vehicle catalogue' : 'equipment catalogue';
}

function getAssetTypeLabel(sectorKey?: SectorKey | null): string {
  return isMotorSector(sectorKey) ? 'vehicle type' : 'equipment type';
}

function getAssetItemLabel(sectorKey?: SectorKey | null): string {
  return isMotorSector(sectorKey) ? 'vehicle' : 'equipment';
}

function getAssetNounLabel(sectorKey?: SectorKey | null): string {
  return isMotorSector(sectorKey) ? 'vehicle' : 'equipment';
}

function getAssetNounTitle(sectorKey?: SectorKey | null): string {
  return sentenceCase(getAssetNounLabel(sectorKey));
}

function getSpecsLabel(sectorKey?: SectorKey | null): string {
  return isMotorSector(sectorKey) ? 'vehicle specs' : 'equipment specs';
}

function getSpecsTitle(sectorKey?: SectorKey | null): string {
  return sentenceCase(getSpecsLabel(sectorKey));
}

function getGenericEstimatePathCopy(sectorKey?: SectorKey | null): string {
  return `Aim4price uses a few key ${getSpecsLabel(sectorKey)} questions to help calculate a value. Continue to answer the questions.`;
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

function normalizeComparisonValue(value: unknown): string {
  return normalizeText(value).toLowerCase().replace(/[^a-z0-9]+/g, '');
}

function getMotorSubtypeConfig(sectorKey?: SectorKey | null, familyKey?: string | null): MotorSubtypeConfig | null {
  if (sectorKey !== 'motor' || !familyKey) return null;
  return MOTOR_SUBTYPE_CONFIG[familyKey] ?? null;
}

function getMotorSubtypeOption(config: MotorSubtypeConfig | null, value: string): MotorSubtypeOption | null {
  if (!config || !value) return null;
  return config.options.find((option) => option.value === value) ?? null;
}

function getMotorSubtypeSpecs(config: MotorSubtypeConfig | null, option: MotorSubtypeOption | null): Record<string, string> {
  if (!config || !option) return {};
  return {
    [config.specKey]: option.value,
    ...(option.specs ?? {}),
  };
}

function getMotorSubtypeSpecKeys(config: MotorSubtypeConfig | null): Set<string> {
  const keys = new Set<string>();
  if (!config) return keys;
  keys.add(config.specKey);
  return keys;
}

function getMotorSubtypeDisplayLabel(config: MotorSubtypeConfig | null, value: string): string {
  return getMotorSubtypeOption(config, value)?.label ?? 'Choose type';
}

function modelMatchesMotorSubtype(
  model: GenericCatalogModel,
  config: MotorSubtypeConfig | null,
  option: MotorSubtypeOption | null,
): boolean {
  if (!config || !option) return true;

  const specsJson = normalizeGenericSpecsRecord(model.specsJson);
  const expectedValues = new Set([
    option.value,
    option.label,
    ...(option.searchAliases ?? []),
    ...Object.values(option.specs ?? {}),
  ].map(normalizeComparisonValue).filter(Boolean));

  const candidateValues = [
    specsJson[config.specKey],
    specsJson.body_type,
    specsJson.cab_type,
    specsJson.bus_type,
    specsJson.truck_type,
    specsJson.trailer_type,
    specsJson.motorcycle_type,
    specsJson.quadbike_type,
    specsJson.side_by_side_type,
    specsJson.vehicle_segment,
    specsJson.aim4_source_body_type,
  ].map(normalizeComparisonValue).filter(Boolean);

  return candidateValues.some((value) => expectedValues.has(value));
}

function getDefaultVatDisplayMode(
  sectorKey?: SectorKey | null,
  familyKey?: string | null,
): VatDisplayMode {
  if (sectorKey !== 'motor') return 'excl';
  if (familyKey && MOTOR_VAT_INCLUDED_DEFAULT_FAMILIES.has(familyKey)) return 'incl';
  if (familyKey && MOTOR_VAT_EXCLUDED_DEFAULT_FAMILIES.has(familyKey)) return 'excl';
  return 'excl';
}

function getVatDefaultNote(sectorKey?: SectorKey | null, familyKey?: string | null): string {
  if (sectorKey !== 'motor') return 'Aim4price stores replacement prices excluding VAT. Use the toggle to view the estimate either excluding or including VAT.';
  if (getDefaultVatDisplayMode(sectorKey, familyKey) === 'incl') {
    return 'Default view for cars, bakkies, light vehicles, motorcycles, quadbikes and side-by-sides is VAT included. Stored replacement prices remain VAT excluded.';
  }

  return 'Default view for trucks, buses and trailers is VAT excluded. Use the toggle if you need a VAT included view.';
}

function isUnknownBrandSlug(value: unknown): boolean {
  return normalizeText(value).toLowerCase() === UNKNOWN_BRAND_SLUG;
}

function getUnlistedBrandNameFromSpecs(specsJson?: Record<string, unknown> | null): string {
  if (!specsJson) return '';
  return normalizeText(specsJson[UNLISTED_BRAND_NAME_SPEC_KEY] ?? specsJson[TYPED_BRAND_NAME_SPEC_KEY]);
}

function getDisplayBrandName(
  brand?: { slug?: string | null; name?: string | null } | null,
  specsJson?: Record<string, unknown> | null,
  manualBrandName?: string,
): string {
  const enteredBrandName = normalizeText(manualBrandName) || getUnlistedBrandNameFromSpecs(specsJson);
  const brandName = normalizeText(brand?.name);

  if (isUnknownBrandSlug(brand?.slug) || brandName.toLowerCase() === 'unknown') {
    return enteredBrandName || UNKNOWN_BRAND_NAME;
  }

  return brandName || enteredBrandName || UNKNOWN_BRAND_NAME;
}

function getAdvancedConditionQuestionLabel(value: ConditionKey): string {
  return value;
}

function isPercentUsageModeValue(value: unknown): boolean {
  const normalized = normalizeText(value).toLowerCase();
  return (
    normalized === 'percent' ||
    normalized === 'percentage' ||
    normalized === 'percent_used' ||
    normalized === 'percentage_used' ||
    normalized === 'percentage_depreciation' ||
    normalized === 'life_worked_percent' ||
    normalized === 'worked_percent' ||
    normalized === 'lifetime_percent' ||
    normalized === 'wear_class'
  );
}

function recordHasPercentUsageMode(record?: Record<string, unknown> | null): boolean {
  if (!record) return false;

  return [
    record.usageMode,
    record.usage_mode,
    record.usageBasis,
    record.usage_basis,
    record.usageMetricType,
    record.usage_metric_type,
    record.valuationMode,
    record.valuation_mode,
    record.selectedUsageMode,
    record.selected_usage_mode,
    record.selectedUsageBasis,
    record.selected_usage_basis,
    record.depreciationMethodUsed,
    record.depreciation_method_used,
    record.selectedDepreciationMethod,
    record.selected_depreciation_method,
  ].some(isPercentUsageModeValue);
}

function resultStateUsesPercentBasis(
  state: ValuationResultState | null,
  tractorUsageAmount: number | null,
  tractorLifeWorkedPercent: number | null,
): boolean {
  if (!state) return false;

  if (state.kind === 'generic') {
    return (
      recordHasPercentUsageMode(state.result.specsJson) ||
      isPercentUsageModeValue(state.result.depreciationMethodUsed) ||
      (state.result.usageAmount === null && state.result.lifeWorkedPercent !== null)
    );
  }

  return tractorUsageAmount === null && tractorLifeWorkedPercent !== null;
}

function shouldShowAdvancedLifetimeInput(
  state: ValuationResultState | null,
  tractorUsageAmount: number | null,
  tractorLifeWorkedPercent: number | null,
): boolean {
  return !resultStateUsesPercentBasis(state, tractorUsageAmount, tractorLifeWorkedPercent);
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

function readNumberFromRecord(record: Record<string, unknown> | null | undefined, keys: string[]): number | null {
  if (!record) return null;

  for (const key of keys) {
    const value = record[key];
    if (value === null || typeof value === 'undefined' || value === '') continue;

    const numeric = Number(value);
    if (Number.isFinite(numeric)) return numeric;
  }

  return null;
}

function readConversionReplacementPrice(asset: ConversionSourceAsset): number | null {
  const direct = Number(asset.replacementPriceExVat);
  if (Number.isFinite(direct) && direct > 0) return Math.round(direct);

  const fromSpecs = readNumberFromRecord(asset.specsJson, [
    'replacementPriceExVat',
    'replacement_price_ex_vat',
    'replacementPrice',
    'replacement_price',
    'userReplacementPriceExVat',
    'user_replacement_price_ex_vat',
  ]);

  return fromSpecs !== null && fromSpecs > 0 ? Math.round(fromSpecs) : null;
}

function readConversionLifeWorkedPercent(asset: ConversionSourceAsset): number | null {
  const direct = Number(asset.lifeWorkedPercent);
  if (Number.isFinite(direct)) return Math.min(100, Math.max(0, Math.round(direct * 10) / 10));

  const fromSpecs = readNumberFromRecord(asset.specsJson, [
    'life_worked_percent',
    'worked_percent',
    'lifetime_worked_percent',
    'percent_worked',
    'lifetime_used_percent',
  ]);

  return fromSpecs === null ? null : Math.min(100, Math.max(0, Math.round(fromSpecs * 10) / 10));
}

function normalizeConversionCondition(value: unknown): ConditionKey | null {
  const normalized = normalizeText(value).toLowerCase();
  return conditionOptions.some((option) => option.key === normalized) ? (normalized as ConditionKey) : null;
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

function getSearchPlaceholder(sectorKey: SectorKey | null | undefined, key: ValuationSearchPlaceholderKey): string {
  return VALUATION_SEARCH_PLACEHOLDERS[sectorKey ?? 'agricultural'][key];
}

function formatSingleUsageSummary(args: {
  actualUsageAmount?: number | null;
  lifeWorkedPercent?: number | null;
  sectorKey?: SectorKey | string | null;
  usageMetricType?: UsageMetricType | string | null;
  fallbackUnit?: string;
  fallback?: string;
}): string {
  const actualUsageAmount = args.actualUsageAmount ?? null;
  if (actualUsageAmount !== null && Number.isFinite(actualUsageAmount) && actualUsageAmount > 0) {
    const unit = args.fallbackUnit ?? getUsageShortUnit(args.sectorKey, args.usageMetricType);
    return `${formatWholeNumber(actualUsageAmount)} ${unit}`;
  }

  const lifeWorkedPercent = args.lifeWorkedPercent ?? null;
  if (lifeWorkedPercent !== null && Number.isFinite(lifeWorkedPercent)) {
    return `${formatPercent(lifeWorkedPercent)} worked`;
  }

  return args.fallback ?? 'Usage captured';
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


function buildSyntheticSpecOption(
  specQuestionId: number,
  optionValue: string,
  optionLabel: string,
  sortOrder: number,
): SpecOption {
  return {
    id: specQuestionId * 1000 - sortOrder,
    specQuestionId,
    optionValue,
    optionLabel,
    sortOrder,
  };
}

function normalizeSpecArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((item) => normalizeText(item)).filter(Boolean);
  }

  const text = normalizeText(value);
  if (!text) return [];
  return text.split(/\s*;\s*/).map((item) => item.trim()).filter(Boolean);
}

function getMotorModelTypeQuestions(
  sectorKey: SectorKey | null,
  family: EquipmentFamilyRecord | null,
  model: GenericCatalogModel | null,
): SpecQuestion[] {
  if (!isMotorSector(sectorKey) || !family || !model) return [];

  const specs = normalizeGenericSpecsRecord(model.specsJson);
  const availableTypeKeys = normalizeSpecArray(specs.available_type_keys);
  const availableTypeLabels = normalizeSpecArray(specs.available_type_labels);
  const questions: SpecQuestion[] = [];

  if (availableTypeKeys.length > 1) {
    const questionId = -9001;
    questions.push({
      id: questionId,
      sectorId: model.sectorId,
      sectorKey: 'motor',
      familyId: family.id,
      familyKey: family.familyKey,
      specKey: 'type_key',
      label: 'Type',
      inputType: 'select',
      unit: null,
      isRequired: true,
      affectsValue: true,
      useForMarketMatching: true,
      sortOrder: 5,
      helpText: 'Choose the type for this model. This narrows the Motor pricing matrix.',
      options: availableTypeKeys.map((typeKey, index) =>
        buildSyntheticSpecOption(questionId, typeKey, availableTypeLabels[index] || typeKey.replace(/_/g, ' '), index + 1),
      ),
    });
  }

  return questions;
}

function getMotorPricingSpecQuestions(
  sectorKey: SectorKey | null,
  family: EquipmentFamilyRecord | null,
  model: GenericCatalogModel | null,
): SpecQuestion[] {
  if (!isMotorSector(sectorKey) || !family) return [];

  return [
    {
      id: -9002,
      sectorId: family.sectorId,
      sectorKey: 'motor',
      familyId: family.id,
      familyKey: family.familyKey,
      specKey: 'spec_level',
      label: 'Specification level',
      inputType: 'select',
      unit: null,
      isRequired: true,
      affectsValue: true,
      useForMarketMatching: true,
      sortOrder: 10,
      helpText: 'Entry maps to low pricing, Mid to mid pricing, and Luxury to high pricing.',
      options: [
        buildSyntheticSpecOption(-9002, 'Entry', 'Entry', 1),
        buildSyntheticSpecOption(-9002, 'Mid', 'Mid', 2),
        buildSyntheticSpecOption(-9002, 'Luxury', 'Luxury', 3),
      ],
    },
    {
      id: -9003,
      sectorId: family.sectorId,
      sectorKey: 'motor',
      familyId: family.id,
      familyKey: family.familyKey,
      specKey: 'drive_type',
      label: 'Drivetrain',
      inputType: 'select',
      unit: null,
      isRequired: false,
      affectsValue: true,
      useForMarketMatching: true,
      sortOrder: 20,
      helpText: 'Choose if relevant. Leave as Any / Unknown when drivetrain is not material or not known.',
      options: [
        buildSyntheticSpecOption(-9003, 'Any/Unknown', 'Any / Unknown', 1),
        buildSyntheticSpecOption(-9003, '4x2', '4x2', 2),
        buildSyntheticSpecOption(-9003, '4x4', '4x4', 3),
        buildSyntheticSpecOption(-9003, 'AWD', 'AWD', 4),
        buildSyntheticSpecOption(-9003, 'FWD', 'FWD', 5),
        buildSyntheticSpecOption(-9003, 'RWD', 'RWD', 6),
      ],
    },
    {
      id: -9004,
      sectorId: family.sectorId,
      sectorKey: 'motor',
      familyId: family.id,
      familyKey: family.familyKey,
      specKey: 'transmission',
      label: 'Transmission',
      inputType: 'select',
      unit: null,
      isRequired: false,
      affectsValue: true,
      useForMarketMatching: true,
      sortOrder: 30,
      helpText: 'Choose if relevant. Leave as Any / Unknown when transmission is not material or not known.',
      options: [
        buildSyntheticSpecOption(-9004, 'Any/Unknown', 'Any / Unknown', 1),
        buildSyntheticSpecOption(-9004, 'Manual', 'Manual', 2),
        buildSyntheticSpecOption(-9004, 'Automatic', 'Automatic', 3),
      ],
    },
  ];
}

function mergeSpecQuestions(primary: SpecQuestion[], fallback: SpecQuestion[]): SpecQuestion[] {
  const seen = new Set<string>();
  const merged: SpecQuestion[] = [];

  for (const question of [...primary, ...fallback]) {
    if (seen.has(question.specKey)) continue;
    seen.add(question.specKey);
    merged.push(question);
  }

  return merged.sort((left, right) => left.sortOrder - right.sortOrder || left.label.localeCompare(right.label));
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

function toVatIncluded(value: number | null): number | null {
  return value === null || !Number.isFinite(value) ? null : value * (1 + VAT_RATE);
}

function getVatDisplayValue(value: number | null, mode: VatDisplayMode): number | null {
  return mode === 'incl' ? toVatIncluded(value) : value;
}

function getVatDisplayLabel(mode: VatDisplayMode): 'VAT excluded' | 'VAT included' {
  return mode === 'incl' ? 'VAT included' : 'VAT excluded';
}

function formatPlainNumber(value: number | null | undefined): string {
  if (value === null || typeof value === 'undefined' || !Number.isFinite(value)) return '';
  return Math.round(value).toLocaleString('en-ZA');
}

function formatAdvancedPercent(value: number | null | undefined): string {
  if (value === null || typeof value === 'undefined' || !Number.isFinite(value)) return '';
  return Number.isInteger(value) ? String(value) : value.toFixed(1).replace(/\.0$/, '');
}

function formatPrecisePercent(value: number | null | undefined): string {
  if (value === null || typeof value === 'undefined' || !Number.isFinite(value)) return '';
  return value.toFixed(3).replace(/\.?0+$/, '');
}

function getDealerOptionLabel(options: readonly { value: string; label: string }[], value: string | null | undefined): string {
  return options.find((option) => option.value === value)?.label ?? '';
}

function getDefaultConditionFactorPercent(conditionKey: ConditionKey): number {
  return Math.round((CONDITION_FACTORS[conditionKey] ?? CONDITION_FACTORS.good) * 100);
}

function hasAppliedAdvancedAssumptions(advancedAssumptions: NormalizedAdvancedAssumptions | null | undefined): boolean {
  return Boolean(
    advancedAssumptions &&
      (
        advancedAssumptions.maxLifetimeUsage !== null
        || advancedAssumptions.conditionFactorPercent !== null
        || advancedAssumptions.dealerAssessment !== null
      ),
  );
}

function getAppliedDealerAssessmentFromState(state: ValuationResultState | null): NormalizedDealerAssessment | null {
  return getAppliedAdvancedAssumptionsFromState(state)?.dealerAssessment ?? null;
}

function getAppliedAdvancedAssumptionsFromState(state: ValuationResultState | null): NormalizedAdvancedAssumptions | null {
  if (!state) return null;
  return state.result.advancedAssumptions ?? null;
}

function getResultMaxLifetimeUsage(state: ValuationResultState | null): number | null {
  if (!state) return null;
  if (state.kind === 'generic') return state.result.maxLifetimeHours ?? state.result.selectedCalculation?.maxLifetimeHours ?? null;
  return state.result.maxLifetimeHours ?? null;
}

function getResultUsageMetricType(state: ValuationResultState | null): UsageMetricType {
  return state?.kind === 'generic' ? state.result.family.usageMetricType : 'hours';
}

function getResultSectorKey(state: ValuationResultState | null): SectorKey {
  return state?.kind === 'generic' ? state.result.sector.key : 'agricultural';
}

function getSaleabilityInputFromResult(
  state: ValuationResultState,
  fallbackCondition: ConditionKey,
  usageAmount: number | null,
  lifeWorkedPercent: number | null,
): GeneralSaleabilityInput {
  const advancedAssumptions = state.result.advancedAssumptions ?? null;
  const detailedConditionPercent = advancedAssumptions?.dealerAssessment?.conditionFactorPercent
    ?? advancedAssumptions?.conditionFactorPercent
    ?? null;

  if (state.kind === 'generic') {
    return {
      lifeRemainingPercent: state.result.lifeRemainingPercent,
      usageAmount: state.result.usageAmount ?? usageAmount,
      maxLifetimeUsage: state.result.maxLifetimeHours,
      lifeWorkedPercent: state.result.lifeWorkedPercent ?? lifeWorkedPercent,
      condition: state.result.condition,
      conditionFactorPercent: detailedConditionPercent,
      popularityStars: advancedAssumptions?.popularityStars ?? null,
    };
  }

  return {
    usageAmount,
    maxLifetimeUsage: state.result.maxLifetimeHours,
    lifeWorkedPercent,
    condition: fallbackCondition,
    conditionFactorPercent: detailedConditionPercent,
    popularityStars: advancedAssumptions?.popularityStars ?? null,
  };
}

function getLifetimeUnitLabel(metric: UsageMetricType): string {
  return metric === 'km' ? 'kilometres' : 'hours';
}

function selectedValueTypeLabel(_method: MethodKey): string {
  return 'Aim4price Value';
}

function normalizeReportEmail(value: unknown): string {
  const cleaned = normalizePdfValue(value);
  return cleaned && cleaned.includes('@') ? cleaned : '';
}

export default function ValuationClient({ dealerAppMode = false, ownerAppMode = false }: { dealerAppMode?: boolean; ownerAppMode?: boolean } = {}) {
  const router = useRouter();
  const compactAppMode = dealerAppMode || ownerAppMode;
  const appHomePath = ownerAppMode ? '/owner-app' : dealerAppMode ? '/dealer' : '/';
  const marketplacePath = ownerAppMode ? '/owner-app/marketplace' : dealerAppMode ? '/dealer/marketplace' : '/marketplace';
  const [step, setStep] = useState<Step>(1);
  const [selectedSector, setSelectedSector] = useState<SectorKey | null>(null);
  const [families, setFamilies] = useState<EquipmentFamilyRecord[]>([]);
  const [familiesLoading, setFamiliesLoading] = useState(false);
  const [familySearch, setFamilySearch] = useState('');
  const [equipmentDropdownOpen, setEquipmentDropdownOpen] = useState(false);
  const [familyKey, setFamilyKey] = useState('');
  const [motorSubtypeValue, setMotorSubtypeValue] = useState('');
  const [motorSubtypeDropdownOpen, setMotorSubtypeDropdownOpen] = useState(false);
  const [brands, setBrands] = useState<BrandRow[]>([]);
  const [brandsLoading, setBrandsLoading] = useState(false);
  const [brandSearch, setBrandSearch] = useState('');
  const [brandDropdownOpen, setBrandDropdownOpen] = useState(false);
  const [brandSlug, setBrandSlug] = useState('');
  const [unlistedBrandName, setUnlistedBrandName] = useState('');
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
  const [genericModelLookupKey, setGenericModelLookupKey] = useState('');
  const [genericModelsFullyLoadedKey, setGenericModelsFullyLoadedKey] = useState('');
  const [genericModelQuery, setGenericModelQuery] = useState('');
  const [genericModelDropdownOpen, setGenericModelDropdownOpen] = useState(false);
  const [genericModelId, setGenericModelId] = useState('');
  const [genericModelMode, setGenericModelMode] = useState<GenericModelSelectionMode>('');
  const [motorCanonicalQuery, setMotorCanonicalQuery] = useState('');
  const [motorCanonicalResults, setMotorCanonicalResults] = useState<MotorCanonicalModelResult[]>([]);
  const [motorCanonicalLoading, setMotorCanonicalLoading] = useState(false);
  const [motorCanonicalSearchError, setMotorCanonicalSearchError] = useState('');
  const [motorCanonicalDropdownOpen, setMotorCanonicalDropdownOpen] = useState(false);
  const [motorCanonicalModelId, setMotorCanonicalModelId] = useState('');
  const [motorSelectedTypeKey, setMotorSelectedTypeKey] = useState('');
  const [motorTypeDropdownOpen, setMotorTypeDropdownOpen] = useState(false);
  const [specQuestions, setSpecQuestions] = useState<SpecQuestion[]>([]);
  const [specAnswers, setSpecAnswers] = useState<Record<string, string>>({});
  const [openSpecDropdownKey, setOpenSpecDropdownKey] = useState<string | null>(null);
  const [typedModelName, setTypedModelName] = useState('');
  const [year, setYear] = useState(String(CURRENT_YEAR));
  const [usageAmount, setUsageAmount] = useState('');
  const [condition, setCondition] = useState<ConditionKey>('good');
  const [frontPto, setFrontPto] = useState(false);
  const [frontLoader, setFrontLoader] = useState(false);
  const [frontLoaderYear, setFrontLoaderYear] = useState('');
  const [gpsEnabled, setGpsEnabled] = useState(false);
  const [gpsType, setGpsType] = useState<GpsType>('guidance-only');
  const [gpsTypeDropdownOpen, setGpsTypeDropdownOpen] = useState(false);
  const [gpsYear, setGpsYear] = useState('');
  const [frontPtoReplacementPrice, setFrontPtoReplacementPrice] = useState('');
  const [frontLoaderReplacementPrice, setFrontLoaderReplacementPrice] = useState('');
  const [gpsReplacementPrice, setGpsReplacementPrice] = useState('');
  const [otherExtraEnabled, setOtherExtraEnabled] = useState(false);
  const [otherExtraName, setOtherExtraName] = useState('');
  const [otherExtraReplacementPrice, setOtherExtraReplacementPrice] = useState('');
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
  const [vatDisplayMode, setVatDisplayMode] = useState<VatDisplayMode>('excl');
  const [advancedPanelOpen, setAdvancedPanelOpen] = useState(false);
  const [advancedLifetimeUsage, setAdvancedLifetimeUsage] = useState('');
  const [advancedConditionFactorPercent, setAdvancedConditionFactorPercent] = useState('');
  const [advancedRecalculateLoading, setAdvancedRecalculateLoading] = useState(false);
  const [advancedError, setAdvancedError] = useState('');
  const [detailedAssessmentOpen, setDetailedAssessmentOpen] = useState(false);
  const [activeDetailedAssessmentSection, setActiveDetailedAssessmentSection] = useState('');
  const [dealerMechanicalCondition, setDealerMechanicalCondition] = useState('');
  const [dealerBodyCondition, setDealerBodyCondition] = useState('');
  const [dealerTyreCondition, setDealerTyreCondition] = useState('');
  const [dealerServiceHistory, setDealerServiceHistory] = useState('');
  const [dealerRequiredWork, setDealerRequiredWork] = useState('');
  const [popularityStars, setPopularityStars] = useState(0);
  const [detailedAssessmentError, setDetailedAssessmentError] = useState('');
  const [replacementNoticeOpen, setReplacementNoticeOpen] = useState(false);
  const [saveLoading, setSaveLoading] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfError, setPdfError] = useState('');
  const [saleabilityOpen, setSaleabilityOpen] = useState(false);
  const [finalSaveIntent, setFinalSaveIntent] = useState<FinalSaveIntent | null>(null);
  const [finalSaveError, setFinalSaveError] = useState('');
  const [savedMarketplaceAssetId, setSavedMarketplaceAssetId] = useState<string | null>(null);
  const [isSignedIn, setIsSignedIn] = useState(false);
  const [guestValuationCount, setGuestValuationCount] = useState(0);
  const [marketplaceMode, setMarketplaceMode] = useState(false);
  const [conversionAssetId, setConversionAssetId] = useState<string | null>(null);
  const [conversionSourceAsset, setConversionSourceAsset] = useState<ConversionSourceAsset | null>(null);
  const [conversionPrefillLoaded, setConversionPrefillLoaded] = useState(false);
  const [accountType, setAccountType] = useState('public');
  const [accountantShareId, setAccountantShareId] = useState('');
  const [accountantRegisterId, setAccountantRegisterId] = useState('');
  const [accountProfile, setAccountProfile] = useState<AccountProfile | null>(null);
  const [adBrandKits, setAdBrandKits] = useState<AdBrandKit[]>([]);
  const [marketplaceDraft, setMarketplaceDraft] = useState<MarketplacePublishDraft | null>(null);
  const [marketplaceIntroOpen, setMarketplaceIntroOpen] = useState(false);
  const [marketplacePhotoFiles, setMarketplacePhotoFiles] = useState<MarketplacePendingPhoto[]>([]);
  const [marketplacePublishError, setMarketplacePublishError] = useState('');
  const [isPublishingMarketplace, setIsPublishingMarketplace] = useState(false);
  const [publishedAdvertDownload, setPublishedAdvertDownload] = useState<PublishedAdvertDownload | null>(null);
  const [isDownloadingPublishedAdvert, setIsDownloadingPublishedAdvert] = useState(false);
  const [replacementPanelOpen, setReplacementPanelOpen] = useState(false);
  const [completionToastVisible, setCompletionToastVisible] = useState(false);
  const marketplacePhotoInputRef = useRef<HTMLInputElement | null>(null);
  const replacementNoticeDialogRef = useRef<HTMLElement | null>(null);
  const replacementNoticeGoBackRef = useRef<HTMLButtonElement | null>(null);
  const replacementNoticeReturnFocusRef = useRef<HTMLElement | null>(null);
  const genericModelPrefilledSpecKeysRef = useRef<Set<string>>(new Set());
  const requiredQuestionsCompletedRef = useRef(false);
  const completionToastTimerRef = useRef<number | null>(null);
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
  const selectedMotorSubtypeConfig = useMemo(
    () => getMotorSubtypeConfig(selectedSector, selectedFamily?.familyKey),
    [selectedSector, selectedFamily],
  );
  const selectedMotorSubtypeOption = useMemo(
    () => getMotorSubtypeOption(selectedMotorSubtypeConfig, motorSubtypeValue),
    [selectedMotorSubtypeConfig, motorSubtypeValue],
  );
  const selectedMotorSubtypeSpecs = useMemo(
    () => getMotorSubtypeSpecs(selectedMotorSubtypeConfig, selectedMotorSubtypeOption),
    [selectedMotorSubtypeConfig, selectedMotorSubtypeOption],
  );
  const selectedMotorSubtypeSpecKeys = useMemo(
    () => getMotorSubtypeSpecKeys(selectedMotorSubtypeConfig),
    [selectedMotorSubtypeConfig],
  );
  const motorSubtypeRequired = Boolean(selectedMotorSubtypeConfig);
  const brandsWithUnknown = useMemo(() => {
    const seenSlugs = new Set<string>([UNKNOWN_BRAND_SLUG]);
    const realBrands = brands.filter((brand) => {
      const slug = normalizeText(brand.slug).toLowerCase();
      const name = normalizeText(brand.name);
      if (!slug || !name || seenSlugs.has(slug)) return false;
      seenSlugs.add(slug);
      return true;
    });

    return [UNKNOWN_BRAND_OPTION, ...realBrands];
  }, [brands]);

  const selectedBrand = useMemo(
    () => brandsWithUnknown.find((brand) => brand.slug === brandSlug) ?? null,
    [brandsWithUnknown, brandSlug],
  );
  const selectedBrandIsUnknown = isUnknownBrandSlug(selectedBrand?.slug ?? brandSlug);
  const currentGenericModelLookupKey = `${selectedSector ?? ''}|${selectedFamily?.familyKey ?? ''}|${brandSlug}`;
  const genericModelAvailabilityChecked = Boolean(
    selectedSector &&
      selectedFamily &&
      brandSlug &&
      !selectedBrandIsUnknown &&
      genericModelLookupKey === currentGenericModelLookupKey,
  );
  const selectedModel = useMemo(
    () => tractorModels.find((model) => model.id === modelId) ?? null,
    [tractorModels, modelId],
  );
  const selectedGenericModel = useMemo(
    () => genericCatalogModels.find((model) => String(model.id) === genericModelId) ?? null,
    [genericCatalogModels, genericModelId],
  );

  const selectedMotorCanonicalModel = useMemo(
    () => motorCanonicalResults.find((model) => model.id === motorCanonicalModelId) ?? null,
    [motorCanonicalResults, motorCanonicalModelId],
  );
  const selectedMotorTypeOption = useMemo(
    () => selectedMotorCanonicalModel?.typeOptions.find((option) => option.value === motorSelectedTypeKey) ?? null,
    [selectedMotorCanonicalModel, motorSelectedTypeKey],
  );
  const motorTypeOptions = selectedMotorCanonicalModel?.typeOptions ?? [];
  const motorTypeRequiredForSelectedModel = motorTypeOptions.length > 1;
  const motorSearchFlowActive = isMotorSector(selectedSector);
  const submittedGenericModelName =
    genericModelMode === 'catalog'
      ? getGenericModelSubmitName(selectedGenericModel)
      : genericModelMode === 'manual'
        ? normalizeText(typedModelName)
        : '';
  const shouldSaveGenericModelCandidate = genericModelMode === 'manual' && !selectedBrandIsUnknown && Boolean(normalizeText(typedModelName));
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
    const realMatches = brandsWithUnknown.filter((brand) => {
      if (isUnknownBrandSlug(brand.slug)) return false;
      return searchIncludes(`${brand.name} ${brand.slug}`, brandSearch);
    });

    if (!query) return [UNKNOWN_BRAND_OPTION, ...realMatches];

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

    return [UNKNOWN_BRAND_OPTION, ...realMatches.sort((a, b) => scoreBrand(a) - scoreBrand(b) || a.name.localeCompare(b.name))];
  }, [brandsWithUnknown, brandSearch]);

  const genericCatalogModelsForSelectedSubtype = useMemo(() => {
    if (!selectedMotorSubtypeConfig || !selectedMotorSubtypeOption) return genericCatalogModels;
    return genericCatalogModels.filter((model) =>
      modelMatchesMotorSubtype(model, selectedMotorSubtypeConfig, selectedMotorSubtypeOption),
    );
  }, [genericCatalogModels, selectedMotorSubtypeConfig, selectedMotorSubtypeOption]);

  const exactTractorAvailable = selectedFamily?.familyKey === 'tractors' && selectedFamily.catalogMode === 'hybrid';
  const exactModelRowsAvailable =
    genericModelAvailabilityChecked &&
    (!motorSubtypeRequired || Boolean(motorSubtypeValue)) &&
    genericCatalogModelsForSelectedSubtype.length > 0;
  const genericExactModelPath = flowMode === 'exact_model' && !exactTractorAvailable && exactModelRowsAvailable && !selectedBrandIsUnknown;
  const motorCanonicalPricingPath = motorSearchFlowActive && Boolean(selectedGenericModel);
  const motorExactModelPricingPath = motorSearchFlowActive && (genericExactModelPath || motorCanonicalPricingPath);
  const genericValuationPath = flowMode === 'generic_specs' || genericExactModelPath || motorCanonicalPricingPath;
  const genericModelRequired = genericExactModelPath || motorCanonicalPricingPath;
  const shouldAskGenericSpecQuestions = genericValuationPath && (!genericExactModelPath || motorExactModelPricingPath);
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
    const matches = genericCatalogModelsForSelectedSubtype.filter((model) => {
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
  }, [genericCatalogModelsForSelectedSubtype, genericModelQuery]);

  const yearNumber = Number(year);
  const calculationYear = yearModelUnknown || !Number.isInteger(yearNumber) ? CURRENT_YEAR : yearNumber;
  const usageNumber = toNumberOrNull(usageAmount);
  const lifeWorkedPercentNumber = toPercentOrNull(lifeWorkedPercent);
  const effectiveSpecQuestions = useMemo(
    () => mergeSpecQuestions(
      specQuestions,
      shouldAskGenericSpecQuestions
        ? getMotorPricingSpecQuestions(selectedSector, selectedFamily, selectedGenericModel)
        : [],
    ),
    [specQuestions, shouldAskGenericSpecQuestions, selectedSector, selectedFamily, selectedGenericModel],
  );
  const specsJson = useMemo(() => buildSpecPayload(effectiveSpecQuestions, specAnswers), [effectiveSpecQuestions, specAnswers]);
  const enrichedSpecsJson = useMemo(() => {
    const typedUnlistedBrandName = selectedBrandIsUnknown ? normalizeText(unlistedBrandName) : '';
    const savedYearModel = !yearModelUnknown && Number.isInteger(yearNumber) && yearNumber >= 1800 && yearNumber <= CURRENT_YEAR + 1
      ? Math.round(yearNumber)
      : null;
    const usesPercentageBasis = usageNumber === null && lifeWorkedPercentNumber !== null;
    const readingUsageMode = selectedFamily?.usageMetricType === 'km' ? 'km' : 'hours';

    return {
      ...(genericValuationPath && selectedGenericModel ? normalizeGenericSpecsRecord(selectedGenericModel.specsJson) : {}),
      ...(genericValuationPath && selectedGenericModel
        ? {
            catalog_model_id: selectedGenericModel.id,
            aim4_model_key: selectedGenericModel.aim4ModelKey ?? normalizeGenericSpecsRecord(selectedGenericModel.specsJson).aim4_model_key,
            selected_model_key: selectedGenericModel.aim4ModelKey ?? normalizeGenericSpecsRecord(selectedGenericModel.specsJson).aim4_model_key,
          }
        : {}),
      ...specsJson,
      ...selectedMotorSubtypeSpecs,
      ...(isMotorSector(selectedSector) ? getMotorCanonicalTypeSpecs(selectedFamily?.familyKey, selectedMotorTypeOption) : {}),
      ...(isMotorSector(selectedSector) && selectedMotorCanonicalModel
        ? {
            canonical_model_label: selectedMotorCanonicalModel.displayLabel,
            canonical_model_key: selectedMotorCanonicalModel.modelKey,
            motor_type_required: motorTypeRequiredForSelectedModel,
          }
        : {}),
      ...(typedUnlistedBrandName
        ? {
            [UNLISTED_BRAND_NAME_SPEC_KEY]: typedUnlistedBrandName,
            [TYPED_BRAND_NAME_SPEC_KEY]: typedUnlistedBrandName,
          }
        : {}),
      ...(usesPercentageBasis
        ? {
            usageMode: 'percent',
            usage_mode: 'percent',
            usageBasis: 'percent',
            usage_basis: 'percent',
          }
        : {
            usageMode: readingUsageMode,
            usage_mode: readingUsageMode,
            usageBasis: 'reading',
            usage_basis: 'reading',
          }),
      ...(lifeWorkedPercentNumber !== null
        ? {
            lifeWorkedPercent: lifeWorkedPercentNumber,
            life_worked_percent: lifeWorkedPercentNumber,
            workedPercent: lifeWorkedPercentNumber,
            worked_percent: lifeWorkedPercentNumber,
            percentWorked: lifeWorkedPercentNumber,
            percent_worked: lifeWorkedPercentNumber,
            lifetimeWorkedPercent: lifeWorkedPercentNumber,
            lifetime_worked_percent: lifeWorkedPercentNumber,
            lifetimeUsedPercent: lifeWorkedPercentNumber,
            lifetime_used_percent: lifeWorkedPercentNumber,
          }
        : {}),
      ...(yearModelUnknown
        ? { yearModelUnknown: true, year_model_unknown: true }
        : {
            yearModelUnknown: false,
            year_model_unknown: false,
            ...(savedYearModel !== null
              ? {
                  yearModel: savedYearModel,
                  year_model: savedYearModel,
                  displayYearModel: savedYearModel,
                  display_year_model: savedYearModel,
                  assetYearModel: savedYearModel,
                  asset_year_model: savedYearModel,
                  currentYearModel: savedYearModel,
                  current_year_model: savedYearModel,
                }
              : {}),
          }),
    };
  }, [
    genericValuationPath,
    selectedGenericModel,
    specsJson,
    selectedMotorSubtypeSpecs,
    selectedBrandIsUnknown,
    unlistedBrandName,
    lifeWorkedPercentNumber,
    yearModelUnknown,
    yearNumber,
    usageNumber,
    selectedFamily?.usageMetricType,
    selectedFamily?.familyKey,
    selectedSector,
    selectedMotorTypeOption,
    selectedMotorCanonicalModel,
    motorTypeRequiredForSelectedModel,
  ]);
  const headlineValue = getHeadlineValue(resultState, selectedMethod, replacementPriceBasis);
  const headlineDisplayValue = getVatDisplayValue(headlineValue, vatDisplayMode);
  const headlineVatLabel = getVatDisplayLabel(vatDisplayMode);
  const canUseAdvancedAssumptions = isSignedIn && accountProfile?.accountStatus === 'active';
  const normalizedSignedInAccountType = normalizeAccountType(accountType);
  const isDealerAccount = normalizedSignedInAccountType === 'dealer';
  const detailedAssessmentComplete = Boolean(
    dealerMechanicalCondition
      && dealerBodyCondition
      && dealerTyreCondition
      && dealerServiceHistory
      && dealerRequiredWork,
  );
  const popularityStepComplete = popularityStars >= 1 && popularityStars <= 5;
  const canUseMarketplacePublishFlow = isSignedIn && (normalizedSignedInAccountType === 'owner' || normalizedSignedInAccountType === 'dealer');
  const isAccountantClientWorkspace = normalizedSignedInAccountType === 'finance' && Boolean(accountantShareId);
  const canSaveToAssetRegister = isSignedIn && (normalizedSignedInAccountType === 'owner' || isAccountantClientWorkspace);
  const requiredSpecQuestionsCompleted = Boolean(
    conditionStepComplete &&
      popularityStepComplete &&
      shouldAskGenericSpecQuestions &&
      effectiveSpecQuestions.length > 0 &&
      effectiveSpecQuestions.every((question) => !question.isRequired || isSpecQuestionAnswered(question, specAnswers[question.specKey])),
  );

  useEffect(() => {
    const target = document.getElementById('valuation-wizard-card');
    target?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [step]);

  useEffect(() => {
    if (!replacementNoticeOpen) return undefined;

    const dialog = replacementNoticeDialogRef.current;
    const returnFocusTarget = replacementNoticeReturnFocusRef.current;
    const focusTimer = window.requestAnimationFrame(() => {
      replacementNoticeGoBackRef.current?.focus();
    });

    function handleReplacementNoticeKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault();
        setReplacementNoticeOpen(false);
        return;
      }

      if (event.key !== 'Tab' || !dialog) return;
      const focusableElements = Array.from(dialog.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ));
      if (focusableElements.length === 0) return;

      const firstFocusable = focusableElements[0];
      const lastFocusable = focusableElements[focusableElements.length - 1];
      if (event.shiftKey && (document.activeElement === firstFocusable || !dialog.contains(document.activeElement))) {
        event.preventDefault();
        lastFocusable.focus();
      } else if (!event.shiftKey && document.activeElement === lastFocusable) {
        event.preventDefault();
        firstFocusable.focus();
      }
    }

    document.addEventListener('keydown', handleReplacementNoticeKeyDown);
    return () => {
      window.cancelAnimationFrame(focusTimer);
      document.removeEventListener('keydown', handleReplacementNoticeKeyDown);
      returnFocusTarget?.focus();
    };
  }, [replacementNoticeOpen]);

  useEffect(() => {
    if (!resultState) {
      setAdvancedLifetimeUsage('');
      setAdvancedConditionFactorPercent('');
      setAdvancedError('');
      return;
    }

    const appliedAdvancedAssumptions = getAppliedAdvancedAssumptionsFromState(resultState);
    const defaultLifetime = getResultMaxLifetimeUsage(resultState);
    const resultCondition = resultState.kind === 'generic' ? resultState.result.condition : condition;
    const conditionFactorPercent =
      appliedAdvancedAssumptions?.conditionFactorPercent ?? getDefaultConditionFactorPercent(resultCondition);

    setAdvancedLifetimeUsage(defaultLifetime !== null ? String(Math.round(defaultLifetime)) : '');
    setAdvancedConditionFactorPercent(formatAdvancedPercent(conditionFactorPercent));
    setAdvancedError('');
  }, [resultState, condition]);

  useEffect(() => {
    if (!resultState) return;
    const assessment = getAppliedDealerAssessmentFromState(resultState);
    if (!assessment) {
      setDetailedAssessmentOpen(false);
      setDealerMechanicalCondition('');
      setDealerBodyCondition('');
      setDealerTyreCondition('');
      setDealerServiceHistory('');
      setDealerRequiredWork('');
      setPopularityStars(getAppliedAdvancedAssumptionsFromState(resultState)?.popularityStars ?? 0);
      setDetailedAssessmentError('');
      return;
    }

    setDetailedAssessmentOpen(true);
    setDealerMechanicalCondition(assessment.mechanicalCondition);
    setDealerBodyCondition(assessment.bodyCondition);
    setDealerTyreCondition(assessment.tyreCondition);
    setDealerServiceHistory(assessment.serviceHistory);
    setDealerRequiredWork(assessment.requiredWork);
    setPopularityStars(getAppliedAdvancedAssumptionsFromState(resultState)?.popularityStars ?? 0);
    setDetailedAssessmentError('');
  }, [resultState]);

  useEffect(() => {
    if (requiredSpecQuestionsCompleted && !requiredQuestionsCompletedRef.current) {
      setCompletionToastVisible(true);

      if (completionToastTimerRef.current) {
        window.clearTimeout(completionToastTimerRef.current);
      }

      completionToastTimerRef.current = window.setTimeout(() => {
        setCompletionToastVisible(false);
        completionToastTimerRef.current = null;
      }, 2600);
    }

    requiredQuestionsCompletedRef.current = requiredSpecQuestionsCompleted;
  }, [requiredSpecQuestionsCompleted]);

  useEffect(() => () => {
    if (completionToastTimerRef.current) {
      window.clearTimeout(completionToastTimerRef.current);
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    const searchParams = new URLSearchParams(window.location.search);
    setAccountantShareId(normalizeText(searchParams.get('accountantShareId')));
    setAccountantRegisterId(normalizeText(searchParams.get('registerId')));
    const nextConversionAssetId = normalizeText(searchParams.get('convertAssetId') ?? searchParams.get('conversionAssetId'));
    const nextConversionMode = searchParams.get('conversion') === 'manual-to-aim4price' || Boolean(nextConversionAssetId);
    const nextMarketplaceMode = !nextConversionMode && (searchParams.get('marketplace') === '1' || searchParams.get('marketplaceListing') === '1');
    let cancelled = false;

    setMarketplaceMode(nextMarketplaceMode);
    setConversionAssetId(nextConversionAssetId || null);

    if (nextConversionMode && nextConversionAssetId) {
      setMarketplaceIntroOpen(false);
      setMessage('Conversion mode: complete the Aim4price estimate, then Save to update the existing manual asset.');
      setConversionPrefillLoaded(false);

      void (async () => {
        try {
          const response = await fetch('/api/asset-register', { credentials: 'include', cache: 'no-store' });
          const data = (await response.json()) as AssetRegisterListApiResponse;

          if (!response.ok || !data.ok) {
            throw new Error(data.error ?? 'Could not load the manual asset for conversion.');
          }

          if (cancelled) return;

          const sourceAsset = [...(data.items ?? []), ...(data.assets ?? [])].find((asset) => asset.id === nextConversionAssetId) ?? null;
          if (!sourceAsset) {
            throw new Error('The manual asset being converted could not be found.');
          }

          setConversionSourceAsset(sourceAsset);

          const specsJson = sourceAsset.specsJson ?? {};
          const brandName = normalizeText(
            sourceAsset.brandName ?? specsJson.brandName ?? specsJson.brand_name ?? specsJson.brand ?? specsJson.make,
          );
          const modelName = normalizeText(
            sourceAsset.modelName ?? sourceAsset.typedModelName ?? specsJson.modelName ?? specsJson.model_name ?? specsJson.model ?? sourceAsset.title,
          );
          const assetYear = Number(sourceAsset.yearModel);
          const assetHours = Number(sourceAsset.hours);
          const assetLifeWorkedPercent = readConversionLifeWorkedPercent(sourceAsset);
          const assetCondition = normalizeConversionCondition(sourceAsset.condition ?? specsJson.condition);
          const assetReplacementPrice = readConversionReplacementPrice(sourceAsset);

          if (brandName) {
            setBrandSearch(brandName);
            setUnlistedBrandName(brandName);
          }

          if (modelName) {
            setTypedModelName(modelName);
            setModelQuery(modelName);
            setGenericModelQuery(modelName);
            setMotorCanonicalQuery(modelName);
          }

          if (Number.isInteger(assetYear) && assetYear > 1800) {
            setYear(String(assetYear));
            setYearModelUnknown(false);
            setYearStepComplete(true);
          }

          if (assetLifeWorkedPercent !== null) {
            setLifeWorkedPercent(String(assetLifeWorkedPercent));
            setUsageModalMode('percent');
            setUsageStepComplete(true);
          } else if (Number.isFinite(assetHours) && assetHours >= 0) {
            setUsageAmount(String(Math.round(assetHours)));
            setUsageModalMode('hours');
            setUsageStepComplete(true);
          }

          if (assetCondition) {
            setCondition(assetCondition);
            setConditionStepComplete(true);
          }

          if (assetReplacementPrice !== null) {
            setUserReplacementPrice(String(assetReplacementPrice));
            setReplacementPriceBasis('user');
          }

          setConversionPrefillLoaded(true);
        } catch (error) {
          if (!cancelled) {
            setMessage(error instanceof Error ? error.message : 'Could not load the manual asset for conversion.');
            setConversionPrefillLoaded(true);
          }
        }
      })();

      return () => {
        cancelled = true;
      };
    }

    setConversionSourceAsset(null);
    setConversionPrefillLoaded(true);

    if (!nextMarketplaceMode) {
      setMarketplaceIntroOpen(false);
      return undefined;
    }

    try {
      setMarketplaceIntroOpen(window.localStorage.getItem(MARKETPLACE_INTRO_DISMISSED_KEY) !== '1');
    } catch {
      setMarketplaceIntroOpen(true);
    }

    return () => {
      cancelled = true;
    };
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
        let resolvedAccountType = signedIn ? normalizeAccountType(data.user?.accountType ?? 'owner') : 'public';
        setIsSignedIn(signedIn);
        setAccountType(resolvedAccountType);

        if (signedIn) {
          try {
            const profileResponse = await fetch('/api/account-profile', { credentials: 'include', cache: 'no-store' });
            const profileData = (await profileResponse.json()) as AccountProfileApiResponse;
            if (mounted && profileResponse.ok && profileData.ok) {
              setAccountProfile(profileData.profile ?? null);
              resolvedAccountType = normalizeAccountType(profileData.profile?.accountType ?? data.user?.accountType ?? 'owner');
              setAccountType(resolvedAccountType);
            }
          } catch {
            if (mounted) setAccountProfile(null);
          }

          if (resolvedAccountType === 'dealer') {
            try {
              const brandKitsResponse = await fetch('/api/ad-studio/brand-kits', { credentials: 'include', cache: 'no-store' });
              const brandKitsData = (await brandKitsResponse.json()) as AdBrandKitsApiResponse;
              if (mounted && brandKitsResponse.ok && brandKitsData.ok) {
                setAdBrandKits(brandKitsData.kits ?? []);
              }
            } catch {
              if (mounted) setAdBrandKits([]);
            }
          } else if (mounted) {
            setAdBrandKits([]);
          }
        } else {
          setAccountProfile(null);
          setAdBrandKits([]);
        }
      } catch {
        if (!mounted) return;
        setIsSignedIn(false);
        setAccountType('public');
        setAccountProfile(null);
        setAdBrandKits([]);
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
    if (!isMotorSector(selectedSector)) return;

    const query = normalizeText(motorCanonicalQuery);
    if (query.length < 2) {
      setMotorCanonicalResults([]);
      setMotorCanonicalLoading(false);
      setMotorCanonicalSearchError('');
      return;
    }

    let ignore = false;
    const timer = window.setTimeout(() => {
      setMotorCanonicalLoading(true);
      setMotorCanonicalSearchError('');

      const params = new URLSearchParams({ search: query, limit: '25' });
      fetch(`/api/motor-model-search?${params.toString()}`, { cache: 'no-store' })
        .then(async (response) => {
          const data = (await response.json()) as MotorModelSearchApiResponse;
          if (!response.ok || !data.ok || !Array.isArray(data.models)) {
            throw new Error(data.error ?? 'Failed to search Motor models.');
          }
          if (!ignore) setMotorCanonicalResults(data.models);
        })
        .catch((error) => {
          console.error(error);
          if (!ignore) {
            setMotorCanonicalResults([]);
            setMotorCanonicalSearchError(error instanceof Error ? error.message : 'Failed to search Motor models.');
          }
        })
        .finally(() => {
          if (!ignore) setMotorCanonicalLoading(false);
        });
    }, 220);

    return () => {
      ignore = true;
      window.clearTimeout(timer);
    };
  }, [selectedSector, motorCanonicalQuery]);

  useEffect(() => {
    let ignore = false;

    setFamilies([]);
    setFamilyKey('');
    setMotorSubtypeValue('');
    setMotorSubtypeDropdownOpen(false);
    setFamilySearch('');
    setEquipmentDropdownOpen(compactAppMode && Boolean(selectedSector));
    setBrandSearch('');
    setBrandDropdownOpen(false);
    setBrands([]);
    setBrandSlug('');
    setUnlistedBrandName('');
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
    setGenericModelLookupKey('');
    setGenericModelsFullyLoadedKey('');
    clearGenericModelSelection({ clearManual: true, clearPrefilledSpecs: true });
    setMotorCanonicalQuery('');
    setMotorCanonicalResults([]);
    setMotorCanonicalLoading(false);
    setMotorCanonicalSearchError('');
    setMotorCanonicalDropdownOpen(false);
    setMotorCanonicalModelId('');
    setMotorSelectedTypeKey('');
    setMotorTypeDropdownOpen(false);
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
    clearDetailedAssessment();
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
  }, [compactAppMode, selectedSector]);

  useEffect(() => {
    if (!selectedFamily || !selectedSector) return;

    if (isMotorSector(selectedSector)) {
      setBrandsLoading(false);
      return;
    }

    const sectorForRequest = selectedSector;
    const familyForRequest = selectedFamily;
    const familyKeyForRequest = familyForRequest.familyKey;
    const nextFlowMode: FlowMode = '';

    setResultState(null);
    setSelectedMethod('aim4price');
    setReplacementPriceBasis('aim4price');
    setFinalSaveIntent(null);
    setFinalSaveError('');
    setSavedMarketplaceAssetId(null);
    setMotorSubtypeValue('');
    setMotorSubtypeDropdownOpen(false);
    setBrandSearch('');
    setBrandDropdownOpen(compactAppMode);
    setBrandSlug('');
    setUnlistedBrandName('');
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
    setGenericModelLookupKey('');
    setGenericModelsFullyLoadedKey('');
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
    clearDetailedAssessment();
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
        const response = await fetch(`/api/brands?${params.toString()}`);
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
  }, [compactAppMode, selectedFamily, selectedSector]);

  useEffect(() => {
    let ignore = false;

    setSpecQuestions([]);
    setSpecAnswers({});

    if (!selectedFamily || !selectedSector || !shouldAskGenericSpecQuestions || isMotorSector(selectedSector)) {
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
  }, [selectedFamily, selectedSector, shouldAskGenericSpecQuestions]);

  useEffect(() => {
    if (!brandSlug || selectedBrandIsUnknown || !exactTractorAvailable || !exactModelRowsAvailable || flowMode !== 'exact_model' || !tractorType || !drive || !cab) {
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
  }, [brandSlug, selectedBrandIsUnknown, exactTractorAvailable, exactModelRowsAvailable, flowMode, tractorType, drive, cab]);

  useEffect(() => {
    if (!selectedSector || !selectedFamily || !brandSlug || selectedBrandIsUnknown) {
      setGenericCatalogModels([]);
      setGenericModelsLoading(false);
      setGenericModelLookupKey('');
      setGenericModelsFullyLoadedKey('');
      if (!selectedBrandIsUnknown) {
        clearGenericModelSelection({ clearManual: true, clearPrefilledSpecs: true });
      }
      return;
    }

    if (isMotorSector(selectedSector)) {
      setGenericModelsLoading(false);
      return;
    }

    const sectorForRequest = selectedSector;
    const familyKeyForRequest = selectedFamily.familyKey;
    const brandSlugForRequest = brandSlug;
    const lookupKeyForRequest = currentGenericModelLookupKey;

    let ignore = false;
    setGenericModelsLoading(true);
    setGenericCatalogModels([]);
    setGenericModelLookupKey('');
    setGenericModelsFullyLoadedKey('');
    clearGenericModelSelection({ clearManual: true, clearPrefilledSpecs: true });

    async function loadGenericCatalogModels() {
      try {
        const params = new URLSearchParams({
          sectorKey: sectorForRequest,
          familyKey: familyKeyForRequest,
          brandSlug: brandSlugForRequest,
          limit: '1',
        });
        const response = await fetch(`/api/equipment-models?${params.toString()}`);
        const data = (await response.json()) as EquipmentModelsApiResponse;
        if (!response.ok || !data.ok || !Array.isArray(data.models)) throw new Error(data.error ?? 'Failed to load catalogue models.');
        if (!ignore) {
          setGenericCatalogModels(data.models);
          setGenericModelLookupKey(lookupKeyForRequest);
        }
      } catch (error) {
        console.error(error);
        if (!ignore) {
          setGenericCatalogModels([]);
          setGenericModelLookupKey(lookupKeyForRequest);
        }
      } finally {
        if (!ignore) setGenericModelsLoading(false);
      }
    }

    void loadGenericCatalogModels();
    return () => {
      ignore = true;
    };
  }, [selectedSector, selectedFamily, brandSlug, selectedBrandIsUnknown, currentGenericModelLookupKey]);

  useEffect(() => {
    if (
      flowMode !== 'exact_model'
      || exactTractorAvailable
      || !genericModelAvailabilityChecked
      || !exactModelRowsAvailable
      || genericModelsFullyLoadedKey === currentGenericModelLookupKey
    ) {
      return;
    }

    const sectorForRequest = selectedSector;
    const familyKeyForRequest = selectedFamily?.familyKey;
    const brandSlugForRequest = brandSlug;
    const lookupKeyForRequest = currentGenericModelLookupKey;
    if (!sectorForRequest || !familyKeyForRequest || !brandSlugForRequest) return;
    const modelRequestParams = {
      sectorKey: sectorForRequest,
      familyKey: familyKeyForRequest,
      brandSlug: brandSlugForRequest,
      limit: '500',
    };

    let ignore = false;
    setGenericModelsLoading(true);

    async function loadFullGenericCatalog() {
      try {
        const params = new URLSearchParams(modelRequestParams);
        const response = await fetch(`/api/equipment-models?${params.toString()}`);
        const data = (await response.json()) as EquipmentModelsApiResponse;
        if (!response.ok || !data.ok || !Array.isArray(data.models)) throw new Error(data.error ?? 'Failed to load catalogue models.');
        if (!ignore) {
          setGenericCatalogModels(data.models);
          setGenericModelsFullyLoadedKey(lookupKeyForRequest);
        }
      } catch (error) {
        console.error(error);
      } finally {
        if (!ignore) setGenericModelsLoading(false);
      }
    }

    void loadFullGenericCatalog();
    return () => {
      ignore = true;
    };
  }, [
    flowMode,
    exactTractorAvailable,
    genericModelAvailabilityChecked,
    exactModelRowsAvailable,
    genericModelsFullyLoadedKey,
    currentGenericModelLookupKey,
    selectedSector,
    selectedFamily,
    brandSlug,
  ]);

  useEffect(() => {
    if (!selectedFamily || !brandSlug) return;
    if (isMotorSector(selectedSector)) return;

    if (selectedBrandIsUnknown) {
      if (flowMode !== 'generic_specs') setFlowMode('generic_specs');
      setModelId('');
      setModelQuery('');
      setModelDropdownOpen(false);
      setTractorModels([]);
      setModelsLoading(false);
      return;
    }

    if (genericModelAvailabilityChecked && !exactModelRowsAvailable && flowMode !== 'generic_specs') {
      setFlowMode('generic_specs');
      setModelId('');
      setModelQuery('');
      setModelDropdownOpen(false);
      setTractorModels([]);
      setModelsLoading(false);
      resetResult();
    }
  }, [
    selectedFamily,
    brandSlug,
    selectedBrandIsUnknown,
    genericModelAvailabilityChecked,
    exactModelRowsAvailable,
    flowMode,
  ]);

  useEffect(() => {
    if (!genericValuationPath || genericModelMode !== 'catalog' || !selectedGenericModel) return;
    applyGenericModelSpecDefaults(selectedGenericModel);
  }, [genericValuationPath, genericModelMode, selectedGenericModel, specQuestions]);

  useEffect(() => {
    if (resultState?.kind !== 'tractor') return;
    const currentResult = resultState.result;
    setFrontPtoReplacementPrice(currentResult.frontPtoReplacementPriceExVat ? String(currentResult.frontPtoReplacementPriceExVat) : '');
    setFrontLoaderReplacementPrice(currentResult.frontLoaderReplacementPriceExVat ? String(currentResult.frontLoaderReplacementPriceExVat) : '');
    setGpsReplacementPrice(currentResult.gpsReplacementPriceExVat ? String(currentResult.gpsReplacementPriceExVat) : '');
    setOtherExtraEnabled(Boolean(currentResult.otherExtraName && currentResult.otherExtraReplacementPriceExVat));
    setOtherExtraName(currentResult.otherExtraName ?? '');
    setOtherExtraReplacementPrice(
      currentResult.otherExtraReplacementPriceExVat ? String(currentResult.otherExtraReplacementPriceExVat) : '',
    );
  }, [resultState]);

  function resetResult() {
    setResultState(null);
    setSelectedMethod('aim4price');
    setReplacementPriceBasis('aim4price');
    setReplacementPanelOpen(false);
    setVatDisplayMode(getDefaultVatDisplayMode(selectedSector, selectedFamily?.familyKey));
    setAdvancedPanelOpen(false);
    setAdvancedLifetimeUsage('');
    setAdvancedConditionFactorPercent('');
    setAdvancedRecalculateLoading(false);
    setAdvancedError('');
    setFinalSaveIntent(null);
    setFinalSaveError('');
    setPdfError('');
    setSavedMarketplaceAssetId(null);
  }

  function getTractorExtrasRequestFields() {
    return {
      frontPto,
      frontLoader,
      frontLoaderYear: frontLoader ? normalizeText(frontLoaderYear) || null : null,
      gpsEnabled,
      gpsType,
      gpsYear,
      frontPtoReplacementPriceExVat: frontPto ? parseMoneyInput(frontPtoReplacementPrice) : null,
      frontLoaderReplacementPriceExVat: frontLoader ? parseMoneyInput(frontLoaderReplacementPrice) : null,
      gpsReplacementPriceExVat: gpsEnabled ? parseMoneyInput(gpsReplacementPrice) : null,
      otherExtraName: otherExtraEnabled ? normalizeText(otherExtraName) : null,
      otherExtraReplacementPriceExVat: otherExtraEnabled ? parseMoneyInput(otherExtraReplacementPrice) : null,
    };
  }

  function getTractorUsageRequestFields() {
    return {
      yearModelUnknown,
      usageMode: usageNumber !== null ? 'hours' : 'percent',
      lifeWorkedPercent: usageNumber === null ? lifeWorkedPercentNumber : null,
    };
  }

  function clearDetailedAssessment(resetPopularity = true) {
    setDetailedAssessmentOpen(false);
    setActiveDetailedAssessmentSection('');
    setDealerMechanicalCondition('');
    setDealerBodyCondition('');
    setDealerTyreCondition('');
    setDealerServiceHistory('');
    setDealerRequiredWork('');
    setDetailedAssessmentError('');
    if (resetPopularity) setPopularityStars(0);
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
    if (isMotorSector(selectedSector)) {
      removeGenericModelPrefilledAnswers();
      return;
    }

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
    if (!genericValuationPath) return null;

    if (isMotorSector(selectedSector)) {
      if (!selectedMotorCanonicalModel || !selectedGenericModel) return 'Search and choose the clean Motor model first.';
      if (motorTypeRequiredForSelectedModel && !motorSelectedTypeKey) return 'Choose the type for this Motor model first.';
      return null;
    }

    const manualModelName = normalizeText(typedModelName);

    if (selectedBrandIsUnknown) {
      if (genericModelMode === 'manual' && !manualModelName) {
        return compactAppMode ? 'Enter the model name or choose Unknown.' : 'Enter the model name or choose Model unknown.';
      }
      if (genericModelMode !== 'manual' && genericModelMode !== 'unknown') {
        return compactAppMode ? 'Enter a model name or choose Unknown.' : 'Enter a model name or choose Model unknown.';
      }
      return null;
    }

    if (genericModelRequired && !selectedGenericModel) {
      if (genericModelsLoading) return 'Catalogue models are still loading. Please wait.';

      return genericCatalogModelsForSelectedSubtype.length
        ? 'Choose a catalogue model first.'
        : `No catalogue models are available yet for this brand and ${getAssetTypeLabel(selectedSector)}. Aim4price will use ${getSpecsLabel(selectedSector)}.`;
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
    setFrontPto(false);
    setFrontLoader(false);
    setFrontLoaderYear('');
    setGpsEnabled(false);
    setGpsYear('');
    setFrontPtoReplacementPrice('');
    setFrontLoaderReplacementPrice('');
    setGpsReplacementPrice('');
    setOtherExtraEnabled(false);
    setOtherExtraName('');
    setOtherExtraReplacementPrice('');
    setCondition('good');
    setSpecAnswers(isMotorSector(selectedSector) ? getMotorCanonicalTypeSpecs(selectedFamily?.familyKey, selectedMotorTypeOption) : selectedMotorSubtypeSpecs);
    setOpenSpecDropdownKey(null);
    setGpsTypeDropdownOpen(false);
    genericModelPrefilledSpecKeysRef.current = new Set();
    clearGenericModelSelection({ clearManual: true });
    setYearStepComplete(false);
    setUsageStepComplete(false);
    setConditionStepComplete(false);
    clearDetailedAssessment();
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

    const genericPath = genericValuationPath;
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
    if (detailedAssessmentOpen && !detailedAssessmentComplete) {
      return 'Complete all five detailed asset assessment questions or use the simple condition.';
    }
    if (!popularityStepComplete) return 'Choose a popularity rating from 1 to 5 stars.';
    if (flowMode === 'exact_model' && exactTractorAvailable && !tractorSetupComplete) return 'Complete the type, drive and cab setup first.';
    if (flowMode === 'exact_model' && exactTractorAvailable && !selectedModel) return 'Choose the exact model first.';

    if (!genericPath && otherExtraEnabled) {
      if (!normalizeText(otherExtraName)) return 'Enter a name for the other extra.';
      if (!parseMoneyInput(otherExtraReplacementPrice)) return 'Enter the replacement price of the other extra, excluding VAT.';
    }

    if (!genericPath && frontLoader && normalizeText(frontLoaderYear)) {
      const parsedFrontLoaderYear = Number(frontLoaderYear);
      if (!Number.isInteger(parsedFrontLoaderYear) || parsedFrontLoaderYear < 1950 || parsedFrontLoaderYear > CURRENT_YEAR) {
        return `Enter a Front Loader year between 1950 and ${CURRENT_YEAR}, or leave it blank to use the tractor year.`;
      }
    }

    if (!genericPath && gpsEnabled && normalizeText(gpsYear)) {
      const parsedGpsYear = Number(gpsYear);
      if (!Number.isInteger(parsedGpsYear) || parsedGpsYear < 1950 || parsedGpsYear > CURRENT_YEAR) {
        return `Enter a GPS year between 1950 and ${CURRENT_YEAR}, or leave it blank to use the tractor year.`;
      }
    }

    if (genericValuationPath) {
      const genericModelMessage = validateGenericModelSelection();
      if (genericModelMessage) return genericModelMessage;

      if (shouldAskGenericSpecQuestions) {
        for (const question of effectiveSpecQuestions) {
          if (question.isRequired && !isSpecQuestionAnswered(question, specAnswers[question.specKey])) {
            return `Answer: ${question.label}.`;
          }
        }
      }
    }

    return null;
  }


  function getCurrentAdvancedAssumptionsForRequest(): AdvancedAssumptionsRequest {
    const applied = getAppliedAdvancedAssumptionsFromState(resultState);
    const detailedAssessment = detailedAssessmentOpen ? buildDealerAssessmentRequest() : null;
    return {
      maxLifetimeUsage: applied?.maxLifetimeUsage ?? null,
      conditionFactorPercent: detailedAssessment ? null : applied?.conditionFactorPercent ?? null,
      dealerAssessment: detailedAssessment,
      popularityStars: popularityStepComplete ? popularityStars : null,
    };
  }

  function buildAdvancedAssumptionsRequestFromFields(): AdvancedAssumptionsRequest | null {
    if (!resultState) {
      setAdvancedError('Run an estimate before changing advanced assumptions.');
      return null;
    }

    const usageMetricType = getResultUsageMetricType(resultState);
    const lifetimeUnitLabel = getLifetimeUnitLabel(usageMetricType);
    const lifetimeShortUnit = getUsageShortUnit(getResultSectorKey(resultState), usageMetricType);
    const lifetimeMin = usageMetricType === 'km' ? ADVANCED_LIFETIME_KM_MIN : ADVANCED_LIFETIME_HOURS_MIN;
    const lifetimeMax = usageMetricType === 'km' ? ADVANCED_LIFETIME_KM_MAX : ADVANCED_LIFETIME_HOURS_MAX;
    const lifetimeText = normalizeText(advancedLifetimeUsage);
    const conditionText = normalizeText(advancedConditionFactorPercent);
    const showLifetimeInput = shouldShowAdvancedLifetimeInput(resultState, usageNumber, lifeWorkedPercentNumber);
    const lifetimeValue = lifetimeText ? parseMoneyInput(lifetimeText) : null;
    const conditionPercent = conditionText ? parseFlexibleNumber(conditionText) : null;

    if (showLifetimeInput && !lifetimeText) {
      setAdvancedError(`Enter expected lifetime ${lifetimeUnitLabel}.`);
      return null;
    }

    if (showLifetimeInput && (lifetimeValue === null || lifetimeValue < lifetimeMin || lifetimeValue > lifetimeMax)) {
      setAdvancedError(
        `Expected lifetime ${lifetimeUnitLabel} must be between ${formatPlainNumber(lifetimeMin)} and ${formatPlainNumber(lifetimeMax)} ${lifetimeShortUnit}.`,
      );
      return null;
    }

    const appliedDetailedAssessment = getAppliedDealerAssessmentFromState(resultState);

    if (!appliedDetailedAssessment && conditionPercent === null) {
      setAdvancedError('Enter the condition percentage.');
      return null;
    }

    if (
      !appliedDetailedAssessment
      && conditionPercent !== null
      && (
        conditionPercent < ADVANCED_CONDITION_FACTOR_MIN_PERCENT
        || conditionPercent > ADVANCED_CONDITION_FACTOR_MAX_PERCENT
      )
    ) {
      setAdvancedError(
        `Condition percentage must be between ${ADVANCED_CONDITION_FACTOR_MIN_PERCENT}% and ${ADVANCED_CONDITION_FACTOR_MAX_PERCENT}%.`,
      );
      return null;
    }

    return {
      maxLifetimeUsage: showLifetimeInput && lifetimeValue !== null ? Math.round(lifetimeValue) : null,
      conditionFactorPercent: !appliedDetailedAssessment && conditionPercent !== null ? Math.round(conditionPercent * 10) / 10 : null,
      dealerAssessment: appliedDetailedAssessment,
      popularityStars: getAppliedAdvancedAssumptionsFromState(resultState)?.popularityStars ?? popularityStars,
    };
  }

  function buildDealerAssessmentRequest(): DealerAssessmentInput | null {
    if (!dealerMechanicalCondition || !dealerBodyCondition || !dealerTyreCondition || !dealerServiceHistory || !dealerRequiredWork) {
      setDetailedAssessmentError('Complete all five detailed condition questions.');
      return null;
    }

    return {
      mechanicalCondition: dealerMechanicalCondition,
      bodyCondition: dealerBodyCondition,
      tyreCondition: dealerTyreCondition,
      serviceHistory: dealerServiceHistory,
      requiredWork: dealerRequiredWork,
    };
  }

  async function updateAdvancedAssumptionsAndRecalculate() {
    if (!resultState) {
      setAdvancedError('Run an estimate before changing advanced assumptions.');
      return;
    }

    if (!canUseAdvancedAssumptions) {
      setAdvancedError('Advanced assumptions are for active Aim4price accounts only.');
      return;
    }

    const advancedAssumptions = buildAdvancedAssumptionsRequestFromFields();
    if (!advancedAssumptions) return;

    setAdvancedRecalculateLoading(true);
    setAdvancedError('');
    setMessage('');

    try {
      if (resultState.kind === 'generic') {
        const currentResult = resultState.result;
        const userReplacementPriceExVat =
          replacementPriceBasis === 'user'
            ? currentResult.userReplacementPriceExVat ?? currentResult.userReplacementCalculation?.replacementPriceExVat ?? null
            : null;

        const response = await fetch('/api/generic-valuations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sectorKey: currentResult.sector.key,
            familyKey: currentResult.family.key,
            brandSlug: currentResult.brand.slug,
            equipmentModelId: toNumberOrNull(currentResult.specsJson.catalog_model_id),
            typedModelName: currentResult.typedModelName,
            saveModelCandidate: false,
            specsJson: currentResult.specsJson,
            year: currentResult.year,
            yearModelUnknown: Boolean(currentResult.specsJson.year_model_unknown ?? yearModelUnknown),
            usageAmount: currentResult.usageAmount,
            lifeWorkedPercent: currentResult.lifeWorkedPercent,
            condition: currentResult.condition,
            userReplacementPriceExVat,
            userReplacementPriceYear: userReplacementPriceExVat ? currentResult.userReplacementPriceYear ?? CURRENT_YEAR : null,
            advancedAssumptions,
          }),
        });
        const data = (await response.json()) as GenericValuationApiResponse;
        if (!response.ok || !data.ok || !data.result) throw new Error(data.error ?? 'Failed to recalculate with advanced assumptions.');
        setResultState({ kind: 'generic', result: data.result });
        setReplacementPriceBasis(data.result.replacementPriceBasis ?? replacementPriceBasis);
      } else {
        const currentResult = resultState.result;
        const response = await fetch('/api/tractor-valuations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            modelId: currentResult.model.id,
            year: calculationYear,
            hours: usageNumber ?? estimateHoursFromWorkedPercent(currentResult.model, lifeWorkedPercentNumber) ?? 0,
            ...getTractorUsageRequestFields(),
            condition,
            ...getTractorExtrasRequestFields(),
            userReplacementPriceExVat: replacementPriceBasis === 'user' ? currentResult.userReplacementPriceExVat ?? null : null,
            advancedAssumptions,
          }),
        });
        const data = (await response.json()) as TractorValuationApiResponse;
        if (!response.ok || !data.ok || !data.result) throw new Error(data.error ?? 'Failed to recalculate with advanced assumptions.');
        setResultState({ kind: 'tractor', result: data.result });
        setReplacementPriceBasis(data.result.replacementPriceBasis ?? replacementPriceBasis);
      }

      setSelectedMethod('aim4price');
      setSavedMarketplaceAssetId(null);
    } catch (error) {
      console.error(error);
      setAdvancedError(error instanceof Error ? error.message : 'Failed to recalculate with advanced assumptions.');
    } finally {
      setAdvancedRecalculateLoading(false);
    }
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
    const advancedAssumptions = getCurrentAdvancedAssumptionsForRequest();

    try {
      const response = await fetch('/api/generic-valuations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sectorKey: selectedSector,
          familyKey: selectedFamily.familyKey,
          brandSlug: selectedBrand.slug,
          equipmentModelId: selectedGenericModel?.id ?? null,
          typedModelName: submittedGenericModelName,
          saveModelCandidate: shouldSaveGenericModelCandidate,
          specsJson: enrichedSpecsJson,
          year: calculationYear,
          yearModelUnknown,
          usageAmount: usageNumber,
          lifeWorkedPercent: lifeWorkedPercentNumber,
          condition,
          userReplacementPriceExVat: priceExVat,
          userReplacementPriceYear: CURRENT_YEAR,
          advancedAssumptions,
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
    const advancedAssumptions = getCurrentAdvancedAssumptionsForRequest();

    try {
      const response = await fetch('/api/tractor-valuations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          modelId: selectedModel.id,
          year: calculationYear,
          hours: usageNumber ?? estimateHoursFromWorkedPercent(selectedModel, lifeWorkedPercentNumber) ?? 0,
          ...getTractorUsageRequestFields(),
          condition,
          ...getTractorExtrasRequestFields(),
          userReplacementPriceExVat: priceExVat,
          advancedAssumptions,
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
    setVatDisplayMode(getDefaultVatDisplayMode(selectedSector, selectedFamily?.familyKey));
    setAdvancedPanelOpen(false);
    setAdvancedError('');
    setValuationLoading(true);
    setFinalSaveIntent(null);
    setFinalSaveError('');
    setSavedMarketplaceAssetId(null);
    const advancedAssumptions = getCurrentAdvancedAssumptionsForRequest();

    try {
      if (flowMode === 'exact_model' && exactTractorAvailable && selectedModel) {
        const response = await fetch('/api/tractor-valuations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            modelId: selectedModel.id,
            year: calculationYear,
            hours: usageNumber ?? estimateHoursFromWorkedPercent(selectedModel, lifeWorkedPercentNumber) ?? 0,
            ...getTractorUsageRequestFields(),
            condition,
            ...getTractorExtrasRequestFields(),
            userReplacementPriceExVat: null,
            advancedAssumptions,
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
            equipmentModelId: selectedGenericModel?.id ?? null,
            typedModelName: submittedGenericModelName,
            saveModelCandidate: shouldSaveGenericModelCandidate,
            specsJson: enrichedSpecsJson,
            year: calculationYear,
            yearModelUnknown,
            usageAmount: usageNumber,
            lifeWorkedPercent: lifeWorkedPercentNumber,
            condition,
            userReplacementPriceExVat: null,
            userReplacementPriceYear: null,
            advancedAssumptions,
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
      scrollWizardToStart();
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
    const conversionFields = conversionAssetId
      ? {
          conversionAssetId,
          conversionMode: 'manual-to-aim4price',
        }
      : {};

    if (resultState.kind === 'tractor') {
      const replacementPriceForSave = resultState.result.userReplacementPriceExVat ?? null;

      return {
        modelId: resultState.result.model.id,
        year: calculationYear,
        hours: usageNumber ?? estimateHoursFromWorkedPercent(selectedModel, lifeWorkedPercentNumber) ?? 0,
        ...getTractorUsageRequestFields(),
        condition,
        ...getTractorExtrasRequestFields(),
        userReplacementPriceExVat: replacementPriceForSave,
        advancedAssumptions: resultState.result.advancedAssumptions ?? null,
        selectedMethod: 'aim4price',
        valuationVersion: 'v1',
        ...conversionFields,
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
      equipmentModelId: toNumberOrNull(resultState.result.specsJson.catalog_model_id),
      typedModelName: resultState.result.typedModelName,
      specsJson: resultState.result.specsJson,
      year: resultState.result.year,
      yearModelUnknown: Boolean(resultState.result.yearModelUnknown ?? resultState.result.specsJson.year_model_unknown ?? yearModelUnknown),
      usageAmount: resultState.result.usageAmount,
      lifeWorkedPercent: resultState.result.lifeWorkedPercent,
      condition: resultState.result.condition,
      userReplacementPriceExVat: replacementPriceForSave,
      userReplacementPriceYear: replacementPriceYearForSave,
      advancedAssumptions: resultState.result.advancedAssumptions ?? null,
      selectedMethod: 'aim4price',
      valuationVersion: 'generic-v1',
      ...conversionFields,
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
      const titleUsage = formatSingleUsageSummary({
        actualUsageAmount: usageNumber,
        lifeWorkedPercent: lifeWorkedPercentNumber,
        fallbackUnit: 'hours',
        fallback: '',
      });
      return [
        model.brandName,
        model.modelName,
        yearModelUnknown ? null : String(yearNumber),
        titleUsage || null,
        conditionLabel(condition),
      ]
        .filter(Boolean)
        .join(' • ');
    }

    const result = resultState.result;
    const usageLabel = formatSingleUsageSummary({
      actualUsageAmount: result.usageAmount,
      lifeWorkedPercent: result.lifeWorkedPercent,
      sectorKey: result.sector.key,
      usageMetricType: result.family.usageMetricType,
      fallback: '',
    }) || null;

    return [
      getDisplayBrandName(result.brand, result.specsJson),
      result.typedModelName || result.family.label,
      result.yearModelUnknown || result.specsJson.year_model_unknown ? null : result.year,
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
    const genericBrandNameForPdf = getDisplayBrandName(genericResult?.brand ?? selectedBrand, genericResult?.specsJson, unlistedBrandName);
    const machineTitle = isGeneric
      ? `${genericBrandNameForPdf} ${genericModelNameForResult || genericResult?.family.label || selectedFamily?.familyLabel || ''}`.trim()
      : `${exactModel?.brandName ?? selectedBrand?.name ?? ''} ${exactModel?.modelName ?? ''}`.trim();
    const resultCondition: ConditionKey = isGeneric ? genericResult?.condition ?? condition : condition;
    const resultYear = isGeneric ? genericResult?.year ?? calculationYear : calculationYear;
    const yearSummary = yearModelUnknown ? 'Unknown' : String(resultYear);
    const resultUsageShortUnit = isGeneric && genericResult
      ? getUsageShortUnit(genericResult.sector.key, genericResult.family.usageMetricType)
      : 'hours';
    const usageSummary = formatSingleUsageSummary({
      actualUsageAmount: isGeneric ? genericResult?.usageAmount ?? usageNumber : usageNumber,
      lifeWorkedPercent: isGeneric ? genericResult?.lifeWorkedPercent ?? lifeWorkedPercentNumber : lifeWorkedPercentNumber,
      sectorKey: genericResult?.sector.key ?? selectedSector,
      usageMetricType: genericResult?.family.usageMetricType ?? selectedFamily?.usageMetricType,
      fallbackUnit: resultUsageShortUnit,
    });
    const tractorReplacementBasisText = tractorResult?.totalReplacementPriceUsedExVat
      ? `Asset and selected-extra replacement prices total ${moneyExVat(tractorResult.totalReplacementPriceUsedExVat)}`
      : `Asset replacement price: ${moneyExVat(tractorResult?.replacementPriceUsedExVat ?? exactModel?.aim4priceReplacementExVat ?? null)}`;
    const genericReplacementBasisText = genericResult?.userReplacementCalculation && replacementPriceBasis === 'user'
      ? `Current basis: your replacement price of ${money(genericResult.userReplacementCalculation.replacementPriceExVat)}`
      : `Current basis: saved replacement estimate of ${money(genericResult?.aim4priceReplacementCalculation?.replacementPriceExVat ?? null)}`;
    const replacementBasisText = isGeneric ? genericReplacementBasisText : tractorReplacementBasisText;
    const sectorLabel = isGeneric
      ? genericResult?.sector.label ?? (selectedSector ? SECTOR_LABELS[selectedSector] : 'N/A')
      : 'Agricultural';
    const familyLabel = isGeneric ? genericResult?.family.label ?? selectedFamily?.familyLabel ?? 'N/A' : 'Tractors';
    const brandName = isGeneric ? genericBrandNameForPdf || 'N/A' : exactModel?.brandName ?? selectedBrand?.name ?? 'N/A';
    const modelName = isGeneric ? genericModelNameForResult : exactModel?.modelName ?? '';
    const valuationPath = flowMode === 'exact_model' ? 'Exact model' : flowMode === 'generic_specs' ? getSpecsTitle(selectedSector) : formatCatalogModeLabel(selectedFamily?.catalogMode ?? 'generic_specs');
    const selectedMethodLabel = selectedValueTypeLabel(selectedMethod);
    const generatedAt = new Date();
    const replacementPriceExVat = tractorResult?.totalReplacementPriceUsedExVat ?? getCurrentResultReplacementPriceExVat();
    const appliedAdvancedAssumptions = getAppliedAdvancedAssumptionsFromState(resultState);
    const appliedDealerAssessment = appliedAdvancedAssumptions?.dealerAssessment ?? null;
    const generalSaleability = calculateGeneralSaleability(getSaleabilityInputFromResult(
      resultState,
      resultCondition,
      isGeneric ? genericResult?.usageAmount ?? usageNumber : usageNumber,
      isGeneric ? genericResult?.lifeWorkedPercent ?? lifeWorkedPercentNumber : lifeWorkedPercentNumber,
    ));
    const advancedAssumptionsApplied = hasAppliedAdvancedAssumptions(appliedAdvancedAssumptions);
    const advancedUsageMetricType = getResultUsageMetricType(resultState);
    const advancedUsageShortUnit = getUsageShortUnit(getResultSectorKey(resultState), advancedUsageMetricType);
    const advancedRecordRows = advancedAssumptionsApplied
      ? compactPdfRows([
          { label: 'Advanced assumptions', value: 'Applied' },
          {
            label: 'Lifetime assumption',
            value: appliedAdvancedAssumptions?.maxLifetimeUsage !== null
              ? `${formatPlainNumber(appliedAdvancedAssumptions?.maxLifetimeUsage)} ${advancedUsageShortUnit}`
              : '',
          },
          {
            label: 'Condition retained value',
            value: appliedAdvancedAssumptions?.conditionFactorPercent !== null
              ? `${formatAdvancedPercent(appliedAdvancedAssumptions?.conditionFactorPercent)}%`
              : '',
          },
        ])
      : [];
    const detailedAssessmentRows = appliedDealerAssessment
      ? compactPdfRows([
          { label: 'Detailed Asset Assessment', value: 'Applied' },
          { label: 'Mechanical condition', value: getDealerOptionLabel(DEALER_MECHANICAL_OPTIONS, appliedDealerAssessment.mechanicalCondition) },
          { label: 'Body / frame / structure', value: getDealerOptionLabel(DEALER_BODY_OPTIONS, appliedDealerAssessment.bodyCondition) },
          { label: 'Tyres / wear components', value: getDealerOptionLabel(DEALER_TYRE_OPTIONS, appliedDealerAssessment.tyreCondition) },
          { label: 'Service history', value: getDealerOptionLabel(DEALER_SERVICE_OPTIONS, appliedDealerAssessment.serviceHistory) },
          { label: 'Required work', value: getDealerOptionLabel(DEALER_WORK_OPTIONS, appliedDealerAssessment.requiredWork) },
        ])
      : [];

    function genericSpecDisplayValue(matchers: string[]): string {
      if (!genericResult) return '';
      const question = effectiveSpecQuestions.find((item) => {
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
      { label: 'Condition', value: appliedDealerAssessment ? 'Detailed' : conditionLabel(resultCondition) },
      { label: 'Popularity', value: `${appliedAdvancedAssumptions?.popularityStars ?? 3} / 5 stars` },
      { label: 'Replacement Price', value: moneyExVat(replacementPriceExVat) },
      { label: 'Estimate Path', value: valuationPath },
      ...(tractorResult?.frontPtoValueExVat
        ? [
            { label: 'Front PTO replacement price', value: moneyExVat(tractorResult.frontPtoReplacementPriceExVat) },
            { label: 'Front PTO value added', value: moneyExVat(tractorResult.frontPtoValueExVat) },
          ]
        : []),
      ...(tractorResult?.frontLoaderValueExVat
        ? [
            { label: 'Front Loader replacement price', value: moneyExVat(tractorResult.frontLoaderReplacementPriceExVat) },
            { label: 'Front Loader year added', value: normalizeText(frontLoaderYear) || 'Same as tractor' },
            { label: 'Front Loader value added', value: moneyExVat(tractorResult.frontLoaderValueExVat) },
          ]
        : []),
      ...(tractorResult?.gpsValueExVat
        ? [
            { label: 'GPS replacement price', value: moneyExVat(tractorResult.gpsReplacementPriceExVat) },
            { label: 'GPS value added', value: moneyExVat(tractorResult.gpsValueExVat) },
          ]
        : []),
      ...(tractorResult?.otherExtraName && tractorResult.otherExtraValueExVat > 0
        ? [
            { label: `${tractorResult.otherExtraName} replacement price`, value: moneyExVat(tractorResult.otherExtraReplacementPriceExVat) },
            { label: `${tractorResult.otherExtraName} value added`, value: moneyExVat(tractorResult.otherExtraValueExVat) },
          ]
        : []),
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

    const recordRows = [
      ...compactPdfRows([
        { label: 'Confidence', value: confidenceText.replace(/^Confidence:\s*/i, '') },
        { label: 'Generated', value: formatPdfReportDate(generatedAt) },
      ]),
      ...advancedRecordRows,
      ...detailedAssessmentRows,
    ];

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
      conditionSummary: appliedDealerAssessment ? 'Detailed' : conditionLabel(resultCondition),
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
      saleabilityRows: compactPdfRows([
        { label: 'Rating', value: `${generalSaleability.score} / 100` },
        { label: 'Grade', value: `${generalSaleability.grade} · ${generalSaleability.gradeLabel}` },
        { label: 'Selling window', value: generalSaleability.naturalSellingWindow },
        { label: 'Useful life left', value: `${generalSaleability.lifeRemainingPercent}%` },
        { label: 'Confidence', value: generalSaleability.confidence },
      ]),
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
    const defaultBrandKit = adBrandKits.find((kit) => kit.isDefault) ?? adBrandKits[0];
    const sellerName =
      (isSignedIn
        ? defaultBrandKit?.contactName || accountProfile?.marketplaceSellerName || accountProfile?.displayName || accountProfile?.name || accountProfile?.businessName
        : '') || '';
    const sellerCompany = (isSignedIn ? defaultBrandKit?.businessName || accountProfile?.businessName : '') || '';
    const sellerPhone = (isSignedIn ? defaultBrandKit?.phone || accountProfile?.marketplacePhone || accountProfile?.phone : '') || '';
    const sellerEmail = (isSignedIn ? defaultBrandKit?.email || accountProfile?.marketplaceEmail : '') || '';
    const area = (isSignedIn ? accountProfile?.marketplaceLocation || accountProfile?.townCity : '') || '';

    return {
      brandKitId: defaultBrandKit?.id ?? '',
      showDealRating: true,
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
    const currentReplacementPrice = getCurrentResultReplacementPriceExVat();
    if (typedReplacementPrice !== null) {
      if (currentReplacementPrice === null) return true;
      if (Math.round(typedReplacementPrice) !== Math.round(currentReplacementPrice)) return true;
    }

    if (resultState?.kind !== 'tractor') return false;

    const result = resultState.result;
    const replacementChanged = (enabled: boolean, inputValue: string, currentValue: number | null) => {
      if (!enabled) return false;
      const parsed = parseMoneyInput(inputValue);
      return parsed === null || currentValue === null || Math.round(parsed) !== Math.round(currentValue);
    };

    if (replacementChanged(frontPto, frontPtoReplacementPrice, result.frontPtoReplacementPriceExVat)) return true;
    if (replacementChanged(frontLoader, frontLoaderReplacementPrice, result.frontLoaderReplacementPriceExVat)) return true;
    if (replacementChanged(gpsEnabled, gpsReplacementPrice, result.gpsReplacementPriceExVat)) return true;

    if (otherExtraEnabled) {
      const parsedOtherReplacementPrice = parseMoneyInput(otherExtraReplacementPrice);
      if (normalizeText(otherExtraName) !== normalizeText(result.otherExtraName)) return true;
      if (
        parsedOtherReplacementPrice === null
        || result.otherExtraReplacementPriceExVat === null
        || Math.round(parsedOtherReplacementPrice) !== Math.round(result.otherExtraReplacementPriceExVat)
      ) return true;
    }

    return false;
  }

  function openFinalSaveModal(intent: FinalSaveIntent) {
    if (!resultState) {
      setMessage('Run an estimate before saving.');
      return;
    }

    if (!isSignedIn) {
      setMessage('Create an account or sign in to save this estimate or create a Marketplace advert.');
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
      setError('Create an account or sign in to save this estimate or create a Marketplace advert.');
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
      setError('You changed a replacement price or extra value. Click Update and recalculate before saving or listing this asset.');
      return null;
    }

    if (!ensureReplacementPriceBeforeFinalSave(setError)) {
      return null;
    }

    setSaveLoading(true);
    setMessage('');
    setError('');

    try {
      const savePayload = buildValuationSavePayload({
        saveForMarketplace: options.saveForMarketplace,
        photos: options.photos,
      });
      if (accountantRegisterId) {
        savePayload.registerId = accountantRegisterId;
      }
      if (isAccountantClientWorkspace) {
        savePayload.accountantShareId = accountantShareId;
      }
      const response = await fetch('/api/valuation-runs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(savePayload),
      });
      const data = (await response.json()) as SaveValuationRunApiResponse;

      if (!response.ok || !data.ok) {
        throw new Error(data.error ?? 'Failed to save estimate.');
      }

      if (options.redirectToAssetRegister) {
        const focusAssetId = data.assetId ?? conversionAssetId;
        if (isAccountantClientWorkspace) {
          const workspaceQuery = new URLSearchParams();
          if (accountantRegisterId) workspaceQuery.set('registerId', accountantRegisterId);
          if (focusAssetId) workspaceQuery.set('convertedAssetId', focusAssetId);
          const query = workspaceQuery.toString();
          router.push(`/accountant/registers/${encodeURIComponent(accountantShareId)}${query ? `?${query}` : ''}`);
        } else {
          if (ownerAppMode) {
            router.push(focusAssetId ? `/owner-app/assets/${encodeURIComponent(focusAssetId)}` : '/owner-app/assets');
          } else {
            const registerQuery = new URLSearchParams();
            if (accountantRegisterId) registerQuery.set('registerId', accountantRegisterId);
            if (focusAssetId) registerQuery.set('convertedAssetId', focusAssetId);
            const query = registerQuery.toString();
            router.push(`/asset-register${query ? `?${query}` : ''}`);
          }
        }
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

  function handleMarketplaceBrandKitChange(event: ChangeEvent<HTMLSelectElement>) {
    const brandKitId = event.target.value;
    const selectedKit = adBrandKits.find((kit) => kit.id === brandKitId);
    setMarketplaceDraft((current) => current ? {
      ...current,
      brandKitId,
      sellerName: selectedKit?.contactName || current.sellerName,
      sellerCompany: selectedKit?.businessName || current.sellerCompany,
      sellerPhone: selectedKit?.phone || current.sellerPhone,
      sellerEmail: selectedKit?.email || current.sellerEmail,
    } : current);
  }

  function handleMarketplacePriceChange(event: ChangeEvent<HTMLInputElement>) {
    const next = formatMoneyInput(event.target.value);
    setMarketplaceDraft((current) => (current ? { ...current, askingPriceExVat: next } : current));
  }

  function handleMarketplaceRatingVisibilityChange(event: ChangeEvent<HTMLInputElement>) {
    const showDealRating = event.target.checked;
    setMarketplaceDraft((current) => (current ? { ...current, showDealRating } : current));
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

  function moveMarketplacePhoto(photoId: string, direction: -1 | 1) {
    setMarketplacePhotoFiles((current) => {
      const index = current.findIndex((photo) => photo.id === photoId);
      const nextIndex = index + direction;
      if (index < 0 || nextIndex < 0 || nextIndex >= current.length) return current;
      const next = [...current];
      [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
      return next;
    });
  }

  async function downloadPublishedAdvert(listing: MarketplaceListing): Promise<'downloaded' | 'failed'> {
    setIsDownloadingPublishedAdvert(true);
    try {
      const { blob } = await createMarketplaceAdJpeg(listing);
      downloadMarketplaceAd(blob, marketplaceAdFilename(listing.title));
      return 'downloaded';
    } catch (error) {
      console.error('Automatic advert download failed', error);
      return 'failed';
    } finally {
      setIsDownloadingPublishedAdvert(false);
    }
  }

  async function retryPublishedAdvertDownload() {
    if (!publishedAdvertDownload || isDownloadingPublishedAdvert) return;
    const status = await downloadPublishedAdvert(publishedAdvertDownload.listing);
    setPublishedAdvertDownload((current) => current ? {
      ...current,
      status,
      message: status === 'downloaded'
        ? 'The JPEG advert has downloaded again.'
        : 'The listing is still live, but the JPEG download could not be created. Please try again.',
    } : current);
  }

  async function uploadMarketplacePhotos(): Promise<string[]> {
    if (!marketplacePhotoFiles.length) return [];

    const formData = new FormData();
    formData.append('uploadType', 'photo');
    for (const photo of marketplacePhotoFiles) {
      formData.append('files', photo.file);
    }

    const uploadUrl = isAccountantClientWorkspace
      ? `/api/asset-register/uploads?accountantShareId=${encodeURIComponent(accountantShareId)}`
      : '/api/asset-register/uploads';
    const response = await fetch(uploadUrl, {
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
      setMarketplacePublishError('Run an estimate before creating an advert.');
      return;
    }

    const selectedValue = getHeadlineValue(resultState, selectedMethod, replacementPriceBasis);
    if (selectedValue === null) {
      setMarketplacePublishError('Choose an available value before creating the advert.');
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
          brandKitId: marketplaceDraft.brandKitId || null,
          showDealRating: marketplaceDraft.showDealRating,
        }),
      });
      const published = (await publishResponse.json()) as MarketplaceApiResponse;

      if (!publishResponse.ok || !published.ok) {
        throw new Error(published.error ?? 'Failed to publish this marketplace listing.');
      }

      if (!published.listing) {
        throw new Error('The advert was published, but the listing details were not returned for the JPEG download.');
      }

      const listingReference = published.listing.id ?? published.listing.sourceAssetId ?? published.assetId ?? assetId;
      const downloadStatus = await downloadPublishedAdvert(published.listing);
      clearMarketplacePhotoFiles();
      setMarketplaceDraft(null);
      setSavedMarketplaceAssetId(null);
      setPublishedAdvertDownload({
        listing: published.listing,
        listingReference: String(listingReference),
        status: downloadStatus,
        message: downloadStatus === 'downloaded'
          ? 'The JPEG advert downloaded and the listing is live on Marketplace.'
          : 'The listing is live on Marketplace, but the JPEG download could not be created. Please try the download again.',
      });
    } catch (error) {
      console.error(error);
      setMarketplacePublishError(error instanceof Error ? error.message : 'Failed to publish this marketplace listing.');
    } finally {
      setIsPublishingMarketplace(false);
    }
  }

  async function saveConversionToAssetRegister() {
    if (!conversionAssetId) {
      setMessage('No manual asset conversion was supplied.');
      return;
    }

    setFinalSaveIntent('asset-register');
    const saved = await saveCurrentValuationToRegister({
      redirectToAssetRegister: true,
      setError: setMessage,
    });

    if (!saved) {
      setFinalSaveIntent(null);
    }
  }

  function saveToAssetRegister() {
    openFinalSaveModal('asset-register');
  }

  function createAdFromEstimate() {
    openFinalSaveModal('marketplace');
  }

  function openReplacementPriceNotice() {
    const validationMessage = validateDetails();
    if (validationMessage) {
      setMessage(validationMessage);
      return;
    }
    setMessage('');
    replacementNoticeReturnFocusRef.current = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    setReplacementNoticeOpen(true);
  }

  function closeReplacementPriceNotice() {
    setReplacementNoticeOpen(false);
  }

  function scrollWizardToStart() {
    if (!compactAppMode) return;

    requestAnimationFrame(() => {
      document.getElementById('valuation-wizard-card')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }

  function scrollToDetailsCard(targetId: string) {
    if (!compactAppMode) return;

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        document.getElementById(targetId)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    });
  }

  function handleNext() {
    setMessage('');
    if (isMotorSector(selectedSector)) {
      if (step === 2) {
        const motorModelMessage = validateMotorCanonicalSelection();
        if (motorModelMessage) {
          setMessage(motorModelMessage);
          return;
        }
        setStep(4);
        scrollWizardToStart();
        return;
      }
      if (step === 4) {
        openReplacementPriceNotice();
        return;
      }
    }
    if (step === 1 && !selectedFamily) {
      setMessage(`Choose an ${getAssetTypeLabel(selectedSector)} first.`);
      return;
    }
    if (step === 2 && selectedMotorSubtypeConfig && !motorSubtypeValue) {
      setMessage(`Choose the ${selectedMotorSubtypeConfig.fieldLabel.toLowerCase()} first.`);
      return;
    }
    if (step === 2 && !selectedBrand) {
      setMessage('Choose a brand first.');
      return;
    }
    if (step === 3) {
      if (!flowMode) {
        setMessage('Choose an estimate path first.');
        return;
      }
      if (flowMode === 'exact_model' && exactTractorAvailable && !tractorSetupComplete) {
        setMessage('Complete the type, drive and cab setup first.');
        return;
      }
      if (flowMode === 'exact_model' && exactTractorAvailable && !selectedModel) {
        setMessage('Choose an exact model first.');
        return;
      }
      if (genericValuationPath) {
        const genericModelMessage = validateGenericModelSelection();
        if (genericModelMessage) {
          setMessage(genericModelMessage);
          return;
        }
      }
    }
    if (step === 4) {
      openReplacementPriceNotice();
      return;
    }
    setStep(nextStep(step));
    scrollWizardToStart();
  }

  function resetToSectorSelection() {
    setStep(1);
    setSelectedSector(null);
    setFamilies([]);
    setFamilyKey('');
    setMotorSubtypeValue('');
    setMotorSubtypeDropdownOpen(false);
    setFamilySearch('');
    setEquipmentDropdownOpen(false);
    setBrands([]);
    setBrandSlug('');
    setUnlistedBrandName('');
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
    setGenericModelLookupKey('');
    setGenericModelsFullyLoadedKey('');
    clearGenericModelSelection({ clearManual: true, clearPrefilledSpecs: true });
    setMotorCanonicalQuery('');
    setMotorCanonicalResults([]);
    setMotorCanonicalLoading(false);
    setMotorCanonicalSearchError('');
    setMotorCanonicalDropdownOpen(false);
    setMotorCanonicalModelId('');
    setMotorSelectedTypeKey('');
    setMotorTypeDropdownOpen(false);
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
    setEquipmentDropdownOpen(compactAppMode);
    if (sectorKey === 'motor') {
      setStep(2);
    }
    resetResult();
  }


  function buildGenericModelFromMotorResult(result: MotorCanonicalModelResult): GenericCatalogModel {
    return {
      id: result.representativeModelId,
      sectorId: 0,
      sectorKey: 'motor',
      familyId: 0,
      familyKey: result.familyKey,
      familyLabel: result.familyLabel,
      usageMetricType: 'km',
      valuationMode: 'engine_hours',
      catalogMode: 'generic_specs',
      isPropelled: true,
      brandId: result.brandId,
      brandSlug: result.brandSlug,
      brandName: result.brandName,
      aim4ModelKey: result.modelKey,
      legacyTractorCatalogId: null,
      modelName: result.modelName,
      variantName: null,
      normalizedModelName: result.modelKey,
      displayName: result.displayLabel,
      yearStart: null,
      yearEnd: null,
      powerKw: null,
      tractorType: null,
      driveType: null,
      cabType: null,
      workingWidthM: null,
      rowsCount: null,
      tankCapacityL: null,
      aim4priceReplacementPriceExVat: null,
      replacementPriceYear: null,
      isGenericFallback: false,
      specsJson: {
        ...result.specsJson,
        aim4_model_key: result.modelKey,
        selected_model_key: result.modelKey,
        available_type_keys: result.typeOptions.map((option) => option.value),
        available_type_labels: result.typeOptions.map((option) => option.label),
        default_type_key: result.defaultTypeValue ?? result.typeOptions[0]?.value ?? '',
      },
      isActive: true,
    };
  }

  function getMotorCanonicalTypeSpecs(familyForType: string | null | undefined, option: MotorTypeOption | null): Record<string, string> {
    if (!option?.value) return {};
    const family = familyForType ?? '';
    const typeKey = option.value;
    const specs: Record<string, string> = {
      type_key: typeKey,
      type_label: option.label,
      motor_type: typeKey,
      ...(option.specs ?? {}),
    };

    if (family === 'bakkies_ldvs') specs.cab_type = typeKey;
    if (family === 'cars_suvs' || family === 'light_commercial_vehicles') specs.body_type = typeKey;
    if (family === 'trucks') specs.truck_type = typeKey;
    if (family === 'trailers') specs.trailer_type = typeKey;
    if (family === 'buses') specs.bus_type = typeKey;
    if (family === 'motorcycles') specs.motorcycle_type = typeKey;
    if (family === 'quadbikes') specs.quadbike_type = typeKey;
    if (family === 'side_by_sides') specs.side_by_side_type = typeKey;

    return specs;
  }

  function applyMotorCanonicalModel(result: MotorCanonicalModelResult) {
    const model = buildGenericModelFromMotorResult(result);
    const firstType = result.typeOptions.length === 1 ? result.typeOptions[0] : null;
    const defaultType = result.typeOptions.find((option) => option.value === result.defaultTypeValue) ?? firstType;
    const resolvedTypeKey = defaultType?.value ?? '';
    const resolvedTypeSpecs = getMotorCanonicalTypeSpecs(result.familyKey, defaultType);

    setMotorCanonicalModelId(result.id);
    setMotorCanonicalQuery(result.displayLabel);
    setMotorCanonicalDropdownOpen(false);
    setMotorCanonicalSearchError('');
    setMotorSelectedTypeKey(resolvedTypeKey);
    setMotorTypeDropdownOpen(false);
    setFamilyKey(result.familyKey);
    setBrands([{ slug: result.brandSlug, name: result.brandName }]);
    setBrandSlug(result.brandSlug);
    setBrandSearch(result.brandName);
    setUnlistedBrandName('');
    setFlowMode('exact_model');
    setGenericCatalogModels([model]);
    setGenericModelLookupKey(`motor|${result.familyKey}|${result.brandSlug}`);
    setGenericModelsFullyLoadedKey(`motor|${result.familyKey}|${result.brandSlug}`);
    setGenericModelId(String(model.id));
    setGenericModelMode('catalog');
    setGenericModelQuery(result.displayLabel);
    setTypedModelName('');
    setSpecAnswers((current) => ({
      ...current,
      ...resolvedTypeSpecs,
      ...(current.spec_level ? {} : { spec_level: 'Mid' }),
      ...(current.drive_type ? {} : { drive_type: 'Any/Unknown' }),
      ...(current.transmission ? {} : { transmission: 'Any/Unknown' }),
    }));
    resetResult();

    if (result.typeOptions.length <= 1) {
      setStep(4);
      scrollWizardToStart();
    }
  }

  function handleMotorTypeSelection(nextTypeKey: string) {
    const option = motorTypeOptions.find((item) => item.value === nextTypeKey) ?? null;
    if (!option) return;
    setMotorSelectedTypeKey(nextTypeKey);
    setMotorTypeDropdownOpen(false);
    const nextTypeSpecs = getMotorCanonicalTypeSpecs(selectedMotorCanonicalModel?.familyKey ?? selectedFamily?.familyKey, option);
    setSpecAnswers((current) => ({ ...current, ...nextTypeSpecs }));
    setMessage('');
    resetResult();
    setStep(4);
    scrollWizardToStart();
  }

  function validateMotorCanonicalSelection(): string | null {
    if (!selectedMotorCanonicalModel || !selectedGenericModel || !selectedFamily || !selectedBrand) {
      return 'Search and choose the Motor brand and model first.';
    }
    if (motorTypeRequiredForSelectedModel && !motorSelectedTypeKey) {
      return 'Choose the type for this Motor model first.';
    }
    return null;
  }

  function handleFamilySelection(nextFamilyKey: string) {
    if (!nextFamilyKey) return;

    setFamilyKey(nextFamilyKey);
    setMotorSubtypeValue('');
    setMotorSubtypeDropdownOpen(false);
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
    setGenericModelLookupKey('');
    setGenericModelsFullyLoadedKey('');
    clearGenericModelSelection({ clearManual: true, clearPrefilledSpecs: true });
    setBrandSearch('');
    setBrandDropdownOpen(compactAppMode);
    setBrandSlug('');
    setUnlistedBrandName('');
    resetResult();
    setStep(2);
    scrollWizardToStart();
  }

  function handleMotorSubtypeSelection(nextSubtypeValue: string) {
    if (!selectedMotorSubtypeConfig) return;

    const nextOption = getMotorSubtypeOption(selectedMotorSubtypeConfig, nextSubtypeValue);
    if (!nextOption) return;

    const nextSpecs = getMotorSubtypeSpecs(selectedMotorSubtypeConfig, nextOption);
    const keysToReplace = getMotorSubtypeSpecKeys(selectedMotorSubtypeConfig);

    setMotorSubtypeValue(nextSubtypeValue);
    setMotorSubtypeDropdownOpen(false);
    setSpecAnswers((current) => {
      const next = { ...current };
      for (const key of keysToReplace) {
        delete next[key];
      }
      return { ...next, ...nextSpecs };
    });
    setBrandSlug('');
    setUnlistedBrandName('');
    setFlowMode('');
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
    setGenericModelLookupKey('');
    setGenericModelsFullyLoadedKey('');
    genericModelPrefilledSpecKeysRef.current = new Set();
    clearGenericModelSelection({ clearManual: true });
    setMessage('');
    resetResult();
  }

  function handleBrandSelection(nextBrandSlug: string) {
    if (!nextBrandSlug) return;

    const nextBrandIsUnknown = isUnknownBrandSlug(nextBrandSlug);

    setBrandSlug(nextBrandSlug);
    setUnlistedBrandName('');
    setFlowMode(nextBrandIsUnknown ? 'generic_specs' : '');
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
    setGenericModelLookupKey('');
    setGenericModelsFullyLoadedKey('');
    clearGenericModelSelection({ clearManual: true, clearPrefilledSpecs: true });
    resetResult();
    setStep(3);
    scrollWizardToStart();
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
    scrollWizardToStart();
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

  function handleGenericModelUnknown() {
    setGenericModelId('');
    setGenericModelMode('unknown');
    setGenericModelQuery('');
    setGenericModelDropdownOpen(false);
    setTypedModelName('');
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

      router.push(appHomePath);
      return;
    }
    if (isMotorSector(selectedSector) && step === 4) {
      setStep(2);
      scrollWizardToStart();
      return;
    }
    if (compactAppMode && step === 3 && flowMode && !selectedBrandIsUnknown) {
      setFlowMode('');
      scrollWizardToStart();
      return;
    }
    if (compactAppMode && step === 2) setEquipmentDropdownOpen(true);
    if (compactAppMode && step === 3) setBrandDropdownOpen(true);
    setStep(previousStep(step));
    scrollWizardToStart();
  }

  function handleWizardStepJump(targetStep: Step) {
    if (targetStep >= step || targetStep === 5) return;

    setMessage('');
    setReplacementNoticeOpen(false);
    setActiveDetailsModal(null);
    if (compactAppMode && targetStep === 1) setEquipmentDropdownOpen(true);
    if (compactAppMode && targetStep === 2) setBrandDropdownOpen(true);
    setStep(isMotorSector(selectedSector) && targetStep === 3 ? 2 : targetStep);

    requestAnimationFrame(() => {
      document.getElementById('valuation-wizard-card')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }

  function renderMachineStep() {
    if (!selectedSector) {
      return (
        <div className={styles.sectorStart}>
          <div className={styles.sectorIntro}>
            <h2 className={styles.stepTitle}>Choose sector</h2>
            <p className={styles.stepText}>{compactAppMode ? 'Choose a sector.' : 'Choose a sector to start your estimate.'}</p>
          </div>

          <div className={styles.sectorLargeGrid}>
            {SECTOR_OPTIONS.map((sector) => {
              const isAvailable = sector.available;
              return (
                <button
                  key={sector.key}
                  type="button"
                  className={`${styles.sectorBigCard} ${compactAppMode ? styles.sectorBigCardApp : ''} ${isAvailable ? styles.sectorBigCardLive : styles.sectorBigCardSoon}`}
                  onClick={() => handleSectorSelect(sector.key)}
                  onMouseEnter={(event) => {
                    if (!compactAppMode && !shouldAutoPlaySectorVideos) playSectorPreview(event.currentTarget);
                  }}
                  onMouseLeave={(event) => {
                    if (!compactAppMode && !shouldAutoPlaySectorVideos) resetSectorPreview(event.currentTarget);
                  }}
                  onFocus={(event) => {
                    if (!compactAppMode && !shouldAutoPlaySectorVideos) playSectorPreview(event.currentTarget);
                  }}
                  onBlur={(event) => {
                    if (!compactAppMode && !shouldAutoPlaySectorVideos) resetSectorPreview(event.currentTarget);
                  }}
                  aria-label={isAvailable ? `Choose ${sector.label}` : `${sector.label} coming soon`}
                >
                  {!compactAppMode ? (
                    <>
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
                    </>
                  ) : null}

                  <span className={styles.sectorBigCardContent}>
                    {!isAvailable ? (
                      <span className={styles.sectorCardTopRow}>
                        <span className={styles.soonBadge}>Coming soon</span>
                      </span>
                    ) : null}

                    <span className={styles.sectorLabelWrap}>
                      <strong className={styles.sectorLabel}>{sector.label}</strong>
                      {isAvailable && !compactAppMode ? <span className={styles.sectorCardHint}>Start estimate →</span> : null}
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

        {!compactAppMode ? (
          <div className={styles.equipmentStageIntro}>
            <h2 className={styles.stepTitle}>Choose {getAssetTypeLabel(selectedSector)}</h2>
            <p className={styles.stepText}>Search or select the {getAssetTypeLabel(selectedSector)}.</p>
          </div>
        ) : null}

        <div className={`${styles.currentCard} ${styles.equipmentPickerCard}`}>
          <div className={styles.equipmentPickerHead}>
            <div>
              <span className={styles.fieldLabel}>Search {getAssetTypeLabel(selectedSector)}</span>
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
              placeholder={getSearchPlaceholder(selectedSector, 'family')}
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
              data-selected={Boolean(selectedFamily)}
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
            <p className={styles.message}>No matching {getAssetTypeLabel(selectedSector)} found. Clear the search or import it into the {getCatalogImportLabel(selectedSector)}.</p>
          ) : null}
        </div>
      </div>
    );
  }

  function renderMotorSubtypeSelection(config: MotorSubtypeConfig) {
    return (
      <div className={styles.equipmentStage}>
        <div className={`${styles.equipmentStageTop} ${styles.equipmentStageTopSolo}`}>
          {selectedFamily ? <span className={styles.selectedSummaryPill}>{selectedFamily.familyLabel}</span> : null}
        </div>

        <div className={styles.equipmentStageIntro}>
          <h2 className={styles.stepTitle}>{config.title}</h2>
          <p className={styles.stepText}>{config.helpText}</p>
        </div>

        <div className={`${styles.currentCard} ${styles.equipmentPickerCard}`}>
          <div className={styles.equipmentPickerHead}>
            <div>
              <span className={styles.fieldLabel}>{config.fieldLabel}</span>
            </div>
            <span className={styles.equipmentCountPill}>{config.options.length} options</span>
          </div>

          <div className={styles.equipmentDropdownWrap}>
            <button
              type="button"
              className={`${styles.equipmentDropdownTrigger} ${motorSubtypeDropdownOpen ? styles.equipmentDropdownTriggerOpen : ''}`}
              onClick={() => setMotorSubtypeDropdownOpen((value) => !value)}
              aria-expanded={motorSubtypeDropdownOpen}
              data-selected={Boolean(selectedMotorSubtypeOption)}
            >
              <span>{selectedMotorSubtypeOption ? selectedMotorSubtypeOption.label : `Select ${config.fieldLabel.toLowerCase()}...`}</span>
              <span className={styles.equipmentDropdownChevron} aria-hidden="true">
                <svg viewBox="0 0 20 20" focusable="false">
                  <path d="M5.5 7.5 10 12l4.5-4.5" />
                </svg>
              </span>
            </button>

            {motorSubtypeDropdownOpen ? (
              <div className={styles.equipmentDropdownMenu}>
                {config.options.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    className={`${styles.equipmentDropdownOption} ${motorSubtypeValue === option.value ? styles.equipmentDropdownOptionActive : ''}`}
                    onClick={() => handleMotorSubtypeSelection(option.value)}
                  >
                    <span>{option.label}</span>
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    );
  }


  function renderMotorSearchStep() {
    const selectedLabel = selectedMotorCanonicalModel?.displayLabel ?? 'Choose vehicle model';
    const showTypePicker = Boolean(selectedMotorCanonicalModel && motorTypeOptions.length > 1);

    return (
      <div className={styles.stepBlock}>
        <div className={styles.selectedSummary}>
          <span className={styles.selectedSummaryPill}>Motor</span>
          {selectedMotorCanonicalModel ? <span className={styles.selectedSummaryPill}>{selectedMotorCanonicalModel.familyLabel}</span> : null}
          {selectedMotorCanonicalModel ? <span className={styles.selectedSummaryPill}>{selectedMotorCanonicalModel.brandName}</span> : null}
        </div>

        <div>
          <h2 className={styles.stepTitle}>Search brand and model</h2>
          <p className={styles.stepText}>Search for the clean Motor model. Aim4price will keep detailed variants hidden in the pricing matrix.</p>
        </div>

        <div className={`${styles.currentCard} ${styles.tractorSetupCard}`}>
          <div className={styles.currentCardHead}>
            <div>
              <h3 className={styles.currentTitle}>Motor model</h3>
              <p className={styles.currentHint}>Examples: Toyota Hilux, Hilux, Ford Ranger, Volkswagen Polo, Yamaha MT-07.</p>
            </div>
            <span className={styles.equipmentCountPill}>{motorCanonicalLoading ? 'Searching' : `${motorCanonicalResults.length} results`}</span>
          </div>

          <label className={`${styles.field} ${styles.searchPanel}`}>
            <span className={styles.fieldLabel}>Search brand and model</span>
            <input
              className={styles.searchInput}
              value={motorCanonicalQuery}
              onChange={(event) => {
                setMotorCanonicalQuery(event.target.value);
                setMotorCanonicalDropdownOpen(true);
                setMotorCanonicalModelId('');
                setMotorSelectedTypeKey('');
                setGenericCatalogModels([]);
                clearGenericModelSelection({ clearManual: true, clearPrefilledSpecs: true });
                resetResult();
              }}
              onFocus={() => setMotorCanonicalDropdownOpen(true)}
              placeholder={getSearchPlaceholder('motor', 'model')}
              autoComplete="off"
            />
          </label>

          <div className={styles.equipmentDropdownWrap}>
            <button
              type="button"
              className={`${styles.equipmentDropdownTrigger} ${motorCanonicalDropdownOpen || motorCanonicalQuery ? styles.equipmentDropdownTriggerOpen : ''}`}
              onClick={() => setMotorCanonicalDropdownOpen((value) => !value)}
              disabled={motorCanonicalLoading && !motorCanonicalResults.length}
              aria-expanded={motorCanonicalDropdownOpen}
              data-selected={Boolean(selectedMotorCanonicalModel)}
            >
              <span>{selectedLabel}</span>
              <span className={styles.equipmentDropdownChevron} aria-hidden="true">
                <svg viewBox="0 0 20 20" focusable="false">
                  <path d="M5.5 7.5 10 12l4.5-4.5" />
                </svg>
              </span>
            </button>

            {motorCanonicalDropdownOpen || motorCanonicalQuery ? (
              <div className={styles.equipmentDropdownMenu}>
                {motorCanonicalResults.length ? (
                  motorCanonicalResults.map((model) => (
                    <button
                      key={model.id}
                      type="button"
                      className={`${styles.equipmentDropdownOption} ${motorCanonicalModelId === model.id ? styles.equipmentDropdownOptionActive : ''}`}
                      onClick={() => applyMotorCanonicalModel(model)}
                    >
                      <span className={styles.modelOptionText}>{model.displayLabel}</span>
                      <span className={styles.modelOptionMeta}>{model.familyLabel}</span>
                    </button>
                  ))
                ) : (
                  <div className={styles.equipmentDropdownEmpty}>
                    {motorCanonicalQuery.trim().length < 2 ? 'Type at least two letters to search.' : motorCanonicalLoading ? 'Searching...' : 'No clean Motor model found.'}
                  </div>
                )}
              </div>
            ) : null}
          </div>

          {motorCanonicalSearchError ? <p className={styles.message}>{motorCanonicalSearchError}</p> : null}

          {showTypePicker ? (
            <div className={`${styles.inlineSetupGroup} ${styles.modelSetupGroup}`} style={{ marginTop: '1rem' }}>
              <div className={styles.inlineSetupHeader}>
                <span className={styles.fieldLabel}>Type</span>
                <strong>{selectedMotorTypeOption?.label ?? 'Choose type'}</strong>
              </div>

              <div className={styles.equipmentDropdownWrap}>
                <button
                  type="button"
                  className={`${styles.equipmentDropdownTrigger} ${motorTypeDropdownOpen ? styles.equipmentDropdownTriggerOpen : ''}`}
                  onClick={() => setMotorTypeDropdownOpen((value) => !value)}
                  aria-expanded={motorTypeDropdownOpen}
                  data-selected={Boolean(selectedMotorTypeOption)}
                >
                  <span>{selectedMotorTypeOption?.label ?? 'Select type...'}</span>
                  <span className={styles.equipmentDropdownChevron} aria-hidden="true">
                    <svg viewBox="0 0 20 20" focusable="false">
                      <path d="M5.5 7.5 10 12l4.5-4.5" />
                    </svg>
                  </span>
                </button>

                {motorTypeDropdownOpen ? (
                  <div className={styles.equipmentDropdownMenu}>
                    {motorTypeOptions.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        className={`${styles.equipmentDropdownOption} ${motorSelectedTypeKey === option.value ? styles.equipmentDropdownOptionActive : ''}`}
                        onClick={() => handleMotorTypeSelection(option.value)}
                      >
                        <span className={styles.modelOptionText}>{option.label}</span>
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>

              <p className={styles.fieldHint}>This question is only shown because the selected model has more than one Motor type.</p>
            </div>
          ) : selectedMotorCanonicalModel ? (
            <p className={styles.fieldHint}>Only one type is available for this model, so Aim4price skipped the type question.</p>
          ) : null}
        </div>
      </div>
    );
  }

  function renderBrandStep() {
    if (selectedMotorSubtypeConfig && !motorSubtypeValue) {
      return renderMotorSubtypeSelection(selectedMotorSubtypeConfig);
    }

    return (
      <div className={styles.equipmentStage}>
        <div className={`${styles.equipmentStageTop} ${styles.equipmentStageTopSolo}`}>
          {selectedFamily ? <span className={styles.selectedSummaryPill}>{selectedFamily.familyLabel}</span> : null}
          {selectedMotorSubtypeOption ? (
            <button
              type="button"
              className={`${styles.selectedSummaryPill} ${styles.selectedSummaryButton}`}
              onClick={() => {
                setMotorSubtypeValue('');
                setMotorSubtypeDropdownOpen(true);
                setBrandSlug('');
                clearGenericModelSelection({ clearManual: true, clearPrefilledSpecs: true });
                resetResult();
              }}
            >
              {selectedMotorSubtypeOption.label}
            </button>
          ) : null}
        </div>

        {!compactAppMode ? (
          <div className={styles.equipmentStageIntro}>
            <h2 className={styles.stepTitle}>Choose brand</h2>
            <p className={styles.stepText}>Search or select the brand.</p>
          </div>
        ) : null}

        <div className={`${styles.currentCard} ${styles.equipmentPickerCard}`}>
          <div className={styles.equipmentPickerHead}>
            <div>
              <span className={styles.fieldLabel}>Search brand</span>
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
              placeholder={getSearchPlaceholder(selectedSector, 'brand')}
              autoComplete="off"
            />
          </label>

          <div className={styles.equipmentDropdownWrap}>
            <button
              type="button"
              className={`${styles.equipmentDropdownTrigger} ${brandDropdownOpen ? styles.equipmentDropdownTriggerOpen : ''} ${selectedBrandIsUnknown ? styles.equipmentDropdownTriggerWarning : ''}`}
              onClick={() => setBrandDropdownOpen((value) => !value)}
              disabled={brandsLoading || !filteredBrands.length}
              aria-expanded={brandDropdownOpen}
              data-selected={Boolean(selectedBrand)}
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
                      className={`${styles.equipmentDropdownOption} ${isUnknownBrandSlug(brand.slug) ? styles.equipmentDropdownOptionWarning : ''} ${brandSlug === brand.slug ? styles.equipmentDropdownOptionActive : ''}`}
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
            <p className={styles.message}>Only Brand not listed is available until brands are linked to this {getAssetTypeLabel(selectedSector)}.</p>
          ) : null}
          {brands.length > 0 && !filteredBrands.length && !brandsLoading ? (
            <p className={styles.message}>No matching brand. Clear the search or choose another {getAssetTypeLabel(selectedSector)}.</p>
          ) : null}
        </div>
      </div>
    );
  }

  function renderPathStep() {
    const pathOptionsLoading = Boolean(!selectedBrandIsUnknown && !genericModelAvailabilityChecked);
    const exactModelSelectionLocked = Boolean(
      flowMode === 'exact_model' &&
        ((exactTractorAvailable && selectedModel) || (!exactTractorAvailable && selectedGenericModel)),
    );
    const showExactPathCard = !selectedBrandIsUnknown && exactModelRowsAvailable;
    const showSpecsPathCard = !exactModelSelectionLocked;
    const pathCardCount = (showExactPathCard ? 1 : 0) + (showSpecsPathCard ? 1 : 0);
    const pathDeckClassName = `${styles.choiceGrid} ${styles.pathChoiceGrid} ${styles.pathChoiceDeck} ${pathCardCount === 1 ? styles.pathChoiceDeckSingle : ''}`;
    const showPathChoices = !compactAppMode || !flowMode;

    return (
      <div className={compactAppMode && flowMode ? styles.pathSetupPage : undefined}>
        {!compactAppMode ? (
          <>
            <h2 className={styles.stepTitle}>Choose estimate path</h2>
            <p className={styles.stepText}>Choose the route that best matches what you know.</p>
          </>
        ) : null}

        {showPathChoices ? pathOptionsLoading ? (
          <div className={styles.pathSelectionPlaceholder} role="status" aria-live="polite">
            <span className={styles.pathLoadingSpinner} aria-hidden="true" />
            <div>
              <strong>Preparing estimate paths</strong>
              <span>Checking exact-model availability so all available options appear together.</span>
            </div>
          </div>
        ) : (
        <div className={pathDeckClassName}>
          {showExactPathCard ? (
            <button
              type="button"
              className={`${styles.choiceCard} ${styles.pathChoiceCard} ${exactModelSelectionLocked ? styles.pathChoiceCardLocked : ''} ${flowMode === 'exact_model' ? styles.choiceCardActive : ''}`}
              aria-pressed={flowMode === 'exact_model'}
              onClick={() => {
                if (exactModelSelectionLocked) return;
                setFlowMode('exact_model');
                setTypedModelName('');
                setGenericModelMode('');
                setTractorType('');
                setDrive('');
                setCab('');
                resetExactModelSelection();
                resetDetailsFlow();
                scrollWizardToStart();
              }}
            >
              <strong>Use exact model</strong>
              <span className={styles.choiceCardNote}>{compactAppMode ? 'When you know the model.' : 'Best when you know the model and want the clearest estimate path.'}</span>
            </button>
          ) : null}

          {showSpecsPathCard ? (
            <button
              type="button"
              className={`${styles.choiceCard} ${styles.pathChoiceCard} ${flowMode === 'generic_specs' ? styles.choiceCardActive : ''}`}
              aria-pressed={flowMode === 'generic_specs'}
              onClick={() => {
                setFlowMode('generic_specs');
                setTractorType('');
                setDrive('');
                setCab('');
                resetExactModelSelection();
                resetDetailsFlow();
                scrollWizardToStart();
              }}
            >
              <strong>Use {getSpecsLabel(selectedSector)}</strong>
              <span className={styles.choiceCardNote}>{compactAppMode ? 'Uncertain model' : 'Use when exact model data is unavailable or the model is uncertain.'}</span>
            </button>
          ) : null}
        </div>
        ) : null}

        <div className={styles.pathSetupContent}>
          {!pathOptionsLoading && flowMode === 'exact_model' && exactTractorAvailable && showExactPathCard ? renderTractorModelPicker() : null}
          {!pathOptionsLoading && genericExactModelPath && showExactPathCard ? renderGenericModelPicker() : null}
          {!pathOptionsLoading && flowMode === 'generic_specs' ? renderUnknownModelChoice() : null}
        </div>
      </div>
    );
  }

  function renderTractorModelPicker() {
    return (
      <div className={`${styles.currentCard} ${styles.tractorSetupCard}`} style={{ marginTop: '1rem' }}>
        <div className={styles.currentCardHead}>
          <div>
            <h3 className={styles.currentTitle}>Choose the tractor model</h3>
            <p className={styles.currentHint}>Select type, drive and cab to show matching models.</p>
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
                  aria-pressed={tractorType === option.value}
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
                    aria-pressed={drive === option.value}
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
                    aria-pressed={cab === option.value}
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
                  placeholder={getSearchPlaceholder(selectedSector, 'model')}
                  autoComplete="off"
                />
              </label>

              <div className={styles.equipmentDropdownWrap}>
                <button
                  type="button"
                  className={`${styles.equipmentDropdownTrigger} ${modelDropdownOpen || modelQuery ? styles.equipmentDropdownTriggerOpen : ''}`}
                  onClick={() => setModelDropdownOpen((value) => !value)}
                  disabled={modelsLoading || !tractorModels.length}
                  aria-expanded={modelDropdownOpen}
                  data-selected={Boolean(selectedModel)}
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
        : genericModelMode === 'unknown'
          ? 'Model unknown'
          : 'Choose model';
    const modelPickerTitle = genericModelRequired ? 'Choose exact catalogue model' : 'Choose a catalogue model';
    const modelPickerHint = genericModelRequired
      ? `Select the exact model from the ${getAssetNounLabel(selectedSector)} catalogue before continuing.`
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
                placeholder={getSearchPlaceholder(selectedSector, 'model')}
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
                data-selected={Boolean(selectedGenericModel)}
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
                        {isMotorSector(selectedSector) ? null : <span className={styles.modelOptionMeta}>{formatGenericModelDetail(model)}</span>}
                      </button>
                    ))
                  ) : (
                    <div className={styles.equipmentDropdownEmpty}>No matching catalogue model found.</div>
                  )}
                </div>
              ) : null}
            </div>

            {!genericModelRequired ? (
              <div className={styles.inlineOptionRow}>
                <button
                  type="button"
                  className={`${styles.inlineOptionButton} ${genericModelMode === 'manual' ? styles.inlineOptionButtonActive : ''}`}
                  aria-pressed={genericModelMode === 'manual'}
                  onClick={handleGenericModelNotListed}
                >
                  Model not listed
                </button>
              </div>
            ) : null}

            {genericModelsLoading ? <p className={styles.fieldHint}>Loading catalogue models...</p> : null}
            {!genericCatalogModels.length && !genericModelsLoading ? (
              <div className={styles.catalogEmptyState}>
                <p className={styles.message}>No catalogue models found for this brand and {getAssetTypeLabel(selectedSector)} yet.</p>
              </div>
            ) : null}
            {genericCatalogModels.length > 0 && !filteredGenericModels.length && !genericModelsLoading ? (
              <p className={styles.message}>No matching catalogue model. Clear the search{genericModelRequired ? ' or choose another catalogue model.' : ' or choose Model not listed.'}</p>
            ) : null}

            {genericModelMode === 'manual' && !genericModelRequired ? (
              <label className={styles.field}>
                <span className={styles.fieldLabel}>Enter model name</span>
                <input
                  value={typedModelName}
                  onChange={(event) => {
                    setTypedModelName(event.target.value);
                    resetResult();
                  }}
                  placeholder={getSearchPlaceholder(selectedSector, 'manualModel')}
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

  function renderUnknownModelChoice() {
    return (
      <div className={`${styles.currentCard} ${styles.unknownModelCard}`} style={{ marginTop: '1rem' }}>
        <div className={styles.currentCardHead}>
          <div>
            <h3 className={styles.currentTitle}>Model details</h3>
            <p className={styles.currentHint}>
              {compactAppMode ? 'Enter the model, or choose Unknown.' : 'Enter the model when you know it, or continue with the model marked as unknown.'}
            </p>
          </div>
        </div>

        {selectedBrandIsUnknown ? (
          <label className={`${styles.field} ${styles.unlistedBrandNameField}`}>
            <span className={styles.fieldLabel}>Enter brand name</span>
            <input
              value={unlistedBrandName}
              onChange={(event) => {
                setUnlistedBrandName(event.target.value);
                resetResult();
              }}
              placeholder="e.g. Toyota, JCB, Mahindra"
              autoComplete="off"
            />
            <span className={styles.fieldHint}>Optional. This name is saved with the estimate details, without adding a new catalogue brand.</span>
          </label>
        ) : null}

        <div className={styles.inlineOptionRow}>
          <button
            type="button"
            className={`${styles.inlineOptionButton} ${genericModelMode === 'manual' ? styles.inlineOptionButtonActive : ''}`}
            aria-pressed={genericModelMode === 'manual'}
            onClick={handleGenericModelNotListed}
          >
            {compactAppMode ? 'Enter' : 'Enter model manually'}
          </button>
          <button
            type="button"
            className={`${styles.inlineOptionButton} ${genericModelMode === 'unknown' ? styles.inlineOptionButtonActive : ''}`}
            aria-pressed={genericModelMode === 'unknown'}
            onClick={handleGenericModelUnknown}
          >
            {compactAppMode ? 'Unknown' : 'Model unknown'}
          </button>
        </div>

        {genericModelMode === 'manual' ? (
          <label className={styles.field}>
            <span className={styles.fieldLabel}>Enter model name</span>
            <input
              value={typedModelName}
              onChange={(event) => {
                setTypedModelName(event.target.value);
                resetResult();
              }}
              placeholder={getSearchPlaceholder(selectedSector, 'manualModel')}
              required
              autoComplete="off"
            />
            <span className={styles.fieldHint}>This will be used only as the typed model name for this estimate.</span>
          </label>
        ) : null}

        {genericModelMode === 'unknown' ? (
          <p className={styles.fieldHint}>The estimate will continue without a model name.</p>
        ) : null}
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
            data-selected={Boolean(selectedOption)}
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
    scrollToDetailsCard('valuation-usage-step');
  }

  function saveUnknownYear() {
    setYear('');
    setYearModelUnknown(true);
    setYearStepComplete(true);
    setActiveDetailsModal(null);
    setMessage('');
    resetResult();
    scrollToDetailsCard('valuation-usage-step');
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
      scrollToDetailsCard('valuation-condition-step');
      return;
    }

    const workedPercent = toPercentOrNull(lifeWorkedPercent) ?? 50;

    setLifeWorkedPercent(String(workedPercent));
    setUsageAmount('');
    setUsageStepComplete(true);
    setActiveDetailsModal(null);
    setMessage('');
    resetResult();
    scrollToDetailsCard('valuation-condition-step');
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
          <div className={`${styles.detailsModalHeader} ${compactAppMode ? dealerStyles.dealerCompactModalHeader : ''}`}>
            <div>
              <span className={styles.currentEyebrow}>{compactAppMode ? 'Asset details 1 of 5' : 'Step 1'}</span>
              {!compactAppMode ? (
                <>
                  <h3 className={styles.detailsModalTitle}>{getAssetNounTitle(selectedSector)} manufacturing year</h3>
                  <p className={styles.detailsModalText}>Select the manufacturing year.</p>
                </>
              ) : null}
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
              Continue
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
          <div className={`${styles.detailsModalHeader} ${compactAppMode ? dealerStyles.dealerCompactModalHeader : ''}`}>
            <div>
              <span className={styles.currentEyebrow}>{compactAppMode ? 'Asset details 2 of 5' : 'Step 2'}</span>
              {!compactAppMode ? (
                <>
                  <h3 className={styles.detailsModalTitle}>{usageModalMode === 'hours' && showHoursInput ? selectedUsageFieldLabel : 'Worked percentage'}</h3>
                  <p className={styles.detailsModalText}>
                    {usageModalMode === 'hours' && showHoursInput
                      ? selectedUsageDisplayUnit === 'km'
                        ? 'Enter the odometer kilometres if they are available.'
                        : 'Enter the engine or equipment hours if they are available.'
                      : `Estimate how much of the ${getAssetNounLabel(selectedSector)}'s working life has already been used.`}
                  </p>
                </>
              ) : null}
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
                {compactAppMode ? 'I do not know' : getUnknownUsageButtonLabel(selectedSector, selectedFamily?.usageMetricType)}
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
              Continue
            </button>
          </div>
        </div>
      </div>
    );
  }

  function renderSpecQuestionsProgress() {
    if (!conditionStepComplete) return null;

    const questionsForProgress = selectedMotorSubtypeSpecKeys.size
      ? effectiveSpecQuestions.filter((question) => !selectedMotorSubtypeSpecKeys.has(question.specKey))
      : effectiveSpecQuestions;

    if (!questionsForProgress.length) {
      return (
        <div className={`${styles.currentCard} ${styles.specProgressCard}`}>
          <h3 className={styles.currentTitle}>Answer a few simple questions</h3>
          <p className={styles.message}>No further family-specific questions are needed. Aim4price will use the selected type, year, usage, condition, popularity, brand and replacement bands if available.</p>
        </div>
      );
    }

    const visibleQuestions: SpecQuestion[] = [];
    for (const question of questionsForProgress) {
      visibleQuestions.push(question);
      if (question.isRequired && !isSpecQuestionAnswered(question, specAnswers[question.specKey])) break;
    }

    return (
      <div className={`${styles.currentCard} ${styles.specProgressCard}`}>
        <div className={styles.currentCardHead}>
          <div>
            <span className={styles.currentEyebrow}>{compactAppMode ? 'Asset details 5 of 5' : 'Step 5'}</span>
            <h3 className={styles.currentTitle}>Answer a few simple questions</h3>
            <p className={styles.currentHint}>Answer each question in order. The next question appears underneath once the required answer is captured.</p>
          </div>
          <span className={styles.selectedSummaryPill}>{visibleQuestions.length} of {questionsForProgress.length}</span>
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

      </div>
    );
  }

  function renderDetailsStep() {
    const genericPath = genericValuationPath;
    const selfPropelled = selectedFamily?.isPropelled || selectedFamily?.usageMetricType === 'hours' || selectedFamily?.usageMetricType === 'km';
    const showHoursInput = !genericPath || selfPropelled;
    const usageTitle = showHoursInput ? selectedUsageFieldLabel : 'Worked percentage';
    const detailsTitle = genericExactModelPath
      ? `${getAssetNounTitle(selectedSector)} details`
      : genericPath
        ? getSpecsTitle(selectedSector)
        : 'Tractor details';
    const detailsIntro = genericExactModelPath
      ? compactAppMode
        ? `Add year, ${usageTitle.toLowerCase()}, condition and popularity.`
        : `Aim4price will use the selected catalogue model replacement price. Add year, ${usageTitle.toLowerCase()}, condition and popularity to calculate the estimate.`
      : compactAppMode
        ? 'Answer each step.'
        : 'Answer one step at a time. Aim4price only reveals the next question after the current one is saved.';
    const detailedAssessmentSections = [
      { label: 'Mechanical condition', value: dealerMechanicalCondition },
      { label: 'Body / frame / structure', value: dealerBodyCondition },
      { label: 'Tyres / wear components', value: dealerTyreCondition },
      { label: 'Service history', value: dealerServiceHistory },
      { label: 'Required work', value: dealerRequiredWork },
    ];
    const firstIncompleteDetailedSection = detailedAssessmentSections.find((section) => !section.value)?.label ?? '';
    const currentDetailedSection = activeDetailedAssessmentSection || firstIncompleteDetailedSection;
    const currentDetailedSectionIndex = detailedAssessmentSections.findIndex((section) => section.label === currentDetailedSection);
    const currentDetailedSectionNumber = currentDetailedSectionIndex >= 0 ? currentDetailedSectionIndex + 1 : detailedAssessmentSections.length;

    return (
      <div>
        <h2 className={styles.stepTitle}>{detailsTitle}</h2>
        <p className={styles.stepText}>{detailsIntro}</p>

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
              <strong>{compactAppMode ? 'Manufacturing year' : `${getAssetNounTitle(selectedSector)} manufacturing year`}</strong>
              <small>{yearStepComplete ? getYearAnswerLabel() : compactAppMode ? 'Choose the year.' : 'Choose the manufacturing year to start.'}</small>
            </span>
            <span className={styles.specStepAction}>{yearStepComplete ? 'Edit' : 'Choose year'}</span>
          </button>

          {yearStepComplete ? (
            <button
              id="valuation-usage-step"
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
            <div id="valuation-condition-step" className={`${styles.currentCard} ${styles.conditionStepCard}`}>
              <div className={styles.currentCardHead}>
                <div>
                  <span className={styles.currentEyebrow}>{compactAppMode ? 'Asset details 3 of 5' : 'Step 3'}</span>
                  <h3 className={styles.currentTitle}>Condition</h3>
                  <p className={styles.currentHint}>{compactAppMode ? 'Choose one.' : 'Choose the closest current condition.'}</p>
                </div>
                {conditionStepComplete ? (
                  <span className={styles.selectedSummaryPill} data-selection-status="selected">
                    {detailedAssessmentOpen ? 'Detailed condition' : conditionLabel(condition)}
                  </span>
                ) : !compactAppMode ? (
                  <span className={styles.selectedSummaryPill} data-selection-status="pending">Choose one</span>
                ) : null}
              </div>

              {!compactAppMode || !detailedAssessmentOpen ? (
                <div className={styles.conditionButtonGrid}>
                  {conditionOptions.map((option) => {
                    const selected = conditionStepComplete && condition === option.key;
                    return (
                      <button
                        key={option.key}
                        type="button"
                        className={`${styles.conditionChoiceButton} ${selected ? styles.conditionChoiceButtonActive : ''}`}
                        aria-pressed={selected}
                        onClick={() => {
                          setCondition(option.key);
                          setConditionStepComplete(true);
                          clearDetailedAssessment();
                          resetResult();
                          scrollToDetailsCard('valuation-detailed-condition-entry');
                        }}
                      >
                        {compactAppMode ? <span className={styles.conditionChoiceIndicator} aria-hidden="true">{selected ? '✓' : ''}</span> : null}
                        <span className={styles.conditionChoiceLabel}>{option.label}</span>
                      </button>
                    );
                  })}
                </div>
              ) : null}

              {conditionStepComplete ? (
                <>
                  <div id="valuation-detailed-condition-entry" className={styles.detailedAssessmentEntry}>
                    <div>
                      <strong>{compactAppMode ? detailedAssessmentOpen ? 'Detailed condition' : 'Add more detail?' : 'Want a more accurate condition adjustment?'}</strong>
                      <span>
                        {compactAppMode
                          ? detailedAssessmentOpen
                            ? 'These answers replace the broad condition choice.'
                            : 'Answer five quick condition questions for a more accurate estimate.'
                          : 'Assess the mechanical condition, body, tyres or wear components, service history and required work.'}
                      </span>
                    </div>
                    <button
                      type="button"
                      className={styles.detailedAssessmentToggle}
                      aria-expanded={detailedAssessmentOpen}
                      aria-controls="detailed-condition-assessment"
                      onClick={() => {
                        if (detailedAssessmentOpen) {
                          clearDetailedAssessment(false);
                          scrollToDetailsCard('valuation-detailed-condition-entry');
                        } else {
                          setDetailedAssessmentOpen(true);
                          setActiveDetailedAssessmentSection(firstIncompleteDetailedSection || 'Mechanical condition');
                          setDetailedAssessmentError('');
                          scrollToDetailsCard('detailed-condition-assessment');
                        }
                        resetResult();
                      }}
                    >
                      {detailedAssessmentOpen ? 'Use broad condition' : compactAppMode ? 'Add details' : 'Add detailed condition'}
                    </button>
                  </div>

              {detailedAssessmentOpen ? (
                <div id="detailed-condition-assessment" className={styles.detailedAssessmentPanel}>
                  <div className={styles.detailedAssessmentHeader}>
                    <strong>
                      {compactAppMode
                        ? currentDetailedSection
                          ? `Detailed condition ${currentDetailedSectionNumber} of ${detailedAssessmentSections.length}`
                          : 'Detailed condition complete'
                        : 'Detailed Asset Assessment'}
                    </strong>
                    <span>
                      {compactAppMode
                        ? currentDetailedSection
                          ? 'Choose the closest answer for this asset.'
                          : 'You can edit any answer below.'
                        : 'This replaces the broad condition percentage. It is not applied as a second condition deduction.'}
                    </span>
                  </div>
                  {renderDealerAssessmentGroup('Mechanical condition', dealerMechanicalCondition, DEALER_MECHANICAL_OPTIONS, (value) => {
                    setDealerMechanicalCondition(value);
                    resetResult();
                  }, currentDetailedSection === 'Mechanical condition', 'Body / frame / structure')}
                  {renderDealerAssessmentGroup('Body / frame / structure', dealerBodyCondition, DEALER_BODY_OPTIONS, (value) => {
                    setDealerBodyCondition(value);
                    resetResult();
                  }, currentDetailedSection === 'Body / frame / structure', 'Tyres / wear components')}
                  {renderDealerAssessmentGroup('Tyres / wear components', dealerTyreCondition, DEALER_TYRE_OPTIONS, (value) => {
                    setDealerTyreCondition(value);
                    resetResult();
                  }, currentDetailedSection === 'Tyres / wear components', 'Service history')}
                  {renderDealerAssessmentGroup('Service history', dealerServiceHistory, DEALER_SERVICE_OPTIONS, (value) => {
                    setDealerServiceHistory(value);
                    resetResult();
                  }, currentDetailedSection === 'Service history', 'Required work')}
                  {renderDealerAssessmentGroup('Required work', dealerRequiredWork, DEALER_WORK_OPTIONS, (value) => {
                    setDealerRequiredWork(value);
                    resetResult();
                  }, currentDetailedSection === 'Required work', '')}
                  {detailedAssessmentError ? <p className={styles.advancedError}>{detailedAssessmentError}</p> : null}
                  {detailedAssessmentComplete && !compactAppMode ? <p className={styles.detailedAssessmentReady}>Detailed condition complete.</p> : null}
                </div>
              ) : null}
                </>
              ) : null}
            </div>
          ) : null}

          {conditionStepComplete && (!detailedAssessmentOpen || detailedAssessmentComplete) ? (
            <div id="valuation-popularity-step" className={`${styles.currentCard} ${styles.popularityStepCard}`}>
              <div className={styles.currentCardHead}>
                <div>
                  {compactAppMode ? (
                    <span className={styles.currentEyebrow}>Asset details 4 of 5</span>
                  ) : (
                    <span className={styles.currentEyebrow}>Step 4</span>
                  )}
                  <h3 className={styles.currentTitle}>Popularity</h3>
                  <p className={styles.currentHint}>Rate current market demand for this asset.</p>
                </div>
                <span className={styles.selectedSummaryPill} data-selection-status={popularityStepComplete ? 'selected' : 'pending'}>
                  {popularityStepComplete ? `${popularityStars} / 5 stars` : 'Choose rating'}
                </span>
              </div>
              <div className={styles.popularityStars} role="group" aria-label="Popularity from 1 to 5 stars">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    className={star <= popularityStars ? styles.popularityStarActive : ''}
                    onClick={() => {
                      setPopularityStars(star);
                      resetResult();
                    }}
                    aria-label={`${star} star${star === 1 ? '' : 's'}`}
                    aria-pressed={popularityStars === star}
                  >
                    ★
                  </button>
                ))}
              </div>
              <small className={styles.advancedFieldHelp}>1 = difficult to sell, 3 = normal demand, 5 = highly sought after.</small>
            </div>
          ) : null}

          {popularityStepComplete && shouldAskGenericSpecQuestions ? renderSpecQuestionsProgress() : null}
        </div>

        {!genericPath && popularityStepComplete ? (
          <div className={styles.currentCard} style={{ marginTop: '1rem' }}>
            <h3 className={styles.currentTitle}>Tractor extras</h3>
            <p className={styles.currentHint}>Select fitted extras. Their replacement prices are depreciated before value is added.</p>
            <div className={`${styles.choiceGrid} ${styles.tractorExtrasGrid}`}>
              <button type="button" className={`${styles.choiceCard} ${frontPto ? styles.choiceCardActive : ''}`} aria-pressed={frontPto} onClick={() => {
                setFrontPto((value) => {
                  if (value) setFrontPtoReplacementPrice('');
                  return !value;
                });
                resetResult();
              }}>
                <strong>Front PTO</strong>
                {!compactAppMode ? <span className={styles.choiceCardNote}>Adds depreciated value</span> : null}
              </button>
              <button type="button" className={`${styles.choiceCard} ${frontLoader ? styles.choiceCardActive : ''}`} aria-pressed={frontLoader} onClick={() => {
                setFrontLoader((value) => {
                  if (value) {
                    setFrontLoaderReplacementPrice('');
                    setFrontLoaderYear('');
                  }
                  return !value;
                });
                resetResult();
              }}>
                <strong>Front Loader</strong>
                {!compactAppMode ? <span className={styles.choiceCardNote}>Adds depreciated value</span> : null}
              </button>
              <button type="button" className={`${styles.choiceCard} ${gpsEnabled ? styles.choiceCardActive : ''}`} aria-pressed={gpsEnabled} onClick={() => {
                setGpsEnabled((value) => {
                  if (value) {
                    setGpsReplacementPrice('');
                    setGpsYear('');
                  }
                  return !value;
                });
                resetResult();
              }}>
                <strong>GPS</strong>
                {!compactAppMode ? <span className={styles.choiceCardNote}>Adds depreciated value</span> : null}
              </button>
              <button type="button" className={`${styles.choiceCard} ${otherExtraEnabled ? styles.choiceCardActive : ''}`} aria-pressed={otherExtraEnabled} onClick={() => {
                setOtherExtraEnabled((value) => {
                  if (value) {
                    setOtherExtraName('');
                    setOtherExtraReplacementPrice('');
                  }
                  return !value;
                });
                resetResult();
              }}>
                <strong>Extra&apos;s</strong>
                {!compactAppMode ? <span className={`${styles.choiceCardNote} ${styles.otherExtraCardNote}`}>Add another extra</span> : null}
              </button>
            </div>
            {frontLoader ? (
              <div className={styles.frontLoaderFields}>
                <label className={styles.field}>
                  <span className={styles.fieldLabel}>Front Loader year added</span>
                  <input
                    value={frontLoaderYear}
                    onChange={(event) => {
                      setFrontLoaderYear(event.target.value);
                      resetResult();
                    }}
                    inputMode="numeric"
                    placeholder="Same as tractor"
                  />
                  <small className={styles.advancedFieldHelp}>Used to depreciate the loader separately from the tractor.</small>
                </label>
              </div>
            ) : null}
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
                      data-selected={Boolean(gpsType)}
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
                              setGpsReplacementPrice('');
                              setGpsTypeDropdownOpen(false);
                              resetResult();
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
                  <input value={gpsYear} onChange={(event) => {
                    setGpsYear(event.target.value);
                    resetResult();
                  }} placeholder="Optional" />
                </label>
              </div>
            ) : null}
            {otherExtraEnabled ? (
              <div className={`${styles.inputGrid} ${styles.otherExtraFields}`}>
                <label className={styles.field}>
                  <span className={styles.fieldLabel}>Extra name</span>
                  <input
                    value={otherExtraName}
                    onChange={(event) => {
                      setOtherExtraName(event.target.value);
                      resetResult();
                    }}
                    maxLength={100}
                    placeholder="e.g. Weight set"
                  />
                </label>
                <label className={styles.field}>
                  <span className={styles.fieldLabel}>Replacement price (excl. VAT)</span>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={otherExtraReplacementPrice}
                    onChange={(event) => {
                      setOtherExtraReplacementPrice(event.target.value);
                      resetResult();
                    }}
                    placeholder="e.g. 25 000"
                  />
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

  function renderDealerAssessmentGroup(
    label: string,
    value: string,
    options: readonly { value: string; label: string }[],
    onChange: (value: string) => void,
    isActive = true,
    nextSection = '',
  ) {
    const selectedOptionLabel = options.find((option) => option.value === value)?.label ?? value;

    if (compactAppMode && value && !isActive) {
      return (
        <button
          type="button"
          className={styles.detailedAssessmentSummary}
          onClick={() => setActiveDetailedAssessmentSection(label)}
        >
          <span>✓</span>
          <span>
            <strong>{label}</strong>
            <small>{selectedOptionLabel}</small>
          </span>
          <span>Edit</span>
        </button>
      );
    }

    if (compactAppMode && !isActive) return null;

    return (
      <fieldset className={styles.dealerAssessmentGroup} data-assessment-active={isActive}>
        <legend>{label}</legend>
        <div className={styles.dealerAssessmentOptions}>
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              className={`${styles.dealerAssessmentOption} ${value === option.value ? styles.dealerAssessmentOptionActive : ''}`}
              aria-pressed={value === option.value}
              onClick={() => {
                onChange(option.value);
                setDetailedAssessmentError('');
                if (compactAppMode) {
                  setActiveDetailedAssessmentSection(nextSection);
                  if (!nextSection) scrollToDetailsCard('valuation-popularity-step');
                }
              }}
            >
              {option.label}
            </button>
          ))}
        </div>
      </fieldset>
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
    const appliedDealerAssessment = getAppliedDealerAssessmentFromState(resultState);
    const isSalvageEstimate = isGeneric
      ? Boolean(genericSelectedCalculation?.isSalvageEstimate)
      : Boolean(tractorResult?.isSalvageEstimate);
    const salvagePercent = isGeneric ? genericSelectedCalculation?.salvagePercent ?? null : tractorResult?.salvagePercent ?? null;
    const salvageValueExVat = isGeneric ? genericSelectedCalculation?.salvageValueExVat ?? null : tractorResult?.salvageValueExVat ?? null;
    const aimValue = isGeneric
      ? genericSelectedCalculation?.valuationMidExVat ?? null
      : tractorResult?.aim4priceValueExVat ?? null;
    const userPriceInput = parseMoneyInput(userReplacementPrice);
    const frontPtoReplacementInput = parseMoneyInput(frontPtoReplacementPrice);
    const frontLoaderReplacementInput = parseMoneyInput(frontLoaderReplacementPrice);
    const gpsReplacementInput = parseMoneyInput(gpsReplacementPrice);
    const otherExtraReplacementInput = parseMoneyInput(otherExtraReplacementPrice);
    const tractorExtraReplacementInputsReady = Boolean(
      tractorResult && (
        (frontPto && frontPtoReplacementInput) ||
        (frontLoader && frontLoaderReplacementInput) ||
        (gpsEnabled && gpsReplacementInput) ||
        (otherExtraEnabled && normalizeText(otherExtraName) && otherExtraReplacementInput)
      ),
    );
    const replacementUpdateReady = isGeneric ? Boolean(userPriceInput) : Boolean(userPriceInput || tractorExtraReplacementInputsReady);
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
    const genericBrandNameForResult = getDisplayBrandName(genericResult?.brand ?? selectedBrand, genericResult?.specsJson, unlistedBrandName);
    const genericFamilyLabelForResult = genericResult?.family.label ?? selectedFamily?.familyLabel ?? getAssetNounTitle(selectedSector);
    const resultBrandIsUnknown = isUnknownBrandSlug(genericResult?.brand.slug ?? selectedBrand?.slug);
    const machineTitle = isGeneric
      ? resultBrandIsUnknown
        ? `${genericBrandNameForResult} ${genericModelNameForResult || genericFamilyLabelForResult}`.trim()
        : `${genericFamilyLabelForResult} • ${genericBrandNameForResult}${genericModelNameForResult ? ` • ${genericModelNameForResult}` : ''}`
      : `${tractorResult?.model.brandName ?? ''} ${tractorResult?.model.modelName ?? ''}`.trim();
    const resultCondition = isGeneric ? genericResult?.condition ?? condition : condition;
    const resultYear = isGeneric ? genericResult?.year ?? calculationYear : calculationYear;
    const yearSummary = yearModelUnknown ? 'Unknown' : String(resultYear);
    const resultUsageShortUnit = isGeneric && genericResult
      ? getUsageShortUnit(genericResult.sector.key, genericResult.family.usageMetricType)
      : 'hours';
    const usageSummary = formatSingleUsageSummary({
      actualUsageAmount: isGeneric ? genericResult?.usageAmount ?? usageNumber : usageNumber,
      lifeWorkedPercent: isGeneric ? genericResult?.lifeWorkedPercent ?? lifeWorkedPercentNumber : lifeWorkedPercentNumber,
      sectorKey: genericResult?.sector.key ?? selectedSector,
      usageMetricType: genericResult?.family.usageMetricType ?? selectedFamily?.usageMetricType,
      fallbackUnit: resultUsageShortUnit,
    });
    const tractorExtrasReplacementPriceExVat = tractorResult
      ? (tractorResult.frontPtoReplacementPriceExVat ?? 0)
        + (tractorResult.frontLoaderReplacementPriceExVat ?? 0)
        + (tractorResult.gpsReplacementPriceExVat ?? 0)
        + (tractorResult.otherExtraReplacementPriceExVat ?? 0)
      : 0;
    const tractorAssetReplacementPriceExVat = tractorResult?.replacementPriceUsedExVat ?? tractorResult?.model.aim4priceReplacementExVat ?? null;
    const tractorReplacementBasisText = tractorExtrasReplacementPriceExVat > 0
      ? `Asset ${moneyExVat(tractorAssetReplacementPriceExVat)} + selected extras ${moneyExVat(tractorExtrasReplacementPriceExVat)}`
      : `Asset replacement price: ${moneyExVat(tractorAssetReplacementPriceExVat)}`;
    const genericReplacementBasisText = genericResult?.userReplacementCalculation && replacementPriceBasis === 'user'
      ? `Current basis: your replacement price of ${money(genericResult.userReplacementCalculation.replacementPriceExVat)}`
      : `Current basis: saved replacement estimate of ${money(genericResult?.aim4priceReplacementCalculation?.replacementPriceExVat ?? null)}`;
    const replacementBasisText = isGeneric ? genericReplacementBasisText : tractorReplacementBasisText;
    const resultValueSizeClass = getResultValueSizeClass(headlineDisplayValue);
    const vatDefaultNote = getVatDefaultNote(
      genericResult?.sector.key ?? selectedSector,
      genericResult?.family.key ?? selectedFamily?.familyKey,
    );
    const resultUsageMetricType = getResultUsageMetricType(resultState);
    const resultSectorKey = getResultSectorKey(resultState);
    const advancedLifetimeShortUnit = getUsageShortUnit(resultSectorKey, resultUsageMetricType);
    const advancedLifetimeMin = resultUsageMetricType === 'km' ? ADVANCED_LIFETIME_KM_MIN : ADVANCED_LIFETIME_HOURS_MIN;
    const advancedLifetimeMax = resultUsageMetricType === 'km' ? ADVANCED_LIFETIME_KM_MAX : ADVANCED_LIFETIME_HOURS_MAX;
    const advancedLifetimeInputLabel = resultUsageMetricType === 'km' ? 'Expected lifetime in km' : 'Expected lifetime in hours';
    const appliedAdvancedAssumptions = getAppliedAdvancedAssumptionsFromState(resultState);
    const customAdvancedAssumptionsApplied = hasAppliedAdvancedAssumptions(appliedAdvancedAssumptions);
    const generalSaleability = calculateGeneralSaleability(getSaleabilityInputFromResult(
      resultState,
      resultCondition,
      isGeneric ? genericResult?.usageAmount ?? usageNumber : usageNumber,
      isGeneric ? genericResult?.lifeWorkedPercent ?? lifeWorkedPercentNumber : lifeWorkedPercentNumber,
    ));
    const advancedShowLifetimeInput = shouldShowAdvancedLifetimeInput(resultState, usageNumber, lifeWorkedPercentNumber);
    const advancedConditionQuestionLabel = `What is ${getAdvancedConditionQuestionLabel(resultCondition)} out of 100%?`;
    const advancedControlsDisabled = !canUseAdvancedAssumptions || advancedRecalculateLoading || replacementRecalculateLoading || saveLoading;
    return (
      <div className={styles.resultsLayout}>
        <div className={styles.resultsMain}>
          <section className={`${styles.resultHero} ${resultHeroTone}`}>
            <div className={styles.resultHeroTopline}>
              <span className={styles.resultKicker}>{isSalvageEstimate ? 'Indicative salvage estimate' : appliedDealerAssessment ? 'Detailed estimate' : 'Aim4price estimate'}</span>
              <span className={`${styles.resultConfidenceBadge} ${getConfidenceClass(resultState, confidenceContext)}`}>{confidenceText}</span>
            </div>
            <div className={`${styles.resultValueLine} ${resultValueSizeClass}`}>
              <strong className={styles.resultValue}>{money(headlineDisplayValue)}</strong>
              {headlineValue !== null ? (
                <div className={`${styles.resultVatToggle} ${styles.resultVatToggleInline}`} role="group" aria-label="VAT display mode">
                  <button
                    type="button"
                    className={`${styles.resultVatToggleButton} ${vatDisplayMode === 'excl' ? styles.resultVatToggleButtonActive : ''}`}
                    onClick={() => setVatDisplayMode('excl')}
                    aria-pressed={vatDisplayMode === 'excl'}
                  >
                    VAT excluded
                  </button>
                  <button
                    type="button"
                    className={`${styles.resultVatToggleButton} ${vatDisplayMode === 'incl' ? styles.resultVatToggleButtonActive : ''}`}
                    onClick={() => setVatDisplayMode('incl')}
                    aria-pressed={vatDisplayMode === 'incl'}
                  >
                    VAT included
                  </button>
                </div>
              ) : null}
            </div>
            <p className={styles.resultMachineTitle}>{machineTitle}</p>
            <p className={styles.resultConfidenceNote}>{vatDefaultNote}</p>
            <p className={styles.resultConfidenceNote}>{confidenceNote}</p>
            {isSalvageEstimate && salvagePercent !== null ? (
              <div className={styles.salvageNotice}>
                Depreciation reached the indicative salvage range. The average salvage reference for this replacement-price level is {formatPrecisePercent(salvagePercent)}% ({money(salvageValueExVat)}).
              </div>
            ) : null}
            {genericSelectedCalculation && genericSelectedCalculation.marketabilityReductionPercent > 0 ? (
              <div className={styles.marketabilityNotice}>
                Older passenger-car marketability adjustment applied: {formatPrecisePercent(genericSelectedCalculation.marketabilityReductionPercent)}%.
              </div>
            ) : null}
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
                <strong>{appliedDealerAssessment ? 'Detailed' : conditionLabel(resultCondition)}</strong>
              </div>
              <div className={styles.resultFactCard}>
                <span>Popularity</span>
                <strong>{appliedAdvancedAssumptions?.popularityStars ?? 3} / 5 stars</strong>
              </div>
            </div>
          </section>

          <section className={styles.saleabilitySummary} aria-label="General Saleability">
            <div>
              <span>General Saleability</span>
              <strong>{generalSaleability.score} / 100 · Grade {generalSaleability.grade}</strong>
              <p>{generalSaleability.gradeLabel} · Natural selling window {generalSaleability.naturalSellingWindow}</p>
            </div>
            <button type="button" onClick={() => setSaleabilityOpen(true)}>Refine Saleability</button>
          </section>

          <section className={`${styles.resultAccordion} ${styles.advancedAccordion} ${!canUseAdvancedAssumptions ? styles.advancedAssumptionsLocked : ''}`}>
            <button
              type="button"
              className={styles.resultAccordionToggle}
              onClick={() => setAdvancedPanelOpen((open) => !open)}
              aria-expanded={advancedPanelOpen}
            >
              <span className={styles.resultAccordionTitleGroup}>
                <strong>Advanced assumptions</strong>
                <small>
                  {canUseAdvancedAssumptions
                    ? customAdvancedAssumptionsApplied
                      ? 'Custom assumptions applied.'
                      : 'Fine-tune this estimate only.'
                    : 'For active Aim4price accounts only.'}
                </small>
              </span>
              <span className={styles.resultAccordionAction}>{advancedPanelOpen ? 'Hide' : canUseAdvancedAssumptions ? 'Edit' : 'Locked'}</span>
            </button>

            {advancedPanelOpen ? (
              <div className={styles.resultAccordionBody} style={{ paddingTop: '1rem' }}>
                <div className={`${styles.advancedControlsPreview} ${!canUseAdvancedAssumptions ? styles.advancedControlsPreviewLocked : ''}`}>
                  {!canUseAdvancedAssumptions ? (
                    <p className={styles.advancedLockedCopy}>Advanced assumptions are for active Aim4price accounts only.</p>
                  ) : null}

                  <div className={`${styles.advancedControlsContent} ${!canUseAdvancedAssumptions ? styles.advancedControlsLocked : ''}`}>
                    <div className={`${styles.advancedAssumptionsGrid} ${appliedDealerAssessment ? styles.advancedAssumptionsGridSingle : ''}`}>
                    {advancedShowLifetimeInput ? (
                      <label className={styles.field}>
                        <span className={styles.fieldLabel}>{advancedLifetimeInputLabel}</span>
                        <input
                          type="text"
                          inputMode="numeric"
                          value={advancedLifetimeUsage}
                          onChange={(event) => setAdvancedLifetimeUsage(event.target.value)}
                          placeholder={resultUsageMetricType === 'km' ? 'e.g. 350,000' : 'e.g. 12,000'}
                          disabled={!canUseAdvancedAssumptions}
                        />
                        <small className={styles.advancedFieldHelp}>
                          Allowed range: {formatPlainNumber(advancedLifetimeMin)} to {formatPlainNumber(advancedLifetimeMax)} {advancedLifetimeShortUnit}.
                        </small>
                      </label>
                    ) : null}

                    {!appliedDealerAssessment ? (
                      <label className={styles.field}>
                        <span className={styles.fieldLabel}>{advancedConditionQuestionLabel}</span>
                        <input
                          type="text"
                          inputMode="decimal"
                          value={advancedConditionFactorPercent}
                          onChange={(event) => setAdvancedConditionFactorPercent(event.target.value)}
                          placeholder="e.g. 85"
                          disabled={!canUseAdvancedAssumptions}
                        />
                        <small className={styles.advancedFieldHelp}>100% = full value before condition adjustment.</small>
                      </label>
                    ) : null}
                  </div>

                  {canUseAdvancedAssumptions && advancedError ? <p className={styles.advancedError}>{advancedError}</p> : null}

                    <button
                      type="button"
                      className={styles.assetButton}
                      onClick={updateAdvancedAssumptionsAndRecalculate}
                      disabled={advancedControlsDisabled}
                    >
                      {advancedRecalculateLoading ? 'Recalculating...' : 'Update assumptions and recalculate'}
                    </button>
                  </div>
                </div>
              </div>
            ) : null}
          </section>


          {(isGeneric && genericResult) || tractorResult ? (
            <section className={`${styles.resultAccordion} ${styles.replacementAccordion}`}>
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
                    {tractorResult
                      ? 'Check the asset and selected-extra replacement prices. Aim4price depreciates each one before recalculating. All prices exclude VAT.'
                      : 'Check the replacement price and change it only when the saved figure is no longer accurate.'}
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
                        <strong>{money(getVatDisplayValue(genericResult.aim4priceReplacementCalculation?.valuationMidExVat ?? null, vatDisplayMode))}</strong>
                        <small>Estimate {headlineVatLabel.toLowerCase()}. New price used: {moneyExVat(genericResult.aim4priceReplacementCalculation?.replacementPriceExVat ?? null)}</small>
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
                        <strong>{money(getVatDisplayValue(genericResult.userReplacementCalculation?.valuationMidExVat ?? null, vatDisplayMode))}</strong>
                        <small>Estimate {headlineVatLabel.toLowerCase()}. New price used: {moneyExVat(genericResult.userReplacementCalculation?.replacementPriceExVat ?? null)}</small>
                      </button>
                    </div>
                  ) : null}

                  <div className={styles.replacementInputPanel}>
                    <div className={styles.replacementFieldsGrid}>
                      <label className={`${styles.field} ${styles.replacementField}`}>
                        <span className={styles.fieldLabel}>Asset replacement price</span>
                        <input
                          type="text"
                          inputMode="decimal"
                          value={userReplacementPrice}
                          onChange={(event) => setUserReplacementPrice(event.target.value)}
                          placeholder="e.g. 1 100 000"
                        />
                        <small className={styles.replacementFieldHint}>Current: {moneyExVat(getCurrentResultReplacementPriceExVat())}</small>
                      </label>
                      {tractorResult && frontPto ? (
                        <label className={`${styles.field} ${styles.replacementField}`}>
                          <span className={styles.fieldLabel}>Front PTO replacement</span>
                          <input type="text" inputMode="decimal" value={frontPtoReplacementPrice} onChange={(event) => setFrontPtoReplacementPrice(event.target.value)} />
                          <small className={styles.replacementFieldHint}>Adds {moneyExVat(tractorResult.frontPtoValueExVat)} after depreciation</small>
                        </label>
                      ) : null}
                      {tractorResult && frontLoader ? (
                        <label className={`${styles.field} ${styles.replacementField}`}>
                          <span className={styles.fieldLabel}>Front Loader replacement</span>
                          <input type="text" inputMode="decimal" value={frontLoaderReplacementPrice} onChange={(event) => setFrontLoaderReplacementPrice(event.target.value)} />
                          <small className={styles.replacementFieldHint}>
                            Year added: {normalizeText(frontLoaderYear) || 'same as tractor'}. Adds {moneyExVat(tractorResult.frontLoaderValueExVat)} after depreciation.
                          </small>
                        </label>
                      ) : null}
                      {tractorResult && gpsEnabled ? (
                        <label className={`${styles.field} ${styles.replacementField}`}>
                          <span className={styles.fieldLabel}>GPS replacement</span>
                          <input type="text" inputMode="decimal" value={gpsReplacementPrice} onChange={(event) => setGpsReplacementPrice(event.target.value)} />
                          <small className={styles.replacementFieldHint}>Adds {moneyExVat(tractorResult.gpsValueExVat)} after depreciation</small>
                        </label>
                      ) : null}
                      {tractorResult && otherExtraEnabled ? (
                        <div className={styles.replacementOtherFields}>
                          <label className={`${styles.field} ${styles.replacementField}`}>
                            <span className={styles.fieldLabel}>Extra name</span>
                            <input value={otherExtraName} onChange={(event) => setOtherExtraName(event.target.value)} maxLength={100} />
                          </label>
                          <label className={`${styles.field} ${styles.replacementField}`}>
                            <span className={styles.fieldLabel}>Extra replacement price</span>
                            <input
                              type="text"
                              inputMode="decimal"
                              value={otherExtraReplacementPrice}
                              onChange={(event) => setOtherExtraReplacementPrice(event.target.value)}
                            />
                            <small className={styles.replacementFieldHint}>Adds {moneyExVat(tractorResult.otherExtraValueExVat)} after depreciation</small>
                          </label>
                        </div>
                      ) : null}
                    </div>
                    <div className={styles.replacementInputActions}>
                      {tractorResult?.userReplacementPriceExVat ? (
                        <button
                          type="button"
                          className={styles.replacementResetButton}
                          disabled={replacementRecalculateLoading || advancedRecalculateLoading}
                          onClick={() => {
                            setUserReplacementPrice('');
                            void calculateTractorWithReplacementPrice(null);
                          }}
                        >
                          Use saved asset price
                        </button>
                      ) : null}
                      <button
                        type="button"
                        className={styles.assetButton}
                        disabled={!replacementUpdateReady || replacementRecalculateLoading || advancedRecalculateLoading}
                        onClick={() => {
                          if (isGeneric) {
                            if (!userPriceInput) return;
                            void calculateGenericWithReplacementPrice(userPriceInput);
                          } else {
                            const tractorBasePrice = userPriceInput ?? (replacementPriceBasis === 'user' ? tractorResult?.userReplacementPriceExVat ?? null : null);
                            void calculateTractorWithReplacementPrice(tractorBasePrice);
                          }
                        }}
                      >
                        {replacementRecalculateLoading ? 'Recalculating...' : 'Recalculate estimate'}
                      </button>
                    </div>
                  </div>
                </div>
              ) : null}
            </section>
          ) : null}
        </div>

        <aside className={styles.resultsSide}>
          <section className={styles.resultFinalActions} aria-label="Estimate actions">
            <div className={styles.resultFinalActionsCopy}>
              <span>{conversionAssetId ? 'Conversion mode' : 'Estimate actions'}</span>
              <h3>{conversionAssetId ? 'Save converted asset' : 'Next steps'}</h3>
              <p>
                {conversionAssetId
                  ? 'Save this estimate to update the existing manual asset. Marketplace, PDF and duplicate asset-register saves are hidden in conversion mode.'
                  : ownerAppMode
                    ? 'Save the asset to My Assets, create a Marketplace listing or download the estimate PDF.'
                  : compactAppMode
                    ? 'Download the PDF or create a listing.'
                    : 'Download the estimate PDF, send the asset to Marketplace, or save it to your Asset Register.'}
              </p>
            </div>

            <div className={styles.resultFinalActionsButtons}>
              {conversionAssetId ? (
                isSignedIn ? (
                  <button
                    type="button"
                    className={styles.resultPrimaryActionButton}
                    onClick={() => void saveConversionToAssetRegister()}
                    disabled={saveLoading || replacementRecalculateLoading || advancedRecalculateLoading || !canSaveToAssetRegister || headlineValue === null || !conversionPrefillLoaded}
                  >
                    {saveLoading && finalSaveIntent === 'asset-register' ? 'Saving...' : 'Save'}
                  </button>
                ) : (
                  <div className={styles.resultSignedOutNotice}>
                    <p>Sign in to save this conversion.</p>
                  </div>
                )
              ) : (
                <>
                  {isSignedIn ? (
                    <>
                      {ownerAppMode ? (
                        <button
                          type="button"
                          className={styles.resultPrimaryActionButton}
                          onClick={saveToAssetRegister}
                          disabled={saveLoading || isPublishingMarketplace || replacementRecalculateLoading || advancedRecalculateLoading || !canSaveToAssetRegister || headlineValue === null}
                        >
                          {saveLoading && finalSaveIntent === 'asset-register' ? 'Saving...' : 'Save to My Assets'}
                        </button>
                      ) : null}
                      <button
                        type="button"
                        className={styles.resultAlternateActionButton}
                        onClick={createAdFromEstimate}
                        disabled={saveLoading || isPublishingMarketplace || replacementRecalculateLoading || advancedRecalculateLoading || !canUseMarketplacePublishFlow || headlineValue === null}
                      >
                        {saveLoading && finalSaveIntent === 'marketplace' ? 'Saving...' : isPublishingMarketplace ? 'Creating ad...' : 'Create Ad'}
                      </button>
                      {!compactAppMode ? (
                        <button
                          type="button"
                          className={styles.resultPrimaryActionButton}
                          onClick={saveToAssetRegister}
                          disabled={saveLoading || isPublishingMarketplace || replacementRecalculateLoading || advancedRecalculateLoading || !canSaveToAssetRegister || headlineValue === null}
                        >
                          {saveLoading && finalSaveIntent === 'asset-register' ? 'Saving...' : 'Save to Asset Register'}
                        </button>
                      ) : null}
                    </>
                  ) : (
                    <div className={styles.resultSignedOutNotice}>
                      <p>Sign in to save this estimate or create a Marketplace advert.</p>
                    </div>
                  )}
                  <button
                    type="button"
                    className={styles.resultPdfActionButton}
                    onClick={downloadValuationPdf}
                    disabled={pdfLoading || advancedRecalculateLoading || !resultState || headlineValue === null}
                  >
                    {pdfLoading ? 'Preparing PDF...' : 'Download PDF'}
                  </button>
                </>
              )}
            </div>

            {!conversionAssetId && pdfError ? <p className={styles.resultActionError}>{pdfError}</p> : null}
          </section>
        </aside>

        <SaleabilityModal
          open={saleabilityOpen}
          onClose={() => setSaleabilityOpen(false)}
          assetTitle={machineTitle}
          valuationExVat={headlineValue ?? 0}
          input={getSaleabilityInputFromResult(
            resultState,
            resultCondition,
            isGeneric ? genericResult?.usageAmount ?? usageNumber : usageNumber,
            isGeneric ? genericResult?.lifeWorkedPercent ?? lifeWorkedPercentNumber : lifeWorkedPercentNumber,
          )}
          storageKey={`aim4price-saleability:estimate:${machineTitle.toLowerCase()}:${resultYear}`}
        />
      </div>
    );
  }

  function renderStepBody() {
    if (step === 1) return renderMachineStep();
    if (isMotorSector(selectedSector)) {
      if (step === 2) return renderMotorSearchStep();
      if (step === 3 || step === 4) return renderDetailsStep();
      return renderResultStep();
    }
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
  const finalSaveTitle = finalSaveIntent === 'marketplace'
    ? 'Create advert'
    : ownerAppMode ? 'Save to My Assets' : 'Save to Asset Register';
  const finalSaveCta = finalSaveIntent === 'marketplace' ? 'Save and continue to advert details' : 'Confirm and save';
  const isSectorIntroStep = step === 1 && !selectedSector;
  const compactPathChoicePage = compactAppMode && step === 3 && !flowMode;

  return (
    <main className={`${styles.page} ${compactAppMode ? `${styles.appValuation} ${dealerStyles.dealerValuationSurface}` : ''}`}>
      {!compactAppMode ? <AppHeader active="valuation" /> : null}
      {completionToastVisible ? (
        <div className={styles.completionToast} role="status" aria-live="polite">
          Required questions completed. You can now get the estimate.
        </div>
      ) : null}
      <div className={styles.container}>
        <section className={`${styles.wizardShell} ${isSectorIntroStep ? styles.sectorWizardShell : ''}`}>
          <div id="valuation-wizard-card" className={`${styles.wizardCard} ${isSectorIntroStep ? styles.sectorWizardCard : ''}`}>
            {step > 1 || (compactAppMode && selectedSector) ? (
              <div className={styles.wizardHeader}>
                {compactAppMode ? (
                  <div className={styles.mobileStepSummary} aria-live="polite">
                    <span>Estimate {step} of {WIZARD_STEPS.length}</span>
                  </div>
                ) : null}
                <div className={styles.stepper}>
                  {WIZARD_STEPS.map((item) => {
                    const active = item.step === step;
                    const complete = item.step < step;
                    const canJumpBack = complete && item.step <= 4;
                    const stepLabel = getWizardStepLabel(item.step, selectedSector);
                    return (
                      <button
                        key={item.step}
                        type="button"
                        className={`${styles.stepperItem} ${canJumpBack ? styles.stepperItemClickable : ''} ${active ? styles.stepperItemActive : ''} ${complete ? styles.stepperItemComplete : ''}`}
                        onClick={() => handleWizardStepJump(item.step)}
                        disabled={!canJumpBack}
                        aria-current={active ? 'step' : undefined}
                        aria-label={canJumpBack ? `Go back to ${stepLabel}` : stepLabel}
                      >
                        <span className={`${styles.stepperBullet} ${active ? styles.stepperBulletActive : ''} ${complete ? styles.stepperBulletComplete : ''}`}>
                          {compactAppMode ? item.step : complete ? '✓' : item.step}
                        </span>
                        {!compactAppMode ? (
                          <span className={`${styles.stepperLabel} ${active ? styles.stepperLabelActive : ''} ${complete ? styles.stepperLabelComplete : ''}`}>{stepLabel}</span>
                        ) : null}
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : null}

            <div className={`${styles.stepContent} ${isSectorIntroStep ? styles.sectorStepContent : ''}`}>
              {renderStepBody()}
              {message ? <div className={styles.message}>{message}</div> : null}
            </div>

            <div
              className={`${styles.wizardFooter} ${step === 1 || compactPathChoicePage ? styles.wizardFooterSingle : ''}`}
              data-has-disclaimer={step === 4}
            >
              <button
                type="button"
                className={styles.secondaryButton}
                data-valuation-action="back"
                onClick={handleBack}
                disabled={valuationLoading || saveLoading}
              >
                Back
              </button>
              {step === 4 ? (
                <p className={styles.preEstimateDisclaimer} data-valuation-disclaimer="true">
                  {compactAppMode
                    ? 'Indicative estimate only. Confirm condition, documents, location and market demand.'
                    : 'Aim4price provides an indicative estimate only. It is not a certified valuation or inspection report. Final value should still be checked against asset condition, documents, location and current market demand.'}
                </p>
              ) : null}
              {step === 1 || compactPathChoicePage ? null : step === 5 ? (
                <button
                  type="button"
                  className={styles.secondaryButton}
                  data-valuation-action="next"
                  onClick={resetToSectorSelection}
                  disabled={saveLoading || isPublishingMarketplace || replacementRecalculateLoading || advancedRecalculateLoading}
                >
                  New estimate
                </button>
              ) : (
                <button
                  type="button"
                  className={styles.primaryButton}
                  data-valuation-action="next"
                  onClick={handleNext}
                  disabled={valuationLoading || (step === 2 && (isMotorSector(selectedSector) ? motorCanonicalLoading : brandsLoading || !selectedBrand))}
                >
                  {valuationLoading ? 'Calculating...' : step === 4 ? 'Get Estimate' : 'Continue'}
                </button>
              )}
            </div>
          </div>
        </section>
      </div>

      {replacementNoticeOpen ? (
        <div className={styles.replacementNoticeOverlay} onClick={closeReplacementPriceNotice}>
          <section
            ref={replacementNoticeDialogRef}
            className={styles.replacementNoticeModal}
            role="dialog"
            aria-modal="true"
            aria-labelledby="replacement-notice-title"
            aria-describedby="replacement-notice-description replacement-notice-disclaimer"
            onClick={(event) => event.stopPropagation()}
          >
            <div className={styles.replacementNoticeTitle}>
              <span aria-hidden="true">!</span>
              <h2 id="replacement-notice-title">Ready for your estimate?</h2>
            </div>
            <p id="replacement-notice-description" className={styles.replacementNoticeIntro}>
              We will calculate an indicative estimate using the details you provided. You can review the result on the next screen and go back to change your details if needed.
            </p>
            <div className={styles.replacementNoticeActions}>
              <button
                ref={replacementNoticeGoBackRef}
                type="button"
                className={styles.secondaryButton}
                onClick={closeReplacementPriceNotice}
              >
                Go back
              </button>
              <button
                type="button"
                className={styles.primaryButton}
                onClick={() => {
                  closeReplacementPriceNotice();
                  void calculateValuation();
                }}
              >
                I understand, get estimate
              </button>
            </div>
            <small id="replacement-notice-disclaimer" className={styles.replacementNoticeDisclaimer}>
              Aim4price provides an indicative estimate only. It is not a certified valuation, inspection, or guaranteed price.
            </small>
          </section>
        </div>
      ) : null}

      {finalSaveIntent && !conversionAssetId ? (
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
              disabled={saveLoading || replacementRecalculateLoading || advancedRecalculateLoading}
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
                disabled={!finalSaveInputPrice || replacementRecalculateLoading || advancedRecalculateLoading || saveLoading}
              >
                {replacementRecalculateLoading ? 'Recalculating...' : 'Update and recalculate'}
              </button>
            </div>

            {finalSaveHasPendingReplacementPrice ? (
              <p className={styles.finalSaveWarning}>
                You changed a replacement price or extra value. Click Update and recalculate before saving or listing this asset.
              </p>
            ) : null}

            {finalSaveError ? <p className={styles.finalSaveError}>{finalSaveError}</p> : null}

            <div className={styles.finalSaveActions}>
              <button
                type="button"
                className={styles.secondaryButton}
                onClick={closeFinalSaveModal}
                disabled={saveLoading || replacementRecalculateLoading || advancedRecalculateLoading}
              >
                Close
              </button>
              <button
                type="button"
                className={styles.primaryButton}
                onClick={confirmFinalSaveAction}
                disabled={saveLoading || replacementRecalculateLoading || advancedRecalculateLoading || !finalSaveCanConfirm}
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
              Create Ad on the result screen to confirm the asking price, photos, Brand Kit and seller details.
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
              <span>Create advert</span>
              <h2>Confirm and download your advert.</h2>
              <p>Aim4price publishes the listing in the background, downloads the JPEG and keeps you on this valuation.</p>
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
                {isDealerAccount ? (
                  <label className={styles.marketplaceField}>
                    <span>Brand Kit</span>
                    <select name="brandKitId" value={marketplaceDraft.brandKitId} onChange={handleMarketplaceBrandKitChange}>
                      {!adBrandKits.length ? <option value="">Aim4price standard</option> : null}
                      {adBrandKits.map((kit) => (
                        <option key={kit.id} value={kit.id}>{kit.name}{kit.isDefault ? ' — default' : ''}</option>
                      ))}
                    </select>
                    <small>
                      {adBrandKits.length
                        ? 'Your saved logo, colours, wording and contact details will be applied.'
                        : 'No Brand Kit yet. The Aim4price standard layout will be used.'}
                      {' '}<a href={dealerAppMode ? '/dealer/ad-studio' : '/ad-studio'}>Open Ad Studio</a>
                    </small>
                  </label>
                ) : (
                  <div className={styles.marketplaceField}>
                    <span>Advert style</span>
                    <strong>Aim4price standard</strong>
                    <small>Owner listings use the standard Aim4price Marketplace advert design.</small>
                  </div>
                )}
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

                <label className={styles.marketplaceRatingChoice}>
                  <input
                    type="checkbox"
                    checked={marketplaceDraft.showDealRating}
                    onChange={handleMarketplaceRatingVisibilityChange}
                  />
                  <span>
                    <strong>Show the Aim4price price rating</strong>
                    <small>Turn this off to hide the rating on the JPEG, Marketplace and your showroom.</small>
                  </span>
                </label>

                <div className={styles.marketplacePhotoPanel}>
                  <div>
                    <span>Photos</span>
                    <p>The first photo is the main image. Use the arrows to change the order. If there are fewer photos than the saved style needs, Aim4price selects the best-fitting layout automatically.</p>
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
                      {marketplacePhotoFiles.map((photo, index) => (
                        <div key={photo.id} className={styles.marketplacePhotoThumb}>
                          <img src={photo.previewUrl} alt="Marketplace upload preview" />
                          {index === 0 ? <strong className={styles.marketplacePhotoCoverBadge}>Main photo</strong> : null}
                          <div className={styles.marketplacePhotoControls}>
                            <button type="button" onClick={() => moveMarketplacePhoto(photo.id, -1)} disabled={index === 0} aria-label="Move photo earlier">←</button>
                            <button type="button" onClick={() => moveMarketplacePhoto(photo.id, 1)} disabled={index === marketplacePhotoFiles.length - 1} aria-label="Move photo later">→</button>
                            <button type="button" onClick={() => removeMarketplacePhoto(photo.id)} aria-label="Remove photo">×</button>
                          </div>
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
                {isPublishingMarketplace ? 'Creating advert...' : isSignedIn ? 'Create advert' : 'Create account to publish'}
              </button>
            </div>
          </form>
        </div>
      ) : null}

      {publishedAdvertDownload ? (
        <div className={styles.marketplaceIntroOverlay} onClick={() => setPublishedAdvertDownload(null)}>
          <section
            className={`${styles.marketplaceIntroModal} ${styles.marketplaceAdvertSuccessModal}`}
            role="dialog"
            aria-modal="true"
            aria-labelledby="advert-download-title"
            onClick={(event) => event.stopPropagation()}
          >
            <span className={styles.marketplaceIntroKicker}>Advert created</span>
            <h2 id="advert-download-title">
              {publishedAdvertDownload.status === 'downloaded' ? 'Your JPEG is ready.' : 'Your listing is live.'}
            </h2>
            <p>{publishedAdvertDownload.message}</p>
            <div className={styles.marketplaceAdvertSuccessChecklist}>
              <span>✓ Published to Marketplace</span>
              <span>{publishedAdvertDownload.status === 'downloaded' ? '✓ JPEG downloaded' : '! JPEG download needs another try'}</span>
            </div>
            <div className={styles.marketplaceIntroActions}>
              <button type="button" className={styles.secondaryButton} onClick={() => setPublishedAdvertDownload(null)}>
                Stay here
              </button>
              <a
                className={styles.secondaryButton}
                href={`${marketplacePath}?listing=${encodeURIComponent(publishedAdvertDownload.listingReference)}`}
              >
                View Marketplace
              </a>
              <button
                type="button"
                className={styles.primaryButton}
                onClick={() => void retryPublishedAdvertDownload()}
                disabled={isDownloadingPublishedAdvert}
              >
                {isDownloadingPublishedAdvert ? 'Creating JPEG...' : 'Download again'}
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </main>
  );
}
