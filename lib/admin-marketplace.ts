import { getDb } from './db';
import {
  summarizeAdminMarketplaceAssets,
  type AdminMarketplaceAssetRow,
  type AdminMarketplaceListingStatus,
  type AdminMarketplaceMetrics,
  type AdminMarketplaceReport,
} from './admin-marketplace-shared';
import {
  ensureMarketplaceViewTracking,
  getAdminMarketplaceViewDetails,
} from './marketplace-views';

export { getAdminMarketplaceViewDetails };

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
  total_views: DatabaseValue;
  account_views: DatabaseValue;
  unknown_views: DatabaseValue;
  unique_viewers: DatabaseValue;
  last_viewed_at: DatabaseValue;
  repeat_viewer_views: DatabaseValue;
  repeat_viewer_label: DatabaseValue;
  repeat_viewer_account_type: DatabaseValue;
  repeat_viewer_last_viewed_at: DatabaseValue;
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
  total_views: DatabaseValue;
  account_views: DatabaseValue;
  unknown_views: DatabaseValue;
  viewed_assets: DatabaseValue;
  repeat_interest_assets: DatabaseValue;
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
  ),
  marketplace_viewer_counts as (
    select
      view.asset_register_item_id::text as asset_id,
      view.viewer_user_id,
      view.anonymous_viewer_hash,
      count(*)::bigint as view_count,
      max(view.viewed_at) as last_viewed_at
    from public.marketplace_listing_views view
    group by
      view.asset_register_item_id,
      view.viewer_user_id,
      view.anonymous_viewer_hash
  ),
  marketplace_view_rollup as (
    select
      viewer.asset_id,
      sum(viewer.view_count)::bigint as total_views,
      coalesce(sum(viewer.view_count) filter (where viewer.viewer_user_id is not null), 0)::bigint
        as account_views,
      coalesce(sum(viewer.view_count) filter (where viewer.viewer_user_id is null), 0)::bigint
        as unknown_views,
      count(*)::bigint as unique_viewers,
      max(viewer.last_viewed_at) as last_viewed_at
    from marketplace_viewer_counts viewer
    group by viewer.asset_id
  ),
  ranked_marketplace_viewers as (
    select
      viewer.*,
      row_number() over (
        partition by viewer.asset_id
        order by viewer.view_count desc, viewer.last_viewed_at desc
      ) as viewer_rank
    from marketplace_viewer_counts viewer
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
  totalViews: 0,
  accountViews: 0,
  unknownViews: 0,
  viewedAssets: 0,
  repeatInterestAssets: 0,
};

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
let marketplaceHistoryExistsPromise: Promise<boolean> | null = null;

export type AdminDeleteMarketplaceAssetInput = {
  accountUserId: string;
  sourceAssetId: string | null;
  latestListingId: string;
  adminUserId: string;
  adminName: string;
};

export type AdminDeleteMarketplaceAssetResult = {
  deletedListingEvents: number;
  removedFromLiveMarketplace: boolean;
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
  if (!marketplaceHistoryExistsPromise) {
    marketplaceHistoryExistsPromise = getDb()
      .query<{ exists: boolean }>(
        `select
           to_regclass('public.marketplace_listings') is not null
           and to_regclass('public.asset_register_items') is not null as exists`,
      )
      .then((result) => Boolean(result.rows[0]?.exists))
      .catch((error) => {
        marketplaceHistoryExistsPromise = null;
        throw error;
      });
  }

  return marketplaceHistoryExistsPromise;
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
    totalViews: number(row.total_views),
    accountViews: number(row.account_views),
    unknownViews: number(row.unknown_views),
    viewedAssets: number(row.viewed_assets),
    repeatInterestAssets: number(row.repeat_interest_assets),
  };
}

export async function getAdminMarketplaceSummary(): Promise<AdminMarketplaceMetrics> {
  if (!(await marketplaceHistoryExists())) return { ...EMPTY_METRICS };
  await ensureMarketplaceViewTracking();

  const result = await getDb().query<MarketplaceSummaryRow>(`
    ${LATEST_MARKETPLACE_ROWS_CTE}
    select
      count(*)::bigint as total_unique_assets,
      coalesce(sum(history.listing_events), 0)::bigint as total_listing_events,
      count(*) filter (where history.listing_events > 1)::bigint as relisted_assets,
      coalesce(sum(history.asking_price_ex_vat), 0)::numeric as all_time_advertised_value_ex_vat,
      count(*) filter (where history.status = 'live')::bigint as live_assets,
      coalesce(sum(history.asking_price_ex_vat) filter (where history.status = 'live'), 0)::numeric
        as live_advertised_value_ex_vat,
      count(*) filter (where history.status = 'withdrawn')::bigint as withdrawn_assets,
      count(distinct history.user_id)::bigint as accounts_advertising,
      min(history.first_advertised_at) as first_advertised_at,
      coalesce(sum(view_summary.total_views), 0)::bigint as total_views,
      coalesce(sum(view_summary.account_views), 0)::bigint as account_views,
      coalesce(sum(view_summary.unknown_views), 0)::bigint as unknown_views,
      count(*) filter (where coalesce(view_summary.total_views, 0) > 0)::bigint as viewed_assets,
      count(*) filter (where coalesce(top_viewer.view_count, 0) >= 3)::bigint
        as repeat_interest_assets
    from ranked_marketplace_history history
    left join marketplace_view_rollup view_summary on view_summary.asset_id = history.asset_id
    left join ranked_marketplace_viewers top_viewer
      on top_viewer.asset_id = history.asset_id and top_viewer.viewer_rank = 1
    where history.latest_rank = 1
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
  await ensureMarketplaceViewTracking();

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
      history.listing_events,
      coalesce(view_summary.total_views, 0)::bigint as total_views,
      coalesce(view_summary.account_views, 0)::bigint as account_views,
      coalesce(view_summary.unknown_views, 0)::bigint as unknown_views,
      coalesce(view_summary.unique_viewers, 0)::bigint as unique_viewers,
      view_summary.last_viewed_at,
      coalesce(top_viewer.view_count, 0)::bigint as repeat_viewer_views,
      case
        when top_viewer.viewer_user_id is not null then coalesce(
          nullif(viewer_profile.business_name, ''),
          nullif(viewer_profile.display_name, ''),
          nullif(viewer_auth_user.name, ''),
          nullif(viewer_auth_user.email, ''),
          'Aim4price account'
        )
        when top_viewer.anonymous_viewer_hash is not null then
          'Unknown viewer ' || upper(substr(top_viewer.anonymous_viewer_hash, 1, 6))
        else ''
      end as repeat_viewer_label,
      coalesce(nullif(viewer_profile.account_type, ''), '') as repeat_viewer_account_type,
      top_viewer.last_viewed_at as repeat_viewer_last_viewed_at
    from ranked_marketplace_history history
    left join public.equipment_families family on family.id = history.equipment_family_id
    left join public.sectors sector on sector.id = coalesce(history.sector_id, family.sector_id)
    left join public.account_profiles profile on profile.user_id = history.user_id
    left join public."user" auth_user on auth_user.id = history.user_id
    left join marketplace_view_rollup view_summary on view_summary.asset_id = history.asset_id
    left join ranked_marketplace_viewers top_viewer
      on top_viewer.asset_id = history.asset_id and top_viewer.viewer_rank = 1
    left join public.account_profiles viewer_profile
      on viewer_profile.user_id = top_viewer.viewer_user_id
    left join public."user" viewer_auth_user
      on viewer_auth_user.id = top_viewer.viewer_user_id
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
    totalViews: Math.max(0, Math.round(number(row.total_views))),
    accountViews: Math.max(0, Math.round(number(row.account_views))),
    unknownViews: Math.max(0, Math.round(number(row.unknown_views))),
    uniqueViewers: Math.max(0, Math.round(number(row.unique_viewers))),
    lastViewedAtIso: iso(row.last_viewed_at) || null,
    repeatViewerViews: Math.max(0, Math.round(number(row.repeat_viewer_views))),
    repeatViewerLabel: text(row.repeat_viewer_label),
    repeatViewerAccountType: text(row.repeat_viewer_account_type),
    repeatViewerLastViewedAtIso: iso(row.repeat_viewer_last_viewed_at) || null,
    hasRepeatInterest: number(row.repeat_viewer_views) >= 3,
  }));

  return {
    generatedAtIso: new Date().toISOString(),
    metrics: summarizeAdminMarketplaceAssets(assets),
    assets,
  };
}

export async function adminDeleteMarketplaceAsset(
  input: AdminDeleteMarketplaceAssetInput,
): Promise<AdminDeleteMarketplaceAssetResult> {
  const accountUserId = text(input.accountUserId);
  const sourceAssetId = text(input.sourceAssetId) || null;
  const latestListingId = text(input.latestListingId);
  const adminUserId = text(input.adminUserId);

  if (!accountUserId || !latestListingId || !adminUserId) {
    throw new Error('ADMIN_MARKETPLACE_REFERENCE_REQUIRED');
  }
  if (sourceAssetId && !UUID_PATTERN.test(sourceAssetId)) {
    throw new Error('ADMIN_MARKETPLACE_REFERENCE_INVALID');
  }
  if (!sourceAssetId && !UUID_PATTERN.test(latestListingId)) {
    throw new Error('ADMIN_MARKETPLACE_REFERENCE_INVALID');
  }
  if (!(await marketplaceHistoryExists())) {
    throw new Error('ADMIN_MARKETPLACE_LISTING_NOT_FOUND');
  }
  await ensureMarketplaceViewTracking();

  const client = await getDb().connect();
  try {
    await client.query('begin');

    let listingTitle = '';
    let deletedListingEvents = 0;
    let removedFromLiveMarketplace = false;

    if (sourceAssetId) {
      const assetResult = await client.query<{
        title: string | null;
        marketplace_status: string | null;
      }>(
        `select title, marketplace_status
         from public.asset_register_items
         where id = $1::uuid and user_id = $2
         for update`,
        [sourceAssetId, accountUserId],
      );
      const historyResult = await client.query<{ id: string; title: string | null }>(
        `select id::text, title
         from public.marketplace_listings
         where asset_register_item_id = $1::uuid and user_id = $2
         for update`,
        [sourceAssetId, accountUserId],
      );
      const assetWasLive =
        text(assetResult.rows[0]?.marketplace_status).toLowerCase() === 'live';

      if (!assetWasLive && historyResult.rows.length === 0) {
        throw new Error('ADMIN_MARKETPLACE_LISTING_NOT_FOUND');
      }

      listingTitle =
        text(historyResult.rows[0]?.title) ||
        text(assetResult.rows[0]?.title) ||
        'Aim4price listing';

      const assetUpdate = await client.query(
        `update public.asset_register_items
         set marketplace_status = 'draft', updated_at = now()
         where id = $1::uuid and user_id = $2
           and lower(coalesce(marketplace_status, 'draft')) = 'live'`,
        [sourceAssetId, accountUserId],
      );
      removedFromLiveMarketplace = (assetUpdate.rowCount ?? 0) > 0;

      await client.query(
        `delete from public.marketplace_listing_views
         where asset_register_item_id = $1::uuid`,
        [sourceAssetId],
      );

      const historyDelete = await client.query<{ id: string }>(
        `delete from public.marketplace_listings
         where asset_register_item_id = $1::uuid and user_id = $2
         returning id::text`,
        [sourceAssetId, accountUserId],
      );
      deletedListingEvents = historyDelete.rows.length;
    } else {
      const historyResult = await client.query<{ id: string; title: string | null }>(
        `select id::text, title
         from public.marketplace_listings
         where id = $1::uuid and user_id = $2
           and asset_register_item_id is null
         for update`,
        [latestListingId, accountUserId],
      );
      if (!historyResult.rows[0]) {
        throw new Error('ADMIN_MARKETPLACE_LISTING_NOT_FOUND');
      }

      listingTitle = text(historyResult.rows[0].title) || 'Aim4price listing';
      const historyDelete = await client.query<{ id: string }>(
        `delete from public.marketplace_listings
         where id = $1::uuid and user_id = $2
           and asset_register_item_id is null
         returning id::text`,
        [latestListingId, accountUserId],
      );
      deletedListingEvents = historyDelete.rows.length;
    }

    const auditTable = await client.query<{ exists: boolean }>(
      `select to_regclass('public.access_audit_events') is not null as exists`,
    );
    if (auditTable.rows[0]?.exists) {
      await client.query(
        `insert into public.access_audit_events
           (owner_user_id, actor_user_id, event_type, entity_type, entity_id, metadata_json, created_at)
         values ($1, $2, 'admin_marketplace_listing_deleted', 'marketplace_listing', $3, $4::jsonb, now())`,
        [
          accountUserId,
          adminUserId,
          sourceAssetId ?? latestListingId,
          JSON.stringify({
            title: listingTitle,
            sourceAssetId,
            latestListingId,
            deletedListingEvents,
            removedFromLiveMarketplace,
            adminName: text(input.adminName) || 'Aim4price admin',
            underlyingAssetRetained: true,
          }),
        ],
      );
    }

    await client.query('commit');
    return { deletedListingEvents, removedFromLiveMarketplace };
  } catch (error) {
    await client.query('rollback').catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}
