import { NextRequest,NextResponse } from 'next/server';
import { cloudOwner,saveGrant } from '../../../../../lib/accounting-connection';
import { cloudPath,exchange } from '../../../../../lib/accounting-cloud';
import { unseal } from '../../../../../lib/sage-za-api';

export const dynamic='force-dynamic';
export async function GET(request:NextRequest,{params}:{params:{provider:string}}) {
  const ctx=await cloudOwner(params.provider);
  const p=ctx.config.provider;
  const cookie='__Host-accounting-'+p;
  const query=request.nextUrl.searchParams;
  let path=cloudPath(p);
  try {
    const state=JSON.parse(unseal(request.cookies.get(cookie)?.value||'',p+'/'+ctx.owner,ctx.config.key));
    const code=query.get('code');
    if(!code || !(state.until>Date.now()) || state.state!==query.get('state')) throw new Error('Invalid callback.');
    await saveGrant(ctx,await exchange(ctx.config,{code},query.get('realmId')||'',query.get('location')||'us'));
  } catch {path+='?error=1';}
  const res=NextResponse.redirect(new URL(path,ctx.config.origin),303);
  res.headers.set('Referrer-Policy','no-referrer');
  res.headers.set('Cache-Control','no-store');
  res.cookies.set(cookie,'',{secure:true,httpOnly:true,sameSite:'lax',path:'/',maxAge:0});
  return res;
}
