import { NextRequest } from 'next/server';
import { businessBody,businessError,businessJson,requireBusinessOrigin } from '../../../lib/business-network-api';
import { GUEST_COOKIE,startGuestLogin,verifyGuestLogin,getGuestViewer,endGuestSession } from '../../../lib/guest-business-access';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function GET(){return businessJson({guest:await getGuestViewer()});}
export async function POST(request:NextRequest){
 try{requireBusinessOrigin(request);const body=await businessBody(request),ip=request.headers.get('x-forwarded-for')||'unknown';
 if(body.action==='verify'){
 const token=await verifyGuestLogin(body.email,body.code,ip),response=businessJson({ok:true});
 response.cookies.set(GUEST_COOKIE,token,{httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'lax',path:'/',maxAge:30*86400});return response;
 }
 if(body.action!=='start')throw new Error('Choose a sign-in action.');
 await startGuestLogin(body,ip);return businessJson({ok:true});
 }catch(error){return businessError(error);}
}
export async function DELETE(request:NextRequest){try{requireBusinessOrigin(request);await endGuestSession();const response=businessJson({ok:true});response.cookies.set(GUEST_COOKIE,'',{httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'lax',path:'/',maxAge:0});return response;}catch(error){return businessError(error);}}
