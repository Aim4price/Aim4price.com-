import { getDb } from './db';
import type { MarketplaceListing } from './marketplace';

const FALLBACK_MARKETPLACE_IMAGE = '/brand/Tractor.png';

type MarketplaceAssetRow = Record<string, unknown> & {
  profile_business_name?: unknown;
  profile_phone?: unknown;
  profile_province?: unknown;
  profile_town_city?: unknown;
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
  const next = asText(src);
  return next || FALLBACK_MARKETPLACE_IMAGE;
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

function buildPhotoList(row: Record<string, unknown>): string[] {
  const photos = asStringArray(pick(row, ['photo_urls', 'photos', 'image_urls', 'images'])).map((entry) =>
    safeImage(entry),
  );

  return photos.length ? Array.from(new Set(photos)) : [FALLBACK_MARKETPLACE_IMAGE];
}

function deriveBrandAndModel(row: Record<string, unknown>): { brandName: string; modelName: string } {
  const title = asText(pick(row, ['title', 'name', 'asset_name']));
  const brandName =
    asText(pick(row, ['brand_name_snapshot', 'brand_name', 'brand'])) ||
    title.split(/\s+/).slice(0, 2).join(' ');
  const modelName =
    asText(pick(row, ['model_name_snapshot', 'model_name', 'model'])) ||
    title.replace(brandName, '').trim();

  return {
    brandName: brandName || 'Unknown brand',
    modelName: modelName || 'Unknown model',
  };
}

function buildMarketplaceListing(
  row: MarketplaceAssetRow,
  options: { viewerUserId?: string | null; exposeContact: boolean },
): MarketplaceListing {
  const assetId = asText(row.id);
  const { brandName, modelName } = deriveBrandAndModel(row);
  const title = asText(pick(row, ['title', 'name', 'asset_name'])) || `${brandName} ${modelName}`.trim();
  const powerKw = Math.round(asNumber(pick(row, ['power_kw', 'kw', 'power']), 0));
  const powerHp = Math.round(powerKw * 1.341);
  const yearModel = Math.round(asNumber(pick(row, ['year_model', 'year']), new Date().getFullYear()));
  const hours = Math.max(0, Math.round(asNumber(pick(row, ['hours', 'engine_hours']), 0)));
  const publishedAtIso =
    asText(pick(row, ['updated_at', 'published_at', 'created_at'])) || new Date().toISOString();
  const askingPriceExVat = Math.round(
    asNumber(pick(row, ['selected_value_ex_vat', 'value', 'saved_value_ex_vat']), 0),
  );
  const province = titleCase(asText(row.profile_province) || 'South Africa');
  const area = titleCase(asText(row.profile_town_city) || 'Undisclosed');
  const sellerCompany = asText(row.profile_business_name) || undefined;
  const sellerName = sellerCompany || 'Aim4price seller';
  const sellerPhone = options.exposeContact
    ? asText(pick(row, ['seller_phone'])) || asText(row.profile_phone)
    : '';
  const description =
    asText(pick(row, ['marketplace_notes', 'note', 'notes', 'description'])) ||
    `${brandName} ${modelName} available on the Aim4price marketplace.`;
  const imageUrls = buildPhotoList(row);

  return {
    id: `asset-${assetId}`,
    sourceAssetId: assetId,
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
    province,
    area,
    location: `${area}, ${province}`,
    sourceName: 'Aim4price Asset Register',
    description,
    sellerName,
    sellerCompany,
    sellerPhone,
    sellerEmail: undefined,
    dateAdvertised: publishedAtIso.slice(0, 10),
    publishedAtIso,
    askingPriceExVat,
    advertisedPriceExVat: askingPriceExVat,
    priceExVat: askingPriceExVat,
    price: askingPriceExVat,
    imageSrc: imageUrls[0] ?? FALLBACK_MARKETPLACE_IMAGE,
    imageUrls,
    publishedBy: 'asset-register',
    canManage: Boolean(options.viewerUserId && options.viewerUserId === asText(row.user_id)),
  };
}

function isPublishableTractor(row: Record<string, unknown>): boolean {
  const kind = asText(pick(row, ['kind', 'equipment_type', 'asset_type', 'item_type'])).toLowerCase();
  const { brandName, modelName } = deriveBrandAndModel(row);
  const yearModel = Math.round(asNumber(pick(row, ['year_model', 'year']), 0));

  return (kind === 'tractor' || kind === 'equipment' || Boolean(brandName && modelName)) && yearModel > 0;
}

export async function listPublishedMarketplaceAssetListings(options: {
  viewerUserId?: string | null;
  exposeContact: boolean;
}): Promise<MarketplaceListing[]> {
  const db = getDb();

  const result = await db.query<MarketplaceAssetRow>(
    `
      select
        a.*, 
        p.business_name as profile_business_name,
        p.phone as profile_phone,
        p.province as profile_province,
        p.town_city as profile_town_city
      from asset_register_items a
      left join account_profiles p on p.user_id = a.user_id
      where coalesce(a.marketplace_status, 'draft') = 'live'
      order by coalesce(a.updated_at, a.created_at) desc, a.id desc
    `,
  );

  return result.rows.map((row) => buildMarketplaceListing(row, options));
}

export async function publishAssetRegisterItemToMarketplace(input: {
  userId: string;
  assetId: string;
}): Promise<MarketplaceListing> {
  const db = getDb();

  const current = await db.query<MarketplaceAssetRow>(
    `
      select
        a.*, 
        p.business_name as profile_business_name,
        p.phone as profile_phone,
        p.province as profile_province,
        p.town_city as profile_town_city
      from asset_register_items a
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

  if (!isPublishableTractor(row)) {
    throw new Error('Only tractor assets can be sent to the marketplace.');
  }

  const askingPriceExVat = Math.round(
    asNumber(pick(row, ['selected_value_ex_vat', 'value', 'saved_value_ex_vat']), 0),
  );

  if (askingPriceExVat <= 0) {
    throw new Error('Asset needs a value before it can be sent to marketplace.');
  }

  const sellerPhone = asText(pick(row, ['seller_phone'])) || asText(row.profile_phone);

  if (!sellerPhone) {
    throw new Error('Add a phone number under Account before publishing to marketplace.');
  }

  const updated = await db.query<MarketplaceAssetRow>(
    `
      update asset_register_items
      set
        marketplace_status = 'live',
        seller_phone = $3,
        marketplace_notes = coalesce(nullif(trim(marketplace_notes), ''), nullif(trim(note), ''), title),
        updated_at = now()
      where user_id = $1 and id = $2
      returning *
    `,
    [input.userId, input.assetId, sellerPhone],
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
  };

  return buildMarketplaceListing(listingRow, {
    viewerUserId: input.userId,
    exposeContact: true,
  });
}

export async function removeAssetRegisterItemFromMarketplace(input: {
  userId: string;
  assetId: string;
}): Promise<void> {
  const db = getDb();

  const result = await db.query(
    `
      update asset_register_items
      set
        marketplace_status = 'draft',
        updated_at = now()
      where user_id = $1 and id = $2
    `,
    [input.userId, input.assetId],
  );

  if ((result.rowCount ?? 0) === 0) {
    throw new Error('ASSET_NOT_FOUND');
  }
}
