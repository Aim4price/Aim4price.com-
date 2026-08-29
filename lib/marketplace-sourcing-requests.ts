import { getDb } from './db';
import { ensureMarketplaceColumns } from './marketplace-db';
import { ensureMarketplaceOutcomeSchema } from './marketplace-outcomes';

export type MarketplaceSourcingRequestStatus =
  | 'pending'
  | 'viewed'
  | 'declined'
  | 'closed';

export type MarketplaceSourcingActiveStatus = Extract<
  MarketplaceSourcingRequestStatus,
  'pending' | 'viewed'
>;

export type MarketplaceSourcingRequestReceipt = {
  id: string;
  marketplaceListingId: string;
  title: string;
  advertiserName: string;
  status: MarketplaceSourcingActiveStatus;
  alreadyRequested: boolean;
  createdAtIso: string;
};

export type MarketplaceSourcingRequestNotification = {
  id: string;
  title: string;
  requesterName: string;
  status: MarketplaceSourcingActiveStatus;
  createdAtIso: string;
  updatedAtIso: string;
};

export type MarketplaceSourcingRequestDetail = {
  id: string;
  marketplaceListingId: string;
  sourceAssetId: string | null;
  title: string;
  advertiserName: string;
  advertStatus: 'available' | 'sold' | 'ended';
  message: string;
  requesterName: string;
  requesterPhone: string;
  requesterEmail: string;
  status: MarketplaceSourcingRequestStatus;
  createdAtIso: string;
  viewedAtIso: string | null;
  updatedAtIso: string;
};

type RequesterProfileRow = {
  account_type: unknown;
  marketplace_seller_name: unknown;
  marketplace_phone: unknown;
  marketplace_email: unknown;
};

type EligibleAdvertRow = {
  marketplace_listing_id: unknown;
  source_asset_id: unknown;
  advertiser_user_id: unknown;
  title: unknown;
  advertiser_name: unknown;
  advert_status: unknown;
  published_at: unknown;
};

type SourcingRequestRow = {
  id: unknown;
  marketplace_listing_id: unknown;
  asset_register_item_id: unknown;
  advertiser_user_id: unknown;
  requester_user_id: unknown;
  requester_account_type: unknown;
  status: unknown;
  requester_message: unknown;
  requester_contact_name: unknown;
  requester_contact_phone: unknown;
  requester_contact_email: unknown;
  advert_title_snapshot: unknown;
  advertiser_name_snapshot: unknown;
  advert_status_snapshot: unknown;
  advert_published_at: unknown;
  created_at: unknown;
  viewed_at: unknown;
  declined_at: unknown;
  closed_at: unknown;
  updated_at: unknown;
};

type NotificationRow = Pick<
  SourcingRequestRow,
  | 'id'
  | 'advert_title_snapshot'
  | 'requester_contact_name'
  | 'status'
  | 'created_at'
  | 'updated_at'
>;

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_USER_ID_LENGTH = 200;
const MAX_MESSAGE_LENGTH = 600;
const MAX_REQUESTER_NAME_LENGTH = 200;
const MAX_REQUESTER_PHONE_LENGTH = 80;
const MAX_REQUESTER_EMAIL_LENGTH = 320;
const MAX_NEW_REQUESTS_PER_HOUR = 20;
const DEFAULT_SOURCING_MESSAGE =
  'I am looking for equipment like this. Can you help me source one?';

let sourcingRequestSchemaPromise: Promise<void> | null = null;

const LATEST_VISIBLE_ADVERT_SQL = `
  with marketplace_advert_history as (
    select
      listing.id as marketplace_listing_id,
      listing.id::text as rank_key,
      listing.user_id,
      listing.asset_register_item_id,
      case
        when listing.asset_register_item_id is not null
          then 'asset:' || listing.asset_register_item_id::text
        else 'listing:' || listing.id::text
      end as asset_key,
      lower(coalesce(nullif(trim(listing.status), ''), 'draft')) as status,
      coalesce(nullif(trim(listing.title), ''), 'Aim4price listing') as title,
      coalesce(listing.seller_name, '') as seller_name,
      coalesce(listing.seller_company, '') as seller_company,
      coalesce(listing.specs_json, '{}'::jsonb) as specs_json,
      coalesce(listing.published_at, listing.created_at, listing.updated_at) as published_at,
      listing.created_at,
      outcome.outcome_reason
    from public.marketplace_listings listing
    left join public.marketplace_listing_outcomes outcome
      on outcome.marketplace_listing_id = listing.id
    where lower(coalesce(nullif(trim(listing.status), ''), 'draft')) <> 'draft'
      and (
        listing.published_at is not null
        or lower(coalesce(listing.status, '')) in ('live', 'withdrawn')
      )

    union all

    select
      null::uuid as marketplace_listing_id,
      'current:' || asset.id::text as rank_key,
      asset.user_id,
      asset.id as asset_register_item_id,
      'asset:' || asset.id::text as asset_key,
      'live'::text as status,
      coalesce(nullif(trim(asset.title), ''), 'Aim4price listing') as title,
      coalesce(asset.marketplace_seller_name, '') as seller_name,
      coalesce(asset.marketplace_seller_company, '') as seller_company,
      coalesce(asset.specs_json, '{}'::jsonb) as specs_json,
      coalesce(asset.updated_at, asset.created_at) as published_at,
      asset.created_at,
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
          history.rank_key desc
      ) as advert_rank
    from marketplace_advert_history history
  )
  select
    advert.marketplace_listing_id::text as marketplace_listing_id,
    advert.asset_register_item_id::text as source_asset_id,
    advert.user_id as advertiser_user_id,
    advert.title,
    left(
      coalesce(
        nullif(trim(advert.seller_company), ''),
        nullif(trim(advert.specs_json#>>'{marketplaceAdBrand,businessName}'), ''),
        nullif(trim(advertiser.business_name), ''),
        nullif(trim(advert.seller_name), ''),
        nullif(trim(advertiser.marketplace_seller_name), ''),
        nullif(trim(advertiser.display_name), ''),
        'Private advertiser'
      ),
      300
    ) as advertiser_name,
    case
      when advert.status = 'live' then 'available'
      when advert.outcome_reason in ('sold', 'traded') then 'sold'
      else 'ended'
    end as advert_status,
    advert.published_at
  from ranked_marketplace_adverts advert
  join public.account_profiles advertiser
    on advertiser.user_id = advert.user_id
   and advertiser.account_status = 'active'
   and advertiser.account_type in ('owner', 'dealer')
  join public.account_profiles requester
    on requester.user_id = $1
   and requester.account_status = 'active'
   and requester.account_type in ('owner', 'dealer')
  where advert.advert_rank = 1
    and advert.marketplace_listing_id = $2::uuid
    and advert.user_id <> $1
    and coalesce(advert.outcome_reason, '') <> 'created_by_mistake'
  limit 1
`;

const REQUEST_COLUMNS_SQL = `
  request.id::text,
  request.marketplace_listing_id::text,
  request.asset_register_item_id::text,
  request.advertiser_user_id,
  request.requester_user_id,
  request.requester_account_type,
  request.status,
  request.requester_message,
  request.requester_contact_name,
  request.requester_contact_phone,
  request.requester_contact_email,
  request.advert_title_snapshot,
  request.advertiser_name_snapshot,
  request.advert_status_snapshot,
  request.advert_published_at::text,
  request.created_at::text,
  request.viewed_at::text,
  request.declined_at::text,
  request.closed_at::text,
  request.updated_at::text
`;

function valueText(value: unknown): string {
  return String(value ?? '').trim();
}

function compactText(value: unknown): string {
  return valueText(value).replace(/\s+/g, ' ');
}

function cappedMessage(value: unknown): string {
  const message = valueText(value).slice(0, MAX_MESSAGE_LENGTH);
  return message || DEFAULT_SOURCING_MESSAGE;
}

function iso(value: unknown): string {
  const parsed = value instanceof Date ? value : new Date(String(value ?? ''));
  return Number.isNaN(parsed.getTime())
    ? new Date().toISOString()
    : parsed.toISOString();
}

function optionalIso(value: unknown): string | null {
  if (!value) return null;
  const parsed = value instanceof Date ? value : new Date(String(value));
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function activeStatus(value: unknown): MarketplaceSourcingActiveStatus {
  return valueText(value).toLowerCase() === 'viewed' ? 'viewed' : 'pending';
}

function requestStatus(value: unknown): MarketplaceSourcingRequestStatus {
  const status = valueText(value).toLowerCase();
  if (status === 'viewed' || status === 'declined' || status === 'closed') {
    return status;
  }
  return 'pending';
}

function advertStatus(
  value: unknown,
): MarketplaceSourcingRequestDetail['advertStatus'] {
  const status = valueText(value).toLowerCase();
  if (status === 'available' || status === 'sold') return status;
  return 'ended';
}

function mapReceipt(
  row: SourcingRequestRow,
  alreadyRequested: boolean,
): MarketplaceSourcingRequestReceipt {
  return {
    id: valueText(row.id),
    marketplaceListingId: valueText(row.marketplace_listing_id),
    title: compactText(row.advert_title_snapshot) || 'Aim4price listing',
    advertiserName:
      compactText(row.advertiser_name_snapshot) || 'Private advertiser',
    status: activeStatus(row.status),
    alreadyRequested,
    createdAtIso: iso(row.created_at),
  };
}

function mapDetail(
  row: SourcingRequestRow,
): MarketplaceSourcingRequestDetail {
  return {
    id: valueText(row.id),
    marketplaceListingId: valueText(row.marketplace_listing_id),
    sourceAssetId: valueText(row.asset_register_item_id) || null,
    title: compactText(row.advert_title_snapshot) || 'Aim4price listing',
    advertiserName:
      compactText(row.advertiser_name_snapshot) || 'Private advertiser',
    advertStatus: advertStatus(row.advert_status_snapshot),
    message: valueText(row.requester_message),
    requesterName:
      compactText(row.requester_contact_name) || 'Aim4price member',
    requesterPhone: valueText(row.requester_contact_phone),
    requesterEmail: valueText(row.requester_contact_email),
    status: requestStatus(row.status),
    createdAtIso: iso(row.created_at),
    viewedAtIso: optionalIso(row.viewed_at),
    updatedAtIso: iso(row.updated_at),
  };
}

async function ensureMarketplaceSourcingRequestSchemaOnce(): Promise<void> {
  await ensureMarketplaceColumns();
  await ensureMarketplaceOutcomeSchema();

  await getDb().query(`
    create extension if not exists pgcrypto;

    create table if not exists public.marketplace_sourcing_requests (
      id uuid primary key default gen_random_uuid(),
      marketplace_listing_id uuid not null
        references public.marketplace_listings(id) on delete cascade,
      asset_register_item_id uuid,
      advertiser_user_id text not null
        references public.account_profiles(user_id) on delete cascade,
      requester_user_id text not null
        references public.account_profiles(user_id) on delete cascade,
      requester_account_type text not null,
      status text not null default 'pending',
      requester_message text not null default '',
      requester_contact_name text not null,
      requester_contact_phone text not null default '',
      requester_contact_email text not null default '',
      advert_title_snapshot text not null,
      advertiser_name_snapshot text not null,
      advert_status_snapshot text not null,
      advert_published_at timestamptz not null,
      created_at timestamptz not null default now(),
      viewed_at timestamptz,
      declined_at timestamptz,
      closed_at timestamptz,
      updated_at timestamptz not null default now(),
      constraint marketplace_sourcing_requests_requester_type_check
        check (requester_account_type in ('owner', 'dealer')),
      constraint marketplace_sourcing_requests_status_check
        check (status in ('pending', 'viewed', 'declined', 'closed')),
      constraint marketplace_sourcing_requests_advert_status_check
        check (advert_status_snapshot in ('available', 'sold', 'ended')),
      constraint marketplace_sourcing_requests_distinct_users_check
        check (advertiser_user_id <> requester_user_id),
      constraint marketplace_sourcing_requests_contact_check
        check (
          char_length(trim(requester_contact_phone)) > 0
          or char_length(trim(requester_contact_email)) > 0
        ),
      constraint marketplace_sourcing_requests_lengths_check
        check (
          char_length(advertiser_user_id) between 1 and 200
          and char_length(requester_user_id) between 1 and 200
          and char_length(requester_message) <= 600
          and char_length(requester_contact_name) between 1 and 200
          and char_length(requester_contact_phone) <= 80
          and char_length(requester_contact_email) <= 320
          and char_length(advert_title_snapshot) between 1 and 500
          and char_length(advertiser_name_snapshot) between 1 and 300
        )
    );

    create unique index if not exists idx_marketplace_sourcing_requests_active_once
      on public.marketplace_sourcing_requests(marketplace_listing_id, requester_user_id)
      where status in ('pending', 'viewed');

    create index if not exists idx_marketplace_sourcing_requests_advertiser_status
      on public.marketplace_sourcing_requests(advertiser_user_id, status, created_at desc);

    create index if not exists idx_marketplace_sourcing_requests_requester_created
      on public.marketplace_sourcing_requests(requester_user_id, created_at desc);
  `);
}

export async function ensureMarketplaceSourcingRequestSchema(): Promise<void> {
  if (!sourcingRequestSchemaPromise) {
    sourcingRequestSchemaPromise =
      ensureMarketplaceSourcingRequestSchemaOnce().catch((error) => {
        sourcingRequestSchemaPromise = null;
        throw error;
      });
  }

  await sourcingRequestSchemaPromise;
}

/**
 * Creates one privacy-preserving request for the latest visible version of an
 * advert. The advertiser is always resolved from Marketplace history; callers
 * cannot nominate a recipient or read that recipient's contact details.
 */
export async function createMarketplaceSourcingRequest(input: {
  requesterUserId: string;
  listingId: string;
  message?: string | null;
}): Promise<MarketplaceSourcingRequestReceipt> {
  await ensureMarketplaceSourcingRequestSchema();

  const requesterUserId = valueText(input.requesterUserId);
  const listingId = valueText(input.listingId);
  if (
    !requesterUserId
    || requesterUserId.length > MAX_USER_ID_LENGTH
    || !UUID_PATTERN.test(listingId)
  ) {
    throw new Error('MARKETPLACE_SOURCING_REFERENCE_INVALID');
  }

  const client = await getDb().connect();
  try {
    await client.query('begin');
    await client.query(
      "select pg_advisory_xact_lock(hashtext('marketplace-sourcing:' || $1))",
      [requesterUserId],
    );

    const requesterResult = await client.query<RequesterProfileRow>(
       `select
         account_type,
         marketplace_seller_name,
         marketplace_phone,
         marketplace_email
       from public.account_profiles
       where user_id = $1
         and account_status = 'active'
         and account_type in ('owner', 'dealer')
       limit 1`,
      [requesterUserId],
    );
    const requester = requesterResult.rows[0];
    if (!requester) {
      throw new Error('MARKETPLACE_SOURCING_REQUESTER_INELIGIBLE');
    }

    const requesterName = (
      compactText(requester.marketplace_seller_name)
      || 'Aim4price member'
    ).slice(0, MAX_REQUESTER_NAME_LENGTH);
    const requesterPhone = valueText(requester.marketplace_phone).slice(
      0,
      MAX_REQUESTER_PHONE_LENGTH,
    );
    const requesterEmail = valueText(requester.marketplace_email).slice(
      0,
      MAX_REQUESTER_EMAIL_LENGTH,
    );
    if (!requesterPhone && !requesterEmail) {
      throw new Error('MARKETPLACE_SOURCING_REQUESTER_CONTACT_REQUIRED');
    }

    const advertResult = await client.query<EligibleAdvertRow>(
      LATEST_VISIBLE_ADVERT_SQL,
      [requesterUserId, listingId],
    );
    const advert = advertResult.rows[0];
    if (!advert) {
      throw new Error('MARKETPLACE_SOURCING_ADVERT_NOT_AVAILABLE');
    }

    const existingResult = await client.query<SourcingRequestRow>(
      `select ${REQUEST_COLUMNS_SQL}
       from public.marketplace_sourcing_requests request
       where request.marketplace_listing_id = $1::uuid
         and request.requester_user_id = $2
         and request.status in ('pending', 'viewed')
       order by request.created_at desc
       limit 1`,
      [listingId, requesterUserId],
    );
    const existing = existingResult.rows[0];
    if (existing) {
      await client.query('commit');
      return mapReceipt(existing, true);
    }

    const rateResult = await client.query<{ request_count: unknown }>(
      `select count(*)::int as request_count
       from public.marketplace_sourcing_requests
       where requester_user_id = $1
         and created_at >= now() - interval '1 hour'`,
      [requesterUserId],
    );
    if (Number(rateResult.rows[0]?.request_count ?? 0) >= MAX_NEW_REQUESTS_PER_HOUR) {
      throw new Error('MARKETPLACE_SOURCING_RATE_LIMITED');
    }

    const insertResult = await client.query<SourcingRequestRow>(
      `insert into public.marketplace_sourcing_requests (
         marketplace_listing_id,
         asset_register_item_id,
         advertiser_user_id,
         requester_user_id,
         requester_account_type,
         status,
         requester_message,
         requester_contact_name,
         requester_contact_phone,
         requester_contact_email,
         advert_title_snapshot,
         advertiser_name_snapshot,
         advert_status_snapshot,
         advert_published_at,
         created_at,
         updated_at
       ) values (
         $1::uuid, $2::uuid, $3, $4, $5, 'pending', $6, $7, $8, $9,
         $10, $11, $12, $13::timestamptz, now(), now()
       )
       on conflict (marketplace_listing_id, requester_user_id)
         where status in ('pending', 'viewed')
       do nothing
       returning
         id::text,
         marketplace_listing_id::text,
         asset_register_item_id::text,
         advertiser_user_id,
         requester_user_id,
         requester_account_type,
         status,
         requester_message,
         requester_contact_name,
         requester_contact_phone,
         requester_contact_email,
         advert_title_snapshot,
         advertiser_name_snapshot,
         advert_status_snapshot,
         advert_published_at::text,
         created_at::text,
         viewed_at::text,
         declined_at::text,
         closed_at::text,
         updated_at::text`,
      [
        listingId,
        valueText(advert.source_asset_id) || null,
        valueText(advert.advertiser_user_id),
        requesterUserId,
        valueText(requester.account_type),
        cappedMessage(input.message),
        requesterName,
        requesterPhone,
        requesterEmail,
        compactText(advert.title).slice(0, 500) || 'Aim4price listing',
        compactText(advert.advertiser_name).slice(0, 300)
          || 'Private advertiser',
        advertStatus(advert.advert_status),
        iso(advert.published_at),
      ],
    );

    let saved = insertResult.rows[0];
    let alreadyRequested = false;
    if (!saved) {
      const racedResult = await client.query<SourcingRequestRow>(
        `select ${REQUEST_COLUMNS_SQL}
         from public.marketplace_sourcing_requests request
         where request.marketplace_listing_id = $1::uuid
           and request.requester_user_id = $2
           and request.status in ('pending', 'viewed')
         order by request.created_at desc
         limit 1`,
        [listingId, requesterUserId],
      );
      saved = racedResult.rows[0];
      alreadyRequested = true;
    }
    if (!saved) {
      throw new Error('MARKETPLACE_SOURCING_SAVE_FAILED');
    }

    await client.query('commit');
    return mapReceipt(saved, alreadyRequested);
  } catch (error) {
    await client.query('rollback').catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Returns notification-safe request metadata. Contact fields are deliberately
 * absent; they are available only through the advertiser-authorized detail API.
 */
export async function listMarketplaceSourcingRequestNotifications(
  advertiserUserId: string,
): Promise<MarketplaceSourcingRequestNotification[]> {
  await ensureMarketplaceSourcingRequestSchema();

  const userId = valueText(advertiserUserId);
  if (!userId || userId.length > MAX_USER_ID_LENGTH) return [];

  const result = await getDb().query<NotificationRow>(
    `select
       request.id::text,
       request.advert_title_snapshot,
       request.requester_contact_name,
       request.status,
       request.created_at::text,
       request.updated_at::text
     from public.marketplace_sourcing_requests request
     join public.account_profiles advertiser
       on advertiser.user_id = request.advertiser_user_id
      and advertiser.account_status = 'active'
      and advertiser.account_type in ('owner', 'dealer')
     where request.advertiser_user_id = $1
       and request.status in ('pending', 'viewed')
     order by
       case when request.status = 'pending' then 0 else 1 end,
       request.created_at desc,
       request.id desc
     limit 30`,
    [userId],
  );

  return result.rows.map((row) => ({
    id: valueText(row.id),
    title: compactText(row.advert_title_snapshot) || 'Aim4price listing',
    requesterName:
      compactText(row.requester_contact_name) || 'Aim4price member',
    status: activeStatus(row.status),
    createdAtIso: iso(row.created_at),
    updatedAtIso: iso(row.updated_at),
  }));
}

/**
 * Opens a request for its targeted advertiser and atomically marks a pending
 * request viewed. No query path in this module exposes advertiser contact data.
 */
export async function getMarketplaceSourcingRequestForAdvertiser(input: {
  advertiserUserId: string;
  requestId: string;
}): Promise<MarketplaceSourcingRequestDetail | null> {
  await ensureMarketplaceSourcingRequestSchema();

  const advertiserUserId = valueText(input.advertiserUserId);
  const requestId = valueText(input.requestId);
  if (
    !advertiserUserId
    || advertiserUserId.length > MAX_USER_ID_LENGTH
    || !UUID_PATTERN.test(requestId)
  ) {
    return null;
  }

  const client = await getDb().connect();
  try {
    await client.query('begin');
    const currentResult = await client.query<SourcingRequestRow>(
      `select ${REQUEST_COLUMNS_SQL}
       from public.marketplace_sourcing_requests request
       join public.account_profiles advertiser
         on advertiser.user_id = request.advertiser_user_id
        and advertiser.account_status = 'active'
        and advertiser.account_type in ('owner', 'dealer')
       where request.id = $2::uuid
         and request.advertiser_user_id = $1
       limit 1
       for update of request`,
      [advertiserUserId, requestId],
    );
    let request = currentResult.rows[0];
    if (!request) {
      await client.query('commit');
      return null;
    }

    if (requestStatus(request.status) === 'pending') {
      const viewedResult = await client.query<SourcingRequestRow>(
        `update public.marketplace_sourcing_requests request
         set
           status = 'viewed',
           viewed_at = coalesce(request.viewed_at, now()),
           updated_at = now()
         where request.id = $1::uuid
           and request.advertiser_user_id = $2
           and request.status = 'pending'
         returning
           id::text,
           marketplace_listing_id::text,
           asset_register_item_id::text,
           advertiser_user_id,
           requester_user_id,
           requester_account_type,
           status,
           requester_message,
           requester_contact_name,
           requester_contact_phone,
           requester_contact_email,
           advert_title_snapshot,
           advertiser_name_snapshot,
           advert_status_snapshot,
           advert_published_at::text,
           created_at::text,
           viewed_at::text,
           declined_at::text,
           closed_at::text,
           updated_at::text`,
        [requestId, advertiserUserId],
      );
      request = viewedResult.rows[0] ?? request;
    }

    await client.query('commit');
    return mapDetail(request);
  } catch (error) {
    await client.query('rollback').catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}
