import { ensureAccountProfileColumns } from './account-profile';
import { getDb } from './db';
import { normalizeAccountRole, type AccountRole } from './partner-access';

export type ContactRequestStatus = 'pending' | 'approved' | 'temporarily_denied' | 'permanently_denied';
export type ContactDecisionStatus = 'approved' | 'denied';
export type ContactAccessFilter = 'all' | 'unlocked' | 'locked' | 'pending' | 'temporarily_denied' | 'permanently_denied';

export type OwnerDirectoryEntry = {
  ownerUserId: string;
  companyName: string;
  requestId: string | null;
  requestStatus: ContactRequestStatus | null;
  contactUnlocked: boolean;
  popiaAcknowledged: boolean;
  contactName: string;
  contactPhone: string;
  contactEmail: string;
  contactLocation: string;
  ownerProvince: string;
  ownerTownCity: string;
  requestedAtIso: string | null;
  lastRequestedAtIso: string | null;
  updatedAtIso: string | null;
  deniedCount: number;
  lastDeniedAtIso: string | null;
  requestAgainAtIso: string | null;
  permanentlyDeniedAtIso: string | null;
};

export type ContactDetailRequest = {
  id: string;
  ownerUserId: string;
  requesterUserId: string;
  status: ContactRequestStatus;
  requesterAccountType: AccountRole;
  requesterDisplayName: string;
  requesterBusinessName: string;
  requesterPhone: string;
  requesterEmail: string;
  requesterLocation: string;
  ownerCompanyName: string;
  ownerContactName: string;
  ownerContactPhone: string;
  ownerContactEmail: string;
  ownerContactLocation: string;
  createdAtIso: string;
  lastRequestedAtIso: string | null;
  approvedAtIso: string | null;
  deniedAtIso: string | null;
  updatedAtIso: string;
  deniedCount: number;
  lastDeniedAtIso: string | null;
  requestAgainAtIso: string | null;
  permanentlyDeniedAtIso: string | null;
  popiaAcknowledgedAtIso: string | null;
};

export type OwnerDirectoryPagination = {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
  rangeStart: number;
  rangeEnd: number;
  hasPreviousPage: boolean;
  hasNextPage: boolean;
};

export type OwnerDirectorySummary = {
  totalOwners: number;
  unlockedCount: number;
  lockedCount: number;
  pendingCount: number;
  temporarilyDeniedCount: number;
  permanentlyDeniedCount: number;
};

export type OwnerProvinceOption = {
  value: string;
  label: string;
  count: number;
};

export type RequestAllowance = {
  dailyLimit: number;
  usedToday: number;
  remainingToday: number;
  resetTimezone: string;
  isLimitReached: boolean;
};

export type OwnerDirectoryResult = {
  owners: OwnerDirectoryEntry[];
  pagination: OwnerDirectoryPagination;
  summary: OwnerDirectorySummary;
  provinceOptions: OwnerProvinceOption[];
  ownersWithoutProvinceCount: number;
  requestAllowance: RequestAllowance;
};

type ListOwnerDirectoryOptions = {
  search?: string;
  province?: string;
  contactAccess?: ContactAccessFilter;
  page?: number;
  pageSize?: number;
};

type OwnerDirectoryRow = {
  owner_user_id: string;
  company_name: string | null;
  request_id: string | null;
  request_status: string | null;
  popia_acknowledged_at: string | null;
  contact_name: string | null;
  contact_phone: string | null;
  contact_email: string | null;
  contact_location: string | null;
  owner_province: string | null;
  owner_town_city: string | null;
  requested_at: string | null;
  last_requested_at: string | null;
  updated_at: string | null;
  denied_count: number | string | null;
  last_denied_at: string | null;
  request_again_at: string | null;
  permanently_denied_at: string | null;
};

type ContactRequestRow = {
  id: string;
  owner_user_id: string;
  requester_user_id: string;
  status: string | null;
  requester_account_type: string | null;
  requester_display_name: string | null;
  requester_business_name: string | null;
  requester_phone: string | null;
  requester_email: string | null;
  requester_location: string | null;
  owner_company_name: string | null;
  owner_contact_name: string | null;
  owner_contact_phone: string | null;
  owner_contact_email: string | null;
  owner_contact_location: string | null;
  created_at: string | null;
  last_requested_at: string | null;
  approved_at: string | null;
  denied_at: string | null;
  updated_at: string | null;
  denied_count: number | string | null;
  last_denied_at: string | null;
  request_again_at: string | null;
  permanently_denied_at: string | null;
  popia_acknowledged_at: string | null;
};

type AccountRoleRow = {
  account_type: string | null;
};

type CountRow = {
  count: number | string | null;
};

type SummaryRow = {
  total_owners: number | string | null;
  unlocked_count: number | string | null;
  locked_count: number | string | null;
  pending_count: number | string | null;
  temporarily_denied_count: number | string | null;
  permanently_denied_count: number | string | null;
};

type ProvinceRow = {
  province: string | null;
  count: number | string | null;
};

type ExistingRequestRow = {
  id: string;
  status: string | null;
  denied_count: number | string | null;
  request_again_at: string | null;
  permanently_denied_at: string | null;
};

const DAILY_CONTACT_REQUEST_LIMIT = 5;
const CONTACT_REQUEST_PAGE_SIZE = 10;
const MAX_CONTACT_REQUEST_PAGE_SIZE = 50;
const CONTACT_REQUEST_STATUSES = new Set<ContactRequestStatus>(['pending', 'approved', 'temporarily_denied', 'permanently_denied']);
let contactRequestTablesEnsured = false;

function asText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function asInt(value: unknown): number {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Math.max(0, Math.trunc(numeric)) : 0;
}

function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (match) => `\\${match}`);
}

function normalizeContactRequestStatus(value: unknown): ContactRequestStatus {
  const normalized = asText(value).toLowerCase();

  if (normalized === 'denied') {
    return 'temporarily_denied';
  }

  return CONTACT_REQUEST_STATUSES.has(normalized as ContactRequestStatus)
    ? (normalized as ContactRequestStatus)
    : 'pending';
}

export function normalizeContactDecision(value: unknown): ContactDecisionStatus | null {
  const normalized = asText(value).toLowerCase();

  if (normalized === 'approved' || normalized === 'share' || normalized === 'shared' || normalized === 'allow') {
    return 'approved';
  }

  if (normalized === 'denied' || normalized === 'deny' || normalized === 'declined' || normalized === 'decline') {
    return 'denied';
  }

  return null;
}

export function normalizeContactAccessFilter(value: unknown): ContactAccessFilter {
  const normalized = asText(value).toLowerCase();

  if (
    normalized === 'unlocked' ||
    normalized === 'locked' ||
    normalized === 'pending' ||
    normalized === 'temporarily_denied' ||
    normalized === 'permanently_denied'
  ) {
    return normalized;
  }

  return 'all';
}

function isoNowFallback(value: string | null | undefined): string {
  return value || new Date().toISOString();
}

function formatRetryDate(value: string | null | undefined): string {
  if (!value) return 'the available date';
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) return 'the available date';

  return new Intl.DateTimeFormat('en-ZA', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'Africa/Johannesburg',
  }).format(new Date(parsed));
}

function effectiveStatusSql(alias = 'request'): string {
  return `case
    when ${alias}.permanently_denied_at is not null or ${alias}.status = 'permanently_denied' then 'permanently_denied'
    when ${alias}.status in ('temporarily_denied', 'denied') then 'temporarily_denied'
    when ${alias}.status = 'approved' then 'approved'
    when ${alias}.status = 'pending' then 'pending'
    else null
  end`;
}

function contactDetailsVisibleSql(alias = 'request'): string {
  return `(${effectiveStatusSql(alias)} = 'approved' and ${alias}.popia_acknowledged_at is not null)`;
}

function mapOwnerDirectoryRow(row: OwnerDirectoryRow): OwnerDirectoryEntry {
  const status = row.request_status ? normalizeContactRequestStatus(row.request_status) : null;
  const contactUnlocked = status === 'approved';
  const popiaAcknowledged = Boolean(row.popia_acknowledged_at);
  const contactVisible = contactUnlocked && popiaAcknowledged;

  return {
    ownerUserId: row.owner_user_id,
    companyName: asText(row.company_name) || 'Owner account',
    requestId: row.request_id,
    requestStatus: status,
    contactUnlocked,
    popiaAcknowledged,
    contactName: contactVisible ? asText(row.contact_name) : '',
    contactPhone: contactVisible ? asText(row.contact_phone) : '',
    contactEmail: contactVisible ? asText(row.contact_email) : '',
    contactLocation: contactVisible ? asText(row.contact_location) : '',
    ownerProvince: asText(row.owner_province),
    ownerTownCity: asText(row.owner_town_city),
    requestedAtIso: row.requested_at,
    lastRequestedAtIso: row.last_requested_at,
    updatedAtIso: row.updated_at,
    deniedCount: asInt(row.denied_count),
    lastDeniedAtIso: row.last_denied_at,
    requestAgainAtIso: row.request_again_at,
    permanentlyDeniedAtIso: row.permanently_denied_at,
  };
}

function mapContactRequestRow(row: ContactRequestRow): ContactDetailRequest {
  return {
    id: row.id,
    ownerUserId: row.owner_user_id,
    requesterUserId: row.requester_user_id,
    status: normalizeContactRequestStatus(row.status),
    requesterAccountType: normalizeAccountRole(row.requester_account_type),
    requesterDisplayName: asText(row.requester_display_name),
    requesterBusinessName: asText(row.requester_business_name),
    requesterPhone: asText(row.requester_phone),
    requesterEmail: asText(row.requester_email),
    requesterLocation: asText(row.requester_location),
    ownerCompanyName: asText(row.owner_company_name) || 'Owner account',
    ownerContactName: asText(row.owner_contact_name),
    ownerContactPhone: asText(row.owner_contact_phone),
    ownerContactEmail: asText(row.owner_contact_email),
    ownerContactLocation: asText(row.owner_contact_location),
    createdAtIso: isoNowFallback(row.created_at),
    lastRequestedAtIso: row.last_requested_at,
    approvedAtIso: row.approved_at,
    deniedAtIso: row.denied_at,
    updatedAtIso: isoNowFallback(row.updated_at),
    deniedCount: asInt(row.denied_count),
    lastDeniedAtIso: row.last_denied_at,
    requestAgainAtIso: row.request_again_at,
    permanentlyDeniedAtIso: row.permanently_denied_at,
    popiaAcknowledgedAtIso: row.popia_acknowledged_at,
  };
}

export function contactRequesterName(request: ContactDetailRequest): string {
  return request.requesterBusinessName || request.requesterDisplayName || 'An Aim4price user';
}

export async function ensureContactRequestTables(): Promise<void> {
  if (contactRequestTablesEnsured) {
    return;
  }

  await ensureAccountProfileColumns();
  const db = getDb();

  await db.query('CREATE EXTENSION IF NOT EXISTS pgcrypto');

  await db.query(`
    create table if not exists account_contact_requests (
      id uuid primary key default gen_random_uuid(),
      owner_user_id text not null,
      requester_user_id text not null,
      status text not null default 'pending',
      created_at timestamptz not null default now(),
      last_requested_at timestamptz not null default now(),
      approved_at timestamptz,
      denied_at timestamptz,
      denied_count integer not null default 0,
      last_denied_at timestamptz,
      request_again_at timestamptz,
      permanently_denied_at timestamptz,
      popia_acknowledged_at timestamptz,
      updated_at timestamptz not null default now()
    )
  `);

  await db.query(`
    alter table account_contact_requests
      add column if not exists owner_user_id text,
      add column if not exists requester_user_id text,
      add column if not exists status text not null default 'pending',
      add column if not exists created_at timestamptz not null default now(),
      add column if not exists last_requested_at timestamptz not null default now(),
      add column if not exists approved_at timestamptz,
      add column if not exists denied_at timestamptz,
      add column if not exists denied_count integer not null default 0,
      add column if not exists last_denied_at timestamptz,
      add column if not exists request_again_at timestamptz,
      add column if not exists permanently_denied_at timestamptz,
      add column if not exists popia_acknowledged_at timestamptz,
      add column if not exists updated_at timestamptz not null default now()
  `);

  await db.query(`
    update account_contact_requests
    set
      denied_count = case
        when status in ('denied', 'temporarily_denied') and coalesce(denied_count, 0) < 1 then 1
        else coalesce(denied_count, 0)
      end,
      last_denied_at = case
        when status in ('denied', 'temporarily_denied') then coalesce(last_denied_at, denied_at, updated_at, now())
        else last_denied_at
      end,
      request_again_at = case
        when status in ('denied', 'temporarily_denied') and permanently_denied_at is null then coalesce(request_again_at, denied_at + interval '90 days', updated_at + interval '90 days', now() + interval '90 days')
        else request_again_at
      end,
      status = case
        when status = 'denied' then 'temporarily_denied'
        when status not in ('pending', 'approved', 'temporarily_denied', 'permanently_denied') then 'pending'
        else status
      end,
      last_requested_at = coalesce(last_requested_at, created_at, updated_at, now())
  `);

  await db.query(`
    update account_contact_requests
    set
      status = 'permanently_denied',
      permanently_denied_at = coalesce(permanently_denied_at, last_denied_at, denied_at, updated_at, now()),
      request_again_at = null
    where coalesce(denied_count, 0) >= 3
      and status <> 'approved'
  `);

  await db.query(`
    create unique index if not exists idx_account_contact_requests_owner_requester
      on account_contact_requests(owner_user_id, requester_user_id)
  `);

  await db.query(`
    create index if not exists idx_account_contact_requests_owner_status
      on account_contact_requests(owner_user_id, status, created_at desc)
  `);

  await db.query(`
    create index if not exists idx_account_contact_requests_requester_status
      on account_contact_requests(requester_user_id, status, created_at desc)
  `);

  await db.query(`
    create index if not exists idx_account_contact_requests_requester_requested_day
      on account_contact_requests(requester_user_id, last_requested_at desc)
  `);

  contactRequestTablesEnsured = true;
}

function contactRequestSelectSql(whereClause: string): string {
  return `
    select
      r.id::text,
      r.owner_user_id,
      r.requester_user_id,
      ${effectiveStatusSql('r')} as status,
      requester.account_type as requester_account_type,
      requester.display_name as requester_display_name,
      requester.business_name as requester_business_name,
      requester.phone as requester_phone,
      requester.marketplace_email as requester_email,
      concat_ws(', ', nullif(requester.town_city, ''), nullif(requester.province, '')) as requester_location,
      coalesce(nullif(owner.business_name, ''), nullif(owner.display_name, ''), 'Owner account') as owner_company_name,
      coalesce(nullif(owner.business_name, ''), nullif(owner.display_name, ''), 'Aim4price owner') as owner_contact_name,
      owner.phone as owner_contact_phone,
      owner.marketplace_email as owner_contact_email,
      concat_ws(', ', nullif(owner.town_city, ''), nullif(owner.province, '')) as owner_contact_location,
      r.created_at::text,
      r.last_requested_at::text,
      r.approved_at::text,
      r.denied_at::text,
      r.updated_at::text,
      r.denied_count,
      r.last_denied_at::text,
      r.request_again_at::text,
      r.permanently_denied_at::text,
      r.popia_acknowledged_at::text
    from account_contact_requests r
    left join account_profiles requester on requester.user_id = r.requester_user_id
    left join account_profiles owner on owner.user_id = r.owner_user_id
    ${whereClause}
  `;
}

function ownerDirectorySelectSql(whereClause: string): string {
  const status = effectiveStatusSql('request');
  const detailsVisible = contactDetailsVisibleSql('request');

  return `
    select
      owner.user_id as owner_user_id,
      coalesce(nullif(owner.business_name, ''), nullif(owner.display_name, ''), 'Owner account') as company_name,
      request.id::text as request_id,
      ${status} as request_status,
      request.popia_acknowledged_at::text,
      case when ${detailsVisible} then coalesce(nullif(owner.business_name, ''), nullif(owner.display_name, ''), 'Aim4price owner') else null end as contact_name,
      case when ${detailsVisible} then owner.phone else null end as contact_phone,
      case when ${detailsVisible} then owner.marketplace_email else null end as contact_email,
      case when ${detailsVisible} then concat_ws(', ', nullif(owner.town_city, ''), nullif(owner.province, '')) else null end as contact_location,
      owner.province as owner_province,
      owner.town_city as owner_town_city,
      request.created_at::text as requested_at,
      request.last_requested_at::text as last_requested_at,
      request.updated_at::text as updated_at,
      request.denied_count,
      request.last_denied_at::text,
      request.request_again_at::text,
      request.permanently_denied_at::text
    from account_profiles owner
    left join account_contact_requests request
      on request.owner_user_id = owner.user_id
     and request.requester_user_id = $1
    ${whereClause}
  `;
}

async function getAccountRole(userId: string): Promise<AccountRole> {
  await ensureContactRequestTables();
  const db = getDb();
  const result = await db.query<AccountRoleRow>('select account_type from account_profiles where user_id = $1 limit 1', [userId]);
  return normalizeAccountRole(result.rows[0]?.account_type);
}

function buildDirectoryWhere(input: {
  requesterUserId: string;
  search?: string;
  province?: string;
  contactAccess?: ContactAccessFilter;
  ownerUserId?: string;
}) {
  const params: unknown[] = [input.requesterUserId];
  const where = ["owner.account_type = 'owner'", 'owner.user_id <> $1'];

  if (input.ownerUserId) {
    params.push(input.ownerUserId);
    where.push(`owner.user_id = $${params.length}`);
  }

  const search = asText(input.search);
  if (search) {
    params.push(`%${escapeLike(search)}%`);
    const placeholder = `$${params.length}`;
    where.push(`(
      coalesce(nullif(owner.business_name, ''), nullif(owner.display_name, ''), 'Owner account') ilike ${placeholder} escape '\\'
      or coalesce(owner.province, '') ilike ${placeholder} escape '\\'
      or coalesce(owner.town_city, '') ilike ${placeholder} escape '\\'
      or (${contactDetailsVisibleSql('request')} and coalesce(owner.phone, '') ilike ${placeholder} escape '\\')
      or (${contactDetailsVisibleSql('request')} and coalesce(owner.marketplace_email, '') ilike ${placeholder} escape '\\')
    )`);
  }

  const province = asText(input.province);
  if (province === '__province_not_saved__') {
    where.push("coalesce(nullif(owner.province, ''), '') = ''");
  } else if (province && province.toLowerCase() !== 'all') {
    params.push(province.toLowerCase());
    where.push(`lower(coalesce(owner.province, '')) = $${params.length}`);
  }

  const contactAccess = normalizeContactAccessFilter(input.contactAccess);
  if (contactAccess !== 'all') {
    const status = effectiveStatusSql('request');
    if (contactAccess === 'unlocked') {
      where.push(`${status} = 'approved'`);
    } else if (contactAccess === 'locked') {
      where.push(`${status} is null`);
    } else if (contactAccess === 'pending') {
      where.push(`${status} = 'pending'`);
    } else if (contactAccess === 'temporarily_denied') {
      where.push(`${status} = 'temporarily_denied'`);
    } else if (contactAccess === 'permanently_denied') {
      where.push(`${status} = 'permanently_denied'`);
    }
  }

  return {
    params,
    whereClause: `where ${where.join(' and ')}`,
  };
}

async function getDailyRequestAllowance(requesterUserId: string): Promise<RequestAllowance> {
  await ensureContactRequestTables();
  const db = getDb();
  const result = await db.query<CountRow>(
    `
      select count(*)::int as count
      from account_contact_requests
      where requester_user_id = $1
        and coalesce(last_requested_at, created_at) >= ((now() at time zone 'Africa/Johannesburg')::date at time zone 'Africa/Johannesburg')
        and coalesce(last_requested_at, created_at) < (((now() at time zone 'Africa/Johannesburg')::date + 1) at time zone 'Africa/Johannesburg')
    `,
    [requesterUserId],
  );

  const usedToday = Math.min(DAILY_CONTACT_REQUEST_LIMIT, asInt(result.rows[0]?.count));
  const remainingToday = Math.max(DAILY_CONTACT_REQUEST_LIMIT - usedToday, 0);

  return {
    dailyLimit: DAILY_CONTACT_REQUEST_LIMIT,
    usedToday,
    remainingToday,
    resetTimezone: 'Africa/Johannesburg',
    isLimitReached: remainingToday <= 0,
  };
}

async function getDirectorySummary(requesterUserId: string, options: Pick<ListOwnerDirectoryOptions, 'search' | 'province'>): Promise<OwnerDirectorySummary> {
  const { params, whereClause } = buildDirectoryWhere({
    requesterUserId,
    search: options.search,
    province: options.province,
    contactAccess: 'all',
  });
  const db = getDb();
  const status = effectiveStatusSql('request');

  const result = await db.query<SummaryRow>(
    `
      select
        count(*)::int as total_owners,
        count(*) filter (where ${status} = 'approved')::int as unlocked_count,
        count(*) filter (where ${status} is null)::int as locked_count,
        count(*) filter (where ${status} = 'pending')::int as pending_count,
        count(*) filter (where ${status} = 'temporarily_denied')::int as temporarily_denied_count,
        count(*) filter (where ${status} = 'permanently_denied')::int as permanently_denied_count
      from account_profiles owner
      left join account_contact_requests request
        on request.owner_user_id = owner.user_id
       and request.requester_user_id = $1
      ${whereClause}
    `,
    params,
  );

  const row = result.rows[0];

  return {
    totalOwners: asInt(row?.total_owners),
    unlockedCount: asInt(row?.unlocked_count),
    lockedCount: asInt(row?.locked_count),
    pendingCount: asInt(row?.pending_count),
    temporarilyDeniedCount: asInt(row?.temporarily_denied_count),
    permanentlyDeniedCount: asInt(row?.permanently_denied_count),
  };
}

async function listOwnerProvinceOptions(requesterUserId: string): Promise<{ options: OwnerProvinceOption[]; missingCount: number }> {
  await ensureContactRequestTables();
  const db = getDb();
  const result = await db.query<ProvinceRow>(
    `
      select nullif(trim(owner.province), '') as province, count(*)::int as count
      from account_profiles owner
      where owner.account_type = 'owner'
        and owner.user_id <> $1
      group by nullif(trim(owner.province), '')
      order by nullif(trim(owner.province), '') asc nulls last
    `,
    [requesterUserId],
  );

  const options: OwnerProvinceOption[] = [];
  let missingCount = 0;

  for (const row of result.rows) {
    const province = asText(row.province);
    const count = asInt(row.count);

    if (!province) {
      missingCount += count;
    } else {
      options.push({ value: province, label: province, count });
    }
  }

  return { options, missingCount };
}

export async function listOwnerDirectoryForRequester(
  requesterUserId: string,
  options: ListOwnerDirectoryOptions = {},
): Promise<OwnerDirectoryResult> {
  await ensureContactRequestTables();
  const db = getDb();
  const pageSize = Math.min(Math.max(asInt(options.pageSize) || CONTACT_REQUEST_PAGE_SIZE, 1), MAX_CONTACT_REQUEST_PAGE_SIZE);
  const requestedPage = Math.max(asInt(options.page) || 1, 1);
  const contactAccess = normalizeContactAccessFilter(options.contactAccess);
  const { params, whereClause } = buildDirectoryWhere({
    requesterUserId,
    search: options.search,
    province: options.province,
    contactAccess,
  });

  const [countResult, summary, provinceMeta, requestAllowance] = await Promise.all([
    db.query<CountRow>(
      `
        select count(*)::int as count
        from account_profiles owner
        left join account_contact_requests request
          on request.owner_user_id = owner.user_id
         and request.requester_user_id = $1
        ${whereClause}
      `,
      params,
    ),
    getDirectorySummary(requesterUserId, { search: options.search, province: options.province }),
    listOwnerProvinceOptions(requesterUserId),
    getDailyRequestAllowance(requesterUserId),
  ]);

  const totalItems = asInt(countResult.rows[0]?.count);
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const page = Math.min(requestedPage, totalPages);
  const offset = (page - 1) * pageSize;

  const result = await db.query<OwnerDirectoryRow>(
    `
      ${ownerDirectorySelectSql(whereClause)}
      order by coalesce(nullif(owner.business_name, ''), nullif(owner.display_name, ''), 'Owner account') asc
      limit $${params.length + 1}
      offset $${params.length + 2}
    `,
    [...params, pageSize, offset],
  );

  return {
    owners: result.rows.map(mapOwnerDirectoryRow),
    pagination: {
      page,
      pageSize,
      totalItems,
      totalPages,
      rangeStart: totalItems ? offset + 1 : 0,
      rangeEnd: Math.min(offset + pageSize, totalItems),
      hasPreviousPage: page > 1,
      hasNextPage: page < totalPages,
    },
    summary,
    provinceOptions: provinceMeta.options,
    ownersWithoutProvinceCount: provinceMeta.missingCount,
    requestAllowance,
  };
}

async function getOwnerDirectoryEntryForRequester(requesterUserId: string, ownerUserId: string): Promise<OwnerDirectoryEntry | null> {
  await ensureContactRequestTables();
  const db = getDb();
  const { params, whereClause } = buildDirectoryWhere({ requesterUserId, ownerUserId, contactAccess: 'all' });

  const result = await db.query<OwnerDirectoryRow>(
    `${ownerDirectorySelectSql(whereClause)} limit 1`,
    params,
  );

  return result.rows[0] ? mapOwnerDirectoryRow(result.rows[0]) : null;
}

export async function createContactDetailRequest(input: {
  requesterUserId: string;
  ownerUserId: string;
}): Promise<OwnerDirectoryEntry> {
  await ensureContactRequestTables();

  if (!asText(input.ownerUserId) || !asText(input.requesterUserId) || input.ownerUserId === input.requesterUserId) {
    throw new Error('Choose a valid owner account.');
  }

  const requesterRole = await getAccountRole(input.requesterUserId);
  const ownerRole = await getAccountRole(input.ownerUserId);

  if (requesterRole === 'owner') {
    throw new Error('CONTACT_REQUEST_FORBIDDEN');
  }

  if (ownerRole !== 'owner') {
    throw new Error('CONTACT_REQUEST_OWNER_NOT_FOUND');
  }

  const db = getDb();
  const client = await db.connect();
  let transactionOpen = false;

  try {
    await client.query('begin');
    transactionOpen = true;
    await client.query('select pg_advisory_xact_lock(hashtext($1))', [`contact-request:${input.requesterUserId}`]);

    const existingResult = await client.query<ExistingRequestRow>(
      `
        select id::text, ${effectiveStatusSql('account_contact_requests')} as status, denied_count, request_again_at::text, permanently_denied_at::text
        from account_contact_requests
        where owner_user_id = $1
          and requester_user_id = $2
        for update
      `,
      [input.ownerUserId, input.requesterUserId],
    );
    const existing = existingResult.rows[0];
    const existingStatus = existing ? normalizeContactRequestStatus(existing.status) : null;

    if (existingStatus === 'approved' || existingStatus === 'pending') {
      await client.query('commit');
      transactionOpen = false;
      const owner = await getOwnerDirectoryEntryForRequester(input.requesterUserId, input.ownerUserId);
      if (!owner) throw new Error('CONTACT_REQUEST_OWNER_NOT_FOUND');
      return owner;
    }

    if (existingStatus === 'permanently_denied') {
      throw new Error('Permanently denied. This owner cannot be requested again.');
    }

    if (existingStatus === 'temporarily_denied') {
      const requestAgainAt = existing?.request_again_at ? Date.parse(existing.request_again_at) : 0;
      if (Number.isFinite(requestAgainAt) && requestAgainAt > Date.now()) {
        throw new Error(`Temporarily denied. Try again in 90 days. Available again: ${formatRetryDate(existing?.request_again_at)}.`);
      }
    }

    const allowanceResult = await client.query<CountRow>(
      `
        select count(*)::int as count
        from account_contact_requests
        where requester_user_id = $1
          and coalesce(last_requested_at, created_at) >= ((now() at time zone 'Africa/Johannesburg')::date at time zone 'Africa/Johannesburg')
          and coalesce(last_requested_at, created_at) < (((now() at time zone 'Africa/Johannesburg')::date + 1) at time zone 'Africa/Johannesburg')
      `,
      [input.requesterUserId],
    );

    if (asInt(allowanceResult.rows[0]?.count) >= DAILY_CONTACT_REQUEST_LIMIT) {
      throw new Error('Daily request limit reached. You can request more users tomorrow.');
    }

    await client.query(
      `
        insert into account_contact_requests (
          owner_user_id,
          requester_user_id,
          status,
          created_at,
          last_requested_at,
          updated_at
        )
        values ($1, $2, 'pending', now(), now(), now())
        on conflict (owner_user_id, requester_user_id)
        do update set
          status = 'pending',
          approved_at = null,
          request_again_at = null,
          permanently_denied_at = null,
          popia_acknowledged_at = null,
          last_requested_at = now(),
          updated_at = now()
      `,
      [input.ownerUserId, input.requesterUserId],
    );

    await client.query('commit');
    transactionOpen = false;
  } catch (error) {
    if (transactionOpen) {
      await client.query('rollback');
    }
    throw error;
  } finally {
    client.release();
  }

  const owner = await getOwnerDirectoryEntryForRequester(input.requesterUserId, input.ownerUserId);

  if (!owner) {
    throw new Error('CONTACT_REQUEST_OWNER_NOT_FOUND');
  }

  return owner;
}

export async function acknowledgeContactDetailsPopia(input: {
  requesterUserId: string;
  requestId: string;
}): Promise<OwnerDirectoryEntry> {
  await ensureContactRequestTables();
  const db = getDb();

  const updated = await db.query<{ owner_user_id: string }>(
    `
      update account_contact_requests
      set popia_acknowledged_at = coalesce(popia_acknowledged_at, now()),
          updated_at = now()
      where id = $1::uuid
        and requester_user_id = $2
        and ${effectiveStatusSql('account_contact_requests')} = 'approved'
      returning owner_user_id
    `,
    [input.requestId, input.requesterUserId],
  );

  const ownerUserId = updated.rows[0]?.owner_user_id;
  if (!ownerUserId) {
    throw new Error('CONTACT_REQUEST_NOT_FOUND');
  }

  const owner = await getOwnerDirectoryEntryForRequester(input.requesterUserId, ownerUserId);
  if (!owner) {
    throw new Error('CONTACT_REQUEST_OWNER_NOT_FOUND');
  }

  return owner;
}

export async function listIncomingContactRequestsForOwner(ownerUserId: string): Promise<ContactDetailRequest[]> {
  await ensureContactRequestTables();
  const db = getDb();

  const result = await db.query<ContactRequestRow>(
    `
      ${contactRequestSelectSql('where r.owner_user_id = $1')}
      order by
        case ${effectiveStatusSql('r')} when 'pending' then 0 when 'approved' then 1 when 'temporarily_denied' then 2 else 3 end,
        r.created_at desc
      limit 250
    `,
    [ownerUserId],
  );

  return result.rows.map(mapContactRequestRow);
}

export async function listPendingContactRequestsForOwner(ownerUserId: string): Promise<ContactDetailRequest[]> {
  await ensureContactRequestTables();
  const db = getDb();

  const result = await db.query<ContactRequestRow>(
    `
      ${contactRequestSelectSql("where r.owner_user_id = $1 and r.status = 'pending'")}
      order by r.created_at desc
      limit 30
    `,
    [ownerUserId],
  );

  return result.rows.map(mapContactRequestRow);
}

export async function listContactRequestsForRequester(requesterUserId: string): Promise<ContactDetailRequest[]> {
  await ensureContactRequestTables();
  const db = getDb();

  const result = await db.query<ContactRequestRow>(
    `
      ${contactRequestSelectSql('where r.requester_user_id = $1')}
      order by r.updated_at desc, r.created_at desc
      limit 250
    `,
    [requesterUserId],
  );

  return result.rows.map(mapContactRequestRow);
}


export async function getContactDetailRequestForOwner(input: {
  ownerUserId: string;
  requestId: string;
}): Promise<ContactDetailRequest | null> {
  await ensureContactRequestTables();
  const db = getDb();

  const result = await db.query<ContactRequestRow>(
    `${contactRequestSelectSql('where r.owner_user_id = $1 and r.id = $2::uuid')} limit 1`,
    [input.ownerUserId, input.requestId],
  );

  return result.rows[0] ? mapContactRequestRow(result.rows[0]) : null;
}

export async function updateContactDetailRequestStatus(input: {
  ownerUserId: string;
  requestId: string;
  status: ContactDecisionStatus;
}): Promise<ContactDetailRequest> {
  await ensureContactRequestTables();

  const status = normalizeContactDecision(input.status);

  if (!status) {
    throw new Error('CONTACT_REQUEST_STATUS_INVALID');
  }

  const db = getDb();
  const current = await db.query<ContactRequestRow>(
    `${contactRequestSelectSql('where r.id = $1::uuid')} limit 1`,
    [input.requestId],
  );
  const request = current.rows[0] ? mapContactRequestRow(current.rows[0]) : null;

  if (!request) {
    throw new Error('CONTACT_REQUEST_NOT_FOUND');
  }

  if (request.ownerUserId !== input.ownerUserId) {
    throw new Error('CONTACT_REQUEST_FORBIDDEN');
  }

  if (request.status !== 'pending') {
    return request;
  }

  if (status === 'approved') {
    await db.query(
      `
        update account_contact_requests
        set status = 'approved',
            approved_at = now(),
            request_again_at = null,
            permanently_denied_at = null,
            popia_acknowledged_at = null,
            updated_at = now()
        where id = $1::uuid
      `,
      [input.requestId],
    );
  } else {
    await db.query(
      `
        update account_contact_requests
        set denied_count = coalesce(denied_count, 0) + 1,
            status = case when coalesce(denied_count, 0) + 1 >= 3 then 'permanently_denied' else 'temporarily_denied' end,
            denied_at = now(),
            last_denied_at = now(),
            request_again_at = case when coalesce(denied_count, 0) + 1 >= 3 then null else now() + interval '90 days' end,
            permanently_denied_at = case when coalesce(denied_count, 0) + 1 >= 3 then now() else permanently_denied_at end,
            popia_acknowledged_at = null,
            updated_at = now()
        where id = $1::uuid
      `,
      [input.requestId],
    );
  }

  const updated = await db.query<ContactRequestRow>(
    `${contactRequestSelectSql('where r.id = $1::uuid')} limit 1`,
    [input.requestId],
  );
  const updatedRow = updated.rows[0];

  if (!updatedRow) {
    throw new Error('CONTACT_REQUEST_NOT_FOUND');
  }

  return mapContactRequestRow(updatedRow);
}
