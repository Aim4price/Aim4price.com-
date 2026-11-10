import type { TeamPermission } from '../../../lib/team-access-policy';
import Link from 'next/link';
import { ownerAppCan, requireOwnerAppPageAccess, type OwnerAppPermission } from '../../../lib/owner-app-access';
import OwnerAppNav from '../owner-app-nav';
import OwnerIcon from '../owner-icon';
import styles from '../owner-app.module.css';
import mobile from '../owner-mobile.module.css';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const tools: { label: string; detail: string; icon: string; href: string; permission?: OwnerAppPermission | TeamPermission }[] = [
  { label: 'Fuel ledger', detail: 'Fuel, consumption and reports.', icon: 'fuel', href: '/owner-app/workspace/fuel', permission: 'viewFuel' },
  { label: 'Maintenance', detail: 'Schedules, history and reports.', icon: 'record', href: '/owner-app/workspace/maintenance', permission: 'viewMaintenance' },
  { label: 'Costs', detail: 'Invoices and asset spending.', icon: 'finance', href: '/owner-app/workspace/costs', permission: 'viewCosts' },
  { label: 'Budgets', detail: 'Plan and review spending.', icon: 'finance', href: '/owner-app/workspace/budgets', permission: 'viewBudgets' },
  { label: 'Asset map', detail: 'Locations of your assets.', icon: 'location', href: '/owner-app/workspace/map', permission: 'viewMap' },
  { label: 'Documents', detail: 'Approved files and uploads.', icon: 'documents', href: '/owner-app/workspace/documents' },
  { label: 'Value Asset', detail: 'Estimate an asset’s value.', icon: 'valuation', href: '/owner-app/valuation', permission: 'manage_assets' },
  { label: 'Discover Assets', detail: 'Explore available assets.', icon: 'discovery', href: '/owner-app/discovery' },
  { label: 'Marketplace', detail: 'Browse and manage adverts.', icon: 'marketplace', href: '/owner-app/marketplace', permission: 'manage_marketplace' },
  { label: 'Offline work', detail: 'Save work for offline use.', icon: 'offline', href: '/owner-app/offline.html' },
  { label: 'Account', detail: 'Your profile and access.', icon: 'account', href: '/owner-app/account' },
];
export default async function OwnerMorePage() {
  const access = await requireOwnerAppPageAccess();
  return <main className={styles.page}>
    <OwnerAppNav showBack={false} showSignOut />
    <div className={mobile.dashboard}>
      <section className={mobile.intro}><h1>More</h1><p>More tools for your assets.</p></section>
      <nav className={mobile.rows} aria-label="More owner tools">
        {tools.map(tool => tool.permission && !ownerAppCan(access, tool.permission) ? <div key={tool.href} className={mobile.row} aria-disabled="true"><OwnerIcon name={tool.icon}/><span><strong>{tool.label}</strong><small>Access restricted</small></span></div> : <Link key={tool.href} className={mobile.row} href={tool.href} prefetch={false}><OwnerIcon name={tool.icon} /><span><strong>{tool.label}</strong><small>{tool.detail}</small></span></Link>)}
      </nav>
    </div>
  </main>;
}
