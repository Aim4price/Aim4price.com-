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
  const canOperate = ownerAppCan(access, 'operate');
  const canManage = ownerAppCan(access, 'manage_assets');
  const tools = [
    ...(canOperate ? [
      { label: 'Add fuel', icon: 'fuel', href: '/owner-app/operations/fuel' },
      { label: 'Record maintenance', icon: 'work', href: '/owner-app/operations/maintenance' },
      { label: 'Report problem', icon: 'problem', href: '/owner-app/report-problem' },
    ] : []),
    { label: 'Find an asset', icon: 'assets', href: '/owner-app/assets' },
    ...(canManage ? [{ label: 'Add asset', icon: 'add', href: '/owner-app/assets/add' }] : []),
  ];
  return <main className={`${styles.page} ${styles.homePage}`}>
    <OwnerAppNav showBack={false} trailingAction={<OwnerNotificationsLink viewerId={access.ownerAppUserId ?? access.ownerUserId} compact />} />
    <div className={mobile.dashboard}>
      <section className={mobile.intro}><h1>Your assets. Your day.</h1><p>{access.displayName}</p></section>
      <OwnerHomeAttention />
      <section><h2 className={mobile.sectionTitle}>Quick actions</h2><nav className={mobile.grid} aria-label="Owner tools">
        {tools.map(tool => <Link className={mobile.tile} key={tool.href} href={tool.href} prefetch={false}><OwnerIcon name={tool.icon} /><strong>{tool.label}</strong></Link>)}
      </nav></section>
      <Link className={mobile.row} href="/owner-app/offline.html" prefetch={false}><OwnerIcon name="offline" /><span><strong>Prepare for offline work</strong><small>Save your available work before heading out.</small></span></Link>
    </div>
  </main>;
}
