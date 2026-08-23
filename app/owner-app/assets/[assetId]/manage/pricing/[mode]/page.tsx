import { notFound } from 'next/navigation';
import { requireOwnerAppPageAccess } from '../../../../../../../lib/owner-app-access';
import OwnerAppNav from '../../../../../owner-app-nav';
import styles from '../../../../../owner-app.module.css';
import OwnerAssetDetailClient, { type OwnerAssetPricingMode } from '../../../owner-asset-detail-client';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const PRICING_MODES = new Set<OwnerAssetPricingMode>(['recalculate', 'future', 'saleability']);

export default async function OwnerAssetPricingModePage({ params }: {
  params: { assetId: string; mode: string };
}) {
  await requireOwnerAppPageAccess();
  const mode = params.mode as OwnerAssetPricingMode;
  if (!PRICING_MODES.has(mode)) notFound();

  const pricingHref = `/owner-app/assets/${encodeURIComponent(params.assetId)}/manage/pricing`;
  return (
    <main className={styles.page}>
      <OwnerAppNav backHref={pricingHref} backLabel="Pricing" />
      <OwnerAssetDetailClient assetId={params.assetId} view="section" section="pricing" pricingMode={mode} />
    </main>
  );
}
