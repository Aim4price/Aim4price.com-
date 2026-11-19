import { requireAdminPageAccess } from '../../../lib/account-access';
import { listAssetOptions } from '../../../lib/asset-options-db';
import AssetOptions from './asset-options-client';

export const dynamic = 'force-dynamic';
export default async function Page() {
  await requireAdminPageAccess();
  return <AssetOptions initial={await listAssetOptions()} />;
}
