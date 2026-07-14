import { requireOwnerAppPageAccess } from '../../../lib/owner-app-access';
import OwnerAppMaintenanceClient from './owner-app-maintenance-client';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export default async function OwnerAppMaintenancePage() {
  await requireOwnerAppPageAccess();
  return <OwnerAppMaintenanceClient />;
}
