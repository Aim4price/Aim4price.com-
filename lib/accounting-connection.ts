import { randomUUID } from 'node:crypto';
import { notFound } from 'next/navigation';
import { getDb } from './db';
import { accountingOwner } from './accounting-owner';
import { cloudConfig, exchange, isProvider, type Config, type Grant, type Company } from './accounting-cloud';
import { seal, unseal } from './sage-za-api';

export async function cloudOwner(provider: string) {
  const owner = await accountingOwner();
  if (!isProvider(provider)) notFound();
  const config = cloudConfig(provider);
  if (!config) notFound();
  return {owner,config};
}
type Context = {owner:string;config:Config};
type Row = {id:string;company_id:string|null;company_name:string|null;cipher:string};
async function db() {
  const pool = getDb();
  await pool.query(`create table if not exists public.accounting_cloud_connections(
    owner_id text not null references public."user"(id) on delete cascade,
    provider text not null, id uuid not null, cipher text not null, company_id text, company_name text,
    primary key(owner_id,provider))`);
  return pool;
}
function purpose(ctx:Context,id:string) {return [ctx.config.provider,ctx.owner,id].join('/');}
export async function current(ctx:Context) {
  const pool=await db();
  return (await pool.query<Omit<Row,'cipher'>>('select id,company_id,company_name from public.accounting_cloud_connections where owner_id=$1 and provider=$2',
    [ctx.owner,ctx.config.provider])).rows[0];
}
export async function saveGrant(ctx:Context,grant:Grant) {
  const pool=await db();
  const id=randomUUID();
  await pool.query('insert into public.accounting_cloud_connections(owner_id,provider,id,cipher) values($1,$2,$3,$4) on conflict do nothing',
    [ctx.owner,ctx.config.provider,id,seal(JSON.stringify(grant),purpose(ctx,id),ctx.config.key)]);
}
export async function validGrant(ctx:Context,id:string):Promise<Grant> {
  const client=await (await db()).connect();
  const params=[ctx.owner,ctx.config.provider,id];
  try {
    await client.query('begin');
    const row=(await client.query<Row>('select cipher from public.accounting_cloud_connections where owner_id=$1 and provider=$2 and id=$3 for update',params)).rows[0];
    if(!row) throw new Error('Connection changed.');
    let grant:Grant=JSON.parse(unseal(row.cipher,purpose(ctx,id),ctx.config.key));
    if(grant.expires<Date.now()+60000) {
      grant=await exchange(ctx.config,{refresh_token:grant.refresh},grant.realm,grant.dc);
      await client.query('update public.accounting_cloud_connections set cipher=$4 where owner_id=$1 and provider=$2 and id=$3',
        [...params,seal(JSON.stringify(grant),purpose(ctx,id),ctx.config.key)]);
    }
    await client.query('commit');
    return grant;
  } catch(error) {
    await client.query('rollback');
    throw error;
  } finally {client.release();}
}
export async function chooseCompany(ctx:Context,id:string,company:Company) {
  await (await db()).query('update public.accounting_cloud_connections set company_id=$4,company_name=$5 where owner_id=$1 and provider=$2 and id=$3 and company_id is null',
    [ctx.owner,ctx.config.provider,id,company.id,company.name]);
}
export async function forget(ctx:Context,id:string) {
  await (await db()).query('delete from public.accounting_cloud_connections where owner_id=$1 and provider=$2 and id=$3',[ctx.owner,ctx.config.provider,id]);
}
