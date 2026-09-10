import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getServerSession, isDealerAppSession } from '../../lib/auth-session';
import { getDealerAppSession } from '../../lib/dealer-app-session';
import { getAccountProfile } from '../../lib/account-profile';
import { dealerRoleCan, type DealerAppCapability } from '../../lib/dealer-app-access';
import { listDealerMaintenanceNotificationsForViewer } from '../../lib/dealer-maintenance-notification-inbox';
import { listDealerTrackedAssets } from '../../lib/dealer-maintenance-tracker';
import { listAssetLeadsForUser } from '../../lib/partner-access';
import { isMiddlemanAccountSubtype } from '../../lib/middleman-account';
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


const TOOL_ICON_PATHS: Partial<Record<DealerAppCapability, string>> = {
  overview: 'M3 10 12 3l9 7v11h-6v-7H9v7H3Z',
  notifications: 'M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9 M10 21h4',
  leads: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2 M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8 M22 21v-2a4 4 0 0 0-3-3.87 M16 3.13a4 4 0 0 1 0 7.75',
  maintenance: 'M14.7 6.3a5.5 5.5 0 0 0-7 7L2.9 18.1a2.1 2.1 0 0 0 3 3l4.8-4.8a5.5 5.5 0 0 0 7-7l-3 3-3-3Z',
  valuation: 'M14 2H5v20h14V7Z M14 2v5h5 M8 11h8 M8 15h8 M8 19h5',
  ad_studio: 'M3 10v6h5l11 4V4L8 10Z M8 10v6l2 6H6l-2-6 M22 10v4',
  showroom: 'M3 10v11h18V10 M2 10l2-7h16l2 7 M2 10a3.33 3.33 0 0 0 6.67 0 3.33 3.33 0 0 0 6.66 0A3.33 3.33 0 0 0 22 10 M9 21v-7h6v7',
  discovery: 'M12 2 3 7v10l9 5 9-5V7Z M3 7l9 5 9-5 M12 12v10',
  marketplace: 'M2 3h3l3 13h11l3-9H6 M10 21a1 1 0 1 0 0-2 1 1 0 0 0 0 2 M18 21a1 1 0 1 0 0-2 1 1 0 0 0 0 2',
};

function ToolCard({ tool }: { tool: DealerHomeTool }) {
  return (
    <Link
      className={styles.homeLaunchCard}
      href={tool.href}
      prefetch={false}
      aria-label={tool.count ? `${tool.label}, ${tool.count} new` : tool.label}
    >
      <svg className={styles.homeLaunchIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
        <path d={TOOL_ICON_PATHS[tool.capability]} />
      </svg>
      <strong>{tool.label}</strong>
      <span className={styles.homeLaunchEnd}>
        {tool.count ? <span className={styles.homeLaunchBadge}>{tool.count > 99 ? '99+' : tool.count}</span> : null}
        <svg className={styles.homeLaunchChevron} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
          <path d="m9 5 7 7-7 7" />
        </svg>
      </span>
    </Link>
  );
}

export default async function DealerHome() {
  const session = await getServerSession({ allowDealerApp: true });
  if (!session?.user?.id) redirect('/dealer/login');

  const [profile, dealerAppSession] = await Promise.all([
    getAccountProfile({
      id: session.user.id,
      name: session.user.name,
      email: session.user.email,
    }),
    getDealerAppSession(),
  ]);

  if (profile.accountType !== 'dealer' || profile.accountStatus !== 'active') {
    redirect('/dealer/login');
  }

  const activeStaffId = isDealerAppSession(session) ? session.dealerApp.staffId : null;
  const [maintenanceNotifications, leads, trackedAssets] = await Promise.all([
    listDealerMaintenanceNotificationsForViewer({
      dealerUserId: session.user.id,
      viewerKey: activeStaffId
        ? `dealer-staff:${activeStaffId}`
        : `account:${session.user.id}`,
      staffId: activeStaffId,
    }).catch(() => []),
    listAssetLeadsForUser(session.user.id).catch(() => []),
    listDealerTrackedAssets(session.user.id).catch(() => []),
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
  const middlemanMode = false;

  const allTools: DealerHomeTool[] = [
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
    { label: 'Ad Studio', href: '/dealer/ad-studio', capability: 'ad_studio' },
    { label: 'My Showroom', href: '/dealer/showroom', capability: 'showroom' },
    { label: 'Discover Assets', href: '/dealer/discovery', capability: 'discovery' },
    { label: 'Marketplace', href: '/dealer/marketplace', capability: 'marketplace' },
  ];
  const middlemanCapabilities = new Set<DealerAppCapability>(['valuation', 'discovery', 'marketplace', 'ad_studio', 'showroom']);
  const orderedTools = middlemanMode
    ? [...middlemanCapabilities].flatMap((capability) => allTools.filter((tool) => tool.capability === capability))
    : allTools;
  const tools = orderedTools.filter((tool) =>
    dealerRoleCan(role, tool.capability)
    && (!middlemanMode || middlemanCapabilities.has(tool.capability)),
  );

  return (
    <main className={`${styles.shell} ${styles.homeShell}`}>
      <div className={styles.homeContent}>
        <nav className={styles.homeLauncher} aria-label={middlemanMode ? 'Middleman tools' : 'Dealer tools'}>
          {tools.map((tool) => <ToolCard key={tool.href} tool={tool} />)}
          <Link className={styles.homeLaunchCard} href="/dealer/account"><strong>Account</strong></Link>
        </nav>
      </div>
    </main>
  );
}



