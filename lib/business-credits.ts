import type { PoolClient } from 'pg';
import { ensureSharingFoundation } from './sharing-foundation';
import { getDb } from './db';
import { ensureBusinessWorkspaceSchema, ensureBusinessMembership } from './business-workspaces';

export const MONTHLY_BUSINESS_CREDITS = 500;
export const creditLimitsActive = (enforced=false) => enforced || process.env.AIM4PRICE_BUSINESS_CREDIT_ENFORCEMENT === 'true';
export const CREDIT_SCHEMA = `
 ALTER TABLE business_workspaces ADD COLUMN IF NOT EXISTS upgrade_requested_at timestamptz, ADD COLUMN IF NOT EXISTS requested_plan jsonb,
 ADD COLUMN IF NOT EXISTS paid_since timestamptz, ADD COLUMN IF NOT EXISTS activated_by text;
 ALTER TABLE business_workspaces ADD COLUMN IF NOT EXISTS monthly_allowance integer NOT NULL DEFAULT 500, ADD COLUMN IF NOT EXISTS referral_reward integer NOT NULL DEFAULT 50;
 ALTER TABLE business_workspaces ADD COLUMN IF NOT EXISTS enforce_credits boolean NOT NULL DEFAULT false;
 ALTER TABLE business_workspaces ADD COLUMN IF NOT EXISTS owner_invite_id uuid DEFAULT gen_random_uuid();
 CREATE UNIQUE INDEX IF NOT EXISTS business_owner_invite ON business_workspaces(owner_invite_id);
 CREATE TABLE IF NOT EXISTS business_owner_referrals (
   owner_id text primary key references "user"(id) on delete cascade,
   business_id uuid not null references business_workspaces(id) on delete cascade,
   first_asset_at timestamptz, rewarded_at timestamptz, credits integer not null default 50
 );
 CREATE INDEX IF NOT EXISTS business_referral_balance ON business_owner_referrals(business_id,rewarded_at);
 CREATE TABLE IF NOT EXISTS business_plan_changes (
   id bigserial PRIMARY KEY, business_id uuid NOT NULL REFERENCES business_workspaces(id) ON DELETE CASCADE,
   actor_id text NOT NULL, plan text NOT NULL CHECK(plan IN ('free','paid')), changed_at timestamptz NOT NULL DEFAULT now()
 );
 CREATE TABLE IF NOT EXISTS business_credit_events (
   business_id uuid NOT NULL REFERENCES business_workspaces(id) ON DELETE CASCADE,
   actor_id text NOT NULL, action text NOT NULL CHECK(action IN ('manage','send','share')),
   request_id uuid NOT NULL, token text NOT NULL, asset_key text NOT NULL,
   created_at timestamptz NOT NULL DEFAULT now(), closed_at timestamptz,
   state text NOT NULL CHECK(state IN ('complete','reserved')), expires_at timestamptz,
   units smallint NOT NULL CHECK(units IN (0,1)),
   PRIMARY KEY(business_id,actor_id,action,request_id)
 );
 CREATE TABLE IF NOT EXISTS business_completed_actions (
   business_id uuid NOT NULL REFERENCES business_workspaces(id) ON DELETE CASCADE,
   result_key text NOT NULL, action text NOT NULL, actor_id text NOT NULL,
   created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(business_id,result_key)
 );
 CREATE TABLE IF NOT EXISTS business_credit_refills (
   business_id uuid NOT NULL REFERENCES business_workspaces(id) ON DELETE CASCADE,
   request_id uuid NOT NULL, actor_id text NOT NULL, units integer NOT NULL CHECK(units>=0),
   created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(business_id,request_id)
 );
 CREATE INDEX IF NOT EXISTS business_completed_month ON business_completed_actions(business_id,created_at);
 CREATE INDEX IF NOT EXISTS business_credit_month ON business_credit_events(business_id,created_at);
`;
let ready: Promise<void> | undefined;
export function ensureCreditSchema() {
  return ready ??= Promise.all([ensureBusinessWorkspaceSchema(),ensureSharingFoundation()]).then(() => getDb().query(CREDIT_SCHEMA)).then(() => {}).catch(e => { ready = undefined; throw e; });
}
export async function creditTransaction<T>(work: (db: PoolClient) => Promise<T>) {
  await ensureCreditSchema();
  const db = await getDb().connect();
  try {
    await db.query('BEGIN');
    const result = await work(db);
    await db.query('COMMIT');
    return result;
  } catch (error) { await db.query('ROLLBACK'); throw error; } finally { db.release(); }
}
const monthStart = "date_trunc('month',now() AT TIME ZONE 'Africa/Johannesburg')";
const monthFilter = `created_at >= (${monthStart} AT TIME ZONE 'Africa/Johannesburg')`;
export class CreditLimitError extends Error {
  constructor() { super('Your monthly Business credits have been used.'); }
}
export async function workspaceForCredits(db: Pick<PoolClient,'query'>, userId: string) {
  const member = await ensureBusinessMembership(db,userId);
  if (!member) throw Error('This Business workspace is unavailable.');
  const row = (await db.query(`SELECT w.id,w.owner_invite_id,w.monthly_allowance,w.referral_reward,w.enforce_credits,w.paid_since,w.upgrade_requested_at, EXISTS(SELECT 1 FROM account_profiles p WHERE p.user_id=w.owner_user_id AND p.account_type='dealer') AS desktop FROM business_workspaces w WHERE w.id=$1 FOR UPDATE`,[member.business_id])).rows[0];
  return {...member,...row};
}
export async function creditBalance(db: Pick<PoolClient,'query'>, businessId: string) {
  return (await db.query(`SELECT (select coalesce(sum(credits),0)::int from business_owner_referrals where business_id=$1 and rewarded_at>=(${monthStart} AT TIME ZONE 'Africa/Johannesburg')) as bonus, (coalesce(sum(units) FILTER (WHERE state='complete'),0) +
    (SELECT count(*) FROM business_completed_actions WHERE business_id=$1 AND ${monthFilter}) - (SELECT coalesce(sum(units),0) FROM business_credit_refills WHERE business_id=$1 AND ${monthFilter}))::int AS used,
    coalesce(sum(units) FILTER (WHERE state='reserved' AND expires_at>now()),0)::int AS held,
    ((${monthStart} + interval '1 month') AT TIME ZONE 'Africa/Johannesburg') AS resets
    FROM business_credit_events WHERE business_id=$1 AND ${monthFilter}`,[businessId])).rows[0];
}
/** Restore spent credits for this month without removing usage or referral history. */
export async function refillBusinessCredits(db: PoolClient, owner: string, actor: string, requestId: string) {
  const w = await workspaceForCredits(db,owner);
  const profile = (await db.query('SELECT account_type FROM account_profiles WHERE user_id=$1 FOR SHARE',[owner])).rows[0];
  if (w.role !== 'owner' || w.desktop || w.paid_since || profile?.account_type !== 'business') throw Error('Choose a Free Business account.');
  const balance = await creditBalance(db,w.id);
  await db.query(`INSERT INTO business_credit_refills(business_id,request_id,actor_id,units)
    VALUES($1,$2,$3,$4) ON CONFLICT(business_id,request_id) DO NOTHING`,[w.id,requestId,actor,balance.used]);
}
/** The caller owns the transaction that creates the result. */
export async function spendBusinessCredit(db: Pick<PoolClient,'query'>, userId:string, action:string, resultKey:string) {
  const profile = (await db.query('SELECT account_type FROM account_profiles WHERE user_id=$1',[userId])).rows[0];
  if (profile?.account_type !== 'business') return;
  const workspace = await workspaceForCredits(db,userId);
  if (workspace.desktop || workspace.paid_since) return;
  const existing = await db.query('SELECT 1 FROM business_completed_actions WHERE business_id=$1 AND result_key=$2',[workspace.id,resultKey]);
  if (existing.rows.length) return;
  const balance = await creditBalance(db,workspace.id);
  if (creditLimitsActive(workspace.enforce_credits) && balance.used + balance.held >= workspace.monthly_allowance + balance.bonus) throw new CreditLimitError();
  await db.query('INSERT INTO business_completed_actions(business_id,result_key,action,actor_id) VALUES($1,$2,$3,$4)',[workspace.id,resultKey,action,userId]);
}

/** Run a standalone save and its debit on the same connection. */
export async function saveBusinessResult<T>(
  userId:string, label:string,
  save:(writer:Pick<PoolClient,'query'>)=>Promise<T>,
  resultKey:(saved:T)=>string|null,
):Promise<T> {
  const db = getDb();
  const account = await db.query('SELECT account_type FROM account_profiles WHERE user_id=$1',[userId]);
  if (account.rows[0]?.account_type !== 'business') return save(db);
  return creditTransaction(async client => {
    const saved = await save(client);
    const key = resultKey(saved);
    if (key) await spendBusinessCredit(client,userId,label,key);
    return saved;
  });
}

export function maintenanceEntryDebit(userId: string, edit = false) {
  return {after: async (client: PoolClient, record: {id: string}) => {
    const key = edit ? crypto.randomUUID() : record.id;
    await spendBusinessCredit(client,userId,'Saved maintenance','maintenance-entry:' + key);
  }};
}

/** Each generated download is a separate action, even for identical report data. */
export async function recordBusinessReport(userId:string, kind:string) {
  const { randomUUID } = await import('node:crypto');
  await saveBusinessResult(userId, kind, async () => randomUUID(), id => 'report:' + id);
}

export async function creditHistory(db: PoolClient,businessId:string) {
  return (await db.query(`SELECT activity.*,u.name FROM (
    SELECT action,units,created_at,actor_id FROM business_credit_events WHERE business_id=$1 AND state='complete'
    UNION ALL
    SELECT action,1,created_at,actor_id FROM business_completed_actions WHERE business_id=$1
  ) activity LEFT JOIN "user" u ON u.id=activity.actor_id ORDER BY created_at DESC LIMIT 50`,[businessId])).rows;
}

export async function changeBusinessPlan(db:PoolClient, businessId:string, actorId:string, plan:'free'|'paid', pendingOnly=false) {
  const workspace=(await db.query('SELECT w.paid_since,w.upgrade_requested_at,w.owner_user_id,p.account_type,p.account_status FROM business_workspaces w JOIN account_profiles p ON p.user_id=w.owner_user_id WHERE w.id=$1 FOR UPDATE OF w,p',[businessId])).rows[0];
  if (!workspace) throw Error('Business workspace unavailable.');
  if (!['business','dealer'].includes(workspace.account_type)) throw Error('Select a Business account.');
  if (workspace.account_type === (plan==='paid'?'dealer':'business') && (plan==='paid'||!workspace.paid_since)) return;
  if (plan==='paid' && workspace.account_status!=='active') throw Error('Only an active Business account can be upgraded.');
  if (pendingOnly && !workspace.upgrade_requested_at) throw Error('This upgrade is no longer pending.');
  await db.query(`UPDATE business_workspaces SET paid_since=CASE WHEN $2='paid' THEN now() END,
    activated_by=CASE WHEN $2='paid' THEN $3 END,upgrade_requested_at=NULL,requested_plan=NULL WHERE id=$1`,[businessId,plan,actorId]);
  await db.query('UPDATE account_profiles SET account_type=$2,updated_at=now() WHERE user_id=$1',
    [workspace.owner_user_id,plan==='paid'?'dealer':'business']);
  await db.query(`INSERT INTO sharing_account_access(user_id,plan,updated_by) VALUES($1,$2,$3)
    ON CONFLICT(user_id) DO UPDATE SET plan=excluded.plan,updated_by=excluded.updated_by,updated_at=now()`,
    [workspace.owner_user_id,plan==='paid'?'desktop':'free',actorId]);
  await db.query('INSERT INTO business_plan_changes(business_id,actor_id,plan) VALUES($1,$2,$3)',[businessId,actorId,plan]);
}
