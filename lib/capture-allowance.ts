import type { PoolClient } from 'pg';
import { getDb } from './db';

export type AllowanceType = 'invoice' | 'fuel_slip';
export const DAILY_CAPTURE_LIMIT = 10;
export const CAPTURE_LIMIT_CODE = 'CAPTURE_DAILY_LIMIT';
// Retained independently of a request: retracting a submission cannot reset its allowance.
export const CAPTURE_ALLOWANCE_SCHEMA = `
create table if not exists public.capture_daily_usage (
  request_id uuid primary key,
  owner_user_id text not null references public."user"(id) on delete cascade,
  request_type text not null check (request_type in ('invoice', 'fuel_slip')),
  usage_day date not null default ((now() at time zone 'Africa/Johannesburg')::date)
);
create index if not exists capture_daily_usage_account_day
  on public.capture_daily_usage(owner_user_id, request_type, usage_day);
create table if not exists public.capture_assistance_requests (
  id uuid primary key default gen_random_uuid(),
  owner_user_id text not null references public."user"(id) on delete cascade,
  actor_user_id text not null references public."user"(id) on delete cascade,
  request_type text not null check (request_type in ('invoice', 'fuel_slip')),
  usage_day date not null default ((now() at time zone 'Africa/Johannesburg')::date),
  shown_at timestamptz not null default now(),
  requested_at timestamptz,
  note text not null default '',
  resolved_at timestamptz,
  unique(owner_user_id, actor_user_id, request_type, usage_day)
);
`;
let schemaReady: Promise<void> | undefined;
export function ensureCaptureAllowanceSchema(): Promise<void> {
  if (!schemaReady) schemaReady = getDb().query(CAPTURE_ALLOWANCE_SCHEMA).then(() => undefined)
    .catch(error => { schemaReady = undefined; throw error; });
  return schemaReady;
}
export async function getCaptureAllowance(ownerUserId: string, type: AllowanceType, bypass = false) {
  await ensureCaptureAllowanceSchema();
  const result = await getDb().query(`select count(*)::integer as used,
    (((now() at time zone 'Africa/Johannesburg')::date + 1)::timestamp at time zone 'Africa/Johannesburg') as resets_at
    from public.capture_daily_usage where owner_user_id = $1 and request_type = $2
    and usage_day = (now() at time zone 'Africa/Johannesburg')::date`, [ownerUserId, type]);
  const used = Number(result.rows[0].used);
  return { used, limit: DAILY_CAPTURE_LIMIT, remaining: Math.max(0, DAILY_CAPTURE_LIMIT - used),
    blocked: !bypass && used >= DAILY_CAPTURE_LIMIT, bypass, resetsAt: new Date(result.rows[0].resets_at).toISOString() };
}
// Called inside the request creation transaction. The lock serializes concurrent submissions
// from all devices and all contributors to this account, separately for each ledger.
export async function reserveCaptureAllowance(client: PoolClient, ownerUserId: string, type: AllowanceType, requestId: string) {
  await client.query(`select pg_advisory_xact_lock(hashtextextended($1, 0))`, [`capture-allowance:${ownerUserId}:${type}`]);
  const result = await client.query(`select count(*)::integer as used from public.capture_daily_usage
    where owner_user_id = $1 and request_type = $2
    and usage_day = (now() at time zone 'Africa/Johannesburg')::date`, [ownerUserId, type]);
  if (Number(result.rows[0].used) >= DAILY_CAPTURE_LIMIT) throw new Error(CAPTURE_LIMIT_CODE);
  await client.query(`insert into public.capture_daily_usage(request_id, owner_user_id, request_type)
    values ($1::uuid, $2, $3)`, [requestId, ownerUserId, type]);
}
export async function releaseFailedCaptureAllowance(requestId: string) {
  await getDb().query('delete from public.capture_daily_usage where request_id = $1::uuid', [requestId]);
}
export async function recordCaptureAssistance(ownerUserId: string, actorUserId: string, type: AllowanceType, requestHelp: boolean, note = '') {
  await ensureCaptureAllowanceSchema();
  const result = await getDb().query(`insert into public.capture_assistance_requests
    (owner_user_id, actor_user_id, request_type, requested_at, note)
    values ($1, $2, $3, case when $4 then now() else null end, $5)
    on conflict (owner_user_id, actor_user_id, request_type, usage_day) do update set
      requested_at = case when $4 then coalesce(capture_assistance_requests.requested_at, now()) else capture_assistance_requests.requested_at end,
      note = case when $4 then $5 else capture_assistance_requests.note end,
      resolved_at = case when $4 and capture_assistance_requests.requested_at is null then null else capture_assistance_requests.resolved_at end
    returning id`, [ownerUserId, actorUserId, type, requestHelp, note.slice(0, 1000)]);
  return result.rows[0].id as string;
}
