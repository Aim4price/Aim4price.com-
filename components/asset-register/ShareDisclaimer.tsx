'use client';
import styles from './ShareDisclaimer.module.css';

export default function ShareDisclaimer({accepted, onChange, disabled = false, publicLink = false, ownerApproval = false}: {
  accepted: boolean; onChange: (accepted: boolean) => void; disabled?: boolean; publicLink?: boolean; ownerApproval?: boolean;
}) {
  return <div className={styles.notice}>
    {!ownerApproval && <strong>Before you share</strong>}
    <p>{publicLink
      ? 'Anyone with this link can view the selected asset details and included photos after signing in, and can forward the link. Any contact details you choose to include will also be visible. Reports keep their separate access restrictions.'
      : 'The recipient can view the latest saved asset details and any photos or reports you include. They may save or forward this information.'}</p>
    <p>Only share information you have permission to disclose. Check your selection and recipient before continuing. Sharing does not create a sales, finance, insurance or service agreement. Disabling access later cannot remove copies already saved.</p>
    {ownerApproval && <p>Reports and selected actions stay locked until the recipient signs in with a verified account and you approve their access request. Updates and documents are sent for your review.</p>}
    <label><input type="checkbox" data-share-consent checked={accepted} disabled={disabled} onChange={event => onChange(event.target.checked)} /><span>I have permission to share this information and accept the disclaimer.</span></label>
  </div>;
}
