import { getDb } from './db';
import { ensureAssetRegisterTables } from './asset-registers';

export type AssetLicenseRenewalAlert = {
  id: string;
  assetRegisterItemId: string;
  renewalDate: string;
  registrationNumber: string;
  computedStatus: 'due_soon' | 'due' | 'overdue';
  computedStatusLabel: 'Due soon' | 'Due' | 'Overdue';
  heading: string;
  body: string;
};

type AssetForLicenseRenewalAlert = {
  id: string;
  kind?: unknown;
  isLicensed?: unknown;
  licenseRegistrationNumber?: unknown;
  specsJson?: unknown;
};

type LicenseRenewalAlertStateRow = {
  id: string;
  kind: string | null;
  is_licensed: boolean | null;
  license_registration_number: string | null;
  specs_json: unknown;
  license_renewal_alert_noted_for_date: string | null;
};

type DateParts = {
  year: number;
  month: number;
  day: number;
  key: string;
  timestamp: number;
};

const DATE_KEY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const JOHANNESBURG_TIME_ZONE = 'Africa/Johannesburg';

function asText(value: unknown): string {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function firstNonEmptyText(...values: unknown[]): string {
  for (const value of values) {
    const text = asText(value);
    if (text) return text;
  }

  return '';
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function asBoolean(value: unknown): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value === 1;

  return ['true', '1', 'yes', 'y', 'on', 'licensed', 'licenced'].includes(asText(value).toLowerCase());
}

function padDatePart(value: number): string {
  return String(value).padStart(2, '0');
}

function dateKey(year: number, month: number, day: number): string {
  return `${String(year).padStart(4, '0')}-${padDatePart(month)}-${padDatePart(day)}`;
}

export function parseAssetLicenseDateKey(value: unknown): DateParts | null {
  const match = asText(value).match(DATE_KEY_PATTERN);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  if (year < 1000 || year > 9999 || month < 1 || month > 12 || day < 1 || day > 31) {
    return null;
  }

  const timestamp = Date.UTC(year, month - 1, day);
  const parsed = new Date(timestamp);

  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day
  ) {
    return null;
  }

  return { year, month, day, key: dateKey(year, month, day), timestamp };
}

export function assetLicenseAlertStartDateKey(renewalDate: string): string | null {
  const renewal = parseAssetLicenseDateKey(renewalDate);
  if (!renewal) return null;

  const targetMonthStart = new Date(Date.UTC(renewal.year, renewal.month - 2, 1));
  const targetYear = targetMonthStart.getUTCFullYear();
  const targetMonthIndex = targetMonthStart.getUTCMonth();
  const lastTargetDay = new Date(Date.UTC(targetYear, targetMonthIndex + 1, 0)).getUTCDate();

  return dateKey(targetYear, targetMonthIndex + 1, Math.min(renewal.day, lastTargetDay));
}

export function johannesburgDateKey(now = new Date()): string {
  try {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: JOHANNESBURG_TIME_ZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(now);
    const values = new Map(parts.map((part) => [part.type, part.value]));
    const candidate = `${values.get('year') ?? ''}-${values.get('month') ?? ''}-${values.get('day') ?? ''}`;
    const parsed = parseAssetLicenseDateKey(candidate);
    if (parsed) return parsed.key;
  } catch {
    // UTC is only a defensive fallback for runtimes without IANA time-zone data.
  }

  return dateKey(now.getUTCFullYear(), now.getUTCMonth() + 1, now.getUTCDate());
}

function formatDateLabel(value: string): string {
  const parsed = parseAssetLicenseDateKey(value);
  if (!parsed) return value;

  return new Intl.DateTimeFormat('en-ZA', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(parsed.timestamp));
}

function normalizeStatusChoice(value: unknown): 'yes' | 'no' | 'unknown' | 'not_applicable' | '' {
  const normalized = asText(value).toLowerCase().replace(/[\s-]+/g, '_');

  if (['yes', 'y', 'true', 'licensed', 'licenced', 'is_licensed'].includes(normalized)) return 'yes';
  if (['no', 'n', 'false', 'not_licensed', 'not_licenced', 'unlicensed', 'unlicenced'].includes(normalized)) return 'no';
  if (['na', 'n_a', 'not_applicable', 'does_not_apply'].includes(normalized)) return 'not_applicable';
  if (['unknown', 'not_sure', 'unsure'].includes(normalized)) return 'unknown';

  return '';
}

function isLicensedAsset(asset: AssetForLicenseRenewalAlert): boolean {
  if (asText(asset.kind).toLowerCase() === 'property') return false;

  const specs = asRecord(asset.specsJson);
  const savedStatus = normalizeStatusChoice(
    firstNonEmptyText(
      specs.licenseStatus,
      specs.license_status,
      specs.licensedStatus,
      specs.licensed_status,
      specs.licenceStatus,
      specs.licence_status,
      specs.licencedStatus,
      specs.licenced_status,
    ),
  );

  return savedStatus ? savedStatus === 'yes' : asBoolean(asset.isLicensed);
}

function readLicenseRenewalDate(asset: AssetForLicenseRenewalAlert): string {
  const specs = asRecord(asset.specsJson);

  return parseAssetLicenseDateKey(
    firstNonEmptyText(
      specs.licenseRenewalDate,
      specs.license_renewal_date,
      specs.licenceRenewalDate,
      specs.licence_renewal_date,
    ),
  )?.key ?? '';
}

function readLicenseRegistrationNumber(asset: AssetForLicenseRenewalAlert): string {
  const direct = asText(asset.licenseRegistrationNumber).toUpperCase();
  if (direct) return direct;

  const specs = asRecord(asset.specsJson);
  return firstNonEmptyText(
    specs.licenseRegistrationNumber,
    specs.license_registration_number,
    specs.licenceRegistrationNumber,
    specs.licence_registration_number,
    specs.registrationNumber,
    specs.registration_number,
    specs.numberPlate,
    specs.number_plate,
  ).toUpperCase();
}

export function buildAssetLicenseRenewalAlert(
  asset: AssetForLicenseRenewalAlert,
  notedForDate: unknown,
  todayKey = johannesburgDateKey(),
): AssetLicenseRenewalAlert | null {
  if (!isLicensedAsset(asset)) return null;

  const renewalDate = readLicenseRenewalDate(asset);
  const renewal = parseAssetLicenseDateKey(renewalDate);
  const today = parseAssetLicenseDateKey(todayKey);
  const alertStart = parseAssetLicenseDateKey(assetLicenseAlertStartDateKey(renewalDate));
  const notedDate = parseAssetLicenseDateKey(notedForDate)?.key ?? '';

  if (!renewal || !today || !alertStart || today.timestamp < alertStart.timestamp || notedDate === renewal.key) {
    return null;
  }

  const computedStatus = today.timestamp > renewal.timestamp
    ? 'overdue'
    : today.timestamp === renewal.timestamp
      ? 'due'
      : 'due_soon';
  const computedStatusLabel = computedStatus === 'overdue'
    ? 'Overdue'
    : computedStatus === 'due'
      ? 'Due'
      : 'Due soon';
  const registrationNumber = readLicenseRegistrationNumber(asset);
  const subject = registrationNumber ? `License ${registrationNumber}` : 'License';

  return {
    id: `license-renewal:${asset.id}:${renewal.key}`,
    assetRegisterItemId: asset.id,
    renewalDate: renewal.key,
    registrationNumber,
    computedStatus,
    computedStatusLabel,
    heading: 'License renewal upcoming',
    body: `${subject} needs to be renewed by ${formatDateLabel(renewal.key)}.`,
  };
}

export async function attachUpcomingLicenseRenewalAlertsToAssets<T extends AssetForLicenseRenewalAlert>(
  ownerUserId: string,
  assets: T[],
): Promise<Array<T & { licenseRenewalAlert: AssetLicenseRenewalAlert | null }>> {
  if (!assets.length) return [];

  await ensureAssetRegisterTables();

  const assetIds = assets.map((asset) => asText(asset.id)).filter(Boolean);
  if (!assetIds.length) return assets.map((asset) => ({ ...asset, licenseRenewalAlert: null }));

  const result = await getDb().query<Pick<LicenseRenewalAlertStateRow, 'id' | 'license_renewal_alert_noted_for_date'>>(
    `
      select
        id::text as id,
        license_renewal_alert_noted_for_date::text as license_renewal_alert_noted_for_date
      from public.asset_register_items
      where user_id = $1
        and id::text = any($2::text[])
    `,
    [ownerUserId, assetIds],
  );
  const notedDateByAssetId = new Map(
    result.rows.map((row) => [row.id, row.license_renewal_alert_noted_for_date]),
  );
  const todayKey = johannesburgDateKey();

  return assets.map((asset) => ({
    ...asset,
    licenseRenewalAlert: buildAssetLicenseRenewalAlert(asset, notedDateByAssetId.get(asset.id), todayKey),
  }));
}

export async function markAssetLicenseRenewalAlertNoted(
  ownerUserId: string,
  assetId: string,
  expectedRenewalDate: unknown,
): Promise<AssetLicenseRenewalAlert> {
  await ensureAssetRegisterTables();

  const expectedDate = parseAssetLicenseDateKey(expectedRenewalDate);
  if (!expectedDate) throw new Error('LICENSE_RENEWAL_DATE_REQUIRED');

  const db = getDb();
  const client = await db.connect();

  try {
    await client.query('BEGIN');

    const result = await client.query<LicenseRenewalAlertStateRow>(
      `
        select
          id::text as id,
          kind,
          is_licensed,
          license_registration_number,
          coalesce(specs_json, '{}'::jsonb) as specs_json,
          license_renewal_alert_noted_for_date::text as license_renewal_alert_noted_for_date
        from public.asset_register_items
        where user_id = $1
          and id::text = $2
        limit 1
        for update
      `,
      [ownerUserId, assetId],
    );
    const row = result.rows[0];

    if (!row) {
      throw new Error('ASSET_NOT_FOUND');
    }

    const currentAsset = {
      id: row.id,
      kind: row.kind,
      isLicensed: row.is_licensed,
      licenseRegistrationNumber: row.license_registration_number,
      specsJson: row.specs_json,
    };
    const currentRenewalDate = readLicenseRenewalDate(currentAsset);

    if (currentRenewalDate !== expectedDate.key) {
      throw new Error('LICENSE_RENEWAL_ALERT_CHANGED');
    }

    const alert = buildAssetLicenseRenewalAlert(currentAsset, null);

    if (!alert) {
      throw new Error('LICENSE_RENEWAL_ALERT_NOT_FOUND');
    }

    const alreadyNotedForDate = parseAssetLicenseDateKey(row.license_renewal_alert_noted_for_date)?.key;
    if (alreadyNotedForDate === expectedDate.key) {
      await client.query('COMMIT');
      return alert;
    }

    await client.query(
      `
        update public.asset_register_items
        set
          license_renewal_alert_noted_for_date = $3::date,
          license_renewal_alert_noted_at = now()
        where user_id = $1
          and id::text = $2
      `,
      [ownerUserId, assetId, alert.renewalDate],
    );

    await client.query('COMMIT');
    return alert;
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}
