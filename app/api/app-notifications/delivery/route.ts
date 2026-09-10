import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { currentAppRealm } from '../../../../lib/app-realm-server';
import { currentPushIdentity, resolvePushAccess } from '../../../../lib/push-access';
import { ensurePushTables, pushPreferences, accountPushPreferences, type PushIdentity } from '../../../../lib/push-store';
import { getDb } from '../../../../lib/db';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const reply = (body: object) => NextResponse.json(body, { headers: { 'Cache-Control': 'private, no-store' } });
export async function GET() {
  const app = await currentAppRealm();
  if (app !== 'owner' && app !== 'dealer' && app !== 'middleman') return reply({ enabled: false });
  // The unguessable HttpOnly device cookie is a limited delivery capability, not an account login.
  // This route returns only delivery flags; it cannot read inbox text or perform account actions.
  const id = cookies().get(`aim4price_push_${app}`)?.value;
  if (!id || !/^[0-9a-f-]{36}$/i.test(id)) return reply({ enabled: false });
  try {
    await ensurePushTables();
    const result = await getDb().query('select * from app_push_devices where id=$1 and app=$2 and enabled=true', [id,app]);
    const device = result.rows[0];
    if (!device) return reply({ enabled: false });
    const who: PushIdentity = { app, accountId:device.account_id, memberId:device.member_id, version:device.version };
    const signedIn = await currentPushIdentity();
    if (signedIn && (signedIn.accountId !== who.accountId || signedIn.memberId !== who.memberId || signedIn.version !== who.version)) return reply({ enabled: false });
    const access = await resolvePushAccess(who);
    if (!access || !(await accountPushPreferences(who.app,who.accountId)).enabled) return reply({ enabled: false });
    return reply({ app, enabled:true, deviceId:id, categories:access.categories, preferences:await pushPreferences(who) });
  } catch { return reply({ enabled: false }); }
}
