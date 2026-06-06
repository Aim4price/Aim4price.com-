import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import type { PoolClient } from 'pg';
import type { NextRequest, NextResponse } from 'next/server';
import { getDb } from './db';
import { hashScanPin, verifyScanPin } from './scan-pin';
import { revalueAssetRegisterItem } from './asset-register-revaluation';
import { ensureAccountProfileColumns } from './account-profile';

export const FUEL_SCAN_COOKIE_NAME = 'aim4price_fuel_scan';
export const FUEL_SCAN_SESSION_MAX_AGE_SECONDS = 60 * 60 * 12;

export type FuelStorageStatus = 'active' | 'archived';
export type FuelStorageEventType = 'opening_balance' | 'stock_in' | 'asset_issue' | 'dip' | 'adjustment';
export type FuelScanActorType = 'owner_session' | 'scan_pin';

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
  canReceiveFuel: boolean;
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
  family_is_propelled: boolean | string | number | null;
  specs_json: unknown;
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
  return Math.round(value * 100) / 100;
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
  return {
    id: asText(row.id),
    storageId: asText(row.storage_id),
    storageName: asText(row.storage_name) || 'Fuel storage',
    storagePublicCode: normalizeFuelStorageCode(row.storage_public_code),
    eventType: normalizeEventType(row.event_type),
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

function mapFuelAssetRow(row: FuelAssetRow): FuelLedgerAsset {
  const familyLabel = asText(row.equipment_family_label);
  const kind = asText(row.kind).toLowerCase();

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
    canReceiveFuel: inferAssetCanReceiveFuel(row),
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
      created_at timestamptz not null default now()
    );

    alter table if exists public.asset_scan_events
      add column if not exists operator_name text,
      add column if not exists activity_text text,
      add column if not exists work_area_text text,
      add column if not exists hours numeric(14,2),
      add column if not exists fuel_percent integer,
      add column if not exists fuel_litres numeric(12,2),
      add column if not exists fuel_storage_id uuid,
      add column if not exists fuel_storage_event_id uuid,
      add column if not exists condition text,
      add column if not exists note text,
      add column if not exists photo_urls jsonb not null default '[]'::jsonb,
      add column if not exists latitude double precision,
      add column if not exists longitude double precision,
      add column if not exists location_text text,
      add column if not exists created_at timestamptz not null default now();

    create table if not exists public.fuel_storage_units (
      id uuid primary key default gen_random_uuid(),
      user_id text not null,
      name text not null,
      fuel_type text not null default 'diesel',
      capacity_litres numeric(12,2),
      current_litres numeric(12,2) not null default 0,
      reorder_level_litres numeric(12,2),
      location_label text,
      notes text,
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
      add column if not exists capacity_litres numeric(12,2),
      add column if not exists current_litres numeric(12,2) not null default 0,
      add column if not exists reorder_level_litres numeric(12,2),
      add column if not exists location_label text,
      add column if not exists notes text,
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
      asset_register_item_id text,
      litres numeric(12,2) not null default 0,
      storage_level_before_litres numeric(12,2),
      storage_level_after_litres numeric(12,2),
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
      created_at timestamptz not null default now()
    );

    alter table if exists public.fuel_storage_events
      add column if not exists storage_id uuid,
      add column if not exists user_id text,
      add column if not exists event_type text,
      add column if not exists asset_register_item_id text,
      add column if not exists litres numeric(12,2) not null default 0,
      add column if not exists storage_level_before_litres numeric(12,2),
      add column if not exists storage_level_after_litres numeric(12,2),
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

async function listFuelEvents(userId: string, options: { storageId?: string; limit?: number; fromIso?: string; toIso?: string } = {}): Promise<FuelLedgerEvent[]> {
  await ensureFuelLedgerTables();
  const db = getDb();
  const limit = Math.max(1, Math.min(500, Math.round(options.limit ?? 80)));
  const params: unknown[] = [userId];
  let filter = 'e.user_id = $1';

  if (options.storageId) {
    params.push(options.storageId);
    filter += ` and e.storage_id::text = $${params.length}`;
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
      where ${filter}
      order by e.created_at desc, e.id desc
      limit ${limit}
    `,
    params,
  );

  return result.rows.map(mapFuelEventRow);
}

export async function listFuelLedger(userId: string): Promise<FuelLedgerData> {
  await ensureFuelLedgerTables();
  const db = getDb();

  const [storageResult, events, assets, totalsResult] = await Promise.all([
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
  const lowStorageCount = activeStorages.filter((storage) => storage.reorderLevelLitres !== null && storage.currentLitres <= storage.reorderLevelLitres).length;
  const totals = totalsResult.rows[0];

  return {
    storages,
    recentEvents: events,
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
  },
): Promise<{ storage: FuelLedgerStorage; event: FuelLedgerEvent }> {
  await ensureFuelLedgerTables();
  const db = getDb();
  const client = await db.connect();
  const mode = String(input.mode ?? '').trim().toLowerCase() === 'dip' ? 'dip' : 'stock_in';
  const operatorName = asText(input.operatorName) || 'Owner entry';

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

    const before = storage.currentLitres;
    const litres = mode === 'stock_in' ? normalizePositiveLitres(input.litres) : Math.abs((normalizeOptionalLitres(input.currentLitres) ?? before) - before);
    const after = mode === 'stock_in' ? roundLitres(before + litres) : (normalizeOptionalLitres(input.currentLitres) ?? before);
    const eventType: FuelStorageEventType = mode === 'stock_in' ? 'stock_in' : 'dip';

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
      note: asText(input.note) || (eventType === 'stock_in' ? 'Fuel added to storage.' : 'Manual storage dip captured.'),
      latitude: null,
      longitude: null,
      locationText: null,
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
  },
): Promise<FuelLedgerEvent> {
  const inserted = await client.query<{ id: string }>(
    `
      insert into public.fuel_storage_events (
        storage_id,
        user_id,
        event_type,
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
        created_at
      )
      values ($1::uuid, $2, $3, $4, $5::numeric, $6::numeric, $7::numeric, $8::integer, $9::integer, $10::numeric, $11, $12, $13, $14, $15::double precision, $16::double precision, $17, now())
      returning id::text
    `,
    [
      input.storageId,
      input.userId,
      input.eventType,
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
    const shouldTryRevalueAfterCommit = usageReadingChanged && hasSavedFuelAssetValuation(asset);
    const nextSpecsJson = shouldTryRevalueAfterCommit
      ? markFuelAssetValuationNeedsUpdate(asRecord(asset.specs_json), ['usage changed'])
      : asRecord(asset.specs_json);

    const storageBefore = storage.currentLitres;
    const storageAfter = roundLitres(storageBefore - litres);
    const assetFuelPercentBefore = assetFuelPercentBeforeInput ?? normalizeFuelPercent(asset.fuel_percent);
    const noteText = asText(input.note);
    const storageNote = `Fuel issued from ${storage.name}: ${litres.toLocaleString('en-ZA', { maximumFractionDigits: 2 })} litres.`;
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
    });

    await client.query(
      `
        update public.asset_register_items
        set
          fuel_percent = $3::integer,
          hours = case when $4::numeric is null then hours else $4::numeric end,
          last_scanned_at = now(),
          last_known_lat = $5::double precision,
          last_known_lng = $6::double precision,
          last_known_location_text = $7,
          specs_json = $8::jsonb,
          updated_at = now()
        where user_id = $1 and id::text = $2
      `,
      [input.userId, input.assetId, assetFuelPercentAfter, assetUsageReading, latitude, longitude, locationText, JSON.stringify(nextSpecsJson)],
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
          created_at
        )
        values ($1::uuid, $2, $3, $4, $5, $6::numeric, $7::integer, $8::numeric, $9::uuid, $10::uuid, null, $11, '[]'::jsonb, $12::double precision, $13::double precision, $14, now())
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

    if (shouldTryRevalueAfterCommit) {
      try {
        await revalueAssetRegisterItem({
          userId: input.userId,
          assetId: input.assetId,
        });
      } catch (error) {
        console.warn('fuel ledger automatic asset revaluation failed', error);
      }
    }

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
  storageIdOrOptions?: string | { storageId?: string; fromIso?: string; toIso?: string; limit?: number },
): Promise<FuelLedgerEvent[]> {
  const options = typeof storageIdOrOptions === 'string' ? { storageId: storageIdOrOptions } : storageIdOrOptions ?? {};

  return listFuelEvents(userId, {
    storageId: options.storageId,
    fromIso: options.fromIso,
    toIso: options.toIso,
    limit: options.limit ?? 2000,
  });
}
