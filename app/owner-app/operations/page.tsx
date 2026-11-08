import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ownerAppCan, requireOwnerAppPageAccess } from '../../../lib/owner-app-access';
import OwnerAppNav from '../owner-app-nav';
import OwnerIcon from '../owner-icon';
import styles from '../owner-app.module.css';
import mobile from '../owner-mobile.module.css';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export default async function OwnerOperationsPage() {
  const access = await requireOwnerAppPageAccess();
  if (!ownerAppCan(access, 'operate')) redirect('/owner-app');
  const tools = [
    { title: 'Add fuel', detail: 'Tank or petrol station.', icon: 'fuel', href: '/owner-app/operations/fuel' },
    { title: 'Record work', detail: 'Checks, services and repairs.', icon: 'record', href: '/owner-app/operations/maintenance' },
    { title: 'Report problem', detail: 'Log an issue with an asset.', icon: 'problem', href: '/owner-app/report-problem' },
    { title: 'Upcoming work', detail: 'View due and upcoming work.', icon: 'calendar', href: '/owner-app/attention' },
  ];
  return <main className={`${styles.page} ${styles.operationsPage}`}>
    <OwnerAppNav />
    <div className={mobile.dashboard}>
      <section className={mobile.intro}><h1>Work</h1><p>Keep your assets running.</p></section>
      <nav className={mobile.rows} aria-label="Maintenance and fuel tools">
        {tools.map(tool => <Link key={tool.href} className={mobile.row} href={tool.href} prefetch={false}><OwnerIcon name={tool.icon} /><span><strong>{tool.title}</strong><small>{tool.detail}</small></span></Link>)}
      </nav>
    </div>
  </main>;
}
