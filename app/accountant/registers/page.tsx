import { redirect } from 'next/navigation';
import { requireActivePageAccess } from '../../../lib/account-access';

export const runtime = 'nodejs';

export default async function AccountantRegistersPage() {
  await requireActivePageAccess();
  redirect('/leads');
}
