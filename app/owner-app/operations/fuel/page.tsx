import FieldManagerDieselClient from '../../../field-manager/field-manager-diesel-client';
import { requireOwnerAppPageAccess } from '../../../../lib/owner-app-access';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export default async function OwnerFuelPage() {
  await requireOwnerAppPageAccess();
  return <FieldManagerDieselClient ownerAppMode />;
}
