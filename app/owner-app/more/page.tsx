import Link from 'next/link';
import { ownerAppCan, requireOwnerAppPageAccess, type OwnerAppPermission } from '../../../lib/owner-app-access';
import OwnerAppNav from '../owner-app-nav';
import OwnerIcon from '../owner-icon';
import styles from '../owner-app.module.css';
import mobile from '../owner-mobile.module.css';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const tools: { label: string; detail: string; icon: string; href: string; permission?: OwnerAppPermission }[] = [
  { label: 'Value Asset', detail: 'Estimate what an asset is worth.', icon: 'valuation', href: '/owner-app/valuation', permission: 'manage_assets' },
  { label: 'Discover Assets', detail: 'Explore assets on Aim4price.', icon: 'discovery', href: '/owner-app/discovery' },
  { label: 'Marketplace', detail: 'Browse adverts and manage your listings.', icon: 'marketplace', href: '/owner-app/marketplace', permission: 'manage_marketplace' },
  { label: 'Offline work', detail: 'Prepare and open saved work.', icon: 'offline', href: '/owner-app/offline.html' },
  { label: 'Account', detail: 'Your access and sign-in details.', icon: 'account', href: '/owner-app/account' },
];
export default async function OwnerMorePage() {
  const access = await requireOwnerAppPageAccess();
  return <main className={styles.page}>
    <OwnerAppNav showBack={false} showSignOut />
    <div className={mobile.dashboard}>
      <section className={mobile.intro}><h1>More</h1><p>More tools for your assets.</p></section>
      <nav className={mobile.rows} aria-label="More owner tools">
        {tools.filter(tool => !tool.permission || ownerAppCan(access, tool.permission)).map(tool => <Link key={tool.href} className={mobile.row} href={tool.href} prefetch={false}><OwnerIcon name={tool.icon} /><span><strong>{tool.label}</strong><small>{tool.detail}</small></span></Link>)}
      </nav>
    </div>
  </main>;
}
