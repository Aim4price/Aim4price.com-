import { currentAppRealm } from './app-realm-server';
import { getOwnerAppSession } from './owner-app-session';
import { getDealerAppSession } from './dealer-app-session';
import { getAccountProfile } from './account-profile';
import { getOwnerAppUserById, getOwnerAppAssetAccessSettings, resolveOwnerAppAccessibleAssetIds, normalizeOwnerAppAccessRole } from './owner-app';
import { getDealerStaffById, normalizeDealerStaffRole } from './dealer-app';
import { dealerRoleCan } from './dealer-app-access';
import { isMiddlemanAccountSubtype } from './middleman-account';
import type { PushIdentity } from './push-store';
import type { PushCategory } from './push-policy';
export async function currentPushIdentity(): Promise<PushIdentity | null> {
  const app = await currentAppRealm();
  if (app === 'field') {
    const { cookies } = await import('next/headers');
    const { NextRequest } = await import('next/server');
    const { getActiveFieldManagerSessionFromRequest } = await import('./field-manager-session');
    const session = await getActiveFieldManagerSessionFromRequest(new NextRequest('https://www.aim4price.com/api/field-manager/session', {
      headers: { cookie: cookies().toString() },
    }));
    return session ? { app, accountId: session.ownerUserId, memberId: session.managerId, version: session.sessionVersion } : null;
  }
  if (app === 'owner') {
    const session = await getOwnerAppSession();
    return session ? { app, accountId: session.parentOwnerUserId, memberId: session.ownerAppUserId, version: session.version } : null;
  }
  if (app === 'dealer' || app === 'middleman') {
    const session = await getDealerAppSession();
    return session ? { app, accountId: session.dealerUserId, memberId: session.staffId, version: session.version } : null;
  }
  return null;
}
// Called again by the background sender: permissions are never frozen at subscription time.
export async function resolvePushAccess(who: PushIdentity) {
  const profile = await getAccountProfile({ id: who.accountId, name: null, email: null });
  if (profile.accountStatus !== 'active') return null;
  if (who.app === 'field') {
    const { getFieldManagerById, listFieldManagerAssets } = await import('./field-manager');
    const manager = await getFieldManagerById(who.memberId);
    if (profile.accountType !== 'owner' || !manager?.isActive || manager.ownerUserId !== who.accountId || manager.sessionVersion !== who.version) return null;
    const assets = await listFieldManagerAssets(who.accountId, who.memberId);
    return { categories: ['maintenance', 'assignments'] as PushCategory[], allowedAssets: new Set(assets.map(asset => asset.id)),
      viewerKey: `field-manager:${who.memberId}`, admin: false };
  }
  if (who.app === 'owner') {
    const member = await getOwnerAppUserById(who.memberId);
    if (profile.accountType !== 'owner' || !member?.is_active || member.parent_owner_user_id !== who.accountId || Number(member.session_version) !== who.version) return null;
    const admin = normalizeOwnerAppAccessRole(member.access_role) === 'admin';
    const scope = await getOwnerAppAssetAccessSettings(who.accountId, who.memberId);
    const allowedAssets = !admin && scope.assetScope === 'selected'
      ? new Set(await resolveOwnerAppAccessibleAssetIds(who.accountId,who.memberId)) : null;
    const categories: PushCategory[] = admin ? ['maintenance','licensing','enquiries','approvals','costs','listings'] : ['maintenance','licensing'];
    return { categories, allowedAssets, viewerKey: `user:${who.memberId}`, admin };
  }
  const member = await getDealerStaffById(who.memberId);
  if (profile.accountType !== 'dealer' || isMiddlemanAccountSubtype(profile.accountSubtype) !== (who.app === 'middleman')
    || !member?.is_active || member.dealer_user_id !== who.accountId || Number(member.session_version) !== who.version) return null;
  const role = normalizeDealerStaffRole(member.staff_role);
  const categories: PushCategory[] = [];
  if (who.app === 'dealer' && dealerRoleCan(role,'maintenance')) categories.push('maintenance','assignments');
  if (dealerRoleCan(role,'discovery')) categories.push('enquiries');
  if (dealerRoleCan(role,'marketplace')) categories.push('listings');
  return { categories, allowedAssets: null, viewerKey: `dealer-staff:${who.memberId}`, admin: role === 'owner',
    canLead: who.app === 'dealer' && dealerRoleCan(role,'leads'),
    canSource: dealerRoleCan(role,'marketplace'), canDiscover: dealerRoleCan(role,'discovery') };
}

