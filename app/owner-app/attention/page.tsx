import { requireOwnerAppPageAccess } from '../../../lib/owner-app-access';
import OwnerAttentionClient from './owner-attention-client';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type PageProps = {
  searchParams?: {
    range?: string;
  };
};

export default async function OwnerAttentionPage({ searchParams }: PageProps) {
  await requireOwnerAppPageAccess();
  return (
    <OwnerAttentionClient
      initialRange={searchParams?.range === 'week' ? 'week' : 'upcoming'}
    />
  );
}
