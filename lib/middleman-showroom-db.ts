import { ensureAccountProfileColumns, getAccountProfile, type AccountProfile } from './account-profile';
import { normalizeAdLogoUrl } from './ad-studio';
import { getAdBrandKitForUser } from './ad-studio-db';
import { getDb } from './db';

type MiddlemanShowroomDetails = {
  userId: string;
  slug: string;
  bio: string;
  isPublic: boolean;
  name: string;
  websiteUrl: string;
  phone: string;
  email: string;
  location: string;
};

export type MiddlemanShowroom = MiddlemanShowroomDetails & {
  showroomLogoUrl: string;
  inheritedLogoUrl: string;
};

export type PublicMiddlemanShowroomData = MiddlemanShowroomDetails & {
  logoUrl: string;
};

type ShowroomRow = {
  user_id: string;
  slug: string;
  bio: string | null;
  is_public: boolean | null;
  logo_url: string | null;
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
const MAX_SHOWROOM_LOGO_BYTES = 2_000_000;
const MAX_SHOWROOM_LOGO_DIMENSION = 4_096;
const SHOWROOM_LOGO_DATA_PATTERN = /^data:image\/(png|jpe?g|webp);base64,([a-z0-9+/=]+)$/i;
const JPEG_START_OF_FRAME_MARKERS = new Set([
  0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7,
  0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf,
]);

function asText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function pngDimensions(bytes: Buffer): { width: number; height: number } | null {
  const signature = '89504e470d0a1a0a';
  if (bytes.length < 24 || bytes.subarray(0, 8).toString('hex') !== signature) return null;
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
}

function jpegDimensions(bytes: Buffer): { width: number; height: number } | null {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return null;
  let offset = 2;

  while (offset + 3 < bytes.length) {
    if (bytes[offset] !== 0xff) {
      offset += 1;
      continue;
    }
    while (bytes[offset] === 0xff) offset += 1;
    const marker = bytes[offset];
    offset += 1;
    if (marker === 0xd9 || marker === 0xda) break;
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue;
    if (offset + 1 >= bytes.length) return null;
    const segmentLength = bytes.readUInt16BE(offset);
    if (segmentLength < 2 || offset + segmentLength > bytes.length) return null;
    if (JPEG_START_OF_FRAME_MARKERS.has(marker)) {
      if (segmentLength < 7) return null;
      return {
        height: bytes.readUInt16BE(offset + 3),
        width: bytes.readUInt16BE(offset + 5),
      };
    }
    offset += segmentLength;
  }

  return null;
}

function webpDimensions(bytes: Buffer): { width: number; height: number } | null {
  if (
    bytes.length < 30
    || bytes.toString('ascii', 0, 4) !== 'RIFF'
    || bytes.toString('ascii', 8, 12) !== 'WEBP'
  ) return null;

  let offset = 12;
  while (offset + 8 <= bytes.length) {
    const chunkType = bytes.toString('ascii', offset, offset + 4);
    const chunkSize = bytes.readUInt32LE(offset + 4);
    const dataOffset = offset + 8;
    if (dataOffset + chunkSize > bytes.length) return null;

    if (chunkType === 'VP8X' && chunkSize >= 10) {
      return {
        width: bytes.readUIntLE(dataOffset + 4, 3) + 1,
        height: bytes.readUIntLE(dataOffset + 7, 3) + 1,
      };
    }
    if (
      chunkType === 'VP8 '
      && chunkSize >= 10
      && bytes[dataOffset + 3] === 0x9d
      && bytes[dataOffset + 4] === 0x01
      && bytes[dataOffset + 5] === 0x2a
    ) {
      return {
        width: bytes.readUInt16LE(dataOffset + 6) & 0x3fff,
        height: bytes.readUInt16LE(dataOffset + 8) & 0x3fff,
      };
    }
    if (chunkType === 'VP8L' && chunkSize >= 5 && bytes[dataOffset] === 0x2f) {
      const packed = bytes.readUInt32LE(dataOffset + 1);
      return {
        width: (packed & 0x3fff) + 1,
        height: ((packed >>> 14) & 0x3fff) + 1,
      };
    }

    offset = dataOffset + chunkSize + (chunkSize % 2);
  }

  return null;
}

function validateShowroomLogoUrl(value: string): string {
  if (!value) return '';
  if (value.length > 3_000_000) throw new Error('Keep the showroom logo below 2 MB.');
  const logoUrl = normalizeAdLogoUrl(value);
  const match = SHOWROOM_LOGO_DATA_PATTERN.exec(logoUrl);
  if (!match) throw new Error('Choose a valid PNG, JPEG or WebP logo.');

  const payload = match[2];
  const bytes = Buffer.from(payload, 'base64');
  const canonicalPayload = bytes.toString('base64').replace(/=+$/, '');
  if (!bytes.length || canonicalPayload !== payload.replace(/=+$/, '')) {
    throw new Error('Choose a valid PNG, JPEG or WebP logo.');
  }
  if (bytes.length > MAX_SHOWROOM_LOGO_BYTES) {
    throw new Error('Keep the showroom logo below 2 MB.');
  }

  const mediaType = match[1].toLowerCase();
  const dimensions = mediaType === 'png'
    ? pngDimensions(bytes)
    : mediaType === 'webp'
      ? webpDimensions(bytes)
      : jpegDimensions(bytes);
  if (!dimensions || dimensions.width < 1 || dimensions.height < 1) {
    throw new Error('Choose a valid PNG, JPEG or WebP logo.');
  }
  if (
    dimensions.width > MAX_SHOWROOM_LOGO_DIMENSION
    || dimensions.height > MAX_SHOWROOM_LOGO_DIMENSION
    || dimensions.width * dimensions.height > MAX_SHOWROOM_LOGO_DIMENSION ** 2
  ) {
    throw new Error('Keep the showroom logo dimensions below 4096 × 4096 pixels.');
  }

  return logoUrl;
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

function mapShowroomDetails(row: ShowroomRow, profile: AccountProfile): MiddlemanShowroomDetails {
  return {
    userId: row.user_id,
    slug: row.slug,
    bio: asText(row.bio),
    isPublic: row.is_public !== false,
    name: showroomName(profile),
    websiteUrl: profile.websiteUrl,
    phone: profile.marketplacePhone || profile.phone,
    email: profile.marketplaceEmail || profile.email,
    location: profile.marketplaceLocation || [profile.townCity, profile.province].filter(Boolean).join(', '),
  };
}

async function resolveShowroomLogos(row: ShowroomRow, profile: AccountProfile): Promise<{
  showroomLogoUrl: string;
  inheritedLogoUrl: string;
}> {
  const brandKit = await getAdBrandKitForUser(profile.userId);
  return {
    showroomLogoUrl: normalizeAdLogoUrl(row.logo_url),
    inheritedLogoUrl: normalizeAdLogoUrl(brandKit?.logoUrl) || normalizeAdLogoUrl(profile.logoUrl),
  };
}

async function mapShowroom(row: ShowroomRow, profile: AccountProfile): Promise<MiddlemanShowroom> {
  return {
    ...mapShowroomDetails(row, profile),
    ...await resolveShowroomLogos(row, profile),
  };
}

async function mapPublicShowroom(
  row: ShowroomRow,
  profile: AccountProfile,
): Promise<PublicMiddlemanShowroomData> {
  const { showroomLogoUrl, inheritedLogoUrl } = await resolveShowroomLogos(row, profile);
  return {
    ...mapShowroomDetails(row, profile),
    logoUrl: showroomLogoUrl || inheritedLogoUrl,
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
      logo_url text,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    )
  `);
  await db.query(`
    alter table middleman_showrooms
      add column if not exists logo_url text
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
    `select user_id, slug, bio, is_public, logo_url from middleman_showrooms where user_id = $1 limit 1`,
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
    `select user_id, slug, bio, is_public, logo_url from middleman_showrooms where user_id = $1 limit 1`,
    [profile.userId],
  );
  if (!created.rows[0]) throw new Error('MIDDLEMAN_SHOWROOM_CREATE_FAILED');
  return mapShowroom(created.rows[0], profile);
}

export async function getPublicMiddlemanShowroomBySlug(slugValue: string): Promise<PublicMiddlemanShowroomData | null> {
  await ensureMiddlemanShowroomSchema();
  const slug = slugify(slugValue);
  if (!slug) return null;
  const db = getDb();
  const result = await db.query<ShowroomRow>(
    `
      select user_id, slug, bio, is_public, logo_url
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
  return mapPublicShowroom(row, profile);
}

export async function updateMiddlemanShowroom(input: {
  profile: AccountProfile;
  slug: string;
  bio?: string | null;
  isPublic?: boolean;
  logoUrl?: string | null;
}): Promise<MiddlemanShowroom> {
  const current = await getOrCreateMiddlemanShowroom(input.profile);
  const slug = slugify(input.slug);
  if (slug.length < 3 || RESERVED_SLUGS.has(slug)) {
    throw new Error('Choose a public link with at least 3 letters or numbers.');
  }
  const bio = asText(input.bio).slice(0, 500);
  const requestedLogoUrl = typeof input.logoUrl === 'string'
    ? input.logoUrl.trim()
    : input.logoUrl === null
      ? ''
      : current.showroomLogoUrl;
  const logoUrl = validateShowroomLogoUrl(requestedLogoUrl);
  const db = getDb();
  try {
    const updated = await db.query<ShowroomRow>(
      `
        update middleman_showrooms
        set slug = $2, bio = $3, is_public = $4, logo_url = $5, updated_at = now()
        where user_id = $1
        returning user_id, slug, bio, is_public, logo_url
      `,
      [input.profile.userId, slug, bio, input.isPublic !== false, logoUrl || null],
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
