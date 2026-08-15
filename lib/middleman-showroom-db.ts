import { ensureAccountProfileColumns, getAccountProfile, type AccountProfile } from './account-profile';
import { getDb } from './db';

export type MiddlemanShowroom = {
  userId: string;
  slug: string;
  bio: string;
  isPublic: boolean;
  name: string;
  logoUrl: string;
  websiteUrl: string;
  phone: string;
  email: string;
  location: string;
};

type ShowroomRow = {
  user_id: string;
  slug: string;
  bio: string | null;
  is_public: boolean | null;
};

const RESERVED_SLUGS = new Set([
  'account',
  'admin',
  'api',
  'dealer',
  'marketplace',
  'showroom',
  'valuation',
]);

let showroomSchemaEnsured = false;

function asText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function slugify(value: unknown): string {
  return asText(value)
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

function showroomName(profile: AccountProfile): string {
  return profile.businessName || profile.marketplaceSellerName || profile.displayName || profile.name || 'Aim4price seller';
}

function mapShowroom(row: ShowroomRow, profile: AccountProfile): MiddlemanShowroom {
  return {
    userId: row.user_id,
    slug: row.slug,
    bio: asText(row.bio),
    isPublic: row.is_public !== false,
    name: showroomName(profile),
    logoUrl: profile.logoUrl,
    websiteUrl: profile.websiteUrl,
    phone: profile.marketplacePhone || profile.phone,
    email: profile.marketplaceEmail || profile.email,
    location: profile.marketplaceLocation || [profile.townCity, profile.province].filter(Boolean).join(', '),
  };
}

export async function ensureMiddlemanShowroomSchema(): Promise<void> {
  if (showroomSchemaEnsured) return;
  await ensureAccountProfileColumns();
  const db = getDb();
  await db.query(`
    create table if not exists middleman_showrooms (
      user_id text primary key,
      slug text not null unique,
      bio text not null default '',
      is_public boolean not null default true,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    )
  `);
  await db.query(`
    create unique index if not exists idx_middleman_showrooms_slug
      on middleman_showrooms(slug)
  `);
  showroomSchemaEnsured = true;
}

function assertDealerProfile(profile: AccountProfile) {
  if (
    profile.accountType !== 'dealer'
    || profile.accountStatus !== 'active'
  ) {
    throw new Error('DEALER_SHOWROOM_FORBIDDEN');
  }
}

export async function getOrCreateMiddlemanShowroom(profile: AccountProfile): Promise<MiddlemanShowroom> {
  assertDealerProfile(profile);
  await ensureMiddlemanShowroomSchema();
  const db = getDb();
  const existing = await db.query<ShowroomRow>(
    `select user_id, slug, bio, is_public from middleman_showrooms where user_id = $1 limit 1`,
    [profile.userId],
  );
  if (existing.rows[0]) return mapShowroom(existing.rows[0], profile);

  const baseSlug = slugify(showroomName(profile)) || 'machinery-showroom';
  const collision = await db.query<{ user_id: string }>(
    `select user_id from middleman_showrooms where slug = $1 limit 1`,
    [baseSlug],
  );
  const suffix = slugify(profile.userId).slice(-6) || String(Date.now()).slice(-6);
  const slug = collision.rows.length || RESERVED_SLUGS.has(baseSlug)
    ? `${baseSlug.slice(0, 53)}-${suffix}`
    : baseSlug;

  await db.query(
    `
      insert into middleman_showrooms (user_id, slug)
      values ($1, $2)
      on conflict (user_id) do nothing
    `,
    [profile.userId, slug],
  );
  const created = await db.query<ShowroomRow>(
    `select user_id, slug, bio, is_public from middleman_showrooms where user_id = $1 limit 1`,
    [profile.userId],
  );
  if (!created.rows[0]) throw new Error('MIDDLEMAN_SHOWROOM_CREATE_FAILED');
  return mapShowroom(created.rows[0], profile);
}

export async function getPublicMiddlemanShowroomBySlug(slugValue: string): Promise<MiddlemanShowroom | null> {
  await ensureMiddlemanShowroomSchema();
  const slug = slugify(slugValue);
  if (!slug) return null;
  const db = getDb();
  const result = await db.query<ShowroomRow>(
    `
      select user_id, slug, bio, is_public
      from middleman_showrooms
      where slug = $1 and is_public = true
      limit 1
    `,
    [slug],
  );
  const row = result.rows[0];
  if (!row) return null;
  const profile = await getAccountProfile({ id: row.user_id });
  if (
    profile.accountType !== 'dealer'
    || profile.accountStatus !== 'active'
  ) return null;
  return mapShowroom(row, profile);
}

export async function updateMiddlemanShowroom(input: {
  profile: AccountProfile;
  slug: string;
  bio?: string | null;
  isPublic?: boolean;
}): Promise<MiddlemanShowroom> {
  const current = await getOrCreateMiddlemanShowroom(input.profile);
  const slug = slugify(input.slug);
  if (slug.length < 3 || RESERVED_SLUGS.has(slug)) {
    throw new Error('Choose a public link with at least 3 letters or numbers.');
  }
  const bio = asText(input.bio).slice(0, 500);
  const db = getDb();
  try {
    const updated = await db.query<ShowroomRow>(
      `
        update middleman_showrooms
        set slug = $2, bio = $3, is_public = $4, updated_at = now()
        where user_id = $1
        returning user_id, slug, bio, is_public
      `,
      [input.profile.userId, slug, bio, input.isPublic !== false],
    );
    if (!updated.rows[0]) return current;
    return mapShowroom(updated.rows[0], input.profile);
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === '23505') {
      throw new Error('That public showroom link is already in use. Please choose another.');
    }
    throw error;
  }
}

export async function deleteMiddlemanShowroomAndAdverts(profile: AccountProfile): Promise<number> {
  assertDealerProfile(profile);
  await ensureMiddlemanShowroomSchema();
  const db = getDb();
  const client = await db.connect();

  try {
    await client.query('BEGIN');
    const withdrawn = await client.query(
      `
        update asset_register_items
        set marketplace_status = 'draft', updated_at = now()
        where user_id = $1 and coalesce(marketplace_status, 'draft') = 'live'
      `,
      [profile.userId],
    );
    await client.query(`delete from marketplace_listings where user_id = $1`, [profile.userId]);
    await client.query(`delete from middleman_showrooms where user_id = $1`, [profile.userId]);
    await client.query('COMMIT');
    return withdrawn.rowCount ?? 0;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
