import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getServerSession } from '../../lib/auth-session';
import { getAccountProfile } from '../../lib/account-profile';
import {
  listDealerMaintenanceNotifications,
  listDealerTrackedAssets,
} from '../../lib/dealer-maintenance-tracker';
import { listAssetLeadsForUser } from '../../lib/partner-access';
import styles from './dealer.module.css';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ATTENTION_STATUSES = new Set(['overdue', 'due', 'due_soon', 'usage_needed']);

type DealerHomeTool = {
  label: string;
  href: string;
  count?: number;
};

function ToolCard({ tool }: { tool: DealerHomeTool }) {
  return (
    <Link
      className={styles.homeLaunchCard}
      href={tool.href}
      prefetch={false}
      aria-label={tool.count ? `${tool.label}, ${tool.count} new` : tool.label}
    >
      <strong>{tool.label}</strong>
      {tool.count ? <span className={styles.homeLaunchBadge}>{tool.count > 99 ? '99+' : tool.count}</span> : null}
    </Link>
  );
}

export default async function DealerHome() {
  const session = await getServerSession({ allowDealerApp: true });
  if (!session?.user?.id) redirect('/dealer/login');

  const profile = await getAccountProfile({
    id: session.user.id,
    name: session.user.name,
    email: session.user.email,
  });

  if (profile.accountType !== 'dealer' || profile.accountStatus !== 'active') {
    redirect('/dealer/login');
  }

  const [maintenanceNotifications, leads, trackedAssets] = await Promise.all([
    listDealerMaintenanceNotifications(session.user.id).catch(() => []),
    listAssetLeadsForUser(session.user.id).catch(() => []),
    listDealerTrackedAssets(session.user.id).catch(() => []),
  ]);

  const unreadMaintenanceCount = maintenanceNotifications.filter((notification) => !notification.isRead).length;
  const newLeadCount = leads.filter(
    (lead) => lead.partnerUserId === session.user.id && lead.status === 'sent' && !lead.viewedAtIso,
  ).length;
  const attentionCount = trackedAssets.filter((asset) => ATTENTION_STATUSES.has(asset.status)).length;

  const tools: DealerHomeTool[] = [
    {
      label: 'Notifications',
      href: '/dealer/notifications',
      count: unreadMaintenanceCount,
    },
    {
      label: 'Leads',
      href: '/dealer/leads',
      count: newLeadCount,
    },
    {
      label: 'Maintenance',
      href: '/dealer/maintenance',
      count: attentionCount,
    },
    { label: 'Get Estimate', href: '/dealer/valuation' },
    { label: 'Discover Assets', href: '/dealer/discovery' },
    { label: 'Client Costs', href: '/dealer/cost' },
    { label: 'Marketplace', href: '/dealer/marketplace' },
  ];

  return (
    <main className={`${styles.shell} ${styles.homeShell}`}>
      <div className={styles.homeContent}>
        <nav className={styles.homeLauncher} aria-label="Dealer tools">
          {tools.map((tool) => <ToolCard key={tool.href} tool={tool} />)}
        </nav>
      </div>
    </main>
  );
}
