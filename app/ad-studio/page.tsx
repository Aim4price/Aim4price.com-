import { redirect } from 'next/navigation';
import AppHeader from '../../components/AppHeader';
import AdStudioClient from '../../components/AdStudioClient';
import { getAccountProfile } from '../../lib/account-profile';
import { getServerSession, isDealerAppSession } from '../../lib/auth-session';
import { isMiddlemanAccountSubtype } from '../../lib/middleman-account';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export default async function AdStudioPage({searchParams}: {searchParams?: {mode?: string}}) {
  const session = await getServerSession({ allowDealerApp: true, allowOwnerApp: true });
  if (!session?.user?.id) redirect('/auth#login');
  if (isDealerAppSession(session)) redirect('/dealer/ad-studio');

  const profile = await getAccountProfile({
    id: session.user.id,
    name: session.user.name,
    email: session.user.email,
  });

  if (profile.accountType !== 'dealer' || profile.accountStatus !== 'active') {
    redirect('/account');
  }

  return (
    <main>
      <AppHeader active="ad-studio" />
      <AdStudioClient key={searchParams?.mode} initialMode={searchParams?.mode === 'template' ? 'style' : searchParams?.mode === 'create' ? 'creator' : 'home'} middlemanMode={isMiddlemanAccountSubtype(profile.accountSubtype)} />
    </main>
  );
}
