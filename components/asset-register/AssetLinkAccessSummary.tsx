import { EXTERNAL_SHARE_OPTIONS, type ExternalSharePermissions } from '../../lib/external-share-permissions';
import styles from './AssetRegisterGuide.module.css';

const viewing = new Set(['viewParts', 'history', 'maintenanceReports', 'costOfOwnership']);
const detailFields = new Set(['yearModel', 'usage', 'condition']);

export default function AssetLinkAccessSummary({ permissions }: { permissions: ExternalSharePermissions }) {
  const selected = EXTERNAL_SHARE_OPTIONS.filter(option => permissions[option.key] === true && option.key !== 'reports' && !(permissions.updateDetails && detailFields.has(option.key)));
  const updates = selected.filter(option => !viewing.has(option.key));
  const extraViews = selected.filter(option => viewing.has(option.key));
  return <details className={`${styles.guide} ${styles.accessSummary}`} aria-label="Selected link access">
    <summary>
      <strong>{updates.length ? 'Selected permissions' : 'View-only access'}</strong>
      <span className={styles.accessHint}>{updates.length ? 'Review before sharing' : 'No changes allowed'}</span>
      <span className={styles.accessCount}>{updates.length ? `${updates.length} allowed ${updates.length === 1 ? 'action' : 'actions'}` : 'View access'}</span>
      <svg className={styles.chevron} aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m9 5 7 7-7 7"/></svg>
    </summary>
    <div className={styles.body}>
      <p>The recipient can view the shared asset information{permissions.reports || permissions.allReports ? ' and included asset reports' : ''}.</p>
      <p>{updates.length ? `Allowed actions: ${updates.map(option => option.key === 'documents' ? 'Submit invoices and quotes for review' : option.label).join(', ')}.` : 'No changes to the asset are allowed.'}</p>
      <p>{extraViews.length ? `Additional viewing access: ${extraViews.map(option => option.label).join(', ')}.` : 'Maintenance reports, ownership costs, history and parts are not included.'}</p>
      <p>Recipients sign in to use the access you allow. You can change permissions or revoke the link in History.</p>
    </div>
  </details>;
}
