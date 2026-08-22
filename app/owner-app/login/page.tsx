import { redirect } from 'next/navigation';
import { getAccountProfile } from '../../../lib/account-profile';
import { getAnyServerSession } from '../../../lib/auth-session';
import { getOwnerAppSession } from '../../../lib/owner-app-session';
import OwnerAppLoginClient from './owner-app-login-client';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type OwnerAppLoginPageProps = {
  searchParams?: { install?: string | string[] };
};

function isInstallHandoff(searchParams?: OwnerAppLoginPageProps['searchParams']): boolean {
  const install = searchParams?.install;
  return Array.isArray(install) ? install.includes('1') : install === '1';
}

export default async function OwnerAppLoginPage({ searchParams }: OwnerAppLoginPageProps) {
  const forceInstallHandoff = isInstallHandoff(searchParams);
  const accountSession = await getAnyServerSession();
  if (accountSession?.user?.id) {
    const profile = await getAccountProfile({ id: accountSession.user.id, name: accountSession.user.name, email: accountSession.user.email });
    if (profile.accountType === 'owner' && profile.accountStatus === 'active' && !forceInstallHandoff) redirect('/owner-app');
    return <OwnerAppLoginClient hasAccountSession />;
  }
  if (await getOwnerAppSession()) {
    if (!forceInstallHandoff) redirect('/owner-app');
    return <OwnerAppLoginClient />;
  }
  return <OwnerAppLoginClient />;
}
