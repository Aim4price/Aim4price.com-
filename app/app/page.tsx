import { requireOwnerAppPageAccess } from '../../lib/owner-app-access';
import OwnerAppHomeClient from './owner-app-home-client';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export default async function OwnerAppHomePage() {
  const { session, profile } = await requireOwnerAppPageAccess();

  return (
    <OwnerAppHomeClient
      displayName={profile.displayName || session.user.name || ''}
      businessName={profile.businessName || ''}
    />
  );
}
