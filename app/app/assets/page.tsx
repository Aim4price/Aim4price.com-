import { requireOwnerAppPageAccess } from '../../../lib/owner-app-access';
import OwnerAppAssetsClient from './owner-app-assets-client';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export default async function OwnerAppAssetsPage() {
  await requireOwnerAppPageAccess();
  return <OwnerAppAssetsClient />;
}
