import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { currentPushIdentity, resolvePushAccess } from '../../../lib/push-access';
import { getPushDevice, pushKeys, memberPushPreferences, accountPushPreferences, savePushPreferences, registerPushDevice, removePushDevice, sendPhonePush } from '../../../lib/push-store';
import { parsePushPreferences, validatePushSubscription, PUSH_APPS } from '../../../lib/push-policy';
import { getDb } from '../../../lib/db';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const json = (body: object, status=200) => NextResponse.json(body,{ status, headers: { 'Cache-Control': 'private, no-store' } });
export async function GET() {
  const who = await currentPushIdentity();
  if (!who) return json({ ok:false,error:'Please sign in to your app.' },401);
  const access = await resolvePushAccess(who);
  if (!access) return json({ ok:false,error:'Please sign in to your app.' },401);
  try {
    const device = await getPushDevice(who,cookies().get(`aim4price_push_${who.app}`)?.value);
    return json({ ok:true, app:who.app, categories:access.categories, preferences:await memberPushPreferences(who), accountSettings:await accountPushPreferences(who.app,who.accountId),
      enabled: Boolean(device?.enabled), deviceId:device?.id ?? null, publicKey:(await pushKeys()).public_key });
  } catch { return json({ ok:false,error:'Could not load notification settings. Please try again.' },503); }
}
export async function POST(request: Request) {
  if (request.headers.get('origin') !== new URL(request.url).origin) return json({ok:false,error:'Please reload the app.'},403);
  if (Number(request.headers.get('content-length') || 0) > 8192) return json({ok:false,error:'Request too large.'},413);
  const who = await currentPushIdentity();
  if (!who || !await resolvePushAccess(who)) return json({ok:false,error:'Please sign in to your app.'},401);
  const cookieName = `aim4price_push_${who.app}`;
  const id = cookies().get(cookieName)?.value;
  try {
    const raw = await request.text();
    if (raw.length > 8192) return json({ok:false,error:'Request too large.'},413);
    const body = JSON.parse(raw);
    if (body.action === 'preferences') {
      await savePushPreferences(who,parsePushPreferences(body.preferences));
    } else if (body.action === 'enable') {
      const subscription = validatePushSubscription(body.subscription);
      const deviceId = await registerPushDevice(who,subscription);
      const response = json({ok:true,deviceId});
      response.cookies.set(cookieName,deviceId,{httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'strict',path:'/',maxAge:60*60*24*30});
      return response;
    } else if (body.action === 'disable') {
      const device = await getPushDevice(who,id);
      if (device) await removePushDevice(who.app,id);
      const response = json({ok:true});
      response.cookies.set(cookieName,'',{httpOnly:true,path:'/',maxAge:0});
      return response;
    } else if (body.action === 'test') {
      if (!(await accountPushPreferences(who.app,who.accountId)).enabled) return json({ok:false,error:'Phone notifications are turned off for this account.'},400);
      const device = await getPushDevice(who,id);
      if (!device?.enabled) return json({ok:false,error:'Enable phone notifications first.'},400);
      const claimed = await getDb().query(`update app_push_devices set last_test_at=now() where id=$1
        and (last_test_at is null or last_test_at < now()-interval '30 seconds') returning id`,[device.id]);
      if (!claimed.rowCount) return json({ok:false,error:'Please wait 30 seconds before testing again.'},429);
      await sendPhonePush(device.subscription,{deviceId:device.id,title:PUSH_APPS[who.app].name,body:'Notifications are ready.',
        href:PUSH_APPS[who.app].root+'/notifications',icon:PUSH_APPS[who.app].icon,tag:who.app+':test'});
    } else return json({ok:false,error:'Choose a notification action.'},400);
    return json({ok:true});
  } catch { return json({ok:false,error:'Could not save notification settings. Please try again.'},400); }
}
