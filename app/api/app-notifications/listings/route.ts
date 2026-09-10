import { NextResponse } from 'next/server';
import { currentPushIdentity, resolvePushAccess } from '../../../../lib/push-access';
import { getListingWatch, saveListingWatch } from '../../../../lib/listing-alerts';
import { parseListingWatch } from '../../../../lib/listing-alert-policy';
import { isTrustedNotificationRequest } from '../../../../lib/notification-request-origin';
const json=(body:object,status=200)=>NextResponse.json(body,{status,headers:{'Cache-Control':'private, no-store'}});
export const dynamic='force-dynamic';
async function identity() {
  const who=await currentPushIdentity();
  return who && (await resolvePushAccess(who))?.categories.includes('listings') ? who : null;
}
export async function GET() {
  const who=await identity();
  if(!who)return json({ok:false,error:'Listing alerts are not available for this app user.'},403);
  try { return json({ok:true,watch:await getListingWatch(who)}); }
  catch { return json({ok:false,error:'Could not load listing alerts.'},503); }
}
export async function POST(request:Request) {
  if(!isTrustedNotificationRequest(request))return json({ok:false,error:'Open Marketplace from Aim4price.'},403);
  const who=await identity();
  if(!who)return json({ok:false,error:'Listing alerts are not available for this app user.'},403);
  let watch;
  try { const raw=await request.text();if(raw.length>4096)return json({ok:false,error:'Search details are too long.'},413);watch=parseListingWatch(JSON.parse(raw)); }
  catch(error){return json({ok:false,error:error instanceof Error?error.message:'Choose your listing interests.'},400);}
  try { await saveListingWatch(who,watch);return json({ok:true,watch}); }
  catch { return json({ok:false,error:'Could not save listing alerts. Please try again.'},503); }
}
