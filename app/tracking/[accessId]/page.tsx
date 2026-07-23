import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import AppHeader from '../../../components/AppHeader';
import DealerAssetCorrectionEditor from '../../../components/DealerAssetCorrectionEditor';
import { workspaceStyles } from '../../../components/WorkspacePrimitives';
import { getAccountProfile } from '../../../lib/account-profile';
import { getServerSession } from '../../../lib/auth-session';
import {
  getDealerTrackedAsset,
  type DealerMaintenanceTrackerStatus,
} from '../../../lib/dealer-maintenance-tracker';
import styles from '../page.module.css';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function formatUsage(value: number | null, metric: string | null): string {
  if (value === null || !Number.isFinite(value)) return 'Not recorded';
  if (metric === 'percentage') {
    return `${value.toLocaleString('en-ZA', { maximumFractionDigits: 1 })}%`;
  }
  return `${value.toLocaleString('en-ZA', { maximumFractionDigits: 1 })} ${metric === 'km' ? 'km' : 'hours'}`;
}

function formatDate(value: string | null): string {
  if (!value) return 'Not set';
  const parsed = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat('en-ZA', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(parsed);
}

function formatCurrency(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return 'Not saved';
  return new Intl.NumberFormat('en-ZA', {
    style: 'currency',
    currency: 'ZAR',
    maximumFractionDigits: 0,
  }).format(value);
}

function statusClass(status: DealerMaintenanceTrackerStatus): string {
  if (status === 'overdue' || status === 'due') return styles.statusUrgent;
  if (status === 'due_soon' || status === 'usage_needed') return styles.statusAttention;
  return styles.statusUpcoming;
}

export default async function TrackingDetailPage({ params }: { params: { accessId: string } }) {
  const session = await getServerSession({ allowDealerApp: true });

  if (!session?.user?.id) {
    redirect('/login');
  }

  const profile = await getAccountProfile({
    id: session.user.id,
    name: session.user.name,
    email: session.user.email,
  });

  if (profile.accountType !== 'dealer' || profile.accountStatus !== 'active') {
    redirect('/account');
  }

  const asset = await getDealerTrackedAsset(session.user.id, String(params.accessId || '').trim());
  if (!asset) notFound();

  return (
    <div className={`${workspaceStyles.page} ${styles.screen}`}>
      <AppHeader active="tracking" />
      <main className={`${workspaceStyles.shell} ${styles.page} ${styles.detailPage}`}>
        <Link href="/tracking" className={styles.backLink}>← Back to tracking</Link>

        <section className={`${workspaceStyles.card} ${styles.detailHero}`}>
          <div className={styles.detailPhoto}>
            {asset.photoUrl ? <img src={asset.photoUrl} alt="" /> : <span>{asset.assetTitle.charAt(0).toUpperCase()}</span>}
          </div>
          <div className={styles.detailIdentity}>
            <div className={styles.detailKickerRow}>
              <span>{asset.ownerName}</span>
              <span className={`${styles.statusBadge} ${statusClass(asset.status)}`}>{asset.statusLabel}</span>
            </div>
            <h1>{asset.assetTitle}</h1>
            <p>{[asset.brandName, asset.modelName, asset.yearModel].filter(Boolean).join(' · ') || asset.assetKind}</p>
            <small>Tracking access granted by {asset.grantedByName || 'the asset owner'}.</small>
          </div>
        </section>

        <section className={styles.detailStats} aria-label="Tracked equipment overview">
          <article><span>Current usage</span><strong>{formatUsage(asset.currentUsage, asset.usageMetric)}</strong></article>
          <article><span>Open schedules</span><strong>{asset.maintenanceRecords.length}</strong></article>
          <article><span>Serial number</span><strong>{asset.serialNumber || 'Not saved'}</strong></article>
          <article><span>Replacement price</span><strong>{formatCurrency(asset.replacementPriceExVat)}</strong></article>
          <article><span>Tracking status</span><strong>{asset.statusLabel}</strong></article>
        </section>

        <section className={`${styles.recordsPanel} ${styles.correctionPanel}`}>
          <header className={styles.recordsHeader}>
            <div>
              <span className={styles.eyebrow}>Owner-approved updates</span>
              <h2>Asset corrections</h2>
              <p>Correct the dealer-facing serial number or replacement price and send it to the owner for acceptance.</p>
            </div>
            <span className={styles.correctionBadge}>Owner approval</span>
          </header>
          <div className={styles.correctionActions}>
            <DealerAssetCorrectionEditor
              assetTitle={asset.assetTitle}
              sourceType="maintenance"
              sourceId={asset.accessId}
              serialNumber={asset.serialNumber}
              replacementPriceExVat={asset.replacementPriceExVat}
              correction={asset.dealerCorrection}
            />
          </div>
        </section>

        <section className={styles.recordsPanel}>
          <header className={styles.recordsHeader}>
            <div>
              <span className={styles.eyebrow}>Maintenance schedule</span>
              <h2>Open maintenance</h2>
              <p>Read-only schedules and notes managed by the equipment owner.</p>
            </div>
            <span className={styles.readOnlyBadge}>Read only</span>
          </header>

          {!asset.maintenanceRecords.length ? (
            <div className={`${workspaceStyles.emptyState} ${styles.emptyState}`}>
              <strong>No open maintenance schedules</strong>
              <p>The owner has not shared any current maintenance items for this equipment.</p>
            </div>
          ) : null}

          <div className={styles.recordList}>
            {asset.maintenanceRecords.map((record) => (
              <article key={record.id} className={styles.recordCard}>
                <div className={styles.recordHeading}>
                  <div>
                    <span>{record.maintenanceType === 'checkup' ? 'Checkup' : 'Service'}</span>
                    <h3>{record.title}</h3>
                  </div>
                  <strong>{record.computedStatusLabel}</strong>
                </div>

                <div className={styles.recordStats}>
                  <div><span>Current</span><strong>{formatUsage(record.currentUsage, record.usageMetric || asset.usageMetric)}</strong></div>
                  <div><span>Due</span><strong>{record.triggerType === 'usage' ? formatUsage(record.dueUsage, record.usageMetric || asset.usageMetric) : formatDate(record.dueDate)}</strong></div>
                  <div><span>Remaining</span><strong>{record.triggerType === 'usage' ? formatUsage(record.remainingUsage === null ? null : Math.max(0, record.remainingUsage), record.usageMetric || asset.usageMetric) : formatDate(record.dueDate)}</strong></div>
                </div>

                {record.notes ? (
                  <div className={styles.recordNote}>
                    <span>Owner note</span>
                    <p>{record.notes}</p>
                  </div>
                ) : null}
              </article>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
