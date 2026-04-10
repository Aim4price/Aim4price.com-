import { redirect } from 'next/navigation';
import { getServerSession } from '../../lib/auth-session';
import AssetRegisterClient from './asset-register-client';

export const runtime = 'nodejs';

export default async function AssetRegisterPage() {
  const session = await getServerSession();

  if (!session) {
    redirect('/auth#signup');
  }

  return <AssetRegisterClient />;
}
