import type { Metadata } from 'next';
import { middlemanAppMetadata } from '../../../lib/middleman-app-metadata';
import { redirect } from 'next/navigation';
import { getAccountProfile } from '../../../lib/account-profile';
import { getAnyServerSession, getServerSession } from '../../../lib/auth-session';
import DealerLoginClient from '../../dealer/login/dealer-login-client';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type DealerLoginPageProps = {
  searchParams?: { install?: string | string[]; app?: string };
};

function isInstallHandoff(searchParams?: DealerLoginPageProps['searchParams']): boolean {
  const install = searchParams?.install;
  return Array.isArray(install) ? install.includes('1') : install === '1';
}

export default async function DealerLoginPage({ searchParams }: DealerLoginPageProps) {
  const middlemanMode = true;
  const forceInstallHandoff = isInstallHandoff(searchParams);
  const accountSession = await getAnyServerSession();

  if (accountSession?.user?.id) {
    const profile = await getAccountProfile({
      id: accountSession.user.id,
      name: accountSession.user.name,
      email: accountSession.user.email,
    });

    if (profile.accountType === 'dealer' && profile.accountStatus === 'active' && !forceInstallHandoff) {
      redirect('/middleman');
    }

    return <DealerLoginClient hasAccountSession middlemanMode={middlemanMode} />;
  }

  const dealerSession = await getServerSession({ allowDealerApp: true });
  if (dealerSession?.user?.id && !forceInstallHandoff) redirect('/middleman');

  return <DealerLoginClient middlemanMode={middlemanMode} />;
}


