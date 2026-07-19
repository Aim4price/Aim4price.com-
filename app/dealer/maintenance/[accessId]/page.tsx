import { notFound, redirect } from 'next/navigation';
import { getAccountProfile } from '../../../../lib/account-profile';
import { getServerSession } from '../../../../lib/auth-session';
import { getDealerTrackedAsset } from '../../../../lib/dealer-maintenance-tracker';
import DealerNav from '../../dealer-nav';
import styles from '../maintenance-tracker.module.css';
import dealerStyles from '../../dealer.module.css';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function usage(value: number | null, metric: string | null): string {
  if (value === null || !Number.isFinite(value)) return 'Not recorded';
  if (metric === 'percentage') return `${value.toLocaleString('en-ZA', { maximumFractionDigits: 1 })}%`;
  return `${value.toLocaleString('en-ZA', { maximumFractionDigits: 1 })} ${metric === 'km' ? 'km' : 'hours'}`;
}

function date(value: string | null): string {
  if (!value) return 'Not set';
  const parsed = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(parsed.getTime()) ? value : new Intl.DateTimeFormat('en-ZA', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(parsed);
}

export default async function DealerTrackedAssetPage({ params }: { params: { accessId: string } }) {
  const session = await getServerSession({ allowDealerApp: true });
  if (!session?.user?.id) redirect('/dealer/login');
  const profile = await getAccountProfile({ id: session.user.id, name: session.user.name, email: session.user.email });
  if (profile.accountType !== 'dealer' || profile.accountStatus !== 'active') redirect('/dealer/login');
  const asset = await getDealerTrackedAsset(session.user.id, String(params.accessId ?? '').trim());
  if (!asset) notFound();

  return (
    <div className={dealerStyles.module}>
      <DealerNav backHref="/dealer/maintenance" backLabel="Tracker" />
      <main className={styles.detailPage}>
        <section className={styles.detailHero}>
          <div className={styles.detailPhoto}>{asset.photoUrl ? <img src={asset.photoUrl} alt="" /> : <span>{asset.assetTitle.charAt(0).toUpperCase()}</span>}</div>
          <div className={styles.detailIdentity}><small>{asset.ownerName}</small><h1>{asset.assetTitle}</h1><p>{[asset.brandName, asset.modelName, asset.yearModel].filter(Boolean).join(' · ') || asset.assetKind}</p></div>
        </section>

        <section className={styles.detailStats}>
          <div><span>Current usage</span><strong>{usage(asset.currentUsage, asset.usageMetric)}</strong></div>
          <div><span>Open maintenance</span><strong>{asset.maintenanceRecords.length.toLocaleString('en-ZA')}</strong></div>
          <div><span>Status</span><strong>{asset.statusLabel}</strong></div>
          <div><span>Serial</span><strong>{asset.serialNumber || 'Not saved'}</strong></div>
        </section>

        <section className={styles.recordsSection}>
          <header><h2>Open maintenance</h2><p>Current saved schedules and notes.</p></header>
          <div className={styles.recordList}>
            {asset.maintenanceRecords.map((record) => (
              <article key={record.id} className={styles.recordCard}>
                <div className={styles.recordHeading}><div><small>{record.maintenanceType === 'checkup' ? 'Checkup' : 'Service'}</small><h3>{record.title}</h3></div><strong>{record.computedStatusLabel}</strong></div>
                <div className={styles.recordStats}>
                  <div><span>Current</span><strong>{usage(record.currentUsage, record.usageMetric || asset.usageMetric)}</strong></div>
                  <div><span>Due</span><strong>{record.triggerType === 'usage' ? usage(record.dueUsage, record.usageMetric || asset.usageMetric) : date(record.dueDate)}</strong></div>
                  <div><span>Remaining</span><strong>{record.triggerType === 'usage' ? usage(record.remainingUsage === null ? null : Math.max(0, record.remainingUsage), record.usageMetric || asset.usageMetric) : record.dueDate ? date(record.dueDate) : 'Not set'}</strong></div>
                </div>
                {record.notes ? <div className={styles.recordNote}><span>Maintenance note</span><p>{record.notes}</p></div> : null}
              </article>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
