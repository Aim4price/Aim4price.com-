import { NextRequest, NextResponse } from 'next/server';
import { currentAppRealm } from './app-realm-server';
import { getOwnerAppAccess, ownerAppCan, type OwnerAppAccess } from './owner-app-access';
import { requireActiveFieldManagerSession } from './field-manager-session';
import { fieldManagerCan } from './field-manager';
import { getServerSession, isDealerAppSession } from './auth-session';
import { getAccountProfile } from './account-profile';
import { dealerRoleCan } from './dealer-app-access';
import { isMiddlemanAccountSubtype } from './middleman-account';
import { isTrustedNotificationRequest } from './notification-request-origin';
export type OfflineApp = 'owner' | 'field' | 'dealer' | 'middleman';
export const offlineHeaders = { 'Cache-Control': 'private, no-store' };
export type OfflineAccess = {
  app: OfflineApp; identity: string; userId: string; actorId: string; displayName: string;
  managerId?: string; owner?: OwnerAppAccess;
  canWork: boolean; canFuel: boolean; canRefill: boolean; canShowroom: boolean; canLeads: boolean;
};
export function offlineError(error: string, status = 400) {
  return NextResponse.json({ ok: false, error }, { status, headers: offlineHeaders });
}
export async function requireAppOfflineAccess(request: NextRequest, app: string): Promise<
  { ok: true; access: OfflineAccess } | { ok: false; response: NextResponse }
> {
  const deny = (message: string, status: number) => ({ ok: false as const, response: offlineError(message, status) });
  if (!['owner', 'field', 'dealer', 'middleman'].includes(app) || await currentAppRealm() !== app) return deny('Open offline work from the correct app.', 403);
  let access: OfflineAccess;
  const defaults = { canWork: false, canFuel: false, canRefill: false, canShowroom: false, canLeads: false };
  if (app === 'field') {
    const auth = await requireActiveFieldManagerSession(request);
    if (!auth.ok) return deny(auth.error, auth.status);
    const s = auth.session;
    const [canWork, canFuel, canRefill] = await Promise.all(['record_work', 'record_fuel', 'refill_fuel'].map(p => fieldManagerCan(s.managerId, p as 'record_work' | 'record_fuel' | 'refill_fuel')));
    access = { ...defaults, app, identity: `${s.ownerUserId}:${s.managerId}`, userId: s.ownerUserId, actorId: s.managerId, managerId: s.managerId, displayName: s.displayName, canWork, canFuel, canRefill };
  } else if (app === 'owner') {
    const owner = await getOwnerAppAccess();
    if (!owner) return deny('Sign in to the Owner App to sync.', 401);
    access = { ...defaults, app, identity: `owner:${owner.ownerUserId}:${owner.viewerKey}`, userId: owner.ownerUserId, actorId: owner.ownerAppUserId || owner.ownerUserId, displayName: owner.displayName, owner,
      canWork: ownerAppCan(owner, 'operate'), canFuel: ownerAppCan(owner, 'operate'), canRefill: ownerAppCan(owner, 'operate') };
  } else {
    const session = await getServerSession({ allowDealerApp: true });
    if (!session?.user?.id) return deny('Sign in to the account that prepared offline work.', 401);
    const profile = await getAccountProfile({ id: session.user.id });
    if (profile.accountType !== 'dealer' || profile.accountStatus !== 'active' || isMiddlemanAccountSubtype(profile.accountSubtype) !== (app === 'middleman')) return deny('This account cannot use this app.', 403);
    const staff = isDealerAppSession(session) ? session.dealerApp : null;
    const role = staff?.role || 'owner';
    access = { ...defaults, app: app as OfflineApp, userId: session.user.id, actorId: staff?.staffId || session.user.id,
      identity: `${app}:${session.user.id}:${staff?.staffId || 'account'}`, displayName: staff?.displayName || profile.businessName || profile.displayName || 'Account',
      canWork: app === 'dealer' && dealerRoleCan(role, 'maintenance'), canShowroom: dealerRoleCan(role, 'showroom'), canLeads: app === 'dealer' && dealerRoleCan(role, 'leads') };
  }
  if (request.method !== 'GET') {
    if (!isTrustedNotificationRequest(request)) return deny('Open offline work from Aim4price.', 403);
    if (request.headers.get('x-aim4price-offline-identity') !== access.identity) return deny('Sign in to the account that saved this work. Nothing was sent.', 409);
  }
  return { ok: true, access };
}

/** Existing scan screens can queue a lost-signal save, but may replay only as its original actor. */
export async function verifyOfflineReplayIdentity(request: NextRequest): Promise<NextResponse | null> {
  if (!request.headers.has('x-aim4price-offline-identity')) return null;
  const realm = await currentAppRealm();
  const auth = await requireAppOfflineAccess(request, realm || '');
  return auth.ok ? null : auth.response;
}
