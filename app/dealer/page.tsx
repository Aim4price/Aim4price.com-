import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getServerSession } from '../../lib/auth-session';
import { getDealerAppSession } from '../../lib/dealer-app-session';
import { getAccountProfile } from '../../lib/account-profile';
import { dealerRoleCan, type DealerAppCapability } from '../../lib/dealer-app-access';
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
  capability: DealerAppCapability;
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

  const [maintenanceNotifications, leads, trackedAssets, dealerAppSession] = await Promise.all([
    listDealerMaintenanceNotifications(session.user.id).catch(() => []),
    listAssetLeadsForUser(session.user.id).catch(() => []),
    listDealerTrackedAssets(session.user.id).catch(() => []),
    getDealerAppSession(),
  ]);

  const unreadMaintenanceCount = maintenanceNotifications.filter((notification) => !notification.isRead).length;
  const newLeadCount = leads.filter(
    (lead) => lead.partnerUserId === session.user.id && lead.status === 'sent' && !lead.viewedAtIso,
  ).length;
  const attentionCount = trackedAssets.filter((asset) => ATTENTION_STATUSES.has(asset.status)).length;
  const openProblemCount = trackedAssets.reduce(
    (total, asset) => total + asset.loggedProblems.filter((problem) => !problem.notedAtIso).length,
    0,
  );
  const role = dealerAppSession?.role ?? 'owner';

  const tools: DealerHomeTool[] = [
    {
      label: 'Overview',
      href: '/dealer/overview',
      capability: 'overview',
      count: openProblemCount,
    },
    {
      label: 'Notifications',
      href: '/dealer/notifications',
      capability: 'notifications',
      count: unreadMaintenanceCount,
    },
    {
      label: 'Leads',
      href: '/dealer/leads',
      capability: 'leads',
      count: newLeadCount,
    },
    {
      label: 'Maintenance',
      href: '/dealer/maintenance',
      capability: 'maintenance',
      count: attentionCount,
    },
    { label: 'Get Estimate', href: '/dealer/valuation', capability: 'valuation' },
    { label: 'Discover Assets', href: '/dealer/discovery', capability: 'discovery' },
    { label: 'Client Costs', href: '/dealer/cost', capability: 'client_costs' },
    { label: 'Marketplace', href: '/dealer/marketplace', capability: 'marketplace' },
  ].filter((tool) => dealerRoleCan(role, tool.capability));

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
