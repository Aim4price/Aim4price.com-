import { getDb } from './db';
import { ensureMarketplaceColumns } from './marketplace-db';
import { ensureMarketplaceViewTracking } from './marketplace-views';

export const MARKETPLACE_OUTCOME_REASONS = [
  'sold',
  'traded',
  'no_longer_available',
  'decided_not_to_sell',
  'created_by_mistake',
  'other',
] as const;

export const MARKETPLACE_OUTCOME_SOURCES = ['marketplace', 'showroom'] as const;

export const MARKETPLACE_OUTCOME_ACTOR_TYPES = [
  'account',
  'dealer_staff',
  'owner_app',
  'admin_support',
] as const;

export type MarketplaceOutcomeReason = (typeof MARKETPLACE_OUTCOME_REASONS)[number];
export type MarketplaceOutcomeSource = (typeof MARKETPLACE_OUTCOME_SOURCES)[number];
export type MarketplaceOutcomeActorType = (typeof MARKETPLACE_OUTCOME_ACTOR_TYPES)[number];

export type CloseMarketplaceListingOutcomeInput = {
  sellerUserId: string;
  assetId?: string | null;
  listingId?: string | null;
  outcomeReason: MarketplaceOutcomeReason;
  aim4priceHelped: boolean;
  finalSalePriceExVat?: number | null;
  outcomeNote?: string | null;
  sourceSurface: MarketplaceOutcomeSource;
  actorType?: MarketplaceOutcomeActorType;
  actorId?: string | null;
};

export type MarketplaceListingOutcomeResult = {
  outcomeId: string;
  listingId: string | null;
  assetId: string | null;
  marketplaceStatus: 'draft' | null;
  outcomeReason: MarketplaceOutcomeReason;
  aim4priceHelped: boolean;
  finalSalePriceExVat: number | null;
  sourceSurface: MarketplaceOutcomeSource;
  totalViewsAtClose: number;
  accountViewsAtClose: number;
  unknownViewsAtClose: number;
  uniqueViewersAtClose: number;
  closedAtIso: string;
};

type AssetRow = Record<string, unknown> & {
  id: unknown;
  user_id: unknown;
  marketplace_status: unknown;
};

type ListingRow = {
  id: unknown;
  asset_register_item_id?: unknown;
  status?: unknown;
  title: unknown;
  asking_price_ex_vat: unknown;
  published_at: unknown;
};

type ViewSnapshotRow = {
  total_views: unknown;
  account_views: unknown;
  unknown_views: unknown;
  unique_viewers: unknown;
};

type OutcomeInsertRow = {
  id: unknown;
  closed_at: unknown;
};

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_OUTCOME_NOTE_LENGTH = 500;
const MAX_REFERENCE_LENGTH = 200;
const MAX_FINAL_PRICE_EX_VAT = 999_999_999_999.99;

let marketplaceOutcomeSchemaReady = false;
let marketplaceOutcomeSchemaPromise: Promise<void> | null = null;

function cleanText(value: unknown): string {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function cleanNumber(value: unknown): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function optionalMoney(value: unknown): number | null {
  if (value === null || typeof value === 'undefined' || value === '') return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  return Math.round(parsed * 100) / 100;
}

function moneyFromRow(row: Record<string, unknown>, candidates: string[]): number | null {
  for (const candidate of candidates) {
    const amount = optionalMoney(row[candidate]);
    if (amount !== null && amount >= 0) return amount;
  }
  return null;
}

function titleFromAsset(row: Record<string, unknown>): string {
  return (
    cleanText(row.title) ||
    cleanText(row.name) ||
    cleanText(row.asset_name) ||
    [cleanText(row.brand_name), cleanText(row.model_name)].filter(Boolean).join(' ') ||
    'Aim4price listing'
  );
}

function iso(value: unknown): string {
  const parsed = value instanceof Date ? value : new Date(String(value ?? ''));
  return Number.isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString();
}

function includesValue<const T extends readonly string[]>(values: T, value: string): value is T[number] {
  return values.includes(value);
}

async function ensureMarketplaceOutcomeSchemaOnce(): Promise<void> {
  await ensureMarketplaceColumns();
  await ensureMarketplaceViewTracking();

  await getDb().query(`
    create table if not exists public.marketplace_listing_outcomes (
      id uuid primary key default gen_random_uuid(),
      marketplace_listing_id uuid
        references public.marketplace_listings(id) on delete set null,
      asset_register_item_id uuid
        references public.asset_register_items(id) on delete set null,
      seller_user_id text not null,
      outcome_reason text not null,
      aim4price_helped boolean not null,
      final_sale_price_ex_vat numeric(14,2),
      outcome_note text not null default '',
      source_surface text not null,
      title_snapshot text not null,
      asking_price_ex_vat_snapshot numeric(14,2) not null default 0,
      aim4price_value_ex_vat_snapshot numeric(14,2),
      total_views_at_close bigint not null default 0,
      account_views_at_close bigint not null default 0,
      unknown_views_at_close bigint not null default 0,
      unique_viewers_at_close bigint not null default 0,
      published_at timestamptz,
      closed_at timestamptz not null default now(),
      actor_type text not null default 'account',
      actor_id text,
      constraint marketplace_listing_outcomes_reason_check
        check (outcome_reason in (
          'sold', 'traded', 'no_longer_available', 'decided_not_to_sell',
          'created_by_mistake', 'other'
        )),
      constraint marketplace_listing_outcomes_source_check
        check (source_surface in ('marketplace', 'showroom')),
      constraint marketplace_listing_outcomes_actor_check
        check (actor_type in ('account', 'dealer_staff', 'owner_app', 'admin_support')),
      constraint marketplace_listing_outcomes_final_price_check
        check (
          final_sale_price_ex_vat is null
          or (
            outcome_reason in ('sold', 'traded')
            and final_sale_price_ex_vat > 0
          )
        ),
      constraint marketplace_listing_outcomes_snapshot_values_check
        check (
          asking_price_ex_vat_snapshot >= 0
          and (aim4price_value_ex_vat_snapshot is null or aim4price_value_ex_vat_snapshot >= 0)
        ),
      constraint marketplace_listing_outcomes_view_counts_check
        check (
          total_views_at_close >= 0
          and account_views_at_close >= 0
          and unknown_views_at_close >= 0
          and unique_viewers_at_close >= 0
          and total_views_at_close = account_views_at_close + unknown_views_at_close
        ),
      constraint marketplace_listing_outcomes_note_length_check
        check (
          char_length(outcome_note) <= 500
          and (outcome_reason <> 'other' or char_length(trim(outcome_note)) >= 3)
        )
    );

    create unique index if not exists idx_marketplace_listing_outcomes_listing
      on public.marketplace_listing_outcomes(marketplace_listing_id)
      where marketplace_listing_id is not null;

    create index if not exists idx_marketplace_listing_outcomes_seller_closed
      on public.marketplace_listing_outcomes(seller_user_id, closed_at desc);

    create index if not exists idx_marketplace_listing_outcomes_helped_closed
      on public.marketplace_listing_outcomes(aim4price_helped, closed_at desc);

    create index if not exists idx_marketplace_listing_outcomes_reason_closed
      on public.marketplace_listing_outcomes(outcome_reason, closed_at desc);
  `);

  marketplaceOutcomeSchemaReady = true;
}

export async function ensureMarketplaceOutcomeSchema(): Promise<void> {
  if (marketplaceOutcomeSchemaReady) return;

  if (!marketplaceOutcomeSchemaPromise) {
    marketplaceOutcomeSchemaPromise = ensureMarketplaceOutcomeSchemaOnce().catch((error) => {
      marketplaceOutcomeSchemaPromise = null;
      throw error;
    });
  }

  await marketplaceOutcomeSchemaPromise;
}

function validateInput(input: CloseMarketplaceListingOutcomeInput): {
  sellerUserId: string;
  assetId: string | null;
  listingId: string | null;
  outcomeReason: MarketplaceOutcomeReason;
  aim4priceHelped: boolean;
  finalSalePriceExVat: number | null;
  outcomeNote: string;
  sourceSurface: MarketplaceOutcomeSource;
  actorType: MarketplaceOutcomeActorType;
  actorId: string | null;
} {
  const sellerUserId = cleanText(input.sellerUserId);
  const assetId = cleanText(input.assetId);
  const listingId = cleanText(input.listingId);
  const outcomeReason = cleanText(input.outcomeReason);
  const sourceSurface = cleanText(input.sourceSurface);
  const actorType = cleanText(input.actorType || 'account');
  const actorId = cleanText(input.actorId).slice(0, MAX_REFERENCE_LENGTH) || null;
  const outcomeNote = cleanText(input.outcomeNote);

  if (
    !sellerUserId
    || sellerUserId.length > MAX_REFERENCE_LENGTH
    || (assetId ? !UUID_PATTERN.test(assetId) : !UUID_PATTERN.test(listingId))
  ) {
    throw new Error('MARKETPLACE_OUTCOME_REFERENCE_INVALID');
  }
  if (!includesValue(MARKETPLACE_OUTCOME_REASONS, outcomeReason)) {
    throw new Error('MARKETPLACE_OUTCOME_REASON_INVALID');
  }
  if (typeof input.aim4priceHelped !== 'boolean') {
    throw new Error('MARKETPLACE_OUTCOME_HELP_RESPONSE_REQUIRED');
  }
  if (!includesValue(MARKETPLACE_OUTCOME_SOURCES, sourceSurface)) {
    throw new Error('MARKETPLACE_OUTCOME_SOURCE_INVALID');
  }
  if (!includesValue(MARKETPLACE_OUTCOME_ACTOR_TYPES, actorType)) {
    throw new Error('MARKETPLACE_OUTCOME_ACTOR_INVALID');
  }
  if (outcomeNote.length > MAX_OUTCOME_NOTE_LENGTH) {
    throw new Error('MARKETPLACE_OUTCOME_NOTE_TOO_LONG');
  }
  if (outcomeReason === 'other' && outcomeNote.length < 3) {
    throw new Error('MARKETPLACE_OUTCOME_NOTE_REQUIRED');
  }
  const finalSalePriceExVat = optionalMoney(input.finalSalePriceExVat);
  if (
    input.finalSalePriceExVat !== null &&
    typeof input.finalSalePriceExVat !== 'undefined' &&
    (finalSalePriceExVat === null || finalSalePriceExVat <= 0 || finalSalePriceExVat > MAX_FINAL_PRICE_EX_VAT)
  ) {
    throw new Error('MARKETPLACE_OUTCOME_FINAL_PRICE_INVALID');
  }
  if (finalSalePriceExVat !== null && outcomeReason !== 'sold' && outcomeReason !== 'traded') {
    throw new Error('MARKETPLACE_OUTCOME_FINAL_PRICE_NOT_APPLICABLE');
  }

  return {
    sellerUserId,
    assetId: assetId || null,
    listingId: listingId || null,
    outcomeReason,
    aim4priceHelped: input.aim4priceHelped,
    finalSalePriceExVat,
    outcomeNote,
    sourceSurface,
    actorType,
    actorId,
  };
}

/**
 * Closes one seller-owned live advert and records an immutable outcome snapshot.
 * Linked assets remain in the Asset Register; listing-only adverts retain a null asset reference.
 */
export async function closeMarketplaceListingWithOutcome(
  input: CloseMarketplaceListingOutcomeInput,
): Promise<MarketplaceListingOutcomeResult> {
  const validated = validateInput(input);
  await ensureMarketplaceOutcomeSchema();

  const client = await getDb().connect();
  try {
    await client.query('begin');

    let asset: AssetRow | null = null;
    let listing: ListingRow | null = null;

    if (validated.assetId) {
      const assetResult = await client.query<AssetRow>(
        `select *
         from public.asset_register_items
         where id = $1::uuid and user_id = $2
         for update`,
        [validated.assetId, validated.sellerUserId],
      );
      asset = assetResult.rows[0] ?? null;
      if (!asset) {
        throw new Error('ASSET_NOT_FOUND');
      }
      if (cleanText(asset.marketplace_status).toLowerCase() !== 'live') {
        throw new Error('MARKETPLACE_LISTING_NOT_LIVE');
      }

      const listingResult = await client.query<ListingRow>(
        `select id::text, asset_register_item_id::text, status, title, asking_price_ex_vat, published_at
         from public.marketplace_listings
         where asset_register_item_id = $1::uuid
           and user_id = $2
           and lower(coalesce(status, '')) = 'live'
         order by published_at desc nulls last, created_at desc, id desc
         limit 1
         for update`,
        [validated.assetId, validated.sellerUserId],
      );
      listing = listingResult.rows[0] ?? null;

      await client.query(
        `update public.asset_register_items
         set marketplace_status = 'draft', updated_at = now()
         where id = $1::uuid and user_id = $2`,
        [validated.assetId, validated.sellerUserId],
      );

      await client.query(
        `update public.marketplace_listings
         set status = 'withdrawn', withdrawn_at = coalesce(withdrawn_at, now()), updated_at = now()
         where asset_register_item_id = $1::uuid
           and user_id = $2
           and lower(coalesce(status, '')) = 'live'`,
        [validated.assetId, validated.sellerUserId],
      );
    } else {
      if (!validated.listingId) {
        throw new Error('MARKETPLACE_OUTCOME_REFERENCE_INVALID');
      }

      const listingResult = await client.query<ListingRow>(
        `select id::text, asset_register_item_id::text, status, title, asking_price_ex_vat, published_at
         from public.marketplace_listings
         where id = $1::uuid and user_id = $2
         for update`,
        [validated.listingId, validated.sellerUserId],
      );
      listing = listingResult.rows[0] ?? null;
      if (!listing) {
        throw new Error('MARKETPLACE_LISTING_NOT_FOUND');
      }
      if (cleanText(listing.asset_register_item_id)) {
        throw new Error('MARKETPLACE_OUTCOME_ASSET_REFERENCE_REQUIRED');
      }
      if (cleanText(listing.status).toLowerCase() !== 'live') {
        throw new Error('MARKETPLACE_LISTING_NOT_LIVE');
      }

      await client.query(
        `update public.marketplace_listings
         set status = 'withdrawn', withdrawn_at = coalesce(withdrawn_at, now()), updated_at = now()
         where id = $1::uuid
           and user_id = $2
           and lower(coalesce(status, '')) = 'live'`,
        [validated.listingId, validated.sellerUserId],
      );
    }

    const viewResult = validated.assetId
      ? await client.query<ViewSnapshotRow>(
        `select
           count(*)::bigint as total_views,
           count(*) filter (where viewer_user_id is not null)::bigint as account_views,
           count(*) filter (where viewer_user_id is null)::bigint as unknown_views,
           count(distinct case
             when viewer_user_id is not null then 'account:' || viewer_user_id
             else 'unknown:' || anonymous_viewer_hash
           end)::bigint as unique_viewers
         from public.marketplace_listing_views
         where asset_register_item_id = $1::uuid
           and ($2::timestamptz is null or viewed_at >= $2::timestamptz)`,
        [validated.assetId, listing?.published_at ?? null],
      )
      : await client.query<ViewSnapshotRow>(
        `select
           count(*)::bigint as total_views,
           count(*) filter (where viewer_user_id is not null)::bigint as account_views,
           count(*) filter (where viewer_user_id is null)::bigint as unknown_views,
           count(distinct case
             when viewer_user_id is not null then 'account:' || viewer_user_id
             else 'unknown:' || anonymous_viewer_hash
           end)::bigint as unique_viewers
         from public.marketplace_listing_views
         where listing_reference = $1
           and ($2::timestamptz is null or viewed_at >= $2::timestamptz)`,
        [cleanText(listing?.id), listing?.published_at ?? null],
      );
    const views = viewResult.rows[0];
    const totalViewsAtClose = Math.max(0, Math.round(cleanNumber(views?.total_views)));
    const accountViewsAtClose = Math.max(0, Math.round(cleanNumber(views?.account_views)));
    const unknownViewsAtClose = Math.max(0, Math.round(cleanNumber(views?.unknown_views)));
    const uniqueViewersAtClose = Math.max(0, Math.round(cleanNumber(views?.unique_viewers)));

    const askingPriceExVat = Math.max(
      0,
      optionalMoney(listing?.asking_price_ex_vat) ??
        (asset ? moneyFromRow(asset, ['marketplace_price_ex_vat', 'asking_price_ex_vat']) : null) ??
        0,
    );
    const aim4priceValueExVat = asset
      ? moneyFromRow(asset, [
        'aim4price_value_ex_vat',
        'aim4price_value',
        'selected_value_ex_vat',
        'selected_value',
        'saved_value_ex_vat',
        'value',
      ])
      : null;
    const title = cleanText(listing?.title) || (asset ? titleFromAsset(asset) : 'Aim4price listing');

    const inserted = await client.query<OutcomeInsertRow>(
      `insert into public.marketplace_listing_outcomes (
         marketplace_listing_id,
         asset_register_item_id,
         seller_user_id,
         outcome_reason,
         aim4price_helped,
         final_sale_price_ex_vat,
         outcome_note,
         source_surface,
         title_snapshot,
         asking_price_ex_vat_snapshot,
         aim4price_value_ex_vat_snapshot,
         total_views_at_close,
         account_views_at_close,
         unknown_views_at_close,
         unique_viewers_at_close,
         published_at,
         closed_at,
         actor_type,
         actor_id
       ) values (
         $1::uuid, $2::uuid, $3, $4, $5, $6, $7, $8, $9, $10, $11,
         $12, $13, $14, $15, $16, now(), $17, $18
       )
       returning id::text, closed_at`,
      [
        cleanText(listing?.id) || null,
        validated.assetId,
        validated.sellerUserId,
        validated.outcomeReason,
        validated.aim4priceHelped,
        validated.finalSalePriceExVat,
        validated.outcomeNote,
        validated.sourceSurface,
        title,
        askingPriceExVat,
        aim4priceValueExVat,
        totalViewsAtClose,
        accountViewsAtClose,
        unknownViewsAtClose,
        uniqueViewersAtClose,
        listing?.published_at ?? null,
        validated.actorType,
        validated.actorId,
      ],
    );
    const outcome = inserted.rows[0];
    if (!outcome) {
      throw new Error('MARKETPLACE_OUTCOME_SAVE_FAILED');
    }

    await client.query('commit');

    return {
      outcomeId: cleanText(outcome.id),
      listingId: cleanText(listing?.id) || null,
      assetId: validated.assetId,
      marketplaceStatus: validated.assetId ? 'draft' : null,
      outcomeReason: validated.outcomeReason,
      aim4priceHelped: validated.aim4priceHelped,
      finalSalePriceExVat: validated.finalSalePriceExVat,
      sourceSurface: validated.sourceSurface,
      totalViewsAtClose,
      accountViewsAtClose,
      unknownViewsAtClose,
      uniqueViewersAtClose,
      closedAtIso: iso(outcome.closed_at),
    };
  } catch (error) {
    await client.query('rollback').catch(() => undefined);
    if (error && typeof error === 'object' && 'code' in error && error.code === '23505') {
      throw new Error('MARKETPLACE_OUTCOME_ALREADY_RECORDED');
    }
    throw error;
  } finally {
    client.release();
  }
}
