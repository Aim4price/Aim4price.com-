'use client';
import { useId } from 'react';
import ShareDisclosureDialog from './ShareDisclosureDialog';
import styles from './ShareDisclosureDialog.module.css';
import reviewStyles from './LicenceShareReview.module.css';

type Asset = { id: string; title: string; applicable: boolean; missing: string[]; registration: string; renewal: string };
export default function LicenceShareReview({ assets, onEdit, onContinue, onClose }: {
  assets: Asset[]; onEdit: (id: string) => void; onContinue: () => void; onClose: () => void;
}) {
  const titleId = useId();
  const included = assets.filter(asset => asset.applicable);
  const ready = included.length > 0 && included.every(asset => asset.missing.length === 0);
  return <ShareDisclosureDialog title="Review licence details" titleId={titleId} closeLabel="Close licence review" onClose={onClose}>
    <p className={styles.description}>Each asset being shared needs a licensed status and a valid renewal / expiry date. Fill in the missing details before choosing a licence renewal provider.</p>
    <p className={styles.hint}>You can also add registration numbers, licence notes and documents in the licence form. Assets that do not support licensing are excluded.</p>
    <div className={reviewStyles.assets}>
      {assets.map(asset => <section key={asset.id} className={reviewStyles.asset}>
        <strong>{asset.title}</strong>
        {asset.applicable ? <>
          <p>{asset.missing.length ? `Missing: ${asset.missing.join(' and ')}` : 'Ready to share'}</p>
          <small>Registration: {asset.registration || 'Not added'} · Renewal: {asset.renewal || 'Not added'}</small>
          <button type="button" onClick={() => onEdit(asset.id)}>{asset.missing.length ? 'Fill in licence details' : 'Edit licence details'}</button>
        </> : <p>Not applicable · excluded from this request</p>}
      </section>)}
    </div>
    {!included.length && <p role="status">There are no assets that support licensing in this selection.</p>}
    <div className={styles.actions}><button type="button" className={styles.continue} disabled={!ready} onClick={onContinue}>Continue with {included.length} {included.length === 1 ? 'asset' : 'assets'}</button></div>
  </ShareDisclosureDialog>;
}
