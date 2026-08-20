import { redirect } from 'next/navigation';
import { requireAdminPageAccess } from '../../../lib/account-access';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export default async function AssistanceNetworkPage() {
  await requireAdminPageAccess();
  redirect('/admin');
}
