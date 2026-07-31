import { redirect } from 'next/navigation';
import { requireActivePageAccess } from '../../../lib/account-access';

export const runtime = 'nodejs';

export default async function AccountantFuelPage() {
  await requireActivePageAccess();
  redirect('/leads');
}
