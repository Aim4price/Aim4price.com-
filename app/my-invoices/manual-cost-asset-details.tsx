import type { AssetOption } from './my-invoices-client';
import styles from './manual-cost-asset-details.module.css';

type DetailIconKind = 'calendar' | 'usage' | 'condition' | 'category' | 'method' | 'serial';

function DetailIcon({ kind }: { kind: DetailIconKind }) {
  const paths = {
    calendar: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M7 3v4m10-4v4M3 11h18" /></>,
    usage: <><path d="M4 18a9 9 0 1 1 16 0M12 5v2M5 10l2 1m12-1-2 1m-5 4 4-5" /><circle cx="12" cy="15" r="1" /></>,
    condition: <><path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6Z" /><path d="m8 12 3 3 5-6" /></>,
    category: <><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></>,
    method: <><path d="M14 3H5v18h14V8Z M14 3v5h5M8 12h8m-8 4h5" /></>,
    serial: <path d="M3 4v16M6 4v16M10 4v16M14 4v16M17 4v16M21 4v16" />,
  };
  return <svg className={styles.icon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">{paths[kind]}</svg>;
}

/** Presentation used only when choosing an asset for a manual cost. */
export default function ManualCostAssetDetails({ asset }: { asset: AssetOption }) {
  // Keep the existing metadata wording, units and missing-value rules intact.
  const details = asset.meta.split(/\s*[•·]\s*/).filter(Boolean);
  return (
    <span className={styles.details}>
      <span className={styles.specifications}>
        {details.map((detail, index) => {
          const kind = /^year/i.test(detail) ? 'calendar' : /^condition/i.test(detail) ? 'condition' : 'usage';
          return <span className={styles.item} key={`${detail}-${index}`}><DetailIcon kind={kind} /><span>{detail}</span></span>;
        })}
      </span>
      <span className={styles.supporting}>
        <span className={styles.item}><DetailIcon kind="category" /><span>{asset.categoryLabel}</span></span>
        <span className={styles.item}><DetailIcon kind="method" /><span>{asset.selectedMethod === 'manual' ? 'Manual' : 'Aim4price'}</span></span>
      </span>
      <span className={styles.serial}>
        <DetailIcon kind="serial" />
        <span className={styles.serialLabel}>Serial / VIN</span>
        <span className={styles.serialValue}>{asset.serialNumber?.trim() || 'Not provided'}</span>
      </span>
    </span>
  );
}
