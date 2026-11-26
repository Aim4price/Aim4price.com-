import AppHeader from '../../components/AppHeader';
import { redirect } from 'next/navigation';
import { requireActivePageAccess } from '../../lib/account-access';
import { getAssetRegisterAccountAccess } from '../../lib/asset-register-account-access';
import AnnualReviewClient from '../admin/annual-review/annual-review-client';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export default async function AnnualReviewPage() {
  const { session } = await requireActivePageAccess();
  const access = await getAssetRegisterAccountAccess(session);
  if (access?.accountType !== 'dealer') redirect('/workspace');
  return <><AppHeader active="workspace"/><main style={{ width: 'var(--website-page-width, min(100% - 2rem, 1200px))', margin: '0 auto', paddingBlock: '2rem' }}><AnnualReviewClient live /></main></>;
}
