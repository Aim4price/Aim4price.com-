import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getAccountProfile } from '../../lib/account-profile';
import { getServerSession } from '../../lib/auth-session';
import CompaniesClient, { type CompanyTypeFilter } from './companies-client';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Companies',
  description: 'Browse Aim4price finance providers, insurers, brokers and dealers.',
};

type SearchParamValue = string | string[] | undefined;

type CompaniesPageProps = {
  searchParams?: {
    type?: SearchParamValue;
  };
};

function pick(value: SearchParamValue): string {
  if (Array.isArray(value)) {
    return String(value[0] ?? '').trim();
  }

  return String(value ?? '').trim();
}

function normalizeInitialType(value: SearchParamValue): CompanyTypeFilter {
  const normalized = pick(value).toLowerCase();

  if (normalized === 'finance' || normalized === 'financial' || normalized === 'bank') {
    return 'finance';
  }

  if (normalized === 'insurance' || normalized === 'insurer' || normalized === 'broker') {
    return 'insurance';
  }

  if (normalized === 'dealer' || normalized === 'dealers') {
    return 'dealer';
  }

  return 'all';
}

export default async function CompaniesPage({ searchParams }: CompaniesPageProps) {
  const session = await getServerSession();

  if (!session) {
    redirect('/auth#signup');
  }

  const profile = await getAccountProfile(session.user);

  if (profile.accountType !== 'owner') {
    redirect('/account');
  }

  return <CompaniesClient initialType={normalizeInitialType(searchParams?.type)} />;
}
