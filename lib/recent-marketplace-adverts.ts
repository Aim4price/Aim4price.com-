import { getDb } from './db';
import { ensureMarketplaceColumns } from './marketplace-db';
import { ensureMarketplaceOutcomeSchema } from './marketplace-outcomes';

export const RECENT_MARKETPLACE_ADVERT_STATUSES = [
  'available',
  'sold',
  'ended',
] as const;

export type RecentMarketplaceAdvertStatus =
  (typeof RECENT_MARKETPLACE_ADVERT_STATUSES)[number];

export type RecentMarketplaceAdvert = {
  id: string;
  sourceAssetId: string | null;
  title: string;
  brand: string;
  model: string;
  year: string;
  usage: string;
  condition: string;
  type: string;
  province: string;
  area: string;
  description: string;
  advertiserName: string;
  advertiserType: 'business' | 'private';
  status: RecentMarketplaceAdvertStatus;
  statusLabel: 'Available' | 'Sold / traded' | 'Advert ended';
  publishedAtIso: string;
  priceExVat: number | null;
  imageUrl: string;
  marketplaceHref: string | null;
};

export type RecentMarketplaceAdvertOption = {
  value: string;
  label: string;
  count: number;
};

export type RecentMarketplaceAdvertSummary = {
  totalAdverts: number;
  advertiserCount: number;
  provinceCount: number;
};

export type RecentMarketplaceAdvertPagination = {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
  rangeStart: number;
  rangeEnd: number;
  hasPreviousPage: boolean;
  hasNextPage: boolean;
};

export type RecentMarketplaceAdvertListResult = {
  adverts: RecentMarketplaceAdvert[];
  typeOptions: RecentMarketplaceAdvertOption[];
  provinceOptions: RecentMarketplaceAdvertOption[];
  summary: RecentMarketplaceAdvertSummary;
  pagination: RecentMarketplaceAdvertPagination;
};

type RecentAdvertRow = {
  id: unknown;
  source_asset_id: unknown;
  title: unknown;
  brand_name: unknown;
  model_name: unknown;
  year_label: unknown;
  usage_amount: unknown;
  usage_unit: unknown;
  condition_label: unknown;
  type_label: unknown;
  province: unknown;
  area: unknown;
  description: unknown;
  advertiser_name: unknown;
  advertiser_type: unknown;
  advert_status: unknown;
  published_at: unknown;
  asking_price_ex_vat: unknown;
  primary_image_url: unknown;
  image_urls: unknown;
};

type SummaryRow = {
  total_adverts: unknown;
  advertiser_count: unknown;
  province_count: unknown;
};

type OptionRow = {
  value: unknown;
  count: unknown;
};

const DEFAULT_PAGE_SIZE = 10;
const MAX_PAGE_SIZE = 50;
const MAX_SEARCH_LENGTH = 120;

const RECENT_ADVERTS_CTE = `
  with marketplace_advert_history as (
    select
      listing.id::text as id,
      listing.user_id,
      listing.asset_register_item_id::text as source_asset_id,
      case
        when listing.asset_register_item_id is not null
          then 'asset:' || listing.asset_register_item_id::text
        else 'listing:' || listing.id::text
      end as asset_key,
      lower(coalesce(nullif(trim(listing.status), ''), 'ended')) as status,
      coalesce(nullif(trim(listing.title), ''), 'Aim4price listing') as title,
      coalesce(listing.description, '') as description,
      greatest(coalesce(listing.asking_price_ex_vat, 0), 0) as asking_price_ex_vat,
      coalesce(listing.province, '') as province,
      coalesce(listing.area, '') as area,
      coalesce(listing.seller_name, '') as seller_name,
      coalesce(listing.seller_company, '') as seller_company,
      coalesce(listing.primary_image_url, '') as primary_image_url,
      coalesce(listing.image_urls, '[]'::jsonb) as image_urls,
      coalesce(listing.published_at, listing.created_at, listing.updated_at) as published_at,
      listing.created_at,
      listing.sector_id,
      listing.equipment_family_id,
      listing.brand_id,
      listing.equipment_model_id,
      coalesce(listing.brand_name_snapshot, '') as brand_name_snapshot,
      coalesce(listing.model_name_raw, '') as model_name_raw,
      coalesce(listing.specs_json, '{}'::jsonb) as specs_json,
      coalesce(
        nullif(trim(listing.specs_json->>'yearModel'), ''),
        nullif(trim(listing.specs_json->>'year'), ''),
        current_asset.year_model::text,
        ''
      ) as year_label,
      coalesce(
        nullif(trim(listing.specs_json->>'usageAmount'), ''),
        nullif(trim(listing.specs_json->>'hours'), ''),
        nullif(trim(listing.specs_json->>'kilometres'), ''),
        current_asset.hours::text,
        ''
      ) as usage_amount,
      coalesce(
        nullif(trim(listing.specs_json->>'conditionLabel'), ''),
        nullif(trim(listing.specs_json->>'condition'), ''),
        nullif(trim(current_asset.condition), ''),
        ''
      ) as condition_label,
      outcome.outcome_reason
    from public.marketplace_listings listing
    left join public.marketplace_listing_outcomes outcome
      on outcome.marketplace_listing_id = listing.id
    left join public.asset_register_items current_asset
      on current_asset.id = listing.asset_register_item_id
     and current_asset.user_id = listing.user_id
    where listing.published_at is not null
       or lower(coalesce(listing.status, '')) in ('live', 'withdrawn')

    union all

    select
      'current:' || asset.id::text as id,
      asset.user_id,
      asset.id::text as source_asset_id,
      'asset:' || asset.id::text as asset_key,
      'live'::text as status,
      coalesce(nullif(trim(asset.title), ''), 'Aim4price listing') as title,
      coalesce(asset.marketplace_notes, '') as description,
      greatest(coalesce(asset.marketplace_price_ex_vat, 0), 0) as asking_price_ex_vat,
      coalesce(asset.marketplace_province, '') as province,
      coalesce(asset.marketplace_area, '') as area,
      coalesce(asset.marketplace_seller_name, '') as seller_name,
      coalesce(asset.marketplace_seller_company, '') as seller_company,
      ''::text as primary_image_url,
      coalesce(asset.photo_urls, '[]'::jsonb) as image_urls,
      coalesce(asset.updated_at, asset.created_at) as published_at,
      asset.created_at,
      asset.sector_id,
      asset.equipment_family_id,
      asset.brand_id,
      asset.equipment_model_id,
      ''::text as brand_name_snapshot,
      coalesce(asset.typed_model_name, '') as model_name_raw,
      coalesce(asset.specs_json, '{}'::jsonb) as specs_json,
      coalesce(asset.year_model::text, '') as year_label,
      coalesce(
        nullif(trim(asset.specs_json->>'usageAmount'), ''),
        asset.hours::text,
        ''
      ) as usage_amount,
      coalesce(nullif(trim(asset.condition), ''), '') as condition_label,
      null::text as outcome_reason
    from public.asset_register_items asset
    where coalesce(asset.marketplace_status, 'draft') = 'live'
      and not exists (
        select 1
        from public.marketplace_listings saved_listing
        where saved_listing.asset_register_item_id = asset.id
          and saved_listing.status = 'live'
      )
  ),
  ranked_marketplace_adverts as (
    select
      history.*,
      row_number() over (
        partition by history.asset_key
        order by
          history.published_at desc nulls last,
          case when history.status = 'live' then 0 else 1 end,
          history.created_at desc nulls last,
          history.id desc
      ) as advert_rank
    from marketplace_advert_history history
  ),
  recent_marketplace_adverts as (
    select
      listing.id,
      listing.user_id as advertiser_user_id,
      listing.source_asset_id,
      listing.title,
      coalesce(
        nullif(trim(listing.brand_name_snapshot), ''),
        nullif(trim(brand.name), ''),
        'Unknown brand'
      ) as brand_name,
      coalesce(
        nullif(trim(listing.model_name_raw), ''),
        nullif(trim(model.model_name), ''),
        'Unknown model'
      ) as model_name,
      listing.year_label,
      listing.usage_amount,
      coalesce(
        nullif(trim(listing.specs_json->>'usageUnit'), ''),
        case when listing.specs_json ? 'kilometres' then 'km' end,
        nullif(trim(family.usage_metric_type), ''),
        ''
      ) as usage_unit,
      listing.condition_label,
      coalesce(
        nullif(trim(family.family_label), ''),
        nullif(trim(listing.specs_json->>'familyLabel'), ''),
        nullif(trim(listing.specs_json->>'assetType'), ''),
        nullif(trim(sector.sector_label), ''),
        'Equipment'
      ) as type_label,
      coalesce(nullif(trim(listing.province), ''), 'South Africa') as province,
      coalesce(nullif(trim(listing.area), ''), 'Location not saved') as area,
      coalesce(nullif(trim(listing.description), ''), '') as description,
      coalesce(
        nullif(trim(listing.seller_company), ''),
        nullif(trim(listing.specs_json#>>'{marketplaceAdBrand,businessName}'), ''),
        nullif(trim(advertiser.business_name), ''),
        nullif(trim(listing.seller_name), ''),
        nullif(trim(advertiser.marketplace_seller_name), ''),
        nullif(trim(advertiser.display_name), ''),
        'Private advertiser'
      ) as advertiser_name,
      case
        when coalesce(
          nullif(trim(listing.seller_company), ''),
          nullif(trim(advertiser.business_name), ''),
          nullif(trim(listing.specs_json#>>'{marketplaceAdBrand,businessName}'), '')
        ) is null then 'private'
        else 'business'
      end as advertiser_type,
      case
        when listing.status = 'live' then 'available'
        when listing.outcome_reason in ('sold', 'traded') then 'sold'
        else 'ended'
      end as advert_status,
      listing.published_at,
      listing.asking_price_ex_vat,
      listing.primary_image_url,
      listing.image_urls
    from ranked_marketplace_adverts listing
    join public.account_profiles advertiser
      on advertiser.user_id = listing.user_id
     and advertiser.account_status = 'active'
     and advertiser.account_type in ('owner', 'dealer')
    left join public.equipment_families family
      on family.id = listing.equipment_family_id
    left join public.sectors sector
      on sector.id = coalesce(listing.sector_id, family.sector_id)
    left join public.equipment_models model
      on model.id = listing.equipment_model_id
    left join public.brands brand
      on brand.id = coalesce(listing.brand_id, model.brand_id)
    where listing.advert_rank = 1
      and listing.user_id <> $1
      and coalesce(listing.outcome_reason, '') <> 'created_by_mistake'
  )
`;

function text(value: unknown): string {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function integer(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.trunc(parsed) : fallback;
}

function money(value: unknown): number | null {
  if (value === null || typeof value === 'undefined' || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed) : null;
}

function iso(value: unknown): string {
  const parsed = value instanceof Date ? value : new Date(String(value ?? ''));
  return Number.isNaN(parsed.getTime())
    ? new Date().toISOString()
    : parsed.toISOString();
}

function cleanStatus(value: unknown): RecentMarketplaceAdvertStatus {
  const candidate = text(value).toLowerCase();
  return RECENT_MARKETPLACE_ADVERT_STATUSES.includes(
    candidate as RecentMarketplaceAdvertStatus,
  )
    ? (candidate as RecentMarketplaceAdvertStatus)
    : 'ended';
}

function statusLabel(
  status: RecentMarketplaceAdvertStatus,
): RecentMarketplaceAdvert['statusLabel'] {
  if (status === 'available') return 'Available';
  if (status === 'sold') return 'Sold / traded';
  return 'Advert ended';
}

function parseImages(value: unknown): string[] {
  let values: unknown[] = [];
  if (Array.isArray(value)) {
    values = value;
  } else if (typeof value === 'string' && value.trim()) {
    try {
      const parsed = JSON.parse(value) as unknown;
      values = Array.isArray(parsed) ? parsed : [];
    } catch {
      values = [];
    }
  }

  return values
    .map((entry) => text(entry))
    .filter(
      (entry, index, all) =>
        Boolean(entry) &&
        all.indexOf(entry) === index &&
        (/^https:\/\//i.test(entry) || entry.startsWith('/')),
    )
    .slice(0, 1);
}

function displayUsage(row: RecentAdvertRow): string {
  const amount = text(row.usage_amount);
  if (!amount) return '';
  const numeric = Number(amount.replace(/[^0-9.-]/g, ''));
  const formatted = Number.isFinite(numeric)
    ? Math.round(numeric).toLocaleString('en-ZA')
    : amount;
  const unit = text(row.usage_unit).toLowerCase();
  if (unit.includes('percent')) return `${formatted}% worked`;
  return `${formatted} ${unit === 'km' || unit.includes('kilo') ? 'km' : 'hours'}`;
}

function mapAdvert(row: RecentAdvertRow): RecentMarketplaceAdvert {
  const status = cleanStatus(row.advert_status);
  const sourceAssetId = text(row.source_asset_id) || null;
  const primaryImage = text(row.primary_image_url);
  const imageUrl = status === 'available'
    ? (/^https:\/\//i.test(primaryImage) || primaryImage.startsWith('/'))
      ? primaryImage
      : parseImages(row.image_urls)[0] ?? ''
    : '';

  return {
    id: text(row.id),
    sourceAssetId,
    title: text(row.title) || 'Aim4price listing',
    brand: text(row.brand_name),
    model: text(row.model_name),
    year: text(row.year_label),
    usage: displayUsage(row),
    condition: text(row.condition_label),
    type: text(row.type_label) || 'Equipment',
    province: text(row.province) || 'South Africa',
    area: text(row.area) || 'Location not saved',
    // Historical free-form advert copy can contain contact details. Only return
    // it while the advert still has a public Marketplace destination.
    description:
      status === 'available' && sourceAssetId ? text(row.description) : '',
    advertiserName: text(row.advertiser_name) || 'Private advertiser',
    advertiserType:
      text(row.advertiser_type).toLowerCase() === 'business'
        ? 'business'
        : 'private',
    status,
    statusLabel: statusLabel(status),
    publishedAtIso: iso(row.published_at),
    priceExVat: money(row.asking_price_ex_vat),
    imageUrl,
    marketplaceHref:
      status === 'available' && sourceAssetId
        ? `/marketplace/browse?listing=${encodeURIComponent(`asset-${sourceAssetId}`)}`
        : null,
  };
}

function option(row: OptionRow): RecentMarketplaceAdvertOption {
  const value = text(row.value);
  return { value, label: value, count: Math.max(0, integer(row.count)) };
}

function pageNumber(value: unknown, fallback: number): number {
  const parsed = integer(value, fallback);
  return parsed > 0 ? parsed : fallback;
}

function pageSizeNumber(value: unknown): number {
  return Math.min(MAX_PAGE_SIZE, pageNumber(value, DEFAULT_PAGE_SIZE));
}

function filterValue(value: unknown): string {
  return text(value).slice(0, MAX_SEARCH_LENGTH);
}

function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (character) => `\\${character}`);
}

export async function listRecentMarketplaceAdverts(input: {
  viewerUserId: string;
  search?: string;
  status?: string;
  type?: string;
  province?: string;
  page?: number;
  pageSize?: number;
}): Promise<RecentMarketplaceAdvertListResult> {
  await ensureMarketplaceColumns();
  await ensureMarketplaceOutcomeSchema();

  const viewerUserId = text(input.viewerUserId);
  if (!viewerUserId) throw new Error('You must be signed in.');

  const search = escapeLike(filterValue(input.search));
  const requestedStatus = text(input.status).toLowerCase();
  const status = RECENT_MARKETPLACE_ADVERT_STATUSES.includes(
    requestedStatus as RecentMarketplaceAdvertStatus,
  )
    ? requestedStatus
    : 'all';
  const type = filterValue(input.type) || 'all';
  const province = filterValue(input.province) || 'all';
  const requestedPage = pageNumber(input.page, 1);
  const pageSize = pageSizeNumber(input.pageSize);
  const filters = [viewerUserId, search, status, type, province];
  const filteredWhere = `
    where (
      $2::text = ''
      or concat_ws(' ', title, brand_name, model_name, year_label, type_label,
        province, area, advertiser_name, condition_label) ilike '%' || $2 || '%' escape '\\'
    )
      and ($3::text = 'all' or advert_status = $3)
      and ($4::text = 'all' or type_label = $4)
      and ($5::text = 'all' or province = $5)
  `;

  const db = getDb();
  const summaryResult = await db.query<SummaryRow>(
    `${RECENT_ADVERTS_CTE}
     select
       count(*)::int as total_adverts,
       count(distinct advertiser_user_id)::int as advertiser_count,
       count(distinct province)::int as province_count
     from recent_marketplace_adverts
     ${filteredWhere}`,
    filters,
  );
  const totalItems = Math.max(0, integer(summaryResult.rows[0]?.total_adverts));
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const page = Math.min(requestedPage, totalPages);
  const offset = (page - 1) * pageSize;

  const [advertResult, typeResult, provinceResult] = await Promise.all([
    db.query<RecentAdvertRow>(
      `${RECENT_ADVERTS_CTE}
       select *
       from recent_marketplace_adverts
       ${filteredWhere}
       order by published_at desc, id desc
       limit $6 offset $7`,
      [...filters, pageSize, offset],
    ),
    db.query<OptionRow>(
      `${RECENT_ADVERTS_CTE}
       select type_label as value, count(*)::int as count
       from recent_marketplace_adverts
       where ($2::text = '' or concat_ws(' ', title, brand_name, model_name,
         type_label, province, area, advertiser_name) ilike '%' || $2 || '%' escape '\\')
       group by type_label
       order by type_label`,
      [viewerUserId, search],
    ),
    db.query<OptionRow>(
      `${RECENT_ADVERTS_CTE}
       select province as value, count(*)::int as count
       from recent_marketplace_adverts
       where ($2::text = '' or concat_ws(' ', title, brand_name, model_name,
         type_label, province, area, advertiser_name) ilike '%' || $2 || '%' escape '\\')
       group by province
       order by province`,
      [viewerUserId, search],
    ),
  ]);

  const summaryRow = summaryResult.rows[0];
  const rangeStart = totalItems ? offset + 1 : 0;
  const rangeEnd = totalItems ? Math.min(offset + pageSize, totalItems) : 0;

  return {
    adverts: advertResult.rows.map(mapAdvert),
    typeOptions: typeResult.rows.map(option).filter((item) => item.value),
    provinceOptions: provinceResult.rows.map(option).filter((item) => item.value),
    summary: {
      totalAdverts: totalItems,
      advertiserCount: Math.max(0, integer(summaryRow?.advertiser_count)),
      provinceCount: Math.max(0, integer(summaryRow?.province_count)),
    },
    pagination: {
      page,
      pageSize,
      totalItems,
      totalPages,
      rangeStart,
      rangeEnd,
      hasPreviousPage: page > 1,
      hasNextPage: page < totalPages,
    },
  };
}
