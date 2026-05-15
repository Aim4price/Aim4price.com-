import { redirect } from 'next/navigation';
import AssetRegisterClient from '../../asset-register/asset-register-client';
import { getAccountProfile } from '../../../lib/account-profile';
import { getServerSession } from '../../../lib/auth-session';
import { canViewOwnerRegister } from '../../../lib/partner-access';

export const runtime = 'nodejs';

const PARTNER_ACCOUNT_TYPES = new Set(['dealer', 'finance', 'insurance']);

type SharedRegisterPageProps = {
  params: {
    ownerUserId: string;
  };
};

export default async function SharedRegisterOwnerPage({ params }: SharedRegisterPageProps) {
  const session = await getServerSession();

  if (!session) {
    redirect('/auth#signup');
  }

  const profile = await getAccountProfile({
    id: session.user.id,
    name: session.user.name,
    email: session.user.email,
  });

  if (!PARTNER_ACCOUNT_TYPES.has(profile.accountType)) {
    redirect('/asset-register');
  }

  const ownerUserId = decodeURIComponent(params.ownerUserId || '').trim();
  if (!ownerUserId) {
    redirect('/shared-registers');
  }

  const canView = await canViewOwnerRegister(session.user.id, ownerUserId);
  if (!canView) {
    redirect('/shared-registers');
  }

  return <AssetRegisterClient mode="shared" ownerUserId={ownerUserId} />;
}
