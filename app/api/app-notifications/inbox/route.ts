import { NextResponse } from 'next/server';
import { currentPushIdentity } from '../../../../lib/push-access';
import { listAppNotificationInbox, markAppNotificationsRead } from '../../../../lib/app-notification-inbox';
import { isTrustedNotificationRequest } from '../../../../lib/notification-request-origin';
const json = (body: object,status=200) => NextResponse.json(body,{status,headers:{'Cache-Control':'private, no-store'}});
export const dynamic='force-dynamic';
export async function GET() {
  const who=await currentPushIdentity();
  if (!who || who.app==='owner') return json({ok:false,error:'Please sign in to your app.'},401);
  try {
    const notifications=await listAppNotificationInbox(who);
    return json({ok:true,app:who.app,notifications,unreadCount:notifications.filter(item=>!item.isRead).length});
  } catch { return json({ok:false,error:'Could not load notifications. Please try again.'},503); }
}
export async function PATCH(request: Request) {
  if (!isTrustedNotificationRequest(request)) return json({ok:false,error:'Open notifications from Aim4price.'},403);
  const who=await currentPushIdentity();
  if (!who || who.app==='owner') return json({ok:false,error:'Please sign in to your app.'},401);
  try {
    const raw=await request.text();
    if(raw.length>16000) return json({ok:false,error:'Too many notifications.'},413);
    const body=JSON.parse(raw);
    if(body.action!=='mark_read'||!Array.isArray(body.notificationIds)||body.notificationIds.length>250
      ||body.notificationIds.some((id:unknown)=>typeof id!=='string'||id.length>500)) return json({ok:false,error:'Choose notifications to mark read.'},400);
    await markAppNotificationsRead(who,body.notificationIds);
    return json({ok:true});
  } catch { return json({ok:false,error:'Could not update notifications. Please try again.'},400); }
}
