import { getDb } from './db';
import {
  sanitizeAdBrandKitInput,
  type AdBrandKit,
  type SaveAdBrandKitInput,
} from './ad-studio';

type AdBrandKitRow = {
  id: string;
  user_id: string;
  name: string;
  template_id: string;
  logo_url: string | null;
  primary_color: string;
  secondary_color: string;
  accent_color: string;
  business_name: string | null;
  contact_name: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  language: string;
  vat_label: string;
  is_default: boolean;
  created_at: string;
  updated_at: string;
};

let adStudioSchemaEnsured = false;

export async function ensureAdStudioSchema(): Promise<void> {
  if (adStudioSchemaEnsured) return;
  const db = getDb();

  await db.query(`
    create table if not exists ad_brand_kits (
      id uuid primary key default gen_random_uuid(),
      user_id text not null,
      name text not null,
      template_id text not null default 'showcase',
      logo_url text,
      primary_color text not null default '#165340',
      secondary_color text not null default '#0D3329',
      accent_color text not null default '#F2B84B',
      business_name text,
      contact_name text,
      phone text,
      email text,
      website text,
      language text not null default 'en',
      vat_label text not null default 'plus-vat',
      is_default boolean not null default false,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );

    create index if not exists idx_ad_brand_kits_user_updated
      on ad_brand_kits(user_id, updated_at desc);

    create unique index if not exists idx_ad_brand_kits_one_default
      on ad_brand_kits(user_id)
      where is_default;

    alter table asset_register_items
      add column if not exists marketplace_ad_brand jsonb;
  `);

  adStudioSchemaEnsured = true;
}

function mapAdBrandKit(row: AdBrandKitRow): AdBrandKit {
  const clean = sanitizeAdBrandKitInput({
    name: row.name,
    templateId: row.template_id,
    logoUrl: row.logo_url,
    primaryColor: row.primary_color,
    secondaryColor: row.secondary_color,
    accentColor: row.accent_color,
    businessName: row.business_name,
    contactName: row.contact_name,
    phone: row.phone,
    email: row.email,
    website: row.website,
    language: row.language,
    vatLabel: row.vat_label,
  });

  return {
    id: row.id,
    ...clean,
    isDefault: Boolean(row.is_default),
    createdAtIso: row.created_at,
    updatedAtIso: row.updated_at,
  };
}

export async function listAdBrandKits(userId: string): Promise<AdBrandKit[]> {
  await ensureAdStudioSchema();
  const result = await getDb().query<AdBrandKitRow>(
    `
      select *
      from ad_brand_kits
      where user_id = $1
      order by is_default desc, updated_at desc, name asc
    `,
    [userId],
  );
  return result.rows.map(mapAdBrandKit);
}

export async function getAdBrandKitForUser(
  userId: string,
  brandKitId?: string | null,
): Promise<AdBrandKit | null> {
  await ensureAdStudioSchema();
  const requestedId = String(brandKitId ?? '').trim();
  const result = await getDb().query<AdBrandKitRow>(
    requestedId
      ? `select * from ad_brand_kits where user_id = $1 and id = $2::uuid limit 1`
      : `select * from ad_brand_kits where user_id = $1 order by is_default desc, updated_at desc limit 1`,
    requestedId ? [userId, requestedId] : [userId],
  );
  return result.rows[0] ? mapAdBrandKit(result.rows[0]) : null;
}

export async function saveAdBrandKit(
  userId: string,
  input: SaveAdBrandKitInput,
): Promise<AdBrandKit> {
  await ensureAdStudioSchema();
  const kit = sanitizeAdBrandKitInput(input);
  const requestedId = String(input.id ?? '').trim();
  const client = await getDb().connect();

  try {
    await client.query('begin');
    await client.query(`select pg_advisory_xact_lock(hashtext($1))`, [`aim4price:ad-brand-kits:${userId}`]);
    const existingDefault = await client.query<{ exists: boolean }>(
      `select exists(select 1 from ad_brand_kits where user_id = $1 and is_default) as exists`,
      [userId],
    );
    const makeDefault = input.isDefault === true || !existingDefault.rows[0]?.exists;

    if (makeDefault) {
      await client.query(`update ad_brand_kits set is_default = false where user_id = $1`, [userId]);
    }

    const values = [
      userId,
      kit.name,
      kit.templateId,
      kit.logoUrl || null,
      kit.primaryColor,
      kit.secondaryColor,
      kit.accentColor,
      kit.businessName || null,
      kit.contactName || null,
      kit.phone || null,
      kit.email || null,
      kit.website || null,
      kit.language,
      kit.vatLabel,
      makeDefault,
    ];
    const result = requestedId
      ? await client.query<AdBrandKitRow>(
          `
            update ad_brand_kits
            set name = $2, template_id = $3, logo_url = $4, primary_color = $5,
                secondary_color = $6, accent_color = $7, business_name = $8,
                contact_name = $9, phone = $10, email = $11, website = $12,
                language = $13, vat_label = $14,
                is_default = case when $15::boolean then true else is_default end,
                updated_at = now()
            where user_id = $1 and id = $16::uuid
            returning *
          `,
          [...values, requestedId],
        )
      : await client.query<AdBrandKitRow>(
          `
            insert into ad_brand_kits (
              user_id, name, template_id, logo_url, primary_color, secondary_color,
              accent_color, business_name, contact_name, phone, email, website,
              language, vat_label, is_default
            ) values (
              $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15
            )
            returning *
          `,
          values,
        );

    if (!result.rows[0]) throw new Error('Brand Kit could not be saved.');
    await client.query('commit');
    return mapAdBrandKit(result.rows[0]);
  } catch (error) {
    await client.query('rollback');
    throw error;
  } finally {
    client.release();
  }
}

export async function deleteAdBrandKit(userId: string, brandKitId: string): Promise<void> {
  await ensureAdStudioSchema();
  const client = await getDb().connect();

  try {
    await client.query('begin');
    await client.query(`select pg_advisory_xact_lock(hashtext($1))`, [`aim4price:ad-brand-kits:${userId}`]);
    const deleted = await client.query<{ is_default: boolean }>(
      `delete from ad_brand_kits where user_id = $1 and id = $2::uuid returning is_default`,
      [userId, brandKitId],
    );

    if (deleted.rows[0]?.is_default) {
      await client.query(`
        update ad_brand_kits
        set is_default = true, updated_at = now()
        where id = (
          select id from ad_brand_kits where user_id = $1 order by updated_at desc limit 1
        )
      `, [userId]);
    }

    await client.query('commit');
  } catch (error) {
    await client.query('rollback');
    throw error;
  } finally {
    client.release();
  }
}
