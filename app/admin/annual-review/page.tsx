import { requireAdminPageAccess } from '../../../lib/account-access';
import AdminNavigation from '../../../components/AdminNavigation';
import AnnualReviewClient from './annual-review-client';
export const viewport = { width: 'device-width', initialScale: 1 };
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export default async function AnnualReviewPage() {
  await requireAdminPageAccess();
  return <main style={{ maxWidth: 1200, margin: '0 auto', padding: '2rem 1rem' }}><AdminNavigation active="annual-review" /><AnnualReviewClient /></main>;
}
