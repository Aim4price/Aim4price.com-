import { notFound, redirect } from 'next/navigation';
import { requireOwnerAppPageAccess } from '../../../../lib/owner-app-access';

export const dynamic = 'force-dynamic';

// Compatibility for saved links from the consolidation release. App sessions
// always stay in the existing mobile flows; desktop tools are never mounted here.
const mobileDestinations: Record<string, string> = {
  fuel: '/owner-app/operations/fuel',
  maintenance: '/owner-app/attention',
  costs: '/owner-app/more',
  budgets: '/owner-app/more',
  map: '/owner-app/assets',
  documents: '/owner-app/assets',
};

export default async function ManagerWorkspacePage({ params }: { params: { section: string } }) {
  await requireOwnerAppPageAccess();
  const destination = mobileDestinations[params.section];
  if (!destination) notFound();
  redirect(destination);
}
