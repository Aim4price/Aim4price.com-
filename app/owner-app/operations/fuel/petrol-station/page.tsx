import { redirect } from 'next/navigation';
import { ownerAppCan, requireOwnerAppPageAccess } from '../../../../../lib/owner-app-access';
import OwnerAppNav from '../../../owner-app-nav';
import ownerStyles from '../../../owner-app.module.css';
import PetrolStationFuelClient from './petrol-station-fuel-client';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export default async function OwnerPetrolStationFuelPage() {
  const access = await requireOwnerAppPageAccess();
  if (!ownerAppCan(access, 'operate')) redirect('/owner-app');

  return (
    <main className={`${ownerStyles.page} ${ownerStyles.homePage}`}>
      <OwnerAppNav />
      <PetrolStationFuelClient operatorName={access.displayName} />
    </main>
  );
}
