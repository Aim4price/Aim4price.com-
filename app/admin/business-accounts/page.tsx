import { redirect } from 'next/navigation';
import { requireAdminPageAccess } from '../../../lib/account-access';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export default async function BusinessAccountsAdmin() {
  await requireAdminPageAccess();
  redirect('/admin/businesses?verify=1');
}
