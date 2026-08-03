import { notFound, redirect } from 'next/navigation';
import { requireOwnerAppPageAccess } from '../../../../../../lib/owner-app-access';
import OwnerAppNav from '../../../../owner-app-nav';
import styles from '../../../../owner-app.module.css';
import OwnerAssetDetailClient, { type OwnerAssetManageSection } from '../../owner-asset-detail-client';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MANAGE_SECTIONS = new Set<OwnerAssetManageSection>([
  'details',
  'activity',
  'reports',
  'pricing',
  'finance',
  'insurance',
  'licence',
  'location',
  'media',
  'marketplace',
  'maintenance',
  'dealer-tracking',
  'delete',
]);

export default async function OwnerAssetManageSectionPage({ params }: {
  params: { assetId: string; section: string };
}) {
  await requireOwnerAppPageAccess();
  const section = params.section as OwnerAssetManageSection;
  if (!MANAGE_SECTIONS.has(section)) notFound();
  if (section === 'maintenance') {
    redirect(`/owner-app/assets/${encodeURIComponent(params.assetId)}/maintenance`);
  }
  const manageHref = `/owner-app/assets/${encodeURIComponent(params.assetId)}/manage`;

  return (
    <main className={styles.page}>
      <OwnerAppNav backHref={manageHref} backLabel="Manage" />
      <OwnerAssetDetailClient assetId={params.assetId} view="section" section={section} />
    </main>
  );
}
