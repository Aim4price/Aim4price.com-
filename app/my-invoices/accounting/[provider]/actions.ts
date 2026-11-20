'use server';
import { randomBytes } from 'node:crypto';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { authorize, cloudPath, companies } from '../../../../lib/accounting-cloud';
import { cloudOwner, current, validGrant, chooseCompany, forget } from '../../../../lib/accounting-connection';
import { seal } from '../../../../lib/sage-za-api';

export async function start(p:string) {
  const ctx=await cloudOwner(p);
  if(await current(ctx)) redirect(cloudPath(ctx.config.provider));
  const state=randomBytes(32).toString('hex');
  cookies().set('__Host-accounting-'+p,seal(JSON.stringify({state,until:Date.now()+600000}),p+'/'+ctx.owner,ctx.config.key),
    {secure:true,httpOnly:true,sameSite:'lax',path:'/',maxAge:600});
  redirect(authorize(ctx.config,state));
}
export async function choose(p:string,id:string,form:FormData) {
  const ctx=await cloudOwner(p);
  const path=cloudPath(ctx.config.provider);
  try {
    const allowed=await companies(ctx.config,await validGrant(ctx,id));
    const selected=allowed.find(c=>c.id===form.get('company'));
    if(!selected) throw new Error('Invalid company.');
    await chooseCompany(ctx,id,selected);
  } catch {redirect(path+'?error=1');}
  redirect(path);
}
export async function unlink(p:string,id:string) {
  const ctx=await cloudOwner(p);
  await forget(ctx,id);
  cookies().delete('__Host-accounting-'+p);
  redirect(cloudPath(ctx.config.provider));
}
