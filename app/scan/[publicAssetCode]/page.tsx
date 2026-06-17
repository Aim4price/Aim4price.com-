import { redirectAdminToAdmin } from '../../../lib/account-access';
import ScanClient from './scan-client';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type PageProps = {
  params: {
    publicAssetCode: string;
  };
};

export default async function ScanAssetPage({ params }: PageProps) {
  await redirectAdminToAdmin();

  return <ScanClient publicAssetCode={params.publicAssetCode ?? ''} />;
}
