import { ensureListingAlertSchema } from './listing-alert-schema';
import { assetDisplayTitle } from './asset-display-title';
import { getDb } from './db';
import { ensureAccountProfileColumns } from './account-profile';
import { calculateMarketplaceDealRating, type MarketplaceListing } from './marketplace';
import { normalizeAdBrandSnapshot, toAdBrandSnapshot } from './ad-studio';
import { getAdBrandKitForUser } from './ad-studio-db';

const FALLBACK_MARKETPLACE_IMAGE = '/brand/Tractor.png';
const PUBLIC_MARKETPLACE_CONTACT_NAME = 'Kuyler';
const PUBLIC_MARKETPLACE_CONTACT_PHONE = '062 572 1650';

type MarketplaceUsageUnit = MarketplaceListing['usageUnit'];

let marketplaceColumnsEnsured = false;

type MarketplaceAssetRow = Record<string, unknown> & {
  profile_business_name?: unknown;
  profile_phone?: unknown;
  profile_province?: unknown;
  profile_town_city?: unknown;
  profile_location?: unknown;
  profile_name?: unknown;
  profile_email?: unknown;
};

function asText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function asNumber(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
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

function pick(row: Record<string, unknown>, candidates: string[]): unknown {
  for (const candidate of candidates) {
    if (candidate in row) {
      return row[candidate];
    }
  }

  return undefined;
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/\./g, '')
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function titleCase(value: string): string {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ');
}

function safeImage(src: string): string {
  return asText(src);
}

function normalizeDrive(value: unknown): '2wd' | '4wd' | 'tracks' {
  const normalized = asText(value).toLowerCase();
  if (normalized === '2wd') return '2wd';
  if (normalized === 'tracks') return 'tracks';
  return '4wd';
}

function normalizeCab(value: unknown): 'cab' | 'open-station' {
  const normalized = asText(value).toLowerCase();
  if (normalized === 'open station' || normalized === 'open-station') {
    return 'open-station';
  }

  return 'cab';
}

function normalizeTractorType(value: unknown): 'field' | 'orchard' {
  return asText(value).toLowerCase() === 'orchard' ? 'orchard' : 'field';
}

function normalizeSectorKey(value: unknown): string {
  const normalized = asText(value).toLowerCase().replace(/[_\s-]+/g, '-');

  if (normalized === 'agriculture' || normalized === 'agricultural') return 'agricultural';
  if (normalized === 'construction') return 'construction';
  if (normalized === 'industrial' || normalized === 'industry') return 'industrial';
  if (normalized === 'motor' || normalized === 'vehicle' || normalized === 'vehicles') return 'motor';
  return '';
}

function normalizeConditionKey(value: unknown): string {
  const normalized = asText(value).toLowerCase().replace(/[_-]+/g, ' ');

  if (normalized === 'excellent') return 'excellent';
  if (normalized === 'good') return 'good';
  if (normalized === 'fair') return 'fair';
  if (normalized === 'used') return 'used';
  if (normalized === 'serious' || normalized === 'serious wear') return 'serious';
  return '';
}

function conditionLabel(value: string): string {
  if (value === 'excellent') return 'Excellent';
  if (value === 'good') return 'Good';
  if (value === 'fair') return 'Fair';
  if (value === 'used') return 'Used';
  if (value === 'serious') return 'Serious Wear';
  return '';
}

function normalizeAssetKind(value: unknown): string {
  const normalized = asText(value).toLowerCase().replace(/[_\s-]+/g, '-');

  if (normalized === 'tractor') return 'tractor';
  if (normalized === 'equipment') return 'equipment';
  if (normalized === 'vehicle') return 'vehicle';
  if (normalized === 'tools' || normalized === 'tool') return 'tools';
  if (normalized === 'stock' || normalized === 'inventory') return 'stock';
  if (normalized === 'property' || normalized === 'property-buildings' || normalized === 'buildings') return 'property';
  if (normalized === 'manual' || normalized === 'other') return 'manual';
  return normalized;
}

function familyLabelFromAssetKind(value: unknown): string {
  const kind = normalizeAssetKind(value);

  if (kind === 'tractor') return 'Tractors';
  if (kind === 'equipment') return 'Equipment';
  if (kind === 'vehicle') return 'Vehicles';
  if (kind === 'tools') return 'Tools';
  if (kind === 'stock') return 'Stock';
  if (kind === 'property') return 'Property/Buildings';
  if (kind === 'manual') return 'Other';
  return 'Other';
}

function readAssetKind(row: Record<string, unknown>): string {
  const specs = pickJsonObject(pick(row, ['specs_json']));
  const candidates = [
    row.kind,
    row.equipment_type,
    row.asset_type,
    row.item_type,
    specs.assetKind,
    specs.asset_kind,
    specs.kind,
    specs.equipmentType,
    specs.equipment_type,
  ];

  for (const candidate of candidates) {
    const normalized = normalizeAssetKind(candidate);

    if (normalized) {
      return normalized;
    }
  }

  return '';
}

function isManualAssetRow(row: Record<string, unknown>): boolean {
  const specs = pickJsonObject(pick(row, ['specs_json']));
  const method = (
    asText(pick(row, ['selected_method', 'method', 'valuation_method'])) ||
    asText(specs.selected_method) ||
    asText(specs.method) ||
    asText(specs.valuation_method)
  ).toLowerCase();

  return method === 'manual';
}

function readAim4priceSavedValue(row: Record<string, unknown>): number {
  return Math.round(
    asNumber(
      pick(row, [
        'aim4price_value_ex_vat',
        'selected_value_ex_vat',
        'selected_value',
        'saved_value_ex_vat',
        'saved_value',
        'valuation_value_ex_vat',
        'valuation_value',
        'value_ex_vat',
        'value',
      ]),
      0,
    ),
  );
}

function buildPhotoList(row: Record<string, unknown>): string[] {
  const photos: string[] = [];

  for (const column of ['photo_urls', 'photos', 'image_urls', 'images']) {
    for (const entry of asStringArray(row[column])) {
      const image = safeImage(entry);
      if (image) photos.push(image);
    }
  }

  return Array.from(new Set(photos));
}

function mergePhotoLists(...lists: string[][]): string[] {
  const photos: string[] = [];

  for (const list of lists) {
    for (const entry of list) {
      const image = safeImage(entry);
      if (image) photos.push(image);
    }
  }

  return Array.from(new Set(photos));
}

function getWritablePhotoColumns(row: Record<string, unknown>): string[] {
  const present = ['photo_urls', 'photos', 'image_urls', 'images'].filter((column) => column in row);
  return present.length ? present : ['photo_urls'];
}

function deriveBrandAndModel(row: Record<string, unknown>): { brandName: string; modelName: string } {
  const title = asText(pick(row, ['title', 'name', 'asset_name']));
  const brandName =
    asText(pick(row, ['brand_name_snapshot', 'brand_name', 'brand'])) ||
    title.split(/\s+/).slice(0, 2).join(' ');
  const modelName =
    asText(pick(row, ['model_name_snapshot', 'model_name_raw', 'model_name', 'model'])) ||
    title.replace(brandName, '').trim();

  return {
    brandName: brandName || 'Unknown brand',
    modelName: modelName || 'Unknown model',
  };
}

export async function ensureMarketplaceColumns(): Promise<void> {
  if (marketplaceColumnsEnsured) {
    return;
  }

  await ensureAccountProfileColumns();

  const db = getDb();

  await db.query(`
    create table if not exists marketplace_listings (
      id uuid primary key default gen_random_uuid(),
      user_id text not null,
      asset_register_item_id uuid,
      status text not null default 'live',
      title text not null,
      description text,
      asking_price_ex_vat numeric(14,2) not null default 0,
      province text,
      area text,
      seller_name text,
      seller_company text,
      seller_phone text,
      seller_email text,
      primary_image_url text,
      image_urls jsonb not null default '[]'::jsonb,
      published_at timestamptz,
      withdrawn_at timestamptz,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now(),
      sector_id bigint,
      equipment_family_id bigint,
      brand_id bigint,
      equipment_model_id bigint,
      brand_name_snapshot text,
      model_name_raw text,
      normalized_model_name text,
      specs_json jsonb not null default '{}'::jsonb
    )
  `);

  await db.query(`
    alter table asset_register_items
      add column if not exists seller_phone text,
      add column if not exists marketplace_notes text,
      add column if not exists marketplace_status text not null default 'draft',
      add column if not exists marketplace_price_ex_vat numeric(14,2),
      add column if not exists marketplace_seller_name text,
      add column if not exists marketplace_seller_company text,
      add column if not exists marketplace_seller_email text,
      add column if not exists marketplace_province text,
      add column if not exists marketplace_area text,
      add column if not exists marketplace_ad_brand jsonb,
      add column if not exists marketplace_show_deal_rating boolean not null default true,
      add column if not exists photo_urls jsonb not null default '[]'::jsonb
  `);

  await db.query(`
    alter table marketplace_listings
      add column if not exists asset_register_item_id uuid,
      add column if not exists status text not null default 'live',
      add column if not exists title text,
      add column if not exists description text,
      add column if not exists asking_price_ex_vat numeric(14,2) not null default 0,
      add column if not exists province text,
      add column if not exists area text,
      add column if not exists seller_name text,
      add column if not exists seller_company text,
      add column if not exists seller_phone text,
      add column if not exists seller_email text,
      add column if not exists primary_image_url text,
      add column if not exists image_urls jsonb not null default '[]'::jsonb,
      add column if not exists published_at timestamptz,
      add column if not exists withdrawn_at timestamptz,
      add column if not exists sector_id bigint,
      add column if not exists equipment_family_id bigint,
      add column if not exists brand_id bigint,
      add column if not exists equipment_model_id bigint,
      add column if not exists brand_name_snapshot text,
      add column if not exists model_name_raw text,
      add column if not exists normalized_model_name text,
      add column if not exists specs_json jsonb not null default '{}'::jsonb
  `);

  await db.query(`
    create index if not exists idx_asset_register_items_user_marketplace_status
      on asset_register_items(user_id, marketplace_status);

    create index if not exists idx_marketplace_listings_asset_status
      on marketplace_listings(asset_register_item_id, status);

    create index if not exists idx_marketplace_listings_status_updated
      on marketplace_listings(status, updated_at desc);
  `);

  await ensureListingAlertSchema();
  marketplaceColumnsEnsured = true;
}

function normalizeListingModelName(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '')
    .trim();
}

function pickJsonObject(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }

  if (typeof value === 'string' && value.trim()) {
    try {
      const parsed = JSON.parse(value) as unknown;
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : {};
    } catch {
      return {};
    }
  }

  return {};
}

function asOptionalNumber(value: unknown): number | null {
  if (value === null || typeof value === 'undefined' || value === '') {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function clampPercent(value: number | null): number | null {
  return value === null ? null : Math.min(100, Math.max(0, value));
}

function readFirstNumber(row: Record<string, unknown>, keys: string[]): number | null {
  for (const key of keys) {
    const parsed = asOptionalNumber(pick(row, [key]));

    if (parsed !== null) {
      return parsed;
    }
  }

  return null;
}

function readFirstSpecNumber(specs: Record<string, unknown>, keys: string[]): number | null {
  for (const key of keys) {
    const parsed = asOptionalNumber(specs[key]);

    if (parsed !== null) {
      return parsed;
    }
  }

  return null;
}

const MARKETPLACE_USAGE_READING_KEYS = [
  'hours',
  'engine_hours',
  'engineHours',
  'machine_hours',
  'machineHours',
  'usage_amount',
  'usageAmount',
  'usage_reading',
  'usageReading',
  'current_usage',
  'currentUsage',
  'odometer',
  'odometer_km',
  'odometerKm',
  'kilometres',
  'kilometers',
  'mileage',
  'km',
] as const;

const MARKETPLACE_LIFE_WORKED_PERCENT_KEYS = [
  'lifeWorkedPercent',
  'life_worked_percent',
  'valuationLastLifeWorkedPercent',
  'valuation_last_life_worked_percent',
  'selectedLifeWorkedPercent',
  'selected_life_worked_percent',
  'workedPercent',
  'worked_percent',
  'percentWorked',
  'percent_worked',
  'lifetimeWorkedPercent',
  'lifetime_worked_percent',
  'lifetimeUsedPercent',
  'lifetime_used_percent',
  'percentUsed',
  'percent_used',
  'percentageUsed',
  'percentage_used',
] as const;

function preferSavedUsageReading(rowValue: number | null, specsValue: number | null): number {
  const positiveReading = [rowValue, specsValue].find((value) => value !== null && value > 0);
  const fallbackReading = rowValue ?? specsValue ?? 0;
  return Math.max(0, Math.round(positiveReading ?? fallbackReading));
}

function readMarketplaceUsageAmount(row: MarketplaceAssetRow, specs: Record<string, unknown>): number {
  return preferSavedUsageReading(
    readFirstNumber(row, [...MARKETPLACE_USAGE_READING_KEYS]),
    readFirstSpecNumber(specs, [...MARKETPLACE_USAGE_READING_KEYS]),
  );
}

function listingWorkedPercent(
  row: MarketplaceAssetRow,
  specs: Record<string, unknown>,
): number | null {
  return clampPercent(
    readFirstNumber(row, [...MARKETPLACE_LIFE_WORKED_PERCENT_KEYS]) ??
      readFirstSpecNumber(specs, [...MARKETPLACE_LIFE_WORKED_PERCENT_KEYS]),
  );
}

function normalizeUsageMode(value: unknown): string {
  return asText(value)
    .replace(/([a-z])([A-Z])/g, '$1_$2')
    .toLowerCase()
    .replace(/[^a-z0-9%]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function isPercentUsageMode(value: unknown): boolean {
  const normalized = normalizeUsageMode(value);

  return (
    normalized === '%' ||
    normalized === 'percent' ||
    normalized === 'percentage' ||
    normalized === 'percent_used' ||
    normalized === 'percentage_used' ||
    normalized === 'percentage_depreciation' ||
    normalized === 'life_worked_percent' ||
    normalized === 'worked_percent' ||
    normalized === 'percent_worked' ||
    normalized === 'lifetime_percent' ||
    normalized === 'lifetime_worked_percent' ||
    normalized === 'lifetime_used_percent' ||
    normalized === 'semi_depreciation' ||
    normalized === 'wear_class'
  );
}

function isKilometreUsageMode(value: unknown): boolean {
  const normalized = normalizeUsageMode(value);
  return (
    normalized === 'km' ||
    normalized === 'kms' ||
    normalized === 'kilometres' ||
    normalized === 'kilometers' ||
    normalized === 'kilometre' ||
    normalized === 'kilometer' ||
    normalized === 'odometer' ||
    normalized === 'odometer_km' ||
    normalized === 'mileage'
  );
}

function isHourUsageMode(value: unknown): boolean {
  const normalized = normalizeUsageMode(value);
  return (
    normalized === 'hours' ||
    normalized === 'hour' ||
    normalized === 'hrs' ||
    normalized === 'engine_hours' ||
    normalized === 'machine_hours' ||
    normalized === 'hour_meter' ||
    normalized === 'usage_reading' ||
    normalized === 'reading' ||
    normalized === 'full_depreciation'
  );
}

function listingUsageUnit(
  row: MarketplaceAssetRow,
  specs: Record<string, unknown>,
  lifeWorkedPercent: number | null,
  usageAmount: number,
): MarketplaceUsageUnit {
  const metricCandidates = [
    specs.usageMetric,
    specs.usage_metric,
    specs.usageUnit,
    specs.usage_unit,
    specs.usageType,
    specs.usage_type,
    specs.usageMeasure,
    specs.usage_measure,
    specs.usageMetricType,
    specs.usage_metric_type,
    row.usage_metric,
    row.usage_metric_type,
    row.equipment_family_usage_metric_type,
  ];
  const modeCandidates = [
    specs.usageMode,
    specs.usage_mode,
    specs.usageBasis,
    specs.usage_basis,
    specs.valuationMode,
    specs.valuation_mode,
    specs.depreciationMethodUsed,
    specs.depreciation_method_used,
    specs.selectedDepreciationMethod,
    specs.selected_depreciation_method,
    specs.selectedUsageMode,
    specs.selected_usage_mode,
    row.valuation_mode,
    row.equipment_family_valuation_mode,
    row.depreciation_method_used,
    row.valuation_last_depreciation_method_used,
  ];
  const kind = readAssetKind(row);

  if ([...metricCandidates, ...modeCandidates].some(isPercentUsageMode)) {
    return 'percent';
  }

  if (kind === 'vehicle') {
    return 'km';
  }

  if ([...metricCandidates, ...modeCandidates].some(isKilometreUsageMode)) {
    return 'km';
  }

  if (lifeWorkedPercent !== null && usageAmount <= 0) {
    return 'percent';
  }

  if ([...metricCandidates, ...modeCandidates].some(isHourUsageMode)) {
    return 'hours';
  }

  return 'hours';
}

function formatMarketplacePercent(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

function formatMarketplaceUsageDetail(
  usageUnit: MarketplaceUsageUnit,
  hours: number,
  lifeWorkedPercent: number | null,
): string {
  if (usageUnit === 'percent') {
    return lifeWorkedPercent === null ? '' : `${formatMarketplacePercent(lifeWorkedPercent)}% worked`;
  }

  if (!Number.isFinite(hours) || hours <= 0) {
    return '';
  }

  return `${Math.round(hours).toLocaleString('en-ZA')} ${usageUnit === 'km' ? 'km' : 'hours'}`;
}

function buildMarketplaceListingTitle(row: MarketplaceAssetRow, fallbackTitle?: string): string {
  const { brandName, modelName } = deriveBrandAndModel(row);
  const baseTitle =
    asText(fallbackTitle) ||
    asText(pick(row, ['title', 'name', 'asset_name'])) ||
    `${brandName} ${modelName}`.trim() ||
    'Aim4price listing';

  return assetDisplayTitle({ title: baseTitle, modelName,
    familyLabel: pick(row, ['equipment_family_label', 'family_label']),
    specsJson: pickJsonObject(row.specs_json) });
}


async function createMarketplaceListingSnapshot(row: MarketplaceAssetRow): Promise<void> {
  try {
    const db = getDb();
    const assetId = asText(row.id);
    const userId = asText(row.user_id);
    const { brandName, modelName } = deriveBrandAndModel(row);
    const rawTitle = asText(pick(row, ['title', 'name', 'asset_name'])) || `${brandName} ${modelName}`.trim() || 'Aim4price listing';
    const title = buildMarketplaceListingTitle(row, rawTitle);
    const imageUrls = buildPhotoList(row);
    const existingSpecs = pickJsonObject(pick(row, ['specs_json']));
    const lifeWorkedPercent = listingWorkedPercent(row, existingSpecs);
    const usageAmount = readMarketplaceUsageAmount(row, existingSpecs);
    const usageUnit = listingUsageUnit(
      row,
      existingSpecs,
      lifeWorkedPercent,
      usageAmount,
    );
    const snapshotUsageAmount = usageUnit === 'percent'
      ? lifeWorkedPercent
      : usageAmount;
    const snapshotYear = Math.round(asNumber(pick(row, ['year_model', 'year']), 0));
    const snapshotCondition = conditionLabel(
      normalizeConditionKey(pick(row, ['condition', 'valuation_last_condition'])),
    );
    const snapshotFamilyLabel =
      asText(pick(row, ['equipment_family_label', 'family_label']))
      || familyLabelFromAssetKind(readAssetKind(row));
    const description =
      asText(pick(row, ['marketplace_notes', 'note', 'notes', 'description'])) ||
      `${title} available on the Aim4price marketplace.`;

    if (!assetId || !userId || !title) {
      return;
    }

    await db.query(
      `
        update marketplace_listings
        set
          status = 'withdrawn',
          withdrawn_at = coalesce(withdrawn_at, now()),
          updated_at = now()
        where user_id = $1
          and asset_register_item_id = $2::uuid
          and status = 'live'
      `,
      [userId, assetId],
    );

    await db.query(
      `
        insert into marketplace_listings (
          user_id, asset_register_item_id, status, title, description, asking_price_ex_vat,
          province, area, seller_name, seller_company, seller_phone, seller_email,
          primary_image_url, image_urls, published_at, sector_id, equipment_family_id,
          brand_id, equipment_model_id, brand_name_snapshot, model_name_raw,
          normalized_model_name, specs_json, created_at, updated_at
        )
        values (
          $1, $2::uuid, 'live', $3, $4, $5, $6, $7, $8, nullif($9, ''), $10, nullif($11, ''),
          $12, $13::jsonb, now(), $14, $15, $16, $17, $18, $19, $20, $21::jsonb, now(), now()
        )
      `,
      [
        userId,
        assetId,
        title,
        description,
        Math.round(asNumber(pick(row, ['marketplace_price_ex_vat', 'selected_value_ex_vat', 'value']), 0)),
        asText(pick(row, ['marketplace_province'])) || asText(row.profile_province) || null,
        asText(pick(row, ['marketplace_area'])) || asText(row.profile_location) || asText(row.profile_town_city) || null,
        asText(pick(row, ['marketplace_seller_name'])) || asText(row.profile_name) || asText(row.profile_business_name) || 'Aim4price seller',
        asText(pick(row, ['marketplace_seller_company'])) || asText(row.profile_business_name),
        asText(pick(row, ['seller_phone'])) || asText(row.profile_phone),
        asText(pick(row, ['marketplace_seller_email'])) || asText(row.profile_email),
        imageUrls[0] ?? '',
        JSON.stringify(imageUrls),
        pick(row, ['sector_id']),
        pick(row, ['equipment_family_id']),
        pick(row, ['brand_id']),
        pick(row, ['equipment_model_id']),
        brandName,
        modelName,
        normalizeListingModelName(modelName),
        JSON.stringify({
          ...existingSpecs,
          ...(snapshotYear > 0 ? { yearModel: snapshotYear } : {}),
          ...(snapshotUsageAmount !== null && snapshotUsageAmount > 0
            ? { usageAmount: snapshotUsageAmount, usageUnit }
            : {}),
          ...(snapshotCondition ? { conditionLabel: snapshotCondition } : {}),
          ...(snapshotFamilyLabel ? { familyLabel: snapshotFamilyLabel } : {}),
          marketplaceAdBrand: pick(row, ['marketplace_ad_brand']) ?? undefined,
        }),
      ],
    );
  } catch (error) {
    console.error('marketplace listing snapshot sync failed', error);
  }
}

function buildMarketplaceListing(
  row: MarketplaceAssetRow,
  options: {
    viewerUserId?: string | null;
    exposeContact: boolean;
    listingSnapshot?: boolean;
  },
): MarketplaceListing {
  const listingSnapshot = options.listingSnapshot === true;
  const assetId = listingSnapshot ? '' : asText(row.id);
  const { brandName, modelName } = deriveBrandAndModel(row);
  const rawTitle = asText(pick(row, ['title', 'name', 'asset_name'])) || `${brandName} ${modelName}`.trim();
  const title = buildMarketplaceListingTitle(row, rawTitle);
  const powerKw = Math.round(asNumber(pick(row, ['power_kw', 'kw', 'power']), 0));
  const powerHp = Math.round(powerKw * 1.341);
  const specs = pickJsonObject(pick(row, ['specs_json']));
  const lifeWorkedPercent = listingWorkedPercent(row, specs);
  const usageAmount = readMarketplaceUsageAmount(row, specs);
  const usageUnit = listingUsageUnit(row, specs, lifeWorkedPercent, usageAmount);
  const yearModel = Math.round(asNumber(
    pick(row, ['year_model', 'year']),
    asNumber(pick(specs, ['yearModel', 'year_model', 'year']), new Date().getFullYear()),
  ));
  const hours = usageAmount;
  const publishedAtIso =
    asText(pick(row, ['updated_at', 'published_at', 'created_at'])) || new Date().toISOString();
  const askingPriceExVat = Math.round(
    asNumber(
      pick(row, [
        'marketplace_price_ex_vat',
        'asking_price_ex_vat',
        'listing_price_ex_vat',
        'selected_value_ex_vat',
        'value',
        'saved_value_ex_vat',
      ]),
      0,
    ),
  );
  const aim4priceValueExVat = readAim4priceSavedValue(row);
  const explicitProfileLocation = asText(row.profile_location);
  const province = titleCase(
    asText(pick(row, ['marketplace_province', 'province']))
      || asText(row.profile_province)
      || 'South Africa',
  );
  const area = titleCase(
    asText(pick(row, ['marketplace_area', 'area']))
      || explicitProfileLocation
      || asText(row.profile_town_city)
      || 'Undisclosed',
  );
  const rawSellerCompany = asText(pick(row, ['marketplace_seller_company', 'seller_company'])) || asText(row.profile_business_name) || undefined;
  const rawSellerName =
    asText(pick(row, ['marketplace_seller_name', 'seller_name'])) || rawSellerCompany || asText(row.profile_name) || 'Aim4price seller';
  const sellerCompany = options.exposeContact ? rawSellerCompany : undefined;
  const sellerName = options.exposeContact ? rawSellerName : PUBLIC_MARKETPLACE_CONTACT_NAME;
  const sellerPhone = options.exposeContact
    ? asText(pick(row, ['seller_phone'])) || asText(row.profile_phone)
    : PUBLIC_MARKETPLACE_CONTACT_PHONE;
  const sellerEmail = options.exposeContact
    ? asText(pick(row, ['marketplace_seller_email', 'seller_email'])) || asText(row.profile_email)
    : '';
  const description =
    asText(pick(row, ['marketplace_notes', 'note', 'notes', 'description'])) ||
    `${brandName} ${modelName} available on the Aim4price marketplace.`;
  const imageUrls = mergePhotoLists(
    buildPhotoList(row),
    [asText(pick(row, ['primary_image_url']))].filter(Boolean),
  );
  const sectorKey =
    normalizeSectorKey(pick(row, ['equipment_sector_key', 'sector_key', 'sector'])) ||
    'agricultural';
  const sectorLabel =
    asText(pick(row, ['equipment_sector_label', 'sector_label'])) ||
    (sectorKey === 'construction'
      ? 'Construction'
      : sectorKey === 'industrial'
        ? 'Industrial'
        : sectorKey === 'motor'
          ? 'Motor'
          : 'Agriculture');
  const assetKind = readAssetKind(row);
  const dealRating = calculateMarketplaceDealRating({
    askingPriceExVat,
    aim4priceValueExVat,
    isManualEquipment: isManualAssetRow(row) || assetKind === 'manual',
  });
  const linkedFamilyLabel = asText(pick(row, ['equipment_family_label', 'family_label']));
  const linkedFamilyKey = asText(pick(row, ['equipment_family_key', 'family_key']));
  const assetKindFamilyLabel = familyLabelFromAssetKind(assetKind);
  const familyLabel = linkedFamilyLabel || assetKindFamilyLabel;
  const familyKey = linkedFamilyKey || slugify(familyLabel);
  const conditionKey = normalizeConditionKey(
    pick(row, ['condition', 'valuation_last_condition'])
      ?? pick(specs, ['conditionLabel', 'condition_label', 'condition']),
  );
  const adBrand = normalizeAdBrandSnapshot(
    pick(row, ['marketplace_ad_brand']) ?? pick(specs, ['marketplaceAdBrand']),
    {
    exposeContact: options.exposeContact,
    },
  );

  return {
    id: listingSnapshot ? asText(row.id) : `asset-${assetId}`,
    sourceAssetId: listingSnapshot ? undefined : assetId,
    modelId: asText(pick(row, ['model_id'])) || undefined,
    title,
    brandName,
    brandSlug: slugify(brandName),
    modelName,
    tractorType: normalizeTractorType(pick(row, ['tractor_type', 'tractor_category'])),
    drive: normalizeDrive(pick(row, ['drive_type', 'drive', 'drivetrain'])),
    cab: normalizeCab(pick(row, ['cab_type', 'cab'])),
    powerKw,
    powerHp,
    horsepowerHp: powerHp,
    yearModel,
    year: yearModel,
    hours,
    usageUnit,
    lifeWorkedPercent,
    province,
    area,
    location: explicitProfileLocation || `${area}, ${province}`,
    sourceName: listingSnapshot ? 'Marketplace advert' : 'Aim4price Asset Register',
    description,
    sellerName,
    sellerCompany,
    sellerPhone,
    sellerEmail: sellerEmail || undefined,
    dateAdvertised: publishedAtIso.slice(0, 10),
    publishedAtIso,
    askingPriceExVat,
    advertisedPriceExVat: askingPriceExVat,
    priceExVat: askingPriceExVat,
    price: askingPriceExVat,
    aim4priceValueExVat: aim4priceValueExVat > 0 ? aim4priceValueExVat : undefined,
    dealRating: dealRating.rating,
    dealRatingPercentDiff: dealRating.percentDiff,
    showDealRating: pick(row, ['marketplace_show_deal_rating']) !== false,
    imageSrc: imageUrls[0] ?? '',
    imageUrls,
    sectorKey,
    sectorLabel,
    familyKey,
    familyLabel,
    conditionKey: conditionKey || undefined,
    conditionLabel: conditionLabel(conditionKey) || undefined,
    publishedBy: 'asset-register',
    assetKind: assetKind || undefined,
    canManage: Boolean(options.viewerUserId && options.viewerUserId === asText(row.user_id)),
    adBrand: adBrand ?? undefined,
  };
}

function isPublishableEquipment(row: Record<string, unknown>): boolean {
  const kind = readAssetKind(row);
  const title = asText(pick(row, ['title', 'name', 'asset_name']));
  const { brandName, modelName } = deriveBrandAndModel(row);
  return (
    kind !== 'property' &&
    Boolean(title || brandName || modelName || ['tractor', 'equipment', 'manual', 'vehicle', 'tools'].includes(kind))
  );
}

export async function listPublishedMarketplaceAssetListings(options: {
  viewerUserId?: string | null;
  exposeContact: boolean;
  sellerUserId?: string | null;
}): Promise<MarketplaceListing[]> {
  await ensureMarketplaceColumns();

  const db = getDb();
  const [assetResult, listingOnlyResult] = await Promise.all([
    db.query<MarketplaceAssetRow>(
      `
        select
          a.*,
          s.sector_key as equipment_sector_key,
          s.sector_label as equipment_sector_label,
          ef.family_key as equipment_family_key,
          ef.family_label as equipment_family_label,
          ef.usage_metric_type as equipment_family_usage_metric_type,
          ef.valuation_mode as equipment_family_valuation_mode,
          p.business_name as profile_business_name,
          coalesce(nullif(p.marketplace_phone, ''), nullif(p.phone, '')) as profile_phone,
          p.province as profile_province,
          p.town_city as profile_town_city,
          nullif(p.marketplace_location, '') as profile_location,
          coalesce(nullif(p.marketplace_seller_name, ''), nullif(p.display_name, '')) as profile_name,
          nullif(p.marketplace_email, '') as profile_email
        from asset_register_items a
        left join public.equipment_families ef on ef.id = a.equipment_family_id
        left join public.sectors s on s.id = coalesce(a.sector_id, ef.sector_id)
        left join account_profiles p on p.user_id = a.user_id
        where coalesce(a.marketplace_status, 'draft') = 'live'
          and ($1::text is null or a.user_id = $1)
        order by coalesce(a.updated_at, a.created_at) desc, a.id desc
      `,
      [options.sellerUserId ?? null],
    ),
    db.query<MarketplaceAssetRow>(
      `
        select
          listing.*,
          s.sector_key as equipment_sector_key,
          s.sector_label as equipment_sector_label,
          ef.family_key as equipment_family_key,
          ef.family_label as equipment_family_label,
          ef.usage_metric_type as equipment_family_usage_metric_type,
          ef.valuation_mode as equipment_family_valuation_mode,
          p.business_name as profile_business_name,
          coalesce(nullif(p.marketplace_phone, ''), nullif(p.phone, '')) as profile_phone,
          p.province as profile_province,
          p.town_city as profile_town_city,
          nullif(p.marketplace_location, '') as profile_location,
          coalesce(nullif(p.marketplace_seller_name, ''), nullif(p.display_name, '')) as profile_name,
          nullif(p.marketplace_email, '') as profile_email
        from marketplace_listings listing
        left join public.equipment_families ef on ef.id = listing.equipment_family_id
        left join public.sectors s on s.id = coalesce(listing.sector_id, ef.sector_id)
        left join account_profiles p on p.user_id = listing.user_id
        where listing.asset_register_item_id is null
          and lower(coalesce(listing.status, '')) = 'live'
          and ($1::text is null or listing.user_id = $1)
        order by coalesce(listing.published_at, listing.updated_at, listing.created_at) desc, listing.id desc
      `,
      [options.sellerUserId ?? null],
    ),
  ]);

  return [
    ...assetResult.rows.map((row) => buildMarketplaceListing(row, options)),
    ...listingOnlyResult.rows.map((row) => buildMarketplaceListing(row, {
      ...options,
      listingSnapshot: true,
    })),
  ].sort((left, right) => (
    new Date(right.publishedAtIso).getTime() - new Date(left.publishedAtIso).getTime()
  ));
}

export async function publishAssetRegisterItemToMarketplace(input: {
  userId: string;
  assetId: string;
  askingPriceExVat?: number | null;
  marketplaceNotes?: string | null;
  sellerPhone?: string | null;
  sellerName?: string | null;
  sellerCompany?: string | null;
  sellerEmail?: string | null;
  province?: string | null;
  area?: string | null;
  photos?: string[] | null;
  brandKitId?: string | null;
  allowBrandKit?: boolean;
  showDealRating?: boolean;
  requireValuationSource?: boolean;
}): Promise<MarketplaceListing> {
  await ensureMarketplaceColumns();

  const db = getDb();
  const current = await db.query<MarketplaceAssetRow>(
    `
      select
        a.*,
        s.sector_key as equipment_sector_key,
        s.sector_label as equipment_sector_label,
        ef.family_key as equipment_family_key,
        ef.family_label as equipment_family_label,
        ef.usage_metric_type as equipment_family_usage_metric_type,
        ef.valuation_mode as equipment_family_valuation_mode,
        p.business_name as profile_business_name,
        coalesce(nullif(p.marketplace_phone, ''), nullif(p.phone, '')) as profile_phone,
        p.province as profile_province,
        p.town_city as profile_town_city,
        nullif(p.marketplace_location, '') as profile_location,
        coalesce(nullif(p.marketplace_seller_name, ''), nullif(p.display_name, '')) as profile_name,
        nullif(p.marketplace_email, '') as profile_email
      from asset_register_items a
      left join public.equipment_families ef on ef.id = a.equipment_family_id
      left join public.sectors s on s.id = coalesce(a.sector_id, ef.sector_id)
      left join account_profiles p on p.user_id = a.user_id
      where a.user_id = $1 and a.id = $2
      limit 1
    `,
    [input.userId, input.assetId],
  );

  const row = current.rows[0];

  if (!row) {
    throw new Error('ASSET_NOT_FOUND');
  }

  if (!isPublishableEquipment(row)) {
    throw new Error('Property/Buildings cannot be sent to the marketplace.');
  }

  if (input.requireValuationSource && !pick(row, ['valuation_run_id'])) {
    throw new Error('Middleman adverts must be created from a completed Aim4price valuation.');
  }

  const currentAskingPrice = Math.round(
    asNumber(
      pick(row, [
        'marketplace_price_ex_vat',
        'asking_price_ex_vat',
        'listing_price_ex_vat',
        'selected_value_ex_vat',
        'value',
        'saved_value_ex_vat',
      ]),
      0,
    ),
  );
  const askingPriceExVat = Math.max(
    0,
    Math.round(Number(input.askingPriceExVat ?? currentAskingPrice) || 0),
  );

  if (askingPriceExVat <= 0) {
    throw new Error('Add a valid selling price before publishing to marketplace.');
  }

  const sellerPhone =
    asText(input.sellerPhone) || asText(pick(row, ['seller_phone'])) || asText(row.profile_phone);

  if (!sellerPhone) {
    throw new Error('Add a phone number under Account or in the marketplace popup before publishing.');
  }

  const title = asText(pick(row, ['title', 'name', 'asset_name'])) || 'Saved asset';
  const nextNotes =
    asText(input.marketplaceNotes) ||
    asText(pick(row, ['marketplace_notes', 'note', 'notes', 'description'])) ||
    title;
  const sellerName = asText(input.sellerName) || asText(row.profile_name) || asText(row.profile_business_name) || 'Aim4price seller';
  const sellerCompany = asText(input.sellerCompany) || asText(row.profile_business_name);
  const sellerEmail = asText(input.sellerEmail) || asText(row.profile_email);
  const province = asText(input.province) || asText(row.profile_province);
  const area = asText(input.area) || asText(row.profile_location) || asText(row.profile_town_city);
  const requestedBrandKitId = asText(input.brandKitId);
  const brandKit = input.allowBrandKit
    ? await getAdBrandKitForUser(input.userId, requestedBrandKitId || null)
    : null;

  if (input.allowBrandKit && requestedBrandKitId && !brandKit) {
    throw new Error('Choose a valid Brand Kit before creating the advert.');
  }

  const updateValues: unknown[] = [
    input.userId,
    input.assetId,
    sellerPhone,
    nextNotes,
    askingPriceExVat,
    sellerName,
    sellerCompany,
    sellerEmail,
    province,
    area,
  ];
  const updateAssignments = [
    "marketplace_status = 'live'",
    'seller_phone = $3',
    'marketplace_notes = $4',
    'marketplace_price_ex_vat = $5',
    'marketplace_seller_name = $6',
    "marketplace_seller_company = nullif($7, '')",
    "marketplace_seller_email = nullif($8, '')",
    "marketplace_province = nullif($9, '')",
    "marketplace_area = nullif($10, '')",
  ];
  const incomingPhotos = Array.isArray(input.photos)
    ? input.photos.map((entry) => safeImage(entry)).filter(Boolean)
    : [];

  updateValues.push(brandKit ? JSON.stringify(toAdBrandSnapshot(brandKit)) : null);
  updateAssignments.push(`marketplace_ad_brand = $${updateValues.length}::jsonb`);

  updateValues.push(input.showDealRating !== false);
  updateAssignments.push(`marketplace_show_deal_rating = $${updateValues.length}`);

  if (incomingPhotos.length) {
    const mergedPhotosJson = JSON.stringify(mergePhotoLists(buildPhotoList(row), incomingPhotos));

    for (const column of getWritablePhotoColumns(row)) {
      updateValues.push(mergedPhotosJson);
      updateAssignments.push(`${column} = $${updateValues.length}::jsonb`);
    }
  }

  updateAssignments.push('updated_at = now()');

  const updated = await db.query<MarketplaceAssetRow>(
    `
      update asset_register_items
      set
        ${updateAssignments.join(',\n        ')}
      where user_id = $1 and id = $2
      returning *
    `,
    updateValues,
  );

  const updatedRow = updated.rows[0];

  if (!updatedRow) {
    throw new Error('MARKETPLACE_PUBLISH_FAILED');
  }

  const listingRow: MarketplaceAssetRow = {
    ...updatedRow,
    profile_business_name: row.profile_business_name,
    profile_phone: row.profile_phone,
    profile_province: row.profile_province,
    profile_town_city: row.profile_town_city,
    profile_location: row.profile_location,
    profile_name: row.profile_name,
    profile_email: row.profile_email,
    equipment_sector_key: row.equipment_sector_key,
    equipment_sector_label: row.equipment_sector_label,
    equipment_family_key: row.equipment_family_key,
    equipment_family_label: row.equipment_family_label,
    equipment_family_usage_metric_type: row.equipment_family_usage_metric_type,
    equipment_family_valuation_mode: row.equipment_family_valuation_mode,
  };

  await createMarketplaceListingSnapshot(listingRow);

  return buildMarketplaceListing(listingRow, {
    viewerUserId: input.userId,
    exposeContact: true,
  });
}


