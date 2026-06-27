import { requireActivePageAccess } from '../../lib/account-access';
import MyInvoicesClient from './my-invoices-client';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export default async function MyInvoicesPage() {
  await requireActivePageAccess();

  return <MyInvoicesClient />;
}
