YªçŠx-®éÜj×¢ëiºÚ+Š§j[h‘éÜ¢éíÛÝùçvç®8o+^²‰¢¶×'use client';

import Link from 'next/link';
import { createPortal } from 'react-dom';
import { useEffect, useMemo, useRef, useState, type CSSProperties, type ChangeEvent, type DragEvent as ReactDragEvent, type FormEvent, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import AppHeader from '../../components/AppHeader';
import AssetGroupManagerModal, {
  type AssetGroupReportFilters,
  type AssetGroupReportFormat,
  type AssetGroupReportKind,
} from '../../components/asset-register/AssetGroupManagerModal';
import AccountantAssetManageModal from '../../components/AccountantAssetManageModal';
import AccountantRegisterReportsModal from '../../components/AccountantRegisterReportsModal';
import DealerAssetShareSelection from '../../components/DealerAssetShareSelection';
import DealerMaintenanceAccessSettings, {
  DEFAULT_DEALER_MAINTENANCE_PERMISSIONS,
  DealerMaintenancePermissionPicker,
} from '../../components/DealerMaintenanceAccessSettings';
import {
  openAssetRegisterSummaryPrint,
  openAssetSheetPrint,
  type ReportKeyValue,
  type ReportMethodCard,
} from '../../lib/report-print';
import {
  GENERAL_ASSET_CATEGORIES,
  PROPERTY_ASSET_SUBTYPES,
  STOCK_ASSET_SUBTYPES,
  generalAssetCategoryLabel,
  normalizeGeneralAssetCategory,
  normalizePropertyAssetSubtype,
  normalizeStockAssetSubtype,
  propertyAssetSubtypeLabel,
  stockAssetSubtypeLabel,
  type GeneralAssetCategoryKey,
  type PropertyAssetSubtypeKey,
  type StockAssetSubtypeKey,
} from '../../lib/general-asset-catalogue';
import type { DealerAssetCorrectionRequest } from '../../lib/dealer-asset-corrections';
import type {
  DealerMaintenanceAccessSummary,
  DealerMaintenancePermissions,
} from '../../lib/dealer-maintenance-tracker';
import {
  assetCountsTowardRegisterTotal,
  assetGroupRelationshipLabel,
  assetGroupValueModeLabel,
  assetGroupPageEntryDisplayCount,
  buildAssetGroupPageEntries,
  buildAssetGroupMembershipMap,
  getAssetGroupPrimaryAssetId,
  groupRegisterValue,
  orderAssetsByGroups,
  paginateAssetGroupPageEntries,
  projectAssetGroupsToAssets,
  registerValueForAssets,
  type AssetGroup,
  type AssetGroupSaveInput,
} from '../../lib/asset-groups-shared';
import styles from './page.module.css';
import updateStyles from './asset-update-refinements.module.css';
import { conditionOptions } from '../../lib/tractor-data';
import { CONDITION_FACTORS } from '../../lib/valuation/shared';
import {
  assetDocumentCategoryLabel,
  normalizeAssetDocumentCategory,
  normalizeAssetDocumentType,
  type AssetDocumentCategory,
} from '../../lib/asset-document-permissions';

type NoticeTone = 'success' | 'warning' | 'error';
type PartnerType = 'dealer' | 'finance' | 'insurance' | 'licensing';
type AssetLeadType = 'finance' | 'insurance' | 'replacement_quote' | 'license_renewal';
type QuoteLeadStep = 'message' | 'consent' | null;
type QuoteScope = 'asset' | 'register';
type DisposalReason = 'sold' | 'traded_in' | 'scrapped' | 'written_off' | 'mistake_duplicate' | 'other';
type AssetMoveDestination = 'register' | 'umbrella';

const ASSET_GROUP_DRAG_DATA_TYPE = 'application/x-aim4price-asset-id';
const ASSET_GROUP_AUTO_SCROLL_EDGE_PX = 140;
const ASSET_GROUP_AUTO_SCROLL_MIN_PX = 8;
const ASSET_GROUP_AUTO_SCROLL_MAX_PX = 64;

function assetGroupAutoScrollDelta(pointerY: number, viewportHeight: number): number {
  if (pointerY < ASSET_GROUP_AUTO_SCROLL_EDGE_PX) {
    const intensity = (ASSET_GROUP_AUTO_SCROLL_EDGE_PX - Math.max(0, pointerY)) / ASSET_GROUP_AUTO_SCROLL_EDGE_PX;
    return -Math.max(ASSET_GROUP_AUTO_SCROLL_MIN_PX, Math.ceil(ASSET_GROUP_AUTO_SCROLL_MAX_PX * intensity));
  }

  if (pointerY > viewportHeight - ASSET_GROUP_AUTO_SCROLL_EDGE_PX) {
    const distanceFromEdge = Math.max(0, viewportHeight - pointerY);
    const intensity = (ASSET_GROUP_AUTO_SCROLL_EDGE_PX - distanceFromEdge) / ASSET_GROUP_AUTO_SCROLL_EDGE_PX;
    return Math.max(ASSET_GROUP_AUTO_SCROLL_MIN_PX, Math.ceil(ASSET_GROUP_AUTO_SCROLL_MAX_PX * intensity));
  }

  return 0;
}

function assetGroupWheelScrollDelta(deltaY: number, deltaMode: number, viewportHeight: number): number {
  if (!Number.isFinite(deltaY) || deltaY === 0) return 0;
  if (deltaMode === 1) return deltaY * 24;
  if (deltaMode === 2) return deltaY * Math.max(1, viewportHeight);
  return deltaY;
}

type AcquisitionDraft = {
  newlyAcquired: boolean | null;
  acquisitionDate: string;
  acquisitionAmountExVat: string;
  note: string;
  sourceDocumentReference: string;
};

type DisposalDraft = {
  reason: DisposalReason | '';
  disposalDate: string;
  disposalAmountExVat: string;
  note: string;
};

function lifecycleToday(): string {
  return new Date().toISOString().slice(0, 10);
}

function createAcquisitionDraft(): AcquisitionDraft {
  return { newlyAcquired: null, acquisitionDate: lifecycleToday(), acquisitionAmountExVat: '', note: '', sourceDocumentReference: '' };
}

function createDisposalDraft(): DisposalDraft {
  return { reason: '', disposalDate: lifecycleToday(), disposalAmountExVat: '', note: '' };
}

type PartnerDirectoryEntry = {
  userId: string;
  partnerType: PartnerType;
  accountSubtype: string;
  displayName: string;
  businessName: string;
  phone: string;
  email: string;
  province: string;
  townCity: string;
  addressLine1: string;
  logoUrl: string;
  websiteUrl: string;
  extraPhotoUrls: string[];
  description: string;
  latitude: number | null;
  longitude: number | null;
  serviceRadiusKm: number | null;
  brandFocus: string;
  services: string;
};

type PartnerDirectoryApiResponse = {
  ok: boolean;
  partners?: PartnerDirectoryEntry[];
  error?: string;
};

type AssetLeadApiResponse = {
  ok: boolean;
  lead?: unknown;
  error?: string;
};

type AccountantNoteApiResponse = {
  ok: boolean;
  note?: OpenPartnerNote;
  error?: string;
};

type AssetQuoteOption = {
  leadType: AssetLeadType;
  partnerType: PartnerType;
  title: string;
  shortTitle: string;
  description: string;
  mapTitle: string;
  sendLabel: string;
  emptyPartnerText: string;
};

declare global {
  interface Window {
    L?: any;
  }
}

const REGISTER_SUMMARY_VISIBLE_CARD_COUNT = 3;
const REGISTER_SUMMARY_TOTAL_CARD_COUNT = 8;
const ASSET_REGISTER_SUMMARY_VAT_MULTIPLIER = 1.15;
const COMBINED_REGISTER_ID = '__combined_asset_registers__';

function getRegisterSummaryCardsPerView(): number {
  if (typeof window === 'undefined') return REGISTER_SUMMARY_VISIBLE_CARD_COUNT;
  if (window.innerWidth <= 760) return 1;
  if (window.innerWidth <= 1180) return 2;
  return REGISTER_SUMMARY_VISIBLE_CARD_COUNT;
}

type AssetKind = 'tractor' | 'equipment' | 'manual' | 'property' | 'vehicle' | 'tools' | 'stock';
type AssetMethod = 'aim4price' | 'manual';
type RevalueMethod = 'aim4price';
type RevalueReplacementMode = 'saved' | 'custom';
type RevalueAdvancedAssumptionsRequest = {
  maxLifetimeUsage?: number | null;
};
type ConditionKey = 'excellent' | 'good' | 'fair' | 'used' | 'serious';
type AssetConditionValue = ConditionKey | '';

const PROJECTION_INFLATION_PRESETS = ['3', '5', '8', '10'] as const;

function projectionConditionRetainedPercent(condition: ConditionKey): number {
  return Math.round((CONDITION_FACTORS[condition] ?? CONDITION_FACTORS.good) * 100);
}

const PROJECTION_CONDITION_OPTIONS = conditionOptions.map((option) => ({
  key: option.key,
  label: option.label,
}));
type UsageMetric = 'hours' | 'km';
type AssetDraftUsageMetric = UsageMetric | 'percentage' | 'not_applicable';
type ProjectionUsageMetric = UsageMetric | 'percent';
type AssetStatusChoice = 'yes' | 'no' | 'unknown' | 'not_applicable';
type FinanceStatusChoice = AssetStatusChoice | 'paid';
type InsuranceUseContext = 'business' | 'home' | 'mixed';
type InsuranceMobility = 'premises' | 'portable' | 'moves_between_locations' | 'fixed';
type InsuranceFactAnswer = 'yes' | 'no' | 'unknown';
type PropertyInterest = 'owned_occupied' | 'owned_let' | 'leased_occupied' | 'tenant_improvement' | 'unknown';
type StockValuationBasis = 'purchase_cost' | 'replacement_cost' | 'selling_price' | 'market_value' | 'other' | 'unknown';
type StockMovement = 'one_location' | 'multiple_locations' | 'regular_transit' | 'seasonal_locations' | 'unknown';
type AssetStatusSection = 'finance' | 'insurance' | 'license';
type AssetStatusEditView = 'hub' | AssetStatusSection;
type AssetStatusQuickOrigin = 'detail-card' | null;
type ManualAssetStep = 1 | 2 | 3 | 4;
type ExportFormat = 'pdf' | 'xlsx';
type ExportStep = 'format' | 'pdf-report' | 'pdf-assets';
type PdfReportKind =
  | 'full'
  | 'financed'
  | 'insured'
  | 'licensed'
  | 'mapped'
  | 'not-financed'
  | 'not-insured'
  | 'not-licensed'
  | 'not-mapped';
type AssetPdfReportKind = 'fuel' | 'maintenance' | 'depreciation';
type AssetReportFormat = 'pdf' | 'xlsx';
type AssetReportSelectKey = 'type' | 'year' | 'month';
type AssetReportStep =
  | 'options'
  | 'fuel-format'
  | 'fuel-filter'
  | 'maintenance-format'
  | 'maintenance-filter'
  | 'depreciation-format'
  | 'depreciation-filter'
  | 'ownership-format'
  | 'ownership-filter';
type PhotoViewerState = { assetId: string; index: number };

type AssetPdfReportFilters = {
  year?: string;
  month?: string;
  maintenanceType?: string;
};

type ReportSelectOption = {
  value: string;
  label: string;
};

type ReportSelectProps = {
  label: string;
  value: string;
  options: ReportSelectOption[];
  isOpen: boolean;
  disabled?: boolean;
  onToggle: () => void;
  onChange: (value: string) => void;
};

type AssetReportFormatPickerProps = {
  value: AssetReportFormat;
  onChange: (value: AssetReportFormat) => void;
};

type PdfReportOption = {
  value: PdfReportKind;
  label: string;
  description: string;
  intro: string;
  sectionTitle: string;
  emptyLabel: string;
};

type PdfReportDetails = Omit<PdfReportOption, 'value'>;

const MONTH_LABELS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const;

const PDF_REPORT_OPTIONS: PdfReportOption[] = [
  {
    value: 'full',
    label: 'Full Asset Register',
    description: 'All saved register assets with full register totals.',
    intro: 'Complete saved asset register snapshot.',
    sectionTitle: 'Asset Register',
    emptyLabel: 'No saved assets are currently available for this report.',
  },
  {
    value: 'insured',
    label: 'Insured',
    description: 'Only assets marked as insured.',
    intro: 'Filtered asset register snapshot showing only insured assets.',
    sectionTitle: 'Insured Assets',
    emptyLabel: 'No insured assets are currently saved in this register.',
  },
  {
    value: 'not-insured',
    label: 'Not Insured',
    description: 'Only assets not marked as insured.',
    intro: 'Filtered asset register snapshot showing only assets not marked as insured.',
    sectionTitle: 'Not Insured Assets',
    emptyLabel: 'No assets without insurance are currently saved in this register.',
  },
  {
    value: 'financed',
    label: 'Financed',
    description: 'Only assets marked as financed.',
    intro: 'Filtered asset register snapshot showing only financed assets.',
    sectionTitle: 'Financed Assets',
    emptyLabel: 'No financed assets are currently saved in this register.',
  },
  {
    value: 'not-financed',
    label: 'Not Financed',
    description: 'Only assets not marked as financed.',
    intro: 'Filtered asset register snapshot showing only assets not marked as financed.',
    sectionTitle: 'Not Financed Assets',
    emptyLabel: 'No assets without finance are currently saved in this register.',
  },
  {
    value: 'licensed',
    label: 'Licensed',
    description: 'Only assets marked as licensed.',
    intro: 'Filtered asset register snapshot showing only licensed assets.',
    sectionTitle: 'Licensed Assets',
    emptyLabel: 'No licensed assets are currently saved in this register.',
  },
  {
    value: 'not-licensed',
    label: 'Not Licensed',
    description: 'Only assets not marked as licensed.',
    intro: 'Filtered asset register snapshot showing only assets not marked as licensed.',
    sectionTitle: 'Not Licensed Assets',
    emptyLabel: 'No assets without licensing are currently saved in this register.',
  },
  {
    value: 'mapped',
    label: 'Mapped',
    description: 'Only assets with saved map coordinates.',
    intro: 'Filtered asset register snapshot showing only assets with saved map locations.',
    sectionTitle: 'Mapped Assets',
    emptyLabel: 'No mapped assets are currently saved in this register.',
  },
  {
    value: 'not-mapped',
    label: 'Not Mapped',
    description: 'Only assets without saved map coordinates.',
    intro: 'Filtered asset register snapshot showing only assets without saved map locations.',
    sectionTitle: 'Not Mapped Assets',
    emptyLabel: 'All saved assets currently have map coordinates.',
  },
];

const SELECTED_ASSETS_PDF_REPORT: PdfReportDetails = {
  label: 'Selected Assets',
  description: 'Only the assets selected in the download list.',
  intro: 'Custom asset register snapshot showing only the selected assets.',
  sectionTitle: 'Selected Assets',
  emptyLabel: 'No assets were selected for this report.',
};
type AssetFilterKey =
  | 'all'
  | 'property'
  | 'no-property'
  | 'insured'
  | 'not-insured'
  | 'financed'
  | 'not-financed'
  | 'licensed'
  | 'not-licensed'
  | 'license-not-applicable'
  | 'mapped'
  | 'not-mapped'
  | 'highest-value'
  | 'lowest-value'
  | 'highest-replacement-price'
  | 'lowest-replacement-price'
  | 'aim4price-value'
  | 'manual-value'
  | 'marketplace';

type AssetFilterOption = {
  value: AssetFilterKey;
  label: string;
};

type AssetDocument = {
  id: string;
  url: string;
  fileName: string;
  contentType: string;
  byteSize: number;
  uploadedAtIso: string;
  category: AssetDocumentCategory;
  documentType: string;
};

type OpenPartnerNoteAttachment = {
  fileName: string;
  contentType: string;
  byteSize: number;
  url: string;
};

type LatestMaintenanceStatus = {
  id: string;
  assetRegisterItemId: string;
  kind: 'checked' | 'serviced' | 'repaired';
  summary: string;
  note: string;
  operatorName: string;
  photoUrls?: string[];
  photoCount?: number;
  createdAtIso: string;
  notedAtIso: string | null;
};

type LatestIssueNoteStatus = {
  id: string;
  assetRegisterItemId: string;
  summary: string;
  note: string;
  operatorName: string;
  actorType: string;
  createdAtIso: string;
  notedAtIso: string | null;
};

type MaintenanceUpcomingAlert = {
  id: string;
  assetRegisterItemId: string;
  maintenanceType: 'service' | 'checkup';
  triggerType: 'date' | 'usage';
  computedStatus: 'upcoming' | 'due_soon' | 'due' | 'overdue' | 'done' | 'cancelled';
  computedStatusLabel: string;
  heading: string;
  body: string;
  dueDate: string | null;
  dueUsage: number | null;
  currentUsage: number | null;
  usageMetric: 'hours' | 'km' | 'percentage' | null;
  alertBeforeValue: number | null;
  alertBeforeUnit: string | null;
  updatedAtIso: string;
  createdAtIso: string;
};

type LicenseRenewalAlert = {
  id: string;
  assetRegisterItemId: string;
  renewalDate: string;
  registrationNumber: string;
  computedStatus: 'due_soon' | 'due' | 'overdue';
  computedStatusLabel: 'Due soon' | 'Due' | 'Overdue';
  heading: string;
  body: string;
};

type OpenPartnerNote = {
  id: string;
  ownerUserId: string;
  partnerUserId: string;
  assetRegisterItemId: string;
  noteText: string;
  status: 'open' | 'noted';
  partnerType?: PartnerType | null;
  partnerName: string;
  partnerBusinessName: string;
  attachment?: OpenPartnerNoteAttachment | null;
  createdAtIso: string;
  notedAtIso: string | null;
  updatedAtIso: string;
};

type RegisterAsset = {
  id: string;
  userId: string;
  registerId: string | null;
  registerName?: string;
  valuationRunId: number | null;
  sectorId: number | null;
  equipmentFamilyId: number | null;
  equipmentFamilyKey: string;
  equipmentFamilyLabel: string;
  equipmentModelId: number | null;
  typedModelName: string;
  normalizedTypedModelName: string;
  specsJson: Record<string, unknown>;
  depreciationMethodUsed: string;
  lifeWorkedPercent: number | null;
  lifeRemainingPercent: number | null;
  estimatedHours: number | null;
  maxLifetimeHours: number | null;
  kind: AssetKind;
  title: string;
  value: number;
  selectedMethod: AssetMethod;
  selectedValueExVat: number;
  replacementPriceExVat: number | null;
  brandName: string;
  modelName: string;
  drive: string;
  tractorType: string;
  cab: string;
  powerKw: number | null;
  yearModel: number | null;
  hours: number | null;
  condition: AssetConditionValue;
  aim4priceValueExVat: number | null;
  marketMidExVat: number | null;
  note: string;
  serialNumber: string;
  isFinanced: boolean;
  isInsured: boolean;
  insuredValueExVat: number | null;
  isLicensed: boolean;
  licenseRegistrationNumber: string;
  financeNote: string;
  sellerPhone: string;
  marketplaceNotes: string;
  marketplaceStatus: string;
  marketplacePriceExVat: number | null;
  marketplaceSellerName: string;
  marketplaceSellerCompany: string;
  marketplaceSellerEmail: string;
  marketplaceProvince: string;
  marketplaceArea: string;
  photos: string[];
  documents: AssetDocument[];
  publicAssetCode: string;
  plateLabel: string;
  qrStatus: string;
  lastScannedAtIso: string | null;
  lastKnownLat: number | null;
  lastKnownLng: number | null;
  lastKnownLocationText: string;
  fuelPercent: number | null;
  createdAtIso: string;
  updatedAtIso: string;
  openPartnerNote?: OpenPartnerNote | null;
  partnerNotes?: OpenPartnerNote[];
  latestMaintenanceStatus?: LatestMaintenanceStatus | null;
  latestIssueNoteStatus?: LatestIssueNoteStatus | null;
  maintenanceAlert?: MaintenanceUpcomingAlert | null;
  licenseRenewalAlert?: LicenseRenewalAlert | null;
  dealerAssetCorrection?: DealerAssetCorrectionRequest | null;
  accountingValue?: {
    carryingValue: number;
    asAtDate: string;
    sourceReference: string;
  } | null;
};

type ReplacementPriceRevaluePrompt = {
  asset: RegisterAsset;
  oldReplacementPriceExVat: number | null;
  newReplacementPriceExVat: number;
};

type RegisterSummaryCountValue = {
  count: number;
  valueExVat: number;
};

type RegisterSummaryAssetTypeKey = 'property' | 'equipment' | 'tools' | 'stock' | 'vehicles';

type RegisterBasicSummary = {
  totalAssets: number;
  currentValueExVat: number;
  replacementValueExVat: number;
  replacementPricedAssets: number;
  insuredValueExVat: number;
  insuredAssetsValueExVat: number;
  financedValueExVat: number;
  licensedValueExVat: number;
  assetsInsured: number;
  assetsLicensed: number;
  assetsFinanced: number;
  aim4priceAssets: RegisterSummaryCountValue;
  manualAssets: RegisterSummaryCountValue;
  assetTypes: Record<RegisterSummaryAssetTypeKey, RegisterSummaryCountValue>;
  assetsMapped: number;
  assetsWithPhotos: number;
  assetsWithDocuments: number;
};

type RegisterSummaryDisplayRow = {
  label: string;
  count?: string;
  valueExVat?: string;
  valueInclVat?: string;
};

type RegisterSummaryDisplaySection = {
  title: string;
  description: string;
  rows: RegisterSummaryDisplayRow[];
  hasValueColumn?: boolean;
};

type AssetRegisterSummary = {
  id: string;
  userId: string;
  businessName: string;
  email: string;
  phone: string;
  addressLine1: string;
  logoUrls?: string[];
  showLogosOnRegister?: boolean;
  isPrimary: boolean;
  isSelected: boolean;
  assetCount: number;
  totalValue: number;
  totalReplacementPrice: number;
  unnotedAlertCount?: number;
  createdAtIso: string;
  updatedAtIso: string;
};

type AssetRegisterApiResponse = {
  ok: boolean;
  items?: RegisterAsset[];
  assets?: RegisterAsset[];
  register?: AssetRegisterSummary;
  registers?: AssetRegisterSummary[];
  groups?: AssetGroup[];
  profile?: AccountProfile;
  summary?: {
    count: number;
    totalValue: number;
  };
  item?: RegisterAsset;
  note?: OpenPartnerNote;
  access?: AccountantRegisterAccess;
  error?: string;
};

type AssetGroupApiResponse = {
  ok: boolean;
  group?: AssetGroup;
  groups?: AssetGroup[];
  error?: string;
};

type AssetRegisterDisplayRow =
  | { kind: 'group'; group: AssetGroup }
  | {
      kind: 'asset';
      asset: RegisterAsset;
      group: AssetGroup | null;
      memberIndex: number;
      memberCount: number;
    };

type AccountantRegisterAccess = {
  shareId: string;
  ownerName: string;
  ownerBusinessName: string;
  registerId: string;
  registerName: string;
  assetCount: number;
  totalValue: number;
  lastUpdatedIso: string;
  allowDirectUpdates: boolean;
  includeFuelLedger: boolean;
  includeCostLedger: boolean;
};

type AccountantRegistersApiResponse = {
  ok: boolean;
  registers?: AccountantRegisterAccess[];
  error?: string;
};

type UploadedAssetFile = {
  uploadId: string;
  url: string;
  fileName: string;
  contentType: string;
  byteSize: number;
};

type AssetUploadApiResponse = {
  ok: boolean;
  uploads?: UploadedAssetFile[];
  error?: string;
};

type DetailMediaUploadType = 'photo' | 'document';

type DetailMediaUploadState = {
  assetId: string;
  type: DetailMediaUploadType;
} | null;

type MarketplaceApiResponse = {
  ok: boolean;
  assetId?: string;
  marketplaceStatus?: string;
  listing?: {
    id?: string | number | null;
    sourceAssetId?: string | number | null;
  } | null;
  note?: OpenPartnerNote | null;
  error?: string;
};

type AccountProfile = {
  userId: string;
  name: string;
  displayName?: string;
  email: string;
  logoUrl?: string;
  businessName: string;
  phone: string;
  accountType: string;
  vatNumber: string;
  province: string;
  townCity: string;
  addressLine1: string;
  addressLine2: string;
  notes: string;
  marketplaceSellerName?: string;
  marketplacePhone?: string;
  marketplaceEmail?: string;
  marketplaceLocation?: string;
  partnerLatitude?: number | null;
  partnerLongitude?: number | null;
  createdAtIso: string | null;
  updatedAtIso: string | null;
};

type AccountProfileApiResponse = {
  ok: boolean;
  profile?: AccountProfile;
  error?: string;
};

type ProjectionSnapshot = {
  retailExVat: number;
  hours: number;
  tractorExVat: number;
  loaderExVat: number;
  gpsExVat: number;
  lifeWorkedPercent?: number | null;
};

type AssetFutureProjection = {
  assetId: string;
  assetTitle: string;
  selectedMethod: AssetMethod;
  currentRegisterValueExVat: number;
  baseYear: number;
  targetYear: number;
  inflationRatePct: number;
  yearsForward: number;
  extraHours: number;
  extraUsage?: number;
  targetLifeWorkedPercent?: number | null;
  usageMetric?: ProjectionUsageMetric;
  usageUnitLabel?: string;
  condition: ConditionKey;
  currentCondition: ConditionKey;
  targetCondition: ConditionKey;
  current: ProjectionSnapshot;
  projected: ProjectionSnapshot;
};

type ProjectionApiResponse = {
  ok: boolean;
  projection?: AssetFutureProjection;
  error?: string;
};

type RevalueAssetApiResponse = {
  ok: boolean;
  item?: RegisterAsset;
  valuationRunId?: number;
  selectedMethod?: AssetMethod;
  oldValueExVat?: number;
  newValueExVat?: number;
  warning?: string;
  previewOnly?: boolean;
  marketAverageExVat?: number | null;
  marketLowExVat?: number | null;
  marketHighExVat?: number | null;
  marketCount?: number;
  marketSources?: unknown[];
  marketMatchStrategy?: string;
  marketAdjustmentExVat?: number | null;
  marketRawAverageExVat?: number | null;
  marketValueMode?: 'aim4price_delta' | 'market_average' | string;
  replacementPriceUsedExVat?: number | null;
  error?: string;
};

const STAGED_DEPRECIATION_NOTICE_MESSAGE =
  'Estimate checked. The value is unchanged for now because Aim4price depreciation works in stages. The price will move down once the next depreciation stage is reached.';

function roundedEstimateValue(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return null;
  }

  return Math.round(value);
}

function savedRevalueValueStayedTheSame(data: RevalueAssetApiResponse, fallbackAsset: RegisterAsset): boolean {
  const oldValue = roundedEstimateValue(data.oldValueExVat) ?? roundedEstimateValue(fallbackAsset.value);
  const newValue = roundedEstimateValue(data.newValueExVat) ?? roundedEstimateValue(data.item?.value);

  return oldValue !== null && newValue !== null && oldValue === newValue;
}

type PricingRevaluePreview = {
  asset: RegisterAsset;
  method: RevalueMethod;
  replacementMode: RevalueReplacementMode | null;
  replacementPriceExVat: number | null;
  advancedAssumptions: RevalueAdvancedAssumptionsRequest | null;
  result: RevalueAssetApiResponse | null;
  error: string | null;
  errorContext: 'preview' | 'save' | null;
};

type MarketplacePublishDraft = {
  sellerName: string;
  sellerCompany: string;
  sellerPhone: string;
  sellerEmail: string;
  province: string;
  area: string;
  askingPriceExVat: string;
  description: string;
};

type AssetDraft = {
  kind: AssetKind;
  generalAssetCategory: GeneralAssetCategoryKey | '';
  propertyAssetSubtype: PropertyAssetSubtypeKey | '';
  propertyInterest: PropertyInterest | '';
  stockAssetSubtype: StockAssetSubtypeKey | '';
  stockValuationBasis: StockValuationBasis | '';
  stockMovement: StockMovement | '';
  stockPeakValue: string;
  insuranceUseContext: InsuranceUseContext | '';
  insuranceMobility: InsuranceMobility | '';
  insuranceCriticalToOperations: InsuranceFactAnswer;
  insuranceTemperatureSensitiveStock: InsuranceFactAnswer;
  title: string;
  value: string;
  replacementPrice: string;
  insuredValue: string;
  note: string;
  serialNumber: string;
  brandName: string;
  modelName: string;
  isFinanced: boolean;
  isInsured: boolean;
  isLicensed: boolean;
  financeStatus: FinanceStatusChoice;
  insuranceStatus: AssetStatusChoice;
  licenseStatus: AssetStatusChoice;
  licenseRegistrationNumber: string;
  financeNote: string;
  insuranceNote: string;
  photos: string[];
  documents: AssetDocument[];
  yearModel: string;
  propertySize: string;
  hours: string;
  usageMetric: AssetDraftUsageMetric;
  lifeWorkedPercent: string;
  condition: AssetConditionValue;
};

type AssetStatusDraft = {
  financeStatus: FinanceStatusChoice;
  financeType: string;
  financeCurrentOutstandingExVat: string;
  financierName: string;
  financeNote: string;
  financeBoughtWhen: string;
  financeBoughtForExVat: string;
  financeOriginalAmountExVat: string;
  financeMonthlyPaymentExVat: string;
  financeInterestRatePercent: string;
  financeTermMonths: string;
  financeBalloonPaymentExVat: string;
  financeSettlementDate: string;
  financeReferenceNumber: string;
  insuranceStatus: AssetStatusChoice;
  insuredValueExVat: string;
  insuranceInsurerName: string;
  insurancePolicyNumber: string;
  insuranceRenewalDate: string;
  insuranceNote: string;
  licenseStatus: AssetStatusChoice;
  licenseRegistrationNumber: string;
  licenseRenewalDate: string;
  licenseNote: string;
};

type PendingPhotoFile = {
  id: string;
  file: File;
  previewUrl: string;
};

type MainPhotoSelection =
  | { source: 'saved'; url: string }
  | { source: 'pending'; id: string };

type AssetAutosaveState = 'idle' | 'pending' | 'saving' | 'saved' | 'error';

type AssetSubmitOptions = {
  autosave?: boolean;
  keepOpen?: boolean;
  silent?: boolean;
  autosaveSignature?: string;
};

function buildAssetAutosaveSignature(
  draft: AssetDraft,
  statusDraft: AssetStatusDraft,
  pendingPhotos: PendingPhotoFile[] = [],
  pendingDocuments: File[] = [],
  mainPhoto: MainPhotoSelection | null = null,
): string {
  return JSON.stringify({
    draft,
    statusDraft,
    pendingPhotos: pendingPhotos.map((entry) => ({
      id: entry.id,
      name: entry.file.name,
      size: entry.file.size,
      lastModified: entry.file.lastModified,
    })),
    pendingDocuments: pendingDocuments.map((file) => ({
      name: file.name,
      size: file.size,
      lastModified: file.lastModified,
    })),
    mainPhoto,
  });
}

type DraftPhotoItem = {
  key: string;
  source: 'saved' | 'pending';
  label: string;
  previewUrl: string;
  url?: string;
  pendingId?: string;
  isMain: boolean;
};

type ProjectionFormState = {
  targetYear: string;
  inflationRatePct: string;
  targetCondition: ConditionKey;
  extraHours: string;
  targetLifeWorkedPercent: string;
};

type PageItem = number | 'ellipsis';

type IconProps = {
  className?: string;
};

const MAX_PHOTOS = 12;
const MAX_DOCUMENTS = 20;
const PAGE_SIZE_OPTIONS = [6, 12, 18] as const;
type StandardPageSize = (typeof PAGE_SIZE_OPTIONS)[number];
type PageSize = StandardPageSize | 'all';
const DEFAULT_PAGE_SIZE: PageSize = 6;

function pageSizeForVisibleCardCount(count: number): PageSize {
  return PAGE_SIZE_OPTIONS.find((option) => count <= option) ?? 'all';
}

const FALLBACK_ASSET_IMAGE = '/brand/Tractor.png';
const PROPERTY_ASSET_LABEL = 'Property, land & buildings';
const PROPERTY_ASSET_DESCRIPTION = 'Land, buildings, structures and fixed improvements.';
const PROPERTY_ASSET_TITLE_PLACEHOLDER = 'Example: Farm land, machinery shed or workshop building';
const PROPERTY_YEAR_LABEL = 'Year';
const PROPERTY_SIZE_SPEC_KEYS = ['propertySize', 'property_size', 'size', 'sizeText', 'size_text'] as const;
const GENERAL_ASSET_INSURANCE_SPEC_KEYS = [
  'generalAssetCategory',
  'general_asset_category',
  'generalAssetCategoryLabel',
  'general_asset_category_label',
  'insuranceUseContext',
  'insurance_use_context',
  'insuranceMobility',
  'insurance_mobility',
  'insuranceCriticalToOperations',
  'insurance_critical_to_operations',
  'insuranceTemperatureSensitiveStock',
  'insurance_temperature_sensitive_stock',
  'propertyAssetSubtype',
  'property_asset_subtype',
  'propertyAssetSubtypeLabel',
  'property_asset_subtype_label',
  'propertyInterest',
  'property_interest',
  'stockAssetSubtype',
  'stock_asset_subtype',
  'stockAssetSubtypeLabel',
  'stock_asset_subtype_label',
  'stockValuationBasis',
  'stock_valuation_basis',
  'stockMovement',
  'stock_movement',
  'stockPeakValueExVat',
  'stock_peak_value_ex_vat',
] as const;
const MANUAL_ASSET_TYPE_OPTIONS: Array<{
  value: Extract<AssetKind, 'vehicle' | 'tools' | 'property' | 'equipment' | 'manual' | 'stock'>;
  label: string;
  description: string;
  titlePlaceholder: string;
}> = [
  {
    value: 'equipment',
    label: 'Equipment',
    description: 'General machines and larger equipment not added through valuation.',
    titlePlaceholder: 'Example: Water pump trailer',
  },
  {
    value: 'vehicle',
    label: 'Vehicle',
    description: 'Bakkies, trucks, trailers and other road or farm vehicles.',
    titlePlaceholder: 'Example: Toyota Hilux farm bakkie',
  },
  {
    value: 'property',
    label: PROPERTY_ASSET_LABEL,
    description: PROPERTY_ASSET_DESCRIPTION,
    titlePlaceholder: PROPERTY_ASSET_TITLE_PLACEHOLDER,
  },
  {
    value: 'tools',
    label: 'Tools',
    description: 'Smaller tools, workshop items and handheld equipment.',
    titlePlaceholder: 'Example: Workshop tool set',
  },
  {
    value: 'stock',
    label: 'Stock',
    description: 'Inventory, goods, produce, livestock and other stock held by the business.',
    titlePlaceholder: 'Example: Parts inventory, fertiliser stock or livestock',
  },
  {
    value: 'manual',
    label: 'Contents & electronics',
    description: 'Furniture, appliances, computers, electronics and other everyday contents.',
    titlePlaceholder: 'Example: Samsung fridge, office desks or MacBook Pro',
  },
];

const GENERAL_ASSET_CATEGORY_OPTIONS: Array<{
  value: GeneralAssetCategoryKey;
  label: string;
  description: string;
}> = GENERAL_ASSET_CATEGORIES.map((category) => ({ ...category }));

const PROPERTY_ASSET_SUBTYPE_OPTIONS: Array<{
  value: PropertyAssetSubtypeKey;
  label: string;
  description: string;
}> = PROPERTY_ASSET_SUBTYPES.map((category) => ({ ...category }));

const STOCK_ASSET_SUBTYPE_OPTIONS: Array<{
  value: StockAssetSubtypeKey;
  label: string;
  description: string;
}> = STOCK_ASSET_SUBTYPES.map((category) => ({ ...category }));

const INSURANCE_USE_CONTEXT_OPTIONS: Array<{ value: InsuranceUseContext; label: string; description: string }> = [
  { value: 'business', label: 'Business use', description: 'Used for work, trade, farming or another business activity.' },
  { value: 'home', label: 'Home / personal use', description: 'Used mainly as part of a household or for private purposes.' },
  { value: 'mixed', label: 'Both business and personal', description: 'Regularly used for both business and personal purposes.' },
];

const INSURANCE_MOBILITY_OPTIONS: Array<{ value: InsuranceMobility; label: string; description: string }> = [
  { value: 'premises', label: 'Usually stays at one premises', description: 'Movable, but normally kept and used at one address.' },
  { value: 'portable', label: 'Portable / carried around', description: 'Regularly carried by a person, such as a laptop, phone or camera.' },
  { value: 'moves_between_locations', label: 'Moves between sites', description: 'Regularly transported between farms, branches, jobs or client sites.' },
  { value: 'fixed', label: 'Fixed or built in', description: 'Attached to the building or installed as a permanent fixture.' },
];

const PROPERTY_INTEREST_OPTIONS: Array<{ value: PropertyInterest; label: string; description: string }> = [
  { value: 'owned_occupied', label: 'Owned and occupied', description: 'The owner owns and uses the property.' },
  { value: 'owned_let', label: 'Owned and let to others', description: 'The owner owns the property and rents or lets it to another party.' },
  { value: 'leased_occupied', label: 'Leased or rented', description: 'The property is occupied under a lease or rental arrangement.' },
  { value: 'tenant_improvement', label: 'Tenant improvement only', description: 'Only alterations or improvements paid for by the tenant are being recorded.' },
  { value: 'unknown', label: 'Not sure', description: 'Leave the property interest for later confirmation.' },
];

const STOCK_VALUATION_BASIS_OPTIONS: Array<{ value: StockValuationBasis; label: string; description: string }> = [
  { value: 'purchase_cost', label: 'Purchase or landed cost', description: 'The amount paid to buy and bring the stock to its current location.' },
  { value: 'replacement_cost', label: 'Replacement cost', description: 'The current cost to replace the stock with similar goods.' },
  { value: 'selling_price', label: 'Selling price', description: 'The expected selling value of the stock.' },
  { value: 'market_value', label: 'Market value', description: 'The supported current market value, including livestock or commodities.' },
  { value: 'other', label: 'Another basis', description: 'A different value basis applies to this stock group.' },
  { value: 'unknown', label: 'Not sure', description: 'Record the value now and confirm the basis later.' },
];

const STOCK_MOVEMENT_OPTIONS: Array<{ value: StockMovement; label: string; description: string }> = [
  { value: 'one_location', label: 'Usually at one location', description: 'The stock normally remains at one premises, farm or storage site.' },
  { value: 'multiple_locations', label: 'Held at multiple locations', description: 'The total is spread across more than one site.' },
  { value: 'regular_transit', label: 'Regularly transported', description: 'The stock routinely moves between suppliers, sites or customers.' },
  { value: 'seasonal_locations', label: 'Moves seasonally', description: 'The normal storage location changes during the year or production cycle.' },
  { value: 'unknown', label: 'Not sure', description: 'Leave the movement pattern for later confirmation.' },
];

const INSURANCE_CRITICALITY_OPTIONS: Array<{ value: InsuranceFactAnswer; label: string; description: string }> = [
  { value: 'yes', label: 'Yes', description: 'Losing it would stop or materially disrupt operations.' },
  { value: 'no', label: 'No', description: 'The business or household could continue without material disruption.' },
  { value: 'unknown', label: 'Not sure', description: 'Leave this for the insurance review to confirm.' },
];

const TEMPERATURE_SENSITIVE_STOCK_OPTIONS: Array<{ value: InsuranceFactAnswer; label: string; description: string }> = [
  { value: 'yes', label: 'Yes', description: 'A failure could spoil refrigerated or frozen stock, food, medicine or produce.' },
  { value: 'no', label: 'No', description: 'No temperature-sensitive stock depends on this equipment.' },
  { value: 'unknown', label: 'Not sure', description: 'Leave this for the insurance review to confirm.' },
];

const LIFETIME_PERCENT_SETTINGS_ERROR =
  'The new lifetime usage percentage cannot be lower than the usage already saved on this asset. Please go to Settings to override this.';
const USAGE_READING_SETTINGS_ERROR =
  'The new usage reading cannot be lower than the reading already saved on this asset. Please go to Settings to override this.';
const ASSET_SETTINGS_USAGE_COPY =
  'Correct the saved usage only when the current reading is wrong.';
const USAGE_OVERRIDE_CONFIRMATION_TEXT =
  'Are you sure you want to override the saved usage for this asset? This can lower the usage recorded for this saved Aim4price asset and may affect its valuation/depreciation history.';

type AssetSettingsUsageMode = 'percent' | 'hours' | 'km' | 'none';
type AssetSettingsLocationState = 'idle' | 'capturing' | 'savingManual' | 'savingDevice' | 'savingMap';
type AssetSettingsView = 'menu' | 'location' | 'locationManual' | 'locationMap' | 'type' | 'conversion' | 'usage';
type AssetUsageOverrideRequest = {
  mode: Exclude<AssetSettingsUsageMode, 'none'>;
  value: number;
};

type AssetSettingsManualGpsValidation =
  | { ok: true; latitude: number; longitude: number; locationText: string }
  | { ok: false; error: string };

const MAX_ASSET_SETTINGS_LOCATION_TEXT_LENGTH = 180;

const FINANCE_STATUS_OPTIONS: Array<{ value: FinanceStatusChoice; label: string; description: string }> = [
  { value: 'yes', label: 'Is financed', description: 'This asset has active finance or a lender linked to it.' },
  { value: 'paid', label: 'Is paid off', description: 'Finance is settled, but the agreement remains in the asset history.' },
  { value: 'no', label: 'Is not financed', description: 'This asset is fully owned and has no finance balance.' },
  { value: 'not_applicable', label: 'Not applicable', description: 'Finance status does not apply to this asset.' },
  { value: 'unknown', label: 'Not sure', description: 'You can confirm the finance status later.' },
];

const INSURANCE_STATUS_OPTIONS: Array<{ value: AssetStatusChoice; label: string; description: string }> = [
  { value: 'yes', label: 'Is insured', description: 'This asset is covered on an insurance policy.' },
  { value: 'no', label: 'Is not insured', description: 'This asset is not currently insured.' },
  { value: 'not_applicable', label: 'Not applicable', description: 'Insurance status does not apply to this asset.' },
  { value: 'unknown', label: 'Not sure', description: 'You can confirm the insurance status later.' },
];

const LICENSE_STATUS_OPTIONS: Array<{ value: AssetStatusChoice; label: string; description: string }> = [
  { value: 'yes', label: 'Is licensed', description: 'This asset has an active licence or road-use registration.' },
  { value: 'no', label: 'Is not licensed', description: 'This asset is not currently licensed.' },
  { value: 'not_applicable', label: 'Not applicable', description: 'Licensing does not apply to this asset.' },
  { value: 'unknown', label: 'Not sure', description: 'You can confirm the licence status later.' },
];

const QUICK_FINANCE_STATUS_OPTIONS: Array<{ value: FinanceStatusChoice; label: string; description: string }> = [
  { value: 'yes', label: 'Financed', description: 'This asset has active finance or forms part of financed group debt.' },
  { value: 'paid', label: 'Paid off', description: 'Finance has been settled and is retained as history.' },
  { value: 'no', label: 'Not financed', description: 'This asset is not currently financed.' },
  { value: 'unknown', label: 'Not sure', description: 'You can confirm the finance status later.' },
  { value: 'not_applicable', label: 'Not applicable', description: 'Finance status does not apply to this asset.' },
];

const QUICK_INSURANCE_STATUS_OPTIONS: Array<{ value: AssetStatusChoice; label: string; description: string }> = [
  { value: 'yes', label: 'Insured', description: 'This asset is covered on an insurance policy.' },
  { value: 'no', label: 'Not insured', description: 'This asset is not currently insured.' },
  { value: 'unknown', label: 'Not sure', description: 'You can confirm the insurance status later.' },
  { value: 'not_applicable', label: 'Not applicable', description: 'Insurance status does not apply to this asset.' },
];

const QUICK_LICENSE_STATUS_OPTIONS: Array<{ value: AssetStatusChoice; label: string; description: string }> = [
  { value: 'yes', label: 'Licensed', description: 'This asset has an active licence or registration.' },
  { value: 'no', label: 'Not licensed', description: 'This asset is not currently licensed.' },
  { value: 'unknown', label: 'Not sure', description: 'You can confirm the licence status later.' },
  { value: 'not_applicable', label: 'Not applicable', description: 'Licensing does not apply to this asset.' },
];

const FINANCE_TYPE_OPTIONS: Array<{ value: string; label: string; description: string }> = [
  { value: '', label: 'Select finance type', description: 'Optional.' },
  { value: 'asset_specific', label: 'Asset-specific finance', description: 'Finance is linked to this specific asset.' },
  { value: 'bulk_group', label: 'Bulk / group finance', description: 'Finance covers more than one asset.' },
  { value: 'unknown', label: 'Not sure', description: 'Confirm the finance type later.' },
];

const MANUAL_FORM_STEPS: Array<{ step: ManualAssetStep; label: string }> = [
  { step: 1, label: 'Equipment type' },
  { step: 2, label: 'Details' },
  { step: 3, label: 'Status' },
  { step: 4, label: 'Documents' },
];

const ASSET_FORM_SECTION_TABS: Array<{ step: ManualAssetStep; label: string }> = [
  { step: 2, label: 'Details' },
  { step: 3, label: 'Paperwork' },
  { step: 4, label: 'Documents' },
];

const CONDITION_OPTIONS: Array<{ value: AssetConditionValue; label: string }> = [
  { value: '', label: 'Select condition' },
  { value: 'excellent', label: 'Excellent' },
  { value: 'good', label: 'Good' },
  { value: 'fair', label: 'Fair' },
  { value: 'used', label: 'Used' },
  { value: 'serious', label: 'Requires attention' },
];

const EQUIPMENT_USAGE_OPTIONS: Array<{ value: AssetDraftUsageMetric; label: string; description: string }> = [
  { value: 'hours', label: 'Hours', description: 'Use the machine hour meter.' },
  { value: 'percentage', label: '% worked', description: 'Use the estimated lifetime already worked.' },
  { value: 'not_applicable', label: 'Not applicable', description: 'This asset does not have a useful usage reading.' },
];

const VEHICLE_USAGE_OPTIONS: Array<{ value: AssetDraftUsageMetric; label: string; description: string }> = [
  { value: 'km', label: 'Kilometres', description: 'Use the current odometer reading.' },
  { value: 'not_applicable', label: 'Not applicable', description: 'This vehicle does not have a useful usage reading.' },
];

const ASSET_FILTER_OPTIONS: AssetFilterOption[] = [
  { value: 'all', label: 'All Assets' },
  { value: 'insured', label: 'Insured' },
  { value: 'not-insured', label: 'Not insured' },
  { value: 'financed', label: 'Financed' },
  { value: 'not-financed', label: 'Not financed' },
  { value: 'licensed', label: 'Licensed' },
  { value: 'not-licensed', label: 'Not licensed' },
  { value: 'license-not-applicable', label: 'N/A Licensed' },
  { value: 'mapped', label: 'Mapped' },
  { value: 'not-mapped', label: 'Not Mapped' },
  { value: 'highest-value', label: 'Highest current value' },
  { value: 'lowest-value', label: 'Lowest current value' },
  { value: 'highest-replacement-price', label: 'Highest replacement price' },
  { value: 'lowest-replacement-price', label: 'Lowest replacement price' },
  { value: 'aim4price-value', label: 'Aim4price value' },
  { value: 'manual-value', label: 'Manual value' },
  { value: 'marketplace', label: 'Marketplace' },
  { value: 'property', label: `${PROPERTY_ASSET_LABEL} only` },
  { value: 'no-property', label: `No ${PROPERTY_ASSET_LABEL.toLowerCase()}` },
];

const PRIMARY_ASSET_FILTER_OPTION = ASSET_FILTER_OPTIONS.find((option) => option.value === 'all') ?? ASSET_FILTER_OPTIONS[0];
const SECONDARY_ASSET_FILTER_OPTIONS = ASSET_FILTER_OPTIONS.filter((option) => option.value !== 'all');

const LEAFLET_SCRIPT_ID = 'aim4price-leaflet-script';
const LEAFLET_CSS_ID = 'aim4price-leaflet-css';
const DEFAULT_PARTNER_MAP_CENTER: [number, number] = [-29, 24];
const DEFAULT_PARTNER_MAP_ZOOM = 5;
const ASSET_SETTINGS_SAVED_ASSET_ZOOM = 13;
const ASSET_SETTINGS_PROFILE_PIN_ZOOM = 12;
const ASSET_SETTINGS_TOWN_ZOOM = 11;
const ASSET_SETTINGS_PROVINCE_ZOOM = 7;

type AssetSettingsApproximateMapLocation = { center: [number, number]; zoom: number };
type AssetSettingsMapLookupLocation = { keys: string[]; center: [number, number]; zoom?: number };

const ASSET_SETTINGS_SA_TOWN_MAP_LOCATIONS: AssetSettingsMapLookupLocation[] = [
  { keys: ['cape town', 'city of cape town', 'bellville', 'brackenfell', 'durbanville', 'milnerton'], center: [-33.9249, 18.4241] },
  { keys: ['stellenbosch'], center: [-33.9321, 18.8602] },
  { keys: ['paarl'], center: [-33.7342, 18.9621] },
  { keys: ['worcester'], center: [-33.6465, 19.4485] },
  { keys: ['malmesbury'], center: [-33.4608, 18.7271] },
  { keys: ['swellendam'], center: [-34.0226, 20.4417] },
  { keys: ['hermanus'], center: [-34.4187, 19.2345] },
  { keys: ['beaufort west'], center: [-32.3567, 22.5829] },
  { keys: ['george', 'platrug', 'platrug george'], center: [-33.9644, 22.4597] },
  { keys: ['mossel bay', 'mosselbaai'], center: [-34.1831, 22.1460] },
  { keys: ['oudtshoorn'], center: [-33.5907, 22.2014] },
  { keys: ['knysna'], center: [-34.0351, 23.0465] },
  { keys: ['plettenberg bay', 'plettenbergbaai', 'plett'], center: [-34.0527, 23.3716] },
  { keys: ['johannesburg', 'joburg', 'egoli', 'sandton', 'randburg', 'roodepoort'], center: [-26.2041, 28.0473] },
  { keys: ['pretoria', 'tshwane', 'centurion'], center: [-25.7479, 28.2293] },
  { keys: ['midrand'], center: [-25.9992, 28.1263] },
  { keys: ['krugersdorp'], center: [-26.0963, 27.8077] },
  { keys: ['vereeniging', 'vanderbijlpark', 'sasolburg'], center: [-26.6731, 27.9261] },
  { keys: ['durban', 'ethekwini', 'umhlanga', 'pinetown'], center: [-29.8587, 31.0218] },
  { keys: ['pietermaritzburg', 'maritzburg'], center: [-29.6006, 30.3794] },
  { keys: ['richards bay', 'empangeni'], center: [-28.7807, 32.0383] },
  { keys: ['newcastle'], center: [-27.7574, 29.9318] },
  { keys: ['bloemfontein', 'mangaung'], center: [-29.0852, 26.1596] },
  { keys: ['welkom'], center: [-27.9777, 26.7351] },
  { keys: ['bethlehem'], center: [-28.2308, 28.3071] },
  { keys: ['kimberley'], center: [-28.7282, 24.7499] },
  { keys: ['upington'], center: [-28.4478, 21.2561] },
  { keys: ['springbok'], center: [-29.6643, 17.8865] },
  { keys: ['gqeberha', 'port elizabeth'], center: [-33.9608, 25.6022] },
  { keys: ['east london'], center: [-33.0192, 27.8999] },
  { keys: ['mthatha', 'umtata'], center: [-31.5889, 28.7844] },
  { keys: ['graaff reinet'], center: [-32.2522, 24.5308] },
  { keys: ['queenstown', 'komani'], center: [-31.8976, 26.8753] },
  { keys: ['mbombela', 'nelspruit'], center: [-25.4658, 30.9853] },
  { keys: ['emalahleni', 'witbank'], center: [-25.8713, 29.2332] },
  { keys: ['middelburg mpumalanga'], center: [-25.7751, 29.4648] },
  { keys: ['secunda'], center: [-26.5166, 29.1899] },
  { keys: ['polokwane', 'pietersburg'], center: [-23.9045, 29.4689] },
  { keys: ['tzaneen'], center: [-23.8332, 30.1635] },
  { keys: ['thohoyandou'], center: [-22.9456, 30.4840] },
  { keys: ['rustenburg'], center: [-25.6676, 27.2421] },
  { keys: ['mahikeng', 'mafikeng'], center: [-25.8652, 25.6442] },
  { keys: ['klerksdorp'], center: [-26.8521, 26.6667] },
  { keys: ['potchefstroom'], center: [-26.7145, 27.0970] },
];

const ASSET_SETTINGS_SA_PROVINCE_MAP_LOCATIONS: AssetSettingsMapLookupLocation[] = [
  { keys: ['western cape'], center: [-33.2278, 21.8569] },
  { keys: ['eastern cape'], center: [-32.2968, 26.4194] },
  { keys: ['northern cape'], center: [-29.0467, 21.8569] },
  { keys: ['free state'], center: [-28.4541, 26.7968] },
  { keys: ['gauteng'], center: [-26.2708, 28.1123] },
  { keys: ['kwazulu natal', 'kwa zulu natal', 'kzn'], center: [-28.5306, 30.8958] },
  { keys: ['limpopo'], center: [-23.4013, 29.4179] },
  { keys: ['mpumalanga'], center: [-25.5653, 30.5279] },
  { keys: ['north west', 'northwest'], center: [-26.6639, 25.2838] },
];

function normalizeAssetSettingsMapLookupText(value: unknown): string {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function readAssetSettingsMapCoordinate(value: unknown, limit: number): number | null {
  if (value === null || typeof value === 'undefined') {
    return null;
  }

  if (typeof value === 'string' && !value.trim()) {
    return null;
  }

  const numeric = typeof value === 'number' ? value : Number(value);

  return Number.isFinite(numeric) && Math.abs(numeric) <= limit ? numeric : null;
}

function findAssetSettingsLookupLocation(
  lookupText: string,
  locations: AssetSettingsMapLookupLocation[],
  fallbackZoom: number,
): AssetSettingsApproximateMapLocation | null {
  if (!lookupText) return null;

  const paddedLookupText = ` ${lookupText} `;

  for (const location of locations) {
    if (location.keys.some((key) => paddedLookupText.includes(` ${normalizeAssetSettingsMapLookupText(key)} `))) {
      return { center: location.center, zoom: location.zoom ?? fallbackZoom };
    }
  }

  return null;
}

function resolveAssetSettingsProfileMapLocation(profile: AccountProfile | null): AssetSettingsApproximateMapLocation | null {
  if (!profile) return null;

  const profileLatitude = readAssetSettingsMapCoordinate(profile.partnerLatitude, 90);
  const profileLongitude = readAssetSettingsMapCoordinate(profile.partnerLongitude, 180);

  if (profileLatitude !== null && profileLongitude !== null) {
    return { center: [profileLatitude, profileLongitude], zoom: ASSET_SETTINGS_PROFILE_PIN_ZOOM };
  }

  const townLookupText = normalizeAssetSettingsMapLookupText(
    [profile.addressLine1, profile.townCity, profile.marketplaceLocation, profile.province].filter(Boolean).join(' '),
  );
  const townLocation = findAssetSettingsLookupLocation(
    townLookupText,
    ASSET_SETTINGS_SA_TOWN_MAP_LOCATIONS,
    ASSET_SETTINGS_TOWN_ZOOM,
  );

  if (townLocation) {
    return townLocation;
  }

  return findAssetSettingsLookupLocation(
    normalizeAssetSettingsMapLookupText(profile.province),
    ASSET_SETTINGS_SA_PROVINCE_MAP_LOCATIONS,
    ASSET_SETTINGS_PROVINCE_ZOOM,
  );
}

function getAssetSettingsInitialMapLocation(profile: AccountProfile | null): AssetSettingsApproximateMapLocation {
  return resolveAssetSettingsProfileMapLocation(profile) ?? { center: DEFAULT_PARTNER_MAP_CENTER, zoom: DEFAULT_PARTNER_MAP_ZOOM };
}

let leafletLoaderPromise: Promise<any> | null = null;

const ASSET_QUOTE_OPTIONS: AssetQuoteOption[] = [
  {
    leadType: 'finance',
    partnerType: 'finance',
    title: 'Finance & accounting',
    shortTitle: 'Finance help',
    description: 'Share with an accountant, financier or bank.',
    mapTitle: 'Choose an accountant, financier or bank.',
    sendLabel: 'Send finance request',
    emptyPartnerText: 'No listed accountants, financiers or banks found yet. Finance accounts must enable their directory listing under Account details.',
  },
  {
    leadType: 'insurance',
    partnerType: 'insurance',
    title: 'Insurance',
    shortTitle: 'Insurance help',
    description: 'Share with an insurer or broker.',
    mapTitle: 'Choose an insurer or broker.',
    sendLabel: 'Send insurance request',
    emptyPartnerText: 'No listed insurers or brokers found yet. Insurance accounts must enable their directory listing under Account details.',
  },
  {
    leadType: 'replacement_quote',
    partnerType: 'dealer',
    title: 'Dealer',
    shortTitle: 'Dealership help',
    description: 'Share with a dealer.',
    mapTitle: 'Choose a dealer.',
    sendLabel: 'Send replacement price request',
    emptyPartnerText: 'No listed dealers found yet. Dealer accounts must enable their directory listing under Account details.',
  },
  {
    leadType: 'license_renewal',
    partnerType: 'licensing',
    title: 'Licence renewal',
    shortTitle: 'Licence renewal',
    description: 'Share with a renewal expert.',
    mapTitle: 'Choose a licence renewal expert.',
    sendLabel: 'Send licence renewal request',
    emptyPartnerText: 'No listed licence renewal experts found yet. Licensing accounts must enable their directory listing under Account details.',
  },
];

type QuoteToneStyle = {
  primary: string;
  dark: string;
  text: string;
  soft: string;
  border: string;
  shadow: string;
};

const QUOTE_TONE_STYLES: Record<PartnerType, QuoteToneStyle> = {
  finance: {
    primary: '#c48220',
    dark: '#8b5a12',
    text: '#74460b',
    soft: '#fff7e8',
    border: '#f0cf97',
    shadow: 'rgba(196, 130, 32, 0.34)',
  },
  insurance: {
    primary: '#2563eb',
    dark: '#1d4ed8',
    text: '#1e3a8a',
    soft: '#eff6ff',
    border: '#bfdbfe',
    shadow: 'rgba(37, 99, 235, 0.32)',
  },
  dealer: {
    primary: '#159063',
    dark: '#0f6f4d',
    text: '#065f46',
    soft: '#ecfdf5',
    border: '#bbf7d0',
    shadow: 'rgba(22, 130, 88, 0.34)',
  },
  licensing: {
    primary: '#7c3aed',
    dark: '#5b21b6',
    text: '#4c1d95',
    soft: '#f5f3ff',
    border: '#ddd6fe',
    shadow: 'rgba(124, 58, 237, 0.28)',
  },
};


const initialAssetDraft: AssetDraft = {
  kind: 'equipment',
  generalAssetCategory: '',
  propertyAssetSubtype: '',
  propertyInterest: '',
  stockAssetSubtype: '',
  stockValuationBasis: '',
  stockMovement: '',
  stockPeakValue: '',
  insuranceUseContext: '',
  insuranceMobility: '',
  insuranceCriticalToOperations: 'unknown',
  insuranceTemperatureSensitiveStock: 'unknown',
  title: '',
  value: '',
  replacementPrice: '',
  insuredValue: '',
  note: '',
  serialNumber: '',
  brandName: '',
  modelName: '',
  isFinanced: false,
  isInsured: false,
  isLicensed: false,
  financeStatus: 'unknown',
  insuranceStatus: 'unknown',
  licenseStatus: 'unknown',
  licenseRegistrationNumber: '',
  financeNote: '',
  insuranceNote: '',
  photos: [],
  documents: [],
  yearModel: '',
  propertySize: '',
  hours: '',
  usageMetric: 'hours',
  lifeWorkedPercent: '',
  condition: '',
};

const initialAssetStatusDraft: AssetStatusDraft = {
  financeStatus: 'unknown',
  financeType: '',
  financeCurrentOutstandingExVat: '',
  financierName: '',
  financeNote: '',
  financeBoughtWhen: '',
  financeBoughtForExVat: '',
  financeOriginalAmountExVat: '',
  financeMonthlyPaymentExVat: '',
  financeInterestRatePercent: '',
  financeTermMonths: '',
  financeBalloonPaymentExVat: '',
  financeSettlementDate: '',
  financeReferenceNumber: '',
  insuranceStatus: 'unknown',
  insuredValueExVat: '',
  insuranceInsurerName: '',
  insurancePolicyNumber: '',
  insuranceRenewalDate: '',
  insuranceNote: '',
  licenseStatus: 'unknown',
  licenseRegistrationNumber: '',
  licenseRenewalDate: '',
  licenseNote: '',
};

function createDefaultProjectionForm(asset?: RegisterAsset | null): ProjectionFormState {
  const nextYear = new Date().getFullYear() + 1;
  const currentLifeWorkedPercent = asset && assetUsesPercentUsage(asset) ? getAssetLifeWorkedPercent(asset) : null;

  return {
    targetYear: String(nextYear),
    inflationRatePct: '5',
    targetCondition: asset?.condition || 'good',
    extraHours: '',
    targetLifeWorkedPercent: currentLifeWorkedPercent === null ? '' : formatLifetimePercentPlain(currentLifeWorkedPercent),
  };
}

function SearchIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className} aria-hidden="true">
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </svg>
  );
}

function RefreshIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className} aria-hidden="true">
      <path d="M20 11a8 8 0 0 0-14.7-4.3L4 8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M4 4v4h4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M4 13a8 8 0 0 0 14.7 4.3L20 16" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M20 20v-4h-4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ChangeRegisterIcon({ className }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M7 7h10" />
      <path d="m14 4 3 3-3 3" />
      <path d="M17 17H7" />
      <path d="m10 14-3 3 3 3" />
    </svg>
  );
}

function FilterIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className} aria-hidden="true">
      <path d="M4 6h16" />
      <path d="M7 12h10" />
      <path d="M10 18h4" />
    </svg>
  );
}

function FlagIcon({ className }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.1"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M6 20V4" />
      <path d="M6 4h10.8a1 1 0 0 1 .86 1.5L15.9 8.5l1.76 3a1 1 0 0 1-.86 1.5H6" />
    </svg>
  );
}

function UmbrellaIcon({ className }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M3 12a9 9 0 0 1 18 0" />
      <path d="M3 12c1.4-1.7 3.2-1.7 4.6 0 1.4-1.7 3.3-1.7 4.7 0 1.4-1.7 3.3-1.7 4.7 0 1.2-1.5 2.7-1.7 4-.5" />
      <path d="M12 3v14.5a3 3 0 0 0 6 0" />
    </svg>
  );
}

function NoteIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 20h4.4L19.7 8.7a2.2 2.2 0 0 0 0-3.1l-1.3-1.3a2.2 2.2 0 0 0-3.1 0L4 15.6V20Z" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="m13.8 5.8 4.4 4.4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function OptionsIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className} aria-hidden="true">
      <path d="M4 7h16" />
      <path d="M4 12h16" />
      <path d="M4 17h16" />
      <circle cx="8" cy="7" r="1.5" fill="currentColor" stroke="none" />
      <circle cx="16" cy="12" r="1.5" fill="currentColor" stroke="none" />
      <circle cx="12" cy="17" r="1.5" fill="currentColor" stroke="none" />
    </svg>
  );
}

function ManageIcon({ className }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.38a2 2 0 0 0-.73-2.73l-.15-.09a2 2 0 0 1-1-1.74v-.51a2 2 0 0 1 1-1.72l.15-.1a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function UpdateAssetIcon({ className }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.15"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M12 20h9" />
      <path d="m16.5 3.5 4 4L8 20l-5 1 1-5z" />
    </svg>
  );
}

function CartIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className} aria-hidden="true">
      <path d="M3 4h2l2.2 10.4a2 2 0 0 0 2 1.6h7.9a2 2 0 0 0 1.95-1.56L20 8H6.2" />
      <path d="M8 8h12" />
      <circle cx="9" cy="20" r="1.4" />
      <circle cx="18" cy="20" r="1.4" />
    </svg>
  );
}

function BankIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M3 10h18" />
      <path d="M5 10v8" />
      <path d="M9 10v8" />
      <path d="M15 10v8" />
      <path d="M19 10v8" />
      <path d="M4 18h16" />
      <path d="M12 3 4 8h16z" />
    </svg>
  );
}

function MoneyBagIcon({ className }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M8.2 4.2c.55 1.35 1.7 2.1 3.8 2.1s3.25-.75 3.8-2.1" />
      <path d="M9.15 3.2h5.7l1.55 2.25-1.85 1.85h-5.1L7.6 5.45z" />
      <path d="M7.35 8.05c-2.65 2.2-4.1 5.15-4.1 8.25 0 3.15 2.5 4.5 8.75 4.5s8.75-1.35 8.75-4.5c0-3.1-1.45-6.05-4.1-8.25" />
      <path d="M12 10.1v7.1" />
      <path d="M14.4 11.65h-3.2c-.9 0-1.55.52-1.55 1.25s.58 1.12 1.55 1.32l1.6.34c.97.2 1.55.6 1.55 1.32s-.65 1.25-1.55 1.25H9.45" />
    </svg>
  );
}

function ReplacementQuoteIcon({ className }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.35"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M12 5v14" />
      <path d="M5 12h14" />
    </svg>
  );
}

function ShieldIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M12 3 20 6v5c0 5.2-3.3 8.7-8 10-4.7-1.3-8-4.8-8-10V6z" />
      <path d="m9 12 2 2 4-5" />
    </svg>
  );
}

function QuoteMachineIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M4 15h3l2-5h5l2 5h4" />
      <path d="M7 15h10" />
      <circle cx="7" cy="18" r="2" />
      <circle cx="17" cy="18" r="2" />
      <path d="M10 10V7h4v3" />
      <path d="M19 6v4" />
      <path d="M17 8h4" />
    </svg>
  );
}

function DownloadIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className} aria-hidden="true">
      <path d="M12 3v10" />
      <path d="m8 9 4 4 4-4" />
      <path d="M4 20h16" />
    </svg>
  );
}

function ShareIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <circle cx="18" cy="5" r="3" />
      <circle cx="6" cy="12" r="3" />
      <circle cx="18" cy="19" r="3" />
      <path d="m8.6 10.6 6.8-4.2" />
      <path d="m8.6 13.4 6.8 4.2" />
    </svg>
  );
}


function CopyIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className} aria-hidden="true">
      <rect x="9" y="9" width="11" height="11" rx="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

function QrIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className} aria-hidden="true">
      <rect x="3" y="3" width="6" height="6" rx="1" />
      <rect x="15" y="3" width="6" height="6" rx="1" />
      <rect x="3" y="15" width="6" height="6" rx="1" />
      <path d="M15 15h3v3" />
      <path d="M21 15v6h-3" />
      <path d="M15 21v-3" />
      <path d="M12 7h1" />
      <path d="M12 12h1" />
      <path d="M7 12h1" />
      <path d="M12 17h1" />
    </svg>
  );
}

function SpreadsheetIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className} aria-hidden="true">
      <rect x="4" y="3" width="16" height="18" rx="2" />
      <path d="M8 7h8" />
      <path d="M8 11h8" />
      <path d="M8 15h8" />
      <path d="M12 7v8" />
    </svg>
  );
}

function PdfIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className} aria-hidden="true">
      <path d="M7 3h7l5 5v13H7z" />
      <path d="M14 3v5h5" />
      <path d="M9 15h6" />
      <path d="M9 18h5" />
    </svg>
  );
}


function DocumentIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className} aria-hidden="true">
      <path d="M7 3h7l5 5v13H7z" />
      <path d="M14 3v5h5" />
      <path d="M9 13h6" />
      <path d="M9 17h6" />
    </svg>
  );
}

function TrendIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className} aria-hidden="true">
      <path d="M3 17 9 11l4 4 8-8" />
      <path d="M14 7h7v7" />
    </svg>
  );
}

function EditIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className} aria-hidden="true">
      <path d="M12 20h9" />
      <path d="m16.5 3.5 4 4L8 20l-5 1 1-5z" />
    </svg>
  );
}

function PrintIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className} aria-hidden="true">
      <path d="M7 8V3h10v5" />
      <path d="M7 17H5a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-2" />
      <path d="M7 14h10v7H7z" />
    </svg>
  );
}

function StoreIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className} aria-hidden="true">
      <path d="M3 9 5 4h14l2 5" />
      <path d="M4 9h16v3a3 3 0 0 1-3 3h-1a3 3 0 0 1-2-1 3 3 0 0 1-4 0 3 3 0 0 1-2 1H7a3 3 0 0 1-3-3z" />
      <path d="M5 15v5h14v-5" />
    </svg>
  );
}

function TrashIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className} aria-hidden="true">
      <path d="M3 6h18" />
      <path d="M8 6V4h8v2" />
      <path d="m6 6 1 14h10l1-14" />
      <path d="M10 10v6" />
      <path d="M14 10v6" />
    </svg>
  );
}

function PlusIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className} aria-hidden="true">
      <path d="M12 5v14" />
      <path d="M5 12h14" />
    </svg>
  );
}

function CloseIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className} aria-hidden="true">
      <path d="m6 6 12 12" />
      <path d="m18 6-12 12" />
    </svg>
  );
}

function ChevronLeftIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className} aria-hidden="true">
      <path d="m15 18-6-6 6-6" />
    </svg>
  );
}

function ChevronRightIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className} aria-hidden="true">
      <path d="m9 18 6-6-6-6" />
    </svg>
  );
}

function ChevronDownIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className} aria-hidden="true">
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

function ChevronUpIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className} aria-hidden="true">
      <path d="m18 15-6-6-6 6" />
    </svg>
  );
}

type ExportGraphicProps = {
  src: string;
  alt: string;
  icon: JSX.Element;
};

function ExportGraphic({ src, alt, icon }: ExportGraphicProps) {
  const [hasError, setHasError] = useState(false);

  if (hasError) {
    return <span className={styles.exportGraphicFallback}>{icon}</span>;
  }

  return <img src={src} alt={alt} className={styles.exportGraphicImage} onError={() => setHasError(true)} />;
}

function ReportSelect({ label, value, options, isOpen, disabled = false, onToggle, onChange }: ReportSelectProps) {
  const selectedOption = options.find((option) => option.value === value) ?? options[0];

  return (
    <div
      className={`${styles.reportSelectField} ${isOpen ? styles.reportSelectFieldOpen : ''} ${disabled ? styles.reportSelectFieldDisabled : ''}`}
      data-asset-report-select-root="true"
    >
      <span className={styles.reportSelectLabel}>{label}</span>
      <button type="button" className={styles.reportSelectButton} onClick={onToggle} disabled={disabled} aria-haspopup="listbox" aria-expanded={isOpen}>
        <span>{selectedOption?.label ?? 'Select option'}</span>
        <ChevronDownIcon className={styles.reportSelectChevron} />
      </button>

      {isOpen && !disabled ? (
        <div className={styles.reportSelectMenu} role="listbox" aria-label={label}>
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              className={`${styles.reportSelectOption} ${option.value === value ? styles.reportSelectOptionActive : ''}`}
              onClick={() => onChange(option.value)}
              role="option"
              aria-selected={option.value === value}
            >
              {option.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function AssetReportFormatPicker({ value, onChange }: AssetReportFormatPickerProps) {
  return (
    <div className={styles.assetTimelineFormatGrid} aria-label="Report format">
      <button
        type="button"
        className={`${styles.assetTimelineFormatOption} ${value === 'pdf' ? styles.assetTimelineFormatOptionActive : ''}`}
        onClick={() => onChange('pdf')}
        aria-pressed={value === 'pdf'}
      >
        <span className={styles.assetTimelineFormatGraphic}>
          <ExportGraphic src="/brand/pdf.png" alt="PDF report" icon={<PdfIcon className={styles.assetTimelineFormatFallbackIcon} />} />
        </span>
        <span className={styles.assetTimelineFormatCopy}>
          <strong>PDF report</strong>
          <small>Open a clear report for clients, banks or insurance partners.</small>
        </span>
      </button>

      <button
        type="button"
        className={`${styles.assetTimelineFormatOption} ${value === 'xlsx' ? styles.assetTimelineFormatOptionActive : ''}`}
        onClick={() => onChange('xlsx')}
        aria-pressed={value === 'xlsx'}
      >
        <span className={styles.assetTimelineFormatGraphic}>
          <ExportGraphic src="/brand/sheet.png" alt="Excel workbook" icon={<SpreadsheetIcon className={styles.assetTimelineFormatFallbackIcon} />} />
        </span>
        <span className={styles.assetTimelineFormatCopy}>
          <strong>XLSX workbook</strong>
          <small>Download the selected timeline records in an Excel-ready workbook.</small>
        </span>
      </button>
    </div>
  );
}

type ModalSelectOption<T extends string> = {
  value: T;
  label: string;
  description?: string;
};

type ModalSelectPortalStyle = CSSProperties & {
  '--asset-select-top': string;
  '--asset-select-left': string;
  '--asset-select-width': string;
  '--asset-select-max-height': string;
};

type ModalSelectProps<T extends string> = {
  label: string;
  value: T | '';
  options: Array<ModalSelectOption<T>>;
  onChange: (value: T) => void;
  placeholder?: string;
  className?: string;
  menuClassName?: string;
  autoFocus?: boolean;
  showDescriptions?: boolean;
  usePortal?: boolean;
};

function ModalSelect<T extends string>({
  label,
  value,
  options,
  onChange,
  placeholder = 'Select option',
  className = '',
  menuClassName = '',
  autoFocus = false,
  showDescriptions = true,
  usePortal = false,
}: ModalSelectProps<T>) {
  const [isOpen, setIsOpen] = useState(false);
  const [portalMenuStyle, setPortalMenuStyle] = useState<ModalSelectPortalStyle | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const selectedOption = options.find((option) => option.value === value) ?? null;

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    function handlePointerDown(event: PointerEvent) {
      const target = event.target;

      if (!(target instanceof Node)) {
        return;
      }

      if (wrapRef.current?.contains(target) || menuRef.current?.contains(target)) {
        return;
      }

      setIsOpen(false);
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    }

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || !usePortal) {
      setPortalMenuStyle(null);
      return undefined;
    }

    function updatePortalPosition() {
      const button = buttonRef.current;
      if (!button) {
        return;
      }

      const rect = button.getBoundingClientRect();
      const viewportWidth = window.visualViewport?.width ?? window.innerÛ]µçkh‘éì¶»§q«^t€€€ÑåÁ”ô‰‰ÕÑÑ½¸ˆ(€€€€€€€€€€€€€€€±…ÍÍ9…µ”õíÍÑå±•Ì¹µ½‘…±±½Í•	ÕÑÑ½¹ô(€€€€€€€€€€€€€€€½¹±¥¬õí±½Í•AÉ¥¥¹AÉ•Ù¥•Ý¥…±½ô(€€€€€€€€€€€€€€€…É¥„µ±…‰•°ô‰±½Í”Ù…±Õ”ÁÉ•Ù¥•Üˆ(€€€€€€€€€€€€€€€‘¥Í…‰±•õí¥ÍM…Ù¥¹AÉ¥¥¹AÉ•Ù¥•Ýô(€€€€€€€€€€€€€€ø(€€€€€€€€€€€€€€€€ñ±½Í•%½¸±…ÍÍ9…µ”õíÍÑå±•Ì¹‰ÕÑÑ½¹%½¹ô€¼ø(€€€€€€€€€€€€€€ð½‰ÕÑÑ½¸ø(€€€€€€€€€€€€ð½‘¥Øø((€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”õí€‘íÍÑå±•Ì¹µ½‘…±MÉ½±±	½‘åô€‘íÍÑå±•Ì¹ÁÉ¥¥¹I•ÍÕ±Ñ	½‘åõôø(€€€€€€€€€€€€€€ðø(€€€€€€€€€€€€€€€€€íÁÉ¥¥¹AÉ•Ù¥•Ý]¥é…É‘MÑ•À€ôôô€Ä€ü€ (€€€€€€€€€€€€€€€€€€€€ñÍ•Ñ¥½¸±…ÍÍ9…µ”õí€‘íÍÑå±•Ì¹É•Ù…±Õ•I•Á±…•µ•¹ÑA…¹•±ô€‘íÍÑå±•Ì¹É•Ù…±Õ•M…Ù•‘MÑ•ÁA…¹•±õôø(€€€€€€€€€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”õíÍÑå±•Ì¹É•Ù…±Õ•I•Á±…•µ•¹Ñ!•…‘•Éôø(€€€€€€€€€€€€€€€€€€€€€€€€ñ‘¥Øø(€€€€€€€€€€€€€€€€€€€€€€€€€€ñÍÁ…¸ùMÑ•À€Ä½˜€Ìð½ÍÁ…¸ø(€€€€€€€€€€€€€€€€€€€€€€€€€€ñ ÐùíÁÉ¥¥¹AÉ•Ù¥•ÝM…Ù•‘MÑ•ÁQ¥Ñ±•ôð½ Ðø(€€€€€€€€€€€€€€€€€€€€€€€€ð½‘¥Øø(€€€€€€€€€€€€€€€€€€€€€€ð½‘¥Øø((€€€€€€€€€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”õíÍÑå±•Ì¹É•Ù…±Õ•M…Ù•‘I•Á±…•µ•¹Ñ…É‘ôø(€€€€€€€€€€€€€€€€€€€€€€€€ñÍÁ…¸ùÕÉÉ•¹ÐÉ•Á±…•µ•¹ÐÁÉ¥”ð½ÍÁ…¸ø(€€€€€€€€€€€€€€€€€€€€€€€€ñÍÑÉ½¹œùíÁÉ¥¥¹AÉ•Ù¥•ÝM…Ù•‘I•Á±…•µ•¹ÑAÉ¥•áY…Ð€„ôô¹Õ±°€ü€‘íµ½¹•ä¡ÁÉ¥¥¹AÉ•Ù¥•ÝM…Ù•‘I•Á±…•µ•¹ÑAÉ¥•áY…Ð¥ô•á°¸YQ€€è€9¼Í…Ù•ÁÉ¥”ôð½ÍÑÉ½¹œø(€€€€€€€€€€€€€€€€€€€€€€€€ñÍµ…±°ùQ¡¥Ì¥ÌÑ¡”É•Á±…•µ•¹ÐÁÉ¥”ÕÉÉ•¹Ñ±äÍ…Ù•½¸Ñ¡¥Ì…ÍÍ•Ð¸ð½Íµ…±°ø(€€€€€€€€€€€€€€€€€€€€€€ð½‘¥Øø((€€€€€€€€€€€€€€€€€€€€€íÉ•¹‘•ÉI•Ù…±Õ•1¥™•Ñ¥µ•¥•±¡ÁÉ¥¥¹AÉ•Ù¥•Ü¹…ÍÍ•Ð¥ô(€€€€€€€€€€€€€€€€€€€€€íÉ•Ù…±Õ•‘Ù…¹•‘ÉÉ½È€ü€ñÀ±…ÍÍ9…µ”õíÍÑå±•Ì¹É•Ù…±Õ•I•Á±…•µ•¹ÑÉÉ½ÉôùíÉ•Ù…±Õ•‘Ù…¹•‘ÉÉ½Éôð½Àø€è¹Õ±±ô((€€€€€€€€€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”õíÍÑå±•Ì¹É•Ù…±Õ••¥Í¥½¹…É‘ôø(€€€€€€€€€€€€€€€€€€€€€€€€ñÍÑÉ½¹œù½¹Ñ¥¹Õ”Ý¥Ñ Ñ¡¥ÌÉ•Á±…•µ•¹ÐÁÉ¥”üð½ÍÑÉ½¹œø(€€€€€€€€€€€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”õíÍÑå±•Ì¹É•Ù…±Õ••¥Í¥½¹Ñ¥½¹Íôø(€€€€€€€€€€€€€€€€€€€€€€€€€€ñ‰ÕÑÑ½¸(€€€€€€€€€€€€€€€€€€€€€€€€€€€ÑåÁ”ô‰‰ÕÑÑ½¸ˆ(€€€€€€€€€€€€€€€€€€€€€€€€€€€±…ÍÍ9…µ”õíÍÑå±•Ì¹É•Ù…±Õ•ÕÍÑ½µI•Á±…•µ•¹Ñ	ÕÑÑ½¹ô(€€€€€€€€€€€€€€€€€€€€€€€€€€€‘¥Í…‰±•õíÁÉ¥¥¹AÉ•Ù¥•ÝM…Ù•‘I•Á±…•µ•¹ÑAÉ¥•áY…Ð€ôôô¹Õ±°ñð¥Í1½…‘¥¹AÉ¥¥¹AÉ•Ù¥•Üñð¥ÍM…Ù¥¹AÉ¥¥¹AÉ•Ù¥•Ýô(€€€€€€€€€€€€€€€€€€€€€€€€€€€½¹±¥¬õì ¤€ôø½Á•¹M…Ù•‘I•Á±…•µ•¹ÑAÉ•Ù¥•Ü¡ÁÉ¥¥¹AÉ•Ù¥•Ü¹…ÍÍ•Ð¥ô(€€€€€€€€€€€€€€€€€€€€€€€€€€ø(€€€€€€€€€€€€€€€€€€€€€€€€€€€UÍ”Ñ¡¥ÌÁÉ¥”(€€€€€€€€€€€€€€€€€€€€€€€€€€ð½‰ÕÑÑ½¸ø(€€€€€€€€€€€€€€€€€€€€€€€€€€ñ‰ÕÑÑ½¸(€€€€€€€€€€€€€€€€€€€€€€€€€€€ÑåÁ”ô‰‰ÕÑÑ½¸ˆ(€€€€€€€€€€€€€€€€€€€€€€€€€€€±…ÍÍ9…µ”õíÍÑå±•Ì¹É•Ù…±Õ•M•½¹‘…Éå	ÕÑÑ½¹ô(€€€€€€€€€€€€€€€€€€€€€€€€€€€‘¥Í…‰±•õí¥Í1½…‘¥¹AÉ¥¥¹AÉ•Ù¥•Üñð¥ÍM…Ù¥¹AÉ¥¥¹AÉ•Ù¥•Ýô(€€€€€€€€€€€€€€€€€€€€€€€€€€€½¹±¥¬õì ¤€ôøÍ¡½ÝÕÍÑ½µI•Á±…•µ•¹ÑMÑ•À¡ÁÉ¥¥¹AÉ•Ù¥•Ü¹…ÍÍ•Ð¥ô(€€€€€€€€€€€€€€€€€€€€€€€€€€ø(€€€€€€€€€€€€€€€€€€€€€€€€€€€¹Ñ•È‘¥™™•É•¹ÐÁÉ¥”(€€€€€€€€€€€€€€€€€€€€€€€€€€ð½‰ÕÑÑ½¸ø(€€€€€€€€€€€€€€€€€€€€€€€€ð½‘¥Øø(€€€€€€€€€€€€€€€€€€€€€€ð½‘¥Øø(€€€€€€€€€€€€€€€€€€€€ð½Í•Ñ¥½¸ø(€€€€€€€€€€€€€€€€€€¤€è¹Õ±±ô((€€€€€€€€€€€€€€€€€íÁÉ¥¥¹AÉ•Ù¥•Ý]¥é…É‘MÑ•À€ôôô€È€ü€ (€€€€€€€€€€€€€€€€€€€€ñÍ•Ñ¥½¸±…ÍÍ9…µ”õí€‘íÍÑå±•Ì¹É•Ù…±Õ•I•Á±…•µ•¹ÑA…¹•±ô€‘íÍÑå±•Ì¹É•Ù…±Õ•ÕÍÑ½µMÑ•ÁA…¹•±õôø(€€€€€€€€€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”õíÍÑå±•Ì¹É•Ù…±Õ•I•Á±…•µ•¹Ñ!•…‘•Éôø(€€€€€€€€€€€€€€€€€€€€€€€€ñ‘¥Øø(€€€€€€€€€€€€€€€€€€€€€€€€€€ñÍÁ…¸ùMÑ•À€È½˜€Ìð½ÍÁ…¸ø(€€€€€€€€€€€€€€€€€€€€€€€€€€ñ ÐùíÁÉ¥¥¹AÉ•Ù¥•ÝÕÍÑ½µMÑ•ÁQ¥Ñ±•ôð½ Ðø(€€€€€€€€€€€€€€€€€€€€€€€€€€ñÀ±…ÍÍ9…µ”õíÍÑå±•Ì¹É•Ù…±Õ•MÑ•Á½ÁåôùíÁÉ¥¥¹AÉ•Ù¥•ÝÕÍÑ½µMÑ•Á½Áåôð½Àø(€€€€€€€€€€€€€€€€€€€€€€€€ð½‘¥Øø(€€€€€€€€€€€€€€€€€€€€€€ð½‘¥Øø((€€€€€€€€€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”õíÍÑå±•Ì¹É•Ù…±Õ•ÕÍÑ½µI•Á±…•µ•¹Ñ…É‘ôø(€€€€€€€€€€€€€€€€€€€€€€€€ñ±…‰•°±…ÍÍ9…µ”õíÍÑå±•Ì¹É•Ù…±Õ•I•Á±…•µ•¹Ñ¥•±‘ôø(€€€€€€€€€€€€€€€€€€€€€€€€€€ñÍÁ…¸ùI•Á±…•µ•¹ÐÁÉ¥”•á°¸YPð½ÍÁ…¸ø(€€€€€€€€€€€€€€€€€€€€€€€€€€ñ¥¹ÁÕÐ(€€€€€€€€€€€€€€€€€€€€€€€€€€€ÑåÁ”ô‰Ñ•áÐˆ(€€€€€€€€€€€€€€€€€€€€€€€€€€€¥¹ÁÕÑ5½‘”ô‰¹Õµ•É¥Œˆ(€€€€€€€€€€€€€€€€€€€€€€€€€€€Ù…±Õ”õíÉ•Ù…±Õ•I•Á±…•µ•¹ÑAÉ¥•%¹ÁÕÑô(€€€€€€€€€€€€€€€€€€€€€€€€€€€½¹¡…¹”õí¡…¹‘±•I•Ù…±Õ•I•Á±…•µ•¹ÑAÉ¥•¡…¹•ô(€€€€€€€€€€€€€€€€€€€€€€€€€€€Á±…•¡½±‘•Èô‰á…µÁ±”è€ØÔÀ€ÀÀÀˆ(€€€€€€€€€€€€€€€€€€€€€€€€€€€‘¥Í…‰±•õí¥Í1½…‘¥¹AÉ¥¥¹AÉ•Ù¥•Üñð¥ÍM…Ù¥¹AÉ¥¥¹AÉ•Ù¥•Ýô(€€€€€€€€€€€€€€€€€€€€€€€€€€¼ø(€€€€€€€€€€€€€€€€€€€€€€€€ð½±…‰•°ø((€€€€€€€€€€€€€€€€€€€€€€€€ñ±…‰•°±…ÍÍ9…µ”õíÍÑå±•Ì¹É•Ù…±Õ•I•Á±…•µ•¹ÑQ½±•ôø(€€€€€€€€€€€€€€€€€€€€€€€€€€ñ¥¹ÁÕÐ(€€€€€€€€€€€€€€€€€€€€€€€€€€€ÑåÁ”ô‰¡•­‰½àˆ(€€€€€€€€€€€€€€€€€€€€€€€€€€€¡•­•õíÍ…Ù•I•Á±…•µ•¹ÑAÉ¥•]¥Ñ¡I•Ù…±Õ•ô(€€€€€€€€€€€€€€€€€€€€€€€€€€€½¹¡…¹”õì¡•Ù•¹Ð¤€ôøÍ•ÑM…Ù•I•Á±…•µ•¹ÑAÉ¥•]¥Ñ¡I•Ù…±Õ”¡•Ù•¹Ð¹Ñ…É•Ð¹¡•­•¥ô(€€€€€€€€€€€€€€€€€€€€€€€€€€€‘¥Í…‰±•õí¥Í1½…‘¥¹AÉ¥¥¹AÉ•Ù¥•Üñð¥ÍM…Ù¥¹AÉ¥¥¹AÉ•Ù¥•Ýô(€€€€€€€€€€€€€€€€€€€€€€€€€€¼ø(€€€€€€€€€€€€€€€€€€€€€€€€€€ñÍÁ…¸ùM…Ù”Ñ¡¥Ì…ÌÑ¡”É•Á±…•µ•¹ÐÁÉ¥”½¸Ñ¡¥Ì…ÍÍ•Ðð½ÍÁ…¸ø(€€€€€€€€€€€€€€€€€€€€€€€€ð½±…‰•°ø(€€€€€€€€€€€€€€€€€€€€€€€€ñÀ±…ÍÍ9…µ”õíÍÑå±•Ì¹É•Ù…±Õ•I•Á±…•µ•¹Ñ!•±Á•Éôù1•…Ù”Õ¹Ñ¥­•Ñ¼ÕÍ”Ñ¡¥ÌÁÉ¥”™½ÈÑ¡¥Ì…±Õ±…Ñ¥½¸½¹±ä¸ð½Àø(€€€€€€€€€€€€€€€€€€€€€€ð½‘¥Øø((€€€€€€€€€€€€€€€€€€€€€íÉ•¹‘•ÉI•Ù…±Õ•1¥™•Ñ¥µ•¥•±¡ÁÉ¥¥¹AÉ•Ù¥•Ü¹…ÍÍ•Ð¥ô((€€€€€€€€€€€€€€€€€€€€€íÉ•Ù…±Õ•I•Á±…•µ•¹ÑAÉ¥•ÉÉ½È€ü€ñÀ±…ÍÍ9…µ”õíÍÑå±•Ì¹É•Ù…±Õ•I•Á±…•µ•¹ÑÉÉ½ÉôùíÉ•Ù…±Õ•I•Á±…•µ•¹ÑAÉ¥•ÉÉ½Éôð½Àø€è¹Õ±±ô(€€€€€€€€€€€€€€€€€€€€€íÉ•Ù…±Õ•‘Ù…¹•‘ÉÉ½È€ü€ñÀ±…ÍÍ9…µ”õíÍÑå±•Ì¹É•Ù…±Õ•I•Á±…•µ•¹ÑÉÉ½ÉôùíÉ•Ù…±Õ•‘Ù…¹•‘ÉÉ½Éôð½Àø€è¹Õ±±ô(€€€€€€€€€€€€€€€€€€€€ð½Í•Ñ¥½¸ø(€€€€€€€€€€€€€€€€€€¤€è¹Õ±±ô((€€€€€€€€€€€€€€€€€íÁÉ¥¥¹AÉ•Ù¥•Ý]¥é…É‘MÑ•À€ôôô€Ì€ü€ (€€€€€€€€€€€€€€€€€€€¥Í1½…‘¥¹AÉ¥¥¹AÉ•Ù¥•Ü€ü€ (€€€€€€€€€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”õíÍÑå±•Ì¹ÁÉ¥¥¹AÉ•Ù¥•ÝMÑ…ÑÕÍôù…±Õ±…Ñ¥¹œ¹•ÜÙ…±Õ”¸¸¸ð½‘¥Øø(€€€€€€€€€€€€€€€€€€€€¤€èÁÉ¥¥¹AÉ•Ù¥•Ü¹•ÉÉ½È€ü€ (€€€€€€€€€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”õí€‘íÍÑå±•Ì¹ÁÉ¥¥¹AÉ•Ù¥•ÝMÑ…ÑÕÍô€‘íÍÑå±•Ì¹ÁÉ¥¥¹AÉ•Ù¥•ÝÉÉ½Éõôø(€€€€€€€€€€€€€€€€€€€€€€€€ñÍÑÉ½¹œùíÁÉ¥¥¹AÉ•Ù¥•ÝÉÉ½ÉQ¥Ñ±•ôð½ÍÑÉ½¹œø(€€€€€€€€€€€€€€€€€€€€€€€€ñÍÁ…¸ùíÁÉ¥¥¹AÉ•Ù¥•Ü¹•ÉÉ½Éôð½ÍÁ…¸ø(€€€€€€€€€€€€€€€€€€€€€€ð½‘¥Øø(€€€€€€€€€€€€€€€€€€€€¤€èÁÉ¥¥¹AÉ•Ù¥•Ü¹É•ÍÕ±Ðü¹¥Ñ•´€ü€ (€€€€€€€€€€€€€€€€€€€€€€ðø(€€€€€€€€€€€€€€€€€€€€€€€€ñÍ•Ñ¥½¸±…ÍÍ9…µ”õí€‘íÍÑå±•Ì¹É•Ù…±Õ•I•Á±…•µ•¹ÑA…¹•±ô€‘íÍÑå±•Ì¹É•Ù…±Õ•AÉ•Ù¥•ÝA…¹•±õô…É¥„µ±¥Ù”ô‰Á½±¥Ñ”ˆø(€€€€€€€€€€€€€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”õíÍÑå±•Ì¹É•Ù…±Õ•I•Á±…•µ•¹Ñ!•…‘•Éôø(€€€€€€€€€€€€€€€€€€€€€€€€€€€€ñ‘¥Øø(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€ñÍÁ…¸ùMÑ•À€Ì½˜€Ìð½ÍÁ…¸ø(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€ñ ÐùAÉ•Ù¥•Ü…¹Í…Ù”ð½ Ðø(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€ñÀ±…ÍÍ9…µ”õíÍÑå±•Ì¹É•Ù…±Õ•MÑ•Á½ÁåôùI•Ù¥•ÜÑ¡”¹•ÜÙ…±Õ”‰•™½É”Í…Ù¥¹œ¥ÐÑ¼Ñ¡”ÍÍ•ÐI•¥ÍÑ•È¸ð½Àø(€€€€€€€€€€€€€€€€€€€€€€€€€€€€ð½‘¥Øø(€€€€€€€€€€€€€€€€€€€€€€€€€€ð½‘¥Øø((€€€€€€€€€€€€€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”õíÍÑå±•Ì¹ÁÉ¥¥¹I•ÍÕ±Ñ!•É½ôø(€€€€€€€€€€€€€€€€€€€€€€€€€€€€ñÍÁ…¸ù9•Ü…ÍÍ•ÐÙ…±Õ”ð½ÍÁ…¸ø(€€€€€€€€€€€€€€€€€€€€€€€€€€€€ñÍÑÉ½¹œùíµ½¹•ä¡ÁÉ¥¥¹AÉ•Ù¥•Ý9•ÝY…±Õ•áY…Ð¥ôð½ÍÑÉ½¹œø(€€€€€€€€€€€€€€€€€€€€€€€€€€€€ñÀùQ¡¥Ì¥ÌÑ¡”Ù…±Õ”Ñ¡…ÐÝ¥±°‰”Í…Ù•Ñ¼Ñ¡”…ÍÍ•Ð¸ð½Àø(€€€€€€€€€€€€€€€€€€€€€€€€€€ð½‘¥Øø((€€€€€€€€€€€€€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”õíÍÑå±•Ì¹ÁÉ¥¥¹½µÁ…É•É¥‘ôø(€€€€€€€€€€€€€€€€€€€€€€€€€€€€ñ‘¥Øø(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€ñÍÁ…¸ùÕÉÉ•¹ÐÙ…±Õ”ð½ÍÁ…¸ø(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€ñÍÑÉ½¹œùíµ½¹•ä¡ÁÉ¥¥¹AÉ•Ù¥•Ý=±‘Y…±Õ•áY…Ð¥ôð½ÍÑÉ½¹œø(€€€€€€€€€€€€€€€€€€€€€€€€€€€€ð½‘¥Øø(€€€€€€€€€€€€€€€€€€€€€€€€€€€€ñ‘¥Øø(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€ñÍÁ…¸ù9•ÜÙ…±Õ”ð½ÍÁ…¸ø(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€ñÍÑÉ½¹œùíµ½¹•ä¡ÁÉ¥¥¹AÉ•Ù¥•Ý9•ÝY…±Õ•áY…Ð¥ôð½ÍÑÉ½¹œø(€€€€€€€€€€€€€€€€€€€€€€€€€€€€ð½‘¥Øø(€€€€€€€€€€€€€€€€€€€€€€€€€€€€ñ‘¥Øø(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€ñÍÁ…¸ù¥™™•É•¹”ð½ÍÁ…¸ø(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€ñÍÑÉ½¹œùí™½Éµ…Ñ5½¹•å¥™™•É•¹”¡ÁÉ¥¥¹AÉ•Ù¥•Ý¥™™•É•¹•áY…Ð¥ôð½ÍÑÉ½¹œø(€€€€€€€€€€€€€€€€€€€€€€€€€€€€ð½‘¥Øø(€€€€€€€€€€€€€€€€€€€€€€€€€€ð½‘¥Øø((€€€€€€€€€€€€€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”õíÍÑå±•Ì¹É•Ù…±Õ•I•Á±…•µ•¹ÑMÕµµ…Éåôø(€€€€€€€€€€€€€€€€€€€€€€€€€€€€ñ‘¥Øø(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€ñÍÁ…¸ùI•Á±…•µ•¹ÐÁÉ¥”ÕÍ•èð½ÍÁ…¸ø(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€ñÍÑÉ½¹œùíÁÉ¥¥¹AÉ•Ù¥•ÝI•Á±…•µ•¹ÑAÉ¥•áY…Ð€„ôô¹Õ±°€üµ½¹•ä¡ÁÉ¥¥¹AÉ•Ù¥•ÝI•Á±…•µ•¹ÑAÉ¥•áY…Ð¤€è€9½ÐÍ•Ðôð½ÍÑÉ½¹œø(€€€€€€€€€€€€€€€€€€€€€€€€€€€€ð½‘¥Øø(€€€€€€€€€€€€€€€€€€€€€€€€€€€€ñ‘¥Øø(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€ñÍÁ…¸ùI•Á±…•µ•¹ÐÁÉ¥”…Ñ¥½¸èð½ÍÁ…¸ø(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€ñÍÑÉ½¹œùíÁÉ¥¥¹AÉ•Ù¥•ÝI•Á±…•µ•¹ÑÑ¥½¹1…‰•±ôð½ÍÑÉ½¹œø(€€€€€€€€€€€€€€€€€€€€€€€€€€€€ð½‘¥Øø(€€€€€€€€€€€€€€€€€€€€€€€€€€€ì…ÁÉ¥¥¹AÉ•Ù¥•ÝUÍ•ÍA•É•¹ÑUÍ…”€ü€ (€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€ñ‘¥Øø(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€ñÍÁ…¸ùáÁ•Ñ•±¥™•Ñ¥µ”ÕÍ•èð½ÍÁ…¸ø(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€ñÍÑÉ½¹œùíÁÉ¥¥¹AÉ•Ù¥•Ý1¥™•Ñ¥µ•Y…±Õ”€„ôô¹Õ±°€ü€‘í™½Éµ…ÑA±…¥¹9Õµ‰•È¡ÁÉ¥¥¹AÉ•Ù¥•Ý1¥™•Ñ¥µ•Y…±Õ”¥ô€‘íÁÉ¥¥¹AÉ•Ù¥•Ý1¥™•Ñ¥µ•M¡½ÉÑU¹¥Ñõ€€è€9½ÐÍ•Ðôð½ÍÑÉ½¹œø(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€ð½‘¥Øø(€€€€€€€€€€€€€€€€€€€€€€€€€€€€¤€è¹Õ±±ô(€€€€€€€€€€€€€€€€€€€€€€€€€€ð½‘¥Øø(€€€€€€€€€€€€€€€€€€€€€€€€ð½Í•Ñ¥½¸ø((€€€€€€€€€€€€€€€€€€€€€€€íÁÉ¥¥¹AÉ•Ù¥•Ü¹É•ÍÕ±Ð¹Ý…É¹¥¹œ€ü€ (€€€€€€€€€€€€€€€€€€€€€€€€€€ñÀ±…ÍÍ9…µ”õíÍÑå±•Ì¹ÁÉ¥¥¹AÉ•Ù¥•Ý]…É¹¥¹ôùíÁÉ¥¥¹AÉ•Ù¥•Ü¹É•ÍÕ±Ð¹Ý…É¹¥¹ôð½Àø(€€€€€€€€€€€€€€€€€€€€€€€€¤€è¹Õ±±ô((€€€€€€€€€€€€€€€€€€€€€€€íÁÉ¥¥¹AÉ•Ù¥•Ý!…ÍU¹ÁÉ•Ù¥•Ý•‘I•Á±…•µ•¹Ñ%¹ÁÕÐ€ü€ (€€€€€€€€€€€€€€€€€€€€€€€€€€ñÀ±…ÍÍ9…µ”õíÍÑå±•Ì¹É•Ù…±Õ•I•Á±…•µ•¹Ñ9½Ñ¥•ôù…±Õ±…Ñ”Ñ¡”¡…¹•É•Á±…•µ•¹ÐÁÉ¥”‰•™½É”Í…Ù¥¹œ¸ð½Àø(€€€€€€€€€€€€€€€€€€€€€€€€¤€è¹Õ±±ô(€€€€€€€€€€€€€€€€€€€€€€ð¼ø(€€€€€€€€€€€€€€€€€€€€¤€è¹Õ±°(€€€€€€€€€€€€€€€€€€¤€è¹Õ±±ô(€€€€€€€€€€€€€€€€ð¼ø(€€€€€€€€€€€€ð½‘¥Øø((€€€€€€€€€€€€ñ‘¥Ø(€€€€€€€€€€€€€±…ÍÍ9…µ”õí€‘íÍÑå±•Ì¹ÁÉ¥¥¹AÉ•Ù¥•ÝÑ¥½¹Íô€‘ì(€€€€€€€€€€€€€€€ÁÉ¥¥¹AÉ•Ù¥•Ü¹µ•Ñ¡½€ôôô€…¥´ÑÁÉ¥”œ€˜˜ÁÉ¥¥¹AÉ•Ù¥•Ý]¥é…É‘MÑ•À€ôôô€Ä€üÍÑå±•Ì¹ÁÉ¥¥¹AÉ•Ù¥•ÝÑ¥½¹ÍM¥¹±”€è€œœ(€€€€€€€€€€€€€õô(€€€€€€€€€€€€ø(€€€€€€€€€€€€€íÁÉ¥¥¹AÉ•Ù¥•Ü¹µ•Ñ¡½€ôôô€…¥´ÑÁÉ¥”œ€˜˜ÁÉ¥¥¹AÉ•Ù¥•Ý]¥é…É‘MÑ•À€ôôô€Ä€ü€ (€€€€€€€€€€€€€€€€ñ‰ÕÑÑ½¸ÑåÁ”ô‰‰ÕÑÑ½¸ˆ±…ÍÍ9…µ”õíÍÑå±•Ì¹Í•½¹‘…Éå	ÕÑÑ½¹ô½¹±¥¬õí±½Í•AÉ¥¥¹AÉ•Ù¥•Ý¥…±½ô‘¥Í…‰±•õí¥ÍM…Ù¥¹AÉ¥¥¹AÉ•Ù¥•Ýôø(€€€€€€€€€€€€€€€€€-••ÀÕÉÉ•¹ÐÙ…±Õ”(€€€€€€€€€€€€€€€€ð½‰ÕÑÑ½¸ø(€€€€€€€€€€€€€€¤€èÁÉ¥¥¹AÉ•Ù¥•Ü¹µ•Ñ¡½€ôôô€…¥´ÑÁÉ¥”œ€˜˜ÁÉ¥¥¹AÉ•Ù¥•Ý]¥é…É‘MÑ•À€ôôô€È€ü€ (€€€€€€€€€€€€€€€€ðø(€€€€€€€€€€€€€€€€€€ñ‰ÕÑÑ½¸ÑåÁ”ô‰‰ÕÑÑ½¸ˆ±…ÍÍ9…µ”õíÍÑå±•Ì¹Í•½¹‘…Éå	ÕÑÑ½¹ô½¹±¥¬õí¡…¹‘±•AÉ•Ù¥½ÕÍI•Ù…±Õ•MÑ•Áô‘¥Í…‰±•õí¥Í1½…‘¥¹AÉ¥¥¹AÉ•Ù¥•Üñð¥ÍM…Ù¥¹AÉ¥¥¹AÉ•Ù¥•Ýôø(€€€€€€€€€€€€€€€€€€€	…¬(€€€€€€€€€€€€€€€€€€ð½‰ÕÑÑ½¸ø(€€€€€€€€€€€€€€€€€€ñ‰ÕÑÑ½¸(€€€€€€€€€€€€€€€€€€€ÑåÁ”ô‰‰ÕÑÑ½¸ˆ(€€€€€€€€€€€€€€€€€€€±…ÍÍ9…µ”õíÍÑå±•Ì¹ÁÉ¥µ…Éå	ÕÑÑ½¹ô(€€€€€€€€€€€€€€€€€€€½¹±¥¬õì ¤€ôø½Á•¹ÕÍÑ½µI•Á±…•µ•¹ÑAÉ•Ù¥•Ü¡ÁÉ¥¥¹AÉ•Ù¥•Ü¹…ÍÍ•Ð¥ô(€€€€€€€€€€€€€€€€€€€‘¥Í…‰±•õì……¹…±Õ±…Ñ•ÕÍÑ½µI•Á±…•µ•¹ÑAÉ•Ù¥•Ýô(€€€€€€€€€€€€€€€€€€ø(€€€€€€€€€€€€€€€€€€€…±Õ±…Ñ”¹•ÜÙ…±Õ”(€€€€€€€€€€€€€€€€€€ð½‰ÕÑÑ½¸ø(€€€€€€€€€€€€€€€€ð¼ø(€€€€€€€€€€€€€€¤€èÁÉ¥¥¹AÉ•Ù¥•Ü¹µ•Ñ¡½€ôôô€…¥´ÑÁÉ¥”œ€˜˜ÁÉ¥¥¹AÉ•Ù¥•Ý]¥é…É‘MÑ•À€ôôô€Ì€ü€ (€€€€€€€€€€€€€€€€ðø(€€€€€€€€€€€€€€€€€€ñ‰ÕÑÑ½¸ÑåÁ”ô‰‰ÕÑÑ½¸ˆ±…ÍÍ9…µ”õíÍÑå±•Ì¹Í•½¹‘…Éå	ÕÑÑ½¹ô½¹±¥¬õí¡…¹‘±•AÉ•Ù¥½ÕÍI•Ù…±Õ•MÑ•Áô‘¥Í…‰±•õí¥Í1½…‘¥¹AÉ¥¥¹AÉ•Ù¥•Üñð¥ÍM…Ù¥¹AÉ¥¥¹AÉ•Ù¥•Ýôø(€€€€€€€€€€€€€€€€€€€	…¬(€€€€€€€€€€€€€€€€€€ð½‰ÕÑÑ½¸ø(€€€€€€€€€€€€€€€€€€ñ‰ÕÑÑ½¸(€€€€€€€€€€€€€€€€€€€ÑåÁ”ô‰‰ÕÑÑ½¸ˆ(€€€€€€€€€€€€€€€€€€€±…ÍÍ9…µ”õíÍÑå±•Ì¹ÁÉ¥µ…Éå	ÕÑÑ½¹ô(€€€€€€€€€€€€€€€€€€€½¹±¥¬õì ¤€ôøÙ½¥¡…¹‘±•M…Ù•AÉ¥¥¹AÉ•Ù¥•Ü ¥ô(€€€€€€€€€€€€€€€€€€€‘¥Í…‰±•õì……¹M…Ù•AÉ¥¥¹AÉ•Ù¥•Ýô(€€€€€€€€€€€€€€€€€€ø(€€€€€€€€€€€€€€€€€€€í¥ÍM…Ù¥¹AÉ¥¥¹AÉ•Ù¥•Ü€ü€M…Ù¥¹œ¸¸¸œ€èÁÉ¥¥¹AÉ•Ù¥•ÝM¡½Õ±‘M…Ù•I•Á±…•µ•¹Ð€ü€M…Ù”Ù…±Õ”…¹É•Á±…•µ•¹ÐÁÉ¥”œ€è€M…Ù”¹•ÜÙ…±Õ”ô(€€€€€€€€€€€€€€€€€€ð½‰ÕÑÑ½¸ø(€€€€€€€€€€€€€€€€ð¼ø(€€€€€€€€€€€€€€¤€è€ (€€€€€€€€€€€€€€€€ðø(€€€€€€€€€€€€€€€€€€ñ‰ÕÑÑ½¸ÑåÁ”ô‰‰ÕÑÑ½¸ˆ±…ÍÍ9…µ”õíÍÑå±•Ì¹Í•½¹‘…Éå	ÕÑÑ½¹ô½¹±¥¬õí±½Í•AÉ¥¥¹AÉ•Ù¥•Ý¥…±½ô‘¥Í…‰±•õí¥ÍM…Ù¥¹AÉ¥¥¹AÉ•Ù¥•Ýôø(€€€€€€€€€€€€€€€€€€€-••ÀÕÉÉ•¹ÐÙ…±Õ”(€€€€€€€€€€€€€€€€€€ð½‰ÕÑÑ½¸ø(€€€€€€€€€€€€€€€€€€ñ‰ÕÑÑ½¸(€€€€€€€€€€€€€€€€€€€ÑåÁ”ô‰‰ÕÑÑ½¸ˆ(€€€€€€€€€€€€€€€€€€€±…ÍÍ9…µ”õíÍÑå±•Ì¹ÁÉ¥µ…Éå	ÕÑÑ½¹ô(€€€€€€€€€€€€€€€€€€€½¹±¥¬õì ¤€ôøÙ½¥¡…¹‘±•M…Ù•AÉ¥¥¹AÉ•Ù¥•Ü ¥ô(€€€€€€€€€€€€€€€€€€€‘¥Í…‰±•õì……¹M…Ù•AÉ¥¥¹AÉ•Ù¥•Ýô(€€€€€€€€€€€€€€€€€€ø(€€€€€€€€€€€€€€€€€€€í¥ÍM…Ù¥¹AÉ¥¥¹AÉ•Ù¥•Ü€ü€M…Ù¥¹œ¸¸¸œ€è€M…Ù”¹•ÜÙ…±Õ”ô(€€€€€€€€€€€€€€€€€€ð½‰ÕÑÑ½¸ø(€€€€€€€€€€€€€€€€ð¼ø(€€€€€€€€€€€€€€¥ô(€€€€€€€€€€€€ð½‘¥Øø(€€€€€€€€€€ð½‘¥Øø(€€€€€€€€ð½‘¥Øø(€€€€€€¤€è¹Õ±±ô((€€€€€í…Ñ¥Ù•ÍÍ•Ð€˜˜¥ÍÍÍ•ÑI•Á½ÉÑ5½‘…±=Á•¸€ü€ (€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”õí€‘íÍÑå±•Ì¹µ½‘…±=Ù•É±…åô€‘íÍÑå±•Ì¹ÍÕ‰5½‘…±=Ù•É±…åõôø(€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”õíÍÑå±•Ì¹µ½‘…±	…­‘É½Áô½¹±¥¬õí±½Í•ÍÍ•ÑI•Á½ÉÑ¥…±½ô€¼ø((€€€€€€€€€€ñ‘¥Ø(€€€€€€€€€€€±…ÍÍ9…µ”õí€‘íÍÑå±•Ì¹µ½‘…±…É‘ô€‘íÍÑå±•Ì¹…ÍÍ•ÑI•Á½ÉÑ5½‘…±ô€‘í…ÍÍ•ÑI•Á½ÉÑMÑ•À€„ôô€½ÁÑ¥½¹Ìœ€üÍÑå±•Ì¹…ÍÍ•ÑÕ•±I•Á½ÉÑ5½‘…°€è€œõô(€€€€€€€€€€€É½±”ô‰‘¥…±½œˆ(€€€€€€€€€€€…É¥„µµ½‘…°ô‰ÑÉÕ”ˆ(€€€€€€€€€€€…É¥„µ±…‰•±±•‘‰äô‰…ÍÍ•ÐµÉ•Á½ÉÐµÑ¥Ñ±”ˆ(€€€€€€€€€€ø(€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”õí€‘íÍÑå±•Ì¹µ½‘…±!•…‘•Éô€‘íÍÑå±•Ì¹…ÍÍ•ÑI•Á½ÉÑ5½‘…±!•…‘•Éõôø(€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”õíÍÑå±•Ì¹µ½‘…±!•…‘•ÉQ•áÑôø(€€€€€€€€€€€€€€€€ñ Ì¥ô‰…ÍÍ•ÐµÉ•Á½ÉÐµÑ¥Ñ±”ˆùí…Ñ¥Ù•ÍÍ•Ð¹Ñ¥Ñ±•ôð½ Ìø(€€€€€€€€€€€€€€€€ñÀùí‰Õ¥±‘ÍÍ•Ñ5•Ñ„¡…Ñ¥Ù•ÍÍ•Ð¥ôð½Àø(€€€€€€€€€€€€€€ð½‘¥Øø((€€€€€€€€€€€€€€ñ‰ÕÑÑ½¸ÑåÁ”ô‰‰ÕÑÑ½¸ˆ±…ÍÍ9…µ”õíÍÑå±•Ì¹µ½‘…±±½Í•	ÕÑÑ½¹ô½¹±¥¬õí±½Í•ÍÍ•ÑI•Á½ÉÑ¥…±½ô…É¥„µ±…‰•°ô‰±½Í”É•Á½ÉÐ½ÁÑ¥½¹Ìˆø(€€€€€€€€€€€€€€€€ñ±½Í•%½¸±…ÍÍ9…µ”õíÍÑå±•Ì¹‰ÕÑÑ½¹%½¹ô€¼ø(€€€€€€€€€€€€€€ð½‰ÕÑÑ½¸ø(€€€€€€€€€€€€ð½‘¥Øø((€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”õí€‘íÍÑå±•Ì¹µ½‘…±MÉ½±±	½‘åô€‘íÍÑå±•Ì¹…ÍÍ•ÑI•Á½ÉÑ5½‘…±	½‘åõôø(€€€€€€€€€€€€€í…ÍÍ•ÑI•Á½ÉÑMÑ•À¹•¹‘Í]¥Ñ  œµ™½Éµ…Ðœ¤€ü€ (€€€€€€€€€€€€€€€€ðø(€€€€€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”õíÍÑå±•Ì¹…ÍÍ•ÑQ¥µ•±¥¹•MÑ…•!•…‘¥¹ôø(€€€€€€€€€€€€€€€€€€€€ñÍÑÉ½¹œù¡½½Í”•áÁ½ÉÐ™½Éµ…Ðð½ÍÑÉ½¹œø(€€€€€€€€€€€€€€€€€€€€ñÍÁ…¸ùM•±•ÐA½Èá•°°Ñ¡•¸½¹Ñ¥¹Õ”Ñ¼Ñ¡”É•Á½ÉÐÑ¥µ•±¥¹”¸ð½ÍÁ…¸ø(€€€€€€€€€€€€€€€€€€ð½‘¥Øø((€€€€€€€€€€€€€€€€€€ñÍÍ•ÑI•Á½ÉÑ½Éµ…ÑA¥­•ÈÙ…±Õ”õí…ÍÍ•ÑI•Á½ÉÑ½Ý¹±½…‘½Éµ…Ñô½¹¡…¹”õíÍ•ÑÍÍ•ÑI•Á½ÉÑ½Ý¹±½…‘½Éµ…Ñô€¼ø((€€€€€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”õí€‘íÍÑå±•Ì¹™½ÉµÑ¥½¹Íô€‘íÍÑå±•Ì¹•áÁ½ÉÑÑ¥½¹Íô€‘íÍÑå±•Ì¹…ÍÍ•ÑÕ•±I•Á½ÉÑÑ¥½¹Íõôø(€€€€€€€€€€€€€€€€€€€€ñ‰ÕÑÑ½¸ÑåÁ”ô‰‰ÕÑÑ½¸ˆ±…ÍÍ9…µ”õí€‘íÍÑå±•Ì¹Í•½¹‘…Éå	ÕÑÑ½¹ô€‘íÍÑå±•Ì¹…ÍÍ•ÑQ¥µ•±¥¹•M•½¹‘…Éå	ÕÑÑ½¹õô½¹±¥¬õí‰…­Q½ÍÍ•ÑI•Á½ÉÑ=ÁÑ¥½¹Íôù	…¬ð½‰ÕÑÑ½¸ø(€€€€€€€€€€€€€€€€€€€€ñ‰ÕÑÑ½¸(€€€€€€€€€€€€€€€€€€€€€ÑåÁ”ô‰‰ÕÑÑ½¸ˆ(€€€€€€€€€€€€€€€€€€€€€±…ÍÍ9…µ”õí€‘íÍÑå±•Ì¹Í•½¹‘…Éå	ÕÑÑ½¹ô€‘íÍÑå±•Ì¹…ÍÍ•ÑQ¥µ•±¥¹•M•½¹‘…Éå	ÕÑÑ½¹õô(€€€€€€€€€€€€€€€€€€€€€½¹±¥¬õí±½Í•ÍÍ•ÑI•Á½ÉÑ¥…±½ô(€€€€€€€€€€€€€€€€€€€€ø(€€€€€€€€€€€€€€€€€€€€€…¹•°(€€€€€€€€€€€€€€€€€€€€ð½‰ÕÑÑ½¸ø(€€€€€€€€€€€€€€€€€€€€ñ‰ÕÑÑ½¸ÑåÁ”ô‰‰ÕÑÑ½¸ˆ±…ÍÍ9…µ”õíÍÑå±•Ì¹ÁÉ¥µ…Éå	ÕÑÑ½¹ô½¹±¥¬õíÍ¡½ÝÍÍ•ÑI•Á½ÉÑQ¥µ•±¥¹•MÑ•Áôø(€€€€€€€€€€€€€€€€€€€€€€ñÍÁ…¸ù9•áÐð½ÍÁ…¸ø(€€€€€€€€€€€€€€€€€€€€ð½‰ÕÑÑ½¸ø(€€€€€€€€€€€€€€€€€€ð½‘¥Øø(€€€€€€€€€€€€€€€€ð¼ø(€€€€€€€€€€€€€€¤€è…ÍÍ•ÑI•Á½ÉÑMÑ•À€ôôô€™Õ•°µ™¥±Ñ•Èœ€ü€ (€€€€€€€€€€€€€€€€ðø(€€€€€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”õíÍÑå±•Ì¹…ÍÍ•ÑQ¥µ•±¥¹•MÑ…•!•…‘¥¹ôø(€€€€€€€€€€€€€€€€€€€€ñÍÑÉ½¹œùI•Á½ÉÐÑ¥µ•±¥¹”ð½ÍÑÉ½¹œø(€€€€€€€€€€€€€€€€€€€€ñÍÁ…¸ù¡½½Í”Ñ¡”å•…È…¹µ½¹Ñ Ñ¼¥¹±Õ‘”¸ð½ÍÁ…¸ø(€€€€€€€€€€€€€€€€€€ð½‘¥Øø((€€€€€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”õíÍÑå±•Ì¹…ÍÍ•ÑÕ•±I•Á½ÉÑ¥±Ñ•É	½áôø(€€€€€€€€€€€€€€€€€€€€ñI•Á½ÉÑM•±•Ð(€€€€€€€€€€€€€€€€€€€€€±…‰•°ô‰e•…Èˆ(€€€€€€€€€€€€€€€€€€€€€Ù…±Õ”õí…ÍÍ•ÑÕ•±I•Á½ÉÑe•…Éô(€€€€€€€€€€€€€€€€€€€€€½ÁÑ¥½¹Ìõí…ÍÍ•ÑI•Á½ÉÑe•…É=ÁÑ¥½¹Íô(€€€€€€€€€€€€€€€€€€€€€¥Í=Á•¸õí½Á•¹ÍÍ•ÑI•Á½ÉÑM•±•Ð€ôôô€å•…Èô(€€€€€€€€€€€€€€€€€€€€€½¹Q½±”õì ¤€ôøÑ½±•ÍÍ•ÑI•Á½ÉÑM•±•Ð å•…Èœ¥ô(€€€€€€€€€€€€€€€€€€€€€½¹¡…¹”õíÍ•±•ÑÍÍ•ÑÕ•±I•Á½ÉÑe•…Éô(€€€€€€€€€€€€€€€€€€€€¼ø((€€€€€€€€€€€€€€€€€€€€ñI•Á½ÉÑM•±•Ð(€€€€€€€€€€€€€€€€€€€€€±…‰•°ô‰5½¹Ñ ˆ(€€€€€€€€€€€€€€€€€€€€€Ù…±Õ”õí…ÍÍ•ÑÕ•±I•Á½ÉÑ5½¹Ñ¡ô(€€€€€€€€€€€€€€€€€€€€€½ÁÑ¥½¹Ìõí…ÍÍ•ÑI•Á½ÉÑ5½¹Ñ¡=ÁÑ¥½¹Íô(€€€€€€€€€€€€€€€€€€€€€¥Í=Á•¸õí½Á•¹ÍÍ•ÑI•Á½ÉÑM•±•Ð€ôôô€µ½¹Ñ ô(€€€€€€€€€€€€€€€€€€€€€‘¥Í…‰±•õí…ÍÍ•ÑÕ•±I•Á½ÉÑe•…È€ôôô€…±°ô(€€€€€€€€€€€€€€€€€€€€€½¹Q½±”õì ¤€ôøÑ½±•ÍÍ•ÑI•Á½ÉÑM•±•Ð µ½¹Ñ œ¥ô(€€€€€€€€€€€€€€€€€€€€€½¹¡…¹”õíÍ•±•ÑÍÍ•ÑÕ•±I•Á½ÉÑ5½¹Ñ¡ô(€€€€€€€€€€€€€€€€€€€€¼ø(€€€€€€€€€€€€€€€€€€ð½‘¥Øø((€€€€€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”õí€‘íÍÑå±•Ì¹™½ÉµÑ¥½¹Íô€‘íÍÑå±•Ì¹•áÁ½ÉÑÑ¥½¹Íô€‘íÍÑå±•Ì¹…ÍÍ•ÑÕ•±I•Á½ÉÑÑ¥½¹Íõôø(€€€€€€€€€€€€€€€€€€€€ñ‰ÕÑÑ½¸ÑåÁ”ô‰‰ÕÑÑ½¸ˆ±…ÍÍ9…µ”õí€‘íÍÑå±•Ì¹Í•½¹‘…Éå	ÕÑÑ½¹ô€‘íÍÑå±•Ì¹…ÍÍ•ÑQ¥µ•±¥¹•M•½¹‘…Éå	ÕÑÑ½¹õô½¹±¥¬õí‰…­Q½ÍÍ•ÑI•Á½ÉÑ½Éµ…ÑMÑ•Áôù	…¬ð½‰ÕÑÑ½¸ø(€€€€€€€€€€€€€€€€€€€€ñ‰ÕÑÑ½¸(€€€€€€€€€€€€€€€€€€€€€ÑåÁ”ô‰‰ÕÑÑ½¸ˆ(€€€€€€€€€€€€€€€€€€€€€±…ÍÍ9…µ”õí€‘íÍÑå±•Ì¹Í•½¹‘…Éå	ÕÑÑ½¹ô€‘íÍÑå±•Ì¹…ÍÍ•ÑQ¥µ•±¥¹•M•½¹‘…Éå	ÕÑÑ½¹õô(€€€€€€€€€€€€€€€€€€€€€½¹±¥¬õí±½Í•ÍÍ•ÑI•Á½ÉÑ¥…±½ô(€€€€€€€€€€€€€€€€€€€€ø(€€€€€€€€€€€€€€€€€€€€€…¹•°(€€€€€€€€€€€€€€€€€€€€ð½‰ÕÑÑ½¸ø(€€€€€€€€€€€€€€€€€€€€ñ‰ÕÑÑ½¸(€€€€€€€€€€€€€€€€€€€€€ÑåÁ”ô‰‰ÕÑÑ½¸ˆ(€€€€€€€€€€€€€€€€€€€€€±…ÍÍ9…µ”õíÍÑå±•Ì¹ÁÉ¥µ…Éå	ÕÑÑ½¹ô(€€€€€€€€€€€€€€€€€€€€€½¹±¥¬õì ¤€ôøÙ½¥¡…¹‘±•½Ý¹±½…‘¥±Ñ•É•‘Õ•±I•Á½ÉÐ¡…Ñ¥Ù•ÍÍ•Ð°…ÍÍ•ÑI•Á½ÉÑ½Ý¹±½…‘½Éµ…Ð¥ô(€€€€€€€€€€€€€€€€€€€€ø(€€€€€€€€€€€€€€€€€€€€€€ñ½Ý¹±½…‘%½¸±…ÍÍ9…µ”õíÍÑå±•Ì¹‰ÕÑÑ½¹%½¹ô€¼ø(€€€€€€€€€€€€€€€€€€€€€€ñÍÁ…¸ùí…ÍÍ•ÑI•Á½ÉÑ½Ý¹±½…‘½Éµ…Ð€ôôô€Á‘˜œ€ü€=Á•¸AÉ•Á½ÉÐœ€è€½Ý¹±½…á•°ôð½ÍÁ…¸ø(€€€€€€€€€€€€€€€€€€€€ð½‰ÕÑÑ½¸ø(€€€€€€€€€€€€€€€€€€ð½‘¥Øø(€€€€€€€€€€€€€€€€ð¼ø(€€€€€€€€€€€€€€¤€è…ÍÍ•ÑI•Á½ÉÑMÑ•À€ôôô€µ…¥¹Ñ•¹…¹”µ™¥±Ñ•Èœ€ü€ (€€€€€€€€€€€€€€€€ðø(€€€€€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”õíÍÑå±•Ì¹…ÍÍ•ÑQ¥µ•±¥¹•MÑ…•!•…‘¥¹ôø(€€€€€€€€€€€€€€€€€€€€ñÍÑÉ½¹œùI•Á½ÉÐÑ¥µ•±¥¹”ð½ÍÑÉ½¹œø(€€€€€€€€€€€€€€€€€€€€ñÍÁ…¸ù¡½½Í”Ñ¡”µ…¥¹Ñ•¹…¹”ÑåÁ”°å•…È…¹µ½¹Ñ Ñ¼¥¹±Õ‘”¸ð½ÍÁ…¸ø(€€€€€€€€€€€€€€€€€€ð½‘¥Øø((€€€€€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”õí€‘íÍÑå±•Ì¹…ÍÍ•ÑÕ•±I•Á½ÉÑ¥±Ñ•É	½áô€‘íÍÑå±•Ì¹…ÍÍ•Ñ5…¥¹Ñ•¹…¹•I•Á½ÉÑ¥±Ñ•É	½áõôø(€€€€€€€€€€€€€€€€€€€€ñI•Á½ÉÑM•±•Ð(€€€€€€€€€€€€€€€€€€€€€±…‰•°ô‰QåÁ”ˆ(€€€€€€€€€€€€€€€€€€€€€Ù…±Õ”õí…ÍÍ•Ñ5…¥¹Ñ•¹…¹•I•Á½ÉÑQåÁ•ô(€€€€€€€€€€€€€€€€€€€€€½ÁÑ¥½¹Ìõí…ÍÍ•Ñ5…¥¹Ñ•¹…¹•I•Á½ÉÑQåÁ•=ÁÑ¥½¹Íô(€€€€€€€€€€€€€€€€€€€€€¥Í=Á•¸õí½Á•¹ÍÍ•ÑI•Á½ÉÑM•±•Ð€ôôô€ÑåÁ”ô(€€€€€€€€€€€€€€€€€€€€€½¹Q½±”õì ¤€ôøÑ½±•ÍÍ•ÑI•Á½ÉÑM•±•Ð ÑåÁ”œ¥ô(€€€€€€€€€€€€€€€€€€€€€½¹¡…¹”õíÍ•±•ÑÍÍ•Ñ5…¥¹Ñ•¹…¹•I•Á½ÉÑQåÁ•ô(€€€€€€€€€€€€€€€€€€€€¼ø((€€€€€€€€€€€€€€€€€€€€ñI•Á½ÉÑM•±•Ð(€€€€€€€€€€€€€€€€€€€€€±…‰•°ô‰e•…Èˆ(€€€€€€€€€€€€€€€€€€€€€Ù…±Õ”õí…ÍÍ•Ñ5…¥¹Ñ•¹…¹•I•Á½ÉÑe•…Éô(€€€€€€€€€€€€€€€€€€€€€½ÁÑ¥½¹Ìõí…ÍÍ•ÑI•Á½ÉÑe•…É=ÁÑ¥½¹Íô(€€€€€€€€€€€€€€€€€€€€€¥Í=Á•¸õí½Á•¹ÍÍ•ÑI•Á½ÉÑM•±•Ð€ôôô€å•…Èô(€€€€€€€€€€€€€€€€€€€€€½¹Q½±”õì ¤€ôøÑ½±•ÍÍ•ÑI•Á½ÉÑM•±•Ð å•…Èœ¥ô(€€€€€€€€€€€€€€€€€€€€€½¹¡…¹”õíÍ•±•ÑÍÍ•Ñ5…¥¹Ñ•¹…¹•I•Á½ÉÑe•…Éô(€€€€€€€€€€€€€€€€€€€€¼ø((€€€€€€€€€€€€€€€€€€€€ñI•Á½ÉÑM•±•Ð(€€€€€€€€€€€€€€€€€€€€€±…‰•°ô‰5½¹Ñ ˆ(€€€€€€€€€€€€€€€€€€€€€Ù…±Õ”õí…ÍÍ•Ñ5…¥¹Ñ•¹…¹•I•Á½ÉÑ5½¹Ñ¡ô(€€€€€€€€€€€€€€€€€€€€€½ÁÑ¥½¹Ìõí…ÍÍ•ÑI•Á½ÉÑ5½¹Ñ¡=ÁÑ¥½¹Íô(€€€€€€€€€€€€€€€€€€€€€¥Í=Á•¸õí½Á•¹ÍÍ•ÑI•Á½ÉÑM•±•Ð€ôôô€µ½¹Ñ ô(€€€€€€€€€€€€€€€€€€€€€‘¥Í…‰±•õí…ÍÍ•Ñ5…¥¹Ñ•¹…¹•I•Á½ÉÑe•…È€ôôô€…±°ô(€€€€€€€€€€€€€€€€€€€€€½¹Q½±”õì ¤€ôøÑ½±•ÍÍ•ÑI•Á½ÉÑM•±•Ð µ½¹Ñ œ¥ô(€€€€€€€€€€€€€€€€€€€€€½¹¡…¹”õíÍ•±•ÑÍÍ•Ñ5…¥¹Ñ•¹…¹•I•Á½ÉÑ5½¹Ñ¡ô(€€€€€€€€€€€€€€€€€€€€¼ø(€€€€€€€€€€€€€€€€€€ð½‘¥Øø((€€€€€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”õí€‘íÍÑå±•Ì¹™½ÉµÑ¥½¹Íô€‘íÍÑå±•Ì¹•áÁ½ÉÑÑ¥½¹Íô€‘íÍÑå±•Ì¹…ÍÍ•ÑÕ•±I•Á½ÉÑÑ¥½¹Íõôø(€€€€€€€€€€€€€€€€€€€€ñ‰ÕÑÑ½¸ÑåÁ”ô‰‰ÕÑÑ½¸ˆ±…ÍÍ9…µ”õí€‘íÍÑå±•Ì¹Í•½¹‘…Éå	ÕÑÑ½¹ô€‘íÍÑå±•Ì¹…ÍÍ•ÑQ¥µ•±¥¹•M•½¹‘…Éå	ÕÑÑ½¹õô½¹±¥¬õí‰…­Q½ÍÍ•ÑI•Á½ÉÑ½Éµ…ÑMÑ•Áôù	…¬ð½‰ÕÑÑ½¸ø(€€€€€€€€€€€€€€€€€€€€ñ‰ÕÑÑ½¸(€€€€€€€€€€€€€€€€€€€€€ÑåÁ”ô‰‰ÕÑÑ½¸ˆ(€€€€€€€€€€€€€€€€€€€€€±…ÍÍ9…µ”õí€‘íÍÑå±•Ì¹Í•½¹‘…Éå	ÕÑÑ½¹ô€‘íÍÑå±•Ì¹…ÍÍ•ÑQ¥µ•±¥¹•M•½¹‘…Éå	ÕÑÑ½¹õô(€€€€€€€€€€€€€€€€€€€€€½¹±¥¬õí±½Í•ÍÍ•ÑI•Á½ÉÑ¥…±½ô(€€€€€€€€€€€€€€€€€€€€ø(€€€€€€€€€€€€€€€€€€€€€…¹•°(€€€€€€€€€€€€€€€€€€€€ð½‰ÕÑÑ½¸ø(€€€€€€€€€€€€€€€€€€€€ñ‰ÕÑÑ½¸(€€€€€€€€€€€€€€€€€€€€€ÑåÁ”ô‰‰ÕÑÑ½¸ˆ(€€€€€€€€€€€€€€€€€€€€€±…ÍÍ9…µ”õíÍÑå±•Ì¹ÁÉ¥µ…Éå	ÕÑÑ½¹ô(€€€€€€€€€€€€€€€€€€€€€½¹±¥¬õì ¤€ôøÙ½¥¡…¹‘±•½Ý¹±½…‘¥±Ñ•É•‘5…¥¹Ñ•¹…¹•I•Á½ÉÐ¡…Ñ¥Ù•ÍÍ•Ð°…ÍÍ•ÑI•Á½ÉÑ½Ý¹±½…‘½Éµ…Ð¥ô(€€€€€€€€€€€€€€€€€€€€ø(€€€€€€€€€€€€€€€€€€€€€€ñ½Ý¹±½…‘%½¸±…ÍÍ9…µ”õíÍÑå±•Ì¹‰ÕÑÑ½¹%½¹ô€¼ø(€€€€€€€€€€€€€€€€€€€€€€ñÍÁ…¸ùí…ÍÍ•ÑI•Á½ÉÑ½Ý¹±½…‘½Éµ…Ð€ôôô€Á‘˜œ€ü€=Á•¸AÉ•Á½ÉÐœ€è€½Ý¹±½…á•°ôð½ÍÁ…¸ø(€€€€€€€€€€€€€€€€€€€€ð½‰ÕÑÑ½¸ø(€€€€€€€€€€€€€€€€€€ð½‘¥Øø(€€€€€€€€€€€€€€€€ð¼ø(€€€€€€€€€€€€€€¤€è…ÍÍ•ÑI•Á½ÉÑMÑ•À€ôôô€‘•ÁÉ•¥…Ñ¥½¸µ™¥±Ñ•Èœ€ü€ (€€€€€€€€€€€€€€€€ðø(€€€€€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”õíÍÑå±•Ì¹…ÍÍ•ÑQ¥µ•±¥¹•MÑ…•!•…‘¥¹ôø(€€€€€€€€€€€€€€€€€€€€ñÍÑÉ½¹œùI•Á½ÉÐÑ¥µ•±¥¹”ð½ÍÑÉ½¹œø(€€€€€€€€€€€€€€€€€€€€ñÍÁ…¸ù¡½½Í”Ñ¡”å•…È…¹µ½¹Ñ Ñ¼¥¹±Õ‘”¸ð½ÍÁ…¸ø(€€€€€€€€€€€€€€€€€€ð½‘¥Øø((€€€€€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”õíÍÑå±•Ì¹…ÍÍ•ÑÕ•±I•Á½ÉÑ¥±Ñ•É	½áôø(€€€€€€€€€€€€€€€€€€€€ñI•Á½ÉÑM•±•Ð(€€€€€€€€€€€€€€€€€€€€€±…‰•°ô‰e•…Èˆ(€€€€€€€€€€€€€€€€€€€€€Ù…±Õ”õí…ÍÍ•Ñ•ÁÉ•¥…Ñ¥½¹I•Á½ÉÑe•…Éô(€€€€€€€€€€€€€€€€€€€€€½ÁÑ¥½¹Ìõí…ÍÍ•ÑI•Á½ÉÑe•…É=ÁÑ¥½¹Íô(€€€€€€€€€€€€€€€€€€€€€¥Í=Á•¸õí½Á•¹ÍÍ•ÑI•Á½ÉÑM•±•Ð€ôôô€å•…Èô(€€€€€€€€€€€€€€€€€€€€€½¹Q½±”õì ¤€ôøÑ½±•ÍÍ•ÑI•Á½ÉÑM•±•Ð å•…Èœ¥ô(€€€€€€€€€€€€€€€€€€€€€½¹¡…¹”õíÍ•±•ÑÍÍ•Ñ•ÁÉ•¥…Ñ¥½¹I•Á½ÉÑe•…Éô(€€€€€€€€€€€€€€€€€€€€¼ø((€€€€€€€€€€€€€€€€€€€€ñI•Á½ÉÑM•±•Ð(€€€€€€€€€€€€€€€€€€€€€±…‰•°ô‰5½¹Ñ ˆ(€€€€€€€€€€€€€€€€€€€€€Ù…±Õ”õí…ÍÍ•Ñ•ÁÉ•¥…Ñ¥½¹I•Á½ÉÑ5½¹Ñ¡ô(€€€€€€€€€€€€€€€€€€€€€½ÁÑ¥½¹Ìõí…ÍÍ•ÑI•Á½ÉÑ5½¹Ñ¡=ÁÑ¥½¹Íô(€€€€€€€€€€€€€€€€€€€€€¥Í=Á•¸õí½Á•¹ÍÍ•ÑI•Á½ÉÑM•±•Ð€ôôô€µ½¹Ñ ô(€€€€€€€€€€€€€€€€€€€€€‘¥Í…‰±•õí…ÍÍ•Ñ•ÁÉ•¥…Ñ¥½¹I•Á½ÉÑe•…È€ôôô€…±°ô(€€€€€€€€€€€€€€€€€€€€€½¹Q½±”õì ¤€ôøÑ½±•ÍÍ•ÑI•Á½ÉÑM•±•Ð µ½¹Ñ œ¥ô(€€€€€€€€€€€€€€€€€€€€€½¹¡…¹”õíÍ•±•ÑÍÍ•Ñ•ÁÉ•¥…Ñ¥½¹I•Á½ÉÑ5½¹Ñ¡ô(€€€€€€€€€€€€€€€€€€€€¼ø(€€€€€€€€€€€€€€€€€€ð½‘¥Øø((€€€€€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”õí€‘íÍÑå±•Ì¹™½ÉµÑ¥½¹Íô€‘íÍÑå±•Ì¹•áÁ½ÉÑÑ¥½¹Íô€‘íÍÑå±•Ì¹…ÍÍ•ÑÕ•±I•Á½ÉÑÑ¥½¹Íõôø(€€€€€€€€€€€€€€€€€€€€ñ‰ÕÑÑ½¸ÑåÁ”ô‰‰ÕÑÑ½¸ˆ±…ÍÍ9…µ”õí€‘íÍÑå±•Ì¹Í•½¹‘…Éå	ÕÑÑ½¹ô€‘íÍÑå±•Ì¹…ÍÍ•ÑQ¥µ•±¥¹•M•½¹‘…Éå	ÕÑÑ½¹õô½¹±¥¬õí‰…­Q½ÍÍ•ÑI•Á½ÉÑ½Éµ…ÑMÑ•Áôù	…¬ð½‰ÕÑÑ½¸ø(€€€€€€€€€€€€€€€€€€€€ñ‰ÕÑÑ½¸(€€€€€€€€€€€€€€€€€€€€€ÑåÁ”ô‰‰ÕÑÑ½¸ˆ(€€€€€€€€€€€€€€€€€€€€€±…ÍÍ9…µ”õí€‘íÍÑå±•Ì¹Í•½¹‘…Éå	ÕÑÑ½¹ô€‘íÍÑå±•Ì¹…ÍÍ•ÑQ¥µ•±¥¹•M•½¹‘…Éå	ÕÑÑ½¹õô(€€€€€€€€€€€€€€€€€€€€€½¹±¥¬õí±½Í•ÍÍ•ÑI•Á½ÉÑ¥…±½ô(€€€€€€€€€€€€€€€€€€€€ø(€€€€€€€€€€€€€€€€€€€€€…¹•°(€€€€€€€€€€€€€€€€€€€€ð½‰ÕÑÑ½¸ø(€€€€€€€€€€€€€€€€€€€€ñ‰ÕÑÑ½¸(€€€€€€€€€€€€€€€€€€€€€ÑåÁ”ô‰‰ÕÑÑ½¸ˆ(€€€€€€€€€€€€€€€€€€€€€±…ÍÍ9…µ”õíÍÑå±•Ì¹ÁÉ¥µ…Éå	ÕÑÑ½¹ô(€€€€€€€€€€€€€€€€€€€€€½¹±¥¬õì ¤€ôøÙ½¥¡…¹‘±•½Ý¹±½…‘¥±Ñ•É•‘•ÁÉ•¥…Ñ¥½¹I•Á½ÉÐ¡…Ñ¥Ù•ÍÍ•Ð°…ÍÍ•ÑI•Á½ÉÑ½Ý¹±½…‘½Éµ…Ð¥ô(€€€€€€€€€€€€€€€€€€€€ø(€€€€€€€€€€€€€€€€€€€€€€ñ½Ý¹±½…‘%½¸±…ÍÍ9…µ”õíÍÑå±•Ì¹‰ÕÑÑ½¹%½¹ô€¼ø(€€€€€€€€€€€€€€€€€€€€€€ñÍÁ…¸ùí…ÍÍ•ÑI•Á½ÉÑ½Ý¹±½…‘½Éµ…Ð€ôôô€Á‘˜œ€ü€=Á•¸AÉ•Á½ÉÐœ€è€½Ý¹±½…á•°ôð½ÍÁ…¸ø(€€€€€€€€€€€€€€€€€€€€ð½‰ÕÑÑ½¸ø(€€€€€€€€€€€€€€€€€€ð½‘¥Øø(€€€€€€€€€€€€€€€€ð¼ø(€€€€€€€€€€€€€€¤€è…ÍÍ•ÑI•Á½ÉÑMÑ•À€ôôô€½Ý¹•ÉÍ¡¥Àµ™¥±Ñ•Èœ€ü€ (€€€€€€€€€€€€€€€€ðø(€€€€€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”õíÍÑå±•Ì¹…ÍÍ•ÑQ¥µ•±¥¹•MÑ…•!•…‘¥¹ôø(€€€€€€€€€€€€€€€€€€€€ñÍÑÉ½¹œùI•Á½ÉÐÑ¥µ•±¥¹”ð½ÍÑÉ½¹œø(€€€€€€€€€€€€€€€€€€€€ñÍÁ…¸ù¡½½Í”Ñ¡”å•…È…¹µ½¹Ñ Ñ¼¥¹±Õ‘”¸ð½ÍÁ…¸ø(€€€€€€€€€€€€€€€€€€ð½‘¥Øø((€€€€€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”õíÍÑå±•Ì¹…ÍÍ•ÑÕ•±I•Á½ÉÑ¥±Ñ•É	½áôø(€€€€€€€€€€€€€€€€€€€€ñI•Á½ÉÑM•±•Ð(€€€€€€€€€€€€€€€€€€€€€±…‰•°ô‰e•…Èˆ(€€€€€€€€€€€€€€€€€€€€€Ù…±Õ”õí…ÍÍ•Ñ=Ý¹•ÉÍ¡¥ÁI•Á½ÉÑe•…Éô(€€€€€€€€€€€€€€€€€€€€€½ÁÑ¥½¹Ìõí…ÍÍ•ÑI•Á½ÉÑe•…É=ÁÑ¥½¹Íô(€€€€€€€€€€€€€€€€€€€€€¥Í=Á•¸õí½Á•¹ÍÍ•ÑI•Á½ÉÑM•±•Ð€ôôô€å•…Èô(€€€€€€€€€€€€€€€€€€€€€½¹Q½±”õì ¤€ôøÑ½±•ÍÍ•ÑI•Á½ÉÑM•±•Ð å•…Èœ¥ô(€€€€€€€€€€€€€€€€€€€€€½¹¡…¹”õíÍ•±•ÑÍÍ•Ñ=Ý¹•ÉÍ¡¥ÁI•Á½ÉÑe•…Éô(€€€€€€€€€€€€€€€€€€€€¼ø((€€€€€€€€€€€€€€€€€€€€ñI•Á½ÉÑM•±•Ð(€€€€€€€€€€€€€€€€€€€€€±…‰•°ô‰5½¹Ñ ˆ(€€€€€€€€€€€€€€€€€€€€€Ù…±Õ”õí…ÍÍ•Ñ=Ý¹•ÉÍ¡¥ÁI•Á½ÉÑ5½¹Ñ¡ô(€€€€€€€€€€€€€€€€€€€€€½ÁÑ¥½¹Ìõí…ÍÍ•ÑI•Á½ÉÑ5½¹Ñ¡=ÁÑ¥½¹Íô(€€€€€€€€€€€€€€€€€€€€€¥Í=Á•¸õí½Á•¹ÍÍ•ÑI•Á½ÉÑM•±•Ð€ôôô€µ½¹Ñ ô(€€€€€€€€€€€€€€€€€€€€€‘¥Í…‰±•õí…ÍÍ•Ñ=Ý¹•ÉÍ¡¥ÁI•Á½ÉÑe•…È€ôôô€…±°ô(€€€€€€€€€€€€€€€€€€€€€½¹Q½±”õì ¤€ôøÑ½±•ÍÍ•ÑI•Á½ÉÑM•±•Ð µ½¹Ñ œ¥ô(€€€€€€€€€€€€€€€€€€€€€½¹¡…¹”õíÍ•±•ÑÍÍ•Ñ=Ý¹•ÉÍ¡¥ÁI•Á½ÉÑ5½¹Ñ¡ô(€€€€€€€€€€€€€€€€€€€€¼ø(€€€€€€€€€€€€€€€€€€ð½‘¥Øø((€€€€€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”õí€‘íÍÑå±•Ì¹™½ÉµÑ¥½¹Íô€‘íÍÑå±•Ì¹•áÁ½ÉÑÑ¥½¹Íô€‘íÍÑå±•Ì¹…ÍÍ•ÑÕ•±I•Á½ÉÑÑ¥½¹Íõôø(€€€€€€€€€€€€€€€€€€€€ñ‰ÕÑÑ½¸ÑåÁ”ô‰‰ÕÑÑ½¸ˆ±…ÍÍ9…µ”õí€‘íÍÑå±•Ì¹Í•½¹‘…Éå	ÕÑÑ½¹ô€‘íÍÑå±•Ì¹…ÍÍ•ÑQ¥µ•±¥¹•M•½¹‘…Éå	ÕÑÑ½¹õô½¹±¥¬õí‰…­Q½ÍÍ•ÑI•Á½ÉÑ½Éµ…ÑMÑ•Áôù	…¬ð½‰ÕÑÑ½¸ø(€€€€€€€€€€€€€€€€€€€€ñ‰ÕÑÑ½¸(€€€€€€€€€€€€€€€€€€€€€ÑåÁ”ô‰‰ÕÑÑ½¸ˆ(€€€€€€€€€€€€€€€€€€€€€±…ÍÍ9…µ”õí€‘íÍÑå±•Ì¹Í•½¹‘…Éå	ÕÑÑ½¹ô€‘íÍÑå±•Ì¹…ÍÍ•ÑQ¥µ•±¥¹•M•½¹‘…Éå	ÕÑÑ½¹õô(€€€€€€€€€€€€€€€€€€€€€½¹±¥¬õí±½Í•ÍÍ•ÑI•Á½ÉÑ¥…±½ô(€€€€€€€€€€€€€€€€€€€€ø(€€€€€€€€€€€€€€€€€€€€€…¹•°(€€€€€€€€€€€€€€€€€€€€ð½‰ÕÑÑ½¸ø(€€€€€€€€€€€€€€€€€€€€ñ‰ÕÑÑ½¸(€€€€€€€€€€€€€€€€€€€€€ÑåÁ”ô‰‰ÕÑÑ½¸ˆ(€€€€€€€€€€€€€€€€€€€€€±…ÍÍ9…µ”õíÍÑå±•Ì¹ÁÉ¥µ…Éå	ÕÑÑ½¹ô(€€€€€€€€€€€€€€€€€€€€€½¹±¥¬õì ¤€ôøÙ½¥¡…¹‘±•½Ý¹±½…‘¥±Ñ•É•‘=Ý¹•ÉÍ¡¥ÁI•Á½ÉÐ¡…Ñ¥Ù•ÍÍ•Ð°…ÍÍ•ÑI•Á½ÉÑ½Ý¹±½…‘½Éµ…Ð¥ô(€€€€€€€€€€€€€€€€€€€€ø(€€€€€€€€€€€€€€€€€€€€€€ñ½Ý¹±½…‘%½¸±…ÍÍ9…µ”õíÍÑå±•Ì¹‰ÕÑÑ½¹%½¹ô€¼ø(€€€€€€€€€€€€€€€€€€€€€€ñÍÁ…¸ùí…ÍÍ•ÑI•Á½ÉÑ½Ý¹±½…‘½Éµ…Ð€ôôô€Á‘˜œ€ü€=Á•¸AÉ•Á½ÉÐœ€è€½Ý¹±½…á•°ôð½ÍÁ…¸ø(€€€€€€€€€€€€€€€€€€€€ð½‰ÕÑÑ½¸ø(€€€€€€€€€€€€€€€€€€ð½‘¥Øø(€€€€€€€€€€€€€€€€ð¼ø(€€€€€€€€€€€€€€¤€è€ (€€€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”õíÍÑå±•Ì¹…ÍÍ•ÑI•Á½ÉÑ=ÁÑ¥½¹ÍÉ¥‘ôø(€€€€€€€€€€€€€€€€€€ñ‰ÕÑÑ½¸ÑåÁ”ô‰‰ÕÑÑ½¸ˆ±…ÍÍ9…µ”õíÍÑå±•Ì¹…ÍÍ•ÑI•Á½ÉÑ=ÁÑ¥½¹	ÕÑÑ½¹ô½¹±¥¬õì ¤€ôø¡…¹‘±•AÉ¥¹ÑÍÍ•ÑM¡••Ð¡…Ñ¥Ù•ÍÍ•Ð¥ôø(€€€€€€€€€€€€€€€€€€€€ñA‘™%½¸±…ÍÍ9…µ”õíÍÑå±•Ì¹‰ÕÑÑ½¹%½¹ô€¼ø(€€€€€€€€€€€€€€€€€€€€ñÍÁ…¸ø(€€€€€€€€€€€€€€€€€€€€€€ñÍÑÉ½¹œù½Ý¹±½……ÍÍ•ÐÙ…±Õ…Ñ¥½¸ð½ÍÑÉ½¹œø(€€€€€€€€€€€€€€€€€€€€€€ñÍµ…±°ùAÙ…±Õ”ÍÕµµ…ÉäÝ¥Ñ ¹½Ñ•Ì…¹‘½Õµ•¹ÑÌ¸ð½Íµ…±°ø(€€€€€€€€€€€€€€€€€€€€ð½ÍÁ…¸ø(€€€€€€€€€€€€€€€€€€ð½‰ÕÑÑ½¸ø((€€€€€€€€€€€€€€€€€í…¹UÍ•=Ý¹•É=¹±åÍÍ•ÑÑ¥½¹Ì€ü€ (€€€€€€€€€€€€€€€€€€€€ðø(€€€€€€€€€€€€€€€€€€€€€€ñ‰ÕÑÑ½¸ÑåÁ”ô‰‰ÕÑÑ½¸ˆ±…ÍÍ9…µ”õíÍÑå±•Ì¹…ÍÍ•ÑI•Á½ÉÑ=ÁÑ¥½¹	ÕÑÑ½¹ô½¹±¥¬õí½Á•¹ÍÍ•Ñ5…¥¹Ñ•¹…¹•I•Á½ÉÑ¥±Ñ•Éôø(€€€€€€€€€€€€€€€€€€€€€€€€ñ½Õµ•¹Ñ%½¸±…ÍÍ9…µ”õíÍÑå±•Ì¹‰ÕÑÑ½¹%½¹ô€¼ø(€€€€€€€€€€€€€€€€€€€€€€€€ñÍÁ…¸ø(€€€€€€€€€€€€€€€€€€€€€€€€€€ñÍÑÉ½¹œù½Ý¹±½…µ…¥¹Ñ•¹…¹”É•Á½ÉÐð½ÍÑÉ½¹œø(€€€€€€€€€€€€€€€€€€€€€€€€€€ñÍµ…±°ùA½Èá•°Í•ÉÙ¥”…¹É•Á…¥È½ÍÑÌ¸ð½Íµ…±°ø(€€€€€€€€€€€€€€€€€€€€€€€€ð½ÍÁ…¸ø(€€€€€€€€€€€€€€€€€€€€€€ð½‰ÕÑÑ½¸ø((€€€€€€€€€€€€€€€€€€€€€í…¹½Ý¹±½…‘ÍÍ•ÑÕ•±I•Á½ÉÐ¡…Ñ¥Ù•ÍÍ•Ð¤€ü€ (€€€€€€€€€€€€€€€€€€€€€€€€ñ‰ÕÑÑ½¸ÑåÁ”ô‰‰ÕÑÑ½¸ˆ±…ÍÍ9…µ”õíÍÑå±•Ì¹…ÍÍ•ÑI•Á½ÉÑ=ÁÑ¥½¹	ÕÑÑ½¹ô½¹±¥¬õí½Á•¹ÍÍ•ÑÕ•±I•Á½ÉÑ¥±Ñ•Éôø(€€€€€€€€€€€€€€€€€€€€€€€€€€ñ½Õµ•¹Ñ%½¸±…ÍÍ9…µ”õíÍÑå±•Ì¹‰ÕÑÑ½¹%½¹ô€¼ø(€€€€€€€€€€€€€€€€€€€€€€€€€€ñÍÁ…¸ø(€€€€€€€€€€€€€€€€€€€€€€€€€€€€ñÍÑÉ½¹œù½Ý¹±½…™Õ•°É•Á½ÉÐð½ÍÑÉ½¹œø(€€€€€€€€€€€€€€€€€€€€€€€€€€€€ñÍµ…±°ùA½Èá•°™Õ•°½ÍÑÌ‰äµ½¹Ñ ¸ð½Íµ…±°ø(€€€€€€€€€€€€€€€€€€€€€€€€€€ð½ÍÁ…¸ø(€€€€€€€€€€€€€€€€€€€€€€€€ð½‰ÕÑÑ½¸ø(€€€€€€€€€€€€€€€€€€€€€€¤€è¹Õ±±ô((€€€€€€€€€€€€€€€€€€€€€í…¹½Ý¹±½…‘ÍÍ•Ñ•ÁÉ•¥…Ñ¥½¹I•Á½ÉÐ¡…Ñ¥Ù•ÍÍ•Ð¤€ü€ (€€€€€€€€€€€€€€€€€€€€€€€€ñ‰ÕÑÑ½¸ÑåÁ”ô‰‰ÕÑÑ½¸ˆ±…ÍÍ9…µ”õíÍÑå±•Ì¹…ÍÍ•ÑI•Á½ÉÑ=ÁÑ¥½¹	ÕÑÑ½¹ô½¹±¥¬õí½Á•¹ÍÍ•Ñ•ÁÉ•¥…Ñ¥½¹I•Á½ÉÑ¥±Ñ•Éôø(€€€€€€€€€€€€€€€€€€€€€€€€€€ñ½Õµ•¹Ñ%½¸±…ÍÍ9…µ”õíÍÑå±•Ì¹‰ÕÑÑ½¹%½¹ô€¼ø(€€€€€€€€€€€€€€€€€€€€€€€€€€ñÍÁ…¸ø(€€€€€€€€€€€€€€€€€€€€€€€€€€€€ñÍÑÉ½¹œù½Ý¹±½…‘•ÁÉ•¥…Ñ¥½¸±½œð½ÍÑÉ½¹œø(€€€€€€€€€€€€€€€€€€€€€€€€€€€€ñÍµ…±°ùA½Èá•°±½œ½˜Í…Ù•Ù…±Õ”¡…¹•Ì¸ð½Íµ…±°ø(€€€€€€€€€€€€€€€€€€€€€€€€€€ð½ÍÁ…¸ø(€€€€€€€€€€€€€€€€€€€€€€€€ð½‰ÕÑÑ½¸ø(€€€€€€€€€€€€€€€€€€€€€€¤€è¹Õ±±ô((€€€€€€€€€€€€€€€€€€€€€€ñ‰ÕÑÑ½¸ÑåÁ”ô‰‰ÕÑÑ½¸ˆ±…ÍÍ9…µ”õíÍÑå±•Ì¹…ÍÍ•ÑI•Á½ÉÑ=ÁÑ¥½¹	ÕÑÑ½¹ô½¹±¥¬õí½Á•¹ÍÍ•Ñ=Ý¹•ÉÍ¡¥ÁI•Á½ÉÑ¥±Ñ•Éôø(€€€€€€€€€€€€€€€€€€€€€€€€ñ½Õµ•¹Ñ%½¸±…ÍÍ9…µ”õíÍÑå±•Ì¹‰ÕÑÑ½¹%½¹ô€¼ø(€€€€€€€€€€€€€€€€€€€€€€€€ñÍÁ…¸ø(€€€€€€€€€€€€€€€€€€€€€€€€€€ñÍÑÉ½¹œù½Ý¹±½…½ÍÐ½˜½Ý¹•ÉÍ¡¥ÀÉ•Á½ÉÐð½ÍÑÉ½¹œø(€€€€€€€€€€€€€€€€€€€€€€€€€€ñÍµ…±°ùA½Èá•°½Ý¹•ÉÍ¡¥À½ÍÑÌ…¹YP¸ð½Íµ…±°ø(€€€€€€€€€€€€€€€€€€€€€€€€ð½ÍÁ…¸ø(€€€€€€€€€€€€€€€€€€€€€€ð½‰ÕÑÑ½¸ø(€€€€€€€€€€€€€€€€€€€€ð¼ø(€€€€€€€€€€€€€€€€€€¤€è¹Õ±±ô(€€€€€€€€€€€€€€€€ð½‘¥Øø(€€€€€€€€€€€€€€¥ô(€€€€€€€€€€€€ð½‘¥Øø(€€€€€€€€€€ð½‘¥Øø(€€€€€€€€ð½‘¥Øø(€€€€€€¤€è¹Õ±±ô((€€€€€í‘•±•Ñ•…¹‘¥‘…Ñ•ÍÍ•Ð€ü€ (€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”õí€‘íÍÑå±•Ì¹µ½‘…±=Ù•É±…åô€‘íÍÑå±•Ì¹½¹™¥Éµ•±•Ñ•=Ù•É±…åõôø(€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”õíÍÑå±•Ì¹µ½‘…±	…­‘É½Áô½¹±¥¬õí±½Í••±•Ñ•½¹™¥Éµ¥…±½ô€¼ø((€€€€€€€€€€ñ‘¥Ø(€€€€€€€€€€€±…ÍÍ9…µ”õíÍÑå±•Ì¹‘•±•Ñ•½¹™¥Éµ5½‘…±ô(€€€€€€€€€€€É½±”ô‰…±•ÉÑ‘¥…±½œˆ(€€€€€€€€€€€…É¥„µµ½‘…°ô‰ÑÉÕ”ˆ(€€€€€€€€€€€…É¥„µ±…‰•±±•‘‰äô‰‘•±•Ñ”µ½¹™¥É´µÑ¥Ñ±”ˆ(€€€€€€€€€€€…É¥„µ‘•ÍÉ¥‰•‘‰äô‰‘•±•Ñ”µ½¹™¥É´µ½Áäˆ(€€€€€€€€€€ø(€€€€€€€€€€€€ñ‰ÕÑÑ½¸(€€€€€€€€€€€€€ÑåÁ”ô‰‰ÕÑÑ½¸ˆ(€€€€€€€€€€€€€±…ÍÍ9…µ”õíÍÑå±•Ì¹‘•±•Ñ•½¹™¥Éµ±½Í•	ÕÑÑ½¹ô(€€€€€€€€€€€€€½¹±¥¬õí±½Í••±•Ñ•½¹™¥Éµ¥…±½ô(€€€€€€€€€€€€€…É¥„µ±…‰•°ô‰±½Í”‘•±•Ñ”½¹™¥Éµ…Ñ¥½¸ˆ(€€€€€€€€€€€€€‘¥Í…‰±•õí‰ÕÍå•±•Ñ•%€ôôô‘•±•Ñ•…¹‘¥‘…Ñ•ÍÍ•Ð¹¥‘ô(€€€€€€€€€€€€ø(€€€€€€€€€€€€€€ñ±½Í•%½¸±…ÍÍ9…µ”õíÍÑå±•Ì¹‰ÕÑÑ½¹%½¹ô€¼ø(€€€€€€€€€€€€ð½‰ÕÑÑ½¸ø((€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”õíÍÑå±•Ì¹‘•±•Ñ•½¹™¥Éµ½¹Ñ•¹Ñôø(€€€€€€€€€€€€€€ñ Ì¥ô‰‘•±•Ñ”µ½¹™¥É´µÑ¥Ñ±”ˆùÉ”å½ÔÍÕÉ”å½ÔÝ…¹ÐÑ¼‘•±•Ñ”Ñ¡¥Ìüð½ Ìø(€€€€€€€€€€€€€€ñÀ¥ô‰‘•±•Ñ”µ½¹™¥É´µ½Áäˆø(€€€€€€€€€€€€€€€½¹Ñ¥¹Õ”Ñ¼Ñ•±°¥´ÑÁÉ¥”Ý¡…Ð¡…ÁÁ•¹•Ñ¼€ñÍÑÉ½¹œùí‘•±•Ñ•…¹‘¥‘…Ñ•ÍÍ•Ð¹Ñ¥Ñ±•ôð½ÍÑÉ½¹œø¸•¹Õ¥¹”‘¥ÍÁ½Í…±Ì…É”…É¡¥Ù•…¹­•ÁÐ™½ÈÉ•Á½ÉÑÌ…¹¡¥ÍÑ½Éäì½¹±äµ¥ÍÑ…­•Ì½È‘ÕÁ±¥…Ñ•Ì…É”Á•Éµ…¹•¹Ñ±äÉ•µ½Ù•¸(€€€€€€€€€€€€€€ð½Àø((€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”õíÍÑå±•Ì¹‘•±•Ñ•½¹™¥ÉµÍÍ•Ñôø(€€€€€€€€€€€€€€€€ñÍÁ…¸ùM•±•Ñ•…ÍÍ•Ðð½ÍÁ…¸ø(€€€€€€€€€€€€€€€€ñÍÑÉ½¹œùí‘•±•Ñ•…¹‘¥‘…Ñ•ÍÍ•Ð¹Ñ¥Ñ±•ôð½ÍÑÉ½¹œø(€€€€€€€€€€€€€€€€ñÍµ…±°ùí‰Õ¥±‘ÍÍ•Ñ5•Ñ„¡‘•±•Ñ•…¹‘¥‘…Ñ•ÍÍ•Ð¥ôƒ
Üíµ½¹•ä¡‘•±•Ñ•…¹‘¥‘…Ñ•ÍÍ•Ð¹Ù…±Õ”¥ôð½Íµ…±°ø(€€€€€€€€€€€€€€ð½‘¥Øø((€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”õíÍÑå±•Ì¹‘•±•Ñ•½¹™¥ÉµÑ¥½¹Íôø(€€€€€€€€€€€€€€€€ñ‰ÕÑÑ½¸ÑåÁ”ô‰‰ÕÑÑ½¸ˆ±…ÍÍ9…µ”õíÍÑå±•Ì¹Í•½¹‘…Éå	ÕÑÑ½¹ô½¹±¥¬õí±½Í••±•Ñ•½¹™¥Éµ¥…±½ô‘¥Í…‰±•õí‰ÕÍå•±•Ñ•%€ôôô‘•±•Ñ•…¹‘¥‘…Ñ•ÍÍ•Ð¹¥‘ôø(€€€€€€€€€€€€€€€€€…¹•°(€€€€€€€€€€€€€€€€ð½‰ÕÑÑ½¸ø((€€€€€€€€€€€€€€€€ñ‰ÕÑÑ½¸(€€€€€€€€€€€€€€€€€ÑåÁ”ô‰‰ÕÑÑ½¸ˆ(€€€€€€€€€€€€€€€€€±…ÍÍ9…µ”õí€‘íÍÑå±•Ì¹ÁÉ¥µ…Éå	ÕÑÑ½¹ô€‘íÍÑå±•Ì¹‘•±•Ñ•½¹™¥Éµ	ÕÑÑ½¹õô(€€€€€€€€€€€€€€€€€½¹±¥¬õì ¤€ôøÙ½¥¡…¹‘±•½¹™¥Éµ•±•Ñ•ÍÍ•Ð ¥ô(€€€€€€€€€€€€€€€€€‘¥Í…‰±•õí‰ÕÍå•±•Ñ•%€ôôô‘•±•Ñ•…¹‘¥‘…Ñ•ÍÍ•Ð¹¥‘ô(€€€€€€€€€€€€€€€€ø(€€€€€€€€€€€€€€€€€€ñÍÁ…¸ùe•Ì°‘•±•Ñ”…ÍÍ•Ðð½ÍÁ…¸ø(€€€€€€€€€€€€€€€€ð½‰ÕÑÑ½¸ø(€€€€€€€€€€€€€€ð½‘¥Øø(€€€€€€€€€€€€ð½‘¥Øø(€€€€€€€€€€ð½‘¥Øø(€€€€€€€€ð½‘¥Øø(€€€€€€¤€è¹Õ±±ô((€€€€€í‰Õ±­¥¹…¹•ÍÍ•ÑA¥­•É=Á•¸€˜˜•‘¥Ñ¥¹ÍÍ•Ð€ü€ (€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”õí€‘íÍÑå±•Ì¹µ½‘…±=Ù•É±…åô€‘íÍÑå±•Ì¹‰Õ±­¥¹…¹•A¥­•É=Ù•É±…åõôø(€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”õíÍÑå±•Ì¹µ½‘…±	…­‘É½Áô½¹±¥¬õì ¤€ôøÍ•Ñ	Õ±­¥¹…¹•ÍÍ•ÑA¥­•É=Á•¸¡™…±Í”¥ô€¼ø(€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”õí€‘íÍÑå±•Ì¹µ½‘…±…É‘ô€‘íÍÑå±•Ì¹•áÁ½ÉÑ5½‘…±ô€‘íÍÑå±•Ì¹•áÁ½ÉÑÍÍ•ÑA¥­•É5½‘…±ô€‘íÍÑå±•Ì¹‰Õ±­¥¹…¹•ÍÍ•ÑA¥­•É5½‘…±õôÉ½±”ô‰‘¥…±½œˆ…É¥„µµ½‘…°ô‰ÑÉÕ”ˆ…É¥„µ±…‰•±±•‘‰äô‰‰Õ±¬µ™¥¹…¹”µ…ÍÍ•ÑÌµÑ¥Ñ±”ˆø(€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”õí€‘íÍÑå±•Ì¹µ½‘…±!•…‘•Éô€‘íÍÑå±•Ì¹•áÁ½ÉÑ5½‘…±!•…‘•Éõôø(€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”õíÍÑå±•Ì¹µ½‘…±!•…‘•ÉQ•áÑôø(€€€€€€€€€€€€€€€€ñ Ì¥ô‰‰Õ±¬µ™¥¹…¹”µ…ÍÍ•ÑÌµÑ¥Ñ±”ˆù¡½½Í”…ÍÍ•ÑÌ™½È‰Õ±¬™¥¹…¹”ð½ Ìø(€€€€€€€€€€€€€€€€ñÀùM•±•Ð•Ù•Éä…ÍÍ•Ð½Ù•É•‰äÑ¡”Í…µ”™¥¹…¹”…É••µ•¹Ð¸ð½Àø(€€€€€€€€€€€€€€ð½‘¥Øø(€€€€€€€€€€€€€€ñ‰ÕÑÑ½¸ÑåÁ”ô‰‰ÕÑÑ½¸ˆ±…ÍÍ9…µ”õíÍÑå±•Ì¹µ½‘…±±½Í•	ÕÑÑ½¹ô½¹±¥¬õì ¤€ôøÍ•Ñ	Õ±­¥¹…¹•ÍÍ•ÑA¥­•É=Á•¸¡™…±Í”¥ô…É¥„µ±…‰•°ô‰±½Í”‰Õ±¬™¥¹…¹”…ÍÍ•ÐÁ¥­•Èˆø(€€€€€€€€€€€€€€€€ñ±½Í•%½¸±…ÍÍ9…µ”õíÍÑå±•Ì¹‰ÕÑÑ½¹%½¹ô€¼ø(€€€€€€€€€€€€€€ð½‰ÕÑÑ½¸ø(€€€€€€€€€€€€ð½‘¥Øø(€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”õí€‘íÍÑå±•Ì¹µ½‘…±MÉ½±±	½‘åô€‘íÍÑå±•Ì¹•áÁ½ÉÑ5½‘…±MÉ½±±	½‘åõôø(€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”õíÍÑå±•Ì¹•áÁ½ÉÑ5½‘…±	½‘åôø(€€€€€€€€€€€€€€€€ñÍ•Ñ¥½¸±…ÍÍ9…µ”õíÍÑå±•Ì¹Á‘™ÍÍ•Ñ½Ý¹±½…‘A…¹•±ô…É¥„µ±…‰•°ô‰¡½½Í”…ÍÍ•ÑÌ™½È‰Õ±¬™¥¹…¹”ˆø(€€€€€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”õíÍÑå±•Ì¹Á‘™ÍÍ•Ñ½Ý¹±½…‘Q½½±‰…Éôø(€€€€€€€€€€€€€€€€€€€€ñ¥¹ÁÕÐ(€€€€€€€€€€€€€€€€€€€€€±…ÍÍ9…µ”õíÍÑå±•Ì¹Á‘™ÍÍ•ÑM•…É¡%¹ÁÕÑô(€€€€€€€€€€€€€€€€€€€€€ÑåÁ”ô‰Í•…É ˆ(€€€€€€€€€€€€€€€€€€€€€Ù…±Õ”õí‰Õ±­¥¹…¹•ÍÍ•ÑM•…É¡ô(€€€€€€€€€€€€€€€€€€€€€½¹¡…¹”õì¡•Ù•¹Ð¤€ôøÍ•Ñ	Õ±­¥¹…¹•ÍÍ•ÑM•…É ¡•Ù•¹Ð¹Ñ…É•Ð¹Ù…±Õ”¥ô(€€€€€€€€€€€€€€€€€€€€€Á±…•¡½±‘•Èô‰M•…É …ÍÍ•ÑÌ¸¸¸ˆ(€€€€€€€€€€€€€€€€€€€€€…É¥„µ±…‰•°ô‰M•…É …ÍÍ•ÑÌ™½È‰Õ±¬™¥¹…¹”ˆ(€€€€€€€€€€€€€€€€€€€€¼ø(€€€€€€€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”õíÍÑå±•Ì¹Á‘™ÍÍ•Ñ½Ý¹±½…‘Q½½±‰…ÉÑ¥½¹Íôø(€€€€€€€€€€€€€€€€€€€€€€ñ‰ÕÑÑ½¸ÑåÁ”ô‰‰ÕÑÑ½¸ˆ±…ÍÍ9…µ”õíÍÑå±•Ì¹Í•½¹‘…Éå	ÕÑÑ½¹ô½¹±¥¬õì ¤€ôøÍ•Ñ	Õ±­¥¹…¹•ÍÍ•Ñ%‘Ì¡ÉÉ…ä¹™É½´¡¹•ÜM•Ð¡m•‘¥Ñ¥¹ÍÍ•Ð¹¥°€¸¸¹Ù¥Í¥‰±•	Õ±­¥¹…¹•ÍÍ•ÑÌ¹µ…À ¡…ÍÍ•Ð¤€ôø…ÍÍ•Ð¹¥¥t¤¤¥ôùM•±•Ð…±°ð½‰ÕÑÑ½¸ø(€€€€€€€€€€€€€€€€€€€€€€ñ‰ÕÑÑ½¸ÑåÁ”ô‰‰ÕÑÑ½¸ˆ±…ÍÍ9…µ”õíÍÑå±•Ì¹Í•½¹‘…Éå	ÕÑÑ½¹ô½¹±¥¬õì ¤€ôøÍ•Ñ	Õ±­¥¹…¹•ÍÍ•Ñ%‘Ì¡m•‘¥Ñ¥¹ÍÍ•Ð¹¥‘t¥ô‘¥Í…‰±•õí‰Õ±­¥¹…¹•ÍÍ•Ñ%‘Ì¹±•¹Ñ €ðô€Åôù±•…Èð½‰ÕÑÑ½¸ø(€€€€€€€€€€€€€€€€€€€€ð½‘¥Øø(€€€€€€€€€€€€€€€€€€ð½‘¥Øø(€€€€€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”õíÍÑå±•Ì¹Á‘™ÍÍ•Ñ½Ý¹±½…‘1¥ÍÑôø(€€€€€€€€€€€€€€€€€€€íÙ¥Í¥‰±•	Õ±­¥¹…¹•ÍÍ•ÑÌ¹±•¹Ñ €üÙ¥Í¥‰±•	Õ±­¥¹…¹•ÍÍ•ÑÌ¹µ…À ¡…ÍÍ•Ð¤€ôøì(€€€€€€€€€€€€€€€€€€€€€½¹ÍÐÍ•±•Ñ•€ô‰Õ±­¥¹…¹•ÍÍ•Ñ%‘M•Ð¹¡…Ì¡…ÍÍ•Ð¹¥¤ì(€€€€€€€€€€€€€€€€€€€€€½¹ÍÐÉ•ÅÕ¥É•€ô…ÍÍ•Ð¹¥€ôôô•‘¥Ñ¥¹ÍÍ•Ð¹¥ì(€€€€€€€€€€€€€€€€€€€€€É•ÑÕÉ¸€ (€€€€€€€€€€€€€€€€€€€€€€€€ñ±…‰•°­•äõí…ÍÍ•Ð¹¥‘ô±…ÍÍ9…µ”õí€‘íÍÑå±•Ì¹Á‘™ÍÍ•Ñ½Ý¹±½…‘I½Ýô€‘íÍ•±•Ñ•€üÍÑå±•Ì¹Á‘™ÍÍ•Ñ½Ý¹±½…‘I½ÝM•±•Ñ•€è€œô€‘íÉ•ÅÕ¥É•€üÍÑå±•Ì¹‰Õ±­¥¹…¹•ÕÉÉ•¹ÑÍÍ•Ð€è€œõôø(€€€€€€€€€€€€€€€€€€€€€€€€€€ñ¥¹ÁÕÐ±…ÍÍ9…µ”õíÍÑå±•Ì¹Á‘™ÍÍ•Ñ½Ý¹±½…‘¡•­‰½á%¹ÁÕÑôÑåÁ”ô‰¡•­‰½àˆ¡•­•õíÍ•±•Ñ•‘ô½¹¡…¹”õì ¤€ôøÑ½±•	Õ±­¥¹…¹•ÍÍ•Ð¡…ÍÍ•Ð¹¥¥ô‘¥Í…‰±•õíÉ•ÅÕ¥É•‘ô€¼ø(€€€€€€€€€€€€€€€€€€€€€€€€€€ñÍÁ…¸±…ÍÍ9…µ”õíÍÑå±•Ì¹Á‘™ÍÍ•Ñ½Ý¹±½…‘¡•­‰½áô…É¥„µ¡¥‘‘•¸ô‰ÑÉÕ”ˆ€¼ø(€€€€€€€€€€€€€€€€€€€€€€€€€€ñÍÁ…¸±…ÍÍ9…µ”õíÍÑå±•Ì¹Á‘™ÍÍ•Ñ½Ý¹±½…‘½Áåôø(€€€€€€€€€€€€€€€€€€€€€€€€€€€€ñÍÑÉ½¹œùí…ÍÍ•Ð¹Ñ¥Ñ±•ôð½ÍÑÉ½¹œø(€€€€€€€€€€€€€€€€€€€€€€€€€€€€ñÍÁ…¸ùí‰Õ¥±‘ÍÍ•Ñ5•Ñ„¡…ÍÍ•Ð¥ôð½ÍÁ…¸ø(€€€€€€€€€€€€€€€€€€€€€€€€€€€€ñÍµ…±°ùí…ÍÍ•Ñ-¥¹‘1…‰•°¡…ÍÍ•Ð¥ôƒ
Üíµ•Ñ¡½‘1…‰•°¡…ÍÍ•Ð¹Í•±•Ñ•‘5•Ñ¡½¥õíÉ•ÅÕ¥É•€ü€œƒ
ÜÕÉÉ•¹Ð…ÍÍ•Ðœ€è€œôð½Íµ…±°ø(€€€€€€€€€€€€€€€€€€€€€€€€€€ð½ÍÁ…¸ø(€€€€€€€€€€€€€€€€€€€€€€€€€€ñÍÁ…¸±…ÍÍ9…µ”õíÍÑå±•Ì¹Á‘™ÍÍ•Ñ½Ý¹±½…‘Y…±Õ•ôø(€€€€€€€€€€€€€€€€€€€€€€€€€€€€ñÍÑÉ½¹œùíµ½¹•ä¡…ÍÍ•Ð¹Ù…±Õ”¥ôð½ÍÑÉ½¹œø(€€€€€€€€€€€€€€€€€€€€€€€€€€€€ñÍµ…±°ùÕÉÉ•¹ÐÙ…±Õ”ð½Íµ…±°ø(€€€€€€€€€€€€€€€€€€€€€€€€€€ð½ÍÁ…¸ø(€€€€€€€€€€€€€€€€€€€€€€€€ð½±…‰•°ø(€€€€€€€€€€€€€€€€€€€€€€¤ì(€€€€€€€€€€€€€€€€€€€ô¤€è€ñ‘¥Ø±…ÍÍ9…µ”õíÍÑå±•Ì¹Á‘™ÍÍ•Ñ½Ý¹±½…‘µÁÑåôù9¼…ÍÍ•ÑÌµ…Ñ å½ÕÈÍ•…É ¸ð½‘¥Øùô(€€€€€€€€€€€€€€€€€€ð½‘¥Øø(€€€€€€€€€€€€€€€€ð½Í•Ñ¥½¸ø(€€€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”õí€‘íÍÑå±•Ì¹™½ÉµÑ¥½¹Íô€‘íÍÑå±•Ì¹•áÁ½ÉÑÑ¥½¹Íô€‘íÍÑå±•Ì¹Á‘™ÍÍ•Ñ½Ý¹±½…‘Ñ¥½¹Íõôø(€€€€€€€€€€€€€€€€€€ñ‰ÕÑÑ½¸ÑåÁ”ô‰‰ÕÑÑ½¸ˆ±…ÍÍ9…µ”õíÍÑå±•Ì¹Í•½¹‘…Éå	ÕÑÑ½¹ô½¹±¥¬õì ¤€ôøÍ•Ñ	Õ±­¥¹…¹•ÍÍ•ÑA¥­•É=Á•¸¡™…±Í”¥ôù	…¬ð½‰ÕÑÑ½¸ø(€€€€€€€€€€€€€€€€€€ñ‰ÕÑÑ½¸ÑåÁ”ô‰‰ÕÑÑ½¸ˆ±…ÍÍ9…µ”õíÍÑå±•Ì¹ÁÉ¥µ…Éå	ÕÑÑ½¹ô½¹±¥¬õì ¤€ôøÍ•Ñ	Õ±­¥¹…¹•ÍÍ•ÑA¥­•É=Á•¸¡™…±Í”¥ôùí‰Õ±­¥¹…¹•ÍÍ•Ñ%‘Ì¹±•¹Ñ¡ôÍ•±•Ñ•ƒ
Ü½¹”ð½‰ÕÑÑ½¸ø(€€€€€€€€€€€€€€€€ð½‘¥Øø(€€€€€€€€€€€€€€ð½‘¥Øø(€€€€€€€€€€€€ð½‘¥Øø(€€€€€€€€€€ð½‘¥Øø(€€€€€€€€ð½‘¥Øø(€€€€€€¤€è¹Õ±±ô((€€€€€í‘¥ÍÁ½Í…±…¹‘¥‘…Ñ•ÍÍ•Ð€ü€ (€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”õí€‘íÍÑå±•Ì¹µ½‘…±=Ù•É±…åô€‘íÍÑå±•Ì¹½¹™¥Éµ•±•Ñ•=Ù•É±…åõôø(€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”õíÍÑå±•Ì¹µ½‘…±	…­‘É½Áô½¹±¥¬õì ¤€ôøì¥˜€ …‰ÕÍå•±•Ñ•%¤Í•Ñ¥ÍÁ½Í…±…¹‘¥‘…Ñ•ÍÍ•Ð¡¹Õ±°¤ìõô€¼ø(€€€€€€€€€€ñ™½É´±…ÍÍ9…µ”õí€‘íÍÑå±•Ì¹µ½‘…±…É‘ô€‘íÍÑå±•Ì¹…ÍÍ•Ñ1¥™•å±•5½‘…±ô€‘íÍÑå±•Ì¹…ÍÍ•Ñ¥ÍÁ½Í…±5½‘…±õôÉ½±”ô‰‘¥…±½œˆ…É¥„µµ½‘…°ô‰ÑÉÕ”ˆ…É¥„µ±…‰•±±•‘‰äô‰‘¥ÍÁ½Í…°µÑ¥Ñ±”ˆ½¹MÕ‰µ¥Ðõí¡…¹‘±•½¹™¥Éµ¥ÍÁ½Í…±ôø(€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”õí€‘íÍÑå±•Ì¹µ½‘…±!•…‘•Éô€‘íÍÑå±•Ì¹…ÍÍ•Ñ¥ÍÁ½Í…±!•…‘•Éõôø(€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”õíÍÑå±•Ì¹µ½‘…±!•…‘•ÉQ•áÑôø(€€€€€€€€€€€€€€€€ñ Ì¥ô‰‘¥ÍÁ½Í…°µÑ¥Ñ±”ˆù]¡…Ð¡…ÁÁ•¹•Ñ¼Ñ¡¥Ì…ÍÍ•Ðüð½ Ìø(€€€€€€€€€€€€€€€€ñÀùí‘¥ÍÁ½Í…±…¹‘¥‘…Ñ•ÍÍ•Ð¹Ñ¥Ñ±•ôð½Àø(€€€€€€€€€€€€€€ð½‘¥Øø(€€€€€€€€€€€€€€ñ‰ÕÑÑ½¸ÑåÁ”ô‰‰ÕÑÑ½¸ˆ±…ÍÍ9…µ”õíÍÑå±•Ì¹µ½‘…±±½Í•	ÕÑÑ½¹ô½¹±¥¬õì ¤€ôøÍ•Ñ¥ÍÁ½Í…±…¹‘¥‘…Ñ•ÍÍ•Ð¡¹Õ±°¥ô‘¥Í…‰±•õí‰ÕÍå•±•Ñ•%€ôôô‘¥ÍÁ½Í…±…¹‘¥‘…Ñ•ÍÍ•Ð¹¥‘ô…É¥„µ±…‰•°ô‰±½Í”‘¥ÍÁ½Í…°‘•Ñ…¥±Ìˆø(€€€€€€€€€€€€€€€€ñ±½Í•%½¸±…ÍÍ9…µ”õíÍÑå±•Ì¹‰ÕÑÑ½¹%½¹ô€¼ø(€€€€€€€€€€€€€€ð½‰ÕÑÑ½¸ø(€€€€€€€€€€€€ð½‘¥Øø(€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”õí€‘íÍÑå±•Ì¹µ½‘…±MÉ½±±	½‘åô€‘íÍÑå±•Ì¹…ÍÍ•Ñ1¥™•å±•	½‘åô€‘íÍÑå±•Ì¹…ÍÍ•Ñ¥ÍÁ½Í…±	½‘åõôø(€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”õíÍÑå±•Ì¹…ÍÍ•Ñ¥ÍÁ½Í…±%¹ÑÉ½ôøñÍÑÉ½¹œù¡½½Í”Ý¡…Ð¡…ÁÁ•¹•ð½ÍÑÉ½¹œøñÍµ…±°ùQ¡”…ÍÍ•ÐÝ¥±°‰”…É¡¥Ù•Õ¹±•ÍÌ¥ÐÝ…Ì…‘‘•‰äµ¥ÍÑ…­”¸ð½Íµ…±°øð½‘¥Øø(€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”õíÍÑå±•Ì¹…ÍÍ•Ñ¥ÍÁ½Í…±I•…Í½¹É¥‘ôÉ½±”ô‰É½ÕÀˆ…É¥„µ±…‰•°ô‰I•…Í½¸™½ÈÉ•µ½Ù¥¹œ…ÍÍ•Ðˆø(€€€€€€€€€€€€€€€ì¡l(€€€€€€€€€€€€€€€€€lÍ½±œ°€M½±t°(€€€€€€€€€€€€€€€€€lÑÉ…‘•‘}¥¸œ°€QÉ…‘•¥¸t°(€€€€€€€€€€€€€€€€€lÍÉ…ÁÁ•œ°€MÉ…ÁÁ•t°(€€€€€€€€€€€€€€€€€lÝÉ¥ÑÑ•¹}½™˜œ°€]É¥ÑÑ•¸½™˜t°(€€€€€€€€€€€€€€€€€lµ¥ÍÑ…­•}‘ÕÁ±¥…Ñ”œ°€‘‘•‰äµ¥ÍÑ…­”t°(€€€€€€€€€€€€€€€€€l½Ñ¡•Èœ°€=Ñ¡•Èt°(€€€€€€€€€€€€€€€t…Ì½¹ÍÐ¤¹µ…À ¡mÙ…±Õ”°±…‰•±t¤€ôø€ (€€€€€€€€€€€€€€€€€€ñ‰ÕÑÑ½¸­•äõíÙ…±Õ•ôÑåÁ”ô‰‰ÕÑÑ½¸ˆ±…ÍÍ9…µ”õí€‘íÍÑå±•Ì¹…ÍÍ•Ñ¥ÍÁ½Í…±I•…Í½¹	ÕÑÑ½¹ô€‘í‘¥ÍÁ½Í…±É…™Ð¹É•…Í½¸€ôôôÙ…±Õ”€üÍÑå±•Ì¹…ÍÍ•Ñ¥ÍÁ½Í…±I•…Í½¹	ÕÑÑ½¹Ñ¥Ù”€è€œõô…É¥„µÁÉ•ÍÍ•õí‘¥ÍÁ½Í…±É…™Ð¹É•…Í½¸€ôôôÙ…±Õ•ô½¹±¥¬õì ¤€ôøÍ•Ñ¥ÍÁ½Í…±É…™Ð ¡ÕÉÉ•¹Ð¤€ôø€¡ì€¸¸¹ÕÉÉ•¹Ð°É•…Í½¸èÙ…±Õ”…Ì¥ÍÁ½Í…±I•…Í½¸ô¤¥ôø(€€€€€€€€€€€€€€€€€€€€ñÍÁ…¸±…ÍÍ9…µ”õíÍÑå±•Ì¹…ÍÍ•Ñ¥ÍÁ½Í…±I•…Í½¹5…É­•Éô…É¥„µ¡¥‘‘•¸ô‰ÑÉÕ”ˆ€¼ø(€€€€€€€€€€€€€€€€€€€€ñÍÑÉ½¹œùí±…‰•±ôð½ÍÑÉ½¹œø(€€€€€€€€€€€€€€€€€€ð½‰ÕÑÑ½¸ø(€€€€€€€€€€€€€€€€¤¥ô(€€€€€€€€€€€€€€ð½‘¥Øø(€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”õí€‘íÍÑå±•Ì¹…ÍÍ•Ñ1¥™•å±•¥•±‘Íô€‘íÍÑå±•Ì¹…ÍÍ•Ñ¥ÍÁ½Í…±¥•±‘Íõôø(€€€€€€€€€€€€€€€€ñ±…‰•°±…ÍÍ9…µ”õíÍÑå±•Ì¹…ÍÍ•ÑM•ÑÑ¥¹Í¥•±‘ôø(€€€€€€€€€€€€€€€€€€ñÍÁ…¸ù¥ÍÁ½Í…°‘…Ñ”ð½ÍÁ…¸ø(€€€€€€€€€€€€€€€€€€ñ¥¹ÁÕÐÑåÁ”ô‰‘…Ñ”ˆÉ•ÅÕ¥É•Ù…±Õ”õí‘¥ÍÁ½Í…±É…™Ð¹‘¥ÍÁ½Í…±…Ñ•ô½¹¡…¹”õì¡•Ù•¹Ð¤€ôøÍ•Ñ¥ÍÁ½Í…±É…™Ð ¡ÕÉÉ•¹Ð¤€ôø€¡ì€¸¸¹ÕÉÉ•¹Ð°‘¥ÍÁ½Í…±…Ñ”è•Ù•¹Ð¹Ñ…É•Ð¹Ù…±Õ”ô¤¥ô€¼ø(€€€€€€€€€€€€€€€€ð½±…‰•°ø(€€€€€€€€€€€€€€€€ñ±…‰•°±…ÍÍ9…µ”õíÍÑå±•Ì¹…ÍÍ•ÑM•ÑÑ¥¹Í¥•±‘ôø(€€€€€€€€€€€€€€€€€€ñÍÁ…¸ù¥ÍÁ½Í…°…µ½Õ¹Ð€ñÍµ…±°ù=ÁÑ¥½¹…°°•á°¸YPð½Íµ…±°øð½ÍÁ…¸ø(€€€€€€€€€€€€€€€€€€ñ¥¹ÁÕÐ¥¹ÁÕÑ5½‘”ô‰‘•¥µ…°ˆÙ…±Õ”õí‘¥ÍÁ½Í…±É…™Ð¹‘¥ÍÁ½Í…±µ½Õ¹ÑáY…Ñô½¹¡…¹”õì¡•Ù•¹Ð¤€ôøÍ•Ñ¥ÍÁ½Í…±É…™Ð ¡ÕÉÉ•¹Ð¤€ôø€¡ì€¸¸¹ÕÉÉ•¹Ð°‘¥ÍÁ½Í…±µ½Õ¹ÑáY…Ðè•Ù•¹Ð¹Ñ…É•Ð¹Ù…±Õ”ô¤¥ôÁ±…•¡½±‘•Èô‰H€Àˆ€¼ø(€€€€€€€€€€€€€€€€ð½±…‰•°ø(€€€€€€€€€€€€€€€€ñ±…‰•°±…ÍÍ9…µ”õí€‘íÍÑå±•Ì¹…ÍÍ•ÑM•ÑÑ¥¹Í¥•±‘ô€‘íÍÑå±•Ì¹…ÍÍ•Ñ¥ÍÁ½Í…±9½Ñ•¥•±‘õôø(€€€€€€€€€€€€€€€€€€ñÍÁ…¸ù9½Ñ”€ñÍµ…±°ù=ÁÑ¥½¹…°ð½Íµ…±°øð½ÍÁ…¸ø(€€€€€€€€€€€€€€€€€€ñÑ•áÑ…É•„Ù…±Õ”õí‘¥ÍÁ½Í…±É…™Ð¹¹½Ñ•ô½¹¡…¹”õì¡•Ù•¹Ð¤€ôøÍ•Ñ¥ÍÁ½Í…±É…™Ð ¡ÕÉÉ•¹Ð¤€ôø€¡ì€¸¸¹ÕÉÉ•¹Ð°¹½Ñ”è•Ù•¹Ð¹Ñ…É•Ð¹Ù…±Õ”ô¤¥ôÁ±…•¡½±‘•Èô‰‘„‰Õå•È°ÑÉ…‘”µ¥¸°ÝÉ¥Ñ”µ½™˜½È½Ñ¡•ÈÉ•™•É•¹”ˆ€¼ø(€€€€€€€€€€€€€€€€ð½±…‰•°ø(€€€€€€€€€€€€€€ð½‘¥Øø(€€€€€€€€€€€€€í‘¥ÍÁ½Í…±É…™Ð¹É•…Í½¸€ôôô€µ¥ÍÑ…­•}‘ÕÁ±¥…Ñ”œ€ü€ (€€€€€€€€€€€€€€€€ñÀ±…ÍÍ9…µ”õí€‘íÍÑå±•Ì¹…ÍÍ•Ñ1¥™•å±•9½Ñ¥•ô€‘íÍÑå±•Ì¹…ÍÍ•Ñ¥ÍÁ½Í…±•±•Ñ•9½Ñ¥•õôø(€€€€€€€€€€€€€€€€€Q¡¥ÌÁ•Éµ…¹•¹Ñ±äÉ•µ½Ù•ÌÑ¡”‘ÕÁ±¥…Ñ”…ÍÍ•Ð¸‘•±•Ñ¥½¸…Õ‘¥Ð…¹™¥¹…°…ÍÍ•ÐÍ¹…ÁÍ¡½Ð…É”É•Ñ…¥¹•¸(€€€€€€€€€€€€€€€€ð½Àø(€€€€€€€€€€€€€€¤€è¹Õ±±ô(€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”õí€‘íÍÑå±•Ì¹…ÍÍ•ÑM•ÑÑ¥¹ÍÑ¥½¹Íô€‘íÍÑå±•Ì¹…ÍÍ•Ñ¥ÍÁ½Í…±Ñ¥½¹Íõôø(€€€€€€€€€€€€€€€€ñ‰ÕÑÑ½¸ÑåÁ”ô‰‰ÕÑÑ½¸ˆ±…ÍÍ9…µ”õíÍÑå±•Ì¹Í•½¹‘…Éå	ÕÑÑ½¹ô½¹±¥¬õì ¤€ôøÍ•Ñ¥ÍÁ½Í…±…¹‘¥‘…Ñ•ÍÍ•Ð¡¹Õ±°¥ô‘¥Í…‰±•õí‰ÕÍå•±•Ñ•%€ôôô‘¥ÍÁ½Í…±…¹‘¥‘…Ñ•ÍÍ•Ð¹¥‘ôù…¹•°ð½‰ÕÑÑ½¸ø(€€€€€€€€€€€€€€€€ñ‰ÕÑÑ½¸ÑåÁ”ô‰ÍÕ‰µ¥Ðˆ±…ÍÍ9…µ”õí€‘íÍÑå±•Ì¹ÁÉ¥µ…Éå	ÕÑÑ½¹ô€‘íÍÑå±•Ì¹‘•±•Ñ•½¹™¥Éµ	ÕÑÑ½¹õô‘¥Í…‰±•õí‰ÕÍå•±•Ñ•%€ôôô‘¥ÍÁ½Í…±…¹‘¥‘…Ñ•ÍÍ•Ð¹¥ñð€…‘¥ÍÁ½Í…±É…™Ð¹É•…Í½¹ôø(€€€€€€€€€€€€€€€€€í‰ÕÍå•±•Ñ•%€ôôô‘¥ÍÁ½Í…±…¹‘¥‘…Ñ•ÍÍ•Ð¹¥€ü€M…Ù¥¹ŸŠ˜œ€è‘¥ÍÁ½Í…±É…™Ð¹É•…Í½¸€ôôô€µ¥ÍÑ…­•}‘ÕÁ±¥…Ñ”œ€ü€•±•Ñ”‘ÕÁ±¥…Ñ”œ€è€M…Ù”‘¥ÍÁ½Í…°ô(€€€€€€€€€€€€€€€€ð½‰ÕÑÑ½¸ø(€€€€€€€€€€€€€€ð½‘¥Øø(€€€€€€€€€€€€ð½‘¥Øø(€€€€€€€€€€ð½™½É´ø(€€€€€€€€ð½‘¥Øø(€€€€€€¤€è¹Õ±±ô((€€€€€í¥ÍáÁ½ÉÑ5½‘…±=Á•¸€ü€ (€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”õí€‘íÍÑå±•Ì¹µ½‘…±=Ù•É±…åô€‘íÍÑå±•Ì¹•áÁ½ÉÑ5½‘…±=Ù•É±…åõôø(€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”õíÍÑå±•Ì¹µ½‘…±	…­‘É½Áô½¹±¥¬õí±½Í•áÁ½ÉÑ5½‘…±ô€¼ø((€€€€€€€€€€ñ‘¥Ø(€€€€€€€€€€€±…ÍÍ9…µ”õí€‘íÍÑå±•Ì¹µ½‘…±…É‘ô€‘íÍÑå±•Ì¹•áÁ½ÉÑ5½‘…±ô€‘í•áÁ½ÉÑMÑ•À€ôôô€Á‘˜µ…ÍÍ•ÑÌœ€üÍÑå±•Ì¹•áÁ½ÉÑÍÍ•ÑA¥­•É5½‘…°€è€œõô(€€€€€€€€€€€É½±”ô‰‘¥…±½œˆ(€€€€€€€€€€€…É¥„µµ½‘…°ô‰ÑÉÕ”ˆ(€€€€€€€€€€€…É¥„µ±…‰•±±•‘‰äô‰•áÁ½ÉÐµÑ¥Ñ±”ˆ(€€€€€€€€€€ø(€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”õí€‘íÍÑå±•Ì¹µ½‘…±!•…‘•Éô€‘íÍÑå±•Ì¹•áÁ½ÉÑ5½‘…±!•…‘•Éõôø(€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”õíÍÑå±•Ì¹µ½‘…±!•…‘•ÉQ•áÑôø(€€€€€€€€€€€€€€€€ñ Ì¥ô‰•áÁ½ÉÐµÑ¥Ñ±”ˆùáÁ½ÉÐ…ÍÍ•ÐÉ•¥ÍÑ•Èð½ Ìø(€€€€€€€€€€€€€€ð½‘¥Øø((€€€€€€€€€€€€€€ñ‰ÕÑÑ½¸ÑåÁ”ô‰‰ÕÑÑ½¸ˆ±…ÍÍ9…µ”õíÍÑå±•Ì¹µ½‘…±±½Í•	ÕÑÑ½¹ô½¹±¥¬õí±½Í•áÁ½ÉÑ5½‘…±ô…É¥„µ±…‰•°ô‰±½Í”•áÁ½ÉÐ½ÁÑ¥½¹Ìˆø(€€€€€€€€€€€€€€€€ñ±½Í•%½¸±…ÍÍ9…µ”õíÍÑå±•Ì¹‰ÕÑÑ½¹%½¹ô€¼ø(€€€€€€€€€€€€€€ð½‰ÕÑÑ½¸ø(€€€€€€€€€€€€ð½‘¥Øø((€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”õí€‘íÍÑå±•Ì¹µ½‘…±MÉ½±±	½‘åô€‘íÍÑå±•Ì¹•áÁ½ÉÑ5½‘…±MÉ½±±	½‘åõôø(€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”õíÍÑå±•Ì¹•áÁ½ÉÑ5½‘…±	½‘åôø(€€€€€€€€€€€€€€€í•áÁ½ÉÑMÑ•À€ôôô€™½Éµ…Ðœ€ü€ (€€€€€€€€€€€€€€€€€€ðø(€€€€€€€€€€€€€€€€€€€€ñ±…‰•°±…ÍÍ9…µ”õí€‘íÍÑå±•Ì¹™¥•±‘ô€‘íÍÑå±•Ì¹•áÁ½ÉÑ¹Ñ¥Ñå9…µ•¥•±‘õôø(€€€€€€€€€€€€€€€€€€€€€€ñÍÁ…¸ùÍÍ•ÐÉ•¥ÍÑ•È€¼É•Á½ÉÐ¹…µ”ð½ÍÁ…¸ø(€€€€€€€€€€€€€€€€€€€€€€ñ¥¹ÁÕÐ(€€€€€€€€€€€€€€€€€€€€€€€Ù…±Õ”õí•áÁ½ÉÑ¹Ñ¥Ñå9…µ•ô(€€€€€€€€€€€€€€€€€€€€€€€½¹¡…¹”õì¡•Ù•¹Ð¤€ôøÍ•ÑáÁ½ÉÑ¹Ñ¥Ñå9…µ”¡•Ù•¹Ð¹Ñ…É•Ð¹Ù…±Õ”¥ô(€€€€€€€€€€€€€€€€€€€€€€€Á±…•¡½±‘•Èô‰¹Ñ•ÈÑ¡”…ÍÍ•ÐÉ•¥ÍÑ•È½ÈÉ•Á½ÉÐ¹…µ”ˆ(€€€€€€€€€€€€€€€€€€€€€€€‘¥Í…‰±•õí¥ÍáÁ½ÉÑ¥¹ô(€€€€€€€€€€€€€€€€€€€€€€¼ø(€€€€€€€€€€€€€€€€€€€€ð½±…‰•°ø((€€€€€€€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”õíÍÑå±•Ì¹•áÁ½ÉÑ¡½¥•Íôø(€€€€€€€€€€€€€€€€€€€€€€ñ‰ÕÑÑ½¸(€€€€€€€€€€€€€€€€€€€€€€€ÑåÁ”ô‰‰ÕÑÑ½¸ˆ(€€€€€€€€€€€€€€€€€€€€€€€±…ÍÍ9…µ”õí€‘íÍÑå±•Ì¹•áÁ½ÉÑ=ÁÑ¥½¹ô€‘í•áÁ½ÉÑ½Éµ…Ð€ôôô€Á‘˜œ€üÍÑå±•Ì¹•áÁ½ÉÑ=ÁÑ¥½¹Ñ¥Ù”€è€œõô(€€€€€€€€€€€€€€€€€€€€€€€½¹±¥¬õì ¤€ôøÍ•±•ÑáÁ½ÉÑ½Éµ…Ð Á‘˜œ¥ô(€€€€€€€€€€€€€€€€€€€€€€€…É¥„µÁÉ•ÍÍ•õí•áÁ½ÉÑ½Éµ…Ð€ôôô€Á‘˜ô(€€€€€€€€€€€€€€€€€€€€€€ø(€€€€€€€€€€€€€€€€€€€€€€€€ñÍÁ…¸±…ÍÍ9…µ”õíÍÑå±•Ì¹•áÁ½ÉÑÉ…Á¡¥ôø(€€€€€€€€€€€€€€€€€€€€€€€€€€ñáÁ½ÉÑÉ…Á¡¥ŒÍÉŒôˆ½‰É…¹½Á‘˜¹Á¹œˆ…±Ðô‰A•áÁ½ÉÐˆ¥½¸õìñA‘™%½¸±…ÍÍ9…µ”õíÍÑå±•Ì¹•áÁ½ÉÑ=ÁÑ¥½¹%½¹ô€¼ùô€¼ø(€€€€€€€€€€€€€€€€€€€€€€€€ð½ÍÁ…¸ø((€€€€€€€€€€€€€€€€€€€€€€€€ñÍÁ…¸±…ÍÍ9…µ”õíÍÑå±•Ì¹•áÁ½ÉÑ=ÁÑ¥½¹Q¥Ñ±•	±½­ôø(€€€€€€€€€€€€€€€€€€€€€€€€€€ñÍÑÉ½¹œùAÉ•Á½ÉÐð½ÍÑÉ½¹œø(€€€€€€€€€€€€€€€€€€€€€€€€€€ñÍµ…±°ù¡½½Í”„±•…ÈAÉ•Á½ÉÐ™½È±¥•¹ÑÌ°‰…¹­Ì½È¥¹ÍÕÉ…¹”Á…ÉÑ¹•ÉÌ¸ð½Íµ…±°ø(€€€€€€€€€€€€€€€€€€€€€€€€ð½ÍÁ…¸ø(€€€€€€€€€€€€€€€€€€€€€€ð½‰ÕÑÑ½¸ø((€€€€€€€€€€€€€€€€€€€€€€ñ‰ÕÑÑ½¸(€€€€€€€€€€€€€€€€€€€€€€€ÑåÁ”ô‰‰ÕÑÑ½¸ˆ(€€€€€€€€€€€€€€€€€€€€€€€±…ÍÍ9…µ”õí€‘íÍÑå±•Ì¹•áÁ½ÉÑ=ÁÑ¥½¹ô€‘í•áÁ½ÉÑ½Éµ…Ð€ôôô€á±Íàœ€üÍÑå±•Ì¹•áÁ½ÉÑ=ÁÑ¥½¹Ñ¥Ù”€è€œõô(€€€€€€€€€€€€€€€€€€€€€€€½¹±¥¬õì ¤€ôøÍ•±•ÑáÁ½ÉÑ½Éµ…Ð á±Íàœ¥ô(€€€€€€€€€€€€€€€€€€€€€€€…É¥„µÁÉ•ÍÍ•õí•áÁ½ÉÑ½Éµ…Ð€ôôô€á±Íàô(€€€€€€€€€€€€€€€€€€€€€€ø(€€€€€€€€€€€€€€€€€€€€€€€€ñÍÁ…¸±…ÍÍ9…µ”õíÍÑå±•Ì¹•áÁ½ÉÑÉ…Á¡¥ôø(€€€€€€€€€€€€€€€€€€€€€€€€€€ñáÁ½ÉÑÉ…Á¡¥ŒÍÉŒôˆ½‰É…¹½Í¡••Ð¹Á¹œˆ…±Ðô‰MÁÉ•…‘Í¡••Ð•áÁ½ÉÐˆ¥½¸õìñMÁÉ•…‘Í¡••Ñ%½¸±…ÍÍ9…µ”õíÍÑå±•Ì¹•áÁ½ÉÑ=ÁÑ¥½¹%½¹ô€¼ùô€¼ø(€€€€€€€€€€€€€€€€€€€€€€€€ð½ÍÁ…¸ø((€€€€€€€€€€€€€€€€€€€€€€€€ñÍÁ…¸±…ÍÍ9…µ”õíÍÑå±•Ì¹•áÁ½ÉÑ=ÁÑ¥½¹Q¥Ñ±•	±½­ôø(€€€€€€€€€€€€€€€€€€€€€€€€€€ñÍÑÉ½¹œùa1M`Ý½É­‰½½¬ð½ÍÑÉ½¹œø(€€€€€€€€€€€€€€€€€€€€€€€€€€ñÍµ…±°ù½Ý¹±½……±°É•¥ÍÑ•ÈÉ½ÝÌ¥¸…¸á•°µÉ•…‘äÝ½É­‰½½¬¸ð½Íµ…±°ø(€€€€€€€€€€€€€€€€€€€€€€€€ð½ÍÁ…¸ø(€€€€€€€€€€€€€€€€€€€€€€ð½‰ÕÑÑ½¸ø(€€€€€€€€€€€€€€€€€€€€ð½‘¥Øø((€€€€€€€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”õí€‘íÍÑå±•Ì¹™½ÉµÑ¥½¹Íô€‘íÍÑå±•Ì¹•áÁ½ÉÑÑ¥½¹Íõôø(€€€€€€€€€€€€€€€€€€€€€€ñ‰ÕÑÑ½¸ÑåÁ”ô‰‰ÕÑÑ½¸ˆ±…ÍÍ9…µ”õíÍÑå±•Ì¹Í•½¹‘…Éå	ÕÑÑ½¹ô½¹±¥¬õí±½Í•áÁ½ÉÑ5½‘…±ô‘¥Í…‰±•õí¥ÍáÁ½ÉÑ¥¹ôø(€€€€€€€€€€€€€€€€€€€€€€€…¹•°(€€€€€€€€€€€€€€€€€€€€€€ð½‰ÕÑÑ½¸ø((€€€€€€€€€€€€€€€€€€€€€€ñ‰ÕÑÑ½¸ÑåÁ”ô‰‰ÕÑÑ½¸ˆ±…ÍÍ9…µ”õíÍÑå±•Ì¹ÁÉ¥µ…Éå	ÕÑÑ½¹ô½¹±¥¬õí¡…¹‘±•½¹™¥ÉµáÁ½ÉÑô‘¥Í…‰±•õí¥ÍáÁ½ÉÑ¥¹ôø(€€€€€€€€€€€€€€€€€€€€€€€í•áÁ½ÉÑ½Éµ…Ð€ôôô€Á‘˜œ€ü€ñ¡•ÙÉ½¹I¥¡Ñ%½¸±…ÍÍ9…µ”õíÍÑå±•Ì¹‰ÕÑÑ½¹%½¹ô€¼ø€è€ñ½Ý¹±½…‘%½¸±…ÍÍ9…µ”õíÍÑå±•Ì¹‰ÕÑÑ½¹%½¹ô€¼ùô(€€€€€€€€€€€€€€€€€€€€€€€€ñÍÁ…¸ùí•áÁ½ÉÑ½Éµ…Ð€ôôô€Á‘˜œ€ü€9•áÐœ€è¥ÍáÁ½ÉÑ¥¹œ€ü€AÉ•Á…É¥¹œ•áÁ½ÉÐ¸¸¸œ€è€½Ý¹±½…a1M`ôð½ÍÁ…¸ø(€€€€€€€€€€€€€€€€€€€€€€ð½‰ÕÑÑ½¸ø(€€€€€€€€€€€€€€€€€€€€ð½‘¥Øø(€€€€€€€€€€€€€€€€€€ð¼ø(€€€€€€€€€€€€€€€€¤€è€ (€€€€€€€€€€€€€€€€€€ðø(€€€€€€€€€€€€€€€€€€€í•áÁ½ÉÑMÑ•À€ôôô€Á‘˜µÉ•Á½ÉÐœ€ü€ (€€€€€€€€€€€€€€€€€€€€€€ðø(€€€€€€€€€€€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”õíÍÑå±•Ì¹Á‘™I•Á½ÉÑM•±•Ñ½Éôø(€€€€€€€€€€€€€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”õíÍÑå±•Ì¹Á‘™I•Á½ÉÑQ½Á¡½¥•Íôø(€€€€€€€€€€€€€€€€€€€€€€€€€€€€ñ‰ÕÑÑ½¸(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€ÑåÁ”ô‰‰ÕÑÑ½¸ˆ(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€±…ÍÍ9…µ”õí€‘íÍÑå±•Ì¹Á‘™I•Á½ÉÑ=ÁÑ¥½¹ô€‘íÍÑå±•Ì¹Á‘™I•Á½ÉÑAÉ¥µ…Éå=ÁÑ¥½¹ô€‘íÁ‘™I•Á½ÉÑM•±•Ñ¥½¸€ôôô™Õ±±A‘™I•Á½ÉÑ=ÁÑ¥½¸¹Ù…±Õ”€üÍÑå±•Ì¹Á‘™I•Á½ÉÑ=ÁÑ¥½¹Ñ¥Ù”€è€œõô(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€½¹±¥¬õì ¤€ôø¡…¹‘±•A‘™I•Á½ÉÑ¡½¥”¡™Õ±±A‘™I•Á½ÉÑ=ÁÑ¥½¸¹Ù…±Õ”¥ô(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€‘¥Í…‰±•õí¥ÍáÁ½ÉÑ¥¹ô(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€…É¥„µÁÉ•ÍÍ•õíÁ‘™I•Á½ÉÑM•±•Ñ¥½¸€ôôô™Õ±±A‘™I•Á½ÉÑ=ÁÑ¥½¸¹Ù…±Õ•ô(€€€€€€€€€€€€€€€€€€€€€€€€€€€€ø(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€ñÍÁ…¸±…ÍÍ9…µ”õíÍÑå±•Ì¹Á‘™I•Á½ÉÑ=ÁÑ¥½¹5…¥¹ôø(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€ñÍÑÉ½¹œùí™Õ±±A‘™I•Á½ÉÑ=ÁÑ¥½¸¹±…‰•±ôð½ÍÑÉ½¹œø(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€ð½ÍÁ…¸ø(€€€€€€€€€€€€€€€€€€€€€€€€€€€€ð½‰ÕÑÑ½¸ø((€€€€€€€€€€€€€€€€€€€€€€€€€€€€ñ‰ÕÑÑ½¸(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€ÑåÁ”ô‰‰ÕÑÑ½¸ˆ(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€±…ÍÍ9…µ”õí€‘íÍÑå±•Ì¹Á‘™I•Á½ÉÑ=ÁÑ¥½¹ô€‘íÍÑå±•Ì¹Á‘™I•Á½ÉÑAÉ¥µ…Éå=ÁÑ¥½¹ô€‘íÍÑå±•Ì¹Á‘™I•Á½ÉÑMÁ•¥™¥=ÁÑ¥½¹õô(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€½¹±¥¬õí½Á•¹A‘™ÍÍ•Ñ¡½½Í•Éô(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€‘¥Í…‰±•õí¥ÍáÁ½ÉÑ¥¹ô(€€€€€€€€€€€€€€€€€€€€€€€€€€€€ø(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€ñÍÁ…¸±…ÍÍ9…µ”õíÍÑå±•Ì¹Á‘™I•Á½ÉÑ=ÁÑ¥½¹5…¥¹ôø(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€ñÍÑÉ½¹œù¡½½Í”MÁ•¥™¥ŒÍÍ•ÑÌð½ÍÑÉ½¹œø(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€ð½ÍÁ…¸ø(€€€€€€€€€€€€€€€€€€€€€€€€€€€€ð½‰ÕÑÑ½¸ø(€€€€€€€€€€€€€€€€€€€€€€€€€€ð½‘¥Øø((€€€€€€€€€€€€€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”õíÍÑå±•Ì¹Á‘™I•Á½ÉÑ¡½¥•Íôø(€€€€€€€€€€€€€€€€€€€€€€€€€€€íÅÕ¥­A‘™I•Á½ÉÑ=ÁÑ¥½¹Ì¹µ…À ¡½ÁÑ¥½¸¤€ôø€ (€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€ñ‰ÕÑÑ½¸(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€­•äõí½ÁÑ¥½¸¹Ù…±Õ•ô(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€ÑåÁ”ô‰‰ÕÑÑ½¸ˆ(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€±…ÍÍ9…µ”õí€‘íÍÑå±•Ì¹Á‘™I•Á½ÉÑ=ÁÑ¥½¹ô€‘íÁ‘™I•Á½ÉÑM•±•Ñ¥½¸€ôôô½ÁÑ¥½¸¹Ù…±Õ”€üÍÑå±•Ì¹Á‘™I•Á½ÉÑ=ÁÑ¥½¹Ñ¥Ù”€è€œõô(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€½¹±¥¬õì ¤€ôø¡…¹‘±•A‘™I•Á½ÉÑ¡½¥”¡½ÁÑ¥½¸¹Ù…±Õ”¥ô(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€‘¥Í…‰±•õí¥ÍáÁ½ÉÑ¥¹ô(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€…É¥„µÁÉ•ÍÍ•õíÁ‘™I•Á½ÉÑM•±•Ñ¥½¸€ôôô½ÁÑ¥½¸¹Ù…±Õ•ô(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€ø(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€ñÍÁ…¸±…ÍÍ9…µ”õíÍÑå±•Ì¹Á‘™I•Á½ÉÑ=ÁÑ¥½¹5…¥¹ôø(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€ñÍÑÉ½¹œùí½ÁÑ¥½¸¹±…‰•±ôð½ÍÑÉ½¹œø(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€ð½ÍÁ…¸ø(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€ð½‰ÕÑÑ½¸ø(€€€€€€€€€€€€€€€€€€€€€€€€€€€€¤¥ô(€€€€€€€€€€€€€€€€€€€€€€€€€€ð½‘¥Øø(€€€€€€€€€€€€€€€€€€€€€€€€ð½‘¥Øø((€€€€€€€€€€€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”õí€‘íÍÑå±•Ì¹™½ÉµÑ¥½¹Íô€‘íÍÑå±•Ì¹•áÁ½ÉÑÑ¥½¹Íõôø(€€€€€€€€€€€€€€€€€€€€€€€€€€ñ‰ÕÑÑ½¸ÑåÁ”ô‰‰ÕÑÑ½¸ˆ±…ÍÍ9…µ”õíÍÑå±•Ì¹Í•½¹‘…Éå	ÕÑÑ½¹ô½¹±¥¬õí±½Í•A‘™I•Á½ÉÑ¡½½Í•Éô‘¥Í…‰±•õí¥ÍáÁ½ÉÑ¥¹ôø(€€€€€€€€€€€€€€€€€€€€€€€€€€€	…¬(€€€€€€€€€€€€€€€€€€€€€€€€€€ð½‰ÕÑÑ½¸ø((€€€€€€€€€€€€€€€€€€€€€€€€€€ñ‰ÕÑÑ½¸ÑåÁ”ô‰‰ÕÑÑ½¸ˆ±…ÍÍ9…µ”õíÍÑå±•Ì¹Í•½¹‘…Éå	ÕÑÑ½¹ô½¹±¥¬õí±½Í•áÁ½ÉÑ5½‘…±ô‘¥Í…‰±•õí¥ÍáÁ½ÉÑ¥¹ôø(€€€€€€€€€€€€€€€€€€€€€€€€€€€…¹•°(€€€€€€€€€€€€€€€€€€€€€€€€€€ð½‰ÕÑÑ½¸ø(€€€€€€€€€€€€€€€€€€€€€€€€ð½‘¥Øø(€€€€€€€€€€€€€€€€€€€€€€ð¼ø(€€€€€€€€€€€€€€€€€€€€¤€è€ (€€€€€€€€€€€€€€€€€€€€€€ðø(€€€€€€€€€€€€€€€€€€€€€€€€ñÍ•Ñ¥½¸±…ÍÍ9…µ”õíÍÑå±•Ì¹Á‘™ÍÍ•Ñ½Ý¹±½…‘A…¹•±ô…É¥„µ±…‰•°ô‰¡½½Í”…ÍÍ•ÑÌ™½ÈA‘½Ý¹±½…ˆø(€€€€€€€€€€€€€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”õíÍÑå±•Ì¹Á‘™ÍÍ•Ñ½Ý¹±½…‘Q½½±‰…Éôø(€€€€€€€€€€€€€€€€€€€€€€€€€€€€ñ¥¹ÁÕÐ(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€±…ÍÍ9…µ”õíÍÑå±•Ì¹Á‘™ÍÍ•ÑM•…É¡%¹ÁÕÑô(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€ÑåÁ”ô‰Í•…É ˆ(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€Ù…±Õ”õíÁ‘™ÍÍ•ÑM•…É¡Q•Éµô(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€½¹¡…¹”õì¡•Ù•¹Ð¤€ôøÍ•ÑA‘™ÍÍ•ÑM•…É¡Q•É´¡•Ù•¹Ð¹Ñ…É•Ð¹Ù…±Õ”¥ô(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€Á±…•¡½±‘•Èô‰M•…É ¸¸¸ˆ(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€…É¥„µ±…‰•°ô‰M•…É …ÍÍ•ÑÌˆ(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€‘¥Í…‰±•õí¥ÍáÁ½ÉÑ¥¹ô(€€€€€€€€€€€€€€€€€€€€€€€€€€€€¼ø((€€€€€€€€€€€€€€€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”õíÍÑå±•Ì¹Á‘™ÍÍ•Ñ½Ý¹±½…‘Q½½±‰…ÉÑ¥½¹Íôø(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€ñ‰ÕÑÑ½¸(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€ÑåÁ”ô‰‰ÕÑÑ½¸ˆ(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€±…ÍÍ9…µ”õíÍÑå±•Ì¹Í•½¹‘…Éå	ÕÑÑ½¹ô(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€½¹±¥¬õíÍ•±•Ñ±±A‘™ÍÍ•ÑÍô(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€‘¥Í…‰±•õí¥ÍáÁ½ÉÑ¥¹œñðÙ¥Í¥‰±•A‘™ÍÍ•ÑÌ¹±•¹Ñ €ôôô€Àñð…±±Y¥Í¥‰±•A‘™ÍÍ•ÑÍM•±•Ñ•‘ô(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€ø(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€M•±•Ð…±°(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€ð½‰ÕÑÑ½¸ø((€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€ñ‰ÕÑÑ½¸(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€ÑåÁ”ô‰‰ÕÑÑ½¸ˆ(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€±…ÍÍ9…µ”õíÍÑå±•Ì¹Í•½¹‘…Éå	ÕÑÑ½¹ô(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€½¹±¥¬õí±•…ÉM•±•Ñ•‘A‘™ÍÍ•ÑÍô(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€‘¥Í…‰±•õí¥ÍáÁ½ÉÑ¥¹œñðÍ•±•Ñ•‘A‘™ÍÍ•Ñ½Õ¹Ð€ôôô€Áô(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€ø(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€±•…È(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€ð½‰ÕÑÑ½¸ø(€€€€€€€€€€€€€€€€€€€€€€€€€€€€ð½‘¥Øø(€€€€€€€€€€€€€€€€€€€€€€€€€€ð½‘¥Øø((€€€€€€€€€€€€€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”õíÍÑå±•Ì¹Á‘™ÍÍ•Ñ½Ý¹±½…‘1¥ÍÑôø(€€€€€€€€€€€€€€€€€€€€€€€€€€€íÙ¥Í¥‰±•A‘™ÍÍ•ÑÌ¹±•¹Ñ €ü€ (€€€€€€€€€€€€€€€€€€€€€€€€€€€€€Ù¥Í¥‰±•A‘™ÍÍ•ÑÌ¹µ…À ¡…ÍÍ•Ð¤€ôøì(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€½¹ÍÐ¥ÍM•±•Ñ•‘½ÉA‘˜€ôÍ•±•Ñ•‘A‘™ÍÍ•Ñ%‘M•Ð¹¡…Ì¡…ÍÍ•Ð¹¥¤ì((€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€É•ÑÕÉ¸€ (€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€ñ±…‰•°(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€­•äõí…ÍÍ•Ð¹¥‘ô(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€±…ÍÍ9…µ”õí€‘íÍÑå±•Ì¹Á‘™ÍÍ•Ñ½Ý¹±½…‘I½Ýô€‘í¥ÍM•±•Ñ•‘½ÉA‘˜€üÍÑå±•Ì¹Á‘™ÍÍ•Ñ½Ý¹±½…‘I½ÝM•±•Ñ•€è€œõô(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€ø(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€ñ¥¹ÁÕÐ(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€±…ÍÍ9…µ”õíÍÑå±•Ì¹Á‘™ÍÍ•Ñ½Ý¹±½…‘¡•­‰½á%¹ÁÕÑô(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€ÑåÁ”ô‰¡•­‰½àˆ(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€¡•­•õí¥ÍM•±•Ñ•‘½ÉA‘™ô(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€½¹¡…¹”õì ¤€ôøÑ½±•A‘™ÍÍ•ÑM•±•Ñ¥½¸¡…ÍÍ•Ð¹¥¥ô(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€‘¥Í…‰±•õí¥ÍáÁ½ÉÑ¥¹ô(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€¼ø(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€ñÍÁ…¸±…ÍÍ9…µ”õíÍÑå±•Ì¹Á‘™ÍÍ•Ñ½Ý¹±½…‘¡•­‰½áô…É¥„µ¡¥‘‘•¸ô‰ÑÉÕ”ˆ€¼ø((€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€ñÍÁ…¸±…ÍÍ9…µ”õíÍÑå±•Ì¹Á‘™ÍÍ•Ñ½Ý¹±½…‘½Áåôø(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€ñÍÑÉ½¹œùí…ÍÍ•Ð¹Ñ¥Ñ±•ôð½ÍÑÉ½¹œø(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€ñÍÁ…¸ùí‰Õ¥±‘ÍÍ•Ñ5•Ñ„¡…ÍÍ•Ð¥ôð½ÍÁ…¸ø(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€ñÍµ…±°ùí…ÍÍ•Ñ-¥¹‘1…‰•°¡…ÍÍ•Ð¥ôƒ
Üíµ•Ñ¡½‘1…‰•°¡…ÍÍ•Ð¹Í•±•Ñ•‘5•Ñ¡½¥ôð½Íµ…±°ø(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€ð½ÍÁ…¸ø((€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€ñÍÁ…¸±…ÍÍ9…µ”õíÍÑå±•Ì¹Á‘™ÍÍ•Ñ½Ý¹±½…‘Y…±Õ•ôø(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€ñÍÑÉ½¹œùíµ½¹•ä¡…ÍÍ•Ð¹Ù…±Õ”¥ôð½ÍÑÉ½¹œø(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€ñÍµ…±°ùÕÉÉ•¹ÐÙ…±Õ”ð½Íµ…±°ø(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€ð½ÍÁ…¸ø(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€ð½±…‰•°ø(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€¤ì(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€ô¤(€€€€€€€€€€€€€€€€€€€€€€€€€€€€¤€è€ (€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”õíÍÑå±•Ì¹Á‘™ÍÍ•Ñ½Ý¹±½…‘µÁÑåôù9¼…ÍÍ•ÑÌµ…Ñ å½ÕÈÍ•…É ¸ð½‘¥Øø(€€€€€€€€€€€€€€€€€€€€€€€€€€€€¥ô(€€€€€€€€€€€€€€€€€€€€€€€€€€ð½‘¥Øø(€€€€€€€€€€€€€€€€€€€€€€€€ð½Í•Ñ¥½¸ø((€€€€€€€€€€€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”õí€‘íÍÑå±•Ì¹™½ÉµÑ¥½¹Íô€‘íÍÑå±•Ì¹•áÁ½ÉÑÑ¥½¹Íô€‘íÍÑå±•Ì¹Á‘™ÍÍ•Ñ½Ý¹±½…‘Ñ¥½¹Íõôø(€€€€€€€€€€€€€€€€€€€€€€€€€€ñ‰ÕÑÑ½¸ÑåÁ”ô‰‰ÕÑÑ½¸ˆ±…ÍÍ9…µ”õíÍÑå±•Ì¹Í•½¹‘…Éå	ÕÑÑ½¹ô½¹±¥¬õí‰…­Q½A‘™I•Á½ÉÑ¡½½Í•Éô‘¥Í…‰±•õí¥ÍáÁ½ÉÑ¥¹ôø(€€€€€€€€€€€€€€€€€€€€€€€€€€€	…¬(€€€€€€€€€€€€€€€€€€€€€€€€€€ð½‰ÕÑÑ½¸ø((€€€€€€€€€€€€€€€€€€€€€€€€€€ñ‰ÕÑÑ½¸ÑåÁ”ô‰‰ÕÑÑ½¸ˆ±…ÍÍ9…µ”õíÍÑå±•Ì¹Í•½¹‘…Éå	ÕÑÑ½¹ô½¹±¥¬õí±½Í•áÁ½ÉÑ5½‘…±ô‘¥Í…‰±•õí¥ÍáÁ½ÉÑ¥¹ôø(€€€€€€€€€€€€€€€€€€€€€€€€€€€…¹•°(€€€€€€€€€€€€€€€€€€€€€€€€€€ð½‰ÕÑÑ½¸ø((€€€€€€€€€€€€€€€€€€€€€€€€€€ñ‰ÕÑÑ½¸(€€€€€€€€€€€€€€€€€€€€€€€€€€€ÑåÁ”ô‰‰ÕÑÑ½¸ˆ(€€€€€€€€€€€€€€€€€€€€€€€€€€€±…ÍÍ9…µ”õí€‘íÍÑå±•Ì¹ÁÉ¥µ…Éå	ÕÑÑ½¹ô€‘íÍÑå±•Ì¹Á‘™ÍÍ•Ñ½Ý¹±½…‘	ÕÑÑ½¹õô(€€€€€€€€€€€€€€€€€€€€€€€€€€€½¹±¥¬õì ¤€ôøÙ½¥¡…¹‘±•áÁ½ÉÑM•±•Ñ•‘A‘™I•Á½ÉÐ ¥ô(€€€€€€€€€€€€€€€€€€€€€€€€€€€‘¥Í…‰±•õí¥ÍáÁ½ÉÑ¥¹œñðÍ•±•Ñ•‘A‘™ÍÍ•Ñ½Õ¹Ð€ôôô€Áô(€€€€€€€€€€€€€€€€€€€€€€€€€€ø(€€€€€€€€€€€€€€€€€€€€€€€€€€€€ñ½Ý¹±½…‘%½¸±…ÍÍ9…µ”õíÍÑå±•Ì¹‰ÕÑÑ½¹%½¹ô€¼ø(€€€€€€€€€€€€€€€€€€€€€€€€€€€€ñÍÁ…¸ùí¥ÍáÁ½ÉÑ¥¹œ€ü€AÉ•Á…É¥¹œA¸¸¸œ€èÍ•±•Ñ•‘A‘™ÍÍ•Ñ½Õ¹Ð€ü½Ý¹±½…€‘íÍ•±•Ñ•‘A‘™ÍÍ•Ñ½Õ¹ÑôÍ•±•Ñ•A€€è€½Ý¹±½…Í•±•Ñ•Aôð½ÍÁ…¸ø(€€€€€€€€€€€€€€€€€€€€€€€€€€ð½‰ÕÑÑ½¸ø(€€€€€€€€€€€€€€€€€€€€€€€€ð½‘¥Øø(€€€€€€€€€€€€€€€€€€€€€€ð¼ø(€€€€€€€€€€€€€€€€€€€€¥ô(€€€€€€€€€€€€€€€€€€ð¼ø(€€€€€€€€€€€€€€€€¥ô(€€€€€€€€€€€€€€ð½‘¥Øø(€€€€€€€€€€€€ð½‘¥Øø(€€€€€€€€€€ð½‘¥Øø(€€€€€€€€ð½‘¥Øø(€€€€€€¤€è¹Õ±±ô((€€€€€íµ…É­•ÑÁ±…•ÍÍ•Ð€˜˜µ…É­•ÑÁ±…•É…™Ð€ü€ (€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”õíÍÑå±•Ì¹µ½‘…±=Ù•É±…åôø(€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”õíÍÑå±•Ì¹µ½‘…±	…­‘É½Áô½¹±¥¬õí±½Í•5…É­•ÑÁ±…•5½‘…±ô€¼ø((€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”õí€‘íÍÑå±•Ì¹µ½‘…±…É‘ô€‘íÍÑå±•Ì¹µ…É­•ÑÁ±…•5½‘…±õôÉ½±”ô‰‘¥…±½œˆ…É¥„µµ½‘…°ô‰ÑÉÕ”ˆ…É¥„µ±…‰•±±•‘‰äô‰µ…É­•ÑÁ±…”µ½¹™¥É´µÑ¥Ñ±”ˆø(€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”õí€‘íÍÑå±•Ì¹µ½‘…±!•…‘•Éô€‘íÍÑå±•Ì¹µ…É­•ÑÁ±…•5½‘…±!•…‘•Éõôø(€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”õíÍÑå±•Ì¹µ½‘…±!•…‘•ÉQ•áÑôø(€€€€€€€€€€€€€€€€ñ Ì¥ô‰µ…É­•ÑÁ±…”µ½¹™¥É´µÑ¥Ñ±”ˆùíµ…É­•ÑÁ±…•5½‘…±Q¥Ñ±•ôð½ Ìø(€€€€€€€€€€€€€€€€ñÀù¡•¬Ñ¡”±¥ÍÑ¥¹œÑ¥Ñ±”°…Í­¥¹œÁÉ¥”°Á¡½Ñ½Ì…¹Í•±±•È‘•Ñ…¥±Ì‰•™½É”¥Ð½•Ì±¥Ù”¸ð½Àø(€€€€€€€€€€€€€€ð½‘¥Øø((€€€€€€€€€€€€€€ñ‰ÕÑÑ½¸ÑåÁ”ô‰‰ÕÑÑ½¸ˆ±…ÍÍ9…µ”õíÍÑå±•Ì¹µ½‘…±±½Í•	ÕÑÑ½¹ô½¹±¥¬õí±½Í•5…É­•ÑÁ±…•5½‘…±ô…É¥„µ±…‰•°ô‰±½Í”µ…É­•ÑÁ±…”µ½‘…°ˆø(€€€€€€€€€€€€€€€€ñ±½Í•%½¸±…ÍÍ9…µ”õíÍÑå±•Ì¹‰ÕÑÑ½¹%½¹ô€¼ø(€€€€€€€€€€€€€€ð½‰ÕÑÑ½¸ø(€€€€€€€€€€€€ð½‘¥Øø((€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”õí€‘íÍÑå±•Ì¹µ½‘…±MÉ½±±	½‘åô€‘íÍÑå±•Ì¹µ…É­•ÑÁ±…•5½‘…±MÉ½±±	½‘åõôø(€€€€€€€€€€€€€€ñ™½É´±…ÍÍ9…µ”õíÍÑå±•Ì¹µ…É­•ÑÁ±…•½Éµô½¹MÕ‰µ¥Ðõí¡…¹‘±•½¹™¥Éµ5…É­•ÑÁ±…•AÕ‰±¥Í¡ôø(€€€€€€€€€€€€€€€€ñÍ•Ñ¥½¸±…ÍÍ9…µ”õíÍÑå±•Ì¹µ…É­•ÑÁ±…•ÍÍ•ÑMÕµµ…Éåôø(€€€€€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”õíÍÑå±•Ì¹µ…É­•ÑÁ±…•Q¥Ñ±•AÉ•Ù¥•Ýôø(€€€€€€€€€€€€€€€€€€€€ñÍÁ…¸ù1¥ÍÑ¥¹œÑ¥Ñ±”ð½ÍÁ…¸ø(€€€€€€€€€€€€€€€€€€€€ñÍÑÉ½¹œùíµ…É­•ÑÁ±…•1¥ÍÑ¥¹Q¥Ñ±•ôð½ÍÑÉ½¹œø(€€€€€€€€€€€€€€€€€€€€ñÍµ…±°ùe•…Èµ½‘•°°ÕÍ…”…¹½¹‘¥Ñ¥½¸…É”¥¹±Õ‘•¥¸Ñ¡”µ…É­•ÑÁ±…”Ñ¥Ñ±”¸ð½Íµ…±°ø(€€€€€€€€€€€€€€€€€€ð½‘¥Øø((€€€€€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”õíÍÑå±•Ì¹µ…É­•ÑÁ±…•ÍÍ•ÑMÕµµ…ÉåY…±Õ•ôø(€€€€€€€€€€€€€€€€€€€€ñÍÁ…¸ùI•¥ÍÑ•ÈÙ…±Õ”ð½ÍÁ…¸ø(€€€€€€€€€€€€€€€€€€€€ñÍÑÉ½¹œùíµ½¹•ä¡µ…É­•ÑÁ±…•ÍÍ•Ð¹Ù…±Õ”¥ôð½ÍÑÉ½¹œø(€€€€€€€€€€€€€€€€€€€€ñÍµ…±°ùá°¸YPð½Íµ…±°ø(€€€€€€€€€€€€€€€€€€ð½‘¥Øø(€€€€€€€€€€€€€€€€ð½Í•Ñ¥½¸ø((€€€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”õíÍÑå±•Ì¹µ…É­•ÑÁ±…•	½‘åÉ¥‘ôø(€€€€€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”õíÍÑå±•Ì¹µ…É­•ÑÁ±…•1¥ÍÑ¥¹½±Õµ¹ôø(€€€€€€€€€€€€€€€€€€€€ñÍ•Ñ¥½¸±…ÍÍ9…µ”õíÍÑå±•Ì¹µ…É­•ÑÁ±…•AÉ¥•A…¹•±ôø(€€€€€€€€€€€€€€€€€€€€€€ñ±…‰•°±…ÍÍ9…µ”õí€‘íÍÑå±•Ì¹™¥•±‘ô€‘íÍÑå±•Ì¹µ…É­•ÑÁ±…•AÉ¥•¥•±‘õôø(€€€€€€€€€€€€€€€€€€€€€€€€ñÍÁ…¸ùÍ­¥¹œÁÉ¥”•á°¸YPð½ÍÁ…¸ø(€€€€€€€€€€€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”õíÍÑå±•Ì¹µ…É­•ÑÁ±…•ÕÉÉ•¹å%¹ÁÕÑôø(€€€€€€€€€€€€€€€€€€€€€€€€€€ñÍÁ…¸±…ÍÍ9…µ”õíÍÑå±•Ì¹µ…É­•ÑÁ±…•ÕÉÉ•¹åAÉ•™¥áôùHð½ÍÁ…¸ø(€€€€€€€€€€€€€€€€€€€€€€€€€€ñ¥¹ÁÕÐ(€€€€€€€€€€€€€€€€€€€€€€€€€€€ÑåÁ”ô‰Ñ•áÐˆ(€€€€€€€€€€€€€€€€€€€€€€€€€€€¥¹ÁÕÑ5½‘”ô‰¹Õµ•É¥Œˆ(€€€€€€€€€€€€€€€€€€€€€€€€€€€Ù…±Õ”õíµ…É­•ÑÁ±…•É…™Ð¹…Í­¥¹AÉ¥•áY…Ñô(€€€€€€€€€€€€€€€€€€€€€€€€€€€½¹¡…¹”õì¡•Ù•¹Ð¤€ôø(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€Í•Ñ5…É­•ÑÁ±…•É…™Ð ¡ÕÉÉ•¹Ð¤€ôø(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€ÕÉÉ•¹Ð€üì€¸¸¹ÕÉÉ•¹Ð°…Í­¥¹AÉ¥•áY…Ðè™½Éµ…Ñ5…É­•ÑÁ±…•AÉ¥•%¹ÁÕÐ¡•Ù•¹Ð¹Ñ…É•Ð¹Ù…±Õ”¤ô€èÕÉÉ•¹Ð°(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€¤(€€€€€€€€€€€€€€€€€€€€€€€€€€€ô(€€€€€€€€€€€€€€€€€€€€€€€€€€€½¹	±ÕÈõì ¤€ôø(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€Í•Ñ5…É­•ÑÁ±…•É…™Ð ¡ÕÉÉ•¹Ð¤€ôø(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€ÕÉÉ•¹Ð€üì€¸¸¹ÕÉÉ•¹Ð°…Í­¥¹AÉ¥•áY…Ðè™½Éµ…Ñ5…É­•ÑÁ±…•AÉ¥•%¹ÁÕÐ¡ÕÉÉ•¹Ð¹…Í­¥¹AÉ¥•áY…Ð¤ô€èÕÉÉ•¹Ð°(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€¤(€€€€€€€€€€€€€€€€€€€€€€€€€€€ô(€€€€€€€€€€€€€€€€€€€€€€€€€€€Á±…•¡½±‘•ÈôˆÀˆ(€€€€€€€€€€€€€€€€€€€€€€€€€€€…ÕÑ½½ÕÌ(€€€€€€€€€€€€€€€€€€€€€€€€€€€…É¥„µ±…‰•°ô‰5…É­•ÑÁ±…”ÁÉ¥”•á±Õ‘¥¹œYPˆ(€€€€€€€€€€€€€€€€€€€€€€€€€€¼ø(€€€€€€€€€€€€€€€€€€€€€€€€ð½‘¥Øø(€€€€€€€€€€€€€€€€€€€€€€€€ñÍµ…±°±…ÍÍ9…µ”õíÍÑå±•Ì¹µ…É­•ÑÁ±…•AÉ¥•!¥¹ÑôùQ¡”•¹Ñ•É•ÁÉ¥”¥ÌÍ…Ù•…ÌÑ¡”±¥ÍÑ¥¹œ…Í­¥¹œÁÉ¥”•á±Õ‘¥¹œYP¸ð½Íµ…±°ø(€€€€€€€€€€€€€€€€€€€€€€ð½±…‰•°ø(€€€€€€€€€€€€€€€€€€€€ð½Í•Ñ¥½¸ø((€€€€€€€€€€€€€€€€€€€€ñÍ•Ñ¥½¸±…ÍÍ9…µ”õíÍÑå±•Ì¹µ…É­•ÑÁ±…•A¡½Ñ½ÍA…¹•±ôø(€€€€€€€€€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”õíÍÑå±•Ì¹µ…É­•ÑÁ±…•A…¹•±!•…‘¥¹ôø(€€€€€€€€€€€€€€€€€€€€€€€€ñÍÁ…¸ùA¡½Ñ½Ìð½ÍÁ…¸ø(€€€€€€€€€€€€€€€€€€€€€€€€ñÍµ…±°ø(€€€€€€€€€€€€€€€€€€€€€€€€€íµ…É­•ÑÁ±…•A¡½Ñ½UÉ±Ì¹±•¹Ñ (€€€€€€€€€€€€€€€€€€€€€€€€€€€€ü€‘íµ…É­•ÑÁ±…•A¡½Ñ½UÉ±Ì¹±•¹Ñ¡ôÕÁ±½…‘•Á¡½Ñ¼‘íµ…É­•ÑÁ±…•A¡½Ñ½UÉ±Ì¹±•¹Ñ €ôôô€Ä€ü€œœ€è€ÌôÝ¥±°‰”Í¡½Ý¸½¸Ñ¡”±¥ÍÑ¥¹œ¹€(€€€€€€€€€€€€€€€€€€€€€€€€€€€€è€9¼Á¡½Ñ½Ì…É”ÕÁ±½…‘•™½ÈÑ¡¥Ì…ÍÍ•Ðå•Ð¸ô(€€€€€€€€€€€€€€€€€€€€€€€€ð½Íµ…±°ø(€€€€€€€€€€€€€€€€€€€€€€ð½‘¥Øø((€€€€€€€€€€€€€€€€€€€€€íµ…É­•ÑÁ±…•A¡½Ñ½UÉ±Ì¹±•¹Ñ €ü€ (€€€€€€€€€€€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”õíÍÑå±•Ì¹µ…É­•ÑÁ±…•A¡½Ñ½AÉ•Ù¥•Ýôø(€€€€€€€€€€€€€€€€€€€€€€€€€€ñ¥µœ(€€€€€€€€€€€€€€€€€€€€€€€€€€€ÍÉŒõíµ…É­•ÑÁ±…•A¡½Ñ½UÉ±ÍlÁuô(€€€€€€€€€€€€€€€€€€€€€€€€€€€…±Ðõí€‘íµ…É­•ÑÁ±…•ÍÍ•Ð¹Ñ¥Ñ±•ôµ…¥¸µ…É­•ÑÁ±…”Á¡½Ñ½ô(€€€€€€€€€€€€€€€€€€€€€€€€€€€±…ÍÍ9…µ”õíÍÑå±•Ì¹µ…É­•ÑÁ±…•5…¥¹A¡½Ñ½ô(€€€€€€€€€€€€€€€€€€€€€€€€€€¼ø((€€€€€€€€€€€€€€€€€€€€€€€€€íµ…É­•ÑÁ±…•A¡½Ñ½UÉ±Ì¹±•¹Ñ €ø€Ä€ü€ (€€€€€€€€€€€€€€€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”õíÍÑå±•Ì¹µ…É­•ÑÁ±…•A¡½Ñ½MÑÉ¥Áô…É¥„µ±…‰•°ô‰5…É­•ÑÁ±…”±¥ÍÑ¥¹œÁ¡½Ñ½Ìˆø(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€íµ…É­•ÑÁ±…•A¡½Ñ½UÉ±Ì¹Í±¥” À°€Ø¤¹µ…À ¡Á¡½Ñ½UÉ°°¥¹‘•à¤€ôø€ (€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€ñ¥µœ­•äõí€‘íÁ¡½Ñ½UÉ±ô´‘í¥¹‘•áõôÍÉŒõíÁ¡½Ñ½UÉ±ô…±Ðõí€‘íµ…É­•ÑÁ±…•ÍÍ•Ð¹Ñ¥Ñ±•ôÁ¡½Ñ¼€‘í¥¹‘•à€¬€Åõô€¼ø(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€¤¥ô(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€íµ…É­•ÑÁ±…•A¡½Ñ½UÉ±Ì¹±•¹Ñ €ø€Ø€ü€ñÍÁ…¸ø­íµ…É­•ÑÁ±…•A¡½Ñ½UÉ±Ì¹±•¹Ñ €´€Ùôð½ÍÁ…¸ø€è¹Õ±±ô(€€€€€€€€€€€€€€€€€€€€€€€€€€€€ð½‘¥Øø(€€€€€€€€€€€€€€€€€€€€€€€€€€¤€è¹Õ±±ô(€€€€€€€€€€€€€€€€€€€€€€€€ð½‘¥Øø(€€€€€€€€€€€€€€€€€€€€€€¤€è€ (€€€€€€€€€€€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”õíÍÑå±•Ì¹µ…É­•ÑÁ±…•9½A¡½Ñ½Íôø(€€€€€€€€€€€€€€€€€€€€€€€€€€ñÍÑÉ½¹œù9¼Á¡½Ñ½ÌÕÁ±½…‘•ð½ÍÑÉ½¹œø(€€€€€€€€€€€€€€€€€€€€€€€€€€ñÍÁ…¸ù‘Á¡½Ñ½Ì¥¸UÁ‘…Ñ”…ÍÍ•ÐÑ¼Í¡½ÜÉ•…°…ÍÍ•ÐÁ¡½Ñ½Ì½¸Ñ¡”µ…É­•ÑÁ±…”¸ð½ÍÁ…¸ø(€€€€€€€€€€€€€€€€€€€€€€€€ð½‘¥Øø(€€€€€€€€€€€€€€€€€€€€€€¥ô(€€€€€€€€€€€€€€€€€€€€ð½Í•Ñ¥½¸ø((€€€€€€€€€€€€€€€€€€€€ñ±…‰•°±…ÍÍ9…µ”õí€‘íÍÑå±•Ì¹™¥•±‘ô€‘íÍÑå±•Ì¹µ…É­•ÑÁ±…•9½Ñ•Í¥•±‘õôø(€€€€€€€€€€€€€€€€€€€€€€ñÍÁ…¸ù1¥ÍÑ¥¹œ¹½Ñ•Ìð½ÍÁ…¸ø(€€€€€€€€€€€€€€€€€€€€€€ñÑ•áÑ…É•„(€€€€€€€€€€€€€€€€€€€€€€€Ù…±Õ”õíµ…É­•ÑÁ±…•É…™Ð¹‘•ÍÉ¥ÁÑ¥½¹ô(€€€€€€€€€€€€€€€€€€€€€€€½¹¡…¹”õì¡•Ù•¹Ð¤€ôøÍ•Ñ5…É­•ÑÁ±…•É…™Ð ¡ÕÉÉ•¹Ð¤€ôø€¡ÕÉÉ•¹Ð€üì€¸¸¹ÕÉÉ•¹Ð°‘•ÍÉ¥ÁÑ¥½¸è•Ù•¹Ð¹Ñ…É•Ð¹Ù…±Õ”ô€èÕÉÉ•¹Ð¤¥ô(€€€€€€€€€€€€€€€€€€€€€€€Á±…•¡½±‘•Èô‰‘¥µÁ½ÉÑ…¹Ð‰Õå•È¹½Ñ•Ì°•áÑÉ…Ì°Í•ÉÙ¥”¡¥ÍÑ½Éä½È­¹½Ý¸¥ÍÍÕ•Ì¸ˆ(€€€€€€€€€€€€€€€€€€€€€€¼ø(€€€€€€€€€€€€€€€€€€€€ð½±…‰•°ø(€€€€€€€€€€€€€€€€€€ð½‘¥Øø((€€€€€€€€€€€€€€€€€€ñÍ•Ñ¥½¸±…ÍÍ9…µ”õíÍÑå±•Ì¹µ…É­•ÑÁ±…•M•±±•ÉA…¹•±ôø(€€€€€€€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”õíÍÑå±•Ì¹µ…É­•ÑÁ±…•M•±±•É!•…‘•Éôø(€€€€€€€€€€€€€€€€€€€€€€ñ Ðù‘¥ÐÍ•±±•È‘•Ñ…¥±Ìð½ Ðø(€€€€€€€€€€€€€€€€€€€€€€ñÍÁ…¸ùM¡½Ý¸Ñ¼Í¥¹•µ¥¸µ…É­•ÑÁ±…”ÕÍ•ÉÌð½ÍÁ…¸ø(€€€€€€€€€€€€€€€€€€€€ð½‘¥Øø((€€€€€€€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”õíÍÑå±•Ì¹µ…É­•ÑÁ±…•M•±±•ÉÉ¥‘ôø(€€€€€€€€€€€€€€€€€€€€€€ñ±…‰•°±…ÍÍ9…µ”õí€‘íÍÑå±•Ì¹™¥•±‘ô€‘íÍÑå±•Ì¹µ…É­•ÑÁ±…•½¹Ñ…Ñ¥•±‘ô€‘íÍÑå±•Ì¹µ…É­•ÑÁ±…•]¥‘•¥•±‘õôø(€€€€€€€€€€€€€€€€€€€€€€€€ñÍÁ…¸ù	ÕÍ¥¹•ÍÌ¹…µ”ð½ÍÁ…¸ø(€€€€€€€€€€€€€€€€€€€€€€€€ñ¥¹ÁÕÐ(€€€€€€€€€€€€€€€€€€€€€€€€€Ù…±Õ”õíµ…É­•ÑÁ±…•É…™Ð¹Í•±±•É½µÁ…¹åô(€€€€€€€€€€€€€€€€€€€€€€€€€½¹¡…¹”õì¡•Ù•¹Ð¤€ôøÍ•Ñ5…É­•ÑÁ±…•É…™Ð ¡ÕÉÉ•¹Ð¤€ôø€¡ÕÉÉ•¹Ð€üì€¸¸¹ÕÉÉ•¹Ð°Í•±±•É½µÁ…¹äè•Ù•¹Ð¹Ñ…É•Ð¹Ù…±Õ”ô€èÕÉÉ•¹Ð¤¥ô(€€€€€€€€€€€€€€€€€€€€€€€€€Á±…•¡½±‘•Èô‰	ÕÍ¥¹•ÍÌ¹…µ”ˆ(€€€€€€€€€€€€€€€€€€€€€€€€€…É¥„µ±…‰•°ô‰	ÕÍ¥¹•ÍÌ¹…µ”ˆ(€€€€€€€€€€€€€€€€€€€€€€€€¼ø(€€€€€€€€€€€€€€€€€€€€€€ð½±…‰•°ø((€€€€€€€€€€€€€€€€€€€€€€ñ±…‰•°±…ÍÍ9…µ”õí€‘íÍÑå±•Ì¹™¥•±‘ô€‘íÍÑå±•Ì¹µ…É­•ÑÁ±…•½¹Ñ…Ñ¥•±‘õôø(€€€€€€€€€€€€€€€€€€€€€€€€ñÍÁ…¸ù½¹Ñ…Ð¹…µ”ð½ÍÁ…¸ø(€€€€€€€€€€€€€€€€€€€€€€€€ñ¥¹ÁÕÐ(€€€€€€€€€€€€€€€€€€€€€€€€€Ù…±Õ”õíµ…É­•ÑÁ±…•É…™Ð¹Í•±±•É9…µ•ô(€€€€€€€€€€€€€€€€€€€€€€€€€½¹¡…¹”õì¡•Ù•¹Ð¤€ôøÍ•Ñ5…É­•ÑÁ±…•É…™Ð ¡ÕÉÉ•¹Ð¤€ôø€¡ÕÉÉ•¹Ð€üì€¸¸¹ÕÉÉ•¹Ð°Í•±±•É9…µ”è•Ù•¹Ð¹Ñ…É•Ð¹Ù…±Õ”ô€èÕÉÉ•¹Ð¤¥ô(€€€€€€€€€€€€€€€€€€€€€€€€€Á±…•¡½±‘•Èô‰½¹Ñ…Ð¹…µ”ˆ(€€€€€€€€€€€€€€€€€€€€€€€€€…É¥„µ±…‰•°ô‰½¹Ñ…Ð¹…µ”ˆ(€€€€€€€€€€€€€€€€€€€€€€€€¼ø(€€€€€€€€€€€€€€€€€€€€€€ð½±…‰•°ø((€€€€€€€€€€€€€€€€€€€€€€ñ±…‰•°±…ÍÍ9…µ”õí€‘íÍÑå±•Ì¹™¥•±‘ô€‘íÍÑå±•Ì¹µ…É­•ÑÁ±…•½¹Ñ…Ñ¥•±‘õôø(€€€€€€€€€€€€€€€€€€€€€€€€ñÍÁ…¸ùA¡½¹”ð½ÍÁ…¸ø(€€€€€€€€€€€€€€€€€€€€€€€€ñ¥¹ÁÕÐ(€€€€€€€€€€€€€€€€€€€€€€€€€Ù…±Õ”õíµ…É­•ÑÁ±…•É…™Ð¹Í•±±•ÉA¡½¹•ô(€€€€€€€€€€€€€€€€€€€€€€€€€½¹¡…¹”õì¡•Ù•¹Ð¤€ôøÍ•Ñ5…É­•ÑÁ±…•É…™Ð ¡ÕÉÉ•¹Ð¤€ôø€¡ÕÉÉ•¹Ð€üì€¸¸¹ÕÉÉ•¹Ð°Í•±±•ÉA¡½¹”è•Ù•¹Ð¹Ñ…É•Ð¹Ù…±Õ”ô€èÕÉÉ•¹Ð¤¥ô(€€€€€€€€€€€€€€€€€€€€€€€€€Á±…•¡½±‘•Èô‰A¡½¹”ˆ(€€€€€€€€€€€€€€€€€€€€€€€€€…É¥„µ±…‰•°ô‰A¡½¹”ˆ(€€€€€€€€€€€€€€€€€€€€€€€€¼ø(€€€€€€€€€€€€€€€€€€€€€€ð½±…‰•°ø((€€€€€€€€€€€€€€€€€€€€€€ñ±…‰•°±…ÍÍ9…µ”õí€‘íÍÑå±•Ì¹™¥•±‘ô€‘íÍÑå±•Ì¹µ…É­•ÑÁ±…•½¹Ñ…Ñ¥•±‘ô€‘íÍÑå±•Ì¹µ…É­•ÑÁ±…•]¥‘•¥•±‘õôø(€€€€€€€€€€€€€€€€€€€€€€€€ñÍÁ…¸ù	ÕÍ¥¹•ÍÌ•µ…¥°ð½ÍÁ…¸ø(€€€€€€€€€€€€€€€€€€€€€€€€ñ¥¹ÁÕÐ(€€€€€€€€€€€€€€€€€€€€€€€€€ÑåÁ”ô‰•µ…¥°ˆ(€€€€€€€€€€€€€€€€€€€€€€€€€Ù…±Õ”õíµ…É­•ÑÁ±…•É…™Ð¹Í•±±•Éµ…¥±ô(€€€€€€€€€€€€€€€€€€€€€€€€€½¹¡…¹”õì¡•Ù•¹Ð¤€ôøÍ•Ñ5…É­•ÑÁ±…•É…™Ð ¡ÕÉÉ•¹Ð¤€ôø€¡ÕÉÉ•¹Ð€üì€¸¸¹ÕÉÉ•¹Ð°Í•±±•Éµ…¥°è•Ù•¹Ð¹Ñ…É•Ð¹Ù…±Õ”ô€èÕÉÉ•¹Ð¤¥ô(€€€€€€€€€€€€€€€€€€€€€€€€€Á±…•¡½±‘•Èô‰	ÕÍ¥¹•ÍÌ•µ…¥°ˆ(€€€€€€€€€€€€€€€€€€€€€€€€€…É¥„µ±…‰•°ô‰	ÕÍ¥¹•ÍÌ•µ…¥°ˆ(€€€€€€€€€€€€€€€€€€€€€€€€¼ø(€€€€€€€€€€€€€€€€€€€€€€ð½±…‰•°ø((€€€€€€€€€€€€€€€€€€€€€€ñ±…‰•°±…ÍÍ9…µ”õí€‘íÍÑå±•Ì¹™¥•±‘ô€‘íÍÑå±•Ì¹µ…É­•ÑÁ±…•½¹Ñ…Ñ¥•±‘õôø(€€€€€€€€€€€€€€€€€€€€€€€€ñÍÁ…¸ùAÉ½Ù¥¹”ð½ÍÁ…¸ø(€€€€€€€€€€€€€€€€€€€€€€€€ñ¥¹ÁÕÐ(€€€€€€€€€€€€€€€€€€€€€€€€€Ù…±Õ”õíµ…É­•ÑÁ±…•É…™Ð¹ÁÉ½Ù¥¹•ô(€€€€€€€€€€€€€€€€€€€€€€€€€½¹¡…¹”õì¡•Ù•¹Ð¤€ôøÍ•Ñ5…É­•ÑÁ±…•É…™Ð ¡ÕÉÉ•¹Ð¤€ôø€¡ÕÉÉ•¹Ð€üì€¸¸¹ÕÉÉ•¹Ð°ÁÉ½Ù¥¹”è•Ù•¹Ð¹Ñ…É•Ð¹Ù…±Õ”ô€èÕÉÉ•¹Ð¤¥ô(€€€€€€€€€€€€€€€€€€€€€€€€€Á±…•¡½±‘•Èô‰AÉ½Ù¥¹”ˆ(€€€€€€€€€€€€€€€€€€€€€€€€€…É¥„µ±…‰•°ô‰AÉ½Ù¥¹”ˆ(€€€€€€€€€€€€€€€€€€€€€€€€¼ø(€€€€€€€€€€€€€€€€€€€€€€ð½±…‰•°ø((€€€€€€€€€€€€€€€€€€€€€€ñ±…‰•°±…ÍÍ9…µ”õí€‘íÍÑå±•Ì¹™¥•±‘ô€‘íÍÑå±•Ì¹µ…É­•ÑÁ±…•½¹Ñ…Ñ¥•±‘õôø(€€€€€€€€€€€€€€€€€€€€€€€€ñÍÁ…¸ùÉ•„ð½ÍÁ…¸ø(€€€€€€€€€€€€€€€€€€€€€€€€ñ¥¹ÁÕÐ(€€€€€€€€€€€€€€€€€€€€€€€€€Ù…±Õ”õíµ…É­•ÑÁ±…•É…™Ð¹…É•…ô(€€€€€€€€€€€€€€€€€€€€€€€€€½¹¡…¹”õì¡•Ù•¹Ð¤€ôøÍ•Ñ5…É­•ÑÁ±…•É…™Ð ¡ÕÉÉ•¹Ð¤€ôø€¡ÕÉÉ•¹Ð€üì€¸¸¹ÕÉÉ•¹Ð°…É•„è•Ù•¹Ð¹Ñ…É•Ð¹Ù…±Õ”ô€èÕÉÉ•¹Ð¤¥ô(€€€€€€€€€€€€€€€€€€€€€€€€€Á±…•¡½±‘•Èô‰É•„ˆ(€€€€€€€€€€€€€€€€€€€€€€€€€…É¥„µ±…‰•°ô‰É•„ˆ(€€€€€€€€€€€€€€€€€€€€€€€€¼ø(€€€€€€€€€€€€€€€€€€€€€€ð½±…‰•°ø(€€€€€€€€€€€€€€€€€€€€ð½‘¥Øø(€€€€€€€€€€€€€€€€€€ð½Í•Ñ¥½¸ø(€€€€€€€€€€€€€€€€ð½‘¥Øø((€€€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”õí€‘íÍÑå±•Ì¹™½ÉµÑ¥½¹Íô€‘íÍÑå±•Ì¹µ…É­•ÑÁ±…•Ñ¥½¹Íõôø(€€€€€€€€€€€€€€€€€€ñ‰ÕÑÑ½¸ÑåÁ”ô‰‰ÕÑÑ½¸ˆ±…ÍÍ9…µ”õíÍÑå±•Ì¹Í•½¹‘…Éå	ÕÑÑ½¹ô½¹±¥¬õí±½Í•5…É­•ÑÁ±…•5½‘…±ô‘¥Í…‰±•õí¥ÍAÕ‰±¥Í¡¥¹5…É­•ÑÁ±…•ôø(€€€€€€€€€€€€€€€€€€€…¹•°(€€€€€€€€€€€€€€€€€€ð½‰ÕÑÑ½¸ø((€€€€€€€€€€€€€€€€€€ñ‰ÕÑÑ½¸(€€€€€€€€€€€€€€€€€€€ÑåÁ”ô‰ÍÕ‰µ¥Ðˆ(€€€€€€€€€€€€€€€€€€€±…ÍÍ9…µ”õíÍÑå±•Ì¹ÁÉ¥µ…Éå	ÕÑÑ½¹ô(€€€€€€€€€€€€€€€€€€€‘¥Í…‰±•õí¥ÍAÕ‰±¥Í¡¥¹5…É­•ÑÁ±…”ñð€¡Á…ÉÍ•5½¹•å%¹ÁÕÐ¡µ…É­•ÑÁ±…•É…™Ð¹…Í­¥¹AÉ¥•áY…Ð¤€üü€À¤€ðô€Áô(€€€€€€€€€€€€€€€€€€ø(€€€€€€€€€€€€€€€€€€€í¥ÍAÕ‰±¥Í¡¥¹5…É­•ÑÁ±…”(€€€€€€€€€€€€€€€€€€€€€€ü€AÕ‰±¥Í¡¥¹œ¸¸¸œ(€€€€€€€€€€€€€€€€€€€€€€è¥Í1¥Ù•=¹5…É­•ÑÁ±…”¡µ…É­•ÑÁ±…•ÍÍ•Ð¤(€€€€€€€€€€€€€€€€€€€€€€€€ü€UÁ‘…Ñ”…¹Ù¥•Ü±¥ÍÑ¥¹œœ(€€€€€€€€€€€€€€€€€€€€€€€€è€½¹™¥É´…¹Ù¥•Ü±¥ÍÑ¥¹œô(€€€€€€€€€€€€€€€€€€ð½‰ÕÑÑ½¸ø(€€€€€€€€€€€€€€€€ð½‘¥Øø(€€€€€€€€€€€€€€ð½™½É´ø(€€€€€€€€€€€€ð½‘¥Øø(€€€€€€€€€€ð½‘¥Øø(€€€€€€€€ð½‘¥Øø(€€€€€€¤€è¹Õ±±ô((€€€€€í…Ñ¥Ù•ÍÍ•Ð€˜˜¥ÍEÉ5½‘…±=Á•¸€ü€ (€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”õí€‘íÍÑå±•Ì¹µ½‘…±=Ù•É±…åô€‘íÍÑå±•Ì¹ÍÕ‰5½‘…±=Ù•É±…åõôø(€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”õíÍÑå±•Ì¹µ½‘…±	…­‘É½Áô½¹±¥¬õí±½Í•EÉ¥…±½ô€¼ø((€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”õí€‘íÍÑå±•Ì¹µ½‘…±…É‘ô€‘íÍÑå±•Ì¹ÅÉ5½‘…±õôÉ½±”ô‰‘¥…±½œˆ…É¥„µµ½‘…°ô‰ÑÉÕ”ˆ…É¥„µ±…‰•±±•‘‰äô‰…ÍÍ•ÐµÅÈµÑ¥Ñ±”ˆø(€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”õí€‘íÍÑå±•Ì¹µ½‘…±!•…‘•Éô€‘íÍÑå±•Ì¹ÅÉ5½‘…±!•…‘•Éõôø(€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”õíÍÑå±•Ì¹µ½‘…±!•…‘•ÉQ•áÑôø(€€€€€€€€€€€€€€€€ñ Ì¥ô‰…ÍÍ•ÐµÅÈµÑ¥Ñ±”ˆùí…Ñ¥Ù•ÍÍ•Ð¹Ñ¥Ñ±•ôð½ Ìø(€€€€€€€€€€€€€€€€ñÀùUÍ”Ñ¡¥ÌÁ•Éµ…¹•¹ÐEH™½ÈÍ…¸…•ÍÌ¸AÕ‰±¥ŒEHÍ…¹Ì…±Ý…åÌ…Í¬™½ÈÑ¡”™…É´A%8¸ð½Àø(€€€€€€€€€€€€€€ð½‘¥Øø((€€€€€€€€€€€€€€ñ‰ÕÑÑ½¸ÑåÁ”ô‰‰ÕÑÑ½¸ˆ±…ÍÍ9…µ”õíÍÑå±•Ì¹µ½‘…±±½Í•	ÕÑÑ½¹ô½¹±¥¬õí±½Í•EÉ¥…±½ô…É¥„µ±…‰•°ô‰±½Í”EH½‘”ˆø(€€€€€€€€€€€€€€€€ñ±½Í•%½¸±…ÍÍ9…µ”õíÍÑå±•Ì¹‰ÕÑÑ½¹%½¹ô€¼ø(€€€€€€€€€€€€€€ð½‰ÕÑÑ½¸ø(€€€€€€€€€€€€ð½‘¥Øø((€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”õí€‘íÍÑå±•Ì¹µ½‘…±MÉ½±±	½‘åô€‘íÍÑå±•Ì¹ÅÉ5½‘…±MÉ½±±	½‘åõôø(€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”õíÍÑå±•Ì¹ÅÉ5½‘…±	½‘åôø(€€€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”õíÍÑå±•Ì¹ÅÉAÉ•Ù¥•Ý…É‘ôø(€€€€€€€€€€€€€€€€€€ñÍÁ…¸±…ÍÍ9…µ”õíÍÑå±•Ì¹ÅÉAÉ•Ù¥•Ýå•‰É½ÝôùA•Éµ…¹•¹Ð…ÍÍ•ÐEHð½ÍÁ…¸ø(€€€€€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”õíÍÑå±•Ì¹ÅÉAÉ•Ù¥•ÝÉ…µ•ôø(€€€€€€€€€€€€€€€€€€€í…Ñ¥Ù•ÍÍ•Ð¹ÁÕ‰±¥ÍÍ•Ñ½‘”€ü€ (€€€€€€€€€€€€€€€€€€€€€€ñ¥µœÍÉŒõí‰Õ¥±‘ÍÍ•ÑEÉMÙUÉ°¡…Ñ¥Ù•ÍÍ•Ð¥ô…±ÐõíEH½‘”™½È€‘í…Ñ¥Ù•ÍÍ•Ð¹Ñ¥Ñ±•õô€¼ø(€€€€€€€€€€€€€€€€€€€€¤€è€ (€€€€€€€€€€€€€€€€€€€€€€ñÀ±…ÍÍ9…µ”õíÍÑå±•Ì¹ÅÉAÉ•Ù¥•Ý…±±‰…­ôùEH…ÉÑÝ½É¬¥Ì¹½ÐÉ•…‘ä™½ÈÑ¡¥Ì…ÍÍ•Ðå•Ð¸ð½Àø(€€€€€€€€€€€€€€€€€€€€¥ô(€€€€€€€€€€€€€€€€€€ð½‘¥Øø(€€€€€€€€€€€€€€€€ð½‘¥Øø((€€€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”õíÍÑå±•Ì¹ÅÉAÉ¥µ…ÉåÑ¥½¹Í…É‘ôø(€€€€€€€€€€€€€€€€€€ñ‰ÕÑÑ½¸(€€€€€€€€€€€€€€€€€€€ÑåÁ”ô‰‰ÕÑÑ½¸ˆ(€€€€€€€€€€€€€€€€€€€±…ÍÍ9…µ”õí€‘íÍÑå±•Ì¹ÅÉAÉ¥µ…ÉåÑ¥½¹	ÕÑÑ½¹ô€‘í½Á¥•‘M…¹1¥¹­ÍÍ•Ñ%€ôôô…Ñ¥Ù•ÍÍ•Ð¹¥€üÍÑå±•Ì¹ÅÉ½Á¥•‘	ÕÑÑ½¸€è€œõô(€€€€€€€€€€€€€€€€€€€½¹±¥¬õì ¤€ôøÙ½¥¡…¹‘±•½ÁåM…¹1¥¹¬¡…Ñ¥Ù•ÍÍ•Ð¥ô(€€€€€€€€€€€€€€€€€€ø(€€€€€€€€€€€€€€€€€€€€ñ½Áå%½¸±…ÍÍ9…µ”õíÍÑå±•Ì¹‰ÕÑÑ½¹%½¹ô€¼ø(€€€€€€€€€€€€€€€€€€€€ñÍÁ…¸ùí½Á¥•‘M…¹1¥¹­ÍÍ•Ñ%€ôôô…Ñ¥Ù•ÍÍ•Ð¹¥€ü€½Á¥•œ€è€½ÁäÍ…¸±¥¹¬ôð½ÍÁ…¸ø(€€€€€€€€€€€€€€€€€€ð½‰ÕÑÑ½¸ø((€€€€€€€€€€€€€€€€€€ñ‰ÕÑÑ½¸ÑåÁ”ô‰‰ÕÑÑ½¸ˆ±…ÍÍ9…µ”õíÍÑå±•Ì¹ÅÉAÉ¥µ…ÉåÑ¥½¹	ÕÑÑ½¹ô½¹±¥¬õì ¤€ôø¡…¹‘±•AÉ¥¹ÑEÉM¡••Ð¡…Ñ¥Ù•ÍÍ•Ð¥ôø(€€€€€€€€€€€€€€€€€€€€ñAÉ¥¹Ñ%½¸±…ÍÍ9…µ”õíÍÑå±•Ì¹‰ÕÑÑ½¹%½¹ô€¼ø(€€€€€€€€€€€€€€€€€€€€ñÍÁ…¸ùAÉ¥¹ÐEH±…‰•°ð½ÍÁ…¸ø(€€€€€€€€€€€€€€€€€€ð½‰ÕÑÑ½¸ø((€€€€€€€€€€€€€€€€€€ñ‰ÕÑÑ½¸ÑåÁ”ô‰‰ÕÑÑ½¸ˆ±…ÍÍ9…µ”õíÍÑå±•Ì¹ÅÉAÉ¥µ…ÉåÑ¥½¹	ÕÑÑ½¹ô½¹±¥¬õì ¤€ôøÙ½¥¡…¹‘±•½Ý¹±½…‘EÈ¡…Ñ¥Ù•ÍÍ•Ð¥ôø(€€€€€€€€€€€€€€€€€€€€ñEÉ%½¸±…ÍÍ9…µ”õíÍÑå±•Ì¹‰ÕÑÑ½¹%½¹ô€¼ø(€€€€€€€€€€€€€€€€€€€€ñÍÁ…¸ù½Ý¹±½…EHð½ÍÁ…¸ø(€€€€€€€€€€€€€€€€€€ð½‰ÕÑÑ½¸ø(€€€€€€€€€€€€€€€€ð½‘¥Øø(€€€€€€€€€€€€€€ð½‘¥Øø(€€€€€€€€€€€€ð½‘¥Øø(€€€€€€€€€€ð½‘¥Øø(€€€€€€€€ð½‘¥Øø(€€€€€€¤€è¹Õ±±ô((€€€€€íÁÉ½©•Ñ¥½¹ÍÍ•Ð€ü€ (€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”õíÍÑå±•Ì¹µ½‘…±=Ù•É±…åôø(€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”õíÍÑå±•Ì¹µ½‘…±	…­‘É½Áô½¹±¥¬õí±½Í•AÉ½©•Ñ¥½¹5½‘…±ô€¼ø((€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”õí€‘íÍÑå±•Ì¹µ½‘…±…É‘ô€‘íÍÑå±•Ì¹ÁÉ½©•Ñ¥½¹5½‘…±õôÉ½±”ô‰‘¥…±½œˆ…É¥„µµ½‘…°ô‰ÑÉÕ”ˆ…É¥„µ±…‰•±±•‘‰äô‰ÁÉ½©•Ñ¥½¸µÑ¥Ñ±”ˆø(€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”õí€‘íÍÑå±•Ì¹µ½‘…±!•…‘•Éô€‘íÍÑå±•Ì¹ÁÉ½©•Ñ¥½¹5½‘…±!•…‘•Éõôø(€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”õíÍÑå±•Ì¹µ½‘…±!•…‘•ÉQ•áÑôø(€€€€€€€€€€€€€€€€ñ Ì¥ô‰ÁÉ½©•Ñ¥½¸µÑ¥Ñ±”ˆùíÁÉ½©•Ñ¥½¹ÍÍ•Ð¹Ñ¥Ñ±•ôð½ Ìø(€€€€€€€€€€€€€€€€ñÀù¡½½Í”Ñ¡”™ÕÑÕÉ”å•…È°¥¹™±…Ñ¥½¸°½¹‘¥Ñ¥½¸…¹ÕÍ…”¸EÕ¥¬Í•±•Ñ¥½¹ÌÉ•…±Õ±…Ñ”¥¹ÍÑ…¹Ñ±ä¸ð½Àø(€€€€€€€€€€€€€€ð½‘¥Øø((€€€€€€€€€€€€€€ñ‰ÕÑÑ½¸ÑåÁ”ô‰‰ÕÑÑ½¸ˆ±…ÍÍ9…µ”õíÍÑå±•Ì¹µ½‘…±±½Í•	ÕÑÑ½¹ô½¹±¥¬õí±½Í•AÉ½©•Ñ¥½¹5½‘…±ô…É¥„µ±…‰•°ô‰±½Í”™ÕÑÕÉ”ÁÉ¥”µ½‘…°ˆø(€€€€€€€€€€€€€€€€ñ±½Í•%½¸±…ÍÍ9…µ”õíÍÑå±•Ì¹‰ÕÑÑ½¹%½¹ô€¼ø(€€€€€€€€€€€€€€ð½‰ÕÑÑ½¸ø(€€€€€€€€€€€€ð½‘¥Øø((€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”õí€‘íÍÑå±•Ì¹µ½‘…±MÉ½±±	½‘åô€‘íÍÑå±•Ì¹ÁÉ½©•Ñ¥½¹MÉ½±±	½‘åõôø(€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”õíÍÑå±•Ì¹ÁÉ½©•Ñ¥½¹M¥µÁ±•	½‘åôø(€€€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”õíÍÑå±•Ì¹ÁÉ½©•Ñ¥½¹	…Í•±¥¹•MÑÉ¥Áôø(€€€€€€€€€€€€€€€€€€ñ‘¥Øø(€€€€€€€€€€€€€€€€€€€€ñÍÁ…¸ùÕÉÉ•¹ÐÍ…Ù•Ù…±Õ”ð½ÍÁ…¸ø(€€€€€€€€€€€€€€€€€€€€ñÍÑÉ½¹œùíµ½¹•ä¡ÁÉ½©•Ñ¥½¹ÍÍ•Ð¹Ù…±Õ”¥ôð½ÍÑÉ½¹œø(€€€€€€€€€€€€€€€€€€ð½‘¥Øø(€€€€€€€€€€€€€€€€€€ñ‘¥Øø(€€€€€€€€€€€€€€€€€€€€ñÍÁ…¸ùÕÉÉ•¹Ð½¹‘¥Ñ¥½¸ð½ÍÁ…¸ø(€€€€€€€€€€€€€€€€€€€€ñÍÑÉ½¹œùí½¹‘¥Ñ¥½¹1…‰•°¡ÁÉ½©•Ñ¥½¹ÍÍ•Ð¹½¹‘¥Ñ¥½¸¥ôð½ÍÑÉ½¹œø(€€€€€€€€€€€€€€€€€€ð½‘¥Øø(€€€€€€€€€€€€€€€€€€ñ‘¥Øø(€€€€€€€€€€€€€€€€€€€€ñÍÁ…¸ùÕÉÉ•¹ÐÕÍ…”ð½ÍÁ…¸ø(€€€€€€€€€€€€€€€€€€€€ñÍÑÉ½¹œùí‰Õ¥±‘ÍÍ•ÑUÍ…•Y…±Õ”¡ÁÉ½©•Ñ¥½¹ÍÍ•Ð¥ôð½ÍÑÉ½¹œø(€€€€€€€€€€€€€€€€€€ð½‘¥Øø(€€€€€€€€€€€€€€€€ð½‘¥Øø((€€€€€€€€€€€€€€€€ñÍ•Ñ¥½¸±…ÍÍ9…µ”õíÍÑå±•Ì¹ÁÉ½©•Ñ¥½¹M¥µÁ±•…É‘ôø(€€€€€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”õíÍÑå±•Ì¹ÁÉ½©•Ñ¥½¹M¥µÁ±•M•Ñ¥½¹!•…‘•Éôø(€€€€€€€€€€€€€€€€€€€€ñ ÐùÕÑÕÉ”Í•ÑÑ¥¹Ìð½ Ðø(€€€€€€€€€€€€€€€€€€€€ñÀùíÁÉ½©•Ñ¥½¹UÍ…•!•±ÁQ•áÑôð½Àø(€€€€€€€€€€€€€€€€€€ð½‘¥Øø((€€€€€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”õíÍÑå±•Ì¹ÁÉ½©•Ñ¥½¹%¹ÁÕÑI½Ýôø(€€€€€€€€€€€€€€€€€€€€ñ5½‘…±M•±•ÐñÍÑÉ¥¹œø(€€€€€€€€€€€€€€€€€€€€€±…‰•°ô‰Q…É•Ðå•…Èˆ(€€€€€€€€€€€€€€€€€€€€€Ù…±Õ”õíÁÉ½©•Ñ¥½¹½É´¹Ñ…É•Ñe•…Éô(€€€€€€€€€€€€€€€€€€€€€½ÁÑ¥½¹ÌõíÁÉ½©•Ñ¥½¹e•…ÉM•±•Ñ=ÁÑ¥½¹Íô(€€€€€€€€€€€€€€€€€€€€€½¹¡…¹”õì¡Ù…±Õ”¤€ôøÕÁ‘…Ñ•AÉ½©•Ñ¥½¹½É´¡ìÑ…É•Ñe•…ÈèÙ…±Õ”ô¥ô(€€€€€€€€€€€€€€€€€€€€€±…ÍÍ9…µ”õíÍÑå±•Ì¹ÁÉ½©•Ñ¥½¹e•…ÉM•±•Ñ¥•±‘ô(€€€€€€€€€€€€€€€€€€€€¼ø((€€€€€€€€€€€€€€€€€€€€ñ±…‰•°±…ÍÍ9…µ”õíÍÑå±•Ì¹™¥•±‘ôø(€€€€€€€€€€€€€€€€€€€€€€ñÍÁ…¸ù%¹™±…Ñ¥½¸€”À¹„¸ð½ÍÁ…¸ø(€€€€€€€€€€€€€€€€€€€€€€ñ¥¹ÁÕÐ(€€€€€€€€€€€€€€€€€€€€€€€ÑåÁ”ô‰¹Õµ‰•Èˆ(€€€€€€€€€€€€€€€€€€€€€€€µ¥¸ôˆ´ÔÀˆ(€€€€€€€€€€€€€€€€€€€€€€€µ…àôˆÈÀÀˆ(€€€€€€€€€€€€€€€€€€€€€€€ÍÑ•ÀôˆÀ¸Äˆ(€€€€€€€€€€€€€€€€€€€€€€€Ù…±Õ”õíÁÉ½©•Ñ¥½¹½É´¹¥¹™±…Ñ¥½¹I…Ñ•AÑô(€€€€€€€€€€€€€€€€€€€€€€€½¹¡…¹”õì¡•Ù•¹Ð¤€ôøÕÁ‘…Ñ•AÉ½©•Ñ¥½¹½É´¡ì¥¹™±…Ñ¥½¹I…Ñ•AÐè•Ù•¹Ð¹Ñ…É•Ð¹Ù…±Õ”ô¥ô(€€€€€€€€€€€€€€€€€€€€€€¼ø(€€€€€€€€€€€€€€€€€€€€ð½±…‰•°ø((€€€€€€€€€€€€€€€€€€€€ñ±…‰•°±…ÍÍ9…µ”õíÍÑå±•Ì¹™¥•±‘ôø(€€€€€€€€€€€€€€€€€€€€€€ñÍÁ…¸ùíÁÉ½©•Ñ¥½¹UÍ…•¥•±‘1…‰•±ôð½ÍÁ…¸ø(€€€€€€€€€€€€€€€€€€€€€€ñ¥¹ÁÕÐ(€€€€€€€€€€€€€€€€€€€€€€€ÑåÁ”ô‰¹Õµ‰•Èˆ(€€€€€€€€€€€€€€€€€€€€€€€µ¥¸ôˆÀˆ(€€€€€€€€€€€€€€€€€€€€€€€µ…àõíÁÉ½©•Ñ¥½¹UÍ•ÍA•É•¹ÑUÍ…”€ü€œÄÀÀœ€èÕ¹‘•™¥¹•‘ô(€€€€€€€€€€€€€€€€€€€€€€€ÍÑ•ÀõíÁÉ½©•Ñ¥½¹UÍ•ÍA•É•¹ÑUÍ…”€ü€œÀ¸Äœ€è€œÔÀô(€€€€€€€€€€€€€€€€€€€€€€€Ù…±Õ”õíÁÉ½©•Ñ¥½¹UÍ•ÍA•É•¹ÑUÍ…”€üÁÉ½©•Ñ¥½¹½É´¹Ñ…É•Ñ1¥™•]½É­•‘A•É•¹Ð€èÁÉ½©•Ñ¥½¹½É´¹•áÑÉ…!½ÕÉÍô(€€€€€€€€€€€€€€€€€€€€€€€½¹¡…¹”õì¡•Ù•¹Ð¤€ôøÕÁ‘…Ñ•AÉ½©•Ñ¥½¹½É´ (€€€€€€€€€€€€€€€€€€€€€€€€€ÁÉ½©•Ñ¥½¹UÍ•ÍA•É•¹ÑUÍ…”(€€€€€€€€€€€€€€€€€€€€€€€€€€€€üìÑ…É•Ñ1¥™•]½É­•‘A•É•¹Ðè•Ù•¹Ð¹Ñ…É•Ð¹Ù…±Õ”ô(€€€€€€€€€€€€€€€€€€€€€€€€€€€€èì•áÑÉ…!½ÕÉÌè•Ù•¹Ð¹Ñ…É•Ð¹Ù…±Õ”ô°(€€€€€€€€€€€€€€€€€€€€€€€€¥ô(€€€€€€€€€€€€€€€€€€€€€€€Á±…•¡½±‘•ÈõíÁÉ½©•Ñ¥½¹UÍ…•A±…•¡½±‘•Éô(€€€€€€€€€€€€€€€€€€€€€€¼ø(€€€€€€€€€€€€€€€€€€€€ð½±…‰•°ø(€€€€€€€€€€€€€€€€€€ð½‘¥Øø((€€€€€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”õíÍÑå±•Ì¹ÁÉ½©•Ñ¥½¹EÕ¥­I½Ýôø(€€€€€€€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”õíÍÑå±•Ì¹ÁÉ½©•Ñ¥½¹EÕ¥­½Áåôø(€€€€€€€€€€€€€€€€€€€€€€ñÍÁ…¸ùEÕ¥¬¥¹™±…Ñ¥½¸ð½ÍÁ…¸ø(€€€€€€€€€€€€€€€€€€€€€€ñÍµ…±°ù¡½½Í”„É…Ñ”Ñ¼É•…±Õ±…Ñ”¥¹ÍÑ…¹Ñ±ä¸ð½Íµ…±°ø(€€€€€€€€€€€€€€€€€€€€ð½‘¥Øø(€€€€€€€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”õíÍÑå±•Ì¹ÁÉ½©•Ñ¥½¹EÕ¥­	ÕÑÑ½¹Íôø(€€€€€€€€€€€€€€€€€€€€€íAI=)Q%=9}%91Q%=9}AIMQL¹µ…À ¡É…Ñ”¤€ôøì(€€€€€€€€€€€€€€€€€€€€€€€½¹ÍÐ¥ÍM•±•Ñ•€ôÁÉ½©•Ñ¥½¹½É´¹¥¹™±…Ñ¥½¹I…Ñ•AÐ€ôôôÉ…Ñ”ì((€€€€€€€€€€€€€€€€€€€€€€€É•ÑÕÉ¸€ (€€€€€€€€€€€€€€€€€€€€€€€€€€ñ‰ÕÑÑ½¸(€€€€€€€€€€€€€€€€€€€€€€€€€€€­•äõíÉ…Ñ•ô(€€€€€€€€€€€€€€€€€€€€€€€€€€€ÑåÁ”ô‰‰ÕÑÑ½¸ˆ(€€€€€€€€€€€€€€€€€€€€€€€€€€€±…ÍÍ9…µ”õí€‘íÍÑå±•Ì¹ÁÉ½©•Ñ¥½¹AÉ•Í•Ñ	ÕÑÑ½¹ô€‘í¥ÍM•±•Ñ•€üÍÑå±•Ì¹ÁÉ½©•Ñ¥½¹AÉ•Í•Ñ	ÕÑÑ½¹Ñ¥Ù”€è€œõô(€€€€€€€€€€€€€€€€€€€€€€€€€€€…É¥„µÁÉ•ÍÍ•õí¥ÍM•±•Ñ•‘ô(€€€€€€€€€€€€€€€€€€€€€€€€€€€½¹±¥¬õì ¤€ôø¡…¹‘±•AÉ½©•Ñ¥½¹AÉ•Í•Ð¡ì¥¹™±…Ñ¥½¹I…Ñ•AÐèÉ…Ñ”ô¥ô(€€€€€€€€€€€€€€€€€€€€€€€€€€ø(€€€€€€€€€€€€€€€€€€€€€€€€€€€íÉ…Ñ•ô”(€€€€€€€€€€€€€€€€€€€€€€€€€€ð½‰ÕÑÑ½¸ø(€€€€€€€€€€€€€€€€€€€€€€€€¤ì(€€€€€€€€€€€€€€€€€€€€€ô¥ô(€€€€€€€€€€€€€€€€€€€€ð½‘¥Øø(€€€€€€€€€€€€€€€€€€ð½‘¥Øø((€€€€€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”õíÍÑå±•Ì¹ÁÉ½©•Ñ¥½¹½¹‘¥Ñ¥½¹…É‘ôø(€€€€€€€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”õíÍÑå±•Ì¹ÁÉ½©•Ñ¥½¹½¹‘¥Ñ¥½¹!•…‘•Éôø(€€€€€€€€€€€€€€€€€€€€€€ñÍÁ…¸ùÕÑÕÉ”½¹‘¥Ñ¥½¸ð½ÍÁ…¸ø(€€€€€€€€€€€€€€€€€€€€€€ñÍµ…±°ùM•±•ÐÑ¡”•áÁ•Ñ•½¹‘¥Ñ¥½¸¸Q¡”É•Ñ…¥¹•Ù…±Õ”Á•É•¹Ñ…”µ…Ñ¡•ÌÑ¡”•ÍÑ¥µ…Ñ”Á…”¸ð½Íµ…±°ø(€€€€€€€€€€€€€€€€€€€€ð½‘¥Øø(€€€€€€€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”õíÍÑå±•Ì¹ÁÉ½©•Ñ¥½¹½¹‘¥Ñ¥½¹É¥‘ôø(€€€€€€€€€€€€€€€€€€€€€íAI=)Q%=9}=9%Q%=9}=AQ%=9L¹µ…À ¡½ÁÑ¥½¸¤€ôøì(€€€€€€€€€€€€€€€€€€€€€€€½¹ÍÐ¥ÍM•±•Ñ•€ôÁÉ½©•Ñ¥½¹½É´¹Ñ…É•Ñ½¹‘¥Ñ¥½¸€ôôô½ÁÑ¥½¸¹­•äì((€€€€€€€€€€€€€€€€€€€€€€€É•ÑÕÉ¸€ (€€€€€€€€€€€€€€€€€€€€€€€€€€ñ‰ÕÑÑ½¸(€€€€€€€€€€€€€€€€€€€€€€€€€€€­•äõí½ÁÑ¥½¸¹­•åô(€€€€€€€€€€€€€€€€€€€€€€€€€€€ÑåÁ”ô‰‰ÕÑÑ½¸ˆ(€€€€€€€€€€€€€€€€€€€€€€€€€€€±…ÍÍ9…µ”õí€‘íÍÑå±•Ì¹ÁÉ½©•Ñ¥½¹½¹‘¥Ñ¥½¹	ÕÑÑ½¹ô€‘í¥ÍM•±•Ñ•€üÍÑå±•Ì¹ÁÉ½©•Ñ¥½¹½¹‘¥Ñ¥½¹	ÕÑÑ½¹Ñ¥Ù”€è€œõô(€€€€€€€€€€€€€€€€€€€€€€€€€€€…É¥„µÁÉ•ÍÍ•õí¥ÍM•±•Ñ•‘ô(€€€€€€€€€€€€€€€€€€€€€€€€€€€½¹±¥¬õì ¤€ôø¡…¹‘±•AÉ½©•Ñ¥½¹AÉ•Í•Ð¡ìÑ…É•Ñ½¹‘¥Ñ¥½¸è½ÁÑ¥½¸¹­•äô¥ô(€€€€€€€€€€€€€€€€€€€€€€€€€€ø(€€€€€€€€€€€€€€€€€€€€€€€€€€€€ñÍÑÉ½¹œùí½ÁÑ¥½¸¹±…‰•±ôð½ÍÑÉ½¹œø(€€€€€€€€€€€€€€€€€€€€€€€€€€ð½‰ÕÑÑ½¸ø(€€€€€€€€€€€€€€€€€€€€€€€€¤ì(€€€€€€€€€€€€€€€€€€€€€ô¥ô(€€€€€€€€€€€€€€€€€€€€ð½‘¥Øø(€€€€€€€€€€€€€€€€€€ð½‘¥Øø((€€€€€€€€€€€€€€€€€€ñ‰ÕÑÑ½¸ÑåÁ”ô‰‰ÕÑÑ½¸ˆ±…ÍÍ9…µ”õí€‘íÍÑå±•Ì¹ÁÉ¥µ…Éå	ÕÑÑ½¹ô€‘íÍÑå±•Ì¹ÁÉ½©•Ñ¥½¹Õ±±]¥‘Ñ¡	ÕÑÑ½¹õô½¹±¥¬õí¡…¹‘±•AÉ½©•Ñ¥½¹MÕ‰µ¥Ñô‘¥Í…‰±•õí¥Í1½…‘¥¹AÉ½©•Ñ¥½¹ôø(€€€€€€€€€€€€€€€€€€€í¥Í1½…‘¥¹AÉ½©•Ñ¥½¸€ü€…±Õ±…Ñ¥¹œ¸¸¸œ€è€…±Õ±…Ñ”™ÕÑÕÉ”ÁÉ¥”ô(€€€€€€€€€€€€€€€€€€ð½‰ÕÑÑ½¸ø(€€€€€€€€€€€€€€€€ð½Í•Ñ¥½¸ø((€€€€€€€€€€€€€€€íÁÉ½©•Ñ¥½¹ÉÉ½È€ü€ñ‘¥Ø±…ÍÍ9…µ”õíÍÑå±•Ì¹ÁÉ½©•Ñ¥½¹ÉÉ½ÉôùíÁÉ½©•Ñ¥½¹ÉÉ½Éôð½‘¥Øø€è¹Õ±±ô((€€€€€€€€€€€€€€€íÁÉ½©•Ñ¥½¹I•ÍÕ±Ð€ü€ (€€€€€€€€€€€€€€€€€€ñÍ•Ñ¥½¸É•˜õíÁÉ½©•Ñ¥½¹I•ÍÕ±ÑI•™ô±…ÍÍ9…µ”õíÍÑå±•Ì¹ÁÉ½©•Ñ¥½¹M¥µÁ±•I•ÍÕ±Ñô…É¥„µ±¥Ù”ô‰Á½±¥Ñ”ˆø(€€€€€€€€€€€€€€€€€€€€ñÍÁ…¸ùAÉ½©•Ñ•™ÕÑÕÉ”ÁÉ¥”ð½ÍÁ…¸ø(€€€€€€€€€€€€€€€€€€€€ñÍÑÉ½¹œùíµ½¹•ä¡ÁÉ½©•Ñ¥½¹I•ÍÕ±Ð¹ÁÉ½©•Ñ•¹É•Ñ…¥±áY…Ð¥ôð½ÍÑÉ½¹œø(€€€€€€€€€€€€€€€€€€€€ñÀùÍÑ¥µ…Ñ••àYPÙ…±Õ”™½ÈíÁÉ½©•Ñ¥½¹I•ÍÕ±Ð¹Ñ…É•Ñe•…Éô¸ð½Àø((€€€€€€€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”õíÍÑå±•Ì¹ÁÉ½©•Ñ¥½¹M¥µÁ±•5•Ñ…ôø(€€€€€€€€€€€€€€€€€€€€€€ñ‘¥Øø(€€€€€€€€€€€€€€€€€€€€€€€€ñÍÁ…¸ùe•…Èð½ÍÁ…¸ø(€€€€€€€€€€€€€€€€€€€€€€€€ñÍÑÉ½¹œùíÁÉ½©•Ñ¥½¹I•ÍÕ±Ð¹‰…Í•e•…ÉôƒŠHíÁÉ½©•Ñ¥½¹I•ÍÕ±Ð¹Ñ…É•Ñe•…Éôð½ÍÑÉ½¹œø(€€€€€€€€€€€€€€€€€€€€€€ð½‘¥Øø(€€€€€€€€€€€€€€€€€€€€€€ñ‘¥Øø(€€€€€€€€€€€€€€€€€€€€€€€€ñÍÁ…¸ùíÁÉ½©•Ñ¥½¹UÍ…•5•Ñ…1…‰•±ôð½ÍÁ…¸ø(€€€€€€€€€€€€€€€€€€€€€€€€ñÍÑÉ½¹œø(€€€€€€€€€€€€€€€€€€€€€€€€€íÁÉ½©•Ñ¥½¹UÍ•ÍA•É•¹ÑUÍ…”(€€€€€€€€€€€€€€€€€€€€€€€€€€€€ü€‘í™½Éµ…ÑAÉ½©•Ñ¥½¹]½É­•‘A•É•¹Ð¡ÁÉ½©•Ñ¥½¹ÕÉÉ•¹Ñ]½É­•‘A•É•¹Ð¥ôƒŠH€‘í™½Éµ…ÑAÉ½©•Ñ¥½¹]½É­•‘A•É•¹Ð¡ÁÉ½©•Ñ¥½¹Q…É•Ñ]½É­•‘A•É•¹Ð¥õ€(€€€€€€€€€€€€€€€€€€€€€€€€€€€€è€‘íÁÉ½©•Ñ¥½¹I•ÍÕ±Ð¹ÕÉÉ•¹Ð¹¡½ÕÉÌ¹Ñ½1½…±•MÑÉ¥¹œ •¸µiœ¥ôƒŠH€‘íÁÉ½©•Ñ¥½¹I•ÍÕ±Ð¹ÁÉ½©•Ñ•¹¡½ÕÉÌ¹Ñ½1½…±•MÑÉ¥¹œ •¸µiœ¥ô€‘íÁÉ½©•Ñ¥½¹UÍ…•M¡½ÉÑU¹¥Ñõô(€€€€€€€€€€€€€€€€€€€€€€€€ð½ÍÑÉ½¹œø(€€€€€€€€€€€€€€€€€€€€€€ð½‘¥Øø(€€€€€€€€€€€€€€€€€€€€€€ñ‘¥Øø(€€€€€€€€€€€€€€€€€€€€€€€€ñÍÁ…¸ù%¹™±…Ñ¥½¸ð½ÍÁ…¸ø(€€€€€€€€€€€€€€€€€€€€€€€€ñÍÑÉ½¹œùí™½Éµ…ÑA•É•¹Ð¡ÁÉ½©•Ñ¥½¹I•ÍÕ±Ð¹¥¹™±…Ñ¥½¹I…Ñ•AÐ¥ôÀ¹„¸ð½ÍÑÉ½¹œø(€€€€€€€€€€€€€€€€€€€€€€ð½‘¥Øø(€€€€€€€€€€€€€€€€€€€€€€ñ‘¥Øø(€€€€€€€€€€€€€€€€€€€€€€€€ñÍÁ…¸ù½¹‘¥Ñ¥½¸ð½ÍÁ…¸ø(€€€€€€€€€€€€€€€€€€€€€€€€ñÍÑÉ½¹œùí½¹‘¥Ñ¥½¹1…‰•°¡ÁÉ½©•Ñ¥½¹ÕÉÉ•¹Ñ½¹‘¥Ñ¥½¸¥ôƒŠHí½¹‘¥Ñ¥½¹1…‰•°¡ÁÉ½©•Ñ¥½¹Q…É•Ñ½¹‘¥Ñ¥½¸¥ôð½ÍÑÉ½¹œø(€€€€€€€€€€€€€€€€€€€€€€€€ñÍµ…±°ø(€€€€€€€€€€€€€€€€€€€€€€€€€íÁÉ½©•Ñ¥½¹½¹‘¥Ñ¥½¹I•Ñ…¥¹•‘A•É•¹Ð¡ÁÉ½©•Ñ¥½¹ÕÉÉ•¹Ñ½¹‘¥Ñ¥½¸¥ô”ƒŠHíÁÉ½©•Ñ¥½¹½¹‘¥Ñ¥½¹I•Ñ…¥¹•‘A•É•¹Ð¡ÁÉ½©•Ñ¥½¹Q…É•Ñ½¹‘¥Ñ¥½¸¥ô”É•Ñ…¥¹•(€€€€€€€€€€€€€€€€€€€€€€€€ð½Íµ…±°ø(€€€€€€€€€€€€€€€€€€€€€€ð½‘¥Øø(€€€€€€€€€€€€€€€€€€€€ð½‘¥Øø(€€€€€€€€€€€€€€€€€€ð½Í•Ñ¥½¸ø(€€€€€€€€€€€€€€€€¤€è¥Í1½…‘¥¹AÉ½©•Ñ¥½¸€ü€ (€€€€€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”õíÍÑå±•Ì¹ÁÉ½©•Ñ¥½¹1½…‘¥¹ôù…±Õ±…Ñ¥¹œ™ÕÑÕÉ”ÁÉ¥”¸¸¸ð½‘¥Øø(€€€€€€€€€€€€€€€€¤€è€ (€€€€€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”õíÍÑå±•Ì¹ÁÉ½©•Ñ¥½¹µÁÑåI•ÍÕ±Ñôø(€€€€€€€€€€€€€€€€€€€€ñÍÑÉ½¹œù9¼ÁÉ½©•Ñ¥½¸å•Ðð½ÍÑÉ½¹œø(€€€€€€€€€€€€€€€€€€€€ñÍÁ…¸ù¹Ñ•ÈÑ¡”Í¥µÁ±”Í•ÑÑ¥¹Ì…‰½Ù”…¹…±Õ±…Ñ”¸ð½ÍÁ…¸ø(€€€€€€€€€€€€€€€€€€ð½‘¥Øø(€€€€€€€€€€€€€€€€¥ô(€€€€€€€€€€€€€€ð½‘¥Øø(€€€€€€€€€€€€ð½‘¥Øø(€€€€€€€€€€ð½‘¥Øø(€€€€€€€€ð½‘¥Øø(€€€€€€¤€è¹Õ±±ô((€€€€€€ñÍÍ•ÑÉ½ÕÁ5…¹…•É5½‘…°(€€€€€€€½Á•¸õí¥ÍÍÍ•ÑÉ½ÕÁ5½‘…±=Á•¹ô(€€€€€€€…¹¡½ÉÍÍ•Ðõí…ÍÍ•ÑÉ½ÕÁ5½‘…±ÍÍ•Ñô(€€€€€€€É½ÕÀõí…ÍÍ•ÑÉ½ÕÁ5½‘…±É½ÕÁô(€€€€€€€…ÍÍ•ÑÌõí…ÍÍ•ÑÉ½ÕÁ5½‘…±ÍÍ•ÑÍô(€€€€€€€É½ÕÁÌõí…ÍÍ•ÑÉ½ÕÁÍô(€€€€€€€½µ‰¥¹•‘5½‘”õí¥Í½µ‰¥¹•‘I•¥ÍÑ•ÉY¥•Ýô(€€€€€€€‰ÕÍäõí¥ÍM…Ù¥¹ÍÍ•ÑÉ½ÕÁô(€€€€€€€É•Á½ÉÑ	ÕÍäõí¥ÍáÁ½ÉÑ¥¹ô(€€€€€€€•ÉÉ½Èõí…ÍÍ•ÑÉ½ÕÁÉÉ½Éô(€€€€€€€½¹±½Í”õí±½Í•ÍÍ•ÑÉ½ÕÁ5…¹…•Éô(€€€€€€€½¹M…Ù”õí¡…¹‘±•M…Ù•ÍÍ•ÑÉ½ÕÁô(€€€€€€€½¹•±•Ñ”õí¡…¹‘±••±•Ñ•ÍÍ•ÑÉ½ÕÁô(€€€€€€€½¹½Ý¹±½…‘A‘˜õí¡…¹‘±•½Ý¹±½…‘ÍÍ•ÑÉ½ÕÁA‘™ô(€€€€€€€½¹½Ý¹±½…‘a±Íàõí¡…¹‘±•½Ý¹±½…‘ÍÍ•ÑÉ½ÕÁa±Íáô(€€€€€€€½¹½Ý¹±½…‘I•Á½ÉÐõí¡…¹‘±•½Ý¹±½…‘ÍÍ•ÑÉ½ÕÁI•Á½ÉÑô(€€€€€€¼ø((€€€€€í¥Í½Õ¹Ñ…¹ÑI•Á½ÉÑÍ=Á•¸€˜˜…½Õ¹Ñ…¹ÑM¡…É•%€˜˜…½Õ¹Ñ…¹Ñ•ÍÌ€ü€ (€€€€€€€€ñ½Õ¹Ñ…¹ÑI•¥ÍÑ•ÉI•Á½ÉÑÍ5½‘…°(€€€€€€€€€Í¡…É•%õí…½Õ¹Ñ…¹ÑM¡…É•%‘ô(€€€€€€€€€É•¥ÍÑ•É9…µ”õí…Ñ¥Ù•I•¥ÍÑ•Èü¹‰ÕÍ¥¹•ÍÍ9…µ”ñð…½Õ¹Ñ…¹Ñ•ÍÌ¹½Ý¹•É	ÕÍ¥¹•ÍÍ9…µ”ñð€ÍÍ•ÐI•¥ÍÑ•Èô(€€€€€€€€€¥¹±Õ‘•Õ•±1•‘•Èõí…½Õ¹Ñ…¹Ñ•ÍÌ¹¥¹±Õ‘•Õ•±1•‘•Éô(€€€€€€€€€¥¹±Õ‘•½ÍÑ1•‘•Èõí…½Õ¹Ñ…¹Ñ•ÍÌ¹¥¹±Õ‘•½ÍÑ1•‘•Éô(€€€€€€€€€½¹±½Í”õì ¤€ôøÍ•Ñ%Í½Õ¹Ñ…¹ÑI•Á½ÉÑÍ=Á•¸¡™…±Í”¥ô(€€€€€€€€¼ø(€€€€€€¤€è¹Õ±±ô(€€€€ð½µ…¥¸ø(€€¤ì)ô