import { randomUUID } from 'node:crypto';
import { notFound } from 'next/navigation';
import { requireActivePageAccess } from './account-access';
import { getServerSession, isAdminSupportSession } from './auth-session';
import { getAccountProfile } from './account-profile';
import { getDb } from './db';
import { sageConfig, sageTokens, seal, unseal } from './sage-za-api';

export async function sageOwner() {
  const {session} = await requireActivePageAccess();
  const desktop = await getServerSession();
  const config = sageConfig();
  if (!config || !desktop || isAdminSupportSession(desktop) || desktop.user.id !== session.user.id ||
      session.user.id !== process.env.SAGE_ZA_PILOT_OWNER_ID || (await getAccountProfile(session.user)).accountType !== 'owner') notFound();
  return {owner: session.user.id, config};
}

export type SageOwner = Awaited<ReturnType<typeof sageOwner>>;
type Grant = Awaited<ReturnType<typeof sageTokens>>;
type Row = { connection_id: string; company_id: number | null; company_name: string | null; grant_cipher: string };

async function database() {
  const db = getDb();
  await db.query(`create table if not exists public.sage_za_connections (
    owner_id text primary key references public."user"(id) on delete cascade,
    connection_id uuid not null, company_id integer, company_name text, grant_cipher text not null
  )`);
  return db;
}

export async function saveAuthorisation({owner, config}: SageOwner, grant: Grant) {
  const id = randomUUID();
  const db = await database();
  await db.query(`insert into public.sage_za_connections(owner_id,connection_id,grant_cipher)
    values ($1,$2,$3) on conflict (owner_id) do nothing`, [owner,id,seal(JSON.stringify(grant),owner + '/' + id,config.key)]);
}

export async function connection(owner: string) {
  const db = await database();
  const result = await db.query<Pick<Row,'connection_id'|'company_id'|'company_name'>>(
    'select connection_id, company_id, company_name from public.sage_za_connections where owner_id=$1',[owner]);
  return result.rows[0];
}

export async function accessGrant({owner, config}: SageOwner, id: string) {
  const db = await database();
  const client = await db.connect();
  try {
    await client.query('begin');
    const result = await client.query<Row>('select * from public.sage_za_connections where owner_id=$1 and connection_id=$2 for update',[owner,id]);
    const row = result.rows[0];
    if (!row) throw new Error('Connection changed.');
    const purpose = owner + '/' + row.connection_id;
    let grant: Grant = JSON.parse(unseal(row.grant_cipher, purpose, config.key));
    if (!(grant.expires > Date.now() + 60000)) {
      grant = await sageTokens(config, {refresh_token:grant.refresh});
      await client.query('update public.sage_za_connections set grant_cipher=$2 where owner_id=$1',[owner,seal(JSON.stringify(grant),purpose,config.key)]);
    }
    await client.query('commit');
    return grant.access;
  } catch (error) {
    await client.query('rollback');
    throw error;
  } finally {
    client.release();
  }
}

export async function selectCompany(owner: string, id: string, company: {id: number; name: string}) {
  const db = await database();
  await db.query('update public.sage_za_connections set company_id=$3,company_name=$4 where owner_id=$1 and connection_id=$2 and company_id is null',
    [owner,id,company.id,company.name]);
}

export async function disconnect(owner: string, id: string) {
  const db = await database();
  await db.query('delete from public.sage_za_connections where owner_id=$1 and connection_id=$2',[owner,id]);
}
