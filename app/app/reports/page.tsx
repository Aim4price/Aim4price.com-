import { requireOwnerAppPageAccess } from '../../../lib/owner-app-access';
import OwnerAppReportsClient from './owner-app-reports-client';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export default async function OwnerAppReportsPage() {
  await requireOwnerAppPageAccess();
  return <OwnerAppReportsClient />;
}
