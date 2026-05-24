import { redirect } from 'next/navigation';
import { getAccountProfile } from '../../lib/account-profile';
import { getServerSession } from '../../lib/auth-session';
import MarketplaceClient from './marketplace-client';

type SearchParamValue = string | string[] | undefined;

type MarketplacePageProps = {
  searchParams?: {
    brand?: SearchParamValue;
    model?: SearchParamValue;
    drive?: SearchParamValue;
    type?: SearchParamValue;
    query?: SearchParamValue;
  };
};

function pick(value: SearchParamValue): string {
  if (Array.isArray(value)) {
    return String(value[0] ?? '').trim();
  }

  return String(value ?? '').trim();
}

export const runtime = 'nodejs';

export default async function MarketplacePage({ searchParams }: MarketplacePageProps) {
  const session = await getServerSession();

  if (session?.user?.id) {
    const profile = await getAccountProfile({
      id: session.user.id,
      name: session.user.name,
      email: session.user.email,
    });

    if (profile.accountType !== 'owner' && profile.accountType !== 'dealer') {
      redirect('/leads');
    }
  }

  return (
    <MarketplaceClient
      isSignedIn={Boolean(session)}
      initialFilters={{
        brand: pick(searchParams?.brand) || pick(searchParams?.query),
        model: pick(searchParams?.model),
        drive: pick(searchParams?.drive),
        type: pick(searchParams?.type),
      }}
    />
  );
}
