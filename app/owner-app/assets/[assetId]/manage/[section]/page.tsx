import { notFound, redirect } from 'next/navigation';
import { ownerAppCan, ownerAppCanAccessAsset, requireOwnerAppPageAccess } from '../../../../../../lib/owner-app-access';
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
  const access = await requireOwnerAppPageAccess();
  if (!ownerAppCanAccessAsset(access, params.assetId)) notFound();
  const section = params.section as OwnerAssetManageSection;
  if (!MANAGE_SECTIONS.has(section)) notFound();
  const canOpen = ['activity', 'reports'].includes(section)
    || (['location', 'media', 'maintenance'].includes(section) && ownerAppCan(access, 'operate'))
    || (section === 'marketplace' && ownerAppCan(access, 'manage_marketplace'))
    || (!['activity', 'reports', 'location', 'media', 'maintenance', 'marketplace'].includes(section)
      && ownerAppCan(access, 'manage_assets'));
  if (!canOpen) redirect(`/owner-app/assets/${encodeURIComponent(params.assetId)}/manage`);
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
