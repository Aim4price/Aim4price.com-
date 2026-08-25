import { getDb } from './db';
import { isDatabaseSchemaReady } from './database-schema-readiness';

export type AssetRegisterSummary = {
  id: string;
  userId: string;
  businessName: string;
  email: string;
  phone: string;
  addressLine1: string;
  logoUrls: string[];
  showLogosOnRegister: boolean;
  isPrimary: boolean;
  isSelected: boolean;
  assetCount: number;
  totalValue: number;
  totalReplacementPrice: number;
  unnotedAlertCount: number;
  createdAtIso: string;
  updatedAtIso: string;
};

export type AssetRegisterInput = {
  businessName?: string | null;
  email?: string | null;
  phone?: string | null;
  addressLine1?: string | null;
  address?: string | null;
  logoUrls?: string[] | null;
  showLogosOnRegister?: boolean | null;
};

export type DeleteAssetRegisterResult = {
  deletedRegisterId: string;
  movedCount: number;
  selectedRegister: AssetRegisterSummary;
};

type AssetRegisterRow = {
  id: string;
  user_id: string;
  business_name: string | null;
  email: string | null;
  phone: string | null;
  address_line_1: string | null;
  logo_urls: unknown;
  show_logos_on_register: boolean | null;
  is_primary: boolean | null;
  is_selected: boolean | null;
  created_at: string | Date | null;
  updated_at: string | Date | null;
  asset_count?: string | number | null;
  total_value?: string | number | null;
  total_replacement_price?: string | number | null;
  unnoted_alert_count?: string | number | null;
};

type AccountProfileRow = {
  user_id: string;
  display_name: string | null;
  business_name: string | null;
  phone: string | null;
  email?: string | null;
  logo_url?: string | null;
  address_line_1: string | null;
  address_line_2: string | null;
  town_city: string | null;
  province: string | null;
};

type RegisterIdRow = {
  id: string;
};

type CountRow = {
  count: string | number | null;
};

type ColumnNameRow = {
  column_name: string;
};

let assetRegisterTablesPromise: Promise<void> | null = null;
let assetRegisterItemColumnsPromise: Promise<Set<string>> | null = null;

const MAX_ASSET_REGISTER_LOGOS = 1;
const MAX_ASSET_REGISTER_LOGO_URL_LENGTH = 8_000_000;

function cleanText(value: unknown): string {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function normalizeEmail(value: unknown): string {
  return cleanText(value).toLowerCase();
}

function normalizeRegisterName(value: unknown): string {
  return cleanText(value).slice(0, 160);
}

function normalizePhone(value: unknown): string {
  return cleanText(value).slice(0, 80);
}

function normalizeAddress(value: unknown): string {
  return cleanText(value).slice(0, 300);
}

function normalizeLogoUrls(value: unknown): string[] {
  let values: unknown[] = [];

  if (Array.isArray(value)) {
    values = value;
  } else if (typeof value === 'string' && value.trim()) {
    const trimmed = value.trim();

    try {
      const parsed = JSON.parse(trimmed) as unknown;
      values = Array.isArray(parsed) ? parsed : [trimmed];
    } catch {
      values = trimmed.split(/[\n,]+/);
    }
  }

  const seen = new Set<string>();
  const logoUrls: string[] = [];

  for (const entry of values) {
    const logoUrl = cleanText(entry).slice(0, MAX_ASSET_REGISTER_LOGO_URL_LENGTH);
    const lowerUrl = logoUrl.toLowerCase();

    if (!logoUrl || seen.has(logoUrl)) {
      continue;
    }

    if (
      !lowerUrl.startsWith('data:image/') &&
      !lowerUrl.startsWith('https://') &&
      !lowerUrl.startsWith('http://') &&
      !lowerUrl.startsWith('/api/asset-register/uploads/')
    ) {
      continue;
    }

    seen.add(logoUrl);
    logoUrls.push(logoUrl);

    if (logoUrls.length >= MAX_ASSET_REGISTER_LOGOS) {
      break;
    }
  }

  return logoUrls;
}

function normalizeLogoVisibility(value: unknown, fallback = true): boolean {
  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'number') {
    return value !== 0;
  }

  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();

    if (['false', '0', 'no', 'off', 'hide', 'hidden'].includes(normalized)) {
      return false;
    }

    if (['true', '1', 'yes', 'on', 'show', 'visible'].includes(normalized)) {
      return true;
    }
  }

  return fallback;
}

function numberValue(value: unknown): number {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
}

function isoDate(value: unknown): string {
  if (value instanceof Date && Number.isFinite(value.getTime())) {
    return value.toISOString();
  }

  if (typeof value === 'string' && value.trim()) {
    return value;
  }

  return new Date().toISOString();
}

function mapAssetRegisterRow(row: AssetRegisterRow): AssetRegisterSummary {
  return {
    id: String(row.id ?? ''),
    userId: String(row.user_id ?? ''),
    businessName: cleanText(row.business_name) || 'Main Asset Register',
    email: cleanText(row.email),
    phone: cleanText(row.phone),
    addressLine1: cleanText(row.address_line_1),
    logoUrls: normalizeLogoUrls(row.logo_urls),
    showLogosOnRegister: normalizeLogoVisibility(row.show_logos_on_register, true),
    isPrimary: Boolean(row.is_primary),
    isSelected: Boolean(row.is_selected),
    assetCount: Math.max(0, Math.round(numberValue(row.asset_count))),
    totalValue: Math.round(numberValue(row.total_value)),
    totalReplacementPrice: Math.round(numberValue(row.total_replacement_price)),
    unnotedAlertCount: Math.max(0, Math.round(numberValue(row.unnoted_alert_count))),
    createdAtIso: isoDate(row.created_at),
    updatedAtIso: isoDate(row.updated_at ?? row.created_at),
  };
}

async function readAssetRegisterItemColumns(): Promise<Set<string>> {
  const db = getDb();

  const result = await db.query<ColumnNameRow>(
    `
      select column_name
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'asset_register_items'
    `,
  );

  return new Set(result.rows.map((row) => row.column_name));
}

async function getAssetRegisterItemColumns(): Promise<Set<string>> {
  if (!assetRegisterItemColumnsPromise) {
    assetRegisterItemColumnsPromise = readAssetRegisterItemColumns().catch((error) => {
      assetRegisterItemColumnsPromise = null;
      throw error;
    });
  }

  return assetRegisterItemColumnsPromise;
}

function numericColumnExpression(alias: string, columns: Set<string>, candidates: string[]): string {
  const availableColumns = candidates
    .filter((column) => columns.has(column))
    .map((column) => `${alias}.${column}`);

  if (!availableColumns.length) {
    return '0';
  }

  return `coalesce(${availableColumns.join(', ')}, 0)`;
}

async function buildAssetRegisterTotalsSql(): Promise<{
  totalValueSql: string;
  totalReplacementPriceSql: string;
}> {
  const columns = await getAssetRegisterItemColumns();
  const currentValueExpression = numericColumnExpression('ai', columns, [
    'selected_value_ex_vat',
    'value',
    'selected_value',
    'saved_value_ex_vat',
  ]);
  const replacementPriceExpression = numericColumnExpression('ai', columns, [
    'replacement_price_used_ex_vat',
    'user_replacement_price_ex_vat',
    'replacement_price_ex_vat',
    'official_replacement_price_ex_vat',
  ]);
  const countsTowardRegisterValueExpression = `
    not exists (
      select 1
      from public.asset_group_members group_member
      where group_member.asset_id = ai.id
        and not group_member.counts_toward_total
    )
  `;

  return {
    totalValueSql: `coalesce(sum(case when ${countsTowardRegisterValueExpression} then ${currentValueExpression} else 0 end), 0)::numeric as total_value`,
    totalReplacementPriceSql: `coalesce(sum(${replacementPriceExpression}), 0)::numeric as total_replacement_price`,
  };
}


type AssetRegisterOpenAlertCountRow = {
  register_id: string | null;
  alert_count: string | number | null;
};

type TableExistsRow = {
  table_name: string | null;
};

async function publicTableExists(tableName: string): Promise<boolean> {
  const db = getDb();
  const result = await db.query<TableExistsRow>(
    `select to_regclass($1)::text as table_name`,
    [`public.${tableName}`],
  );

  return Boolean(result.rows[0]?.table_name);
}

async function attachAssetRegisterOpenAlertCounts(
  userId: string,
  registers: AssetRegisterSummary[],
): Promise<AssetRegisterSummary[]> {
  if (!registers.length) {
    return registers;
  }

  const registerIds = registers.map((register) => String(register.id ?? '').trim()).filter(Boolean);

  if (!registerIds.length) {
    return registers.map((register) => ({ ...register, unnotedAlertCount: 0 }));
  }

  try {
    const hasPartnerNotes = await publicTableExists('asset_partner_notes');
    const hasScanEvents = await publicTableExists('asset_scan_events');
    const hasDealerAssetCorrections = await publicTableExists('dealer_asset_correction_requests');
    const alertSources: string[] = [
      `
        select
          register_id,
          count(*)::integer as alert_count
        from register_assets
        where valuation_run_id is not null
          and coalesce(selected_method, '') <> 'manual'
          and lower(coalesce(
            nullif(specs_json ->> 'valuationNeedsUpdate', ''),
            nullif(specs_json ->> 'valuation_needs_update', ''),
            ''
          )) in ('true', '1', 'yes', 'on')
        group by register_id
      `,
    ];

    alertSources.push(`
      select
        pending_license.register_id,
        count(*)::integer as alert_count
      from (
        select
          license_candidate.*,
          lower(regexp_replace(license_candidate.license_status_text, '[[:space:]-]+', '_', 'g')) as normalized_license_status,
          case
            when license_candidate.renewal_date_text ~ '^[1-9][0-9]{3}-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$'
              then to_date(license_candidate.renewal_date_text, 'YYYY-MM-DD')
            else null
          end as renewal_date
        from (
          select
            register_id,
            kind,
            is_licensed,
            license_renewal_alert_noted_for_date,
            coalesce(
              nullif(trim(specs_json ->> 'licenseRenewalDate'), ''),
              nullif(trim(specs_json ->> 'license_renewal_date'), ''),
              nullif(trim(specs_json ->> 'licenceRenewalDate'), ''),
              nullif(trim(specs_json ->> 'licence_renewal_date'), ''),
              ''
            ) as renewal_date_text,
            coalesce(
              nullif(trim(specs_json ->> 'licenseStatus'), ''),
              nullif(trim(specs_json ->> 'license_status'), ''),
              nullif(trim(specs_json ->> 'licensedStatus'), ''),
              nullif(trim(specs_json ->> 'licensed_status'), ''),
              nullif(trim(specs_json ->> 'licenceStatus'), ''),
              nullif(trim(specs_json ->> 'licence_status'), ''),
              nullif(trim(specs_json ->> 'licencedStatus'), ''),
              nullif(trim(specs_json ->> 'licenced_status'), ''),
              ''
            ) as license_status_text
          from register_assets
        ) license_candidate
      ) pending_license
      where case
          when pending_license.normalized_license_status in ('yes', 'y', 'true', 'licensed', 'licenced', 'is_licensed') then true
          when pending_license.normalized_license_status in (
            'no', 'n', 'false', 'not_licensed', 'not_licenced', 'unlicensed', 'unlicenced',
            'na', 'n_a', 'not_applicable', 'does_not_apply', 'unknown', 'not_sure', 'unsure'
          ) then false
          else pending_license.is_licensed = true
        end
        and lower(trim(coalesce(pending_license.kind, ''))) <> 'property'
        and pending_license.renewal_date is not null
        and to_char(pending_license.renewal_date, 'YYYY-MM-DD') = pending_license.renewal_date_text
        and (current_timestamp at time zone 'Africa/Johannesburg')::date >=
          (pending_license.renewal_date - interval '1 month')::date
        and pending_license.license_renewal_alert_noted_for_date is distinct from pending_license.renewal_date
      group by pending_license.register_id
    `);

    if (hasPartnerNotes) {
      alertSources.push(`
        select
          a.register_id,
          count(distinct n.asset_register_item_id)::integer as alert_count
        from register_assets a
        inner join public.asset_partner_notes n
          on n.asset_register_item_id::text = a.asset_id
        where n.owner_user_id = $1
          and lower(coalesce(n.status, 'open')) = 'open'
        group by a.register_id
      `);
    }

    if (hasDealerAssetCorrections) {
      alertSources.push(`
        select
          a.register_id,
          count(distinct correction.asset_register_item_id)::integer as alert_count
        from register_assets a
        inner join public.dealer_asset_correction_requests correction
          on correction.asset_register_item_id::text = a.asset_id
        where correction.owner_user_id = $1
          and correction.status = 'pending'
        group by a.register_id
      `);
    }

    if (hasScanEvents) {
      alertSources.push(`
        select
          latest_maintenance.register_id,
          count(*)::integer as alert_count
        from (
          select distinct on (e.asset_id::text)
            a.register_id,
            nullif(coalesce(to_jsonb(e)->>'maintenance_noted_at', ''), '') as maintenance_noted_at
          from register_assets a
          inner join public.asset_scan_events e
            on e.asset_id::text = a.asset_id
          where nullif(trim(coalesce(e.note, '')), '') is not null
            and (
              lower(coalesce(e.note, '')) like 'checked%'
              or lower(coalesce(e.note, '')) like 'serviced%'
              or lower(coalesce(e.note, '')) like 'repaired%'
              or lower(coalesce(e.note, '')) like '%checked items:%'
              or lower(coalesce(e.note, '')) like '%work done:%'
              or lower(coalesce(e.note, '')) like '%service items:%'
              or lower(coalesce(e.note, '')) like '%serviced items:%'
              or lower(coalesce(e.note, '')) like '%repair details:%'
            )
          order by e.asset_id::text, e.created_at desc, e.id desc
        ) latest_maintenance
        where latest_maintenance.maintenance_noted_at is null
        group by latest_maintenance.register_id
      `);

      alertSources.push(`
        select
          a.register_id,
          count(distinct e.asset_id)::integer as alert_count
        from register_assets a
        inner join public.asset_scan_events e
          on e.asset_id::text = a.asset_id
        where nullif(trim(coalesce(e.note, '')), '') is not null
          and lower(coalesce(e.note, '')) like '%notes%problems:%'
          and nullif(coalesce(to_jsonb(e)->>'issue_noted_at', ''), '') is null
        group by a.register_id
      `);
    }

    const result = await getDb().query<AssetRegisterOpenAlertCountRow>(
      `
        with register_assets as (
          select
            ai.id::text as asset_id,
            ai.register_id::text as register_id,
            coalesce(ai.specs_json, '{}'::jsonb) as specs_json,
            ai.kind,
            ai.is_licensed,
            ai.license_renewal_alert_noted_for_date,
            ai.valuation_run_id,
            ai.selected_method
          from public.asset_register_items ai
          where ai.user_id = $1
            and ai.register_id::text = any($2::text[])
            and coalesce(ai.lifecycle_state, 'active') = 'active'
        ), alert_counts as (
          ${alertSources.join('\n          union all\n')}
        )
        select
          register_id,
          coalesce(sum(alert_count), 0)::integer as alert_count
        from alert_counts
        group by register_id
      `,
      [userId, registerIds],
    );

    const countByRegisterId = new Map(
      result.rows.map((row) => [String(row.register_id ?? ''), Math.max(0, Math.round(numberValue(row.alert_count)))])
    );

    return registers.map((register) => ({
      ...register,
      unnotedAlertCount: countByRegisterId.get(register.id) ?? 0,
    }));
  } catch (error) {
    console.error('Failed to load asset register open alert counts', error);
    return registers.map((register) => ({ ...register, unnotedAlertCount: 0 }));
  }
}

async function ensureAssetRegisterTablesOnce(): Promise<void> {
  const db = getDb();

  const schemaReady = await isDatabaseSchemaReady(() => db.query(`
    with register_schema as (
      select id, user_id, business_name, email, phone, address_line_1,
             logo_urls, show_logos_on_register, is_primary, is_selected,
             created_at, updated_at
      from public.asset_registers
      where false
    ), item_schema as (
      select id, user_id, register_id, lifecycle_state,
             license_renewal_alert_noted_for_date,
             license_renewal_alert_noted_at
      from public.asset_register_items
      where false
    ), group_schema as (
      select id, user_id, register_id, name, value_mode, created_at, updated_at
      from public.asset_groups
      where false
    ), member_schema as (
      select group_id, asset_id, role, relationship, counts_toward_total,
             sort_order, created_at
      from public.asset_group_members
      where false
    )
    select 1
    from register_schema
    cross join item_schema
    cross join group_schema
    cross join member_schema
  `));

  if (schemaReady) {
    return;
  }

  await db.query(`create extension if not exists pgcrypto`);

  await db.query(`
    create table if not exists public.asset_registers (
      id uuid primary key default gen_random_uuid(),
      user_id text not null,
      business_name text not null,
      email text,
      phone text,
      address_line_1 text,
      logo_urls jsonb not null default '[]'::jsonb,
      show_logos_on_register boolean not null default true,
      is_primary boolean not null default false,
      is_selected boolean not null default false,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    )
  `);

  await db.query(`
    alter table public.asset_registers
      add column if not exists user_id text,
      add column if not exists business_name text,
      add column if not exists email text,
      add column if not exists phone text,
      add column if not exists address_line_1 text,
      add column if not exists logo_urls jsonb not null default '[]'::jsonb,
      add column if not exists show_logos_on_register boolean not null default true,
      add column if not exists is_primary boolean not null default false,
      add column if not exists is_selected boolean not null default false,
      add column if not exists created_at timestamptz not null default now(),
      add column if not exists updated_at timestamptz not null default now()
  `);

  await db.query(`
    alter table if exists public.asset_register_items
      add column if not exists register_id uuid,
      add column if not exists lifecycle_state text not null default 'active',
      add column if not exists license_renewal_alert_noted_for_date date,
      add column if not exists license_renewal_alert_noted_at timestamptz
  `);

  await db.query(`
    create table if not exists public.asset_groups (
      id uuid primary key default gen_random_uuid(),
      user_id text not null,
      register_id uuid references public.asset_registers(id) on delete cascade,
      name text not null,
      value_mode text not null default 'separate'
        check (value_mode in ('separate', 'included_in_primary')),
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    )
  `);

  await db.query(`
    alter table if exists public.asset_groups
      alter column register_id drop not null
  `);

  await db.query(`
    create table if not exists public.asset_group_members (
      group_id uuid not null references public.asset_groups(id) on delete cascade,
      asset_id uuid not null references public.asset_register_items(id) on delete cascade,
      role text not null default 'member'
        check (role in ('primary', 'linked', 'member')),
      relationship text not null default 'grouped'
        check (relationship in ('primary', 'grouped', 'works_with', 'located_at', 'component_of', 'attached_to', 'other')),
      counts_toward_total boolean not null default true,
      sort_order integer not null default 0,
      created_at timestamptz not null default now(),
      primary key (group_id, asset_id),
      unique (asset_id)
    )
  `);

  await db.query(`
    alter table if exists public.asset_group_members
      add column if not exists counts_toward_total boolean
  `);

  await db.query(`
    do $$
    declare
      role_constraint_definition text;
      relationship_constraint_definition text;
    begin
      if to_regclass('public.asset_group_members') is not null then
        select pg_get_constraintdef(oid)
        into role_constraint_definition
        from pg_constraint
        where conrelid = 'public.asset_group_members'::regclass
          and conname = 'asset_group_members_role_check'
        limit 1;

        if role_constraint_definition is null
          or position('member' in lower(role_constraint_definition)) = 0 then
          alter table public.asset_group_members
            drop constraint if exists asset_group_members_role_check;
          alter table public.asset_group_members
            add constraint asset_group_members_role_check
              check (role in ('primary', 'linked', 'member'));
        end if;

        select pg_get_constraintdef(oid)
        into relationship_constraint_definition
        from pg_constraint
        where conrelid = 'public.asset_group_members'::regclass
          and conname = 'asset_group_members_relationship_check'
        limit 1;

        if relationship_constraint_definition is null
          or position('grouped' in lower(relationship_constraint_definition)) = 0 then
          alter table public.asset_group_members
            drop constraint if exists asset_group_members_relationship_check;
          alter table public.asset_group_members
            add constraint asset_group_members_relationship_check
              check (relationship in ('primary', 'grouped', 'works_with', 'located_at', 'component_of', 'attached_to', 'other'));
        end if;
      end if;
    end
    $$
  `);

  await db.query(`
    update public.asset_group_members member
    set counts_toward_total = case
          when asset_group.value_mode = 'included_in_primary' then member.role = 'primary'
          else true
        end,
        role = case
          when asset_group.value_mode = 'included_in_primary' then member.role
          else 'member'
        end,
        relationship = case
          when asset_group.value_mode = 'included_in_primary' then member.relationship
          else 'grouped'
        end
    from public.asset_groups asset_group
    where asset_group.id = member.group_id
      and member.counts_toward_total is null
  `);

  await db.query(`
    alter table public.asset_group_members
      alter column role set default 'member',
      alter column relationship set default 'grouped',
      alter column counts_toward_total set default true,
      alter column counts_toward_total set not null
  `);

  await db.query(`
    create or replace function public.unlink_asset_group_on_register_change()
    returns trigger
    language plpgsql
    as $$
    begin
      if tg_op = 'DELETE' then
        delete from public.asset_group_members
        where asset_id = old.id;

      elsif new.register_id is distinct from old.register_id then
        delete from public.asset_group_members member
        using public.asset_groups asset_group
        where member.asset_id = old.id
          and asset_group.id = member.group_id
          and asset_group.register_id is not null;
      end if;

      update public.asset_group_members member
      set role = 'member', relationship = 'grouped'
      where member.role = 'linked'
        and not exists (
          select 1
          from public.asset_group_members primary_member
          where primary_member.group_id = member.group_id
            and primary_member.role = 'primary'
        );

      update public.asset_groups asset_group
      set value_mode = case
            when exists (
              select 1 from public.asset_group_members member
              where member.group_id = asset_group.id and member.role = 'primary'
            ) and not exists (
              select 1 from public.asset_group_members member
              where member.group_id = asset_group.id
                and member.role <> 'primary'
                and member.counts_toward_total
            ) then 'included_in_primary'
            else 'separate'
          end;

      delete from public.asset_groups asset_group
      where (
          select count(*)
          from public.asset_group_members member
          where member.group_id = asset_group.id
        ) < 1;

      if tg_op = 'DELETE' then
        return old;
      end if;

      return new;
    end
    $$
  `);

  await db.query(`
    drop trigger if exists trg_unlink_asset_group_on_register_change
      on public.asset_register_items
  `);

  await db.query(`
    create trigger trg_unlink_asset_group_on_register_change
      after update of register_id or delete
      on public.asset_register_items
      for each row
      execute function public.unlink_asset_group_on_register_change()
  `);

  await db.query(`
    do $$
    declare
      kind_constraint_definition text;
    begin
      if to_regclass('public.asset_register_items') is not null then
        select pg_get_constraintdef(oid)
        into kind_constraint_definition
        from pg_constraint
        where conrelid = 'public.asset_register_items'::regclass
          and conname = 'asset_register_items_kind_check'
        limit 1;

        if kind_constraint_definition is null
          or position('stock' in lower(kind_constraint_definition)) = 0 then
          alter table public.asset_register_items
            drop constraint if exists asset_register_items_kind_check;

          alter table public.asset_register_items
            add constraint asset_register_items_kind_check
              check (kind in ('tractor', 'equipment', 'manual', 'property', 'vehicle', 'tools', 'stock'));
        end if;
      end if;
    end
    $$
  `);

  await db.query(`
    update public.asset_registers
    set logo_urls = '[]'::jsonb
    where logo_urls is null
  `);

  await db.query(`
    update public.asset_registers
    set show_logos_on_register = true
    where show_logos_on_register is null
  `);

  await db.query(`
    alter table public.asset_registers
      alter column logo_urls set default '[]'::jsonb,
      alter column logo_urls set not null,
      alter column show_logos_on_register set default true,
      alter column show_logos_on_register set not null
  `);

  assetRegisterItemColumnsPromise = null;

  await db.query(`
    create index if not exists idx_asset_registers_user_created
      on public.asset_registers(user_id, created_at desc)
  `);

  await db.query(`
    create index if not exists idx_asset_registers_user_primary
      on public.asset_registers(user_id, is_primary)
  `);

  await db.query(`
    create index if not exists idx_asset_registers_user_selected
      on public.asset_registers(user_id, is_selected)
  `);

  await db.query(`
    create index if not exists idx_asset_register_items_register
      on public.asset_register_items(user_id, register_id, updated_at desc)
  `).catch(async () => {
    await db.query(`
      create index if not exists idx_asset_register_items_register
        on public.asset_register_items(user_id, register_id)
    `);
  });

  await db.query(`
    create index if not exists idx_asset_groups_user_register
      on public.asset_groups(user_id, register_id, updated_at desc)
  `);

  await db.query(`
    create unique index if not exists idx_asset_group_primary_member
      on public.asset_group_members(group_id)
      where role = 'primary'
  `);

  await db.query(`
    create index if not exists idx_asset_group_members_group_order
      on public.asset_group_members(group_id, sort_order)
  `);
}

export async function ensureAssetRegisterTables(): Promise<void> {
  if (!assetRegisterTablesPromise) {
    assetRegisterTablesPromise = ensureAssetRegisterTablesOnce().catch((error) => {
      assetRegisterTablesPromise = null;
      throw error;
    });
  }

  return assetRegisterTablesPromise;
}

async function readProfileDefaults(userId: string): Promise<{
  businessName: string;
  email: string;
  phone: string;
  addressLine1: string;
  logoUrls: string[];
}> {
  const db = getDb();

  const result = await db.query<AccountProfileRow>(
    `
      select
        user_id,
        display_name,
        business_name,
        phone,
        logo_url,
        address_line_1,
        address_line_2,
        town_city,
        province
      from public.account_profiles
      where user_id = $1
      limit 1
    `,
    [userId],
  ).catch(() => ({ rows: [] as AccountProfileRow[] }));

  const profile = result.rows[0] ?? null;
  const addressLine1 = profile
    ? [profile.address_line_1, profile.address_line_2, profile.town_city, profile.province]
        .map((part) => cleanText(part))
        .filter(Boolean)
        .join(', ')
    : '';

  return {
    businessName: normalizeRegisterName(profile?.business_name) || normalizeRegisterName(profile?.display_name) || 'Main Asset Register',
    email: '',
    phone: normalizePhone(profile?.phone),
    addressLine1,
    logoUrls: normalizeLogoUrls(profile?.logo_url),
  };
}

async function setSinglePrimaryRegister(userId: string, registerId: string): Promise<void> {
  const db = getDb();
  await db.query(
    `
      update public.asset_registers
      set is_primary = (id::text = $2),
          updated_at = case when id::text = $2 then now() else updated_at end
      where user_id = $1
    `,
    [userId, registerId],
  );
}

async function setSingleSelectedRegister(userId: string, registerId: string): Promise<void> {
  const db = getDb();
  await db.query(
    `
      update public.asset_registers
      set is_selected = (id::text = $2),
          updated_at = case when id::text = $2 then now() else updated_at end
      where user_id = $1
    `,
    [userId, registerId],
  );
}

async function normalizeSelectedRegister(userId: string, fallbackRegisterId: string): Promise<string> {
  const db = getDb();
  const selected = await db.query<RegisterIdRow>(
    `
      select id::text as id
      from public.asset_registers
      where user_id = $1 and is_selected = true
      order by updated_at desc nulls last, created_at desc nulls last, id desc
      limit 1
    `,
    [userId],
  );

  const selectedId = cleanText(selected.rows[0]?.id) || fallbackRegisterId;
  await setSingleSelectedRegister(userId, selectedId);
  return selectedId;
}

async function insertAssetRegister(
  userId: string,
  input: Required<Pick<AssetRegisterInput, 'businessName'>> & AssetRegisterInput,
  isPrimary: boolean,
  isSelected = false,
): Promise<AssetRegisterSummary> {
  const db = getDb();
  await ensureAssetRegisterTables();

  const businessName = normalizeRegisterName(input.businessName) || 'Main Asset Register';
  const email = normalizeEmail(input.email);
  const phone = normalizePhone(input.phone);
  const addressLine1 = normalizeAddress(input.addressLine1 ?? input.address);
  const logoUrls = normalizeLogoUrls(input.logoUrls);
  const showLogosOnRegister = normalizeLogoVisibility(input.showLogosOnRegister, true);

  const result = await db.query<AssetRegisterRow>(
    `
      insert into public.asset_registers (
        user_id,
        business_name,
        email,
        phone,
        address_line_1,
        logo_urls,
        show_logos_on_register,
        is_primary,
        is_selected,
        created_at,
        updated_at
      )
      values ($1, $2, $3, $4, $5, $6::jsonb, $7, $8, $9, now(), now())
      returning
        id,
        user_id,
        business_name,
        email,
        phone,
        address_line_1,
        logo_urls,
        show_logos_on_register,
        is_primary,
        is_selected,
        created_at,
        updated_at,
        0::integer as asset_count,
        0::numeric as total_value,
        0::numeric as total_replacement_price
    `,
    [
      userId,
      businessName,
      email,
      phone,
      addressLine1,
      JSON.stringify(logoUrls),
      showLogosOnRegister,
      isPrimary,
      isSelected,
    ],
  );

  return mapAssetRegisterRow(result.rows[0]);
}

export async function getOrCreatePrimaryAssetRegister(userId: string): Promise<AssetRegisterSummary> {
  const db = getDb();
  await ensureAssetRegisterTables();

  const existingPrimary = await db.query<AssetRegisterRow>(
    `
      select
        id,
        user_id,
        business_name,
        email,
        phone,
        address_line_1,
        logo_urls,
        show_logos_on_register,
        is_primary,
        is_selected,
        created_at,
        updated_at,
        0::integer as asset_count,
        0::numeric as total_value,
        0::numeric as total_replacement_price
      from public.asset_registers
      where user_id = $1 and is_primary = true
      order by created_at asc, id asc
      limit 1
    `,
    [userId],
  );

  let primary = existingPrimary.rows[0] ? mapAssetRegisterRow(existingPrimary.rows[0]) : null;

  if (!primary) {
    const existingAny = await db.query<AssetRegisterRow>(
      `
        select
          id,
          user_id,
          business_name,
          email,
          phone,
          address_line_1,
          logo_urls,
          show_logos_on_register,
          is_primary,
          is_selected,
          created_at,
          updated_at,
          0::integer as asset_count,
          0::numeric as total_value,
          0::numeric as total_replacement_price
        from public.asset_registers
        where user_id = $1
        order by created_at asc, id asc
        limit 1
      `,
      [userId],
    );

    if (existingAny.rows[0]) {
      const firstId = String(existingAny.rows[0].id);
      await setSinglePrimaryRegister(userId, firstId);
      primary = { ...mapAssetRegisterRow(existingAny.rows[0]), isPrimary: true };
    }
  }

  if (!primary) {
    const defaults = await readProfileDefaults(userId);
    primary = await insertAssetRegister(
      userId,
      {
        businessName: defaults.businessName,
        email: defaults.email,
        phone: defaults.phone,
        addressLine1: defaults.addressLine1,
        logoUrls: defaults.logoUrls,
        showLogosOnRegister: true,
      },
      true,
      true,
    );
  }

  await db.query(
    `
      update public.asset_register_items
      set register_id = $2::uuid
      where user_id = $1 and register_id is null
    `,
    [userId, primary.id],
  ).catch(() => undefined);

  const selectedId = await normalizeSelectedRegister(userId, primary.id);
  return { ...primary, isSelected: selectedId === primary.id };
}

export async function getAssetRegisterForUser(userId: string, registerId: string): Promise<AssetRegisterSummary | null> {
  const db = getDb();

  await getOrCreatePrimaryAssetRegister(userId);
  const totalsSql = await buildAssetRegisterTotalsSql();

  const result = await db.query<AssetRegisterRow>(
    `
      select
        ar.id,
        ar.user_id,
        ar.business_name,
        ar.email,
        ar.phone,
        ar.address_line_1,
        ar.logo_urls,
        ar.show_logos_on_register,
        ar.is_primary,
        ar.is_selected,
        ar.created_at,
        ar.updated_at,
        count(ai.id)::integer as asset_count,
        ${totalsSql.totalValueSql},
        ${totalsSql.totalReplacementPriceSql}
      from public.asset_registers ar
      left join public.asset_register_items ai
        on ai.user_id = ar.user_id
       and ai.register_id = ar.id
       and coalesce(ai.lifecycle_state, 'active') = 'active'
      where ar.user_id = $1 and ar.id::text = $2
      group by ar.id
      limit 1
    `,
    [userId, registerId],
  );

  return result.rows[0] ? mapAssetRegisterRow(result.rows[0]) : null;
}

export async function getSelectedAssetRegister(userId: string): Promise<AssetRegisterSummary> {
  const db = getDb();
  const primary = await getOrCreatePrimaryAssetRegister(userId);
  const totalsSql = await buildAssetRegisterTotalsSql();

  const result = await db.query<AssetRegisterRow>(
    `
      select
        ar.id,
        ar.user_id,
        ar.business_name,
        ar.email,
        ar.phone,
        ar.address_line_1,
        ar.logo_urls,
        ar.show_logos_on_register,
        ar.is_primary,
        ar.is_selected,
        ar.created_at,
        ar.updated_at,
        count(ai.id)::integer as asset_count,
        ${totalsSql.totalValueSql},
        ${totalsSql.totalReplacementPriceSql}
      from public.asset_registers ar
      left join public.asset_register_items ai
        on ai.user_id = ar.user_id
       and ai.register_id = ar.id
       and coalesce(ai.lifecycle_state, 'active') = 'active'
      where ar.user_id = $1 and ar.is_selected = true
      group by ar.id
      order by ar.updated_at desc nulls last, ar.created_at desc nulls last, ar.id desc
      limit 1
    `,
    [userId],
  );

  if (result.rows[0]) {
    return mapAssetRegisterRow(result.rows[0]);
  }

  await setSingleSelectedRegister(userId, primary.id);
  return { ...primary, isSelected: true };
}

export async function listAssetRegisters(userId: string): Promise<AssetRegisterSummary[]> {
  const db = getDb();
  await getOrCreatePrimaryAssetRegister(userId);
  const totalsSql = await buildAssetRegisterTotalsSql();

  const result = await db.query<AssetRegisterRow>(
    `
      select
        ar.id,
        ar.user_id,
        ar.business_name,
        ar.email,
        ar.phone,
        ar.address_line_1,
        ar.logo_urls,
        ar.show_logos_on_register,
        ar.is_primary,
        ar.is_selected,
        ar.created_at,
        ar.updated_at,
        count(ai.id)::integer as asset_count,
        ${totalsSql.totalValueSql},
        ${totalsSql.totalReplacementPriceSql}
      from public.asset_registers ar
      left join public.asset_register_items ai
        on ai.user_id = ar.user_id
       and ai.register_id = ar.id
       and coalesce(ai.lifecycle_state, 'active') = 'active'
      where ar.user_id = $1
      group by ar.id
      order by ar.is_selected desc, ar.is_primary desc, ar.updated_at desc nulls last, ar.created_at desc nulls last, ar.id desc
    `,
    [userId],
  );

  return attachAssetRegisterOpenAlertCounts(userId, result.rows.map(mapAssetRegisterRow));
}

export async function createAssetRegister(userId: string, input: AssetRegisterInput): Promise<AssetRegisterSummary> {
  const businessName = normalizeRegisterName(input.businessName);

  if (!businessName) {
    throw new Error('ASSET_REGISTER_NAME_REQUIRED');
  }

  await getOrCreatePrimaryAssetRegister(userId);
  return insertAssetRegister(userId, { ...input, businessName }, false, false);
}

export async function updateAssetRegister(userId: string, registerId: string, input: AssetRegisterInput): Promise<AssetRegisterSummary> {
  const db = getDb();
  await getOrCreatePrimaryAssetRegister(userId);

  const businessName = normalizeRegisterName(input.businessName);

  if (!businessName) {
    throw new Error('ASSET_REGISTER_NAME_REQUIRED');
  }

  const hasLogoUrls = Object.prototype.hasOwnProperty.call(input, 'logoUrls');
  const hasLogoVisibility = Object.prototype.hasOwnProperty.call(input, 'showLogosOnRegister');

  const result = await db.query<AssetRegisterRow>(
    `
      update public.asset_registers
      set
        business_name = $3,
        email = $4,
        phone = $5,
        address_line_1 = $6,
        logo_urls = case when $7 then $8::jsonb else logo_urls end,
        show_logos_on_register = case when $9 then $10 else show_logos_on_register end,
        updated_at = now()
      where user_id = $1 and id::text = $2
      returning
        id,
        user_id,
        business_name,
        email,
        phone,
        address_line_1,
        logo_urls,
        show_logos_on_register,
        is_primary,
        is_selected,
        created_at,
        updated_at,
        0::integer as asset_count,
        0::numeric as total_value,
        0::numeric as total_replacement_price
    `,
    [
      userId,
      registerId,
      businessName,
      normalizeEmail(input.email),
      normalizePhone(input.phone),
      normalizeAddress(input.addressLine1 ?? input.address),
      hasLogoUrls,
      JSON.stringify(normalizeLogoUrls(input.logoUrls)),
      hasLogoVisibility,
      normalizeLogoVisibility(input.showLogosOnRegister, true),
    ],
  );

  if (!result.rows[0]) {
    throw new Error('ASSET_REGISTER_NOT_FOUND');
  }

  const refreshed = await getAssetRegisterForUser(userId, String(result.rows[0].id));
  return refreshed ?? mapAssetRegisterRow(result.rows[0]);
}

export async function updateAssetRegisterLogo(input: {
  userId: string;
  registerId: string;
  logoUrls: string[];
  showLogosOnRegister?: boolean | null;
}): Promise<AssetRegisterSummary> {
  const db = getDb();
  const registerId = cleanText(input.registerId);

  if (!registerId) {
    throw new Error('ASSET_REGISTER_NOT_FOUND');
  }

  await getOrCreatePrimaryAssetRegister(input.userId);

  const result = await db.query<AssetRegisterRow>(
    `
      update public.asset_registers
      set
        logo_urls = $3::jsonb,
        show_logos_on_register = $4,
        updated_at = now()
      where user_id = $1 and id::text = $2
      returning
        id,
        user_id,
        business_name,
        email,
        phone,
        address_line_1,
        logo_urls,
        show_logos_on_register,
        is_primary,
        is_selected,
        created_at,
        updated_at,
        0::integer as asset_count,
        0::numeric as total_value,
        0::numeric as total_replacement_price
    `,
    [
      input.userId,
      registerId,
      JSON.stringify(normalizeLogoUrls(input.logoUrls)),
      normalizeLogoVisibility(input.showLogosOnRegister, true),
    ],
  );

  if (!result.rows[0]) {
    throw new Error('ASSET_REGISTER_NOT_FOUND');
  }

  const refreshed = await getAssetRegisterForUser(input.userId, String(result.rows[0].id));
  return refreshed ?? mapAssetRegisterRow(result.rows[0]);
}

export async function selectAssetRegister(userId: string, registerId: string): Promise<AssetRegisterSummary> {
  const cleanedRegisterId = cleanText(registerId);
  if (!cleanedRegisterId) {
    throw new Error('ASSET_REGISTER_NOT_FOUND');
  }

  const existing = await getAssetRegisterForUser(userId, cleanedRegisterId);
  if (!existing) {
    throw new Error('ASSET_REGISTER_NOT_FOUND');
  }

  await setSingleSelectedRegister(userId, existing.id);
  const refreshed = await getAssetRegisterForUser(userId, existing.id);
  if (!refreshed) {
    throw new Error('ASSET_REGISTER_NOT_FOUND');
  }

  return refreshed;
}

export async function moveAssetRegisterItems(input: {
  userId: string;
  assetIds: string[];
  targetRegisterId: string;
}): Promise<number> {
  const db = getDb();
  const assetIds = Array.from(new Set(input.assetIds.map((id) => cleanText(id)).filter(Boolean)));

  if (!assetIds.length) {
    throw new Error('ASSET_ID_REQUIRED');
  }

  const targetRegister = await getAssetRegisterForUser(input.userId, cleanText(input.targetRegisterId));

  if (!targetRegister) {
    throw new Error('ASSET_REGISTER_NOT_FOUND');
  }

  const result = await db.query(
    `
      update public.asset_register_items
      set register_id = $3::uuid,
          updated_at = now()
      where user_id = $1
        and id::text = any($2::text[])
    `,
    [input.userId, assetIds, targetRegister.id],
  );

  return result.rowCount ?? 0;
}

export async function deleteAssetRegister(input: {
  userId: string;
  registerId: string;
  targetRegisterId?: string | null;
}): Promise<DeleteAssetRegisterResult> {
  const db = getDb();
  const registerId = cleanText(input.registerId);
  const targetRegisterId = cleanText(input.targetRegisterId);

  if (!registerId) {
    throw new Error('ASSET_REGISTER_NOT_FOUND');
  }

  const registers = await listAssetRegisters(input.userId);
  const register = registers.find((entry) => entry.id === registerId) ?? null;

  if (!register) {
    throw new Error('ASSET_REGISTER_NOT_FOUND');
  }

  if (registers.length <= 1) {
    throw new Error('ASSET_REGISTER_LAST_REGISTER');
  }

  const assetCountResult = await db.query<CountRow>(
    `
      select count(*)::integer as count
      from public.asset_register_items
      where user_id = $1 and register_id = $2::uuid
    `,
    [input.userId, register.id],
  );
  const assetCount = Math.max(0, Math.round(numberValue(assetCountResult.rows[0]?.count)));
  let movedCount = 0;
  let selectedFallbackId = '';

  if (assetCount > 0) {
    if (!targetRegisterId) {
      throw new Error('ASSET_REGISTER_DELETE_TARGET_REQUIRED');
    }

    if (targetRegisterId === register.id) {
      throw new Error('ASSET_REGISTER_DELETE_TARGET_INVALID');
    }

    const targetRegister = registers.find((entry) => entry.id === targetRegisterId) ?? null;
    if (!targetRegister) {
      throw new Error('ASSET_REGISTER_NOT_FOUND');
    }

    const moveResult = await db.query(
      `
        update public.asset_register_items
        set register_id = $3::uuid,
            updated_at = now()
        where user_id = $1 and register_id = $2::uuid
      `,
      [input.userId, register.id, targetRegister.id],
    );

    movedCount = moveResult.rowCount ?? 0;
    selectedFallbackId = targetRegister.id;
  }

  await db.query(
    `
      delete from public.asset_registers
      where user_id = $1 and id::text = $2
    `,
    [input.userId, register.id],
  );

  const remaining = await db.query<AssetRegisterRow>(
    `
      select
        id,
        user_id,
        business_name,
        email,
        phone,
        address_line_1,
        logo_urls,
        show_logos_on_register,
        is_primary,
        is_selected,
        created_at,
        updated_at,
        0::integer as asset_count,
        0::numeric as total_value,
        0::numeric as total_replacement_price
      from public.asset_registers
      where user_id = $1
      order by is_primary desc, updated_at desc nulls last, created_at asc, id asc
    `,
    [input.userId],
  );

  if (!remaining.rows.length) {
    throw new Error('ASSET_REGISTER_NOT_FOUND');
  }

  const remainingIds = remaining.rows.map((row) => String(row.id));
  let nextPrimaryId = remaining.rows.find((row) => Boolean(row.is_primary))?.id;
  if (!nextPrimaryId || !remainingIds.includes(String(nextPrimaryId))) {
    nextPrimaryId = remaining.rows[0].id;
    await setSinglePrimaryRegister(input.userId, String(nextPrimaryId));
  }

  let nextSelectedId = remaining.rows.find((row) => Boolean(row.is_selected))?.id;
  if (register.isSelected || !nextSelectedId || !remainingIds.includes(String(nextSelectedId))) {
    nextSelectedId = selectedFallbackId || nextPrimaryId || remaining.rows[0].id;
    await setSingleSelectedRegister(input.userId, String(nextSelectedId));
  } else {
    await setSingleSelectedRegister(input.userId, String(nextSelectedId));
  }

  const selectedRegister = await getSelectedAssetRegister(input.userId);

  return {
    deletedRegisterId: register.id,
    movedCount,
    selectedRegister,
  };
}


export function getVisibleAssetRegisterLogoUrl(
  register: Pick<AssetRegisterSummary, 'logoUrls' | 'showLogosOnRegister'> | null | undefined,
): string {
  if (!register || register.showLogosOnRegister === false) {
    return '';
  }

  return normalizeLogoUrls(register.logoUrls)[0] ?? '';
}

export async function getAssetRegisterReportLogoUrl(userId: string, registerId?: string | null): Promise<string> {
  const cleanedRegisterId = cleanText(registerId);
  const register = cleanedRegisterId
    ? await getAssetRegisterForUser(userId, cleanedRegisterId)
    : await getSelectedAssetRegister(userId);

  return getVisibleAssetRegisterLogoUrl(register);
}

export async function userOwnsAssetRegister(userId: string, registerId: string | null | undefined): Promise<boolean> {
  const id = cleanText(registerId);
  if (!id) return false;
  return Boolean(await getAssetRegisterForUser(userId, id));
}
