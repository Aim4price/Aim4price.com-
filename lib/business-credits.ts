import type { PoolClient } from 'pg';
import { getDb } from './db';
import { ensureBusinessWorkspaceSchema, ensureBusinessMembership } from './business-workspaces';

export const MONTHLY_BUSINESS_CREDITS = 500;
export const creditLimitsActive = () => process.env.AIM4PRICE_BUSINESS_CREDIT_ENFORCEMENT === 'true';
export const CREDIT_SCHEMA = `
 ALTER TABLE business_workspaces ADD COLUMN IF NOT EXISTS upgrade_requested_at timestamptz,
 ADD COLUMN IF NOT EXISTS paid_since timestamptz, ADD COLUMN IF NOT EXISTS activated_by text;
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
 CREATE INDEX IF NOT EXISTS business_credit_month ON business_credit_events(business_id,created_at);
`;
let ready: Promise<void> | undefined;
export function ensureCreditSchema() {
  return ready ??= ensureBusinessWorkspaceSchema().then(() => getDb().query(CREDIT_SCHEMA)).then(() => {}).catch(e => { ready = undefined; throw e; });
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
export async function workspaceForCredits(db: PoolClient, userId: string) {
  const member = await ensureBusinessMembership(db,userId);
  if (!member) throw Error('This Business workspace is unavailable.');
  const row = (await db.query('SELECT id,paid_since,upgrade_requested_at FROM business_workspaces WHERE id=$1 FOR UPDATE',[member.business_id])).rows[0];
  return {...member,...row};
}
export async function creditBalance(db: PoolClient, businessId: string) {
  return (await db.query(`SELECT coalesce(sum(units) FILTER (WHERE state='complete'),0)::int AS used,
    coalesce(sum(units) FILTER (WHERE state='reserved' AND expires_at>now()),0)::int AS held,
    ((${monthStart} + interval '1 month') AT TIME ZONE 'Africa/Johannesburg') AS resets
    FROM business_credit_events WHERE business_id=$1 AND ${monthFilter}`,[businessId])).rows[0];
}
type CreditInput = {userId:string; action:'manage'|'send'|'share'; requestId:string; token:string; assetKey:string;visitId?:string};
export async function recordCredit(db: PoolClient,input: CreditInput, phase:'complete'|'reserve'|'cancel'|'close'='complete') {
  const workspace=await workspaceForCredits(db,input.userId);
  const keys=[workspace.id,input.userId,input.action,input.requestId];
  const match='business_id=$1 AND actor_id=$2 AND action=$3 AND request_id=$4';
  const event=(await db.query(`SELECT *, expires_at>now() AS valid FROM business_credit_events WHERE ${match}`,keys)).rows[0];
  if(event && (event.token!==input.token || event.asset_key!==input.assetKey)) throw Error('This action identifier is already in use.');
  if(phase==='cancel') {
    await db.query(`DELETE FROM business_credit_events WHERE ${match} AND state='reserved'`,keys);
    return;
  }
  if(phase==='close') {
    await db.query(`UPDATE business_credit_events SET closed_at=now() WHERE ${match} AND closed_at IS NULL`,keys);
    return;
  }
  if(event?.state==='complete'){
    if(input.action==='manage'&&event.closed_at)throw Error('This Manage visit has ended. Please reopen Manage.');
    return;
  }
  if(phase==='complete' && input.action==='share') {
    if(!event?.valid) throw Error('This sharing reservation expired. Reopen Share to try again.');
    await db.query(`UPDATE business_credit_events SET state='complete',expires_at=NULL WHERE ${match}`,keys);
    return;
  }
  if(event?.valid) return;
  if(event) await db.query(`DELETE FROM business_credit_events WHERE ${match}`,keys);
  let included=false;
  if(input.visitId){
    const visit=await db.query(`SELECT 1 FROM business_credit_events WHERE business_id=$1 AND actor_id=$2 AND action='manage' AND request_id=$3
      AND token=$4 AND asset_key=$5 AND closed_at IS NULL AND created_at>now()-interval '12 hours'`,[workspace.id,input.userId,input.visitId,input.token,input.assetKey]);
    if(!visit.rows.length)throw Error('This Manage visit has ended. Reopen Manage to continue.');
    included=true;
  }
  const balance=await creditBalance(db,workspace.id);
  if(!included && !workspace.paid_since && creditLimitsActive() && balance.used+balance.held>=MONTHLY_BUSINESS_CREDITS) throw new CreditLimitError();
  await db.query(`INSERT INTO business_credit_events(business_id,actor_id,action,request_id,token,asset_key,state,units,expires_at)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8,CASE WHEN $7='reserved' THEN LEAST(now()+interval '30 minutes',((${monthStart}+interval '1 month') AT TIME ZONE 'Africa/Johannesburg')) END)`,
    [...keys,input.token,input.assetKey,phase==='reserve'?'reserved':'complete',workspace.paid_since||included?0:1]);
}
export async function creditHistory(db: PoolClient,businessId:string) {
  return (await db.query(`SELECT e.action,e.units,e.created_at,u.name FROM business_credit_events e
   LEFT JOIN "user" u ON u.id=e.actor_id WHERE business_id=$1 AND state='complete'
   ORDER BY created_at DESC,request_id DESC LIMIT 50`,[businessId])).rows;
}
export async function checkBusinessWrite(userId:string,token:string,assetKey?:string) {
  if(!creditLimitsActive()) return;
  await creditTransaction(async db=>{
    const workspace=await workspaceForCredits(db,userId);
    if(workspace.paid_since) return;
    const balance=await creditBalance(db,workspace.id);
    if(balance.used+balance.held<MONTHLY_BUSINESS_CREDITS) return;
    const visit=await db.query(`SELECT 1 FROM business_credit_events WHERE business_id=$1 AND actor_id=$2 AND token=$3
      AND ($4::text IS NULL OR asset_key=$4) AND action='manage' AND closed_at IS NULL AND created_at>now()-interval '12 hours' LIMIT 1`,[workspace.id,userId,token,assetKey??null]);
    if(!visit.rowCount) throw new CreditLimitError();
  });
}

export async function changeBusinessPlan(db:PoolClient, businessId:string, actorId:string, plan:'free'|'paid', pendingOnly=false) {
  const workspace=(await db.query('SELECT paid_since,upgrade_requested_at FROM business_workspaces WHERE id=$1 FOR UPDATE',[businessId])).rows[0];
  if (!workspace) throw Error('Business workspace unavailable.');
  if (Boolean(workspace.paid_since)===(plan==='paid')) return;
  if (pendingOnly && !workspace.upgrade_requested_at) throw Error('This upgrade is no longer pending.');
  await db.query(`UPDATE business_workspaces SET paid_since=CASE WHEN $2='paid' THEN now() END,
    activated_by=CASE WHEN $2='paid' THEN $3 END,upgrade_requested_at=NULL WHERE id=$1`,[businessId,plan,actorId]);
  await db.query('INSERT INTO business_plan_changes(business_id,actor_id,plan) VALUES($1,$2,$3)',[businessId,actorId,plan]);
}
