import {
  type AdminDiscoveryViewDetails,
  type AdminDiscoveryViewEvent,
  type AdminDiscoveryViewerGroup,
} from "./admin-global-assets-shared";
import { isDatabaseSchemaReady } from "./database-schema-readiness";
import { getDb } from "./db";

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

let discoveryViewsReady = false;
let discoveryViewsPromise: Promise<void> | null = null;

function cleanText(value: DatabaseValue): string {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function cleanNumber(value: DatabaseValue): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function cleanIso(value: DatabaseValue): string {
  if (!value) return "";
  const parsed = value instanceof Date ? value : new Date(String(value));
  return Number.isNaN(parsed.getTime()) ? "" : parsed.toISOString();
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
  return alias ? `Unknown viewer ${alias}` : "Unknown viewer";
}

function normalizePage(value: number | undefined): number {
  return Math.max(1, Math.round(Number(value) || 1));
}

function normalizePageSize(value: number | undefined): number {
  return Math.min(
    MAX_PAGE_SIZE,
    Math.max(1, Math.round(Number(value) || DEFAULT_PAGE_SIZE)),
  );
}

async function ensureAssetDiscoveryViewTrackingOnce(): Promise<void> {
  const db = getDb();
  const schemaReady = await isDatabaseSchemaReady(() =>
    db.query(`
      select
        id,
        view_event_id,
        asset_register_item_id,
        owner_user_id,
        viewer_user_id,
        anonymous_viewer_hash,
        view_window,
        viewed_at
      from public.asset_discovery_views
      where false
    `),
  );

  if (!schemaReady) {
    await db.query(`
      create table if not exists public.asset_discovery_views (
        id bigserial primary key,
        view_event_id uuid not null unique,
        asset_register_item_id uuid not null
          references public.asset_register_items(id) on delete cascade,
        owner_user_id text not null,
        viewer_user_id text,
        anonymous_viewer_hash text,
        view_window bigint not null,
        viewed_at timestamptz not null default now(),
        constraint asset_discovery_views_viewer_identity_check
          check (num_nonnulls(viewer_user_id, anonymous_viewer_hash) = 1)
      )
    `);

    await db.query(`
      create index if not exists idx_asset_discovery_views_asset_time
        on public.asset_discovery_views(asset_register_item_id, viewed_at desc);
      create index if not exists idx_asset_discovery_views_account_repeat
        on public.asset_discovery_views(asset_register_item_id, viewer_user_id, viewed_at desc)
        where viewer_user_id is not null;
      create index if not exists idx_asset_discovery_views_unknown_repeat
        on public.asset_discovery_views(asset_register_item_id, anonymous_viewer_hash, viewed_at desc)
        where anonymous_viewer_hash is not null;
      create unique index if not exists idx_asset_discovery_views_account_window
        on public.asset_discovery_views(asset_register_item_id, viewer_user_id, view_window)
        where viewer_user_id is not null;
      create unique index if not exists idx_asset_discovery_views_unknown_window
        on public.asset_discovery_views(asset_register_item_id, anonymous_viewer_hash, view_window)
        where anonymous_viewer_hash is not null;
    `);
  }

  discoveryViewsReady = true;
}

export async function ensureAssetDiscoveryViewTracking(): Promise<void> {
  if (discoveryViewsReady) return;

  if (!discoveryViewsPromise) {
    discoveryViewsPromise = ensureAssetDiscoveryViewTrackingOnce().catch((error) => {
      discoveryViewsPromise = null;
      throw error;
    });
  }

  await discoveryViewsPromise;
}

export async function recordAssetDiscoveryView(input: {
  viewEventId: string;
  assetId: string;
  viewerUserId: string;
}): Promise<{ recorded: boolean }> {
  const viewEventId = cleanText(input.viewEventId);
  const assetId = cleanText(input.assetId);
  const viewerUserId = cleanText(input.viewerUserId).slice(0, 200);

  if (!UUID_PATTERN.test(viewEventId) || !UUID_PATTERN.test(assetId) || !viewerUserId) {
    throw new Error("ASSET_DISCOVERY_VIEW_REFERENCE_INVALID");
  }

  await ensureAssetDiscoveryViewTracking();

  const result = await getDb().query<{ id: string }>(
    `
      insert into public.asset_discovery_views (
        view_event_id,
        asset_register_item_id,
        owner_user_id,
        viewer_user_id,
        anonymous_viewer_hash,
        view_window,
        viewed_at
      )
      select
        $1::uuid,
        asset.id,
        asset.user_id,
        $3,
        null,
        floor(extract(epoch from now()) / $4::numeric)::bigint,
        now()
      from public.asset_register_items asset
      inner join public.account_profiles owner on owner.user_id = asset.user_id
      where asset.id = $2::uuid
        and coalesce(owner.discovery_participation_enabled, false) = true
        and $3::text <> asset.user_id
        and coalesce(
          nullif(trim(to_jsonb(asset)->>'lifecycle_state'), ''),
          'active'
        ) in ('active', 'transfer_pending')
        and not exists (
          select 1
          from public.asset_discovery_views recent
          where recent.asset_register_item_id = asset.id
            and recent.viewer_user_id = $3::text
            and recent.viewed_at >= now() - ($4::text || ' seconds')::interval
        )
      on conflict do nothing
      returning id::text
    `,
    [viewEventId, assetId, viewerUserId, String(DUPLICATE_WINDOW_SECONDS)],
  );

  return { recorded: Boolean(result.rows[0]?.id) };
}

export async function getAdminDiscoveryViewDetails(input: {
  assetId: string;
  page?: number;
  pageSize?: number;
}): Promise<AdminDiscoveryViewDetails> {
  const assetId = cleanText(input.assetId);
  if (!UUID_PATTERN.test(assetId)) {
    throw new Error("ADMIN_DISCOVERY_VIEW_REFERENCE_INVALID");
  }

  await ensureAssetDiscoveryViewTracking();

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
        from public.asset_discovery_views view
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
      [assetId],
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
        from public.asset_discovery_views view
        left join public.account_profiles profile on profile.user_id = view.viewer_user_id
        left join public."user" auth_user on auth_user.id = view.viewer_user_id
        where view.asset_register_item_id = $1::uuid
        order by view.viewed_at desc, view.id desc
        limit $2
        offset $3
      `,
      [assetId, pageSize, offset],
    ),
  ]);

  const unknownLabels = new Map<string, string>();
  for (const row of groupResult.rows) {
    if (cleanText(row.viewer_user_id)) continue;
    unknownLabels.set(viewerKey(row), unknownViewerLabel(row));
  }

  const viewerGroups = groupResult.rows.map<AdminDiscoveryViewerGroup>((row) => {
    const key = viewerKey(row);
    const accountUserId = cleanText(row.viewer_user_id);
    const viewCount = Math.max(0, Math.round(cleanNumber(row.view_count)));
    return {
      viewerKey: key,
      viewerKind: accountUserId ? "account" : "unknown",
      viewerLabel:
        cleanText(row.viewer_label) ||
        unknownLabels.get(key) ||
        (accountUserId ? "Aim4price account" : "Unknown viewer"),
      viewerEmail: cleanText(row.viewer_email),
      viewerAccountType: cleanText(row.viewer_account_type),
      viewCount,
      firstViewedAtIso: cleanIso(row.first_viewed_at),
      lastViewedAtIso: cleanIso(row.last_viewed_at),
      hasRepeatInterest: viewCount >= 3,
    };
  });

  const events = eventResult.rows.map<AdminDiscoveryViewEvent>((row) => {
    const key = viewerKey(row);
    const accountUserId = cleanText(row.viewer_user_id);
    return {
      id: cleanText(row.id),
      viewerKey: key,
      viewerKind: accountUserId ? "account" : "unknown",
      viewerLabel:
        cleanText(row.viewer_label) ||
        unknownLabels.get(key) ||
        (accountUserId ? "Aim4price account" : "Unknown viewer"),
      viewerEmail: cleanText(row.viewer_email),
      viewerAccountType: cleanText(row.viewer_account_type),
      viewedAtIso: cleanIso(row.viewed_at),
    };
  });

  const totalViews = viewerGroups.reduce((total, viewer) => total + viewer.viewCount, 0);
  const accountViews = viewerGroups.reduce(
    (total, viewer) =>
      total + (viewer.viewerKind === "account" ? viewer.viewCount : 0),
    0,
  );
  const unknownViews = totalViews - accountViews;
  const totalPages = Math.max(1, Math.ceil(totalViews / pageSize));

  return {
    assetId,
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
