'use client';

import Link from 'next/link';
import { createPortal } from 'react-dom';
import { useEffect, useMemo, useRef, useState, type CSSProperties, type ChangeEvent, type DragEvent as ReactDragEvent, type FormEvent, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import AppHeader from '../../components/AppHeader';
import AssetGroupManagerModal, {
  type AssetGroupReportFilters,
  type AssetGroupReportFormat,
  type AssetGroupReportKind,
} from '../../components/asset-register/AssetGroupManagerModal';
import AssetExternalShare, { AssetShareDestinationPicker } from '../../components/asset-register/AssetExternalShare';
import AccountantAssetManageModal from '../../components/AccountantAssetManageModal';
import AccountantRegisterReportsModal from '../../components/AccountantRegisterReportsModal';
import AssetDocumentUploadModal, {
  type UploadedVaultDocument,
} from '../../components/documents/AssetDocumentUploadModal';
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
import type { ExternalAssetShareItem } from '../../lib/asset-external-share';
import {
  assetCountsTowardRegisterTotal,
  assetGroupValueModeLabel,
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
  ACCOUNT_DOCUMENT_CATEGORY_LABELS,
  getAccountDocumentTypeLabel,
} from '../../lib/account-document-taxonomy';
import {
  assetDocumentCategoryLabel,
  normalizeAssetDocumentCategory,
  normalizeAssetDocumentType,
  type AssetDocumentCategory,
} from '../../lib/asset-document-permissions';
import { isViewportScrollbarInteraction } from '../../lib/viewport-scrollbar';
import assistanceServiceLocations from '../../database/seeds/aim4price-assistance-locations.json';

type NoticeTone = 'success' | 'warning' | 'error';
type PartnerType = 'dealer' | 'finance' | 'insurance' | 'licensing';
type AssetLeadType = 'finance' | 'insurance' | 'replacement_quote' | 'license_renewal';
type QuoteLeadStep = 'message' | 'consent' | null;
type QuoteScope = 'asset' | 'register';
type QuoteDirectoryStage = 'location' | 'map';
type AssetShareDestination = 'choice' | 'inside' | 'outside';
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
  masterAccountUserId?: string;
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
  isAim4priceManaged?: boolean;
  isActivePartner?: boolean;
  assistanceLocationId?: string;
  assistanceServiceKey?: string;
  serviceAreaNotice?: string;
};

type PartnerDirectoryApiResponse = {
  ok: boolean;
  partners?: PartnerDirectoryEntry[];
  error?: string;
};

type AssetLeadApiResponse = {
  ok: boolean;
  lead?: unknown;
  confirmation?: string | null;
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
type AssetDetailEditTarget = 'serial' | 'year' | 'usage' | 'condition';
type OwnerAssetCommandPanel = 'maintenance' | null;
type AssetModalReturnOrigin = {
  asset: RegisterAsset;
  assetId: string;
  origin: 'card' | 'manage';
  action: string;
  trigger: HTMLElement | null;
  scrollY: number;
};
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

type VaultDocumentsResponse = {
  ok?: boolean;
  documents?: UploadedVaultDocument[];
  error?: string;
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
  { value: 'percentage', label: '%', description: 'Use estimated lifetime usage as a percentage.' },
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
const ASSET_FILTER_LABEL_BY_VALUE: ReadonlyMap<string, string> = new Map(
  ASSET_FILTER_OPTIONS.map((option) => [option.value, option.label]),
);

const LEAFLET_SCRIPT_ID = 'aim4price-leaflet-script';
const LEAFLET_CSS_ID = 'aim4price-leaflet-css';
const LEAFLET_CLUSTER_SCRIPT_ID = 'aim4price-leaflet-cluster-script';
const LEAFLET_CLUSTER_CSS_ID = 'aim4price-leaflet-cluster-css';
const LEAFLET_CLUSTER_DEFAULT_CSS_ID = 'aim4price-leaflet-cluster-default-css';
const DEFAULT_PARTNER_MAP_CENTER: [number, number] = [-29, 24];
const DEFAULT_PARTNER_MAP_ZOOM = 5;
const QUOTE_LOCATION_TOWN_ZOOM = 9;
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

const QUOTE_LOCATION_SUGGESTIONS = Array.from(new Set([
  ...assistanceServiceLocations.map((location) => `${location.town}, ${location.province}`),
  ...assistanceServiceLocations.map((location) => location.province),
]));

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

function resolveQuoteLocationMapTarget(value: string): AssetSettingsApproximateMapLocation | null {
  const lookupText = normalizeAssetSettingsMapLookupText(value);
  if (!lookupText) return null;

  const coordinateText = value.trim();
  if (/^(?:gps\s*)?-?\d+(?:[.,]\d+)?\s*[,;]\s*-?\d+(?:[.,]\d+)?$/i.test(coordinateText)) {
    const coordinatePair = parseAssetSettingsCoordinatePair(coordinateText);
    if (
      coordinatePair
      && coordinatePair.latitude >= -90
      && coordinatePair.latitude <= 90
      && coordinatePair.longitude >= -180
      && coordinatePair.longitude <= 180
    ) {
      return { center: [coordinatePair.latitude, coordinatePair.longitude], zoom: QUOTE_LOCATION_TOWN_ZOOM };
    }
  }

  const paddedLookupText = ` ${lookupText} `;
  const seededLocation = assistanceServiceLocations.find((location) => (
    paddedLookupText.includes(` ${normalizeAssetSettingsMapLookupText(location.town)} `)
  ));

  if (seededLocation) {
    return {
      center: [seededLocation.latitude, seededLocation.longitude],
      zoom: seededLocation.serviceRadiusKm >= 120 ? 8 : QUOTE_LOCATION_TOWN_ZOOM,
    };
  }

  const knownTown = findAssetSettingsLookupLocation(
    lookupText,
    ASSET_SETTINGS_SA_TOWN_MAP_LOCATIONS,
    QUOTE_LOCATION_TOWN_ZOOM,
  );
  if (knownTown) {
    return { ...knownTown, zoom: Math.min(knownTown.zoom, QUOTE_LOCATION_TOWN_ZOOM) };
  }

  return findAssetSettingsLookupLocation(
    lookupText,
    ASSET_SETTINGS_SA_PROVINCE_MAP_LOCATIONS,
    ASSET_SETTINGS_PROVINCE_ZOOM,
  );
}

function defaultQuoteLocationInput(asset: RegisterAsset | null, profile: AccountProfile | null): string {
  const assetLocation = getAssetSettingsManualLocationTextInput(asset);
  if (assetLocation) return assetLocation;
  return [profile?.townCity, profile?.province].filter(Boolean).join(', ');
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
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M4 5h16M7 12h10M10 19h4" />
      <circle cx="15" cy="5" r="1.5" />
      <circle cx="9" cy="12" r="1.5" />
      <circle cx="15" cy="19" r="1.5" />
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

function ExpandIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className} aria-hidden="true">
      <path d="M8 3H3v5" />
      <path d="m3 3 6 6" />
      <path d="M16 3h5v5" />
      <path d="m21 3-6 6" />
      <path d="M8 21H3v-5" />
      <path d="m3 21 6-6" />
      <path d="M16 21h5v-5" />
      <path d="m21 21-6-6" />
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
  assetDetailEditTarget?: AssetDetailEditTarget;
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
  assetDetailEditTarget,
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
      if (isViewportScrollbarInteraction(event)) {
        return;
      }

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
      const viewportWidth = window.visualViewport?.width ?? window.innerWidth;
      const viewportHeight = window.visualViewport?.height ?? window.innerHeight;
      const viewportLeft = window.visualViewport?.offsetLeft ?? 0;
      const viewportTop = window.visualViewport?.offsetTop ?? 0;
      const gap = 8;
      const edgeGap = 12;
      const availableWidth = Math.max(160, viewportWidth - edgeGap * 2);
      const menuWidth = Math.min(Math.max(220, rect.width), availableWidth);
      const left = Math.min(Math.max(rect.left, viewportLeft + edgeGap), viewportLeft + viewportWidth - menuWidth - edgeGap);
      const spaceBelow = viewportTop + viewportHeight - rect.bottom - gap - edgeGap;
      const spaceAbove = rect.top - viewportTop - gap - edgeGap;
      const openAbove = spaceBelow < 180 && spaceAbove > spaceBelow;
      const availableHeight = Math.max(144, openAbove ? spaceAbove : spaceBelow);
      const maxHeight = Math.min(288, availableHeight);
      const top = openAbove ? Math.max(viewportTop + edgeGap, rect.top - gap - maxHeight) : Math.min(viewportTop + viewportHeight - edgeGap, rect.bottom + gap);

      setPortalMenuStyle({
        '--asset-select-top': `${Math.round(top)}px`,
        '--asset-select-left': `${Math.round(left)}px`,
        '--asset-select-width': `${Math.round(menuWidth)}px`,
        '--asset-select-max-height': `${Math.round(maxHeight)}px`,
      });
    }

    updatePortalPosition();
    window.addEventListener('resize', updatePortalPosition);
    window.addEventListener('scroll', updatePortalPosition, true);
    window.visualViewport?.addEventListener('resize', updatePortalPosition);
    window.visualViewport?.addEventListener('scroll', updatePortalPosition);

    return () => {
      window.removeEventListener('resize', updatePortalPosition);
      window.removeEventListener('scroll', updatePortalPosition, true);
      window.visualViewport?.removeEventListener('resize', updatePortalPosition);
      window.visualViewport?.removeEventListener('scroll', updatePortalPosition);
    };
  }, [isOpen, usePortal]);

  const menu = (
    <div
      ref={menuRef}
      className={`${styles.customSelectMenu} ${usePortal ? styles.customSelectMenuPortal : ''} ${!showDescriptions ? styles.customSelectMenuSingleLine : ''} ${menuClassName}`}
      style={usePortal ? portalMenuStyle ?? undefined : undefined}
      role="listbox"
      aria-label={label}
    >
      {options.map((option) => {
        const isSelected = option.value === value;

        return (
          <button
            type="button"
            role="option"
            aria-selected={isSelected}
            key={option.value || option.label}
            className={`${styles.customSelectOption} ${!showDescriptions ? styles.customSelectOptionSingleLine : ''} ${isSelected ? styles.customSelectOptionActive : ''}`}
            onClick={() => {
              onChange(option.value);
              setIsOpen(false);
            }}
          >
            {showDescriptions ? (
              <span className={styles.customSelectOptionText}>
                <strong>{option.label}</strong>
                {option.description ? <small>{option.description}</small> : null}
              </span>
            ) : (
              <span className={styles.customSelectOptionLabel}>{option.label}</span>
            )}
            {isSelected ? <b aria-hidden="true">&#10003;</b> : null}
          </button>
        );
      })}
    </div>
  );

  return (
    <div
      className={`${styles.field} ${styles.customSelectField} ${className}`}
      ref={wrapRef}
      data-asset-detail-edit-target={assetDetailEditTarget}
    >
      <span>{label}</span>
      <button
        ref={buttonRef}
        type="button"
        className={`${styles.customSelectButton} ${isOpen ? styles.customSelectButtonOpen : ''} ${!selectedOption ? styles.customSelectButtonPlaceholder : ''}`}
        onClick={() => setIsOpen((current) => !current)}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        autoFocus={autoFocus}
      >
        <span className={styles.customSelectButtonText}>
          <span className={styles.customSelectButtonCopy}>
            <span>{selectedOption?.label ?? placeholder}</span>
          </span>
        </span>
        <ChevronDownIcon className={styles.customSelectChevron} />
      </button>

      {isOpen && (!usePortal || portalMenuStyle)
        ? usePortal && typeof document !== 'undefined'
          ? createPortal(menu, document.body)
          : menu
        : null}
    </div>
  );
}

function money(value: number | null | undefined): string {
  return new Intl.NumberFormat('en-ZA', {
    style: 'currency',
    currency: 'ZAR',
    maximumFractionDigits: 0,
  }).format(value || 0);
}

function dealerCorrectionActor(correction: DealerAssetCorrectionRequest): string {
  const dealerName = correction.dealerName.trim() || 'the partner';
  const actorName = correction.actorName.trim();

  if (!actorName || actorName.toLowerCase() === dealerName.toLowerCase()) {
    return dealerName;
  }

  return `${actorName} at ${dealerName}`;
}

function dealerCorrectionDescription(correction: DealerAssetCorrectionRequest): string {
  const actor = dealerCorrectionActor(correction);

  if (correction.serialNumberChanged && correction.proposedSerialNumber) {
    return `${actor} proposed changing the serial number from ${correction.currentSerialNumber || 'not saved'} to ${correction.proposedSerialNumber}.`;
  }

  if (correction.replacementPriceChanged && correction.proposedReplacementPriceExVat !== null) {
    const currentValue = correction.currentReplacementPriceExVat === null
      ? 'not saved'
      : `${money(correction.currentReplacementPriceExVat)} excl. VAT`;
    return `${actor} proposed changing the replacement price from ${currentValue} to ${money(correction.proposedReplacementPriceExVat)} excl. VAT.`;
  }

  if (correction.licenseRenewalDateChanged && correction.proposedLicenseRenewalDate) {
    return `${actor} proposed changing the licence renewal date from ${formatDate(correction.currentLicenseRenewalDate) || 'not saved'} to ${formatDate(correction.proposedLicenseRenewalDate)}.`;
  }

  return `${actor} proposed an update to this asset.`;
}

function formatMoneyDifference(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return 'No change';

  const roundedValue = Math.round(value);
  if (roundedValue === 0) return 'No change';

  return `${roundedValue > 0 ? '+' : '-'}${money(Math.abs(roundedValue))}`;
}

function formatWholeNumber(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return 'N/A';
  return Math.round(value).toLocaleString('en-ZA');
}

function parseMoneyInput(value: unknown): number | null {
  const digits = String(value ?? '').replace(/[^0-9]/g, '');
  if (!digits) return null;

  const parsed = Number(digits);
  return Number.isFinite(parsed) ? parsed : null;
}

function formatMarketplacePriceInput(value: unknown): string {
  const digits = String(value ?? '').replace(/[^0-9]/g, '').replace(/^0+(?=\d)/, '');
  if (!digits) return '';

  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

function formatRegisterValueInput(value: unknown): string {
  return formatMarketplacePriceInput(value);
}

function parseRegisterValueInput(value: unknown): number {
  return Math.round(parseMoneyInput(value) ?? 0);
}

function formatUsageAmountInput(value: unknown): string {
  return formatMarketplacePriceInput(value);
}

function parseUsageAmountInput(value: unknown): number {
  return Math.round(parseMoneyInput(value) ?? 0);
}

function formatPercent(value: number): string {
  const normalized = Number(value || 0);
  return `${normalized.toFixed(normalized % 1 === 0 ? 0 : 1)}%`;
}

function formatRatioPercent(value: number): string {
  const normalized = Number(value || 0) * 100;
  return `${normalized.toFixed(normalized % 1 === 0 ? 0 : 1)}%`;
}

function getPdfReportOption(reportKind: PdfReportKind): PdfReportOption {
  return PDF_REPORT_OPTIONS.find((option) => option.value === reportKind) ?? PDF_REPORT_OPTIONS[0];
}

function filterAssetsByPdfReportKind(assetList: RegisterAsset[], reportKind: PdfReportKind): RegisterAsset[] {
  switch (reportKind) {
    case 'financed':
      return assetList.filter((asset) => readFinanceStatusChoice(asset) === 'yes');
    case 'insured':
      return assetList.filter((asset) => readInsuranceStatusChoice(asset) === 'yes');
    case 'licensed':
      return assetList.filter((asset) => readLicenseStatusChoice(asset) === 'yes');
    case 'not-financed':
      return assetList.filter((asset) => readFinanceStatusChoice(asset) === 'no');
    case 'not-insured':
      return assetList.filter((asset) => readInsuranceStatusChoice(asset) === 'no');
    case 'not-licensed':
      return assetList.filter((asset) => readLicenseStatusChoice(asset) === 'no');
    case 'mapped':
      return assetList.filter((asset) => hasAssetMapCoordinates(asset));
    case 'not-mapped':
      return assetList.filter((asset) => !hasAssetMapCoordinates(asset));
    case 'full':
    default:
      return assetList;
  }
}

function sumAssetValues(assetList: RegisterAsset[], groups: AssetGroup[] = []): number {
  return registerValueForAssets(assetList, groups);
}

function calculateAssetStats(
  assetList: RegisterAsset[],
  predicate?: (asset: RegisterAsset) => boolean,
  groups: AssetGroup[] = [],
): { count: number; value: number } {
  const matchingAssets = predicate ? assetList.filter(predicate) : assetList;

  return {
    count: matchingAssets.length,
    value: sumAssetValues(matchingAssets, groups),
  };
}

function formatDate(value?: string | null): string {
  if (!value) return '—';

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '—';

  return new Intl.DateTimeFormat('en-ZA', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(parsed);
}

function formatDateTime(value?: string | null, fallback = '—'): string {
  if (!value) return fallback;

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return fallback;

  return new Intl.DateTimeFormat('en-ZA', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(parsed);
}

type RegisterAssetWithGps = RegisterAsset & { lastKnownLat: number; lastKnownLng: number };

function hasAssetGpsCoordinates(asset: RegisterAsset | null | undefined): asset is RegisterAssetWithGps {
  return Boolean(
    asset &&
      typeof asset.lastKnownLat === 'number' &&
      Number.isFinite(asset.lastKnownLat) &&
      typeof asset.lastKnownLng === 'number' &&
      Number.isFinite(asset.lastKnownLng),
  );
}

function formatAssetSettingsLastScanned(asset: RegisterAsset): string {
  return formatDateTime(asset.lastScannedAtIso, 'Not saved yet');
}

function formatAssetSettingsGpsPosition(asset: RegisterAsset): string {
  if (!hasAssetGpsCoordinates(asset)) {
    return 'No GPS position saved yet';
  }

  return `${asset.lastKnownLat.toFixed(6)}, ${asset.lastKnownLng.toFixed(6)}`;
}

function formatAssetSettingsCoordinateInput(value: number | null): string {
  return typeof value === 'number' && Number.isFinite(value) ? value.toFixed(6) : '';
}

function formatAssetSettingsLocationText(asset: RegisterAsset): string {
  return String(asset.lastKnownLocationText ?? '').trim();
}

function getAssetSettingsManualLocationTextInput(asset: RegisterAsset | null): string {
  const locationText = String(asset?.lastKnownLocationText ?? '').trim();

  if (!locationText || /^GPS\s+-?\d+(?:\.\d+)?,\s*-?\d+(?:\.\d+)?$/i.test(locationText)) {
    return '';
  }

  return locationText.slice(0, MAX_ASSET_SETTINGS_LOCATION_TEXT_LENGTH);
}

function normalizeAssetSettingsLocationTextInput(value: string): string {
  return value
    .replace(/[\u0000-\u001f\u007f]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_ASSET_SETTINGS_LOCATION_TEXT_LENGTH);
}

function parseAssetSettingsCoordinate(value: string): number | null {
  const text = value.trim().replace(/[°]/g, '').replace(/\s+/g, '');
  if (!text) return null;

  const normalized = text.includes(',') && !text.includes('.') ? text.replace(',', '.') : text;
  const numeric = Number(normalized);

  return Number.isFinite(numeric) ? numeric : null;
}

function parseAssetSettingsCoordinatePair(value: string): { latitude: number; longitude: number } | null {
  const matches = value.match(/-?\d+(?:[.,]\d+)?/g);
  if (!matches || matches.length < 2) return null;

  const latitude = Number(matches[0].replace(',', '.'));
  const longitude = Number(matches[1].replace(',', '.'));

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;

  return { latitude, longitude };
}

function formatAssetSettingsManualCoordinate(value: number): string {
  return value.toFixed(6);
}

function validateAssetSettingsManualGpsInputs(
  latitudeInput: string,
  longitudeInput: string,
  locationTextInput: string,
): AssetSettingsManualGpsValidation {
  let latitude = parseAssetSettingsCoordinate(latitudeInput);
  let longitude = parseAssetSettingsCoordinate(longitudeInput);

  if ((latitude === null || longitude === null) && !longitudeInput.trim()) {
    const pair = parseAssetSettingsCoordinatePair(latitudeInput);
    if (pair) {
      latitude = pair.latitude;
      longitude = pair.longitude;
    }
  }

  if (latitude === null) {
    return { ok: false, error: 'Latitude must be a finite number between -90 and 90.' };
  }

  if (latitude < -90 || latitude > 90) {
    return { ok: false, error: 'Latitude must be between -90 and 90.' };
  }

  if (longitude === null) {
    return { ok: false, error: 'Longitude must be a finite number between -180 and 180.' };
  }

  if (longitude < -180 || longitude > 180) {
    return { ok: false, error: 'Longitude must be between -180 and 180.' };
  }

  const manualLocationText = normalizeAssetSettingsLocationTextInput(locationTextInput);

  return {
    ok: true,
    latitude,
    longitude,
    locationText: manualLocationText || `GPS ${latitude.toFixed(6)}, ${longitude.toFixed(6)}`,
  };
}

function buildAssetSettingsGoogleMapsUrl(asset: RegisterAsset | null | undefined): string | null {
  if (!hasAssetGpsCoordinates(asset)) {
    return null;
  }

  return `https://www.google.com/maps?q=${encodeURIComponent(`${asset.lastKnownLat},${asset.lastKnownLng}`)}`;
}

function gpsCaptureErrorMessage(error: unknown): string | null {
  const maybeCode = typeof error === 'object' && error !== null && 'code' in error
    ? Number((error as { code?: unknown }).code)
    : null;

  if (maybeCode === 1) {
    return 'Location permission was denied. You can enter the latitude and longitude manually above.';
  }

  if (maybeCode !== null && Number.isFinite(maybeCode)) {
    return 'Could not capture GPS position. Please try again, or enter the latitude and longitude manually above.';
  }

  return null;
}

function wasUpdatedAfterCreate(asset: RegisterAsset): boolean {
  const createdAt = new Date(asset.createdAtIso).getTime();
  const updatedAt = new Date(asset.updatedAtIso).getTime();

  if (!Number.isFinite(createdAt) || !Number.isFinite(updatedAt)) {
    return false;
  }

  return updatedAt - createdAt > 1000;
}

function assetStatusDateLabel(asset: RegisterAsset): string {
  return wasUpdatedAfterCreate(asset)
    ? `Updated ${formatDate(asset.updatedAtIso)}`
    : `Saved ${formatDate(asset.createdAtIso)}`;
}

function methodLabel(value: AssetMethod | string | null | undefined): string {
  const normalized = String(value ?? '').trim().toLowerCase();
  if (normalized === 'manual') return 'Manual';
  return 'Aim4price';
}

function kindLabel(value: AssetKind): string {
  return (
    {
      tractor: 'Tractor',
      equipment: 'Equipment',
      manual: 'Contents & electronics',
      property: PROPERTY_ASSET_LABEL,
      vehicle: 'Vehicle',
      tools: 'Tools',
      stock: 'Stock',
    }[value] ?? 'Manual asset'
  );
}

function normalizeDraftKind(value: AssetKind): AssetKind {
  return value;
}

function normalizeInsuranceUseContext(value: unknown): InsuranceUseContext | '' {
  const normalized = String(value ?? '').trim().toLowerCase();
  return normalized === 'business' || normalized === 'home' || normalized === 'mixed' ? normalized : '';
}

function normalizeInsuranceMobility(value: unknown): InsuranceMobility | '' {
  const normalized = String(value ?? '').trim().toLowerCase();
  return normalized === 'premises' || normalized === 'portable' || normalized === 'moves_between_locations' || normalized === 'fixed'
    ? normalized
    : '';
}

function normalizeInsuranceFactAnswer(value: unknown): InsuranceFactAnswer {
  const normalized = String(value ?? '').trim().toLowerCase();
  return normalized === 'yes' || normalized === 'no' ? normalized : 'unknown';
}

function normalizePropertyInterest(value: unknown): PropertyInterest | '' {
  const normalized = String(value ?? '').trim().toLowerCase();
  return normalized === 'owned_occupied' ||
    normalized === 'owned_let' ||
    normalized === 'leased_occupied' ||
    normalized === 'tenant_improvement' ||
    normalized === 'unknown'
    ? normalized
    : '';
}

function normalizeStockValuationBasis(value: unknown): StockValuationBasis | '' {
  const normalized = String(value ?? '').trim().toLowerCase();
  return normalized === 'purchase_cost' ||
    normalized === 'replacement_cost' ||
    normalized === 'selling_price' ||
    normalized === 'market_value' ||
    normalized === 'other' ||
    normalized === 'unknown'
    ? normalized
    : '';
}

function normalizeStockMovement(value: unknown): StockMovement | '' {
  const normalized = String(value ?? '').trim().toLowerCase();
  return normalized === 'one_location' ||
    normalized === 'multiple_locations' ||
    normalized === 'regular_transit' ||
    normalized === 'seasonal_locations' ||
    normalized === 'unknown'
    ? normalized
    : '';
}

function assetKindSupportsLicensing(kind: AssetKind): boolean {
  return kind === 'tractor' || kind === 'equipment' || kind === 'vehicle';
}

function normalizeUsageMetric(value: unknown, kind?: AssetKind): UsageMetric {
  const normalized = String(value ?? '').trim().toLowerCase();

  // Motor assets must always be treated as odometer/km based inside the register,
  // even when older saved specs contain an incorrect hours-style usage label.
  if (kind === 'vehicle') {
    return 'km';
  }

  if (normalized === 'km' || normalized === 'kms' || normalized === 'kilometres' || normalized === 'kilometers') {
    return 'km';
  }

  if (normalized === 'hours' || normalized === 'hour' || normalized === 'hrs') {
    return 'hours';
  }

  return 'hours';
}

function getAssetUsageMetric(asset: Pick<RegisterAsset, 'kind' | 'specsJson'>): UsageMetric {
  const specs = isPlainRecord(asset.specsJson) ? asset.specsJson : {};

  return normalizeUsageMetric(
    specs.usageMetric ?? specs.usage_metric ?? specs.usageUnit ?? specs.usage_unit ?? specs.usage_measure,
    asset.kind,
  );
}

function isPercentUsageModeValue(value: unknown): boolean {
  const normalized = String(value ?? '').trim().toLowerCase();
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

function assetUsesPercentUsage(asset: RegisterAsset): boolean {
  const specs = isPlainRecord(asset.specsJson) ? asset.specsJson : {};
  const percent = getAssetLifeWorkedPercent(asset);
  const hours = Number(asset.hours);
  const hasPositiveHours = Number.isFinite(hours) && hours > 0;
  const depreciationMethod = String(
    asset.depreciationMethodUsed ??
      specs.depreciationMethodUsed ??
      specs.depreciation_method_used ??
      specs.selectedDepreciationMethod ??
      specs.selected_depreciation_method ??
      '',
  )
    .trim()
    .toLowerCase();

  const usageModeValues = [
    specs.usageMode,
    specs.usage_mode,
    specs.usageBasis,
    specs.usage_basis,
    specs.usageMetricType,
    specs.usage_metric_type,
    specs.valuationMode,
    specs.valuation_mode,
    specs.selectedUsageMode,
    specs.selected_usage_mode,
    specs.selectedUsageBasis,
    specs.selected_usage_basis,
    specs.depreciationMethodUsed,
    specs.depreciation_method_used,
    specs.selectedDepreciationMethod,
    specs.selected_depreciation_method,
  ];

  if (usageModeValues.some(isPercentUsageModeValue)) {
    return true;
  }

  if (depreciationMethod === 'percentage_depreciation') {
    return true;
  }

  if (asset.kind === 'vehicle') {
    return false;
  }

  return percent !== null && (!hasPositiveHours || depreciationMethod === 'semi_depreciation');
}

function assetUsesNotApplicableUsage(asset: RegisterAsset): boolean {
  const specs = isPlainRecord(asset.specsJson) ? asset.specsJson : {};
  const usageValues = [
    specs.usageApplicable,
    specs.usage_applicable,
    specs.usageMode,
    specs.usage_mode,
    specs.usageBasis,
    specs.usage_basis,
    specs.usageMetric,
    specs.usage_metric,
  ].map((value) => String(value ?? '').trim().toLowerCase().replace(/[\s-]+/g, '_'));

  return asset.kind === 'property' || usageValues.some((value) =>
    value === 'false' ||
    value === 'not_applicable' ||
    value === 'not_app' ||
    value === 'n/a' ||
    value === 'na' ||
    value === 'none'
  );
}

function usageMetricLabel(value: UsageMetric): string {
  return value === 'km' ? 'km' : 'hours';
}

function assetYearLabel(asset: Pick<RegisterAsset, 'kind'>): string {
  return asset.kind === 'property' ? PROPERTY_YEAR_LABEL : 'Year Model';
}

function canQuickEditAssetDetail(asset: RegisterAsset, target: AssetDetailEditTarget): boolean {
  const isStock = asset.kind === 'stock';
  const isProperty = asset.kind === 'property';
  const isLand = isProperty && normalizePropertyAssetSubtype(
    asset.specsJson.propertyAssetSubtype ?? asset.specsJson.property_asset_subtype,
  ) === 'land';

  if (target === 'serial' || target === 'usage') {
    return !isProperty && !isStock;
  }

  return !isStock && !isLand;
}

function draftYearLabel(kind: AssetKind): string {
  return kind === 'property' ? PROPERTY_YEAR_LABEL : 'Year model';
}

function getManualAssetOption(kind: AssetKind) {
  const normalizedKind = normalizeDraftKind(kind);
  return MANUAL_ASSET_TYPE_OPTIONS.find((option) => option.value === normalizedKind) ?? MANUAL_ASSET_TYPE_OPTIONS[0];
}

function isSavedManualAsset(asset: RegisterAsset | null | undefined): asset is RegisterAsset {
  if (!asset || asset.valuationRunId) return false;
  return asset.selectedMethod !== 'aim4price';
}

function isSavedAim4priceAsset(asset: RegisterAsset | null | undefined): asset is RegisterAsset {
  return Boolean(asset && (asset.selectedMethod === 'aim4price' || asset.valuationRunId));
}

function formatLifetimePercentPlain(value: number | null | undefined): string {
  if (value === null || typeof value === 'undefined' || !Number.isFinite(Number(value))) return '';
  const rounded = Math.round(Number(value) * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

function formatProjectionWorkedPercent(value: number | null | undefined): string {
  const formatted = formatLifetimePercentPlain(value);
  return formatted ? `${formatted}%` : '—';
}

function normalizeSettingsLifeWorkedInput(value: unknown): number | null {
  const normalized = String(value ?? '').replace(',', '.').trim();
  if (!normalized) return null;

  const parsed = Number(normalized);
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 100) return null;

  return Math.round(parsed * 10) / 10;
}

function normalizeSettingsUsageAmountInput(value: unknown): number | null {
  const raw = String(value ?? '').trim();
  if (!raw || raw.replace(/\s+/g, '').startsWith('-')) return null;

  const digits = raw.replace(/[^0-9]/g, '');
  if (!digits) return null;

  const parsed = Number(digits);
  if (!Number.isFinite(parsed) || parsed < 0) return null;

  return Math.round(parsed);
}

function getAssetSettingsUsageMode(asset: RegisterAsset): AssetSettingsUsageMode {
  if (assetUsesPercentUsage(asset)) {
    return 'percent';
  }

  if (asset.kind === 'vehicle' || getAssetUsageMetric(asset) === 'km') {
    return 'km';
  }

  if (asset.kind === 'tractor' || asset.kind === 'equipment') {
    return 'hours';
  }

  const savedHours = Number(asset.hours);
  return Number.isFinite(savedHours) && savedHours >= 0 ? 'hours' : 'none';
}

function getAssetSettingsUsageCurrentValue(asset: RegisterAsset, mode: AssetSettingsUsageMode): number | null {
  if (mode === 'percent') {
    return getAssetLifeWorkedPercent(asset);
  }

  if (mode === 'hours' || mode === 'km') {
    const savedUsage = Number(asset.hours);
    return Number.isFinite(savedUsage) && savedUsage >= 0 ? Math.round(savedUsage) : null;
  }

  return null;
}

function assetSettingsUsageHeading(mode: AssetSettingsUsageMode): string {
  if (mode === 'percent') return 'Correct lifetime usage';
  if (mode === 'hours') return 'Correct machine hours';
  if (mode === 'km') return 'Correct kilometres';
  return 'Correct usage';
}

function assetSettingsUsageInputLabel(mode: AssetSettingsUsageMode): string {
  if (mode === 'percent') return 'New lifetime usage %';
  if (mode === 'hours') return 'New machine hours';
  if (mode === 'km') return 'New odometer reading';
  return 'New usage reading';
}

function assetSettingsUsagePlaceholder(mode: AssetSettingsUsageMode, currentValue: number | null): string {
  if (currentValue !== null) {
    return mode === 'percent' ? formatLifetimePercentPlain(currentValue) : formatUsageAmountInput(currentValue);
  }

  if (mode === 'percent') return 'Enter percentage';
  if (mode === 'hours') return 'Enter machine hours';
  if (mode === 'km') return 'Enter kilometres';
  return 'Enter usage';
}

function assetSettingsUsageInvalidMessage(mode: AssetSettingsUsageMode): string {
  if (mode === 'percent') return 'Lifetime usage must be between 0% and 100%.';
  if (mode === 'hours') return 'Machine hours must be zero or greater.';
  if (mode === 'km') return 'Odometer reading must be zero or greater.';
  return 'Usage reading must be zero or greater.';
}

function formatAssetSettingsUsageDisplay(mode: AssetSettingsUsageMode, value: number | null): string {
  if (value === null) return 'Not set';
  if (mode === 'percent') return `${formatLifetimePercentPlain(value)}%`;
  if (mode === 'hours') return `${Math.round(value).toLocaleString('en-ZA')} hours`;
  if (mode === 'km') return `${Math.round(value).toLocaleString('en-ZA')} km`;
  return Math.round(value).toLocaleString('en-ZA');
}

function formatAssetSettingsUsageInput(asset: RegisterAsset, mode: AssetSettingsUsageMode): string {
  const currentValue = getAssetSettingsUsageCurrentValue(asset, mode);
  if (currentValue === null) return '';
  return mode === 'percent' ? formatLifetimePercentPlain(currentValue) : formatUsageAmountInput(currentValue);
}

function parseAssetSettingsUsageInput(mode: AssetSettingsUsageMode, value: unknown): number | null {
  return mode === 'percent' ? normalizeSettingsLifeWorkedInput(value) : normalizeSettingsUsageAmountInput(value);
}

function getAssetSettingsUsageSuccessMessage(mode: AssetSettingsUsageMode): string {
  if (mode === 'percent') return 'Lifetime usage updated.';
  if (mode === 'hours') return 'Machine hours updated.';
  if (mode === 'km') return 'Odometer reading updated.';
  return 'Usage updated.';
}

function getAssetSettingsUsageForKind(asset: RegisterAsset, nextKind: AssetKind): {
  hours: number | null;
  usageMetric: UsageMetric | null;
  lifeWorkedPercent: number | null;
  condition: AssetConditionValue | null;
} {
  const existingPercent = getAssetLifeWorkedPercent(asset);

  if (nextKind === 'vehicle') {
    return {
      hours: asset.hours ?? null,
      usageMetric: 'km',
      lifeWorkedPercent: null,
      condition: asset.condition || null,
    };
  }

  if (nextKind === 'equipment' || nextKind === 'tractor') {
    return {
      hours: asset.hours ?? null,
      usageMetric: 'hours',
      lifeWorkedPercent: existingPercent,
      condition: asset.condition || null,
    };
  }

  if (nextKind === 'tools') {
    return {
      hours: null,
      usageMetric: null,
      lifeWorkedPercent: existingPercent,
      condition: asset.condition || null,
    };
  }

  return {
    hours: null,
    usageMetric: null,
    lifeWorkedPercent: null,
    condition: asset.condition || null,
  };
}

function buildAssetSettingsSpecsJson(asset: RegisterAsset, nextKind: AssetKind, usageMetric: UsageMetric | null, lifeWorkedPercent: number | null): Record<string, unknown> {
  const specs = isPlainRecord(asset.specsJson) ? { ...asset.specsJson } : {};

  if (nextKind !== 'manual') {
    GENERAL_ASSET_INSURANCE_SPEC_KEYS.forEach((key) => delete specs[key]);
  }

  specs.manualAssetKind = nextKind;
  specs.manual_asset_kind = nextKind;
  specs.usageMetric = usageMetric;
  specs.usage_metric = usageMetric;

  if (lifeWorkedPercent === null) {
    delete specs.lifeWorkedPercent;
    delete specs.life_worked_percent;
    delete specs.workedPercent;
    delete specs.worked_percent;
    delete specs.percentWorked;
    delete specs.percent_worked;
    delete specs.lifetimeWorkedPercent;
    delete specs.lifetime_worked_percent;
    delete specs.lifetimeUsedPercent;
    delete specs.lifetime_used_percent;

    if (usageMetric) {
      specs.usageMode = usageMetric;
      specs.usage_mode = usageMetric;
      specs.usageBasis = 'reading';
      specs.usage_basis = 'reading';
    } else {
      delete specs.usageMode;
      delete specs.usage_mode;
      delete specs.usageBasis;
      delete specs.usage_basis;
    }
  } else {
    specs.usageMode = 'percent';
    specs.usage_mode = 'percent';
    specs.usageBasis = 'percent';
    specs.usage_basis = 'percent';
    specs.lifeWorkedPercent = lifeWorkedPercent;
    specs.life_worked_percent = lifeWorkedPercent;
    specs.workedPercent = lifeWorkedPercent;
    specs.worked_percent = lifeWorkedPercent;
    specs.percentWorked = lifeWorkedPercent;
    specs.percent_worked = lifeWorkedPercent;
    specs.lifetimeWorkedPercent = lifeWorkedPercent;
    specs.lifetime_worked_percent = lifeWorkedPercent;
    specs.lifetimeUsedPercent = lifeWorkedPercent;
    specs.lifetime_used_percent = lifeWorkedPercent;
  }

  if (nextKind === 'property') {
    specs.licenseStatus = 'not_applicable';
    specs.license_status = 'not_applicable';
    specs.licensedStatus = 'not_applicable';
    specs.licensed_status = 'not_applicable';
    specs.licenceStatus = 'not_applicable';
    specs.licence_status = 'not_applicable';
    specs.licencedStatus = 'not_applicable';
    specs.licenced_status = 'not_applicable';
    specs.licenseRegistrationNumber = '';
    specs.license_registration_number = '';
    specs.licenceRegistrationNumber = '';
    specs.licence_registration_number = '';
    specs.licenseRegistration = '';
    specs.license_registration = '';
    specs.registrationNumber = '';
    specs.registration_number = '';
    specs.numberPlate = '';
    specs.number_plate = '';
    delete specs.brandName;
    delete specs.brand_name;
    delete specs.brand;
    delete specs.modelName;
    delete specs.model_name;
    delete specs.model;
    delete specs.typedModelName;
    delete specs.typed_model_name;
  }

  return specs;
}

function normalizeAssetStatusChoice(value: unknown, fallback: AssetStatusChoice = 'unknown'): AssetStatusChoice {
  const normalized = String(value ?? '').trim().toLowerCase().replace(/[\s-]+/g, '_');

  if (['yes', 'y', 'true', 'financed', 'insured', 'licensed', 'licenced', 'is_financed', 'is_insured', 'is_licensed'].includes(normalized)) {
    return 'yes';
  }

  if (['no', 'n', 'false', 'not_financed', 'not_insured', 'not_licensed', 'not_licenced', 'unfinanced', 'uninsured', 'unlicensed', 'unlicenced'].includes(normalized)) {
    return 'no';
  }

  if (['na', 'n_a', 'not_applicable', 'not_aplicable', 'not_relevant', 'does_not_apply'].includes(normalized)) {
    return 'not_applicable';
  }

  if (['unknown', 'not_sure', 'unsure', 'maybe', ''].includes(normalized)) {
    return normalized ? 'unknown' : fallback;
  }

  return fallback;
}

function normalizeFinanceStatusChoice(value: unknown, fallback: FinanceStatusChoice = 'unknown'): FinanceStatusChoice {
  const normalized = String(value ?? '').trim().toLowerCase().replace(/[\s-]+/g, '_');
  if (['paid', 'paid_off', 'settled', 'settled_in_full', 'fully_paid'].includes(normalized)) return 'paid';
  return normalizeAssetStatusChoice(value, fallback === 'paid' ? 'unknown' : fallback);
}

function readFinanceStatusChoice(asset: RegisterAsset): FinanceStatusChoice {
  const specs = isPlainRecord(asset.specsJson) ? asset.specsJson : {};

  return normalizeFinanceStatusChoice(
    specs.financeStatus ?? specs.finance_status ?? specs.financedStatus ?? specs.financed_status,
    asset.isFinanced ? 'yes' : 'no',
  );
}

function readInsuranceStatusChoice(asset: RegisterAsset): AssetStatusChoice {
  const specs = isPlainRecord(asset.specsJson) ? asset.specsJson : {};
  const insuredValueExVat = readAssetInsuredValueExVat(asset);

  return normalizeAssetStatusChoice(
    specs.insuranceStatus ?? specs.insurance_status ?? specs.insuredStatus ?? specs.insured_status,
    asset.isInsured || insuredValueExVat !== null ? 'yes' : 'no',
  );
}

function readLicenseStatusChoice(asset: RegisterAsset): AssetStatusChoice {
  if (asset.kind === 'property') {
    return 'not_applicable';
  }

  const specs = isPlainRecord(asset.specsJson) ? asset.specsJson : {};

  return normalizeAssetStatusChoice(
    specs.licenseStatus ??
      specs.license_status ??
      specs.licensedStatus ??
      specs.licensed_status ??
      specs.licenceStatus ??
      specs.licence_status ??
      specs.licencedStatus ??
      specs.licenced_status,
    asset.isLicensed ? 'yes' : 'no',
  );
}

function normalizeLicenseRegistrationText(value: unknown): string {
  return String(value ?? '').replace(/\s+/g, ' ').trim().toUpperCase();
}

function readLicenseRegistrationNumber(asset: Pick<RegisterAsset, 'licenseRegistrationNumber' | 'specsJson'>): string {
  const direct = normalizeLicenseRegistrationText(asset.licenseRegistrationNumber);
  if (direct) return direct;

  const specs = isPlainRecord(asset.specsJson) ? asset.specsJson : {};

  return normalizeLicenseRegistrationText(
    specs.licenseRegistrationNumber ??
      specs.license_registration_number ??
      specs.licenceRegistrationNumber ??
      specs.licence_registration_number ??
      specs.licenseRegistration ??
      specs.license_registration ??
      specs.licenceRegistration ??
      specs.licence_registration ??
      specs.registrationNumber ??
      specs.registration_number ??
      specs.numberPlate ??
      specs.number_plate ??
      specs.numberplate,
  );
}

function readInsuranceNote(asset: Pick<RegisterAsset, 'specsJson'>): string {
  const specs = isPlainRecord(asset.specsJson) ? asset.specsJson : {};

  return String(
    specs.insuranceNote ??
      specs.insurance_note ??
      specs.insuredNote ??
      specs.insured_note ??
      '',
  ).trim();
}

function readSpecsText(asset: Pick<RegisterAsset, 'specsJson'>, keys: string[]): string {
  const specs = isPlainRecord(asset.specsJson) ? asset.specsJson : {};

  for (const key of keys) {
    const value = specs[key];
    if (value === null || typeof value === 'undefined') continue;

    const text = String(value).trim();
    if (text) return text;
  }

  return '';
}

function readSpecsNumber(asset: Pick<RegisterAsset, 'specsJson'>, keys: string[]): number | null {
  const specs = isPlainRecord(asset.specsJson) ? asset.specsJson : {};

  return readNumberFromSpecs(specs, keys);
}

function readFinanceType(asset: Pick<RegisterAsset, 'specsJson'>): string {
  const value = readSpecsText(asset, ['financeType', 'finance_type']);
  const normalized = value.trim().toLowerCase().replace(/[\s-]+/g, '_');

  if (normalized === 'asset_specific' || normalized === 'asset_specific_finance') return 'asset_specific';
  if (normalized === 'bulk_group' || normalized === 'bulk' || normalized === 'group' || normalized === 'group_finance') return 'bulk_group';
  if (normalized === 'unknown' || normalized === 'not_sure' || normalized === 'unsure') return 'unknown';
  return '';
}

function readAssetFinanceNote(asset: Pick<RegisterAsset, 'financeNote' | 'specsJson'>): string {
  const direct = String(asset.financeNote ?? '').trim();
  if (direct) return direct;

  return readSpecsText(asset, ['financeNote', 'finance_note']);
}

function readLicenseNote(asset: Pick<RegisterAsset, 'specsJson'>): string {
  return readSpecsText(asset, ['licenseNote', 'license_note', 'licenceNote', 'licence_note']);
}

function formatStatusMoneyInput(value: number | null | undefined): string {
  return value === null || typeof value === 'undefined' || !Number.isFinite(value) ? '' : formatRegisterValueInput(value);
}

function formatStatusNumberInput(value: unknown): string {
  if (value === null || typeof value === 'undefined' || value === '') return '';
  const numeric = Number(value);
  return Number.isFinite(numeric) ? String(numeric) : String(value).trim();
}

function buildAssetStatusDraftFromAsset(asset: RegisterAsset): AssetStatusDraft {
  const financeStatus = readFinanceStatusChoice(asset);
  const hasFinanceHistory = financeStatus === 'yes' || financeStatus === 'paid';
  const insuranceStatus = readInsuranceStatusChoice(asset);
  const licenseStatus = readLicenseStatusChoice(asset);

  return {
    financeStatus,
    financeType: hasFinanceHistory ? readFinanceType(asset) : '',
    financeCurrentOutstandingExVat: financeStatus === 'yes'
      ? formatStatusMoneyInput(readSpecsNumber(asset, ['financeCurrentOutstandingExVat', 'finance_current_outstanding_ex_vat']))
      : '',
    financierName: hasFinanceHistory ? readSpecsText(asset, ['financierName', 'financier_name']) : '',
    financeNote: hasFinanceHistory ? readAssetFinanceNote(asset) : '',
    financeBoughtWhen: readSpecsText(asset, ['financeBoughtWhen', 'finance_bought_when']),
    financeBoughtForExVat: formatStatusMoneyInput(readSpecsNumber(asset, ['financeBoughtForExVat', 'finance_bought_for_ex_vat'])),
    financeOriginalAmountExVat: hasFinanceHistory
      ? formatStatusMoneyInput(readSpecsNumber(asset, ['financeOriginalAmountExVat', 'finance_original_amount_ex_vat']))
      : '',
    financeMonthlyPaymentExVat: hasFinanceHistory
      ? formatStatusMoneyInput(readSpecsNumber(asset, ['financeMonthlyPaymentExVat', 'finance_monthly_payment_ex_vat']))
      : '',
    financeInterestRatePercent: hasFinanceHistory
      ? formatStatusNumberInput(readSpecsNumber(asset, ['financeInterestRatePercent', 'finance_interest_rate_percent']))
      : '',
    financeTermMonths: hasFinanceHistory
      ? formatStatusNumberInput(readSpecsNumber(asset, ['financeTermMonths', 'finance_term_months']))
      : '',
    financeBalloonPaymentExVat: hasFinanceHistory
      ? formatStatusMoneyInput(readSpecsNumber(asset, ['financeBalloonPaymentExVat', 'finance_balloon_payment_ex_vat']))
      : '',
    financeSettlementDate: hasFinanceHistory ? readSpecsText(asset, ['financeSettlementDate', 'finance_settlement_date']) : '',
    financeReferenceNumber: hasFinanceHistory ? readSpecsText(asset, ['financeReferenceNumber', 'finance_reference_number']) : '',
    insuranceStatus,
    insuredValueExVat: insuranceStatus === 'yes' ? formatStatusMoneyInput(readAssetInsuredValueExVat(asset)) : '',
    insuranceInsurerName: insuranceStatus === 'yes' ? readSpecsText(asset, ['insuranceInsurerName', 'insurance_insurer_name']) : '',
    insurancePolicyNumber: insuranceStatus === 'yes' ? readSpecsText(asset, ['insurancePolicyNumber', 'insurance_policy_number']) : '',
    insuranceRenewalDate: insuranceStatus === 'yes' ? readSpecsText(asset, ['insuranceRenewalDate', 'insurance_renewal_date']) : '',
    insuranceNote: insuranceStatus === 'yes' ? readInsuranceNote(asset) : '',
    licenseStatus,
    licenseRegistrationNumber: licenseStatus === 'yes' ? readLicenseRegistrationNumber(asset) : '',
    licenseRenewalDate: licenseStatus === 'yes' ? readSpecsText(asset, ['licenseRenewalDate', 'license_renewal_date', 'licenceRenewalDate', 'licence_renewal_date']) : '',
    licenseNote: licenseStatus === 'yes' ? readLicenseNote(asset) : '',
  };
}

function statusChoiceSentenceLabel(value: AssetStatusChoice, labels: { yes: string; no: string; unknown: string; notApplicable: string }): string {
  if (value === 'yes') return labels.yes;
  if (value === 'no') return labels.no;
  if (value === 'not_applicable') return labels.notApplicable;
  return labels.unknown;
}

function financeStatusSummary(draft: AssetStatusDraft): string {
  if (draft.financeStatus === 'paid') return 'Paid off';
  if (draft.financeStatus !== 'yes') {
    return statusChoiceSentenceLabel(draft.financeStatus, {
      yes: 'Financed',
      no: 'Not financed',
      unknown: 'Not sure',
      notApplicable: 'Not applicable',
    });
  }

  const parts = ['Financed'];
  const outstanding = parseRegisterValueInput(draft.financeCurrentOutstandingExVat);
  if (draft.financeCurrentOutstandingExVat.trim() && Number.isFinite(outstanding)) {
    parts.push(`${money(outstanding)} outstanding excl. VAT`);
  }
  if (draft.financierName.trim()) parts.push(draft.financierName.trim());
  return parts.join(' · ');
}

function insuranceStatusSummary(draft: AssetStatusDraft): string {
  if (draft.insuranceStatus !== 'yes') {
    return statusChoiceSentenceLabel(draft.insuranceStatus, {
      yes: 'Insured',
      no: 'Not insured',
      unknown: 'Not sure',
      notApplicable: 'Not applicable',
    });
  }

  const insuredValue = parseRegisterValueInput(draft.insuredValueExVat);
  if (draft.insuredValueExVat.trim() && insuredValue > 0) {
    return `Insured for ${money(insuredValue)} excl. VAT`;
  }

  return 'Insured';
}

function licenseStatusSummary(draft: AssetStatusDraft): string {
  if (draft.licenseStatus !== 'yes') {
    return statusChoiceSentenceLabel(draft.licenseStatus, {
      yes: 'Licensed',
      no: 'Not licensed',
      unknown: 'Not sure',
      notApplicable: 'Not applicable',
    });
  }

  const registrationNumber = normalizeLicenseRegistrationText(draft.licenseRegistrationNumber);
  return registrationNumber ? `Licensed · ${registrationNumber}` : 'Licensed';
}

function optionalMoneyForStatusPayload(value: string): number | null {
  return value.trim() ? parseRegisterValueInput(value) : null;
}

function optionalNumberForStatusPayload(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed.replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : NaN;
}

function statusOptionalText(value: string): string {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function buildStatusSpecsFragment(draft: AssetStatusDraft, licenseApplicable: boolean): Record<string, unknown> {
  const financeStatus = draft.financeStatus;
  const hasFinanceHistory = financeStatus === 'yes' || financeStatus === 'paid';
  const insuranceStatus = draft.insuranceStatus;
  const licenseStatus: AssetStatusChoice = licenseApplicable ? draft.licenseStatus : 'not_applicable';
  const insuredValueExVat = insuranceStatus === 'yes' ? optionalMoneyForStatusPayload(draft.insuredValueExVat) : null;
  const licenseRegistrationNumber = licenseStatus === 'yes' ? normalizeLicenseRegistrationText(draft.licenseRegistrationNumber) : '';
  const financeCurrentOutstandingExVat = financeStatus === 'yes' ? optionalMoneyForStatusPayload(draft.financeCurrentOutstandingExVat) : null;
  const financeBoughtForExVat = optionalMoneyForStatusPayload(draft.financeBoughtForExVat);
  const financeOriginalAmountExVat = hasFinanceHistory ? optionalMoneyForStatusPayload(draft.financeOriginalAmountExVat) : null;
  const financeMonthlyPaymentExVat = hasFinanceHistory ? optionalMoneyForStatusPayload(draft.financeMonthlyPaymentExVat) : null;
  const financeInterestRatePercent = hasFinanceHistory ? optionalNumberForStatusPayload(draft.financeInterestRatePercent) : null;
  const financeTermMonths = hasFinanceHistory ? optionalNumberForStatusPayload(draft.financeTermMonths) : null;
  const financeBalloonPaymentExVat = hasFinanceHistory ? optionalMoneyForStatusPayload(draft.financeBalloonPaymentExVat) : null;

  return {
    financeStatus,
    finance_status: financeStatus,
    financeType: hasFinanceHistory ? draft.financeType || null : null,
    finance_type: hasFinanceHistory ? draft.financeType || null : null,
    financeCurrentOutstandingExVat,
    finance_current_outstanding_ex_vat: financeCurrentOutstandingExVat,
    financierName: hasFinanceHistory ? statusOptionalText(draft.financierName) : '',
    financier_name: hasFinanceHistory ? statusOptionalText(draft.financierName) : '',
    financeBoughtWhen: statusOptionalText(draft.financeBoughtWhen),
    finance_bought_when: statusOptionalText(draft.financeBoughtWhen),
    financeBoughtForExVat,
    finance_bought_for_ex_vat: financeBoughtForExVat,
    financeOriginalAmountExVat,
    finance_original_amount_ex_vat: financeOriginalAmountExVat,
    financeMonthlyPaymentExVat,
    finance_monthly_payment_ex_vat: financeMonthlyPaymentExVat,
    financeInterestRatePercent,
    finance_interest_rate_percent: financeInterestRatePercent,
    financeTermMonths,
    finance_term_months: financeTermMonths,
    financeBalloonPaymentExVat,
    finance_balloon_payment_ex_vat: financeBalloonPaymentExVat,
    financeSettlementDate: hasFinanceHistory ? statusOptionalText(draft.financeSettlementDate) : '',
    finance_settlement_date: hasFinanceHistory ? statusOptionalText(draft.financeSettlementDate) : '',
    financeReferenceNumber: hasFinanceHistory ? statusOptionalText(draft.financeReferenceNumber) : '',
    finance_reference_number: hasFinanceHistory ? statusOptionalText(draft.financeReferenceNumber) : '',
    insuranceStatus,
    insurance_status: insuranceStatus,
    insuredStatus: insuranceStatus,
    insured_status: insuranceStatus,
    insuredValueExVat,
    insured_value_ex_vat: insuredValueExVat,
    insuranceValueExVat: insuredValueExVat,
    insurance_value_ex_vat: insuredValueExVat,
    insuredValue: insuredValueExVat,
    insured_value: insuredValueExVat,
    insuranceValue: insuredValueExVat,
    insurance_value: insuredValueExVat,
    insuranceInsurerName: insuranceStatus === 'yes' ? statusOptionalText(draft.insuranceInsurerName) : '',
    insurance_insurer_name: insuranceStatus === 'yes' ? statusOptionalText(draft.insuranceInsurerName) : '',
    insurancePolicyNumber: insuranceStatus === 'yes' ? statusOptionalText(draft.insurancePolicyNumber) : '',
    insurance_policy_number: insuranceStatus === 'yes' ? statusOptionalText(draft.insurancePolicyNumber) : '',
    insuranceRenewalDate: insuranceStatus === 'yes' ? statusOptionalText(draft.insuranceRenewalDate) : '',
    insurance_renewal_date: insuranceStatus === 'yes' ? statusOptionalText(draft.insuranceRenewalDate) : '',
    insuranceNote: insuranceStatus === 'yes' ? statusOptionalText(draft.insuranceNote) : '',
    insurance_note: insuranceStatus === 'yes' ? statusOptionalText(draft.insuranceNote) : '',
    insuredNote: insuranceStatus === 'yes' ? statusOptionalText(draft.insuranceNote) : '',
    insured_note: insuranceStatus === 'yes' ? statusOptionalText(draft.insuranceNote) : '',
    licenseStatus,
    license_status: licenseStatus,
    licensedStatus: licenseStatus,
    licensed_status: licenseStatus,
    licenceStatus: licenseStatus,
    licence_status: licenseStatus,
    licencedStatus: licenseStatus,
    licenced_status: licenseStatus,
    licenseRegistrationNumber,
    license_registration_number: licenseRegistrationNumber,
    licenceRegistrationNumber: licenseRegistrationNumber,
    licence_registration_number: licenseRegistrationNumber,
    licenseRegistration: licenseRegistrationNumber,
    license_registration: licenseRegistrationNumber,
    registrationNumber: licenseRegistrationNumber,
    registration_number: licenseRegistrationNumber,
    numberPlate: licenseRegistrationNumber,
    number_plate: licenseRegistrationNumber,
    licenseRenewalDate: licenseStatus === 'yes' ? statusOptionalText(draft.licenseRenewalDate) : '',
    license_renewal_date: licenseStatus === 'yes' ? statusOptionalText(draft.licenseRenewalDate) : '',
    licenseNote: licenseStatus === 'yes' ? statusOptionalText(draft.licenseNote) : '',
    license_note: licenseStatus === 'yes' ? statusOptionalText(draft.licenseNote) : '',
  };
}

function statusChoiceLabel(value: AssetStatusChoice): string {
  if (value === 'yes') return 'Yes';
  if (value === 'no') return 'No';
  if (value === 'not_applicable') return 'N/A';
  return 'Not sure';
}

function statusChoiceReportLabel(value: FinanceStatusChoice): string {
  if (value === 'paid') return 'Paid off';
  if (value === 'not_applicable') return 'Not applicable';
  return statusChoiceLabel(value);
}

function renderAssetStatusMark(value: FinanceStatusChoice) {
  const status = value === 'paid' ? 'paid' : normalizeAssetStatusChoice(value);
  const config = {
    yes: { label: '✓', className: styles.statusMarkYes, title: 'Yes' },
    paid: { label: '✓', className: styles.statusMarkYes, title: 'Paid off' },
    no: { label: '×', className: styles.statusMarkNo, title: 'No' },
    unknown: { label: '?', className: styles.statusMarkUnknown, title: 'Not sure' },
    not_applicable: { label: 'N/A', className: styles.statusMarkNotApplicable, title: 'Not applicable' },
  }[status];

  return (
    <strong className={`${styles.assetStatusMark} ${config.className}`} aria-label={config.title} title={config.title}>
      {config.label}
    </strong>
  );
}

function conditionLabel(value: AssetConditionValue): string {
  return (
    {
      excellent: 'Excellent',
      good: 'Good',
      fair: 'Fair',
      used: 'Used',
      serious: 'Requires attention',
      '': '—',
    }[value] ?? '—'
  );
}

function formatDrive(value: string): string {
  if (value === '4wd') return '4WD';
  if (value === '2wd') return '2WD';
  if (value === 'tracks') return 'Tracks';
  return value || '—';
}

function formatCab(value: string): string {
  if (value === 'cab') return 'Cab';
  if (value === 'open-station') return 'Open station';
  return value || '—';
}

function formatTractorType(value: string): string {
  if (value === 'field') return 'Field';
  if (value === 'orchard') return 'Orchard';
  return value || '—';
}

function uniquePhotoUrls(value: string[]): string[] {
  const seen = new Set<string>();

  return value
    .map((entry) => String(entry ?? '').trim())
    .filter(Boolean)
    .filter((entry) => {
      if (seen.has(entry)) {
        return false;
      }

      seen.add(entry);
      return true;
    });
}

function normalizePhotos(value: string[]): string[] {
  return uniquePhotoUrls(value).slice(0, MAX_PHOTOS);
}

function limitPhotosToNewest(value: string[]): string[] {
  return uniquePhotoUrls(value).slice(-MAX_PHOTOS);
}

function limitDraftPhotosWithMainPreference(value: string[], shouldPreserveFirstPhoto: boolean): string[] {
  const photos = uniquePhotoUrls(value);

  if (photos.length <= MAX_PHOTOS) {
    return photos;
  }

  if (!shouldPreserveFirstPhoto) {
    return photos.slice(-MAX_PHOTOS);
  }

  const mainPhoto = photos[0];
  const remainingPhotos = photos.slice(1).filter((photo) => photo !== mainPhoto);
  return [mainPhoto, ...remainingPhotos.slice(-(MAX_PHOTOS - 1))];
}

function mediaInputId(assetId: string, type: DetailMediaUploadType): string {
  return `asset-${type}-upload-${assetId}`;
}

function savedDraftPhotoKey(url: string): string {
  return `saved:${url}`;
}

function pendingDraftPhotoKey(id: string): string {
  return `pending:${id}`;
}

function mainPhotoSelectionKey(selection: MainPhotoSelection | null): string | null {
  if (!selection) return null;
  return selection.source === 'saved' ? savedDraftPhotoKey(selection.url) : pendingDraftPhotoKey(selection.id);
}

function createPendingPhotoId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function createPhotoPreviewUrl(file: File): string {
  if (typeof URL === 'undefined' || typeof URL.createObjectURL !== 'function') {
    return '';
  }

  return URL.createObjectURL(file);
}

function revokePhotoPreviewUrl(previewUrl: string): void {
  if (!previewUrl || !previewUrl.startsWith('blob:')) return;
  if (typeof URL === 'undefined' || typeof URL.revokeObjectURL !== 'function') return;

  URL.revokeObjectURL(previewUrl);
}

function buildDraftPhotoItems(
  savedPhotos: string[],
  pendingPhotos: PendingPhotoFile[],
  selection: MainPhotoSelection | null,
): DraftPhotoItem[] {
  const savedItems: DraftPhotoItem[] = normalizePhotos(savedPhotos).map((photo, index) => ({
    key: savedDraftPhotoKey(photo),
    source: 'saved',
    label: `Saved photo ${index + 1}`,
    previewUrl: photo,
    url: photo,
    isMain: false,
  }));

  const pendingItems: DraftPhotoItem[] = pendingPhotos.map((entry, index) => ({
    key: pendingDraftPhotoKey(entry.id),
    source: 'pending',
    label: entry.file.name || `Queued photo ${index + 1}`,
    previewUrl: entry.previewUrl,
    pendingId: entry.id,
    isMain: false,
  }));

  const items = [...savedItems, ...pendingItems];
  if (!items.length) return [];

  const preferredKey = mainPhotoSelectionKey(selection);
  const mainKey = preferredKey && items.some((item) => item.key === preferredKey) ? preferredKey : items[0].key;
  const mainItem = items.find((item) => item.key === mainKey);
  const orderedItems = mainItem ? [mainItem, ...items.filter((item) => item.key !== mainKey)] : items;

  return orderedItems.map((item, index) => ({
    ...item,
    isMain: index === 0,
  }));
}


function normalizeDocuments(value: unknown): AssetDocument[] {
  const rawItems = Array.isArray(value) ? value : [];
  const seen = new Set<string>();
  const documents: AssetDocument[] = [];

  rawItems.forEach((entry, index) => {
    let document: AssetDocument | null = null;

    if (typeof entry === 'string') {
      const url = entry.trim();
      if (url) {
        document = {
          id: url,
          url,
          fileName: `Document ${index + 1}`,
          contentType: 'application/octet-stream',
          byteSize: 0,
          uploadedAtIso: new Date().toISOString(),
          category: 'other',
          documentType: 'other',
        };
      }
    } else if (isPlainRecord(entry)) {
      const url = String(entry.url ?? '').trim();
      const fileName = String(entry.fileName ?? entry.name ?? entry.title ?? '').trim();

      if (url) {
        document = {
          id: String(entry.id ?? entry.uploadId ?? url).trim() || url,
          url,
          fileName: fileName || `Document ${index + 1}`,
          contentType: String(entry.contentType ?? entry.mimeType ?? 'application/octet-stream').trim() || 'application/octet-stream',
          byteSize: Math.max(0, Math.round(Number(entry.byteSize ?? entry.sizeBytes ?? 0) || 0)),
          uploadedAtIso: String(entry.uploadedAtIso ?? entry.uploadedAt ?? '').trim() || new Date().toISOString(),
          category: normalizeAssetDocumentCategory(entry.category ?? entry.documentCategory),
          documentType: normalizeAssetDocumentType(entry.documentType ?? entry.type),
        };
      }
    }

    if (!document) return;

    const duplicateKey = document.url || document.id;
    if (seen.has(duplicateKey)) return;

    seen.add(duplicateKey);
    documents.push(document);
  });

  return documents.slice(0, MAX_DOCUMENTS);
}

function assetDocuments(asset: RegisterAsset): AssetDocument[] {
  return normalizeDocuments(asset.documents);
}

function formatByteSize(value: number): string {
  const bytes = Math.max(0, Math.round(Number(value) || 0));

  if (!bytes) return 'Saved document';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;

  const mb = bytes / (1024 * 1024);
  return `${mb.toFixed(mb >= 10 ? 0 : 1)} MB`;
}

function shortDocumentName(value: string): string {
  const text = String(value ?? '').trim();
  if (!text) return 'Document';
  return text.length > 34 ? `${text.slice(0, 18)}…${text.slice(-10)}` : text;
}

function displayDocumentName(value: string, index: number): string {
  const text = String(value ?? '').trim().split(/[\\/]/).pop() ?? '';
  const extensionMatch = text.match(/(\.[a-z0-9]{2,8})$/i);
  const extension = extensionMatch?.[1]?.toLowerCase() ?? '';
  const stem = extension ? text.slice(0, -extension.length) : text;
  const looksGenerated =
    /^[0-9a-f]{8}-[0-9a-f-]{20,}$/i.test(stem) ||
    /^[0-9a-f]{24,}$/i.test(stem);

  return looksGenerated ? `Document ${index + 1}${extension}` : shortDocumentName(text);
}

const DOCUMENT_OBJECT_URL_TTL_MS = 5 * 60 * 1000;

type CachedDocumentObjectUrl = {
  objectUrl: string;
  timeoutId: number | null;
};

function isDataDocumentUrl(value: string): boolean {
  return /^data:/i.test(String(value ?? '').trim());
}

function parseDataUrlToBlob(dataUrl: string): Blob {
  const match = /^data:([^;,]*)(;base64)?,([\s\S]*)$/i.exec(dataUrl);

  if (!match) {
    throw new Error('Invalid document data.');
  }

  const mimeType = match[1] || 'application/octet-stream';
  const isBase64 = Boolean(match[2]);
  const payload = match[3] || '';

  if (!isBase64) {
    return new Blob([decodeURIComponent(payload)], { type: mimeType });
  }

  const binaryString = window.atob(payload.replace(/\s/g, ''));
  const slices: Uint8Array[] = [];
  const sliceSize = 8192;

  for (let offset = 0; offset < binaryString.length; offset += sliceSize) {
    const slice = binaryString.slice(offset, offset + sliceSize);
    const bytes = new Uint8Array(slice.length);

    for (let index = 0; index < slice.length; index += 1) {
      bytes[index] = slice.charCodeAt(index);
    }

    slices.push(bytes);
  }

  return new Blob(slices, { type: mimeType });
}

async function createDataDocumentObjectUrl(dataUrl: string): Promise<string> {
  try {
    const response = await fetch(dataUrl);

    if (response.ok) {
      const blob = await response.blob();

      if (blob.size > 0) {
        return URL.createObjectURL(blob);
      }
    }
  } catch {
    // Fall back to manual decoding below. Some browsers are unreliable with large data URLs.
  }

  return URL.createObjectURL(parseDataUrlToBlob(dataUrl));
}

function writeDocumentOpeningPage(targetWindow: Window, fileName: string): void {
  try {
    targetWindow.document.title = fileName ? `Opening ${fileName}` : 'Opening document';
    targetWindow.document.body.replaceChildren();
    targetWindow.document.body.style.margin = '0';
    targetWindow.document.body.style.fontFamily = 'Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
    targetWindow.document.body.style.background = '#f5f7f8';
    targetWindow.document.body.style.color = '#0b332a';

    const wrapper = targetWindow.document.createElement('div');
    wrapper.style.minHeight = '100vh';
    wrapper.style.display = 'grid';
    wrapper.style.placeItems = 'center';
    wrapper.style.padding = '2rem';

    const card = targetWindow.document.createElement('div');
    card.style.maxWidth = '28rem';
    card.style.width = '100%';
    card.style.padding = '1.4rem';
    card.style.borderRadius = '1.2rem';
    card.style.background = '#ffffff';
    card.style.boxShadow = '0 18px 44px rgba(15, 45, 37, 0.14)';
    card.style.border = '1px solid rgba(184, 204, 196, 0.72)';

    const title = targetWindow.document.createElement('strong');
    title.textContent = 'Opening document';
    title.style.display = 'block';
    title.style.fontSize = '1rem';

    const description = targetWindow.document.createElement('p');
    description.textContent = fileName || 'Preparing saved file...';
    description.style.margin = '0.45rem 0 0';
    description.style.color = '#60736e';
    description.style.fontSize = '0.92rem';

    card.append(title, description);
    wrapper.append(card);
    targetWindow.document.body.append(wrapper);
  } catch {
    // The browser may block writing to the tab. The document still opens once the blob URL is ready.
  }
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function toDisplayText(value: unknown): string {
  if (value === null || typeof value === 'undefined') return '';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'number') return Number.isFinite(value) ? value.toLocaleString('en-ZA') : '';
  if (typeof value === 'string') return value.trim();
  if (Array.isArray(value)) return value.map(toDisplayText).filter(Boolean).join(', ');

  if (isPlainRecord(value)) {
    return toDisplayText(value.label ?? value.name ?? value.value ?? value.title ?? '');
  }

  return '';
}

function formatSpecKey(value: string): string {
  return value
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (match) => match.toUpperCase());
}

const HIDDEN_BASIC_SPEC_KEYS = new Set([
  'year',
  'year model',
  'year model unknown',
  'condition',
  'brand',
  'brand slug',
  'family key',
  'sector key',
  'typed model name',
  'normalized typed model name',
  'usage amount',
  'life worked percent',
  'hours',
  'engine hours',
  'asset flagged',
  'asset flag',
  'asset flagged at',
  'asset flag updated at',
  'flagged',
  'valuation needs update',
  'valuation stale since',
  'valuation stale reason',
  'valuation stale reasons',
  'valuation last updated at',
  'valuation last run id',
  'valuation last value ex vat',
  'valuation last hours',
  'valuation last life worked percent',
  'valuation last condition',
]);

function buildBasicSpecParts(asset: RegisterAsset): string[] {
  const directParts = [
    asset.tractorType ? formatTractorType(asset.tractorType) : '',
    asset.drive ? formatDrive(asset.drive) : '',
    asset.cab ? formatCab(asset.cab) : '',
    asset.powerKw !== null && typeof asset.powerKw !== 'undefined' && asset.powerKw > 0 ? `${asset.powerKw} kW` : '',
  ].filter(Boolean);

  const specsJson = isPlainRecord(asset.specsJson) ? asset.specsJson : {};
  const specParts = Object.entries(specsJson)
    .map(([key, value]) => {
      const label = formatSpecKey(key);
      const normalizedLabel = label.toLowerCase();
      const displayValue = toDisplayText(value);

      if (!label || !displayValue || HIDDEN_BASIC_SPEC_KEYS.has(normalizedLabel)) {
        return '';
      }

      return `${label}: ${displayValue}`;
    })
    .filter(Boolean)
    .slice(0, 4);

  return [...directParts, ...specParts];
}

function isTractorAsset(asset: RegisterAsset): boolean {
  return asset.kind === 'tractor' || Boolean(asset.tractorType || asset.drive || asset.cab);
}

function isValuedEquipmentAsset(asset: RegisterAsset): boolean {
  return asset.kind !== 'property' && Boolean(asset.valuationRunId !== null || asset.brandName || asset.modelName || asset.selectedMethod !== 'manual');
}

function isAim4priceValuedAsset(asset: RegisterAsset): boolean {
  return Boolean(asset.valuationRunId !== null || asset.selectedMethod === 'aim4price' || asset.aim4priceValueExVat !== null);
}

function isMarketplaceEligible(asset: RegisterAsset): boolean {
  return asset.kind !== 'property' && asset.value > 0;
}

function isPropertyLikeAsset(asset: Pick<RegisterAsset, 'kind'> | null | undefined): boolean {
  return asset?.kind === 'property';
}

function canDownloadAssetFuelReport(asset: RegisterAsset | null | undefined): boolean {
  return !isPropertyLikeAsset(asset);
}

function canDownloadAssetDepreciationReport(asset: RegisterAsset | null | undefined): boolean {
  return !isPropertyLikeAsset(asset);
}

function isLiveOnMarketplace(asset: RegisterAsset): boolean {
  return String(asset.marketplaceStatus ?? 'draft').toLowerCase() === 'live';
}

function filterAssetsByRegisterFilter(assetList: RegisterAsset[], assetFilter: AssetFilterKey): RegisterAsset[] {
  switch (assetFilter) {
    case 'property':
      return assetList.filter((asset) => asset.kind === 'property');
    case 'no-property':
      return assetList.filter((asset) => asset.kind !== 'property');
    case 'insured':
      return assetList.filter((asset) => readInsuranceStatusChoice(asset) === 'yes');
    case 'not-insured':
      return assetList.filter((asset) => readInsuranceStatusChoice(asset) === 'no');
    case 'financed':
      return assetList.filter((asset) => readFinanceStatusChoice(asset) === 'yes');
    case 'not-financed':
      return assetList.filter((asset) => readFinanceStatusChoice(asset) === 'no');
    case 'licensed':
      return assetList.filter((asset) => readLicenseStatusChoice(asset) === 'yes');
    case 'not-licensed':
      return assetList.filter((asset) => readLicenseStatusChoice(asset) === 'no');
    case 'license-not-applicable':
      return assetList.filter((asset) => readLicenseStatusChoice(asset) === 'not_applicable');
    case 'mapped':
      return assetList.filter((asset) => hasAssetMapCoordinates(asset));
    case 'not-mapped':
      return assetList.filter((asset) => !hasAssetMapCoordinates(asset));
    case 'aim4price-value':
      return assetList.filter((asset) => isAim4priceValuedAsset(asset));
    case 'manual-value':
      return assetList.filter((asset) => asset.selectedMethod === 'manual');
    case 'marketplace':
      return assetList.filter((asset) => isLiveOnMarketplace(asset));
    case 'highest-value':
    case 'lowest-value':
    case 'highest-replacement-price':
    case 'lowest-replacement-price':
    case 'all':
    default:
      return assetList;
  }
}

function readBooleanFromSpecs(specs: Record<string, unknown>, keys: string[]): boolean {
  for (const key of keys) {
    const value = specs[key];

    if (typeof value === 'boolean') return value;
    if (typeof value === 'number') return value === 1;
    if (typeof value === 'string') {
      const normalized = value.trim().toLowerCase();
      if (normalized === 'true' || normalized === '1' || normalized === 'yes') return true;
      if (normalized === 'false' || normalized === '0' || normalized === 'no') return false;
    }
  }

  return false;
}

function canAssetReceiveFuel(asset: Pick<RegisterAsset, 'kind' | 'specsJson'>): boolean {
  if (asset.kind === 'tractor' || asset.kind === 'vehicle') return true;

  const specs = isPlainRecord(asset.specsJson) ? asset.specsJson : {};
  return readBooleanFromSpecs(specs, [
    'is_propelled',
    'isPropelled',
    'self_propelled',
    'selfPropelled',
    'accepts_fuel',
    'acceptsFuel',
  ]);
}

function buildAssetRegisterManageReturnPath(assetId: string, currentLocation = '/asset-register'): string {
  const currentUrl = new URL(currentLocation, 'https://aim4price.local');
  const params = new URLSearchParams(currentUrl.search);
  params.delete('convertedAssetId');
  params.delete('focusAssetId');
  params.delete('action');
  params.delete('assetAction');
  params.set('assetId', assetId);
  params.set('mapAction', 'manage');
  return `${currentUrl.pathname}?${params.toString()}`;
}

function buildOwnerAssetPageHref(
  pathname: '/my-invoices' | '/fuel' | '/maintenance' | '/documents',
  assetId: string,
  options: { add?: boolean } = {},
  currentLocation = '/asset-register',
): string {
  const params = new URLSearchParams({ assetId });
  if (options.add) params.set('add', '1');
  params.set('returnTo', buildAssetRegisterManageReturnPath(assetId, currentLocation));
  return `${pathname}?${params.toString()}`;
}

function isValuationUpdateAvailable(asset: RegisterAsset): boolean {
  return Boolean(asset.valuationRunId !== null && asset.selectedMethod !== 'manual');
}

function doesEstimateNeedUpdate(asset: RegisterAsset): boolean {
  return readBooleanFromSpecs(asset.specsJson ?? {}, ['valuationNeedsUpdate', 'valuation_needs_update']);
}

function isAssetFlagged(asset: RegisterAsset): boolean {
  return readBooleanFromSpecs(asset.specsJson ?? {}, ['assetFlagged', 'asset_flagged', 'flagged']);
}

function buildAssetFlagSpecs(
  specs: Record<string, unknown>,
  isFlagged: boolean,
  timestampIso = new Date().toISOString(),
): Record<string, unknown> {
  const nextSpecs = { ...specs };

  nextSpecs.assetFlagged = isFlagged;
  nextSpecs.asset_flagged = isFlagged;
  nextSpecs.flagged = isFlagged;

  if (isFlagged) {
    nextSpecs.assetFlaggedAt = timestampIso;
    nextSpecs.asset_flagged_at = timestampIso;
    nextSpecs.assetFlagUpdatedAt = timestampIso;
    nextSpecs.asset_flag_updated_at = timestampIso;
  } else {
    delete nextSpecs.assetFlaggedAt;
    delete nextSpecs.asset_flagged_at;
    delete nextSpecs.assetFlagUpdatedAt;
    delete nextSpecs.asset_flag_updated_at;
  }

  return nextSpecs;
}

function withAssetFlagState(asset: RegisterAsset, isFlagged: boolean, timestampIso = new Date().toISOString()): RegisterAsset {
  return {
    ...asset,
    specsJson: buildAssetFlagSpecs(asset.specsJson ?? {}, isFlagged, timestampIso),
  };
}

function assetFlaggedTimestamp(asset: RegisterAsset): number {
  return timestampFromSpecs(asset.specsJson ?? {}, ['assetFlaggedAt', 'asset_flagged_at', 'assetFlagUpdatedAt', 'asset_flag_updated_at']);
}

function valuationStaleReason(asset: RegisterAsset): string {
  const specs = asset.specsJson ?? {};
  const rawReasons = specs.valuation_stale_reasons ?? specs.valuationStaleReasons;

  if (Array.isArray(rawReasons)) {
    const text = rawReasons.map((entry) => String(entry ?? '').trim()).filter(Boolean).join(', ');
    if (text) return text;
  }

  return String(specs.valuation_stale_reason ?? specs.valuationStaleReason ?? 'latest asset details changed').trim() || 'latest asset details changed';
}

function timestampFromIso(value?: string | null): number {
  if (!value) return 0;

  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}

function timestampFromSpecs(specs: Record<string, unknown>, keys: string[]): number {
  for (const key of keys) {
    const value = specs[key];

    if (typeof value === 'string') {
      const timestamp = timestampFromIso(value);
      if (timestamp) return timestamp;
    }
  }

  return 0;
}

function assetNeedsEstimateAttention(asset: RegisterAsset): boolean {
  return doesEstimateNeedUpdate(asset) && isValuationUpdateAvailable(asset);
}

function openPartnerNoteAlertCount(asset: RegisterAsset): number {
  if (asset.openPartnerNote) return 1;

  const hasOpenPartnerNote = Array.isArray(asset.partnerNotes)
    ? asset.partnerNotes.some((note) => note.status !== 'noted' && !note.notedAtIso)
    : false;

  return hasOpenPartnerNote ? 1 : 0;
}

function assetUnnotedAlertCount(asset: RegisterAsset): number {
  let count = 0;

  if (assetNeedsEstimateAttention(asset)) count += 1;
  if (asset.maintenanceAlert) count += 1;
  if (asset.licenseRenewalAlert) count += 1;
  if (asset.latestMaintenanceStatus) count += 1;
  if (asset.latestIssueNoteStatus) count += 1;
  if (asset.dealerAssetCorrection) count += 1;
  count += openPartnerNoteAlertCount(asset);

  return count;
}

function assetListUnnotedAlertCount(assetList: RegisterAsset[]): number {
  return assetList.reduce((sum, asset) => sum + assetUnnotedAlertCount(asset), 0);
}

function registerSummaryUnnotedAlertCount(register: AssetRegisterSummary | null | undefined): number {
  return Math.max(0, Math.round(Number(register?.unnotedAlertCount) || 0));
}

function formatAlertBadgeCount(count: number): string {
  const normalized = Math.max(0, Math.round(Number(count) || 0));
  return normalized > 99 ? '99+' : normalized.toLocaleString('en-ZA');
}

function assetAttentionRank(asset: RegisterAsset): number {
  if (asset.dealerAssetCorrection) return 8;
  if (asset.latestIssueNoteStatus) return 7;
  if (asset.maintenanceAlert) return 6;
  if (asset.licenseRenewalAlert) return 5;
  if (isAssetFlagged(asset)) return 4;
  if (asset.openPartnerNote) return 3;
  if (asset.latestMaintenanceStatus) return 2;
  if (assetNeedsEstimateAttention(asset)) return 1;

  return 0;
}

function assetAttentionTimestamp(asset: RegisterAsset): number {
  const openPartnerNote = asset.openPartnerNote ?? null;
  const maintenanceAlert = asset.maintenanceAlert ?? null;
  const licenseRenewalAlert = asset.licenseRenewalAlert ?? null;
  const latestMaintenanceStatus = asset.latestMaintenanceStatus ?? null;
  const latestIssueNoteStatus = asset.latestIssueNoteStatus ?? null;
  const dealerAssetCorrection = asset.dealerAssetCorrection ?? null;

  if (dealerAssetCorrection) {
    return (
      timestampFromIso(dealerAssetCorrection.updatedAtIso) ||
      timestampFromIso(dealerAssetCorrection.createdAtIso) ||
      timestampFromIso(asset.updatedAtIso) ||
      timestampFromIso(asset.createdAtIso)
    );
  }

  if (latestIssueNoteStatus) {
    return (
      timestampFromIso(latestIssueNoteStatus.createdAtIso) ||
      timestampFromIso(asset.updatedAtIso) ||
      timestampFromIso(asset.createdAtIso)
    );
  }

  if (maintenanceAlert) {
    return (
      timestampFromIso(maintenanceAlert.updatedAtIso) ||
      timestampFromIso(maintenanceAlert.createdAtIso) ||
      timestampFromIso(asset.updatedAtIso) ||
      timestampFromIso(asset.createdAtIso)
    );
  }

  if (licenseRenewalAlert) {
    const renewalTimestamp = timestampFromIso(`${licenseRenewalAlert.renewalDate}T00:00:00.000Z`);
    return renewalTimestamp ? -renewalTimestamp : timestampFromIso(asset.updatedAtIso) || timestampFromIso(asset.createdAtIso);
  }

  if (isAssetFlagged(asset)) {
    return (
      assetFlaggedTimestamp(asset) ||
      timestampFromIso(asset.updatedAtIso) ||
      timestampFromIso(asset.createdAtIso)
    );
  }

  if (openPartnerNote) {
    return (
      timestampFromIso(openPartnerNote.updatedAtIso) ||
      timestampFromIso(openPartnerNote.createdAtIso) ||
      timestampFromIso(asset.updatedAtIso) ||
      timestampFromIso(asset.createdAtIso)
    );
  }

  if (latestMaintenanceStatus) {
    return (
      timestampFromIso(latestMaintenanceStatus.createdAtIso) ||
      timestampFromIso(asset.updatedAtIso) ||
      timestampFromIso(asset.createdAtIso)
    );
  }

  if (assetNeedsEstimateAttention(asset)) {
    return (
      timestampFromSpecs(asset.specsJson ?? {}, ['valuationStaleSince', 'valuation_stale_since']) ||
      timestampFromIso(asset.updatedAtIso) ||
      timestampFromIso(asset.createdAtIso)
    );
  }

  return timestampFromIso(asset.updatedAtIso) || timestampFromIso(asset.createdAtIso);
}

function compareAssetsByRegisterPriority(left: RegisterAsset, right: RegisterAsset, assetFilter: AssetFilterKey): number {
  const rankDifference = assetAttentionRank(right) - assetAttentionRank(left);
  if (rankDifference) return rankDifference;

  if (assetFilter === 'highest-value' || assetFilter === 'lowest-value') {
    const leftValue = Number(left.value || 0);
    const rightValue = Number(right.value || 0);
    const valueDifference = assetFilter === 'highest-value' ? rightValue - leftValue : leftValue - rightValue;

    if (valueDifference) return valueDifference;
  }

  if (assetFilter === 'highest-replacement-price' || assetFilter === 'lowest-replacement-price') {
    const leftValue = readAssetReplacementPriceExVat(left) ?? 0;
    const rightValue = readAssetReplacementPriceExVat(right) ?? 0;
    const valueDifference = assetFilter === 'highest-replacement-price' ? rightValue - leftValue : leftValue - rightValue;

    if (valueDifference) return valueDifference;
  }

  const attentionTimestampDifference = assetAttentionTimestamp(right) - assetAttentionTimestamp(left);
  if (attentionTimestampDifference) return attentionTimestampDifference;

  const createdTimestampDifference = timestampFromIso(right.createdAtIso) - timestampFromIso(left.createdAtIso);
  if (createdTimestampDifference) return createdTimestampDifference;

  return left.title.localeCompare(right.title, 'en-ZA') || left.id.localeCompare(right.id);
}

function sortAssetsByRegisterPriority(assetList: RegisterAsset[], assetFilter: AssetFilterKey): RegisterAsset[] {
  return [...assetList].sort((left, right) => compareAssetsByRegisterPriority(left, right, assetFilter));
}

function compareUmbrellaAssetsByAttention(left: RegisterAsset, right: RegisterAsset): number {
  const leftRank = assetAttentionRank(left);
  const rightRank = assetAttentionRank(right);
  const attentionDifference = Number(rightRank > 0) - Number(leftRank > 0);
  if (attentionDifference) return attentionDifference;
  if (!leftRank && !rightRank) return 0;

  const rankDifference = rightRank - leftRank;
  if (rankDifference) return rankDifference;

  const alertCountDifference = assetUnnotedAlertCount(right) - assetUnnotedAlertCount(left);
  if (alertCountDifference) return alertCountDifference;

  return assetAttentionTimestamp(right) - assetAttentionTimestamp(left);
}

function assetKindLabel(asset: RegisterAsset): string {
  return assetFamilyLabel(asset);
}

function normalizeAssetNoteText(value: string | null | undefined): string {
  return String(value ?? '').replace(/\r\n/g, '\n').trim();
}

function isQrOperationalAssetNote(value: string | null | undefined): boolean {
  const note = normalizeAssetNoteText(value);
  if (!note) return false;

  const compact = note.replace(/\s+/g, ' ').trim().toLowerCase();

  return (
    compact.includes('lifetime worked updated to') ||
    (/^checked\b/.test(compact) && compact.includes('checked items:')) ||
    (/^serviced\b/.test(compact) && (compact.includes('serviced items:') || compact.includes('service items:') || compact.includes('work done:'))) ||
    (/^repaired\b/.test(compact) && (compact.includes('work done:') || compact.includes('mechanic:') || compact.includes('company:')))
  );
}

function getManualAssetNote(value: string | null | undefined): string {
  const note = normalizeAssetNoteText(value);
  return isQrOperationalAssetNote(note) ? '' : note;
}

function isMotorProjectionAsset(asset: Pick<RegisterAsset, 'kind' | 'specsJson'>): boolean {
  const specs = isPlainRecord(asset.specsJson) ? asset.specsJson : {};
  const sectorKey = String(specs.sectorKey ?? specs.sector_key ?? '').trim().toLowerCase();

  return asset.kind === 'vehicle' || sectorKey === 'motor' || getAssetUsageMetric(asset) === 'km';
}

function canProjectFuturePrice(asset: RegisterAsset): boolean {
  if (asset.valuationRunId === null || asset.selectedMethod === 'manual') {
    return false;
  }

  if (assetUsesPercentUsage(asset)) {
    return (
      readAssetReplacementPriceExVat(asset) !== null &&
      getAssetLifeWorkedPercent(asset) !== null &&
      Boolean(asset.condition)
    );
  }

  if (asset.yearModel === null) {
    return false;
  }

  if (isTractorAsset(asset)) {
    return Boolean(asset.powerKw !== null && asset.tractorType);
  }

  if (isMotorProjectionAsset(asset)) {
    return readAssetReplacementPriceExVat(asset) !== null;
  }

  return false;
}

function canRefreshAssetEstimate(asset: RegisterAsset): boolean {
  return asset.valuationRunId !== null && asset.selectedMethod !== 'manual';
}

function canManageAssetPricing(asset: RegisterAsset): boolean {
  return canRefreshAssetEstimate(asset) || canProjectFuturePrice(asset);
}

const REPLACEMENT_PRICE_SPEC_KEYS = [
  'replacementPriceExVat',
  'replacement_price_ex_vat',
  'replacementPriceUsedExVat',
  'replacement_price_used_ex_vat',
  'userReplacementPriceExVat',
  'user_replacement_price_ex_vat',
  'officialReplacementPriceExVat',
  'official_replacement_price_ex_vat',
  'replacementPrice',
  'replacement_price',
] as const;

function readAssetReplacementPriceExVat(asset: Pick<RegisterAsset, 'replacementPriceExVat' | 'specsJson'>): number | null {
  const direct = Number(asset.replacementPriceExVat);
  if (Number.isFinite(direct) && direct > 0) {
    return Math.round(direct);
  }

  const specs = isPlainRecord(asset.specsJson) ? asset.specsJson : {};
  const fromSpecs = readNumberFromSpecs(specs, [...REPLACEMENT_PRICE_SPEC_KEYS]);

  return fromSpecs !== null && fromSpecs > 0 ? Math.round(fromSpecs) : null;
}

const INSURED_VALUE_SPEC_KEYS = [
  'insuredValueExVat',
  'insured_value_ex_vat',
  'insuranceValueExVat',
  'insurance_value_ex_vat',
  'insuredValue',
  'insured_value',
  'insuranceValue',
  'insurance_value',
] as const;

function readAssetInsuredValueExVat(asset: Pick<RegisterAsset, 'insuredValueExVat' | 'specsJson'>): number | null {
  const direct = Number(asset.insuredValueExVat);
  if (Number.isFinite(direct) && direct > 0) {
    return Math.round(direct);
  }

  const specs = isPlainRecord(asset.specsJson) ? asset.specsJson : {};
  const fromSpecs = readNumberFromSpecs(specs, [...INSURED_VALUE_SPEC_KEYS]);

  return fromSpecs !== null && fromSpecs > 0 ? Math.round(fromSpecs) : null;
}

const LIFETIME_USAGE_SPEC_KEYS = [
  'maxLifetimeHours',
  'max_lifetime_hours',
  'expectedLifetimeHours',
  'expected_lifetime_hours',
  'lifetimeHours',
  'lifetime_hours',
  'designLifeHours',
  'design_life_hours',
  'usefulLifeHours',
  'useful_life_hours',
  'maxLifetimeKm',
  'max_lifetime_km',
  'expectedLifetimeKm',
  'expected_lifetime_km',
  'lifetimeKm',
  'lifetime_km',
  'designLifeKm',
  'design_life_km',
  'usefulLifeKm',
  'useful_life_km',
] as const;

function readAssetMaxLifetimeUsage(asset: Pick<RegisterAsset, 'maxLifetimeHours' | 'specsJson'>): number | null {
  const direct = Number(asset.maxLifetimeHours);
  if (Number.isFinite(direct) && direct > 0) {
    return Math.round(direct);
  }

  const specs = isPlainRecord(asset.specsJson) ? asset.specsJson : {};
  const fromSpecs = readNumberFromSpecs(specs, [...LIFETIME_USAGE_SPEC_KEYS]);

  return fromSpecs !== null && fromSpecs > 0 ? Math.round(fromSpecs) : null;
}

function shouldShowRevalueLifetimeInput(asset: RegisterAsset): boolean {
  return !assetUsesPercentUsage(asset);
}

function getLifetimeUnitLabel(metric: UsageMetric): string {
  return metric === 'km' ? 'kilometres' : 'hours';
}

function getLifetimeShortUnit(metric: UsageMetric): string {
  return metric === 'km' ? 'km' : 'hours';
}

function formatPlainNumber(value: number | null | undefined): string {
  if (value === null || typeof value === 'undefined' || !Number.isFinite(value)) return 'N/A';
  return Math.round(value).toLocaleString('en-ZA');
}

function sumAssetReplacementValues(assetList: Array<Pick<RegisterAsset, 'replacementPriceExVat' | 'specsJson'>>): number {
  return assetList.reduce((sum, asset) => sum + (readAssetReplacementPriceExVat(asset) ?? 0), 0);
}

function countAssetsWithReplacementPrice(assetList: Array<Pick<RegisterAsset, 'replacementPriceExVat' | 'specsJson'>>): number {
  return assetList.filter((asset) => readAssetReplacementPriceExVat(asset) !== null).length;
}

function sumAssetInsuredValues(assetList: Array<Pick<RegisterAsset, 'insuredValueExVat' | 'specsJson'>>): number {
  return assetList.reduce((sum, asset) => sum + (readAssetInsuredValueExVat(asset) ?? 0), 0);
}

function buildDraftFromAsset(asset: RegisterAsset): AssetDraft {
  const financeStatus = readFinanceStatusChoice(asset);
  const insuredValueExVat = readAssetInsuredValueExVat(asset);
  const insuranceStatus = readInsuranceStatusChoice(asset);
  const licenseStatus = readLicenseStatusChoice(asset);
  const insuranceNote = readInsuranceNote(asset);
  const initialModelValue = asset.modelName || asset.typedModelName || '';
  const derivedBrandName = deriveAssetReportBrandName(asset, initialModelValue);
  const derivedModelName = deriveAssetReportModelName(asset, derivedBrandName);
  const specs = isPlainRecord(asset.specsJson) ? asset.specsJson : {};

  return {
    kind: normalizeDraftKind(asset.kind),
    generalAssetCategory: normalizeGeneralAssetCategory(specs.generalAssetCategory ?? specs.general_asset_category),
    propertyAssetSubtype: normalizePropertyAssetSubtype(specs.propertyAssetSubtype ?? specs.property_asset_subtype),
    propertyInterest: normalizePropertyInterest(specs.propertyInterest ?? specs.property_interest),
    stockAssetSubtype: normalizeStockAssetSubtype(specs.stockAssetSubtype ?? specs.stock_asset_subtype),
    stockValuationBasis: normalizeStockValuationBasis(specs.stockValuationBasis ?? specs.stock_valuation_basis),
    stockMovement: normalizeStockMovement(specs.stockMovement ?? specs.stock_movement),
    stockPeakValue: formatRegisterValueInput(
      readNumberFromSpecs(specs, ['stockPeakValueExVat', 'stock_peak_value_ex_vat']) ?? '',
    ),
    insuranceUseContext: normalizeInsuranceUseContext(specs.insuranceUseContext ?? specs.insurance_use_context),
    insuranceMobility: normalizeInsuranceMobility(specs.insuranceMobility ?? specs.insurance_mobility),
    insuranceCriticalToOperations: normalizeInsuranceFactAnswer(
      specs.insuranceCriticalToOperations ?? specs.insurance_critical_to_operations,
    ),
    insuranceTemperatureSensitiveStock: normalizeInsuranceFactAnswer(
      specs.insuranceTemperatureSensitiveStock ?? specs.insurance_temperature_sensitive_stock,
    ),
    title: asset.title,
    value: formatRegisterValueInput(asset.value || ''),
    replacementPrice: formatRegisterValueInput(readAssetReplacementPriceExVat(asset) ?? ''),
    insuredValue: insuredValueExVat === null ? '' : formatRegisterValueInput(insuredValueExVat),
    note: getManualAssetNote(asset.note),
    serialNumber: asset.serialNumber,
    brandName: derivedBrandName === '—' ? '' : derivedBrandName,
    modelName: derivedModelName === '—' ? '' : derivedModelName,
    isFinanced: financeStatus === 'yes',
    isInsured: insuranceStatus === 'yes',
    isLicensed: licenseStatus === 'yes',
    financeStatus,
    insuranceStatus,
    licenseStatus,
    licenseRegistrationNumber: licenseStatus === 'yes' ? readLicenseRegistrationNumber(asset) : '',
    financeNote: ['yes', 'paid'].includes(financeStatus) ? asset.financeNote : '',
    insuranceNote: insuranceStatus === 'yes' ? insuranceNote : '',
    photos: normalizePhotos(asset.photos),
    documents: assetDocuments(asset),
    yearModel: asset.yearModel === null || typeof asset.yearModel === 'undefined' ? '' : String(asset.yearModel),
    propertySize: asset.kind === 'property' ? readAssetPropertySize(asset) : '',
    hours: asset.kind === 'property' || assetUsesPercentUsage(asset) || assetUsesNotApplicableUsage(asset) || asset.hours === null || typeof asset.hours === 'undefined' ? '' : formatUsageAmountInput(asset.hours),
    usageMetric: assetUsesNotApplicableUsage(asset) ? 'not_applicable' : assetUsesPercentUsage(asset) ? 'percentage' : asset.kind === 'vehicle' ? 'km' : getAssetUsageMetric(asset),
    lifeWorkedPercent: !assetUsesPercentUsage(asset) || getAssetLifeWorkedPercent(asset) === null ? '' : String(getAssetLifeWorkedPercent(asset)),
    condition: asset.condition,
  };
}

function buildSavedItemFromAsset(asset: RegisterAsset) {
  return {
    id: asset.id,
    valuationRunId: asset.valuationRunId ?? undefined,
    kind: normalizeDraftKind(asset.kind),
    title: asset.title,
    value: asset.value,
    selectedMethod: asset.selectedMethod,
    method: asset.selectedMethod,
    selectedValueExVat: asset.selectedValueExVat,
    replacementPriceExVat: readAssetReplacementPriceExVat(asset),
    brandName: asset.brandName || undefined,
    modelName: asset.modelName || undefined,
    drive: asset.drive || undefined,
    tractorType: asset.tractorType || undefined,
    cab: asset.cab || undefined,
    powerKw: asset.powerKw ?? undefined,
    yearModel: asset.yearModel ?? undefined,
    hours: asset.hours ?? undefined,
    aim4priceValueExVat: asset.aim4priceValueExVat,
    note: getManualAssetNote(asset.note) || undefined,
    createdAtIso: asset.createdAtIso,
    updatedAtIso: asset.updatedAtIso,
    serialNumber: asset.serialNumber || undefined,
    isFinanced: asset.isFinanced,
    isInsured: readInsuranceStatusChoice(asset) === 'yes',
    isLicensed: asset.isLicensed,
    licenseRegistrationNumber: readLicenseRegistrationNumber(asset) || undefined,
    financeNote: asset.financeNote || undefined,
    photos: asset.photos,
    documents: assetDocuments(asset),
  };
}

function createMarketplaceDraft(asset: RegisterAsset, profile: AccountProfile | null): MarketplacePublishDraft {
  const savedMarketplacePrice =
    typeof asset.marketplacePriceExVat === 'number' && Number.isFinite(asset.marketplacePriceExVat) && asset.marketplacePriceExVat > 0
      ? asset.marketplacePriceExVat
      : asset.value;
  const savedListingNotes = asset.marketplaceNotes?.trim() || getManualAssetNote(asset.note);

  return {
    sellerName:
      asset.marketplaceSellerName?.trim() ||
      profile?.marketplaceSellerName?.trim() ||
      profile?.name?.trim() ||
      profile?.businessName?.trim() ||
      'Aim4price seller',
    sellerCompany: asset.marketplaceSellerCompany?.trim() || profile?.businessName?.trim() || '',
    sellerPhone: asset.sellerPhone?.trim() || profile?.marketplacePhone?.trim() || profile?.phone?.trim() || '',
    sellerEmail: asset.marketplaceSellerEmail?.trim() || profile?.marketplaceEmail?.trim() || '',
    province: asset.marketplaceProvince?.trim() || profile?.province?.trim() || '',
    area: asset.marketplaceArea?.trim() || profile?.marketplaceLocation?.trim() || profile?.townCity?.trim() || '',
    askingPriceExVat: savedMarketplacePrice > 0 ? formatRegisterValueInput(savedMarketplacePrice) : '',
    description: savedListingNotes,
  };
}

function assetPhotos(asset: RegisterAsset): string[] {
  const photos = normalizePhotos(asset.photos);
  return photos.length ? photos : [FALLBACK_ASSET_IMAGE];
}

function assetImage(asset: RegisterAsset): string {
  return assetPhotos(asset)[0] || FALLBACK_ASSET_IMAGE;
}

function assetPreviewImage(asset: RegisterAsset): string | null {
  const photos = normalizePhotos(asset.photos);
  return photos.length ? photos[0] : null;
}

function assetSectorLabel(asset: RegisterAsset): string {
  if (asset.kind === 'stock') return 'Stock';
  if (asset.kind === 'manual') {
    const specs = isPlainRecord(asset.specsJson) ? asset.specsJson : {};
    return generalAssetCategoryLabel(specs.generalAssetCategory ?? specs.general_asset_category) || 'Everyday asset';
  }
  if (isTractorAsset(asset) || isValuedEquipmentAsset(asset)) return 'Agricultural';
  if (asset.kind === 'property') return PROPERTY_ASSET_LABEL;
  if (asset.kind === 'vehicle') return 'Vehicle';
  if (asset.kind === 'tools') return 'Tools';
  return 'Other';
}

function assetFamilyLabel(asset: RegisterAsset): string {
  const specs = isPlainRecord(asset.specsJson) ? asset.specsJson : {};
  if (asset.equipmentFamilyLabel) return asset.equipmentFamilyLabel;
  if (isTractorAsset(asset)) return 'Tractor';
  if (asset.kind === 'equipment') return 'Equipment';
  if (asset.kind === 'property') {
    return propertyAssetSubtypeLabel(specs.propertyAssetSubtype ?? specs.property_asset_subtype) || PROPERTY_ASSET_LABEL;
  }
  if (asset.kind === 'vehicle') return 'Vehicle';
  if (asset.kind === 'tools') return 'Tools';
  if (asset.kind === 'stock') {
    return stockAssetSubtypeLabel(specs.stockAssetSubtype ?? specs.stock_asset_subtype) || 'Stock';
  }
  if (asset.kind === 'manual') {
    return generalAssetCategoryLabel(specs.generalAssetCategory ?? specs.general_asset_category) || 'Everyday asset';
  }
  if (isValuedEquipmentAsset(asset)) return 'Valued equipment';
  return 'Other';
}


function cleanReportText(value: unknown): string {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function isMeaningfulReportValue(value: string): boolean {
  const normalized = cleanReportText(value).toLowerCase();
  return Boolean(normalized && normalized !== '-' && normalized !== '—' && normalized !== 'unknown' && normalized !== 'n/a');
}

function readTextFromSpecs(specs: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const direct = cleanReportText(specs[key]);
    if (isMeaningfulReportValue(direct)) return direct;
  }

  return '';
}

function readAssetPropertySize(asset: Pick<RegisterAsset, 'specsJson'>): string {
  const specs = isPlainRecord(asset.specsJson) ? asset.specsJson : {};
  return readTextFromSpecs(specs, [...PROPERTY_SIZE_SPEC_KEYS]);
}

function propertySizeDisplay(asset: Pick<RegisterAsset, 'specsJson'>): string {
  return readAssetPropertySize(asset) || '—';
}

function removeFirstCaseInsensitive(source: string, part: string): string {
  const text = cleanReportText(source);
  const needle = cleanReportText(part);
  if (!text || !needle) return text;

  const index = text.toLowerCase().indexOf(needle.toLowerCase());
  if (index < 0) return text;

  return cleanReportText(`${text.slice(0, index)} ${text.slice(index + needle.length)}`);
}

function removeTrailingFamilyWords(value: string, familyLabel: string): string {
  let cleaned = cleanReportText(value);
  const familyWords = cleanReportText(familyLabel)
    .split(/[^a-zA-Z0-9]+/)
    .map((word) => word.trim())
    .filter((word) => word.length > 3);

  for (const word of familyWords) {
    const variants = [word, word.endsWith('s') ? word.slice(0, -1) : `${word}s`].filter(Boolean);
    for (const variant of variants) {
      const pattern = new RegExp(`\\s+${variant.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&')}$`, 'i');
      cleaned = cleanReportText(cleaned.replace(pattern, ''));
    }
  }

  return cleaned;
}

function deriveAssetReportModelName(asset: RegisterAsset, reportBrandName = ''): string {
  const directModel = cleanReportText(asset.modelName) || cleanReportText(asset.typedModelName);
  if (isMeaningfulReportValue(directModel)) return directModel;

  const fromSpecs = readTextFromSpecs(asset.specsJson ?? {}, [
    'modelName',
    'model_name',
    'typedModelName',
    'typed_model_name',
    'model',
  ]);
  if (fromSpecs) return fromSpecs;

  const titleWithoutBrand = removeFirstCaseInsensitive(asset.title, reportBrandName);
  const fallback = removeTrailingFamilyWords(titleWithoutBrand, assetFamilyLabel(asset));
  return isMeaningfulReportValue(fallback) ? fallback : '—';
}

function deriveAssetReportBrandName(asset: RegisterAsset, reportModelName = ''): string {
  const directBrand = cleanReportText(asset.brandName);
  if (isMeaningfulReportValue(directBrand)) return directBrand;

  const fromSpecs = readTextFromSpecs(asset.specsJson ?? {}, [
    'brandName',
    'brand_name',
    'brand',
    'make',
    'makeName',
    'make_name',
    'manufacturer',
    'manufacturerName',
    'manufacturer_name',
  ]);
  if (fromSpecs) return fromSpecs;

  const modelCandidates = [reportModelName, asset.modelName, asset.typedModelName]
    .map(cleanReportText)
    .filter(isMeaningfulReportValue)
    .sort((a, b) => b.length - a.length);

  let inferred = cleanReportText(asset.title);
  for (const model of modelCandidates) {
    inferred = removeFirstCaseInsensitive(inferred, model);
  }
  inferred = removeTrailingFamilyWords(inferred, assetFamilyLabel(asset));

  return isMeaningfulReportValue(inferred) ? inferred : '—';
}

function readNumberFromSpecs(specs: Record<string, unknown>, keys: string[]): number | null {
  for (const key of keys) {
    const value = specs[key];
    if (value === null || typeof value === 'undefined' || value === '') {
      continue;
    }

    const numeric = Number(value);
    if (Number.isFinite(numeric)) {
      return numeric;
    }
  }

  return null;
}

function getAssetLifeWorkedPercent(asset: RegisterAsset): number | null {
  if (asset.lifeWorkedPercent !== null && typeof asset.lifeWorkedPercent !== 'undefined') {
    const direct = Number(asset.lifeWorkedPercent);
    if (Number.isFinite(direct)) {
      return Math.min(100, Math.max(0, direct));
    }
  }

  const fromSpecs = readNumberFromSpecs(asset.specsJson, [
    'life_worked_percent',
    'worked_percent',
    'lifetime_worked_percent',
    'percent_worked',
    'lifetime_used_percent',
  ]);

  return fromSpecs === null ? null : Math.min(100, Math.max(0, fromSpecs));
}

const LIFE_WORKED_PERCENT_DECREASE_TOLERANCE = 0.05;

function getAssetSavedUsageReading(asset: RegisterAsset | null | undefined): number | null {
  if (!asset || asset.hours === null || typeof asset.hours === 'undefined') return null;

  const savedUsage = Number(asset.hours);
  return Number.isFinite(savedUsage) && savedUsage >= 0 ? Math.round(savedUsage) : null;
}

function isLifeWorkedPercentDecrease(nextValue: number, savedValue: number): boolean {
  return nextValue < savedValue - LIFE_WORKED_PERCENT_DECREASE_TOLERANCE;
}

function resolveLifeWorkedPercentForSave(nextValue: number | null, savedValue: number | null): number | null {
  if (nextValue === null) {
    return savedValue;
  }

  const roundedNextValue = Math.round(nextValue * 10) / 10;

  if (savedValue !== null && roundedNextValue < savedValue && !isLifeWorkedPercentDecrease(roundedNextValue, savedValue)) {
    return savedValue;
  }

  return roundedNextValue;
}

function formatUsagePercent(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  const formatted = Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
  return `${formatted}%`;
}

function buildAssetUsageValue(asset: RegisterAsset): string {
  if (asset.kind === 'property') {
    return '—';
  }

  const percent = getAssetLifeWorkedPercent(asset);
  const hours = Number(asset.hours);
  const hasHours = Number.isFinite(hours) && hours > 0;
  const usageMetric = getAssetUsageMetric(asset);
  const depreciationMethod = String(asset.depreciationMethodUsed ?? '').trim().toLowerCase();
  const usesPercentDepreciation =
    depreciationMethod === 'semi_depreciation' ||
    depreciationMethod === 'percentage_depreciation' ||
    assetUsesPercentUsage(asset);

  if (asset.kind === 'vehicle') {
    return hasHours ? `${Math.round(hours).toLocaleString('en-ZA')} km` : '—';
  }

  if (percent !== null && (usesPercentDepreciation || !hasHours)) {
    return formatUsagePercent(percent);
  }

  if (hasHours) {
    return `${Math.round(hours).toLocaleString('en-ZA')} ${usageMetricLabel(usageMetric)}`;
  }

  if (percent !== null) {
    return formatUsagePercent(percent);
  }

  return '—';
}

function buildAssetUsageMeta(asset: RegisterAsset): string {
  const usageValue = buildAssetUsageValue(asset);
  return usageValue === '—' ? '' : `Usage: ${usageValue}`;
}

function buildAssetMeta(asset: RegisterAsset): string {
  const propertySize = asset.kind === 'property' ? readAssetPropertySize(asset) : '';
  const parts = [
    asset.yearModel ? `${assetYearLabel(asset)}: ${asset.yearModel}` : '',
    asset.kind === 'property' ? (propertySize ? `Size: ${propertySize}` : '') : buildAssetUsageMeta(asset),
    asset.condition ? `Condition: ${conditionLabel(asset.condition)}` : '',
  ].filter(Boolean);

  return parts.join(' • ') || 'No key details saved yet';
}

function buildMarketplaceListingTitle(asset: RegisterAsset, includeMissingDetails = false): string {
  const baseTitle =
    String(asset.title ?? '').trim() ||
    [asset.brandName, asset.modelName].map((part) => part.trim()).filter(Boolean).join(' ') ||
    'Marketplace listing';
  const usageValue = buildAssetUsageValue(asset);
  const titleDetails = [
    asset.yearModel ? String(asset.yearModel) : includeMissingDetails ? 'Year not set' : '',
    usageValue !== '—' ? usageValue : includeMissingDetails ? 'Usage not set' : '',
    asset.condition ? conditionLabel(asset.condition) : includeMissingDetails ? 'Condition not set' : '',
  ].filter(Boolean);

  return titleDetails.length ? `${baseTitle} · ${titleDetails.join(' · ')}` : baseTitle;
}

function normalizeRegisterSearchText(value: unknown): string {
  return String(value ?? '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function normalizeCompactSearchText(value: unknown): string {
  return normalizeRegisterSearchText(value).replace(/\s+/g, '');
}

function buildSearchableText(asset: RegisterAsset): string {
  const propertySize = asset.kind === 'property' ? readAssetPropertySize(asset) : '';
  const searchParts = [
    asset.title,
    asset.brandName,
    asset.modelName,
    asset.typedModelName,
    asset.equipmentFamilyLabel,
    asset.equipmentFamilyKey,
    asset.serialNumber,
    asset.note,
    getManualAssetNote(asset.note),
    asset.financeNote,
    readInsuranceNote(asset),
    readLicenseRegistrationNumber(asset),
    statusChoiceReportLabel(readFinanceStatusChoice(asset)),
    statusChoiceReportLabel(readInsuranceStatusChoice(asset)),
    statusChoiceReportLabel(readLicenseStatusChoice(asset)),
    ...assetDocuments(asset).map((document) => document.fileName),
    assetDocuments(asset).length ? 'documents paperwork invoice natis papers' : '',
    readInsuranceStatusChoice(asset) === 'yes'
      ? 'insured insurance'
      : readInsuranceStatusChoice(asset) === 'no'
        ? 'not insured no insurance'
        : readInsuranceStatusChoice(asset) === 'not_applicable'
          ? 'not applicable n/a insurance'
          : 'not sure unknown insurance',
    readFinanceStatusChoice(asset) === 'yes' ? 'financed finance' : readFinanceStatusChoice(asset) === 'no' ? 'not financed no finance' : '',
    readLicenseStatusChoice(asset) === 'yes' ? 'licensed licence license registered' : readLicenseStatusChoice(asset) === 'no' ? 'not licensed no licence no license' : readLicenseStatusChoice(asset) === 'not_applicable' ? 'not applicable n/a licence license' : '',
    asset.tractorType,
    asset.drive,
    asset.cab,
    asset.yearModel ? String(asset.yearModel) : '',
    propertySize,
    asset.hours !== null && typeof asset.hours !== 'undefined' ? String(asset.hours) : '',
    readAssetReplacementPriceExVat(asset) !== null ? String(readAssetReplacementPriceExVat(asset)) : '',
    readAssetReplacementPriceExVat(asset) !== null ? `replacement price replacement value ${money(readAssetReplacementPriceExVat(asset) ?? 0)}` : 'replacement price not set',
    getAssetUsageMetric(asset),
    asset.lifeWorkedPercent !== null && typeof asset.lifeWorkedPercent !== 'undefined' ? String(asset.lifeWorkedPercent) : '',
    buildAssetUsageMeta(asset),
    conditionLabel(asset.condition),
    kindLabel(asset.kind),
    methodLabel(asset.selectedMethod),
  ]
    .filter(Boolean)
    .join(' ');
  const normalized = normalizeRegisterSearchText(searchParts);
  const compactSerial = normalizeCompactSearchText(asset.serialNumber);
  const compactSearchParts = [compactSerial].filter(Boolean).join(' ');

  return [normalized, compactSearchParts].filter(Boolean).join(' ');
}

function buildExportDetail(asset: RegisterAsset): string {
  const parts = [
    buildAssetMeta(asset),
    asset.kind !== 'property' && asset.serialNumber ? `Serial: ${asset.serialNumber}` : '',
    `Insurance: ${statusChoiceReportLabel(readInsuranceStatusChoice(asset))}`,
    `Finance: ${statusChoiceReportLabel(readFinanceStatusChoice(asset))}`,
    asset.kind !== 'property' ? `License: ${statusChoiceReportLabel(readLicenseStatusChoice(asset))}` : '',
    asset.kind !== 'property' && readLicenseRegistrationNumber(asset) ? `Registration: ${readLicenseRegistrationNumber(asset)}` : '',
    readAssetReplacementPriceExVat(asset) !== null ? `Replacement: ${money(readAssetReplacementPriceExVat(asset) ?? 0)}` : 'Replacement: Not set',
    assetDocuments(asset).length ? `Documents: ${assetDocuments(asset).length}` : '',
  ].filter(Boolean);

  return parts.join(' • ');
}

function createRegisterSummaryCountValue(): RegisterSummaryCountValue {
  return { count: 0, valueExVat: 0 };
}

function createRegisterSummaryAssetTypes(): Record<RegisterSummaryAssetTypeKey, RegisterSummaryCountValue> {
  return {
    property: createRegisterSummaryCountValue(),
    equipment: createRegisterSummaryCountValue(),
    tools: createRegisterSummaryCountValue(),
    stock: createRegisterSummaryCountValue(),
    vehicles: createRegisterSummaryCountValue(),
  };
}

function addToRegisterSummaryCountValue(stats: RegisterSummaryCountValue, valueExVat: number): void {
  stats.count += 1;
  stats.valueExVat += valueExVat;
}

function summaryValueInclVat(valueExVat: number): number {
  return Math.round(valueExVat * ASSET_REGISTER_SUMMARY_VAT_MULTIPLIER);
}

function registerAssetDedupeKey(asset: RegisterAsset, index: number): string {
  const id = String(asset.id ?? '').trim();
  if (id) return `id:${id}`;

  const publicAssetCode = String(asset.publicAssetCode ?? '').trim();
  if (publicAssetCode) return `code:${publicAssetCode}`;

  const fallback = [
    asset.title,
    asset.serialNumber,
    asset.createdAtIso,
    asset.updatedAtIso,
    asset.value,
  ]
    .map((part) => String(part ?? '').trim().toLowerCase())
    .filter(Boolean)
    .join('|');

  return fallback ? `asset:${fallback}` : `index:${index}`;
}

function dedupeRegisterAssets(assets: RegisterAsset[]): RegisterAsset[] {
  const seen = new Set<string>();
  const uniqueAssets: RegisterAsset[] = [];

  assets.forEach((asset, index) => {
    const key = registerAssetDedupeKey(asset, index);
    if (seen.has(key)) return;

    seen.add(key);
    uniqueAssets.push(asset);
  });

  return uniqueAssets;
}

function hasAssetMapCoordinates(asset: Pick<RegisterAsset, 'lastKnownLat' | 'lastKnownLng'>): boolean {
  const latitude = Number(asset.lastKnownLat);
  const longitude = Number(asset.lastKnownLng);

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return false;
  if (Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return false;
  if (latitude === 0 && longitude === 0) return false;

  return true;
}

function getRegisterSummaryAssetType(asset: RegisterAsset): RegisterSummaryAssetTypeKey {
  if (asset.kind === 'property') return 'property';
  if (asset.kind === 'tools') return 'tools';
  if (asset.kind === 'stock') return 'stock';
  if (asset.kind === 'vehicle') return 'vehicles';

  const specs = isPlainRecord(asset.specsJson) ? asset.specsJson : {};
  const searchableText = normalizeRegisterSearchText(
    [
      asset.kind,
      asset.equipmentFamilyKey,
      asset.equipmentFamilyLabel,
      asset.typedModelName,
      asset.normalizedTypedModelName,
      asset.brandName,
      asset.modelName,
      specs.assetType,
      specs.asset_type,
      specs.category,
      specs.assetCategory,
      specs.asset_category,
      specs.sector,
      specs.sectorKey,
      specs.sector_key,
      specs.equipmentType,
      specs.equipment_type,
      specs.vehicleType,
      specs.vehicle_type,
    ]
      .map((part) => String(part ?? ''))
      .filter(Boolean)
      .join(' '),
  );
  const textWithSpaces = ` ${searchableText} `;
  const vehicleTokens = [
    'vehicle',
    'motor',
    'car',
    'cars',
    'bakkie',
    'bakkies',
    'ldv',
    'truck',
    'trucks',
    'trailer',
    'trailers',
    'bus',
    'buses',
    'motorcycle',
    'motorcycles',
    'quad',
    'quads',
    'atv',
    'utv',
    'sxs',
    'side by side',
    'suv',
    'sedan',
    'hatch',
    'hatchback',
    'van',
    'taxi',
  ];

  if (vehicleTokens.some((token) => textWithSpaces.includes(` ${normalizeRegisterSearchText(token)} `))) {
    return 'vehicles';
  }

  return 'equipment';
}

function buildRegisterBasicSummary(assets: RegisterAsset[], groups: AssetGroup[] = []): RegisterBasicSummary {
  const uniqueAssets = dedupeRegisterAssets(assets);
  const memberships = buildAssetGroupMembershipMap(groups);
  const assetTypes = createRegisterSummaryAssetTypes();
  const aim4priceAssets = createRegisterSummaryCountValue();
  const manualAssets = createRegisterSummaryCountValue();
  let currentValueExVat = 0;
  let replacementValueExVat = 0;
  let replacementPricedAssets = 0;
  let insuredValueExVat = 0;
  let insuredAssetsValueExVat = 0;
  let financedValueExVat = 0;
  let licensedValueExVat = 0;
  let assetsInsured = 0;
  let assetsLicensed = 0;
  let assetsFinanced = 0;
  let assetsMapped = 0;
  let assetsWithPhotos = 0;
  let assetsWithDocuments = 0;

  uniqueAssets.forEach((asset) => {
    const valueExVat = Math.round(Number(asset.value || 0));
    const countedValueExVat = assetCountsTowardRegisterTotal(asset.id, memberships) ? valueExVat : 0;
    const replacementPrice = readAssetReplacementPriceExVat(asset);
    const insuredValue = readAssetInsuredValueExVat(asset);
    const isInsured = readInsuranceStatusChoice(asset) === 'yes';
    const isFinanced = readFinanceStatusChoice(asset) === 'yes';
    const isLicensed = readLicenseStatusChoice(asset) === 'yes';
    const assetType = getRegisterSummaryAssetType(asset);

    currentValueExVat += countedValueExVat;
    addToRegisterSummaryCountValue(assetTypes[assetType], countedValueExVat);

    if (isAim4priceValuedAsset(asset)) {
      addToRegisterSummaryCountValue(aim4priceAssets, countedValueExVat);
    } else {
      addToRegisterSummaryCountValue(manualAssets, countedValueExVat);
    }

    if (replacementPrice !== null) {
      replacementPricedAssets += 1;
      replacementValueExVat += replacementPrice;
    }

    if (insuredValue !== null) {
      insuredValueExVat += insuredValue;
    }

    if (isFinanced) {
      assetsFinanced += 1;
      financedValueExVat += countedValueExVat;
    }

    if (isInsured) {
      assetsInsured += 1;
      insuredAssetsValueExVat += insuredValue ?? 0;
    }

    if (isLicensed) {
      assetsLicensed += 1;
      licensedValueExVat += countedValueExVat;
    }

    if (hasAssetMapCoordinates(asset)) {
      assetsMapped += 1;
    }

    if (normalizePhotos(asset.photos).length > 0) {
      assetsWithPhotos += 1;
    }

    if (assetDocuments(asset).length > 0) {
      assetsWithDocuments += 1;
    }
  });

  return {
    totalAssets: uniqueAssets.length,
    currentValueExVat,
    replacementValueExVat,
    replacementPricedAssets,
    insuredValueExVat,
    insuredAssetsValueExVat,
    financedValueExVat,
    licensedValueExVat,
    assetsInsured,
    assetsLicensed,
    assetsFinanced,
    aim4priceAssets,
    manualAssets,
    assetTypes,
    assetsMapped,
    assetsWithPhotos,
    assetsWithDocuments,
  };
}

function countWithVerb(count: number, singularVerb = 'has', pluralVerb = 'have'): string {
  return `${count.toLocaleString('en-ZA')} ${count === 1 ? singularVerb : pluralVerb}`;
}

function assetCountLabel(count: number): string {
  return `${count.toLocaleString('en-ZA')} ${count === 1 ? 'asset' : 'assets'}`;
}

function buildOwnerName(profile: AccountProfile | null): string {
  if (!profile) return 'Aim4price account';
  return profile.businessName || profile.name || 'Aim4price account';
}

function buildCombinedAssetRegisterShareName(
  profile: AccountProfile | null,
  registers: AssetRegisterSummary[],
): string {
  const savedBusinessName = String(
    profile?.businessName
      || registers.find((register) => register.isPrimary)?.businessName
      || profile?.name
      || 'Aim4price',
  )
    .replace(/\s+combined asset registers?$/i, '')
    .trim();

  return `${savedBusinessName || 'Aim4price'} Combined Asset Register`;
}

function buildOwnerMeta(profile: AccountProfile | null): string {
  if (!profile) return 'Aim4price asset register summary';

  const location = [profile.townCity, profile.province].filter(Boolean).join(', ');
  const address = [profile.addressLine1, profile.addressLine2].filter(Boolean).join(', ');
  const parts = [profile.marketplaceEmail, profile.phone, location, address].filter(Boolean);

  return parts.join(' • ') || 'Aim4price asset register summary';
}

function toAbsoluteUrl(value?: string | null): string | null {
  const text = String(value ?? '').trim();

  if (!text) {
    return null;
  }

  if (/^(https?:|data:|blob:)/i.test(text)) {
    return text;
  }

  if (typeof window === 'undefined') {
    return text;
  }

  try {
    return new URL(text, window.location.origin).toString();
  } catch {
    return text;
  }
}

type PrintableImageOptions = {
  maxDimension?: number;
  mimeType?: 'image/jpeg' | 'image/png' | 'image/webp';
  quality?: number;
};

const PRINT_REGISTER_THUMB_MAX_DIMENSION = 420;
const PRINT_ASSET_SHEET_PHOTO_MAX_DIMENSION = 1280;
const PRINT_LOGO_MAX_DIMENSION = 900;
const PRINT_IMAGE_CONCURRENCY = 4;

function isDataUrl(value: string): boolean {
  return /^data:/i.test(value.trim());
}

function readFetchableImageUrl(value?: string | null): string | null {
  const url = toAbsoluteUrl(value);

  if (!url) {
    return null;
  }

  return url;
}

function blobToDataUrl(blob: Blob): Promise<string | null> {
  if (typeof FileReader === 'undefined') {
    return Promise.resolve(null);
  }

  return new Promise((resolve) => {
    const reader = new FileReader();

    reader.addEventListener('load', () => {
      resolve(typeof reader.result === 'string' ? reader.result : null);
    }, { once: true });
    reader.addEventListener('error', () => resolve(null), { once: true });
    reader.readAsDataURL(blob);
  });
}

function loadImageElement(src: string): Promise<HTMLImageElement | null> {
  if (typeof Image === 'undefined') {
    return Promise.resolve(null);
  }

  return new Promise((resolve) => {
    const image = new Image();

    image.addEventListener('load', () => resolve(image), { once: true });
    image.addEventListener('error', () => resolve(null), { once: true });
    image.src = src;
  });
}

async function resizeImageBlobForPrint(blob: Blob, options: PrintableImageOptions): Promise<string | null> {
  if (typeof document === 'undefined' || typeof URL === 'undefined') {
    return null;
  }

  const sourceUrl = URL.createObjectURL(blob);

  try {
    const image = await loadImageElement(sourceUrl);

    if (!image) {
      return null;
    }

    const naturalWidth = image.naturalWidth || image.width;
    const naturalHeight = image.naturalHeight || image.height;

    if (!naturalWidth || !naturalHeight) {
      return null;
    }

    const maxDimension = Math.max(1, Math.round(options.maxDimension ?? PRINT_ASSET_SHEET_PHOTO_MAX_DIMENSION));
    const scale = Math.min(1, maxDimension / Math.max(naturalWidth, naturalHeight));
    const canvas = document.createElement('canvas');

    canvas.width = Math.max(1, Math.round(naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(naturalHeight * scale));

    const context = canvas.getContext('2d');

    if (!context) {
      return null;
    }

    context.drawImage(image, 0, 0, canvas.width, canvas.height);

    return canvas.toDataURL(options.mimeType ?? 'image/jpeg', options.quality ?? 0.84);
  } catch {
    return null;
  } finally {
    URL.revokeObjectURL(sourceUrl);
  }
}

async function preparePrintableImageUrl(value?: string | null, options: PrintableImageOptions = {}): Promise<string | null> {
  const url = readFetchableImageUrl(value);

  if (!url) {
    return null;
  }

  if (isDataUrl(url) || typeof fetch === 'undefined') {
    return url;
  }

  try {
    const response = await fetch(url, {
      credentials: 'include',
      cache: 'no-store',
    });

    if (!response.ok) {
      return url;
    }

    const blob = await response.blob();

    if (!blob.size) {
      return url;
    }

    const contentType = String(response.headers.get('content-type') || blob.type || '').toLowerCase();

    if (contentType && !contentType.startsWith('image/') && contentType !== 'application/octet-stream') {
      return url;
    }

    return (await resizeImageBlobForPrint(blob, options)) ?? (await blobToDataUrl(blob)) ?? url;
  } catch {
    return url;
  }
}

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  mapper: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let nextIndex = 0;
  const workerCount = Math.min(Math.max(1, concurrency), items.length);

  await Promise.all(Array.from({ length: workerCount }, async () => {
    while (nextIndex < items.length) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      results[currentIndex] = await mapper(items[currentIndex], currentIndex);
    }
  }));

  return results;
}

async function preparePrintableImageUrls(values: string[], options: PrintableImageOptions = {}): Promise<string[]> {
  const urls = normalizePhotos(values);
  const preparedUrls = await mapWithConcurrency(urls, PRINT_IMAGE_CONCURRENCY, (url) => preparePrintableImageUrl(url, options));
  const seen = new Set<string>();

  return preparedUrls
    .filter((url): url is string => Boolean(url))
    .filter((url) => {
      if (seen.has(url)) {
        return false;
      }

      seen.add(url);
      return true;
    });
}

async function buildPrintableAssetThumbnailMap(reportAssets: RegisterAsset[]): Promise<Map<string, string>> {
  const rows = await mapWithConcurrency(reportAssets, PRINT_IMAGE_CONCURRENCY, async (asset) => {
    const photoUrl = await preparePrintableImageUrl(assetPreviewImage(asset), {
      maxDimension: PRINT_REGISTER_THUMB_MAX_DIMENSION,
      mimeType: 'image/jpeg',
      quality: 0.82,
    });

    return [asset.id, photoUrl] as const;
  });

  const thumbnailMap = new Map<string, string>();

  rows.forEach(([assetId, photoUrl]) => {
    if (photoUrl) {
      thumbnailMap.set(assetId, photoUrl);
    }
  });

  return thumbnailMap;
}

function buildAssetScanUrl(asset: RegisterAsset): string | null {
  const publicAssetCode = String(asset.publicAssetCode ?? '').trim();

  if (!publicAssetCode) {
    return null;
  }

  return toAbsoluteUrl(`/scan/${encodeURIComponent(publicAssetCode)}`);
}

function buildExternalShareAsset(asset: RegisterAsset): ExternalAssetShareItem {
  return {
    title: asset.title,
    serialNumber: asset.serialNumber,
    yearModel: asset.yearModel,
    usage: buildAssetUsageValue(asset),
    condition: conditionLabel(asset.condition),
    replacementPriceExVat: readAssetReplacementPriceExVat(asset),
    valueExVat: asset.value,
    photoUrls: normalizePhotos(asset.photos).flatMap((photoUrl) => {
      const absoluteUrl = toAbsoluteUrl(photoUrl);
      return absoluteUrl ? [absoluteUrl] : [];
    }),
    publicUrl: buildAssetScanUrl(asset),
  };
}

function buildAssetQrSvgUrl(asset: RegisterAsset): string {
  return `/api/asset-register/qr?assetId=${encodeURIComponent(asset.id)}&format=svg`;
}

function buildAssetPdfReportUrl(
  asset: RegisterAsset,
  reportKind: AssetPdfReportKind,
  filters?: AssetPdfReportFilters,
  format: AssetReportFormat = 'pdf',
): string {
  const searchParams = new URLSearchParams({
    assetId: asset.id,
    report: reportKind,
  });

  if (format === 'xlsx') {
    searchParams.set('format', 'xlsx');
  }

  if (filters?.year && filters.year !== 'all') {
    searchParams.set('year', filters.year);

    if (filters.month && filters.month !== 'all') {
      searchParams.set('month', filters.month);
    }
  }

  if (reportKind === 'maintenance' && filters?.maintenanceType && filters.maintenanceType !== 'all') {
    searchParams.set('maintenanceType', filters.maintenanceType);
  }

  return `/api/asset-register/scan-report?${searchParams.toString()}`;
}

function buildAssetOwnershipReportUrl(
  asset: RegisterAsset,
  filters?: AssetPdfReportFilters,
  format: AssetReportFormat = 'pdf',
): string {
  const searchParams = new URLSearchParams({
    assetId: asset.id,
    format,
  });

  if (filters?.year && filters.year !== 'all') {
    searchParams.set('year', filters.year);

    if (filters.month && filters.month !== 'all') {
      searchParams.set('month', filters.month);
    }
  }

  return `/api/my-invoices/report?${searchParams.toString()}`;
}

function buildAssetGroupTimelineReportUrl(
  group: AssetGroup,
  reportKind: Exclude<AssetGroupReportKind, 'valuation' | 'ownership'>,
  filters: AssetGroupReportFilters,
  format: AssetGroupReportFormat,
): string {
  if (reportKind === 'maintenance') {
    const maintenanceSelection = filters.maintenanceType ?? 'all';
    const scope = maintenanceSelection === 'upcoming' || maintenanceSelection === 'done'
      ? maintenanceSelection
      : 'total';
    const maintenanceParams = new URLSearchParams({
      groupId: group.id,
      scope,
      format,
    });

    if (maintenanceSelection === 'service' || maintenanceSelection === 'checkup') {
      maintenanceParams.set('type', maintenanceSelection);
    }

    if (filters.year && filters.year !== 'all') {
      maintenanceParams.set('year', filters.year);
      if (filters.month && filters.month !== 'all') maintenanceParams.set('month', filters.month);
    }

    return `/api/maintenance/report?${maintenanceParams.toString()}`;
  }

  const searchParams = new URLSearchParams({ groupId: group.id, report: reportKind, format });

  if (filters.year && filters.year !== 'all') {
    searchParams.set('year', filters.year);
    if (filters.month && filters.month !== 'all') searchParams.set('month', filters.month);
  }

  return `/api/asset-register/scan-report?${searchParams.toString()}`;
}

function buildAssetGroupOwnershipReportUrl(
  group: AssetGroup,
  filters: AssetGroupReportFilters,
  format: AssetGroupReportFormat,
): string {
  const searchParams = new URLSearchParams({ groupId: group.id, format });

  if (filters.year && filters.year !== 'all') {
    searchParams.set('year', filters.year);
    if (filters.month && filters.month !== 'all') searchParams.set('month', filters.month);
  }

  return `/api/my-invoices/report?${searchParams.toString()}`;
}

function extractAssetReportYear(value?: string | null): number | null {
  if (!value) return null;

  const date = new Date(value);
  const year = date.getFullYear();

  if (!Number.isFinite(year) || year < 2000 || year > 2100) {
    return null;
  }

  return year;
}

function getAssetFuelReportYearValues(asset: RegisterAsset | null): string[] {
  const currentYear = new Date().getFullYear();
  const candidateYears = [
    currentYear,
    extractAssetReportYear(asset?.lastScannedAtIso),
    extractAssetReportYear(asset?.updatedAtIso),
    extractAssetReportYear(asset?.createdAtIso),
  ].filter((year): year is number => typeof year === 'number' && Number.isFinite(year));
  const minYear = Math.min(...candidateYears, currentYear);
  const maxYear = Math.max(...candidateYears, currentYear);

  const years: string[] = [];
  for (let year = maxYear; year >= minYear; year -= 1) {
    years.push(String(year));
  }

  return years;
}

function buildAssetQrPrintUrl(asset: RegisterAsset): string {
  return `/api/asset-register/qr?assetId=${encodeURIComponent(asset.id)}&format=print`;
}

function formatQrStatus(value?: string | null): string {
  const normalized = String(value ?? '').trim().toLowerCase();

  if (normalized === 'transferred') return 'Transferred';
  if (normalized === 'retired') return 'Retired';
  if (normalized === 'deleted') return 'Inactive';
  if (normalized === 'active') return 'Active';
  return 'Pending';
}

function buildAssetSheetMethodCards(asset: RegisterAsset): ReportMethodCard[] {
  const cards: ReportMethodCard[] = [];

  if (asset.aim4priceValueExVat !== null) {
    cards.push({
      label: 'Aim4price',
      value: money(asset.aim4priceValueExVat),
      note: 'Pricing engine output.',
      selected: asset.selectedMethod === 'aim4price',
    });
  }

  if (!cards.length || asset.selectedMethod === 'manual') {
    cards.unshift({
      label: 'Register',
      value: money(asset.value),
      note: 'Saved register value.',
      selected: asset.selectedMethod === 'manual' || !cards.length,
    });
  }

  return cards;
}

function buildPaginationItems(currentPage: number, pageCount: number): PageItem[] {
  if (pageCount <= 1) return [1];

  const pages = new Set<number>([1, pageCount, currentPage - 1, currentPage, currentPage + 1]);
  const sorted = Array.from(pages)
    .filter((page) => page >= 1 && page <= pageCount)
    .sort((left, right) => left - right);

  const result: PageItem[] = [];

  sorted.forEach((page, index) => {
    if (index > 0 && page - sorted[index - 1] > 1) {
      result.push('ellipsis');
    }

    result.push(page);
  });

  return result;
}

function parseDownloadFileName(response: Response, fallback: string): string {
  const disposition = response.headers.get('content-disposition') || '';
  const quotedMatch = /filename="([^"]+)"/i.exec(disposition);
  const plainMatch = /filename=([^;]+)/i.exec(disposition);

  return (quotedMatch?.[1] || plainMatch?.[1] || fallback).trim();
}

function downloadBlob(blob: Blob, fileName: string) {
  const objectUrl = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = objectUrl;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(objectUrl);
}

function readRegisterIdFromLocation(): string {
  if (typeof window === 'undefined') {
    return '';
  }

  const params = new URLSearchParams(window.location.search);
  if (params.get('scope')?.trim().toLowerCase() === 'combined') {
    return COMBINED_REGISTER_ID;
  }

  return params.get('registerId')?.trim() ?? '';
}

function buildAssetRegisterApiUrl(registerId?: string | null): string {
  const cleanedRegisterId = String(registerId ?? '').trim();

  if (cleanedRegisterId === COMBINED_REGISTER_ID) {
    return '/api/asset-register?scope=combined';
  }

  if (!cleanedRegisterId) {
    return '/api/asset-register';
  }

  const params = new URLSearchParams({ registerId: cleanedRegisterId });
  return `/api/asset-register?${params.toString()}`;
}

function buildAssetGroupsApiUrl(accountantShareId?: string, groupId?: string, combined = false): string {
  const params = new URLSearchParams();
  if (accountantShareId) params.set('accountantShareId', accountantShareId);
  if (groupId) params.set('groupId', groupId);
  if (combined) params.set('scope', 'combined');
  const query = params.toString();
  return `/api/asset-groups${query ? `?${query}` : ''}`;
}

function buildAssetRegisterExportUrl(
  registerId?: string | null,
  entityName = '',
  accountantShareId?: string,
  availableRegisterIds: string[] = [],
  groupId = '',
): string {
  const params = new URLSearchParams({ format: 'xlsx' });
  const cleanedRegisterId = String(registerId ?? '').trim();
  const cleanedEntityName = entityName.trim();

  if (cleanedRegisterId === COMBINED_REGISTER_ID) {
    const registerIds = availableRegisterIds.filter((id) => id && id !== COMBINED_REGISTER_ID);
    params.set('scope', registerIds.length >= 2 ? 'combined' : 'all');
    if (registerIds.length >= 2) params.set('registerIds', registerIds.join(','));
    params.set('entityName', cleanedEntityName || 'Combined Asset Registers');
  } else if (cleanedRegisterId) {
    params.set('scope', 'single');
    params.set('registerIds', cleanedRegisterId);
    if (cleanedEntityName) params.set('entityName', cleanedEntityName);
  }

  if (accountantShareId) params.set('accountantShareId', accountantShareId);
  if (groupId.trim()) params.set('groupId', groupId.trim());

  return `/api/asset-register/export?${params.toString()}`;
}

function buildAssetRegisterSummaryExportUrl(
  registerId: string | null | undefined,
  format: ExportFormat,
  availableRegisterIds: string[] = [],
): string {
  const params = new URLSearchParams({
    format,
    reportKind: 'summary',
  });
  const cleanedRegisterId = String(registerId ?? '').trim();

  if (cleanedRegisterId === COMBINED_REGISTER_ID) {
    const registerIds = availableRegisterIds.filter((id) => id && id !== COMBINED_REGISTER_ID);
    params.set('scope', registerIds.length >= 2 ? 'combined' : 'all');
    if (registerIds.length >= 2) params.set('registerIds', registerIds.join(','));
    params.set('entityName', 'Combined Asset Registers');
  } else if (cleanedRegisterId) {
    params.set('registerId', cleanedRegisterId);
  }

  return `/api/asset-register/export?${params.toString()}`;
}

function mergeProfileWithRegister(profile: AccountProfile | null, register: AssetRegisterSummary | null): AccountProfile | null {
  if (!profile || !register) {
    return profile;
  }

  const registerLogoUrl = register.showLogosOnRegister !== false
    ? (Array.isArray(register.logoUrls) ? String(register.logoUrls[0] ?? '').trim() : '')
    : '';

  return {
    ...profile,
    businessName: register.businessName || profile.businessName,
    email: register.email || profile.marketplaceEmail || '',
    marketplaceEmail: register.email || profile.marketplaceEmail || '',
    phone: register.phone || profile.phone,
    logoUrl: registerLogoUrl,
    addressLine1: register.addressLine1 || profile.addressLine1,
    addressLine2: '',
  };
}


function getRegisterReportLogoUrl(register: AssetRegisterSummary | null): string {
  const registerLogoUrl = register?.showLogosOnRegister !== false && Array.isArray(register?.logoUrls)
    ? String(register.logoUrls[0] ?? '').trim()
    : '';

  return toAbsoluteUrl(registerLogoUrl) ?? '';
}

function loadLeafletMarkerCluster(leaflet: any): Promise<any> {
  if (leaflet?.markerClusterGroup) return Promise.resolve(leaflet);

  if (!document.getElementById(LEAFLET_CLUSTER_CSS_ID)) {
    const link = document.createElement('link');
    link.id = LEAFLET_CLUSTER_CSS_ID;
    link.rel = 'stylesheet';
    link.href = 'https://unpkg.com/leaflet.markercluster@1.5.3/dist/MarkerCluster.css';
    link.crossOrigin = '';
    document.head.appendChild(link);
  }
  if (!document.getElementById(LEAFLET_CLUSTER_DEFAULT_CSS_ID)) {
    const link = document.createElement('link');
    link.id = LEAFLET_CLUSTER_DEFAULT_CSS_ID;
    link.rel = 'stylesheet';
    link.href = 'https://unpkg.com/leaflet.markercluster@1.5.3/dist/MarkerCluster.Default.css';
    link.crossOrigin = '';
    document.head.appendChild(link);
  }

  return new Promise((resolve, reject) => {
    const existingScript = document.getElementById(LEAFLET_CLUSTER_SCRIPT_ID) as HTMLScriptElement | null;
    const handleLoaded = () => leaflet?.markerClusterGroup
      ? resolve(leaflet)
      : reject(new Error('Marker clustering did not initialise correctly.'));
    if (existingScript) {
      existingScript.addEventListener('load', handleLoaded, { once: true });
      existingScript.addEventListener('error', () => reject(new Error('Failed to load marker clustering.')), { once: true });
      return;
    }
    const script = document.createElement('script');
    script.id = LEAFLET_CLUSTER_SCRIPT_ID;
    script.src = 'https://unpkg.com/leaflet.markercluster@1.5.3/dist/leaflet.markercluster.js';
    script.async = true;
    script.crossOrigin = '';
    script.addEventListener('load', handleLoaded, { once: true });
    script.addEventListener('error', () => reject(new Error('Failed to load marker clustering.')), { once: true });
    document.body.appendChild(script);
  });
}

function loadLeaflet(): Promise<any> {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('Leaflet can only load in the browser.'));
  }

  if (window.L?.markerClusterGroup) {
    return Promise.resolve(window.L);
  }

  if (leafletLoaderPromise) {
    return leafletLoaderPromise;
  }

  leafletLoaderPromise = new Promise((resolve, reject) => {
    if (window.L) {
      void loadLeafletMarkerCluster(window.L).then(resolve, () => resolve(window.L));
      return;
    }

    if (!document.getElementById(LEAFLET_CSS_ID)) {
      const link = document.createElement('link');
      link.id = LEAFLET_CSS_ID;
      link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      link.crossOrigin = '';
      document.head.appendChild(link);
    }

    const existingScript = document.getElementById(LEAFLET_SCRIPT_ID) as HTMLScriptElement | null;

    const handleLoaded = () => {
      if (window.L) {
        void loadLeafletMarkerCluster(window.L).then(resolve, () => resolve(window.L));
        return;
      }

      reject(new Error('The partner map did not initialise correctly.'));
    };

    if (existingScript) {
      existingScript.addEventListener('load', handleLoaded, { once: true });
      existingScript.addEventListener('error', () => reject(new Error('Failed to load the partner map.')), { once: true });
      return;
    }

    const script = document.createElement('script');
    script.id = LEAFLET_SCRIPT_ID;
    script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    script.async = true;
    script.crossOrigin = '';
    script.addEventListener('load', handleLoaded, { once: true });
    script.addEventListener('error', () => reject(new Error('Failed to load the partner map.')), { once: true });
    document.body.appendChild(script);
  });

  return leafletLoaderPromise;
}

function quoteOptionForLeadType(leadType: AssetLeadType | null): AssetQuoteOption | null {
  if (!leadType) return null;
  return ASSET_QUOTE_OPTIONS.find((option) => option.leadType === leadType) ?? null;
}

function formatQuotePartnerType(value: PartnerType): string {
  if (value === 'dealer') return 'Dealer';
  if (value === 'finance') return 'Accountant or finance';
  if (value === 'licensing') return 'Licence renewal expert';
  return 'Insurance';
}

function quoteStyleForPartnerType(partnerType: PartnerType | null | undefined): QuoteToneStyle {
  if (partnerType === 'finance') return QUOTE_TONE_STYLES.finance;
  if (partnerType === 'insurance') return QUOTE_TONE_STYLES.insurance;
  if (partnerType === 'licensing') return QUOTE_TONE_STYLES.licensing;
  return QUOTE_TONE_STYLES.dealer;
}

function quoteToneClassForLeadType(leadType: AssetLeadType): string {
  if (leadType === 'finance') return styles.assetQuoteToneFinance;
  if (leadType === 'insurance') return styles.assetQuoteToneInsurance;
  if (leadType === 'license_renewal') return styles.assetQuoteToneLicensing;
  return styles.assetQuoteToneDealer;
}

function quoteToneClassForPartnerType(partnerType: PartnerType | null | undefined): string {
  if (partnerType === 'finance') return styles.assetQuoteToneFinance;
  if (partnerType === 'insurance') return styles.assetQuoteToneInsurance;
  if (partnerType === 'dealer') return styles.assetQuoteToneDealer;
  if (partnerType === 'licensing') return styles.assetQuoteToneLicensing;
  return '';
}

function assetPartnerNotes(asset: RegisterAsset): OpenPartnerNote[] {
  const savedNotes = Array.isArray(asset.partnerNotes)
    ? asset.partnerNotes.filter((note) => String(note.noteText ?? '').trim() || note.attachment)
    : [];

  if (savedNotes.length) {
    return savedNotes;
  }

  return asset.openPartnerNote ? [asset.openPartnerNote] : [];
}

function partnerNoteAuthor(note: OpenPartnerNote): string {
  return note.partnerBusinessName || note.partnerName || 'Aim4price partner';
}

function partnerNoteReportLabel(note: OpenPartnerNote, index: number, assetTitle?: string): string {
  const partnerType = note.partnerType ? formatQuotePartnerType(note.partnerType) : 'Partner';
  const assetSuffix = assetTitle ? ` · ${assetTitle}` : '';

  return `${partnerType} note ${index + 1} · ${partnerNoteAuthor(note)}${assetSuffix}`;
}

function partnerNoteReportValue(note: OpenPartnerNote): string {
  const attachmentLabel = note.attachment
    ? `Attached PDF: ${note.attachment.fileName}${note.attachment.byteSize ? ` (${formatByteSize(note.attachment.byteSize)})` : ''}`
    : '';
  const statusLabel = note.status === 'noted' ? 'Status: Noted' : 'Status: Open';
  const sentLabel = note.createdAtIso ? `Sent: ${formatDate(note.createdAtIso)}` : '';

  return [note.noteText, attachmentLabel, statusLabel, sentLabel].filter(Boolean).join('\n');
}

function buildAssetPartnerNoteRows(asset: RegisterAsset, includeAssetTitle = false): ReportKeyValue[] {
  return assetPartnerNotes(asset).map((note, index) => ({
    label: partnerNoteReportLabel(note, index, includeAssetTitle ? asset.title : undefined),
    value: partnerNoteReportValue(note),
  }));
}

function quoteMarkerClassForPartnerType(partnerType: PartnerType | null | undefined): string {
  if (partnerType === 'finance') return 'assetQuoteMapMarker--finance';
  if (partnerType === 'insurance') return 'assetQuoteMapMarker--insurance';
  if (partnerType === 'licensing') return 'assetQuoteMapMarker--licensing';
  return 'assetQuoteMapMarker--dealer';
}

function quotePartnerName(partner: PartnerDirectoryEntry): string {
  return partner.businessName || partner.displayName || 'Aim4price business';
}

function quotePartnerLocation(partner: PartnerDirectoryEntry): string {
  return [partner.townCity, partner.province].filter(Boolean).join(', ') || 'Location not saved';
}

function quotePartnerInitial(partner: PartnerDirectoryEntry): string {
  return (quotePartnerName(partner).trim().charAt(0) || 'A').toUpperCase();
}

function normalizeWebsiteHref(value: string): string {
  const trimmed = value.trim();

  if (!trimmed) {
    return '';
  }

  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;

  try {
    const parsed = new URL(withProtocol);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? parsed.href : '';
  } catch {
    return '';
  }
}

function formatWebsiteDisplay(value: string): string {
  const href = normalizeWebsiteHref(value);

  if (!href) {
    return '';
  }

  try {
    const parsed = new URL(href);
    return parsed.hostname.replace(/^www\./i, '');
  } catch {
    return value.replace(/^https?:\/\//i, '').replace(/^www\./i, '').replace(/\/$/, '');
  }
}

function normalizePhoneHref(value: string): string {
  const cleaned = value.replace(/[^+\d]/g, '');
  return cleaned ? `tel:${cleaned}` : '';
}

function normalizeEmailHref(value: string): string {
  const trimmed = value.trim();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed) ? `mailto:${trimmed}` : '';
}

function quotePartnerAddress(partner: PartnerDirectoryEntry): string {
  if (partner.isAim4priceManaged) return 'Service area — not a physical branch';
  return [partner.addressLine1, partner.townCity, partner.province].filter(Boolean).join(', ') || 'Address not saved';
}

function quotePartnerServicesDisplay(partner: PartnerDirectoryEntry): string {
  return partner.services || formatQuotePartnerType(partner.partnerType);
}

function quotePartnerRadiusDisplay(partner: PartnerDirectoryEntry): string {
  if (partner.serviceRadiusKm) return `${partner.serviceRadiusKm} km service radius`;
  return partner.partnerType === 'licensing' ? 'Available for renewal requests' : 'Service area not saved';
}

function isDealerAssistancePartner(partner: PartnerDirectoryEntry): boolean {
  return Boolean(partner.isAim4priceManaged && partner.partnerType === 'dealer');
}

function isAim4priceAssistancePartner(partner: PartnerDirectoryEntry): boolean {
  return Boolean(partner.isAim4priceManaged);
}

function quotePartnerWebsiteDisplay(partner: PartnerDirectoryEntry): string {
  return isDealerAssistancePartner(partner) ? 'www.aim4price.com' : formatWebsiteDisplay(partner.websiteUrl);
}

function hasQuotePartnerCoordinates(partner: PartnerDirectoryEntry): boolean {
  return (
    partner.latitude !== null &&
    partner.longitude !== null &&
    Number.isFinite(partner.latitude) &&
    Number.isFinite(partner.longitude) &&
    Math.abs(partner.latitude) <= 90 &&
    Math.abs(partner.longitude) <= 180
  );
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}


function buildQuotePartnerPopupHtml(partner: PartnerDirectoryEntry, isSelected = false): string {
  const name = escapeHtml(quotePartnerName(partner));
  const location = escapeHtml(quotePartnerLocation(partner));
  const radius = escapeHtml(quotePartnerRadiusDisplay(partner));
  const brands = !partner.isAim4priceManaged && partner.brandFocus ? escapeHtml(partner.brandFocus) : '';
  const services = escapeHtml(quotePartnerServicesDisplay(partner));
  const isDealerAssistance = isDealerAssistancePartner(partner);
  const websiteHref = normalizeWebsiteHref(partner.websiteUrl);
  const emailHref = normalizeEmailHref(partner.email);
  const phoneHref = normalizePhoneHref(partner.phone);
  const details = [
    `<div><span>Area</span><strong>${location}</strong></div>`,
    services ? `<div><span>Support</span><strong>${services}</strong></div>` : '',
    brands ? `<div><span>Brands</span><strong>${brands}</strong></div>` : '',
    `<div><span>Coverage</span><strong>${radius}</strong></div>`,
  ].filter(Boolean).join('');
  const dealerContacts = isDealerAssistance ? [
    websiteHref ? `<a href="${escapeHtml(websiteHref)}" target="_blank" rel="noreferrer"><span>Website</span><strong>${escapeHtml(quotePartnerWebsiteDisplay(partner))}</strong></a>` : '',
    emailHref ? `<a href="${escapeHtml(emailHref)}"><span>Email</span><strong>${escapeHtml(partner.email)}</strong></a>` : '',
    phoneHref ? `<a href="${escapeHtml(phoneHref)}"><span>Contact</span><strong>${escapeHtml(partner.phone)}</strong></a>` : '',
  ].filter(Boolean).join('') : '';
  const opensMessage = isAim4priceAssistancePartner(partner) && !isSelected;
  const actionLabel = isSelected
    ? 'Remove selection'
    : opensMessage
      ? 'Message Aim4price'
      : partner.isAim4priceManaged
        ? 'Select this service area'
        : 'Select this business';

  return `
    <div class="assetQuotePopupCard assetQuotePopupCardSimple assetQuotePopupCard--${escapeHtml(partner.partnerType)}">
      <div class="assetQuotePopupSimpleHeader">
        ${partner.isAim4priceManaged ? '<span class="assetQuoteManagedKicker"><i></i>Aim4price service area</span>' : ''}
        <strong>${name}</strong>
      </div>
      <div class="assetQuotePopupDetails assetQuotePopupSimpleDetails">${details}</div>
      ${dealerContacts ? `<div class="assetQuotePopupContacts">${dealerContacts}</div>` : ''}
      ${partner.isAim4priceManaged ? '<p class="assetQuoteManagedNotice">This is a service area, not a physical branch. Aim4price will help locate a suitable provider.</p>' : ''}
      <button type="button" data-quote-partner-id="${escapeHtml(partner.userId)}" data-quote-partner-action="${opensMessage ? 'message' : 'toggle'}" class="assetQuotePopupChooseButton">${actionLabel}</button>
    </div>
  `;
}

function extractApiError(payload: unknown, fallback: string): string {
  if (payload && typeof payload === 'object') {
    const record = payload as Record<string, unknown>;
    if (typeof record.error === 'string' && record.error.trim()) return record.error;
    if (typeof record.message === 'string' && record.message.trim()) return record.message;
  }

  return fallback;
}

function renderQuoteOptionIcon(leadType: AssetLeadType, className?: string) {
  if (leadType === 'finance') return <MoneyBagIcon className={className} />;
  if (leadType === 'insurance') return <ShieldIcon className={className} />;
  if (leadType === 'license_renewal') return <DocumentIcon className={className} />;
  return <ReplacementQuoteIcon className={className} />;
}

function renderManualAssetTypeIcon(assetKind: AssetKind, className?: string) {
  if (assetKind === 'vehicle') return <QuoteMachineIcon className={className} />;
  if (assetKind === 'property') return <StoreIcon className={className} />;
  if (assetKind === 'tools') return <ManageIcon className={className} />;
  if (assetKind === 'stock') return <CartIcon className={className} />;
  if (assetKind === 'manual') return <DocumentIcon className={className} />;
  return <UpdateAssetIcon className={className} />;
}

export default function AssetRegisterClient({ accountantShareId }: { accountantShareId?: string } = {}) {
  const isAccountantWorkspace = Boolean(accountantShareId);
  const [assets, setAssets] = useState<RegisterAsset[]>([]);
  const [assetGroups, setAssetGroups] = useState<AssetGroup[]>([]);
  const [expandedAssetGroupIds, setExpandedAssetGroupIds] = useState<Set<string>>(() => new Set());
  const [assetGroupShareTarget, setAssetGroupShareTarget] = useState<AssetGroup | null>(null);
  const [isAssetGroupModalOpen, setIsAssetGroupModalOpen] = useState(false);
  const [assetGroupModalAsset, setAssetGroupModalAsset] = useState<RegisterAsset | null>(null);
  const [assetGroupModalGroup, setAssetGroupModalGroup] = useState<AssetGroup | null>(null);
  const [assetGroupError, setAssetGroupError] = useState('');
  const [isSavingAssetGroup, setIsSavingAssetGroup] = useState(false);
  const [draggingAssetId, setDraggingAssetId] = useState<string | null>(null);
  const [assetGroupDropTargetId, setAssetGroupDropTargetId] = useState<string | null>(null);
  const [accountantAccess, setAccountantAccess] = useState<AccountantRegisterAccess | null>(null);
  const [accountProfile, setAccountProfile] = useState<AccountProfile | null>(null);
  const [assetRegisters, setAssetRegisters] = useState<AssetRegisterSummary[]>([]);
  const [activeRegister, setActiveRegister] = useState<AssetRegisterSummary | null>(null);
  const [activeRegisterId, setActiveRegisterId] = useState('');
  const [isChangeRegisterModalOpen, setIsChangeRegisterModalOpen] = useState(false);
  const [changingRegisterId, setChangingRegisterId] = useState('');
  const [registerSwitcherSearchTerm, setRegisterSwitcherSearchTerm] = useState('');
  const [assetRegisterMoveAsset, setAssetRegisterMoveAsset] = useState<RegisterAsset | null>(null);
  const [assetRegisterMoveSearchTerm, setAssetRegisterMoveSearchTerm] = useState('');
  const [assetRegisterMoveDestination, setAssetRegisterMoveDestination] = useState<AssetMoveDestination>('register');
  const [assetRegisterMoveTargetId, setAssetRegisterMoveTargetId] = useState('');
  const [assetRegisterMoveGroups, setAssetRegisterMoveGroups] = useState<AssetGroup[]>([]);
  const [assetRegisterMoveGroupLoadError, setAssetRegisterMoveGroupLoadError] = useState('');
  const [isLoadingAssetRegisterMoveGroups, setIsLoadingAssetRegisterMoveGroups] = useState(false);
  const [assetRegisterMoveError, setAssetRegisterMoveError] = useState('');
  const [isMovingAssetRegister, setIsMovingAssetRegister] = useState(false);
  const assetRegisterMoveGroupsRequestRef = useRef(0);
  const [accountantNoteAsset, setAccountantNoteAsset] = useState<RegisterAsset | null>(null);
  const [accountantNoteDraft, setAccountantNoteDraft] = useState('');
  const [isSavingAccountantNote, setIsSavingAccountantNote] = useState(false);
  const [assetDraft, setAssetDraft] = useState<AssetDraft>(initialAssetDraft);
  const [assetStatusDraft, setAssetStatusDraft] = useState<AssetStatusDraft>(initialAssetStatusDraft);
  const [assetDetailFocusTarget, setAssetDetailFocusTarget] = useState<AssetDetailEditTarget | null>(null);
  const [assetStatusEditView, setAssetStatusEditView] = useState<AssetStatusEditView>('hub');
  const [assetStatusQuickOrigin, setAssetStatusQuickOrigin] = useState<AssetStatusQuickOrigin>(null);
  const [assetStatusAdvancedOpen, setAssetStatusAdvancedOpen] = useState(false);
  const [assetStatusError, setAssetStatusError] = useState('');
  const [isSavingAssetStatus, setIsSavingAssetStatus] = useState(false);
  const [bulkFinanceAssetIds, setBulkFinanceAssetIds] = useState<string[]>([]);
  const [bulkFinanceAssetPickerOpen, setBulkFinanceAssetPickerOpen] = useState(false);
  const [bulkFinanceAssetSearch, setBulkFinanceAssetSearch] = useState('');
  const [editingAssetId, setEditingAssetId] = useState<string | null>(null);
  const [isAssetModalOpen, setIsAssetModalOpen] = useState(false);
  const [isAssetSettingsModalOpen, setIsAssetSettingsModalOpen] = useState(false);
  const [assetSettingsTypeDraft, setAssetSettingsTypeDraft] = useState<AssetKind>('equipment');
  const [assetSettingsUsageInput, setAssetSettingsUsageInput] = useState('');
  const [assetSettingsError, setAssetSettingsError] = useState('');
  const [isSavingAssetSettings, setIsSavingAssetSettings] = useState(false);
  const [assetSettingsLocationState, setAssetSettingsLocationState] = useState<AssetSettingsLocationState>('idle');
  const [assetSettingsLocationError, setAssetSettingsLocationError] = useState('');
  const [assetSettingsLocationSuccess, setAssetSettingsLocationSuccess] = useState('');
  const [assetSettingsManualLatInput, setAssetSettingsManualLatInput] = useState('');
  const [assetSettingsManualLngInput, setAssetSettingsManualLngInput] = useState('');
  const [assetSettingsManualLocationText, setAssetSettingsManualLocationText] = useState('');
  const [assetSettingsMapLatInput, setAssetSettingsMapLatInput] = useState('');
  const [assetSettingsMapLngInput, setAssetSettingsMapLngInput] = useState('');
  const [assetSettingsMapLocationText, setAssetSettingsMapLocationText] = useState('');
  const [assetSettingsView, setAssetSettingsView] = useState<AssetSettingsView>('menu');
  const [pendingUsageOverride, setPendingUsageOverride] = useState<AssetUsageOverrideRequest | null>(null);
  const isAssetSettingsLocationBusy = assetSettingsLocationState !== 'idle';
  const isAssetSettingsManualLocationSaving = assetSettingsLocationState === 'savingManual';
  const isAssetSettingsMapLocationSaving = assetSettingsLocationState === 'savingMap';
  const isAssetSettingsBusy = isSavingAssetSettings || isAssetSettingsLocationBusy;
  const [isManualConversionConfirmOpen, setIsManualConversionConfirmOpen] = useState(false);
  const [isAddAssetDestinationModalOpen, setIsAddAssetDestinationModalOpen] = useState(false);
  const [addAssetTargetRegisterId, setAddAssetTargetRegisterId] = useState('');
  const [isAddChoiceModalOpen, setIsAddChoiceModalOpen] = useState(false);
  const [isAcquisitionChoiceOpen, setIsAcquisitionChoiceOpen] = useState(false);
  const [newAssetAcquisitionDraft, setNewAssetAcquisitionDraft] = useState<AcquisitionDraft>(createAcquisitionDraft);
  const [manualAssetStep, setManualAssetStep] = useState<ManualAssetStep>(1);
  const [hasManualAssetKindSelection, setHasManualAssetKindSelection] = useState(false);
  const [activeAsset, setActiveAsset] = useState<RegisterAsset | null>(null);
  const [ownerAssetCommandPanel, setOwnerAssetCommandPanel] = useState<OwnerAssetCommandPanel>(null);
  const [ownerCommandReturnLocation, setOwnerCommandReturnLocation] = useState('/asset-register');
  const [quoteAsset, setQuoteAsset] = useState<RegisterAsset | null>(null);
  const [quoteScope, setQuoteScope] = useState<QuoteScope>('asset');
  const [selectedQuoteLeadType, setSelectedQuoteLeadType] = useState<AssetLeadType | null>(null);
  const [quoteDirectoryStage, setQuoteDirectoryStage] = useState<QuoteDirectoryStage>('location');
  const [quoteLocationInput, setQuoteLocationInput] = useState('');
  const [quoteLocationError, setQuoteLocationError] = useState('');
  const [isResolvingQuoteLocation, setIsResolvingQuoteLocation] = useState(false);
  const [isQuoteMapExpanded, setIsQuoteMapExpanded] = useState(false);
  const [quotePartners, setQuotePartners] = useState<PartnerDirectoryEntry[]>([]);
  const [selectedQuotePartnerIds, setSelectedQuotePartnerIds] = useState<string[]>([]);
  const [quotePartnerSearch, setQuotePartnerSearch] = useState('');
  const [quoteOwnerMessage, setQuoteOwnerMessage] = useState('');
  const [quoteLeadStep, setQuoteLeadStep] = useState<QuoteLeadStep>(null);
  const [quoteConsentAccepted, setQuoteConsentAccepted] = useState(false);
  const [quoteTrackMaintenance, setQuoteTrackMaintenance] = useState(false);
  const [quoteTrackingPermissions, setQuoteTrackingPermissions] = useState<DealerMaintenancePermissions>(() => ({
    ...DEFAULT_DEALER_MAINTENANCE_PERMISSIONS,
  }));
  const [selectedDealerShareAssetIds, setSelectedDealerShareAssetIds] = useState<string[]>([]);
  const [isQuoteTrackingSettingsOpen, setIsQuoteTrackingSettingsOpen] = useState(false);
  const [quoteIncludePhotos, setQuoteIncludePhotos] = useState(true);
  const [quoteIncludeDocuments, setQuoteIncludeDocuments] = useState(true);
  const [quoteIncludeScanHistory, setQuoteIncludeScanHistory] = useState(false);
  const [quoteAllowDirectUpdates, setQuoteAllowDirectUpdates] = useState(false);
  const [quoteIncludeFuelLedger, setQuoteIncludeFuelLedger] = useState(true);
  const [quoteIncludeCostLedger, setQuoteIncludeCostLedger] = useState(true);
  const [isLoadingQuotePartners, setIsLoadingQuotePartners] = useState(false);
  const [isSendingQuoteLead, setIsSendingQuoteLead] = useState(false);
  const [isDealerTrackingSettingsOpen, setIsDealerTrackingSettingsOpen] = useState(false);
  const [isLoadingDealerTrackingSettings, setIsLoadingDealerTrackingSettings] = useState(false);
  const [dealerTrackingAccess, setDealerTrackingAccess] = useState<DealerMaintenanceAccessSummary[]>([]);
  const [activeDealerTrackingByAssetId, setActiveDealerTrackingByAssetId] = useState<Record<string, boolean>>({});
  const quoteMapElementRef = useRef<HTMLDivElement | null>(null);
  const quoteLeafletMapRef = useRef<any>(null);
  const quoteMarkerLayerRef = useRef<any>(null);
  const quoteViewportTimeoutRef = useRef<number | null>(null);
  const quotePartnerRequestRef = useRef(0);
  const quoteFitResultsRef = useRef(false);
  const quoteInitialMapLocationRef = useRef<AssetSettingsApproximateMapLocation | null>(null);
  const selectedQuoteLeadTypeRef = useRef<AssetLeadType | null>(null);
  const quotePartnerSearchRef = useRef('');
  const assetSettingsMapElementRef = useRef<HTMLDivElement | null>(null);
  const assetSettingsLeafletMapRef = useRef<any>(null);
  const assetSettingsMapMarkerRef = useRef<any>(null);
  const [isAssetReportModalOpen, setIsAssetReportModalOpen] = useState(false);
  const [assetReportStep, setAssetReportStep] = useState<AssetReportStep>('options');
  const [assetFuelReportYear, setAssetFuelReportYear] = useState('all');
  const [assetFuelReportMonth, setAssetFuelReportMonth] = useState('all');
  const [assetMaintenanceReportType, setAssetMaintenanceReportType] = useState('all');
  const [assetMaintenanceReportYear, setAssetMaintenanceReportYear] = useState('all');
  const [assetMaintenanceReportMonth, setAssetMaintenanceReportMonth] = useState('all');
  const [assetDepreciationReportYear, setAssetDepreciationReportYear] = useState('all');
  const [assetDepreciationReportMonth, setAssetDepreciationReportMonth] = useState('all');
  const [assetOwnershipReportYear, setAssetOwnershipReportYear] = useState('all');
  const [assetOwnershipReportMonth, setAssetOwnershipReportMonth] = useState('all');
  const [assetReportDownloadFormat, setAssetReportDownloadFormat] = useState<AssetReportFormat>('pdf');
  const [openAssetReportSelect, setOpenAssetReportSelect] = useState<AssetReportSelectKey | null>(null);
  const [isPricingModalOpen, setIsPricingModalOpen] = useState(false);
  const [isQrModalOpen, setIsQrModalOpen] = useState(false);
  const [copiedScanLinkAssetId, setCopiedScanLinkAssetId] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ tone: NoticeTone; message: string } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshingRegister, setIsRefreshingRegister] = useState(false);
  const [isSavingAsset, setIsSavingAsset] = useState(false);
  const [assetAutosaveState, setAssetAutosaveState] = useState<AssetAutosaveState>('idle');
  const [isUploadingPhotos, setIsUploadingPhotos] = useState(false);
  const [isUploadingDocuments, setIsUploadingDocuments] = useState(false);
  const [detailMediaUpload, setDetailMediaUpload] = useState<DetailMediaUploadState>(null);
  const [pendingPhotoFiles, setPendingPhotoFiles] = useState<PendingPhotoFile[]>([]);
  const [mainPhotoSelection, setMainPhotoSelection] = useState<MainPhotoSelection | null>(null);
  const pendingPhotoFilesRef = useRef<PendingPhotoFile[]>([]);
  const [pendingDocumentFiles, setPendingDocumentFiles] = useState<File[]>([]);
  const pendingDocumentCategoriesRef = useRef<WeakMap<File, AssetDocumentCategory>>(new WeakMap());
  const [documentUploadAsset, setDocumentUploadAsset] = useState<RegisterAsset | null>(null);
  const [vaultDocumentsByAssetId, setVaultDocumentsByAssetId] = useState<Record<string, UploadedVaultDocument[]>>({});
  const [vaultDocumentsLoadingByAssetId, setVaultDocumentsLoadingByAssetId] = useState<Record<string, boolean>>({});
  const [vaultDocumentsErrorByAssetId, setVaultDocumentsErrorByAssetId] = useState<Record<string, string>>({});
  const [expandedAssetId, setExpandedAssetId] = useState<string | null>(null);
  const [detailPhotoIndexByAsset, setDetailPhotoIndexByAsset] = useState<Record<string, number>>({});
  const [photoViewer, setPhotoViewer] = useState<PhotoViewerState | null>(null);
  const detailTouchStartXRef = useRef<number | null>(null);
  const detailTouchDidSwipeRef = useRef(false);
  const [busyDeleteId, setBusyDeleteId] = useState<string | null>(null);
  const [deleteCandidateAsset, setDeleteCandidateAsset] = useState<RegisterAsset | null>(null);
  const [disposalCandidateAsset, setDisposalCandidateAsset] = useState<RegisterAsset | null>(null);
  const [disposalDraft, setDisposalDraft] = useState<DisposalDraft>(createDisposalDraft);
  const [acquisitionDetailsAsset, setAcquisitionDetailsAsset] = useState<RegisterAsset | null>(null);
  const [acquisitionDetailsDraft, setAcquisitionDetailsDraft] = useState<AcquisitionDraft>(createAcquisitionDraft);
  const [isLoadingAcquisitionDetails, setIsLoadingAcquisitionDetails] = useState(false);
  const [isSavingAcquisitionDetails, setIsSavingAcquisitionDetails] = useState(false);
  const [acquisitionDetailsError, setAcquisitionDetailsError] = useState('');
  const [marketplaceAsset, setMarketplaceAsset] = useState<RegisterAsset | null>(null);
  const [marketplaceDraft, setMarketplaceDraft] = useState<MarketplacePublishDraft | null>(null);
  const [isPublishingMarketplace, setIsPublishingMarketplace] = useState(false);
  const [busyMarketplaceRemoveId, setBusyMarketplaceRemoveId] = useState<string | null>(null);
  const [busyFlagAssetId, setBusyFlagAssetId] = useState<string | null>(null);
  const [busyRevalueAssetId, setBusyRevalueAssetId] = useState<string | null>(null);
  const [busyMaintenanceStatusId, setBusyMaintenanceStatusId] = useState<string | null>(null);
  const [busyMaintenanceAlertId, setBusyMaintenanceAlertId] = useState<string | null>(null);
  const [busyLicenseRenewalAssetId, setBusyLicenseRenewalAssetId] = useState<string | null>(null);
  const [busyIssueNoteStatusId, setBusyIssueNoteStatusId] = useState<string | null>(null);
  const [busyDealerCorrectionId, setBusyDealerCorrectionId] = useState<string | null>(null);
  const [busyRevalueAction, setBusyRevalueAction] = useState<RevalueMethod | null>(null);
  const [replacementPriceRevaluePrompt, setReplacementPriceRevaluePrompt] = useState<ReplacementPriceRevaluePrompt | null>(null);
  const [pricingPreview, setPricingPreview] = useState<PricingRevaluePreview | null>(null);
  const revaluePreviewRequestSeqRef = useRef(0);
  const [isLoadingPricingPreview, setIsLoadingPricingPreview] = useState(false);
  const [isSavingPricingPreview, setIsSavingPricingPreview] = useState(false);
  const [revalueReplacementPriceInput, setRevalueReplacementPriceInput] = useState('');
  const [revalueReplacementPriceError, setRevalueReplacementPriceError] = useState<string | null>(null);
  const [revalueLifetimeUsageInput, setRevalueLifetimeUsageInput] = useState('');
  const [revalueAdvancedError, setRevalueAdvancedError] = useState<string | null>(null);
  const [saveReplacementPriceWithRevalue, setSaveReplacementPriceWithRevalue] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [assetFilter, setAssetFilter] = useState<AssetFilterKey>('all');
  const [isAssetFilterOpen, setIsAssetFilterOpen] = useState(false);
  const assetFilterWrapRef = useRef<HTMLDivElement | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState<PageSize>(DEFAULT_PAGE_SIZE);
  const [registerValueVatMode, setRegisterValueVatMode] = useState<'excluded' | 'included'>('excluded');
  const [replacementValueVatMode, setReplacementValueVatMode] = useState<'excluded' | 'included'>('excluded');
  const [assetValueVatModes, setAssetValueVatModes] = useState<Record<string, 'excluded' | 'included'>>({});
  const [registerSummaryStartIndex, setRegisterSummaryStartIndex] = useState(0);
  const [registerSummaryCardsPerView, setRegisterSummaryCardsPerView] = useState(REGISTER_SUMMARY_VISIBLE_CARD_COUNT);
  const registerSummaryViewportRef = useRef<HTMLDivElement | null>(null);
  const registerSummaryScrollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const registerSummaryMaxIndex = Math.max(0, REGISTER_SUMMARY_TOTAL_CARD_COUNT - registerSummaryCardsPerView);
  const isRegisterSummaryAtStart = registerSummaryStartIndex <= 0;
  const isRegisterSummaryAtEnd = registerSummaryStartIndex >= registerSummaryMaxIndex;
  const [isSummaryModalOpen, setIsSummaryModalOpen] = useState(false);
  const [isRegisterShareModalOpen, setIsRegisterShareModalOpen] = useState(false);
  const [assetShareDestination, setAssetShareDestination] = useState<AssetShareDestination>('choice');
  const [isAccountantReportsOpen, setIsAccountantReportsOpen] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [exportFormat, setExportFormat] = useState<ExportFormat>('pdf');
  const [exportEntityName, setExportEntityName] = useState('');
  const [exportStep, setExportStep] = useState<ExportStep>('format');
  const [pdfReportKind, setPdfReportKind] = useState<PdfReportKind>('full');
  const [pdfReportSelection, setPdfReportSelection] = useState<PdfReportKind | ''>('');
  const [selectedPdfAssetIds, setSelectedPdfAssetIds] = useState<string[]>([]);
  const [pdfAssetSearchTerm, setPdfAssetSearchTerm] = useState('');
  const [isExporting, setIsExporting] = useState(false);
  const [projectionAsset, setProjectionAsset] = useState<RegisterAsset | null>(null);
  const [projectionForm, setProjectionForm] = useState<ProjectionFormState>(createDefaultProjectionForm());
  const [projectionResult, setProjectionResult] = useState<AssetFutureProjection | null>(null);
  const [projectionError, setProjectionError] = useState<string | null>(null);
  const [isLoadingProjection, setIsLoadingProjection] = useState(false);
  const photoInputRef = useRef<HTMLInputElement | null>(null);
  const documentInputRef = useRef<HTMLInputElement | null>(null);
  const documentObjectUrlsRef = useRef<Map<string, CachedDocumentObjectUrl>>(new Map());
  const assetMapActionHandledRef = useRef(false);
  const assetFocusActionHandledRef = useRef(false);
  const assetAutosaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const assetAutosaveBaselineRef = useRef('');
  const assetAutosaveLatestSignatureRef = useRef('');
  const assetAutosaveAttemptedSignatureRef = useRef('');
  const assetModalReturnRef = useRef<AssetModalReturnOrigin | null>(null);
  const documentUploadReturnAssetIdRef = useRef<string | null>(null);
  const assetDragPointerYRef = useRef<number | null>(null);
  const assetDragAutoScrollFrameRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      documentObjectUrlsRef.current.forEach((entry) => {
        URL.revokeObjectURL(entry.objectUrl);

        if (entry.timeoutId !== null) {
          window.clearTimeout(entry.timeoutId);
        }
      });
      documentObjectUrlsRef.current.clear();
    };
  }, []);

  useEffect(() => {
    function handleRegisterSummaryViewportChange() {
      setRegisterSummaryCardsPerView(getRegisterSummaryCardsPerView());
    }

    handleRegisterSummaryViewportChange();
    window.addEventListener('resize', handleRegisterSummaryViewportChange);

    return () => {
      window.removeEventListener('resize', handleRegisterSummaryViewportChange);
    };
  }, []);

  useEffect(() => () => {
    if (registerSummaryScrollTimeoutRef.current) {
      clearTimeout(registerSummaryScrollTimeoutRef.current);
    }
  }, []);

  useEffect(() => {
    if (!draggingAssetId) {
      assetDragPointerYRef.current = null;
      return undefined;
    }

    function handleAssetDragOver(event: DragEvent) {
      assetDragPointerYRef.current = event.clientY;
    }

    function handleAssetDragWheel(event: WheelEvent) {
      const viewportHeight = window.innerHeight || document.documentElement.clientHeight;
      const scrollDelta = assetGroupWheelScrollDelta(event.deltaY, event.deltaMode, viewportHeight);
      if (scrollDelta === 0) return;

      event.preventDefault();
      window.scrollBy({ top: scrollDelta, left: 0, behavior: 'auto' });
    }

    function runAssetDragAutoScroll() {
      const pointerY = assetDragPointerYRef.current;
      const viewportHeight = window.innerHeight || document.documentElement.clientHeight;

      if (pointerY !== null && viewportHeight > 0) {
        const scrollDelta = assetGroupAutoScrollDelta(pointerY, viewportHeight);
        if (scrollDelta !== 0) window.scrollBy({ top: scrollDelta, left: 0, behavior: 'auto' });
      }

      assetDragAutoScrollFrameRef.current = window.requestAnimationFrame(runAssetDragAutoScroll);
    }

    window.addEventListener('dragover', handleAssetDragOver);
    window.addEventListener('wheel', handleAssetDragWheel, { passive: false });
    assetDragAutoScrollFrameRef.current = window.requestAnimationFrame(runAssetDragAutoScroll);

    return () => {
      window.removeEventListener('dragover', handleAssetDragOver);
      window.removeEventListener('wheel', handleAssetDragWheel);
      assetDragPointerYRef.current = null;
      if (assetDragAutoScrollFrameRef.current !== null) {
        window.cancelAnimationFrame(assetDragAutoScrollFrameRef.current);
        assetDragAutoScrollFrameRef.current = null;
      }
    };
  }, [draggingAssetId]);

  useEffect(() => {
    setRegisterSummaryStartIndex((currentIndex) => Math.min(currentIndex, registerSummaryMaxIndex));
  }, [registerSummaryMaxIndex]);

  useEffect(() => {
    scrollRegisterSummaryToIndex(Math.min(registerSummaryStartIndex, registerSummaryMaxIndex));
  }, [registerSummaryCardsPerView, registerSummaryMaxIndex, registerSummaryStartIndex]);

  function scrollRegisterSummaryToIndex(nextIndex: number) {
    const viewport = registerSummaryViewportRef.current;
    if (!viewport) return;

    const safeIndex = Math.min(registerSummaryMaxIndex, Math.max(0, nextIndex));
    const maxScrollLeft = Math.max(0, viewport.scrollWidth - viewport.clientWidth);
    const nextScrollLeft = registerSummaryMaxIndex > 0 ? (maxScrollLeft * safeIndex) / registerSummaryMaxIndex : 0;

    window.requestAnimationFrame(() => {
      viewport.scrollTo({ left: nextScrollLeft, behavior: 'smooth' });
    });
  }

  function handleRegisterSummarySlide(direction: -1 | 1) {
    if (registerSummaryMaxIndex <= 0) return;

    setRegisterSummaryStartIndex((currentIndex) => {
      const nextIndex = Math.min(registerSummaryMaxIndex, Math.max(0, currentIndex + direction));
      scrollRegisterSummaryToIndex(nextIndex);
      return nextIndex;
    });
  }

  function handleRegisterSummaryScroll() {
    const viewport = registerSummaryViewportRef.current;
    if (!viewport || registerSummaryMaxIndex <= 0) return;

    if (registerSummaryScrollTimeoutRef.current) {
      clearTimeout(registerSummaryScrollTimeoutRef.current);
    }

    registerSummaryScrollTimeoutRef.current = setTimeout(() => {
      const maxScrollLeft = Math.max(0, viewport.scrollWidth - viewport.clientWidth);
      if (maxScrollLeft <= 0) return;

      const nextIndex = Math.round((viewport.scrollLeft / maxScrollLeft) * registerSummaryMaxIndex);
      setRegisterSummaryStartIndex((currentIndex) => (currentIndex === nextIndex ? currentIndex : nextIndex));
    }, 120);
  }

  function handleRegisterValueVatModeChange(nextMode: 'excluded' | 'included') {
    setRegisterValueVatMode(nextMode);
    setAssetValueVatModes({});
  }

  function handleAssetValueVatToggle(assetId: string) {
    setAssetValueVatModes((currentModes) => {
      const currentMode = currentModes[assetId] ?? registerValueVatMode;

      return {
        ...currentModes,
        [assetId]: currentMode === 'included' ? 'excluded' : 'included',
      };
    });
  }

  function applyAssetGroups(nextGroups: AssetGroup[]) {
    setAssetGroups(nextGroups);
    const nextRegisterValue = registerValueForAssets(
      assets,
      projectAssetGroupsToAssets(nextGroups, assets),
    );

    setActiveRegister((current) => (
      current && current.id !== COMBINED_REGISTER_ID
        ? { ...current, totalValue: nextRegisterValue }
        : current
    ));
    setAssetRegisters((current) => current.map((register) => (
      register.id === activeRegister?.id
        ? { ...register, totalValue: nextRegisterValue }
        : register
    )));
  }

  function openAssetGroupManager(asset: RegisterAsset) {
    if (!canManageAssetGroups) {
      setNotice({
        tone: 'warning',
        message: 'This shared Asset Register is read-only.',
      });
      return;
    }

    const group = allAssetGroupMemberships.get(asset.id)?.group ?? null;
    if (group && group.registerId === null && !isCombinedRegisterView) {
      window.location.assign('/asset-register?scope=combined');
      return;
    }
    setIsAssetGroupModalOpen(true);
    setAssetGroupModalAsset(asset);
    setAssetGroupModalGroup(group);
    setAssetGroupError('');
  }

  function openCreateAssetGroupManager() {
    if (!canManageAssetGroups) {
      setNotice({
        tone: 'warning',
        message: 'This shared Asset Register is read-only.',
      });
      return;
    }

    setIsAssetGroupModalOpen(true);
    setAssetGroupModalAsset(null);
    setAssetGroupModalGroup(null);
    setAssetGroupError('');
  }

  function closeAssetGroupManager() {
    if (isSavingAssetGroup) return;
    setIsAssetGroupModalOpen(false);
    setAssetGroupModalAsset(null);
    setAssetGroupModalGroup(null);
    setAssetGroupError('');
  }

  function toggleAssetGroupCollapsed(groupId: string) {
    const willExpand = !expandedAssetGroupIds.has(groupId);
    const nextExpandedGroupIds = willExpand ? new Set([groupId]) : new Set<string>();
    if (willExpand) setExpandedAssetId(null);
    setExpandedAssetGroupIds(nextExpandedGroupIds);
  }

  async function handleSaveAssetGroup(input: AssetGroupSaveInput) {
    if (isSavingAssetGroup) return;

    setIsSavingAssetGroup(true);
    setAssetGroupError('');

    try {
      const combinedScope = isCombinedRegisterView;
      const payload: AssetGroupSaveInput = {
        ...input,
        registerId: combinedScope ? null : input.registerId,
        scope: combinedScope ? 'combined' : 'register',
      };
      const response = await fetch(buildAssetGroupsApiUrl(accountantShareId, undefined, combinedScope), {
        method: input.groupId ? 'PUT' : 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await response.json() as AssetGroupApiResponse;

      if (!response.ok || !data.ok) {
        throw new Error(data.error ?? 'Failed to save the umbrella.');
      }

      const nextGroups = Array.isArray(data.groups) ? data.groups : assetGroups;
      applyAssetGroups(nextGroups);
      setExpandedAssetGroupIds((current) => {
        const next = new Set(current);
        if (data.group?.id) next.delete(data.group.id);
        return next;
      });
      setIsAssetGroupModalOpen(false);
      setAssetGroupModalAsset(null);
      setAssetGroupModalGroup(null);
      setNotice({
        tone: 'success',
        message: input.groupId ? 'Umbrella updated.' : 'Umbrella created.',
      });
    } catch (error) {
      setAssetGroupError(error instanceof Error ? error.message : 'Failed to save the umbrella.');
    } finally {
      setIsSavingAssetGroup(false);
    }
  }

  function canDropAssetIntoGroup(assetId: string | null, targetGroup: AssetGroup): boolean {
    if (!assetId || !canManageAssetGroups || isSavingAssetGroup) return false;
    const persistedTargetGroup = assetGroups.find((group) => group.id === targetGroup.id) ?? targetGroup;
    if (persistedTargetGroup.members.some((member) => member.assetId === assetId)) return false;

    const asset = assets.find((entry) => entry.id === assetId);
    if (!asset || !String(asset.registerId ?? '').trim()) return false;
    return isCombinedRegisterView
      || targetGroup.registerId === null
      || String(asset.registerId ?? '').trim() === targetGroup.registerId;
  }

  function handleAssetDragStart(event: ReactDragEvent<HTMLDivElement>, asset: RegisterAsset) {
    const target = event.target as HTMLElement;

    if (
      !canManageAssetGroups
      || isSavingAssetGroup
      || target.closest('button, a, input, select, textarea, [role="button"]')
    ) {
      event.preventDefault();
      return;
    }

    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData(ASSET_GROUP_DRAG_DATA_TYPE, asset.id);
    event.dataTransfer.setData('text/plain', asset.id);
    setDraggingAssetId(asset.id);
    setAssetGroupDropTargetId(null);
  }

  function handleAssetDragEnd() {
    setDraggingAssetId(null);
    setAssetGroupDropTargetId(null);
  }

  function handleAssetGroupDragOver(event: ReactDragEvent<HTMLDivElement>, targetGroup: AssetGroup) {
    if (!canDropAssetIntoGroup(draggingAssetId, targetGroup)) return;

    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    if (assetGroupDropTargetId !== targetGroup.id) {
      setAssetGroupDropTargetId(targetGroup.id);
    }
  }

  function handleAssetGroupDragLeave(event: ReactDragEvent<HTMLDivElement>, targetGroup: AssetGroup) {
    const nextTarget = event.relatedTarget as Node | null;
    if (nextTarget && event.currentTarget.contains(nextTarget)) return;
    if (assetGroupDropTargetId === targetGroup.id) setAssetGroupDropTargetId(null);
  }

  async function handleAssetGroupDrop(event: ReactDragEvent<HTMLDivElement>, targetGroup: AssetGroup) {
    event.preventDefault();
    const assetId = event.dataTransfer.getData(ASSET_GROUP_DRAG_DATA_TYPE)
      || event.dataTransfer.getData('text/plain')
      || draggingAssetId
      || '';

    setDraggingAssetId(null);
    setAssetGroupDropTargetId(null);
    if (!canDropAssetIntoGroup(assetId, targetGroup)) return;

    const asset = assets.find((entry) => entry.id === assetId);
    const sourceGroup = allAssetGroupMemberships.get(assetId)?.group ?? null;
    if (!asset) return;

    setIsSavingAssetGroup(true);
    setAssetGroupError('');

    try {
      const combinedScope = isCombinedRegisterView || targetGroup.registerId === null;
      const response = await fetch(buildAssetGroupsApiUrl(accountantShareId, undefined, combinedScope), {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assetId,
          targetGroupId: targetGroup.id,
          registerId: combinedScope ? null : targetGroup.registerId,
          scope: combinedScope ? 'combined' : 'register',
        }),
      });
      const data = await response.json() as AssetGroupApiResponse;

      if (!response.ok || !data.ok) {
        throw new Error(data.error ?? 'The asset could not be added to this group.');
      }

      applyAssetGroups(Array.isArray(data.groups) ? data.groups : assetGroups);
      setExpandedAssetGroupIds((current) => {
        const next = new Set(current);
        next.delete(targetGroup.id);
        if (sourceGroup) next.delete(sourceGroup.id);
        return next;
      });
      setNotice({
        tone: 'success',
        message: sourceGroup
          ? `${asset.title} moved to ${targetGroup.name}.`
          : `${asset.title} added to ${targetGroup.name}.`,
      });
    } catch (error) {
      setNotice({
        tone: 'error',
        message: error instanceof Error ? error.message : 'The asset could not be added to this group.',
      });
    } finally {
      setIsSavingAssetGroup(false);
    }
  }

  async function handleDeleteAssetGroup(group: AssetGroup) {
    if (isSavingAssetGroup) return;
    if (!window.confirm(`Remove “${group.name}”? The assets and their records will not be deleted.`)) return;

    setIsSavingAssetGroup(true);
    setAssetGroupError('');

    try {
      const response = await fetch(buildAssetGroupsApiUrl(
        accountantShareId,
        group.id,
        isCombinedRegisterView || group.registerId === null,
      ), {
        method: 'DELETE',
        credentials: 'include',
      });
      const data = await response.json() as AssetGroupApiResponse;

      if (!response.ok || !data.ok) {
        throw new Error(data.error ?? 'Failed to remove the umbrella.');
      }

      applyAssetGroups(Array.isArray(data.groups) ? data.groups : []);
      setExpandedAssetGroupIds((current) => {
        const next = new Set(current);
        next.delete(group.id);
        return next;
      });
      setIsAssetGroupModalOpen(false);
      setAssetGroupModalAsset(null);
      setAssetGroupModalGroup(null);
      setNotice({ tone: 'success', message: 'Asset group removed. No assets were deleted.' });
    } catch (error) {
      setAssetGroupError(error instanceof Error ? error.message : 'Failed to remove the umbrella.');
    } finally {
      setIsSavingAssetGroup(false);
    }
  }

  async function handleAssetFlagToggle(asset: RegisterAsset): Promise<void> {
    if (busyFlagAssetId === asset.id) return;

    const nextIsFlagged = !isAssetFlagged(asset);
    const timestampIso = new Date().toISOString();
    const optimisticAsset = withAssetFlagState(asset, nextIsFlagged, timestampIso);
    const previousPage = currentPage;
    let previousAssetsSnapshot: RegisterAsset[] | null = null;

    setNotice(null);
    setBusyFlagAssetId(asset.id);
    setAssets((currentAssets) => {
      previousAssetsSnapshot = currentAssets;

      if (nextIsFlagged) {
        return [optimisticAsset, ...currentAssets.filter((currentAsset) => currentAsset.id !== asset.id)];
      }

      return currentAssets.map((currentAsset) => (currentAsset.id === asset.id ? optimisticAsset : currentAsset));
    });

    if (nextIsFlagged) {
      setCurrentPage(1);
    }

    try {
      const response = await fetch(accountantShareId
        ? `/api/accountant/registers/${encodeURIComponent(accountantShareId)}/assets/${encodeURIComponent(asset.id)}/flag`
        : '/api/asset-register', {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assetId: asset.id,
          assetFlagged: nextIsFlagged,
          isFlagged: nextIsFlagged,
        }),
      });

      const data = (await response.json()) as AssetRegisterApiResponse;

      if (!response.ok || !data.ok || !data.item) {
        throw new Error(data.error ?? 'Failed to update asset flag.');
      }

      if (nextIsFlagged) {
        syncUpdatedAsset(data.item);
      } else {
        syncMediaUpdatedAsset(data.item);
      }

      setNotice({
        tone: 'success',
        message: nextIsFlagged ? `${asset.title} flagged and moved to the top.` : `${asset.title} unflagged.`,
      });
    } catch (error) {
      if (previousAssetsSnapshot) {
        setAssets(previousAssetsSnapshot);
      }
      setCurrentPage(previousPage);
      setNotice({
        tone: 'error',
        message: error instanceof Error ? error.message : 'Failed to update asset flag.',
      });
    } finally {
      setBusyFlagAssetId(null);
    }
  }

  function openAccountantNoteModal(asset: RegisterAsset): void {
    setNotice(null);
    setAccountantNoteAsset(asset);
    setAccountantNoteDraft('');
  }

  function closeAccountantNoteModal(): void {
    if (isSavingAccountantNote) return;
    setAccountantNoteAsset(null);
    setAccountantNoteDraft('');
  }

  async function submitAccountantNote(): Promise<void> {
    if (!accountantShareId || !accountantNoteAsset || isSavingAccountantNote) return;

    const noteText = accountantNoteDraft.trim();
    if (!noteText) {
      setNotice({ tone: 'error', message: 'Write a note before saving.' });
      return;
    }

    setNotice(null);
    setIsSavingAccountantNote(true);

    try {
      const response = await fetch(
        `/api/accountant/registers/${encodeURIComponent(accountantShareId)}/assets/${encodeURIComponent(accountantNoteAsset.id)}/notes`,
        {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ note: noteText }),
        },
      );
      const data = (await response.json()) as AccountantNoteApiResponse;

      if (!response.ok || !data.ok || !data.note) {
        throw new Error(data.error ?? 'Failed to save note.');
      }

      const savedNote = data.note;
      setAssets((currentAssets) => currentAssets.map((asset) => {
        if (asset.id !== accountantNoteAsset.id) return asset;
        const existingNotes = Array.isArray(asset.partnerNotes)
          ? asset.partnerNotes.filter((note) => note.id !== savedNote.id)
          : [];
        return { ...asset, openPartnerNote: savedNote, partnerNotes: [savedNote, ...existingNotes] };
      }));
      setAccountantNoteAsset(null);
      setAccountantNoteDraft('');
      setNotice({ tone: 'success', message: `Note saved on ${accountantNoteAsset.title}.` });
    } catch (error) {
      setNotice({ tone: 'error', message: error instanceof Error ? error.message : 'Failed to save note.' });
    } finally {
      setIsSavingAccountantNote(false);
    }
  }

  function rememberDocumentObjectUrl(cacheKey: string, objectUrl: string): string {
    const existingEntry = documentObjectUrlsRef.current.get(cacheKey);

    if (existingEntry) {
      URL.revokeObjectURL(existingEntry.objectUrl);

      if (existingEntry.timeoutId !== null) {
        window.clearTimeout(existingEntry.timeoutId);
      }
    }

    const timeoutId = window.setTimeout(() => {
      const currentEntry = documentObjectUrlsRef.current.get(cacheKey);

      if (currentEntry?.objectUrl === objectUrl) {
        URL.revokeObjectURL(objectUrl);
        documentObjectUrlsRef.current.delete(cacheKey);
      }
    }, DOCUMENT_OBJECT_URL_TTL_MS);

    documentObjectUrlsRef.current.set(cacheKey, { objectUrl, timeoutId });
    return objectUrl;
  }

  async function openAssetDocument(document: AssetDocument): Promise<void> {
    const documentUrl = String(document.url ?? '').trim();

    if (!documentUrl) {
      setNotice({ tone: 'error', message: 'This document does not have a saved file link.' });
      return;
    }

    if (!isDataDocumentUrl(documentUrl)) {
      window.open(documentUrl, '_blank', 'noopener,noreferrer');
      return;
    }

    const cacheKey = document.id || `${document.fileName}-${document.byteSize}-${documentUrl.length}`;
    const cachedEntry = documentObjectUrlsRef.current.get(cacheKey);

    if (cachedEntry?.objectUrl) {
      window.open(cachedEntry.objectUrl, '_blank', 'noopener,noreferrer');
      return;
    }

    const targetWindow = window.open('about:blank', '_blank');

    if (!targetWindow) {
      setNotice({ tone: 'error', message: 'Your browser blocked the document tab. Allow pop-ups and try opening it again.' });
      return;
    }

    try {
      targetWindow.opener = null;
    } catch {
      // Ignore browsers that prevent changing opener.
    }

    writeDocumentOpeningPage(targetWindow, document.fileName);

    try {
      const objectUrl = rememberDocumentObjectUrl(cacheKey, await createDataDocumentObjectUrl(documentUrl));
      targetWindow.location.href = objectUrl;
    } catch (error) {
      try {
        targetWindow.close();
      } catch {
        // Ignore close failures.
      }

      console.error('asset document open failed', error);
      setNotice({ tone: 'error', message: 'The saved document could not be opened. Please remove and upload it again.' });
    }
  }
  const projectionRequestRef = useRef(0);
  const projectionResultRef = useRef<HTMLElement | null>(null);
  const [shouldScrollToProjectionResult, setShouldScrollToProjectionResult] = useState(false);
  const projectionYearOptions = useMemo(() => {
    const currentYear = new Date().getFullYear();
    return Array.from({ length: 16 }, (_, index) => currentYear + index);
  }, []);
  const projectionYearSelectOptions = useMemo<Array<ModalSelectOption<string>>>(
    () => projectionYearOptions.map((year) => ({ value: String(year), label: String(year) })),
    [projectionYearOptions],
  );
  const assetReportYearOptions = useMemo<ReportSelectOption[]>(() => {
    return [
      { value: 'all', label: 'All years' },
      ...getAssetFuelReportYearValues(activeAsset).map((year) => ({ value: year, label: year })),
    ];
  }, [activeAsset]);
  const assetReportMonthOptions = useMemo<ReportSelectOption[]>(() => {
    return [
      { value: 'all', label: 'All months' },
      ...MONTH_LABELS.map((label, index) => ({ value: String(index + 1).padStart(2, '0'), label })),
    ];
  }, []);
  const assetMaintenanceReportTypeOptions = useMemo<ReportSelectOption[]>(() => {
    return [
      { value: 'all', label: 'All' },
      { value: 'checked', label: 'Checked' },
      { value: 'serviced', label: 'Service' },
      { value: 'repaired', label: 'Repair' },
    ];
  }, []);
  const reportProfile = useMemo(
    () => mergeProfileWithRegister(accountProfile, activeRegister),
    [accountProfile, activeRegister],
  );
  const combinedRegisterSwitcherOption = useMemo<AssetRegisterSummary | null>(() => {
    const savedRegisters = assetRegisters.filter((register) => register.id !== COMBINED_REGISTER_ID);

    if (!savedRegisters.length) {
      return activeRegister?.id === COMBINED_REGISTER_ID ? activeRegister : null;
    }

    const newestUpdatedAt = savedRegisters.reduce(
      (latest, register) => register.updatedAtIso > latest ? register.updatedAtIso : latest,
      savedRegisters[0]?.updatedAtIso ?? new Date(0).toISOString(),
    );

    return {
      id: COMBINED_REGISTER_ID,
      userId: savedRegisters[0]?.userId ?? '',
      businessName: 'Combined Asset Registers',
      email: '',
      phone: '',
      addressLine1: 'All asset registers on this account',
      logoUrls: [],
      showLogosOnRegister: false,
      isPrimary: false,
      isSelected: false,
      assetCount: savedRegisters.reduce((sum, register) => sum + Math.max(0, Number(register.assetCount) || 0), 0),
      totalValue: savedRegisters.reduce((sum, register) => sum + (Number(register.totalValue) || 0), 0),
      totalReplacementPrice: savedRegisters.reduce((sum, register) => sum + (Number(register.totalReplacementPrice) || 0), 0),
      unnotedAlertCount: savedRegisters.reduce((sum, register) => sum + registerSummaryUnnotedAlertCount(register), 0),
      createdAtIso: savedRegisters[0]?.createdAtIso ?? newestUpdatedAt,
      updatedAtIso: newestUpdatedAt,
    };
  }, [activeRegister, assetRegisters]);
  const registerSwitcherOptions = useMemo(() => {
    const registersById = new Map<string, AssetRegisterSummary>();

    assetRegisters.forEach((register) => {
      if (register.id) registersById.set(register.id, register);
    });

    if (activeRegister?.id && !registersById.has(activeRegister.id)) {
      registersById.set(activeRegister.id, activeRegister);
    }

    if (combinedRegisterSwitcherOption) {
      registersById.set(COMBINED_REGISTER_ID, combinedRegisterSwitcherOption);
    }

    return Array.from(registersById.values()).sort((left, right) => {
      if (left.id === COMBINED_REGISTER_ID) return -1;
      if (right.id === COMBINED_REGISTER_ID) return 1;
      if (left.id === activeRegister?.id) return -1;
      if (right.id === activeRegister?.id) return 1;
      if (left.isSelected && !right.isSelected) return -1;
      if (!left.isSelected && right.isSelected) return 1;
      return left.businessName.localeCompare(right.businessName);
    });
  }, [activeRegister, assetRegisters, combinedRegisterSwitcherOption]);
  const visibleRegisterSwitcherOptions = useMemo(() => {
    const query = registerSwitcherSearchTerm.trim().toLowerCase();

    if (!query) {
      return registerSwitcherOptions;
    }

    return registerSwitcherOptions.filter((register) => [
      register.businessName,
      register.addressLine1,
      register.email,
      register.phone,
      String(register.assetCount),
    ].some((value) => String(value ?? '').toLowerCase().includes(query)));
  }, [registerSwitcherOptions, registerSwitcherSearchTerm]);
  const canOpenRegisterSwitcher = isAccountantWorkspace
    ? registerSwitcherOptions.length > 0
    : registerSwitcherOptions.length > 1;
  const isCombinedRegisterView = activeRegister?.id === COMBINED_REGISTER_ID || activeRegisterId === COMBINED_REGISTER_ID;
  const canUseOwnerOnlyAssetActions = !isAccountantWorkspace;
  const canManageRegisterStructure = canUseOwnerOnlyAssetActions || isAccountantWorkspace;
  const canManageAssetGroups =
    canUseOwnerOnlyAssetActions
    || (!isCombinedRegisterView && Boolean(accountantAccess?.allowDirectUpdates));
  const activeRegisterUnnotedAlertCount = useMemo(() => assetListUnnotedAlertCount(assets), [assets]);
  const registerUnnotedAlertCounts = useMemo(() => {
    const countsByRegisterId = new Map<string, number>();

    registerSwitcherOptions.forEach((register) => {
      if (register.id && register.id !== COMBINED_REGISTER_ID) {
        countsByRegisterId.set(register.id, registerSummaryUnnotedAlertCount(register));
      }
    });

    const activeId = String(activeRegister?.id || activeRegisterId || '').trim();
    if (activeId && activeId !== COMBINED_REGISTER_ID) {
      countsByRegisterId.set(activeId, activeRegisterUnnotedAlertCount);
    }

    return countsByRegisterId;
  }, [activeRegister?.id, activeRegisterId, activeRegisterUnnotedAlertCount, registerSwitcherOptions]);
  const totalRegisterUnnotedAlertCount = useMemo(
    () => Array.from(registerUnnotedAlertCounts.values()).reduce((sum, count) => sum + count, 0),
    [registerUnnotedAlertCounts],
  );
  const assetRegisterMoveSourceId = String(
    assetRegisterMoveAsset?.registerId
      || activeRegister?.id
      || activeRegisterId
      || '',
  ).trim();
  const assetRegisterMoveTargets = useMemo(
    () => assetRegisters.filter((register) => (
      register.id !== COMBINED_REGISTER_ID
      && register.id !== assetRegisterMoveSourceId
    )),
    [assetRegisterMoveSourceId, assetRegisters],
  );
  const assetRegisterMoveTargetOptions = useMemo<Array<ModalSelectOption<string>>>(
    () => assetRegisterMoveTargets.map((register) => ({
      value: register.id,
      label: register.businessName || 'Asset Register',
      description: `${Math.max(0, Math.round(Number(register.assetCount) || 0)).toLocaleString('en-ZA')} ${Number(register.assetCount) === 1 ? 'asset' : 'assets'} · ${money(Number(register.totalValue) || 0)} current value`,
    })),
    [assetRegisterMoveTargets],
  );
  const assetRegisterMoveGroupTargets = useMemo(() => {
    const assetId = assetRegisterMoveAsset?.id ?? '';

    return assetRegisterMoveGroups
      .filter((group) => (
        !group.members.some((member) => member.assetId === assetId)
        && (!isAccountantWorkspace || group.registerId === assetRegisterMoveSourceId)
      ))
      .sort((left, right) => left.name.localeCompare(right.name, 'en-ZA'));
  }, [assetRegisterMoveAsset?.id, assetRegisterMoveGroups, assetRegisterMoveSourceId, isAccountantWorkspace]);
  const assetRegisterMoveGroupOptions = useMemo<Array<ModalSelectOption<string>>>(
    () => assetRegisterMoveGroupTargets.map((group) => {
      const registerName = group.registerId
        ? assetRegisters.find((register) => register.id === group.registerId)?.businessName || 'Asset Register'
        : '';
      const scopeDescription = group.registerId === null
        ? 'Combined umbrella'
        : group.registerId === assetRegisterMoveSourceId
          ? registerName
          : `${registerName} · becomes a combined umbrella`;

      return {
        value: group.id,
        label: group.name,
        description: `${group.members.length} grouped ${group.members.length === 1 ? 'asset' : 'assets'} · ${scopeDescription} · ${assetGroupValueModeLabel(group)}`,
      };
    }),
    [assetRegisterMoveGroupTargets, assetRegisterMoveSourceId, assetRegisters],
  );
  const canUseAccountantDocumentActions = isAccountantWorkspace && Boolean(accountantAccess?.allowDirectUpdates);
  const canShareActiveRegister = canUseOwnerOnlyAssetActions;
  const canAddAssetsToActiveRegister = canUseOwnerOnlyAssetActions
    || (!isCombinedRegisterView && Boolean(accountantAccess?.allowDirectUpdates));
  const addAssetRegisterOptions = useMemo<Array<ModalSelectOption<string>>>(
    () => assetRegisters
      .filter((register) => register.id && register.id !== COMBINED_REGISTER_ID)
      .map((register) => ({
        value: register.id,
        label: register.businessName || 'Asset Register',
        description: `${Math.max(0, Math.round(Number(register.assetCount) || 0)).toLocaleString('en-ZA')} ${Number(register.assetCount) === 1 ? 'asset' : 'assets'} · ${money(Number(register.totalValue) || 0)} current value`,
      })),
    [assetRegisters],
  );
  const canUseMarketplaceActions = !isAccountantWorkspace;
  const isQuoteModalOpen = Boolean(quoteAsset);
  const isFullRegisterQuoteLead = quoteScope === 'register';
  const addAssetValuationHref = (() => {
    const params = new URLSearchParams();
    if (isAccountantWorkspace && accountantShareId) params.set('accountantShareId', accountantShareId);
    const targetRegisterId = String(
      addAssetTargetRegisterId
      || (!isCombinedRegisterView ? activeRegister?.id || activeRegisterId : '')
      || (isAccountantWorkspace ? accountantAccess?.registerId : '')
      || '',
    ).trim();
    if (targetRegisterId && targetRegisterId !== COMBINED_REGISTER_ID) {
      params.set('registerId', targetRegisterId);
    }

    const query = params.toString();
    return query ? `/valuation?${query}` : '/valuation';
  })();
  const activeRegisterShareName = isCombinedRegisterView
    ? buildCombinedAssetRegisterShareName(accountProfile, assetRegisters)
    : activeRegister?.businessName || buildOwnerName(accountProfile);
  const assetGroupShareAssets = useMemo(() => {
    if (!assetGroupShareTarget) return [];
    const memberAssetIds = new Set(assetGroupShareTarget.members.map((member) => member.assetId));
    return orderAssetsByGroups(
      assets.filter((asset) => memberAssetIds.has(asset.id)),
      [assetGroupShareTarget],
    );
  }, [assetGroupShareTarget, assets]);
  const activeShareAssets = assetGroupShareTarget ? assetGroupShareAssets : assets;
  const activeShareGroups = useMemo(
    () => projectAssetGroupsToAssets(assetGroups, activeShareAssets),
    [activeShareAssets, assetGroups],
  );
  const activeShareValue = useMemo(
    () => sumAssetValues(activeShareAssets, activeShareGroups),
    [activeShareAssets, activeShareGroups],
  );
  const activeShareName = assetGroupShareTarget?.name || activeRegisterShareName;
  const isAssetGroupShare = Boolean(assetGroupShareTarget);
  const activeExternalShareAssets = useMemo(
    () => activeShareAssets.map(buildExternalShareAsset),
    [activeShareAssets],
  );
  const quoteExternalShareAssets = useMemo(
    () => quoteAsset ? [buildExternalShareAsset(quoteAsset)] : [],
    [quoteAsset],
  );

  const selectedQuoteOption = useMemo(() => quoteOptionForLeadType(selectedQuoteLeadType), [selectedQuoteLeadType]);
  const availableAssetQuoteOptions = useMemo(
    () => (
      quoteAsset?.kind === 'property'
        ? ASSET_QUOTE_OPTIONS.filter((option) => option.leadType !== 'replacement_quote')
        : ASSET_QUOTE_OPTIONS
    ),
    [quoteAsset?.kind],
  );
  const selectedQuotePartners = useMemo(() => {
    const selectedIds = new Set(selectedQuotePartnerIds);
    return quotePartners.filter((partner) => selectedIds.has(partner.userId));
  }, [quotePartners, selectedQuotePartnerIds]);
  const selectedQuotePartner = selectedQuotePartners[0] ?? null;
  const hasManagedAssistanceSelection = selectedQuotePartners.some((partner) => partner.isAim4priceManaged);
  const selectedQuotePartnerWebsiteHref = selectedQuotePartner ? normalizeWebsiteHref(selectedQuotePartner.websiteUrl) : '';
  const selectedQuotePartnerEmailHref = selectedQuotePartner ? normalizeEmailHref(selectedQuotePartner.email) : '';
  const selectedQuotePartnerPhoneHref = selectedQuotePartner ? normalizePhoneHref(selectedQuotePartner.phone) : '';
  const quotePartnersWithCoordinates = useMemo(() => quotePartners.filter(hasQuotePartnerCoordinates), [quotePartners]);

  useEffect(() => {
    selectedQuoteLeadTypeRef.current = selectedQuoteLeadType;
    quotePartnerSearchRef.current = quotePartnerSearch;
  }, [quotePartnerSearch, selectedQuoteLeadType]);

  useEffect(() => {
    pendingPhotoFilesRef.current = pendingPhotoFiles;
  }, [pendingPhotoFiles]);

  useEffect(() => {
    return () => {
      pendingPhotoFilesRef.current.forEach((entry) => revokePhotoPreviewUrl(entry.previewUrl));
      pendingPhotoFilesRef.current = [];
    };
  }, []);

  function getDetailPhotos(asset: RegisterAsset): string[] {
    return normalizePhotos(asset.photos);
  }

  function getDetailPhotoIndex(asset: RegisterAsset): number {
    const photos = getDetailPhotos(asset);
    const currentIndex = detailPhotoIndexByAsset[asset.id] ?? 0;
    return Math.max(0, Math.min(currentIndex, photos.length - 1));
  }

  function setDetailPhotoIndex(assetId: string, nextIndex: number) {
    setDetailPhotoIndexByAsset((current) => ({
      ...current,
      [assetId]: Math.max(0, nextIndex),
    }));
  }

  function cycleDetailPhoto(asset: RegisterAsset, direction: 1 | -1) {
    const photos = getDetailPhotos(asset);
    if (!photos.length) return;

    const currentIndex = getDetailPhotoIndex(asset);
    const nextIndex = (currentIndex + direction + photos.length) % photos.length;
    setDetailPhotoIndex(asset.id, nextIndex);
  }

  function openPhotoViewer(asset: RegisterAsset, requestedIndex: number) {
    const photos = getDetailPhotos(asset);
    if (!photos.length) return;

    const safeIndex = Math.max(0, Math.min(requestedIndex, photos.length - 1));
    setDetailPhotoIndex(asset.id, safeIndex);
    setPhotoViewer({ assetId: asset.id, index: safeIndex });
  }

  function closePhotoViewer() {
    setPhotoViewer(null);
  }

  function cyclePhotoViewerPhoto(direction: 1 | -1) {
    if (!photoViewer) return;

    const asset = assets.find((candidate) => candidate.id === photoViewer.assetId);
    if (!asset) {
      setPhotoViewer(null);
      return;
    }

    const photos = getDetailPhotos(asset);
    if (!photos.length) {
      setPhotoViewer(null);
      return;
    }

    const currentIndex = Math.max(0, Math.min(photoViewer.index, photos.length - 1));
    const nextIndex = (currentIndex + direction + photos.length) % photos.length;
    setDetailPhotoIndex(asset.id, nextIndex);
    setPhotoViewer({ assetId: asset.id, index: nextIndex });
  }

  const photoViewerAsset = photoViewer ? assets.find((asset) => asset.id === photoViewer.assetId) ?? null : null;
  const photoViewerPhotos = photoViewerAsset ? getDetailPhotos(photoViewerAsset) : [];
  const photoViewerIndex = photoViewerPhotos.length ? Math.max(0, Math.min(photoViewer?.index ?? 0, photoViewerPhotos.length - 1)) : 0;
  const photoViewerPhoto = photoViewerPhotos[photoViewerIndex] ?? '';
  const hasMultiplePhotoViewerPhotos = photoViewerPhotos.length > 1;

  function handleDetailPhotoTouchStart(clientX: number) {
    detailTouchStartXRef.current = clientX;
    detailTouchDidSwipeRef.current = false;
  }

  function handleDetailPhotoTouchEnd(asset: RegisterAsset, clientX: number) {
    if (detailTouchStartXRef.current === null) return;
    const delta = clientX - detailTouchStartXRef.current;
    detailTouchStartXRef.current = null;

    if (Math.abs(delta) < 42) {
      return;
    }

    detailTouchDidSwipeRef.current = true;
    cycleDetailPhoto(asset, delta < 0 ? 1 : -1);

    window.setTimeout(() => {
      detailTouchDidSwipeRef.current = false;
    }, 280);
  }

  useEffect(() => {
    let mounted = true;

    async function loadAccountProfile() {
      try {
        const profileResponse = await fetch('/api/account-profile', {
          cache: 'no-store',
          credentials: 'include',
        });

        const profileData = (await profileResponse.json()) as AccountProfileApiResponse;

        if (mounted && profileResponse.ok && profileData.ok && profileData.profile) {
          setAccountProfile(profileData.profile);
        }
      } catch {
        // The register data is the important path here. Profile data can fail without blocking the page.
      }
    }

    async function loadAssetRegister() {
      setIsLoading(true);
      setActiveRegister(null);
      setAssets([]);
      setAssetGroups([]);

      try {
        const requestedRegisterId = readRegisterIdFromLocation();
        setActiveRegisterId(requestedRegisterId);
        if (!isAccountantWorkspace) void loadAccountProfile();

        const accountantRegisterQuery = requestedRegisterId === COMBINED_REGISTER_ID
          ? '?scope=combined'
          : requestedRegisterId
            ? `?registerId=${encodeURIComponent(requestedRegisterId)}`
            : '';
        const registerUrl = accountantShareId
          ? `/api/accountant/registers/${encodeURIComponent(accountantShareId)}${accountantRegisterQuery}`
          : buildAssetRegisterApiUrl(requestedRegisterId);
        const assetsResponse = await fetch(registerUrl, {
          cache: 'no-store',
          credentials: 'include',
        });

        const assetsData = (await assetsResponse.json()) as AssetRegisterApiResponse;

        if (!assetsResponse.ok || !assetsData.ok) {
          throw new Error(assetsData.error ?? 'Failed to load asset register.');
        }

        if (!mounted) return;

        const loadedAssets = Array.isArray(assetsData.items)
          ? assetsData.items
          : Array.isArray(assetsData.assets)
            ? assetsData.assets
            : [];

        setAssets(loadedAssets);
        setAssetGroups(Array.isArray(assetsData.groups) ? assetsData.groups : []);

        if (assetsData.profile) {
          setAccountProfile(assetsData.profile);
        }

        setAccountantAccess(assetsData.access ?? null);
        if (assetsData.register) {
          setActiveRegister(assetsData.register);
          setActiveRegisterId(assetsData.register.id);
        } else {
          setActiveRegister(null);
        }

        if (Array.isArray(assetsData.registers)) {
          setAssetRegisters(assetsData.registers);
        }

      } catch (error) {
        if (!mounted) return;

        setNotice({
          tone: 'error',
          message: error instanceof Error ? error.message : 'Failed to load your asset register.',
        });
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    }

    void loadAssetRegister();
    window.addEventListener('aim4price:asset-register-updated', loadAssetRegister);

    return () => {
      mounted = false;
      window.removeEventListener('aim4price:asset-register-updated', loadAssetRegister);
    };
  }, [accountantShareId, isAccountantWorkspace]);

  useEffect(() => {
    if (!isAccountantWorkspace || isLoading || !registerSwitcherOptions.length) return;
    const params = new URLSearchParams(window.location.search);
    if (params.get('changeRegister') !== '1') return;

    setRegisterSwitcherSearchTerm('');
    setIsChangeRegisterModalOpen(true);
    params.delete('changeRegister');
    const query = params.toString();
    window.history.replaceState(null, '', `${window.location.pathname}${query ? `?${query}` : ''}`);
  }, [isAccountantWorkspace, isLoading, registerSwitcherOptions.length]);

  useEffect(() => {
    if (!isAccountantWorkspace) return;
    const openRegisterChange = () => openChangeRegisterModal();
    window.addEventListener('aim4price:open-register-change', openRegisterChange);
    return () => window.removeEventListener('aim4price:open-register-change', openRegisterChange);
  });

  useEffect(() => {
    if (!notice) return undefined;

    const timeout = window.setTimeout(() => setNotice(null), 3600);
    return () => window.clearTimeout(timeout);
  }, [notice]);

  async function handleRefreshAssetRegister() {
    if (isLoading || isRefreshingRegister) return;

    setIsRefreshingRegister(true);

    try {
      const requestedRegisterId = readRegisterIdFromLocation() || activeRegister?.id || activeRegisterId;
      const accountantRegisterQuery = requestedRegisterId === COMBINED_REGISTER_ID
        ? '?scope=combined'
        : requestedRegisterId
          ? `?registerId=${encodeURIComponent(requestedRegisterId)}`
          : '';
      const registerUrl = accountantShareId
        ? `/api/accountant/registers/${encodeURIComponent(accountantShareId)}${accountantRegisterQuery}`
        : buildAssetRegisterApiUrl(requestedRegisterId);
      const assetsResponse = await fetch(registerUrl, {
        cache: 'no-store',
        credentials: 'include',
      });

      const assetsData = (await assetsResponse.json()) as AssetRegisterApiResponse;

      if (!assetsResponse.ok || !assetsData.ok) {
        throw new Error(assetsData.error ?? 'Failed to refresh asset register.');
      }

      const loadedAssets = Array.isArray(assetsData.items)
        ? assetsData.items
        : Array.isArray(assetsData.assets)
          ? assetsData.assets
          : [];

      setAssets(loadedAssets);
      setAssetGroups(Array.isArray(assetsData.groups) ? assetsData.groups : []);

      if (assetsData.profile) {
        setAccountProfile(assetsData.profile);
      }

      setAccountantAccess(assetsData.access ?? null);

      if (assetsData.register) {
        setActiveRegister(assetsData.register);
        setActiveRegisterId(assetsData.register.id);
      } else {
        setActiveRegister(null);
        setActiveRegisterId(requestedRegisterId);
      }

      if (Array.isArray(assetsData.registers)) {
        setAssetRegisters(assetsData.registers);
      }

      setNotice({
        tone: 'success',
        message: 'Asset Register refreshed.',
      });
    } catch (error) {
      setNotice({
        tone: 'error',
        message: error instanceof Error ? error.message : 'Failed to refresh your asset register.',
      });
    } finally {
      setIsRefreshingRegister(false);
    }
  }

  function openChangeRegisterModal() {
    if (!canOpenRegisterSwitcher) {
      window.location.href = isAccountantWorkspace && accountantShareId
        ? `/accountant/registers/${encodeURIComponent(accountantShareId)}/manage`
        : '/asset-registers';
      return;
    }

    setNotice(null);
    setRegisterSwitcherSearchTerm('');
    setIsChangeRegisterModalOpen(true);
  }

  function closeChangeRegisterModal() {
    if (changingRegisterId) return;
    setIsChangeRegisterModalOpen(false);
  }

  async function handleChangeRegisterSelect(register: AssetRegisterSummary) {
    const nextRegisterId = String(register.id ?? '').trim();

    if (!nextRegisterId || changingRegisterId) return;

    if (nextRegisterId === activeRegister?.id || nextRegisterId === activeRegisterId) {
      closeChangeRegisterModal();
      return;
    }

    setChangingRegisterId(nextRegisterId);

    if (isAccountantWorkspace) {
      const workspaceRoot = `/accountant/registers/${encodeURIComponent(accountantShareId ?? '')}`;
      window.location.assign(nextRegisterId === COMBINED_REGISTER_ID
        ? `${workspaceRoot}?scope=combined`
        : `${workspaceRoot}?registerId=${encodeURIComponent(nextRegisterId)}`);
      return;
    }
    setNotice(null);

    if (nextRegisterId === COMBINED_REGISTER_ID) {
      window.location.assign('/asset-register?scope=combined');
      return;
    }

    try {
      const response = await fetch('/api/asset-registers', {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'select', registerId: nextRegisterId }),
      });

      const payload = (await response.json().catch(() => null)) as AssetRegisterApiResponse | null;

      if (!response.ok || !payload?.ok || !payload.register) {
        throw new Error(extractApiError(payload, 'Failed to change asset register.'));
      }

      if (Array.isArray(payload.registers)) {
        setAssetRegisters(payload.registers);
      }

      window.location.assign(`/asset-register?registerId=${encodeURIComponent(payload.register.id)}`);
    } catch (error) {
      setNotice({
        tone: 'error',
        message: error instanceof Error ? error.message : 'Failed to change asset register.',
      });
      setChangingRegisterId('');
    }
  }

  async function loadAssetRegisterMoveGroups(requestId: number) {
    if (!canManageAssetGroups) {
      setAssetRegisterMoveGroups([]);
      return;
    }

    if (isAccountantWorkspace) {
      setAssetRegisterMoveGroups(assetGroups);
      return;
    }

    setIsLoadingAssetRegisterMoveGroups(true);
    setAssetRegisterMoveGroupLoadError('');

    try {
      const response = await fetch(buildAssetGroupsApiUrl(undefined, undefined, true), {
        credentials: 'include',
      });
      const payload = await response.json() as AssetGroupApiResponse;

      if (!response.ok || !payload.ok) {
        throw new Error(payload.error ?? 'Umbrellas could not be loaded.');
      }

      if (assetRegisterMoveGroupsRequestRef.current !== requestId) return;
      setAssetRegisterMoveGroups(Array.isArray(payload.groups) ? payload.groups : []);
    } catch (error) {
      if (assetRegisterMoveGroupsRequestRef.current !== requestId) return;
      setAssetRegisterMoveGroupLoadError(
        error instanceof Error ? error.message : 'Umbrellas could not be loaded.',
      );
    } finally {
      if (assetRegisterMoveGroupsRequestRef.current === requestId) {
        setIsLoadingAssetRegisterMoveGroups(false);
      }
    }
  }

  function resetAssetRegisterMoveManager() {
    assetRegisterMoveGroupsRequestRef.current += 1;
    setAssetRegisterMoveAsset(null);
    setAssetRegisterMoveSearchTerm('');
    setAssetRegisterMoveDestination('register');
    setAssetRegisterMoveTargetId('');
    setAssetRegisterMoveGroups([]);
    setAssetRegisterMoveGroupLoadError('');
    setIsLoadingAssetRegisterMoveGroups(false);
    setAssetRegisterMoveError('');
  }

  function openAssetRegisterMoveManager(asset: RegisterAsset) {
    const requestId = assetRegisterMoveGroupsRequestRef.current + 1;
    assetRegisterMoveGroupsRequestRef.current = requestId;
    setNotice(null);
    setAssetRegisterMoveAsset(asset);
    setAssetRegisterMoveSearchTerm(asset.title);
    setAssetRegisterMoveDestination('register');
    setAssetRegisterMoveTargetId('');
    setAssetRegisterMoveGroups(assetGroups);
    setAssetRegisterMoveGroupLoadError('');
    setAssetRegisterMoveError('');
    void loadAssetRegisterMoveGroups(requestId);
  }

  function closeAssetRegisterMoveManager() {
    if (isMovingAssetRegister) return;
    resetAssetRegisterMoveManager();
  }

  async function handleMoveAssetRegister() {
    if (!assetRegisterMoveAsset || !assetRegisterMoveTargetId || isMovingAssetRegister) {
      if (!assetRegisterMoveTargetId) {
        setAssetRegisterMoveError(
          assetRegisterMoveDestination === 'umbrella'
            ? 'Choose the target umbrella first.'
            : 'Choose the target Asset Register first.',
        );
      }
      return;
    }

    if (assetRegisterMoveDestination === 'umbrella') {
      const targetGroup = assetRegisterMoveGroupTargets.find(
        (group) => group.id === assetRegisterMoveTargetId,
      ) ?? null;

      if (!canManageAssetGroups || !targetGroup) {
        setAssetRegisterMoveError('Choose an available umbrella first.');
        return;
      }

      const combinedScope = isCombinedRegisterView
        || targetGroup.registerId === null
        || targetGroup.registerId !== assetRegisterMoveSourceId;

      if (isAccountantWorkspace && combinedScope) {
        setAssetRegisterMoveError('This umbrella is not available in the current Asset Register.');
        return;
      }

      const sourceGroup = allAssetGroupMemberships.get(assetRegisterMoveAsset.id)?.group ?? null;
      const movedAssetTitle = assetRegisterMoveAsset.title;

      setIsMovingAssetRegister(true);
      setAssetRegisterMoveError('');

      try {
        const response = await fetch(buildAssetGroupsApiUrl(accountantShareId, undefined, combinedScope), {
          method: 'PATCH',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            assetId: assetRegisterMoveAsset.id,
            targetGroupId: targetGroup.id,
            registerId: combinedScope ? null : targetGroup.registerId,
            scope: combinedScope ? 'combined' : 'register',
          }),
        });
        const payload = await response.json() as AssetGroupApiResponse;

        if (!response.ok || !payload.ok) {
          throw new Error(payload.error ?? 'The asset could not be moved to this umbrella.');
        }

        applyAssetGroups(Array.isArray(payload.groups) ? payload.groups : assetRegisterMoveGroups);
        setExpandedAssetGroupIds((current) => {
          const next = new Set(current);
          next.delete(targetGroup.id);
          if (sourceGroup) next.delete(sourceGroup.id);
          return next;
        });
        resetAssetRegisterMoveManager();
        setNotice({
          tone: 'success',
          message: `${movedAssetTitle} moved to ${targetGroup.name}.`,
        });
        window.dispatchEvent(new CustomEvent('aim4price:asset-register-updated'));
      } catch (error) {
        setAssetRegisterMoveError(
          error instanceof Error ? error.message : 'The asset could not be moved to this umbrella.',
        );
      } finally {
        setIsMovingAssetRegister(false);
      }

      return;
    }

    const sourceRegisterId = assetRegisterMoveSourceId;
    const targetRegister = assetRegisterMoveTargets.find((register) => register.id === assetRegisterMoveTargetId) ?? null;
    const assetValue = Number(assetRegisterMoveAsset.value) || 0;
    const assetReplacementValue = readAssetReplacementPriceExVat(assetRegisterMoveAsset) ?? 0;

    setIsMovingAssetRegister(true);
    setAssetRegisterMoveError('');

    try {
      const moveUrl = isAccountantWorkspace && accountantShareId
        ? `/api/accountant/registers/${encodeURIComponent(accountantShareId)}/owner-registers/move-assets`
        : '/api/asset-registers/move-assets';
      const response = await fetch(moveUrl, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assetId: assetRegisterMoveAsset.id,
          targetRegisterId: assetRegisterMoveTargetId,
        }),
      });
      const payload = (await response.json().catch(() => null)) as AssetRegisterApiResponse | null;

      if (!response.ok || !payload?.ok) {
        throw new Error(extractApiError(payload, 'Failed to move asset.'));
      }

      setAssetGroups((currentGroups) => currentGroups.flatMap((group) => {
        if (group.registerId === null || !group.members.some((member) => member.assetId === assetRegisterMoveAsset.id)) {
          return [group];
        }

        const remainingMembers = group.members.filter((member) => member.assetId !== assetRegisterMoveAsset.id);
        if (!remainingMembers.length) return [];
        if (remainingMembers.some((member) => member.role === 'primary')) {
          return [{ ...group, members: remainingMembers }];
        }

        return [{
          ...group,
          valueMode: 'separate',
          members: remainingMembers.map((member) => member.role === 'linked'
            ? { ...member, role: 'member', relationship: 'grouped' }
            : member),
        }];
      }));
      setAssets((currentAssets) => (
        isCombinedRegisterView
          ? currentAssets.map((asset) => (
              asset.id === assetRegisterMoveAsset.id
                ? {
                    ...asset,
                    registerId: assetRegisterMoveTargetId,
                    registerName: targetRegister?.businessName ?? asset.registerName,
                  }
                : asset
            ))
          : currentAssets.filter((asset) => asset.id !== assetRegisterMoveAsset.id)
      ));
      setAssetRegisters((currentRegisters) => currentRegisters.map((register) => {
        if (register.id === sourceRegisterId) {
          return {
            ...register,
            assetCount: Math.max(0, register.assetCount - 1),
            totalValue: Math.max(0, register.totalValue - assetValue),
            totalReplacementPrice: Math.max(0, register.totalReplacementPrice - assetReplacementValue),
          };
        }

        if (register.id === assetRegisterMoveTargetId) {
          return {
            ...register,
            assetCount: register.assetCount + 1,
            totalValue: register.totalValue + assetValue,
            totalReplacementPrice: register.totalReplacementPrice + assetReplacementValue,
          };
        }

        return register;
      }));
      setActiveRegister((currentRegister) => (
        currentRegister?.id === sourceRegisterId
          ? {
              ...currentRegister,
              assetCount: Math.max(0, currentRegister.assetCount - 1),
              totalValue: Math.max(0, currentRegister.totalValue - assetValue),
              totalReplacementPrice: Math.max(0, currentRegister.totalReplacementPrice - assetReplacementValue),
            }
          : currentRegister
      ));
      setExpandedAssetId((current) => current === assetRegisterMoveAsset.id ? null : current);

      const movedAssetTitle = assetRegisterMoveAsset.title;
      resetAssetRegisterMoveManager();
      setNotice({
        tone: 'success',
        message: targetRegister
          ? `${movedAssetTitle} moved successfully to ${targetRegister.businessName}.`
          : `${movedAssetTitle} moved successfully.`,
      });
      window.dispatchEvent(new CustomEvent('aim4price:asset-register-updated'));
    } catch (error) {
      setAssetRegisterMoveError(error instanceof Error ? error.message : 'Failed to move asset.');
    } finally {
      setIsMovingAssetRegister(false);
    }
  }

  useEffect(() => {
    if (assetMapActionHandledRef.current || isLoading || typeof window === 'undefined') return;

    const params = new URLSearchParams(window.location.search);
    const action = params.get('mapAction');
    const assetId = params.get('assetId');

    if (!assetId || (action !== 'options' && action !== 'manage')) return;

    const targetAsset = assets.find((asset) => asset.id === assetId);
    if (!targetAsset) return;

    assetMapActionHandledRef.current = true;
    setExpandedAssetId(targetAsset.id);
    scrollToAssetCard(targetAsset.id);

    if (action === 'options') {
      openAssetQuoteOptions(targetAsset);
    } else {
      openActionDialog(targetAsset);
    }

    const nextParams = new URLSearchParams(window.location.search);
    nextParams.delete('assetId');
    nextParams.delete('mapAction');
    const nextSearch = nextParams.toString();
    window.history.replaceState(
      null,
      '',
      `${window.location.pathname}${nextSearch ? `?${nextSearch}` : ''}#asset-card-${encodeURIComponent(targetAsset.id)}`,
    );
  }, [assets, isLoading]);

  useEffect(() => {
    if (!projectionResult || !shouldScrollToProjectionResult) return undefined;

    const timeout = window.setTimeout(() => {
      projectionResultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setShouldScrollToProjectionResult(false);
    }, 120);

    return () => window.clearTimeout(timeout);
  }, [projectionResult, shouldScrollToProjectionResult]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, assetFilter]);

  useEffect(() => {
    if (!openAssetReportSelect) return undefined;

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target;

      if (target instanceof HTMLElement && target.closest('[data-asset-report-select-root="true"]')) {
        return;
      }

      setOpenAssetReportSelect(null);
    };

    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, [openAssetReportSelect]);

  const anyModalOpen =
    Boolean(photoViewerAsset && photoViewerPhoto) ||
    isAssetGroupModalOpen ||
    isAddAssetDestinationModalOpen ||
    isAddChoiceModalOpen ||
    isAcquisitionChoiceOpen ||
    isAssetModalOpen ||
    isAssetSettingsModalOpen ||
    Boolean(pendingUsageOverride) ||
    isManualConversionConfirmOpen ||
    Boolean(replacementPriceRevaluePrompt) ||
    Boolean(activeAsset) ||
    Boolean(ownerAssetCommandPanel) ||
    Boolean(documentUploadAsset) ||
    isQuoteModalOpen ||
    isQuoteTrackingSettingsOpen ||
    Boolean(deleteCandidateAsset) ||
    Boolean(disposalCandidateAsset) ||
    Boolean(acquisitionDetailsAsset) ||
    isAssetReportModalOpen ||
    isAssetFilterOpen ||
    isChangeRegisterModalOpen ||
    Boolean(assetRegisterMoveAsset) ||
    Boolean(accountantNoteAsset) ||
    isPricingModalOpen ||
    Boolean(pricingPreview) ||
    isQrModalOpen ||
    isSummaryModalOpen ||
    isAccountantReportsOpen ||
    isRegisterShareModalOpen ||
    isExportModalOpen ||
    Boolean(projectionAsset) ||
    Boolean(marketplaceAsset);

  const isShareModalFocusOpen = isRegisterShareModalOpen || isQuoteModalOpen;

  useEffect(() => {
    if (!isShareModalFocusOpen) {
      return undefined;
    }

    const returnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const focusableSelector = [
      'a[href]',
      'button:not(:disabled)',
      'input:not(:disabled)',
      'select:not(:disabled)',
      'textarea:not(:disabled)',
      '[tabindex]:not([tabindex="-1"])',
    ].join(',');

    function findShareDialog() {
      const openDialogs = Array.from(document.querySelectorAll<HTMLElement>('[role="dialog"][aria-modal="true"]')).filter((dialog) => (
        dialog.offsetWidth > 0 || dialog.offsetHeight > 0
      ));
      return openDialogs[openDialogs.length - 1] ?? null;
    }

    function handleShareModalTab(event: KeyboardEvent) {
      if (event.key !== 'Tab' || event.defaultPrevented) return;

      const dialog = findShareDialog();
      if (!dialog) return;

      const controls = Array.from(dialog.querySelectorAll<HTMLElement>(focusableSelector)).filter((control) => (
        control.getAttribute('aria-hidden') !== 'true'
        && (control.offsetWidth > 0 || control.offsetHeight > 0)
      ));
      if (!controls.length) return;

      const firstControl = controls[0]!;
      const lastControl = controls[controls.length - 1]!;
      const activeControl = document.activeElement;

      if (event.shiftKey && (activeControl === firstControl || !dialog.contains(activeControl))) {
        event.preventDefault();
        lastControl.focus();
      } else if (!event.shiftKey && (activeControl === lastControl || !dialog.contains(activeControl))) {
        event.preventDefault();
        firstControl.focus();
      }
    }

    document.addEventListener('keydown', handleShareModalTab);

    return () => {
      document.removeEventListener('keydown', handleShareModalTab);
      if (returnFocus?.isConnected) {
        window.requestAnimationFrame(() => returnFocus.focus({ preventScroll: true }));
      }
    };
  }, [isShareModalFocusOpen]);

  useEffect(() => {
    if (!isShareModalFocusOpen) {
      return undefined;
    }

    const headingId = isQuoteTrackingSettingsOpen
      ? 'quote-tracking-settings-title'
      : isRegisterShareModalOpen ? 'asset-register-share-title' : 'asset-quote-title';
    const animationFrame = window.requestAnimationFrame(() => {
      document.getElementById(headingId)?.focus({ preventScroll: true });
    });

    return () => window.cancelAnimationFrame(animationFrame);
  }, [assetShareDestination, isQuoteModalOpen, isQuoteTrackingSettingsOpen, isRegisterShareModalOpen, isShareModalFocusOpen, quoteDirectoryStage, quoteLeadStep, selectedQuoteOption]);

  useEffect(() => {
    if (!anyModalOpen) {
      return undefined;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleEscape = (event: KeyboardEvent) => {
      if (photoViewer) {
        if (event.key === 'Escape') {
          event.preventDefault();
          closePhotoViewer();
          return;
        }

        if (event.key === 'ArrowLeft') {
          event.preventDefault();
          cyclePhotoViewerPhoto(-1);
          return;
        }

        if (event.key === 'ArrowRight') {
          event.preventDefault();
          cyclePhotoViewerPhoto(1);
          return;
        }
      }

      if (event.key !== 'Escape') return;

      // AssetDocumentUploadModal owns its Escape handling. Leaving this layer in
      // place keeps the parent Manage command centre available when it closes.
      if (documentUploadAsset) return;

      if (ownerAssetCommandPanel) {
        setOwnerAssetCommandPanel(null);
        return;
      }

      if (pendingUsageOverride) {
        cancelAim4priceUsageOverrideConfirmation();
        return;
      }

      if (isManualConversionConfirmOpen) {
        if (!isSavingAssetSettings) {
          setIsManualConversionConfirmOpen(false);
        }
        return;
      }

      if (replacementPriceRevaluePrompt) {
        closeReplacementPriceRevaluePrompt();
        return;
      }

      if (isAssetSettingsModalOpen) {
        closeAssetSettingsModal();
        return;
      }

      if (isAssetFilterOpen) {
        setIsAssetFilterOpen(false);
        return;
      }

      if (isChangeRegisterModalOpen) {
        closeChangeRegisterModal();
        return;
      }

      if (assetRegisterMoveAsset) {
        closeAssetRegisterMoveManager();
        return;
      }

      if (accountantNoteAsset) {
        closeAccountantNoteModal();
        return;
      }

      if (deleteCandidateAsset) {
        closeDeleteConfirmDialog();
        return;
      }

      if (disposalCandidateAsset) {
        if (!busyDeleteId) setDisposalCandidateAsset(null);
        return;
      }

      if (acquisitionDetailsAsset) {
        if (!isSavingAcquisitionDetails) setAcquisitionDetailsAsset(null);
        return;
      }

      if (isAcquisitionChoiceOpen) {
        setIsAcquisitionChoiceOpen(false);
        return;
      }

      if (pricingPreview) {
        closePricingPreviewDialog();
        return;
      }

      if (isPricingModalOpen) {
        closePricingDialog();
        return;
      }

      if (isAssetReportModalOpen) {
        closeAssetReportDialog();
        return;
      }

      if (isQrModalOpen) {
        closeQrDialog();
        return;
      }

      if (projectionAsset) {
        closeProjectionModal();
        return;
      }

      if (marketplaceAsset) {
        closeMarketplaceModal();
        return;
      }

      if (isQuoteTrackingSettingsOpen) {
        cancelQuoteTrackingSettings();
        return;
      }

      if (isQuoteModalOpen) {
        if (isQuoteMapExpanded) {
          setIsQuoteMapExpanded(false);
          return;
        }

        if (quoteLeadStep) {
          closeQuoteLeadStep();
          return;
        }

        closeAssetQuoteModal();
        return;
      }

      if (activeAsset) {
        closeActionDialog();
        return;
      }

      if (isAssetGroupModalOpen) {
        closeAssetGroupManager();
        return;
      }

      if (isAddAssetDestinationModalOpen) {
        closeAddAssetDestinationModal();
        return;
      }

      if (isAddChoiceModalOpen) {
        closeAddAssetChoiceModal();
        return;
      }

      if (isSummaryModalOpen) {
        closeSummaryModal();
        return;
      }

      if (isAccountantReportsOpen) {
        setIsAccountantReportsOpen(false);
        return;
      }

      if (isRegisterShareModalOpen) {
        closeRegisterShareModal();
        return;
      }

      if (isExportModalOpen) {
        closeExportModal();
        return;
      }

      if (isAssetModalOpen) {
        closeAssetModal();
      }
    };

    document.addEventListener('keydown', handleEscape);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', handleEscape);
    };
  }, [activeAsset, anyModalOpen, assetRegisterMoveAsset, accountantNoteAsset, isSavingAccountantNote, deleteCandidateAsset, disposalCandidateAsset, acquisitionDetailsAsset, isSavingAcquisitionDetails, isAcquisitionChoiceOpen, isAddAssetDestinationModalOpen, isAddChoiceModalOpen, isAssetGroupModalOpen, isAssetFilterOpen, isChangeRegisterModalOpen, isAssetModalOpen, isAssetReportModalOpen, isExportModalOpen, isPricingModalOpen, pricingPreview, isQrModalOpen, isRegisterShareModalOpen, isSummaryModalOpen, isAccountantReportsOpen, marketplaceAsset, ownerAssetCommandPanel, documentUploadAsset, projectionAsset, isQuoteMapExpanded, isQuoteModalOpen, isQuoteTrackingSettingsOpen, quoteLeadStep, isAssetSettingsModalOpen, pendingUsageOverride, isManualConversionConfirmOpen, isSavingAssetSettings, replacementPriceRevaluePrompt, photoViewer]);

  useEffect(() => {
    if (!isQuoteModalOpen || !selectedQuoteOption || quoteDirectoryStage !== 'map' || !quoteMapElementRef.current) {
      return undefined;
    }

    let cancelled = false;

    async function setupQuoteMap() {
      try {
        const L = await loadLeaflet();
        if (cancelled || !quoteMapElementRef.current) return;

        if (!quoteLeafletMapRef.current) {
          const initialMapLocation = quoteInitialMapLocationRef.current ?? {
            center: DEFAULT_PARTNER_MAP_CENTER,
            zoom: DEFAULT_PARTNER_MAP_ZOOM,
          };
          quoteLeafletMapRef.current = L.map(quoteMapElementRef.current, { zoomControl: true }).setView(
            initialMapLocation.center,
            initialMapLocation.zoom,
          );

          L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
            maxZoom: 19,
          }).addTo(quoteLeafletMapRef.current);

          const handleViewportChange = () => {
            if (quoteViewportTimeoutRef.current !== null) {
              window.clearTimeout(quoteViewportTimeoutRef.current);
            }
            quoteViewportTimeoutRef.current = window.setTimeout(() => {
              const map = quoteLeafletMapRef.current;
              const leadType = selectedQuoteLeadTypeRef.current;
              if (!map || !leadType) return;
              const mapBounds = map.getBounds();
              void loadQuotePartners(leadType, quotePartnerSearchRef.current, {
                west: mapBounds.getWest(),
                south: mapBounds.getSouth(),
                east: mapBounds.getEast(),
                north: mapBounds.getNorth(),
              });
            }, 220);
          };
          quoteLeafletMapRef.current.on('moveend', handleViewportChange);
          handleViewportChange();
        }

        if (quoteMarkerLayerRef.current) {
          quoteMarkerLayerRef.current.clearLayers();
        } else {
          quoteMarkerLayerRef.current = typeof L.markerClusterGroup === 'function'
            ? L.markerClusterGroup({
                chunkedLoading: true,
                maxClusterRadius: 52,
                showCoverageOnHover: false,
                removeOutsideVisibleBounds: true,
              }).addTo(quoteLeafletMapRef.current)
            : L.layerGroup().addTo(quoteLeafletMapRef.current);
        }

        const bounds = L.latLngBounds([]);
        const useCompactQuotePopup = window.innerWidth <= 620;

        quotePartnersWithCoordinates.forEach((partner) => {
          const lat = Number(partner.latitude);
          const lng = Number(partner.longitude);
          const isActive = selectedQuotePartnerIds.includes(partner.userId);
          const icon = L.divIcon({
            className: `assetQuoteMapMarker ${quoteMarkerClassForPartnerType(partner.partnerType)}${partner.isAim4priceManaged ? ' assetQuoteMapMarker--managed' : ''}${isActive ? ' assetQuoteMapMarker--active' : ''}`,
            html: '<span class="assetQuoteMapMarkerPin"></span>',
            iconSize: [38, 44],
            iconAnchor: [19, 40],
            popupAnchor: [0, -36],
          });
          const marker = L.marker([lat, lng], { icon, title: quotePartnerName(partner) }).addTo(quoteMarkerLayerRef.current);
          marker.bindPopup(buildQuotePartnerPopupHtml(partner, isActive), {
            className: 'assetQuotePartnerPopup',
            minWidth: useCompactQuotePopup ? 280 : 380,
            maxWidth: useCompactQuotePopup ? 330 : 500,
            autoPan: false,
          });
          bounds.extend([lat, lng]);
        });

        if (quoteFitResultsRef.current && bounds.isValid()) {
          quoteFitResultsRef.current = false;
          quoteLeafletMapRef.current.fitBounds(bounds.pad(0.18), { maxZoom: 12 });
        }

        window.setTimeout(() => quoteLeafletMapRef.current?.invalidateSize({ animate: false, pan: false }), 80);
      } catch (error) {
        setNotice({ tone: 'error', message: error instanceof Error ? error.message : 'Failed to load the partner map.' });
      }
    }

    void setupQuoteMap();

    return () => {
      cancelled = true;
    };
  }, [isQuoteModalOpen, quoteDirectoryStage, selectedQuoteOption, quotePartnersWithCoordinates, selectedQuotePartnerIds]);

  useEffect(() => {
    if (!isQuoteModalOpen || !selectedQuoteOption || quoteDirectoryStage !== 'map') return undefined;

    const handleQuotePopupSelect = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;

      const button = target.closest<HTMLButtonElement>('[data-quote-partner-id]');
      if (!button) return;

      const partnerId = button.getAttribute('data-quote-partner-id');
      const partner = quotePartners.find((entry) => entry.userId === partnerId);
      if (!partner) return;

      event.preventDefault();
      event.stopPropagation();
      if (button.getAttribute('data-quote-partner-action') === 'message' && isAim4priceAssistancePartner(partner)) {
        openAim4priceAssistanceMessage(partner);
        return;
      }
      toggleQuotePartnerSelection(partner);
    };

    document.addEventListener('click', handleQuotePopupSelect, true);
    return () => document.removeEventListener('click', handleQuotePopupSelect, true);
  }, [isQuoteModalOpen, quoteDirectoryStage, selectedQuoteOption, quotePartners]);

  useEffect(() => {
    if (!isQuoteModalOpen || quoteDirectoryStage !== 'map' || !quoteLeafletMapRef.current) return undefined;

    const resizeMap = () => quoteLeafletMapRef.current?.invalidateSize({ animate: false, pan: false });
    const immediateResize = window.setTimeout(resizeMap, 0);
    const settledResize = window.setTimeout(resizeMap, 220);

    return () => {
      window.clearTimeout(immediateResize);
      window.clearTimeout(settledResize);
    };
  }, [isQuoteMapExpanded, isQuoteModalOpen, quoteDirectoryStage]);

  useEffect(() => {
    if (isQuoteModalOpen && selectedQuoteOption && quoteDirectoryStage === 'map') {
      return undefined;
    }

    if (quoteViewportTimeoutRef.current !== null) {
      window.clearTimeout(quoteViewportTimeoutRef.current);
      quoteViewportTimeoutRef.current = null;
    }

    if (quoteLeafletMapRef.current) {
      quoteLeafletMapRef.current.remove();
      quoteLeafletMapRef.current = null;
      quoteMarkerLayerRef.current = null;
    }

    return undefined;
  }, [isQuoteModalOpen, quoteDirectoryStage, selectedQuoteOption]);

  useEffect(() => {
    if (!isAssetSettingsModalOpen || assetSettingsView !== 'locationMap' || !assetSettingsMapElementRef.current) {
      return undefined;
    }

    let cancelled = false;

    async function setupAssetSettingsMap() {
      try {
        const L = await loadLeaflet();
        if (cancelled || !assetSettingsMapElementRef.current) return;

        const savedLatitude = parseAssetSettingsCoordinate(assetSettingsMapLatInput);
        const savedLongitude = parseAssetSettingsCoordinate(assetSettingsMapLngInput);
        const hasSavedCoordinates = savedLatitude !== null && savedLongitude !== null;
        const profileMapLocation = getAssetSettingsInitialMapLocation(accountProfile);
        const center: [number, number] = hasSavedCoordinates
          ? [savedLatitude, savedLongitude]
          : profileMapLocation.center;
        const zoom = hasSavedCoordinates ? ASSET_SETTINGS_SAVED_ASSET_ZOOM : profileMapLocation.zoom;

        if (!assetSettingsLeafletMapRef.current) {
          assetSettingsLeafletMapRef.current = L.map(assetSettingsMapElementRef.current, { zoomControl: true }).setView(center, zoom);

          L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
            attribution: 'Tiles &copy; Esri &mdash; Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community',
            maxZoom: 19,
          }).addTo(assetSettingsLeafletMapRef.current);

          L.tileLayer('https://services.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}', {
            attribution: 'Labels &copy; Esri',
            maxZoom: 19,
          }).addTo(assetSettingsLeafletMapRef.current);

          assetSettingsLeafletMapRef.current.on('click', (event: { latlng?: { lat: number; lng: number } }) => {
            const latitude = event.latlng?.lat;
            const longitude = event.latlng?.lng;
            if (typeof latitude !== 'number' || typeof longitude !== 'number' || !Number.isFinite(latitude) || !Number.isFinite(longitude)) return;

            setAssetSettingsMapCoordinates(latitude, longitude);
            syncAssetSettingsMapMarker(L, latitude, longitude);
          });
        } else {
          assetSettingsLeafletMapRef.current.setView(center, zoom);
        }

        if (hasSavedCoordinates) {
          syncAssetSettingsMapMarker(L, savedLatitude, savedLongitude);
        } else {
          removeAssetSettingsMapMarker();
        }

        window.setTimeout(() => assetSettingsLeafletMapRef.current?.invalidateSize(), 80);
      } catch (error) {
        setAssetSettingsLocationError(error instanceof Error ? error.message : 'Failed to load the asset location map.');
      }
    }

    void setupAssetSettingsMap();

    return () => {
      cancelled = true;
    };
  }, [isAssetSettingsModalOpen, assetSettingsView, accountProfile]);

  useEffect(() => {
    if (isAssetSettingsModalOpen && assetSettingsView === 'locationMap') {
      return undefined;
    }

    if (assetSettingsLeafletMapRef.current) {
      assetSettingsLeafletMapRef.current.remove();
      assetSettingsLeafletMapRef.current = null;
      assetSettingsMapMarkerRef.current = null;
    }

    return undefined;
  }, [isAssetSettingsModalOpen, assetSettingsView]);

  const displayAssetGroups = useMemo(
    () => projectAssetGroupsToAssets(assetGroups, assets)
      .sort((left, right) => left.name.localeCompare(right.name, 'en-ZA', { sensitivity: 'base' }) || left.id.localeCompare(right.id)),
    [assetGroups, assets],
  );
  const assetsById = useMemo(
    () => new Map(assets.map((asset) => [asset.id, asset])),
    [assets],
  );
  const assetGroupMemberships = useMemo(
    () => buildAssetGroupMembershipMap(displayAssetGroups),
    [displayAssetGroups],
  );
  const allAssetGroupMemberships = useMemo(
    () => buildAssetGroupMembershipMap(assetGroups),
    [assetGroups],
  );
  const assetGroupModalAssets = useMemo(
    () => assets.map((asset) => ({
      id: asset.id,
      title: asset.title,
      registerId: asset.registerId,
      registerName: asset.registerName,
      value: asset.value,
      categoryLabel: assetKindLabel(asset),
      serialNumber: asset.serialNumber,
      registrationNumber: readLicenseRegistrationNumber(asset),
      notes: [getManualAssetNote(asset.note), asset.financeNote, asset.marketplaceNotes].filter(Boolean).join(' '),
      searchableText: buildSearchableText(asset),
    })),
    [assets],
  );

  const totalValue = useMemo(
    () => registerValueForAssets(assets, assetGroupMemberships),
    [assetGroupMemberships, assets],
  );

  const totalValueInclVat = useMemo(() => Math.round(totalValue * 1.15), [totalValue]);
  const displayedRegisterValue = registerValueVatMode === 'included' ? totalValueInclVat : totalValue;
  const totalReplacementValue = useMemo(() => sumAssetReplacementValues(assets), [assets]);
  const totalReplacementValueInclVat = useMemo(() => Math.round(totalReplacementValue * 1.15), [totalReplacementValue]);
  const displayedReplacementValue = replacementValueVatMode === 'included' ? totalReplacementValueInclVat : totalReplacementValue;
  const replacementPricedAssetCount = useMemo(() => countAssetsWithReplacementPrice(assets), [assets]);

  const aim4priceValuedEquipmentCount = useMemo(() => {
    return assets.filter((asset) => isAim4priceValuedAsset(asset)).length;
  }, [assets]);

  const aim4priceValuedEquipmentValue = useMemo(() => {
    return assets
      .filter((asset) => isAim4priceValuedAsset(asset))
      .reduce(
        (sum, asset) => sum + (
          assetCountsTowardRegisterTotal(asset.id, assetGroupMemberships)
            ? Math.round(Number(asset.value || 0))
            : 0
        ),
        0,
      );
  }, [assetGroupMemberships, assets]);

  const manualAssetStats = useMemo(() => {
    return assets
      .filter((asset) => asset.selectedMethod === 'manual')
      .reduce(
        (stats, asset) => ({
          count: stats.count + 1,
          value: stats.value + (
            assetCountsTowardRegisterTotal(asset.id, assetGroupMemberships)
              ? Math.round(Number(asset.value || 0))
              : 0
          ),
        }),
        { count: 0, value: 0 },
      );
  }, [assetGroupMemberships, assets]);

  const financedAssetStats = useMemo(() => {
    return assets.reduce(
      (stats, asset) => {
        if (readFinanceStatusChoice(asset) !== 'yes') {
          return stats;
        }

        return {
          count: stats.count + 1,
          value: stats.value + (
            assetCountsTowardRegisterTotal(asset.id, assetGroupMemberships)
              ? Math.round(Number(asset.value || 0))
              : 0
          ),
        };
      },
      { count: 0, value: 0 },
    );
  }, [assetGroupMemberships, assets]);

  const insuredAssetStats = useMemo(() => {
    return assets.reduce(
      (stats, asset) => {
        if (readInsuranceStatusChoice(asset) !== 'yes') {
          return stats;
        }

        return {
          count: stats.count + 1,
          value: stats.value + (readAssetInsuredValueExVat(asset) ?? Math.round(Number(asset.value || 0))),
        };
      },
      { count: 0, value: 0 },
    );
  }, [assets]);

  const licensedAssetStats = useMemo(() => {
    return assets.reduce(
      (stats, asset) => {
        if (readLicenseStatusChoice(asset) !== 'yes') {
          return stats;
        }

        return {
          count: stats.count + 1,
          value: stats.value + (
            assetCountsTowardRegisterTotal(asset.id, assetGroupMemberships)
              ? Math.round(Number(asset.value || 0))
              : 0
          ),
        };
      },
      { count: 0, value: 0 },
    );
  }, [assetGroupMemberships, assets]);

  const registerBasicSummary = useMemo(
    () => buildRegisterBasicSummary(assets, assetGroups),
    [assetGroups, assets],
  );

  const registerSummarySections = useMemo<RegisterSummaryDisplaySection[]>(
    () => {
      const moneyPair = (valueExVat: number) => ({
        valueExVat: money(valueExVat),
        valueInclVat: money(summaryValueInclVat(valueExVat)),
      });

      return [
        {
          title: 'Register Values',
          description: 'Saved totals for the selected asset register, shown excluding and including VAT.',
          rows: [
            {
              label: 'Total assets',
              count: registerBasicSummary.totalAssets.toLocaleString('en-ZA'),
              ...moneyPair(registerBasicSummary.currentValueExVat),
            },
            {
              label: 'Replacement value',
              count: registerBasicSummary.replacementPricedAssets.toLocaleString('en-ZA'),
              ...moneyPair(registerBasicSummary.replacementValueExVat),
            },
            {
              label: 'Insured value',
              count: registerBasicSummary.assetsInsured.toLocaleString('en-ZA'),
              ...moneyPair(registerBasicSummary.insuredAssetsValueExVat),
            },
            {
              label: 'Financed value',
              count: registerBasicSummary.assetsFinanced.toLocaleString('en-ZA'),
              ...moneyPair(registerBasicSummary.financedValueExVat),
            },
          ],
        },
        {
          title: 'Register Status Counts',
          description: 'Main saved status counts with matching values shown excluding and including VAT.',
          rows: [
            {
              label: 'Assets insured',
              count: registerBasicSummary.assetsInsured.toLocaleString('en-ZA'),
              ...moneyPair(registerBasicSummary.insuredAssetsValueExVat),
            },
            {
              label: 'Assets licensed',
              count: registerBasicSummary.assetsLicensed.toLocaleString('en-ZA'),
              ...moneyPair(registerBasicSummary.licensedValueExVat),
            },
            {
              label: 'Assets financed',
              count: registerBasicSummary.assetsFinanced.toLocaleString('en-ZA'),
              ...moneyPair(registerBasicSummary.financedValueExVat),
            },
          ],
        },
        {
          title: 'Valuation Source',
          description: 'Split between Aim4price-valued assets and manually added assets.',
          rows: [
            {
              label: 'Aim4price assets',
              count: registerBasicSummary.aim4priceAssets.count.toLocaleString('en-ZA'),
              ...moneyPair(registerBasicSummary.aim4priceAssets.valueExVat),
            },
            {
              label: 'Manual assets',
              count: registerBasicSummary.manualAssets.count.toLocaleString('en-ZA'),
              ...moneyPair(registerBasicSummary.manualAssets.valueExVat),
            },
          ],
        },
        {
          title: 'Asset Type Split',
          description: 'Basic split across property, equipment, tools, stock and vehicles.',
          rows: [
            {
              label: 'Property',
              count: registerBasicSummary.assetTypes.property.count.toLocaleString('en-ZA'),
              ...moneyPair(registerBasicSummary.assetTypes.property.valueExVat),
            },
            {
              label: 'Equipment',
              count: registerBasicSummary.assetTypes.equipment.count.toLocaleString('en-ZA'),
              ...moneyPair(registerBasicSummary.assetTypes.equipment.valueExVat),
            },
            {
              label: 'Tools',
              count: registerBasicSummary.assetTypes.tools.count.toLocaleString('en-ZA'),
              ...moneyPair(registerBasicSummary.assetTypes.tools.valueExVat),
            },
            {
              label: 'Stock',
              count: registerBasicSummary.assetTypes.stock.count.toLocaleString('en-ZA'),
              ...moneyPair(registerBasicSummary.assetTypes.stock.valueExVat),
            },
            {
              label: 'Vehicles',
              count: registerBasicSummary.assetTypes.vehicles.count.toLocaleString('en-ZA'),
              ...moneyPair(registerBasicSummary.assetTypes.vehicles.valueExVat),
            },
          ],
        },
        {
          title: 'Supporting Information',
          description: 'Saved supporting information currently attached to assets.',
          rows: [
            { label: 'Assets mapped', count: registerBasicSummary.assetsMapped.toLocaleString('en-ZA') },
            { label: 'Assets with photos', count: registerBasicSummary.assetsWithPhotos.toLocaleString('en-ZA') },
            { label: 'Assets with documents', count: registerBasicSummary.assetsWithDocuments.toLocaleString('en-ZA') },
          ],
          hasValueColumn: false,
        },
      ];
    },
    [registerBasicSummary],
  );

  const quickPdfReportOptions = useMemo(() => PDF_REPORT_OPTIONS.filter((option) => option.value !== 'full'), []);
  const fullPdfReportOption = PDF_REPORT_OPTIONS[0];
  const normalizedPdfAssetSearch = useMemo(() => normalizeRegisterSearchText(pdfAssetSearchTerm), [pdfAssetSearchTerm]);
  const compactPdfAssetSearch = useMemo(() => normalizeCompactSearchText(pdfAssetSearchTerm), [pdfAssetSearchTerm]);
  const visiblePdfAssets = useMemo(() => {
    if (!normalizedPdfAssetSearch) {
      return assets;
    }

    return assets.filter((asset) => {
      const searchableText = [
        buildSearchableText(asset),
        buildAssetMeta(asset),
        assetKindLabel(asset),
        methodLabel(asset.selectedMethod),
        money(asset.value),
        String(asset.value ?? ''),
      ].join(' ');
      const normalizedSearchableText = normalizeRegisterSearchText(searchableText);
      const compactSearchableText = normalizeCompactSearchText(searchableText);

      return (
        normalizedSearchableText.includes(normalizedPdfAssetSearch) ||
        (compactPdfAssetSearch ? compactSearchableText.includes(compactPdfAssetSearch) : false)
      );
    });
  }, [assets, compactPdfAssetSearch, normalizedPdfAssetSearch]);
  const selectedPdfAssetIdSet = useMemo(() => new Set(selectedPdfAssetIds), [selectedPdfAssetIds]);
  const selectedPdfAssets = useMemo(
    () => assets.filter((asset) => selectedPdfAssetIdSet.has(asset.id)),
    [assets, selectedPdfAssetIdSet],
  );
  const selectedPdfAssetCount = selectedPdfAssets.length;
  const allVisiblePdfAssetsSelected = visiblePdfAssets.length > 0 && visiblePdfAssets.every((asset) => selectedPdfAssetIdSet.has(asset.id));

  const editingAsset = useMemo(() => {
    return editingAssetId === null ? null : assets.find((asset) => asset.id === editingAssetId) ?? null;
  }, [assets, editingAssetId]);

  const bulkFinanceAssetIdSet = useMemo(() => new Set(bulkFinanceAssetIds), [bulkFinanceAssetIds]);
  const selectedBulkFinanceAssets = useMemo(
    () => assets.filter((asset) => bulkFinanceAssetIdSet.has(asset.id)),
    [assets, bulkFinanceAssetIdSet],
  );
  const visibleBulkFinanceAssets = useMemo(() => {
    const query = normalizeRegisterSearchText(bulkFinanceAssetSearch);
    if (!query) return assets;
    return assets.filter((asset) => normalizeRegisterSearchText([
      buildSearchableText(asset),
      buildAssetMeta(asset),
      assetKindLabel(asset),
      money(asset.value),
    ].join(' ')).includes(query));
  }, [assets, bulkFinanceAssetSearch]);

  const currentAssetAutosaveSignature = useMemo(
    () => buildAssetAutosaveSignature(assetDraft, assetStatusDraft, pendingPhotoFiles, pendingDocumentFiles, mainPhotoSelection),
    [assetDraft, assetStatusDraft, mainPhotoSelection, pendingDocumentFiles, pendingPhotoFiles],
  );
  assetAutosaveLatestSignatureRef.current = currentAssetAutosaveSignature;

  const assetFormKind = useMemo<AssetKind>(() => {
    return editingAsset?.valuationRunId ? editingAsset.kind : normalizeDraftKind(assetDraft.kind);
  }, [assetDraft.kind, editingAsset]);

  const assetFormUsesPercentUsage = assetDraft.usageMetric === 'percentage';
  const assetFormUsageNotApplicable = assetDraft.usageMetric === 'not_applicable';

  const isEditingSavedManualAsset = isSavedManualAsset(editingAsset);
  const isEditingSavedAim4priceAsset = isSavedAim4priceAsset(editingAsset);
  const showPercentUsageField = assetFormUsesPercentUsage;

  const showUsageHoursField =
    !assetFormUsageNotApplicable &&
    !showPercentUsageField &&
    assetFormKind !== 'property' &&
    assetFormKind !== 'stock';

  const showConditionField = useMemo(() => {
    return assetFormKind !== 'stock' && !(assetFormKind === 'property' && assetDraft.propertyAssetSubtype === 'land');
  }, [assetDraft.propertyAssetSubtype, assetFormKind]);

  const showLifeWorkedPercentField = false;

  useEffect(() => {
    if (!isAssetModalOpen || manualAssetStep !== 2 || !assetDetailFocusTarget) {
      return undefined;
    }

    const animationFrame = window.requestAnimationFrame(() => {
      const field = document.querySelector<HTMLElement>(
        `[data-asset-detail-edit-target="${assetDetailFocusTarget}"]`,
      );

      if (!field) {
        setAssetDetailFocusTarget(null);
        return;
      }

      field.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
      const textControl = field.querySelector<HTMLElement>(
        'input:not(:disabled), textarea:not(:disabled), select:not(:disabled)',
      );
      const focusControl = textControl ?? field.querySelector<HTMLElement>('button:not(:disabled)');
      focusControl?.focus({ preventScroll: true });
      setAssetDetailFocusTarget(null);
    });

    return () => window.cancelAnimationFrame(animationFrame);
  }, [assetDetailFocusTarget, isAssetModalOpen, manualAssetStep]);

  useEffect(() => {
    if (!isAssetModalOpen || !editingAssetId) {
      if (assetAutosaveTimerRef.current) {
        clearTimeout(assetAutosaveTimerRef.current);
        assetAutosaveTimerRef.current = null;
      }
      return;
    }

    if (!assetAutosaveBaselineRef.current) {
      assetAutosaveBaselineRef.current = currentAssetAutosaveSignature;
      setAssetAutosaveState('idle');
      return;
    }

    if (currentAssetAutosaveSignature === assetAutosaveBaselineRef.current) {
      if (assetAutosaveState === 'pending') setAssetAutosaveState('saved');
      return;
    }

    if (
      assetAutosaveState === 'error' &&
      currentAssetAutosaveSignature === assetAutosaveAttemptedSignatureRef.current
    ) {
      return;
    }

    if (assetAutosaveTimerRef.current) {
      clearTimeout(assetAutosaveTimerRef.current);
    }

    setAssetAutosaveState(isSavingAsset || isUploadingPhotos || isUploadingDocuments ? 'saving' : 'pending');

    if (isSavingAsset || isUploadingPhotos || isUploadingDocuments) {
      return;
    }

    const signatureToSave = currentAssetAutosaveSignature;
    assetAutosaveTimerRef.current = setTimeout(() => {
      assetAutosaveTimerRef.current = null;
      assetAutosaveAttemptedSignatureRef.current = signatureToSave;
      setAssetAutosaveState('saving');

      void handleAssetSubmit(undefined, {
        autosave: true,
        keepOpen: true,
        silent: true,
        autosaveSignature: signatureToSave,
      }).then((saved) => {
        setAssetAutosaveState(saved ? 'saved' : 'error');
      });
    }, 650);

    return () => {
      if (assetAutosaveTimerRef.current) {
        clearTimeout(assetAutosaveTimerRef.current);
        assetAutosaveTimerRef.current = null;
      }
    };
  }, [
    assetAutosaveState,
    currentAssetAutosaveSignature,
    editingAssetId,
    isAssetModalOpen,
    isSavingAsset,
    isUploadingDocuments,
    isUploadingPhotos,
  ]);

  const yearFieldLabel = draftYearLabel(assetFormKind);
  const usageFieldLabel = assetFormUsageNotApplicable
    ? 'Usage'
    : showPercentUsageField
      ? 'Usage %'
      : assetFormKind === 'vehicle'
        ? 'Odometer reading'
        : showUsageHoursField
          ? 'Machine hours'
          : 'Usage';
  const usageFieldPlaceholder = showPercentUsageField
    ? 'Enter usage %'
    : assetFormKind === 'vehicle'
      ? 'Enter kilometres'
      : 'Enter machine hours';
  const usageFieldHint = showPercentUsageField
    ? 'Saved as a usage percentage, not as machine hours.'
    : assetFormKind === 'vehicle'
      ? 'Vehicle usage will show as kilometres across the register and marketplace.'
      : 'This can be updated later whenever the machine hours change.';
  const usageTypeOptions = assetFormKind === 'vehicle' ? VEHICLE_USAGE_OPTIONS : EQUIPMENT_USAGE_OPTIONS;

  const activeAssetFilterLabel = useMemo(() => {
    return ASSET_FILTER_OPTIONS.find((option) => option.value === assetFilter)?.label ?? 'All Assets';
  }, [assetFilter]);

  const searchMatchedAssets = useMemo(() => {
    const normalizedSearch = normalizeRegisterSearchText(searchTerm);
    const compactSearch = normalizeCompactSearchText(searchTerm);

    const matchingGroupAssetIds = new Set<string>();
    if (normalizedSearch) {
      assetGroups.forEach((group) => {
        const searchableGroupName = normalizeRegisterSearchText(group.name);
        const compactGroupName = normalizeCompactSearchText(group.name);
        if (
          searchableGroupName.includes(normalizedSearch)
          || (compactSearch ? compactGroupName.includes(compactSearch) : false)
        ) {
          group.members.forEach((member) => matchingGroupAssetIds.add(member.assetId));
        }
      });
    }

    return normalizedSearch
      ? assets.filter((asset) => {
          const searchableText = buildSearchableText(asset);
          return matchingGroupAssetIds.has(asset.id)
            || searchableText.includes(normalizedSearch)
            || (compactSearch ? searchableText.includes(compactSearch) : false);
        })
      : assets;
  }, [assetGroups, assets, searchTerm]);

  const filteredAssets = useMemo(() => {
    return sortAssetsByRegisterPriority(filterAssetsByRegisterFilter(searchMatchedAssets, assetFilter), assetFilter);
  }, [assetFilter, searchMatchedAssets]);
  const groupedFilteredAssets = useMemo(
    () => orderAssetsByGroups(filteredAssets, displayAssetGroups),
    [displayAssetGroups, filteredAssets],
  );
  const registerPaginationEntries = useMemo(
    () => buildAssetGroupPageEntries(groupedFilteredAssets, displayAssetGroups).map((entry) => (
      entry.kind === 'group'
        ? { ...entry, assets: [...entry.assets].sort(compareUmbrellaAssetsByAttention) }
        : entry
    )),
    [displayAssetGroups, groupedFilteredAssets],
  );

  const isShowingAllAssets = pageSize === 'all';
  const standalonePaginationEntries = useMemo(
    () => registerPaginationEntries.filter((entry) => entry.kind === 'asset'),
    [registerPaginationEntries],
  );
  const standalonePaginationEntryCount = standalonePaginationEntries.length;
  const umbrellaPaginationEntryCount = registerPaginationEntries.length - standalonePaginationEntryCount;
  const numericPageSize: number = pageSize === 'all' ? Math.max(1, standalonePaginationEntryCount) : pageSize;
  const paginationPages = useMemo(
    () => isShowingAllAssets
      ? [registerPaginationEntries]
      : paginateAssetGroupPageEntries(registerPaginationEntries, numericPageSize, expandedAssetGroupIds),
    [expandedAssetGroupIds, isShowingAllAssets, numericPageSize, registerPaginationEntries],
  );
  const pageCount = Math.max(1, paginationPages.length);
  const safeCurrentPage = Math.min(currentPage, pageCount);
  const pageStart = isShowingAllAssets
    ? 0
    : paginationPages
      .slice(0, safeCurrentPage - 1)
      .reduce((entryCount, page) => (
        entryCount + page.filter((entry) => entry.kind === 'asset').length
      ), 0);
  const visiblePaginationEntries = paginationPages[safeCurrentPage - 1] ?? [];
  const visibleStandaloneEntryCount = visiblePaginationEntries.filter((entry) => entry.kind === 'asset').length;
  const pageEnd = pageStart + visibleStandaloneEntryCount;
  const visibleAssets = useMemo(
    () => visiblePaginationEntries.flatMap((entry) => entry.assets),
    [visiblePaginationEntries],
  );
  const visibleAssetRows = useMemo<AssetRegisterDisplayRow[]>(() => {
    const rows: AssetRegisterDisplayRow[] = [];
    visiblePaginationEntries.forEach((entry) => {
      if (entry.kind === 'asset') {
        rows.push({ kind: 'asset', asset: entry.asset, group: null, memberIndex: 0, memberCount: 1 });
        return;
      }

      rows.push({ kind: 'group', group: entry.group });
      if (!expandedAssetGroupIds.has(entry.group.id)) return;

      entry.assets.forEach((asset, memberIndex) => {
        rows.push({
          kind: 'asset',
          asset,
          group: entry.group,
          memberIndex,
          memberCount: entry.assets.length,
        });
      });
    });

    return rows;
  }, [expandedAssetGroupIds, visiblePaginationEntries]);
  const focusedAssetGroupId = expandedAssetGroupIds.values().next().value ?? null;
  const expandedAssetGroupId = expandedAssetId
    ? assetGroupMemberships.get(expandedAssetId)?.group.id ?? null
    : null;
  const paginationItems = useMemo(() => buildPaginationItems(safeCurrentPage, pageCount), [safeCurrentPage, pageCount]);

  useEffect(() => {
    if (!focusedAssetGroupId || anyModalOpen || documentUploadAsset) return undefined;

    function handleOutsideUmbrellaPointerDown(event: PointerEvent) {
      if (isViewportScrollbarInteraction(event)) return;

      const target = event.target;
      if (!(target instanceof Element)) return;

      const clickedUmbrella = target.closest<HTMLElement>('[data-asset-group-id]');
      if (clickedUmbrella?.dataset.assetGroupId === focusedAssetGroupId) return;

      setExpandedAssetGroupIds(new Set());
    }

    document.addEventListener('pointerdown', handleOutsideUmbrellaPointerDown);
    return () => document.removeEventListener('pointerdown', handleOutsideUmbrellaPointerDown);
  }, [anyModalOpen, documentUploadAsset, focusedAssetGroupId]);

  useEffect(() => {
    if (currentPage > pageCount) {
      setCurrentPage(pageCount);
    }
  }, [currentPage, pageCount]);

  useEffect(() => {
    if (!expandedAssetId) return;

    if (!visibleAssets.some((asset) => asset.id === expandedAssetId)) {
      setExpandedAssetId(null);
    }
  }, [expandedAssetId, visibleAssets]);

  useEffect(() => {
    if (!expandedAssetId) return;
    if (isAccountantWorkspace && !accountantAccess) return;
    if (vaultDocumentsLoadingByAssetId[expandedAssetId]) return;
    if (vaultDocumentsErrorByAssetId[expandedAssetId]) return;
    if (Object.prototype.hasOwnProperty.call(vaultDocumentsByAssetId, expandedAssetId)) return;

    void loadVaultDocuments(expandedAssetId);
  }, [accountantAccess, expandedAssetId, isAccountantWorkspace, vaultDocumentsByAssetId, vaultDocumentsErrorByAssetId, vaultDocumentsLoadingByAssetId]);

  useEffect(() => {
    if (assetFocusActionHandledRef.current || typeof window === 'undefined' || !assets.length) return;

    const params = new URLSearchParams(window.location.search);
    const focusAssetId = params.get('convertedAssetId') || params.get('assetId') || params.get('focusAssetId');
    const focusAction = String(params.get('action') || params.get('assetAction') || '').trim().toLowerCase();
    const shouldOpenMarketplaceModal =
      focusAction === 'marketplace' || focusAction === 'marketplace-edit' || focusAction === 'listing-edit' || focusAction === 'update-listing';
    const shouldOpenUpdateModal = focusAction === 'edit' || focusAction === 'update' || focusAction === 'update-asset';

    if (!focusAssetId) return;

    const matchingAssetIndex = assets.findIndex((asset) => asset.id === focusAssetId);
    if (matchingAssetIndex < 0) return;

    const matchingAsset = assets[matchingAssetIndex];
    const matchingMembership = assetGroupMemberships.get(focusAssetId);
    const matchingStandaloneIndex = standalonePaginationEntries.findIndex(
      (entry) => entry.asset.id === focusAssetId,
    );

    assetFocusActionHandledRef.current = true;
    setSearchTerm('');
    setAssetFilter('all');
    setExpandedAssetId(focusAssetId);
    if (matchingMembership) {
      setExpandedAssetGroupIds(new Set([matchingMembership.group.id]));
    }
    setCurrentPage(
      isShowingAllAssets || matchingStandaloneIndex < 0
        ? 1
        : Math.floor(matchingStandaloneIndex / numericPageSize) + 1,
    );
    scrollToAssetCard(focusAssetId);

    if (shouldOpenMarketplaceModal && matchingAsset) {
      window.setTimeout(() => {
        void openMarketplaceModal(matchingAsset);
      }, 0);
    } else if (shouldOpenUpdateModal && matchingAsset) {
      window.setTimeout(() => openUpdater(matchingAsset), 0);
    }

    params.delete('convertedAssetId');
    params.delete('assetId');
    params.delete('focusAssetId');
    params.delete('action');
    params.delete('assetAction');

    const nextSearch = params.toString();
    const nextUrl = `${window.location.pathname}${nextSearch ? `?${nextSearch}` : ''}${window.location.hash}`;
    window.history.replaceState(null, '', nextUrl);
  }, [assetGroupMemberships, assets, isShowingAllAssets, numericPageSize, standalonePaginationEntries]);

  function resetEditor() {
    if (assetAutosaveTimerRef.current) {
      clearTimeout(assetAutosaveTimerRef.current);
      assetAutosaveTimerRef.current = null;
    }
    assetAutosaveBaselineRef.current = '';
    assetAutosaveLatestSignatureRef.current = '';
    assetAutosaveAttemptedSignatureRef.current = '';
    setAssetAutosaveState('idle');

    pendingPhotoFilesRef.current.forEach((entry) => revokePhotoPreviewUrl(entry.previewUrl));
    pendingPhotoFilesRef.current = [];

    setEditingAssetId(null);
    setAssetDraft(initialAssetDraft);
    setAssetStatusDraft(initialAssetStatusDraft);
    setAssetDetailFocusTarget(null);
    setAssetStatusEditView('hub');
    setAssetStatusQuickOrigin(null);
    setAssetStatusAdvancedOpen(false);
    setAssetStatusError('');
    setIsSavingAssetStatus(false);
    setManualAssetStep(1);
    setHasManualAssetKindSelection(false);
    setIsAssetSettingsModalOpen(false);
    setIsManualConversionConfirmOpen(false);
    setAssetSettingsTypeDraft('equipment');
    setAssetSettingsUsageInput('');
    setAssetSettingsError('');
    setAssetSettingsLocationState('idle');
    setAssetSettingsLocationError('');
    setAssetSettingsLocationSuccess('');
    setAssetSettingsManualLatInput('');
    setAssetSettingsManualLngInput('');
    setAssetSettingsManualLocationText('');
    setAssetSettingsMapLatInput('');
    setAssetSettingsMapLngInput('');
    setAssetSettingsMapLocationText('');
    setAssetSettingsView('menu');
    setPendingUsageOverride(null);
    setMainPhotoSelection(null);
    setPendingPhotoFiles([]);
    setPendingDocumentFiles([]);

    if (photoInputRef.current) {
      photoInputRef.current.value = '';
    }

    if (documentInputRef.current) {
      documentInputRef.current.value = '';
    }
  }

  function openAddAssetChoiceModal() {
    setNotice(null);
    setIsAssetFilterOpen(false);

    if (isCombinedRegisterView) {
      if (!addAssetRegisterOptions.length) {
        setNotice({
          tone: 'warning',
          message: 'Create an Asset Register before adding an asset from the combined view.',
        });
        return;
      }

      setAddAssetTargetRegisterId('');
      setIsAddAssetDestinationModalOpen(true);
      return;
    }

    setAddAssetTargetRegisterId(String(activeRegister?.id || activeRegisterId || '').trim());
    setIsAddChoiceModalOpen(true);
  }

  function closeAddAssetDestinationModal() {
    setIsAddAssetDestinationModalOpen(false);
    setAddAssetTargetRegisterId('');
  }

  function continueAddAssetForRegister() {
    if (!addAssetTargetRegisterId) {
      setNotice({ tone: 'error', message: 'Choose the Asset Register that should own this asset.' });
      return;
    }

    setIsAddAssetDestinationModalOpen(false);
    setIsAddChoiceModalOpen(true);
  }

  function closeAddAssetChoiceModal() {
    setIsAddChoiceModalOpen(false);
  }

  function openCreateModal() {
    assetModalReturnRef.current = null;
    resetEditor();
    setManualAssetStep(1);
    setIsAssetModalOpen(true);
  }

  function openManualEntryFromChoice() {
    closeAddAssetChoiceModal();
    setNewAssetAcquisitionDraft(createAcquisitionDraft());
    setIsAcquisitionChoiceOpen(true);
  }

  function continueManualEntryFromAcquisitionChoice() {
    if (newAssetAcquisitionDraft.newlyAcquired === null) {
      setNotice({ tone: 'error', message: 'Choose whether this is a newly acquired asset.' });
      return;
    }
    setIsAcquisitionChoiceOpen(false);
    openCreateModal();
  }

  function rememberAssetModalReturn(
    asset: RegisterAsset,
    origin: AssetModalReturnOrigin['origin'],
    action: string,
    trigger: HTMLElement | null,
  ) {
    assetModalReturnRef.current = {
      asset,
      assetId: asset.id,
      origin,
      action,
      trigger,
      scrollY: window.scrollY,
    };
  }

  function restoreAssetCardOrigin(returnOrigin: AssetModalReturnOrigin) {
    setExpandedAssetId(returnOrigin.assetId);

    window.requestAnimationFrame(() => {
      const card = document.getElementById(`asset-card-${returnOrigin.assetId}`);
      const fallbackTrigger = card?.querySelector<HTMLElement>(
        `[data-asset-return-action="${returnOrigin.action}"]`,
      ) ?? null;
      const focusTarget = returnOrigin.trigger?.isConnected
        ? returnOrigin.trigger
        : fallbackTrigger;

      if (card) {
        const bounds = card.getBoundingClientRect();
        if (bounds.bottom <= 96 || bounds.top >= window.innerHeight) {
          card.scrollIntoView({ block: 'nearest', inline: 'nearest' });
        }
      } else {
        window.scrollTo({ top: returnOrigin.scrollY });
      }

      focusTarget?.focus({ preventScroll: true });
    });
  }

  function closeAssetModal() {
    const returnOrigin = assetModalReturnRef.current;
    assetModalReturnRef.current = null;
    setIsAssetModalOpen(false);
    setBulkFinanceAssetPickerOpen(false);
    setBulkFinanceAssetSearch('');
    setBulkFinanceAssetIds([]);
    resetEditor();

    if (!returnOrigin) return false;

    if (returnOrigin.origin === 'manage') {
      const latestAsset = assets.find((asset) => asset.id === returnOrigin.assetId) ?? returnOrigin.asset;
      openActionDialog(latestAsset);
      window.requestAnimationFrame(() => {
        document.querySelector<HTMLElement>(`[data-asset-return-action="${returnOrigin.action}"]`)
          ?.focus({ preventScroll: true });
      });
      return true;
    }

    restoreAssetCardOrigin(returnOrigin);
    return true;
  }

  function openUpdater(asset: RegisterAsset, focusTarget: AssetDetailEditTarget | null = null) {
    pendingPhotoFilesRef.current.forEach((entry) => revokePhotoPreviewUrl(entry.previewUrl));
    pendingPhotoFilesRef.current = [];

    const nextDraft = buildDraftFromAsset(asset);
    const nextStatusDraft = buildAssetStatusDraftFromAsset(asset);

    setPendingPhotoFiles([]);
    setPendingDocumentFiles([]);
    setMainPhotoSelection(null);
    setEditingAssetId(asset.id);
    setAssetDraft(nextDraft);
    setAssetStatusDraft(nextStatusDraft);
    setAssetDetailFocusTarget(focusTarget);
    assetAutosaveBaselineRef.current = buildAssetAutosaveSignature(nextDraft, nextStatusDraft);
    assetAutosaveLatestSignatureRef.current = assetAutosaveBaselineRef.current;
    assetAutosaveAttemptedSignatureRef.current = '';
    setAssetAutosaveState('idle');
    setAssetStatusEditView('hub');
    setAssetStatusQuickOrigin(null);
    setAssetStatusAdvancedOpen(false);
    setAssetStatusError('');
    setIsSavingAssetStatus(false);
    setBulkFinanceAssetIds([asset.id]);
    setBulkFinanceAssetPickerOpen(false);
    setBulkFinanceAssetSearch('');
    setManualAssetStep(2);
    setHasManualAssetKindSelection(true);
    setIsAssetSettingsModalOpen(false);
    setIsManualConversionConfirmOpen(false);
    setPendingUsageOverride(null);
    setAssetSettingsError('');
    setAssetSettingsLocationState('idle');
    setAssetSettingsLocationError('');
    setAssetSettingsLocationSuccess('');
    setAssetSettingsManualLatInput('');
    setAssetSettingsManualLngInput('');
    setAssetSettingsManualLocationText('');
    setAssetSettingsMapLatInput('');
    setAssetSettingsMapLngInput('');
    setAssetSettingsMapLocationText('');
    setAssetSettingsView('menu');
    setIsAssetModalOpen(true);
  }

  function openQuickAssetDetailEditor(
    asset: RegisterAsset,
    target: AssetDetailEditTarget,
    trigger: HTMLElement | null = null,
  ) {
    if (!canUseOwnerOnlyAssetActions || !canQuickEditAssetDetail(asset, target)) return;

    rememberAssetModalReturn(asset, 'card', `detail-${target}`, trigger);
    setExpandedAssetId(asset.id);
    openUpdater(asset, target);
  }

  function setAssetSettingsManualLocationInputsFromAsset(asset: RegisterAsset | null) {
    setAssetSettingsManualLatInput(asset ? formatAssetSettingsCoordinateInput(asset.lastKnownLat) : '');
    setAssetSettingsManualLngInput(asset ? formatAssetSettingsCoordinateInput(asset.lastKnownLng) : '');
    setAssetSettingsManualLocationText(getAssetSettingsManualLocationTextInput(asset));
  }

  function setAssetSettingsMapLocationInputsFromAsset(asset: RegisterAsset | null) {
    setAssetSettingsMapLatInput(asset ? formatAssetSettingsCoordinateInput(asset.lastKnownLat) : '');
    setAssetSettingsMapLngInput(asset ? formatAssetSettingsCoordinateInput(asset.lastKnownLng) : '');
    setAssetSettingsMapLocationText(getAssetSettingsManualLocationTextInput(asset));
  }

  function clearAssetSettingsManualLocationInputs() {
    setAssetSettingsManualLatInput('');
    setAssetSettingsManualLngInput('');
    setAssetSettingsManualLocationText('');
  }

  function clearAssetSettingsMapLocationInputs() {
    setAssetSettingsMapLatInput('');
    setAssetSettingsMapLngInput('');
    setAssetSettingsMapLocationText('');
  }

  function setAssetSettingsMapCoordinates(latitude: number, longitude: number) {
    setAssetSettingsMapLatInput(formatAssetSettingsManualCoordinate(latitude));
    setAssetSettingsMapLngInput(formatAssetSettingsManualCoordinate(longitude));
    clearAssetSettingsLocationFeedback();
  }

  function syncAssetSettingsMapMarker(leaflet: any, latitude: number, longitude: number) {
    const map = assetSettingsLeafletMapRef.current;
    if (!map) return;

    const position: [number, number] = [latitude, longitude];

    if (assetSettingsMapMarkerRef.current) {
      assetSettingsMapMarkerRef.current.setLatLng(position);
      return;
    }

    const marker = leaflet.marker(position, {
      draggable: true,
      title: 'Selected asset GPS position',
    }).addTo(map);

    marker.on('dragend', () => {
      const nextPosition = marker.getLatLng();
      setAssetSettingsMapCoordinates(nextPosition.lat, nextPosition.lng);
    });

    assetSettingsMapMarkerRef.current = marker;
  }

  function removeAssetSettingsMapMarker() {
    if (assetSettingsMapMarkerRef.current) {
      assetSettingsMapMarkerRef.current.remove();
      assetSettingsMapMarkerRef.current = null;
    }
  }

  function clearAssetSettingsLocationFeedback() {
    setAssetSettingsLocationError('');
    setAssetSettingsLocationSuccess('');
  }

  function applyAssetSettingsCoordinatePair(value: string): boolean {
    const pair = parseAssetSettingsCoordinatePair(value);

    if (!pair) {
      return false;
    }

    setAssetSettingsManualLatInput(formatAssetSettingsManualCoordinate(pair.latitude));
    setAssetSettingsManualLngInput(formatAssetSettingsManualCoordinate(pair.longitude));
    clearAssetSettingsLocationFeedback();
    return true;
  }

  function openAssetSettingsModalForAsset(asset: RegisterAsset | null, startView: AssetSettingsView = 'menu') {
    if (!asset) {
      setNotice({ tone: 'error', message: 'Open a saved asset before changing asset settings.' });
      return;
    }

    const usageMode = getAssetSettingsUsageMode(asset);
    setEditingAssetId(asset.id);
    setAssetDraft(buildDraftFromAsset(asset));
    setAssetStatusDraft(buildAssetStatusDraftFromAsset(asset));
    setBulkFinanceAssetIds([asset.id]);
    setBulkFinanceAssetPickerOpen(false);
    setBulkFinanceAssetSearch('');
    setAssetSettingsTypeDraft(getManualAssetOption(asset.kind).value);
    setAssetSettingsUsageInput(formatAssetSettingsUsageInput(asset, usageMode));
    setAssetSettingsError('');
    setAssetSettingsLocationState('idle');
    clearAssetSettingsLocationFeedback();
    setAssetSettingsManualLocationInputsFromAsset(asset);
    setAssetSettingsMapLocationInputsFromAsset(asset);
    setAssetSettingsView(startView);
    setPendingUsageOverride(null);
    setIsManualConversionConfirmOpen(false);
    setIsAssetSettingsModalOpen(true);
  }

  function openAssetSettingsModal() {
    openAssetSettingsModalForAsset(editingAsset, 'menu');
  }

  function closeAssetSettingsModal() {
    if (isAssetSettingsBusy) return;
    const returnOrigin = !isAssetModalOpen && assetModalReturnRef.current?.action === 'status-mapped'
      ? assetModalReturnRef.current
      : null;
    if (returnOrigin) assetModalReturnRef.current = null;
    setIsAssetSettingsModalOpen(false);
    setBulkFinanceAssetPickerOpen(false);
    setBulkFinanceAssetSearch('');
    setBulkFinanceAssetIds([]);
    setIsManualConversionConfirmOpen(false);
    setPendingUsageOverride(null);
    setAssetSettingsError('');
    setAssetSettingsLocationState('idle');
    setAssetSettingsView('menu');
    clearAssetSettingsLocationFeedback();
    clearAssetSettingsManualLocationInputs();
    clearAssetSettingsMapLocationInputs();
    if (returnOrigin) restoreAssetCardOrigin(returnOrigin);
  }

  function openAssetSettingsMenuView() {
    if (isAssetSettingsBusy) return;
    setAssetSettingsView('menu');
    setAssetSettingsError('');
    clearAssetSettingsLocationFeedback();
  }

  function openAssetSettingsLocationView() {
    if (isAssetSettingsBusy) return;
    setAssetSettingsView('location');
    setAssetSettingsError('');
    clearAssetSettingsLocationFeedback();
    setAssetSettingsManualLocationInputsFromAsset(editingAsset);
    setAssetSettingsMapLocationInputsFromAsset(editingAsset);
  }

  function openAssetSettingsManualLocationView() {
    if (isAssetSettingsBusy) return;
    setAssetSettingsView('locationManual');
    setAssetSettingsError('');
    clearAssetSettingsLocationFeedback();
    setAssetSettingsManualLocationInputsFromAsset(editingAsset);
  }

  function openAssetSettingsMapLocationView() {
    if (isAssetSettingsBusy) return;
    setAssetSettingsView('locationMap');
    setAssetSettingsError('');
    clearAssetSettingsLocationFeedback();
    setAssetSettingsMapLocationInputsFromAsset(editingAsset);
  }

  function openAssetSettingsTypeView() {
    if (isAssetSettingsBusy || !isSavedManualAsset(editingAsset)) return;
    setAssetSettingsView('type');
    setAssetSettingsTypeDraft(getManualAssetOption(editingAsset.kind).value);
    setAssetSettingsError('');
    clearAssetSettingsLocationFeedback();
  }

  function openAssetSettingsConversionView() {
    if (isAssetSettingsBusy || !isSavedManualAsset(editingAsset)) return;
    setAssetSettingsView('conversion');
    setAssetSettingsError('');
    clearAssetSettingsLocationFeedback();
  }

  function openAssetSettingsUsageView() {
    if (isAssetSettingsBusy || !isSavedAim4priceAsset(editingAsset)) return;
    const usageMode = getAssetSettingsUsageMode(editingAsset);
    setAssetSettingsView('usage');
    setAssetSettingsUsageInput(formatAssetSettingsUsageInput(editingAsset, usageMode));
    setAssetSettingsError('');
    clearAssetSettingsLocationFeedback();
  }

  function goBackFromAssetSettingsSubView() {
    if (isAssetSettingsBusy) return;
    if (assetSettingsView === 'locationManual' || assetSettingsView === 'locationMap') {
      setAssetSettingsView('location');
      clearAssetSettingsLocationFeedback();
      return;
    }

    openAssetSettingsMenuView();
  }

  async function persistAssetSettingsGpsPosition(input: {
    assetId: string;
    latitude: number;
    longitude: number;
    gpsAccuracyMeters: number | null;
    clientCapturedAt: string;
    locationText: string;
    source: 'manual' | 'device';
  }): Promise<RegisterAsset> {
    const response = await fetch('/api/asset-register/location', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(input),
    });
    const data = (await response.json().catch(() => null)) as AssetRegisterApiResponse | null;

    if (!response.ok || !data?.ok || !data.item) {
      throw new Error(data?.error ?? 'Failed to save GPS position.');
    }

    syncSettingsUpdatedAsset(data.item);
    setAssetDraft(buildDraftFromAsset(data.item));
    setAssetStatusDraft(buildAssetStatusDraftFromAsset(data.item));
    setAssetSettingsManualLocationInputsFromAsset(data.item);
    setAssetSettingsMapLocationInputsFromAsset(data.item);

    return data.item;
  }

  async function saveAssetSettingsManualGpsPosition() {
    if (!editingAsset) {
      setAssetSettingsLocationError('Open a saved asset before updating GPS position.');
      return;
    }

    if (isAssetSettingsBusy) {
      return;
    }

    const validatedGps = validateAssetSettingsManualGpsInputs(
      assetSettingsManualLatInput,
      assetSettingsManualLngInput,
      assetSettingsManualLocationText,
    );

    if (!validatedGps.ok) {
      setAssetSettingsLocationError(validatedGps.error);
      setAssetSettingsLocationSuccess('');
      return;
    }

    setAssetSettingsLocationState('savingManual');
    clearAssetSettingsLocationFeedback();

    try {
      await persistAssetSettingsGpsPosition({
        assetId: editingAsset.id,
        latitude: validatedGps.latitude,
        longitude: validatedGps.longitude,
        gpsAccuracyMeters: null,
        clientCapturedAt: new Date().toISOString(),
        locationText: validatedGps.locationText,
        source: 'manual',
      });

      setAssetSettingsLocationSuccess('Manual GPS position saved.');
      setNotice({ tone: 'success', message: 'Manual GPS position updated.' });
    } catch (error) {
      setAssetSettingsLocationError(error instanceof Error ? error.message : 'Failed to save GPS position.');
    } finally {
      setAssetSettingsLocationState('idle');
    }
  }

  async function saveAssetSettingsMapGpsPosition() {
    if (!editingAsset) {
      setAssetSettingsLocationError('Open a saved asset before updating GPS position.');
      return;
    }

    if (isAssetSettingsBusy) {
      return;
    }

    const validatedGps = validateAssetSettingsManualGpsInputs(
      assetSettingsMapLatInput,
      assetSettingsMapLngInput,
      assetSettingsMapLocationText,
    );

    if (!validatedGps.ok) {
      setAssetSettingsLocationError(
        assetSettingsMapLatInput || assetSettingsMapLngInput
          ? validatedGps.error
          : 'Click or tap the map to place a pin before saving.',
      );
      setAssetSettingsLocationSuccess('');
      return;
    }

    setAssetSettingsLocationState('savingMap');
    clearAssetSettingsLocationFeedback();

    try {
      await persistAssetSettingsGpsPosition({
        assetId: editingAsset.id,
        latitude: validatedGps.latitude,
        longitude: validatedGps.longitude,
        gpsAccuracyMeters: null,
        clientCapturedAt: new Date().toISOString(),
        locationText: validatedGps.locationText,
        source: 'manual',
      });

      setAssetSettingsLocationSuccess('Map GPS position saved.');
      setNotice({ tone: 'success', message: 'Map GPS position updated.' });
    } catch (error) {
      setAssetSettingsLocationError(error instanceof Error ? error.message : 'Failed to save GPS position.');
    } finally {
      setAssetSettingsLocationState('idle');
    }
  }

  async function updateAssetSettingsGpsPosition() {
    if (!editingAsset) {
      setAssetSettingsLocationError('Open a saved asset before updating GPS position.');
      return;
    }

    if (isAssetSettingsBusy) {
      return;
    }

    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setAssetSettingsLocationError('GPS is not available in this browser. You can enter the latitude and longitude manually above.');
      setAssetSettingsLocationSuccess('');
      return;
    }

    const targetAssetId = editingAsset.id;

    setAssetSettingsLocationState('capturing');
    clearAssetSettingsLocationFeedback();

    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 15000,
          maximumAge: 0,
        });
      });

      const latitude = position.coords.latitude;
      const longitude = position.coords.longitude;

      if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
        throw new Error('Could not capture GPS position. Please try again, or enter the latitude and longitude manually above.');
      }

      const gpsAccuracyMeters = Number.isFinite(position.coords.accuracy) && position.coords.accuracy >= 0
        ? position.coords.accuracy
        : null;
      const clientCapturedAt = new Date(position.timestamp || Date.now()).toISOString();

      setAssetSettingsLocationState('savingDevice');

      await persistAssetSettingsGpsPosition({
        assetId: targetAssetId,
        latitude,
        longitude,
        gpsAccuracyMeters,
        clientCapturedAt,
        locationText: `GPS ${latitude.toFixed(6)}, ${longitude.toFixed(6)}`,
        source: 'device',
      });

      setAssetSettingsLocationSuccess('Device GPS position saved.');
      setNotice({ tone: 'success', message: 'Device GPS position updated.' });
    } catch (error) {
      setAssetSettingsLocationError(
        gpsCaptureErrorMessage(error) ??
          (error instanceof Error
            ? error.message
            : 'Could not capture GPS position. Please try again, or enter the latitude and longitude manually above.'),
      );
    } finally {
      setAssetSettingsLocationState('idle');
    }
  }

  function selectManualAssetKind(nextKind: AssetKind, shouldAdvance = false) {
    const supportsLicensing = assetKindSupportsLicensing(nextKind);
    setHasManualAssetKindSelection(true);

    setAssetDraft((current) => ({
      ...current,
      kind: nextKind,
      generalAssetCategory: nextKind === 'manual' ? current.generalAssetCategory : '',
      propertyAssetSubtype: nextKind === 'property' ? current.propertyAssetSubtype : '',
      propertyInterest: nextKind === 'property' ? current.propertyInterest : '',
      stockAssetSubtype: nextKind === 'stock' ? current.stockAssetSubtype : '',
      stockValuationBasis: nextKind === 'stock' ? current.stockValuationBasis : '',
      stockMovement: nextKind === 'stock' ? current.stockMovement : '',
      stockPeakValue: nextKind === 'stock' ? current.stockPeakValue : '',
      replacementPrice: nextKind === 'stock' ? '' : current.replacementPrice,
      yearModel: nextKind === 'stock' ? '' : current.yearModel,
      condition: nextKind === 'stock' ? '' : current.condition,
      insuranceUseContext: nextKind === 'manual' || nextKind === 'property' ? current.insuranceUseContext : '',
      insuranceMobility: nextKind === 'manual' ? current.insuranceMobility : '',
      insuranceCriticalToOperations: nextKind === 'manual' ? current.insuranceCriticalToOperations : 'unknown',
      insuranceTemperatureSensitiveStock:
        nextKind === 'manual' || nextKind === 'stock' ? current.insuranceTemperatureSensitiveStock : 'unknown',
      hours: nextKind === 'property' || nextKind === 'stock' ? '' : current.hours,
      usageMetric: nextKind === 'vehicle'
        ? 'km'
        : nextKind === 'property' || nextKind === 'stock'
          ? 'not_applicable'
          : current.usageMetric === 'km' ? 'hours' : current.usageMetric,
      lifeWorkedPercent: nextKind === 'property' || nextKind === 'vehicle' || nextKind === 'stock' ? '' : current.lifeWorkedPercent,
      propertySize: nextKind === 'property' ? current.propertySize : '',
      licenseStatus: supportsLicensing ? current.licenseStatus : 'not_applicable',
      isLicensed: supportsLicensing ? current.isLicensed : false,
      licenseRegistrationNumber: supportsLicensing ? current.licenseRegistrationNumber : '',
    }));

    if (!supportsLicensing) {
      setAssetStatusDraft((current) => ({
        ...current,
        licenseStatus: 'not_applicable',
        licenseRegistrationNumber: '',
        licenseRenewalDate: '',
        licenseNote: '',
      }));
    }

    if (shouldAdvance) {
      setManualAssetStep(2);
    }
  }

  async function saveManualAssetTypeSetting() {
    if (!isSavedManualAsset(editingAsset)) {
      setAssetSettingsError('Only saved manual assets can change equipment type here.');
      return;
    }

    const nextKind = assetSettingsTypeDraft;
    const nextKindHasNoItemIdentity = nextKind === 'property' || nextKind === 'stock';
    const nextKindSupportsLicensing = assetKindSupportsLicensing(nextKind);
    const replacementPrice = readAssetReplacementPriceExVat(editingAsset);

    if (!replacementPrice || replacementPrice <= 0) {
      setAssetSettingsError('This asset needs a saved replacement price before its type can be changed.');
      return;
    }

    const usage = getAssetSettingsUsageForKind(editingAsset, nextKind);
    const nextSpecsJson = buildAssetSettingsSpecsJson(editingAsset, nextKind, usage.usageMetric, usage.lifeWorkedPercent);

    setIsSavingAssetSettings(true);
    setAssetSettingsError('');

    try {
      const response = await fetch('/api/asset-register', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          assetId: editingAsset.id,
          kind: nextKind,
          title: editingAsset.title,
          value: Math.round(Number(editingAsset.value || 0)),
          replacementPriceExVat: replacementPrice,
          insuredValueExVat: readAssetInsuredValueExVat(editingAsset),
          note: getManualAssetNote(editingAsset.note),
          serialNumber: nextKindHasNoItemIdentity ? '' : editingAsset.serialNumber,
          brandName: nextKindHasNoItemIdentity || deriveAssetReportBrandName(editingAsset) === '—' ? '' : deriveAssetReportBrandName(editingAsset),
          modelName: nextKindHasNoItemIdentity || deriveAssetReportModelName(editingAsset) === '—' ? '' : deriveAssetReportModelName(editingAsset),
          isFinanced: readFinanceStatusChoice(editingAsset) === 'yes',
          isInsured: readInsuranceStatusChoice(editingAsset) === 'yes',
          isLicensed: nextKindSupportsLicensing ? readLicenseStatusChoice(editingAsset) === 'yes' : false,
          licenseRegistrationNumber:
            !nextKindSupportsLicensing || readLicenseStatusChoice(editingAsset) !== 'yes' ? '' : readLicenseRegistrationNumber(editingAsset),
          financeNote: editingAsset.financeNote ?? null,
          photos: normalizePhotos(editingAsset.photos),
          documents: assetDocuments(editingAsset),
          yearModel: nextKind === 'stock' ? null : editingAsset.yearModel ?? null,
          hours: usage.hours,
          usageMetric: usage.usageMetric,
          lifeWorkedPercent: usage.lifeWorkedPercent,
          specsJson: nextSpecsJson,
          condition: nextKind === 'stock' ? null : usage.condition,
        }),
      });
      const data = (await response.json()) as AssetRegisterApiResponse;

      if (!response.ok || !data.ok || !data.item) {
        throw new Error(data.error ?? 'Failed to update asset type.');
      }

      syncUpdatedAsset(data.item);
      setAssetDraft(buildDraftFromAsset(data.item));
      setAssetSettingsTypeDraft(data.item.kind);
      setNotice({ tone: 'success', message: 'Asset type updated.' });
      closeAssetSettingsModal();
    } catch (error) {
      setAssetSettingsError(error instanceof Error ? error.message : 'Failed to update asset type.');
    } finally {
      setIsSavingAssetSettings(false);
    }
  }

  function startManualAssetConversion() {
    if (!isSavedManualAsset(editingAsset)) {
      setAssetSettingsError('Only saved manual assets can be converted to Aim4price valued assets.');
      return;
    }

    setAssetSettingsError('');
    setPendingUsageOverride(null);
    setIsManualConversionConfirmOpen(true);
  }

  function confirmManualAssetConversion() {
    if (!isSavedManualAsset(editingAsset)) return;

    const params = new URLSearchParams({
      conversion: 'manual-to-aim4price',
      convertAssetId: editingAsset.id,
    });

    window.location.assign(`/valuation?${params.toString()}`);
  }

  function requestAim4priceUsageOverrideSetting() {
    if (!isSavedAim4priceAsset(editingAsset)) {
      setAssetSettingsError('Only saved Aim4price valued assets can use this setting.');
      return;
    }

    const usageMode = getAssetSettingsUsageMode(editingAsset);

    if (usageMode === 'none') {
      setAssetSettingsError('This asset does not have a saved usage field to override.');
      return;
    }

    const nextUsageValue = parseAssetSettingsUsageInput(usageMode, assetSettingsUsageInput);

    if (nextUsageValue === null) {
      setAssetSettingsError(assetSettingsUsageInvalidMessage(usageMode));
      return;
    }

    setAssetSettingsError('');
    setPendingUsageOverride({ mode: usageMode, value: nextUsageValue });
  }

  function cancelAim4priceUsageOverrideConfirmation() {
    if (isSavingAssetSettings) return;
    setPendingUsageOverride(null);
  }

  async function confirmAim4priceUsageOverrideSetting() {
    if (!isSavedAim4priceAsset(editingAsset)) {
      setAssetSettingsError('Only saved Aim4price valued assets can use this setting.');
      setPendingUsageOverride(null);
      return;
    }

    if (!pendingUsageOverride) {
      setAssetSettingsError('Confirm the usage override before saving.');
      return;
    }

    setIsSavingAssetSettings(true);
    setAssetSettingsError('');

    try {
      const response = await fetch('/api/asset-register/revalue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          assetId: editingAsset.id,
          selectedMethod: 'aim4price',
          allowUsageDecrease: true,
          usageOverrideConfirmed: true,
          ...(pendingUsageOverride.mode === 'percent'
            ? { lifeWorkedPercentOverride: pendingUsageOverride.value }
            : { usageAmountOverride: pendingUsageOverride.value }),
        }),
      });
      const data = (await response.json()) as AssetRegisterApiResponse;

      if (!response.ok || !data.ok || !data.item) {
        throw new Error(data.error ?? 'Failed to save usage override.');
      }

      const updatedUsageMode = getAssetSettingsUsageMode(data.item);
      syncUpdatedAsset(data.item);
      setAssetDraft(buildDraftFromAsset(data.item));
      setAssetSettingsUsageInput(formatAssetSettingsUsageInput(data.item, updatedUsageMode));
      setNotice({ tone: 'success', message: getAssetSettingsUsageSuccessMessage(pendingUsageOverride.mode) });
      closeAssetSettingsModal();
    } catch (error) {
      setAssetSettingsError(error instanceof Error ? error.message : 'Failed to save usage override.');
    } finally {
      setPendingUsageOverride(null);
      setIsSavingAssetSettings(false);
    }
  }

  function applyStatusDraftToAssetDraft(current: AssetDraft, nextStatusDraft: AssetStatusDraft, nextKind: AssetKind): AssetDraft {
    const licenseApplicable = assetKindSupportsLicensing(nextKind);
    const insuranceStatus = nextStatusDraft.insuranceStatus;
    const licenseStatus: AssetStatusChoice = licenseApplicable ? nextStatusDraft.licenseStatus : 'not_applicable';

    return {
      ...current,
      financeStatus: nextStatusDraft.financeStatus,
      isFinanced: nextStatusDraft.financeStatus === 'yes',
      financeNote: ['yes', 'paid'].includes(nextStatusDraft.financeStatus) ? nextStatusDraft.financeNote : '',
      insuranceStatus,
      isInsured: insuranceStatus === 'yes',
      insuredValue: insuranceStatus === 'yes' ? nextStatusDraft.insuredValueExVat : '',
      insuranceNote: insuranceStatus === 'yes' ? nextStatusDraft.insuranceNote : '',
      licenseStatus,
      isLicensed: licenseStatus === 'yes',
      licenseRegistrationNumber: licenseStatus === 'yes' ? normalizeLicenseRegistrationText(nextStatusDraft.licenseRegistrationNumber) : '',
    };
  }

  function setAssetStatusDraftWithSync(updater: (current: AssetStatusDraft) => AssetStatusDraft) {
    setAssetStatusDraft((current) => {
      const nextStatusDraft = updater(current);
      setAssetDraft((draft) => applyStatusDraftToAssetDraft(draft, nextStatusDraft, assetFormKind));
      return nextStatusDraft;
    });
  }

  function setAssetFinanceStatus(nextStatus: FinanceStatusChoice) {
    const keepFinanceHistory = nextStatus === 'yes' || nextStatus === 'paid';
    setAssetStatusDraftWithSync((current) => ({
      ...current,
      financeStatus: nextStatus,
      financeType: keepFinanceHistory ? current.financeType : '',
      financeCurrentOutstandingExVat: nextStatus === 'yes' ? current.financeCurrentOutstandingExVat : '',
      financierName: keepFinanceHistory ? current.financierName : '',
      financeNote: keepFinanceHistory ? current.financeNote : '',
      financeBoughtWhen: current.financeBoughtWhen,
      financeBoughtForExVat: current.financeBoughtForExVat,
      financeOriginalAmountExVat: keepFinanceHistory ? current.financeOriginalAmountExVat : '',
      financeMonthlyPaymentExVat: keepFinanceHistory ? current.financeMonthlyPaymentExVat : '',
      financeInterestRatePercent: keepFinanceHistory ? current.financeInterestRatePercent : '',
      financeTermMonths: keepFinanceHistory ? current.financeTermMonths : '',
      financeBalloonPaymentExVat: keepFinanceHistory ? current.financeBalloonPaymentExVat : '',
      financeSettlementDate: keepFinanceHistory ? current.financeSettlementDate : '',
      financeReferenceNumber: keepFinanceHistory ? current.financeReferenceNumber : '',
    }));
    if (!keepFinanceHistory) {
      setBulkFinanceAssetIds(editingAsset ? [editingAsset.id] : []);
      setBulkFinanceAssetPickerOpen(false);
    }
  }

  function setAssetFinanceType(nextFinanceType: string) {
    updateAssetStatusDraftField('financeType', nextFinanceType);
    if (nextFinanceType === 'bulk_group' && editingAsset) {
      setBulkFinanceAssetIds((current) => current.includes(editingAsset.id) ? current : [editingAsset.id, ...current]);
      return;
    }
    setBulkFinanceAssetIds(editingAsset ? [editingAsset.id] : []);
    setBulkFinanceAssetPickerOpen(false);
  }

  function toggleBulkFinanceAsset(assetId: string) {
    if (assetId === editingAsset?.id) return;
    setBulkFinanceAssetIds((current) => current.includes(assetId)
      ? current.filter((id) => id !== assetId)
      : [...current, assetId]);
  }

  function setAssetInsuranceStatus(nextStatus: AssetStatusChoice) {
    setAssetStatusDraftWithSync((current) => ({
      ...current,
      insuranceStatus: nextStatus,
      insuredValueExVat: nextStatus === 'yes' ? current.insuredValueExVat : '',
      insuranceInsurerName: nextStatus === 'yes' ? current.insuranceInsurerName : '',
      insurancePolicyNumber: nextStatus === 'yes' ? current.insurancePolicyNumber : '',
      insuranceRenewalDate: nextStatus === 'yes' ? current.insuranceRenewalDate : '',
      insuranceNote: nextStatus === 'yes' ? current.insuranceNote : '',
    }));
  }

  function handleInsuredValueChange(value: string) {
    const formattedValue = formatRegisterValueInput(value);
    const insuredValue = parseRegisterValueInput(formattedValue);
    const hasValidInsuredValue = formattedValue.trim() !== '' && insuredValue > 0;

    setAssetStatusDraftWithSync((current) => ({
      ...current,
      insuredValueExVat: formattedValue,
      insuranceStatus: hasValidInsuredValue ? 'yes' : current.insuranceStatus,
    }));
  }

  function setAssetLicenseStatus(nextStatus: AssetStatusChoice) {
    const licenseApplicable = assetKindSupportsLicensing(assetFormKind);
    setAssetStatusDraftWithSync((current) => ({
      ...current,
      licenseStatus: licenseApplicable ? nextStatus : 'not_applicable',
      licenseRegistrationNumber:
        licenseApplicable && nextStatus === 'yes' ? normalizeLicenseRegistrationText(current.licenseRegistrationNumber) : '',
      licenseRenewalDate: licenseApplicable && nextStatus === 'yes' ? current.licenseRenewalDate : '',
      licenseNote: licenseApplicable && nextStatus === 'yes' ? current.licenseNote : '',
    }));
  }

  function updateAssetStatusDraftField<K extends keyof AssetStatusDraft>(field: K, value: AssetStatusDraft[K]) {
    setAssetStatusDraftWithSync((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function openAssetStatusEditView(section: AssetStatusSection) {
    if (section === 'license' && !assetKindSupportsLicensing(assetFormKind)) return;
    if (section === 'finance' && editingAsset) void loadFinanceAcquisitionDetails(editingAsset);
    setAssetStatusEditView(section);
    setAssetStatusAdvancedOpen(false);
    setAssetStatusError('');
  }

  function openQuickAssetStatusEditor(
    asset: RegisterAsset,
    section: AssetStatusSection,
    trigger: HTMLElement | null = null,
  ) {
    if (!canUseOwnerOnlyAssetActions) return;
    if (section === 'license' && !assetKindSupportsLicensing(asset.kind)) return;

    rememberAssetModalReturn(asset, 'card', `status-${section}`, trigger);
    setExpandedAssetId(asset.id);
    pendingPhotoFilesRef.current.forEach((entry) => revokePhotoPreviewUrl(entry.previewUrl));
    pendingPhotoFilesRef.current = [];

    setPendingPhotoFiles([]);
    setPendingDocumentFiles([]);
    setMainPhotoSelection(null);
    setEditingAssetId(asset.id);
    setAssetDraft(buildDraftFromAsset(asset));
    setAssetStatusDraft(buildAssetStatusDraftFromAsset(asset));
    setAssetStatusEditView(section);
    setAssetStatusQuickOrigin('detail-card');
    setAssetStatusAdvancedOpen(false);
    setAssetStatusError('');
    setIsSavingAssetStatus(false);
    setBulkFinanceAssetIds([asset.id]);
    setBulkFinanceAssetPickerOpen(false);
    setBulkFinanceAssetSearch('');
    setManualAssetStep(3);
    setHasManualAssetKindSelection(true);
    setIsAssetSettingsModalOpen(false);
    setIsManualConversionConfirmOpen(false);
    setPendingUsageOverride(null);
    setAssetSettingsError('');
    setIsAssetModalOpen(true);
    if (section === 'finance') void loadFinanceAcquisitionDetails(asset);
  }

  async function loadFinanceAcquisitionDetails(asset: RegisterAsset) {
    try {
      const response = await fetch(`/api/asset-lifecycle?assetId=${encodeURIComponent(asset.id)}`, { credentials: 'include', cache: 'no-store' });
      const data = await response.json().catch(() => null) as {
        ok?: boolean;
        acquisition?: { newlyAcquired?: boolean; acquisitionDate?: string; acquisitionAmountExVat?: number | null; note?: string; sourceDocumentReference?: string } | null;
      } | null;
      if (!response.ok || !data?.ok || !data.acquisition) return;
      const acquisitionDate = data.acquisition.acquisitionDate || '';
      const acquisitionAmount = data.acquisition.acquisitionAmountExVat === null || typeof data.acquisition.acquisitionAmountExVat === 'undefined'
        ? ''
        : formatRegisterValueInput(data.acquisition.acquisitionAmountExVat);
      setAcquisitionDetailsDraft({
        newlyAcquired: data.acquisition.newlyAcquired ?? false,
        acquisitionDate,
        acquisitionAmountExVat: acquisitionAmount,
        note: data.acquisition.note || '',
        sourceDocumentReference: data.acquisition.sourceDocumentReference || '',
      });
      setAssetStatusDraft((current) => ({
        ...current,
        financeBoughtWhen: acquisitionDate || current.financeBoughtWhen,
        financeBoughtForExVat: acquisitionAmount || current.financeBoughtForExVat,
      }));
    } catch {
      // Finance can still be edited when older assets do not yet have lifecycle details.
    }
  }

  function openMappedStatusEditor(asset: RegisterAsset, trigger: HTMLElement | null = null) {
    if (!canUseOwnerOnlyAssetActions) return;
    rememberAssetModalReturn(asset, 'card', 'status-mapped', trigger);
    setExpandedAssetId(asset.id);
    openAssetSettingsModalForAsset(asset, 'location');
  }

  function statusMoneyInputIsValid(value: string): boolean {
    if (!value.trim()) return true;
    const parsed = parseRegisterValueInput(value);
    return parsed !== null && Number.isFinite(parsed) && parsed >= 0;
  }

  function statusNumberInputIsValid(value: string): boolean {
    if (!value.trim()) return true;
    const parsed = optionalNumberForStatusPayload(value);
    return parsed !== null && Number.isFinite(parsed) && parsed >= 0;
  }

  function statusWholeNumberInputIsValid(value: string): boolean {
    if (!value.trim()) return true;
    const parsed = optionalNumberForStatusPayload(value);
    return parsed !== null && Number.isFinite(parsed) && parsed >= 0 && Number.isInteger(parsed);
  }

  function validateAssetStatusDraft(section: AssetStatusSection, showFeedback = true): boolean {
    if (section === 'finance') {
      if (assetStatusDraft.financeType === 'bulk_group' && editingAsset && bulkFinanceAssetIds.length < 2) {
        if (showFeedback) setAssetStatusError('Choose at least one additional asset for bulk finance.');
        return false;
      }
      const moneyChecks: Array<[string, string]> = [
        ['Current outstanding amount', assetStatusDraft.financeCurrentOutstandingExVat],
        ['Bought for', assetStatusDraft.financeBoughtForExVat],
        ['Original financed amount', assetStatusDraft.financeOriginalAmountExVat],
        ['Monthly payment', assetStatusDraft.financeMonthlyPaymentExVat],
        ['Balloon / residual amount', assetStatusDraft.financeBalloonPaymentExVat],
      ];

      const invalidMoney = moneyChecks.find(([, value]) => !statusMoneyInputIsValid(value));
      if (invalidMoney) {
        if (showFeedback) setAssetStatusError(`${invalidMoney[0]} must be a valid amount.`);
        return false;
      }

      if (!statusNumberInputIsValid(assetStatusDraft.financeInterestRatePercent)) {
        if (showFeedback) setAssetStatusError('Interest rate must be a valid percentage.');
        return false;
      }

      if (!statusWholeNumberInputIsValid(assetStatusDraft.financeTermMonths)) {
        if (showFeedback) setAssetStatusError('Finance term must be a valid whole number of months.');
        return false;
      }
    }

    if (section === 'insurance' && !statusMoneyInputIsValid(assetStatusDraft.insuredValueExVat)) {
      if (showFeedback) setAssetStatusError('Insured amount must be a valid amount.');
      return false;
    }

    if (showFeedback) setAssetStatusError('');
    return true;
  }

  function buildAssetStatusPayload(section: AssetStatusSection, draft: AssetStatusDraft, asset: RegisterAsset) {
    const licenseApplicable = assetKindSupportsLicensing(asset.kind);
    const statusSpecsJson = buildStatusSpecsFragment(draft, licenseApplicable);

    if (section === 'finance') {
      const hasFinanceHistory = draft.financeStatus === 'yes' || draft.financeStatus === 'paid';
      return {
        assetId: asset.id,
        section,
        financeStatus: draft.financeStatus,
        financeType: hasFinanceHistory ? draft.financeType || null : null,
        financeCurrentOutstandingExVat: draft.financeStatus === 'yes' ? optionalMoneyForStatusPayload(draft.financeCurrentOutstandingExVat) : null,
        financierName: hasFinanceHistory ? statusOptionalText(draft.financierName) : '',
        financeNote: hasFinanceHistory ? statusOptionalText(draft.financeNote) : '',
        financeBoughtWhen: statusOptionalText(draft.financeBoughtWhen),
        financeBoughtForExVat: optionalMoneyForStatusPayload(draft.financeBoughtForExVat),
        financeOriginalAmountExVat: hasFinanceHistory ? optionalMoneyForStatusPayload(draft.financeOriginalAmountExVat) : null,
        financeMonthlyPaymentExVat: hasFinanceHistory ? optionalMoneyForStatusPayload(draft.financeMonthlyPaymentExVat) : null,
        financeInterestRatePercent: hasFinanceHistory ? optionalNumberForStatusPayload(draft.financeInterestRatePercent) : null,
        financeTermMonths: hasFinanceHistory ? optionalNumberForStatusPayload(draft.financeTermMonths) : null,
        financeBalloonPaymentExVat: hasFinanceHistory ? optionalMoneyForStatusPayload(draft.financeBalloonPaymentExVat) : null,
        financeSettlementDate: hasFinanceHistory ? statusOptionalText(draft.financeSettlementDate) : '',
        financeReferenceNumber: hasFinanceHistory ? statusOptionalText(draft.financeReferenceNumber) : '',
        specsJson: statusSpecsJson,
      };
    }

    if (section === 'insurance') {
      return {
        assetId: asset.id,
        section,
        insuranceStatus: draft.insuranceStatus,
        insuredValueExVat: draft.insuranceStatus === 'yes' ? optionalMoneyForStatusPayload(draft.insuredValueExVat) : null,
        insuranceInsurerName: draft.insuranceStatus === 'yes' ? statusOptionalText(draft.insuranceInsurerName) : '',
        insurancePolicyNumber: draft.insuranceStatus === 'yes' ? statusOptionalText(draft.insurancePolicyNumber) : '',
        insuranceRenewalDate: draft.insuranceStatus === 'yes' ? statusOptionalText(draft.insuranceRenewalDate) : '',
        insuranceNote: draft.insuranceStatus === 'yes' ? statusOptionalText(draft.insuranceNote) : '',
        specsJson: statusSpecsJson,
      };
    }

    return {
      assetId: asset.id,
      section,
      licenseStatus: licenseApplicable ? draft.licenseStatus : 'not_applicable',
      licenseRegistrationNumber:
        licenseApplicable && draft.licenseStatus === 'yes' ? normalizeLicenseRegistrationText(draft.licenseRegistrationNumber) : '',
      licenseRenewalDate: licenseApplicable && draft.licenseStatus === 'yes' ? statusOptionalText(draft.licenseRenewalDate) : '',
      licenseNote: licenseApplicable && draft.licenseStatus === 'yes' ? statusOptionalText(draft.licenseNote) : '',
      specsJson: statusSpecsJson,
    };
  }

  async function saveLinkedBulkFinanceAssets(currentAsset: RegisterAsset, draft: AssetStatusDraft): Promise<RegisterAsset[]> {
    if (draft.financeType !== 'bulk_group') return [];
    const linkedAssets = bulkFinanceAssetIds
      .filter((assetId) => assetId !== currentAsset.id)
      .map((assetId) => assets.find((asset) => asset.id === assetId))
      .filter((asset): asset is RegisterAsset => Boolean(asset));
    const updatedAssets: RegisterAsset[] = [];

    for (const linkedAsset of linkedAssets) {
      const linkedDraft: AssetStatusDraft = {
        ...buildAssetStatusDraftFromAsset(linkedAsset),
        financeStatus: draft.financeStatus,
        financeType: 'bulk_group',
        financierName: draft.financierName,
        financeNote: draft.financeNote,
        financeSettlementDate: draft.financeSettlementDate,
        financeReferenceNumber: draft.financeReferenceNumber,
      };
      const response = await fetch('/api/asset-register/status', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(buildAssetStatusPayload('finance', linkedDraft, linkedAsset)),
      });
      const data = (await response.json().catch(() => null)) as AssetRegisterApiResponse | null;
      if (!response.ok || !data?.ok || !data.item) {
        throw new Error(data?.error ?? `Finance could not be linked to ${linkedAsset.title}.`);
      }
      updatedAssets.push(data.item);
    }

    return updatedAssets;
  }

  async function saveAssetStatusSection(section: AssetStatusSection) {
    if (!validateAssetStatusDraft(section)) return;

    const normalizedStatusDraft: AssetStatusDraft = {
      ...assetStatusDraft,
      licenseRegistrationNumber: normalizeLicenseRegistrationText(assetStatusDraft.licenseRegistrationNumber),
      licenseStatus: assetKindSupportsLicensing(assetFormKind) ? assetStatusDraft.licenseStatus : 'not_applicable',
    };

    setAssetStatusDraft(normalizedStatusDraft);
    setAssetDraft((current) => applyStatusDraftToAssetDraft(current, normalizedStatusDraft, assetFormKind));

    if (!editingAsset) {
      setAssetStatusEditView('hub');
      setAssetStatusAdvancedOpen(false);
      setAssetStatusError('');
      return;
    }

    setIsSavingAssetStatus(true);
    setAssetStatusError('');

    try {
      const response = await fetch('/api/asset-register/status', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(buildAssetStatusPayload(section, normalizedStatusDraft, editingAsset)),
      });
      const data = (await response.json().catch(() => null)) as AssetRegisterApiResponse | null;

      if (!response.ok || !data?.ok || !data.item) {
        throw new Error(data?.error ?? 'Failed to update asset status.');
      }

      if (section === 'finance' && normalizedStatusDraft.financeBoughtWhen.trim()) {
        const acquisitionResponse = await fetch('/api/asset-lifecycle', {
          method: 'PUT',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            assetId: editingAsset.id,
            newlyAcquired: acquisitionDetailsDraft.newlyAcquired ?? false,
            acquisitionDate: normalizedStatusDraft.financeBoughtWhen,
            acquisitionAmountExVat: normalizedStatusDraft.financeBoughtForExVat,
            note: acquisitionDetailsDraft.note,
            sourceDocumentReference: acquisitionDetailsDraft.sourceDocumentReference,
          }),
        });
        const acquisitionData = await acquisitionResponse.json().catch(() => null) as { ok?: boolean; error?: string } | null;
        if (!acquisitionResponse.ok || !acquisitionData?.ok) {
          throw new Error(acquisitionData?.error || 'Finance was saved, but acquisition details could not be updated.');
        }
      }

      const linkedBulkAssets = section === 'finance'
        ? await saveLinkedBulkFinanceAssets(editingAsset, normalizedStatusDraft)
        : [];

      syncSettingsUpdatedAsset(data.item);
      linkedBulkAssets.forEach(syncSettingsUpdatedAsset);
      setAssetDraft(buildDraftFromAsset(data.item));
      setAssetStatusDraft(buildAssetStatusDraftFromAsset(data.item));
      setExpandedAssetId(data.item.id);
      setNotice({ tone: 'success', message: linkedBulkAssets.length
        ? `Finance linked to ${linkedBulkAssets.length + 1} assets.`
        : 'Asset status updated.' });

      if (assetStatusQuickOrigin === 'detail-card') {
        const restoredPreviousAction = closeAssetModal();
        if (!restoredPreviousAction) scrollToAssetCard(data.item.id);
      } else {
        setAssetStatusEditView('hub');
        setAssetStatusAdvancedOpen(false);
      }
    } catch (error) {
      setAssetStatusError(error instanceof Error ? error.message : 'Failed to update asset status.');
    } finally {
      setIsSavingAssetStatus(false);
    }
  }

  async function finishAssetStatusSection(section: AssetStatusSection) {
    const savesBulkFinanceImmediately = section === 'finance' && assetStatusDraft.financeType === 'bulk_group';
    if (editingAsset && assetStatusQuickOrigin !== 'detail-card' && !savesBulkFinanceImmediately) {
      if (!validateAssetStatusDraft(section)) return;
      setAssetStatusEditView('hub');
      setAssetStatusAdvancedOpen(false);
      setAssetStatusError('');
      return;
    }

    await saveAssetStatusSection(section);
  }

  function validateAssetDetailsDraft(showFeedback = true): boolean {
    const value = parseRegisterValueInput(assetDraft.value);
    const isLandProperty = assetFormKind === 'property' && assetDraft.propertyAssetSubtype === 'land';
    const replacementPriceRequired = assetFormKind !== 'stock' && !isLandProperty;
    const replacementPrice = replacementPriceRequired ? parseRegisterValueInput(assetDraft.replacementPrice) : value;
    const hasStockPeakValue = assetFormKind === 'stock' && assetDraft.stockPeakValue.trim() !== '';
    const stockPeakValue = hasStockPeakValue ? parseRegisterValueInput(assetDraft.stockPeakValue) : null;
    const hasYearModel = assetDraft.yearModel.trim() !== '';
    const yearModel = hasYearModel ? Number(assetDraft.yearModel) : null;
    const hasHours = showUsageHoursField && assetDraft.hours.trim() !== '';
    const hours = hasHours ? parseUsageAmountInput(assetDraft.hours) : null;
    const hasLifeWorkedPercent = (showPercentUsageField || showLifeWorkedPercentField) && assetDraft.lifeWorkedPercent.trim() !== '';
    const lifeWorkedPercent = hasLifeWorkedPercent ? Number(assetDraft.lifeWorkedPercent) : null;
    const hasInsuredValue = assetStatusDraft.insuredValueExVat.trim() !== '';
    const insuredValueExVat = hasInsuredValue ? parseRegisterValueInput(assetStatusDraft.insuredValueExVat) : null;
    const usageErrorLabel = assetDraft.usageMetric === 'km' ? 'Kilometres' : 'Machine hours';

    if (
      assetFormKind === 'manual' &&
      (!assetDraft.generalAssetCategory || !assetDraft.insuranceUseContext || !assetDraft.insuranceMobility)
    ) {
      if (showFeedback) {
        setNotice({
          tone: 'error',
          message: 'Choose what the asset is, where it is used and whether it stays at one place or moves around.',
        });
      }
      return false;
    }

    const hasStartedPropertyClassification = Boolean(
      assetDraft.propertyAssetSubtype || assetDraft.propertyInterest || assetDraft.insuranceUseContext,
    );
    if (
      assetFormKind === 'property' &&
      (!editingAsset || hasStartedPropertyClassification) &&
      (!assetDraft.propertyAssetSubtype || !assetDraft.insuranceUseContext || !assetDraft.propertyInterest)
    ) {
      if (showFeedback) {
        setNotice({
          tone: 'error',
          message: 'Choose the property type, how it is used and your interest in the property.',
        });
      }
      return false;
    }

    const hasStartedStockClassification = Boolean(
      assetDraft.stockAssetSubtype || assetDraft.stockValuationBasis || assetDraft.stockMovement,
    );
    if (
      assetFormKind === 'stock' &&
      (!editingAsset || hasStartedStockClassification) &&
      (!assetDraft.stockAssetSubtype || !assetDraft.stockValuationBasis || !assetDraft.stockMovement)
    ) {
      if (showFeedback) {
        setNotice({
          tone: 'error',
          message: 'Choose the stock type, valuation basis and normal movement pattern.',
        });
      }
      return false;
    }

    if (!assetDraft.title.trim() || value <= 0) {
      if (showFeedback) setNotice({ tone: 'error', message: 'Asset title and current value are required before moving to the next step.' });
      return false;
    }

    if (replacementPriceRequired && (!replacementPrice || replacementPrice <= 0)) {
      if (showFeedback) setNotice({ tone: 'error', message: 'Replacement price is required and must be greater than zero.' });
      return false;
    }

    if (hasStockPeakValue && (!stockPeakValue || stockPeakValue <= 0)) {
      if (showFeedback) setNotice({ tone: 'error', message: 'Peak stock value must be greater than zero when entered.' });
      return false;
    }

    if (stockPeakValue !== null && stockPeakValue < value) {
      if (showFeedback) setNotice({ tone: 'error', message: 'Peak stock value cannot be lower than the current stock value.' });
      return false;
    }

    if (hasInsuredValue && (!insuredValueExVat || insuredValueExVat <= 0)) {
      if (showFeedback) setNotice({ tone: 'error', message: 'Insured value must be greater than zero when entered.' });
      return false;
    }

    if (hasYearModel && (!Number.isFinite(yearModel) || Number(yearModel) < 1800 || Number(yearModel) > new Date().getFullYear() + 1)) {
      if (showFeedback) setNotice({ tone: 'error', message: `${yearFieldLabel} must be a valid year.` });
      return false;
    }

    if (hasHours && (!Number.isFinite(hours) || Number(hours) < 0)) {
      if (showFeedback) setNotice({ tone: 'error', message: `${usageErrorLabel} must be zero or greater.` });
      return false;
    }

    if (hasLifeWorkedPercent && (!Number.isFinite(lifeWorkedPercent) || Number(lifeWorkedPercent) < 0 || Number(lifeWorkedPercent) > 100)) {
      if (showFeedback) setNotice({ tone: 'error', message: 'Usage must be between 0% and 100%.' });
      return false;
    }

    const savedUsageReading = getAssetSavedUsageReading(editingAsset);
    if (editingAsset && hasHours && savedUsageReading !== null && Math.round(Number(hours)) < savedUsageReading) {
      if (showFeedback) {
        setNotice({
          tone: 'error',
          message: USAGE_READING_SETTINGS_ERROR,
        });
      }
      return false;
    }

    const currentLifeWorkedPercent = editingAsset ? getAssetLifeWorkedPercent(editingAsset) : null;
    if (
      editingAsset &&
      hasLifeWorkedPercent &&
      currentLifeWorkedPercent !== null &&
      isLifeWorkedPercentDecrease(Number(lifeWorkedPercent), currentLifeWorkedPercent)
    ) {
      if (showFeedback) {
        setNotice({
          tone: 'error',
          message: LIFETIME_PERCENT_SETTINGS_ERROR,
        });
      }
      return false;
    }

    return true;
  }

  function goToPreviousManualAssetStep() {
    setManualAssetStep((current) => {
      if (current <= 1) return 1;
      return (current - 1) as ManualAssetStep;
    });
  }

  function openAssetFormSection(step: ManualAssetStep) {
    if (step === 1 || manualAssetStep === step) {
      return;
    }

    setAssetStatusEditView('hub');
    setAssetStatusError('');
    setManualAssetStep(step);
  }

  function goToNextManualAssetStep() {
    if (manualAssetStep === 2 && !validateAssetDetailsDraft()) {
      return;
    }

    setManualAssetStep((current) => {
      if (current >= 4) return 4;
      return (current + 1) as ManualAssetStep;
    });
  }

  function scrollToAssetCard(assetId: string) {
    window.setTimeout(() => {
      document.getElementById(`asset-card-${assetId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 180);
  }

  async function loadDealerTrackingStatus(assetId: string): Promise<DealerMaintenanceAccessSummary[]> {
    try {
      const response = await fetch(`/api/dealer-maintenance-access?assetId=${encodeURIComponent(assetId)}`, {
        credentials: 'include',
        cache: 'no-store',
      });
      const payload = await response.json().catch(() => null) as {
        ok?: boolean;
        trackingAccess?: DealerMaintenanceAccessSummary[];
      } | null;
      const entries = response.ok && payload?.ok && Array.isArray(payload.trackingAccess)
        ? payload.trackingAccess
        : [];
      setActiveDealerTrackingByAssetId((current) => ({ ...current, [assetId]: entries.length > 0 }));
      return entries;
    } catch {
      setActiveDealerTrackingByAssetId((current) => ({ ...current, [assetId]: false }));
      return [];
    }
  }

  function openActionDialog(asset: RegisterAsset) {
    setOwnerAssetCommandPanel(null);
    if (typeof window !== 'undefined') {
      setOwnerCommandReturnLocation(`${window.location.pathname}${window.location.search}`);
    }
    setActiveAsset(asset);
    setActiveDealerTrackingByAssetId((current) => ({ ...current, [asset.id]: false }));
    void loadDealerTrackingStatus(asset.id);
  }

  function closeActionDialog() {
    setOwnerAssetCommandPanel(null);
    setIsAssetReportModalOpen(false);
    setIsPricingModalOpen(false);
    setPricingPreview(null);
    setIsLoadingPricingPreview(false);
    setIsSavingPricingPreview(false);
    setIsQrModalOpen(false);
    setCopiedScanLinkAssetId(null);
    setDeleteCandidateAsset(null);
    setIsDealerTrackingSettingsOpen(false);
    setDealerTrackingAccess([]);
    setActiveAsset(null);
  }

  function preserveLicenseRenewalAlert(previous: RegisterAsset | null | undefined, nextAsset: RegisterAsset): RegisterAsset {
    if (!previous) return nextAsset;

    const shouldPreserveLicenseAlert = typeof nextAsset.licenseRenewalAlert === 'undefined';
    const shouldPreserveDealerCorrection = typeof nextAsset.dealerAssetCorrection === 'undefined';
    if (!shouldPreserveLicenseAlert && !shouldPreserveDealerCorrection) return nextAsset;

    return {
      ...nextAsset,
      ...(shouldPreserveLicenseAlert ? { licenseRenewalAlert: previous.licenseRenewalAlert ?? null } : {}),
      ...(shouldPreserveDealerCorrection ? { dealerAssetCorrection: previous.dealerAssetCorrection ?? null } : {}),
    };
  }

  function syncUpdatedAsset(nextAsset: RegisterAsset) {
    if (assetModalReturnRef.current?.assetId === nextAsset.id) {
      assetModalReturnRef.current = {
        ...assetModalReturnRef.current,
        asset: preserveLicenseRenewalAlert(assetModalReturnRef.current.asset, nextAsset),
      };
    }
    setAssets((current) => current.map((asset) => (
      asset.id === nextAsset.id ? preserveLicenseRenewalAlert(asset, nextAsset) : asset
    )));
    setActiveAsset((current) => (current?.id === nextAsset.id ? preserveLicenseRenewalAlert(current, nextAsset) : current));
    setMarketplaceAsset((current) => (current?.id === nextAsset.id ? preserveLicenseRenewalAlert(current, nextAsset) : current));
    setProjectionAsset((current) => (current?.id === nextAsset.id ? preserveLicenseRenewalAlert(current, nextAsset) : current));
  }

  function syncSettingsUpdatedAsset(nextAsset: RegisterAsset) {
    if (assetModalReturnRef.current?.assetId === nextAsset.id) {
      assetModalReturnRef.current = {
        ...assetModalReturnRef.current,
        asset: preserveLicenseRenewalAlert(assetModalReturnRef.current.asset, nextAsset),
      };
    }
    setAssets((current) => current.map((asset) => (asset.id === nextAsset.id ? preserveLicenseRenewalAlert(asset, nextAsset) : asset)));
    setActiveAsset((current) => (current?.id === nextAsset.id ? preserveLicenseRenewalAlert(current, nextAsset) : current));
    setMarketplaceAsset((current) => (current?.id === nextAsset.id ? preserveLicenseRenewalAlert(current, nextAsset) : current));
    setProjectionAsset((current) => (current?.id === nextAsset.id ? preserveLicenseRenewalAlert(current, nextAsset) : current));
    setQuoteAsset((current) => (current?.id === nextAsset.id ? preserveLicenseRenewalAlert(current, nextAsset) : current));
  }

  function syncMediaUpdatedAsset(nextAsset: RegisterAsset) {
    setAssets((current) => current.map((asset) => (asset.id === nextAsset.id ? preserveLicenseRenewalAlert(asset, nextAsset) : asset)));
    setActiveAsset((current) => (current?.id === nextAsset.id ? preserveLicenseRenewalAlert(current, nextAsset) : current));
    setMarketplaceAsset((current) => (current?.id === nextAsset.id ? preserveLicenseRenewalAlert(current, nextAsset) : current));
    setProjectionAsset((current) => (current?.id === nextAsset.id ? preserveLicenseRenewalAlert(current, nextAsset) : current));
  }

  function removeQuoteMap() {
    if (quoteViewportTimeoutRef.current !== null) {
      window.clearTimeout(quoteViewportTimeoutRef.current);
      quoteViewportTimeoutRef.current = null;
    }

    if (quoteLeafletMapRef.current) {
      quoteLeafletMapRef.current.remove();
      quoteLeafletMapRef.current = null;
      quoteMarkerLayerRef.current = null;
    }
  }

  function prepareQuoteLocationStep(asset: RegisterAsset | null) {
    quoteInitialMapLocationRef.current = null;
    quoteFitResultsRef.current = false;
    quotePartnerSearchRef.current = '';
    setQuoteDirectoryStage('location');
    setQuoteLocationInput(defaultQuoteLocationInput(asset, accountProfile));
    setQuoteLocationError('');
    setIsResolvingQuoteLocation(false);
    setIsQuoteMapExpanded(false);
  }

  function resetAssetQuoteState(nextScope: QuoteScope = 'asset') {
    quotePartnerRequestRef.current += 1;
    quoteFitResultsRef.current = false;
    quoteInitialMapLocationRef.current = null;
    setQuoteScope(nextScope);
    setSelectedQuoteLeadType(null);
    setQuoteDirectoryStage('location');
    setQuoteLocationInput('');
    setQuoteLocationError('');
    setIsResolvingQuoteLocation(false);
    setIsQuoteMapExpanded(false);
    setQuotePartners([]);
    setSelectedQuotePartnerIds([]);
    setQuotePartnerSearch('');
    setQuoteLeadStep(null);
    setQuoteConsentAccepted(false);
    setQuoteTrackMaintenance(false);
    setQuoteTrackingPermissions({ ...DEFAULT_DEALER_MAINTENANCE_PERMISSIONS });
    setSelectedDealerShareAssetIds([]);
    setIsQuoteTrackingSettingsOpen(false);
    setQuoteOwnerMessage('');
    setQuoteIncludePhotos(true);
    setQuoteIncludeDocuments(true);
    setQuoteIncludeScanHistory(false);
    setQuoteAllowDirectUpdates(false);
    setQuoteIncludeFuelLedger(true);
    setQuoteIncludeCostLedger(true);
    setIsLoadingQuotePartners(false);
    setIsSendingQuoteLead(false);
    removeQuoteMap();
  }

  function openAssetQuoteOptions(asset: RegisterAsset) {
    setNotice(null);
    setIsAssetFilterOpen(false);
    setAssetGroupShareTarget(null);
    setAssetShareDestination('choice');
    resetAssetQuoteState('asset');
    setQuoteAsset(asset);
  }

  function closeAssetQuoteModal() {
    if (isSendingQuoteLead) return;
    setQuoteAsset(null);
    setAssetGroupShareTarget(null);
    setAssetShareDestination('choice');
    resetAssetQuoteState('asset');
  }

  async function loadQuotePartners(
    leadType: AssetLeadType | null = selectedQuoteLeadType,
    searchValue = quotePartnerSearch,
    bounds?: { west: number; south: number; east: number; north: number },
  ): Promise<PartnerDirectoryEntry[]> {
    const option = quoteOptionForLeadType(leadType);

    if (!option) {
      setQuotePartners([]);
      setSelectedQuotePartnerIds([]);
      return [];
    }

    const requestId = quotePartnerRequestRef.current + 1;
    quotePartnerRequestRef.current = requestId;
    setIsLoadingQuotePartners(true);

    try {
      const params = new URLSearchParams({ type: option.partnerType });
      if (searchValue.trim()) params.set('search', searchValue.trim());
      const currentMapBounds = !bounds && quoteLeafletMapRef.current
        ? quoteLeafletMapRef.current.getBounds()
        : null;
      const effectiveBounds = bounds ?? (currentMapBounds ? {
        west: currentMapBounds.getWest(),
        south: currentMapBounds.getSouth(),
        east: currentMapBounds.getEast(),
        north: currentMapBounds.getNorth(),
      } : null);
      if (effectiveBounds) {
        params.set('west', String(effectiveBounds.west));
        params.set('south', String(effectiveBounds.south));
        params.set('east', String(effectiveBounds.east));
        params.set('north', String(effectiveBounds.north));
      }

      const response = await fetch(`/api/partners?${params.toString()}`, { cache: 'no-store', credentials: 'include' });
      const payload = await response.json().catch(() => null);
      const data = payload as PartnerDirectoryApiResponse | null;

      if (!response.ok || !data?.ok || !Array.isArray(data.partners)) {
        throw new Error(extractApiError(payload, 'Failed to load partner directory.'));
      }

      if (requestId !== quotePartnerRequestRef.current) return [];

      const loadedPartners = data.partners;
      setQuotePartners((current) => {
        const preservedSelections = current.filter((partner) => selectedQuotePartnerIds.includes(partner.userId));
        const nextPartners = new Map(
          [...preservedSelections, ...loadedPartners].map((partner) => [partner.userId, partner]),
        );
        return Array.from(nextPartners.values());
      });
      return loadedPartners;
    } catch (error) {
      if (requestId !== quotePartnerRequestRef.current) return [];
      setQuotePartners([]);
      setSelectedQuotePartnerIds([]);
      setNotice({ tone: 'error', message: error instanceof Error ? error.message : 'Failed to load partner directory.' });
      return [];
    } finally {
      if (requestId === quotePartnerRequestRef.current) setIsLoadingQuotePartners(false);
    }
  }

  function showQuoteMapForLocation(
    location: AssetSettingsApproximateMapLocation,
    label: string,
    options: { preservePartners?: boolean } = {},
  ) {
    removeQuoteMap();
    setIsQuoteMapExpanded(false);
    quoteInitialMapLocationRef.current = location;
    quoteFitResultsRef.current = false;
    quotePartnerSearchRef.current = '';
    setQuotePartnerSearch('');
    setQuoteLocationInput(label);
    setQuoteLocationError('');
    setSelectedQuotePartnerIds([]);
    if (!options.preservePartners) setQuotePartners([]);
    setQuoteDirectoryStage('map');
  }

  async function submitQuoteLocation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedQuoteOption || isResolvingQuoteLocation) return;

    const locationValue = quoteLocationInput.replace(/\s+/g, ' ').trim();
    if (locationValue.length < 2) {
      setQuoteLocationError('Enter a town, city or province to show nearby assistance.');
      return;
    }

    setQuoteLocationError('');
    const knownLocation = resolveQuoteLocationMapTarget(locationValue);
    if (knownLocation) {
      quotePartnerRequestRef.current += 1;
      showQuoteMapForLocation(knownLocation, locationValue);
      return;
    }

    setIsResolvingQuoteLocation(true);
    try {
      const matches = await loadQuotePartners(selectedQuoteOption.leadType, locationValue);
      const firstLocatedMatch = matches.find(hasQuotePartnerCoordinates);
      if (!firstLocatedMatch) {
        setQuoteLocationError('We could not place that area on the map. Try the nearest town or province.');
        return;
      }

      showQuoteMapForLocation({
        center: [Number(firstLocatedMatch.latitude), Number(firstLocatedMatch.longitude)],
        zoom: QUOTE_LOCATION_TOWN_ZOOM,
      }, locationValue, { preservePartners: true });
    } finally {
      setIsResolvingQuoteLocation(false);
    }
  }

  async function useCurrentQuoteLocation() {
    if (isResolvingQuoteLocation) return;
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setQuoteLocationError('Current location is not available in this browser. Enter your town or province instead.');
      return;
    }

    setQuoteLocationError('');
    setIsResolvingQuoteLocation(true);
    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: false,
          timeout: 10000,
          maximumAge: 300000,
        });
      });
      const latitude = position.coords.latitude;
      const longitude = position.coords.longitude;
      if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
        throw new Error('Your current location could not be read. Enter your town or province instead.');
      }

      quotePartnerRequestRef.current += 1;
      showQuoteMapForLocation({ center: [latitude, longitude], zoom: QUOTE_LOCATION_TOWN_ZOOM }, 'Current location');
    } catch (error) {
      const permissionDenied = typeof error === 'object' && error !== null && 'code' in error && Number((error as { code?: unknown }).code) === 1;
      setQuoteLocationError(permissionDenied
        ? 'Location permission was denied. Enter your town or province instead.'
        : error instanceof Error ? error.message : 'Your current location could not be read. Enter your town or province instead.');
    } finally {
      setIsResolvingQuoteLocation(false);
    }
  }

  function changeQuoteLocation() {
    if (isSendingQuoteLead) return;
    quotePartnerRequestRef.current += 1;
    removeQuoteMap();
    quoteInitialMapLocationRef.current = null;
    quoteFitResultsRef.current = false;
    quotePartnerSearchRef.current = '';
    setIsQuoteMapExpanded(false);
    setQuoteDirectoryStage('location');
    setQuoteLocationError('');
    setQuotePartnerSearch('');
    setQuotePartners([]);
    setSelectedQuotePartnerIds([]);
  }

  function openQuotePartnerPicker(leadType: AssetLeadType) {
    if (
      leadType === 'license_renewal'
      && quoteAsset
      && (
        readLicenseStatusChoice(quoteAsset) !== 'yes'
        || !readSpecsText(quoteAsset, ['licenseRenewalDate', 'license_renewal_date', 'licenceRenewalDate', 'licence_renewal_date'])
      )
    ) {
      const asset = quoteAsset;
      setQuoteAsset(null);
      resetAssetQuoteState('asset');
      openQuickAssetStatusEditor(asset, 'license');
      return;
    }

    setSelectedQuoteLeadType(leadType);
    prepareQuoteLocationStep(quoteAsset);
    setSelectedQuotePartnerIds([]);
    setQuotePartnerSearch('');
    setQuoteOwnerMessage('');
    setQuoteLeadStep(null);
    setQuoteConsentAccepted(false);
    setQuoteTrackMaintenance(false);
    setQuoteTrackingPermissions({ ...DEFAULT_DEALER_MAINTENANCE_PERMISSIONS });
    setIsQuoteTrackingSettingsOpen(false);
    setQuotePartners([]);
    setQuoteIncludePhotos(true);
    setQuoteIncludeDocuments(true);
    setQuoteIncludeScanHistory(false);
  }

  function goBackToQuoteOptions() {
    if (isFullRegisterQuoteLead) {
      setQuoteAsset(null);
      resetAssetQuoteState('asset');
      setIsRegisterShareModalOpen(true);
      return;
    }

    setSelectedQuoteLeadType(null);
    setQuoteDirectoryStage('location');
    setQuoteLocationInput('');
    setQuoteLocationError('');
    setIsResolvingQuoteLocation(false);
    setIsQuoteMapExpanded(false);
    quoteInitialMapLocationRef.current = null;
    setQuotePartners([]);
    setSelectedQuotePartnerIds([]);
    setQuotePartnerSearch('');
    setQuoteLeadStep(null);
    setQuoteConsentAccepted(false);
    setQuoteTrackMaintenance(false);
    setQuoteTrackingPermissions({ ...DEFAULT_DEALER_MAINTENANCE_PERMISSIONS });
    setIsQuoteTrackingSettingsOpen(false);

    removeQuoteMap();
  }

  function openAim4priceAssistanceMessage(partner: PartnerDirectoryEntry) {
    setSelectedQuotePartnerIds([partner.userId]);
    setQuoteConsentAccepted(false);
    setIsQuoteMapExpanded(false);
    setQuoteLeadStep('message');
  }

  function toggleQuotePartnerSelection(partner: PartnerDirectoryEntry) {
    setSelectedQuotePartnerIds((current) => {
      if (current.includes(partner.userId)) {
        return current.filter((partnerId) => partnerId !== partner.userId);
      }
      if (!partner.isAim4priceManaged) return [...current, partner.userId];

      // Every managed town points at a master assistance account. Keep only one
      // service area per master so a single request cannot be routed twice.
      const matchingMasterId = partner.masterAccountUserId;
      const withoutDuplicateMaster = current.filter((partnerId) => {
        const selectedPartner = quotePartners.find((entry) => entry.userId === partnerId);
        return !selectedPartner?.isAim4priceManaged
          || selectedPartner.masterAccountUserId !== matchingMasterId;
      });
      return [...withoutDuplicateMaster, partner.userId];
    });
    setQuoteConsentAccepted(false);
  }

  function openQuoteLeadMessage() {
    if (!selectedQuotePartners.length) {
      setNotice({ tone: 'error', message: 'Select at least one company first.' });
      return;
    }

    setQuoteConsentAccepted(false);
    setQuoteLeadStep('message');
  }

  function openQuoteTrackingSettings() {
    if (!quoteTrackMaintenance) {
      setQuoteTrackingPermissions({ ...DEFAULT_DEALER_MAINTENANCE_PERMISSIONS });
    }
    setIsQuoteTrackingSettingsOpen(true);
  }

  function closeQuoteTrackingSettings() {
    setIsQuoteTrackingSettingsOpen(false);
  }

  function cancelQuoteTrackingSettings() {
    if (!quoteTrackMaintenance) {
      setQuoteTrackingPermissions({ ...DEFAULT_DEALER_MAINTENANCE_PERMISSIONS });
    }
    setIsQuoteTrackingSettingsOpen(false);
  }

  function confirmQuoteTrackingSettings() {
    setQuoteTrackMaintenance(true);
    setIsQuoteTrackingSettingsOpen(false);
  }

  function closeQuoteLeadStep() {
    if (isSendingQuoteLead) return;
    setQuoteLeadStep(null);
    setQuoteConsentAccepted(false);
  }

  function goToQuoteLeadConsent() {
    if (!selectedQuotePartners.length || !selectedQuoteOption) {
      setNotice({ tone: 'error', message: 'Select at least one company first.' });
      return;
    }

    setQuoteConsentAccepted(false);
    setQuoteLeadStep('consent');
  }

  function goBackToQuoteLeadMessage() {
    if (isSendingQuoteLead) return;
    setQuoteConsentAccepted(false);
    setQuoteLeadStep('message');
  }

  async function handleSendAssetQuoteLead() {
    if (!selectedQuoteOption || !quoteAsset) {
      setNotice({ tone: 'error', message: 'Choose an asset quote option first.' });
      return;
    }

    const isSelectedRegisterAssetShare = isFullRegisterQuoteLead && (
      selectedQuoteOption.leadType === 'replacement_quote' ||
      selectedQuoteOption.leadType === 'license_renewal'
    );
    const leadAssetId = isSelectedRegisterAssetShare ? selectedDealerShareAssetIds[0] : quoteAsset.id;

    if (isSelectedRegisterAssetShare && !leadAssetId) {
      setNotice({ tone: 'error', message: `Choose at least one asset to share with the ${formatQuotePartnerType(selectedQuoteOption.partnerType).toLowerCase()}.` });
      return;
    }

    if (!selectedQuotePartners.length) {
      setNotice({ tone: 'error', message: `Select at least one ${formatQuotePartnerType(selectedQuoteOption.partnerType).toLowerCase()} company first.` });
      return;
    }

    if (!quoteConsentAccepted) {
      setNotice({ tone: 'error', message: 'Accept the POPIA and permission note before sending this request.' });
      return;
    }

    setIsSendingQuoteLead(true);

    try {
      const selectedPartners = [...selectedQuotePartners];
      const profile = isFullRegisterQuoteLead ? reportProfile ?? (await ensureAccountProfile()) : null;
      const includedSections = isFullRegisterQuoteLead
        ? selectedQuoteOption.leadType === 'license_renewal'
          ? {
              assetDetails: true,
              valuationSummary: false,
              mainPhoto: true,
              photos: true,
              documents: true,
              scanHistory: false,
              source: 'licence_register_share',
            }
          : buildFullRegisterLeadSections(selectedQuoteOption.leadType, profile)
        : {
            assetDetails: true,
            valuationSummary: true,
            mainPhoto: true,
            photos: quoteIncludePhotos,
            documents: quoteIncludeDocuments,
            scanHistory: quoteIncludeScanHistory,
            source: 'asset_register_options',
          };

      const successfulPartnerIds: string[] = [];

      for (const partner of selectedPartners) {
        const managedAssetIds = isFullRegisterQuoteLead
          ? selectedQuoteOption.leadType === 'replacement_quote' || selectedQuoteOption.leadType === 'license_renewal'
            ? selectedDealerShareAssetIds
            : activeShareAssets.map((asset) => asset.id)
          : [quoteAsset.id];
        const response = await fetch('/api/asset-leads', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            assetId: leadAssetId,
            partnerUserId: partner.masterAccountUserId || partner.userId,
            leadType: selectedQuoteOption.leadType,
            ownerMessage: quoteOwnerMessage,
            includedSections,
            trackMaintenance: selectedQuoteOption.leadType === 'replacement_quote' && quoteTrackMaintenance,
            trackingPermissions: selectedQuoteOption.leadType === 'replacement_quote' && quoteTrackMaintenance
              ? quoteTrackingPermissions
              : undefined,
            assetIds: partner.isAim4priceManaged
              ? managedAssetIds.length > 1 ? managedAssetIds : undefined
              : isSelectedRegisterAssetShare ? selectedDealerShareAssetIds : undefined,
            assistanceLocationId: partner.assistanceLocationId,
            assetGroupId: assetGroupShareTarget?.id,
            assetGroupName: assetGroupShareTarget?.name,
          }),
        });

        const payload = await response.json().catch(() => null);
        const data = payload as AssetLeadApiResponse | null;

        if (!response.ok || !data?.ok) {
          if (successfulPartnerIds.length) {
            setSelectedQuotePartnerIds((current) => current.filter((partnerId) => !successfulPartnerIds.includes(partnerId)));
          }
          const sentPrefix = successfulPartnerIds.length
            ? `${successfulPartnerIds.length} ${successfulPartnerIds.length === 1 ? 'request was' : 'requests were'} sent. `
            : '';
          throw new Error(`${sentPrefix}${quotePartnerName(partner)}: ${extractApiError(payload, 'Failed to send request.')}`);
        }

        successfulPartnerIds.push(partner.userId);
      }

      const fullRegisterQuoteLabel = selectedQuoteOption.leadType === 'insurance'
        ? 'insurance quote'
        : selectedQuoteOption.leadType === 'replacement_quote'
          ? 'dealer request'
          : selectedQuoteOption.leadType === 'license_renewal'
            ? 'licence renewal request'
          : 'refinance quote';

      setNotice({
        tone: 'success',
        message: hasManagedAssistanceSelection
          ? `Request sent to Aim4price. Aim4price will help locate a suitable provider for the selected service area. Your assets will not be shared with an external provider without your further approval.`
          : isSelectedRegisterAssetShare
          ? `${activeShareName} shared with ${selectedPartners.length === 1 ? quotePartnerName(selectedPartners[0]) : `${selectedPartners.length} selected companies`} · ${selectedDealerShareAssetIds.length} ${selectedDealerShareAssetIds.length === 1 ? 'asset' : 'assets'}.`
          : isFullRegisterQuoteLead
          ? `${activeShareName} ${fullRegisterQuoteLabel} sent to ${selectedPartners.length === 1 ? quotePartnerName(selectedPartners[0]) : `${selectedPartners.length} selected companies`}.`
          : `${selectedQuoteOption.shortTitle.toLowerCase()} request sent to ${selectedPartners.length === 1 ? quotePartnerName(selectedPartners[0]) : `${selectedPartners.length} selected companies`}.`,
      });
      closeAssetQuoteModal();
    } catch (error) {
      setNotice({ tone: 'error', message: error instanceof Error ? error.message : 'Failed to send asset lead.' });
    } finally {
      setIsSendingQuoteLead(false);
    }
  }

  async function openDealerTrackingSettings(asset: RegisterAsset) {
    setIsDealerTrackingSettingsOpen(true);
    setIsLoadingDealerTrackingSettings(true);
    setDealerTrackingAccess([]);
    setNotice(null);
    try {
      const response = await fetch(`/api/dealer-maintenance-access?assetId=${encodeURIComponent(asset.id)}`, {
        credentials: 'include',
        cache: 'no-store',
      });
      const payload = await response.json().catch(() => null) as {
        ok?: boolean;
        trackingAccess?: DealerMaintenanceAccessSummary[];
        error?: string;
      } | null;
      if (!response.ok || !payload?.ok || !Array.isArray(payload.trackingAccess)) {
        throw new Error(payload?.error || 'Failed to load dealer tracking settings.');
      }
      const trackingAccess = payload.trackingAccess;
      setDealerTrackingAccess(trackingAccess);
      setActiveDealerTrackingByAssetId((current) => ({
        ...current,
        [asset.id]: trackingAccess.length > 0,
      }));
    } catch (cause) {
      setNotice({ tone: 'error', message: cause instanceof Error ? cause.message : 'Failed to load dealer tracking settings.' });
    } finally {
      setIsLoadingDealerTrackingSettings(false);
    }
  }

  function openDeleteConfirmDialog(asset: RegisterAsset) {
    setDeleteCandidateAsset(asset);
  }

  function closeDeleteConfirmDialog() {
    if (busyDeleteId) return;
    setDeleteCandidateAsset(null);
  }

  function openAssetReportDialog() {
    setIsPricingModalOpen(false);
    setIsQrModalOpen(false);
    setCopiedScanLinkAssetId(null);
    setAssetReportStep('options');
    setAssetFuelReportYear('all');
    setAssetFuelReportMonth('all');
    setAssetMaintenanceReportType('all');
    setAssetMaintenanceReportYear('all');
    setAssetMaintenanceReportMonth('all');
    setAssetDepreciationReportYear('all');
    setAssetDepreciationReportMonth('all');
    setAssetOwnershipReportYear('all');
    setAssetOwnershipReportMonth('all');
    setAssetReportDownloadFormat('pdf');
    setOpenAssetReportSelect(null);
    setIsAssetReportModalOpen(true);
  }

  function closeAssetReportDialog() {
    setIsAssetReportModalOpen(false);
    setAssetReportStep('options');
    setAssetFuelReportYear('all');
    setAssetFuelReportMonth('all');
    setAssetMaintenanceReportType('all');
    setAssetMaintenanceReportYear('all');
    setAssetMaintenanceReportMonth('all');
    setAssetDepreciationReportYear('all');
    setAssetDepreciationReportMonth('all');
    setAssetOwnershipReportYear('all');
    setAssetOwnershipReportMonth('all');
    setAssetReportDownloadFormat('pdf');
    setOpenAssetReportSelect(null);
  }

  function resetRevalueReplacementForm(asset: RegisterAsset | null) {
    setRevalueReplacementPriceInput('');
    setRevalueReplacementPriceError(null);
    setRevalueLifetimeUsageInput(asset ? formatRegisterValueInput(readAssetMaxLifetimeUsage(asset) ?? '') : '');
    setRevalueAdvancedError(null);
    setSaveReplacementPriceWithRevalue(false);
  }

  function openPricingDialog() {
    setIsAssetReportModalOpen(false);
    setIsQrModalOpen(false);
    setCopiedScanLinkAssetId(null);
    resetRevalueReplacementForm(activeAsset);
    setIsPricingModalOpen(true);
  }

  function closePricingDialog() {
    if (isLoadingPricingPreview || isSavingPricingPreview) return;
    setPricingPreview(null);
    setRevalueReplacementPriceError(null);
    setRevalueAdvancedError(null);
    setSaveReplacementPriceWithRevalue(false);
    setIsPricingModalOpen(false);
  }

  function closePricingPreviewDialog() {
    if (isLoadingPricingPreview || isSavingPricingPreview) return;
    setPricingPreview(null);
    setRevalueReplacementPriceError(null);
    setRevalueAdvancedError(null);
    setSaveReplacementPriceWithRevalue(false);
  }

  function openQrDialog() {
    setIsAssetReportModalOpen(false);
    setIsPricingModalOpen(false);
    setIsQrModalOpen(true);
  }

  function closeQrDialog() {
    setIsQrModalOpen(false);
    setCopiedScanLinkAssetId(null);
  }

  async function openMarketplaceModal(asset: RegisterAsset) {
    const profile = await ensureAccountProfile();
    setMarketplaceAsset(asset);
    setMarketplaceDraft(createMarketplaceDraft(asset, profile));
    setIsPublishingMarketplace(false);
  }

  function closeMarketplaceModal() {
    setMarketplaceAsset(null);
    setMarketplaceDraft(null);
    setIsPublishingMarketplace(false);
  }

  async function ensureAccountProfile(): Promise<AccountProfile | null> {
    if (accountProfile) {
      return accountProfile;
    }

    try {
      const response = await fetch('/api/account-profile', {
        cache: 'no-store',
        credentials: 'include',
      });

      const data = (await response.json()) as AccountProfileApiResponse;

      if (!response.ok || !data.ok || !data.profile) {
        return null;
      }

      setAccountProfile(data.profile);
      return data.profile;
    } catch {
      return null;
    }
  }

  function handlePhotoFilesSelected(event: ChangeEvent<HTMLInputElement>) {
    const selectedFiles = Array.from(event.target.files ?? []);
    event.target.value = '';

    if (!selectedFiles.length) {
      return;
    }

    const filesToQueue = selectedFiles.slice(0, MAX_PHOTOS).map((file) => ({
      id: createPendingPhotoId(),
      file,
      previewUrl: createPhotoPreviewUrl(file),
    }));

    setPendingPhotoFiles((current) => {
      const combined = [...current, ...filesToQueue];
      const next = combined.slice(-MAX_PHOTOS);
      const removed = combined.slice(0, combined.length - next.length);

      removed.forEach((entry) => revokePhotoPreviewUrl(entry.previewUrl));
      pendingPhotoFilesRef.current = next;
      return next;
    });

    const willReplaceOldPhotos = assetDraft.photos.length + pendingPhotoFiles.length + filesToQueue.length > MAX_PHOTOS;
    setNotice({
      tone: 'success',
      message: `${filesToQueue.length} photo${filesToQueue.length === 1 ? '' : 's'} ready.${willReplaceOldPhotos ? ` New photos will replace the oldest saved photos once the ${editingAsset ? 'asset is updated' : 'asset is added'}.` : ' Choose Make main to show one first everywhere.'}`,
    });
  }

  function selectMainDraftPhoto(item: DraftPhotoItem) {
    if (item.source === 'saved' && item.url) {
      setMainPhotoSelection({ source: 'saved', url: item.url });
      return;
    }

    if (item.source === 'pending' && item.pendingId) {
      setMainPhotoSelection({ source: 'pending', id: item.pendingId });
    }
  }

  function removeDraftPhoto(photoUrl: string) {
    setAssetDraft((current) => ({
      ...current,
      photos: current.photos.filter((photo) => photo !== photoUrl),
    }));

    setMainPhotoSelection((current) => (current?.source === 'saved' && current.url === photoUrl ? null : current));
  }

  function removePendingPhotoFile(photoId: string) {
    setPendingPhotoFiles((current) => {
      const removed = current.find((entry) => entry.id === photoId);
      if (removed) {
        revokePhotoPreviewUrl(removed.previewUrl);
      }

      const next = current.filter((entry) => entry.id !== photoId);
      pendingPhotoFilesRef.current = next;
      return next;
    });

    setMainPhotoSelection((current) => (current?.source === 'pending' && current.id === photoId ? null : current));
  }


  function handleDocumentFilesSelected(
    event: ChangeEvent<HTMLInputElement>,
    category: AssetDocumentCategory = 'other',
  ) {
    const selectedFiles = Array.from(event.target.files ?? []);
    event.target.value = '';

    if (!selectedFiles.length) {
      return;
    }

    const remainingSlots = MAX_DOCUMENTS - assetDraft.documents.length - pendingDocumentFiles.length;

    if (remainingSlots <= 0) {
      setNotice({ tone: 'error', message: `You can upload a maximum of ${MAX_DOCUMENTS} documents per asset.` });
      return;
    }

    const filesToQueue = selectedFiles.slice(0, remainingSlots);
    filesToQueue.forEach((file) => pendingDocumentCategoriesRef.current.set(file, category));

    setPendingDocumentFiles((current) => [...current, ...filesToQueue]);
    setNotice({
      tone: 'success',
      message: `${filesToQueue.length} document${filesToQueue.length === 1 ? '' : 's'} ready.${editingAsset ? ' Uploading and saving automatically.' : ' Click Add asset to upload.'}`,
    });
  }

  function removeDraftDocument(documentId: string) {
    setAssetDraft((current) => ({
      ...current,
      documents: current.documents.filter((document) => document.id !== documentId),
    }));
  }

  function removePendingDocumentFile(fileIndex: number) {
    setPendingDocumentFiles((current) => current.filter((_, index) => index !== fileIndex));
  }

  async function uploadAssetMediaFiles(files: File[], uploadType: DetailMediaUploadType): Promise<UploadedAssetFile[]> {
    if (!files.length) return [];

    const formData = new FormData();
    formData.append('uploadType', uploadType);

    files.forEach((file) => {
      formData.append('files', file);
    });

    const uploadUrl = isAccountantWorkspace && accountantShareId
      ? `/api/asset-register/uploads?accountantShareId=${encodeURIComponent(accountantShareId)}`
      : '/api/asset-register/uploads';
    const response = await fetch(uploadUrl, {
      method: 'POST',
      credentials: 'include',
      body: formData,
    });

    const data = (await response.json()) as AssetUploadApiResponse;

    if (!response.ok || !data.ok || !data.uploads?.length) {
      throw new Error(data.error ?? (uploadType === 'document' ? 'Failed to upload documents.' : 'Failed to upload images.'));
    }

    return data.uploads;
  }

  async function uploadQueuedPhotoFiles(files: PendingPhotoFile[]): Promise<Map<string, string>> {
    if (!files.length) return new Map<string, string>();

    setIsUploadingPhotos(true);

    try {
      const uploads = await uploadAssetMediaFiles(files.map((entry) => entry.file), 'photo');

      return new Map(
        uploads
          .map((entry, index) => {
            const pendingPhoto = files[index];
            return pendingPhoto ? ([pendingPhoto.id, entry.url] as const) : null;
          })
          .filter((entry): entry is readonly [string, string] => entry !== null),
      );
    } finally {
      setIsUploadingPhotos(false);
    }
  }

  function uploadedFilesToDocuments(
    uploads: UploadedAssetFile[],
    sourceFiles: File[] = [],
    categoryOverride?: AssetDocumentCategory,
  ): AssetDocument[] {
    return uploads.map((entry, index) => {
      const category = normalizeAssetDocumentCategory(
        categoryOverride ?? pendingDocumentCategoriesRef.current.get(sourceFiles[index]) ?? 'other',
      );
      return {
      id: entry.uploadId || entry.url,
      url: entry.url,
      fileName: entry.fileName,
      contentType: entry.contentType,
      byteSize: entry.byteSize,
      category,
      documentType: normalizeAssetDocumentType(`${category}_document`),
      uploadedAtIso: new Date().toISOString(),
      };
    });
  }

  async function uploadQueuedDocumentFiles(files: File[]): Promise<AssetDocument[]> {
    if (!files.length) return [];

    setIsUploadingDocuments(true);

    try {
      const uploads = await uploadAssetMediaFiles(files, 'document');
      return uploadedFilesToDocuments(uploads, files);
    } finally {
      setIsUploadingDocuments(false);
    }
  }

  async function patchAssetMedia(asset: RegisterAsset, photos: string[], documents: AssetDocument[]): Promise<RegisterAsset> {
    const response = await fetch('/api/asset-register', {
      method: 'PATCH',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        assetId: asset.id,
        photos,
        documents,
      }),
    });

    const data = (await response.json()) as AssetRegisterApiResponse;

    if (!response.ok || !data.ok || !data.item) {
      throw new Error(data.error ?? 'Failed to update asset files.');
    }

    return data.item;
  }

  function triggerDetailMediaInput(assetId: string, type: DetailMediaUploadType) {
    document.getElementById(mediaInputId(assetId, type))?.click();
  }

  function handleDetailMediaKeyDown(event: ReactKeyboardEvent<HTMLDivElement>, assetId: string, type: DetailMediaUploadType) {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    triggerDetailMediaInput(assetId, type);
  }

  async function handleDetailPhotoFilesSelected(asset: RegisterAsset, event: ChangeEvent<HTMLInputElement>) {
    const selectedFiles = Array.from(event.target.files ?? []);
    event.target.value = '';

    if (!selectedFiles.length) {
      return;
    }

    const filesToUpload = selectedFiles.slice(0, MAX_PHOTOS);
    setDetailMediaUpload({ assetId: asset.id, type: 'photo' });

    try {
      const uploads = await uploadAssetMediaFiles(filesToUpload, 'photo');
      const uploadedPhotoUrls = uploads.map((entry) => entry.url).filter(Boolean);
      const nextPhotos = limitPhotosToNewest([...normalizePhotos(asset.photos), ...uploadedPhotoUrls]);
      const updatedAsset = await patchAssetMedia(asset, nextPhotos, assetDocuments(asset));
      const updatedPhotos = normalizePhotos(updatedAsset.photos);
      const firstUploadedIndex = updatedPhotos.findIndex((photo) => uploadedPhotoUrls.includes(photo));

      syncMediaUpdatedAsset(updatedAsset);
      setExpandedAssetId(updatedAsset.id);

      if (firstUploadedIndex >= 0) {
        setDetailPhotoIndex(updatedAsset.id, firstUploadedIndex);
      }

      setNotice({
        tone: 'success',
        message: `${uploadedPhotoUrls.length} photo${uploadedPhotoUrls.length === 1 ? '' : 's'} uploaded.${normalizePhotos(asset.photos).length + uploadedPhotoUrls.length > MAX_PHOTOS ? ' Oldest photos were replaced to keep the asset at 12 photos.' : ''}`,
      });
    } catch (error) {
      setNotice({
        tone: 'error',
        message: error instanceof Error ? error.message : 'Failed to upload photos.',
      });
    } finally {
      setDetailMediaUpload(null);
    }
  }

  function assetVaultDocumentsUrl(assetId: string): string {
    if (accountantShareId) {
      return `/api/accountant/registers/${encodeURIComponent(accountantShareId)}/assets/${encodeURIComponent(assetId)}/documents`;
    }

    return `/api/documents?assetId=${encodeURIComponent(assetId)}`;
  }

  function assetVaultDocumentDownloadUrl(assetId: string, documentId: string): string {
    if (accountantShareId) {
      return `/api/accountant/registers/${encodeURIComponent(accountantShareId)}/assets/${encodeURIComponent(assetId)}/documents/${encodeURIComponent(documentId)}/download`;
    }

    return `/api/documents/${encodeURIComponent(documentId)}/download`;
  }

  async function loadVaultDocuments(assetId: string, options: { quiet?: boolean } = {}): Promise<boolean> {
    if (!assetId) return false;
    if (!options.quiet) {
      setVaultDocumentsLoadingByAssetId((current) => ({ ...current, [assetId]: true }));
    }
    setVaultDocumentsErrorByAssetId((current) => ({ ...current, [assetId]: '' }));

    try {
      const response = await fetch(assetVaultDocumentsUrl(assetId), { cache: 'no-store' });
      const data = await response.json() as VaultDocumentsResponse;
      if (!response.ok || !data.ok) {
        throw new Error(data.error || 'The linked documents could not be loaded.');
      }

      setVaultDocumentsByAssetId((current) => ({ ...current, [assetId]: data.documents ?? [] }));
      return true;
    } catch (error) {
      setVaultDocumentsErrorByAssetId((current) => ({
        ...current,
        [assetId]: error instanceof Error ? error.message : 'The linked documents could not be loaded.',
      }));
      return false;
    } finally {
      setVaultDocumentsLoadingByAssetId((current) => ({ ...current, [assetId]: false }));
    }
  }

  function openAssetDocumentUpload(asset: RegisterAsset) {
    if (isAccountantWorkspace && !canUseAccountantDocumentActions) {
      setNotice({ tone: 'error', message: 'The owner has not enabled Allow direct updates for this register.' });
      return;
    }

    documentUploadReturnAssetIdRef.current = asset.id;
    setExpandedAssetId(asset.id);
    setDocumentUploadAsset(asset);
  }

  function closeAssetDocumentUpload(assetId = documentUploadReturnAssetIdRef.current) {
    documentUploadReturnAssetIdRef.current = null;
    setDocumentUploadAsset(null);
    if (!assetId) return;

    setExpandedAssetId(assetId);
    window.requestAnimationFrame(() => {
      const card = document.getElementById(`asset-card-${assetId}`);
      if (!card) return;

      const bounds = card.getBoundingClientRect();
      if (bounds.bottom <= 96 || bounds.top >= window.innerHeight) {
        card.scrollIntoView({ block: 'nearest', inline: 'nearest' });
      }
    });
  }

  async function handleVaultDocumentsUploaded(
    asset: RegisterAsset,
    documents: UploadedVaultDocument[],
    outcome: { complete: boolean; totalUploaded: number },
  ) {
    setVaultDocumentsByAssetId((current) => {
      const merged = [...documents, ...(current[asset.id] ?? [])];
      return {
        ...current,
        [asset.id]: merged.filter((document, index) => (
          merged.findIndex((candidate) => candidate.id === document.id) === index
        )),
      };
    });
    await loadVaultDocuments(asset.id, { quiet: true });
    setExpandedAssetId(asset.id);
    if (!outcome.complete) return;

    closeAssetDocumentUpload(asset.id);
    setNotice({
      tone: 'success',
      message: `${outcome.totalUploaded} document${outcome.totalUploaded === 1 ? '' : 's'} saved to Documents and linked to ${asset.title}.`,
    });
  }

  async function handleAssetSubmit(event?: FormEvent<HTMLFormElement>, options: AssetSubmitOptions = {}): Promise<boolean> {
    event?.preventDefault();
    const showFeedback = !options.silent;
    const destinationRegisterId = String(
      editingAsset?.registerId
      || addAssetTargetRegisterId
      || (!isCombinedRegisterView ? activeRegister?.id || activeRegisterId : '')
      || '',
    ).trim();

    if (manualAssetStep !== 4 && !options.autosave) {
      return false;
    }

    if (!editingAsset && (!destinationRegisterId || destinationRegisterId === COMBINED_REGISTER_ID)) {
      if (showFeedback) {
        setNotice({
          tone: 'error',
          message: 'Choose the Asset Register that should own this asset before saving it.',
        });
      }
      return false;
    }

    if (!validateAssetDetailsDraft(showFeedback)) {
      if (showFeedback) setManualAssetStep(2);
      return false;
    }

    const value = parseRegisterValueInput(assetDraft.value);
    const isPropertyAsset = assetFormKind === 'property';
    const isStockAsset = assetFormKind === 'stock';
    const isLandProperty = isPropertyAsset && assetDraft.propertyAssetSubtype === 'land';
    const replacementPriceRequired = !isStockAsset && !isLandProperty;
    const replacementPrice = replacementPriceRequired ? parseRegisterValueInput(assetDraft.replacementPrice) : null;
    const hasStockPeakValue = isStockAsset && assetDraft.stockPeakValue.trim() !== '';
    const stockPeakValue = hasStockPeakValue ? parseRegisterValueInput(assetDraft.stockPeakValue) : null;
    const hasYearModel = assetDraft.yearModel.trim() !== '';
    const yearModel = hasYearModel ? Number(assetDraft.yearModel) : null;
    const hasHours = showUsageHoursField && assetDraft.hours.trim() !== '';
    const hours = hasHours ? parseUsageAmountInput(assetDraft.hours) : null;
    const hasLifeWorkedPercent = (showPercentUsageField || showLifeWorkedPercentField) && assetDraft.lifeWorkedPercent.trim() !== '';
    const lifeWorkedPercent = hasLifeWorkedPercent ? Number(assetDraft.lifeWorkedPercent) : null;
    const hasInsuredValue = assetDraft.insuredValue.trim() !== '';
    const insuredValueExVat = hasInsuredValue ? parseRegisterValueInput(assetDraft.insuredValue) : null;
    const usageErrorLabel = assetDraft.usageMetric === 'km' ? 'Kilometres' : 'Machine hours';
    const title = assetDraft.title.trim();
    const brandName = isPropertyAsset || isStockAsset ? '' : assetDraft.brandName.trim();
    const modelName = isPropertyAsset || isStockAsset ? '' : assetDraft.modelName.trim();
    const propertySize = isPropertyAsset ? assetDraft.propertySize.trim().replace(/\s+/g, ' ') : '';
    const licenseApplicable = assetKindSupportsLicensing(assetFormKind);
    const nextLicenseStatus: AssetStatusChoice = licenseApplicable ? assetStatusDraft.licenseStatus : 'not_applicable';
    const nextInsuranceStatus: AssetStatusChoice = assetStatusDraft.insuranceStatus;
    const insuredValueForSave = nextInsuranceStatus === 'yes' && insuredValueExVat !== null && insuredValueExVat > 0 ? insuredValueExVat : null;

    if (
      !validateAssetStatusDraft('finance', showFeedback) ||
      !validateAssetStatusDraft('insurance', showFeedback) ||
      (licenseApplicable && !validateAssetStatusDraft('license', showFeedback))
    ) {
      if (showFeedback) {
        setManualAssetStep(3);
        setNotice({ tone: 'error', message: 'Please fix the finance, insurance or license details before saving.' });
      }
      return false;
    }

    if (!title || value <= 0) {
      if (showFeedback) setNotice({ tone: 'error', message: 'Asset title and current value are required.' });
      return false;
    }

    if (replacementPriceRequired && (!replacementPrice || replacementPrice <= 0)) {
      if (showFeedback) setNotice({ tone: 'error', message: 'Replacement price is required and must be greater than zero.' });
      return false;
    }

    if (hasStockPeakValue && (!stockPeakValue || stockPeakValue <= 0)) {
      if (showFeedback) setNotice({ tone: 'error', message: 'Peak stock value must be greater than zero when entered.' });
      return false;
    }

    if (stockPeakValue !== null && stockPeakValue < value) {
      if (showFeedback) setNotice({ tone: 'error', message: 'Peak stock value cannot be lower than the current stock value.' });
      return false;
    }

    if (hasInsuredValue && (!insuredValueExVat || insuredValueExVat <= 0)) {
      if (showFeedback) setNotice({ tone: 'error', message: 'Insured value must be greater than zero when entered.' });
      return false;
    }

    if (hasYearModel && (!Number.isFinite(yearModel) || Number(yearModel) < 1800 || Number(yearModel) > new Date().getFullYear() + 1)) {
      if (showFeedback) setNotice({ tone: 'error', message: `${yearFieldLabel} must be a valid year.` });
      return false;
    }

    if (hasHours && (!Number.isFinite(hours) || Number(hours) < 0)) {
      if (showFeedback) setNotice({ tone: 'error', message: `${usageErrorLabel} must be zero or greater.` });
      return false;
    }

    if (hasLifeWorkedPercent && (!Number.isFinite(lifeWorkedPercent) || Number(lifeWorkedPercent) < 0 || Number(lifeWorkedPercent) > 100)) {
      if (showFeedback) setNotice({ tone: 'error', message: 'Usage must be between 0% and 100%.' });
      return false;
    }

    const savedUsageReading = getAssetSavedUsageReading(editingAsset);
    if (editingAsset && hasHours && savedUsageReading !== null && Math.round(Number(hours)) < savedUsageReading) {
      if (showFeedback) {
        setNotice({
          tone: 'error',
          message: USAGE_READING_SETTINGS_ERROR,
        });
      }
      return false;
    }

    const currentLifeWorkedPercent = editingAsset ? getAssetLifeWorkedPercent(editingAsset) : null;
    if (
      editingAsset &&
      hasLifeWorkedPercent &&
      currentLifeWorkedPercent !== null &&
      isLifeWorkedPercentDecrease(Number(lifeWorkedPercent), currentLifeWorkedPercent)
    ) {
      if (showFeedback) {
        setNotice({
          tone: 'error',
          message: LIFETIME_PERCENT_SETTINGS_ERROR,
        });
      }
      return false;
    }

    const draftLifeWorkedPercent = (showPercentUsageField || showLifeWorkedPercentField) && hasLifeWorkedPercent
      ? Number(lifeWorkedPercent)
      : null;
    const roundedLifeWorkedPercent = !isPropertyAsset && assetDraft.usageMetric === 'percentage'
      ? resolveLifeWorkedPercentForSave(draftLifeWorkedPercent, editingAsset ? currentLifeWorkedPercent : null)
      : null;
    const hoursForSave = showUsageHoursField
      ? hasHours
        ? Math.round(Number(hours))
        : editingAsset && !isPropertyAsset
          ? savedUsageReading
          : null
      : null;
    const licenseRegistrationNumber = nextLicenseStatus === 'yes'
      ? normalizeLicenseRegistrationText(assetStatusDraft.licenseRegistrationNumber)
      : '';
    const specsJson: Record<string, unknown> = {
      ...buildStatusSpecsFragment(assetStatusDraft, licenseApplicable),
      ...(replacementPrice !== null
        ? {
            replacementPriceExVat: replacementPrice,
            replacement_price_ex_vat: replacementPrice,
            replacementPrice: replacementPrice,
            replacement_price: replacementPrice,
            replacementPriceUsedExVat: replacementPrice,
            replacement_price_used_ex_vat: replacementPrice,
            userReplacementPriceExVat: replacementPrice,
            user_replacement_price_ex_vat: replacementPrice,
            officialReplacementPriceExVat: replacementPrice,
            official_replacement_price_ex_vat: replacementPrice,
            replacementPriceBasis: 'user',
            replacement_price_basis: 'user',
          }
        : {
            replacementPriceNotApplicable: true,
            replacement_price_not_applicable: true,
            replacementPriceBasis: 'not_applicable',
            replacement_price_basis: 'not_applicable',
          }),
    };

    if (assetFormKind === 'manual' && assetDraft.generalAssetCategory) {
      const categoryLabel = generalAssetCategoryLabel(assetDraft.generalAssetCategory);
      specsJson.generalAssetCategory = assetDraft.generalAssetCategory;
      specsJson.general_asset_category = assetDraft.generalAssetCategory;
      specsJson.generalAssetCategoryLabel = categoryLabel;
      specsJson.general_asset_category_label = categoryLabel;
      specsJson.insuranceUseContext = assetDraft.insuranceUseContext;
      specsJson.insurance_use_context = assetDraft.insuranceUseContext;
      specsJson.insuranceMobility = assetDraft.insuranceMobility;
      specsJson.insurance_mobility = assetDraft.insuranceMobility;
      specsJson.insuranceCriticalToOperations = assetDraft.insuranceCriticalToOperations;
      specsJson.insurance_critical_to_operations = assetDraft.insuranceCriticalToOperations;
      specsJson.insuranceTemperatureSensitiveStock = assetDraft.insuranceTemperatureSensitiveStock;
      specsJson.insurance_temperature_sensitive_stock = assetDraft.insuranceTemperatureSensitiveStock;
    }

    if (brandName) {
      specsJson.brandName = brandName;
      specsJson.brand_name = brandName;
      specsJson.brand = brandName;
    }

    if (modelName) {
      specsJson.modelName = modelName;
      specsJson.model_name = modelName;
      specsJson.model = modelName;
      specsJson.typedModelName = modelName;
      specsJson.typed_model_name = modelName;
    }

    if (isPropertyAsset) {
      const propertySubtypeLabel = propertyAssetSubtypeLabel(assetDraft.propertyAssetSubtype);
      specsJson.propertyAssetSubtype = assetDraft.propertyAssetSubtype;
      specsJson.property_asset_subtype = assetDraft.propertyAssetSubtype;
      specsJson.propertyAssetSubtypeLabel = propertySubtypeLabel;
      specsJson.property_asset_subtype_label = propertySubtypeLabel;
      specsJson.propertyInterest = assetDraft.propertyInterest;
      specsJson.property_interest = assetDraft.propertyInterest;
      specsJson.insuranceUseContext = assetDraft.insuranceUseContext;
      specsJson.insurance_use_context = assetDraft.insuranceUseContext;
      specsJson.propertySize = propertySize;
      specsJson.property_size = propertySize;
    }

    if (isStockAsset) {
      const stockSubtypeLabel = stockAssetSubtypeLabel(assetDraft.stockAssetSubtype);
      specsJson.stockAssetSubtype = assetDraft.stockAssetSubtype;
      specsJson.stock_asset_subtype = assetDraft.stockAssetSubtype;
      specsJson.stockAssetSubtypeLabel = stockSubtypeLabel;
      specsJson.stock_asset_subtype_label = stockSubtypeLabel;
      specsJson.stockValuationBasis = assetDraft.stockValuationBasis;
      specsJson.stock_valuation_basis = assetDraft.stockValuationBasis;
      specsJson.stockMovement = assetDraft.stockMovement;
      specsJson.stock_movement = assetDraft.stockMovement;
      specsJson.insuranceTemperatureSensitiveStock = assetDraft.insuranceTemperatureSensitiveStock;
      specsJson.insurance_temperature_sensitive_stock = assetDraft.insuranceTemperatureSensitiveStock;
      if (stockPeakValue !== null) {
        specsJson.stockPeakValueExVat = stockPeakValue;
        specsJson.stock_peak_value_ex_vat = stockPeakValue;
      }
    }

    if (insuredValueForSave !== null) {
      specsJson.insuredValueExVat = insuredValueForSave;
      specsJson.insured_value_ex_vat = insuredValueForSave;
      specsJson.insuranceValueExVat = insuredValueForSave;
      specsJson.insurance_value_ex_vat = insuredValueForSave;
      specsJson.insuredValue = insuredValueForSave;
      specsJson.insured_value = insuredValueForSave;
      specsJson.insuranceValue = insuredValueForSave;
      specsJson.insurance_value = insuredValueForSave;
    }

    if (roundedLifeWorkedPercent !== null) {
      specsJson.life_worked_percent = roundedLifeWorkedPercent;
      specsJson.worked_percent = roundedLifeWorkedPercent;
      specsJson.percent_worked = roundedLifeWorkedPercent;
      specsJson.lifetime_worked_percent = roundedLifeWorkedPercent;
    }

    if (isPropertyAsset || assetDraft.usageMetric === 'not_applicable') {
      Object.assign(specsJson, {
        usageMetric: 'not_applicable', usage_metric: 'not_applicable',
        usageUnit: 'not_applicable', usage_unit: 'not_applicable',
        usageMode: 'not_applicable', usage_mode: 'not_applicable',
        usageBasis: 'not_applicable', usage_basis: 'not_applicable',
        selectedUsageMode: 'not_applicable', selected_usage_mode: 'not_applicable',
        selectedUsageBasis: 'not_applicable', selected_usage_basis: 'not_applicable',
        usageApplicable: false, usage_applicable: false,
      });
    } else if (assetDraft.usageMetric === 'percentage') {
      Object.assign(specsJson, {
        usageMode: 'percent', usage_mode: 'percent',
        usageBasis: 'percent', usage_basis: 'percent',
        selectedUsageMode: 'percent', selected_usage_mode: 'percent',
        selectedUsageBasis: 'percent', selected_usage_basis: 'percent',
        usageApplicable: true, usage_applicable: true,
      });
    } else {
      Object.assign(specsJson, {
        usageMetric: assetDraft.usageMetric, usage_metric: assetDraft.usageMetric,
        usageUnit: assetDraft.usageMetric, usage_unit: assetDraft.usageMetric,
        usageMode: assetDraft.usageMetric, usage_mode: assetDraft.usageMetric,
        usageBasis: 'reading', usage_basis: 'reading',
        selectedUsageMode: assetDraft.usageMetric, selected_usage_mode: assetDraft.usageMetric,
        selectedUsageBasis: 'reading', selected_usage_basis: 'reading',
        usageApplicable: true, usage_applicable: true,
      });
    }

    setIsSavingAsset(true);

    const pendingPhotosForSave = pendingPhotoFiles;
    const pendingDocumentsForSave = pendingDocumentFiles;
    let restoredPreviousAction = false;

    try {
      const orderedDraftPhotos = buildDraftPhotoItems(assetDraft.photos, pendingPhotosForSave, mainPhotoSelection);
      const uploadedPhotoUrlsById = await uploadQueuedPhotoFiles(pendingPhotosForSave);
      const uploadedDocuments = await uploadQueuedDocumentFiles(pendingDocumentsForSave);
      const photoUrlsByKey = new Map<string, string>();

      assetDraft.photos.forEach((photo) => {
        photoUrlsByKey.set(savedDraftPhotoKey(photo), photo);
      });

      uploadedPhotoUrlsById.forEach((url, pendingId) => {
        photoUrlsByKey.set(pendingDraftPhotoKey(pendingId), url);
      });

      const selectedMainPhotoKey = mainPhotoSelectionKey(mainPhotoSelection);
      const photos = limitDraftPhotosWithMainPreference(
        orderedDraftPhotos
          .map((photo) => photoUrlsByKey.get(photo.key) ?? '')
          .filter(Boolean),
        Boolean(selectedMainPhotoKey),
      );
      const documents = normalizeDocuments([...assetDraft.documents, ...uploadedDocuments]);

      const payload = {
        registerId: destinationRegisterId || null,
        kind: editingAsset?.valuationRunId ? editingAsset.kind : assetDraft.kind,
        title,
        value,
        replacementPriceExVat: replacementPrice,
        insuredValueExVat: insuredValueForSave,
        note: assetDraft.note.trim(),
        serialNumber: isPropertyAsset || isStockAsset ? '' : assetDraft.serialNumber.trim(),
        brandName,
        modelName,
        isFinanced: assetStatusDraft.financeStatus === 'yes',
        isInsured: nextInsuranceStatus === 'yes',
        isLicensed: nextLicenseStatus === 'yes',
        licenseRegistrationNumber,
        financeNote: ['yes', 'paid'].includes(assetStatusDraft.financeStatus) ? assetStatusDraft.financeNote : '',
        photos,
        documents,
        yearModel: hasYearModel ? Math.round(Number(yearModel)) : null,
        hours: hoursForSave,
        usageMetric: isPropertyAsset || !showUsageHoursField ? null : assetDraft.usageMetric === 'km' ? 'km' : 'hours',
        lifeWorkedPercent: roundedLifeWorkedPercent,
        specsJson,
        condition: showConditionField ? assetDraft.condition || null : null,
      };

      const previousReplacementPriceExVat = editingAsset ? readAssetReplacementPriceExVat(editingAsset) : null;
      const nextReplacementPriceExVat = replacementPrice === null ? null : Math.round(replacementPrice);
      const shouldPromptReplacementPriceRevalue = Boolean(
        editingAssetId !== null &&
        isSavedAim4priceAsset(editingAsset) &&
        nextReplacementPriceExVat !== null &&
        previousReplacementPriceExVat !== nextReplacementPriceExVat,
      );

      let assetIdToFocus: string | null = null;
      let savedAssetForEditor: RegisterAsset | null = null;

      if (editingAssetId !== null) {
        const manualAssetUrl = isAccountantWorkspace && accountantShareId
          ? `/api/asset-register?accountantShareId=${encodeURIComponent(accountantShareId)}`
          : '/api/asset-register';
        const response = await fetch(manualAssetUrl, {
          method: 'PUT',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            assetId: editingAssetId,
            ...payload,
          }),
        });

        const data = (await response.json()) as AssetRegisterApiResponse;

        if (!response.ok || !data.ok || !data.item) {
          throw new Error(data.error ?? 'Failed to update asset.');
        }

        if (options.keepOpen) {
          syncSettingsUpdatedAsset(data.item);
        } else {
          syncUpdatedAsset(data.item);
        }

        savedAssetForEditor = data.item;
        assetIdToFocus = data.item.id;
        setExpandedAssetId(data.item.id);
        if (showFeedback) {
          setNotice({
            tone: 'success',
            message: 'Asset updated successfully.',
          });
        }

        if (shouldPromptReplacementPriceRevalue && nextReplacementPriceExVat !== null) {
          setReplacementPriceRevaluePrompt({
            asset: data.item,
            oldReplacementPriceExVat: previousReplacementPriceExVat,
            newReplacementPriceExVat: nextReplacementPriceExVat,
          });
        }
      } else {
        const manualAssetUrl = isAccountantWorkspace && accountantShareId
          ? `/api/asset-register?accountantShareId=${encodeURIComponent(accountantShareId)}`
          : '/api/asset-register';
        const response = await fetch(manualAssetUrl, {
          method: 'POST',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            ...payload,
            newlyAcquired: newAssetAcquisitionDraft.newlyAcquired === true,
            acquisitionDate: newAssetAcquisitionDraft.acquisitionDate,
            acquisitionAmountExVat: newAssetAcquisitionDraft.acquisitionAmountExVat,
            acquisitionNote: newAssetAcquisitionDraft.note,
            acquisitionSourceDocumentReference: newAssetAcquisitionDraft.sourceDocumentReference,
          }),
        });

        const data = (await response.json()) as AssetRegisterApiResponse;

        if (!response.ok || !data.ok || !data.item) {
          throw new Error(data.error ?? 'Failed to add asset.');
        }

        const savedAsset = data.item as RegisterAsset;
        savedAssetForEditor = savedAsset;
        setAssets((current) => [savedAsset, ...current]);
        setSearchTerm('');
        setAssetFilter('all');
        setCurrentPage(1);
        setExpandedAssetId(savedAsset.id);
        assetIdToFocus = savedAsset.id;
        if (showFeedback) setNotice({ tone: 'success', message: 'Asset added successfully.' });
      }

      if (options.keepOpen && savedAssetForEditor) {
        const savedDraft = buildDraftFromAsset(savedAssetForEditor);
        const savedStatusDraft = buildAssetStatusDraftFromAsset(savedAssetForEditor);
        const requestIsStillLatest =
          Boolean(options.autosaveSignature) &&
          assetAutosaveLatestSignatureRef.current === options.autosaveSignature;
        const savedPhotoIds = new Set(pendingPhotosForSave.map((entry) => entry.id));
        const savedDocumentFiles = new Set(pendingDocumentsForSave);

        setPendingPhotoFiles((current) => {
          const next = current.filter((entry) => !savedPhotoIds.has(entry.id));
          current
            .filter((entry) => savedPhotoIds.has(entry.id))
            .forEach((entry) => revokePhotoPreviewUrl(entry.previewUrl));
          pendingPhotoFilesRef.current = next;
          return next;
        });
        setPendingDocumentFiles((current) => current.filter((file) => !savedDocumentFiles.has(file)));
        setMainPhotoSelection(null);

        if (requestIsStillLatest) {
          setAssetDraft(savedDraft);
          setAssetStatusDraft(savedStatusDraft);
          assetAutosaveBaselineRef.current = buildAssetAutosaveSignature(savedDraft, savedStatusDraft);
          assetAutosaveLatestSignatureRef.current = assetAutosaveBaselineRef.current;
          assetAutosaveAttemptedSignatureRef.current = '';
        } else {
          setAssetDraft((current) => ({
            ...current,
            photos: savedDraft.photos,
            documents: savedDraft.documents,
          }));
          assetAutosaveBaselineRef.current = options.autosaveSignature ?? assetAutosaveBaselineRef.current;
        }
      } else {
        restoredPreviousAction = closeAssetModal();
      }

      if (!options.keepOpen && assetIdToFocus && !restoredPreviousAction) {
        scrollToAssetCard(assetIdToFocus);
      }

      return true;
    } catch (error) {
      if (showFeedback) {
        setNotice({
          tone: 'error',
          message: error instanceof Error ? error.message : 'Failed to save asset.',
        });
      }
      return false;
    } finally {
      setIsSavingAsset(false);
    }
  }

  async function handleDeleteAsset(assetId: string, draft: DisposalDraft): Promise<boolean> {
    setBusyDeleteId(assetId);

    try {
      const removalDetails = draft.reason === 'mistake_duplicate'
        ? { reason: draft.reason }
        : {
            reason: draft.reason,
            disposalDate: draft.disposalDate,
            disposalAmountExVat: draft.disposalAmountExVat,
            note: draft.note,
          };
      const response = await fetch(`/api/asset-register?id=${assetId}`, {
        method: 'DELETE',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(removalDetails),
      });

      const data = (await response.json()) as AssetRegisterApiResponse & { mode?: 'disposed' | 'deleted' };

      if (!response.ok || !data.ok) {
        throw new Error(data.error ?? 'Failed to delete asset.');
      }

      setAssets((current) => current.filter((asset) => asset.id !== assetId));

      if (editingAssetId === assetId) {
        resetEditor();
      }

      if (activeAsset?.id === assetId) {
        setActiveAsset(null);
      }

      if (projectionAsset?.id === assetId) {
        closeProjectionModal();
      }

      setNotice({
        tone: 'success',
        message: data.mode === 'deleted'
          ? 'Duplicate asset permanently removed. Its deletion audit was retained.'
          : 'Asset archived as disposed and retained for reports and history.',
      });
      return true;
    } catch (error) {
      setNotice({
        tone: 'error',
        message: error instanceof Error ? error.message : 'Failed to delete asset.',
      });
      return false;
    } finally {
      setBusyDeleteId(null);
    }
  }

  function handleDeleteFromDialog(asset: RegisterAsset) {
    openDeleteConfirmDialog(asset);
  }

  async function handleConfirmDeleteAsset() {
    if (!deleteCandidateAsset) return;
    setDisposalDraft(createDisposalDraft());
    setDisposalCandidateAsset(deleteCandidateAsset);
    setDeleteCandidateAsset(null);
  }

  async function handleConfirmDisposal(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!disposalCandidateAsset) return;
    if (!disposalDraft.reason) {
      setNotice({ tone: 'error', message: 'Choose what happened to the asset.' });
      return;
    }

    const assetId = disposalCandidateAsset.id;
    const wasRemoved = await handleDeleteAsset(assetId, disposalDraft);
    if (wasRemoved) {
      setDisposalCandidateAsset(null);
      setActiveAsset((current) => current?.id === assetId ? null : current);
    }
  }

  async function openAcquisitionDetails(asset: RegisterAsset) {
    setAcquisitionDetailsAsset(asset);
    setAcquisitionDetailsDraft(createAcquisitionDraft());
    setAcquisitionDetailsError('');
    setIsLoadingAcquisitionDetails(true);
    try {
      const response = await fetch(`/api/asset-lifecycle?assetId=${encodeURIComponent(asset.id)}`, { credentials: 'include', cache: 'no-store' });
      const data = await response.json().catch(() => null) as {
        ok?: boolean;
        error?: string;
        acquisition?: { newlyAcquired?: boolean; acquisitionDate?: string; acquisitionAmountExVat?: number | null; note?: string; sourceDocumentReference?: string } | null;
      } | null;
      if (!response.ok || !data?.ok) throw new Error(data?.error || 'Acquisition details could not be loaded.');
      setAcquisitionDetailsDraft({
        newlyAcquired: data.acquisition?.newlyAcquired ?? false,
        acquisitionDate: data.acquisition?.acquisitionDate || asset.createdAtIso.slice(0, 10) || lifecycleToday(),
        acquisitionAmountExVat: data.acquisition?.acquisitionAmountExVat === null || typeof data.acquisition?.acquisitionAmountExVat === 'undefined' ? '' : String(data.acquisition.acquisitionAmountExVat),
        note: data.acquisition?.note || '',
        sourceDocumentReference: data.acquisition?.sourceDocumentReference || '',
      });
    } catch (error) {
      setAcquisitionDetailsError(error instanceof Error ? error.message : 'Acquisition details could not be loaded.');
    } finally {
      setIsLoadingAcquisitionDetails(false);
    }
  }

  async function handleSaveAcquisitionDetails(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!acquisitionDetailsAsset || acquisitionDetailsDraft.newlyAcquired === null) return;
    setIsSavingAcquisitionDetails(true);
    setAcquisitionDetailsError('');
    try {
      const response = await fetch('/api/asset-lifecycle', {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assetId: acquisitionDetailsAsset.id,
          newlyAcquired: acquisitionDetailsDraft.newlyAcquired,
          acquisitionDate: acquisitionDetailsDraft.acquisitionDate,
          acquisitionAmountExVat: acquisitionDetailsDraft.acquisitionAmountExVat,
          note: acquisitionDetailsDraft.note,
          sourceDocumentReference: acquisitionDetailsDraft.sourceDocumentReference,
        }),
      });
      const data = await response.json().catch(() => null) as { ok?: boolean; error?: string } | null;
      if (!response.ok || !data?.ok) throw new Error(data?.error || 'Acquisition details could not be saved.');
      setNotice({ tone: 'success', message: 'Acquisition details saved.' });
      setAcquisitionDetailsAsset(null);
    } catch (error) {
      setAcquisitionDetailsError(error instanceof Error ? error.message : 'Acquisition details could not be saved.');
    } finally {
      setIsSavingAcquisitionDetails(false);
    }
  }

  async function handleConfirmMarketplacePublish(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!marketplaceAsset || !marketplaceDraft) {
      return;
    }

    const parsedPrice = parseMoneyInput(marketplaceDraft.askingPriceExVat);
    const askingPriceExVat = Math.round(parsedPrice ?? 0);

    if (!Number.isFinite(askingPriceExVat) || askingPriceExVat <= 0) {
      setNotice({ tone: 'error', message: 'Enter a valid marketplace price before continuing.' });
      return;
    }

    if (!marketplaceDraft.sellerName.trim() || !marketplaceDraft.sellerPhone.trim()) {
      setNotice({ tone: 'error', message: 'Add at least a contact name and phone number before sending to marketplace.' });
      return;
    }

    if (!isMarketplaceEligible(marketplaceAsset)) {
      setNotice({ tone: 'error', message: `${PROPERTY_ASSET_LABEL} assets cannot be sent to marketplace.` });
      return;
    }

    setIsPublishingMarketplace(true);

    try {
      const response = await fetch('/api/marketplace', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assetId: marketplaceAsset.id,
          askingPriceExVat,
          marketplaceNotes: marketplaceDraft.description.trim(),
          sellerPhone: marketplaceDraft.sellerPhone.trim(),
          sellerName: marketplaceDraft.sellerName.trim(),
          sellerCompany: marketplaceDraft.sellerCompany.trim(),
          sellerEmail: marketplaceDraft.sellerEmail.trim(),
          province: marketplaceDraft.province.trim(),
          area: marketplaceDraft.area.trim(),
        }),
      });
      const data = (await response.json()) as MarketplaceApiResponse;

      if (!response.ok || !data.ok) {
        throw new Error(data.error ?? 'Failed to send asset to marketplace.');
      }

      const publishedAsset: RegisterAsset = {
        ...marketplaceAsset,
        sellerPhone: marketplaceDraft.sellerPhone.trim(),
        marketplaceNotes: marketplaceDraft.description.trim(),
        marketplaceStatus: data.marketplaceStatus ?? 'live',
        marketplacePriceExVat: askingPriceExVat,
        marketplaceSellerName: marketplaceDraft.sellerName.trim(),
        marketplaceSellerCompany: marketplaceDraft.sellerCompany.trim(),
        marketplaceSellerEmail: marketplaceDraft.sellerEmail.trim(),
        marketplaceProvince: marketplaceDraft.province.trim(),
        marketplaceArea: marketplaceDraft.area.trim(),
        openPartnerNote: data.note ?? marketplaceAsset.openPartnerNote ?? null,
        updatedAtIso: new Date().toISOString(),
      };

      syncUpdatedAsset(publishedAsset);
      setNotice({
        tone: 'success',
        message: `${publishedAsset.title} is ready on the marketplace.`,
      });
      closeMarketplaceModal();

      const listingIdentifier = data.listing?.id ?? data.listing?.sourceAssetId ?? data.assetId ?? publishedAsset.id;
      window.location.assign(`/marketplace/browse?listing=${encodeURIComponent(String(listingIdentifier))}`);
    } catch (error) {
      setNotice({
        tone: 'error',
        message: error instanceof Error ? error.message : 'Failed to send asset to marketplace.',
      });
      setIsPublishingMarketplace(false);
    }
  }

  function handlePublishFromDialog(asset: RegisterAsset) {
    void openMarketplaceModal(asset);
  }

  async function handleRemoveFromMarketplace(asset: RegisterAsset) {
    setBusyMarketplaceRemoveId(asset.id);

    try {
      const response = await fetch(`/api/marketplace?assetId=${encodeURIComponent(asset.id)}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      const data = (await response.json()) as MarketplaceApiResponse;

      if (!response.ok || !data.ok) {
        throw new Error(data.error ?? 'Failed to remove asset from marketplace.');
      }

      const removedAsset: RegisterAsset = {
        ...asset,
        marketplaceStatus: data.marketplaceStatus ?? 'draft',
        updatedAtIso: new Date().toISOString(),
      };

      syncUpdatedAsset(removedAsset);
      setNotice({ tone: 'success', message: `${removedAsset.title} was removed from marketplace.` });
      closeMarketplaceModal();
    } catch (error) {
      setNotice({
        tone: 'error',
        message: error instanceof Error ? error.message : 'Failed to remove asset from marketplace.',
      });
    } finally {
      setBusyMarketplaceRemoveId(null);
    }
  }


  function clearRevaluePreviewResult() {
    setPricingPreview((current) => (current ? {
      ...current,
      advancedAssumptions: null,
      result: null,
      error: null,
      errorContext: null,
    } : current));
  }

  function handleRevalueReplacementPriceChange(event: ChangeEvent<HTMLInputElement>) {
    setRevalueReplacementPriceInput(formatRegisterValueInput(event.target.value));
    if (revalueReplacementPriceError) {
      setRevalueReplacementPriceError(null);
    }

    setPricingPreview((current) => {
      if (!current || current.method !== 'aim4price' || current.replacementMode !== 'custom') {
        return current;
      }

      return {
        ...current,
        replacementPriceExVat: null,
        advancedAssumptions: null,
        result: null,
        error: null,
        errorContext: null,
      };
    });
  }

  function handleRevalueLifetimeUsageChange(event: ChangeEvent<HTMLInputElement>) {
    setRevalueLifetimeUsageInput(formatUsageAmountInput(event.target.value));
    if (revalueAdvancedError) {
      setRevalueAdvancedError(null);
    }
    clearRevaluePreviewResult();
  }

  function readCustomRevalueReplacementPrice(): number | null {
    const customReplacementPrice = parseMoneyInput(revalueReplacementPriceInput);
    return customReplacementPrice !== null && customReplacementPrice > 0 ? Math.round(customReplacementPrice) : null;
  }

  function buildRevalueAdvancedAssumptionsRequest(asset: RegisterAsset): RevalueAdvancedAssumptionsRequest | null | undefined {
    if (!shouldShowRevalueLifetimeInput(asset)) {
      setRevalueAdvancedError(null);
      return null;
    }

    const usageMetric = getAssetUsageMetric(asset);
    const lifetimeUnitLabel = getLifetimeUnitLabel(usageMetric);
    const lifetime = parseMoneyInput(revalueLifetimeUsageInput);

    if (lifetime === null) {
      setRevalueAdvancedError(`Enter expected lifetime ${lifetimeUnitLabel}.`);
      return undefined;
    }

    if (lifetime <= 0) {
      setRevalueAdvancedError(`Expected lifetime ${lifetimeUnitLabel} must be greater than 0.`);
      return undefined;
    }

    setRevalueAdvancedError(null);
    return { maxLifetimeUsage: Math.round(lifetime) };
  }

  function openRevalueGuidedDialog(asset: RegisterAsset) {
    setPricingPreview({
      asset,
      method: 'aim4price',
      replacementMode: null,
      replacementPriceExVat: null,
      advancedAssumptions: null,
      result: null,
      error: null,
      errorContext: null,
    });
    setIsLoadingPricingPreview(false);
    setIsSavingPricingPreview(false);
    setRevalueReplacementPriceInput('');
    setRevalueReplacementPriceError(null);
    setRevalueLifetimeUsageInput(shouldShowRevalueLifetimeInput(asset) ? formatRegisterValueInput(readAssetMaxLifetimeUsage(asset) ?? '') : '');
    setRevalueAdvancedError(null);
    setSaveReplacementPriceWithRevalue(false);
  }

  function showCustomReplacementStep(asset: RegisterAsset) {
    setPricingPreview({
      asset,
      method: 'aim4price',
      replacementMode: 'custom',
      replacementPriceExVat: null,
      advancedAssumptions: null,
      result: null,
      error: null,
      errorContext: null,
    });
    setIsLoadingPricingPreview(false);
    setIsSavingPricingPreview(false);
    setRevalueReplacementPriceError(null);
    setRevalueAdvancedError(null);
  }

  function showSavedReplacementStep(asset: RegisterAsset) {
    setPricingPreview({
      asset,
      method: 'aim4price',
      replacementMode: null,
      replacementPriceExVat: null,
      advancedAssumptions: null,
      result: null,
      error: null,
      errorContext: null,
    });
    setIsLoadingPricingPreview(false);
    setIsSavingPricingPreview(false);
    setRevalueReplacementPriceError(null);
    setRevalueAdvancedError(null);
    setSaveReplacementPriceWithRevalue(false);
  }

  function closeReplacementPriceRevaluePrompt() {
    setReplacementPriceRevaluePrompt(null);
    setNotice({ tone: 'success', message: 'Asset updated successfully.' });
  }

  function openReplacementPriceRevaluePromptFlow() {
    if (!replacementPriceRevaluePrompt) return;

    const { asset, newReplacementPriceExVat } = replacementPriceRevaluePrompt;

    setReplacementPriceRevaluePrompt(null);
    setActiveAsset(asset);
    setIsPricingModalOpen(false);
    setPricingPreview({
      asset,
      method: 'aim4price',
      replacementMode: 'custom',
      replacementPriceExVat: null,
      advancedAssumptions: null,
      result: null,
      error: null,
      errorContext: null,
    });
    setIsLoadingPricingPreview(false);
    setIsSavingPricingPreview(false);
    setRevalueReplacementPriceInput(formatRegisterValueInput(newReplacementPriceExVat));
    setRevalueReplacementPriceError(null);
    setRevalueLifetimeUsageInput(shouldShowRevalueLifetimeInput(asset) ? formatRegisterValueInput(readAssetMaxLifetimeUsage(asset) ?? '') : '');
    setRevalueAdvancedError(null);
    setSaveReplacementPriceWithRevalue(true);
  }

  function handlePreviousRevalueStep() {
    if (!pricingPreview || pricingPreview.method !== 'aim4price' || isLoadingPricingPreview || isSavingPricingPreview) {
      return;
    }

    if (pricingPreview.result || pricingPreview.error) {
      if (pricingPreview.replacementMode === 'custom') {
        setPricingPreview({
          asset: pricingPreview.asset,
          method: 'aim4price',
          replacementMode: 'custom',
          replacementPriceExVat: null,
          advancedAssumptions: null,
          result: null,
          error: null,
          errorContext: null,
        });
      } else {
        showSavedReplacementStep(pricingPreview.asset);
      }

      return;
    }

    showSavedReplacementStep(pricingPreview.asset);
  }

  function openSavedReplacementPreview(asset: RegisterAsset) {
    const advancedAssumptions = buildRevalueAdvancedAssumptionsRequest(asset);
    if (typeof advancedAssumptions === 'undefined') return;

    setSaveReplacementPriceWithRevalue(false);
    setRevalueReplacementPriceError(null);
    void openRevaluePreviewDialog(asset, 'aim4price', {
      replacementMode: 'saved',
      advancedAssumptions,
    });
  }

  function openCustomReplacementPreview(asset: RegisterAsset) {
    const customReplacementPrice = readCustomRevalueReplacementPrice();

    if (customReplacementPrice === null) {
      setRevalueReplacementPriceError('Enter a valid replacement price excluding VAT.');
      return;
    }

    const advancedAssumptions = buildRevalueAdvancedAssumptionsRequest(asset);
    if (typeof advancedAssumptions === 'undefined') return;

    setRevalueReplacementPriceError(null);
    void openRevaluePreviewDialog(asset, 'aim4price', {
      replacementMode: 'custom',
      replacementPriceExVat: customReplacementPrice,
      advancedAssumptions,
    });
  }

  async function handleUpdateEstimate(asset: RegisterAsset, selectedMethod?: RevalueMethod, closePricingAfterSuccess = false) {
    setBusyRevalueAssetId(asset.id);
    setBusyRevalueAction(selectedMethod ?? null);

    try {
      const response = await fetch('/api/asset-register/revalue', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assetId: asset.id,
          ...(selectedMethod ? { selectedMethod } : {}),
        }),
      });
      const data = (await response.json()) as RevalueAssetApiResponse;

      if (!response.ok || !data.ok || !data.item) {
        throw new Error(data.error ?? 'Failed to update estimate.');
      }

      const updatedAsset = data.item;
      syncUpdatedAsset(updatedAsset);

      if (closePricingAfterSuccess) {
        setIsPricingModalOpen(false);
      }

      const updateLabel = 'Aim4price value';
      const marketplaceNote = isLiveOnMarketplace(asset) ? ' Marketplace asking price was not changed.' : '';
      const message = savedRevalueValueStayedTheSame(data, asset)
        ? `${STAGED_DEPRECIATION_NOTICE_MESSAGE}${data.warning ? ` ${data.warning}` : ''}${marketplaceNote}`
        : `${updatedAsset.title} ${updateLabel} updated to ${money(updatedAsset.value)}.${data.warning ? ` ${data.warning}` : ''}${marketplaceNote}`;

      setNotice({
        tone: 'success',
        message,
      });
    } catch (error) {
      setNotice({
        tone: 'error',
        message: error instanceof Error ? error.message : 'Failed to update estimate.',
      });
    } finally {
      setBusyRevalueAssetId(null);
      setBusyRevalueAction(null);
    }
  }

  async function openRevaluePreviewDialog(
    asset: RegisterAsset,
    method: RevalueMethod,
    options?: {
      replacementMode?: RevalueReplacementMode | null;
      replacementPriceExVat?: number | null;
      advancedAssumptions?: RevalueAdvancedAssumptionsRequest | null;
    },
  ) {
    const replacementPriceExVat =
      typeof options?.replacementPriceExVat === 'number' &&
      Number.isFinite(options.replacementPriceExVat) &&
      options.replacementPriceExVat > 0
        ? Math.round(options.replacementPriceExVat)
        : null;
    const replacementMode = options?.replacementMode ?? 'saved';
    const advancedAssumptions = options && Object.prototype.hasOwnProperty.call(options, 'advancedAssumptions')
      ? options.advancedAssumptions ?? null
      : null;
    const shouldSendReplacementOverride = replacementPriceExVat !== null;

    if (replacementMode !== 'custom') {
      setSaveReplacementPriceWithRevalue(false);
    }

    const initialPreview: PricingRevaluePreview = {
      asset,
      method,
      replacementMode,
      replacementPriceExVat,
      advancedAssumptions,
      result: null,
      error: null,
      errorContext: null,
    };

    const previewRequestId = revaluePreviewRequestSeqRef.current + 1;
    revaluePreviewRequestSeqRef.current = previewRequestId;

    setPricingPreview(initialPreview);
    setIsLoadingPricingPreview(true);
    setIsSavingPricingPreview(false);

    try {
      const response = await fetch('/api/asset-register/revalue', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assetId: asset.id,
          selectedMethod: method,
          previewOnly: true,
          ...(shouldSendReplacementOverride ? { replacementPriceExVat } : {}),
          ...(advancedAssumptions ? { advancedAssumptions } : {}),
        }),
      });
      const data = (await response.json()) as RevalueAssetApiResponse;

      if (!response.ok || !data.ok || !data.item) {
        throw new Error(data.error ?? 'Failed to calculate the new value preview.');
      }

      if (revaluePreviewRequestSeqRef.current !== previewRequestId) {
        return;
      }

      setPricingPreview((current) => {
        if (!current || current.asset.id !== asset.id || current.method !== method) {
          return current;
        }

        return {
          ...current,
          result: data,
          error: null,
          errorContext: null,
        };
      });
    } catch (error) {
      if (revaluePreviewRequestSeqRef.current !== previewRequestId) {
        return;
      }

      setPricingPreview((current) => {
        if (!current || current.asset.id !== asset.id || current.method !== method) {
          return current;
        }

        return {
          ...current,
          result: null,
          error: error instanceof Error ? error.message : 'Failed to calculate the new value preview.',
          errorContext: 'preview',
        };
      });
    } finally {
      if (revaluePreviewRequestSeqRef.current === previewRequestId) {
        setIsLoadingPricingPreview(false);
      }
    }
  }

  async function handleSavePricingPreview() {
    if (!pricingPreview) return;

    const { asset, method, replacementMode, replacementPriceExVat, advancedAssumptions } = pricingPreview;
    const shouldUseReplacementOverride = method === 'aim4price' && replacementMode === 'custom' && replacementPriceExVat !== null;
    const shouldPersistReplacementPrice = shouldUseReplacementOverride && saveReplacementPriceWithRevalue;

    if (shouldUseReplacementOverride) {
      const customReplacementPrice = readCustomRevalueReplacementPrice();

      if (customReplacementPrice !== replacementPriceExVat) {
        setRevalueReplacementPriceError('Preview this replacement price before saving the new value.');
        return;
      }
    }

    setIsSavingPricingPreview(true);

    try {
      const response = await fetch('/api/asset-register/revalue', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assetId: asset.id,
          selectedMethod: method,
          ...(shouldUseReplacementOverride ? { replacementPriceExVat, saveReplacementPrice: shouldPersistReplacementPrice } : {}),
          ...(advancedAssumptions ? { advancedAssumptions } : {}),
        }),
      });
      const data = (await response.json()) as RevalueAssetApiResponse;

      if (!response.ok || !data.ok || !data.item) {
        throw new Error(data.error ?? 'Failed to save the new value.');
      }

      const updatedAsset = data.item;
      syncUpdatedAsset(updatedAsset);
      setPricingPreview(null);
      setRevalueReplacementPriceError(null);
      setRevalueAdvancedError(null);
      setSaveReplacementPriceWithRevalue(false);
      setIsPricingModalOpen(false);

      const updateLabel = 'Aim4price value';
      const marketplaceNote = isLiveOnMarketplace(asset) ? ' Marketplace asking price was not changed.' : '';
      const replacementNote = shouldPersistReplacementPrice && replacementPriceExVat !== null
        ? ` Replacement price saved at ${money(replacementPriceExVat)}.`
        : '';
      const message = savedRevalueValueStayedTheSame(data, asset)
        ? `${STAGED_DEPRECIATION_NOTICE_MESSAGE}${replacementNote}${data.warning ? ` ${data.warning}` : ''}${marketplaceNote}`
        : `${updatedAsset.title} ${updateLabel} saved at ${money(updatedAsset.value)}.${replacementNote}${data.warning ? ` ${data.warning}` : ''}${marketplaceNote}`;

      setNotice({
        tone: 'success',
        message,
      });
    } catch (error) {
      setPricingPreview((current) => (current ? {
        ...current,
        error: error instanceof Error ? error.message : 'Failed to save the new value.',
        errorContext: 'save',
      } : current));
    } finally {
      setIsSavingPricingPreview(false);
    }
  }

  async function handleMarkPartnerNoteNoted(noteId: string, assetId: string) {
    try {
      const response = await fetch(`/api/asset-notes/${encodeURIComponent(noteId)}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'noted' }),
      });
      const data = (await response.json()) as { ok: boolean; error?: string };

      if (!response.ok || !data.ok) {
        throw new Error(data.error ?? 'Failed to mark note as noted.');
      }

      const notedAtIso = new Date().toISOString();
      const markNoteAsNoted = (asset: RegisterAsset): RegisterAsset => ({
        ...asset,
        openPartnerNote: null,
        partnerNotes: asset.partnerNotes?.map((note) => (note.id === noteId ? { ...note, status: 'noted', notedAtIso } : note)),
      });

      setAssets((current) => current.map((entry) => (entry.id === assetId ? markNoteAsNoted(entry) : entry)));
      setActiveAsset((current) => (current?.id === assetId ? markNoteAsNoted(current) : current));
      setMarketplaceAsset((current) => (current?.id === assetId ? markNoteAsNoted(current) : current));
      setNotice({ tone: 'success', message: 'Partner note marked as noted.' });
    } catch (error) {
      setNotice({
        tone: 'error',
        message: error instanceof Error ? error.message : 'Failed to mark note as noted.',
      });
    }
  }

  async function handleDealerCorrectionDecision(
    correction: DealerAssetCorrectionRequest,
    decision: 'accept' | 'reject',
  ) {
    setBusyDealerCorrectionId(correction.id);

    try {
      const response = await fetch(`/api/asset-corrections/${encodeURIComponent(correction.id)}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision }),
      });
      const data = (await response.json().catch(() => null)) as {
        ok?: boolean;
        correction?: DealerAssetCorrectionRequest;
        outcome?: string;
        message?: string;
        asset?: RegisterAsset | null;
        error?: string;
      } | null;

      if (!response.ok || !data?.ok) {
        throw new Error(data?.error ?? 'Failed to save the dealer update decision.');
      }

      const applyDecision = (entry: RegisterAsset): RegisterAsset => {
        if (entry.id !== correction.assetId) return entry;
        const revaluationNeedsAttention =
          data.outcome === 'accepted_revaluation_failed'
          || data.outcome === 'accepted_revaluation_pending';
        return {
          ...entry,
          ...(data.asset ?? {}),
          dealerAssetCorrection: revaluationNeedsAttention
            ? data.correction ?? correction
            : null,
        } as RegisterAsset;
      };

      setAssets((current) => current.map(applyDecision));
      setActiveAsset((current) => current ? applyDecision(current) : current);
      setMarketplaceAsset((current) => current ? applyDecision(current) : current);
      setProjectionAsset((current) => current ? applyDecision(current) : current);
      setQuoteAsset((current) => current ? applyDecision(current) : current);
      setNotice({
        tone: data.outcome === 'accepted_revaluation_failed' || data.outcome === 'accepted_revaluation_pending'
          ? 'warning'
          : 'success',
        message: data.message || (
          decision === 'accept'
            ? 'Dealer update accepted and saved to the Asset Register.'
            : 'Dealer update declined.'
        ),
      });
      if (data.outcome !== 'accepted_revaluation_failed' && data.outcome !== 'accepted_revaluation_pending') {
        window.dispatchEvent(new CustomEvent('aim4price:dealer-correction-resolved', {
          detail: { correctionId: correction.id },
        }));
      }
    } catch (error) {
      setNotice({
        tone: 'error',
        message: error instanceof Error ? error.message : 'Failed to save the dealer update decision.',
      });
    } finally {
      setBusyDealerCorrectionId((current) => (current === correction.id ? null : current));
    }
  }

  async function handleDealerCorrectionRevaluationRetry(correction: DealerAssetCorrectionRequest) {
    setBusyDealerCorrectionId(correction.id);
    try {
      const response = await fetch(`/api/asset-corrections/${encodeURIComponent(correction.id)}/retry`, {
        method: 'POST',
        credentials: 'include',
      });
      const data = (await response.json().catch(() => null)) as {
        ok?: boolean;
        correction?: DealerAssetCorrectionRequest;
        outcome?: string;
        message?: string;
        asset?: RegisterAsset | null;
        error?: string;
      } | null;
      if (!response.ok || !data?.ok) {
        throw new Error(data?.error ?? 'Aim4price could not retry this valuation.');
      }

      const succeeded = data.outcome === 'accepted_revalued';
      const applyResult = (entry: RegisterAsset): RegisterAsset => entry.id === correction.assetId
        ? {
            ...entry,
            ...(data.asset ?? {}),
            dealerAssetCorrection: succeeded ? null : data.correction ?? correction,
          } as RegisterAsset
        : entry;
      setAssets((current) => current.map(applyResult));
      setActiveAsset((current) => current ? applyResult(current) : current);
      setMarketplaceAsset((current) => current ? applyResult(current) : current);
      setProjectionAsset((current) => current ? applyResult(current) : current);
      setQuoteAsset((current) => current ? applyResult(current) : current);
      setNotice({
        tone: succeeded ? 'success' : 'warning',
        message: data.message || (
          succeeded
            ? 'Aim4price recalculated the asset and saved the latest estimate.'
            : 'Aim4price could not complete the recalculation.'
        ),
      });
      if (succeeded) {
        window.dispatchEvent(new CustomEvent('aim4price:dealer-correction-resolved', {
          detail: { correctionId: correction.id },
        }));
      }
    } catch (error) {
      setNotice({
        tone: 'error',
        message: error instanceof Error ? error.message : 'Aim4price could not retry this valuation.',
      });
    } finally {
      setBusyDealerCorrectionId(null);
    }
  }

  async function handleMarkMaintenanceStatusNoted(maintenanceStatusId: string, assetId: string) {
    setBusyMaintenanceStatusId(maintenanceStatusId);

    try {
      const response = await fetch(`/api/asset-maintenance-status/${encodeURIComponent(maintenanceStatusId)}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'noted' }),
      });
      const data = (await response.json()) as { ok: boolean; error?: string };

      if (!response.ok || !data.ok) {
        throw new Error(data.error ?? 'Failed to mark maintenance as noted.');
      }

      setAssets((current) => current.map((entry) => (entry.id === assetId ? { ...entry, latestMaintenanceStatus: null } : entry)));
      setActiveAsset((current) => (current?.id === assetId ? { ...current, latestMaintenanceStatus: null } : current));
      setMarketplaceAsset((current) => (current?.id === assetId ? { ...current, latestMaintenanceStatus: null } : current));
      setProjectionAsset((current) => (current?.id === assetId ? { ...current, latestMaintenanceStatus: null } : current));
      setNotice({ tone: 'success', message: 'Maintenance marked as noted.' });
    } catch (error) {
      setNotice({
        tone: 'error',
        message: error instanceof Error ? error.message : 'Failed to mark maintenance as noted.',
      });
    } finally {
      setBusyMaintenanceStatusId((current) => (current === maintenanceStatusId ? null : current));
    }
  }

  async function handleMarkMaintenanceAlertNoted(maintenanceAlertId: string, assetId: string) {
    setBusyMaintenanceAlertId(maintenanceAlertId);

    try {
      const response = await fetch(`/api/maintenance/${encodeURIComponent(maintenanceAlertId)}/alert`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'noted' }),
      });
      const data = (await response.json()) as { ok: boolean; error?: string };

      if (!response.ok || !data.ok) {
        throw new Error(data.error ?? 'Failed to mark maintenance alert as noted.');
      }

      setAssets((current) => current.map((entry) => (entry.id === assetId ? { ...entry, maintenanceAlert: null } : entry)));
      setActiveAsset((current) => (current?.id === assetId ? { ...current, maintenanceAlert: null } : current));
      setMarketplaceAsset((current) => (current?.id === assetId ? { ...current, maintenanceAlert: null } : current));
      setProjectionAsset((current) => (current?.id === assetId ? { ...current, maintenanceAlert: null } : current));
      setNotice({ tone: 'success', message: 'Maintenance alert marked as noted.' });
    } catch (error) {
      setNotice({
        tone: 'error',
        message: error instanceof Error ? error.message : 'Failed to mark maintenance alert as noted.',
      });
    } finally {
      setBusyMaintenanceAlertId((current) => (current === maintenanceAlertId ? null : current));
    }
  }

  async function handleMarkLicenseRenewalAlertNoted(assetId: string, renewalDate: string) {
    setBusyLicenseRenewalAssetId(assetId);

    try {
      const response = await fetch('/api/asset-register/license-alert', {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assetId, renewalDate, status: 'noted' }),
      });
      const data = (await response.json()) as { ok: boolean; error?: string };

      if (!response.ok || !data.ok) {
        throw new Error(data.error ?? 'Failed to mark the license renewal alert as noted.');
      }

      const withoutLicenseRenewalAlert = (entry: RegisterAsset): RegisterAsset => ({
        ...entry,
        licenseRenewalAlert: null,
      });

      setAssets((current) => current.map((entry) => (entry.id === assetId ? withoutLicenseRenewalAlert(entry) : entry)));
      setActiveAsset((current) => (current?.id === assetId ? withoutLicenseRenewalAlert(current) : current));
      setMarketplaceAsset((current) => (current?.id === assetId ? withoutLicenseRenewalAlert(current) : current));
      setProjectionAsset((current) => (current?.id === assetId ? withoutLicenseRenewalAlert(current) : current));
      setQuoteAsset((current) => (current?.id === assetId ? withoutLicenseRenewalAlert(current) : current));
      setNotice({ tone: 'success', message: 'License renewal alert marked as noted.' });
    } catch (error) {
      setNotice({
        tone: 'error',
        message: error instanceof Error ? error.message : 'Failed to mark the license renewal alert as noted.',
      });
    } finally {
      setBusyLicenseRenewalAssetId((current) => (current === assetId ? null : current));
    }
  }

  async function handleMarkIssueNoteStatusNoted(issueNoteStatusId: string, assetId: string) {
    setBusyIssueNoteStatusId(issueNoteStatusId);

    try {
      const response = await fetch(`/api/asset-issue-notes/${encodeURIComponent(issueNoteStatusId)}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'noted' }),
      });
      const data = (await response.json()) as { ok: boolean; error?: string };

      if (!response.ok || !data.ok) {
        throw new Error(data.error ?? 'Failed to mark issue note as noted.');
      }

      setAssets((current) => current.map((entry) => (entry.id === assetId ? { ...entry, latestIssueNoteStatus: null } : entry)));
      setActiveAsset((current) => (current?.id === assetId ? { ...current, latestIssueNoteStatus: null } : current));
      setMarketplaceAsset((current) => (current?.id === assetId ? { ...current, latestIssueNoteStatus: null } : current));
      setProjectionAsset((current) => (current?.id === assetId ? { ...current, latestIssueNoteStatus: null } : current));
      setNotice({ tone: 'success', message: 'Issue note marked as noted.' });
    } catch (error) {
      setNotice({
        tone: 'error',
        message: error instanceof Error ? error.message : 'Failed to mark issue note as noted.',
      });
    } finally {
      setBusyIssueNoteStatusId((current) => (current === issueNoteStatusId ? null : current));
    }
  }

  async function handlePrintAssetSheet(asset: RegisterAsset) {
    const [reportLogoUrl, assetPhotoUrls] = await Promise.all([
      preparePrintableImageUrl(getRegisterReportLogoUrl(activeRegister), {
        maxDimension: PRINT_LOGO_MAX_DIMENSION,
        mimeType: 'image/png',
      }),
      preparePrintableImageUrls(asset.photos, {
        maxDimension: PRINT_ASSET_SHEET_PHOTO_MAX_DIMENSION,
        mimeType: 'image/jpeg',
        quality: 0.86,
      }),
    ]);
    const documentsCount = assetDocuments(asset).length;
    const ownerProfile = reportProfile;
    const profileLocation = [ownerProfile?.townCity, ownerProfile?.province]
      .map((part) => String(part ?? '').trim())
      .filter(Boolean)
      .join(', ');
    const profileAddress = [ownerProfile?.addressLine1, ownerProfile?.addressLine2, profileLocation]
      .map((part) => String(part ?? '').trim())
      .filter(Boolean)
      .join(', ');
    const ownerBusinessName =
      ownerProfile?.businessName?.trim() ||
      ownerProfile?.marketplaceSellerName?.trim() ||
      ownerProfile?.name?.trim() ||
      'Aim4price client';
    const ownerBusinessEmail = ownerProfile?.marketplaceEmail?.trim() || ownerProfile?.email?.trim() || '—';
    const ownerContactDetails = ownerProfile?.marketplacePhone?.trim() || ownerProfile?.phone?.trim() || '—';
    const ownerLocationAddress = profileAddress || ownerProfile?.marketplaceLocation?.trim() || '—';
    const familyLabel = assetKindLabel(asset);
    const initialModelValue = asset.modelName || asset.typedModelName || '';
    const reportBrandName = deriveAssetReportBrandName(asset, initialModelValue);
    const modelValue = deriveAssetReportModelName(asset, reportBrandName);
    const selectedMethodCards = buildAssetSheetMethodCards(asset).filter((card) => card.selected);
    const methodCards = selectedMethodCards.length ? selectedMethodCards : buildAssetSheetMethodCards(asset).slice(0, 1);
    const isPropertyAsset = asset.kind === 'property';
    const assetRows = isPropertyAsset
      ? [
          { label: 'Category', value: familyLabel },
          { label: PROPERTY_YEAR_LABEL, value: asset.yearModel ? String(asset.yearModel) : '—' },
          { label: 'Size', value: propertySizeDisplay(asset) },
          { label: 'Condition', value: conditionLabel(asset.condition) || '—' },
          { label: 'Replacement Price', value: readAssetReplacementPriceExVat(asset) !== null ? `${money(readAssetReplacementPriceExVat(asset) ?? 0)} excl. VAT` : 'Not set' },
          { label: 'Insured', value: statusChoiceReportLabel(readInsuranceStatusChoice(asset)) },
          { label: 'Insured Value', value: readAssetInsuredValueExVat(asset) !== null ? `${money(readAssetInsuredValueExVat(asset) ?? 0)} excl. VAT` : 'Not set' },
          { label: 'Financed', value: statusChoiceReportLabel(readFinanceStatusChoice(asset)) },
          { label: 'Documents', value: documentsCount ? `${documentsCount} saved` : 'None' },
          { label: 'Last Updated', value: assetStatusDateLabel(asset) },
        ]
      : [
          { label: 'Category', value: familyLabel },
          { label: 'Brand', value: reportBrandName },
          { label: 'Model', value: modelValue },
          ...(asset.powerKw ? [{ label: 'Power', value: `${asset.powerKw} kW` }] : []),
          ...(asset.tractorType ? [{ label: 'Type', value: formatTractorType(asset.tractorType) }] : []),
          ...(asset.drive ? [{ label: 'Drive', value: formatDrive(asset.drive) }] : []),
          ...(asset.cab ? [{ label: 'Cab', value: formatCab(asset.cab) }] : []),
          { label: 'Year', value: asset.yearModel ? String(asset.yearModel) : '—' },
          { label: 'Usage', value: buildAssetUsageValue(asset) },
          { label: 'Condition', value: conditionLabel(asset.condition) || '—' },
          { label: 'Replacement Price', value: readAssetReplacementPriceExVat(asset) !== null ? `${money(readAssetReplacementPriceExVat(asset) ?? 0)} excl. VAT` : 'Not set' },
          { label: 'Serial Number', value: asset.serialNumber || '—' },
          { label: 'Insured', value: statusChoiceReportLabel(readInsuranceStatusChoice(asset)) },
          { label: 'Insured Value', value: readAssetInsuredValueExVat(asset) !== null ? `${money(readAssetInsuredValueExVat(asset) ?? 0)} excl. VAT` : 'Not set' },
          { label: 'Financed', value: statusChoiceReportLabel(readFinanceStatusChoice(asset)) },
          { label: 'Licensed', value: statusChoiceReportLabel(readLicenseStatusChoice(asset)) },
          ...(readLicenseStatusChoice(asset) === 'yes' && readLicenseRegistrationNumber(asset)
            ? [{ label: 'Registration', value: readLicenseRegistrationNumber(asset) }]
            : []),
          { label: 'Documents', value: documentsCount ? `${documentsCount} saved` : 'None' },
          { label: 'Last Updated', value: assetStatusDateLabel(asset) },
        ];

    const didOpen = openAssetSheetPrint({
      logoUrl: reportLogoUrl ?? getRegisterReportLogoUrl(activeRegister),
      generatedAt: formatDate(new Date().toISOString()),
      assetBadge: familyLabel,
      heroTitle: asset.title,
      heroMeta: buildAssetMeta(asset),
      valueLabel: 'Estimated Value',
      value: money(asset.value),
      valueNote: methodLabel(asset.selectedMethod),
      statusLabel: assetStatusDateLabel(asset),
      issuerName: 'Aim4price',
      issuerAddress: 'Saved asset register data',
      issuerPhone: '',
      issuerEmail: 'aim4price@gmail.com',
      clientRows: [
        { label: 'Business Name', value: ownerBusinessName },
        { label: 'Contact Details', value: ownerContactDetails },
        { label: 'Business Email', value: ownerBusinessEmail },
        { label: 'Location / Address', value: ownerLocationAddress },
      ],
      photoUrl: assetPhotoUrls[0] ?? null,
      photoUrls: assetPhotoUrls,
      facts: assetRows,
      // Owner-downloaded valuation reports must never expose internal, dealer, finance, or insurance notes.
      notes: [],
      methodCards,
      footerNote:
        'Values are indicative estimates based on saved asset-register information and available pricing inputs. This is not a certified valuation, inspection report or guarantee of selling price. Final value remains subject to physical inspection, documentation, attachments, condition, location and live market demand.',
    });

    if (!didOpen) {
      setNotice({
        tone: 'error',
        message: 'Unable to open the asset valuation report. Please allow pop-ups and try again.',
      });
      return;
    }

    closeAssetReportDialog();
  }

  async function handleCopyScanLink(asset: RegisterAsset) {
    const scanUrl = buildAssetScanUrl(asset);

    if (!scanUrl) {
      setNotice({ tone: 'error', message: 'This asset does not have a scan link yet.' });
      return;
    }

    function markScanLinkCopied() {
      setCopiedScanLinkAssetId(asset.id);
      window.setTimeout(() => {
        setCopiedScanLinkAssetId((current) => (current === asset.id ? null : current));
      }, 2200);
    }

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(scanUrl);
        markScanLinkCopied();
        setNotice({ tone: 'success', message: 'Scan link copied.' });
        return;
      }

      window.prompt('Copy this asset scan link', scanUrl);
      markScanLinkCopied();
      setNotice({ tone: 'success', message: 'Scan link ready to copy.' });
    } catch (error) {
      setCopiedScanLinkAssetId(null);
      setNotice({
        tone: 'error',
        message: error instanceof Error ? error.message : 'Failed to copy the scan link.',
      });
    }
  }

  function assetReportLabel(reportKind: AssetPdfReportKind): string {
    if (reportKind === 'fuel') return 'Fuel report';
    if (reportKind === 'depreciation') return 'Depreciation log';
    return 'Maintenance report';
  }

  function handleOpenAssetPdfReport(asset: RegisterAsset, reportKind: AssetPdfReportKind, filters?: AssetPdfReportFilters): boolean {
    const reportUrl = buildAssetPdfReportUrl(asset, reportKind, filters, 'pdf');
    const opened = window.open(reportUrl, '_blank', 'noopener,noreferrer');
    const reportLabel = assetReportLabel(reportKind);

    if (!opened) {
      setNotice({
        tone: 'error',
        message: `Unable to open the ${reportLabel.toLowerCase()}. Please allow pop-ups and try again.`,
      });
      return false;
    }

    setNotice({
      tone: 'success',
      message: `${reportLabel} opened in a new tab. Use Print to save it as a PDF.`,
    });
    return true;
  }

  async function handleDownloadAssetReportXlsx(asset: RegisterAsset, reportKind: AssetPdfReportKind, filters?: AssetPdfReportFilters) {
    const reportLabel = assetReportLabel(reportKind);

    try {
      const response = await fetch(buildAssetPdfReportUrl(asset, reportKind, filters, 'xlsx'), {
        credentials: 'include',
        cache: 'no-store',
      });

      if (!response.ok) {
        try {
          const data = (await response.json()) as { error?: string };
          throw new Error(data.error ?? `Failed to download the ${reportLabel.toLowerCase()} Excel file.`);
        } catch (error) {
          if (error instanceof Error) {
            throw error;
          }

          throw new Error(`Failed to download the ${reportLabel.toLowerCase()} Excel file.`);
        }
      }

      const blob = await response.blob();
      const fallbackName = `${asset.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'asset'}-${reportKind}-report.xlsx`;
      const fileName = parseDownloadFileName(response, fallbackName);
      downloadBlob(blob, fileName);
      setNotice({ tone: 'success', message: `${reportLabel} Excel downloaded.` });
      closeAssetReportDialog();
    } catch (error) {
      setNotice({
        tone: 'error',
        message: error instanceof Error ? error.message : `Failed to download the ${reportLabel.toLowerCase()} Excel file.`,
      });
    }
  }

  function openAssetFuelReportFilter() {
    if (!canDownloadAssetFuelReport(activeAsset)) {
      setNotice({ tone: 'error', message: 'Fuel reports are not available for property, land or building assets.' });
      return;
    }

    setAssetReportStep('fuel-format');
    setAssetFuelReportYear('all');
    setAssetFuelReportMonth('all');
    setAssetReportDownloadFormat('pdf');
    setOpenAssetReportSelect(null);
  }

  function openAssetMaintenanceReportFilter() {
    setAssetReportStep('maintenance-format');
    setAssetMaintenanceReportType('all');
    setAssetMaintenanceReportYear('all');
    setAssetMaintenanceReportMonth('all');
    setAssetReportDownloadFormat('pdf');
    setOpenAssetReportSelect(null);
  }

  function openAssetDepreciationReportFilter() {
    if (!canDownloadAssetDepreciationReport(activeAsset)) {
      setNotice({ tone: 'error', message: 'Depreciation logs are not available for property, land or building assets.' });
      return;
    }

    setAssetReportStep('depreciation-format');
    setAssetDepreciationReportYear('all');
    setAssetDepreciationReportMonth('all');
    setAssetReportDownloadFormat('pdf');
    setOpenAssetReportSelect(null);
  }

  function openAssetOwnershipReportFilter() {
    setAssetReportStep('ownership-format');
    setAssetOwnershipReportYear('all');
    setAssetOwnershipReportMonth('all');
    setAssetReportDownloadFormat('pdf');
    setOpenAssetReportSelect(null);
  }

  function backToAssetReportOptions() {
    setAssetReportStep('options');
    setOpenAssetReportSelect(null);
  }

  function showAssetReportTimelineStep() {
    setAssetReportStep((currentStep) => {
      if (currentStep === 'fuel-format') return 'fuel-filter';
      if (currentStep === 'maintenance-format') return 'maintenance-filter';
      if (currentStep === 'depreciation-format') return 'depreciation-filter';
      if (currentStep === 'ownership-format') return 'ownership-filter';
      return currentStep;
    });
    setOpenAssetReportSelect(null);
  }

  function backToAssetReportFormatStep() {
    setAssetReportStep((currentStep) => {
      if (currentStep === 'fuel-filter') return 'fuel-format';
      if (currentStep === 'maintenance-filter') return 'maintenance-format';
      if (currentStep === 'depreciation-filter') return 'depreciation-format';
      if (currentStep === 'ownership-filter') return 'ownership-format';
      return currentStep;
    });
    setOpenAssetReportSelect(null);
  }

  function toggleAssetReportSelect(selectKey: AssetReportSelectKey) {
    setOpenAssetReportSelect((currentSelectKey) => (currentSelectKey === selectKey ? null : selectKey));
  }

  function selectAssetFuelReportYear(value: string) {
    setAssetFuelReportYear(value);
    setAssetFuelReportMonth('all');
    setOpenAssetReportSelect(null);
  }

  function selectAssetFuelReportMonth(value: string) {
    setAssetFuelReportMonth(value);
    setOpenAssetReportSelect(null);
  }

  function selectAssetMaintenanceReportType(value: string) {
    setAssetMaintenanceReportType(value);
    setOpenAssetReportSelect(null);
  }

  function selectAssetMaintenanceReportYear(value: string) {
    setAssetMaintenanceReportYear(value);
    setAssetMaintenanceReportMonth('all');
    setOpenAssetReportSelect(null);
  }

  function selectAssetMaintenanceReportMonth(value: string) {
    setAssetMaintenanceReportMonth(value);
    setOpenAssetReportSelect(null);
  }

  function selectAssetDepreciationReportYear(value: string) {
    setAssetDepreciationReportYear(value);
    setAssetDepreciationReportMonth('all');
    setOpenAssetReportSelect(null);
  }

  function selectAssetDepreciationReportMonth(value: string) {
    setAssetDepreciationReportMonth(value);
    setOpenAssetReportSelect(null);
  }

  function selectAssetOwnershipReportYear(value: string) {
    setAssetOwnershipReportYear(value);
    setAssetOwnershipReportMonth('all');
    setOpenAssetReportSelect(null);
  }

  function selectAssetOwnershipReportMonth(value: string) {
    setAssetOwnershipReportMonth(value);
    setOpenAssetReportSelect(null);
  }

  async function handleDownloadFilteredFuelReport(asset: RegisterAsset, format: AssetReportFormat = 'pdf') {
    if (!canDownloadAssetFuelReport(asset)) {
      setNotice({ tone: 'error', message: 'Fuel reports are not available for property, land or building assets.' });
      return;
    }

    const filters: AssetPdfReportFilters = {
      year: assetFuelReportYear,
      month: assetFuelReportYear === 'all' ? 'all' : assetFuelReportMonth,
    };

    if (format === 'xlsx') {
      await handleDownloadAssetReportXlsx(asset, 'fuel', filters);
      return;
    }

    const didOpen = handleOpenAssetPdfReport(asset, 'fuel', filters);

    if (didOpen) {
      closeAssetReportDialog();
    }
  }

  async function handleDownloadFilteredMaintenanceReport(asset: RegisterAsset, format: AssetReportFormat = 'pdf') {
    const filters: AssetPdfReportFilters = {
      maintenanceType: assetMaintenanceReportType,
      year: assetMaintenanceReportYear,
      month: assetMaintenanceReportYear === 'all' ? 'all' : assetMaintenanceReportMonth,
    };

    if (format === 'xlsx') {
      await handleDownloadAssetReportXlsx(asset, 'maintenance', filters);
      return;
    }

    const didOpen = handleOpenAssetPdfReport(asset, 'maintenance', filters);

    if (didOpen) {
      closeAssetReportDialog();
    }
  }

  async function handleDownloadFilteredDepreciationReport(asset: RegisterAsset, format: AssetReportFormat = 'pdf') {
    if (!canDownloadAssetDepreciationReport(asset)) {
      setNotice({ tone: 'error', message: 'Depreciation logs are not available for property, land or building assets.' });
      return;
    }

    const filters: AssetPdfReportFilters = {
      year: assetDepreciationReportYear,
      month: assetDepreciationReportYear === 'all' ? 'all' : assetDepreciationReportMonth,
    };

    if (format === 'xlsx') {
      await handleDownloadAssetReportXlsx(asset, 'depreciation', filters);
      return;
    }

    const didOpen = handleOpenAssetPdfReport(asset, 'depreciation', filters);

    if (didOpen) {
      closeAssetReportDialog();
    }
  }

  async function handleDownloadFilteredOwnershipReport(asset: RegisterAsset, format: AssetReportFormat = 'pdf') {
    const filters: AssetPdfReportFilters = {
      year: assetOwnershipReportYear,
      month: assetOwnershipReportYear === 'all' ? 'all' : assetOwnershipReportMonth,
    };

    if (format === 'xlsx') {
      try {
        const response = await fetch(buildAssetOwnershipReportUrl(asset, filters, 'xlsx'), {
          credentials: 'include',
          cache: 'no-store',
        });

        if (!response.ok) {
          try {
            const data = (await response.json()) as { error?: string };
            throw new Error(data.error ?? 'Failed to download the cost of ownership Excel file.');
          } catch (error) {
            if (error instanceof Error) {
              throw error;
            }

            throw new Error('Failed to download the cost of ownership Excel file.');
          }
        }

        const blob = await response.blob();
        const assetSlug = asset.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'asset';
        const fileName = parseDownloadFileName(response, `${assetSlug}-cost-of-ownership.xlsx`);
        downloadBlob(blob, fileName);
        setNotice({ tone: 'success', message: 'Cost of Ownership Excel downloaded.' });
        closeAssetReportDialog();
      } catch (error) {
        setNotice({
          tone: 'error',
          message: error instanceof Error ? error.message : 'Failed to download the cost of ownership Excel file.',
        });
      }

      return;
    }

    const opened = window.open(buildAssetOwnershipReportUrl(asset, filters, 'pdf'), '_blank', 'noopener,noreferrer');

    if (!opened) {
      setNotice({
        tone: 'error',
        message: 'Unable to open the cost of ownership report. Please allow pop-ups and try again.',
      });
      return;
    }

    setNotice({
      tone: 'success',
      message: 'Cost of Ownership report opened in a new tab. Use Print to save it as a PDF.',
    });
    closeAssetReportDialog();
  }

  async function handleDownloadQr(asset: RegisterAsset) {
    try {
      const response = await fetch(`/api/asset-register/qr?assetId=${encodeURIComponent(asset.id)}&format=png&download=1`, {
        credentials: 'include',
        cache: 'no-store',
      });

      if (!response.ok) {
        try {
          const data = (await response.json()) as { error?: string };
          throw new Error(data.error ?? 'Failed to download the asset QR image.');
        } catch (error) {
          if (error instanceof Error) {
            throw error;
          }

          throw new Error('Failed to download the asset QR image.');
        }
      }

      const blob = await response.blob();
      const fallbackName = `${asset.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'asset'}-qr.png`;
      const fileName = parseDownloadFileName(response, fallbackName);
      downloadBlob(blob, fileName);
      setNotice({ tone: 'success', message: 'Asset QR image downloaded.' });
    } catch (error) {
      setNotice({
        tone: 'error',
        message: error instanceof Error ? error.message : 'Failed to download the asset QR image.',
      });
    }
  }

  function handlePrintQrSheet(asset: RegisterAsset) {
    const opened = window.open(buildAssetQrPrintUrl(asset), '_blank', 'noopener,noreferrer');

    if (!opened) {
      setNotice({ tone: 'error', message: 'Unable to open the QR print page. Please allow pop-ups and try again.' });
      return;
    }

    setNotice({ tone: 'success', message: 'QR print sheet opened in a new tab.' });
  }

  function openRegisterShareModal() {
    if (!assets.length || isLoading) {
      return;
    }

    setNotice(null);
    setIsAssetFilterOpen(false);
    setAssetGroupShareTarget(null);
    setAssetShareDestination('choice');
    setIsRegisterShareModalOpen(true);
  }

  function openAssetGroupShare(group: AssetGroup) {
    const groupAssetIds = new Set(group.members.map((member) => member.assetId));
    if (!assets.some((asset) => groupAssetIds.has(asset.id)) || isLoading) return;

    setNotice(null);
    setIsAssetFilterOpen(false);
    setAssetGroupShareTarget(group);
    setAssetShareDestination('choice');
    setIsRegisterShareModalOpen(true);
  }

  function closeRegisterShareModal() {
    if (isExporting || isSendingQuoteLead) return;
    setIsRegisterShareModalOpen(false);
    setAssetGroupShareTarget(null);
    setAssetShareDestination('choice');
  }

  function buildFullRegisterLeadAssetSnapshot(asset: RegisterAsset, leadType: AssetLeadType): Record<string, unknown> {
    const financeStatus = readFinanceStatusChoice(asset);
    const insuranceStatus = readInsuranceStatusChoice(asset);
    const licenseStatus = readLicenseStatusChoice(asset);

    return {
      id: asset.id,
      title: asset.title,
      kind: asset.kind,
      value: asset.value,
      selectedValueExVat: asset.selectedValueExVat,
      replacementPriceExVat: readAssetReplacementPriceExVat(asset),
      replacementPriceUsedExVat: readAssetReplacementPriceExVat(asset),
      userReplacementPriceExVat: readAssetReplacementPriceExVat(asset),
      selectedMethod: asset.selectedMethod,
      brandName: asset.brandName,
      modelName: asset.modelName,
      typedModelName: asset.typedModelName,
      equipmentFamilyKey: asset.equipmentFamilyKey,
      equipmentFamilyLabel: asset.equipmentFamilyLabel,
      yearModel: asset.yearModel,
      hours: asset.hours,
      specsJson: {
        ...(isPlainRecord(asset.specsJson) ? asset.specsJson : {}),
        financeStatus,
        insuranceStatus,
        licenseStatus,
        replacementPriceExVat: readAssetReplacementPriceExVat(asset),
        replacement_price_ex_vat: readAssetReplacementPriceExVat(asset),
        replacementPriceUsedExVat: readAssetReplacementPriceExVat(asset),
        replacement_price_used_ex_vat: readAssetReplacementPriceExVat(asset),
      },
      depreciationMethodUsed: asset.depreciationMethodUsed,
      lifeWorkedPercent: asset.lifeWorkedPercent,
      lifeRemainingPercent: asset.lifeRemainingPercent,
      estimatedHours: asset.estimatedHours,
      maxLifetimeHours: asset.maxLifetimeHours,
      condition: asset.condition,
      powerKw: asset.powerKw,
      serialNumber: asset.serialNumber,
      isFinanced: financeStatus === 'yes',
      isInsured: insuranceStatus === 'yes',
      isLicensed: licenseStatus === 'yes',
      licenseRegistrationNumber: readLicenseRegistrationNumber(asset),
      aim4priceValueExVat: asset.aim4priceValueExVat,
      insuredValueExVat: asset.insuredValueExVat,
      photoUrl: toAbsoluteUrl(assetPreviewImage(asset)),
      photos: normalizePhotos(asset.photos).map((photo) => toAbsoluteUrl(photo)).filter(Boolean),
      documents: leadType === 'finance' || leadType === 'insurance'
        ? assetDocuments(asset)
        : [],
      lastScannedAtIso: asset.lastScannedAtIso,
      lastKnownLat: asset.lastKnownLat,
      lastKnownLng: asset.lastKnownLng,
      lastKnownLocationText: asset.lastKnownLocationText,
      createdAtIso: asset.createdAtIso,
      updatedAtIso: asset.updatedAtIso,
    };
  }

  function buildFullRegisterLeadSections(leadType: AssetLeadType, profile: AccountProfile | null): Record<string, unknown> {
    const selectedAssetIds = new Set(selectedDealerShareAssetIds);
    const sharedAssets = isAssetGroupShare
      ? assetGroupShareAssets
      : leadType === 'replacement_quote' || leadType === 'license_renewal'
        ? assets.filter((asset) => selectedAssetIds.has(asset.id))
        : assets;
    const sharedAssetGroups = projectAssetGroupsToAssets(assetGroups, sharedAssets);
    const sharedAssetGroupMemberships = buildAssetGroupMembershipMap(sharedAssetGroups);
    const registerAssets = orderAssetsByGroups(sharedAssets, sharedAssetGroups).map((asset) => {
      const snapshot = buildFullRegisterLeadAssetSnapshot(asset, leadType);
      const membership = sharedAssetGroupMemberships.get(asset.id);

      return {
        ...snapshot,
        assetGroup: membership
          ? {
              id: membership.group.id,
              name: membership.group.name,
              role: membership.member.role,
              relationship: membership.member.relationship,
              countsTowardTotal: assetCountsTowardRegisterTotal(asset.id, sharedAssetGroupMemberships),
              valueMode: membership.group.valueMode,
              primaryAssetId: membership.group.members.find((member) => member.role === 'primary')?.assetId ?? null,
              memberCount: membership.group.members.length,
              countedMemberCount: membership.group.members.filter((member) => assetCountsTowardRegisterTotal(member.assetId, sharedAssetGroupMemberships)).length,
              countsInRegisterTotal: assetCountsTowardRegisterTotal(asset.id, sharedAssetGroupMemberships),
            }
          : null,
      };
    });
    const sharedTotalValue = sumAssetValues(sharedAssets, sharedAssetGroups);
    const sharedTotalReplacementValue = sharedAssets.reduce(
      (sum, asset) => sum + (Number(readAssetReplacementPriceExVat(asset)) || 0),
      0,
    );
    const generatedAtIso = new Date().toISOString();
    const leadLabel = leadType === 'insurance'
      ? isAssetGroupShare ? 'Umbrella insurance request' : 'Full insurance quote'
      : leadType === 'replacement_quote'
        ? isAssetGroupShare ? 'Umbrella dealership request' : 'Full dealership request'
        : isAssetGroupShare ? 'Umbrella finance request' : 'Full refinance quote';
    const registerLeadType = leadType === 'insurance'
      ? 'full_insurance_quote'
      : leadType === 'replacement_quote'
        ? 'full_dealership_request'
        : 'full_refinance_quote';
    const combinedRegisterName = buildCombinedAssetRegisterShareName(accountProfile ?? profile, assetRegisters);
    const snapshotTitle = isAssetGroupShare
      ? assetGroupShareTarget?.name || 'Asset umbrella'
      : isCombinedRegisterView ? combinedRegisterName : 'Full Asset Register';
    const snapshotOwnerName = isCombinedRegisterView ? combinedRegisterName : buildOwnerName(profile);
    const snapshotLogoUrl = isCombinedRegisterView
      ? toAbsoluteUrl(accountProfile?.logoUrl || profile?.logoUrl) ?? ''
      : getRegisterReportLogoUrl(activeRegister);

    return {
      assetDetails: true,
      valuationSummary: true,
      mainPhoto: true,
      photos: true,
      documents: leadType === 'finance' || leadType === 'insurance',
      scanHistory: false,
      registerLead: true,
      source: isAssetGroupShare ? 'asset_group' : 'full_asset_register',
      registerLeadType,
      pdfReport: true,
      registerId: activeRegister?.id || activeRegisterId || null,
      groupId: assetGroupShareTarget?.id ?? null,
      liveAccess: !isAssetGroupShare && leadType === 'finance' && selectedQuotePartners.length === 1 && selectedQuotePartner?.accountSubtype === 'accountant',
      allowDirectUpdates: !isAssetGroupShare && leadType === 'finance' && selectedQuotePartners.length === 1 && selectedQuotePartner?.accountSubtype === 'accountant' && quoteAllowDirectUpdates,
      includeFuelLedger: !isAssetGroupShare && leadType === 'finance' && selectedQuotePartners.length === 1 && selectedQuotePartner?.accountSubtype === 'accountant' && quoteIncludeFuelLedger,
      includeCostLedger: !isAssetGroupShare && leadType === 'finance' && selectedQuotePartners.length === 1 && selectedQuotePartner?.accountSubtype === 'accountant' && quoteIncludeCostLedger,
      registerSnapshot: {
        snapshotType: isAssetGroupShare ? 'asset_group' : 'full_asset_register',
        groupId: assetGroupShareTarget?.id ?? null,
        groupName: assetGroupShareTarget?.name ?? null,
        title: snapshotTitle,
        registerName: snapshotTitle,
        leadLabel,
        generatedAtIso,
        ownerName: snapshotOwnerName,
        ownerMeta: buildOwnerMeta(profile),
        logoUrl: snapshotLogoUrl,
        assetCount: sharedAssets.length,
        totalAssets: sharedAssets.length,
        totalValue: sharedTotalValue,
        registerValue: sharedTotalValue,
        totalValueInclVat: sharedTotalValue * 1.15,
        totalReplacementValue: sharedTotalReplacementValue,
        totalReplacementValueInclVat: sharedTotalReplacementValue * 1.15,
        replacementPricedAssetCount: sharedAssets.filter((asset) => (readAssetReplacementPriceExVat(asset) ?? 0) > 0).length,
        assetGroups: sharedAssetGroups,
        aim4priceAssetCount: sharedAssets.filter((asset) => asset.selectedMethod === 'aim4price').length,
        manualAssetCount: sharedAssets.filter((asset) => asset.selectedMethod !== 'aim4price').length,
        financedAssetCount: sharedAssets.filter((asset) => readFinanceStatusChoice(asset) === 'yes').length,
        insuredAssetCount: sharedAssets.filter((asset) => readInsuranceStatusChoice(asset) === 'yes').length,
        licensedAssetCount: sharedAssets.filter((asset) => readLicenseStatusChoice(asset) === 'yes').length,
        assets: registerAssets,
      },
    };
  }

  function openFullRegisterQuotePartnerPicker(leadType: AssetLeadType) {
    const shareAssets = isAssetGroupShare ? assetGroupShareAssets : assets;
    const eligibleShareAssets = leadType === 'license_renewal'
      ? shareAssets.filter((asset) => (
          readLicenseStatusChoice(asset) === 'yes' &&
          Boolean(readSpecsText(asset, ['licenseRenewalDate', 'license_renewal_date', 'licenceRenewalDate', 'licence_renewal_date']))
        ))
      : shareAssets;
    const anchorAsset = eligibleShareAssets[0];

    if (!anchorAsset) {
      if (leadType === 'license_renewal') {
        const assetNeedingRenewalDate = shareAssets.find((asset) => assetKindSupportsLicensing(asset.kind));
        if (assetNeedingRenewalDate) {
          setIsRegisterShareModalOpen(false);
          openQuickAssetStatusEditor(assetNeedingRenewalDate, 'license');
          return;
        }
      }
      setNotice({
        tone: 'error',
        message: leadType === 'license_renewal'
          ? 'Add a licensed asset and its renewal date before sharing with a licence renewal expert.'
          : isAssetGroupShare ? 'This umbrella has no visible assets to share.' : 'Add at least one asset before sharing this Asset Register.',
      });
      return;
    }

    setIsRegisterShareModalOpen(false);
    setAssetShareDestination('inside');
    resetAssetQuoteState('register');
    setQuoteAsset(anchorAsset);
    setSelectedQuoteLeadType(leadType);
    prepareQuoteLocationStep(anchorAsset);
    setSelectedQuotePartnerIds([]);
    setQuotePartnerSearch('');
    setQuoteOwnerMessage('');
    setQuoteLeadStep(null);
    setQuoteConsentAccepted(false);
    setQuotePartners([]);
    setQuoteIncludePhotos(false);
    setQuoteIncludeDocuments(false);
    setQuoteIncludeScanHistory(false);
    setSelectedDealerShareAssetIds(
      leadType === 'replacement_quote' || leadType === 'license_renewal'
        ? eligibleShareAssets.map((asset) => asset.id)
        : [],
    );
    setQuoteTrackMaintenance(leadType === 'replacement_quote');
    setQuoteTrackingPermissions({ ...DEFAULT_DEALER_MAINTENANCE_PERMISSIONS });
  }

  function openSummaryModal() {
    setIsSummaryModalOpen(true);
  }

  function closeSummaryModal() {
    setIsSummaryModalOpen(false);
  }

  function handleDownloadRegisterSummary() {
    if (isLoading || isExporting) {
      return;
    }

    setExportFormat('pdf');
    setIsExporting(true);

    try {
      const url = buildAssetRegisterSummaryExportUrl(
        activeRegister?.id || activeRegisterId,
        'pdf',
        assetRegisters.map((register) => register.id),
      );
      const targetName = `aim4price-register-summary-${Date.now()}`;
      const reportWindow = window.open(url, targetName);

      if (!reportWindow) {
        throw new Error('The register summary PDF window was blocked. Allow pop-ups for Aim4price, then try again.');
      }

      setNotice({ tone: 'success', message: 'Register summary PDF opened.' });
    } catch (error) {
      setNotice({
        tone: 'error',
        message: error instanceof Error ? error.message : 'Failed to open the register summary PDF report.',
      });
    } finally {
      window.setTimeout(() => setIsExporting(false), 700);
    }
  }

  function selectAssetFilter(nextFilter: AssetFilterKey) {
    setAssetFilter(nextFilter);
  }

  function clearAssetFilter() {
    setAssetFilter('all');
  }

  function openExportModal() {
    if (!assets.length) {
      return;
    }

    setExportFormat('pdf');
    setExportEntityName(activeRegister?.businessName || (isCombinedRegisterView ? 'Combined Asset Registers' : 'Asset Register'));
    setExportStep('format');
    setPdfReportKind('full');
    setPdfReportSelection('');
    setSelectedPdfAssetIds([]);
    setPdfAssetSearchTerm('');
    setIsExportModalOpen(true);
  }

  function closeExportModal() {
    if (isExporting) return;

    setIsExportModalOpen(false);
    setExportStep('format');
    setPdfReportSelection('');
    setSelectedPdfAssetIds([]);
    setPdfAssetSearchTerm('');
  }

  function selectExportFormat(nextFormat: ExportFormat) {
    setExportFormat(nextFormat);
    setExportStep('format');
    setPdfReportSelection('');
    setSelectedPdfAssetIds([]);
    setPdfAssetSearchTerm('');
  }

  function openPdfReportChooser() {
    setExportStep('pdf-report');
    setPdfReportSelection('');
    setSelectedPdfAssetIds([]);
    setPdfAssetSearchTerm('');
  }

  function closePdfReportChooser() {
    if (isExporting) return;

    setExportStep('format');
    setPdfReportSelection('');
    setSelectedPdfAssetIds([]);
    setPdfAssetSearchTerm('');
  }

  function openPdfAssetChooser() {
    if (isExporting) return;

    setExportStep('pdf-assets');
    setPdfReportSelection('');
    setSelectedPdfAssetIds([]);
    setPdfAssetSearchTerm('');
  }

  function backToPdfReportChooser() {
    if (isExporting) return;

    setExportStep('pdf-report');
    setPdfReportSelection('');
    setPdfAssetSearchTerm('');
  }

  function selectAllPdfAssets() {
    const targetAssets = normalizedPdfAssetSearch ? visiblePdfAssets : assets;

    setSelectedPdfAssetIds((current) => Array.from(new Set([...current, ...targetAssets.map((asset) => asset.id)])));
  }

  function clearSelectedPdfAssets() {
    setSelectedPdfAssetIds([]);
  }

  function togglePdfAssetSelection(assetId: string) {
    setSelectedPdfAssetIds((current) =>
      current.includes(assetId) ? current.filter((id) => id !== assetId) : [...current, assetId],
    );
  }

  function handlePdfReportChoice(reportKind: PdfReportKind) {
    setPdfReportSelection(reportKind);
    void handleExportPdfReport(reportKind);
  }

  async function handleExportPdf(
    reportKind: PdfReportKind = pdfReportKind,
    overrideAssets?: RegisterAsset[],
    overrideReportDetails?: PdfReportDetails,
    overrideEntityName = '',
  ) {
    const isCustomAssetSelection = Boolean(overrideAssets);
    const reportOption = overrideReportDetails ? { value: reportKind, ...overrideReportDetails } : getPdfReportOption(reportKind);
    const reportAssets = overrideAssets ?? filterAssetsByPdfReportKind(assets, reportKind);
    const reportAssetGroups = projectAssetGroupsToAssets(assetGroups, reportAssets);
    const reportAssetGroupMemberships = buildAssetGroupMembershipMap(reportAssetGroups);
    const orderedReportAssets = orderAssetsByGroups(reportAssets, reportAssetGroups);
    const reportValue = sumAssetValues(reportAssets, reportAssetGroups);
    const reportValueInclVat = Math.round(reportValue * 1.15);
    const reportReplacementValue = sumAssetReplacementValues(reportAssets);
    const reportReplacementValueInclVat = Math.round(reportReplacementValue * 1.15);
    const reportReplacementPricedCount = countAssetsWithReplacementPrice(reportAssets);
    const reportInsuredValue = sumAssetInsuredValues(reportAssets);
    const reportInsuredValueInclVat = Math.round(reportInsuredValue * 1.15);
    const reportAim4priceStats = calculateAssetStats(reportAssets, isAim4priceValuedAsset, reportAssetGroups);
    const reportInsuredStats = calculateAssetStats(reportAssets, (asset) => readInsuranceStatusChoice(asset) === 'yes', reportAssetGroups);
    const reportFinancedStats = calculateAssetStats(reportAssets, (asset) => readFinanceStatusChoice(asset) === 'yes', reportAssetGroups);
    const reportLicensedStats = calculateAssetStats(reportAssets, (asset) => readLicenseStatusChoice(asset) === 'yes', reportAssetGroups);
    const profile = reportProfile ?? (await ensureAccountProfile());
    const profileLocation = [profile?.townCity, profile?.province].filter(Boolean).join(' ');
    const profileAddress = [profile?.addressLine1, profile?.addressLine2, profileLocation].filter(Boolean).join(' ');
    const ownerName = buildOwnerName(profile);
    const ownerEmail = profile?.marketplaceEmail?.trim() || '—';
    const ownerPhone = profile?.phone?.trim() || '—';
    const accountLogoUrl = toAbsoluteUrl(accountProfile?.logoUrl || profile?.logoUrl || '') ?? '';
    const savedReportLogoUrl = getRegisterReportLogoUrl(activeRegister) || accountLogoUrl;
    const [reportLogoUrl, reportPhotoUrlByAssetId] = await Promise.all([
      preparePrintableImageUrl(savedReportLogoUrl, {
        maxDimension: PRINT_LOGO_MAX_DIMENSION,
        mimeType: 'image/png',
      }),
      buildPrintableAssetThumbnailMap(orderedReportAssets),
    ]);

    const didOpen = openAssetRegisterSummaryPrint({
      logoUrl: reportLogoUrl ?? savedReportLogoUrl,
      generatedAt: formatDate(new Date().toISOString()),
      reportTitle: `${overrideEntityName.trim() || exportEntityName.trim() || activeRegister?.businessName || 'Asset Register'} - ${reportOption.label} Report`,
      reportSubtitle: 'Aim4price asset register',
      valueLabel: isCustomAssetSelection ? 'Selected Register Value' : reportKind === 'full' ? 'Register Value' : 'Filtered Register Value',
      assetSectionTitle: reportOption.sectionTitle,
      emptyStateMessage: reportOption.emptyLabel,
      ownerName,
      ownerMeta: buildOwnerMeta(profile),
      intro: reportOption.intro,
      registerValue: money(reportValue),
      registerValueNote: `VAT excluded · ${money(reportValueInclVat)} incl. VAT · Replacement ${money(reportReplacementValue)} excl. VAT`,
      ownerRows: [
        { label: 'Name', value: ownerName },
        { label: 'Business email', value: ownerEmail },
        { label: 'Phone', value: ownerPhone },
        { label: 'Address', value: profileAddress || '—' },
      ],
      stats: [
        {
          label: 'Assets',
          value: String(reportAssets.length),
          note: isCustomAssetSelection ? 'Selected register items.' : reportKind === 'full' ? 'Saved register items.' : reportOption.description,
        },
        { label: 'Value ex VAT', value: money(reportValue), note: 'Filtered report total excluding VAT.' },
        { label: 'Value incl VAT', value: money(reportValueInclVat), note: 'Filtered report total including 15% VAT.' },
        { label: 'Replacement value', value: money(reportReplacementValue), note: `${reportReplacementPricedCount} assets · ${money(reportReplacementValueInclVat)} incl. VAT.` },
        { label: 'Aim4price values', value: String(reportAim4priceStats.count), note: `${money(reportAim4priceStats.value)} total value.` },
        { label: 'Insured assets', value: String(reportInsuredStats.count), note: `${money(reportInsuredValue)} insured value excl. VAT · ${money(reportInsuredValueInclVat)} incl. VAT.` },
        { label: 'Financed assets', value: String(reportFinancedStats.count), note: `${money(reportFinancedStats.value)} marked financed.` },
        { label: 'Licensed assets', value: String(reportLicensedStats.count), note: `${money(reportLicensedStats.value)} marked licensed.` },
      ],
      notes: reportAssets.flatMap((asset) => buildAssetPartnerNoteRows(asset, true)),
      rows: orderedReportAssets.map((asset) => {
        const initialModelValue = asset.modelName || asset.typedModelName || '';
        const reportBrandName = deriveAssetReportBrandName(asset, initialModelValue);
        const reportModelName = deriveAssetReportModelName(asset, reportBrandName);
        const documentsCount = assetDocuments(asset).length;
        const isPropertyAsset = asset.kind === 'property';
        const membership = reportAssetGroupMemberships.get(asset.id);
        const groupDetail = membership
          ? `Umbrella: ${membership.group.name} · ${assetGroupValueModeLabel(membership.group)} · Counts in register total: ${assetCountsTowardRegisterTotal(asset.id, reportAssetGroupMemberships) ? 'Yes' : 'No'}`
          : '';

        return {
          asset: asset.title,
          type: isCombinedRegisterView
            ? `${asset.registerName || 'Asset Register'} · ${assetKindLabel(asset)}`
            : assetKindLabel(asset),
          method: methodLabel(asset.selectedMethod),
          detail: [groupDetail, buildExportDetail(asset)].filter(Boolean).join(' · '),
          value: money(asset.value),
          replacementPrice: readAssetReplacementPriceExVat(asset) !== null ? money(readAssetReplacementPriceExVat(asset) ?? 0) : 'Not set',
          status: assetStatusDateLabel(asset),
          brand: isPropertyAsset ? '—' : reportBrandName,
          model: isPropertyAsset ? `Size: ${propertySizeDisplay(asset)}` : reportModelName,
          year: asset.yearModel ? String(asset.yearModel) : '—',
          usage: isPropertyAsset ? '—' : buildAssetUsageValue(asset),
          condition: conditionLabel(asset.condition) || '—',
          serial: isPropertyAsset ? '—' : asset.serialNumber || '—',
          insured: statusChoiceReportLabel(readInsuranceStatusChoice(asset)),
          insuredValue: readAssetInsuredValueExVat(asset) !== null ? money(readAssetInsuredValueExVat(asset) ?? 0) : '—',
          financed: statusChoiceReportLabel(readFinanceStatusChoice(asset)),
          licensed: isPropertyAsset ? 'N/A' : statusChoiceReportLabel(readLicenseStatusChoice(asset)),
          licenseRegistrationNumber: isPropertyAsset ? undefined : readLicenseRegistrationNumber(asset) || undefined,
          documents: documentsCount ? `${documentsCount} saved` : 'None',
          updated: assetStatusDateLabel(asset),
          photoUrl: reportPhotoUrlByAssetId.get(asset.id) ?? toAbsoluteUrl(assetPreviewImage(asset)) ?? null,
        };
      }),
      footerNote:
        'Values are indicative estimates based on saved Aim4price asset-register information and available pricing inputs. Values exclude VAT unless stated otherwise. This is not a certified valuation, inspection report or guarantee of selling price. Final values remain subject to physical inspection, documents, attachments, condition, location and live market demand.',
    });

    if (!didOpen) {
      throw new Error(`Unable to open the ${reportOption.label.toLowerCase()} PDF. Please allow pop-ups and try again.`);
    }
  }

  async function handleExportPdfReport(reportKind: PdfReportKind) {
    if (!assets.length || isExporting) {
      return;
    }

    const reportOption = getPdfReportOption(reportKind);

    setExportFormat('pdf');
    setPdfReportKind(reportKind);
    setIsExporting(true);

    try {
      await handleExportPdf(reportKind);
      setIsExportModalOpen(false);
      setSelectedPdfAssetIds([]);
      setPdfAssetSearchTerm('');
      setNotice({
        tone: 'success',
        message: `${reportOption.label} PDF opened.`,
      });
    } catch (error) {
      setPdfReportSelection('');
      setNotice({
        tone: 'error',
        message: error instanceof Error ? error.message : 'Failed to export the asset register PDF.',
      });
    } finally {
      setIsExporting(false);
    }
  }

  async function handleExportSelectedPdfReport() {
    if (!assets.length || !selectedPdfAssetCount || isExporting) {
      return;
    }

    setExportFormat('pdf');
    setPdfReportKind('full');
    setIsExporting(true);

    try {
      await handleExportPdf('full', selectedPdfAssets, SELECTED_ASSETS_PDF_REPORT);
      setIsExportModalOpen(false);
      setSelectedPdfAssetIds([]);
      setPdfAssetSearchTerm('');
      setNotice({
        tone: 'success',
        message: `${selectedPdfAssetCount} selected asset${selectedPdfAssetCount === 1 ? '' : 's'} PDF opened.`,
      });
    } catch (error) {
      setNotice({
        tone: 'error',
        message: error instanceof Error ? error.message : 'Failed to export the selected assets PDF.',
      });
    } finally {
      setIsExporting(false);
    }
  }

  async function handleExportXlsx(options: { entityName?: string; groupId?: string } = {}) {
    const response = await fetch(buildAssetRegisterExportUrl(
      activeRegister?.id || activeRegisterId,
      options.entityName ?? exportEntityName,
      accountantShareId,
      assetRegisters.map((register) => register.id),
      options.groupId,
    ), {
      credentials: 'include',
      cache: 'no-store',
    });

    if (!response.ok) {
      try {
        const data = (await response.json()) as { error?: string };
        throw new Error(data.error ?? 'Failed to export the asset register XLSX file.');
      } catch (error) {
        if (error instanceof Error) {
          throw error;
        }

        throw new Error('Failed to export the asset register XLSX file.');
      }
    }

    const blob = await response.blob();
    const fallbackName = `aim4price-asset-register-${new Date().toISOString().slice(0, 10)}.xlsx`;
    const fileName = parseDownloadFileName(response, fallbackName);
    downloadBlob(blob, fileName);
  }

  function assetsForGroup(group: AssetGroup): RegisterAsset[] {
    const memberAssetIds = new Set(group.members.map((member) => member.assetId));
    return orderAssetsByGroups(
      assets.filter((asset) => memberAssetIds.has(asset.id)),
      [group],
    );
  }

  async function handleDownloadAssetGroupPdf(group: AssetGroup) {
    if (isExporting) return;

    const groupAssets = assetsForGroup(group);
    if (!groupAssets.length) {
      setNotice({ tone: 'error', message: `${group.name} does not contain any available assets to export.` });
      return;
    }

    setExportFormat('pdf');
    setIsExporting(true);

    try {
      await handleExportPdf(
        'full',
        groupAssets,
        {
          label: 'Umbrella',
          description: `Only the grouped assets in ${group.name}.`,
          intro: `This report contains only ${group.name} and its grouped assets. Unrelated Asset Register items are excluded.`,
          sectionTitle: `${group.name} assets`,
          emptyLabel: 'No grouped assets are available in this umbrella.',
        },
        group.name,
      );
      setNotice({ tone: 'success', message: `${group.name} PDF opened.` });
    } catch (error) {
      setNotice({
        tone: 'error',
        message: error instanceof Error ? error.message : `Failed to export ${group.name} as a PDF.`,
      });
    } finally {
      setIsExporting(false);
    }
  }

  async function handleDownloadAssetGroupXlsx(group: AssetGroup) {
    if (isExporting) return;

    const groupAssets = assetsForGroup(group);
    if (!groupAssets.length) {
      setNotice({ tone: 'error', message: `${group.name} does not contain any available assets to export.` });
      return;
    }

    setExportFormat('xlsx');
    setIsExporting(true);

    try {
      await handleExportXlsx({ entityName: group.name, groupId: group.id });
      setNotice({ tone: 'success', message: `${group.name} Excel downloaded.` });
    } catch (error) {
      setNotice({
        tone: 'error',
        message: error instanceof Error ? error.message : `Failed to export ${group.name} as an Excel file.`,
      });
    } finally {
      setIsExporting(false);
    }
  }

  async function handleDownloadAssetGroupReport(
    group: AssetGroup,
    reportKind: AssetGroupReportKind,
    format: AssetGroupReportFormat,
    filters: AssetGroupReportFilters,
  ) {
    if (isExporting) return;

    if (reportKind === 'valuation') {
      await handleDownloadAssetGroupPdf(group);
      return;
    }

    const reportLabel = reportKind === 'ownership'
      ? 'Cost of Ownership report'
      : reportKind === 'depreciation'
        ? 'Depreciation log'
        : reportKind === 'fuel'
          ? 'Fuel report'
          : 'Maintenance report';
    const reportUrl = reportKind === 'ownership'
      ? buildAssetGroupOwnershipReportUrl(group, filters, format)
      : buildAssetGroupTimelineReportUrl(group, reportKind, filters, format);

    setIsExporting(true);

    try {
      if (format === 'pdf') {
        const opened = window.open(reportUrl, '_blank', 'noopener,noreferrer');
        if (!opened) {
          throw new Error(`Unable to open the ${reportLabel.toLowerCase()}. Please allow pop-ups and try again.`);
        }
        setNotice({ tone: 'success', message: `${group.name} ${reportLabel.toLowerCase()} opened in a new tab.` });
        return;
      }

      const response = await fetch(reportUrl, { credentials: 'include', cache: 'no-store' });
      if (!response.ok) {
        const data = await response.json().catch(() => ({})) as { error?: string };
        throw new Error(data.error ?? `Failed to download the ${reportLabel.toLowerCase()} Excel file.`);
      }

      const blob = await response.blob();
      const groupSlug = group.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'umbrella';
      downloadBlob(blob, parseDownloadFileName(response, `${groupSlug}-${reportKind}-report.xlsx`));
      setNotice({ tone: 'success', message: `${group.name} ${reportLabel.toLowerCase()} Excel downloaded.` });
    } catch (error) {
      setNotice({
        tone: 'error',
        message: error instanceof Error ? error.message : `Failed to prepare the ${reportLabel.toLowerCase()}.`,
      });
    } finally {
      setIsExporting(false);
    }
  }

  async function handleQuickExportXlsx() {
    if (!assets.length || isExporting) {
      return;
    }

    setExportFormat('xlsx');
    setIsExporting(true);

    try {
      await handleExportXlsx();
      setNotice({ tone: 'success', message: 'Asset register Excel downloaded.' });
    } catch (error) {
      setNotice({
        tone: 'error',
        message: error instanceof Error ? error.message : 'Failed to export the asset register Excel file.',
      });
    } finally {
      setIsExporting(false);
    }
  }

  async function handleConfirmExport() {
    if (!assets.length) {
      return;
    }

    if (exportFormat === 'pdf') {
      openPdfReportChooser();
      return;
    }

    setIsExporting(true);

    try {
      await handleExportXlsx();
      setIsExportModalOpen(false);
      setNotice({ tone: 'success', message: 'Asset register XLSX downloaded.' });
    } catch (error) {
      setNotice({
        tone: 'error',
        message: error instanceof Error ? error.message : 'Failed to export the asset register.',
      });
    } finally {
      setIsExporting(false);
    }
  }

  async function requestProjection(asset: RegisterAsset, formState: ProjectionFormState) {
    const targetYear = Math.round(Number(formState.targetYear));
    const inflationRatePct = Number(formState.inflationRatePct);
    const usesPercentProjection = assetUsesPercentUsage(asset);
    const currentLifeWorkedPercent = getAssetLifeWorkedPercent(asset);
    const normalizedTargetLifeWorkedPercentInput = formState.targetLifeWorkedPercent.replace(',', '.').trim();
    const targetLifeWorkedPercent = Number(normalizedTargetLifeWorkedPercentInput);
    const extraUsage = !usesPercentProjection && formState.extraHours.trim() ? Number(formState.extraHours) : 0;
    const usageMetric = getAssetUsageMetric(asset);
    const extraUsageErrorLabel = usageMetric === 'km' ? 'Extra kilometres' : 'Extra hours';

    if (!Number.isFinite(targetYear)) {
      setShouldScrollToProjectionResult(false);
      setProjectionError('Select a valid target year.');
      return;
    }

    if (!Number.isFinite(inflationRatePct)) {
      setShouldScrollToProjectionResult(false);
      setProjectionError('Enter a valid inflation rate.');
      return;
    }

    if (usesPercentProjection) {
      if (!normalizedTargetLifeWorkedPercentInput || !Number.isFinite(targetLifeWorkedPercent)) {
        setShouldScrollToProjectionResult(false);
        setProjectionError('New Expected % must be a valid number.');
        return;
      }

      if (targetLifeWorkedPercent < 0 || targetLifeWorkedPercent > 100) {
        setShouldScrollToProjectionResult(false);
        setProjectionError('New Expected % must be between 0% and 100%.');
        return;
      }

      if (currentLifeWorkedPercent !== null && targetLifeWorkedPercent < currentLifeWorkedPercent) {
        setShouldScrollToProjectionResult(false);
        setProjectionError('New Expected % cannot be lower than the current usage percentage.');
        return;
      }
    } else if (!Number.isFinite(extraUsage) || extraUsage < 0) {
      setShouldScrollToProjectionResult(false);
      setProjectionError(`${extraUsageErrorLabel} must be zero or greater.`);
      return;
    }

    const requestId = projectionRequestRef.current + 1;
    projectionRequestRef.current = requestId;

    setIsLoadingProjection(true);
    setProjectionError(null);

    try {
      const response = await fetch('/api/asset-register/projection', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          assetId: asset.id,
          targetYear,
          inflationRatePct,
          targetCondition: formState.targetCondition,
          ...(usesPercentProjection
            ? { targetLifeWorkedPercent: Math.round(targetLifeWorkedPercent * 10) / 10 }
            : { extraUsage }),
        }),
      });

      const data = (await response.json()) as ProjectionApiResponse;

      if (projectionRequestRef.current !== requestId) {
        return;
      }

      if (!response.ok || !data.ok || !data.projection) {
        throw new Error(data.error ?? 'Failed to calculate future price.');
      }

      setProjectionResult(data.projection);
    } catch (error) {
      if (projectionRequestRef.current !== requestId) {
        return;
      }

      setProjectionResult(null);
      setShouldScrollToProjectionResult(false);
      setProjectionError(error instanceof Error ? error.message : 'Failed to calculate future price.');
    } finally {
      if (projectionRequestRef.current === requestId) {
        setIsLoadingProjection(false);
      }
    }
  }

  function closeProjectionModal() {
    projectionRequestRef.current += 1;
    setProjectionAsset(null);
    setProjectionResult(null);
    setProjectionError(null);
    setProjectionForm(createDefaultProjectionForm());
    setShouldScrollToProjectionResult(false);
    setIsLoadingProjection(false);
  }

  function openProjectionModal(asset: RegisterAsset) {
    const defaults = createDefaultProjectionForm(asset);
    closeActionDialog();
    setProjectionAsset(asset);
    setProjectionForm(defaults);
    setProjectionResult(null);
    setProjectionError(null);
    setShouldScrollToProjectionResult(false);
    void requestProjection(asset, defaults);
  }

  function updateProjectionForm(nextState: Partial<ProjectionFormState>) {
    setProjectionForm((current) => ({
      ...current,
      ...nextState,
    }));
    setProjectionResult(null);
    setProjectionError(null);
    setShouldScrollToProjectionResult(false);
  }

  function handleProjectionPreset(nextState: Partial<ProjectionFormState>) {
    if (!projectionAsset) {
      updateProjectionForm(nextState);
      return;
    }

    const nextForm = {
      ...projectionForm,
      ...nextState,
    };

    setProjectionForm(nextForm);
    setProjectionResult(null);
    setProjectionError(null);
    setShouldScrollToProjectionResult(false);
    void requestProjection(projectionAsset, nextForm);
  }

  function handleProjectionSubmit() {
    if (!projectionAsset) {
      return;
    }

    setShouldScrollToProjectionResult(true);
    void requestProjection(projectionAsset, projectionForm);
  }

  function handlePageSizeChange(nextPageSize: PageSize) {
    if (nextPageSize === pageSize) return;

    setPageSize(nextPageSize);
    setCurrentPage(1);
    setExpandedAssetId(null);
  }

  const hasActiveAssetFilter = assetFilter !== 'all';
  const hasGroupedPaginationEntries = registerPaginationEntries.some((entry) => entry.kind === 'group');
  const registerRangeDescription = filteredAssets.length
    ? hasGroupedPaginationEntries
      ? `${umbrellaPaginationEntryCount} ${umbrellaPaginationEntryCount === 1 ? 'umbrella' : 'umbrellas'} always shown${standalonePaginationEntryCount ? ` · Standalone assets ${pageStart + 1}-${pageEnd} of ${standalonePaginationEntryCount}` : ' · No standalone assets'} · ${filteredAssets.length} ${filteredAssets.length === 1 ? 'asset' : 'assets'}${hasActiveAssetFilter ? ` · ${activeAssetFilterLabel}` : ''}`
      : `Showing ${pageStart + 1}-${pageEnd} of ${filteredAssets.length} ${filteredAssets.length === 1 ? 'asset' : 'assets'}${hasActiveAssetFilter ? ` · ${activeAssetFilterLabel}` : ''}`
    : searchTerm.trim() || hasActiveAssetFilter
      ? 'No assets match the current search or filter.'
      : 'No saved assets yet.';
  const selectedManualAssetType = getManualAssetOption(assetFormKind);
  const isLandPropertyDraft = assetFormKind === 'property' && assetDraft.propertyAssetSubtype === 'land';
  const replacementPriceRequiredForDraft = assetFormKind !== 'stock' && !isLandPropertyDraft;
  const assetLicenseApplicable = assetKindSupportsLicensing(assetFormKind);
  const currentValueFieldLabel = assetFormKind === 'stock'
    ? 'Current stock value excl. VAT *'
    : isLandPropertyDraft
      ? 'Current / market value excl. VAT *'
      : 'Current Value excl. VAT *';
  const replacementValueFieldLabel = assetFormKind === 'property'
    ? 'Rebuilding / replacement value excl. VAT *'
    : 'Replacement Price excl. VAT *';
  const manualDraftDocumentCount = assetDraft.documents.length + pendingDocumentFiles.length;
  const manualDraftRawPhotoCount = assetDraft.photos.length + pendingPhotoFiles.length;
  const manualDraftPhotoCount = Math.min(MAX_PHOTOS, manualDraftRawPhotoCount);
  const draftPhotoItems = useMemo(
    () => buildDraftPhotoItems(assetDraft.photos, pendingPhotoFiles, mainPhotoSelection),
    [assetDraft.photos, mainPhotoSelection, pendingPhotoFiles],
  );
  const manualStepPrimaryLabel =
    manualAssetStep === 2
      ? 'Next'
      : manualAssetStep === 3
        ? 'Next'
        : editingAsset
          ? 'Done'
          : 'Add asset';
  const assetAutosaveLabel =
    assetAutosaveState === 'pending'
      ? 'Saving...'
      : assetAutosaveState === 'saving'
        ? 'Saving...'
        : assetAutosaveState === 'error'
          ? 'Check fields'
          : 'Saved automatically';
  const isAssetAutosaveBusy = Boolean(editingAsset) && (assetAutosaveState === 'pending' || assetAutosaveState === 'saving');
  const isAssetStatusFocusedView = manualAssetStep === 3 && assetStatusEditView !== 'hub';
  const settingsUsageMode = editingAsset ? getAssetSettingsUsageMode(editingAsset) : 'none';
  const settingsUsageCurrentValue = editingAsset ? getAssetSettingsUsageCurrentValue(editingAsset, settingsUsageMode) : null;
  const assetSettingsMapsUrl = editingAsset ? buildAssetSettingsGoogleMapsUrl(editingAsset) : null;
  const assetSettingsLocationText = editingAsset ? formatAssetSettingsLocationText(editingAsset) : '';
  const assetSettingsManualGpsButtonLabel = isAssetSettingsManualLocationSaving
    ? 'Saving GPS...'
    : 'Save manual GPS position';
  const assetSettingsMapGpsButtonLabel = isAssetSettingsMapLocationSaving
    ? 'Saving GPS...'
    : 'Save map position';
  const assetSettingsDeviceGpsButtonLabel =
    assetSettingsLocationState === 'capturing'
      ? 'Finding location...'
      : assetSettingsLocationState === 'savingDevice'
        ? 'Saving location...'
        : 'Use this device';
  const marketplacePhotoUrls = marketplaceAsset ? normalizePhotos(marketplaceAsset.photos) : [];
  const marketplaceListingTitle = marketplaceAsset ? buildMarketplaceListingTitle(marketplaceAsset, true) : '';
  const marketplaceModalTitle = marketplaceAsset
    ? isLiveOnMarketplace(marketplaceAsset)
      ? 'Update marketplace listing'
      : 'Send to marketplace'
    : '';
  const normalizedRevalueReplacementPriceInput = (() => {
    const parsed = parseMoneyInput(revalueReplacementPriceInput);
    return parsed !== null && parsed > 0 ? Math.round(parsed) : null;
  })();
  const pricingPreviewSavedReplacementPriceExVat = pricingPreview ? readAssetReplacementPriceExVat(pricingPreview.asset) : null;
  const pricingPreviewReplacementPriceExVat = pricingPreview
    ? pricingPreview.replacementPriceExVat ?? (pricingPreview.result?.replacementPriceUsedExVat ?? (pricingPreview.result?.item
      ? readAssetReplacementPriceExVat(pricingPreview.result.item)
      : readAssetReplacementPriceExVat(pricingPreview.asset)))
    : null;
  const pricingPreviewUsesCustomReplacement =
    pricingPreview?.method === 'aim4price' &&
    pricingPreview.replacementMode === 'custom' &&
    pricingPreview.replacementPriceExVat !== null;
  const pricingPreviewShouldSaveReplacement = pricingPreviewUsesCustomReplacement && saveReplacementPriceWithRevalue;
  const pricingPreviewErrorTitle = pricingPreview?.errorContext === 'save' ? 'Could not save new value' : 'Could not calculate preview';
  const pricingPreviewHasUnpreviewedReplacementInput =
    Boolean(pricingPreviewUsesCustomReplacement && pricingPreview?.replacementPriceExVat !== normalizedRevalueReplacementPriceInput);
  const pricingPreviewOldValueExVat = pricingPreview?.result?.oldValueExVat ?? pricingPreview?.asset.value ?? null;
  const pricingPreviewNewValueExVat = pricingPreview?.result?.item
    ? pricingPreview.result.newValueExVat ?? pricingPreview.result.item.value
    : null;
  const pricingPreviewDifferenceExVat =
    pricingPreviewOldValueExVat !== null && pricingPreviewNewValueExVat !== null
      ? pricingPreviewNewValueExVat - pricingPreviewOldValueExVat
      : null;
  const pricingPreviewReplacementActionLabel = pricingPreview?.method === 'aim4price'
    ? pricingPreview.replacementMode === 'custom'
      ? pricingPreviewShouldSaveReplacement
        ? 'New price will also be saved'
        : 'New price used for preview only'
      : 'Using saved price'
    : null;
  const pricingPreviewUsesPercentUsage = pricingPreview ? assetUsesPercentUsage(pricingPreview.asset) : false;
  const pricingPreviewUsageMetric = pricingPreview ? getAssetUsageMetric(pricingPreview.asset) : 'hours';
  const pricingPreviewLifetimeShortUnit = getLifetimeShortUnit(pricingPreviewUsageMetric);
  const pricingPreviewLifetimeValue = pricingPreview && !pricingPreviewUsesPercentUsage
    ? pricingPreview.advancedAssumptions?.maxLifetimeUsage ??
      (pricingPreview.result?.item ? readAssetMaxLifetimeUsage(pricingPreview.result.item) : readAssetMaxLifetimeUsage(pricingPreview.asset))
    : null;
  const pricingPreviewSavedStepTitle = pricingPreviewUsesPercentUsage ? 'Use saved replacement price?' : 'Use saved replacement price and lifetime?';
  const pricingPreviewCustomStepTitle = pricingPreviewUsesPercentUsage ? 'Enter a different price' : 'Enter a different price and lifetime';
  const pricingPreviewCustomStepCopy = pricingPreviewUsesPercentUsage
    ? 'Type the replacement price excluding VAT before calculating the new value.'
    : 'Type the replacement price excluding VAT and adjust expected lifetime before calculating the new value.';
  const projectionUsesPercentUsage = Boolean(
    projectionResult?.usageMetric === 'percent' ||
    (projectionAsset && assetUsesPercentUsage(projectionAsset)),
  );
  const projectionUsageMetric: ProjectionUsageMetric = projectionUsesPercentUsage
    ? 'percent'
    : projectionResult?.usageMetric ?? (projectionAsset ? getAssetUsageMetric(projectionAsset) : 'hours');
  const projectionUsageShortUnit = projectionUsageMetric === 'percent' ? '%' : usageMetricLabel(projectionUsageMetric);
  const projectionUsageFieldLabel = projectionUsageMetric === 'percent'
    ? 'New Expected %'
    : projectionUsageMetric === 'km'
      ? 'Add extra kilometres'
      : 'Add extra hours';
  const projectionUsagePlaceholder = projectionUsageMetric === 'percent'
    ? 'Example: 60'
    : projectionUsageMetric === 'km'
      ? 'Type extra kilometres'
      : 'Type extra hours';
  const projectionUsageHelpText = projectionUsageMetric === 'percent'
    ? 'Enter the expected usage percentage for the target year.'
    : projectionUsageMetric === 'km'
      ? 'Only change what you know. Leave extra kilometres empty if usage stays the same.'
      : 'Only change what you know. Leave extra hours empty if usage stays the same.';
  const projectionUsageMetaLabel = projectionUsageMetric === 'percent' ? 'Usage %' : projectionUsageMetric === 'km' ? 'Kilometres' : 'Hours';
  const projectionCurrentWorkedPercent = projectionResult?.current.lifeWorkedPercent ?? (projectionAsset ? getAssetLifeWorkedPercent(projectionAsset) : null);
  const projectionTargetWorkedPercent = projectionResult?.projected.lifeWorkedPercent ?? projectionResult?.targetLifeWorkedPercent ?? null;
  const projectionCurrentCondition = projectionResult?.currentCondition ?? (projectionAsset?.condition || 'good');
  const projectionTargetCondition = projectionResult?.targetCondition ?? projectionForm.targetCondition;
  const pricingPreviewWizardStep = pricingPreview?.method === 'aim4price'
    ? isLoadingPricingPreview || pricingPreview.result || pricingPreview.error
      ? 3
      : pricingPreview.replacementMode === 'custom'
        ? 2
        : 1
    : null;
  const canCalculateCustomReplacementPreview = Boolean(
    normalizedRevalueReplacementPriceInput !== null &&
    !isLoadingPricingPreview &&
    !isSavingPricingPreview,
  );
  const canSavePricingPreview = Boolean(
    pricingPreview?.result?.item &&
    !pricingPreview.error &&
    !isLoadingPricingPreview &&
    !isSavingPricingPreview &&
    !pricingPreviewHasUnpreviewedReplacementInput,
  );

  function renderRevalueLifetimeField(asset: RegisterAsset) {
    if (!shouldShowRevalueLifetimeInput(asset)) {
      return null;
    }

    const usageMetric = getAssetUsageMetric(asset);
    const lifetimeShortUnit = getLifetimeShortUnit(usageMetric);

    return (
      <div className={styles.revalueCustomReplacementCard}>
        <label className={styles.revalueReplacementField}>
          <span>Expected lifetime ({lifetimeShortUnit})</span>
          <input
            type="text"
            inputMode="numeric"
            value={revalueLifetimeUsageInput}
            onChange={handleRevalueLifetimeUsageChange}
            placeholder={usageMetric === 'km' ? 'Example: 350 000' : 'Example: 12 000'}
            disabled={isLoadingPricingPreview || isSavingPricingPreview}
          />
        </label>
      </div>
    );
  }

  return (
    <main className={styles.page}>
      <AppHeader active="asset-register" />

      <section className={styles.shell}>
        {notice ? (
          <div className={`${styles.notice} ${
            notice.tone === 'success'
              ? styles.noticeSuccess
              : notice.tone === 'warning'
                ? styles.noticeWarning
                : styles.noticeError
          }`}>
            {notice.message}
          </div>
        ) : null}

        <section className={styles.registerPanel}>
          <div className={styles.registerHeader}>
            <div className={`${styles.registerTitleBlock} ${styles.businessRegisterTitleBlock}`}>
              <div className={styles.businessRegisterTitleCard}>
                <h1>{isLoading ? 'Loading...' : activeRegister?.businessName || buildOwnerName(reportProfile)}</h1>
                {canOpenRegisterSwitcher ? (
                  <button
                    type="button"
                    className={`${styles.registerChangeButton} ${styles.controlTooltip}`}
                    onClick={openChangeRegisterModal}
                    disabled={isLoading || Boolean(changingRegisterId)}
                    aria-label="Switch Asset Register"
                    data-tooltip="Switch assets"
                  >
                    <ChangeRegisterIcon className={styles.registerChangeIcon} />
                    {totalRegisterUnnotedAlertCount > 0 ? (
                      <span
                        className={styles.registerChangeAlertBadge}
                        aria-label={`${formatAlertBadgeCount(totalRegisterUnnotedAlertCount)} unnoted asset register alert${totalRegisterUnnotedAlertCount === 1 ? '' : 's'}`}
                      >
                        {formatAlertBadgeCount(totalRegisterUnnotedAlertCount)}
                      </span>
                    ) : null}
                  </button>
                ) : null}
              </div>
            </div>

            <div className={`${styles.headerActions} ${canUseOwnerOnlyAssetActions ? styles.ownerRegisterHeaderActions : styles.sharedRegisterHeaderActions}`}>
              {canShareActiveRegister ? (
                <button
                  type="button"
                  className={`${styles.secondaryButton} ${styles.headerShareButton}`}
                  onClick={openRegisterShareModal}
                  disabled={!assets.length || isLoading || isExporting}
                >
                  <ShareIcon className={styles.buttonIcon} />
                  <span>Share</span>
                </button>
              ) : null}

              <button
                type="button"
                className={`${styles.secondaryButton} ${styles.summaryTriggerButton} ${styles.headerOptionsButton}`}
                onClick={openSummaryModal}
                disabled={isLoading}
              >
                <OptionsIcon className={styles.buttonIcon} />
                <span>Summary</span>
              </button>

              <div className={styles.assetFilterWrap} ref={assetFilterWrapRef}>
                <button
                  type="button"
                  className={`${styles.secondaryButton} ${styles.filterTriggerButton} ${hasActiveAssetFilter ? styles.filterTriggerButtonActive : ''} ${isAssetFilterOpen ? styles.filterTriggerButtonOpen : ''}`}
                  onClick={() => setIsAssetFilterOpen(true)}
                  disabled={isLoading}
                  aria-haspopup="dialog"
                  aria-expanded={isAssetFilterOpen}
                  aria-controls="asset-register-filter-modal"
                >
                  <FilterIcon className={styles.buttonIcon} />
                  <span>Filters</span>
                  {hasActiveAssetFilter ? <span className={styles.filterActiveBadge}>1</span> : null}
                </button>
              </div>

              <button
                type="button"
                className={`${styles.secondaryButton} ${styles.headerDownloadButton}`}
                onClick={openExportModal}
                disabled={!assets.length || isLoading || isExporting}
              >
                <DownloadIcon className={styles.buttonIcon} />
                <span>Download</span>
              </button>
            </div>
          </div>

          {isAssetFilterOpen ? (
            <div className={`${styles.modalOverlay} ${styles.assetFilterModalOverlay}`}>
              <div className={styles.modalBackdrop} onClick={() => setIsAssetFilterOpen(false)} />

              <div
                id="asset-register-filter-modal"
                className={`${styles.modalCard} ${styles.assetFilterModal}`}
                role="dialog"
                aria-modal="true"
                aria-labelledby="asset-register-filter-title"
              >
                <div className={`${styles.modalHeader} ${styles.assetFilterModalHeader}`}>
                  <div className={styles.modalHeaderText}>
                    <h3 id="asset-register-filter-title">Filter assets</h3>
                  </div>

                  <button
                    type="button"
                    className={styles.modalCloseButton}
                    onClick={() => setIsAssetFilterOpen(false)}
                    aria-label="Close asset filters"
                  >
                    <CloseIcon className={styles.buttonIcon} />
                  </button>
                </div>

                <div className={`${styles.modalScrollBody} ${styles.assetFilterModalBody}`}>
                  <div className={styles.assetFilterOptionStack} role="group" aria-label="Asset filter options">
                    {PRIMARY_ASSET_FILTER_OPTION ? (
                      <button
                        type="button"
                        className={`${styles.assetFilterOptionCard} ${styles.assetFilterAllOptionCard} ${assetFilter === PRIMARY_ASSET_FILTER_OPTION.value ? styles.assetFilterOptionCardActive : ''}`}
                        onClick={() => selectAssetFilter(PRIMARY_ASSET_FILTER_OPTION.value)}
                        aria-pressed={assetFilter === PRIMARY_ASSET_FILTER_OPTION.value}
                      >
                        <span className={styles.assetFilterOptionText}>
                          <strong>{PRIMARY_ASSET_FILTER_OPTION.label}</strong>
                        </span>
                      </button>
                    ) : null}

                    <div className={styles.assetFilterOptionGrid}>
                      {SECONDARY_ASSET_FILTER_OPTIONS.map((option) => {
                        const isActiveFilter = assetFilter === option.value;

                        return (
                          <button
                            type="button"
                            key={option.value}
                            className={`${styles.assetFilterOptionCard} ${isActiveFilter ? styles.assetFilterOptionCardActive : ''}`}
                            onClick={() => selectAssetFilter(option.value)}
                            aria-pressed={isActiveFilter}
                          >
                            <span className={styles.assetFilterOptionText}>
                              <strong>{option.label}</strong>
                            </span>
                            {isActiveFilter ? <span className={styles.assetFilterModalTick}>✓</span> : null}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                <div className={styles.assetFilterModalFooter}>
                  <button type="button" className={styles.secondaryButton} onClick={clearAssetFilter} disabled={!hasActiveAssetFilter}>
                    Clear filter
                  </button>
                  <button type="button" className={styles.primaryButton} onClick={() => setIsAssetFilterOpen(false)}>
                    Done
                  </button>
                </div>
              </div>
            </div>
          ) : null}

          {isChangeRegisterModalOpen ? (
            <div className={`${styles.modalOverlay} ${styles.changeRegisterModalOverlay}`}>
              <div className={styles.modalBackdrop} onClick={closeChangeRegisterModal} />

              <div
                className={`${styles.modalCard} ${styles.changeRegisterModal}`}
                role="dialog"
                aria-modal="true"
                aria-labelledby="asset-register-change-title"
              >
                <div className={`${styles.modalHeader} ${styles.changeRegisterModalHeader}`}>
                  <div className={styles.modalHeaderText}>
                    <h3 id="asset-register-change-title">Change Asset Register</h3>
                    <p>Choose a saved asset register to open, or manage your registers.</p>
                  </div>

                  <button
                    type="button"
                    className={styles.modalCloseButton}
                    onClick={closeChangeRegisterModal}
                    aria-label="Close change asset register modal"
                    disabled={Boolean(changingRegisterId)}
                  >
                    <CloseIcon className={styles.buttonIcon} />
                  </button>
                </div>

                <div className={styles.changeRegisterToolbar}>
                  <label className={styles.changeRegisterSearchWrap}>
                    <SearchIcon className={styles.changeRegisterSearchIcon} />
                    <input
                      value={registerSwitcherSearchTerm}
                      onChange={(event) => setRegisterSwitcherSearchTerm(event.target.value)}
                      placeholder="Search asset registers..."
                      aria-label="Search asset registers"
                      disabled={Boolean(changingRegisterId)}
                      autoFocus
                    />
                  </label>

                  <Link
                    href={isAccountantWorkspace && accountantShareId
                      ? `/accountant/registers/${encodeURIComponent(accountantShareId)}/manage`
                      : '/asset-registers'}
                    className={`${styles.secondaryButton} ${styles.changeRegisterManageButton}`}
                    onClick={closeChangeRegisterModal}
                  >
                    <ManageIcon className={styles.buttonIcon} />
                    <span>Manage</span>
                  </Link>
                </div>

                <div className={styles.changeRegisterList}>
                  {visibleRegisterSwitcherOptions.map((register) => {
                    const isCurrentRegister = register.id === activeRegister?.id || register.id === activeRegisterId;
                    const isChangingThisRegister = changingRegisterId === register.id;
                    const registerAssetCount = Math.max(0, Math.round(Number(register.assetCount) || 0));
                    const assetCountLabel = `${registerAssetCount.toLocaleString('en-ZA')} ${registerAssetCount === 1 ? 'asset' : 'assets'}`;
                    const registerUnnotedAlertCount = registerUnnotedAlertCounts.get(register.id) ?? registerSummaryUnnotedAlertCount(register);

                    return (
                      <button
                        type="button"
                        key={register.id}
                        className={`${styles.changeRegisterCard} ${isCurrentRegister ? styles.changeRegisterCardActive : ''}`}
                        onClick={() => void handleChangeRegisterSelect(register)}
                        disabled={Boolean(changingRegisterId)}
                        aria-current={isCurrentRegister ? 'page' : undefined}
                      >
                        <span className={styles.changeRegisterCardText}>
                          <strong>{register.businessName || 'Asset Register'}</strong>
                          <small>{assetCountLabel} · {money(Number(register.totalValue) || 0)} current value</small>
                        </span>
                        <span className={styles.changeRegisterCardAside}>
                          {registerUnnotedAlertCount > 0 ? (
                            <span
                              className={styles.changeRegisterCardAlertBadge}
                              aria-label={`${formatAlertBadgeCount(registerUnnotedAlertCount)} unnoted alert${registerUnnotedAlertCount === 1 ? '' : 's'} in this asset register`}
                            >
                              {formatAlertBadgeCount(registerUnnotedAlertCount)}
                            </span>
                          ) : null}
                          <span className={styles.changeRegisterCardAction}>
                            {isChangingThisRegister ? 'Opening...' : isCurrentRegister ? 'Current' : 'Open'}
                          </span>
                        </span>
                      </button>
                    );
                  })}

                  {!visibleRegisterSwitcherOptions.length ? (
                    <div className={styles.changeRegisterEmptyState}>
                      <strong>No asset registers match your search.</strong>
                      <button
                        type="button"
                        className={styles.secondaryButton}
                        onClick={() => setRegisterSwitcherSearchTerm('')}
                      >
                        Clear search
                      </button>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          ) : null}

          {assetRegisterMoveAsset ? (
            <div className={styles.modalOverlay}>
              <div className={styles.modalBackdrop} onClick={closeAssetRegisterMoveManager} />

              <div
                className={`${styles.modalCard} ${styles.assetRegisterMoveModal}`}
                role="dialog"
                aria-modal="true"
                aria-labelledby="asset-register-move-title"
              >
                <div className={`${styles.modalHeader} ${styles.assetRegisterMoveModalHeader}`}>
                  <div className={styles.modalHeaderText}>
                    <h3 id="asset-register-move-title">Move Asset</h3>
                    <p>Choose another Asset Register or an umbrella for this asset.</p>
                  </div>

                  <button
                    type="button"
                    className={styles.modalCloseButton}
                    onClick={closeAssetRegisterMoveManager}
                    aria-label="Close move asset modal"
                    disabled={isMovingAssetRegister}
                  >
                    <CloseIcon className={styles.buttonIcon} />
                  </button>
                </div>

                <div className={styles.assetRegisterMoveModalBody}>
                  <label className={styles.assetRegisterMoveSearchWrap}>
                    <SearchIcon className={styles.assetRegisterMoveSearchIcon} />
                    <input
                      value={assetRegisterMoveSearchTerm}
                      onChange={(event) => setAssetRegisterMoveSearchTerm(event.target.value)}
                      placeholder="Search assets..."
                      aria-label="Search selected asset"
                      disabled={isMovingAssetRegister}
                    />
                  </label>

                  {assetRegisterMoveAsset.title.toLowerCase().includes(assetRegisterMoveSearchTerm.trim().toLowerCase()) ? (
                    <div className={styles.assetRegisterMoveRow}>
                      <div className={styles.assetRegisterMoveCopy}>
                        <strong>{assetRegisterMoveAsset.title}</strong>
                        <div className={styles.assetRegisterMoveDetails}>
                          <span>
                            <b>Year model:</b>
                            {assetRegisterMoveAsset.yearModel || '—'}
                          </span>
                          <span>
                            <b>Usage:</b>
                            {buildAssetUsageValue(assetRegisterMoveAsset)}
                          </span>
                          <span>
                            <b>Condition:</b>
                            {conditionLabel(assetRegisterMoveAsset.condition)}
                          </span>
                          <span className={styles.assetRegisterMovePrice}>
                            <b>Current value:</b>
                            {money(assetRegisterMoveAsset.value)}
                          </span>
                        </div>
                      </div>

                      <div className={styles.assetRegisterMoveDestination}>
                        <span className={styles.assetRegisterMoveDestinationLabel}>Move this asset to</span>
                        <div
                          className={styles.assetRegisterMoveDestinationTabs}
                          role="group"
                          aria-label="Move destination"
                        >
                          <button
                            type="button"
                            className={`${styles.assetRegisterMoveDestinationTab} ${assetRegisterMoveDestination === 'register' ? styles.assetRegisterMoveDestinationTabActive : ''}`}
                            onClick={() => {
                              setAssetRegisterMoveDestination('register');
                              setAssetRegisterMoveTargetId('');
                              setAssetRegisterMoveError('');
                            }}
                            aria-pressed={assetRegisterMoveDestination === 'register'}
                            disabled={isMovingAssetRegister}
                          >
                            <ChangeRegisterIcon className={styles.buttonIcon} />
                            <span>Asset Register</span>
                          </button>
                          <button
                            type="button"
                            className={`${styles.assetRegisterMoveDestinationTab} ${assetRegisterMoveDestination === 'umbrella' ? styles.assetRegisterMoveDestinationTabActive : ''}`}
                            onClick={() => {
                              setAssetRegisterMoveDestination('umbrella');
                              setAssetRegisterMoveTargetId('');
                              setAssetRegisterMoveError('');
                            }}
                            aria-pressed={assetRegisterMoveDestination === 'umbrella'}
                            disabled={!canManageAssetGroups || isMovingAssetRegister}
                            title={canManageAssetGroups ? 'Move to an umbrella' : 'Umbrella changes are unavailable'}
                          >
                            <UmbrellaIcon className={styles.buttonIcon} />
                            <span>Umbrella</span>
                          </button>
                        </div>

                        {assetRegisterMoveDestination === 'register' ? (
                          assetRegisterMoveTargetOptions.length ? (
                            <ModalSelect<string>
                              label="Target Asset Register"
                              value={assetRegisterMoveTargetId}
                              options={assetRegisterMoveTargetOptions}
                              onChange={(value) => {
                                setAssetRegisterMoveTargetId(value);
                                setAssetRegisterMoveError('');
                              }}
                              placeholder="Choose target register"
                              className={styles.assetRegisterMoveTargetField}
                              usePortal
                            />
                          ) : (
                            <div className={styles.assetRegisterMoveNoTarget}>
                              <p>Create another Asset Register before moving this asset.</p>
                              <Link
                                href={isAccountantWorkspace && accountantShareId
                                  ? `/accountant/registers/${encodeURIComponent(accountantShareId)}/manage`
                                  : '/asset-registers'}
                                className={`${styles.primaryButton} ${styles.assetRegisterMoveCreateButton}`}
                                onClick={closeAssetRegisterMoveManager}
                              >
                                Create new Asset Register
                              </Link>
                            </div>
                          )
                        ) : isLoadingAssetRegisterMoveGroups ? (
                          <div className={styles.assetRegisterMoveNoTarget} role="status">
                            <p>Loading umbrellas...</p>
                          </div>
                        ) : assetRegisterMoveGroupLoadError ? (
                          <div className={styles.assetRegisterMoveNoTarget} role="alert">
                            <p>{assetRegisterMoveGroupLoadError}</p>
                          </div>
                        ) : assetRegisterMoveGroupOptions.length ? (
                          <ModalSelect<string>
                            label="Target umbrella"
                            value={assetRegisterMoveTargetId}
                            options={assetRegisterMoveGroupOptions}
                            onChange={(value) => {
                              setAssetRegisterMoveTargetId(value);
                              setAssetRegisterMoveError('');
                            }}
                            placeholder="Choose an umbrella"
                            className={styles.assetRegisterMoveTargetField}
                            usePortal
                          />
                        ) : (
                          <div className={styles.assetRegisterMoveNoTarget}>
                            <p>No other umbrellas are available. Use the umbrella button beside an asset to create one first.</p>
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <p className={styles.assetRegisterMoveNoMatch}>
                      No asset matches this search.
                    </p>
                  )}

                  {assetRegisterMoveError ? (
                    <p className={styles.assetRegisterMoveError} role="alert">
                      {assetRegisterMoveError}
                    </p>
                  ) : null}
                </div>

                <div className={styles.assetRegisterMoveModalFooter}>
                  <button
                    type="button"
                    className={styles.secondaryButton}
                    onClick={closeAssetRegisterMoveManager}
                    disabled={isMovingAssetRegister}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className={styles.primaryButton}
                    onClick={() => void handleMoveAssetRegister()}
                    disabled={!assetRegisterMoveTargetId || isMovingAssetRegister}
                  >
                    {assetRegisterMoveDestination === 'umbrella'
                      ? <UmbrellaIcon className={styles.buttonIcon} />
                      : <ChangeRegisterIcon className={styles.buttonIcon} />}
                    <span>
                      {isMovingAssetRegister
                        ? 'Moving...'
                        : assetRegisterMoveDestination === 'umbrella'
                          ? 'Move to Umbrella'
                          : 'Move Asset'}
                    </span>
                  </button>
                </div>
              </div>
            </div>
          ) : null}

          <section className={styles.assetSummaryCarousel} aria-label="Asset register summary">
            <button
              type="button"
              className={`${styles.assetSummaryArrow} ${styles.controlTooltip}`}
              onClick={() => handleRegisterSummarySlide(-1)}
              disabled={isRegisterSummaryAtStart}
              aria-label="Show previous asset register summary cards"
              data-tooltip="Previous"
            >
              <span aria-hidden="true">‹</span>
            </button>

            <div
              className={styles.assetSummaryViewport}
              ref={registerSummaryViewportRef}
              onScroll={handleRegisterSummaryScroll}
              tabIndex={0}
              aria-label="Scrollable asset register summary cards"
            >
              <div className={`${styles.summaryRow} ${styles.heroSummaryRow} ${styles.assetSummaryTrack}`}>
                <div className={`${styles.summaryTile} ${styles.registerValueTile} ${styles.heroSummaryTile} ${styles.heroRegisterTile}`}>
                  <div className={styles.heroSummaryHead}>
                    <span className={styles.heroSummaryTitle}>Register value</span>
                  </div>

                  <div className={styles.heroSummaryValueRow}>
                    <strong className={`${styles.heroSummaryValue} ${styles.heroRegisterValue}`}>
                      {money(displayedRegisterValue)}
                      {registerValueVatMode === 'excluded' ? <span className={styles.heroRegisterVatSuffix}> + VAT</span> : null}
                    </strong>
                  </div>

                  <div className={`${styles.heroSummaryFooter} ${styles.heroVatFooter}`}>
<div className={styles.vatToggleGroup} aria-label="VAT display for all asset values">
                        <button
                          type="button"
                          className={`${styles.vatToggleButton} ${registerValueVatMode === 'excluded' ? styles.vatToggleButtonActive : ''}`}
                          onClick={() => handleRegisterValueVatModeChange('excluded')}
                          aria-pressed={registerValueVatMode === 'excluded'}
                        >
                          Excl. VAT
                        </button>
                        <button
                          type="button"
                          className={`${styles.vatToggleButton} ${registerValueVatMode === 'included' ? styles.vatToggleButtonActive : ''}`}
                          onClick={() => handleRegisterValueVatModeChange('included')}
                          aria-pressed={registerValueVatMode === 'included'}
                        >
                          Incl. VAT
                        </button>
                      </div>
                  </div>
                </div>

                <div className={`${styles.summaryTile} ${styles.metricSummaryTile} ${styles.heroSummaryTile}`}>
                  <div className={styles.heroSummaryHead}>
                    <span className={styles.heroSummaryTitle}>Aim4price valued equipment</span>
                  </div>

                  <div className={styles.heroSummaryValueRow}>
                    <strong className={styles.heroSummaryValue}>{aim4priceValuedEquipmentCount}</strong>
                  </div>

                  <div className={styles.heroSummaryFooter} aria-hidden="true" />
                </div>

                <div className={`${styles.summaryTile} ${styles.totalAssetsTile} ${styles.heroSummaryTile}`}>
                  <div className={styles.heroSummaryHead}>
                    <span className={styles.heroSummaryTitle}>Total assets</span>
                  </div>

                  <div className={styles.heroSummaryValueRow}>
                    <strong className={styles.heroSummaryValue}>{assets.length}</strong>
                  </div>

                  <div className={`${styles.heroSummaryFooter} ${styles.heroTotalFooter}`}>
                    <small>{registerRangeDescription}</small>
                  </div>
                </div>

                <div className={`${styles.summaryTile} ${styles.metricSummaryTile} ${styles.heroSummaryTile} ${styles.summaryBreakdownTile}`}>
                  <div className={styles.heroSummaryHead}>
                    <span className={styles.heroSummaryTitle}>Manual assets</span>
                  </div>

                  <div className={styles.summaryBreakdownBody}>
                    <div className={styles.summaryBreakdownCount}>
                      <span>Count</span>
                      <strong>{manualAssetStats.count}</strong>
                    </div>

                    <div className={styles.summaryBreakdownValues}>
                      <div className={styles.summaryBreakdownValueRow}>
                        <span>Excl. VAT</span>
                        <strong>{money(manualAssetStats.value)}</strong>
                      </div>
                      <div className={styles.summaryBreakdownValueRow}>
                        <span>Incl. VAT</span>
                        <strong>{money(Math.round(manualAssetStats.value * 1.15))}</strong>
                      </div>
                    </div>
                  </div>

                  <div className={styles.heroSummaryFooter} aria-hidden="true" />
                </div>

                <div className={`${styles.summaryTile} ${styles.metricSummaryTile} ${styles.heroSummaryTile} ${styles.summaryBreakdownTile}`}>
                  <div className={styles.heroSummaryHead}>
                    <span className={styles.heroSummaryTitle}>Assets financed</span>
                  </div>

                  <div className={styles.summaryBreakdownBody}>
                    <div className={styles.summaryBreakdownCount}>
                      <span>Count</span>
                      <strong>{financedAssetStats.count}</strong>
                    </div>

                    <div className={styles.summaryBreakdownValues}>
                      <div className={styles.summaryBreakdownValueRow}>
                        <span>Excl. VAT</span>
                        <strong>{money(financedAssetStats.value)}</strong>
                      </div>
                      <div className={styles.summaryBreakdownValueRow}>
                        <span>Incl. VAT</span>
                        <strong>{money(Math.round(financedAssetStats.value * 1.15))}</strong>
                      </div>
                    </div>
                  </div>

                  <div className={styles.heroSummaryFooter} aria-hidden="true" />
                </div>

                <div className={`${styles.summaryTile} ${styles.metricSummaryTile} ${styles.heroSummaryTile} ${styles.summaryBreakdownTile}`}>
                  <div className={styles.heroSummaryHead}>
                    <span className={styles.heroSummaryTitle}>Assets insured</span>
                  </div>

                  <div className={styles.summaryBreakdownBody}>
                    <div className={styles.summaryBreakdownCount}>
                      <span>Count</span>
                      <strong>{insuredAssetStats.count}</strong>
                    </div>

                    <div className={styles.summaryBreakdownValues}>
                      <div className={styles.summaryBreakdownValueRow}>
                        <span>Excl. VAT</span>
                        <strong>{money(insuredAssetStats.value)}</strong>
                      </div>
                      <div className={styles.summaryBreakdownValueRow}>
                        <span>Incl. VAT</span>
                        <strong>{money(Math.round(insuredAssetStats.value * 1.15))}</strong>
                      </div>
                    </div>
                  </div>

                  <div className={styles.heroSummaryFooter} aria-hidden="true" />
                </div>

                <div className={`${styles.summaryTile} ${styles.metricSummaryTile} ${styles.heroSummaryTile} ${styles.summaryBreakdownTile}`}>
                  <div className={styles.heroSummaryHead}>
                    <span className={styles.heroSummaryTitle}>Assets licensed</span>
                  </div>

                  <div className={styles.summaryBreakdownBody}>
                    <div className={styles.summaryBreakdownCount}>
                      <span>Count</span>
                      <strong>{licensedAssetStats.count}</strong>
                    </div>

                    <div className={styles.summaryBreakdownValues}>
                      <div className={styles.summaryBreakdownValueRow}>
                        <span>Excl. VAT</span>
                        <strong>{money(licensedAssetStats.value)}</strong>
                      </div>
                      <div className={styles.summaryBreakdownValueRow}>
                        <span>Incl. VAT</span>
                        <strong>{money(Math.round(licensedAssetStats.value * 1.15))}</strong>
                      </div>
                    </div>
                  </div>

                  <div className={styles.heroSummaryFooter} aria-hidden="true" />
                </div>

                <div className={`${styles.summaryTile} ${styles.registerValueTile} ${styles.heroSummaryTile} ${styles.heroRegisterTile} ${styles.replacementSummaryTile}`}>
                  <div className={styles.heroSummaryHead}>
                    <span className={styles.heroSummaryTitle}>Replacement value</span>
                  </div>

                  <div className={styles.heroSummaryValueRow}>
                    <strong className={`${styles.heroSummaryValue} ${styles.heroRegisterValue}`}>
                      {money(displayedReplacementValue)}
                      {replacementValueVatMode === 'excluded' ? <span className={styles.heroRegisterVatSuffix}> + VAT</span> : null}
                    </strong>
                  </div>

                  <div className={`${styles.heroSummaryFooter} ${styles.heroVatFooter}`}>
                    <div className={styles.vatToggleGroup} aria-label="Replacement value VAT display">
                      <button
                        type="button"
                        className={`${styles.vatToggleButton} ${replacementValueVatMode === 'excluded' ? styles.vatToggleButtonActive : ''}`}
                        onClick={() => setReplacementValueVatMode('excluded')}
                        aria-pressed={replacementValueVatMode === 'excluded'}
                      >
                        Excl. VAT
                      </button>
                      <button
                        type="button"
                        className={`${styles.vatToggleButton} ${replacementValueVatMode === 'included' ? styles.vatToggleButtonActive : ''}`}
                        onClick={() => setReplacementValueVatMode('included')}
                        aria-pressed={replacementValueVatMode === 'included'}
                      >
                        Incl. VAT
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <button
              type="button"
              className={`${styles.assetSummaryArrow} ${styles.controlTooltip}`}
              onClick={() => handleRegisterSummarySlide(1)}
              disabled={isRegisterSummaryAtEnd}
              aria-label="Show next asset register summary cards"
              data-tooltip="Next"
            >
              <span aria-hidden="true">›</span>
            </button>
          </section>

          <div className={styles.toolbar}>
            <label className={styles.searchWrap}>
              <SearchIcon className={styles.searchIcon} />
              <input
                className={styles.searchInput}
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Search by asset, brand, model or serial"
                aria-label="Search asset register"
              />

              {searchTerm ? (
                <button
                  type="button"
                  className={styles.clearSearchButton}
                  onClick={() => setSearchTerm('')}
                  aria-label="Clear search"
                >
                  <CloseIcon className={styles.buttonIcon} />
                </button>
              ) : null}
            </label>

            <div className={styles.toolbarActions}>
              <button
                type="button"
                className={`${styles.secondaryButton} ${styles.toolbarRefreshButton}`}
                onClick={handleRefreshAssetRegister}
                disabled={isLoading || isRefreshingRegister}
              >
                <RefreshIcon className={`${styles.buttonIcon} ${isRefreshingRegister ? styles.toolbarRefreshIconActive : ''}`} />
                <span>{isRefreshingRegister ? 'Refreshing...' : 'Refresh'}</span>
              </button>

              {canManageAssetGroups ? (
                <button
                  type="button"
                  className={`${styles.secondaryButton} ${styles.toolbarUmbrellaButton}`}
                  onClick={openCreateAssetGroupManager}
                >
                  <UmbrellaIcon className={styles.buttonIcon} />
                  <span>Create Umbrella</span>
                </button>
              ) : null}

              {canAddAssetsToActiveRegister ? (
                <button type="button" className={`${styles.primaryButton} ${styles.toolbarPrimaryButton}`} onClick={openAddAssetChoiceModal}>
                  <PlusIcon className={styles.buttonIcon} />
                  <span>Add Asset</span>
                </button>
              ) : null}
            </div>
          </div>

          {!isLoading && assets.length ? (
            filteredAssets.length ? (
              <>
                <div className={styles.assetList}>
                  {visibleAssetRows.map((row) => {
                    if (row.kind === 'group') {
                      const group = row.group;
                      const primaryAssetId = getAssetGroupPrimaryAssetId(group);
                      const groupAnchorAsset = assetsById.get(primaryAssetId)
                        ?? group.members
                          .map((member) => assetsById.get(member.assetId))
                          .find((asset) => asset !== undefined)
                        ?? null;
                      const isCollapsed = !expandedAssetGroupIds.has(group.id);
                      const groupUnnotedAlertCount = group.members.reduce((sum, member) => {
                        const memberAsset = assetsById.get(member.assetId);
                        return sum + (memberAsset ? assetUnnotedAlertCount(memberAsset) : 0);
                      }, 0);
                      const groupValueExVat = groupRegisterValue(group, assets);
                      const displayedGroupValue = registerValueVatMode === 'included'
                        ? Math.round(groupValueExVat * ASSET_REGISTER_SUMMARY_VAT_MULTIPLIER)
                        : groupValueExVat;
                      const groupVatLabel = registerValueVatMode === 'included' ? 'Incl. VAT' : 'Excl. VAT';
                      const additionalAssetCount = Math.max(0, group.members.length - 1);
                      const canReceiveDraggedAsset = canDropAssetIntoGroup(draggingAssetId, group);
                      const isAssetGroupDropTarget = canReceiveDraggedAsset && assetGroupDropTargetId === group.id;
                      const isAssetGroupMuted = expandedAssetId
                        ? expandedAssetGroupId !== group.id
                        : Boolean(focusedAssetGroupId && focusedAssetGroupId !== group.id);

                      return (
                        <div
                          className={`${styles.assetGroupHeaderRow} ${isAssetGroupMuted ? styles.assetGroupHeaderRowMuted : ''} ${canReceiveDraggedAsset ? styles.assetGroupHeaderRowDragReady : ''} ${isAssetGroupDropTarget ? styles.assetGroupHeaderRowDropTarget : ''}`}
                          key={`asset-group-${group.id}`}
                          data-asset-group-id={group.id}
                          onDragOver={(event) => handleAssetGroupDragOver(event, group)}
                          onDragLeave={(event) => handleAssetGroupDragLeave(event, group)}
                          onDrop={(event) => void handleAssetGroupDrop(event, group)}
                          data-asset-group-drop-target={isAssetGroupDropTarget ? 'true' : undefined}
                        >
                          <section
                            className={`${styles.assetGroupHeader} ${isCollapsed ? styles.assetGroupHeaderCollapsed : ''}`}
                            onClick={(event) => {
                              if (draggingAssetId) return;
                              const target = event.target as HTMLElement;
                              if (target.closest('button, a, input, select, textarea, [role="button"]')) return;
                              toggleAssetGroupCollapsed(group.id);
                            }}
                          >
                            {isAssetGroupDropTarget ? (
                              <span className={styles.assetGroupDropPrompt} role="status">Drop asset here</span>
                            ) : null}
                            <div className={styles.assetGroupIdentity}>
                              <span
                                className={styles.assetGroupUmbrella}
                                title={groupUnnotedAlertCount > 0
                                  ? `${formatAlertBadgeCount(groupUnnotedAlertCount)} unnoted group alert${groupUnnotedAlertCount === 1 ? '' : 's'}`
                                  : undefined}
                              >
                                <UmbrellaIcon className={styles.assetGroupUmbrellaIcon} />
                                {groupUnnotedAlertCount > 0 ? (
                                  <span
                                    className={`${styles.registerChangeAlertBadge} ${styles.assetGroupAlertBadge}`}
                                    aria-label={`${formatAlertBadgeCount(groupUnnotedAlertCount)} unnoted alert${groupUnnotedAlertCount === 1 ? '' : 's'} in ${group.name}`}
                                  >
                                    {formatAlertBadgeCount(groupUnnotedAlertCount)}
                                  </span>
                                ) : null}
                              </span>
                              <div>
                                <h2>{group.name}</h2>
                                <p>
                                  {group.members.length} grouped assets · {assetGroupValueModeLabel(group)}
                                  {group.registerId === null ? ' · Combined umbrella' : ''}
                                </p>
                                {isCollapsed && groupAnchorAsset ? (
                                  <span className={styles.assetGroupPreview}>
                                    {groupAnchorAsset.title}{additionalAssetCount ? ` + ${additionalAssetCount} more` : ''}
                                  </span>
                                ) : null}
                              </div>
                            </div>

                            <div className={styles.assetGroupSummary}>
                              <div className={styles.assetGroupValue}>
                                <strong>Counted value {money(displayedGroupValue)}</strong>
                                <span>{groupVatLabel}</span>
                              </div>

                              <div className={`${styles.assetHeaderActions} ${styles.assetGroupHeaderActions}`}>
                                {canShareActiveRegister ? (
                                  <button
                                    type="button"
                                    className={`${styles.optionsButton} ${styles.cardOptionsButton}`}
                                    onClick={() => openAssetGroupShare(group)}
                                    aria-label={`Share ${group.name}`}
                                  >
                                    <ShareIcon className={styles.buttonIcon} />
                                    <span>Share</span>
                                  </button>
                                ) : null}

                                <button
                                  type="button"
                                  className={`${styles.expandButton} ${styles.cardViewDetailsButton} ${styles.controlTooltip}`}
                                  onClick={() => toggleAssetGroupCollapsed(group.id)}
                                  aria-expanded={!isCollapsed}
                                  data-tooltip={isCollapsed ? 'View details' : 'Hide details'}
                                >
                                  {isCollapsed
                                    ? <ChevronDownIcon className={`${styles.buttonIcon} ${styles.assetDetailsChevron}`} />
                                    : <ChevronUpIcon className={`${styles.buttonIcon} ${styles.assetDetailsChevron}`} />}
                                  <span>{isCollapsed ? 'View details' : 'Hide details'}</span>
                                </button>

                                <button
                                  type="button"
                                  className={`${styles.optionsButton} ${styles.cardManageButton}`}
                                  onClick={() => groupAnchorAsset && openAssetGroupManager(groupAnchorAsset)}
                                  disabled={!groupAnchorAsset || !canManageAssetGroups}
                                  aria-label={`Manage ${group.name}`}
                                >
                                  <ManageIcon className={styles.buttonIcon} />
                                  <span>Manage</span>
                                </button>
                              </div>
                            </div>
                          </section>
                        </div>
                      );
                    }

                    const asset = row.asset;
                    const assetGroup = row.group;
                    const persistedAssetGroup = allAssetGroupMemberships.get(asset.id)?.group ?? null;
                    const isResolvedCombinedGroup = !assetGroup && persistedAssetGroup?.registerId === null;
                    const assetGroupMembership = assetGroupMemberships.get(asset.id)?.member ?? null;
                    const isLastAssetGroupMember = Boolean(assetGroup && row.memberIndex === row.memberCount - 1);
                    const previewPhoto = assetPreviewImage(asset);
                    const isLive = isLiveOnMarketplace(asset);
                    const isFlagged = isAssetFlagged(asset);
                    const isFlagBusy = busyFlagAssetId === asset.id;
                    const isExpanded = expandedAssetId === asset.id;
                    const isAssetRowMuted = expandedAssetId
                      ? !isExpanded
                      : Boolean(focusedAssetGroupId && assetGroup?.id !== focusedAssetGroupId);
                    const detailDocuments = assetDocuments(asset);
                    const vaultDocuments = vaultDocumentsByAssetId[asset.id] ?? [];
                    const isVaultDocumentsLoading = Boolean(vaultDocumentsLoadingByAssetId[asset.id]);
                    const vaultDocumentsError = vaultDocumentsErrorByAssetId[asset.id] ?? '';
                    const insuredValueExVat = readAssetInsuredValueExVat(asset);
                    const estimateNeedsUpdate = doesEstimateNeedUpdate(asset) && isValuationUpdateAvailable(asset);
                    const openPartnerNote = asset.openPartnerNote ?? null;
                    const partnerNoteAuthor = openPartnerNote?.partnerBusinessName || openPartnerNote?.partnerName || 'Aim4price partner';
                    const partnerNoteToneClass = openPartnerNote ? quoteToneClassForPartnerType(openPartnerNote.partnerType) : '';
                    const partnerNoteLabel = openPartnerNote?.partnerType ? `${formatQuotePartnerType(openPartnerNote.partnerType)} note` : 'Partner note';
                    const latestMaintenanceStatus = asset.latestMaintenanceStatus ?? null;
                    const latestIssueNoteStatus = asset.latestIssueNoteStatus ?? null;
                    const maintenanceAlert = asset.maintenanceAlert ?? null;
                    const licenseRenewalAlert = asset.licenseRenewalAlert ?? null;
                    const dealerAssetCorrection = asset.dealerAssetCorrection ?? null;
                    const dealerCorrectionRevaluationAlert =
                      dealerAssetCorrection?.status === 'accepted'
                      && (
                        dealerAssetCorrection.revaluationStatus === 'failed'
                        || dealerAssetCorrection.revaluationStatus === 'pending'
                      );
                    const dealerCorrectionLabel = dealerCorrectionRevaluationAlert
                      ? dealerAssetCorrection?.revaluationStatus === 'failed'
                        ? 'Valuation retry needed'
                        : 'Valuation pending'
                      : dealerAssetCorrection?.serialNumberChanged
                        ? 'Serial number update'
                        : dealerAssetCorrection?.replacementPriceChanged
                          ? 'Replacement price update'
                          : 'Renewal date update';
                    const isDecidingDealerCorrection = dealerAssetCorrection
                      ? busyDealerCorrectionId === dealerAssetCorrection.id
                      : false;
                    const isManualValueAsset = asset.selectedMethod === 'manual';
                    const assetValueVatMode = assetValueVatModes[asset.id] ?? registerValueVatMode;
                    const displayedAssetValue = assetValueVatMode === 'included'
                      ? Math.round(Number(asset.value || 0) * ASSET_REGISTER_SUMMARY_VAT_MULTIPLIER)
                      : asset.value;
                    const assetValueVatLabel = assetValueVatMode === 'included' ? 'Incl. VAT' : 'Excl. VAT';
                    const assetValueVatToggleLabel = assetValueVatMode === 'included' ? 'Show excl. VAT' : 'Show incl. VAT';
                    const maintenanceDoneLabel =
                      latestMaintenanceStatus?.kind === 'checked'
                        ? 'Maintenance checked'
                        : latestMaintenanceStatus?.kind === 'repaired'
                          ? 'Maintenance repaired'
                          : 'Maintenance serviced';
                    const maintenanceDoneMeta = latestMaintenanceStatus
                      ? [
                          latestMaintenanceStatus.operatorName ? `By ${latestMaintenanceStatus.operatorName}` : '',
                          latestMaintenanceStatus.createdAtIso ? formatDate(latestMaintenanceStatus.createdAtIso) : '',
                        ]
                          .filter(Boolean)
                          .join(' · ')
                      : '';
                    const maintenancePhotoUrls = latestMaintenanceStatus
                      ? uniquePhotoUrls(latestMaintenanceStatus.photoUrls ?? []).slice(0, 6)
                      : [];
                    const maintenancePhotoCount = latestMaintenanceStatus
                      ? typeof latestMaintenanceStatus.photoCount === 'number'
                        ? latestMaintenanceStatus.photoCount
                        : maintenancePhotoUrls.length
                      : 0;
                    const isMarkingMaintenanceNoted = latestMaintenanceStatus
                      ? busyMaintenanceStatusId === latestMaintenanceStatus.id
                      : false;
                    const issueNoteMeta = latestIssueNoteStatus
                      ? [
                          latestIssueNoteStatus.operatorName ? `By ${latestIssueNoteStatus.operatorName}` : '',
                          latestIssueNoteStatus.createdAtIso ? formatDate(latestIssueNoteStatus.createdAtIso) : '',
                        ]
                          .filter(Boolean)
                          .join(' · ')
                      : '';
                    const isMarkingIssueNoteNoted = latestIssueNoteStatus
                      ? busyIssueNoteStatusId === latestIssueNoteStatus.id
                      : false;
                    const isMarkingMaintenanceAlertNoted = maintenanceAlert
                      ? busyMaintenanceAlertId === maintenanceAlert.id
                      : false;
                    const isMarkingLicenseRenewalAlertNoted = licenseRenewalAlert
                      ? busyLicenseRenewalAssetId === asset.id
                      : false;

                    return (
                      <div
                        className={`${styles.assetCardRow} ${assetGroup ? styles.assetGroupMemberRow : ''} ${isLastAssetGroupMember ? styles.assetGroupMemberRowLast : ''} ${draggingAssetId === asset.id ? styles.assetCardRowDragging : ''} ${isAssetRowMuted ? styles.assetCardRowMuted : ''}`}
                        key={asset.id}
                        data-asset-group-id={assetGroup?.id}
                        draggable={canManageAssetGroups && !isSavingAssetGroup}
                        onDragStart={(event) => handleAssetDragStart(event, asset)}
                        onDragEnd={handleAssetDragEnd}
                      >
                        <article
                          id={`asset-card-${asset.id}`}
                          className={`${styles.assetCard} ${isExpanded ? styles.assetCardExpanded : ''} ${isFlagged ? styles.assetCardFlagged : ''} ${estimateNeedsUpdate ? styles.assetCardEstimateStale : ''} ${openPartnerNote ? `${styles.assetCardPartnerNote} ${partnerNoteToneClass}` : ''} ${maintenanceAlert || licenseRenewalAlert ? styles.assetCardMaintenanceUpcoming : ''} ${latestMaintenanceStatus ? styles.assetCardMaintenanceDone : ''} ${latestIssueNoteStatus ? styles.assetCardIssueNote : ''} ${dealerAssetCorrection ? styles.assetCardDealerCorrection : ''} ${dealerCorrectionRevaluationAlert ? styles.assetCardDealerCorrectionWarning : ''}`}
                        >
                        {(canUseOwnerOnlyAssetActions || isAccountantWorkspace) ? (
                          <div className={`${styles.assetSideActions} ${styles.assetGroupMemberActions}`} aria-label={`Actions for ${asset.title}`}>
                            <button
                              type="button"
                              className={`${styles.assetFlagButton} ${styles.controlTooltip} ${isFlagged ? styles.assetFlagButtonActive : ''}`}
                              onClick={() => void handleAssetFlagToggle(asset)}
                              disabled={isFlagBusy}
                              aria-label={isFlagged ? `Unflag ${asset.title}` : `Flag ${asset.title}`}
                              aria-pressed={isFlagged}
                              data-tooltip={isFlagged ? 'Remove flag' : 'Flag asset'}
                            >
                              <FlagIcon className={styles.assetFlagIcon} />
                            </button>

                            <button
                              type="button"
                              className={`${styles.assetRegisterMoveButton} ${styles.controlTooltip}`}
                              onClick={() => openAssetRegisterMoveManager(asset)}
                              aria-label={`Move ${asset.title} to another asset register`}
                              data-tooltip="Move asset"
                            >
                              <ChangeRegisterIcon className={styles.assetRegisterMoveIcon} />
                            </button>

                            <button
                              type="button"
                              className={`${styles.assetGroupButton} ${styles.controlTooltip} ${assetGroup || isResolvedCombinedGroup ? styles.assetGroupButtonActive : ''}`}
                              onClick={() => openAssetGroupManager(asset)}
                              disabled={!canManageAssetGroups}
                              aria-label={assetGroup
                                ? `Manage the umbrella containing ${asset.title}`
                                : isResolvedCombinedGroup
                                  ? `Open the combined umbrella containing ${asset.title}`
                                  : `Create an umbrella with ${asset.title}`}
                              data-tooltip={canManageAssetGroups
                                ? assetGroup
                                  ? 'Manage umbrella'
                                  : isResolvedCombinedGroup
                                    ? 'Open combined umbrella'
                                    : 'Create umbrella'
                                : 'Umbrella unavailable'}
                            >
                              <UmbrellaIcon className={styles.assetGroupButtonIcon} />
                            </button>
                          </div>
                        ) : null}
                        <div className={styles.assetHeader}>
                          <div className={styles.assetTitleBlock}>
                            {isFlagged || isLive || estimateNeedsUpdate || openPartnerNote || maintenanceAlert || licenseRenewalAlert || latestMaintenanceStatus || latestIssueNoteStatus || dealerAssetCorrection ? (
                              <div className={styles.badgeRow}>
                                {isFlagged ? <span className={`${styles.badge} ${styles.badgeDanger}`}>Flagged</span> : null}
                                {isLive ? <span className={`${styles.badge} ${styles.badgeSuccess}`}>Live on marketplace</span> : null}
                                {estimateNeedsUpdate ? (
                                  <span className={`${styles.badge} ${styles.badgeWarning}`}>Estimate needs update</span>
                                ) : null}
                                {openPartnerNote ? <span className={`${styles.badge} ${styles.badgeInfo} ${partnerNoteToneClass}`}>{partnerNoteLabel}</span> : null}
                                {maintenanceAlert ? <span className={`${styles.badge} ${styles.badgeMaintenanceUpcoming}`}>Maintenance upcoming</span> : null}
                                {licenseRenewalAlert ? <span className={`${styles.badge} ${styles.badgeMaintenanceUpcoming}`}>License renewal upcoming</span> : null}
                                {latestMaintenanceStatus ? <span className={`${styles.badge} ${styles.badgeMaintenanceDone}`}>{maintenanceDoneLabel}</span> : null}
                                {latestIssueNoteStatus ? <span className={`${styles.badge} ${styles.badgeIssueNote}`}>Open issue</span> : null}
                                {dealerAssetCorrection ? <span className={`${styles.badge} ${styles.badgeDealerCorrection} ${dealerCorrectionRevaluationAlert ? styles.badgeDealerCorrectionWarning : ''}`}>{dealerCorrectionLabel}</span> : null}
                              </div>
                            ) : null}
                            <h2>{asset.title}</h2>
                            <p>{buildAssetMeta(asset)}</p>
                            <div className={styles.assetMetaRow}>
                              <span className={styles.assetValueMethodLabel}>{methodLabel(asset.selectedMethod)} value</span>
                              {isCombinedRegisterView ? (
                                <span className={styles.assetSourceRegisterName}>{asset.registerName || 'Asset Register'}</span>
                              ) : null}
                              <span className={styles.assetSavedDateLabel}>{assetStatusDateLabel(asset)}</span>
                            </div>

                            {isManualValueAsset ? (
                              <div className={styles.manualValueNotice} role="note">
                                <span className={styles.manualValueNoticeIcon} aria-hidden="true">i</span>
                                <span>Manual value is fixed — it will not automatically update by itself.</span>
                              </div>
                            ) : null}

                          </div>

                          <div className={styles.assetHeaderAside}>
                            <div className={styles.valueBlock}>
                              <div className={styles.assetValueVatDisplay}>
                                <div className={styles.assetValueVatText}>
                                  <div className={styles.assetValueVatAmountRow}>
                                    <strong>{money(displayedAssetValue)}</strong>
                                    <button
                                      type="button"
                                      className={`${styles.assetValueVatToggle} ${styles.assetCardVatToggle} ${styles.controlTooltip} ${assetValueVatMode === 'included' ? styles.assetValueVatToggleIncluded : ''}`}
                                      onClick={() => handleAssetValueVatToggle(asset.id)}
                                      aria-label={assetValueVatToggleLabel}
                                      aria-pressed={assetValueVatMode === 'included'}
                                      data-tooltip={assetValueVatToggleLabel}
                                    >
                                      <span aria-hidden="true">{assetValueVatMode === 'included' ? '‹' : '›'}</span>
                                    </button>
                                  </div>
                                  <span>{assetValueVatLabel}</span>
                                </div>
                              </div>
                            </div>

                            <div className={`${styles.assetHeaderActions} ${isAccountantWorkspace ? styles.assetHeaderActionsAccountant : ''}`}>
                              {estimateNeedsUpdate && canUseOwnerOnlyAssetActions ? (
                                <button
                                  type="button"
                                  className={`${styles.expandButton} ${styles.updateEstimateInlineButton}`}
                                  disabled={busyRevalueAssetId === asset.id}
                                  onClick={() => void handleUpdateEstimate(asset)}
                                >
                                  <TrendIcon className={styles.buttonIcon} />
                                  <span>{busyRevalueAssetId === asset.id ? 'Updating...' : 'Update estimate'}</span>
                                </button>
                              ) : null}

                              {canUseOwnerOnlyAssetActions ? (
                                <button
                                  type="button"
                                  className={`${styles.optionsButton} ${styles.cardOptionsButton}`}
                                  onClick={() => openAssetQuoteOptions(asset)}
                                >
                                  <ShareIcon className={styles.buttonIcon} />
                                  <span>Share</span>
                                </button>
                              ) : null}

                              {isAccountantWorkspace ? (
                                <button
                                  type="button"
                                  className={`${styles.optionsButton} ${styles.cardOptionsButton} ${styles.cardAccountantNoteButton}`}
                                  onClick={() => openAccountantNoteModal(asset)}
                                  aria-label={`Leave a note on ${asset.title}`}
                                >
                                  <NoteIcon className={styles.buttonIcon} />
                                  <span>Note</span>
                                </button>
                              ) : null}

                              <button
                                type="button"
                                className={`${styles.expandButton} ${styles.cardViewDetailsButton} ${styles.controlTooltip}`}
                                onClick={() => setExpandedAssetId((current) => (current === asset.id ? null : asset.id))}
                                aria-expanded={isExpanded}
                                aria-controls={`asset-panel-${asset.id}`}
                                data-tooltip={isExpanded ? 'Hide details' : 'View details'}
                              >
                                {isExpanded
                                  ? <ChevronUpIcon className={`${styles.buttonIcon} ${styles.assetDetailsChevron}`} />
                                  : <ChevronDownIcon className={`${styles.buttonIcon} ${styles.assetDetailsChevron}`} />}
                                <span>{isExpanded ? 'Hide details' : 'View details'}</span>
                              </button>

                              <button
                                type="button"
                                className={`${styles.optionsButton} ${styles.cardManageButton}`}
                                onClick={() => openActionDialog(asset)}
                              >
                                <ManageIcon className={styles.buttonIcon} />
                                <span>Manage</span>
                              </button>
                            </div>
                          </div>

                          {dealerAssetCorrection && canUseOwnerOnlyAssetActions ? (
                            <div className={`${styles.dealerCorrectionBanner} ${dealerCorrectionRevaluationAlert ? styles.dealerCorrectionBannerWarning : ''}`} role="status">
                              <div className={styles.dealerCorrectionCopy}>
                                <span className={styles.dealerCorrectionIcon} aria-hidden="true">{dealerCorrectionRevaluationAlert ? '!' : '✓'}</span>
                                <div>
                                  <strong>{dealerCorrectionRevaluationAlert
                                    ? dealerAssetCorrection.revaluationStatus === 'failed'
                                      ? 'Replacement price saved — valuation retry needed'
                                      : 'Replacement price saved — valuation pending'
                                    : dealerAssetCorrection.licenseRenewalDateChanged
                                      ? 'Licence renewal awaiting your approval'
                                      : 'Dealer update awaiting your approval'}</strong>
                                  <p>{dealerCorrectionRevaluationAlert
                                    ? dealerAssetCorrection.revaluationStatus === 'failed'
                                      ? dealerAssetCorrection.revaluationFailureMessage || 'Aim4price could not recalculate this asset automatically.'
                                      : 'Aim4price is still recalculating this asset. A safe retry becomes available if the attempt is interrupted.'
                                    : dealerCorrectionDescription(dealerAssetCorrection)}</p>
                                  <small>{dealerCorrectionRevaluationAlert
                                    ? 'The accepted replacement price remains saved regardless of the valuation result.'
                                    : dealerAssetCorrection.licenseRenewalDateChanged
                                      ? 'Review this date before the licence expert can submit another update.'
                                      : 'Review this one change before the dealer can submit another update for this asset.'}</small>
                                </div>
                              </div>
                              <div className={styles.dealerCorrectionActions}>
                                {dealerCorrectionRevaluationAlert ? (
                                  <button
                                    type="button"
                                    className={styles.dealerCorrectionAcceptButton}
                                    disabled={isDecidingDealerCorrection || !dealerAssetCorrection.revaluationRetryable}
                                    onClick={() => void handleDealerCorrectionRevaluationRetry(dealerAssetCorrection)}
                                  >
                                    {isDecidingDealerCorrection
                                      ? 'Retrying…'
                                      : dealerAssetCorrection.revaluationRetryable
                                        ? 'Retry valuation'
                                        : 'Recalculation pending'}
                                  </button>
                                ) : (
                                  <>
                                    <button
                                      type="button"
                                      className={styles.dealerCorrectionDeclineButton}
                                      disabled={isDecidingDealerCorrection}
                                      onClick={() => void handleDealerCorrectionDecision(dealerAssetCorrection, 'reject')}
                                    >
                                      {isDecidingDealerCorrection ? 'Saving…' : 'Decline'}
                                    </button>
                                    <button
                                      type="button"
                                      className={styles.dealerCorrectionAcceptButton}
                                      disabled={isDecidingDealerCorrection}
                                      onClick={() => void handleDealerCorrectionDecision(dealerAssetCorrection, 'accept')}
                                    >
                                      {isDecidingDealerCorrection ? 'Saving…' : 'Accept update'}
                                    </button>
                                  </>
                                )}
                              </div>
                            </div>
                          ) : null}

                          {openPartnerNote ? (
                            <div className={`${styles.partnerNoteBanner} ${partnerNoteToneClass}`}>
                              <div className={styles.partnerNoteText}>
                                <strong>Note from {partnerNoteAuthor}</strong>
                                <p>{openPartnerNote.noteText}</p>
                                {openPartnerNote.attachment ? (
                                  <a
                                    className={styles.partnerNoteAttachmentLink}
                                    href={openPartnerNote.attachment.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                  >
                                    <span>Open quote PDF</span>
                                    <small>{openPartnerNote.attachment.fileName} · {formatByteSize(openPartnerNote.attachment.byteSize)}</small>
                                  </a>
                                ) : null}
                              </div>
                              {canUseOwnerOnlyAssetActions ? (
                                <button
                                  type="button"
                                  className={styles.partnerNoteButton}
                                  onClick={() => void handleMarkPartnerNoteNoted(openPartnerNote.id, asset.id)}
                                >
                                  Noted
                                </button>
                              ) : null}
                            </div>
                          ) : null}

                          {maintenanceAlert ? (
                            <div className={`${styles.partnerNoteBanner} ${styles.maintenanceUpcomingBanner}`}>
                              <div className={styles.partnerNoteText}>
                                <strong>{maintenanceAlert.heading || 'Maintenance upcoming'}</strong>
                                <p>{maintenanceAlert.body}</p>
                                {maintenanceAlert.computedStatusLabel ? <small className={styles.maintenanceUpcomingMeta}>{maintenanceAlert.computedStatusLabel}</small> : null}
                              </div>
                              {canUseOwnerOnlyAssetActions ? (
                                <button
                                  type="button"
                                  className={styles.partnerNoteButton}
                                  disabled={isMarkingMaintenanceAlertNoted}
                                  onClick={() => void handleMarkMaintenanceAlertNoted(maintenanceAlert.id, asset.id)}
                                >
                                  {isMarkingMaintenanceAlertNoted ? 'Noting...' : 'Noted'}
                                </button>
                              ) : null}
                            </div>
                          ) : null}

                          {licenseRenewalAlert ? (
                            <div className={`${styles.partnerNoteBanner} ${styles.maintenanceUpcomingBanner}`}>
                              <div className={styles.partnerNoteText}>
                                <strong>{licenseRenewalAlert.heading || 'License renewal upcoming'}</strong>
                                <p>{licenseRenewalAlert.body}</p>
                                <small className={styles.maintenanceUpcomingMeta}>{licenseRenewalAlert.computedStatusLabel}</small>
                              </div>
                              {canUseOwnerOnlyAssetActions ? (
                                <button
                                  type="button"
                                  className={styles.partnerNoteButton}
                                  disabled={isMarkingLicenseRenewalAlertNoted}
                                  onClick={() => void handleMarkLicenseRenewalAlertNoted(asset.id, licenseRenewalAlert.renewalDate)}
                                >
                                  {isMarkingLicenseRenewalAlertNoted ? 'Noting...' : 'Noted'}
                                </button>
                              ) : null}
                            </div>
                          ) : null}

                          {latestIssueNoteStatus ? (
                            <div className={`${styles.partnerNoteBanner} ${styles.issueNoteBanner}`}>
                              <div className={styles.partnerNoteText}>
                                <strong>Open issue reported</strong>
                                <p>{latestIssueNoteStatus.note}</p>
                                {issueNoteMeta ? <small className={styles.issueNoteMeta}>{issueNoteMeta}</small> : null}
                              </div>
                              {canUseOwnerOnlyAssetActions ? (
                                <button
                                  type="button"
                                  className={styles.partnerNoteButton}
                                  disabled={isMarkingIssueNoteNoted}
                                  onClick={() => void handleMarkIssueNoteStatusNoted(latestIssueNoteStatus.id, asset.id)}
                                >
                                  {isMarkingIssueNoteNoted ? 'Noting...' : 'Noted'}
                                </button>
                              ) : null}
                            </div>
                          ) : null}

                          {latestMaintenanceStatus ? (
                            <div className={`${styles.partnerNoteBanner} ${styles.maintenanceDoneBanner}`}>
                              <div className={styles.partnerNoteText}>
                                <strong>Maintenance has been done</strong>
                                <p>{latestMaintenanceStatus.summary}</p>
                                {latestMaintenanceStatus.note ? <p>Notes/Problems: {latestMaintenanceStatus.note}</p> : null}
                                {maintenancePhotoUrls.length ? (
                                  <div className={styles.maintenanceDonePhotoStrip} aria-label="Maintenance photos">
                                    {maintenancePhotoUrls.map((url, index) => (
                                      <a
                                        key={`${latestMaintenanceStatus.id}-maintenance-photo-${index}`}
                                        href={url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className={styles.maintenanceDonePhotoLink}
                                      >
                                        <img src={url} alt={`Maintenance photo ${index + 1}`} />
                                      </a>
                                    ))}
                                  </div>
                                ) : maintenancePhotoCount > 0 ? (
                                  <p>{maintenancePhotoCount} maintenance photo{maintenancePhotoCount === 1 ? '' : 's'} saved to this asset.</p>
                                ) : null}
                                {maintenancePhotoUrls.length > 0 && maintenancePhotoCount > maintenancePhotoUrls.length ? (
                                  <small className={styles.maintenanceDoneMeta}>
                                    Showing {maintenancePhotoUrls.length} of {maintenancePhotoCount} maintenance photos.
                                  </small>
                                ) : null}
                                {maintenanceDoneMeta ? <small className={styles.maintenanceDoneMeta}>{maintenanceDoneMeta}</small> : null}
                              </div>
                              {canUseOwnerOnlyAssetActions ? (
                                <button
                                  type="button"
                                  className={styles.partnerNoteButton}
                                  disabled={isMarkingMaintenanceNoted}
                                  onClick={() => void handleMarkMaintenanceStatusNoted(latestMaintenanceStatus.id, asset.id)}
                                >
                                  {isMarkingMaintenanceNoted ? 'Noting...' : 'Noted'}
                                </button>
                              ) : null}
                            </div>
                          ) : null}
                        </div>

                        {isExpanded ? (
                          <div className={styles.assetBody} id={`asset-panel-${asset.id}`}>
                            {(() => {
                              const detailPhotos = getDetailPhotos(asset);
                              const detailPhotoIndex = getDetailPhotoIndex(asset);
                              const detailPhoto = detailPhotos[detailPhotoIndex] || previewPhoto;
                              const hasMultiplePhotos = detailPhotos.length > 1;
                              const hasRealPhotos = detailPhotos.length > 0;
                              const isDetailPhotoUploading = detailMediaUpload?.assetId === asset.id && detailMediaUpload.type === 'photo';
                              const canOpenPhotoViewer = hasRealPhotos && Boolean(detailPhoto);
                              const canInteractWithPhotoStage = canOpenPhotoViewer || canUseOwnerOnlyAssetActions;
                              const manualAssetNote = getManualAssetNote(asset.note);
                              const licenseStatus = readLicenseStatusChoice(asset);
                              const registrationNumber = asset.kind !== 'property' && licenseStatus === 'yes' ? readLicenseRegistrationNumber(asset) : '';
                              const mappedStatus: AssetStatusChoice = hasAssetMapCoordinates(asset) ? 'yes' : 'no';
                              const renderAssetDetailRow = (
                                target: AssetDetailEditTarget,
                                label: string,
                                value: string,
                                title = value || 'Not provided',
                              ) => {
                                const displayedValue = value || '—';

                                if (canUseOwnerOnlyAssetActions && canQuickEditAssetDetail(asset, target)) {
                                  return (
                                    <button
                                      type="button"
                                      className={`${styles.assetDetailRow} ${styles.assetDetailRowButton}`}
                                      onClick={(event) => openQuickAssetDetailEditor(asset, target, event.currentTarget)}
                                      data-asset-return-action={`detail-${target}`}
                                      aria-label={`Edit ${label.toLowerCase()} for ${asset.title}. Current value: ${displayedValue}`}
                                    >
                                      <span>{label}</span>
                                      <strong title={title}>{displayedValue}</strong>
                                    </button>
                                  );
                                }

                                return (
                                  <div className={styles.assetDetailRow}>
                                    <span>{label}</span>
                                    <strong title={title}>{displayedValue}</strong>
                                  </div>
                                );
                              };

                              return (
                                <>
                                  <div className={styles.previewWrap}>
                                    <input
                                      id={mediaInputId(asset.id, 'photo')}
                                      type="file"
                                      accept="image/jpeg,image/png,image/webp"
                                      multiple
                                      className={styles.fileInput}
                                      onChange={(event) => { void handleDetailPhotoFilesSelected(asset, event); }}
                                      disabled={isDetailPhotoUploading}
                                    />

                                    <div
                                      className={`${styles.previewStage} ${canInteractWithPhotoStage ? styles.previewStageClickable : ''} ${isDetailPhotoUploading ? styles.assetMediaBusy : ''}`}
                                      role={canInteractWithPhotoStage ? 'button' : undefined}
                                      tabIndex={canInteractWithPhotoStage ? 0 : undefined}
                                      onClick={() => {
                                        if (isDetailPhotoUploading || detailTouchDidSwipeRef.current) {
                                          return;
                                        }

                                        if (canOpenPhotoViewer) {
                                          openPhotoViewer(asset, detailPhotoIndex);
                                          return;
                                        }

                                        if (canUseOwnerOnlyAssetActions) {
                                          triggerDetailMediaInput(asset.id, 'photo');
                                        }
                                      }}
                                      onKeyDown={(event) => {
                                        if (event.target !== event.currentTarget || isDetailPhotoUploading) {
                                          return;
                                        }

                                        if (canOpenPhotoViewer) {
                                          if (event.key === 'Enter' || event.key === ' ') {
                                            event.preventDefault();
                                            openPhotoViewer(asset, detailPhotoIndex);
                                          }

                                          return;
                                        }

                                        if (canUseOwnerOnlyAssetActions) {
                                          handleDetailMediaKeyDown(event, asset.id, 'photo');
                                        }
                                      }}
                                      onTouchStart={(event) => handleDetailPhotoTouchStart(event.changedTouches[0]?.clientX ?? 0)}
                                      onTouchEnd={(event) => handleDetailPhotoTouchEnd(asset, event.changedTouches[0]?.clientX ?? 0)}
                                      aria-label={canOpenPhotoViewer ? 'Open photo viewer' : canUseOwnerOnlyAssetActions ? 'Upload asset photos' : undefined}
                                    >
                                      {hasRealPhotos && detailPhoto ? (
                                        <>
                                          <img src={detailPhoto} alt={`${asset.title} photo ${detailPhotoIndex + 1}`} className={styles.previewImage} />

                                          {hasMultiplePhotos ? (
                                            <>
                                              <button
                                                type="button"
                                                className={`${styles.previewNavButton} ${styles.previewNavPrev}`}
                                                onClick={(event) => {
                                                  event.stopPropagation();
                                                  cycleDetailPhoto(asset, -1);
                                                }}
                                                aria-label="Show previous photo"
                                              >
                                                <ChevronLeftIcon className={styles.buttonIcon} />
                                              </button>

                                              <button
                                                type="button"
                                                className={`${styles.previewNavButton} ${styles.previewNavNext}`}
                                                onClick={(event) => {
                                                  event.stopPropagation();
                                                  cycleDetailPhoto(asset, 1);
                                                }}
                                                aria-label="Show next photo"
                                              >
                                                <ChevronRightIcon className={styles.buttonIcon} />
                                              </button>

                                              <div className={styles.previewCounter}>
                                                {detailPhotoIndex + 1} / {detailPhotos.length}
                                              </div>
                                            </>
                                          ) : null}
                                        </>
                                      ) : (
                                        <div className={styles.previewPlaceholder}>
                                          <div className={styles.previewPlaceholderBadges}>
                                            <span className={`${styles.badge} ${styles.badgeNeutral} ${styles.previewPlaceholderBadge}`}>
                                              {assetFamilyLabel(asset)}
                                            </span>
                                          </div>
                                        </div>
                                      )}

                                      {canUseOwnerOnlyAssetActions ? (
                                        <button
                                          type="button"
                                          className={styles.previewUploadPill}
                                          disabled={isDetailPhotoUploading}
                                          onClick={(event) => {
                                            event.stopPropagation();
                                            triggerDetailMediaInput(asset.id, 'photo');
                                          }}
                                        >
                                          <PlusIcon className={styles.buttonIcon} />
                                          <span>{isDetailPhotoUploading ? 'Uploading...' : hasRealPhotos ? 'Add photos' : 'Upload photos'}</span>
                                        </button>
                                      ) : null}
                                    </div>

                                    {hasMultiplePhotos ? (
                                      <div className={styles.previewThumbRow}>
                                        {detailPhotos.map((photo, index) => {
                                          const isActivePhoto = index === detailPhotoIndex;
                                          return (
                                            <button
                                              type="button"
                                              key={`${asset.id}-detail-photo-${index}`}
                                              className={`${styles.previewThumbButton} ${isActivePhoto ? styles.previewThumbButtonActive : ''}`}
                                              onClick={() => setDetailPhotoIndex(asset.id, index)}
                                              aria-label={`View photo ${index + 1}`}
                                            >
                                              <img src={photo} alt={`${asset.title} thumbnail ${index + 1}`} className={styles.previewThumbImage} />
                                            </button>
                                          );
                                        })}
                                      </div>
                                    ) : null}
                                  </div>

                                  <div className={styles.assetDocumentsPanel}>
                                    <div className={styles.assetDocumentsCardShell}>
                                      {canUseOwnerOnlyAssetActions || canUseAccountantDocumentActions ? (
                                        <button
                                          type="button"
                                          className={`${styles.previewUploadPill} ${styles.assetDocumentsUploadPill}`}
                                          onClick={(event) => {
                                            event.stopPropagation();
                                            openAssetDocumentUpload(asset);
                                          }}
                                          data-asset-return-action="add-document"
                                        >
                                          <PlusIcon className={styles.buttonIcon} />
                                          <span>Add document</span>
                                        </button>
                                      ) : null}

                                      <div className={`${styles.assetDocumentsCard} ${styles.assetDocumentsVaultCard}`}>
                                        <strong className={styles.assetDocumentsSavedCount}>
                                          {isVaultDocumentsLoading
                                            ? 'Loading Documents…'
                                            : `${vaultDocuments.length} Documents`}
                                        </strong>
                                        {detailDocuments.length ? (
                                          <small className={styles.assetDocumentsLegacyCount}>
                                            {detailDocuments.length} earlier saved asset {detailDocuments.length === 1 ? 'file' : 'files'}
                                          </small>
                                        ) : null}
                                        {canUseOwnerOnlyAssetActions ? (
                                          <Link
                                            href={`/documents?assetId=${encodeURIComponent(asset.id)}`}
                                            className={styles.assetDocumentsViewAll}
                                          >
                                            View documents
                                          </Link>
                                        ) : (
                                          <small className={styles.assetDocumentsOwnerNote}>Saved in the owner’s Documents Vault</small>
                                        )}
                                      </div>
                                    </div>

                                    {vaultDocumentsError ? (
                                      <div className={styles.assetDocumentsLoadError} role="status">
                                        <span>{vaultDocumentsError}</span>
                                        <button type="button" onClick={() => { void loadVaultDocuments(asset.id); }}>Retry</button>
                                      </div>
                                    ) : null}

                                    {vaultDocuments.length || detailDocuments.length ? (
                                      <div className={styles.assetDocumentList}>
                                        {vaultDocuments.slice(0, 3).map((document) => (
                                          <a
                                            className={styles.assetDocumentLink}
                                            key={`vault-${document.id}`}
                                            href={assetVaultDocumentDownloadUrl(asset.id, document.id)}
                                            target="_blank"
                                            rel="noreferrer"
                                            title={`Open ${document.fileName}`}
                                          >
                                            <DocumentIcon className={styles.buttonIcon} />
                                            <span>{getAccountDocumentTypeLabel(document.documentType) ?? ACCOUNT_DOCUMENT_CATEGORY_LABELS[document.category]} · {document.title}</span>
                                          </a>
                                        ))}
                                        {detailDocuments.slice(0, Math.max(0, 3 - vaultDocuments.length)).map((document, documentIndex) => (
                                          <button
                                            type="button"
                                            className={styles.assetDocumentLink}
                                            key={`legacy-${document.id}`}
                                            onClick={() => { void openAssetDocument(document); }}
                                            title={`Open ${document.fileName}`}
                                          >
                                            <DocumentIcon className={styles.buttonIcon} />
                                            <span>Saved asset file · {displayDocumentName(document.fileName, documentIndex)}</span>
                                          </button>
                                        ))}
                                        {vaultDocuments.length > 3 && canUseOwnerOnlyAssetActions ? (
                                          <Link
                                            href={`/documents?assetId=${encodeURIComponent(asset.id)}`}
                                            className={`${styles.assetDocumentLink} ${styles.assetDocumentMoreLink}`}
                                          >
                                            <DocumentIcon className={styles.buttonIcon} />
                                            <span>View all {vaultDocuments.length} files in Documents</span>
                                          </Link>
                                        ) : null}
                                      </div>
                                    ) : null}
                                  </div>

                                  <div className={styles.assetDetailDivider} aria-hidden="true" />

                                  <div className={styles.assetDetailsPanel}>
                                    <div className={styles.assetDetailsGrid}>
                                      <div className={styles.assetPrimaryDetails}>
                                        {asset.kind !== 'property' ? (
                                          renderAssetDetailRow('serial', 'Serial', asset.serialNumber, asset.serialNumber || 'Not provided')
                                        ) : null}
                                        {renderAssetDetailRow(
                                          'year',
                                          asset.kind === 'property' ? PROPERTY_YEAR_LABEL : 'Year',
                                          asset.yearModel ? String(asset.yearModel) : '',
                                          asset.yearModel ? String(asset.yearModel) : 'Not provided',
                                        )}
                                        {asset.kind === 'property' ? (
                                          <div className={styles.assetDetailRow}>
                                            <span>Size</span>
                                            <strong title={propertySizeDisplay(asset)}>{propertySizeDisplay(asset)}</strong>
                                          </div>
                                        ) : (
                                          renderAssetDetailRow('usage', 'Usage', buildAssetUsageValue(asset))
                                        )}
                                        {renderAssetDetailRow(
                                          'condition',
                                          'Condition',
                                          conditionLabel(asset.condition),
                                          conditionLabel(asset.condition) || 'Not provided',
                                        )}
                                      </div>

                                      <div className={styles.assetStatusDetails}>
                                        {canUseOwnerOnlyAssetActions ? (
                                          <button
                                            type="button"
                                            className={`${styles.assetStatusRow} ${styles.assetStatusRowButton}`}
                                            onClick={(event) => openQuickAssetStatusEditor(asset, 'finance', event.currentTarget)}
                                            data-asset-return-action="status-finance"
                                            aria-label={`Update finance status for ${asset.title}`}
                                          >
                                            <span>Financed</span>
                                            {renderAssetStatusMark(readFinanceStatusChoice(asset))}
                                          </button>
                                        ) : (
                                          <div className={styles.assetStatusRow}>
                                            <span>Financed</span>
                                            {renderAssetStatusMark(readFinanceStatusChoice(asset))}
                                          </div>
                                        )}

                                        {canUseOwnerOnlyAssetActions ? (
                                          <button
                                            type="button"
                                            className={`${styles.assetStatusRow} ${styles.assetStatusRowButton}`}
                                            onClick={(event) => openQuickAssetStatusEditor(asset, 'insurance', event.currentTarget)}
                                            data-asset-return-action="status-insurance"
                                            aria-label={`Update insurance status for ${asset.title}`}
                                          >
                                            <span>Insured</span>
                                            {renderAssetStatusMark(readInsuranceStatusChoice(asset))}
                                          </button>
                                        ) : (
                                          <div className={styles.assetStatusRow}>
                                            <span>Insured</span>
                                            {renderAssetStatusMark(readInsuranceStatusChoice(asset))}
                                          </div>
                                        )}

                                        {asset.kind !== 'property' ? (
                                          canUseOwnerOnlyAssetActions ? (
                                            <button
                                              type="button"
                                              className={`${styles.assetStatusRow} ${styles.assetStatusRowButton}`}
                                              onClick={(event) => openQuickAssetStatusEditor(asset, 'license', event.currentTarget)}
                                              data-asset-return-action="status-license"
                                              aria-label={`Update license status for ${asset.title}`}
                                            >
                                              <span>Licensed</span>
                                              {renderAssetStatusMark(licenseStatus)}
                                            </button>
                                          ) : (
                                            <div className={styles.assetStatusRow}>
                                              <span>Licensed</span>
                                              {renderAssetStatusMark(licenseStatus)}
                                            </div>
                                          )
                                        ) : null}

                                        {canUseOwnerOnlyAssetActions ? (
                                          <button
                                            type="button"
                                            className={`${styles.assetStatusRow} ${styles.assetStatusRowButton}`}
                                            onClick={(event) => openMappedStatusEditor(asset, event.currentTarget)}
                                            data-asset-return-action="status-mapped"
                                            aria-label={`Update mapped location status for ${asset.title}`}
                                          >
                                            <span>Mapped</span>
                                            {renderAssetStatusMark(mappedStatus)}
                                          </button>
                                        ) : (
                                          <div className={styles.assetStatusRow}>
                                            <span>Mapped</span>
                                            {renderAssetStatusMark(mappedStatus)}
                                          </div>
                                        )}
                                      </div>
                                    </div>

                                    <div className={styles.assetValueBubbleStack}>
                                      <div className={styles.assetReplacementPriceBubble}>
                                        <span>Replacement Price</span>
                                        <strong>{readAssetReplacementPriceExVat(asset) ? money(readAssetReplacementPriceExVat(asset) ?? 0) : 'Not set'}</strong>
                                        <small>Excl. VAT</small>
                                      </div>

                                      {insuredValueExVat !== null ? (
                                        <div className={styles.assetInsuredValueBubble}>
                                          <span>Insured For</span>
                                          <strong>{money(insuredValueExVat)}</strong>
                                          <small>Excl. VAT</small>
                                        </div>
                                      ) : null}

                                      {registrationNumber ? (
                                        <div className={styles.assetRegistrationNumberBubble}>
                                          <span>Registration No</span>
                                          <strong>{registrationNumber}</strong>
                                        </div>
                                      ) : null}
                                    </div>
                                  </div>

                                  {manualAssetNote ? (
                                    <div className={`${styles.noteStack} ${styles.assetManualNotePanel}`}>
                                      <p className={styles.note}>{manualAssetNote}</p>
                                    </div>
                                  ) : null}
                                </>
                              );
                            })()}
                          </div>
                        ) : null}
                        </article>
                      </div>
                    );
                  })}
                </div>

                {filteredAssets.length > 0 ? (
                  <div className={styles.paginationBar}>
                    <div className={styles.paginationInfo}>
                      <div className={styles.paginationMeta}>
                        Page {safeCurrentPage} of {pageCount}
                      </div>

                      <div className={styles.pageSizeControls} aria-label="Standalone assets per page">
                        <span>{hasGroupedPaginationEntries ? 'Show standalone' : 'Show'}</span>
                        <div className={styles.pageSizeButtonGroup}>
                          {PAGE_SIZE_OPTIONS.map((option) => (
                            <button
                              type="button"
                              key={option}
                              className={`${styles.paginationButton} ${styles.pageSizeButton} ${pageSize === option ? styles.pageSizeButtonActive : ''}`}
                              onClick={() => handlePageSizeChange(option)}
                              aria-pressed={pageSize === option}
                            >
                              {option}
                            </button>
                          ))}
                          <button
                            type="button"
                            className={`${styles.paginationButton} ${styles.pageSizeButton} ${pageSize === 'all' ? styles.pageSizeButtonActive : ''}`}
                            onClick={() => handlePageSizeChange('all')}
                            aria-pressed={pageSize === 'all'}
                          >
                            All
                          </button>
                        </div>
                      </div>
                    </div>

                    {pageCount > 1 ? (
                      <div className={styles.paginationActions}>
                        <button
                          type="button"
                          className={styles.paginationButton}
                          onClick={() => setCurrentPage((current) => Math.max(1, current - 1))}
                          disabled={safeCurrentPage === 1}
                        >
                          <ChevronLeftIcon className={styles.buttonIcon} />
                          <span>Previous</span>
                        </button>

                        {paginationItems.map((item, index) =>
                          item === 'ellipsis' ? (
                            <span className={styles.paginationEllipsis} key={`ellipsis-${index}`}>
                              …
                            </span>
                          ) : (
                            <button
                              type="button"
                              key={item}
                              className={`${styles.paginationButton} ${item === safeCurrentPage ? styles.paginationButtonActive : ''}`}
                              onClick={() => setCurrentPage(item)}
                            >
                              {item}
                            </button>
                          ),
                        )}

                        <button
                          type="button"
                          className={styles.paginationButton}
                          onClick={() => setCurrentPage((current) => Math.min(pageCount, current + 1))}
                          disabled={safeCurrentPage === pageCount}
                        >
                          <span>Next</span>
                          <ChevronRightIcon className={styles.buttonIcon} />
                        </button>
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </>
            ) : (
              <div className={styles.emptyState}>
                <h3>No assets match your search or filter</h3>
                <p>Try a broader term, choose another filter, or clear both to see the full register again.</p>
                <div className={styles.emptyStateActions}>
                  <button
                    type="button"
                    className={styles.secondaryButton}
                    onClick={() => {
                      setSearchTerm('');
                      clearAssetFilter();
                    }}
                  >
                    Clear search and filter
                  </button>
                </div>
              </div>
            )
          ) : !isLoading ? (
            <div className={styles.emptyState}>
              <h3>No assets saved yet</h3>
              <p>Run a valuation or add a manual asset to start building your register.</p>
              {canAddAssetsToActiveRegister ? (
                <div className={styles.emptyStateActions}>
                  {isCombinedRegisterView ? (
                    <button type="button" className={styles.secondaryButton} onClick={openAddAssetChoiceModal}>
                      Go to valuation
                    </button>
                  ) : (
                    <Link href={addAssetValuationHref} className={styles.secondaryButton}>
                      Go to valuation
                    </Link>
                  )}
                  <button type="button" className={styles.primaryButton} onClick={openAddAssetChoiceModal}>
                    <PlusIcon className={styles.buttonIcon} />
                    <span>Add Asset</span>
                  </button>
                </div>
              ) : null}
            </div>
          ) : null}
        </section>
      </section>

      {photoViewerAsset && photoViewerPhoto ? (
        <div className={`${styles.modalOverlay} ${styles.photoViewerOverlay}`}>
          <div className={styles.modalBackdrop} onClick={closePhotoViewer} />

          <div
            className={styles.photoViewerModal}
            role="dialog"
            aria-modal="true"
            aria-label={`${photoViewerAsset.title} photo viewer`}
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              className={styles.photoViewerCloseButton}
              onClick={closePhotoViewer}
              aria-label="Close photo viewer"
            >
              <CloseIcon className={styles.buttonIcon} />
            </button>

            <div className={styles.photoViewerStage}>
              <img
                src={photoViewerPhoto}
                alt={`${photoViewerAsset.title} photo ${photoViewerIndex + 1}`}
                className={styles.photoViewerImage}
              />

              {hasMultiplePhotoViewerPhotos ? (
                <>
                  <button
                    type="button"
                    className={`${styles.photoViewerNavButton} ${styles.photoViewerNavPrev}`}
                    onClick={() => cyclePhotoViewerPhoto(-1)}
                    aria-label="Show previous photo"
                  >
                    <ChevronLeftIcon className={styles.buttonIcon} />
                  </button>

                  <button
                    type="button"
                    className={`${styles.photoViewerNavButton} ${styles.photoViewerNavNext}`}
                    onClick={() => cyclePhotoViewerPhoto(1)}
                    aria-label="Show next photo"
                  >
                    <ChevronRightIcon className={styles.buttonIcon} />
                  </button>

                  <div className={styles.photoViewerCounter}>
                    {photoViewerIndex + 1} / {photoViewerPhotos.length}
                  </div>
                </>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      {isRegisterShareModalOpen ? (
        <div className={styles.modalOverlay}>
          <div className={styles.modalBackdrop} onClick={closeRegisterShareModal} />

          <div
            className={`${styles.optionsModal} ${styles.assetQuoteModal} ${styles.registerShareModal} ${assetShareDestination === 'choice' ? styles.assetShareDestinationModal : ''} ${assetShareDestination === 'inside' ? styles.assetShareInsideModal : ''} ${assetShareDestination === 'outside' ? styles.externalAssetShareModal : ''}`}
            role="dialog"
            aria-modal="true"
            aria-labelledby="asset-register-share-title"
          >
            <div className={`${styles.modalHeader} ${styles.optionsModalHeader} ${styles.assetQuoteModalHeader} ${styles.registerShareModalHeader}`}>
              <div className={styles.modalHeaderText}>
                <h3 id="asset-register-share-title" tabIndex={-1}>{assetShareDestination === 'inside'
                  ? 'Share inside Aim4price'
                  : assetShareDestination === 'outside'
                    ? 'Share outside Aim4price'
                    : `Share ${activeShareName}`}</h3>
                <p>{assetShareDestination === 'choice'
                  ? 'Choose where to share. Keep it inside Aim4price or send a ready-to-read message outside.'
                  : assetShareDestination === 'outside'
                    ? `Send ${isAssetGroupShare ? 'these grouped assets' : 'the saved register details'} through WhatsApp or email.`
                    : isAssetGroupShare
                      ? `Share this umbrella and its ${activeShareAssets.length} linked ${activeShareAssets.length === 1 ? 'asset' : 'assets'}. Unrelated assets stay private.`
                      : 'Choose who to share with. Each partner sees only what they need.'}</p>
              </div>

              <button
                type="button"
                className={styles.modalCloseButton}
                onClick={closeRegisterShareModal}
                aria-label="Close register share options"
                disabled={isExporting || isSendingQuoteLead}
              >
                <CloseIcon className={styles.buttonIcon} />
              </button>
            </div>

            <div className={`${styles.modalScrollBody} ${styles.optionsScrollBody} ${styles.assetQuoteScrollBody} ${styles.registerShareModalBody}`}>
              {assetShareDestination === 'choice' ? (
                <AssetShareDestinationPicker
                  onInside={() => setAssetShareDestination('inside')}
                  onOutside={() => setAssetShareDestination('outside')}
                  disabled={isExporting || isSendingQuoteLead}
                />
              ) : assetShareDestination === 'outside' ? (
                <AssetExternalShare
                  shareName={activeShareName}
                  assets={activeExternalShareAssets}
                  onBack={() => setAssetShareDestination('choice')}
                />
              ) : (
                <div className={styles.assetShareInsideFlow}>
                  <button type="button" className={styles.assetQuoteBackButton} onClick={() => setAssetShareDestination('choice')}>
                    <ChevronLeftIcon className={styles.buttonIcon} />
                    <span>Back</span>
                  </button>

                  <div className={styles.optionsContent}>
                    <div className={`${styles.optionsGrid} ${styles.assetOptionsGrid} ${styles.assetQuoteChoiceGrid} ${styles.registerShareOptionGrid}`}>
                      <button
                        type="button"
                        className={`${styles.optionActionButton} ${styles.assetQuoteChoiceCard} ${styles.registerShareOptionCard} ${quoteToneClassForLeadType('finance')}`}
                        onClick={() => openFullRegisterQuotePartnerPicker('finance')}
                        disabled={isExporting}
                      >
                        <span className={styles.assetQuoteChoiceIconTile}>
                          {renderQuoteOptionIcon('finance', styles.assetQuoteChoiceIcon)}
                        </span>
                        <span className={styles.assetQuoteChoiceText}>
                          <strong>Finance &amp; accounting</strong>
                          <small><span>Share with an accountant, financier or bank.</span></small>
                        </span>
                      </button>

                      <button
                        type="button"
                        className={`${styles.optionActionButton} ${styles.assetQuoteChoiceCard} ${styles.registerShareOptionCard} ${quoteToneClassForLeadType('insurance')}`}
                        onClick={() => openFullRegisterQuotePartnerPicker('insurance')}
                        disabled={isExporting}
                      >
                        <span className={styles.assetQuoteChoiceIconTile}>
                          {renderQuoteOptionIcon('insurance', styles.assetQuoteChoiceIcon)}
                        </span>
                        <span className={styles.assetQuoteChoiceText}>
                          <strong>Insurance</strong>
                          <small><span>Share with an insurer or broker.</span></small>
                        </span>
                      </button>

                      <button
                        type="button"
                        className={`${styles.optionActionButton} ${styles.assetQuoteChoiceCard} ${styles.registerShareOptionCard} ${quoteToneClassForLeadType('replacement_quote')}`}
                        onClick={() => openFullRegisterQuotePartnerPicker('replacement_quote')}
                        disabled={isExporting}
                      >
                        <span className={styles.assetQuoteChoiceIconTile}>
                          {renderQuoteOptionIcon('replacement_quote', styles.assetQuoteChoiceIcon)}
                        </span>
                        <span className={styles.assetQuoteChoiceText}>
                          <strong>Dealer</strong>
                          <small><span>{isAssetGroupShare ? 'Share every grouped asset with a dealer.' : 'Choose assets to share with a dealer.'}</span></small>
                        </span>
                      </button>

                      <button
                        type="button"
                        className={`${styles.optionActionButton} ${styles.assetQuoteChoiceCard} ${styles.registerShareOptionCard} ${quoteToneClassForLeadType('license_renewal')}`}
                        onClick={() => openFullRegisterQuotePartnerPicker('license_renewal')}
                        disabled={isExporting}
                      >
                        <span className={styles.assetQuoteChoiceIconTile}>
                          {renderQuoteOptionIcon('license_renewal', styles.assetQuoteChoiceIcon)}
                        </span>
                        <span className={styles.assetQuoteChoiceText}>
                          <strong>Licence renewal</strong>
                          <small><span>Only assets with a renewal date can be shared.</span></small>
                        </span>
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}

      {isSummaryModalOpen ? (
        <div className={`${styles.modalOverlay} ${styles.summaryModalOverlay}`}>
          <div className={styles.modalBackdrop} onClick={closeSummaryModal} />

          <div className={`${styles.modalCard} ${styles.summaryModal}`} role="dialog" aria-modal="true" aria-labelledby="asset-register-summary-title">
            <div className={`${styles.modalHeader} ${styles.summaryModalHeader}`}>
              <div className={styles.modalHeaderText}>
                <h3 id="asset-register-summary-title">Register summary</h3>
              </div>

              <div className={styles.summaryHeaderActions}>
                <button
                  type="button"
                  className={`${styles.secondaryButton} ${styles.summaryDownloadButton}`}
                  onClick={handleDownloadRegisterSummary}
                  disabled={isLoading || isExporting}
                >
                  <PdfIcon className={styles.buttonIcon} />
                  <span>Download PDF</span>
                </button>

                <button
                  type="button"
                  className={styles.modalCloseButton}
                  onClick={closeSummaryModal}
                  aria-label="Close register summary"
                >
                  <CloseIcon className={styles.buttonIcon} />
                </button>
              </div>
            </div>

            <div className={styles.summaryModalBody}>
              {registerSummarySections.map((section) => (
                <section key={section.title} className={styles.summaryPanel} aria-label={section.title}>
                  <div className={styles.summarySectionHeader}>
                    <div>
                      <span>{section.title}</span>
                      <p>{section.description}</p>
                    </div>
                  </div>

                  <div className={`${styles.summarySimpleTable} ${section.hasValueColumn === false ? styles.summarySimpleTableCountOnly : ''}`}>
                    <div className={styles.summarySimpleTableHeader} aria-hidden="true">
                      <span>Metric</span>
                      <span>Count</span>
                      {section.hasValueColumn === false ? null : <span>Value excl. VAT</span>}
                      {section.hasValueColumn === false ? null : <span>Value incl. VAT</span>}
                    </div>

                    <div className={styles.summarySimpleTableRows}>
                      {section.rows.map((row) => (
                        <div key={row.label} className={styles.summarySimpleTableRow}>
                          <span>{row.label}</span>
                          <strong>{row.count ?? ''}</strong>
                          {section.hasValueColumn === false ? null : <small>{row.valueExVat ?? ''}</small>}
                          {section.hasValueColumn === false ? null : <b>{row.valueInclVat ?? ''}</b>}
                        </div>
                      ))}
                    </div>
                  </div>
                </section>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      {isAddAssetDestinationModalOpen ? (
        <div className={styles.modalOverlay}>
          <div className={styles.modalBackdrop} onClick={closeAddAssetDestinationModal} />

          <div
            className={`${styles.modalCard} ${styles.addAssetDestinationModal}`}
            role="dialog"
            aria-modal="true"
            aria-labelledby="add-asset-destination-title"
          >
            <div className={`${styles.modalHeader} ${styles.addAssetDestinationHeader}`}>
              <div className={styles.modalHeaderText}>
                <h3 id="add-asset-destination-title">Choose an Asset Register</h3>
                <p>The combined register is a view. Choose which Asset Register should own the new asset.</p>
              </div>

              <button
                type="button"
                className={styles.modalCloseButton}
                onClick={closeAddAssetDestinationModal}
                aria-label="Close Asset Register selection"
              >
                <CloseIcon className={styles.buttonIcon} />
              </button>
            </div>

            <div className={styles.addAssetDestinationBody}>
              <ModalSelect<string>
                label="Asset Register"
                value={addAssetTargetRegisterId}
                options={addAssetRegisterOptions}
                onChange={(value) => {
                  setAddAssetTargetRegisterId(value);
                  setNotice(null);
                }}
                placeholder="Choose the owning Asset Register"
                className={styles.addAssetDestinationField}
                autoFocus
                usePortal
              />
            </div>

            <div className={styles.addAssetDestinationFooter}>
              <button type="button" className={styles.secondaryButton} onClick={closeAddAssetDestinationModal}>Cancel</button>
              <button type="button" className={styles.primaryButton} onClick={continueAddAssetForRegister} disabled={!addAssetTargetRegisterId}>
                <span>Continue</span>
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {isAddChoiceModalOpen ? (
        <div className={styles.modalOverlay}>
          <div className={styles.modalBackdrop} onClick={closeAddAssetChoiceModal} />

          <div
            className={`${styles.modalCard} ${styles.addAssetChoiceModal}`}
            role="dialog"
            aria-modal="true"
            aria-labelledby="add-asset-choice-title"
          >
            <div className={`${styles.modalHeader} ${styles.addAssetChoiceHeader}`}>
              <div className={styles.modalHeaderText}>
                <h3 id="add-asset-choice-title">Choose how to add an asset</h3>
                <p>Start with an Aim4price valuation, or add a manually priced asset.</p>
              </div>

              <button
                type="button"
                className={styles.modalCloseButton}
                onClick={closeAddAssetChoiceModal}
                aria-label="Close add asset options"
              >
                <CloseIcon className={styles.buttonIcon} />
              </button>
            </div>

            <div className={styles.addAssetChoiceGrid}>
              <Link href={addAssetValuationHref} className={`${styles.addAssetChoiceButton} ${styles.addAssetChoiceButtonPrimary}`}>
                <TrendIcon className={styles.buttonIcon} />
                <span>
                  <strong>Aim4price Value</strong>
                </span>
              </Link>

              <button type="button" className={styles.addAssetChoiceButton} onClick={openManualEntryFromChoice}>
                <DocumentIcon className={styles.buttonIcon} />
                <span>
                  <strong>Manual Entry</strong>
                </span>
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {isAcquisitionChoiceOpen ? (
        <div className={styles.modalOverlay}>
          <div className={styles.modalBackdrop} onClick={() => setIsAcquisitionChoiceOpen(false)} />
          <div className={`${styles.modalCard} ${styles.assetLifecycleModal} ${styles.newAcquisitionChoiceModal}`} role="dialog" aria-modal="true" aria-labelledby="new-acquisition-title">
            <div className={`${styles.modalHeader} ${styles.newAcquisitionChoiceHeader}`}>
              <div className={styles.modalHeaderText}>
                <h3 id="new-acquisition-title">Newly acquired asset?</h3>
                <p>Choose how this asset entered the register.</p>
              </div>
              <button type="button" className={styles.modalCloseButton} onClick={() => setIsAcquisitionChoiceOpen(false)} aria-label="Close acquisition question">
                <CloseIcon className={styles.buttonIcon} />
              </button>
            </div>
            <div className={`${styles.modalScrollBody} ${styles.assetLifecycleBody} ${styles.newAcquisitionChoiceBody}`}>
              <div className={`${styles.addAssetChoiceGrid} ${styles.newAcquisitionChoiceGrid}`}>
                <button
                  type="button"
                  className={`${styles.addAssetChoiceButton} ${styles.newAcquisitionChoiceOption} ${newAssetAcquisitionDraft.newlyAcquired === true ? styles.addAssetChoiceButtonPrimary : ''}`}
                  onClick={() => setNewAssetAcquisitionDraft((current) => ({ ...current, newlyAcquired: true }))}
                  aria-pressed={newAssetAcquisitionDraft.newlyAcquired === true}
                >
                  <span className={styles.newAcquisitionChoiceIndicator} aria-hidden="true" />
                  <strong>Newly acquired</strong>
                </button>
                <button
                  type="button"
                  className={`${styles.addAssetChoiceButton} ${styles.newAcquisitionChoiceOption} ${newAssetAcquisitionDraft.newlyAcquired === false ? styles.addAssetChoiceButtonPrimary : ''}`}
                  onClick={() => setNewAssetAcquisitionDraft((current) => ({ ...current, newlyAcquired: false }))}
                  aria-pressed={newAssetAcquisitionDraft.newlyAcquired === false}
                >
                  <span className={styles.newAcquisitionChoiceIndicator} aria-hidden="true" />
                  <strong>Existing asset</strong>
                </button>
              </div>

              {newAssetAcquisitionDraft.newlyAcquired === true ? (
                <div className={styles.assetLifecycleFields}>
                  <label className={styles.assetSettingsField}>
                    <span>Acquisition date</span>
                    <input type="date" value={newAssetAcquisitionDraft.acquisitionDate} onChange={(event) => setNewAssetAcquisitionDraft((current) => ({ ...current, acquisitionDate: event.target.value }))} required />
                  </label>
                  <label className={styles.assetSettingsField}>
                    <span>Purchase or acquisition amount <small>Optional, excl. VAT</small></span>
                    <input inputMode="decimal" value={newAssetAcquisitionDraft.acquisitionAmountExVat} onChange={(event) => setNewAssetAcquisitionDraft((current) => ({ ...current, acquisitionAmountExVat: event.target.value }))} placeholder="R 0" />
                  </label>
                  <label className={styles.assetSettingsField}>
                    <span>Note or source <small>Optional</small></span>
                    <textarea value={newAssetAcquisitionDraft.note} onChange={(event) => setNewAssetAcquisitionDraft((current) => ({ ...current, note: event.target.value }))} placeholder="Purchase reference or source note" />
                  </label>
                </div>
              ) : null}
              <div className={`${styles.assetSettingsActions} ${styles.newAcquisitionChoiceActions}`}>
                <button type="button" className={styles.secondaryButton} onClick={() => setIsAcquisitionChoiceOpen(false)}>Cancel</button>
                <button type="button" className={styles.primaryButton} onClick={continueManualEntryFromAcquisitionChoice} disabled={newAssetAcquisitionDraft.newlyAcquired === null}>Continue</button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {isAssetModalOpen ? (
        <div className={styles.modalOverlay}>
          <div className={styles.modalBackdrop} onClick={() => { if (!isAssetAutosaveBusy) closeAssetModal(); }} />

          <div
            className={`${styles.modalCard} ${styles.assetFormModal} ${manualAssetStep > 1 ? styles.assetUpdateModal : ''} ${manualAssetStep === 1 ? styles.assetFormModalStepOne : ''}`}
            role="dialog"
            aria-modal="true"
            aria-label={editingAsset ? 'Update asset' : 'Add asset'}
          >
            <div className={`${styles.modalHeader} ${styles.assetFormModalHeader} ${styles.manualWizardHeader} ${styles.assetFormModalChromeHeader}`}>
              {manualAssetStep === 1 ? (
                <div className={styles.modalHeaderText}>
                  <h3>{editingAsset ? 'Update asset' : 'Add an asset'}</h3>
                  <p>Choose the asset type that best matches what you are adding.</p>
                </div>
              ) : (
                <div className={styles.assetUpdateHeaderContent}>
                  <div className={styles.assetUpdateIdentity}>
                    <h3>
                      {assetDraft.title.trim() ||
                        (editingAsset ? editingAsset.title : `Add ${selectedManualAssetType.label.toLowerCase()}`)}
                    </h3>
                  </div>
                </div>
              )}

              <button
                type="button"
                className={styles.modalCloseButton}
                onClick={closeAssetModal}
                aria-label="Close asset form"
                disabled={isAssetAutosaveBusy}
              >
                <CloseIcon className={styles.buttonIcon} />
              </button>
            </div>

            <div className={`${styles.modalScrollBody} ${styles.manualStepScrollBody} ${manualAssetStep === 1 ? styles.manualStepScrollBodyNoScroll : ''}`}>
              {manualAssetStep > 1 ? (
                <nav className={styles.assetFormSectionTabs} aria-label="Asset form sections">
                  {ASSET_FORM_SECTION_TABS.map((section, index) => {
                    const isActive = manualAssetStep === section.step;

                    return (
                      <button
                        type="button"
                        key={section.step}
                        className={`${styles.assetFormSectionTab} ${isActive ? styles.assetFormSectionTabActive : ''}`}
                        onClick={() => openAssetFormSection(section.step)}
                        aria-current={isActive ? 'step' : undefined}
                      >
                        <span className={styles.assetFormSectionTabNumber}>{index + 1}</span>
                        <span className={styles.assetFormSectionTabCopy}>
                          <strong>{section.label}</strong>
                        </span>
                      </button>
                    );
                  })}
                </nav>
              ) : null}

              <form className={`${styles.modalForm} ${styles.manualAssetForm} ${styles.manualStepForm}`} onSubmit={(event) => event.preventDefault()}>
                {manualAssetStep === 1 ? (
                  <section className={`${styles.manualStageCard} ${styles.manualSingleStageCard} ${styles.manualCompactStageCard} ${styles.manualStepOneCard} ${styles.fullWidth}`}>
                    <div className={styles.manualStepIntro}>
                      <h4>What are you adding?</h4>
                    </div>

                    {editingAsset?.valuationRunId ? (
                      <label className={`${styles.field} ${styles.assetTypeField} ${styles.manualLockedTypeCard}`}>
                        <span>Asset type</span>
                        <input value={kindLabel(editingAsset.kind)} disabled readOnly />
                      </label>
                    ) : (
                      <div className={styles.manualAssetTypeGrid} role="group" aria-label="Choose an asset type">
                        {MANUAL_ASSET_TYPE_OPTIONS.map((option, index) => {
                          const isSelected = hasManualAssetKindSelection && assetFormKind === option.value;

                          return (
                            <button
                              type="button"
                              key={option.value}
                              className={`${styles.manualAssetTypeCard} ${isSelected ? styles.manualAssetTypeCardSelected : ''}`}
                              onClick={() => selectManualAssetKind(option.value, true)}
                              aria-pressed={isSelected}
                              autoFocus={index === 0}
                            >
                              <span className={styles.manualAssetTypeIcon}>
                                {renderManualAssetTypeIcon(option.value, styles.buttonIcon)}
                              </span>

                              <span className={styles.manualAssetTypeCopy}>
                                <strong>{option.label}</strong>
                                <small>{option.description}</small>
                              </span>

                              <span className={styles.manualAssetTypeArrow} aria-hidden="true">
                                <ChevronRightIcon className={styles.buttonIcon} />
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </section>
                ) : null}

                {manualAssetStep === 2 ? (
                  <section className={`${styles.manualStageCard} ${styles.manualSingleStageCard} ${styles.manualCompactStageCard} ${styles.assetUpdateStageCard} ${styles.fullWidth}`}>
                    <div className={styles.manualUtilityRow}>
                      <div className={styles.manualSelectedTypeStrip}>
                        <span>{editingAsset ? 'Type' : 'Type of Asset:'}</span>
                        <strong>{selectedManualAssetType.label}</strong>
                      </div>

                      <button
                        type="button"
                        className={styles.manualSettingsButton}
                        onClick={editingAsset ? openAssetSettingsModal : () => setManualAssetStep(1)}
                        aria-label={editingAsset ? 'Asset settings' : 'Change asset type'}
                        title={editingAsset ? 'Asset settings' : 'Change asset type'}
                      >
                        <ManageIcon className={styles.buttonIcon} />
                        <span>{editingAsset ? 'Settings' : 'Change type'}</span>
                      </button>
                    </div>

                    <div className={`${styles.assetFormDetailsStack} ${updateStyles.detailsStack}`}>
                      <div className={styles.assetTitleRow}>
                        <label className={`${styles.field} ${styles.manualTitleField}`}>
                          <span>Asset title</span>
                          <input
                            value={assetDraft.title}
                            onChange={(event) =>
                              setAssetDraft((current) => ({
                                ...current,
                                title: event.target.value,
                              }))
                            }
                            placeholder={selectedManualAssetType.titlePlaceholder}
                            autoFocus
                          />
                        </label>
                      </div>

                      {assetFormKind === 'manual' || assetFormKind === 'property' || assetFormKind === 'stock' ? (
                        <div className={styles.assetInsuranceClassificationCard}>
                          <div className={styles.assetInsuranceClassificationIntro}>
                            <strong>Tell us more about this asset</strong>
                            <p>
                              These details help Aim4price organise the asset correctly and prepare clearer records and reports.
                              If the register is shared for insurance, Aim4price may suggest areas for a broker to review, but the
                              broker still confirms the final classification and cover.
                            </p>
                          </div>

                          <div className={styles.assetInsuranceClassificationGrid}>
                            {assetFormKind === 'manual' ? (
                              <>
                                <ModalSelect<GeneralAssetCategoryKey>
                                  label="What is it? *"
                                  value={assetDraft.generalAssetCategory}
                                  options={GENERAL_ASSET_CATEGORY_OPTIONS}
                                  onChange={(generalAssetCategory) =>
                                    setAssetDraft((current) => ({
                                      ...current,
                                      generalAssetCategory,
                                      insuranceMobility:
                                        generalAssetCategory === 'portable_electronics' && !current.insuranceMobility
                                          ? 'portable'
                                          : current.insuranceMobility,
                                      insuranceTemperatureSensitiveStock:
                                        generalAssetCategory === 'commercial_refrigeration'
                                          ? current.insuranceTemperatureSensitiveStock
                                          : 'unknown',
                                    }))
                                  }
                                  placeholder="Choose the closest match"
                                  usePortal
                                />

                                <ModalSelect<InsuranceUseContext>
                                  label="Where is it used? *"
                                  value={assetDraft.insuranceUseContext}
                                  options={INSURANCE_USE_CONTEXT_OPTIONS}
                                  onChange={(insuranceUseContext) =>
                                    setAssetDraft((current) => ({ ...current, insuranceUseContext }))
                                  }
                                  placeholder="Choose home or business use"
                                  usePortal
                                />

                                <ModalSelect<InsuranceMobility>
                                  label="Does it move around? *"
                                  value={assetDraft.insuranceMobility}
                                  options={INSURANCE_MOBILITY_OPTIONS}
                                  onChange={(insuranceMobility) =>
                                    setAssetDraft((current) => ({ ...current, insuranceMobility }))
                                  }
                                  placeholder="Choose how the item is used"
                                  usePortal
                                />

                                <ModalSelect<InsuranceFactAnswer>
                                  label="Critical to operations?"
                                  value={assetDraft.insuranceCriticalToOperations}
                                  options={INSURANCE_CRITICALITY_OPTIONS}
                                  onChange={(insuranceCriticalToOperations) =>
                                    setAssetDraft((current) => ({ ...current, insuranceCriticalToOperations }))
                                  }
                                  usePortal
                                />

                                {assetDraft.generalAssetCategory === 'commercial_refrigeration' ? (
                                  <ModalSelect<InsuranceFactAnswer>
                                    label="Protects temperature-sensitive stock?"
                                    value={assetDraft.insuranceTemperatureSensitiveStock}
                                    options={TEMPERATURE_SENSITIVE_STOCK_OPTIONS}
                                    onChange={(insuranceTemperatureSensitiveStock) =>
                                      setAssetDraft((current) => ({ ...current, insuranceTemperatureSensitiveStock }))
                                    }
                                    usePortal
                                  />
                                ) : null}
                              </>
                            ) : null}

                            {assetFormKind === 'property' ? (
                              <>
                                <ModalSelect<PropertyAssetSubtypeKey>
                                  label="What kind of property is this? *"
                                  value={assetDraft.propertyAssetSubtype}
                                  options={PROPERTY_ASSET_SUBTYPE_OPTIONS}
                                  onChange={(propertyAssetSubtype) =>
                                    setAssetDraft((current) => ({
                                      ...current,
                                      propertyAssetSubtype,
                                      yearModel: propertyAssetSubtype === 'land' ? '' : current.yearModel,
                                      replacementPrice: propertyAssetSubtype === 'land' ? '' : current.replacementPrice,
                                      condition: propertyAssetSubtype === 'land' ? '' : current.condition,
                                      propertyInterest:
                                        propertyAssetSubtype === 'tenant_improvement' && !current.propertyInterest
                                          ? 'tenant_improvement'
                                          : current.propertyInterest,
                                    }))
                                  }
                                  placeholder="Choose the closest property type"
                                  usePortal
                                />

                                <ModalSelect<InsuranceUseContext>
                                  label="How is it used? *"
                                  value={assetDraft.insuranceUseContext}
                                  options={INSURANCE_USE_CONTEXT_OPTIONS}
                                  onChange={(insuranceUseContext) =>
                                    setAssetDraft((current) => ({ ...current, insuranceUseContext }))
                                  }
                                  placeholder="Choose home or business use"
                                  usePortal
                                />

                                <ModalSelect<PropertyInterest>
                                  label="What is your interest? *"
                                  value={assetDraft.propertyInterest}
                                  options={PROPERTY_INTEREST_OPTIONS}
                                  onChange={(propertyInterest) =>
                                    setAssetDraft((current) => ({ ...current, propertyInterest }))
                                  }
                                  placeholder="Choose ownership or occupancy"
                                  usePortal
                                />
                              </>
                            ) : null}

                            {assetFormKind === 'stock' ? (
                              <>
                                <ModalSelect<StockAssetSubtypeKey>
                                  label="What kind of stock is this? *"
                                  value={assetDraft.stockAssetSubtype}
                                  options={STOCK_ASSET_SUBTYPE_OPTIONS}
                                  onChange={(stockAssetSubtype) =>
                                    setAssetDraft((current) => ({
                                      ...current,
                                      stockAssetSubtype,
                                      insuranceTemperatureSensitiveStock:
                                        stockAssetSubtype === 'livestock'
                                          ? 'unknown'
                                          : current.insuranceTemperatureSensitiveStock,
                                    }))
                                  }
                                  placeholder="Choose the closest stock type"
                                  usePortal
                                />

                                <ModalSelect<StockValuationBasis>
                                  label="How is it valued? *"
                                  value={assetDraft.stockValuationBasis}
                                  options={STOCK_VALUATION_BASIS_OPTIONS}
                                  onChange={(stockValuationBasis) =>
                                    setAssetDraft((current) => ({ ...current, stockValuationBasis }))
                                  }
                                  placeholder="Choose the value basis"
                                  usePortal
                                />

                                <ModalSelect<StockMovement>
                                  label="Where is it normally kept? *"
                                  value={assetDraft.stockMovement}
                                  options={STOCK_MOVEMENT_OPTIONS}
                                  onChange={(stockMovement) =>
                                    setAssetDraft((current) => ({ ...current, stockMovement }))
                                  }
                                  placeholder="Choose the normal movement pattern"
                                  usePortal
                                />

                                {assetDraft.stockAssetSubtype !== 'livestock' ? (
                                  <ModalSelect<InsuranceFactAnswer>
                                    label="Temperature-sensitive?"
                                    value={assetDraft.insuranceTemperatureSensitiveStock}
                                    options={TEMPERATURE_SENSITIVE_STOCK_OPTIONS}
                                    onChange={(insuranceTemperatureSensitiveStock) =>
                                      setAssetDraft((current) => ({ ...current, insuranceTemperatureSensitiveStock }))
                                    }
                                    usePortal
                                  />
                                ) : null}
                              </>
                            ) : null}
                          </div>
                        </div>
                      ) : null}

                      {assetFormKind !== 'property' && assetFormKind !== 'stock' ? (
                        <div className={`${styles.assetTripleGrid} ${updateStyles.compactGrid}`}>
                          <label className={styles.field} data-asset-detail-edit-target="serial">
                            <span>Serial / reference</span>
                            <input
                              value={assetDraft.serialNumber}
                              onChange={(event) =>
                                setAssetDraft((current) => ({
                                  ...current,
                                  serialNumber: event.target.value,
                                }))
                              }
                              placeholder="Optional"
                            />
                          </label>

                          <label className={styles.field}>
                            <span>Brand</span>
                            <input
                              value={assetDraft.brandName}
                              onChange={(event) =>
                                setAssetDraft((current) => ({
                                  ...current,
                                  brandName: event.target.value,
                                }))
                              }
                              placeholder="Optional"
                            />
                          </label>

                          <label className={styles.field}>
                            <span>Model</span>
                            <input
                              value={assetDraft.modelName}
                              onChange={(event) =>
                                setAssetDraft((current) => ({
                                  ...current,
                                  modelName: event.target.value,
                                }))
                              }
                              placeholder="Optional"
                            />
                          </label>
                        </div>
                      ) : null}

                      {assetFormKind === 'property' ? (
                        <div className={`${styles.assetTripleGrid} ${updateStyles.compactGrid}`}>
                          {!isLandPropertyDraft ? (
                            <label className={styles.field} data-asset-detail-edit-target="year">
                              <span>{yearFieldLabel}</span>
                              <input
                                type="number"
                                min="1800"
                                max={new Date().getFullYear() + 1}
                                step="1"
                                value={assetDraft.yearModel}
                                onChange={(event) =>
                                  setAssetDraft((current) => ({
                                    ...current,
                                    yearModel: event.target.value,
                                  }))
                                }
                                placeholder="Optional"
                              />
                            </label>
                          ) : null}

                          <label className={styles.field}>
                            <span>Size</span>
                            <input
                              type="text"
                              value={assetDraft.propertySize}
                              onChange={(event) =>
                                setAssetDraft((current) => ({
                                  ...current,
                                  propertySize: event.target.value,
                                }))
                              }
                              placeholder="Example: 12 ha, 450 m² or 1 200 m² shed"
                            />
                          </label>

                          {showConditionField ? (
                            <ModalSelect<AssetConditionValue>
                              label="Condition"
                              value={assetDraft.condition}
                              options={CONDITION_OPTIONS}
                              onChange={(nextCondition) =>
                                setAssetDraft((current) => ({
                                  ...current,
                                  condition: nextCondition,
                                }))
                              }
                              className={styles.assetConditionField}
                              assetDetailEditTarget="condition"
                            />
                          ) : null}
                        </div>
                      ) : assetFormKind !== 'stock' ? (
                        <div className={`${styles.assetTripleGrid} ${updateStyles.compactGrid}`}>
                          <label className={styles.field} data-asset-detail-edit-target="year">
                            <span>{yearFieldLabel}</span>
                            <input
                              type="number"
                              min="1800"
                              max={new Date().getFullYear() + 1}
                              step="1"
                              value={assetDraft.yearModel}
                              onChange={(event) =>
                                setAssetDraft((current) => ({
                                  ...current,
                                  yearModel: event.target.value,
                                }))
                              }
                              placeholder="Optional"
                            />
                          </label>

                          <div
                            className={`${styles.field} ${updateStyles.usageEditor}`}
                            data-asset-detail-edit-target="usage"
                          >
                            <ModalSelect<AssetDraftUsageMetric>
                              label="Usage type"
                              value={assetDraft.usageMetric}
                              options={usageTypeOptions}
                              onChange={(usageMetric) =>
                                setAssetDraft((current) => ({
                                  ...current,
                                  usageMetric,
                                  hours: usageMetric === 'hours' || usageMetric === 'km' ? current.hours : '',
                                  lifeWorkedPercent: usageMetric === 'percentage' ? current.lifeWorkedPercent : '',
                                }))
                              }
                              className={updateStyles.usageTypeField}
                              usePortal
                            />
                            <label className={updateStyles.usageReading}>
                              <span>{usageFieldLabel}</span>
                              {showPercentUsageField ? (
                                <input
                                  type="number"
                                  min="0"
                                  max="100"
                                  step="0.1"
                                  value={assetDraft.lifeWorkedPercent}
                                  onChange={(event) =>
                                    setAssetDraft((current) => ({
                                      ...current,
                                      lifeWorkedPercent: event.target.value,
                                    }))
                                  }
                                  placeholder={usageFieldPlaceholder}
                                />
                              ) : assetFormUsageNotApplicable ? (
                                <input value="Not applicable" disabled readOnly />
                              ) : (
                                <input
                                  type="text"
                                  inputMode="numeric"
                                  value={formatUsageAmountInput(assetDraft.hours)}
                                  onChange={(event) =>
                                    setAssetDraft((current) => ({
                                      ...current,
                                      hours: formatUsageAmountInput(event.target.value),
                                    }))
                                  }
                                  placeholder={usageFieldPlaceholder}
                                />
                              )}
                            </label>
                          </div>

                          {showConditionField ? (
                            <ModalSelect<AssetConditionValue>
                              label="Condition"
                              value={assetDraft.condition}
                              options={CONDITION_OPTIONS}
                              onChange={(nextCondition) =>
                                setAssetDraft((current) => ({
                                  ...current,
                                  condition: nextCondition,
                                }))
                              }
                              className={styles.assetConditionField}
                              assetDetailEditTarget="condition"
                            />
                          ) : null}
                        </div>
                      ) : null}

                      <div className={`${styles.assetValueBoxGrid} ${updateStyles.valueGrid}`}>
                        <label className={`${styles.field} ${styles.manualValueField}`}>
                          <span>{currentValueFieldLabel}</span>
                          <div className={styles.manualCurrencyInput}>
                            <span>R</span>
                            <input
                              type="text"
                              inputMode="numeric"
                              value={formatRegisterValueInput(assetDraft.value)}
                              onChange={(event) =>
                                setAssetDraft((current) => ({
                                  ...current,
                                  value: formatRegisterValueInput(event.target.value),
                                }))
                              }
                              placeholder="0"
                            />
                          </div>
                        </label>

                        {replacementPriceRequiredForDraft ? (
                          <label className={`${styles.field} ${styles.manualReplacementValueField}`}>
                            <span>{replacementValueFieldLabel}</span>
                            <div className={styles.manualCurrencyInput}>
                              <span>R</span>
                              <input
                                type="text"
                                inputMode="numeric"
                                value={formatRegisterValueInput(assetDraft.replacementPrice)}
                                onChange={(event) =>
                                  setAssetDraft((current) => ({
                                    ...current,
                                    replacementPrice: formatRegisterValueInput(event.target.value),
                                  }))
                                }
                                placeholder="Required"
                              />
                            </div>
                          </label>
                        ) : assetFormKind === 'stock' ? (
                          <label className={`${styles.field} ${styles.manualReplacementValueField}`}>
                            <span>Peak / seasonal stock value excl. VAT</span>
                            <div className={styles.manualCurrencyInput}>
                              <span>R</span>
                              <input
                                type="text"
                                inputMode="numeric"
                                value={formatRegisterValueInput(assetDraft.stockPeakValue)}
                                onChange={(event) =>
                                  setAssetDraft((current) => ({
                                    ...current,
                                    stockPeakValue: formatRegisterValueInput(event.target.value),
                                  }))
                                }
                                placeholder="Optional"
                              />
                            </div>
                          </label>
                        ) : null}

                        <label className={`${styles.field} ${styles.assetInsuredValueField}`}>
                          <span>Insured Value excl. VAT</span>
                          <div className={styles.manualCurrencyInput}>
                            <span>R</span>
                            <input
                              type="text"
                              inputMode="numeric"
                              value={formatRegisterValueInput(assetDraft.insuredValue)}
                              onChange={(event) => handleInsuredValueChange(event.target.value)}
                              placeholder="Optional"
                            />
                          </div>
                        </label>
                      </div>

                      {showLifeWorkedPercentField ? (
                        <div className={styles.assetAuxiliaryGrid}>
                          <label className={styles.field}>
                            <span>Usage %</span>
                            <input
                              type="number"
                              min="0"
                              max="100"
                              step="0.1"
                              value={assetDraft.lifeWorkedPercent}
                              onChange={(event) =>
                                setAssetDraft((current) => ({
                                  ...current,
                                  lifeWorkedPercent: event.target.value,
                                }))
                              }
                              placeholder="Optional"
                            />
                          </label>
                        </div>
                      ) : null}

                      <label className={`${styles.field} ${styles.fullWidth} ${styles.assetNotesField} ${updateStyles.notesField}`}>
                        <span>Notes</span>
                        <textarea
                          rows={3}
                          value={assetDraft.note}
                          onChange={(event) =>
                            setAssetDraft((current) => ({
                              ...current,
                              note: event.target.value,
                            }))
                          }
                          placeholder="Optional"
                        />
                      </label>
                    </div>
                  </section>
                ) : null}

                {manualAssetStep === 3 ? (
                  <section className={`${styles.manualStageCard} ${styles.manualSingleStageCard} ${styles.manualCompactStageCard} ${styles.assetUpdateStageCard} ${styles.fullWidth} ${styles.assetStatusStageCard}`}>
                    {assetStatusEditView === 'hub' ? (
                      <div className={styles.assetStatusHubGrid}>
                        <button
                          type="button"
                          className={styles.assetStatusHubCard}
                          onClick={() => openAssetStatusEditView('finance')}
                        >
                          <strong>Finance</strong>
                          <small>{financeStatusSummary(assetStatusDraft)}</small>
                        </button>

                        <button
                          type="button"
                          className={styles.assetStatusHubCard}
                          onClick={() => openAssetStatusEditView('insurance')}
                        >
                          <strong>Insurance</strong>
                          <small>{insuranceStatusSummary(assetStatusDraft)}</small>
                        </button>

                        {assetLicenseApplicable ? (
                          <button
                            type="button"
                            className={styles.assetStatusHubCard}
                            onClick={() => openAssetStatusEditView('license')}
                          >
                            <strong>License</strong>
                            <small>{licenseStatusSummary(assetStatusDraft)}</small>
                          </button>
                        ) : null}
                      </div>
                    ) : null}

                    {assetStatusEditView === 'finance' ? (
                      <div className={styles.assetStatusFocusedForm}>
                        <div className={styles.assetStatusFocusedHeader}>
                          <strong>Finance</strong>
                        </div>

                        <div className={styles.assetStatusEditGrid}>
                          <ModalSelect<FinanceStatusChoice>
                            label="Finance status"
                            value={assetStatusDraft.financeStatus}
                            options={QUICK_FINANCE_STATUS_OPTIONS}
                            onChange={setAssetFinanceStatus}
                            showDescriptions={false}
                            usePortal
                          />

                          <div className={`${styles.assetStatusAcquisitionPanel} ${styles.assetStatusWideField}`}>
                            <div className={styles.assetStatusAcquisitionHeader}>
                              <strong>Acquisition details</strong>
                              <small>Kept with finance and paperwork.</small>
                            </div>
                            <div className={styles.assetStatusAcquisitionGrid}>
                              <label className={styles.field}>
                                <span>Acquisition date <small>(optional)</small></span>
                                <input type="date" value={assetStatusDraft.financeBoughtWhen} onChange={(event) => updateAssetStatusDraftField('financeBoughtWhen', event.target.value)} />
                              </label>
                              <label className={styles.field}>
                                <span>Acquisition amount excl. VAT <small>(optional)</small></span>
                                <input type="text" inputMode="numeric" value={assetStatusDraft.financeBoughtForExVat} onChange={(event) => updateAssetStatusDraftField('financeBoughtForExVat', formatRegisterValueInput(event.target.value))} placeholder="Optional" />
                              </label>
                            </div>
                          </div>

                          {assetStatusDraft.financeStatus === 'yes' || assetStatusDraft.financeStatus === 'paid' ? (
                            <>
                              <ModalSelect<string>
                                label="Finance type"
                                value={assetStatusDraft.financeType}
                                options={FINANCE_TYPE_OPTIONS}
                                onChange={setAssetFinanceType}
                                placeholder="Select finance type"
                                showDescriptions={false}
                                usePortal
                              />

                              {assetStatusDraft.financeType === 'bulk_group' && editingAsset ? (
                                <div className={`${styles.bulkFinanceLinkCard} ${styles.assetStatusWideField}`}>
                                  <div>
                                    <strong>Assets in this finance agreement</strong>
                                    <small>Choose every asset covered by the same facility.</small>
                                  </div>
                                  <button type="button" className={styles.bulkFinanceChooseButton} onClick={() => setBulkFinanceAssetPickerOpen(true)}>
                                    <span>{bulkFinanceAssetIds.length} selected</span>
                                    <strong>Choose assets</strong>
                                  </button>
                                  <div className={styles.bulkFinanceSelectedAssets}>
                                    {selectedBulkFinanceAssets.map((asset) => <span key={asset.id}>{asset.title}</span>)}
                                  </div>
                                </div>
                              ) : null}

                              {assetStatusDraft.financeStatus === 'yes' ? <label className={styles.field}>
                                <span>Current outstanding amount excl. VAT <small>(optional)</small></span>
                                <input type="text" inputMode="numeric" value={assetStatusDraft.financeCurrentOutstandingExVat} onChange={(event) => updateAssetStatusDraftField('financeCurrentOutstandingExVat', formatRegisterValueInput(event.target.value))} placeholder="Optional" />
                              </label> : null}

                              <label className={styles.field}>
                                <span>Financier <small>(optional)</small></span>
                                <input
                                  value={assetStatusDraft.financierName}
                                  onChange={(event) => updateAssetStatusDraftField('financierName', event.target.value)}
                                  placeholder="Example: Bank or finance house"
                                />
                              </label>

                              <label className={`${styles.field} ${styles.assetStatusWideField}`}>
                                <span>Finance note <small>(optional)</small></span>
                                <textarea
                                  value={assetStatusDraft.financeNote}
                                  onChange={(event) => updateAssetStatusDraftField('financeNote', event.target.value)}
                                  placeholder="Optional"
                                  rows={3}
                                />
                              </label>

                              <div className={`${styles.assetStatusDocumentUpload} ${styles.assetStatusWideField}`}>
                                <div className={styles.assetStatusDocumentUploadCopy}>
                                  <strong>Finance documents</strong>
                                  <small>Agreements, statements or settlement letters</small>
                                </div>
                                <label className={`${styles.secondaryButton} ${styles.filePickerButton} ${styles.assetStatusDocumentPicker} ${isUploadingDocuments || manualDraftDocumentCount >= MAX_DOCUMENTS ? styles.filePickerButtonDisabled : ''}`}>
                                  <span>{isUploadingDocuments ? 'Adding documents...' : 'Add finance documents'}</span>
                                  <input
                                    type="file"
                                    multiple
                                    className={styles.fileInput}
                                    aria-label="Add finance documents"
                                    accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,.jpg,.jpeg,.png,.webp"
                                    onChange={(event) => handleDocumentFilesSelected(event, 'finance')}
                                    disabled={isUploadingDocuments || manualDraftDocumentCount >= MAX_DOCUMENTS}
                                  />
                                </label>
                                <small className={styles.assetStatusDocumentCount}>{manualDraftDocumentCount} / {MAX_DOCUMENTS} documents</small>
                              </div>
                            </>
                          ) : null}
                        </div>

                        {assetStatusDraft.financeStatus === 'yes' || assetStatusDraft.financeStatus === 'paid' ? (
                          <>
                            <button
                              type="button"
                              className={styles.assetStatusAdvancedToggle}
                              onClick={() => setAssetStatusAdvancedOpen((current) => !current)}
                              aria-expanded={assetStatusAdvancedOpen}
                            >
                              <span>Advanced details</span>
                              <strong>{assetStatusAdvancedOpen ? 'Hide' : 'Show'}</strong>
                            </button>

                            {assetStatusAdvancedOpen ? (
                              <div className={styles.assetStatusAdvancedGrid}>
                                <label className={styles.field}>
                                  <span>Original financed amount excl. VAT <small>(optional)</small></span>
                                  <input
                                    type="text"
                                    inputMode="numeric"
                                    value={assetStatusDraft.financeOriginalAmountExVat}
                                    onChange={(event) => updateAssetStatusDraftField('financeOriginalAmountExVat', formatRegisterValueInput(event.target.value))}
                                    placeholder="Optional"
                                  />
                                </label>

                                <label className={styles.field}>
                                  <span>Monthly payment <small>(optional)</small></span>
                                  <input
                                    type="text"
                                    inputMode="numeric"
                                    value={assetStatusDraft.financeMonthlyPaymentExVat}
                                    onChange={(event) => updateAssetStatusDraftField('financeMonthlyPaymentExVat', formatRegisterValueInput(event.target.value))}
                                    placeholder="Optional"
                                  />
                                </label>

                                <label className={styles.field}>
                                  <span>Interest rate % <small>(optional)</small></span>
                                  <input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={assetStatusDraft.financeInterestRatePercent}
                                    onChange={(event) => updateAssetStatusDraftField('financeInterestRatePercent', event.target.value)}
                                    placeholder="Optional"
                                  />
                                </label>

                                <label className={styles.field}>
                                  <span>Finance term months <small>(optional)</small></span>
                                  <input
                                    type="number"
                                    min="0"
                                    step="1"
                                    value={assetStatusDraft.financeTermMonths}
                                    onChange={(event) => updateAssetStatusDraftField('financeTermMonths', event.target.value)}
                                    placeholder="Optional"
                                  />
                                </label>

                                <label className={styles.field}>
                                  <span>Balloon / residual amount excl. VAT <small>(optional)</small></span>
                                  <input
                                    type="text"
                                    inputMode="numeric"
                                    value={assetStatusDraft.financeBalloonPaymentExVat}
                                    onChange={(event) => updateAssetStatusDraftField('financeBalloonPaymentExVat', formatRegisterValueInput(event.target.value))}
                                    placeholder="Optional"
                                  />
                                </label>

                                <label className={styles.field}>
                                  <span>Settlement / expiry date <small>(optional)</small></span>
                                  <input
                                    type="date"
                                    value={assetStatusDraft.financeSettlementDate}
                                    onChange={(event) => updateAssetStatusDraftField('financeSettlementDate', event.target.value)}
                                  />
                                </label>

                                <label className={styles.field}>
                                  <span>Agreement / reference number <small>(optional)</small></span>
                                  <input
                                    value={assetStatusDraft.financeReferenceNumber}
                                    onChange={(event) => updateAssetStatusDraftField('financeReferenceNumber', event.target.value)}
                                    placeholder="Optional"
                                  />
                                </label>
                              </div>
                            ) : null}
                          </>
                        ) : null}

                        {assetStatusError ? <p className={styles.assetStatusError}>{assetStatusError}</p> : null}

                        <div className={styles.assetStatusSubActions}>
                          <button
                            type="button"
                            className={styles.primaryButton}
                            onClick={() => void finishAssetStatusSection('finance')}
                            disabled={isSavingAssetStatus}
                          >
                            {isSavingAssetStatus ? 'Saving...' : 'Done'}
                          </button>
                        </div>
                      </div>
                    ) : null}

                    {assetStatusEditView === 'insurance' ? (
                      <div className={styles.assetStatusFocusedForm}>
                        <div className={styles.assetStatusFocusedHeader}>
                          <strong>Insurance</strong>
                        </div>

                        <div className={styles.assetStatusEditGrid}>
                          <ModalSelect<AssetStatusChoice>
                            label="Insurance status"
                            value={assetStatusDraft.insuranceStatus}
                            options={QUICK_INSURANCE_STATUS_OPTIONS}
                            onChange={setAssetInsuranceStatus}
                            showDescriptions={false}
                            usePortal
                          />

                          {assetStatusDraft.insuranceStatus === 'yes' ? (
                            <>
                              <label className={styles.field}>
                                <span>Insured amount excl. VAT <small>(optional)</small></span>
                                <input
                                  type="text"
                                  inputMode="numeric"
                                  value={assetStatusDraft.insuredValueExVat}
                                  onChange={(event) => handleInsuredValueChange(event.target.value)}
                                  placeholder="Optional"
                                />
                              </label>

                              <label className={styles.field}>
                                <span>Insurer name <small>(optional)</small></span>
                                <input
                                  value={assetStatusDraft.insuranceInsurerName}
                                  onChange={(event) => updateAssetStatusDraftField('insuranceInsurerName', event.target.value)}
                                  placeholder="Optional"
                                />
                              </label>

                              <label className={styles.field}>
                                <span>Policy number <small>(optional)</small></span>
                                <input
                                  value={assetStatusDraft.insurancePolicyNumber}
                                  onChange={(event) => updateAssetStatusDraftField('insurancePolicyNumber', event.target.value)}
                                  placeholder="Optional"
                                />
                              </label>

                              <label className={styles.field}>
                                <span>Renewal / expiry date <small>(optional)</small></span>
                                <input
                                  type="date"
                                  value={assetStatusDraft.insuranceRenewalDate}
                                  onChange={(event) => updateAssetStatusDraftField('insuranceRenewalDate', event.target.value)}
                                />
                              </label>

                              <label className={`${styles.field} ${styles.assetStatusWideField}`}>
                                <span>Insurance note <small>(optional)</small></span>
                                <textarea
                                  value={assetStatusDraft.insuranceNote}
                                  onChange={(event) => updateAssetStatusDraftField('insuranceNote', event.target.value)}
                                  placeholder="Optional"
                                  rows={3}
                                />
                              </label>

                              <div className={`${styles.assetStatusDocumentUpload} ${styles.assetStatusWideField}`}>
                                <div className={styles.assetStatusDocumentUploadCopy}>
                                  <strong>Insurance documents</strong>
                                  <small>Policy schedules, certificates or claims paperwork</small>
                                </div>
                                <label className={`${styles.secondaryButton} ${styles.filePickerButton} ${styles.assetStatusDocumentPicker} ${isUploadingDocuments || manualDraftDocumentCount >= MAX_DOCUMENTS ? styles.filePickerButtonDisabled : ''}`}>
                                  <span>{isUploadingDocuments ? 'Adding documents...' : 'Add insurance documents'}</span>
                                  <input
                                    type="file"
                                    multiple
                                    className={styles.fileInput}
                                    aria-label="Add insurance documents"
                                    accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,.jpg,.jpeg,.png,.webp"
                                    onChange={(event) => handleDocumentFilesSelected(event, 'insurance')}
                                    disabled={isUploadingDocuments || manualDraftDocumentCount >= MAX_DOCUMENTS}
                                  />
                                </label>
                                <small className={styles.assetStatusDocumentCount}>{manualDraftDocumentCount} / {MAX_DOCUMENTS} documents</small>
                              </div>
                            </>
                          ) : null}
                        </div>

                        {assetStatusError ? <p className={styles.assetStatusError}>{assetStatusError}</p> : null}

                        <div className={styles.assetStatusSubActions}>
                          <button
                            type="button"
                            className={styles.primaryButton}
                            onClick={() => void finishAssetStatusSection('insurance')}
                            disabled={isSavingAssetStatus}
                          >
                            {isSavingAssetStatus ? 'Saving...' : 'Done'}
                          </button>
                        </div>
                      </div>
                    ) : null}

                    {assetStatusEditView === 'license' && assetLicenseApplicable ? (
                      <div className={styles.assetStatusFocusedForm}>
                        <div className={styles.assetStatusFocusedHeader}>
                          <strong>License</strong>
                        </div>

                        <div className={styles.assetStatusEditGrid}>
                          <ModalSelect<AssetStatusChoice>
                            label="License status"
                            value={assetStatusDraft.licenseStatus}
                            options={QUICK_LICENSE_STATUS_OPTIONS}
                            onChange={setAssetLicenseStatus}
                            showDescriptions={false}
                            usePortal
                          />

                          {assetStatusDraft.licenseStatus === 'yes' ? (
                            <>
                              <label className={styles.field}>
                                <span>Registration number <small>(optional)</small></span>
                                <input
                                  value={assetStatusDraft.licenseRegistrationNumber}
                                  onChange={(event) => updateAssetStatusDraftField('licenseRegistrationNumber', event.target.value.toUpperCase())}
                                  placeholder="Example: CAW 124120"
                                />
                              </label>

                              <label className={styles.field}>
                                <span>Renewal / expiry date <small>(optional)</small></span>
                                <input
                                  type="date"
                                  value={assetStatusDraft.licenseRenewalDate}
                                  onChange={(event) => updateAssetStatusDraftField('licenseRenewalDate', event.target.value)}
                                />
                              </label>

                              <label className={`${styles.field} ${styles.assetStatusWideField}`}>
                                <span>License note <small>(optional)</small></span>
                                <textarea
                                  value={assetStatusDraft.licenseNote}
                                  onChange={(event) => updateAssetStatusDraftField('licenseNote', event.target.value)}
                                  placeholder="Optional"
                                  rows={3}
                                />
                              </label>

                              <div className={`${styles.assetStatusDocumentUpload} ${styles.assetStatusWideField}`}>
                                <div className={styles.assetStatusDocumentUploadCopy}>
                                  <strong>Licence documents</strong>
                                  <small>Current or older licensing papers</small>
                                </div>
                                <label className={`${styles.secondaryButton} ${styles.filePickerButton} ${styles.assetStatusDocumentPicker} ${isUploadingDocuments || manualDraftDocumentCount >= MAX_DOCUMENTS ? styles.filePickerButtonDisabled : ''}`}>
                                  <span>{isUploadingDocuments ? 'Adding documents...' : 'Add licence documents'}</span>
                                  <input
                                    type="file"
                                    multiple
                                    className={styles.fileInput}
                                    aria-label="Add licence documents"
                                    accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.webp"
                                    onChange={(event) => handleDocumentFilesSelected(event, 'licensing')}
                                    disabled={isUploadingDocuments || manualDraftDocumentCount >= MAX_DOCUMENTS}
                                  />
                                </label>
                                <small className={styles.assetStatusDocumentCount}>{manualDraftDocumentCount} / {MAX_DOCUMENTS} documents</small>
                              </div>
                            </>
                          ) : null}
                        </div>

                        {assetStatusError ? <p className={styles.assetStatusError}>{assetStatusError}</p> : null}

                        <div className={styles.assetStatusSubActions}>
                          <button
                            type="button"
                            className={styles.primaryButton}
                            onClick={() => void finishAssetStatusSection('license')}
                            disabled={isSavingAssetStatus}
                          >
                            {isSavingAssetStatus ? 'Saving...' : 'Done'}
                          </button>
                        </div>
                      </div>
                    ) : null}
                  </section>
                ) : null}

                {manualAssetStep === 4 ? (
                  <section className={`${styles.manualStageCard} ${styles.manualSingleStageCard} ${styles.manualCompactStageCard} ${styles.assetUpdateStageCard} ${styles.fullWidth}`}>
                    <div className={`${styles.manualStageGrid} ${styles.manualUploadGrid}`}>
                      <div className={styles.field}>
                        <span>Other documents</span>

                        <div className={styles.documentUploadPanel}>
                          <div className={styles.uploadRow}>
                            <label
                              className={`${styles.secondaryButton} ${styles.filePickerButton} ${isUploadingDocuments || manualDraftDocumentCount >= MAX_DOCUMENTS ? styles.filePickerButtonDisabled : ''}`}
                            >
                              <span>{isUploadingDocuments ? 'Uploading...' : 'Add documents'}</span>
                              <input
                                ref={documentInputRef}
                                type="file"
                                accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,.jpg,.jpeg,.png,.webp,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv,text/plain,image/jpeg,image/png,image/webp"
                                multiple
                                className={styles.fileInput}
                                onChange={handleDocumentFilesSelected}
                                disabled={isUploadingDocuments || manualDraftDocumentCount >= MAX_DOCUMENTS}
                              />
                            </label>

                            <span className={styles.uploadCount}>
                              {manualDraftDocumentCount} / {MAX_DOCUMENTS}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className={styles.field}>
                        <span>Photos</span>

                        <div className={styles.uploadPanel}>
                          <div className={styles.uploadRow}>
                            <label
                              className={`${styles.secondaryButton} ${styles.filePickerButton} ${isUploadingPhotos ? styles.filePickerButtonDisabled : ''}`}
                            >
                              <span>{isUploadingPhotos ? 'Uploading...' : manualDraftPhotoCount >= MAX_PHOTOS ? 'Add / replace photos' : 'Add photos'}</span>
                              <input
                                ref={photoInputRef}
                                type="file"
                                accept="image/jpeg,image/png,image/webp"
                                multiple
                                className={styles.fileInput}
                                onChange={handlePhotoFilesSelected}
                                disabled={isUploadingPhotos}
                              />
                            </label>

                            <span className={styles.uploadCount}>
                              {manualDraftPhotoCount} / {MAX_PHOTOS}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {assetDraft.documents.length ? (
                      <div className={styles.documentDraftList}>
                        {assetDraft.documents.map((document, documentIndex) => (
                          <div className={styles.documentDraftRow} key={document.id}>
                            <span className={styles.documentDraftIcon}>
                              <DocumentIcon className={styles.buttonIcon} />
                            </span>
                            <div>
                              <strong>{displayDocumentName(document.fileName, documentIndex)}</strong>
                              <small>{assetDocumentCategoryLabel(document.category)} · {formatByteSize(document.byteSize)}</small>
                            </div>
                            <button
                              type="button"
                              className={styles.documentOpenLink}
                              onClick={() => { void openAssetDocument(document); }}
                            >
                              Open
                            </button>
                            <button type="button" className={styles.documentRemoveButton} onClick={() => removeDraftDocument(document.id)}>
                              Remove
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : null}


                    {pendingDocumentFiles.length ? (
                      <div className={styles.documentDraftList}>
                        {pendingDocumentFiles.map((file, index) => (
                          <div className={`${styles.documentDraftRow} ${styles.pendingDraftRow}`} key={`${file.name}-${file.size}-${index}`}>
                            <span className={styles.documentDraftIcon}>
                              <DocumentIcon className={styles.buttonIcon} />
                            </span>
                            <div>
                              <strong>{shortDocumentName(file.name)}</strong>
                              <small>Ready to upload · {formatByteSize(file.size)}</small>
                            </div>
                            <button type="button" className={styles.documentRemoveButton} onClick={() => removePendingDocumentFile(index)}>
                              Remove
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : null}

                    {draftPhotoItems.length ? (
                      <div className={styles.photoDraftSection}>
                        <div className={styles.photoMainHelp}>
                          <strong>Main photo</strong>
                          <span>The first photo below is used first on the asset card, PDFs and marketplace listing.</span>
                        </div>

                        <div className={styles.photoGrid}>
                          {draftPhotoItems.map((photoItem, index) => (
                            <div
                              className={`${styles.photoThumb} ${photoItem.isMain ? styles.photoThumbMain : ''} ${photoItem.source === 'pending' ? styles.pendingPhotoThumb : ''}`}
                              key={photoItem.key}
                            >
                              <div className={styles.photoThumbMedia}>
                                <img
                                  src={photoItem.previewUrl || FALLBACK_ASSET_IMAGE}
                                  alt={photoItem.isMain ? 'Main asset photo' : `Asset photo ${index + 1}`}
                                />
                                {photoItem.isMain ? <span className={styles.photoMainBadge}>Main photo</span> : null}
                                {photoItem.source === 'pending' ? <span className={styles.photoPendingBadge}>Ready</span> : null}
                              </div>

                              <div className={styles.photoThumbActions}>
                                <button
                                  type="button"
                                  className={`${styles.photoMakeMainButton} ${photoItem.isMain ? styles.photoMakeMainButtonActive : ''}`}
                                  onClick={() => selectMainDraftPhoto(photoItem)}
                                  disabled={photoItem.isMain}
                                >
                                  {photoItem.isMain ? 'Main' : 'Make main'}
                                </button>

                                <button
                                  type="button"
                                  className={styles.photoRemoveButton}
                                  onClick={() =>
                                    photoItem.source === 'saved' && photoItem.url
                                      ? removeDraftPhoto(photoItem.url)
                                      : photoItem.pendingId
                                        ? removePendingPhotoFile(photoItem.pendingId)
                                        : undefined
                                  }
                                >
                                  Remove
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </section>
                ) : null}

              </form>
            </div>

            {manualAssetStep > 1 && !isAssetStatusFocusedView ? (
              <div className={styles.assetUpdateFooter}>
                <span
                  className={`${styles.assetUpdateSaveText} ${editingAsset && assetAutosaveState === 'error' ? styles.assetUpdateSaveTextError : ''}`}
                  role="status"
                  aria-live="polite"
                >
                  {editingAsset ? assetAutosaveLabel : 'Saved when you finish'}
                </span>

                <div className={styles.assetUpdateFooterActions}>
                  {(editingAsset && manualAssetStep > 2) || (!editingAsset && manualAssetStep > 1) ? (
                    <button
                      type="button"
                      className={styles.secondaryButton}
                      onClick={goToPreviousManualAssetStep}
                      disabled={isAssetAutosaveBusy}
                    >
                      Back
                    </button>
                  ) : null}

                  {manualAssetStep < 4 ? (
                    <button
                      type="button"
                      className={styles.primaryButton}
                      onClick={goToNextManualAssetStep}
                    >
                      Next
                    </button>
                  ) : (
                    <button
                      type="button"
                      className={styles.primaryButton}
                      onClick={editingAsset ? closeAssetModal : () => void handleAssetSubmit()}
                      disabled={
                        editingAsset
                          ? isAssetAutosaveBusy || assetAutosaveState === 'error'
                          : isSavingAsset || isUploadingPhotos || isUploadingDocuments
                      }
                    >
                      {editingAsset
                        ? isAssetAutosaveBusy
                          ? 'Saving...'
                          : 'Done'
                        : isSavingAsset
                          ? 'Saving...'
                          : manualStepPrimaryLabel}
                    </button>
                  )}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      {isAssetSettingsModalOpen && editingAsset ? (
        <div className={`${styles.modalOverlay} ${styles.assetSettingsOverlay}`}>
          <div className={styles.modalBackdrop} onClick={closeAssetSettingsModal} />

          <div
            className={`${styles.modalCard} ${styles.assetSettingsModal} ${assetSettingsView !== 'menu' ? styles.assetSettingsSubModal : ''} ${assetSettingsView === 'location' ? styles.assetSettingsLocationModal : ''} ${assetSettingsView === 'locationMap' ? styles.assetSettingsMapModal : ''}`}
            role="dialog"
            aria-modal="true"
            aria-labelledby="asset-settings-title"
          >
            <div className={`${styles.modalHeader} ${styles.assetSettingsHeader}`}>
              <div className={styles.modalHeaderText}>
                <h3 id="asset-settings-title">Settings</h3>
                <p>{editingAsset.title}</p>
              </div>

              <button
                type="button"
                className={styles.modalCloseButton}
                onClick={closeAssetSettingsModal}
                aria-label="Close settings"
                disabled={isAssetSettingsBusy}
              >
                <CloseIcon className={styles.buttonIcon} />
              </button>
            </div>

            <div className={`${styles.modalScrollBody} ${styles.assetSettingsBody}`}>
              {assetSettingsView !== 'menu' ? (
                <button
                  type="button"
                  className={styles.assetSettingsBackButton}
                  onClick={goBackFromAssetSettingsSubView}
                  disabled={isAssetSettingsBusy}
                >
                  <span aria-hidden="true">←</span>
                  <span>{assetSettingsView === 'locationManual' || assetSettingsView === 'locationMap' ? 'Back to Location' : 'Back to Settings'}</span>
                </button>
              ) : null}

              {assetSettingsView === 'menu' ? (
                <div className={`${styles.assetSettingsMenuGrid} ${isSavedManualAsset(editingAsset) ? styles.assetSettingsMenuGridManual : ''}`}>
                  <button
                    type="button"
                    className={styles.assetSettingsOptionButton}
                    onClick={openAssetSettingsLocationView}
                    disabled={isAssetSettingsBusy}
                  >
                    <FlagIcon className={styles.assetSettingsOptionIcon} />
                    <span>
                      <strong>Location</strong>
                      <small>Update GPS position.</small>
                    </span>
                  </button>

                  {isSavedManualAsset(editingAsset) ? (
                    <>
                      <button
                        type="button"
                        className={styles.assetSettingsOptionButton}
                        onClick={openAssetSettingsTypeView}
                        disabled={isAssetSettingsBusy}
                      >
                        <OptionsIcon className={styles.assetSettingsOptionIcon} />
                        <span>
                          <strong>Equipment Type</strong>
                          <small>Change this manual asset’s category.</small>
                        </span>
                      </button>

                      <button
                        type="button"
                        className={styles.assetSettingsOptionButton}
                        onClick={openAssetSettingsConversionView}
                        disabled={isAssetSettingsBusy}
                      >
                        <TrendIcon className={styles.assetSettingsOptionIcon} />
                        <span>
                          <strong>Aim4price Valuation</strong>
                          <small>Run an Aim4price valuation.</small>
                        </span>
                      </button>
                    </>
                  ) : null}

                  {isSavedAim4priceAsset(editingAsset) ? (
                    <button
                      type="button"
                      className={styles.assetSettingsOptionButton}
                      onClick={openAssetSettingsUsageView}
                      disabled={isAssetSettingsBusy}
                    >
                      <ManageIcon className={styles.assetSettingsOptionIcon} />
                      <span>
                        <strong>Lifetime Expectancy</strong>
                        <small>Override lifetime usage.</small>
                      </span>
                    </button>
                  ) : null}
                </div>
              ) : null}

              {assetSettingsView === 'location' ? (
                <section className={`${styles.assetSettingsSection} ${styles.assetSettingsLocationSection}`}>
                  <div className={styles.assetSettingsSectionCopy}>
                    <span>Location</span>
                    <h4>Update asset location</h4>
                    <p>Choose the easiest way to save where this asset is kept.</p>
                  </div>

                  <div className={styles.assetSettingsLocationCurrent}>
                    <div className={styles.assetSettingsLocationCurrentMain}>
                      <span className={styles.assetSettingsLocationCurrentIcon} aria-hidden="true">
                        <FlagIcon className={styles.buttonIcon} />
                      </span>

                      <div className={styles.assetSettingsLocationCurrentCopy}>
                        <span>Current location</span>
                        <strong>
                          {assetSettingsLocationText || (hasAssetGpsCoordinates(editingAsset) ? formatAssetSettingsGpsPosition(editingAsset) : 'No location saved')}
                        </strong>
                      </div>

                      {assetSettingsMapsUrl ? (
                        <a className={styles.assetSettingsMapLink} href={assetSettingsMapsUrl} target="_blank" rel="noreferrer">
                          View map
                        </a>
                      ) : null}
                    </div>

                    <div className={styles.assetSettingsLocationCurrentMeta}>
                      <div>
                        <span>Last updated</span>
                        <strong>{formatAssetSettingsLastScanned(editingAsset)}</strong>
                      </div>
                      <div>
                        <span>GPS position</span>
                        <strong>{formatAssetSettingsGpsPosition(editingAsset)}</strong>
                      </div>
                    </div>
                  </div>

                  <div className={styles.assetSettingsLocationChoiceGrid}>
                    <button
                      type="button"
                      className={`${styles.assetSettingsOptionButton} ${styles.assetSettingsLocationPrimaryChoice}`}
                      onClick={() => void updateAssetSettingsGpsPosition()}
                      disabled={isAssetSettingsBusy}
                    >
                      <RefreshIcon className={styles.assetSettingsOptionIcon} />
                      <span>
                        <span className={styles.assetSettingsRecommendedBadge}>Recommended</span>
                        <strong>{assetSettingsDeviceGpsButtonLabel}</strong>
                        <small>Save this device’s current GPS position.</small>
                      </span>
                    </button>

                    <button
                      type="button"
                      className={styles.assetSettingsOptionButton}
                      onClick={openAssetSettingsManualLocationView}
                      disabled={isAssetSettingsBusy}
                    >
                      <DocumentIcon className={styles.assetSettingsOptionIcon} />
                      <span>
                        <strong>Enter coordinates</strong>
                        <small>Paste a saved GPS position.</small>
                      </span>
                    </button>

                    <button
                      type="button"
                      className={styles.assetSettingsOptionButton}
                      onClick={openAssetSettingsMapLocationView}
                      disabled={isAssetSettingsBusy}
                    >
                      <FlagIcon className={styles.assetSettingsOptionIcon} />
                      <span>
                        <strong>Choose on map</strong>
                        <small>Drop and adjust a map pin.</small>
                      </span>
                    </button>
                  </div>

                  {assetSettingsLocationSuccess ? <p className={styles.assetSettingsLocationSuccess}>{assetSettingsLocationSuccess}</p> : null}
                  {assetSettingsLocationError ? <p className={styles.assetSettingsError}>{assetSettingsLocationError}</p> : null}
                </section>
              ) : null}

              {assetSettingsView === 'locationManual' ? (
                <section className={`${styles.assetSettingsSection} ${styles.assetSettingsLocationSection}`}>
                  <div className={styles.assetSettingsSectionCopy}>
                    <span>Manual location</span>
                    <h4>Enter GPS Coordinates</h4>
                    <p>Paste coordinates from Google Maps, or type the latitude and longitude below.</p>
                  </div>

                  <div className={styles.assetSettingsCoordinateGrid}>
                    <label className={styles.assetSettingsField}>
                      <span>Latitude</span>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={assetSettingsManualLatInput}
                        onChange={(event) => {
                          setAssetSettingsManualLatInput(event.target.value);
                          clearAssetSettingsLocationFeedback();
                        }}
                        onPaste={(event) => {
                          const pastedText = event.clipboardData.getData('text');
                          if (applyAssetSettingsCoordinatePair(pastedText)) {
                            event.preventDefault();
                          }
                        }}
                        placeholder="-33.924869"
                      />
                    </label>

                    <label className={styles.assetSettingsField}>
                      <span>Longitude</span>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={assetSettingsManualLngInput}
                        onChange={(event) => {
                          setAssetSettingsManualLngInput(event.target.value);
                          clearAssetSettingsLocationFeedback();
                        }}
                        placeholder="18.424055"
                      />
                    </label>
                  </div>

                  <label className={styles.assetSettingsField}>
                    <span>Optional location note</span>
                    <textarea
                      rows={2}
                      value={assetSettingsManualLocationText}
                      onChange={(event) => {
                        setAssetSettingsManualLocationText(event.target.value.slice(0, MAX_ASSET_SETTINGS_LOCATION_TEXT_LENGTH));
                        clearAssetSettingsLocationFeedback();
                      }}
                      placeholder="Example: Main shed, north camp, client yard"
                    />
                  </label>

                  <p className={styles.assetSettingsFieldTip}>Tip: You can copy coordinates from Google Maps and paste them here.</p>

                  <div className={styles.assetSettingsActions}>
                    <button
                      type="button"
                      className={styles.primaryButton}
                      onClick={() => void saveAssetSettingsManualGpsPosition()}
                      disabled={isAssetSettingsBusy}
                    >
                      {assetSettingsManualGpsButtonLabel}
                    </button>
                  </div>

                  {assetSettingsLocationSuccess ? <p className={styles.assetSettingsLocationSuccess}>{assetSettingsLocationSuccess}</p> : null}
                  {assetSettingsLocationError ? <p className={styles.assetSettingsError}>{assetSettingsLocationError}</p> : null}
                </section>
              ) : null}

              {assetSettingsView === 'locationMap' ? (
                <section className={`${styles.assetSettingsSection} ${styles.assetSettingsLocationSection}`}>
                  <div className={styles.assetSettingsSectionCopy}>
                    <span>Map</span>
                    <h4>Drop a GPS Pin</h4>
                    <p>Click or tap the map to place the asset position. Drag the marker to fine-tune the coordinates.</p>
                  </div>

                  <div className={styles.assetSettingsMapShell}>
                    <div ref={assetSettingsMapElementRef} className={styles.assetSettingsMapCanvas} aria-label="Asset location map" />
                    <div className={styles.assetSettingsMapSelectedGrid}>
                      <div>
                        <span>Selected latitude</span>
                        <strong>{assetSettingsMapLatInput || 'No pin selected'}</strong>
                      </div>
                      <div>
                        <span>Selected longitude</span>
                        <strong>{assetSettingsMapLngInput || 'No pin selected'}</strong>
                      </div>
                    </div>
                  </div>

                  <label className={styles.assetSettingsField}>
                    <span>Optional location note</span>
                    <textarea
                      rows={2}
                      value={assetSettingsMapLocationText}
                      onChange={(event) => {
                        setAssetSettingsMapLocationText(event.target.value.slice(0, MAX_ASSET_SETTINGS_LOCATION_TEXT_LENGTH));
                        clearAssetSettingsLocationFeedback();
                      }}
                      placeholder="Example: Main shed, north camp, client yard"
                    />
                  </label>

                  <div className={styles.assetSettingsActions}>
                    <button
                      type="button"
                      className={styles.primaryButton}
                      onClick={() => void saveAssetSettingsMapGpsPosition()}
                      disabled={isAssetSettingsBusy}
                    >
                      {assetSettingsMapGpsButtonLabel}
                    </button>
                  </div>

                  {assetSettingsLocationSuccess ? <p className={styles.assetSettingsLocationSuccess}>{assetSettingsLocationSuccess}</p> : null}
                  {assetSettingsLocationError ? <p className={styles.assetSettingsError}>{assetSettingsLocationError}</p> : null}
                </section>
              ) : null}

              {assetSettingsView === 'type' && isSavedManualAsset(editingAsset) ? (
                <section className={styles.assetSettingsSection}>
                  <div className={styles.assetSettingsSectionCopy}>
                    <span>Manual asset</span>
                    <h4>Equipment Type</h4>
                    <p>Change the saved type on this same asset record. Existing values, files, notes, finance and insurance details are preserved. Licence details are only kept for non-property assets.</p>
                  </div>

                  <ModalSelect<AssetKind>
                    label="Asset type"
                    value={assetSettingsTypeDraft}
                    options={MANUAL_ASSET_TYPE_OPTIONS}
                    onChange={setAssetSettingsTypeDraft}
                    className={styles.assetSettingsSelectField}
                    usePortal
                  />

                  <div className={styles.assetSettingsActions}>
                    <button
                      type="button"
                      className={styles.primaryButton}
                      onClick={() => void saveManualAssetTypeSetting()}
                      disabled={isAssetSettingsBusy || assetSettingsTypeDraft === editingAsset.kind}
                    >
                      {isSavingAssetSettings ? 'Saving...' : 'Save type'}
                    </button>
                  </div>
                </section>
              ) : null}

              {assetSettingsView === 'conversion' && isSavedManualAsset(editingAsset) ? (
                <section className={styles.assetSettingsSection}>
                  <div className={styles.assetSettingsSectionCopy}>
                    <span>Conversion</span>
                    <h4>Aim4price Valuation</h4>
                    <p>Complete a normal Aim4price estimate. The manual asset is only changed after the final Save succeeds.</p>
                  </div>

                  <div className={styles.assetSettingsActions}>
                    <button
                      type="button"
                      className={styles.assetSettingsConversionButton}
                      onClick={startManualAssetConversion}
                      disabled={isAssetSettingsBusy}
                    >
                      Start Aim4price conversion
                    </button>
                  </div>
                </section>
              ) : null}

              {assetSettingsView === 'usage' && isSavedAim4priceAsset(editingAsset) ? (
                <section className={`${styles.assetSettingsSection} ${styles.assetSettingsUsageSection}`}>
                  <div className={styles.assetSettingsSectionCopy}>
                    <span>Lifetime expectancy</span>
                    <h4>{assetSettingsUsageHeading(settingsUsageMode)}</h4>
                    <p>{ASSET_SETTINGS_USAGE_COPY}</p>
                  </div>

                  {settingsUsageMode !== 'none' ? (
                    <>
                      <div className={styles.assetSettingsUsageComparison}>
                        <div className={styles.assetSettingsUsageCurrent}>
                          <span>Currently saved</span>
                          <strong>{formatAssetSettingsUsageDisplay(settingsUsageMode, settingsUsageCurrentValue)}</strong>
                        </div>

                        <span className={styles.assetSettingsUsageArrow} aria-hidden="true">→</span>

                        <label className={`${styles.assetSettingsField} ${styles.assetSettingsUsageField}`}>
                          <span>{assetSettingsUsageInputLabel(settingsUsageMode)}</span>
                          {settingsUsageMode === 'percent' ? (
                            <input
                              type="number"
                              min="0"
                              max="100"
                              step="0.1"
                              value={assetSettingsUsageInput}
                              onChange={(event) => {
                                setAssetSettingsUsageInput(event.target.value);
                                setAssetSettingsError('');
                              }}
                              placeholder={assetSettingsUsagePlaceholder(settingsUsageMode, settingsUsageCurrentValue)}
                            />
                          ) : (
                            <input
                              type="text"
                              inputMode="numeric"
                              value={assetSettingsUsageInput}
                              onChange={(event) => {
                                setAssetSettingsUsageInput(formatUsageAmountInput(event.target.value));
                                setAssetSettingsError('');
                              }}
                              placeholder={assetSettingsUsagePlaceholder(settingsUsageMode, settingsUsageCurrentValue)}
                            />
                          )}
                        </label>
                      </div>

                      <p className={styles.assetSettingsUsageHint}>Changing this reading may affect the asset’s valuation history.</p>

                      <div className={styles.assetSettingsActions}>
                        <button
                          type="button"
                          className={styles.primaryButton}
                          onClick={requestAim4priceUsageOverrideSetting}
                          disabled={isAssetSettingsBusy}
                        >
                          {isSavingAssetSettings ? 'Saving...' : 'Review change'}
                        </button>
                      </div>
                    </>
                  ) : (
                    <div className={styles.assetSettingsDisabledNote}>
                      This asset does not have a saved usage field to override.
                    </div>
                  )}
                </section>
              ) : null}

              {assetSettingsError ? <p className={styles.assetSettingsError}>{assetSettingsError}</p> : null}
            </div>
          </div>
        </div>
      ) : null}

      {pendingUsageOverride && editingAsset ? (
        <div className={`${styles.modalOverlay} ${styles.assetSettingsConfirmOverlay}`}>
          <div className={styles.modalBackdrop} onClick={cancelAim4priceUsageOverrideConfirmation} />

          <div
            className={`${styles.modalCard} ${styles.assetSettingsConfirmModal}`}
            role="dialog"
            aria-modal="true"
            aria-labelledby="asset-usage-override-confirm-title"
          >
            <div className={`${styles.modalHeader} ${styles.assetSettingsHeader}`}>
              <div className={styles.modalHeaderText}>
                <h3 id="asset-usage-override-confirm-title">Save usage override?</h3>
                <p>{editingAsset.title}</p>
              </div>

              <button
                type="button"
                className={styles.modalCloseButton}
                onClick={cancelAim4priceUsageOverrideConfirmation}
                aria-label="Close usage override confirmation"
                disabled={isSavingAssetSettings}
              >
                <CloseIcon className={styles.buttonIcon} />
              </button>
            </div>

            <div className={`${styles.modalScrollBody} ${styles.assetSettingsBody}`}>
              <p className={styles.assetSettingsConfirmCopy}>{USAGE_OVERRIDE_CONFIRMATION_TEXT}</p>

              <div className={styles.assetSettingsActions}>
                <button type="button" className={styles.secondaryButton} onClick={cancelAim4priceUsageOverrideConfirmation} disabled={isSavingAssetSettings}>
                  Cancel
                </button>
                <button type="button" className={styles.primaryButton} onClick={() => void confirmAim4priceUsageOverrideSetting()} disabled={isSavingAssetSettings}>
                  {isSavingAssetSettings ? 'Saving...' : 'Save override'}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {isManualConversionConfirmOpen && editingAsset ? (
        <div className={`${styles.modalOverlay} ${styles.assetSettingsConfirmOverlay}`}>
          <div className={styles.modalBackdrop} onClick={() => setIsManualConversionConfirmOpen(false)} />

          <div
            className={`${styles.modalCard} ${styles.assetSettingsConfirmModal}`}
            role="dialog"
            aria-modal="true"
            aria-labelledby="asset-conversion-confirm-title"
          >
            <div className={`${styles.modalHeader} ${styles.assetSettingsHeader}`}>
              <div className={styles.modalHeaderText}>
                <h3 id="asset-conversion-confirm-title">Convert manual asset?</h3>
                <p>{editingAsset.title}</p>
              </div>

              <button
                type="button"
                className={styles.modalCloseButton}
                onClick={() => setIsManualConversionConfirmOpen(false)}
                aria-label="Close conversion confirmation"
              >
                <CloseIcon className={styles.buttonIcon} />
              </button>
            </div>

            <div className={`${styles.modalScrollBody} ${styles.assetSettingsBody}`}>
              <p className={styles.assetSettingsConfirmCopy}>
                The current manual asset will stay unchanged while you complete the estimate. It will only become an Aim4price valued asset after you click Save on the final result page.
              </p>

              <div className={styles.assetSettingsActions}>
                <button type="button" className={styles.secondaryButton} onClick={() => setIsManualConversionConfirmOpen(false)}>
                  Cancel
                </button>
                <button type="button" className={styles.primaryButton} onClick={confirmManualAssetConversion}>
                  Continue to estimate
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {isQuoteModalOpen ? (
        <div className={styles.modalOverlay}>
          <div className={styles.modalBackdrop} onClick={closeAssetQuoteModal} />

          <div
            className={`${styles.optionsModal} ${styles.assetQuoteModal} ${!selectedQuoteOption && assetShareDestination === 'choice' ? styles.assetShareDestinationModal : ''} ${!selectedQuoteOption && assetShareDestination === 'inside' ? styles.assetShareInsideModal : ''} ${!selectedQuoteOption && assetShareDestination === 'outside' ? styles.externalAssetShareModal : ''} ${selectedQuoteOption && quoteDirectoryStage === 'map' ? styles.assetQuotePartnerPickerModal : ''} ${selectedQuoteOption && quoteDirectoryStage === 'location' ? styles.assetQuoteLocationPickerModal : ''} ${isQuoteMapExpanded ? styles.assetQuoteMapExpandedModal : ''}`}
            role="dialog"
            aria-modal="true"
            aria-labelledby="asset-quote-title"
          >
            <div className={`${styles.modalHeader} ${styles.optionsModalHeader} ${styles.assetQuoteModalHeader}`}>
              <div className={styles.modalHeaderText}>
                <h3 id="asset-quote-title" tabIndex={-1}>{selectedQuoteOption
                  ? quoteDirectoryStage === 'location' ? 'Where do you need help?' : selectedQuoteOption.mapTitle
                  : assetShareDestination === 'inside'
                    ? 'Share inside Aim4price'
                    : assetShareDestination === 'outside'
                      ? 'Share outside Aim4price'
                      : `Share ${quoteAsset?.title || 'asset'}`}</h3>
                {!selectedQuoteOption ? (
                  <p>{assetShareDestination === 'choice'
                    ? 'Choose where to share this asset.'
                    : assetShareDestination === 'outside'
                      ? 'Send the saved asset details and photos through WhatsApp or email.'
                      : quoteAsset ? `${buildAssetMeta(quoteAsset)} · ${money(quoteAsset.value)} excl. VAT` : ''}</p>
                ) : quoteDirectoryStage === 'location' ? (
                  <p>Choose an area first. We will open the map there and show nearby active partners before Aim4price assistance listings.</p>
                ) : isFullRegisterQuoteLead ? (
                  selectedQuoteOption.leadType === 'replacement_quote' || selectedQuoteOption.leadType === 'license_renewal' ? (
                    <p>{isAssetGroupShare
                      ? `${selectedDealerShareAssetIds.length} grouped assets in ${activeShareName}`
                      : `${selectedDealerShareAssetIds.length} assets selected`}</p>
                  ) : (
                    <p>Once-off {activeShareName} snapshot · {activeShareAssets.length} {activeShareAssets.length === 1 ? 'asset' : 'assets'} · {money(activeShareValue)} excl. VAT</p>
                  )
                ) : null}
              </div>

              <button
                type="button"
                className={styles.modalCloseButton}
                onClick={closeAssetQuoteModal}
                aria-label="Close asset options"
                disabled={isSendingQuoteLead}
              >
                <CloseIcon className={styles.buttonIcon} />
              </button>
            </div>

            <div className={`${styles.modalScrollBody} ${styles.optionsScrollBody} ${styles.assetQuoteScrollBody}`}>
              {!selectedQuoteOption ? (
                assetShareDestination === 'choice' ? (
                  <AssetShareDestinationPicker
                    onInside={() => setAssetShareDestination('inside')}
                    onOutside={() => setAssetShareDestination('outside')}
                    disabled={isSendingQuoteLead}
                  />
                ) : assetShareDestination === 'outside' ? (
                  <AssetExternalShare
                    shareName={quoteAsset?.title || 'Aim4price asset'}
                    assets={quoteExternalShareAssets}
                    onBack={() => setAssetShareDestination('choice')}
                  />
                ) : (
                  <div className={styles.assetShareInsideFlow}>
                    <button type="button" className={styles.assetQuoteBackButton} onClick={() => setAssetShareDestination('choice')}>
                      <ChevronLeftIcon className={styles.buttonIcon} />
                      <span>Back</span>
                    </button>
                    <div className={styles.optionsContent}>
                      <div className={`${styles.optionsGrid} ${styles.assetOptionsGrid} ${styles.assetQuoteChoiceGrid}`}>
                        {availableAssetQuoteOptions.map((option) => {
                          const needsLicenceRenewalDate = option.leadType === 'license_renewal' && Boolean(quoteAsset) && (
                            readLicenseStatusChoice(quoteAsset!) !== 'yes'
                            || !readSpecsText(quoteAsset!, ['licenseRenewalDate', 'license_renewal_date', 'licenceRenewalDate', 'licence_renewal_date'])
                          );
                          return (
                          <button
                            key={option.leadType}
                            type="button"
                            className={`${styles.optionActionButton} ${styles.assetQuoteChoiceCard} ${quoteToneClassForLeadType(option.leadType)}`}
                            onClick={() => openQuotePartnerPicker(option.leadType)}
                          >
                            <span className={styles.assetQuoteChoiceIconTile}>
                              {renderQuoteOptionIcon(option.leadType, styles.assetQuoteChoiceIcon)}
                            </span>
                            <span className={styles.assetQuoteChoiceText}>
                              <strong>{option.title}</strong>
                              <small>
                                <span>{needsLicenceRenewalDate ? 'Add a renewal date before sharing.' : option.description}</span>
                              </small>
                            </span>
                          </button>
                          );
                        })}
                      </div>
                    </div>
    
                  </div>
                )
              ) : quoteDirectoryStage === 'location' ? (
                <div className={styles.assetQuoteLocationStage}>
                  <section className={styles.assetQuoteLocationCard} aria-labelledby="asset-quote-location-heading">
                    <span className={styles.assetQuoteLocationIcon} aria-hidden="true">
                      <SearchIcon className={styles.buttonIcon} />
                    </span>

                    <div className={styles.assetQuoteLocationCopy}>
                      <h4 id="asset-quote-location-heading">Start with your town or area</h4>
                      <p>This keeps the map steady and loads only the partners and Aim4price service areas near you.</p>
                    </div>

                    <form className={styles.assetQuoteLocationForm} onSubmit={submitQuoteLocation}>
                      <label htmlFor="asset-quote-location-input">Town, city or province</label>
                      <input
                        id="asset-quote-location-input"
                        className={styles.assetQuoteLocationInput}
                        value={quoteLocationInput}
                        onChange={(event) => {
                          setQuoteLocationInput(event.target.value);
                          if (quoteLocationError) setQuoteLocationError('');
                        }}
                        placeholder="e.g. Johannesburg or Northern Cape"
                        list="asset-quote-location-options"
                        autoComplete="address-level2"
                        autoFocus
                        aria-describedby="asset-quote-location-hint"
                        aria-invalid={Boolean(quoteLocationError)}
                      />
                      <datalist id="asset-quote-location-options">
                        {QUOTE_LOCATION_SUGGESTIONS.map((location) => (
                          <option key={location} value={location} />
                        ))}
                      </datalist>

                      <small id="asset-quote-location-hint" className={styles.assetQuoteLocationHint}>
                        You can also use your current device location. We only use it to centre this search.
                      </small>
                      {quoteLocationError ? (
                        <p className={styles.assetQuoteLocationError} role="alert">{quoteLocationError}</p>
                      ) : null}

                      <div className={styles.assetQuoteLocationActions}>
                        <button type="button" className={styles.assetQuoteBackButton} onClick={goBackToQuoteOptions} disabled={isResolvingQuoteLocation}>
                          <ChevronLeftIcon className={styles.buttonIcon} />
                          <span>Back</span>
                        </button>
                        <button type="button" className={styles.secondaryButton} onClick={() => void useCurrentQuoteLocation()} disabled={isResolvingQuoteLocation}>
                          Use current location
                        </button>
                        <button type="submit" className={styles.primaryButton} disabled={isResolvingQuoteLocation || !quoteLocationInput.trim()}>
                          {isResolvingQuoteLocation ? 'Finding area...' : 'Show nearby help'}
                        </button>
                      </div>
                    </form>
                  </section>
                </div>
              ) : (
                <div className={styles.assetQuoteContent}>
                  <form
                    className={styles.assetQuoteSearchBar}
                    onSubmit={(event) => {
                      event.preventDefault();
                      quoteFitResultsRef.current = Boolean(quotePartnerSearch.trim());
                      void loadQuotePartners(selectedQuoteOption.leadType, quotePartnerSearch);
                    }}
                  >
                    <input
                      className={styles.assetQuoteSearchInput}
                      value={quotePartnerSearch}
                      onChange={(event) => setQuotePartnerSearch(event.target.value)}
                      placeholder="Search another area, company, service or brand"
                      aria-label="Search business directory"
                    />
                    <button type="submit" className={styles.secondaryButton} disabled={isLoadingQuotePartners}>
                      <SearchIcon className={styles.buttonIcon} />
                      <span>{isLoadingQuotePartners ? 'Searching...' : 'Search'}</span>
                    </button>
                  </form>

                  <div className={styles.assetQuoteMapStage}>
                    <aside className={styles.assetQuoteMapSidebar} aria-label="Available companies">
                      <div className={styles.assetQuoteSidebarHeader}>
                        <button type="button" className={styles.assetQuoteBackButton} onClick={goBackToQuoteOptions} disabled={isSendingQuoteLead}>
                          <ChevronLeftIcon className={styles.buttonIcon} />
                          <span>Back</span>
                        </button>
                        <span className={styles.assetQuoteAreaSummary}>
                          <small>Showing near</small>
                          <strong>{quoteLocationInput}</strong>
                        </span>
                        <button type="button" className={styles.assetQuoteChangeLocationButton} onClick={changeQuoteLocation} disabled={isSendingQuoteLead}>
                          Change area
                        </button>
                      </div>

                      <div className={styles.assetQuotePartnerList}>
                        {isLoadingQuotePartners ? (
                          <p className={styles.assetQuoteEmptyState}>Loading companies...</p>
                        ) : quotePartners.length ? (
                          quotePartners.map((partner) => {
                            const isSelected = selectedQuotePartnerIds.includes(partner.userId);
                            return (
                              <button
                                key={partner.userId}
                                type="button"
                                className={`${styles.assetQuotePartnerCard} ${quoteToneClassForPartnerType(partner.partnerType)} ${isSelected ? styles.assetQuotePartnerCardActive : ''}`}
                                onClick={() => {
                                  if (isAim4priceAssistancePartner(partner) && !isSelected) {
                                    openAim4priceAssistanceMessage(partner);
                                    return;
                                  }
                                  toggleQuotePartnerSelection(partner);
                                }}
                                aria-label={`${isSelected ? 'Remove' : isAim4priceAssistancePartner(partner) ? 'Message' : 'Select'} ${quotePartnerName(partner)}`}
                                aria-pressed={isSelected}
                              >
                                <span className={styles.assetQuotePartnerBody}>
                                  <span className={styles.assetQuotePartnerHeader}>
                                    <strong>{quotePartnerName(partner)}</strong>
                                    {partner.isAim4priceManaged ? (
                                      <span className={styles.assetQuoteManagedLabel}><i aria-hidden="true" />Aim4price service area</span>
                                    ) : partner.isActivePartner ? (
                                      <small className={styles.assetQuoteActivePartnerBadge}>Active partner</small>
                                    ) : null}
                                  </span>
                                  <span className={styles.assetQuotePartnerMeta}>
                                    <span>{quotePartnerLocation(partner)}</span>
                                    {!partner.isAim4priceManaged ? (
                                      <span>{quotePartnerServicesDisplay(partner)}</span>
                                    ) : null}
                                    <span>{quotePartnerRadiusDisplay(partner)}</span>
                                  </span>
                                  {!partner.isAim4priceManaged && partner.brandFocus ? (
                                    <span className={styles.assetQuotePartnerCopy}>Brands: {partner.brandFocus}</span>
                                  ) : null}
                                  <span className={styles.assetQuotePartnerAction}>
                                    <span>{isSelected ? 'Selected' : isAim4priceAssistancePartner(partner) ? 'Message Aim4price' : 'Select company'}</span>
                                    <ChevronRightIcon className={styles.buttonIcon} />
                                  </span>
                                </span>
                              </button>
                            );
                          })
                        ) : (
                          <p className={styles.assetQuoteEmptyState}>{selectedQuoteOption.emptyPartnerText}</p>
                        )}
                      </div>

                      <div className={styles.assetQuoteSidebarFooter}>
                        <span>
                          {selectedQuotePartners.length
                            ? `${selectedQuotePartners.length} selected`
                            : 'Select one or more'}
                        </span>
                        <button
                          type="button"
                          className={styles.primaryButton}
                          onClick={openQuoteLeadMessage}
                          disabled={!selectedQuotePartners.length || isSendingQuoteLead}
                        >
                          {selectedQuotePartners.length ? `Continue with ${selectedQuotePartners.length}` : 'Continue'}
                        </button>
                      </div>
                    </aside>

                    <div
                      className={`${styles.assetQuoteMapShell} ${isQuoteMapExpanded ? styles.assetQuoteMapShellExpanded : ''}`}
                      onClick={() => {
                        if (!isQuoteMapExpanded) setIsQuoteMapExpanded(true);
                      }}
                    >
                      <div ref={quoteMapElementRef} className={styles.assetQuoteMapCanvas} aria-label="Business and Aim4price assistance map" />
                      <div className={styles.assetQuoteMapControls} onClick={(event) => event.stopPropagation()}>
                        {isQuoteMapExpanded ? (
                          <span className={styles.assetQuoteExpandedMapArea}>
                            <small>Showing near</small>
                            <strong>{quoteLocationInput}</strong>
                          </span>
                        ) : null}
                        <button
                          type="button"
                          className={styles.assetQuoteMapExpandButton}
                          onClick={() => setIsQuoteMapExpanded((current) => !current)}
                          aria-label={isQuoteMapExpanded ? 'Minimise partner map' : 'Expand partner map'}
                          title={isQuoteMapExpanded ? 'Return to partner results' : 'Open full map'}
                        >
                          {isQuoteMapExpanded ? <CloseIcon className={styles.buttonIcon} /> : <ExpandIcon className={styles.buttonIcon} />}
                          <span>{isQuoteMapExpanded ? 'Return to results' : 'Expand map'}</span>
                        </button>
                      </div>
                      {!isQuoteMapExpanded ? (
                        <span className={styles.assetQuoteMapExpandHint}>Click the map to expand</span>
                      ) : null}
                      {!isLoadingQuotePartners && !quotePartnersWithCoordinates.length ? (
                        <div className={styles.assetQuoteMapEmptyOverlay}>
                          <OptionsIcon className={styles.buttonIcon} />
                          <p>Move the map or search a town to load nearby partners and Aim4price service areas.</p>
                        </div>
                      ) : null}
                    </div>
                  </div>

                  {quoteLeadStep && selectedQuoteOption && selectedQuotePartner ? (
                    <div className={styles.assetQuoteStepOverlay}>
                      <button
                        type="button"
                        className={styles.assetQuoteStepBackdrop}
                        onClick={closeQuoteLeadStep}
                        aria-label="Close request step"
                        disabled={isSendingQuoteLead}
                      />

                      <section className={`${styles.assetQuoteStepModal} ${quoteLeadStep === 'message' ? styles.assetQuoteMessageStepModal : ''}`} aria-live="polite">
                        <div className={styles.assetQuoteStepHeader}>
                          <div>
                            <h4>{quoteLeadStep === 'message'
                              ? `Message to selected ${selectedQuotePartners.length === 1 ? 'company' : 'companies'}`
                              : 'Confirm and send request'}</h4>
                          </div>
                          <button
                            type="button"
                            className={styles.assetQuoteStepCloseButton}
                            onClick={closeQuoteLeadStep}
                            aria-label="Close request step"
                            disabled={isSendingQuoteLead}
                          >
                            <CloseIcon className={styles.buttonIcon} />
                          </button>
                        </div>

                        {quoteLeadStep === 'message' ? (
                          <div className={`${styles.assetQuoteStepBody} ${styles.assetQuoteMessageStepBody}`}>
                            {selectedQuotePartners.length === 1 ? (
                            <aside className={styles.assetQuoteSelectedCompanyPanel} aria-label="Selected company details">
                              <div className={styles.assetQuoteSelectedCompanyInfo}>
                                <div className={styles.assetQuoteSelectedCompanyHero}>
                                  <span className={`${styles.assetQuoteSelectedMediaTile} ${styles.assetQuoteSelectedLogoTile}`}>
                                    {selectedQuotePartner.logoUrl ? (
                                      <img src={selectedQuotePartner.logoUrl} alt={`${quotePartnerName(selectedQuotePartner)} logo`} />
                                    ) : (
                                      <span className={styles.assetQuoteSelectedLogoFallback}>{quotePartnerInitial(selectedQuotePartner)}</span>
                                    )}
                                  </span>
                                  <div className={styles.assetQuoteSelectedCompanyTitle}>
                                    {selectedQuotePartner.isAim4priceManaged ? (
                                      <span className={styles.assetQuoteManagedLabel}><i aria-hidden="true" />Aim4price service area</span>
                                    ) : null}
                                    <strong>{quotePartnerName(selectedQuotePartner)}</strong>
                                    <span>{quotePartnerLocation(selectedQuotePartner)}</span>
                                  </div>
                                </div>

                                {selectedQuotePartner.isAim4priceManaged ? (
                                  <p className={styles.assetQuoteManagedSelectedNotice}>
                                    Aim4price will find a suitable provider for this area. Nothing is shared with an external provider without your approval.
                                  </p>
                                ) : null}

                                <div className={styles.assetQuoteSelectedContactList}>
                                  {selectedQuotePartner.email && selectedQuotePartnerEmailHref ? (
                                    <a className={styles.assetQuoteSelectedContactRow} href={selectedQuotePartnerEmailHref}>
                                      <small>Email</small>
                                      <span>{selectedQuotePartner.email}</span>
                                    </a>
                                  ) : (
                                    <span className={styles.assetQuoteSelectedContactRow}>
                                      <small>Email</small>
                                      <span>Email not saved</span>
                                    </span>
                                  )}

                                  {selectedQuotePartner.phone && selectedQuotePartnerPhoneHref ? (
                                    <a className={styles.assetQuoteSelectedContactRow} href={selectedQuotePartnerPhoneHref}>
                                      <small>Contact</small>
                                      <span>{selectedQuotePartner.phone}</span>
                                    </a>
                                  ) : (
                                    <span className={styles.assetQuoteSelectedContactRow}>
                                      <small>Contact</small>
                                      <span>Contact not saved</span>
                                    </span>
                                  )}

                                  {selectedQuotePartnerWebsiteHref ? (
                                    <a className={styles.assetQuoteSelectedContactRow} href={selectedQuotePartnerWebsiteHref} target="_blank" rel="noreferrer">
                                      <small>Website</small>
                                      <span>{quotePartnerWebsiteDisplay(selectedQuotePartner)}</span>
                                    </a>
                                  ) : (
                                    <span className={styles.assetQuoteSelectedContactRow}>
                                      <small>Website</small>
                                      <span>Website not saved</span>
                                    </span>
                                  )}

                                  <span className={styles.assetQuoteSelectedContactRow}>
                                    <small>Address</small>
                                    <span>{quotePartnerAddress(selectedQuotePartner)}</span>
                                  </span>
                                </div>
                              </div>
                            </aside>
                            ) : (
                              <aside className={styles.assetQuoteSelectedPartnersPanel} aria-label="Selected companies">
                                <div className={styles.assetQuoteSelectedPartnersHeading}>
                                  <span className={styles.assetQuoteSelectedPartnersCount}>{selectedQuotePartners.length}</span>
                                  <span>
                                    <strong>Companies selected</strong>
                                    <small>Each receives a separate request.</small>
                                  </span>
                                </div>
                                <div className={styles.assetQuoteSelectedPartnersList}>
                                  {selectedQuotePartners.map((partner) => (
                                    <div key={partner.userId} className={styles.assetQuoteSelectedPartnerSummary}>
                                      <span>{quotePartnerInitial(partner)}</span>
                                      <span>
                                        <strong>{quotePartnerName(partner)}</strong>
                                        <small>{quotePartnerLocation(partner)}</small>
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              </aside>
                            )}

                            <div className={styles.assetQuoteMessagePanel}>
                              <p className={styles.assetQuoteStepNotice}>
                                {isFullRegisterQuoteLead
                                  ? isAssetGroupShare
                                    ? `This sends one organised snapshot containing only ${activeShareName} and its grouped assets.`
                                    : selectedQuotePartners.length === 1 && selectedQuoteOption.leadType === 'finance' && selectedQuotePartner?.accountSubtype === 'accountant'
                                    ? 'This grants the selected accountant live access to the latest authorised information in this Asset Register.'
                                    : selectedQuoteOption.leadType === 'replacement_quote' || selectedQuoteOption.leadType === 'license_renewal'
                                      ? `Choose the assets ${selectedQuotePartners.length === 1 ? 'this company' : 'these companies'} can work with.`
                                      : 'This sends a once-off full Asset Register snapshot. It does not grant live register access.'
                                  : 'This sends one asset only. It does not share the full register.'}
                              </p>

                              {isFullRegisterQuoteLead && !isAssetGroupShare && selectedQuotePartners.length === 1 && selectedQuoteOption.leadType === 'finance' && selectedQuotePartner?.accountSubtype === 'accountant' ? (
                                <div className={styles.assetLifecycleFields}>
                                  <button type="button" className={`${styles.assetQuoteConsentCheck} ${styles.assetQuoteTrackingChoice}`} onClick={() => setQuoteAllowDirectUpdates((current) => !current)} aria-pressed={quoteAllowDirectUpdates}>
                                    <span className={`${styles.assetQuoteTrackingCheckbox} ${quoteAllowDirectUpdates ? styles.assetQuoteTrackingCheckboxActive : ''}`} aria-hidden="true">{quoteAllowDirectUpdates ? '✓' : ''}</span>
                                    <span className={styles.assetQuoteTrackingCopy}>
                                      <strong>Allow direct updates</strong>
                                      <small>Permit immediate accountant finance changes, document uploads and accounting carrying-value references. Every change is audited.</small>
                                    </span>
                                  </button>
                                  <button type="button" className={`${styles.assetQuoteConsentCheck} ${styles.assetQuoteTrackingChoice}`} onClick={() => setQuoteIncludeFuelLedger((current) => !current)} aria-pressed={quoteIncludeFuelLedger}>
                                    <span className={`${styles.assetQuoteTrackingCheckbox} ${quoteIncludeFuelLedger ? styles.assetQuoteTrackingCheckboxActive : ''}`} aria-hidden="true">{quoteIncludeFuelLedger ? '✓' : ''}</span>
                                    <span className={styles.assetQuoteTrackingCopy}><strong>Share Fuel Ledger reports</strong><small>Read-only access to authorised fuel records and downloads.</small></span>
                                  </button>
                                  <button type="button" className={`${styles.assetQuoteConsentCheck} ${styles.assetQuoteTrackingChoice}`} onClick={() => setQuoteIncludeCostLedger((current) => !current)} aria-pressed={quoteIncludeCostLedger}>
                                    <span className={`${styles.assetQuoteTrackingCheckbox} ${quoteIncludeCostLedger ? styles.assetQuoteTrackingCheckboxActive : ''}`} aria-hidden="true">{quoteIncludeCostLedger ? '✓' : ''}</span>
                                    <span className={styles.assetQuoteTrackingCopy}><strong>Share Cost Ledger reports</strong><small>Read-only access to authorised cost records and downloads.</small></span>
                                  </button>
                                </div>
                              ) : null}

                              {isFullRegisterQuoteLead && (selectedQuoteOption.leadType === 'replacement_quote' || selectedQuoteOption.leadType === 'license_renewal') ? (
                                isAssetGroupShare ? (
                                  <section className={styles.assetGroupShareSummary} aria-label={`${activeShareName} assets included`}>
                                    <UmbrellaIcon className={styles.assetGroupShareSummaryIcon} />
                                    <span>
                                      <strong>{activeShareName}</strong>
                                      <small>{selectedQuoteOption.leadType === 'license_renewal'
                                        ? `${selectedDealerShareAssetIds.length} grouped ${selectedDealerShareAssetIds.length === 1 ? 'asset' : 'assets'} with renewal dates included.`
                                        : `${activeShareAssets.length} grouped ${activeShareAssets.length === 1 ? 'asset' : 'assets'} included automatically.`}</small>
                                    </span>
                                  </section>
                                ) : (
                                  <DealerAssetShareSelection
                                    assets={assets
                                      .filter((asset) => selectedQuoteOption.leadType !== 'license_renewal' || (
                                        readLicenseStatusChoice(asset) === 'yes' &&
                                        Boolean(readSpecsText(asset, ['licenseRenewalDate', 'license_renewal_date', 'licenceRenewalDate', 'licence_renewal_date']))
                                      ))
                                      .map((asset) => ({
                                      id: asset.id,
                                      title: asset.title,
                                      yearModel: asset.yearModel,
                                      serialNumber: asset.serialNumber,
                                      registrationNumber: readLicenseRegistrationNumber(asset),
                                    }))}
                                    selectedAssetIds={selectedDealerShareAssetIds}
                                    onChange={setSelectedDealerShareAssetIds}
                                    disabled={isSendingQuoteLead}
                                  />
                                )
                              ) : null}

                              <label className={styles.assetQuoteMessageField}>
                                <span>
                                  Message to selected {selectedQuotePartners.length === 1 ? 'company' : 'companies'}
                                  <small>Optional</small>
                                </span>
                                <textarea
                                  value={quoteOwnerMessage}
                                  onChange={(event) => setQuoteOwnerMessage(event.target.value)}
                                  placeholder={
                                    isFullRegisterQuoteLead
                                      ? isAssetGroupShare
                                        ? `Example: Please review ${activeShareName} and its grouped assets.`
                                        : 'Example: Please review my full register for refinance or insurance options.'
                                      : 'Example: Please contact me about cover or finance options for this asset.'
                                  }
                                />
                              </label>

                              {selectedQuoteOption.leadType === 'replacement_quote' ? (
                                <button
                                  type="button"
                                  className={`${styles.assetQuoteConsentCheck} ${styles.assetQuoteTrackingChoice}`}
                                  onClick={openQuoteTrackingSettings}
                                  aria-pressed={quoteTrackMaintenance}
                                >
                                  <span
                                    className={`${styles.assetQuoteTrackingCheckbox} ${quoteTrackMaintenance ? styles.assetQuoteTrackingCheckboxActive : ''}`}
                                    aria-hidden="true"
                                  >
                                    {quoteTrackMaintenance ? '✓' : ''}
                                  </span>
                                  <span className={styles.assetQuoteTrackingCopy}>
                                    <strong>{isFullRegisterQuoteLead ? 'Ongoing dealer access' : 'Enable dealer tracking'}</strong>
                                    <small>{isFullRegisterQuoteLead
                                      ? isAssetGroupShare
                                        ? 'Apply these permissions to every grouped asset in this umbrella. Access stays revocable.'
                                        : 'Apply these permissions to every selected asset. Access stays revocable.'
                                      : 'The dealer can download maintenance reports and propose maintenance schedules for your approval.'}</small>
                                    <em>{quoteTrackMaintenance ? 'Permissions selected. Click to review.' : 'Choose the dealer permissions before sharing.'}</em>
                                  </span>
                                </button>
                              ) : null}
                            </div>
                          </div>
                        ) : (
                          <div className={styles.assetQuoteStepBody}>
                            <div className={styles.assetQuotePopiaBox}>
                              <strong>Disclaimer and POPIA note</strong>
                              <p>
                                {hasManagedAssistanceSelection
                                  ? `By sending this request, you allow Aim4price to share the selected asset information and your saved business contact details with the relevant Aim4price master assistance account. Aim4price will help locate a suitable provider and will not share your assets with an external provider without your further approval.`
                                  : isFullRegisterQuoteLead
                                  ? isAssetGroupShare
                                    ? `By sending this request, you allow Aim4price to share ${activeShareName}, its grouped asset information and your saved business contact details with the selected ${selectedQuotePartners.length === 1 ? 'company' : 'companies'}.`
                                    : selectedQuotePartners.length === 1 && selectedQuoteOption.leadType === 'finance' && selectedQuotePartner?.accountSubtype === 'accountant'
                                    ? `By sending this request, you allow Aim4price to share live Asset Register information and your saved business contact details with the chosen accountant.${quoteAllowDirectUpdates ? ' You also allow the accountant to save the selected direct updates, with audit history.' : ' The workspace will remain read-only.'}`
                                    : selectedQuoteOption.leadType === 'replacement_quote'
                                      ? `By continuing, you allow Aim4price to share the selected assets and your saved business contact details with the selected ${selectedQuotePartners.length === 1 ? 'dealer' : 'dealers'}. Ongoing access uses the permissions shown and can be revoked.`
                                      : `By sending this request, you allow Aim4price to share a once-off full Asset Register snapshot, saved valuation details and your saved business contact details with the selected ${selectedQuotePartners.length === 1 ? 'company' : 'companies'}.`
                                  : `By sending this request, you allow Aim4price to share this selected asset, its saved valuation details and your saved business contact details with the selected ${selectedQuotePartners.length === 1 ? 'company' : 'companies'}.`}
                                {' '}This is only a lead request and does not create a finance, insurance, valuation or sales agreement.
                              </p>
                              <p>
                                {hasManagedAssistanceSelection
                                  ? 'You confirm that you may share the selected asset information and understand that the chosen town represents a service area, not a physical Aim4price branch.'
                                  : isFullRegisterQuoteLead
                                  ? isAssetGroupShare
                                    ? `You confirm that you may share every grouped asset in this umbrella and understand that the selected ${selectedQuotePartners.length === 1 ? 'company may' : 'companies may'} contact you outside Aim4price.`
                                    : selectedQuoteOption.leadType === 'replacement_quote'
                                    ? `You confirm that you may share the selected asset information and understand that the selected ${selectedQuotePartners.length === 1 ? 'dealer may' : 'dealers may'} contact you outside Aim4price.`
                                    : `You confirm that you have permission to share the complete register information and understand that the selected ${selectedQuotePartners.length === 1 ? 'company may' : 'companies may'} contact you outside Aim4price.`
                                  : `You confirm that you have permission to share this asset information and understand that the selected ${selectedQuotePartners.length === 1 ? 'company may' : 'companies may'} contact you outside Aim4price.`}
                              </p>
                              {selectedQuoteOption.leadType === 'replacement_quote' && quoteTrackMaintenance ? (
                                <p>The selected {selectedQuotePartners.length === 1 ? 'dealer will' : 'dealers will'} receive ongoing Maintenance Tracker access with the permissions you selected. Proposed schedules and asset changes still require your approval.</p>
                              ) : null}
                            </div>

                            <label className={styles.assetQuoteConsentCheck}>
                              <input
                                type="checkbox"
                                checked={quoteConsentAccepted}
                                onChange={(event) => setQuoteConsentAccepted(event.target.checked)}
                              />
                              <span>I accept the disclaimer and POPIA permission note.</span>
                            </label>
                          </div>
                        )}

                        <div className={styles.assetQuoteStepFooter}>
                          {quoteLeadStep === 'message' ? (
                            <>
                              <button type="button" className={styles.secondaryButton} onClick={closeQuoteLeadStep} disabled={isSendingQuoteLead}>
                                Cancel
                              </button>
                              <button type="button" className={styles.primaryButton} onClick={goToQuoteLeadConsent}>
                                Next
                              </button>
                            </>
                          ) : (
                            <>
                              <button type="button" className={styles.secondaryButton} onClick={goBackToQuoteLeadMessage} disabled={isSendingQuoteLead}>
                                Back
                              </button>
                              <button
                                type="button"
                                className={styles.primaryButton}
                                onClick={() => void handleSendAssetQuoteLead()}
                                disabled={isSendingQuoteLead || !quoteConsentAccepted}
                              >
                                {isSendingQuoteLead
                                  ? 'Sending...'
                                  : selectedQuotePartners.length === 1
                                    ? `Send to ${quotePartnerName(selectedQuotePartners[0])}`
                                    : `Send to ${selectedQuotePartners.length} companies`}
                              </button>
                            </>
                          )}
                        </div>
                      </section>
                    </div>
                  ) : null}
                </div>
              )}
            </div>

          </div>
        </div>
      ) : null}

      {quoteAsset && isQuoteTrackingSettingsOpen ? (
        <div className={`${styles.modalOverlay} ${styles.subModalOverlay} ${styles.quoteTrackingSettingsOverlay}`}>
          <div className={styles.modalBackdrop} onClick={cancelQuoteTrackingSettings} />

          <div
            className={`${styles.modalCard} ${styles.pricingModal} ${styles.dealerTrackingModal} ${styles.quoteTrackingSettingsModal}`}
            role="dialog"
            aria-modal="true"
            aria-labelledby="quote-tracking-settings-title"
          >
            <div className={`${styles.modalHeader} ${styles.pricingModalHeader} ${styles.dealerTrackingHeader}`}>
              <div className={styles.modalHeaderText}>
                <h3 id="quote-tracking-settings-title" tabIndex={-1}>Dealer tracking settings</h3>
                <p>{quoteAsset.title}</p>
              </div>

              <button type="button" className={styles.modalCloseButton} onClick={cancelQuoteTrackingSettings} aria-label="Close dealer tracking settings">
                <CloseIcon className={styles.buttonIcon} />
              </button>
            </div>

            <div className={`${styles.modalScrollBody} ${styles.pricingModalBody} ${styles.dealerTrackingBody}`}>
              <div className={styles.dealerTrackingIntro}>
                <strong>Choose what this dealer can access</strong>
                <p>Select the permissions to activate as soon as the asset is shared.</p>
              </div>

              <DealerMaintenancePermissionPicker
                value={quoteTrackingPermissions}
                onChange={setQuoteTrackingPermissions}
              />

              <div className={`${styles.formActions} ${styles.exportActions} ${styles.quoteTrackingSettingsActions}`}>
                <button type="button" className={styles.secondaryButton} onClick={cancelQuoteTrackingSettings}>
                  Cancel
                </button>
                {quoteTrackMaintenance ? (
                  <button
                    type="button"
                    className={styles.secondaryButton}
                    onClick={() => {
                      setQuoteTrackMaintenance(false);
                      closeQuoteTrackingSettings();
                    }}
                  >
                    Disable tracking
                  </button>
                ) : null}
                <button type="button" className={styles.primaryButton} onClick={confirmQuoteTrackingSettings}>
                  Save tracking settings
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {replacementPriceRevaluePrompt ? (
        <div className={`${styles.modalOverlay} ${styles.assetSettingsConfirmOverlay}`}>
          <div className={styles.modalBackdrop} onClick={closeReplacementPriceRevaluePrompt} />

          <div
            className={`${styles.modalCard} ${styles.assetSettingsConfirmModal}`}
            role="dialog"
            aria-modal="true"
            aria-labelledby="replacement-price-revalue-title"
          >
            <div className={`${styles.modalHeader} ${styles.assetSettingsHeader}`}>
              <div className={styles.modalHeaderText}>
                <h3 id="replacement-price-revalue-title">Replacement price changed</h3>
                <p>{replacementPriceRevaluePrompt.asset.title}</p>
              </div>

              <button
                type="button"
                className={styles.modalCloseButton}
                onClick={closeReplacementPriceRevaluePrompt}
                aria-label="Close replacement price recalculation confirmation"
              >
                <CloseIcon className={styles.buttonIcon} />
              </button>
            </div>

            <div className={`${styles.modalScrollBody} ${styles.assetSettingsBody}`}>
              <p className={styles.assetSettingsConfirmCopy}>
                Do you want to recalculate this asset’s Aim4price value using {money(replacementPriceRevaluePrompt.newReplacementPriceExVat)} excl. VAT?
              </p>

              <div className={styles.assetSettingsActions}>
                <button type="button" className={styles.secondaryButton} onClick={closeReplacementPriceRevaluePrompt}>
                  Not now
                </button>
                <button type="button" className={styles.primaryButton} onClick={openReplacementPriceRevaluePromptFlow}>
                  Recalculate value
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {accountantNoteAsset && isAccountantWorkspace ? (
        <div className={styles.modalOverlay}>
          <div className={styles.modalBackdrop} onClick={closeAccountantNoteModal} />

          <div
            className={`${styles.modalCard} ${styles.sharedNoteModal} ${styles.accountantNoteModal}`}
            role="dialog"
            aria-modal="true"
            aria-labelledby="accountant-note-title"
          >
            <div className={styles.modalHeader}>
              <div className={styles.modalHeaderText}>
                <h3 id="accountant-note-title">Leave a note</h3>
                <p>{accountantNoteAsset.title} · {accountantAccess?.ownerBusinessName || 'Asset owner'}</p>
              </div>

              <button
                type="button"
                className={styles.modalCloseButton}
                onClick={closeAccountantNoteModal}
                aria-label="Close note modal"
                disabled={isSavingAccountantNote}
              >
                <CloseIcon className={styles.buttonIcon} />
              </button>
            </div>

            <div className={styles.accountantNoteBody}>
              <label className={`${styles.field} ${styles.sharedNoteField}`}>
                <span>Note to asset owner</span>
                <textarea
                  className={styles.sharedNoteTextarea}
                  value={accountantNoteDraft}
                  onChange={(event) => setAccountantNoteDraft(event.target.value)}
                  placeholder="Write your note here."
                  disabled={isSavingAccountantNote}
                  autoFocus
                />
              </label>
              <p className={styles.accountantNoteHint}>This note will appear on the owner&apos;s Asset Register.</p>
            </div>

            <div className={`${styles.formActions} ${styles.sharedNoteActions} ${styles.accountantNoteActions}`}>
              <button type="button" className={styles.secondaryButton} onClick={closeAccountantNoteModal} disabled={isSavingAccountantNote}>
                Cancel
              </button>
              <button type="button" className={styles.primaryButton} onClick={() => void submitAccountantNote()} disabled={isSavingAccountantNote || !accountantNoteDraft.trim()}>
                {isSavingAccountantNote ? 'Saving...' : 'Save note'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {activeAsset && isAccountantWorkspace ? (
        accountantShareId && accountantAccess ? (
          <AccountantAssetManageModal
            shareId={accountantShareId}
            asset={activeAsset}
            assets={assets}
            allowDirectUpdates={accountantAccess.allowDirectUpdates}
            includeFuelLedger={accountantAccess.includeFuelLedger}
            includeCostLedger={accountantAccess.includeCostLedger}
            onClose={closeActionDialog}
            onChanged={(message) => {
              setNotice({ tone: 'success', message });
              window.dispatchEvent(new Event('aim4price:asset-register-updated'));
            }}
          />
        ) : null
      ) : activeAsset ? (
        <div className={`${styles.modalOverlay} ${styles.ownerCommandOverlay}`}>
          <div className={styles.modalBackdrop} onClick={closeActionDialog} />

          <div className={`${styles.optionsModal} ${styles.ownerCommandModal}`} role="dialog" aria-modal="true" aria-labelledby="asset-manage-title">
            <div className={`${styles.modalHeader} ${styles.optionsModalHeader}`}>
              <div className={styles.modalHeaderText}>
                <h3 id="asset-manage-title">{activeAsset.title}</h3>
                <p>{buildAssetMeta(activeAsset)}</p>
              </div>

              <button
                type="button"
                className={styles.modalCloseButton}
                onClick={closeActionDialog}
                aria-label="Close asset management"
              >
                <CloseIcon className={styles.buttonIcon} />
              </button>
            </div>

            <div className={`${styles.modalScrollBody} ${styles.optionsScrollBody} ${styles.ownerCommandScrollBody}`}>
              <div className={styles.optionsContent}>
                <div className={`${styles.optionsGrid} ${styles.assetOptionsGrid} ${styles.ownerCommandGrid}`}>
                  <button
                    type="button"
                    className={`${styles.optionActionButton} ${styles.optionFeaturedButton} ${styles.ownerCommandAction}`}
                    data-asset-return-action="manage-update"
                    onClick={(event) => {
                      const asset = activeAsset;
                      rememberAssetModalReturn(asset, 'manage', 'manage-update', event.currentTarget);
                      closeActionDialog();
                      openUpdater(asset);
                    }}
                  >
                    <UpdateAssetIcon className={styles.buttonIcon} />
                    <span>
                      <strong>Update asset</strong>
                      <small>Edit details, documents, photos and status.</small>
                    </span>
                  </button>

                  <button type="button" className={`${styles.optionActionButton} ${styles.ownerCommandAction}`} onClick={openAssetReportDialog}>
                    <DownloadIcon className={styles.buttonIcon} />
                    <span>
                      <strong>Reports</strong>
                      <small>Choose and download asset reports.</small>
                    </span>
                  </button>

                  <Link
                    href={buildOwnerAssetPageHref('/my-invoices', activeAsset.id, { add: true }, ownerCommandReturnLocation)}
                    className={`${styles.optionActionButton} ${styles.ownerCommandAction}`}
                  >
                    <MoneyBagIcon className={styles.buttonIcon} />
                    <span>
                      <strong>Add cost</strong>
                      <small>Record an expense for this asset.</small>
                    </span>
                  </Link>

                  {canAssetReceiveFuel(activeAsset) ? (
                    <Link
                      href={buildOwnerAssetPageHref('/fuel', activeAsset.id, { add: true }, ownerCommandReturnLocation)}
                      className={`${styles.optionActionButton} ${styles.ownerCommandAction}`}
                    >
                      <PlusIcon className={styles.buttonIcon} />
                      <span>
                        <strong>Add fuel</strong>
                        <small>Capture a fuel record for this asset.</small>
                      </span>
                    </Link>
                  ) : null}

                  <button
                    type="button"
                    className={`${styles.optionActionButton} ${styles.ownerCommandAction}`}
                    data-asset-return-action="manage-maintenance"
                    onClick={() => setOwnerAssetCommandPanel('maintenance')}
                  >
                    <ManageIcon className={styles.buttonIcon} />
                    <span>
                      <strong>Maintenance</strong>
                      <small>Add or review maintenance records.</small>
                    </span>
                  </button>

                  {canManageAssetPricing(activeAsset) ? (
                    <button type="button" className={`${styles.optionActionButton} ${styles.ownerCommandAction}`} onClick={openPricingDialog}>
                      <TrendIcon className={styles.buttonIcon} />
                      <span>
                        <strong>Manage pricing</strong>
                        <small>Refresh values or calculate future value.</small>
                      </span>
                    </button>
                  ) : null}

                  {canUseOwnerOnlyAssetActions ? (
                    <button type="button" className={`${styles.optionActionButton} ${styles.ownerCommandAction}`} onClick={openQrDialog}>
                      <QrIcon className={styles.buttonIcon} />
                      <span>
                        <strong>QR code</strong>
                        <small>Copy, download or print the QR label.</small>
                      </span>
                    </button>
                  ) : null}

                  {canUseMarketplaceActions && isMarketplaceEligible(activeAsset) ? (
                    <button type="button" className={`${styles.optionActionButton} ${styles.ownerCommandAction}`} onClick={() => handlePublishFromDialog(activeAsset)}>
                      <CartIcon className={styles.buttonIcon} />
                      <span>
                        <strong>Marketplace</strong>
                        <small>{isLiveOnMarketplace(activeAsset) ? 'Update or remove the live listing.' : 'Create a listing for this asset.'}</small>
                      </span>
                    </button>
                  ) : null}

                  {canUseOwnerOnlyAssetActions ? (
                    <button
                      type="button"
                      className={`${styles.optionActionButton} ${styles.optionDangerButton} ${styles.ownerCommandAction} ${styles.ownerCommandDangerAction}`}
                      disabled={busyDeleteId === activeAsset.id}
                      onClick={() => handleDeleteFromDialog(activeAsset)}
                    >
                      <TrashIcon className={styles.buttonIcon} />
                      <span>
                        <strong>{busyDeleteId === activeAsset.id ? 'Removing...' : 'Dispose or remove asset'}</strong>
                        <small>Archive, sell, write off or remove.</small>
                      </span>
                    </button>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {activeAsset && ownerAssetCommandPanel ? (
        <div className={`${styles.modalOverlay} ${styles.subModalOverlay} ${styles.ownerCommandChoiceOverlay}`}>
          <div className={styles.modalBackdrop} onClick={() => setOwnerAssetCommandPanel(null)} />

          <div
            className={`${styles.modalCard} ${styles.ownerCommandChoiceModal}`}
            role="dialog"
            aria-modal="true"
            aria-labelledby="owner-command-choice-title"
          >
            <div className={`${styles.modalHeader} ${styles.ownerCommandChoiceHeader}`}>
              <div className={styles.modalHeaderText}>
                <h3 id="owner-command-choice-title">Maintenance</h3>
                <p>{activeAsset.title}</p>
              </div>

              <button
                type="button"
                className={styles.modalCloseButton}
                onClick={() => setOwnerAssetCommandPanel(null)}
                aria-label="Close maintenance choices"
              >
                <CloseIcon className={styles.buttonIcon} />
              </button>
            </div>

            <div className={styles.ownerCommandChoiceBody}>
              <div className={styles.ownerCommandChoiceGrid}>
                <Link
                  href={buildOwnerAssetPageHref('/maintenance', activeAsset.id, { add: true }, ownerCommandReturnLocation)}
                  className={`${styles.optionActionButton} ${styles.ownerCommandChoiceAction} ${styles.optionFeaturedButton}`}
                >
                  <PlusIcon className={styles.buttonIcon} />
                  <span>
                    <strong>Add maintenance</strong>
                    <small>Create a maintenance record already linked to this asset.</small>
                  </span>
                </Link>

                <Link
                  href={buildOwnerAssetPageHref('/maintenance', activeAsset.id, {}, ownerCommandReturnLocation)}
                  className={`${styles.optionActionButton} ${styles.ownerCommandChoiceAction}`}
                >
                  <ManageIcon className={styles.buttonIcon} />
                  <span>
                    <strong>Manage maintenance</strong>
                    <small>Open this asset&apos;s service history, schedule and reminders.</small>
                  </span>
                </Link>

                {activeAsset.kind !== 'property' && activeDealerTrackingByAssetId[activeAsset.id] === true ? (
                  <button
                    type="button"
                    className={`${styles.optionActionButton} ${styles.ownerCommandChoiceAction}`}
                    onClick={() => {
                      const asset = activeAsset;
                      setOwnerAssetCommandPanel(null);
                      void openDealerTrackingSettings(asset);
                    }}
                  >
                    <ManageIcon className={styles.buttonIcon} />
                    <span>
                      <strong>Dealer tracking settings</strong>
                      <small>Review dealer maintenance access and update permissions.</small>
                    </span>
                  </button>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {activeAsset && isDealerTrackingSettingsOpen ? (
        <div className={`${styles.modalOverlay} ${styles.subModalOverlay}`}>
          <div className={styles.modalBackdrop} onClick={() => setIsDealerTrackingSettingsOpen(false)} />

          <div className={`${styles.modalCard} ${styles.pricingModal} ${styles.dealerTrackingModal}`} role="dialog" aria-modal="true" aria-labelledby="dealer-tracking-settings-title">
            <div className={`${styles.modalHeader} ${styles.pricingModalHeader} ${styles.dealerTrackingHeader}`}>
              <div className={styles.modalHeaderText}>
                <h3 id="dealer-tracking-settings-title">Dealer tracking settings</h3>
                <p>{activeAsset.title}</p>
              </div>

              <button type="button" className={styles.modalCloseButton} onClick={() => setIsDealerTrackingSettingsOpen(false)} aria-label="Close dealer tracking settings">
                <CloseIcon className={styles.buttonIcon} />
              </button>
            </div>

            <div className={`${styles.modalScrollBody} ${styles.pricingModalBody} ${styles.dealerTrackingBody}`}>
              {isLoadingDealerTrackingSettings ? (
                <div className={styles.emptyState}>Loading dealer tracking settings…</div>
              ) : (
                <>
                  <div className={styles.dealerTrackingIntro}>
                    <strong>Dealers with access</strong>
                    <p>Select a dealer to review or change their access. Owner approval is still required for schedules and asset changes.</p>
                  </div>
                  <DealerMaintenanceAccessSettings
                    assetId={activeAsset.id}
                    entries={dealerTrackingAccess}
                    mutationUrl="/api/dealer-maintenance-access"
                    onEntriesChange={(entries) => {
                      setDealerTrackingAccess(entries);
                      setActiveDealerTrackingByAssetId((current) => ({
                        ...current,
                        [activeAsset.id]: entries.length > 0,
                      }));
                    }}
                  />
                </>
              )}
            </div>
          </div>
        </div>
      ) : null}

      {activeAsset && isPricingModalOpen ? (
        <div className={`${styles.modalOverlay} ${styles.subModalOverlay}`}>
          <div className={styles.modalBackdrop} onClick={closePricingDialog} />

          <div className={`${styles.modalCard} ${styles.pricingModal}`} role="dialog" aria-modal="true" aria-labelledby="asset-pricing-title">
            <div className={`${styles.modalHeader} ${styles.pricingModalHeader}`}>
              <div className={styles.modalHeaderText}>
                <h3 id="asset-pricing-title">{activeAsset.title}</h3>
                <p>{buildAssetMeta(activeAsset)}</p>
              </div>

              <button type="button" className={styles.modalCloseButton} onClick={closePricingDialog} aria-label="Close pricing options">
                <CloseIcon className={styles.buttonIcon} />
              </button>
            </div>

            <div className={`${styles.modalScrollBody} ${styles.pricingModalBody}`}>
              <div className={styles.pricingOptionsGrid}>
                <button
                  type="button"
                  className={styles.pricingOptionButton}
                  disabled={!canRefreshAssetEstimate(activeAsset) || busyRevalueAssetId === activeAsset.id || isLoadingPricingPreview || isSavingPricingPreview}
                  onClick={() => openRevalueGuidedDialog(activeAsset)}
                >
                  <TrendIcon className={styles.buttonIcon} />
                  <span>
                    <strong>Recalculate value</strong>
                  </span>
                </button>

                <button
                  type="button"
                  className={styles.pricingOptionButton}
                  disabled={!canProjectFuturePrice(activeAsset) || busyRevalueAssetId === activeAsset.id || isLoadingPricingPreview || isSavingPricingPreview}
                  onClick={() => openProjectionModal(activeAsset)}
                >
                  <TrendIcon className={styles.buttonIcon} />
                  <span>
                    <strong>Calculate future price</strong>
                  </span>
                </button>
              </div>

              {!canRefreshAssetEstimate(activeAsset) ? (
                <p className={styles.pricingOptionHint}>Automatic recalculation is only available for assets saved from an Aim4price valuation.</p>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      {pricingPreview ? (
        <div className={`${styles.modalOverlay} ${styles.subModalOverlay} ${styles.pricingPreviewOverlay}`}>
          <div className={styles.modalBackdrop} onClick={closePricingPreviewDialog} />

          <div className={`${styles.modalCard} ${styles.pricingResultModal}`} role="dialog" aria-modal="true" aria-labelledby="pricing-preview-title">
            <div className={`${styles.modalHeader} ${styles.pricingResultHeader}`}>
              <div className={styles.modalHeaderText}>
                <h3 id="pricing-preview-title">{pricingPreview.asset.title}</h3>
                <p>{buildAssetMeta(pricingPreview.asset)}</p>
              </div>

              <button
                type="button"
                className={styles.modalCloseButton}
                onClick={closePricingPreviewDialog}
                aria-label="Close value preview"
                disabled={isSavingPricingPreview}
              >
                <CloseIcon className={styles.buttonIcon} />
              </button>
            </div>

            <div className={`${styles.modalScrollBody} ${styles.pricingResultBody}`}>
              <>
                  {pricingPreviewWizardStep === 1 ? (
                    <section className={`${styles.revalueReplacementPanel} ${styles.revalueSavedStepPanel}`}>
                      <div className={styles.revalueReplacementHeader}>
                        <div>
                          <span>Step 1 of 3</span>
                          <h4>{pricingPreviewSavedStepTitle}</h4>
                        </div>
                      </div>

                      <div className={styles.revalueSavedReplacementCard}>
                        <span>Current replacement price</span>
                        <strong>{pricingPreviewSavedReplacementPriceExVat !== null ? `${money(pricingPreviewSavedReplacementPriceExVat)} excl. VAT` : 'No saved price'}</strong>
                        <small>This is the replacement price currently saved on this asset.</small>
                      </div>

                      {renderRevalueLifetimeField(pricingPreview.asset)}
                      {revalueAdvancedError ? <p className={styles.revalueReplacementError}>{revalueAdvancedError}</p> : null}

                      <div className={styles.revalueDecisionCard}>
                        <strong>Continue with this replacement price?</strong>
                        <div className={styles.revalueDecisionActions}>
                          <button
                            type="button"
                            className={styles.revalueCustomReplacementButton}
                            disabled={pricingPreviewSavedReplacementPriceExVat === null || isLoadingPricingPreview || isSavingPricingPreview}
                            onClick={() => openSavedReplacementPreview(pricingPreview.asset)}
                          >
                            Use this price
                          </button>
                          <button
                            type="button"
                            className={styles.revalueSecondaryButton}
                            disabled={isLoadingPricingPreview || isSavingPricingPreview}
                            onClick={() => showCustomReplacementStep(pricingPreview.asset)}
                          >
                            Enter different price
                          </button>
                        </div>
                      </div>
                    </section>
                  ) : null}

                  {pricingPreviewWizardStep === 2 ? (
                    <section className={`${styles.revalueReplacementPanel} ${styles.revalueCustomStepPanel}`}>
                      <div className={styles.revalueReplacementHeader}>
                        <div>
                          <span>Step 2 of 3</span>
                          <h4>{pricingPreviewCustomStepTitle}</h4>
                          <p className={styles.revalueStepCopy}>{pricingPreviewCustomStepCopy}</p>
                        </div>
                      </div>

                      <div className={styles.revalueCustomReplacementCard}>
                        <label className={styles.revalueReplacementField}>
                          <span>Replacement price excl. VAT</span>
                          <input
                            type="text"
                            inputMode="numeric"
                            value={revalueReplacementPriceInput}
                            onChange={handleRevalueReplacementPriceChange}
                            placeholder="Example: 650 000"
                            disabled={isLoadingPricingPreview || isSavingPricingPreview}
                          />
                        </label>

                        <label className={styles.revalueReplacementToggle}>
                          <input
                            type="checkbox"
                            checked={saveReplacementPriceWithRevalue}
                            onChange={(event) => setSaveReplacementPriceWithRevalue(event.target.checked)}
                            disabled={isLoadingPricingPreview || isSavingPricingPreview}
                          />
                          <span>Save this as the replacement price on this asset</span>
                        </label>
                        <p className={styles.revalueReplacementHelper}>Leave unticked to use this price for this calculation only.</p>
                      </div>

                      {renderRevalueLifetimeField(pricingPreview.asset)}

                      {revalueReplacementPriceError ? <p className={styles.revalueReplacementError}>{revalueReplacementPriceError}</p> : null}
                      {revalueAdvancedError ? <p className={styles.revalueReplacementError}>{revalueAdvancedError}</p> : null}
                    </section>
                  ) : null}

                  {pricingPreviewWizardStep === 3 ? (
                    isLoadingPricingPreview ? (
                      <div className={styles.pricingPreviewStatus}>Calculating new value...</div>
                    ) : pricingPreview.error ? (
                      <div className={`${styles.pricingPreviewStatus} ${styles.pricingPreviewError}`}>
                        <strong>{pricingPreviewErrorTitle}</strong>
                        <span>{pricingPreview.error}</span>
                      </div>
                    ) : pricingPreview.result?.item ? (
                      <>
                        <section className={`${styles.revalueReplacementPanel} ${styles.revaluePreviewPanel}`} aria-live="polite">
                          <div className={styles.revalueReplacementHeader}>
                            <div>
                              <span>Step 3 of 3</span>
                              <h4>Preview and save</h4>
                              <p className={styles.revalueStepCopy}>Review the new value before saving it to the Asset Register.</p>
                            </div>
                          </div>

                          <div className={styles.pricingResultHero}>
                            <span>New asset value</span>
                            <strong>{money(pricingPreviewNewValueExVat)}</strong>
                            <p>This is the value that will be saved to the asset.</p>
                          </div>

                          <div className={styles.pricingCompareGrid}>
                            <div>
                              <span>Current value</span>
                              <strong>{money(pricingPreviewOldValueExVat)}</strong>
                            </div>
                            <div>
                              <span>New value</span>
                              <strong>{money(pricingPreviewNewValueExVat)}</strong>
                            </div>
                            <div>
                              <span>Difference</span>
                              <strong>{formatMoneyDifference(pricingPreviewDifferenceExVat)}</strong>
                            </div>
                          </div>

                          <div className={styles.revalueReplacementSummary}>
                            <div>
                              <span>Replacement price used:</span>
                              <strong>{pricingPreviewReplacementPriceExVat !== null ? money(pricingPreviewReplacementPriceExVat) : 'Not set'}</strong>
                            </div>
                            <div>
                              <span>Replacement price action:</span>
                              <strong>{pricingPreviewReplacementActionLabel}</strong>
                            </div>
                            {!pricingPreviewUsesPercentUsage ? (
                              <div>
                                <span>Expected lifetime used:</span>
                                <strong>{pricingPreviewLifetimeValue !== null ? `${formatPlainNumber(pricingPreviewLifetimeValue)} ${pricingPreviewLifetimeShortUnit}` : 'Not set'}</strong>
                              </div>
                            ) : null}
                          </div>
                        </section>

                        {pricingPreview.result.warning ? (
                          <p className={styles.pricingPreviewWarning}>{pricingPreview.result.warning}</p>
                        ) : null}

                        {pricingPreviewHasUnpreviewedReplacementInput ? (
                          <p className={styles.revalueReplacementNotice}>Calculate the changed replacement price before saving.</p>
                        ) : null}
                      </>
                    ) : null
                  ) : null}
                </>
            </div>

            <div
              className={`${styles.pricingPreviewActions} ${
                pricingPreview.method === 'aim4price' && pricingPreviewWizardStep === 1 ? styles.pricingPreviewActionsSingle : ''
              }`}
            >
              {pricingPreview.method === 'aim4price' && pricingPreviewWizardStep === 1 ? (
                <button type="button" className={styles.secondaryButton} onClick={closePricingPreviewDialog} disabled={isSavingPricingPreview}>
                  Keep current value
                </button>
              ) : pricingPreview.method === 'aim4price' && pricingPreviewWizardStep === 2 ? (
                <>
                  <button type="button" className={styles.secondaryButton} onClick={handlePreviousRevalueStep} disabled={isLoadingPricingPreview || isSavingPricingPreview}>
                    Back
                  </button>
                  <button
                    type="button"
                    className={styles.primaryButton}
                    onClick={() => openCustomReplacementPreview(pricingPreview.asset)}
                    disabled={!canCalculateCustomReplacementPreview}
                  >
                    Calculate new value
                  </button>
                </>
              ) : pricingPreview.method === 'aim4price' && pricingPreviewWizardStep === 3 ? (
                <>
                  <button type="button" className={styles.secondaryButton} onClick={handlePreviousRevalueStep} disabled={isLoadingPricingPreview || isSavingPricingPreview}>
                    Back
                  </button>
                  <button
                    type="button"
                    className={styles.primaryButton}
                    onClick={() => void handleSavePricingPreview()}
                    disabled={!canSavePricingPreview}
                  >
                    {isSavingPricingPreview ? 'Saving...' : pricingPreviewShouldSaveReplacement ? 'Save value and replacement price' : 'Save new value'}
                  </button>
                </>
              ) : (
                <>
                  <button type="button" className={styles.secondaryButton} onClick={closePricingPreviewDialog} disabled={isSavingPricingPreview}>
                    Keep current value
                  </button>
                  <button
                    type="button"
                    className={styles.primaryButton}
                    onClick={() => void handleSavePricingPreview()}
                    disabled={!canSavePricingPreview}
                  >
                    {isSavingPricingPreview ? 'Saving...' : 'Save new value'}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      ) : null}

      {activeAsset && isAssetReportModalOpen ? (
        <div className={`${styles.modalOverlay} ${styles.subModalOverlay}`}>
          <div className={styles.modalBackdrop} onClick={closeAssetReportDialog} />

          <div
            className={`${styles.modalCard} ${styles.assetReportModal} ${assetReportStep !== 'options' ? styles.assetFuelReportModal : ''}`}
            role="dialog"
            aria-modal="true"
            aria-labelledby="asset-report-title"
          >
            <div className={`${styles.modalHeader} ${styles.assetReportModalHeader}`}>
              <div className={styles.modalHeaderText}>
                <h3 id="asset-report-title">{activeAsset.title}</h3>
                <p>{buildAssetMeta(activeAsset)}</p>
              </div>

              <button type="button" className={styles.modalCloseButton} onClick={closeAssetReportDialog} aria-label="Close report options">
                <CloseIcon className={styles.buttonIcon} />
              </button>
            </div>

            <div className={`${styles.modalScrollBody} ${styles.assetReportModalBody}`}>
              {assetReportStep.endsWith('-format') ? (
                <>
                  <div className={styles.assetTimelineStageHeading}>
                    <strong>Choose export format</strong>
                    <span>Select PDF or Excel, then continue to the report timeline.</span>
                  </div>

                  <AssetReportFormatPicker value={assetReportDownloadFormat} onChange={setAssetReportDownloadFormat} />

                  <div className={`${styles.formActions} ${styles.exportActions} ${styles.assetFuelReportActions}`}>
                    <button type="button" className={`${styles.secondaryButton} ${styles.assetTimelineSecondaryButton}`} onClick={backToAssetReportOptions}>Back</button>
                    <button
                      type="button"
                      className={`${styles.secondaryButton} ${styles.assetTimelineSecondaryButton}`}
                      onClick={closeAssetReportDialog}
                    >
                      Cancel
                    </button>
                    <button type="button" className={styles.primaryButton} onClick={showAssetReportTimelineStep}>
                      <span>Next</span>
                    </button>
                  </div>
                </>
              ) : assetReportStep === 'fuel-filter' ? (
                <>
                  <div className={styles.assetTimelineStageHeading}>
                    <strong>Report timeline</strong>
                    <span>Choose the year and month to include.</span>
                  </div>

                  <div className={styles.assetFuelReportFilterBox}>
                    <ReportSelect
                      label="Year"
                      value={assetFuelReportYear}
                      options={assetReportYearOptions}
                      isOpen={openAssetReportSelect === 'year'}
                      onToggle={() => toggleAssetReportSelect('year')}
                      onChange={selectAssetFuelReportYear}
                    />

                    <ReportSelect
                      label="Month"
                      value={assetFuelReportMonth}
                      options={assetReportMonthOptions}
                      isOpen={openAssetReportSelect === 'month'}
                      disabled={assetFuelReportYear === 'all'}
                      onToggle={() => toggleAssetReportSelect('month')}
                      onChange={selectAssetFuelReportMonth}
                    />
                  </div>

                  <div className={`${styles.formActions} ${styles.exportActions} ${styles.assetFuelReportActions}`}>
                    <button type="button" className={`${styles.secondaryButton} ${styles.assetTimelineSecondaryButton}`} onClick={backToAssetReportFormatStep}>Back</button>
                    <button
                      type="button"
                      className={`${styles.secondaryButton} ${styles.assetTimelineSecondaryButton}`}
                      onClick={closeAssetReportDialog}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      className={styles.primaryButton}
                      onClick={() => void handleDownloadFilteredFuelReport(activeAsset, assetReportDownloadFormat)}
                    >
                      <DownloadIcon className={styles.buttonIcon} />
                      <span>{assetReportDownloadFormat === 'pdf' ? 'Open PDF report' : 'Download Excel'}</span>
                    </button>
                  </div>
                </>
              ) : assetReportStep === 'maintenance-filter' ? (
                <>
                  <div className={styles.assetTimelineStageHeading}>
                    <strong>Report timeline</strong>
                    <span>Choose the maintenance type, year and month to include.</span>
                  </div>

                  <div className={`${styles.assetFuelReportFilterBox} ${styles.assetMaintenanceReportFilterBox}`}>
                    <ReportSelect
                      label="Type"
                      value={assetMaintenanceReportType}
                      options={assetMaintenanceReportTypeOptions}
                      isOpen={openAssetReportSelect === 'type'}
                      onToggle={() => toggleAssetReportSelect('type')}
                      onChange={selectAssetMaintenanceReportType}
                    />

                    <ReportSelect
                      label="Year"
                      value={assetMaintenanceReportYear}
                      options={assetReportYearOptions}
                      isOpen={openAssetReportSelect === 'year'}
                      onToggle={() => toggleAssetReportSelect('year')}
                      onChange={selectAssetMaintenanceReportYear}
                    />

                    <ReportSelect
                      label="Month"
                      value={assetMaintenanceReportMonth}
                      options={assetReportMonthOptions}
                      isOpen={openAssetReportSelect === 'month'}
                      disabled={assetMaintenanceReportYear === 'all'}
                      onToggle={() => toggleAssetReportSelect('month')}
                      onChange={selectAssetMaintenanceReportMonth}
                    />
                  </div>

                  <div className={`${styles.formActions} ${styles.exportActions} ${styles.assetFuelReportActions}`}>
                    <button type="button" className={`${styles.secondaryButton} ${styles.assetTimelineSecondaryButton}`} onClick={backToAssetReportFormatStep}>Back</button>
                    <button
                      type="button"
                      className={`${styles.secondaryButton} ${styles.assetTimelineSecondaryButton}`}
                      onClick={closeAssetReportDialog}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      className={styles.primaryButton}
                      onClick={() => void handleDownloadFilteredMaintenanceReport(activeAsset, assetReportDownloadFormat)}
                    >
                      <DownloadIcon className={styles.buttonIcon} />
                      <span>{assetReportDownloadFormat === 'pdf' ? 'Open PDF report' : 'Download Excel'}</span>
                    </button>
                  </div>
                </>
              ) : assetReportStep === 'depreciation-filter' ? (
                <>
                  <div className={styles.assetTimelineStageHeading}>
                    <strong>Report timeline</strong>
                    <span>Choose the year and month to include.</span>
                  </div>

                  <div className={styles.assetFuelReportFilterBox}>
                    <ReportSelect
                      label="Year"
                      value={assetDepreciationReportYear}
                      options={assetReportYearOptions}
                      isOpen={openAssetReportSelect === 'year'}
                      onToggle={() => toggleAssetReportSelect('year')}
                      onChange={selectAssetDepreciationReportYear}
                    />

                    <ReportSelect
                      label="Month"
                      value={assetDepreciationReportMonth}
                      options={assetReportMonthOptions}
                      isOpen={openAssetReportSelect === 'month'}
                      disabled={assetDepreciationReportYear === 'all'}
                      onToggle={() => toggleAssetReportSelect('month')}
                      onChange={selectAssetDepreciationReportMonth}
                    />
                  </div>

                  <div className={`${styles.formActions} ${styles.exportActions} ${styles.assetFuelReportActions}`}>
                    <button type="button" className={`${styles.secondaryButton} ${styles.assetTimelineSecondaryButton}`} onClick={backToAssetReportFormatStep}>Back</button>
                    <button
                      type="button"
                      className={`${styles.secondaryButton} ${styles.assetTimelineSecondaryButton}`}
                      onClick={closeAssetReportDialog}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      className={styles.primaryButton}
                      onClick={() => void handleDownloadFilteredDepreciationReport(activeAsset, assetReportDownloadFormat)}
                    >
                      <DownloadIcon className={styles.buttonIcon} />
                      <span>{assetReportDownloadFormat === 'pdf' ? 'Open PDF report' : 'Download Excel'}</span>
                    </button>
                  </div>
                </>
              ) : assetReportStep === 'ownership-filter' ? (
                <>
                  <div className={styles.assetTimelineStageHeading}>
                    <strong>Report timeline</strong>
                    <span>Choose the year and month to include.</span>
                  </div>

                  <div className={styles.assetFuelReportFilterBox}>
                    <ReportSelect
                      label="Year"
                      value={assetOwnershipReportYear}
                      options={assetReportYearOptions}
                      isOpen={openAssetReportSelect === 'year'}
                      onToggle={() => toggleAssetReportSelect('year')}
                      onChange={selectAssetOwnershipReportYear}
                    />

                    <ReportSelect
                      label="Month"
                      value={assetOwnershipReportMonth}
                      options={assetReportMonthOptions}
                      isOpen={openAssetReportSelect === 'month'}
                      disabled={assetOwnershipReportYear === 'all'}
                      onToggle={() => toggleAssetReportSelect('month')}
                      onChange={selectAssetOwnershipReportMonth}
                    />
                  </div>

                  <div className={`${styles.formActions} ${styles.exportActions} ${styles.assetFuelReportActions}`}>
                    <button type="button" className={`${styles.secondaryButton} ${styles.assetTimelineSecondaryButton}`} onClick={backToAssetReportFormatStep}>Back</button>
                    <button
                      type="button"
                      className={`${styles.secondaryButton} ${styles.assetTimelineSecondaryButton}`}
                      onClick={closeAssetReportDialog}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      className={styles.primaryButton}
                      onClick={() => void handleDownloadFilteredOwnershipReport(activeAsset, assetReportDownloadFormat)}
                    >
                      <DownloadIcon className={styles.buttonIcon} />
                      <span>{assetReportDownloadFormat === 'pdf' ? 'Open PDF report' : 'Download Excel'}</span>
                    </button>
                  </div>
                </>
              ) : (
                <div className={styles.assetReportOptionsGrid}>
                  <button type="button" className={styles.assetReportOptionButton} onClick={() => handlePrintAssetSheet(activeAsset)}>
                    <PdfIcon className={styles.buttonIcon} />
                    <span>
                      <strong>Download asset valuation</strong>
                      <small>PDF value summary with notes and documents.</small>
                    </span>
                  </button>

                  {canUseOwnerOnlyAssetActions ? (
                    <>
                      <button type="button" className={styles.assetReportOptionButton} onClick={openAssetMaintenanceReportFilter}>
                        <DocumentIcon className={styles.buttonIcon} />
                        <span>
                          <strong>Download maintenance report</strong>
                          <small>PDF or Excel service and repair costs.</small>
                        </span>
                      </button>

                      {canDownloadAssetFuelReport(activeAsset) ? (
                        <button type="button" className={styles.assetReportOptionButton} onClick={openAssetFuelReportFilter}>
                          <DocumentIcon className={styles.buttonIcon} />
                          <span>
                            <strong>Download fuel report</strong>
                            <small>PDF or Excel fuel costs by month.</small>
                          </span>
                        </button>
                      ) : null}

                      {canDownloadAssetDepreciationReport(activeAsset) ? (
                        <button type="button" className={styles.assetReportOptionButton} onClick={openAssetDepreciationReportFilter}>
                          <DocumentIcon className={styles.buttonIcon} />
                          <span>
                            <strong>Download depreciation log</strong>
                            <small>PDF or Excel log of saved value changes.</small>
                          </span>
                        </button>
                      ) : null}

                      <button type="button" className={styles.assetReportOptionButton} onClick={openAssetOwnershipReportFilter}>
                        <DocumentIcon className={styles.buttonIcon} />
                        <span>
                          <strong>Download cost of ownership report</strong>
                          <small>PDF or Excel ownership costs and VAT.</small>
                        </span>
                      </button>
                    </>
                  ) : null}
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}

      {deleteCandidateAsset ? (
        <div className={`${styles.modalOverlay} ${styles.confirmDeleteOverlay}`}>
          <div className={styles.modalBackdrop} onClick={closeDeleteConfirmDialog} />

          <div
            className={styles.deleteConfirmModal}
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="delete-confirm-title"
            aria-describedby="delete-confirm-copy"
          >
            <button
              type="button"
              className={styles.deleteConfirmCloseButton}
              onClick={closeDeleteConfirmDialog}
              aria-label="Close delete confirmation"
              disabled={busyDeleteId === deleteCandidateAsset.id}
            >
              <CloseIcon className={styles.buttonIcon} />
            </button>

            <div className={styles.deleteConfirmContent}>
              <h3 id="delete-confirm-title">Are you sure you want to delete this?</h3>
              <p id="delete-confirm-copy">
                Continue to tell Aim4price what happened to <strong>{deleteCandidateAsset.title}</strong>. Genuine disposals are archived and kept for reports and history; only mistakes or duplicates are permanently removed.
              </p>

              <div className={styles.deleteConfirmAsset}>
                <span>Selected asset</span>
                <strong>{deleteCandidateAsset.title}</strong>
                <small>{buildAssetMeta(deleteCandidateAsset)} · {money(deleteCandidateAsset.value)}</small>
              </div>

              <div className={styles.deleteConfirmActions}>
                <button type="button" className={styles.secondaryButton} onClick={closeDeleteConfirmDialog} disabled={busyDeleteId === deleteCandidateAsset.id}>
                  Cancel
                </button>

                <button
                  type="button"
                  className={`${styles.primaryButton} ${styles.deleteConfirmButton}`}
                  onClick={() => void handleConfirmDeleteAsset()}
                  disabled={busyDeleteId === deleteCandidateAsset.id}
                >
                  <span>Yes, delete asset</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {bulkFinanceAssetPickerOpen && editingAsset ? (
        <div className={`${styles.modalOverlay} ${styles.bulkFinancePickerOverlay}`}>
          <div className={styles.modalBackdrop} onClick={() => setBulkFinanceAssetPickerOpen(false)} />
          <div className={`${styles.modalCard} ${styles.exportModal} ${styles.exportAssetPickerModal} ${styles.bulkFinanceAssetPickerModal}`} role="dialog" aria-modal="true" aria-labelledby="bulk-finance-assets-title">
            <div className={`${styles.modalHeader} ${styles.exportModalHeader}`}>
              <div className={styles.modalHeaderText}>
                <h3 id="bulk-finance-assets-title">Choose assets for bulk finance</h3>
                <p>Select every asset covered by the same finance agreement.</p>
              </div>
              <button type="button" className={styles.modalCloseButton} onClick={() => setBulkFinanceAssetPickerOpen(false)} aria-label="Close bulk finance asset picker">
                <CloseIcon className={styles.buttonIcon} />
              </button>
            </div>
            <div className={`${styles.modalScrollBody} ${styles.exportModalScrollBody}`}>
              <div className={styles.exportModalBody}>
                <section className={styles.pdfAssetDownloadPanel} aria-label="Choose assets for bulk finance">
                  <div className={styles.pdfAssetDownloadToolbar}>
                    <input
                      className={styles.pdfAssetSearchInput}
                      type="search"
                      value={bulkFinanceAssetSearch}
                      onChange={(event) => setBulkFinanceAssetSearch(event.target.value)}
                      placeholder="Search assets..."
                      aria-label="Search assets for bulk finance"
                    />
                    <div className={styles.pdfAssetDownloadToolbarActions}>
                      <button type="button" className={styles.secondaryButton} onClick={() => setBulkFinanceAssetIds(Array.from(new Set([editingAsset.id, ...visibleBulkFinanceAssets.map((asset) => asset.id)])))}>Select all</button>
                      <button type="button" className={styles.secondaryButton} onClick={() => setBulkFinanceAssetIds([editingAsset.id])} disabled={bulkFinanceAssetIds.length <= 1}>Clear</button>
                    </div>
                  </div>
                  <div className={styles.pdfAssetDownloadList}>
                    {visibleBulkFinanceAssets.length ? visibleBulkFinanceAssets.map((asset) => {
                      const selected = bulkFinanceAssetIdSet.has(asset.id);
                      const required = asset.id === editingAsset.id;
                      return (
                        <label key={asset.id} className={`${styles.pdfAssetDownloadRow} ${selected ? styles.pdfAssetDownloadRowSelected : ''} ${required ? styles.bulkFinanceCurrentAsset : ''}`}>
                          <input className={styles.pdfAssetDownloadCheckboxInput} type="checkbox" checked={selected} onChange={() => toggleBulkFinanceAsset(asset.id)} disabled={required} />
                          <span className={styles.pdfAssetDownloadCheckbox} aria-hidden="true" />
                          <span className={styles.pdfAssetDownloadCopy}>
                            <strong>{asset.title}</strong>
                            <span>{buildAssetMeta(asset)}</span>
                            <small>{assetKindLabel(asset)} · {methodLabel(asset.selectedMethod)}{required ? ' · Current asset' : ''}</small>
                          </span>
                          <span className={styles.pdfAssetDownloadValue}>
                            <strong>{money(asset.value)}</strong>
                            <small>current value</small>
                          </span>
                        </label>
                      );
                    }) : <div className={styles.pdfAssetDownloadEmpty}>No assets match your search.</div>}
                  </div>
                </section>
                <div className={`${styles.formActions} ${styles.exportActions} ${styles.pdfAssetDownloadActions}`}>
                  <button type="button" className={styles.secondaryButton} onClick={() => setBulkFinanceAssetPickerOpen(false)}>Back</button>
                  <button type="button" className={styles.primaryButton} onClick={() => setBulkFinanceAssetPickerOpen(false)}>{bulkFinanceAssetIds.length} selected · Done</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {disposalCandidateAsset ? (
        <div className={`${styles.modalOverlay} ${styles.confirmDeleteOverlay}`}>
          <div className={styles.modalBackdrop} onClick={() => { if (!busyDeleteId) setDisposalCandidateAsset(null); }} />
          <form className={`${styles.modalCard} ${styles.assetLifecycleModal} ${styles.assetDisposalModal}`} role="dialog" aria-modal="true" aria-labelledby="disposal-title" onSubmit={handleConfirmDisposal}>
            <div className={`${styles.modalHeader} ${styles.assetDisposalHeader}`}>
              <div className={styles.modalHeaderText}>
                <h3 id="disposal-title">What happened to this asset?</h3>
                <p>{disposalCandidateAsset.title}</p>
              </div>
              <button type="button" className={styles.modalCloseButton} onClick={() => setDisposalCandidateAsset(null)} disabled={busyDeleteId === disposalCandidateAsset.id} aria-label="Close disposal details">
                <CloseIcon className={styles.buttonIcon} />
              </button>
            </div>
            <div className={`${styles.modalScrollBody} ${styles.assetLifecycleBody} ${styles.assetDisposalBody}`}>
              <div className={styles.assetDisposalIntro}><strong>Choose what happened</strong><small>The asset will be archived unless it was added by mistake.</small></div>
              <div className={styles.assetDisposalReasonGrid} role="group" aria-label="Reason for removing asset">
                {([
                  ['sold', 'Sold'],
                  ['traded_in', 'Traded in'],
                  ['scrapped', 'Scrapped'],
                  ['written_off', 'Written off'],
                  ['mistake_duplicate', 'Added by mistake'],
                  ['other', 'Other'],
                ] as const).map(([value, label]) => (
                  <button key={value} type="button" className={`${styles.assetDisposalReasonButton} ${disposalDraft.reason === value ? styles.assetDisposalReasonButtonActive : ''}`} aria-pressed={disposalDraft.reason === value} onClick={() => setDisposalDraft((current) => ({ ...current, reason: value as DisposalReason }))}>
                    <span className={styles.assetDisposalReasonMarker} aria-hidden="true" />
                    <strong>{label}</strong>
                  </button>
                ))}
              </div>
              {disposalDraft.reason !== 'mistake_duplicate' ? (
                <div className={`${styles.assetLifecycleFields} ${styles.assetDisposalFields}`}>
                  <label className={styles.assetSettingsField}>
                    <span>Disposal date</span>
                    <input type="date" required value={disposalDraft.disposalDate} onChange={(event) => setDisposalDraft((current) => ({ ...current, disposalDate: event.target.value }))} />
                  </label>
                  <label className={styles.assetSettingsField}>
                    <span>Disposal amount <small>Optional, excl. VAT</small></span>
                    <input inputMode="decimal" value={disposalDraft.disposalAmountExVat} onChange={(event) => setDisposalDraft((current) => ({ ...current, disposalAmountExVat: event.target.value }))} placeholder="R 0" />
                  </label>
                  <label className={`${styles.assetSettingsField} ${styles.assetDisposalNoteField}`}>
                    <span>Note <small>Optional</small></span>
                    <textarea value={disposalDraft.note} onChange={(event) => setDisposalDraft((current) => ({ ...current, note: event.target.value }))} placeholder="Add a buyer, trade-in, write-off or other reference" />
                  </label>
                </div>
              ) : null}
              {disposalDraft.reason === 'mistake_duplicate' ? (
                <p className={`${styles.assetLifecycleNotice} ${styles.assetDisposalDeleteNotice}`}>
                  No explanation is required. This permanently removes the duplicate asset while retaining its deletion audit and final snapshot.
                </p>
              ) : null}
              <div className={`${styles.assetSettingsActions} ${styles.assetDisposalActions}`}>
                <button type="button" className={styles.secondaryButton} onClick={() => setDisposalCandidateAsset(null)} disabled={busyDeleteId === disposalCandidateAsset.id}>Cancel</button>
                <button type="submit" className={`${styles.primaryButton} ${styles.deleteConfirmButton}`} disabled={busyDeleteId === disposalCandidateAsset.id || !disposalDraft.reason}>
                  {busyDeleteId === disposalCandidateAsset.id ? 'Saving…' : disposalDraft.reason === 'mistake_duplicate' ? 'Delete duplicate' : 'Save disposal'}
                </button>
              </div>
            </div>
          </form>
        </div>
      ) : null}

      {isExportModalOpen ? (
        <div className={`${styles.modalOverlay} ${styles.exportModalOverlay}`}>
          <div className={styles.modalBackdrop} onClick={closeExportModal} />

          <div
            className={`${styles.modalCard} ${styles.exportModal} ${exportStep === 'pdf-assets' ? styles.exportAssetPickerModal : ''}`}
            role="dialog"
            aria-modal="true"
            aria-labelledby="export-title"
          >
            <div className={`${styles.modalHeader} ${styles.exportModalHeader}`}>
              <div className={styles.modalHeaderText}>
                <h3 id="export-title">Export asset register</h3>
              </div>

              <button type="button" className={styles.modalCloseButton} onClick={closeExportModal} aria-label="Close export options">
                <CloseIcon className={styles.buttonIcon} />
              </button>
            </div>

            <div className={`${styles.modalScrollBody} ${styles.exportModalScrollBody}`}>
              <div className={styles.exportModalBody}>
                {exportStep === 'format' ? (
                  <>
                    <label className={`${styles.field} ${styles.exportEntityNameField}`}>
                      <span>Asset register / report name</span>
                      <input
                        value={exportEntityName}
                        onChange={(event) => setExportEntityName(event.target.value)}
                        placeholder="Enter the asset register or report name"
                        disabled={isExporting}
                      />
                    </label>

                    <div className={styles.exportChoices}>
                      <button
                        type="button"
                        className={`${styles.exportOption} ${exportFormat === 'pdf' ? styles.exportOptionActive : ''}`}
                        onClick={() => selectExportFormat('pdf')}
                        aria-pressed={exportFormat === 'pdf'}
                      >
                        <span className={styles.exportGraphic}>
                          <ExportGraphic src="/brand/pdf.png" alt="PDF export" icon={<PdfIcon className={styles.exportOptionIcon} />} />
                        </span>

                        <span className={styles.exportOptionTitleBlock}>
                          <strong>PDF report</strong>
                          <small>Choose a clear PDF report for clients, banks or insurance partners.</small>
                        </span>
                      </button>

                      <button
                        type="button"
                        className={`${styles.exportOption} ${exportFormat === 'xlsx' ? styles.exportOptionActive : ''}`}
                        onClick={() => selectExportFormat('xlsx')}
                        aria-pressed={exportFormat === 'xlsx'}
                      >
                        <span className={styles.exportGraphic}>
                          <ExportGraphic src="/brand/sheet.png" alt="Spreadsheet export" icon={<SpreadsheetIcon className={styles.exportOptionIcon} />} />
                        </span>

                        <span className={styles.exportOptionTitleBlock}>
                          <strong>XLSX workbook</strong>
                          <small>Download all register rows in an Excel-ready workbook.</small>
                        </span>
                      </button>
                    </div>

                    <div className={`${styles.formActions} ${styles.exportActions}`}>
                      <button type="button" className={styles.secondaryButton} onClick={closeExportModal} disabled={isExporting}>
                        Cancel
                      </button>

                      <button type="button" className={styles.primaryButton} onClick={handleConfirmExport} disabled={isExporting}>
                        {exportFormat === 'pdf' ? <ChevronRightIcon className={styles.buttonIcon} /> : <DownloadIcon className={styles.buttonIcon} />}
                        <span>{exportFormat === 'pdf' ? 'Next' : isExporting ? 'Preparing export...' : 'Download XLSX'}</span>
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    {exportStep === 'pdf-report' ? (
                      <>
                        <div className={styles.pdfReportSelector}>
                          <div className={styles.pdfReportTopChoices}>
                            <button
                              type="button"
                              className={`${styles.pdfReportOption} ${styles.pdfReportPrimaryOption} ${pdfReportSelection === fullPdfReportOption.value ? styles.pdfReportOptionActive : ''}`}
                              onClick={() => handlePdfReportChoice(fullPdfReportOption.value)}
                              disabled={isExporting}
                              aria-pressed={pdfReportSelection === fullPdfReportOption.value}
                            >
                              <span className={styles.pdfReportOptionMain}>
                                <strong>{fullPdfReportOption.label}</strong>
                              </span>
                            </button>

                            <button
                              type="button"
                              className={`${styles.pdfReportOption} ${styles.pdfReportPrimaryOption} ${styles.pdfReportSpecificOption}`}
                              onClick={openPdfAssetChooser}
                              disabled={isExporting}
                            >
                              <span className={styles.pdfReportOptionMain}>
                                <strong>Choose Specific Assets</strong>
                              </span>
                            </button>
                          </div>

                          <div className={styles.pdfReportChoices}>
                            {quickPdfReportOptions.map((option) => (
                              <button
                                key={option.value}
                                type="button"
                                className={`${styles.pdfReportOption} ${pdfReportSelection === option.value ? styles.pdfReportOptionActive : ''}`}
                                onClick={() => handlePdfReportChoice(option.value)}
                                disabled={isExporting}
                                aria-pressed={pdfReportSelection === option.value}
                              >
                                <span className={styles.pdfReportOptionMain}>
                                  <span className={styles.pdfReportQuickLabel}>{ASSET_FILTER_LABEL_BY_VALUE.get(option.value) ?? option.label}</span>
                                </span>
                              </button>
                            ))}
                          </div>
                        </div>

                        <div className={`${styles.formActions} ${styles.exportActions}`}>
                          <button type="button" className={styles.secondaryButton} onClick={closePdfReportChooser} disabled={isExporting}>
                            Back
                          </button>

                          <button type="button" className={styles.secondaryButton} onClick={closeExportModal} disabled={isExporting}>
                            Cancel
                          </button>
                        </div>
                      </>
                    ) : (
                      <>
                        <section className={styles.pdfAssetDownloadPanel} aria-label="Choose assets for PDF download">
                          <div className={styles.pdfAssetDownloadToolbar}>
                            <input
                              className={styles.pdfAssetSearchInput}
                              type="search"
                              value={pdfAssetSearchTerm}
                              onChange={(event) => setPdfAssetSearchTerm(event.target.value)}
                              placeholder="Search..."
                              aria-label="Search assets"
                              disabled={isExporting}
                            />

                            <div className={styles.pdfAssetDownloadToolbarActions}>
                              <button
                                type="button"
                                className={styles.secondaryButton}
                                onClick={selectAllPdfAssets}
                                disabled={isExporting || visiblePdfAssets.length === 0 || allVisiblePdfAssetsSelected}
                              >
                                Select all
                              </button>

                              <button
                                type="button"
                                className={styles.secondaryButton}
                                onClick={clearSelectedPdfAssets}
                                disabled={isExporting || selectedPdfAssetCount === 0}
                              >
                                Clear
                              </button>
                            </div>
                          </div>

                          <div className={styles.pdfAssetDownloadList}>
                            {visiblePdfAssets.length ? (
                              visiblePdfAssets.map((asset) => {
                                const isSelectedForPdf = selectedPdfAssetIdSet.has(asset.id);

                                return (
                                  <label
                                    key={asset.id}
                                    className={`${styles.pdfAssetDownloadRow} ${isSelectedForPdf ? styles.pdfAssetDownloadRowSelected : ''}`}
                                  >
                                    <input
                                      className={styles.pdfAssetDownloadCheckboxInput}
                                      type="checkbox"
                                      checked={isSelectedForPdf}
                                      onChange={() => togglePdfAssetSelection(asset.id)}
                                      disabled={isExporting}
                                    />
                                    <span className={styles.pdfAssetDownloadCheckbox} aria-hidden="true" />

                                    <span className={styles.pdfAssetDownloadCopy}>
                                      <strong>{asset.title}</strong>
                                      <span>{buildAssetMeta(asset)}</span>
                                      <small>{assetKindLabel(asset)} · {methodLabel(asset.selectedMethod)}</small>
                                    </span>

                                    <span className={styles.pdfAssetDownloadValue}>
                                      <strong>{money(asset.value)}</strong>
                                      <small>current value</small>
                                    </span>
                                  </label>
                                );
                              })
                            ) : (
                              <div className={styles.pdfAssetDownloadEmpty}>No assets match your search.</div>
                            )}
                          </div>
                        </section>

                        <div className={`${styles.formActions} ${styles.exportActions} ${styles.pdfAssetDownloadActions}`}>
                          <button type="button" className={styles.secondaryButton} onClick={backToPdfReportChooser} disabled={isExporting}>
                            Back
                          </button>

                          <button type="button" className={styles.secondaryButton} onClick={closeExportModal} disabled={isExporting}>
                            Cancel
                          </button>

                          <button
                            type="button"
                            className={`${styles.primaryButton} ${styles.pdfAssetDownloadButton}`}
                            onClick={() => void handleExportSelectedPdfReport()}
                            disabled={isExporting || selectedPdfAssetCount === 0}
                          >
                            <DownloadIcon className={styles.buttonIcon} />
                            <span>{isExporting ? 'Preparing PDF...' : selectedPdfAssetCount ? `Download ${selectedPdfAssetCount} selected PDF` : 'Download selected PDF'}</span>
                          </button>
                        </div>
                      </>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {marketplaceAsset && marketplaceDraft ? (
        <div className={`${styles.modalOverlay} ${styles.subModalOverlay}`}>
          <div className={styles.modalBackdrop} onClick={closeMarketplaceModal} />

          <div className={`${styles.modalCard} ${styles.marketplaceModal}`} role="dialog" aria-modal="true" aria-labelledby="marketplace-confirm-title">
            <div className={`${styles.modalHeader} ${styles.marketplaceModalHeader}`}>
              <div className={styles.modalHeaderText}>
                <h3 id="marketplace-confirm-title">{marketplaceModalTitle}</h3>
                <p>Check the listing title, asking price, photos and seller details before it goes live.</p>
              </div>

              <button type="button" className={styles.modalCloseButton} onClick={closeMarketplaceModal} aria-label="Close marketplace modal">
                <CloseIcon className={styles.buttonIcon} />
              </button>
            </div>

            <div className={`${styles.modalScrollBody} ${styles.marketplaceModalScrollBody}`}>
              <form className={styles.marketplaceForm} onSubmit={handleConfirmMarketplacePublish}>
                <section className={styles.marketplaceAssetSummary}>
                  <div className={styles.marketplaceTitlePreview}>
                    <span>Listing title</span>
                    <strong>{marketplaceListingTitle}</strong>
                    <small>Year model, usage and condition are included in the marketplace title.</small>
                  </div>

                  <div className={styles.marketplaceAssetSummaryValue}>
                    <span>Register value</span>
                    <strong>{money(marketplaceAsset.value)}</strong>
                    <small>Excl. VAT</small>
                  </div>
                </section>

                <div className={styles.marketplaceBodyGrid}>
                  <div className={styles.marketplaceListingColumn}>
                    <section className={styles.marketplacePricePanel}>
                      <label className={`${styles.field} ${styles.marketplacePriceField}`}>
                        <span>Asking price excl. VAT</span>
                        <div className={styles.marketplaceCurrencyInput}>
                          <span className={styles.marketplaceCurrencyPrefix}>R</span>
                          <input
                            type="text"
                            inputMode="numeric"
                            value={marketplaceDraft.askingPriceExVat}
                            onChange={(event) =>
                              setMarketplaceDraft((current) =>
                                current ? { ...current, askingPriceExVat: formatMarketplacePriceInput(event.target.value) } : current,
                              )
                            }
                            onBlur={() =>
                              setMarketplaceDraft((current) =>
                                current ? { ...current, askingPriceExVat: formatMarketplacePriceInput(current.askingPriceExVat) } : current,
                              )
                            }
                            placeholder="0"
                            autoFocus
                            aria-label="Marketplace price excluding VAT"
                          />
                        </div>
                        <small className={styles.marketplacePriceHint}>The entered price is saved as the listing asking price excluding VAT.</small>
                      </label>
                    </section>

                    <section className={styles.marketplacePhotosPanel}>
                      <div className={styles.marketplacePanelHeading}>
                        <span>Photos</span>
                        <small>
                          {marketplacePhotoUrls.length
                            ? `${marketplacePhotoUrls.length} uploaded photo${marketplacePhotoUrls.length === 1 ? '' : 's'} will be shown on the listing.`
                            : 'No photos are uploaded for this asset yet.'}
                        </small>
                      </div>

                      {marketplacePhotoUrls.length ? (
                        <div className={styles.marketplacePhotoPreview}>
                          <img
                            src={marketplacePhotoUrls[0]}
                            alt={`${marketplaceAsset.title} main marketplace photo`}
                            className={styles.marketplaceMainPhoto}
                          />

                          {marketplacePhotoUrls.length > 1 ? (
                            <div className={styles.marketplacePhotoStrip} aria-label="Marketplace listing photos">
                              {marketplacePhotoUrls.slice(0, 6).map((photoUrl, index) => (
                                <img key={`${photoUrl}-${index}`} src={photoUrl} alt={`${marketplaceAsset.title} photo ${index + 1}`} />
                              ))}
                              {marketplacePhotoUrls.length > 6 ? <span>+{marketplacePhotoUrls.length - 6}</span> : null}
                            </div>
                          ) : null}
                        </div>
                      ) : (
                        <div className={styles.marketplaceNoPhotos}>
                          <strong>No photos uploaded</strong>
                          <span>Add photos in Update asset to show real asset photos on the marketplace.</span>
                        </div>
                      )}
                    </section>

                    <label className={`${styles.field} ${styles.marketplaceNotesField}`}>
                      <span>Listing notes</span>
                      <textarea
                        value={marketplaceDraft.description}
                        onChange={(event) => setMarketplaceDraft((current) => (current ? { ...current, description: event.target.value } : current))}
                        placeholder="Add important buyer notes, extras, service history or known issues."
                      />
                    </label>
                  </div>

                  <section className={styles.marketplaceSellerPanel}>
                    <div className={styles.marketplaceSellerHeader}>
                      <h4>Edit seller details</h4>
                      <span>Shown to signed-in marketplace users</span>
                    </div>

                    <div className={styles.marketplaceSellerGrid}>
                      <label className={`${styles.field} ${styles.marketplaceContactField} ${styles.marketplaceWideField}`}>
                        <span>Business name</span>
                        <input
                          value={marketplaceDraft.sellerCompany}
                          onChange={(event) => setMarketplaceDraft((current) => (current ? { ...current, sellerCompany: event.target.value } : current))}
                          placeholder="Business name"
                          aria-label="Business name"
                        />
                      </label>

                      <label className={`${styles.field} ${styles.marketplaceContactField}`}>
                        <span>Contact name</span>
                        <input
                          value={marketplaceDraft.sellerName}
                          onChange={(event) => setMarketplaceDraft((current) => (current ? { ...current, sellerName: event.target.value } : current))}
                          placeholder="Contact name"
                          aria-label="Contact name"
                        />
                      </label>

                      <label className={`${styles.field} ${styles.marketplaceContactField}`}>
                        <span>Phone</span>
                        <input
                          value={marketplaceDraft.sellerPhone}
                          onChange={(event) => setMarketplaceDraft((current) => (current ? { ...current, sellerPhone: event.target.value } : current))}
                          placeholder="Phone"
                          aria-label="Phone"
                        />
                      </label>

                      <label className={`${styles.field} ${styles.marketplaceContactField} ${styles.marketplaceWideField}`}>
                        <span>Business email</span>
                        <input
                          type="email"
                          value={marketplaceDraft.sellerEmail}
                          onChange={(event) => setMarketplaceDraft((current) => (current ? { ...current, sellerEmail: event.target.value } : current))}
                          placeholder="Business email"
                          aria-label="Business email"
                        />
                      </label>

                      <label className={`${styles.field} ${styles.marketplaceContactField}`}>
                        <span>Province</span>
                        <input
                          value={marketplaceDraft.province}
                          onChange={(event) => setMarketplaceDraft((current) => (current ? { ...current, province: event.target.value } : current))}
                          placeholder="Province"
                          aria-label="Province"
                        />
                      </label>

                      <label className={`${styles.field} ${styles.marketplaceContactField}`}>
                        <span>Area</span>
                        <input
                          value={marketplaceDraft.area}
                          onChange={(event) => setMarketplaceDraft((current) => (current ? { ...current, area: event.target.value } : current))}
                          placeholder="Area"
                          aria-label="Area"
                        />
                      </label>
                    </div>
                  </section>
                </div>

                <div className={`${styles.formActions} ${styles.marketplaceActions}`}>
                  <button type="button" className={styles.secondaryButton} onClick={closeMarketplaceModal} disabled={isPublishingMarketplace}>
                    Cancel
                  </button>

                  {isLiveOnMarketplace(marketplaceAsset) ? (
                    <button
                      type="button"
                      className={`${styles.secondaryButton} ${styles.ownerMarketplaceRemoveButton}`}
                      onClick={() => void handleRemoveFromMarketplace(marketplaceAsset)}
                      disabled={isPublishingMarketplace || busyMarketplaceRemoveId === marketplaceAsset.id}
                    >
                      {busyMarketplaceRemoveId === marketplaceAsset.id ? 'Removing...' : 'Remove listing'}
                    </button>
                  ) : null}

                  <button
                    type="submit"
                    className={styles.primaryButton}
                    disabled={isPublishingMarketplace || (parseMoneyInput(marketplaceDraft.askingPriceExVat) ?? 0) <= 0}
                  >
                    {isPublishingMarketplace
                      ? 'Publishing...'
                      : isLiveOnMarketplace(marketplaceAsset)
                        ? 'Update and view listing'
                        : 'Confirm and view listing'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      ) : null}

      {activeAsset && isQrModalOpen ? (
        <div className={`${styles.modalOverlay} ${styles.subModalOverlay}`}>
          <div className={styles.modalBackdrop} onClick={closeQrDialog} />

          <div className={`${styles.modalCard} ${styles.qrModal}`} role="dialog" aria-modal="true" aria-labelledby="asset-qr-title">
            <div className={`${styles.modalHeader} ${styles.qrModalHeader}`}>
              <div className={styles.modalHeaderText}>
                <h3 id="asset-qr-title">{activeAsset.title}</h3>
                <p>Use this permanent QR for scan access. Public QR scans always ask for the farm PIN.</p>
              </div>

              <button type="button" className={styles.modalCloseButton} onClick={closeQrDialog} aria-label="Close QR code">
                <CloseIcon className={styles.buttonIcon} />
              </button>
            </div>

            <div className={`${styles.modalScrollBody} ${styles.qrModalScrollBody}`}>
              <div className={styles.qrModalBody}>
                <div className={styles.qrPreviewCard}>
                  <span className={styles.qrPreviewEyebrow}>Permanent asset QR</span>
                  <div className={styles.qrPreviewFrame}>
                    {activeAsset.publicAssetCode ? (
                      <img src={buildAssetQrSvgUrl(activeAsset)} alt={`QR code for ${activeAsset.title}`} />
                    ) : (
                      <p className={styles.qrPreviewFallback}>QR artwork is not ready for this asset yet.</p>
                    )}
                  </div>
                </div>

                <div className={styles.qrPrimaryActionsCard}>
                  <button
                    type="button"
                    className={`${styles.qrPrimaryActionButton} ${copiedScanLinkAssetId === activeAsset.id ? styles.qrCopiedButton : ''}`}
                    onClick={() => void handleCopyScanLink(activeAsset)}
                  >
                    <CopyIcon className={styles.buttonIcon} />
                    <span>{copiedScanLinkAssetId === activeAsset.id ? 'Copied' : 'Copy scan link'}</span>
                  </button>

                  <button type="button" className={styles.qrPrimaryActionButton} onClick={() => handlePrintQrSheet(activeAsset)}>
                    <PrintIcon className={styles.buttonIcon} />
                    <span>Print QR label</span>
                  </button>

                  <button type="button" className={styles.qrPrimaryActionButton} onClick={() => void handleDownloadQr(activeAsset)}>
                    <QrIcon className={styles.buttonIcon} />
                    <span>Download QR</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {projectionAsset ? (
        <div className={styles.modalOverlay}>
          <div className={styles.modalBackdrop} onClick={closeProjectionModal} />

          <div className={`${styles.modalCard} ${styles.projectionModal}`} role="dialog" aria-modal="true" aria-labelledby="projection-title">
            <div className={`${styles.modalHeader} ${styles.projectionModalHeader}`}>
              <div className={styles.modalHeaderText}>
                <h3 id="projection-title">{projectionAsset.title}</h3>
                <p>Choose the future year, inflation, condition and usage. Quick selections recalculate instantly.</p>
              </div>

              <button type="button" className={styles.modalCloseButton} onClick={closeProjectionModal} aria-label="Close future price modal">
                <CloseIcon className={styles.buttonIcon} />
              </button>
            </div>

            <div className={`${styles.modalScrollBody} ${styles.projectionScrollBody}`}>
              <div className={styles.projectionSimpleBody}>
                <div className={styles.projectionBaselineStrip}>
                  <div>
                    <span>Current saved value</span>
                    <strong>{money(projectionAsset.value)}</strong>
                  </div>
                  <div>
                    <span>Current condition</span>
                    <strong>{conditionLabel(projectionAsset.condition)}</strong>
                  </div>
                  <div>
                    <span>Current usage</span>
                    <strong>{buildAssetUsageValue(projectionAsset)}</strong>
                  </div>
                </div>

                <section className={styles.projectionSimpleCard}>
                  <div className={styles.projectionSimpleSectionHeader}>
                    <h4>Future settings</h4>
                    <p>{projectionUsageHelpText}</p>
                  </div>

                  <div className={styles.projectionInputRow}>
                    <ModalSelect<string>
                      label="Target year"
                      value={projectionForm.targetYear}
                      options={projectionYearSelectOptions}
                      onChange={(value) => updateProjectionForm({ targetYear: value })}
                      className={styles.projectionYearSelectField}
                    />

                    <label className={styles.field}>
                      <span>Inflation % p.a.</span>
                      <input
                        type="number"
                        min="-50"
                        max="200"
                        step="0.1"
                        value={projectionForm.inflationRatePct}
                        onChange={(event) => updateProjectionForm({ inflationRatePct: event.target.value })}
                      />
                    </label>

                    <label className={styles.field}>
                      <span>{projectionUsageFieldLabel}</span>
                      <input
                        type="number"
                        min="0"
                        max={projectionUsesPercentUsage ? '100' : undefined}
                        step={projectionUsesPercentUsage ? '0.1' : '50'}
                        value={projectionUsesPercentUsage ? projectionForm.targetLifeWorkedPercent : projectionForm.extraHours}
                        onChange={(event) => updateProjectionForm(
                          projectionUsesPercentUsage
                            ? { targetLifeWorkedPercent: event.target.value }
                            : { extraHours: event.target.value },
                        )}
                        placeholder={projectionUsagePlaceholder}
                      />
                    </label>
                  </div>

                  <div className={styles.projectionQuickRow}>
                    <div className={styles.projectionQuickCopy}>
                      <span>Quick inflation</span>
                      <small>Choose a rate to recalculate instantly.</small>
                    </div>
                    <div className={styles.projectionQuickButtons}>
                      {PROJECTION_INFLATION_PRESETS.map((rate) => {
                        const isSelected = projectionForm.inflationRatePct === rate;

                        return (
                          <button
                            key={rate}
                            type="button"
                            className={`${styles.projectionPresetButton} ${isSelected ? styles.projectionPresetButtonActive : ''}`}
                            aria-pressed={isSelected}
                            onClick={() => handleProjectionPreset({ inflationRatePct: rate })}
                          >
                            {rate}%
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className={styles.projectionConditionCard}>
                    <div className={styles.projectionConditionHeader}>
                      <span>Future condition</span>
                      <small>Select the expected condition. The retained value percentage matches the estimate page.</small>
                    </div>
                    <div className={styles.projectionConditionGrid}>
                      {PROJECTION_CONDITION_OPTIONS.map((option) => {
                        const isSelected = projectionForm.targetCondition === option.key;

                        return (
                          <button
                            key={option.key}
                            type="button"
                            className={`${styles.projectionConditionButton} ${isSelected ? styles.projectionConditionButtonActive : ''}`}
                            aria-pressed={isSelected}
                            onClick={() => handleProjectionPreset({ targetCondition: option.key })}
                          >
                            <strong>{option.label}</strong>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <button type="button" className={`${styles.primaryButton} ${styles.projectionFullWidthButton}`} onClick={handleProjectionSubmit} disabled={isLoadingProjection}>
                    {isLoadingProjection ? 'Calculating...' : 'Calculate future price'}
                  </button>
                </section>

                {projectionError ? <div className={styles.projectionError}>{projectionError}</div> : null}

                {projectionResult ? (
                  <section ref={projectionResultRef} className={styles.projectionSimpleResult} aria-live="polite">
                    <span>Projected future price</span>
                    <strong>{money(projectionResult.projected.retailExVat)}</strong>
                    <p>Estimated ex VAT value for {projectionResult.targetYear}.</p>

                    <div className={styles.projectionSimpleMeta}>
                      <div>
                        <span>Year</span>
                        <strong>{projectionResult.baseYear} → {projectionResult.targetYear}</strong>
                      </div>
                      <div>
                        <span>{projectionUsageMetaLabel}</span>
                        <strong>
                          {projectionUsesPercentUsage
                            ? `${formatProjectionWorkedPercent(projectionCurrentWorkedPercent)} → ${formatProjectionWorkedPercent(projectionTargetWorkedPercent)}`
                            : `${projectionResult.current.hours.toLocaleString('en-ZA')} → ${projectionResult.projected.hours.toLocaleString('en-ZA')} ${projectionUsageShortUnit}`}
                        </strong>
                      </div>
                      <div>
                        <span>Inflation</span>
                        <strong>{formatPercent(projectionResult.inflationRatePct)} p.a.</strong>
                      </div>
                      <div>
                        <span>Condition</span>
                        <strong>{conditionLabel(projectionCurrentCondition)} → {conditionLabel(projectionTargetCondition)}</strong>
                        <small>
                          {projectionConditionRetainedPercent(projectionCurrentCondition)}% → {projectionConditionRetainedPercent(projectionTargetCondition)}% retained
                        </small>
                      </div>
                    </div>
                  </section>
                ) : isLoadingProjection ? (
                  <div className={styles.projectionLoading}>Calculating future price...</div>
                ) : (
                  <div className={styles.projectionEmptyResult}>
                    <strong>No projection yet</strong>
                    <span>Enter the simple settings above and calculate.</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {documentUploadAsset ? (
        <AssetDocumentUploadModal
          assetId={documentUploadAsset.id}
          assetTitle={documentUploadAsset.title}
          uploadEndpoint={accountantShareId ? assetVaultDocumentsUrl(documentUploadAsset.id) : '/api/documents'}
          onClose={() => closeAssetDocumentUpload(documentUploadAsset.id)}
          onUploaded={(documents, outcome) => handleVaultDocumentsUploaded(documentUploadAsset, documents, outcome)}
        />
      ) : null}

      <AssetGroupManagerModal
        open={isAssetGroupModalOpen}
        anchorAsset={assetGroupModalAsset}
        group={assetGroupModalGroup}
        assets={assetGroupModalAssets}
        groups={assetGroups}
        combinedMode={isCombinedRegisterView}
        busy={isSavingAssetGroup}
        reportBusy={isExporting}
        error={assetGroupError}
        onClose={closeAssetGroupManager}
        onSave={handleSaveAssetGroup}
        onDelete={handleDeleteAssetGroup}
        onDownloadPdf={handleDownloadAssetGroupPdf}
        onDownloadXlsx={handleDownloadAssetGroupXlsx}
        onDownloadReport={handleDownloadAssetGroupReport}
      />

      {isAccountantReportsOpen && accountantShareId && accountantAccess ? (
        <AccountantRegisterReportsModal
          shareId={accountantShareId}
          registerName={activeRegister?.businessName || accountantAccess.ownerBusinessName || 'Asset Register'}
          includeFuelLedger={accountantAccess.includeFuelLedger}
          includeCostLedger={accountantAccess.includeCostLedger}
          onClose={() => setIsAccountantReportsOpen(false)}
        />
      ) : null}
    </main>
  );
}
