'use server';
import { randomBytes } from 'node:crypto';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { sageAuthorize, sageCompanies, sagePage, seal } from '../../../lib/sage-za-api';
import { accessGrant, connection, disconnect, sageOwner, selectCompany } from '../../../lib/sage-za-connection';

export async function startSage() {
  const ctx = await sageOwner();
  if (await connection(ctx.owner)) redirect(sagePage);
  const state = randomBytes(32).toString('hex');
  cookies().set('__Host-sage-za-state', seal(JSON.stringify({state, until:Date.now()+600000}), 'oauth/'+ctx.owner, ctx.config.key),
    {httpOnly:true, sameSite:'lax', secure:true, path:'/', maxAge:600});
  redirect(sageAuthorize(ctx.config, state));
}

export async function chooseSage(form: FormData) {
  const ctx = await sageOwner();
  const current = await connection(ctx.owner);
  if (!current || current.company_id || current.connection_id !== form.get('connection')) redirect(sagePage);
  try {
    const access = await accessGrant(ctx, current.connection_id);
    const companies = await sageCompanies(ctx.config, access);
    const company = companies.find(item => String(item.id) === form.get('company'));
    if (!company) throw new Error('Invalid company.');
    await selectCompany(ctx.owner, current.connection_id, company);
  } catch {
    redirect(sagePage + '?error=1');
  }
  redirect(sagePage);
}

export async function removeSage(form: FormData) {
  const ctx = await sageOwner();
  const current = await connection(ctx.owner);
  if (current && current.connection_id === form.get('connection')) await disconnect(ctx.owner, current.connection_id);
  cookies().delete('__Host-sage-za-state');
  redirect(sagePage);
}

export async function enablePaidBills(form: FormData) {
  const {owner} = await sageOwner();
  const {listAssetRegisters} = await import('../../../lib/asset-registers');
  const {getDb} = await import('../../../lib/db');
  const register = (await listAssetRegisters(owner)).find(r => r.id === form.get('register'));
  const date = String(form.get('from'));
  if (!register || !/^\d{4}-\d{2}-\d{2}$/.test(date)) redirect(sagePage+'?error=1');
  await getDb().query(`update public.sage_za_connections set sync_register=$3, sync_from=$4
    where owner_id=$1 and connection_id=$2 and company_id is not null and sync_register is null`,
    [owner,form.get('connection'),register.id,date]);
  redirect(sagePage);
}
