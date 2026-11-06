'use client';
import { useEffect, useId } from 'react';
import { createPortal } from '../../../components/WebsitePortal';
import { useLeadDialog } from '../../../components/leads/useLeadDialog';
import SettingsDetailIcon from '../../../components/SettingsDetailIcon';
import QuickActionIcon, { type QuickActionIconName } from '../../account/QuickActionIcon';
import { isMiddlemanAccountSubtype } from '../../../lib/middleman-account';
import { TEAM_PERMISSIONS, teamDocumentAccessLabel, type TeamDocumentAccess, type TeamPermissions } from '../../../lib/team-access-policy';
import account from '../../account/page.module.css';
import notifications from '../../account/notifications/page.module.css';
import styles from './my-access.module.css';

export type DesktopAccountAccess = {
  documentAccess?: TeamDocumentAccess; excludedDocumentCount?: number;
  id: string; name: string; displayName: string; status: 'pending' | 'active';
  logoUrl?: string; accountType?: string; accountSubtype?: string;
  available: boolean; permissions: TeamPermissions; expiresAt: string | null;
  scope: 'all' | 'selected'; registerCount: number; assetCount: number; documentCount: number;
};
const count = (n: number, noun: string) => `${n} ${noun}${n === 1 ? '' : 's'}`;
const scopeLabel = (item: DesktopAccountAccess) => item.scope === 'all' ? 'All current and future assets' : [item.registerCount ? count(item.registerCount, 'register') + ' (including future assets)' : '', item.assetCount ? count(item.assetCount, 'individual asset') : ''].filter(Boolean).join(' and ') || 'No assets selected';

type Action = [QuickActionIconName, string];
/** Read-only account presentation: owner CSS and icons, with no owner data or mutation handlers. */
export function DesktopAccount({ item, username, onPermissions }: { item: DesktopAccountAccess; username: string; onPermissions: () => void }) {
  const owner = item.accountType !== 'dealer';
  const middleman = isMiddlemanAccountSubtype(item.accountSubtype);
  const accountType = owner ? 'Owner' : middleman ? 'Middleman' : 'Dealer';
  const groups: [string, Action[]][] = [
    ['Assets & activity', [['registers', 'Manage asset registers'], ['claim', 'Claim or send an asset'], ['notifications', 'Notifications']]],
    ['Apps & connections', [['connections', middleman ? 'Desktop asset access' : 'Desktop users'], ...(owner ? [['ownerApp', 'Owner App access'], ['fieldManager', 'Field Manager access'], ['connections', 'AI connections']] as Action[] : [['dealer', middleman ? 'Middleman app access' : 'Manage Dealer App staff']] as Action[])]],
    ['Marketplace & visibility', owner ? [['showroom', 'Manage my showroom'], ['marketplace', 'Marketplace contact'], ['discovery', 'Discovery settings']] : [['marketplace', 'Marketplace contact']]],
    ['Account & billing', [['business', 'Edit business details'], ['invoices', 'Aim4price invoices']]],
  ];
  const locked = (icon: QuickActionIconName, label: string, className = account.quickActionButton) => <button key={label} type="button" className={`${className} ${styles.restricted}`} disabled aria-label={`${label} — account holder only`}><QuickActionIcon name={icon} /><strong>{label}</strong></button>;
  return <section className={account.shell} data-desktop-account>
    <section className={account.accountHero}>
      <div className={account.heroIdentityGroup}>
        <div className={account.heroAvatarControl}><div className={`${account.heroAvatar} ${item.logoUrl ? account.heroAvatarWithLogo : ''}`}>{item.logoUrl ? <img src={item.logoUrl} alt={`${item.name} logo`} /> : <span>{item.name.split(/\s+/).slice(0, 2).map(word => word[0]).join('')}</span>}</div></div>
        <div className={account.heroCopy}><h1>{item.name}</h1><p>Signed in as {username}</p><small>{accountType} account · Desktop access</small></div>
      </div>
      <div className={account.heroStatusGroup}><span className={account.statusBadge}>{!item.available ? 'Unavailable' : item.status === 'active' ? 'Active' : 'Pending'}</span></div>
    </section>
    <section className={account.accountDashboard}>
      <section className={`${account.card} ${account.overviewCard}`}>
        <div className={account.compactCardHeader}><h2>Account overview</h2><p>Your account at a glance</p></div>
        <div className={account.metricGrid}>
          <div className={account.metricTile}><span>Account type</span><strong>{accountType}</strong></div>
          <div className={account.metricTile}><span>Contact number</span><strong className={styles.restricted} aria-label="Restricted">••• ••• ••••</strong></div>
          <div className={account.metricTile}><span>Profile progress</span><strong className={styles.restricted} aria-label="Restricted">— / —</strong><small className={styles.restricted}>Restricted</small><div className={`${account.progressTrack} ${styles.restricted}`}><span style={{width:'100%'}} /></div></div>
          <div className={account.metricTile}><span>{owner ? 'QR PIN status' : 'Directory status'}</span><strong className={styles.restricted} aria-label="Restricted">Restricted</strong></div>
        </div>
      </section>
      <section className={`${account.card} ${account.quickActionsCard}`}>
        <div className={account.compactCardHeader}><h2>Quick actions</h2><p>Everyday tasks first, account settings last.</p></div>
        <button type="button" className={`${account.quickActionButton} ${styles.permissionsButton}`} onClick={onPermissions}><QuickActionIcon name="security" /><strong>Permissions</strong></button>
        <div className={account.quickActionGroups}>{groups.map(([title, actions]) => <section key={title} className={account.quickActionGroup}><div className={account.quickActionGroupHeader}><h3>{title}</h3></div><div className={account.quickActionList}>{actions.map(([icon, label]) => locked(icon, label))}</div></section>)}</div>
      </section>
      <section className={`${account.card} ${account.securityCard}`}>
        <div className={account.compactCardHeader}><h2>Password &amp; security</h2><p>Secure your sign-in and recovery options.</p></div>
        <div className={account.securityActionsGrid}>{locked('security', 'Change password', account.securityActionCard)}{locked('reset', 'Email a reset link', account.securityActionCard)}{owner && locked('pin', 'Update QR PIN', account.securityActionCard)}</div>
      </section>
    </section>
    <section className={`${account.card} ${account.accountDeleteCard} ${account.dangerZone}`}><div className={account.dangerZoneCopy}><h2>Delete account</h2><p>Permanently delete your account and saved workspace.</p></div><button type="button" disabled className={`${account.dangerButton} ${account.dangerZoneButton} ${styles.restricted}`}>Delete account</button></section>
  </section>;
}

export function PermissionsModal({ item, onClose }: { item: DesktopAccountAccess; onClose: () => void }) {
  const titleId = useId();
  const ref = useLeadDialog(onClose);
  const active = item.available && item.status === 'active';
  useEffect(() => {
    const targets = [document.body, document.documentElement];
    const saved = targets.map(node => [node.style.getPropertyValue('overflow'), node.style.getPropertyPriority('overflow')]);
    targets.forEach(node => node.style.setProperty('overflow', 'hidden', 'important'));
    return () => targets.forEach((node, index) => node.style.setProperty('overflow', saved[index][0], saved[index][1]));
  }, []);
  return createPortal(<div className={account.modalBackdrop} data-website-overlay onClick={onClose}>
    <section ref={ref} tabIndex={-1} className={`${account.modalCard} ${account.accountActionModalCard} ${account.accountScrollableModalCard} ${account.marketplaceModalCard} ${account.notificationModalCard} ${account.polishedSettingsModal}`} role="dialog" aria-modal="true" aria-labelledby={titleId} onClick={event => event.stopPropagation()}>
      <div className={account.accountModalScrollContent}>
        <div className={account.modalHeader}><h2 id={titleId}>Permissions</h2><p>Your desktop access to {item.name}. Managed by your account holder.</p><button type="button" className={account.modalCloseButton} onClick={onClose} aria-label="Close permissions" data-modal-close="true">×</button></div>
        <div className={`${account.compactEditForm} ${notifications.form}`}>
          <div className={notifications.options}>
            {!active && <p role="status">{item.available ? 'Your invitation is pending. Access is not active yet.' : 'This workspace is unavailable.'}</p>}
            <div className={`${notifications.row} ${styles.permissionRow}`}><span className={notifications.optionLabel}><SettingsDetailIcon name="business" /><span>Asset access<small>{scopeLabel(item)}</small></span></span></div>
            <div className={notifications.categories}>{TEAM_PERMISSIONS.map(permission => <div key={permission.key} className={`${notifications.row} ${styles.permissionRow}`}>
              <span className={notifications.optionLabel}><SettingsDetailIcon name={permission.key === 'viewValues' ? 'costs' : permission.key.includes('Maintenance') ? 'maintenance' : permission.key.includes('Photos') ? 'image' : 'listings'} /><span>{permission.label}</span></span>
              <span className={active && item.permissions[permission.key] ? styles.allowed : styles.unavailable}>{active && item.permissions[permission.key] ? 'Allowed' : 'Not allowed'}</span>
            </div>)}</div>
            <dl className={styles.details}><div><dt>Documents</dt><dd>{teamDocumentAccessLabel(item.documentAccess, item.documentCount, item.excludedDocumentCount)}</dd></div><div><dt>Access expires</dt><dd>{item.expiresAt ? new Intl.DateTimeFormat('en-ZA', {dateStyle:'medium', timeStyle:'short', timeZone:'Africa/Johannesburg'}).format(new Date(item.expiresAt)) + ' (South Africa)' : 'No expiry set'}</dd></div></dl>
            <p className={notifications.hint}>Approved documents and photos may contain prices. Contact your account holder to change your permissions.</p>
          </div>
          <div className={account.marketplaceActions}><button type="button" className={account.primaryButton} onClick={onClose}>Done</button></div>
        </div>
      </div>
    </section>
  </div>, document.body);
}
