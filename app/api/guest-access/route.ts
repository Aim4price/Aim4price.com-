import { NextRequest } from 'next/server';
import { businessError,businessJson,requireBusinessOrigin } from '../../../lib/business-network-api';
import { GUEST_COOKIE,getGuestViewer,endGuestSession } from '../../../lib/guest-business-access';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function GET(){return businessJson({guest:await getGuestViewer()});}
export async function POST(request:NextRequest){
 try { requireBusinessOrigin(request); return businessJson({error:'Guest sign-in has been replaced by free accounts.',signupUrl:'/business/join'},410); }
 catch(error){return businessError(error);}
}
export async function DELETE(request:NextRequest){try{requireBusinessOrigin(request);await endGuestSession();const response=businessJson({ok:true});response.cookies.set(GUEST_COOKIE,'',{httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'lax',path:'/',maxAge:0});return response;}catch(error){return businessError(error);}}
