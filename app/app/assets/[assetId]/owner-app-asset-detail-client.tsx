'use client';

import { useEffect, useState } from 'react';
import OwnerAppNav from '../../owner-app-nav';
import {
  ownerAppDate,
  ownerAppMoney,
  ownerAppUsage,
  type OwnerAppAssetDetail,
  type OwnerAppAssetsResponse,
} from '../../owner-app-types';
import styles from '../../owner-app.module.css';

function yesNo(value: boolean): string {
  return value ? 'Yes' : 'No';
}

export default function OwnerAppAssetDetailClient({ assetId }: { assetId: string }) {
  const [asset, setAsset] = useState<OwnerAppAssetDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;

    fetch(`/api/owner-app/assets?assetId=${encodeURIComponent(assetId)}`, { credentials: 'include', cache: 'no-store' })
      .then(async (response) => {
        const payload = await response.json().catch(() => null) as OwnerAppAssetsResponse | null;
        if (!response.ok || !payload?.ok || !payload.asset) throw new Error(payload?.error || 'Asset could not be loaded.');
        if (active) setAsset(payload.asset);
      })
      .catch((cause) => { if (active) setError(cause instanceof Error ? cause.message : 'Asset could not be loaded.'); })
      .finally(() => { if (active) setLoading(false); });

    return () => { active = false; };
  }, [assetId]);

  return (
    <main className={styles.appPage}>
      <OwnerAppNav title="Asset" backHref="/app/assets" />
      <div className={styles.shell}>
        {loading ? <div className={styles.loadingState}><span className={styles.spinner} aria-label="Loading asset" /></div> : null}
        {error ? <div className={`${styles.notice} ${styles.noticeError}`} role="alert">{error}</div> : null}

        {asset ? (
          <>
            <header className={styles.pageHeader}>
              <p className={styles.pageEyebrow}>{asset.registerName}</p>
            </header>

            {asset.photos[0] ? <img className={styles.detailPhoto} src={asset.photos[0]} alt={asset.title} /> : null}

            <section className={`${styles.detailCard} ${styles.section}`}>
              <div className={styles.detailHero}>
                <div className={styles.detailTitle}>
                  <h1>{asset.title}</h1>
                  <p>{[asset.yearModel, asset.brandName, asset.modelName].filter(Boolean).join(' · ') || asset.categoryLabel || asset.kind}</p>
                </div>
                <span className={styles.detailValue}>{ownerAppMoney(asset.value)}</span>
              </div>

              <div className={styles.buttonRow}>
                <a className={styles.primaryButton} href={`/app/maintenance?assetId=${encodeURIComponent(asset.id)}`}>Schedule maintenance</a>
                <a className={styles.secondaryButton} href={`/app/reports?assetId=${encodeURIComponent(asset.id)}`}>Open reports</a>
              </div>
            </section>

            <section className={`${styles.detailCard} ${styles.section}`}>
              <h2>Asset answers</h2>
              <div className={styles.detailFacts}>
                <div className={styles.detailFact}><span>Current value</span><strong>{ownerAppMoney(asset.value)} excl. VAT</strong></div>
                <div className={styles.detailFact}><span>Replacement price</span><strong>{ownerAppMoney(asset.replacementPriceExVat)} excl. VAT</strong></div>
                <div className={styles.detailFact}><span>Usage</span><strong>{ownerAppUsage(asset)}</strong></div>
                <div className={styles.detailFact}><span>Condition</span><strong>{asset.condition || 'Not recorded'}</strong></div>
                <div className={styles.detailFact}><span>Insured</span><strong>{yesNo(asset.isInsured)}</strong></div>
                <div className={styles.detailFact}><span>Insured value</span><strong>{ownerAppMoney(asset.insuredValueExVat)}</strong></div>
                <div className={styles.detailFact}><span>Financed</span><strong>{yesNo(asset.isFinanced)}</strong></div>
                <div className={styles.detailFact}><span>Licensed</span><strong>{yesNo(asset.isLicensed)}</strong></div>
                <div className={styles.detailFact}><span>Registration</span><strong>{asset.licenseRegistrationNumber || 'Not recorded'}</strong></div>
                <div className={styles.detailFact}><span>Serial number</span><strong>{asset.serialNumber || 'Not recorded'}</strong></div>
                <div className={styles.detailFact}><span>Last scanned</span><strong>{ownerAppDate(asset.lastScannedAtIso)}</strong></div>
                <div className={styles.detailFact}><span>Last location</span><strong>{asset.lastKnownLocationText || 'Not recorded'}</strong></div>
              </div>
            </section>

            {asset.note ? (
              <section className={`${styles.detailCard} ${styles.section}`}>
                <h2>Notes</h2>
                <p>{asset.note}</p>
              </section>
            ) : null}

            <section className={`${styles.detailCard} ${styles.section}`}>
              <h2>Documents</h2>
              <div className={styles.documentList}>
                {asset.documents.length ? asset.documents.map((document) => (
                  <a key={document.id} className={styles.documentItem} href={document.url} target="_blank" rel="noreferrer">
                    <span>{document.fileName}</span>
                    <span aria-hidden="true">↗</span>
                  </a>
                )) : <div className={styles.emptyState}>No documents saved for this asset.</div>}
              </div>
            </section>
          </>
        ) : null}
      </div>
    </main>
  );
}
