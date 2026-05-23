import { ensureAccountProfileColumns } from './account-profile';
import { getDb } from './db';
import { normalizeAccountRole, type AccountRole } from './partner-access';

export type ContactRequestStatus = 'pending' | 'approved' | 'denied';

export type OwnerDirectoryEntry = {
  ownerUserId: string;
  companyName: string;
  requestId: string | null;
  requestStatus: ContactRequestStatus | null;
  contactUnlocked: boolean;
  contactName: string;
  contactPhone: string;
  contactEmail: string;
  contactLocation: string;
  requestedAtIso: string | null;
  updatedAtIso: string | null;
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
  approvedAtIso: string | null;
  deniedAtIso: string | null;
  updatedAtIso: string;
};

type OwnerDirectoryRow = {
  owner_user_id: string;
  company_name: string | null;
  request_id: string | null;
  request_status: string | null;
  contact_name: string | null;
  contact_phone: string | null;
  contact_email: string | null;
  contact_location: string | null;
  requested_at: string | null;
  updated_at: string | null;
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
  approved_at: string | null;
  denied_at: string | null;
  updated_at: string | null;
};

type AccountRoleRow = {
  account_type: string | null;
};

const CONTACT_REQUEST_STATUSES = new Set<ContactRequestStatus>(['pending', 'approved', 'denied']);
let contactRequestTablesEnsured = false;

function asText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeContactRequestStatus(value: unknown): ContactRequestStatus {
  const normalized = asText(value).toLowerCase();
  return CONTACT_REQUEST_STATUSES.has(normalized as ContactRequestStatus)
    ? (normalized as ContactRequestStatus)
    : 'pending';
}

export function normalizeContactDecision(value: unknown): Exclude<ContactRequestStatus, 'pending'> | null {
  const normalized = asText(value).toLowerCase();

  if (normalized === 'approved' || normalized === 'share' || normalized === 'shared' || normalized === 'allow') {
    return 'approved';
  }

  if (normalized === 'denied' || normalized === 'deny' || normalized === 'declined' || normalized === 'decline') {
    return 'denied';
  }

  return null;
}

function isoNowFallback(value: string | null | undefined): string {
  return value || new Date().toISOString();
}

function buildLocation(...parts: Array<string | null | undefined>): string {
  return parts.map((part) => asText(part)).filter(Boolean).join(', ');
}

function mapOwnerDirectoryRow(row: OwnerDirectoryRow): OwnerDirectoryEntry {
  const status = row.request_status ? normalizeContactRequestStatus(row.request_status) : null;
  const contactUnlocked = status === 'approved';

  return {
    ownerUserId: row.owner_user_id,
    companyName: asText(row.company_name) || 'Owner account',
    requestId: row.request_id,
    requestStatus: status,
    contactUnlocked,
    contactName: contactUnlocked ? asText(row.contact_name) : '',
    contactPhone: contactUnlocked ? asText(row.contact_phone) : '',
    contactEmail: contactUnlocked ? asText(row.contact_email) : '',
    contactLocation: contactUnlocked ? asText(row.contact_location) : '',
    requestedAtIso: row.requested_at,
    updatedAtIso: row.updated_at,
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
    approvedAtIso: row.approved_at,
    deniedAtIso: row.denied_at,
    updatedAtIso: isoNowFallback(row.updated_at),
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
      approved_at timestamptz,
      denied_at timestamptz,
      updated_at timestamptz not null default now()
    )
  `);

  await db.query(`
    alter table account_contact_requests
      add column if not exists owner_user_id text,
      add column if not exists requester_user_id text,
      add column if not exists status text not null default 'pending',
      add column if not exists created_at timestamptz not null default now(),
      add column if not exists approved_at timestamptz,
      add column if not exists denied_at timestamptz,
      add column if not exists updated_at timestamptz not null default now()
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

  contactRequestTablesEnsured = true;
}

function contactRequestSelectSql(whereClause: string): string {
  return `
    select
      r.id::text,
      r.owner_user_id,
      r.requester_user_id,
      r.status,
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
      r.approved_at::text,
      r.denied_at::text,
      r.updated_at::text
    from account_contact_requests r
    left join account_profiles requester on requester.user_id = r.requester_user_id
    left join account_profiles owner on owner.user_id = r.owner_user_id
    ${whereClause}
  `;
}

async function getAccountRole(userId: string): Promise<AccountRole> {
  await ensureContactRequestTables();
  const db = getDb();
  const result = await db.query<AccountRoleRow>('select account_type from account_profiles where user_id = $1 limit 1', [userId]);
  return normalizeAccountRole(result.rows[0]?.account_type);
}

export async function listOwnerDirectoryForRequester(requesterUserId: string): Promise<OwnerDirectoryEntry[]> {
  await ensureContactRequestTables();
  const db = getDb();

  const result = await db.query<OwnerDirectoryRow>(
    `
      select
        owner.user_id as owner_user_id,
        coalesce(nullif(owner.business_name, ''), nullif(owner.display_name, ''), 'Owner account') as company_name,
        request.id::text as request_id,
        request.status as request_status,
        case when request.status = 'approved' then coalesce(nullif(owner.business_name, ''), nullif(owner.display_name, ''), 'Aim4price owner') else null end as contact_name,
        case when request.status = 'approved' then owner.phone else null end as contact_phone,
        case when request.status = 'approved' then owner.marketplace_email else null end as contact_email,
        case when request.status = 'approved' then concat_ws(', ', nullif(owner.town_city, ''), nullif(owner.province, '')) else null end as contact_location,
        request.created_at::text as requested_at,
        request.updated_at::text as updated_at
      from account_profiles owner
      left join account_contact_requests request
        on request.owner_user_id = owner.user_id
       and request.requester_user_id = $1
      where owner.account_type = 'owner'
        and owner.user_id <> $1
      order by coalesce(nullif(owner.business_name, ''), nullif(owner.display_name, ''), 'Owner account') asc
      limit 500
    `,
    [requesterUserId],
  );

  return result.rows.map(mapOwnerDirectoryRow);
}

export async function createContactDetailRequest(input: {
  requesterUserId: string;
  ownerUserId: string;
}): Promise<OwnerDirectoryEntry> {
  await ensureContactRequestTables();

  if (!asText(input.ownerUserId) || !asText(input.requesterUserId) || input.ownerUserId === input.requesterUserId) {
    throw new Error('CONTACT_REQUEST_INVALID');
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

  await db.query(
    `
      insert into account_contact_requests (
        owner_user_id,
        requester_user_id,
        status,
        created_at,
        updated_at
      )
      values ($1, $2, 'pending', now(), now())
      on conflict (owner_user_id, requester_user_id)
      do update set
        status = case
          when account_contact_requests.status = 'approved' then 'approved'
          else 'pending'
        end,
        denied_at = case
          when account_contact_requests.status = 'approved' then account_contact_requests.denied_at
          else null
        end,
        updated_at = now()
    `,
    [input.ownerUserId, input.requesterUserId],
  );

  const owners = await listOwnerDirectoryForRequester(input.requesterUserId);
  const owner = owners.find((entry) => entry.ownerUserId === input.ownerUserId);

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
        case r.status when 'pending' then 0 when 'approved' then 1 else 2 end,
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

export async function updateContactDetailRequestStatus(input: {
  ownerUserId: string;
  requestId: string;
  status: Exclude<ContactRequestStatus, 'pending'>;
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

  await db.query(
    `
      update account_contact_requests
      set status = $1,
          approved_at = case when $1 = 'approved' then coalesce(approved_at, now()) else approved_at end,
          denied_at = case when $1 = 'denied' then coalesce(denied_at, now()) else denied_at end,
          updated_at = now()
      where id = $2::uuid
    `,
    [status, input.requestId],
  );

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
