import { EXTERNAL_SHARE_OPTIONS, type ExternalSharePermissions } from '../../lib/external-share-permissions';
import styles from './AssetRegisterGuide.module.css';

const viewing = new Set(['viewParts', 'history', 'maintenanceReports', 'costOfOwnership', 'documents']);
const detailFields = new Set(['yearModel', 'usage', 'condition']);

export default function AssetLinkAccessSummary({ permissions }: { permissions: ExternalSharePermissions }) {
  const selected = EXTERNAL_SHARE_OPTIONS.filter(option => permissions[option.key] === true && option.key !== 'reports' && !(permissions.updateDetails && detailFields.has(option.key)));
  const updates = selected.filter(option => !viewing.has(option.key));
  const extraViews = selected.filter(option => viewing.has(option.key));
  return <section className={styles.guide} aria-label="Selected link access">
    <div className={styles.body}>
      <p><strong>{updates.length ? 'Selected permissions' : 'View-only access'}</strong></p>
      <p>The recipient can view the shared asset information{permissions.reports || permissions.allReports ? ' and general asset reports' : ''}.</p>
      <p>{updates.length ? `Allowed actions: ${updates.map(option => option.label).join(', ')}.` : 'No changes to the asset are allowed.'}</p>
      <p>{extraViews.length ? `Additional viewing access: ${extraViews.map(option => option.label).join(', ')}.` : 'Maintenance reports, ownership costs, history and parts are not included.'}</p>
      <p>Recipients sign in to use the access you allow. You can change permissions or revoke the link in History.</p>
    </div>
  </section>;
}
