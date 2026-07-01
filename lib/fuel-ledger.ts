import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import type { PoolClient } from 'pg';
import type { NextRequest, NextResponse } from 'next/server';
import { getDb } from './db';
import { hashScanPin, verifyScanPin } from './scan-pin';
import { ensureAccountProfileColumns } from './account-profile';
import { buildAssetRegisterUploadUrl } from './asset-register-uploads';

export const FUEL_SCAN_COOKIE_NAME = 'aim4price_fuel_scan';
export const FUEL_SCAN_SESSION_MAX_AGE_SECONDS = 60 * 60 * 12;

export type FuelStorageStatus = 'active' | 'archived';
export type FuelStorageEventType = 'opening_balance' | 'stock_in' | 'asset_issue' | 'dip' | 'adjustment';
export type FuelScanActorType = 'owner_session' | 'scan_pin';
export type FuelSlipTargetType = 'asset' | 'storage_tank';
export type FuelSlipExtractionStatus = 'manual' | 'extracted' | 'needs_review';

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
  litres: number;
  pricePerLitre: number | null;
  totalAmount: number;
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
  extractionStatus: FuelSlipExtractionStatus;
  ocrConfidence: number | null;
  reviewRequired: boolean;
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
  usageMetric: 'hours' | 'km' | 'both' | 'none';
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
  hours: string | number | null;
  fuel_percent: string | number | null;
  year_model?: string | number | null;
  condition?: string | null;
  selected_method?: string | null;
  current_value?: string | number | null;
  family_is_propelled: boolean | string | number | null;
  specs_json: unknown;
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
  extraction_status: string | null;
  ocr_confidence: string | number | null;
  review_required: boolean | null;
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

let fuelLedgerTablesEnsured = false;

function asText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function asNumber(value: unknown): number | null {
  if (value === null || typeof value === 'undefined' || value === '') {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
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
  if (value === null || typeof value === 'undefined' || value === '') {
    return null;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
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

  if (Boolean(reviewRequired) || normalizedStatus === 'needs_review') return 'Needs review';
  if (normalizedStatus === 'extracted') return 'Extracted';
  return 'Manual';
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
    status: normalizeStorageStatus(row.status),
    publicFuelStorageCode: normalizeFuelStorageCode(row.public_fuel_storage_code),
    pinEnabled: Boolean(row.pin_enabled) && Boolean(pinHash),
    hasPin: Boolean(pinHash),
    pinUpdatedAtIso: row.pin_updated_at ?? null,
    createdAtIso: row.created_at ?? new Date().toISOString(),
    updatedAtIso: row.updated_at ?? row.created_at ?? new Date().toISOString(),
  };
}

function mapFuelEventRow(row: FuelEventRow): FuelLedgerEvent {
  const sourceType = asText(row.source_type);
  const isFuelSlip = sourceType === 'fuel_slip';
  const extractionStatus = isFuelSlip ? asText(row.fs_extraction_status) : '';
  const reviewRequired = isFuelSlip ? Boolean(row.fs_review_required) : false;
  const card = normalizeMaskedCard(isFuelSlip ? row.fs_card_number_masked ?? row.card_number_masked : row.card_number_masked, isFuelSlip ? row.fs_card_last4 : null);

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
    fuelSlipSupplierName: asText(row.fs_supplier_name),
    fuelSlipFuelType: asText(row.fs_fuel_type),
    fuelSlipDocumentDate: toDateOnly(row.fs_document_date) ?? '',
    fuelSlipDocumentTime: asText(row.fs_document_time),
    fuelSlipExtractionStatus: extractionStatus,
    fuelSlipReviewRequired: reviewRequired,
    fuelSlipReviewStatus: isFuelSlip ? fuelSlipReviewStatusLabel(extractionStatus, reviewRequired) : '',
    totalAmount: isFuelSlip ? null : normalizeMoneyValue(row.total_amount),
    documentFileUrl: isFuelSlip ? asText(row.fs_document_file_url) || asText(row.document_file_url) : asText(row.document_file_url),
    paymentMethod: isFuelSlip ? asText(row.fs_payment_method) || asText(row.payment_method) : asText(row.payment_method),
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
    operatorName: asText(row.operator_name),
    activityText: asText(row.activity_text),
    workAreaText: asText(row.work_area_text),
    note: asText(row.note),
    latitude: normalizeCoordinate(row.latitude, 90),
    longitude: normalizeCoordinate(row.longitude, 180),
    locationText: asText(row.location_text),
    createdAtIso: row.created_at ?? new Date().toISOString(),
  };
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
    originalFilename: asText(row.original_filename),
    contentType: asText(row.content_type),
    byteSize: asNumber(row.byte_size),
    supplierName: asText(row.supplier_name),
    supplierVatNumber: asText(row.supplier_vat_number),
    slipNumber: asText(row.slip_number),
    transactionNumber: asText(row.transaction_number),
    documentDate: toDateOnly(row.document_date),
    documentTime: asText(row.document_time),
    fuelType: asText(row.fuel_type),
    litres: normalizeOptionalLitres(row.litres) ?? 0,
    pricePerLitre: normalizeRateValue(row.price_per_litre),
    totalAmount: normalizeMoneyValue(row.total_amount) ?? 0,
    vatAmount: normalizeMoneyValue(row.vat_amount),
    vatIncluded: normalizeBoolean(row.vat_included),
    vatRate: normalizeRateValue(row.vat_rate),
    paymentMethod: asText(row.payment_method),
    cardType: asText(row.card_type),
    cardNumberMasked: card.masked,
    cardLast4: card.last4,
    merchantNumber: asText(row.merchant_number),
    terminalNumber: asText(row.terminal_number),
    siteNumber: asText(row.site_number),
    odometerReading: normalizeUsageReading(row.odometer_reading),
    hourMeterReading: normalizeUsageReading(row.hour_meter_reading),
    extractionStatus: normalizeFuelSlipExtractionStatus(row.extraction_status),
    ocrConfidence: normalizeRateValue(row.ocr_confidence),
    reviewRequired: Boolean(row.review_required),
    createdAtIso: row.created_at ?? new Date().toISOString(),
    updatedAtIso: row.updated_at ?? row.created_at ?? new Date().toISOString(),
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

function inferAssetUsageMetric(row: FuelAssetRow): 'hours' | 'km' | 'both' | 'none' {
  const kind = asText(row.kind).toLowerCase();
  const specs = asRecord(row.specs_json);
  const rawMetric = asText(specs.usageMetric ?? specs.usage_metric ?? specs.meterType ?? specs.meter_type ?? specs.depreciationMetric ?? specs.depreciation_metric).toLowerCase();

  if (rawMetric === 'both' || rawMetric === 'km_hours' || rawMetric === 'hours_km') return 'both';
  if (['km', 'kms', 'kilometres', 'kilometers', 'odometer'].includes(rawMetric)) return 'km';
  if (['hours', 'hour', 'hrs', 'engine_hours', 'hour_meter'].includes(rawMetric)) return 'hours';

  if (kind === 'vehicle' || /\b(?:vehicle|truck|bus|trailer|motorcycle|bakkie|sedan|suv|car)\b/i.test(asText(row.equipment_family_label))) {
    return 'km';
  }

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
    fuelPercent: normalizeFuelPercent(row.fuel_percent),
    yearModel: normalizeUsageReading(row.year_model ?? specs.yearModel ?? specs.year_model),
    condition: asText(row.condition ?? specs.condition),
    selectedMethod: asText(row.selected_method ?? specs.selectedMethod ?? specs.selected_method),
    currentValue: normalizeMoneyValue(row.current_value ?? specs.currentValue ?? specs.current_value ?? specs.valuationValue ?? specs.valuation_value),
    canReceiveFuel: inferAssetCanReceiveFuel(row),
    usageMetric: inferAssetUsageMetric(row),
  };
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
    fs.target_type as fs_target_type,
    fs.supplier_name as fs_supplier_name,
    fs.fuel_type as fs_fuel_type,
    fs.document_date as fs_document_date,
    fs.document_time as fs_document_time,
    fs.document_file_url as fs_document_file_url,
    fs.payment_method as fs_payment_method,
    fs.card_number_masked as fs_card_number_masked,
    fs.card_last4 as fs_card_last4,
    fs.extraction_status as fs_extraction_status,
    fs.review_required as fs_review_required,
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
    fs.extraction_status,
    fs.ocr_confidence,
    fs.review_required,
    fs.created_at,
    fs.updated_at
  `;
}

export async function ensureFuelLedgerTables(): Promise<void> {
  if (fuelLedgerTablesEnsured) {
    return;
  }

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
      add column if not exists condition text,
      add column if not exists note text,
      add column if not exists photo_urls jsonb not null default '[]'::jsonb,
      add column if not exists latitude double precision,
      add column if not exists longitude double precision,
      add column if not exists location_text text,
      add column if not exists maintenance_noted_at timestamptz,
      add column if not exists client_event_id text,
      add column if not exists client_captured_at timestamptz,
      add column if not exists synced_at timestamptz,
      add column if not exists gps_accuracy_meters double precision,
      add column if not exists created_at timestamptz not null default now();

    create unique index if not exists idx_asset_scan_events_client_event_id
      on public.asset_scan_events(client_event_id)
      where client_event_id is not null;

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
      litres numeric(12,3) not null,
      price_per_litre numeric(14,4),
      total_amount numeric(14,2) not null,
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
      extraction_status text not null default 'manual',
      ocr_confidence numeric(5,2),
      review_required boolean not null default false,
      raw_extracted_text text,
      extraction_warnings jsonb not null default '[]'::jsonb,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );

    alter table if exists public.fuel_slips
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
      add column if not exists extraction_status text not null default 'manual',
      add column if not exists ocr_confidence numeric(5,2),
      add column if not exists review_required boolean not null default false,
      add column if not exists raw_extracted_text text,
      add column if not exists extraction_warnings jsonb not null default '[]'::jsonb,
      add column if not exists created_at timestamptz not null default now(),
      add column if not exists updated_at timestamptz not null default now();

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
      alter column litres type numeric(12,3) using litres::numeric(12,3);

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
      litres = greatest(0, coalesce(litres, 0)),
      total_amount = greatest(0, coalesce(total_amount, 0)),
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

    create index if not exists idx_fuel_slips_user_created
      on public.fuel_slips(user_id, created_at desc);

    create index if not exists idx_fuel_slips_asset_created
      on public.fuel_slips(asset_register_item_id, created_at desc)
      where asset_register_item_id is not null;

    create index if not exists idx_fuel_slips_storage_created
      on public.fuel_slips(storage_id, created_at desc)
      where storage_id is not null;
  `);

  fuelLedgerTablesEnsured = true;
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
        a.hours,
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
        coalesce(a.specs_json, '{}'::jsonb) as specs_json
      from public.asset_register_items a
      left join public.valuation_runs vr
        on vr.id = a.valuation_run_id
      left join public.equipment_families ef
        on ef.id = coalesce(a.equipment_family_id, vr.equipment_family_id)
      where a.user_id = $1
        and coalesce(to_jsonb(a)->>'qr_status', 'active') <> 'deleted'
      order by lower(coalesce(a.title, '')), a.id::text
    `,
    [userId],
  );

  return result.rows.map(mapFuelAssetRow);
}

async function listFuelEvents(userId: string, options: { storageId?: string; limit?: number; fromIso?: string; toIso?: string; includeFuelSlipEvents?: boolean } = {}): Promise<FuelLedgerEvent[]> {
  await ensureFuelLedgerTables();
  const db = getDb();
  const limit = Math.max(1, Math.min(2000, Math.round(options.limit ?? 80)));
  const params: unknown[] = [userId];
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
    filter += ` and e.created_at >= $${params.length}::timestamptz`;
  }

  if (options.toIso) {
    params.push(options.toIso);
    filter += ` and e.created_at < $${params.length}::timestamptz`;
  }

  const result = await db.query<FuelEventRow>(
    `
      select ${fuelEventSelectSql()}
      from public.fuel_storage_events e
      left join public.fuel_storage_units s on s.id = e.storage_id
      left join public.asset_register_items a on a.id::text = e.asset_register_item_id
      left join public.fuel_slips fs on fs.id = e.fuel_slip_id
      where ${filter}
      order by e.created_at desc, e.id desc
      limit ${limit}
    `,
    params,
  );

  return result.rows.map(mapFuelEventRow);
}



function fuelSlipReportDateIso(slip: FuelSlipTransaction): string {
  if (slip.documentDate) {
    const rawTime = /^\d{2}:\d{2}(?::\d{2})?$/.test(slip.documentTime) ? slip.documentTime : '00:00:00';
    const time = rawTime.length === 5 ? `${rawTime}:00` : rawTime;
    const parsed = new Date(`${slip.documentDate}T${time}+02:00`);

    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toISOString();
    }
  }

  return slip.createdAtIso;
}

function fuelSlipReportNote(slip: FuelSlipTransaction): string {
  const parts = [
    slip.supplierName ? `Supplier: ${slip.supplierName}` : '',
    slip.fuelType ? `Fuel type: ${slip.fuelType}` : '',
    slip.slipNumber ? `Slip: ${slip.slipNumber}` : '',
    slip.transactionNumber ? `Transaction: ${slip.transactionNumber}` : '',
    slip.paymentMethod ? `Payment: ${slip.paymentMethod}` : '',
    formatCardEnding(slip.cardNumberMasked, slip.cardLast4),
    slip.documentFileUrl ? `Document: ${slip.documentFileUrl}` : '',
    `Review: ${fuelSlipReviewStatusLabel(slip.extractionStatus, slip.reviewRequired)}`,
  ].filter(Boolean);

  return parts.join(' · ') || 'Fuel Slip';
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
    totalAmount: null,
    documentFileUrl: slip.documentFileUrl,
    paymentMethod: slip.paymentMethod,
    cardNumberMasked: slip.cardNumberMasked,
    assetId: slip.assetId,
    assetTitle: slip.assetTitle,
    assetPlateLabel: '',
    litres: slip.litres,
    storageLevelBefore: null,
    storageLevelAfter: null,
    assetFuelPercentBefore: null,
    assetFuelPercentAfter: null,
    assetUsageReading: usageReading,
    operatorName: slip.supplierName || 'Fuel Slip',
    activityText: 'Fuel Slip',
    workAreaText: isStorageTarget ? 'Storage tank' : 'External fuel purchase',
    note: fuelSlipReportNote(slip),
    latitude: null,
    longitude: null,
    locationText: '',
    createdAtIso: fuelSlipReportDateIso(slip),
  };
}

async function listFuelSlipEventsForReport(
  userId: string,
  options: { storageId?: string; limit?: number; fromIso?: string; toIso?: string } = {},
): Promise<FuelLedgerEvent[]> {
  await ensureFuelLedgerTables();
  const db = getDb();
  const limit = Math.max(1, Math.min(2000, Math.round(options.limit ?? 2000)));
  const params: unknown[] = [userId];
  const dateExpression = `coalesce(fs.document_date::timestamptz, fs.created_at)`;
  let filter = `fs.user_id = $1 and (fs.target_type = 'asset' or fs.fuel_storage_event_id is null)`;

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
      limit ${limit}
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
      where fs.user_id = $1
      order by fs.created_at desc, fs.id desc
      limit ${limit}
    `,
    [userId],
  );

  return result.rows.map(mapFuelSlipRow);
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


export async function archiveFuelStorage(userId: string, storageId: string): Promise<void> {
  await ensureFuelLedgerTables();
  const db = getDb();

  await db.query(
    `
      update public.fuel_storage_units
      set status = 'archived', updated_at = now()
      where user_id = $1 and id::text = $2
    `,
    [userId, storageId],
  );
}

export async function deleteFuelStorage(userId: string, storageId: string): Promise<void> {
  await ensureFuelLedgerTables();
  const db = getDb();
  const client = await db.connect();

  try {
    await client.query('BEGIN');

    const storageResult = await client.query<{ id: string }>(
      `
        select id::text
        from public.fuel_storage_units
        where user_id = $1 and id::text = $2
        limit 1
      `,
      [userId, storageId],
    );

    if (!storageResult.rows[0]) {
      throw new Error('Fuel storage not found.');
    }

    await client.query(
      `
        delete from public.asset_scan_events
        where fuel_storage_id::text = $1
      `,
      [storageId],
    );

    await client.query(
      `
        delete from public.fuel_storage_events
        where user_id = $1 and storage_id::text = $2
      `,
      [userId, storageId],
    );

    await client.query(
      `
        delete from public.fuel_storage_units
        where user_id = $1 and id::text = $2
      `,
      [userId, storageId],
    );

    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
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
    operatorName: string;
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
        created_at
      )
      values ($1::uuid, $2, $3, $4, $5, $6::uuid, $7::numeric, $8, $9, $10, $11, $12::numeric, $13::numeric, $14::numeric, $15::integer, $16::integer, $17::numeric, $18, $19, $20, $21, $22::double precision, $23::double precision, $24, $25::text, $26::timestamptz, now(), $27::double precision, coalesce($26::timestamptz, now()))
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
  let committed = false;

  if (assetFuelPercentAfter === null) {
    throw new Error('Choose the asset fuel percentage after filling.');
  }

  if (operatorName.length < 2) {
    throw new Error('Enter the operator or manager name.');
  }

  if (input.actorType === 'scan_pin' && activityText.length < 2) {
    throw new Error('Enter what activity the asset will do.');
  }

  if (input.actorType === 'scan_pin' && workAreaText.length < 2) {
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

    const assetResult = await client.query<{
      id: string;
      title: string | null;
      plate_label: string | null;
      public_asset_code: string | null;
      hours: string | number | null;
      fuel_percent: string | number | null;
      valuation_run_id: string | number | null;
      selected_method: string | null;
      specs_json: unknown;
    }>(
      `
        select
          a.id::text,
          a.title,
          to_jsonb(a)->>'plate_label' as plate_label,
          to_jsonb(a)->>'public_asset_code' as public_asset_code,
          a.hours,
          to_jsonb(a)->>'fuel_percent' as fuel_percent,
          a.valuation_run_id,
          a.selected_method,
          coalesce(a.specs_json, '{}'::jsonb) as specs_json
        from public.asset_register_items a
        where a.user_id = $1 and a.id::text = $2
        for update
      `,
      [input.userId, input.assetId],
    );

    const asset = assetResult.rows[0];
    if (!asset) {
      throw new Error('Asset not found.');
    }

    const currentUsageReading = normalizeUsageReading(asset.hours);
    if (assetUsageReading !== null && currentUsageReading !== null && assetUsageReading < currentUsageReading) {
      throw new Error('The usage reading cannot be lower than the reading already saved on this asset.');
    }

    const usageReadingChanged = assetUsageReading !== null && assetUsageReading !== currentUsageReading;
    const shouldMarkValuationNeedsUpdate = usageReadingChanged && hasSavedFuelAssetValuation(asset);
    const nextSpecsJson = shouldMarkValuationNeedsUpdate
      ? markFuelAssetValuationNeedsUpdate(asRecord(asset.specs_json), ['usage changed'])
      : asRecord(asset.specs_json);

    const storageBefore = storage.currentLitres;
    const storageAfter = roundLitres(storageBefore - litres);
    const assetFuelPercentBefore = assetFuelPercentBeforeInput ?? normalizeFuelPercent(asset.fuel_percent);
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
          created_at
        )
        values ($1::uuid, $2, $3, $4, $5, $6::numeric, $7::integer, $8::numeric, $9::uuid, $10::uuid, null, $11, '[]'::jsonb, $12::double precision, $13::double precision, $14, $15::text, $16::timestamptz, now(), $17::double precision, coalesce($16::timestamptz, now()))
      `,
      [
        input.assetId,
        input.actorType === 'owner_session' ? 'owner_session' : 'scan_pin',
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


type SaveFuelSlipInput = {
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
  extractionStatus?: unknown;
  ocrConfidence?: unknown;
  reviewRequired?: unknown;
  rawExtractedText?: unknown;
  extractionWarnings?: unknown;
};

type FuelSlipSaveResult = {
  fuelSlip: FuelSlipTransaction;
  storage: FuelLedgerStorage | null;
  event: FuelLedgerEvent | null;
  assets: FuelLedgerAsset[];
};

type FuelSlipAssetRow = FuelAssetRow & {
  valuation_run_id: string | number | null;
  selected_method: string | null;
};

function normalizeExtractionWarnings(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((entry) => asText(entry)).filter(Boolean).slice(0, 12);
}

function buildFuelSlipDescription(input: { fuelType: string; litres: number; pricePerLitre: number | null; totalAmount: number }): string {
  const parts = ['Fuel Slip'];
  if (input.fuelType) parts.push(input.fuelType);
  parts.push(`${input.litres.toLocaleString('en-ZA', { maximumFractionDigits: 3 })} L`);
  if (input.pricePerLitre !== null) parts.push(`R${input.pricePerLitre.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 4 })}/L`);
  parts.push(`R${input.totalAmount.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
  return parts.join(' · ');
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

export async function saveFuelSlipTransaction(userId: string, input: SaveFuelSlipInput): Promise<FuelSlipSaveResult> {
  await ensureFuelLedgerTables();

  const db = getDb();
  const client = await db.connect();
  const targetType = normalizeFuelSlipTargetType(input.targetType);
  const rawTargetId = trimText(input.targetId, 120);
  const targetId = rawTargetId.includes(':') ? rawTargetId.split(':').pop() ?? rawTargetId : rawTargetId;
  const assetId = targetType === 'asset' ? trimText(input.assetId, 80) || targetId : '';
  const storageId = targetType === 'storage_tank' ? trimText(input.storageId, 80) || targetId : '';
  const captureMode = trimText(input.mode, 20).toLowerCase() === 'automatic' ? 'automatic' : 'manual';
  const litres = normalizePositiveLitres(input.litres);
  const totalAmount = normalizeMoneyValue(input.totalAmount);
  const documentDate = normalizeDateOnly(input.documentDate);
  const documentTime = normalizeTimeText(input.documentTime);
  const uploadId = trimText(input.uploadId, 160);
  const documentFileUrl = trimText(input.documentFileUrl, 500) || buildAssetRegisterUploadUrl(uploadId);
  const originalFilename = trimText(input.originalFilename, 180);
  const contentType = trimText(input.contentType, 120);
  const byteSize = asNumber(input.byteSize);
  const supplierName = trimText(input.supplierName, 180);
  const supplierVatNumber = trimText(input.supplierVatNumber, 40).replace(/[^0-9A-Za-z -]/g, '');
  const slipNumber = trimText(input.slipNumber, 120);
  const transactionNumber = trimText(input.transactionNumber, 120);
  const fuelType = trimText(input.fuelType, 120) || 'Fuel';
  const pricePerLitre = normalizeRateValue(input.pricePerLitre);
  const vatAmount = normalizeMoneyValue(input.vatAmount);
  const vatIncluded = normalizeBoolean(input.vatIncluded);
  const vatRate = normalizeRateValue(input.vatRate);
  const paymentMethod = trimText(input.paymentMethod, 80);
  const cardType = trimText(input.cardType, 80);
  const card = normalizeMaskedCard(input.cardNumberMasked, input.cardLast4);
  const merchantNumber = trimText(input.merchantNumber, 80);
  const terminalNumber = trimText(input.terminalNumber, 80);
  const siteNumber = trimText(input.siteNumber, 80);
  const odometerReading = normalizeUsageReading(input.odometerReading);
  const hourMeterReading = normalizeUsageReading(input.hourMeterReading);
  const extractionStatus = captureMode === 'manual' ? 'manual' : normalizeFuelSlipExtractionStatus(input.extractionStatus);
  const ocrConfidence = normalizeRateValue(input.ocrConfidence);
  const reviewRequired = (normalizeBoolean(input.reviewRequired) ?? false) || extractionStatus === 'needs_review';
  const rawExtractedText = maskStoredFuelSlipRawText(trimText(input.rawExtractedText, 20000));
  const extractionWarnings = normalizeExtractionWarnings(input.extractionWarnings);
  const description = buildFuelSlipDescription({ fuelType, litres, pricePerLitre, totalAmount: totalAmount ?? 0 });
  let committed = false;

  if (totalAmount === null) {
    throw new Error('Enter the total amount from the fuel slip.');
  }

  if (!documentDate) {
    throw new Error('Enter the fuel slip date.');
  }

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

    let asset: FuelLedgerAsset | null = null;
    let storage: FuelLedgerStorage | null = null;

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
            a.hours,
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
          for update
        `,
        [userId, assetId],
      );

      const assetRow = assetResult.rows[0];
      if (!assetRow) throw new Error('Asset not found.');
      asset = mapFuelAssetRow(assetRow);

      if ((asset.usageMetric === 'km' || asset.usageMetric === 'both') && odometerReading === null) {
        throw new Error('Enter the current km/odometer reading for this asset.');
      }

      if ((asset.usageMetric === 'hours' || asset.usageMetric === 'both') && hourMeterReading === null) {
        throw new Error('Enter the current hour-meter reading for this asset.');
      }

      const relevantUsageReading = asset.usageMetric === 'km' ? odometerReading : hourMeterReading ?? odometerReading;
      const currentUsageReading = normalizeUsageReading(assetRow.hours);
      if (relevantUsageReading !== null && currentUsageReading !== null && relevantUsageReading < currentUsageReading) {
        throw new Error('The usage reading cannot be lower than the reading already saved on this asset.');
      }
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

      const storageAfter = roundLitres(storage.currentLitres + litres);
      if (storage.capacityLitres !== null && storageAfter > storage.capacityLitres + 0.001) {
        throw new Error(`Storage refill exceeds tank capacity. Capacity is ${storage.capacityLitres.toLocaleString('en-ZA', { maximumFractionDigits: 3 })} L.`);
      }
    }

    const insertedSlip = await client.query<{ id: string }>(
      `
        insert into public.fuel_slips (
          user_id,
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
          extraction_status,
          ocr_confidence,
          review_required,
          raw_extracted_text,
          extraction_warnings
        ) values ($1, 'fuel_slip', 'Fuel Slip', $2, $3::uuid, $4::uuid, $5, $6, $7, $8, $9::integer, $10, $11, $12, $13, $14::date, $15, $16, $17::numeric, $18::numeric, $19::numeric, $20::numeric, $21::boolean, $22::numeric, $23, $24, $25, $26, $27, $28, $29, $30::numeric, $31::numeric, $32, $33::numeric, $34::boolean, $35, $36::jsonb)
        returning id::text
      `,
      [
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
        extractionStatus,
        ocrConfidence,
        reviewRequired,
        rawExtractedText || null,
        JSON.stringify(extractionWarnings),
      ],
    );

    const fuelSlipId = insertedSlip.rows[0]?.id;
    if (!fuelSlipId) throw new Error('Fuel slip could not be saved.');

    let event: FuelLedgerEvent | null = null;

    if (targetType === 'storage_tank' && storage) {
      const storageBefore = storage.currentLitres;
      const storageAfter = roundLitres(storageBefore + litres);

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
        totalAmount,
        documentFileUrl: documentFileUrl || null,
        paymentMethod: paymentMethod || null,
        cardNumberMasked: card.masked || null,
        assetId: null,
        litres,
        storageLevelBefore: storageBefore,
        storageLevelAfter: storageAfter,
        assetFuelPercentBefore: null,
        assetFuelPercentAfter: null,
        assetUsageReading: null,
        operatorName: supplierName || 'Fuel Slip',
        activityText: 'Fuel Slip',
        workAreaText: null,
        note: description,
        latitude: null,
        longitude: null,
        locationText: null,
      });

      await client.query(
        `update public.fuel_slips set fuel_storage_event_id = $2::uuid, updated_at = now() where user_id = $1 and id::text = $3`,
        [userId, event.id, fuelSlipId],
      );
    }

    if (targetType === 'asset' && asset) {
      const usageMetric = asset.usageMetric === 'km' ? 'km' : asset.usageMetric === 'hours' ? 'hours' : asset.usageMetric === 'both' ? (hourMeterReading !== null ? 'hours' : 'km') : 'none';
      const usageReading = usageMetric === 'km' ? odometerReading : usageMetric === 'hours' ? hourMeterReading : null;
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
            extractionStatus === 'needs_review' ? 'extracted' : extractionStatus === 'extracted' ? 'extracted' : 'skipped',
            JSON.stringify(extractionWarnings),
          ],
        );
        invoiceDocumentId = documentResult.rows[0]?.id ?? null;
      }

      const subtotalExVat = vatAmount !== null ? Math.max(0, Math.round((totalAmount - vatAmount) * 100) / 100) : null;
      const noteLines = [
        'Fuel Slip',
        supplierName ? `Supplier: ${supplierName}` : '',
        fuelType ? `Fuel type: ${fuelType}` : '',
        paymentMethod ? `Payment: ${paymentMethod}` : '',
        card.last4 ? `Card ending ${card.last4}` : '',
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
          documentDate,
          subtotalExVat,
          vatAmount,
          totalAmount,
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
          [assetInvoiceId, description, subtotalExVat, vatAmount, totalAmount],
        );
      }

      const nextSpecs = {
        ...(asset ? asRecord((await client.query<{ specs_json: unknown }>('select coalesce(specs_json, \'{}\'::jsonb) as specs_json from public.asset_register_items where user_id = $1 and id::text = $2 limit 1', [userId, assetId])).rows[0]?.specs_json) : {}),
        lastFuelSlipId: fuelSlipId,
        last_fuel_slip_id: fuelSlipId,
        lastFuelSlipLitres: litres,
        last_fuel_slip_litres: litres,
        lastFuelSlipAmount: totalAmount,
        last_fuel_slip_amount: totalAmount,
        lastFuelSlipDate: documentDate,
        last_fuel_slip_date: documentDate,
        lastFuelSlipOdometerReading: odometerReading,
        last_fuel_slip_odometer_reading: odometerReading,
        lastFuelSlipHourMeterReading: hourMeterReading,
        last_fuel_slip_hour_meter_reading: hourMeterReading,
      };

      await client.query(
        `
          update public.asset_register_items
          set
            hours = case when $3::numeric is null then hours else $3::numeric end,
            specs_json = $4::jsonb,
            updated_at = now()
          where user_id = $1 and id::text = $2
        `,
        [userId, assetId, usageReading, JSON.stringify(nextSpecs)],
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
            fuel_litres,
            fuel_storage_id,
            fuel_storage_event_id,
            note,
            photo_urls,
            created_at
          ) values ($1::uuid, 'owner_session', $2, 'Fuel Slip', null, $3::numeric, $4::numeric, null, null, $5, $6::jsonb, now())
        `,
        [assetId, supplierName || 'Fuel Slip', usageReading, litres, description, JSON.stringify(documentFileUrl ? [documentFileUrl] : [])],
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

    return {
      fuelSlip,
      storage: updatedStorage,
      event,
      assets,
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

export async function authorizeFuelStorageScanAccess(
  request: NextRequest,
  publicFuelStorageCode: string,
): Promise<
  | { ok: true; storage: FuelLedgerStorage; ownerUserId: string }
  | { ok: false; status: number; error: string; pinRequired: boolean }
> {
  const storage = await getFuelStorageByPublicCode(publicFuelStorageCode);

  if (!storage) {
    return { ok: false, status: 404, error: 'Fuel storage not found.', pinRequired: false };
  }

  if (storage.status !== 'active') {
    return { ok: false, status: 404, error: 'This fuel storage QR code is archived.', pinRequired: false };
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
  const limit = Math.max(1, Math.min(2000, Math.round(options.limit ?? 2000)));
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

  return [...events, ...fuelSlipEvents]
    .sort((left, right) => {
      const leftDate = new Date(left.createdAtIso).getTime();
      const rightDate = new Date(right.createdAtIso).getTime();

      if (Number.isFinite(leftDate) && Number.isFinite(rightDate) && leftDate !== rightDate) {
        return rightDate - leftDate;
      }

      return right.id.localeCompare(left.id);
    })
    .slice(0, limit);
}
