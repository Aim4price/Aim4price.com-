import { redirect } from 'next/navigation';
import { requireActivePageAccess } from '../../lib/account-access';
import { getAssetRegisterAccountAccess } from '../../lib/asset-register-account-access';
import AnnualReviewClient from '../admin/annual-review/annual-review-client';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export default async function AnnualReviewPage() {
  const { session } = await requireActivePageAccess();
  if (!await getAssetRegisterAccountAccess(session)) redirect('/account');
  return <main style={{ maxWidth: 1200, margin: '0 auto', padding: '2rem 1rem' }}><AnnualReviewClient live /></main>;
}
