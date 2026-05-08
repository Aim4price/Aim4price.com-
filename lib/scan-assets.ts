import { getDb } from './db';
import { MAX_ASSET_REGISTER_PHOTOS } from './asset-register-uploads';

export type ScanAssetQrStatus = 'active' | 'transferred' | 'retired' | 'deleted' | '';
export type ScanAccessMode = 'owner_session' | 'scan_pin';
export type ScanEventActorType = ScanAccessMode | 'admin_session';

export type ScanSafeAsset = {
  id: string;
  userId: string;
  publicAssetCode: string;
  plateLabel: string;
  qrStatus: ScanAssetQrStatus;
  title: string;
  serialNumber: string;
  hours: number | null;
  fuelPercent: number | null;
  condition: string;
  note: string;
  photos: string[];
  lastScannedAtIso: string | null;
  lastKnownLat: number | null;
  lastKnownLng: number | null;
  lastKnownLocationText: string;
  createdAtIso: string | null;
  updatedAtIso: string | null;
};

export type ScanAssetAccessContext = {
  asset: ScanSafeAsset;
  scanPinHash: string;
  scanPinEnabled: boolean;
  scanPinUpdatedAtIso: string | null;
};

export type ScanEventRecord = {
  id: string;
  actorType: ScanEventActorType;
  operatorName: string;
  hours: number | null;
  fuelPercent: number | null;
  condition: string;
  note: string;
  photoUrls: string[];
  latitude: number | null;
  longitude: number | null;
  locationText: string;
  createdAtIso: string;
};

export type SaveScanAssetEventInput = {
  publicAssetCode: string;
  actorType: ScanEventActorType;
  operatorName?: string | null;
  hours?: number | null;
  fuelPercent?: number | null;
  condition?: string | null;
  note?: string | null;
  photoUrls?: string[];
  latitude?: number | null;
  longitude?: number | null;
  locationText?: string | null;
};

type ScanAccessRow = {
  id: string | number;
  user_id: string | null;
  public_asset_code: string | null;
  plate_label: string | null;
  qr_status: string | null;
  title: string | null;
  serial_number: string | null;
  hours: string | number | null;
  fuel_percent: string | number | null;
  condition: string | null;
  note: string | null;
  photo_urls: unknown;
  last_scanned_at: string | null;
  last_known_lat: string | number | null;
  last_known_lng: string | number | null;
  last_known_location_text: string | null;
  created_at: string | null;
  updated_at: string | null;
  valuation_run_id?: string | number | null;
  selected_method?: string | null;
  specs_json?: unknown;
  scan_pin_hash: string | null;
  scan_pin_enabled: boolean | null;
  scan_pin_updated_at: string | null;
};

type ScanEventRow = {
  id: string | number;
  actor_type: string | null;
  operator_name: string | null;
  hours: string | number | null;
  fuel_percent: string | number | null;
  condition: string | null;
  note: string | null;
  photo_urls: unknown;
  latitude: string | number | null;
  longitude: string | number | null;
  location_text: string | null;
  created_at: string | null;
};

function asText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function asId(value: unknown): string {
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  if (typeof value === 'bigint') return value.toString();
  return '';
}

function asNumber(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function asStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((entry) => asText(entry)).filter(Boolean);
  }

  if (typeof value === 'string' && value.trim()) {
    try {
      const parsed = JSON.parse(value) as unknown;
      return Array.isArray(parsed) ? parsed.map((entry) => asText(entry)).filter(Boolean) : [];
    } catch {
      return [];
    }
  }

  return [];
}

function normalizePhotos(value: unknown): string[] {
  const seen = new Set<string>();

  return asStringArray(value)
    .slice(0, MAX_ASSET_REGISTER_PHOTOS)
    .filter((entry) => {
      if (!entry || seen.has(entry)) {
        return false;
      }

      seen.add(entry);
      return true;
    });
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

function hasSavedValuation(row: ScanAccessRow): boolean {
  const selectedMethod = asText(row.selected_method).toLowerCase();
  return Boolean(row.valuation_run_id && selectedMethod !== 'manual');
}

function markValuationNeedsUpdate(specs: Record<string, unknown>, reasons: string[]): Record<string, unknown> {
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

function normalizeQrStatus(value: unknown): ScanAssetQrStatus {
  const normalized = String(value ?? '').trim().toLowerCase();

  if (
    normalized === 'active' ||
    normalized === 'transferred' ||
    normalized === 'retired' ||
    normalized === 'deleted'
  ) {
    return normalized;
  }

  return '';
}

function normalizeCondition(value: unknown): string {
  const normalized = String(value ?? '').trim().toLowerCase();

  if (normalized === 'excellent') return 'excellent';
  if (normalized === 'good') return 'good';
  if (normalized === 'fair') return 'fair';
  if (normalized === 'used') return 'used';
  if (normalized === 'serious' || normalized === 'requires attention' || normalized === 'requires serious attention') {
    return 'serious';
  }

  return '';
}

function normalizeActorType(value: unknown): ScanEventActorType {
  const normalized = String(value ?? '').trim().toLowerCase();

  if (normalized === 'owner_session') return 'owner_session';
  if (normalized === 'admin_session') return 'admin_session';
  return 'scan_pin';
}

function mergePhotos(existing: string[], next: string[]): string[] {
  const seen = new Set<string>();
  const merged = [...existing, ...next].filter((entry) => {
    const normalized = asText(entry);

    if (!normalized || seen.has(normalized)) {
      return false;
    }

    seen.add(normalized);
    return true;
  });

  return merged.slice(0, MAX_ASSET_REGISTER_PHOTOS);
}

function mapScanSafeAsset(row: ScanAccessRow): ScanSafeAsset {
  return {
    id: asId(row.id),
    userId: asText(row.user_id),
    publicAssetCode: asText(row.public_asset_code),
    plateLabel: asText(row.plate_label),
    qrStatus: normalizeQrStatus(row.qr_status),
    title: asText(row.title),
    serialNumber: asText(row.serial_number),
    hours: asNumber(row.hours),
    fuelPercent: asNumber(row.fuel_percent),
    condition: normalizeCondition(row.condition),
    note: asText(row.note),
    photos: normalizePhotos(row.photo_urls),
    lastScannedAtIso: row.last_scanned_at ?? null,
    lastKnownLat: asNumber(row.last_known_lat),
    lastKnownLng: asNumber(row.last_known_lng),
    lastKnownLocationText: asText(row.last_known_location_text),
    createdAtIso: row.created_at ?? null,
    updatedAtIso: row.updated_at ?? null,
  };
}

function mapScanEventRow(row: ScanEventRow): ScanEventRecord {
  return {
    id: asId(row.id),
    actorType: normalizeActorType(row.actor_type),
    operatorName: asText(row.operator_name),
    hours: asNumber(row.hours),
    fuelPercent: asNumber(row.fuel_percent),
    condition: normalizeCondition(row.condition),
    note: asText(row.note),
    photoUrls: normalizePhotos(row.photo_urls),
    latitude: asNumber(row.latitude),
    longitude: asNumber(row.longitude),
    locationText: asText(row.location_text),
    createdAtIso: row.created_at ?? new Date().toISOString(),
  };
}

export function normalizePublicAssetCode(value: unknown): string {
  return String(value ?? '')
    .trim()
    .replace(/\s+/g, '')
    .toUpperCase();
}

export async function getScanAssetAccessContext(publicAssetCode: string): Promise<ScanAssetAccessContext | null> {
  const db = getDb();
  const normalizedCode = normalizePublicAssetCode(publicAssetCode);

  if (!normalizedCode) {
    return null;
  }

  const result = await db.query<ScanAccessRow>(
    `
      select
        a.id,
        a.user_id,
        a.public_asset_code,
        a.plate_label,
        a.qr_status,
        a.title,
        a.serial_number,
        a.hours,
        a.fuel_percent,
        a.condition,
        a.note,
        a.photo_urls,
        a.last_scanned_at,
        a.last_known_lat,
        a.last_known_lng,
        a.last_known_location_text,
        a.created_at,
        a.updated_at,
        coalesce(p.scan_pin_hash, '') as scan_pin_hash,
        coalesce(p.scan_pin_enabled, false) as scan_pin_enabled,
        p.scan_pin_updated_at
      from asset_register_items a
      left join account_profiles p
        on p.user_id = a.user_id
      where upper(a.public_asset_code) = $1
      limit 1
    `,
    [normalizedCode],
  );

  const row = result.rows[0];

  if (!row) {
    return null;
  }

  return {
    asset: mapScanSafeAsset(row),
    scanPinHash: asText(row.scan_pin_hash),
    scanPinEnabled: Boolean(row.scan_pin_enabled) && Boolean(asText(row.scan_pin_hash)),
    scanPinUpdatedAtIso: row.scan_pin_updated_at ?? null,
  };
}

export async function listScanEventsForAsset(assetId: string, limit = 250): Promise<ScanEventRecord[]> {
  const db = getDb();
  const safeLimit = Math.max(1, Math.min(500, Math.round(limit || 250)));

  const result = await db.query<ScanEventRow>(
    `
      select
        id,
        actor_type,
        operator_name,
        hours,
        fuel_percent,
        condition,
        note,
        photo_urls,
        latitude,
        longitude,
        location_text,
        created_at
      from asset_scan_events
      where asset_id = $1
      order by created_at desc, id desc
      limit ${safeLimit}
    `,
    [assetId],
  );

  return result.rows.map(mapScanEventRow);
}

export async function listRecentScanEvents(assetId: string, limit = 10): Promise<ScanEventRecord[]> {
  return listScanEventsForAsset(assetId, Math.max(1, Math.min(25, Math.round(limit || 10))));
}

export async function saveScanAssetEvent(input: SaveScanAssetEventInput): Promise<{
  asset: ScanSafeAsset;
  event: ScanEventRecord;
}> {
  const db = getDb();
  const normalizedCode = normalizePublicAssetCode(input.publicAssetCode);

  if (!normalizedCode) {
    throw new Error('Asset code is required.');
  }

  const client = await db.connect();

  try {
    await client.query('BEGIN');

    const assetLookup = await client.query<ScanAccessRow>(
      `
        select
          a.id,
          a.user_id,
          a.public_asset_code,
          a.plate_label,
          a.qr_status,
          a.title,
          a.serial_number,
          a.hours,
          a.fuel_percent,
          a.condition,
          a.note,
          a.photo_urls,
          a.last_scanned_at,
          a.last_known_lat,
          a.last_known_lng,
          a.last_known_location_text,
          a.created_at,
          a.updated_at,
          a.valuation_run_id,
          a.selected_method,
          a.specs_json,
          ''::text as scan_pin_hash,
          false as scan_pin_enabled,
          null::timestamptz as scan_pin_updated_at
        from asset_register_items a
        where upper(a.public_asset_code) = $1
        limit 1
      `,
      [normalizedCode],
    );

    const existingRow = assetLookup.rows[0];

    if (!existingRow) {
      throw new Error('Asset not found.');
    }

    const currentAsset = mapScanSafeAsset(existingRow);
    const nextOperatorName = asText(input.operatorName) || null;
    const nextHours = typeof input.hours === 'number' && Number.isFinite(input.hours) ? Math.max(0, Math.round(input.hours)) : null;
    const nextFuelPercent =
      typeof input.fuelPercent === 'number' && Number.isFinite(input.fuelPercent)
        ? Math.max(0, Math.min(100, Math.round(input.fuelPercent)))
        : null;
    const nextCondition = normalizeCondition(input.condition) || null;
    const nextNote = asText(input.note) || null;
    const nextPhotoUrls = normalizePhotos(input.photoUrls ?? []);
    const nextLatitude =
      typeof input.latitude === 'number' && Number.isFinite(input.latitude) && Math.abs(input.latitude) <= 90
        ? input.latitude
        : null;
    const nextLongitude =
      typeof input.longitude === 'number' && Number.isFinite(input.longitude) && Math.abs(input.longitude) <= 180
        ? input.longitude
        : null;
    const nextLocationText = asText(input.locationText) || null;

    if (nextHours !== null && currentAsset.hours !== null && nextHours < currentAsset.hours) {
      throw new Error('USAGE_READING_CANNOT_DECREASE');
    }

    const valuationStaleReasons: string[] = [];
    if (hasSavedValuation(existingRow)) {
      if (nextHours !== null && currentAsset.hours !== null && nextHours !== currentAsset.hours) {
        valuationStaleReasons.push('usage changed');
      }

      if (nextCondition && currentAsset.condition && nextCondition !== currentAsset.condition) {
        valuationStaleReasons.push('condition changed');
      }
    }

    const nextSpecsJson = markValuationNeedsUpdate(asRecord(existingRow.specs_json), valuationStaleReasons);

    const insertedEvent = await client.query<ScanEventRow>(
      `
        insert into asset_scan_events (
          asset_id,
          actor_type,
          operator_name,
          hours,
          fuel_percent,
          condition,
          note,
          photo_urls,
          latitude,
          longitude,
          location_text,
          created_at
        )
        values (
          $1,
          $2,
          $3,
          $4,
          $5,
          $6,
          $7,
          $8::jsonb,
          $9,
          $10,
          $11,
          now()
        )
        returning
          id,
          actor_type,
          operator_name,
          hours,
          fuel_percent,
          condition,
          note,
          photo_urls,
          latitude,
          longitude,
          location_text,
          created_at
      `,
      [
        currentAsset.id,
        normalizeActorType(input.actorType),
        nextOperatorName,
        nextHours,
        nextFuelPercent,
        nextCondition,
        nextNote,
        JSON.stringify(nextPhotoUrls),
        nextLatitude,
        nextLongitude,
        nextLocationText,
      ],
    );

    const mergedPhotos = mergePhotos(currentAsset.photos, nextPhotoUrls);
    const updatedAsset = await client.query<ScanAccessRow>(
      `
        update asset_register_items
        set
          hours = coalesce($2, hours),
          fuel_percent = coalesce($3, fuel_percent),
          condition = coalesce($4, condition),
          note = coalesce($5, note),
          photo_urls = $6::jsonb,
          last_scanned_at = now(),
          last_known_lat = coalesce($7, last_known_lat),
          last_known_lng = coalesce($8, last_known_lng),
          last_known_location_text = coalesce($9, last_known_location_text),
          specs_json = $10::jsonb,
          updated_at = now()
        where id = $1
        returning
          id,
          user_id,
          public_asset_code,
          plate_label,
          qr_status,
          title,
          serial_number,
          hours,
          fuel_percent,
          condition,
          note,
          photo_urls,
          last_scanned_at,
          last_known_lat,
          last_known_lng,
          last_known_location_text,
          created_at,
          updated_at,
          ''::text as scan_pin_hash,
          false as scan_pin_enabled,
          null::timestamptz as scan_pin_updated_at
      `,
      [
        currentAsset.id,
        nextHours,
        nextFuelPercent,
        nextCondition,
        nextNote,
        JSON.stringify(mergedPhotos),
        nextLatitude,
        nextLongitude,
        nextLocationText,
        JSON.stringify(nextSpecsJson),
      ],
    );

    await client.query('COMMIT');

    const assetRow = updatedAsset.rows[0];
    const eventRow = insertedEvent.rows[0];

    if (!assetRow || !eventRow) {
      throw new Error('Failed to save scan update.');
    }

    return {
      asset: mapScanSafeAsset(assetRow),
      event: mapScanEventRow(eventRow),
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
