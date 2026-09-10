import { NextResponse } from 'next/server';
import { currentPushIdentity, resolvePushAccess } from '../../../../../lib/push-access';
import { isTrustedNotificationRequest } from '../../../../../lib/notification-request-origin';
import { updateAssetDiscoveryOwnerDecision } from '../../../../../lib/asset-discovery';
export async function PATCH(request:Request,{params}:{params:{enquiryId:string}}){
  if(!isTrustedNotificationRequest(request))return NextResponse.json({ok:false,error:'Open notifications from Aim4price.'},{status:403});
  const who=await currentPushIdentity();
  if(!who||who.app!=='owner'||!(await resolvePushAccess(who))?.admin)return NextResponse.json({ok:false,error:'An owner manager must approve this enquiry.'},{status:403});
  if(!/^[0-9a-f-]{36}$/i.test(params.enquiryId))return NextResponse.json({ok:false,error:'Enquiry not found.'},{status:404});
  try{const raw=await request.text();if(raw.length>512)throw Error();const body=JSON.parse(raw);if(!['yes','no'].includes(body.decision))throw Error();
    await updateAssetDiscoveryOwnerDecision({enquiryId:params.enquiryId,ownerUserId:who.accountId,decision:body.decision});
    return NextResponse.json({ok:true},{headers:{'Cache-Control':'private, no-store'}});
  }catch{return NextResponse.json({ok:false,error:'This enquiry is unavailable or has already been decided. Refresh to check.'},{status:400});}
}
