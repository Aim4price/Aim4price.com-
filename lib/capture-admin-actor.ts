import { getServerSession, isAdminSupportSession } from './auth-session';
import { isAim4priceAdminEmail } from './account-constants';
import type { CaptureEventActor } from './capture-requests';

/** Only trusted server sessions may bypass capture limits; account staff roles cannot. */
export async function getCaptureAdminActor(): Promise<CaptureEventActor | null> {
  const session = await getServerSession({ requireActive: true, allowDealerApp: true, allowOwnerApp: true });
  if (!session?.user?.id) return null;
  if (isAdminSupportSession(session)) return { actorType: 'admin',
    userId: session.adminSupport.adminUserId, displayName: session.adminSupport.adminEmail || 'Aim4price Admin' };
  if (isAim4priceAdminEmail(session.user.email)) return { actorType: 'admin', userId: session.user.id,
    displayName: session.user.name || session.user.email || 'Aim4price Admin' };
  return null;
}
