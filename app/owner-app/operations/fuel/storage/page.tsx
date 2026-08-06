import { redirect } from 'next/navigation';
import FieldManagerDieselClient from '../../../../field-manager/field-manager-diesel-client';
import { ownerAppCan, requireOwnerAppPageAccess } from '../../../../../lib/owner-app-access';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export default async function OwnerFuelStoragePage() {
  const access = await requireOwnerAppPageAccess();
  if (!ownerAppCan(access, 'operate')) redirect('/owner-app');
  return <FieldManagerDieselClient ownerAppMode />;
}
