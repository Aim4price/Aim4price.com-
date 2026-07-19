import FieldManagerOverviewClient from '../field-manager-overview-client';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type PageProps = {
  searchParams?: {
    range?: string;
  };
};

export default function FieldManagerOverviewPage({ searchParams }: PageProps) {
  return (
    <FieldManagerOverviewClient
      initialRange={searchParams?.range === 'week' ? 'week' : 'upcoming'}
    />
  );
}
