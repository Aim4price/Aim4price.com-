import Link from 'next/link';
import { ownerAppCan, requireOwnerAppPageAccess } from '../../lib/owner-app-access';
import OwnerAppNav from './owner-app-nav';
import OwnerNotificationsLink from './owner-notifications-link';
import OwnerHomeAttention from './owner-home-attention';
import OwnerIcon from './owner-icon';
import styles from './owner-app.module.css';
import mobile from './owner-mobile.module.css';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export default async function OwnerAppHome() {
  const access = await requireOwnerAppPageAccess();
  const canManage = ownerAppCan(access, 'manage_assets');
  const tools = [
    { allowed: ownerAppCan(access, 'addFuel') || ownerAppCan(access, 'recordFuelIssues') || ownerAppCan(access, 'refillFuel'), label: 'Add fuel', icon: 'fuel', href: '/owner-app/operations/fuel' },
    { allowed: ownerAppCan(access, 'recordMaintenance') || ownerAppCan(access, 'completeMaintenance'), label: 'Record work', icon: 'record', href: '/owner-app/operations/maintenance' },
    { allowed: ownerAppCan(access, 'recordMaintenance'), label: 'Report problem', icon: 'problem', href: '/owner-app/report-problem' },
    { allowed: true, label: 'Find an asset', icon: 'search', href: '/owner-app/assets' },
    { allowed: canManage, label: 'Add asset', icon: 'add', href: '/owner-app/assets/add' },
  ];
  return <main className={`${styles.page} ${styles.homePage}`}>
    <OwnerAppNav showBack={false} trailingAction={<OwnerNotificationsLink viewerId={access.ownerAppUserId ?? access.ownerUserId} compact />} />
    <div className={mobile.dashboard}>
      <section className={mobile.intro}><h1>Your assets. Your day.</h1><p>{access.displayName}</p></section>
      {ownerAppCan(access, 'viewMaintenance') && <OwnerHomeAttention />}
      <section><h2 className={mobile.sectionTitle}>Quick actions</h2><nav className={`${mobile.grid} ${mobile.assetActions}`} aria-label="Owner tools">
        {tools.map(tool => !tool.allowed ? <div className={mobile.tile} key={tool.href} aria-disabled="true" title="Access restricted"><OwnerIcon name={tool.icon} /><strong>{tool.label}</strong></div> : <Link className={mobile.tile} key={tool.href} href={tool.href} prefetch={false}><OwnerIcon name={tool.icon} /><strong>{tool.label}</strong></Link>)}
      </nav></section>
      <Link className={mobile.row} href="/owner-app/offline.html" prefetch={false}><OwnerIcon name="offline" /><span><strong>Offline work</strong><small>Save work before heading out.</small></span></Link>
    </div>
  </main>;
}
