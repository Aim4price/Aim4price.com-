import { redirect } from 'next/navigation';
import FieldManagerDieselClient from '../../../../../components/manager/fuel-storage-client';
import { ownerAppCan, requireOwnerAppPageAccess } from '../../../../../lib/owner-app-access';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export default async function OwnerFuelStoragePage() {
  const access = await requireOwnerAppPageAccess();
  if (!(ownerAppCan(access, 'addFuel') || ownerAppCan(access, 'recordFuelIssues') || ownerAppCan(access, 'refillFuel'))) redirect('/owner-app');
  return <FieldManagerDieselClient ownerAppMode />;
}
