import { NextRequest, NextResponse } from 'next/server';
import { getAnyServerSession } from '../../../../lib/auth-session';
import { findDealerStaffForLogin, markDealerStaffLogin, verifyDealerPassword } from '../../../../lib/dealer-app';
import { createDealerAppToken, DEALER_APP_COOKIE, DEALER_APP_MAX_AGE } from '../../../../lib/dealer-app-session';
import { getAccountProfile } from '../../../../lib/account-profile';
export const runtime='nodejs'; export const dynamic='force-dynamic';
const attempts=new Map<string,{count:number;reset:number}>();
function key(req:NextRequest,u:string){return `${req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()||'unknown'}:${u}`}
export async function POST(req:NextRequest){
  if((await getAnyServerSession())?.user?.id) return NextResponse.json({ok:false,error:'Sign out of the current Aim4price account before using a staff login.'},{status:409});
  let body:any; try{body=await req.json()}catch{return NextResponse.json({ok:false,error:'Incorrect username or password.'},{status:400})}
  const username=String(body?.username||'').trim().toLowerCase(); const password=String(body?.password||''); const k=key(req,username); const now=Date.now();
  const state=attempts.get(k); if(state&&state.reset>now&&state.count>=8) return NextResponse.json({ok:false,error:'Too many attempts. Try again later.'},{status:429});
  if(!state||state.reset<=now) attempts.set(k,{count:1,reset:now+15*60_000}); else state.count++;
  const row=await findDealerStaffForLogin(username); const valid=Boolean(row&&row.is_active&&await verifyDealerPassword(password,row.password_hash));
  if(!valid) return NextResponse.json({ok:false,error:'Incorrect username or password.'},{status:401});
  const profile=await getAccountProfile({id:row!.dealer_user_id,name:null,email:null});
  if(profile.accountType!=='dealer'||profile.accountStatus!=='active') return NextResponse.json({ok:false,error:'Incorrect username or password.'},{status:401});
  await markDealerStaffLogin(row!.id); attempts.delete(k);
  const token=createDealerAppToken({staffId:row!.id,dealerUserId:row!.dealer_user_id,displayName:row!.display_name,username:row!.username,version:Number(row!.session_version)});
  const res=NextResponse.json({ok:true,redirectTo:'/dealer'}); res.cookies.set(DEALER_APP_COOKIE,token,{httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'lax',path:'/',maxAge:DEALER_APP_MAX_AGE}); return res;
}
