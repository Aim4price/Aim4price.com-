import Link from 'next/link';
import { ownerAppCan, requireOwnerAppPageAccess } from '../../../lib/owner-app-access';
import OwnerAppNav from '../owner-app-nav';
import OwnerIcon from '../owner-icon';
import styles from '../owner-app.module.css';
import mobile from '../owner-mobile.module.css';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export default async function OwnerOperationsPage() {
  const access = await requireOwnerAppPageAccess();
  const tools = [
    { allowed: ownerAppCan(access, 'addFuel') || ownerAppCan(access, 'recordFuelIssues') || ownerAppCan(access, 'refillFuel'), title: 'Add fuel', detail: 'Tank or petrol station.', icon: 'fuel', href: '/owner-app/operations/fuel' },
    { allowed: ownerAppCan(access, 'recordMaintenance') || ownerAppCan(access, 'completeMaintenance'), title: 'Record work', detail: 'Checks, services and repairs.', icon: 'record', href: '/owner-app/operations/maintenance' },
    { allowed: ownerAppCan(access, 'recordMaintenance'), title: 'Report problem', detail: 'Log an issue with an asset.', icon: 'problem', href: '/owner-app/report-problem' },
    { allowed: ownerAppCan(access, 'viewMaintenance'), title: 'Upcoming work', detail: 'View due and upcoming work.', icon: 'calendar', href: '/owner-app/attention' },
  ];
  return <main className={`${styles.page} ${styles.operationsPage}`}>
    <OwnerAppNav />
    <div className={mobile.dashboard}>
      <section className={mobile.intro}><h1>Work</h1><p>Keep your assets running.</p></section>
      <nav className={mobile.rows} aria-label="Maintenance and fuel tools">
        {tools.map(tool => !tool.allowed ? <div key={tool.href} className={mobile.row} aria-disabled="true"><OwnerIcon name={tool.icon} /><span><strong>{tool.title}</strong><small>Access restricted</small></span></div> : <Link key={tool.href} className={mobile.row} href={tool.href} prefetch={false}><OwnerIcon name={tool.icon} /><span><strong>{tool.title}</strong><small>{tool.detail}</small></span></Link>)}
      </nav>
    </div>
  </main>;
}
