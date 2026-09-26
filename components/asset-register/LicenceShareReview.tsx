'use client';
import { useId } from 'react';
import ShareDisclosureDialog from './ShareDisclosureDialog';
import styles from './LicenceShareReview.module.css';

type Asset = { id: string; title: string; applicable: boolean; missing: string[]; registration: string; renewal: string };
export default function LicenceShareReview({ assets, onEdit, onContinue, onClose }: {
  assets: Asset[]; onEdit: (id: string) => void; onContinue: () => void; onClose: () => void;
}) {
  const titleId = useId();
  const descriptionId = useId();
  const included = assets.filter(asset => asset.applicable);
  const incomplete = included.filter(asset => asset.missing.length > 0).length;
  const ready = included.length > 0 && incomplete === 0;
  return <ShareDisclosureDialog className={styles.dialog} title="Review licence details" titleId={titleId} descriptionId={descriptionId} closeLabel="Close licence review" onClose={onClose}>
    <div className={styles.intro}>
      <p id={descriptionId}>Check the licence status and renewal date before sharing.</p>
      <div className={styles.summary} aria-label="Licence review summary">
        <span>{included.length} {included.length === 1 ? 'asset' : 'assets'} included</span>
        <span className={incomplete ? styles.attention : styles.ready}>{incomplete ? `${incomplete} need details` : `${included.length} ready to share`}</span>
        {assets.length > included.length && <span>{assets.length - included.length} excluded</span>}
      </div>
    </div>
    <div className={styles.assets} tabIndex={0} role="region" aria-label="Assets to review">
      {assets.map(asset => <section key={asset.id} className={`${styles.asset} ${!asset.applicable ? styles.excluded : ''}`}>
        <div className={styles.assetHeader}>
          <strong>{asset.title}</strong>
          <span className={`${styles.status} ${!asset.applicable ? styles.neutral : asset.missing.length ? styles.attention : styles.ready}`}>{!asset.applicable ? 'Excluded' : asset.missing.length ? 'Needs details' : 'Ready to share'}</span>
        </div>
        {asset.applicable ? <>
          <dl className={styles.facts}>
            <div><dt>Registration</dt><dd>{asset.registration || 'Not added'}</dd></div>
            <div><dt>Renewal / expiry</dt><dd>{asset.renewal || 'Not added'}</dd></div>
          </dl>
          <div className={styles.assetFooter}>
            {asset.missing.length ? <p className={styles.missing}>Missing: {asset.missing.join(' and ')}</p> : <p className={styles.complete}>Licence details complete</p>}
            <button type="button" onClick={() => onEdit(asset.id)}>{asset.missing.length ? 'Fill in licence details' : 'Edit licence details'}<span aria-hidden="true">→</span></button>
          </div>
        </> : <p className={styles.excludedNote}>Not applicable · excluded from this request</p>}
      </section>)}
    </div>
    <footer className={styles.footer}>
      <p role="status">{!included.length ? 'There are no assets that support licensing in this selection.' : incomplete ? 'Fill in the missing details to continue.' : 'All included assets are ready to share.'}</p>
      <button type="button" className={styles.continue} disabled={!ready} onClick={onContinue}>Continue with {included.length} {included.length === 1 ? 'asset' : 'assets'}</button>
    </footer>
  </ShareDisclosureDialog>;
}
