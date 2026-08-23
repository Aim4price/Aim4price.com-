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
import AssetExternalShare, {
  AssetShareDestinationPicker,
  type ExternalShareFileSource,
} from '../../components/asset-register/AssetExternalShare';
import { fetchExternalShareFile } from '../../lib/external-file-share';
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
  buildAssetRegisterSummaryReportHtml,
  buildAssetSheetReportHtml,
  type AssetRegisterSummaryPayload,
  type AssetSheetPayload,
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
type ExternalShareReportScope = 'asset' | 'register' | 'group' | null;
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
  deliveryMode?: 'download' | 'attach';
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

const MAINTENANCE_REPORT_TYPE_LABELS: Record<string, string> = {
  checked: 'Checked',
  serviced: 'Service',
  repaired: 'Repair',
  upcoming: 'Upcoming maintenance',
  done: 'Completed maintenance',
  service: 'Services only',
  checkup: 'Check-ups only',
};

function buildReportAttachmentFilterMeta(filters?: AssetPdfReportFilters): {
  labelSuffix: string;
  fileSuffix: string;
} {
  const year = filters?.year && filters.year !== 'all' ? filters.year : '';
  const month = filters?.month && filters.month !== 'all' ? filters.month.padStart(2, '0') : '';
  const monthIndex = month ? Number(month) - 1 : -1;
  const monthLabel = monthIndex >= 0 && monthIndex < MONTH_LABELS.length ? MONTH_LABELS[monthIndex] : '';
  const maintenanceType = filters?.maintenanceType && filters.maintenanceType !== 'all'
    ? filters.maintenanceType
    : '';
  const maintenanceLabel = maintenanceType
    ? MAINTENANCE_REPORT_TYPE_LABELS[maintenanceType] ?? maintenanceType.replace(/[-_]+/g, ' ')
    : '';
  const periodLabel = year && monthLabel ? `${monthLabel} ${year}` : year || monthLabel;
  const labelParts = [maintenanceLabel, periodLabel].filter(Boolean);
  const fileParts = [maintenanceType, year, month].filter(Boolean);

  return {
    labelSuffix: labelParts.length ? ` Â· ${labelParts.join(' Â· ')}` : '',
    fileSuffix: fileParts.length ? `-${fileParts.join('-')}` : '',
  };
}

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

function AssetReportFormatPicker({ value, deliveryMode = 'download', onChange }: AssetReportFormatPickerProps) {
  const isAttaching = deliveryMode === 'attach';
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
          <small>{isAttaching ? 'Attach a clear report for clients, banks or insurance partners.' : 'Open a clear report for clients, banks or insurance partners.'}</small>
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
          <small>{isAttaching ? 'Attach the selected timeline records as an Excel-ready workbook.' : 'Download the selected timeline records in an Excel-ready workbook.'}</small>
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
  if (!value) return 'â€”';

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return 'â€”';

  return new Intl.DateTimeFormat('en-ZA', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(parsed);
}

function formatDateTime(value?: string | null, fallback = 'â€”'): string {
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
  const text = value.trim().replace(/[Â°]/g, '').replace(/\s+/g, '');
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
  return formatted ? `${formatted}%` : 'â€”';
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
  return parts.join(' Â· ');
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
  return registrationNumber ? `Licensed Â· ${registrationNumber}` : 'Licensed';
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
    yes: { label: 'âœ“', className: styles.statusMarkYes, title: 'Yes' },
    paid: { label: 'âœ“', className: styles.statusMarkYes, title: 'Paid off' },
    no: { label: 'Ã—', className: styles.statusMarkNo, title: 'No' },
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
      '': 'â€”',
    }[value] ?? 'â€”'
  );
}

function formatDrive(value: string): string {
  if (value === '4wd') return '4WD';
  if (value === '2wd') return '2WD';
  if (value === 'tracks') return 'Tracks';
  return value || 'â€”';
}

function formatCab(value: string): string {
  if (value === 'cab') return 'Cab';
  if (value === 'open-station') return 'Open station';
  return value || 'â€”';
}

function formatTractorType(value: string): string {
  if (value === 'field') return 'Field';
  if (value === 'orchard') return 'Orchard';
  return value || 'â€”';
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
  return text.length > 34 ? `${text.slice(0, 18)}â€¦${text.slice(-10)}` : text;
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
    brandName: derivedBrandName === 'â€”' ? '' : derivedBrandName,
    modelName: derivedModelName === 'â€”' ? '' : derivedModelName,
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
  return Boolean(normalized && normalized !== '-' && normalized !== 'â€”' && normalized !== 'unknown' && normalized !== 'n/a');
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
  return readAssetPropertySize(asset) || 'â€”';
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
  return isMeaningfulReportValue(fallback) ? fallback : 'â€”';
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

  return isMeaningfulReportValue(inferred) ? inferred : 'â€”';
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
    return 'â€”';
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
    return hasHours ? `${Math.round(hours).toLocaleString('en-ZA')} km` : 'â€”';
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

  return 'â€”';
}

function buildAssetUsageMeta(asset: RegisterAsset): string {
  const usageValue = buildAssetUsageValue(asset);
  return usageValue === 'â€”' ? '' : `Usage: ${usageValue}`;
}

function buildAssetMeta(asset: RegisterAsset): string {
  const propertySize = asset.kind === 'property' ? readAssetPropertySize(asset) : '';
  const parts = [
    asset.yearModel ? `${assetYearLabel(asset)}: ${asset.yearModel}` : '',
    asset.kind === 'property' ? (propertySize ? `Size: ${propertySize}` : '') : buildAssetUsageMeta(asset),
    asset.condition ? `Condition: ${conditionLabel(asset.condition)}` : '',
  ].filter(Boolean);

  return parts.join(' â€¢ ') || 'No key details saved yet';
}

function buildMarketplaceListingTitle(asset: RegisterAsset, includeMissingDetails = false): string {
  const baseTitle =
    String(asset.title ?? '').trim() ||
    [asset.brandName, asset.modelName].map((part) => part.trim()).filter(Boolean).join(' ') ||
    'Marketplace listing';
  const usageValue = buildAssetUsageValue(asset);
  const titleDetails = [
    asset.yearModel ? String(asset.yearModel) : includeMissingDetails ? 'Year not set' : '',
    usageValue !== 'â€”' ? usageValue : includeMissingDetails ? 'Usage not set' : '',
    asset.condition ? conditionLabel(asset.condition) : includeMissingDetails ? 'Condition not set' : '',
  ].filter(Boolean);

  return titleDetails.length ? `${baseTitle} Â· ${titleDetails.join(' Â· ')}` : baseTitle;
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

  return parts.join(' â€¢ ');
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

  return parts.join(' â€¢ ') || 'Aim4price asset register summary';
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
    format,
  });

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

function shareFileSlug(value: string, fallback = 'aim4price-report'): string {
  return String(value || fallback)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || fallback;
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
  format: ExportFormat = 'xlsx',
  assetIds: string[] = [],
): string {
  const params = new URLSearchParams({ format });
  if (format === 'pdf') params.set('reportKind', 'full');
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
  const cleanedAssetIds = Array.from(new Set(assetIds.map((id) => id.trim()).filter(Boolean)));
  if (cleanedAssetIds.length) params.set('assetIds', cleanedAssetIds.join(','));

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

function partnerNoteReportLabel(note: OpenPartnerNote, index: number, assetTitle?: string): string {
  const partnerType = note.partnerType ? formatQuotePartnerType(note.partnerType) : 'Partner';
  const assetSuffix = assetTitle ? ` Â· ${assetTitle}` : '';

  return `${partnerType} note ${index + 1} Â· ${partnerNoteAuthor(note)}${assetSuffix}`;
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
  if (partner.isAim4priceManaged) return 'Service area â€” not a physical branch';
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
  const [assetGroupModalInitialView, setAssetGroupModalInitialView] = useState<'menu' | 'reports'>('menu');
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
  const suppressShareFocusRestoreRef = useRef(false);
  const shareReturnFocusRef = useRef<HTMLElement | null>(null);
  const shareFocusHandoffRef = useRef<'asset-report' | 'export' | 'group-report' | null>(null);
  const externalShareReportTriggerRef = useRef<HTMLElement | null>(null);
  const selectedQuoteLeadTypeRef = useRef<AssetLeadType | null>(null);
  const quotePartnerSearchRef = useRef('');
  const assetSettingsMapElementRef = useRef<HTMLDivElement | null>(null);
  const assetSettingsLeafletMapRef = useRef<any>(null);
  const assetSettingsMapMarkerRef = useRef<any>(null);
  const [isAssetReportModalOpen, setIsAssetReportModalOpen] = useState(false);
  const [sharedReportAsset, setSharedReportAsset] = useState<RegisterAsset | null>(null);
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
  const [externalShareReportScope, setExternalShareReportScope] = useState<ExternalShareReportScope>(null);
  const [externalShareReportFiles, setExternalShareReportFiles] = useState<ExternalShareFileSource[]>([]);
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

  function restoreShareFocusAfterHandoff(kind: 'asset-report' | 'export' | 'group-report') {
    if (shareFocusHandoffRef.current !== kind) return;

    const returnFocus = shareReturnFocusRef.current;
    shareFocusHandoffRef.current = null;
    shareReturnFocusRef.current = null;

    if (returnFocus?.isConnected) {
      window.requestAnimationFrame(() => returnFocus.focus({ preventScroll: true }));
    }
  }

  function resetExternalShareDraft() {
    setExternalShareReportScope(null);
    setExternalShareReportFiles([]);
    externalShareReportTriggerRef.current = null;
  }

  function returnToExternalShareDraft() {
    if (!externalShareReportScope) return;

    const trigger = externalShareReportTriggerRef.current;
    setExternalShareReportScope(null);
    externalShareReportTriggerRef.current = null;

    if (trigger?.isConnected) {
      window.requestAnimationFrame(() => trigger.focus({ preventScroll: true }));
    }
  }

  function addExternalShareReport(source: ExternalShareFileSource) {
    setExternalShareReportFiles((current) => (
      current.some((file) => file.id === source.id)
        ? current
        : [...current, source]
    ));
    setNotice({ tone: 'success', message: `${source.label} added to your share.` });
  }

  function reportHtmlFingerprint(value: string): string {
    let hash = 2166136261;
    for (let index = 0; index < value.length; index += 1) {
      hash ^= value.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0).toString(36);
  }

  function buildExternalReportSource({
    label,
    description,
    fileName,
    url,
    format,
    html,
  }: {
    label: string;
    description: string;
    fileName: string;
    url: string;
    format: 'pdf' | 'xlsx';
    html?: string;
  }): ExternalShareFileSource {
    return {
      id: `report:${format}:${url}${html ? `:${reportHtmlFingerprint(html)}` : ''}`,
      kind: 'report',
      label,
      description,
      fileName,
      url,
      contentType: format === 'pdf'
        ? 'application/pdf'
        : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      credentials: 'include',
      ...(html
        ? {
            request: {
              method: 'POST' as const,
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ html, fileName }),
            },
          }
        : {}),
    };
  }

  async function openPreparedExternalReport(source: ExternalShareFileSource): Promise<boolean> {
    const reportWindow = window.open('', '_blank');
    if (!reportWindow) return false;

    try {
      const file = await fetchExternalShareFile(source);
      const objectUrl = window.URL.createObjectURL(file);
      reportWindow.location.replace(objectUrl);
      window.setTimeout(() => window.URL.revokeObjectURL(objectUrl), 60_000);
      return true;
    } catch (error) {
      reportWindow.close();
      throw error;
    }
  }

  function removeExternalShareReport(reportId: string) {
    setExternalShareReportFiles((current) => current.filter((file) => file.id !== reportId));
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
    setAssetGroupModalInitialView('menu');
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

    setAssetGroupModalInitialView('menu');
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
    setAssetGroupModalInitialView('menu');
    setAssetGroupError('');
    returnToExternalShareDraft();
    restoreShareFocusAfterHandoff('group-report');
  }

  function openAssetGroupReports(group: AssetGroup) {
    const anchorAsset = group.members
      .map((member) => assets.find((asset) => asset.id === member.assetId))
      .find((asset): asset is RegisterAsset => Boolean(asset)) ?? null;

    setAssetGroupModalInitialView('reports');
    setAssetGroupModalAsset(anchorAsset);
    setAssetGroupModalGroup(group);
    setAssetGroupError('');
    setIsAssetGroupModalOpen(true);
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
    if (!window.confirm(`Remove â€œ${group.name}â€? The assets and their records will not be deleted.`)) return;

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
  const reportAsset = sharedReportAsset ?? activeAsset;
  const isAttachingExternalReport = externalShareReportScope !== null;
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
      ...getAssetFuelReportYearValues(reportAsset).map((year) => ({ value: year, label: year })),
    ];
  }, [reportAsset]);
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
      description: `${Math.max(0, Math.round(Number(register.assetCount) || 0)).toLocaleString('en-ZA')} ${Number(register.assetCount) === 1 ? 'asset' : 'assets'} Â· ${money(Number(register.totalValue) || 0)} current value`,
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
          : `${registerName} Â· becomes a combined umbrella`;

      return {
        value: group.id,
        label: group.name,
        description: `${group.members.length} grouped ${group.members.length === 1 ? 'asset' : 'assets'} Â· ${scopeDescription} Â· ${assetGroupValueModeLabel(group)}`,
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
        description: `${Math.max(0, Math.round(Number(register.assetCount) || 0)).toLocaleString('en-ZA')} ${Number(register.assetCount) === 1 ? 'asset' : 'assets'} Â· ${money(Number(register.totalValue) || 0)} current value`,
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
    shareReturnFocusRef.current = returnFocus;
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
      const activeControlIndex = activeControl instanceof HTMLElement ? controls.indexOf(activeControl) : -1;

      if (activeControlIndex === -1) {
        event.preventDefault();
        (event.shiftKey ? lastControl : firstControl).focus();
      } else if (event.shiftKey && activeControl === firstControl) {
        event.preventDefault();
        lastControl.focus();
      } else if (!event.shiftKey && activeControl === lastControl) {
        event.preventDefault();
        firstControl.focus();
      }
    }

    document.addEventListener('keydown', handleShareModalTab);

    return () => {
      document.removeEventListener('keydown', handleShareModalTab);
      if (suppressShareFocusRestoreRef.current) {
        suppressShareFocusRestoreRef.current = false;
        return;
      }
      const savedReturnFocus = shareReturnFocusRef.current ?? returnFocus;
      shareFocusHandoffRef.current = null;
      shareReturnFocusRef.current = null;
      if (savedReturnFocus?.isConnected) {
        window.requestAnimationFrame(() => savedReturnFocus.focus({ preventScroll: true }));
      }
    };
  }, [isShareModalFocusOpen]);

  useEffect(() => {
    if (!isShareModalFocusOpen) {
      return undefined;
    }

    if (isQuoteModalOpen && !isQuoteTrackingSettingsOpen && selectedQuoteOption && quoteDirectoryStage === 'location') {
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

      if (isExportModalOpen) {
        closeExportModal();
        return;
      }

      if (isRegisterShareModalOpen) {
        closeRegisterShareModal();
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
          brandName: nextKindHasNoItemIdentity || deriveAssetReportBrandName(editingAsset) === 'â€”' ? '' : deriveAssetReportBrandName(editingAsset),
          modelName: nextKindHasNoItemIdentity || deriveAssetReportModelName(editingAsset) === 'â€”' ? '' : deriveAssetReportModelName(editingAsset),
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

      const invalidMoney = moneyChecks.find(([, value]) => !statusMoneyInpuÛ~4ïfòµë(š+myÖ÷WææÖWÒG·&W÷'DÆ&VÂçFôÆ÷vW$66R‚—ÖÀ¢f–ÆTæÖRÀ¢W&Ã¢&W÷'EW&ÂÀ¢f÷&ÖC¢—5FbòwFbr¢w†Ç7‚rÀ¢Ò’“°¢6Æ÷6T76WDw&÷WÖævW"‚“°¢&WGW&ã°¢Ð ¢6WD—4W‡÷'F–ær‡G'VR“° ¢G'’°¢–b†f÷&ÖBÓÓÒwFbr’°¢6öç7B÷VæVBÒv–æF÷ræ÷Vâ‡&W÷'EW&ÂÂuö&Ææ²rÂvæö÷VæW"Ææ÷&VfW'&W"r“°¢–b‚÷VæVB’°¢F‡&÷ræWrW'&÷"†Væ&ÆRFò÷VâF†RG·&W÷'DÆ&VÂçFôÆ÷vW$66R‚—ÒâÆV6RÆÆ÷r÷×W2æBG'’v–âæ“°¢Ð¢6WDæ÷F–6R‡²FöæS¢w7V66W72rÂÖW76vS¢G¶w&÷WææÖWÒG·&W÷'DÆ&VÂçFôÆ÷vW$66R‚—Ò÷VæVB–âæWrF"æÒ“°¢&WGW&ã°¢Ð ¢6öç7B&W7öç6RÒv—BfWF6‚‡&W÷'EW&ÂÂ²7&VFVçF–Ç3¢v–æ6ÇVFRrÂ66†S¢væò×7F÷&RrÒ“°¢–b‚&W7öç6Ræö²’°¢6öç7BFFÒv—B&W7öç6Ræ§6öâ‚’æ6F6‚‚‚’Óâ‡·Ò’’2²W'&÷#ó¢7G&–ærÓ°¢F‡&÷ræWrW'&÷"†FFæW'&÷"óòf–ÆVBFòF÷væÆöBF†RG·&W÷'DÆ&VÂçFôÆ÷vW$66R‚—ÒW†6VÂf–ÆRæ“°¢Ð ¢6öç7B&Æö"Òv—B&W7öç6Ræ&Æö"‚“°¢6öç7Bw&÷W6ÇVrÒw&÷WææÖRçFôÆ÷vW$66R‚’ç&WÆ6R‚õµæ×£Ó•Ò²örÂrÒr’ç&WÆ6R‚õâÒ·ÂÒ²BörÂrr’ÇÂwVÖ'&VÆÆs°¢F÷væÆöD&Æö"†&Æö"Â'6TF÷væÆöDf–ÆTæÖR‡&W7öç6RÂG¶w&÷W6ÇVwÒÒG·&W÷'D¶–æGÒ×&W÷'Bç†Ç7†’“°¢6WDæ÷F–6R‡²FöæS¢w7V66W72rÂÖW76vS¢G¶w&÷WææÖWÒG·&W÷'DÆ&VÂçFôÆ÷vW$66R‚—ÒW†6VÂF÷væÆöFVBæÒ“°¢Ò6F6‚†W'&÷"’°¢6WDæ÷F–6R‡°¢FöæS¢vW'&÷"rÀ¢ÖW76vS¢W'&÷"–ç7Fæ6VöbW'&÷"òW'&÷"æÖW76vR¢f–ÆVBFò&W&RF†RG·&W÷'DÆ&VÂçFôÆ÷vW$66R‚—ÒæÀ¢Ò“°¢Òf–æÆÇ’°¢6WD—4W‡÷'F–ær†fÇ6R“°¢Ð¢Ð ¢7–æ2gVæ7F–öâ†æFÆUV–6´W‡÷'E†Ç7‚‚’°¢–b‚76WG2æÆVæwF‚ÇÂ—4W‡÷'F–ær’°¢&WGW&ã°¢Ð ¢6WDW‡÷'Df÷&ÖB‚w†Ç7‚r“°¢6WD—4W‡÷'F–ær‡G'VR“° ¢G'’°¢v—B†æFÆTW‡÷'E†Ç7‚‚“°¢6WDæ÷F–6R‡²FöæS¢w7V66W72rÂÖW76vS¢t76WB&Vv—7FW"W†6VÂF÷væÆöFVBârÒ“°¢Ò6F6‚†W'&÷"’°¢6WDæ÷F–6R‡°¢FöæS¢vW'&÷"rÀ¢ÖW76vS¢W'&÷"–ç7Fæ6VöbW'&÷"òW'&÷"æÖW76vR¢tf–ÆVBFòW‡÷'BF†R76WB&Vv—7FW"W†6VÂf–ÆRârÀ¢Ò“°¢Òf–æÆÇ’°¢6WD—4W‡÷'F–ær†fÇ6R“°¢Ð¢Ð ¢7–æ2gVæ7F–öâ†æFÆT6öæf—&ÔW‡÷'B‚’°¢–b‚76WG2æÆVæwF‚’°¢&WGW&ã°¢Ð ¢–b†W‡÷'Df÷&ÖBÓÓÒwFbr’°¢÷VåFe&W÷'D6†ö÷6W"‚“°¢&WGW&ã°¢Ð ¢6WD—4W‡÷'F–ær‡G'VR“° ¢G'’°¢v—B†æFÆTW‡÷'E†Ç7‚‚“°¢6WD—4W‡÷'DÖöFÄ÷Vâ†fÇ6R“°¢&WGW&åFôW‡FW&æÅ6†&TG&gB‚“°¢6WDæ÷F–6R‡°¢FöæS¢w7V66W72rÀ¢ÖW76vS¢W‡FW&æÅ6†&U&W÷'E66÷RÓÓÒw&Vv—7FW"p¢òt76WB&Vv—7FW"W†6VÂFFVBFò–÷W"6†&Râp¢¢t76WB&Vv—7FW"„Å5‚F÷væÆöFVBârÀ¢Ò“°¢Ò6F6‚†W'&÷"’°¢6WDæ÷F–6R‡°¢FöæS¢vW'&÷"rÀ¢ÖW76vS¢W'&÷"–ç7Fæ6VöbW'&÷"òW'&÷"æÖW76vR¢tf–ÆVBFòW‡÷'BF†R76WB&Vv—7FW"ârÀ¢Ò“°¢Òf–æÆÇ’°¢6WD—4W‡÷'F–ær†fÇ6R“°¢Ð¢Ð ¢7–æ2gVæ7F–öâ&WVW7E&ö¦V7F–öâ†76WC¢&Vv—7FW$76WBÂf÷&Õ7FFS¢&ö¦V7F–öäf÷&Õ7FFR’°¢6öç7BF&vWE–V"ÒÖF‚ç&÷VæB„çVÖ&W"†f÷&Õ7FFRçF&vWE–V"’“°¢6öç7B–æfÆF–öå&FU7BÒçVÖ&W"†f÷&Õ7FFRæ–æfÆF–öå&FU7B“°¢6öç7BW6W5W&6VçE&ö¦V7F–öâÒ76WEW6W5W&6VçEW6vR†76WB“°¢6öç7B7W'&VçDÆ–fUv÷&¶VEW&6VçBÒvWD76WDÆ–fUv÷&¶VEW&6VçB†76WB“°¢6öç7Bæ÷&ÖÆ—¦VEF&vWDÆ–fUv÷&¶VEW&6VçD–çWBÒf÷&Õ7FFRçF&vWDÆ–fUv÷&¶VEW&6VçBç&WÆ6R‚rÂrÂrâr’çG&–Ò‚“°¢6öç7BF&vWDÆ–fUv÷&¶VEW&6VçBÒçVÖ&W"†æ÷&ÖÆ—¦VEF&vWDÆ–fUv÷&¶VEW&6VçD–çWB“°¢6öç7BW‡G&W6vRÒW6W5W&6VçE&ö¦V7F–öâbbf÷&Õ7FFRæW‡G&†÷W'2çG&–Ò‚’òçVÖ&W"†f÷&Õ7FFRæW‡G&†÷W'2’¢°¢6öç7BW6vTÖWG&–2ÒvWD76WEW6vTÖWG&–2†76WB“°¢6öç7BW‡G&W6vTW'&÷$Æ&VÂÒW6vTÖWG&–2ÓÓÒv¶ÒròtW‡G&¶–ÆöÖWG&W2r¢tW‡G&†÷W'2s° ¢–b‚çVÖ&W"æ—4f–æ—FR‡F&vWE–V"’’°¢6WE6†÷VÆE67&öÆÅFõ&ö¦V7F–öå&W7VÇB†fÇ6R“°¢6WE&ö¦V7F–öäW'&÷"‚u6VÆV7BfÆ–BF&vWB–V"âr“°¢&WGW&ã°¢Ð ¢–b‚çVÖ&W"æ—4f–æ—FR†–æfÆF–öå&FU7B’’°¢6WE6†÷VÆE67&öÆÅFõ&ö¦V7F–öå&W7VÇB†fÇ6R“°¢6WE&ö¦V7F–öäW'&÷"‚tVçFW"fÆ–B–æfÆF–öâ&FRâr“°¢&WGW&ã°¢Ð ¢–b‡W6W5W&6VçE&ö¦V7F–öâ’°¢–b‚æ÷&ÖÆ—¦VEF&vWDÆ–fUv÷&¶VEW&6VçD–çWBÇÂçVÖ&W"æ—4f–æ—FR‡F&vWDÆ–fUv÷&¶VEW&6VçB’’°¢6WE6†÷VÆE67&öÆÅFõ&ö¦V7F–öå&W7VÇB†fÇ6R“°¢6WE&ö¦V7F–öäW'&÷"‚tæWrW‡V7FVBR×W7B&RfÆ–BçVÖ&W"âr“°¢&WGW&ã°¢Ð ¢–b‡F&vWDÆ–fUv÷&¶VEW&6VçBÂÇÂF&vWDÆ–fUv÷&¶VEW&6VçBâ’°¢6WE6†÷VÆE67&öÆÅFõ&ö¦V7F–öå&W7VÇB†fÇ6R“°¢6WE&ö¦V7F–öäW'&÷"‚tæWrW‡V7FVBR×W7B&R&WGvVVâRæBRâr“°¢&WGW&ã°¢Ð ¢–b†7W'&VçDÆ–fUv÷&¶VEW&6VçBÓÒçVÆÂbbF&vWDÆ–fUv÷&¶VEW&6VçBÂ7W'&VçDÆ–fUv÷&¶VEW&6VçB’°¢6WE6†÷VÆE67&öÆÅFõ&ö¦V7F–öå&W7VÇB†fÇ6R“°¢6WE&ö¦V7F–öäW'&÷"‚tæWrW‡V7FVBR6ææ÷B&RÆ÷vW"F†âF†R7W'&VçBW6vRW&6VçFvRâr“°¢&WGW&ã°¢Ð¢ÒVÇ6R–b‚çVÖ&W"æ—4f–æ—FR†W‡G&W6vR’ÇÂW‡G&W6vRÂ’°¢6WE6†÷VÆE67&öÆÅFõ&ö¦V7F–öå&W7VÇB†fÇ6R“°¢6WE&ö¦V7F–öäW'&÷"†G¶W‡G&W6vTW'&÷$Æ&VÇÒ×W7B&R¦W&ò÷"w&VFW"æ“°¢&WGW&ã°¢Ð ¢6öç7B&WVW7D–BÒ&ö¦V7F–öå&WVW7E&Vbæ7W'&VçB²°¢&ö¦V7F–öå&WVW7E&Vbæ7W'&VçBÒ&WVW7D–C° ¢6WD—4ÆöF–æu&ö¦V7F–öâ‡G'VR“°¢6WE&ö¦V7F–öäW'&÷"†çVÆÂ“° ¢G'’°¢6öç7B&W7öç6RÒv—BfWF6‚‚rö’ö76WB×&Vv—7FW"÷&ö¦V7F–öârÂ°¢ÖWF†öC¢uõ5BrÀ¢7&VFVçF–Ç3¢v–æ6ÇVFRrÀ¢†VFW'3¢°¢t6öçFVçBÕG—Rs¢vÆ–6F–öâö§6öârÀ¢ÒÀ¢&öG“¢¥4ôâç7G&–æv–g’‡°¢76WD–C¢76WBæ–BÀ¢F&vWE–V"À¢–æfÆF–öå&FU7BÀ¢F&vWD6öæF—F–öã¢f÷&Õ7FFRçF&vWD6öæF—F–öâÀ¢âââ‡W6W5W&6VçE&ö¦V7F–öà¢ò²F&vWDÆ–fUv÷&¶VEW&6VçC¢ÖF‚ç&÷VæB‡F&vWDÆ–fUv÷&¶VEW&6VçB¢’òÐ¢¢²W‡G&W6vRÒ’À¢Ò’À¢Ò“° ¢6öç7BFFÒ†v—B&W7öç6Ræ§6öâ‚’’2&ö¦V7F–öä•&W7öç6S° ¢–b‡&ö¦V7F–öå&WVW7E&Vbæ7W'&VçBÓÒ&WVW7D–B’°¢&WGW&ã°¢Ð ¢–b‚&W7öç6Ræö²ÇÂFFæö²ÇÂFFç&ö¦V7F–öâ’°¢F‡&÷ræWrW'&÷"†FFæW'&÷"óòtf–ÆVBFò6Æ7VÆFRgWGW&R&–6Râr“°¢Ð ¢6WE&ö¦V7F–öå&W7VÇB†FFç&ö¦V7F–öâ“°¢Ò6F6‚†W'&÷"’°¢–b‡&ö¦V7F–öå&WVW7E&Vbæ7W'&VçBÓÒ&WVW7D–B’°¢&WGW&ã°¢Ð ¢6WE&ö¦V7F–öå&W7VÇB†çVÆÂ“°¢6WE6†÷VÆE67&öÆÅFõ&ö¦V7F–öå&W7VÇB†fÇ6R“°¢6WE&ö¦V7F–öäW'&÷"†W'&÷"–ç7Fæ6VöbW'&÷"òW'&÷"æÖW76vR¢tf–ÆVBFò6Æ7VÆFRgWGW&R&–6Râr“°¢Òf–æÆÇ’°¢–b‡&ö¦V7F–öå&WVW7E&Vbæ7W'&VçBÓÓÒ&WVW7D–B’°¢6WD—4ÆöF–æu&ö¦V7F–öâ†fÇ6R“°¢Ð¢Ð¢Ð ¢gVæ7F–öâ6Æ÷6U&ö¦V7F–öäÖöFÂ‚’°¢&ö¦V7F–öå&WVW7E&Vbæ7W'&VçB³Ò°¢6WE&ö¦V7F–öä76WB†çVÆÂ“°¢6WE&ö¦V7F–öå&W7VÇB†çVÆÂ“°¢6WE&ö¦V7F–öäW'&÷"†çVÆÂ“°¢6WE&ö¦V7F–öäf÷&Ò†7&VFTFVfVÇE&ö¦V7F–öäf÷&Ò‚’“°¢6WE6†÷VÆE67&öÆÅFõ&ö¦V7F–öå&W7VÇB†fÇ6R“°¢6WD—4ÆöF–æu&ö¦V7F–öâ†fÇ6R“°¢Ð ¢gVæ7F–öâ÷Vå&ö¦V7F–öäÖöFÂ†76WC¢&Vv—7FW$76WB’°¢6öç7BFVfVÇG2Ò7&VFTFVfVÇE&ö¦V7F–öäf÷&Ò†76WB“°¢6Æ÷6T7F–öäF–Æör‚“°¢6WE&ö¦V7F–öä76WB†76WB“°¢6WE&ö¦V7F–öäf÷&Ò†FVfVÇG2“°¢6WE&ö¦V7F–öå&W7VÇB†çVÆÂ“°¢6WE&ö¦V7F–öäW'&÷"†çVÆÂ“°¢6WE6†÷VÆE67&öÆÅFõ&ö¦V7F–öå&W7VÇB†fÇ6R“°¢fö–B&WVW7E&ö¦V7F–öâ†76WBÂFVfVÇG2“°¢Ð ¢gVæ7F–öâWFFU&ö¦V7F–öäf÷&Ò†æW‡E7FFS¢'F–ÃÅ&ö¦V7F–öäf÷&Õ7FFSâ’°¢6WE&ö¦V7F–öäf÷&Ò‚†7W'&VçB’Óâ‡°¢ââæ7W'&VçBÀ¢ââææW‡E7FFRÀ¢Ò’“°¢6WE&ö¦V7F–öå&W7VÇB†çVÆÂ“°¢6WE&ö¦V7F–öäW'&÷"†çVÆÂ“°¢6WE6†÷VÆE67&öÆÅFõ&ö¦V7F–öå&W7VÇB†fÇ6R“°¢Ð ¢gVæ7F–öâ†æFÆU&ö¦V7F–öå&W6WB†æW‡E7FFS¢'F–ÃÅ&ö¦V7F–öäf÷&Õ7FFSâ’°¢–b‚&ö¦V7F–öä76WB’°¢WFFU&ö¦V7F–öäf÷&Ò†æW‡E7FFR“°¢&WGW&ã°¢Ð ¢6öç7BæW‡Df÷&ÒÒ°¢ââç&ö¦V7F–öäf÷&ÒÀ¢ââææW‡E7FFRÀ¢Ó° ¢6WE&ö¦V7F–öäf÷&Ò†æW‡Df÷&Ò“°¢6WE&ö¦V7F–öå&W7VÇB†çVÆÂ“°¢6WE&ö¦V7F–öäW'&÷"†çVÆÂ“°¢6WE6†÷VÆE67&öÆÅFõ&ö¦V7F–öå&W7VÇB†fÇ6R“°¢fö–B&WVW7E&ö¦V7F–öâ‡&ö¦V7F–öä76WBÂæW‡Df÷&Ò“°¢Ð ¢gVæ7F–öâ†æFÆU&ö¦V7F–öå7V&Ö—B‚’°¢–b‚&ö¦V7F–öä76WB’°¢&WGW&ã°¢Ð ¢6WE6†÷VÆE67&öÆÅFõ&ö¦V7F–öå&W7VÇB‡G'VR“°¢fö–B&WVW7E&ö¦V7F–öâ‡&ö¦V7F–öä76WBÂ&ö¦V7F–öäf÷&Ò“°¢Ð ¢gVæ7F–öâ†æFÆUvU6—¦T6†ævR†æW‡EvU6—¦S¢vU6—¦R’°¢–b†æW‡EvU6—¦RÓÓÒvU6—¦R’&WGW&ã° ¢6WEvU6—¦R†æW‡EvU6—¦R“°¢6WD7W'&VçEvRƒ“°¢6WDW‡æFVD76WD–B†çVÆÂ“°¢Ð ¢6öç7B†47F—fT76WDf–ÇFW"Ò76WDf–ÇFW"ÓÒvÆÂs°¢6öç7B†4w&÷WVEv–æF–öäVçG&–W2Ò&Vv—7FW%v–æF–öäVçG&–W2ç6öÖR‚†VçG'’’ÓâVçG'’æ¶–æBÓÓÒvw&÷Wr“°¢6öç7B&Vv—7FW%&ævTFW67&—F–öâÒf–ÇFW&VD76WG2æÆVæwF€¢ò†4w&÷WVEv–æF–öäVçG&–W0¢òG·VÖ'&VÆÆv–æF–öäVçG'”6÷VçGÒG·VÖ'&VÆÆv–æF–öäVçG'”6÷VçBÓÓÒòwVÖ'&VÆÆr¢wVÖ'&VÆÆ2wÒÇv—26†÷vâG·7FæFÆöæUv–æF–öäVçG'”6÷VçBò+r7FæFÆöæR76WG2G·vU7F'B²ÒÒG·vTVæGÒöbG·7FæFÆöæUv–æF–öäVçG'”6÷VçGÖ¢r+ræò7FæFÆöæR76WG2wÒ+rG¶f–ÇFW&VD76WG2æÆVæwF‡ÒG¶f–ÇFW&VD76WG2æÆVæwF‚ÓÓÒòv76WBr¢v76WG2wÒG¶†47F—fT76WDf–ÇFW"ò+rG¶7F—fT76WDf–ÇFW$Æ&VÇÖ¢rwÖ ¢¢6†÷v–ærG·vU7F'B²ÒÒG·vTVæGÒöbG¶f–ÇFW&VD76WG2æÆVæwF‡ÒG¶f–ÇFW&VD76WG2æÆVæwF‚ÓÓÒòv76WBr¢v76WG2wÒG¶†47F—fT76WDf–ÇFW"ò+rG¶7F—fT76WDf–ÇFW$Æ&VÇÖ¢rwÖ ¢¢6V&6…FW&ÒçG&–Ò‚’ÇÂ†47F—fT76WDf–ÇFW ¢òtæò76WG2ÖF6‚F†R7W'&VçB6V&6‚÷"f–ÇFW"âp¢¢tæò6fVB76WG2–WBâs°¢6öç7B6VÆV7FVDÖçVÄ76WEG—RÒvWDÖçVÄ76WD÷F–öâ†76WDf÷&Ô¶–æB“°¢6öç7B—4ÆæE&÷W'G”G&gBÒ76WDf÷&Ô¶–æBÓÓÒw&÷W'G’rbb76WDG&gBç&÷W'G”76WE7V'G—RÓÓÒvÆæBs°¢6öç7B&WÆ6VÖVçE&–6U&WV—&VDf÷$G&gBÒ76WDf÷&Ô¶–æBÓÒw7Fö6²rbb—4ÆæE&÷W'G”G&gC°¢6öç7B76WDÆ–6Vç6TÆ–6&ÆRÒ76WD¶–æE7W÷'G4Æ–6Vç6–ær†76WDf÷&Ô¶–æB“°¢6öç7B7W'&VçEfÇVTf–VÆDÆ&VÂÒ76WDf÷&Ô¶–æBÓÓÒw7Fö6²p¢òt7W'&VçB7Fö6²fÇVRW†6ÂâdB¢p¢¢—4ÆæE&÷W'G”G&g@¢òt7W'&VçBòÖ&¶WBfÇVRW†6ÂâdB¢p¢¢t7W'&VçBfÇVRW†6ÂâdB¢s°¢6öç7B&WÆ6VÖVçEfÇVTf–VÆDÆ&VÂÒ76WDf÷&Ô¶–æBÓÓÒw&÷W'G’p¢òu&V'V–ÆF–ærò&WÆ6VÖVçBfÇVRW†6ÂâdB¢p¢¢u&WÆ6VÖVçB&–6RW†6ÂâdB¢s°¢6öç7BÖçVÄG&gDFö7VÖVçD6÷VçBÒ76WDG&gBæFö7VÖVçG2æÆVæwF‚²VæF–ætFö7VÖVçDf–ÆW2æÆVæwFƒ°¢6öç7BÖçVÄG&gE&u†÷Fô6÷VçBÒ76WDG&gBç†÷F÷2æÆVæwF‚²VæF–æu†÷Fôf–ÆW2æÆVæwFƒ°¢6öç7BÖçVÄG&gE†÷Fô6÷VçBÒÖF‚æÖ–â„Ô…õ„õDõ2ÂÖçVÄG&gE&u†÷Fô6÷VçB“°¢6öç7BG&gE†÷Fô—FV×2ÒW6TÖVÖò€¢‚’Óâ'V–ÆDG&gE†÷Fô—FV×2†76WDG&gBç†÷F÷2ÂVæF–æu†÷Fôf–ÆW2ÂÖ–å†÷Fõ6VÆV7F–öâ’À¢¶76WDG&gBç†÷F÷2ÂÖ–å†÷Fõ6VÆV7F–öâÂVæF–æu†÷Fôf–ÆW5ÒÀ¢“°¢6öç7BÖçVÅ7FW&–Ö'”Æ&VÂÐ¢ÖçVÄ76WE7FWÓÓÒ ¢òtæW‡Bp¢¢ÖçVÄ76WE7FWÓÓÒ0¢òtæW‡Bp¢¢VF—F–æt76W@¢òtFöæRp¢¢tFB76WBs°¢6öç7B76WDWF÷6fTÆ&VÂÐ¢76WDWF÷6fU7FFRÓÓÒwVæF–ærp¢òu6f–ærâââp¢¢76WDWF÷6fU7FFRÓÓÒw6f–ærp¢òu6f–ærâââp¢¢76WDWF÷6fU7FFRÓÓÒvW'&÷"p¢òt6†V6²f–VÆG2p¢¢u6fVBWFöÖF–6ÆÇ’s°¢6öç7B—476WDWF÷6fT'W7’Ò&ööÆVâ†VF—F–æt76WB’bb†76WDWF÷6fU7FFRÓÓÒwVæF–ærrÇÂ76WDWF÷6fU7FFRÓÓÒw6f–ærr“°¢6öç7B—476WE7FGW4fö7W6VEf–WrÒÖçVÄ76WE7FWÓÓÒ2bb76WE7FGW4VF—Ef–WrÓÒv‡V"s°¢6öç7B6WGF–æw5W6vTÖöFRÒVF—F–æt76WBòvWD76WE6WGF–æw5W6vTÖöFR†VF—F–æt76WB’¢væöæRs°¢6öç7B6WGF–æw5W6vT7W'&VçEfÇVRÒVF—F–æt76WBòvWD76WE6WGF–æw5W6vT7W'&VçEfÇVR†VF—F–æt76WBÂ6WGF–æw5W6vTÖöFR’¢çVÆÃ°¢6öç7B76WE6WGF–æw4Ö5W&ÂÒVF—F–æt76WBò'V–ÆD76WE6WGF–æw4vöövÆTÖ5W&Â†VF—F–æt76WB’¢çVÆÃ°¢6öç7B76WE6WGF–æw4Æö6F–öåFW‡BÒVF—F–æt76WBòf÷&ÖD76WE6WGF–æw4Æö6F–öåFW‡B†VF—F–æt76WB’¢rs°¢6öç7B76WE6WGF–æw4ÖçVÄw4'WGFöäÆ&VÂÒ—476WE6WGF–æw4ÖçVÄÆö6F–öå6f–æp¢òu6f–æru2âââp¢¢u6fRÖçVÂu2÷6—F–öâs°¢6öç7B76WE6WGF–æw4Öw4'WGFöäÆ&VÂÒ—476WE6WGF–æw4ÖÆö6F–öå6f–æp¢òu6f–æru2âââp¢¢u6fRÖ÷6—F–öâs°¢6öç7B76WE6WGF–æw4FWf–6Tw4'WGFöäÆ&VÂÐ¢76WE6WGF–æw4Æö6F–öå7FFRÓÓÒv6GW&–ærp¢òtf–æF–ærÆö6F–öââââp¢¢76WE6WGF–æw4Æö6F–öå7FFRÓÓÒw6f–ætFWf–6Rp¢òu6f–ærÆö6F–öââââp¢¢uW6RF†—2FWf–6Rs°¢6öç7BÖ&¶WGÆ6U†÷FõW&Ç2ÒÖ&¶WGÆ6T76WBòæ÷&ÖÆ—¦U†÷F÷2†Ö&¶WGÆ6T76WBç†÷F÷2’¢µÓ°¢6öç7BÖ&¶WGÆ6TÆ—7F–æuF—FÆRÒÖ&¶WGÆ6T76WBò'V–ÆDÖ&¶WGÆ6TÆ—7F–æuF—FÆR†Ö&¶WGÆ6T76WBÂG'VR’¢rs°¢6öç7BÖ&¶WGÆ6TÖöFÅF—FÆRÒÖ&¶WGÆ6T76W@¢ò—4Æ—fTöäÖ&¶WGÆ6R†Ö&¶WGÆ6T76WB¢òuWFFRÖ&¶WGÆ6RÆ—7F–ærp¢¢u6VæBFòÖ&¶WGÆ6Rp¢¢rs°¢6öç7Bæ÷&ÖÆ—¦VE&WfÇVU&WÆ6VÖVçE&–6T–çWBÒ‚‚’Óâ°¢6öç7B'6VBÒ'6TÖöæW”–çWB‡&WfÇVU&WÆ6VÖVçE&–6T–çWB“°¢&WGW&â'6VBÓÒçVÆÂbb'6VBâòÖF‚ç&÷VæB‡'6VB’¢çVÆÃ°¢Ò’‚“°¢6öç7B&–6–æu&Wf–Wu6fVE&WÆ6VÖVçE&–6TW…fBÒ&–6–æu&Wf–Wrò&VD76WE&WÆ6VÖVçE&–6TW…fB‡&–6–æu&Wf–Wræ76WB’¢çVÆÃ°¢6öç7B&–6–æu&Wf–Wu&WÆ6VÖVçE&–6TW…fBÒ&–6–æu&Wf–Wp¢ò&–6–æu&Wf–Wrç&WÆ6VÖVçE&–6TW…fBóò‡&–6–æu&Wf–Wrç&W7VÇCòç&WÆ6VÖVçE&–6UW6VDW…fBóò‡&–6–æu&Wf–Wrç&W7VÇCòæ—FVÐ¢ò&VD76WE&WÆ6VÖVçE&–6TW…fB‡&–6–æu&Wf–Wrç&W7VÇBæ—FVÒ¢¢&VD76WE&WÆ6VÖVçE&–6TW…fB‡&–6–æu&Wf–Wræ76WB’’¢¢çVÆÃ°¢6öç7B&–6–æu&Wf–WuW6W47W7FöÕ&WÆ6VÖVçBÐ¢&–6–æu&Wf–WsòæÖWF†öBÓÓÒv–ÓG&–6Rrb`¢&–6–æu&Wf–Wrç&WÆ6VÖVçDÖöFRÓÓÒv7W7FöÒrb`¢&–6–æu&Wf–Wrç&WÆ6VÖVçE&–6TW…fBÓÒçVÆÃ°¢6öç7B&–6–æu&Wf–Wu6†÷VÆE6fU&WÆ6VÖVçBÒ&–6–æu&Wf–WuW6W47W7FöÕ&WÆ6VÖVçBbb6fU&WÆ6VÖVçE&–6Uv—F…&WfÇVS°¢6öç7B&–6–æu&Wf–WtW'&÷%F—FÆRÒ&–6–æu&Wf–WsòæW'&÷$6öçFW‡BÓÓÒw6fRròt6÷VÆBæ÷B6fRæWrfÇVRr¢t6÷VÆBæ÷B6Æ7VÆFR&Wf–Wrs°¢6öç7B&–6–æu&Wf–Wt†5Vç&Wf–WvVE&WÆ6VÖVçD–çWBÐ¢&ööÆVâ‡&–6–æu&Wf–WuW6W47W7FöÕ&WÆ6VÖVçBbb&–6–æu&Wf–Wsòç&WÆ6VÖVçE&–6TW…fBÓÒæ÷&ÖÆ—¦VE&WfÇVU&WÆ6VÖVçE&–6T–çWB“°¢6öç7B&–6–æu&Wf–WtöÆEfÇVTW…fBÒ&–6–æu&Wf–Wsòç&W7VÇCòæöÆEfÇVTW…fBóò&–6–æu&Wf–Wsòæ76WBçfÇVRóòçVÆÃ°¢6öç7B&–6–æu&Wf–WtæWufÇVTW…fBÒ&–6–æu&Wf–Wsòç&W7VÇCòæ—FVÐ¢ò&–6–æu&Wf–Wrç&W7VÇBææWufÇVTW…fBóò&–6–æu&Wf–Wrç&W7VÇBæ—FVÒçfÇVP¢¢çVÆÃ°¢6öç7B&–6–æu&Wf–WtF–ffW&Væ6TW…fBÐ¢&–6–æu&Wf–WtöÆEfÇVTW…fBÓÒçVÆÂbb&–6–æu&Wf–WtæWufÇVTW…fBÓÒçVÆÀ¢ò&–6–æu&Wf–WtæWufÇVTW…fBÒ&–6–æu&Wf–WtöÆEfÇVTW…f@¢¢çVÆÃ°¢6öç7B&–6–æu&Wf–Wu&WÆ6VÖVçD7F–öäÆ&VÂÒ&–6–æu&Wf–WsòæÖWF†öBÓÓÒv–ÓG&–6Rp¢ò&–6–æu&Wf–Wrç&WÆ6VÖVçDÖöFRÓÓÒv7W7FöÒp¢ò&–6–æu&Wf–Wu6†÷VÆE6fU&WÆ6VÖVç@¢òtæWr&–6Rv–ÆÂÇ6ò&R6fVBp¢¢tæWr&–6RW6VBf÷"&Wf–WröæÇ’p¢¢uW6–ær6fVB&–6Rp¢¢çVÆÃ°¢6öç7B&–6–æu&Wf–WuW6W5W&6VçEW6vRÒ&–6–æu&Wf–Wrò76WEW6W5W&6VçEW6vR‡&–6–æu&Wf–Wræ76WB’¢fÇ6S°¢6öç7B&–6–æu&Wf–WuW6vTÖWG&–2Ò&–6–æu&Wf–WròvWD76WEW6vTÖWG&–2‡&–6–æu&Wf–Wræ76WB’¢v†÷W'2s°¢6öç7B&–6–æu&Wf–WtÆ–fWF–ÖU6†÷'EVæ—BÒvWDÆ–fWF–ÖU6†÷'EVæ—B‡&–6–æu&Wf–WuW6vTÖWG&–2“°¢6öç7B&–6–æu&Wf–WtÆ–fWF–ÖUfÇVRÒ&–6–æu&Wf–Wrbb&–6–æu&Wf–WuW6W5W&6VçEW6vP¢ò&–6–æu&Wf–WræGfæ6VD77V×F–öç3òæÖ„Æ–fWF–ÖUW6vRóð¢‡&–6–æu&Wf–Wrç&W7VÇCòæ—FVÒò&VD76WDÖ„Æ–fWF–ÖUW6vR‡&–6–æu&Wf–Wrç&W7VÇBæ—FVÒ’¢&VD76WDÖ„Æ–fWF–ÖUW6vR‡&–6–æu&Wf–Wræ76WB’¢¢çVÆÃ°¢6öç7B&–6–æu&Wf–Wu6fVE7FWF—FÆRÒ&–6–æu&Wf–WuW6W5W&6VçEW6vRòuW6R6fVB&WÆ6VÖVçB&–6Sòr¢uW6R6fVB&WÆ6VÖVçB&–6RæBÆ–fWF–ÖSòs°¢6öç7B&–6–æu&Wf–Wt7W7FöÕ7FWF—FÆRÒ&–6–æu&Wf–WuW6W5W&6VçEW6vRòtVçFW"F–ffW&VçB&–6Rr¢tVçFW"F–ffW&VçB&–6RæBÆ–fWF–ÖRs°¢6öç7B&–6–æu&Wf–Wt7W7FöÕ7FW6÷’Ò&–6–æu&Wf–WuW6W5W&6VçEW6vP¢òuG—RF†R&WÆ6VÖVçB&–6RW†6ÇVF–ærdB&Vf÷&R6Æ7VÆF–ærF†RæWrfÇVRâp¢¢uG—RF†R&WÆ6VÖVçB&–6RW†6ÇVF–ærdBæBF§W7BW‡V7FVBÆ–fWF–ÖR&Vf÷&R6Æ7VÆF–ærF†RæWrfÇVRâs°¢6öç7B&ö¦V7F–öåW6W5W&6VçEW6vRÒ&ööÆVâ€¢&ö¦V7F–öå&W7VÇCòçW6vTÖWG&–2ÓÓÒwW&6VçBrÇÀ¢‡&ö¦V7F–öä76WBbb76WEW6W5W&6VçEW6vR‡&ö¦V7F–öä76WB’’À¢“°¢6öç7B&ö¦V7F–öåW6vTÖWG&–3¢&ö¦V7F–öåW6vTÖWG&–2Ò&ö¦V7F–öåW6W5W&6VçEW6vP¢òwW&6VçBp¢¢&ö¦V7F–öå&W7VÇCòçW6vTÖWG&–2óò‡&ö¦V7F–öä76WBòvWD76WEW6vTÖWG&–2‡&ö¦V7F–öä76WB’¢v†÷W'2r“°¢6öç7B&ö¦V7F–öåW6vU6†÷'EVæ—BÒ&ö¦V7F–öåW6vTÖWG&–2ÓÓÒwW&6VçBròrRr¢W6vTÖWG&–4Æ&VÂ‡&ö¦V7F–öåW6vTÖWG&–2“°¢6öç7B&ö¦V7F–öåW6vTf–VÆDÆ&VÂÒ&ö¦V7F–öåW6vTÖWG&–2ÓÓÒwW&6VçBp¢òtæWrW‡V7FVBRp¢¢&ö¦V7F–öåW6vTÖWG&–2ÓÓÒv¶Òp¢òtFBW‡G&¶–ÆöÖWG&W2p¢¢tFBW‡G&†÷W'2s°¢6öç7B&ö¦V7F–öåW6vUÆ6V†öÆFW"Ò&ö¦V7F–öåW6vTÖWG&–2ÓÓÒwW&6VçBp¢òtW†×ÆS¢cp¢¢&ö¦V7F–öåW6vTÖWG&–2ÓÓÒv¶Òp¢òuG—RW‡G&¶–ÆöÖWG&W2p¢¢uG—RW‡G&†÷W'2s°¢6öç7B&ö¦V7F–öåW6vT†VÇFW‡BÒ&ö¦V7F–öåW6vTÖWG&–2ÓÓÒwW&6VçBp¢òtVçFW"F†RW‡V7FVBW6vRW&6VçFvRf÷"F†RF&vWB–V"âp¢¢&ö¦V7F–öåW6vTÖWG&–2ÓÓÒv¶Òp¢òtöæÇ’6†ævRv†B–÷R¶æ÷râÆVfRW‡G&¶–ÆöÖWG&W2V×G’–bW6vR7F—2F†R6ÖRâp¢¢töæÇ’6†ævRv†B–÷R¶æ÷râÆVfRW‡G&†÷W'2V×G’–bW6vR7F—2F†R6ÖRâs°¢6öç7B&ö¦V7F–öåW6vTÖWFÆ&VÂÒ&ö¦V7F–öåW6vTÖWG&–2ÓÓÒwW&6VçBròuW6vRRr¢&ö¦V7F–öåW6vTÖWG&–2ÓÓÒv¶Òròt¶–ÆöÖWG&W2r¢t†÷W'2s°¢6öç7B&ö¦V7F–öä7W'&VçEv÷&¶VEW&6VçBÒ&ö¦V7F–öå&W7VÇCòæ7W'&VçBæÆ–fUv÷&¶VEW&6VçBóò‡&ö¦V7F–öä76WBòvWD76WDÆ–fUv÷&¶VEW&6VçB‡&ö¦V7F–öä76WB’¢çVÆÂ“°¢6öç7B&ö¦V7F–öåF&vWEv÷&¶VEW&6VçBÒ&ö¦V7F–öå&W7VÇCòç&ö¦V7FVBæÆ–fUv÷&¶VEW&6VçBóò&ö¦V7F–öå&W7VÇCòçF&vWDÆ–fUv÷&¶VEW&6VçBóòçVÆÃ°¢6öç7B&ö¦V7F–öä7W'&VçD6öæF—F–öâÒ&ö¦V7F–öå&W7VÇCòæ7W'&VçD6öæF—F–öâóò‡&ö¦V7F–öä76WCòæ6öæF—F–öâÇÂvvööBr“°¢6öç7B&ö¦V7F–öåF&vWD6öæF—F–öâÒ&ö¦V7F–öå&W7VÇCòçF&vWD6öæF—F–öâóò&ö¦V7F–öäf÷&ÒçF&vWD6öæF—F–öã°¢6öç7B&–6–æu&Wf–Wuv—¦&E7FWÒ&–6–æu&Wf–WsòæÖWF†öBÓÓÒv–ÓG&–6Rp¢ò—4ÆöF–æu&–6–æu&Wf–WrÇÂ&–6–æu&Wf–Wrç&W7VÇBÇÂ&–6–æu&Wf–WræW'&÷ ¢ò0¢¢&–6–æu&Wf–Wrç&WÆ6VÖVçDÖöFRÓÓÒv7W7FöÒp¢ò ¢¢¢¢çVÆÃ°¢6öç7B6ä6Æ7VÆFT7W7FöÕ&WÆ6VÖVçE&Wf–WrÒ&ööÆVâ€¢æ÷&ÖÆ—¦VE&WfÇVU&WÆ6VÖVçE&–6T–çWBÓÒçVÆÂb`¢—4ÆöF–æu&–6–æu&Wf–Wrb`¢—56f–æu&–6–æu&Wf–WrÀ¢“°¢6öç7B6å6fU&–6–æu&Wf–WrÒ&ööÆVâ€¢&–6–æu&Wf–Wsòç&W7VÇCòæ—FVÒb`¢&–6–æu&Wf–WræW'&÷"b`¢—4ÆöF–æu&–6–æu&Wf–Wrb`¢—56f–æu&–6–æu&Wf–Wrb`¢&–6–æu&Wf–Wt†5Vç&Wf–WvVE&WÆ6VÖVçD–çWBÀ¢“° ¢gVæ7F–öâ&VæFW%&WfÇVTÆ–fWF–ÖTf–VÆB†76WC¢&Vv—7FW$76WB’°¢–b‚6†÷VÆE6†÷u&WfÇVTÆ–fWF–ÖT–çWB†76WB’’°¢&WGW&âçVÆÃ°¢Ð ¢6öç7BW6vTÖWG&–2ÒvWD76WEW6vTÖWG&–2†76WB“°¢6öç7BÆ–fWF–ÖU6†÷'EVæ—BÒvWDÆ–fWF–ÖU6†÷'EVæ—B‡W6vTÖWG&–2“° ¢&WGW&â€¢ÆF—b6Æ74æÖS×·7G–ÆW2ç&WfÇVT7W7FöÕ&WÆ6VÖVçD6&GÓà¢ÆÆ&VÂ6Æ74æÖS×·7G–ÆW2ç&WfÇVU&WÆ6VÖVçDf–VÆGÓà¢Ç7ãäW‡V7FVBÆ–fWF–ÖR‡¶Æ–fWF–ÖU6†÷'EVæ—GÒ“Â÷7ãà¢Æ–çW@¢G—SÒ'FW‡B ¢–çWDÖöFSÒ&çVÖW&–2 ¢fÇVS×·&WfÇVTÆ–fWF–ÖUW6vT–çWGÐ¢öä6†ævS×¶†æFÆU&WfÇVTÆ–fWF–ÖUW6vT6†ævWÐ¢Æ6V†öÆFW#×·W6vTÖWG&–2ÓÓÒv¶ÒròtW†×ÆS¢3Sr¢tW†×ÆS¢"wÐ¢F—6&ÆVC×¶—4ÆöF–æu&–6–æu&Wf–WrÇÂ—56f–æu&–6–æu&Wf–WwÐ¢óà¢ÂöÆ&VÃà¢ÂöF—cà¢“°¢Ð ¢&WGW&â€¢ÆÖ–â6Æ74æÖS×·7G–ÆW2çvWÓà¢Ä†VFW"7F—fSÒ&76WB×&Vv—7FW""óà ¢Ç6V7F–öâ6Æ74æÖS×·7G–ÆW2ç6†VÆÇÓà¢¶æ÷F–6Rò€¢ÆF—b6Æ74æÖS×¶G·7G–ÆW2ææ÷F–6WÒG°¢æ÷F–6RçFöæRÓÓÒw7V66W72p¢ò7G–ÆW2ææ÷F–6U7V66W70¢¢æ÷F–6RçFöæRÓÓÒwv&æ–ærp¢ò7G–ÆW2ææ÷F–6Uv&æ–æp¢¢7G–ÆW2ææ÷F–6TW'&÷ ¢ÖÓà¢¶æ÷F–6RæÖW76vWÐ¢ÂöF—cà¢’¢çVÆÇÐ ¢Ç6V7F–öâ6Æ74æÖS×·7G–ÆW2ç&Vv—7FW%æVÇÓà¢ÆF—b6Æ74æÖS×·7G–ÆW2ç&Vv—7FW$†VFW'Óà¢ÆF—b6Æ74æÖS×¶G·7G–ÆW2ç&Vv—7FW%F—FÆT&Æö6·ÒG·7G–ÆW2æ'W6–æW75&Vv—7FW%F—FÆT&Æö6·ÖÓà¢ÆF—b6Æ74æÖS×·7G–ÆW2æ'W6–æW75&Vv—7FW%F—FÆT6&GÓà¢Æƒç¶—4ÆöF–æròtÆöF–ærâââr¢7F—fU&Vv—7FW#òæ'W6–æW74æÖRÇÂ'V–ÆD÷væW$æÖR‡&W÷'E&öf–ÆR—ÓÂöƒà¢¶6ä÷Vå&Vv—7FW%7v—F6†W"ò€¢Æ'WGFöà¢G—SÒ&'WGFöâ ¢6Æ74æÖS×¶G·7G–ÆW2ç&Vv—7FW$6†ævT'WGFöçÒG·7G–ÆW2æ6öçG&öÅFööÇF—ÖÐ¢öä6Æ–6³×¶÷Vä6†ævU&Vv—7FW$ÖöFÇÐ¢F—6&ÆVC×¶—4ÆöF–ærÇÂ&ööÆVâ†6†æv–æu&Vv—7FW$–B—Ð¢&–ÖÆ&VÃÒ%7v—F6‚76WB&Vv—7FW" ¢FF×FööÇF—Ò%7v—F6‚76WG2 ¢à¢Ä6†ævU&Vv—7FW$–6öâ6Æ74æÖS×·7G–ÆW2ç&Vv—7FW$6†ævT–6öçÒóà¢·F÷FÅ&Vv—7FW%Vææ÷FVDÆW'D6÷VçBâò€¢Ç7à¢6Æ74æÖS×·7G–ÆW2ç&Vv—7FW$6†ævTÆW'D&FvWÐ¢&–ÖÆ&VÃ×¶G¶f÷&ÖDÆW'D&FvT6÷VçB‡F÷FÅ&Vv—7FW%Vææ÷FVDÆW'D6÷VçB—ÒVææ÷FVB76WB&Vv—7FW"ÆW'BG·F÷FÅ&Vv—7FW%Vææ÷FVDÆW'D6÷VçBÓÓÒòrr¢w2wÖÐ¢à¢¶f÷&ÖDÆW'D&FvT6÷VçB‡F÷FÅ&Vv—7FW%Vææ÷FVDÆW'D6÷VçB—Ð¢Â÷7ãà¢’¢çVÆÇÐ¢Âö'WGFöãà¢’¢çVÆÇÐ¢ÂöF—cà¢ÂöF—cà ¢ÆF—b6Æ74æÖS×¶G·7G–ÆW2æ†VFW$7F–öç7ÒG¶6åW6T÷væW$öæÇ”76WD7F–öç2ò7G–ÆW2æ÷væW%&Vv—7FW$†VFW$7F–öç2¢7G–ÆW2ç6†&VE&Vv—7FW$†VFW$7F–öç7ÖÓà¢¶6å6†&T7F—fU&Vv—7FW"ò€¢Æ'WGFöà¢G—SÒ&'WGFöâ ¢6Æ74æÖS×¶G·7G–ÆW2ç6V6öæF'”'WGFöçÒG·7G–ÆW2æ†VFW%6†&T'WGFöçÖÐ¢öä6Æ–6³×¶÷Vå&Vv—7FW%6†&TÖöFÇÐ¢F—6&ÆVC×²76WG2æÆVæwF‚ÇÂ—4ÆöF–ærÇÂ—4W‡÷'F–æwÐ¢à¢Å6†&T–6öâ6Æ74æÖS×·7G–ÆW2æ'WGFöä–6öçÒóà¢Ç7ãå6†&SÂ÷7ãà¢Âö'WGFöãà¢’¢çVÆÇÐ ¢Æ'WGFöà¢G—SÒ&'WGFöâ ¢6Æ74æÖS×¶G·7G–ÆW2ç6V6öæF'”'WGFöçÒG·7G–ÆW2ç7VÖÖ'•G&–vvW$'WGFöçÒG·7G–ÆW2æ†VFW$÷F–öç4'WGFöçÖÐ¢öä6Æ–6³×¶÷Vå7VÖÖ'”ÖöFÇÐ¢F—6&ÆVC×¶—4ÆöF–æwÐ¢à¢Ä÷F–öç4–6öâ6Æ74æÖS×·7G–ÆW2æ'WGFöä–6öçÒóà¢Ç7ãå7VÖÖ'“Â÷7ãà¢Âö'WGFöãà ¢ÆF—b6Æ74æÖS×·7G–ÆW2æ76WDf–ÇFW%w&Ò&Vc×¶76WDf–ÇFW%w&&VgÓà¢Æ'WGFöà¢G—SÒ&'WGFöâ ¢6Æ74æÖS×¶G·7G–ÆW2ç6V6öæF'”'WGFöçÒG·7G–ÆW2æf–ÇFW%G&–vvW$'WGFöçÒG¶†47F—fT76WDf–ÇFW"ò7G–ÆW2æf–ÇFW%G&–vvW$'WGFöä7F—fR¢rwÒG¶—476WDf–ÇFW$÷Vâò7G–ÆW2æf–ÇFW%G&–vvW$'WGFöä÷Vâ¢rwÖÐ¢öä6Æ–6³×²‚’Óâ6WD—476WDf–ÇFW$÷Vâ‡G'VR—Ð¢F—6&ÆVC×¶—4ÆöF–æwÐ¢&–Ö†7÷WÒ&F–Æör ¢&–ÖW‡æFVC×¶—476WDf–ÇFW$÷VçÐ¢&–Ö6öçG&öÇ3Ò&76WB×&Vv—7FW"Öf–ÇFW"ÖÖöFÂ ¢à¢Äf–ÇFW$–6öâ6Æ74æÖS×·7G–ÆW2æ'WGFöä–6öçÒóà¢Ç7ãäf–ÇFW'3Â÷7ãà¢¶†47F—fT76WDf–ÇFW"òÇ7â6Æ74æÖS×·7G–ÆW2æf–ÇFW$7F—fT&FvWÓãÂ÷7ãâ¢çVÆÇÐ¢Âö'WGFöãà¢ÂöF—cà ¢Æ'WGFöà¢G—SÒ&'WGFöâ ¢6Æ74æÖS×¶G·7G–ÆW2ç6V6öæF'”'WGFöçÒG·7G–ÆW2æ†VFW$F÷væÆöD'WGFöçÖÐ¢öä6Æ–6³×¶÷VäW‡÷'DÖöFÇÐ¢F—6&ÆVC×²76WG2æÆVæwF‚ÇÂ—4ÆöF–ærÇÂ—4W‡÷'F–æwÐ¢à¢ÄF÷væÆöD–6öâ6Æ74æÖS×·7G–ÆW2æ'WGFöä–6öçÒóà¢Ç7ãäF÷væÆöCÂ÷7ãà¢Âö'WGFöãà¢ÂöF—cà¢ÂöF—cà ¢¶—476WDf–ÇFW$÷Vâò€¢ÆF—b6Æ74æÖS×¶G·7G–ÆW2æÖöFÄ÷fW&Æ—ÒG·7G–ÆW2æ76WDf–ÇFW$ÖöFÄ÷fW&Æ—ÖÓà¢ÆF—b6Æ74æÖS×·7G–ÆW2æÖöFÄ&6¶G&÷Òöä6Æ–6³×²‚’Óâ6WD—476WDf–ÇFW$÷Vâ†fÇ6R—Òóà ¢ÆF—`¢–CÒ&76WB×&Vv—7FW"Öf–ÇFW"ÖÖöFÂ ¢6Æ74æÖS×¶G·7G–ÆW2æÖöFÄ6&GÒG·7G–ÆW2æ76WDf–ÇFW$ÖöFÇÖÐ¢&öÆSÒ&F–Æör ¢&–ÖÖöFÃÒ'G'VR ¢&–ÖÆ&VÆÆVF'“Ò&76WB×&Vv—7FW"Öf–ÇFW"×F—FÆR ¢à¢ÆF—b6Æ74æÖS×¶G·7G–ÆW2æÖöFÄ†VFW'ÒG·7G–ÆW2æ76WDf–ÇFW$ÖöFÄ†VFW'ÖÓà¢ÆF—b6Æ74æÖS×·7G–ÆW2æÖöFÄ†VFW%FW‡GÓà¢Æƒ2–CÒ&76WB×&Vv—7FW"Öf–ÇFW"×F—FÆR#äf–ÇFW"76WG3Âöƒ3à¢ÂöF—cà ¢Æ'WGFöà¢G—SÒ&'WGFöâ ¢6Æ74æÖS×·7G–ÆW2æÖöFÄ6Æ÷6T'WGFöçÐ¢öä6Æ–6³×²‚’Óâ6WD—476WDf–ÇFW$÷Vâ†fÇ6R—Ð¢&–ÖÆ&VÃÒ$6Æ÷6R76WBf–ÇFW'2 ¢à¢Ä6Æ÷6T–6öâ6Æ74æÖS×·7G–ÆW2æ'WGFöä–6öçÒóà¢Âö'WGFöãà¢ÂöF—cà ¢ÆF—b6Æ74æÖS×¶G·7G–ÆW2æÖöFÅ67&öÆÄ&öG—ÒG·7G–ÆW2æ76WDf–ÇFW$ÖöFÄ&öG—ÖÓà¢ÆF—b6Æ74æÖS×·7G–ÆW2æ76WDf–ÇFW$÷F–öå7F6·Ò&öÆSÒ&w&÷W"&–ÖÆ&VÃÒ$76WBf–ÇFW"÷F–öç2#à¢µ$”Ô%•ô54UEôd”ÅDU%ôõD”ôâò€¢Æ'WGFöà¢G—SÒ&'WGFöâ ¢6Æ74æÖS×¶G·7G–ÆW2æ76WDf–ÇFW$÷F–öä6&GÒG·7G–ÆW2æ76WDf–ÇFW$ÆÄ÷F–öä6&GÒG¶76WDf–ÇFW"ÓÓÒ$”Ô%•ô54UEôd”ÅDU%ôõD”ôâçfÇVRò7G–ÆW2æ76WDf–ÇFW$÷F–öä6&D7F—fR¢rwÖÐ¢öä6Æ–6³×²‚’Óâ6VÆV7D76WDf–ÇFW"…$”Ô%•ô54UEôd”ÅDU%ôõD”ôâçfÇVR—Ð¢&–×&W76VC×¶76WDf–ÇFW"ÓÓÒ$”Ô%•ô54UEôd”ÅDU%ôõD”ôâçfÇVWÐ¢à¢Ç7â6Æ74æÖS×·7G–ÆW2æ76WDf–ÇFW$÷F–öåFW‡GÓà¢Ç7G&öæsçµ$”Ô%•ô54UEôd”ÅDU%ôõD”ôâæÆ&VÇÓÂ÷7G&öæsà¢Â÷7ãà¢Âö'WGFöãà¢’¢çVÆÇÐ ¢ÆF—b6Æ74æÖS×·7G–ÆW2æ76WDf–ÇFW$÷F–öäw&–GÓà¢µ4T4ôäD%•ô54UEôd”ÅDU%ôõD”ôå2æÖ‚†÷F–öâ’Óâ°¢6öç7B—47F—fTf–ÇFW"Ò76WDf–ÇFW"ÓÓÒ÷F–öâçfÇVS° ¢&WGW&â€¢Æ'WGFöà¢G—SÒ&'WGFöâ ¢¶W“×¶÷F–öâçfÇVWÐ¢6Æ74æÖS×¶G·7G–ÆW2æ76WDf–ÇFW$÷F–öä6&GÒG¶—47F—fTf–ÇFW"ò7G–ÆW2æ76WDf–ÇFW$÷F–öä6&D7F—fR¢rwÖÐ¢öä6Æ–6³×²‚’Óâ6VÆV7D76WDf–ÇFW"†÷F–öâçfÇVR—Ð¢&–×&W76VC×¶—47F—fTf–ÇFW'Ð¢à¢Ç7â6Æ74æÖS×·7G–ÆW2æ76WDf–ÇFW$÷F–öåFW‡GÓà¢Ç7G&öæsç¶÷F–öâæÆ&VÇÓÂ÷7G&öæsà¢Â÷7ãà¢¶—47F—fTf–ÇFW"òÇ7â6Æ74æÖS×·7G–ÆW2æ76WDf–ÇFW$ÖöFÅF–6·Óî)É3Â÷7ãâ¢çVÆÇÐ¢Âö'WGFöãà¢“°¢Ò—Ð¢ÂöF—cà¢ÂöF—cà¢ÂöF—cà ¢ÆF—b6Æ74æÖS×·7G–ÆW2æ76WDf–ÇFW$ÖöFÄfö÷FW'Óà¢Æ'WGFöâG—SÒ&'WGFöâ"6Æ74æÖS×·7G–ÆW2ç6V6öæF'”'WGFöçÒöä6Æ–6³×¶6ÆV$76WDf–ÇFW'ÒF—6&ÆVC×²†47F—fT76WDf–ÇFW'Óà¢6ÆV"f–ÇFW ¢Âö'WGFöãà¢Æ'WGFöâG—SÒ&'WGFöâ"6Æ74æÖS×·7G–ÆW2ç&–Ö'”'WGFöçÒöä6Æ–6³×²‚’Óâ6WD—476WDf–ÇFW$÷Vâ†fÇ6R—Óà¢FöæP¢Âö'WGFöãà¢ÂöF—cà¢ÂöF—cà¢ÂöF—cà¢’¢çVÆÇÐ ¢¶—46†ævU&Vv—7FW$ÖöFÄ÷Vâò€¢ÆF—b6Æ74æÖS×¶G·7G–ÆW2æÖöFÄ÷fW&Æ—ÒG·7G–ÆW2æ6†ævU&Vv—7FW$ÖöFÄ÷fW&Æ—ÖÓà¢ÆF—b6Æ74æÖS×·7G–ÆW2æÖöFÄ&6¶G&÷Òöä6Æ–6³×¶6Æ÷6T6†ævU&Vv—7FW$ÖöFÇÒóà ¢ÆF—`¢6Æ74æÖS×¶G·7G–ÆW2æÖöFÄ6&GÒG·7G–ÆW2æ6†ævU&Vv—7FW$ÖöFÇÖÐ¢&öÆSÒ&F–Æör ¢&–ÖÖöFÃÒ'G'VR ¢&–ÖÆ&VÆÆVF'“Ò&76WB×&Vv—7FW"Ö6†ævR×F—FÆR ¢à¢ÆF—b6Æ74æÖS×¶G·7G–ÆW2æÖöFÄ†VFW'ÒG·7G–ÆW2æ6†ævU&Vv—7FW$ÖöFÄ†VFW'ÖÓà¢ÆF—b6Æ74æÖS×·7G–ÆW2æÖöFÄ†VFW%FW‡GÓà¢Æƒ2–CÒ&76WB×&Vv—7FW"Ö6†ævR×F—FÆR#ä6†ævR76WB&Vv—7FW#Âöƒ3à¢Çä6†ö÷6R6fVB76WB&Vv—7FW"Fò÷VâÂ÷"ÖævR–÷W"&Vv—7FW'2ãÂ÷à¢ÂöF—cà ¢Æ'WGFöà¢G—SÒ&'WGFöâ ¢6Æ74æÖS×·7G–ÆW2æÖöFÄ6Æ÷6T'WGFöçÐ¢öä6Æ–6³×¶6Æ÷6T6†ævU&Vv—7FW$ÖöFÇÐ¢&–ÖÆ&VÃÒ$6Æ÷6R6†ævR76WB&Vv—7FW"ÖöFÂ ¢F—6&ÆVC×´&ööÆVâ†6†æv–æu&Vv—7FW$–B—Ð¢à¢Ä6Æ÷6T–6öâ6Æ74æÖS×·7G–ÆW2æ'WGFöä–6öçÒóà¢Âö'WGFöãà¢ÂöF—cà ¢ÆF—b6Æ74æÖS×·7G–ÆW2æ6†ævU&Vv—7FW%FööÆ&'Óà¢ÆÆ&VÂ6Æ74æÖS×·7G–ÆW2æ6†ævU&Vv—7FW%6V&6…w&Óà¢Å6V&6„–6öâ6Æ74æÖS×·7G–ÆW2æ6†ævU&Vv—7FW%6V&6„–6öçÒóà¢Æ–çW@¢fÇVS×·&Vv—7FW%7v—F6†W%6V&6…FW&×Ð¢öä6†ævS×²†WfVçB’Óâ6WE&Vv—7FW%7v—F6†W%6V&6…FW&Ò†WfVçBçF&vWBçfÇVR—Ð¢Æ6V†öÆFW#Ò%6V&6‚76WB&Vv—7FW'2âââ ¢&–ÖÆ&VÃÒ%6V&6‚76WB&Vv—7FW'2 ¢F—6&ÆVC×´&ööÆVâ†6†æv–æu&Vv—7FW$–B—Ð¢WFôfö7W0¢óà¢ÂöÆ&VÃà ¢ÄÆ–æ°¢‡&Vc×¶—466÷VçFçEv÷&·76Rbb66÷VçFçE6†&T–@¢òö66÷VçFçB÷&Vv—7FW'2òG¶Væ6öFUU$”6ö×öæVçB†66÷VçFçE6†&T–B—ÒöÖævV ¢¢rö76WB×&Vv—7FW'2wÐ¢6Æ74æÖS×¶G·7G–ÆW2ç6V6öæF'”'WGFöçÒG·7G–ÆW2æ6†ævU&Vv—7FW$ÖævT'WGFöçÖÐ¢öä6Æ–6³×¶6Æ÷6T6†ævU&Vv—7FW$ÖöFÇÐ¢à¢ÄÖævT–6öâ6Æ74æÖS×·7G–ÆW2æ'WGFöä–6öçÒóà¢Ç7ãäÖævSÂ÷7ãà¢ÂôÆ–æ³à¢ÂöF—cà ¢ÆF—b6Æ74æÖS×·7G–ÆW2æ6†ævU&Vv—7FW$Æ—7GÓà¢·f—6–&ÆU&Vv—7FW%7v—F6†W$÷F–öç2æÖ‚‡&Vv—7FW"’Óâ°¢6öç7B—47W'&VçE&Vv—7FW"Ò&Vv—7FW"æ–BÓÓÒ7F—fU&Vv—7FW#òæ–BÇÂ&Vv—7FW"æ–BÓÓÒ7F—fU&Vv—7FW$–C°¢6öç7B—46†æv–æuF†—5&Vv—7FW"Ò6†æv–æu&Vv—7FW$–BÓÓÒ&Vv—7FW"æ–C°¢6öç7B&Vv—7FW$76WD6÷VçBÒÖF‚æÖ‚ƒÂÖF‚ç&÷VæB„çVÖ&W"‡&Vv—7FW"æ76WD6÷VçB’ÇÂ’“°¢6öç7B76WD6÷VçDÆ&VÂÒG·&Vv—7FW$76WD6÷VçBçFôÆö6ÆU7G&–ær‚vVâÕ¤r—ÒG·&Vv—7FW$76WD6÷VçBÓÓÒòv76WBr¢v76WG2wÖ°¢6öç7B&Vv—7FW%Vææ÷FVDÆW'D6÷VçBÒ&Vv—7FW%Vææ÷FVDÆW'D6÷VçG2ævWB‡&Vv—7FW"æ–B’óò&Vv—7FW%7VÖÖ'•Vææ÷FVDÆW'D6÷VçB‡&Vv—7FW"“° ¢&WGW&â€¢Æ'WGFöà¢G—SÒ&'WGFöâ ¢¶W“×·&Vv—7FW"æ–GÐ¢6Æ74æÖS×¶G·7G–ÆW2æ6†ævU&Vv—7FW$6&GÒG¶—47W'&VçE&Vv—7FW"ò7G–ÆW2æ6†ævU&Vv—7FW$6&D7F—fR¢rwÖÐ¢öä6Æ–6³×²‚’Óâfö–B†æFÆT6†ævU&Vv—7FW%6VÆV7B‡&Vv—7FW"—Ð¢F—6&ÆVC×´&ööÆVâ†6†æv–æu&Vv—7FW$–B—Ð¢&–Ö7W'&VçC×¶—47W'&VçE&Vv—7FW"òwvRr¢VæFVf–æVGÐ¢à¢Ç7â6Æ74æÖS×·7G–ÆW2æ6†ævU&Vv—7FW$6&EFW‡GÓà¢Ç7G&öæsç·&Vv—7FW"æ'W6–æW74æÖRÇÂt76WB&Vv—7FW"wÓÂ÷7G&öæsà¢Ç6ÖÆÃç¶76WD6÷VçDÆ&VÇÒ+r¶ÖöæW’„çVÖ&W"‡&Vv—7FW"çF÷FÅfÇVR’ÇÂ—Ò7W'&VçBfÇVSÂ÷6ÖÆÃà¢Â÷7ãà¢Ç7â6Æ74æÖS×·7G–ÆW2æ6†ævU&Vv—7FW$6&D6–FWÓà¢·&Vv—7FW%Vææ÷FVDÆW'D6÷VçBâò€¢Ç7à¢6Æ74æÖS×·7G–ÆW2æ6†ævU&Vv—7FW$6&DÆW'D&FvWÐ¢&–ÖÆ&VÃ×¶G¶f÷&ÖDÆW'D&FvT6÷VçB‡&Vv—7FW%Vææ÷FVDÆW'D6÷VçB—ÒVææ÷FVBÆW'BG·&Vv—7FW%Vææ÷FVDÆW'D6÷VçBÓÓÒòrr¢w2wÒ–âF†—276WB&Vv—7FW&Ð¢à¢¶f÷&ÖDÆW'D&FvT6÷VçB‡&Vv—7FW%Vææ÷FVDÆW'D6÷VçB—Ð¢Â÷7ãà¢’¢çVÆÇÐ¢Ç7â6Æ74æÖS×·7G–ÆW2æ6†ævU&Vv—7FW$6&D7F–öçÓà¢¶—46†æv–æuF†—5&Vv—7FW"òt÷Væ–ærâââr¢—47W'&VçE&Vv—7FW"òt7W'&VçBr¢t÷VâwÐ¢Â÷7ãà¢Â÷7ãà¢Âö'WGFöãà¢“°¢Ò—Ð ¢²f—6–&ÆU&Vv—7FW%7v—F6†W$÷F–öç2æÆVæwF‚ò€¢ÆF—b6Æ74æÖS×·7G–ÆW2æ6†ævU&Vv—7FW$V×G•7FFWÓà¢Ç7G&öæsäæò76WB&Vv—7FW'2ÖF6‚–÷W"6V&6‚ãÂ÷7G&öæsà¢Æ'WGFöà¢G—SÒ&'WGFöâ ¢6Æ74æÖS×·7G–ÆW2ç6V6öæF'”'WGFöçÐ¢öä6Æ–6³×²‚’Óâ6WE&Vv—7FW%7v—F6†W%6V&6…FW&Ò‚rr—Ð¢à¢6ÆV"6V&6€¢Âö'WGFöãà¢ÂöF—cà¢’¢çVÆÇÐ¢ÂöF—cà¢ÂöF—cà¢ÂöF—cà¢’¢çVÆÇÐ ¢¶76WE&Vv—7FW$Ö÷fT76WBò€¢ÆF—b6Æ74æÖS×·7G–ÆW2æÖöFÄ÷fW&Æ—Óà¢ÆF—b6Æ74æÖS×·7G–ÆW2æÖöFÄ&6¶G&÷Òöä6Æ–6³×¶6Æ÷6T76WE&Vv—7FW$Ö÷fTÖævW'Òóà ¢ÆF—`¢6Æ74æÖS×¶G·7G–ÆW2æÖöFÄ6&GÒG·7G–ÆW2æ76WE&Vv—7FW$Ö÷fTÖöFÇÖÐ¢&öÆSÒ&F–Æör ¢&–ÖÖöFÃÒ'G'VR ¢&–ÖÆ&VÆÆVF'“Ò&76WB×&Vv—7FW"ÖÖ÷fR×F—FÆR ¢à¢ÆF—b6Æ74æÖS×¶G·7G–ÆW2æÖöFÄ†VFW'ÒG·7G–ÆW2æ76WE&Vv—7FW$Ö÷fTÖöFÄ†VFW'ÖÓà¢ÆF—b6Æ74æÖS×·7G–ÆW2æÖöFÄ†VFW%FW‡GÓà¢Æƒ2–CÒ&76WB×&Vv—7FW"ÖÖ÷fR×F—FÆR#äÖ÷fR76WCÂöƒ3à¢Çä6†ö÷6Ræ÷F†W"76WB&Vv—7FW"÷"âVÖ'&VÆÆf÷"F†—276WBãÂ÷à¢ÂöF—cà ¢Æ'WGFöà¢G—SÒ&'WGFöâ ¢6Æ74æÖS×·7G–ÆW2æÖöFÄ6Æ÷6T'WGFöçÐ¢öä6Æ–6³×¶6Æ÷6T76WE&Vv—7FW$Ö÷fTÖævW'Ð¢&–ÖÆ&VÃÒ$6Æ÷6RÖ÷fR76WBÖöFÂ ¢F—6&ÆVC×¶—4Ö÷f–æt76WE&Vv—7FW'Ð¢à¢Ä6Æ÷6T–6öâ6Æ74æÖS×·7G–ÆW2æ'WGFöä–6öçÒóà¢Âö'WGFöãà¢ÂöF—cà ¢ÆF—b6Æ74æÖS×·7G–ÆW2æ76WE&Vv—7FW$Ö÷fTÖöFÄ&öG—Óà¢ÆÆ&VÂ6Æ74æÖS×·7G–ÆW2æ76WE&Vv—7FW$Ö÷fU6V&6…w&Óà¢Å6V&6„–6öâ6Æ74æÖS×·7G–ÆW2æ76WE&Vv—7FW$Ö÷fU6V&6„–6öçÒóà¢Æ–çW@¢fÇVS×¶76WE&Vv—7FW$Ö÷fU6V&6…FW&×Ð¢öä6†ævS×²†WfVçB’Óâ6WD76WE&Vv—7FW$Ö÷fU6V&6…FW&Ò†WfVçBçF&vWBçfÇVR—Ð¢Æ6V†öÆFW#Ò%6V&6‚76WG2âââ ¢&–ÖÆ&VÃÒ%6V&6‚6VÆV7FVB76WB ¢F—6&ÆVC×¶—4Ö÷f–æt76WE&Vv—7FW'Ð¢óà¢ÂöÆ&VÃà ¢¶76WE&Vv—7FW$Ö÷fT76WBçF—FÆRçFôÆ÷vW$66R‚’æ–æ6ÇVFW2†76WE&Vv—7FW$Ö÷fU6V&6…FW&ÒçG&–Ò‚’çFôÆ÷vW$66R‚’’ò€¢ÆF—b6Æ74æÖS×·7G–ÆW2æ76WE&Vv—7FW$Ö÷fU&÷wÓà¢ÆF—b6Æ74æÖS×·7G–ÆW2æ76WE&Vv—7FW$Ö÷fT6÷—Óà¢Ç7G&öæsç¶76WE&Vv—7FW$Ö÷fT76WBçF—FÆWÓÂ÷7G&öæsà¢ÆF—b6Æ74æÖS×·7G–ÆW2æ76WE&Vv—7FW$Ö÷fTFWF–Ç7Óà¢Ç7ãà¢Æ#å–V"ÖöFVÃ£Âö#à¢¶76WE&Vv—7FW$Ö÷fT76WBç–V$ÖöFVÂÇÂ~(	BwÐ¢Â÷7ãà¢Ç7ãà¢Æ#åW6vS£Âö#à¢¶'V–ÆD76WEW6vUfÇVR†76WE&Vv—7FW$Ö÷fT76WB—Ð¢Â÷7ãà¢Ç7ãà¢Æ#ä6öæF—F–öã£Âö#à¢¶6öæF—F–öäÆ&VÂ†76WE&Vv—7FW$Ö÷fT76WBæ6öæF—F–öâ—Ð¢Â÷7ãà¢Ç7â6Æ74æÖS×·7G–ÆW2æ76WE&Vv—7FW$Ö÷fU&–6WÓà¢Æ#ä7W'&VçBfÇVS£Âö#à¢¶ÖöæW’†76WE&Vv—7FW$Ö÷fT76WBçfÇVR—Ð¢Â÷7ãà¢ÂöF—cà¢ÂöF—cà ¢ÆF—b6Æ74æÖS×·7G–ÆW2æ76WE&Vv—7FW$Ö÷fTFW7F–æF–öçÓà¢Ç7â6Æ74æÖS×·7G–ÆW2æ76WE&Vv—7FW$Ö÷fTFW7F–æF–öäÆ&VÇÓäÖ÷fRF†—276WBFóÂ÷7ãà¢ÆF—`¢6Æ74æÖS×·7G–ÆW2æ76WE&Vv—7FW$Ö÷fTFW7F–æF–öåF'7Ð¢&öÆSÒ&w&÷W ¢&–ÖÆ&VÃÒ$Ö÷fRFW7F–æF–öâ ¢à¢Æ'WGFöà¢G—SÒ&'WGFöâ ¢6Æ74æÖS×¶G·7G–ÆW2æ76WE&Vv—7FW$Ö÷fTFW7F–æF–öåF'ÒG¶76WE&Vv—7FW$Ö÷fTFW7F–æF–öâÓÓÒw&Vv—7FW"rò7G–ÆW2æ76WE&Vv—7FW$Ö÷fTFW7F–æF–öåF$7F—fR¢rwÖÐ¢öä6Æ–6³×²‚’Óâ°¢6WD76WE&Vv—7FW$Ö÷fTFW7F–æF–öâ‚w&Vv—7FW"r“°¢6WD76WE&Vv—7FW$Ö÷fUF&vWD–B‚rr“°¢6WD76WE&Vv—7FW$Ö÷fTW'&÷"‚rr“°¢×Ð¢&–×&W76VC×¶76WE&Vv—7FW$Ö÷fTFW7F–æF–öâÓÓÒw&Vv—7FW"wÐ¢F—6&ÆVC×¶—4Ö÷f–æt76WE&Vv—7FW'Ð¢à¢Ä6†ævU&Vv—7FW$–6öâ6Æ74æÖS×·7G–ÆW2æ'WGFöä–6öçÒóà¢Ç7ãä76WB&Vv—7FW#Â÷7ãà¢Âö'WGFöãà¢Æ'WGFöà¢G—SÒ&'WGFöâ ¢6Æ74æÖS×¶G·7G–ÆW2æ76WE&Vv—7FW$Ö÷fTFW7F–æF–öåF'ÒG¶76WE&Vv—7FW$Ö÷fTFW7F–æF–öâÓÓÒwVÖ'&VÆÆrò7G–ÆW2æ76WE&Vv—7FW$Ö÷fTFW7F–æF–öåF$7F—fR¢rwÖÐ¢öä6Æ–6³×²‚’Óâ°¢6WD76WE&Vv—7FW$Ö÷fTFW7F–æF–öâ‚wVÖ'&VÆÆr“°¢6WD76WE&Vv—7FW$Ö÷fUF&vWD–B‚rr“°¢6WD76WE&Vv—7FW$Ö÷fTW'&÷"‚rr“°¢×Ð¢&–×&W76VC×¶76WE&Vv—7FW$Ö÷fTFW7F–æF–öâÓÓÒwVÖ'&VÆÆwÐ¢F—6&ÆVC×²6äÖævT76WDw&÷W2ÇÂ—4Ö÷f–æt76WE&Vv—7FW'Ð¢F—FÆS×¶6äÖævT76WDw&÷W2òtÖ÷fRFòâVÖ'&VÆÆr¢uVÖ'&VÆÆ6†ævW2&RVæf–Æ&ÆRwÐ¢à¢ÅVÖ'&VÆÆ–6öâ6Æ74æÖS×·7G–ÆW2æ'WGFöä–6öçÒóà¢Ç7ãåVÖ'&VÆÆÂ÷7ãà¢Âö'WGFöãà¢ÂöF—cà ¢¶76WE&Vv—7FW$Ö÷fTFW7F–æF–öâÓÓÒw&Vv—7FW"rò€¢76WE&Vv—7FW$Ö÷fUF&vWD÷F–öç2æÆVæwF‚ò€¢ÄÖöFÅ6VÆV7CÇ7G&–æsà¢Æ&VÃÒ%F&vWB76WB&Vv—7FW" ¢fÇVS×¶76WE&Vv—7FW$Ö÷fUF&vWD–GÐ¢÷F–öç3×¶76WE&Vv—7FW$Ö÷fUF&vWD÷F–öç7Ð¢öä6†ævS×²‡fÇVR’Óâ°¢6WD76WE&Vv—7FW$Ö÷fUF&vWD–B‡fÇVR“°¢6WD76WE&Vv—7FW$Ö÷fTW'&÷"‚rr“°¢×Ð¢Æ6V†öÆFW#Ò$6†ö÷6RF&vWB&Vv—7FW" ¢6Æ74æÖS×·7G–ÆW2æ76WE&Vv—7FW$Ö÷fUF&vWDf–VÆGÐ¢W6U÷'FÀ¢óà¢’¢€¢ÆF—b6Æ74æÖS×·7G–ÆW2æ76WE&Vv—7FW$Ö÷fTæõF&vWGÓà¢Çä7&VFRæ÷F†W"76WB&Vv—7FW"&Vf÷&RÖ÷f–ærF†—276WBãÂ÷à¢ÄÆ–æ°¢‡&Vc×¶—466÷VçFçEv÷&·76Rbb66÷VçFçE6†&T–@¢òö66÷VçFçB÷&Vv—7FW'2òG¶Væ6öFUU$”6ö×öæVçB†66÷VçFçE6†&T–B—ÒöÖævV ¢¢rö76WB×&Vv—7FW'2wÐ¢6Æ74æÖS×¶G·7G–ÆW2ç&–Ö'”'WGFöçÒG·7G–ÆW2æ76WE&Vv—7FW$Ö÷fT7&VFT'WGFöçÖÐ¢öä6Æ–6³×¶6Æ÷6T76WE&Vv—7FW$Ö÷fTÖævW'Ð¢à¢7&VFRæWr76WB&Vv—7FW ¢ÂôÆ–æ³à¢ÂöF—cà¢¢’¢—4ÆöF–æt76WE&Vv—7FW$Ö÷fTw&÷W2ò€¢ÆF—b6Æ74æÖS×·7G–ÆW2æ76WE&Vv—7FW$Ö÷fTæõF&vWGÒ&öÆSÒ'7FGW2#à¢ÇäÆöF–ærVÖ'&VÆÆ2ââãÂ÷à¢ÂöF—cà¢’¢76WE&Vv—7FW$Ö÷fTw&÷WÆöDW'&÷"ò€¢ÆF—b6Æ74æÖS×·7G–ÆW2æ76WE&Vv—7FW$Ö÷fTæõF&vWGÒ&öÆSÒ&ÆW'B#à¢Çç¶76WE&Vv—7FW$Ö÷fTw&÷WÆöDW'&÷'ÓÂ÷à¢ÂöF—cà¢’¢76WE&Vv—7FW$Ö÷fTw&÷W÷F–öç2æÆVæwF‚ò€¢ÄÖöFÅ6VÆV7CÇ7G&–æsà¢Æ&VÃÒ%F&vWBVÖ'&VÆÆ ¢fÇVS×¶76WE&Vv—7FW$Ö÷fUF&vWD–GÐ¢÷F–öç3×¶76WE&Vv—7FW$Ö÷fTw&÷W÷F–öç7Ð¢öä6†ævS×²‡fÇVR’Óâ°¢6WD76WE&Vv—7FW$Ö÷fUF&vWD–B‡fÇVR“°¢6WD76WE&Vv—7FW$Ö÷fTW'&÷"‚rr“°¢×Ð¢Æ6V†öÆFW#Ò$6†ö÷6RâVÖ'&VÆÆ ¢6Æ74æÖS×·7G–ÆW2æ76WE&Vv—7FW$Ö÷fUF&vWDf–VÆGÐ¢W6U÷'FÀ¢óà¢’¢€¢ÆF—b6Æ74æÖS×·7G–ÆW2æ76WE&Vv—7FW$Ö÷fTæõF&vWGÓà¢Çäæò÷F†W"VÖ'&VÆÆ2&Rf–Æ&ÆRâW6RF†RVÖ'&VÆÆ'WGFöâ&W6–FRâ76WBFò7&VFRöæRf—'7BãÂ÷à¢ÂöF—cà¢—Ð¢ÂöF—cà¢ÂöF—cà¢’¢€¢Ç6Æ74æÖS×·7G–ÆW2æ76WE&Vv—7FW$Ö÷fTæôÖF6‡Óà¢æò76WBÖF6†W2F†—26V&6‚à¢Â÷à¢—Ð ¢¶76WE&Vv—7FW$Ö÷fTW'&÷"ò€¢Ç6Æ74æÖS×·7G–ÆW2æ76WE&Vv—7FW$Ö÷fTW'&÷'Ò&öÆSÒ&ÆW'B#à¢¶76WE&Vv—7FW$Ö÷fTW'&÷'Ð¢Â÷à¢’¢çVÆÇÐ¢ÂöF—cà ¢ÆF—b6Æ74æÖS×·7G–ÆW2æ76WE&Vv—7FW$Ö÷fTÖöFÄfö÷FW'Óà¢Æ'WGFöà¢G—SÒ&'WGFöâ ¢6Æ74æÖS×·7G–ÆW2ç6V6öæF'”'WGFöçÐ¢öä6Æ–6³×¶6Æ÷6T76WE&Vv—7FW$Ö÷fTÖævW'Ð¢F—6&ÆVC×¶—4Ö÷f–æt76WE&Vv—7FW'Ð¢à¢6æ6VÀ¢Âö'WGFöãà¢Æ'WGFöà¢G—SÒ&'WGFöâ ¢6Æ74æÖS×·7G–ÆW2ç&–Ö'”'WGFöçÐ¢öä6Æ–6³×²‚’Óâfö–B†æFÆTÖ÷fT76WE&Vv—7FW"‚—Ð¢F—6&ÆVC×²76WE&Vv—7FW$Ö÷fUF&vWD–BÇÂ—4Ö÷f–æt76WE&Vv—7FW'Ð¢à¢¶76WE&Vv—7FW$Ö÷fTFW7F–æF–öâÓÓÒwVÖ'&VÆÆp¢òÅVÖ'&VÆÆ–6öâ6Æ74æÖS×·7G–ÆW2æ'WGFöä–6öçÒóà¢¢Ä6†ævU&Vv—7FW$–6öâ6Æ74æÖS×·7G–ÆW2æ'WGFöä–6öçÒóçÐ¢Ç7ãà¢¶—4Ö÷f–æt76WE&Vv—7FW ¢òtÖ÷f–ærâââp¢¢76WE&Vv—7FW$Ö÷fTFW7F–æF–öâÓÓÒwVÖ'&VÆÆp¢òtÖ÷fRFòVÖ'&VÆÆp¢¢tÖ÷fR76WBwÐ¢Â÷7ãà¢Âö'WGFöãà¢ÂöF—cà¢ÂöF—cà¢ÂöF—cà¢’¢çVÆÇÐ ¢Ç6V7F–öâ6Æ74æÖS×·7G–ÆW2æ76WE7VÖÖ'”6&÷W6VÇÒ&–ÖÆ&VÃÒ$76WB&Vv—7FW"7VÖÖ'’#à¢Æ'WGFöà¢G—SÒ&'WGFöâ ¢6Æ74æÖS×¶G·7G–ÆW2æ76WE7VÖÖ'”'&÷wÒG·7G–ÆW2æ6öçG&öÅFööÇF—ÖÐ¢öä6Æ–6³×²‚’Óâ†æFÆU&Vv—7FW%7VÖÖ'•6Æ–FR‚Ó—Ð¢F—6&ÆVC×¶—5&Vv—7FW%7VÖÖ'”E7F'GÐ¢&–ÖÆ&VÃÒ%6†÷r&Wf–÷W276WB&Vv—7FW"7VÖÖ'’6&G2 ¢FF×FööÇF—Ò%&Wf–÷W2 ¢à¢Ç7â&–Ö†–FFVãÒ'G'VR#î(“Â÷7ãà¢Âö'WGFöãà ¢ÆF—`¢6Æ74æÖS×·7G–ÆW2æ76WE7VÖÖ'•f–Ww÷'GÐ¢&Vc×·&Vv—7FW%7VÖÖ'•f–Ww÷'E&VgÐ¢öå67&öÆÃ×¶†æFÆU&Vv—7FW%7VÖÖ'•67&öÆÇÐ¢F$–æFWƒ×³Ð¢&–ÖÆ&VÃÒ%67&öÆÆ&ÆR76WB&Vv—7FW"7VÖÖ'’6&G2 ¢à¢ÆF—b6Æ74æÖS×¶G·7G–ÆW2ç7VÖÖ'•&÷wÒG·7G–ÆW2æ†W&õ7VÖÖ'•&÷wÒG·7G–ÆW2æ76WE7VÖÖ'•G&6·ÖÓà¢ÆF—b6Æ74æÖS×¶G·7G–ÆW2ç7VÖÖ'•F–ÆWÒG·7G–ÆW2ç&Vv—7FW%fÇVUF–ÆWÒG·7G–ÆW2æ†W&õ7VÖÖ'•F–ÆWÒG·7G–ÆW2æ†W&õ&Vv—7FW%F–ÆWÖÓà¢ÆF—b6Æ74æÖS×·7G–ÆW2æ†W&õ7VÖÖ'”†VGÓà¢Ç7â6Æ74æÖS×·7G–ÆW2æ†W&õ7VÖÖ'•F—FÆWÓå&Vv—7FW"fÇVSÂ÷7ãà¢ÂöF—cà ¢ÆF—b6Æ74æÖS×·7G–ÆW2æ†W&õ7VÖÖ'•fÇVU&÷wÓà¢Ç7G&öær6Æ74æÖS×¶G·7G–ÆW2æ†W&õ7VÖÖ'•fÇVWÒG·7G–ÆW2æ†W&õ&Vv—7FW%fÇVWÖÓà¢¶ÖöæW’†F—7Æ–VE&Vv—7FW%fÇVR—Ð¢·&Vv—7FW%fÇVUfDÖöFRÓÓÒvW†6ÇVFVBròÇ7â6Æ74æÖS×·7G–ÆW2æ†W&õ&Vv—7FW%fE7Vff—‡Óâ²dCÂ÷7ãâ¢çVÆÇÐ¢Â÷7G&öæsà¢ÂöF—cà ¢ÆF—b6Æ74æÖS×¶G·7G–ÆW2æ†W&õ7VÖÖ'”fö÷FW'ÒG·7G–ÆW2æ†W&õfDfö÷FW'ÖÓà£ÆF—b6Æ74æÖS×·7G–ÆW2çfEFövvÆTw&÷WÒ&–ÖÆ&VÃÒ%dBF—7Æ’f÷"ÆÂ76WBfÇVW2#à¢Æ'WGFöà¢G—SÒ&'WGFöâ ¢6Æ74æÖS×¶G·7G–ÆW2çfEFövvÆT'WGFöçÒG·&Vv—7FW%fÇVUfDÖöFRÓÓÒvW†6ÇVFVBrò7G–ÆW2çfEFövvÆT'WGFöä7F—fR¢rwÖÐ¢öä6Æ–6³×²‚’Óâ†æFÆU&Vv—7FW%fÇVUfDÖöFT6†ævR‚vW†6ÇVFVBr—Ð¢&–×&W76VC×·&Vv—7FW%fÇVUfDÖöFRÓÓÒvW†6ÇVFVBwÐ¢à¢W†6Ââd@¢Âö'WGFöãà¢Æ'WGFöà¢G—SÒ&'WGFöâ ¢6Æ74æÖS×¶G·7G–ÆW2çfEFövvÆT'WGFöçÒG·&Vv—7FW%fÇVUfDÖöFRÓÓÒv–æ6ÇVFVBrò7G–ÆW2çfEFövvÆT'WGFöä7F—fR¢rwÖÐ¢öä6Æ–6³×²‚’Óâ†æFÆU&Vv—7FW%fÇVUfDÖöFT6†ævR‚v–æ6ÇVFVBr—Ð¢&–×&W76VC×·&Vv—7FW%fÇVUfDÖöFRÓÓÒv–æ6ÇVFVBwÐ¢à¢–æ6Ââd@¢Âö'WGFöãà¢ÂöF—cà¢ÂöF—cà¢ÂöF—cà ¢ÆF—b6Æ74æÖS×¶G·7G–ÆW2ç7VÖÖ'•F–ÆWÒG·7G–ÆW2æÖWG&–57VÖÖ'•F–ÆWÒG·7G–ÆW2æ†W&õ7VÖÖ'•F–ÆWÖÓà¢ÆF—b6Æ74æÖS×·7G–ÆW2æ†W&õ7VÖÖ'”†VGÓà¢Ç7â6Æ74æÖS×·7G–ÆW2æ†W&õ7VÖÖ'•F—FÆWÓä–ÓG&–6RfÇVVBWV—ÖVçCÂ÷7ãà¢ÂöF—cà ¢ÆF—b6Æ74æÖS×·7G–ÆW2æ†W&õ7VÖÖ'•fÇVU&÷wÓà¢Ç7G&öær6Æ74æÖS×·7G–ÆW2æ†W&õ7VÖÖ'•fÇVWÓç¶–ÓG&–6UfÇVVDWV—ÖVçD6÷VçGÓÂ÷7G&öæsà¢ÂöF—cà ¢ÆF—b6Æ74æÖS×·7G–ÆW2æ†W&õ7VÖÖ'”fö÷FW'Ò&–Ö†–FFVãÒ'G'VR"óà¢ÂöF—cà ¢ÆF—b6Æ74æÖS×¶G·7G–ÆW2ç7VÖÖ'•F–ÆWÒG·7G–ÆW2çF÷FÄ76WG5F–ÆWÒG·7G–ÆW2æ†W&õ7VÖÖ'•F–ÆWÖÓà¢ÆF—b6Æ74æÖS×·7G–ÆW2æ†W&õ7VÖÖ'”†VGÓà¢Ç7â6Æ74æÖS×·7G–ÆW2æ†W&õ7VÖÖ'•F—FÆWÓåF÷FÂ76WG3Â÷7ãà¢ÂöF—cà ¢ÆF—b6Æ74æÖS×·7G–ÆW2æ†W&õ7VÖÖ'•fÇVU&÷wÓà¢Ç7G&öær6Æ74æÖS×·7G–ÆW2æ†W&õ7VÖÖ'•fÇVWÓç¶76WG2æÆVæwF‡ÓÂ÷7G&öæsà¢ÂöF—cà ¢ÆF—b6Æ74æÖS×¶G·7G–ÆW2æ†W&õ7VÖÖ'”fö÷FW'ÒG·7G–ÆW2æ†W&õF÷FÄfö÷FW'ÖÓà¢Ç6ÖÆÃç·&Vv—7FW%&ævTFW67&—F–öçÓÂ÷6ÖÆÃà¢ÂöF—cà¢ÂöF—cà ¢ÆF—b6Æ74æÖS×¶G·7G–ÆW2ç7VÖÖ'•F–ÆWÒG·7G–ÆW2æÖWG&–57VÖÖ'•F–ÆWÒG·7G–ÆW2æ†W&õ7VÖÖ'•F–ÆWÒG·7G–ÆW2ç7VÖÖ'”'&V¶F÷våF–ÆWÖÓà¢ÆF—b6Æ74æÖS×·7G–ÆW2æ†W&õ7VÖÖ'”†VGÓà¢Ç7â6Æ74æÖS×·7G–ÆW2æ†W&õ7VÖÖ'•F—FÆWÓäÖçVÂ76WG3Â÷7ãà¢ÂöF—cà ¢ÆF—b6Æ74æÖS×·7G–ÆW2ç7VÖÖ'”'&V¶F÷vä&öG—Óà¢ÆF—b6Æ74æÖS×·7G–ÆW2ç7VÖÖ'”'&V¶F÷vä6÷VçGÓà¢Ç7ãä6÷VçCÂ÷7ãà¢Ç7G&öæsç¶ÖçVÄ76WE7FG2æ6÷VçGÓÂ÷7G&öæsà¢ÂöF—cà ¢ÆF—b6Æ74æÖS×·7G–ÆW2ç7VÖÖ'”'&V¶F÷våfÇVW7Óà¢ÆF—b6Æ74æÖS×·7G–ÆW2ç7VÖÖ'”'&V¶F÷våfÇVU&÷wÓà¢Ç7ãäW†6ÂâdCÂ÷7ãà¢Ç7G&öæsç¶ÖöæW’†ÖçVÄ76WE7FG2çfÇVR—ÓÂ÷7G&öæsà¢ÂöF—cà¢ÆF—b6Æ74æÖS×·7G–ÆW2ç7VÖÖ'”'&V¶F÷våfÇVU&÷wÓà¢Ç7ãä–æ6ÂâdCÂ÷7ãà¢Ç7G&öæsç¶ÖöæW’„ÖF‚ç&÷VæB†ÖçVÄ76WE7FG2çfÇVR¢ãR’—ÓÂ÷7G&öæsà¢ÂöF—cà¢ÂöF—cà¢ÂöF—cà ¢ÆF—b6Æ74æÖS×·7G–ÆW2æ†W&õ7VÖÖ'”fö÷FW'Ò&–Ö†–FFVãÒ'G'VR"óà¢ÂöF—cà ¢ÆF—b6Æ74æÖS×¶G·7G–ÆW2ç7VÖÖ'•F–ÆWÒG·7G–ÆW2æÖWG&–57VÖÖ'•F–ÆWÒG·7G–ÆW2æ†W&õ7VÖÖ'•F–ÆWÒG·7G–ÆW2ç7VÖÖ'”'&V¶F÷våF–ÆWÖÓà¢ÆF—b6Æ74æÖS×·7G–ÆW2æ†W&õ7VÖÖ'”†VGÓà¢Ç7â6Æ74æÖS×·7G–ÆW2æ†W&õ7VÖÖ'•F—FÆWÓä76WG2f–ææ6VCÂ÷7ãà¢ÂöF—cà ¢ÆF—b6Æ74æÖS×·7G–ÆW2ç7VÖÖ'”'&V¶F÷vä&öG—Óà¢ÆF—b6Æ74æÖS×·7G–ÆW2ç7VÖÖ'”'&V¶F÷vä6÷VçGÓà¢Ç7ãä6÷VçCÂ÷7ãà¢Ç7G&öæsç¶f–ææ6VD76WE7FG2æ6÷VçGÓÂ÷7G&öæsà¢ÂöF—cà ¢ÆF—b6Æ74æÖS×·7G–ÆW2ç7VÖÖ'”'&V¶F÷våfÇVW7Óà¢ÆF—b6Æ74æÖS×·7G–ÆW2ç7VÖÖ'”'&V¶F÷våfÇVU&÷wÓà¢Ç7ãäW†6ÂâdCÂ÷7ãà¢Ç7G&öæsç¶ÖöæW’†f–ææ6VD76WE7FG2çfÇVR—ÓÂ÷7G&öæsà¢ÂöF—cà¢ÆF—b6Æ74æÖS×·7G–ÆW2ç7VÖÖ'”'&V¶F÷våfÇVU&÷wÓà¢Ç7ãä–æ6ÂâdCÂ÷7ãà¢Ç7G&öæsç¶ÖöæW’„ÖF‚ç&÷VæB†f–ææ6VD76WE7FG2çfÇVR¢ãR’—ÓÂ÷7G&öæsà¢ÂöF—cà¢ÂöF—cà¢ÂöF—cà ¢ÆF—b6Æ74æÖS×·7G–ÆW2æ†W&õ7VÖÖ'”fö÷FW'Ò&–Ö†–FFVãÒ'G'VR"óà¢ÂöF—cà ¢ÆF—b6Æ74æÖS×¶G·7G–ÆW2ç7VÖÖ'•F–ÆWÒG·7G–ÆW2æÖWG&–57VÖÖ'•F–ÆWÒG·7G–ÆW2æ†W&õ7VÖÖ'•F–ÆWÒG·7G–ÆW2ç7VÖÖ'”'&V¶F÷våF–ÆWÖÓà¢ÆF—b6Æ74æÖS×·7G–ÆW2æ†W&õ7VÖÖ'”†VGÓà¢Ç7â6Æ74æÖS×·7G–ÆW2æ†W&õ7VÖÖ'•F—FÆWÓä76WG2–ç7W&VCÂ÷7ãà¢ÂöF—cà ¢ÆF—b6Æ74æÖS×·7G–ÆW2ç7VÖÖ'”'&V¶F÷vä&öG—Óà¢ÆF—b6Æ74æÖS×·7G–ÆW2ç7VÖÖ'”'&V¶F÷vä6÷VçGÓà¢Ç7ãä6÷VçCÂ÷7ãà¢Ç7G&öæsç¶–ç7W&VD76WE7FG2æ6÷VçGÓÂ÷7G&öæsà¢ÂöF—cà ¢ÆF—b6Æ74æÖS×·7G–ÆW2ç7VÖÖ'”'&V¶F÷våfÇVW7Óà¢ÆF—b6Æ74æÖS×·7G–ÆW2ç7VÖÖ'”'&V¶F÷våfÇVU&÷wÓà¢Ç7ãäW†6ÂâdCÂ÷7ãà¢Ç7G&öæsç¶ÖöæW’†–ç7W&VD76WE7FG2çfÇVR—ÓÂ÷7G&öæsà¢ÂöF—cà¢ÆF—b6Æ74æÖS×·7G–ÆW2ç7VÖÖ'”'&V¶F÷våfÇVU&÷wÓà¢Ç7ãä–æ6ÂâdCÂ÷7ãà¢Ç7G&öæsç¶ÖöæW’„ÖF‚ç&÷VæB†–ç7W&VD76WE7FG2çfÇVR¢ãR’—ÓÂ÷7G&öæsà¢ÂöF—cà¢ÂöF—cà¢ÂöF—cà ¢ÆF—b6Æ74æÖS×·7G–ÆW2æ†W&õ7VÖÖ'”fö÷FW'Ò&–Ö†–FFVãÒ'G'VR"óà¢ÂöF—cà ¢ÆF—b6Æ74æÖS×¶G·7G–ÆW2ç7VÖÖ'•F–ÆWÒG·7G–ÆW2æÖWG&–57VÖÖ'•F–ÆWÒG·7G–ÆW2æ†W&õ7VÖÖ'•F–ÆWÒG·7G–ÆW2ç7VÖÖ'”'&V¶F÷våF–ÆWÖÓà¢ÆF—b6Æ74æÖS×·7G–ÆW2æ†W&õ7VÖÖ'”†VGÓà¢Ç7â6Æ74æÖS×·7G–ÆW2æ†W&õ7VÖÖ'•F—FÆWÓä76WG2Æ–6Vç6VCÂ÷7ãà¢ÂöF—cà ¢ÆF—b6Æ74æÖS×·7G–ÆW2ç7VÖÖ'”'&V¶F÷vä&öG—Óà¢ÆF—b6Æ74æÖS×·7G–ÆW2ç7VÖÖ'”'&V¶F÷vä6÷VçGÓà¢Ç7ãä6÷VçCÂ÷7ãà¢Ç7G&öæsç¶Æ–6Vç6VD76WE7FG2æ6÷VçGÓÂ÷7G&öæsà¢ÂöF—cà ¢ÆF—b6Æ74æÖS×·7G–ÆW2ç7VÖÖ'”'&V¶F÷våfÇVW7Óà¢ÆF—b6Æ74æÖS×·7G–ÆW2ç7VÖÖ'”'&V¶F÷våfÇVU&÷wÓà¢Ç7ãäW†6ÂâdCÂ÷7ãà¢Ç7G&öæsç¶ÖöæW’†Æ–6Vç6VD76WE7FG2çfÇVR—ÓÂ÷7G&öæsà¢ÂöF—cà¢ÆF—b6Æ74æÖS×·7G–ÆW2ç7VÖÖ'”'&V¶F÷våfÇVU&÷wÓà¢Ç7ãä–æ6ÂâdCÂ÷7ãà¢Ç7G&öæsç¶ÖöæW’„ÖF‚ç&÷VæB†Æ–6Vç6VD76WE7FG2çfÇVR¢ãR’—ÓÂ÷7G&öæsà¢ÂöF—cà¢ÂöF—cà¢ÂöF—cà ¢ÆF—b6Æ74æÖS×·7G–ÆW2æ†W&õ7VÖÖ'”fö÷FW'Ò&–Ö†–FFVãÒ'G'VR"óà¢ÂöF—cà ¢ÆF—b6Æ74æÖS×¶G·7G–ÆW2ç7VÖÖ'•F–ÆWÒG·7G–ÆW2ç&Vv—7FW%fÇVUF–ÆWÒG·7G–ÆW2æ†W&õ7VÖÖ'•F–ÆWÒG·7G–ÆW2æ†W&õ&Vv—7FW%F–ÆWÒG·7G–ÆW2ç&WÆ6VÖVçE7VÖÖ'•F–ÆWÖÓà¢ÆF—b6Æ74æÖS×·7G–ÆW2æ†W&õ7VÖÖ'”†VGÓà¢Ç7â6Æ74æÖS×·7G–ÆW2æ†W&õ7VÖÖ'•F—FÆWÓå&WÆ6VÖVçBfÇVSÂ÷7ãà¢ÂöF—cà ¢ÆF—b6Æ74æÖS×·7G–ÆW2æ†W&õ7VÖÖ'•fÇVU&÷wÓà¢Ç7G&öær6Æ74æÖS×¶G·7G–ÆW2æ†W&õ7VÖÖ'•fÇVWÒG·7G–ÆW2æ†W&õ&Vv—7FW%fÇVWÖÓà¢¶ÖöæW’†F—7Æ–VE&WÆ6VÖVçEfÇVR—Ð¢·&WÆ6VÖVçEfÇVUfDÖöFRÓÓÒvW†6ÇVFVBròÇ7â6Æ74æÖS×·7G–ÆW2æ†W&õ&Vv—7FW%fE7Vff—‡Óâ²dCÂ÷7ãâ¢çVÆÇÐ¢Â÷7G&öæsà¢ÂöF—cà ¢ÆF—b6Æ74æÖS×¶G·7G–ÆW2æ†W&õ7VÖÖ'”fö÷FW'ÒG·7G–ÆW2æ†W&õfDfö÷FW'ÖÓà¢ÆF—b6Æ74æÖS×·7G–ÆW2çfEFövvÆTw&÷WÒ&–ÖÆ&VÃÒ%&WÆ6VÖVçBfÇVRdBF—7Æ’#à¢Æ'WGFöà¢G—SÒ&'WGFöâ ¢6Æ74æÖS×¶G·7G–ÆW2çfEFövvÆT'WGFöçÒG·&WÆ6VÖVçEfÇVUfDÖöFRÓÓÒvW†6ÇVFVBrò7G–ÆW2çfEFövvÆT'WGFöä7F—fR¢rwÖÐ¢öä6Æ–6³×²‚’Óâ6WE&WÆ6VÖVçEfÇVUfDÖöFR‚vW†6ÇVFVBr—Ð¢&–×&W76VC×·&WÆ6VÖVçEfÇVUfDÖöFRÓÓÒvW†6ÇVFVBwÐ¢à¢W†6Ââd@¢Âö'WGFöãà¢Æ'WGFöà¢G—SÒ&'WGFöâ ¢6Æ74æÖS×¶G·7G–ÆW2çfEFövvÆT'WGFöçÒG·&WÆ6VÖVçEfÇVUfDÖöFRÓÓÒv–æ6ÇVFVBrò7G–ÆW2çfEFövvÆT'WGFöä7F—fR¢rwÖÐ¢öä6Æ–6³×²‚’Óâ6WE&WÆ6VÖVçEfÇVUfDÖöFR‚v–æ6ÇVFVBr—Ð¢&–×&W76VC×·&WÆ6VÖVçEfÇVUfDÖöFRÓÓÒv–æ6ÇVFVBwÐ¢à¢–æ6Ââd@¢Âö'WGFöãà¢ÂöF—cà¢ÂöF—cà¢ÂöF—cà¢ÂöF—cà¢ÂöF—cà ¢Æ'WGFöà¢G—SÒ&'WGFöâ ¢6Æ74æÖS×¶G·7G–ÆW2æ76WE7VÖÖ'”'&÷wÒG·7G–ÆW2æ6öçG&öÅFööÇF—ÖÐ¢öä6Æ–6³×²‚’Óâ†æFÆU&Vv—7FW%7VÖÖ'•6Æ–FRƒ—Ð¢F—6&ÆVC×¶—5&Vv—7FW%7VÖÖ'”DVæGÐ¢&–ÖÆ&VÃÒ%6†÷ræW‡B76WB&Vv—7FW"7VÖÖ'’6&G2 ¢FF×FööÇF—Ò$æW‡B ¢à¢Ç7â&–Ö†–FFVãÒ'G'VR#î(£Â÷7ãà¢Âö'WGFöãà¢Â÷6V7F–öãà ¢ÆF—b6Æ74æÖS×·7G–ÆW2çFööÆ&'Óà¢ÆÆ&VÂ6Æ74æÖS×·7G–ÆW2ç6V&6…w&Óà¢Å6V&6„–6öâ6Æ74æÖS×·7G–ÆW2ç6V&6„–6öçÒóà¢Æ–çW@¢6Æ74æÖS×·7G–ÆW2ç6V&6„–çWGÐ¢fÇVS×·6V&6…FW&×Ð¢öä6†ævS×²†WfVçB’Óâ6WE6V&6…FW&Ò†WfVçBçF&vWBçfÇVR—Ð¢Æ6V†öÆFW#Ò%6V&6‚'’76WBÂ'&æBÂÖöFVÂ÷"6W&–Â ¢&–ÖÆ&VÃÒ%6V&6‚76WB&Vv—7FW" ¢óà ¢·6V&6…FW&Òò€¢Æ'WGFöà¢G—SÒ&'WGFöâ ¢6Æ74æÖS×·7G–ÆW2æ6ÆV%6V&6„'WGFöçÐ¢öä6Æ–6³×²‚’Óâ6WE6V&6…FW&Ò‚rr—Ð¢&–ÖÆ&VÃÒ$6ÆV"6V&6‚ ¢à¢Ä6Æ÷6T–6öâ6Æ74æÖS×·7G–ÆW2æ'WGFöä–6öçÒóà¢Âö'WGFöãà¢’¢çVÆÇÐ¢ÂöÆ&VÃà ¢ÆF—b6Æ74æÖS×·7G–ÆW2çFööÆ&$7F–öç7Óà¢Æ'WGFöà¢G—SÒ&'WGFöâ ¢6Æ74æÖS×¶G·7G–ÆW2ç6V6öæF'”'WGFöçÒG·7G–ÆW2çFööÆ&%&Vg&W6„'WGFöçÖÐ¢öä6Æ–6³×¶†æFÆU&Vg&W6„76WE&Vv—7FW'Ð¢F—6&ÆVC×¶—4ÆöF–ærÇÂ—5&Vg&W6†–æu&Vv—7FW'Ð¢à¢Å&Vg&W6„–6öâ6Æ74æÖS×¶G·7G–ÆW2æ'WGFöä–6öçÒG¶—5&Vg&W6†–æu&Vv—7FW"ò7G–ÆW2çFööÆ&%&Vg&W6„–6öä7F—fR¢rwÖÒóà¢Ç7ãç¶—5&Vg&W6†–æu&Vv—7FW"òu&Vg&W6†–ærâââr¢u&Vg&W6‚wÓÂ÷7ãà¢Âö'WGFöãà ¢¶6äÖævT76WDw&÷W2ò€¢Æ'WGFöà¢G—SÒ&'WGFöâ ¢6Æ74æÖS×¶G·7G–ÆW2ç6V6öæF'”'WGFöçÒG·7G–ÆW2çFööÆ&%VÖ'&VÆÆ'WGFöçÖÐ¢öä6Æ–6³×¶÷Vä7&VFT76WDw&÷WÖævW'Ð¢à¢ÅVÖ'&VÆÆ–6öâ6Æ74æÖS×·7G–ÆW2æ'WGFöä–6öçÒóà¢Ç7ãä7&VFRVÖ'&VÆÆÂ÷7ãà¢Âö'WGFöãà¢’¢çVÆÇÐ ¢¶6äFD76WG5Fô7F—fU&Vv—7FW"ò€¢Æ'WGFöâG—SÒ&'WGFöâ"6Æ74æÖS×¶G·7G–ÆW2ç&–Ö'”'WGFöçÒG·7G–ÆW2çFööÆ&%&–Ö'”'WGFöçÖÒöä6Æ–6³×¶÷VäFD76WD6†ö–6TÖöFÇÓà¢ÅÇW4–6öâ6Æ74æÖS×·7G–ÆW2æ'WGFöä–6öçÒóà¢Ç7ãäFB76WCÂ÷7ãà¢Âö'WGFöãà¢’¢çVÆÇÐ¢ÂöF—cà¢ÂöF—cà ¢²—4ÆöF–ærbb76WG2æÆVæwF‚ò€¢f–ÇFW&VD76WG2æÆVæwF‚ò€¢Ãà¢ÆF—b6Æ74æÖS×·7G–ÆW2æ76WDÆ—7GÓà¢·f—6–&ÆT76WE&÷w2æÖ‚‡&÷r’Óâ°¢–b‡&÷ræ¶–æBÓÓÒvw&÷Wr’°¢6öç7Bw&÷WÒ&÷ræw&÷W°¢6öç7B&–Ö'”76WD–BÒvWD76WDw&÷W&–Ö'”76WD–B†w&÷W“°¢6öç7Bw&÷Wæ6†÷$76WBÒ76WG4'”–BævWB‡&–Ö'”76WD–B¢óòw&÷WæÖVÖ&W'0¢æÖ‚†ÖVÖ&W"’Óâ76WG4'”–BævWB†ÖVÖ&W"æ76WD–B’¢æf–æB‚†76WB’Óâ76WBÓÒVæFVf–æVB¢óòçVÆÃ°¢6öç7B—46öÆÆ6VBÒW‡æFVD76WDw&÷W–G2æ†2†w&÷Wæ–B“°¢6öç7Bw&÷WVææ÷FVDÆW'D6÷VçBÒw&÷WæÖVÖ&W'2ç&VGV6R‚‡7VÒÂÖVÖ&W"’Óâ°¢6öç7BÖVÖ&W$76WBÒ76WG4'”–BævWB†ÖVÖ&W"æ76WD–B“°¢&WGW&â7VÒ²†ÖVÖ&W$76WBò76WEVææ÷FVDÆW'D6÷VçB†ÖVÖ&W$76WB’¢“°¢ÒÂ“°¢6öç7Bw&÷WfÇVTW…fBÒw&÷W&Vv—7FW%fÇVR†w&÷WÂ76WG2“°¢6öç7BF—7Æ–VDw&÷WfÇVRÒ&Vv—7FW%fÇVUfDÖöFRÓÓÒv–æ6ÇVFVBp¢òÖF‚ç&÷VæB†w&÷WfÇVTW…fB¢54UEõ$Tt•5DU%õ5TÔÔ%•õdEôÕTÅD•Ä”U"¢¢w&÷WfÇVTW…fC°¢6öç7Bw&÷WfDÆ&VÂÒ&Vv—7FW%fÇVUfDÖöFRÓÓÒv–æ6ÇVFVBròt–æ6ÂâdBr¢tW†6ÂâdBs°¢6öç7BFF—F–öæÄ76WD6÷VçBÒÖF‚æÖ‚ƒÂw&÷WæÖVÖ&W'2æÆVæwF‚Ò“°¢6öç7B6å&V6V—fTG&vvVD76WBÒ6äG&÷76WD–çFôw&÷W†G&vv–æt76WD–BÂw&÷W“°¢6öç7B—476WDw&÷WG&÷F&vWBÒ6å&V6V—fTG&vvVD76WBbb76WDw&÷WG&÷F&vWD–BÓÓÒw&÷Wæ–C°¢6öç7B—476WDw&÷W×WFVBÒW‡æFVD76WD–@¢òW‡æFVD76WDw&÷W–BÓÒw&÷Wæ–@¢¢&ööÆVâ†fö7W6VD76WDw&÷W–Bbbfö7W6VD76WDw&÷W–BÓÒw&÷Wæ–B“° ¢&WGW&â€¢ÆF—`¢6Æ74æÖS×¶G·7G–ÆW2æ76WDw&÷W†VFW%&÷wÒG¶—476WDw&÷W×WFVBò7G–ÆW2æ76WDw&÷W†VFW%&÷t×WFVB¢rwÒG¶6å&V6V—fTG&vvVD76WBò7G–ÆW2æ76WDw&÷W†VFW%&÷tG&u&VG’¢rwÒG¶—476WDw&÷WG&÷F&vWBò7G–ÆW2æ76WDw&÷W†VFW%&÷tG&÷F&vWB¢rwÖÐ¢¶W“×¶76WBÖw&÷WÒG¶w&÷Wæ–GÖÐ¢FFÖ76WBÖw&÷WÖ–C×¶w&÷Wæ–GÐ¢öäG&t÷fW#×²†WfVçB’Óâ†æFÆT76WDw&÷WG&t÷fW"†WfVçBÂw&÷W—Ð¢öäG&tÆVfS×²†WfVçB’Óâ†æFÆT76WDw&÷WG&tÆVfR†WfVçBÂw&÷W—Ð¢öäG&÷×²†WfVçB’Óâfö–B†æFÆT76WDw&÷WG&÷†WfVçBÂw&÷W—Ð¢FFÖ76WBÖw&÷WÖG&÷×F&vWC×¶—476WDw&÷WG&÷F&vWBòwG'VRr¢VæFVf–æVGÐ¢à¢Ç6V7F–öà¢6Æ74æÖS×¶G·7G–ÆW2æ76WDw&÷W†VFW'ÒG¶—46öÆÆ6VBò7G–ÆW2æ76WDw&÷W†VFW$6öÆÆ6VB¢rwÖÐ¢öä6Æ–6³×²†WfVçB’Óâ°¢–b†G&vv–æt76WD–B’&WGW&ã°¢6öç7BF&vWBÒWfVçBçF&vWB2…DÔÄVÆVÖVçC°¢–b‡F&vWBæ6Æ÷6W7B‚v'WGFöâÂÂ–çWBÂ6VÆV7BÂFW‡F&VÂ·&öÆSÒ&'WGFöâ%Òr’’&WGW&ã°¢FövvÆT76WDw&÷W6öÆÆ6VB†w&÷Wæ–B“°¢×Ð¢à¢¶—476WDw&÷WG&÷F&vWBò€¢Ç7â6Æ74æÖS×·7G–ÆW2æ76WDw&÷WG&÷&ö×GÒ&öÆSÒ'7FGW2#äG&÷76WB†W&SÂ÷7ãà¢’¢çVÆÇÐ¢ÆF—b6Æ74æÖS×·7G–ÆW2æ76WDw&÷W–FVçF—G—Óà¢Ç7à¢6Æ74æÖS×·7G–ÆW2æ76WDw&÷WVÖ'&VÆÆÐ¢F—FÆS×¶w&÷WVææ÷FVDÆW'D6÷VçBâ ¢òG¶f÷&ÖDÆW'D&FvT6÷VçB†w&÷WVææ÷FVDÆW'D6÷VçB—ÒVææ÷FVBw&÷WÆW'BG¶w&÷WVææ÷FVDÆW'D6÷VçBÓÓÒòrr¢w2wÖ ¢¢VæFVf–æVGÐ¢à¢ÅVÖ'&VÆÆ–6öâ6Æ74æÖS×·7G–ÆW2æ76WDw&÷WVÖ'&VÆÆ–6öçÒóà¢¶w&÷WVææ÷FVDÆW'D6÷VçBâò€¢Ç7à¢6Æ74æÖS×¶G·7G–ÆW2ç&Vv—7FW$6†ævTÆW'D&FvWÒG·7G–ÆW2æ76WDw&÷WÆW'D&FvWÖÐ¢&–ÖÆ&VÃ×¶G¶f÷&ÖDÆW'D&FvT6÷VçB†w&÷WVææ÷FVDÆW'D6÷VçB—ÒVææ÷FVBÆW'BG¶w&÷WVææ÷FVDÆW'D6÷VçBÓÓÒòrr¢w2wÒ–âG¶w&÷WææÖWÖÐ¢à¢¶f÷&ÖDÆW'D&FvT6÷VçB†w&÷WVææ÷FVDÆW'D6÷VçB—Ð¢Â÷7ãà¢’¢çVÆÇÐ¢Â÷7ãà¢ÆF—cà¢Æƒ#ç¶w&÷WææÖWÓÂöƒ#à¢Çà¢¶w&÷WæÖVÖ&W'2æÆVæwF‡Òw&÷WVB76WG2+r¶76WDw&÷WfÇVTÖöFTÆ&VÂ†w&÷W—Ð¢¶w&÷Wç&Vv—7FW$–BÓÓÒçVÆÂòr+r6öÖ&–æVBVÖ'&VÆÆr¢rwÐ¢Â÷à¢¶—46öÆÆ6VBbbw&÷Wæ6†÷$76WBò€¢Ç7â6Æ74æÖS×·7G–ÆW2æ76WDw&÷W&Wf–WwÓà¢¶w&÷Wæ6†÷$76WBçF—FÆW×¶FF—F–öæÄ76WD6÷VçBò²G¶FF—F–öæÄ76WD6÷VçGÒÖ÷&V¢rwÐ¢Â÷7ãà¢’¢çVÆÇÐ¢ÂöF—cà¢ÂöF—cà ¢ÆF—b6Æ74æÖS×·7G–ÆW2æ76WDw&÷W7VÖÖ'—Óà¢ÆF—b6Æ74æÖS×·7G–ÆW2æ76WDw&÷WfÇVWÓà¢Ç7G&öæsä6÷VçFVBfÇVR¶ÖöæW’†F—7Æ–VDw&÷WfÇVR—ÓÂ÷7G&öæsà¢Ç7ãç¶w&÷WfDÆ&VÇÓÂ÷7ãà¢ÂöF—cà ¢ÆF—b6Æ74æÖS×¶G·7G–ÆW2æ76WD†VFW$7F–öç7ÒG·7G–ÆW2æ76WDw&÷W†VFW$7F–öç7ÖÓà¢¶6å6†&T7F—fU&Vv—7FW"ò€¢Æ'WGFöà¢G—SÒ&'WGFöâ ¢6Æ74æÖS×¶G·7G–ÆW2æ÷F–öç4'WGFöçÒG·7G–ÆW2æ6&D÷F–öç4'WGFöçÖÐ¢öä6Æ–6³×²‚’Óâ÷Vä76WDw&÷W6†&R†w&÷W—Ð¢&–ÖÆ&VÃ×¶6†&RG¶w&÷WææÖWÖÐ¢à¢Å6†&T–6öâ6Æ74æÖS×·7G–ÆW2æ'WGFöä–6öçÒóà¢Ç7ãå6†&SÂ÷7ãà¢Âö'WGFöãà¢’¢çVÆÇÐ ¢Æ'WGFöà¢G—SÒ&'WGFöâ ¢6Æ74æÖS×¶G·7G–ÆW2æW‡æD'WGFöçÒG·7G–ÆW2æ6&Ef–WtFWF–Ç4'WGFöçÒG·7G–ÆW2æ6öçG&öÅFööÇF—ÖÐ¢öä6Æ–6³×²‚’ÓâFövvÆT76WDw&÷W6öÆÆ6VB†w&÷Wæ–B—Ð¢&–ÖW‡æFVC×²—46öÆÆ6VGÐ¢FF×FööÇF—×¶—46öÆÆ6VBòuf–WrFWF–Ç2r¢t†–FRFWF–Ç2wÐ¢à¢¶—46öÆÆ6V@¢òÄ6†Wg&öäF÷vä–6öâ6Æ74æÖS×¶G·7G–ÆW2æ'WGFöä–6öçÒG·7G–ÆW2æ76WDFWF–Ç46†Wg&öçÖÒóà¢¢Ä6†Wg&öåW–6öâ6Æ74æÖS×¶G·7G–ÆW2æ'WGFöä–6öçÒG·7G–ÆW2æ76WDFWF–Ç46†Wg&öçÖÒóçÐ¢Ç7ãç¶—46öÆÆ6VBòuf–WrFWF–Ç2r¢t†–FRFWF–Ç2wÓÂ÷7ãà¢Âö'WGFöãà ¢Æ'WGFöà¢G—SÒ&'WGFöâ ¢6Æ74æÖS×¶G·7G–ÆW2æ÷F–öç4'WGFöçÒG·7G–ÆW2æ6&DÖævT'WGFöçÖÐ¢öä6Æ–6³×²‚’Óâw&÷Wæ6†÷$76WBbb÷Vä76WDw&÷WÖævW"†w&÷Wæ6†÷$76WB—Ð¢F—6&ÆVC×²w&÷Wæ6†÷$76WBÇÂ6äÖævT76WDw&÷W7Ð¢&–ÖÆ&VÃ×¶ÖævRG¶w&÷WææÖWÖÐ¢à¢ÄÖævT–6öâ6Æ74æÖS×·7G–ÆW2æ'WGFöä–6öçÒóà¢Ç7ãäÖævSÂ÷7ãà¢Âö'WGFöãà¢ÂöF—cà¢ÂöF—cà¢Â÷6V7F–öãà¢ÂöF—cà¢“°¢Ð ¢6öç7B76WBÒ&÷ræ76WC°¢6öç7B76WDw&÷WÒ&÷ræw&÷W°¢6öç7BW'6—7FVD76WDw&÷WÒÆÄ76WDw&÷WÖVÖ&W'6†—2ævWB†76WBæ–B“òæw&÷WóòçVÆÃ°¢6öç7B—5&W6öÇfVD6öÖ&–æVDw&÷WÒ76WDw&÷WbbW'6—7FVD76WDw&÷Wòç&Vv—7FW$–BÓÓÒçVÆÃ°¢6öç7B76WDw&÷WÖVÖ&W'6†—Ò76WDw&÷WÖVÖ&W'6†—2ævWB†76WBæ–B“òæÖVÖ&W"óòçVÆÃ°¢6öç7B—4Æ7D76WDw&÷WÖVÖ&W"Ò&ööÆVâ†76WDw&÷Wbb&÷ræÖVÖ&W$–æFW‚ÓÓÒ&÷ræÖVÖ&W$6÷VçBÒ“°¢6öç7B&Wf–Wu†÷FòÒ76WE&Wf–Wt–ÖvR†76WB“°¢6öç7B—4Æ—fRÒ—4Æ—fTöäÖ&¶WGÆ6R†76WB“°¢6öç7B—4fÆvvVBÒ—476WDfÆvvVB†76WB“°¢6öç7B—4fÆt'W7’Ò'W7”fÆt76WD–BÓÓÒ76WBæ–C°¢6öç7B—4W‡æFVBÒW‡æFVD76WD–BÓÓÒ76WBæ–C°¢6öç7B—476WE&÷t×WFVBÒW‡æFVD76WD–@¢ò—4W‡æFV@¢¢&ööÆVâ†fö7W6VD76WDw&÷W–Bbb76WDw&÷Wòæ–BÓÒfö7W6VD76WDw&÷W–B“°¢6öç7BFWF–ÄFö7VÖVçG2Ò76WDFö7VÖVçG2†76WB“°¢6öç7BfVÇDFö7VÖVçG2ÒfVÇDFö7VÖVçG4'”76WD–E¶76WBæ–EÒóòµÓ°¢6öç7B—5fVÇDFö7VÖVçG4ÆöF–ærÒ&ööÆVâ‡fVÇDFö7VÖVçG4ÆöF–æt'”76WD–E¶76WBæ–EÒ“°¢6öç7BfVÇDFö7VÖVçG4W'&÷"ÒfVÇDFö7VÖVçG4W'&÷$'”76WD–E¶76WBæ–EÒóòrs°¢6öç7B–ç7W&VEfÇVTW…fBÒ&VD76WD–ç7W&VEfÇVTW…fB†76WB“°¢6öç7BW7F–ÖFTæVVG5WFFRÒFöW4W7F–ÖFTæVVEWFFR†76WB’bb—5fÇVF–öåWFFTf–Æ&ÆR†76WB“°¢6öç7B÷Vå'FæW$æ÷FRÒ76WBæ÷Vå'FæW$æ÷FRóòçVÆÃ°¢6öç7B'FæW$æ÷FTWF†÷"Ò÷Vå'FæW$æ÷FSòç'FæW$'W6–æW74æÖRÇÂ÷Vå'FæW$æ÷FSòç'FæW$æÖRÇÂt–ÓG&–6R'FæW"s°¢6öç7B'FæW$æ÷FUFöæT6Æ72Ò÷Vå'FæW$æ÷FRòV÷FUFöæT6Æ74f÷%'FæW%G—R†÷Vå'FæW$æ÷FRç'FæW%G—R’¢rs°¢6öç7B'FæW$æ÷FTÆ&VÂÒ÷Vå'FæW$æ÷FSòç'FæW%G—RòG¶f÷&ÖEV÷FU'FæW%G—R†÷Vå'FæW$æ÷FRç'FæW%G—R—Òæ÷FV¢u'FæW"æ÷FRs°¢6öç7BÆFW7DÖ–çFVææ6U7FGW2Ò76WBæÆFW7DÖ–çFVææ6U7FGW2óòçVÆÃ°¢6öç7BÆFW7D—77VTæ÷FU7FGW2Ò76WBæÆFW7D—77VTæ÷FU7FGW2óòçVÆÃ°¢6öç7BÖ–çFVææ6TÆW'BÒ76WBæÖ–çFVææ6TÆW'BóòçVÆÃ°¢6öç7BÆ–6Vç6U&VæWvÄÆW'BÒ76WBæÆ–6Vç6U&VæWvÄÆW'BóòçVÆÃ°¢6öç7BFVÆW$76WD6÷'&V7F–öâÒ76WBæFVÆW$76WD6÷'&V7F–öâóòçVÆÃ°¢6öç7BFVÆW$6÷'&V7F–öå&WfÇVF–öäÆW'BÐ¢FVÆW$76WD6÷'&V7F–öãòç7FGW2ÓÓÒv66WFVBp¢bb€¢FVÆW$76WD6÷'&V7F–öâç&WfÇVF–öå7FGW2ÓÓÒvf–ÆVBp¢ÇÂFVÆW$76WD6÷'&V7F–öâç&WfÇVF–öå7FGW2ÓÓÒwVæF–ærp¢“°¢6öç7BFVÆW$6÷'&V7F–öäÆ&VÂÒFVÆW$6÷'&V7F–öå&WfÇVF–öäÆW'@¢òFVÆW$76WD6÷'&V7F–öãòç&WfÇVF–öå7FGW2ÓÓÒvf–ÆVBp¢òufÇVF–öâ&WG'’æVVFVBp¢¢ufÇVF–öâVæF–ærp¢¢FVÆW$76WD6÷'&V7F–öãòç6W&–ÄçVÖ&W$6†ævV@¢òu6W&–ÂçVÖ&W"WFFRp¢¢FVÆW$76WD6÷'&V7F–öãòç&WÆ6VÖVçE&–6T6†ævV@¢òu&WÆ6VÖVçB&–6RWFFRp¢¢u&VæWvÂFFRWFFRs°¢6öç7B—4FV6–F–ætFVÆW$6÷'&V7F–öâÒFVÆW$76WD6÷'&V7F–öà¢ò'W7”FVÆW$6÷'&V7F–öä–BÓÓÒFVÆW$76WD6÷'&V7F–öâæ–@¢¢fÇ6S°¢6öç7B—4ÖçVÅfÇVT76WBÒ76WBç6VÆV7FVDÖWF†öBÓÓÒvÖçVÂs°¢6öç7B76WEfÇVUfDÖöFRÒ76WEfÇVUfDÖöFW5¶76WBæ–EÒóò&Vv—7FW%fÇVUfDÖöFS°¢6öç7BF—7Æ–VD76WEfÇVRÒ76WEfÇVUfDÖöFRÓÓÒv–æ6ÇVFVBp¢òÖF‚ç&÷VæB„çVÖ&W"†76WBçfÇVRÇÂ’¢54UEõ$Tt•5DU%õ5TÔÔ%•õdEôÕTÅD•Ä”U"¢¢76WBçfÇVS°¢6öç7B76WEfÇVUfDÆ&VÂÒ76WEfÇVUfDÖöFRÓÓÒv–æ6ÇVFVBròt–æ6ÂâdBr¢tW†6ÂâdBs°¢6öç7B76WEfÇVUfEFövvÆTÆ&VÂÒ76WEfÇVUfDÖöFRÓÓÒv–æ6ÇVFVBròu6†÷rW†6ÂâdBr¢u6†÷r–æ6ÂâdBs°¢6öç7BÖ–çFVææ6TFöæTÆ&VÂÐ¢ÆFW7DÖ–çFVææ6U7FGW3òæ¶–æBÓÓÒv6†V6¶VBp¢òtÖ–çFVææ6R6†V6¶VBp¢¢ÆFW7DÖ–çFVææ6U7FGW3òæ¶–æBÓÓÒw&W—&VBp¢òtÖ–çFVææ6R&W—&VBp¢¢tÖ–çFVææ6R6W'f–6VBs°¢6öç7BÖ–çFVææ6TFöæTÖWFÒÆFW7DÖ–çFVææ6U7FGW0¢ò°¢ÆFW7DÖ–çFVææ6U7FGW2æ÷W&F÷$æÖRò'’G¶ÆFW7DÖ–çFVææ6U7FGW2æ÷W&F÷$æÖWÖ¢rrÀ¢ÆFW7DÖ–çFVææ6U7FGW2æ7&VFVDD—6òòf÷&ÖDFFR†ÆFW7DÖ–çFVææ6U7FGW2æ7&VFVDD—6ò’¢rrÀ¢Ð¢æf–ÇFW"„&ööÆVâ¢æ¦ö–â‚r+rr¢¢rs°¢6öç7BÖ–çFVææ6U†÷FõW&Ç2ÒÆFW7DÖ–çFVææ6U7FGW0¢òVæ—VU†÷FõW&Ç2†ÆFW7DÖ–çFVææ6U7FGW2ç†÷FõW&Ç2óòµÒ’ç6Æ–6RƒÂb¢¢µÓ°¢6öç7BÖ–çFVææ6U†÷Fô6÷VçBÒÆFW7DÖ–çFVææ6U7FGW0¢òG—VöbÆFW7DÖ–çFVææ6U7FGW2ç†÷Fô6÷VçBÓÓÒvçVÖ&W"p¢òÆFW7DÖ–çFVææ6U7FGW2ç†÷Fô6÷Vç@¢¢Ö–çFVææ6U†÷FõW&Ç2æÆVæwF€¢¢°¢6öç7B—4Ö&¶–ætÖ–çFVææ6Tæ÷FVBÒÆFW7DÖ–çFVææ6U7FGW0¢ò'W7”Ö–çFVææ6U7FGW4–BÓÓÒÆFW7DÖ–çFVææ6U7FGW2æ–@¢¢fÇ6S°¢6öç7B—77VTæ÷FTÖWFÒÆFW7D—77VTæ÷FU7FGW0¢ò°¢ÆFW7D—77VTæ÷FU7FGW2æ÷W&F÷$æÖRò'’G¶ÆFW7D—77VTæ÷FU7FGW2æ÷W&F÷$æÖWÖ¢rrÀ¢ÆFW7D—77VTæ÷FU7FGW2æ7&VFVDD—6òòf÷&ÖDFFR†ÆFW7D—77VTæ÷FU7FGW2æ7&VFVDD—6ò’¢rrÀ¢Ð¢æf–ÇFW"„&ööÆVâ¢æ¦ö–â‚r+rr¢¢rs°¢6öç7B—4Ö&¶–æt—77VTæ÷FTæ÷FVBÒÆFW7D—77VTæ÷FU7FGW0¢ò'W7”—77VTæ÷FU7FGW4–BÓÓÒÆFW7D—77VTæ÷FU7FGW2æ–@¢¢fÇ6S°¢6öç7B—4Ö&¶–ætÖ–çFVææ6TÆW'Dæ÷FVBÒÖ–çFVææ6TÆW'@¢ò'W7”Ö–çFVææ6TÆW'D–BÓÓÒÖ–çFVææ6TÆW'Bæ–@¢¢fÇ6S°¢6öç7B—4Ö&¶–ætÆ–6Vç6U&VæWvÄÆW'Dæ÷FVBÒÆ–6Vç6U&VæWvÄÆW'@¢ò'W7”Æ–6Vç6U&VæWvÄ76WD–BÓÓÒ76WBæ–@¢¢fÇ6S° ¢&WGW&â€¢ÆF—`¢6Æ74æÖS×¶G·7G–ÆW2æ76WD6&E&÷wÒG¶76WDw&÷Wò7G–ÆW2æ76WDw&÷WÖVÖ&W%&÷r¢rwÒG¶—4Æ7D76WDw&÷WÖVÖ&W"ò7G–ÆW2æ76WDw&÷WÖVÖ&W%&÷tÆ7B¢rwÒG¶G&vv–æt76WD–BÓÓÒ76WBæ–Bò7G–ÆW2æ76WD6&E&÷tG&vv–ær¢rwÒG¶—476WE&÷t×WFVBò7G–ÆW2æ76WD6&E&÷t×WFVB¢rwÖÐ¢¶W“×¶76WBæ–GÐ¢FFÖ76WBÖw&÷WÖ–C×¶76WDw&÷Wòæ–GÐ¢G&vv&ÆS×¶6äÖævT76WDw&÷W2bb—56f–æt76WDw&÷WÐ¢öäG&u7F'C×²†WfVçB’Óâ†æFÆT76WDG&u7F'B†WfVçBÂ76WB—Ð¢öäG&tVæC×¶†æFÆT76WDG&tVæGÐ¢à¢Æ'F–6ÆP¢–C×¶76WBÖ6&BÒG¶76WBæ–GÖÐ¢6Æ74æÖS×¶G·7G–ÆW2æ76WD6&GÒG¶—4W‡æFVBò7G–ÆW2æ76WD6&DW‡æFVB¢rwÒG¶—4fÆvvVBò7G–ÆW2æ76WD6&DfÆvvVB¢rwÒG¶W7F–ÖFTæVVG5WFFRò7G–ÆW2æ76WD6&DW7F–ÖFU7FÆR¢rwÒG¶÷Vå'FæW$æ÷FRòG·7G–ÆW2æ76WD6&E'FæW$æ÷FWÒG·'FæW$æ÷FUFöæT6Æ77Ö¢rwÒG¶Ö–çFVææ6TÆW'BÇÂÆ–6Vç6U&VæWvÄÆW'Bò7G–ÆW2æ76WD6&DÖ–çFVææ6UW6öÖ–ær¢rwÒG¶ÆFW7DÖ–çFVææ6U7FGW2ò7G–ÆW2æ76WD6&DÖ–çFVææ6TFöæR¢rwÒG¶ÆFW7D—77VTæ÷FU7FGW2ò7G–ÆW2æ76WD6&D—77VTæ÷FR¢rwÒG¶FVÆW$76WD6÷'&V7F–öâò7G–ÆW2æ76WD6&DFVÆW$6÷'&V7F–öâ¢rwÒG¶FVÆW$6÷'&V7F–öå&WfÇVF–öäÆW'Bò7G–ÆW2æ76WD6&DFVÆW$6÷'&V7F–öåv&æ–ær¢rwÖÐ¢à¢²†6åW6T÷væW$öæÇ”76WD7F–öç2ÇÂ—466÷VçFçEv÷&·76R’ò€¢ÆF—b6Æ74æÖS×¶G·7G–ÆW2æ76WE6–FT7F–öç7ÒG·7G–ÆW2æ76WDw&÷WÖVÖ&W$7F–öç7ÖÒ&–ÖÆ&VÃ×¶7F–öç2f÷"G¶76WBçF—FÆWÖÓà¢Æ'WGFöà¢G—SÒ&'WGFöâ ¢6Æ74æÖS×¶G·7G–ÆW2æ76WDfÆt'WGFöçÒG·7G–ÆW2æ6öçG&öÅFööÇF—ÒG¶—4fÆvvVBò7G–ÆW2æ76WDfÆt'WGFöä7F—fR¢rwÖÐ¢öä6Æ–6³×²‚’Óâfö–B†æFÆT76WDfÆuFövvÆR†76WB—Ð¢F—6&ÆVC×¶—4fÆt'W7—Ð¢&–ÖÆ&VÃ×¶—4fÆvvVBòVæfÆrG¶76WBçF—FÆWÖ¢fÆrG¶76WBçF—FÆWÖÐ¢&–×&W76VC×¶—4fÆvvVGÐ¢FF×FööÇF—×¶—4fÆvvVBòu&VÖ÷fRfÆrr¢tfÆr76WBwÐ¢à¢ÄfÆt–6öâ6Æ74æÖS×·7G–ÆW2æ76WDfÆt–6öçÒóà¢Âö'WGFöãà ¢Æ'WGFöà¢G—SÒ&'WGFöâ ¢6Æ74æÖS×¶G·7G–ÆW2æ76WE&Vv—7FW$Ö÷fT'WGFöçÒG·7G–ÆW2æ6öçG&öÅFööÇF—ÖÐ¢öä6Æ–6³×²‚’Óâ÷Vä76WE&Vv—7FW$Ö÷fTÖævW"†76WB—Ð¢&–ÖÆ&VÃ×¶Ö÷fRG¶76WBçF—FÆWÒFòæ÷F†W"76WB&Vv—7FW&Ð¢FF×FööÇF—Ò$Ö÷fR76WB ¢à¢Ä6†ævU&Vv—7FW$–6öâ6Æ74æÖS×·7G–ÆW2æ76WE&Vv—7FW$Ö÷fT–6öçÒóà¢Âö'WGFöãà ¢Æ'WGFöà¢G—SÒ&'WGFöâ ¢6Æ74æÖS×¶G·7G–ÆW2æ76WDw&÷W'WGFöçÒG·7G–ÆW2æ6öçG&öÅFööÇF—ÒG¶76WDw&÷WÇÂ—5&W6öÇfVD6öÖ&–æVDw&÷Wò7G–ÆW2æ76WDw&÷W'WGFöä7F—fR¢rwÖÐ¢öä6Æ–6³×²‚’Óâ÷Vä76WDw&÷WÖævW"†76WB—Ð¢F—6&ÆVC×²6äÖævT76WDw&÷W7Ð¢&–ÖÆ&VÃ×¶76WDw&÷W ¢òÖævRF†RVÖ'&VÆÆ6öçF–æ–ærG¶76WBçF—FÆWÖ ¢¢—5&W6öÇfVD6öÖ&–æVDw&÷W ¢ò÷VâF†R6öÖ&–æVBVÖ'&VÆÆ6öçF–æ–ærG¶76WBçF—FÆWÖ ¢¢7&VFRâVÖ'&VÆÆv—F‚G¶76WBçF—FÆWÖÐ¢FF×FööÇF—×¶6äÖævT76WDw&÷W0¢ò76WDw&÷W ¢òtÖævRVÖ'&VÆÆp¢¢—5&W6öÇfVD6öÖ&–æVDw&÷W ¢òt÷Vâ6öÖ&–æVBVÖ'&VÆÆp¢¢t7&VFRVÖ'&VÆÆp¢¢uVÖ'&VÆÆVæf–Æ&ÆRwÐ¢à¢ÅVÖ'&VÆÆ–6öâ6Æ74æÖS×·7G–ÆW2æ76WDw&÷W'WGFöä–6öçÒóà¢Âö'WGFöãà¢ÂöF—cà¢’¢çVÆÇÐ¢ÆF—b6Æ74æÖS×·7G–ÆW2æ76WD†VFW'Óà¢ÆF—b6Æ74æÖS×·7G–ÆW2æ76WEF—FÆT&Æö6·Óà¢¶—4fÆvvVBÇÂ—4Æ—fRÇÂW7F–ÖFTæVVG5WFFRÇÂ÷Vå'FæW$æ÷FRÇÂÖ–çFVææ6TÆW'BÇÂÆ–6Vç6U&VæWvÄÆW'BÇÂÆFW7DÖ–çFVææ6U7FGW2ÇÂÆFW7D—77VTæ÷FU7FGW2ÇÂFVÆW$76WD6÷'&V7F–öâò€¢ÆF—b6Æ74æÖS×·7G–ÆW2æ&FvU&÷wÓà¢¶—4fÆvvVBòÇ7â6Æ74æÖS×¶G·7G–ÆW2æ&FvWÒG·7G–ÆW2æ&FvTFævW'ÖÓäfÆvvVCÂ÷7ãâ¢çVÆÇÐ¢¶—4Æ—fRòÇ7â6Æ74æÖS×¶G·7G–ÆW2æ&FvWÒG·7G–ÆW2æ&FvU7V66W77ÖÓäÆ—fRöâÖ&¶WGÆ6SÂ÷7ãâ¢çVÆÇÐ¢¶W7F–ÖFTæVVG5WFFRò€¢Ç7â6Æ74æÖS×¶G·7G–ÆW2æ&FvWÒG·7G–ÆW2æ&FvUv&æ–æwÖÓäW7F–ÖFRæVVG2WFFSÂ÷7ãà¢’¢çVÆÇÐ¢¶÷Vå'FæW$æ÷FRòÇ7â6Æ74æÖS×¶G·7G–ÆW2æ&FvWÒG·7G–ÆW2æ&FvT–æf÷ÒG·'FæW$æ÷FUFöæT6Æ77ÖÓç·'FæW$æ÷FTÆ&VÇÓÂ÷7ãâ¢çVÆÇÐ¢¶Ö–çFVææ6TÆW'BòÇ7â6Æ74æÖS×¶G·7G–ÆW2æ&FvWÒG·7G–ÆW2æ&FvTÖ–çFVææ6UW6öÖ–æwÖÓäÖ–çFVææ6RW6öÖ–æsÂ÷7ãâ¢çVÆÇÐ¢¶Æ–6Vç6U&VæWvÄÆW'BòÇ7â6Æ74æÖS×¶G·7G–ÆW2æ&FvWÒG·7G–ÆW2æ&FvTÖ–çFVææ6UW6öÖ–æwÖÓäÆ–6Vç6R&VæWvÂW6öÖ–æsÂ÷7ãâ¢çVÆÇÐ¢¶ÆFW7DÖ–çFVææ6U7FGW2òÇ7â6Æ74æÖS×¶G·7G–ÆW2æ&FvWÒG·7G–ÆW2æ&FvTÖ–çFVææ6TFöæWÖÓç¶Ö–çFVææ6TFöæTÆ&VÇÓÂ÷7ãâ¢çVÆÇÐ¢¶ÆFW7D—77VTæ÷FU7FGW2òÇ7â6Æ74æÖS×¶G·7G–ÆW2æ&FvWÒG·7G–ÆW2æ&FvT—77VTæ÷FWÖÓä÷Vâ—77VSÂ÷7ãâ¢çVÆÇÐ¢¶FVÆW$76WD6÷'&V7F–öâòÇ7â6Æ74æÖS×¶G·7G–ÆW2æ&FvWÒG·7G–ÆW2æ&FvTFVÆW$6÷'&V7F–öçÒG¶FVÆW$6÷'&V7F–öå&WfÇVF–öäÆW'Bò7G–ÆW2æ&FvTFVÆW$6÷'&V7F–öåv&æ–ær¢rwÖÓç¶FVÆW$6÷'&V7F–öäÆ&VÇÓÂ÷7ãâ¢çVÆÇÐ¢ÂöF—cà¢’¢çVÆÇÐ¢Æƒ#ç¶76WBçF—FÆWÓÂöƒ#à¢Çç¶'V–ÆD76WDÖWF†76WB—ÓÂ÷à¢ÆF—b6Æ74æÖS×·7G–ÆW2æ76WDÖWF&÷wÓà¢Ç7â6Æ74æÖS×·7G–ÆW2æ76WEfÇVTÖWF†öDÆ&VÇÓç¶ÖWF†öDÆ&VÂ†76WBç6VÆV7FVDÖWF†öB—ÒfÇVSÂ÷7ãà¢¶—46öÖ&–æVE&Vv—7FW%f–Wrò€¢Ç7â6Æ74æÖS×·7G–ÆW2æ76WE6÷W&6U&Vv—7FW$æÖWÓç¶76WBç&Vv—7FW$æÖRÇÂt76WB&Vv—7FW"wÓÂ÷7ãà¢’¢çVÆÇÐ¢Ç7â6Æ74æÖS×·7G–ÆW2æ76WE6fVDFFTÆ&VÇÓç¶76WE7FGW4FFTÆ&VÂ†76WB—ÓÂ÷7ãà¢ÂöF—cà ¢¶—4ÖçVÅfÇVT76WBò€¢ÆF—b6Æ74æÖS×·7G–ÆW2æÖçVÅfÇVTæ÷F–6WÒ&öÆSÒ&æ÷FR#à¢Ç7â6Æ74æÖS×·7G–ÆW2æÖçVÅfÇVTæ÷F–6T–6öçÒ&–Ö†–FFVãÒ'G'VR#æ“Â÷7ãà¢Ç7ãäÖçVÂfÇVR—2f—†VB(	B—Bv–ÆÂæ÷BWFöÖF–6ÆÇ’WFFR'’—G6VÆbãÂ÷7ãà¢ÂöF—cà¢’¢çVÆÇÐ ¢ÂöF—cà ¢ÆF—b6Æ74æÖS×·7G–ÆW2æ76WD†VFW$6–FWÓà¢ÆF—b6Æ74æÖS×·7G–ÆW2çfÇVT&Æö6·Óà¢ÆF—b6Æ74æÖS×·7G–ÆW2æ76WEfÇVUfDF—7Æ—Óà¢ÆF—b6Æ74æÖS×·7G–ÆW2æ76WEfÇVUfEFW‡GÓà¢ÆF—b6Æ74æÖS×·7G–ÆW2æ76WEfÇVUfDÖ÷VçE&÷wÓà¢Ç7G&öæsç¶ÖöæW’†F—7Æ–VD76WEfÇVR—ÓÂ÷7G&öæsà¢Æ'WGFöà¢G—SÒ&'WGFöâ ¢6Æ74æÖS×¶G·7G–ÆW2æ76WEfÇVUfEFövvÆWÒG·7G–ÆW2æ76WD6&EfEFövvÆWÒG·7G–ÆW2æ6öçG&öÅFööÇF—ÒG¶76WEfÇVUfDÖöFRÓÓÒv–æ6ÇVFVBrò7G–ÆW2æ76WEfÇVUfEFövvÆT–æ6ÇVFVB¢rwÖÐ¢öä6Æ–6³×²‚’Óâ†æFÆT76WEfÇVUfEFövvÆR†76WBæ–B—Ð¢&–ÖÆ&VÃ×¶76WEfÇVUfEFövvÆTÆ&VÇÐ¢&–×&W76VC×¶76WEfÇVUfDÖöFRÓÓÒv–æ6ÇVFVBwÐ¢FF×FööÇF—×¶76WEfÇVUfEFövvÆTÆ&VÇÐ¢à¢Ç7â&–Ö†–FFVãÒ'G'VR#ç¶76WEfÇVUfDÖöFRÓÓÒv–æ6ÇVFVBrò~(’r¢~(¢wÓÂ÷7ãà¢Âö'WGFöãà¢ÂöF—cà¢Ç7ãç¶76WEfÇVUfDÆ&VÇÓÂ÷7ãà¢ÂöF—cà¢ÂöF—cà¢ÂöF—cà ¢ÆF—b6Æ74æÖS×¶G·7G–ÆW2æ76WD†VFW$7F–öç7ÒG¶—466÷VçFçEv÷&·76Rò7G–ÆW2æ76WD†VFW$7F–öç466÷VçFçB¢rwÖÓà¢¶W7F–ÖFTæVVG5WFFRbb6åW6T÷væW$öæÇ”76WD7F–öç2ò€¢Æ'WGFöà¢G—SÒ&'WGFöâ ¢6Æ74æÖS×¶G·7G–ÆW2æW‡æD'WGFöçÒG·7G–ÆW2çWFFTW7F–ÖFT–æÆ–æT'WGFöçÖÐ¢F—6&ÆVC×¶'W7•&WfÇVT76WD–BÓÓÒ76WBæ–GÐ¢öä6Æ–6³×²‚’Óâfö–B†æFÆUWFFTW7F–ÖFR†76WB—Ð¢à¢ÅG&VæD–6öâ6Æ74æÖS×·7G–ÆW2æ'WGFöä–6öçÒóà¢Ç7ãç¶'W7•&WfÇVT76WD–BÓÓÒ76WBæ–BòuWFF–ærâââr¢uWFFRW7F–ÖFRwÓÂ÷7ãà¢Âö'WGFöãà¢’¢çVÆÇÐ ¢¶6åW6T÷væW$öæÇ”76WD7F–öç2ò€¢Æ'WGFöà¢G—SÒ&'WGFöâ ¢6Æ74æÖS×¶G·7G–ÆW2æ÷F–öç4'WGFöçÒG·7G–ÆW2æ6&D÷F–öç4'WGFöçÖÐ¢öä6Æ–6³×²‚’Óâ÷Vä76WEV÷FT÷F–öç2†76WB—Ð¢à¢Å6†&T–6öâ6Æ74æÖS×·7G–ÆW2æ'WGFöä–6öçÒóà¢Ç7ãå6†&SÂ÷7ãà¢Âö'WGFöãà¢’¢çVÆÇÐ ¢¶—466÷VçFçEv÷&·76Rò€¢Æ'WGFöà¢G—SÒ&'WGFöâ ¢6Æ74æÖS×¶G·7G–ÆW2æ÷F–öç4'WGFöçÒG·7G–ÆW2æ6&D÷F–öç4'WGFöçÒG·7G–ÆW2æ6&D66÷VçFçDæ÷FT'WGFöçÖÐ¢öä6Æ–6³×²‚’Óâ÷Vä66÷VçFçDæ÷FTÖöFÂ†76WB—Ð¢&–ÖÆ&VÃ×¶ÆVfRæ÷FRöâG¶76WBçF—FÆWÖÐ¢à¢Äæ÷FT–6öâ6Æ74æÖS×·7G–ÆW2æ'WGFöä–6öçÒóà¢Ç7ãäæ÷FSÂ÷7ãà¢Âö'WGFöãà¢’¢çVÆÇÐ ¢Æ'WGFöà¢G—SÒ&'WGFöâ ¢6Æ74æÖS×¶G·7G–ÆW2æW‡æD'WGFöçÒG·7G–ÆW2æ6&Ef–WtFWF–Ç4'WGFöçÒG·7G–ÆW2æ6öçG&öÅFööÇF—ÖÐ¢öä6Æ–6³×²‚’Óâ6WDW‡æFVD76WD–B‚†7W'&VçB’Óâ†7W'&VçBÓÓÒ76WBæ–BòçVÆÂ¢76WBæ–B’—Ð¢&–ÖW‡æFVC×¶—4W‡æFVGÐ¢&–Ö6öçG&öÇ3×¶76WB×æVÂÒG¶76WBæ–GÖÐ¢FF×FööÇF—×¶—4W‡æFVBòt†–FRFWF–Ç2r¢uf–WrFWF–Ç2wÐ¢à¢¶—4W‡æFV@¢òÄ6†Wg&öåW–6öâ6Æ74æÖS×¶G·7G–ÆW2æ'WGFöä–6öçÒG·7G–ÆW2æ76WDFWF–Ç46†Wg&öçÖÒóà¢¢Ä6†Wg&öäF÷vä–6öâ6Æ74æÖS×¶G·7G–ÆW2æ'WGFöä–6öçÒG·7G–ÆW2æ76WDFWF–Ç46†Wg&öçÖÒóçÐ¢Ç7ãç¶—4W‡æFVBòt†–FRFWF–Ç2r¢uf–WrFWF–Ç2wÓÂ÷7ãà¢Âö'WGFöãà ¢Æ'WGFöà¢G—SÒ&'WGFöâ ¢6Æ74æÖS×¶G·7G–ÆW2æ÷F–öç4'WGFöçÒG·7G–ÆW2æ6&DÖævT'WGFöçÖÐ¢öä6Æ–6³×²‚’Óâ÷Vä7F–öäF–Æör†76WB—Ð¢à¢ÄÖævT–6öâ6Æ74æÖS×·7G–ÆW2æ'WGFöä–6öçÒóà¢Ç7ãäÖævSÂ÷7ãà¢Âö'WGFöãà¢ÂöF—cà¢ÂöF—cà ¢¶FVÆW$76WD6÷'&V7F–öâbb6åW6T÷væW$öæÇ”76WD7F–öç2ò€¢ÆF—b6Æ74æÖS×¶G·7G–ÆW2æFVÆW$6÷'&V7F–öä&ææW'ÒG¶FVÆW$6÷'&V7F–öå&WfÇVF–öäÆW'Bò7G–ÆW2æFVÆW$6÷'&V7F–öä&ææW%v&æ–ær¢rwÖÒ&öÆSÒ'7FGW2#à¢ÆF—b6Æ74æÖS×·7G–ÆW2æFVÆW$6÷'&V7F–öä6÷—Óà¢Ç7â6Æ74æÖS×·7G–ÆW2æFVÆW$6÷'&V7F–öä–6öçÒ&–Ö†–FFVãÒ'G'VR#ç¶FVÆW$6÷'&V7F–öå&WfÇVF–öäÆW'Bòrr¢~)É2wÓÂ÷7ãà¢ÆF—cà¢Ç7G&öæsç¶FVÆW$6÷'&V7F–öå&WfÇVF–öäÆW'@¢òFVÆW$76WD6÷'&V7F–öâç&WfÇVF–öå7FGW2ÓÓÒvf–ÆVBp¢òu&WÆ6VÖVçB&–6R6fVB(	BfÇVF–öâ&WG'’æVVFVBp¢¢u&WÆ6VÖVçB&–6R6fVB(	BfÇVF–öâVæF–ærp¢¢FVÆW$76WD6÷'&V7F–öâæÆ–6Vç6U&VæWvÄFFT6†ævV@¢òtÆ–6Væ6R&VæWvÂv—F–ær–÷W"&÷fÂp¢¢tFVÆW"WFFRv—F–ær–÷W"&÷fÂwÓÂ÷7G&öæsà¢Çç¶FVÆW$6÷'&V7F–öå&WfÇVF–öäÆW'@¢òFVÆW$76WD6÷'&V7F–öâç&WfÇVF–öå7FGW2ÓÓÒvf–ÆVBp¢òFVÆW$76WD6÷'&V7F–öâç&WfÇVF–öäf–ÇW&TÖW76vRÇÂt–ÓG&–6R6÷VÆBæ÷B&V6Æ7VÆFRF†—276WBWFöÖF–6ÆÇ’âp¢¢t–ÓG&–6R—27F–ÆÂ&V6Æ7VÆF–ærF†—276WBâ6fR&WG'’&V6öÖW2f–Æ&ÆR–bF†RGFV×B—2–çFW''WFVBâp¢¢FVÆW$6÷'&V7F–öäFW67&—F–öâ†FVÆW$76WD6÷'&V7F–öâ—ÓÂ÷à¢Ç6ÖÆÃç¶FVÆW$6÷'&V7F–öå&WfÇVF–öäÆW'@¢òuF†R66WFVB&WÆ6VÖVçB&–6R&VÖ–ç26fVB&Vv&FÆW72öbF†RfÇVF–öâ&W7VÇBâp¢¢FVÆW$76WD6÷'&V7F–öâæÆ–6Vç6U&VæWvÄFFT6†ævV@¢òu&Wf–WrF†—2FFR&Vf÷&RF†RÆ–6Væ6RW‡W'B6â7V&Ö—Bæ÷F†W"WFFRâp¢¢u&Wf–WrF†—2öæR6†ævR&Vf÷&RF†RFVÆW"6â7V&Ö—Bæ÷F†W"WFFRf÷"F†—276WBâwÓÂ÷6ÖÆÃà¢ÂöF—cà¢ÂöF—cà¢ÆF—b6Æ74æÖS×·7G–ÆW2æFVÆW$6÷'&V7F–öä7F–öç7Óà¢¶FVÆW$6÷'&V7F–öå&WfÇVF–öäÆW'Bò€¢Æ'WGFöà¢G—SÒ&'WGFöâ ¢6Æ74æÖS×·7G–ÆW2æFVÆW$6÷'&V7F–öä66WD'WGFöçÐ¢F—6&ÆVC×¶—4FV6–F–ætFVÆW$6÷'&V7F–öâÇÂFVÆW$76WD6÷'&V7F–öâç&WfÇVF–öå&WG'–&ÆWÐ¢öä6Æ–6³×²‚’Óâfö–B†æFÆTFVÆW$6÷'&V7F–öå&WfÇVF–öå&WG'’†FVÆW$76WD6÷'&V7F–öâ—Ð¢à¢¶—4FV6–F–ætFVÆW$6÷'&V7F–öà¢òu&WG'––æ~(
bp¢¢FVÆW$76WD6÷'&V7F–öâç&WfÇVF–öå&WG'–&ÆP¢òu&WG'’fÇVF–öâp¢¢u&V6Æ7VÆF–öâVæF–ærwÐ¢Âö'WGFöãà¢’¢€¢Ãà¢Æ'WGFöà¢G—SÒ&'WGFöâ ¢6Æ74æÖS×·7G–ÆW2æFVÆW$6÷'&V7F–öäFV6Æ–æT'WGFöçÐ¢F—6&ÆVC×¶—4FV6–F–ætFVÆW$6÷'&V7F–öçÐ¢öä6Æ–6³×²‚’Óâfö–B†æFÆTFVÆW$6÷'&V7F–öäFV6—6–öâ†FVÆW$76WD6÷'&V7F–öâÂw&V¦V7Br—Ð¢à¢¶—4FV6–F–ætFVÆW$6÷'&V7F–öâòu6f–æ~(
br¢tFV6Æ–æRwÐ¢Âö'WGFöãà¢Æ'WGFöà¢G—SÒ&'WGFöâ ¢6Æ74æÖS×·7G–ÆW2æFVÆW$6÷'&V7F–öä66WD'WGFöçÐ¢F—6&ÆVC×¶—4FV6–F–ætFVÆW$6÷'&V7F–öçÐ¢öä6Æ–6³×²‚’Óâfö–B†æFÆTFVÆW$6÷'&V7F–öäFV6—6–öâ†FVÆW$76WD6÷'&V7F–öâÂv66WBr—Ð¢à¢¶—4FV6–F–ætFVÆW$6÷'&V7F–öâòu6f–æ~(
br¢t66WBWFFRwÐ¢Âö'WGFöãà¢Âóà¢—Ð¢ÂöF—cà¢ÂöF—cà¢’¢çVÆÇÐ ¢¶÷Vå'FæW$æ÷FRò€¢ÆF—b6Æ74æÖS×¶G·7G–ÆW2ç'FæW$æ÷FT&ææW'ÒG·'FæW$æ÷FUFöæT6Æ77ÖÓà¢ÆF—b6Æ74æÖS×·7G–ÆW2ç'FæW$æ÷FUFW‡GÓà¢Ç7G&öæsäæ÷FRg&öÒ·'FæW$æ÷FTWF†÷'ÓÂ÷7G&öæsà¢Çç¶÷Vå'FæW$æ÷FRææ÷FUFW‡GÓÂ÷à¢¶÷Vå'FæW$æ÷FRæGF6†ÖVçBò€¢Æ¢6Æ74æÖS×·7G–ÆW2ç'FæW$æ÷FTGF6†ÖVçDÆ–æ·Ð¢‡&Vc×¶÷Vå'FæW$æ÷FRæGF6†ÖVçBçW&ÇÐ¢F&vWCÒ%ö&Ææ² ¢&VÃÒ&æö÷VæW"æ÷&VfW'&W" ¢à¢Ç7ãä÷VâV÷FRDcÂ÷7ãà¢Ç6ÖÆÃç¶÷Vå'FæW$æ÷FRæGF6†ÖVçBæf–ÆTæÖWÒ+r¶f÷&ÖD'—FU6—¦R†÷Vå'FæW$æ÷FRæGF6†ÖVçBæ'—FU6—¦R—ÓÂ÷6ÖÆÃà¢Âöà¢’¢çVÆÇÐ¢ÂöF—cà¢¶6åW6T÷væW$öæÇ”76WD7F–öç2ò€¢Æ'WGFöà¢G—SÒ&'WGFöâ ¢6Æ74æÖS×·7G–ÆW2ç'FæW$æ÷FT'WGFöçÐ¢öä6Æ–6³×²‚’Óâfö–B†æFÆTÖ&µ'FæW$æ÷FTæ÷FVB†÷Vå'FæW$æ÷FRæ–BÂ76WBæ–B—Ð¢à¢æ÷FV@¢Âö'WGFöãà¢’¢çVÆÇÐ¢ÂöF—cà¢’¢çVÆÇÐ ¢¶Ö–çFVææ6TÆW'Bò€¢ÆF—b6Æ74æÖS×¶G·7G–ÆW2ç'FæW$æ÷FT&ææW'ÒG·7G–ÆW2æÖ–çFVææ6UW6öÖ–æt&ææW'ÖÓà¢ÆF—b6Æ74æÖS×·7G–ÆW2ç'FæW$æ÷FUFW‡GÓà¢Ç7G&öæsç¶Ö–çFVææ6TÆW'Bæ†VF–ærÇÂtÖ–çFVææ6RW6öÖ–ærwÓÂ÷7G&öæsà¢Çç¶Ö–çFVææ6TÆW'Bæ&öG—ÓÂ÷à¢¶Ö–çFVææ6TÆW'Bæ6ö×WFVE7FGW4Æ&VÂòÇ6ÖÆÂ6Æ74æÖS×·7G–ÆW2æÖ–çFVææ6UW6öÖ–ætÖWFÓç¶Ö–çFVææ6TÆW'Bæ6ö×WFVE7FGW4Æ&VÇÓÂ÷6ÖÆÃâ¢çVÆÇÐ¢ÂöF—cà¢¶6åW6T÷væW$öæÇ”76WD7F–öç2ò€¢Æ'WGFöà¢G—SÒ&'WGFöâ ¢6Æ74æÖS×·7G–ÆW2ç'FæW$æ÷FT'WGFöçÐ¢F—6&ÆVC×¶—4Ö&¶–ætÖ–çFVææ6TÆW'Dæ÷FVGÐ¢öä6Æ–6³×²‚’Óâfö–B†æFÆTÖ&´Ö–çFVææ6TÆW'Dæ÷FVB†Ö–çFVææ6TÆW'Bæ–BÂ76WBæ–B—Ð¢à¢¶—4Ö&¶–ætÖ–çFVææ6TÆW'Dæ÷FVBòtæ÷F–ærâââr¢tæ÷FVBwÐ¢Âö'WGFöãà¢’¢çVÆÇÐ¢ÂöF—cà¢’¢çVÆÇÐ ¢¶Æ–6Vç6U&VæWvÄÆW'Bò€¢ÆF—b6Æ74æÖS×¶G·7G–ÆW2ç'FæW$æ÷FT&ææW'ÒG·7G–ÆW2æÖ–çFVææ6UW6öÖ–æt&ææW'ÖÓà¢ÆF—b6Æ74æÖS×·7G–ÆW2ç'FæW$æ÷FUFW‡GÓà¢Ç7G&öæsç¶Æ–6Vç6U&VæWvÄÆW'Bæ†VF–ærÇÂtÆ–6Vç6R&VæWvÂW6öÖ–ærwÓÂ÷7G&öæsà¢Çç¶Æ–6Vç6U&VæWvÄÆW'Bæ&öG—ÓÂ÷à¢Ç6ÖÆÂ6Æ74æÖS×·7G–ÆW2æÖ–çFVææ6UW6öÖ–ætÖWFÓç¶Æ–6Vç6U&VæWvÄÆW'Bæ6ö×WFVE7FGW4Æ&VÇÓÂ÷6ÖÆÃà¢ÂöF—cà¢¶6åW6T÷væW$öæÇ”76WD7F–öç2ò€¢Æ'WGFöà¢G—SÒ&'WGFöâ ¢6Æ74æÖS×·7G–ÆW2ç'FæW$æ÷FT'WGFöçÐ¢F—6&ÆVC×¶—4Ö&¶–ætÆ–6Vç6U&VæWvÄÆW'Dæ÷FVGÐ¢öä6Æ–6³×²‚’Óâfö–B†æFÆTÖ&´Æ–6Vç6U&VæWvÄÆW'Dæ÷FVB†76WBæ–BÂÆ–6Vç6U&VæWvÄÆW'Bç&VæWvÄFFR—Ð¢à¢¶—4Ö&¶–ætÆ–6Vç6U&VæWvÄÆW'Dæ÷FVBòtæ÷F–ærâââr¢tæ÷FVBwÐ¢Âö'WGFöãà¢’¢çVÆÇÐ¢ÂöF—cà¢’¢çVÆÇÐ ¢¶ÆFW7D—77VTæ÷FU7FGW2ò€¢ÆF—b6Æ74æÖS×¶G·7G–ÆW2ç'FæW$æ÷FT&ææW'ÒG·7G–ÆW2æ—77VTæ÷FT&ææW'ÖÓà¢ÆF—b6Æ74æÖS×·7G–ÆW2ç'FæW$æ÷FUFW‡GÓà¢Ç7G&öæsä÷Vâ—77VR&W÷'FVCÂ÷7G&öæsà¢Çç¶ÆFW7D—77VTæ÷FU7FGW2ææ÷FWÓÂ÷à¢¶—77VTæ÷FTÖWFòÇ6ÖÆÂ6Æ74æÖS×·7G–ÆW2æ—77VTæ÷FTÖWFÓç¶—77VTæ÷FTÖWFÓÂ÷6ÖÆÃâ¢çVÆÇÐ¢ÂöF—cà¢¶6åW6T÷væW$öæÇ”76WD7F–öç2ò€¢Æ'WGFöà¢G—SÒ&'WGFöâ ¢6Æ74æÖS×·7G–ÆW2ç'FæW$æ÷FT'WGFöçÐ¢F—6&ÆVC×¶—4Ö&¶–æt—77VTæ÷FTæ÷FVGÐ¢öä6Æ–6³×²‚’Óâfö–B†æFÆTÖ&´—77VTæ÷FU7FGW4æ÷FVB†ÆFW7D—77VTæ÷FU7FGW2æ–BÂ76WBæ–B—Ð¢à¢¶—4Ö&¶–æt—77VTæ÷FTæ÷FVBòtæ÷F–ærâââr¢tæ÷FVBwÐ¢Âö'WGFöãà¢’¢çVÆÇÐ¢ÂöF—cà¢’¢çVÆÇÐ ¢¶ÆFW7DÖ–çFVææ6U7FGW2ò€¢ÆF—b6Æ74æÖS×¶G·7G–ÆW2ç'FæW$æ÷FT&ææW'ÒG·7G–ÆW2æÖ–çFVææ6TFöæT&ææW'ÖÓà¢ÆF—b6Æ74æÖS×·7G–ÆW2ç'FæW$æ÷FUFW‡GÓà¢Ç7G&öæsäÖ–çFVææ6R†2&VVâFöæSÂ÷7G&öæsà¢Çç¶ÆFW7DÖ–çFVææ6U7FGW2ç7VÖÖ'—ÓÂ÷à¢¶ÆFW7DÖ–çFVææ6U7FGW2ææ÷FRòÇäæ÷FW2õ&ö&ÆV×3¢¶ÆFW7DÖ–çFVææ6U7FGW2ææ÷FWÓÂ÷â¢çVÆÇÐ¢¶Ö–çFVææ6U†÷FõW&Ç2æÆVæwF‚ò€¢ÆF—b6Æ74æÖS×·7G–ÆW2æÖ–çFVææ6TFöæU†÷Fõ7G&—Ò&–ÖÆ&VÃÒ$Ö–çFVææ6R†÷F÷2#à¢¶Ö–çFVææ6U†÷FõW&Ç2æÖ‚‡W&ÂÂ–æFW‚’Óâ€¢Æ¢¶W“×¶G¶ÆFW7DÖ–çFVææ6U7FGW2æ–GÒÖÖ–çFVææ6R×†÷FòÒG¶–æFW‡ÖÐ¢‡&Vc×·W&ÇÐ¢F&vWCÒ%ö&Ææ² ¢&VÃÒ&æö÷VæW"æ÷&VfW'&W" ¢6Æ74æÖS×·7G–ÆW2æÖ–çFVææ6TFöæU†÷FôÆ–æ·Ð¢à¢Æ–Ör7&3×·W&ÇÒÇC×¶Ö–çFVææ6R†÷FòG¶–æFW‚²ÖÒóà¢Âöà¢’—Ð¢ÂöF—cà¢’¢Ö–çFVææ6U†÷Fô6÷VçBâò€¢Çç¶Ö–çFVææ6U†÷Fô6÷VçGÒÖ–çFVææ6R†÷F÷¶Ö–çFVææ6U†÷Fô6÷VçBÓÓÒòrr¢w2wÒ6fVBFòF†—276WBãÂ÷à¢’¢çVÆÇÐ¢¶Ö–çFVææ6U†÷FõW&Ç2æÆVæwF‚âbbÖ–çFVææ6U†÷Fô6÷VçBâÖ–çFVææ6U†÷FõW&Ç2æÆVæwF‚ò€¢Ç6ÖÆÂ6Æ74æÖS×·7G–ÆW2æÖ–çFVææ6TFöæTÖWFÓà¢6†÷v–ær¶Ö–çFVææ6U†÷FõW&Ç2æÆVæwF‡Òöb¶Ö–çFVææ6U†÷Fô6÷VçGÒÖ–çFVææ6R†÷F÷2à¢Â÷6ÖÆÃà¢’¢çVÆÇÐ¢¶Ö–çFVææ6TFöæTÖWFòÇ6ÖÆÂ6Æ74æÖS×·7G–ÆW2æÖ–çFVææ6TFöæTÖWFÓç¶Ö–çFVææ6TFöæTÖWFÓÂ÷6ÖÆÃâ¢çVÆÇÐ¢ÂöF—cà¢¶6åW6T÷væW$öæÇ”76WD7F–öç2ò€¢Æ'WGFöà¢G—SÒ&'WGFöâ ¢6Æ74æÖS×·7G–ÆW2ç'FæW$æ÷FT'WGFöçÐ¢F—6&ÆVC×¶—4Ö&¶–ætÖ–çFVææ6Tæ÷FVGÐ¢öä6Æ–6³×²‚’Óâfö–B†æFÆTÖ&´Ö–çFVææ6U7FGW4æ÷FVB†ÆFW7DÖ–çFVææ6U7FGW2æ–BÂ76WBæ–B—Ð¢à¢¶—4Ö&¶–ætÖ–çFVææ6Tæ÷FVBòtæ÷F–ærâââr¢tæ÷FVBwÐ¢Âö'WGFöãà¢’¢çVÆÇÐ¢ÂöF—cà¢’¢çVÆÇÐ¢ÂöF—cà ¢¶—4W‡æFVBò€¢ÆF—b6Æ74æÖS×·7G–ÆW2æ76WD&öG—Ò–C×¶76WB×æVÂÒG¶76WBæ–GÖÓà¢²‚‚’Óâ°¢6öç7BFWF–Å†÷F÷2ÒvWDFWF–Å†÷F÷2†76WB“°¢6öç7BFWF–Å†÷Fô–æFW‚ÒvWDFWF–Å†÷Fô–æFW‚†76WB“°¢6öç7BFWF–Å†÷FòÒFWF–Å†÷F÷5¶FWF–Å†÷Fô–æFW…ÒÇÂ&Wf–Wu†÷Fó°¢6öç7B†4×VÇF—ÆU†÷F÷2ÒFWF–Å†÷F÷2æÆVæwF‚â°¢6öç7B†5&VÅ†÷F÷2ÒFWF–Å†÷F÷2æÆVæwF‚â°¢6öç7B—4FWF–Å†÷FõWÆöF–ærÒFWF–ÄÖVF–WÆöCòæ76WD–BÓÓÒ76WBæ–BbbFWF–ÄÖVF–WÆöBçG—RÓÓÒw†÷Fòs°¢6öç7B6ä÷Vå†÷Fõf–WvW"Ò†5&VÅ†÷F÷2bb&ööÆVâ†FWF–Å†÷Fò“°¢6öç7B6ä–çFW&7Ev—F…†÷Fõ7FvRÒ6ä÷Vå†÷Fõf–WvW"ÇÂ6åW6T÷væW$öæÇ”76WD7F–öç3°¢6öç7BÖçVÄ76WDæ÷FRÒvWDÖçVÄ76WDæ÷FR†76WBææ÷FR“°¢6öç7BÆ–6Vç6U7FGW2Ò&VDÆ–6Vç6U7FGW46†ö–6R†76WB“°¢6öç7B&Vv—7G&F–öäçVÖ&W"Ò76WBæ¶–æBÓÒw&÷W'G’rbbÆ–6Vç6U7FGW2ÓÓÒw–W2rò&VDÆ–6Vç6U&Vv—7G&F–öäçVÖ&W"†76WB’¢rs°¢6öç7BÖVE7FGW3¢76WE7FGW46†ö–6RÒ†476WDÖ6ö÷&F–æFW2†76WB’òw–W2r¢væòs°¢6öç7B&VæFW$76WDFWF–Å&÷rÒ€¢F&vWC¢76WDFWF–ÄVF—EF&vWBÀ¢Æ&VÃ¢7G&–ærÀ¢fÇVS¢7G&–ærÀ¢F—FÆRÒfÇVRÇÂtæ÷B&÷f–FVBrÀ¢’Óâ°¢6öç7BF—7Æ–VEfÇVRÒfÇVRÇÂ~(	Bs° ¢–b†6åW6T÷væW$öæÇ”76WD7F–öç2bb6åV–6´VF—D76WDFWF–Â†76WBÂF&vWB’’°¢&WGW&â€¢Æ'WGFöà¢G—SÒ&'WGFöâ ¢6Æ74æÖS×¶G·7G–ÆW2æ76WDFWF–Å&÷wÒG·7G–ÆW2æ76WDFWF–Å&÷t'WGFöçÖÐ¢öä6Æ–6³×²†WfVçB’Óâ÷VåV–6´76WDFWF–ÄVF—F÷"†76WBÂF&vWBÂWfVçBæ7W'&VçEF&vWB—Ð¢FFÖ76WB×&WGW&âÖ7F–öã×¶FWF–ÂÒG·F&vWGÖÐ¢&–ÖÆ&VÃ×¶VF—BG¶Æ&VÂçFôÆ÷vW$66R‚—Òf÷"G¶76WBçF—FÆWÒâ7W'&VçBfÇVS¢G¶F—7Æ–VEfÇVWÖÐ¢à¢Ç7ãç¶Æ&VÇÓÂ÷7ãà¢Ç7G&öærF—FÆS×·F—FÆWÓç¶F—7Æ–VEfÇVWÓÂ÷7G&öæsà¢Âö'WGFöãà¢“°¢Ð ¢&WGW&â€¢ÆF—b6Æ74æÖS×·7G–ÆW2æ76WDFWF–Å&÷wÓà¢Ç7ãç¶Æ&VÇÓÂ÷7ãà¢Ç7G&öærF—FÆS×·F—FÆWÓç¶F—7Æ–VEfÇVWÓÂ÷7G&öæsà¢ÂöF—cà¢“°¢Ó° ¢&WGW&â€¢Ãà¢ÆF—b6Æ74æÖS×·7G–ÆW2ç&Wf–Wuw&Óà¢Æ–çW@¢–C×¶ÖVF––çWD–B†76WBæ–BÂw†÷Fòr—Ð¢G—SÒ&f–ÆR ¢66WCÒ&–ÖvRö§VrÆ–ÖvR÷ærÆ–ÖvR÷vV' ¢×VÇF—ÆP¢6Æ74æÖS×·7G–ÆW2æf–ÆT–çWGÐ¢öä6†ævS×²†WfVçB’Óâ²fö–B†æFÆTFWF–Å†÷Fôf–ÆW56VÆV7FVB†76WBÂWfVçB“²×Ð¢F—6&ÆVC×¶—4FWF–Å†÷FõWÆöF–æwÐ¢óà ¢ÆF—`¢6Æ74æÖS×¶G·7G–ÆW2ç&Wf–Wu7FvWÒG¶6ä–çFW&7Ev—F…†÷Fõ7FvRò7G–ÆW2ç&Wf–Wu7FvT6Æ–6¶&ÆR¢rwÒG¶—4FWF–Å†÷FõWÆöF–ærò7G–ÆW2æ76WDÖVF–'W7’¢rwÖÐ¢&öÆS×¶6ä–çFW&7Ev—F…†÷Fõ7FvRòv'WGFöâr¢VæFVf–æVGÐ¢F$–æFWƒ×¶6ä–çFW&7Ev—F…†÷Fõ7FvRò¢VæFVf–æVGÐ¢öä6Æ–6³×²‚’Óâ°¢–b†—4FWF–Å†÷FõWÆöF–ærÇÂFWF–ÅF÷V6„F–E7v—U&Vbæ7W'&VçB’°¢&WGW&ã°¢Ð ¢–b†6ä÷Vå†÷Fõf–WvW"’°¢÷Vå†÷Fõf–WvW"†76WBÂFWF–Å†÷Fô–æFW‚“°¢&WGW&ã°¢Ð ¢–b†6åW6T÷væW$öæÇ”76WD7F–öç2’°¢G&–vvW$FWF–ÄÖVF––çWB†76WBæ–BÂw†÷Fòr“°¢Ð¢×Ð¢öä¶W”F÷vã×²†WfVçB’Óâ°¢–b†WfVçBçF&vWBÓÒWfVçBæ7W'&VçEF&vWBÇÂ—4FWF–Å†÷FõWÆöF–ær’°¢&WGW&ã°¢Ð ¢–b†6ä÷Vå†÷Fõf–WvW"’°¢–b†WfVçBæ¶W’ÓÓÒtVçFW"rÇÂWfVçBæ¶W’ÓÓÒrr’°¢WfVçBç&WfVçDFVfVÇB‚“°¢÷Vå†÷Fõf–WvW"†76WBÂFWF–Å†÷Fô–æFW‚“°¢Ð ¢&WGW&ã°¢Ð ¢–b†6åW6T÷væW$öæÇ”76WD7F–öç2’°¢†æFÆTFWF–ÄÖVF–¶W”F÷vâ†WfVçBÂ76WBæ–BÂw†÷Fòr“°¢Ð¢×Ð¢öåF÷V6…7F'C×²†WfVçB’Óâ†æFÆTFWF–Å†÷FõF÷V6…7F'B†WfVçBæ6†ævVEF÷V6†W5³Óòæ6Æ–VçE‚óò—Ð¢öåF÷V6„VæC×²†WfVçB’Óâ†æFÆTFWF–Å†÷FõF÷V6„VæB†76WBÂWfVçBæ6†ævVEF÷V6†W5³Óòæ6Æ–VçE‚óò—Ð¢&–ÖÆ&VÃ×¶6ä÷Vå†÷Fõf–WvW"òt÷Vâ†÷Fòf–WvW"r¢6åW6T÷væW$öæÇ”76WD7F–öç2òuWÆöB76WB†÷F÷2r¢VæFVf–æVGÐ¢à¢¶†5&VÅ†÷F÷2bbFWF–Å†÷Fòò€¢Ãà¢Æ–Ör7&3×¶FWF–Å†÷F÷ÒÇC×¶G¶76WBçF—FÆWÒ†÷FòG¶FWF–Å†÷Fô–æFW‚²ÖÒ6Æ74æÖS×·7G–ÆW2ç&Wf–Wt–ÖvWÒóà ¢¶†4×VÇF—ÆU†÷F÷2ò€¢Ãà¢Æ'WGFöà¢G—SÒ&'WGFöâ ¢6Æ74æÖS×¶G·7G–ÆW2ç&Wf–Wtæd'WGFöçÒG·7G–ÆW2ç&Wf–Wtæe&WgÖÐ¢öä6Æ–6³×²†WfVçB’Óâ°¢WfVçBç7F÷&÷vF–öâ‚“°¢7–6ÆTFWF–Å†÷Fò†76WBÂÓ“°¢×Ð¢&–ÖÆ&VÃÒ%6†÷r&Wf–÷W2†÷Fò ¢à¢Ä6†Wg&öäÆVgD–6öâ6Æ74æÖS×·7G–ÆW2æ'WGFöä–6öçÒóà¢Âö'WGFöãà ¢Æ'WGFöà¢G—SÒ&'WGFöâ ¢6Æ74æÖS×¶G·7G–ÆW2ç&Wf–Wtæd'WGFöçÒG·7G–ÆW2ç&Wf–WtædæW‡GÖÐ¢öä6Æ–6³×²†WfVçB’Óâ°¢WfVçBç7F÷&÷vF–öâ‚“°¢7–6ÆTFWF–Å†÷Fò†76WBÂ“°¢×Ð¢&–ÖÆ&VÃÒ%6†÷ræW‡B†÷Fò ¢à¢Ä6†Wg&öå&–v‡D–6öâ6Æ74æÖS×·7G–ÆW2æ'WGFöä–6öçÒóà¢Âö'WGFöãà ¢ÆF—b6Æ74æÖS×·7G–ÆW2ç&Wf–Wt6÷VçFW'Óà¢¶FWF–Å†÷Fô–æFW‚²Òò¶FWF–Å†÷F÷2æÆVæwF‡Ð¢ÂöF—cà¢Âóà¢’¢çVÆÇÐ¢Âóà¢’¢€¢ÆF—b6Æ74æÖS×·7G–ÆW2ç&Wf–WuÆ6V†öÆFW'Óà¢ÆF—b6Æ74æÖS×·7G–ÆW2ç&Wf–WuÆ6V†öÆFW$&FvW7Óà¢Ç7â6Æ74æÖS×¶G·7G–ÆW2æ&FvWÒG·7G–ÆW2æ&FvTæWWG&ÇÒG·7G–ÆW2ç&Wf–WuÆ6V†öÆFW$&FvWÖÓà¢¶76WDfÖ–Ç”Æ&VÂ†76WB—Ð¢Â÷7ãà¢ÂöF—cà¢ÂöF—cà¢—Ð ¢¶6åW6T÷væW$öæÇ”76WD7F–öç2ò€¢Æ'WGFöà¢G—SÒ&'WGFöâ ¢6Æ74æÖS×·7G–ÆW2ç&Wf–WuWÆöE–ÆÇÐ¢F—6&ÆVC×¶—4FWF–Å†÷FõWÆöF–æwÐ¢öä6Æ–6³×²†WfVçB’Óâ°¢WfVçBç7F÷&÷vF–öâ‚“°¢G&–vvW$FWF–ÄÖVF––çWB†76WBæ–BÂw†÷Fòr“°¢×Ð¢à¢ÅÇW4–6öâ6Æ74æÖS×·7G–ÆW2æ'WGFöä–6öçÒóà¢Ç7ãç¶—4FWF–Å†÷FõWÆöF–æròuWÆöF–ærâââr¢†5&VÅ†÷F÷2òtFB†÷F÷2r¢uWÆöB†÷F÷2wÓÂ÷7ãà¢Âö'WGFöãà¢’¢çVÆÇÐ¢ÂöF—cà ¢¶†4×VÇF—ÆU†÷F÷2ò€¢ÆF—b6Æ74æÖS×·7G–ÆW2ç&Wf–WuF‡VÖ%&÷wÓà¢¶FWF–Å†÷F÷2æÖ‚‡†÷FòÂ–æFW‚’Óâ°¢6öç7B—47F—fU†÷FòÒ–æFW‚ÓÓÒFWF–Å†÷Fô–æFWƒ°¢&WGW&â€¢Æ'WGFöà¢G—SÒ&'WGFöâ ¢¶W“×¶G¶76WBæ–GÒÖFWF–Â×†÷FòÒG¶–æFW‡ÖÐ¢6Æ74æÖS×¶G·7G–ÆW2ç&Wf–WuF‡VÖ$'WGFöçÒG¶—47F—fU†÷Fòò7G–ÆW2ç&Wf–WuF‡VÖ$'WGFöä7F—fR¢rwÖÐ¢öä6Æ–6³×²‚’Óâ6WDFWF–Å†÷Fô–æFW‚†76WBæ–BÂ–æFW‚—Ð¢&–ÖÆ&VÃ×¶f–Wr†÷FòG¶–æFW‚²ÖÐ¢à¢Æ–Ör7&3×·†÷F÷ÒÇC×¶G¶76WBçF—FÆWÒF‡VÖ&æ–ÂG¶–æFW‚²ÖÒ6Æ74æÖS×·7G–ÆW2ç&Wf–WuF‡VÖ$–ÖvWÒóà¢Âö'WGFöãà¢“°¢Ò—Ð¢ÂöF—cà¢’¢çVÆÇÐ¢ÂöF—cà ¢ÆF—b6Æ74æÖS×·7G–ÆW2æ76WDFö7VÖVçG5æVÇÓà¢ÆF—b6Æ74æÖS×·7G–ÆW2æ76WDFö7VÖVçG46&E6†VÆÇÓà¢¶6åW6T÷væW$öæÇ”76WD7F–öç2ÇÂ6åW6T66÷VçFçDFö7VÖVçD7F–öç2ò€¢Æ'WGFöà¢G—SÒ&'WGFöâ ¢6Æ74æÖS×¶G·7G–ÆW2ç&Wf–WuWÆöE–ÆÇÒG·7G–ÆW2æ76WDFö7VÖVçG5WÆöE–ÆÇÖÐ¢öä6Æ–6³×²†WfVçB’Óâ°¢WfVçBç7F÷&÷vF–öâ‚“°¢÷Vä76WDFö7VÖVçEWÆöB†76WB“°¢×Ð¢FFÖ76WB×&WGW&âÖ7F–öãÒ&FBÖFö7VÖVçB ¢à¢ÅÇW4–6öâ6Æ74æÖS×·7G–ÆW2æ'WGFöä–6öçÒóà¢Ç7ãäFBFö7VÖVçCÂ÷7ãà¢Âö'WGFöãà¢’¢çVÆÇÐ ¢ÆF—b6Æ74æÖS×¶G·7G–ÆW2æ76WDFö7VÖVçG46&GÒG·7G–ÆW2æ76WDFö7VÖVçG5fVÇD6&GÖÓà¢Ç7G&öær6Æ74æÖS×·7G–ÆW2æ76WDFö7VÖVçG56fVD6÷VçGÓà¢¶—5fVÇDFö7VÖVçG4ÆöF–æp¢òtÆöF–ærFö7VÖVçG>(
bp¢¢G·fVÇDFö7VÖVçG2æÆVæwF‡ÒFö7VÖVçG6Ð¢Â÷7G&öæsà¢¶FWF–ÄFö7VÖVçG2æÆVæwF‚ò€¢Ç6ÖÆÂ6Æ74æÖS×·7G–ÆW2æ76WDFö7VÖVçG4ÆVv7”6÷VçGÓà¢¶FWF–ÄFö7VÖVçG2æÆVæwF‡ÒV&Æ–W"6fVB76WB¶FWF–ÄFö7VÖVçG2æÆVæwF‚ÓÓÒòvf–ÆRr¢vf–ÆW2wÐ¢Â÷6ÖÆÃà¢’¢çVÆÇÐ¢¶6åW6T÷væW$öæÇ”76WD7F–öç2ò€¢ÄÆ–æ°¢‡&Vc×¶öFö7VÖVçG3ö76WD–CÒG¶Væ6öFUU$”6ö×öæVçB†76WBæ–B—ÖÐ¢6Æ74æÖS×·7G–ÆW2æ76WDFö7VÖVçG5f–WtÆÇÐ¢à¢f–WrFö7VÖVçG0¢ÂôÆ–æ³à¢’¢€¢Ç6ÖÆÂ6Æ74æÖS×·7G–ÆW2æ76WDFö7VÖVçG4÷væW$æ÷FWÓå6fVB–âF†R÷væW.(	—2Fö7VÖVçG2fVÇCÂ÷6ÖÆÃà¢—Ð¢ÂöF—cà¢ÂöF—cà ¢·fVÇDFö7VÖVçG4W'&÷"ò€¢ÆF—b6Æ74æÖS×·7G–ÆW2æ76WDFö7VÖVçG4ÆöDW'&÷'Ò&öÆSÒ'7FGW2#à¢Ç7ãç·fVÇDFö7VÖVçG4W'&÷'ÓÂ÷7ãà¢Æ'WGFöâG—SÒ&'WGFöâ"öä6Æ–6³×²‚’Óâ²fö–BÆöEfVÇDFö7VÖVçG2†76WBæ–B“²×Óå&WG'“Âö'WGFöãà¢ÂöF—cà¢’¢çVÆÇÐ ¢·fVÇDFö7VÖVçG2æÆVæwF‚ÇÂFWF–ÄFö7VÖVçG2æÆVæwF‚ò€¢ÆF—b6Æ74æÖS×·7G–ÆW2æ76WDFö7VÖVçDÆ—7GÓà¢·fVÇDFö7VÖVçG2ç6Æ–6RƒÂ2’æÖ‚†Fö7VÖVçB’Óâ€¢Æ¢6Æ74æÖS×·7G–ÆW2æ76WDFö7VÖVçDÆ–æ·Ð¢¶W“×¶fVÇBÒG¶Fö7VÖVçBæ–GÖÐ¢‡&Vc×¶76WEfVÇDFö7VÖVçDF÷væÆöEW&Â†76WBæ–BÂFö7VÖVçBæ–B—Ð¢F&vWCÒ%ö&Ææ² ¢&VÃÒ&æ÷&VfW'&W" ¢F—FÆS×¶÷VâG¶Fö7VÖVçBæf–ÆTæÖWÖÐ¢à¢ÄFö7VÖVçD–6öâ6Æ74æÖS×·7G–ÆW2æ'WGFöä–6öçÒóà¢Ç7ãç¶vWD66÷VçDFö7VÖVçEG—TÆ&VÂ†Fö7VÖVçBæFö7VÖVçEG—R’óò44õTåEôDô5TÔTåEô4DTtõ%•ôÄ$TÅ5¶Fö7VÖVçBæ6FVv÷'•×Ò+r¶Fö7VÖVçBçF—FÆWÓÂ÷7ãà¢Âöà¢’—Ð¢¶FWF–ÄFö7VÖVçG2ç6Æ–6RƒÂÖF‚æÖ‚ƒÂ2ÒfVÇDFö7VÖVçG2æÆVæwF‚’’æÖ‚†Fö7VÖVçBÂFö7VÖVçD–æFW‚’Óâ€¢Æ'WGFöà¢G—SÒ&'WGFöâ ¢6Æ74æÖS×·7G–ÆW2æ76WDFö7VÖVçDÆ–æ·Ð¢¶W“×¶ÆVv7’ÒG¶Fö7VÖVçBæ–GÖÐ¢öä6Æ–6³×²‚’Óâ²fö–B÷Vä76WDFö7VÖVçB†Fö7VÖVçB“²×Ð¢F—FÆS×¶÷VâG¶Fö7VÖVçBæf–ÆTæÖWÖÐ¢à¢ÄFö7VÖVçD–6öâ6Æ74æÖS×·7G–ÆW2æ'WGFöä–6öçÒóà¢Ç7ãå6fVB76WBf–ÆR+r¶F—7Æ”Fö7VÖVçDæÖR†Fö7VÖVçBæf–ÆTæÖRÂFö7VÖVçD–æFW‚—ÓÂ÷7ãà¢Âö'WGFöãà¢’—Ð¢·fVÇDFö7VÖVçG2æÆVæwF‚â2bb6åW6T÷væW$öæÇ”76WD7F–öç2ò€¢ÄÆ–æ°¢‡&Vc×¶öFö7VÖVçG3ö76WD–CÒG¶Væ6öFUU$”6ö×öæVçB†76WBæ–B—ÖÐ¢6Æ74æÖS×¶G·7G–ÆW2æ76WDFö7VÖVçDÆ–æ·ÒG·7G–ÆW2æ76WDFö7VÖVçDÖ÷&TÆ–æ·ÖÐ¢à¢ÄFö7VÖVçD–6öâ6Æ74æÖS×·7G–ÆW2æ'WGFöä–6öçÒóà¢Ç7ãåf–WrÆÂ·fVÇDFö7VÖVçG2æÆVæwF‡Òf–ÆW2–âFö7VÖVçG3Â÷7ãà¢ÂôÆ–æ³à¢’¢çVÆÇÐ¢ÂöF—cà¢’¢çVÆÇÐ¢ÂöF—cà ¢ÆF—b6Æ74æÖS×·7G–ÆW2æ76WDFWF–ÄF—f–FW'Ò&–Ö†–FFVãÒ'G'VR"óà ¢ÆF—b6Æ74æÖS×·7G–ÆW2æ76WDFWF–Ç5æVÇÓà¢ÆF—b6Æ74æÖS×·7G–ÆW2æ76WDFWF–Ç4w&–GÓà¢ÆF—b6Æ74æÖS×·7G–ÆW2æ76WE&–Ö'”FWF–Ç7Óà¢¶76WBæ¶–æBÓÒw&÷W'G’rò€¢&VæFW$76WDFWF–Å&÷r‚w6W&–ÂrÂu6W&–ÂrÂ76WBç6W&–ÄçVÖ&W"Â76WBç6W&–ÄçVÖ&W"ÇÂtæ÷B&÷f–FVBr¢’¢çVÆÇÐ¢·&VæFW$76WDFWF–Å&÷r€¢w–V"rÀ¢76WBæ¶–æBÓÓÒw&÷W'G’rò$õU%E•õ”T%ôÄ$TÂ¢u–V"rÀ¢76WBç–V$ÖöFVÂò7G&–ær†76WBç–V$ÖöFVÂ’¢rrÀ¢76WBç–V$ÖöFVÂò7G&–ær†76WBç–V$ÖöFVÂ’¢tæ÷B&÷f–FVBrÀ¢—Ð¢¶76WBæ¶–æBÓÓÒw&÷W'G’rò€¢ÆF—b6Æ74æÖS×·7G–ÆW2æ76WDFWF–Å&÷wÓà¢Ç7ãå6—¦SÂ÷7ãà¢Ç7G&öærF—FÆS×·&÷W'G•6—¦TF—7Æ’†76WB—Óç·&÷W'G•6—¦TF—7Æ’†76WB—ÓÂ÷7G&öæsà¢ÂöF—cà¢’¢€¢&VæFW$76WDFWF–Å&÷r‚wW6vRrÂuW6vRrÂ'V–ÆD76WEW6vUfÇVR†76WB’¢—Ð¢·&VæFW$76WDFWF–Å&÷r€¢v6öæF—F–öârÀ¢t6öæF—F–öârÀ¢6öæF—F–öäÆ&VÂ†76WBæ6öæF—F–öâ’À¢6öæF—F–öäÆ&VÂ†76WBæ6öæF—F–öâ’ÇÂtæ÷B&÷f–FVBrÀ¢—Ð¢ÂöF—cà ¢ÆF—b6Æ74æÖS×·7G–ÆW2æ76WE7FGW4FWF–Ç7Óà¢¶6åW6T÷væW$öæÇ”76WD7F–öç2ò€¢Æ'WGFöà¢G—SÒ&'WGFöâ ¢6Æ74æÖS×¶G·7G–ÆW2æ76WE7FGW5&÷wÒG·7G–ÆW2æ76WE7FGW5&÷t'WGFöçÖÐ¢öä6Æ–6³×²†WfVçB’Óâ÷VåV–6´76WE7FGW4VF—F÷"†76WBÂvf–ææ6RrÂWfVçBæ7W'&VçEF&vWB—Ð¢FFÖ76WB×&WGW&âÖ7F–öãÒ'7FGW2Öf–ææ6R ¢&–ÖÆ&VÃ×¶WFFRf–ææ6R7FGW2f÷"G¶76WBçF—FÆWÖÐ¢à¢Ç7ãäf–ææ6VCÂ÷7ãà¢·&VæFW$76WE7FGW4Ö&²‡&VDf–ææ6U7FGW46†ö–6R†76WB’—Ð¢Âö'WGFöãà¢’¢€¢ÆF—b6Æ74æÖS×·7G–ÆW2æ76WE7FGW5&÷wÓà¢Ç7ãäf–ææ6VCÂ÷7ãà¢·&VæFW$76WE7FGW4Ö&²‡&VDf–ææ6U7FGW46†ö–6R†76WB’—Ð¢ÂöF—cà¢—Ð ¢¶6åW6T÷væW$öæÇ”76WD7F–öç2ò€¢Æ'WGFöà¢G—SÒ&'WGFöâ ¢6Æ74æÖS×¶G·7G–ÆW2æ76WE7FGW5&÷wÒG·7G–ÆW2æ76WE7FGW5&÷t'WGFöçÖÐ¢öä6Æ–6³×²†WfVçB’Óâ÷VåV–6´76WE7FGW4VF—F÷"†76WBÂv–ç7W&æ6RrÂWfVçBæ7W'&VçEF&vWB—Ð¢FFÖ76WB×&WGW&âÖ7F–öãÒ'7FGW2Ö–ç7W&æ6R ¢&–ÖÆ&VÃ×¶WFFR–ç7W&æ6R7FGW2f÷"G¶76WBçF—FÆWÖÐ¢à¢Ç7ãä–ç7W&VCÂ÷7ãà¢·&VæFW$76WE7FGW4Ö&²‡&VD–ç7W&æ6U7FGW46†ö–6R†76WB’—Ð¢Âö'WGFöãà¢’¢€¢ÆF—b6Æ74æÖS×·7G–ÆW2æ76WE7FGW5&÷wÓà¢Ç7ãä–ç7W&VCÂ÷7ãà¢·&VæFW$76WE7FGW4Ö&²‡&VD–ç7W&æ6U7FGW46†ö–6R†76WB’—Ð¢ÂöF—cà¢—Ð ¢¶76WBæ¶–æBÓÒw&÷W'G’rò€¢6åW6T÷væW$öæÇ”76WD7F–öç2ò€¢Æ'WGFöà¢G—SÒ&'WGFöâ ¢6Æ74æÖS×¶G·7G–ÆW2æ76WE7FGW5&÷wÒG·7G–ÆW2æ76WE7FGW5&÷t'WGFöçÖÐ¢öä6Æ–6³×²†WfVçB’Óâ÷VåV–6´76WE7FGW4VF—F÷"†76WBÂvÆ–6Vç6RrÂWfVçBæ7W'&VçEF&vWB—Ð¢FFÖ76WB×&WGW&âÖ7F–öãÒ'7FGW2ÖÆ–6Vç6R ¢&–ÖÆ&VÃ×¶WFFRÆ–6Vç6R7FGW2f÷"G¶76WBçF—FÆWÖÐ¢à¢Ç7ãäÆ–6Vç6VCÂ÷7ãà¢·&VæFW$76WE7FGW4Ö&²†Æ–6Vç6U7FGW2—Ð¢Âö'WGFöãà¢’¢€¢ÆF—b6Æ74æÖS×·7G–ÆW2æ76WE7FGW5&÷wÓà¢Ç7ãäÆ–6Vç6VCÂ÷7ãà¢·&VæFW$76WE7FGW4Ö&²†Æ–6Vç6U7FGW2—Ð¢ÂöF—cà¢¢’¢çVÆÇÐ ¢¶6åW6T÷væW$öæÇ”76WD7F–öç2ò€¢Æ'WGFöà¢G—SÒ&'WGFöâ ¢6Æ74æÖS×¶G·7G–ÆW2æ76WE7FGW5&÷wÒG·7G–ÆW2æ76WE7FGW5&÷t'WGFöçÖÐ¢öä6Æ–6³×²†WfVçB’Óâ÷VäÖVE7FGW4VF—F÷"†76WBÂWfVçBæ7W'&VçEF&vWB—Ð¢FFÖ76WB×&WGW&âÖ7F–öãÒ'7FGW2ÖÖVB ¢&–ÖÆ&VÃ×¶WFFRÖVBÆö6F–öâ7FGW2f÷"G¶76WBçF—FÆWÖÐ¢à¢Ç7ãäÖVCÂ÷7ãà¢·&VæFW$76WE7FGW4Ö&²†ÖVE7FGW2—Ð¢Âö'WGFöãà¢’¢€¢ÆF—b6Æ74æÖS×·7G–ÆW2æ76WE7FGW5&÷wÓà¢Ç7ãäÖVCÂ÷7ãà¢·&VæFW$76WE7FGW4Ö&²†ÖVE7FGW2—Ð¢ÂöF—cà¢—Ð¢ÂöF—cà¢ÂöF—cà ¢ÆF—b6Æ74æÖS×·7G–ÆW2æ76WEfÇVT'V&&ÆU7F6·Óà¢ÆF—b6Æ74æÖS×·7G–ÆW2æ76WE&WÆ6VÖVçE&–6T'V&&ÆWÓà¢Ç7ãå&WÆ6VÖVçB&–6SÂ÷7ãà¢Ç7G&öæsç·&VD76WE&WÆ6VÖVçE&–6TW…fB†76WB’òÖöæW’‡&VD76WE&WÆ6VÖVçE&–6TW…fB†76WB’óò’¢tæ÷B6WBwÓÂ÷7G&öæsà¢Ç6ÖÆÃäW†6ÂâdCÂ÷6ÖÆÃà¢ÂöF—cà ¢¶–ç7W&VEfÇVTW…fBÓÒçVÆÂò€¢ÆF—b6Æ74æÖS×·7G–ÆW2æ76WD–ç7W&VEfÇVT'V&&ÆWÓà¢Ç7ãä–ç7W&VBf÷#Â÷7ãà¢Ç7G&öæsç¶ÖöæW’†–ç7W&VEfÇVTW…fB—ÓÂ÷7G&öæsà¢Ç6ÖÆÃäW†6ÂâdCÂ÷6ÖÆÃà¢ÂöF—cà¢’¢çVÆÇÐ ¢·&Vv—7G&F–öäçVÖ&W"ò€¢ÆF—b6Æ74æÖS×·7G–ÆW2æ76WE&Vv—7G&F–öäçVÖ&W$'V&&ÆWÓà¢Ç7ãå&Vv—7G&F–öâæóÂ÷7ãà¢Ç7G&öæsç·&Vv—7G&F–öäçVÖ&W'ÓÂ÷7G&öæsà¢ÂöF—cà¢’¢çVÆÇÐ¢ÂöF—cà¢ÂöF—cà ¢¶ÖçVÄ76WDæ÷FRò€¢ÆF—b6Æ74æÖS×¶G·7G–ÆW2ææ÷FU7F6·ÒG·7G–ÆW2æ76WDÖçVÄæ÷FUæVÇÖÓà¢Ç6Æ74æÖS×·7G–ÆW2ææ÷FWÓç¶ÖçVÄ76WDæ÷FWÓÂ÷à¢ÂöF—cà¢’¢çVÆÇÐ¢Âóà¢“°¢Ò’‚—Ð¢ÂöF—cà¢’¢çVÆÇÐ¢Âö'F–6ÆSà¢ÂöF—cà¢“°¢Ò—Ð¢ÂöF—cà ¢¶f–ÇFW&VD76WG2æÆVæwF‚âò€¢ÆF—b6Æ74æÖS×·7G–ÆW2çv–æF–öä&'Óà¢ÆF—b6Æ74æÖS×·7G–ÆW2çv–æF–öä–æf÷Óà¢ÆF—b6Æ74æÖS×·7G–ÆW2çv–æF–öäÖWFÓà¢vR·6fT7W'&VçEvWÒöb·vT6÷VçGÐ¢ÂöF—cà ¢ÆF—b6Æ74æÖS×·7G–ÆW2çvU6—¦T6öçG&öÇ7Ò&–ÖÆ&VÃÒ%7FæFÆöæR76WG2W"vR#à¢Ç7ãç¶†4w&÷WVEv–æF–öäVçG&–W2òu6†÷r7FæFÆöæRr¢u6†÷rwÓÂ÷7ãà¢ÆF—b6Æ74æÖS×·7G–ÆW2çvU6—¦T'WGFöäw&÷WÓà¢µtUõ4•¤UôõD”ôå2æÖ‚†÷F–öâ’Óâ€¢Æ'WGFöà¢G—SÒ&'WGFöâ ¢¶W“×¶÷F–öçÐ¢6Æ74æÖS×¶G·7G–ÆW2çv–æF–öä'WGFöçÒG·7G–ÆW2çvU6—¦T'WGFöçÒG·vU6—¦RÓÓÒ÷F–öâò7G–ÆW2çvU6—¦T'WGFöä7F—fR¢rwÖÐ¢öä6Æ–6³×²‚’Óâ†æFÆUvU6—¦T6†ævR†÷F–öâ—Ð¢&–×&W76VC×·vU6—¦RÓÓÒ÷F–öçÐ¢à¢¶÷F–öçÐ¢Âö'WGFöãà¢’—Ð¢Æ'WGFöà¢G—SÒ&'WGFöâ ¢6Æ74æÖS×¶G·7G–ÆW2çv–æF–öä'WGFöçÒG·7G–ÆW2çvU6—¦T'WGFöçÒG·vU6—¦RÓÓÒvÆÂrò7G–ÆW2çvU6—¦T'WGFöä7F—fR¢rwÖÐ¢öä6Æ–6³×²‚’Óâ†æFÆUvU6—¦T6†ævR‚vÆÂr—Ð¢&–×&W76VC×·vU6—¦RÓÓÒvÆÂwÐ¢à¢ÆÀ¢Âö'WGFöãà¢ÂöF—cà¢ÂöF—cà¢ÂöF—cà ¢·vT6÷VçBâò€¢ÆF—b6Æ74æÖS×·7G–ÆW2çv–æF–öä7F–öç7Óà¢Æ'WGFöà¢G—SÒ&'WGFöâ ¢6Æ74æÖS×·7G–ÆW2çv–æF–öä'WGFöçÐ¢öä6Æ–6³×²‚’Óâ6WD7W'&VçEvR‚†7W'&VçB’ÓâÖF‚æÖ‚ƒÂ7W'&VçBÒ’—Ð¢F—6&ÆVC×·6fT7W'&VçEvRÓÓÒÐ¢à¢Ä6†Wg&öäÆVgD–6öâ6Æ74æÖS×·7G–ÆW2æ'WGFöä–6öçÒóà¢Ç7ãå&Wf–÷W3Â÷7ãà¢Âö'WGFöãà ¢·v–æF–öä—FV×2æÖ‚†—FVÒÂ–æFW‚’Óà¢—FVÒÓÓÒvVÆÆ—6—2rò€¢Ç7â6Æ74æÖS×·7G–ÆW2çv–æF–öäVÆÆ—6—7Ò¶W“×¶VÆÆ—6—2ÒG¶–æFW‡ÖÓà¢(
`¢Â÷7ãà¢’¢€¢Æ'WGFöà¢G—SÒ&'WGFöâ ¢¶W“×¶—FV×Ð¢6Æ74æÖS×¶G·7G–ÆW2çv–æF–öä'WGFöçÒG¶—FVÒÓÓÒ6fT7W'&VçEvRò7G–ÆW2çv–æF–öä'WGFöä7F—fR¢rwÖÐ¢öä6Æ–6³×²‚’Óâ6WD7W'&VçEvR†—FVÒ—Ð¢à¢¶—FV×Ð¢Âö'WGFöãà¢’À¢—Ð ¢Æ'WGFöà¢G—SÒ&'WGFöâ ¢6Æ74æÖS×·7G–ÆW2çv–æF–öä'WGFöçÐ¢öä6Æ–6³×²‚’Óâ6WD7W'&VçEvR‚†7W'&VçB’ÓâÖF‚æÖ–â‡vT6÷VçBÂ7W'&VçB²’—Ð¢F—6&ÆVC×·6fT7W'&VçEvRÓÓÒvT6÷VçGÐ¢à¢Ç7ãäæW‡CÂ÷7ãà¢Ä6†Wg&öå&–v‡D–6öâ6Æ74æÖS×·7G–ÆW2æ'WGFöä–6öçÒóà¢Âö'WGFöãà¢ÂöF—cà¢’¢çVÆÇÐ¢ÂöF—cà¢’¢çVÆÇÐ¢Âóà¢’¢€¢ÆF—b6Æ74æÖS×·7G–ÆW2æV×G•7FFWÓà¢Æƒ3äæò76WG2ÖF6‚–÷W"6V&6‚÷"f–ÇFW#Âöƒ3à¢ÇåG'’'&öFW"FW&ÒÂ6†ö÷6Ræ÷F†W"f–ÇFW"Â÷"6ÆV"&÷F‚Fò6VRF†RgVÆÂ&Vv—7FW"v–âãÂ÷à¢ÆF—b6Æ74æÖS×·7G–ÆW2æV×G•7FFT7F–öç7Óà¢Æ'WGFöà¢G—SÒ&'WGFöâ ¢6Æ74æÖS×·7G–ÆW2ç6V6öæF'”'WGFöçÐ¢öä6Æ–6³×²‚’Óâ°¢6WE6V&6…FW&Ò‚rr“°¢6ÆV$76WDf–ÇFW"‚“°¢×Ð¢à¢6ÆV"6V&6‚æBf–ÇFW ¢Âö'WGFöãà¢ÂöF—cà¢ÂöF—cà¢¢’¢—4ÆöF–ærò€¢ÆF—b6Æ74æÖS×·7G–ÆW2æV×G•7FFWÓà¢Æƒ3äæò76WG26fVB–WCÂöƒ3à¢Çå'VâfÇVF–öâ÷"FBÖçVÂ76WBFò7F'B'V–ÆF–ær–÷W"&Vv—7FW"ãÂ÷à¢¶6äFD76WG5Fô7F—fU&Vv—7FW"ò€¢ÆF—b6Æ74æÖS×·7G–ÆW2æV×G•7FFT7F–öç7Óà¢¶—46öÖ&–æVE&Vv—7FW%f–Wrò€¢Æ'WGFöâG—SÒ&'WGFöâ"6Æ74æÖS×·7G–ÆW2ç6V6öæF'”'WGFöçÒöä6Æ–6³×¶÷VäFD76WD6†ö–6TÖöFÇÓà¢vòFòfÇVF–öà¢Âö'WGFöãà¢’¢€¢ÄÆ–æ²‡&Vc×¶FD76WEfÇVF–öä‡&VgÒ6Æ74æÖS×·7G–ÆW2ç6V6öæF'”'WGFöçÓà¢vòFòfÇVF–öà¢ÂôÆ–æ³à¢—Ð¢Æ'WGFöâG—SÒ&'WGFöâ"6Æ74æÖS×·7G–ÆW2ç&–Ö'”'WGFöçÒöä6Æ–6³×¶÷VäFD76WD6†ö–6TÖöFÇÓà¢ÅÇW4–6öâ6Æ74æÖS×·7G–ÆW2æ'WGFöä–6öçÒóà¢Ç7ãäFB76WCÂ÷7ãà¢Âö'WGFöãà¢ÂöF—cà¢’¢çVÆÇÐ¢ÂöF—cà¢’¢çVÆÇÐ¢Â÷6V7F–öãà¢Â÷6V7F–öãà ¢·†÷Fõf–WvW$76WBbb†÷Fõf–WvW%†÷Fòò€¢ÆF—b6Æ74æÖS×¶G·7G–ÆW2æÖöFÄ÷fW&Æ—ÒG·7G–ÆW2ç†÷Fõf–WvW$÷fW&Æ—ÖÓà¢ÆF—b6Æ74æÖS×·7G–ÆW2æÖöFÄ&6¶G&÷Òöä6Æ–6³×¶6Æ÷6U†÷Fõf–WvW'Òóà ¢ÆF—`¢6Æ74æÖS×·7G–ÆW2ç†÷Fõf–WvW$ÖöFÇÐ¢&öÆSÒ&F–Æör ¢&–ÖÖöFÃÒ'G'VR ¢&–ÖÆ&VÃ×¶G·†÷Fõf–WvW$76WBçF—FÆWÒ†÷Fòf–WvW&Ð¢öä6Æ–6³×²†WfVçB’ÓâWfVçBç7F÷&÷vF–öâ‚—Ð¢à¢Æ'WGFöà¢G—SÒ&'WGFöâ ¢6Æ74æÖS×·7G–ÆW2ç†÷Fõf–WvW$6Æ÷6T'WGFöçÐ¢öä6Æ–6³×¶6Æ÷6U†÷Fõf–WvW'Ð¢&–ÖÆ&VÃÒ$6Æ÷6R†÷Fòf–WvW" ¢à¢Ä6Æ÷6T–6öâ6Æ74æÖS×·7G–ÆW2æ'WGFöä–6öçÒóà¢Âö'WGFöãà ¢ÆF—b6Æ74æÖS×·7G–ÆW2ç†÷Fõf–WvW%7FvWÓà¢Æ–Öp¢7&3×·†÷Fõf–WvW%†÷F÷Ð¢ÇC×¶G·†÷Fõf–WvW$76WBçF—FÆWÒ†÷FòG·†÷Fõf–WvW$–æFW‚²ÖÐ¢6Æ74æÖS×·7G–ÆW2ç†÷Fõf–WvW$–ÖvWÐ¢óà ¢¶†4×VÇF—ÆU†÷Fõf–WvW%†÷F÷2ò€¢Ãà¢Æ'WGFöà¢G—SÒ&'WGFöâ ¢6Æ74æÖS×¶G·7G–ÆW2ç†÷Fõf–WvW$æd'WGFöçÒG·7G–ÆW2ç†÷Fõf–WvW$æe&WgÖÐ¢öä6Æ–6³×²‚’Óâ7–6ÆU†÷Fõf–WvW%†÷Fò‚Ó—Ð¢&–ÖÆ&VÃÒ%6†÷r&Wf–÷W2†÷Fò ¢à¢Ä6†Wg&öäÆVgD–6öâ6Æ74æÖS×·7G–ÆW2æ'WGFöä–6öçÒóà¢Âö'WGFöãà ¢Æ'WGFöà¢G—SÒ&'WGFöâ ¢6Æ74æÖS×¶G·7G–ÆW2ç†÷Fõf–WvW$æd'WGFöçÒG·7G–ÆW2ç†÷Fõf–WvW$ædæW‡GÖÐ¢öä6Æ–6³×²‚’Óâ7–6ÆU†÷Fõf–WvW%†÷Fòƒ—Ð¢&–ÖÆ&VÃÒ%6†÷ræW‡B†÷Fò ¢à¢Ä6†Wg&öå&–v‡D–6öâ6Æ74æÖS×·7G–ÆW2æ'WGFöä–6öçÒóà¢Âö'WGFöãà ¢ÆF—b6Æ74æÖS×·7G–ÆW2ç†÷Fõf–WvW$6÷VçFW'Óà¢·†÷Fõf–WvW$–æFW‚²Òò·†÷Fõf–WvW%†÷F÷2æÆVæwF‡Ð¢ÂöF—cà¢Âóà¢’¢çVÆÇÐ¢ÂöF—cà¢ÂöF—cà¢ÂöF—cà¢’¢çVÆÇÐ ¢¶—5&Vv—7FW%6†&TÖöFÄ÷Vâò€¢ÆF—b6Æ74æÖS×·7G–ÆW2æÖöFÄ÷fW&Æ—Óà¢ÆF—b6Æ74æÖS×·7G–ÆW2æÖöFÄ&6¶G&÷Òöä6Æ–6³×¶6Æ÷6U&Vv—7FW%6†&TÖöFÇÒóà ¢ÆF—`¢6Æ74æÖS×¶G·7G–ÆW2æ÷F–öç4ÖöFÇÒG·7G–ÆW2æ76WEV÷FTÖöFÇÒG·7G–ÆW2ç&Vv—7FW%6†&TÖöFÇÒG¶76WE6†&TFW7F–æF–öâÓÓÒv6†ö–6Rrò7G–ÆW2æ76WE6†&TFW7F–æF–öäÖöFÂ¢rwÒG¶76WE6†&TFW7F–æF–öâÓÓÒv–ç6–FRrò7G–ÆW2æ76WE6†&T–ç6–FTÖöFÂ¢rwÒG¶76WE6†&TFW7F–æF–öâÓÓÒv÷WG6–FRrò7G–ÆW2æW‡FW&æÄ76WE6†&TÖöFÂ¢rwÖÐ¢&öÆSÒ&F–Æör ¢&–ÖÖöFÃÒ'G'VR ¢&–Ö†–FFVã×¶W‡FW&æÅ6†&U&W÷'E66÷RÓÓÒw&Vv—7FW"rÇÂW‡FW&æÅ6†&U&W÷'E66÷RÓÓÒvw&÷WròG'VR¢VæFVf–æVGÐ¢&–ÖÆ&VÆÆVF'“Ò&76WB×&Vv—7FW"×6†&R×F—FÆR ¢à¢ÆF—b6Æ74æÖS×¶G·7G–ÆW2æÖöFÄ†VFW'ÒG·7G–ÆW2æ÷F–öç4ÖöFÄ†VFW'ÒG·7G–ÆW2æ76WEV÷FTÖöFÄ†VFW'ÒG·7G–ÆW2ç&Vv—7FW%6†&TÖöFÄ†VFW'ÖÓà¢ÆF—b6Æ74æÖS×·7G–ÆW2æÖöFÄ†VFW%FW‡GÓà¢Æƒ2–CÒ&76WB×&Vv—7FW"×6†&R×F—FÆR"F$–æFWƒ×²ÓÓç¶76WE6†&TFW7F–æF–öâÓÓÒv–ç6–FRp¢òu6†&R–ç6–FR–ÓG&–6Rp¢¢76WE6†&TFW7F–æF–öâÓÓÒv÷WG6–FRp¢òu6†&R÷WG6–FR–ÓG&–6Rp¢¢6†&RG¶7F—fU6†&TæÖWÖÓÂöƒ3à¢Çç¶76WE6†&TFW7F–æF–öâÓÓÒv6†ö–6Rp¢òt6†ö÷6Rv†W&RFò6†&Râ¶VW—B–ç6–FR–ÓG&–6R÷"6VæB&VG’×Fò×&VBÖW76vR÷WG6–FRâp¢¢76WE6†&TFW7F–æF–öâÓÓÒv÷WG6–FRp¢òu&Wf–WrF†RÖW76vRÂ6†ö÷6Rç’GF6†ÖVçG2ÂF†Vâ6VæB—Böæ6RF‡&÷Vv‚v†G4÷"VÖ–Ââp¢¢—476WDw&÷W6†&P¢ò6†&RF†—2VÖ'&VÆÆæB—G2G¶7F—fU6†&T76WG2æÆVæwF‡ÒÆ–æ¶VBG¶7F—fU6†&T76WG2æÆVæwF‚ÓÓÒòv76WBr¢v76WG2wÒâVç&VÆFVB76WG27F’&—fFRæ ¢¢t6†ö÷6Rv†òFò6†&Rv—F‚âV6‚'FæW"6VW2öæÇ’v†BF†W’æVVBâwÓÂ÷à¢ÂöF—cà ¢Æ'WGFöà¢G—SÒ&'WGFöâ ¢6Æ74æÖS×·7G–ÆW2æÖöFÄ6Æ÷6T'WGFöçÐ¢öä6Æ–6³×¶6Æ÷6U&Vv—7FW%6†&TÖöFÇÐ¢&–ÖÆ&VÃÒ$6Æ÷6R&Vv—7FW"6†&R÷F–öç2 ¢F—6&ÆVC×¶—4W‡÷'F–ærÇÂ—56VæF–æuV÷FTÆVGÐ¢à¢Ä6Æ÷6T–6öâ6Æ74æÖS×·7G–ÆW2æ'WGFöä–6öçÒóà¢Âö'WGFöãà¢ÂöF—cà ¢ÆF—b6Æ74æÖS×¶G·7G–ÆW2æÖöFÅ67&öÆÄ&öG—ÒG·7G–ÆW2æ÷F–öç567&öÆÄ&öG—ÒG·7G–ÆW2æ76WEV÷FU67&öÆÄ&öG—ÒG·7G–ÆW2ç&Vv—7FW%6†&TÖöFÄ&öG—ÖÓà¢¶76WE6†&TFW7F–æF–öâÓÓÒv6†ö–6Rrò€¢Ä76WE6†&TFW7F–æF–öå–6¶W ¢öä–ç6–FS×²‚’Óâ6WD76WE6†&TFW7F–æF–öâ‚v–ç6–FRr—Ð¢öä÷WG6–FS×²‚’Óâ6WD76WE6†&TFW7F–æF–öâ‚v÷WG6–FRr—Ð¢F—6&ÆVC×¶—4W‡÷'F–ærÇÂ—56VæF–æuV÷FTÆVGÐ¢óà¢’¢76WE6†&TFW7F–æF–öâÓÓÒv÷WG6–FRrò€¢Ä76WDW‡FW&æÅ6†&P¢6†&TæÖS×¶7F—fU6†&TæÖWÐ¢76WG3×¶7F—fTW‡FW&æÅ6†&T76WG7Ð¢&W÷'Df–ÆW3×¶W‡FW&æÅ6†&U&W÷'Df–ÆW7Ð¢öäFD–ÓG&–6U&W÷'C×¶÷Vå&Vv—7FW%6†&U&W÷'G7Ð¢öå&VÖ÷fT–ÓG&–6U&W÷'C×·&VÖ÷fTW‡FW&æÅ6†&U&W÷'GÐ¢óà¢’¢€¢ÆF—b6Æ74æÖS×·7G–ÆW2æ76WE6†&T–ç6–FTfÆ÷wÓà¢ÆF—b6Æ74æÖS×·7G–ÆW2æ÷F–öç46öçFVçGÓà¢ÆF—b6Æ74æÖS×¶G·7G–ÆW2æ÷F–öç4w&–GÒG·7G–ÆW2æ76WD÷F–öç4w&–GÒG·7G–ÆW2æ76WEV÷FT6†ö–6Tw&–GÒG·7G–ÆW2ç&Vv—7FW%6†&T÷F–öäw&–GÖÓà¢Æ'WGFöà¢G—SÒ&'WGFöâ ¢6Æ74æÖS×¶G·7G–ÆW2æ÷F–öä7F–öä'WGFöçÒG·7G–ÆW2æ76WEV÷FT6†ö–6T6&GÒG·7G–ÆW2ç&Vv—7FW%6†&T÷F–öä6&GÒG·V÷FUFöæT6Æ74f÷$ÆVEG—R‚vf–ææ6Rr—ÖÐ¢öä6Æ–6³×²‚’Óâ÷VägVÆÅ&Vv—7FW%V÷FU'FæW%–6¶W"‚vf–ææ6Rr—Ð¢F—6&ÆVC×¶—4W‡÷'F–æwÐ¢à¢Ç7â6Æ74æÖS×·7G–ÆW2æ76WEV÷FT6†ö–6T–6öåF–ÆWÓà¢·&VæFW%V÷FT÷F–öä–6öâ‚vf–ææ6RrÂ7G–ÆW2æ76WEV÷FT6†ö–6T–6öâ—Ð¢Â÷7ãà¢Ç7â6Æ74æÖS×·7G–ÆW2æ76WEV÷FT6†ö–6UFW‡GÓà¢Ç7G&öæsäf–ææ6Rf×²66÷VçF–æsÂ÷7G&öæsà¢Ç6ÖÆÃãÇ7ãå6†&Rv—F‚â66÷VçFçBÂf–ææ6–W"÷"&æ²ãÂ÷7ããÂ÷6ÖÆÃà¢Â÷7ãà¢Âö'WGFöãà ¢Æ'WGFöà¢G—SÒ&'WGFöâ ¢6Æ74æÖS×¶G·7G–ÆW2æ÷F–öä7F–öä'WGFöçÒG·7G–ÆW2æ76WEV÷FT6†ö–6T6&GÒG·7G–ÆW2ç&Vv—7FW%6†&T÷F–öä6&GÒG·V÷FUFöæT6Æ74f÷$ÆVEG—R‚v–ç7W&æ6Rr—ÖÐ¢öä6Æ–6³×²‚’Óâ÷VägVÆÅ&Vv—7FW%V÷FU'FæW%–6¶W"‚v–ç7W&æ6Rr—Ð¢F—6&ÆVC×¶—4W‡÷'F–æwÐ¢à¢Ç7â6Æ74æÖS×·7G–ÆW2æ76WEV÷FT6†ö–6T–6öåF–ÆWÓà¢·&VæFW%V÷FT÷F–öä–6öâ‚v–ç7W&æ6RrÂ7G–ÆW2æ76WEV÷FT6†ö–6T–6öâ—Ð¢Â÷7ãà¢Ç7â6Æ74æÖS×·7G–ÆW2æ76WEV÷FT6†ö–6UFW‡GÓà¢Ç7G&öæsä–ç7W&æ6SÂ÷7G&öæsà¢Ç6ÖÆÃãÇ7ãå6†&Rv—F‚â–ç7W&W"÷"'&ö¶W"ãÂ÷7ããÂ÷6ÖÆÃà¢Â÷7ãà¢Âö'WGFöãà ¢Æ'WGFöà¢G—SÒ&'WGFöâ ¢6Æ74æÖS×¶G·7G–ÆW2æ÷F–öä7F–öä'WGFöçÒG·7G–ÆW2æ76WEV÷FT6†ö–6T6&GÒG·7G–ÆW2ç&Vv—7FW%6†&T÷F–öä6&GÒG·V÷FUFöæT6Æ74f÷$ÆVEG—R‚w&WÆ6VÖVçE÷V÷FRr—ÖÐ¢öä6Æ–6³×²‚’Óâ÷VägVÆÅ&Vv—7FW%V÷FU'FæW%–6¶W"‚w&WÆ6VÖVçE÷V÷FRr—Ð¢F—6&ÆVC×¶—4W‡÷'F–æwÐ¢à¢Ç7â6Æ74æÖS×·7G–ÆW2æ76WEV÷FT6†ö–6T–6öåF–ÆWÓà¢·&VæFW%V÷FT÷F–öä–6öâ‚w&WÆ6VÖVçE÷V÷FRrÂ7G–ÆW2æ76WEV÷FT6†ö–6T–6öâ—Ð¢Â÷7ãà¢Ç7â6Æ74æÖS×·7G–ÆW2æ76WEV÷FT6†ö–6UFW‡GÓà¢Ç7G&öæsäFVÆW#Â÷7G&öæsà¢Ç6ÖÆÃãÇ7ãç¶—476WDw&÷W6†&Ròu6†&RWfW'’w&÷WVB76WBv—F‚FVÆW"âr¢t6†ö÷6R76WG2Fò6†&Rv—F‚FVÆW"âwÓÂ÷7ããÂ÷6ÖÆÃà¢Â÷7ãà¢Âö'WGFöãà ¢Æ'WGFöà¢G—SÒ&'WGFöâ ¢6Æ74æÖS×¶G·7G–ÆW2æ÷F–öä7F–öä'WGFöçÒG·7G–ÆW2æ76WEV÷FT6†ö–6T6&GÒG·7G–ÆW2ç&Vv—7FW%6†&T÷F–öä6&GÒG·V÷FUFöæT6Æ74f÷$ÆVEG—R‚vÆ–6Vç6U÷&VæWvÂr—ÖÐ¢öä6Æ–6³×²‚’Óâ÷VägVÆÅ&Vv—7FW%V÷FU'FæW%–6¶W"‚vÆ–6Vç6U÷&VæWvÂr—Ð¢F—6&ÆVC×¶—4W‡÷'F–æwÐ¢à¢Ç7â6Æ74æÖS×·7G–ÆW2æ76WEV÷FT6†ö–6T–6öåF–ÆWÓà¢·&VæFW%V÷FT÷F–öä–6öâ‚vÆ–6Vç6U÷&VæWvÂrÂ7G–ÆW2æ76WEV÷FT6†ö–6T–6öâ—Ð¢Â÷7ãà¢Ç7â6Æ74æÖS×·7G–ÆW2æ76WEV÷FT6†ö–6UFW‡GÓà¢Ç7G&öæsäÆ–6Væ6R&VæWvÃÂ÷7G&öæsà¢Ç6ÖÆÃãÇ7ãäöæÇ’76WG2v—F‚&VæWvÂFFR6â&R6†&VBãÂ÷7ããÂ÷6ÖÆÃà¢Â÷7ãà¢Âö'WGFöãà¢ÂöF—cà¢ÂöF—cà¢ÂöF—cà¢—Ð¢ÂöF—cà¢ÂöF—cà¢ÂöF—cà¢’¢çVÆÇÐ ¢¶—57VÖÖ'”ÖöFÄ÷Vâò€¢ÆF—b6Æ74æÖS×¶G·7G–ÆW2æÖöFÄ÷fW&Æ—ÒG·7G–ÆW2ç7VÖÖ'”ÖöFÄ÷fW&Æ—ÖÓà¢ÆF—b6Æ74æÖS×·7G–ÆW2æÖöFÄ&6¶G&÷Òöä6Æ–6³×¶6Æ÷6U7VÖÖ'”ÖöFÇÒóà ¢ÆF—b6Æ74æÖS×¶G·7G–ÆW2æÖöFÄ6&GÒG·7G–ÆW2ç7VÖÖ'”ÖöFÇÖÒ&öÆSÒ&F–Æör"&–ÖÖöFÃÒ'G'VR"&–ÖÆ&VÆÆVF'“Ò&76WB×&Vv—7FW"×7VÖÖ'’×F—FÆR#à¢ÆF—b6Æ74æÖS×¶G·7G–ÆW2æÖöFÄ†VFW'ÒG·7G–ÆW2ç7VÖÖ'”ÖöFÄ†VFW'ÖÓà¢ÆF—b6Æ74æÖS×·7G–ÆW2æÖöFÄ†VFW%FW‡GÓà¢Æƒ2–CÒ&76WB×&Vv—7FW"×7VÖÖ'’×F—FÆR#å&Vv—7FW"7VÖÖ'“Âöƒ3à¢ÂöF—cà ¢ÆF—b6Æ74æÖS×·7G–ÆW2ç7VÖÖ'”†VFW$7F–öç7Óà¢Æ'WGFöà¢G—SÒ&'WGFöâ ¢6Æ74æÖS×¶G·7G–ÆW2ç6V6öæF'”'WGFöçÒG·7G–ÆW2ç7VÖÖ'”F÷væÆöD'WGFöçÖÐ¢öä6Æ–6³×¶†æFÆTF÷væÆöE&Vv—7FW%7VÖÖ'—Ð¢F—6&ÆVC×¶—4ÆöF–ærÇÂ—4W‡÷'F–æwÐ¢à¢ÅFd–6öâ6Æ74æÖS×·7G–ÆW2æ'WGFöä–6öçÒóà¢Ç7ãäF÷væÆöBDcÂ÷7ãà¢Âö'WGFöãà ¢Æ'WGFöà¢G—SÒ&'WGFöâ ¢6Æ74æÖS×·7G–ÆW2æÖöFÄ6Æ÷6T'WGFöçÐ¢öä6Æ–6³×¶6Æ÷6U7VÖÖ'”ÖöFÇÐ¢&–ÖÆ&VÃÒ$6Æ÷6R&Vv—7FW"7VÖÖ'’ ¢à¢Ä6Æ÷6T–6öâ6Æ74æÖS×·7G–ÆW2æ'WGFöä–6öçÒóà¢Âö'WGFöãà¢ÂöF—cà¢ÂöF—cà ¢ÆF—b6Æ74æÖS×·7G–ÆW2ç7VÖÖ'”ÖöFÄ&öG—Óà¢·&Vv—7FW%7VÖÖ'•6V7F–öç2æÖ‚‡6V7F–öâ’Óâ€¢Ç6V7F–öâ¶W“×·6V7F–öâçF—FÆWÒ6Æ74æÖS×·7G–ÆW2ç7VÖÖ'•æVÇÒ&–ÖÆ&VÃ×·6V7F–öâçF—FÆWÓà¢ÆF—b6Æ74æÖS×·7G–ÆW2ç7VÖÖ'•6V7F–öä†VFW'Óà¢ÆF—cà¢Ç7ãç·6V7F–öâçF—FÆWÓÂ÷7ãà¢Çç·6V7F–öâæFW67&—F–öçÓÂ÷à¢ÂöF—cà¢ÂöF—cà ¢ÆF—b6Æ74æÖS×¶G·7G–ÆW2ç7VÖÖ'•6–×ÆUF&ÆWÒG·6V7F–öâæ†5fÇVT6öÇVÖâÓÓÒfÇ6Rò7G–ÆW2ç7VÖÖ'•6–×ÆUF&ÆT6÷VçDöæÇ’¢rwÖÓà¢ÆF—b6Æ74æÖS×·7G–ÆW2ç7VÖÖ'•6–×ÆUF&ÆT†VFW'Ò&–Ö†–FFVãÒ'G'VR#à¢Ç7ãäÖWG&–3Â÷7ãà¢Ç7ãä6÷VçCÂ÷7ãà¢·6V7F–öâæ†5fÇVT6öÇVÖâÓÓÒfÇ6RòçVÆÂ¢Ç7ãåfÇVRW†6ÂâdCÂ÷7ãçÐ¢·6V7F–öâæ†5fÇVT6öÇVÖâÓÓÒfÇ6RòçVÆÂ¢Ç7ãåfÇVR–æ6ÂâdCÂ÷7ãçÐ¢ÂöF—cà ¢ÆF—b6Æ74æÖS×·7G–ÆW2ç7VÖÖ'•6–×ÆUF&ÆU&÷w7Óà¢·6V7F–öâç&÷w2æÖ‚‡&÷r’Óâ€¢ÆF—b¶W“×·&÷ræÆ&VÇÒ6Æ74æÖS×·7G–ÆW2ç7VÖÖ'•6–×ÆUF&ÆU&÷wÓà¢Ç7ãç·&÷ræÆ&VÇÓÂ÷7ãà¢Ç7G&öæsç·&÷ræ6÷VçBóòrwÓÂ÷7G&öæsà¢·6V7F–öâæ†5fÇVT6öÇVÖâÓÓÒfÇ6RòçVÆÂ¢Ç6ÖÆÃç·&÷rçfÇVTW…fBóòrwÓÂ÷6ÖÆÃçÐ¢·6V7F–öâæ†5fÇVT6öÇVÖâÓÓÒfÇ6RòçVÆÂ¢Æ#ç·&÷rçfÇVT–æ6ÅfBóòrwÓÂö#çÐ¢ÂöF—cà¢’—Ð¢ÂöF—cà¢ÂöF—cà¢Â÷6V7F–öãà¢’—Ð¢ÂöF—cà¢ÂöF—cà¢ÂöF—cà¢’¢çVÆÇÐ ¢¶—4FD76WDFW7F–æF–öäÖöFÄ÷Vâò€¢ÆF—b6Æ74æÖS×·7G–ÆW2æÖöFÄ÷fW&Æ—Óà¢ÆF—b6Æ74æÖS×·7G–ÆW2æÖöFÄ&6¶G&÷Òöä6Æ–6³×¶6Æ÷6TFD76WDFW7F–æF–öäÖöFÇÒóà ¢ÆF—`¢6Æ74æÖS×¶G·7G–ÆW2æÖöFÄ6&GÒG·7G–ÆW2æFD76WDFW7F–æF–öäÖöFÇÖÐ¢&öÆSÒ&F–Æör ¢&–ÖÖöFÃÒ'G'VR ¢&–ÖÆ&VÆÆVF'“Ò&FBÖ76WBÖFW7F–æF–öâ×F—FÆR ¢à¢ÆF—b6Æ74æÖS×¶G·7G–ÆW2æÖöFÄ†VFW'ÒG·7G–ÆW2æFD76WDFW7F–æF–öä†VFW'ÖÓà¢ÆF—b6Æ74æÖS×·7G–ÆW2æÖöFÄ†VFW%FW‡GÓà¢Æƒ2–CÒ&FBÖ76WBÖFW7F–æF–öâ×F—FÆR#ä6†ö÷6Râ76WB&Vv—7FW#Âöƒ3à¢ÇåF†R6öÖ&–æVB&Vv—7FW"—2f–Wrâ6†ö÷6Rv†–6‚76WB&Vv—7FW"6†÷VÆB÷vâF†RæWr76WBãÂ÷à¢ÂöF—cà ¢Æ'WGFöà¢G—SÒ&'WGFöâ ¢6Æ74æÖS×·7G–ÆW2æÖöFÄ6Æ÷6T'WGFöçÐ¢öä6Æ–6³×¶6Æ÷6TFD76WDFW7F–æF–öäÖöFÇÐ¢&–ÖÆ&VÃÒ$6Æ÷6R76WB&Vv—7FW"6VÆV7F–öâ ¢à¢Ä6Æ÷6T–6öâ6Æ74æÖS×·7G–ÆW2æ'WGFöä–6öçÒóà¢Âö'WGFöãà¢ÂöF—cà ¢ÆF—b6Æ74æÖS×·7G–ÆW2æFD76WDFW7F–æF–öä&öG—Óà¢ÄÖöFÅ6VÆV7CÇ7G&–æsà¢Æ&VÃÒ$76WB&Vv—7FW" ¢fÇVS×¶FD76WEF&vWE&Vv—7FW$–GÐ¢÷F–öç3×¶FD76WE&Vv—7FW$÷F–öç7Ð¢öä6†ævS×²‡fÇVR’Óâ°¢6WDFD76WEF&vWE&Vv—7FW$–B‡fÇVR“°¢6WDæ÷F–6R†çVÆÂ“°¢×Ð¢Æ6V†öÆFW#Ò$6†ö÷6RF†R÷væ–ær76WB&Vv—7FW" ¢6Æ74æÖS×·7G–ÆW2æFD76WDFW7F–æF–öäf–VÆGÐ¢WFôfö7W0¢W6U÷'FÀ¢óà¢ÂöF—cà ¢ÆF—b6Æ74æÖS×·7G–ÆW2æFD76WDFW7F–æF–öäfö÷FW'Óà¢Æ'WGFöâG—SÒ&'WGFöâ"6Æ74æÖS×·7G–ÆW2ç6V6öæF'”'WGFöçÒöä6Æ–6³×¶6Æ÷6TFD76WDFW7F–æF–öäÖöFÇÓä6æ6VÃÂö'WGFöãà¢Æ'WGFöâG—SÒ&'WGFöâ"6Æ74æÖS×·7G–ÆW2ç&–Ö'”'WGFöçÒöä6Æ–6³×¶6öçF–çVTFD76WDf÷%&Vv—7FW'ÒF—6&ÆVC×²FD76WEF&vWE&Vv—7FW$–GÓà¢Ç7ãä6öçF–çVSÂ÷7ãà¢Âö'WGFöãà¢ÂöF—cà¢ÂöF—cà¢ÂöF—cà¢’¢çVÆÇÐ ¢¶—4FD6†ö–6TÖöFÄ÷Vâò€¢ÆF—b6Æ74æÖS×·7G–ÆW2æÖöFÄ÷fW&Æ—Óà¢ÆF—b6Æ74æÖS×·7G–ÆW2æÖöFÄ&6¶G&÷Òöä6Æ–6³×¶6Æ÷6TFD76WD6†ö–6TÖöFÇÒóà ¢ÆF—`¢6Æ74æÖS×¶G·7G–ÆW2æÖöFÄ6&GÒG·7G–ÆW2æFD76WD6†ö–6TÖöFÇÖÐ¢&öÆSÒ&F–Æör ¢&–ÖÖöFÃÒ'G'VR ¢&–ÖÆ&VÆÆVF'“Ò&FBÖ76WBÖ6†ö–6R×F—FÆR ¢à¢ÆF—b6Æ74æÖS×¶G·7G–ÆW2æÖöFÄ†VFW'ÒG·7G–ÆW2æFD76WD6†ö–6T†VFW'ÖÓà¢ÆF—b6Æ74æÖS×·7G–ÆW2æÖöFÄ†VFW%FW‡GÓà¢Æƒ2–CÒ&FBÖ76WBÖ6†ö–6R×F—FÆR#ä6†ö÷6R†÷rFòFBâ76WCÂöƒ3à¢Çå7F'Bv—F‚â–ÓG&–6RfÇVF–öâÂ÷"FBÖçVÆÇ’&–6VB76WBãÂ÷à¢ÂöF—cà ¢Æ'WGFöà¢G—SÒ&'WGFöâ ¢6Æ74æÖS×·7G–ÆW2æÖöFÄ6Æ÷6T'WGFöçÐ¢öä6Æ–6³×¶6Æ÷6TFD76WD6†ö–6TÖöFÇÐ¢&–ÖÆ&VÃÒ$6Æ÷6RFB76WB÷F–öç2 ¢à¢Ä6Æ÷6T–6öâ6Æ74æÖS×·7G–ÆW2æ'WGFöä–6öçÒóà¢Âö'WGFöãà¢ÂöF—cà ¢ÆF—b6Æ74æÖS×·7G–ÆW2æFD76WD6†ö–6Tw&–GÓà¢ÄÆ–æ²‡&Vc×¶FD76WEfÇVF–öä‡&VgÒ6Æ74æÖS×¶G·7G–ÆW2æFD76WD6†ö–6T'WGFöçÒG·7G–ÆW2æFD76WD6†ö–6T'WGFöå&–Ö'—ÖÓà¢ÅG&VæD–6öâ6Æ74æÖS×·7G–ÆW2æ'WGFöä–6öçÒóà¢Ç7ãà¢Ç7G&öæsä–ÓG&–6RfÇVSÂ÷7G&öæsà¢Â÷7ãà¢ÂôÆ–æ³à ¢Æ'WGFöâG—SÒ&'WGFöâ"6Æ74æÖS×·7G–ÆW2æFD76WD6†ö–6T'WGFöçÒöä6Æ–6³×¶÷VäÖçVÄVçG'”g&öÔ6†ö–6WÓà¢ÄFö7VÖVçD–6öâ6Æ74æÖS×·7G–ÆW2æ'WGFöä–6öçÒóà¢Ç7ãà¢Ç7G&öæsäÖçVÂVçG'“Â÷7G&öæsà¢Â÷7ãà¢Âö'WGFöãà¢ÂöF—cà¢ÂöF—cà¢ÂöF—cà¢’¢çVÆÇÐ ¢¶—47V—6—F–öä6†ö–6T÷Vâò€¢ÆF—b6Æ74æÖS×·7G–ÆW2æÖöFÄ÷fW&Æ—Óà¢ÆF—b6Æ74æÖS×·7G–ÆW2æÖöFÄ&6¶G&÷Òöä6Æ–6³×²‚’Óâ6WD—47V—6—F–öä6†ö–6T÷Vâ†fÇ6R—Òóà¢ÆF—b6Æ74æÖS×¶G·7G–ÆW2æÖöFÄ6&GÒG·7G–ÆW2æ76WDÆ–fV7–6ÆTÖöFÇÒG·7G–ÆW2ææWt7V—6—F–öä6†ö–6TÖöFÇÖÒ&öÆSÒ&F–Æör"&–ÖÖöFÃÒ'G'VR"&–ÖÆ&VÆÆVF'“Ò&æWrÖ7V—6—F–öâ×F—FÆR#à¢ÆF—b6Æ74æÖS×¶G·7G–ÆW2æÖöFÄ†VFW'ÒG·7G–ÆW2ææWt7V—6—F–öä6†ö–6T†VFW'ÖÓà¢ÆF—b6Æ74æÖS×·7G–ÆW2æÖöFÄ†VFW%FW‡GÓà¢Æƒ2–CÒ&æWrÖ7V—6—F–öâ×F—FÆR#äæWvÇ’7V—&VB76WCóÂöƒ3à¢Çä6†ö÷6R†÷rF†—276WBVçFW&VBF†R&Vv—7FW"ãÂ÷à¢ÂöF—cà¢Æ'WGFöâG—SÒ&'WGFöâ"6Æ74æÖS×·7G–ÆW2æÖöFÄ6Æ÷6T'WGFöçÒöä6Æ–6³×²‚’Óâ6WD—47V—6—F–öä6†ö–6T÷Vâ†fÇ6R—Ò&–ÖÆ&VÃÒ$6Æ÷6R7V—6—F–öâVW7F–öâ#à¢Ä6Æ÷6T–6öâ6Æ74æÖS×·7G–ÆW2æ'WGFöä–6öçÒóà¢Âö'WGFöãà¢ÂöF—cà¢ÆF—b6Æ74æÖS×¶G·7G–ÆW2æÖöFÅ67&öÆÄ&öG—ÒG·7G–ÆW2æ76WDÆ–fV7–6ÆT&öG—ÒG·7G–ÆW2ææWt7V—6—F–öä6†ö–6T&öG—ÖÓà¢ÆF—b6Æ74æÖS×¶G·7G–ÆW2æFD76WD6†ö–6Tw&–GÒG·7G–ÆW2ææWt7V—6—F–öä6†ö–6Tw&–GÖÓà¢Æ'WGFöà¢G—SÒ&'WGFöâ ¢6Æ74æÖS×¶G·7G–ÆW2æFD76WD6†ö–6T'WGFöçÒG·7G–ÆW2ææWt7V—6—F–öä6†ö–6T÷F–öçÒG¶æWt76WD7V—6—F–öäG&gBææWvÇ”7V—&VBÓÓÒG'VRò7G–ÆW2æFD76WD6†ö–6T'WGFöå&–Ö'’¢rwÖÐ¢öä6Æ–6³×²‚’Óâ6WDæWt76WD7V—6—F–öäG&gB‚†7W'&VçB’Óâ‡²ââæ7W'&VçBÂæWvÇ”7V—&VC¢G'VRÒ’—Ð¢&–×&W76VC×¶æWt76WD7V—6—F–öäG&gBææWvÇ”7V—&VBÓÓÒG'VWÐ¢à¢Ç7â6Æ74æÖS×·7G–ÆW2ææWt7V—6—F–öä6†ö–6T–æF–6F÷'Ò&–Ö†–FFVãÒ'G'VR"óà¢Ç7G&öæsäæWvÇ’7V—&VCÂ÷7G&öæsà¢Âö'WGFöãà¢Æ'WGFöà¢G—SÒ&'WGFöâ ¢6Æ74æÖS×¶G·7G–ÆW2æFD76WD6†ö–6T'WGFöçÒG·7G–ÆW2ææWt7V—6—F–öä6†ö–6T÷F–öçÒG¶æWt76WD7V—6—F–öäG&gBææWvÇ”7V—&VBÓÓÒfÇ6Rò7G–ÆW2æFD76WD6†ö–6T'WGFöå&–Ö'’¢rwÖÐ¢öä6Æ–6³×²‚’Óâ6WDæWt76WD7V—6—F–öäG&gB‚†7W'&VçB’Óâ‡²ââæ7W'&VçBÂæWvÇ”7V—&VC¢fÇ6RÒ’—Ð¢&–×&W76VC×¶æWt76WD7V—6—F–öäG&gBææWvÇ”7V—&VBÓÓÒfÇ6WÐ¢à¢Ç7â6Æ74æÖS×·7G–ÆW2ææWt7V—6—F–öä6†ö–6T–æF–6F÷'Ò&–Ö†–FFVãÒ'G'VR"óà¢Ç7G&öæsäW†—7F–ær76WCÂ÷7G&öæsà¢Âö'WGFöãà¢ÂöF—cà ¢¶æWt76WD7V—6—F–öäG&gBææWvÇ”7V—&VBÓÓÒG'VRò€¢ÆF—b6Æ74æÖS×·7G–ÆW2æ76WDÆ–fV7–6ÆTf–VÆG7Óà¢ÆÆ&VÂ6Æ74æÖS×·7G–ÆW2æ76WE6WGF–æw4f–VÆGÓà¢Ç7ãä7V—6—F–öâFFSÂ÷7ãà¢Æ–çWBG—SÒ&FFR"fÇVS×¶æWt76WD7V—6—F–öäG&gBæ7V—6—F–öäFFWÒöä6†ævS×²†WfVçB’Óâ6WDæWt76WD7V—6—F–öäG&gB‚†7W'&VçB’Óâ‡²ââæ7W'&VçBÂ7V—6—F–öäFFS¢WfVçBçF&vWBçfÇVRÒ’—Ò&WV—&VBóà¢ÂöÆ&VÃà¢ÆÆ&VÂ6Æ74æÖS×·7G–ÆW2æ76WE6WGF–æw4f–VÆGÓà¢Ç7ãåW&6†6R÷"7V—6—F–öâÖ÷VçBÇ6ÖÆÃä÷F–öæÂÂW†6ÂâdCÂ÷6ÖÆÃãÂ÷7ãà¢Æ–çWB–çWDÖöFSÒ&FV6–ÖÂ"fÇVS×¶æWt76WD7V—6—F–öäG&gBæ7V—6—F–öäÖ÷VçDW…fGÒöä6†ævS×²†WfVçB’Óâ6WDæWt76WD7V—6—F–öäG&gB‚†7W'&VçB’Óâ‡²ââæ7W'&VçBÂ7V—6—F–öäÖ÷VçDW…fC¢WfVçBçF&vWBçfÇVRÒ’—ÒÆ6V†öÆFW#Ò%""óà¢ÂöÆ&VÃà¢ÆÆ&VÂ6Æ74æÖS×·7G–ÆW2æ76WE6WGF–æw4f–VÆGÓà¢Ç7ãäæ÷FR÷"6÷W&6RÇ6ÖÆÃä÷F–öæÃÂ÷6ÖÆÃãÂ÷7ãà¢ÇFW‡F&VfÇVS×¶æWt76WD7V—6—F–öäG&gBææ÷FWÒöä6†ævS×²†WfVçB’Óâ6WDæWt76WD7V—6—F–öäG&gB‚†7W'&VçB’Óâ‡²ââæ7W'&VçBÂæ÷FS¢WfVçBçF&vWBçfÇVRÒ’—ÒÆ6V†öÆFW#Ò%W&6†6R&VfW&Væ6R÷"6÷W&6Ræ÷FR"óà¢ÂöÆ&VÃà¢ÂöF—cà¢’¢çVÆÇÐ¢ÆF—b6Æ74æÖS×¶G·7G–ÆW2æ76WE6WGF–æw47F–öç7ÒG·7G–ÆW2ææWt7V—6—F–öä6†ö–6T7F–öç7ÖÓà¢Æ'WGFöâG—SÒ&'WGFöâ"6Æ74æÖS×·7G–ÆW2ç6V6öæF'”'WGFöçÒöä6Æ–6³×²‚’Óâ6WD—47V—6—F–öä6†ö–6T÷Vâ†fÇ6R—Óä6æ6VÃÂö'WGFöãà¢Æ'WGFöâG—SÒ&'WGFöâ"6Æ74æÖS×·7G–ÆW2ç&–Ö'”'WGFöçÒöä6Æ–6³×¶6öçF–çVTÖçVÄVçG'”g&öÔ7V—6—F–öä6†ö–6WÒF—6&ÆVC×¶æWt76WD7V—6—F–öäG&gBææWvÇ”7V—&VBÓÓÒçVÆÇÓä6öçF–çVSÂö'WGFöãà¢ÂöF—cà¢ÂöF—cà¢ÂöF—cà¢ÂöF—cà¢’¢çVÆÇÐ ¢¶—476WDÖöFÄ÷Vâò€¢ÆF—b6Æ74æÖS×·7G–ÆW2æÖöFÄ÷fW&Æ—Óà¢ÆF—b6Æ74æÖS×·7G–ÆW2æÖöFÄ&6¶G&÷Òöä6Æ–6³×²‚’Óâ²–b‚—476WDWF÷6fT'W7’’6Æ÷6T76WDÖöFÂ‚“²×Òóà ¢ÆF—`¢6Æ74æÖS×¶G·7G–ÆW2æÖöFÄ6&GÒG·7G–ÆW2æ76WDf÷&ÔÖöFÇÒG¶ÖçVÄ76WE7FWâò7G–ÆW2æ76WEWFFTÖöFÂ¢rwÒG¶ÖçVÄ76WE7FWÓÓÒò7G–ÆW2æ76WDf÷&ÔÖöFÅ7FWöæR¢rwÖÐ¢&öÆSÒ&F–Æör ¢&–ÖÖöFÃÒ'G'VR ¢&–ÖÆ&VÃ×¶VF—F–æt76WBòuWFFR76WBr¢tFB76WBwÐ¢à¢ÆF—b6Æ74æÖS×¶G·7G–ÆW2æÖöFÄ†VFW'ÒG·7G–ÆW2æ76WDf÷&ÔÖöFÄ†VFW'ÒG·7G–ÆW2æÖçVÅv—¦&D†VFW'ÒG·7G–ÆW2æ76WDf÷&ÔÖöFÄ6‡&öÖT†VFW'ÖÓà¢¶ÖçVÄ76WE7FWÓÓÒò€¢ÆF—b6Æ74æÖS×·7G–ÆW2æÖöFÄ†VFW%FW‡GÓà¢Æƒ3ç¶VF—F–æt76WBòuWFFR76WBr¢tFBâ76WBwÓÂöƒ3à¢Çä6†ö÷6RF†R76WBG—RF†B&W7BÖF6†W2v†B–÷R&RFF–ærãÂ÷à¢ÂöF—cà¢’¢€¢ÆF—b6Æ74æÖS×·7G–ÆW2æ76WEWFFT†VFW$6öçFVçGÓà¢ÆF—b6Æ74æÖS×·7G–ÆW2æ76WEWFFT–FVçF—G—Óà¢Æƒ3à¢¶76WDG&gBçF—FÆRçG&–Ò‚’ÇÀ¢†VF—F–æt76WBòVF—F–æt76WBçF—FÆR¢FBG·6VÆV7FVDÖçVÄ76WEG—RæÆ&VÂçFôÆ÷vW$66R‚—Ö—Ð¢Âöƒ3à¢ÂöF—cà¢ÂöF—cà¢—Ð ¢Æ'WGFöà¢G—SÒ&'WGFöâ ¢6Æ74æÖS×·7G–ÆW2æÖöFÄ6Æ÷6T'WGFöçÐ¢öä6Æ–6³×¶6Æ÷6T76WDÖöFÇÐ¢&–ÖÆ&VÃÒ$6Æ÷6R76WBf÷&Ò ¢F—6&ÆVC×¶—476WDWF÷6fT'W7—Ð¢à¢Ä6Æ÷6T–6öâ6Æ74æÖS×·7G–ÆW2æ'WGFöä–6öçÒóà¢Âö'WGFöãà¢ÂöF—cà ¢ÆF—b6Æ74æÖS×¶G·7G–ÆW2æÖöFÅ67&öÆÄ&öG—ÒG·7G–ÆW2æÖçVÅ7FW67&öÆÄ&öG—ÒG¶ÖçVÄ76WE7FWÓÓÒò7G–ÆW2æÖçVÅ7FW67&öÆÄ&öG”æõ67&öÆÂ¢rwÖÓà¢¶ÖçVÄ76WE7FWâò€¢Ææb6Æ74æÖS×·7G–ÆW2æ76WDf÷&Õ6V7F–öåF'7Ò&–ÖÆ&VÃÒ$76WBf÷&Ò6V7F–öç2#à¢´54UEôdõ$Õõ4T5D”ôåõD%2æÖ‚‡6V7F–öâÂ–æFW‚’Óâ°¢6öç7B—47F—fRÒÖçVÄ76WE7FWÓÓÒ6V7F–öâç7FW° ¢&WGW&â€¢Æ'WGFöà¢G—SÒ&'WGFöâ ¢¶W“×·6V7F–öâç7FWÐ¢6Æ74æÖS×¶G·7G–ÆW2æ76WDf÷&Õ6V7F–öåF'ÒG¶—47F—fRò7G–ÆW2æ76WDf÷&Õ6V7F–öåF$7F—fR¢rwÖÐ¢öä6Æ–6³×²‚’Óâ÷Vä76WDf÷&Õ6V7F–öâ‡6V7F–öâç7FW—Ð¢&–Ö7W'&VçC×¶—47F—fRòw7FWr¢VæFVf–æVGÐ¢à¢Ç7â6Æ74æÖS×·7G–ÆW2æ76WDf÷&Õ6V7F–öåF$çVÖ&W'Óç¶–æFW‚²ÓÂ÷7ãà¢Ç7â6Æ74æÖS×·7G–ÆW2æ76WDf÷&Õ6V7F–öåF$6÷—Óà¢Ç7G&öæsç·6V7F–öâæÆ&VÇÓÂ÷7G&öæsà¢Â÷7ãà¢Âö'WGFöãà¢“°¢Ò—Ð¢Âöæcà¢’¢çVÆÇÐ ¢Æf÷&Ò6Æ74æÖS×¶G·7G–ÆW2æÖöFÄf÷&×ÒG·7G–ÆW2æÖçVÄ76WDf÷&×ÒG·7G–ÆW2æÖçVÅ7FWf÷&×ÖÒöå7V&Ö—C×²†WfVçB’ÓâWfVçBç&WfVçDFVfVÇB‚—Óà¢¶ÖçVÄ76WE7FWÓÓÒò€¢Ç6V7F–öâ6Æ74æÖS×¶G·7G–ÆW2æÖçVÅ7FvT6&GÒG·7G–ÆW2æÖçVÅ6–ævÆU7FvT6&GÒG·7G–ÆW2æÖçVÄ6ö×7E7FvT6&GÒG·7G–ÆW2æÖçVÅ7FWöæT6&GÒG·7G–ÆW2ægVÆÅv–GF‡ÖÓà¢ÆF—b6Æ74æÖS×·7G–ÆW2æÖçVÅ7FW–çG&÷Óà¢ÆƒCåv†B&R–÷RFF–æsóÂöƒCà¢ÂöF—cà ¢¶VF—F–æt76WCòçfÇVF–öå'Vä–Bò€¢ÆÆ&VÂ6Æ74æÖS×¶G·7G–ÆW2æf–VÆGÒG·7G–ÆW2æ76WEG—Tf–VÆGÒG·7G–ÆW2æÖçVÄÆö6¶VEG—T6&GÖÓà¢Ç7ãä76WBG—SÂ÷7ãà¢Æ–çWBfÇVS×¶¶–æDÆ&VÂ†VF—F–æt76WBæ¶–æB—ÒF—6&ÆVB&VDöæÇ’óà¢ÂöÆ&VÃà¢’¢€¢ÆF—b6Æ74æÖS×·7G–ÆW2æÖçVÄ76WEG—Tw&–GÒ&öÆSÒ&w&÷W"&–ÖÆ&VÃÒ$6†ö÷6Râ76WBG—R#à¢´ÔåTÅô54UEõE•UôõD”ôå2æÖ‚†÷F–öâÂ–æFW‚’Óâ°¢6öç7B—56VÆV7FVBÒ†4ÖçVÄ76WD¶–æE6VÆV7F–öâbb76WDf÷&Ô¶–æBÓÓÒ÷F–öâçfÇVS° ¢&WGW&â€¢Æ'WGFöà¢G—SÒ&'WGFöâ ¢¶W“×¶÷F–öâçfÇVWÐ¢6Æ74æÖS×¶G·7G–ÆW2æÖçVÄ76WEG—T6&GÒG¶—56VÆV7FVBò7G–ÆW2æÖçVÄ76WEG—T6&E6VÆV7FVB¢rwÖÐ¢öä6Æ–6³×²‚’Óâ6VÆV7DÖçVÄ76WD¶–æB†÷F–öâçfÇVRÂG'VR—Ð¢&–×&W76VC×¶—56VÆV7FVGÐ¢WFôfö7W3×¶–æFW‚ÓÓÒÐ¢à¢Ç7â6Æ74æÖS×·7G–ÆW2æÖçVÄ76WEG—T–6öçÓà¢·&VæFW$ÖçVÄ76WEG—T–6öâ†÷F–öâçfÇVRÂ7G–ÆW2æ'WGFöä–6öâ—Ð¢Â÷7ãà ¢Ç7â6Æ74æÖS×·7G–ÆW2æÖçVÄ76WEG—T6÷—Óà¢Ç7G&öæsç¶÷F–öâæÆ&VÇÓÂ÷7G&öæsà¢Ç6ÖÆÃç¶÷F–öâæFW67&—F–öçÓÂ÷6ÖÆÃà¢Â÷7ãà ¢Ç7â6Æ74æÖS×·7G–ÆW2æÖçVÄ76WEG—T'&÷wÒ&–Ö†–FFVãÒ'G'VR#à¢Ä6†Wg&öå&–v‡D–6öâ6Æ74æÖS×·7G–ÆW2æ'WGFöä–6öçÒóà¢Â÷7ãà¢Âö'WGFöãà¢“°¢Ò—Ð¢ÂöF—cà¢—Ð¢Â÷6V7F–öãà¢’¢çVÆÇÐ ¢¶ÖçVÄ76WE7FWÓÓÒ"ò€¢Ç6V7F–öâ6Æ74æÖS×¶G·7G–ÆW2æÖçVÅ7FvT6&GÒG·7G–ÆW2æÖçVÅ6–ævÆU7FvT6&GÒG·7G–ÆW2æÖçVÄ6ö×7E7FvT6&GÒG·7G–ÆW2æ76WEWFFU7FvT6&GÒG·7G–ÆW2ægVÆÅv–GF‡ÖÓà¢ÆF—b6Æ74æÖS×·7G–ÆW2æÖçVÅWF–Æ—G•&÷wÓà¢ÆF—b6Æ74æÖS×·7G–ÆW2æÖçVÅ6VÆV7FVEG—U7G&—Óà¢Ç7ãç¶VF—F–æt76WBòuG—Rr¢uG—Röb76WC¢wÓÂ÷7ãà¢Ç7G&öæsç·6VÆV7FVDÖçVÄ76WEG—RæÆ&VÇÓÂ÷7G&öæsà¢ÂöF—cà ¢Æ'WGFöà¢G—SÒ&'WGFöâ ¢6Æ74æÖS×·7G–ÆW2æÖçVÅ6WGF–æw4'WGFöçÐ¢öä6Æ–6³×¶VF—F–æt76WBò÷Vä76WE6WGF–æw4ÖöFÂ¢‚’Óâ6WDÖçVÄ76WE7FWƒ—Ð¢&–ÖÆ&VÃ×¶VF—F–æt76WBòt76WB6WGF–æw2r¢t6†ævR76WBG—RwÐ¢F—FÆS×¶VF—F–æt76WBòt76WB6WGF–æw2r¢t6†ævR76WBG—RwÐ¢à¢ÄÖævT–6öâ6Æ74æÖS×·7G–ÆW2æ'WGFöä–6öçÒóà¢Ç7ãç¶VF—F–æt76WBòu6WGF–æw2r¢t6†ævRG—RwÓÂ÷7ãà¢Âö'WGFöãà¢ÂöF—cà ¢ÆF—b6Æ74æÖS×¶G·7G–ÆW2æ76WDf÷&ÔFWF–Ç57F6·ÒG·WFFU7G–ÆW2æFWF–Ç57F6·ÖÓà¢ÆF—b6Æ74æÖS×·7G–ÆW2æ76WEF—FÆU&÷wÓà¢ÆÆ&VÂ6Æ74æÖS×¶G·7G–ÆW2æf–VÆGÒG·7G–ÆW2æÖçVÅF—FÆTf–VÆGÖÓà¢Ç7ãä76WBF—FÆSÂ÷7ãà¢Æ–çW@¢fÇVS×¶76WDG&gBçF—FÆWÐ¢öä6†ævS×²†WfVçB’Óà¢6WD76WDG&gB‚†7W'&VçB’Óâ‡°¢ââæ7W'&VçBÀ¢F—FÆS¢WfVçBçF&vWBçfÇVRÀ¢Ò’¢Ð¢Æ6V†öÆFW#×·6VÆV7FVDÖçVÄ76WEG—RçF—FÆUÆ6V†öÆFW'Ð¢WFôfö7W0¢óà¢ÂöÆ&VÃà¢ÂöF—cà ¢¶76WDf÷&Ô¶–æBÓÓÒvÖçVÂrÇÂ76WDf÷&Ô¶–æBÓÓÒw&÷W'G’rÇÂ76WDf÷&Ô¶–æBÓÓÒw7Fö6²rò€¢ÆF—b6Æ74æÖS×·7G–ÆW2æ76WD–ç7W&æ6T6Æ76–f–6F–öä6&GÓà¢ÆF—b6Æ74æÖS×·7G–ÆW2æ76WD–ç7W&æ6T6Æ76–f–6F–öä–çG&÷Óà¢Ç7G&öæsåFVÆÂW2Ö÷&R&÷WBF†—276WCÂ÷7G&öæsà¢Çà¢F†W6RFWF–Ç2†VÇ–ÓG&–6R÷&væ—6RF†R76WB6÷'&V7FÇ’æB&W&R6ÆV&W"&V6÷&G2æB&W÷'G2à¢–bF†R&Vv—7FW"—26†&VBf÷"–ç7W&æ6RÂ–ÓG&–6RÖ’7VvvW7B&V2f÷"'&ö¶W"Fò&Wf–WrÂ'WBF†P¢'&ö¶W"7F–ÆÂ6öæf—&×2F†Rf–æÂ6Æ76–f–6F–öâæB6÷fW"à¢Â÷à¢ÂöF—cà ¢ÆF—b6Æ74æÖS×·7G–ÆW2æ76WD–ç7W&æ6T6Æ76–f–6F–öäw&–GÓà¢¶76WDf÷&Ô¶–æBÓÓÒvÖçVÂrò€¢Ãà¢ÄÖöFÅ6VÆV7CÄvVæW&Ä76WD6FVv÷'”¶W“à¢Æ&VÃÒ%v†B—2—Cò¢ ¢fÇVS×¶76WDG&gBævVæW&Ä76WD6FVv÷'—Ð¢÷F–öç3×´tTäU$Åô54UEô4DTtõ%•ôõD”ôå7Ð¢öä6†ævS×²†vVæW&Ä76WD6FVv÷'’’Óà¢6WD76WDG&gB‚†7W'&VçB’Óâ‡°¢ââæ7W'&VçBÀ¢vVæW&Ä76WD6FVv÷'’À¢–ç7W&æ6TÖö&–Æ—G“ ¢vVæW&Ä76WD6FVv÷'’ÓÓÒw÷'F&ÆUöVÆV7G&öæ–72rbb7W'&VçBæ–ç7W&æ6TÖö&–Æ—G¢òw÷'F&ÆRp¢¢7W'&VçBæ–ç7W&æ6TÖö&–Æ—G’À¢–ç7W&æ6UFV×W&GW&U6Vç6—F—fU7Fö6³ ¢vVæW&Ä76WD6FVv÷'’ÓÓÒv6öÖÖW&6–Å÷&Vg&–vW&F–öâp¢ò7W'&VçBæ–ç7W&æ6UFV×W&GW&U6Vç6—F—fU7Fö6°¢¢wVæ¶æ÷vârÀ¢Ò’¢Ð¢Æ6V†öÆFW#Ò$6†ö÷6RF†R6Æ÷6W7BÖF6‚ ¢W6U÷'FÀ¢óà ¢ÄÖöFÅ6VÆV7CÄ–ç7W&æ6UW6T6öçFW‡Cà¢Æ&VÃÒ%v†W&R—2—BW6VCò¢ ¢fÇVS×¶76WDG&gBæ–ç7W&æ6UW6T6öçFW‡GÐ¢÷F–öç3×´”å5U$ä4UõU4Uô4ôåDU…EôõD”ôå7Ð¢öä6†ævS×²†–ç7W&æ6UW6T6öçFW‡B’Óà¢6WD76WDG&gB‚†7W'&VçB’Óâ‡²ââæ7W'&VçBÂ–ç7W&æ6UW6T6öçFW‡BÒ’¢Ð¢Æ6V†öÆFW#Ò$6†ö÷6R†öÖR÷"'W6–æW72W6R ¢W6U÷'FÀ¢óà ¢ÄÖöFÅ6VÆV7CÄ–ç7W&æ6TÖö&–Æ—G“à¢Æ&VÃÒ$FöW2—BÖ÷fR&÷VæCò¢ ¢fÇVS×¶76WDG&gBæ–ç7W&æ6TÖö&–Æ—G—Ð¢÷F–öç3×´”å5U$ä4UôÔô$”Ä•E•ôõD”ôå7Ð¢öä6†ævS×²†–ç7W&æ6TÖö&–Æ—G’’Óà¢6WD76WDG&gB‚†7W'&VçB’Óâ‡²ââæ7W'&VçBÂ–ç7W&æ6TÖö&–Æ—G’Ò’¢Ð¢Æ6V†öÆFW#Ò$6†ö÷6R†÷rF†R—FVÒ—2W6VB ¢W6U÷'FÀ¢óà ¢ÄÖöFÅ6VÆV7CÄ–ç7W&æ6Tf7Dç7vW#à¢Æ&VÃÒ$7&—F–6ÂFò÷W&F–öç3ò ¢fÇVS×¶76WDG&gBæ–ç7W&æ6T7&—F–6ÅFô÷W&F–öç7Ð¢÷F–öç3×´”å5U$ä4Uô5$•D”4Ä•E•ôõD”ôå7Ð¢öä6†ævS×²†–ç7W&æ6T7&—F–6ÅFô÷W&F–öç2’Óà¢6WD76WDG&gB‚†7W'&VçB’Óâ‡²ââæ7W'&VçBÂ–ç7W&æ6T7&—F–6ÅFô÷W&F–öç2Ò’¢Ð¢W6U÷'FÀ¢óà ¢¶76WDG&gBævVæW&Ä76WD6FVv÷'’ÓÓÒv6öÖÖW&6–Å÷&Vg&–vW&F–öârò€¢ÄÖöFÅ6VÆV7CÄ–ç7W&æ6Tf7Dç7vW#à¢Æ&VÃÒ%&÷FV7G2FV×W&GW&R×6Vç6—F—fR7Fö6³ò ¢fÇVS×¶76WDG&gBæ–ç7W&æ6UFV×W&GW&U6Vç6—F—fU7Fö6·Ð¢÷F–öç3×µDTÕU$EU$Uõ4Tå4•D•dUõ5Dô4µôõD”ôå7Ð¢öä6†ævS×²†–ç7W&æ6UFV×W&GW&U6Vç6—F—fU7Fö6²’Óà¢6WD76WDG&gB‚†7W'&VçB’Óâ‡²ââæ7W'&VçBÂ–ç7W&æ6UFV×W&GW&U6Vç6—F—fU7Fö6²Ò’¢Ð¢W6U÷'FÀ¢óà¢’¢çVÆÇÐ¢Âóà¢’¢çVÆÇÐ ¢¶76WDf÷&Ô¶–æBÓÓÒw&÷W'G’rò€¢Ãà¢ÄÖöFÅ6VÆV7CÅ&÷W'G”76WE7V'G—T¶W“à¢Æ&VÃÒ%v†B¶–æBöb&÷W'G’—2F†—3ò¢ ¢fÇVS×¶76WDG&gBç&÷W'G”76WE7V'G—WÐ¢÷F–öç3×µ$õU%E•ô54UEõ5T%E•UôõD”ôå7Ð¢öä6†ævS×²‡&÷W'G”76WE7V'G—R’Óà¢6WD76WDG&gB‚†7W'&VçB’Óâ‡°¢ââæ7W'&VçBÀ¢&÷W'G”76WE7V'G—RÀ¢–V$ÖöFVÃ¢&÷W'G”76WE7V'G—RÓÓÒvÆæBròrr¢7W'&VçBç–V$ÖöFVÂÀ¢&WÆ6VÖVçE&–6S¢&÷W'G”76WE7V'G—RÓÓÒvÆæBròrr¢7W'&VçBç&WÆ6VÖVçE&–6RÀ¢6öæF—F–öã¢&÷W'G”76WE7V'G—RÓÓÒvÆæBròrr¢7W'&VçBæ6öæF—F–öâÀ¢&÷W'G”–çFW&W7C ¢&÷W'G”76WE7V'G—RÓÓÒwFVæçEö–×&÷fVÖVçBrbb7W'&VçBç&÷W'G”–çFW&W7@¢òwFVæçEö–×&÷fVÖVçBp¢¢7W'&VçBç&÷W'G”–çFW&W7BÀ¢Ò’¢Ð¢Æ6V†öÆFW#Ò$6†ö÷6RF†R6Æ÷6W7B&÷W'G’G—R ¢W6U÷'FÀ¢óà ¢ÄÖöFÅ6VÆV7CÄ–ç7W&æ6UW6T6öçFW‡Cà¢Æ&VÃÒ$†÷r—2—BW6VCò¢ ¢fÇVS×¶76WDG&gBæ–ç7W&æ6UW6T6öçFW‡GÐ¢÷F–öç3×´”å5U$ä4UõU4Uô4ôåDU…EôõD”ôå7Ð¢öä6†ævS×²†–ç7W&æ6UW6T6öçFW‡B’Óà¢6WD76WDG&gB‚†7W'&VçB’Óâ‡²ââæ7W'&VçBÂ–ç7W&æ6UW6T6öçFW‡BÒ’¢Ð¢Æ6V†öÆFW#Ò$6†ö÷6R†öÖR÷"'W6–æW72W6R ¢W6U÷'FÀ¢óà ¢ÄÖöFÅ6VÆV7CÅ&÷W'G”–çFW&W7Cà¢Æ&VÃÒ%v†B—2–÷W"–çFW&W7Cò¢ ¢fÇVS×¶76WDG&gBç&÷W'G”–çFW&W7GÐ¢÷F–öç3×µ$õU%E•ô”åDU$U5EôõD”ôå7Ð¢öä6†ævS×²‡&÷W'G”–çFW&W7B’Óà¢6WD76WDG&gB‚†7W'&VçB’Óâ‡²ââæ7W'&VçBÂ&÷W'G”–çFW&W7BÒ’¢Ð¢Æ6V†öÆFW#Ò$6†ö÷6R÷væW'6†—÷"ö67Wæ7’ ¢W6U÷'FÀ¢óà¢Âóà¢’¢çVÆÇÐ ¢¶76WDf÷&Ô¶–æBÓÓÒw7Fö6²rò€¢Ãà¢ÄÖöFÅ6VÆV7CÅ7Fö6´76WE7V'G—T¶W“à¢Æ&VÃÒ%v†B¶–æBöb7Fö6²—2F†—3ò¢ ¢fÇVS×¶76WDG&gBç7Fö6´76WE7V'G—WÐ¢÷F–öç3×µ5Dô4µô54UEõ5T%E•UôõD”ôå7Ð¢öä6†ævS×²‡7Fö6´76WE7V'G—R’Óà¢6WD76WDG&gB‚†7W'&VçB’Óâ‡°¢ââæ7W'&VçBÀ¢7Fö6´76WE7V'G—RÀ¢–ç7W&æ6UFV×W&GW&U6Vç6—F—fU7Fö6³ ¢7Fö6´76WE7V'G—RÓÓÒvÆ—fW7Fö6²p¢òwVæ¶æ÷vâp¢¢7W'&VçBæ–ç7W&æ6UFV×W&GW&U6Vç6—F—fU7Fö6²À¢Ò’¢Ð¢Æ6V†öÆFW#Ò$6†ö÷6RF†R6Æ÷6W7B7Fö6²G—R ¢W6U÷'FÀ¢óà ¢ÄÖöFÅ6VÆV7CÅ7Fö6µfÇVF–öä&6—3à¢Æ&VÃÒ$†÷r—2—BfÇVVCò¢ ¢fÇVS×¶76WDG&gBç7Fö6µfÇVF–öä&6—7Ð¢÷F–öç3×µ5Dô4µõdÅTD”ôåô$4•5ôõD”ôå7Ð¢öä6†ævS×²‡7Fö6µfÇVF–öä&6—2’Óà¢6WD76WDG&gB‚†7W'&VçB’Óâ‡²ââæ7W'&VçBÂ7Fö6µfÇVF–öä&6—2Ò’¢Ð¢Æ6V†öÆFW#Ò$6†ö÷6RF†RfÇVR&6—2 ¢W6U÷'FÀ¢óà ¢ÄÖöFÅ6VÆV7CÅ7Fö6´Ö÷fVÖVçCà¢Æ&VÃÒ%v†W&R—2—Bæ÷&ÖÆÇ’¶WCò¢ ¢fÇVS×¶76WDG&gBç7Fö6´Ö÷fVÖVçGÐ¢÷F–öç3×µ5Dô4µôÔõdTÔTåEôõD”ôå7Ð¢öä6†ævS×²‡7Fö6´Ö÷fVÖVçB’Óà¢6WD76WDG&gB‚†7W'&VçB’Óâ‡²ââæ7W'&VçBÂ7Fö6´Ö÷fVÖVçBÒ’¢Ð¢Æ6V†öÆFW#Ò$6†ö÷6RF†Ræ÷&ÖÂÖ÷fVÖVçBGFW&â ¢W6U÷'FÀ¢óà ¢¶76WDG&gBç7Fö6´76WE7V'G—RÓÒvÆ—fW7Fö6²rò€¢ÄÖöFÅ6VÆV7CÄ–ç7W&æ6Tf7Dç7vW#à¢Æ&VÃÒ%FV×W&GW&R×6Vç6—F—fSò ¢fÇVS×¶76WDG&gBæ–ç7W&æ6UFV×W&GW&U6Vç6—F—fU7Fö6·Ð¢÷F–öç3×µDTÕU$EU$Uõ4Tå4•D•dUõ5Dô4µôõD”ôå7Ð¢öä6†ævS×²†–ç7W&æ6UFV×W&GW&U6Vç6—F—fU7Fö6²’Óà¢6WD76WDG&gB‚†7W'&VçB’Óâ‡²ââæ7W'&VçBÂ–ç7W&æ6UFV×W&GW&U6Vç6—F—fU7Fö6²Ò’¢Ð¢W6U÷'FÀ¢óà¢’¢çVÆÇÐ¢Âóà¢’¢çVÆÇÐ¢ÂöF—cà¢ÂöF—cà¢’¢çVÆÇÐ ¢¶76WDf÷&Ô¶–æBÓÒw&÷W'G’rbb76WDf÷&Ô¶–æBÓÒw7Fö6²rò€¢ÆF—b6Æ74æÖS×¶G·7G–ÆW2æ76WEG&—ÆTw&–GÒG·WFFU7G–ÆW2æ6ö×7Dw&–GÖÓà¢ÆÆ&VÂ6Æ74æÖS×·7G–ÆW2æf–VÆGÒFFÖ76WBÖFWF–ÂÖVF—B×F&vWCÒ'6W&–Â#à¢Ç7ãå6W&–Âò&VfW&Væ6SÂ÷7ãà¢Æ–çW@¢fÇVS×¶76WDG&gBç6W&–ÄçVÖ&W'Ð¢öä6†ævS×²†WfVçB’Óà¢6WD76WDG&gB‚†7W'&VçB’Óâ‡°¢ââæ7W'&VçBÀ¢6W&–ÄçVÖ&W#¢WfVçBçF&vWBçfÇVRÀ¢Ò’¢Ð¢Æ6V†öÆFW#Ò$÷F–öæÂ ¢óà¢ÂöÆ&VÃà ¢ÆÆ&VÂ6Æ74æÖS×·7G–ÆW2æf–VÆGÓà¢Ç7ãä'&æCÂ÷7ãà¢Æ–çW@¢fÇVS×¶76WDG&gBæ'&æDæÖWÐ¢öä6†ævS×²†WfVçB’Óà¢6WD76WDG&gB‚†7W'&VçB’Óâ‡°¢ââæ7W'&VçBÀ¢'&æDæÖS¢WfVçBçF&vWBçfÇVRÀ¢Ò’¢Ð¢Æ6V†öÆFW#Ò$÷F–öæÂ ¢óà¢ÂöÆ&VÃà ¢ÆÆ&VÂ6Æ74æÖS×·7G–ÆW2æf–VÆGÓà¢Ç7ãäÖöFVÃÂ÷7ãà¢Æ–çW@¢fÇVS×¶76WDG&gBæÖöFVÄæÖWÐ¢öä6†ævS×²†WfVçB’Óà¢6WD76WDG&gB‚†7W'&VçB’Óâ‡°¢ââæ7W'&VçBÀ¢ÖöFVÄæÖS¢WfVçBçF&vWBçfÇVRÀ¢Ò’¢Ð¢Æ6V†öÆFW#Ò$÷F–öæÂ ¢óà¢ÂöÆ&VÃà¢ÂöF—cà¢’¢çVÆÇÐ ¢¶76WDf÷&Ô¶–æBÓÓÒw&÷W'G’rò€¢ÆF—b6Æ74æÖS×¶G·7G–ÆW2æ76WEG&—ÆTw&–GÒG·WFFU7G–ÆW2æ6ö×7Dw&–GÖÓà¢²—4ÆæE&÷W'G”G&gBò€¢ÆÆ&VÂ6Æ74æÖS×·7G–ÆW2æf–VÆGÒFFÖ76WBÖFWF–ÂÖVF—B×F&vWCÒ'–V"#à¢Ç7ãç·–V$f–VÆDÆ&VÇÓÂ÷7ãà¢Æ–çW@¢G—SÒ&çVÖ&W" ¢Ö–ãÒ#ƒ ¢Öƒ×¶æWrFFR‚’ævWDgVÆÅ–V"‚’²Ð¢7FWÒ# ¢fÇVS×¶76WDG&gBç–V$ÖöFVÇÐ¢öä6†ævS×²†WfVçB’Óà¢6WD76WDG&gB‚†7W'&VçB’Óâ‡°¢ââæ7W'&VçBÀ¢–V$ÖöFVÃ¢WfVçBçF&vWBçfÇVRÀ¢Ò’¢Ð¢Æ6V†öÆFW#Ò$÷F–öæÂ ¢óà¢ÂöÆ&VÃà¢’¢çVÆÇÐ ¢ÆÆ&VÂ6Æ74æÖS×·7G–ÆW2æf–VÆGÓà¢Ç7ãå6—¦SÂ÷7ãà¢Æ–çW@¢G—SÒ'FW‡B ¢fÇVS×¶76WDG&gBç&÷W'G•6—¦WÐ¢öä6†ævS×²†WfVçB’Óà¢6WD76WDG&gB‚†7W'&VçB’Óâ‡°¢ââæ7W'&VçBÀ¢&÷W'G•6—¦S¢WfVçBçF&vWBçfÇVRÀ¢Ò’¢Ð¢Æ6V†öÆFW#Ò$W†×ÆS¢"†ÂCSÜ+"÷"#Ü+"6†VB ¢óà¢ÂöÆ&VÃà ¢·6†÷t6öæF—F–öäf–VÆBò€¢ÄÖöFÅ6VÆV7CÄ76WD6öæF—F–öåfÇVSà¢Æ&VÃÒ$6öæF—F–öâ ¢fÇVS×¶76WDG&gBæ6öæF—F–öçÐ¢÷F–öç3×´4ôäD•D”ôåôõD”ôå7Ð¢öä6†ævS×²†æW‡D6öæF—F–öâ’Óà¢6WD76WDG&gB‚†7W'&VçB’Óâ‡°¢ââæ7W'&VçBÀ¢6öæF—F–öã¢æW‡D6öæF—F–öâÀ¢Ò’¢Ð¢6Æ74æÖS×·7G–ÆW2æ76WD6öæF—F–öäf–VÆGÐ¢76WDFWF–ÄVF—EF&vWCÒ&6öæF—F–öâ ¢óà¢’¢çVÆÇÐ¢ÂöF—cà¢’¢76WDf÷&Ô¶–æBÓÒw7Fö6²rò€¢ÆF—b6Æ74æÖS×¶G·7G–ÆW2æ76WEG&—ÆTw&–GÒG·WFFU7G–ÆW2æ6ö×7Dw&–GÖÓà¢ÆÆ&VÂ6Æ74æÖS×·7G–ÆW2æf–VÆGÒFFÖ76WBÖFWF–ÂÖVF—B×F&vWCÒ'–V"#à¢Ç7ãç·–V$f–VÆDÆ&VÇÓÂ÷7ãà¢Æ–çW@¢G—SÒ&çVÖ&W" ¢Ö–ãÒ#ƒ ¢Öƒ×¶æWrFFR‚’ævWDgVÆÅ–V"‚’²Ð¢7FWÒ# ¢fÇVS×¶76WDG&gBç–V$ÖöFVÇÐ¢öä6†ævS×²†WfVçB’Óà¢6WD76WDG&gB‚†7W'&VçB’Óâ‡°¢ââæ7W'&VçBÀ¢–V$ÖöFVÃ¢WfVçBçF&vWBçfÇVRÀ¢Ò’¢Ð¢Æ6V†öÆFW#Ò$÷F–öæÂ ¢óà¢ÂöÆ&VÃà ¢ÆF—`¢6Æ74æÖS×¶G·7G–ÆW2æf–VÆGÒG·WFFU7G–ÆW2çW6vTVF—F÷'ÖÐ¢FFÖ76WBÖFWF–ÂÖVF—B×F&vWCÒ'W6vR ¢à¢ÄÖöFÅ6VÆV7CÄ76WDG&gEW6vTÖWG&–3à¢Æ&VÃÒ%W6vRG—R ¢fÇVS×¶76WDG&gBçW6vTÖWG&–7Ð¢÷F–öç3×·W6vUG—T÷F–öç7Ð¢öä6†ævS×²‡W6vTÖWG&–2’Óà¢6WD76WDG&gB‚†7W'&VçB’Óâ‡°¢ââæ7W'&VçBÀ¢W6vTÖWG&–2À¢†÷W'3¢W6vTÖWG&–2ÓÓÒv†÷W'2rÇÂW6vTÖWG&–2ÓÓÒv¶Òrò7W'&VçBæ†÷W'2¢rrÀ¢Æ–fUv÷&¶VEW&6VçC¢W6vTÖWG&–2ÓÓÒwW&6VçFvRrò7W'&VçBæÆ–fUv÷&¶VEW&6VçB¢rrÀ¢Ò’¢Ð¢6Æ74æÖS×·WFFU7G–ÆW2çW6vUG—Tf–VÆGÐ¢W6U÷'FÀ¢óà¢ÆÆ&VÂ6Æ74æÖS×·WFFU7G–ÆW2çW6vU&VF–æwÓà¢Ç7ãç·W6vTf–VÆDÆ&VÇÓÂ÷7ãà¢·6†÷uW&6VçEW6vTf–VÆBò€¢Æ–çW@¢G—SÒ&çVÖ&W" ¢Ö–ãÒ# ¢ÖƒÒ# ¢7FWÒ#ã ¢fÇVS×¶76WDG&gBæÆ–fUv÷&¶VEW&6VçGÐ¢öä6†ævS×²†WfVçB’Óà¢6WD76WDG&gB‚†7W'&VçB’Óâ‡°¢ââæ7W'&VçBÀ¢Æ–fUv÷&¶VEW&6VçC¢WfVçBçF&vWBçfÇVRÀ¢Ò’¢Ð¢Æ6V†öÆFW#×·W6vTf–VÆEÆ6V†öÆFW'Ð¢óà¢’¢76WDf÷&ÕW6vTæ÷DÆ–6&ÆRò€¢Æ–çWBfÇVSÒ$æ÷BÆ–6&ÆR"F—6&ÆVB&VDöæÇ’óà¢’¢€¢Æ–çW@¢G—SÒ'FW‡B ¢–çWDÖöFSÒ&çVÖW&–2 ¢fÇVS×¶f÷&ÖEW6vTÖ÷VçD–çWB†76WDG&gBæ†÷W'2—Ð¢öä6†ævS×²†WfVçB’Óà¢6WD76WDG&gB‚†7W'&VçB’Óâ‡°¢ââæ7W'&VçBÀ¢†÷W'3¢f÷&ÖEW6vTÖ÷VçD–çWB†WfVçBçF&vWBçfÇVR’À¢Ò’¢Ð¢Æ6V†öÆFW#×·W6vTf–VÆEÆ6V†öÆFW'Ð¢óà¢—Ð¢ÂöÆ&VÃà¢ÂöF—cà ¢·6†÷t6öæF—F–öäf–VÆBò€¢ÄÖöFÅ6VÆV7CÄ76WD6öæF—F–öåfÇVSà¢Æ&VÃÒ$6öæF—F–öâ ¢fÇVS×¶76WDG&gBæ6öæF—F–öçÐ¢÷F–öç3×´4ôäD•D”ôåôõD”ôå7Ð¢öä6†ævS×²†æW‡D6öæF—F–öâ’Óà¢6WD76WDG&gB‚†7W'&VçB’Óâ‡°¢ââæ7W'&VçBÀ¢6öæF—F–öã¢æW‡D6öæF—F–öâÀ¢Ò’¢Ð¢6Æ74æÖS×·7G–ÆW2æ76WD6öæF—F–öäf–VÆGÐ¢76WDFWF–ÄVF—EF&vWCÒ&6öæF—F–öâ ¢óà¢’¢çVÆÇÐ¢ÂöF—cà¢’¢çVÆÇÐ ¢ÆF—b6Æ74æÖS×¶G·7G–ÆW2æ76WEfÇVT&÷„w&–GÒG·WFFU7G–ÆW2çfÇVTw&–GÖÓà¢ÆÆ&VÂ6Æ74æÖS×¶G·7G–ÆW2æf–VÆGÒG·7G–ÆW2æÖçVÅfÇVTf–VÆGÖÓà¢Ç7ãç¶7W'&VçEfÇVTf–VÆDÆ&VÇÓÂ÷7ãà¢ÆF—b6Æ74æÖS×·7G–ÆW2æÖçVÄ7W'&Væ7”–çWGÓà¢Ç7ãå#Â÷7ãà¢Æ–çW@¢G—SÒ'FW‡B ¢–çWDÖöFSÒ&çVÖW&–2 ¢fÇVS×¶f÷&ÖE&Vv—7FW%fÇVT–çWB†76WDG&gBçfÇVR—Ð¢öä6†ævS×²†WfVçB’Óà¢6WD76WDG&gB‚†7W'&VçB’Óâ‡°¢ââæ7W'&VçBÀ¢fÇVS¢f÷&ÖE&Vv—7FW%fÇVT–çWB†WfVçBçF&vWBçfÇVR’À¢Ò’¢Ð¢Æ6V†öÆFW#Ò# ¢óà¢ÂöF—cà¢ÂöÆ&VÃà ¢·&WÆ6VÖVçE&–6U&WV—&VDf÷$G&gBò€¢ÆÆ&VÂ6Æ74æÖS×¶G·7G–ÆW2æf–VÆGÒG·7G–ÆW2æÖçVÅ&WÆ6VÖVçEfÇVTf–VÆGÖÓà¢Ç7ãç·&WÆ6VÖVçEfÇVTf–VÆDÆ&VÇÓÂ÷7ãà¢ÆF—b6Æ74æÖS×·7G–ÆW2æÖçVÄ7W'&Væ7”–çWGÓà¢Ç7ãå#Â÷7ãà¢Æ–çW@¢G—SÒ'FW‡B ¢–çWDÖöFSÒ&çVÖW&–2 ¢fÇVS×¶f÷&ÖE&Vv—7FW%fÇVT–çWB†76WDG&gBç&WÆ6VÖVçE&–6R—Ð¢öä6†ævS×²†WfVçB’Óà¢6WD76WDG&gB‚†7W'&VçB’Óâ‡°¢ââæ7W'&VçBÀ¢&WÆ6VÖVçE&–6S¢f÷&ÖE&Vv—7FW%fÇVT–çWB†WfVçBçF&vWBçfÇVR’À¢Ò’¢Ð¢Æ6V†öÆFW#Ò%&WV—&VB ¢óà¢ÂöF—cà¢ÂöÆ&VÃà¢’¢76WDf÷&Ô¶–æBÓÓÒw7Fö6²rò€¢ÆÆ&VÂ6Æ74æÖS×¶G·7G–ÆW2æf–VÆGÒG·7G–ÆW2æÖçVÅ&WÆ6VÖVçEfÇVTf–VÆGÖÓà¢Ç7ãåV²ò6V6öæÂ7Fö6²fÇVRW†6ÂâdCÂ÷7ãà¢ÆF—b6Æ74æÖS×·7G–ÆW2æÖçVÄ7W'&Væ7”–çWGÓà¢Ç7ãå#Â÷7ãà¢Æ–çW@¢G—SÒ'FW‡B ¢–çWDÖöFSÒ&çVÖW&–2 ¢fÇVS×¶f÷&ÖE&Vv—7FW%fÇVT–çWB†76WDG&gBç7Fö6µVµfÇVR—Ð¢öä6†ævS×²†WfVçB’Óà¢6WD76WDG&gB‚†7W'&VçB’Óâ‡°¢ââæ7W'&VçBÀ¢7Fö6µVµfÇVS¢f÷&ÖE&Vv—7FW%fÇVT–çWB†WfVçBçF&vWBçfÇVR’À¢Ò’¢Ð¢Æ6V†öÆFW#Ò$÷F–öæÂ ¢óà¢ÂöF—cà¢ÂöÆ&VÃà¢’¢çVÆÇÐ ¢ÆÆ&VÂ6Æ74æÖS×¶G·7G–ÆW2æf–VÆGÒG·7G–ÆW2æ76WD–ç7W&VEfÇVTf–VÆGÖÓà¢Ç7ãä–ç7W&VBfÇVRW†6ÂâdCÂ÷7ãà¢ÆF—b6Æ74æÖS×·7G–ÆW2æÖçVÄ7W'&Væ7”–çWGÓà¢Ç7ãå#Â÷7ãà¢Æ–çW@¢G—SÒ'FW‡B ¢–çWDÖöFSÒ&çVÖW&–2 ¢fÇVS×¶f÷&ÖE&Vv—7FW%fÇVT–çWB†76WDG&gBæ–ç7W&VEfÇVR—Ð¢öä6†ævS×²†WfVçB’Óâ†æFÆT–ç7W&VEfÇVT6†ævR†WfVçBçF&vWBçfÇVR—Ð¢Æ6V†öÆFW#Ò$÷F–öæÂ ¢óà¢ÂöF—cà¢ÂöÆ&VÃà¢ÂöF—cà ¢·6†÷tÆ–fUv÷&¶VEW&6VçDf–VÆBò€¢ÆF—b6Æ74æÖS×·7G–ÆW2æ76WDW†–Æ–'”w&–GÓà¢ÆÆ&VÂ6Æ74æÖS×·7G–ÆW2æf–VÆGÓà¢Ç7ãåW6vRSÂ÷7ãà¢Æ–çW@¢G—SÒ&çVÖ&W" ¢Ö–ãÒ# ¢ÖƒÒ# ¢7FWÒ#ã ¢fÇVS×¶76WDG&gBæÆ–fUv÷&¶VEW&6VçGÐ¢öä6†ævS×²†WfVçB’Óà¢6WD76WDG&gB‚†7W'&VçB’Óâ‡°¢ââæ7W'&VçBÀ¢Æ–fUv÷&¶VEW&6VçC¢WfVçBçF&vWBçfÇVRÀ¢Ò’¢Ð¢Æ6V†öÆFW#Ò$÷F–öæÂ ¢óà¢ÂöÆ&VÃà¢ÂöF—cà¢’¢çVÆÇÐ ¢ÆÆ&VÂ6Æ74æÖS×¶G·7G–ÆW2æf–VÆGÒG·7G–ÆW2ægVÆÅv–GF‡ÒG·7G–ÆW2æ76WDæ÷FW4f–VÆGÒG·WFFU7G–ÆW2ææ÷FW4f–VÆGÖÓà¢Ç7ãäæ÷FW3Â÷7ãà¢ÇFW‡F&V¢&÷w3×³7Ð¢fÇVS×¶76WDG&gBææ÷FWÐ¢öä6†ævS×²†WfVçB’Óà¢6WD76WDG&gB‚†7W'&VçB’Óâ‡°¢ââæ7W'&VçBÀ¢æ÷FS¢WfVçBçF&vWBçfÇVRÀ¢Ò’¢Ð¢Æ6V†öÆFW#Ò$÷F–öæÂ ¢óà¢ÂöÆ&VÃà¢ÂöF—cà¢Â÷6V7F–öãà¢’¢çVÆÇÐ ¢¶ÖçVÄ76WE7FWÓÓÒ2ò€¢Ç6V7F–öâ6Æ74æÖS×¶G·7G–ÆW2æÖçVÅ7FvT6&GÒG·7G–ÆW2æÖçVÅ6–ævÆU7FvT6&GÒG·7G–ÆW2æÖçVÄ6ö×7E7FvT6&GÒG·7G–ÆW2æ76WEWFFU7FvT6&GÒG·7G–ÆW2ægVÆÅv–GF‡ÒG·7G–ÆW2æ76WE7FGW57FvT6&GÖÓà¢¶76WE7FGW4VF—Ef–WrÓÓÒv‡V"rò€¢ÆF—b6Æ74æÖS×·7G–ÆW2æ76WE7FGW4‡V$w&–GÓà¢Æ'WGFöà¢G—SÒ&'WGFöâ ¢6Æ74æÖS×·7G–ÆW2æ76WE7FGW4‡V$6&GÐ¢öä6Æ–6³×²‚’Óâ÷Vä76WE7FGW4VF—Ef–Wr‚vf–ææ6Rr—Ð¢à¢Ç7G&öæsäf–ææ6SÂ÷7G&öæsà¢Ç6ÖÆÃç¶f–ææ6U7FGW57VÖÖ'’†76WE7FGW4G&gB—ÓÂ÷6ÖÆÃà¢Âö'WGFöãà ¢Æ'WGFöà¢G—SÒ&'WGFöâ ¢6Æ74æÖS×·7G–ÆW2æ76WE7FGW4‡V$6&GÐ¢öä6Æ–6³×²‚’Óâ÷Vä76WE7FGW4VF—Ef–Wr‚v–ç7W&æ6Rr—Ð¢à¢Ç7G&öæsä–ç7W&æ6SÂ÷7G&öæsà¢Ç6ÖÆÃç¶–ç7W&æ6U7FGW57VÖÖ'’†76WE7FGW4G&gB—ÓÂ÷6ÖÆÃà¢Âö'WGFöãà ¢¶76WDÆ–6Vç6TÆ–6&ÆRò€¢Æ'WGFöà¢G—SÒ&'WGFöâ ¢6Æ74æÖS×·7G–ÆW2æ76WE7FGW4‡V$6&GÐ¢öä6Æ–6³×²‚’Óâ÷Vä76WE7FGW4VF—Ef–Wr‚vÆ–6Vç6Rr—Ð¢à¢Ç7G&öæsäÆ–6Vç6SÂ÷7G&öæsà¢Ç6ÖÆÃç¶Æ–6Vç6U7FGW57VÖÖ'’†76WE7FGW4G&gB—ÓÂ÷6ÖÆÃà¢Âö'WGFöãà¢’¢çVÆÇÐ¢ÂöF—cà¢’¢çVÆÇÐ ¢¶76WE7FGW4VF—Ef–WrÓÓÒvf–ææ6Rrò€¢ÆF—b6Æ74æÖS×·7G–ÆW2æ76WE7FGW4fö7W6VDf÷&×Óà¢ÆF—b6Æ74æÖS×·7G–ÆW2æ76WE7FGW4fö7W6VD†VFW'Óà¢Ç7G&öæsäf–ææ6SÂ÷7G&öæsà¢ÂöF—cà ¢ÆF—b6Æ74æÖS×·7G–ÆW2æ76WE7FGW4VF—Dw&–GÓà¢ÄÖöFÅ6VÆV7CÄf–ææ6U7FGW46†ö–6Sà¢Æ&VÃÒ$f–ææ6R7FGW2 ¢fÇVS×¶76WE7FGW4G&gBæf–ææ6U7FGW7Ð¢÷F–öç3×µT”4µôd”ää4Uõ5DEU5ôõD”ôå7Ð¢öä6†ævS×·6WD76WDf–ææ6U7FGW7Ð¢6†÷tFW67&—F–öç3×¶fÇ6WÐ¢W6U÷'FÀ¢óà ¢ÆF—b6Æ74æÖS×¶G·7G–ÆW2æ76WE7FGW47V—6—F–öåæVÇÒG·7G–ÆW2æ76WE7FGW5v–FTf–VÆGÖÓà¢ÆF—b6Æ74æÖS×·7G–ÆW2æ76WE7FGW47V—6—F–öä†VFW'Óà¢Ç7G&öæsä7V—6—F–öâFWF–Ç3Â÷7G&öæsà¢Ç6ÖÆÃä¶WBv—F‚f–ææ6RæBW'v÷&²ãÂ÷6ÖÆÃà¢ÂöF—cà¢ÆF—b6Æ74æÖS×·7G–ÆW2æ76WE7FGW47V—6—F–öäw&–GÓà¢ÆÆ&VÂ6Æ74æÖS×·7G–ÆW2æf–VÆGÓà¢Ç7ãä7V—6—F–öâFFRÇ6ÖÆÃâ†÷F–öæÂ“Â÷6ÖÆÃãÂ÷7ãà¢Æ–çWBG—SÒ&FFR"fÇVS×¶76WE7FGW4G&gBæf–ææ6T&÷Vv‡Ev†VçÒöä6†ævS×²†WfVçB’ÓâWFFT76WE7FGW4G&gDf–VÆB‚vf–ææ6T&÷Vv‡Ev†VârÂWfVçBçF&vWBçfÇVR—Òóà¢ÂöÆ&VÃà¢ÆÆ&VÂ6Æ74æÖS×·7G–ÆW2æf–VÆGÓà¢Ç7ãä7V—6—F–öâÖ÷VçBW†6ÂâdBÇ6ÖÆÃâ†÷F–öæÂ“Â÷6ÖÆÃãÂ÷7ãà¢Æ–çWBG—SÒ'FW‡B"–çWDÖöFSÒ&çVÖW&–2"fÇVS×¶76WE7FGW4G&gBæf–ææ6T&÷Vv‡Df÷$W…fGÒöä6†ævS×²†WfVçB’ÓâWFFT76WE7FGW4G&gDf–VÆB‚vf–ææ6T&÷Vv‡Df÷$W…fBrÂf÷&ÖE&Vv—7FW%fÇVT–çWB†WfVçBçF&vWBçfÇVR’—ÒÆ6V†öÆFW#Ò$÷F–öæÂ"óà¢ÂöÆ&VÃà¢ÂöF—cà¢ÂöF—cà ¢¶76WE7FGW4G&gBæf–ææ6U7FGW2ÓÓÒw–W2rÇÂ76WE7FGW4G&gBæf–ææ6U7FGW2ÓÓÒw–Brò€¢Ãà¢ÄÖöFÅ6VÆV7CÇ7G&–æsà¢Æ&VÃÒ$f–ææ6RG—R ¢fÇVS×¶76WE7FGW4G&gBæf–ææ6UG—WÐ¢÷F–öç3×´d”ää4UõE•UôõD”ôå7Ð¢öä6†ævS×·6WD76WDf–ææ6UG—WÐ¢Æ6V†öÆFW#Ò%6VÆV7Bf–ææ6RG—R ¢6†÷tFW67&—F–öç3×¶fÇ6WÐ¢W6U÷'FÀ¢óà ¢¶76WE7FGW4G&gBæf–ææ6UG—RÓÓÒv'VÆµöw&÷WrbbVF—F–æt76WBò€¢ÆF—b6Æ74æÖS×¶G·7G–ÆW2æ'VÆ´f–ææ6TÆ–æ´6&GÒG·7G–ÆW2æ76WE7FGW5v–FTf–VÆGÖÓà¢ÆF—cà¢Ç7G&öæsä76WG2–âF†—2f–ææ6Rw&VVÖVçCÂ÷7G&öæsà¢Ç6ÖÆÃä6†ö÷6RWfW'’76WB6÷fW&VB'’F†R6ÖRf6–Æ—G’ãÂ÷6ÖÆÃà¢ÂöF—cà¢Æ'WGFöâG—SÒ&'WGFöâ"6Æ74æÖS×·7G–ÆW2æ'VÆ´f–ææ6T6†ö÷6T'WGFöçÒöä6Æ–6³×²‚’Óâ6WD'VÆ´f–ææ6T76WE–6¶W$÷Vâ‡G'VR—Óà¢Ç7ãç¶'VÆ´f–ææ6T76WD–G2æÆVæwF‡Ò6VÆV7FVCÂ÷7ãà¢Ç7G&öæsä6†ö÷6R76WG3Â÷7G&öæsà¢Âö'WGFöãà¢ÆF—b6Æ74æÖS×·7G–ÆW2æ'VÆ´f–ææ6U6VÆV7FVD76WG7Óà¢·6VÆV7FVD'VÆ´f–ææ6T76WG2æÖ‚†76WB’ÓâÇ7â¶W“×¶76WBæ–GÓç¶76WBçF—FÆWÓÂ÷7ãâ—Ð¢ÂöF—cà¢ÂöF—cà¢’¢çVÆÇÐ ¢¶76WE7FGW4G&gBæf–ææ6U7FGW2ÓÓÒw–W2ròÆÆ&VÂ6Æ74æÖS×·7G–ÆW2æf–VÆGÓà¢Ç7ãä7W'&VçB÷WG7FæF–ærÖ÷VçBW†6ÂâdBÇ6ÖÆÃâ†÷F–öæÂ“Â÷6ÖÆÃãÂ÷7ãà¢Æ–çWBG—SÒ'FW‡B"–çWDÖöFSÒ&çVÖW&–2"fÇVS×¶76WE7FGW4G&gBæf–ææ6T7W'&VçD÷WG7FæF–ætW…fGÒöä6†ævS×²†WfVçB’ÓâWFFT76WE7FGW4G&gDf–VÆB‚vf–ææ6T7W'&VçD÷WG7FæF–ætW…fBrÂf÷&ÖE&Vv—7FW%fÇVT–çWB†WfVçBçF&vWBçfÇVR’—ÒÆ6V†öÆFW#Ò$÷F–öæÂ"óà¢ÂöÆ&VÃâ¢çVÆÇÐ ¢ÆÆ&VÂ6Æ74æÖS×·7G–ÆW2æf–VÆGÓà¢Ç7ãäf–ææ6–W"Ç6ÖÆÃâ†÷F–öæÂ“Â÷6ÖÆÃãÂ÷7ãà¢Æ–çW@¢fÇVS×¶76WE7FGW4G&gBæf–ææ6–W$æÖWÐ¢öä6†ævS×²†WfVçB’ÓâWFFT76WE7FGW4G&gDf–VÆB‚vf–ææ6–W$æÖRrÂWfVçBçF&vWBçfÇVR—Ð¢Æ6V†öÆFW#Ò$W†×ÆS¢&æ²÷"f–ææ6R†÷W6R ¢óà¢ÂöÆ&VÃà ¢ÆÆ&VÂ6Æ74æÖS×¶G·7G–ÆW2æf–VÆGÒG·7G–ÆW2æ76WE7FGW5v–FTf–VÆGÖÓà¢Ç7ãäf–ææ6Ræ÷FRÇ6ÖÆÃâ†÷F–öæÂ“Â÷6ÖÆÃãÂ÷7ãà¢ÇFW‡F&V¢fÇVS×¶76WE7FGW4G&gBæf–ææ6Tæ÷FWÐ¢öä6†ævS×²†WfVçB’ÓâWFFT76WE7FGW4G&gDf–VÆB‚vf–ææ6Tæ÷FRrÂWfVçBçF&vWBçfÇVR—Ð¢Æ6V†öÆFW#Ò$÷F–öæÂ ¢&÷w3×³7Ð¢óà¢ÂöÆ&VÃà ¢ÆF—b6Æ74æÖS×¶G·7G–ÆW2æ76WE7FGW4Fö7VÖVçEWÆöGÒG·7G–ÆW2æ76WE7FGW5v–FTf–VÆGÖÓà¢ÆF—b6Æ74æÖS×·7G–ÆW2æ76WE7FGW4Fö7VÖVçEWÆöD6÷—Óà¢Ç7G&öæsäf–ææ6RFö7VÖVçG3Â÷7G&öæsà¢Ç6ÖÆÃäw&VVÖVçG2Â7FFVÖVçG2÷"6WGFÆVÖVçBÆWGFW'3Â÷6ÖÆÃà¢ÂöF—cà¢ÆÆ&VÂ6Æ74æÖS×¶G·7G–ÆW2ç6V6öæF'”'WGFöçÒG·7G–ÆW2æf–ÆU–6¶W$'WGFöçÒG·7G–ÆW2æ76WE7FGW4Fö7VÖVçE–6¶W'ÒG¶—5WÆöF–ætFö7VÖVçG2ÇÂÖçVÄG&gDFö7VÖVçD6÷VçBãÒÔ…ôDô5TÔTåE2ò7G–ÆW2æf–ÆU–6¶W$'WGFöäF—6&ÆVB¢rwÖÓà¢Ç7ãç¶—5WÆöF–ætFö7VÖVçG2òtFF–ærFö7VÖVçG2âââr¢tFBf–ææ6RFö7VÖVçG2wÓÂ÷7ãà¢Æ–çW@¢G—SÒ&f–ÆR ¢×VÇF—ÆP¢6Æ74æÖS×·7G–ÆW2æf–ÆT–çWGÐ¢&–ÖÆ&VÃÒ$FBf–ææ6RFö7VÖVçG2 ¢66WCÒ"çFbÂæFö2ÂæFö7‚Âç†Ç2Âç†Ç7‚Âæ77bÂçG‡BÂæ§rÂæ§VrÂçærÂçvV' ¢öä6†ævS×²†WfVçB’Óâ†æFÆTFö7VÖVçDf–ÆW56VÆV7FVB†WfVçBÂvf–ææ6Rr—Ð¢F—6&ÆVC×¶—5WÆöF–ætFö7VÖVçG2ÇÂÖçVÄG&gDFö7VÖVçD6÷VçBãÒÔ…ôDô5TÔTåE7Ð¢óà¢ÂöÆ&VÃà¢Ç6ÖÆÂ6Æ74æÖS×·7G–ÆW2æ76WE7FGW4Fö7VÖVçD6÷VçGÓç¶ÖçVÄG&gDFö7VÖVçD6÷VçGÒò´Ô…ôDô5TÔTåE7ÒFö7VÖVçG3Â÷6ÖÆÃà¢ÂöF—cà¢Âóà¢’¢çVÆÇÐ¢ÂöF—cà ¢¶76WE7FGW4G&gBæf–ææ6U7FGW2ÓÓÒw–W2rÇÂ76WE7FGW4G&gBæf–ææ6U7FGW2ÓÓÒw–Brò€¢Ãà¢Æ'WGFöà¢G—SÒ&'WGFöâ ¢6Æ74æÖS×·7G–ÆW2æ76WE7FGW4Gfæ6VEFövvÆWÐ¢öä6Æ–6³×²‚’Óâ6WD76WE7FGW4Gfæ6VD÷Vâ‚†7W'&VçB’Óâ7W'&VçB—Ð¢&–ÖW‡æFVC×¶76WE7FGW4Gfæ6VD÷VçÐ¢à¢Ç7ãäGfæ6VBFWF–Ç3Â÷7ãà¢Ç7G&öæsç¶76WE7FGW4Gfæ6VD÷Vâòt†–FRr¢u6†÷rwÓÂ÷7G&öæsà¢Âö'WGFöãà ¢¶76WE7FGW4Gfæ6VD÷Vâò€¢ÆF—b6Æ74æÖS×·7G–ÆW2æ76WE7FGW4Gfæ6VDw&–GÓà¢ÆÆ&VÂ6Æ74æÖS×·7G–ÆW2æf–VÆGÓà¢Ç7ãä÷&–v–æÂf–ææ6VBÖ÷VçBW†6ÂâdBÇ6ÖÆÃâ†÷F–öæÂ“Â÷6ÖÆÃãÂ÷7ãà¢Æ–çW@¢G—SÒ'FW‡B ¢–çWDÖöFSÒ&çVÖW&–2 ¢fÇVS×¶76WE7FGW4G&gBæf–ææ6T÷&–v–æÄÖ÷VçDW…fGÐ¢öä6†ævS×²†WfVçB’ÓâWFFT76WE7FGW4G&gDf–VÆB‚vf–ææ6T÷&–v–æÄÖ÷VçDW…fBrÂf÷&ÖE&Vv—7FW%fÇVT–çWB†WfVçBçF&vWBçfÇVR’—Ð¢Æ6V†öÆFW#Ò$÷F–öæÂ ¢óà¢ÂöÆ&VÃà ¢ÆÆ&VÂ6Æ74æÖS×·7G–ÆW2æf–VÆGÓà¢Ç7ãäÖöçF†Ç’–ÖVçBÇ6ÖÆÃâ†÷F–öæÂ“Â÷6ÖÆÃãÂ÷7ãà¢Æ–çW@¢G—SÒ'FW‡B ¢–çWDÖöFSÒ&çVÖW&–2 ¢fÇVS×¶76WE7FGW4G&gBæf–ææ6TÖöçF†Ç•–ÖVçDW…fGÐ¢öä6†ævS×²†WfVçB’ÓâWFFT76WE7FGW4G&gDf–VÆB‚vf–ææ6TÖöçF†Ç•–ÖVçDW…fBrÂf÷&ÖE&Vv—7FW%fÇVT–çWB†WfVçBçF&vWBçfÇVR’—Ð¢Æ6V†öÆFW#Ò$÷F–öæÂ ¢óà¢ÂöÆ&VÃà ¢ÆÆ&VÂ6Æ74æÖS×·7G–ÆW2æf–VÆGÓà¢Ç7ãä–çFW&W7B&FRRÇ6ÖÆÃâ†÷F–öæÂ“Â÷6ÖÆÃãÂ÷7ãà¢Æ–çW@¢G—SÒ&çVÖ&W" ¢Ö–ãÒ# ¢7FWÒ#ã ¢fÇVS×¶76WE7FGW4G&gBæf–ææ6T–çFW&W7E&FUW&6VçGÐ¢öä6†ævS×²†WfVçB’ÓâWFFT76WE7FGW4G&gDf–VÆB‚vf–ææ6T–çFW&W7E&FUW&6VçBrÂWfVçBçF&vWBçfÇVR—Ð¢Æ6V†öÆFW#Ò$÷F–öæÂ ¢óà¢ÂöÆ&VÃà ¢ÆÆ&VÂ6Æ74æÖS×·7G–ÆW2æf–VÆGÓà¢Ç7ãäf–ææ6RFW&ÒÖöçF‡2Ç6ÖÆÃâ†÷F–öæÂ“Â÷6ÖÆÃãÂ÷7ãà¢Æ–çW@¢G—SÒ&çVÖ&W" ¢Ö–ãÒ# ¢7FWÒ# ¢fÇVS×¶76WE7FGW4G&gBæf–ææ6UFW&ÔÖöçF‡7Ð¢öä6†ævS×²†WfVçB’ÓâWFFT76WE7FGW4G&gDf–VÆB‚vf–ææ6UFW&ÔÖöçF‡2rÂWfVçBçF&vWBçfÇVR—Ð¢Æ6V†öÆFW#Ò$÷F–öæÂ ¢óà¢ÂöÆ&VÃà ¢ÆÆ&VÂ6Æ74æÖS×·7G–ÆW2æf–VÆGÓà¢Ç7ãä&ÆÆööâò&W6–GVÂÖ÷VçBW†6ÂâdBÇ6ÖÆÃâ†÷F–öæÂ“Â÷6ÖÆÃãÂ÷7ãà¢Æ–çW@¢G—SÒ'FW‡B ¢–çWDÖöFSÒ&çVÖW&–2 ¢fÇVS×¶76WE7FGW4G&gBæf–ææ6T&ÆÆööå–ÖVçDW…fGÐ¢öä6†ævS×²†WfVçB’ÓâWFFT76WE7FGW4G&gDf–VÆB‚vf–ææ6T&ÆÆööå–ÖVçDW…fBrÂf÷&ÖE&Vv—7FW%fÇVT–çWB†WfVçBçF&vWBçfÇVR’—Ð¢Æ6V†öÆFW#Ò$÷F–öæÂ ¢óà¢ÂöÆ&VÃà ¢ÆÆ&VÂ6Æ74æÖS×·7G–ÆW2æf–VÆGÓà¢Ç7ãå6WGFÆVÖVçBòW‡—'’FFRÇ6ÖÆÃâ†÷F–öæÂ“Â÷6ÖÆÃãÂ÷7ãà¢Æ–çW@¢G—SÒ&FFR ¢fÇVS×¶76WE7FGW4G&gBæf–ææ6U6WGFÆVÖVçDFFWÐ¢öä6†ævS×²†WfVçB’ÓâWFFT76WE7FGW4G&gDf–VÆB‚vf–ææ6U6WGFÆVÖVçDFFRrÂWfVçBçF&vWBçfÇVR—Ð¢óà¢ÂöÆ&VÃà ¢ÆÆ&VÂ6Æ74æÖS×·7G–ÆW2æf–VÆGÓà¢Ç7ãäw&VVÖVçBò&VfW&Væ6RçVÖ&W"Ç6ÖÆÃâ†÷F–öæÂ“Â÷6ÖÆÃãÂ÷7ãà¢Æ–çW@¢fÇVS×¶76WE7FGW4G&gBæf–ææ6U&VfW&Væ6TçVÖ&W'Ð¢öä6†ævS×²†WfVçB’ÓâWFFT76WE7FGW4G&gDf–VÆB‚vf–ææ6U&VfW&Væ6TçVÖ&W"rÂWfVçBçF&vWBçfÇVR—Ð¢Æ6V†öÆFW#Ò$÷F–öæÂ ¢óà¢ÂöÆ&VÃà¢ÂöF—cà¢’¢çVÆÇÐ¢Âóà¢’¢çVÆÇÐ ¢¶76WE7FGW4W'&÷"òÇ6Æ74æÖS×·7G–ÆW2æ76WE7FGW4W'&÷'Óç¶76WE7FGW4W'&÷'ÓÂ÷â¢çVÆÇÐ ¢ÆF—b6Æ74æÖS×·7G–ÆW2æ76WE7FGW57V$7F–öç7Óà¢Æ'WGFöà¢G—SÒ&'WGFöâ ¢6Æ74æÖS×·7G–ÆW2ç&–Ö'”'WGFöçÐ¢öä6Æ–6³×²‚’Óâfö–Bf–æ—6„76WE7FGW56V7F–öâ‚vf–ææ6Rr—Ð¢F—6&ÆVC×¶—56f–æt76WE7FGW7Ð¢à¢¶—56f–æt76WE7FGW2òu6f–ærâââr¢tFöæRwÐ¢Âö'WGFöãà¢ÂöF—cà¢ÂöF—cà¢’¢çVÆÇÐ ¢¶76WE7FGW4VF—Ef–WrÓÓÒv–ç7W&æ6Rrò€¢ÆF—b6Æ74æÖS×·7G–ÆW2æ76WE7FGW4fö7W6VDf÷&×Óà¢ÆF—b6Æ74æÖS×·7G–ÆW2æ76WE7FGW4fö7W6VD†VFW'Óà¢Ç7G&öæsä–ç7W&æ6SÂ÷7G&öæsà¢ÂöF—cà ¢ÆF—b6Æ74æÖS×·7G–ÆW2æ76WE7FGW4VF—Dw&–GÓà¢ÄÖöFÅ6VÆV7CÄ76WE7FGW46†ö–6Sà¢Æ&VÃÒ$–ç7W&æ6R7FGW2 ¢fÇVS×¶76WE7FGW4G&gBæ–ç7W&æ6U7FGW7Ð¢÷F–öç3×µT”4µô”å5U$ä4Uõ5DEU5ôõD”ôå7Ð¢öä6†ævS×·6WD76WD–ç7W&æ6U7FGW7Ð¢6†÷tFW67&—F–öç3×¶fÇ6WÐ¢W6U÷'FÀ¢óà ¢¶76WE7FGW4G&gBæ–ç7W&æ6U7FGW2ÓÓÒw–W2rò€¢Ãà¢ÆÆ&VÂ6Æ74æÖS×·7G–ÆW2æf–VÆGÓà¢Ç7ãä–ç7W&VBÖ÷VçBW†6ÂâdBÇ6ÖÆÃâ†÷F–öæÂ“Â÷6ÖÆÃãÂ÷7ãà¢Æ–çW@¢G—SÒ'FW‡B ¢–çWDÖöFSÒ&çVÖW&–2 ¢fÇVS×¶76WE7FGW4G&gBæ–ç7W&VEfÇVTW…fGÐ¢öä6†ævS×²†WfVçB’Óâ†æFÆT–ç7W&VEfÇVT6†ævR†WfVçBçF&vWBçfÇVR—Ð¢Æ6V†öÆFW#Ò$÷F–öæÂ ¢óà¢ÂöÆ&VÃà ¢ÆÆ&VÂ6Æ74æÖS×·7G–ÆW2æf–VÆGÓà¢Ç7ãä–ç7W&W"æÖRÇ6ÖÆÃâ†÷F–öæÂ“Â÷6ÖÆÃãÂ÷7ãà¢Æ–çW@¢fÇVS×¶76WE7FGW4G&gBæ–ç7W&æ6T–ç7W&W$æÖWÐ¢öä6†ævS×²†WfVçB’ÓâWFFT76WE7FGW4G&gDf–VÆB‚v–ç7W&æ6T–ç7W&W$æÖRrÂWfVçBçF&vWBçfÇVR—Ð¢Æ6V†öÆFW#Ò$÷F–öæÂ ¢óà¢ÂöÆ&VÃà ¢ÆÆ&VÂ6Æ74æÖS×·7G–ÆW2æf–VÆGÓà¢Ç7ãåöÆ–7’çVÖ&W"Ç6ÖÆÃâ†÷F–öæÂ“Â÷6ÖÆÃãÂ÷7ãà¢Æ–çW@¢fÇVS×¶76WE7FGW4G&gBæ–ç7W&æ6UöÆ–7”çVÖ&W'Ð¢öä6†ævS×²†WfVçB’ÓâWFFT76WE7FGW4G&gDf–VÆB‚v–ç7W&æ6UöÆ–7”çVÖ&W"rÂWfVçBçF&vWBçfÇVR—Ð¢Æ6V†öÆFW#Ò$÷F–öæÂ ¢óà¢ÂöÆ&VÃà ¢ÆÆ&VÂ6Æ74æÖS×·7G–ÆW2æf–VÆGÓà¢Ç7ãå&VæWvÂòW‡—'’FFRÇ6ÖÆÃâ†÷F–öæÂ“Â÷6ÖÆÃãÂ÷7ãà¢Æ–çW@¢G—SÒ&FFR ¢fÇVS×¶76WE7FGW4G&gBæ–ç7W&æ6U&VæWvÄFFWÐ¢öä6†ævS×²†WfVçB’ÓâWFFT76WE7FGW4G&gDf–VÆB‚v–ç7W&æ6U&VæWvÄFFRrÂWfVçBçF&vWBçfÇVR—Ð¢óà¢ÂöÆ&VÃà ¢ÆÆ&VÂ6Æ74æÖS×¶G·7G–ÆW2æf–VÆGÒG·7G–ÆW2æ76WE7FGW5v–FTf–VÆGÖÓà¢Ç7ãä–ç7W&æ6Ræ÷FRÇ6ÖÆÃâ†÷F–öæÂ“Â÷6ÖÆÃãÂ÷7ãà¢ÇFW‡F&V¢fÇVS×¶76WE7FGW4G&gBæ–ç7W&æ6Tæ÷FWÐ¢öä6†ævS×²†WfVçB’ÓâWFFT76WE7FGW4G&gDf–VÆB‚v–ç7W&æ6Tæ÷FRrÂWfVçBçF&vWBçfÇVR—Ð¢Æ6V†öÆFW#Ò$÷F–öæÂ ¢&÷w3×³7Ð¢óà¢ÂöÆ&VÃà ¢ÆF—b6Æ74æÖS×¶G·7G–ÆW2æ76WE7FGW4Fö7VÖVçEWÆöGÒG·7G–ÆW2æ76WE7FGW5v–FTf–VÆGÖÓà¢ÆF—b6Æ74æÖS×·7G–ÆW2æ76WE7FGW4Fö7VÖVçEWÆöD6÷—Óà¢Ç7G&öæsä–ç7W&æ6RFö7VÖVçG3Â÷7G&öæsà¢Ç6ÖÆÃåöÆ–7’66†VGVÆW2Â6W'F–f–6FW2÷"6Æ–×2W'v÷&³Â÷6ÖÆÃà¢ÂöF—cà¢ÆÆ&VÂ6Æ74æÖS×¶G·7G–ÆW2ç6V6öæF'”'WGFöçÒG·7G–ÆW2æf–ÆU–6¶W$'WGFöçÒG·7G–ÆW2æ76WE7FGW4Fö7VÖVçE–6¶W'ÒG¶—5WÆöF–ætFö7VÖVçG2ÇÂÖçVÄG&gDFö7VÖVçD6÷VçBãÒÔ…ôDô5TÔTåE2ò7G–ÆW2æf–ÆU–6¶W$'WGFöäF—6&ÆVB¢rwÖÓà¢Ç7ãç¶—5WÆöF–ætFö7VÖVçG2òtFF–ærFö7VÖVçG2âââr¢tFB–ç7W&æ6RFö7VÖVçG2wÓÂ÷7ãà¢Æ–çW@¢G—SÒ&f–ÆR ¢×VÇF—ÆP¢6Æ74æÖS×·7G–ÆW2æf–ÆT–çWGÐ¢&–ÖÆ&VÃÒ$FB–ç7W&æ6RFö7VÖVçG2 ¢66WCÒ"çFbÂæFö2ÂæFö7‚Âç†Ç2Âç†Ç7‚Âæ77bÂçG‡BÂæ§rÂæ§VrÂçærÂçvV' ¢öä6†ævS×²†WfVçB’Óâ†æFÆTFö7VÖVçDf–ÆW56VÆV7FVB†WfVçBÂv–ç7W&æ6Rr—Ð¢F—6&ÆVC×¶—5WÆöF–ætFö7VÖVçG2ÇÂÖçVÄG&gDFö7VÖVçD6÷VçBãÒÔ…ôDô5TÔTåE7Ð¢óà¢ÂöÆ&VÃà¢Ç6ÖÆÂ6Æ74æÖS×·7G–ÆW2æ76WE7FGW4Fö7VÖVçD6÷VçGÓç¶ÖçVÄG&gDFö7VÖVçD6÷VçGÒò´Ô…ôDô5TÔTåE7ÒFö7VÖVçG3Â÷6ÖÆÃà¢ÂöF—cà¢Âóà¢’¢çVÆÇÐ¢ÂöF—cà ¢¶76WE7FGW4W'&÷"òÇ6Æ74æÖS×·7G–ÆW2æ76WE7FGW4W'&÷'Óç¶76WE7FGW4W'&÷'ÓÂ÷â¢çVÆÇÐ ¢ÆF—b6Æ74æÖS×·7G–ÆW2æ76WE7FGW57V$7F–öç7Óà¢Æ'WGFöà¢G—SÒ&'WGFöâ ¢6Æ74æÖS×·7G–ÆW2ç&–Ö'”'WGFöçÐ¢öä6Æ–6³×²‚’Óâfö–Bf–æ—6„76WE7FGW56V7F–öâ‚v–ç7W&æ6Rr—Ð¢F—6&ÆVC×¶—56f–æt76WE7FGW7Ð¢à¢¶—56f–æt76WE7FGW2òu6f–ærâââr¢tFöæRwÐ¢Âö'WGFöãà¢ÂöF—cà¢ÂöF—cà¢’¢çVÆÇÐ ¢¶76WE7FGW4VF—Ef–WrÓÓÒvÆ–6Vç6Rrbb76WDÆ–6Vç6TÆ–6&ÆRò€¢ÆF—b6Æ74æÖS×·7G–ÆW2æ76WE7FGW4fö7W6VDf÷&×Óà¢ÆF—b6Æ74æÖS×·7G–ÆW2æ76WE7FGW4fö7W6VD†VFW'Óà¢Ç7G&öæsäÆ–6Vç6SÂ÷7G&öæsà¢ÂöF—cà ¢ÆF—b6Æ74æÖS×·7G–ÆW2æ76WE7FGW4VF—Dw&–GÓà¢ÄÖöFÅ6VÆV7CÄ76WE7FGW46†ö–6Sà¢Æ&VÃÒ$Æ–6Vç6R7FGW2 ¢fÇVS×¶76WE7FGW4G&gBæÆ–6Vç6U7FGW7Ð¢÷F–öç3×µT”4µôÄ”4Tå4Uõ5DEU5ôõD”ôå7Ð¢öä6†ævS×·6WD76WDÆ–6Vç6U7FGW7Ð¢6†÷tFW67&—F–öç3×¶fÇ6WÐ¢W6U÷'FÀ¢óà ¢¶76WE7FGW4G&gBæÆ–6Vç6U7FGW2ÓÓÒw–W2rò€¢Ãà¢ÆÆ&VÂ6Æ74æÖS×·7G–ÆW2æf–VÆGÓà¢Ç7ãå&Vv—7G&F–öâçVÖ&W"Ç6ÖÆÃâ†÷F–öæÂ“Â÷6ÖÆÃãÂ÷7ãà¢Æ–çW@¢fÇVS×¶76WE7FGW4G&gBæÆ–6Vç6U&Vv—7G&F–öäçVÖ&W'Ð¢öä6†ævS×²†WfVçB’ÓâWFFT76WE7FGW4G&gDf–VÆB‚vÆ–6Vç6U&Vv—7G&F–öäçVÖ&W"rÂWfVçBçF&vWBçfÇVRçFõWW$66R‚’—Ð¢Æ6V†öÆFW#Ò$W†×ÆS¢4r#C# ¢óà¢ÂöÆ&VÃà ¢ÆÆ&VÂ6Æ74æÖS×·7G–ÆW2æf–VÆGÓà¢Ç7ãå&VæWvÂòW‡—'’FFRÇ6ÖÆÃâ†÷F–öæÂ“Â÷6ÖÆÃãÂ÷7ãà¢Æ–çW@¢G—SÒ&FFR ¢fÇVS×¶76WE7FGW4G&gBæÆ–6Vç6U&VæWvÄFFWÐ¢öä6†ævS×²†WfVçB’ÓâWFFT76WE7FGW4G&gDf–VÆB‚vÆ–6Vç6U&VæWvÄFFRrÂWfVçBçF&vWBçfÇVR—Ð¢óà¢ÂöÆ&VÃà ¢ÆÆ&VÂ6Æ74æÖS×¶G·7G–ÆW2æf–VÆGÒG·7G–ÆW2æ76WE7FGW5v–FTf–VÆGÖÓà¢Ç7ãäÆ–6Vç6Ræ÷FRÇ6ÖÆÃâ†÷F–öæÂ“Â÷6ÖÆÃãÂ÷7ãà¢ÇFW‡F&V¢fÇVS×¶76WE7FGW4G&gBæÆ–6Vç6Tæ÷FWÐ¢öä6†ævS×²†WfVçB’ÓâWFFT76WE7FGW4G&gDf–VÆB‚vÆ–6Vç6Tæ÷FRrÂWfVçBçF&vWBçfÇVR—Ð¢Æ6V†öÆFW#Ò$÷F–öæÂ ¢&÷w3×³7Ð¢óà¢ÂöÆ&VÃà ¢ÆF—b6Æ74æÖS×¶G·7G–ÆW2æ76WE7FGW4Fö7VÖVçEWÆöGÒG·7G–ÆW2æ76WE7FGW5v–FTf–VÆGÖÓà¢ÆF—b6Æ74æÖS×·7G–ÆW2æ76WE7FGW4Fö7VÖVçEWÆöD6÷—Óà¢Ç7G&öæsäÆ–6Væ6RFö7VÖVçG3Â÷7G&öæsà¢Ç6ÖÆÃä7W'&VçB÷"öÆFW"Æ–6Vç6–ærW'3Â÷6ÖÆÃà¢ÂöF—cà¢ÆÆ&VÂ6Æ74æÖS×¶G·7G–ÆW2ç6V6öæF'”'WGFöçÒG·7G–ÆW2æf–ÆU–6¶W$'WGFöçÒG·7G–ÆW2æ76WE7FGW4Fö7VÖVçE–6¶W'ÒG¶—5WÆöF–ætFö7VÖVçG2ÇÂÖçVÄG&gDFö7VÖVçD6÷VçBãÒÔ…ôDô5TÔTåE2ò7G–ÆW2æf–ÆU–6¶W$'WGFöäF—6&ÆVB¢rwÖÓà¢Ç7ãç¶—5WÆöF–ætFö7VÖVçG2òtFF–ærFö7VÖVçG2âââr¢tFBÆ–6Væ6RFö7VÖVçG2wÓÂ÷7ãà¢Æ–çW@¢G—SÒ&f–ÆR ¢×VÇF—ÆP¢6Æ74æÖS×·7G–ÆW2æf–ÆT–çWGÐ¢&–ÖÆ&VÃÒ$FBÆ–6Væ6RFö7VÖVçG2 ¢66WCÒ"çFbÂæFö2ÂæFö7‚Âæ§rÂæ§VrÂçærÂçvV' ¢öä6†ævS×²†WfVçB’Óâ†æFÆTFö7VÖVçDf–ÆW56VÆV7FVB†WfVçBÂvÆ–6Vç6–ærr—Ð¢F—6&ÆVC×¶—5WÆöF–ætFö7VÖVçG2ÇÂÖçVÄG&gDFö7VÖVçD6÷VçBãÒÔ…ôDô5TÔTåE7Ð¢óà¢ÂöÆ&VÃà¢Ç6ÖÆÂ6Æ74æÖS×·7G–ÆW2æ76WE7FGW4Fö7VÖVçD6÷VçGÓç¶ÖçVÄG&gDFö7VÖVçD6÷VçGÒò´Ô…ôDô5TÔTåE7ÒFö7VÖVçG3Â÷6ÖÆÃà¢ÂöF—cà¢Âóà¢’¢çVÆÇÐ¢ÂöF—cà ¢¶76WE7FGW4W'&÷"òÇ6Æ74æÖS×·7G–ÆW2æ76WE7FGW4W'&÷'Óç¶76WE7FGW4W'&÷'ÓÂ÷â¢çVÆÇÐ ¢ÆF—b6Æ74æÖS×·7G–ÆW2æ76WE7FGW57V$7F–öç7Óà¢Æ'WGFöà¢G—SÒ&'WGFöâ ¢6Æ74æÖS×·7G–ÆW2ç&–Ö'”'WGFöçÐ¢öä6Æ–6³×²‚’Óâfö–Bf–æ—6„76WE7FGW56V7F–öâ‚vÆ–6Vç6Rr—Ð¢F—6&ÆVC×¶—56f–æt76WE7FGW7Ð¢à¢¶—56f–æt76WE7FGW2òu6f–ærâââr¢tFöæRwÐ¢Âö'WGFöãà¢ÂöF—cà¢ÂöF—cà¢’¢çVÆÇÐ¢Â÷6V7F–öãà¢’¢çVÆÇÐ ¢¶ÖçVÄ76WE7FWÓÓÒBò€¢Ç6V7F–öâ6Æ74æÖS×¶G·7G–ÆW2æÖçVÅ7FvT6&GÒG·7G–ÆW2æÖçVÅ6–ævÆU7FvT6&GÒG·7G–ÆW2æÖçVÄ6ö×7E7FvT6&GÒG·7G–ÆW2æ76WEWFFU7FvT6&GÒG·7G–ÆW2ægVÆÅv–GF‡ÖÓà¢ÆF—b6Æ74æÖS×¶G·7G–ÆW2æÖçVÅ7FvTw&–GÒG·7G–ÆW2æÖçVÅWÆöDw&–GÖÓà¢ÆF—b6Æ74æÖS×·7G–ÆW2æf–VÆGÓà¢Ç7ãä÷F†W"Fö7VÖVçG3Â÷7ãà ¢ÆF—b6Æ74æÖS×·7G–ÆW2æFö7VÖVçEWÆöEæVÇÓà¢ÆF—b6Æ74æÖS×·7G–ÆW2çWÆöE&÷wÓà¢ÆÆ&VÀ¢6Æ74æÖS×¶G·7G–ÆW2ç6V6öæF'”'WGFöçÒG·7G–ÆW2æf–ÆU–6¶W$'WGFöçÒG¶—5WÆöF–ætFö7VÖVçG2ÇÂÖçVÄG&gDFö7VÖVçD6÷VçBãÒÔ…ôDô5TÔTåE2ò7G–ÆW2æf–ÆU–6¶W$'WGFöäF—6&ÆVB¢rwÖÐ¢à¢Ç7ãç¶—5WÆöF–ætFö7VÖVçG2òuWÆöF–ærâââr¢tFBFö7VÖVçG2wÓÂ÷7ãà¢Æ–çW@¢&Vc×¶Fö7VÖVçD–çWE&VgÐ¢G—SÒ&f–ÆR ¢66WCÒ"çFbÂæFö2ÂæFö7‚Âç†Ç2Âç†Ç7‚Âæ77bÂçG‡BÂæ§rÂæ§VrÂçærÂçvV'ÆÆ–6F–öâ÷FbÆÆ–6F–öâö×7v÷&BÆÆ–6F–öâ÷fæBæ÷Vç†ÖÆf÷&ÖG2Ööff–6VFö7VÖVçBçv÷&G&ö6W76–ævÖÂæFö7VÖVçBÆÆ–6F–öâ÷fæBæ×2ÖW†6VÂÆÆ–6F–öâ÷fæBæ÷Vç†ÖÆf÷&ÖG2Ööff–6VFö7VÖVçBç7&VG6†VWFÖÂç6†VWBÇFW‡Bö77bÇFW‡B÷Æ–âÆ–ÖvRö§VrÆ–ÖvR÷ærÆ–ÖvR÷vV' ¢×VÇF—ÆP¢6Æ74æÖS×·7G–ÆW2æf–ÆT–çWGÐ¢öä6†ævS×¶†æFÆTFö7VÖVçDf–ÆW56VÆV7FVGÐ¢F—6&ÆVC×¶—5WÆöF–ætFö7VÖVçG2ÇÂÖçVÄG&gDFö7VÖVçD6÷VçBãÒÔ…ôDô5TÔTåE7Ð¢óà¢ÂöÆ&VÃà ¢Ç7â6Æ74æÖS×·7G–ÆW2çWÆöD6÷VçGÓà¢¶ÖçVÄG&gDFö7VÖVçD6÷VçGÒò´Ô…ôDô5TÔTåE7Ð¢Â÷7ãà¢ÂöF—cà¢ÂöF—cà¢ÂöF—cà ¢ÆF—b6Æ74æÖS×·7G–ÆW2æf–VÆGÓà¢Ç7ãå†÷F÷3Â÷7ãà ¢ÆF—b6Æ74æÖS×·7G–ÆW2çWÆöEæVÇÓà¢ÆF—b6Æ74æÖS×·7G–ÆW2çWÆöE&÷wÓà¢ÆÆ&VÀ¢6Æ74æÖS×¶G·7G–ÆW2ç6V6öæF'”'WGFöçÒG·7G–ÆW2æf–ÆU–6¶W$'WGFöçÒG¶—5WÆöF–æu†÷F÷2ò7G–ÆW2æf–ÆU–6¶W$'WGFöäF—6&ÆVB¢rwÖÐ¢à¢Ç7ãç¶—5WÆöF–æu†÷F÷2òuWÆöF–ærâââr¢ÖçVÄG&gE†÷Fô6÷VçBãÒÔ…õ„õDõ2òtFBò&WÆ6R†÷F÷2r¢tFB†÷F÷2wÓÂ÷7ãà¢Æ–çW@¢&Vc×·†÷Fô–çWE&VgÐ¢G—SÒ&f–ÆR ¢66WCÒ&–ÖvRö§VrÆ–ÖvR÷ærÆ–ÖvR÷vV' ¢×VÇF—ÆP¢6Æ74æÖS×·7G–ÆW2æf–ÆT–çWGÐ¢öä6†ævS×¶†æFÆU†÷Fôf–ÆW56VÆV7FVGÐ¢F—6&ÆVC×¶—5WÆöF–æu†÷F÷7Ð¢óà¢ÂöÆ&VÃà ¢Ç7â6Æ74æÖS×·7G–ÆW2çWÆöD6÷VçGÓà¢¶ÖçVÄG&gE†÷Fô6÷VçGÒò´Ô…õ„õDõ7Ð¢Â÷7ãà¢ÂöF—cà¢ÂöF—cà¢ÂöF—cà¢ÂöF—cà ¢¶76WDG&gBæFö7VÖVçG2æÆVæwF‚ò€¢ÆF—b6Æ74æÖS×·7G–ÆW2æFö7VÖVçDG&gDÆ—7GÓà¢¶76WDG&gBæFö7VÖVçG2æÖ‚†Fö7VÖVçBÂFö7VÖVçD–æFW‚’Óâ€¢ÆF—b6Æ74æÖS×·7G–ÆW2æFö7VÖVçDG&gE&÷wÒ¶W“×¶Fö7VÖVçBæ–GÓà¢Ç7â6Æ74æÖS×·7G–ÆW2æFö7VÖVçDG&gD–6öçÓà¢ÄFö7VÖVçD–6öâ6Æ74æÖS×·7G–ÆW2æ'WGFöä–6öçÒóà¢Â÷7ãà¢ÆF—cà¢Ç7G&öæsç¶F—7Æ”Fö7VÖVçDæÖR†Fö7VÖVçBæf–ÆTæÖRÂFö7VÖVçD–æFW‚—ÓÂ÷7G&öæsà¢Ç6ÖÆÃç¶76WDFö7VÖVçD6FVv÷'”Æ&VÂ†Fö7VÖVçBæ6FVv÷'’—Ò+r¶f÷&ÖD'—FU6—¦R†Fö7VÖVçBæ'—FU6—¦R—ÓÂ÷6ÖÆÃà¢ÂöF—cà¢Æ'WGFöà¢G—SÒ&'WGFöâ ¢6Æ74æÖS×·7G–ÆW2æFö7VÖVçD÷VäÆ–æ·Ð¢öä6Æ–6³×²‚’Óâ²fö–B÷Vä76WDFö7VÖVçB†Fö7VÖVçB“²×Ð¢à¢÷Và¢Âö'WGFöãà¢Æ'WGFöâG—SÒ&'WGFöâ"6Æ74æÖS×·7G–ÆW2æFö7VÖVçE&VÖ÷fT'WGFöçÒöä6Æ–6³×²‚’Óâ&VÖ÷fTG&gDFö7VÖVçB†Fö7VÖVçBæ–B—Óà¢&VÖ÷fP¢Âö'WGFöãà¢ÂöF—cà¢’—Ð¢ÂöF—cà¢’¢çVÆÇÐ  ¢·VæF–ætFö7VÖVçDf–ÆW2æÆVæwF‚ò€¢ÆF—b6Æ74æÖS×·7G–ÆW2æFö7VÖVçDG&gDÆ—7GÓà¢·VæF–ætFö7VÖVçDf–ÆW2æÖ‚†f–ÆRÂ–æFW‚’Óâ€¢ÆF—b6Æ74æÖS×¶G·7G–ÆW2æFö7VÖVçDG&gE&÷wÒG·7G–ÆW2çVæF–ætG&gE&÷wÖÒ¶W“×¶G¶f–ÆRææÖWÒÒG¶f–ÆRç6—¦WÒÒG¶–æFW‡ÖÓà¢Ç7â6Æ74æÖS×·7G–ÆW2æFö7VÖVçDG&gD–6öçÓà¢ÄFö7VÖVçD–6öâ6Æ74æÖS×·7G–ÆW2æ'WGFöä–6öçÒóà¢Â÷7ãà¢ÆF—cà¢Ç7G&öæsç·6†÷'DFö7VÖVçDæÖR†f–ÆRææÖR—ÓÂ÷7G&öæsà¢Ç6ÖÆÃå&VG’FòWÆöB+r¶f÷&ÖD'—FU6—¦R†f–ÆRç6—¦R—ÓÂ÷6ÖÆÃà¢ÂöF—cà¢Æ'WGFöâG—SÒ&'WGFöâ"6Æ74æÖS×·7G–ÆW2æFö7VÖVçE&VÖ÷fT'WGFöçÒöä6Æ–6³×²‚’Óâ&VÖ÷fUVæF–ætFö7VÖVçDf–ÆR†–æFW‚—Óà¢&VÖ÷fP¢Âö'WGFöãà¢ÂöF—cà¢’—Ð¢ÂöF—cà¢’¢çVÆÇÐ ¢¶G&gE†÷Fô—FV×2æÆVæwF‚ò€¢ÆF—b6Æ74æÖS×·7G–ÆW2ç†÷FôG&gE6V7F–öçÓà¢ÆF—b6Æ74æÖS×·7G–ÆW2ç†÷FôÖ–ä†VÇÓà¢Ç7G&öæsäÖ–â†÷FóÂ÷7G&öæsà¢Ç7ãåF†Rf—'7B†÷Fò&VÆ÷r—2W6VBf—'7BöâF†R76WB6&BÂDg2æBÖ&¶WGÆ6RÆ—7F–ærãÂ÷7ãà¢ÂöF—cà ¢ÆF—b6Æ74æÖS×·7G–ÆW2ç†÷Fôw&–GÓà¢¶G&gE†÷Fô—FV×2æÖ‚‡†÷Fô—FVÒÂ–æFW‚’Óâ€¢ÆF—`¢6Æ74æÖS×¶G·7G–ÆW2ç†÷FõF‡VÖ'ÒG·†÷Fô—FVÒæ—4Ö–âò7G–ÆW2ç†÷FõF‡VÖ$Ö–â¢rwÒG·†÷Fô—FVÒç6÷W&6RÓÓÒwVæF–ærrò7G–ÆW2çVæF–æu†÷FõF‡VÖ"¢rwÖÐ¢¶W“×·†÷Fô—FVÒæ¶W—Ð¢à¢ÆF—b6Æ74æÖS×·7G–ÆW2ç†÷FõF‡VÖ$ÖVF–Óà¢Æ–Öp¢7&3×·†÷Fô—FVÒç&Wf–WuW&ÂÇÂdÄÄ$4µô54UEô”ÔtWÐ¢ÇC×·†÷Fô—FVÒæ—4Ö–âòtÖ–â76WB†÷Fòr¢76WB†÷FòG¶–æFW‚²ÖÐ¢óà¢·†÷Fô—FVÒæ—4Ö–âòÇ7â6Æ74æÖS×·7G–ÆW2ç†÷FôÖ–ä&FvWÓäÖ–â†÷FóÂ÷7ãâ¢çVÆÇÐ¢·†÷Fô—FVÒç6÷W&6RÓÓÒwVæF–ærròÇ7â6Æ74æÖS×·7G–ÆW2ç†÷FõVæF–æt&FvWÓå&VG“Â÷7ãâ¢çVÆÇÐ¢ÂöF—cà ¢ÆF—b6Æ74æÖS×·7G–ÆW2ç†÷FõF‡VÖ$7F–öç7Óà¢Æ'WGFöà¢G—SÒ&'WGFöâ ¢6Æ74æÖS×¶G·7G–ÆW2ç†÷FôÖ¶TÖ–ä'WGFöçÒG·†÷Fô—FVÒæ—4Ö–âò7G–ÆW2ç†÷FôÖ¶TÖ–ä'WGFöä7F—fR¢rwÖÐ¢öä6Æ–6³×²‚’Óâ6VÆV7DÖ–äG&gE†÷Fò‡†÷Fô—FVÒ—Ð¢F—6&ÆVC×·†÷Fô—FVÒæ—4Ö–çÐ¢à¢·†÷Fô—FVÒæ—4Ö–âòtÖ–âr¢tÖ¶RÖ–âwÐ¢Âö'WGFöãà ¢Æ'WGFöà¢G—SÒ&'WGFöâ ¢6Æ74æÖS×·7G–ÆW2ç†÷Fõ&VÖ÷fT'WGFöçÐ¢öä6Æ–6³×²‚’Óà¢†÷Fô—FVÒç6÷W&6RÓÓÒw6fVBrbb†÷Fô—FVÒçW&À¢ò&VÖ÷fTG&gE†÷Fò‡†÷Fô—FVÒçW&Â¢¢†÷Fô—FVÒçVæF–æt–@¢ò&VÖ÷fUVæF–æu†÷Fôf–ÆR‡†÷Fô—FVÒçVæF–æt–B¢¢VæFVf–æV@¢Ð¢à¢&VÖ÷fP¢Âö'WGFöãà¢ÂöF—cà¢ÂöF—cà¢’—Ð¢ÂöF—cà¢ÂöF—cà¢’¢çVÆÇÐ¢Â÷6V7F–öãà¢’¢çVÆÇÐ ¢Âöf÷&Óà¢ÂöF—cà ¢¶ÖçVÄ76WE7FWâbb—476WE7FGW4fö7W6VEf–Wrò€¢ÆF—b6Æ74æÖS×·7G–ÆW2æ76WEWFFTfö÷FW'Óà¢Ç7à¢6Æ74æÖS×¶G·7G–ÆW2æ76WEWFFU6fUFW‡GÒG¶VF—F–æt76WBbb76WDWF÷6fU7FFRÓÓÒvW'&÷"rò7G–ÆW2æ76WEWFFU6fUFW‡DW'&÷"¢rwÖÐ¢&öÆSÒ'7FGW2 ¢&–ÖÆ—fSÒ'öÆ—FR ¢à¢¶VF—F–æt76WBò76WDWF÷6fTÆ&VÂ¢u6fVBv†Vâ–÷Rf–æ—6‚wÐ¢Â÷7ãà ¢ÆF—b6Æ74æÖS×·7G–ÆW2æ76WEWFFTfö÷FW$7F–öç7Óà¢²†VF—F–æt76WBbbÖçVÄ76WE7FWâ"’ÇÂ‚VF—F–æt76WBbbÖçVÄ76WE7FWâ’ò€¢Æ'WGFöà¢G—SÒ&'WGFöâ ¢6Æ74æÖS×·7G–ÆW2ç6V6öæF'”'WGFöçÐ¢öä6Æ–6³×¶võFõ&Wf–÷W4ÖçVÄ76WE7FWÐ¢F—6&ÆVC×¶—476WDWF÷6fT'W7—Ð¢à¢&6°¢Âö'WGFöãà¢’¢çVÆÇÐ ¢¶ÖçVÄ76WE7FWÂBò€¢Æ'WGFöà¢G—SÒ&'WGFöâ ¢6Æ74æÖS×·7G–ÆW2ç&–Ö'”'WGFöçÐ¢öä6Æ–6³×¶võFôæW‡DÖçVÄ76WE7FWÐ¢à¢æW‡@¢Âö'WGFöãà¢’¢€¢Æ'WGFöà¢G—SÒ&'WGFöâ ¢6Æ74æÖS×·7G–ÆW2ç&–Ö'”'WGFöçÐ¢öä6Æ–6³×¶VF—F–æt76WBò6Æ÷6T76WDÖöFÂ¢‚’Óâfö–B†æFÆT76WE7V&Ö—B‚—Ð¢F—6&ÆVC×°¢VF—F–æt76W@¢ò—476WDWF÷6fT'W7’ÇÂ76WDWF÷6fU7FFRÓÓÒvW'&÷"p¢¢—56f–æt76WBÇÂ—5WÆöF–æu†÷F÷2ÇÂ—5WÆöF–ætFö7VÖVçG0¢Ð¢à¢¶VF—F–æt76W@¢ò—476WDWF÷6fT'W7¢òu6f–ærâââp¢¢tFöæRp¢¢—56f–æt76W@¢òu6f–ærâââp¢¢ÖçVÅ7FW&–Ö'”Æ&VÇÐ¢Âö'WGFöãà¢—Ð¢ÂöF—cà¢ÂöF—cà¢’¢çVÆÇÐ¢ÂöF—cà¢ÂöF—cà¢’¢çVÆÇÐ ¢¶—476WE6WGF–æw4ÖöFÄ÷VâbbVF—F–æt76WBò€¢ÆF—b6Æ74æÖS×¶G·7G–ÆW2æÖöFÄ÷fW&Æ—ÒG·7G–ÆW2æ76WE6WGF–æw4÷fW&Æ—ÖÓà¢ÆF—b6Æ74æÖS×·7G–ÆW2æÖöFÄ&6¶G&÷Òöä6Æ–6³×¶6Æ÷6T76WE6WGF–æw4ÖöFÇÒóà ¢ÆF—`¢6Æ74æÖS×¶G·7G–ÆW2æÖöFÄ6&GÒG·7G–ÆW2æ76WE6WGF–æw4ÖöFÇÒG¶76WE6WGF–æw5f–WrÓÒvÖVçRrò7G–ÆW2æ76WE6WGF–æw57V$ÖöFÂ¢rwÒG¶76WE6WGF–æw5f–WrÓÓÒvÆö6F–öârò7G–ÆW2æ76WE6WGF–æw4Æö6F–öäÖöFÂ¢rwÒG¶76WE6WGF–æw5f–WrÓÓÒvÆö6F–öäÖrò7G–ÆW2æ76WE6WGF–æw4ÖÖöFÂ¢rwÖÐ¢&öÆSÒ&F–Æör ¢&–ÖÖöFÃÒ'G'VR ¢&–ÖÆ&VÆÆVF'“Ò&76WB×6WGF–æw2×F—FÆR ¢à¢ÆF—b6Æ74æÖS×¶G·7G–ÆW2æÖöFÄ†VFW'ÒG·7G–ÆW2æ76WE6WGF–æw4†VFW'ÖÓà¢ÆF—b6Æ74æÖS×·7G–ÆW2æÖöFÄ†VFW%FW‡GÓà¢Æƒ2–CÒ&76WB×6WGF–æw2×F—FÆR#å6WGF–æw3Âöƒ3à¢Çç¶VF—F–æt76WBçF—FÆWÓÂ÷à¢ÂöF—cà ¢Æ'WGFöà¢G—SÒ&'WGFöâ ¢6Æ74æÖS×·7G–ÆW2æÖöFÄ6Æ÷6T'WGFöçÐ¢öä6Æ–6³×¶6Æ÷6T76WE6WGF–æw4ÖöFÇÐ¢&–ÖÆ&VÃÒ$6Æ÷6R6WGF–æw2 ¢F—6&ÆVC×¶—476WE6WGF–æw4'W7—Ð¢à¢Ä6Æ÷6T–6öâ6Æ74æÖS×·7G–ÆW2æ'WGFöä–6öçÒóà¢Âö'WGFöãà¢ÂöF—cà ¢ÆF—b6Æ74æÖS×¶G·7G–ÆW2æÖöFÅ67&öÆÄ&öG—ÒG·7G–ÆW2æ76WE6WGF–æw4&öG—ÖÓà¢¶76WE6WGF–æw5f–WrÓÒvÖVçRrò€¢Æ'WGFöà¢G—SÒ&'WGFöâ ¢6Æ74æÖS×·7G–ÆW2æ76WE6WGF–æw4&6´'WGFöçÐ¢öä6Æ–6³×¶vô&6´g&öÔ76WE6WGF–æw57V%f–WwÐ¢F—6&ÆVC×¶—476WE6WGF–æw4'W7—Ð¢à¢Ç7â&–Ö†–FFVãÒ'G'VR#î(iÂ÷7ãà¢Ç7ãç¶76WE6WGF–æw5f–WrÓÓÒvÆö6F–öäÖçVÂrÇÂ76WE6WGF–æw5f–WrÓÓÒvÆö6F–öäÖròt&6²FòÆö6F–öâr¢t&6²Fò6WGF–æw2wÓÂ÷7ãà¢Âö'WGFöãà¢’¢çVÆÇÐ ¢¶76WE6WGF–æw5f–WrÓÓÒvÖVçRrò€¢ÆF—b6Æ74æÖS×¶G·7G–ÆW2æ76WE6WGF–æw4ÖVçTw&–GÒG¶—56fVDÖçVÄ76WB†VF—F–æt76WB’ò7G–ÆW2æ76WE6WGF–æw4ÖVçTw&–DÖçVÂ¢rwÖÓà¢Æ'WGFöà¢G—SÒ&'WGFöâ ¢6Æ74æÖS×·7G–ÆW2æ76WE6WGF–æw4÷F–öä'WGFöçÐ¢öä6Æ–6³×¶÷Vä76WE6WGF–æw4Æö6F–öåf–WwÐ¢F—6&ÆVC×¶—476WE6WGF–æw4'W7—Ð¢à¢ÄfÆt–6öâ6Æ74æÖS×·7G–ÆW2æ76WE6WGF–æw4÷F–öä–6öçÒóà¢Ç7ãà¢Ç7G&öæsäÆö6F–öãÂ÷7G&öæsà¢Ç6ÖÆÃåWFFRu2÷6—F–öâãÂ÷6ÖÆÃà¢Â÷7ãà¢Âö'WGFöãà ¢¶—56fVDÖçVÄ76WB†VF—F–æt76WB’ò€¢Ãà¢Æ'WGFöà¢G—SÒ&'WGFöâ ¢6Æ74æÖS×·7G–ÆW2æ76WE6WGF–æw4÷F–öä'WGFöçÐ¢öä6Æ–6³×¶÷Vä76WE6WGF–æw5G—Uf–WwÐ¢F—6&ÆVC×¶—476WE6WGF–æw4'W7—Ð¢à¢Ä÷F–öç4–6öâ6Æ74æÖS×·7G–ÆW2æ76WE6WGF–æw4÷F–öä–6öçÒóà¢Ç7ãà¢Ç7G&öæsäWV—ÖVçBG—SÂ÷7G&öæsà¢Ç6ÖÆÃä6†ævRF†—2ÖçVÂ76WN(	—26FVv÷'’ãÂ÷6ÖÆÃà¢Â÷7ãà¢Âö'WGFöãà ¢Æ'WGFöà¢G—SÒ&'WGFöâ ¢6Æ74æÖS×·7G–ÆW2æ76WE6WGF–æw4÷F–öä'WGFöçÐ¢öä6Æ–6³×¶÷Vä76WE6WGF–æw46öçfW'6–öåf–WwÐ¢F—6&ÆVC×¶—476WE6WGF–æw4'W7—Ð¢à¢ÅG&VæD–6öâ6Æ74æÖS×·7G–ÆW2æ76WE6WGF–æw4÷F–öä–6öçÒóà¢Ç7ãà¢Ç7G&öæsä–ÓG&–6RfÇVF–öãÂ÷7G&öæsà¢Ç6ÖÆÃå'Vââ–ÓG&–6RfÇVF–öâãÂ÷6ÖÆÃà¢Â÷7ãà¢Âö'WGFöãà¢Âóà¢’¢çVÆÇÐ ¢¶—56fVD–ÓG&–6T76WB†VF—F–æt76WB’ò€¢Æ'WGFöà¢G—SÒ&'WGFöâ ¢6Æ74æÖS×·7G–ÆW2æ76WE6WGF–æw4÷F–öä'WGFöçÐ¢öä6Æ–6³×¶÷Vä76WE6WGF–æw5W6vUf–WwÐ¢F—6&ÆVC×¶—476WE6WGF–æw4'W7—Ð¢à¢ÄÖævT–6öâ6Æ74æÖS×·7G–ÆW2æ76WE6WGF–æw4÷F–öä–6öçÒóà¢Ç7ãà¢Ç7G&öæsäÆ–fWF–ÖRW‡V7Fæ7“Â÷7G&öæsà¢Ç6ÖÆÃä÷fW'&–FRÆ–fWF–ÖRW6vRãÂ÷6ÖÆÃà¢Â÷7ãà¢Âö'WGFöãà¢’¢çVÆÇÐ¢ÂöF—cà¢’¢çVÆÇÐ ¢¶76WE6WGF–æw5f–WrÓÓÒvÆö6F–öârò€¢Ç6V7F–öâ6Æ74æÖS×¶G·7G–ÆW2æ76WE6WGF–æw56V7F–öçÒG·7G–ÆW2æ76WE6WGF–æw4Æö6F–öå6V7F–öçÖÓà¢ÆF—b6Æ74æÖS×·7G–ÆW2æ76WE6WGF–æw56V7F–öä6÷—Óà¢Ç7ãäÆö6F–öãÂ÷7ãà¢ÆƒCåWFFR76WBÆö6F–öãÂöƒCà¢Çä6†ö÷6RF†RV6–W7Bv’Fò6fRv†W&RF†—276WB—2¶WBãÂ÷à¢ÂöF—cà ¢ÆF—b6Æ74æÖS×·7G–ÆW2æ76WE6WGF–æw4Æö6F–öä7W'&VçGÓà¢ÆF—b6Æ74æÖS×·7G–ÆW2æ76WE6WGF–æw4Æö6F–öä7W'&VçDÖ–çÓà¢Ç7â6Æ74æÖS×·7G–ÆW2æ76WE6WGF–æw4Æö6F–öä7W'&VçD–6öçÒ&–Ö†–FFVãÒ'G'VR#à¢ÄfÆt–6öâ6Æ74æÖS×·7G–ÆW2æ'WGFöä–6öçÒóà¢Â÷7ãà ¢ÆF—b6Æ74æÖS×·7G–ÆW2æ76WE6WGF–æw4Æö6F–öä7W'&VçD6÷—Óà¢Ç7ãä7W'&VçBÆö6F–öãÂ÷7ãà¢Ç7G&öæsà¢¶76WE6WGF–æw4Æö6F–öåFW‡BÇÂ††476WDw46ö÷&F–æFW2†VF—F–æt76WB’òf÷&ÖD76WE6WGF–æw4w5÷6—F–öâ†VF—F–æt76WB’¢tæòÆö6F–öâ6fVBr—Ð¢Â÷7G&öæsà¢ÂöF—cà ¢¶76WE6WGF–æw4Ö5W&Âò€¢Æ6Æ74æÖS×·7G–ÆW2æ76WE6WGF–æw4ÖÆ–æ·Ò‡&Vc×¶76WE6WGF–æw4Ö5W&ÇÒF&vWCÒ%ö&Ææ²"&VÃÒ&æ÷&VfW'&W"#à¢f–WrÖ ¢Âöà¢’¢çVÆÇÐ¢ÂöF—cà ¢ÆF—b6Æ74æÖS×·7G–ÆW2æ76WE6WGF–æw4Æö6F–öä7W'&VçDÖWFÓà¢ÆF—cà¢Ç7ãäÆ7BWFFVCÂ÷7ãà¢Ç7G&öæsç¶f÷&ÖD76WE6WGF–æw4Æ7E66ææVB†VF—F–æt76WB—ÓÂ÷7G&öæsà¢ÂöF—cà¢ÆF—cà¢Ç7ãäu2÷6—F–öãÂ÷7ãà¢Ç7G&öæsç¶f÷&ÖD76WE6WGF–æw4w5÷6—F–öâ†VF—F–æt76WB—ÓÂ÷7G&öæsà¢ÂöF—cà¢ÂöF—cà¢ÂöF—cà ¢ÆF—b6Æ74æÖS×·7G–ÆW2æ76WE6WGF–æw4Æö6F–öä6†ö–6Tw&–GÓà¢Æ'WGFöà¢G—SÒ&'WGFöâ ¢6Æ74æÖS×¶G·7G–ÆW2æ76WE6WGF–æw4÷F–öä'WGFöçÒG·7G–ÆW2æ76WE6WGF–æw4Æö6F–öå&–Ö'”6†ö–6WÖÐ¢öä6Æ–6³×²‚’Óâfö–BWFFT76WE6WGF–æw4w5÷6—F–öâ‚—Ð¢F—6&ÆVC×¶—476WE6WGF–æw4'W7—Ð¢à¢Å&Vg&W6„–6öâ6Æ74æÖS×·7G–ÆW2æ76WE6WGF–æw4÷F–öä–6öçÒóà¢Ç7ãà¢Ç7â6Æ74æÖS×·7G–ÆW2æ76WE6WGF–æw5&V6öÖÖVæFVD&FvWÓå&V6öÖÖVæFVCÂ÷7ãà¢Ç7G&öæsç¶76WE6WGF–æw4FWf–6Tw4'WGFöäÆ&VÇÓÂ÷7G&öæsà¢Ç6ÖÆÃå6fRF†—2FWf–6^(	—27W'&VçBu2÷6—F–öâãÂ÷6ÖÆÃà¢Â÷7ãà¢Âö'WGFöãà ¢Æ'WGFöà¢G—SÒ&'WGFöâ ¢6Æ74æÖS×·7G–ÆW2æ76WE6WGF–æw4÷F–öä'WGFöçÐ¢öä6Æ–6³×¶÷Vä76WE6WGF–æw4ÖçVÄÆö6F–öåf–WwÐ¢F—6&ÆVC×¶—476WE6WGF–æw4'W7—Ð¢à¢ÄFö7VÖVçD–6öâ6Æ74æÖS×·7G–ÆW2æ76WE6WGF–æw4÷F–öä–6öçÒóà¢Ç7ãà¢Ç7G&öæsäVçFW"6ö÷&F–æFW3Â÷7G&öæsà¢Ç6ÖÆÃå7FR6fVBu2÷6—F–öâãÂ÷6ÖÆÃà¢Â÷7ãà¢Âö'WGFöãà ¢Æ'WGFöà¢G—SÒ&'WGFöâ ¢6Æ74æÖS×·7G–ÆW2æ76WE6WGF–æw4÷F–öä'WGFöçÐ¢öä6Æ–6³×¶÷Vä76WE6WGF–æw4ÖÆö6F–öåf–WwÐ¢F—6&ÆVC×¶—476WE6WGF–æw4'W7—Ð¢à¢ÄfÆt–6öâ6Æ74æÖS×·7G–ÆW2æ76WE6WGF–æw4÷F–öä–6öçÒóà¢Ç7ãà¢Ç7G&öæsä6†ö÷6RöâÖÂ÷7G&öæsà¢Ç6ÖÆÃäG&÷æBF§W7BÖ–âãÂ÷6ÖÆÃà¢Â÷7ãà¢Âö'WGFöãà¢ÂöF—cà ¢¶76WE6WGF–æw4Æö6F–öå7V66W72òÇ6Æ74æÖS×·7G–ÆW2æ76WE6WGF–æw4Æö6F–öå7V66W77Óç¶76WE6WGF–æw4Æö6F–öå7V66W77ÓÂ÷â¢çVÆÇÐ¢¶76WE6WGF–æw4Æö6F–öäW'&÷"òÇ6Æ74æÖS×·7G–ÆW2æ76WE6WGF–æw4W'&÷'Óç¶76WE6WGF–æw4Æö6F–öäW'&÷'ÓÂ÷â¢çVÆÇÐ¢Â÷6V7F–öãà¢’¢çVÆÇÐ ¢¶76WE6WGF–æw5f–WrÓÓÒvÆö6F–öäÖçVÂrò€¢Ç6V7F–öâ6Æ74æÖS×¶G·7G–ÆW2æ76WE6WGF–æw56V7F–öçÒG·7G–ÆW2æ76WE6WGF–æw4Æö6F–öå6V7F–öçÖÓà¢ÆF—b6Æ74æÖS×·7G–ÆW2æ76WE6WGF–æw56V7F–öä6÷—Óà¢Ç7ãäÖçVÂÆö6F–öãÂ÷7ãà¢ÆƒCäVçFW"u26ö÷&F–æFW3ÂöƒCà¢Çå7FR6ö÷&F–æFW2g&öÒvöövÆRÖ2Â÷"G—RF†RÆF—GVFRæBÆöæv—GVFR&VÆ÷rãÂ÷à¢ÂöF—cà ¢ÆF—b6Æ74æÖS×·7G–ÆW2æ76WE6WGF–æw46ö÷&F–æFTw&–GÓà¢ÆÆ&VÂ6Æ74æÖS×·7G–ÆW2æ76WE6WGF–æw4f–VÆGÓà¢Ç7ãäÆF—GVFSÂ÷7ãà¢Æ–çW@¢G—SÒ'FW‡B ¢–çWDÖöFSÒ&FV6–ÖÂ ¢fÇVS×¶76WE6WGF–æw4ÖçVÄÆD–çWGÐ¢öä6†ævS×²†WfVçB’Óâ°¢6WD76WE6WGF–æw4ÖçVÄÆD–çWB†WfVçBçF&vWBçfÇVR“°¢6ÆV$76WE6WGF–æw4Æö6F–öäfVVF&6²‚“°¢×Ð¢öå7FS×²†WfVçB’Óâ°¢6öç7B7FVEFW‡BÒWfVçBæ6Æ—&ö&DFFævWDFF‚wFW‡Br“°¢–b†Ç”76WE6WGF–æw46ö÷&F–æFU—"‡7FVEFW‡B’’°¢WfVçBç&WfVçDFVfVÇB‚“°¢Ð¢×Ð¢Æ6V†öÆFW#Ò"Ó32ã“#Cƒc’ ¢óà¢ÂöÆ&VÃà ¢ÆÆ&VÂ6Æ74æÖS×·7G–ÆW2æ76WE6WGF–æw4f–VÆGÓà¢Ç7ãäÆöæv—GVFSÂ÷7ãà¢Æ–çW@¢G—SÒ'FW‡B ¢–çWDÖöFSÒ&FV6–ÖÂ ¢fÇVS×¶76WE6WGF–æw4ÖçVÄÆæt–çWGÐ¢öä6†ævS×²†WfVçB’Óâ°¢6WD76WE6WGF–æw4ÖçVÄÆæt–çWB†WfVçBçF&vWBçfÇVR“°¢6ÆV$76WE6WGF–æw4Æö6F–öäfVVF&6²‚“°¢×Ð¢Æ6V†öÆFW#Ò#‚ãC#CSR ¢óà¢ÂöÆ&VÃà¢ÂöF—cà ¢ÆÆ&VÂ6Æ74æÖS×·7G–ÆW2æ76WE6WGF–æw4f–VÆGÓà¢Ç7ãä÷F–öæÂÆö6F–öâæ÷FSÂ÷7ãà¢ÇFW‡F&V¢&÷w3×³'Ð¢fÇVS×¶76WE6WGF–æw4ÖçVÄÆö6F–öåFW‡GÐ¢öä6†ævS×²†WfVçB’Óâ°¢6WD76WE6WGF–æw4ÖçVÄÆö6F–öåFW‡B†WfVçBçF&vWBçfÇVRç6Æ–6RƒÂÔ…ô54UEõ4UED”äu5ôÄô4D”ôåõDU…EôÄTäuD‚’“°¢6ÆV$76WE6WGF–æw4Æö6F–öäfVVF&6²‚“°¢×Ð¢Æ6V†öÆFW#Ò$W†×ÆS¢Ö–â6†VBÂæ÷'F‚6×Â6Æ–VçB–&B ¢óà¢ÂöÆ&VÃà ¢Ç6Æ74æÖS×·7G–ÆW2æ76WE6WGF–æw4f–VÆEF—ÓåF—¢–÷R6â6÷’6ö÷&F–æFW2g&öÒvöövÆRÖ2æB7FRF†VÒ†W&RãÂ÷à ¢ÆF—b6Æ74æÖS×·7G–ÆW2æ76WE6WGF–æw47F–öç7Óà¢Æ'WGFöà¢G—SÒ&'WGFöâ ¢6Æ74æÖS×·7G–ÆW2ç&–Ö'”'WGFöçÐ¢öä6Æ–6³×²‚’Óâfö–B6fT76WE6WGF–æw4ÖçVÄw5÷6—F–öâ‚—Ð¢F—6&ÆVC×¶—476WE6WGF–æw4'W7—Ð¢à¢¶76WE6WGF–æw4ÖçVÄw4'WGFöäÆ&VÇÐ¢Âö'WGFöãà¢ÂöF—cà ¢¶76WE6WGF–æw4Æö6F–öå7V66W72òÇ6Æ74æÖS×·7G–ÆW2æ76WE6WGF–æw4Æö6F–öå7V66W77Óç¶76WE6WGF–æw4Æö6F–öå7V66W77ÓÂ÷â¢çVÆÇÐ¢¶76WE6WGF–æw4Æö6F–öäW'&÷"òÇ6Æ74æÖS×·7G–ÆW2æ76WE6WGF–æw4W'&÷'Óç¶76WE6WGF–æw4Æö6F–öäW'&÷'ÓÂ÷â¢çVÆÇÐ¢Â÷6V7F–öãà¢’¢çVÆÇÐ ¢¶76WE6WGF–æw5f–WrÓÓÒvÆö6F–öäÖrò€¢Ç6V7F–öâ6Æ74æÖS×¶G·7G–ÆW2æ76WE6WGF–æw56V7F–öçÒG·7G–ÆW2æ76WE6WGF–æw4Æö6F–öå6V7F–öçÖÓà¢ÆF—b6Æ74æÖS×·7G–ÆW2æ76WE6WGF–æw56V7F–öä6÷—Óà¢Ç7ãäÖÂ÷7ãà¢ÆƒCäG&÷u2–ãÂöƒCà¢Çä6Æ–6²÷"FF†RÖFòÆ6RF†R76WB÷6—F–öââG&rF†RÖ&¶W"Fòf–æR×GVæRF†R6ö÷&F–æFW2ãÂ÷à¢ÂöF—cà ¢ÆF—b6Æ74æÖS×·7G–ÆW2æ76WE6WGF–æw4Ö6†VÆÇÓà¢ÆF—b&Vc×¶76WE6WGF–æw4ÖVÆVÖVçE&VgÒ6Æ74æÖS×·7G–ÆW2æ76WE6WGF–æw4Ö6çf7Ò&–ÖÆ&VÃÒ$76WBÆö6F–öâÖ"óà¢ÆF—b6Æ74æÖS×·7G–ÆW2æ76WE6WGF–æw4Ö6VÆV7FVDw&–GÓà¢ÆF—cà¢Ç7ãå6VÆV7FVBÆF—GVFSÂ÷7ãà¢Ç7G&öæsç¶76WE6WGF–æw4ÖÆD–çWBÇÂtæò–â6VÆV7FVBwÓÂ÷7G&öæsà¢ÂöF—cà¢ÆF—cà¢Ç7ãå6VÆV7FVBÆöæv—GVFSÂ÷7ãà¢Ç7G&öæsç¶76WE6WGF–æw4ÖÆæt–çWBÇÂtæò–â6VÆV7FVBwÓÂ÷7G&öæsà¢ÂöF—cà¢ÂöF—cà¢ÂöF—cà ¢ÆÆ&VÂ6Æ74æÖS×·7G–ÆW2æ76WE6WGF–æw4f–VÆGÓà¢Ç7ãä÷F–öæÂÆö6F–öâæ÷FSÂ÷7ãà¢ÇFW‡F&V¢&÷w3×³'Ð¢fÇVS×¶76WE6WGF–æw4ÖÆö6F–öåFW‡GÐ¢öä6†ævS×²†WfVçB’Óâ°¢6WD76WE6WGF–æw4ÖÆö6F–öåFW‡B†WfVçBçF&vWBçfÇVRç6Æ–6RƒÂÔ…ô54UEõ4UED”äu5ôÄô4D”ôåõDU…EôÄTäuD‚’“°¢6ÆV$76WE6WGF–æw4Æö6F–öäfVVF&6²‚“°¢×Ð¢Æ6V†öÆFW#Ò$W†×ÆS¢Ö–â6†VBÂæ÷'F‚6×Â6Æ–VçB–&B ¢óà¢ÂöÆ&VÃà ¢ÆF—b6Æ74æÖS×·7G–ÆW2æ76WE6WGF–æw47F–öç7Óà¢Æ'WGFöà¢G—SÒ&'WGFöâ ¢6Æ74æÖS×·7G–ÆW2ç&–Ö'”'WGFöçÐ¢öä6Æ–6³×²‚’Óâfö–B6fT76WE6WGF–æw4Öw5÷6—F–öâ‚—Ð¢F—6&ÆVC×¶—476WE6WGF–æw4'W7—Ð¢à¢¶76WE6WGF–æw4Öw4'WGFöäÆ&VÇÐ¢Âö'WGFöãà¢ÂöF—cà ¢¶76WE6WGF–æw4Æö6F–öå7V66W72òÇ6Æ74æÖS×·7G–ÆW2æ76WE6WGF–æw4Æö6F–öå7V66W77Óç¶76WE6WGF–æw4Æö6F–öå7V66W77ÓÂ÷â¢çVÆÇÐ¢¶76WE6WGF–æw4Æö6F–öäW'&÷"òÇ6Æ74æÖS×·7G–ÆW2æ76WE6WGF–æw4W'&÷'Óç¶76WE6WGF–æw4Æö6F–öäW'&÷'ÓÂ÷â¢çVÆÇÐ¢Â÷6V7F–öãà¢’¢çVÆÇÐ ¢¶76WE6WGF–æw5f–WrÓÓÒwG—Rrbb—56fVDÖçVÄ76WB†VF—F–æt76WB’ò€¢Ç6V7F–öâ6Æ74æÖS×·7G–ÆW2æ76WE6WGF–æw56V7F–öçÓà¢ÆF—b6Æ74æÖS×·7G–ÆW2æ76WE6WGF–æw56V7F–öä6÷—Óà¢Ç7ãäÖçVÂ76WCÂ÷7ãà¢ÆƒCäWV—ÖVçBG—SÂöƒCà¢Çä6†ævRF†R6fVBG—RöâF†—26ÖR76WB&V6÷&BâW†—7F–ærfÇVW2Âf–ÆW2Âæ÷FW2Âf–ææ6RæB–ç7W&æ6RFWF–Ç2&R&W6W'fVBâÆ–6Væ6RFWF–Ç2&RöæÇ’¶WBf÷"æöâ×&÷W'G’76WG2ãÂ÷à¢ÂöF—cà ¢ÄÖöFÅ6VÆV7CÄ76WD¶–æCà¢Æ&VÃÒ$76WBG—R ¢fÇVS×¶76WE6WGF–æw5G—TG&gGÐ¢÷F–öç3×´ÔåTÅô54UEõE•UôõD”ôå7Ð¢öä6†ævS×·6WD76WE6WGF–æw5G—TG&gGÐ¢6Æ74æÖS×·7G–ÆW2æ76WE6WGF–æw56VÆV7Df–VÆGÐ¢W6U÷'FÀ¢óà ¢ÆF—b6Æ74æÖS×·7G–ÆW2æ76WE6WGF–æw47F–öç7Óà¢Æ'WGFöà¢G—SÒ&'WGFöâ ¢6Æ74æÖS×·7G–ÆW2ç&–Ö'”'WGFöçÐ¢öä6Æ–6³×²‚’Óâfö–B6fTÖçVÄ76WEG—U6WGF–ær‚—Ð¢F—6&ÆVC×¶—476WE6WGF–æw4'W7’ÇÂ76WE6WGF–æw5G—TG&gBÓÓÒVF—F–æt76WBæ¶–æGÐ¢à¢¶—56f–æt76WE6WGF–æw2òu6f–ærâââr¢u6fRG—RwÐ¢Âö'WGFöãà¢ÂöF—cà¢Â÷6V7F–öãà¢’¢çVÆÇÐ ¢¶76WE6WGF–æw5f–WrÓÓÒv6öçfW'6–öârbb—56fVDÖçVÄ76WB†VF—F–æt76WB’ò€¢Ç6V7F–öâ6Æ74æÖS×·7G–ÆW2æ76WE6WGF–æw56V7F–öçÓà¢ÆF—b6Æ74æÖS×·7G–ÆW2æ76WE6WGF–æw56V7F–öä6÷—Óà¢Ç7ãä6öçfW'6–öãÂ÷7ãà¢ÆƒCä–ÓG&–6RfÇVF–öãÂöƒCà¢Çä6ö×ÆWFRæ÷&ÖÂ–ÓG&–6RW7F–ÖFRâF†RÖçVÂ76WB—2öæÇ’6†ævVBgFW"F†Rf–æÂ6fR7V66VVG2ãÂ÷à¢ÂöF—cà ¢ÆF—b6Æ74æÖS×·7G–ÆW2æ76WE6WGF–æw47F–öç7Óà¢Æ'WGFöà¢G—SÒ&'WGFöâ ¢6Æ74æÖS×·7G–ÆW2æ76WE6WGF–æw46öçfW'6–öä'WGFöçÐ¢öä6Æ–6³×·7F'DÖçVÄ76WD6öçfW'6–öçÐ¢F—6&ÆVC×¶—476WE6WGF–æw4'W7—Ð¢à¢7F'B–ÓG&–6R6öçfW'6–öà¢Âö'WGFöãà¢ÂöF—cà¢Â÷6V7F–öãà¢’¢çVÆÇÐ ¢¶76WE6WGF–æw5f–WrÓÓÒwW6vRrbb—56fVD–ÓG&–6T76WB†VF—F–æt76WB’ò€¢Ç6V7F–öâ6Æ74æÖS×¶G·7G–ÆW2æ76WE6WGF–æw56V7F–öçÒG·7G–ÆW2æ76WE6WGF–æw5W6vU6V7F–öçÖÓà¢ÆF—b6Æ74æÖS×·7G–ÆW2æ76WE6WGF–æw56V7F–öä6÷—Óà¢Ç7ãäÆ–fWF–ÖRW‡V7Fæ7“Â÷7ãà¢ÆƒCç¶76WE6WGF–æw5W6vT†VF–ær‡6WGF–æw5W6vTÖöFR—ÓÂöƒCà¢Çç´54UEõ4UED”äu5õU4tUô4õ—ÓÂ÷à¢ÂöF—cà ¢·6WGF–æw5W6vTÖöFRÓÒvæöæRrò€¢Ãà¢ÆF—b6Æ74æÖS×·7G–ÆW2æ76WE6WGF–æw5W6vT6ö×&—6öçÓà¢ÆF—b6Æ74æÖS×·7G–ÆW2æ76WE6WGF–æw5W6vT7W'&VçGÓà¢Ç7ãä7W'&VçFÇ’6fVCÂ÷7ãà¢Ç7G&öæsç¶f÷&ÖD76WE6WGF–æw5W6vTF—7Æ’‡6WGF–æw5W6vTÖöFRÂ6WGF–æw5W6vT7W'&VçEfÇVR—ÓÂ÷7G&öæsà¢ÂöF—cà ¢Ç7â6Æ74æÖS×·7G–ÆW2æ76WE6WGF–æw5W6vT'&÷wÒ&–Ö†–FFVãÒ'G'VR#î(i#Â÷7ãà ¢ÆÆ&VÂ6Æ74æÖS×¶G·7G–ÆW2æ76WE6WGF–æw4f–VÆGÒG·7G–ÆW2æ76WE6WGF–æw5W6vTf–VÆGÖÓà¢Ç7ãç¶76WE6WGF–æw5W6vT–çWDÆ&VÂ‡6WGF–æw5W6vTÖöFR—ÓÂ÷7ãà¢·6WGF–æw5W6vTÖöFRÓÓÒwW&6VçBrò€¢Æ–çW@¢G—SÒ&çVÖ&W" ¢Ö–ãÒ# ¢ÖƒÒ# ¢7FWÒ#ã ¢fÇVS×¶76WE6WGF–æw5W6vT–çWGÐ¢öä6†ævS×²†WfVçB’Óâ°¢6WD76WE6WGF–æw5W6vT–çWB†WfVçBçF&vWBçfÇVR“°¢6WD76WE6WGF–æw4W'&÷"‚rr“°¢×Ð¢Æ6V†öÆFW#×¶76WE6WGF–æw5W6vUÆ6V†öÆFW"‡6WGF–æw5W6vTÖöFRÂ6WGF–æw5W6vT7W'&VçEfÇVR—Ð¢óà¢’¢€¢Æ–çW@¢G—SÒ'FW‡B ¢–çWDÖöFSÒ&çVÖW&–2 ¢fÇVS×¶76WE6WGF–æw5W6vT–çWGÐ¢öä6†ævS×²†WfVçB’Óâ°¢6WD76WE6WGF–æw5W6vT–çWB†f÷&ÖEW6vTÖ÷VçD–çWB†WfVçBçF&vWBçfÇVR’“°¢6WD76WE6WGF–æw4W'&÷"‚rr“°¢×Ð¢Æ6V†öÆFW#×¶76WE6WGF–æw5W6vUÆ6V†öÆFW"‡6WGF–æw5W6vTÖöFRÂ6WGF–æw5W6vT7W'&VçEfÇVR—Ð¢óà¢—Ð¢ÂöÆ&VÃà¢ÂöF—cà ¢Ç6Æ74æÖS×·7G–ÆW2æ76WE6WGF–æw5W6vT†–çGÓä6†æv–ærF†—2&VF–ærÖ’ffV7BF†R76WN(	—2fÇVF–öâ†—7F÷'’ãÂ÷à ¢ÆF—b6Æ74æÖS×·7G–ÆW2æ76WE6WGF–æw47F–öç7Óà¢Æ'WGFöà¢G—SÒ&'WGFöâ ¢6Æ74æÖS×·7G–ÆW2ç&–Ö'”'WGFöçÐ¢öä6Æ–6³×·&WVW7D–ÓG&–6UW6vT÷fW'&–FU6WGF–æwÐ¢F—6&ÆVC×¶—476WE6WGF–æw4'W7—Ð¢à¢¶—56f–æt76WE6WGF–æw2òu6f–ærâââr¢u&Wf–Wr6†ævRwÐ¢Âö'WGFöãà¢ÂöF—cà¢Âóà¢’¢€¢ÆF—b6Æ74æÖS×·7G–ÆW2æ76WE6WGF–æw4F—6&ÆVDæ÷FWÓà¢F†—276WBFöW2æ÷B†fR6fVBW6vRf–VÆBFò÷fW'&–FRà¢ÂöF—cà¢—Ð¢Â÷6V7F–öãà¢’¢çVÆÇÐ ¢¶76WE6WGF–æw4W'&÷"òÇ6Æ74æÖS×·7G–ÆW2æ76WE6WGF–æw4W'&÷'Óç¶76WE6WGF–æw4W'&÷'ÓÂ÷â¢çVÆÇÐ¢ÂöF—cà¢ÂöF—cà¢ÂöF—cà¢’¢çVÆÇÐ ¢·VæF–æuW6vT÷fW'&–FRbbVF—F–æt76WBò€¢ÆF—b6Æ74æÖS×¶G·7G–ÆW2æÖöFÄ÷fW&Æ—ÒG·7G–ÆW2æ76WE6WGF–æw46öæf—&Ô÷fW&Æ—ÖÓà¢ÆF—b6Æ74æÖS×·7G–ÆW2æÖöFÄ&6¶G&÷Òöä6Æ–6³×¶6æ6VÄ–ÓG&–6UW6vT÷fW'&–FT6öæf—&ÖF–öçÒóà ¢ÆF—`¢6Æ74æÖS×¶G·7G–ÆW2æÖöFÄ6&GÒG·7G–ÆW2æ76WE6WGF–æw46öæf—&ÔÖöFÇÖÐ¢&öÆSÒ&F–Æör ¢&–ÖÖöFÃÒ'G'VR ¢&–ÖÆ&VÆÆVF'“Ò&76WB×W6vRÖ÷fW'&–FRÖ6öæf—&Ò×F—FÆR ¢à¢ÆF—b6Æ74æÖS×¶G·7G–ÆW2æÖöFÄ†VFW'ÒG·7G–ÆW2æ76WE6WGF–æw4†VFW'ÖÓà¢ÆF—b6Æ74æÖS×·7G–ÆW2æÖöFÄ†VFW%FW‡GÓà¢Æƒ2–CÒ&76WB×W6vRÖ÷fW'&–FRÖ6öæf—&Ò×F—FÆR#å6fRW6vR÷fW'&–FSóÂöƒ3à¢Çç¶VF—F–æt76WBçF—FÆWÓÂ÷à¢ÂöF—cà ¢Æ'WGFöà¢G—SÒ&'WGFöâ ¢6Æ74æÖS×·7G–ÆW2æÖöFÄ6Æ÷6T'WGFöçÐ¢öä6Æ–6³×¶6æ6VÄ–ÓG&–6UW6vT÷fW'&–FT6öæf—&ÖF–öçÐ¢&–ÖÆ&VÃÒ$6Æ÷6RW6vR÷fW'&–FR6öæf—&ÖF–öâ ¢F—6&ÆVC×¶—56f–æt76WE6WGF–æw7Ð¢à¢Ä6Æ÷6T–6öâ6Æ74æÖS×·7G–ÆW2æ'WGFöä–6öçÒóà¢Âö'WGFöãà¢ÂöF—cà ¢ÆF—b6Æ74æÖS×¶G·7G–ÆW2æÖöFÅ67&öÆÄ&öG—ÒG·7G–ÆW2æ76WE6WGF–æw4&öG—ÖÓà¢Ç6Æ74æÖS×·7G–ÆW2æ76WE6WGF–æw46öæf—&Ô6÷—ÓçµU4tUôõdU%$”DUô4ôäd•$ÔD”ôåõDU…GÓÂ÷à ¢ÆF—b6Æ74æÖS×·7G–ÆW2æ76WE6WGF–æw47F–öç7Óà¢Æ'WGFöâG—SÒ&'WGFöâ"6Æ74æÖS×·7G–ÆW2ç6V6öæF'”'WGFöçÒöä6Æ–6³×¶6æ6VÄ–ÓG&–6UW6vT÷fW'&–FT6öæf—&ÖF–öçÒF—6&ÆVC×¶—56f–æt76WE6WGF–æw7Óà¢6æ6VÀ¢Âö'WGFöãà¢Æ'WGFöâG—SÒ&'WGFöâ"6Æ74æÖS×·7G–ÆW2ç&–Ö'”'WGFöçÒöä6Æ–6³×²‚’Óâfö–B6öæf—&Ô–ÓG&–6UW6vT÷fW'&–FU6WGF–ær‚—ÒF—6&ÆVC×¶—56f–æt76WE6WGF–æw7Óà¢¶—56f–æt76WE6WGF–æw2òu6f–ærâââr¢u6fR÷fW'&–FRwÐ¢Âö'WGFöãà¢ÂöF—cà¢ÂöF—cà¢ÂöF—cà¢ÂöF—cà¢’¢çVÆÇÐ ¢¶—4ÖçVÄ6öçfW'6–öä6öæf—&Ô÷VâbbVF—F–æt76WBò€¢ÆF—b6Æ74æÖS×¶G·7G–ÆW2æÖöFÄ÷fW&Æ—ÒG·7G–ÆW2æ76WE6WGF–æw46öæf—&Ô÷fW&Æ—ÖÓà¢ÆF—b6Æ74æÖS×·7G–ÆW2æÖöFÄ&6¶G&÷Òöä6Æ–6³×²‚’Óâ6WD—4ÖçVÄ6öçfW'6–öä6öæf—&Ô÷Vâ†fÇ6R—Òóà ¢ÆF—`¢6Æ74æÖS×¶G·7G–ÆW2æÖöFÄ6&GÒG·7G–ÆW2æ76WE6WGF–æw46öæf—&ÔÖöFÇÖÐ¢&öÆSÒ&F–Æör ¢&–ÖÖöFÃÒ'G'VR ¢&–ÖÆ&VÆÆVF'“Ò&76WBÖ6öçfW'6–öâÖ6öæf—&Ò×F—FÆR ¢à¢ÆF—b6Æ74æÖS×¶G·7G–ÆW2æÖöFÄ†VFW'ÒG·7G–ÆW2æ76WE6WGF–æw4†VFW'ÖÓà¢ÆF—b6Æ74æÖS×·7G–ÆW2æÖöFÄ†VFW%FW‡GÓà¢Æƒ2–CÒ&76WBÖ6öçfW'6–öâÖ6öæf—&Ò×F—FÆR#ä6öçfW'BÖçVÂ76WCóÂöƒ3à¢Çç¶VF—F–æt76WBçF—FÆWÓÂ÷à¢ÂöF—cà ¢Æ'WGFöà¢G—SÒ&'WGFöâ ¢6Æ74æÖS×·7G–ÆW2æÖöFÄ6Æ÷6T'WGFöçÐ¢öä6Æ–6³×²‚’Óâ6WD—4ÖçVÄ6öçfW'6–öä6öæf—&Ô÷Vâ†fÇ6R—Ð¢&–ÖÆ&VÃÒ$6Æ÷6R6öçfW'6–öâ6öæf—&ÖF–öâ ¢à¢Ä6Æ÷6T–6öâ6Æ74æÖS×·7G–ÆW2æ'WGFöä–6öçÒóà¢Âö'WGFöãà¢ÂöF—cà ¢ÆF—b6Æ74æÖS×¶G·7G–ÆW2æÖöFÅ67&öÆÄ&öG—ÒG·7G–ÆW2æ76WE6WGF–æw4&öG—ÖÓà¢Ç6Æ74æÖS×·7G–ÆW2æ76WE6WGF–æw46öæf—&Ô6÷—Óà¢F†R7W'&VçBÖçVÂ76WBv–ÆÂ7F’Væ6†ævVBv†–ÆR–÷R6ö×ÆWFRF†RW7F–ÖFRâ—Bv–ÆÂöæÇ’&V6öÖRâ–ÓG&–6RfÇVVB76WBgFW"–÷R6Æ–6²6fRöâF†Rf–æÂ&W7VÇBvRà¢Â÷à ¢ÆF—b6Æ74æÖS×·7G–ÆW2æ76WE6WGF–æw47F–öç7Óà¢Æ'WGFöâG—SÒ&'WGFöâ"6Æ74æÖS×·7G–ÆW2ç6V6öæF'”'WGFöçÒöä6Æ–6³×²‚’Óâ6WD—4ÖçVÄ6öçfW'6–öä6öæf—&Ô÷Vâ†fÇ6R—Óà¢6æ6VÀ¢Âö'WGFöãà¢Æ'WGFöâG—SÒ&'WGFöâ"6Æ74æÖS×·7G–ÆW2ç&–Ö'”'WGFöçÒöä6Æ–6³×¶6öæf—&ÔÖçVÄ76WD6öçfW'6–öçÓà¢6öçF–çVRFòW7F–ÖFP¢Âö'WGFöãà¢ÂöF—cà¢ÂöF—cà¢ÂöF—cà¢ÂöF—cà¢’¢çVÆÇÐ ¢¶—5V÷FTÖöFÄ÷Vâò€¢ÆF—b6Æ74æÖS×·7G–ÆW2æÖöFÄ÷fW&Æ—Óà¢ÆF—b6Æ74æÖS×·7G–ÆW2æÖöFÄ&6¶G&÷Òöä6Æ–6³×¶6Æ÷6T76WEV÷FTÖöFÇÒóà ¢ÆF—`¢6Æ74æÖS×¶G·7G–ÆW2æ÷F–öç4ÖöFÇÒG·7G–ÆW2æ76WEV÷FTÖöFÇÒG²6VÆV7FVEV÷FT÷F–öâbb76WE6†&TFW7F–æF–öâÓÓÒv6†ö–6Rrò7G–ÆW2æ76WE6†&TFW7F–æF–öäÖöFÂ¢rwÒG²6VÆV7FVEV÷FT÷F–öâbb76WE6†&TFW7F–æF–öâÓÓÒv–ç6–FRrò7G–ÆW2æ76WE6†&T–ç6–FTÖöFÂ¢rwÒG²6VÆV7FVEV÷FT÷F–öâbb76WE6†&TFW7F–æF–öâÓÓÒv÷WG6–FRrò7G–ÆW2æW‡FW&æÄ76WE6†&TÖöFÂ¢rwÒG·6VÆV7FVEV÷FT÷F–öâbbV÷FTF—&V7F÷'•7FvRÓÓÒvÖrò7G–ÆW2æ76WEV÷FU'FæW%–6¶W$ÖöFÂ¢rwÒG·6VÆV7FVEV÷FT÷F–öâbbV÷FTF—&V7F÷'•7FvRÓÓÒvÆö6F–öârò7G–ÆW2æ76WEV÷FTÆö6F–öå–6¶W$ÖöFÂ¢rwÒG¶—5V÷FTÖW‡æFVBò7G–ÆW2æ76WEV÷FTÖW‡æFVDÖöFÂ¢rwÖÐ¢&öÆSÒ&F–Æör ¢&–ÖÖöFÃÒ'G'VR ¢&–Ö†–FFVã×¶W‡FW&æÅ6†&U&W÷'E66÷RÓÓÒv76WBròG'VR¢VæFVf–æVGÐ¢&–ÖÆ&VÆÆVF'“Ò&76WB×V÷FR×F—FÆR ¢à¢ÆF—b6Æ74æÖS×¶G·7G–ÆW2æÖöFÄ†VFW'ÒG·7G–ÆW2æ÷F–öç4ÖöFÄ†VFW'ÒG·7G–ÆW2æ76WEV÷FTÖöFÄ†VFW'ÖÓà¢ÆF—b6Æ74æÖS×·7G–ÆW2æÖöFÄ†VFW%FW‡GÓà¢Æƒ2–CÒ&76WB×V÷FR×F—FÆR"F$–æFWƒ×²ÓÓç·6VÆV7FVEV÷FT÷F–öà¢òV÷FTF—&V7F÷'•7FvRÓÓÒvÆö6F–öâròuv†W&RFò–÷RæVVB†VÇòr¢6VÆV7FVEV÷FT÷F–öâæÖF—FÆP¢¢76WE6†&TFW7F–æF–öâÓÓÒv–ç6–FRp¢òu6†&R–ç6–FR–ÓG&–6Rp¢¢76WE6†&TFW7F–æF–öâÓÓÒv÷WG6–FRp¢òu6†&R÷WG6–FR–ÓG&–6Rp¢¢6†&RG·V÷FT76WCòçF—FÆRÇÂv76WBwÖÓÂöƒ3à¢²6VÆV7FVEV÷FT÷F–öâò€¢Çç¶76WE6†&TFW7F–æF–öâÓÓÒv6†ö–6Rp¢òt6†ö÷6Rv†W&RFò6†&RF†—276WBâp¢¢76WE6†&TFW7F–æF–öâÓÓÒv÷WG6–FRp¢òu&Wf–WrF†RÖW76vRÂ6†ö÷6Rç’GF6†ÖVçG2ÂF†Vâ6VæB—Böæ6RF‡&÷Vv‚v†G4÷"VÖ–Ââp¢¢V÷FT76WBòG¶'V–ÆD76WDÖWF‡V÷FT76WB—Ò+rG¶ÖöæW’‡V÷FT76WBçfÇVR—ÒW†6ÂâdF¢rwÓÂ÷à¢’¢V÷FTF—&V7F÷'•7FvRÓÓÒvÆö6F–öârò€¢Çä6†ö÷6Râ&Vf—'7BâvRv–ÆÂ÷VâF†RÖF†W&RæB6†÷ræV&'’7F—fR'FæW'2&Vf÷&R–ÓG&–6R76—7Fæ6RÆ—7F–æw2ãÂ÷à¢’¢—4gVÆÅ&Vv—7FW%V÷FTÆVBò€¢6VÆV7FVEV÷FT÷F–öâæÆVEG—RÓÓÒw&WÆ6VÖVçE÷V÷FRrÇÂ6VÆV7FVEV÷FT÷F–öâæÆVEG—RÓÓÒvÆ–6Vç6U÷&VæWvÂrò€¢Çç¶—476WDw&÷W6†&P¢òG·6VÆV7FVDFVÆW%6†&T76WD–G2æÆVæwF‡Òw&÷WVB76WG2–âG¶7F—fU6†&TæÖWÖ ¢¢G·6VÆV7FVDFVÆW%6†&T76WD–G2æÆVæwF‡Ò76WG26VÆV7FVFÓÂ÷à¢’¢€¢Çäöæ6RÖöfb¶7F—fU6†&TæÖWÒ6æ6†÷B+r¶7F—fU6†&T76WG2æÆVæwF‡Ò¶7F—fU6†&T76WG2æÆVæwF‚ÓÓÒòv76WBr¢v76WG2wÒ+r¶ÖöæW’†7F—fU6†&UfÇVR—ÒW†6ÂâdCÂ÷à¢¢’¢çVÆÇÐ¢ÂöF—cà ¢Æ'WGFöà¢G—SÒ&'WGFöâ ¢6Æ74æÖS×·7G–ÆW2æÖöFÄ6Æ÷6T'WGFöçÐ¢öä6Æ–6³×¶6Æ÷6T76WEV÷FTÖöFÇÐ¢&–ÖÆ&VÃÒ$6Æ÷6R76WB÷F–öç2 ¢F—6&ÆVC×¶—56VæF–æuV÷FTÆVGÐ¢à¢Ä6Æ÷6T–6öâ6Æ74æÖS×·7G–ÆW2æ'WGFöä–6öçÒóà¢Âö'WGFöãà¢ÂöF—cà ¢ÆF—b6Æ74æÖS×¶G·7G–ÆW2æÖöFÅ67&öÆÄ&öG—ÒG·7G–ÆW2æ÷F–öç567&öÆÄ&öG—ÒG·7G–ÆW2æ76WEV÷FU67&öÆÄ&öG—ÖÓà¢²6VÆV7FVEV÷FT÷F–öâò€¢76WE6†&TFW7F–æF–öâÓÓÒv6†ö–6Rrò€¢Ä76WE6†&TFW7F–æF–öå–6¶W ¢öä–ç6–FS×²‚’Óâ6WD76WE6†&TFW7F–æF–öâ‚v–ç6–FRr—Ð¢öä÷WG6–FS×²‚’Óâ6WD76WE6†&TFW7F–æF–öâ‚v÷WG6–FRr—Ð¢F—6&ÆVC×¶—56VæF–æuV÷FTÆVGÐ¢óà¢’¢76WE6†&TFW7F–æF–öâÓÓÒv÷WG6–FRrò€¢Ä76WDW‡FW&æÅ6†&P¢6†&TæÖS×·V÷FT76WCòçF—FÆRÇÂt–ÓG&–6R76WBwÐ¢76WG3×·V÷FTW‡FW&æÅ6†&T76WG7Ð¢&W÷'Df–ÆW3×¶W‡FW&æÅ6†&U&W÷'Df–ÆW7Ð¢öäFD–ÓG&–6U&W÷'C×¶÷Vä76WE6†&U&W÷'G7Ð¢öå&VÖ÷fT–ÓG&–6U&W÷'C×·&VÖ÷fTW‡FW&æÅ6†&U&W÷'GÐ¢óà¢’¢€¢ÆF—b6Æ74æÖS×·7G–ÆW2æ76WE6†&T–ç6–FTfÆ÷wÓà¢ÆF—b6Æ74æÖS×·7G–ÆW2æ÷F–öç46öçFVçGÓà¢ÆF—b6Æ74æÖS×¶G·7G–ÆW2æ÷F–öç4w&–GÒG·7G–ÆW2æ76WD÷F–öç4w&–GÒG·7G–ÆW2æ76WEV÷FT6†ö–6Tw&–GÖÓà¢¶f–Æ&ÆT76WEV÷FT÷F–öç2æÖ‚†÷F–öâ’Óâ°¢6öç7BæVVG4Æ–6Væ6U&VæWvÄFFRÒ÷F–öâæÆVEG—RÓÓÒvÆ–6Vç6U÷&VæWvÂrbb&ööÆVâ‡V÷FT76WB’bb€¢&VDÆ–6Vç6U7FGW46†ö–6R‡V÷FT76WB’ÓÒw–W2p¢ÇÂ&VE7V75FW‡B‡V÷FT76WBÂ²vÆ–6Vç6U&VæWvÄFFRrÂvÆ–6Vç6U÷&VæWvÅöFFRrÂvÆ–6Væ6U&VæWvÄFFRrÂvÆ–6Væ6U÷&VæWvÅöFFRuÒ¢“°¢&WGW&â€¢Æ'WGFöà¢¶W“×¶÷F–öâæÆVEG—WÐ¢G—SÒ&'WGFöâ ¢6Æ74æÖS×¶G·7G–ÆW2æ÷F–öä7F–öä'WGFöçÒG·7G–ÆW2æ76WEV÷FT6†ö–6T6&GÒG·V÷FUFöæT6Æ74f÷$ÆVEG—R†÷F–öâæÆVEG—R—ÖÐ¢öä6Æ–6³×²‚’Óâ÷VåV÷FU'FæW%–6¶W"†÷F–öâæÆVEG—R—Ð¢à¢Ç7â6Æ74æÖS×·7G–ÆW2æ76WEV÷FT6†ö–6T–6öåF–ÆWÓà¢·&VæFW%V÷FT÷F–öä–6öâ†÷F–öâæÆVEG—RÂ7G–ÆW2æ76WEV÷FT6†ö–6T–6öâ—Ð¢Â÷7ãà¢Ç7â6Æ74æÖS×·7G–ÆW2æ76WEV÷FT6†ö–6UFW‡GÓà¢Ç7G&öæsç¶÷F–öâçF—FÆWÓÂ÷7G&öæsà¢Ç6ÖÆÃà¢Ç7ãç¶æVVG4Æ–6Væ6U&VæWvÄFFRòtFB&VæWvÂFFR&Vf÷&R6†&–ærâr¢÷F–öâæFW67&—F–öçÓÂ÷7ãà¢Â÷6ÖÆÃà¢Â÷7ãà¢Âö'WGFöãà¢“°¢Ò—Ð¢ÂöF—cà¢ÂöF—cà ¢ÂöF—cà¢¢’¢V÷FTF—&V7F÷'•7FvRÓÓÒvÆö6F–öârò€¢ÆF—b6Æ74æÖS×·7G–ÆW2æ76WEV÷FTÆö6F–öå7FvWÓà¢Ç6V7F–öâ6Æ74æÖS×·7G–ÆW2æ76WEV÷FTÆö6F–öä6&GÒ&–ÖÆ&VÆÆVF'“Ò&76WB×V÷FRÖÆö6F–öâÖ†VF–ær#à¢Ç7â6Æ74æÖS×·7G–ÆW2æ76WEV÷FTÆö6F–öä–6öçÒ&–Ö†–FFVãÒ'G'VR#à¢Å6V&6„–6öâ6Æ74æÖS×·7G–ÆW2æ'WGFöä–6öçÒóà¢Â÷7ãà ¢ÆF—b6Æ74æÖS×·7G–ÆW2æ76WEV÷FTÆö6F–öä6÷—Óà¢ÆƒB–CÒ&76WB×V÷FRÖÆö6F–öâÖ†VF–ær#å7F'Bv—F‚–÷W"F÷vâ÷"&VÂöƒCà¢ÇåF†—2¶VW2F†RÖ7FVG’æBÆöG2öæÇ’F†R'FæW'2æB–ÓG&–6R6W'f–6R&V2æV"–÷RãÂ÷à¢ÂöF—cà ¢Æf÷&Ò6Æ74æÖS×·7G–ÆW2æ76WEV÷FTÆö6F–öäf÷&×Òöå7V&Ö—C×·7V&Ö—EV÷FTÆö6F–öçÓà¢ÆÆ&VÂ‡FÖÄf÷#Ò&76WB×V÷FRÖÆö6F–öâÖ–çWB#åF÷vâÂ6—G’÷"&÷f–æ6SÂöÆ&VÃà¢Æ–çW@¢–CÒ&76WB×V÷FRÖÆö6F–öâÖ–çWB ¢6Æ74æÖS×·7G–ÆW2æ76WEV÷FTÆö6F–öä–çWGÐ¢fÇVS×·V÷FTÆö6F–öä–çWGÐ¢öä6†ævS×²†WfVçB’Óâ°¢6WEV÷FTÆö6F–öä–çWB†WfVçBçF&vWBçfÇVR“°¢–b‡V÷FTÆö6F–öäW'&÷"’6WEV÷FTÆö6F–öäW'&÷"‚rr“°¢×Ð¢Æ6V†öÆFW#Ò&Rærâ¦ö†ææW6'W&r÷"æ÷'F†W&â6R ¢Æ—7CÒ&76WB×V÷FRÖÆö6F–öâÖ÷F–öç2 ¢WFô6ö×ÆWFSÒ&FG&W72ÖÆWfVÃ" ¢WFôfö7W0¢&–ÖFW67&–&VF'“Ò&76WB×V÷FRÖÆö6F–öâÖ†–çB ¢&–Ö–çfÆ–C×´&ööÆVâ‡V÷FTÆö6F–öäW'&÷"—Ð¢óà¢ÆFFÆ—7B–CÒ&76WB×V÷FRÖÆö6F–öâÖ÷F–öç2#à¢µTõDUôÄô4D”ôåõ5TttU5D”ôå2æÖ‚†Æö6F–öâ’Óâ€¢Æ÷F–öâ¶W“×¶Æö6F–öçÒfÇVS×¶Æö6F–öçÒóà¢’—Ð¢ÂöFFÆ—7Cà ¢Ç6ÖÆÂ–CÒ&76WB×V÷FRÖÆö6F–öâÖ†–çB"6Æ74æÖS×·7G–ÆW2æ76WEV÷FTÆö6F–öä†–çGÓà¢–÷R6âÇ6òW6R–÷W"7W'&VçBFWf–6RÆö6F–öââvRöæÇ’W6R—BFò6VçG&RF†—26V&6‚à¢Â÷6ÖÆÃà¢·V÷FTÆö6F–öäW'&÷"ò€¢Ç6Æ74æÖS×·7G–ÆW2æ76WEV÷FTÆö6F–öäW'&÷'Ò&öÆSÒ&ÆW'B#ç·V÷FTÆö6F–öäW'&÷'ÓÂ÷à¢’¢çVÆÇÐ ¢ÆF—b6Æ74æÖS×·7G–ÆW2æ76WEV÷FTÆö6F–öä7F–öç7Óà¢Æ'WGFöâG—SÒ&'WGFöâ"6Æ74æÖS×·7G–ÆW2æ76WEV÷FT&6´'WGFöçÒöä6Æ–6³×¶vô&6µFõV÷FT÷F–öç7ÒF—6&ÆVC×¶—5&W6öÇf–æuV÷FTÆö6F–öçÓà¢Ä6†Wg&öäÆVgD–6öâ6Æ74æÖS×·7G–ÆW2æ'WGFöä–6öçÒóà¢Ç7ãä&6³Â÷7ãà¢Âö'WGFöãà¢Æ'WGFöâG—SÒ&'WGFöâ"6Æ74æÖS×·7G–ÆW2ç6V6öæF'”'WGFöçÒöä6Æ–6³×²‚’Óâfö–BW6T7W'&VçEV÷FTÆö6F–öâ‚—ÒF—6&ÆVC×¶—5&W6öÇf–æuV÷FTÆö6F–öçÓà¢W6R7W'&VçBÆö6F–öà¢Âö'WGFöãà¢Æ'WGFöâG—SÒ'7V&Ö—B"6Æ74æÖS×·7G–ÆW2ç&–Ö'”'WGFöçÒF—6&ÆVC×¶—5&W6öÇf–æuV÷FTÆö6F–öâÇÂV÷FTÆö6F–öä–çWBçG&–Ò‚—Óà¢¶—5&W6öÇf–æuV÷FTÆö6F–öâòtf–æF–ær&Vâââr¢u6†÷ræV&'’†VÇwÐ¢Âö'WGFöãà¢ÂöF—cà¢Âöf÷&Óà¢Â÷6V7F–öãà¢ÂöF—cà¢’¢€¢ÆF—b6Æ74æÖS×·7G–ÆW2æ76WEV÷FT6öçFVçGÓà¢Æf÷&Ð¢6Æ74æÖS×·7G–ÆW2æ76WEV÷FU6V&6„&'Ð¢öå7V&Ö—C×²†WfVçB’Óâ°¢WfVçBç&WfVçDFVfVÇB‚“°¢V÷FTf—E&W7VÇG5&Vbæ7W'&VçBÒ&ööÆVâ‡V÷FU'FæW%6V&6‚çG&–Ò‚’“°¢fö–BÆöEV÷FU'FæW'2‡6VÆV7FVEV÷FT÷F–öâæÆVEG—RÂV÷FU'FæW%6V&6‚“°¢×Ð¢à¢Æ–çW@¢6Æ74æÖS×·7G–ÆW2æ76WEV÷FU6V&6„–çWGÐ¢fÇVS×·V÷FU'FæW%6V&6‡Ð¢öä6†ævS×²†WfVçB’Óâ6WEV÷FU'FæW%6V&6‚†WfVçBçF&vWBçfÇVR—Ð¢Æ6V†öÆFW#Ò%6V&6‚æ÷F†W"&VÂ6ö×ç’Â6W'f–6R÷"'&æB ¢&–ÖÆ&VÃÒ%6V&6‚'W6–æW72F—&V7F÷'’ ¢óà¢Æ'WGFöâG—SÒ'7V&Ö—B"6Æ74æÖS×·7G–ÆW2ç6V6öæF'”'WGFöçÒF—6&ÆVC×¶—4ÆöF–æuV÷FU'FæW'7Óà¢Å6V&6„–6öâ6Æ74æÖS×·7G–ÆW2æ'WGFöä–6öçÒóà¢Ç7ãç¶—4ÆöF–æuV÷FU'FæW'2òu6V&6†–ærâââr¢u6V&6‚wÓÂ÷7ãà¢Âö'WGFöãà¢Âöf÷&Óà ¢ÆF—b6Æ74æÖS×·7G–ÆW2æ76WEV÷FTÖ7FvWÓà¢Æ6–FR6Æ74æÖS×·7G–ÆW2æ76WEV÷FTÖ6–FV&'Ò&–ÖÆ&VÃÒ$f–Æ&ÆR6ö×æ–W2#à¢ÆF—b6Æ74æÖS×·7G–ÆW2æ76WEV÷FU6–FV&$†VFW'Óà¢Æ'WGFöâG—SÒ&'WGFöâ"6Æ74æÖS×·7G–ÆW2æ76WEV÷FT&6´'WGFöçÒöä6Æ–6³×¶vô&6µFõV÷FT÷F–öç7ÒF—6&ÆVC×¶—56VæF–æuV÷FTÆVGÓà¢Ä6†Wg&öäÆVgD–6öâ6Æ74æÖS×·7G–ÆW2æ'WGFöä–6öçÒóà¢Ç7ãä&6³Â÷7ãà¢Âö'WGFöãà¢Ç7â6Æ74æÖS×·7G–ÆW2æ76WEV÷FT&V7VÖÖ'—Óà¢Ç6ÖÆÃå6†÷v–æræV#Â÷6ÖÆÃà¢Ç7G&öæsç·V÷FTÆö6F–öä–çWGÓÂ÷7G&öæsà¢Â÷7ãà¢Æ'WGFöâG—SÒ&'WGFöâ"6Æ74æÖS×·7G–ÆW2æ76WEV÷FT6†ævTÆö6F–öä'WGFöçÒöä6Æ–6³×¶6†ævUV÷FTÆö6F–öçÒF—6&ÆVC×¶—56VæF–æuV÷FTÆVGÓà¢6†ævR&V¢Âö'WGFöãà¢ÂöF—cà ¢ÆF—b6Æ74æÖS×·7G–ÆW2æ76WEV÷FU'FæW$Æ—7GÓà¢¶—4ÆöF–æuV÷FU'FæW'2ò€¢Ç6Æ74æÖS×·7G–ÆW2æ76WEV÷FTV×G•7FFWÓäÆöF–ær6ö×æ–W2ââãÂ÷à¢’¢V÷FU'FæW'2æÆVæwF‚ò€¢V÷FU'FæW'2æÖ‚‡'FæW"’Óâ°¢6öç7B—56VÆV7FVBÒ6VÆV7FVEV÷FU'FæW$–G2æ–æ6ÇVFW2‡'FæW"çW6W$–B“°¢&WGW&â€¢Æ'WGFöà¢¶W“×·'FæW"çW6W$–GÐ¢G—SÒ&'WGFöâ ¢6Æ74æÖS×¶G·7G–ÆW2æ76WEV÷FU'FæW$6&GÒG·V÷FUFöæT6Æ74f÷%'FæW%G—R‡'FæW"ç'FæW%G—R—ÒG¶—56VÆV7FVBò7G–ÆW2æ76WEV÷FU'FæW$6&D7F—fR¢rwÖÐ¢öä6Æ–6³×²‚’Óâ°¢–b†—4–ÓG&–6T76—7Fæ6U'FæW"‡'FæW"’bb—56VÆV7FVB’°¢÷Vä–ÓG&–6T76—7Fæ6TÖW76vR‡'FæW"“°¢&WGW&ã°¢Ð¢FövvÆUV÷FU'FæW%6VÆV7F–öâ‡'FæW"“°¢×Ð¢&–ÖÆ&VÃ×¶G¶—56VÆV7FVBòu&VÖ÷fRr¢—4–ÓG&–6T76—7Fæ6U'FæW"‡'FæW"’òtÖW76vRr¢u6VÆV7BwÒG·V÷FU'FæW$æÖR‡'FæW"—ÖÐ¢&–×&W76VC×¶—56VÆV7FVGÐ¢à¢Ç7â6Æ74æÖS×·7G–ÆW2æ76WEV÷FU'FæW$&öG—Óà¢Ç7â6Æ74æÖS×·7G–ÆW2æ76WEV÷FU'FæW$†VFW'Óà¢Ç7G&öæsç·V÷FU'FæW$æÖR‡'FæW"—ÓÂ÷7G&öæsà¢·'FæW"æ—4–ÓG&–6TÖævVBò€¢Ç7â6Æ74æÖS×·7G–ÆW2æ76WEV÷FTÖævVDÆ&VÇÓãÆ’&–Ö†–FFVãÒ'G'VR"óä–ÓG&–6R6W'f–6R&VÂ÷7ãà¢’¢'FæW"æ—47F—fU'FæW"ò€¢Ç6ÖÆÂ6Æ74æÖS×·7G–ÆW2æ76WEV÷FT7F—fU'FæW$&FvWÓä7F—fR'FæW#Â÷6ÖÆÃà¢’¢çVÆÇÐ¢Â÷7ãà¢Ç7â6Æ74æÖS×·7G–ÆW2æ76WEV÷FU'FæW$ÖWFÓà¢Ç7ãç·V÷FU'FæW$Æö6F–öâ‡'FæW"—ÓÂ÷7ãà¢²'FæW"æ—4–ÓG&–6TÖævVBò€¢Ç7ãç·V÷FU'FæW%6W'f–6W4F—7Æ’‡'FæW"—ÓÂ÷7ãà¢’¢çVÆÇÐ¢Ç7ãç·V÷FU'FæW%&F—W4F—7Æ’‡'FæW"—ÓÂ÷7ãà¢Â÷7ãà¢²'FæW"æ—4–ÓG&–6TÖævVBbb'FæW"æ'&æDfö7W2ò€¢Ç7â6Æ74æÖS×·7G–ÆW2æ76WEV÷FU'FæW$6÷—Óä'&æG3¢·'FæW"æ'&æDfö7W7ÓÂ÷7ãà¢’¢çVÆÇÐ¢Ç7â6Æ74æÖS×·7G–ÆW2æ76WEV÷FU'FæW$7F–öçÓà¢Ç7ãç¶—56VÆV7FVBòu6VÆV7FVBr¢—4–ÓG&–6T76—7Fæ6U'FæW"‡'FæW"’òtÖW76vR–ÓG&–6Rr¢u6VÆV7B6ö×ç’wÓÂ÷7ãà¢Ä6†Wg&öå&–v‡D–6öâ6Æ74æÖS×·7G–ÆW2æ'WGFöä–6öçÒóà¢Â÷7ãà¢Â÷7ãà¢Âö'WGFöãà¢“°¢Ò¢’¢€¢Ç6Æ74æÖS×·7G–ÆW2æ76WEV÷FTV×G•7FFWÓç·6VÆV7FVEV÷FT÷F–öâæV×G•'FæW%FW‡GÓÂ÷à¢—Ð¢ÂöF—cà ¢ÆF—b6Æ74æÖS×·7G–ÆW2æ76WEV÷FU6–FV&$fö÷FW'Óà¢Ç7ãà¢·6VÆV7FVEV÷FU'FæW'2æÆVæwF€¢òG·6VÆV7FVEV÷FU'FæW'2æÆVæwF‡Ò6VÆV7FVF ¢¢u6VÆV7BöæR÷"Ö÷&RwÐ¢Â÷7ãà¢Æ'WGFöà¢G—SÒ&'WGFöâ ¢6Æ74æÖS×·7G–ÆW2ç&–Ö'”'WGFöçÐ¢öä6Æ–6³×¶÷VåV÷FTÆVDÖW76vWÐ¢F—6&ÆVC×²6VÆV7FVEV÷FU'FæW'2æÆVæwF‚ÇÂ—56VæF–æuV÷FTÆVGÐ¢à¢·6VÆV7FVEV÷FU'FæW'2æÆVæwF‚ò6öçF–çVRv—F‚G·6VÆV7FVEV÷FU'FæW'2æÆVæwF‡Ö¢t6öçF–çVRwÐ¢Âö'WGFöãà¢ÂöF—cà¢Âö6–FSà ¢ÆF—`¢6Æ74æÖS×¶G·7G–ÆW2æ76WEV÷FTÖ6†VÆÇÒG¶—5V÷FTÖW‡æFVBò7G–ÆW2æ76WEV÷FTÖ6†VÆÄW‡æFVB¢rwÖÐ¢öä6Æ–6³×²‚’Óâ°¢–b‚—5V÷FTÖW‡æFVB’6WD—5V÷FTÖW‡æFVB‡G'VR“°¢×Ð¢à¢ÆF—b&Vc×·V÷FTÖVÆVÖVçE&VgÒ6Æ74æÖS×·7G–ÆW2æ76WEV÷FTÖ6çf7Ò&–ÖÆ&VÃÒ$'W6–æW72æB–ÓG&–6R76—7Fæ6RÖ"óà¢ÆF—b6Æ74æÖS×·7G–ÆW2æ76WEV÷FTÖ6öçG&öÇ7Òöä6Æ–6³×²†WfVçB’ÓâWfVçBç7F÷&÷vF–öâ‚—Óà¢¶—5V÷FTÖW‡æFVBò€¢Ç7â6Æ74æÖS×·7G–ÆW2æ76WEV÷FTW‡æFVDÖ&VÓà¢Ç6ÖÆÃå6†÷v–æræV#Â÷6ÖÆÃà¢Ç7G&öæsç·V÷FTÆö6F–öä–çWGÓÂ÷7G&öæsà¢Â÷7ãà¢’¢çVÆÇÐ¢Æ'WGFöà¢G—SÒ&'WGFöâ ¢6Æ74æÖS×·7G–ÆW2æ76WEV÷FTÖW‡æD'WGFöçÐ¢öä6Æ–6³×²‚’Óâ6WD—5V÷FTÖW‡æFVB‚†7W'&VçB’Óâ7W'&VçB—Ð¢&–ÖÆ&VÃ×¶—5V÷FTÖW‡æFVBòtÖ–æ–Ö—6R'FæW"Ör¢tW‡æB'FæW"ÖwÐ¢F—FÆS×¶—5V÷FTÖW‡æFVBòu&WGW&âFò'FæW"&W7VÇG2r¢t÷VâgVÆÂÖwÐ¢à¢¶—5V÷FTÖW‡æFVBòÄ6Æ÷6T–6öâ6Æ74æÖS×·7G–ÆW2æ'WGFöä–6öçÒóâ¢ÄW‡æD–6öâ6Æ74æÖS×·7G–ÆW2æ'WGFöä–6öçÒóçÐ¢Ç7ãç¶—5V÷FTÖW‡æFVBòu&WGW&âFò&W7VÇG2r¢tW‡æBÖwÓÂ÷7ãà¢Âö'WGFöãà¢ÂöF—cà¢²—5V÷FTÖW‡æFVBò€¢Ç7â6Æ74æÖS×·7G–ÆW2æ76WEV÷FTÖW‡æD†–çGÓä6Æ–6²F†RÖFòW‡æCÂ÷7ãà¢’¢çVÆÇÐ¢²—4ÆöF–æuV÷FU'FæW'2bbV÷FU'FæW'5v—F„6ö÷&F–æFW2æÆVæwF‚ò€¢ÆF—b6Æ74æÖS×·7G–ÆW2æ76WEV÷FTÖV×G”÷fW&Æ—Óà¢Ä÷F–öç4–6öâ6Æ74æÖS×·7G–ÆW2æ'WGFöä–6öçÒóà¢ÇäÖ÷fRF†RÖ÷"6V&6‚F÷vâFòÆöBæV&'’'FæW'2æB–ÓG&–6R6W'f–6R&V2ãÂ÷à¢ÂöF—cà¢’¢çVÆÇÐ¢ÂöF—cà¢ÂöF—cà ¢·V÷FTÆVE7FWbb6VÆV7FVEV÷FT÷F–öâbb6VÆV7FVEV÷FU'FæW"ò€¢ÆF—b6Æ74æÖS×·7G–ÆW2æ76WEV÷FU7FW÷fW&Æ—Óà¢Æ'WGFöà¢G—SÒ&'WGFöâ ¢6Æ74æÖS×·7G–ÆW2æ76WEV÷FU7FW&6¶G&÷Ð¢öä6Æ–6³×¶6Æ÷6UV÷FTÆVE7FWÐ¢&–ÖÆ&VÃÒ$6Æ÷6R&WVW7B7FW ¢F—6&ÆVC×¶—56VæF–æuV÷FTÆVGÐ¢óà ¢Ç6V7F–öâ6Æ74æÖS×¶G·7G–ÆW2æ76WEV÷FU7FWÖöFÇÒG·V÷FTÆVE7FWÓÓÒvÖW76vRrò7G–ÆW2æ76WEV÷FTÖW76vU7FWÖöFÂ¢rwÖÒ&–ÖÆ—fSÒ'öÆ—FR#à¢ÆF—b6Æ74æÖS×·7G–ÆW2æ76WEV÷FU7FW†VFW'Óà¢ÆF—cà¢ÆƒCç·V÷FTÆVE7FWÓÓÒvÖW76vRp¢òÖW76vRFò6VÆV7FVBG·6VÆV7FVEV÷FU'FæW'2æÆVæwF‚ÓÓÒòv6ö×ç’r¢v6ö×æ–W2wÖ ¢¢t6öæf—&ÒæB6VæB&WVW7BwÓÂöƒCà¢ÂöF—cà¢Æ'WGFöà¢G—SÒ&'WGFöâ ¢6Æ74æÖS×·7G–ÆW2æ76WEV÷FU7FW6Æ÷6T'WGFöçÐ¢öä6Æ–6³×¶6Æ÷6UV÷FTÆVE7FWÐ¢&–ÖÆ&VÃÒ$6Æ÷6R&WVW7B7FW ¢F—6&ÆVC×¶—56VæF–æuV÷FTÆVGÐ¢à¢Ä6Æ÷6T–6öâ6Æ74æÖS×·7G–ÆW2æ'WGFöä–6öçÒóà¢Âö'WGFöãà¢ÂöF—cà ¢·V÷FTÆVE7FWÓÓÒvÖW76vRrò€¢ÆF—b6Æ74æÖS×¶G·7G–ÆW2æ76WEV÷FU7FW&öG—ÒG·7G–ÆW2æ76WEV÷FTÖW76vU7FW&öG—ÖÓà¢·6VÆV7FVEV÷FU'FæW'2æÆVæwF‚ÓÓÒò€¢Æ6–FR6Æ74æÖS×·7G–ÆW2æ76WEV÷FU6VÆV7FVD6ö×ç•æVÇÒ&–ÖÆ&VÃÒ%6VÆV7FVB6ö×ç’FWF–Ç2#à¢ÆF—b6Æ74æÖS×·7G–ÆW2æ76WEV÷FU6VÆV7FVD6ö×ç”–æf÷Óà¢ÆF—b6Æ74æÖS×·7G–ÆW2æ76WEV÷FU6VÆV7FVD6ö×ç”†W&÷Óà¢Ç7â6Æ74æÖS×¶G·7G–ÆW2æ76WEV÷FU6VÆV7FVDÖVF–F–ÆWÒG·7G–ÆW2æ76WEV÷FU6VÆV7FVDÆövõF–ÆWÖÓà¢·6VÆV7FVEV÷FU'FæW"æÆövõW&Âò€¢Æ–Ör7&3×·6VÆV7FVEV÷FU'FæW"æÆövõW&ÇÒÇC×¶G·V÷FU'FæW$æÖR‡6VÆV7FVEV÷FU'FæW"—ÒÆövöÒóà¢’¢€¢Ç7â6Æ74æÖS×·7G–ÆW2æ76WEV÷FU6VÆV7FVDÆövôfÆÆ&6·Óç·V÷FU'FæW$–æ—F–Â‡6VÆV7FVEV÷FU'FæW"—ÓÂ÷7ãà¢—Ð¢Â÷7ãà¢ÆF—b6Æ74æÖS×·7G–ÆW2æ76WEV÷FU6VÆV7FVD6ö×ç•F—FÆWÓà¢·6VÆV7FVEV÷FU'FæW"æ—4–ÓG&–6TÖævVBò€¢Ç7â6Æ74æÖS×·7G–ÆW2æ76WEV÷FTÖævVDÆ&VÇÓãÆ’&–Ö†–FFVãÒ'G'VR"óä–ÓG&–6R6W'f–6R&VÂ÷7ãà¢’¢çVÆÇÐ¢Ç7G&öæsç·V÷FU'FæW$æÖR‡6VÆV7FVEV÷FU'FæW"—ÓÂ÷7G&öæsà¢Ç7ãç·V÷FU'FæW$Æö6F–öâ‡6VÆV7FVEV÷FU'FæW"—ÓÂ÷7ãà¢ÂöF—cà¢ÂöF—cà ¢·6VÆV7FVEV÷FU'FæW"æ—4–ÓG&–6TÖævVBò€¢Ç6Æ74æÖS×·7G–ÆW2æ76WEV÷FTÖævVE6VÆV7FVDæ÷F–6WÓà¢–ÓG&–6Rv–ÆÂf–æB7V—F&ÆR&÷f–FW"f÷"F†—2&Vâæ÷F†–ær—26†&VBv—F‚âW‡FW&æÂ&÷f–FW"v—F†÷WB–÷W"&÷fÂà¢Â÷à¢’¢çVÆÇÐ ¢ÆF—b6Æ74æÖS×·7G–ÆW2æ76WEV÷FU6VÆV7FVD6öçF7DÆ—7GÓà¢·6VÆV7FVEV÷FU'FæW"æVÖ–Âbb6VÆV7FVEV÷FU'FæW$VÖ–Ä‡&Vbò€¢Æ6Æ74æÖS×·7G–ÆW2æ76WEV÷FU6VÆV7FVD6öçF7E&÷wÒ‡&Vc×·6VÆV7FVEV÷FU'FæW$VÖ–Ä‡&VgÓà¢Ç6ÖÆÃäVÖ–ÃÂ÷6ÖÆÃà¢Ç7ãç·6VÆV7FVEV÷FU'FæW"æVÖ–ÇÓÂ÷7ãà¢Âöà¢’¢€¢Ç7â6Æ74æÖS×·7G–ÆW2æ76WEV÷FU6VÆV7FVD6öçF7E&÷wÓà¢Ç6ÖÆÃäVÖ–ÃÂ÷6ÖÆÃà¢Ç7ãäVÖ–Âæ÷B6fVCÂ÷7ãà¢Â÷7ãà¢—Ð ¢·6VÆV7FVEV÷FU'FæW"ç†öæRbb6VÆV7FVEV÷FU'FæW%†öæT‡&Vbò€¢Æ6Æ74æÖS×·7G–ÆW2æ76WEV÷FU6VÆV7FVD6öçF7E&÷wÒ‡&Vc×·6VÆV7FVEV÷FU'FæW%†öæT‡&VgÓà¢Ç6ÖÆÃä6öçF7CÂ÷6ÖÆÃà¢Ç7ãç·6VÆV7FVEV÷FU'FæW"ç†öæWÓÂ÷7ãà¢Âöà¢’¢€¢Ç7â6Æ74æÖS×·7G–ÆW2æ76WEV÷FU6VÆV7FVD6öçF7E&÷wÓà¢Ç6ÖÆÃä6öçF7CÂ÷6ÖÆÃà¢Ç7ãä6öçF7Bæ÷B6fVCÂ÷7ãà¢Â÷7ãà¢—Ð ¢·6VÆV7FVEV÷FU'FæW%vV'6—FT‡&Vbò€¢Æ6Æ74æÖS×·7G–ÆW2æ76WEV÷FU6VÆV7FVD6öçF7E&÷wÒ‡&Vc×·6VÆV7FVEV÷FU'FæW%vV'6—FT‡&VgÒF&vWCÒ%ö&Ææ²"&VÃÒ&æ÷&VfW'&W"#à¢Ç6ÖÆÃåvV'6—FSÂ÷6ÖÆÃà¢Ç7ãç·V÷FU'FæW%vV'6—FTF—7Æ’‡6VÆV7FVEV÷FU'FæW"—ÓÂ÷7ãà¢Âöà¢’¢€¢Ç7â6Æ74æÖS×·7G–ÆW2æ76WEV÷FU6VÆV7FVD6öçF7E&÷wÓà¢Ç6ÖÆÃåvV'6—FSÂ÷6ÖÆÃà¢Ç7ãåvV'6—FRæ÷B6fVCÂ÷7ãà¢Â÷7ãà¢—Ð ¢Ç7â6Æ74æÖS×·7G–ÆW2æ76WEV÷FU6VÆV7FVD6öçF7E&÷wÓà¢Ç6ÖÆÃäFG&W73Â÷6ÖÆÃà¢Ç7ãç·V÷FU'FæW$FG&W72‡6VÆV7FVEV÷FU'FæW"—ÓÂ÷7ãà¢Â÷7ãà¢ÂöF—cà¢ÂöF—cà¢Âö6–FSà¢’¢€¢Æ6–FR6Æ74æÖS×·7G–ÆW2æ76WEV÷FU6VÆV7FVE'FæW'5æVÇÒ&–ÖÆ&VÃÒ%6VÆV7FVB6ö×æ–W2#à¢ÆF—b6Æ74æÖS×·7G–ÆW2æ76WEV÷FU6VÆV7FVE'FæW'4†VF–æwÓà¢Ç7â6Æ74æÖS×·7G–ÆW2æ76WEV÷FU6VÆV7FVE'FæW'46÷VçGÓç·6VÆV7FVEV÷FU'FæW'2æÆVæwF‡ÓÂ÷7ãà¢Ç7ãà¢Ç7G&öæsä6ö×æ–W26VÆV7FVCÂ÷7G&öæsà¢Ç6ÖÆÃäV6‚&V6V—fW26W&FR&WVW7BãÂ÷6ÖÆÃà¢Â÷7ãà¢ÂöF—cà¢ÆF—b6Æ74æÖS×·7G–ÆW2æ76WEV÷FU6VÆV7FVE'FæW'4Æ—7GÓà¢·6VÆV7FVEV÷FU'FæW'2æÖ‚‡'FæW"’Óâ€¢ÆF—b¶W“×·'FæW"çW6W$–GÒ6Æ74æÖS×·7G–ÆW2æ76WEV÷FU6VÆV7FVE'FæW%7VÖÖ'—Óà¢Ç7ãç·V÷FU'FæW$–æ—F–Â‡'FæW"—ÓÂ÷7ãà¢Ç7ãà¢Ç7G&öæsç·V÷FU'FæW$æÖR‡'FæW"—ÓÂ÷7G&öæsà¢Ç6ÖÆÃç·V÷FU'FæW$Æö6F–öâ‡'FæW"—ÓÂ÷6ÖÆÃà¢Â÷7ãà¢ÂöF—cà¢’—Ð¢ÂöF—cà¢Âö6–FSà¢—Ð ¢ÆF—b6Æ74æÖS×·7G–ÆW2æ76WEV÷FTÖW76vUæVÇÓà¢Ç6Æ74æÖS×·7G–ÆW2æ76WEV÷FU7FWæ÷F–6WÓà¢¶—4gVÆÅ&Vv—7FW%V÷FTÆV@¢ò—476WDw&÷W6†&P¢òF†—26VæG2öæR÷&væ—6VB6æ6†÷B6öçF–æ–æröæÇ’G¶7F—fU6†&TæÖWÒæB—G2w&÷WVB76WG2æ ¢¢6VÆV7FVEV÷FU'FæW'2æÆVæwF‚ÓÓÒbb6VÆV7FVEV÷FT÷F–öâæÆVEG—RÓÓÒvf–ææ6Rrbb6VÆV7FVEV÷FU'FæW#òæ66÷VçE7V'G—RÓÓÒv66÷VçFçBp¢òuF†—2w&çG2F†R6VÆV7FVB66÷VçFçBÆ—fR66W72FòF†RÆFW7BWF†÷&—6VB–æf÷&ÖF–öâ–âF†—276WB&Vv—7FW"âp¢¢6VÆV7FVEV÷FT÷F–öâæÆVEG—RÓÓÒw&WÆ6VÖVçE÷V÷FRrÇÂ6VÆV7FVEV÷FT÷F–öâæÆVEG—RÓÓÒvÆ–6Vç6U÷&VæWvÂp¢ò6†ö÷6RF†R76WG2G·6VÆV7FVEV÷FU'FæW'2æÆVæwF‚ÓÓÒòwF†—26ö×ç’r¢wF†W6R6ö×æ–W2wÒ6âv÷&²v—F‚æ ¢¢uF†—26VæG2öæ6RÖöfbgVÆÂ76WB&Vv—7FW"6æ6†÷Bâ—BFöW2æ÷Bw&çBÆ—fR&Vv—7FW"66W72âp¢¢uF†—26VæG2öæR76WBöæÇ’â—BFöW2æ÷B6†&RF†RgVÆÂ&Vv—7FW"âwÐ¢Â÷à ¢¶—4gVÆÅ&Vv—7FW%V÷FTÆVBbb—476WDw&÷W6†&Rbb6VÆV7FVEV÷FU'FæW'2æÆVæwF‚ÓÓÒbb6VÆV7FVEV÷FT÷F–öâæÆVEG—RÓÓÒvf–ææ6Rrbb6VÆV7FVEV÷FU'FæW#òæ66÷VçE7V'G—RÓÓÒv66÷VçFçBrò€¢ÆF—b6Æ74æÖS×·7G–ÆW2æ76WDÆ–fV7–6ÆTf–VÆG7Óà¢Æ'WGFöâG—SÒ&'WGFöâ"6Æ74æÖS×¶G·7G–ÆW2æ76WEV÷FT6öç6VçD6†V6·ÒG·7G–ÆW2æ76WEV÷FUG&6¶–æt6†ö–6WÖÒöä6Æ–6³×²‚’Óâ6WEV÷FTÆÆ÷tF—&V7EWFFW2‚†7W'&VçB’Óâ7W'&VçB—Ò&–×&W76VC×·V÷FTÆÆ÷tF—&V7EWFFW7Óà¢Ç7â6Æ74æÖS×¶G·7G–ÆW2æ76WEV÷FUG&6¶–æt6†V6¶&÷‡ÒG·V÷FTÆÆ÷tF—&V7EWFFW2ò7G–ÆW2æ76WEV÷FUG&6¶–æt6†V6¶&÷„7F—fR¢rwÖÒ&–Ö†–FFVãÒ'G'VR#ç·V÷FTÆÆ÷tF—&V7EWFFW2ò~)É2r¢rwÓÂ÷7ãà¢Ç7â6Æ74æÖS×·7G–ÆW2æ76WEV÷FUG&6¶–æt6÷—Óà¢Ç7G&öæsäÆÆ÷rF—&V7BWFFW3Â÷7G&öæsà¢Ç6ÖÆÃåW&Ö—B–ÖÖVF–FR66÷VçFçBf–ææ6R6†ævW2ÂFö7VÖVçBWÆöG2æB66÷VçF–ær6''––ær×fÇVR&VfW&Væ6W2âWfW'’6†ævR—2VF—FVBãÂ÷6ÖÆÃà¢Â÷7ãà¢Âö'WGFöãà¢Æ'WGFöâG—SÒ&'WGFöâ"6Æ74æÖS×¶G·7G–ÆW2æ76WEV÷FT6öç6VçD6†V6·ÒG·7G–ÆW2æ76WEV÷FUG&6¶–æt6†ö–6WÖÒöä6Æ–6³×²‚’Óâ6WEV÷FT–æ6ÇVFTgVVÄÆVFvW"‚†7W'&VçB’Óâ7W'&VçB—Ò&–×&W76VC×·V÷FT–æ6ÇVFTgVVÄÆVFvW'Óà¢Ç7â6Æ74æÖS×¶G·7G–ÆW2æ76WEV÷FUG&6¶–æt6†V6¶&÷‡ÒG·V÷FT–æ6ÇVFTgVVÄÆVFvW"ò7G–ÆW2æ76WEV÷FUG&6¶–æt6†V6¶&÷„7F—fR¢rwÖÒ&–Ö†–FFVãÒ'G'VR#ç·V÷FT–æ6ÇVFTgVVÄÆVFvW"ò~)É2r¢rwÓÂ÷7ãà¢Ç7â6Æ74æÖS×·7G–ÆW2æ76WEV÷FUG&6¶–æt6÷—ÓãÇ7G&öæså6†&RgVVÂÆVFvW"&W÷'G3Â÷7G&öæsãÇ6ÖÆÃå&VBÖöæÇ’66W72FòWF†÷&—6VBgVVÂ&V6÷&G2æBF÷væÆöG2ãÂ÷6ÖÆÃãÂ÷7ãà¢Âö'WGFöãà¢Æ'WGFöâG—SÒ&'WGFöâ"6Æ74æÖS×¶G·7G–ÆW2æ76WEV÷FT6öç6VçD6†V6·ÒG·7G–ÆW2æ76WEV÷FUG&6¶–æt6†ö–6WÖÒöä6Æ–6³×²‚’Óâ6WEV÷FT–æ6ÇVFT6÷7DÆVFvW"‚†7W'&VçB’Óâ7W'&VçB—Ò&–×&W76VC×·V÷FT–æ6ÇVFT6÷7DÆVFvW'Óà¢Ç7â6Æ74æÖS×¶G·7G–ÆW2æ76WEV÷FUG&6¶–æt6†V6¶&÷‡ÒG·V÷FT–æ6ÇVFT6÷7DÆVFvW"ò7G–ÆW2æ76WEV÷FUG&6¶–æt6†V6¶&÷„7F—fR¢rwÖÒ&–Ö†–FFVãÒ'G'VR#ç·V÷FT–æ6ÇVFT6÷7DÆVFvW"ò~)É2r¢rwÓÂ÷7ãà¢Ç7â6Æ74æÖS×·7G–ÆW2æ76WEV÷FUG&6¶–æt6÷—ÓãÇ7G&öæså6†&R6÷7BÆVFvW"&W÷'G3Â÷7G&öæsãÇ6ÖÆÃå&VBÖöæÇ’66W72FòWF†÷&—6VB6÷7B&V6÷&G2æBF÷væÆöG2ãÂ÷6ÖÆÃãÂ÷7ãà¢Âö'WGFöãà¢ÂöF—cà¢’¢çVÆÇÐ ¢¶—4gVÆÅ&Vv—7FW%V÷FTÆVBbb‡6VÆV7FVEV÷FT÷F–öâæÆVEG—RÓÓÒw&WÆ6VÖVçE÷V÷FRrÇÂ6VÆV7FVEV÷FT÷F–öâæÆVEG—RÓÓÒvÆ–6Vç6U÷&VæWvÂr’ò€¢—476WDw&÷W6†&Rò€¢Ç6V7F–öâ6Æ74æÖS×·7G–ÆW2æ76WDw&÷W6†&U7VÖÖ'—Ò&–ÖÆ&VÃ×¶G¶7F—fU6†&TæÖWÒ76WG2–æ6ÇVFVFÓà¢ÅVÖ'&VÆÆ–6öâ6Æ74æÖS×·7G–ÆW2æ76WDw&÷W6†&U7VÖÖ'”–6öçÒóà¢Ç7ãà¢Ç7G&öæsç¶7F—fU6†&TæÖWÓÂ÷7G&öæsà¢Ç6ÖÆÃç·6VÆV7FVEV÷FT÷F–öâæÆVEG—RÓÓÒvÆ–6Vç6U÷&VæWvÂp¢òG·6VÆV7FVDFVÆW%6†&T76WD–G2æÆVæwF‡Òw&÷WVBG·6VÆV7FVDFVÆW%6†&T76WD–G2æÆVæwF‚ÓÓÒòv76WBr¢v76WG2wÒv—F‚&VæWvÂFFW2–æ6ÇVFVBæ ¢¢G¶7F—fU6†&T76WG2æÆVæwF‡Òw&÷WVBG¶7F—fU6†&T76WG2æÆVæwF‚ÓÓÒòv76WBr¢v76WG2wÒ–æ6ÇVFVBWFöÖF–6ÆÇ’æÓÂ÷6ÖÆÃà¢Â÷7ãà¢Â÷6V7F–öãà¢’¢€¢ÄFVÆW$76WE6†&U6VÆV7F–öà¢76WG3×¶76WG0¢æf–ÇFW"‚†76WB’Óâ6VÆV7FVEV÷FT÷F–öâæÆVEG—RÓÒvÆ–6Vç6U÷&VæWvÂrÇÂ€¢&VDÆ–6Vç6U7FGW46†ö–6R†76WB’ÓÓÒw–W2rb`¢&ööÆVâ‡&VE7V75FW‡B†76WBÂ²vÆ–6Vç6U&VæWvÄFFRrÂvÆ–6Vç6U÷&VæWvÅöFFRrÂvÆ–6Væ6U&VæWvÄFFRrÂvÆ–6Væ6U÷&VæWvÅöFFRuÒ’¢’¢æÖ‚†76WB’Óâ‡°¢–C¢76WBæ–BÀ¢F—FÆS¢76WBçF—FÆRÀ¢–V$ÖöFVÃ¢76WBç–V$ÖöFVÂÀ¢6W&–ÄçVÖ&W#¢76WBç6W&–ÄçVÖ&W"À¢&Vv—7G&F–öäçVÖ&W#¢&VDÆ–6Vç6U&Vv—7G&F–öäçVÖ&W"†76WB’À¢Ò’—Ð¢6VÆV7FVD76WD–G3×·6VÆV7FVDFVÆW%6†&T76WD–G7Ð¢öä6†ævS×·6WE6VÆV7FVDFVÆW%6†&T76WD–G7Ð¢F—6&ÆVC×¶—56VæF–æuV÷FTÆVGÐ¢óà¢¢’¢çVÆÇÐ ¢ÆÆ&VÂ6Æ74æÖS×·7G–ÆW2æ76WEV÷FTÖW76vTf–VÆGÓà¢Ç7ãà¢ÖW76vRFò6VÆV7FVB·6VÆV7FVEV÷FU'FæW'2æÆVæwF‚ÓÓÒòv6ö×ç’r¢v6ö×æ–W2wÐ¢Ç6ÖÆÃä÷F–öæÃÂ÷6ÖÆÃà¢Â÷7ãà¢ÇFW‡F&V¢fÇVS×·V÷FT÷væW$ÖW76vWÐ¢öä6†ævS×²†WfVçB’Óâ6WEV÷FT÷væW$ÖW76vR†WfVçBçF&vWBçfÇVR—Ð¢Æ6V†öÆFW#×°¢—4gVÆÅ&Vv—7FW%V÷FTÆV@¢ò—476WDw&÷W6†&P¢òW†×ÆS¢ÆV6R&Wf–WrG¶7F—fU6†&TæÖWÒæB—G2w&÷WVB76WG2æ ¢¢tW†×ÆS¢ÆV6R&Wf–Wr×’gVÆÂ&Vv—7FW"f÷"&Vf–ææ6R÷"–ç7W&æ6R÷F–öç2âp¢¢tW†×ÆS¢ÆV6R6öçF7BÖR&÷WB6÷fW"÷"f–ææ6R÷F–öç2f÷"F†—276WBâp¢Ð¢óà¢ÂöÆ&VÃà ¢·6VÆV7FVEV÷FT÷F–öâæÆVEG—RÓÓÒw&WÆ6VÖVçE÷V÷FRrò€¢Æ'WGFöà¢G—SÒ&'WGFöâ ¢6Æ74æÖS×¶G·7G–ÆW2æ76WEV÷FT6öç6VçD6†V6·ÒG·7G–ÆW2æ76WEV÷FUG&6¶–æt6†ö–6WÖÐ¢öä6Æ–6³×¶÷VåV÷FUG&6¶–æu6WGF–æw7Ð¢&–×&W76VC×·V÷FUG&6´Ö–çFVææ6WÐ¢à¢Ç7à¢6Æ74æÖS×¶G·7G–ÆW2æ76WEV÷FUG&6¶–æt6†V6¶&÷‡ÒG·V÷FUG&6´Ö–çFVææ6Rò7G–ÆW2æ76WEV÷FUG&6¶–æt6†V6¶&÷„7F—fR¢rwÖÐ¢&–Ö†–FFVãÒ'G'VR ¢à¢·V÷FUG&6´Ö–çFVææ6Rò~)É2r¢rwÐ¢Â÷7ãà¢Ç7â6Æ74æÖS×·7G–ÆW2æ76WEV÷FUG&6¶–æt6÷—Óà¢Ç7G&öæsç¶—4gVÆÅ&Vv—7FW%V÷FTÆVBòtöævö–ærFVÆW"66W72r¢tVæ&ÆRFVÆW"G&6¶–ærwÓÂ÷7G&öæsà¢Ç6ÖÆÃç¶—4gVÆÅ&Vv—7FW%V÷FTÆV@¢ò—476WDw&÷W6†&P¢òtÇ’F†W6RW&Ö—76–öç2FòWfW'’w&÷WVB76WB–âF†—2VÖ'&VÆÆâ66W727F—2&Wfö6&ÆRâp¢¢tÇ’F†W6RW&Ö—76–öç2FòWfW'’6VÆV7FVB76WBâ66W727F—2&Wfö6&ÆRâp¢¢uF†RFVÆW"6âF÷væÆöBÖ–çFVææ6R&W÷'G2æB&÷÷6RÖ–çFVææ6R66†VGVÆW2f÷"–÷W"&÷fÂâwÓÂ÷6ÖÆÃà¢ÆVÓç·V÷FUG&6´Ö–çFVææ6RòuW&Ö—76–öç26VÆV7FVBâ6Æ–6²Fò&Wf–Wrâr¢t6†ö÷6RF†RFVÆW"W&Ö—76–öç2&Vf÷&R6†&–ærâwÓÂöVÓà¢Â÷7ãà¢Âö'WGFöãà¢’¢çVÆÇÐ¢ÂöF—cà¢ÂöF—cà¢’¢€¢ÆF—b6Æ74æÖS×·7G–ÆW2æ76WEV÷FU7FW&öG—Óà¢ÆF—b6Æ74æÖS×·7G–ÆW2æ76WEV÷FU÷–&÷‡Óà¢Ç7G&öæsäF—66Æ–ÖW"æBõ”æ÷FSÂ÷7G&öæsà¢Çà¢¶†4ÖævVD76—7Fæ6U6VÆV7F–öà¢ò'’6VæF–ærF†—2&WVW7BÂ–÷RÆÆ÷r–ÓG&–6RFò6†&RF†R6VÆV7FVB76WB–æf÷&ÖF–öâæB–÷W"6fVB'W6–æW726öçF7BFWF–Ç2v—F‚F†R&VÆWfçB–ÓG&–6RÖ7FW"76—7Fæ6R66÷VçBâ–ÓG&–6Rv–ÆÂ†VÇÆö6FR7V—F&ÆR&÷f–FW"æBv–ÆÂæ÷B6†&R–÷W"76WG2v—F‚âW‡FW&æÂ&÷f–FW"v—F†÷WB–÷W"gW'F†W"&÷fÂæ ¢¢—4gVÆÅ&Vv—7FW%V÷FTÆV@¢ò—476WDw&÷W6†&P¢ò'’6VæF–ærF†—2&WVW7BÂ–÷RÆÆ÷r–ÓG&–6RFò6†&RG¶7F—fU6†&TæÖWÒÂ—G2w&÷WVB76WB–æf÷&ÖF–öâæB–÷W"6fVB'W6–æW726öçF7BFWF–Ç2v—F‚F†R6VÆV7FVBG·6VÆV7FVEV÷FU'FæW'2æÆVæwF‚ÓÓÒòv6ö×ç’r¢v6ö×æ–W2wÒæ ¢¢6VÆV7FVEV÷FU'FæW'2æÆVæwF‚ÓÓÒbb6VÆV7FVEV÷FT÷F–öâæÆVEG—RÓÓÒvf–ææ6Rrbb6VÆV7FVEV÷FU'FæW#òæ66÷VçE7V'G—RÓÓÒv66÷VçFçBp¢ò'’6VæF–ærF†—2&WVW7BÂ–÷RÆÆ÷r–ÓG&–6RFò6†&RÆ—fR76WB&Vv—7FW"–æf÷&ÖF–öâæB–÷W"6fVB'W6–æW726öçF7BFWF–Ç2v—F‚F†R6†÷6Vâ66÷VçFçBâG·V÷FTÆÆ÷tF—&V7EWFFW2òr–÷RÇ6òÆÆ÷rF†R66÷VçFçBFò6fRF†R6VÆV7FVBF—&V7BWFFW2Âv—F‚VF—B†—7F÷'’âr¢rF†Rv÷&·76Rv–ÆÂ&VÖ–â&VBÖöæÇ’âwÖ ¢¢6VÆV7FVEV÷FT÷F–öâæÆVEG—RÓÓÒw&WÆ6VÖVçE÷V÷FRp¢ò'’6öçF–çV–ærÂ–÷RÆÆ÷r–ÓG&–6RFò6†&RF†R6VÆV7FVB76WG2æB–÷W"6fVB'W6–æW726öçF7BFWF–Ç2v—F‚F†R6VÆV7FVBG·6VÆV7FVEV÷FU'FæW'2æÆVæwF‚ÓÓÒòvFVÆW"r¢vFVÆW'2wÒâöævö–ær66W72W6W2F†RW&Ö—76–öç26†÷vâæB6â&R&Wfö¶VBæ ¢¢'’6VæF–ærF†—2&WVW7BÂ–÷RÆÆ÷r–ÓG&–6RFò6†&Röæ6RÖöfbgVÆÂ76WB&Vv—7FW"6æ6†÷BÂ6fVBfÇVF–öâFWF–Ç2æB–÷W"6fVB'W6–æW726öçF7BFWF–Ç2v—F‚F†R6VÆV7FVBG·6VÆV7FVEV÷FU'FæW'2æÆVæwF‚ÓÓÒòv6ö×ç’r¢v6ö×æ–W2wÒæ ¢¢'’6VæF–ærF†—2&WVW7BÂ–÷RÆÆ÷r–ÓG&–6RFò6†&RF†—26VÆV7FVB76WBÂ—G26fVBfÇVF–öâFWF–Ç2æB–÷W"6fVB'W6–æW726öçF7BFWF–Ç2v—F‚F†R6VÆV7FVBG·6VÆV7FVEV÷FU'FæW'2æÆVæwF‚ÓÓÒòv6ö×ç’r¢v6ö×æ–W2wÒæÐ¢²rwÕF†—2—2öæÇ’ÆVB&WVW7BæBFöW2æ÷B7&VFRf–ææ6RÂ–ç7W&æ6RÂfÇVF–öâ÷"6ÆW2w&VVÖVçBà¢Â÷à¢Çà¢¶†4ÖævVD76—7Fæ6U6VÆV7F–öà¢òu–÷R6öæf—&ÒF†B–÷RÖ’6†&RF†R6VÆV7FVB76WB–æf÷&ÖF–öâæBVæFW'7FæBF†BF†R6†÷6VâF÷vâ&W&W6VçG26W'f–6R&VÂæ÷B‡—6–6Â–ÓG&–6R'&æ6‚âp¢¢—4gVÆÅ&Vv—7FW%V÷FTÆV@¢ò—476WDw&÷W6†&P¢ò–÷R6öæf—&ÒF†B–÷RÖ’6†&RWfW'’w&÷WVB76WB–âF†—2VÖ'&VÆÆæBVæFW'7FæBF†BF†R6VÆV7FVBG·6VÆV7FVEV÷FU'FæW'2æÆVæwF‚ÓÓÒòv6ö×ç’Ö’r¢v6ö×æ–W2Ö’wÒ6öçF7B–÷R÷WG6–FR–ÓG&–6Ræ ¢¢6VÆV7FVEV÷FT÷F–öâæÆVEG—RÓÓÒw&WÆ6VÖVçE÷V÷FRp¢ò–÷R6öæf—&ÒF†B–÷RÖ’6†&RF†R6VÆV7FVB76WB–æf÷&ÖF–öâæBVæFW'7FæBF†BF†R6VÆV7FVBG·6VÆV7FVEV÷FU'FæW'2æÆVæwF‚ÓÓÒòvFVÆW"Ö’r¢vFVÆW'2Ö’wÒ6öçF7B–÷R÷WG6–FR–ÓG&–6Ræ ¢¢–÷R6öæf—&ÒF†B–÷R†fRW&Ö—76–öâFò6†&RF†R6ö×ÆWFR&Vv—7FW"–æf÷&ÖF–öâæBVæFW'7FæBF†BF†R6VÆV7FVBG·6VÆV7FVEV÷FU'FæW'2æÆVæwF‚ÓÓÒòv6ö×ç’Ö’r¢v6ö×æ–W2Ö’wÒ6öçF7B–÷R÷WG6–FR–ÓG&–6Ræ ¢¢–÷R6öæf—&ÒF†B–÷R†fRW&Ö—76–öâFò6†&RF†—276WB–æf÷&ÖF–öâæBVæFW'7FæBF†BF†R6VÆV7FVBG·6VÆV7FVEV÷FU'FæW'2æÆVæwF‚ÓÓÒòv6ö×ç’Ö’r¢v6ö×æ–W2Ö’wÒ6öçF7B–÷R÷WG6–FR–ÓG&–6RæÐ¢Â÷à¢·6VÆV7FVEV÷FT÷F–öâæÆVEG—RÓÓÒw&WÆ6VÖVçE÷V÷FRrbbV÷FUG&6´Ö–çFVææ6Rò€¢ÇåF†R6VÆV7FVB·6VÆV7FVEV÷FU'FæW'2æÆVæwF‚ÓÓÒòvFVÆW"v–ÆÂr¢vFVÆW'2v–ÆÂwÒ&V6V—fRöævö–ærÖ–çFVææ6RG&6¶W"66W72v—F‚F†RW&Ö—76–öç2–÷R6VÆV7FVBâ&÷÷6VB66†VGVÆW2æB76WB6†ævW27F–ÆÂ&WV—&R–÷W"&÷fÂãÂ÷à¢’¢çVÆÇÐ¢ÂöF—cà ¢ÆÆ&VÂ6Æ74æÖS×·7G–ÆW2æ76WEV÷FT6öç6VçD6†V6·Óà¢Æ–çW@¢G—SÒ&6†V6¶&÷‚ ¢6†V6¶VC×·V÷FT6öç6VçD66WFVGÐ¢öä6†ævS×²†WfVçB’Óâ6WEV÷FT6öç6VçD66WFVB†WfVçBçF&vWBæ6†V6¶VB—Ð¢óà¢Ç7ãä’66WBF†RF—66Æ–ÖW"æBõ”W&Ö—76–öâæ÷FRãÂ÷7ãà¢ÂöÆ&VÃà¢ÂöF—cà¢—Ð ¢ÆF—b6Æ74æÖS×·7G–ÆW2æ76WEV÷FU7FWfö÷FW'Óà¢·V÷FTÆVE7FWÓÓÒvÖW76vRrò€¢Ãà¢Æ'WGFöâG—SÒ&'WGFöâ"6Æ74æÖS×·7G–ÆW2ç6V6öæF'”'WGFöçÒöä6Æ–6³×¶6Æ÷6UV÷FTÆVE7FWÒF—6&ÆVC×¶—56VæF–æuV÷FTÆVGÓà¢6æ6VÀ¢Âö'WGFöãà¢Æ'WGFöâG—SÒ&'WGFöâ"6Æ74æÖS×·7G–ÆW2ç&–Ö'”'WGFöçÒöä6Æ–6³×¶võFõV÷FTÆVD6öç6VçGÓà¢æW‡@¢Âö'WGFöãà¢Âóà¢’¢€¢Ãà¢Æ'WGFöâG—SÒ&'WGFöâ"6Æ74æÖS×·7G–ÆW2ç6V6öæF'”'WGFöçÒöä6Æ–6³×¶vô&6µFõV÷FTÆVDÖW76vWÒF—6&ÆVC×¶—56VæF–æuV÷FTÆVGÓà¢&6°¢Âö'WGFöãà¢Æ'WGFöà¢G—SÒ&'WGFöâ ¢6Æ74æÖS×·7G–ÆW2ç&–Ö'”'WGFöçÐ¢öä6Æ–6³×²‚’Óâfö–B†æFÆU6VæD76WEV÷FTÆVB‚—Ð¢F—6&ÆVC×¶—56VæF–æuV÷FTÆVBÇÂV÷FT6öç6VçD66WFVGÐ¢à¢¶—56VæF–æuV÷FTÆV@¢òu6VæF–ærâââp¢¢6VÆV7FVEV÷FU'FæW'2æÆVæwF‚ÓÓÒ¢ò6VæBFòG·V÷FU'FæW$æÖR‡6VÆV7FVEV÷FU'FæW'5³Ò—Ö ¢¢6VæBFòG·6VÆV7FVEV÷FU'FæW'2æÆVæwF‡Ò6ö×æ–W6Ð¢Âö'WGFöãà¢Âóà¢—Ð¢ÂöF—cà¢Â÷6V7F–öãà¢ÂöF—cà¢’¢çVÆÇÐ¢ÂöF—cà¢—Ð¢ÂöF—cà ¢ÂöF—cà¢ÂöF—cà¢’¢çVÆÇÐ ¢·V÷FT76WBbb—5V÷FUG&6¶–æu6WGF–æw4÷Vâò€¢ÆF—b6Æ74æÖS×¶G·7G–ÆW2æÖöFÄ÷fW&Æ—ÒG·7G–ÆW2ç7V$ÖöFÄ÷fW&Æ—ÒG·7G–ÆW2çV÷FUG&6¶–æu6WGF–æw4÷fW&Æ—ÖÓà¢ÆF—b6Æ74æÖS×·7G–ÆW2æÖöFÄ&6¶G&÷Òöä6Æ–6³×¶6æ6VÅV÷FUG&6¶–æu6WGF–æw7Òóà ¢ÆF—`¢6Æ74æÖS×¶G·7G–ÆW2æÖöFÄ6&GÒG·7G–ÆW2ç&–6–ætÖöFÇÒG·7G–ÆW2æFVÆW%G&6¶–ætÖöFÇÒG·7G–ÆW2çV÷FUG&6¶–æu6WGF–æw4ÖöFÇÖÐ¢&öÆSÒ&F–Æör ¢&–ÖÖöFÃÒ'G'VR ¢&–ÖÆ&VÆÆVF'“Ò'V÷FR×G&6¶–ær×6WGF–æw2×F—FÆR ¢à¢ÆF—b6Æ74æÖS×¶G·7G–ÆW2æÖöFÄ†VFW'ÒG·7G–ÆW2ç&–6–ætÖöFÄ†VFW'ÒG·7G–ÆW2æFVÆW%G&6¶–æt†VFW'ÖÓà¢ÆF—b6Æ74æÖS×·7G–ÆW2æÖöFÄ†VFW%FW‡GÓà¢Æƒ2–CÒ'V÷FR×G&6¶–ær×6WGF–æw2×F—FÆR"F$–æFWƒ×²ÓÓäFVÆW"G&6¶–ær6WGF–æw3Âöƒ3à¢Çç·V÷FT76WBçF—FÆWÓÂ÷à¢ÂöF—cà ¢Æ'WGFöâG—SÒ&'WGFöâ"6Æ74æÖS×·7G–ÆW2æÖöFÄ6Æ÷6T'WGFöçÒöä6Æ–6³×¶6æ6VÅV÷FUG&6¶–æu6WGF–æw7Ò&–ÖÆ&VÃÒ$6Æ÷6RFVÆW"G&6¶–ær6WGF–æw2#à¢Ä6Æ÷6T–6öâ6Æ74æÖS×·7G–ÆW2æ'WGFöä–6öçÒóà¢Âö'WGFöãà¢ÂöF—cà ¢ÆF—b6Æ74æÖS×¶G·7G–ÆW2æÖöFÅ67&öÆÄ&öG—ÒG·7G–ÆW2ç&–6–ætÖöFÄ&öG—ÒG·7G–ÆW2æFVÆW%G&6¶–æt&öG—ÖÓà¢ÆF—b6Æ74æÖS×·7G–ÆW2æFVÆW%G&6¶–æt–çG&÷Óà¢Ç7G&öæsä6†ö÷6Rv†BF†—2FVÆW"6â66W73Â÷7G&öæsà¢Çå6VÆV7BF†RW&Ö—76–öç2Fò7F—fFR26ööâ2F†R76WB—26†&VBãÂ÷à¢ÂöF—cà ¢ÄFVÆW$Ö–çFVææ6UW&Ö—76–öå–6¶W ¢fÇVS×·V÷FUG&6¶–æuW&Ö—76–öç7Ð¢öä6†ævS×·6WEV÷FUG&6¶–æuW&Ö—76–öç7Ð¢óà ¢ÆF—b6Æ74æÖS×¶G·7G–ÆW2æf÷&Ô7F–öç7ÒG·7G–ÆW2æW‡÷'D7F–öç7ÒG·7G–ÆW2çV÷FUG&6¶–æu6WGF–æw47F–öç7ÖÓà¢Æ'WGFöâG—SÒ&'WGFöâ"6Æ74æÖS×·7G–ÆW2ç6V6öæF'”'WGFöçÒöä6Æ–6³×¶6æ6VÅV÷FUG&6¶–æu6WGF–æw7Óà¢6æ6VÀ¢Âö'WGFöãà¢·V÷FUG&6´Ö–çFVææ6Rò€¢Æ'WGFöà¢G—SÒ&'WGFöâ ¢6Æ74æÖS×·7G–ÆW2ç6V6öæF'”'WGFöçÐ¢öä6Æ–6³×²‚’Óâ°¢6WEV÷FUG&6´Ö–çFVææ6R†fÇ6R“°¢6Æ÷6UV÷FUG&6¶–æu6WGF–æw2‚“°¢×Ð¢à¢F—6&ÆRG&6¶–æp¢Âö'WGFöãà¢’¢çVÆÇÐ¢Æ'WGFöâG—SÒ&'WGFöâ"6Æ74æÖS×·7G–ÆW2ç&–Ö'”'WGFöçÒöä6Æ–6³×¶6öæf—&ÕV÷FUG&6¶–æu6WGF–æw7Óà¢6fRG&6¶–ær6WGF–æw0¢Âö'WGFöãà¢ÂöF—cà¢ÂöF—cà¢ÂöF—cà¢ÂöF—cà¢’¢çVÆÇÐ ¢·&WÆ6VÖVçE&–6U&WfÇVU&ö×Bò€¢ÆF—b6Æ74æÖS×¶G·7G–ÆW2æÖöFÄ÷fW&Æ—ÒG·7G–ÆW2æ76WE6WGF–æw46öæf—&Ô÷fW&Æ—ÖÓà¢ÆF—b6Æ74æÖS×·7G–ÆW2æÖöFÄ&6¶G&÷Òöä6Æ–6³×¶6Æ÷6U&WÆ6VÖVçE&–6U&WfÇVU&ö×GÒóà ¢ÆF—`¢6Æ74æÖS×¶G·7G–ÆW2æÖöFÄ6&GÒG·7G–ÆW2æ76WE6WGF–æw46öæf—&ÔÖöFÇÖÐ¢&öÆSÒ&F–Æör ¢&–ÖÖöFÃÒ'G'VR ¢&–ÖÆ&VÆÆVF'“Ò'&WÆ6VÖVçB×&–6R×&WfÇVR×F—FÆR ¢à¢ÆF—b6Æ74æÖS×¶G·7G–ÆW2æÖöFÄ†VFW'ÒG·7G–ÆW2æ76WE6WGF–æw4†VFW'ÖÓà¢ÆF—b6Æ74æÖS×·7G–ÆW2æÖöFÄ†VFW%FW‡GÓà¢Æƒ2–CÒ'&WÆ6VÖVçB×&–6R×&WfÇVR×F—FÆR#å&WÆ6VÖVçB&–6R6†ævVCÂöƒ3à¢Çç·&WÆ6VÖVçE&–6U&WfÇVU&ö×Bæ76WBçF—FÆWÓÂ÷à¢ÂöF—cà ¢Æ'WGFöà¢G—SÒ&'WGFöâ ¢6Æ74æÖS×·7G–ÆW2æÖöFÄ6Æ÷6T'WGFöçÐ¢öä6Æ–6³×¶6Æ÷6U&WÆ6VÖVçE&–6U&WfÇVU&ö×GÐ¢&–ÖÆ&VÃÒ$6Æ÷6R&WÆ6VÖVçB&–6R&V6Æ7VÆF–öâ6öæf—&ÖF–öâ ¢à¢Ä6Æ÷6T–6öâ6Æ74æÖS×·7G–ÆW2æ'WGFöä–6öçÒóà¢Âö'WGFöãà¢ÂöF—cà ¢ÆF—b6Æ74æÖS×¶G·7G–ÆW2æÖöFÅ67&öÆÄ&öG—ÒG·7G–ÆW2æ76WE6WGF–æw4&öG—ÖÓà¢Ç6Æ74æÖS×·7G–ÆW2æ76WE6WGF–æw46öæf—&Ô6÷—Óà¢Fò–÷RvçBFò&V6Æ7VÆFRF†—276WN(	—2–ÓG&–6RfÇVRW6–ær¶ÖöæW’‡&WÆ6VÖVçE&–6U&WfÇVU&ö×BææWu&WÆ6VÖVçE&–6TW…fB—ÒW†6ÂâdCð¢Â÷à ¢ÆF—b6Æ74æÖS×·7G–ÆW2æ76WE6WGF–æw47F–öç7Óà¢Æ'WGFöâG—SÒ&'WGFöâ"6Æ74æÖS×·7G–ÆW2ç6V6öæF'”'WGFöçÒöä6Æ–6³×¶6Æ÷6U&WÆ6VÖVçE&–6U&WfÇVU&ö×GÓà¢æ÷Bæ÷p¢Âö'WGFöãà¢Æ'WGFöâG—SÒ&'WGFöâ"6Æ74æÖS×·7G–ÆW2ç&–Ö'”'WGFöçÒöä6Æ–6³×¶÷Vå&WÆ6VÖVçE&–6U&WfÇVU&ö×DfÆ÷wÓà¢&V6Æ7VÆFRfÇVP¢Âö'WGFöãà¢ÂöF—cà¢ÂöF—cà¢ÂöF—cà¢ÂöF—cà¢’¢çVÆÇÐ ¢¶66÷VçFçDæ÷FT76WBbb—466÷VçFçEv÷&·76Rò€¢ÆF—b6Æ74æÖS×·7G–ÆW2æÖöFÄ÷fW&Æ—Óà¢ÆF—b6Æ74æÖS×·7G–ÆW2æÖöFÄ&6¶G&÷Òöä6Æ–6³×¶6Æ÷6T66÷VçFçDæ÷FTÖöFÇÒóà ¢ÆF—`¢6Æ74æÖS×¶G·7G–ÆW2æÖöFÄ6&GÒG·7G–ÆW2ç6†&VDæ÷FTÖöFÇÒG·7G–ÆW2æ66÷VçFçDæ÷FTÖöFÇÖÐ¢&öÆSÒ&F–Æör ¢&–ÖÖöFÃÒ'G'VR ¢&–ÖÆ&VÆÆVF'“Ò&66÷VçFçBÖæ÷FR×F—FÆR ¢à¢ÆF—b6Æ74æÖS×·7G–ÆW2æÖöFÄ†VFW'Óà¢ÆF—b6Æ74æÖS×·7G–ÆW2æÖöFÄ†VFW%FW‡GÓà¢Æƒ2–CÒ&66÷VçFçBÖæ÷FR×F—FÆR#äÆVfRæ÷FSÂöƒ3à¢Çç¶66÷VçFçDæ÷FT76WBçF—FÆWÒ+r¶66÷VçFçD66W73òæ÷væW$'W6–æW74æÖRÇÂt76WB÷væW"wÓÂ÷à¢ÂöF—cà ¢Æ'WGFöà¢G—SÒ&'WGFöâ ¢6Æ74æÖS×·7G–ÆW2æÖöFÄ6Æ÷6T'WGFöçÐ¢öä6Æ–6³×¶6Æ÷6T66÷VçFçDæ÷FTÖöFÇÐ¢&–ÖÆ&VÃÒ$6Æ÷6Ræ÷FRÖöFÂ ¢F—6&ÆVC×¶—56f–æt66÷VçFçDæ÷FWÐ¢à¢Ä6Æ÷6T–6öâ6Æ74æÖS×·7G–ÆW2æ'WGFöä–6öçÒóà¢Âö'WGFöãà¢ÂöF—cà ¢ÆF—b6Æ74æÖS×·7G–ÆW2æ66÷VçFçDæ÷FT&öG—Óà¢ÆÆ&VÂ6Æ74æÖS×¶G·7G–ÆW2æf–VÆGÒG·7G–ÆW2ç6†&VDæ÷FTf–VÆGÖÓà¢Ç7ãäæ÷FRFò76WB÷væW#Â÷7ãà¢ÇFW‡F&V¢6Æ74æÖS×·7G–ÆW2ç6†&VDæ÷FUFW‡F&VÐ¢fÇVS×¶66÷VçFçDæ÷FTG&gGÐ¢öä6†ævS×²†WfVçB’Óâ6WD66÷VçFçDæ÷FTG&gB†WfVçBçF&vWBçfÇVR—Ð¢Æ6V†öÆFW#Ò%w&—FR–÷W"æ÷FR†W&Râ ¢F—6&ÆVC×¶—56f–æt66÷VçFçDæ÷FWÐ¢WFôfö7W0¢óà¢ÂöÆ&VÃà¢Ç6Æ74æÖS×·7G–ÆW2æ66÷VçFçDæ÷FT†–çGÓåF†—2æ÷FRv–ÆÂV"öâF†R÷væW"f÷3·276WB&Vv—7FW"ãÂ÷à¢ÂöF—cà ¢ÆF—b6Æ74æÖS×¶G·7G–ÆW2æf÷&Ô7F–öç7ÒG·7G–ÆW2ç6†&VDæ÷FT7F–öç7ÒG·7G–ÆW2æ66÷VçFçDæ÷FT7F–öç7ÖÓà¢Æ'WGFöâG—SÒ&'WGFöâ"6Æ74æÖS×·7G–ÆW2ç6V6öæF'”'WGFöçÒöä6Æ–6³×¶6Æ÷6T66÷VçFçDæ÷FTÖöFÇÒF—6&ÆVC×¶—56f–æt66÷VçFçDæ÷FWÓà¢6æ6VÀ¢Âö'WGFöãà¢Æ'WGFöâG—SÒ&'WGFöâ"6Æ74æÖS×·7G–ÆW2ç&–Ö'”'WGFöçÒöä6Æ–6³×²‚’Óâfö–B7V&Ö—D66÷VçFçDæ÷FR‚—ÒF—6&ÆVC×¶—56f–æt66÷VçFçDæ÷FRÇÂ66÷VçFçDæ÷FTG&gBçG&–Ò‚—Óà¢¶—56f–æt66÷VçFçDæ÷FRòu6f–ærâââr¢u6fRæ÷FRwÐ¢Âö'WGFöãà¢ÂöF—cà¢ÂöF—cà¢ÂöF—cà¢’¢çVÆÇÐ ¢¶7F—fT76WBbb—466÷VçFçEv÷&·76Rò€¢66÷VçFçE6†&T–Bbb66÷VçFçD66W72ò€¢Ä66÷VçFçD76WDÖævTÖöFÀ¢6†&T–C×¶66÷VçFçE6†&T–GÐ¢76WC×¶7F—fT76WGÐ¢76WG3×¶76WG7Ð¢ÆÆ÷tF—&V7EWFFW3×¶66÷VçFçD66W72æÆÆ÷tF—&V7EWFFW7Ð¢–æ6ÇVFTgVVÄÆVFvW#×¶66÷VçFçD66W72æ–æ6ÇVFTgVVÄÆVFvW'Ð¢–æ6ÇVFT6÷7DÆVFvW#×¶66÷VçFçD66W72æ–æ6ÇVFT6÷7DÆVFvW'Ð¢öä6Æ÷6S×¶6Æ÷6T7F–öäF–ÆöwÐ¢öä6†ævVC×²†ÖW76vR’Óâ°¢6WDæ÷F–6R‡²FöæS¢w7V66W72rÂÖW76vRÒ“°¢v–æF÷ræF—7F6„WfVçB†æWrWfVçB‚v–ÓG&–6S¦76WB×&Vv—7FW"×WFFVBr’“°¢×Ð¢óà¢’¢çVÆÀ¢’¢7F—fT76WBò€¢ÆF—b6Æ74æÖS×¶G·7G–ÆW2æÖöFÄ÷fW&Æ—ÒG·7G–ÆW2æ÷væW$6öÖÖæD÷fW&Æ—ÖÓà¢ÆF—b6Æ74æÖS×·7G–ÆW2æÖöFÄ&6¶G&÷Òöä6Æ–6³×¶6Æ÷6T7F–öäF–ÆöwÒóà ¢ÆF—b6Æ74æÖS×¶G·7G–ÆW2æ÷F–öç4ÖöFÇÒG·7G–ÆW2æ÷væW$6öÖÖæDÖöFÇÖÒ&öÆSÒ&F–Æör"&–ÖÖöFÃÒ'G'VR"&–ÖÆ&VÆÆVF'“Ò&76WBÖÖævR×F—FÆR#à¢ÆF—b6Æ74æÖS×¶G·7G–ÆW2æÖöFÄ†VFW'ÒG·7G–ÆW2æ÷F–öç4ÖöFÄ†VFW'ÖÓà¢ÆF—b6Æ74æÖS×·7G–ÆW2æÖöFÄ†VFW%FW‡GÓà¢Æƒ2–CÒ&76WBÖÖævR×F—FÆR#ç¶7F—fT76WBçF—FÆWÓÂöƒ3à¢Çç¶'V–ÆD76WDÖWF†7F—fT76WB—ÓÂ÷à¢ÂöF—cà ¢Æ'WGFöà¢G—SÒ&'WGFöâ ¢6Æ74æÖS×·7G–ÆW2æÖöFÄ6Æ÷6T'WGFöçÐ¢öä6Æ–6³×¶6Æ÷6T7F–öäF–ÆöwÐ¢&–ÖÆ&VÃÒ$6Æ÷6R76WBÖævVÖVçB ¢à¢Ä6Æ÷6T–6öâ6Æ74æÖS×·7G–ÆW2æ'WGFöä–6öçÒóà¢Âö'WGFöãà¢ÂöF—cà ¢ÆF—b6Æ74æÖS×¶G·7G–ÆW2æÖöFÅ67&öÆÄ&öG—ÒG·7G–ÆW2æ÷F–öç567&öÆÄ&öG—ÒG·7G–ÆW2æ÷væW$6öÖÖæE67&öÆÄ&öG—ÖÓà¢ÆF—b6Æ74æÖS×·7G–ÆW2æ÷F–öç46öçFVçGÓà¢ÆF—b6Æ74æÖS×¶G·7G–ÆW2æ÷F–öç4w&–GÒG·7G–ÆW2æ76WD÷F–öç4w&–GÒG·7G–ÆW2æ÷væW$6öÖÖæDw&–GÖÓà¢Æ'WGFöà¢G—SÒ&'WGFöâ ¢6Æ74æÖS×¶G·7G–ÆW2æ÷F–öä7F–öä'WGFöçÒG·7G–ÆW2æ÷F–öäfVGW&VD'WGFöçÒG·7G–ÆW2æ÷væW$6öÖÖæD7F–öçÖÐ¢FFÖ76WB×&WGW&âÖ7F–öãÒ&ÖævR×WFFR ¢öä6Æ–6³×²†WfVçB’Óâ°¢6öç7B76WBÒ7F—fT76WC°¢&VÖVÖ&W$76WDÖöFÅ&WGW&â†76WBÂvÖævRrÂvÖævR×WFFRrÂWfVçBæ7W'&VçEF&vWB“°¢6Æ÷6T7F–öäF–Æör‚“°¢÷VåWFFW"†76WB“°¢×Ð¢à¢ÅWFFT76WD–6öâ6Æ74æÖS×·7G–ÆW2æ'WGFöä–6öçÒóà¢Ç7ãà¢Ç7G&öæsåWFFR76WCÂ÷7G&öæsà¢Ç6ÖÆÃäVF—BFWF–Ç2ÂFö7VÖVçG2Â†÷F÷2æB7FGW2ãÂ÷6ÖÆÃà¢Â÷7ãà¢Âö'WGFöãà ¢Æ'WGFöâG—SÒ&'WGFöâ"6Æ74æÖS×¶G·7G–ÆW2æ÷F–öä7F–öä'WGFöçÒG·7G–ÆW2æ÷væW$6öÖÖæD7F–öçÖÒöä6Æ–6³×¶÷Vä76WE&W÷'DF–ÆöwÓà¢ÄF÷væÆöD–6öâ6Æ74æÖS×·7G–ÆW2æ'WGFöä–6öçÒóà¢Ç7ãà¢Ç7G&öæså&W÷'G3Â÷7G&öæsà¢Ç6ÖÆÃä6†ö÷6RæBF÷væÆöB76WB&W÷'G2ãÂ÷6ÖÆÃà¢Â÷7ãà¢Âö'WGFöãà ¢ÄÆ–æ°¢‡&Vc×¶'V–ÆD÷væW$76WEvT‡&Vb‚rö×’Ö–çfö–6W2rÂ7F—fT76WBæ–BÂ²FC¢G'VRÒÂ÷væW$6öÖÖæE&WGW&äÆö6F–öâ—Ð¢6Æ74æÖS×¶G·7G–ÆW2æ÷F–öä7F–öä'WGFöçÒG·7G–ÆW2æ÷væW$6öÖÖæD7F–öçÖÐ¢à¢ÄÖöæW”&t–6öâ6Æ74æÖS×·7G–ÆW2æ'WGFöä–6öçÒóà¢Ç7ãà¢Ç7G&öæsäFB6÷7CÂ÷7G&öæsà¢Ç6ÖÆÃå&V6÷&BâW‡Vç6Rf÷"F†—276WBãÂ÷6ÖÆÃà¢Â÷7ãà¢ÂôÆ–æ³à ¢¶6ä76WE&V6V—fTgVVÂ†7F—fT76WB’ò€¢ÄÆ–æ°¢‡&Vc×¶'V–ÆD÷væW$76WEvT‡&Vb‚rögVVÂrÂ7F—fT76WBæ–BÂ²FC¢G'VRÒÂ÷væW$6öÖÖæE&WGW&äÆö6F–öâ—Ð¢6Æ74æÖS×¶G·7G–ÆW2æ÷F–öä7F–öä'WGFöçÒG·7G–ÆW2æ÷væW$6öÖÖæD7F–öçÖÐ¢à¢ÅÇW4–6öâ6Æ74æÖS×·7G–ÆW2æ'WGFöä–6öçÒóà¢Ç7ãà¢Ç7G&öæsäFBgVVÃÂ÷7G&öæsà¢Ç6ÖÆÃä6GW&RgVVÂ&V6÷&Bf÷"F†—276WBãÂ÷6ÖÆÃà¢Â÷7ãà¢ÂôÆ–æ³à¢’¢çVÆÇÐ ¢Æ'WGFöà¢G—SÒ&'WGFöâ ¢6Æ74æÖS×¶G·7G–ÆW2æ÷F–öä7F–öä'WGFöçÒG·7G–ÆW2æ÷væW$6öÖÖæD7F–öçÖÐ¢FFÖ76WB×&WGW&âÖ7F–öãÒ&ÖævRÖÖ–çFVææ6R ¢öä6Æ–6³×²‚’Óâ6WD÷væW$76WD6öÖÖæEæVÂ‚vÖ–çFVææ6Rr—Ð¢à¢ÄÖævT–6öâ6Æ74æÖS×·7G–ÆW2æ'WGFöä–6öçÒóà¢Ç7ãà¢Ç7G&öæsäÖ–çFVææ6SÂ÷7G&öæsà¢Ç6ÖÆÃäFB÷"&Wf–WrÖ–çFVææ6R&V6÷&G2ãÂ÷6ÖÆÃà¢Â÷7ãà¢Âö'WGFöãà ¢¶6äÖævT76WE&–6–ær†7F—fT76WB’ò€¢Æ'WGFöâG—SÒ&'WGFöâ"6Æ74æÖS×¶G·7G–ÆW2æ÷F–öä7F–öä'WGFöçÒG·7G–ÆW2æ÷væW$6öÖÖæD7F–öçÖÒöä6Æ–6³×¶÷Vå&–6–ætF–ÆöwÓà¢ÅG&VæD–6öâ6Æ74æÖS×·7G–ÆW2æ'WGFöä–6öçÒóà¢Ç7ãà¢Ç7G&öæsäÖævR&–6–æsÂ÷7G&öæsà¢Ç6ÖÆÃå&Vg&W6‚fÇVW2÷"6Æ7VÆFRgWGW&RfÇVRãÂ÷6ÖÆÃà¢Â÷7ãà¢Âö'WGFöãà¢’¢çVÆÇÐ ¢¶6åW6T÷væW$öæÇ”76WD7F–öç2ò€¢Æ'WGFöâG—SÒ&'WGFöâ"6Æ74æÖS×¶G·7G–ÆW2æ÷F–öä7F–öä'WGFöçÒG·7G–ÆW2æ÷væW$6öÖÖæD7F–öçÖÒöä6Æ–6³×¶÷Vå$F–ÆöwÓà¢Å$–6öâ6Æ74æÖS×·7G–ÆW2æ'WGFöä–6öçÒóà¢Ç7ãà¢Ç7G&öæså"6öFSÂ÷7G&öæsà¢Ç6ÖÆÃä6÷’ÂF÷væÆöB÷"&–çBF†R"Æ&VÂãÂ÷6ÖÆÃà¢Â÷7ãà¢Âö'WGFöãà¢’¢çVÆÇÐ ¢¶6åW6TÖ&¶WGÆ6T7F–öç2bb—4Ö&¶WGÆ6TVÆ–v–&ÆR†7F—fT76WB’ò€¢Æ'WGFöâG—SÒ&'WGFöâ"6Æ74æÖS×¶G·7G–ÆW2æ÷F–öä7F–öä'WGFöçÒG·7G–ÆW2æ÷væW$6öÖÖæD7F–öçÖÒöä6Æ–6³×²‚’Óâ†æFÆUV&Æ—6„g&öÔF–Æör†7F—fT76WB—Óà¢Ä6'D–6öâ6Æ74æÖS×·7G–ÆW2æ'WGFöä–6öçÒóà¢Ç7ãà¢Ç7G&öæsäÖ&¶WGÆ6SÂ÷7G&öæsà¢Ç6ÖÆÃç¶—4Æ—fTöäÖ&¶WGÆ6R†7F—fT76WB’òuWFFR÷"&VÖ÷fRF†RÆ—fRÆ—7F–ærâr¢t7&VFRÆ—7F–ærf÷"F†—276WBâwÓÂ÷6ÖÆÃà¢Â÷7ãà¢Âö'WGFöãà¢’¢çVÆÇÐ ¢¶6åW6T÷væW$öæÇ”76WD7F–öç2ò€¢Æ'WGFöà¢G—SÒ&'WGFöâ ¢6Æ74æÖS×¶G·7G–ÆW2æ÷F–öä7F–öä'WGFöçÒG·7G–ÆW2æ÷F–öäFævW$'WGFöçÒG·7G–ÆW2æ÷væW$6öÖÖæD7F–öçÒG·7G–ÆW2æ÷væW$6öÖÖæDFævW$7F–öçÖÐ¢F—6&ÆVC×¶'W7”FVÆWFT–BÓÓÒ7F—fT76WBæ–GÐ¢öä6Æ–6³×²‚’Óâ†æFÆTFVÆWFTg&öÔF–Æör†7F—fT76WB—Ð¢à¢ÅG&6„–6öâ6Æ74æÖS×·7G–ÆW2æ'WGFöä–6öçÒóà¢Ç7ãà¢Ç7G&öæsç¶'W7”FVÆWFT–BÓÓÒ7F—fT76WBæ–Bòu&VÖ÷f–ærâââr¢tF—7÷6R÷"&VÖ÷fR76WBwÓÂ÷7G&öæsà¢Ç6ÖÆÃä&6†—fRÂ6VÆÂÂw&—FRöfb÷"&VÖ÷fRãÂ÷6ÖÆÃà¢Â÷7ãà¢Âö'WGFöãà¢’¢çVÆÇÐ¢ÂöF—cà¢ÂöF—cà¢ÂöF—cà¢ÂöF—cà¢ÂöF—cà¢’¢çVÆÇÐ ¢¶7F—fT76WBbb÷væW$76WD6öÖÖæEæVÂò€¢ÆF—b6Æ74æÖS×¶G·7G–ÆW2æÖöFÄ÷fW&Æ—ÒG·7G–ÆW2ç7V$ÖöFÄ÷fW&Æ—ÒG·7G–ÆW2æ÷væW$6öÖÖæD6†ö–6T÷fW&Æ—ÖÓà¢ÆF—b6Æ74æÖS×·7G–ÆW2æÖöFÄ&6¶G&÷Òöä6Æ–6³×²‚’Óâ6WD÷væW$76WD6öÖÖæEæVÂ†çVÆÂ—Òóà ¢ÆF—`¢6Æ74æÖS×¶G·7G–ÆW2æÖöFÄ6&GÒG·7G–ÆW2æ÷væW$6öÖÖæD6†ö–6TÖöFÇÖÐ¢&öÆSÒ&F–Æör ¢&–ÖÖöFÃÒ'G'VR ¢&–ÖÆ&VÆÆVF'“Ò&÷væW"Ö6öÖÖæBÖ6†ö–6R×F—FÆR ¢à¢ÆF—b6Æ74æÖS×¶G·7G–ÆW2æÖöFÄ†VFW'ÒG·7G–ÆW2æ÷væW$6öÖÖæD6†ö–6T†VFW'ÖÓà¢ÆF—b6Æ74æÖS×·7G–ÆW2æÖöFÄ†VFW%FW‡GÓà¢Æƒ2–CÒ&÷væW"Ö6öÖÖæBÖ6†ö–6R×F—FÆR#äÖ–çFVææ6SÂöƒ3à¢Çç¶7F—fT76WBçF—FÆWÓÂ÷à¢ÂöF—cà ¢Æ'WGFöà¢G—SÒ&'WGFöâ ¢6Æ74æÖS×·7G–ÆW2æÖöFÄ6Æ÷6T'WGFöçÐ¢öä6Æ–6³×²‚’Óâ6WD÷væW$76WD6öÖÖæEæVÂ†çVÆÂ—Ð¢&–ÖÆ&VÃÒ$6Æ÷6RÖ–çFVææ6R6†ö–6W2 ¢à¢Ä6Æ÷6T–6öâ6Æ74æÖS×·7G–ÆW2æ'WGFöä–6öçÒóà¢Âö'WGFöãà¢ÂöF—cà ¢ÆF—b6Æ74æÖS×·7G–ÆW2æ÷væW$6öÖÖæD6†ö–6T&öG—Óà¢ÆF—b6Æ74æÖS×·7G–ÆW2æ÷væW$6öÖÖæD6†ö–6Tw&–GÓà¢ÄÆ–æ°¢‡&Vc×¶'V–ÆD÷væW$76WEvT‡&Vb‚röÖ–çFVææ6RrÂ7F—fT76WBæ–BÂ²FC¢G'VRÒÂ÷væW$6öÖÖæE&WGW&äÆö6F–öâ—Ð¢6Æ74æÖS×¶G·7G–ÆW2æ÷F–öä7F–öä'WGFöçÒG·7G–ÆW2æ÷væW$6öÖÖæD6†ö–6T7F–öçÒG·7G–ÆW2æ÷F–öäfVGW&VD'WGFöçÖÐ¢à¢ÅÇW4–6öâ6Æ74æÖS×·7G–ÆW2æ'WGFöä–6öçÒóà¢Ç7ãà¢Ç7G&öæsäFBÖ–çFVææ6SÂ÷7G&öæsà¢Ç6ÖÆÃä7&VFRÖ–çFVææ6R&V6÷&BÇ&VG’Æ–æ¶VBFòF†—276WBãÂ÷6ÖÆÃà¢Â÷7ãà¢ÂôÆ–æ³à ¢ÄÆ–æ°¢‡&Vc×¶'V–ÆD÷væW$76WEvT‡&Vb‚röÖ–çFVææ6RrÂ7F—fT76WBæ–BÂ·ÒÂ÷væW$6öÖÖæE&WGW&äÆö6F–öâ—Ð¢6Æ74æÖS×¶G·7G–ÆW2æ÷F–öä7F–öä'WGFöçÒG·7G–ÆW2æ÷væW$6öÖÖæD6†ö–6T7F–öçÖÐ¢à¢ÄÖævT–6öâ6Æ74æÖS×·7G–ÆW2æ'WGFöä–6öçÒóà¢Ç7ãà¢Ç7G&öæsäÖævRÖ–çFVææ6SÂ÷7G&öæsà¢Ç6ÖÆÃä÷VâF†—276WBf÷3·26W'f–6R†—7F÷'’Â66†VGVÆRæB&VÖ–æFW'2ãÂ÷6ÖÆÃà¢Â÷7ãà¢ÂôÆ–æ³à ¢¶7F—fT76WBæ¶–æBÓÒw&÷W'G’rbb7F—fTFVÆW%G&6¶–æt'”76WD–E¶7F—fT76WBæ–EÒÓÓÒG'VRò€¢Æ'WGFöà¢G—SÒ&'WGFöâ ¢6Æ74æÖS×¶G·7G–ÆW2æ÷F–öä7F–öä'WGFöçÒG·7G–ÆW2æ÷væW$6öÖÖæD6†ö–6T7F–öçÖÐ¢öä6Æ–6³×²‚’Óâ°¢6öç7B76WBÒ7F—fT76WC°¢6WD÷væW$76WD6öÖÖæEæVÂ†çVÆÂ“°¢fö–B÷VäFVÆW%G&6¶–æu6WGF–æw2†76WB“°¢×Ð¢à¢ÄÖævT–6öâ6Æ74æÖS×·7G–ÆW2æ'WGFöä–6öçÒóà¢Ç7ãà¢Ç7G&öæsäFVÆW"G&6¶–ær6WGF–æw3Â÷7G&öæsà¢Ç6ÖÆÃå&Wf–WrFVÆW"Ö–çFVææ6R66W72æBWFFRW&Ö—76–öç2ãÂ÷6ÖÆÃà¢Â÷7ãà¢Âö'WGFöãà¢’¢çVÆÇÐ¢ÂöF—cà¢ÂöF—cà¢ÂöF—cà¢ÂöF—cà¢’¢çVÆÇÐ ¢¶7F—fT76WBbb—4FVÆW%G&6¶–æu6WGF–æw4÷Vâò€¢ÆF—b6Æ74æÖS×¶G·7G–ÆW2æÖöFÄ÷fW&Æ—ÒG·7G–ÆW2ç7V$ÖöFÄ÷fW&Æ—ÖÓà¢ÆF—b6Æ74æÖS×·7G–ÆW2æÖöFÄ&6¶G&÷Òöä6Æ–6³×²‚’Óâ6WD—4FVÆW%G&6¶–æu6WGF–æw4÷Vâ†fÇ6R—Òóà ¢ÆF—b6Æ74æÖS×¶G·7G–ÆW2æÖöFÄ6&GÒG·7G–ÆW2ç&–6–ætÖöFÇÒG·7G–ÆW2æFVÆW%G&6¶–ætÖöFÇÖÒ&öÆSÒ&F–Æör"&–ÖÖöFÃÒ'G'VR"&–ÖÆ&VÆÆVF'“Ò&FVÆW"×G&6¶–ær×6WGF–æw2×F—FÆR#à¢ÆF—b6Æ74æÖS×¶G·7G–ÆW2æÖöFÄ†VFW'ÒG·7G–ÆW2ç&–6–ætÖöFÄ†VFW'ÒG·7G–ÆW2æFVÆW%G&6¶–æt†VFW'ÖÓà¢ÆF—b6Æ74æÖS×·7G–ÆW2æÖöFÄ†VFW%FW‡GÓà¢Æƒ2–CÒ&FVÆW"×G&6¶–ær×6WGF–æw2×F—FÆR#äFVÆW"G&6¶–ær6WGF–æw3Âöƒ3à¢Çç¶7F—fT76WBçF—FÆWÓÂ÷à¢ÂöF—cà ¢Æ'WGFöâG—SÒ&'WGFöâ"6Æ74æÖS×·7G–ÆW2æÖöFÄ6Æ÷6T'WGFöçÒöä6Æ–6³×²‚’Óâ6WD—4FVÆW%G&6¶–æu6WGF–æw4÷Vâ†fÇ6R—Ò&–ÖÆ&VÃÒ$6Æ÷6RFVÆW"G&6¶–ær6WGF–æw2#à¢Ä6Æ÷6T–6öâ6Æ74æÖS×·7G–ÆW2æ'WGFöä–6öçÒóà¢Âö'WGFöãà¢ÂöF—cà ¢ÆF—b6Æ74æÖS×¶G·7G–ÆW2æÖöFÅ67&öÆÄ&öG—ÒG·7G–ÆW2ç&–6–ætÖöFÄ&öG—ÒG·7G–ÆW2æFVÆW%G&6¶–æt&öG—ÖÓà¢¶—4ÆöF–ætFVÆW%G&6¶–æu6WGF–æw2ò€¢ÆF—b6Æ74æÖS×·7G–ÆW2æV×G•7FFWÓäÆöF–ærFVÆW"G&6¶–ær6WGF–æw>(
cÂöF—cà¢’¢€¢Ãà¢ÆF—b6Æ74æÖS×·7G–ÆW2æFVÆW%G&6¶–æt–çG&÷Óà¢Ç7G&öæsäFVÆW'2v—F‚66W73Â÷7G&öæsà¢Çå6VÆV7BFVÆW"Fò&Wf–Wr÷"6†ævRF†V—"66W72â÷væW"&÷fÂ—27F–ÆÂ&WV—&VBf÷"66†VGVÆW2æB76WB6†ævW2ãÂ÷à¢ÂöF—cà¢ÄFVÆW$Ö–çFVææ6T66W756WGF–æw0¢76WD–C×¶7F—fT76WBæ–GÐ¢VçG&–W3×¶FVÆW%G&6¶–æt66W77Ð¢×WFF–öåW&ÃÒ"ö’öFVÆW"ÖÖ–çFVææ6RÖ66W72 ¢öäVçG&–W46†ævS×²†VçG&–W2’Óâ°¢6WDFVÆW%G&6¶–æt66W72†VçG&–W2“°¢6WD7F—fTFVÆW%G&6¶–æt'”76WD–B‚†7W'&VçB’Óâ‡°¢ââæ7W'&VçBÀ¢¶7F—fT76WBæ–EÓ¢VçG&–W2æÆVæwF‚âÀ¢Ò’“°¢×Ð¢óà¢Âóà¢—Ð¢ÂöF—cà¢ÂöF—cà¢ÂöF—cà¢’¢çVÆÇÐ ¢¶7F—fT76WBbb—5&–6–ætÖöFÄ÷Vâò€¢ÆF—b6Æ74æÖS×¶G·7G–ÆW2æÖöFÄ÷fW&Æ—ÒG·7G–ÆW2ç7V$ÖöFÄ÷fW&Æ—ÖÓà¢ÆF—b6Æ74æÖS×·7G–ÆW2æÖöFÄ&6¶G&÷Òöä6Æ–6³×¶6Æ÷6U&–6–ætF–ÆöwÒóà ¢ÆF—b6Æ74æÖS×¶G·7G–ÆW2æÖöFÄ6&GÒG·7G–ÆW2ç&–6–ætÖöFÇÖÒ&öÆSÒ&F–Æör"&–ÖÖöFÃÒ'G'VR"&–ÖÆ&VÆÆVF'“Ò&76WB×&–6–ær×F—FÆR#à¢ÆF—b6Æ74æÖS×¶G·7G–ÆW2æÖöFÄ†VFW'ÒG·7G–ÆW2ç&–6–ætÖöFÄ†VFW'ÖÓà¢ÆF—b6Æ74æÖS×·7G–ÆW2æÖöFÄ†VFW%FW‡GÓà¢Æƒ2–CÒ&76WB×&–6–ær×F—FÆR#ç¶7F—fT76WBçF—FÆWÓÂöƒ3à¢Çç¶'V–ÆD76WDÖWF†7F—fT76WB—ÓÂ÷à¢ÂöF—cà ¢Æ'WGFöâG—SÒ&'WGFöâ"6Æ74æÖS×·7G–ÆW2æÖöFÄ6Æ÷6T'WGFöçÒöä6Æ–6³×¶6Æ÷6U&–6–ætF–ÆöwÒ&–ÖÆ&VÃÒ$6Æ÷6R&–6–ær÷F–öç2#à¢Ä6Æ÷6T–6öâ6Æ74æÖS×·7G–ÆW2æ'WGFöä–6öçÒóà¢Âö'WGFöãà¢ÂöF—cà ¢ÆF—b6Æ74æÖS×¶G·7G–ÆW2æÖöFÅ67&öÆÄ&öG—ÒG·7G–ÆW2ç&–6–ætÖöFÄ&öG—ÖÓà¢ÆF—b6Æ74æÖS×·7G–ÆW2ç&–6–æt÷F–öç4w&–GÓà¢Æ'WGFöà¢G—SÒ&'WGFöâ ¢6Æ74æÖS×·7G–ÆW2ç&–6–æt÷F–öä'WGFöçÐ¢F—6&ÆVC×²6å&Vg&W6„76WDW7F–ÖFR†7F—fT76WB’ÇÂ'W7•&WfÇVT76WD–BÓÓÒ7F—fT76WBæ–BÇÂ—4ÆöF–æu&–6–æu&Wf–WrÇÂ—56f–æu&–6–æu&Wf–WwÐ¢öä6Æ–6³×²‚’Óâ÷Vå&WfÇVTwV–FVDF–Æör†7F—fT76WB—Ð¢à¢ÅG&VæD–6öâ6Æ74æÖS×·7G–ÆW2æ'WGFöä–6öçÒóà¢Ç7ãà¢Ç7G&öæså&V6Æ7VÆFRfÇVSÂ÷7G&öæsà¢Â÷7ãà¢Âö'WGFöãà ¢Æ'WGFöà¢G—SÒ&'WGFöâ ¢6Æ74æÖS×·7G–ÆW2ç&–6–æt÷F–öä'WGFöçÐ¢F—6&ÆVC×²6å&ö¦V7DgWGW&U&–6R†7F—fT76WB’ÇÂ'W7•&WfÇVT76WD–BÓÓÒ7F—fT76WBæ–BÇÂ—4ÆöF–æu&–6–æu&Wf–WrÇÂ—56f–æu&–6–æu&Wf–WwÐ¢öä6Æ–6³×²‚’Óâ÷Vå&ö¦V7F–öäÖöFÂ†7F—fT76WB—Ð¢à¢ÅG&VæD–6öâ6Æ74æÖS×·7G–ÆW2æ'WGFöä–6öçÒóà¢Ç7ãà¢Ç7G&öæsä6Æ7VÆFRgWGW&R&–6SÂ÷7G&öæsà¢Â÷7ãà¢Âö'WGFöãà¢ÂöF—cà ¢²6å&Vg&W6„76WDW7F–ÖFR†7F—fT76WB’ò€¢Ç6Æ74æÖS×·7G–ÆW2ç&–6–æt÷F–öä†–çGÓäWFöÖF–2&V6Æ7VÆF–öâ—2öæÇ’f–Æ&ÆRf÷"76WG26fVBg&öÒâ–ÓG&–6RfÇVF–öâãÂ÷à¢’¢çVÆÇÐ¢ÂöF—cà¢ÂöF—cà¢ÂöF—cà¢’¢çVÆÇÐ ¢·&–6–æu&Wf–Wrò€¢ÆF—b6Æ74æÖS×¶G·7G–ÆW2æÖöFÄ÷fW&Æ—ÒG·7G–ÆW2ç7V$ÖöFÄ÷fW&Æ—ÒG·7G–ÆW2ç&–6–æu&Wf–Wt÷fW&Æ—ÖÓà¢ÆF—b6Æ74æÖS×·7G–ÆW2æÖöFÄ&6¶G&÷Òöä6Æ–6³×¶6Æ÷6U&–6–æu&Wf–WtF–ÆöwÒóà ¢ÆF—b6Æ74æÖS×¶G·7G–ÆW2æÖöFÄ6&GÒG·7G–ÆW2ç&–6–æu&W7VÇDÖöFÇÖÒ&öÆSÒ&F–Æör"&–ÖÖöFÃÒ'G'VR"&–ÖÆ&VÆÆVF'“Ò'&–6–ær×&Wf–Wr×F—FÆR#à¢ÆF—b6Æ74æÖS×¶G·7G–ÆW2æÖöFÄ†VFW'ÒG·7G–ÆW2ç&–6–æu&W7VÇD†VFW'ÖÓà¢ÆF—b6Æ74æÖS×·7G–ÆW2æÖöFÄ†VFW%FW‡GÓà¢Æƒ2–CÒ'&–6–ær×&Wf–Wr×F—FÆR#ç·&–6–æu&Wf–Wræ76WBçF—FÆWÓÂöƒ3à¢Çç¶'V–ÆD76WDÖWF‡&–6–æu&Wf–Wræ76WB—ÓÂ÷à¢ÂöF—cà ¢Æ'WGFöà¢G—SÒ&'WGFöâ ¢6Æ74æÖS×·7G–ÆW2æÖöFÄ6Æ÷6T'WGFöçÐ¢öä6Æ–6³×¶6Æ÷6U&–6–æu&Wf–WtF–ÆöwÐ¢&–ÖÆ&VÃÒ$6Æ÷6RfÇVR&Wf–Wr ¢F—6&ÆVC×¶—56f–æu&–6–æu&Wf–WwÐ¢à¢Ä6Æ÷6T–6öâ6Æ74æÖS×·7G–ÆW2æ'WGFöä–6öçÒóà¢Âö'WGFöãà¢ÂöF—cà ¢ÆF—b6Æ74æÖS×¶G·7G–ÆW2æÖöFÅ67&öÆÄ&öG—ÒG·7G–ÆW2ç&–6–æu&W7VÇD&öG—ÖÓà¢Ãà¢·&–6–æu&Wf–Wuv—¦&E7FWÓÓÒò€¢Ç6V7F–öâ6Æ74æÖS×¶G·7G–ÆW2ç&WfÇVU&WÆ6VÖVçEæVÇÒG·7G–ÆW2ç&WfÇVU6fVE7FWæVÇÖÓà¢ÆF—b6Æ74æÖS×·7G–ÆW2ç&WfÇVU&WÆ6VÖVçD†VFW'Óà¢ÆF—cà¢Ç7ãå7FWöb3Â÷7ãà¢ÆƒCç·&–6–æu&Wf–Wu6fVE7FWF—FÆWÓÂöƒCà¢ÂöF—cà¢ÂöF—cà ¢ÆF—b6Æ74æÖS×·7G–ÆW2ç&WfÇVU6fVE&WÆ6VÖVçD6&GÓà¢Ç7ãä7W'&VçB&WÆ6VÖVçB&–6SÂ÷7ãà¢Ç7G&öæsç·&–6–æu&Wf–Wu6fVE&WÆ6VÖVçE&–6TW…fBÓÒçVÆÂòG¶ÖöæW’‡&–6–æu&Wf–Wu6fVE&WÆ6VÖVçE&–6TW…fB—ÒW†6ÂâdF¢tæò6fVB&–6RwÓÂ÷7G&öæsà¢Ç6ÖÆÃåF†—2—2F†R&WÆ6VÖVçB&–6R7W'&VçFÇ’6fVBöâF†—276WBãÂ÷6ÖÆÃà¢ÂöF—cà ¢·&VæFW%&WfÇVTÆ–fWF–ÖTf–VÆB‡&–6–æu&Wf–Wræ76WB—Ð¢·&WfÇVTGfæ6VDW'&÷"òÇ6Æ74æÖS×·7G–ÆW2ç&WfÇVU&WÆ6VÖVçDW'&÷'Óç·&WfÇVTGfæ6VDW'&÷'ÓÂ÷â¢çVÆÇÐ ¢ÆF—b6Æ74æÖS×·7G–ÆW2ç&WfÇVTFV6—6–öä6&GÓà¢Ç7G&öæsä6öçF–çVRv—F‚F†—2&WÆ6VÖVçB&–6SóÂ÷7G&öæsà¢ÆF—b6Æ74æÖS×·7G–ÆW2ç&WfÇVTFV6—6–öä7F–öç7Óà¢Æ'WGFöà¢G—SÒ&'WGFöâ ¢6Æ74æÖS×·7G–ÆW2ç&WfÇVT7W7FöÕ&WÆ6VÖVçD'WGFöçÐ¢F—6&ÆVC×·&–6–æu&Wf–Wu6fVE&WÆ6VÖVçE&–6TW…fBÓÓÒçVÆÂÇÂ—4ÆöF–æu&–6–æu&Wf–WrÇÂ—56f–æu&–6–æu&Wf–WwÐ¢öä6Æ–6³×²‚’Óâ÷Vå6fVE&WÆ6VÖVçE&Wf–Wr‡&–6–æu&Wf–Wræ76WB—Ð¢à¢W6RF†—2&–6P¢Âö'WGFöãà¢Æ'WGFöà¢G—SÒ&'WGFöâ ¢6Æ74æÖS×·7G–ÆW2ç&WfÇVU6V6öæF'”'WGFöçÐ¢F—6&ÆVC×¶—4ÆöF–æu&–6–æu&Wf–WrÇÂ—56f–æu&–6–æu&Wf–WwÐ¢öä6Æ–6³×²‚’Óâ6†÷t7W7FöÕ&WÆ6VÖVçE7FW‡&–6–æu&Wf–Wræ76WB—Ð¢à¢VçFW"F–ffW&VçB&–6P¢Âö'WGFöãà¢ÂöF—cà¢ÂöF—cà¢Â÷6V7F–öãà¢’¢çVÆÇÐ ¢·&–6–æu&Wf–Wuv—¦&E7FWÓÓÒ"ò€¢Ç6V7F–öâ6Æ74æÖS×¶G·7G–ÆW2ç&WfÇVU&WÆ6VÖVçEæVÇÒG·7G–ÆW2ç&WfÇVT7W7FöÕ7FWæVÇÖÓà¢ÆF—b6Æ74æÖS×·7G–ÆW2ç&WfÇVU&WÆ6VÖVçD†VFW'Óà¢ÆF—cà¢Ç7ãå7FW"öb3Â÷7ãà¢ÆƒCç·&–6–æu&Wf–Wt7W7FöÕ7FWF—FÆWÓÂöƒCà¢Ç6Æ74æÖS×·7G–ÆW2ç&WfÇVU7FW6÷—Óç·&–6–æu&Wf–Wt7W7FöÕ7FW6÷—ÓÂ÷à¢ÂöF—cà¢ÂöF—cà ¢ÆF—b6Æ74æÖS×·7G–ÆW2ç&WfÇVT7W7FöÕ&WÆ6VÖVçD6&GÓà¢ÆÆ&VÂ6Æ74æÖS×·7G–ÆW2ç&WfÇVU&WÆ6VÖVçDf–VÆGÓà¢Ç7ãå&WÆ6VÖVçB&–6RW†6ÂâdCÂ÷7ãà¢Æ–çW@¢G—SÒ'FW‡B ¢–çWDÖöFSÒ&çVÖW&–2 ¢fÇVS×·&WfÇVU&WÆ6VÖVçE&–6T–çWGÐ¢öä6†ævS×¶†æFÆU&WfÇVU&WÆ6VÖVçE&–6T6†ævWÐ¢Æ6V†öÆFW#Ò$W†×ÆS¢cS ¢F—6&ÆVC×¶—4ÆöF–æu&–6–æu&Wf–WrÇÂ—56f–æu&–6–æu&Wf–WwÐ¢óà¢ÂöÆ&VÃà ¢ÆÆ&VÂ6Æ74æÖS×·7G–ÆW2ç&WfÇVU&WÆ6VÖVçEFövvÆWÓà¢Æ–çW@¢G—SÒ&6†V6¶&÷‚ ¢6†V6¶VC×·6fU&WÆ6VÖVçE&–6Uv—F…&WfÇVWÐ¢öä6†ævS×²†WfVçB’Óâ6WE6fU&WÆ6VÖVçE&–6Uv—F…&WfÇVR†WfVçBçF&vWBæ6†V6¶VB—Ð¢F—6&ÆVC×¶—4ÆöF–æu&–6–æu&Wf–WrÇÂ—56f–æu&–6–æu&Wf–WwÐ¢óà¢Ç7ãå6fRF†—22F†R&WÆ6VÖVçB&–6RöâF†—276WCÂ÷7ãà¢ÂöÆ&VÃà¢Ç6Æ74æÖS×·7G–ÆW2ç&WfÇVU&WÆ6VÖVçD†VÇW'ÓäÆVfRVçF–6¶VBFòW6RF†—2&–6Rf÷"F†—26Æ7VÆF–öâöæÇ’ãÂ÷à¢ÂöF—cà ¢·&VæFW%&WfÇVTÆ–fWF–ÖTf–VÆB‡&–6–æu&Wf–Wræ76WB—Ð ¢·&WfÇVU&WÆ6VÖVçE&–6TW'&÷"òÇ6Æ74æÖS×·7G–ÆW2ç&WfÇVU&WÆ6VÖVçDW'&÷'Óç·&WfÇVU&WÆ6VÖVçE&–6TW'&÷'ÓÂ÷â¢çVÆÇÐ¢·&WfÇVTGfæ6VDW'&÷"òÇ6Æ74æÖS×·7G–ÆW2ç&WfÇVU&WÆ6VÖVçDW'&÷'Óç·&WfÇVTGfæ6VDW'&÷'ÓÂ÷â¢çVÆÇÐ¢Â÷6V7F–öãà¢’¢çVÆÇÐ ¢·&–6–æu&Wf–Wuv—¦&E7FWÓÓÒ2ò€¢—4ÆöF–æu&–6–æu&Wf–Wrò€¢ÆF—b6Æ74æÖS×·7G–ÆW2ç&–6–æu&Wf–Wu7FGW7Óä6Æ7VÆF–æræWrfÇVRââãÂöF—cà¢’¢&–6–æu&Wf–WræW'&÷"ò€¢ÆF—b6Æ74æÖS×¶G·7G–ÆW2ç&–6–æu&Wf–Wu7FGW7ÒG·7G–ÆW2ç&–6–æu&Wf–WtW'&÷'ÖÓà¢Ç7G&öæsç·&–6–æu&Wf–WtW'&÷%F—FÆWÓÂ÷7G&öæsà¢Ç7ãç·&–6–æu&Wf–WræW'&÷'ÓÂ÷7ãà¢ÂöF—cà¢’¢&–6–æu&Wf–Wrç&W7VÇCòæ—FVÒò€¢Ãà¢Ç6V7F–öâ6Æ74æÖS×¶G·7G–ÆW2ç&WfÇVU&WÆ6VÖVçEæVÇÒG·7G–ÆW2ç&WfÇVU&Wf–WuæVÇÖÒ&–ÖÆ—fSÒ'öÆ—FR#à¢ÆF—b6Æ74æÖS×·7G–ÆW2ç&WfÇVU&WÆ6VÖVçD†VFW'Óà¢ÆF—cà¢Ç7ãå7FW2öb3Â÷7ãà¢ÆƒCå&Wf–WræB6fSÂöƒCà¢Ç6Æ74æÖS×·7G–ÆW2ç&WfÇVU7FW6÷—Óå&Wf–WrF†RæWrfÇVR&Vf÷&R6f–ær—BFòF†R76WB&Vv—7FW"ãÂ÷à¢ÂöF—cà¢ÂöF—cà ¢ÆF—b6Æ74æÖS×·7G–ÆW2ç&–6–æu&W7VÇD†W&÷Óà¢Ç7ãäæWr76WBfÇVSÂ÷7ãà¢Ç7G&öæsç¶ÖöæW’‡&–6–æu&Wf–WtæWufÇVTW…fB—ÓÂ÷7G&öæsà¢ÇåF†—2—2F†RfÇVRF†Bv–ÆÂ&R6fVBFòF†R76WBãÂ÷à¢ÂöF—cà ¢ÆF—b6Æ74æÖS×·7G–ÆW2ç&–6–æt6ö×&Tw&–GÓà¢ÆF—cà¢Ç7ãä7W'&VçBfÇVSÂ÷7ãà¢Ç7G&öæsç¶ÖöæW’‡&–6–æu&Wf–WtöÆEfÇVTW…fB—ÓÂ÷7G&öæsà¢ÂöF—cà¢ÆF—cà¢Ç7ãäæWrfÇVSÂ÷7ãà¢Ç7G&öæsç¶ÖöæW’‡&–6–æu&Wf–WtæWufÇVTW…fB—ÓÂ÷7G&öæsà¢ÂöF—cà¢ÆF—cà¢Ç7ãäF–ffW&Væ6SÂ÷7ãà¢Ç7G&öæsç¶f÷&ÖDÖöæW”F–ffW&Væ6R‡&–6–æu&Wf–WtF–ffW&Væ6TW…fB—ÓÂ÷7G&öæsà¢ÂöF—cà¢ÂöF—cà ¢ÆF—b6Æ74æÖS×·7G–ÆW2ç&WfÇVU&WÆ6VÖVçE7VÖÖ'—Óà¢ÆF—cà¢Ç7ãå&WÆ6VÖVçB&–6RW6VC£Â÷7ãà¢Ç7G&öæsç·&–6–æu&Wf–Wu&WÆ6VÖVçE&–6TW…fBÓÒçVÆÂòÖöæW’‡&–6–æu&Wf–Wu&WÆ6VÖVçE&–6TW…fB’¢tæ÷B6WBwÓÂ÷7G&öæsà¢ÂöF—cà¢ÆF—cà¢Ç7ãå&WÆ6VÖVçB&–6R7F–öã£Â÷7ãà¢Ç7G&öæsç·&–6–æu&Wf–Wu&WÆ6VÖVçD7F–öäÆ&VÇÓÂ÷7G&öæsà¢ÂöF—cà¢²&–6–æu&Wf–WuW6W5W&6VçEW6vRò€¢ÆF—cà¢Ç7ãäW‡V7FVBÆ–fWF–ÖRW6VC£Â÷7ãà¢Ç7G&öæsç·&–6–æu&Wf–WtÆ–fWF–ÖUfÇVRÓÒçVÆÂòG¶f÷&ÖEÆ–äçVÖ&W"‡&–6–æu&Wf–WtÆ–fWF–ÖUfÇVR—ÒG·&–6–æu&Wf–WtÆ–fWF–ÖU6†÷'EVæ—GÖ¢tæ÷B6WBwÓÂ÷7G&öæsà¢ÂöF—cà¢’¢çVÆÇÐ¢ÂöF—cà¢Â÷6V7F–öãà ¢·&–6–æu&Wf–Wrç&W7VÇBçv&æ–ærò€¢Ç6Æ74æÖS×·7G–ÆW2ç&–6–æu&Wf–Wuv&æ–æwÓç·&–6–æu&Wf–Wrç&W7VÇBçv&æ–æwÓÂ÷à¢’¢çVÆÇÐ ¢·&–6–æu&Wf–Wt†5Vç&Wf–WvVE&WÆ6VÖVçD–çWBò€¢Ç6Æ74æÖS×·7G–ÆW2ç&WfÇVU&WÆ6VÖVçDæ÷F–6WÓä6Æ7VÆFRF†R6†ævVB&WÆ6VÖVçB&–6R&Vf÷&R6f–ærãÂ÷à¢’¢çVÆÇÐ¢Âóà¢’¢çVÆÀ¢’¢çVÆÇÐ¢Âóà¢ÂöF—cà ¢ÆF—`¢6Æ74æÖS×¶G·7G–ÆW2ç&–6–æu&Wf–Wt7F–öç7ÒG°¢&–6–æu&Wf–WræÖWF†öBÓÓÒv–ÓG&–6Rrbb&–6–æu&Wf–Wuv—¦&E7FWÓÓÒò7G–ÆW2ç&–6–æu&Wf–Wt7F–öç56–ævÆR¢rp¢ÖÐ¢à¢·&–6–æu&Wf–WræÖWF†öBÓÓÒv–ÓG&–6Rrbb&–6–æu&Wf–Wuv—¦&E7FWÓÓÒò€¢Æ'WGFöâG—SÒ&'WGFöâ"6Æ74æÖS×·7G–ÆW2ç6V6öæF'”'WGFöçÒöä6Æ–6³×¶6Æ÷6U&–6–æu&Wf–WtF–ÆöwÒF—6&ÆVC×¶—56f–æu&–6–æu&Wf–WwÓà¢¶VW7W'&VçBfÇVP¢Âö'WGFöãà¢’¢&–6–æu&Wf–WræÖWF†öBÓÓÒv–ÓG&–6Rrbb&–6–æu&Wf–Wuv—¦&E7FWÓÓÒ"ò€¢Ãà¢Æ'WGFöâG—SÒ&'WGFöâ"6Æ74æÖS×·7G–ÆW2ç6V6öæF'”'WGFöçÒöä6Æ–6³×¶†æFÆU&Wf–÷W5&WfÇVU7FWÒF—6&ÆVC×¶—4ÆöF–æu&–6–æu&Wf–WrÇÂ—56f–æu&–6–æu&Wf–WwÓà¢&6°¢Âö'WGFöãà¢Æ'WGFöà¢G—SÒ&'WGFöâ ¢6Æ74æÖS×·7G–ÆW2ç&–Ö'”'WGFöçÐ¢öä6Æ–6³×²‚’Óâ÷Vä7W7FöÕ&WÆ6VÖVçE&Wf–Wr‡&–6–æu&Wf–Wræ76WB—Ð¢F—6&ÆVC×²6ä6Æ7VÆFT7W7FöÕ&WÆ6VÖVçE&Wf–WwÐ¢à¢6Æ7VÆFRæWrfÇVP¢Âö'WGFöãà¢Âóà¢’¢&–6–æu&Wf–WræÖWF†öBÓÓÒv–ÓG&–6Rrbb&–6–æu&Wf–Wuv—¦&E7FWÓÓÒ2ò€¢Ãà¢Æ'WGFöâG—SÒ&'WGFöâ"6Æ74æÖS×·7G–ÆW2ç6V6öæF'”'WGFöçÒöä6Æ–6³×¶†æFÆU&Wf–÷W5&WfÇVU7FWÒF—6&ÆVC×¶—4ÆöF–æu&–6–æu&Wf–WrÇÂ—56f–æu&–6–æu&Wf–WwÓà¢&6°¢Âö'WGFöãà¢Æ'WGFöà¢G—SÒ&'WGFöâ ¢6Æ74æÖS×·7G–ÆW2ç&–Ö'”'WGFöçÐ¢öä6Æ–6³×²‚’Óâfö–B†æFÆU6fU&–6–æu&Wf–Wr‚—Ð¢F—6&ÆVC×²6å6fU&–6–æu&Wf–WwÐ¢à¢¶—56f–æu&–6–æu&Wf–Wròu6f–ærâââr¢&–6–æu&Wf–Wu6†÷VÆE6fU&WÆ6VÖVçBòu6fRfÇVRæB&WÆ6VÖVçB&–6Rr¢u6fRæWrfÇVRwÐ¢Âö'WGFöãà¢Âóà¢’¢€¢Ãà¢Æ'WGFöâG—SÒ&'WGFöâ"6Æ74æÖS×·7G–ÆW2ç6V6öæF'”'WGFöçÒöä6Æ–6³×¶6Æ÷6U&–6–æu&Wf–WtF–ÆöwÒF—6&ÆVC×¶—56f–æu&–6–æu&Wf–WwÓà¢¶VW7W'&VçBfÇVP¢Âö'WGFöãà¢Æ'WGFöà¢G—SÒ&'WGFöâ ¢6Æ74æÖS×·7G–ÆW2ç&–Ö'”'WGFöçÐ¢öä6Æ–6³×²‚’Óâfö–B†æFÆU6fU&–6–æu&Wf–Wr‚—Ð¢F—6&ÆVC×²6å6fU&–6–æu&Wf–WwÐ¢à¢¶—56f–æu&–6–æu&Wf–Wròu6f–ærâââr¢u6fRæWrfÇVRwÐ¢Âö'WGFöãà¢Âóà¢—Ð¢ÂöF—cà¢ÂöF—cà¢ÂöF—cà¢’¢çVÆÇÐ ¢·&W÷'D76WBbb—476WE&W÷'DÖöFÄ÷Vâò€¢ÆF—b6Æ74æÖS×¶G·7G–ÆW2æÖöFÄ÷fW&Æ—ÒG·7G–ÆW2ç7V$ÖöFÄ÷fW&Æ—ÖÓà¢ÆF—b6Æ74æÖS×·7G–ÆW2æÖöFÄ&6¶G&÷Òöä6Æ–6³×¶6Æ÷6T76WE&W÷'DF–ÆöwÒóà ¢ÆF—`¢6Æ74æÖS×¶G·7G–ÆW2æÖöFÄ6&GÒG·7G–ÆW2æ76WE&W÷'DÖöFÇÒG¶76WE&W÷'E7FWÓÒv÷F–öç2rò7G–ÆW2æ76WDgVVÅ&W÷'DÖöFÂ¢rwÖÐ¢&öÆSÒ&F–Æör ¢&–ÖÖöFÃÒ'G'VR ¢&–ÖÆ&VÆÆVF'“Ò&76WB×&W÷'B×F—FÆR ¢à¢ÆF—b6Æ74æÖS×¶G·7G–ÆW2æÖöFÄ†VFW'ÒG·7G–ÆW2æ76WE&W÷'DÖöFÄ†VFW'ÖÓà¢ÆF—b6Æ74æÖS×·7G–ÆW2æÖöFÄ†VFW%FW‡GÓà¢Æƒ2–CÒ&76WB×&W÷'B×F—FÆR"F$–æFWƒ×²ÓÓç·&W÷'D76WBçF—FÆWÓÂöƒ3à¢Çç¶—4GF6†–ætW‡FW&æÅ&W÷'Bòt6†ö÷6Râ–ÓG&–6R&W÷'BFòFBFò–÷W"ÖW76vRâr¢'V–ÆD76WDÖWF‡&W÷'D76WB—ÓÂ÷à¢ÂöF—cà ¢Æ'WGFöâG—SÒ&'WGFöâ"6Æ74æÖS×·7G–ÆW2æÖöFÄ6Æ÷6T'WGFöçÒöä6Æ–6³×¶6Æ÷6T76WE&W÷'DF–ÆöwÒ&–ÖÆ&VÃÒ$6Æ÷6R&W÷'B÷F–öç2#à¢Ä6Æ÷6T–6öâ6Æ74æÖS×·7G–ÆW2æ'WGFöä–6öçÒóà¢Âö'WGFöãà¢ÂöF—cà ¢ÆF—b6Æ74æÖS×¶G·7G–ÆW2æÖöFÅ67&öÆÄ&öG—ÒG·7G–ÆW2æ76WE&W÷'DÖöFÄ&öG—ÖÓà¢¶76WE&W÷'E7FWæVæG5v—F‚‚rÖf÷&ÖBr’ò€¢Ãà¢ÆF—b6Æ74æÖS×·7G–ÆW2æ76WEF–ÖVÆ–æU7FvT†VF–æwÓà¢Ç7G&öæsä6†ö÷6RW‡÷'Bf÷&ÖCÂ÷7G&öæsà¢Ç7ãå6VÆV7BDb÷"W†6VÂÂF†Vâ6öçF–çVRFòF†R&W÷'BF–ÖVÆ–æRãÂ÷7ãà¢ÂöF—cà ¢Ä76WE&W÷'Df÷&ÖE–6¶W"fÇVS×¶76WE&W÷'DF÷væÆöDf÷&ÖGÒFVÆ—fW'”ÖöFS×¶—4GF6†–ætW‡FW&æÅ&W÷'BòvGF6‚r¢vF÷væÆöBwÒöä6†ævS×·6WD76WE&W÷'DF÷væÆöDf÷&ÖGÒóà ¢ÆF—b6Æ74æÖS×¶G·7G–ÆW2æf÷&Ô7F–öç7ÒG·7G–ÆW2æW‡÷'D7F–öç7ÒG·7G–ÆW2æ76WDgVVÅ&W÷'D7F–öç7ÖÓà¢Æ'WGFöâG—SÒ&'WGFöâ"6Æ74æÖS×¶G·7G–ÆW2ç6V6öæF'”'WGFöçÒG·7G–ÆW2æ76WEF–ÖVÆ–æU6V6öæF'”'WGFöçÖÒöä6Æ–6³×¶&6µFô76WE&W÷'D÷F–öç7Óä&6³Âö'WGFöãà¢Æ'WGFöà¢G—SÒ&'WGFöâ ¢6Æ74æÖS×¶G·7G–ÆW2ç6V6öæF'”'WGFöçÒG·7G–ÆW2æ76WEF–ÖVÆ–æU6V6öæF'”'WGFöçÖÐ¢öä6Æ–6³×¶6Æ÷6T76WE&W÷'DF–ÆöwÐ¢à¢6æ6VÀ¢Âö'WGFöãà¢Æ'WGFöâG—SÒ&'WGFöâ"6Æ74æÖS×·7G–ÆW2ç&–Ö'”'WGFöçÒöä6Æ–6³×·6†÷t76WE&W÷'EF–ÖVÆ–æU7FWÓà¢Ç7ãäæW‡CÂ÷7ãà¢Âö'WGFöãà¢ÂöF—cà¢Âóà¢’¢76WE&W÷'E7FWÓÓÒvgVVÂÖf–ÇFW"rò€¢Ãà¢ÆF—b6Æ74æÖS×·7G–ÆW2æ76WEF–ÖVÆ–æU7FvT†VF–æwÓà¢Ç7G&öæså&W÷'BF–ÖVÆ–æSÂ÷7G&öæsà¢Ç7ãä6†ö÷6RF†R–V"æBÖöçF‚Fò–æ6ÇVFRãÂ÷7ãà¢ÂöF—cà ¢ÆF—b6Æ74æÖS×·7G–ÆW2æ76WDgVVÅ&W÷'Df–ÇFW$&÷‡Óà¢Å&W÷'E6VÆV7@¢Æ&VÃÒ%–V" ¢fÇVS×¶76WDgVVÅ&W÷'E–V'Ð¢÷F–öç3×¶76WE&W÷'E–V$÷F–öç7Ð¢—4÷Vã×¶÷Vä76WE&W÷'E6VÆV7BÓÓÒw–V"wÐ¢öåFövvÆS×²‚’ÓâFövvÆT76WE&W÷'E6VÆV7B‚w–V"r—Ð¢öä6†ævS×·6VÆV7D76WDgVVÅ&W÷'E–V'Ð¢óà ¢Å&W÷'E6VÆV7@¢Æ&VÃÒ$ÖöçF‚ ¢fÇVS×¶76WDgVVÅ&W÷'DÖöçF‡Ð¢÷F–öç3×¶76WE&W÷'DÖöçF„÷F–öç7Ð¢—4÷Vã×¶÷Vä76WE&W÷'E6VÆV7BÓÓÒvÖöçF‚wÐ¢F—6&ÆVC×¶76WDgVVÅ&W÷'E–V"ÓÓÒvÆÂwÐ¢öåFövvÆS×²‚’ÓâFövvÆT76WE&W÷'E6VÆV7B‚vÖöçF‚r—Ð¢öä6†ævS×·6VÆV7D76WDgVVÅ&W÷'DÖöçF‡Ð¢óà¢ÂöF—cà ¢ÆF—b6Æ74æÖS×¶G·7G–ÆW2æf÷&Ô7F–öç7ÒG·7G–ÆW2æW‡÷'D7F–öç7ÒG·7G–ÆW2æ76WDgVVÅ&W÷'D7F–öç7ÖÓà¢Æ'WGFöâG—SÒ&'WGFöâ"6Æ74æÖS×¶G·7G–ÆW2ç6V6öæF'”'WGFöçÒG·7G–ÆW2æ76WEF–ÖVÆ–æU6V6öæF'”'WGFöçÖÒöä6Æ–6³×¶&6µFô76WE&W÷'Df÷&ÖE7FWÓä&6³Âö'WGFöãà¢Æ'WGFöà¢G—SÒ&'WGFöâ ¢6Æ74æÖS×¶G·7G–ÆW2ç6V6öæF'”'WGFöçÒG·7G–ÆW2æ76WEF–ÖVÆ–æU6V6öæF'”'WGFöçÖÐ¢öä6Æ–6³×¶6Æ÷6T76WE&W÷'DF–ÆöwÐ¢à¢6æ6VÀ¢Âö'WGFöãà¢Æ'WGFöà¢G—SÒ&'WGFöâ ¢6Æ74æÖS×·7G–ÆW2ç&–Ö'”'WGFöçÐ¢öä6Æ–6³×²‚’Óâfö–B†æFÆTF÷væÆöDf–ÇFW&VDgVVÅ&W÷'B‡&W÷'D76WBÂ76WE&W÷'DF÷væÆöDf÷&ÖB—Ð¢à¢ÄF÷væÆöD–6öâ6Æ74æÖS×·7G–ÆW2æ'WGFöä–6öçÒóà¢Ç7ãç¶—4GF6†–ætW‡FW&æÅ&W÷'Bò76WE&W÷'DF÷væÆöDf÷&ÖBÓÓÒwFbròtFBDb&W÷'Br¢tFBW†6VÂ&W÷'Br¢76WE&W÷'DF÷væÆöDf÷&ÖBÓÓÒwFbròt÷VâDb&W÷'Br¢tF÷væÆöBW†6VÂwÓÂ÷7ãà¢Âö'WGFöãà¢ÂöF—cà¢Âóà¢’¢76WE&W÷'E7FWÓÓÒvÖ–çFVææ6RÖf–ÇFW"rò€¢Ãà¢ÆF—b6Æ74æÖS×·7G–ÆW2æ76WEF–ÖVÆ–æU7FvT†VF–æwÓà¢Ç7G&öæså&W÷'BF–ÖVÆ–æSÂ÷7G&öæsà¢Ç7ãä6†ö÷6RF†RÖ–çFVææ6RG—RÂ–V"æBÖöçF‚Fò–æ6ÇVFRãÂ÷7ãà¢ÂöF—cà ¢ÆF—b6Æ74æÖS×¶G·7G–ÆW2æ76WDgVVÅ&W÷'Df–ÇFW$&÷‡ÒG·7G–ÆW2æ76WDÖ–çFVææ6U&W÷'Df–ÇFW$&÷‡ÖÓà¢Å&W÷'E6VÆV7@¢Æ&VÃÒ%G—R ¢fÇVS×¶76WDÖ–çFVææ6U&W÷'EG—WÐ¢÷F–öç3×¶76WDÖ–çFVææ6U&W÷'EG—T÷F–öç7Ð¢—4÷Vã×¶÷Vä76WE&W÷'E6VÆV7BÓÓÒwG—RwÐ¢öåFövvÆS×²‚’ÓâFövvÆT76WE&W÷'E6VÆV7B‚wG—Rr—Ð¢öä6†ævS×·6VÆV7D76WDÖ–çFVææ6U&W÷'EG—WÐ¢óà ¢Å&W÷'E6VÆV7@¢Æ&VÃÒ%–V" ¢fÇVS×¶76WDÖ–çFVææ6U&W÷'E–V'Ð¢÷F–öç3×¶76WE&W÷'E–V$÷F–öç7Ð¢—4÷Vã×¶÷Vä76WE&W÷'E6VÆV7BÓÓÒw–V"wÐ¢öåFövvÆS×²‚’ÓâFövvÆT76WE&W÷'E6VÆV7B‚w–V"r—Ð¢öä6†ævS×·6VÆV7D76WDÖ–çFVææ6U&W÷'E–V'Ð¢óà ¢Å&W÷'E6VÆV7@¢Æ&VÃÒ$ÖöçF‚ ¢fÇVS×¶76WDÖ–çFVææ6U&W÷'DÖöçF‡Ð¢÷F–öç3×¶76WE&W÷'DÖöçF„÷F–öç7Ð¢—4÷Vã×¶÷Vä76WE&W÷'E6VÆV7BÓÓÒvÖöçF‚wÐ¢F—6&ÆVC×¶76WDÖ–çFVææ6U&W÷'E–V"ÓÓÒvÆÂwÐ¢öåFövvÆS×²‚’ÓâFövvÆT76WE&W÷'E6VÆV7B‚vÖöçF‚r—Ð¢öä6†ævS×·6VÆV7D76WDÖ–çFVææ6U&W÷'DÖöçF‡Ð¢óà¢ÂöF—cà ¢ÆF—b6Æ74æÖS×¶G·7G–ÆW2æf÷&Ô7F–öç7ÒG·7G–ÆW2æW‡÷'D7F–öç7ÒG·7G–ÆW2æ76WDgVVÅ&W÷'D7F–öç7ÖÓà¢Æ'WGFöâG—SÒ&'WGFöâ"6Æ74æÖS×¶G·7G–ÆW2ç6V6öæF'”'WGFöçÒG·7G–ÆW2æ76WEF–ÖVÆ–æU6V6öæF'”'WGFöçÖÒöä6Æ–6³×¶&6µFô76WE&W÷'Df÷&ÖE7FWÓä&6³Âö'WGFöãà¢Æ'WGFöà¢G—SÒ&'WGFöâ ¢6Æ74æÖS×¶G·7G–ÆW2ç6V6öæF'”'WGFöçÒG·7G–ÆW2æ76WEF–ÖVÆ–æU6V6öæF'”'WGFöçÖÐ¢öä6Æ–6³×¶6Æ÷6T76WE&W÷'DF–ÆöwÐ¢à¢6æ6VÀ¢Âö'WGFöãà¢Æ'WGFöà¢G—SÒ&'WGFöâ ¢6Æ74æÖS×·7G–ÆW2ç&–Ö'”'WGFöçÐ¢öä6Æ–6³×²‚’Óâfö–B†æFÆTF÷væÆöDf–ÇFW&VDÖ–çFVææ6U&W÷'B‡&W÷'D76WBÂ76WE&W÷'DF÷væÆöDf÷&ÖB—Ð¢à¢ÄF÷væÆöD–6öâ6Æ74æÖS×·7G–ÆW2æ'WGFöä–6öçÒóà¢Ç7ãç¶—4GF6†–ætW‡FW&æÅ&W÷'Bò76WE&W÷'DF÷væÆöDf÷&ÖBÓÓÒwFbròtFBDb&W÷'Br¢tFBW†6VÂ&W÷'Br¢76WE&W÷'DF÷væÆöDf÷&ÖBÓÓÒwFbròt÷VâDb&W÷'Br¢tF÷væÆöBW†6VÂwÓÂ÷7ãà¢Âö'WGFöãà¢ÂöF—cà¢Âóà¢’¢76WE&W÷'E7FWÓÓÒvFW&V6–F–öâÖf–ÇFW"rò€¢Ãà¢ÆF—b6Æ74æÖS×·7G–ÆW2æ76WEF–ÖVÆ–æU7FvT†VF–æwÓà¢Ç7G&öæså&W÷'BF–ÖVÆ–æSÂ÷7G&öæsà¢Ç7ãä6†ö÷6RF†R–V"æBÖöçF‚Fò–æ6ÇVFRãÂ÷7ãà¢ÂöF—cà ¢ÆF—b6Æ74æÖS×·7G–ÆW2æ76WDgVVÅ&W÷'Df–ÇFW$&÷‡Óà¢Å&W÷'E6VÆV7@¢Æ&VÃÒ%–V" ¢fÇVS×¶76WDFW&V6–F–öå&W÷'E–V'Ð¢÷F–öç3×¶76WE&W÷'E–V$÷F–öç7Ð¢—4÷Vã×¶÷Vä76WE&W÷'E6VÆV7BÓÓÒw–V"wÐ¢öåFövvÆS×²‚’ÓâFövvÆT76WE&W÷'E6VÆV7B‚w–V"r—Ð¢öä6†ævS×·6VÆV7D76WDFW&V6–F–öå&W÷'E–V'Ð¢óà ¢Å&W÷'E6VÆV7@¢Æ&VÃÒ$ÖöçF‚ ¢fÇVS×¶76WDFW&V6–F–öå&W÷'DÖöçF‡Ð¢÷F–öç3×¶76WE&W÷'DÖöçF„÷F–öç7Ð¢—4÷Vã×¶÷Vä76WE&W÷'E6VÆV7BÓÓÒvÖöçF‚wÐ¢F—6&ÆVC×¶76WDFW&V6–F–öå&W÷'E–V"ÓÓÒvÆÂwÐ¢öåFövvÆS×²‚’ÓâFövvÆT76WE&W÷'E6VÆV7B‚vÖöçF‚r—Ð¢öä6†ævS×·6VÆV7D76WDFW&V6–F–öå&W÷'DÖöçF‡Ð¢óà¢ÂöF—cà ¢ÆF—b6Æ74æÖS×¶G·7G–ÆW2æf÷&Ô7F–öç7ÒG·7G–ÆW2æW‡÷'D7F–öç7ÒG·7G–ÆW2æ76WDgVVÅ&W÷'D7F–öç7ÖÓà¢Æ'WGFöâG—SÒ&'WGFöâ"6Æ74æÖS×¶G·7G–ÆW2ç6V6öæF'”'WGFöçÒG·7G–ÆW2æ76WEF–ÖVÆ–æU6V6öæF'”'WGFöçÖÒöä6Æ–6³×¶&6µFô76WE&W÷'Df÷&ÖE7FWÓä&6³Âö'WGFöãà¢Æ'WGFöà¢G—SÒ&'WGFöâ ¢6Æ74æÖS×¶G·7G–ÆW2ç6V6öæF'”'WGFöçÒG·7G–ÆW2æ76WEF–ÖVÆ–æU6V6öæF'”'WGFöçÖÐ¢öä6Æ–6³×¶6Æ÷6T76WE&W÷'DF–ÆöwÐ¢à¢6æ6VÀ¢Âö'WGFöãà¢Æ'WGFöà¢G—SÒ&'WGFöâ ¢6Æ74æÖS×·7G–ÆW2ç&–Ö'”'WGFöçÐ¢öä6Æ–6³×²‚’Óâfö–B†æFÆTF÷væÆöDf–ÇFW&VDFW&V6–F–öå&W÷'B‡&W÷'D76WBÂ76WE&W÷'DF÷væÆöDf÷&ÖB—Ð¢à¢ÄF÷væÆöD–6öâ6Æ74æÖS×·7G–ÆW2æ'WGFöä–6öçÒóà¢Ç7ãç¶—4GF6†–ætW‡FW&æÅ&W÷'Bò76WE&W÷'DF÷væÆöDf÷&ÖBÓÓÒwFbròtFBDb&W÷'Br¢tFBW†6VÂ&W÷'Br¢76WE&W÷'DF÷væÆöDf÷&ÖBÓÓÒwFbròt÷VâDb&W÷'Br¢tF÷væÆöBW†6VÂwÓÂ÷7ãà¢Âö'WGFöãà¢ÂöF—cà¢Âóà¢’¢76WE&W÷'E7FWÓÓÒv÷væW'6†—Öf–ÇFW"rò€¢Ãà¢ÆF—b6Æ74æÖS×·7G–ÆW2æ76WEF–ÖVÆ–æU7FvT†VF–æwÓà¢Ç7G&öæså&W÷'BF–ÖVÆ–æSÂ÷7G&öæsà¢Ç7ãä6†ö÷6RF†R–V"æBÖöçF‚Fò–æ6ÇVFRãÂ÷7ãà¢ÂöF—cà ¢ÆF—b6Æ74æÖS×·7G–ÆW2æ76WDgVVÅ&W÷'Df–ÇFW$&÷‡Óà¢Å&W÷'E6VÆV7@¢Æ&VÃÒ%–V" ¢fÇVS×¶76WD÷væW'6†—&W÷'E–V'Ð¢÷F–öç3×¶76WE&W÷'E–V$÷F–öç7Ð¢—4÷Vã×¶÷Vä76WE&W÷'E6VÆV7BÓÓÒw–V"wÐ¢öåFövvÆS×²‚’ÓâFövvÆT76WE&W÷'E6VÆV7B‚w–V"r—Ð¢öä6†ævS×·6VÆV7D76WD÷væW'6†—&W÷'E–V'Ð¢óà ¢Å&W÷'E6VÆV7@¢Æ&VÃÒ$ÖöçF‚ ¢fÇVS×¶76WD÷væW'6†—&W÷'DÖöçF‡Ð¢÷F–öç3×¶76WE&W÷'DÖöçF„÷F–öç7Ð¢—4÷Vã×¶÷Vä76WE&W÷'E6VÆV7BÓÓÒvÖöçF‚wÐ¢F—6&ÆVC×¶76WD÷væW'6†—&W÷'E–V"ÓÓÒvÆÂwÐ¢öåFövvÆS×²‚’ÓâFövvÆT76WE&W÷'E6VÆV7B‚vÖöçF‚r—Ð¢öä6†ævS×·6VÆV7D76WD÷væW'6†—&W÷'DÖöçF‡Ð¢óà¢ÂöF—cà ¢ÆF—b6Æ74æÖS×¶G·7G–ÆW2æf÷&Ô7F–öç7ÒG·7G–ÆW2æW‡÷'D7F–öç7ÒG·7G–ÆW2æ76WDgVVÅ&W÷'D7F–öç7ÖÓà¢Æ'WGFöâG—SÒ&'WGFöâ"6Æ74æÖS×¶G·7G–ÆW2ç6V6öæF'”'WGFöçÒG·7G–ÆW2æ76WEF–ÖVÆ–æU6V6öæF'”'WGFöçÖÒöä6Æ–6³×¶&6µFô76WE&W÷'Df÷&ÖE7FWÓä&6³Âö'WGFöãà¢Æ'WGFöà¢G—SÒ&'WGFöâ ¢6Æ74æÖS×¶G·7G–ÆW2ç6V6öæF'”'WGFöçÒG·7G–ÆW2æ76WEF–ÖVÆ–æU6V6öæF'”'WGFöçÖÐ¢öä6Æ–6³×¶6Æ÷6T76WE&W÷'DF–ÆöwÐ¢à¢6æ6VÀ¢Âö'WGFöãà¢Æ'WGFöà¢G—SÒ&'WGFöâ ¢6Æ74æÖS×·7G–ÆW2ç&–Ö'”'WGFöçÐ¢öä6Æ–6³×²‚’Óâfö–B†æFÆTF÷væÆöDf–ÇFW&VD÷væW'6†—&W÷'B‡&W÷'D76WBÂ76WE&W÷'DF÷væÆöDf÷&ÖB—Ð¢à¢ÄF÷væÆöD–6öâ6Æ74æÖS×·7G–ÆW2æ'WGFöä–6öçÒóà¢Ç7ãç¶—4GF6†–ætW‡FW&æÅ&W÷'Bò76WE&W÷'DF÷væÆöDf÷&ÖBÓÓÒwFbròtFBDb&W÷'Br¢tFBW†6VÂ&W÷'Br¢76WE&W÷'DF÷væÆöDf÷&ÖBÓÓÒwFbròt÷VâDb&W÷'Br¢tF÷væÆöBW†6VÂwÓÂ÷7ãà¢Âö'WGFöãà¢ÂöF—cà¢Âóà¢’¢€¢ÆF—b6Æ74æÖS×·7G–ÆW2æ76WE&W÷'D÷F–öç4w&–GÓà¢Æ'WGFöâG—SÒ&'WGFöâ"6Æ74æÖS×·7G–ÆW2æ76WE&W÷'D÷F–öä'WGFöçÒöä6Æ–6³×²‚’Óâ†æFÆU&–çD76WE6†VWB‡&W÷'D76WB—Óà¢ÅFd–6öâ6Æ74æÖS×·7G–ÆW2æ'WGFöä–6öçÒóà¢Ç7ãà¢Ç7G&öæsç¶—4GF6†–ætW‡FW&æÅ&W÷'BòtFB76WBfÇVF–öâr¢t÷Vâ76WBfÇVF–öâwÓÂ÷7G&öæsà¢Ç6ÖÆÃç¶—4GF6†–ætW‡FW&æÅ&W÷'BòtGF6‚öÆ—6†VB–ÓG&–6RDbâr¢uDbfÇVR7VÖÖ'’v—F‚æ÷FW2æBFö7VÖVçG2âwÓÂ÷6ÖÆÃà¢Â÷7ãà¢Âö'WGFöãà ¢¶6åW6T÷væW$öæÇ”76WD7F–öç2ò€¢Ãà¢Æ'WGFöâG—SÒ&'WGFöâ"6Æ74æÖS×·7G–ÆW2æ76WE&W÷'D÷F–öä'WGFöçÒöä6Æ–6³×¶÷Vä76WDÖ–çFVææ6U&W÷'Df–ÇFW'Óà¢ÄFö7VÖVçD–6öâ6Æ74æÖS×·7G–ÆW2æ'WGFöä–6öçÒóà¢Ç7ãà¢Ç7G&öæsç¶—4GF6†–ætW‡FW&æÅ&W÷'BòtFBÖ–çFVææ6R&W÷'Br¢tF÷væÆöBÖ–çFVææ6R&W÷'BwÓÂ÷7G&öæsà¢Ç6ÖÆÃåDb÷"W†6VÂ6W'f–6RæB&W—"6÷7G2ãÂ÷6ÖÆÃà¢Â÷7ãà¢Âö'WGFöãà ¢¶6äF÷væÆöD76WDgVVÅ&W÷'B‡&W÷'D76WB’ò€¢Æ'WGFöâG—SÒ&'WGFöâ"6Æ74æÖS×·7G–ÆW2æ76WE&W÷'D÷F–öä'WGFöçÒöä6Æ–6³×¶÷Vä76WDgVVÅ&W÷'Df–ÇFW'Óà¢ÄFö7VÖVçD–6öâ6Æ74æÖS×·7G–ÆW2æ'WGFöä–6öçÒóà¢Ç7ãà¢Ç7G&öæsç¶—4GF6†–ætW‡FW&æÅ&W÷'BòtFBgVVÂ&W÷'Br¢tF÷væÆöBgVVÂ&W÷'BwÓÂ÷7G&öæsà¢Ç6ÖÆÃåDb÷"W†6VÂgVVÂ6÷7G2'’ÖöçF‚ãÂ÷6ÖÆÃà¢Â÷7ãà¢Âö'WGFöãà¢’¢çVÆÇÐ ¢¶6äF÷væÆöD76WDFW&V6–F–öå&W÷'B‡&W÷'D76WB’ò€¢Æ'WGFöâG—SÒ&'WGFöâ"6Æ74æÖS×·7G–ÆW2æ76WE&W÷'D÷F–öä'WGFöçÒöä6Æ–6³×¶÷Vä76WDFW&V6–F–öå&W÷'Df–ÇFW'Óà¢ÄFö7VÖVçD–6öâ6Æ74æÖS×·7G–ÆW2æ'WGFöä–6öçÒóà¢Ç7ãà¢Ç7G&öæsç¶—4GF6†–ætW‡FW&æÅ&W÷'BòtFBFW&V6–F–öâÆörr¢tF÷væÆöBFW&V6–F–öâÆörwÓÂ÷7G&öæsà¢Ç6ÖÆÃåDb÷"W†6VÂÆöröb6fVBfÇVR6†ævW2ãÂ÷6ÖÆÃà¢Â÷7ãà¢Âö'WGFöãà¢’¢çVÆÇÐ ¢Æ'WGFöâG—SÒ&'WGFöâ"6Æ74æÖS×·7G–ÆW2æ76WE&W÷'D÷F–öä'WGFöçÒöä6Æ–6³×¶÷Vä76WD÷væW'6†—&W÷'Df–ÇFW'Óà¢ÄFö7VÖVçD–6öâ6Æ74æÖS×·7G–ÆW2æ'WGFöä–6öçÒóà¢Ç7ãà¢Ç7G&öæsç¶—4GF6†–ætW‡FW&æÅ&W÷'BòtFB6÷7Böb÷væW'6†—&W÷'Br¢tF÷væÆöB6÷7Böb÷væW'6†—&W÷'BwÓÂ÷7G&öæsà¢Ç6ÖÆÃåDb÷"W†6VÂ÷væW'6†—6÷7G2æBdBãÂ÷6ÖÆÃà¢Â÷7ãà¢Âö'WGFöãà¢Âóà¢’¢çVÆÇÐ¢ÂöF—cà¢—Ð¢ÂöF—cà¢ÂöF—cà¢ÂöF—cà¢’¢çVÆÇÐ ¢¶FVÆWFT6æF–FFT76WBò€¢ÆF—b6Æ74æÖS×¶G·7G–ÆW2æÖöFÄ÷fW&Æ—ÒG·7G–ÆW2æ6öæf—&ÔFVÆWFT÷fW&Æ—ÖÓà¢ÆF—b6Æ74æÖS×·7G–ÆW2æÖöFÄ&6¶G&÷Òöä6Æ–6³×¶6Æ÷6TFVÆWFT6öæf—&ÔF–ÆöwÒóà ¢ÆF—`¢6Æ74æÖS×·7G–ÆW2æFVÆWFT6öæf—&ÔÖöFÇÐ¢&öÆSÒ&ÆW'FF–Æör ¢&–ÖÖöFÃÒ'G'VR ¢&–ÖÆ&VÆÆVF'“Ò&FVÆWFRÖ6öæf—&Ò×F—FÆR ¢&–ÖFW67&–&VF'“Ò&FVÆWFRÖ6öæf—&ÒÖ6÷’ ¢à¢Æ'WGFöà¢G—SÒ&'WGFöâ ¢6Æ74æÖS×·7G–ÆW2æFVÆWFT6öæf—&Ô6Æ÷6T'WGFöçÐ¢öä6Æ–6³×¶6Æ÷6TFVÆWFT6öæf—&ÔF–ÆöwÐ¢&–ÖÆ&VÃÒ$6Æ÷6RFVÆWFR6öæf—&ÖF–öâ ¢F—6&ÆVC×¶'W7”FVÆWFT–BÓÓÒFVÆWFT6æF–FFT76WBæ–GÐ¢à¢Ä6Æ÷6T–6öâ6Æ74æÖS×·7G–ÆW2æ'WGFöä–6öçÒóà¢Âö'WGFöãà ¢ÆF—b6Æ74æÖS×·7G–ÆW2æFVÆWFT6öæf—&Ô6öçFVçGÓà¢Æƒ2–CÒ&FVÆWFRÖ6öæf—&Ò×F—FÆR#ä&R–÷R7W&R–÷RvçBFòFVÆWFRF†—3óÂöƒ3à¢Ç–CÒ&FVÆWFRÖ6öæf—&ÒÖ6÷’#à¢6öçF–çVRFòFVÆÂ–ÓG&–6Rv†B†VæVBFòÇ7G&öæsç¶FVÆWFT6æF–FFT76WBçF—FÆWÓÂ÷7G&öæsââvVçV–æRF—7÷6Ç2&R&6†—fVBæB¶WBf÷"&W÷'G2æB†—7F÷'“²öæÇ’Ö—7F¶W2÷"GWÆ–6FW2&RW&ÖæVçFÇ’&VÖ÷fVBà¢Â÷à ¢ÆF—b6Æ74æÖS×·7G–ÆW2æFVÆWFT6öæf—&Ô76WGÓà¢Ç7ãå6VÆV7FVB76WCÂ÷7ãà¢Ç7G&öæsç¶FVÆWFT6æF–FFT76WBçF—FÆWÓÂ÷7G&öæsà¢Ç6ÖÆÃç¶'V–ÆD76WDÖWF†FVÆWFT6æF–FFT76WB—Ò+r¶ÖöæW’†FVÆWFT6æF–FFT76WBçfÇVR—ÓÂ÷6ÖÆÃà¢ÂöF—cà ¢ÆF—b6Æ74æÖS×·7G–ÆW2æFVÆWFT6öæf—&Ô7F–öç7Óà¢Æ'WGFöâG—SÒ&'WGFöâ"6Æ74æÖS×·7G–ÆW2ç6V6öæF'”'WGFöçÒöä6Æ–6³×¶6Æ÷6TFVÆWFT6öæf—&ÔF–ÆöwÒF—6&ÆVC×¶'W7”FVÆWFT–BÓÓÒFVÆWFT6æF–FFT76WBæ–GÓà¢6æ6VÀ¢Âö'WGFöãà ¢Æ'WGFöà¢G—SÒ&'WGFöâ ¢6Æ74æÖS×¶G·7G–ÆW2ç&–Ö'”'WGFöçÒG·7G–ÆW2æFVÆWFT6öæf—&Ô'WGFöçÖÐ¢öä6Æ–6³×²‚’Óâfö–B†æFÆT6öæf—&ÔFVÆWFT76WB‚—Ð¢F—6&ÆVC×¶'W7”FVÆWFT–BÓÓÒFVÆWFT6æF–FFT76WBæ–GÐ¢à¢Ç7ãå–W2ÂFVÆWFR76WCÂ÷7ãà¢Âö'WGFöãà¢ÂöF—cà¢ÂöF—cà¢ÂöF—cà¢ÂöF—cà¢’¢çVÆÇÐ ¢¶'VÆ´f–ææ6T76WE–6¶W$÷VâbbVF—F–æt76WBò€¢ÆF—b6Æ74æÖS×¶G·7G–ÆW2æÖöFÄ÷fW&Æ—ÒG·7G–ÆW2æ'VÆ´f–ææ6U–6¶W$÷fW&Æ—ÖÓà¢ÆF—b6Æ74æÖS×·7G–ÆW2æÖöFÄ&6¶G&÷Òöä6Æ–6³×²‚’Óâ6WD'VÆ´f–ææ6T76WE–6¶W$÷Vâ†fÇ6R—Òóà¢ÆF—b6Æ74æÖS×¶G·7G–ÆW2æÖöFÄ6&GÒG·7G–ÆW2æW‡÷'DÖöFÇÒG·7G–ÆW2æW‡÷'D76WE–6¶W$ÖöFÇÒG·7G–ÆW2æ'VÆ´f–ææ6T76WE–6¶W$ÖöFÇÖÒ&öÆSÒ&F–Æör"&–ÖÖöFÃÒ'G'VR"&–ÖÆ&VÆÆVF'“Ò&'VÆ²Öf–ææ6RÖ76WG2×F—FÆR#à¢ÆF—b6Æ74æÖS×¶G·7G–ÆW2æÖöFÄ†VFW'ÒG·7G–ÆW2æW‡÷'DÖöFÄ†VFW'ÖÓà¢ÆF—b6Æ74æÖS×·7G–ÆW2æÖöFÄ†VFW%FW‡GÓà¢Æƒ2–CÒ&'VÆ²Öf–ææ6RÖ76WG2×F—FÆR#ä6†ö÷6R76WG2f÷"'VÆ²f–ææ6SÂöƒ3à¢Çå6VÆV7BWfW'’76WB6÷fW&VB'’F†R6ÖRf–ææ6Rw&VVÖVçBãÂ÷à¢ÂöF—cà¢Æ'WGFöâG—SÒ&'WGFöâ"6Æ74æÖS×·7G–ÆW2æÖöFÄ6Æ÷6T'WGFöçÒöä6Æ–6³×²‚’Óâ6WD'VÆ´f–ææ6T76WE–6¶W$÷Vâ†fÇ6R—Ò&–ÖÆ&VÃÒ$6Æ÷6R'VÆ²f–ææ6R76WB–6¶W"#à¢Ä6Æ÷6T–6öâ6Æ74æÖS×·7G–ÆW2æ'WGFöä–6öçÒóà¢Âö'WGFöãà¢ÂöF—cà¢ÆF—b6Æ74æÖS×¶G·7G–ÆW2æÖöFÅ67&öÆÄ&öG—ÒG·7G–ÆW2æW‡÷'DÖöFÅ67&öÆÄ&öG—ÖÓà¢ÆF—b6Æ74æÖS×·7G–ÆW2æW‡÷'DÖöFÄ&öG—Óà¢Ç6V7F–öâ6Æ74æÖS×·7G–ÆW2çFd76WDF÷væÆöEæVÇÒ&–ÖÆ&VÃÒ$6†ö÷6R76WG2f÷"'VÆ²f–ææ6R#à¢ÆF—b6Æ74æÖS×·7G–ÆW2çFd76WDF÷væÆöEFööÆ&'Óà¢Æ–çW@¢6Æ74æÖS×·7G–ÆW2çFd76WE6V&6„–çWGÐ¢G—SÒ'6V&6‚ ¢fÇVS×¶'VÆ´f–ææ6T76WE6V&6‡Ð¢öä6†ævS×²†WfVçB’Óâ6WD'VÆ´f–ææ6T76WE6V&6‚†WfVçBçF&vWBçfÇVR—Ð¢Æ6V†öÆFW#Ò%6V&6‚76WG2âââ ¢&–ÖÆ&VÃÒ%6V&6‚76WG2f÷"'VÆ²f–ææ6R ¢óà¢ÆF—b6Æ74æÖS×·7G–ÆW2çFd76WDF÷væÆöEFööÆ&$7F–öç7Óà¢Æ'WGFöâG—SÒ&'WGFöâ"6Æ74æÖS×·7G–ÆW2ç6V6öæF'”'WGFöçÒöä6Æ–6³×²‚’Óâ6WD'VÆ´f–ææ6T76WD–G2„'&’æg&öÒ†æWr6WB…¶VF—F–æt76WBæ–BÂââçf—6–&ÆT'VÆ´f–ææ6T76WG2æÖ‚†76WB’Óâ76WBæ–B•Ò’’—Óå6VÆV7BÆÃÂö'WGFöãà¢Æ'WGFöâG—SÒ&'WGFöâ"6Æ74æÖS×·7G–ÆW2ç6V6öæF'”'WGFöçÒöä6Æ–6³×²‚’Óâ6WD'VÆ´f–ææ6T76WD–G2…¶VF—F–æt76WBæ–EÒ—ÒF—6&ÆVC×¶'VÆ´f–ææ6T76WD–G2æÆVæwF‚ÃÒÓä6ÆV#Âö'WGFöãà¢ÂöF—cà¢ÂöF—cà¢ÆF—b6Æ74æÖS×·7G–ÆW2çFd76WDF÷væÆöDÆ—7GÓà¢·f—6–&ÆT'VÆ´f–ææ6T76WG2æÆVæwF‚òf—6–&ÆT'VÆ´f–ææ6T76WG2æÖ‚†76WB’Óâ°¢6öç7B6VÆV7FVBÒ'VÆ´f–ææ6T76WD–E6WBæ†2†76WBæ–B“°¢6öç7B&WV—&VBÒ76WBæ–BÓÓÒVF—F–æt76WBæ–C°¢&WGW&â€¢ÆÆ&VÂ¶W“×¶76WBæ–GÒ6Æ74æÖS×¶G·7G–ÆW2çFd76WDF÷væÆöE&÷wÒG·6VÆV7FVBò7G–ÆW2çFd76WDF÷væÆöE&÷u6VÆV7FVB¢rwÒG·&WV—&VBò7G–ÆW2æ'VÆ´f–ææ6T7W'&VçD76WB¢rwÖÓà¢Æ–çWB6Æ74æÖS×·7G–ÆW2çFd76WDF÷væÆöD6†V6¶&÷„–çWGÒG—SÒ&6†V6¶&÷‚"6†V6¶VC×·6VÆV7FVGÒöä6†ævS×²‚’ÓâFövvÆT'VÆ´f–ææ6T76WB†76WBæ–B—ÒF—6&ÆVC×·&WV—&VGÒóà¢Ç7â6Æ74æÖS×·7G–ÆW2çFd76WDF÷væÆöD6†V6¶&÷‡Ò&–Ö†–FFVãÒ'G'VR"óà¢Ç7â6Æ74æÖS×·7G–ÆW2çFd76WDF÷væÆöD6÷—Óà¢Ç7G&öæsç¶76WBçF—FÆWÓÂ÷7G&öæsà¢Ç7ãç¶'V–ÆD76WDÖWF†76WB—ÓÂ÷7ãà¢Ç6ÖÆÃç¶76WD¶–æDÆ&VÂ†76WB—Ò+r¶ÖWF†öDÆ&VÂ†76WBç6VÆV7FVDÖWF†öB—×·&WV—&VBòr+r7W'&VçB76WBr¢rwÓÂ÷6ÖÆÃà¢Â÷7ãà¢Ç7â6Æ74æÖS×·7G–ÆW2çFd76WDF÷væÆöEfÇVWÓà¢Ç7G&öæsç¶ÖöæW’†76WBçfÇVR—ÓÂ÷7G&öæsà¢Ç6ÖÆÃæ7W'&VçBfÇVSÂ÷6ÖÆÃà¢Â÷7ãà¢ÂöÆ&VÃà¢“°¢Ò’¢ÆF—b6Æ74æÖS×·7G–ÆW2çFd76WDF÷væÆöDV×G—Óäæò76WG2ÖF6‚–÷W"6V&6‚ãÂöF—cçÐ¢ÂöF—cà¢Â÷6V7F–öãà¢ÆF—b6Æ74æÖS×¶G·7G–ÆW2æf÷&Ô7F–öç7ÒG·7G–ÆW2æW‡÷'D7F–öç7ÒG·7G–ÆW2çFd76WDF÷væÆöD7F–öç7ÖÓà¢Æ'WGFöâG—SÒ&'WGFöâ"6Æ74æÖS×·7G–ÆW2ç6V6öæF'”'WGFöçÒöä6Æ–6³×²‚’Óâ6WD'VÆ´f–ææ6T76WE–6¶W$÷Vâ†fÇ6R—Óä&6³Âö'WGFöãà¢Æ'WGFöâG—SÒ&'WGFöâ"6Æ74æÖS×·7G–ÆW2ç&–Ö'”'WGFöçÒöä6Æ–6³×²‚’Óâ6WD'VÆ´f–ææ6T76WE–6¶W$÷Vâ†fÇ6R—Óç¶'VÆ´f–ææ6T76WD–G2æÆVæwF‡Ò6VÆV7FVB+rFöæSÂö'WGFöãà¢ÂöF—cà¢ÂöF—cà¢ÂöF—cà¢ÂöF—cà¢ÂöF—cà¢’¢çVÆÇÐ ¢¶F—7÷6Ä6æF–FFT76WBò€¢ÆF—b6Æ74æÖS×¶G·7G–ÆW2æÖöFÄ÷fW&Æ—ÒG·7G–ÆW2æ6öæf—&ÔFVÆWFT÷fW&Æ—ÖÓà¢ÆF—b6Æ74æÖS×·7G–ÆW2æÖöFÄ&6¶G&÷Òöä6Æ–6³×²‚’Óâ²–b‚'W7”FVÆWFT–B’6WDF—7÷6Ä6æF–FFT76WB†çVÆÂ“²×Òóà¢Æf÷&Ò6Æ74æÖS×¶G·7G–ÆW2æÖöFÄ6&GÒG·7G–ÆW2æ76WDÆ–fV7–6ÆTÖöFÇÒG·7G–ÆW2æ76WDF—7÷6ÄÖöFÇÖÒ&öÆSÒ&F–Æör"&–ÖÖöFÃÒ'G'VR"&–ÖÆ&VÆÆVF'“Ò&F—7÷6Â×F—FÆR"öå7V&Ö—C×¶†æFÆT6öæf—&ÔF—7÷6ÇÓà¢ÆF—b6Æ74æÖS×¶G·7G–ÆW2æÖöFÄ†VFW'ÒG·7G–ÆW2æ76WDF—7÷6Ä†VFW'ÖÓà¢ÆF—b6Æ74æÖS×·7G–ÆW2æÖöFÄ†VFW%FW‡GÓà¢Æƒ2–CÒ&F—7÷6Â×F—FÆR#åv†B†VæVBFòF†—276WCóÂöƒ3à¢Çç¶F—7÷6Ä6æF–FFT76WBçF—FÆWÓÂ÷à¢ÂöF—cà¢Æ'WGFöâG—SÒ&'WGFöâ"6Æ74æÖS×·7G–ÆW2æÖöFÄ6Æ÷6T'WGFöçÒöä6Æ–6³×²‚’Óâ6WDF—7÷6Ä6æF–FFT76WB†çVÆÂ—ÒF—6&ÆVC×¶'W7”FVÆWFT–BÓÓÒF—7÷6Ä6æF–FFT76WBæ–GÒ&–ÖÆ&VÃÒ$6Æ÷6RF—7÷6ÂFWF–Ç2#à¢Ä6Æ÷6T–6öâ6Æ74æÖS×·7G–ÆW2æ'WGFöä–6öçÒóà¢Âö'WGFöãà¢ÂöF—cà¢ÆF—b6Æ74æÖS×¶G·7G–ÆW2æÖöFÅ67&öÆÄ&öG—ÒG·7G–ÆW2æ76WDÆ–fV7–6ÆT&öG—ÒG·7G–ÆW2æ76WDF—7÷6Ä&öG—ÖÓà¢ÆF—b6Æ74æÖS×·7G–ÆW2æ76WDF—7÷6Ä–çG&÷ÓãÇ7G&öæsä6†ö÷6Rv†B†VæVCÂ÷7G&öæsãÇ6ÖÆÃåF†R76WBv–ÆÂ&R&6†—fVBVæÆW72—Bv2FFVB'’Ö—7F¶RãÂ÷6ÖÆÃãÂöF—cà¢ÆF—b6Æ74æÖS×·7G–ÆW2æ76WDF—7÷6Å&V6öäw&–GÒ&öÆSÒ&w&÷W"&–ÖÆ&VÃÒ%&V6öâf÷"&VÖ÷f–ær76WB#à¢²…°¢²w6öÆBrÂu6öÆBuÒÀ¢²wG&FVEö–ârÂuG&FVB–âuÒÀ¢²w67&VBrÂu67&VBuÒÀ¢²ww&—GFVåööfbrÂuw&—GFVâöfbuÒÀ¢²vÖ—7F¶UöGWÆ–6FRrÂtFFVB'’Ö—7F¶RuÒÀ¢²v÷F†W"rÂt÷F†W"uÒÀ¢Ò26öç7B’æÖ‚…·fÇVRÂÆ&VÅÒ’Óâ€¢Æ'WGFöâ¶W“×·fÇVWÒG—SÒ&'WGFöâ"6Æ74æÖS×¶G·7G–ÆW2æ76WDF—7÷6Å&V6öä'WGFöçÒG¶F—7÷6ÄG&gBç&V6öâÓÓÒfÇVRò7G–ÆW2æ76WDF—7÷6Å&V6öä'WGFöä7F—fR¢rwÖÒ&–×&W76VC×¶F—7÷6ÄG&gBç&V6öâÓÓÒfÇVWÒöä6Æ–6³×²‚’Óâ6WDF—7÷6ÄG&gB‚†7W'&VçB’Óâ‡²ââæ7W'&VçBÂ&V6öã¢fÇVR2F—7÷6Å&V6öâÒ’—Óà¢Ç7â6Æ74æÖS×·7G–ÆW2æ76WDF—7÷6Å&V6öäÖ&¶W'Ò&–Ö†–FFVãÒ'G'VR"óà¢Ç7G&öæsç¶Æ&VÇÓÂ÷7G&öæsà¢Âö'WGFöãà¢’—Ð¢ÂöF—cà¢¶F—7÷6ÄG&gBç&V6öâÓÒvÖ—7F¶UöGWÆ–6FRrò€¢ÆF—b6Æ74æÖS×¶G·7G–ÆW2æ76WDÆ–fV7–6ÆTf–VÆG7ÒG·7G–ÆW2æ76WDF—7÷6Äf–VÆG7ÖÓà¢ÆÆ&VÂ6Æ74æÖS×·7G–ÆW2æ76WE6WGF–æw4f–VÆGÓà¢Ç7ãäF—7÷6ÂFFSÂ÷7ãà¢Æ–çWBG—SÒ&FFR"&WV—&VBfÇVS×¶F—7÷6ÄG&gBæF—7÷6ÄFFWÒöä6†ævS×²†WfVçB’Óâ6WDF—7÷6ÄG&gB‚†7W'&VçB’Óâ‡²ââæ7W'&VçBÂF—7÷6ÄFFS¢WfVçBçF&vWBçfÇVRÒ’—Òóà¢ÂöÆ&VÃà¢ÆÆ&VÂ6Æ74æÖS×·7G–ÆW2æ76WE6WGF–æw4f–VÆGÓà¢Ç7ãäF—7÷6ÂÖ÷VçBÇ6ÖÆÃä÷F–öæÂÂW†6ÂâdCÂ÷6ÖÆÃãÂ÷7ãà¢Æ–çWB–çWDÖöFSÒ&FV6–ÖÂ"fÇVS×¶F—7÷6ÄG&gBæF—7÷6ÄÖ÷VçDW…fGÒöä6†ævS×²†WfVçB’Óâ6WDF—7÷6ÄG&gB‚†7W'&VçB’Óâ‡²ââæ7W'&VçBÂF—7÷6ÄÖ÷VçDW…fC¢WfVçBçF&vWBçfÇVRÒ’—ÒÆ6V†öÆFW#Ò%""óà¢ÂöÆ&VÃà¢ÆÆ&VÂ6Æ74æÖS×¶G·7G–ÆW2æ76WE6WGF–æw4f–VÆGÒG·7G–ÆW2æ76WDF—7÷6Äæ÷FTf–VÆGÖÓà¢Ç7ãäæ÷FRÇ6ÖÆÃä÷F–öæÃÂ÷6ÖÆÃãÂ÷7ãà¢ÇFW‡F&VfÇVS×¶F—7÷6ÄG&gBææ÷FWÒöä6†ævS×²†WfVçB’Óâ6WDF—7÷6ÄG&gB‚†7W'&VçB’Óâ‡²ââæ7W'&VçBÂæ÷FS¢WfVçBçF&vWBçfÇVRÒ’—ÒÆ6V†öÆFW#Ò$FB'W–W"ÂG&FRÖ–âÂw&—FRÖöfb÷"÷F†W"&VfW&Væ6R"óà¢ÂöÆ&VÃà¢ÂöF—cà¢’¢çVÆÇÐ¢¶F—7÷6ÄG&gBç&V6öâÓÓÒvÖ—7F¶UöGWÆ–6FRrò€¢Ç6Æ74æÖS×¶G·7G–ÆW2æ76WDÆ–fV7–6ÆTæ÷F–6WÒG·7G–ÆW2æ76WDF—7÷6ÄFVÆWFTæ÷F–6WÖÓà¢æòW‡ÆæF–öâ—2&WV—&VBâF†—2W&ÖæVçFÇ’&VÖ÷fW2F†RGWÆ–6FR76WBv†–ÆR&WF–æ–ær—G2FVÆWF–öâVF—BæBf–æÂ6æ6†÷Bà¢Â÷à¢’¢çVÆÇÐ¢ÆF—b6Æ74æÖS×¶G·7G–ÆW2æ76WE6WGF–æw47F–öç7ÒG·7G–ÆW2æ76WDF—7÷6Ä7F–öç7ÖÓà¢Æ'WGFöâG—SÒ&'WGFöâ"6Æ74æÖS×·7G–ÆW2ç6V6öæF'”'WGFöçÒöä6Æ–6³×²‚’Óâ6WDF—7÷6Ä6æF–FFT76WB†çVÆÂ—ÒF—6&ÆVC×¶'W7”FVÆWFT–BÓÓÒF—7÷6Ä6æF–FFT76WBæ–GÓä6æ6VÃÂö'WGFöãà¢Æ'WGFöâG—SÒ'7V&Ö—B"6Æ74æÖS×¶G·7G–ÆW2ç&–Ö'”'WGFöçÒG·7G–ÆW2æFVÆWFT6öæf—&Ô'WGFöçÖÒF—6&ÆVC×¶'W7”FVÆWFT–BÓÓÒF—7÷6Ä6æF–FFT76WBæ–BÇÂF—7÷6ÄG&gBç&V6öçÓà¢¶'W7”FVÆWFT–BÓÓÒF—7÷6Ä6æF–FFT76WBæ–Bòu6f–æ~(
br¢F—7÷6ÄG&gBç&V6öâÓÓÒvÖ—7F¶UöGWÆ–6FRròtFVÆWFRGWÆ–6FRr¢u6fRF—7÷6ÂwÐ¢Âö'WGFöãà¢ÂöF—cà¢ÂöF—cà¢Âöf÷&Óà¢ÂöF—cà¢’¢çVÆÇÐ ¢¶—4W‡÷'DÖöFÄ÷Vâò€¢ÆF—b6Æ74æÖS×¶G·7G–ÆW2æÖöFÄ÷fW&Æ—ÒG·7G–ÆW2æW‡÷'DÖöFÄ÷fW&Æ—ÖÓà¢ÆF—b6Æ74æÖS×·7G–ÆW2æÖöFÄ&6¶G&÷Òöä6Æ–6³×¶6Æ÷6TW‡÷'DÖöFÇÒóà ¢ÆF—`¢6Æ74æÖS×¶G·7G–ÆW2æÖöFÄ6&GÒG·7G–ÆW2æW‡÷'DÖöFÇÒG¶W‡÷'E7FWÓÓÒwFbÖ76WG2rò7G–ÆW2æW‡÷'D76WE–6¶W$ÖöFÂ¢rwÖÐ¢&öÆSÒ&F–Æör ¢&–ÖÖöFÃÒ'G'VR ¢&–ÖÆ&VÆÆVF'“Ò&W‡÷'B×F—FÆR ¢à¢ÆF—b6Æ74æÖS×¶G·7G–ÆW2æÖöFÄ†VFW'ÒG·7G–ÆW2æW‡÷'DÖöFÄ†VFW'ÖÓà¢ÆF—b6Æ74æÖS×·7G–ÆW2æÖöFÄ†VFW%FW‡GÓà¢Æƒ2–CÒ&W‡÷'B×F—FÆR"F$–æFWƒ×²ÓÓç¶—4GF6†–ætW‡FW&æÅ&W÷'BòtFB–ÓG&–6R&W÷'Br¢tW‡÷'B76WB&Vv—7FW"wÓÂöƒ3à¢¶—4GF6†–ætW‡FW&æÅ&W÷'BòÇä6†ö÷6RF†R&W÷'B–÷RvçBFòGF6‚Fò–÷W"ÖW76vRãÂ÷â¢çVÆÇÐ¢ÂöF—cà ¢Æ'WGFöâG—SÒ&'WGFöâ"6Æ74æÖS×·7G–ÆW2æÖöFÄ6Æ÷6T'WGFöçÒöä6Æ–6³×¶6Æ÷6TW‡÷'DÖöFÇÒ&–ÖÆ&VÃÒ$6Æ÷6RW‡÷'B÷F–öç2#à¢Ä6Æ÷6T–6öâ6Æ74æÖS×·7G–ÆW2æ'WGFöä–6öçÒóà¢Âö'WGFöãà¢ÂöF—cà ¢ÆF—b6Æ74æÖS×¶G·7G–ÆW2æÖöFÅ67&öÆÄ&öG—ÒG·7G–ÆW2æW‡÷'DÖöFÅ67&öÆÄ&öG—ÖÓà¢ÆF—b6Æ74æÖS×·7G–ÆW2æW‡÷'DÖöFÄ&öG—Óà¢¶W‡÷'E7FWÓÓÒvf÷&ÖBrò€¢Ãà¢ÆÆ&VÂ6Æ74æÖS×¶G·7G–ÆW2æf–VÆGÒG·7G–ÆW2æW‡÷'DVçF—G”æÖTf–VÆGÖÓà¢Ç7ãä76WB&Vv—7FW"ò&W÷'BæÖSÂ÷7ãà¢Æ–çW@¢fÇVS×¶W‡÷'DVçF—G”æÖWÐ¢öä6†ævS×²†WfVçB’Óâ6WDW‡÷'DVçF—G”æÖR†WfVçBçF&vWBçfÇVR—Ð¢Æ6V†öÆFW#Ò$VçFW"F†R76WB&Vv—7FW"÷"&W÷'BæÖR ¢F—6&ÆVC×¶—4W‡÷'F–æwÐ¢óà¢ÂöÆ&VÃà ¢ÆF—b6Æ74æÖS×·7G–ÆW2æW‡÷'D6†ö–6W7Óà¢Æ'WGFöà¢G—SÒ&'WGFöâ ¢6Æ74æÖS×¶G·7G–ÆW2æW‡÷'D÷F–öçÒG¶W‡÷'Df÷&ÖBÓÓÒwFbrò7G–ÆW2æW‡÷'D÷F–öä7F—fR¢rwÖÐ¢öä6Æ–6³×²‚’Óâ6VÆV7DW‡÷'Df÷&ÖB‚wFbr—Ð¢&–×&W76VC×¶W‡÷'Df÷&ÖBÓÓÒwFbwÐ¢à¢Ç7â6Æ74æÖS×·7G–ÆW2æW‡÷'Dw&†–7Óà¢ÄW‡÷'Dw&†–27&3Ò"ö'&æB÷Fbçær"ÇCÒ%DbW‡÷'B"–6öã×³ÅFd–6öâ6Æ74æÖS×·7G–ÆW2æW‡÷'D÷F–öä–6öçÒóçÒóà¢Â÷7ãà ¢Ç7â6Æ74æÖS×·7G–ÆW2æW‡÷'D÷F–öåF—FÆT&Æö6·Óà¢Ç7G&öæsåDb&W÷'CÂ÷7G&öæsà¢Ç6ÖÆÃä6†ö÷6R6ÆV"Db&W÷'Bf÷"6Æ–VçG2Â&æ·2÷"–ç7W&æ6R'FæW'2ãÂ÷6ÖÆÃà¢Â÷7ãà¢Âö'WGFöãà ¢Æ'WGFöà¢G—SÒ&'WGFöâ ¢6Æ74æÖS×¶G·7G–ÆW2æW‡÷'D÷F–öçÒG¶W‡÷'Df÷&ÖBÓÓÒw†Ç7‚rò7G–ÆW2æW‡÷'D÷F–öä7F—fR¢rwÖÐ¢öä6Æ–6³×²‚’Óâ6VÆV7DW‡÷'Df÷&ÖB‚w†Ç7‚r—Ð¢&–×&W76VC×¶W‡÷'Df÷&ÖBÓÓÒw†Ç7‚wÐ¢à¢Ç7â6Æ74æÖS×·7G–ÆW2æW‡÷'Dw&†–7Óà¢ÄW‡÷'Dw&†–27&3Ò"ö'&æB÷6†VWBçær"ÇCÒ%7&VG6†VWBW‡÷'B"–6öã×³Å7&VG6†VWD–6öâ6Æ74æÖS×·7G–ÆW2æW‡÷'D÷F–öä–6öçÒóçÒóà¢Â÷7ãà ¢Ç7â6Æ74æÖS×·7G–ÆW2æW‡÷'D÷F–öåF—FÆT&Æö6·Óà¢Ç7G&öæså„Å5‚v÷&¶&öö³Â÷7G&öæsà¢Ç6ÖÆÃäF÷væÆöBÆÂ&Vv—7FW"&÷w2–ââW†6VÂ×&VG’v÷&¶&öö²ãÂ÷6ÖÆÃà¢Â÷7ãà¢Âö'WGFöãà ¢ÂöF—cà ¢ÆF—b6Æ74æÖS×¶G·7G–ÆW2æf÷&Ô7F–öç7ÒG·7G–ÆW2æW‡÷'D7F–öç7ÖÓà¢Æ'WGFöâG—SÒ&'WGFöâ"6Æ74æÖS×·7G–ÆW2ç6V6öæF'”'WGFöçÒöä6Æ–6³×¶6Æ÷6TW‡÷'DÖöFÇÒF—6&ÆVC×¶—4W‡÷'F–æwÓà¢6æ6VÀ¢Âö'WGFöãà ¢Æ'WGFöâG—SÒ&'WGFöâ"6Æ74æÖS×·7G–ÆW2ç&–Ö'”'WGFöçÒöä6Æ–6³×¶†æFÆT6öæf—&ÔW‡÷'GÒF—6&ÆVC×¶—4W‡÷'F–æwÓà¢¶W‡÷'Df÷&ÖBÓÓÒwFbròÄ6†Wg&öå&–v‡D–6öâ6Æ74æÖS×·7G–ÆW2æ'WGFöä–6öçÒóâ¢ÄF÷væÆöD–6öâ6Æ74æÖS×·7G–ÆW2æ'WGFöä–6öçÒóçÐ¢Ç7ãç¶W‡÷'Df÷&ÖBÓÓÒwFbròtæW‡Br¢—4W‡÷'F–æròu&W&–ær&W÷'Bâââr¢—4GF6†–ætW‡FW&æÅ&W÷'BòtFBW†6VÂ&W÷'Br¢tF÷væÆöB„Å5‚wÓÂ÷7ãà¢Âö'WGFöãà¢ÂöF—cà¢Âóà¢’¢€¢Ãà¢¶W‡÷'E7FWÓÓÒwFb×&W÷'Brò€¢Ãà¢ÆF—b6Æ74æÖS×·7G–ÆW2çFe&W÷'E6VÆV7F÷'Óà¢ÆF—b6Æ74æÖS×·7G–ÆW2çFe&W÷'EF÷6†ö–6W7Óà¢Æ'WGFöà¢G—SÒ&'WGFöâ ¢6Æ74æÖS×¶G·7G–ÆW2çFe&W÷'D÷F–öçÒG·7G–ÆW2çFe&W÷'E&–Ö'”÷F–öçÒG·Fe&W÷'E6VÆV7F–öâÓÓÒgVÆÅFe&W÷'D÷F–öâçfÇVRò7G–ÆW2çFe&W÷'D÷F–öä7F—fR¢rwÖÐ¢öä6Æ–6³×²‚’Óâ†æFÆUFe&W÷'D6†ö–6R†gVÆÅFe&W÷'D÷F–öâçfÇVR—Ð¢F—6&ÆVC×¶—4W‡÷'F–æwÐ¢&–×&W76VC×·Fe&W÷'E6VÆV7F–öâÓÓÒgVÆÅFe&W÷'D÷F–öâçfÇVWÐ¢à¢Ç7â6Æ74æÖS×·7G–ÆW2çFe&W÷'D÷F–öäÖ–çÓà¢Ç7G&öæsç¶gVÆÅFe&W÷'D÷F–öâæÆ&VÇÓÂ÷7G&öæsà¢Â÷7ãà¢Âö'WGFöãà ¢Æ'WGFöà¢G—SÒ&'WGFöâ ¢6Æ74æÖS×¶G·7G–ÆW2çFe&W÷'D÷F–öçÒG·7G–ÆW2çFe&W÷'E&–Ö'”÷F–öçÒG·7G–ÆW2çFe&W÷'E7V6–f–4÷F–öçÖÐ¢öä6Æ–6³×¶÷VåFd76WD6†ö÷6W'Ð¢F—6&ÆVC×¶—4W‡÷'F–æwÐ¢à¢Ç7â6Æ74æÖS×·7G–ÆW2çFe&W÷'D÷F–öäÖ–çÓà¢Ç7G&öæsä6†ö÷6R7V6–f–276WG3Â÷7G&öæsà¢Â÷7ãà¢Âö'WGFöãà¢ÂöF—cà ¢ÆF—b6Æ74æÖS×·7G–ÆW2çFe&W÷'D6†ö–6W7Óà¢·V–6µFe&W÷'D÷F–öç2æÖ‚†÷F–öâ’Óâ€¢Æ'WGFöà¢¶W“×¶÷F–öâçfÇVWÐ¢G—SÒ&'WGFöâ ¢6Æ74æÖS×¶G·7G–ÆW2çFe&W÷'D÷F–öçÒG·Fe&W÷'E6VÆV7F–öâÓÓÒ÷F–öâçfÇVRò7G–ÆW2çFe&W÷'D÷F–öä7F—fR¢rwÖÐ¢öä6Æ–6³×²‚’Óâ†æFÆUFe&W÷'D6†ö–6R†÷F–öâçfÇVR—Ð¢F—6&ÆVC×¶—4W‡÷'F–æwÐ¢&–×&W76VC×·Fe&W÷'E6VÆV7F–öâÓÓÒ÷F–öâçfÇVWÐ¢à¢Ç7â6Æ74æÖS×·7G–ÆW2çFe&W÷'D÷F–öäÖ–çÓà¢Ç7â6Æ74æÖS×·7G–ÆW2çFe&W÷'EV–6´Æ&VÇÓç´54UEôd”ÅDU%ôÄ$TÅô%•õdÅTRævWB†÷F–öâçfÇVR’óò÷F–öâæÆ&VÇÓÂ÷7ãà¢Â÷7ãà¢Âö'WGFöãà¢’—Ð¢ÂöF—cà¢ÂöF—cà ¢ÆF—b6Æ74æÖS×¶G·7G–ÆW2æf÷&Ô7F–öç7ÒG·7G–ÆW2æW‡÷'D7F–öç7ÖÓà¢Æ'WGFöâG—SÒ&'WGFöâ"6Æ74æÖS×·7G–ÆW2ç6V6öæF'”'WGFöçÒöä6Æ–6³×¶6Æ÷6UFe&W÷'D6†ö÷6W'ÒF—6&ÆVC×¶—4W‡÷'F–æwÓà¢&6°¢Âö'WGFöãà ¢Æ'WGFöâG—SÒ&'WGFöâ"6Æ74æÖS×·7G–ÆW2ç6V6öæF'”'WGFöçÒöä6Æ–6³×¶6Æ÷6TW‡÷'DÖöFÇÒF—6&ÆVC×¶—4W‡÷'F–æwÓà¢6æ6VÀ¢Âö'WGFöãà¢ÂöF—cà¢Âóà¢’¢€¢Ãà¢Ç6V7F–öâ6Æ74æÖS×·7G–ÆW2çFd76WDF÷væÆöEæVÇÒ&–ÖÆ&VÃÒ$6†ö÷6R76WG2f÷"DbF÷væÆöB#à¢ÆF—b6Æ74æÖS×·7G–ÆW2çFd76WDF÷væÆöEFööÆ&'Óà¢Æ–çW@¢6Æ74æÖS×·7G–ÆW2çFd76WE6V&6„–çWGÐ¢G—SÒ'6V&6‚ ¢fÇVS×·Fd76WE6V&6…FW&×Ð¢öä6†ævS×²†WfVçB’Óâ6WEFd76WE6V&6…FW&Ò†WfVçBçF&vWBçfÇVR—Ð¢Æ6V†öÆFW#Ò%6V&6‚âââ ¢&–ÖÆ&VÃÒ%6V&6‚76WG2 ¢F—6&ÆVC×¶—4W‡÷'F–æwÐ¢óà ¢ÆF—b6Æ74æÖS×·7G–ÆW2çFd76WDF÷væÆöEFööÆ&$7F–öç7Óà¢Æ'WGFöà¢G—SÒ&'WGFöâ ¢6Æ74æÖS×·7G–ÆW2ç6V6öæF'”'WGFöçÐ¢öä6Æ–6³×·6VÆV7DÆÅFd76WG7Ð¢F—6&ÆVC×¶—4W‡÷'F–ærÇÂf—6–&ÆUFd76WG2æÆVæwF‚ÓÓÒÇÂÆÅf—6–&ÆUFd76WG56VÆV7FVGÐ¢à¢6VÆV7BÆÀ¢Âö'WGFöãà ¢Æ'WGFöà¢G—SÒ&'WGFöâ ¢6Æ74æÖS×·7G–ÆW2ç6V6öæF'”'WGFöçÐ¢öä6Æ–6³×¶6ÆV%6VÆV7FVEFd76WG7Ð¢F—6&ÆVC×¶—4W‡÷'F–ærÇÂ6VÆV7FVEFd76WD6÷VçBÓÓÒÐ¢à¢6ÆV ¢Âö'WGFöãà¢ÂöF—cà¢ÂöF—cà ¢ÆF—b6Æ74æÖS×·7G–ÆW2çFd76WDF÷væÆöDÆ—7GÓà¢·f—6–&ÆUFd76WG2æÆVæwF‚ò€¢f—6–&ÆUFd76WG2æÖ‚†76WB’Óâ°¢6öç7B—56VÆV7FVDf÷%FbÒ6VÆV7FVEFd76WD–E6WBæ†2†76WBæ–B“° ¢&WGW&â€¢ÆÆ&VÀ¢¶W“×¶76WBæ–GÐ¢6Æ74æÖS×¶G·7G–ÆW2çFd76WDF÷væÆöE&÷wÒG¶—56VÆV7FVDf÷%Fbò7G–ÆW2çFd76WDF÷væÆöE&÷u6VÆV7FVB¢rwÖÐ¢à¢Æ–çW@¢6Æ74æÖS×·7G–ÆW2çFd76WDF÷væÆöD6†V6¶&÷„–çWGÐ¢G—SÒ&6†V6¶&÷‚ ¢6†V6¶VC×¶—56VÆV7FVDf÷%FgÐ¢öä6†ævS×²‚’ÓâFövvÆUFd76WE6VÆV7F–öâ†76WBæ–B—Ð¢F—6&ÆVC×¶—4W‡÷'F–æwÐ¢óà¢Ç7â6Æ74æÖS×·7G–ÆW2çFd76WDF÷væÆöD6†V6¶&÷‡Ò&–Ö†–FFVãÒ'G'VR"óà ¢Ç7â6Æ74æÖS×·7G–ÆW2çFd76WDF÷væÆöD6÷—Óà¢Ç7G&öæsç¶76WBçF—FÆWÓÂ÷7G&öæsà¢Ç7ãç¶'V–ÆD76WDÖWF†76WB—ÓÂ÷7ãà¢Ç6ÖÆÃç¶76WD¶–æDÆ&VÂ†76WB—Ò+r¶ÖWF†öDÆ&VÂ†76WBç6VÆV7FVDÖWF†öB—ÓÂ÷6ÖÆÃà¢Â÷7ãà ¢Ç7â6Æ74æÖS×·7G–ÆW2çFd76WDF÷væÆöEfÇVWÓà¢Ç7G&öæsç¶ÖöæW’†76WBçfÇVR—ÓÂ÷7G&öæsà¢Ç6ÖÆÃæ7W'&VçBfÇVSÂ÷6ÖÆÃà¢Â÷7ãà¢ÂöÆ&VÃà¢“°¢Ò¢’¢€¢ÆF—b6Æ74æÖS×·7G–ÆW2çFd76WDF÷væÆöDV×G—Óäæò76WG2ÖF6‚–÷W"6V&6‚ãÂöF—cà¢—Ð¢ÂöF—cà¢Â÷6V7F–öãà ¢ÆF—b6Æ74æÖS×¶G·7G–ÆW2æf÷&Ô7F–öç7ÒG·7G–ÆW2æW‡÷'D7F–öç7ÒG·7G–ÆW2çFd76WDF÷væÆöD7F–öç7ÖÓà¢Æ'WGFöâG—SÒ&'WGFöâ"6Æ74æÖS×·7G–ÆW2ç6V6öæF'”'WGFöçÒöä6Æ–6³×¶&6µFõFe&W÷'D6†ö÷6W'ÒF—6&ÆVC×¶—4W‡÷'F–æwÓà¢&6°¢Âö'WGFöãà ¢Æ'WGFöâG—SÒ&'WGFöâ"6Æ74æÖS×·7G–ÆW2ç6V6öæF'”'WGFöçÒöä6Æ–6³×¶6Æ÷6TW‡÷'DÖöFÇÒF—6&ÆVC×¶—4W‡÷'F–æwÓà¢6æ6VÀ¢Âö'WGFöãà ¢Æ'WGFöà¢G—SÒ&'WGFöâ ¢6Æ74æÖS×¶G·7G–ÆW2ç&–Ö'”'WGFöçÒG·7G–ÆW2çFd76WDF÷væÆöD'WGFöçÖÐ¢öä6Æ–6³×²‚’Óâfö–B†æFÆTW‡÷'E6VÆV7FVEFe&W÷'B‚—Ð¢F—6&ÆVC×¶—4W‡÷'F–ærÇÂ6VÆV7FVEFd76WD6÷VçBÓÓÒÐ¢à¢ÄF÷væÆöD–6öâ6Æ74æÖS×·7G–ÆW2æ'WGFöä–6öçÒóà¢Ç7ãç¶—4W‡÷'F–æròu&W&–ærDbâââr¢—4GF6†–ætW‡FW&æÅ&W÷'Bò6VÆV7FVEFd76WD6÷VçBòFBG·6VÆV7FVEFd76WD6÷VçGÒ6VÆV7FVBDf¢tFB6VÆV7FVBDbr¢6VÆV7FVEFd76WD6÷VçBòF÷væÆöBG·6VÆV7FVEFd76WD6÷VçGÒ6VÆV7FVBDf¢tF÷væÆöB6VÆV7FVBDbwÓÂ÷7ãà¢Âö'WGFöãà¢ÂöF—cà¢Âóà¢—Ð¢Âóà¢—Ð¢ÂöF—cà¢ÂöF—cà¢ÂöF—cà¢ÂöF—cà¢’¢çVÆÇÐ ¢¶Ö&¶WGÆ6T76WBbbÖ&¶WGÆ6TG&gBò€¢ÆF—b6Æ74æÖS×¶G·7G–ÆW2æÖöFÄ÷fW&Æ—ÒG·7G–ÆW2ç7V$ÖöFÄ÷fW&Æ—ÖÓà¢ÆF—b6Æ74æÖS×·7G–ÆW2æÖöFÄ&6¶G&÷Òöä6Æ–6³×¶6Æ÷6TÖ&¶WGÆ6TÖöFÇÒóà ¢ÆF—b6Æ74æÖS×¶G·7G–ÆW2æÖöFÄ6&GÒG·7G–ÆW2æÖ&¶WGÆ6TÖöFÇÖÒ&öÆSÒ&F–Æör"&–ÖÖöFÃÒ'G'VR"&–ÖÆ&VÆÆVF'“Ò&Ö&¶WGÆ6RÖ6öæf—&Ò×F—FÆR#à¢ÆF—b6Æ74æÖS×¶G·7G–ÆW2æÖöFÄ†VFW'ÒG·7G–ÆW2æÖ&¶WGÆ6TÖöFÄ†VFW'ÖÓà¢ÆF—b6Æ74æÖS×·7G–ÆW2æÖöFÄ†VFW%FW‡GÓà¢Æƒ2–CÒ&Ö&¶WGÆ6RÖ6öæf—&Ò×F—FÆR#ç¶Ö&¶WGÆ6TÖöFÅF—FÆWÓÂöƒ3à¢Çä6†V6²F†RÆ—7F–ærF—FÆRÂ6¶–ær&–6RÂ†÷F÷2æB6VÆÆW"FWF–Ç2&Vf÷&R—BvöW2Æ—fRãÂ÷à¢ÂöF—cà ¢Æ'WGFöâG—SÒ&'WGFöâ"6Æ74æÖS×·7G–ÆW2æÖöFÄ6Æ÷6T'WGFöçÒöä6Æ–6³×¶6Æ÷6TÖ&¶WGÆ6TÖöFÇÒ&–ÖÆ&VÃÒ$6Æ÷6RÖ&¶WGÆ6RÖöFÂ#à¢Ä6Æ÷6T–6öâ6Æ74æÖS×·7G–ÆW2æ'WGFöä–6öçÒóà¢Âö'WGFöãà¢ÂöF—cà ¢ÆF—b6Æ74æÖS×¶G·7G–ÆW2æÖöFÅ67&öÆÄ&öG—ÒG·7G–ÆW2æÖ&¶WGÆ6TÖöFÅ67&öÆÄ&öG—ÖÓà¢Æf÷&Ò6Æ74æÖS×·7G–ÆW2æÖ&¶WGÆ6Tf÷&×Òöå7V&Ö—C×¶†æFÆT6öæf—&ÔÖ&¶WGÆ6UV&Æ—6‡Óà¢Ç6V7F–öâ6Æ74æÖS×·7G–ÆW2æÖ&¶WGÆ6T76WE7VÖÖ'—Óà¢ÆF—b6Æ74æÖS×·7G–ÆW2æÖ&¶WGÆ6UF—FÆU&Wf–WwÓà¢Ç7ãäÆ—7F–ærF—FÆSÂ÷7ãà¢Ç7G&öæsç¶Ö&¶WGÆ6TÆ—7F–æuF—FÆWÓÂ÷7G&öæsà¢Ç6ÖÆÃå–V"ÖöFVÂÂW6vRæB6öæF—F–öâ&R–æ6ÇVFVB–âF†RÖ&¶WGÆ6RF—FÆRãÂ÷6ÖÆÃà¢ÂöF—cà ¢ÆF—b6Æ74æÖS×·7G–ÆW2æÖ&¶WGÆ6T76WE7VÖÖ'•fÇVWÓà¢Ç7ãå&Vv—7FW"fÇVSÂ÷7ãà¢Ç7G&öæsç¶ÖöæW’†Ö&¶WGÆ6T76WBçfÇVR—ÓÂ÷7G&öæsà¢Ç6ÖÆÃäW†6ÂâdCÂ÷6ÖÆÃà¢ÂöF—cà¢Â÷6V7F–öãà ¢ÆF—b6Æ74æÖS×·7G–ÆW2æÖ&¶WGÆ6T&öG”w&–GÓà¢ÆF—b6Æ74æÖS×·7G–ÆW2æÖ&¶WGÆ6TÆ—7F–æt6öÇVÖçÓà¢Ç6V7F–öâ6Æ74æÖS×·7G–ÆW2æÖ&¶WGÆ6U&–6UæVÇÓà¢ÆÆ&VÂ6Æ74æÖS×¶G·7G–ÆW2æf–VÆGÒG·7G–ÆW2æÖ&¶WGÆ6U&–6Tf–VÆGÖÓà¢Ç7ãä6¶–ær&–6RW†6ÂâdCÂ÷7ãà¢ÆF—b6Æ74æÖS×·7G–ÆW2æÖ&¶WGÆ6T7W'&Væ7”–çWGÓà¢Ç7â6Æ74æÖS×·7G–ÆW2æÖ&¶WGÆ6T7W'&Væ7•&Vf—‡Óå#Â÷7ãà¢Æ–çW@¢G—SÒ'FW‡B ¢–çWDÖöFSÒ&çVÖW&–2 ¢fÇVS×¶Ö&¶WGÆ6TG&gBæ6¶–æu&–6TW…fGÐ¢öä6†ævS×²†WfVçB’Óà¢6WDÖ&¶WGÆ6TG&gB‚†7W'&VçB’Óà¢7W'&VçBò²ââæ7W'&VçBÂ6¶–æu&–6TW…fC¢f÷&ÖDÖ&¶WGÆ6U&–6T–çWB†WfVçBçF&vWBçfÇVR’Ò¢7W'&VçBÀ¢¢Ð¢öä&ÇW#×²‚’Óà¢6WDÖ&¶WGÆ6TG&gB‚†7W'&VçB’Óà¢7W'&VçBò²ââæ7W'&VçBÂ6¶–æu&–6TW…fC¢f÷&ÖDÖ&¶WGÆ6U&–6T–çWB†7W'&VçBæ6¶–æu&–6TW…fB’Ò¢7W'&VçBÀ¢¢Ð¢Æ6V†öÆFW#Ò# ¢WFôfö7W0¢&–ÖÆ&VÃÒ$Ö&¶WGÆ6R&–6RW†6ÇVF–ærdB ¢óà¢ÂöF—cà¢Ç6ÖÆÂ6Æ74æÖS×·7G–ÆW2æÖ&¶WGÆ6U&–6T†–çGÓåF†RVçFW&VB&–6R—26fVB2F†RÆ—7F–ær6¶–ær&–6RW†6ÇVF–ærdBãÂ÷6ÖÆÃà¢ÂöÆ&VÃà¢Â÷6V7F–öãà ¢Ç6V7F–öâ6Æ74æÖS×·7G–ÆW2æÖ&¶WGÆ6U†÷F÷5æVÇÓà¢ÆF—b6Æ74æÖS×·7G–ÆW2æÖ&¶WGÆ6UæVÄ†VF–æwÓà¢Ç7ãå†÷F÷3Â÷7ãà¢Ç6ÖÆÃà¢¶Ö&¶WGÆ6U†÷FõW&Ç2æÆVæwF€¢òG¶Ö&¶WGÆ6U†÷FõW&Ç2æÆVæwF‡ÒWÆöFVB†÷FòG¶Ö&¶WGÆ6U†÷FõW&Ç2æÆVæwF‚ÓÓÒòrr¢w2wÒv–ÆÂ&R6†÷vâöâF†RÆ—7F–æræ ¢¢tæò†÷F÷2&RWÆöFVBf÷"F†—276WB–WBâwÐ¢Â÷6ÖÆÃà¢ÂöF—cà ¢¶Ö&¶WGÆ6U†÷FõW&Ç2æÆVæwF‚ò€¢ÆF—b6Æ74æÖS×·7G–ÆW2æÖ&¶WGÆ6U†÷Fõ&Wf–WwÓà¢Æ–Öp¢7&3×¶Ö&¶WGÆ6U†÷FõW&Ç5³×Ð¢ÇC×¶G¶Ö&¶WGÆ6T76WBçF—FÆWÒÖ–âÖ&¶WGÆ6R†÷FöÐ¢6Æ74æÖS×·7G–ÆW2æÖ&¶WGÆ6TÖ–å†÷F÷Ð¢óà ¢¶Ö&¶WGÆ6U†÷FõW&Ç2æÆVæwF‚âò€¢ÆF—b6Æ74æÖS×·7G–ÆW2æÖ&¶WGÆ6U†÷Fõ7G&—Ò&–ÖÆ&VÃÒ$Ö&¶WGÆ6RÆ—7F–ær†÷F÷2#à¢¶Ö&¶WGÆ6U†÷FõW&Ç2ç6Æ–6RƒÂb’æÖ‚‡†÷FõW&ÂÂ–æFW‚’Óâ€¢Æ–Ör¶W“×¶G·†÷FõW&ÇÒÒG¶–æFW‡ÖÒ7&3×·†÷FõW&ÇÒÇC×¶G¶Ö&¶WGÆ6T76WBçF—FÆWÒ†÷FòG¶–æFW‚²ÖÒóà¢’—Ð¢¶Ö&¶WGÆ6U†÷FõW&Ç2æÆVæwF‚âbòÇ7ãâ·¶Ö&¶WGÆ6U†÷FõW&Ç2æÆVæwF‚ÒgÓÂ÷7ãâ¢çVÆÇÐ¢ÂöF—cà¢’¢çVÆÇÐ¢ÂöF—cà¢’¢€¢ÆF—b6Æ74æÖS×·7G–ÆW2æÖ&¶WGÆ6Tæõ†÷F÷7Óà¢Ç7G&öæsäæò†÷F÷2WÆöFVCÂ÷7G&öæsà¢Ç7ãäFB†÷F÷2–âWFFR76WBFò6†÷r&VÂ76WB†÷F÷2öâF†RÖ&¶WGÆ6RãÂ÷7ãà¢ÂöF—cà¢—Ð¢Â÷6V7F–öãà ¢ÆÆ&VÂ6Æ74æÖS×¶G·7G–ÆW2æf–VÆGÒG·7G–ÆW2æÖ&¶WGÆ6Tæ÷FW4f–VÆGÖÓà¢Ç7ãäÆ—7F–æræ÷FW3Â÷7ãà¢ÇFW‡F&V¢fÇVS×¶Ö&¶WGÆ6TG&gBæFW67&—F–öçÐ¢öä6†ævS×²†WfVçB’Óâ6WDÖ&¶WGÆ6TG&gB‚†7W'&VçB’Óâ†7W'&VçBò²ââæ7W'&VçBÂFW67&—F–öã¢WfVçBçF&vWBçfÇVRÒ¢7W'&VçB’—Ð¢Æ6V†öÆFW#Ò$FB–×÷'FçB'W–W"æ÷FW2ÂW‡G&2Â6W'f–6R†—7F÷'’÷"¶æ÷vâ—77VW2â ¢óà¢ÂöÆ&VÃà¢ÂöF—cà ¢Ç6V7F–öâ6Æ74æÖS×·7G–ÆW2æÖ&¶WGÆ6U6VÆÆW%æVÇÓà¢ÆF—b6Æ74æÖS×·7G–ÆW2æÖ&¶WGÆ6U6VÆÆW$†VFW'Óà¢ÆƒCäVF—B6VÆÆW"FWF–Ç3ÂöƒCà¢Ç7ãå6†÷vâFò6–væVBÖ–âÖ&¶WGÆ6RW6W'3Â÷7ãà¢ÂöF—cà ¢ÆF—b6Æ74æÖS×·7G–ÆW2æÖ&¶WGÆ6U6VÆÆW$w&–GÓà¢ÆÆ&VÂ6Æ74æÖS×¶G·7G–ÆW2æf–VÆGÒG·7G–ÆW2æÖ&¶WGÆ6T6öçF7Df–VÆGÒG·7G–ÆW2æÖ&¶WGÆ6Uv–FTf–VÆGÖÓà¢Ç7ãä'W6–æW72æÖSÂ÷7ãà¢Æ–çW@¢fÇVS×¶Ö&¶WGÆ6TG&gBç6VÆÆW$6ö×ç—Ð¢öä6†ævS×²†WfVçB’Óâ6WDÖ&¶WGÆ6TG&gB‚†7W'&VçB’Óâ†7W'&VçBò²ââæ7W'&VçBÂ6VÆÆW$6ö×ç“¢WfVçBçF&vWBçfÇVRÒ¢7W'&VçB’—Ð¢Æ6V†öÆFW#Ò$'W6–æW72æÖR ¢&–ÖÆ&VÃÒ$'W6–æW72æÖR ¢óà¢ÂöÆ&VÃà ¢ÆÆ&VÂ6Æ74æÖS×¶G·7G–ÆW2æf–VÆGÒG·7G–ÆW2æÖ&¶WGÆ6T6öçF7Df–VÆGÖÓà¢Ç7ãä6öçF7BæÖSÂ÷7ãà¢Æ–çW@¢fÇVS×¶Ö&¶WGÆ6TG&gBç6VÆÆW$æÖWÐ¢öä6†ævS×²†WfVçB’Óâ6WDÖ&¶WGÆ6TG&gB‚†7W'&VçB’Óâ†7W'&VçBò²ââæ7W'&VçBÂ6VÆÆW$æÖS¢WfVçBçF&vWBçfÇVRÒ¢7W'&VçB’—Ð¢Æ6V†öÆFW#Ò$6öçF7BæÖR ¢&–ÖÆ&VÃÒ$6öçF7BæÖR ¢óà¢ÂöÆ&VÃà ¢ÆÆ&VÂ6Æ74æÖS×¶G·7G–ÆW2æf–VÆGÒG·7G–ÆW2æÖ&¶WGÆ6T6öçF7Df–VÆGÖÓà¢Ç7ãå†öæSÂ÷7ãà¢Æ–çW@¢fÇVS×¶Ö&¶WGÆ6TG&gBç6VÆÆW%†öæWÐ¢öä6†ævS×²†WfVçB’Óâ6WDÖ&¶WGÆ6TG&gB‚†7W'&VçB’Óâ†7W'&VçBò²ââæ7W'&VçBÂ6VÆÆW%†öæS¢WfVçBçF&vWBçfÇVRÒ¢7W'&VçB’—Ð¢Æ6V†öÆFW#Ò%†öæR ¢&–ÖÆ&VÃÒ%†öæR ¢óà¢ÂöÆ&VÃà ¢ÆÆ&VÂ6Æ74æÖS×¶G·7G–ÆW2æf–VÆGÒG·7G–ÆW2æÖ&¶WGÆ6T6öçF7Df–VÆGÒG·7G–ÆW2æÖ&¶WGÆ6Uv–FTf–VÆGÖÓà¢Ç7ãä'W6–æW72VÖ–ÃÂ÷7ãà¢Æ–çW@¢G—SÒ&VÖ–Â ¢fÇVS×¶Ö&¶WGÆ6TG&gBç6VÆÆW$VÖ–ÇÐ¢öä6†ævS×²†WfVçB’Óâ6WDÖ&¶WGÆ6TG&gB‚†7W'&VçB’Óâ†7W'&VçBò²ââæ7W'&VçBÂ6VÆÆW$VÖ–Ã¢WfVçBçF&vWBçfÇVRÒ¢7W'&VçB’—Ð¢Æ6V†öÆFW#Ò$'W6–æW72VÖ–Â ¢&–ÖÆ&VÃÒ$'W6–æW72VÖ–Â ¢óà¢ÂöÆ&VÃà ¢ÆÆ&VÂ6Æ74æÖS×¶G·7G–ÆW2æf–VÆGÒG·7G–ÆW2æÖ&¶WGÆ6T6öçF7Df–VÆGÖÓà¢Ç7ãå&÷f–æ6SÂ÷7ãà¢Æ–çW@¢fÇVS×¶Ö&¶WGÆ6TG&gBç&÷f–æ6WÐ¢öä6†ævS×²†WfVçB’Óâ6WDÖ&¶WGÆ6TG&gB‚†7W'&VçB’Óâ†7W'&VçBò²ââæ7W'&VçBÂ&÷f–æ6S¢WfVçBçF&vWBçfÇVRÒ¢7W'&VçB’—Ð¢Æ6V†öÆFW#Ò%&÷f–æ6R ¢&–ÖÆ&VÃÒ%&÷f–æ6R ¢óà¢ÂöÆ&VÃà ¢ÆÆ&VÂ6Æ74æÖS×¶G·7G–ÆW2æf–VÆGÒG·7G–ÆW2æÖ&¶WGÆ6T6öçF7Df–VÆGÖÓà¢Ç7ãä&VÂ÷7ãà¢Æ–çW@¢fÇVS×¶Ö&¶WGÆ6TG&gBæ&VÐ¢öä6†ævS×²†WfVçB’Óâ6WDÖ&¶WGÆ6TG&gB‚†7W'&VçB’Óâ†7W'&VçBò²ââæ7W'&VçBÂ&V¢WfVçBçF&vWBçfÇVRÒ¢7W'&VçB’—Ð¢Æ6V†öÆFW#Ò$&V ¢&–ÖÆ&VÃÒ$&V ¢óà¢ÂöÆ&VÃà¢ÂöF—cà¢Â÷6V7F–öãà¢ÂöF—cà ¢ÆF—b6Æ74æÖS×¶G·7G–ÆW2æf÷&Ô7F–öç7ÒG·7G–ÆW2æÖ&¶WGÆ6T7F–öç7ÖÓà¢Æ'WGFöâG—SÒ&'WGFöâ"6Æ74æÖS×·7G–ÆW2ç6V6öæF'”'WGFöçÒöä6Æ–6³×¶6Æ÷6TÖ&¶WGÆ6TÖöFÇÒF—6&ÆVC×¶—5V&Æ—6†–ætÖ&¶WGÆ6WÓà¢6æ6VÀ¢Âö'WGFöãà ¢¶—4Æ—fTöäÖ&¶WGÆ6R†Ö&¶WGÆ6T76WB’ò€¢Æ'WGFöà¢G—SÒ&'WGFöâ ¢6Æ74æÖS×¶G·7G–ÆW2ç6V6öæF'”'WGFöçÒG·7G–ÆW2æ÷væW$Ö&¶WGÆ6U&VÖ÷fT'WGFöçÖÐ¢öä6Æ–6³×²‚’Óâfö–B†æFÆU&VÖ÷fTg&öÔÖ&¶WGÆ6R†Ö&¶WGÆ6T76WB—Ð¢F—6&ÆVC×¶—5V&Æ—6†–ætÖ&¶WGÆ6RÇÂ'W7”Ö&¶WGÆ6U&VÖ÷fT–BÓÓÒÖ&¶WGÆ6T76WBæ–GÐ¢à¢¶'W7”Ö&¶WGÆ6U&VÖ÷fT–BÓÓÒÖ&¶WGÆ6T76WBæ–Bòu&VÖ÷f–ærâââr¢u&VÖ÷fRÆ—7F–ærwÐ¢Âö'WGFöãà¢’¢çVÆÇÐ ¢Æ'WGFöà¢G—SÒ'7V&Ö—B ¢6Æ74æÖS×·7G–ÆW2ç&–Ö'”'WGFöçÐ¢F—6&ÆVC×¶—5V&Æ—6†–ætÖ&¶WGÆ6RÇÂ‡'6TÖöæW”–çWB†Ö&¶WGÆ6TG&gBæ6¶–æu&–6TW…fB’óò’ÃÒÐ¢à¢¶—5V&Æ—6†–ætÖ&¶WGÆ6P¢òuV&Æ—6†–ærâââp¢¢—4Æ—fTöäÖ&¶WGÆ6R†Ö&¶WGÆ6T76WB¢òuWFFRæBf–WrÆ—7F–ærp¢¢t6öæf—&ÒæBf–WrÆ—7F–ærwÐ¢Âö'WGFöãà¢ÂöF—cà¢Âöf÷&Óà¢ÂöF—cà¢ÂöF—cà¢ÂöF—cà¢’¢çVÆÇÐ ¢¶7F—fT76WBbb—5$ÖöFÄ÷Vâò€¢ÆF—b6Æ74æÖS×¶G·7G–ÆW2æÖöFÄ÷fW&Æ—ÒG·7G–ÆW2ç7V$ÖöFÄ÷fW&Æ—ÖÓà¢ÆF—b6Æ74æÖS×·7G–ÆW2æÖöFÄ&6¶G&÷Òöä6Æ–6³×¶6Æ÷6U$F–ÆöwÒóà ¢ÆF—b6Æ74æÖS×¶G·7G–ÆW2æÖöFÄ6&GÒG·7G–ÆW2ç$ÖöFÇÖÒ&öÆSÒ&F–Æör"&–ÖÖöFÃÒ'G'VR"&–ÖÆ&VÆÆVF'“Ò&76WB×"×F—FÆR#à¢ÆF—b6Æ74æÖS×¶G·7G–ÆW2æÖöFÄ†VFW'ÒG·7G–ÆW2ç$ÖöFÄ†VFW'ÖÓà¢ÆF—b6Æ74æÖS×·7G–ÆW2æÖöFÄ†VFW%FW‡GÓà¢Æƒ2–CÒ&76WB×"×F—FÆR#ç¶7F—fT76WBçF—FÆWÓÂöƒ3à¢ÇåW6RF†—2W&ÖæVçB"f÷"66â66W72âV&Æ–2"66ç2Çv—26²f÷"F†Rf&Ò”âãÂ÷à¢ÂöF—cà ¢Æ'WGFöâG—SÒ&'WGFöâ"6Æ74æÖS×·7G–ÆW2æÖöFÄ6Æ÷6T'WGFöçÒöä6Æ–6³×¶6Æ÷6U$F–ÆöwÒ&–ÖÆ&VÃÒ$6Æ÷6R"6öFR#à¢Ä6Æ÷6T–6öâ6Æ74æÖS×·7G–ÆW2æ'WGFöä–6öçÒóà¢Âö'WGFöãà¢ÂöF—cà ¢ÆF—b6Æ74æÖS×¶G·7G–ÆW2æÖöFÅ67&öÆÄ&öG—ÒG·7G–ÆW2ç$ÖöFÅ67&öÆÄ&öG—ÖÓà¢ÆF—b6Æ74æÖS×·7G–ÆW2ç$ÖöFÄ&öG—Óà¢ÆF—b6Æ74æÖS×·7G–ÆW2ç%&Wf–Wt6&GÓà¢Ç7â6Æ74æÖS×·7G–ÆW2ç%&Wf–WtW–V'&÷wÓåW&ÖæVçB76WB#Â÷7ãà¢ÆF—b6Æ74æÖS×·7G–ÆW2ç%&Wf–Wtg&ÖWÓà¢¶7F—fT76WBçV&Æ–476WD6öFRò€¢Æ–Ör7&3×¶'V–ÆD76WE%7fuW&Â†7F—fT76WB—ÒÇC×¶"6öFRf÷"G¶7F—fT76WBçF—FÆWÖÒóà¢’¢€¢Ç6Æ74æÖS×·7G–ÆW2ç%&Wf–WtfÆÆ&6·Óå"'Gv÷&²—2æ÷B&VG’f÷"F†—276WB–WBãÂ÷à¢—Ð¢ÂöF—cà¢ÂöF—cà ¢ÆF—b6Æ74æÖS×·7G–ÆW2ç%&–Ö'”7F–öç46&GÓà¢Æ'WGFöà¢G—SÒ&'WGFöâ ¢6Æ74æÖS×¶G·7G–ÆW2ç%&–Ö'”7F–öä'WGFöçÒG¶6÷–VE66äÆ–æ´76WD–BÓÓÒ7F—fT76WBæ–Bò7G–ÆW2ç$6÷–VD'WGFöâ¢rwÖÐ¢öä6Æ–6³×²‚’Óâfö–B†æFÆT6÷•66äÆ–æ²†7F—fT76WB—Ð¢à¢Ä6÷”–6öâ6Æ74æÖS×·7G–ÆW2æ'WGFöä–6öçÒóà¢Ç7ãç¶6÷–VE66äÆ–æ´76WD–BÓÓÒ7F—fT76WBæ–Bòt6÷–VBr¢t6÷’66âÆ–æ²wÓÂ÷7ãà¢Âö'WGFöãà ¢Æ'WGFöâG—SÒ&'WGFöâ"6Æ74æÖS×·7G–ÆW2ç%&–Ö'”7F–öä'WGFöçÒöä6Æ–6³×²‚’Óâ†æFÆU&–çE%6†VWB†7F—fT76WB—Óà¢Å&–çD–6öâ6Æ74æÖS×·7G–ÆW2æ'WGFöä–6öçÒóà¢Ç7ãå&–çB"Æ&VÃÂ÷7ãà¢Âö'WGFöãà ¢Æ'WGFöâG—SÒ&'WGFöâ"6Æ74æÖS×·7G–ÆW2ç%&–Ö'”7F–öä'WGFöçÒöä6Æ–6³×²‚’Óâfö–B†æFÆTF÷væÆöE"†7F—fT76WB—Óà¢Å$–6öâ6Æ74æÖS×·7G–ÆW2æ'WGFöä–6öçÒóà¢Ç7ãäF÷væÆöB#Â÷7ãà¢Âö'WGFöãà¢ÂöF—cà¢ÂöF—cà¢ÂöF—cà¢ÂöF—cà¢ÂöF—cà¢’¢çVÆÇÐ ¢·&ö¦V7F–öä76WBò€¢ÆF—b6Æ74æÖS×·7G–ÆW2æÖöFÄ÷fW&Æ—Óà¢ÆF—b6Æ74æÖS×·7G–ÆW2æÖöFÄ&6¶G&÷Òöä6Æ–6³×¶6Æ÷6U&ö¦V7F–öäÖöFÇÒóà ¢ÆF—b6Æ74æÖS×¶G·7G–ÆW2æÖöFÄ6&GÒG·7G–ÆW2ç&ö¦V7F–öäÖöFÇÖÒ&öÆSÒ&F–Æör"&–ÖÖöFÃÒ'G'VR"&–ÖÆ&VÆÆVF'“Ò'&ö¦V7F–öâ×F—FÆR#à¢ÆF—b6Æ74æÖS×¶G·7G–ÆW2æÖöFÄ†VFW'ÒG·7G–ÆW2ç&ö¦V7F–öäÖöFÄ†VFW'ÖÓà¢ÆF—b6Æ74æÖS×·7G–ÆW2æÖöFÄ†VFW%FW‡GÓà¢Æƒ2–CÒ'&ö¦V7F–öâ×F—FÆR#ç·&ö¦V7F–öä76WBçF—FÆWÓÂöƒ3à¢Çä6†ö÷6RF†RgWGW&R–V"Â–æfÆF–öâÂ6öæF—F–öâæBW6vRâV–6²6VÆV7F–öç2&V6Æ7VÆFR–ç7FçFÇ’ãÂ÷à¢ÂöF—cà ¢Æ'WGFöâG—SÒ&'WGFöâ"6Æ74æÖS×·7G–ÆW2æÖöFÄ6Æ÷6T'WGFöçÒöä6Æ–6³×¶6Æ÷6U&ö¦V7F–öäÖöFÇÒ&–ÖÆ&VÃÒ$6Æ÷6RgWGW&R&–6RÖöFÂ#à¢Ä6Æ÷6T–6öâ6Æ74æÖS×·7G–ÆW2æ'WGFöä–6öçÒóà¢Âö'WGFöãà¢ÂöF—cà ¢ÆF—b6Æ74æÖS×¶G·7G–ÆW2æÖöFÅ67&öÆÄ&öG—ÒG·7G–ÆW2ç&ö¦V7F–öå67&öÆÄ&öG—ÖÓà¢ÆF—b6Æ74æÖS×·7G–ÆW2ç&ö¦V7F–öå6–×ÆT&öG—Óà¢ÆF—b6Æ74æÖS×·7G–ÆW2ç&ö¦V7F–öä&6VÆ–æU7G&—Óà¢ÆF—cà¢Ç7ãä7W'&VçB6fVBfÇVSÂ÷7ãà¢Ç7G&öæsç¶ÖöæW’‡&ö¦V7F–öä76WBçfÇVR—ÓÂ÷7G&öæsà¢ÂöF—cà¢ÆF—cà¢Ç7ãä7W'&VçB6öæF—F–öãÂ÷7ãà¢Ç7G&öæsç¶6öæF—F–öäÆ&VÂ‡&ö¦V7F–öä76WBæ6öæF—F–öâ—ÓÂ÷7G&öæsà¢ÂöF—cà¢ÆF—cà¢Ç7ãä7W'&VçBW6vSÂ÷7ãà¢Ç7G&öæsç¶'V–ÆD76WEW6vUfÇVR‡&ö¦V7F–öä76WB—ÓÂ÷7G&öæsà¢ÂöF—cà¢ÂöF—cà ¢Ç6V7F–öâ6Æ74æÖS×·7G–ÆW2ç&ö¦V7F–öå6–×ÆT6&GÓà¢ÆF—b6Æ74æÖS×·7G–ÆW2ç&ö¦V7F–öå6–×ÆU6V7F–öä†VFW'Óà¢ÆƒCägWGW&R6WGF–æw3ÂöƒCà¢Çç·&ö¦V7F–öåW6vT†VÇFW‡GÓÂ÷à¢ÂöF—cà ¢ÆF—b6Æ74æÖS×·7G–ÆW2ç&ö¦V7F–öä–çWE&÷wÓà¢ÄÖöFÅ6VÆV7CÇ7G&–æsà¢Æ&VÃÒ%F&vWB–V" ¢fÇVS×·&ö¦V7F–öäf÷&ÒçF&vWE–V'Ð¢÷F–öç3×·&ö¦V7F–öå–V%6VÆV7D÷F–öç7Ð¢öä6†ævS×²‡fÇVR’ÓâWFFU&ö¦V7F–öäf÷&Ò‡²F&vWE–V#¢fÇVRÒ—Ð¢6Æ74æÖS×·7G–ÆW2ç&ö¦V7F–öå–V%6VÆV7Df–VÆGÐ¢óà ¢ÆÆ&VÂ6Æ74æÖS×·7G–ÆW2æf–VÆGÓà¢Ç7ãä–æfÆF–öâRæãÂ÷7ãà¢Æ–çW@¢G—SÒ&çVÖ&W" ¢Ö–ãÒ"ÓS ¢ÖƒÒ## ¢7FWÒ#ã ¢fÇVS×·&ö¦V7F–öäf÷&Òæ–æfÆF–öå&FU7GÐ¢öä6†ævS×²†WfVçB’ÓâWFFU&ö¦V7F–öäf÷&Ò‡²–æfÆF–öå&FU7C¢WfVçBçF&vWBçfÇVRÒ—Ð¢óà¢ÂöÆ&VÃà ¢ÆÆ&VÂ6Æ74æÖS×·7G–ÆW2æf–VÆGÓà¢Ç7ãç·&ö¦V7F–öåW6vTf–VÆDÆ&VÇÓÂ÷7ãà¢Æ–çW@¢G—SÒ&çVÖ&W" ¢Ö–ãÒ# ¢Öƒ×·&ö¦V7F–öåW6W5W&6VçEW6vRòsr¢VæFVf–æVGÐ¢7FW×·&ö¦V7F–öåW6W5W&6VçEW6vRòsãr¢sSwÐ¢fÇVS×·&ö¦V7F–öåW6W5W&6VçEW6vRò&ö¦V7F–öäf÷&ÒçF&vWDÆ–fUv÷&¶VEW&6VçB¢&ö¦V7F–öäf÷&ÒæW‡G&†÷W'7Ð¢öä6†ævS×²†WfVçB’ÓâWFFU&ö¦V7F–öäf÷&Ò€¢&ö¦V7F–öåW6W5W&6VçEW6vP¢ò²F&vWDÆ–fUv÷&¶VEW&6VçC¢WfVçBçF&vWBçfÇVRÐ¢¢²W‡G&†÷W'3¢WfVçBçF&vWBçfÇVRÒÀ¢—Ð¢Æ6V†öÆFW#×·&ö¦V7F–öåW6vUÆ6V†öÆFW'Ð¢óà¢ÂöÆ&VÃà¢ÂöF—cà ¢ÆF—b6Æ74æÖS×·7G–ÆW2ç&ö¦V7F–öåV–6µ&÷wÓà¢ÆF—b6Æ74æÖS×·7G–ÆW2ç&ö¦V7F–öåV–6´6÷—Óà¢Ç7ãåV–6²–æfÆF–öãÂ÷7ãà¢Ç6ÖÆÃä6†ö÷6R&FRFò&V6Æ7VÆFR–ç7FçFÇ’ãÂ÷6ÖÆÃà¢ÂöF—cà¢ÆF—b6Æ74æÖS×·7G–ÆW2ç&ö¦V7F–öåV–6´'WGFöç7Óà¢µ$ô¤T5D”ôåô”ädÄD”ôåõ$U4UE2æÖ‚‡&FR’Óâ°¢6öç7B—56VÆV7FVBÒ&ö¦V7F–öäf÷&Òæ–æfÆF–öå&FU7BÓÓÒ&FS° ¢&WGW&â€¢Æ'WGFöà¢¶W“×·&FWÐ¢G—SÒ&'WGFöâ ¢6Æ74æÖS×¶G·7G–ÆW2ç&ö¦V7F–öå&W6WD'WGFöçÒG¶—56VÆV7FVBò7G–ÆW2ç&ö¦V7F–öå&W6WD'WGFöä7F—fR¢rwÖÐ¢&–×&W76VC×¶—56VÆV7FVGÐ¢öä6Æ–6³×²‚’Óâ†æFÆU&ö¦V7F–öå&W6WB‡²–æfÆF–öå&FU7C¢&FRÒ—Ð¢à¢·&FWÒP¢Âö'WGFöãà¢“°¢Ò—Ð¢ÂöF—cà¢ÂöF—cà ¢ÆF—b6Æ74æÖS×·7G–ÆW2ç&ö¦V7F–öä6öæF—F–öä6&GÓà¢ÆF—b6Æ74æÖS×·7G–ÆW2ç&ö¦V7F–öä6öæF—F–öä†VFW'Óà¢Ç7ãägWGW&R6öæF—F–öãÂ÷7ãà¢Ç6ÖÆÃå6VÆV7BF†RW‡V7FVB6öæF—F–öââF†R&WF–æVBfÇVRW&6VçFvRÖF6†W2F†RW7F–ÖFRvRãÂ÷6ÖÆÃà¢ÂöF—cà¢ÆF—b6Æ74æÖS×·7G–ÆW2ç&ö¦V7F–öä6öæF—F–öäw&–GÓà¢µ$ô¤T5D”ôåô4ôäD•D”ôåôõD”ôå2æÖ‚†÷F–öâ’Óâ°¢6öç7B—56VÆV7FVBÒ&ö¦V7F–öäf÷&ÒçF&vWD6öæF—F–öâÓÓÒ÷F–öâæ¶W“° ¢&WGW&â€¢Æ'WGFöà¢¶W“×¶÷F–öâæ¶W—Ð¢G—SÒ&'WGFöâ ¢6Æ74æÖS×¶G·7G–ÆW2ç&ö¦V7F–öä6öæF—F–öä'WGFöçÒG¶—56VÆV7FVBò7G–ÆW2ç&ö¦V7F–öä6öæF—F–öä'WGFöä7F—fR¢rwÖÐ¢&–×&W76VC×¶—56VÆV7FVGÐ¢öä6Æ–6³×²‚’Óâ†æFÆU&ö¦V7F–öå&W6WB‡²F&vWD6öæF—F–öã¢÷F–öâæ¶W’Ò—Ð¢à¢Ç7G&öæsç¶÷F–öâæÆ&VÇÓÂ÷7G&öæsà¢Âö'WGFöãà¢“°¢Ò—Ð¢ÂöF—cà¢ÂöF—cà ¢Æ'WGFöâG—SÒ&'WGFöâ"6Æ74æÖS×¶G·7G–ÆW2ç&–Ö'”'WGFöçÒG·7G–ÆW2ç&ö¦V7F–öägVÆÅv–GF„'WGFöçÖÒöä6Æ–6³×¶†æFÆU&ö¦V7F–öå7V&Ö—GÒF—6&ÆVC×¶—4ÆöF–æu&ö¦V7F–öçÓà¢¶—4ÆöF–æu&ö¦V7F–öâòt6Æ7VÆF–ærâââr¢t6Æ7VÆFRgWGW&R&–6RwÐ¢Âö'WGFöãà¢Â÷6V7F–öãà ¢·&ö¦V7F–öäW'&÷"òÆF—b6Æ74æÖS×·7G–ÆW2ç&ö¦V7F–öäW'&÷'Óç·&ö¦V7F–öäW'&÷'ÓÂöF—câ¢çVÆÇÐ ¢·&ö¦V7F–öå&W7VÇBò€¢Ç6V7F–öâ&Vc×·&ö¦V7F–öå&W7VÇE&VgÒ6Æ74æÖS×·7G–ÆW2ç&ö¦V7F–öå6–×ÆU&W7VÇGÒ&–ÖÆ—fSÒ'öÆ—FR#à¢Ç7ãå&ö¦V7FVBgWGW&R&–6SÂ÷7ãà¢Ç7G&öæsç¶ÖöæW’‡&ö¦V7F–öå&W7VÇBç&ö¦V7FVBç&WF–ÄW…fB—ÓÂ÷7G&öæsà¢ÇäW7F–ÖFVBW‚dBfÇVRf÷"·&ö¦V7F–öå&W7VÇBçF&vWE–V'ÒãÂ÷à ¢ÆF—b6Æ74æÖS×·7G–ÆW2ç&ö¦V7F–öå6–×ÆTÖWFÓà¢ÆF—cà¢Ç7ãå–V#Â÷7ãà¢Ç7G&öæsç·&ö¦V7F–öå&W7VÇBæ&6U–V'Ò(i"·&ö¦V7F–öå&W7VÇBçF&vWE–V'ÓÂ÷7G&öæsà¢ÂöF—cà¢ÆF—cà¢Ç7ãç·&ö¦V7F–öåW6vTÖWFÆ&VÇÓÂ÷7ãà¢Ç7G&öæsà¢·&ö¦V7F–öåW6W5W&6VçEW6vP¢òG¶f÷&ÖE&ö¦V7F–öåv÷&¶VEW&6VçB‡&ö¦V7F–öä7W'&VçEv÷&¶VEW&6VçB—Ò(i"G¶f÷&ÖE&ö¦V7F–öåv÷&¶VEW&6VçB‡&ö¦V7F–öåF&vWEv÷&¶VEW&6VçB—Ö ¢¢G·&ö¦V7F–öå&W7VÇBæ7W'&VçBæ†÷W'2çFôÆö6ÆU7G&–ær‚vVâÕ¤r—Ò(i"G·&ö¦V7F–öå&W7VÇBç&ö¦V7FVBæ†÷W'2çFôÆö6ÆU7G&–ær‚vVâÕ¤r—ÒG·&ö¦V7F–öåW6vU6†÷'EVæ—GÖÐ¢Â÷7G&öæsà¢ÂöF—cà¢ÆF—cà¢Ç7ãä–æfÆF–öãÂ÷7ãà¢Ç7G&öæsç¶f÷&ÖEW&6VçB‡&ö¦V7F–öå&W7VÇBæ–æfÆF–öå&FU7B—ÒæãÂ÷7G&öæsà¢ÂöF—cà¢ÆF—cà¢Ç7ãä6öæF—F–öãÂ÷7ãà¢Ç7G&öæsç¶6öæF—F–öäÆ&VÂ‡&ö¦V7F–öä7W'&VçD6öæF—F–öâ—Ò(i"¶6öæF—F–öäÆ&VÂ‡&ö¦V7F–öåF&vWD6öæF—F–öâ—ÓÂ÷7G&öæsà¢Ç6ÖÆÃà¢·&ö¦V7F–öä6öæF—F–öå&WF–æVEW&6VçB‡&ö¦V7F–öä7W'&VçD6öæF—F–öâ—ÒR(i"·&ö¦V7F–öä6öæF—F–öå&WF–æVEW&6VçB‡&ö¦V7F–öåF&vWD6öæF—F–öâ—ÒR&WF–æV@¢Â÷6ÖÆÃà¢ÂöF—cà¢ÂöF—cà¢Â÷6V7F–öãà¢’¢—4ÆöF–æu&ö¦V7F–öâò€¢ÆF—b6Æ74æÖS×·7G–ÆW2ç&ö¦V7F–öäÆöF–æwÓä6Æ7VÆF–ærgWGW&R&–6RââãÂöF—cà¢’¢€¢ÆF—b6Æ74æÖS×·7G–ÆW2ç&ö¦V7F–öäV×G•&W7VÇGÓà¢Ç7G&öæsäæò&ö¦V7F–öâ–WCÂ÷7G&öæsà¢Ç7ãäVçFW"F†R6–×ÆR6WGF–æw2&÷fRæB6Æ7VÆFRãÂ÷7ãà¢ÂöF—cà¢—Ð¢ÂöF—cà¢ÂöF—cà¢ÂöF—cà¢ÂöF—cà¢’¢çVÆÇÐ ¢¶Fö7VÖVçEWÆöD76WBò€¢Ä76WDFö7VÖVçEWÆöDÖöFÀ¢76WD–C×¶Fö7VÖVçEWÆöD76WBæ–GÐ¢76WEF—FÆS×¶Fö7VÖVçEWÆöD76WBçF—FÆWÐ¢WÆöDVæGö–çC×¶66÷VçFçE6†&T–Bò76WEfVÇDFö7VÖVçG5W&Â†Fö7VÖVçEWÆöD76WBæ–B’¢rö’öFö7VÖVçG2wÐ¢öä6Æ÷6S×²‚’Óâ6Æ÷6T76WDFö7VÖVçEWÆöB†Fö7VÖVçEWÆöD76WBæ–B—Ð¢öåWÆöFVC×²†Fö7VÖVçG2Â÷WF6öÖR’Óâ†æFÆUfVÇDFö7VÖVçG5WÆöFVB†Fö7VÖVçEWÆöD76WBÂFö7VÖVçG2Â÷WF6öÖR—Ð¢óà¢’¢çVÆÇÐ ¢Ä76WDw&÷WÖævW$ÖöFÀ¢÷Vã×¶—476WDw&÷WÖöFÄ÷VçÐ¢æ6†÷$76WC×¶76WDw&÷WÖöFÄ76WGÐ¢w&÷W×¶76WDw&÷WÖöFÄw&÷WÐ¢76WG3×¶76WDw&÷WÖöFÄ76WG7Ð¢w&÷W3×¶76WDw&÷W7Ð¢–æ—F–Åf–Ws×¶76WDw&÷WÖöFÄ–æ—F–Åf–WwÐ¢6öÖ&–æVDÖöFS×¶—46öÖ&–æVE&Vv—7FW%f–WwÐ¢'W7“×¶—56f–æt76WDw&÷WÐ¢&W÷'D'W7“×¶—4W‡÷'F–æwÐ¢&W÷'DFVÆ—fW'”ÖöFS×¶W‡FW&æÅ6†&U&W÷'E66÷RÓÓÒvw&÷WròvGF6‚r¢vF÷væÆöBwÐ¢W'&÷#×¶76WDw&÷WW'&÷'Ð¢öä6Æ÷6S×¶6Æ÷6T76WDw&÷WÖævW'Ð¢öå6fS×¶†æFÆU6fT76WDw&÷WÐ¢öäFVÆWFS×¶†æFÆTFVÆWFT76WDw&÷WÐ¢öäF÷væÆöEFc×¶†æFÆTF÷væÆöD76WDw&÷WFgÐ¢öäF÷væÆöE†Ç7ƒ×¶†æFÆTF÷væÆöD76WDw&÷W†Ç7‡Ð¢öäF÷væÆöE&W÷'C×¶†æFÆTF÷væÆöD76WDw&÷W&W÷'GÐ¢óà ¢¶—466÷VçFçE&W÷'G4÷Vâbb66÷VçFçE6†&T–Bbb66÷VçFçD66W72ò€¢Ä66÷VçFçE&Vv—7FW%&W÷'G4ÖöFÀ¢6†&T–C×¶66÷VçFçE6†&T–GÐ¢&Vv—7FW$æÖS×¶7F—fU&Vv—7FW#òæ'W6–æW74æÖRÇÂ66÷VçFçD66W72æ÷væW$'W6–æW74æÖRÇÂt76WB&Vv—7FW"wÐ¢–æ6ÇVFTgVVÄÆVFvW#×¶66÷VçFçD66W72æ–æ6ÇVFTgVVÄÆVFvW'Ð¢–æ6ÇVFT6÷7DÆVFvW#×¶66÷VçFçD66W72æ–æ6ÇVFT6÷7DÆVFvW'Ð¢öä6Æ÷6S×²‚’Óâ6WD—466÷VçFçE&W÷'G4÷Vâ†fÇ6R—Ð¢óà¢’¢çVÆÇÐ¢ÂöÖ–ãà¢“°§Ð 