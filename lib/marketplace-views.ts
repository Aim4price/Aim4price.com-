import { createHash } from 'node:crypto';
import {
  type AdminMarketplaceViewDetails,
  type AdminMarketplaceViewEvent,
  type AdminMarketplaceViewerGroup,
} from './admin-marketplace-shared';
import { isDatabaseSchemaReady } from './database-schema-readiness';
import { getDb } from './db';

type DatabaseValue = string | number | Date | null | undefined;

type ViewerGroupRow = {
  viewer_user_id: DatabaseValue;
  anonymous_viewer_hash: DatabaseValue;
  viewer_label: DatabaseValue;
  viewer_email: DatabaseValue;
  viewer_account_type: DatabaseValue;
  view_count: DatabaseValue;
  first_viewed_at: DatabaseValue;
  last_viewed_at: DatabaseValue;
};

type ViewEventRow = {
  id: DatabaseValue;
  viewer_user_id: DatabaseValue;
  anonymous_viewer_hash: DatabaseValue;
  viewer_label: DatabaseValue;
  viewer_email: DatabaseValue;
  viewer_account_type: DatabaseValue;
  viewed_at: DatabaseValue;
};

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DUPLICATE_WINDOW_SECONDS = 45;
const DEFAULT_PAGE_SIZE = 100;
const MAX_PAGE_SIZE = 200;

let marketplaceViewsReady = false;
let marketplaceViewsPromise: Promise<void> | null = null;

function cleanText(value: DatabaseValue): string {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function cleanNumber(value: DatabaseValue): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function cleanIso(value: DatabaseValue): string {
  if (!value) return '';
  const parsed = value instanceof Date ? value : new Date(String(value));
  return Number.isNaN(parsed.getTime()) ? '' : parsed.toISOString();
}

function viewerKey(row: {
  viewer_user_id: DatabaseValue;
  anonymous_viewer_hash: DatabaseValue;
}): string {
  const accountUserId = cleanText(row.viewer_user_id);
  if (accountUserId) return `account:${accountUserId}`;
  return `unknown:${cleanText(row.anonymous_viewer_hash).slice(0, 12)}`;
}

function unknownViewerLabel(row: { anonymous_viewer_hash: DatabaseValue }): string {
  const alias = cleanText(row.anonymous_viewer_hash).slice(0, 6).toUpperCase();
  return alias ? `Unknown viewer ${alias}` : 'Unknown viewer';
}

function normalizePage(value: number | undefined): number {
  return Math.max(1, Math.round(Number(value) || 1));
}

function normalizePageSize(value: number | undefined): number {
  return Math.min(MAX_PAGE_SIZE, Math.max(1, Math.round(Number(value) || DEFAULT_PAGE_SIZE)));
}

async function ensureMarketplaceViewTrackingOnce(): Promise<void> {
  const db = getDb();
  const schemaReady = await isDatabaseSchemaReady(() =>
    db.query(`
      select
        id,
        view_event_id,
        asset_register_item_id,
        listing_reference,
        seller_user_id,
        viewer_user_id,
        anonymous_viewer_hash,
        view_window,
        viewed_at
      from public.marketplace_listing_views
      where false
    `),
  );

  if (!schemaReady) {
    await db.query(`
      create table if not exists public.marketplace_listing_views (
        id bigserial primary key,
        view_event_id uuid not null unique,
        asset_register_item_id uuid not null
          references public.asset_register_items(id) on delete cascade,
        listing_reference text not null,
        seller_user_id text not null,
        viewer_user_id text,
        anonymous_viewer_hash text,
        view_window bigint not null,
        viewed_at timestamptz not null default now(),
        constraint marketplace_listing_views_viewer_identity_check
          check (num_nonnulls(viewer_user_id, anonymous_viewer_hash) = 1)
      )
    `);

    await db.query(`
      create index if not exists idx_marketplace_listing_views_asset_time
        on public.marketplace_listing_views(asset_register_item_id, viewed_at desc);
      create index if not exists idx_marketplace_listing_views_account_repeat
        on public.marketplace_listing_views(asset_register_item_id, viewer_user_id, viewed_at desc)
        where viewer_user_id is not null;
      create index if not exists idx_marketplace_listing_views_unknown_repeat
        on public.marketplace_listing_views(asset_register_item_id, anonymous_viewer_hash, viewed_at desc)
        where anonymous_viewer_hash is not null;
      create unique index if not exists idx_marketplace_listing_views_account_window
        on public.marketplace_listing_views(asset_register_item_id, viewer_user_id, view_window)
        where viewer_user_id is not null;
      create unique index if not exists idx_marketplace_listing_views_unknown_window
        on public.marketplace_listing_views(asset_register_item_id, anonymous_viewer_hash, view_window)
        where anonymous_viewer_hash is not null;
    `);
  }

  marketplaceViewsReady = true;
}

export async function ensureMarketplaceViewTracking(): Promise<void> {
  if (marketplaceViewsReady) return;

  if (!marketplaceViewsPromise) {
    marketplaceViewsPromise = ensureMarketplaceViewTrackingOnce().catch((error) => {
      marketplaceViewsPromise = null;
      throw error;
    });
  }

  await marketplaceViewsPromise;
}

function hashAnonymousViewer(value: string): string {
  return createHash('sha256')
    .update(`aim4price-marketplace-view:v1:${value}`)
    .digest('hex');
}

export async function recordMarketplaceListingView(input: {
  viewEventId: string;
  listingReference: string;
  sourceAssetId: string;
  viewerUserId?: string | null;
  anonymousViewerId?: string | null;
}): Promise<{ recorded: boolean }> {
  const viewEventId = cleanText(input.viewEventId);
  const sourceAssetId = cleanText(input.sourceAssetId);
  const listingReference = cleanText(input.listingReference).slice(0, 160);
  const viewerUserId = cleanText(input.viewerUserId) || null;
  const anonymousViewerId = cleanText(input.anonymousViewerId);

  if (!UUID_PATTERN.test(viewEventId) || !UUID_PATTERN.test(sourceAssetId) || !listingReference) {
    throw new Error('MARKETPLACE_VIEW_REFERENCE_INVALID');
  }
  if (!viewerUserId && !UUID_PATTERN.test(anonymousViewerId)) {
    throw new Error('MARKETPLACE_VIEWER_INVALID');
  }

  await ensureMarketplaceViewTracking();

  const anonymousViewerHash = viewerUserId ? null : hashAnonymousViewer(anonymousViewerId);
  const result = await getDb().query<{ id: string }>(
    `
      insert into public.marketplace_listing_views (
        view_event_id,
        asset_register_item_id,
        listing_reference,
        seller_user_id,
        viewer_user_id,
        anonymous_viewer_hash,
        view_window,
        viewed_at
      )
      select
        $1::uuid,
        asset.id,
        $3,
        asset.user_id,
        $4,
        $5,
        floor(extract(epoch from now()) / $6::numeric)::bigint,
        now()
      from public.asset_register_items asset
      where asset.id = $2::uuid
        and $3::text = 'asset-' || asset.id::text
        and lower(coalesce(asset.marketplace_status, 'draft')) = 'live'
        and ($4::text is null or $4::text <> asset.user_id)
        and not exists (
          select 1
          from public.marketplace_listing_views recent
          where recent.asset_register_item_id = asset.id
            and recent.viewed_at >= now() - ($6::text || ' seconds')::interval
            and (
              ($4::text is not null and recent.viewer_user_id = $4::text)
              or ($4::text is null and recent.anonymous_viewer_hash = $5::text)
            )
        )
      on conflict do nothing
      returning id::text
    `,
    [
      viewEventId,
      sourceAssetId,
      listingReference,
      viewerUserId,
      anonymousViewerHash,
      String(DUPLICATE_WINDOW_SECONDS),
    ],
  );

  return { recorded: Boolean(result.rows[0]?.id) };
}

export async function getAdminMarketplaceViewDetails(input: {
  sourceAssetId: string;
  page?: number;
  pageSize?: number;
}): Promise<AdminMarketplaceViewDetails> {
  const sourceAssetId = cleanText(input.sourceAssetId);
  if (!UUID_PATTERN.test(sourceAssetId)) {
    throw new Error('ADMIN_MARKETPLACE_VIEW_REFERENCE_INVALID');
  }

  await ensureMarketplaceViewTracking();

  const requestedPage = normalizePage(input.page);
  const pageSize = normalizePageSize(input.pageSize);
  const offset = (requestedPage - 1) * pageSize;
  const db = getDb();

  const [groupResult, eventResult] = await Promise.all([
    db.query<ViewerGroupRow>(
      `
        select
          view.viewer_user_id,
          view.anonymous_viewer_hash,
          coalesce(
            nullif(profile.business_name, ''),
            nullif(profile.display_name, ''),
            nullif(auth_user.name, ''),
            nullif(auth_user.email, ''),
            ''
          ) as viewer_label,
          coalesce(nullif(auth_user.email, ''), '') as viewer_email,
          coalesce(nullif(profile.account_type, ''), '') as viewer_account_type,
          count(*)::bigint as view_count,
          min(view.viewed_at) as first_viewed_at,
          max(view.viewed_at) as last_viewed_at
        from public.marketplace_listing_views view
        left join public.account_profiles profile on profile.user_id = view.viewer_user_id
        left join public."user" auth_user on auth_user.id = view.viewer_user_id
        where view.asset_register_item_id = $1::uuid
        group by
          view.viewer_user_id,
          view.anonymous_viewer_hash,
          profile.business_name,
          profile.display_name,
          profile.account_type,
          auth_user.name,
          auth_user.email
        order by count(*) desc, max(view.viewed_at) desc
      `,
      [sourceAssetId],
    ),
    db.query<ViewEventRow>(
      `
        select
          view.id::text,
          view.viewer_user_id,
          view.anonymous_viewer_hash,
          coalesce(
            nullif(profile.business_name, ''),
            nullif(profile.display_name, ''),
            nullif(auth_user.name, ''),
            nullif(auth_user.email, ''),
            ''
          ) as viewer_label,
          coalesce(nullif(auth_user.email, ''), '') as viewer_email,
          coalesce(nullif(profile.account_type, ''), '') as viewer_account_type,
          view.viewed_at
        from public.marketplace_listing_views view
        left join public.account_profiles profile on profile.user_id = view.viewer_user_id
        left join public."user" auth_user on auth_user.id = view.viewer_user_id
        where view.asset_register_item_id = $1::uuid
        order by view.viewed_at desc, view.id desc
        limit $2
        offset $3
      `,
      [sourceAssetId, pageSize, offset],
    ),
  ]);

  const unknownLabels = new Map<string, string>();
  for (const row of groupResult.rows) {
    if (cleanText(row.viewer_user_id)) continue;
    unknownLabels.set(viewerKey(row), unknownViewerLabel(row));
  }

  const viewerGroups = groupResult.rows.map<AdminMarketplaceViewerGroup>((row) => {
    const key = viewerKey(row);
    const accountUserId = cleanText(row.viewer_user_id);
    const viewCount = Math.max(0, Math.round(cleanNumber(row.view_count)));
    return {
      viewerKey: key,
      viewerKind: accountUserId ? 'account' : 'unknown',
      viewerLabel:
        cleanText(row.viewer_label) ||
        unknownLabels.get(key) ||
        'Unknown viewer',
      viewerEmail: cleanText(row.viewer_email),
      viewerAccountType: cleanText(row.viewer_account_type),
      viewCount,
      firstViewedAtIso: cleanIso(row.first_viewed_at),
      lastViewedAtIso: cleanIso(row.last_viewed_at),
      hasRepeatInterest: viewCount >= 3,
    };
  });

  const events = eventResult.rows.map<AdminMarketplaceViewEvent>((row) => {
    const key = viewerKey(row);
    const accountUserId = cleanText(row.viewer_user_id);
    return {
      id: cleanText(row.id),
      viewerKey: key,
      viewerKind: accountUserId ? 'account' : 'unknown',
      viewerLabel:
        cleanText(row.viewer_label) ||
        unknownLabels.get(key) ||
        'Unknown viewer',
      viewerEmail: cleanText(row.viewer_email),
      viewerAccountType: cleanText(row.viewer_account_type),
      viewedAtIso: cleanIso(row.viewed_at),
    };
  });

  const totalViews = viewerGroups.reduce((total, viewer) => total + viewer.viewCount, 0);
  const accountViews = viewerGroups.reduce(
    (total, viewer) => total + (viewer.viewerKind === 'account' ? viewer.viewCount : 0),
    0,
  );
  const unknownViews = totalViews - accountViews;
  const totalPages = Math.max(1, Math.ceil(totalViews / pageSize));

  return {
    assetId: sourceAssetId,
    totalViews,
    accountViews,
    unknownViews,
    uniqueViewers: viewerGroups.length,
    repeatViewers: viewerGroups.filter((viewer) => viewer.hasRepeatInterest).length,
    page: Math.min(requestedPage, totalPages),
    pageSize,
    totalPages,
    viewerGroups,
    events,
  };
}
