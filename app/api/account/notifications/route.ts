import { isTrustedNotificationRequest } from '../../../../lib/notification-request-origin';
import { NextResponse } from 'next/server';
import { desktopNotificationAccount } from '../../../../lib/desktop-notification-access';
import { accountPushPreferences, saveAccountPushPreferences } from '../../../../lib/push-store';
import { parsePushPreferences } from '../../../../lib/push-policy';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const json = (body: object, status=200) => NextResponse.json(body,{status,headers:{'Cache-Control':'private, no-store'}});
export async function GET() {
  const who = await desktopNotificationAccount();
  if (!who) return json({ok:false,error:'Please sign in to your desktop account.'},401);
  try { return json({ok:true,app:who.app,categories:who.categories,...await accountPushPreferences(who.app,who.accountId)}); }
  catch { return json({ok:false,error:'Could not load notification settings.'},503); }
}
export async function POST(request: Request) {
  if (!isTrustedNotificationRequest(request)) return json({ok:false,error:'Please reload the page.'},403);
  if (Number(request.headers.get('content-length') || 0)>4096) return json({ok:false,error:'Request too large.'},413);
  const who = await desktopNotificationAccount();
  if (!who) return json({ok:false,error:'Please sign in to your desktop account.'},401);
  try {
    const raw = await request.text();
    if (raw.length>4096) return json({ok:false,error:'Request too large.'},413);
    const body = JSON.parse(raw);
    if (typeof body.enabled !== 'boolean' || Object.keys(body).some(key=>key!=='enabled'&&key!=='preferences')) return json({ok:false,error:'Choose your notifications.'},400);
    const preferences = parsePushPreferences(body.preferences);
    await saveAccountPushPreferences(who.app,who.accountId,{enabled:body.enabled,preferences});
    return json({ok:true});
  } catch { return json({ok:false,error:'Could not save notification settings. Please try again.'},400); }
}
