import { getDb } from './db';
import {
  summarizeAdminMarketplaceAssets,
  type AdminMarketplaceAssetRow,
  type AdminMarketplaceListingStatus,
  type AdminMarketplaceMetrics,
  type AdminMarketplaceReport,
} from './admin-marketplace-shared';

type DatabaseValue = string | number | Date | null | undefined;

type MarketplaceReportRow = {
  listing_id: DatabaseValue;
  user_id: DatabaseValue;
  asset_id: DatabaseValue;
  asset_key: DatabaseValue;
  status: DatabaseValue;
  title: DatabaseValue;
  description: DatabaseValue;
  asking_price_ex_vat: DatabaseValue;
  seller_name: DatabaseValue;
  seller_company: DatabaseValue;
  seller_email: DatabaseValue;
  seller_label: DatabaseValue;
  province: DatabaseValue;
  area: DatabaseValue;
  sector_key: DatabaseValue;
  sector_label: DatabaseValue;
  family_label: DatabaseValue;
  brand_name: DatabaseValue;
  model_name: DatabaseValue;
  first_advertised_at: DatabaseValue;
  last_advertised_at: DatabaseValue;
  listing_events: DatabaseValue;
};

type MarketplaceSummaryRow = {
  total_unique_assets: DatabaseValue;
  total_listing_events: DatabaseValue;
  relisted_assets: DatabaseValue;
  all_time_advertised_value_ex_vat: DatabaseValue;
  live_assets: DatabaseValue;
  live_advertised_value_ex_vat: DatabaseValue;
  withdrawn_assets: DatabaseValue;
  accounts_advertising: DatabaseValue;
  first_advertised_at: DatabaseValue;
};

const LATEST_MARKETPLACE_ROWS_CTE = `
  with marketplace_history as (
    select
      listing.id::text as listing_id,
      listing.user_id,
      listing.asset_register_item_id::text as asset_id,
      case
        when listing.asset_register_item_id is not null
          then 'asset:' || listing.asset_register_item_id::text
        else 'listing:' || listing.id::text
      end as asset_key,
      lower(coalesce(nullif(trim(listing.status), ''), 'other')) as status,
      coalesce(nullif(trim(listing.title), ''), 'Aim4price listing') as title,
      coalesce(listing.description, '') as description,
      greatest(coalesce(listing.asking_price_ex_vat, 0), 0) as asking_price_ex_vat,
      coalesce(listing.seller_name, '') as seller_name,
      coalesce(listing.seller_company, '') as seller_company,
      coalesce(listing.seller_email, '') as seller_email,
      coalesce(listing.province, '') as province,
      coalesce(listing.area, '') as area,
      coalesce(listing.published_at, listing.created_at, listing.updated_at) as advertised_at,
      listing.withdrawn_at,
      listing.created_at,
      listing.updated_at,
      listing.sector_id,
      listing.equipment_family_id,
      listing.brand_id,
      listing.equipment_model_id,
      coalesce(listing.brand_name_snapshot, '') as brand_name_snapshot,
      coalesce(listing.model_name_raw, '') as model_name_raw,
      coalesce(listing.normalized_model_name, '') as normalized_model_name,
      coalesce(listing.specs_json, '{}'::jsonb) as specs_json
    from public.marketplace_listings listing
    where listing.published_at is not null
       or lower(coalesce(listing.status, '')) in ('live', 'withdrawn')

    union all

    select
      'current:' || asset.id::text as listing_id,
      asset.user_id,
      asset.id::text as asset_id,
      'asset:' || asset.id::text as asset_key,
      'live'::text as status,
      coalesce(nullif(trim(asset.title), ''), 'Aim4price listing') as title,
      coalesce(asset.marketplace_notes, '') as description,
      greatest(coalesce(asset.marketplace_price_ex_vat, 0), 0) as asking_price_ex_vat,
      coalesce(asset.marketplace_seller_name, '') as seller_name,
      coalesce(asset.marketplace_seller_company, '') as seller_company,
      coalesce(asset.marketplace_seller_email, '') as seller_email,
      coalesce(asset.marketplace_province, '') as province,
      coalesce(asset.marketplace_area, '') as area,
      coalesce(asset.updated_at, asset.created_at) as advertised_at,
      null::timestamptz as withdrawn_at,
      asset.created_at,
      asset.updated_at,
      asset.sector_id,
      asset.equipment_family_id,
      null::bigint as brand_id,
      asset.equipment_model_id,
      ''::text as brand_name_snapshot,
      coalesce(asset.typed_model_name, '') as model_name_raw,
      coalesce(asset.normalized_typed_model_name, '') as normalized_model_name,
      coalesce(asset.specs_json, '{}'::jsonb) as specs_json
    from public.asset_register_items asset
    where coalesce(asset.marketplace_status, 'draft') = 'live'
      and not exists (
        select 1
        from public.marketplace_listings saved_listing
        where saved_listing.asset_register_item_id = asset.id
      )
  ),
  ranked_marketplace_history as (
    select
      history.*,
      row_number() over (
        partition by history.asset_key
        order by
          history.advertised_at desc nulls last,
          case when history.status = 'live' then 0 else 1 end,
          history.created_at desc nulls last,
          history.listing_id desc
      ) as latest_rank,
      count(*) over (partition by history.asset_key)::bigint as listing_events,
      min(history.advertised_at) over (partition by history.asset_key) as first_advertised_at,
      max(history.advertised_at) over (partition by history.asset_key) as last_advertised_at
    from marketplace_history history
  )
`;

const EMPTY_METRICS: AdminMarketplaceMetrics = {
  totalUniqueAssets: 0,
  totalListingEvents: 0,
  relistedAssets: 0,
  allTimeAdvertisedValueExVat: 0,
  liveAssets: 0,
  liveAdvertisedValueExVat: 0,
  withdrawnAssets: 0,
  accountsAdvertising: 0,
  firstAdvertisedAtIso: null,
};

function text(value: DatabaseValue): string {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function number(value: DatabaseValue): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function iso(value: DatabaseValue): string {
  if (!value) return '';
  const parsed = value instanceof Date ? value : new Date(String(value));
  return Number.isNaN(parsed.getTime()) ? '' : parsed.toISOString();
}

function status(value: DatabaseValue): AdminMarketplaceListingStatus {
  const normalized = text(value).toLowerCase();
  if (normalized === 'live' || normalized === 'withdrawn' || normalized === 'draft') {
    return normalized;
  }
  return 'other';
}

function sectorKey(value: DatabaseValue): string {
  return text(value).toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'uncategorised';
}

async function marketplaceHistoryExists(): Promise<boolean> {
  const result = await getDb().query<{ exists: boolean }>(
    `select
       to_regclass('public.marketplace_listings') is not null
       and to_regclass('public.asset_register_items') is not null as exists`,
  );
  return Boolean(result.rows[0]?.exists);
}

function mapSummary(row: MarketplaceSummaryRow | undefined): AdminMarketplaceMetrics {
  if (!row) return { ...EMPTY_METRICS };

  return {
    totalUniqueAssets: number(row.total_unique_assets),
    totalListingEvents: number(row.total_listing_events),
    relistedAssets: number(row.relisted_assets),
    allTimeAdvertisedValueExVat: number(row.all_time_advertised_value_ex_vat),
    liveAssets: number(row.live_assets),
    liveAdvertisedValueExVat: number(row.live_advertised_value_ex_vat),
    withdrawnAssets: number(row.withdrawn_assets),
    accountsAdvertising: number(row.accounts_advertising),
    firstAdvertisedAtIso: iso(row.first_advertised_at) || null,
  };
}

export async function getAdminMarketplaceSummary(): Promise<AdminMarketplaceMetrics> {
  if (!(await marketplaceHistoryExists())) return { ...EMPTY_METRICS };

  const result = await getDb().query<MarketplaceSummaryRow>(`
    ${LATEST_MARKETPLACE_ROWS_CTE}
    select
      count(*)::bigint as total_unique_assets,
      coalesce(sum(listing_events), 0)::bigint as total_listing_events,
      count(*) filter (where listing_events > 1)::bigint as relisted_assets,
      coalesce(sum(asking_price_ex_vat), 0)::numeric as all_time_advertised_value_ex_vat,
      count(*) filter (where status = 'live')::bigint as live_assets,
      coalesce(sum(asking_price_ex_vat) filter (where status = 'live'), 0)::numeric
        as live_advertised_value_ex_vat,
      count(*) filter (where status = 'withdrawn')::bigint as withdrawn_assets,
      count(distinct user_id)::bigint as accounts_advertising,
      min(first_advertised_at) as first_advertised_at
    from ranked_marketplace_history
    where latest_rank = 1
  `);

  return mapSummary(result.rows[0]);
}

export async function getAdminMarketplaceReport(): Promise<AdminMarketplaceReport> {
  if (!(await marketplaceHistoryExists())) {
    return {
      generatedAtIso: new Date().toISOString(),
      metrics: { ...EMPTY_METRICS },
      assets: [],
    };
  }

  const result = await getDb().query<MarketplaceReportRow>(`
    ${LATEST_MARKETPLACE_ROWS_CTE}
    select
      history.listing_id,
      history.user_id,
      history.asset_id,
      history.asset_key,
      history.status,
      history.title,
      history.description,
      history.asking_price_ex_vat,
      coalesce(nullif(history.seller_name, ''), nullif(profile.display_name, ''), nullif(auth_user.name, ''), '')
        as seller_name,
      coalesce(nullif(history.seller_company, ''), nullif(profile.business_name, ''), '')
        as seller_company,
      coalesce(nullif(history.seller_email, ''), nullif(auth_user.email, ''), '')
        as seller_email,
      coalesce(
        nullif(history.seller_company, ''),
        nullif(profile.business_name, ''),
        nullif(history.seller_name, ''),
        nullif(profile.display_name, ''),
        nullif(auth_user.name, ''),
        nullif(auth_user.email, ''),
        'Unknown account'
      ) as seller_label,
      coalesce(nullif(history.province, ''), nullif(profile.province, ''), '') as province,
      coalesce(nullif(history.area, ''), nullif(profile.town_city, ''), '') as area,
      coalesce(
        nullif(sector.sector_key, ''),
        nullif(history.specs_json ->> 'sectorKey', ''),
        nullif(history.specs_json ->> 'sector_key', ''),
        'uncategorised'
      ) as sector_key,
      coalesce(
        nullif(sector.sector_label, ''),
        nullif(history.specs_json ->> 'sectorLabel', ''),
        nullif(history.specs_json ->> 'sector_label', ''),
        'Uncategorised'
      ) as sector_label,
      coalesce(
        nullif(family.family_label, ''),
        nullif(history.specs_json ->> 'familyLabel', ''),
        nullif(history.specs_json ->> 'family_label', ''),
        ''
      ) as family_label,
      coalesce(
        nullif(history.brand_name_snapshot, ''),
        nullif(history.specs_json ->> 'brandName', ''),
        nullif(history.specs_json ->> 'brand_name', ''),
        ''
      ) as brand_name,
      coalesce(
        nullif(history.model_name_raw, ''),
        nullif(history.specs_json ->> 'modelName', ''),
        nullif(history.specs_json ->> 'model_name', ''),
        ''
      ) as model_name,
      history.first_advertised_at,
      history.last_advertised_at,
      history.listing_events
    from ranked_marketplace_history history
    left join public.equipment_families family on family.id = history.equipment_family_id
    left join public.sectors sector on sector.id = coalesce(history.sector_id, family.sector_id)
    left join public.account_profiles profile on profile.user_id = history.user_id
    left join public."user" auth_user on auth_user.id = history.user_id
    where history.latest_rank = 1
    order by history.last_advertised_at desc nulls last, history.listing_id desc
  `);

  const assets = result.rows.map<AdminMarketplaceAssetRow>((row) => ({
    assetKey: text(row.asset_key),
    sourceAssetId: text(row.asset_id) || null,
    latestListingId: text(row.listing_id),
    accountUserId: text(row.user_id),
    title: text(row.title) || 'Aim4price listing',
    description: text(row.description),
    status: status(row.status),
    askingPriceExVat: Math.max(0, number(row.asking_price_ex_vat)),
    sellerLabel: text(row.seller_label) || 'Unknown account',
    sellerName: text(row.seller_name),
    sellerCompany: text(row.seller_company),
    sellerEmail: text(row.seller_email),
    province: text(row.province),
    area: text(row.area),
    sectorKey: sectorKey(row.sector_key),
    sectorLabel: text(row.sector_label) || 'Uncategorised',
    familyLabel: text(row.family_label),
    brandName: text(row.brand_name),
    modelName: text(row.model_name),
    firstAdvertisedAtIso: iso(row.first_advertised_at),
    lastAdvertisedAtIso: iso(row.last_advertised_at),
    listingEvents: Math.max(1, Math.round(number(row.listing_events))),
  }));

  return {
    generatedAtIso: new Date().toISOString(),
    metrics: summarizeAdminMarketplaceAssets(assets),
    assets,
  };
}
