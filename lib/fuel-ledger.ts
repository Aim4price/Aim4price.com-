import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import type { PoolClient } from 'pg';
import type { NextRequest, NextResponse } from 'next/server';
import { getDb } from './db';
import { hashScanPin, verifyScanPin } from './scan-pin';
import { ensureAccountProfileColumns } from './account-profile';
import { buildAssetRegisterUploadUrl } from './asset-register-uploads';
import { parseFuelSlipDecimal } from './fuel-slip-number';
import { getActiveFieldManagerSessionFromRequest } from './field-manager-session';
import { validateFieldManagerFuelStorage } from './field-manager';
import { getOwnerAppAccess, ownerAppCan } from './owner-app-access';
import { resolveAssetUsage } from './asset-usage';

export const FUEL_SCAN_COOKIE_NAME = 'aim4price_fuel_scan';
export const FUEL_SCAN_SESSION_MAX_AGE_SECONDS = 60 * 60 * 12;

export type FuelStorageStatus = 'active' | 'archived';
export type FuelStorageEventType = 'opening_balance' | 'stock_in' | 'asset_issue' | 'dip' | 'adjustment';
export type FuelScanActorType = 'owner_session' | 'scan_pin' | 'field_manager';
export type FuelSlipTargetType = 'asset' | 'storage_tank';
export type FuelSlipExtractionStatus = 'manual' | 'extracted' | 'needs_review';
export type FuelLedgerRecordStatus = 'active' | 'voided';
export type FuelUsageMetric = 'hours' | 'km' | 'percentage' | 'none';
export type FuelTankBalanceTreatment = 'already_reflected' | 'not_yet_reflected' | 'not_sure';
export type FuelEvidenceStatus = 'internal_record_only' | 'evidence_supplied_review_required';
export type FuelBalanceVerificationStatus = 'verified' | 'needs_check';

export type FuelLedgerStorage = {
  id: string;
  userId: string;
  name: string;
  fuelType: string;
  capacityLitres: number | null;
  currentLitres: number;
  stockPercent: number | null;
  reorderLevelLitres: number | null;
  locationLabel: string;
  notes: string;
  dipstickNote: string;
  dipstickNoteUpdatedAtIso: string | null;
  balanceVerificationStatus: FuelBalanceVerificationStatus;
  balanceNeedsChecking: boolean;
  balanceCheckReason: string;
  balanceCheckSourceEventId: string;
  balanceCheckMarkedAtIso: string | null;
  status: FuelStorageStatus;
  publicFuelStorageCode: string;
  pinEnabled: boolean;
  hasPin: boolean;
  pinUpdatedAtIso: string | null;
  createdAtIso: string;
  updatedAtIso: string;
};

export type FuelLedgerEvent = {
  id: string;
  storageId: string;
  storageName: string;
  storagePublicCode: string;
  eventType: FuelStorageEventType;
  sourceType: string;
  sourceLabel: string;
  fuelSlipId: string;
  fuelSlipTargetType: string;
  fuelSlipSupplierName: string;
  fuelSlipFuelType: string;
  fuelSlipDocumentDate: string;
  fuelSlipDocumentTime: string;
  fuelSlipExtractionStatus: string;
  fuelSlipReviewRequired: boolean;
  fuelSlipReviewStatus: string;
  totalAmount: number | null;
  documentFileUrl: string;
  paymentMethod: string;
  cardNumberMasked: string;
  assetId: string;
  assetTitle: string;
  assetPlateLabel: string;
  litres: number;
  storageLevelBefore: number | null;
  storageLevelAfter: number | null;
  assetFuelPercentBefore: number | null;
  assetFuelPercentAfter: number | null;
  assetUsageReading: number | null;
  operatorName: string;
  activityText: string;
  workAreaText: string;
  note: string;
  latitude: number | null;
  longitude: number | null;
  locationText: string;
  isLateEntry: boolean;
  issueDate: string;
  issueTime: string;
  issueTimeRecorded: boolean;
  issueAtIso: string;
  entryAddedAtIso: string;
  addedByUserId: string;
  addedByName: string;
  addedByEmail: string;
  assetUsageMetric: FuelUsageMetric | '';
  lateEntryReason: string;
  evidenceType: string;
  evidenceReference: string;
  evidenceStatus: FuelEvidenceStatus | '';
  evidenceFileName: string;
  evidenceFileUrl: string;
  tankBalanceTreatment: FuelTankBalanceTreatment | '';
  linkedAdjustmentEventId: string;
  linkedMissingEntryEventId: string;
  adjustmentKind: string;
  idempotencyKey: string;
  gpsCaptureStatus: string;
  workUseExcluded: boolean;
  workUseExclusionReason: string;
  createdAtIso: string;
};

export type FuelSlipTransaction = {
  id: string;
  userId: string;
  sourceType: 'fuel_slip';
  sourceLabel: 'Fuel Slip';
  targetType: FuelSlipTargetType;
  assetId: string;
  assetTitle: string;
  storageId: string;
  storageName: string;
  fuelStorageEventId: string;
  assetInvoiceId: string;
  invoiceDocumentId: string;
  uploadId: string;
  documentFileUrl: string;
  originalFilename: string;
  contentType: string;
  byteSize: number | null;
  supplierName: string;
  supplierVatNumber: string;
  slipNumber: string;
  transactionNumber: string;
  documentDate: string;
  documentTime: string;
  fuelType: string;
  litres: number | null;
  pricePerLitre: number | null;
  totalAmount: number | null;
  vatAmount: number | null;
  vatIncluded: boolean | null;
  vatRate: number | null;
  paymentMethod: string;
  cardType: string;
  cardNumberMasked: string;
  cardLast4: string;
  merchantNumber: string;
  terminalNumber: string;
  siteNumber: string;
  odometerReading: number | null;
  hourMeterReading: number | null;
  usageNotApplicable: boolean;
  operatorName: string;
  operatorNotApplicable: boolean;
  activityText: string;
  activityNotApplicable: boolean;
  workAreaText: string;
  workAreaNotApplicable: boolean;
  note: string;
  latitude: number | null;
  longitude: number | null;
  locationText: string;
  clientCapturedAtIso: string | null;
  gpsAccuracyMeters: number | null;
  assetFuelPercentBefore: number | null;
  assetFuelPercentAfter: number | null;
  extractionStatus: FuelSlipExtractionStatus;
  ocrConfidence: number | null;
  reviewRequired: boolean;
  rawExtractedText: string;
  extractionWarnings: string[];
  workUseExcluded: boolean;
  workUseExclusionReason: string;
  recordStatus: FuelLedgerRecordStatus;
  voidedAtIso: string | null;
  voidedByName: string;
  voidReason: string;
  createdAtIso: string;
  updatedAtIso: string;
};

export type FuelLedgerAsset = {
  id: string;
  title: string;
  kind: string;
  assetTypeLabel: string;
  brandName: string;
  modelName: string;
  serialNumber: string;
  plateLabel: string;
  publicAssetCode: string;
  hours: number | null;
  fuelPercent: number | null;
  yearModel: number | null;
  condition: string;
  selectedMethod: string;
  currentValue: number | null;
  canReceiveFuel: boolean;
  isActive: boolean;
  usageMetric: 'hours' | 'km' | 'both' | 'percentage' | 'none';
  lifeWorkedPercent: number | null;
  workUseExcluded: boolean;
  workUseExclusionReason: string;
};

export type FuelLedgerAuditEvent = {
  id: string;
  recordType: string;
  recordId: string;
  action: string;
  actorName: string;
  actorEmail: string;
  reason: string;
  beforeSnapshot: Record<string, unknown> | null;
  afterSnapshot: Record<string, unknown> | null;
  createdAtIso: string;
};

export type FuelLedgerAuditActor = {
  userId?: unknown;
  name?: unknown;
  email?: unknown;
};

export type FuelLedgerSummary = {
  totalStorageUnits: number;
  totalCapacityLitres: number;
  currentLitres: number;
  currentStockPercent: number | null;
  lowStorageCount: number;
  issuedLitres30Days: number;
  filledLitres30Days: number;
  activeAssetsCount: number;
};

export type FuelLedgerData = {
  storages: FuelLedgerStorage[];
  recentEvents: FuelLedgerEvent[];
  recentFuelSlips: FuelSlipTransaction[];
  assets: FuelLedgerAsset[];
  summary: FuelLedgerSummary;
};

export type FuelStoragePublicPreview = {
  id: string;
  name: string;
  fuelType: string;
  publicFuelStorageCode: string;
  accountBusinessName: string;
  pinRequired: boolean;
  status: FuelStorageStatus;
};

export type FuelScanPayload = {
  storage: FuelLedgerStorage;
  accountBusinessName: string;
  assets: FuelLedgerAsset[];
  recentEvents: FuelLedgerEvent[];
};

type FuelStorageRow = {
  id: string;
  user_id: string | null;
  name: string | null;
  fuel_type: string | null;
  capacity_litres: string | number | null;
  current_litres: string | number | null;
  reorder_level_litres: string | number | null;
  location_label: string | null;
  notes: string | null;
  dipstick_note: string | null;
  dipstick_note_updated_at: string | null;
  balance_verification_status: string | null;
  balance_check_reason: string | null;
  balance_check_source_event_id: string | null;
  balance_check_marked_at: string | null;
  status: string | null;
  public_fuel_storage_code: string | null;
  pin_hash: string | null;
  pin_enabled: boolean | null;
  pin_updated_at: string | null;
  created_at: string | null;
  updated_at: string | null;
};

type FuelEventRow = {
  id: string;
  storage_id: string | null;
  storage_name: string | null;
  storage_public_code: string | null;
  event_type: string | null;
  source_type: string | null;
  source_label: string | null;
  fuel_slip_id: string | null;
  fs_target_type: string | null;
  fs_supplier_name: string | null;
  fs_fuel_type: string | null;
  fs_document_date: string | null;
  fs_document_time: string | null;
  fs_document_file_url: string | null;
  fs_payment_method: string | null;
  fs_card_number_masked: string | null;
  fs_card_last4: string | null;
  fs_extraction_status: string | null;
  fs_review_required: boolean | null;
  total_amount: string | number | null;
  document_file_url: string | null;
  payment_method: string | null;
  card_number_masked: string | null;
  asset_register_item_id: string | null;
  asset_title: string | null;
  asset_plate_label: string | null;
  litres: string | number | null;
  storage_level_before_litres: string | number | null;
  storage_level_after_litres: string | number | null;
  asset_fuel_percent_before: string | number | null;
  asset_fuel_percent_after: string | number | null;
  asset_usage_reading: string | number | null;
  operator_name: string | null;
  activity_text: string | null;
  work_area_text: string | null;
  note: string | null;
  latitude: string | number | null;
  longitude: string | number | null;
  location_text: string | null;
  is_late_entry: boolean | null;
  issue_date: string | null;
  issue_time: string | null;
  issue_time_recorded: boolean | null;
  issue_at: string | null;
  entry_added_at: string | null;
  added_by_user_id: string | null;
  added_by_name: string | null;
  added_by_email: string | null;
  asset_usage_metric: string | null;
  late_entry_reason: string | null;
  evidence_type: string | null;
  evidence_reference: string | null;
  evidence_status: string | null;
  evidence_id: string | null;
  evidence_file_name: string | null;
  tank_balance_treatment: string | null;
  linked_adjustment_event_id: string | null;
  linked_missing_entry_event_id: string | null;
  adjustment_kind: string | null;
  idempotency_key: string | null;
  gps_capture_status: string | null;
  work_use_excluded: boolean | null;
  work_use_exclusion_reason: string | null;
  created_at: string | null;
};

type FuelAssetRow = {
  id: string | number;
  title: string | null;
  kind: string | null;
  brand_name: string | null;
  model_name: string | null;
  typed_model_name: string | null;
  equipment_family_label: string | null;
  serial_number: string | null;
  plate_label: string | null;
  public_asset_code: string | null;
  qr_status: string | null;
  hours: string | number | null;
  life_worked_percent: string | number | null;
  fuel_percent: string | number | null;
  year_model?: string | number | null;
  condition?: string | null;
  selected_method?: string | null;
  current_value?: string | number | null;
  family_is_propelled: boolean | string | number | null;
  specs_json: unknown;
  work_use_excluded?: boolean | null;
  work_use_exclusion_reason?: string | null;
};

type FuelSlipRow = {
  id: string;
  user_id: string | null;
  source_type: string | null;
  source_label: string | null;
  target_type: string | null;
  asset_register_item_id: string | null;
  asset_title: string | null;
  storage_id: string | null;
  storage_name: string | null;
  fuel_storage_event_id: string | null;
  asset_invoice_id: string | null;
  invoice_document_id: string | null;
  upload_id: string | null;
  document_file_url: string | null;
  original_filename: string | null;
  content_type: string | null;
  byte_size: string | number | null;
  supplier_name: string | null;
  supplier_vat_number: string | null;
  slip_number: string | null;
  transaction_number: string | null;
  document_date: string | null;
  document_time: string | null;
  fuel_type: string | null;
  litres: string | number | null;
  price_per_litre: string | number | null;
  total_amount: string | number | null;
  vat_amount: string | number | null;
  vat_included: boolean | null;
  vat_rate: string | number | null;
  payment_method: string | null;
  card_type: string | null;
  card_number_masked: string | null;
  card_last4: string | null;
  merchant_number: string | null;
  terminal_number: string | null;
  site_number: string | null;
  odometer_reading: string | number | null;
  hour_meter_reading: string | number | null;
  usage_not_applicable: boolean | null;
  operator_name: string | null;
  operator_not_applicable: boolean | null;
  activity_text: string | null;
  activity_not_applicable: boolean | null;
  work_area_text: string | null;
  work_area_not_applicable: boolean | null;
  note: string | null;
  scan_latitude: string | number | null;
  scan_longitude: string | number | null;
  scan_location_text: string | null;
  scan_client_captured_at: string | null;
  scan_gps_accuracy_meters: string | number | null;
  asset_fuel_percent_before: string | number | null;
  asset_fuel_percent_after: string | number | null;
  extraction_status: string | null;
  ocr_confidence: string | number | null;
  review_required: boolean | null;
  raw_extracted_text: string | null;
  extraction_warnings: unknown;
  work_use_excluded: boolean | null;
  work_use_exclusion_reason: string | null;
  record_status: string | null;
  voided_at: string | null;
  voided_by_name: string | null;
  void_reason: string | null;
  created_at: string | null;
  updated_at: string | null;
};

type FuelStorageSessionClaims = {
  ownerUserId: string;
  storageId: string;
  publicFuelStorageCode: string;
  pinUpdatedAtMs: number;
  issuedAtMs: number;
  expiresAtMs: number;
};

let fuelLedgerTablesPromise: Promise<void> | null = null;

function asText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function asNumber(value: unknown): number | null {
  return parseFuelSlipDecimal(value, 4);
}

function asBoolean(value: unknown): boolean | null {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value === 1;

  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (['true', '1', 'yes', 'y'].includes(normalized)) return true;
    if (['false', '0', 'no', 'n'].includes(normalized)) return false;
  }

  return null;
}

function asRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }

  if (typeof value === 'string' && value.trim()) {
    try {
      const parsed = JSON.parse(value) as unknown;
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      return {};
    }
  }

  return {};
}

function markFuelAssetValuationNeedsUpdate(specs: Record<string, unknown>, reasons: string[]): Record<string, unknown> {
  const uniqueReasons = Array.from(new Set(reasons.map((reason) => reason.trim()).filter(Boolean)));

  if (!uniqueReasons.length) {
    return specs;
  }

  const nowIso = new Date().toISOString();
  const existingSince = asText(specs.valuation_stale_since) || asText(specs.valuationStaleSince) || nowIso;

  return {
    ...specs,
    valuationNeedsUpdate: true,
    valuation_needs_update: true,
    valuationStaleSince: existingSince,
    valuation_stale_since: existingSince,
    valuationStaleReason: uniqueReasons.join(', '),
    valuation_stale_reason: uniqueReasons.join(', '),
    valuationStaleReasons: uniqueReasons,
    valuation_stale_reasons: uniqueReasons,
  };
}

function hasSavedFuelAssetValuation(row: { valuation_run_id?: unknown; selected_method?: unknown }): boolean {
  const selectedMethod = asText(row.selected_method).toLowerCase();
  return Boolean(row.valuation_run_id) && selectedMethod !== 'manual';
}

function roundLitres(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function normalizePositiveLitres(value: unknown): number {
  const parsed = asNumber(value);

  if (parsed === null || parsed <= 0) {
    throw new Error('Enter litres greater than 0.');
  }

  return roundLitres(parsed);
}

function normalizeOptionalLitres(value: unknown): number | null {
  const parsed = asNumber(value);

  if (parsed === null) {
    return null;
  }

  return Math.max(0, roundLitres(parsed));
}

function normalizeFuelPercent(value: unknown): number | null {
  if (value === null || typeof value === 'undefined' || value === '') {
    return null;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return null;
  }

  return Math.max(0, Math.min(100, Math.round(parsed)));
}

function normalizeUsageReading(value: unknown): number | null {
  const parsed = parseFuelSlipDecimal(value, 2);
  if (parsed === null || parsed < 0) {
    return null;
  }

  return Math.round(parsed);
}

function normalizeMoneyValue(value: unknown): number | null {
  const parsed = asNumber(value);
  if (parsed === null || parsed < 0) return null;
  return Math.round(parsed * 100) / 100;
}

function normalizeRateValue(value: unknown): number | null {
  const parsed = asNumber(value);
  if (parsed === null || parsed < 0) return null;
  return Math.round(parsed * 10000) / 10000;
}

function normalizeBoolean(value: unknown): boolean | null {
  return asBoolean(value);
}

function normalizeDateOnly(value: unknown): string | null {
  const text = asText(value);
  if (!text) return null;

  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  if (!match) return null;

  const parsed = new Date(`${match[1]}-${match[2]}-${match[3]}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return null;
  return `${match[1]}-${match[2]}-${match[3]}`;
}

function normalizeCaptureRequestId(value: unknown): string | null {
  const normalized = asText(value);
  if (!normalized) return null;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(normalized)) {
    throw new Error('CAPTURE_REQUEST_ID_INVALID');
  }
  return normalized;
}

function normalizeTimeText(value: unknown): string | null {
  const text = asText(value);
  if (!text) return null;
  const match = /^(?:[01]?\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/.exec(text);
  return match ? text : null;
}

function normalizeFuelSlipTargetType(value: unknown): FuelSlipTargetType {
  const normalized = asText(value).toLowerCase();
  return normalized === 'storage_tank' || normalized === 'storage' || normalized === 'tank' ? 'storage_tank' : 'asset';
}

function normalizeFuelSlipExtractionStatus(value: unknown): FuelSlipExtractionStatus {
  const normalized = asText(value).toLowerCase();
  if (normalized === 'manual' || normalized === 'extracted' || normalized === 'needs_review') return normalized;
  return 'manual';
}

function fuelSlipReviewStatusLabel(status: unknown, reviewRequired: unknown): string {
  const normalizedStatus = normalizeFuelSlipExtractionStatus(status);

  if (Boolean(reviewRequired) || normalizedStatus === 'needs_review') return 'Not completed';
  if (normalizedStatus === 'extracted') return 'Extracted';
  return 'Manual';
}

function isGenericFuelSlipCompletionWarning(value: unknown): boolean {
  const normalized = asText(value).replace(/\s+/g, ' ').trim().toLowerCase();

  if (!normalized) return false;
  if (normalized.startsWith('fuel slip saved as not completed')) return true;
  if (normalized.startsWith('fuel slip saved for review')) return true;
  if (normalized === 'complete the missing fuel slip fields before posting fuel usage.') return true;
  if (normalized.includes('before it can post to the fuel ledger')) return true;
  if (normalized.includes('enter the required odometer or hour-meter reading before posting fuel usage')) return true;

  return false;
}

function normalizeFuelSlipWarningList(values: unknown[]): string[] {
  return values
    .map((entry) => maskStoredFuelSlipRawText(asText(entry)))
    .filter((warning) => warning && !isGenericFuelSlipCompletionWarning(warning))
    .slice(0, 12);
}

function safeCardMask(last4: string): string {
  return /^\d{4}$/.test(last4) ? `************${last4}` : '';
}

function extractLast4FromCardLikeValue(value: unknown): string {
  const text = asText(value).slice(0, 160);
  if (!text) return '';

  const masked = /(?:\b\d{4,6}[\s-]*)?(?:[*xX]{2,}[\s-]*){1,4}(\d{4})\b/.exec(text);
  if (masked) return masked[1];

  const firstMasked = /\b\d{4,6}[\s-]*(?:[*xX]{2,}[\s-]*){1,3}(\d{4})\b/.exec(text);
  if (firstMasked) return firstMasked[1];

  const digits = text.replace(/\D/g, '');
  if (digits.length >= 13 && digits.length <= 19) return digits.slice(-4);
  if (/^\d{4}$/.test(digits)) return digits;

  return '';
}

function normalizeMaskedCard(value: unknown, fallbackLast4: unknown): { masked: string; last4: string } {
  const fallbackDigits = asText(fallbackLast4).replace(/\D/g, '').slice(-4);
  const last4 = extractLast4FromCardLikeValue(value) || (/^\d{4}$/.test(fallbackDigits) ? fallbackDigits : '');
  return { masked: safeCardMask(last4), last4 };
}

function formatCardEnding(value: unknown, fallbackLast4?: unknown): string {
  const card = normalizeMaskedCard(value, fallbackLast4);
  return card.last4 ? `Card ending ${card.last4}` : '';
}

function maskCardLikeMatch(value: string): string {
  const last4 = extractLast4FromCardLikeValue(value);
  return last4 ? safeCardMask(last4) : value;
}

function trimText(value: unknown, maxLength: number): string {
  return asText(value).slice(0, maxLength);
}

function maskStoredFuelSlipRawText(value: string): string {
  return String(value ?? '')
    .replace(/\b\d{4,6}[\s-]*(?:[*xX]{2,}[\s-]*){1,3}\d{4}\b/g, (match) => maskCardLikeMatch(match))
    .replace(/\b(?:[*xX]{2,}[\s-]*){1,4}\d{4}\b/g, (match) => maskCardLikeMatch(match))
    .replace(/\b(?:\d[\s-]?){13,19}\b/g, (match) => maskCardLikeMatch(match));
}

function sanitizeFuelSlipTextField(value: unknown, maxLength: number): string {
  return maskStoredFuelSlipRawText(trimText(value, maxLength));
}

function toDateOnly(value: unknown): string {
  if (!value) return '';
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).slice(0, 10);
}


function normalizeCoordinate(value: unknown, maxAbsolute: number): number | null {
  if (value === null || typeof value === 'undefined' || value === '') {
    return null;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed) || Math.abs(parsed) > maxAbsolute) {
    return null;
  }

  return parsed;
}

function normalizeClientEventId(value: unknown): string | null {
  const normalized = asText(value)
    .replace(/[^a-zA-Z0-9:._-]/g, '')
    .slice(0, 140);
  return normalized || null;
}

function normalizeClientCapturedAt(value: unknown): string | null {
  const text = asText(value);
  if (!text) return null;
  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString();
}

function normalizeGpsAccuracyMeters(value: unknown): number | null {
  if (value === null || typeof value === 'undefined' || value === '') return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 50000) return null;
  return Math.round(parsed * 100) / 100;
}

function normalizeFuelType(value: unknown): string {
  const normalized = String(value ?? '').trim().toLowerCase();

  if (['diesel', 'petrol', 'gasoline', 'paraffin', 'adblue'].includes(normalized)) {
    return normalized === 'gasoline' ? 'petrol' : normalized;
  }

  return normalized || 'diesel';
}

function normalizeStorageStatus(value: unknown): FuelStorageStatus {
  return String(value ?? '').trim().toLowerCase() === 'archived' ? 'archived' : 'active';
}

function normalizeEventType(value: unknown): FuelStorageEventType {
  const normalized = String(value ?? '').trim().toLowerCase();

  if (normalized === 'opening_balance') return 'opening_balance';
  if (normalized === 'stock_in') return 'stock_in';
  if (normalized === 'asset_issue') return 'asset_issue';
  if (normalized === 'dip') return 'dip';
  if (normalized === 'adjustment') return 'adjustment';

  return 'adjustment';
}

function normalizeBalanceVerificationStatus(value: unknown): FuelBalanceVerificationStatus {
  return String(value ?? '').trim().toLowerCase() === 'needs_check' ? 'needs_check' : 'verified';
}

function normalizeFuelUsageMetric(value: unknown): FuelUsageMetric {
  const normalized = String(value ?? '').trim().toLowerCase();
  if (normalized === 'hours' || normalized === 'km' || normalized === 'percentage' || normalized === 'none') return normalized;
  throw new Error('Choose a valid historical usage metric.');
}

function normalizeFuelTankBalanceTreatment(value: unknown): FuelTankBalanceTreatment {
  const normalized = String(value ?? '').trim().toLowerCase();
  if (normalized === 'already_reflected' || normalized === 'not_yet_reflected' || normalized === 'not_sure') return normalized;
  throw new Error('Choose how the current tank balance should be handled.');
}

function normalizeFuelEvidenceStatus(value: unknown): FuelEvidenceStatus | '' {
  const normalized = String(value ?? '').trim().toLowerCase();
  if (normalized === 'internal_record_only' || normalized === 'evidence_supplied_review_required') return normalized;
  return '';
}

function johannesburgDateParts(value = new Date()): { date: string; time: string } {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Johannesburg',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(value);
  const read = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? '';
  return {
    date: `${read('year')}-${read('month')}-${read('day')}`,
    time: `${read('hour')}:${read('minute')}:${read('second')}`,
  };
}

function normalizeHistoricalIssueDate(value: unknown): string {
  const date = asText(value);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new Error('Choose a valid fuel issue date.');
  }

  const [year, month, day] = date.split('-').map((part) => Number(part));
  const parsed = new Date(Date.UTC(year, month - 1, day));
  if (
    !Number.isInteger(year)
    || !Number.isInteger(month)
    || !Number.isInteger(day)
    || parsed.getUTCFullYear() !== year
    || parsed.getUTCMonth() !== month - 1
    || parsed.getUTCDate() !== day
  ) {
    throw new Error('Choose a valid fuel issue date.');
  }

  if (date > johannesburgDateParts().date) {
    throw new Error('Fuel issue date cannot be in the future.');
  }

  return date;
}

function normalizeHistoricalIssueTime(value: unknown, recordedValue: unknown): { time: string | null; recorded: boolean } {
  const explicitlyNotRecorded = recordedValue === false || String(recordedValue ?? '').trim().toLowerCase() === 'false';
  const text = asText(value);

  if (explicitlyNotRecorded || !text) {
    return { time: null, recorded: false };
  }

  if (!/^([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/.test(text)) {
    throw new Error('Enter a valid fuel issue time or choose Time not recorded.');
  }

  return { time: text.length === 5 ? `${text}:00` : text, recorded: true };
}

function buildJohannesburgIssueIso(date: string, time: string | null): string {
  const parsed = new Date(`${date}T${time ?? '00:00:00'}+02:00`);
  if (Number.isNaN(parsed.getTime())) throw new Error('Choose a valid fuel issue date and time.');
  return parsed.toISOString();
}

function normalizeFuelStorageCode(value: unknown): string {
  return String(value ?? '')
    .trim()
    .replace(/\s+/g, '')
    .toUpperCase();
}

function generateFuelStorageCode(): string {
  return `FUEL-${randomBytes(5).toString('hex').toUpperCase()}`;
}

function getFuelScanCookieSecret(): string {
  return process.env.FUEL_SCAN_COOKIE_SECRET || process.env.SCAN_COOKIE_SECRET || process.env.BETTER_AUTH_SECRET || 'aim4price-development-fuel-scan-secret';
}

function toBase64Url(value: string | Buffer): string {
  return Buffer.from(value)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function fromBase64Url(value: string): Buffer {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized + '='.repeat((4 - (normalized.length % 4 || 4)) % 4);
  return Buffer.from(padded, 'base64');
}

function signPayload(payloadBase64Url: string): string {
  return toBase64Url(createHmac('sha256', getFuelScanCookieSecret()).update(payloadBase64Url).digest());
}

function buildFuelScanSessionToken(claims: FuelStorageSessionClaims): string {
  const payloadBase64Url = toBase64Url(JSON.stringify(claims));
  return `${payloadBase64Url}.${signPayload(payloadBase64Url)}`;
}

function readFuelScanSessionToken(token: string): FuelStorageSessionClaims | null {
  const [payloadSegment, signatureSegment] = String(token ?? '').split('.');

  if (!payloadSegment || !signatureSegment) {
    return null;
  }

  const expectedSignature = signPayload(payloadSegment);
  const received = Buffer.from(signatureSegment);
  const expected = Buffer.from(expectedSignature);

  if (received.length !== expected.length || !timingSafeEqual(received, expected)) {
    return null;
  }

  try {
    const parsed = JSON.parse(fromBase64Url(payloadSegment).toString('utf8')) as Partial<FuelStorageSessionClaims>;
    const ownerUserId = asText(parsed.ownerUserId);
    const storageId = asText(parsed.storageId);
    const publicFuelStorageCode = normalizeFuelStorageCode(parsed.publicFuelStorageCode);
    const pinUpdatedAtMs = Number(parsed.pinUpdatedAtMs);
    const issuedAtMs = Number(parsed.issuedAtMs);
    const expiresAtMs = Number(parsed.expiresAtMs);

    if (!ownerUserId || !storageId || !publicFuelStorageCode || !Number.isFinite(pinUpdatedAtMs) || !Number.isFinite(issuedAtMs) || !Number.isFinite(expiresAtMs)) {
      return null;
    }

    return {
      ownerUserId,
      storageId,
      publicFuelStorageCode,
      pinUpdatedAtMs,
      issuedAtMs,
      expiresAtMs,
    };
  } catch {
    return null;
  }
}

function parsePinUpdatedAtMs(value: string | null): number | null {
  if (!value) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function getFuelScanSessionFromRequest(request: NextRequest, expectedPublicFuelStorageCode?: string): FuelStorageSessionClaims | null {
  const rawCookie = request.cookies.get(FUEL_SCAN_COOKIE_NAME)?.value;
  const claims = rawCookie ? readFuelScanSessionToken(rawCookie) : null;

  if (!claims) {
    return null;
  }

  if (expectedPublicFuelStorageCode) {
    const expectedCode = normalizeFuelStorageCode(expectedPublicFuelStorageCode);
    if (!expectedCode || claims.publicFuelStorageCode !== expectedCode) {
      return null;
    }
  }

  if (claims.expiresAtMs <= Date.now()) {
    return null;
  }

  return claims;
}

export function applyFuelStorageSessionCookie(response: NextResponse, claims: { ownerUserId: string; storageId: string; publicFuelStorageCode: string; pinUpdatedAtIso: string }): void {
  const now = Date.now();

  response.cookies.set({
    name: FUEL_SCAN_COOKIE_NAME,
    value: buildFuelScanSessionToken({
      ownerUserId: claims.ownerUserId,
      storageId: claims.storageId,
      publicFuelStorageCode: normalizeFuelStorageCode(claims.publicFuelStorageCode),
      pinUpdatedAtMs: parsePinUpdatedAtMs(claims.pinUpdatedAtIso) ?? now,
      issuedAtMs: now,
      expiresAtMs: now + FUEL_SCAN_SESSION_MAX_AGE_SECONDS * 1000,
    }),
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: FUEL_SCAN_SESSION_MAX_AGE_SECONDS,
  });
}

function storageStockPercent(currentLitres: number, capacityLitres: number | null): number | null {
  if (capacityLitres === null || capacityLitres <= 0) return null;
  return Math.max(0, Math.min(100, Math.round((currentLitres / capacityLitres) * 100)));
}

function mapStorageRow(row: FuelStorageRow): FuelLedgerStorage {
  const capacityLitres = normalizeOptionalLitres(row.capacity_litres);
  const currentLitres = normalizeOptionalLitres(row.current_litres) ?? 0;
  const pinHash = asText(row.pin_hash);

  return {
    id: asText(row.id),
    userId: asText(row.user_id),
    name: asText(row.name) || 'Fuel storage',
    fuelType: normalizeFuelType(row.fuel_type),
    capacityLitres,
    currentLitres,
    stockPercent: storageStockPercent(currentLitres, capacityLitres),
    reorderLevelLitres: normalizeOptionalLitres(row.reorder_level_litres),
    locationLabel: asText(row.location_label),
    notes: asText(row.notes),
    dipstickNote: asText(row.dipstick_note),
    dipstickNoteUpdatedAtIso: row.dipstick_note_updated_at ?? null,
    balanceVerificationStatus: normalizeBalanceVerificationStatus(row.balance_verification_status),
    balanceNeedsChecking: normalizeBalanceVerificationStatus(row.balance_verification_status) === 'needs_check',
    balanceCheckReason: asText(row.balance_check_reason),
    balanceCheckSourceEventId: asText(row.balance_check_source_event_id),
    balanceCheckMarkedAtIso: row.balance_check_marked_at ?? null,
    status: normalizeStorageStatus(row.status),
    publicFuelStorageCode: normalizeFuelStorageCode(row.public_fuel_storage_code),
    pinEnabled: Boolean(row.pin_enabled) && Boolean(pinHash),
    hasPin: Boolean(pinHash),
    pinUpdatedAtIso: row.pin_updated_at ?? null,
    createdAtIso: row.created_at ?? '',
    updatedAtIso: row.updated_at ?? row.created_at ?? '',
  };
}

function fuelSlipDocumentDateIso(documentDate: string, documentTime: string, fallbackIso: string): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(documentDate)) {
    const rawTime = /^(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/.test(documentTime) ? documentTime : '00:00:00';
    const time = rawTime.length === 5 ? `${rawTime}:00` : rawTime;
    const parsed = new Date(`${documentDate}T${time}+02:00`);

    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toISOString();
    }
  }

  return fallbackIso;
}

function mapFuelEventRow(row: FuelEventRow): FuelLedgerEvent {
  const sourceType = asText(row.source_type);
  const isFuelSlip = sourceType === 'fuel_slip';
  const extractionStatus = isFuelSlip ? asText(row.fs_extraction_status) : '';
  const reviewRequired = isFuelSlip ? Boolean(row.fs_review_required) : false;
  const card = normalizeMaskedCard(isFuelSlip ? row.fs_card_number_masked ?? row.card_number_masked : row.card_number_masked, isFuelSlip ? row.fs_card_last4 : null);
  const fuelSlipDocumentDate = isFuelSlip ? toDateOnly(row.fs_document_date) ?? '' : '';
  const fuelSlipDocumentTime = isFuelSlip ? asText(row.fs_document_time) : '';
  const recordedAtIso = row.issue_at ?? row.created_at ?? '';
  const reportDateIso = isFuelSlip
    ? fuelSlipDocumentDateIso(fuelSlipDocumentDate, fuelSlipDocumentTime, recordedAtIso)
    : recordedAtIso;

  return {
    id: asText(row.id),
    storageId: asText(row.storage_id),
    storageName: asText(row.storage_name) || 'Fuel storage',
    storagePublicCode: normalizeFuelStorageCode(row.storage_public_code),
    eventType: normalizeEventType(row.event_type),
    sourceType,
    sourceLabel: isFuelSlip ? 'Fuel Slip' : asText(row.source_label),
    fuelSlipId: asText(row.fuel_slip_id),
    fuelSlipTargetType: asText(row.fs_target_type),
    fuelSlipSupplierName: maskStoredFuelSlipRawText(asText(row.fs_supplier_name)),
    fuelSlipFuelType: maskStoredFuelSlipRawText(asText(row.fs_fuel_type)),
    fuelSlipDocumentDate,
    fuelSlipDocumentTime,
    fuelSlipExtractionStatus: extractionStatus,
    fuelSlipReviewRequired: reviewRequired,
    fuelSlipReviewStatus: isFuelSlip ? fuelSlipReviewStatusLabel(extractionStatus, reviewRequired) : '',
    totalAmount: normalizeMoneyValue(row.total_amount),
    documentFileUrl: isFuelSlip ? asText(row.fs_document_file_url) || asText(row.document_file_url) : asText(row.document_file_url),
    paymentMethod: maskStoredFuelSlipRawText(isFuelSlip ? asText(row.fs_payment_method) || asText(row.payment_method) : asText(row.payment_method)),
    cardNumberMasked: card.masked,
    assetId: asText(row.asset_register_item_id),
    assetTitle: asText(row.asset_title),
    assetPlateLabel: asText(row.asset_plate_label),
    litres: normalizeOptionalLitres(row.litres) ?? 0,
    storageLevelBefore: normalizeOptionalLitres(row.storage_level_before_litres),
    storageLevelAfter: normalizeOptionalLitres(row.storage_level_after_litres),
    assetFuelPercentBefore: normalizeFuelPercent(row.asset_fuel_percent_before),
    assetFuelPercentAfter: normalizeFuelPercent(row.asset_fuel_percent_after),
    assetUsageReading: normalizeUsageReading(row.asset_usage_reading),
    operatorName: maskStoredFuelSlipRawText(asText(row.operator_name)),
    activityText: maskStoredFuelSlipRawText(asText(row.activity_text)),
    workAreaText: maskStoredFuelSlipRawText(asText(row.work_area_text)),
    note: maskStoredFuelSlipRawText(asText(row.note)),
    latitude: normalizeCoordinate(row.latitude, 90),
    longitude: normalizeCoordinate(row.longitude, 180),
    locationText: asText(row.location_text),
    isLateEntry: Boolean(row.is_late_entry),
    issueDate: toDateOnly(row.issue_date) || toDateOnly(row.created_at),
    issueTime: asText(row.issue_time),
    issueTimeRecorded: row.issue_time_recorded !== false,
    issueAtIso: row.issue_at ?? row.created_at ?? '',
    entryAddedAtIso: row.entry_added_at ?? row.created_at ?? '',
    addedByUserId: asText(row.added_by_user_id),
    addedByName: asText(row.added_by_name),
    addedByEmail: asText(row.added_by_email),
    assetUsageMetric: ['hours', 'km', 'percentage', 'none'].includes(asText(row.asset_usage_metric))
      ? (asText(row.asset_usage_metric) as FuelUsageMetric)
      : '',
    lateEntryReason: asText(row.late_entry_reason),
    evidenceType: asText(row.evidence_type),
    evidenceReference: asText(row.evidence_reference),
    evidenceStatus: normalizeFuelEvidenceStatus(row.evidence_status),
    evidenceFileName: asText(row.evidence_file_name),
    evidenceFileUrl: asText(row.evidence_id) ? `/api/fuel/missing-entry-evidence/${encodeURIComponent(asText(row.id))}` : '',
    tankBalanceTreatment: ['already_reflected', 'not_yet_reflected', 'not_sure'].includes(asText(row.tank_balance_treatment))
      ? (asText(row.tank_balance_treatment) as FuelTankBalanceTreatment)
      : '',
    linkedAdjustmentEventId: asText(row.linked_adjustment_event_id),
    linkedMissingEntryEventId: asText(row.linked_missing_entry_event_id),
    adjustmentKind: asText(row.adjustment_kind),
    idempotencyKey: asText(row.idempotency_key),
    gpsCaptureStatus: asText(row.gps_capture_status) || (row.latitude === null || row.longitude === null ? 'not_captured' : 'captured'),
    workUseExcluded: Boolean(row.work_use_excluded),
    workUseExclusionReason: asText(row.work_use_exclusion_reason),
    createdAtIso: reportDateIso,
  };
}


function normalizeExtractionWarningsFromDb(value: unknown): string[] {
  if (!Array.isArray(value)) {
    if (typeof value === 'string' && value.trim()) {
      try {
        const parsed = JSON.parse(value) as unknown;
        return normalizeExtractionWarningsFromDb(parsed);
      } catch {
        return normalizeFuelSlipWarningList([value]);
      }
    }

    return [];
  }

  return normalizeFuelSlipWarningList(value);
}

function mapFuelSlipRow(row: FuelSlipRow): FuelSlipTransaction {
  const card = normalizeMaskedCard(row.card_number_masked, row.card_last4);

  return {
    id: asText(row.id),
    userId: asText(row.user_id),
    sourceType: 'fuel_slip',
    sourceLabel: 'Fuel Slip',
    targetType: normalizeFuelSlipTargetType(row.target_type),
    assetId: asText(row.asset_register_item_id),
    assetTitle: asText(row.asset_title),
    storageId: asText(row.storage_id),
    storageName: asText(row.storage_name),
    fuelStorageEventId: asText(row.fuel_storage_event_id),
    assetInvoiceId: asText(row.asset_invoice_id),
    invoiceDocumentId: asText(row.invoice_document_id),
    uploadId: asText(row.upload_id),
    documentFileUrl: asText(row.document_file_url),
    originalFilename: maskStoredFuelSlipRawText(asText(row.original_filename)),
    contentType: asText(row.content_type),
    byteSize: asNumber(row.byte_size),
    supplierName: maskStoredFuelSlipRawText(asText(row.supplier_name)),
    supplierVatNumber: asText(row.supplier_vat_number),
    slipNumber: maskStoredFuelSlipRawText(asText(row.slip_number)),
    transactionNumber: maskStoredFuelSlipRawText(asText(row.transaction_number)),
    documentDate: toDateOnly(row.document_date),
    documentTime: asText(row.document_time),
    fuelType: maskStoredFuelSlipRawText(asText(row.fuel_type)),
    litres: normalizeOptionalLitres(row.litres),
    pricePerLitre: normalizeRateValue(row.price_per_litre),
    totalAmount: normalizeMoneyValue(row.total_amount),
    vatAmount: normalizeMoneyValue(row.vat_amount),
    vatIncluded: normalizeBoolean(row.vat_included),
    vatRate: normalizeRateValue(row.vat_rate),
    paymentMethod: maskStoredFuelSlipRawText(asText(row.payment_method)),
    cardType: maskStoredFuelSlipRawText(asText(row.card_type)),
    cardNumberMasked: card.masked,
    cardLast4: card.last4,
    merchantNumber: maskStoredFuelSlipRawText(asText(row.merchant_number)),
    terminalNumber: maskStoredFuelSlipRawText(asText(row.terminal_number)),
    siteNumber: maskStoredFuelSlipRawText(asText(row.site_number)),
    odometerReading: normalizeUsageReading(row.odometer_reading),
    hourMeterReading: normalizeUsageReading(row.hour_meter_reading),
    usageNotApplicable: Boolean(row.usage_not_applicable),
    operatorName: maskStoredFuelSlipRawText(asText(row.operator_name)),
    operatorNotApplicable: Boolean(row.operator_not_applicable),
    activityText: maskStoredFuelSlipRawText(asText(row.activity_text)),
    activityNotApplicable: Boolean(row.activity_not_applicable),
    workAreaText: maskStoredFuelSlipRawText(asText(row.work_area_text)),
    workAreaNotApplicable: Boolean(row.work_area_not_applicable),
    note: maskStoredFuelSlipRawText(asText(row.note)),
    latitude: normalizeCoordinate(row.scan_latitude, 90),
    longitude: normalizeCoordinate(row.scan_longitude, 180),
    locationText: asText(row.scan_location_text),
    clientCapturedAtIso: row.scan_client_captured_at ?? null,
    gpsAccuracyMeters: asNumber(row.scan_gps_accuracy_meters),
    assetFuelPercentBefore: normalizeFuelPercent(row.asset_fuel_percent_before),
    assetFuelPercentAfter: normalizeFuelPercent(row.asset_fuel_percent_after),
    extractionStatus: normalizeFuelSlipExtractionStatus(row.extraction_status),
    ocrConfidence: normalizeRateValue(row.ocr_confidence),
    reviewRequired: Boolean(row.review_required),
    rawExtractedText: maskStoredFuelSlipRawText(asText(row.raw_extracted_text)),
    extractionWarnings: normalizeExtractionWarningsFromDb(row.extraction_warnings),
    workUseExcluded: Boolean(row.work_use_excluded),
    workUseExclusionReason: asText(row.work_use_exclusion_reason),
    recordStatus: asText(row.record_status) === 'voided' ? 'voided' : 'active',
    voidedAtIso: row.voided_at ?? null,
    voidedByName: asText(row.voided_by_name),
    voidReason: asText(row.void_reason),
    createdAtIso: row.created_at ?? '',
    updatedAtIso: row.updated_at ?? row.created_at ?? '',
  };
}


async function getFuelAccountBusinessName(userId: string): Promise<string> {
  const normalizedUserId = asText(userId);

  if (!normalizedUserId) {
    return 'Aim4price account';
  }

  await ensureAccountProfileColumns();
  const db = getDb();
  const result = await db.query<{ business_name: string | null; display_name: string | null }>(
    `
      select business_name, display_name
      from public.account_profiles
      where user_id = $1
      limit 1
    `,
    [normalizedUserId],
  );

  const row = result.rows[0];
  return asText(row?.business_name) || asText(row?.display_name) || 'Aim4price account';
}

function titleCase(value: string): string {
  return value
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ');
}

function inferAssetCanReceiveFuel(row: FuelAssetRow): boolean {
  const kind = asText(row.kind).toLowerCase();
  const specs = asRecord(row.specs_json);
  const specValue = asBoolean(specs.is_propelled ?? specs.isPropelled ?? specs.self_propelled ?? specs.selfPropelled ?? specs.accepts_fuel ?? specs.acceptsFuel);
  const familyValue = asBoolean(row.family_is_propelled);

  if (kind === 'tractor' || kind === 'vehicle') return true;
  if (specValue !== null) return specValue;
  if (familyValue !== null) return familyValue;

  return false;
}

const PERCENT_USAGE_SPEC_KEYS = [
  'lifeWorkedPercent',
  'life_worked_percent',
  'workedPercent',
  'worked_percent',
  'percentWorked',
  'percent_worked',
  'lifetimeWorkedPercent',
  'lifetime_worked_percent',
  'lifetimeUsedPercent',
  'lifetime_used_percent',
];

function numberFromSpecs(specs: Record<string, unknown>, keys: string[]): number | null {
  for (const key of keys) {
    const parsed = asNumber(specs[key]);
    if (parsed !== null) return parsed;
  }

  return null;
}

function lifeWorkedPercentFromAssetRow(row: FuelAssetRow): number | null {
  const specs = asRecord(row.specs_json);
  const fromRow = asNumber(row.life_worked_percent);
  if (fromRow !== null) return Math.max(0, Math.min(100, fromRow));

  const fromSpecs = numberFromSpecs(specs, PERCENT_USAGE_SPEC_KEYS);
  return fromSpecs === null ? null : Math.max(0, Math.min(100, fromSpecs));
}

function metricTextFromSpecs(specs: Record<string, unknown>): string {
  return asText(
    specs.usageMetric ??
      specs.usage_metric ??
      specs.usageUnit ??
      specs.usage_unit ??
      specs.usageMetricType ??
      specs.usage_metric_type ??
      specs.usageBasis ??
      specs.usage_basis ??
      specs.usageMode ??
      specs.usage_mode ??
      specs.meterType ??
      specs.meter_type ??
      specs.depreciationMetric ??
      specs.depreciation_metric,
  ).toLowerCase();
}

function metricTextIsPercentage(value: string): boolean {
  return [
    'percentage',
    'percent',
    '%',
    'percent_used',
    'percentage_used',
    'life_percentage',
    'life_percent',
    'life_worked_percent',
    'lifetime_percent',
    'percent_worked',
    'worked_percent',
    'wear_class',
    'semi_depreciation',
    'percentage_depreciation',
  ].includes(value);
}

function metricTextIsReading(value: string): boolean {
  return [
    'reading',
    'meter',
    'hours',
    'hour',
    'hrs',
    'engine_hours',
    'hour_meter',
    'km',
    'kms',
    'kilometres',
    'kilometers',
    'odometer',
    'both',
    'km_hours',
    'hours_km',
  ].includes(value);
}

function inferAssetUsageMetric(row: FuelAssetRow): FuelLedgerAsset['usageMetric'] {
  const kind = asText(row.kind).toLowerCase();
  const specs = asRecord(row.specs_json);
  const rawMetric = metricTextFromSpecs(specs);
  const lifeWorkedPercent = lifeWorkedPercentFromAssetRow(row);
  const savedReading = normalizeUsageReading(row.hours);
  const hasPositiveReading = savedReading !== null && savedReading > 0;
  const depreciationMethod = asText(
    specs.depreciationMethodUsed ??
      specs.depreciation_method_used ??
      specs.selectedDepreciationMethod ??
      specs.selected_depreciation_method,
  ).toLowerCase();
  const explicitUsageBasisValues = [
    specs.usageMode,
    specs.usage_mode,
    specs.usageBasis,
    specs.usage_basis,
    specs.selectedUsageMode,
    specs.selected_usage_mode,
    specs.selectedUsageBasis,
    specs.selected_usage_basis,
  ].map((value) => asText(value).toLowerCase()).filter(Boolean);
  const fallbackPercentageBasisValues = [
    specs.usageMetricType,
    specs.usage_metric_type,
    specs.valuationMode,
    specs.valuation_mode,
    specs.depreciationMethodUsed,
    specs.depreciation_method_used,
    specs.selectedDepreciationMethod,
    specs.selected_depreciation_method,
  ];
  const hasExplicitReadingBasis = explicitUsageBasisValues.some(metricTextIsReading);
  const hasExplicitPercentageBasis = explicitUsageBasisValues.some(metricTextIsPercentage);
  const resolvedUsage = resolveAssetUsage({
    kind,
    hours: savedReading,
    lifeWorkedPercent,
    specsJson: specs,
  });

  if (resolvedUsage.metric === 'not_applicable') return 'none';
  if (resolvedUsage.metric === 'percentage') return 'percentage';

  if (
    kind !== 'vehicle' &&
    !hasExplicitReadingBasis &&
    (
      hasExplicitPercentageBasis ||
      fallbackPercentageBasisValues.some((value) => metricTextIsPercentage(asText(value).toLowerCase())) ||
      depreciationMethod === 'percentage_depreciation' ||
      (lifeWorkedPercent !== null && (!hasPositiveReading || depreciationMethod === 'semi_depreciation'))
    )
  ) {
    return 'percentage';
  }

  if (!hasExplicitReadingBasis && metricTextIsPercentage(rawMetric)) return 'percentage';
  if (rawMetric === 'both' || rawMetric === 'km_hours' || rawMetric === 'hours_km') return 'both';
  if (['km', 'kms', 'kilometres', 'kilometers', 'odometer'].includes(rawMetric)) return 'km';
  if (['hours', 'hour', 'hrs', 'engine_hours', 'hour_meter'].includes(rawMetric)) return 'hours';

  for (const explicitValue of explicitUsageBasisValues) {
    if (explicitValue === 'both' || explicitValue === 'km_hours' || explicitValue === 'hours_km') return 'both';
    if (['km', 'kms', 'kilometres', 'kilometers', 'odometer'].includes(explicitValue)) return 'km';
    if (['hours', 'hour', 'hrs', 'engine_hours', 'hour_meter'].includes(explicitValue)) return 'hours';
  }

  if (kind === 'vehicle' || /\b(?:vehicle|truck|bus|trailer|motorcycle|bakkie|sedan|suv|car)\b/i.test(asText(row.equipment_family_label))) {
    return 'km';
  }

  if (!hasExplicitReadingBasis && lifeWorkedPercent !== null && !hasPositiveReading) return 'percentage';
  if (inferAssetCanReceiveFuel(row)) return 'hours';
  return 'none';
}

function mapFuelAssetRow(row: FuelAssetRow): FuelLedgerAsset {
  const familyLabel = asText(row.equipment_family_label);
  const kind = asText(row.kind).toLowerCase();
  const specs = asRecord(row.specs_json);

  return {
    id: String(row.id ?? '').trim(),
    title: asText(row.title) || 'Untitled asset',
    kind,
    assetTypeLabel: familyLabel || titleCase(kind || 'asset'),
    brandName: asText(row.brand_name),
    modelName: asText(row.model_name) || asText(row.typed_model_name),
    serialNumber: asText(row.serial_number),
    plateLabel: asText(row.plate_label),
    publicAssetCode: asText(row.public_asset_code),
    hours: normalizeUsageReading(row.hours),
    lifeWorkedPercent: lifeWorkedPercentFromAssetRow(row),
    fuelPercent: normalizeFuelPercent(row.fuel_percent),
    yearModel: normalizeUsageReading(row.year_model ?? specs.yearModel ?? specs.year_model),
    condition: asText(row.condition ?? specs.condition),
    selectedMethod: asText(row.selected_method ?? specs.selectedMethod ?? specs.selected_method),
    currentValue: normalizeMoneyValue(row.current_value ?? specs.currentValue ?? specs.current_value ?? specs.valuationValue ?? specs.valuation_value),
    canReceiveFuel: inferAssetCanReceiveFuel(row),
    isActive: (asText(row.qr_status) || 'active').toLowerCase() === 'active',
    usageMetric: inferAssetUsageMetric(row),
    workUseExcluded: Boolean(row.work_use_excluded),
    workUseExclusionReason: asText(row.work_use_exclusion_reason),
  };
}

function normalizeFuelWorkUseReason(value: unknown, excluded: boolean): string {
  const reason = asText(value).replace(/\s+/g, ' ').slice(0, 500);
  return excluded ? reason || 'Not used for work purposes' : '';
}

function normalizeFuelAuditActor(actor: FuelLedgerAuditActor | undefined): { userId: string; name: string; email: string } {
  return {
    userId: asText(actor?.userId),
    name: asText(actor?.name) || 'Account user',
    email: asText(actor?.email),
  };
}

async function insertFuelLedgerAuditEvent(
  client: Pick<PoolClient, 'query'>,
  input: {
    userId: string;
    recordType: string;
    recordId: string;
    action: string;
    actor?: FuelLedgerAuditActor;
    reason?: unknown;
    beforeSnapshot?: unknown;
    afterSnapshot?: unknown;
  },
): Promise<void> {
  const actor = normalizeFuelAuditActor(input.actor);
  await client.query(
    `
      insert into public.fuel_ledger_audit_events (
        user_id, record_type, record_id, action,
        actor_user_id, actor_name, actor_email, reason,
        before_snapshot, after_snapshot
      ) values ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10::jsonb)
    `,
    [
      input.userId,
      input.recordType,
      input.recordId,
      input.action,
      actor.userId || null,
      actor.name,
      actor.email || null,
      asText(input.reason).slice(0, 500) || null,
      typeof input.beforeSnapshot === 'undefined' ? null : JSON.stringify(input.beforeSnapshot),
      typeof input.afterSnapshot === 'undefined' ? null : JSON.stringify(input.afterSnapshot),
    ],
  );
}

async function getFuelAssetWorkUseExclusion(
  client: Pick<PoolClient, 'query'>,
  userId: string,
  assetId: string,
): Promise<{ excluded: boolean; reason: string }> {
  const result = await client.query<{ is_excluded: boolean | null; reason: string | null }>(
    `
      select is_excluded, reason
      from public.fuel_asset_exclusions
      where user_id = $1 and asset_register_item_id::text = $2
      limit 1
    `,
    [userId, assetId],
  );
  return {
    excluded: Boolean(result.rows[0]?.is_excluded),
    reason: asText(result.rows[0]?.reason),
  };
}

function assertFuelAssetAvailableForEntry(
  asset: FuelLedgerAsset,
  workUse: { excluded: boolean; reason: string },
): void {
  if (!asset.isActive) throw new Error('This asset is no longer active. Choose another included asset.');
  if (!asset.canReceiveFuel) throw new Error('This asset is not eligible to receive fuel.');
  if (workUse.excluded) {
    throw new Error(`${asset.title} is excluded from fuel entry. Include it again under Fuel Ledger exclusions before recording fuel.`);
  }
}

export async function setFuelAssetWorkUseExclusion(
  userId: string,
  assetId: string,
  input: { excluded?: unknown; reason?: unknown; actor?: FuelLedgerAuditActor },
): Promise<FuelLedgerAsset> {
  await ensureFuelLedgerTables();
  const client = await getDb().connect();
  const excluded = input.excluded === true || asText(input.excluded).toLowerCase() === 'true';
  const reason = normalizeFuelWorkUseReason(input.reason, excluded);
  let committed = false;

  try {
    await client.query('BEGIN');
    const assetResult = await client.query<{ id: string; title: string | null }>(
      `
        select id::text, title
        from public.asset_register_items a
        where a.user_id = $1 and a.id::text = $2
          and coalesce(nullif(lower(to_jsonb(a)->>'qr_status'), ''), 'active') <> 'deleted'
        for update
      `,
      [userId, assetId],
    );
    const assetRow = assetResult.rows[0];
    if (!assetRow) throw new Error('Asset not found.');

    const before = await getFuelAssetWorkUseExclusion(client, userId, assetId);
    await client.query(
      `
        insert into public.fuel_asset_exclusions (
          user_id, asset_register_item_id, is_excluded, reason,
          updated_by_user_id, updated_by_name, updated_by_email, updated_at
        ) values ($1, $2::uuid, $3, $4, $5, $6, $7, now())
        on conflict (user_id, asset_register_item_id) do update set
          is_excluded = excluded.is_excluded,
          reason = excluded.reason,
          updated_by_user_id = excluded.updated_by_user_id,
          updated_by_name = excluded.updated_by_name,
          updated_by_email = excluded.updated_by_email,
          updated_at = now()
      `,
      [
        userId,
        assetId,
        excluded,
        reason || null,
        normalizeFuelAuditActor(input.actor).userId || null,
        normalizeFuelAuditActor(input.actor).name,
        normalizeFuelAuditActor(input.actor).email || null,
      ],
    );

    const eventUpdate = await client.query(
      `
        update public.fuel_storage_events
        set work_use_excluded = $3, work_use_exclusion_reason = $4
        where user_id = $1 and asset_register_item_id = $2
      `,
      [userId, assetId, excluded, reason || null],
    );
    const slipUpdate = await client.query(
      `
        update public.fuel_slips
        set work_use_excluded = $3, work_use_exclusion_reason = $4, updated_at = now()
        where user_id = $1 and asset_register_item_id::text = $2
      `,
      [userId, assetId, excluded, reason || null],
    );

    await insertFuelLedgerAuditEvent(client, {
      userId,
      recordType: 'asset_exclusion',
      recordId: assetId,
      action: 'exclusion_changed',
      actor: input.actor,
      reason,
      beforeSnapshot: { assetTitle: asText(assetRow.title), ...before },
      afterSnapshot: {
        assetTitle: asText(assetRow.title),
        excluded,
        reason,
        affectedFuelEvents: eventUpdate.rowCount ?? 0,
        affectedFuelSlips: slipUpdate.rowCount ?? 0,
      },
    });

    await client.query('COMMIT');
    committed = true;
  } catch (error) {
    if (!committed) await client.query('ROLLBACK').catch(() => null);
    throw error;
  } finally {
    client.release();
  }

  const asset = (await listFuelAssetsForUser(userId)).find((item) => item.id === assetId);
  if (!asset) throw new Error('Asset could not be loaded after updating the exclusion.');
  return asset;
}

export async function listFuelLedgerAuditEvents(
  userId: string,
  input: { recordType?: unknown; recordId?: unknown; limit?: number } = {},
): Promise<FuelLedgerAuditEvent[]> {
  await ensureFuelLedgerTables();
  const params: unknown[] = [userId];
  let filter = 'user_id = $1';
  const recordType = asText(input.recordType);
  const recordId = asText(input.recordId);
  if (recordType) {
    params.push(recordType);
    filter += ` and record_type = $${params.length}`;
  }
  if (recordId) {
    params.push(recordId);
    filter += ` and record_id = $${params.length}`;
  }
  const limit = Math.max(1, Math.min(100, Math.round(input.limit ?? 30)));
  const result = await getDb().query<{
    id: string; record_type: string; record_id: string; action: string;
    actor_name: string | null; actor_email: string | null; reason: string | null;
    before_snapshot: unknown; after_snapshot: unknown; created_at: string | null;
  }>(
    `
      select id::text, record_type, record_id, action, actor_name, actor_email, reason,
             before_snapshot, after_snapshot, created_at
      from public.fuel_ledger_audit_events
      where ${filter}
      order by created_at desc, id desc
      limit ${limit}
    `,
    params,
  );
  return result.rows.map((row) => ({
    id: asText(row.id),
    recordType: asText(row.record_type),
    recordId: asText(row.record_id),
    action: asText(row.action),
    actorName: asText(row.actor_name),
    actorEmail: asText(row.actor_email),
    reason: asText(row.reason),
    beforeSnapshot: row.before_snapshot ? asRecord(row.before_snapshot) : null,
    afterSnapshot: row.after_snapshot ? asRecord(row.after_snapshot) : null,
    createdAtIso: row.created_at ?? '',
  }));
}

function fuelStorageSelectSql(): string {
  return `
    id::text as id,
    user_id,
    name,
    fuel_type,
    capacity_litres,
    current_litres,
    reorder_level_litres,
    location_label,
    notes,
    dipstick_note,
    dipstick_note_updated_at,
    balance_verification_status,
    balance_check_reason,
    balance_check_source_event_id::text as balance_check_source_event_id,
    balance_check_marked_at,
    status,
    public_fuel_storage_code,
    pin_hash,
    pin_enabled,
    pin_updated_at,
    created_at,
    updated_at
  `;
}

function fuelEventSelectSql(): string {
  return `
    e.id::text as id,
    e.storage_id::text as storage_id,
    coalesce(s.name, '') as storage_name,
    coalesce(s.public_fuel_storage_code, '') as storage_public_code,
    e.event_type,
    e.source_type,
    e.source_label,
    e.fuel_slip_id::text as fuel_slip_id,
    (select slip.target_type from public.fuel_slips slip where slip.id = e.fuel_slip_id limit 1) as fs_target_type,
    (select slip.supplier_name from public.fuel_slips slip where slip.id = e.fuel_slip_id limit 1) as fs_supplier_name,
    (select slip.fuel_type from public.fuel_slips slip where slip.id = e.fuel_slip_id limit 1) as fs_fuel_type,
    (select slip.document_date from public.fuel_slips slip where slip.id = e.fuel_slip_id limit 1) as fs_document_date,
    (select slip.document_time from public.fuel_slips slip where slip.id = e.fuel_slip_id limit 1) as fs_document_time,
    (select slip.document_file_url from public.fuel_slips slip where slip.id = e.fuel_slip_id limit 1) as fs_document_file_url,
    (select slip.payment_method from public.fuel_slips slip where slip.id = e.fuel_slip_id limit 1) as fs_payment_method,
    (select slip.card_number_masked from public.fuel_slips slip where slip.id = e.fuel_slip_id limit 1) as fs_card_number_masked,
    (select slip.card_last4 from public.fuel_slips slip where slip.id = e.fuel_slip_id limit 1) as fs_card_last4,
    (select slip.extraction_status from public.fuel_slips slip where slip.id = e.fuel_slip_id limit 1) as fs_extraction_status,
    (select slip.review_required from public.fuel_slips slip where slip.id = e.fuel_slip_id limit 1) as fs_review_required,
    e.total_amount,
    e.document_file_url,
    e.payment_method,
    e.card_number_masked,
    e.asset_register_item_id,
    coalesce(a.title, '') as asset_title,
    coalesce(to_jsonb(a)->>'plate_label', '') as asset_plate_label,
    e.litres,
    e.storage_level_before_litres,
    e.storage_level_after_litres,
    e.asset_fuel_percent_before,
    e.asset_fuel_percent_after,
    e.asset_usage_reading,
    e.operator_name,
    e.activity_text,
    e.work_area_text,
    e.note,
    e.latitude,
    e.longitude,
    e.location_text,
    e.is_late_entry,
    e.issue_date,
    e.issue_time::text as issue_time,
    e.issue_time_recorded,
    e.issue_at,
    e.entry_added_at,
    e.added_by_user_id,
    e.added_by_name,
    e.added_by_email,
    e.asset_usage_metric,
    e.late_entry_reason,
    e.evidence_type,
    e.evidence_reference,
    e.evidence_status,
    e.evidence_id::text as evidence_id,
    (select evidence.file_name from public.fuel_late_entry_evidence evidence where evidence.id = e.evidence_id limit 1) as evidence_file_name,
    e.tank_balance_treatment,
    e.linked_adjustment_event_id::text as linked_adjustment_event_id,
    e.linked_missing_entry_event_id::text as linked_missing_entry_event_id,
    e.adjustment_kind,
    e.idempotency_key,
    e.gps_capture_status,
    e.work_use_excluded,
    e.work_use_exclusion_reason,
    e.created_at
  `;
}


function fuelSlipSelectSql(): string {
  return `
    fs.id::text as id,
    fs.user_id,
    fs.source_type,
    fs.source_label,
    fs.target_type,
    fs.asset_register_item_id::text as asset_register_item_id,
    coalesce(a.title, '') as asset_title,
    fs.storage_id::text as storage_id,
    coalesce(s.name, '') as storage_name,
    fs.fuel_storage_event_id::text as fuel_storage_event_id,
    fs.asset_invoice_id::text as asset_invoice_id,
    fs.invoice_document_id::text as invoice_document_id,
    fs.upload_id,
    fs.document_file_url,
    fs.original_filename,
    fs.content_type,
    fs.byte_size,
    fs.supplier_name,
    fs.supplier_vat_number,
    fs.slip_number,
    fs.transaction_number,
    fs.document_date,
    fs.document_time,
    fs.fuel_type,
    fs.litres,
    fs.price_per_litre,
    fs.total_amount,
    fs.vat_amount,
    fs.vat_included,
    fs.vat_rate,
    fs.payment_method,
    fs.card_type,
    fs.card_number_masked,
    fs.card_last4,
    fs.merchant_number,
    fs.terminal_number,
    fs.site_number,
    fs.odometer_reading,
    fs.hour_meter_reading,
    fs.usage_not_applicable,
    fs.operator_name,
    fs.operator_not_applicable,
    fs.activity_text,
    fs.activity_not_applicable,
    fs.work_area_text,
    fs.work_area_not_applicable,
    fs.note,
    (
      select se.latitude
      from public.asset_scan_events se
      where se.fuel_slip_id = fs.id
      order by se.created_at desc, se.id desc
      limit 1
    ) as scan_latitude,
    (
      select se.longitude
      from public.asset_scan_events se
      where se.fuel_slip_id = fs.id
      order by se.created_at desc, se.id desc
      limit 1
    ) as scan_longitude,
    (
      select se.location_text
      from public.asset_scan_events se
      where se.fuel_slip_id = fs.id
      order by se.created_at desc, se.id desc
      limit 1
    ) as scan_location_text,
    (
      select se.client_captured_at
      from public.asset_scan_events se
      where se.fuel_slip_id = fs.id
      order by se.created_at desc, se.id desc
      limit 1
    ) as scan_client_captured_at,
    (
      select se.gps_accuracy_meters
      from public.asset_scan_events se
      where se.fuel_slip_id = fs.id
      order by se.created_at desc, se.id desc
      limit 1
    ) as scan_gps_accuracy_meters,
    fs.asset_fuel_percent_before,
    fs.asset_fuel_percent_after,
    fs.extraction_status,
    fs.ocr_confidence,
    fs.review_required,
    fs.raw_extracted_text,
    fs.extraction_warnings,
    fs.work_use_excluded,
    fs.work_use_exclusion_reason,
    fs.record_status,
    fs.voided_at,
    fs.voided_by_name,
    fs.void_reason,
    fs.created_at,
    fs.updated_at
  `;
}

async function ensureFuelLedgerTablesOnce(): Promise<void> {
  const db = getDb();

  await db.query(`
    create extension if not exists pgcrypto;

    alter table if exists public.asset_register_items
      add column if not exists public_asset_code text,
      add column if not exists plate_label text,
      add column if not exists qr_status text not null default 'active',
      add column if not exists last_scanned_at timestamptz,
      add column if not exists last_known_lat double precision,
      add column if not exists last_known_lng double precision,
      add column if not exists last_known_location_text text,
      add column if not exists fuel_percent integer;

    create table if not exists public.asset_scan_events (
      id uuid primary key default gen_random_uuid(),
      asset_id uuid not null,
      actor_type text not null default 'scan_pin',
      operator_name text,
      activity_text text,
      work_area_text text,
      hours numeric(14,2),
      fuel_percent integer,
      condition text,
      note text,
      photo_urls jsonb not null default '[]'::jsonb,
      latitude double precision,
      longitude double precision,
      location_text text,
      maintenance_noted_at timestamptz,
      issue_noted_at timestamptz,
      client_event_id text,
      client_captured_at timestamptz,
      synced_at timestamptz,
      gps_accuracy_meters double precision,
      created_at timestamptz not null default now()
    );

    alter table if exists public.asset_scan_events
      add column if not exists operator_name text,
      add column if not exists activity_text text,
      add column if not exists work_area_text text,
      add column if not exists hours numeric(14,2),
      add column if not exists fuel_percent integer,
      add column if not exists fuel_litres numeric(12,3),
      add column if not exists fuel_storage_id uuid,
      add column if not exists fuel_storage_event_id uuid,
      add column if not exists fuel_slip_id uuid,
      add column if not exists condition text,
      add column if not exists note text,
      add column if not exists photo_urls jsonb not null default '[]'::jsonb,
      add column if not exists latitude double precision,
      add column if not exists longitude double precision,
      add column if not exists location_text text,
      add column if not exists maintenance_noted_at timestamptz,
      add column if not exists issue_noted_at timestamptz,
      add column if not exists client_event_id text,
      add column if not exists client_captured_at timestamptz,
      add column if not exists synced_at timestamptz,
      add column if not exists gps_accuracy_meters double precision,
      add column if not exists field_manager_id uuid,
      add column if not exists field_manager_display_name text,
      add column if not exists field_manager_session_id text,
      add column if not exists created_at timestamptz not null default now();

    create unique index if not exists idx_asset_scan_events_client_event_id
      on public.asset_scan_events(client_event_id)
      where client_event_id is not null;

    create index if not exists idx_asset_scan_events_fuel_slip
      on public.asset_scan_events(fuel_slip_id)
      where fuel_slip_id is not null;

    create table if not exists public.asset_invoice_documents (
      id uuid primary key default gen_random_uuid(),
      user_id text not null,
      asset_register_item_id uuid not null references public.asset_register_items(id) on delete cascade,
      upload_id text,
      upload_url text,
      file_name text,
      content_type text,
      byte_size integer,
      source text not null default 'manual',
      raw_extracted_text text,
      extraction_status text not null default 'not_extracted',
      extraction_warnings jsonb not null default '[]'::jsonb,
      created_at timestamptz not null default now()
    );

    alter table if exists public.asset_invoice_documents
      add column if not exists upload_id text,
      add column if not exists upload_url text,
      add column if not exists file_name text,
      add column if not exists content_type text,
      add column if not exists byte_size integer,
      add column if not exists source text not null default 'manual',
      add column if not exists raw_extracted_text text,
      add column if not exists extraction_status text not null default 'not_extracted',
      add column if not exists extraction_warnings jsonb not null default '[]'::jsonb,
      add column if not exists created_at timestamptz not null default now();

    alter table if exists public.asset_invoice_documents drop constraint if exists asset_invoice_documents_source_check;
    alter table if exists public.asset_invoice_documents
      add constraint asset_invoice_documents_source_check check (source in ('manual', 'automatic', 'fuel_slip'));

    create table if not exists public.asset_invoices (
      id uuid primary key default gen_random_uuid(),
      user_id text not null,
      asset_register_item_id uuid not null references public.asset_register_items(id) on delete cascade,
      invoice_document_id uuid references public.asset_invoice_documents(id) on delete set null,
      supplier_name text,
      invoice_number text,
      invoice_date date,
      subtotal_ex_vat numeric(14,2),
      vat_amount numeric(14,2),
      total_inc_vat numeric(14,2) not null default 0,
      usage_reading numeric(14,2),
      usage_metric text,
      source text not null default 'manual',
      notes text,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );

    alter table if exists public.asset_invoices
      add column if not exists invoice_document_id uuid,
      add column if not exists supplier_name text,
      add column if not exists invoice_number text,
      add column if not exists invoice_date date,
      add column if not exists subtotal_ex_vat numeric(14,2),
      add column if not exists vat_amount numeric(14,2),
      add column if not exists total_inc_vat numeric(14,2) not null default 0,
      add column if not exists usage_reading numeric(14,2),
      add column if not exists usage_metric text,
      add column if not exists source text not null default 'manual',
      add column if not exists notes text,
      add column if not exists created_at timestamptz not null default now(),
      add column if not exists updated_at timestamptz not null default now();

    alter table if exists public.asset_invoices drop constraint if exists asset_invoices_source_check;
    alter table if exists public.asset_invoices
      add constraint asset_invoices_source_check check (source in ('manual', 'automatic', 'fuel_slip'));

    create table if not exists public.asset_invoice_blocks (
      id uuid primary key default gen_random_uuid(),
      invoice_id uuid not null references public.asset_invoices(id) on delete cascade,
      block_type text not null,
      description text,
      amount_ex_vat numeric(14,2),
      vat_amount numeric(14,2),
      total_inc_vat numeric(14,2),
      sort_order integer not null default 0,
      created_at timestamptz not null default now()
    );

    alter table if exists public.asset_invoice_blocks
      add column if not exists block_type text,
      add column if not exists description text,
      add column if not exists amount_ex_vat numeric(14,2),
      add column if not exists vat_amount numeric(14,2),
      add column if not exists total_inc_vat numeric(14,2),
      add column if not exists sort_order integer not null default 0,
      add column if not exists created_at timestamptz not null default now();

    create table if not exists public.fuel_storage_units (
      id uuid primary key default gen_random_uuid(),
      user_id text not null,
      name text not null,
      fuel_type text not null default 'diesel',
      capacity_litres numeric(12,3),
      current_litres numeric(12,3) not null default 0,
      reorder_level_litres numeric(12,3),
      location_label text,
      notes text,
      dipstick_note text,
      dipstick_note_updated_at timestamptz,
      status text not null default 'active',
      public_fuel_storage_code text not null unique,
      pin_hash text,
      pin_enabled boolean not null default true,
      pin_updated_at timestamptz,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );

    alter table if exists public.fuel_storage_units
      add column if not exists user_id text,
      add column if not exists name text,
      add column if not exists fuel_type text not null default 'diesel',
      add column if not exists capacity_litres numeric(12,3),
      add column if not exists current_litres numeric(12,3) not null default 0,
      add column if not exists reorder_level_litres numeric(12,3),
      add column if not exists location_label text,
      add column if not exists notes text,
      add column if not exists dipstick_note text,
      add column if not exists dipstick_note_updated_at timestamptz,
      add column if not exists status text not null default 'active',
      add column if not exists public_fuel_storage_code text,
      add column if not exists pin_hash text,
      add column if not exists pin_enabled boolean not null default true,
      add column if not exists pin_updated_at timestamptz,
      add column if not exists created_at timestamptz not null default now(),
      add column if not exists updated_at timestamptz not null default now();

    update public.fuel_storage_units
    set
      current_litres = greatest(0, coalesce(current_litres, 0)),
      status = case when lower(coalesce(status, '')) = 'archived' then 'archived' else 'active' end,
      fuel_type = coalesce(nullif(trim(fuel_type), ''), 'diesel'),
      public_fuel_storage_code = coalesce(nullif(trim(public_fuel_storage_code), ''), 'FUEL-' || upper(substr(md5(id::text), 1, 10))),
      updated_at = coalesce(updated_at, now()),
      created_at = coalesce(created_at, now());

    create unique index if not exists idx_fuel_storage_units_public_code
      on public.fuel_storage_units(public_fuel_storage_code);

    create index if not exists idx_fuel_storage_units_user_status
      on public.fuel_storage_units(user_id, status, updated_at desc);

    alter table if exists public.fuel_storage_units drop constraint if exists fuel_storage_units_status_check;
    alter table if exists public.fuel_storage_units
      add constraint fuel_storage_units_status_check check (status in ('active', 'archived'));

    create table if not exists public.fuel_storage_events (
      id uuid primary key default gen_random_uuid(),
      storage_id uuid not null references public.fuel_storage_units(id) on delete cascade,
      user_id text not null,
      event_type text not null,
      source_type text,
      source_label text,
      fuel_slip_id uuid,
      total_amount numeric(14,2),
      document_file_url text,
      payment_method text,
      card_number_masked text,
      asset_register_item_id text,
      litres numeric(12,3) not null default 0,
      storage_level_before_litres numeric(12,3),
      storage_level_after_litres numeric(12,3),
      asset_fuel_percent_before integer,
      asset_fuel_percent_after integer,
      asset_usage_reading numeric(14,2),
      operator_name text,
      activity_text text,
      work_area_text text,
      note text,
      latitude double precision,
      longitude double precision,
      location_text text,
      client_event_id text,
      client_captured_at timestamptz,
      synced_at timestamptz,
      gps_accuracy_meters double precision,
      created_at timestamptz not null default now()
    );

    alter table if exists public.fuel_storage_events
      add column if not exists storage_id uuid,
      add column if not exists user_id text,
      add column if not exists event_type text,
      add column if not exists source_type text,
      add column if not exists source_label text,
      add column if not exists fuel_slip_id uuid,
      add column if not exists total_amount numeric(14,2),
      add column if not exists document_file_url text,
      add column if not exists payment_method text,
      add column if not exists card_number_masked text,
      add column if not exists asset_register_item_id text,
      add column if not exists litres numeric(12,3) not null default 0,
      add column if not exists storage_level_before_litres numeric(12,3),
      add column if not exists storage_level_after_litres numeric(12,3),
      add column if not exists asset_fuel_percent_before integer,
      add column if not exists asset_fuel_percent_after integer,
      add column if not exists asset_usage_reading numeric(14,2),
      add column if not exists operator_name text,
      add column if not exists activity_text text,
      add column if not exists work_area_text text,
      add column if not exists note text,
      add column if not exists latitude double precision,
      add column if not exists longitude double precision,
      add column if not exists location_text text,
      add column if not exists client_event_id text,
      add column if not exists client_captured_at timestamptz,
      add column if not exists synced_at timestamptz,
      add column if not exists gps_accuracy_meters double precision,
      add column if not exists field_manager_id uuid,
      add column if not exists field_manager_display_name text,
      add column if not exists field_manager_session_id text,
      add column if not exists created_at timestamptz not null default now();

    alter table if exists public.fuel_storage_events drop constraint if exists fuel_storage_events_event_type_check;
    alter table if exists public.fuel_storage_events
      add constraint fuel_storage_events_event_type_check check (event_type in ('opening_balance', 'stock_in', 'asset_issue', 'dip', 'adjustment'));

    create index if not exists idx_fuel_storage_events_user_created
      on public.fuel_storage_events(user_id, created_at desc);

    create index if not exists idx_fuel_storage_events_storage_created
      on public.fuel_storage_events(storage_id, created_at desc);

    create index if not exists idx_fuel_storage_events_asset_created
      on public.fuel_storage_events(asset_register_item_id, created_at desc);

    create unique index if not exists idx_fuel_storage_events_client_event_id
      on public.fuel_storage_events(client_event_id)
      where client_event_id is not null;

    create index if not exists idx_fuel_storage_events_fuel_slip
      on public.fuel_storage_events(fuel_slip_id)
      where fuel_slip_id is not null;

    create table if not exists public.fuel_slips (
      id uuid primary key default gen_random_uuid(),
      user_id text not null,
      capture_request_id uuid,
      source_type text not null default 'fuel_slip',
      source_label text not null default 'Fuel Slip',
      target_type text not null,
      asset_register_item_id uuid references public.asset_register_items(id) on delete set null,
      storage_id uuid references public.fuel_storage_units(id) on delete set null,
      fuel_storage_event_id uuid,
      asset_invoice_id uuid references public.asset_invoices(id) on delete set null,
      invoice_document_id uuid references public.asset_invoice_documents(id) on delete set null,
      upload_id text,
      document_file_url text,
      original_filename text,
      content_type text,
      byte_size integer,
      supplier_name text,
      supplier_vat_number text,
      slip_number text,
      transaction_number text,
      document_date date,
      document_time text,
      fuel_type text,
      litres numeric(12,3),
      price_per_litre numeric(14,4),
      total_amount numeric(14,2),
      vat_amount numeric(14,2),
      vat_included boolean,
      vat_rate numeric(6,2),
      payment_method text,
      card_type text,
      card_number_masked text,
      card_last4 text,
      merchant_number text,
      terminal_number text,
      site_number text,
      odometer_reading numeric(14,2),
      hour_meter_reading numeric(14,2),
      usage_not_applicable boolean not null default false,
      operator_name text,
      operator_not_applicable boolean not null default false,
      activity_text text,
      activity_not_applicable boolean not null default false,
      work_area_text text,
      work_area_not_applicable boolean not null default false,
      note text,
      asset_fuel_percent_before integer,
      asset_fuel_percent_after integer,
      extraction_status text not null default 'manual',
      ocr_confidence numeric(5,2),
      review_required boolean not null default false,
      raw_extracted_text text,
      extraction_warnings jsonb not null default '[]'::jsonb,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );

    alter table if exists public.fuel_slips
      add column if not exists capture_request_id uuid,
      add column if not exists source_type text not null default 'fuel_slip',
      add column if not exists source_label text not null default 'Fuel Slip',
      add column if not exists target_type text,
      add column if not exists asset_register_item_id uuid,
      add column if not exists storage_id uuid,
      add column if not exists fuel_storage_event_id uuid,
      add column if not exists asset_invoice_id uuid,
      add column if not exists invoice_document_id uuid,
      add column if not exists upload_id text,
      add column if not exists document_file_url text,
      add column if not exists original_filename text,
      add column if not exists content_type text,
      add column if not exists byte_size integer,
      add column if not exists supplier_name text,
      add column if not exists supplier_vat_number text,
      add column if not exists slip_number text,
      add column if not exists transaction_number text,
      add column if not exists document_date date,
      add column if not exists document_time text,
      add column if not exists fuel_type text,
      add column if not exists litres numeric(12,3),
      add column if not exists price_per_litre numeric(14,4),
      add column if not exists total_amount numeric(14,2),
      add column if not exists vat_amount numeric(14,2),
      add column if not exists vat_included boolean,
      add column if not exists vat_rate numeric(6,2),
      add column if not exists payment_method text,
      add column if not exists card_type text,
      add column if not exists card_number_masked text,
      add column if not exists card_last4 text,
      add column if not exists merchant_number text,
      add column if not exists terminal_number text,
      add column if not exists site_number text,
      add column if not exists odometer_reading numeric(14,2),
      add column if not exists hour_meter_reading numeric(14,2),
      add column if not exists usage_not_applicable boolean not null default false,
      add column if not exists operator_name text,
      add column if not exists operator_not_applicable boolean not null default false,
      add column if not exists activity_text text,
      add column if not exists activity_not_applicable boolean not null default false,
      add column if not exists work_area_text text,
      add column if not exists work_area_not_applicable boolean not null default false,
      add column if not exists note text,
      add column if not exists asset_fuel_percent_before integer,
      add column if not exists asset_fuel_percent_after integer,
      add column if not exists extraction_status text not null default 'manual',
      add column if not exists ocr_confidence numeric(5,2),
      add column if not exists review_required boolean not null default false,
      add column if not exists raw_extracted_text text,
      add column if not exists extraction_warnings jsonb not null default '[]'::jsonb,
      add column if not exists created_at timestamptz not null default now(),
      add column if not exists updated_at timestamptz not null default now();

    update public.fuel_slips
    set
      usage_not_applicable = coalesce(usage_not_applicable, false),
      operator_not_applicable = coalesce(operator_not_applicable, false),
      activity_not_applicable = coalesce(activity_not_applicable, false),
      work_area_not_applicable = coalesce(work_area_not_applicable, false);

    alter table if exists public.fuel_slips
      alter column usage_not_applicable set default false,
      alter column usage_not_applicable set not null,
      alter column operator_not_applicable set default false,
      alter column operator_not_applicable set not null,
      alter column activity_not_applicable set default false,
      alter column activity_not_applicable set not null,
      alter column work_area_not_applicable set default false,
      alter column work_area_not_applicable set not null;

    alter table if exists public.asset_scan_events
      alter column fuel_litres type numeric(12,3) using fuel_litres::numeric(12,3);

    alter table if exists public.fuel_storage_units
      alter column capacity_litres type numeric(12,3) using capacity_litres::numeric(12,3),
      alter column current_litres type numeric(12,3) using current_litres::numeric(12,3),
      alter column reorder_level_litres type numeric(12,3) using reorder_level_litres::numeric(12,3);

    alter table if exists public.fuel_storage_events
      alter column litres type numeric(12,3) using litres::numeric(12,3),
      alter column storage_level_before_litres type numeric(12,3) using storage_level_before_litres::numeric(12,3),
      alter column storage_level_after_litres type numeric(12,3) using storage_level_after_litres::numeric(12,3);

    alter table if exists public.fuel_slips
      alter column litres type numeric(12,3) using litres::numeric(12,3),
      alter column total_amount type numeric(14,2) using total_amount::numeric(14,2),
      alter column litres drop not null,
      alter column total_amount drop not null;

    update public.fuel_storage_events
    set card_number_masked = '************' || right(regexp_replace(coalesce(card_number_masked, ''), '[^0-9]', '', 'g'), 4)
    where card_number_masked is not null
      and length(right(regexp_replace(card_number_masked, '[^0-9]', '', 'g'), 4)) = 4;

    update public.fuel_slips
    set
      card_last4 = right(regexp_replace(coalesce(nullif(card_last4, ''), card_number_masked, ''), '[^0-9]', '', 'g'), 4),
      card_number_masked = '************' || right(regexp_replace(coalesce(nullif(card_last4, ''), card_number_masked, ''), '[^0-9]', '', 'g'), 4)
    where coalesce(card_last4, card_number_masked, '') <> ''
      and length(right(regexp_replace(coalesce(nullif(card_last4, ''), card_number_masked, ''), '[^0-9]', '', 'g'), 4)) = 4;

    update public.fuel_slips
    set
      source_type = 'fuel_slip',
      source_label = 'Fuel Slip',
      target_type = case when target_type in ('asset', 'storage_tank') then target_type else coalesce(nullif(target_type, ''), 'asset') end,
      extraction_status = case when extraction_status in ('manual', 'extracted', 'needs_review') then extraction_status else 'manual' end,
      litres = case when litres is null then null else greatest(0, litres) end,
      total_amount = case when total_amount is null then null else greatest(0, total_amount) end,
      updated_at = coalesce(updated_at, now()),
      created_at = coalesce(created_at, now());

    alter table if exists public.fuel_slips drop constraint if exists fuel_slips_source_type_check;
    alter table if exists public.fuel_slips
      add constraint fuel_slips_source_type_check check (source_type = 'fuel_slip');

    alter table if exists public.fuel_slips drop constraint if exists fuel_slips_target_type_check;
    alter table if exists public.fuel_slips
      add constraint fuel_slips_target_type_check check (target_type in ('asset', 'storage_tank'));

    alter table if exists public.fuel_slips drop constraint if exists fuel_slips_extraction_status_check;
    alter table if exists public.fuel_slips
      add constraint fuel_slips_extraction_status_check check (extraction_status in ('manual', 'extracted', 'needs_review'));

    alter table if exists public.fuel_slips drop constraint if exists fuel_slips_asset_fuel_percent_before_check;
    alter table if exists public.fuel_slips
      add constraint fuel_slips_asset_fuel_percent_before_check check (asset_fuel_percent_before is null or (asset_fuel_percent_before >= 0 and asset_fuel_percent_before <= 100));

    alter table if exists public.fuel_slips drop constraint if exists fuel_slips_asset_fuel_percent_after_check;
    alter table if exists public.fuel_slips
      add constraint fuel_slips_asset_fuel_percent_after_check check (asset_fuel_percent_after is null or (asset_fuel_percent_after >= 0 and asset_fuel_percent_after <= 100));

    create index if not exists idx_fuel_slips_user_created
      on public.fuel_slips(user_id, created_at desc);

    create unique index if not exists idx_fuel_slips_capture_request
      on public.fuel_slips(capture_request_id)
      where capture_request_id is not null;

    create index if not exists idx_fuel_slips_asset_created
      on public.fuel_slips(asset_register_item_id, created_at desc)
      where asset_register_item_id is not null;

    create index if not exists idx_fuel_slips_storage_created
      on public.fuel_slips(storage_id, created_at desc)
      where storage_id is not null;

    alter table if exists public.fuel_storage_units
      add column if not exists balance_verification_status text not null default 'verified',
      add column if not exists balance_check_reason text,
      add column if not exists balance_check_source_event_id uuid,
      add column if not exists balance_check_marked_at timestamptz;

    update public.fuel_storage_units
    set balance_verification_status = case
      when lower(coalesce(balance_verification_status, '')) = 'needs_check' then 'needs_check'
      else 'verified'
    end;

    alter table if exists public.fuel_storage_units drop constraint if exists fuel_storage_units_balance_verification_status_check;
    alter table if exists public.fuel_storage_units
      add constraint fuel_storage_units_balance_verification_status_check
      check (balance_verification_status in ('verified', 'needs_check'));

    alter table if exists public.fuel_storage_events
      add column if not exists is_late_entry boolean not null default false,
      add column if not exists issue_date date,
      add column if not exists issue_time time without time zone,
      add column if not exists issue_time_recorded boolean not null default true,
      add column if not exists issue_at timestamptz,
      add column if not exists entry_added_at timestamptz not null default now(),
      add column if not exists added_by_user_id text,
      add column if not exists added_by_name text,
      add column if not exists added_by_email text,
      add column if not exists asset_usage_metric text,
      add column if not exists late_entry_reason text,
      add column if not exists evidence_type text,
      add column if not exists evidence_reference text,
      add column if not exists evidence_status text,
      add column if not exists evidence_id uuid,
      add column if not exists tank_balance_treatment text,
      add column if not exists linked_adjustment_event_id uuid,
      add column if not exists linked_missing_entry_event_id uuid,
      add column if not exists adjustment_kind text,
      add column if not exists idempotency_key text,
      add column if not exists gps_capture_status text;

    update public.fuel_storage_events
    set
      issue_date = coalesce(issue_date, (created_at at time zone 'Africa/Johannesburg')::date),
      issue_at = coalesce(issue_at, created_at),
      entry_added_at = coalesce(entry_added_at, created_at),
      gps_capture_status = coalesce(nullif(gps_capture_status, ''), case when latitude is null or longitude is null then 'not_captured' else 'captured' end)
    where issue_date is null or issue_at is null or entry_added_at is null or gps_capture_status is null or gps_capture_status = '';

    alter table if exists public.fuel_storage_events drop constraint if exists fuel_storage_events_asset_usage_metric_check;
    alter table if exists public.fuel_storage_events
      add constraint fuel_storage_events_asset_usage_metric_check
      check (asset_usage_metric is null or asset_usage_metric in ('hours', 'km', 'percentage', 'none'));

    alter table if exists public.fuel_storage_events drop constraint if exists fuel_storage_events_evidence_status_check;
    alter table if exists public.fuel_storage_events
      add constraint fuel_storage_events_evidence_status_check
      check (evidence_status is null or evidence_status in ('internal_record_only', 'evidence_supplied_review_required'));

    alter table if exists public.fuel_storage_events drop constraint if exists fuel_storage_events_tank_balance_treatment_check;
    alter table if exists public.fuel_storage_events
      add constraint fuel_storage_events_tank_balance_treatment_check
      check (tank_balance_treatment is null or tank_balance_treatment in ('already_reflected', 'not_yet_reflected', 'not_sure'));

    alter table if exists public.fuel_storage_events drop constraint if exists fuel_storage_events_adjustment_kind_check;
    alter table if exists public.fuel_storage_events
      add constraint fuel_storage_events_adjustment_kind_check
      check (adjustment_kind is null or adjustment_kind in ('late_entry_balance_correction', 'balance_reconciliation'));

    create unique index if not exists idx_fuel_storage_events_user_idempotency
      on public.fuel_storage_events(user_id, idempotency_key)
      where idempotency_key is not null;

    create index if not exists idx_fuel_storage_events_user_issue_date
      on public.fuel_storage_events(user_id, issue_date desc, issue_at desc, id desc);

    alter table if exists public.asset_scan_events
      add column if not exists source_type text,
      add column if not exists source_label text,
      add column if not exists issue_date date,
      add column if not exists issue_time text,
      add column if not exists issue_time_recorded boolean not null default true,
      add column if not exists asset_usage_reading numeric(14,2),
      add column if not exists asset_usage_metric text,
      add column if not exists entry_added_at timestamptz,
      add column if not exists added_by_user_id text;

    alter table if exists public.asset_scan_events drop constraint if exists asset_scan_events_asset_usage_metric_check;
    alter table if exists public.asset_scan_events
      add constraint asset_scan_events_asset_usage_metric_check
      check (asset_usage_metric is null or asset_usage_metric in ('hours', 'km', 'percentage', 'none'));

    create table if not exists public.fuel_late_entry_evidence (
      id uuid primary key default gen_random_uuid(),
      user_id text not null,
      fuel_storage_event_id uuid not null unique references public.fuel_storage_events(id) on delete restrict,
      file_name text not null,
      content_type text not null,
      byte_size integer not null,
      data bytea not null,
      created_at timestamptz not null default now()
    );

    create unique index if not exists idx_fuel_late_entry_evidence_event
      on public.fuel_late_entry_evidence(fuel_storage_event_id);

    create index if not exists idx_fuel_late_entry_evidence_user_created
      on public.fuel_late_entry_evidence(user_id, created_at desc);

    alter table if exists public.fuel_storage_events
      add column if not exists work_use_excluded boolean not null default false,
      add column if not exists work_use_exclusion_reason text;

    alter table if exists public.fuel_slips
      add column if not exists work_use_excluded boolean not null default false,
      add column if not exists work_use_exclusion_reason text,
      add column if not exists record_status text not null default 'active',
      add column if not exists voided_at timestamptz,
      add column if not exists voided_by_user_id text,
      add column if not exists voided_by_name text,
      add column if not exists voided_by_email text,
      add column if not exists void_reason text;

    update public.fuel_slips
    set record_status = case when record_status = 'voided' then 'voided' else 'active' end;

    alter table if exists public.fuel_slips drop constraint if exists fuel_slips_record_status_check;
    alter table if exists public.fuel_slips
      add constraint fuel_slips_record_status_check check (record_status in ('active', 'voided'));

    create table if not exists public.fuel_asset_exclusions (
      user_id text not null,
      asset_register_item_id uuid not null references public.asset_register_items(id) on delete cascade,
      is_excluded boolean not null default true,
      reason text,
      updated_by_user_id text,
      updated_by_name text,
      updated_by_email text,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now(),
      primary key (user_id, asset_register_item_id)
    );

    create index if not exists idx_fuel_asset_exclusions_user
      on public.fuel_asset_exclusions(user_id, is_excluded, updated_at desc);

    create table if not exists public.fuel_ledger_audit_events (
      id uuid primary key default gen_random_uuid(),
      user_id text not null,
      record_type text not null,
      record_id text not null,
      action text not null,
      actor_user_id text,
      actor_name text,
      actor_email text,
      reason text,
      before_snapshot jsonb,
      after_snapshot jsonb,
      created_at timestamptz not null default now()
    );

    create index if not exists idx_fuel_ledger_audit_record
      on public.fuel_ledger_audit_events(user_id, record_type, record_id, created_at desc);
  `);
}

export async function ensureFuelLedgerTables(): Promise<void> {
  if (!fuelLedgerTablesPromise) {
    fuelLedgerTablesPromise = ensureFuelLedgerTablesOnce().catch((error) => {
      fuelLedgerTablesPromise = null;
      throw error;
    });
  }

  return fuelLedgerTablesPromise;
}

export async function getFuelStorageById(userId: string, storageId: string): Promise<FuelLedgerStorage | null> {
  await ensureFuelLedgerTables();
  const db = getDb();

  const result = await db.query<FuelStorageRow>(
    `
      select ${fuelStorageSelectSql()}
      from public.fuel_storage_units
      where user_id = $1 and id::text = $2
      limit 1
    `,
    [userId, storageId],
  );

  const row = result.rows[0];
  return row ? mapStorageRow(row) : null;
}

async function getFuelStorageByPublicCode(publicFuelStorageCode: string): Promise<FuelLedgerStorage | null> {
  await ensureFuelLedgerTables();
  const db = getDb();
  const normalizedCode = normalizeFuelStorageCode(publicFuelStorageCode);

  if (!normalizedCode) {
    return null;
  }

  const result = await db.query<FuelStorageRow>(
    `
      select ${fuelStorageSelectSql()}
      from public.fuel_storage_units
      where upper(public_fuel_storage_code) = $1
      limit 1
    `,
    [normalizedCode],
  );

  const row = result.rows[0];
  return row ? mapStorageRow(row) : null;
}

export async function listFuelAssetsForUser(userId: string): Promise<FuelLedgerAsset[]> {
  await ensureFuelLedgerTables();
  const db = getDb();

  const result = await db.query<FuelAssetRow>(
    `
      select
        a.id::text,
        a.title,
        a.kind,
        a.brand_name,
        a.model_name,
        a.typed_model_name,
        coalesce(ef.family_label, '') as equipment_family_label,
        coalesce(to_jsonb(a)->>'serial_number', to_jsonb(a)->>'serialNumber', '') as serial_number,
        to_jsonb(a)->>'plate_label' as plate_label,
        to_jsonb(a)->>'public_asset_code' as public_asset_code,
        coalesce(nullif(lower(to_jsonb(a)->>'qr_status'), ''), 'active') as qr_status,
        a.hours,
        coalesce(to_jsonb(a)->>'life_worked_percent', to_jsonb(a)->'specs_json'->>'life_worked_percent', to_jsonb(a)->'specs_json'->>'lifeWorkedPercent') as life_worked_percent,
        to_jsonb(a)->>'fuel_percent' as fuel_percent,
        coalesce(to_jsonb(a)->>'year_model', to_jsonb(a)->>'yearModel', to_jsonb(a)->>'year') as year_model,
        coalesce(to_jsonb(a)->>'condition', '') as condition,
        coalesce(to_jsonb(a)->>'selected_method', to_jsonb(a)->>'selectedMethod', to_jsonb(a)->>'method', '') as selected_method,
        coalesce(
          to_jsonb(a)->>'current_value',
          to_jsonb(a)->>'currentValue',
          to_jsonb(a)->>'selected_value_ex_vat',
          to_jsonb(a)->>'selectedValueExVat',
          to_jsonb(a)->>'selected_value',
          to_jsonb(a)->>'value',
          to_jsonb(a)->>'opening_value'
        ) as current_value,
        ef.is_propelled as family_is_propelled,
        coalesce(a.specs_json, '{}'::jsonb) as specs_json,
        coalesce(fae.is_excluded, false) as work_use_excluded,
        coalesce(fae.reason, '') as work_use_exclusion_reason
      from public.asset_register_items a
      left join public.valuation_runs vr
        on vr.id = a.valuation_run_id
      left join public.equipment_families ef
        on ef.id = coalesce(a.equipment_family_id, vr.equipment_family_id)
      left join public.fuel_asset_exclusions fae
        on fae.user_id = a.user_id and fae.asset_register_item_id = a.id
      where a.user_id = $1
        and coalesce(to_jsonb(a)->>'qr_status', 'active') <> 'deleted'
      order by lower(coalesce(a.title, '')), a.id::text
    `,
    [userId],
  );

  return result.rows.map(mapFuelAssetRow);
}

function fuelSlipReportDateSql(alias: string): string {
  return `
    case
      when ${alias}.document_date is not null then
        (
          ${alias}.document_date::text || ' ' ||
          case
            when coalesce(${alias}.document_time, '') ~ '^([01][0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9])?$'
              then ${alias}.document_time
            else '00:00:00'
          end
        )::timestamp at time zone 'Africa/Johannesburg'
      else null
    end
  `;
}

async function listFuelEvents(userId: string, options: { storageId?: string; limit?: number | null; fromIso?: string; toIso?: string; includeFuelSlipEvents?: boolean } = {}): Promise<FuelLedgerEvent[]> {
  await ensureFuelLedgerTables();
  const db = getDb();
  const limit = options.limit === null ? null : Math.max(1, Math.min(2000, Math.round(options.limit ?? 80)));
  const limitClause = limit === null ? '' : `limit ${limit}`;
  const params: unknown[] = [userId];
  const eventDateExpression = `coalesce(${fuelSlipReportDateSql('fs')}, e.issue_at, e.created_at)`;
  let filter = 'e.user_id = $1';

  if (options.storageId) {
    params.push(options.storageId);
    filter += ` and e.storage_id::text = $${params.length}`;
  }

  if (options.includeFuelSlipEvents === false) {
    filter += ` and coalesce(e.source_type, '') <> 'fuel_slip'`;
  }

  if (options.fromIso) {
    params.push(options.fromIso);
    filter += ` and ${eventDateExpression} >= $${params.length}::timestamptz`;
  }

  if (options.toIso) {
    params.push(options.toIso);
    filter += ` and ${eventDateExpression} < $${params.length}::timestamptz`;
  }

  const result = await db.query<FuelEventRow>(
    `
      select ${fuelEventSelectSql()}
      from public.fuel_storage_events e
      left join public.fuel_storage_units s on s.id = e.storage_id
      left join public.asset_register_items a on a.id::text = e.asset_register_item_id
      left join public.fuel_slips fs on fs.id = e.fuel_slip_id
      where ${filter}
      order by ${eventDateExpression} desc, e.id desc
      ${limitClause}
    `,
    params,
  );

  return result.rows.map(mapFuelEventRow);
}



function fuelSlipReportDateIso(slip: FuelSlipTransaction): string {
  return fuelSlipDocumentDateIso(slip.documentDate, slip.documentTime, slip.createdAtIso);
}

function fuelSlipReportNote(slip: FuelSlipTransaction): string {
  const parts = [
    slip.supplierName ? `Supplier: ${slip.supplierName}` : '',
    slip.fuelType ? `Fuel type: ${slip.fuelType}` : '',
    slip.slipNumber ? `Slip: ${slip.slipNumber}` : '',
    slip.transactionNumber ? `Transaction: ${slip.transactionNumber}` : '',
    slip.paymentMethod ? `Payment: ${slip.paymentMethod}` : '',
    formatCardEnding(slip.cardNumberMasked, slip.cardLast4),
    slip.usageNotApplicable ? 'Usage: N/A' : '',
    slip.operatorNotApplicable ? 'Operator / manager: N/A' : slip.operatorName ? `Operator / manager: ${slip.operatorName}` : '',
    slip.activityNotApplicable ? 'Activity: N/A' : slip.activityText ? `Activity: ${slip.activityText}` : '',
    slip.workAreaNotApplicable ? 'Work area: N/A' : slip.workAreaText ? `Work area: ${slip.workAreaText}` : '',
    slip.assetFuelPercentAfter !== null ? `Fuel percentage after fill: ${slip.assetFuelPercentAfter}%` : '',
    slip.note ? `Note: ${slip.note}` : '',
    slip.documentFileUrl ? `Document: ${slip.documentFileUrl}` : '',
    `Review: ${fuelSlipReviewStatusLabel(slip.extractionStatus, slip.reviewRequired)}`,
  ].filter(Boolean);

  return maskStoredFuelSlipRawText(parts.join(' · ') || 'Fuel Slip');
}

function mapFuelSlipToReportEvent(slip: FuelSlipTransaction): FuelLedgerEvent {
  const isStorageTarget = slip.targetType === 'storage_tank';
  const usageReading = slip.odometerReading ?? slip.hourMeterReading;
  const reviewStatus = fuelSlipReviewStatusLabel(slip.extractionStatus, slip.reviewRequired);

  return {
    id: `fuel-slip-${slip.id}`,
    storageId: isStorageTarget ? slip.storageId : '',
    storageName: isStorageTarget ? slip.storageName || 'Fuel storage' : 'External fuel purchase',
    storagePublicCode: '',
    eventType: isStorageTarget ? 'stock_in' : 'asset_issue',
    sourceType: 'fuel_slip',
    sourceLabel: 'Fuel Slip',
    fuelSlipId: slip.id,
    fuelSlipTargetType: slip.targetType,
    fuelSlipSupplierName: slip.supplierName,
    fuelSlipFuelType: slip.fuelType,
    fuelSlipDocumentDate: slip.documentDate,
    fuelSlipDocumentTime: slip.documentTime,
    fuelSlipExtractionStatus: slip.extractionStatus,
    fuelSlipReviewRequired: slip.reviewRequired,
    fuelSlipReviewStatus: reviewStatus,
    totalAmount: slip.totalAmount,
    documentFileUrl: slip.documentFileUrl,
    paymentMethod: slip.paymentMethod,
    cardNumberMasked: slip.cardNumberMasked,
    assetId: slip.assetId,
    assetTitle: slip.assetTitle,
    assetPlateLabel: '',
    litres: slip.litres ?? 0,
    storageLevelBefore: null,
    storageLevelAfter: null,
    assetFuelPercentBefore: slip.assetFuelPercentBefore,
    assetFuelPercentAfter: slip.assetFuelPercentAfter,
    assetUsageReading: usageReading,
    operatorName: slip.operatorNotApplicable ? 'N/A' : slip.operatorName || slip.supplierName || 'Fuel Slip',
    activityText: slip.activityNotApplicable ? 'N/A' : slip.activityText || 'Fuel Slip',
    workAreaText: slip.workAreaNotApplicable ? 'N/A' : slip.workAreaText || (isStorageTarget ? 'Storage tank' : 'External fuel purchase'),
    note: fuelSlipReportNote(slip),
    latitude: slip.latitude,
    longitude: slip.longitude,
    locationText: slip.locationText,
    isLateEntry: false,
    issueDate: slip.documentDate,
    issueTime: slip.documentTime,
    issueTimeRecorded: Boolean(slip.documentTime),
    issueAtIso: fuelSlipReportDateIso(slip),
    entryAddedAtIso: slip.createdAtIso,
    addedByUserId: '',
    addedByName: '',
    addedByEmail: '',
    assetUsageMetric: slip.usageNotApplicable ? 'none' : slip.odometerReading !== null ? 'km' : slip.hourMeterReading !== null ? 'hours' : '',
    lateEntryReason: '',
    evidenceType: '',
    evidenceReference: '',
    evidenceStatus: '',
    evidenceFileName: '',
    evidenceFileUrl: '',
    tankBalanceTreatment: '',
    linkedAdjustmentEventId: '',
    linkedMissingEntryEventId: '',
    adjustmentKind: '',
    idempotencyKey: '',
    gpsCaptureStatus:
      slip.latitude !== null && slip.longitude !== null
        ? 'captured'
        : slip.locationText
          ? 'location_only'
          : 'not_captured',
    workUseExcluded: slip.workUseExcluded,
    workUseExclusionReason: slip.workUseExclusionReason,
    createdAtIso: fuelSlipReportDateIso(slip),
  };
}

async function listFuelSlipEventsForReport(
  userId: string,
  options: { storageId?: string; limit?: number | null; fromIso?: string; toIso?: string } = {},
): Promise<FuelLedgerEvent[]> {
  await ensureFuelLedgerTables();
  const db = getDb();
  const limit = options.limit === null ? null : Math.max(1, Math.min(2000, Math.round(options.limit ?? 2000)));
  const limitClause = limit === null ? '' : `limit ${limit}`;
  const params: unknown[] = [userId];
  const dateExpression = `coalesce(${fuelSlipReportDateSql('fs')}, fs.created_at)`;
  let filter = `fs.user_id = $1 and fs.record_status = 'active' and (fs.target_type = 'asset' or fs.fuel_storage_event_id is null)`;

  if (options.storageId) {
    params.push(options.storageId);
    filter += ` and fs.target_type = 'storage_tank' and fs.storage_id::text = $${params.length}`;
  }

  if (options.fromIso) {
    params.push(options.fromIso);
    filter += ` and ${dateExpression} >= $${params.length}::timestamptz`;
  }

  if (options.toIso) {
    params.push(options.toIso);
    filter += ` and ${dateExpression} < $${params.length}::timestamptz`;
  }

  const result = await db.query<FuelSlipRow>(
    `
      select ${fuelSlipSelectSql()}
      from public.fuel_slips fs
      left join public.asset_register_items a on a.id = fs.asset_register_item_id
      left join public.fuel_storage_units s on s.id = fs.storage_id
      where ${filter}
      order by ${dateExpression} desc, fs.created_at desc, fs.id desc
      ${limitClause}
    `,
    params,
  );

  return result.rows.map(mapFuelSlipRow).map(mapFuelSlipToReportEvent);
}

async function listFuelSlips(userId: string, options: { limit?: number } = {}): Promise<FuelSlipTransaction[]> {
  await ensureFuelLedgerTables();
  const db = getDb();
  const limit = Math.max(1, Math.min(2000, Math.round(options.limit ?? 80)));

  const result = await db.query<FuelSlipRow>(
    `
      select ${fuelSlipSelectSql()}
      from public.fuel_slips fs
      left join public.asset_register_items a on a.id = fs.asset_register_item_id
      left join public.fuel_storage_units s on s.id = fs.storage_id
      where fs.user_id = $1 and fs.record_status = 'active'
      order by fs.created_at desc, fs.id desc
      limit ${limit}
    `,
    [userId],
  );

  return result.rows.map(mapFuelSlipRow);
}

export async function getFuelSlipTransactionById(userId: string, fuelSlipId: string): Promise<FuelSlipTransaction | null> {
  await ensureFuelLedgerTables();
  const result = await getDb().query<FuelSlipRow>(
    `
      select ${fuelSlipSelectSql()}
      from public.fuel_slips fs
      left join public.asset_register_items a on a.id = fs.asset_register_item_id
      left join public.fuel_storage_units s on s.id = fs.storage_id
      where fs.user_id = $1 and fs.id::text = $2 and fs.record_status = 'active'
      limit 1
    `,
    [userId, fuelSlipId],
  );

  return result.rows[0] ? mapFuelSlipRow(result.rows[0]) : null;
}

export async function listFuelLedger(userId: string): Promise<FuelLedgerData> {
  await ensureFuelLedgerTables();
  const db = getDb();

  const [storageResult, events, fuelSlips, assets, totalsResult] = await Promise.all([
    db.query<FuelStorageRow>(
      `
        select ${fuelStorageSelectSql()}
        from public.fuel_storage_units
        where user_id = $1
          and status = 'active'
        order by lower(name), created_at desc
      `,
      [userId],
    ),
    listFuelEvents(userId, { limit: 80 }),
    listFuelSlips(userId, { limit: 2000 }),
    listFuelAssetsForUser(userId),
    db.query<{ issued_30: string | number | null; filled_30: string | number | null }>(
      `
        select
          coalesce(sum(case when event_type = 'asset_issue' and created_at >= now() - interval '30 days' then litres else 0 end), 0) as issued_30,
          coalesce(sum(case when event_type in ('opening_balance', 'stock_in') and created_at >= now() - interval '30 days' then litres else 0 end), 0) as filled_30
        from public.fuel_storage_events
        where user_id = $1
      `,
      [userId],
    ),
  ]);

  const storages = storageResult.rows.map(mapStorageRow);
  const activeStorages = storages.filter((storage) => storage.status === 'active');
  const totalCapacityLitres = roundLitres(activeStorages.reduce((sum, storage) => sum + (storage.capacityLitres ?? 0), 0));
  const currentLitres = roundLitres(activeStorages.reduce((sum, storage) => sum + storage.currentLitres, 0));
  const lowStorageCount = activeStorages.filter((storage) => storage.reorderLevelLitres !== null && storage.currentLitres < storage.reorderLevelLitres).length;
  const totals = totalsResult.rows[0];

  return {
    storages,
    recentEvents: events,
    recentFuelSlips: fuelSlips,
    assets,
    summary: {
      totalStorageUnits: activeStorages.length,
      totalCapacityLitres,
      currentLitres,
      currentStockPercent: storageStockPercent(currentLitres, totalCapacityLitres),
      lowStorageCount,
      issuedLitres30Days: normalizeOptionalLitres(totals?.issued_30) ?? 0,
      filledLitres30Days: normalizeOptionalLitres(totals?.filled_30) ?? 0,
      activeAssetsCount: assets.length,
    },
  };
}

export async function createFuelStorage(
  userId: string,
  input: {
    name?: unknown;
    fuelType?: unknown;
    capacityLitres?: unknown;
    currentLitres?: unknown;
    reorderLevelLitres?: unknown;
    locationLabel?: unknown;
    notes?: unknown;
    pin?: unknown;
  },
): Promise<FuelLedgerStorage> {
  await ensureFuelLedgerTables();
  const db = getDb();
  const client = await db.connect();

  const name = asText(input.name);
  if (name.length < 2) {
    throw new Error('Name the fuel storage unit.');
  }

  const pinHash = await hashScanPin(input.pin);
  const fuelType = normalizeFuelType(input.fuelType);
  const capacityLitres = normalizeOptionalLitres(input.capacityLitres);
  const currentLitres = normalizeOptionalLitres(input.currentLitres) ?? 0;
  const reorderLevelLitres = normalizeOptionalLitres(input.reorderLevelLitres);
  const publicFuelStorageCode = generateFuelStorageCode();

  try {
    await client.query('BEGIN');

    const inserted = await client.query<FuelStorageRow>(
      `
        insert into public.fuel_storage_units (
          user_id,
          name,
          fuel_type,
          capacity_litres,
          current_litres,
          reorder_level_litres,
          location_label,
          notes,
          status,
          public_fuel_storage_code,
          pin_hash,
          pin_enabled,
          pin_updated_at,
          created_at,
          updated_at
        )
        values ($1, $2, $3, $4::numeric, $5::numeric, $6::numeric, $7, $8, 'active', $9, $10, true, now(), now(), now())
        returning ${fuelStorageSelectSql()}
      `,
      [
        userId,
        name,
        fuelType,
        capacityLitres,
        currentLitres,
        reorderLevelLitres,
        asText(input.locationLabel) || null,
        asText(input.notes) || null,
        publicFuelStorageCode,
        pinHash,
      ],
    );

    const storageRow = inserted.rows[0];

    if (!storageRow) {
      throw new Error('Failed to create fuel storage.');
    }

    if (currentLitres > 0) {
      await client.query(
        `
          insert into public.fuel_storage_events (
            storage_id,
            user_id,
            event_type,
            litres,
            storage_level_before_litres,
            storage_level_after_litres,
            operator_name,
            note,
            created_at
          )
          values ($1::uuid, $2, 'opening_balance', $3::numeric, 0, $3::numeric, 'Owner setup', 'Opening storage balance', now())
        `,
        [storageRow.id, userId, currentLitres],
      );
    }

    await client.query('COMMIT');
    return mapStorageRow(storageRow);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function updateFuelStorage(
  userId: string,
  storageId: string,
  input: {
    name?: unknown;
    fuelType?: unknown;
    capacityLitres?: unknown;
    currentLitres?: unknown;
    reorderLevelLitres?: unknown;
    locationLabel?: unknown;
    notes?: unknown;
    auditActorUserId?: unknown;
    auditActorName?: unknown;
    auditActorEmail?: unknown;
    auditReason?: unknown;
  },
): Promise<FuelLedgerStorage> {
  await ensureFuelLedgerTables();
  const db = getDb();
  const client = await db.connect();

  const name = asText(input.name);
  if (name.length < 2) {
    throw new Error('Name the fuel storage unit.');
  }

  try {
    await client.query('BEGIN');

    const current = await client.query<FuelStorageRow>(
      `
        select ${fuelStorageSelectSql()}
        from public.fuel_storage_units
        where user_id = $1 and id::text = $2
        for update
      `,
      [userId, storageId],
    );
    const currentStorage = current.rows[0] ? mapStorageRow(current.rows[0]) : null;

    if (!currentStorage) {
      throw new Error('Fuel storage not found.');
    }

    const nextCurrentLitres = normalizeOptionalLitres(input.currentLitres);
    const updated = await client.query<FuelStorageRow>(
      `
        update public.fuel_storage_units
        set
          name = $3,
          fuel_type = $4,
          capacity_litres = $5::numeric,
          current_litres = coalesce($6::numeric, current_litres),
          reorder_level_litres = $7::numeric,
          location_label = $8,
          notes = $9,
          updated_at = now()
        where user_id = $1 and id::text = $2
        returning ${fuelStorageSelectSql()}
      `,
      [
        userId,
        storageId,
        name,
        normalizeFuelType(input.fuelType),
        normalizeOptionalLitres(input.capacityLitres),
        nextCurrentLitres,
        normalizeOptionalLitres(input.reorderLevelLitres),
        asText(input.locationLabel) || null,
        asText(input.notes) || null,
      ],
    );

    const updatedStorage = updated.rows[0] ? mapStorageRow(updated.rows[0]) : null;
    if (!updatedStorage) {
      throw new Error('Failed to update fuel storage.');
    }

    if (nextCurrentLitres !== null && Math.abs(nextCurrentLitres - currentStorage.currentLitres) >= 0.01) {
      await client.query(
        `
          insert into public.fuel_storage_events (
            storage_id,
            user_id,
            event_type,
            litres,
            storage_level_before_litres,
            storage_level_after_litres,
            operator_name,
            note,
            created_at
          )
          values ($1::uuid, $2, 'adjustment', $3::numeric, $4::numeric, $5::numeric, 'Owner adjustment', 'Manual storage balance correction from Fuel Ledger.', now())
        `,
        [storageId, userId, Math.abs(nextCurrentLitres - currentStorage.currentLitres), currentStorage.currentLitres, nextCurrentLitres],
      );
    }

    await insertFuelLedgerAuditEvent(client, {
      userId,
      recordType: 'storage',
      recordId: storageId,
      action: 'updated',
      actor: {
        userId: input.auditActorUserId,
        name: input.auditActorName,
        email: input.auditActorEmail,
      },
      reason: input.auditReason,
      beforeSnapshot: currentStorage,
      afterSnapshot: updatedStorage,
    });

    await client.query('COMMIT');
    return updatedStorage;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function saveFuelStoragePin(userId: string, storageId: string, pin: unknown): Promise<FuelLedgerStorage> {
  await ensureFuelLedgerTables();
  const db = getDb();
  const pinHash = await hashScanPin(pin);

  const result = await db.query<FuelStorageRow>(
    `
      update public.fuel_storage_units
      set
        pin_hash = $3,
        pin_enabled = true,
        pin_updated_at = now(),
        updated_at = now()
      where user_id = $1 and id::text = $2
      returning ${fuelStorageSelectSql()}
    `,
    [userId, storageId, pinHash],
  );

  const row = result.rows[0];
  if (!row) {
    throw new Error('Fuel storage not found.');
  }

  return mapStorageRow(row);
}

export async function saveFuelStorageDipstickNote(
  userId: string,
  storageId: string,
  input: {
    dipstickNote?: unknown;
    operatorName?: unknown;
    latitude?: unknown;
    longitude?: unknown;
    locationText?: unknown;
    clientEventId?: unknown;
    clientCapturedAt?: unknown;
    gpsAccuracyMeters?: unknown;
    createEvent?: boolean;
    fieldManagerId?: unknown;
    fieldManagerDisplayName?: unknown;
    fieldManagerSessionId?: unknown;
  },
): Promise<FuelLedgerStorage> {
  await ensureFuelLedgerTables();
  const db = getDb();
  const client = await db.connect();
  const dipstickNote = asText(input.dipstickNote).slice(0, 700);
  const operatorName = asText(input.operatorName).slice(0, 80) || 'QR scanner';
  const latitude = normalizeCoordinate(input.latitude, 90);
  const longitude = normalizeCoordinate(input.longitude, 180);
  const locationText = latitude !== null && longitude !== null
    ? asText(input.locationText) || `GPS ${latitude.toFixed(6)}, ${longitude.toFixed(6)}`
    : asText(input.locationText) || null;
  const clientEventId = normalizeClientEventId(input.clientEventId);
  const clientCapturedAt = normalizeClientCapturedAt(input.clientCapturedAt);
  const gpsAccuracyMeters = normalizeGpsAccuracyMeters(input.gpsAccuracyMeters);
  const fieldManagerId = asText(input.fieldManagerId) || null;
  const fieldManagerDisplayName = asText(input.fieldManagerDisplayName) || null;
  const fieldManagerSessionId = asText(input.fieldManagerSessionId) || null;

  try {
    await client.query('BEGIN');

    const storageResult = await client.query<FuelStorageRow>(
      `
        select ${fuelStorageSelectSql()}
        from public.fuel_storage_units
        where user_id = $1 and id::text = $2
        for update
      `,
      [userId, storageId],
    );

    const currentStorage = storageResult.rows[0] ? mapStorageRow(storageResult.rows[0]) : null;
    if (!currentStorage) {
      throw new Error('Fuel storage not found.');
    }

    if (input.createEvent && clientEventId) {
      const existingEvent = await client.query<FuelEventRow>(
        `
          select ${fuelEventSelectSql()}
          from public.fuel_storage_events e
          left join public.fuel_storage_units s on s.id = e.storage_id
          left join public.asset_register_items a on a.id::text = e.asset_register_item_id
          left join public.fuel_slips fs on fs.id = e.fuel_slip_id
          where e.storage_id::text = $1 and e.client_event_id = $2
          order by e.created_at desc, e.id desc
          limit 1
        `,
        [storageId, clientEventId],
      );

      if (existingEvent.rows[0]) {
        await client.query('COMMIT');
        return currentStorage;
      }
    }

    const updated = await client.query<FuelStorageRow>(
      `
        update public.fuel_storage_units
        set
          dipstick_note = nullif($3, ''),
          dipstick_note_updated_at = case when nullif($3, '') is null then null else now() end,
          updated_at = now()
        where user_id = $1 and id::text = $2
        returning ${fuelStorageSelectSql()}
      `,
      [userId, storageId, dipstickNote],
    );

    const row = updated.rows[0];
    if (!row) {
      throw new Error('Fuel storage not found.');
    }

    if (input.createEvent) {
      await insertFuelStorageEvent(client, {
        storageId,
        userId,
        eventType: 'dip',
        assetId: null,
        litres: 0,
        storageLevelBefore: currentStorage.currentLitres,
        storageLevelAfter: currentStorage.currentLitres,
        assetFuelPercentBefore: null,
        assetFuelPercentAfter: null,
        assetUsageReading: null,
        operatorName,
        activityText: 'Dipstick note',
        workAreaText: null,
        note: dipstickNote || 'Dipstick note cleared.',
        latitude,
        longitude,
        locationText,
        clientEventId,
        clientCapturedAt,
        gpsAccuracyMeters,
        fieldManagerId,
        fieldManagerDisplayName,
        fieldManagerSessionId,
      });
    }

    await client.query('COMMIT');
    return mapStorageRow(row);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}


export async function archiveFuelStorage(
  userId: string,
  storageId: string,
  input: { actor?: FuelLedgerAuditActor; reason?: unknown } = {},
): Promise<void> {
  await ensureFuelLedgerTables();
  const client = await getDb().connect();
  let committed = false;

  try {
    await client.query('BEGIN');
    const storageResult = await client.query<FuelStorageRow>(
      `
        select ${fuelStorageSelectSql()}
        from public.fuel_storage_units
        where user_id = $1 and id::text = $2
        for update
      `,
      [userId, storageId],
    );
    const before = storageResult.rows[0] ? mapStorageRow(storageResult.rows[0]) : null;
    if (!before) throw new Error('Fuel storage not found.');
    if (before.status === 'archived') {
      await client.query('COMMIT');
      committed = true;
      return;
    }

    const updated = await client.query<FuelStorageRow>(
      `
        update public.fuel_storage_units
        set status = 'archived', updated_at = now()
        where user_id = $1 and id::text = $2
        returning ${fuelStorageSelectSql()}
      `,
      [userId, storageId],
    );
    const after = updated.rows[0] ? mapStorageRow(updated.rows[0]) : null;
    if (!after) throw new Error('Fuel storage could not be archived.');

    await insertFuelLedgerAuditEvent(client, {
      userId,
      recordType: 'storage',
      recordId: storageId,
      action: 'archived',
      actor: input.actor,
      reason: input.reason,
      beforeSnapshot: before,
      afterSnapshot: after,
    });

    await client.query('COMMIT');
    committed = true;
  } catch (error) {
    if (!committed) await client.query('ROLLBACK').catch(() => null);
    throw error;
  } finally {
    client.release();
  }
}

export async function recordFuelStorageStock(
  userId: string,
  storageId: string,
  input: {
    mode?: unknown;
    litres?: unknown;
    currentLitres?: unknown;
    operatorName?: unknown;
    note?: unknown;
    latitude?: unknown;
    longitude?: unknown;
    locationText?: unknown;
    clientEventId?: unknown;
    clientCapturedAt?: unknown;
    gpsAccuracyMeters?: unknown;
    fieldManagerId?: unknown;
    fieldManagerDisplayName?: unknown;
    fieldManagerSessionId?: unknown;
  },
): Promise<{ storage: FuelLedgerStorage; event: FuelLedgerEvent }> {
  await ensureFuelLedgerTables();
  const db = getDb();
  const client = await db.connect();
  const mode = String(input.mode ?? '').trim().toLowerCase() === 'dip' ? 'dip' : 'stock_in';
  const operatorName = asText(input.operatorName) || 'Owner entry';
  const latitude = normalizeCoordinate(input.latitude, 90);
  const longitude = normalizeCoordinate(input.longitude, 180);
  const locationText = latitude !== null && longitude !== null
    ? asText(input.locationText) || `GPS ${latitude.toFixed(6)}, ${longitude.toFixed(6)}`
    : asText(input.locationText) || null;
  const clientEventId = normalizeClientEventId(input.clientEventId);
  const clientCapturedAt = normalizeClientCapturedAt(input.clientCapturedAt);
  const gpsAccuracyMeters = normalizeGpsAccuracyMeters(input.gpsAccuracyMeters);
  const fieldManagerId = asText(input.fieldManagerId) || null;
  const fieldManagerDisplayName = asText(input.fieldManagerDisplayName) || null;
  const fieldManagerSessionId = asText(input.fieldManagerSessionId) || null;

  try {
    await client.query('BEGIN');

    const storageResult = await client.query<FuelStorageRow>(
      `
        select ${fuelStorageSelectSql()}
        from public.fuel_storage_units
        where user_id = $1 and id::text = $2 and status = 'active'
        for update
      `,
      [userId, storageId],
    );

    const storage = storageResult.rows[0] ? mapStorageRow(storageResult.rows[0]) : null;
    if (!storage) {
      throw new Error('Fuel storage not found.');
    }

    if (clientEventId) {
      const existingEvent = await client.query<FuelEventRow>(
        `
          select ${fuelEventSelectSql()}
          from public.fuel_storage_events e
          left join public.fuel_storage_units s on s.id = e.storage_id
          left join public.asset_register_items a on a.id::text = e.asset_register_item_id
          left join public.fuel_slips fs on fs.id = e.fuel_slip_id
          where e.storage_id::text = $1 and e.client_event_id = $2
          order by e.created_at desc, e.id desc
          limit 1
        `,
        [storageId, clientEventId],
      );

      const duplicateEvent = existingEvent.rows[0];
      if (duplicateEvent) {
        await client.query('COMMIT');
        return {
          storage,
          event: mapFuelEventRow(duplicateEvent),
        };
      }
    }

    const before = storage.currentLitres;
    const nextCurrentLitres = normalizeOptionalLitres(input.currentLitres);
    const litres = mode === 'stock_in' ? normalizePositiveLitres(input.litres) : Math.abs((nextCurrentLitres ?? before) - before);
    const after = mode === 'stock_in' ? roundLitres(before + litres) : (nextCurrentLitres ?? before);
    const eventType: FuelStorageEventType = mode === 'stock_in' ? 'stock_in' : 'dip';

    if (storage.capacityLitres !== null && after > storage.capacityLitres + 0.001) {
      throw new Error(`Storage refill exceeds tank capacity. Capacity is ${storage.capacityLitres.toLocaleString('en-ZA', { maximumFractionDigits: 3 })} L.`);
    }

    const updated = await client.query<FuelStorageRow>(
      `
        update public.fuel_storage_units
        set current_litres = $3::numeric, updated_at = now()
        where user_id = $1 and id::text = $2
        returning ${fuelStorageSelectSql()}
      `,
      [userId, storageId, after],
    );

    const event = await insertFuelStorageEvent(client, {
      storageId,
      userId,
      eventType,
      assetId: null,
      litres,
      storageLevelBefore: before,
      storageLevelAfter: after,
      assetFuelPercentBefore: null,
      assetFuelPercentAfter: null,
      assetUsageReading: null,
      operatorName,
      activityText: null,
      workAreaText: null,
      note: asText(input.note) || (eventType === 'stock_in' ? 'Fuel In / Storage Refill.' : 'Manual storage dip captured.'),
      latitude,
      longitude,
      locationText,
      clientEventId,
      clientCapturedAt,
      gpsAccuracyMeters,
      fieldManagerId,
      fieldManagerDisplayName,
      fieldManagerSessionId,
    });

    await client.query('COMMIT');

    return {
      storage: mapStorageRow(updated.rows[0]),
      event,
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function insertFuelStorageEvent(
  client: PoolClient,
  input: {
    storageId: string;
    userId: string;
    eventType: FuelStorageEventType;
    assetId: string | null;
    litres: number;
    storageLevelBefore: number | null;
    storageLevelAfter: number | null;
    assetFuelPercentBefore: number | null;
    assetFuelPercentAfter: number | null;
    assetUsageReading: number | null;
    assetUsageMetric?: FuelUsageMetric | null;
    operatorName: string | null;
    activityText: string | null;
    workAreaText: string | null;
    note: string | null;
    latitude: number | null;
    longitude: number | null;
    locationText: string | null;
    clientEventId?: string | null;
    clientCapturedAt?: string | null;
    gpsAccuracyMeters?: number | null;
    sourceType?: string | null;
    sourceLabel?: string | null;
    fuelSlipId?: string | null;
    totalAmount?: number | null;
    documentFileUrl?: string | null;
    paymentMethod?: string | null;
    cardNumberMasked?: string | null;
    fieldManagerId?: string | null;
    fieldManagerDisplayName?: string | null;
    fieldManagerSessionId?: string | null;
    workUseExcluded?: boolean;
    workUseExclusionReason?: string | null;
  },
): Promise<FuelLedgerEvent> {
  const card = normalizeMaskedCard(input.cardNumberMasked, null);

  const inserted = await client.query<{ id: string }>(
    `
      insert into public.fuel_storage_events (
        storage_id,
        user_id,
        event_type,
        source_type,
        source_label,
        fuel_slip_id,
        total_amount,
        document_file_url,
        payment_method,
        card_number_masked,
        asset_register_item_id,
        litres,
        storage_level_before_litres,
        storage_level_after_litres,
        asset_fuel_percent_before,
        asset_fuel_percent_after,
        asset_usage_reading,
        operator_name,
        activity_text,
        work_area_text,
        note,
        latitude,
        longitude,
        location_text,
        client_event_id,
        client_captured_at,
        synced_at,
        gps_accuracy_meters,
        field_manager_id,
        field_manager_display_name,
        field_manager_session_id,
        work_use_excluded,
        work_use_exclusion_reason,
        asset_usage_metric,
        created_at
      )
      values ($1::uuid, $2, $3, $4, $5, $6::uuid, $7::numeric, $8, $9, $10, $11, $12::numeric, $13::numeric, $14::numeric, $15::integer, $16::integer, $17::numeric, $18, $19, $20, $21, $22::double precision, $23::double precision, $24, $25::text, $26::timestamptz, now(), $27::double precision, $28::uuid, $29::text, $30::text, $31::boolean, $32, $33, coalesce($26::timestamptz, now()))
      returning id::text
    `,
    [
      input.storageId,
      input.userId,
      input.eventType,
      input.sourceType ?? null,
      input.sourceLabel ?? null,
      input.fuelSlipId ?? null,
      input.totalAmount ?? null,
      input.documentFileUrl ?? null,
      input.paymentMethod ?? null,
      card.masked || null,
      input.assetId,
      input.litres,
      input.storageLevelBefore,
      input.storageLevelAfter,
      input.assetFuelPercentBefore,
      input.assetFuelPercentAfter,
      input.assetUsageReading,
      input.operatorName,
      input.activityText,
      input.workAreaText,
      input.note,
      input.latitude,
      input.longitude,
      input.locationText,
      input.clientEventId ?? null,
      input.clientCapturedAt ?? null,
      input.gpsAccuracyMeters ?? null,
      input.fieldManagerId ?? null,
      input.fieldManagerDisplayName ?? null,
      input.fieldManagerSessionId ?? null,
      Boolean(input.workUseExcluded),
      input.workUseExclusionReason ?? null,
      input.assetUsageMetric ?? null,
    ],
  );

  const eventId = inserted.rows[0]?.id;
  if (!eventId) {
    throw new Error('Failed to save fuel event.');
  }

  const hydrated = await client.query<FuelEventRow>(
    `
      select ${fuelEventSelectSql()}
      from public.fuel_storage_events e
      left join public.fuel_storage_units s on s.id = e.storage_id
      left join public.asset_register_items a on a.id::text = e.asset_register_item_id
      left join public.fuel_slips fs on fs.id = e.fuel_slip_id
      where e.id::text = $1
      limit 1
    `,
    [eventId],
  );

  const row = hydrated.rows[0];
  if (!row) {
    throw new Error('Failed to load fuel event.');
  }

  return mapFuelEventRow(row);
}

export async function recordFuelAssetIssue(
  input: {
    userId: string;
    storageId: string;
    assetId: string;
    litres?: unknown;
    assetFuelPercentBefore?: unknown;
    assetFuelPercentAfter?: unknown;
    assetUsageReading?: unknown;
    assetUsageMetric?: unknown;
    operatorName?: unknown;
    activityText?: unknown;
    workAreaText?: unknown;
    note?: unknown;
    latitude?: unknown;
    longitude?: unknown;
    locationText?: unknown;
    clientEventId?: unknown;
    clientCapturedAt?: unknown;
    gpsAccuracyMeters?: unknown;
    actorType?: FuelScanActorType;
    fieldManagerId?: unknown;
    fieldManagerDisplayName?: unknown;
    fieldManagerSessionId?: unknown;
  },
): Promise<{ storage: FuelLedgerStorage; event: FuelLedgerEvent; assets: FuelLedgerAsset[] }> {
  await ensureFuelLedgerTables();
  const db = getDb();
  const client = await db.connect();
  const litres = normalizePositiveLitres(input.litres);
  const assetFuelPercentBeforeInput = normalizeFuelPercent(input.assetFuelPercentBefore);
  const assetFuelPercentAfter = normalizeFuelPercent(input.assetFuelPercentAfter);
  const assetUsageReading = normalizeUsageReading(input.assetUsageReading);
  const latitude = normalizeCoordinate(input.latitude, 90);
  const longitude = normalizeCoordinate(input.longitude, 180);
  const operatorName = asText(input.operatorName).slice(0, 80);
  const activityText = asText(input.activityText).slice(0, 120);
  const workAreaText = asText(input.workAreaText).slice(0, 120);
  const actorType: FuelScanActorType = input.actorType === 'owner_session'
    ? 'owner_session'
    : input.actorType === 'field_manager'
      ? 'field_manager'
      : 'scan_pin';
  const fieldManagerId = actorType === 'field_manager' ? asText(input.fieldManagerId) || null : null;
  const fieldManagerDisplayName = actorType === 'field_manager' ? asText(input.fieldManagerDisplayName) || null : null;
  const fieldManagerSessionId = actorType === 'field_manager' ? asText(input.fieldManagerSessionId) || null : null;
  let committed = false;

  if (assetFuelPercentAfter === null) {
    throw new Error('Choose the asset fuel percentage after filling.');
  }

  if (operatorName.length < 2) {
    throw new Error('Enter the operator or manager name.');
  }

  if (actorType === 'scan_pin' && activityText.length < 2) {
    throw new Error('Enter what activity the asset will do.');
  }

  if (actorType === 'scan_pin' && workAreaText.length < 2) {
    throw new Error('Enter where the asset will work.');
  }

  if (latitude === null || longitude === null) {
    throw new Error('Location is required. Allow GPS access before saving the fuel entry.');
  }

  const locationText = asText(input.locationText) || `GPS ${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;
  const clientEventId = normalizeClientEventId(input.clientEventId);
  const clientCapturedAt = normalizeClientCapturedAt(input.clientCapturedAt);
  const gpsAccuracyMeters = normalizeGpsAccuracyMeters(input.gpsAccuracyMeters);

  try {
    await client.query('BEGIN');

    const storageResult = await client.query<FuelStorageRow>(
      `
        select ${fuelStorageSelectSql()}
        from public.fuel_storage_units
        where user_id = $1 and id::text = $2 and status = 'active'
        for update
      `,
      [input.userId, input.storageId],
    );
    const storage = storageResult.rows[0] ? mapStorageRow(storageResult.rows[0]) : null;

    if (!storage) {
      throw new Error('Fuel storage not found.');
    }

    if (clientEventId) {
      const existingEvent = await client.query<FuelEventRow>(
        `
          select ${fuelEventSelectSql()}
          from public.fuel_storage_events e
          left join public.fuel_storage_units s on s.id = e.storage_id
          left join public.asset_register_items a on a.id::text = e.asset_register_item_id
          left join public.fuel_slips fs on fs.id = e.fuel_slip_id
          where e.storage_id::text = $1 and e.client_event_id = $2
          order by e.created_at desc, e.id desc
          limit 1
        `,
        [input.storageId, clientEventId],
      );

      const duplicateEvent = existingEvent.rows[0];
      if (duplicateEvent) {
        await client.query('COMMIT');
        committed = true;
        const assets = await listFuelAssetsForUser(input.userId);
        return {
          storage,
          event: mapFuelEventRow(duplicateEvent),
          assets,
        };
      }
    }

    if (storage.currentLitres + 0.001 < litres) {
      throw new Error('Not enough fuel is available in this storage unit. Add stock or correct the storage level first.');
    }

    const assetResult = await client.query<FuelAssetRow & {
      valuation_run_id: string | number | null;
    }>(
      `
        select
          a.id::text,
          a.title,
          a.kind,
          a.brand_name,
          a.model_name,
          a.typed_model_name,
          coalesce(ef.family_label, '') as equipment_family_label,
          coalesce(to_jsonb(a)->>'serial_number', to_jsonb(a)->>'serialNumber', '') as serial_number,
          to_jsonb(a)->>'plate_label' as plate_label,
          to_jsonb(a)->>'public_asset_code' as public_asset_code,
          coalesce(nullif(lower(to_jsonb(a)->>'qr_status'), ''), 'active') as qr_status,
          a.hours,
          coalesce(to_jsonb(a)->>'life_worked_percent', to_jsonb(a)->'specs_json'->>'life_worked_percent', to_jsonb(a)->'specs_json'->>'lifeWorkedPercent') as life_worked_percent,
          to_jsonb(a)->>'fuel_percent' as fuel_percent,
          coalesce(to_jsonb(a)->>'year_model', to_jsonb(a)->>'yearModel', to_jsonb(a)->>'year') as year_model,
          coalesce(to_jsonb(a)->>'condition', '') as condition,
          coalesce(to_jsonb(a)->>'selected_method', to_jsonb(a)->>'selectedMethod', to_jsonb(a)->>'method', '') as selected_method,
          coalesce(to_jsonb(a)->>'current_value', to_jsonb(a)->>'currentValue', to_jsonb(a)->>'selected_value_ex_vat', to_jsonb(a)->>'selectedValueExVat', to_jsonb(a)->>'selected_value', to_jsonb(a)->>'value', to_jsonb(a)->>'opening_value') as current_value,
          ef.is_propelled as family_is_propelled,
          a.valuation_run_id,
          coalesce(a.specs_json, '{}'::jsonb) as specs_json
        from public.asset_register_items a
        left join public.valuation_runs vr on vr.id = a.valuation_run_id
        left join public.equipment_families ef on ef.id = coalesce(a.equipment_family_id, vr.equipment_family_id)
        where a.user_id = $1 and a.id::text = $2
        for update of a
      `,
      [input.userId, input.assetId],
    );

    const assetRow = assetResult.rows[0];
    if (!assetRow) {
      throw new Error('Asset not found.');
    }
    const asset = mapFuelAssetRow(assetRow);
    const assetWorkUse = await getFuelAssetWorkUseExclusion(client, input.userId, input.assetId);
    assertFuelAssetAvailableForEntry(asset, assetWorkUse);

    const requestedUsageMetric = asText(input.assetUsageMetric)
      ? normalizeFuelUsageMetric(input.assetUsageMetric)
      : assetUsageReading === null
        ? 'none'
        : canonicalFuelIssueUsageMetric(asset);
    if (!usageMetricAllowedForAsset(asset.usageMetric, requestedUsageMetric)) {
      throw new Error(`The selected usage metric does not match this asset's saved usage metric (${asset.usageMetric}).`);
    }
    if (requestedUsageMetric === 'percentage') {
      throw new Error('Fuel scans only accept hour or kilometre meter readings. Update lifetime percentage from the asset QR scan.');
    }
    if (requestedUsageMetric === 'none' && assetUsageReading !== null) {
      throw new Error('Choose a usage metric for the meter reading, or remove the reading.');
    }
    if (requestedUsageMetric !== 'none' && assetUsageReading === null) {
      throw new Error(`Enter the current ${requestedUsageMetric === 'km' ? 'kilometre' : requestedUsageMetric === 'hours' ? 'hour' : 'percentage'} reading, or choose no meter reading.`);
    }

    const currentUsageReading = normalizeUsageReading(assetRow.hours);
    if (assetUsageReading !== null && currentUsageReading !== null && assetUsageReading < currentUsageReading) {
      throw new Error('The usage reading cannot be lower than the reading already saved on this asset.');
    }

    const usageReadingChanged = assetUsageReading !== null && assetUsageReading !== currentUsageReading;
    const shouldMarkValuationNeedsUpdate = usageReadingChanged && hasSavedFuelAssetValuation(assetRow);
    const nextSpecsJson = shouldMarkValuationNeedsUpdate
      ? markFuelAssetValuationNeedsUpdate(asRecord(assetRow.specs_json), ['usage changed'])
      : asRecord(assetRow.specs_json);

    const storageBefore = storage.currentLitres;
    const storageAfter = roundLitres(storageBefore - litres);
    const assetFuelPercentBefore = assetFuelPercentBeforeInput ?? normalizeFuelPercent(assetRow.fuel_percent);
    const noteText = asText(input.note);
    const storageNote = `Fuel issued from ${storage.name}: ${litres.toLocaleString('en-ZA', { maximumFractionDigits: 3 })} litres.`;
    const eventNote = [storageNote, noteText].filter(Boolean).join('\n\n');

    await client.query(
      `
        update public.fuel_storage_units
        set current_litres = $3::numeric, updated_at = now()
        where user_id = $1 and id::text = $2
      `,
      [input.userId, input.storageId, storageAfter],
    );

    const event = await insertFuelStorageEvent(client, {
      storageId: input.storageId,
      userId: input.userId,
      eventType: 'asset_issue',
      assetId: input.assetId,
      litres,
      storageLevelBefore: storageBefore,
      storageLevelAfter: storageAfter,
      assetFuelPercentBefore,
      assetFuelPercentAfter,
      assetUsageReading,
      assetUsageMetric: requestedUsageMetric,
      operatorName,
      activityText: activityText || null,
      workAreaText: workAreaText || null,
      note: eventNote,
      latitude,
      longitude,
      locationText,
      clientEventId,
      clientCapturedAt,
      gpsAccuracyMeters,
      fieldManagerId,
      fieldManagerDisplayName,
      fieldManagerSessionId,
      workUseExcluded: assetWorkUse.excluded,
      workUseExclusionReason: assetWorkUse.reason || null,
    });

    await client.query(
      `
        update public.asset_register_items
        set
          fuel_percent = $3::integer,
          hours = case when $4::numeric is null then hours else $4::numeric end,
          last_scanned_at = coalesce($9::timestamptz, now()),
          last_known_lat = $5::double precision,
          last_known_lng = $6::double precision,
          last_known_location_text = $7,
          specs_json = $8::jsonb,
          updated_at = now()
        where user_id = $1 and id::text = $2
      `,
      [input.userId, input.assetId, assetFuelPercentAfter, assetUsageReading, latitude, longitude, locationText, JSON.stringify(nextSpecsJson), clientCapturedAt],
    );

    await client.query(
      `
        insert into public.asset_scan_events (
          asset_id,
          actor_type,
          operator_name,
          activity_text,
          work_area_text,
          hours,
          fuel_percent,
          fuel_litres,
          fuel_storage_id,
          fuel_storage_event_id,
          condition,
          note,
          photo_urls,
          latitude,
          longitude,
          location_text,
          client_event_id,
          client_captured_at,
          synced_at,
          gps_accuracy_meters,
          field_manager_id,
          field_manager_display_name,
          field_manager_session_id,
          asset_usage_reading,
          asset_usage_metric,
          source_type,
          source_label,
          entry_added_at,
          created_at
        )
        values ($1::uuid, $2, $3, $4, $5, $6::numeric, $7::integer, $8::numeric, $9::uuid, $10::uuid, null, $11, '[]'::jsonb, $12::double precision, $13::double precision, $14, $15::text, $16::timestamptz, now(), $17::double precision, $18::uuid, $19::text, $20::text, $6::numeric, $21, 'fuel_storage_issue', 'Fuel Storage QR', now(), coalesce($16::timestamptz, now()))
      `,
      [
        input.assetId,
        actorType,
        operatorName,
        activityText || null,
        workAreaText || null,
        assetUsageReading,
        assetFuelPercentAfter,
        litres,
        input.storageId,
        event.id,
        eventNote,
        latitude,
        longitude,
        locationText,
        clientEventId,
        clientCapturedAt,
        gpsAccuracyMeters,
        fieldManagerId,
        fieldManagerDisplayName,
        fieldManagerSessionId,
        requestedUsageMetric,
      ],
    );

    const updatedStorageResult = await client.query<FuelStorageRow>(
      `
        select ${fuelStorageSelectSql()}
        from public.fuel_storage_units
        where user_id = $1 and id::text = $2
        limit 1
      `,
      [input.userId, input.storageId],
    );

    await client.query('COMMIT');
    committed = true;


    const assets = await listFuelAssetsForUser(input.userId);

    return {
      storage: mapStorageRow(updatedStorageResult.rows[0]),
      event,
      assets,
    };
  } catch (error) {
    if (!committed) {
      await client.query('ROLLBACK');
    }
    throw error;
  } finally {
    client.release();
  }
}

const LATE_ENTRY_EVIDENCE_TYPES = new Set([
  'handwritten_dispensing_sheet',
  'pump_or_meter_record',
  'supplier_slip_or_invoice',
  'operator_confirmation',
  'other_supporting_record',
  'no_supporting_record',
]);
const LATE_ENTRY_EVIDENCE_MIME_TYPES = new Set(['application/pdf', 'image/jpeg', 'image/png', 'image/webp']);
const LATE_ENTRY_EVIDENCE_EXTENSIONS = new Set(['.pdf', '.jpg', '.jpeg', '.png', '.webp']);
const MAX_LATE_ENTRY_EVIDENCE_BYTES = 12 * 1024 * 1024;

function normalizeLateEntryEvidenceType(value: unknown): string {
  const normalized = asText(value).toLowerCase().replace(/[\s-]+/g, '_');
  if (!normalized) return 'no_supporting_record';
  if (!LATE_ENTRY_EVIDENCE_TYPES.has(normalized)) throw new Error('Choose a valid supporting-evidence type.');
  return normalized;
}

function sanitizeLateEntryEvidenceFileName(value: unknown): string {
  return (asText(value).replace(/[\\/\0\r\n]+/g, ' ').replace(/\s+/g, ' ') || 'fuel-entry-evidence').slice(0, 180);
}

function lateEntryEvidenceExtension(value: unknown): string {
  const fileName = asText(value).toLowerCase();
  const dotIndex = fileName.lastIndexOf('.');
  return dotIndex >= 0 ? fileName.slice(dotIndex) : '';
}

async function normalizeLateEntryEvidenceFile(file: File | null | undefined): Promise<{
  fileName: string;
  contentType: string;
  byteSize: number;
  data: Buffer;
} | null> {
  if (!file) return null;

  const fileName = sanitizeLateEntryEvidenceFileName(file.name);
  const contentType = asText(file.type).toLowerCase();
  const extension = lateEntryEvidenceExtension(fileName);
  const byteSize = Number(file.size) || 0;

  if (!LATE_ENTRY_EVIDENCE_EXTENSIONS.has(extension)) {
    throw new Error('Supporting evidence must be a PDF, JPG, PNG or WEBP file.');
  }
  const expectedContentType = extension === '.pdf'
    ? 'application/pdf'
    : extension === '.png'
      ? 'image/png'
      : extension === '.webp'
        ? 'image/webp'
        : 'image/jpeg';
  if (contentType && contentType !== 'application/octet-stream' && !LATE_ENTRY_EVIDENCE_MIME_TYPES.has(contentType)) {
    throw new Error('Supporting evidence must be a PDF, JPG, PNG or WEBP file.');
  }
  if (contentType && contentType !== 'application/octet-stream' && contentType !== expectedContentType) {
    throw new Error('The supporting-evidence file extension does not match its file type.');
  }
  if (!byteSize) throw new Error('The supporting evidence file is empty.');
  if (byteSize > MAX_LATE_ENTRY_EVIDENCE_BYTES) throw new Error('Supporting evidence must be 12 MB or smaller.');

  const data = Buffer.from(await file.arrayBuffer());
  const hasExpectedSignature = expectedContentType === 'application/pdf'
    ? data.subarray(0, 5).toString('ascii') === '%PDF-'
    : expectedContentType === 'image/png'
      ? data.length >= 8 && data.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
      : expectedContentType === 'image/webp'
        ? data.length >= 12 && data.subarray(0, 4).toString('ascii') === 'RIFF' && data.subarray(8, 12).toString('ascii') === 'WEBP'
        : data.length >= 3 && data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff;

  if (!hasExpectedSignature) {
    throw new Error('The supporting-evidence file content does not match its PDF or image format.');
  }

  return {
    fileName,
    contentType: expectedContentType,
    byteSize,
    data,
  };
}

async function hydrateFuelStorageEvent(client: PoolClient, eventId: string): Promise<FuelLedgerEvent> {
  const result = await client.query<FuelEventRow>(
    `
      select ${fuelEventSelectSql()}
      from public.fuel_storage_events e
      left join public.fuel_storage_units s on s.id = e.storage_id
      left join public.asset_register_items a on a.id::text = e.asset_register_item_id
      left join public.fuel_slips fs on fs.id = e.fuel_slip_id
      where e.id::text = $1
      limit 1
    `,
    [eventId],
  );
  if (!result.rows[0]) throw new Error('Failed to load the saved fuel event.');
  return mapFuelEventRow(result.rows[0]);
}

function validateLateEntryActivity(value: unknown): string {
  const activity = asText(value).replace(/\s+/g, ' ').slice(0, 160);
  const vague = new Set(['work', 'other', 'general', 'fuel', 'activity', 'n/a', 'na', 'none']);
  if (activity.length < 3 || vague.has(activity.toLowerCase())) {
    throw new Error('Enter the specific activity the fuel was used for.');
  }
  return activity;
}

function usageMetricAllowedForAsset(assetMetric: FuelLedgerAsset['usageMetric'], selectedMetric: FuelUsageMetric): boolean {
  if (selectedMetric === 'none') return true;
  if (assetMetric === 'both') return selectedMetric === 'hours' || selectedMetric === 'km';
  return assetMetric === selectedMetric;
}

function canonicalFuelIssueUsageMetric(asset: FuelLedgerAsset): FuelUsageMetric {
  if (asset.usageMetric === 'both') return asset.kind === 'vehicle' ? 'km' : 'hours';
  return asset.usageMetric;
}

function normalizeLateEntryUsageReading(metric: FuelUsageMetric, value: unknown): number | null {
  if (metric === 'none') return null;
  const reading = parseFuelSlipDecimal(value, 2);
  if (reading === null || reading < 0) {
    throw new Error(`Enter the historical ${metric === 'km' ? 'kilometre' : metric === 'hours' ? 'hour' : 'percentage'} reading or choose No meter / Not recorded.`);
  }
  if (metric === 'percentage' && reading > 100) throw new Error('Percentage usage must be between 0 and 100.');
  return Math.round(reading * 100) / 100;
}

function normalizeRequiredLateEntryFuelPercent(value: unknown, label: 'before' | 'after'): number {
  const parsed = parseFuelSlipDecimal(value, 2);
  if (parsed === null || parsed < 0 || parsed > 100) {
    throw new Error(`Fuel percentage ${label} must be between 0 and 100.`);
  }
  return Math.round(parsed);
}

function normalizeMeasuredCurrentLitres(value: unknown): number {
  const parsed = asNumber(value);
  if (parsed === null || parsed < 0) throw new Error('Enter the physically measured current litres.');
  return roundLitres(parsed);
}

async function validateChronologicalLateEntryUsage(
  client: PoolClient,
  input: { userId: string; assetId: string; issueDate: string; issueAtIso: string; issueTimeRecorded: boolean; usageMetric: FuelUsageMetric; usageReading: number | null },
): Promise<void> {
  if (input.usageMetric === 'none' || input.usageMetric === 'percentage' || input.usageReading === null) return;

  const result = await client.query<{ relation: 'previous' | 'next'; reading: string | number | null; event_date: string | null }>(
    `
      with readings as (
        select
          asset_usage_reading,
          coalesce(issue_date, (created_at at time zone 'Africa/Johannesburg')::date) as event_date,
          coalesce(issue_at, created_at) as event_at,
          asset_usage_metric
        from public.fuel_storage_events
        where user_id = $1
          and asset_register_item_id = $2
          and event_type = 'asset_issue'
          and asset_usage_reading is not null
          and coalesce(asset_usage_metric, $4) = $4
      ), previous_reading as (
        select 'previous'::text as relation, asset_usage_reading as reading, event_date::text
        from readings
        where (event_date < $3::date)
           or ($5::boolean and event_date = $3::date and event_at < $6::timestamptz)
        order by event_date desc, event_at desc
        limit 1
      ), next_reading as (
        select 'next'::text as relation, asset_usage_reading as reading, event_date::text
        from readings
        where (event_date > $3::date)
           or ($5::boolean and event_date = $3::date and event_at > $6::timestamptz)
        order by event_date asc, event_at asc
        limit 1
      )
      select relation, reading, event_date from previous_reading
      union all
      select relation, reading, event_date from next_reading
    `,
    [input.userId, input.assetId, input.issueDate, input.usageMetric, input.issueTimeRecorded, input.issueAtIso],
  );

  for (const row of result.rows) {
    const reading = normalizeUsageReading(row.reading);
    if (reading === null) continue;
    if (row.relation === 'previous' && input.usageReading < reading) {
      throw new Error(`The historical usage reading is lower than the nearest earlier fuel reading (${reading.toLocaleString('en-ZA')}).`);
    }
    if (row.relation === 'next' && input.usageReading > reading) {
      throw new Error(`The historical usage reading is higher than the nearest later fuel reading (${reading.toLocaleString('en-ZA')}).`);
    }
  }
}

export type RecordMissingFuelAssetIssueInput = {
  userId: string;
  addedByName?: unknown;
  addedByEmail?: unknown;
  storageId: string;
  assetId?: unknown;
  issueDate?: unknown;
  issueTime?: unknown;
  issueTimeRecorded?: unknown;
  usageMetric?: unknown;
  usageReading?: unknown;
  assetFuelPercentBefore?: unknown;
  assetFuelPercentAfter?: unknown;
  litres?: unknown;
  operatorName?: unknown;
  activityText?: unknown;
  workAreaText?: unknown;
  lateEntryReason?: unknown;
  note?: unknown;
  evidenceType?: unknown;
  evidenceReference?: unknown;
  evidenceFile?: File | null;
  tankBalanceTreatment?: unknown;
  idempotencyKey?: unknown;
};

export async function recordMissingFuelAssetIssue(
  input: RecordMissingFuelAssetIssueInput,
): Promise<{ storage: FuelLedgerStorage; event: FuelLedgerEvent; adjustmentEvent: FuelLedgerEvent | null }> {
  await ensureFuelLedgerTables();

  const userId = asText(input.userId);
  const storageId = asText(input.storageId);
  const assetId = asText(input.assetId);
  const issueDate = normalizeHistoricalIssueDate(input.issueDate);
  const issueTime = normalizeHistoricalIssueTime(input.issueTime, input.issueTimeRecorded);
  const issueAtIso = buildJohannesburgIssueIso(issueDate, issueTime.time);
  if (issueTime.recorded && new Date(issueAtIso).getTime() > Date.now()) {
    throw new Error('Fuel issue date and time cannot be in the future.');
  }
  const usageMetric = normalizeFuelUsageMetric(input.usageMetric);
  const usageReading = normalizeLateEntryUsageReading(usageMetric, input.usageReading);
  const litres = normalizePositiveLitres(input.litres);
  const fuelPercentBefore = normalizeRequiredLateEntryFuelPercent(input.assetFuelPercentBefore, 'before');
  const fuelPercentAfter = normalizeRequiredLateEntryFuelPercent(input.assetFuelPercentAfter, 'after');
  const operatorName = asText(input.operatorName).replace(/\s+/g, ' ').slice(0, 100);
  const activityText = validateLateEntryActivity(input.activityText);
  const requestedWorkAreaText = asText(input.workAreaText).replace(/\s+/g, ' ').slice(0, 180);
  const lateEntryReason = asText(input.lateEntryReason).replace(/\s+/g, ' ').slice(0, 500);
  const note = asText(input.note).slice(0, 2000);
  const evidenceType = normalizeLateEntryEvidenceType(input.evidenceType);
  const evidenceReference = asText(input.evidenceReference).slice(0, 240);
  const evidenceFile = await normalizeLateEntryEvidenceFile(input.evidenceFile);
  const evidenceStatus: FuelEvidenceStatus = evidenceFile || evidenceReference
    ? 'evidence_supplied_review_required'
    : 'internal_record_only';
  const tankBalanceTreatment = normalizeFuelTankBalanceTreatment(input.tankBalanceTreatment);
  const idempotencyKey = normalizeClientEventId(input.idempotencyKey);
  const addedByName = asText(input.addedByName).slice(0, 160);
  const addedByEmail = asText(input.addedByEmail).slice(0, 240);

  if (!userId) throw new Error('A signed-in owner session is required.');
  if (!storageId) throw new Error('Fuel storage is required.');
  if (!assetId) throw new Error('Choose the asset that received the fuel.');
  if (!idempotencyKey) throw new Error('A valid idempotency key is required. Refresh the page and try again.');
  if (fuelPercentAfter < fuelPercentBefore) throw new Error('Fuel percentage after cannot be lower than fuel percentage before.');
  if (operatorName.length < 2) throw new Error('Enter the operator or manager name.');
  if (evidenceType === 'no_supporting_record' && (evidenceFile || evidenceReference)) {
    throw new Error('Choose the correct evidence type for the supporting file or reference.');
  }

  const db = getDb();
  const client = await db.connect();
  let committed = false;

  try {
    await client.query('BEGIN');

    const storageResult = await client.query<FuelStorageRow>(
      `select ${fuelStorageSelectSql()} from public.fuel_storage_units where user_id = $1 and id::text = $2 and status = 'active' for update`,
      [userId, storageId],
    );
    const storage = storageResult.rows[0] ? mapStorageRow(storageResult.rows[0]) : null;
    if (!storage) throw new Error('Fuel storage not found.');
    const workAreaText = requestedWorkAreaText || 'Main diesel tank';

    const duplicate = await client.query<{ id: string }>(
      `select id::text from public.fuel_storage_events where user_id = $1 and idempotency_key = $2 limit 1`,
      [userId, idempotencyKey],
    );
    if (duplicate.rows[0]?.id) {
      const event = await hydrateFuelStorageEvent(client, duplicate.rows[0].id);
      if (!event.isLateEntry || event.storageId !== storageId || event.assetId !== assetId) {
        throw new Error('This idempotency key has already been used for a different fuel event. Refresh the page and try again.');
      }
      const adjustmentEvent = event.linkedAdjustmentEventId ? await hydrateFuelStorageEvent(client, event.linkedAdjustmentEventId) : null;
      await client.query('COMMIT');
      committed = true;
      return { storage, event, adjustmentEvent };
    }

    const assetResult = await client.query<FuelAssetRow>(
      `
        select
          a.id::text, a.title, a.kind, a.brand_name, a.model_name, a.typed_model_name,
          coalesce(ef.family_label, '') as equipment_family_label,
          coalesce(to_jsonb(a)->>'serial_number', to_jsonb(a)->>'serialNumber', '') as serial_number,
          to_jsonb(a)->>'plate_label' as plate_label,
          to_jsonb(a)->>'public_asset_code' as public_asset_code,
          coalesce(nullif(lower(to_jsonb(a)->>'qr_status'), ''), 'active') as qr_status,
          a.hours,
          coalesce(to_jsonb(a)->>'life_worked_percent', to_jsonb(a)->'specs_json'->>'life_worked_percent', to_jsonb(a)->'specs_json'->>'lifeWorkedPercent') as life_worked_percent,
          to_jsonb(a)->>'fuel_percent' as fuel_percent,
          coalesce(to_jsonb(a)->>'year_model', to_jsonb(a)->>'yearModel', to_jsonb(a)->>'year') as year_model,
          coalesce(to_jsonb(a)->>'condition', '') as condition,
          coalesce(to_jsonb(a)->>'selected_method', to_jsonb(a)->>'selectedMethod', to_jsonb(a)->>'method', '') as selected_method,
          coalesce(to_jsonb(a)->>'current_value', to_jsonb(a)->>'currentValue', to_jsonb(a)->>'selected_value_ex_vat', to_jsonb(a)->>'selectedValueExVat', to_jsonb(a)->>'selected_value', to_jsonb(a)->>'value', to_jsonb(a)->>'opening_value') as current_value,
          ef.is_propelled as family_is_propelled,
          coalesce(a.specs_json, '{}'::jsonb) as specs_json
        from public.asset_register_items a
        left join public.valuation_runs vr on vr.id = a.valuation_run_id
        left join public.equipment_families ef on ef.id = coalesce(a.equipment_family_id, vr.equipment_family_id)
        where a.user_id = $1
          and a.id::text = $2
          and coalesce(nullif(lower(to_jsonb(a)->>'qr_status'), ''), 'active') = 'active'
        for update of a
      `,
      [userId, assetId],
    );
    const asset = assetResult.rows[0] ? mapFuelAssetRow(assetResult.rows[0]) : null;
    if (!asset) throw new Error('Asset not found or is no longer active.');
    const assetWorkUse = await getFuelAssetWorkUseExclusion(client, userId, assetId);
    assertFuelAssetAvailableForEntry(asset, assetWorkUse);
    if (!usageMetricAllowedForAsset(asset.usageMetric, usageMetric)) {
      throw new Error(`The selected usage metric does not match this asset's saved usage metric (${asset.usageMetric}).`);
    }

    await validateChronologicalLateEntryUsage(client, {
      userId,
      assetId,
      issueDate,
      issueAtIso,
      issueTimeRecorded: issueTime.recorded,
      usageMetric,
      usageReading,
    });

    if (tankBalanceTreatment === 'not_yet_reflected' && storage.currentLitres + 0.0001 < litres) {
      throw new Error('The current recorded tank stock is not enough for this deduction. Choose I’m not sure and reconcile the tank physically.');
    }

    const eventInsert = await client.query<{ id: string }>(
      `
        insert into public.fuel_storage_events (
          storage_id, user_id, event_type, source_type, source_label, asset_register_item_id, litres,
          storage_level_before_litres, storage_level_after_litres,
          asset_fuel_percent_before, asset_fuel_percent_after, asset_usage_reading, asset_usage_metric,
          operator_name, activity_text, work_area_text, note, latitude, longitude, location_text,
          client_event_id, idempotency_key, is_late_entry, issue_date, issue_time, issue_time_recorded, issue_at,
          entry_added_at, added_by_user_id, added_by_name, added_by_email, late_entry_reason,
          evidence_type, evidence_reference, evidence_status, tank_balance_treatment, gps_capture_status,
          work_use_excluded, work_use_exclusion_reason, created_at
        )
        values (
          $1::uuid, $2, 'asset_issue', 'desktop_late_entry', 'Late Entry', $3, $4::numeric,
          null, null, $5::integer, $6::integer, $7::numeric, $8,
          $9, $10, $11, $12, null, null, $11,
          $13, $13, true, $14::date, $15::time, $16::boolean, $17::timestamptz,
          now(), $2, $18, $19, $20, $21, $22, $23, $24, 'not_captured_desktop_late_entry',
          $25::boolean, $26, $17::timestamptz
        )
        returning id::text
      `,
      [
        storageId, userId, assetId, litres, fuelPercentBefore, fuelPercentAfter, usageReading, usageMetric,
        operatorName, activityText, workAreaText, note || null, idempotencyKey, issueDate, issueTime.time,
        issueTime.recorded, issueAtIso, addedByName || null, addedByEmail || null, lateEntryReason || null,
        evidenceType, evidenceReference || null, evidenceStatus, tankBalanceTreatment,
        assetWorkUse.excluded, assetWorkUse.reason || null,
      ],
    );
    const eventId = eventInsert.rows[0]?.id;
    if (!eventId) throw new Error('Failed to save the missing fuel entry.');

    if (evidenceFile) {
      const evidenceInsert = await client.query<{ id: string }>(
        `
          insert into public.fuel_late_entry_evidence (user_id, fuel_storage_event_id, file_name, content_type, byte_size, data)
          values ($1, $2::uuid, $3, $4, $5::integer, $6::bytea)
          returning id::text
        `,
        [userId, eventId, evidenceFile.fileName, evidenceFile.contentType, evidenceFile.byteSize, evidenceFile.data],
      );
      const evidenceId = evidenceInsert.rows[0]?.id;
      if (!evidenceId) throw new Error('Failed to save the supporting evidence.');
      await client.query(`update public.fuel_storage_events set evidence_id = $2::uuid where id::text = $1 and user_id = $3`, [eventId, evidenceId, userId]);
    }

    await client.query(
      `
        insert into public.asset_scan_events (
          asset_id, actor_type, operator_name, activity_text, work_area_text, hours, fuel_percent,
          fuel_litres, fuel_storage_id, fuel_storage_event_id, condition, note, photo_urls,
          latitude, longitude, location_text, client_event_id, client_captured_at, synced_at,
          source_type, source_label, issue_date, issue_time, issue_time_recorded,
          asset_usage_reading, asset_usage_metric, entry_added_at, added_by_user_id, created_at
        )
        values (
          $1::uuid, 'owner_session', $2, $3, $4,
          case when $5 in ('hours', 'km') then $6::numeric else null end,
          $7::integer, $8::numeric, $9::uuid, $10::uuid, null, $11, '[]'::jsonb,
          null, null, $4, $12, $13::timestamptz, now(),
          'desktop_late_entry', 'Late Entry', $14::date, $15, $16::boolean,
          $6::numeric, $5, now(), $17, $13::timestamptz
        )
      `,
      [
        assetId, operatorName, activityText, workAreaText, usageMetric, usageReading, fuelPercentAfter,
        litres, storageId, eventId, note || null, `late-entry:${idempotencyKey}`, issueAtIso,
        issueDate, issueTime.time, issueTime.recorded, userId,
      ],
    );

    let adjustmentEventId = '';
    if (tankBalanceTreatment === 'not_yet_reflected') {
      const storageAfter = roundLitres(storage.currentLitres - litres);
      await client.query(`update public.fuel_storage_units set current_litres = $3::numeric, updated_at = now() where user_id = $1 and id::text = $2`, [userId, storageId, storageAfter]);
      const adjustmentInsert = await client.query<{ id: string }>(
        `
          insert into public.fuel_storage_events (
            storage_id, user_id, event_type, source_type, source_label, litres,
            storage_level_before_litres, storage_level_after_litres, operator_name, note,
            linked_missing_entry_event_id, adjustment_kind, idempotency_key,
            issue_date, issue_time, issue_time_recorded, issue_at, entry_added_at,
            added_by_user_id, added_by_name, added_by_email, gps_capture_status, created_at
          )
          values (
            $1::uuid, $2, 'adjustment', 'late_entry_balance_adjustment', 'Late Entry Balance Adjustment', $3::numeric,
            $4::numeric, $5::numeric, $6, $7, $8::uuid, 'late_entry_balance_correction', $9,
            (now() at time zone 'Africa/Johannesburg')::date, (now() at time zone 'Africa/Johannesburg')::time,
            true, now(), now(), $2, $10, $11, 'not_applicable', now()
          )
          returning id::text
        `,
        [
          storageId, userId, litres, storage.currentLitres, storageAfter, addedByName || operatorName,
          `Current book balance corrected for late fuel entry ${eventId}. This adjustment is not an additional fuel issue.`,
          eventId, `${idempotencyKey}:balance-adjustment`, addedByName || null, addedByEmail || null,
        ],
      );
      adjustmentEventId = adjustmentInsert.rows[0]?.id ?? '';
      if (!adjustmentEventId) throw new Error('Failed to save the linked current-balance adjustment.');
      await client.query(`update public.fuel_storage_events set linked_adjustment_event_id = $2::uuid where id::text = $1 and user_id = $3`, [eventId, adjustmentEventId, userId]);
    } else if (tankBalanceTreatment === 'not_sure') {
      await client.query(
        `
          update public.fuel_storage_units
          set balance_verification_status = 'needs_check',
              balance_check_reason = $3,
              balance_check_source_event_id = $4::uuid,
              balance_check_marked_at = now(),
              updated_at = now()
          where user_id = $1 and id::text = $2
        `,
        [userId, storageId, `Balance needs checking after late fuel entry for ${asset.title}.`, eventId],
      );
    }

    const updatedStorageResult = await client.query<FuelStorageRow>(
      `select ${fuelStorageSelectSql()} from public.fuel_storage_units where user_id = $1 and id::text = $2 limit 1`,
      [userId, storageId],
    );
    const event = await hydrateFuelStorageEvent(client, eventId);
    const adjustmentEvent = adjustmentEventId ? await hydrateFuelStorageEvent(client, adjustmentEventId) : null;

    await client.query('COMMIT');
    committed = true;

    return {
      storage: mapStorageRow(updatedStorageResult.rows[0]),
      event,
      adjustmentEvent,
    };
  } catch (error) {
    if (!committed) await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export type ReconcileFuelStorageBalanceInput = {
  userId: string;
  storageId: string;
  currentLitres?: unknown;
  measurementDate?: unknown;
  measurementTime?: unknown;
  note?: unknown;
  addedByName?: unknown;
  addedByEmail?: unknown;
  idempotencyKey?: unknown;
};

export async function reconcileFuelStorageBalance(
  input: ReconcileFuelStorageBalanceInput,
): Promise<{ storage: FuelLedgerStorage; event: FuelLedgerEvent }> {
  await ensureFuelLedgerTables();
  const userId = asText(input.userId);
  const storageId = asText(input.storageId);
  const currentLitres = normalizeMeasuredCurrentLitres(input.currentLitres);
  const measurementDate = normalizeHistoricalIssueDate(input.measurementDate);
  const measurementTimeText = asText(input.measurementTime);
  const measurementTime = normalizeHistoricalIssueTime(measurementTimeText, true);
  if (!measurementTime.recorded || !measurementTime.time) throw new Error('Enter the physical measurement time.');
  const measuredAtIso = buildJohannesburgIssueIso(measurementDate, measurementTime.time);
  if (new Date(measuredAtIso).getTime() > Date.now()) throw new Error('Measurement date and time cannot be in the future.');
  const note = asText(input.note).slice(0, 1000);
  const addedByName = asText(input.addedByName).slice(0, 160);
  const addedByEmail = asText(input.addedByEmail).slice(0, 240);
  const idempotencyKey = normalizeClientEventId(input.idempotencyKey);
  if (!userId || !storageId || !idempotencyKey) throw new Error('A valid signed-in reconciliation request is required.');

  const db = getDb();
  const client = await db.connect();
  let committed = false;
  try {
    await client.query('BEGIN');
    const storageResult = await client.query<FuelStorageRow>(
      `select ${fuelStorageSelectSql()} from public.fuel_storage_units where user_id = $1 and id::text = $2 and status = 'active' for update`,
      [userId, storageId],
    );
    const storage = storageResult.rows[0] ? mapStorageRow(storageResult.rows[0]) : null;
    if (!storage) throw new Error('Fuel storage not found.');

    const duplicate = await client.query<{ id: string }>(`select id::text from public.fuel_storage_events where user_id = $1 and idempotency_key = $2 limit 1`, [userId, idempotencyKey]);
    if (duplicate.rows[0]?.id) {
      const event = await hydrateFuelStorageEvent(client, duplicate.rows[0].id);
      if (event.storageId !== storageId || event.adjustmentKind !== 'balance_reconciliation') {
        throw new Error('This idempotency key has already been used for a different fuel event. Refresh the page and try again.');
      }
      await client.query('COMMIT');
      committed = true;
      return { storage, event };
    }

    if (!storage.balanceNeedsChecking) throw new Error('This tank is not currently flagged for reconciliation.');
    if (storage.capacityLitres !== null && currentLitres > storage.capacityLitres + 0.001) {
      throw new Error(`Measured litres cannot exceed the fixed tank capacity of ${storage.capacityLitres.toLocaleString('en-ZA')} L.`);
    }

    const linkedMissingEventId = storage.balanceCheckSourceEventId || null;
    const difference = roundLitres(Math.abs(currentLitres - storage.currentLitres));
    const inserted = await client.query<{ id: string }>(
      `
        insert into public.fuel_storage_events (
          storage_id, user_id, event_type, source_type, source_label, litres,
          storage_level_before_litres, storage_level_after_litres, operator_name, note,
          linked_missing_entry_event_id, adjustment_kind, idempotency_key,
          issue_date, issue_time, issue_time_recorded, issue_at, entry_added_at,
          added_by_user_id, added_by_name, added_by_email, gps_capture_status, created_at
        )
        values (
          $1::uuid, $2, 'adjustment', 'balance_reconciliation', 'Balance Reconciliation', $3::numeric,
          $4::numeric, $5::numeric, $6, $7, $8::uuid, 'balance_reconciliation', $9,
          $10::date, $11::time, true, $12::timestamptz, now(), $2, $6, $13, 'not_applicable', $12::timestamptz
        )
        returning id::text
      `,
      [
        storageId, userId, difference, storage.currentLitres, currentLitres, addedByName || 'Owner reconciliation',
        note || 'Physical tank balance reconciliation.', linkedMissingEventId, idempotencyKey,
        measurementDate, measurementTime.time, measuredAtIso, addedByEmail || null,
      ],
    );
    const eventId = inserted.rows[0]?.id;
    if (!eventId) throw new Error('Failed to save the tank reconciliation.');

    await client.query(
      `
        update public.fuel_storage_units
        set current_litres = $3::numeric,
            balance_verification_status = 'verified',
            balance_check_reason = null,
            balance_check_source_event_id = null,
            balance_check_marked_at = null,
            updated_at = now()
        where user_id = $1 and id::text = $2
      `,
      [userId, storageId, currentLitres],
    );

    const updatedStorageResult = await client.query<FuelStorageRow>(`select ${fuelStorageSelectSql()} from public.fuel_storage_units where user_id = $1 and id::text = $2 limit 1`, [userId, storageId]);
    const event = await hydrateFuelStorageEvent(client, eventId);
    await client.query('COMMIT');
    committed = true;
    return { storage: mapStorageRow(updatedStorageResult.rows[0]), event };
  } catch (error) {
    if (!committed) await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export type FuelLateEntryEvidenceFile = {
  data: Buffer;
  fileName: string;
  contentType: string;
  byteSize: number;
};

export async function getFuelLateEntryEvidence(userId: string, eventId: string): Promise<FuelLateEntryEvidenceFile | null> {
  await ensureFuelLedgerTables();
  const result = await getDb().query<{
    data: Buffer | Uint8Array | string | null;
    file_name: string | null;
    content_type: string | null;
    byte_size: string | number | null;
  }>(
    `
      select evidence.data, evidence.file_name, evidence.content_type, evidence.byte_size
      from public.fuel_late_entry_evidence evidence
      join public.fuel_storage_events event on event.id = evidence.fuel_storage_event_id
      where evidence.user_id = $1
        and event.user_id = $1
        and event.id::text = $2
        and event.is_late_entry = true
      limit 1
    `,
    [userId, eventId],
  );
  const row = result.rows[0];
  if (!row?.data) return null;
  const data = Buffer.isBuffer(row.data)
    ? row.data
    : row.data instanceof Uint8Array
      ? Buffer.from(row.data)
      : typeof row.data === 'string' && row.data.startsWith('\\x')
        ? Buffer.from(row.data.slice(2), 'hex')
        : Buffer.from(String(row.data), 'binary');
  if (!data.length) return null;
  return {
    data,
    fileName: sanitizeLateEntryEvidenceFileName(row.file_name),
    contentType: asText(row.content_type) || 'application/octet-stream',
    byteSize: Math.max(0, Math.round(Number(row.byte_size) || data.length)),
  };
}


type SaveFuelSlipInput = {
  captureRequestId?: unknown;
  id?: unknown;
  slipId?: unknown;
  fuelSlipId?: unknown;
  mode?: unknown;
  targetType?: unknown;
  targetId?: unknown;
  assetId?: unknown;
  storageId?: unknown;
  uploadId?: unknown;
  documentFileUrl?: unknown;
  originalFilename?: unknown;
  contentType?: unknown;
  byteSize?: unknown;
  supplierName?: unknown;
  supplierVatNumber?: unknown;
  slipNumber?: unknown;
  transactionNumber?: unknown;
  documentDate?: unknown;
  documentTime?: unknown;
  fuelType?: unknown;
  litres?: unknown;
  pricePerLitre?: unknown;
  totalAmount?: unknown;
  vatAmount?: unknown;
  vatIncluded?: unknown;
  vatRate?: unknown;
  paymentMethod?: unknown;
  cardType?: unknown;
  cardNumberMasked?: unknown;
  cardLast4?: unknown;
  merchantNumber?: unknown;
  terminalNumber?: unknown;
  siteNumber?: unknown;
  odometerReading?: unknown;
  hourMeterReading?: unknown;
  usageNotApplicable?: unknown;
  updateAssetUsage?: unknown;
  operatorName?: unknown;
  operatorNotApplicable?: unknown;
  activityText?: unknown;
  activityNotApplicable?: unknown;
  workAreaText?: unknown;
  workAreaNotApplicable?: unknown;
  note?: unknown;
  latitude?: unknown;
  longitude?: unknown;
  locationText?: unknown;
  clientCapturedAt?: unknown;
  gpsAccuracyMeters?: unknown;
  assetFuelPercentBefore?: unknown;
  assetFuelPercentAfter?: unknown;
  extractionStatus?: unknown;
  ocrConfidence?: unknown;
  reviewRequired?: unknown;
  rawExtractedText?: unknown;
  extractionWarnings?: unknown;
  auditActorUserId?: unknown;
  auditActorName?: unknown;
  auditActorEmail?: unknown;
  auditReason?: unknown;
};

type FuelSlipSaveResult = {
  fuelSlip: FuelSlipTransaction;
  storage: FuelLedgerStorage | null;
  event: FuelLedgerEvent | null;
  assets: FuelLedgerAsset[];
  pendingReview: boolean;
  message: string;
};

type FuelSlipAssetRow = FuelAssetRow & {
  valuation_run_id: string | number | null;
  selected_method: string | null;
};

function normalizeExtractionWarnings(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return normalizeFuelSlipWarningList(value);
}

function buildFuelSlipDescription(input: { fuelType: string; litres: number | null; pricePerLitre: number | null; totalAmount: number | null }): string {
  const parts = ['Fuel Slip'];
  if (input.fuelType) parts.push(input.fuelType);
  if (input.litres !== null) parts.push(`${input.litres.toLocaleString('en-ZA', { maximumFractionDigits: 3 })} L`);
  if (input.pricePerLitre !== null) parts.push(`R${input.pricePerLitre.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 4 })}/L`);
  if (input.totalAmount !== null) parts.push(`R${input.totalAmount.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
  return parts.join(' · ');
}

function buildFuelSlipNotCompletedMessage(_missingReasons: string[]): string {
  return 'Complete the missing required fields before this fuel slip can post to the Fuel Ledger.';
}

async function loadFuelSlipById(client: PoolClient, fuelSlipId: string): Promise<FuelSlipTransaction> {
  const result = await client.query<FuelSlipRow>(
    `
      select ${fuelSlipSelectSql()}
      from public.fuel_slips fs
      left join public.asset_register_items a on a.id = fs.asset_register_item_id
      left join public.fuel_storage_units s on s.id = fs.storage_id
      where fs.id::text = $1
      limit 1
    `,
    [fuelSlipId],
  );

  const row = result.rows[0];
  if (!row) throw new Error('Fuel slip could not be loaded after saving.');
  return mapFuelSlipRow(row);
}


function fuelSlipDirectSelectSql(): string {
  return `
    fs.id::text as id,
    fs.user_id,
    fs.source_type,
    fs.source_label,
    fs.target_type,
    fs.asset_register_item_id::text as asset_register_item_id,
    ''::text as asset_title,
    fs.storage_id::text as storage_id,
    ''::text as storage_name,
    fs.fuel_storage_event_id::text as fuel_storage_event_id,
    fs.asset_invoice_id::text as asset_invoice_id,
    fs.invoice_document_id::text as invoice_document_id,
    fs.upload_id,
    fs.document_file_url,
    fs.original_filename,
    fs.content_type,
    fs.byte_size,
    fs.supplier_name,
    fs.supplier_vat_number,
    fs.slip_number,
    fs.transaction_number,
    fs.document_date,
    fs.document_time,
    fs.fuel_type,
    fs.litres,
    fs.price_per_litre,
    fs.total_amount,
    fs.vat_amount,
    fs.vat_included,
    fs.vat_rate,
    fs.payment_method,
    fs.card_type,
    fs.card_number_masked,
    fs.card_last4,
    fs.merchant_number,
    fs.terminal_number,
    fs.site_number,
    fs.odometer_reading,
    fs.hour_meter_reading,
    fs.usage_not_applicable,
    fs.operator_name,
    fs.operator_not_applicable,
    fs.activity_text,
    fs.activity_not_applicable,
    fs.work_area_text,
    fs.work_area_not_applicable,
    fs.note,
    fs.asset_fuel_percent_before,
    fs.asset_fuel_percent_after,
    fs.extraction_status,
    fs.ocr_confidence,
    fs.review_required,
    fs.raw_extracted_text,
    fs.extraction_warnings,
    fs.work_use_excluded,
    fs.work_use_exclusion_reason,
    fs.record_status,
    fs.voided_at,
    fs.voided_by_name,
    fs.void_reason,
    fs.created_at,
    fs.updated_at
  `;
}

async function loadFuelSlipRowForUpdate(client: PoolClient, userId: string, fuelSlipId: string): Promise<FuelSlipRow> {
  const result = await client.query<FuelSlipRow>(
    `
      select ${fuelSlipDirectSelectSql()}
      from public.fuel_slips fs
      where fs.user_id = $1 and fs.id::text = $2 and fs.record_status = 'active'
      for update
    `,
    [userId, fuelSlipId],
  );

  const row = result.rows[0];
  if (!row) throw new Error('Fuel slip not found.');
  return row;
}

function normalizedFuelSlipIdFromInput(input: SaveFuelSlipInput): string {
  return trimText(input.fuelSlipId ?? input.slipId ?? input.id, 80);
}

async function clearFuelSlipAssetLastFields(client: PoolClient, userId: string, assetId: string, fuelSlipId: string): Promise<void> {
  if (!assetId || !fuelSlipId) return;

  await client.query(
    `
      update public.asset_register_items
      set
        specs_json = (
          coalesce(specs_json, '{}'::jsonb)
            - 'lastFuelSlipId'
            - 'last_fuel_slip_id'
            - 'lastFuelSlipLitres'
            - 'last_fuel_slip_litres'
            - 'lastFuelSlipAmount'
            - 'last_fuel_slip_amount'
            - 'lastFuelSlipDate'
            - 'last_fuel_slip_date'
            - 'lastFuelSlipOdometerReading'
            - 'last_fuel_slip_odometer_reading'
            - 'lastFuelSlipHourMeterReading'
            - 'last_fuel_slip_hour_meter_reading'
            - 'lastFuelSlipOperatorName'
            - 'last_fuel_slip_operator_name'
            - 'lastFuelSlipActivityText'
            - 'last_fuel_slip_activity_text'
            - 'lastFuelSlipWorkAreaText'
            - 'last_fuel_slip_work_area_text'
            - 'lastFuelSlipLocationText'
            - 'last_fuel_slip_location_text'
            - 'lastFuelSlipAssetFuelPercentBefore'
            - 'last_fuel_slip_asset_fuel_percent_before'
            - 'lastFuelSlipAssetFuelPercentAfter'
            - 'last_fuel_slip_asset_fuel_percent_after'
            - 'lastFuelSlipNote'
            - 'last_fuel_slip_note'
        ),
        updated_at = now()
      where user_id = $1
        and id::text = $2
        and (
          coalesce(specs_json, '{}'::jsonb)->>'lastFuelSlipId' = $3
          or coalesce(specs_json, '{}'::jsonb)->>'last_fuel_slip_id' = $3
        )
    `,
    [userId, assetId, fuelSlipId],
  );
}

async function removeFuelSlipSideEffects(client: PoolClient, userId: string, slip: FuelSlipRow): Promise<void> {
  const fuelSlipId = asText(slip.id);
  if (!fuelSlipId) return;

  await client.query(
    `
      update public.fuel_slips
      set
        fuel_storage_event_id = null,
        asset_invoice_id = null,
        invoice_document_id = null,
        updated_at = now()
      where user_id = $1 and id::text = $2
    `,
    [userId, fuelSlipId],
  );

  const eventResult = await client.query<{ id: string; storage_id: string | null; litres: string | number | null; event_type: string | null }>(
    `
      select id::text, storage_id::text, litres, event_type
      from public.fuel_storage_events
      where user_id = $1
        and (fuel_slip_id::text = $2 or ($3 <> '' and id::text = $3))
      for update
    `,
    [userId, fuelSlipId, asText(slip.fuel_storage_event_id)],
  );

  for (const eventRow of eventResult.rows) {
    const eventId = asText(eventRow.id);
    const storageId = asText(eventRow.storage_id);
    const litres = normalizeOptionalLitres(eventRow.litres) ?? 0;
    const eventType = normalizeEventType(eventRow.event_type);

    if (storageId && litres > 0 && (eventType === 'stock_in' || eventType === 'opening_balance')) {
      const storageResult = await client.query<FuelStorageRow>(
        `
          select ${fuelStorageSelectSql()}
          from public.fuel_storage_units
          where user_id = $1 and id::text = $2
          for update
        `,
        [userId, storageId],
      );
      const storage = storageResult.rows[0] ? mapStorageRow(storageResult.rows[0]) : null;

      if (storage) {
        const nextLitres = Math.max(0, roundLitres(storage.currentLitres - litres));
        await client.query(
          `
            update public.fuel_storage_units
            set current_litres = $3::numeric, updated_at = now()
            where user_id = $1 and id::text = $2
          `,
          [userId, storageId, nextLitres],
        );
      }
    }

    if (eventId) {
      await client.query(
        `delete from public.fuel_storage_events where user_id = $1 and id::text = $2`,
        [userId, eventId],
      );
    }
  }

  await client.query(
    `
      delete from public.asset_scan_events e
      using public.asset_register_items a
      where e.asset_id = a.id
        and a.user_id = $1
        and e.fuel_slip_id::text = $2
    `,
    [userId, fuelSlipId],
  );

  const invoiceId = asText(slip.asset_invoice_id);
  let invoiceDocumentId = asText(slip.invoice_document_id);

  if (invoiceId) {
    const invoiceResult = await client.query<{ invoice_document_id: string | null }>(
      `
        select invoice_document_id::text as invoice_document_id
        from public.asset_invoices
        where user_id = $1 and id::text = $2 and source = 'fuel_slip'
        limit 1
      `,
      [userId, invoiceId],
    );

    invoiceDocumentId = invoiceDocumentId || asText(invoiceResult.rows[0]?.invoice_document_id);

    await client.query(
      `delete from public.asset_invoices where user_id = $1 and id::text = $2 and source = 'fuel_slip'`,
      [userId, invoiceId],
    );
  }

  if (invoiceDocumentId) {
    await client.query(
      `
        delete from public.asset_invoice_documents d
        where d.user_id = $1
          and d.id::text = $2
          and d.source = 'fuel_slip'
          and not exists (
            select 1
            from public.asset_invoices i
            where i.invoice_document_id = d.id
          )
      `,
      [userId, invoiceDocumentId],
    );
  }

  await clearFuelSlipAssetLastFields(client, userId, asText(slip.asset_register_item_id), fuelSlipId);
}

export async function voidFuelSlipTransaction(
  userId: string,
  fuelSlipId: string,
  input: { actor?: FuelLedgerAuditActor; reason?: unknown } = {},
): Promise<void> {
  await ensureFuelLedgerTables();
  const db = getDb();
  const client = await db.connect();
  let committed = false;

  try {
    await client.query('BEGIN');

    const slip = await loadFuelSlipRowForUpdate(client, userId, fuelSlipId);
    const before = mapFuelSlipRow(slip);
    await removeFuelSlipSideEffects(client, userId, slip);

    const actor = normalizeFuelAuditActor(input.actor);
    const reason = asText(input.reason).slice(0, 500) || 'Fuel slip corrected or cancelled';
    await client.query(
      `
        update public.fuel_slips
        set
          record_status = 'voided',
          voided_at = now(),
          voided_by_user_id = $3,
          voided_by_name = $4,
          voided_by_email = $5,
          void_reason = $6,
          updated_at = now()
        where user_id = $1 and id::text = $2 and record_status = 'active'
      `,
      [userId, fuelSlipId, actor.userId || null, actor.name, actor.email || null, reason],
    );

    await insertFuelLedgerAuditEvent(client, {
      userId,
      recordType: 'fuel_slip',
      recordId: fuelSlipId,
      action: 'voided',
      actor: input.actor,
      reason,
      beforeSnapshot: before,
      afterSnapshot: { ...before, recordStatus: 'voided', voidedByName: actor.name, voidReason: reason },
    });

    await client.query('COMMIT');
    committed = true;
  } catch (error) {
    if (!committed) {
      await client.query('ROLLBACK').catch(() => null);
    }
    throw error;
  } finally {
    client.release();
  }
}

export async function saveFuelSlipTransaction(userId: string, input: SaveFuelSlipInput): Promise<FuelSlipSaveResult> {
  await ensureFuelLedgerTables();

  const db = getDb();
  const captureRequestId = normalizeCaptureRequestId(input.captureRequestId);
  if (captureRequestId) {
    const existingCapture = await db.query<{ id: string }>(
      `select id::text as id
         from public.fuel_slips
        where user_id = $1
          and capture_request_id = $2::uuid
          and record_status = 'active'
        limit 1`,
      [userId, captureRequestId],
    );
    const existingId = existingCapture.rows[0]?.id;
    if (existingId) {
      const fuelSlip = await getFuelSlipTransactionById(userId, existingId);
      if (!fuelSlip) throw new Error('Fuel slip could not be loaded after saving.');
      return {
        fuelSlip,
        storage: fuelSlip.storageId ? await getFuelStorageById(userId, fuelSlip.storageId) : null,
        event: null,
        assets: await listFuelAssetsForUser(userId),
        pendingReview: fuelSlip.reviewRequired,
        message: 'Fuel Slip was already saved to Fuel Ledger.',
      };
    }
  }
  const client = await db.connect();
  const existingFuelSlipId = normalizedFuelSlipIdFromInput(input);
  const targetType = normalizeFuelSlipTargetType(input.targetType);
  const rawTargetId = trimText(input.targetId, 120);
  const targetId = rawTargetId.includes(':') ? rawTargetId.split(':').pop() ?? rawTargetId : rawTargetId;
  const assetId = targetType === 'asset' ? trimText(input.assetId, 80) || targetId : '';
  const storageId = targetType === 'storage_tank' ? trimText(input.storageId, 80) || targetId : '';
  const captureMode = trimText(input.mode, 20).toLowerCase() === 'automatic' ? 'automatic' : 'manual';
  const parsedLitres = normalizeOptionalLitres(input.litres);
  const litres = parsedLitres !== null && parsedLitres > 0 ? parsedLitres : null;
  const pricePerLitre = normalizeRateValue(input.pricePerLitre);
  const totalAmount = normalizeMoneyValue(input.totalAmount);
  const documentDate = normalizeDateOnly(input.documentDate);
  const documentTime = normalizeTimeText(input.documentTime);
  const uploadId = trimText(input.uploadId, 160);
  const documentFileUrl = trimText(input.documentFileUrl, 500) || buildAssetRegisterUploadUrl(uploadId);
  const originalFilename = trimText(input.originalFilename, 180);
  const contentType = trimText(input.contentType, 120);
  const byteSize = asNumber(input.byteSize);
  const supplierName = sanitizeFuelSlipTextField(input.supplierName, 180);
  const supplierVatNumber = trimText(input.supplierVatNumber, 40).replace(/[^0-9A-Za-z -]/g, '');
  const slipNumber = sanitizeFuelSlipTextField(input.slipNumber, 120);
  const transactionNumber = sanitizeFuelSlipTextField(input.transactionNumber, 120);
  const fuelType = sanitizeFuelSlipTextField(input.fuelType, 120);
  const vatAmount = normalizeMoneyValue(input.vatAmount);
  const vatIncluded = normalizeBoolean(input.vatIncluded);
  const vatRate = normalizeRateValue(input.vatRate);
  const paymentMethod = sanitizeFuelSlipTextField(input.paymentMethod, 80);
  const cardType = sanitizeFuelSlipTextField(input.cardType, 80);
  const card = normalizeMaskedCard(input.cardNumberMasked, input.cardLast4);
  const merchantNumber = sanitizeFuelSlipTextField(input.merchantNumber, 80);
  const terminalNumber = sanitizeFuelSlipTextField(input.terminalNumber, 80);
  const siteNumber = sanitizeFuelSlipTextField(input.siteNumber, 80);
  const usageNotApplicable = normalizeBoolean(input.usageNotApplicable) === true;
  const operatorNotApplicable = normalizeBoolean(input.operatorNotApplicable) === true;
  const activityNotApplicable = normalizeBoolean(input.activityNotApplicable) === true;
  const workAreaNotApplicable = normalizeBoolean(input.workAreaNotApplicable) === true;
  // Existing Fuel Ledger entry points keep their current behaviour when this new
  // field is omitted. Admin Capture passes false unless the reviewer explicitly
  // chooses to advance the asset's saved usage.
  const updateAssetUsage = normalizeBoolean(input.updateAssetUsage) !== false && !usageNotApplicable;
  const odometerReading = usageNotApplicable ? null : normalizeUsageReading(input.odometerReading);
  const hourMeterReading = usageNotApplicable ? null : normalizeUsageReading(input.hourMeterReading);
  const operatorName = operatorNotApplicable ? '' : sanitizeFuelSlipTextField(input.operatorName, 100);
  const activityText = activityNotApplicable ? '' : sanitizeFuelSlipTextField(input.activityText, 180);
  const workAreaText = workAreaNotApplicable ? '' : sanitizeFuelSlipTextField(input.workAreaText, 180);
  const note = sanitizeFuelSlipTextField(input.note, 1000);
  const latitude = normalizeCoordinate(input.latitude, 90);
  const longitude = normalizeCoordinate(input.longitude, 180);
  const locationText = latitude !== null && longitude !== null
    ? sanitizeFuelSlipTextField(input.locationText, 180) || `GPS ${latitude.toFixed(6)}, ${longitude.toFixed(6)}`
    : sanitizeFuelSlipTextField(input.locationText, 180) || null;
  const clientCapturedAt = normalizeClientCapturedAt(input.clientCapturedAt);
  const gpsAccuracyMeters = normalizeGpsAccuracyMeters(input.gpsAccuracyMeters);
  const inputAssetFuelPercentBefore = normalizeFuelPercent(input.assetFuelPercentBefore);
  const assetFuelPercentAfter = normalizeFuelPercent(input.assetFuelPercentAfter);
  const ocrConfidence = normalizeRateValue(input.ocrConfidence);
  const rawExtractedText = maskStoredFuelSlipRawText(trimText(input.rawExtractedText, 20000));
  let extractionWarnings = normalizeExtractionWarnings(input.extractionWarnings);
  let committed = false;

  const coreMissingReasons: string[] = [];
  if (!documentDate) coreMissingReasons.push('Slip date');
  if (!fuelType) coreMissingReasons.push('Fuel type');
  if (litres === null || litres <= 0) coreMissingReasons.push('Litres greater than 0');
  if (totalAmount === null) coreMissingReasons.push('Total amount');
  const coreComplete = coreMissingReasons.length === 0;

  if (captureMode === 'automatic' && !uploadId && !documentFileUrl) {
    throw new Error('Upload the fuel slip photo or PDF before saving an automatic fuel slip.');
  }

  if (targetType === 'asset' && !assetId) {
    throw new Error('Choose the asset for this fuel slip.');
  }

  if (targetType === 'storage_tank' && !storageId) {
    throw new Error('Choose the storage tank for this fuel slip.');
  }

  try {
    await client.query('BEGIN');

    const existingSlip = existingFuelSlipId ? await loadFuelSlipRowForUpdate(client, userId, existingFuelSlipId) : null;
    if (existingSlip) {
      await removeFuelSlipSideEffects(client, userId, existingSlip);
    }

    let asset: FuelLedgerAsset | null = null;
    let storage: FuelLedgerStorage | null = null;
    let workUseExcluded = false;
    let workUseExclusionReason = '';
    let usageComplete = true;
    let usageMetric: 'km' | 'hours' | 'none' = 'none';
    let usageReading: number | null = null;
    let usageAdvanced = false;
    let assetHasSavedValuation = false;
    let assetFuelPercentBefore: number | null = inputAssetFuelPercentBefore;
    const postingMissingReasons: string[] = [];

    if (targetType === 'asset') {
      const assetResult = await client.query<FuelSlipAssetRow>(
        `
          select
            a.id::text,
            a.title,
            a.kind,
            a.brand_name,
            a.model_name,
            a.typed_model_name,
            coalesce(ef.family_label, '') as equipment_family_label,
            coalesce(to_jsonb(a)->>'serial_number', to_jsonb(a)->>'serialNumber', '') as serial_number,
            to_jsonb(a)->>'plate_label' as plate_label,
            to_jsonb(a)->>'public_asset_code' as public_asset_code,
            coalesce(nullif(lower(to_jsonb(a)->>'qr_status'), ''), 'active') as qr_status,
            a.hours,
            coalesce(to_jsonb(a)->>'life_worked_percent', to_jsonb(a)->'specs_json'->>'life_worked_percent', to_jsonb(a)->'specs_json'->>'lifeWorkedPercent') as life_worked_percent,
            to_jsonb(a)->>'fuel_percent' as fuel_percent,
            coalesce(to_jsonb(a)->>'year_model', to_jsonb(a)->>'yearModel', to_jsonb(a)->>'year') as year_model,
            coalesce(to_jsonb(a)->>'condition', '') as condition,
            coalesce(to_jsonb(a)->>'selected_method', to_jsonb(a)->>'selectedMethod', to_jsonb(a)->>'method', '') as selected_method,
            coalesce(
              to_jsonb(a)->>'current_value',
              to_jsonb(a)->>'currentValue',
              to_jsonb(a)->>'selected_value_ex_vat',
              to_jsonb(a)->>'selectedValueExVat',
              to_jsonb(a)->>'selected_value',
              to_jsonb(a)->>'value',
              to_jsonb(a)->>'opening_value'
            ) as current_value,
            ef.is_propelled as family_is_propelled,
            coalesce(a.specs_json, '{}'::jsonb) as specs_json,
            a.valuation_run_id,
            a.selected_method
          from public.asset_register_items a
          left join public.valuation_runs vr on vr.id = a.valuation_run_id
          left join public.equipment_families ef on ef.id = coalesce(a.equipment_family_id, vr.equipment_family_id)
          where a.user_id = $1 and a.id::text = $2
          -- Only lock the saved asset row. The LEFT JOIN tables are enrichment-only and
          -- PostgreSQL must not try to lock the nullable side of these joins.
          for update of a
        `,
        [userId, assetId],
      );

      const assetRow = assetResult.rows[0];
      if (!assetRow) throw new Error('Asset not found.');
      asset = mapFuelAssetRow(assetRow);
      const assetWorkUse = await getFuelAssetWorkUseExclusion(client, userId, assetId);
      workUseExcluded = assetWorkUse.excluded;
      workUseExclusionReason = assetWorkUse.reason;
      const preservesExistingAsset = Boolean(existingSlip?.asset_register_item_id)
        && asText(existingSlip?.asset_register_item_id) === assetId;
      if (!preservesExistingAsset) assertFuelAssetAvailableForEntry(asset, assetWorkUse);
      assetFuelPercentBefore = asset.fuelPercent ?? inputAssetFuelPercentBefore;

      if (usageNotApplicable) {
        usageMetric = 'none';
        usageReading = null;
        usageComplete = true;
      } else if (asset.usageMetric === 'km') {
        usageMetric = 'km';
        usageReading = odometerReading;
        usageComplete = odometerReading !== null;
      } else if (asset.usageMetric === 'hours') {
        usageMetric = 'hours';
        usageReading = hourMeterReading;
        usageComplete = hourMeterReading !== null;
      } else if (asset.usageMetric === 'both') {
        usageMetric = hourMeterReading !== null ? 'hours' : odometerReading !== null ? 'km' : 'none';
        usageReading = usageMetric === 'hours' ? hourMeterReading : usageMetric === 'km' ? odometerReading : null;
        usageComplete = usageReading !== null;
      }

      if (!usageComplete) {
        if (asset.usageMetric === 'km') postingMissingReasons.push('Current km / odometer');
        if (asset.usageMetric === 'hours') postingMissingReasons.push('Current hours');
        if (asset.usageMetric === 'both') postingMissingReasons.push('Current km / odometer or current hours');
      }

      if (!operatorName && !operatorNotApplicable) postingMissingReasons.push('Operator / manager name');
      if (!activityText && !activityNotApplicable) postingMissingReasons.push('Activity / reason for fuel');
      if (!workAreaText && !workAreaNotApplicable) postingMissingReasons.push('Where / direction / work area');

      const currentUsageReading = normalizeUsageReading(assetRow.hours);
      if (updateAssetUsage && usageReading !== null && currentUsageReading !== null && usageReading < currentUsageReading) {
        throw new Error('The usage reading cannot be lower than the reading already saved on this asset.');
      }
      usageAdvanced = updateAssetUsage
        && usageReading !== null
        && (currentUsageReading === null || usageReading > currentUsageReading);
      assetHasSavedValuation = hasSavedFuelAssetValuation(assetRow);
    } else {
      const storageResult = await client.query<FuelStorageRow>(
        `
          select ${fuelStorageSelectSql()}
          from public.fuel_storage_units
          where user_id = $1 and id::text = $2 and status = 'active'
          for update
        `,
        [userId, storageId],
      );

      storage = storageResult.rows[0] ? mapStorageRow(storageResult.rows[0]) : null;
      if (!storage) throw new Error('Fuel storage tank not found.');

      if (coreComplete && litres !== null) {
        const storageAfter = roundLitres(storage.currentLitres + litres);
        if (storage.capacityLitres !== null && storageAfter > storage.capacityLitres + 0.001) {
          throw new Error(`Storage refill exceeds tank capacity. Capacity is ${storage.capacityLitres.toLocaleString('en-ZA', { maximumFractionDigits: 3 })} L.`);
        }
      }
    }

    const completionMissingReasons = targetType === 'asset'
      ? [...coreMissingReasons, ...postingMissingReasons]
      : [...coreMissingReasons];
    const isComplete = completionMissingReasons.length === 0;
    const pendingReview = !isComplete;

    extractionWarnings = [...new Set(normalizeFuelSlipWarningList(extractionWarnings))].slice(0, 12);
    const finalReviewRequired = pendingReview;
    const finalExtractionStatus: FuelSlipExtractionStatus = pendingReview
      ? 'needs_review'
      : captureMode === 'manual'
        ? 'manual'
        : 'extracted';
    const description = buildFuelSlipDescription({ fuelType, litres, pricePerLitre, totalAmount });

    const fuelSlipValues = [
      userId,
      targetType,
      targetType === 'asset' ? assetId : null,
      targetType === 'storage_tank' ? storageId : null,
      uploadId || null,
      documentFileUrl || null,
      originalFilename || null,
      contentType || null,
      byteSize === null ? null : Math.max(0, Math.round(byteSize)),
      supplierName || null,
      supplierVatNumber || null,
      slipNumber || null,
      transactionNumber || null,
      documentDate,
      documentTime,
      fuelType || null,
      litres,
      pricePerLitre,
      totalAmount,
      vatAmount,
      vatIncluded,
      vatRate,
      paymentMethod || null,
      cardType || null,
      card.masked || null,
      card.last4 || null,
      merchantNumber || null,
      terminalNumber || null,
      siteNumber || null,
      odometerReading,
      hourMeterReading,
      operatorName || null,
      activityText || null,
      workAreaText || null,
      note || null,
      assetFuelPercentBefore,
      assetFuelPercentAfter,
      finalExtractionStatus,
      ocrConfidence,
      finalReviewRequired,
      rawExtractedText || null,
      JSON.stringify(extractionWarnings),
      workUseExcluded,
      workUseExclusionReason || null,
    ];

    const savedSlip = existingFuelSlipId
      ? await client.query<{ id: string }>(
          `
            update public.fuel_slips
            set
              source_type = 'fuel_slip',
              source_label = 'Fuel Slip',
              target_type = $2,
              asset_register_item_id = $3::uuid,
              storage_id = $4::uuid,
              upload_id = $5,
              document_file_url = $6,
              original_filename = $7,
              content_type = $8,
              byte_size = $9::integer,
              supplier_name = $10,
              supplier_vat_number = $11,
              slip_number = $12,
              transaction_number = $13,
              document_date = $14::date,
              document_time = $15,
              fuel_type = $16,
              litres = $17::numeric,
              price_per_litre = $18::numeric,
              total_amount = $19::numeric,
              vat_amount = $20::numeric,
              vat_included = $21::boolean,
              vat_rate = $22::numeric,
              payment_method = $23,
              card_type = $24,
              card_number_masked = $25,
              card_last4 = $26,
              merchant_number = $27,
              terminal_number = $28,
              site_number = $29,
              odometer_reading = $30::numeric,
              hour_meter_reading = $31::numeric,
              operator_name = $32,
              activity_text = $33,
              work_area_text = $34,
              note = $35,
              asset_fuel_percent_before = $36::integer,
              asset_fuel_percent_after = $37::integer,
              extraction_status = $38,
              ocr_confidence = $39::numeric,
              review_required = $40::boolean,
              raw_extracted_text = $41,
              extraction_warnings = $42::jsonb,
              work_use_excluded = $43::boolean,
              work_use_exclusion_reason = $44,
              updated_at = now()
            where user_id = $1 and id::text = $45
            returning id::text
          `,
          [...fuelSlipValues, existingFuelSlipId],
        )
      : await client.query<{ id: string }>(
          `
            insert into public.fuel_slips (
              user_id,
              capture_request_id,
              source_type,
              source_label,
              target_type,
              asset_register_item_id,
              storage_id,
              upload_id,
              document_file_url,
              original_filename,
              content_type,
              byte_size,
              supplier_name,
              supplier_vat_number,
              slip_number,
              transaction_number,
              document_date,
              document_time,
              fuel_type,
              litres,
              price_per_litre,
              total_amount,
              vat_amount,
              vat_included,
              vat_rate,
              payment_method,
              card_type,
              card_number_masked,
              card_last4,
              merchant_number,
              terminal_number,
              site_number,
              odometer_reading,
              hour_meter_reading,
              operator_name,
              activity_text,
              work_area_text,
              note,
              asset_fuel_percent_before,
              asset_fuel_percent_after,
              extraction_status,
              ocr_confidence,
              review_required,
              raw_extracted_text,
              extraction_warnings,
              work_use_excluded,
              work_use_exclusion_reason
            ) values ($1, $45::uuid, 'fuel_slip', 'Fuel Slip', $2, $3::uuid, $4::uuid, $5, $6, $7, $8, $9::integer, $10, $11, $12, $13, $14::date, $15, $16, $17::numeric, $18::numeric, $19::numeric, $20::numeric, $21::boolean, $22::numeric, $23, $24, $25, $26, $27, $28, $29, $30::numeric, $31::numeric, $32, $33, $34, $35, $36::integer, $37::integer, $38, $39::numeric, $40::boolean, $41, $42::jsonb, $43::boolean, $44)
            returning id::text
          `,
          [...fuelSlipValues, captureRequestId],
        );

    const fuelSlipId = savedSlip.rows[0]?.id;
    if (!fuelSlipId) throw new Error(existingFuelSlipId ? 'Fuel slip not found.' : 'Fuel slip could not be saved.');

    await client.query(
      `
        update public.fuel_slips
        set
          usage_not_applicable = $3::boolean,
          operator_not_applicable = $4::boolean,
          activity_not_applicable = $5::boolean,
          work_area_not_applicable = $6::boolean,
          updated_at = now()
        where user_id = $1 and id::text = $2
      `,
      [
        userId,
        fuelSlipId,
        usageNotApplicable,
        operatorNotApplicable,
        activityNotApplicable,
        workAreaNotApplicable,
      ],
    );

    let event: FuelLedgerEvent | null = null;

    if (!pendingReview && targetType === 'storage_tank' && storage) {
      const completedLitres = litres as number;
      const completedTotalAmount = totalAmount as number;
      const storageBefore = storage.currentLitres;
      const storageAfter = roundLitres(storageBefore + completedLitres);

      await client.query(
        `
          update public.fuel_storage_units
          set current_litres = $3::numeric, updated_at = now()
          where user_id = $1 and id::text = $2
        `,
        [userId, storageId, storageAfter],
      );

      event = await insertFuelStorageEvent(client, {
        storageId,
        userId,
        eventType: 'stock_in',
        sourceType: 'fuel_slip',
        sourceLabel: 'Fuel Slip',
        fuelSlipId,
        totalAmount: completedTotalAmount,
        documentFileUrl: documentFileUrl || null,
        paymentMethod: paymentMethod || null,
        cardNumberMasked: card.masked || null,
        assetId: null,
        litres: completedLitres,
        storageLevelBefore: storageBefore,
        storageLevelAfter: storageAfter,
        assetFuelPercentBefore: null,
        assetFuelPercentAfter: null,
        assetUsageReading: null,
        operatorName: operatorNotApplicable ? null : operatorName || supplierName || 'Fuel Slip',
        activityText: activityNotApplicable ? null : activityText || 'Fuel Slip / storage refill',
        workAreaText: workAreaNotApplicable ? null : workAreaText || storage.name || null,
        note: [description, note].filter(Boolean).join('\n\n') || null,
        latitude: null,
        longitude: null,
        locationText: null,
      });

      await client.query(
        `update public.fuel_slips set fuel_storage_event_id = $2::uuid, updated_at = now() where user_id = $1 and id::text = $3`,
        [userId, event.id, fuelSlipId],
      );
    }

    if (!pendingReview && targetType === 'asset' && asset) {
      const completedLitres = litres as number;
      const completedTotalAmount = totalAmount as number;
      const completedDocumentDate = documentDate as string;
      let invoiceDocumentId: string | null = null;
      let assetInvoiceId: string | null = null;

      if (uploadId || documentFileUrl) {
        const documentResult = await client.query<{ id: string }>(
          `
            insert into public.asset_invoice_documents (
              user_id,
              asset_register_item_id,
              upload_id,
              upload_url,
              file_name,
              content_type,
              byte_size,
              source,
              raw_extracted_text,
              extraction_status,
              extraction_warnings
            ) values ($1, $2::uuid, $3, $4, $5, $6, $7::integer, 'fuel_slip', $8, $9, $10::jsonb)
            returning id::text
          `,
          [
            userId,
            assetId,
            uploadId || null,
            documentFileUrl || null,
            originalFilename || 'fuel-slip-upload',
            contentType || 'application/octet-stream',
            byteSize === null ? null : Math.max(0, Math.round(byteSize)),
            rawExtractedText || null,
            finalExtractionStatus === 'needs_review' ? 'extracted' : finalExtractionStatus === 'extracted' ? 'extracted' : 'skipped',
            JSON.stringify(extractionWarnings),
          ],
        );
        invoiceDocumentId = documentResult.rows[0]?.id ?? null;
      }

      const subtotalExVat = vatAmount !== null ? Math.max(0, Math.round((completedTotalAmount - vatAmount) * 100) / 100) : null;
      const noteLines = [
        'Fuel Slip',
        supplierName ? `Supplier: ${supplierName}` : '',
        fuelType ? `Fuel type: ${fuelType}` : '',
        paymentMethod ? `Payment: ${paymentMethod}` : '',
        card.last4 ? `Card ending ${card.last4}` : '',
        operatorName ? `Operator / manager: ${operatorName}` : '',
        activityText ? `Activity: ${activityText}` : '',
        workAreaText ? `Work area: ${workAreaText}` : '',
        locationText ? `Location: ${locationText}` : '',
        assetFuelPercentAfter !== null ? `Fuel percentage after fill: ${assetFuelPercentAfter}%` : '',
        note ? `Note: ${note}` : '',
        documentFileUrl ? `Document: ${documentFileUrl}` : '',
      ].filter(Boolean);

      const invoiceResult = await client.query<{ id: string }>(
        `
          insert into public.asset_invoices (
            user_id,
            asset_register_item_id,
            invoice_document_id,
            supplier_name,
            invoice_number,
            invoice_date,
            subtotal_ex_vat,
            vat_amount,
            total_inc_vat,
            usage_reading,
            usage_metric,
            source,
            notes
          ) values ($1, $2::uuid, $3::uuid, $4, $5, $6::date, $7::numeric, $8::numeric, $9::numeric, $10::numeric, $11, 'fuel_slip', $12)
          returning id::text
        `,
        [
          userId,
          assetId,
          invoiceDocumentId,
          supplierName || null,
          slipNumber || transactionNumber || null,
          completedDocumentDate,
          subtotalExVat,
          vatAmount,
          completedTotalAmount,
          usageReading,
          usageMetric,
          noteLines.join('\n') || null,
        ],
      );

      assetInvoiceId = invoiceResult.rows[0]?.id ?? null;
      if (assetInvoiceId) {
        await client.query(
          `
            insert into public.asset_invoice_blocks (
              invoice_id,
              block_type,
              description,
              amount_ex_vat,
              vat_amount,
              total_inc_vat,
              sort_order
            ) values ($1::uuid, 'other', $2, $3::numeric, $4::numeric, $5::numeric, 0)
          `,
          [assetInvoiceId, description, subtotalExVat, vatAmount, completedTotalAmount],
        );
      }

      const fuelSlipSpecs = {
        ...(asset ? asRecord((await client.query<{ specs_json: unknown }>('select coalesce(specs_json, \'{}\'::jsonb) as specs_json from public.asset_register_items where user_id = $1 and id::text = $2 limit 1', [userId, assetId])).rows[0]?.specs_json) : {}),
        lastFuelSlipId: fuelSlipId,
        last_fuel_slip_id: fuelSlipId,
        lastFuelSlipLitres: completedLitres,
        last_fuel_slip_litres: completedLitres,
        lastFuelSlipAmount: completedTotalAmount,
        last_fuel_slip_amount: completedTotalAmount,
        lastFuelSlipDate: completedDocumentDate,
        last_fuel_slip_date: completedDocumentDate,
        lastFuelSlipOdometerReading: odometerReading,
        last_fuel_slip_odometer_reading: odometerReading,
        lastFuelSlipHourMeterReading: hourMeterReading,
        last_fuel_slip_hour_meter_reading: hourMeterReading,
        lastFuelSlipOperatorName: operatorName || null,
        last_fuel_slip_operator_name: operatorName || null,
        lastFuelSlipActivityText: activityText || null,
        last_fuel_slip_activity_text: activityText || null,
        lastFuelSlipWorkAreaText: workAreaText || null,
        last_fuel_slip_work_area_text: workAreaText || null,
        lastFuelSlipLocationText: locationText,
        last_fuel_slip_location_text: locationText,
        lastFuelSlipAssetFuelPercentBefore: assetFuelPercentBefore,
        last_fuel_slip_asset_fuel_percent_before: assetFuelPercentBefore,
        lastFuelSlipAssetFuelPercentAfter: assetFuelPercentAfter,
        last_fuel_slip_asset_fuel_percent_after: assetFuelPercentAfter,
        lastFuelSlipNote: note,
        last_fuel_slip_note: note,
      };
      const nextSpecs = usageAdvanced && assetHasSavedValuation
        ? markFuelAssetValuationNeedsUpdate(fuelSlipSpecs, ['usage changed'])
        : fuelSlipSpecs;

      await client.query(
        `
          update public.asset_register_items
          set
            hours = case
              when $6::boolean and $3::numeric is not null
                then greatest(coalesce(hours, $3::numeric), $3::numeric)
              else hours
            end,
            fuel_percent = case when $5::integer is null then fuel_percent else $5::integer end,
            specs_json = $4::jsonb,
            updated_at = now()
          where user_id = $1 and id::text = $2
        `,
        [userId, assetId, usageReading, JSON.stringify(nextSpecs), assetFuelPercentAfter, updateAssetUsage],
      );

      await client.query(
        `
          insert into public.asset_scan_events (
            asset_id,
            actor_type,
            operator_name,
            activity_text,
            work_area_text,
            hours,
            fuel_percent,
            fuel_litres,
            fuel_storage_id,
            fuel_storage_event_id,
            fuel_slip_id,
            note,
            photo_urls,
            latitude,
            longitude,
            location_text,
            client_captured_at,
            gps_accuracy_meters,
            asset_usage_reading,
            asset_usage_metric,
            source_type,
            source_label,
            issue_date,
            issue_time,
            issue_time_recorded,
            entry_added_at,
            created_at
          ) values ($1::uuid, 'owner_session', $2, $3, $4, $5::numeric, $6::integer, $7::numeric, null, null, $10::uuid, $8, $9::jsonb, $11, $12, $13, $14::timestamptz, $15, $5::numeric, $16, 'fuel_slip', 'Fuel Slip', $17::date, $18, $19::boolean, now(), now())
        `,
        [
          assetId,
          operatorNotApplicable ? null : operatorName || supplierName || 'Fuel Slip',
          activityNotApplicable ? null : activityText || 'Fuel Slip',
          workAreaNotApplicable ? null : workAreaText || null,
          usageReading,
          assetFuelPercentAfter,
          completedLitres,
          [description, note].filter(Boolean).join('\n\n') || null,
          JSON.stringify(documentFileUrl ? [documentFileUrl] : []),
          fuelSlipId,
          latitude,
          longitude,
          locationText,
          clientCapturedAt,
          gpsAccuracyMeters,
          usageMetric,
          documentDate,
          documentTime || null,
          Boolean(documentTime),
        ],
      );

      await client.query(
        `
          update public.fuel_slips
          set asset_invoice_id = $2::uuid, invoice_document_id = $3::uuid, updated_at = now()
          where user_id = $1 and id::text = $4
        `,
        [userId, assetInvoiceId, invoiceDocumentId, fuelSlipId],
      );
    }

    const fuelSlip = await loadFuelSlipById(client, fuelSlipId);
    await insertFuelLedgerAuditEvent(client, {
      userId,
      recordType: 'fuel_slip',
      recordId: fuelSlipId,
      action: existingSlip ? 'updated' : 'created',
      actor: {
        userId: input.auditActorUserId,
        name: input.auditActorName,
        email: input.auditActorEmail,
      },
      reason: input.auditReason,
      beforeSnapshot: existingSlip ? mapFuelSlipRow(existingSlip) : undefined,
      afterSnapshot: fuelSlip,
    });
    let updatedStorage: FuelLedgerStorage | null = null;
    if (targetType === 'storage_tank') {
      const storageResult = await client.query<FuelStorageRow>(
        `select ${fuelStorageSelectSql()} from public.fuel_storage_units where user_id = $1 and id::text = $2 limit 1`,
        [userId, storageId],
      );
      updatedStorage = storageResult.rows[0] ? mapStorageRow(storageResult.rows[0]) : null;
    }

    await client.query('COMMIT');
    committed = true;

    const assets = await listFuelAssetsForUser(userId);
    const message = pendingReview
      ? buildFuelSlipNotCompletedMessage(completionMissingReasons)
      : existingFuelSlipId
        ? 'Fuel slip reviewed and completed.'
        : 'Fuel Slip saved to Fuel Ledger.';

    return {
      fuelSlip,
      storage: updatedStorage,
      event,
      assets,
      pendingReview,
      message,
    };
  } catch (error) {
    if (!committed) {
      await client.query('ROLLBACK').catch(() => null);
    }
    throw error;
  } finally {
    client.release();
  }
}

export async function getFuelStoragePublicPreview(publicFuelStorageCode: string): Promise<FuelStoragePublicPreview | null> {
  const storage = await getFuelStorageByPublicCode(publicFuelStorageCode);

  if (!storage) {
    return null;
  }

  const accountBusinessName = await getFuelAccountBusinessName(storage.userId);

  return {
    id: storage.id,
    name: storage.name,
    fuelType: storage.fuelType,
    publicFuelStorageCode: storage.publicFuelStorageCode,
    accountBusinessName,
    pinRequired: storage.pinEnabled,
    status: storage.status,
  };
}

export async function verifyFuelStoragePin(publicFuelStorageCode: string, pin: unknown): Promise<
  | { ok: true; storage: FuelLedgerStorage; ownerUserId: string; pinUpdatedAtIso: string }
  | { ok: false; status: number; error: string; pinRequired: boolean }
> {
  await ensureFuelLedgerTables();
  const db = getDb();
  const normalizedCode = normalizeFuelStorageCode(publicFuelStorageCode);

  const result = await db.query<FuelStorageRow>(
    `
      select ${fuelStorageSelectSql()}
      from public.fuel_storage_units
      where upper(public_fuel_storage_code) = $1
      limit 1
    `,
    [normalizedCode],
  );

  const row = result.rows[0];
  if (!row) {
    return { ok: false, status: 404, error: 'Fuel storage not found.', pinRequired: false };
  }

  const storage = mapStorageRow(row);
  if (storage.status !== 'active') {
    return { ok: false, status: 404, error: 'This fuel storage QR code is archived.', pinRequired: false };
  }

  if (!storage.pinEnabled || !asText(row.pin_hash) || !storage.pinUpdatedAtIso) {
    return { ok: false, status: 403, error: 'Fuel storage PIN is not enabled yet.', pinRequired: false };
  }

  let valid = false;

  try {
    valid = await verifyScanPin(pin, asText(row.pin_hash));
  } catch {
    return { ok: false, status: 400, error: 'Fuel PIN must be 4 to 8 digits.', pinRequired: true };
  }

  if (!valid) {
    return { ok: false, status: 401, error: 'Incorrect fuel PIN.', pinRequired: true };
  }

  return {
    ok: true,
    storage,
    ownerUserId: storage.userId,
    pinUpdatedAtIso: storage.pinUpdatedAtIso,
  };
}

type AuthorizeFuelStorageScanAccessOptions = {
  fieldManagerHint?: boolean;
  ownerAppHint?: boolean;
};

export async function authorizeFuelStorageScanAccess(
  request: NextRequest,
  publicFuelStorageCode: string,
  options: AuthorizeFuelStorageScanAccessOptions = {},
): Promise<
  | {
      ok: true;
      storage: FuelLedgerStorage;
      ownerUserId: string;
      accessMode: FuelScanActorType;
      fieldManagerId?: string;
      fieldManagerDisplayName?: string;
      fieldManagerSessionId?: string;
      ownerAppDisplayName?: string;
    }
  | { ok: false; status: number; error: string; pinRequired: boolean }
> {
  const storage = await getFuelStorageByPublicCode(publicFuelStorageCode);

  if (!storage) {
    return { ok: false, status: 404, error: 'Fuel storage not found.', pinRequired: false };
  }

  if (storage.status !== 'active') {
    return { ok: false, status: 404, error: 'This fuel storage QR code is archived.', pinRequired: false };
  }

  if (options.ownerAppHint === true) {
    const ownerAccess = await getOwnerAppAccess();
    if (!ownerAccess) {
      return { ok: false, status: 401, error: 'Aim4price Owner login is required.', pinRequired: false };
    }
    if (!ownerAppCan(ownerAccess, 'operate')) {
      return { ok: false, status: 403, error: 'This Owner login has View only access.', pinRequired: false };
    }
    if (ownerAccess.ownerUserId !== storage.userId) {
      return { ok: false, status: 403, error: 'This fuel storage unit is not available to this Owner login.', pinRequired: false };
    }
    return {
      ok: true,
      storage,
      ownerUserId: storage.userId,
      accessMode: 'owner_session',
      ownerAppDisplayName: ownerAccess.displayName,
    };
  }

  if (options.fieldManagerHint === true) {
    const fieldManagerSession = await getActiveFieldManagerSessionFromRequest(request);

    if (!fieldManagerSession) {
      return { ok: false, status: 401, error: 'Field Manager login is required.', pinRequired: false };
    }

    const manager = await validateFieldManagerFuelStorage({
      managerId: fieldManagerSession.managerId,
      ownerUserId: fieldManagerSession.ownerUserId,
      publicFuelStorageCode: storage.publicFuelStorageCode,
    });

    if (!manager || !manager.isActive || fieldManagerSession.ownerUserId !== storage.userId) {
      return {
        ok: false,
        status: 403,
        error: 'This fuel storage unit is not available to this Field Manager login.',
        pinRequired: false,
      };
    }

    return {
      ok: true,
      storage,
      ownerUserId: storage.userId,
      accessMode: 'field_manager',
      fieldManagerId: fieldManagerSession.managerId,
      fieldManagerDisplayName: fieldManagerSession.displayName,
      fieldManagerSessionId: fieldManagerSession.sessionId,
    };
  }

  const claims = getFuelScanSessionFromRequest(request, publicFuelStorageCode);

  if (!claims) {
    return {
      ok: false,
      status: storage.pinEnabled ? 401 : 403,
      error: storage.pinEnabled ? 'Enter the fuel storage PIN to continue.' : 'Fuel storage PIN is not enabled yet.',
      pinRequired: storage.pinEnabled,
    };
  }

  const currentPinUpdatedAtMs = parsePinUpdatedAtMs(storage.pinUpdatedAtIso);

  if (
    claims.ownerUserId !== storage.userId ||
    claims.storageId !== storage.id ||
    claims.publicFuelStorageCode !== storage.publicFuelStorageCode ||
    !storage.pinEnabled ||
    currentPinUpdatedAtMs === null ||
    claims.pinUpdatedAtMs !== currentPinUpdatedAtMs
  ) {
    return { ok: false, status: 401, error: 'Fuel scan access expired. Enter the PIN again.', pinRequired: true };
  }

  return {
    ok: true,
    storage,
    ownerUserId: storage.userId,
    accessMode: 'scan_pin',
  };
}

export async function getFuelScanPayload(userId: string, storageId: string): Promise<FuelScanPayload> {
  const storage = await getFuelStorageById(userId, storageId);

  if (!storage) {
    throw new Error('Fuel storage not found.');
  }

  const [accountBusinessName, assets, recentEvents] = await Promise.all([
    getFuelAccountBusinessName(userId),
    listFuelAssetsForUser(userId),
    listFuelEvents(userId, { storageId, limit: 20 }),
  ]);

  return { storage, accountBusinessName, assets, recentEvents };
}

export async function listFuelEventsForReport(
  userId: string,
  storageIdOrOptions?: string | { storageId?: string; fromIso?: string; toIso?: string; limit?: number; includeFuelSlips?: boolean },
): Promise<FuelLedgerEvent[]> {
  const options = typeof storageIdOrOptions === 'string' ? { storageId: storageIdOrOptions } : storageIdOrOptions ?? {};
  const limit = options.limit === undefined ? null : Math.max(1, Math.min(2000, Math.round(options.limit)));
  const includeFuelSlips = options.includeFuelSlips !== false;
  const [events, fuelSlipEvents] = await Promise.all([
    listFuelEvents(userId, {
      storageId: options.storageId,
      fromIso: options.fromIso,
      toIso: options.toIso,
      limit,
      includeFuelSlipEvents: includeFuelSlips,
    }),
    includeFuelSlips
      ? listFuelSlipEventsForReport(userId, {
        storageId: options.storageId,
        fromIso: options.fromIso,
        toIso: options.toIso,
        limit,
      })
      : Promise.resolve([]),
  ]);

  const sortedEvents = [...events, ...fuelSlipEvents]
    .sort((left, right) => {
      const leftDate = new Date(left.createdAtIso).getTime();
      const rightDate = new Date(right.createdAtIso).getTime();

      if (Number.isFinite(leftDate) && Number.isFinite(rightDate) && leftDate !== rightDate) {
        return rightDate - leftDate;
      }

      return right.id.localeCompare(left.id);
    });

  return limit === null ? sortedEvents : sortedEvents.slice(0, limit);
}
